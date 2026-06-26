import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  getRecommendationHistory, 
  getRecommendationDetail, 
  generateRecommendation 
} from '../services/recommendationService';
import { 
  Sparkles, 
  History, 
  Scissors, 
  Glasses, 
  User, 
  Filter, 
  ArrowLeft, 
  Clock, 
  ShieldCheck, 
  ChevronRight, 
  Layers,
  Sparkle,
  Compass,
  AlertCircle
} from 'lucide-react';

const STYLE_FALLBACK_IMAGES = {
  // Hairstyles
  "pompadour": "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&q=80&w=400",
  "quiff": "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&q=80&w=400",
  "slick back": "https://images.unsplash.com/photo-1605497746444-ac9dbd39f4a5?auto=format&fit=crop&q=80&w=400",
  "textured crop": "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&q=80&w=400",
  "side part": "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=400",
  "high fade": "https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=format&fit=crop&q=80&w=400",
  "faux hawk": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=400",
  "crew cut": "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&q=80&w=400",
  "fringe": "https://images.unsplash.com/photo-1605497746444-ac9dbd39f4a5?auto=format&fit=crop&q=80&w=400",
  "side swept": "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&q=80&w=400",
  "layered cut": "https://images.unsplash.com/photo-1605497746444-ac9dbd39f4a5?auto=format&fit=crop&q=80&w=400",
  "textured fringe": "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&q=80&w=400",
  "layered medium hair": "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=400",

  // Beard Styles
  "stubble": "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=400",
  "short beard": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=400",
  "full beard": "https://images.unsplash.com/photo-1550246140-5119ae4790b8?auto=format&fit=crop&q=80&w=400",
  "goatee": "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&q=80&w=400",
  "extended goatee": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400",
  "light stubble": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=400",

  // Eyewear
  "aviator": "https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&q=80&w=400",
  "rectangle frame": "https://images.unsplash.com/photo-1591076482161-42ce6da69f67?auto=format&fit=crop&q=80&w=400",
  "wayfarer": "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&q=80&w=400",
  "square frame": "https://images.unsplash.com/photo-1509695507497-903c140c43b0?auto=format&fit=crop&q=80&w=400",
  "round frame": "https://images.unsplash.com/photo-1488161628813-04466f872be2?auto=format&fit=crop&q=80&w=400",
  "oval frame": "https://images.unsplash.com/photo-1577803645773-f96470509666?auto=format&fit=crop&q=80&w=400",
  "bottom heavy frames": "https://images.unsplash.com/photo-1511556532299-8f662fc26c06?auto=format&fit=crop&q=80&w=400",
  "rimless frames": "https://images.unsplash.com/photo-1591076482161-42ce6da69f67?auto=format&fit=crop&q=80&w=400",
  "large frames": "https://images.unsplash.com/photo-1509695507497-903c140c43b0?auto=format&fit=crop&q=80&w=400"
};

