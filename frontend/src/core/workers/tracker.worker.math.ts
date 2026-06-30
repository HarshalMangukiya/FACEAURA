/**
 * tracker.worker.math.ts
 *
 * Pure JavaScript 3D mathematics library for the Web Worker thread.
 * Contains ZERO dependencies on Three.js, using only plain arrays and TypedArrays.
 */

export interface PureJSBiometrics {
  templeDistance: number;
  eyeDistance: number;
  jawWidth: number;
  jawHeight: number;
  faceHeight: number;
  headDepth: number;
  faceWidth: number;
}

export interface PureJSAnchor {
  position: [number, number, number]; // [x, y, z]
  rotation: [number, number, number, number]; // [x, y, z, w]
  normal: [number, number, number]; // [x, y, z]
  scaleRef: number;
}

// ==========================================
// 3D VECTOR MATH HELPERS
// ==========================================
export function vec3Sub(a: number[], b: number[]): number[] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function vec3Cross(a: number[], b: number[]): number[] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

export function vec3Dot(a: number[], b: number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function vec3Len(v: number[]): number {
  return Math.hypot(v[0], v[1], v[2]);
}

export function vec3Normalize(v: number[]): number[] {
  const len = vec3Len(v) || 0.0001;
  return [v[0] / len, v[1] / len, v[2] / len];
}

export function vec3Dist(a: number[], b: number[]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

// ==========================================
// EULER <-> QUATERNION CONVERSIONS (XYZ)
// ==========================================
export function quaternionToEulerXYZ(q: number[]): [number, number, number] {
  const x = q[0], y = q[1], z = q[2], w = q[3];
  
  // Matrix elements from quaternion
  const m11 = 1 - 2 * (y * y + z * z);
  const m12 = 2 * (x * y - w * z);
  const m13 = 2 * (x * z + w * y);
  const m23 = 2 * (y * z - w * x);
  const m33 = 1 - 2 * (x * x + y * y);

  let ex = 0, ey = 0, ez = 0;

  ey = Math.asin(Math.min(Math.max(m13, -1), 1));

  if (Math.abs(m13) < 0.99999) {
    ex = Math.atan2(-m23, m33);
    ez = Math.atan2(-m12, m11);
  } else {
    ex = Math.atan2(2 * (y * z + w * x), 1 - 2 * (y * y + z * z));
    ez = 0;
  }

  return [ex, ey, ez];
}

export function eulerToQuaternionXYZ(x: number, y: number, z: number): [number, number, number, number] {
  const c1 = Math.cos(x / 2);
  const c2 = Math.cos(y / 2);
  const c3 = Math.cos(z / 2);

  const s1 = Math.sin(x / 2);
  const s2 = Math.sin(y / 2);
  const s3 = Math.sin(z / 2);

  const qx = s1 * c2 * c3 + c1 * s2 * s3;
  const qy = c1 * s2 * c3 - s1 * c2 * s3;
  const qz = c1 * c2 * s3 + s1 * s2 * c3;
  const qw = c1 * c2 * c3 - s1 * s2 * s3;

  return [qx, qy, qz, qw];
}

// ==========================================
// 4x4 MATRIX MATH HELPERS
// ==========================================
export function composeMatrix(t: number[], q: number[], s: number[]): Float32Array {
  const te = new Float32Array(16);
  
  const x = q[0], y = q[1], z = q[2], w = q[3];
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  
  const sx = s[0], sy = s[1], sz = s[2];
  
  te[0] = (1 - (yy + zz)) * sx;
  te[1] = (xy + wz) * sx;
  te[2] = (xz - wy) * sx;
  te[3] = 0;
  
  te[4] = (xy - wz) * sy;
  te[5] = (1 - (xx + zz)) * sy;
  te[6] = (yz + wx) * sy;
  te[7] = 0;
  
  te[8] = (xz + wy) * sz;
  te[9] = (yz - wx) * sz;
  te[10] = (1 - (xx + yy)) * sz;
  te[11] = 0;
  
  te[12] = t[0];
  te[13] = t[1];
  te[14] = t[2];
  te[15] = 1;
  
  return te;
}

export function invertMatrix(m: Float32Array): Float32Array {
  const out = new Float32Array(16);
  const n11 = m[0], n12 = m[4], n13 = m[8], n14 = m[12];
  const n21 = m[1], n22 = m[5], n23 = m[9], n24 = m[13];
  const n31 = m[2], n32 = m[6], n33 = m[10], n34 = m[14];
  const n41 = m[3], n42 = m[7], n43 = m[11], n44 = m[15];

  const t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44;
  const t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44;
  const t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - m[4] * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44;
  const t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;

  const det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;

  if (det === 0) {
    out.set([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
    return out;
  }

  const idet = 1 / det;

  out[0] = t11 * idet;
  out[1] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * idet;
  out[2] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * idet;
  out[3] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * idet;

  out[4] = t12 * idet;
  out[5] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * idet;
  out[6] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * idet;
  out[7] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * idet;

  out[8] = t13 * idet;
  out[9] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * idet;
  out[10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * idet;
  out[11] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * idet;

  out[12] = t14 * idet;
  out[13] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * idet;
  out[14] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * idet;
  out[15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * idet;

  return out;
}

export function transformVec3(v: number[], m: Float32Array): number[] {
  const x = v[0], y = v[1], z = v[2];
  const w = 1 / (m[3] * x + m[7] * y + m[11] * z + m[15]);
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) * w,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) * w,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) * w
  ];
}

// ==========================================
// MATRIX DECOMPOSITION & QUATERNIONS
// ==========================================
export function decomposeMatrixToQuat(m: number[] | Float32Array): {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  scale: [number, number, number];
} {
  const position: [number, number, number] = [m[12], m[13], m[14]];

  // Calculate basis vector lengths to solve scale
  const sx = Math.hypot(m[0], m[1], m[2]) || 0.0001;
  const sy = Math.hypot(m[4], m[5], m[6]) || 0.0001;
  const sz = Math.hypot(m[8], m[9], m[10]) || 0.0001;
  const scale: [number, number, number] = [1.0, 1.0, 1.0];

  // Rotation matrix components normalized
  const r00 = m[0] / sx, r10 = m[1] / sx, r20 = m[2] / sx;
  const r01 = m[4] / sy, r11 = m[5] / sy, r21 = m[6] / sy;
  const r02 = m[8] / sz, r12 = m[9] / sz, r22 = m[10] / sz;

  // Convert rotation matrix to quaternion [x, y, z, w]
  const trace = r00 + r11 + r22;
  const quaternion: [number, number, number, number] = [0, 0, 0, 1];

  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1.0);
    quaternion[3] = 0.25 / s;
    quaternion[0] = (r21 - r12) * s;
    quaternion[1] = (r02 - r20) * s;
    quaternion[2] = (r10 - r01) * s;
  } else if (r00 > r11 && r00 > r22) {
    const s = 2.0 * Math.sqrt(1.0 + r00 - r11 - r22);
    quaternion[3] = (r21 - r12) / s;
    quaternion[0] = 0.25 * s;
    quaternion[1] = (r10 + r01) / s;
    quaternion[2] = (r02 + r20) / s;
  } else if (r11 > r22) {
    const s = 2.0 * Math.sqrt(1.0 + r11 - r00 - r22);
    quaternion[3] = (r02 - r20) / s;
    quaternion[0] = (r10 + r01) / s;
    quaternion[1] = 0.25 * s;
    quaternion[2] = (r21 + r12) / s;
  } else {
    const s = 2.0 * Math.sqrt(1.0 + r22 - r00 - r11);
    quaternion[3] = (r10 - r01) / s;
    quaternion[0] = (r02 + r20) / s;
    quaternion[1] = (r21 + r12) / s;
    quaternion[2] = 0.25 * s;
  }

  return { position, quaternion, scale };
}

