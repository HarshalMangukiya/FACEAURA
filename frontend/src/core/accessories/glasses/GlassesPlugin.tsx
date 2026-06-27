/**
 * GlassesPlugin.tsx
 *
 * Handles loading, caching, and rendering 3D Eyewear models (GLTF/GLB).
 * Automatically configures PBR materials (refraction, reflection, transparency) for lenses.
 * Aligns frame positioning to the nose bridge and ear templates.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class GlassesPlugin {
  private loader: GLTFLoader;
  private currentModel: THREE.Group | null = null;
  private modelCache = new Map<string, THREE.Group>();
  private headGroup: THREE.Group;
  private envMap: THREE.Texture | null = null;

  // Options
  private scale: number = 1.0;
  private offsetY: number = 0.05;
  private offsetZ: number = 0.15;

  constructor(headGroup: THREE.Group, envMap: THREE.Texture | null) {
    this.headGroup = headGroup;
    this.envMap = envMap;
    this.loader = new GLTFLoader();
  }

  /**
   * Loads eyewear model and attaches it to the head group.
   *
   * @param modelUrl URL of eyewear GLTF/GLB asset
   */
  public async loadGlasses(modelUrl: string): Promise<THREE.Group | null> {
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
          
          // Configure glass lenses with refraction, PBR reflections
          this.applyLensMaterials(model);
          
          // Cache model
          this.modelCache.set(modelUrl, model);
          
          const cloned = model.clone();
          this.attachToHead(cloned);
          resolve(cloned);
        },
        undefined,
        (err) => {
          console.error('[GlassesPlugin] Failed to load 3D glasses model:', err);
          resolve(null);
        }
      );
    });
  }

  /**
   * Applies custom PBR materials to meshes designated as lenses.
   */
  private applyLensMaterials(model: THREE.Group) {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        // Detect glass lenses by name or material properties
        const name = child.name.toLowerCase();
        if (name.includes('lens') || name.includes('glass')) {
          child.material = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.25,
            metalness: 0.1,
            roughness: 0.05,
            transmission: 0.9, // Refraction transparency
            thickness: 0.5, // Refraction thickness
            ior: 1.52, // Refractive index of standard glass
            envMap: this.envMap,
            envMapIntensity: 1.5,
            clearcoat: 1.0,
            clearcoatRoughness: 0.05
          });
        } else {
          // Standard plastic/metal frames PBR
          const mat = child.material as THREE.MeshStandardMaterial;
          if (mat) {
            mat.envMap = this.envMap;
            mat.envMapIntensity = 1.0;
            mat.roughness = Math.max(mat.roughness, 0.15);
          }
        }
      }
    });
  }

  /**
   * Attaches the loaded glasses model to the head group and centers it.
   */
  private attachToHead(model: THREE.Group) {
    this.currentModel = model;

    // Standard scaling: fit glasses to typical head width
    // Model coordinates center usually corresponds to nose bridge
    model.position.set(0, this.offsetY * 10, this.offsetZ * 10);
    model.scale.setScalar(this.scale * 10.5);

    this.headGroup.add(model);
  }

  /**
   * Updates glasses positioning based on landmarks coordinates dynamically (if needed for fine adjustments)
   */
  public updatePose(landmarks: any[]) {
    if (!this.currentModel || !landmarks || landmarks.length < 356) return;

    // Nose bridge landmark: 6, Left temple: 127, Right temple: 356
    const leftTemple = landmarks[127];
    const rightTemple = landmarks[356];
    
    // Adjust scale based on temple width distance
    const templeDist = Math.hypot(rightTemple.x - leftTemple.x, rightTemple.y - leftTemple.y, rightTemple.z - leftTemple.z);
    
    // Scale factor: typical temple-to-temple width is 0.18 units in face coordinate systems
    const localScale = (templeDist / 0.18) * this.scale * 10.5;
    this.currentModel.scale.setScalar(localScale);
  }

  /**
   * Adjusts offsets dynamically via sliders
   */
  public setOffsets(scale: number, offsetY: number, offsetZ: number) {
    this.scale = scale;
    this.offsetY = offsetY;
    this.offsetZ = offsetZ;

    if (this.currentModel) {
      this.currentModel.position.set(0, offsetY * 10, offsetZ * 10);
      this.currentModel.scale.setScalar(scale * 10.5);
    }
  }

  /**
   * Clear current eyewear overlay.
   */
  public clear() {
    if (this.currentModel) {
      this.headGroup.remove(this.currentModel);
      this.currentModel = null;
    }
  }
}
export default GlassesPlugin;
