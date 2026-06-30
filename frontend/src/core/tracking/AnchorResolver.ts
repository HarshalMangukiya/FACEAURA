import * as THREE from 'three';

export interface Anchor {
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  normal: THREE.Vector3;
  forward: THREE.Vector3;
  up: THREE.Vector3;
  right: THREE.Vector3;
  scaleRef: number;
  confidence: number;
}

export class AnchorResolver {
  private aspect: number = 4 / 3;

  constructor() {}

  /**
   * Translates 468 raw normalized landmarks into coordinate space anchors.
   * Maps vectors to the local headGroup coordinate space using the inverse head matrix.
   */
  public resolve(
    landmarks: any[],
    pose: any,
    blendshapes: any[],
    width: number,
    height: number,
    headMatrixInverse: THREE.Matrix4
  ) {
    this.aspect = width / height;

    const getLocal = (idx: number): THREE.Vector3 => {
      const pt = landmarks[idx];
      if (!pt) return new THREE.Vector3();
      // Map MediaPipe [0..1] coordinates to world space units
      const worldPt = new THREE.Vector3(
        (pt.x - 0.5) * this.aspect * 10,
        -(pt.y - 0.5) * 10,
        -pt.z * 10
      );
      // Transform into localized head coordinate system
      return worldPt.applyMatrix4(headMatrixInverse);
    };

    const confidence = landmarks && landmarks.length > 0 ? 1.0 : 0.0;

    const createAnchor = (
      posIdx: number,
      scaleRef: number,
      customNormal = new THREE.Vector3(0, 0, 1)
    ): Anchor => {
      const position = getLocal(posIdx);
      const rotation = new THREE.Quaternion(); // Anchors rotate relative to parent headGroup
      const normal = customNormal.clone().normalize();
      const forward = new THREE.Vector3(0, 0, 1);
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3(1, 0, 0);

      return {
        position,
        rotation,
        normal,
        forward,
        up,
        right,
        scaleRef,
        confidence
      };
    };

    // 1. Calculate biometric size scales
    const pLeftCheek = getLocal(234);
    const pRightCheek = getLocal(454);
    const faceWidth = pLeftCheek.distanceTo(pRightCheek) || 2.5;

    const pLeftEye = getLocal(33);
    const pRightEye = getLocal(263);
    const ipd = pLeftEye.distanceTo(pRightEye) || 0.65;

    const pLeftJaw = getLocal(172);
    const pRightJaw = getLocal(397);
    const jawWidth = pLeftJaw.distanceTo(pRightJaw) || 1.6;

    const pForehead = getLocal(10);
    const pChin = getLocal(152);

    return {
      getHairAnchor: (): Anchor => createAnchor(10, faceWidth, new THREE.Vector3(0, 0.5, -0.86)),
      getForeheadAnchor: (): Anchor => createAnchor(151, faceWidth, new THREE.Vector3(0, 0.2, 0.98)),
      getHeadCenterAnchor: (): Anchor => {
        const position = new THREE.Vector3()
          .add(pLeftCheek)
          .add(pRightCheek)
          .add(pForehead)
          .add(pChin)
          .multiplyScalar(0.25);
        return {
          position,
          rotation: new THREE.Quaternion(),
          normal: new THREE.Vector3(0, 0, 1),
          forward: new THREE.Vector3(0, 0, 1),
          up: new THREE.Vector3(0, 1, 0),
          right: new THREE.Vector3(1, 0, 0),
          scaleRef: faceWidth,
          confidence
        };
      },
      getCapAnchor: (): Anchor => createAnchor(10, faceWidth, new THREE.Vector3(0, 0.6, -0.8)),
      getNoseBridgeAnchor: (): Anchor => createAnchor(6, ipd, new THREE.Vector3(0, 0, 1)),
      getLeftEyeAnchor: (): Anchor => createAnchor(33, ipd, new THREE.Vector3(0, 0, 1)),
      getRightEyeAnchor: (): Anchor => createAnchor(263, ipd, new THREE.Vector3(0, 0, 1)),
      getLeftEarAnchor: (): Anchor => createAnchor(234, faceWidth, new THREE.Vector3(-1, 0, 0)),
      getRightEarAnchor: (): Anchor => createAnchor(454, faceWidth, new THREE.Vector3(1, 0, 0)),
      getJawAnchor: (): Anchor => createAnchor(172, jawWidth, new THREE.Vector3(-0.7, -0.5, 0.5)),
      getChinAnchor: (): Anchor => createAnchor(152, jawWidth, new THREE.Vector3(0, -0.7, 0.7)),
      getCheekLeftAnchor: (): Anchor => createAnchor(234, faceWidth, new THREE.Vector3(-0.9, 0, 0.45)),
      getCheekRightAnchor: (): Anchor => createAnchor(454, faceWidth, new THREE.Vector3(0.9, 0, 0.45)),
      getLipCenterAnchor: (): Anchor => createAnchor(13, ipd, new THREE.Vector3(0, -0.2, 0.98)),
      getFaceCenterAnchor: (): Anchor => createAnchor(4, faceWidth, new THREE.Vector3(0, 0, 1))
    };
  }
}

export default AnchorResolver;
