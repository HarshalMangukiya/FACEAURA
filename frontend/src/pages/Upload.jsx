import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadImage } from '../services/analysisService';
import { Upload, X, FileImage, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';

const UploadPage = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // Client-side validations
  const validateFile = (file) => {
    if (!file) return 'No file selected.';

    // Check extension
    const allowedExtensions = ['jpg', 'jpeg', 'png'];
    const extension = file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      return 'Invalid file type. Only JPG, JPEG, and PNG files are allowed.';
    }

    // Check MIME type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedMimeTypes.includes(file.type)) {
      return 'Invalid file format. Please upload a valid JPEG or PNG image.';
    }

    // Check size (5MB = 5 * 1024 * 1024 bytes)
    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return 'File is too large. Maximum size allowed is 5 MB.';
    }

    return null;
  };

  const handleFileChange = (file) => {
    setError('');
    setSuccess('');
    setProgress(0);

    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
    }
    setProgress(0);
    setError('');
    setSuccess('');
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select an image first.');
      return;
    }

    setError('');
    setSuccess('');
    setUploading(true);
    setProgress(5); // Start with visual feedback

    try {
      const response = await uploadImage(selectedFile, (percent) => {
        setProgress(percent);
      });
      
      setSuccess(response.message || 'Image uploaded successfully!');
      setTimeout(() => {
        // Redirect to gallery after success
        navigate('/gallery');
      }, 1500);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error || 
        err.response?.data?.image?.[0] || 
        'Failed to upload image. Please try again.'
      );
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="relative">
        {/* Glow effect background */}
        <div className="absolute -top-10 left-10 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-10 right-10 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl pointer-events-none"></div>

        {/* Hero title */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
            Upload Selfie <Sparkles className="w-6 h-6 text-indigo-400" />
          </h1>
          <p className="mt-2 text-slate-400 max-w-lg mx-auto text-sm sm:text-base">
            Upload a clear front-facing portrait to analyze your facial attributes and generate recommendations.
          </p>
        </div>

        {/* Content Box */}
        <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-2xl accent-glow-indigo border border-slate-800">
          <form onSubmit={handleUploadSubmit} className="space-y-6">
            
            {/* Status alerts */}
            {error && (
              <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-sm animate-shake">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="font-medium">{error}</p>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-300 text-sm">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <p className="font-medium">{success}</p>
              </div>
            )}

            {/* Upload Area */}
            {!previewUrl ? (
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current.click()}
                className={`relative flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-3xl cursor-pointer transition-all duration-300 group ${
                  dragActive 
                    ? 'border-indigo-500 bg-indigo-500/5 scale-[0.99] shadow-lg shadow-indigo-500/5' 
                    : 'border-slate-700/80 hover:border-slate-500 hover:bg-slate-800/20'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  onChange={(e) => handleFileChange(e.target.files[0])}
                  className="hidden"
                />
                
                <div className="p-4 bg-slate-800/80 border border-slate-700/60 rounded-2xl mb-4 group-hover:scale-110 transition-transform duration-200 shadow-md">
                  <Upload className="w-8 h-8 text-indigo-400" />
                </div>
                
                <p className="text-lg font-semibold text-slate-200 text-center">
                  Drag and drop your selfie here
                </p>
                <p className="text-slate-400 text-sm mt-1 text-center">
                  or <span className="text-indigo-400 font-medium hover:underline">browse files</span> on your device
                </p>
                
                <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-slate-500 border-t border-slate-800/80 pt-4 w-full max-w-sm">
                  <span>PNG, JPG, JPEG</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-700 self-center"></span>
                  <span>Max size: 5 MB</span>
                </div>
              </div>
            ) : (
              /* Preview Area */
              <div className="relative border border-slate-800 rounded-3xl overflow-hidden bg-slate-950/40 p-4">
                
                {/* Clear preview button */}
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={uploading}
                  className="absolute top-6 right-6 z-10 p-2 bg-slate-900/90 border border-slate-700 hover:bg-rose-500/20 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 rounded-full transition-colors focus:outline-none"
                  title="Remove Image"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Preview layout */}
                <div className="flex flex-col md:flex-row gap-6 items-center">
                  <div className="w-full md:w-1/2 aspect-square max-h-[300px] overflow-hidden rounded-2xl border border-slate-800/80 shadow-inner flex items-center justify-center bg-slate-900/50">
                    <img
                      src={previewUrl}
                      alt="Selfie preview"
                      className="max-w-full max-h-full object-contain rounded-xl"
                    />
                  </div>
                  
                  <div className="w-full md:w-1/2 space-y-4">
                    <div className="space-y-2.5">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">File Information</h3>
                      <div className="glass-panel bg-slate-900/40 border border-slate-850 p-4 rounded-2xl space-y-2 text-sm text-slate-300">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileImage className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                          <span className="truncate font-medium" title={selectedFile.name}>{selectedFile.name}</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-400 border-t border-slate-800/60 pt-2 mt-1">
                          <span>{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                          <span className="uppercase">{selectedFile.name.split('.').pop()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Progress indicator */}
                    {uploading && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-semibold text-indigo-400">
                          <span>Uploading image...</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {!uploading && (
                      <div className="flex gap-4 pt-2">
                        <button
                          type="button"
                          onClick={handleClear}
                          className="flex-1 py-3 px-4 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-300 font-semibold rounded-2xl active:scale-[0.98] transition-all duration-150"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold rounded-2xl active:scale-[0.98] transition-all shadow-lg shadow-indigo-600/15"
                        >
                          Upload Selfie
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
          </form>
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
