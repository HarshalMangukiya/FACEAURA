import React from 'react';
import { 
  Play, 
  Pause, 
  Video, 
  VideoOff, 
  RefreshCw, 
  FlipHorizontal, 
  Maximize2, 
  Minimize2,
  Camera
} from 'lucide-react';

/**
 * CameraControls Component
 * 
 * Renders the control HUD overlay for the camera preview.
 * Fully responsive, optimized, and styled with premium glassmorphism aesthetics.
 */
export const CameraControls = React.memo(({
  isActive,
  isPaused,
  isLoading,
  devices,
  currentDevice,
  facingMode,
  isMirrored,
  isFullscreen,
  onStart,
  onStop,
  onPause,
  onResume,
  onSwitchCamera,
  onSelectDevice,
  onToggleMirror,
  onToggleFullscreen
}) => {
  return (
    <div className="w-full flex flex-col gap-3 p-4 bg-slate-950/80 backdrop-blur-md border-t border-slate-800/80 transition-all duration-300">
      
      {/* Upper Controls: Device Dropdown Selector & Mirror/Fullscreen Options */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        
        {/* Device Selection Dropdown */}
        {isActive && devices.length > 1 ? (
          <div className="flex items-center gap-2 flex-grow max-w-xs md:max-w-sm">
            <Camera className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <select
              value={currentDevice || ''}
              onChange={(e) => onSelectDevice(e.target.value)}
              disabled={isLoading}
              className="w-full bg-slate-900 border border-slate-800 text-slate-200 py-1.5 px-3 rounded-xl focus:outline-none focus:border-indigo-500 text-xs font-semibold select-none cursor-pointer transition-colors shadow-inner"
            >
              {devices.map((device, idx) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold">
            {isActive ? (
              <>
                <Camera className="w-4 h-4 text-slate-600" />
                <span>Single Camera Mode</span>
              </>
            ) : (
              <span>Camera not initialized</span>
            )}
          </div>
        )}

        {/* Action Toggles: Mirror & Fullscreen */}
        {isActive && (
          <div className="flex items-center gap-2">
            {/* Mirror Toggle */}
            <button
              onClick={onToggleMirror}
              title={isMirrored ? "Disable Mirror Mode" : "Enable Mirror Mode"}
              className={`p-2 rounded-xl border transition-all ${
                isMirrored 
                  ? 'bg-indigo-950/40 border-indigo-500/30 text-indigo-400 font-bold' 
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <FlipHorizontal className="w-4 h-4" />
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={onToggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen Preview" : "Enter Fullscreen Preview"}
              className={`p-2 rounded-xl border transition-all bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700`}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4 text-rose-400" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Main Control Action Buttons */}
      <div className="flex items-center justify-center gap-4 mt-1">
        
        {/* Toggle Start/Stop State */}
        {!isActive ? (
          <button
            onClick={() => onStart()}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-550 hover:to-violet-550 disabled:from-slate-800 disabled:to-slate-900 disabled:text-slate-500 text-white text-xs font-bold rounded-2xl cursor-pointer select-none active:scale-[0.98] transition-all shadow-lg shadow-indigo-650/15"
          >
            <Video className="w-4 h-4" />
            Start Camera
          </button>
        ) : (
          <div className="flex items-center gap-3">
            
            {/* Pause / Resume Button */}
            {!isPaused ? (
              <button
                onClick={onPause}
                disabled={isLoading}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-750 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer select-none active:scale-[0.97] transition-all"
              >
                <Pause className="w-3.5 h-3.5" />
                Pause
              </button>
            ) : (
              <button
                onClick={onResume}
                disabled={isLoading}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-950/50 border border-indigo-500/30 hover:bg-indigo-900/40 text-indigo-400 text-xs font-bold rounded-xl cursor-pointer select-none active:scale-[0.97] transition-all animate-pulse-slow"
              >
                <Play className="w-3.5 h-3.5" />
                Resume
              </button>
            )}

            {/* Quick Switch Camera Front/Back (Mobile support) */}
            {devices.length > 1 && (
              <button
                onClick={onSwitchCamera}
                disabled={isLoading}
                title="Switch Camera (Front/Back)"
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-750 text-slate-350 text-xs font-semibold rounded-xl cursor-pointer select-none active:scale-[0.97] transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                Switch
              </button>
            )}

            {/* Stop Camera Button */}
            <button
              onClick={onStop}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-950/30 border border-rose-900/30 hover:bg-rose-900/20 hover:border-rose-800/40 text-rose-455 text-xs font-bold rounded-xl cursor-pointer select-none active:scale-[0.97] transition-all"
            >
              <VideoOff className="w-3.5 h-3.5" />
              Stop
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

CameraControls.displayName = 'CameraControls';
export default CameraControls;
