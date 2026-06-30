/**
 * FaceTracker.ts
 *
 * High-level orchestrator connecting the HTML5 Video element to the MediaPipe
 * Face Mesh detection service (Web Worker offloaded with main-thread fallback).
 *
 * Coordinates:
 * - WorkerManager for off-thread calculation.
 * - TrackingStateMachine for tracking lifecycle stability.
 * - MediaPipe direct confidence weighted filters.
 * - slerp/lerp blending for smooth recovery transitions.
 */

import * as THREE from 'three';
import { WorkerManager, TrackingTelemetry } from '../core/workers/WorkerManager';
import { TrackingStateMachine, PoseState } from '../core/tracking/TrackingStateMachine';
import { performanceManager } from '../core/rendering/PerformanceManager';

export interface FaceTrackerOptions {
  alpha?: number;
  detectInterval?: number | null;
}

export class FaceTracker {
  private videoElement: HTMLVideoElement | null = null;
  private onFrameCallback: ((telemetry: any) => void) | null = null;
  private frameId: number | null = null;
  private isTracking: boolean = false;

  private workerManager = new WorkerManager();
  private stateMachine = new TrackingStateMachine();

  // Diagnostics and recovery variables
  private lastFrameTime: number = 0;
  private lastTelemetry: any = null;

  // Configuration thresholds
  private confidenceThreshold: number = 0.75;
  private wPresence: number = 0.5;
  private wDetection: number = 0.3;
  private wTracking: number = 0.2;

  constructor(options: FaceTrackerOptions = {}) {
    // Note: detectInterval is managed dynamically via the PerformanceManager
  }

  /**
   * Start the face tracking loop on a video element.
   */
  public async start(videoElement: HTMLVideoElement, onFrameCallback: (telemetry: any) => void): Promise<void> {
    if (!videoElement) {
      throw new Error('[FaceTracker] A valid HTMLVideoElement must be provided.');
    }
    if (typeof onFrameCallback !== 'function') {
      throw new Error('[FaceTracker] An onFrame callback function is required.');
    }

    this.videoElement = videoElement;
    this.onFrameCallback = onFrameCallback;
    this.isTracking = true;
    
    this.lastFrameTime = performance.now();
    this.lastTelemetry = null;
    this.stateMachine.reset();

    // 1. Initialize Worker Manager
    await this.workerManager.initialize((workerTelemetry) => {
      this.handleWorkerTelemetry(workerTelemetry);
    });

    // 2. Clear any active loops
    this.stopLoop();

    // 3. Initiate tracking loop
    console.log('[FaceTracker] Starting requestAnimationFrame loop (Web Worker offloaded)...');
    this.tick();
  }

  /**
   * Stop the active face tracking loop.
   */
  public stop(): void {
    this.isTracking = false;
    this.stopLoop();
    this.stateMachine.reset();
    this.workerManager.destroy();
    console.log('[FaceTracker] Tracking loop stopped.');
  }

