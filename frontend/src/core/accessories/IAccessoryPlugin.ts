import * as THREE from 'three';

export interface IAccessoryPlugin {
  /**
   * Attaches the normalized 3D model to the plugin's internal state.
   * If model is null, resets/clears the active accessory.
   */
  attach(model: THREE.Group | null): void;

  /**
   * Ticks the plugin rendering loop, aligning the normalized model
   * to resolved landmarks anchors and advancing fade-in/fade-out transitions.
   */
  update(frame: {
    anchors: any;
    biometrics?: any;
    jawOpenScore?: number;
    blendshapes?: any;
    dt: number;
    width: number;
    height: number;
  }): void;

  /**
   * Sets custom configuration properties (e.g. scales, offsets, opacity, colors).
   */
  setConfig(config: any): void;

  /**
   * Triggers a smooth scale-down / fade-out remove transition.
   */
  remove(): void;

  /**
   * Disposes geometries, materials, and maps to prevent memory leaks.
   */
  dispose(): void;
}
