/**
 * OpticalFlow.ts
 *
 * Implements predictive landmark extrapolation (temporal optical flow) to project
 * face landmarks forward in time. This compensates for camera exposure delay, Web Worker
 * transfer latency, and browser rendering overhead, making accessories track lag-free.
 */

interface Point3D {
  x: number;
  y: number;
  z: number;
}

export class OpticalFlowPredictor {
  private prevPoints: Point3D[] = [];
  private prevTime: number = -1;
  private velocities: Point3D[] = [];
  private accelerations: Point3D[] = [];

  constructor() {}

  /**
   * Updates landmark history and returns predicted coordinates.
   *
   * @param currentPoints Raw or smoothed landmarks for the current frame
   * @param timestampMs Performance timestamp (performance.now())
   * @param lookAheadMs Time in milliseconds to extrapolate forward (e.g. 20ms - 40ms)
   * @returns Extrapolated points representing estimated future positions
   */
  public predict(currentPoints: Point3D[], timestampMs: number, lookAheadMs: number): Point3D[] {
    if (currentPoints.length === 0) return [];

    if (this.prevTime === -1 || this.prevPoints.length !== currentPoints.length) {
      this.prevPoints = currentPoints.map(p => ({ ...p }));
      this.prevTime = timestampMs;
      this.velocities = currentPoints.map(() => ({ x: 0, y: 0, z: 0 }));
      this.accelerations = currentPoints.map(() => ({ x: 0, y: 0, z: 0 }));
      return currentPoints;
    }

    const dt = (timestampMs - this.prevTime) / 1000.0; // in seconds
    if (dt <= 0.001) {
      // Extrapolate with existing derivatives if dt is too small
      return this.extrapolate(currentPoints, lookAheadMs / 1000.0);
    }

    const lookAheadSec = lookAheadMs / 1000.0;

    for (let i = 0; i < currentPoints.length; i++) {
      const cur = currentPoints[i]!;
      const prev = this.prevPoints[i]!;
      const vel = this.velocities[i]!;
      const acc = this.accelerations[i]!;

      // 1. Calculate velocity: v = dx / dt
      const newVx = (cur.x - prev.x) / dt;
      const newVy = (cur.y - prev.y) / dt;
      const newVz = (cur.z - prev.z) / dt;

      // 2. Calculate acceleration: a = dv / dt (using EMA smoothing for acceleration to reduce noise)
      const alphaAcc = 0.3; // smoothing factor
      acc.x = alphaAcc * ((newVx - vel.x) / dt) + (1 - alphaAcc) * acc.x;
      acc.y = alphaAcc * ((newVy - vel.y) / dt) + (1 - alphaAcc) * acc.y;
      acc.z = alphaAcc * ((newVz - vel.z) / dt) + (1 - alphaAcc) * acc.z;

      // 3. Update velocity cache (smoothed slightly)
      const alphaVel = 0.6;
      vel.x = alphaVel * newVx + (1 - alphaVel) * vel.x;
      vel.y = alphaVel * newVy + (1 - alphaVel) * vel.y;
      vel.z = alphaVel * newVz + (1 - alphaVel) * vel.z;
    }

    // Cache current state for the next frame
    this.prevPoints = currentPoints.map(p => ({ ...p }));
    this.prevTime = timestampMs;

    return this.extrapolate(currentPoints, lookAheadSec);
  }

  /**
   * Helper to perform Taylor series extrapolation:
   * x_pred = x + v * dt + 0.5 * a * dt^2
   */
  private extrapolate(points: Point3D[], dt: number): Point3D[] {
    const maxExtrapolationLimit = 0.08; // Clamp extrapolation to avoid runaway values during rapid movements
    const limit = maxExtrapolationLimit;

    return points.map((p, i) => {
      const v = this.velocities[i]!;
      const a = this.accelerations[i]!;

      // Extrapolate
      let dx = v.x * dt + 0.5 * a.x * dt * dt;
      let dy = v.y * dt + 0.5 * a.y * dt * dt;
      let dz = v.z * dt + 0.5 * a.z * dt * dt;

      // Clamp delta
      dx = Math.max(-limit, Math.min(limit, dx));
      dy = Math.max(-limit, Math.min(limit, dy));
      dz = Math.max(-limit, Math.min(limit, dz));

      return {
        x: p.x + dx,
        y: p.y + dy,
        z: p.z + dz
      };
    });
  }

  public reset() {
    this.prevPoints = [];
    this.prevTime = -1;
    this.velocities = [];
    this.accelerations = [];
  }
}
