import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getImages, deleteImage } from '../services/analysisService';
import { Trash2, Calendar, ShieldCheck, HelpCircle, Eye, AlertCircle, RefreshCw, Plus, X } from 'lucide-react';

const GalleryPage = () => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null); // For full screen image modal

  const fetchImages = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError('');
    try {
      const data = await getImages();
      setImages(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load your selfies. Please try again.');
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  const handleDeleteClick = (id) => {
    setDeleteConfirmId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    setError('');
    try {
      await deleteImage(deleteConfirmId);
      // Filter out deleted image
      setImages((prev) => prev.filter((img) => img.id !== deleteConfirmId));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error(err);
      setError('Failed to delete image. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      uploaded: {
        text: 'Uploaded',
        className: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
      },
      processing: {
        text: 'Processing',
        className: 'bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse',
      },
      completed: {
        text: 'Analysis Completed',
        className: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
      },
      failed: {
        text: 'Failed',
        className: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
      },
    };

    const currentBadge = badges[status.toLowerCase()] || {
      text: status,
      className: 'bg-slate-500/10 border-slate-500/20 text-slate-400',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${currentBadge.className}`}>
        {currentBadge.text}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getImageUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    return `${baseUrl}${path}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Your Selfie Gallery</h1>
          <p className="mt-1 text-slate-400 text-sm">Review your scans, check processing status, and manage records.</p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => fetchImages(true)}
            className="p-3 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-400 hover:text-white rounded-xl transition-colors"
            title="Refresh list"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          <Link
            to="/upload"
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4" />
            Upload Selfie
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-sm mb-6 animate-shake">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {loading ? (
        /* Loader state */
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="relative flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          </div>
        </div>
      ) : images.length === 0 ? (
        /* Empty state */
        <div className="glass-panel rounded-3xl p-12 text-center max-w-xl mx-auto mt-8 border border-slate-850">
          <div className="w-16 h-16 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner text-slate-500">
            <Calendar className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No selfies found</h2>
          <p className="text-slate-400 text-sm max-w-sm mx-auto mb-6">
            You haven't uploaded any selfie images yet. Let's upload one to start analyzing your features!
          </p>
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-600/15 transition-all"
          >
            <Plus className="w-5 h-5" />
            Upload your first selfie
          </Link>
        </div>
      ) : (
        /* Image Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {images.map((item) => (
            <div 
              key={item.id} 
              className="glass-panel-interactive rounded-2xl overflow-hidden flex flex-col group"
            >
              {/* Image Preview Box */}
              <div className="relative aspect-[4/5] bg-slate-950 overflow-hidden flex items-center justify-center border-b border-slate-850/80">
                <img
                  src={getImageUrl(item.image)}
                  alt={`Selfie scan #${item.id}`}
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                  loading="lazy"
                />
                
                {/* Overlay actions on hover */}
                <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button
                    onClick={() => setSelectedImage(getImageUrl(item.image))}
                    className="p-3 bg-slate-900/90 border border-slate-700/80 text-slate-200 hover:text-white rounded-xl hover:scale-110 hover:border-indigo-500/50 transition-all shadow-md"
                    title="View Image"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(item.id)}
                    className="p-3 bg-slate-900/90 border border-slate-700/80 text-rose-400 hover:text-rose-300 rounded-xl hover:scale-110 hover:border-rose-500/50 transition-all shadow-md"
                    title="Delete Selfie"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Information Area */}
              <div className="p-4 flex-1 flex flex-col justify-between gap-3 bg-slate-900/20">
                <div className="flex flex-wrap gap-2 justify-between items-start">
                  {getStatusBadge(item.status)}
                  <span className="text-xs text-slate-500 font-semibold tracking-wide">ID: #{item.id}</span>
                </div>
                
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1 border-t border-slate-800/40 pt-2.5 w-full">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400/80" />
                  <span>{formatDate(item.uploaded_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-800 animate-zoomIn">
            <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            
            <h3 className="text-lg font-bold text-white mb-1.5">Delete Selfie?</h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Are you sure you want to permanently delete this selfie? This will remove the image database record and delete the file from storage.
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

      {/* Full Size Image Preview Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-6 right-6 p-2.5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-full transition-colors focus:outline-none"
            title="Close viewer"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl border border-slate-800 shadow-2xl animate-zoomIn flex items-center justify-center">
            <img
              src={selectedImage}
              alt="Fullscreen selfie preview"
              className="max-w-full max-h-[85vh] object-contain"
            />
          </div>
        </div>
      )}

    </div>
  );
};

export default GalleryPage;
