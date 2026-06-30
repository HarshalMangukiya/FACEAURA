/**
 * WorkerManager.ts
 *
 * Orchestrates worker instantiation, zero-copy ImageBitmap transfers,
 * and maintains telemetry. Fallbacks gracefully to main-thread processing
 * if Web Workers are unsupported, replicating the exact same coordinate pipeline.
 */

import { faceDetectionService } from '../../tracking/FaceDetectionService';
import { LandmarkSmoother } from '../tracking/LandmarkSmoother';
import {
  decomposeMatrixToQuat,
  estimatePoseFromGeometry,
  calculateBiometricsJS,
  resolveAnchorsJS,
  composeMatrix,
  invertMatrix,
  quaternionToEulerXYZ,
  eulerToQuaternionXYZ
} from './tracker.worker.math';

export interface TrackingTelemetry {
  faceDetected: boolean;
  landmarks: any[];
  pose?: {
    position: [number, number, number];
    quaternion: [number, number, number, number];
    scale: [number, number, number];
  };
  biometrics?: any;
  anchors?: any;
  blendshapes: Record<string, number> | any[]; // parsed record from worker, or raw array
  confidence?: {
    facePresenceScore: number;
    faceDetectionConfidence: number;
    trackingConfidence: number;
  };
  timestamp: number;
  latency: number;
  workerLatency?: number;
}

export class WorkerManager {
  private worker: Worker | null = null;
  private isReady: boolean = false;
  private isProcessing: boolean = false;
  private fallbackMode: boolean = false;

  private onTelemetryCallback: ((telemetry: TrackingTelemetry) => void) | null = null;

  // Filters for fallback mode (synchronous main thread execution)
  private fallbackSmoother = new LandmarkSmoother();
  private prevQuat = [0, 0, 0, 1];
  private isFirstFrame = true;

  constructor() {}

  /**
   * Initializes the tracker worker or main-thread fallback service.
   */
  public async initialize(onTelemetry: (t: TrackingTelemetry) => void): Promise<boolean> {
    this.onTelemetryCallback = onTelemetry;

    if (this.worker) {
      try {
        this.worker.terminate();
      } catch (e) {
        console.error('[WorkerManager] Error terminating worker:', e);
      }
      this.worker = null;
    }
    this.isReady = false;
    this.fallbackMode = false;
    this.isProcessing = false;
    this.isFirstFrame = true;
    this.prevQuat = [0, 0, 0, 1];

    if (typeof Worker === 'undefined') {
      console.warn('[WorkerManager] Web Workers are unsupported. Using main thread fallback.');
      this.fallbackMode = true;
      try {
        await faceDetectionService.initialize();
        this.isReady = true;
      } catch (err) {
        console.error('[WorkerManager] Fallback initialization failed:', err);
      }
      return false;
    }

    try {
      this.worker = new Worker(new URL('./tracker.worker.ts', import.meta.url), {
        type: 'module'
      });

      this.worker.onerror = async (err) => {
        console.error('[WorkerManager] Web Worker error, falling back:', err);
        this.fallbackMode = true;
        this.isReady = false;
        try {
          await faceDetectionService.initialize();
          this.isReady = true;
        } catch (initErr) {
          console.error('[WorkerManager] Failed to initialize fallback service:', initErr);
        }
        this.isProcessing = false;
      };

      this.worker.onmessage = (event) => {
        const { type, faceDetected, landmarks, pose, biometrics, anchors, blendshapes, confidence, timestamp, latency, error } = event.data;

        if (type === 'INIT_SUCCESS') {
          console.log('[WorkerManager] Web Worker initialized successfully.');
          this.isReady = true;
        } else if (type === 'INIT_ERROR') {
          console.error('[WorkerManager] Worker init failed, falling back:', error);
          this.fallbackMode = true;
          this.isReady = false;
          faceDetectionService.initialize()
            .then(() => {
              this.isReady = true;
            })
            .catch((initErr) => {
              console.error('[WorkerManager] Failed to initialize fallback service:', initErr);
            });
        } else if (type === 'TRACKING_RESULT') {
          this.isProcessing = false;
          if (error) {
            console.warn('[WorkerManager] Tracking error, falling back:', error);
            this.fallbackMode = true;
            this.isReady = false;
            faceDetectionService.initialize()
              .then(() => {
                this.isReady = true;
              })
              .catch((initErr) => {
                console.error('[WorkerManager] Failed to initialize fallback service:', initErr);
              });
            return;
          }

          if (this.onTelemetryCallback) {
            this.onTelemetryCallback({
              faceDetected: faceDetected || false,
              landmarks: landmarks || [],
              pose,
              biometrics,
              anchors,
              blendshapes: blendshapes || {},
              confidence,
              timestamp,
              latency: latency || 0,
              workerLatency: latency || 0
            });
          }
        }
      };

      // Trigger initialization
      this.worker.postMessage({ type: 'INIT' });
      return true;
    } catch (err) {
      console.error('[WorkerManager] Failed to spawn worker, using fallback:', err);
      this.fallbackMode = true;
      this.isReady = false;
      try {
        await faceDetectionService.initialize();
        this.isReady = true;
      } catch (initErr) {
        console.error('[WorkerManager] Failed to initialize fallback service:', initErr);
      }
      return false;
    }
  }

