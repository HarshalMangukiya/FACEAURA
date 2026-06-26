import React, { useState, useRef } from 'react';
import { uploadImage, detectFace, getAnalysisResult } from '../services/analysisService';
import Camera from '../modules/camera/Camera';
import { 
  Cpu, 
  Sparkles, 
  Copy, 
  Check, 
  Loader2, 
  AlertCircle, 
  RefreshCw, 
  FileJson, 
  Image as ImageIcon,
  Camera as CameraIcon
} from 'lucide-react';

/**
 * LiveDetection Page Component
 * 
 * Embeds the Live Camera viewport, grabs video frame feeds, sends them to
 * the backend face-mesh model, and parses the returned 468 landmark telemetry JSON.
 */
const LiveDetection = () => {
  const videoRef = useRef(null);
  
  // Pipeline status & processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(''); // 'capturing', 'uploading', 'detecting', 'retrieving', 'completed'
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pipelineError, setPipelineError] = useState('');
  
  // Results
  const [imageId, setImageId] = useState(null);
  const [faceData, setFaceData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showMeshImage, setShowMeshImage] = useState(true);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  /**
   * Triggers the frame capture and analysis pipeline.
   */
  const handleCaptureAndAnalyze = async () => {
    const videoElement = videoRef.current;

    if (!videoElement) {
      setPipelineError('Camera reference is not ready.');
      return;
    }

    if (videoElement.readyState < 2) {
      setPipelineError('Camera stream is not fully loaded. Please wait.');
      return;
    }

    setIsProcessing(true);
    setPipelineError('');
    setFaceData(null);
    setImageId(null);
    setUploadProgress(0);

    try {
      // Step 1: Capture video frame on local canvas
      setCurrentStep('capturing');
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      const ctx = canvas.getContext('2d');
      
      // Mirror context before drawing if video element is mirrored (front camera)
      // We check if it contains class scale-x-[-1] or has transform styling
      const isMirrored = videoElement.classList.contains('scale-x-[-1]') || 
                         videoElement.style.transform?.includes('scaleX(-1)') ||
                         videoElement.style.transform?.includes('scale-x-[-1]');
      
      if (isMirrored) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

      // Convert canvas to Blob
      const blob = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95);
      });

      if (!blob) {
        throw new Error('Failed to extract image frame from camera.');
      }

      const captureFile = new File(
        [blob], 
        `live_capture_${Date.now()}.jpg`, 
        { type: 'image/jpeg' }
      );

      // Step 2: Upload frame image file to backend
      setCurrentStep('uploading');
      const uploadRes = await uploadImage(captureFile, (progress) => {
        setUploadProgress(progress);
      });

      const newImageId = uploadRes.image_id;
      setImageId(newImageId);

      // Step 3: Run Face Mesh & landmark extraction on the server
      setCurrentStep('detecting');
      await detectFace(newImageId);

      // Step 4: Retrieve detailed landmark telemetry coordinates
      setCurrentStep('retrieving');
      const resultData = await getAnalysisResult(newImageId);
      
      setFaceData(resultData);
      setCurrentStep('completed');
    } catch (err) {
      console.error('[LiveDetection] Pipeline execution failed:', err);
      const errorMsg = 
        err.response?.data?.message || 
        err.response?.data?.error || 
        err.message || 
        'An error occurred during landmark extraction.';
      setPipelineError(errorMsg);
      setCurrentStep('');
    } finally {
      setIsProcessing(false);
    }
  };

  // Copy JSON coordinates to clipboard
  const handleCopyJson = () => {
    if (!faceData || !faceData.landmarks) return;
    
    navigator.clipboard.writeText(JSON.stringify(faceData.landmarks, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getDebugImageUrl = () => {
    if (!imageId) return '';
    return `${API_BASE_URL}/media/debug/face_debug_${imageId}.jpg?t=${Date.now()}`; // Prevent browser caching
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      
      {/* Title Header */}
      <div className="relative mb-10 text-center">
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-3">
          <Cpu className="w-3.5 h-3.5 animate-pulse" /> Live Landmarks Mesh
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Live Face Landmarker
        </h1>
        <p className="mt-2 text-slate-400 max-w-lg mx-auto text-sm">
          Capture frames directly from your camera and map 468 precise 3D facial landmarks in real-time.
        </p>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Live Camera and Capture Actions (Col Span 5) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel rounded-3xl p-5 border border-slate-800 bg-slate-900/15">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-4 pb-3 border-b border-slate-850">
              <CameraIcon className="w-4 h-4 text-indigo-400" />
              Webcam Feed
            </h2>
            
            {/* Live Camera Component (handles device enumeration, permissions, mirroring, fullscreen) */}
            <Camera 
              ref={videoRef}
              autoStart={true}
              initialMirrored={true}
              width={1280}
              height={720}
              className="border-slate-850 shadow-lg"
            />
            
            {/* Capture & Pipeline Action Area */}
            <div className="mt-6 space-y-4">
              {pipelineError && (
                <div className="flex items-start gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-350 text-xs leading-normal animate-shake">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="font-semibold">{pipelineError}</div>
                </div>
              )}

              {/* Status/Step Pipeline Tracker */}
              {isProcessing && (
                <div className="p-4 bg-slate-900/50 border border-slate-855 rounded-2xl text-xs space-y-3 font-semibold">
                  <div className="flex items-center justify-between text-indigo-400">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {currentStep === 'capturing' && 'Freezing video frame...'}
                      {currentStep === 'uploading' && `Uploading image file (${uploadProgress}%)...`}
                      {currentStep === 'detecting' && 'Running MediaPipe face meshes...'}
                      {currentStep === 'retrieving' && 'Retrieving landmark coordinates...'}
                    </span>
                    <span>Processing</span>
                  </div>
                  
                  {/* Step Progress indicators */}
                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    <div className={`h-1.5 rounded-full transition-colors ${['capturing', 'uploading', 'detecting', 'retrieving', 'completed'].includes(currentStep) ? 'bg-indigo-500' : 'bg-slate-800'}`}></div>
                    <div className={`h-1.5 rounded-full transition-colors ${['uploading', 'detecting', 'retrieving', 'completed'].includes(currentStep) ? 'bg-indigo-500' : 'bg-slate-800'}`}></div>
                    <div className={`h-1.5 rounded-full transition-colors ${['detecting', 'retrieving', 'completed'].includes(currentStep) ? 'bg-indigo-500' : 'bg-slate-800'}`}></div>
                    <div className={`h-1.5 rounded-full transition-colors ${['retrieving', 'completed'].includes(currentStep) ? 'bg-indigo-500' : 'bg-slate-800'}`}></div>
                  </div>
                </div>
              )}

              <button
                onClick={handleCaptureAndAnalyze}
                disabled={isProcessing}
                className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-violet-650 hover:from-indigo-500 hover:to-violet-550 disabled:from-slate-800 disabled:to-slate-850 disabled:text-slate-500 text-white font-bold rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-650/15"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Extracting landmarks...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Capture & Detect Face Landmarks
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Output Displays (JSON Viewer & Debug Image Mesh) (Col Span 7) */}
        <div className="lg:col-span-7 space-y-6">
          {faceData ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Telemetry JSON coordinates (Col Span 7) */}
              <div className="md:col-span-7 space-y-4">
                <div className="glass-panel rounded-3xl p-5 border border-slate-800 bg-slate-900/10 flex flex-col h-[600px]">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-850 mb-3 flex-shrink-0">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <FileJson className="w-4 h-4 text-indigo-400" />
                      Landmarks coordinates (468 points)
                    </h3>
                    <button
                      onClick={handleCopyJson}
                      className="p-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-all flex items-center gap-1.5 text-xxs font-bold"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy JSON
                        </>
                      )}
                    </button>
                  </div>

                  {/* Scrollable JSON box */}
                  <div className="flex-1 overflow-auto bg-slate-950/80 rounded-2xl border border-slate-855 p-4 custom-scrollbar select-all">
                    <pre className="text-indigo-300 font-mono text-[10px] leading-relaxed whitespace-pre">
                      {JSON.stringify(faceData.landmarks, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Debug overlay preview mesh image (Col Span 5) */}
              <div className="md:col-span-5 space-y-4">
                <div className="glass-panel rounded-3xl p-5 border border-slate-800 bg-slate-900/10 flex flex-col h-[600px]">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-850 mb-3 flex-shrink-0">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-indigo-400" />
                      Landmark Mesh Output
                    </h3>
                    <div className="flex bg-slate-900 p-1 border border-slate-800 rounded-lg">
                      <button
                        onClick={() => setShowMeshImage(true)}
                        className={`px-2 py-1 text-[10px] font-bold rounded ${showMeshImage ? 'bg-indigo-950 text-indigo-400 border border-indigo-500/25' : 'text-slate-450 hover:text-white'}`}
                      >
                        Mesh
                      </button>
                      <button
                        onClick={() => setShowMeshImage(false)}
                        className={`px-2 py-1 text-[10px] font-bold rounded ${!showMeshImage ? 'bg-indigo-950 text-indigo-400 border border-indigo-500/25' : 'text-slate-450 hover:text-white'}`}
                      >
                        Source
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 bg-slate-950/60 rounded-2xl border border-slate-855 overflow-hidden flex items-center justify-center p-2">
                    <img
                      src={showMeshImage ? getDebugImageUrl() : faceData.image_url}
                      alt={showMeshImage ? "Face Mesh" : "Captured selfie"}
                      className="max-w-full max-h-full object-contain rounded-xl shadow-md"
                      loading="lazy"
                    />
                  </div>
                  
                  {/* Quick stats on the detected face */}
                  <div className="bg-slate-900/35 border border-slate-850 rounded-2xl p-3 space-y-2 text-[10px] font-semibold text-slate-400 mt-3 flex-shrink-0">
                    <div className="flex justify-between">
                      <span>Face Detected:</span>
                      <span className="text-emerald-400">Yes</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-850/60 pt-2">
                      <span>Confidence Score:</span>
                      <span className="text-indigo-400">{Math.round(faceData.confidence * 100)}%</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-850/60 pt-2">
                      <span>Landmarks Count:</span>
                      <span className="text-white">468 points</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            /* Empty placeholder when no data exists */
            <div className="glass-panel rounded-3xl p-12 text-center border border-slate-850/80 bg-slate-900/5 flex flex-col items-center justify-center min-h-[600px]">
              <div className="w-16 h-16 bg-slate-900 border border-slate-800 text-indigo-400 rounded-3xl flex items-center justify-center mb-6 shadow-inner animate-pulse-slow">
                <FileJson className="w-8 h-8 stroke-[1.2]" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">No Face Analysis Telemetry</h3>
              <p className="text-xs text-slate-450 leading-relaxed max-w-sm">
                Ensure your face is centered clearly in the webcam frame, click "Capture & Detect Face Landmarks" to run landmark mapping, and view the JSON coordinates here.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default LiveDetection;
