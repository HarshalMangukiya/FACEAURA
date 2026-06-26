/**
 * CameraService.js
 * 
 * A utility service that wraps browser navigator.mediaDevices API to provide
 * camera initialization, enumeration of video input devices, and stream management.
 * Supports desktop webcams, laptops, Android, and iOS/iPhone cameras with fallback mechanisms.
 */

export const CameraService = {
  /**
   * Check if the browser supports mediaDevices and getUserMedia
   * @returns {boolean} True if supported
   */
  isSupported() {
    return !!(
      navigator.mediaDevices && 
      navigator.mediaDevices.getUserMedia
    );
  },

  /**
   * Query the permission status for camera usage if supported by browser.
   * Note: Permission query for camera is not supported in all browsers (e.g., Safari/Firefox on iOS).
   * @returns {Promise<string>} 'granted', 'prompt', 'denied', or 'unknown'
   */
  async checkPermissionStatus() {
    if (!navigator.permissions || !navigator.permissions.query) {
      return 'unknown';
    }
    try {
      // Some browsers don't support querying for 'camera' name and throw TypeError
      const result = await navigator.permissions.query({ name: 'camera' });
      return result.state; // 'granted', 'prompt', or 'denied'
    } catch (e) {
      return 'unknown';
    }
  },

  /**
   * Enumerate all connected video input devices
   * @returns {Promise<MediaDeviceInfo[]>} Array of video input devices
   */
  async getDevices() {
    if (!this.isSupported()) {
      return [];
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((device) => device.kind === 'videoinput');
    } catch (error) {
      console.error('[CameraService] Error enumerating devices:', error);
      return [];
    }
  },

  /**
   * Request a media stream with specified options and intelligent fallbacks.
   * Supports deviceId or facingMode constraints.
   * 
   * @param {Object} options Configuration parameters
   * @param {string} [options.deviceId] Specific device ID to request
   * @param {'user'|'environment'} [options.facingMode] Front ('user') or back ('environment') camera
   * @param {number} [options.width] Ideal video width (defaults to 1280)
   * @param {number} [options.height] Ideal video height (defaults to 720)
   * @returns {Promise<MediaStream>} The requested MediaStream
   */
  async getStream({ deviceId, facingMode, width = 1280, height = 725 } = {}) {
    if (!this.isSupported()) {
      throw new Error('Camera access (getUserMedia) is not supported in this browser.');
    }

    // Build initial constraints
    const constraints = {
      audio: false,
      video: {
        width: { ideal: width },
        height: { ideal: height },
      },
    };

    if (deviceId) {
      // Request exact device ID if provided (preferred for specific desktop webcams)
      constraints.video.deviceId = { exact: deviceId };
    } else if (facingMode) {
      // Use facingMode for mobile/laptops (e.g. 'user' = front, 'environment' = back)
      constraints.video.facingMode = facingMode;
    } else {
      // Fallback default to front facing mode if nothing is specified
      constraints.video.facingMode = 'user';
    }

    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      console.warn('[CameraService] Initial camera request failed. Retrying with fallback constraints.', error);

      // FALLBACK 1: If requesting exact deviceId failed, try with standard deviceId (not exact)
      if (deviceId) {
        try {
          const fallbackConstraints = {
            audio: false,
            video: {
              deviceId: deviceId,
              width: { ideal: width },
              height: { ideal: height },
            },
          };
          return await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        } catch (e2) {
          console.warn('[CameraService] Fallback 1 failed. Dropping deviceId constraints...', e2);
        }
      }

      // FALLBACK 2: If ideal resolution constraint failed, drop width/height constraints
      try {
        const relaxedConstraints = {
          audio: false,
          video: deviceId 
            ? { deviceId } 
            : (facingMode ? { facingMode } : { facingMode: 'user' }),
        };
        return await navigator.mediaDevices.getUserMedia(relaxedConstraints);
      } catch (e3) {
        console.warn('[CameraService] Fallback 2 failed. Dropping all constraints except basic video...', e3);
      }

      // FALLBACK 3: Ultimate fallback, request any video stream
      return await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    }
  },

  /**
   * Stop all tracks of an active MediaStream
   * @param {MediaStream|null} stream The MediaStream to stop
   */
  stopStream(stream) {
    if (!stream) return;

    try {
      const tracks = stream.getTracks();
      tracks.forEach((track) => {
        try {
          track.stop();
          console.log(`[CameraService] Stopped track: ${track.label || track.kind}`);
        } catch (err) {
          console.error('[CameraService] Error stopping track:', err);
        }
      });
    } catch (error) {
      console.error('[CameraService] Error getting tracks to stop:', error);
    }
  },
};
