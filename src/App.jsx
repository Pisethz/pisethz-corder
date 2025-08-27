import { useRef, useState, useEffect } from 'react';
import { Monitor, Play, Square, Download, ArrowRight, Zap, Shield } from 'lucide-react';

// Bootstrap CSS import (ensure it's included in main.jsx or index.html as well)
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  const [recording, setRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [error, setError] = useState('');
  const [showRecorder, setShowRecorder] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedMimeType, setSelectedMimeType] = useState('video/webm');
  const [includeCamera, setIncludeCamera] = useState(true);
  const [includeMic, setIncludeMic] = useState(true);
  const [performanceMode, setPerformanceMode] = useState(true);
  const [compatMode, setCompatMode] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const videoPreviewRef = useRef(null);
  const canvasRef = useRef(null);
  const screenVideoRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const livePreviewVideoRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const videoFrameCallbackIdRef = useRef(null);
  const timeoutIdRef = useRef(null);
  const audioContextRef = useRef(null);
  const screenStreamRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const micStreamRef = useRef(null);
  const audioDestinationRef = useRef(null);
  const micSourceNodeRef = useRef(null);
  const screenSourceNodeRef = useRef(null);
  const canvasCaptureTrackRef = useRef(null);
  // Video quality and frame rate state
  const [resolution, setResolution] = useState('4k');
  const [frameRate, setFrameRate] = useState(120);

  // Map for resolution values
  const resolutionMap = {
    '720': { width: 1280, height: 720 },
    '1080': { width: 1920, height: 1080 },
    '2k': { width: 2560, height: 1440 },
    '4k': { width: 3840, height: 2160 },
  };

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const isMobile = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  const isSafari = () => /Safari/i.test(navigator.userAgent || '') && !/Chrome|Chromium/i.test(navigator.userAgent || '');

  const pickSupportedMimeType = () => {
    // Prefer types based on browser; Safari/iOS tends to prefer MP4
    const webmList = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    const mp4List = [
      'video/mp4;codecs=h264,aac',
      'video/mp4;codecs=h264',
      'video/mp4'
    ];
    const preferredTypes = isSafari() ? [...mp4List, ...webmList] : [...webmList, ...mp4List];
    for (const type of preferredTypes) {
      try {
        if (window.MediaRecorder && window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported(type)) {
          return type;
        }
      } catch (_) {
        // ignore and continue trying
      }
    }
    return 'video/webm';
  };

  // Try multiple APIs to acquire a screen stream across browsers
  const acquireScreenStream = async (videoConstraints, wantAudio) => {
    const devices = navigator.mediaDevices;
    const baseAudio = wantAudio
      ? {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000
        }
      : false;

    // 1) Standard
    if (devices && typeof devices.getDisplayMedia === 'function') {
      return await devices.getDisplayMedia({ video: videoConstraints, audio: baseAudio });
    }
    // 2) Legacy navigator.getDisplayMedia
    if (typeof navigator.getDisplayMedia === 'function') {
      return await navigator.getDisplayMedia({ video: videoConstraints, audio: baseAudio });
    }
    // 3) Firefox legacy fallback using mediaSource
    if (devices && typeof devices.getUserMedia === 'function') {
      const ffCandidates = [
        { mediaSource: 'screen' },
        { mediaSource: 'window' },
        { mediaSource: 'application' }
      ];
      for (const cand of ffCandidates) {
        try {
          const vc = { ...videoConstraints, mediaSource: cand.mediaSource };
          // Some engines expect the constraint nested under video
          return await devices.getUserMedia({ video: vc, audio: baseAudio });
        } catch (_) {
          // try next candidate
        }
      }
    }
    throw new Error('Screen capture API is unavailable in this browser. Use a Chromium-based browser, Firefox, or Safari 16+ over HTTPS.');
  };

  // Helpers
  const stopStream = (stream) => {
    try {
      if (stream && stream.getTracks) {
        stream.getTracks().forEach(t => {
          try { t.stop(); } catch (_) {}
        });
      }
    } catch (_) {}
  };

  const resetSession = async () => {
    try {
      if (mediaRecorderRef.current && recording) {
        try { mediaRecorderRef.current.stop(); } catch (_) {}
      }
      mediaRecorderRef.current = null;
      if (animationFrameIdRef.current) { cancelAnimationFrame(animationFrameIdRef.current); animationFrameIdRef.current = null; }
      if (videoFrameCallbackIdRef.current && screenVideoRef.current && typeof screenVideoRef.current.cancelVideoFrameCallback === 'function') {
        try { screenVideoRef.current.cancelVideoFrameCallback(videoFrameCallbackIdRef.current); } catch (_) {}
      }
      videoFrameCallbackIdRef.current = null;
      if (timeoutIdRef.current) { clearTimeout(timeoutIdRef.current); timeoutIdRef.current = null; }
      stopStream(screenStreamRef.current); screenStreamRef.current = null;
      stopStream(cameraStreamRef.current); cameraStreamRef.current = null;
      stopStream(micStreamRef.current); micStreamRef.current = null;
      if (micSourceNodeRef.current) { try { micSourceNodeRef.current.disconnect(); } catch (_) {} micSourceNodeRef.current = null; }
      if (screenSourceNodeRef.current) { try { screenSourceNodeRef.current.disconnect(); } catch (_) {} screenSourceNodeRef.current = null; }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') { try { await audioContextRef.current.close(); } catch (_) {} }
      audioContextRef.current = null;
      audioDestinationRef.current = null;
      if (screenVideoRef.current) { screenVideoRef.current.srcObject = null; screenVideoRef.current.onloadeddata = null; screenVideoRef.current.onloadedmetadata = null; }
      if (cameraVideoRef.current) { cameraVideoRef.current.srcObject = null; cameraVideoRef.current.onloadeddata = null; cameraVideoRef.current.onloadedmetadata = null; }
    } catch (_) {}
  };

  const startRecording = async () => {
    if (isStarting || recording) return;
    setIsStarting(true);
    setError('');
    // Revoke previous object URL to free resources
    if (videoUrl) {
      try { URL.revokeObjectURL(videoUrl); } catch (_) {}
    }
    setVideoUrl(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Screen capture is not available in this browser. Try Chrome (Android) or Safari (iOS 16+).');
      }

      const { width, height } = resolutionMap[resolution];

      // Mobile browsers are stricter with constraints; keep them minimal
      const videoConstraints = isMobile()
        ? { frameRate: { ideal: Math.min(frameRate, 30), max: 30 } }
        : {
            frameRate: { ideal: frameRate, max: frameRate },
            width: { ideal: width, max: width },
            height: { ideal: height, max: height }
          };

      let screenStream;
      try {
        screenStream = await acquireScreenStream(videoConstraints, !isMobile());
      } catch (e) {
        // Retry without audio if the first attempt fails due to audio constraints
        screenStream = await acquireScreenStream(videoConstraints, false);
      }

      // Prepare optional camera and microphone streams
      let cameraStream = null;
      let micStream = null;
      try {
        if (includeCamera) {
          cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' },
            audio: false
          });
        }
      } catch (_) {
        // If camera fails, continue without it
      }
      try {
        if (includeMic) {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        }
      } catch (_) {
        // If mic fails, continue without it
      }

      // Setup hidden media elements for compositing
      if (!canvasRef.current) {
        const canvas = document.createElement('canvas');
        canvasRef.current = canvas;
      }
      if (!screenVideoRef.current) {
        const v = document.createElement('video');
        v.muted = true;
        v.playsInline = true;
        v.autoplay = true;
        screenVideoRef.current = v;
      }
      if (!cameraVideoRef.current) {
        const v = document.createElement('video');
        v.muted = true;
        v.playsInline = true;
        v.autoplay = true;
        cameraVideoRef.current = v;
      }

      screenStreamRef.current = screenStream;
      screenVideoRef.current.srcObject = screenStream;
      try { await screenVideoRef.current.play?.(); } catch (_) {}
      await new Promise((resolve) => {
        const v = screenVideoRef.current;
        if (!v) return resolve();
        if (v.readyState >= 2) return resolve();
        const onReady = () => { cleanup(); resolve(); };
        const timer = setTimeout(() => { cleanup(); resolve(); }, 800);
        const cleanup = () => {
          try { v.removeEventListener('loadedmetadata', onReady); } catch (_) {}
          try { v.removeEventListener('loadeddata', onReady); } catch (_) {}
          clearTimeout(timer);
        };
        v.addEventListener('loadedmetadata', onReady, { once: true });
        v.addEventListener('loadeddata', onReady, { once: true });
      });
      if (cameraStream) {
        cameraStreamRef.current = cameraStream;
        cameraVideoRef.current.srcObject = cameraStream;
        try { await cameraVideoRef.current.play?.(); } catch (_) {}
      }

      // Determine canvas size (prefer actual video dimensions)
      const screenTrack = screenStream.getVideoTracks()[0];
      const settings = screenTrack ? screenTrack.getSettings() : {};
      let canvasWidth = settings.width || width || 1280;
      let canvasHeight = settings.height || height || 720;
      const applyCanvasSizeFromVideo = () => {
        const vw = screenVideoRef.current?.videoWidth || 0;
        const vh = screenVideoRef.current?.videoHeight || 0;
        if (vw && vh) {
          canvasWidth = vw;
          canvasHeight = vh;
        }
        canvasRef.current.width = canvasWidth;
        canvasRef.current.height = canvasHeight;
      };
      applyCanvasSizeFromVideo();

      // Draw loop
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (videoFrameCallbackIdRef.current && screenVideoRef.current && typeof screenVideoRef.current.cancelVideoFrameCallback === 'function') {
        screenVideoRef.current.cancelVideoFrameCallback(videoFrameCallbackIdRef.current);
        videoFrameCallbackIdRef.current = null;
      }
      if (timeoutIdRef.current) { clearTimeout(timeoutIdRef.current); timeoutIdRef.current = null; }
      const ctx = canvasRef.current.getContext('2d');
      if (ctx && 'imageSmoothingEnabled' in ctx) ctx.imageSmoothingEnabled = false;
      if (ctx && 'imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
      const draw = () => {
        try {
          // Clear
          ctx.clearRect(0, 0, canvasWidth, canvasHeight);
          // Draw screen first
          if (screenVideoRef.current && screenVideoRef.current.readyState >= 2) {
            ctx.drawImage(screenVideoRef.current, 0, 0, canvasWidth, canvasHeight);
          }
          // Draw camera PiP
          const activeCamera = includeCamera && cameraVideoRef.current && cameraVideoRef.current.readyState >= 2 && cameraStreamRef.current && cameraStreamRef.current.getVideoTracks().length > 0;
          if (activeCamera) {
            const pipWidth = Math.round(canvasWidth * (performanceMode ? 0.18 : 0.25));
            const pipHeight = Math.round(pipWidth * 9 / 16);
            const margin = Math.max(12, Math.round(canvasWidth * 0.015));
            const x = canvasWidth - pipWidth - margin;
            const y = canvasHeight - pipHeight - margin;
            ctx.save();
            // Rounded rect clip for a nicer look
            const radius = Math.round(pipWidth * 0.06);
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.arcTo(x + pipWidth, y, x + pipWidth, y + pipHeight, radius);
            ctx.arcTo(x + pipWidth, y + pipHeight, x, y + pipHeight, radius);
            ctx.arcTo(x, y + pipHeight, x, y, radius);
            ctx.arcTo(x, y, x + pipWidth, y, radius);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(cameraVideoRef.current, x, y, pipWidth, pipHeight);
            ctx.restore();
          }
        } catch (_) {}
        // Schedule next frame using requestVideoFrameCallback if available for efficiency
        const vid = screenVideoRef.current;
        if (vid && typeof vid.requestVideoFrameCallback === 'function') {
          videoFrameCallbackIdRef.current = vid.requestVideoFrameCallback(() => draw());
        } else {
          const targetFps = performanceMode ? 24 : 60;
          timeoutIdRef.current = setTimeout(draw, Math.round(1000 / targetFps));
        }
      };
      // Start drawing once the videos have frames
      const startOncePlayable = () => {
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        if (videoFrameCallbackIdRef.current && screenVideoRef.current && typeof screenVideoRef.current.cancelVideoFrameCallback === 'function') {
          screenVideoRef.current.cancelVideoFrameCallback(videoFrameCallbackIdRef.current);
        }
        if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
        applyCanvasSizeFromVideo();
        draw();
      };
      screenVideoRef.current.onloadeddata = startOncePlayable;
      screenVideoRef.current.onloadedmetadata = startOncePlayable;
      if (includeCamera && cameraStream) {
        cameraVideoRef.current.onloadeddata = startOncePlayable;
        cameraVideoRef.current.onloadedmetadata = startOncePlayable;
      }
      // Start drawing immediately as a fallback
      if (!(compatMode || isMobile())) {
        draw();
      }

      // Compose audio with live mic toggle support
      let mixedAudioTracks = [];
      try {
        const screenAudioTracks = screenStream.getAudioTracks ? screenStream.getAudioTracks() : [];
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
          if (!audioContextRef.current || audioContextRef.current.state === 'closed') audioContextRef.current = new AC();
          if (audioContextRef.current.state === 'suspended') {
            try { await audioContextRef.current.resume(); } catch (_) {}
          }
          audioDestinationRef.current = audioContextRef.current.createMediaStreamDestination();
          if (screenAudioTracks && screenAudioTracks.length > 0) {
            const screenAudioStream = new MediaStream();
            screenAudioTracks.forEach(t => screenAudioStream.addTrack(t));
            screenSourceNodeRef.current = audioContextRef.current.createMediaStreamSource(screenAudioStream);
            screenSourceNodeRef.current.connect(audioDestinationRef.current);
          }
          if (includeMic) {
            if (!micStreamRef.current) micStreamRef.current = micStream || null;
            if (micStreamRef.current) {
              micSourceNodeRef.current = audioContextRef.current.createMediaStreamSource(micStreamRef.current);
              micSourceNodeRef.current.connect(audioDestinationRef.current);
            }
          }
          mixedAudioTracks = audioDestinationRef.current.stream.getAudioTracks();
        } else {
          // No AudioContext, fallback to available tracks
          const fallbackTracks = [];
          if (screenStream.getAudioTracks) fallbackTracks.push(...screenStream.getAudioTracks());
          if (includeMic && micStream && micStream.getAudioTracks) fallbackTracks.push(...micStream.getAudioTracks());
          mixedAudioTracks = fallbackTracks;
        }
      } catch (_) {
        const fallbackTracks = [];
        if (screenStream.getAudioTracks) fallbackTracks.push(...screenStream.getAudioTracks());
        if (includeMic && micStream && micStream.getAudioTracks) fallbackTracks.push(...micStream.getAudioTracks());
        mixedAudioTracks = fallbackTracks;
      }

      // Create composed stream from canvas + mixed audio only if PiP is enabled and not mobile and not in compat mode
      const captureFps = performanceMode ? Math.min(30, frameRate) : Math.min(60, frameRate);
      let composedStream;
      const needCanvasComposition = includeCamera && !isMobile() && !compatMode;
      if (needCanvasComposition && canvasRef.current && canvasRef.current.captureStream) {
        const cap = canvasRef.current.captureStream(captureFps);
        const composedVideoTrack = cap && cap.getVideoTracks ? cap.getVideoTracks()[0] : null;
        if (composedVideoTrack) {
          canvasCaptureTrackRef.current = composedVideoTrack;
          composedStream = new MediaStream([composedVideoTrack, ...mixedAudioTracks]);
        }
      }
      if (!composedStream) {
        // Use direct screen video if PiP is off or captureStream is unavailable
        composedStream = new MediaStream([
          ...screenStream.getVideoTracks(),
          ...(mixedAudioTracks || [])
        ]);
      }

      // Ensure we actually have a video track
      if (!composedStream.getVideoTracks || composedStream.getVideoTracks().length === 0) {
        const fallbackVideo = screenStream.getVideoTracks ? screenStream.getVideoTracks() : [];
        if (!fallbackVideo || fallbackVideo.length === 0) {
          throw new Error('No video track captured. Please reselect a screen/window and try again.');
        }
        composedStream = new MediaStream([
          ...fallbackVideo,
          ...(mixedAudioTracks || [])
        ]);
      }
      recordedChunksRef.current = [];
      if (!window.MediaRecorder) {
        throw new Error('Recording is not supported in this browser. Try the latest Chrome (Android) or Safari (iOS 17+).');
      }

      const chosenType = pickSupportedMimeType();
      setSelectedMimeType(chosenType);
      const options = {
        mimeType: chosenType,
        // Use a conservative default on mobile to reduce encoder pressure
        videoBitsPerSecond: performanceMode ? 6_000_000 : (isMobile() ? 10_000_000 : 16_000_000),
        audioBitsPerSecond: performanceMode ? 160_000 : 256_000
      };

      let mediaRecorder;
      try {
        mediaRecorder = new window.MediaRecorder(composedStream, options);
      } catch (_) {
        // As a last resort, try without specifying options
        mediaRecorder = new window.MediaRecorder(composedStream);
      }
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: selectedMimeType || 'video/webm' });
        if (!blob || blob.size === 0) {
          setError('Recording produced an empty file. Please try again and reselect the screen/window.');
          return;
        }
        const url = URL.createObjectURL(blob);
        setVideoUrl(prev => {
          if (prev) {
            try { URL.revokeObjectURL(prev); } catch (_) {}
          }
          return url;
        });
        // Force preview element to reload the new blob
        try {
          if (videoPreviewRef.current) {
            const el = videoPreviewRef.current;
            el.srcObject = null;
            el.src = '';
            el.preload = 'metadata';
            el.src = url;
            el.load();
            el.onloadedmetadata = () => {
              try { el.currentTime = 0; } catch (_) {}
            };
          }
        } catch (_) {}
        // Stop original streams
        if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach(track => track.stop());
        if (cameraStreamRef.current) cameraStreamRef.current.getTracks().forEach(track => track.stop());
        if (canvasCaptureTrackRef.current) {
          try { canvasCaptureTrackRef.current.stop(); } catch (_) {}
          canvasCaptureTrackRef.current = null;
        }
        if (micSourceNodeRef.current) {
          try { micSourceNodeRef.current.disconnect(); } catch (_) {}
          micSourceNodeRef.current = null;
        }
        if (screenSourceNodeRef.current) {
          try { screenSourceNodeRef.current.disconnect(); } catch (_) {}
          screenSourceNodeRef.current = null;
        }
        if (micStreamRef.current) {
          micStreamRef.current.getTracks().forEach(track => track.stop());
          micStreamRef.current = null;
        }
        // Stop canvas drawing and audio context
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        if (videoFrameCallbackIdRef.current && screenVideoRef.current && typeof screenVideoRef.current.cancelVideoFrameCallback === 'function') {
          screenVideoRef.current.cancelVideoFrameCallback(videoFrameCallbackIdRef.current);
        }
        if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }
      };

      // Use a 1s timeslice so dataavailable fires periodically and on some browsers more reliably
      mediaRecorder.start(1000);
      // Wire live preview depending on mode
      try {
        if (compatMode || isMobile()) {
          if (livePreviewVideoRef.current) {
            livePreviewVideoRef.current.srcObject = composedStream;
            await livePreviewVideoRef.current.play?.();
          }
        }
      } catch (_) {}
      mediaRecorder.onerror = (e) => {
        setError('Recorder error: ' + (e?.error?.message || e?.message || 'unknown error'));
      };
      setRecording(true);
      setIsStarting(false);
    } catch (err) {
      setError('Screen recording failed: ' + err.message);
      setIsStarting(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      // Immediately tear down canvas capture to prevent stale tracks in next session
      if (canvasCaptureTrackRef.current) {
        try { canvasCaptureTrackRef.current.stop(); } catch (_) {}
        canvasCaptureTrackRef.current = null;
      }
      if (timeoutIdRef.current) { clearTimeout(timeoutIdRef.current); timeoutIdRef.current = null; }
      if (animationFrameIdRef.current) { cancelAnimationFrame(animationFrameIdRef.current); animationFrameIdRef.current = null; }
    }
  };

  const downloadRecording = () => {
    if (videoUrl) {
      const a = document.createElement('a');
      a.href = videoUrl;
      const useMp4 = (selectedMimeType || '').includes('mp4');
      a.download = `pisethz-recording.${useMp4 ? 'mp4' : 'webm'}`;
      a.click();
    }
  };

  const FloatingElement = ({ children, delay = 0, className = "" }) => (
    <div 
      className={`animate-bounce ${className}`} 
      style={{ 
        animationDelay: `${delay}s`,
        animationDuration: '3s'
      }}
    >
      {children}
    </div>
  );

  return (
    <div className="min-vh-100 bg-dark position-relative overflow-hidden">
      {/* Decorative background (Bootstrap doesn't have built-in gradients like Tailwind, so use a simple overlay) */}
      <div className="position-absolute top-0 start-0 w-100 h-100" style={{ zIndex: 0, background: 'radial-gradient(circle at 60% 40%, #6f42c1 0%, #0d6efd 100%)', opacity: 0.15 }}></div>

      {!showRecorder ? (
        <div className="position-relative z-1 d-flex flex-column align-items-center justify-content-center min-vh-100 px-3">
          {/* Hero Section */}
          <div className={`text-center animate__animated animate__fadeIn animate__faster ${isLoaded ? 'animate__fadeInDown' : ''}`}> 
            {/* Quality Controls */}
            <div className="d-flex justify-content-center gap-3 mb-4">
              <div>
                <label className="form-label text-white me-2">Resolution:</label>
                <select
                  className="form-select d-inline-block w-auto"
                  value={resolution}
                  onChange={e => setResolution(e.target.value)}
                  disabled={recording}
                >
                  <option value="720">720p</option>
                  <option value="1080">1080p</option>
                  <option value="2k">2K</option>
                  <option value="4k">4K</option>
                </select>
              </div>
              <div>
                <label className="form-label text-white me-2">Frame Rate:</label>
                <select
                  className="form-select d-inline-block w-auto"
                  value={frameRate}
                  onChange={e => setFrameRate(Number(e.target.value))}
                  disabled={recording}
                >
                  <option value={30}>30 fps</option>
                  <option value={60}>60 fps</option>
                  <option value={120}>120 fps</option>
                </select>
              </div>
            </div>
            {/* Logo/Brand */}
            <div className="d-flex align-items-center justify-content-center mb-4 animate__animated animate__zoomIn animate__fast">
              <div className="position-relative me-3">
                <Monitor className="display-4 text-light" />
                <div className="position-absolute top-0 start-0 w-75 h-50 bg-primary rounded opacity-50" style={{ filter: 'blur(8px)' }}></div>
              </div>
              <h1 className="display-3 fw-bold text-light mb-0">
                <span className="text-gradient" style={{ background: 'linear-gradient(90deg, #a78bfa, #f472b6, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Pisethz
                </span>
                <span className="text-light">-corder</span>
              </h1>
            </div>

            <p className="fs-4 text-white-50 mb-4 mx-auto animate__animated animate__fadeInUp animate__delay-1s" style={{ maxWidth: 700 }}>
              Professional screen recording made effortless. Capture in 4K, record with crystal-clear audio, and share instantly.
            </p>

            {/* Feature Cards */}
            <div className="row g-4 mb-4 justify-content-center animate__animated animate__fadeInUp animate__delay-2s">
              <div className="col-12 col-md-4">
                <div className="card bg-light bg-opacity-10 border-0 shadow-sm h-100 text-center animate__animated animate__zoomIn animate__delay-2s">
                  <div className="card-body">
                    <Zap className="mb-2 text-warning" size={32} />
                    <h5 className="card-title text-light">Lightning Fast</h5>
                    <p className="card-text text-light">Start recording instantly with one click</p>
                  </div>
                </div>
              </div>
              <div className="col-12 col-md-4">
                <div className="card bg-light bg-opacity-10 border-0 shadow-sm h-100 text-center animate__animated animate__zoomIn animate__delay-3s">
                  <div className="card-body">
                    <Shield className="mb-2 text-success" size={32} />
                    <h5 className="card-title text-light">Privacy First</h5>
                    <p className="card-text text-light">No uploads, everything stays local</p>
                  </div>
                </div>
              </div>
              <div className="col-12 col-md-4">
                <div className="card bg-light bg-opacity-10 border-0 shadow-sm h-100 text-center animate__animated animate__zoomIn animate__delay-4s">
                  <div className="card-body">
                    <Download className="mb-2 text-primary" size={32} />
                    <h5 className="card-title text-light">4K Quality</h5>
                    <p className="card-text text-light">Record in ultra-high definition</p>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <div className="mt-4 animate__animated animate__pulse animate__infinite animate__slower">
              <button
                className="btn btn-lg btn-primary px-5 py-3 fw-bold shadow"
                onClick={() => setShowRecorder(true)}
              >
                Start Recording Now <ArrowRight className="ms-2" size={20} />
              </button>
            </div>
          </div>

          {/* Footer */}
          <footer className="position-absolute bottom-0 start-50 translate-middle-x text-white-50 text-center pb-3 w-100 animate__animated animate__fadeInUp animate__delay-3s" style={{ fontSize: '0.95rem' }}>
            &copy; {new Date().getFullYear()} Pisethz-corder. All Rights Reserved <span role="img" aria-label="love">❤️</span> 
          </footer>
        </div>
      ) : (
        <div className="position-relative z-1 d-flex flex-column align-items-center justify-content-center min-vh-100 px-3">
          <div className="w-100" style={{ maxWidth: 600 }}>
            <div className="card bg-light bg-opacity-10 border-0 shadow-lg rounded-4 p-4 animate__animated animate__fadeIn">
              <div className="text-center mb-4">
                <div className="d-flex align-items-center justify-content-center mb-2">
                  <Monitor className="me-2 text-primary" size={32} />
                  <h2 className="h3 fw-bold text-light mb-0">Recording Studio</h2>
                </div>
                {recording && (
                  <div className="d-flex align-items-center justify-content-center">
                    <span className="badge bg-danger me-2">●</span>
                    <span className="text-danger fw-medium">Recording in progress...</span>
                  </div>
                )}
                <div className="d-flex justify-content-center gap-3 mt-3">
                  <div className="form-check form-switch text-light">
                    <input className="form-check-input" type="checkbox" id="perfMode" checked={performanceMode} onChange={e => setPerformanceMode(e.target.checked)} disabled={recording} />
                    <label className="form-check-label ms-2" htmlFor="perfMode">Performance Mode</label>
                  </div>
                  <div className="form-check form-switch text-light">
                    <input className="form-check-input" type="checkbox" id="compatMode" checked={compatMode} onChange={e => setCompatMode(e.target.checked)} disabled={recording} />
                    <label className="form-check-label ms-2" htmlFor="compatMode">Compatibility Mode</label>
                  </div>
                </div>
              </div>

              {/* Capture options */}
              <div className="d-flex flex-column flex-sm-row gap-3 mb-3 justify-content-center align-items-center">
                <div className="form-check form-switch text-light">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="toggleCamera"
                    checked={includeCamera}
                    onChange={async (e) => {
                      const checked = e.target.checked;
                      setIncludeCamera(checked);
                      if (!recording) return;
                      if (checked && !cameraStreamRef.current) {
                        try {
                          const cs = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
                          cameraStreamRef.current = cs;
                          if (cameraVideoRef.current) {
                            cameraVideoRef.current.srcObject = cs;
                            try { await cameraVideoRef.current.play?.(); } catch (_) {}
                          }
                        } catch (_) {
                          setIncludeCamera(false);
                        }
                      } else if (!checked && cameraStreamRef.current) {
                        cameraStreamRef.current.getTracks().forEach(t => t.stop());
                        cameraStreamRef.current = null;
                        if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
                      }
                    }}
                  />
                  <label className="form-check-label ms-2" htmlFor="toggleCamera">Include Camera (PiP)</label>
                </div>
                <div className="form-check form-switch text-light">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="toggleMic"
                    checked={includeMic}
                    onChange={async (e) => {
                      const checked = e.target.checked;
                      setIncludeMic(checked);
                      // Allow toggling mic during recording
                      if (!recording) return;
                      const AC = window.AudioContext || window.webkitAudioContext;
                      if (AC) {
                        if (!audioContextRef.current || audioContextRef.current.state === 'closed') audioContextRef.current = new AC();
                        if (audioContextRef.current.state === 'suspended') {
                          try { await audioContextRef.current.resume(); } catch (_) {}
                        }
                      }
                      if (checked) {
                        try {
                          if (!micStreamRef.current) {
                            micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                          }
                          if (audioContextRef.current && audioDestinationRef.current) {
                            if (!micSourceNodeRef.current) {
                              micSourceNodeRef.current = audioContextRef.current.createMediaStreamSource(micStreamRef.current);
                              micSourceNodeRef.current.connect(audioDestinationRef.current);
                            }
                          }
                        } catch (_) {
                          setIncludeMic(false);
                        }
                      } else {
                        try {
                          if (micSourceNodeRef.current) {
                            micSourceNodeRef.current.disconnect();
                            micSourceNodeRef.current = null;
                          }
                          if (micStreamRef.current) {
                            micStreamRef.current.getTracks().forEach(t => t.stop());
                            micStreamRef.current = null;
                          }
                        } catch (_) {}
                      }
                    }}
                  />
                  <label className="form-check-label ms-2" htmlFor="toggleMic">Include Microphone</label>
                </div>
              </div>

              <div className="d-flex flex-column flex-sm-row gap-3 mb-4 justify-content-center">
                {!recording ? (
                  <button
                    onClick={startRecording}
                    className="btn btn-success btn-lg d-flex align-items-center justify-content-center px-4"
                  >
                    <Play className="me-2" size={20} /> Start Recording
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="btn btn-danger btn-lg d-flex align-items-center justify-content-center px-4"
                  >
                    <Square className="me-2" size={20} /> Stop Recording
                  </button>
                )}
                <button
                  onClick={() => setShowRecorder(false)}
                  className="btn btn-outline-light btn-lg px-4"
                >
                  Back to Home
                </button>
              </div>

              {videoUrl && !recording && (
                <div className="mb-4 animate__animated animate__fadeIn">
                  <button
                    onClick={downloadRecording}
                    className="btn btn-primary btn-lg w-100 d-flex align-items-center justify-content-center mb-3"
                  >
                    <Download className="me-2" size={20} /> Download Recording
                  </button>
                  <div className="bg-dark rounded-3 p-3 border border-secondary">
                    <h3 className="h5 fw-semibold text-light mb-3 text-center">Preview Your Recording</h3>
                    <video
                      ref={videoPreviewRef}
                      src={videoUrl || ''}
                      preload="metadata"
                      onError={() => {
                        try {
                          if (videoPreviewRef.current && videoUrl) {
                            videoPreviewRef.current.src = videoUrl;
                            videoPreviewRef.current.load();
                          }
                        } catch (_) {}
                      }}
                      controls
                      className="w-100 rounded-2 bg-black border border-secondary"
                    />
                  </div>
                </div>
              )}

              {!videoUrl && (
                <div className="mb-4 animate__animated animate__fadeIn">
                  <div className="bg-dark rounded-3 p-3 border border-secondary">
                    <h3 className="h6 fw-semibold text-light mb-2 text-center">Live Preview</h3>
                    {compatMode || isMobile() ? (
                      <video
                        ref={livePreviewVideoRef}
                        muted
                        playsInline
                        autoPlay
                        className="w-100 rounded-2 bg-black border border-secondary"
                      />
                    ) : (
                      <canvas
                        id="livePreviewCanvas"
                        width={640}
                        height={360}
                        ref={(node) => {
                          // Attach the visible canvas for drawing
                          if (node) {
                            canvasRef.current = node;
                          }
                        }}
                        className="w-100 rounded-2 bg-black border border-secondary"
                      />
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="alert alert-danger mt-3" role="alert">
                  <p className="mb-0 text-center">{error}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;