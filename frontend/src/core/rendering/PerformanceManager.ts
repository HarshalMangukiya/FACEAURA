/**
 * PerformanceManager.ts
 *
 * Monitors real-time frame rates (FPS) and dynamically scales graphics, tracking,
 * and physics computations to maintain smooth interaction.
 *
 * Scaling States:
 * - High Performance (FPS >= 50): All features active (high worker rate, shadows, physics).
 * - Moderate Throttle (35 <= FPS < 50): Throttles worker thread rate, reduces shadow maps.
 * - Heavy Throttle (FPS < 35): Disables secondary physics, disables shadows, and skips face occlusion frames.
 *
 * Automatically recovers engine settings if FPS stabilizes for a sustained period.
 */

export interface PerformanceSettings {
  fps: number;
  enablePhysics: boolean;
  enableShadows: boolean;
  occlusionUpdateInterval: number; // 1 = every frame, 2 = every 2nd frame, etc.
  blendshapeUpdateInterval: number;
  detectIntervalMs: number; // worker throttling
}

export class PerformanceManager {
  private fps: number = 60;
  private frameTimes: number[] = [];
  private readonly maxWindowSize = 60;

  // Active settings state
  private enablePhysics: boolean = true;
  private enableShadows: boolean = true;
  private occlusionUpdateInterval: number = 1;
  private blendshapeUpdateInterval: number = 1;
  private detectIntervalMs: number = 16.6; // ~60fps target

  // Timers for scaling actions
  private lastThrottleTime: number = 0;
  private lastRecoveryTime: number = 0;
  private readonly coolDownMs = 4000; // 4s cooldown between adjustments

  // Frame tick counter to distribute work
  private frameCounter: number = 0;

  constructor() {}

  public getSettings(): PerformanceSettings {
    return {
      fps: Math.round(this.fps),
      enablePhysics: this.enablePhysics,
      enableShadows: this.enableShadows,
      occlusionUpdateInterval: this.occlusionUpdateInterval,
      blendshapeUpdateInterval: this.blendshapeUpdateInterval,
      detectIntervalMs: this.detectIntervalMs
    };
  }

  /**
   * Monitor frame delta times and adjust parameters when performance drops.
   *
   * @param dt Frame delta time in seconds
   */
  public tick(dt: number): void {
    this.frameCounter++;
    
    // 1. Calculate running average FPS
    const currentFps = 1.0 / (dt + 0.0001);
    this.frameTimes.push(currentFps);
    if (this.frameTimes.length > this.maxWindowSize) {
      this.frameTimes.shift();
    }

    const sum = this.frameTimes.reduce((a, b) => a + b, 0);
    this.fps = sum / this.frameTimes.length;

    const now = performance.now();

    // 2. Perform dynamic scaling checks (throttled by cooldown)
    if (now - this.lastThrottleTime > this.coolDownMs) {
      if (this.fps < 35.0) {
        this.throttleHeavy(now);
      } else if (this.fps < 48.0) {
        this.throttleModerate(now);
      } else if (this.fps >= 53.0 && now - this.lastRecoveryTime > this.coolDownMs * 2) {
        this.recoverSettings(now);
      }
    }
  }

  /**
   * Determines if a specific computation should execute on the current frame.
   *
   * @param interval The throttling update interval (e.g. 1 = every frame, 2 = every 2nd frame)
   */
  public shouldUpdateThisFrame(interval: number): boolean {
    return this.frameCounter % interval === 0;
  }

  private throttleModerate(now: number): void {
    console.warn(`[PerformanceManager] FPS dropped to ${this.fps.toFixed(1)}. Applying moderate throttle.`);
    
    // Slow down worker inference rate to ~30 FPS to save CPU/GPU cycles
    this.detectIntervalMs = 33.3; 
    
    // Keep physics enabled but alert shadows
    this.enablePhysics = true;
    this.enableShadows = true;
    
    this.occlusionUpdateInterval = 1;
    this.blendshapeUpdateInterval = 2; // skip every second blendshape calculation
    
    this.lastThrottleTime = now;
    this.frameTimes = []; // Clear history to re-evaluate
  }

  private throttleHeavy(now: number): void {
    console.error(`[PerformanceManager] Critically low FPS: ${this.fps.toFixed(1)}. Applying heavy throttle.`);
    
    // Slow down worker rate to ~20 FPS
    this.detectIntervalMs = 50.0;
    
    // Disable shadows and physics to free up rendering budget
    this.enablePhysics = false;
    this.enableShadows = false;
    
    // Run occlusion mesh deformation every 3rd frame only
    this.occlusionUpdateInterval = 3;
    this.blendshapeUpdateInterval = 3;
    
    this.lastThrottleTime = now;
    this.frameTimes = [];
  }

  private recoverSettings(now: number): void {
    let recovered = false;

    if (this.detectIntervalMs > 16.6) {
      // Step back up to 60 FPS worker rate
      this.detectIntervalMs = 16.6;
      recovered = true;
    }

    if (!this.enablePhysics) {
      this.enablePhysics = true;
      recovered = true;
    }

    if (!this.enableShadows) {
      this.enableShadows = true;
      recovered = true;
    }

    if (this.occlusionUpdateInterval > 1) {
      this.occlusionUpdateInterval = 1;
      recovered = true;
    }

    if (this.blendshapeUpdateInterval > 1) {
      this.blendshapeUpdateInterval = 1;
      recovered = true;
    }

    if (recovered) {
      console.log(`[PerformanceManager] FPS stabilized at ${this.fps.toFixed(1)}. Restoring engine parameters.`);
      this.lastRecoveryTime = now;
      this.frameTimes = [];
    }
  }
}

export const performanceManager = new PerformanceManager();
export default performanceManager;
