/**
 * WorkerManager.ts
 *
 * Orchestrates worker instantiation, zero-copy ImageBitmap transfers,
 * and tracks tracking latencies. Fallbacks gracefully to main-thread processing
 * if Web Workers are unsupported.
 */

import { faceDetectionService } from '../../tracking/FaceDetectionService';

export interface TrackingTelemetry {
  faceDetected: boolean;
  landmarks: any[];
  blendshapes: any[];
  transformationMatrix: Float32Array | null;
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

  constructor() {}

  /**
   * Initializes the tracker worker or main-thread fallback service.
   */
  public async initialize(onTelemetry: (t: TrackingTelemetry) => void): Promise<boolean> {
    this.onTelemetryCallback = onTelemetry;

    if (typeof Worker === 'undefined') {
      console.warn('[WorkerManager] Web Workers are unsupported. Using main thread fallback.');
      this.fallbackMode = true;
      await faceDetectionService.initialize();
      this.isReady = true;
      return false;
    }

    try {
      // In Vite, workers are instantiated using new URL:
      this.worker = new Worker(new URL('./tracker.worker.ts', import.meta.url), {
        type: 'module'
      });

      this.worker.onmessage = (event) => {
        const { type, faceDetected, landmarks, blendshapes, transformationMatrix, timestamp, latency, error } = event.data;

        if (type === 'INIT_SUCCESS') {
          console.log('[WorkerManager] Web Worker initialized successfully.');
          this.isReady = true;
        } else if (type === 'INIT_ERROR') {
          console.error('[WorkerManager] Worker init failed, falling back:', error);
          this.fallbackMode = true;
          this.isReady = true;
        } else if (type === 'TRACKING_RESULT') {
          this.isProcessing = false;
          if (error) {
            console.warn('[WorkerManager] Tracking error:', error);
            return;
          }

          if (this.onTelemetryCallback) {
            this.onTelemetryCallback({
              faceDetected: faceDetected || false,
              landmarks: landmarks || [],
              blendshapes: blendshapes || [],
              transformationMatrix: transformationMatrix || null,
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
      await faceDetectionService.initialize();
      this.isReady = true;
      return false;
    }
  }

  /**
   * Posts the current video frame to the Web Worker for off-thread processing.
   * If fallbackMode is active, executes the landmarker synchronously on the main thread.
   */
  public async processFrame(video: HTMLVideoElement, timestamp: number) {
    if (!this.isReady || video.readyState < 2) return;

    if (this.fallbackMode) {
      // Main thread fallback execution
      const start = performance.now();
      const results: any = faceDetectionService.detectForVideo(video, timestamp);
      const latency = performance.now() - start;

      if (this.onTelemetryCallback) {
        if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
          this.onTelemetryCallback({
            faceDetected: true,
            landmarks: results.faceLandmarks[0],
            blendshapes: results.faceBlendshapes[0]?.categories || [],
            transformationMatrix: results.facialTransformationMatrixes[0] || null,
            timestamp,
            latency
          });
        } else {
          this.onTelemetryCallback({
            faceDetected: false,
            landmarks: [],
            blendshapes: [],
            transformationMatrix: null,
            timestamp,
            latency
          });
        }
      }
      return;
    }

    // Web Worker path: serialize frame to ImageBitmap using zero-copy transfer
    if (this.isProcessing || !this.worker) return;
    this.isProcessing = true;

    try {
      const imageBitmap = await createImageBitmap(video);
      this.worker.postMessage(
        {
          type: 'PROCESS_FRAME',
          data: { imageBitmap, timestamp }
        },
        [imageBitmap] // Transfer ownership of the ImageBitmap to avoid memory copies!
      );
    } catch (err) {
      console.error('[WorkerManager] Frame serialization failed:', err);
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
