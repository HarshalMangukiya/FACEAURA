import { useState, useEffect, useRef, useCallback } from 'react';
import { CameraService } from '../CameraService';

/**
 * useCamera Hook
 * 
 * A custom React hook that manages the lifecycle of the camera stream.
 * Exposes a stable ref for the HTMLVideoElement, state representations, 
 * and memoized camera control functions to minimize child component rerenders.
 * 
 * @param {Object} options Hook configuration options
 * @param {'user'|'environment'} [options.initialFacingMode='user'] Initial camera facing mode
 * @param {boolean} [options.initialMirrored=true] Whether the front camera should be mirrored
 * @param {number} [options.width=1280] Ideal video resolution width
 * @param {number} [options.height=720] Ideal video resolution height
 * @param {boolean} [options.autoStart=false] Automatically start camera stream on mount
 */
export function useCamera(options = {}) {
  const {
    initialFacingMode = 'user',
    initialMirrored = true,
    width = 1280,
    height = 720,
    autoStart = false,
  } = options;

  // Stable references for HTMLVideoElement and active stream
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Core state variables (used to trigger UI updates)
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [devices, setDevices] = useState([]);
  const [currentDevice, setCurrentDevice] = useState(null);
  const [facingMode, setFacingMode] = useState(initialFacingMode);
  const [isMirrored, setIsMirrored] = useState(initialMirrored);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Mutable refs mirroring state values to keep callback functions reference-stable
  const isActiveRef = useRef(false);
  const isPausedRef = useRef(false);
  const facingModeRef = useRef(initialFacingMode);
  const currentDeviceRef = useRef(null);
  const isLoadingRef = useRef(false);

  // Keep refs in sync with state updates
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { facingModeRef.current = facingMode; }, [facingMode]);
  useEffect(() => { currentDeviceRef.current = currentDevice; }, [currentDevice]);
  useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);

  /**
   * Helper to retrieve and update available camera devices.
   */
  const refreshDevices = useCallback(async () => {
    if (!CameraService.isSupported()) return [];
    try {
      const videoDevices = await CameraService.getDevices();
      setDevices(videoDevices);
      return videoDevices;
    } catch (err) {
      console.error('[useCamera] Error refreshing devices:', err);
      return [];
    }
  }, []);

  /**
   * Stops the active camera stream, frees hardware resources, and resets states.
   */
  const stop = useCallback(() => {
    if (streamRef.current) {
      CameraService.stopStream(streamRef.current);
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
    setIsPaused(false);
    setError(null);
  }, []);

  /**
   * Starts or restarts the camera stream with specified or stored parameters.
   * Exposes parameters to override standard state variables.
   * 
   * @param {Object} [params] Parameters to override default state values
   * @param {'user'|'environment'} [params.facingMode] Facing mode to start with
   * @param {string} [params.deviceId] Specific device ID to start with
   */
  const start = useCallback(async (params = {}) => {
    // Determine constraints to request
    const targetFacingMode = params.facingMode !== undefined ? params.facingMode : facingModeRef.current;
    const targetDeviceId = params.deviceId !== undefined ? params.deviceId : currentDeviceRef.current;

    setIsLoading(true);
    setError(null);

    // Stop current stream if already running
    if (streamRef.current) {
      CameraService.stopStream(streamRef.current);
      streamRef.current = null;
    }

    try {
      const stream = await CameraService.getStream({
        deviceId: targetDeviceId,
        facingMode: targetFacingMode,
        width,
        height
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for loaded metadata event to guarantee size and duration details are ready
        await new Promise((resolve) => {
          if (!videoRef.current) return resolve();
          
          videoRef.current.onloadedmetadata = () => {
            resolve();
          };
          
          // Fallback timer if metadata event fails to fire in some edge cases
          setTimeout(resolve, 500);
        });

        // Play the stream preview in video element
        try {
          await videoRef.current.play();
        } catch (playError) {
          console.warn('[useCamera] Play promise rejected. Video element might be muted/hidden:', playError);
        }
      }

      setIsActive(true);
      setIsPaused(false);

      // Extract actual parameters configured by the browser
      const activeVideoTrack = stream.getVideoTracks()[0];
      if (activeVideoTrack) {
        const trackSettings = activeVideoTrack.getSettings();
        if (trackSettings.deviceId) {
          setCurrentDevice(trackSettings.deviceId);
        }
        if (trackSettings.facingMode) {
          setFacingMode(trackSettings.facingMode);
        }
      }

      // Refresh devices (device labels are populated once permission is granted)
      await refreshDevices();
    } catch (err) {
      console.error('[useCamera] Error in start camera sequence:', err);
      let localizedError = 'Could not access the camera. Please verify connections.';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        localizedError = 'PermissionDenied';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        localizedError = 'NotFoundError';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        localizedError = 'Camera is already in use by another application or tab.';
      } else if (err.message) {
        localizedError = err.message;
      }
      
      setError(localizedError);
      stop();
    } finally {
      setIsLoading(false);
    }
  }, [width, height, stop, refreshDevices]);

  /**
   * Pauses the video preview and disables stream tracks to save resources.
   */
  const pause = useCallback(() => {
    if (!isActiveRef.current || isPausedRef.current) return;

    if (videoRef.current) {
      videoRef.current.pause();
    }

    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = false;
      });
    }

    setIsPaused(true);
  }, []);

  /**
   * Resumes a paused video preview and re-enables tracks.
   */
  const resume = useCallback(async () => {
    if (!isActiveRef.current || !isPausedRef.current) return;

    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = true;
      });
    }

    if (videoRef.current) {
      try {
        await videoRef.current.play();
      } catch (err) {
        console.error('[useCamera] Failed to play video on resume:', err);
      }
    }

    setIsPaused(false);
  }, []);

  /**
   * Toggles facing mode user (front) vs environment (back) and restarts stream.
   */
  const switchCamera = useCallback(async () => {
    const nextFacingMode = facingModeRef.current === 'user' ? 'environment' : 'user';
    
    // Optimistically update states
    setFacingMode(nextFacingMode);
    setCurrentDevice(null);
    
    // Automatically mirror front camera and un-mirror back camera
    setIsMirrored(nextFacingMode === 'user');

    if (isActiveRef.current) {
      await start({ facingMode: nextFacingMode, deviceId: null });
    }
  }, [start]);

  /**
   * Selects a specific device ID and restarts the camera.
   * 
   * @param {string} deviceId Target videoinput device ID
   */
  const selectDevice = useCallback(async (deviceId) => {
    if (!deviceId) return;
    
    setCurrentDevice(deviceId);

    // Look up the device to infer if it is user-facing to set auto-mirroring
    try {
      const videoDevices = await CameraService.getDevices();
      const selected = videoDevices.find(d => d.deviceId === deviceId);
      if (selected) {
        const labelLower = selected.label.toLowerCase();
        const isFront = 
          labelLower.includes('front') || 
          labelLower.includes('user') || 
          labelLower.includes('selfie') || 
          labelLower.includes('facetime');
          
        setFacingMode(isFront ? 'user' : 'environment');
        setIsMirrored(isFront);
      }
    } catch (e) {
      console.warn('[useCamera] Error guessing facing mode from device label:', e);
    }

    if (isActiveRef.current) {
      await start({ deviceId, facingMode: undefined });
    }
  }, [start]);

  /**
   * Manually toggle mirror mode state
   */
  const toggleMirror = useCallback(() => {
    setIsMirrored((prev) => !prev);
  }, []);

  // Listen to external hardware device changes and auto-refresh listings
  useEffect(() => {
    const handleDevicesChanged = () => {
      refreshDevices();
    };

    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDevicesChanged);
    }

    // Initialize list of devices
    refreshDevices();

    if (autoStart) {
      start();
    }

    // Cleanup: stop active streams on hook unmount
    return () => {
      if (navigator.mediaDevices && navigator.mediaDevices.removeEventListener) {
        navigator.mediaDevices.removeEventListener('devicechange', handleDevicesChanged);
      }
      
      if (streamRef.current) {
        CameraService.stopStream(streamRef.current);
      }
    };
  }, [autoStart, start, refreshDevices]);

  return {
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
    toggleMirror,
  };
}
