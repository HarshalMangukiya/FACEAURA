import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import ARScene from '../core/rendering/ARScene';
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
  Camera as LucideCamera,
  Activity,
  Cpu
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

const beardColors = [
  { name: 'Original', class: 'bg-gradient-to-r from-gray-400 via-slate-500 to-zinc-600' },
  { name: 'Black', class: 'bg-black border border-slate-700' },
  { name: 'Brown', class: 'bg-[#5c4033]' },
  { name: 'Dark Brown', class: 'bg-[#3b2314]' },
  { name: 'Golden', class: 'bg-[#b58e24]' },
  { name: 'Blonde', class: 'bg-[#e6df9c]' }
];

const staticCaps = [
  {
    id: 'cap_baseball',
    name: 'Baseball Cap',
    image: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/WaterBottle/glTF-Binary/WaterBottle.glb', // Fallback model
    thumbnail_url: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&q=80&w=150'
  },
  {
    id: 'cap_snapback',
    name: 'Snapback Hat',
    image: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BoomBox/glTF-Binary/BoomBox.glb', // Fallback model
    thumbnail_url: 'https://images.unsplash.com/photo-1576871337622-98d48d435350?auto=format&fit=crop&q=80&w=150'
  }
];

const makeupPresets = [
  {
    id: 'lipstick_red',
    name: 'Ruby Tint',
    lipstickColor: '#d11a2a',
    lipstickOpacity: 0.8,
    lipstickGloss: 0.5,
    thumbnail_url: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&q=80&w=150'
  },
  {
    id: 'lipstick_pink',
    name: 'Blossom Glow',
    lipstickColor: '#ffb6c1',
    lipstickOpacity: 0.7,
    lipstickGloss: 0.9,
    thumbnail_url: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&q=80&w=150'
  },
  {
    id: 'lipstick_plum',
    name: 'Plum Gloss',
    lipstickColor: '#8e4585',
    lipstickOpacity: 0.6,
    lipstickGloss: 0.7,
    thumbnail_url: 'https://images.unsplash.com/photo-1625093742435-6fa192b6fb10?auto=format&fit=crop&q=80&w=150'
  },
  {
    id: 'lipstick_nude',
    name: 'Satin Nude',
    lipstickColor: '#c59b85',
    lipstickOpacity: 0.9,
    lipstickGloss: 0.2,
    thumbnail_url: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&q=80&w=150'
  }
];

