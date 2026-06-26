import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getImages, getAnalysisResult, detectFace, detectFaceShape, uploadImage } from '../services/analysisService';
import {
  getHairstyles,
  getBeards,
  getGlasses,
  runVirtualTryOn,
  getTryOnHistory,
  deleteTryOnHistory
} from '../services/tryOnService';
import Camera from '../modules/camera/Camera';
import FaceTracker from '../tracking/FaceTracker';
import CanvasRenderer from '../tracking/CanvasRenderer';
import {
  Sparkles,
  Download,
  Bookmark,
  Trash2,
  Image as ImageIcon,
  ChevronRight,
  Info,
  RefreshCw,
  Eye,
  EyeOff,
  User,
  Heart,
  Scissors,
  Smile,
  Glasses,
  Maximize,
  Minimize,
  RotateCcw,
  Camera as LucideCamera
} from 'lucide-react';

const colors = [
  { name: 'Original', class: 'bg-gradient-to-r from-gray-400 via-slate-500 to-zinc-600' },
  { name: 'Black', class: 'bg-black border border-slate-700' },
  { name: 'Brown', class: 'bg-[#5c4033]' },
  { name: 'Dark Brown', class: 'bg-[#3b2314]' },
  { name: 'Golden', class: 'bg-gradient-to-r from-[#d4af37] to-[#f3e5ab]' },
  { name: 'Blonde', class: 'bg-[#faf0be]' },
  { name: 'Ash Blonde', class: 'bg-[#e9d6af]' },
  { name: 'Grey', class: 'bg-gray-400' },
  { name: 'Silver', class: 'bg-gradient-to-r from-slate-200 to-gray-300' },
  { name: 'Red', class: 'bg-red-600' },
  { name: 'Blue', class: 'bg-blue-600' },
  { name: 'Purple', class: 'bg-purple-600' },
  { name: 'Pink', class: 'bg-pink-400' }
];

