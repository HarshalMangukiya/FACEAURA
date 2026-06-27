/**
 * PoseEstimator.ts
 *
 * Extracts and refines 3D head pose from MediaPipe's tracking telemetry.
 * Primary: Decomposes the 4x4 Facial Transformation Matrix directly solved by MediaPipe Tasks Vision.
 * Fallback: Computes rotation and position using key landmark vector projections.
 * Enhancements: Estimates neck tilt and pupil/eye direction.
 */

import * as THREE from 'three';

export interface HeadPose {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  eyeDirection: { left: THREE.Vector2; right: THREE.Vector2 };
  neckRotation: THREE.Euler;
  faceNormal: THREE.Vector3;
}

export class PoseEstimator {
  private tempMatrix = new THREE.Matrix4();
  private tempPos = new THREE.Vector3();
  private tempQuat = new THREE.Quaternion();
  private tempScale = new THREE.Vector3();

  constructor() {}

  /**
   * Estimates the head pose using FaceLandmarker outputs.
   *
   * @param landmarks Array of 468/478 3D points
   * @param transformationMatrix The Float32Array 4x4 matrix from MediaPipe (optional)
   * @param blendshapes Blendshape results (optional)
   * @param width Viewport width
   * @param height Viewport height
   */
  public estimatePose(
    landmarks: any[],
    transformationMatrix?: number[] | Float32Array,
    blendshapes?: any[],
    width: number = 640,
    height: number = 480
  ): HeadPose {
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const rotation = new THREE.Euler();
    const scale = new THREE.Vector3(1, 1, 1);
    const faceNormal = new THREE.Vector3(0, 0, 1);

    // 1. PRIMARY PATH: Decompose Facial Transformation Matrix
    if (transformationMatrix && transformationMatrix.length === 16) {
      this.tempMatrix.fromArray(Array.from(transformationMatrix));
      
      // Decompose matrix
      this.tempMatrix.decompose(this.tempPos, this.tempQuat, this.tempScale);
      
      // Map to ThreeJS space (flip Y and Z coordinate directions to match WebGL standards)
      position.copy(this.tempPos);
      position.y = -position.y;
      position.z = -position.z;
      
      quaternion.copy(this.tempQuat);
      // Adjust quaternion rotations to match coordinate transformations
      const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ');
      euler.y = -euler.y;
      euler.z = -euler.z;
      quaternion.setFromEuler(euler);
      
      rotation.setFromQuaternion(quaternion, 'XYZ');
      scale.copy(this.tempScale);
    } else {
      // 2. FALLBACK PATH: Geometric estimation from landmarks
      this.estimateFromGeometry(landmarks, position, rotation, quaternion, scale, width, height);
    }

    // 3. Compute face normal vector pointing outward from the nose bridge
    faceNormal.set(0, 0, 1).applyQuaternion(quaternion);

    // 4. Estimate Eye look directions (Pupil coordinates)
    const eyeDirection = this.estimateEyeDirections(landmarks, blendshapes);

    // 5. Estimate Neck Flexion/Torsion (Slightly dampened version of head rotation)
    const neckRotation = new THREE.Euler(
      rotation.x * 0.35,
      rotation.y * 0.35,
      rotation.z * 0.20
    );

    return {
      position,
      quaternion,
      rotation,
      scale,
      eyeDirection,
      neckRotation,
      faceNormal
    };
  }

  /**
   * Backup geometric estimator utilizing vector cross products and distance ratios.
   */
  private estimateFromGeometry(
    landmarks: any[],
    pos: THREE.Vector3,
    rot: THREE.Euler,
    quat: THREE.Quaternion,
    scale: THREE.Vector3,
    width: number,
    height: number
  ) {
    if (!landmarks || landmarks.length < 152) return;

    const leftEye = landmarks[133];
    const rightEye = landmarks[362];
    const nose = landmarks[4];
    const chin = landmarks[152];
    const forehead = landmarks[10];

    // Compute position (mapped to viewport space)
    pos.set(
      (nose.x - 0.5) * (width / height) * 10,
      -(nose.y - 0.5) * 10,
      -nose.z * 10
    );

    // X vector (eye to eye)
    const vx = new THREE.Vector3(rightEye.x - leftEye.x, -(rightEye.y - leftEye.y), -(rightEye.z - leftEye.z)).normalize();
    
    // Y vector (chin to forehead)
    const vyRaw = new THREE.Vector3(forehead.x - chin.x, -(forehead.y - chin.y), -(forehead.z - chin.z));
    // Orthogonalize Y relative to X
    const dot = vyRaw.dot(vx);
    const vy = vyRaw.subVectors(vyRaw, vx.clone().multiplyScalar(dot)).normalize();

    // Z vector (orthogonal cross product)
    const vz = new THREE.Vector3().crossVectors(vx, vy).normalize();

    // Create rotation matrix
    const m = new THREE.Matrix4().makeBasis(vx, vy, vz);
    quat.setFromRotationMatrix(m);
    rot.setFromQuaternion(quat, 'XYZ');

    // Scale estimate
    const w = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y, rightEye.z - leftEye.z);
    const h = Math.hypot(forehead.x - chin.x, forehead.y - chin.y, forehead.z - chin.z);
    scale.set(w * 5, h * 5, (w + h) * 2.5);
  }

  /**
   * Estimates 2D eye lookup vectors from blendshapes if available.
   * Uses standard MediaPipe Tasks Vision Blendshape indices:
   * eyeLookInLeft (13), eyeLookOutLeft (14), eyeLookUpLeft (15), eyeLookDownLeft (16)
   * eyeLookInRight (17), eyeLookOutRight (18), eyeLookUpRight (19), eyeLookDownRight (20)
   */
  private estimateEyeDirections(landmarks: any[], blendshapes?: any[]) {
    const left = new THREE.Vector2(0, 0);
    const right = new THREE.Vector2(0, 0);

    if (blendshapes && blendshapes.length > 0) {
      const getScore = (name: string) => {
        const found = blendshapes.find(b => b.categoryName === name || b.name === name);
        return found ? found.score : 0;
      };

      // Left eye direction
      // Look horizontal: eyeLookOutLeft (outward/left) vs eyeLookInLeft (inward/right)
      const lookInL = getScore('eyeLookInLeft');
      const lookOutL = getScore('eyeLookOutLeft');
      left.x = lookOutL - lookInL;

      // Look vertical: eyeLookUpLeft vs eyeLookDownLeft
      const lookUpL = getScore('eyeLookUpLeft');
      const lookDownL = getScore('eyeLookDownLeft');
      left.y = lookUpL - lookDownL;

      // Right eye direction
      // Look horizontal: eyeLookInRight (inward/left) vs eyeLookOutRight (outward/right)
      const lookInR = getScore('eyeLookInRight');
      const lookOutR = getScore('eyeLookOutRight');
      right.x = lookOutR - lookInR;

      const lookUpR = getScore('eyeLookUpRight');
      const lookDownR = getScore('eyeLookDownRight');
      right.y = lookUpR - lookDownR;
    }

    return { left, right };
  }
}

export const poseEstimator = new PoseEstimator();
export default poseEstimator;