  private stopLoop(): void {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  /**
   * Frame-by-frame loop execution.
   */
  private tick(): void {
    if (!this.isTracking || !this.videoElement) return;

    const video = this.videoElement;

    // Process frame if video is in active playback state
    if (video.readyState >= 2 && !video.paused) {
      try {
        const timestamp = performance.now();
        
        // Dynamically throttle worker detection frequency based on performance manager
        const pSettings = performanceManager.getSettings();
        const elapsed = timestamp - this.lastFrameTime;

        if (elapsed >= pSettings.detectIntervalMs) {
          // Submit frame to Worker
          this.workerManager.processFrame(video, timestamp);
        }
      } catch (err) {
        console.error('[FaceTracker] Error in frame detection tick:', err);
      }
    }

    // Schedule next frame
    if (this.isTracking) {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  /**
   * Receives telemetry updates from the Worker thread.
   * Handles lifecycle states, slerp/lerp pose blending, and confidence filtering.
   */
  private handleWorkerTelemetry(workerTelemetry: TrackingTelemetry): void {
    if (!this.isTracking) return;

    const now = performance.now();
    const dt = this.lastFrameTime ? (now - this.lastFrameTime) / 1000.0 : 0.016;
    this.lastFrameTime = now;

    // Feed real-time FPS into PerformanceManager
    performanceManager.tick(dt);

    // 1. Calculate weighted MediaPipe confidence
    let faceDetected = workerTelemetry.faceDetected;
    let confidenceVal = 0.0;

    if (faceDetected && workerTelemetry.confidence) {
      const c = workerTelemetry.confidence;
      // Weighted formula: 0.5 * Presence + 0.3 * Detection + 0.2 * Tracking
      confidenceVal =
        this.wPresence * c.facePresenceScore +
        this.wDetection * c.faceDetectionConfidence +
        this.wTracking * c.trackingConfidence;
      
      // If weighted score drops below the threshold, treat as temporarily lost
      if (confidenceVal < this.confidenceThreshold) {
        faceDetected = false;
      }
    }

    // 2. Prepare FSM pose input
    const currentPose: PoseState | null = (faceDetected && workerTelemetry.pose) ? {
      position: workerTelemetry.pose.position,
      quaternion: workerTelemetry.pose.quaternion,
      scale: workerTelemetry.pose.scale
    } : null;

    // 3. Step Tracking State Machine
    this.stateMachine.update(faceDetected, currentPose, dt);
    const trackingState = this.stateMachine.getState();
    const fadeFactor = this.stateMachine.getFadeFactor();

    // 4. Handle State Outputs
    if (trackingState === 'Searching' || !this.onFrameCallback) {
      this.onFrameCallback?.({
        faceDetected: false,
        trackingState: 'Searching',
        fadeFactor: 0.0,
        landmarks: [],
        blendshapes: {},
        timestamp: workerTelemetry.timestamp
      });
      this.lastTelemetry = null;
      return;
    }

    let finalPosition: [number, number, number] = [0, 0, 0];
    let finalQuaternion: [number, number, number, number] = [0, 0, 0, 1];
    let finalScale: [number, number, number] = [1, 1, 1];
    let landmarks = workerTelemetry.landmarks;
    let anchors = workerTelemetry.anchors;
    let biometrics = workerTelemetry.biometrics;
    let blendshapes = workerTelemetry.blendshapes;

    if (trackingState === 'TemporarilyLost') {
      // Freeze transforms and reuse cached data while fading accessories
      const frozen = this.stateMachine.getFrozenPose();
      if (frozen && this.lastTelemetry) {
        finalPosition = frozen.position;
        finalQuaternion = frozen.quaternion;
        finalScale = frozen.scale;
        landmarks = this.lastTelemetry.landmarks;
        anchors = this.lastTelemetry.anchors;
        biometrics = this.lastTelemetry.biometrics;
        blendshapes = this.lastTelemetry.blendshapes;
      }
    } else if (trackingState === 'Recovering' && currentPose) {
      // Blend pose: slerp quaternion and lerp translation to avoid sudden jumps
      const frozen = this.stateMachine.getFrozenPose();
      const blend = this.stateMachine.getRecoveryBlend();
      
      if (frozen) {
        // Reconstruct ThreeJS instances for blending
        const vFrozen = new THREE.Vector3().fromArray(frozen.position);
        const vCurrent = new THREE.Vector3().fromArray(currentPose.position);
        const vBlended = new THREE.Vector3().lerpVectors(vFrozen, vCurrent, blend);
        finalPosition = [vBlended.x, vBlended.y, vBlended.z];

        const qFrozen = new THREE.Quaternion().fromArray(frozen.quaternion);
        const qCurrent = new THREE.Quaternion().fromArray(currentPose.quaternion);
        const qBlended = qFrozen.clone().slerp(qCurrent, blend);
        finalQuaternion = [qBlended.x, qBlended.y, qBlended.z, qBlended.w];

        const sFrozen = new THREE.Vector3().fromArray(frozen.scale);
        const sCurrent = new THREE.Vector3().fromArray(currentPose.scale);
        const sBlended = new THREE.Vector3().lerpVectors(sFrozen, sCurrent, blend);
        finalScale = [sBlended.x, sBlended.y, sBlended.z];
      } else {
        finalPosition = currentPose.position;
        finalQuaternion = currentPose.quaternion;
        finalScale = currentPose.scale;
      }
    } else if (currentPose) {
      // Normal Tracking
      finalPosition = currentPose.position;
      finalQuaternion = currentPose.quaternion;
      finalScale = currentPose.scale;
    }

    // Assemble final telemetry payload
    const telemetry = {
      faceDetected: true,
      trackingState,
      fadeFactor,
      landmarks,
      pose: {
        position: finalPosition,
        quaternion: finalQuaternion,
        scale: finalScale
      },
      biometrics,
      anchors,
      blendshapes,
      timestamp: workerTelemetry.timestamp,
      latency: workerTelemetry.latency,
      workerLatency: workerTelemetry.workerLatency || 0
    };

    // Cache latest telemetry
    this.lastTelemetry = telemetry;

    this.onFrameCallback(telemetry);
  }
}

export default FaceTracker;
