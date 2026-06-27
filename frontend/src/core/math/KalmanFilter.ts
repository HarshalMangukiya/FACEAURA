/**
 * KalmanFilter.ts
 *
 * Implements a constant-velocity Kalman Filter for 1D values and 3D vectors.
 * Uses a State Transition Matrix (F), Measurement Matrix (H), Process Noise Covariance (Q),
 * Measurement Noise Covariance (R), and Estimate Error Covariance (P) to predict
 * and correct tracking states. Excellent for filtering noisy camera data.
 */

export class KalmanFilter1D {
  private x: number = 0; // State estimate (position)
  private v: number = 0; // State estimate (velocity)
  private p: number = 1.0; // Estimate error covariance
  private q: number; // Process noise covariance
  private r: number; // Measurement noise covariance
  private initialized: boolean = false;
  private lastTime: number = -1;

  /**
   * @param q Process noise covariance (defaults to 0.05, lower means smoother but lags)
   * @param r Measurement noise covariance (defaults to 1.5, higher means ignores noisy camera spikes)
   */
  constructor(q: number = 0.05, r: number = 1.5) {
    this.q = q;
    this.r = r;
  }

  /**
   * Predicts and corrects the state estimate based on a new measurement.
   */
  public update(measurement: number, timestampMs: number): number {
    if (!this.initialized || this.lastTime === -1) {
      this.x = measurement;
      this.v = 0;
      this.p = 1.0;
      this.lastTime = timestampMs;
      this.initialized = true;
      return this.x;
    }

    const dt = (timestampMs - this.lastTime) / 1000.0;
    this.lastTime = timestampMs;

    if (dt <= 0) return this.x;

    // 1. PREDICT state: x_k|k-1 = F * x_k-1|k-1
    // F = [1 dt; 0 1]
    const xPredict = this.x + this.v * dt;
    const vPredict = this.v;

    // Predict error covariance: P_k|k-1 = F * P_k-1|k-1 * F^T + Q
    // We simplify matrix multiplication for 2D state vector [x, v]:
    const qPos = this.q * dt * dt * 0.25;
    const qVel = this.q * dt;
    let pPredict = this.p + qPos + qVel * dt;

    // 2. CORRECT / UPDATE state with new measurement
    // Kalman Gain: K = P_k|k-1 * H^T * (H * P_k|k-1 * H^T + R)^-1
    // H = [1, 0] (we only measure position)
    const k = pPredict / (pPredict + this.r);

    // Update state estimate: x_k|k = x_k|k-1 + K * (z_k - H * x_k|k-1)
    this.x = xPredict + k * (measurement - xPredict);
    // Estimate velocity implicitly from update shift
    this.v = vPredict + (k / dt) * (measurement - xPredict);

    // Update error covariance: P_k|k = (I - K * H) * P_k|k-1
    this.p = (1.0 - k) * pPredict;

    return this.x;
  }

  public reset() {
    this.initialized = false;
    this.lastTime = -1;
    this.x = 0;
    this.v = 0;
    this.p = 1.0;
  }
}

export class KalmanFilter3D {
  private filters: [KalmanFilter1D, KalmanFilter1D, KalmanFilter1D];

  constructor(q: number = 0.05, r: number = 1.5) {
    this.filters = [
      new KalmanFilter1D(q, r),
      new KalmanFilter1D(q, r),
      new KalmanFilter1D(q, r)
    ];
  }

  public update(point: { x: number; y: number; z: number }, timestampMs: number): { x: number; y: number; z: number } {
    return {
      x: this.filters[0].update(point.x, timestampMs),
      y: this.filters[1].update(point.y, timestampMs),
      z: this.filters[2].update(point.z, timestampMs)
    };
  }

  public reset() {
    this.filters.forEach(f => f.reset());
  }
}
