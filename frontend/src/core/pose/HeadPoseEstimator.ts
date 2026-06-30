/**
 * HeadPoseEstimator.ts
 *
 * Extracts and calculates the 3D head pose (position, rotation quaternion, Euler angles, scale)
 * from MediaPipe's tracking telemetry.
 *
 * Calculations:
 * 1. Primary: Decomposes the pre-computed 4x4 Facial Transformation Matrix directly solved by
 *    MediaPipe Tasks Vision (which uses an internally optimized PnP solver).
 * 2. Fallback: Employs a vector projection-based rigid transform solver to reconstruct the head
 *    basis vectors (Right/X, Up/Y, Forward/Z) from key facial landmarks (eyes, chin, forehead).
 * 3. Rotations: Converts coordinate spaces to WebGL standard (flipping Y and Z directions).
 */

import * as THREE from 'three';

export interface HeadPose {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  faceNormal: THREE.Vector3;
}

export class HeadPoseEstimator {
  private tempMatrix = new THREE.Matrix4();
  private tempPos = new THREE.Vector3();
  private tempQuat = new THREE.Quaternion();
  private tempScale = new THREE.Vector3();

  constructor() {}

  /**
   * Estimates the 3D pose of the head.
   *
   * @param landmarks Normalized 3D landmarks (length 468 or 478)
   * @param transformationMatrix Flat float array of size 16 from MediaPipe (optional)
   * @param aspect Camera aspect ratio (width / height)
   */
  public estimatePose(
    landmarks: any[],
    transformationMatrix?: number[] | Float32Array | null,
    aspect: number = 4 / 3
  ): HeadPose {
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const rotation = new THREE.Euler(0, 0, 0, 'XYZ');
    const scale = new THREE.Vector3(1, 1, 1);
    const faceNormal = new THREE.Vector3(0, 0, 1);

    // 1. PRIMARY PATH: Decompose Facial Transformation Matrix
    if (transformationMatrix && (transformationMatrix.length === 16 || (transformationMatrix as any).byteLength === 64)) {
      const matArray = Array.from(transformationMatrix as any) as number[];
      this.tempMatrix.fromArray(matArray);
      
      // Decompose matrix into position, quaternion, and scale components
      this.tempMatrix.decompose(this.tempPos, this.tempQuat, this.tempScale);
      
      // Map positions to ThreeJS space (flip Y and Z to match WebGL camera system)
      position.copy(this.tempPos);
      position.y = -position.y;
      position.z = -position.z;
      
      // Adjust quaternion rotation to account for the flipped coordinate axes
      quaternion.copy(this.tempQuat);
      const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ');
      euler.y = -euler.y;
      euler.z = -euler.z;
      quaternion.setFromEuler(euler);
      
      rotation.setFromQuaternion(quaternion, 'XYZ');
      scale.copy(this.tempScale);
    } else {
      // 2. FALLBACK PATH: Geometric rigid transform alignment from key landmarks
      this.estimateFromGeometry(landmarks, position, rotation, quaternion, scale, aspect);
    }

    // 3. Compute outward-facing face normal (for lighting and occlusion culling)
    faceNormal.set(0, 0, 1).applyQuaternion(quaternion);

    return {
      position,
      quaternion,
      rotation,
      scale,
      faceNormal
    };
  }

  /**
   * Reconstructs the 3D transformation matrix using orthogonalized facial basis vectors.
   *
   * Landmarks used:
   * - Left Eye Outer Corner (133)
   * - Right Eye Outer Corner (362)
   * - Chin Bottom (152)
   * - Forehead Hairline (10)
   * - Nose Tip (4)
   */
  private estimateFromGeometry(
    landmarks: any[],
    pos: THREE.Vector3,
    rot: THREE.Euler,
    quat: THREE.Quaternion,
    scale: THREE.Vector3,
    aspect: number
  ): void {
    if (!landmarks || landmarks.length < 362) {
      quat.set(0, 0, 0, 1);
      pos.set(0, 0, 0);
      rot.set(0, 0, 0);
      scale.set(1, 1, 1);
      return;
    }

    const leftEye = landmarks[133];
    const rightEye = landmarks[362];
    const chin = landmarks[152];
    const forehead = landmarks[10];
    const nose = landmarks[4];

    if (!leftEye || !rightEye || !chin || !forehead || !nose) return;

    // A. Estimate translation position (nose tip mapped to WebGL coordinate units)
    // Scale X by aspect ratio and multiply by 10 for three.js world-unit sizing
    pos.set(
      (nose.x - 0.5) * aspect * 10.0,
      -(nose.y - 0.5) * 10.0,
      -nose.z * 10.0
    );

    // B. Solve rotation vectors:
    // 1. Right vector (X-axis): pointing from Left Eye to Right Eye
    const vx = new THREE.Vector3(
      rightEye.x - leftEye.x,
      -(rightEye.y - leftEye.y),
      -(rightEye.z - leftEye.z)
    ).normalize();
    
    // 2. Up vector (Y-axis): pointing from Chin to Forehead
    const vyRaw = new THREE.Vector3(
      forehead.x - chin.x,
      -(forehead.y - chin.y),
      -(forehead.z - chin.z)
    );
    // Orthogonalize Up vector relative to Right vector (Gram-Schmidt process)
    const dot = vyRaw.dot(vx);
    const vy = vyRaw.subVectors(vyRaw, vx.clone().multiplyScalar(dot)).normalize();

    // 3. Forward vector (Z-axis): Orthogonal cross product of X and Y
    const vz = new THREE.Vector3().crossVectors(vx, vy).normalize();

    // C. Reconstruct rotation matrix
    const matrix = new THREE.Matrix4().makeBasis(vx, vy, vz);
    quat.setFromRotationMatrix(matrix);
    rot.setFromQuaternion(quat, 'XYZ');

    // D. Solve biomechanical scaling factors (standardized to 3D dimensions)
    const faceWidth = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y, rightEye.z - leftEye.z);
    const faceHeight = Math.hypot(forehead.x - chin.x, forehead.y - chin.y, forehead.z - chin.z);
    // Standardize scaling factors
    scale.set(faceWidth * 5.0, faceHeight * 5.0, (faceWidth + faceHeight) * 2.5);
  }
}

export const headPoseEstimator = new HeadPoseEstimator();
export default headPoseEstimator;
