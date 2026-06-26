import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { detectFace, getAnalysisResult, detectFaceShape } from '../services/analysisService';
import { 
  ArrowLeft, 
  Sparkles, 
  CheckCircle, 
  AlertCircle, 
  Cpu, 
  Activity, 
  ShieldCheck, 
  HelpCircle, 
  UserCheck,
  ChevronRight
} from 'lucide-react';

const FaceAnalysis = () => {
  const { imageId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState(null);
  
  // Tab control: 'original' or 'mesh'
  const [activeTab, setActiveTab] = useState('mesh');
  
  const [detectingShape, setDetectingShape] = useState(false);
  const [shapeError, setShapeError] = useState('');

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  
  const handleDetectFaceShape = async () => {
    setDetectingShape(true);
    setShapeError('');
    try {
      await detectFaceShape(imageId);
      navigate(`/face-shape-result/${imageId}`);
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || err.response?.data?.error || 'Failed to detect face shape.';
      setShapeError(errMsg);
    } finally {
      setDetectingShape(false);
    }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    setError('');
    try {
      // 1. Run the MediaPipe face detection API
      const result = await detectFace(imageId);
      
      // 2. Fetch detailed analysis result
      const detail = await getAnalysisResult(imageId);
      setAnalysis(detail);
      setActiveTab('mesh'); // Default to AI Mesh view on success
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || err.response?.data?.error || 'Analysis failed. Please try again.';
      setError(errMsg);
      
      // Try to fetch previous failed analysis results if any exist
      try {
        const detail = await getAnalysisResult(imageId);
        setAnalysis(detail);
      } catch (innerErr) {
        // No previous analysis record found, keep analysis null
      }
    } finally {
      setAnalyzing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (imageId) {
      // First, check if the image has already been analyzed
      const checkExistingAnalysis = async () => {
        setLoading(true);
        try {
          const detail = await getAnalysisResult(imageId);
          setAnalysis(detail);
          setLoading(false);
        } catch (err) {
          // If 404, it means it hasn't been analyzed yet, so trigger analysis
          runAnalysis();
        }
      };
      checkExistingAnalysis();
    }
  }, [imageId]);

  const getOriginalImageUrl = () => {
    // We don't have the image file path directly in the analysis model, 
    // but the analysis model references the image ID.
    // However, if we succeed, the visual debug image is saved at:
    // /media/debug/face_debug_{imageId}.jpg.
    // The original uploaded image is in UploadedImage, but to show original image here,
    // we can fall back to loading from /media/uploads/ or similar, but the easiest and cleanest way
    // is to construct the debug image path:
    return `${API_BASE_URL}/media/debug/face_debug_${imageId}.jpg`;
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-white p-6">
        <div className="relative flex items-center justify-center mb-6">
          <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          <Cpu className="absolute w-6 h-6 text-indigo-400 animate-pulse" />
        </div>
        <p className="text-slate-400 font-medium text-lg animate-pulse">Loading analysis data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Back to Gallery */}
      <Link 
        to="/gallery" 
        className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8 text-sm font-semibold group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to Gallery
      </Link>

      <div className="relative mb-10">
        {/* Ambient background glows */}
        <div className="absolute -top-10 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-10 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center justify-center gap-3">
            AI Face Analysis <Activity className="w-7 h-7 text-indigo-500 animate-pulse" />
          </h1>
          <p className="mt-2 text-slate-400 max-w-lg mx-auto text-sm sm:text-base">
            Biometric scanning and landmark extraction using MediaPipe Face Mesh.
          </p>
        </div>
      </div>

      {analyzing ? (
        /* Futuristic Face Scanning Animation Screen */
        <div className="glass-panel max-w-2xl mx-auto rounded-3xl p-10 border border-indigo-500/20 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center min-h-[400px]">
          {/* Laser line animation */}
          <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-400 to-transparent top-0 animate-scan z-10 shadow-[0_0_15px_rgba(99,102,241,0.8)]"></div>
          
          <div className="relative w-48 h-48 rounded-full border-2 border-indigo-500/20 border-dashed flex items-center justify-center mb-8 animate-spin-slow">
            <div className="w-40 h-40 rounded-full border-2 border-indigo-500/40 border-double flex items-center justify-center">
              <Cpu className="w-16 h-16 text-indigo-400 animate-pulse" />
            </div>
          </div>
          
          <h3 className="text-xl font-bold text-white mb-2">Analyzing Face Biometrics...</h3>
          <p className="text-slate-400 text-sm max-w-xs text-center leading-relaxed">
            Running face detection, validating boundaries, and mapping 468 landmark points.
          </p>
        </div>
      ) : error ? (
        /* Error Screen (e.g. No Face, Multiple Faces, Corrupted Image) */
        <div className="glass-panel max-w-xl mx-auto rounded-3xl p-8 border border-rose-500/20 text-center shadow-2xl">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-rose-500/5">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Analysis Rejected</h2>
          
          <div className="p-4 bg-rose-950/20 border border-rose-900/30 rounded-2xl text-rose-300 text-sm mb-8 max-w-sm mx-auto leading-relaxed">
            <span className="font-semibold block mb-1">Reason:</span>
            {error}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/upload"
              className="py-3 px-6 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold rounded-2xl active:scale-[0.98] transition-all shadow-lg shadow-indigo-600/10"
            >
              Upload New Selfie
            </Link>
            <Link
              to="/gallery"
              className="py-3 px-6 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-300 font-semibold rounded-2xl transition-colors"
            >
              Back to Gallery
            </Link>
          </div>
        </div>
      ) : (
        /* Success Screen showing original vs face mesh + stats card */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Image Viewer (Original vs AI Mesh Toggle) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="glass-panel rounded-3xl p-4 border border-slate-850/80 bg-slate-950/40 relative overflow-hidden flex flex-col items-center">
              
              {/* Tab Selector */}
              <div className="flex bg-slate-900 p-1.5 rounded-2xl mb-4 w-full max-w-xs border border-slate-800">
                <button
                  onClick={() => setActiveTab('mesh')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                    activeTab === 'mesh' 
                      ? 'bg-indigo-600 text-white shadow-md' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  AI Face Mesh
                </button>
                <button
                  onClick={() => setActiveTab('original')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                    activeTab === 'original' 
                      ? 'bg-indigo-600 text-white shadow-md' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Original Selfie
                </button>
              </div>

              {/* Image Box */}
              <div className="w-full aspect-[4/5] max-h-[500px] overflow-hidden rounded-2xl border border-slate-850 bg-slate-950 flex items-center justify-center relative">
                {activeTab === 'mesh' ? (
                  <img
                    src={getOriginalImageUrl()}
                    alt="Face Analysis Mesh"
                    className="max-w-full max-h-full object-contain rounded-xl"
                    onError={(e) => {
                      // Fallback if debug image load fails
                      e.target.src = `${API_BASE_URL}/media/uploads/selfie_${imageId}.jpg`; 
                      setActiveTab('original');
                    }}
                  />
                ) : (
                  analysis?.image_url ? (
                    <img
                      src={analysis.image_url}
                      alt="Original Selfie"
                      className="max-w-full max-h-full object-contain rounded-xl"
                    />
                  ) : (
                    <div className="text-center p-6 text-slate-400">
                      <p className="text-sm">Selfie image authenticated and verified.</p>
                      <p className="text-xs text-indigo-400/70 mt-1">Switch to "AI Face Mesh" to see landmarks.</p>
                    </div>
                  )
                )}
              </div>

            </div>
          </div>

          {/* Right Column: Bio Report Cards */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Status Panel Card */}
            <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800 bg-slate-900/30 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <Cpu className="w-32 h-32 text-indigo-400" />
              </div>

              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl">
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Detection Report</h2>
                  <p className="text-xs text-slate-400">MediaPipe Face Mesh Diagnostic</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Face Detected Row */}
                <div className="flex items-center justify-between p-4 bg-slate-950/40 border border-slate-850/60 rounded-2xl transition-all hover:bg-slate-950/60 group">
                  <div className="flex items-center gap-3">
                    <UserCheck className="w-5 h-5 text-indigo-400" />
                    <span className="text-sm font-semibold text-slate-300">Face Detected</span>
                  </div>
                  <span className={`flex items-center gap-1.5 text-sm font-bold ${analysis?.face_detected ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {analysis?.face_detected ? (
                      <>
                        <CheckCircle className="w-4 h-4" /> Yes
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4" /> No
                      </>
                    )}
                  </span>
                </div>

                {/* Faces Found Row */}
                <div className="flex items-center justify-between p-4 bg-slate-950/40 border border-slate-850/60 rounded-2xl transition-all hover:bg-slate-950/60 group">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-indigo-400" />
                    <span className="text-sm font-semibold text-slate-300">Faces Found</span>
                  </div>
                  <span className="text-sm font-bold text-white bg-slate-800 px-3 py-1 rounded-xl">
                    {analysis !== null && analysis.total_faces !== undefined ? analysis.total_faces : 0}
                  </span>
                </div>

                {/* Confidence Row */}
                <div className="flex items-center justify-between p-4 bg-slate-950/40 border border-slate-850/60 rounded-2xl transition-all hover:bg-slate-950/60 group">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-indigo-400" />
                    <span className="text-sm font-semibold text-slate-300">Confidence Score</span>
                  </div>
                  <span className="text-sm font-extrabold text-indigo-400">
                    {analysis?.confidence !== undefined && analysis?.confidence !== null && analysis.confidence > 0
                      ? `${Math.round(analysis.confidence * 100)}%` 
                      : 'N/A'}
                  </span>
                </div>

                {/* Status Row */}
                <div className="flex items-center justify-between p-4 bg-slate-950/40 border border-slate-850/60 rounded-2xl transition-all hover:bg-slate-950/60 group">
                  <div className="flex items-center gap-3">
                    <Cpu className="w-5 h-5 text-indigo-400" />
                    <span className="text-sm font-semibold text-slate-300">Analysis Status</span>
                  </div>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border capitalize ${
                    analysis?.analysis_status === 'completed' 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                      : analysis?.analysis_status === 'failed' 
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' 
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse'
                  }`}>
                    {analysis?.analysis_status || 'Pending'}
                  </span>
                </div>
              </div>


              {/* Action Buttons */}
              <div className="mt-8 flex flex-col gap-3">
                <button
                  onClick={runAnalysis}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Cpu className="w-4 h-4" />
                  Re-run Analysis
                </button>
                
                <Link
                  to="/gallery"
                  className="w-full py-3 px-4 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-300 font-semibold rounded-2xl text-center transition-colors"
                >
                  Back to Gallery
                </Link>
              </div>
            </div>

            {/* Phase 4: Face Shape Detection */}
            <div className="glass-panel p-6 rounded-3xl border border-indigo-500/20 bg-indigo-500/5 relative overflow-hidden shadow-xl">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5 mb-3">
                <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                Face Shape Engine
              </h3>
              
              {analysis?.face_shape ? (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-950/50 border border-slate-850 rounded-2xl">
                    <div className="text-xxs font-bold text-slate-400 uppercase tracking-wider">Detected Shape</div>
                    <div className="text-lg font-bold text-emerald-400 mt-0.5">{analysis.face_shape}</div>
                    <div className="text-xxs text-slate-500 mt-1">Confidence: {Math.round(analysis.face_shape_confidence * 100)}%</div>
                  </div>
                  
                  <Link
                    to={`/face-shape-result/${imageId}`}
                    className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/20"
                  >
                    View Face Shape Profile
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Evaluate width-to-length ratios (forehead, cheekbones, jaw, length) using the landmark telemetry to classify your facial structure.
                  </p>
                  
                  {shapeError && (
                    <div className="text-xs text-rose-400 bg-rose-950/20 border border-rose-900/30 p-2.5 rounded-xl">
                      {shapeError}
                    </div>
                  )}

                  <button
                    onClick={handleDetectFaceShape}
                    disabled={detectingShape}
                    className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:from-slate-800 disabled:to-slate-850 text-white font-semibold rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10"
                  >
                    {detectingShape ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        Analyzing Proportions...
                      </>
                    ) : (
                      <>
                        <Cpu className="w-4 h-4" />
                        Analyze Face Shape
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Phase 6: AI Skin Analysis */}
            <div className="glass-panel p-6 rounded-3xl border border-indigo-500/20 bg-indigo-500/5 relative overflow-hidden shadow-xl mt-6">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5 mb-3">
                <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                AI Skin Analysis Engine
              </h3>
              
              <div className="space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Analyze skin tone, identify skin type, check for acne/red spots, and scan under-eye regions to calculate your comprehensive Skin Health Score.
                </p>
                
                <Link
                  to={`/skin-analysis/${imageId}`}
                  className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-950/20"
                >
                  Analyze Skin Health
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default FaceAnalysis;
