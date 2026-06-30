/**
 * LandmarkSmoother.ts
 *
 * Provides real-time temporal smoothing and stabilization for tracking parameters:
 * - 478 raw face landmarks (using One Euro Filter Multi-3D to remove high-frequency jitter)
 * - Head translation / position (using Kalman Filter 3D to smooth translation and predict velocity)
 * - Head rotation angles (using One Euro Filter 3D to eliminate micro-shake)
 */

import { OneEuroFilterMulti3D, OneEuroFilter3D } from '../math/OneEuroFilter';
import { KalmanFilter3D } from '../math/KalmanFilter';

export class LandmarkSmoother {
  private landmarkFilter: OneEuroFilterMulti3D;
  private rotationFilter: OneEuroFilter3D;
  private translationFilter: KalmanFilter3D;

  /**
   * Initializes the smoother with tuned filter coefficients.
   * minCutoff: lower values smooth static jitter more (but add lag).
   * beta: higher values reduce lag during rapid movements (at the cost of some noise).
   */
  constructor() {
    // Tuned for high-fidelity face tracking
    // Landmarks: minCutoff = 0.75, beta = 0.005 (smooth at rest, responsive in motion)
    this.landmarkFilter = new OneEuroFilterMulti3D(0.75, 0.005);
    
    // Rotation: minCutoff = 1.0, beta = 0.008 (stable angles)
    this.rotationFilter = new OneEuroFilter3D(1.0, 0.008);
    
    // Translation: process noise = 0.08, measurement noise = 1.25 (reject camera position spikes)
    this.translationFilter = new KalmanFilter3D(0.08, 1.25);
  }

  /**
   * Smooths the raw facial landmarks array.
   */
  public smoothLandmarks(
    rawLandmarks: Array<{ x: number; y: number; z: number }>,
    timestampMs: number
  ): Array<{ x: number; y: number; z: number }> {
    if (!rawLandmarks || rawLandmarks.length === 0) return [];
    return this.landmarkFilter.filter(rawLandmarks, timestampMs);
  }

  /**
   * Smooths the calculated head rotation Euler angles (pitch, yaw, roll).
   */
  public smoothRotation(
    rawRotation: { x: number; y: number; z: number },
    timestampMs: number
  ): { x: number; y: number; z: number } {
    return this.rotationFilter.filter(rawRotation, timestampMs);
  }

  /**
   * Smooths the 3D translation/position vector of the head.
   */
  public smoothTranslation(
    rawTranslation: { x: number; y: number; z: number },
    timestampMs: number
  ): { x: number; y: number; z: number } {
    return this.translationFilter.update(rawTranslation, timestampMs);
  }

  /**
   * Resets all filter internal states (e.g. when tracking is lost or restarted).
   */
  public reset(): void {
    this.landmarkFilter.reset();
    this.rotationFilter.reset();
    this.translationFilter.reset();
  }
}

export default LandmarkSmoother;
