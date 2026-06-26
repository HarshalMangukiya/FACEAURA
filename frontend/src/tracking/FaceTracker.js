import faceDetectionService from './FaceDetectionService';
import LandmarkTracker from './LandmarkTracker';

/**
 * FaceTracker Class
 * 
 * High-level orchestrator that connects the video frame element to the 
 * MediaPipe detection service and coordinates smoothing. Calculations for 
 * Pitch, Yaw, Roll, Scale, and Translation are computed per frame inside 
 * a requestAnimationFrame loop.
 */
export class FaceTracker {
  /**
   * @param {Object} [options] Tracker configurations
   * @param {number} [options.alpha=0.45] Smoothing factor for landmark coordinates
   */
  constructor(options = {}) {
    const { alpha = 0.45, detectInterval = null } = options;
    
    this.landmarkTracker = new LandmarkTracker(alpha);
    this.videoElement = null;
    this.onFrameCallback = null;
    this.frameId = null;
    this.isTracking = false;

    // Framerate throttling / Frame skipping options
    const isMobileDevice = typeof navigator !== 'undefined' && 
      /Mobi|Android|iPhone|iPad|iPod|Windows Phone|webOS/i.test(navigator.userAgent);
    this.detectInterval = detectInterval !== null ? detectInterval : (isMobileDevice ? 33.3 : 16.6);
    this.lastDetectTime = 0;
  }

  /**
   * Start the face tracking loop on a video element.
   * 
   * @param {HTMLVideoElement} videoElement Video source
   * @param {Function} onFrameCallback Callback dispatched on every frame update
   */
  async start(videoElement, onFrameCallback) {
    if (!videoElement) {
      throw new Error('[FaceTracker] A valid HTMLVideoElement must be provided.');
    }
    if (typeof onFrameCallback !== 'function') {
      throw new Error('[FaceTracker] An onFrame callback function is required.');
    }

    this.videoElement = videoElement;
    this.onFrameCallback = onFrameCallback;
    this.isTracking = true;

    // 1. Ensure detection service is initialized
    await faceDetectionService.initialize();

    // 2. Clear any active loops
    this.stopLoop();

    // 3. Initiate tracking loop
    console.log('[FaceTracker] Starting requestAnimationFrame loop...');
    this.landmarkTracker.reset();
    this.tick();
  }

  /**
   * Stop the active face tracking loop.
   */
  stop() {
    this.isTracking = false;
    this.stopLoop();
    this.landmarkTracker.reset();
    console.log('[FaceTracker] Tracking loop stopped.');
  }

