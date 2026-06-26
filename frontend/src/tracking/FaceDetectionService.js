import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

/**
 * FaceDetectionService Class
 * 
 * A singleton service that handles the lifecycle and execution of the 
 * MediaPipe client-side FaceLandmarker. Loads required WebAssembly binaries
 * and model files from the CDN, and exposes frame detection.
 */
class FaceDetectionService {
  constructor() {
    this.landmarker = null;
    this.loadingPromise = null;
  }

  /**
   * Initialize the FaceLandmarker instance.
   * Caches initialization to prevent multiple parallel setup operations.
   * 
   * @returns {Promise<FaceLandmarker>} The initialized landmarker instance
   */
  async initialize() {
    if (this.landmarker) {
      return this.landmarker;
    }
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = (async () => {
      try {
        console.log('[FaceDetectionService] Initializing fileset resolver...');
        // Load WebAssembly fileset from CDN to bypass bundle size constraints
        const filesetResolver = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        console.log('[FaceDetectionService] Creating FaceLandmarker instance...');
        this.landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        });

        console.log('[FaceDetectionService] FaceLandmarker initialized successfully.');
        return this.landmarker;
      } catch (error) {
        console.error('[FaceDetectionService] Failed to initialize FaceLandmarker:', error);
        this.loadingPromise = null;
        throw error;
      }
    })();

    return this.loadingPromise;
  }

  /**
   * Run face detection on a single frame of a video element.
   * 
   * @param {HTMLVideoElement} videoElement The active video feed element
   * @param {number} timestamp The current high-res timestamp (performance.now())
   * @returns {Object} MediaPipe FaceLandmarker detection result
   */
  detectForVideo(videoElement, timestamp) {
    if (!this.landmarker) {
      throw new Error('[FaceDetectionService] FaceLandmarker not initialized. Call initialize() first.');
    }
    
    // Ensure video is in a ready state with valid dimensions
    if (videoElement.readyState < 2) {
      return null;
    }

    return this.landmarker.detectForVideo(videoElement, timestamp);
  }

  /**
   * Close and dispose of the FaceLandmarker resources.
   */
  destroy() {
    if (this.landmarker) {
      try {
        this.landmarker.close();
        console.log('[FaceDetectionService] FaceLandmarker resources disposed.');
      } catch (err) {
        console.error('[FaceDetectionService] Error while closing FaceLandmarker:', err);
      }
      this.landmarker = null;
      this.loadingPromise = null;
    }
  }
}

export const faceDetectionService = new FaceDetectionService();
export default faceDetectionService;
