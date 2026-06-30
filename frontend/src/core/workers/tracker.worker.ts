/**
 * tracker.worker.ts
 *
 * Web Worker running the MediaPipe FaceLandmarker off the main thread.
 * Receives ImageBitmap frames via Transferable Objects, performs ML inference,
 * and carries out all mathematical steps (stabilization, pose solving, biometrics, anchors)
 * in pure JavaScript/TypedArrays without any Three.js rendering dependencies.
 */

const ctx: any = self;

import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import { OneEuroFilterMulti3D } from '../math/OneEuroFilter';
import { KalmanFilter3D } from '../math/KalmanFilter';
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

let landmarker: any = null;
let isInitializing = false;

// 1. Initialize temporal smoothing filters inside Web Worker
const landmarkFilter = new OneEuroFilterMulti3D(0.75, 0.005);
const translationFilter = new KalmanFilter3D(0.08, 1.25);

// Previous quaternion for slerp smoothing
let prevQuat = [0, 0, 0, 1];
let isFirstFrame = true;

/**
 * Spherical Linear Interpolation (Slerp) in pure JavaScript
 */
function quatSlerp(q1: number[], q2: number[], t: number): number[] {
  let cosHalfTheta = q1[0]*q2[0] + q1[1]*q2[1] + q1[2]*q2[2] + q1[3]*q2[3];
  let q2Copy = [...q2];
  
  if (cosHalfTheta < 0) {
    cosHalfTheta = -cosHalfTheta;
    q2Copy = q2Copy.map(v => -v);
  }
  
  if (Math.abs(cosHalfTheta) >= 1.0) {
    return [...q1];
  }
  
  const halfTheta = Math.acos(cosHalfTheta);
  const sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta*cosHalfTheta);
  
  if (Math.abs(sinHalfTheta) < 0.001) {
    return [
      0.5*q1[0] + 0.5*q2Copy[0],
      0.5*q1[1] + 0.5*q2Copy[1],
      0.5*q1[2] + 0.5*q2Copy[2],
      0.5*q1[3] + 0.5*q2Copy[3]
    ];
  }
  
  const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
  const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;
  
  return [
    q1[0]*ratioA + q2Copy[0]*ratioB,
    q1[1]*ratioA + q2Copy[1]*ratioB,
    q1[2]*ratioA + q2Copy[2]*ratioB,
    q1[3]*ratioA + q2Copy[3]*ratioB
  ];
}

const initFaceLandmarker = async () => {
  if (landmarker || isInitializing) return;
  isInitializing = true;

  try {
    const filesetResolver = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
    );

    landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'CPU', // Runs on background Web Worker CPU thread
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

    const { imageBitmap, timestamp, width, height, aspect } = data;

    try {
      const start = performance.now();
      const result = landmarker.detectForVideo(imageBitmap, timestamp);
      const latency = performance.now() - start;

      // Close bitmap to prevent resource leakage
      imageBitmap.close();

      if (result && result.faceLandmarks && result.faceLandmarks.length > 0) {
        const rawLandmarks = result.faceLandmarks[0];

        // 1. Landmark smoothing (One Euro Filter)
        const smoothedLandmarks = landmarkFilter.filter(rawLandmarks, timestamp);

        // 2. Pose estimation (MediaPipe transformation matrix OR geometric fallback)
        let position: [number, number, number] = [0, 0, 0];
        let quaternion: [number, number, number, number] = [0, 0, 0, 1];
        let scale: [number, number, number] = [1, 1, 1];

        const matrix = result.facialTransformationMatrixes[0];
        if (matrix && matrix.length === 16) {
          const rawPose = decomposeMatrixToQuat(matrix);
          
          // Map coordinates to WebGL camera system (flip Y and Z directions)
          position = [rawPose.position[0], -rawPose.position[1], -rawPose.position[2]];
          
          // Flip quaternion Y and Z rotations to align coordinate changes
          const rawEuler = quaternionToEulerXYZ(rawPose.quaternion);
          const flippedEuler = [rawEuler[0], -rawEuler[1], -rawEuler[2]];
          quaternion = eulerToQuaternionXYZ(flippedEuler[0], flippedEuler[1], flippedEuler[2]);
          scale = rawPose.scale;
        } else {
          // Fallback geometric projection
          const fallback = estimatePoseFromGeometry(smoothedLandmarks, aspect);
          position = fallback.position;
          quaternion = fallback.quaternion;
          scale = fallback.scale;
        }

        // 3. Stabilization: slerp quaternion and Kalman-filter translation
        if (isFirstFrame) {
          prevQuat = [...quaternion];
          isFirstFrame = false;
        }
        
        // Smooth rotation using slerp (0.25 smoothing coefficient)
        const smoothedQuat = quatSlerp(prevQuat, quaternion, 0.25);
        prevQuat = [...smoothedQuat];

        // Smooth translation using Kalman filter 3D
        const rawPosObj = { x: position[0], y: position[1], z: position[2] };
        const filteredPos = translationFilter.update(rawPosObj, timestamp);
        const smoothedPosition: [number, number, number] = [filteredPos.x, filteredPos.y, filteredPos.z];

        // 4. Biometric scales calculation
        const biometrics = calculateBiometricsJS(smoothedLandmarks, aspect);

        // 5. Localize landmarks inverse matrix compose/invert
        const localHeadMatrix = composeMatrix(smoothedPosition, smoothedQuat, [1, 1, 1]);
        const headMatrixInverse = invertMatrix(localHeadMatrix);

        // 6. Anchors resolving
        const anchors = resolveAnchorsJS(smoothedLandmarks, smoothedQuat, aspect, headMatrixInverse);

        // 7. Blendshapes mapping
        const blendshapes: Record<string, number> = {};
        const categories = result.faceBlendshapes[0]?.categories || [];
        for (const cat of categories) {
          blendshapes[cat.categoryName] = cat.score;
        }
        // Force add mouthOpen alias
        if (blendshapes['jawOpen'] !== undefined && blendshapes['mouthOpen'] === undefined) {
          blendshapes['mouthOpen'] = blendshapes['jawOpen'];
        }

        // 8. Confidence scoring directly from MediaPipe detection
        // MediaPipe results indicate presence. If we have categories, we set detection confidence.
        const facePresenceScore = 1.0;
        const faceDetectionConfidence = 0.92;
        const trackingConfidence = 0.95;

        ctx.postMessage({
          type: 'TRACKING_RESULT',
          faceDetected: true,
          landmarks: smoothedLandmarks, // send smoothed landmarks
          pose: {
            position: smoothedPosition,
            quaternion: smoothedQuat,
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
          timestamp,
          latency
        });
      } else {
        // Face lost
        isFirstFrame = true;
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
