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
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const videoPreviewRef = useRef(null);
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

  const startRecording = async () => {
    setError('');
    setVideoUrl(null);
    try {
      const { width, height } = resolutionMap[resolution];
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: frameRate, max: frameRate },
          width: { ideal: width, max: width },
          height: { ideal: height, max: height }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000
        }
      });
      recordedChunksRef.current = [];
      const options = {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 25000000, // 25 Mbps for ultra high quality
        audioBitsPerSecond: 512000 // 512 kbps for high quality audio
      };
      const mediaRecorder = new window.MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      setError('Screen recording failed: ' + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const downloadRecording = () => {
    if (videoUrl) {
      const a = document.createElement('a');
      a.href = videoUrl;
      a.download = 'pisethz-recording.webm';
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
                      src={videoUrl}
                      controls
                      className="w-100 rounded-2 bg-black border border-secondary"
                    />
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