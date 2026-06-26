import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  getProductRecommendationHistory, 
  getProductRecommendationDetail, 
  generateProductRecommendations 
} from '../services/productService';
import { 
  Sparkles, 
  History, 
  Compass, 
  Filter, 
  ArrowLeft, 
  Clock, 
  ShieldCheck, 
  ChevronRight, 
  ChevronDown,
  Droplets,
  AlertCircle,
  Sun,
  Moon,
  Star,
  Check,
  Percent,
  TrendingUp,
  Award,
  Zap,
  ShoppingBag
} from 'lucide-react';

const CATEGORY_ICONS = {
  face_wash: Droplets,
  moisturizers: Sparkles,
  sunscreens: Sun,
  serums: Zap,
  acne_treatment: AlertCircle,
  dark_circle: Moon
};

const CATEGORY_LABELS = {
  face_wash: 'Face Wash',
  moisturizers: 'Moisturizers',
  sunscreens: 'Sunscreens',
  serums: 'Serums',
  acne_treatment: 'Acne Treatment',
  dark_circle: 'Eye Care'
};

const BeautyRecommendations = () => {
  const { historyId } = useParams();
  const navigate = useNavigate();

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Data states
  const [currentRec, setCurrentRec] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  
  // Tab control: 'routine' or 'categories'
  const [viewMode, setViewMode] = useState('routine');
  
  // Active category tab (for categories view)
  const [activeCategory, setActiveCategory] = useState('face_wash');
  
  // Collapsed state for routine steps
  const [expandedMorningStep, setExpandedMorningStep] = useState(1);
  const [expandedNightStep, setExpandedNightStep] = useState(1);

  // Filter states
  const [priceFilter, setPriceFilter] = useState('All'); // 'All', 'Budget', 'Midrange', 'Premium'
  const [safetyFilters, setSafetyFilters] = useState({
    sensitive_skin_safe: false,
    fragrance_free: false,
    acne_friendly: false,
  });

  // Locally selected/tracked products (for selected analytics)
  const [selectedProducts, setSelectedProducts] = useState({});

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // Load history list
  const fetchHistory = async (autoSelectId = null) => {
    setHistoryLoading(true);
    try {
      const historyData = await getProductRecommendationHistory();
      setHistoryList(historyData);
      
      // If history exists and no specific ID is requested, load the latest one
      if (historyData.length > 0 && !autoSelectId && !historyId) {
        loadRecommendation(historyData[0].id);
      } else if (!historyId) {
        // No history and no specific ID to load, turn off loading
        setLoading(false);
      }
    } catch (err) {
      console.error("Failed to load beauty recommendations history:", err);
      if (!historyId) {
        setLoading(false);
      }
    } finally {
      setHistoryLoading(false);
    }
  };

  // Load specific recommendation record
  const loadRecommendation = async (id) => {
    setLoading(true);
    setError('');
    try {
      const data = await getProductRecommendationDetail(id);
      setCurrentRec(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load beauty recommendation details.');
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
    navigate(`/beauty-recommendations/result/${id}`);
  };

  const getImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    return `${API_BASE_URL}${path}`;
  };

  const handleToggleSafetyFilter = (key) => {
    setSafetyFilters(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleSelectProduct = (productId) => {
    setSelectedProducts(prev => ({
      ...prev,
      [productId]: !prev[productId]
    }));
  };

  // Filters a list of products based on UI filters
  const applyFilters = (products) => {
    if (!products) return [];
    return products.filter(prod => {
      // Price filter
      if (priceFilter !== 'All' && prod.price_range !== priceFilter) {
        return false;
      }
      // Safety filters
      if (safetyFilters.sensitive_skin_safe && !prod.sensitive_skin_safe) {
        return false;
      }
      if (safetyFilters.fragrance_free && !prod.fragrance_free) {
        return false;
      }
      if (safetyFilters.acne_friendly && !prod.acne_friendly) {
        return false;
      }
      return true;
    });
  };

  // Calculate dynamic analytics on the recommended items
  const calculateAnalytics = () => {
    if (!currentRec || !currentRec.recommended_products) return null;
    
    let allProducts = [];
    Object.values(currentRec.recommended_products).forEach(list => {
      allProducts.push(...list);
    });

    if (allProducts.length === 0) return null;

    // Count features
    const sensitiveSafeCount = allProducts.filter(p => p.sensitive_skin_safe).length;
    const fragranceFreeCount = allProducts.filter(p => p.fragrance_free).length;
    const acneFriendlyCount = allProducts.filter(p => p.acne_friendly).length;
    
    // Average Match Score
    const totalScore = allProducts.reduce((sum, p) => sum + p.match_score, 0);
    const avgScore = Math.round(totalScore / allProducts.length);

    // Most recommended brand
    const brandCounts = {};
    allProducts.forEach(p => {
      brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1;
    });
    let mostRecommendedBrand = 'None';
    let maxBrandCount = 0;
    Object.entries(brandCounts).forEach(([brand, count]) => {
      if (count > maxBrandCount) {
        maxBrandCount = count;
        mostRecommendedBrand = brand;
      }
    });

    // Total Selected
    const totalSelected = Object.values(selectedProducts).filter(Boolean).length;

    return {
      avgScore,
      mostRecommendedBrand,
      fragranceFreePercentage: Math.round((fragranceFreeCount / allProducts.length) * 100),
      sensitivePercentage: Math.round((sensitiveSafeCount / allProducts.length) * 100),
      acneSafePercentage: Math.round((acneFriendlyCount / allProducts.length) * 100),
      totalSelected
    };
  };

  const analytics = calculateAnalytics();

  // Score color helper
  const getScoreColor = (score) => {
    if (score >= 90) return 'from-emerald-450 to-teal-400 text-emerald-400 border-emerald-500/30 bg-emerald-950/20';
    if (score >= 75) return 'from-indigo-400 to-indigo-500 text-indigo-400 border-indigo-500/30 bg-indigo-950/20';
    if (score >= 50) return 'from-amber-400 to-orange-400 text-amber-400 border-amber-500/20 bg-amber-950/20';
    return 'from-rose-500 to-red-500 text-rose-500 border-rose-500/20 bg-rose-950/20';
  };

  if (loading && historyList.length === 0) {
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center text-white">
        <div className="relative flex items-center justify-center mb-6">
          <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
          <Compass className="absolute w-6 h-6 text-emerald-450 animate-pulse" />
        </div>
        <p className="text-slate-400 font-medium text-lg animate-pulse">Running recommendation scoring systems...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      
      {/* Back to Gallery */}
      <Link 
        to="/gallery" 
        className="inline-flex items-center gap-2 text-slate-455 hover:text-white transition-colors mb-6 text-sm font-semibold group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to Gallery
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* SIDEBAR: HISTORY SCAN LOGS (col-span-3) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="glass-panel rounded-3xl p-5 border border-slate-800 bg-slate-950/40">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-4 pb-3 border-b border-slate-900">
              <History className="w-4 h-4 text-emerald-450" />
              Skincare History
            </h2>
            
            {historyLoading ? (
              <div className="space-y-3 py-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-14 bg-slate-900/50 rounded-2xl animate-pulse"></div>
                ))}
              </div>
            ) : historyList.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs leading-relaxed">
                No skin recommendations recorded yet. Run a scan and click "Get Skincare Routine" to begin!
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
                  const skinType = item.recommendations_json?.skin_type || 'Unknown';
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectHistory(item.id)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between group ${
                        isActive 
                          ? 'bg-emerald-600/10 border-emerald-500/40 text-white shadow-lg' 
                          : 'bg-slate-900/20 border-slate-850 text-slate-450 hover:bg-slate-900/50 hover:border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <div className="truncate">
                        <div className="text-xs font-bold truncate flex items-center gap-1.5">
                          <Droplets className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-650'}`} />
                          {skinType} Skin Routine
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium block mt-0.5">{date}</span>
                      </div>
                      <ChevronRight className={`w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity ${isActive ? 'text-emerald-400' : ''}`} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* MAIN DISPLAY: RECOMMENDATIONS & ROUTINES (col-span-9) */}
        <div className="lg:col-span-9 space-y-6">
          
          {error && (
            <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-350 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="font-semibold">{error}</p>
            </div>
          )}

          {currentRec ? (
            <>
              {/* Header card: Skin Profile Summary */}
              <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800 bg-slate-900/25 relative overflow-hidden shadow-xl">
                <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-3">
                      <Sparkles className="w-3.5 h-3.5 animate-pulse" /> AI Skincare Recommendation Report
                    </span>
                    
                    <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight flex flex-wrap items-center gap-x-3 gap-y-1">
                      Skin Type: <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">{currentRec.skin_type}</span>
                    </h1>
                    
                    <p className="mt-2 text-slate-400 text-sm max-w-xl">
                      Custom routine compiled for <strong className="text-emerald-400">{currentRec.skin_type}</strong> skin with <strong className="text-teal-450">{currentRec.skin_tone}</strong> tone.
                    </p>
                  </div>
                  
                  {/* Health Score Circle */}
                  <div className="flex items-center gap-4 bg-slate-950/60 border border-slate-850 p-4 rounded-3xl shadow-inner min-w-[200px]">
                    <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="16" fill="none" className="stroke-slate-800" strokeWidth="3" />
                        <circle cx="18" cy="18" r="16" fill="none" className="stroke-emerald-500" strokeWidth="3" 
                          strokeDasharray="100" strokeDashoffset={100 - (currentRec.skin_health_score || 75)} strokeLinecap="round" />
                      </svg>
                      <span className="absolute text-sm font-black text-white">{currentRec.skin_health_score || 75}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Health Score</span>
                      <span className="text-xs text-emerald-450 font-extrabold">Healthy & Balanced</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* View Selector (Routine vs Catalog) */}
              <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-900 w-full md:w-fit">
                <button
                  onClick={() => setViewMode('routine')}
                  className={`flex-1 md:flex-none py-2.5 px-6 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                    viewMode === 'routine' 
                      ? 'bg-emerald-600 text-white shadow-md' 
                      : 'text-slate-455 hover:text-white'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  Skincare Routine
                </button>
                <button
                  onClick={() => setViewMode('categories')}
                  className={`flex-1 md:flex-none py-2.5 px-6 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                    viewMode === 'categories' 
                      ? 'bg-emerald-600 text-white shadow-md' 
                      : 'text-slate-455 hover:text-white'
                  }`}
                >
                  <Compass className="w-4 h-4" />
                  Product Catalog
                </button>
              </div>

              {/* FILTERING BAR (Always present) */}
              <div className="glass-panel rounded-3xl p-5 border border-slate-805 bg-slate-950/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Price Filter */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5" /> Filter Price:
                  </span>
                  <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
                    {['All', 'Budget', 'Midrange', 'Premium'].map(p => (
                      <button
                        key={p}
                        onClick={() => setPriceFilter(p)}
                        className={`px-3 py-1 text-xxs font-bold rounded-md transition-all ${
                          priceFilter === p
                            ? 'bg-emerald-950 text-emerald-450 border border-emerald-500/20 font-extrabold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Safety / Feature Filters */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'sensitive_skin_safe', label: 'Sensitive Safe' },
                    { key: 'fragrance_free', label: 'Fragrance Free' },
                    { key: 'acne_friendly', label: 'Acne Friendly' }
                  ].map(f => (
                    <button
                      key={f.key}
                      onClick={() => handleToggleSafetyFilter(f.key)}
                      className={`px-3 py-1.5 text-xxs font-bold rounded-xl border transition-all ${
                        safetyFilters[f.key]
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400 font-extrabold'
                          : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* VIEW 1: DAILY ROUTINES */}
              {viewMode === 'routine' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  
                  {/* MORNING Skincare Routine */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-850">
                      <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                        <Sun className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-white">Morning Skincare Routine</h2>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Cleanse, Hydrate & Protect</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {currentRec.morning_routine?.map((step) => {
                        const isExpanded = expandedMorningStep === step.step;
                        const hasProduct = step.product;
                        const filteredProduct = hasProduct ? applyFilters([step.product])[0] : null;

                        return (
                          <div 
                            key={step.step}
                            className={`glass-panel border rounded-2xl overflow-hidden transition-all duration-300 ${
                              isExpanded ? 'border-slate-750 bg-slate-900/10' : 'border-slate-900 hover:border-slate-800'
                            }`}
                          >
                            {/* Step Header */}
                            <button
                              onClick={() => setExpandedMorningStep(isExpanded ? null : step.step)}
                              className="w-full text-left p-4 flex items-center justify-between hover:bg-slate-900/20 transition-all"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center">
                                  {step.step}
                                </div>
                                <div>
                                  <h3 className="text-sm font-bold text-white">{step.title}</h3>
                                  <p className="text-xxs text-slate-400 font-medium">{step.subtitle}</p>
                                </div>
                              </div>
                              <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Step Body */}
                            {isExpanded && (
                              <div className="p-4 border-t border-slate-850 bg-slate-950/20 space-y-4">
                                <p className="text-xs text-slate-350 leading-relaxed font-medium">{step.description}</p>
                                
                                {hasProduct ? (
                                  filteredProduct ? (
                                    <div className="p-3.5 bg-slate-900/35 border border-slate-800 rounded-xl flex items-start gap-4">
                                      {/* Product Image / Icon placeholder */}
                                      <div className="w-14 h-14 bg-slate-950 border border-slate-850 rounded-lg flex items-center justify-center flex-shrink-0 text-emerald-400 relative overflow-hidden">
                                        {filteredProduct.image ? (
                                          <img src={getImageUrl(filteredProduct.image)} alt={filteredProduct.name} className="w-full h-full object-cover" />
                                        ) : (
                                          <ShoppingBag className="w-6 h-6 stroke-[1.5]" />
                                        )}
                                      </div>
                                      
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-bold text-slate-550 uppercase tracking-wide">{filteredProduct.brand}</span>
                                          <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getScoreColor(filteredProduct.match_score)}`}>
                                            {filteredProduct.match_score}% Match
                                          </div>
                                        </div>
                                        <h4 className="text-xs font-bold text-white truncate mt-0.5">{filteredProduct.name}</h4>
                                        <p className="text-xxs text-slate-400 line-clamp-2 mt-1 leading-normal">{filteredProduct.description}</p>
                                        
                                        <div className="flex flex-wrap gap-1 mt-2.5">
                                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-950/40 border border-slate-800 text-slate-400 rounded uppercase">{filteredProduct.price_range}</span>
                                          {filteredProduct.fragrance_free && (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 rounded uppercase">Fragrance Free</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl text-center text-xxs text-slate-500 font-semibold leading-relaxed">
                                      The recommended product in this step was filtered out by your active filters. Clear filters to show this product.
                                    </div>
                                  )
                                ) : (
                                  <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl text-center text-xxs text-slate-500 font-semibold">
                                    No products found for this step.
                                  </div>
                                )}

                                <div className="bg-emerald-950/10 border border-emerald-900/20 p-3 rounded-xl flex items-start gap-2 text-xxs text-emerald-400/90 leading-relaxed font-semibold">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 flex-shrink-0"></div>
                                  <span><strong>How to Apply:</strong> {step.instructions}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* NIGHT Skincare Routine */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-850">
                      <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                        <Moon className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-white">Night Skincare Routine</h2>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Deep Cleanse, Target & Repair</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {currentRec.night_routine?.map((step) => {
                        const isExpanded = expandedNightStep === step.step;
                        const hasProduct = step.product;
                        const filteredProduct = hasProduct ? applyFilters([step.product])[0] : null;

                        return (
                          <div 
                            key={step.step}
                            className={`glass-panel border rounded-2xl overflow-hidden transition-all duration-300 ${
                              isExpanded ? 'border-slate-750 bg-slate-900/10' : 'border-slate-900 hover:border-slate-800'
                            }`}
                          >
                            {/* Step Header */}
                            <button
                              onClick={() => setExpandedNightStep(isExpanded ? null : step.step)}
                              className="w-full text-left p-4 flex items-center justify-between hover:bg-slate-900/20 transition-all"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-black text-xs flex items-center justify-center">
                                  {step.step}
                                </div>
                                <div>
                                  <h3 className="text-sm font-bold text-white">{step.title}</h3>
                                  <p className="text-xxs text-slate-400 font-medium">{step.subtitle}</p>
                                </div>
                              </div>
                              <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Step Body */}
                            {isExpanded && (
                              <div className="p-4 border-t border-slate-850 bg-slate-950/20 space-y-4">
                                <p className="text-xs text-slate-350 leading-relaxed font-medium">{step.description}</p>
                                
                                {hasProduct ? (
                                  filteredProduct ? (
                                    <div className="p-3.5 bg-slate-900/35 border border-slate-800 rounded-xl flex items-start gap-4">
                                      {/* Product Image */}
                                      <div className="w-14 h-14 bg-slate-950 border border-slate-850 rounded-lg flex items-center justify-center flex-shrink-0 text-indigo-400 relative overflow-hidden">
                                        {filteredProduct.image ? (
                                          <img src={getImageUrl(filteredProduct.image)} alt={filteredProduct.name} className="w-full h-full object-cover" />
                                        ) : (
                                          <ShoppingBag className="w-6 h-6 stroke-[1.5]" />
                                        )}
                                      </div>
                                      
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-bold text-slate-550 uppercase tracking-wide">{filteredProduct.brand}</span>
                                          <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getScoreColor(filteredProduct.match_score)}`}>
                                            {filteredProduct.match_score}% Match
                                          </div>
                                        </div>
                                        <h4 className="text-xs font-bold text-white truncate mt-0.5">{filteredProduct.name}</h4>
                                        <p className="text-xxs text-slate-400 line-clamp-2 mt-1 leading-normal">{filteredProduct.description}</p>
                                        
                                        <div className="flex flex-wrap gap-1 mt-2.5">
                                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-950/40 border border-slate-800 text-slate-400 rounded uppercase">{filteredProduct.price_range}</span>
                                          {filteredProduct.fragrance_free && (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-indigo-950/20 border border-indigo-900/30 text-indigo-400 rounded uppercase">Fragrance Free</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl text-center text-xxs text-slate-500 font-semibold leading-relaxed">
                                      The recommended product in this step was filtered out by your active filters. Clear filters to show this product.
                                    </div>
                                  )
                                ) : (
                                  <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl text-center text-xxs text-slate-500 font-semibold">
                                    No products found for this step.
                                  </div>
                                )}

                                <div className="bg-indigo-950/10 border border-indigo-900/20 p-3 rounded-xl flex items-start gap-2 text-xxs text-indigo-400/90 leading-relaxed font-semibold">
                                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1 flex-shrink-0"></div>
                                  <span><strong>How to Apply:</strong> {step.instructions}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              )}

              {/* VIEW 2: CATEGORY CATALOG */}
              {viewMode === 'categories' && (
                <div className="space-y-6">
                  
                  {/* Category Buttons Row */}
                  <div className="flex flex-wrap gap-2 border-b border-slate-900 pb-4">
                    {Object.keys(CATEGORY_LABELS).map((catKey) => {
                      const Icon = CATEGORY_ICONS[catKey] || ShoppingBag;
                      const isActive = activeCategory === catKey;
                      const listCount = applyFilters(currentRec.recommended_products[catKey]).length;
                      
                      return (
                        <button
                          key={catKey}
                          onClick={() => setActiveCategory(catKey)}
                          className={`flex items-center gap-2 py-2 px-4 text-xs font-bold rounded-xl border transition-all ${
                            isActive
                              ? 'bg-emerald-950 border-emerald-500/30 text-emerald-450'
                              : 'bg-slate-900/20 border-slate-850 text-slate-400 hover:text-white hover:border-slate-800'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {CATEGORY_LABELS[catKey]}
                          <span className="bg-slate-950/80 px-1.5 py-0.5 rounded text-[10px] font-black text-slate-500">
                            {listCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Products Grid */}
                  {(() => {
                    const productsList = currentRec.recommended_products[activeCategory] || [];
                    const filteredList = applyFilters(productsList);

                    if (filteredList.length === 0) {
                      return (
                        <div className="glass-panel rounded-3xl p-12 text-center border border-slate-900 max-w-md mx-auto mt-6">
                          <div className="w-12 h-12 bg-slate-900 border border-slate-800 text-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Compass className="w-6 h-6" />
                          </div>
                          <h3 className="text-sm font-bold text-white mb-1">No products match</h3>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            We couldn't find any products in "{CATEGORY_LABELS[activeCategory]}" matching your active price or safety filters.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredList.map((item, idx) => {
                          const imgUrl = getImageUrl(item.image);
                          const isSelected = !!selectedProducts[item.id];
                          return (
                            <div 
                              key={idx}
                              className="glass-panel-interactive rounded-2xl overflow-hidden flex flex-col group border border-slate-850 bg-slate-900/10 shadow-lg"
                            >
                              {/* Graphic Preview Container */}
                              <div className="relative aspect-[4/3] bg-slate-950 overflow-hidden flex items-center justify-center border-b border-slate-850/80">
                                {imgUrl ? (
                                  <img
                                    src={imgUrl}
                                    alt={item.name}
                                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-tr from-slate-900 to-slate-950 flex flex-col items-center justify-center gap-2 text-slate-600">
                                    <ShoppingBag className="w-10 h-10 stroke-[1.2]" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">No Image</span>
                                  </div>
                                )}
                                
                                {/* Match Score badge */}
                                <div className={`absolute top-3.5 right-3.5 border backdrop-blur-md px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5 ${getScoreColor(item.match_score)}`}>
                                  <span className="text-[9px] font-extrabold uppercase">MATCH</span>
                                  <span className="text-xs font-black">{item.match_score}%</span>
                                </div>
                              </div>

                              {/* Content Details */}
                              <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                                <div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xxs font-bold text-slate-500 uppercase tracking-wide">{item.brand}</span>
                                    <span className="text-[10px] font-bold text-slate-350 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">{item.price_range}</span>
                                  </div>
                                  <h3 className="text-sm font-bold text-white group-hover:text-emerald-450 transition-colors mt-1.5 truncate">{item.name}</h3>
                                  <p className="text-xxs text-slate-400 leading-relaxed mt-2 line-clamp-3">{item.description}</p>
                                </div>

                                <div className="space-y-3 pt-3 border-t border-slate-800/60">
                                  {/* Badges */}
                                  <div className="flex flex-wrap gap-1">
                                    {item.sensitive_skin_safe && (
                                      <span className="text-[8px] font-bold px-1.5 py-0.5 bg-emerald-950/20 border border-emerald-900/30 text-emerald-350 rounded uppercase">Sensitive Safe</span>
                                    )}
                                    {item.fragrance_free && (
                                      <span className="text-[8px] font-bold px-1.5 py-0.5 bg-teal-950/20 border border-teal-900/30 text-teal-350 rounded uppercase">Fragrance Free</span>
                                    )}
                                    {item.acne_friendly && (
                                      <span className="text-[8px] font-bold px-1.5 py-0.5 bg-blue-950/20 border border-blue-900/30 text-blue-350 rounded uppercase">Acne Safe</span>
                                    )}
                                  </div>

                                  <div className="flex items-center justify-between gap-2 border-t border-slate-900/80 pt-2.5 mt-1">
                                    <div className="flex items-center gap-1">
                                      <Star className="w-3.5 h-3.5 fill-amber-500 stroke-amber-500" />
                                      <span className="text-xs font-bold text-white">{item.rating}</span>
                                    </div>
                                    
                                    {/* Select Product Check */}
                                    <button
                                      onClick={() => toggleSelectProduct(item.id)}
                                      className={`py-1 px-3 text-xxs font-bold rounded-lg border transition-all flex items-center gap-1 ${
                                        isSelected 
                                          ? 'bg-emerald-600 border-emerald-500 text-white font-extrabold shadow'
                                          : 'bg-transparent border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                                      }`}
                                    >
                                      {isSelected ? (
                                        <>
                                          <Check className="w-3.5 h-3.5" />
                                          Selected
                                        </>
                                      ) : (
                                        'Select Product'
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* DYNAMIC ANALYTICS DISPLAY PANEL */}
              {analytics && (
                <div className="glass-panel rounded-3xl p-6 border border-slate-800 bg-slate-950/30 shadow-xl space-y-4">
                  <h3 className="text-xs font-bold text-slate-450 uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-450" /> Skincare Telemetry Analytics
                  </h3>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {/* Stat 1: Match Score */}
                    <div className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl flex flex-col items-center justify-center text-center">
                      <Award className="w-5 h-5 text-emerald-400 mb-1.5" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Avg Match Accuracy</span>
                      <span className="text-lg font-black text-white mt-1 flex items-center gap-0.5">
                        {analytics.avgScore}
                        <Percent className="w-3.5 h-3.5 text-emerald-400" />
                      </span>
                    </div>

                    {/* Stat 2: Brand */}
                    <div className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl flex flex-col items-center justify-center text-center">
                      <ShoppingBag className="w-5 h-5 text-teal-400 mb-1.5" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Top Rec Brand</span>
                      <span className="text-xs font-black text-white mt-2 truncate w-full px-1">{analytics.mostRecommendedBrand}</span>
                    </div>

                    {/* Stat 3: Fragrance Free Ratio */}
                    <div className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl flex flex-col items-center justify-center text-center">
                      <ShieldCheck className="w-5 h-5 text-indigo-400 mb-1.5" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fragrance Free Ratio</span>
                      <span className="text-lg font-black text-white mt-1">
                        {analytics.fragranceFreePercentage}%
                      </span>
                    </div>

                    {/* Stat 4: Total Selected items */}
                    <div className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl flex flex-col items-center justify-center text-center">
                      <Check className="w-5 h-5 text-purple-400 mb-1.5" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Selected Products</span>
                      <span className="text-lg font-black text-white mt-1">
                        {analytics.totalSelected} / 6
                      </span>
                    </div>
                  </div>
                </div>
              )}

            </>
          ) : (
            /* Recommendations Empty State */
            <div className="glass-panel rounded-3xl p-12 text-center max-w-xl mx-auto border border-slate-850 mt-10">
              <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6 text-slate-550 animate-pulse">
                <Compass className="w-8 h-8 text-emerald-450" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">No beauty recommendations</h2>
              <p className="text-slate-400 text-sm max-w-sm mx-auto mb-8 leading-relaxed">
                You haven't scanned your skin telemetry yet. Scan a selfie, analyze your skin parameters, and unlock tailored routines.
              </p>
              <Link
                to="/upload"
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-600/15 transition-all"
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

export default BeautyRecommendations;