const Recommendations = () => {
  const { historyId } = useParams();
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentRec, setCurrentRec] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  
  // Tab control: 'hairstyles', 'beard_styles', 'eyewear'
  const [activeTab, setActiveTab] = useState('hairstyles');
  
  // Filter control: 'all', 'low_maintenance', 'professional', 'casual', 'trendy'
  const [activeFilter, setActiveFilter] = useState('all');

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // Load history list
  const fetchHistory = async (autoSelectId = null) => {
    setHistoryLoading(true);
    try {
      const historyData = await getRecommendationHistory();
      setHistoryList(historyData);
      
      // If history exists and no specific ID is requested, load the latest one
      if (historyData.length > 0 && !autoSelectId && !historyId) {
        loadRecommendation(historyData[0].id);
      }
    } catch (err) {
      console.error("Failed to load recommendation history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Load specific recommendation record
  const loadRecommendation = async (id) => {
    setLoading(true);
    setError('');
    try {
      const data = await getRecommendationDetail(id);
      setCurrentRec(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load recommendation details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    if (historyId) {
      loadRecommendation(historyId);
    }
  }, [historyId]);

  const handleSelectHistory = (id) => {
    navigate(`/recommendations/result/${id}`);
  };

  const getImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    return `${API_BASE_URL}${path}`;
  };

  // Matches filters against style records
  const filterStyles = (items) => {
    if (!items) return [];
    return items.filter(item => {
      const tags = item.tags || [];
      if (activeFilter === 'all') return true;
      if (activeFilter === 'low_maintenance') {
        // Match if tags contain 'low_maintenance' OR maintenance_level is Low
        return tags.includes('low_maintenance') || (item.maintenance_level && item.maintenance_level.toLowerCase() === 'low');
      }
      return tags.includes(activeFilter);
    });
  };

  const getPlaceholderGradient = (category) => {
    const gradients = {
      hairstyles: 'from-indigo-600/30 to-violet-600/20 text-indigo-400',
      beard_styles: 'from-amber-600/30 to-orange-600/20 text-amber-400',
      eyewear: 'from-emerald-600/30 to-teal-600/20 text-emerald-400',
    };
    return gradients[category] || gradients.hairstyles;
  };

  const getPlaceholderIcon = (category) => {
    const iconSize = "w-12 h-12 stroke-[1.5]";
    if (category === 'hairstyles') return <Scissors className={iconSize} />;
    if (category === 'beard_styles') return <User className={iconSize} />;
    if (category === 'eyewear') return <Glasses className={iconSize} />;
    return <Sparkles className={iconSize} />;
  };

  if (loading && historyList.length === 0) {
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center text-white">
        <div className="relative flex items-center justify-center mb-6">
          <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          <Compass className="absolute w-6 h-6 text-indigo-400 animate-pulse" />
        </div>
        <p className="text-slate-400 font-medium text-lg animate-pulse">Building style engine catalog...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      
      {/* Back button */}
      <Link 
        to="/gallery" 
        className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6 text-sm font-semibold group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to Gallery
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* SIDEBAR: HISTORY LIST (col-span-3) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="glass-panel rounded-3xl p-5 border border-slate-800 bg-slate-950/40">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-4 pb-3 border-b border-slate-900">
              <History className="w-4 h-4 text-indigo-400" />
              Scan History
            </h2>
            
            {historyLoading ? (
              <div className="space-y-3 py-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-14 bg-slate-900/50 rounded-2xl animate-pulse"></div>
                ))}
              </div>
            ) : historyList.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs leading-relaxed">
                No analyses scanned yet. Go to Upload and scan your face to generate custom styles!
              </div>
            ) : (
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1 custom-scrollbar">
                {historyList.map((item) => {
                  const isActive = currentRec?.id === item.id;
                  const date = new Date(item.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectHistory(item.id)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between group ${
                        isActive 
                          ? 'bg-indigo-600/10 border-indigo-500/40 text-white shadow-lg' 
                          : 'bg-slate-900/20 border-slate-850 text-slate-450 hover:bg-slate-900/50 hover:border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <div className="truncate">
                        <div className="text-xs font-bold truncate flex items-center gap-1.5">
                          <Sparkle className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-400' : 'text-slate-600'}`} />
                          {item.recommendations?.face_shape || 'Detected Face'}
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium block mt-0.5">{date}</span>
                      </div>
                      <ChevronRight className={`w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity ${isActive ? 'text-indigo-400' : ''}`} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* MAIN PANEL: RECOMMENDATIONS (col-span-9) */}
        <div className="lg:col-span-9 space-y-6">
          {error && (
            <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-350 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="font-semibold">{error}</p>
            </div>
          )}

          {currentRec ? (
            <>
              {/* Header card: Summarizing the face shape profile */}
              <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800 bg-slate-900/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-3">
                      <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Styling Report
                    </span>
                    <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                      Face Shape: <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">{currentRec.recommendations.face_shape}</span>
                    </h1>
                    <p className="mt-1.5 text-slate-400 text-sm max-w-xl">
                      Custom recommendations curated by the FaceAura AI engine based on biometric parameters.
                    </p>
                  </div>
                  
                  {/* Confidence Badge */}
                  {currentRec.analysis_details && (
                    <div className="bg-slate-950/60 border border-slate-850/80 p-4 rounded-2xl flex flex-col items-end sm:text-right shadow-inner min-w-[130px]">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Analysis Score</span>
                      <span className="text-2xl font-extrabold text-indigo-400 mt-0.5">
                        {Math.round((currentRec.analysis_details.face_shape_confidence || 0.90) * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tab Selector & Filter Bar Row */}
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between border-b border-slate-800/80 pb-5">
                
                {/* Tabs */}
                <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-900 w-full md:w-auto">
                  {[
                    { id: 'hairstyles', label: 'Hairstyles', icon: Scissors },
                    { id: 'beard_styles', label: 'Beard Styles', icon: User },
                    { id: 'eyewear', label: 'Eyewear', icon: Glasses }
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 py-2.5 px-4.5 text-xs font-bold rounded-xl transition-all ${
                          isActive 
                            ? 'bg-indigo-600 text-white shadow-md' 
                            : 'text-slate-455 hover:text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-1.5 items-center justify-center w-full md:w-auto">
                  <div className="flex items-center gap-1 text-xs text-slate-500 mr-1">
                    <Filter className="w-3.5 h-3.5" />
                    <span>Filter:</span>
                  </div>
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'low_maintenance', label: 'Low Maint.' },
                    { id: 'professional', label: 'Professional' },
                    { id: 'casual', label: 'Casual' },
                    { id: 'trendy', label: 'Trendy' }
                  ].map((filt) => {
                    const isActive = activeFilter === filt.id;
                    return (
                      <button
                        key={filt.id}
                        onClick={() => setActiveFilter(filt.id)}
                        className={`py-1.5 px-3 text-xxs font-bold rounded-lg border transition-all ${
                          isActive
                            ? 'bg-indigo-950 border-indigo-500/30 text-indigo-400 font-extrabold'
                            : 'bg-transparent border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        {filt.label}
                      </button>
                    );
                  })}
                </div>

              </div>

              {/* Cards Grid */}
              {loading ? (
                <div className="h-60 flex items-center justify-center">
                  <div className="w-10 h-10 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                </div>
              ) : (
                (() => {
                  const rawList = currentRec.recommendations[
                    activeTab === 'hairstyles' ? 'hairstyles' :
                    activeTab === 'beard_styles' ? 'beard_styles' : 'eyewear'
                  ];
                  const filteredList = filterStyles(rawList);

                  if (filteredList.length === 0) {
                    return (
                      <div className="glass-panel rounded-3xl p-12 text-center border border-slate-900 max-w-md mx-auto mt-6">
                        <div className="w-12 h-12 bg-slate-900 border border-slate-800 text-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <Compass className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-bold text-white mb-1">No matching styles</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          We couldn't find any {activeTab.replace('_', ' ')} matching the "{activeFilter.replace('_', ' ')}" filter for this face shape.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredList.map((item, idx) => {
                        const imgUrl = getImageUrl(item.image);
                        const fallbackUrl = STYLE_FALLBACK_IMAGES[item.name.toLowerCase()] || '';
                        const displayImg = imgUrl || fallbackUrl;
                        return (
                          <div 
                            key={idx}
                            className="glass-panel-interactive rounded-2xl overflow-hidden flex flex-col group border border-slate-850 bg-slate-900/10 shadow-lg"
                          >
                            {/* Graphic Container */}
                            <div className="relative aspect-[4/3] bg-slate-950 overflow-hidden flex items-center justify-center border-b border-slate-850/80">
                              {displayImg ? (
                                <img
                                  src={displayImg}
                                  alt={item.name}
                                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                                />
                              ) : (
                                <div className={`w-full h-full bg-gradient-to-tr ${getPlaceholderGradient(activeTab)} flex flex-col items-center justify-center gap-2.5`}>
                                  {getPlaceholderIcon(activeTab)}
                                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Visual Preview</span>
                                </div>
                              )}
                              
                              {/* Confidence score badge overlaid on top right */}
                              <div className="absolute top-3.5 right-3.5 bg-slate-900/90 border border-slate-750 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5">
                                <span className="text-[9px] font-extrabold text-indigo-400">MATCH</span>
                                <span className="text-xs font-black text-white">{item.score}%</span>
                              </div>
                            </div>

                            {/* Content */}
                            <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                              <div>
                                <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">{item.name}</h3>
                                <p className="text-xs text-slate-400 leading-relaxed mt-2.5">{item.description}</p>
                              </div>

                              <div className="space-y-3 pt-3 border-t border-slate-800/60">
                                {/* Extra attributes for hairstyles */}
                                {activeTab === 'hairstyles' && (
                                  <div className="flex justify-between items-center gap-2">
                                    <span className="text-xxs font-bold text-slate-500 uppercase flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-indigo-500/80" /> Difficulty:
                                    </span>
                                    <span className="text-xxs font-bold text-slate-350">{item.difficulty_level}</span>
                                  </div>
                                )}
                                
                                {activeTab === 'hairstyles' && (
                                  <div className="flex justify-between items-center gap-2">
                                    <span className="text-xxs font-bold text-slate-500 uppercase flex items-center gap-1">
                                      <Layers className="w-3 h-3 text-indigo-500/80" /> Maintenance:
                                    </span>
                                    <span className="text-xxs font-bold text-slate-350">{item.maintenance_level}</span>
                                  </div>
                                )}

                                {/* Tags list */}
                                {item.tags && item.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {item.tags.map((tag, tIdx) => (
                                      <span 
                                        key={tIdx} 
                                        className="text-[9px] font-bold px-2 py-0.5 bg-indigo-950/20 border border-indigo-900/30 text-indigo-350 rounded-md uppercase tracking-wide"
                                      >
                                        {tag.replace('_', ' ')}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </>
          ) : (
            /* Recommendations Empty State (no recommendations loaded or generated yet) */
            <div className="glass-panel rounded-3xl p-12 text-center max-w-xl mx-auto border border-slate-850 mt-10">
              <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6 text-slate-550">
                <Compass className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">No recommendations available</h2>
              <p className="text-slate-400 text-sm max-w-sm mx-auto mb-8 leading-relaxed">
                You haven't scanned your face shape yet. Scan a selfie to calculate facial telemetry and get instant, custom style advice.
              </p>
              <Link
                to="/upload"
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-600/15 transition-all"
              >
                Upload & Scan Selfie
              </Link>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Recommendations;
