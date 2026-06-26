import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getAnalysisResult, getFaceShapeResult } from '../services/analysisService';
import { generateRecommendation } from '../services/recommendationService';
import { 
  ArrowLeft, 
  Sparkles, 
  Cpu, 
  Activity, 
  ShieldCheck, 
  HelpCircle,
  Scissors,
  Bookmark,
  ChevronRight,
  Sliders,
  Scale
} from 'lucide-react';

const FACE_SHAPE_INFO = {
  Oval: {
    title: "Oval Face Shape",
    tagline: "The Ideal Balance & Versatility",
    characteristics: [
      "Balanced proportions: Face length is slightly larger than the cheekbone width.",
      "Forehead width is slightly larger than the jaw width, creating a gentle taper.",
      "Softly rounded jawline with no harsh or angular corners.",
      "Cheekbones are wide but blend smoothly into the forehead and chin."
    ],
    hairstyles: ["Pompadour", "Quiff", "Slick Back", "Side Part / Executive"],
    description: "Your proportions are highly symmetrical, giving you maximum versatility. Almost any style from cropped cuts to long hair will suit your balanced structure."
  },
  Round: {
    title: "Round Face Shape",
    tagline: "Soft Features & Equal Proportions",
    characteristics: [
      "Face length and cheekbone width are nearly equal in size.",
      "The jawline is soft and curved with no sharp definition.",
      "Cheekbones represent the widest horizontal area of the face.",
      "Forehead and jawline are rounded and similar in width."
    ],
    hairstyles: ["Pompadour", "Faux Hawk", "Textured Crop / Fringe", "High Skin Fade + Quiff"],
    description: "To balance soft curves, choose hairstyles that add height, structure, and volume on top while keeping the sides tight to visually elongate your face."
  },
  Square: {
    title: "Square Face Shape",
    tagline: "Strong Jawline & Angular Definition",
    characteristics: [
      "Face length is approximately equal to cheekbone width.",
      "The jawline is strong, sharp, and highly defined at the corners.",
      "Forehead, cheekbones, and jawline are almost identical in width.",
      "The sides of your face follow a straight vertical line."
    ],
    hairstyles: ["Side Part", "Textured Crop / French Crop", "Crew Cut", "Buzz Cut / Tight Fades"],
    description: "Your strong jaw is an asset. You can choose neat, short cuts to emphasize your clean lines, or textured, messy styles to soften the sharp angles."
  },
  Rectangle: {
    title: "Rectangle (Oblong) Face Shape",
    tagline: "Elongated Structure & Sharp Lines",
    characteristics: [
      "Face length is significantly greater than cheekbone width.",
      "Forehead, cheekbones, and jawline are similar in width.",
      "High forehead and sharp, angular jawline definition.",
      "Chin is slightly rounded but square at the baseline."
    ],
    hairstyles: ["Side Sweep", "Fringe / Textured Bangs", "Ivy League", "Classic Side Part"],
    description: "Since your face is naturally elongated, avoid styles that add too much height. Instead, choose cuts that fall over the forehead or have bulk on the sides."
  },
  Heart: {
    title: "Heart Face Shape",
    tagline: "Wide Forehead & Tapered Chin",
    characteristics: [
      "Forehead is the widest area of the face.",
      "Face tapers down to a narrow, sharp, or pointed chin.",
      "Cheekbones are prominent and wider than the jawline.",
      "Jawline is narrow and curves sharply upward."
    ],
    hairstyles: ["Messy Fringe", "Textured Quiff", "Long Layered Hair", "Side Swept Part"],
    description: "To balance a wider forehead, select hairstyles that add fullness around the temples and chin, such as layered styles, fringes, or soft waves."
  },
  Diamond: {
    title: "Diamond Face Shape",
    tagline: "Widest Cheekbones & Sharp Taper",
    characteristics: [
      "Cheekbones are significantly the widest part of the face.",
      "Forehead and jawline are narrow and similar in width.",
      "Pointed, sharp chin with defined vertical contours.",
      "Face length is moderately longer than width."
    ],
    hairstyles: ["Messy Fringe", "Faux Hawk", "Textured Crop", "Side Part with Volume"],
    description: "With wide cheekbones and narrow forehead/jaw, your goal is to add volume at the top of the forehead and around the chin to soften your angular features."
  }
};

