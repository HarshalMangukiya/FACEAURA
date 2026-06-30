/**
 * AccessoryPlugin.ts
 *
 * Configurable, high-performance accessory plugin.
 * Processes 3D overlays using:
 * - JSON config specifications for anchors, scaling multipliers, and offsets.
 * - Static scratch vectors/matrices to avoid memory allocations in the animation loop.
 * - slerp() quaternion rotations to eliminate gimbal lock.
 * - Dynamic blendshape modifications (e.g. stretching meshes on mouth opens).
 * - Real-time physics throttling using PerformanceManager status.
 */

import * as THREE from 'three';
import { IAccessoryPlugin } from './IAccessoryPlugin';
import { pivotCorrector } from './PivotCorrector';
import { FaceBiometrics } from './ScaleCalculator';
import { PureJSAnchor } from '../workers/tracker.worker.math';
import { performanceManager } from '../rendering/PerformanceManager';

export class AccessoryPlugin implements IAccessoryPlugin {
  private category: string;
  private headGroup: THREE.Group;
  private currentModel: THREE.Group | null = null;
  private loadedModel: THREE.Group | null = null;
  public currentAssetUrl: string | null = null;

  // Configuration settings (JSON-driven)
  private configPivot: string = 'center';
  private configScaling: any = null;
  private configOffsets: any = null;
  private configBlendshapes: any = null;
  private configOcclusion: boolean = true;

  private scaleMultiplier: number = 1.0;
  private visible: boolean = true;
  private accessoryColor: string = 'Original';

  // Physics state
  private velocity = new THREE.Vector3();
  private displacement = new THREE.Vector3();
  private prevHeadPos = new THREE.Vector3();
  private stiffness: number = 15.0;
  private damping: number = 3.5;
  private mass: number = 0.015;
  private maxSway: number = 0.35;

  // Animation / Transition variables
  private animationState: 'idle' | 'fade-in' | 'fade-out' = 'idle';
  private animationTime: number = 0;
  private readonly transitionDuration: number = 0.2; // 200ms

  // ==========================================
  // STATIC REUSABLE MEMORY POOLS (GC-FREE)
  // ==========================================
  private static scratchPos = new THREE.Vector3();
  private static scratchRot = new THREE.Quaternion();
  private static scratchScale = new THREE.Vector3();
  
  private static localMatrix = new THREE.Matrix4();
  private static tMat = new THREE.Matrix4();
  private static rMat = new THREE.Matrix4();
  private static sMat = new THREE.Matrix4();

  private static swayRot = new THREE.Quaternion();
  private static dynamicOffset = new THREE.Vector3();
  private static tempAnchorRot = new THREE.Quaternion();

  constructor(category: string, headGroup: THREE.Group, config: any = {}) {
    this.category = category;
    this.headGroup = headGroup;

    if (config.stiffness !== undefined) this.stiffness = config.stiffness;
    if (config.damping !== undefined) this.damping = config.damping;
    if (config.mass !== undefined) this.mass = config.mass;
    if (config.maxSway !== undefined) this.maxSway = config.maxSway;
  }

  /**
   * Sets custom configuration properties.
   */
  public setConfig(config: any): void {
    if (config.pivot !== undefined) this.configPivot = config.pivot;
    if (config.scaling !== undefined) this.configScaling = config.scaling;
    if (config.offsets !== undefined) this.configOffsets = config.offsets;
    if (config.blendshapeSupport !== undefined) this.configBlendshapes = config.blendshapeSupport;
    if (config.occlusion !== undefined) this.configOcclusion = config.occlusion;

    if (config.scale !== undefined) this.scaleMultiplier = config.scale;
    if (config.visible !== undefined) this.visible = config.visible;
    if (config.color !== undefined) {
      this.accessoryColor = config.color;
      this.setColor(this.accessoryColor);
    }
  }

  /**
   * Attaches the loaded 3D model, runs pivot correction, and initiates fade-in.
   */
  public attach(model: THREE.Group | null): void {
    this.clearCurrentModel();

    if (!model) return;

    this.loadedModel = model;
    this.currentModel = model;
    this.headGroup.add(this.currentModel);
    console.log(`[AccessoryPlugin:${this.category}] Accessory Loaded & Added to Scene successfully.`);

    pivotCorrector.correctPivot(this.currentModel, this.category);

    // 2. Disable matrix auto updates to force manual transforms
    this.currentModel.matrixAutoUpdate = false;

    // 3. Reset transition details
    this.animationState = 'fade-in';
    this.animationTime = 0;

    // Reset physics
    this.prevHeadPos.copy(this.headGroup.position);
    this.displacement.set(0, 0, 0);
    this.velocity.set(0, 0, 0);

    this.setColor(this.accessoryColor);
  }

