/**
 * AccessoryAnchorManager.ts
 *
 * Resolves 3D localized anchors for various accessory categories (Hair, Glasses, Cap, Beard,
 * Makeup, Earrings, Necklace) from the smoothed 478 landmarks.
 *
 * Transformations:
 * - Maps normalized MediaPipe points [0..1] to WebGL coordinates.
 * - Localizes coordinates using the inverse head transformation matrix.
 * - Computes dynamic anatomical positions (e.g. Top of Head, Nose Bridge, Ear Lobe, Neck Base).
 */

import * as THREE from 'three';

export interface Anchor {
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  normal: THREE.Vector3;
  scaleRef: number;
  confidence: number;
}

export class AccessoryAnchorManager {
  private aspect: number = 4 / 3;

  constructor() {}

  /**
   * Resolves the anchors dictionary from smoothed face landmarks.
   *
   * @param landmarks Array of 478 smoothed 3D landmarks
   * @param headQuaternion Current head rotation quaternion
   * @param width Viewport width
   * @param height Viewport height
   * @param headMatrixInverse Inverse matrix of the head group to localize anchors
   */
  public resolveAnchors(
    landmarks: any[],
    headQuaternion: THREE.Quaternion,
    width: number,
    height: number,
    headMatrixInverse: THREE.Matrix4
  ): Record<string, Anchor> {
    this.aspect = width / height;

    const getLocalPoint = (idx: number): THREE.Vector3 => {
      const pt = landmarks[idx];
      if (!pt) return new THREE.Vector3();
      // Map MediaPipe normalized coordinate space to world units
      const worldPt = new THREE.Vector3(
        (pt.x - 0.5) * this.aspect * 10.0,
        -(pt.y - 0.5) * 10.0,
        -pt.z * 10.0
      );
      // Transform into the local coordinate system of the head group
      return worldPt.applyMatrix4(headMatrixInverse);
    };

    const confidence = landmarks && landmarks.length > 0 ? 1.0 : 0.0;

    // A. Extract key local coordinate landmarks
    const pForeheadHairline = getLocalPoint(10); // hairline forehead top
    const pForeheadGlabella = getLocalPoint(151); // mid forehead
    const pChin = getLocalPoint(152); // bottom of chin
    const pLeftEar = getLocalPoint(234); // left ear hairline
    const pRightEar = getLocalPoint(454); // right ear hairline
    const pLeftEyeIris = getLocalPoint(468); // left pupil
    const pRightEyeIris = getLocalPoint(473); // right pupil
    const pNoseBridge = getLocalPoint(6); // nose bridge between eyes
    const pLeftJaw = getLocalPoint(172);
    const pRightJaw = getLocalPoint(397);
    const pLipCenter = getLocalPoint(13); // lip center gap

    // B. Calculate relative scale references (biometric dimensions)
    const faceWidth = pLeftEar.distanceTo(pRightEar) || 2.5;
    const ipd = pLeftEyeIris.distanceTo(pRightEyeIris) || 0.65;
    const jawWidth = pLeftJaw.distanceTo(pRightJaw) || 1.6;

    // C. Estimate Top of Head (skull crown)
    // Extend the vector from chin to hairline by 25% to find the top of the skull
    const faceHeightVec = new THREE.Vector3().subVectors(pForeheadHairline, pChin);
    const pTopHead = new THREE.Vector3().copy(pForeheadHairline).addScaledVector(faceHeightVec, 0.25);

    // D. Estimate Neck Base
    // Extend chin downwards from the face centerline
    const pNeckBase = new THREE.Vector3().copy(pChin).addScaledVector(faceHeightVec, -0.15);

    // E. Build Category Anchors
    return {
      hair: {
        position: pTopHead,
        rotation: new THREE.Quaternion(), // relative to parent headGroup (identity)
        normal: new THREE.Vector3(0, 1, -0.25).normalize(),
        scaleRef: faceWidth,
        confidence
      },
      glasses: {
        position: pNoseBridge,
        rotation: new THREE.Quaternion(), // aligns with eye-line rotation
        normal: new THREE.Vector3(0, 0, 1),
        scaleRef: ipd,
        confidence
      },
      beard: {
        position: pChin,
        rotation: new THREE.Quaternion(),
        normal: new THREE.Vector3(0, -0.5, 0.86).normalize(),
        scaleRef: jawWidth,
        confidence
      },
      caps: {
        position: pForeheadHairline,
        rotation: new THREE.Quaternion(),
        normal: new THREE.Vector3(0, 0.6, -0.8).normalize(),
        scaleRef: faceWidth,
        confidence
      },
      forehead: {
        position: pForeheadGlabella,
        rotation: new THREE.Quaternion(),
        normal: new THREE.Vector3(0, 0.2, 0.98).normalize(),
        scaleRef: faceWidth,
        confidence
      },
      lips: {
        position: pLipCenter,
        rotation: new THREE.Quaternion(),
        normal: new THREE.Vector3(0, -0.2, 0.98).normalize(),
        scaleRef: ipd,
        confidence
      },
      leftEarring: {
        position: pLeftEar,
        rotation: new THREE.Quaternion(),
        normal: new THREE.Vector3(-1, 0, 0),
        scaleRef: faceWidth,
        confidence
      },
      rightEarring: {
        position: pRightEar,
        rotation: new THREE.Quaternion(),
        normal: new THREE.Vector3(1, 0, 0),
        scaleRef: faceWidth,
        confidence
      },
      necklace: {
        position: pNeckBase,
        rotation: new THREE.Quaternion(),
        normal: new THREE.Vector3(0, -0.8, -0.6).normalize(),
        scaleRef: faceWidth,
        confidence
      }
    };
  }
}

export const accessoryAnchorManager = new AccessoryAnchorManager();
export default accessoryAnchorManager;
