import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { useCamera } from './hooks/useCamera';
import { CameraControls } from './CameraControls';
import { 
  Camera as CameraIcon, 
  AlertCircle, 
  RotateCw, 
  ShieldAlert,
  Loader2,
  Pause
} from 'lucide-react';

/**
 * Camera Component
 * 
 * Orchestrates the Live Camera Preview viewport, permission state overlays,
 * loading animations, and the control panel.
 * 
 * Exposes the underlying HTMLVideoElement through standard ref forwarding
 * to enable downstream canvas capturing, facial landmarks analysis, etc.
 */
export const Camera = forwardRef(({
  autoStart = false,
  onVideoReady = null,
  onStreamActive = null,
  onStreamStop = null,
  initialFacingMode = 'user',
  initialMirrored = true,
  width = 1280,
  height = 720,
  className = ''
}, ref) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialize useCamera hook
  const {
    videoRef,
    isActive,
    isPaused,
    isLoading,
    error,
    devices,
    currentDevice,
    facingMode,
    isMirrored,
    start,
    stop,
    pause,
    resume,
    switchCamera,
    selectDevice,
    toggleMirror
  } = useCamera({
    initialFacingMode,
    initialMirrored,
    width,
    height,
    autoStart
  });

  // Forward the HTMLVideoElement ref to parent component
  useImperativeHandle(ref, () => videoRef.current, [videoRef]);

  // Handle stream active / stop events for integration hooks
  useEffect(() => {
    if (isActive) {
      if (videoRef.current && onVideoReady) {
        onVideoReady(videoRef.current);
      }
      if (videoRef.current?.srcObject && onStreamActive) {
        onStreamActive(videoRef.current.srcObject);
      }
    } else {
      if (onStreamStop) {
        onStreamStop();
      }
    }
  }, [isActive, videoRef, onVideoReady, onStreamActive, onStreamStop]);

  // Clean up full screen state on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleToggleFullscreen = () => {
    setIsFullscreen((prev) => {
      const next = !prev;
      if (next) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'unset';
      }
      return next;
    });
  };

  // Custom Retry Handler
  const handleRetry = () => {
    start();
  };

  // Helper to render relevant error states
  const renderErrorState = () => {
    if (!error) return null;

    let title = 'Camera Error';
    let description = 'An unexpected error occurred while setting up the camera preview.';
    let Icon = AlertCircle;
    let iconColor = 'text-rose-500';
    let btnText = 'Retry Camera';

    if (error === 'PermissionDenied') {
      title = 'Camera Permission Blocked';
      description = 'FaceAura requires access to your camera to analyze facial shapes and skin properties. Please click Allow when prompted by your browser or update your privacy permissions in the site settings.';
      Icon = ShieldAlert;
      iconColor = 'text-amber-500';
      btnText = 'Request Permissions Again';
    } else if (error === 'NotFoundError') {
      title = 'No Camera Detected';
      description = 'We could not find an active camera device connected to your system. Please verify your webcam connection or device configuration.';
      Icon = CameraIcon;
      iconColor = 'text-slate-500';
      btnText = 'Scan for Cameras';
    } else {
      description = error;
    }

    return (
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 animate-fade-in">
        <div className={`p-4 bg-slate-900 border border-slate-800 rounded-3xl mb-4 shadow-lg ${iconColor}`}>
          <Icon className="w-8 h-8 stroke-[1.5]" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-slate-400 text-xs leading-relaxed max-w-sm mb-6">
          {description}
        </p>
        <button
          onClick={handleRetry}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-650 to-violet-650 hover:from-indigo-550 hover:to-violet-550 text-white text-xs font-bold rounded-2xl active:scale-[0.98] transition-all shadow-md"
        >
          <RotateCw className="w-3.5 h-3.5" />
          {btnText}
        </button>
      </div>
    );
  };

  return (
    <div 
      className={`
        relative overflow-hidden transition-all duration-300
        ${isFullscreen 
          ? 'fixed inset-0 z-50 bg-slate-950 flex flex-col' 
          : `w-full rounded-3xl border border-slate-850 bg-slate-950/40 shadow-xl ${className}`
        }
      `}
    >
      
      {/* Video Preview Canvas Window */}
      <div className={`relative flex-1 bg-slate-950 flex items-center justify-center ${isFullscreen ? 'h-0' : 'aspect-video md:aspect-[4/3]'}`}>
        
        {/* HTMLVideoElement Stream Player */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`
            w-full h-full object-cover transition-transform duration-300
            ${isMirrored ? 'scale-x-[-1]' : 'scale-x-1'}
            ${isActive && !isPaused ? 'opacity-100' : 'opacity-0'}
          `}
        />

        {/* Frozen frame overlay when paused */}
        {isActive && isPaused && (
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm flex flex-col items-center justify-center p-4">
            <div className="p-3.5 bg-indigo-950/30 border border-indigo-500/20 text-indigo-400 rounded-2xl animate-pulse">
              <Pause className="w-6 h-6 stroke-[1.5]" />
            </div>
            <span className="text-xs font-bold text-indigo-400 mt-3 uppercase tracking-wider">Camera Feed Paused</span>
          </div>
        )}

        {/* Loading Spinner Screen */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
            <span className="text-xs font-bold text-slate-400 animate-pulse uppercase tracking-wider">Configuring Video Stream...</span>
          </div>
        )}

        {/* Error Screen Layer */}
        {renderErrorState()}

        {/* Offline Placeholder when inactive */}
        {!isActive && !isLoading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-500">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl mb-3 shadow-inner">
              <CameraIcon className="w-8 h-8 stroke-[1.2] text-slate-650" />
            </div>
            <h4 className="text-sm font-bold text-slate-350">Camera is Offline</h4>
            <p className="text-[11px] text-slate-500 mt-1 max-w-[240px] leading-normal font-medium">
              Click Start Camera below to request stream authorization.
            </p>
          </div>
        )}
      </div>

      {/* Control Panel overlay HUD */}
      <CameraControls
        isActive={isActive}
        isPaused={isPaused}
        isLoading={isLoading}
        devices={devices}
        currentDevice={currentDevice}
        facingMode={facingMode}
        isMirrored={isMirrored}
        isFullscreen={isFullscreen}
        onStart={start}
        onStop={stop}
        onPause={pause}
        onResume={resume}
        onSwitchCamera={switchCamera}
        onSelectDevice={selectDevice}
        onToggleMirror={toggleMirror}
        onToggleFullscreen={handleToggleFullscreen}
      />
    </div>
  );
});

Camera.displayName = 'Camera';
export default Camera;