// ==========================================
// SOLVE PNP GEOMETRIC ALIGNMENT (FALLBACK)
// ==========================================
export function estimatePoseFromGeometry(
  landmarks: any[],
  aspect: number
): {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  scale: [number, number, number];
} {
  const leftEye = landmarks[133];
  const rightEye = landmarks[362];
  const chin = landmarks[152];
  const forehead = landmarks[10];
  const nose = landmarks[4];

  if (!leftEye || !rightEye || !chin || !forehead || !nose) {
    return {
      position: [0, 0, 0],
      quaternion: [0, 0, 0, 1],
      scale: [1, 1, 1]
    };
  }

  // A. Position estimation (Nose mapped to WebGL coordinates)
  const position: [number, number, number] = [
    (nose.x - 0.5) * aspect * 10.0,
    -(nose.y - 0.5) * 10.0,
    -nose.z * 10.0
  ];

  // B. Basis orthogonalization:
  // Right Vector (vx) from Left to Right eye
  const vxRaw = [
    rightEye.x - leftEye.x,
    -(rightEye.y - leftEye.y),
    -(rightEye.z - leftEye.z)
  ];
  const vx = vec3Normalize(vxRaw);

  // Up Vector (vy) from Chin to Forehead
  const vyRaw = [
    forehead.x - chin.x,
    -(forehead.y - chin.y),
    -(forehead.z - chin.z)
  ];
  const dot = vec3Dot(vyRaw, vx);
  const vy = vec3Normalize(vec3Sub(vyRaw, [vx[0] * dot, vx[1] * dot, vx[2] * dot]));

  // Forward Vector (vz) orthogonal cross product
  const vz = vec3Cross(vx, vy);

  // C. Assemble 4x4 rotation matrix elements (column-major)
  const matrix = [
    vx[0], vx[1], vx[2], 0,
    vy[0], vy[1], vy[2], 0,
    vz[0], vz[1], vz[2], 0,
    0, 0, 0, 1
  ];

  const scale: [number, number, number] = [1.0, 1.0, 1.0];

  const decomp = decomposeMatrixToQuat(matrix);

  return {
    position,
    quaternion: decomp.quaternion,
    scale
  };
}

