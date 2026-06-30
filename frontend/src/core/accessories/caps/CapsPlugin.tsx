import * as THREE from 'three';
import { IAccessoryPlugin } from '../IAccessoryPlugin';

export class CapsPlugin implements IAccessoryPlugin {
  private headGroup: THREE.Group;
  private currentModel: THREE.Group | null = null;
  private loadedModel: THREE.Group | null = null;
  public currentAssetUrl: string | null = null;

  // Offsets and config
  private scale: number = 1.0;
  private offsetY: number = 0.22;
  private offsetZ: number = -0.02;
  private visible: boolean = true;

  // Animation / Transition variables
  private animationState: 'idle' | 'fade-in' | 'fade-out' = 'idle';
  private animationTime: number = 0;
  private readonly transitionDuration: number = 0.2; // 200ms

  constructor(headGroup: THREE.Group) {
    this.headGroup = headGroup;
  }

  public attach(model: THREE.Group | null): void {
    this.clearCurrentModel();

    if (!model) return;

    this.loadedModel = model;
    this.currentModel = model;
    this.headGroup.add(this.currentModel);

    // Initialize animation properties
    this.animationState = 'fade-in';
    this.animationTime = 0;

    this.currentModel.scale.set(0, 0, 0);
    this.setOpacity(0);
  }

  public update(frame: { anchors: any; blendshapes?: any[]; dt: number; width: number; height: number }): void {
    let animScale = 1.0;
    let animOpacity = 1.0;

    // 1. Process fade transitions
    if (this.animationState === 'fade-in') {
      this.animationTime += frame.dt;
      const progress = Math.min(this.animationTime / this.transitionDuration, 1.0);
      animScale = progress;
      animOpacity = progress;
      if (progress >= 1.0) {
        this.animationState = 'idle';
      }
    } else if (this.animationState === 'fade-out') {
      this.animationTime += frame.dt;
      const progress = Math.min(this.animationTime / this.transitionDuration, 1.0);
      animScale = 1.0 - progress;
      animOpacity = 1.0 - progress;
      if (progress >= 1.0) {
        this.clearCurrentModel();
        return;
      }
    } else if (!this.currentModel) {
      return;
    }

    // 2. Perform anchor-locked positioning and scaling
    if (this.currentModel && frame.anchors) {
      const anchor = frame.anchors.getCapAnchor();
      if (anchor && anchor.confidence > 0.5) {
        this.currentModel.visible = this.visible;

        // Position: anchored at head top + slider offsets (scale offsets by 10)
        this.currentModel.position.copy(anchor.position).add(
          new THREE.Vector3(0, this.offsetY * 10, this.offsetZ * 10)
        );

        // Rotation: aligned with the head's rotation
        this.currentModel.quaternion.copy(anchor.rotation);

        // Scale: relative to face width (anchor.scaleRef)
        // Normalized model width is 1.0. Scale factor 1.0 fits skull perfectly.
        const sizeScale = anchor.scaleRef * this.scale * 1.0 * animScale;
        this.currentModel.scale.setScalar(sizeScale);

        // Opacity
        this.setOpacity(animOpacity);
      } else {
        this.currentModel.visible = false;
      }
    }
  }

  public setConfig(config: any): void {
    if (config.scale !== undefined) this.scale = config.scale;
    if (config.offsetY !== undefined) this.offsetY = config.offsetY;
    if (config.offsetZ !== undefined) this.offsetZ = config.offsetZ;
    if (config.visible !== undefined) this.visible = config.visible;
  }

  public remove(): void {
    if (this.currentModel && this.animationState !== 'fade-out') {
      this.animationState = 'fade-out';
      this.animationTime = 0;
    } else if (!this.currentModel) {
      this.clearCurrentModel();
    }
  }

  public dispose(): void {
    this.clearCurrentModel();
  }

  private clearCurrentModel(): void {
    if (this.currentModel) {
      this.headGroup.remove(this.currentModel);
      this.currentModel = null;
    }
    this.loadedModel = null;
    this.animationState = 'idle';
  }

  private setOpacity(opacity: number): void {
    if (!this.currentModel) return;
    this.currentModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material as THREE.Material;
        if (mat) {
          mat.transparent = true;
          mat.opacity = opacity;
        }
      }
    });
  }
}

export default CapsPlugin;