  /**
   * Steps physics, resolves coordinates/scaling/blendshapes, and applies transformation matrix.
   */
  public update(frame: {
    anchors: Record<string, PureJSAnchor>;
    biometrics: FaceBiometrics;
    jawOpenScore: number;
    blendshapes: Record<string, number>;
    dt: number;
    width: number;
    height: number;
  }): void {
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

    // 2. Step spring physics if active and enabled by PerformanceManager
    const hasPhysics = ['hair', 'leftEarring', 'rightEarring', 'necklace'].includes(this.category);
    const pSettings = performanceManager.getSettings();
    
    if (hasPhysics && pSettings.enablePhysics) {
      this.updatePhysics(frame.dt);
    } else {
      this.displacement.set(0, 0, 0);
    }

    // 3. Anchor-locked matrix calculations
    if (this.currentModel && frame.anchors) {
      const anchor = frame.anchors[this.category];
      if (anchor) {
        this.currentModel.visible = this.visible;

        // A. Resolve Scaling based on config source
        const biometrics = frame.biometrics;
        const scaling = this.configScaling;
        
        let wVal = biometrics.faceWidth;
        let hVal = biometrics.faceHeight;
        let dVal = biometrics.headDepth;

        if (scaling) {
          if (scaling.widthSource === 'temple-distance') wVal = biometrics.templeDistance;
          else if (scaling.widthSource === 'eye-distance') wVal = biometrics.eyeDistance;
          else if (scaling.widthSource === 'jaw-width') wVal = biometrics.jawWidth;

          if (scaling.heightSource === 'forehead-chin') hVal = biometrics.faceHeight;
          else if (scaling.heightSource === 'eye-height') hVal = biometrics.eyeDistance; // proportional Eye height fallback
          else if (scaling.heightSource === 'jaw-height') hVal = biometrics.jawHeight;
          else if (scaling.heightSource === 'none') hVal = wVal; // square ratio

          if (scaling.depthSource === 'head-depth') dVal = biometrics.headDepth;
          else if (scaling.depthSource === 'none') dVal = wVal;
        }

        const widthMultiplier = scaling ? scaling.widthMultiplier : 1.0;
        const heightMultiplier = scaling ? scaling.heightMultiplier : 1.0;
        const depthMultiplier = scaling ? scaling.depthMultiplier : 1.0;

        const baseScaleX = wVal * widthMultiplier * this.scaleMultiplier * animScale;
        const baseScaleY = hVal * heightMultiplier * this.scaleMultiplier * animScale;
        const baseScaleZ = dVal * depthMultiplier * this.scaleMultiplier * animScale;

        // Recycle scaling vector from pool
        const scaleVec = AccessoryPlugin.scratchScale.set(baseScaleX, baseScaleY, baseScaleZ);

        // B. Apply Blendshape deformations (e.g. stretching beard when mouth opens)
        if (this.configBlendshapes && frame.blendshapes) {
          for (const key of Object.keys(this.configBlendshapes)) {
            const score = frame.blendshapes[key] || 0.0;
            const modifiers = this.configBlendshapes[key];
            if (modifiers) {
              if (modifiers.scaleY !== undefined) {
                scaleVec.y *= (1.0 + score * modifiers.scaleY);
              }
              if (modifiers.scaleX !== undefined) {
                scaleVec.x *= (1.0 + score * modifiers.scaleX);
              }
            }
          }
        }

        // C. Resolve dynamic offsets using pre-allocated vector
        const offsets = this.configOffsets;
        const offsetVec = AccessoryPlugin.dynamicOffset.set(0, 0, 0);
        
        if (offsets) {
          if (offsets.xScaleFactor !== undefined) {
            offsetVec.x = offsets.xScaleFactor * biometrics.faceWidth;
          }
          if (offsets.yScaleFactor !== undefined) {
            offsetVec.y = offsets.yScaleFactor * biometrics.faceHeight;
          }
          if (offsets.zScaleFactor !== undefined) {
            offsetVec.z = offsets.zScaleFactor * biometrics.headDepth;
          }
        }

        // D. Calculate position (Anchor position + Physics displacement + offsets)
        const anchorPos = AccessoryPlugin.scratchPos.fromArray(anchor.position);
        const finalPosition = anchorPos.add(this.displacement).add(offsetVec);

        // E. Reconstruct Quaternion rotation
        const anchorRot = AccessoryPlugin.tempAnchorRot.fromArray(anchor.rotation);
        const finalRotation = AccessoryPlugin.scratchRot.copy(anchorRot);
        
        if (hasPhysics && pSettings.enablePhysics) {
          const swayRot = AccessoryPlugin.swayRot.setFromEuler(
            new THREE.Euler(this.displacement.z * 0.35, 0, -this.displacement.x * 0.35)
          );
          finalRotation.multiply(swayRot);
        }

        // F. Compose Matrix using pre-allocated structures
        const localMatrix = AccessoryPlugin.localMatrix;
        const tMat = AccessoryPlugin.tMat.makeTranslation(finalPosition.x, finalPosition.y, finalPosition.z);
        const rMat = AccessoryPlugin.rMat.makeRotationFromQuaternion(finalRotation);
        const sMat = AccessoryPlugin.sMat.makeScale(scaleVec.x, scaleVec.y, scaleVec.z);

        localMatrix.multiplyMatrices(tMat, rMat).multiply(sMat);
        
        // Assign final composed matrix directly
        this.currentModel.matrix.copy(localMatrix);

        // Sanity check transformations for NaN, Infinity, or Zero Scale
        if (
          isNaN(finalPosition.x) || isNaN(finalPosition.y) || isNaN(finalPosition.z) ||
          isNaN(finalRotation.x) || isNaN(finalRotation.y) || isNaN(finalRotation.z) || isNaN(finalRotation.w) ||
          scaleVec.x === 0 || scaleVec.y === 0 || scaleVec.z === 0 ||
          isNaN(scaleVec.x) || isNaN(scaleVec.y) || isNaN(scaleVec.z)
        ) {
          console.error(`[AccessoryPlugin:${this.category}] Invalid transform detected!`, {
            position: [finalPosition.x, finalPosition.y, finalPosition.z],
            rotation: [finalRotation.x, finalRotation.y, finalRotation.z, finalRotation.w],
            scale: [scaleVec.x, scaleVec.y, scaleVec.z]
          });
        }

        // Throttled logging (once per 60 frames, approx. 1 second)
        if ((this as any).frameCount === undefined) (this as any).frameCount = 0;
        (this as any).frameCount++;
        if ((this as any).frameCount % 60 === 0) {
          const worldPos = new THREE.Vector3();
          this.currentModel.getWorldPosition(worldPos);

          let camDist = 10.0;
          if (this.headGroup.parent) {
            const cam = this.headGroup.parent.children.find(c => c instanceof THREE.PerspectiveCamera);
            if (cam) camDist = worldPos.distanceTo(cam.position);
          }

          const boundingBox = new THREE.Box3().setFromObject(this.currentModel);
          console.log(`[AccessoryPlugin:${this.category}] Accessory Updated & Visible. Diagnostics:`, {
            category: this.category,
            visible: this.currentModel.visible,
            anchorPosition: anchor.position,
            localOffsetPosition: [finalPosition.x, finalPosition.y, finalPosition.z],
            scale: [scaleVec.x, scaleVec.y, scaleVec.z],
            quaternion: [finalRotation.x, finalRotation.y, finalRotation.z, finalRotation.w],
            matrix: Array.from(localMatrix.elements),
            worldPosition: [worldPos.x, worldPos.y, worldPos.z],
            boundingBox: { min: [boundingBox.min.x, boundingBox.min.y, boundingBox.min.z], max: [boundingBox.max.x, boundingBox.max.y, boundingBox.max.z] },
            distanceFromCamera: camDist
          });
        }

        this.setOpacity(animOpacity);
      } else {
        this.currentModel.visible = false;
      }
    }
  }

