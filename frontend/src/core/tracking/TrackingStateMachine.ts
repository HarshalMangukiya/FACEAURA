/**
 * TrackingStateMachine.ts
 *
 * Implements the face tracking lifecycle state machine.
 * States:
 * - Searching: No face detected. UI shows loading indicators.
 * - Tracking: Solid face lock. Updates follow face coordinates.
 * - TemporarilyLost: Face lost briefly. Freezes pose and decays visibility (fadeFactor) to avoid pops.
 * - Recovering: Face re-acquired. Blends (lerp/slerp) coordinates from frozen state to current to prevent jumps.
 * - Paused: Active tracking loop is paused.
 */

export type TrackingState =
  | 'Searching'
  | 'Tracking'
  | 'TemporarilyLost'
  | 'Recovering'
  | 'Paused';

export interface PoseState {
  position: [number, number, number]; // [x, y, z]
  quaternion: [number, number, number, number]; // [x, y, z, w]
  scale: [number, number, number]; // [x, y, z]
}

export class TrackingStateMachine {
  private state: TrackingState = 'Searching';
  private fadeFactor: number = 0.0;
  
  // Recovery parameters
  private recoveryBlend: number = 0.0;
  private recoveryTimer: number = 0.0;
  private readonly recoveryDurationMs: number = 200.0; // 200ms recovery window

  // Lost parameters
  private lostFrameCount: number = 0;
  private readonly maxLostFrames: number = 10; // Max frames to hold frozen pose

  // Cache for frozen coordinates
  private frozenPose: PoseState | null = null;
  private stateListeners: Set<(state: TrackingState, fade: number) => void> = new Set();

  constructor() {}

  public getState(): TrackingState {
    return this.state;
  }

  public getFadeFactor(): number {
    return this.fadeFactor;
  }

  public getRecoveryBlend(): number {
    return this.recoveryBlend;
  }

  public getFrozenPose(): PoseState | null {
    return this.frozenPose;
  }

  /**
   * Subscribes to state transition updates.
   */
  public onStateChange(listener: (state: TrackingState, fade: number) => void): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * Processes a new frame's detection status and steps state timers.
   *
   * @param faceDetected If MediaPipe detected a face in the current frame
   * @param currentRawPose The raw coordinate matrices of the current frame
   * @param dt Elapsed delta time in seconds
   */
  public update(faceDetected: boolean, currentRawPose: PoseState | null, dt: number): void {
    if (this.state === 'Paused') {
      this.fadeFactor = 0.0;
      return;
    }

    const dtMs = dt * 1000.0;

    switch (this.state) {
      case 'Searching':
        this.fadeFactor = 0.0;
        this.recoveryBlend = 0.0;
        this.frozenPose = null;
        if (faceDetected && currentRawPose) {
          this.fadeFactor = 1.0;
          this.transitionTo('Tracking');
        }
        break;

      case 'Tracking':
        this.fadeFactor = 1.0;
        this.recoveryBlend = 1.0;
        this.lostFrameCount = 0;
        
        if (faceDetected && currentRawPose) {
          // Keep cache updated
          this.frozenPose = this.clonePose(currentRawPose);
        } else {
          // Transition to TemporarilyLost on first missing frame
          this.lostFrameCount = 1;
          this.fadeFactor = 1.0 - this.lostFrameCount / this.maxLostFrames;
          this.transitionTo('TemporarilyLost');
        }
        break;

      case 'TemporarilyLost':
        // If we are already in this state, increment count on subsequent updates
        if (faceDetected && currentRawPose) {
          // If face is found before max frame limit, transition to Recovering to blend pose
          this.fadeFactor = 1.0;
          this.transitionTo('Recovering');
          this.recoveryTimer = 0.0;
          this.recoveryBlend = 0.0;
        } else {
          this.lostFrameCount++;
          // Decay fade factor linearly based on frame counts
          this.fadeFactor = Math.max(0.0, 1.0 - this.lostFrameCount / this.maxLostFrames);
          
          if (this.lostFrameCount >= this.maxLostFrames) {
            // Fully lost, transition back to Searching
            this.fadeFactor = 0.0;
            this.transitionTo('Searching');
          }
        }
        break;

      case 'Recovering':
        this.fadeFactor = 1.0;
        this.recoveryTimer += dtMs;
        this.recoveryBlend = Math.min(1.0, this.recoveryTimer / this.recoveryDurationMs);

        if (!faceDetected) {
          // Lost again during recovery
          this.transitionTo('TemporarilyLost');
        } else if (this.recoveryBlend >= 1.0) {
          // Fully blended, transition to stable Tracking
          if (currentRawPose) {
            this.frozenPose = this.clonePose(currentRawPose);
          }
          this.fadeFactor = 1.0;
          this.transitionTo('Tracking');
        }
        break;
    }
  }

  /**
   * Resets the state machine variables.
   */
  public reset(): void {
    this.state = 'Searching';
    this.fadeFactor = 0.0;
    this.recoveryBlend = 0.0;
    this.recoveryTimer = 0.0;
    this.lostFrameCount = 0;
    this.frozenPose = null;
  }

  /**
   * Forces tracking loop to paused/active.
   */
  public setPaused(paused: boolean): void {
    if (paused) {
      this.fadeFactor = 0.0;
      this.transitionTo('Paused');
    } else {
      this.fadeFactor = 0.0;
      this.transitionTo('Searching');
    }
  }

  private transitionTo(newState: TrackingState): void {
    if (this.state === newState) return;
    console.log(`[TrackingStateMachine] State changed: ${this.state} -> ${newState}`);
    this.state = newState;
    this.stateListeners.forEach((listener) => listener(this.state, this.fadeFactor));
  }

  private clonePose(pose: PoseState): PoseState {
    return {
      position: [...pose.position],
      quaternion: [...pose.quaternion],
      scale: [...pose.scale]
    };
  }
}

export default TrackingStateMachine;