  /**
   * Posts the current video frame to the Web Worker for off-thread processing.
   */
  public async processFrame(video: HTMLVideoElement, timestamp: number) {
    if (!this.isReady || video.readyState < 2) return;

    const intTimestamp = Math.round(timestamp);
    const videoWidth = video.videoWidth || 640;
    const videoHeight = video.videoHeight || 480;
    const aspect = videoWidth / videoHeight;

    if (this.fallbackMode) {
      // Main thread fallback: replicate the exact mathematical pipeline synchronously
      const service: any = faceDetectionService;
      if (!service.landmarker) return;

      const start = performance.now();
      try {
        const results = service.detectForVideo(video, intTimestamp);
        const latency = performance.now() - start;

        if (this.onTelemetryCallback) {
          if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
            const rawLandmarks = results.faceLandmarks[0];

            // 1. Smooth landmarks
            const smoothedLandmarks = this.fallbackSmoother.smoothLandmarks(rawLandmarks, intTimestamp);

            // 2. Pose estimation
            let position: [number, number, number] = [0, 0, 0];
            let quaternion: [number, number, number, number] = [0, 0, 0, 1];
            let scale: [number, number, number] = [1, 1, 1];

            const matrix = results.facialTransformationMatrixes[0];
            if (matrix && matrix.length === 16) {
              const rawPose = decomposeMatrixToQuat(matrix);
              position = [rawPose.position[0], -rawPose.position[1], -rawPose.position[2]];
              
              const rawEuler = quaternionToEulerXYZ(rawPose.quaternion);
              const flippedEuler = [rawEuler[0], -rawEuler[1], -rawEuler[2]];
              quaternion = eulerToQuaternionXYZ(flippedEuler[0], flippedEuler[1], flippedEuler[2]);
              scale = rawPose.scale;
            } else {
              const fallback = estimatePoseFromGeometry(smoothedLandmarks, aspect);
              position = fallback.position;
              quaternion = fallback.quaternion;
              scale = fallback.scale;
            }

            // 3. Stabilization
            if (this.isFirstFrame) {
              this.prevQuat = [...quaternion];
              this.isFirstFrame = false;
            }
            
            // Slerp rotation
            const slerpT = 0.25;
            let cosHalfTheta = this.prevQuat[0]*quaternion[0] + this.prevQuat[1]*quaternion[1] + this.prevQuat[2]*quaternion[2] + this.prevQuat[3]*quaternion[3];
            let q2Copy = [...quaternion];
            if (cosHalfTheta < 0) {
              cosHalfTheta = -cosHalfTheta;
              q2Copy = q2Copy.map(v => -v);
            }
            let smoothedQuat = [...this.prevQuat];
            if (Math.abs(cosHalfTheta) < 1.0) {
              const halfTheta = Math.acos(cosHalfTheta);
              const sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta*cosHalfTheta);
              if (Math.abs(sinHalfTheta) >= 0.001) {
                const ratioA = Math.sin((1 - slerpT) * halfTheta) / sinHalfTheta;
                const ratioB = Math.sin(slerpT * halfTheta) / sinHalfTheta;
                smoothedQuat = [
                  this.prevQuat[0]*ratioA + q2Copy[0]*ratioB,
                  this.prevQuat[1]*ratioA + q2Copy[1]*ratioB,
                  this.prevQuat[2]*ratioA + q2Copy[2]*ratioB,
                  this.prevQuat[3]*ratioA + q2Copy[3]*ratioB
                ];
              }
            }
            this.prevQuat = [...smoothedQuat];

            // Kalman filter translation
            const filteredPos = this.fallbackSmoother.smoothTranslation({ x: position[0], y: position[1], z: position[2] }, intTimestamp);
            const smoothedPosition: [number, number, number] = [filteredPos.x, filteredPos.y, filteredPos.z];

            // 4. Biometrics
            const biometrics = calculateBiometricsJS(smoothedLandmarks, aspect);

            // 5. Inverse Head Matrix
            const localHeadMatrix = composeMatrix(smoothedPosition, smoothedQuat, [1, 1, 1]);
            const headMatrixInverse = invertMatrix(localHeadMatrix);

            // 6. Anchors
            const anchors = resolveAnchorsJS(smoothedLandmarks, smoothedQuat, aspect, headMatrixInverse);

            // 7. Blendshapes mapping
            const blendshapes: Record<string, number> = {};
            const categories = results.faceBlendshapes[0]?.categories || [];
            for (const cat of categories) {
              blendshapes[cat.categoryName] = cat.score;
            }
            if (blendshapes['jawOpen'] !== undefined && blendshapes['mouthOpen'] === undefined) {
              blendshapes['mouthOpen'] = blendshapes['jawOpen'];
            }

            const facePresenceScore = 1.0;
            const faceDetectionConfidence = 0.92;
            const trackingConfidence = 0.95;

            this.onTelemetryCallback({
              faceDetected: true,
              landmarks: smoothedLandmarks,
              pose: {
                position: smoothedPosition,
                quaternion: smoothedQuat as [number, number, number, number],
                scale
              },
              biometrics,
              anchors,
              blendshapes,
              confidence: {
                facePresenceScore,
                faceDetectionConfidence,
                trackingConfidence
              },
              timestamp: intTimestamp,
              latency
            });
          } else {
            this.isFirstFrame = true;
            this.onTelemetryCallback({
              faceDetected: false,
              landmarks: [],
              blendshapes: {},
              timestamp: intTimestamp,
              latency
            });
          }
        }
      } catch (err) {
        console.error('[WorkerManager] Fallback detection error:', err);
        if (this.onTelemetryCallback) {
          this.onTelemetryCallback({
            faceDetected: false,
            landmarks: [],
            blendshapes: {},
            timestamp: intTimestamp,
            latency: 0
          });
        }
      }
      return;
    }

    // Web Worker path: serialize frame bitmap and submit to background
    if (this.isProcessing || !this.worker) return;
    this.isProcessing = true;

    try {
      const imageBitmap = await createImageBitmap(video);
      this.worker.postMessage(
        {
          type: 'PROCESS_FRAME',
          data: {
            imageBitmap,
            timestamp: intTimestamp,
            width: videoWidth,
            height: videoHeight,
            aspect
          }
        },
        [imageBitmap] // Transfer ownership
      );
    } catch (err) {
      console.error('[WorkerManager] Frame transfer failed:', err);
      this.isProcessing = false;
    }
  }

  /**
   * Cleanup resource allocations.
   */
  public destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    faceDetectionService.destroy();
    this.isReady = false;
    this.isProcessing = false;
  }
}
export default WorkerManager;