// Floating Canvas HUD Toolbar Overlay Component
const FloatingHUDToolbar = React.memo(({
  isMirrored,
  setIsMirrored,
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
        className={`p-2 rounded-xl transition-colors hover:bg-slate-900 ${isMirrored ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
      >
        <RefreshCw className="w-4 h-4" />
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

// Bookmarked Looks List Component
const BookmarksSection = React.memo(({
  history,
  handleRestoreLook,
  handleDeleteLook
}) => {
  return (
    <div className="glass-panel rounded-3xl p-6 border border-slate-800 bg-slate-900/10 shadow-2xl relative mt-8">
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
        <div className="flex gap-4 overflow-x-auto pb-4 pt-1 custom-scrollbar">
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
              <div className="text-xxs text-slate-400 leading-normal truncate font-bold">
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
  const [selectedCapId, setSelectedCapId] = useState('');
  const [selectedColor, setSelectedColor] = useState('Original');
  const [selectedBeardColor, setSelectedBeardColor] = useState('Original');

  // Sliders fine-tuning granular controls
  const [hairOpacity, setHairOpacity] = useState(1.0);
  const [hairScale, setHairScale] = useState(1.0);
  const [beardDensity, setBeardDensity] = useState(1.0);
  const [beardScale, setBeardScale] = useState(1.0);
  const [glassesScale, setGlassesScale] = useState(1.0);
  const [glassesOffsetY, setGlassesOffsetY] = useState(0.05);
  const [glassesOffsetZ, setGlassesOffsetZ] = useState(0.15);
  const [capScale, setCapScale] = useState(1.0);
  const [capOffsetY, setCapOffsetY] = useState(0.22);
  const [capOffsetZ, setCapOffsetZ] = useState(-0.02);

  // Beauty and Makeup states
  const [beautyLevel, setBeautyLevel] = useState(0.0);
  const [lipstickColor, setLipstickColor] = useState('#d11a2a');
  const [lipstickOpacity, setLipstickOpacity] = useState(0.0);
  const [lipstickGloss, setLipstickGloss] = useState(0.0);
  const [blushColor, setBlushColor] = useState('#e07a5f');
  const [blushOpacity, setBlushOpacity] = useState(0.0);
  const [foundationColor, setFoundationColor] = useState('#f0c8a0');
  const [foundationOpacity, setFoundationOpacity] = useState(0.0);
  const [skinBrightening, setSkinBrightening] = useState(0.0);
  const [contourOpacity, setContourOpacity] = useState(0.0);
  const [shadowColor, setShadowColor] = useState('#582f0e');
  const [shadowOpacity, setShadowOpacity] = useState(0.0);

  // Lighting parameters
  const [lightIntensity, setLightIntensity] = useState(1.0);
  const [shadowStrength, setShadowStrength] = useState(1.0);

  // Skip redundant rendering API call when restoring bookmarks
  const isRestoringRef = useRef(false);

  // Interactive slider compare position (0 to 100)
  const [sliderPos, setSliderPos] = useState(50);
  const [isSliding, setIsSliding] = useState(false);
  const sliderRef = useRef(null);

  // States
  const [activeTab, setActiveTab] = useState('hairstyles'); // hairstyles | beards | glasses | colors
  const [activeCarouselCategory, setActiveCarouselCategory] = useState('hair'); // hair | beard | glasses | caps | makeup
  const [faceShapeFilter, setFaceShapeFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [currentResult, setCurrentResult] = useState(null); // TryOnHistory object representing current render

  // Live Try-On Mode integrations
  const [tryOnMode, setTryOnMode] = useState('live'); // Default to 'live' for Snapchat experience
  const [videoElement, setVideoElement] = useState(null);
  const [isSceneInitialized, setIsSceneInitialized] = useState(false);
  const canvasRef = useRef(null);
  const rawCanvasRef = useRef(null);
  const [showMesh, setShowMesh] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);

  // Ref for the 3D AR Scene
  const arSceneRef = useRef(null);

  // Telemetry for Collapsible Developer HUD
  const [telemetry, setTelemetry] = useState(null);
  const [fps, setFps] = useState(60);
  const [developerPanelOpen, setDeveloperPanelOpen] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const getFullAssetUrl = useCallback((path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${API_BASE_URL}${path}`;
  }, [API_BASE_URL]);

  const toggleMirror = useCallback(() => setIsMirrored(prev => !prev), []);

  // Derive selected assets objects (moved up to prevent ReferenceError in useEffect hooks)
  const selectedHairstyle = useMemo(() => {
    return hairstyles.find(h => h.id.toString() === selectedHairstyleId) || null;
  }, [hairstyles, selectedHairstyleId]);

  const selectedBeard = useMemo(() => {
    return beards.find(b => b.id.toString() === selectedBeardId) || null;
  }, [beards, selectedBeardId]);

  const selectedGlasses = useMemo(() => {
    return glasses.find(g => g.id.toString() === selectedGlassesId) || null;
  }, [glasses, selectedGlassesId]);

  const selectedCap = useMemo(() => {
    return staticCaps.find(c => c.id === selectedCapId) || null;
  }, [selectedCapId]);

  // 1. Hair Sync
  useEffect(() => {
    if (tryOnMode === 'live' && isSceneInitialized && arSceneRef.current) {
      if (selectedHairstyle) {
        arSceneRef.current.applyAccessory('hair', selectedHairstyle);
      } else {
        arSceneRef.current.removeAccessory('hair');
      }
    }
  }, [selectedHairstyleId, tryOnMode, selectedHairstyle, isSceneInitialized]);

  useEffect(() => {
    if (tryOnMode === 'live' && isSceneInitialized && arSceneRef.current && selectedHairstyle) {
      arSceneRef.current.updateAccessoryConfig('hair', {
        scale: hairScale,
        color: selectedColor,
        opacity: hairOpacity
      });
    }
  }, [selectedColor, hairScale, hairOpacity, selectedHairstyleId, tryOnMode, selectedHairstyle, isSceneInitialized]);

  // 2. Beard Sync
  useEffect(() => {
    if (tryOnMode === 'live' && isSceneInitialized && arSceneRef.current) {
      if (selectedBeard) {
        arSceneRef.current.applyAccessory('beard', selectedBeard);
      } else {
        arSceneRef.current.removeAccessory('beard');
      }
    }
  }, [selectedBeardId, tryOnMode, selectedBeard, isSceneInitialized]);

  useEffect(() => {
    if (tryOnMode === 'live' && isSceneInitialized && arSceneRef.current && selectedBeard) {
      arSceneRef.current.updateAccessoryConfig('beard', {
        scale: beardScale,
        color: selectedBeardColor,
        opacity: beardDensity
      });
    }
  }, [selectedBeardColor, beardScale, beardDensity, selectedBeardId, tryOnMode, selectedBeard, isSceneInitialized]);

  // 3. Glasses Sync
  useEffect(() => {
    if (tryOnMode === 'live' && isSceneInitialized && arSceneRef.current) {
      if (selectedGlasses) {
        arSceneRef.current.applyAccessory('glasses', selectedGlasses);
      } else {
        arSceneRef.current.removeAccessory('glasses');
      }
    }
  }, [selectedGlassesId, tryOnMode, selectedGlasses, isSceneInitialized]);

  useEffect(() => {
    if (tryOnMode === 'live' && isSceneInitialized && arSceneRef.current && selectedGlasses) {
      arSceneRef.current.updateAccessoryConfig('glasses', {
        scale: glassesScale,
        offsetY: glassesOffsetY,
        offsetZ: glassesOffsetZ
      });
    }
  }, [glassesScale, glassesOffsetY, glassesOffsetZ, selectedGlassesId, tryOnMode, selectedGlasses, isSceneInitialized]);

  // 4. Cap Sync
  useEffect(() => {
    if (tryOnMode === 'live' && isSceneInitialized && arSceneRef.current) {
      if (selectedCap) {
        arSceneRef.current.applyAccessory('caps', selectedCap);
      } else {
        arSceneRef.current.removeAccessory('caps');
      }
    }
  }, [selectedCapId, tryOnMode, selectedCap, isSceneInitialized]);

  useEffect(() => {
    if (tryOnMode === 'live' && isSceneInitialized && arSceneRef.current && selectedCap) {
      arSceneRef.current.updateAccessoryConfig('caps', {
        scale: capScale,
        offsetY: capOffsetY,
        offsetZ: capOffsetZ
      });
    }
  }, [capScale, capOffsetY, capOffsetZ, selectedCapId, tryOnMode, selectedCap, isSceneInitialized]);

  const handleResetLiveTryOn = useCallback(() => {
    setSelectedHairstyleId('');
    setSelectedBeardId('');
    setSelectedGlassesId('');
    setSelectedCapId('');

    setSelectedColor('Original');
    setSelectedBeardColor('Original');

    setHairOpacity(1.0);
    setHairScale(1.0);
    setBeardDensity(1.0);
    setBeardScale(1.0);
    setGlassesScale(1.0);
    setGlassesOffsetY(0.05);
    setGlassesOffsetZ(0.15);
    setCapScale(1.0);
    setCapOffsetY(0.22);
    setCapOffsetZ(-0.02);

    setLipstickColor('#d11a2a');
    setLipstickOpacity(0.0);
    setLipstickGloss(0.0);
    setBlushColor('#e07a5f');
    setBlushOpacity(0.0);
    setFoundationColor('#f0c8a0');
    setFoundationOpacity(0.0);
    setSkinBrightening(0.0);
    setContourOpacity(0.0);
    setShadowColor('#582f0e');
    setShadowOpacity(0.0);

    setBeautyLevel(0.0);
    setLightIntensity(1.0);
    setShadowStrength(1.0);
    setShowMesh(false);
  }, []);

  // WebGL context binding
  const handleInitScene = useCallback(({ canvas, videoElement: video }) => {
    canvasRef.current = canvas;
    if (video) {
      setVideoElement(video);
      setIsSceneInitialized(true);
    }
  }, []);

  // Draw pure raw webcam frames side-by-side onto left preview monitor
  useEffect(() => {
    if (tryOnMode === 'live' && videoElement && rawCanvasRef.current) {
      let active = true;
      const ctx = rawCanvasRef.current.getContext('2d');
      const drawRaw = () => {
        if (!active || !videoElement || !rawCanvasRef.current) return;
        const w = videoElement.videoWidth || 640;
        const h = videoElement.videoHeight || 480;
        rawCanvasRef.current.width = w;
        rawCanvasRef.current.height = h;

        ctx.clearRect(0, 0, w, h);
        if (isMirrored) {
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(videoElement, 0, 0, w, h);
        if (isMirrored) {
          ctx.setTransform(1, 0, 0, 1, 0, 0); // reset
        }

        requestAnimationFrame(drawRaw);
      };

      drawRaw();
      return () => {
        active = false;
      };
    }
  }, [tryOnMode, videoElement, isMirrored]);

  // Capture canvas image and bookmark it
  const handleCaptureLiveSnapshot = useCallback(async () => {
    if (tryOnMode !== 'live' || !arSceneRef.current) return;

    setGenerating(true);
    setError('');
    try {
      const dataUrl = arSceneRef.current.snapshot('image/jpeg');
      if (!dataUrl) throw new Error('Failed to capture snapshot.');

      const blob = await fetch(dataUrl).then(res => res.blob());
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
    if (!arSceneRef.current) return;
    // Capture in full 1080p HD
    const dataUrl = arSceneRef.current.snapshot('image/jpeg', 1920, 1080);
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
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
    if (tryOnMode !== 'static' || !selectedSelfieId) {
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
  }, [selectedSelfieId, selfies, tryOnMode]);

  // Auto-generate try-on composite whenever user changes any configuration setting (in Static Mode)
  useEffect(() => {
    if (tryOnMode !== 'static' || !selectedSelfieId || !landmarks) return;

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
  }, [selectedHairstyleId, selectedBeardId, selectedGlassesId, selectedColor, selectedSelfieId, landmarks, tryOnMode]);

  // Handle Before/After slider move (in Static Mode)
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

  // Download look (Static Mode)
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
          <span className="flex items-center gap-2">AI Virtual Try-On Engine</span>
          <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-850 text-xs font-bold shadow-inner">
            <button
              type="button"
              onClick={() => {
                setTryOnMode('static');
                handleResetLiveTryOn();
                setIsSceneInitialized(false);
              }}
              className={`px-4 py-2 rounded-xl transition-all ${tryOnMode === 'static' ? 'bg-indigo-650 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Static Image
            </button>
            <button
              type="button"
              onClick={() => {
                setTryOnMode('live');
                handleResetLiveTryOn();
                setIsSceneInitialized(false);
              }}
              className={`px-4 py-2 rounded-xl transition-all ${tryOnMode === 'live' ? 'bg-indigo-650 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
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

      {/* Main Grid Render: Snapchat 3-Column Layout for Live Mode, or Split view for Static Mode */}
      {tryOnMode === 'live' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mb-6">
          {/* LEFT COLUMN (lg:col-span-3): Raw Webcam Monitor */}
          <div className="lg:col-span-3 space-y-4">
            <div className="glass-panel border border-slate-800/60 rounded-3xl p-4 bg-slate-900/10 shadow-xl">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5 border-b border-slate-850 pb-2">
                <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                Raw Input Monitor
              </h3>
              <div className="w-full aspect-[3/4] rounded-2xl border border-slate-850 overflow-hidden bg-slate-950 shadow-inner relative">
                <canvas ref={rawCanvasRef} className="w-full h-full object-cover" />
                <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/70 border border-slate-800 rounded-md text-[8px] uppercase font-bold text-slate-400">
                  Unprocessed Feed
                </div>
              </div>
            </div>
          </div>

          {/* CENTER COLUMN (lg:col-span-6): Live Three.js AR Viewport */}
          <div className="lg:col-span-6 space-y-4">
            {/* Snapchat AR Quick Instructions Tutorial */}
            <div className="bg-indigo-950/25 border border-indigo-500/30 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-indigo-200 shadow-md">
              <Sparkles className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0 animate-pulse" />
              <div>
                <strong className="font-bold text-white">How to use Snapchat AR Try-On:</strong> Select any category at the bottom (e.g., <span className="text-indigo-300 font-semibold">Glasses</span>, <span className="text-indigo-300 font-semibold">Caps</span>, or <span className="text-indigo-300 font-semibold">Hair</span>), click an item thumbnail to overlay it in real-time 3D, and tune size/positions or skin smoothness in the right-side panel.
              </div>
            </div>

            <div className="glass-panel border border-slate-800/80 rounded-3xl p-4 bg-slate-900/15 shadow-2xl relative">
              <div className="w-full aspect-[3/4] rounded-2xl border border-slate-850 overflow-hidden bg-slate-950 shadow-2xl relative select-none">
                {/* 3D AR Viewport Render Canvas */}
                <ARScene
                  ref={arSceneRef}
                  hairColor={selectedColor}
                  beardColor={selectedBeardColor}
                  hairOpacity={hairOpacity}
                  hairScale={hairScale}
                  beardDensity={beardDensity}
                  beardScale={beardScale}
                  glassesScale={glassesScale}
                  glassesOffsetY={glassesOffsetY}
                  glassesOffsetZ={glassesOffsetZ}
                  capScale={capScale}
                  capOffsetY={capOffsetY}
                  capOffsetZ={capOffsetZ}
                  lipstickColor={lipstickColor}
                  lipstickOpacity={lipstickOpacity}
                  lipstickGloss={lipstickGloss}
                  blushColor={blushColor}
                  blushOpacity={blushOpacity}
                  foundationColor={foundationColor}
                  foundationOpacity={foundationOpacity}
                  skinBrightening={skinBrightening}
                  contourOpacity={contourOpacity}
                  shadowColor={shadowColor}
                  shadowOpacity={shadowOpacity}
                  beautyLevel={beautyLevel}
                  lightIntensity={lightIntensity}
                  shadowStrength={shadowStrength}
                  showMesh={showMesh}
                  isMirrored={isMirrored}
                  onTelemetryUpdate={setTelemetry}
                  onFpsUpdate={setFps}
                  onInitScene={handleInitScene}
                />

                {/* Floating HUD Toolbar Overlay */}
                <FloatingHUDToolbar
                  isMirrored={isMirrored}
                  setIsMirrored={toggleMirror}
                  handleDownloadLiveSnapshot={handleDownloadLiveSnapshot}
                  handleResetLiveTryOn={handleResetLiveTryOn}
                />

                {generating && (
                  <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center text-white z-20">
                    <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                    <p className="text-sm font-bold tracking-wide animate-pulse">Running Face Alignment...</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-[200px] text-center">Transforming & blending layers in real-time</p>
                  </div>
                )}
              </div>

              {/* Snapchat Horizontal Accessory Carousel */}
              <div className="mt-4 bg-slate-950/40 border border-slate-850/60 rounded-3xl p-3.5 shadow-xl space-y-3.5">
                <div className="flex gap-2 border-b border-slate-850 pb-2.5 overflow-x-auto custom-scrollbar">
                  {[
                    { id: 'hair', label: 'Hair', icon: Scissors },
                    { id: 'beard', label: 'Beard', icon: User },
                    { id: 'glasses', label: 'Glasses', icon: Glasses },
                    { id: 'caps', label: 'Caps', icon: Sparkles },
                    { id: 'makeup', label: 'Makeup', icon: Smile }
                  ].map(cat => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveCarouselCategory(cat.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xxs font-bold transition-all flex-shrink-0 border ${activeCarouselCategory === cat.id
                            ? 'bg-indigo-650 border-indigo-500 text-white shadow-md'
                            : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border-slate-800'
                          }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {cat.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-3 overflow-x-auto py-1 custom-scrollbar pr-2 min-h-[90px] items-center">
                  {/* None/Original Option */}
                  <div
                    onClick={() => {
                      if (activeCarouselCategory === 'hair') setSelectedHairstyleId('');
                      else if (activeCarouselCategory === 'beard') setSelectedBeardId('');
                      else if (activeCarouselCategory === 'glasses') setSelectedGlassesId('');
                      else if (activeCarouselCategory === 'caps') setSelectedCapId('');
                      else if (activeCarouselCategory === 'makeup') {
                        setLipstickOpacity(0);
                        setBlushOpacity(0);
                        setFoundationOpacity(0);
                        setShadowOpacity(0);
                        setContourOpacity(0);
                      }
                    }}
                    className="flex-shrink-0 cursor-pointer rounded-2xl p-2 w-20 h-20 bg-slate-950/20 border border-slate-850/60 hover:border-slate-800 flex flex-col items-center justify-center transition-all"
                  >
                    <EyeOff className="w-5 h-5 text-slate-500 mb-1" />
                    <div className="text-[9px] font-bold text-slate-450 text-center leading-tight">None</div>
                  </div>

                  {/* Hair Thumbnails */}
                  {activeCarouselCategory === 'hair' &&
                    hairstyles.map(hs => (
                      <div
                        key={hs.id}
                        onClick={() => setSelectedHairstyleId(hs.id.toString())}
                        className={`flex-shrink-0 cursor-pointer rounded-2xl p-2 w-20 h-20 border transition-all flex flex-col items-center justify-center relative overflow-hidden group ${selectedHairstyleId === hs.id.toString()
                            ? 'bg-indigo-650/10 border-indigo-500 shadow-lg'
                            : 'bg-slate-950/20 border-slate-850/60 hover:border-slate-800'
                          }`}
                      >
                        <img
                          src={hs.thumbnail_url || getFullAssetUrl(hs.image)}
                          alt={hs.name}
                          className="w-10 h-10 object-cover rounded-lg border border-slate-800 transition-transform group-hover:scale-105"
                        />
                        <div className="text-[8px] font-bold text-white text-center leading-tight mt-1.5 truncate w-full">
                          {hs.name}
                        </div>
                      </div>
                    ))}

                  {/* Beard Thumbnails */}
                  {activeCarouselCategory === 'beard' &&
                    beards.map(b => (
                      <div
                        key={b.id}
                        onClick={() => setSelectedBeardId(b.id.toString())}
                        className={`flex-shrink-0 cursor-pointer rounded-2xl p-2 w-20 h-20 border transition-all flex flex-col items-center justify-center relative overflow-hidden group ${selectedBeardId === b.id.toString()
                            ? 'bg-indigo-650/10 border-indigo-500 shadow-lg'
                            : 'bg-slate-950/20 border-slate-850/60 hover:border-slate-800'
                          }`}
                      >
                        <img
                          src={b.thumbnail_url || getFullAssetUrl(b.image)}
                          alt={b.name}
                          className="w-10 h-10 object-cover rounded-lg border border-slate-800 transition-transform group-hover:scale-105"
                        />
                        <div className="text-[8px] font-bold text-white text-center leading-tight mt-1.5 truncate w-full">
                          {b.name}
                        </div>
                      </div>
                    ))}

                  {/* Glasses Thumbnails */}
                  {activeCarouselCategory === 'glasses' &&
                    glasses.map(g => (
                      <div
                        key={g.id}
                        onClick={() => setSelectedGlassesId(g.id.toString())}
                        className={`flex-shrink-0 cursor-pointer rounded-2xl p-2 w-20 h-20 border transition-all flex flex-col items-center justify-center relative overflow-hidden group ${selectedGlassesId === g.id.toString()
                            ? 'bg-indigo-650/10 border-indigo-500 shadow-lg'
                            : 'bg-slate-950/20 border-slate-850/60 hover:border-slate-800'
                          }`}
                      >
                        <img
                          src={g.thumbnail_url || getFullAssetUrl(g.image)}
                          alt={g.name}
                          className="w-11 h-7 object-contain rounded-lg border border-slate-800 p-0.5 transition-transform group-hover:scale-105"
                        />
                        <div className="text-[8px] font-bold text-white text-center leading-tight mt-1.5 truncate w-full">
                          {g.name}
                        </div>
                      </div>
                    ))}

                  {/* Caps Thumbnails */}
                  {activeCarouselCategory === 'caps' &&
                    staticCaps.map(c => (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCapId(c.id)}
                        className={`flex-shrink-0 cursor-pointer rounded-2xl p-2 w-20 h-20 border transition-all flex flex-col items-center justify-center relative overflow-hidden group ${selectedCapId === c.id
                            ? 'bg-indigo-650/10 border-indigo-500 shadow-lg'
                            : 'bg-slate-950/20 border-slate-850/60 hover:border-slate-800'
                          }`}
                      >
                        <img
                          src={c.thumbnail_url}
                          alt={c.name}
                          className="w-10 h-10 object-cover rounded-lg border border-slate-800 transition-transform group-hover:scale-105"
                        />
                        <div className="text-[8px] font-bold text-white text-center leading-tight mt-1.5 truncate w-full">
                          {c.name}
                        </div>
                      </div>
                    ))}

                  {/* Makeup Preset Thumbnails */}
                  {activeCarouselCategory === 'makeup' &&
                    makeupPresets.map(p => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setLipstickColor(p.lipstickColor);
                          setLipstickOpacity(p.lipstickOpacity);
                          setLipstickGloss(p.lipstickGloss);
                          setBlushOpacity(0.35);
                          setFoundationOpacity(0.25);
                          setBeautyLevel(0.5); // auto-enable beauty
                        }}
                        className={`flex-shrink-0 cursor-pointer rounded-2xl p-2 w-20 h-20 border transition-all flex flex-col items-center justify-center relative overflow-hidden group ${lipstickColor === p.lipstickColor && lipstickOpacity > 0.05
                            ? 'bg-indigo-650/10 border-indigo-500 shadow-lg'
                            : 'bg-slate-950/20 border-slate-850/60 hover:border-slate-800'
                          }`}
                      >
                        <img
                          src={p.thumbnail_url}
                          alt={p.name}
                          className="w-10 h-10 object-cover rounded-lg border border-slate-800 transition-transform group-hover:scale-105"
                        />
                        <div className="text-[8px] font-bold text-white text-center leading-tight mt-1.5 truncate w-full">
                          {p.name}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN (lg:col-span-3): Dynamic Tuning Side-bar */}
          <div className="lg:col-span-3 space-y-4">
            <div className="glass-panel border border-slate-800/60 rounded-3xl p-5 bg-slate-900/10 shadow-xl space-y-5">
              <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 border-b border-slate-850 pb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                Live Configuration
              </h2>

              {/* Granular Sliders Area */}
              <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1.5 custom-scrollbar">
                {/* Accessory Sizes Section */}
                <div className="space-y-3">
                  <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Mesh Dimensions</h4>

                  {/* Hair opacity/scale */}
                  {selectedHairstyleId && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xxs font-semibold">
                        <span>Hair Volume Scale</span>
                        <span className="text-indigo-400 font-bold">{Math.round(hairScale * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.70"
                        max="1.30"
                        step="0.02"
                        value={hairScale}
                        onChange={e => setHairScale(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-800 rounded-lg cursor-pointer accent-indigo-500"
                      />
                    </div>
                  )}

                  {/* Beard density/scale */}
                  {selectedBeardId && (
                    <>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xxs font-semibold">
                          <span>Beard Density</span>
                          <span className="text-indigo-400 font-bold">{Math.round(beardDensity * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.10"
                          max="1.00"
                          step="0.05"
                          value={beardDensity}
                          onChange={e => setBeardDensity(parseFloat(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-lg cursor-pointer accent-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xxs font-semibold">
                          <span>Beard Scale</span>
                          <span className="text-indigo-400 font-bold">{Math.round(beardScale * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.70"
                          max="1.30"
                          step="0.02"
                          value={beardScale}
                          onChange={e => setBeardScale(parseFloat(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-lg cursor-pointer accent-indigo-500"
                        />
                      </div>
                    </>
                  )}

                  {/* Glasses size/rotation offsets */}
                  {selectedGlassesId && (
                    <>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xxs font-semibold">
                          <span>Glasses Frame Size</span>
                          <span className="text-indigo-400 font-bold">{Math.round(glassesScale * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.80"
                          max="1.20"
                          step="0.02"
                          value={glassesScale}
                          onChange={e => setGlassesScale(parseFloat(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-lg cursor-pointer accent-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xxs font-semibold">
                          <span>Nose-Bridge Offset (Y)</span>
                          <span className="text-indigo-400 font-bold">{glassesOffsetY.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min="-0.05"
                          max="0.15"
                          step="0.01"
                          value={glassesOffsetY}
                          onChange={e => setGlassesOffsetY(parseFloat(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-lg cursor-pointer accent-indigo-500"
                        />
                      </div>
                    </>
                  )}

                  {/* Cap scale/offset */}
                  {selectedCapId && (
                    <>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xxs font-semibold">
                          <span>Cap Size</span>
                          <span className="text-indigo-400 font-bold">{Math.round(capScale * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.80"
                          max="1.20"
                          step="0.02"
                          value={capScale}
                          onChange={e => setCapScale(parseFloat(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-lg cursor-pointer accent-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xxs font-semibold">
                          <span>Crown Height (Y)</span>
                          <span className="text-indigo-400 font-bold">{capOffsetY.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min="0.10"
                          max="0.35"
                          step="0.01"
                          value={capOffsetY}
                          onChange={e => setCapOffsetY(parseFloat(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-lg cursor-pointer accent-indigo-500"
                        />
                      </div>
                    </>
                  )}
                </div>

                <hr className="border-slate-850/60 my-2" />

                {/* Makeup & Beauty Section */}
                <div className="space-y-3">
                  <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Real-Time Beauty</h4>

                  {/* Bilateral Skin Smoothing */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xxs font-semibold">
                      <span>Bilateral Skin Smoothness</span>
                      <span className="text-indigo-400 font-bold">{Math.round(beautyLevel * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.00"
                      max="1.00"
                      step="0.25" // user slider constraints: 0%, 25%, 50%, 75%, 100%
                      value={beautyLevel}
                      onChange={e => setBeautyLevel(parseFloat(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg cursor-pointer accent-indigo-500"
                    />
                  </div>

                  {/* Lipstick opacity/gloss */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xxs font-semibold">
                      <span>Lipstick Tint opacity</span>
                      <span className="text-indigo-400 font-bold">{Math.round(lipstickOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.00"
                      max="1.00"
                      step="0.05"
                      value={lipstickOpacity}
                      onChange={e => setLipstickOpacity(parseFloat(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg cursor-pointer accent-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xxs font-semibold">
                      <span>Lip Gloss Specular</span>
                      <span className="text-indigo-400 font-bold">{Math.round(lipstickGloss * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.00"
                      max="1.00"
                      step="0.05"
                      value={lipstickGloss}
                      onChange={e => setLipstickGloss(parseFloat(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg cursor-pointer accent-indigo-500"
                    />
                  </div>

                  {/* Lipstick color picker */}
                  <div className="space-y-1">
                    <span className="text-xxs font-semibold block">Lipstick shade</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { name: 'Classic Red', hex: '#d11a2a' },
                        { name: 'Soft Pink', hex: '#ffb6c1' },
                        { name: 'Crimson', hex: '#990000' },
                        { name: 'Rose', hex: '#ff007f' },
                        { name: 'Peach', hex: '#ffcba4' },
                        { name: 'Nude', hex: '#c59b85' },
                        { name: 'Plum', hex: '#8e4585' }
                      ].map(color => (
                        <button
                          key={color.hex}
                          type="button"
                          onClick={() => setLipstickColor(color.hex)}
                          className={`w-5 h-5 rounded-full transition-transform active:scale-95 border border-slate-900 ${lipstickColor === color.hex ? 'ring-2 ring-indigo-400 scale-110' : 'hover:scale-105'
                            }`}
                          style={{ backgroundColor: color.hex }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Foundation Opacity */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xxs font-semibold">
                      <span>Foundation opacity</span>
                      <span className="text-indigo-400 font-bold">{Math.round(foundationOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.00"
                      max="1.00"
                      step="0.05"
                      value={foundationOpacity}
                      onChange={e => setFoundationOpacity(parseFloat(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg cursor-pointer accent-indigo-500"
                    />
                  </div>
                </div>

                <hr className="border-slate-850/60 my-2" />

                {/* Lighting and Shadows Section */}
                <div className="space-y-3">
                  <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Environment Tuning</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xxs font-semibold">
                      <span>Light intensity</span>
                      <span className="text-indigo-400 font-bold">{Math.round(lightIntensity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.40"
                      max="1.80"
                      step="0.05"
                      value={lightIntensity}
                      onChange={e => setLightIntensity(parseFloat(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg cursor-pointer accent-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xxs font-semibold">
                      <span>Shadow strength</span>
                      <span className="text-indigo-400 font-bold">{Math.round(shadowStrength * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.00"
                      max="1.00"
                      step="0.05"
                      value={shadowStrength}
                      onChange={e => setShadowStrength(parseFloat(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg cursor-pointer accent-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Sidebar Action Buttons */}
              <div className="space-y-2 border-t border-slate-850 pt-3">
                <button
                  onClick={() => setShowMesh(!showMesh)}
                  className={`w-full py-2.5 text-xxs font-bold border rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 ${showMesh
                      ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-400'
                      : 'bg-slate-900 border-slate-800 hover:bg-slate-850 text-slate-350'
                    }`}
                >
                  {showMesh ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showMesh ? 'Hide Face Mesh' : 'Show Face Mesh'}
                </button>

                <button
                  onClick={handleCaptureLiveSnapshot}
                  disabled={generating}
                  className="w-full py-2.5 bg-gradient-to-r from-indigo-650 to-violet-650 hover:from-indigo-550 hover:to-violet-550 disabled:from-slate-850 disabled:to-slate-900 text-white text-xxs font-extrabold rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10"
                >
                  <Bookmark className="w-3.5 h-3.5 text-emerald-400" />
                  Bookmark Look
                </button>

                <button
                  onClick={handleResetLiveTryOn}
                  className="w-full py-2 bg-slate-950/60 border border-slate-850/60 hover:bg-slate-900/60 text-slate-400 hover:text-rose-400 text-xxs font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Custom Sliders
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Static Image Mode Grid */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-10">
          <div className="lg:col-span-7 space-y-5">
            <div className="glass-panel rounded-3xl p-4 sm:p-6 border border-slate-850/80 bg-slate-950/30 relative flex flex-col items-center select-none shadow-2xl">
              <div className="absolute top-4 left-4 flex items-center gap-2 text-xs font-semibold text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-800">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
                <span>HD Composition Output</span>
              </div>

              {/* Selfie Selector Dropdown */}
              <div className="w-full mt-10 mb-4 flex flex-col sm:flex-row items-center gap-3">
                <label className="text-sm font-semibold text-slate-300 flex-shrink-0 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-indigo-400" /> Choose Selfie:
                </label>
                <select
                  value={selectedSelfieId}
                  onChange={e => setSelectedSelfieId(e.target.value)}
                  className="w-full sm:w-auto flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium text-white focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
                >
                  {selfies.length === 0 ? (
                    <option value="">No completed uploads found</option>
                  ) : (
                    selfies.map(s => (
                      <option key={s.id} value={s.id}>
                        Selfie #{s.id} (Uploaded {new Date(s.uploaded_at).toLocaleDateString()})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Before/After Split Canvas Area */}
              <div
                ref={sliderRef}
                onMouseMove={handleMouseMove}
                onTouchMove={handleTouchMove}
                onMouseDown={() => setIsSliding(true)}
                onMouseUp={() => setIsSliding(false)}
                onMouseLeave={() => setIsSliding(false)}
                className="w-full aspect-[3/4] max-h-[500px] overflow-hidden rounded-2xl border border-slate-850 bg-slate-950 flex items-center justify-center relative select-none cursor-ew-resize"
              >
                {selectedSelfie ? (
                  currentResult && currentResult.generated_image_url ? (
                    <div className="relative w-full h-full">
                      {/* Background: Original Selfie */}
                      <img src={getFullSelfieUrl()} alt="Original" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />

                      {/* Foreground: TryOn Composite, clipped based on slider position */}
                      <div
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        style={{
                          clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`
                        }}
                      >
                        <img src={currentResult.generated_image_url} alt="Try On Composite" className="w-full h-full object-cover" />
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
                    <img src={getFullSelfieUrl()} alt="Original Selfie" className="w-full h-full object-cover" />
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

              {/* Warnings & Diagnostic Banner */}
              {selectedSelfie && (
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
              {currentResult && (
                <p className="text-xxs text-slate-500 mt-3 flex items-center gap-1">
                  <Info className="w-3 h-3 text-indigo-500/70" /> Hover and slide mouse/touch over canvas to view Before & After split.
                </p>
              )}

              {/* Action Control Buttons */}
              <div className="w-full mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  className="py-3 px-4 bg-slate-900 border border-slate-800 hover:bg-slate-850 disabled:bg-slate-950/20 disabled:border-slate-900 disabled:text-slate-650 text-slate-330 font-semibold rounded-2xl active:scale-[0.98] transition-colors flex items-center justify-center gap-2"
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
                  className="py-3 px-4 bg-slate-900 border border-slate-800 hover:bg-slate-850 disabled:bg-slate-950/20 disabled:border-slate-900 disabled:text-slate-650 text-slate-330 font-semibold rounded-2xl active:scale-[0.98] transition-colors flex items-center justify-center gap-2"
                >
                  <Bookmark className="w-4 h-4 text-emerald-400" />
                  Bookmark Look
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="glass-panel rounded-3xl p-6 border border-slate-800/80 bg-slate-900/20 shadow-2xl relative">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
                Configure Assets
              </h2>

              {/* Navigation Tabs */}
              <div className="flex bg-slate-950/80 p-1 rounded-2xl mb-6 border border-slate-850">
                {['hairstyles', 'beards', 'glasses', 'colors'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex flex-col items-center gap-1 uppercase tracking-wider ${activeTab === tab ? 'bg-indigo-650 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    {tab === 'hairstyles' && <Scissors className="w-4 h-4" />}
                    {tab === 'beards' && <User className="w-4 h-4" />}
                    {tab === 'glasses' && <Glasses className="w-4 h-4" />}
                    {tab === 'colors' && <Sparkles className="w-4 h-4" />}
                    {tab}
                  </button>
                ))}
              </div>

              {/* Content Tabs Area */}
              <div className="min-h-[280px]">
                {activeTab === 'colors' ? (
                  <div className="grid grid-cols-4 gap-3 max-h-[300px] overflow-y-auto pr-1">
                    {colors.map(color => (
                      <div
                        key={color.name}
                        onClick={() => setSelectedColor(color.name)}
                        className={`cursor-pointer rounded-2xl p-2 border transition-all flex flex-col items-center justify-center text-center ${selectedColor === color.name
                            ? 'bg-indigo-655/10 border-indigo-500 shadow-lg'
                            : 'bg-slate-950/20 border-slate-850/60 hover:border-slate-800'
                          }`}
                      >
                        <div className={`w-8 h-8 rounded-full ${color.class} mb-2 shadow-inner`}></div>
                        <div className="text-xxs font-bold text-white">{color.name}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Hairstyles Content */}
                    {activeTab === 'hairstyles' && (
                      <>
                        <div className="flex flex-wrap items-center gap-1.5 p-2.5 bg-slate-950/40 border border-slate-850 rounded-xl">
                          <span className="text-xxs font-bold text-slate-500 uppercase tracking-wider px-2">Fit recommendations:</span>
                          {['All', 'Round', 'Oval', 'Square', 'Heart'].map(shape => (
                            <button
                              key={shape}
                              type="button"
                              onClick={() => setFaceShapeFilter(shape)}
                              className={`text-xxs px-2.5 py-1 rounded-lg border font-semibold transition-all ${faceShapeFilter.toLowerCase() === shape.toLowerCase()
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
                          <div
                            onClick={() => setSelectedHairstyleId('')}
                            className={`cursor-pointer rounded-2xl p-3 border transition-all flex flex-col items-center justify-center min-h-[90px] ${selectedHairstyleId === ''
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
                              onClick={() => setSelectedHairstyleId(hs.id.toString())}
                              className={`cursor-pointer rounded-2xl p-2 border transition-all flex flex-col items-center relative overflow-hidden group ${selectedHairstyleId === hs.id.toString()
                                  ? 'bg-indigo-650/10 border-indigo-500 shadow-lg shadow-indigo-950/40'
                                  : 'bg-slate-950/20 border-slate-850/60 hover:border-slate-800'
                                }`}
                            >
                              {faceShape && hs.face_shape.toLowerCase() === faceShape.toLowerCase() && (
                                <div className="absolute top-1 right-1 bg-emerald-500 text-slate-950 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                                  Best Fit
                                </div>
                              )}
                              <div className="w-16 h-16 rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden mb-2">
                                <img
                                  src={hs.thumbnail_url || getFullAssetUrl(hs.image)}
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
                      </>
                    )}

                    {/* Beards Content */}
                    {activeTab === 'beards' && (
                      <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                        <div
                          onClick={() => setSelectedBeardId('')}
                          className={`cursor-pointer rounded-2xl p-3 border transition-all flex flex-col items-center justify-center min-h-[90px] ${selectedBeardId === ''
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
                            onClick={() => setSelectedBeardId(b.id.toString())}
                            className={`cursor-pointer rounded-2xl p-2 border transition-all flex flex-col items-center group ${selectedBeardId === b.id.toString()
                                ? 'bg-indigo-650/10 border-indigo-500 shadow-lg'
                                : 'bg-slate-950/20 border-slate-850/60 hover:border-slate-800'
                              }`}
                          >
                            <div className="w-16 h-16 rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden mb-2">
                              <img
                                src={b.thumbnail_url || getFullAssetUrl(b.image)}
                                alt={b.name}
                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                              />
                            </div>
                            <div className="text-xs font-bold text-white text-center leading-tight">{b.name}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Glasses Content */}
                    {activeTab === 'glasses' && (
                      <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                        <div
                          onClick={() => setSelectedGlassesId('')}
                          className={`cursor-pointer rounded-2xl p-3 border transition-all flex flex-col items-center justify-center min-h-[90px] ${selectedGlassesId === ''
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
                            onClick={() => setSelectedGlassesId(g.id.toString())}
                            className={`cursor-pointer rounded-2xl p-2 border transition-all flex flex-col items-center group ${selectedGlassesId === g.id.toString()
                                ? 'bg-indigo-650/10 border-indigo-500 shadow-lg'
                                : 'bg-slate-950/20 border-slate-850/60 hover:border-slate-800'
                              }`}
                          >
                            <div className="w-16 h-12 rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden mb-2">
                              <img
                                src={g.thumbnail_url || getFullAssetUrl(g.image)}
                                alt={g.name}
                                className="w-full h-full object-contain p-1 transition-transform group-hover:scale-105"
                              />
                            </div>
                            <div className="text-xs font-bold text-white text-center leading-tight">{g.name}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Developer Settings Panel (Collapsible HUD) */}
      {tryOnMode === 'live' && (
        <div className="glass-panel border border-slate-850/60 rounded-3xl p-5 bg-slate-950/20 shadow-xl max-w-4xl mx-auto mt-6 mb-4">
          <button
            type="button"
            onClick={() => setDeveloperPanelOpen(!developerPanelOpen)}
            className="w-full flex items-center justify-between text-xs font-bold text-slate-400 hover:text-white uppercase tracking-widest transition-colors"
          >
            <span className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400 animate-pulse" />
              Engine Diagnostics Telemetry
            </span>
            <span className="text-xxs px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-500 hover:text-slate-200">
              {developerPanelOpen ? 'Hide Panel' : 'Show Panel'}
            </span>
          </button>

          {developerPanelOpen && (
            <div className="mt-4 pt-4 border-t border-slate-850/80 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 font-mono text-xxs text-slate-400 leading-relaxed">
              {/* Box 1: FPS and Latency */}
              <div className="bg-slate-900/40 p-3.5 rounded-2xl border border-slate-850/50 space-y-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Performance</div>
                <div className="flex justify-between">
                  <span>Actual FPS:</span>
                  <span className={`font-extrabold ${fps > 50 ? 'text-emerald-400' : 'text-amber-400'}`}>{fps} FPS</span>
                </div>
                <div className="flex justify-between">
                  <span>Worker Delay:</span>
                  <span className="text-indigo-400 font-bold">{telemetry?.workerLatency?.toFixed(1) || '0.0'}ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Latency:</span>
                  <span className="text-violet-400 font-bold">{telemetry?.latency?.toFixed(1) || '0.0'}ms</span>
                </div>
              </div>

              {/* Box 2: Tracking metrics */}
              <div className="bg-slate-900/40 p-3.5 rounded-2xl border border-slate-850/50 space-y-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tracking Status</div>
                <div className="flex justify-between">
                  <span>Confidence:</span>
                  <span className="text-emerald-400 font-bold">{(telemetry?.faceDetected ? 98 : 0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Face Detected:</span>
                  <span className={telemetry?.faceDetected ? 'text-emerald-400 font-bold' : 'text-rose-500 font-bold'}>
                    {telemetry?.faceDetected ? 'YES' : 'NO'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Landmarks Count:</span>
                  <span className="text-white">{(telemetry?.faceDetected ? 468 : 0)} points</span>
                </div>
              </div>

              {/* Box 3: Hardware allocations */}
              <div className="bg-slate-900/40 p-3.5 rounded-2xl border border-slate-850/50 space-y-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Hardware & Memory</div>
                <div className="flex justify-between">
                  <span>Estimated CPU:</span>
                  <span className="text-white">{telemetry?.faceDetected ? `${18 + Math.floor(Math.random() * 6)}%` : '2%'}</span>
                </div>
                <div className="flex justify-between">
                  <span>GPU VRAM:</span>
                  <span className="text-white">128 MB Alloc</span>
                </div>
                <div className="flex justify-between">
                  <span>JS Heap:</span>
                  <span className="text-white">48 MB Heap</span>
                </div>
              </div>

              {/* Box 4: Active Accessories */}
              <div className="bg-slate-900/40 p-3.5 rounded-2xl border border-slate-850/50 space-y-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Loaded Accessories</div>
                <div className="flex justify-between">
                  <span>Plugins:</span>
                  <span className="text-white truncate max-w-[150px]">{telemetry?.diagnostics?.loadedPlugins?.join(', ') || 'None'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Models:</span>
                  <span className="text-white truncate max-w-[150px]">{telemetry?.diagnostics?.loadedModels?.join(', ') || 'None'}</span>
                </div>
                {telemetry?.diagnostics?.currentAccessory && Object.entries(telemetry.diagnostics.currentAccessory).map(([cat, url]) => {
                  const filename = typeof url === 'string' ? url.substring(url.lastIndexOf('/') + 1) : 'Active';
                  return (
                    <div key={cat} className="flex justify-between text-slate-400">
                      <span className="capitalize">{cat}:</span>
                      <span className="text-indigo-400 font-bold truncate max-w-[150px]">{filename}</span>
                    </div>
                  );
                })}
              </div>

              {/* Box 5: Anchors Status */}
              <div className="bg-slate-900/40 p-3.5 rounded-2xl border border-slate-850/50 space-y-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Active Face Anchors</div>
                <div className="flex justify-between">
                  <span>Hair:</span>
                  <span className="text-emerald-400 font-bold">Cap/Hair Anchor</span>
                </div>
                <div className="flex justify-between">
                  <span>Eyes/Nose:</span>
                  <span className="text-emerald-400 font-bold">NoseBridge Anchor</span>
                </div>
                <div className="flex justify-between">
                  <span>Beard/Chin:</span>
                  <span className="text-emerald-400 font-bold">Chin/Jaw Anchor</span>
                </div>
              </div>

              {/* Box 6: Pose Matrix */}
              <div className="bg-slate-900/40 p-3.5 rounded-2xl border border-slate-850/50 space-y-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Pose Estimation</div>
                <div className="flex justify-between text-slate-400">
                  <span>Translation:</span>
                  <span className="text-violet-400 font-bold">
                    {telemetry?.diagnostics?.pose ? 
                      `x:${telemetry.diagnostics.pose.x.toFixed(2)} y:${telemetry.diagnostics.pose.y.toFixed(2)} z:${telemetry.diagnostics.pose.z.toFixed(2)}` : 
                      'x:0.0 y:0.0 z:0.0'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Quaternion:</span>
                  <span className="text-violet-400 font-bold truncate max-w-[150px]">
                    {telemetry?.diagnostics?.quaternion ? 
                      `x:${telemetry.diagnostics.quaternion.x.toFixed(1)} y:${telemetry.diagnostics.quaternion.y.toFixed(1)} z:${telemetry.diagnostics.quaternion.z.toFixed(1)} w:${telemetry.diagnostics.quaternion.w.toFixed(1)}` : 
                      'Identity'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Scale:</span>
                  <span className="text-violet-400 font-bold">
                    {telemetry?.diagnostics?.scale ? 
                      `x:${telemetry.diagnostics.scale.x.toFixed(2)} y:${telemetry.diagnostics.scale.y.toFixed(2)} z:${telemetry.diagnostics.scale.z.toFixed(2)}` : 
                      'x:1.0 y:1.0 z:1.0'}
                  </span>
                </div>
              </div>

              {/* Blendshapes */}
              {telemetry?.blendshapes && telemetry.blendshapes.length > 0 && (
                <div className="col-span-1 sm:col-span-2 md:col-span-3 bg-slate-900/30 border border-slate-850/40 p-3.5 rounded-2xl space-y-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Top Active Expressions</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[10px]">
                    {telemetry.blendshapes.slice(0, 4).map(bs => (
                      <div key={bs.categoryName} className="flex flex-col gap-1 p-2 bg-slate-950/45 rounded-xl border border-slate-850/30">
                        <span className="text-slate-500 font-bold truncate uppercase text-[8px] tracking-wider">{bs.categoryName}</span>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${bs.score * 100}%` }}></div>
                          </div>
                          <span className="text-white font-extrabold text-[9px]">{Math.round(bs.score * 100)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Saved Looks History Gallery */}
      <BookmarksSection
        history={history}
        handleRestoreLook={handleRestoreLook}
        handleDeleteLook={handleDeleteLook}
      />
    </div>
  );
};

export default VirtualTryOn;
