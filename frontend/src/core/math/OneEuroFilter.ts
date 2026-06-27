/**
 * OneEuroFilter.ts
 *
 * Implements the 1€ Filter (One Euro Filter), an adaptive first-order low-pass filter
 * designed for real-time human-computer interaction. It dynamically adjusts its cutoff frequency
 * based on the velocity of the signal:
 * - Low speed: low cutoff frequency (heavy smoothing to remove static jitter).
 * - High speed: high cutoff frequency (reduces lag during quick movements).
 */

class LowPassFilter {
  private alpha: number = 0;
  private y: number = 0;
  private initialized: boolean = false;

  constructor() {}

  public filter(value: number, alpha: number): number {
    if (!this.initialized) {
      this.y = value;
      this.initialized = true;
      return value;
    }
    this.alpha = alpha;
    this.y = alpha * value + (1.0 - alpha) * this.y;
    return this.y;
  }

  public reset() {
    this.initialized = false;
    this.y = 0;
  }

  public lastValue(): number {
    return this.y;
  }
}

export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;

  private xFilter: LowPassFilter;
  private dxFilter: LowPassFilter;
  private lastTime: number = -1;
  private lastValue: number = 0;
  private initialized: boolean = false;

  /**
   * @param minCutoff Minimum cutoff frequency (Hz) for low speed (reduces static jitter)
   * @param beta Speed coefficient (determines responsiveness/lag under motion)
   * @param dCutoff Cutoff frequency (Hz) for the derivative filter (usually 1.0)
   */
  constructor(minCutoff: number = 1.0, beta: number = 0.007, dCutoff: number = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;

    this.xFilter = new LowPassFilter();
    this.dxFilter = new LowPassFilter();
  }

  private calculateAlpha(cutoff: number, elapsedSeconds: number): number {
    const tau = 1.0 / (2.0 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / elapsedSeconds);
  }

  public filter(value: number, timestampMs: number): number {
    if (this.lastTime === -1) {
      this.lastTime = timestampMs;
      this.lastValue = value;
      this.initialized = true;
      this.xFilter.filter(value, 1.0);
      return value;
    }

    const elapsed = (timestampMs - this.lastTime) / 1000.0;
    if (elapsed <= 0) {
      return this.xFilter.lastValue();
    }

    this.lastTime = timestampMs;

    // Calculate derivative (velocity) and apply low-pass filter
    const derivative = (value - this.lastValue) / elapsed;
    this.lastValue = value;

    const dAlpha = this.calculateAlpha(this.dCutoff, elapsed);
    const filteredDerivative = this.dxFilter.filter(derivative, dAlpha);

    // Compute dynamic cutoff frequency based on velocity magnitude
    const cutoff = this.minCutoff + this.beta * Math.abs(filteredDerivative);

    // Filter value
    const alpha = this.calculateAlpha(cutoff, elapsed);
    return this.xFilter.filter(value, alpha);
  }

  public reset() {
    this.xFilter.reset();
    this.dxFilter.reset();
    this.lastTime = -1;
    this.lastValue = 0;
    this.initialized = false;
  }
}

/**
 * OneEuroFilter3D class for smoothing 3D coordinates (x, y, z) or rotation vectors
 */
export class OneEuroFilter3D {
  private filters: [OneEuroFilter, OneEuroFilter, OneEuroFilter];

  constructor(minCutoff: number = 1.0, beta: number = 0.007, dCutoff: number = 1.0) {
    this.filters = [
      new OneEuroFilter(minCutoff, beta, dCutoff),
      new OneEuroFilter(minCutoff, beta, dCutoff),
      new OneEuroFilter(minCutoff, beta, dCutoff)
    ];
  }

  public filter(point: { x: number; y: number; z: number }, timestampMs: number): { x: number; y: number; z: number } {
    return {
      x: this.filters[0].filter(point.x, timestampMs),
      y: this.filters[1].filter(point.y, timestampMs),
      z: this.filters[2].filter(point.z, timestampMs)
    };
  }

  public reset() {
    this.filters.forEach(f => f.reset());
  }
}

/**
 * OneEuroFilterMulti3D filters arrays of 3D points (like face landmark meshes)
 */
export class OneEuroFilterMulti3D {
  private filters: OneEuroFilter3D[] = [];

  constructor(minCutoff: number = 0.8, beta: number = 0.005, dCutoff: number = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private minCutoff: number;
  private beta: number;
  private dCutoff: number;

  public filter(points: Array<{ x: number; y: number; z: number }>, timestampMs: number): Array<{ x: number; y: number; z: number }> {
    if (this.filters.length !== points.length) {
      this.filters = points.map(() => new OneEuroFilter3D(this.minCutoff, this.beta, this.dCutoff));
    }

    return points.map((p, i) => this.filters[i].filter(p, timestampMs));
  }

  public reset() {
    this.filters.forEach(f => f.reset());
  }
}