  /**
   * Stop the requestAnimationFrame loop.
   */
  stopLoop() {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  /**
   * Frame-by-frame loop execution.
   */
  tick() {
    if (!this.isTracking || !this.videoElement) return;

    const video = this.videoElement;

    // Process frame if video is in active playback state
    if (video.readyState >= 2 && !video.paused) {
      try {
        const timestamp = performance.now();
        const elapsed = timestamp - this.lastDetectTime;

        // Frame skipping check: only run ML inference if enough time has elapsed
        if (elapsed >= this.detectInterval) {
          // Adjust lastDetectTime so we align with the target framerate cleanly
          this.lastDetectTime = timestamp - (elapsed % this.detectInterval);

          const results = faceDetectionService.detectForVideo(video, timestamp);

          if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
            const rawLandmarks = results.faceLandmarks[0];

            // 1. Apply EMA smoothing
            const smoothedLandmarks = this.landmarkTracker.update(rawLandmarks);

            if (smoothedLandmarks) {
              // 2. Extract metrics
              const rotation = this.calculateRotation(smoothedLandmarks);
              const scale = this.calculateScale(smoothedLandmarks);
              const translation = this.calculateTranslation(smoothedLandmarks);
              const features = this.landmarkTracker.getAllFeatures();

              // 3. Compile telemetry payload
              const telemetry = {
                faceDetected: true,
                landmarks: smoothedLandmarks,
                features,
                rotation,
                scale,
                translation,
                timestamp
              };

              // 4. Dispatch to handler
              if (this.onFrameCallback) {
                this.onFrameCallback(telemetry);
              }
            }
          } else {
            // Face lost or not detected
            if (this.onFrameCallback) {
              this.onFrameCallback({
                faceDetected: false,
                landmarks: [],
                features: null,
                rotation: { pitch: 0, yaw: 0, roll: 0 },
                scale: { x: 0, y: 0, z: 0 },
                translation: { x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0 },
                timestamp
              });
            }
          }
        }
      } catch (err) {
        console.error('[FaceTracker] Error in frame detection tick:', err);
      }
    }

    // Schedule next frame
    if (this.isTracking) {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  /**
   * Calculates facial rotation angles (Pitch, Yaw, Roll) using 3D coordinate vector projection.
   * 
   * @param {Array} landmarks Smooth landmarks list
   * @returns {Object} { pitch, yaw, roll } in degrees
   */
  calculateRotation(landmarks) {
    const leftEye = landmarks[133];
    const rightEye = landmarks[362];
    const nose = landmarks[4];
    const chin = landmarks[152];
    const forehead = landmarks[10];

    if (!leftEye || !rightEye || !nose || !chin || !forehead) {
      return { pitch: 0, yaw: 0, roll: 0 };
    }

    // Calculate X vector pointing from left eye inner corner to right eye inner corner
    const vx = {
      x: rightEye.x - leftEye.x,
      y: rightEye.y - leftEye.y,
      z: rightEye.z - leftEye.z
    };
    const lenX = Math.hypot(vx.x, vx.y, vx.z) || 0.0001;
    const ux = { x: vx.x / lenX, y: vx.y / lenX, z: vx.z / lenX };

    // Calculate Y vector pointing from chin to forehead (upwards)
    const vy = {
      x: forehead.x - chin.x,
      y: forehead.y - chin.y,
      z: forehead.z - chin.z
    };
    // Project vy onto ux to make them orthogonal (orthogonal projection)
    const dotProduct = vy.x * ux.x + vy.y * ux.y + vy.z * ux.z;
    const vyOrth = {
      x: vy.x - dotProduct * ux.x,
      y: vy.y - dotProduct * ux.y,
      z: vy.z - dotProduct * ux.z
    };
    const lenY = Math.hypot(vyOrth.x, vyOrth.y, vyOrth.z) || 0.0001;
    const uy = { x: vyOrth.x / lenY, y: vyOrth.y / lenY, z: vyOrth.z / lenY };

    // Calculate Z vector orthogonal to X and Y (cross product: Z = X x Y)
    // Pointing directly forward out of the face
    const uz = {
      x: ux.y * uy.z - ux.z * uy.y,
      y: ux.z * uy.x - ux.x * uy.z,
      z: ux.x * uy.y - ux.y * uy.x
    };

    // Extract Euler angles (Yaw, Pitch, Roll)
    // Yaw: turn left/right (rotation around Y-axis)
    const yaw = Math.atan2(uz.x, uz.z);
    
    // Pitch: nod up/down (rotation around X-axis)
    const pitch = Math.atan2(-uz.y, Math.hypot(uz.x, uz.z));
    
    // Roll: tilt left/right (rotation around Z-axis)
    const roll = Math.atan2(ux.y, ux.x);

    const radToDeg = (rad) => rad * (180 / Math.PI);

    return {
      pitch: Number(radToDeg(pitch).toFixed(2)),
      yaw: Number(radToDeg(yaw).toFixed(2)),
      roll: Number(radToDeg(roll).toFixed(2))
    };
  }

  /**
   * Estimates face dimensions / scale using key physical boundaries.
   * 
   * @param {Array} landmarks Smooth landmarks list
   * @returns {Object} Scale dimensions
   */
  calculateScale(landmarks) {
    const leftCheek = landmarks[234];
    const rightCheek = landmarks[454];
    const forehead = landmarks[10];
    const chin = landmarks[152];

    if (!leftCheek || !rightCheek || !forehead || !chin) {
      return { x: 0, y: 0, z: 0 };
    }

    // Horizontal scale (width)
    const width = Math.hypot(
      rightCheek.x - leftCheek.x,
      rightCheek.y - leftCheek.y,
      rightCheek.z - leftCheek.z
    );

    // Vertical scale (height)
    const height = Math.hypot(
      forehead.x - chin.x,
      forehead.y - chin.y,
      forehead.z - chin.z
    );

    // Combined average scale
    const depth = (width + height) / 2;

    return {
      x: Number(width.toFixed(4)),
      y: Number(height.toFixed(4)),
      z: Number(depth.toFixed(4))
    };
  }

  /**
   * Estimates 3D translation/position metrics.
   * Exposes coordinates in both normalized space [0..1] and projected pixel space.
   * 
   * @param {Array} landmarks Smooth landmarks list
   * @returns {Object} Translation coordinates
   */
  calculateTranslation(landmarks) {
    const nose = landmarks[4];
    if (!nose) {
      return { x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0 };
    }

    // Video dimensions to project pixel coordinates
    const videoWidth = this.videoElement ? this.videoElement.videoWidth : 640;
    const videoHeight = this.videoElement ? this.videoElement.videoHeight : 480;

    // Normalized values
    const x = nose.x;
    const y = nose.y;
    const z = nose.z;

    // Projected pixel values (relative to video canvas size)
    const px = Math.round(x * videoWidth);
    const py = Math.round(y * videoHeight);
    
    // Scale Z by width since depth z maps similarly to x coordinates in scale
    const pz = Math.round(z * videoWidth);

    return {
      x: Number(x.toFixed(4)),
      y: Number(y.toFixed(4)),
      z: Number(z.toFixed(4)),
      px,
      py,
      pz
    };
  }
}

export default FaceTracker;
