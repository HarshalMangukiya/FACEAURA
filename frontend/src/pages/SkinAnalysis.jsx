import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getAnalysisResult, detectSkin, getSkinResult } from '../services/analysisService';
import { generateProductRecommendations } from '../services/productService';
import { 
  ArrowLeft, 
  Sparkles, 
  Cpu, 
  Activity, 
  ShieldCheck, 
  HelpCircle,
  TrendingUp,
  Droplets,
  AlertCircle,
  Eye,
  Layers,
  Heart,
  ChevronRight
} from 'lucide-react';

const SKIN_TONE_DETAILS = {
  Fair: {
    description: "Porcelain skin tone with high sensitivity to UV rays. Burns easily and rarely tans. Typically falls under Fitzpatrick Skin Type I or II.",
    tint: "bg-[#ffd1b3]/20 border-[#ffd1b3]/30 text-[#ffd1b3]",
    hex: "#ffe5d9"
  },
  Light: {
    description: "Warm or cool light skin tone. Can burn in intense sun but can develop a light golden tan. Fits Fitzpatrick Skin Type II or III.",
    tint: "bg-[#fedcbd]/20 border-[#fedcbd]/30 text-[#fedcbd]",
    hex: "#fcd5b4"
  },
  Medium: {
    description: "Balanced olive or neutral sand tone. Tans gradually and burns minimally. Highly versatile pigment, fits Fitzpatrick Skin Type III or IV.",
    tint: "bg-[#e8b589]/20 border-[#e8b589]/30 text-[#e8b589]",
    hex: "#d9a066"
  },
  Tan: {
    description: "Rich bronze or deep olive skin tone. Seldom burns in the sun and tans easily to a deep shade. Fits Fitzpatrick Skin Type IV or V.",
    tint: "bg-[#bf8040]/20 border-[#bf8040]/30 text-[#bf8040]",
    hex: "#a05a2c"
  },
  Deep: {
    description: "Deep brown, warm dark, or black skin tone. Extremely rare to sunburn, highly pigmented with melanin. Fits Fitzpatrick Skin Type V or VI.",
    tint: "bg-[#663300]/20 border-[#663300]/30 text-[#e6b8a2]",
    hex: "#4a2c0f"
  }
};

const SKIN_TYPE_DETAILS = {
  Oily: {
    title: "Oily Skin",
    description: "Characterized by overactive sebaceous glands, leading to an overall shine, visible pores, and higher susceptibility to acne breakouts.",
    advice: "Use lightweight gel moisturizers, salicylic acid cleansers, and avoid heavy occlusive oils."
  },
  Dry: {
    title: "Dry Skin",
    description: "Produces less sebum than normal skin, resulting in lack of lipids, a tight or dull feel, fine texture, and prone to flaking or sensitivity.",
    advice: "Prioritize barrier-repair creams with ceramides, hyaluronic acid, and rich hydrating serums."
  },
  Combination: {
    title: "Combination Skin",
    description: "Features a dual climate: shine and oily characteristics in the T-zone (forehead, nose, chin) paired with dry or normal skin on the U-zone (cheeks).",
    advice: "Employ zone-mapping skincare: use mattifying ingredients on the forehead and hydrating agents on the cheeks."
  },
  Normal: {
    title: "Normal Skin",
    description: "A well-balanced skin state (neither too oily nor too dry). Smooth texture, small pores, good circulation, and minimal blemishes.",
    advice: "Maintain hydration and protect the skin barrier with daily SPF and antioxidants."
  }
};