  private updatePhysics(dt: number): void {
    if (!this.currentModel) return;

    const currentHeadPos = this.headGroup.position;
    const acceleration = new THREE.Vector3()
      .subVectors(currentHeadPos, this.prevHeadPos)
      .multiplyScalar(1.0 / (dt * dt + 0.0001));

    acceleration.clampLength(0, 150);
    this.prevHeadPos.copy(currentHeadPos);

    const springForce = this.displacement.clone().multiplyScalar(-this.stiffness);
    const dampingForce = this.velocity.clone().multiplyScalar(-this.damping);
    const inertiaForce = acceleration.multiplyScalar(-this.mass);

    const netAcceleration = new THREE.Vector3()
      .add(springForce)
      .add(dampingForce)
      .add(inertiaForce);

    this.velocity.addScaledVector(netAcceleration, dt);
    this.displacement.addScaledVector(this.velocity, dt);
    this.displacement.clampLength(0, this.maxSway);
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

    let targetColor = new THREE.Color();
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
            mat.color.setHex(0xffffff);
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
          const name = child.name.toLowerCase();
          const scaleFactor = (name.includes('lens') || name.includes('glass')) ? 0.25 : 1.0;
          mat.opacity = scaleFactor * opacity;
        }
      }
    });
  }
}

export default AccessoryPlugin;
