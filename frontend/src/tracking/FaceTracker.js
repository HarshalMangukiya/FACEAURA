import faceDetectionService from './FaceDetectionService';
import LandmarkTracker from './LandmarkTracker';
import { WorkerManager } from '../core/workers/WorkerManager';
import { OneEuroFilterMulti3D, OneEuroFilter3D } from '../core/math/OneEuroFilter';
import { OpticalFlowPredictor } from '../core/math/OpticalFlow';
import { KalmanFilter3D } from '../core/math/KalmanFilter';

/**
 * FaceTracker Class
 *
 * High-level orchestrator that connects the video frame element to the
 * MediaPipe detection service (Web Worker offloaded with main-thread fallback)
 * and coordinates high-fidelity smoothing, optical flow, and lost face recovery.
 */
export class FaceTracker {
  /**
   * @param {Object} [options] Tracker configurations
   * @param {number} [options.alpha=0.45] Smoothing factor for fallback
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

    // High-performance filters
    this.workerManager = new WorkerManager();
    this.euroFilter = new OneEuroFilterMulti3D(0.75, 0.004); // Dynamic landmarks filter
    this.rotationFilter = new OneEuroFilter3D(1.2, 0.008); // Rotation pose filter
    this.opticalFlow = new OpticalFlowPredictor();
    this.translationFilter = new KalmanFilter3D(0.08, 1.25); // Kalman filter for position

    // Lost Face Recovery / Pose Freeze Variables
    this.lostFaceCount = 0;
    const maxRecoveryFrames = 10;
    this.maxRecoveryFrames = maxRecoveryFrames;
    this.lastTelemetry = null;
  }

  /**
   * Start the face tracking loop on a video element.
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

    this.lostFaceCount = 0;
    this.lastTelemetry = null;

    // 1. Initialize Worker Manager (resolves to fallback if workers are unsupported)
    await this.workerManager.initialize((workerTelemetry) => {
      this.handleWorkerTelemetry(workerTelemetry);
    });

    // 2. Clear any active loops
    this.stopLoop();

    // 3. Initiate tracking loop
    console.log('[FaceTracker] Starting requestAnimationFrame loop (Worker-enabled)...');
    this.landmarkTracker.reset();
    this.euroFilter.reset();
    this.rotationFilter.reset();
    this.opticalFlow.reset();
    this.tick();
  }

  /**
   * Stop the active face tracking loop.
   */
  stop() {
    this.isTracking = false;
    this.stopLoop();
    this.landmarkTracker.reset();
    this.euroFilter.reset();
    this.rotationFilter.reset();
    this.opticalFlow.reset();
    this.workerManager.destroy();
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
          this.lastDetectTime = timestamp - (elapsed % this.detectInterval);
          
          // Submit frame to WorkerManager (runs off-thread or main-thread fallback)
          this.workerManager.processFrame(video, timestamp);
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
   * Receives telemetry updates from the Worker thread.
   * Applies smoothing, latency predictive optical flow, and lost face recovery.
   */
  handleWorkerTelemetry(workerTelemetry) {
    if (!this.isTracking) return;

    const timestamp = workerTelemetry.timestamp;

    // 1. LOST FACE RECOVERY PATH
    if (!workerTelemetry.faceDetected) {
      this.lostFaceCount++;
      
      // If lost face for less than max recovery frames, freeze last pose and fade accessories
      if (this.lostFaceCount < this.maxRecoveryFrames && this.lastTelemetry) {
        const fadeFactor = 1.0 - (this.lostFaceCount / this.maxRecoveryFrames);
        const recoveredTelemetry = {
          ...this.lastTelemetry,
          fadeFactor, // Passed to overlay drawing to fade opacity smoothly
          faceDetected: true, // Pretend we still have a face to avoid rendering jumps
          isRecovering: true
        };

        if (this.onFrameCallback) {
          this.onFrameCallback(recoveredTelemetry);
        }
      } else {
        // Fully lost face
        this.lastTelemetry = null;
        if (this.onFrameCallback) {
          this.onFrameCallback({
            faceDetected: false,
            landmarks: [],
            features: null,
            rotation: { pitch: 0, yaw: 0, roll: 0 },
            scale: { x: 0, y: 0, z: 0 },
            translation: { x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0 },
            timestamp,
            latency: workerTelemetry.latency,
            fadeFactor: 0.0
          });
        }
      }
      return;
    }

    // Face detected: reset lost face count
    this.lostFaceCount = 0;

    let landmarks = workerTelemetry.landmarks;

    // 2. TEMPORAL SMOOTHING: OneEuro Low Pass Filter
    landmarks = this.euroFilter.filter(landmarks, timestamp);

    // 3. LATENCY EXTRAPOLATION: Optical Flow Prediction
    // Extrapolate ahead by ~28ms (standard processing + render queue latency)
    landmarks = this.opticalFlow.predict(landmarks, timestamp, 28);

    // 4. Extract rotation angles & pose metrics
    const rawRotation = this.calculateRotation(landmarks);
    const filteredRotation = this.rotationFilter.filter(
      { x: rawRotation.pitch, y: rawRotation.yaw, z: rawRotation.roll },
      timestamp
    );

    const rotation = {
      pitch: Number(filteredRotation.x.toFixed(2)),
      yaw: Number(filteredRotation.y.toFixed(2)),
      roll: Number(filteredRotation.z.toFixed(2))
    };

    const scale = this.calculateScale(landmarks);
    const rawTranslation = this.calculateTranslation(landmarks);
    const filteredTranslation = this.translationFilter.update(
      { x: rawTranslation.px, y: rawTranslation.py, z: rawTranslation.pz },
      timestamp
    );

    const translation = {
      ...rawTranslation,
      px: filteredTranslation.x,
      py: filteredTranslation.y,
      pz: filteredTranslation.z
    };

    // Group region subsets
    const features = this.extractFeatures(landmarks);

    const telemetry = {
      faceDetected: true,
      landmarks,
      blendshapes: workerTelemetry.blendshapes || [],
      facialTransformationMatrix: workerTelemetry.transformationMatrix || null,
      features,
      rotation,
      scale,
      translation,
      timestamp,
      latency: workerTelemetry.latency,
      workerLatency: workerTelemetry.workerLatency || 0,
      fadeFactor: 1.0 // Fully visible
    };

    // Cache telemetry for Lost Face recovery
    this.lastTelemetry = telemetry;

    if (this.onFrameCallback) {
      this.onFrameCallback(telemetry);
    }
  }

  extractFeatures(landmarks) {
    this.landmarkTracker.smoothed = landmarks;
    return this.landmarkTracker.getAllFeatures();
  }

  /**
   * Calculates rotation angles (Pitch, Yaw, Roll) using 3D coordinate vector projection.
   */
  calculateRotation(landmarks) {
    const leftEye = landmarks[133];
    const rightEye = landmarks[362];
    const chin = landmarks[152];
    const forehead = landmarks[10];

    if (!leftEye || !rightEye || !chin || !forehead) {
      return { pitch: 0, yaw: 0, roll: 0 };
    }

    const vx = {
      x: rightEye.x - leftEye.x,
      y: rightEye.y - leftEye.y,
      z: rightEye.z - leftEye.z
    };
    const lenX = Math.hypot(vx.x, vx.y, vx.z) || 0.0001;
    const ux = { x: vx.x / lenX, y: vx.y / lenX, z: vx.z / lenX };

    const vy = {
      x: forehead.x - chin.x,
      y: forehead.y - chin.y,
      z: forehead.z - chin.z
    };
    const dotProduct = vy.x * ux.x + vy.y * ux.y + vy.z * ux.z;
    const vyOrth = {
      x: vy.x - dotProduct * ux.x,
      y: vy.y - dotProduct * ux.y,
      z: vy.z - dotProduct * ux.z
    };
    const lenY = Math.hypot(vyOrth.x, vyOrth.y, vyOrth.z) || 0.0001;
    const uy = { x: vyOrth.x / lenY, y: vyOrth.y / lenY, z: vyOrth.z / lenY };

    const uz = {
      x: ux.y * uy.z - ux.z * uy.y,
      y: ux.z * uy.x - ux.x * uy.z,
      z: ux.x * uy.y - ux.y * uy.x
    };

    const yaw = Math.atan2(uz.x, uz.z);
    const pitch = Math.atan2(-uz.y, Math.hypot(uz.x, uz.z));
    const roll = Math.atan2(ux.y, ux.x);

    const radToDeg = (rad) => rad * (180 / Math.PI);

    return {
      pitch: Number(radToDeg(pitch).toFixed(2)),
      yaw: Number(radToDeg(yaw).toFixed(2)),
      roll: Number(radToDeg(roll).toFixed(2))
    };
  }

  calculateScale(landmarks) {
    const leftCheek = landmarks[234];
    const rightCheek = landmarks[454];
    const forehead = landmarks[10];
    const chin = landmarks[152];

    if (!leftCheek || !rightCheek || !forehead || !chin) {
      return { x: 0, y: 0, z: 0 };
    }

    const width = Math.hypot(rightCheek.x - leftCheek.x, rightCheek.y - leftCheek.y, rightCheek.z - leftCheek.z);
    const height = Math.hypot(forehead.x - chin.x, forehead.y - chin.y, forehead.z - chin.z);
    const depth = (width + height) / 2;

    return {
      x: Number(width.toFixed(4)),
      y: Number(height.toFixed(4)),
      z: Number(depth.toFixed(4))
    };
  }

  calculateTranslation(landmarks) {
    const nose = landmarks[4];
    if (!nose) {
      return { x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0 };
    }

    const videoWidth = this.videoElement ? this.videoElement.videoWidth : 640;
    const videoHeight = this.videoElement ? this.videoElement.videoHeight : 480;

    const x = nose.x;
    const y = nose.y;
    const z = nose.z;

    const px = Math.round(x * videoWidth);
    const py = Math.round(y * videoHeight);
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