// ==========================================
// BIOMETRICS RESOLVER
// ==========================================
export function calculateBiometricsJS(landmarks: any[], aspect: number): PureJSBiometrics {
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

  const get3D = (idx: number): number[] => {
    const pt = landmarks[idx];
    return pt ? [(pt.x - 0.5) * aspect * 10.0, -(pt.y - 0.5) * 10.0, -pt.z * 10.0] : [0, 0, 0];
  };

  const pForehead = get3D(10);
  const pChin = get3D(152);
  const pLeftTemple = get3D(109);
  const pRightTemple = get3D(338);
  const pLeftEye = get3D(33);
  const pRightEye = get3D(263);
  const pLeftJaw = get3D(172);
  const pRightJaw = get3D(397);
  const pMouthCenter = get3D(13);
  const pNoseTip = get3D(4);
  const pLeftEar = get3D(234);
  const pRightEar = get3D(454);

  const faceHeight = vec3Dist(pForehead, pChin);
  const templeDistance = vec3Dist(pLeftTemple, pRightTemple);
  const eyeDistance = vec3Dist(pLeftEye, pRightEye);
  const jawWidth = vec3Dist(pLeftJaw, pRightJaw);
  const jawHeight = vec3Dist(pMouthCenter, pChin);
  const faceWidth = vec3Dist(pLeftEar, pRightEar);

  const earsAvgZ = (pLeftEar[2] + pRightEar[2]) / 2.0;
  const headDepth = Math.abs(pNoseTip[2] - earsAvgZ);

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

// ==========================================
// ANCHORS RESOLVER
// ==========================================
export function resolveAnchorsJS(
  landmarks: any[],
  headQuat: number[],
  aspect: number,
  headMatrixInverse: Float32Array
): Record<string, PureJSAnchor> {
  const getLocal = (idx: number): [number, number, number] => {
    const pt = landmarks[idx];
    if (!pt) return [0, 0, 0];
    const wPt = [(pt.x - 0.5) * aspect * 10.0, -(pt.y - 0.5) * 10.0, -pt.z * 10.0];
    const transformed = transformVec3(wPt, headMatrixInverse);
    return [transformed[0], transformed[1], transformed[2]];
  };

  const pForeheadHairline = getLocal(10);
  const pForeheadGlabella = getLocal(151);
  const pChin = getLocal(152);
  const pLeftEar = getLocal(234);
  const pRightEar = getLocal(454);
  const pLeftEyeIris = getLocal(468);
  const pRightEyeIris = getLocal(473);
  const pNoseBridge = getLocal(6);
  const pLeftJaw = getLocal(172);
  const pRightJaw = getLocal(397);
  const pLipCenter = getLocal(13);

  const faceWidth = vec3Dist(pLeftEar, pRightEar);
  const ipd = vec3Dist(pLeftEyeIris, pRightEyeIris);
  const jawWidth = vec3Dist(pLeftJaw, pRightJaw);

  // Skull crown estimation
  const faceHeightVec = vec3Sub(pForeheadHairline, pChin);
  const pTopHead: [number, number, number] = [
    pForeheadHairline[0] + faceHeightVec[0] * 0.25,
    pForeheadHairline[1] + faceHeightVec[1] * 0.25,
    pForeheadHairline[2] + faceHeightVec[2] * 0.25
  ];

  // Neck base estimation
  const pNeckBase: [number, number, number] = [
    pChin[0] - faceHeightVec[0] * 0.15,
    pChin[1] - faceHeightVec[1] * 0.15,
    pChin[2] - faceHeightVec[2] * 0.15
  ];

  const defaultRot: [number, number, number, number] = [0, 0, 0, 1];

  return {
    hair: {
      position: pTopHead,
      rotation: defaultRot,
      normal: vec3Normalize([0, 1, -0.25]) as [number, number, number],
      scaleRef: faceWidth
    },
    glasses: {
      position: pNoseBridge,
      rotation: defaultRot,
      normal: [0, 0, 1],
      scaleRef: ipd
    },
    beard: {
      position: pChin,
      rotation: defaultRot,
      normal: vec3Normalize([0, -0.5, 0.86]) as [number, number, number],
      scaleRef: jawWidth
    },
    caps: {
      position: pForeheadHairline,
      rotation: defaultRot,
      normal: vec3Normalize([0, 0.6, -0.8]) as [number, number, number],
      scaleRef: faceWidth
    },
    forehead: {
      position: pForeheadGlabella,
      rotation: defaultRot,
      normal: vec3Normalize([0, 0.2, 0.98]) as [number, number, number],
      scaleRef: faceWidth
    },
    lips: {
      position: pLipCenter,
      rotation: defaultRot,
      normal: vec3Normalize([0, -0.2, 0.98]) as [number, number, number],
      scaleRef: ipd
    },
    leftEarring: {
      position: pLeftEar,
      rotation: defaultRot,
      normal: [-1, 0, 0],
      scaleRef: faceWidth
    },
    rightEarring: {
      position: pRightEar,
      rotation: defaultRot,
      normal: [1, 0, 0],
      scaleRef: faceWidth
    },
    necklace: {
      position: pNeckBase,
      rotation: defaultRot,
      normal: vec3Normalize([0, -0.8, -0.6]) as [number, number, number],
      scaleRef: faceWidth
    }
  };
}