const FaceShapeResult = () => {
  const { imageId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState(null);
  
  // Toggles for images: 'shape' (biometric overlay), 'mesh' (points), or 'original'
  const [imageMode, setImageMode] = useState('shape');
  
  // Recommendation generation states
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  const handleGenerateRecommendations = async () => {
    if (!analysis) return;
    setGenerating(true);
    setGenError('');
    try {
      const result = await generateRecommendation(analysis.id);
      navigate(`/recommendations/result/${result.id}`);
    } catch (err) {
      console.error(err);
      setGenError('Failed to generate recommendations. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch full analysis object (which now has dynamic measurements)
        const data = await getAnalysisResult(imageId);
        if (data.face_shape) {
          setAnalysis(data);
        } else {
          setError('Face shape analysis has not been performed on this image yet.');
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load face shape result. Please return to the analysis page.');
      } finally {
        setLoading(false);
      }
    };
    if (imageId) {
      fetchResults();
    }
  }, [imageId]);

  const getDebugImageUrl = (mode) => {
    if (mode === 'shape') {
      return `${API_BASE_URL}/media/debug/shape_analysis_${imageId}.jpg`;
    } else if (mode === 'mesh') {
      return `${API_BASE_URL}/media/debug/face_debug_${imageId}.jpg`;
    }
    return analysis?.image_url || '';
  };

  if (loading) {
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center text-white p-6">
        <div className="relative flex items-center justify-center mb-6">
          <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          <Cpu className="absolute w-6 h-6 text-indigo-400 animate-pulse" />
        </div>
        <p className="text-slate-400 font-medium text-lg animate-pulse">Retrieving face shape telemetry...</p>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="max-w-xl mx-auto mt-20 px-4">
        <div className="glass-panel rounded-3xl p-8 border border-rose-500/20 text-center shadow-2xl">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <HelpCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Result Not Found</h2>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">{error || "The requested face shape details could not be found."}</p>
          <Link
            to={`/analysis/${imageId}`}
            className="inline-block py-3 px-6 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold rounded-2xl active:scale-[0.98] transition-all"
          >
            Go to Face Analysis
          </Link>
        </div>
      </div>
    );
  }

  const shapeData = FACE_SHAPE_INFO[analysis.face_shape] || FACE_SHAPE_INFO.Oval;
  const confidencePercent = Math.round((analysis.face_shape_confidence || 0) * 100);
  const m = analysis.measurements || { face_length: 0, forehead_width: 0, cheekbone_width: 0, jaw_width: 0 };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Back navigation */}
      <Link 
        to={`/analysis/${imageId}`}
        className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8 text-sm font-semibold group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to Landmarker Mesh
      </Link>

      <div className="relative mb-10">
        {/* Glow Effects */}
        <div className="absolute -top-10 left-1/3 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Biometric Results
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Structure Profile: <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">{analysis.face_shape}</span>
          </h1>
          <p className="mt-2 text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
            Analytical calculations completed using 468 point distance ratios.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Visual Debug Image Viewer */}
        <div className="lg:col-span-6 space-y-4">
          <div className="glass-panel rounded-3xl p-4 border border-slate-800 bg-slate-950/40 relative overflow-hidden flex flex-col items-center">
            
            {/* View Mode Toggle */}
            <div className="flex bg-slate-900 p-1 rounded-2xl mb-4 w-full max-w-sm border border-slate-800">
              <button
                onClick={() => setImageMode('shape')}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                  imageMode === 'shape' 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Measurements Overlay
              </button>
              <button
                onClick={() => setImageMode('mesh')}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                  imageMode === 'mesh' 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                AI Mesh
              </button>
              <button
                onClick={() => setImageMode('original')}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                  imageMode === 'original' 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Original Image
              </button>
            </div>

            {/* Display container */}
            <div className="w-full aspect-[4/5] max-h-[500px] overflow-hidden rounded-2xl border border-slate-850 bg-slate-950 flex items-center justify-center relative">
              <img
                src={getDebugImageUrl(imageMode)}
                alt="Face Shape Telemetry"
                className="max-w-full max-h-full object-contain rounded-xl"
                onError={(e) => {
                  e.target.src = analysis.image_url;
                  setImageMode('original');
                }}
              />
            </div>
            
            {/* Legend indicator */}
            {imageMode === 'shape' && (
              <div className="w-full mt-4 grid grid-cols-2 gap-2 text-xxs font-semibold text-slate-400 bg-slate-950/40 p-3 rounded-xl border border-slate-900">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded bg-[#f05032]"></div>
                  <span>Length: Forehead-Chin</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded bg-[#32a0e1]"></div>
                  <span>Forehead Width</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded bg-[#4bdc4b]"></div>
                  <span>Cheekbone Width</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded bg-[#c850b4]"></div>
                  <span>Jaw Width</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Biometrics report Card */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* Main Shape Card */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800 bg-slate-900/30 relative overflow-hidden shadow-2xl">
            
            {/* Confidence badge top right */}
            <div className="absolute top-6 right-6 flex flex-col items-end">
              <span className="text-xxs font-bold text-slate-400 uppercase tracking-wider">Confidence</span>
              <span className="text-2xl font-extrabold text-indigo-400 mt-0.5">{confidencePercent}%</span>
            </div>

            <div className="mb-6 max-w-[70%]">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">{shapeData.title}</h2>
              <p className="text-indigo-400 text-xs sm:text-sm font-semibold italic mt-1">{shapeData.tagline}</p>
            </div>

            {/* Confidence Progress Bar */}
            <div className="w-full bg-slate-950/60 rounded-full h-2 mb-6 border border-slate-850">
              <div 
                className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full rounded-full transition-all duration-1000"
                style={{ width: `${confidencePercent}%` }}
              ></div>
            </div>

            <p className="text-slate-300 text-sm leading-relaxed mb-6 bg-slate-950/20 border border-slate-900 p-4 rounded-2xl">
              {shapeData.description}
            </p>

            {/* Characteristics Checklist */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Activity className="w-3.5 h-3.5 text-indigo-400" /> Structure Characteristics
              </h3>
              
              {shapeData.characteristics.map((char, index) => (
                <div key={index} className="flex items-start gap-3 text-sm text-slate-300">
                  <div className="mt-1 flex-shrink-0 w-4 h-4 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-[10px]">
                    {index + 1}
                  </div>
                  <span className="leading-relaxed">{char}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Measurements telemetry metrics panel */}
          {analysis.measurements && (
            <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800 bg-slate-900/30 shadow-2xl">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-5">
                <Scale className="w-4 h-4 text-indigo-400" /> Biometric Measurements
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {/* Face Length Box */}
                <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-2xl">
                  <div className="text-xxs font-bold text-slate-400 uppercase">Face Length</div>
                  <div className="text-xl font-extrabold text-white mt-1 flex items-baseline gap-1">
                    {m.face_length} <span className="text-xs font-normal text-slate-500">px</span>
                  </div>
                  <div className="w-full bg-slate-900 h-1 rounded-full mt-2 overflow-hidden">
                    <div className="bg-[#f05032] h-full" style={{ width: '75%' }}></div>
                  </div>
                </div>

                {/* Forehead Width Box */}
                <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-2xl">
                  <div className="text-xxs font-bold text-slate-400 uppercase">Forehead Width</div>
                  <div className="text-xl font-extrabold text-white mt-1 flex items-baseline gap-1">
                    {m.forehead_width} <span className="text-xs font-normal text-slate-500">px</span>
                  </div>
                  <div className="w-full bg-slate-900 h-1 rounded-full mt-2 overflow-hidden">
                    <div className="bg-[#32a0e1] h-full" style={{ width: '58%' }}></div>
                  </div>
                </div>

                {/* Cheekbone Width Box */}
                <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-2xl">
                  <div className="text-xxs font-bold text-slate-400 uppercase">Cheekbone Width</div>
                  <div className="text-xl font-extrabold text-white mt-1 flex items-baseline gap-1">
                    {m.cheekbone_width} <span className="text-xs font-normal text-slate-500">px</span>
                  </div>
                  <div className="w-full bg-slate-900 h-1 rounded-full mt-2 overflow-hidden">
                    <div className="bg-[#4bdc4b] h-full" style={{ width: '65%' }}></div>
                  </div>
                </div>

                {/* Jaw Width Box */}
                <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-2xl">
                  <div className="text-xxs font-bold text-slate-400 uppercase">Jaw Width</div>
                  <div className="text-xl font-extrabold text-white mt-1 flex items-baseline gap-1">
                    {m.jaw_width} <span className="text-xs font-normal text-slate-500">px</span>
                  </div>
                  <div className="w-full bg-slate-900 h-1 rounded-full mt-2 overflow-hidden">
                    <div className="bg-[#c850b4] h-full" style={{ width: '50%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Preliminary Phase 5 Recommendation Preview */}
          <div className="glass-panel rounded-3xl p-6 border border-indigo-500/10 bg-indigo-500/5 relative overflow-hidden space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5 mb-1.5">
                <Scissors className="w-4 h-4 text-indigo-400 animate-pulse" />
                Hairstyle Recommendations Preview
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Based on your face shape structure, here are initial hairstyle suggestions:
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {shapeData.hairstyles.map((style, idx) => (
                <span 
                  key={idx} 
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-950/30 border border-indigo-900/40 text-xs font-semibold text-indigo-300 rounded-xl"
                >
                  <Bookmark className="w-3 h-3 text-indigo-400" />
                  {style}
                </span>
              ))}
            </div>

            <div className="border-t border-slate-800/80 pt-4 mt-2">
              <button
                onClick={handleGenerateRecommendations}
                disabled={generating}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 px-5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:from-slate-850 disabled:to-slate-850 disabled:text-slate-500 text-white font-bold rounded-2xl active:scale-[0.98] transition-all shadow-lg shadow-indigo-650/10 hover:shadow-indigo-650/20"
              >
                {generating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    <span>Generating recommendations...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 animate-pulse text-indigo-400" />
                    <span>Get Full Styling Recommendations</span>
                  </>
                )}
              </button>
              {genError && (
                <p className="text-rose-455 text-xxs font-semibold mt-2 text-center">{genError}</p>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default FaceShapeResult;
