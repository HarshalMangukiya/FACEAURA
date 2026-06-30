/**
 * runTests.ts
 *
 * Custom, zero-dependency unit testing suite running under Node.js (via vite-node).
 * Verifies correctness of:
 * 1. Quaternion calculations and Slerp interpolation.
 * 2. ScaleCalculator biometric scale vectors.
 * 3. TrackingStateMachine state transitions and frame counters.
 * 4. BlendshapeManager parser and hooks sync.
 * 5. AssetValidator corrections and box calculations.
 */

import * as THREE from 'three';
import { scaleCalculator } from '../accessories/ScaleCalculator';
import { pivotCorrector } from '../accessories/PivotCorrector';
import { blendshapeManager } from '../tracking/BlendshapeManager';
import { TrackingStateMachine } from '../tracking/TrackingStateMachine';
import { assetValidator } from '../assets/AssetValidator';

declare var process: any;

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`\x1b[32m[PASS]\x1b[0m ${name}`);
  } catch (err: any) {
    console.error(`\x1b[31m[FAIL]\x1b[0m ${name}`);
    console.error(err.stack || err.message);
    process.exit(1);
  }
}

import { composeMatrix, invertMatrix, transformVec3 } from '../workers/tracker.worker.math';

// ==========================================
// RUN TEST SUITE
// ==========================================
console.log('Starting Face Aura Test Suite...');

// 0. Test Matrix Composition and Inversion
test('Matrix compose and invert mathematical accuracy', () => {
  const translation = [1.5, -2.0, 5.5];
  const quaternion = [0.1, -0.2, 0.3, 0.9165]; // Normalized quaternion
  const scale = [1.0, 1.0, 1.0];

  const mat = composeMatrix(translation, quaternion, scale);
  const inv = invertMatrix(mat);

  // Transform a point [1, 1, 1] through mat and then inv
  const pt = [1.0, 1.0, 1.0];
  const ptTransformed = transformVec3(pt, mat);
  const ptRestored = transformVec3(ptTransformed, inv);

  // Verify restored point is [1, 1, 1]
  assert(Math.abs(ptRestored[0] - 1.0) < 0.001, `X restoration failed: got ${ptRestored[0]}`);
  assert(Math.abs(ptRestored[1] - 1.0) < 0.001, `Y restoration failed: got ${ptRestored[1]}`);
  assert(Math.abs(ptRestored[2] - 1.0) < 0.001, `Z restoration failed: got ${ptRestored[2]}`);
});

import { quaternionToEulerXYZ, eulerToQuaternionXYZ } from '../workers/tracker.worker.math';

// 0b. Test Euler to/from Quaternion conversions
test('Euler and Quaternion conversions math accuracy', () => {
  // Test a series of pitch, yaw, roll angles
  const angles = [
    [0.1, 0.2, 0.3],
    [-0.5, 0.4, -0.2],
    [0.0, 0.0, 0.0],
    [Math.PI / 4, -Math.PI / 6, Math.PI / 8]
  ];

  for (const [p, y, r] of angles) {
    const q = eulerToQuaternionXYZ(p, y, r);
    // Round-trip
    const [p2, y2, r2] = quaternionToEulerXYZ(q);
    const q2 = eulerToQuaternionXYZ(p2, y2, r2);

    // Verify quaternion is equivalent (q and -q represent same rotation)
    let diff = 0;
    for (let i = 0; i < 4; i++) {
      diff += Math.abs(Math.abs(q[i]) - Math.abs(q2[i]));
    }
    assert(diff < 0.001, `Quaternion roundtrip failed for [${p}, ${y}, ${r}]: got [${p2}, ${y2}, ${r2}]`);
  }
});

// 1. Test Quaternion Calculations & Slerp
test('Quaternion slerp interpolation stability', () => {
  const qStart = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0));
  const qEnd = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
  
  // Interpolate halfway
  const qHalf = qStart.clone().slerp(qEnd, 0.5);
  const eulerHalf = new THREE.Euler().setFromQuaternion(qHalf);
  
  // Verify Yaw (Euler Y) is ~45 degrees (PI/4 radians)
  assert(Math.abs(eulerHalf.y - Math.PI / 4) < 0.001, 'Slerp interpolation was inaccurate');
});