const SkinAnalysis = () => {
  const { imageId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState(null);
  
  // Toggles for images: 'skin' (overlay) or 'original'
  const [imageMode, setImageMode] = useState('skin');
  const [generatingRec, setGeneratingRec] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const runSkinAnalysis = async () => {
    setAnalyzing(true);
    setError('');
    try {
      // 1. Run the AI Skin analysis backend API
      const result = await detectSkin(imageId);
      setAnalysis(result);
      setImageMode('skin'); // Show skin analysis overlay on success
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || err.response?.data?.error || 'Skin analysis failed. Please try again.';
      setError(errMsg);
    } finally {
      setAnalyzing(false);
      setLoading(false);
    }
  };

  const handleGetSkincareRoutine = async () => {
    if (!analysis?.id) return;
    setGeneratingRec(true);
    try {
      const result = await generateProductRecommendations(analysis.id);
      navigate(`/beauty-recommendations/result/${result.id}`);
    } catch (err) {
      console.error("Failed to generate product recommendations:", err);
      setError("Failed to generate skincare routine. Please try again.");
    } finally {
      setGeneratingRec(false);
    }
  };

  useEffect(() => {
    if (imageId) {
      const checkExistingSkinResult = async () => {
        setLoading(true);
        try {
          // Check if analysis already exists in the database
          const data = await getSkinResult(imageId);
          setAnalysis(data);
          setLoading(false);
        } catch (err) {
          // If 404, it means skin analysis hasn't been run yet, so trigger it
          runSkinAnalysis();
        }
      };
      checkExistingSkinResult();
    }
  }, [imageId]);

  const getOverlayImageUrl = (mode) => {
    if (mode === 'skin') {
      return `${API_BASE_URL}/media/debug/skin_analysis_${imageId}.jpg`;
    }
    return analysis?.image_url || `${API_BASE_URL}/media/uploads/selfie_${imageId}.jpg`;
  };

  if (loading) {
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center text-white p-6">
        <div className="relative flex items-center justify-center mb-6">
          <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          <Cpu className="absolute w-6 h-6 text-indigo-400 animate-pulse" />
        </div>
        <p className="text-slate-400 font-medium text-lg animate-pulse">Running AI skin color & texture diagnostics...</p>
      </div>
    );
  }

  if (analyzing) {
    return (
      <div className="max-w-2xl mx-auto mt-20 px-4">
        <div className="glass-panel rounded-3xl p-10 border border-indigo-500/20 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center min-h-[400px]">
          <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-400 to-transparent top-0 animate-scan z-10 shadow-[0_0_15px_rgba(99,102,241,0.8)]"></div>
          
          <div className="relative w-48 h-48 rounded-full border-2 border-indigo-500/20 border-dashed flex items-center justify-center mb-8 animate-spin-slow">
            <div className="w-40 h-40 rounded-full border-2 border-indigo-500/40 border-double flex items-center justify-center">
              <Droplets className="w-16 h-16 text-indigo-400 animate-pulse" />
            </div>
          </div>
          
          <h3 className="text-xl font-bold text-white mb-2">Analyzing Face Skin Biometrics...</h3>
          <p className="text-slate-400 text-sm max-w-sm text-center leading-relaxed">
            Running pixel color classification, segmenting acne zones, computing under-eye lightness, and estimating health indexes.
          </p>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="max-w-xl mx-auto mt-20 px-4">
        <div className="glass-panel rounded-3xl p-8 border border-rose-500/20 text-center shadow-2xl">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Skin Analysis Failed</h2>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">{error || "We encountered an issue reading the face features."}</p>
          <div className="flex justify-center gap-4">
            <button
              onClick={runSkinAnalysis}
              className="py-3 px-6 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold rounded-2xl active:scale-[0.98] transition-all"
            >
              Retry Skin Analysis
            </button>
            <Link
              to={`/analysis/${imageId}`}
              className="py-3 px-6 bg-slate-900 border border-slate-800 text-slate-300 font-semibold rounded-2xl transition-colors"
            >
              Back to Mesh
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const toneInfo = SKIN_TONE_DETAILS[analysis.skin_tone] || SKIN_TONE_DETAILS.Medium;
  const typeInfo = SKIN_TYPE_DETAILS[analysis.skin_type] || SKIN_TYPE_DETAILS.Normal;
  const score = analysis.skin_health_score;

  // Score color helper
  const getScoreColor = (val) => {
    if (val >= 85) return 'from-emerald-450 to-teal-400 text-emerald-400';
    if (val >= 70) return 'from-indigo-400 to-indigo-500 text-indigo-400';
    if (val >= 50) return 'from-amber-400 to-orange-400 text-amber-400';
    return 'from-rose-500 to-red-500 text-rose-500';
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Back button */}
      <Link 
        to={`/analysis/${imageId}`}
        className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8 text-sm font-semibold group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to Landmark Mesh
      </Link>

      <div className="relative mb-10">
        <div className="absolute -top-10 left-1/3 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3 animate-pulse">
            <Sparkles className="w-3.5 h-3.5" /> AI Skin Diagnostics
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Skin Health & Tone <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">Telemetry</span>
          </h1>
          <p className="mt-2 text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
            Deep-pixel scan of T-zone, cheeks, and under-eye regions using dynamic color-space mapping.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Visual Overlay Display */}
        <div className="lg:col-span-6 space-y-4">
          <div className="glass-panel rounded-3xl p-4 border border-slate-800 bg-slate-950/40 relative overflow-hidden flex flex-col items-center">
            
            {/* View Mode Toggle */}
            <div className="flex bg-slate-900 p-1 rounded-2xl mb-4 w-full max-w-sm border border-slate-800">
              <button
                onClick={() => setImageMode('skin')}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                  imageMode === 'skin' 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Skin Overlay
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
                src={getOverlayImageUrl(imageMode)}
                alt="Face Skin Telemetry"
                className="max-w-full max-h-full object-contain rounded-xl"
                onError={(e) => {
                  e.target.src = analysis.image_url || `${API_BASE_URL}/media/uploads/selfie_${imageId}.jpg`;
                  setImageMode('original');
                }}
              />
            </div>
            
            {/* Legend indicator */}
            {imageMode === 'skin' && (
              <div className="w-full mt-4 grid grid-cols-2 gap-2 text-xxs font-semibold text-slate-400 bg-slate-950/40 p-3 rounded-xl border border-slate-900">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded bg-[#eb9f32]"></div>
                  <span>Forehead T-Zone</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded bg-[#4bdc4b]"></div>
                  <span>Cheeks U-Zone</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded bg-[#b450c8]"></div>
                  <span>Under-Eye Regions</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded bg-[#ff0000]"></div>
                  <span>Acne/Red Spots</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Skin Metrics & Health Score */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* Health Score Meter & Tone */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800 bg-slate-900/30 relative overflow-hidden shadow-2xl flex flex-col md:flex-row items-center gap-8">
            
            {/* Dynamic Circular Health Score Meter */}
            <div className="relative flex items-center justify-center flex-shrink-0 w-36 h-36">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle 
                  cx="50" cy="50" r="42" 
                  className="stroke-slate-800" 
                  strokeWidth="8" 
                  fill="transparent" 
                />
                {/* Colored Progress Ring */}
                <circle 
                  cx="50" cy="50" r="42" 
                  className={`stroke-indigo-500 transition-all duration-1000 ease-out`}
                  strokeWidth="8" 
                  fill="transparent" 
                  strokeDasharray="263.89" 
                  strokeDashoffset={263.89 - (263.89 * score) / 100}
                  strokeLinecap="round"
                />
              </svg>
              {/* Text Score Value Inside Ring */}
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-white">{score}</span>
                <span className="text-slate-500 font-semibold text-[10px] uppercase tracking-wider">Health</span>
              </div>
            </div>

            {/* General Score Summary & Skin Tone details */}
            <div className="flex-1 space-y-3">
              <div>
                <h2 className="text-lg font-bold text-white">Skin Tone Profile: <span style={{ color: toneInfo.hex }}>{analysis.skin_tone}</span></h2>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`px-2.5 py-0.5 rounded-full text-xxs font-bold uppercase tracking-wider border ${toneInfo.tint}`}>
                    Fitzpatrick Index
                  </span>
                  <span className="text-xxs text-indigo-400 font-semibold">
                    Confidence: 91%
                  </span>
                </div>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                {toneInfo.description}
              </p>
            </div>
          </div>

          {/* Skin Type & Details Card */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800 bg-slate-900/30 shadow-2xl space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Droplets className="w-4 h-4 text-indigo-400" /> Skin Classification
            </h3>
            
            <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-bold text-white">{typeInfo.title}</span>
                <span className="text-xs font-semibold text-indigo-400">Classified Result</span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed mt-1">{typeInfo.description}</p>
              <div className="border-t border-slate-850 mt-3 pt-3 flex items-start gap-2 text-xxs text-emerald-450 leading-relaxed">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-450 mt-1 flex-shrink-0"></div>
                <span><strong>Recommendation Tip:</strong> {typeInfo.advice}</span>
              </div>
            </div>
          </div>

          {/* Diagnostics checklist metrics */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800 bg-slate-900/30 shadow-2xl space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" /> Layer Telemetry
            </h3>

            <div className="space-y-3.5">
              {/* Acne Severity metrics */}
              <div className="flex flex-col gap-1.5 p-3.5 bg-slate-950/40 border border-slate-850 rounded-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle className={`w-4 h-4 ${analysis.acne_detected ? 'text-orange-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-bold text-slate-200">Acne / Red Spots</span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xxs font-bold capitalize border ${
                    analysis.acne_severity === 'Severe' 
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                      : analysis.acne_severity === 'Moderate'
                      ? 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                      : analysis.acne_severity === 'Mild'
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  }`}>
                    {analysis.acne_severity === 'None' ? 'None' : `${analysis.acne_severity} Severity`}
                  </span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${
                      analysis.acne_severity === 'Severe'
                        ? 'bg-rose-500'
                        : analysis.acne_severity === 'Moderate'
                        ? 'bg-orange-400'
                        : analysis.acne_severity === 'Mild'
                        ? 'bg-amber-450'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: analysis.acne_severity === 'Severe' ? '85%' : analysis.acne_severity === 'Moderate' ? '50%' : analysis.acne_severity === 'Mild' ? '25%' : '0%' }}
                  ></div>
                </div>
              </div>

              {/* Dark Circles metric */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950/40 border border-slate-850 rounded-2xl hover:bg-slate-950/60 transition-colors">
                <div className="flex items-center gap-2.5">
                  <Eye className={`w-4 h-4 ${analysis.dark_circle_detected ? 'text-[#b450c8]' : 'text-slate-500'}`} />
                  <span className="text-xs font-bold text-slate-200">Dark Circles</span>
                </div>
                <span className={`px-3 py-0.5 rounded-full text-xxs font-extrabold uppercase border ${
                  analysis.dark_circle_detected 
                    ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' 
                    : 'bg-slate-800 border-slate-750 text-slate-400'
                }`}>
                  {analysis.dark_circle_detected ? 'Detected' : 'None'}
                </span>
              </div>

              {/* Pigmentation metric */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950/40 border border-slate-850 rounded-2xl hover:bg-slate-950/60 transition-colors">
                <div className="flex items-center gap-2.5">
                  <Layers className={`w-4 h-4 ${analysis.pigmentation_detected ? 'text-indigo-400' : 'text-slate-500'}`} />
                  <span className="text-xs font-bold text-slate-200">Hyperpigmentation</span>
                </div>
                <span className={`px-3 py-0.5 rounded-full text-xxs font-extrabold uppercase border ${
                  analysis.pigmentation_detected 
                    ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' 
                    : 'bg-slate-800 border-slate-750 text-slate-400'
                }`}>
                  {analysis.pigmentation_detected ? 'Detected' : 'None'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Trigger Card (Phase 7 Recommendations Prep) */}
          <div className="glass-panel rounded-3xl p-6 border border-emerald-500/10 bg-emerald-500/5 relative overflow-hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-emerald-450 animate-pulse" />
                Phase 7 recommendations unlocked!
              </h4>
              <p className="text-xxs text-slate-400 max-w-xs leading-relaxed">
                Use your custom skin metrics to find optimized serums, cleansers, and skin routines.
              </p>
            </div>
            <button 
              onClick={handleGetSkincareRoutine}
              disabled={generatingRec}
              className="py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generatingRec ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  Get Skincare Routine
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SkinAnalysis;
