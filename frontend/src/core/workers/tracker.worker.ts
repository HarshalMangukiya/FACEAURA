/**
 * tracker.worker.ts
 *
 * Web Worker running the MediaPipe FaceLandmarker off the main thread.
 * Receives ImageBitmap frames via Transferable Objects, performs ML inference,
 * and posts back landmarks, blendshapes, and transformation matrices.
 */

// Declare self scope for worker context
const ctx: any = self;

let landmarker: any = null;
let isInitializing = false;

// Load MediaPipe Tasks Vision binaries from CDN inside the worker thread
ctx.importScripts('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm/tasks-vision.js');

const initFaceLandmarker = async () => {
  if (landmarker || isInitializing) return;
  isInitializing = true;

  try {
    const vision = (self as any).tasksVision;
    if (!vision) {
      throw new Error('Tasks Vision library not loaded from CDN.');
    }

    const filesetResolver = await vision.FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
    );

    landmarker = await vision.FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'CPU', // Fallback to CPU inside the Web Worker since WebGL delegates can conflict in background threads
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });

    ctx.postMessage({ type: 'INIT_SUCCESS' });
  } catch (err: any) {
    console.error('[TrackerWorker] Failed initialization:', err);
    ctx.postMessage({ type: 'INIT_ERROR', error: err.message });
    isInitializing = false;
  }
};

ctx.onmessage = async (event: MessageEvent) => {
  const { type, data } = event.data;

  if (type === 'INIT') {
    await initFaceLandmarker();
    return;
  }

  if (type === 'PROCESS_FRAME') {
    if (!landmarker) {
      ctx.postMessage({ type: 'TRACKING_RESULT', faceDetected: false, error: 'Landmarker not ready.' });
      return;
    }

    const { imageBitmap, timestamp } = data;

    try {
      // Run inference on the ImageBitmap
      const start = performance.now();
      const result = landmarker.detectForVideo(imageBitmap, timestamp);
      const latency = performance.now() - start;

      // Close bitmap immediately to avoid memory leaks
      imageBitmap.close();

      if (result && result.faceLandmarks && result.faceLandmarks.length > 0) {
        ctx.postMessage({
          type: 'TRACKING_RESULT',
          faceDetected: true,
          landmarks: result.faceLandmarks[0],
          blendshapes: result.faceBlendshapes[0]?.categories || [],
          transformationMatrix: result.facialTransformationMatrixes[0] || null,
          timestamp,
          latency
        });
      } else {
        ctx.postMessage({
          type: 'TRACKING_RESULT',
          faceDetected: false,
          timestamp,
          latency
        });
      }
    } catch (err: any) {
      ctx.postMessage({
        type: 'TRACKING_RESULT',
        faceDetected: false,
        error: err.message,
        timestamp
      });
    }
  }
};
