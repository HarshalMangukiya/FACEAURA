/**
 * ScaleCalculator.ts
 *
 * Computes dynamic 3D scaling metrics for accessories in Three.js coordinates
 * based on biometric landmark distances.
 *
 * Measurements calculated:
 * 1. Temple Distance: Distance between left temple (109) and right temple (338).
 * 2. Eye Distance: Interpupillary distance or outer eye corners (33 to 263).
 * 3. Jaw Width: Width of the lower jaw (172 to 397).
 * 4. Jaw Height: Distance between lips center (13) and chin (152).
 * 5. Forehead-Chin Distance: Total face height (10 to 152).
 * 6. Head Depth: Distance in Z between nose tip (4) and ears (234/454).
 * 7. Face Width: Edge-to-edge cheek width (234 to 454).
 */

import * as THREE from 'three';

export interface FaceBiometrics {
  templeDistance: number;
  eyeDistance: number;
  jawWidth: number;
  jawHeight: number;
  faceHeight: number;
  headDepth: number;
  faceWidth: number;
}

export class ScaleCalculator {
  constructor() {}

  /**
   * Translates normalized landmarks to 3D WebGL units and calculates face biometrics.
   *
   * @param landmarks Normalized 3D landmarks
   * @param aspect Viewport aspect ratio
   */
  public calculateBiometrics(landmarks: any[], aspect: number = 4 / 3): FaceBiometrics {
    if (!landmarks || landmarks.length < 454) {
      return {
        templeDistance: 1.8,
        eyeDistance: 0.65,
        jawWidth: 1.6,
        jawHeight: 0.8,
        faceHeight: 2.2,
        headDepth: 1.5,
        faceWidth: 2.5
      };
    }

    // Helper to project landmark indices into ThreeJS camera-space units
    const get3DPoint = (idx: number): THREE.Vector3 => {
      const pt = landmarks[idx];
      if (!pt) return new THREE.Vector3();
      return new THREE.Vector3(
        (pt.x - 0.5) * aspect * 10.0,
        -(pt.y - 0.5) * 10.0,
        -pt.z * 10.0
      );
    };

    // Extract key landmarks in Three.js coordinates
    const pForehead = get3DPoint(10);
    const pChin = get3DPoint(152);
    const pLeftTemple = get3DPoint(109);
    const pRightTemple = get3DPoint(338);
    const pLeftEye = get3DPoint(33);
    const pRightEye = get3DPoint(263);
    const pLeftJaw = get3DPoint(172);
    const pRightJaw = get3DPoint(397);
    const pMouthCenter = get3DPoint(13);
    const pNoseTip = get3DPoint(4);
    const pLeftEar = get3DPoint(234);
    const pRightEar = get3DPoint(454);

    // Calculate straight-line Euclidean distances
    const faceHeight = pForehead.distanceTo(pChin) || 2.2;
    const templeDistance = pLeftTemple.distanceTo(pRightTemple) || 1.8;
    const eyeDistance = pLeftEye.distanceTo(pRightEye) || 0.65;
    const jawWidth = pLeftJaw.distanceTo(pRightJaw) || 1.6;
    const jawHeight = pMouthCenter.distanceTo(pChin) || 0.8;
    const faceWidth = pLeftEar.distanceTo(pRightEar) || 2.5;

    // Estimate head depth along Z axis (nose-to-ear plane depth)
    const earsAvgZ = (pLeftEar.z + pRightEar.z) / 2.0;
    const headDepth = Math.abs(pNoseTip.z - earsAvgZ) || 1.5;

    return {
      templeDistance,
      eyeDistance,
      jawWidth,
      jawHeight,
      faceHeight,
      headDepth,
      faceWidth
    };
  }

  /**
   * Generates a 3D scale vector according to category scaling rules and biometrics.
   *
   * @param category Accessory category (hair, beard, glasses, caps)
   * @param biometrics Current frame biometrics
   * @param jawOpenScore Score [0..1] indicating jaw open distance (for beard stretch)
   * @param customScale Custom scale slider multiplier
   */
  public getAccessoryScale(
    category: string,
    biometrics: FaceBiometrics,
    jawOpenScore: number = 0,
    customScale: number = 1.0
  ): THREE.Vector3 {
    const scale = new THREE.Vector3(1, 1, 1);

    switch (category) {
      case 'hair':
        // Width = Temple Distance * 1.05
        // Height = Forehead-Chin Distance * 1.05
        // Depth = Head Depth * 1.05
        scale.set(
          biometrics.templeDistance * 1.05 * customScale,
          biometrics.faceHeight * 1.05 * customScale,
          biometrics.headDepth * 1.05 * customScale
        );
        break;

      case 'glasses':
        // Width = Eye Distance * 2.3
        // Height = Eye Distance * 2.3 (maintains aspect ratio of glasses frame)
        // Depth = Head Depth * 0.95 (glasses arms align with ears)
        scale.set(
          biometrics.eyeDistance * 2.3 * customScale,
          biometrics.eyeDistance * 2.3 * customScale,
          biometrics.headDepth * 0.95 * customScale
        );
        break;

      case 'beard':
        // Width = Jaw Width * 1.0
        // Height = Jaw Height * 1.0 * (1.0 + jawOpenScore * 0.20)
        // Depth = Head Depth * 0.8
        const jawStretch = 1.0 + (jawOpenScore * 0.20);
        scale.set(
          biometrics.jawWidth * 1.0 * customScale,
          biometrics.jawHeight * 1.0 * jawStretch * customScale,
          biometrics.headDepth * 0.8 * customScale
        );
        break;

      case 'caps':
        // Cap fits over temple width and matches skull depth
        scale.set(
          biometrics.templeDistance * 1.0 * customScale,
          biometrics.faceHeight * 0.9 * customScale,
          biometrics.headDepth * 1.0 * customScale
        );
        break;

      default:
        // Default relative scaling based on face width
        scale.setScalar(biometrics.faceWidth * 0.4 * customScale);
        break;
    }

    return scale;
  }
}

export const scaleCalculator = new ScaleCalculator();
export default scaleCalculator;
