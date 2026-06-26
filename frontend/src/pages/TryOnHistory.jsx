import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getTryOnHistory, deleteTryOnHistory, toggleTryOnFavorite } from '../services/tryOnService';
import { 
  Trash2, 
  Download, 
  Heart, 
  Calendar, 
  AlertCircle, 
  RefreshCw, 
  Eye, 
  X, 
  Sparkles, 
  Scissors, 
  User, 
  Glasses,
  ExternalLink,
  ArrowLeft
} from 'lucide-react';

const TryOnHistoryPage = () => {
  const navigate = useNavigate();
  
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // all | favorites
  const [selectedLook, setSelectedLook] = useState(null); // Look object for details modal
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const fetchHistory = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError('');
    try {
      const data = await getTryOnHistory();
      setHistory(data);
    } catch (err) {
      console.error('[TryOnHistory] Failed to load history:', err);
      setError('Failed to retrieve your saved looks. Please ensure backend service is active.');
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleFavoriteToggle = async (id, currentFavStatus, e) => {
    e.stopPropagation(); // Prevent opening modal
    try {
      const updatedLook = await toggleTryOnFavorite(id, !currentFavStatus);
      // Update local state list
      setHistory(prev => prev.map(item => item.id === id ? { ...item, is_favorite: updatedLook.is_favorite } : item));
      if (selectedLook && selectedLook.id === id) {
        setSelectedLook(prev => ({ ...prev, is_favorite: updatedLook.is_favorite }));
      }
    } catch (err) {
      console.error('[TryOnHistory] Failed to toggle favorite:', err);
      setError('Could not update favorite status. Please try again.');
    }
  };

  const handleDeleteClick = (id, e) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    setError('');
    try {
      await deleteTryOnHistory(deleteConfirmId);
      setHistory(prev => prev.filter(item => item.id !== deleteConfirmId));
      if (selectedLook && selectedLook.id === deleteConfirmId) {
        setSelectedLook(null);
      }
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('[TryOnHistory] Failed to delete look:', err);
      setError('Failed to delete saved look. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = (look, e) => {
    if (e) e.stopPropagation();
    const imageUrl = getImageUrl(look.generated_image_url);
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `faceaura_look_${look.id}_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleApplyLook = (look) => {
    // Navigate back to virtual try-on page pre-populating selectors
    navigate('/virtual-tryon', { 
      state: { 
        restoreLook: {
          original_image: look.original_image,
          selected_hairstyle: look.selected_hairstyle || '',
          selected_beard: look.selected_beard || '',
          selected_glasses: look.selected_glasses || '',
          selected_color: look.selected_color || 'Original'
        }
      } 
    });
  };

  const getImageUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    return `${API_BASE_URL}${path}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredHistory = history.filter(item => {
    if (activeTab === 'favorites') return item.is_favorite;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-slate-200">
      
      {/* Back button and page title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <Link 
            to="/virtual-tryon" 
            className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-bold hover:underline mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Try-On Studio
          </Link>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Try-On Looks History
          </h1>
          <p className="mt-1 text-slate-400 text-sm">Review, compare, and manage your bookmarked virtual try-on selections.</p>
        </div>
        
        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={() => fetchHistory(true)}
            className="p-3 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-400 hover:text-white rounded-xl transition-colors"
            title="Refresh logs"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          <Link
            to="/virtual-tryon"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/10 active:scale-[0.98] transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Open Try-On Studio
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-sm mb-6">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Tabs list (All looks vs favorites) */}
      <div className="flex border-b border-slate-850 mb-8">
        <button
          onClick={() => setActiveTab('all')}
          className={`pb-4 px-6 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'all'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-450 hover:text-slate-200'
          }`}
        >
          All Looks ({history.length})
        </button>
        <button
          onClick={() => setActiveTab('favorites')}
          className={`pb-4 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'favorites'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-450 hover:text-slate-200'
          }`}
        >
          <Heart className="w-4 h-4 fill-rose-500/10 text-rose-500" />
          Favorites ({history.filter(i => i.is_favorite).length})
        </button>
      </div>

      {loading ? (
        <div className="min-h-[300px] flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center max-w-xl mx-auto mt-8 border border-slate-850">
          <div className="w-16 h-16 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner text-slate-500">
            <Heart className="w-8 h-8 text-slate-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            {activeTab === 'favorites' ? 'No favorites saved' : 'No try-on history logs found'}
          </h2>
          <p className="text-slate-400 text-sm max-w-sm mx-auto mb-6">
            {activeTab === 'favorites' 
              ? 'Click the heart icon on any saved look card to pin it into your favorites collection.'
              : 'Configure hairstyles, beards, and glasses overlays in the studio and save/bookmark them to see logs here.'
            }
          </p>
          <Link
            to="/virtual-tryon"
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-600/15 transition-all"
          >
            <Sparkles className="w-5 h-5" />
            Try-On a Look Now
          </Link>
        </div>
      ) : (
        /* History Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredHistory.map(look => (
            <div 
              key={look.id}
              onClick={() => setSelectedLook(look)}
              className="glass-panel-interactive rounded-2xl overflow-hidden flex flex-col group cursor-pointer relative"
            >
              {/* Composite Image Preview */}
              <div className="relative aspect-[3/4] bg-slate-950 overflow-hidden flex items-center justify-center border-b border-slate-850/80">
                <img
                  src={getImageUrl(look.generated_image_url)}
                  alt="Saved Composite Look"
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                  loading="lazy"
                />

                {/* Floating quick actions */}
                <div className="absolute top-2 right-2 flex gap-1.5 z-10">
                  <button
                    onClick={(e) => handleFavoriteToggle(look.id, look.is_favorite, e)}
                    className="p-2 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-slate-300 rounded-xl transition-all shadow-md active:scale-95"
                    title={look.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
                  >
                    <Heart className={`w-4 h-4 ${look.is_favorite ? 'fill-rose-500 text-rose-500' : 'text-slate-455'}`} />
                  </button>
                  <button
                    onClick={(e) => handleDeleteClick(look.id, e)}
                    className="p-2 bg-slate-950/80 hover:bg-rose-950/30 border border-slate-800 hover:border-rose-900/40 text-slate-450 hover:text-rose-400 rounded-xl transition-all shadow-md active:scale-95"
                    title="Delete look"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Overlay actions on hover */}
                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <span className="px-3.5 py-1.5 bg-slate-950/90 text-xs font-bold text-slate-200 rounded-xl border border-slate-850 shadow-md flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5 text-indigo-400" /> View Details
                  </span>
                </div>
              </div>

              {/* Specifications details */}
              <div className="p-4 flex-1 flex flex-col justify-between gap-3 bg-slate-900/10">
                <div className="space-y-1.5">
                  <div className="text-xxs font-bold text-slate-450 uppercase tracking-widest">Selected Overlays</div>
                  
                  {/* Hairstyles / Beard / Glasses spec chips */}
                  <div className="space-y-1">
                    {look.hairstyle_details ? (
                      <div className="flex items-center gap-1.5 text-xs text-slate-300">
                        <Scissors className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                        <span className="truncate">{look.hairstyle_details.name} <strong className="text-[10px] text-slate-500 font-medium">({look.selected_color || 'Original'})</strong></span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Scissors className="w-3 h-3 flex-shrink-0" />
                        <span>No Hairstyle</span>
                      </div>
                    )}

                    {look.beard_details ? (
                      <div className="flex items-center gap-1.5 text-xs text-slate-300">
                        <User className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                        <span className="truncate">{look.beard_details.name}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <User className="w-3 h-3 flex-shrink-0" />
                        <span>No Beard</span>
                      </div>
                    )}

                    {look.glasses_details ? (
                      <div className="flex items-center gap-1.5 text-xs text-slate-300">
                        <Glasses className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                        <span className="truncate">{look.glasses_details.name}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Glasses className="w-3 h-3 flex-shrink-0" />
                        <span>No Glasses</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xxs text-slate-500 border-t border-slate-800/40 pt-2.5 w-full">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400/70" />
                  <span>{formatDate(look.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Details Side-by-Side Modal */}
      {selectedLook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-slate-800 animate-zoomIn flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-850 flex items-center justify-between bg-slate-900/40">
              <div className="flex items-center gap-2">
                <h3 className="text-md font-bold text-white">Look Details</h3>
                <button
                  type="button"
                  onClick={(e) => handleFavoriteToggle(selectedLook.id, selectedLook.is_favorite, e)}
                  className="text-slate-400 hover:text-rose-500 transition-colors"
                >
                  <Heart className={`w-5 h-5 ${selectedLook.is_favorite ? 'fill-rose-500 text-rose-500' : 'text-slate-450'}`} />
                </button>
              </div>
              <button
                onClick={() => setSelectedLook(null)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* Compare original and composite side-by-side */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="text-xxs font-bold text-slate-450 uppercase tracking-widest text-center">Original Selfie</div>
                  <div className="aspect-[3/4] rounded-xl overflow-hidden bg-slate-950 border border-slate-850">
                    <img 
                      src={getImageUrl(selectedLook.original_image_url)} 
                      alt="Original Selfie" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xxs font-bold text-slate-450 uppercase tracking-widest text-center">Try-On Output</div>
                  <div className="aspect-[3/4] rounded-xl overflow-hidden bg-slate-950 border border-slate-850">
                    <img 
                      src={getImageUrl(selectedLook.generated_image_url)} 
                      alt="Try On Output" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>

              {/* Information lists */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-900/20 p-4 rounded-2xl border border-slate-850/80">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider text-indigo-400">Configurations</h4>
                  <ul className="space-y-2 text-xs">
                    <li className="flex justify-between py-1 border-b border-slate-800/40">
                      <span className="text-slate-450">Hairstyle:</span>
                      <span className="text-slate-205 font-medium">{selectedLook.hairstyle_details?.name || 'None'}</span>
                    </li>
                    <li className="flex justify-between py-1 border-b border-slate-800/40">
                      <span className="text-slate-450">Hair Color:</span>
                      <span className="text-slate-205 font-medium">{selectedLook.selected_color || 'Original'}</span>
                    </li>
                    <li className="flex justify-between py-1 border-b border-slate-800/40">
                      <span className="text-slate-450">Beard Overlay:</span>
                      <span className="text-slate-205 font-medium">{selectedLook.beard_details?.name || 'None'}</span>
                    </li>
                    <li className="flex justify-between py-1 border-b border-slate-800/40">
                      <span className="text-slate-450">Eyewear:</span>
                      <span className="text-slate-205 font-medium">{selectedLook.glasses_details?.name || 'None'}</span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider text-indigo-400">Log Details</h4>
                  <ul className="space-y-2 text-xs">
                    <li className="flex justify-between py-1 border-b border-slate-800/40">
                      <span className="text-slate-450">Look ID:</span>
                      <span className="text-slate-205 font-semibold">#{selectedLook.id}</span>
                    </li>
                    <li className="flex justify-between py-1 border-b border-slate-800/40">
                      <span className="text-slate-450">User:</span>
                      <span className="text-indigo-400 font-bold">{selectedLook.username}</span>
                    </li>
                    <li className="flex justify-between py-1 border-b border-slate-800/40">
                      <span className="text-slate-450">Created At:</span>
                      <span className="text-slate-350">{formatDate(selectedLook.created_at)}</span>
                    </li>
                  </ul>
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-slate-850 flex gap-3 bg-slate-900/30">
              <button
                onClick={() => handleDownload(selectedLook)}
                className="flex-1 py-3 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-300 font-semibold rounded-2xl active:scale-[0.98] transition-colors flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                Download Composite
              </button>
              
              <button
                onClick={() => handleApplyLook(selectedLook)}
                className="flex-1 py-3 bg-gradient-to-r from-indigo-650 to-violet-650 hover:from-indigo-550 hover:to-violet-550 text-white font-bold rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10"
              >
                <ExternalLink className="w-4 h-4" />
                Try-On Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-800 animate-zoomIn">
            <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            
            <h3 className="text-lg font-bold text-white mb-1.5">Delete Look?</h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Are you sure you want to permanently delete this look from your history? This will delete the bookmark record and files.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleting}
                className="flex-1 py-3 px-4 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-300 font-semibold rounded-2xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TryOnHistoryPage;