// 2. Test ScaleCalculator
test('ScaleCalculator biometric bounds math', () => {
  // Mock 454 landmarks with known coordinates to test distance calculations
  const mockLandmarks = new Array(478).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0.1 }));
  
  // Outer Eye landmarks (33 and 263)
  mockLandmarks[33] = { x: 0.45, y: 0.5, z: 0.1 };
  mockLandmarks[263] = { x: 0.55, y: 0.5, z: 0.1 };

  const aspect = 4 / 3;
  const biometrics = scaleCalculator.calculateBiometrics(mockLandmarks, aspect);
  
  // Verify calculated eye distance is around (0.55 - 0.45) * aspect * 10 = 0.1 * 1.333 * 10 = 1.333
  assert(Math.abs(biometrics.eyeDistance - 1.333) < 0.05, `IPD math failed, got ${biometrics.eyeDistance}`);
  
  // Verify Accessory scaling rules
  const scaleVector = scaleCalculator.getAccessoryScale('glasses', biometrics, 0.0, 1.0);
  // Glasses width scale = biometrics.eyeDistance * 2.3 = 1.333 * 2.3 = ~3.06
  assert(Math.abs(scaleVector.x - 3.06) < 0.1, `Glasses scaling source math failed, got ${scaleVector.x}`);
});

// 3. Test BlendshapeManager
test('BlendshapeManager coefficient parser', () => {
  blendshapeManager.reset();
  assert(blendshapeManager.getScore('jawOpen') === 0.0, 'Blendshape did not reset');

  // Feed raw MediaPipe category payload
  blendshapeManager.update([
    { categoryName: 'jawOpen', score: 0.65 },
    { categoryName: 'mouthSmileLeft', score: 0.82 }
  ]);

  assert(blendshapeManager.getScore('jawOpen') === 0.65, 'Failed to extract jawOpen score');
  assert(blendshapeManager.getScore('mouthSmileLeft') === 0.82, 'Failed to extract mouthSmileLeft score');
  assert(blendshapeManager.getScore('mouthOpen') === 0.65, 'MouthOpen alias failed');
});

// 4. Test TrackingStateMachine transitions
test('TrackingStateMachine lifecycle state transitions', () => {
  const fsm = new TrackingStateMachine();
  assert(fsm.getState() === 'Searching', 'FSM initial state was not Searching');
  assert(fsm.getFadeFactor() === 0.0, 'Initial fadeFactor should be 0');

  const mockPose = {
    position: [0, 0, 0] as [number, number, number],
    quaternion: [0, 0, 0, 1] as [number, number, number, number],
    scale: [1, 1, 1] as [number, number, number]
  };

  // 1. Transition: Searching -> Tracking (face detected)
  fsm.update(true, mockPose, 0.016);
  assert(fsm.getState() === 'Tracking', 'Failed to transition to Tracking');
  assert(fsm.getFadeFactor() === 1.0, 'Fade factor should lock to 1.0 in Tracking');

  // 2. Transition: Tracking -> TemporarilyLost (face missing)
  fsm.update(false, null, 0.016);
  assert(fsm.getState() === 'TemporarilyLost', 'Failed to transition to TemporarilyLost');
  assert(fsm.getFadeFactor() === 0.9, 'Fade factor should decay by 10% on first lost frame');

  // 3. Transition: TemporarilyLost -> Recovering (face found during lost window)
  fsm.update(true, mockPose, 0.016);
  assert(fsm.getState() === 'Recovering', 'Failed to transition to Recovering');
  assert(fsm.getRecoveryBlend() === 0.0, 'Recovery blend factor should start at 0.0');

  // 4. Step recovery forward: 100ms (50% blend duration)
  fsm.update(true, mockPose, 0.100);
  assert(fsm.getRecoveryBlend() === 0.5, `Recovery blend should be 0.5, got ${fsm.getRecoveryBlend()}`);

  // 5. Recover fully
  fsm.update(true, mockPose, 0.100);
  assert(fsm.getState() === 'Tracking', 'Failed to recover to Tracking state');
});

// 5. Test AssetValidator corrections
test('AssetValidator automatic scale & rotation corrections', () => {
  const group = new THREE.Group();
  const geometry = new THREE.BoxGeometry(200, 2, 2); // Outlier large geometry
  const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);

  // Set bad scaling and rotation offsets
  group.scale.set(2, 2, 2);
  group.rotation.set(0.5, 0.5, 0.5);

  const mockConfig = {
    category: 'glasses',
    primaryAnchor: 'glasses',
    pivot: 'between-eyes' as const,
    scaling: {
      widthSource: 'eye-distance' as const,
      heightSource: 'eye-height' as const,
      depthSource: 'head-depth' as const,
      widthMultiplier: 2.3,
      heightMultiplier: 2.3,
      depthMultiplier: 0.95
    },
    offsets: {}
  };

  assetValidator.validateAndCorrect(group, mockConfig);

  // Assertions: Group scale and rotation are reset, vertices scaled down
  assert(group.scale.x === 1.0, 'Scale was not corrected');
  assert(group.rotation.x === 0.0, 'Rotation was not corrected');
  assert(mesh.material.side === THREE.DoubleSide, 'Material sides were not corrected to double side');

  // Clean up
  geometry.dispose();
  material.dispose();
});

console.log('\x1b[32mAll unit tests passed successfully!\x1b[0m');