// 1. Floating Canvas HUD Toolbar Overlay Component
const FloatingHUDToolbar = React.memo(({
  isMirrored,
  setIsMirrored,
  isFullscreen,
  setIsFullscreen,
  handleDownloadLiveSnapshot,
  handleResetLiveTryOn
}) => {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-slate-950/80 backdrop-blur-md border border-slate-800/80 p-1.5 rounded-2xl shadow-xl z-20">
      {/* Mirror Switch */}
      <button
        type="button"
        onClick={setIsMirrored}
        title="Mirror Viewport"
        className={`p-2 rounded-xl transition-colors hover:bg-slate-900 ${
          isMirrored ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <RefreshCw className="w-4 h-4" />
      </button>

      {/* Fullscreen Toggle */}
      <button
        type="button"
        onClick={setIsFullscreen}
        title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors"
      >
        {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
      </button>

      {/* Capture Snapshot (Download) */}
      <button
        type="button"
        onClick={handleDownloadLiveSnapshot}
        title="Download Frame"
        className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors"
      >
        <LucideCamera className="w-4 h-4" />
      </button>

      {/* Reset Selections */}
      <button
        type="button"
        onClick={handleResetLiveTryOn}
        title="Reset View"
        className="p-2 rounded-xl text-slate-400 hover:text-rose-450 hover:bg-slate-900 transition-colors"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
    </div>
  );
});

// 2. Fine-Tuning Sliders (Opacity & Scale) Component
const TuningSliders = React.memo(({
  overlayOpacity,
  setOverlayOpacity,
  overlayScale,
  setOverlayScale
}) => {
  return (
    <div className="w-full mt-4 p-4 bg-slate-900/40 rounded-2xl border border-slate-850/85 space-y-4 shadow-inner">
      <div className="flex flex-col sm:flex-row items-center gap-4">
        {/* Opacity Slider */}
        <div className="flex-1 w-full space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-450 font-bold uppercase tracking-wider">
            <span>Opacity</span>
            <span className="text-indigo-400">{Math.round(overlayOpacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.10"
            max="1.00"
            step="0.05"
            value={overlayOpacity}
            onChange={setOverlayOpacity}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        {/* Scale Slider */}
        <div className="flex-1 w-full space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-450 font-bold uppercase tracking-wider">
            <span>Scale</span>
            <span className="text-indigo-400">{Math.round(overlayScale * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.50"
            max="1.50"
            step="0.05"
            value={overlayScale}
            onChange={setOverlayScale}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>
      </div>
    </div>
  );
});

// 3. Highlight Color Selector Grid Component
const ColorSelector = React.memo(({
  selectedColor,
  setSelectedColor,
  colors
}) => {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-2xl text-xs text-slate-400 leading-relaxed flex gap-2">
        <Info className="w-4 h-4 text-indigo-400 flex-shrink-0" />
        <span>Preserves the highlights, midtones, and shadows of the hair overlay asset using advanced HSV masking.</span>
      </div>

      <div className="grid grid-cols-4 gap-3 max-h-[300px] overflow-y-auto pr-1">
        {colors.map(color => (
          <div
            key={color.name}
            onClick={() => setSelectedColor(color.name)}
            className={`cursor-pointer rounded-2xl p-2 border transition-all flex flex-col items-center justify-center text-center ${
              selectedColor === color.name
                ? 'bg-indigo-650/10 border-indigo-500 shadow-lg'
                : 'bg-slate-950/20 border-slate-850/60 hover:border-slate-800'
            }`}
          >
            <div className={`w-8 h-8 rounded-full ${color.class} mb-2 shadow-inner`}></div>
            <div className="text-xxs font-bold text-white">{color.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
});

// 4. Asset Selectors List Grid Component (Hairstyles, Beards, Glasses)
const AssetSelectorGrid = React.memo(({
  activeTab,
  faceShapeFilter,
  setFaceShapeFilter,
  faceShape,
  filteredHairstyles,
  selectedHairstyleId,
  setSelectedHairstyleId,
  beards,
  selectedBeardId,
  setSelectedBeardId,
  glasses,
  selectedGlassesId,
  setSelectedGlassesId,
  API_BASE_URL
}) => {
  return (
    <>
      {/* HAIRSTYLES TAB */}
      {activeTab === 'hairstyles' && (
        <div className="space-y-4">
          {/* Face Shape Fit Filter */}
          <div className="flex flex-wrap items-center gap-1.5 p-2.5 bg-slate-950/40 border border-slate-850 rounded-xl">
            <span className="text-xxs font-bold text-slate-500 uppercase tracking-wider px-2">Fit recommendations:</span>
            {['All', 'Round', 'Oval', 'Square', 'Heart'].map(shape => (
              <button
                key={shape}
                type="button"
                onClick={() => setFaceShapeFilter(shape)}
                className={`text-xxs px-2.5 py-1 rounded-lg border font-semibold transition-all ${
                  faceShapeFilter.toLowerCase() === shape.toLowerCase()
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {shape}
                {shape.toLowerCase() === (faceShape || '').toLowerCase() && ' (Recommended)'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
            {/* None Option */}
            <div
              onClick={() => setSelectedHairstyleId('')}
              className={`cursor-pointer rounded-2xl p-3 border transition-all flex flex-col items-center justify-center min-h-[90px] ${
                selectedHairstyleId === ''
                  ? 'bg-indigo-650/10 border-indigo-500 shadow-lg'
                  : 'bg-slate-950/20 border-slate-850/60 hover:border-slate-800'
              }`}
            >
              <EyeOff className="w-5 h-5 text-slate-500 mb-1" />
              <div className="text-xs font-semibold text-slate-450">None / Original</div>
            </div>

            {filteredHairstyles.map(hs => (
              <div
                key={hs.id}
                onClick={() => setSelectedHairstyleId(hs.id)}
                className={`cursor-pointer rounded-2xl p-2 border transition-all flex flex-col items-center relative overflow-hidden group ${
                  selectedHairstyleId === hs.id
                    ? 'bg-indigo-650/10 border-indigo-500 shadow-lg shadow-indigo-950/40'
                    : 'bg-slate-950/20 border-slate-850/60 hover:border-slate-800'
                }`}
              >
                {/* Recommendation badge */}
                {faceShape && hs.face_shape.toLowerCase() === faceShape.toLowerCase() && (
                  <div className="absolute top-1 right-1 bg-emerald-500 text-slate-950 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                    Best Fit
                  </div>
                )}
                <div className="w-16 h-16 rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden mb-2">
                  <img
                    src={hs.thumbnail_url || (hs.image ? `${API_BASE_URL}${hs.image}` : '')}
                    alt={hs.name}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-white leading-tight">{hs.name}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{hs.gender} • {hs.style}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BEARDS TAB */}
      {activeTab === 'beards' && (
        <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
          <div
            onClick={() => setSelectedBeardId('')}
            className={`cursor-pointer rounded-2xl p-3 border transition-all flex flex-col items-center justify-center min-h-[90px] ${
              selectedBeardId === ''
                ? 'bg-indigo-650/10 border-indigo-500 shadow-lg'
                : 'bg-slate-950/20 border-slate-850/60 hover:border-slate-800'
            }`}
          >
            <EyeOff className="w-5 h-5 text-slate-500 mb-1" />
            <div className="text-xs font-semibold text-slate-450">None / Original</div>
          </div>

          {beards.map(b => (
            <div
              key={b.id}
              onClick={() => setSelectedBeardId(b.id)}
              className={`cursor-pointer rounded-2xl p-2 border transition-all flex flex-col items-center group ${
                selectedBeardId === b.id
                  ? 'bg-indigo-650/10 border-indigo-500 shadow-lg'
                  : 'bg-slate-950/20 border-slate-850/60 hover:border-slate-800'
              }`}
            >
              <div className="w-16 h-16 rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden mb-2">
                <img
                  src={b.thumbnail_url || (b.image ? `${API_BASE_URL}${b.image}` : '')}
                  alt={b.name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
              </div>
              <div className="text-xs font-bold text-white text-center leading-tight">{b.name}</div>
            </div>
          ))}
        </div>
      )}

      {/* GLASSES TAB */}
      {activeTab === 'glasses' && (
        <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
          <div
            onClick={() => setSelectedGlassesId('')}
            className={`cursor-pointer rounded-2xl p-3 border transition-all flex flex-col items-center justify-center min-h-[90px] ${
              selectedGlassesId === ''
                ? 'bg-indigo-650/10 border-indigo-500 shadow-lg'
                : 'bg-slate-950/20 border-slate-850/60 hover:border-slate-800'
            }`}
          >
            <EyeOff className="w-5 h-5 text-slate-500 mb-1" />
            <div className="text-xs font-semibold text-slate-450">None / Original</div>
          </div>

          {glasses.map(g => (
            <div
              key={g.id}
              onClick={() => setSelectedGlassesId(g.id)}
              className={`cursor-pointer rounded-2xl p-2 border transition-all flex flex-col items-center group ${
                selectedGlassesId === g.id
                  ? 'bg-indigo-650/10 border-indigo-500 shadow-lg'
                  : 'bg-slate-950/20 border-slate-850/60 hover:border-slate-800'
              }`}
            >
              <div className="w-16 h-12 rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden mb-2">
                <img
                  src={g.thumbnail_url || (g.image ? `${API_BASE_URL}${g.image}` : '')}
                  alt={g.name}
                  className="w-full h-full object-contain p-1 transition-transform group-hover:scale-105"
                />
              </div>
              <div className="text-xs font-bold text-white text-center leading-tight">{g.name}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
});

// 5. Saved Bookmarked Looks List Component
const BookmarksSection = React.memo(({
  history,
  handleRestoreLook,
  handleDeleteLook
}) => {
  return (
    <div className="glass-panel rounded-3xl p-6 border border-slate-800 bg-slate-900/10 shadow-2xl relative">
      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <Heart className="w-5 h-5 text-emerald-400 fill-emerald-400/20" />
        Saved Looks / Bookmarks
      </h2>
      
      {history.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-slate-800 rounded-2xl bg-slate-950/10">
          <Bookmark className="w-10 h-10 text-slate-700 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-500">No saved looks yet</p>
          <p className="text-xs text-slate-600 mt-0.5">Select a selfie, configure hair & style, click "Generate" then "Bookmark" to save here.</p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 pt-1">
          {history.map(look => (
            <div
              key={look.id}
              onClick={() => handleRestoreLook(look)}
              className="flex-shrink-0 w-36 bg-slate-950/40 border border-slate-850/60 hover:border-slate-850 rounded-2xl p-2.5 cursor-pointer relative group transition-all hover:bg-slate-950/80 shadow-md"
            >
              {/* Delete Bookmark Icon */}
              <button
                type="button"
                onClick={(e) => handleDeleteLook(look.id, e)}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-450 hover:text-slate-950 opacity-0 group-hover:opacity-100 transition-opacity z-10"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Composite Preview Image */}
              <div className="w-full aspect-[3/4] rounded-xl overflow-hidden bg-slate-900 border border-slate-800 mb-2">
                <img
                  src={look.generated_image_url}
                  alt="Saved Look"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Description details */}
              <div className="text-xxs text-slate-405 leading-normal truncate font-bold">
                {look.hairstyle_details?.name || 'No Hair'}
              </div>
              <div className="text-[9px] text-slate-500 leading-none mt-1 truncate">
                Color: {look.selected_color || 'Original'}
              </div>
              <div className="text-[8px] text-slate-600 mt-1">
                {new Date(look.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

const VirtualTryOn = () => {
  const location = useLocation();

  // Lists data
  const [selfies, setSelfies] = useState([]);
  const [hairstyles, setHairstyles] = useState([]);
  const [beards, setBeards] = useState([]);
  const [glasses, setGlasses] = useState([]);
  const [history, setHistory] = useState([]);

  // Selections
  const [selectedSelfieId, setSelectedSelfieId] = useState('');
  const [selectedSelfie, setSelectedSelfie] = useState(null);
  const [faceShape, setFaceShape] = useState('');
  const [landmarks, setLandmarks] = useState(null);

  const [selectedHairstyleId, setSelectedHairstyleId] = useState('');
  const [selectedBeardId, setSelectedBeardId] = useState('');
  const [selectedGlassesId, setSelectedGlassesId] = useState('');
  const [selectedColor, setSelectedColor] = useState('Original');

  // Skip redundant rendering API call when restoring bookmarks
  const isRestoringRef = useRef(false);

  // Interactive slider compare position (0 to 100)
  const [sliderPos, setSliderPos] = useState(50);
  const [isSliding, setIsSliding] = useState(false);
  const sliderRef = useRef(null);

  // States
  const [activeTab, setActiveTab] = useState('hairstyles'); // hairstyles | beards | glasses | colors
  const [faceShapeFilter, setFaceShapeFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [error, setError] = useState('');
  const [currentResult, setCurrentResult] = useState(null); // TryOnHistory object representing current render
  
  // Live Try-On Mode integrations
  const [tryOnMode, setTryOnMode] = useState('static'); // 'static' | 'live'
  const [videoElement, setVideoElement] = useState(null);
  const canvasRef = useRef(null);
  const faceTrackerRef = useRef(null);
  const canvasRendererRef = useRef(null);
  const [showMesh, setShowMesh] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(1.0);
  const [overlayScale, setOverlayScale] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const getFullAssetUrl = useCallback((path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${API_BASE_URL}${path}`;
  }, [API_BASE_URL]);

  // Memoized handlers and toggles
  const toggleMirror = useCallback(() => setIsMirrored(prev => !prev), []);
  const toggleFullscreen = useCallback(() => setIsFullscreen(prev => !prev), []);

  const handleOpacityChange = useCallback((e) => {
    setOverlayOpacity(parseFloat(e.target.value));
  }, []);

  const handleScaleChange = useCallback((e) => {
    setOverlayScale(parseFloat(e.target.value));
  }, []);

  const handleSelectHairstyle = useCallback((id) => {
    setSelectedHairstyleId(id);
  }, []);

  const handleSelectBeard = useCallback((id) => {
    setSelectedBeardId(id);
  }, []);

  const handleSelectGlasses = useCallback((id) => {
    setSelectedGlassesId(id);
  }, []);

  const handleSelectColor = useCallback((name) => {
    setSelectedColor(name);
  }, []);

  const handleSelectTab = useCallback((tab) => {
    setActiveTab(tab);
  }, []);

  const handleSelectFaceShapeFilter = useCallback((shape) => {
    setFaceShapeFilter(shape);
  }, []);

  // Initialize and run Live Tracker / Renderer
  useEffect(() => {
    if (tryOnMode === 'live' && videoElement && canvasRef.current) {
      console.log('[VirtualTryOn] Setting up Live Tracker and CanvasRenderer...');
      const tracker = new FaceTracker({ alpha: 0.45 });
      const renderer = new CanvasRenderer(canvasRef.current, videoElement);
      
      faceTrackerRef.current = tracker;
      canvasRendererRef.current = renderer;

      const runTracking = async () => {
        try {
          // Preload any active selections
          const hs = hairstyles.find(h => h.id === parseInt(selectedHairstyleId));
          const bd = beards.find(b => b.id === parseInt(selectedBeardId));
          const gl = glasses.find(g => g.id === parseInt(selectedGlassesId));

          await Promise.all([
            renderer.setAsset('hair', hs ? getFullAssetUrl(hs.image) : null),
            renderer.setAsset('beard', bd ? getFullAssetUrl(bd.image) : null),
            renderer.setAsset('glasses', gl ? getFullAssetUrl(gl.image) : null)
          ]);
          
          renderer.setOptions({
            hairColor: selectedColor,
            showMesh: showMesh,
            isMirrored: isMirrored,
            hairOptions: { opacity: overlayOpacity, customScale: overlayScale },
            beardOptions: { opacity: overlayOpacity, scale: overlayScale },
            glassesOptions: { opacity: overlayOpacity, scale: overlayScale }
          });

          // Start loop
          await tracker.start(videoElement, (telemetry) => {
            renderer.updateTelemetry(telemetry);
          });
          
          renderer.start();
        } catch (err) {
          console.error('[VirtualTryOn] Error starting live tracking:', err);
          setError('Failed to start real-time face tracking service.');
        }
      };

      runTracking();

      return () => {
        console.log('[VirtualTryOn] Cleaning up Live Tracker and CanvasRenderer...');
        tracker.stop();
        renderer.stop();
        faceTrackerRef.current = null;
        canvasRendererRef.current = null;
      };
    }
  }, [tryOnMode, videoElement]);

  // Synchronize assets dynamically on selections change
  useEffect(() => {
    if (tryOnMode === 'live' && canvasRendererRef.current) {
      const hs = hairstyles.find(h => h.id === parseInt(selectedHairstyleId));
      const bd = beards.find(b => b.id === parseInt(selectedBeardId));
      const gl = glasses.find(g => g.id === parseInt(selectedGlassesId));

      canvasRendererRef.current.setAsset('hair', hs ? getFullAssetUrl(hs.image) : null);
      canvasRendererRef.current.setAsset('beard', bd ? getFullAssetUrl(bd.image) : null);
      canvasRendererRef.current.setAsset('glasses', gl ? getFullAssetUrl(gl.image) : null);
    }
  }, [selectedHairstyleId, selectedBeardId, selectedGlassesId, hairstyles, beards, glasses, tryOnMode, getFullAssetUrl]);

  // Synchronize color options dynamically
  useEffect(() => {
    if (tryOnMode === 'live' && canvasRendererRef.current) {
      canvasRendererRef.current.setOptions({ hairColor: selectedColor });
    }
  }, [selectedColor, tryOnMode]);

  // Synchronize showMesh option dynamically
  useEffect(() => {
    if (tryOnMode === 'live' && canvasRendererRef.current) {
      canvasRendererRef.current.setOptions({ showMesh: showMesh });
    }
  }, [showMesh, tryOnMode]);

  // Synchronize options (mirror, opacity, scale) dynamically
  useEffect(() => {
    if (tryOnMode === 'live' && canvasRendererRef.current) {
      canvasRendererRef.current.setOptions({
        isMirrored: isMirrored,
        hairOptions: { opacity: overlayOpacity, customScale: overlayScale },
        beardOptions: { opacity: overlayOpacity, scale: overlayScale },
        glassesOptions: { opacity: overlayOpacity, scale: overlayScale }
      });
    }
  }, [isMirrored, overlayOpacity, overlayScale, tryOnMode]);

  const handleResetLiveTryOn = useCallback(() => {
    setSelectedHairstyleId('');
    setSelectedBeardId('');
    setSelectedGlassesId('');
    setSelectedColor('Original');
    setOverlayOpacity(1.0);
    setOverlayScale(1.0);
    setShowMesh(false);
  }, []);

  // Capture canvas image and bookmark it
  const handleCaptureLiveSnapshot = useCallback(async () => {
    if (tryOnMode !== 'live' || !canvasRef.current) return;

    setGenerating(true);
    setError('');
    try {
      const blob = await new Promise(resolve => canvasRef.current.toBlob(resolve, 'image/jpeg', 0.95));
      if (!blob) throw new Error('Failed to capture snapshot.');

      const file = new File([blob], `live_look_${Date.now()}.jpg`, { type: 'image/jpeg' });

      // Upload capture image to server
      const uploadRes = await uploadImage(file);
      const newImageId = uploadRes.image_id;

      // Save composition result to history bookmarks
      const response = await runVirtualTryOn({
        image_id: newImageId,
        hairstyle_id: selectedHairstyleId ? parseInt(selectedHairstyleId) : null,
        beard_id: selectedBeardId ? parseInt(selectedBeardId) : null,
        glasses_id: selectedGlassesId ? parseInt(selectedGlassesId) : null,
        hair_color: selectedColor === 'Original' ? '' : selectedColor.toLowerCase()
      });

      setCurrentResult(response);
      
      // Refresh bookmarks list
      const historyData = await getTryOnHistory();
      setHistory(historyData);
    } catch (err) {
      console.error('[VirtualTryOn] Failed to capture live snapshot:', err);
      setError('Failed to save look to bookmarks.');
    } finally {
      setGenerating(false);
    }
  }, [selectedHairstyleId, selectedBeardId, selectedGlassesId, selectedColor, tryOnMode]);

  const handleDownloadLiveSnapshot = useCallback(() => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.href = canvasRef.current.toDataURL('image/jpeg', 0.95);
    link.download = `faceaura_live_tryon_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  // Initial load
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      setError('');
      try {
        const [imagesData, hsData, beardsData, glassesData, historyData] = await Promise.all([
          getImages(),
          getHairstyles(),
          getBeards(),
          getGlasses(),
          getTryOnHistory()
        ]);

        // Filter images that have completed uploading
        const completedSelfies = imagesData.filter(img => img.status === 'completed');
        setSelfies(completedSelfies);

        setHairstyles(hsData);
        setBeards(beardsData);
        setGlasses(glassesData);
        setHistory(historyData);

        // Select the first selfie if available
        if (completedSelfies.length > 0) {
          setSelectedSelfieId(completedSelfies[0].id);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load virtual try-on assets. Make sure backend service is active.');
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  // Handle restoring selections from history / favorites navigation state
  useEffect(() => {
    if (location.state?.restoreLook) {
      const look = location.state.restoreLook;
      
      isRestoringRef.current = true;
      
      setSelectedSelfieId(look.original_image);
      setSelectedHairstyleId(look.selected_hairstyle || '');
      setSelectedBeardId(look.selected_beard || '');
      setSelectedGlassesId(look.selected_glasses || '');
      
      const matchedColor = colors.find(c => c.name.toLowerCase() === (look.selected_color || '').toLowerCase());
      setSelectedColor(matchedColor ? matchedColor.name : 'Original');

      // Clear navigation state to prevent re-restoring on subsequent re-renders/refreshes
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Fetch face analysis detail when selfie is selected (Auto-analyzes if shape/landmarks are missing)
  useEffect(() => {
    if (!selectedSelfieId) {
      setSelectedSelfie(null);
      setFaceShape('');
      setLandmarks(null);
      return;
    }

    const selfie = selfies.find(s => s.id === parseInt(selectedSelfieId));
    setSelectedSelfie(selfie);
    setCurrentResult(null); // Clear previous generated output

    const fetchAnalysis = async () => {
      try {
        const analysis = await getAnalysisResult(selectedSelfieId);
        if (analysis && analysis.landmarks) {
          setFaceShape(analysis.face_shape || '');
          setLandmarks(analysis.landmarks);
          // Set recommendation filter by default to user's face shape
          if (analysis.face_shape) {
            setFaceShapeFilter(analysis.face_shape);
          } else {
            setFaceShapeFilter('All');
          }
        } else {
          // Analysis exists but is incomplete (missing landmarks)
          triggerAutoAnalysis();
        }
      } catch (err) {
        console.warn('Face shape analysis record not found for this selfie, running background analysis...', err);
        triggerAutoAnalysis();
      }
    };

    const triggerAutoAnalysis = async () => {
      setGenerating(true);
      setError('');
      try {
        // Automatically run face landmarks extraction
        await detectFace(selectedSelfieId);
        // Automatically run face shape detection
        await detectFaceShape(selectedSelfieId);
        
        // Retrieve newly generated analysis
        const newAnalysis = await getAnalysisResult(selectedSelfieId);
        if (newAnalysis && newAnalysis.landmarks) {
          setFaceShape(newAnalysis.face_shape || '');
          setLandmarks(newAnalysis.landmarks);
          if (newAnalysis.face_shape) {
            setFaceShapeFilter(newAnalysis.face_shape);
          }
        } else {
          setError('Failed to extract facial landmarks. Try again with a clearer front-facing headshot photo.');
        }
      } catch (autoErr) {
        console.error('Automatic landmarks analysis failed:', autoErr);
        setError('Face shape analysis is required. Please click "Analyze Shape" below to process.');
      } finally {
        setGenerating(false);
      }
    };

    fetchAnalysis();
  }, [selectedSelfieId, selfies]);

  // Auto-generate try-on composite whenever user changes any configuration setting
  useEffect(() => {
    if (!selectedSelfieId || !landmarks) return;

    // Check if this was triggered by a bookmark restore; if so, skip request
    if (isRestoringRef.current) {
      isRestoringRef.current = false;
      return;
    }

    // If all selection parameters are cleared, clear the composite and display original selfie
    if (!selectedHairstyleId && !selectedBeardId && !selectedGlassesId && selectedColor === 'Original') {
      setCurrentResult(null);
      return;
    }

    const autoGenerateTryOn = async () => {
      setGenerating(true);
      setError('');
      try {
        const response = await runVirtualTryOn({
          image_id: selectedSelfieId,
          hairstyle_id: selectedHairstyleId || null,
          beard_id: selectedBeardId || null,
          glasses_id: selectedGlassesId || null,
          hair_color: selectedColor === 'Original' ? '' : selectedColor.toLowerCase()
        });
        setCurrentResult(response);
      } catch (err) {
        console.error('Real-time virtual try-on render failed:', err);
        const errMsg = err.response?.data?.error || err.response?.data?.message || 'Try-on rendering failed.';
        setError(errMsg);
      } finally {
        setGenerating(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      autoGenerateTryOn();
    }, 400);

    return () => clearTimeout(debounceTimer);
  }, [selectedHairstyleId, selectedBeardId, selectedGlassesId, selectedColor, selectedSelfieId, landmarks]);

  // Handle Before/After slider move
  const handleMove = (clientX) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(0, Math.min(100, x)));
  };

  const handleTouchMove = (e) => {
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX);
    }
  };

  const handleMouseMove = (e) => {
    if (e.buttons === 1 || isSliding) {
      handleMove(e.clientX);
    }
  };

  // Manual generation backup trigger
  const handleGenerate = async () => {
    if (!selectedSelfieId) {
      setError('Please select a selfie image first.');
      return;
    }
    if (!landmarks) {
      setError('Face shape analysis has not been run on this selfie. Run face shape analysis first.');
      return;
    }
    if (!selectedHairstyleId && !selectedBeardId && !selectedGlassesId && selectedColor === 'Original') {
      setError('Please choose at least one overlay or hair color to perform try-on.');
      return;
    }

    setGenerating(true);
    setError('');
    try {
      const response = await runVirtualTryOn({
        image_id: selectedSelfieId,
        hairstyle_id: selectedHairstyleId || null,
        beard_id: selectedBeardId || null,
        glasses_id: selectedGlassesId || null,
        hair_color: selectedColor === 'Original' ? '' : selectedColor.toLowerCase()
      });

      setCurrentResult(response);
      setSliderPos(50); // reset slider to center

      // Refresh try-on history gallery
      const historyData = await getTryOnHistory();
      setHistory(historyData);
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Try-on generation failed. Please try again.';
      setError(errMsg);
    } finally {
      setGenerating(false);
    }
  };

  // Restore saved look selection from bookmarks
  const handleRestoreLook = useCallback((look) => {
    isRestoringRef.current = true;

    // Select original selfie
    setSelectedSelfieId(look.original_image);
    setSelectedHairstyleId(look.selected_hairstyle || '');
    setSelectedBeardId(look.selected_beard || '');
    setSelectedGlassesId(look.selected_glasses || '');
    
    // Find matching color
    const matchedColor = colors.find(c => c.name.toLowerCase() === (look.selected_color || '').toLowerCase());
    setSelectedColor(matchedColor ? matchedColor.name : 'Original');

    // Display the saved generated look directly
    setCurrentResult(look);
    setSliderPos(50);
  }, []);

  // Delete look from history
  const handleDeleteLook = useCallback(async (id, e) => {
    e.stopPropagation(); // Avoid triggering restoration
    if (!confirm('Are you sure you want to delete this look from bookmarks?')) return;

    try {
      await deleteTryOnHistory(id);
      setHistory(prev => prev.filter(item => item.id !== id));
      setCurrentResult(prev => (prev && prev.id === id) ? null : prev);
    } catch (err) {
      console.error(err);
      setError('Failed to delete saved look.');
    }
  }, []);

  // Download look
  const handleDownload = useCallback(() => {
    if (!currentResult || !currentResult.generated_image_url) return;
    
    const imageUrl = currentResult.generated_image_url;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `faceaura_tryon_${currentResult.id || Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [currentResult]);

  // Filter hairstyles based on face shape selection
  const filteredHairstyles = useMemo(() => {
    return hairstyles.filter(hs => {
      if (faceShapeFilter === 'All') return true;
      return hs.face_shape.toLowerCase() === faceShapeFilter.toLowerCase() || hs.face_shape.toLowerCase() === 'all';
    });
  }, [hairstyles, faceShapeFilter]);

  const getFullSelfieUrl = () => {
    if (!selectedSelfie || !selectedSelfie.image) return '';
    if (selectedSelfie.image.startsWith('http')) return selectedSelfie.image;
    return `${API_BASE_URL}${selectedSelfie.image}`;
  };

  if (loading) {
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center text-white p-6">
        <div className="relative flex items-center justify-center mb-6">
          <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          <Sparkles className="absolute w-6 h-6 text-indigo-400 animate-pulse" />
        </div>
        <p className="text-slate-400 font-semibold text-lg animate-pulse">Loading Try-On Engine & Assets...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 text-slate-200">
      
      {/* Title Header with Glowing Background */}
      <div className="relative mb-8 text-center sm:text-left">
        <div className="absolute -top-10 left-1/3 w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            AI Virtual Try-On Engine
          </span>
          <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-850 text-xs font-bold shadow-inner">
            <button
              type="button"
              onClick={() => setTryOnMode('static')}
              className={`px-4 py-2 rounded-xl transition-all ${
                tryOnMode === 'static'
                  ? 'bg-indigo-650 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Static Image
            </button>
            <button
              type="button"
              onClick={() => setTryOnMode('live')}
              className={`px-4 py-2 rounded-xl transition-all ${
                tryOnMode === 'live'
                  ? 'bg-indigo-650 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Live Camera
            </button>
          </div>
        </h1>
        <p className="mt-2 text-slate-400 text-sm max-w-2xl">
          Instantly overlay realistic hairstyles, beards, and premium eyewear products onto your selfies. Experiment with different hair color highlights utilizing precise biometrical face mesh alignment.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-950/20 border border-rose-900/30 rounded-2xl text-rose-300 flex items-center gap-3 text-sm max-w-4xl mx-auto">
          <Info className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Left Preview, Right Panel Configurator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-10">
        
        {/* Left Column: Image Canvas & Comparison Slider */}
        <div className="lg:col-span-7 space-y-5">
          <div className="glass-panel rounded-3xl p-4 sm:p-6 border border-slate-850/80 bg-slate-950/30 relative flex flex-col items-center select-none shadow-2xl">
            
            {/* Ambient indicator lights */}
            <div className="absolute top-4 left-4 flex items-center gap-2 text-xs font-semibold text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
              <span>HD Composition Output</span>
            </div>

            {/* Selfie Selector Dropdown */}
            {tryOnMode === 'static' && (
              <div className="w-full mt-10 mb-4 flex flex-col sm:flex-row items-center gap-3">
                <label className="text-sm font-semibold text-slate-300 flex-shrink-0 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-indigo-400" /> Choose Selfie:
                </label>
                <select
                  value={selectedSelfieId}
                  onChange={(e) => setSelectedSelfieId(e.target.value)}
                  className="w-full sm:w-auto flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium text-white focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
                >
                  {selfies.length === 0 ? (
                    <option value="">No completed uploads found</option>
                  ) : (
                    selfies.map((s, idx) => (
                      <option key={s.id} value={s.id}>
                        Selfie #{s.id} (Uploaded {new Date(s.uploaded_at).toLocaleDateString()})
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            {/* Canvas Area */}
            <div 
              ref={tryOnMode === 'static' ? sliderRef : null}
              onMouseMove={tryOnMode === 'static' ? handleMouseMove : null}
              onTouchMove={tryOnMode === 'static' ? handleTouchMove : null}
              onMouseDown={tryOnMode === 'static' ? () => setIsSliding(true) : null}
              onMouseUp={tryOnMode === 'static' ? () => setIsSliding(false) : null}
              onMouseLeave={tryOnMode === 'static' ? () => setIsSliding(false) : null}
              className={
                isFullscreen 
                  ? "fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-6 md:p-12 animate-fade-in"
                  : `w-full aspect-[3/4] max-h-[500px] overflow-hidden rounded-2xl border border-slate-850 bg-slate-950 flex items-center justify-center relative select-none ${
                      tryOnMode === 'static' ? 'cursor-ew-resize' : 'mt-10'
                    }`
              }
            >
              {tryOnMode === 'live' ? (
                <div className={isFullscreen ? "w-full max-w-md aspect-[3/4] relative rounded-3xl border border-slate-850 overflow-hidden shadow-2xl" : "w-full h-full relative"}>
                  <canvas 
                    ref={canvasRef} 
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Floating HUD Toolbar Overlay */}
                  <FloatingHUDToolbar
                    isMirrored={isMirrored}
                    setIsMirrored={toggleMirror}
                    isFullscreen={isFullscreen}
                    setIsFullscreen={toggleFullscreen}
                    handleDownloadLiveSnapshot={handleDownloadLiveSnapshot}
                    handleResetLiveTryOn={handleResetLiveTryOn}
                  />

                  <div style={{ display: 'none' }}>
                    <Camera 
                      autoStart={true} 
                      onVideoReady={(el) => setVideoElement(el)} 
                    />
                  </div>
                </div>
              ) : selectedSelfie ? (
                currentResult && currentResult.generated_image_url ? (
                  // Before/After Slider Mode
                  <div className="relative w-full h-full">
                    {/* Background: Original Selfie */}
                    <img
                      src={getFullSelfieUrl()}
                      alt="Original"
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                    />

                    {/* Foreground: TryOn Composite, clipped based on slider position */}
                    <div 
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      style={{
                        clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`
                      }}
                    >
                      <img
                        src={currentResult.generated_image_url}
                        alt="Try On Composite"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Slider boundary divider line & central handle */}
                    <div 
                      className="absolute top-0 bottom-0 w-1 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)] pointer-events-none"
                      style={{ left: `${sliderPos}%` }}
                    >
                      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-indigo-600 border border-white flex items-center justify-center shadow-lg pointer-events-none">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                        </svg>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Normal View Mode: shows original selfie
                  <img
                    src={getFullSelfieUrl()}
                    alt="Original Selfie"
                    className="w-full h-full object-cover"
                  />
                )
              ) : (
                <div className="text-center p-8 text-slate-500">
                  <ImageIcon className="w-16 h-16 text-slate-700 mx-auto mb-3 animate-pulse" />
                  <p className="text-sm font-semibold">No selfie selected</p>
                  <Link to="/upload" className="text-xs text-indigo-400 hover:underline mt-2 inline-block">
                    Go upload a selfie first →
                  </Link>
                </div>
              )}

              {generating && (
                <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center text-white z-20">
                  <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                  <p className="text-sm font-bold tracking-wide animate-pulse">Running Face Alignment...</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-[200px] text-center">Transforming & blending layers in real-time</p>
                </div>
              )}
            </div>

            {/* Fine-Tuning Sliders (Opacity & Scale) */}
            {tryOnMode === 'live' && (
              <TuningSliders
                overlayOpacity={overlayOpacity}
                setOverlayOpacity={handleOpacityChange}
                overlayScale={overlayScale}
                setOverlayScale={handleScaleChange}
              />
            )}

            {/* Warnings & Diagnostic Banner */}
            {tryOnMode === 'static' && selectedSelfie && (
              <div className="w-full mt-4 p-3.5 bg-slate-900/60 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs leading-relaxed">
                <div className="flex items-center gap-2">
                  <Smile className="w-4 h-4 text-indigo-400" />
                  <span>
                    {faceShape ? (
                      <>
                        Detected Face Shape: <strong className="text-indigo-400">{faceShape}</strong>
                      </>
                    ) : (
                      <span className="text-amber-400">Face Shape analysis has not been run.</span>
                    )}
                  </span>
                </div>
                {!faceShape && (
                  <Link
                    to={`/face-analysis/${selectedSelfieId}`}
                    className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline flex items-center gap-0.5"
                  >
                    Analyze Shape <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            )}

            {/* Slider comparison text instruction */}
            {tryOnMode === 'static' && currentResult && (
              <p className="text-xxs text-slate-500 mt-3 flex items-center gap-1">
                <Info className="w-3 h-3 text-indigo-500/70" /> Hover and slide mouse/touch over canvas to view Before & After split.
              </p>
            )}

            {/* Action Control Buttons */}
            <div className="w-full mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {tryOnMode === 'live' ? (
                <>
                  <button
                    onClick={() => setShowMesh(!showMesh)}
                    className={`py-3 px-4 border font-semibold rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${
                      showMesh 
                        ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-400' 
                        : 'bg-slate-900 border-slate-800 hover:bg-slate-850 text-slate-350'
                    }`}
                  >
                    {showMesh ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {showMesh ? 'Hide Face Mesh' : 'Show Face Mesh'}
                  </button>

                  <button
                    onClick={handleDownloadLiveSnapshot}
                    className="py-3 px-4 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-300 font-semibold rounded-2xl active:scale-[0.98] transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download Snapshot
                  </button>

                  <button
                    onClick={handleCaptureLiveSnapshot}
                    disabled={generating}
                    className="py-3 px-4 bg-gradient-to-r from-indigo-650 to-violet-650 hover:from-indigo-550 hover:to-violet-550 disabled:from-slate-850 disabled:to-slate-900 text-white font-bold rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10"
                  >
                    <Bookmark className="w-4 h-4 text-emerald-400" />
                    Bookmark Look
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleGenerate}
                    disabled={generating || !selectedSelfie || !landmarks}
                    className="py-3 px-4 bg-gradient-to-r from-indigo-650 to-violet-650 hover:from-indigo-550 hover:to-violet-550 disabled:from-slate-800 disabled:to-slate-850 text-white font-bold rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10"
                  >
                    <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                    Generate Try-On
                  </button>

                  <button
                    onClick={handleDownload}
                    disabled={!currentResult || generating}
                    className="py-3 px-4 bg-slate-900 border border-slate-800 hover:bg-slate-850 disabled:bg-slate-950/20 disabled:border-slate-900 disabled:text-slate-650 text-slate-300 font-semibold rounded-2xl active:scale-[0.98] transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download Look
                  </button>

                  <button
                    onClick={() => {
                      if (currentResult) {
                        alert('Look already saved to Bookmarks! You can access it in the gallery below.');
                      }
                    }}
                    disabled={!currentResult || generating}
                    className="py-3 px-4 bg-slate-900 border border-slate-800 hover:bg-slate-850 disabled:bg-slate-950/20 disabled:border-slate-900 disabled:text-slate-650 text-slate-300 font-semibold rounded-2xl active:scale-[0.98] transition-colors flex items-center justify-center gap-2"
                  >
                    <Bookmark className="w-4 h-4 text-emerald-400" />
                    Bookmark Look
                  </button>
                </>
              )}
            </div>

          </div>
        </div>

        {/* Right Column: Style Configurator Panel */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel rounded-3xl p-6 border border-slate-800/80 bg-slate-900/20 shadow-2xl relative">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
              Configure Assets
            </h2>

            {/* Navigation Tabs */}
            <div className="flex bg-slate-950/80 p-1 rounded-2xl mb-6 border border-slate-850">
              <button
                onClick={() => setActiveTab('hairstyles')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex flex-col items-center gap-1 ${
                  activeTab === 'hairstyles'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Scissors className="w-4 h-4" />
                Hairstyles
              </button>

              <button
                onClick={() => setActiveTab('beards')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex flex-col items-center gap-1 ${
                  activeTab === 'beards'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <User className="w-4 h-4" />
                Beards
              </button>

              <button
                onClick={() => setActiveTab('glasses')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex flex-col items-center gap-1 ${
                  activeTab === 'glasses'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Glasses className="w-4 h-4" />
                Glasses
              </button>

              <button
                onClick={() => setActiveTab('colors')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex flex-col items-center gap-1 ${
                  activeTab === 'colors'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                Colors
              </button>
            </div>
            {/* Content Tabs Area */}
            <div className="min-h-[280px]">
              {activeTab !== 'colors' ? (
                <AssetSelectorGrid
                  activeTab={activeTab}
                  faceShapeFilter={faceShapeFilter}
                  setFaceShapeFilter={handleSelectFaceShapeFilter}
                  faceShape={faceShape}
                  filteredHairstyles={filteredHairstyles}
                  selectedHairstyleId={selectedHairstyleId}
                  setSelectedHairstyleId={handleSelectHairstyle}
                  beards={beards}
                  selectedBeardId={selectedBeardId}
                  setSelectedBeardId={handleSelectBeard}
                  glasses={glasses}
                  selectedGlassesId={selectedGlassesId}
                  setSelectedGlassesId={handleSelectGlasses}
                  API_BASE_URL={API_BASE_URL}
                />
              ) : (
                <ColorSelector
                  selectedColor={selectedColor}
                  setSelectedColor={handleSelectColor}
                  colors={colors}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <BookmarksSection
        history={history}
        handleRestoreLook={handleRestoreLook}
        handleDeleteLook={handleDeleteLook}
      />
    </div>
  );
};

export default VirtualTryOn;
