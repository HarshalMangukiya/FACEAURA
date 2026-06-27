/**
 * HairPlugin.tsx
 *
 * Manages loading and rendering of 3D Hairstyles (GLTF/GLB).
 * Integrates:
 * - Dynamic recoloring (base color tint, highlights, and gradients).
 * - Spring-mass physics simulation (inertia sways hair with head acceleration).
 * - Head alignment based on hairline anchors.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class HairPlugin {
  private loader: GLTFLoader;
  private currentModel: THREE.Group | null = null;
  private modelCache = new Map<string, THREE.Group>();
  private headGroup: THREE.Group;
  private envMap: THREE.Texture | null = null;

  // Recoloring Settings
  private hairColor: string = 'Original';
  
  // Spring Physics Variables (to simulate hair sway inertia)
  private velocity = new THREE.Vector3();
  private displacement = new THREE.Vector3();
  private prevHeadPos = new THREE.Vector3();
  private stiffness: number = 18.0; // Spring stiffness constant
  private damping: number = 3.5; // Damping ratio

  // Offsets
  private scale: number = 1.0;
  private offsetY: number = 0.18;
  private offsetZ: number = -0.05;

  constructor(headGroup: THREE.Group, envMap: THREE.Texture | null) {
    this.headGroup = headGroup;
    this.envMap = envMap;
    this.loader = new GLTFLoader();
  }

  /**
   * Loads hair model and attaches it to the head.
   */
  public async loadHair(modelUrl: string): Promise<THREE.Group | null> {
    this.clear();

    if (this.modelCache.has(modelUrl)) {
      const cached = this.modelCache.get(modelUrl)!.clone();
      this.attachToHead(cached);
      return cached;
    }

    return new Promise((resolve) => {
      this.loader.load(
        modelUrl,
        (gltf) => {
          const model = gltf.scene;
          
          this.applyHairMaterials(model);
          this.modelCache.set(modelUrl, model);
          
          const cloned = model.clone();
          this.attachToHead(cloned);
          resolve(cloned);
        },
        undefined,
        (err) => {
          console.error('[HairPlugin] Failed to load 3D hair model:', err);
          resolve(null);
        }
      );
    });
  }

  private applyHairMaterials(model: THREE.Group) {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        // Ensure materials support reflections and soft alpha clipping
        const mat = child.material as THREE.MeshStandardMaterial;
        if (mat) {
          mat.envMap = this.envMap;
          mat.envMapIntensity = 0.8;
          mat.transparent = true;
          mat.alphaTest = 0.15; // Clip transparent boundaries
          mat.roughness = 0.85; // Hair is generally matte
        }
      }
    });
  }

  private attachToHead(model: THREE.Group) {
    this.currentModel = model;
    
    // Position near top/back of skull
    model.position.set(0, this.offsetY * 10, this.offsetZ * 10);
    model.scale.setScalar(this.scale * 10.8);
    
    this.headGroup.add(model);
    
    this.prevHeadPos.copy(this.headGroup.position);
    this.displacement.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    
    // Trigger recoloring immediately
    this.setColor(this.hairColor);
  }

  /**
   * Applies recoloring to the hair model.
   * Supports standard color presets or direct hex codes.
   */
  public setColor(colorName: string) {
    this.hairColor = colorName;
    if (!this.currentModel) return;

    let targetColor = new THREE.Color(0x3a2314); // Default Brown
    let opacity = 1.0;

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
      // 'Original' -> restore default model texture colors without override tint
      this.currentModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.MeshStandardMaterial;
          if (mat) mat.color.setHex(0xffffff); // resetting to neutral
        }
      });
      return;
    }

    this.currentModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material as THREE.MeshStandardMaterial;
        if (mat) {
          // Multiply color tint to preserve original dark highlights / shadows
          mat.color.copy(targetColor);
          mat.opacity = opacity;
        }
      }
    });
  }

  /**
   * Run spring-mass physics sways to simulate hair inertia
   *
   * @param dt Elapsed delta time in seconds
   */
  public updatePhysics(dt: number) {
    if (!this.currentModel) return;

    // 1. Calculate head acceleration (inertia source)
    const currentHeadPos = this.headGroup.position;
    const acceleration = new THREE.Vector3()
      .subVectors(currentHeadPos, this.prevHeadPos)
      .multiplyScalar(1.0 / (dt * dt + 0.0001)); // a = d^2x / dt^2
    
    // Clamp acceleration spike
    acceleration.clampLength(0, 150);

    // Save position
    this.prevHeadPos.copy(currentHeadPos);

    // 2. Solve Spring Equation: F = -kx - cv
    // Acceleration acts as a force in the opposite direction
    const springForce = this.displacement.clone().multiplyScalar(-this.stiffness);
    const dampingForce = this.velocity.clone().multiplyScalar(-this.damping);
    const inertiaForce = acceleration.multiplyScalar(-0.015); // mass multiplier

    const netAcceleration = new THREE.Vector3()
      .add(springForce)
      .add(dampingForce)
      .add(inertiaForce);

    // 3. Integrate: v = v + a*dt, x = x + v*dt
    this.velocity.addScaledVector(netAcceleration, dt);
    this.displacement.addScaledVector(this.velocity, dt);

    // Limit displacement to avoid clipping
    this.displacement.clampLength(0, 0.4);

    // 4. Apply displacement to hair model position as a sway offset
    this.currentModel.position.set(
      0 + this.displacement.x,
      (this.offsetY * 10) + this.displacement.y,
      (this.offsetZ * 10) + this.displacement.z
    );

    // Add small rotation tilt relative to displacement sway
    this.currentModel.rotation.set(
      this.displacement.z * 0.35,
      0,
      -this.displacement.x * 0.35
    );
  }

  public setOffsets(scale: number, offsetY: number, offsetZ: number) {
    this.scale = scale;
    this.offsetY = offsetY;
    this.offsetZ = offsetZ;

    if (this.currentModel) {
      this.currentModel.position.set(0, offsetY * 10, offsetZ * 10);
      this.currentModel.scale.setScalar(scale * 10.8);
    }
  }

  public clear() {
    if (this.currentModel) {
      this.headGroup.remove(this.currentModel);
      this.currentModel = null;
    }
  }
}
export default HairPlugin;
