import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { PNGLoader } from './PNGLoader';
import { ModelNormalizer } from '../core/rendering/ModelNormalizer';
import { MaterialFactory } from '../core/rendering/MaterialFactory';

export class AssetLoader {
  private cache = new Map<string, Promise<any>>();
  private gltfLoader = new GLTFLoader();
  private objLoader = new OBJLoader();
  private fbxLoader = new FBXLoader();
  private envMap: THREE.Texture | null = null;

  constructor() {}

  /**
   * Sets the environmental mapping texture for materials.
   */
  public setEnvMap(envMap: THREE.Texture | null): void {
    this.envMap = envMap;
  }

  /**
   * Load and cache any asset by URL.
   */
  public async load(url: string): Promise<any> {
    if (!url) {
      throw new Error('[AssetLoader] Asset URL must be specified.');
    }

    if (this.cache.has(url)) {
      return this.cache.get(url);
    }

    const cleanUrl = url.split('?')[0];
    const extension = cleanUrl.substring(cleanUrl.lastIndexOf('.') + 1).toLowerCase();

    let loaderPromise: Promise<any>;

    if (['png', 'jpg', 'jpeg', 'webp'].includes(extension)) {
      loaderPromise = PNGLoader.load(url);
    } else if (extension === 'svg') {
      loaderPromise = this.loadSVG(url);
    } else if (['glb', 'gltf'].includes(extension)) {
      loaderPromise = this.loadGLTF(url);
    } else if (extension === 'obj') {
      loaderPromise = this.loadOBJ(url);
    } else if (extension === 'fbx') {
      loaderPromise = this.loadFBX(url);
    } else {
      console.warn(`[AssetLoader] Unknown extension ".${extension}". Defaulting to PNGLoader.`);
      loaderPromise = PNGLoader.load(url);
    }

    this.cache.set(url, loaderPromise);

    try {
      return await loaderPromise;
    } catch (error) {
      this.cache.delete(url);
      throw error;
    }
  }

  /**
   * Loads a 3D model, normalizes it, and applies category-specific PBR materials.
   */
  public async loadModel(url: string, category: string): Promise<THREE.Group> {
    const rawModel = await this.load(url);
    if (!rawModel) {
      throw new Error(`[AssetLoader] Failed to load model from ${url}`);
    }

    if (rawModel instanceof HTMLImageElement) {
      // Create a 2D billboard plane mesh wrapped in a THREE.Group
      const texture = new THREE.Texture(rawModel);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;

      const material = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        roughness: 0.8,
        metalness: 0.1,
        side: THREE.DoubleSide,
        depthWrite: true,
        depthTest: true
      });

      const aspect = rawModel.width / rawModel.height;
      const geometry = new THREE.PlaneGeometry(1.0, 1.0 / aspect);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = category + '_billboard_mesh';
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.renderOrder = 1;

      const group = new THREE.Group();
      group.add(mesh);

      // Center pivot and normalize the billboard plane
      ModelNormalizer.normalize(group, category);

      return group;
    }

    // 1. Clone model so cache remains unmutated
    const cloned = rawModel.clone();

    // 2. Normalize bounding boxes, scales, pivots, and rotations
    ModelNormalizer.normalize(cloned, category);

    // 3. Apply standard, factory-curated materials to meshes
    this.applyMaterials(cloned, category);

    return cloned;
  }

  /**
   * Assigns category-specific factory PBR materials.
   */
  private applyMaterials(model: THREE.Group, category: string): void {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.renderOrder = 1; // Render after occluder mesh
        child.frustumCulled = false; // Prevent clipping under manual matrix transforms

        const originalMat = child.material as THREE.MeshStandardMaterial;
        const colorHex = originalMat?.color ? originalMat.color.getHex() : 0xffffff;

        if (category === 'glasses') {
          const name = child.name.toLowerCase();
          if (name.includes('lens') || name.includes('glass')) {
            child.material = MaterialFactory.createGlassMaterial(this.envMap);
          } else if (name.includes('frame') || name.includes('metal')) {
            child.material = MaterialFactory.createMetalMaterial(this.envMap, colorHex);
          } else {
            child.material = MaterialFactory.createPlasticMaterial(this.envMap, colorHex);
          }
        } else if (category === 'hair' || category === 'beard') {
          child.material = MaterialFactory.createHairMaterial(this.envMap, colorHex);
        } else if (category === 'caps') {
          child.material = MaterialFactory.createFabricMaterial(this.envMap, colorHex);
        } else {
          // Fallback default plastic
          child.material = MaterialFactory.createPlasticMaterial(this.envMap, colorHex);
        }
      }
    });
  }

  private loadSVG(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(new Error(`[AssetLoader] Failed SVG load: ${url}. Details: ${err}`));
      img.src = url;
    });
  }

  private loadGLTF(url: string): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => resolve(gltf.scene),
        undefined,
        (err) => reject(new Error(`[AssetLoader] Failed GLTF load: ${url}. Details: ${err}`))
      );
    });
  }

  private loadOBJ(url: string): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      this.objLoader.load(
        url,
        (obj) => resolve(obj),
        undefined,
        (err) => reject(new Error(`[AssetLoader] Failed OBJ load: ${url}. Details: ${err}`))
      );
    });
  }

  private loadFBX(url: string): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      this.fbxLoader.load(
        url,
        (fbx) => resolve(fbx),
        undefined,
        (err) => reject(new Error(`[AssetLoader] Failed FBX load: ${url}. Details: ${err}`))
      );
    });
  }

  public disposeObject(object: THREE.Object3D): void {
    if (!object) return;

    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) {
          child.geometry.dispose();
        }

        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
  }

  public async clearCache(): Promise<void> {
    for (const promise of this.cache.values()) {
      try {
        const asset = await promise;
        if (asset instanceof THREE.Object3D) {
          this.disposeObject(asset);
        }
      } catch (e) {
        // Ignore load fails
      }
    }
    this.cache.clear();
    MaterialFactory.clearCache();
    console.log('[AssetLoader] Cache and MaterialFactory cleared.');
  }
}

export const assetLoader = new AssetLoader();
export default assetLoader;
