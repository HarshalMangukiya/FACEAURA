import * as THREE from 'three';
import { IAccessoryPlugin } from '../IAccessoryPlugin';

export class HairPlugin implements IAccessoryPlugin {
  private headGroup: THREE.Group;
  private currentModel: THREE.Group | null = null;
  private loadedModel: THREE.Group | null = null;
  public currentAssetUrl: string | null = null;

  // Offsets and config
  private scale: number = 1.0;
  private offsetY: number = 0.18;
  private offsetZ: number = -0.05;
  private visible: boolean = true;
  private hairColor: string = 'Original';

  // Damped spring-mass variables to simulate hair swaying
  private velocity = new THREE.Vector3();
  private displacement = new THREE.Vector3();
  private prevHeadPos = new THREE.Vector3();
  private stiffness: number = 18.0; // Spring constant
  private damping: number = 3.5;     // Damping constant

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

    this.prevHeadPos.copy(this.headGroup.position);
    this.displacement.set(0, 0, 0);
    this.velocity.set(0, 0, 0);

    // Apply color tinting
    this.setColor(this.hairColor);
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

    // 2. Perform spring physics swaying updates
    this.updatePhysics(frame.dt);

    // 3. Anchor tracking updates
    if (this.currentModel && frame.anchors) {
      const anchor = frame.anchors.getHairAnchor();
      if (anchor && anchor.confidence > 0.5) {
        this.currentModel.visible = this.visible;

        // Position: anchored at hairline + offsets + physics swaying displacement
        this.currentModel.position.set(
          anchor.position.x + this.displacement.x,
          anchor.position.y + this.offsetY * 10 + this.displacement.y,
          anchor.position.z + this.offsetZ * 10 + this.displacement.z
        );

        // Rotation: aligned with head + physics sway tilt angle
        const baseQuat = anchor.rotation.clone();
        const swayRot = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(this.displacement.z * 0.35, 0, -this.displacement.x * 0.35)
        );
        this.currentModel.quaternion.copy(baseQuat).multiply(swayRot);

        // Scale: relative to face width (anchor.scaleRef)
        // Normalized model width is 1.0. Scale factor 1.05 fits head width perfectly.
        const sizeScale = anchor.scaleRef * this.scale * 1.05 * animScale;
        this.currentModel.scale.setScalar(sizeScale);

        // Opacity
        this.setOpacity(animOpacity);
      } else {
        this.currentModel.visible = false;
      }
    }
  }

  private updatePhysics(dt: number): void {
    if (!this.currentModel) return;

    // Head acceleration (spring inertia driver)
    const currentHeadPos = this.headGroup.position;
    const acceleration = new THREE.Vector3()
      .subVectors(currentHeadPos, this.prevHeadPos)
      .multiplyScalar(1.0 / (dt * dt + 0.0001));

    acceleration.clampLength(0, 150); // Clamp sudden jitters
    this.prevHeadPos.copy(currentHeadPos);

    // Spring equation calculations
    const springForce = this.displacement.clone().multiplyScalar(-this.stiffness);
    const dampingForce = this.velocity.clone().multiplyScalar(-this.damping);
    const inertiaForce = acceleration.multiplyScalar(-0.015); // mass factor

    const netAcceleration = new THREE.Vector3()
      .add(springForce)
      .add(dampingForce)
      .add(inertiaForce);

    this.velocity.addScaledVector(netAcceleration, dt);
    this.displacement.addScaledVector(this.velocity, dt);
    this.displacement.clampLength(0, 0.4); // Clamp maximum sway distance
  }

  public setConfig(config: any): void {
    if (config.scale !== undefined) this.scale = config.scale;
    if (config.offsetY !== undefined) this.offsetY = config.offsetY;
    if (config.offsetZ !== undefined) this.offsetZ = config.offsetZ;
    if (config.visible !== undefined) this.visible = config.visible;
    if (config.color !== undefined) {
      this.hairColor = config.color;
      this.setColor(this.hairColor);
    }
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

  private setColor(colorName: string): void {
    if (!this.currentModel) return;

    let targetColor = new THREE.Color(0x3a2314); // Default Brown
    let isOriginal = false;

    const colorMap: Record<string, number> = {
      black: 0x0a0a0a,
      brown: 0x4a2c11,
      'dark brown': 0x2b1a0c,
      golden: 0xd4af37,
      blonde: 0xfaf0be,
      'ash blonde': 0xc8b295,
      grey: 0x8a8a8a,
      silver: 0xdcdcdc,
      red: 0xbf2c2c,
      blue: 0x2563eb,
      purple: 0x9333ea,
      pink: 0xf472b6
    };

    const resolved = colorMap[colorName.toLowerCase()];
    if (resolved !== undefined) {
      targetColor.setHex(resolved);
    } else if (colorName.startsWith('#')) {
      targetColor.set(colorName);
    } else {
      isOriginal = true;
    }

    this.currentModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material as THREE.MeshStandardMaterial;
        if (mat) {
          if (isOriginal) {
            mat.color.setHex(0xffffff); // resetting override tint to neutral
          } else {
            mat.color.copy(targetColor);
          }
        }
      }
    });
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

export default HairPlugin;
