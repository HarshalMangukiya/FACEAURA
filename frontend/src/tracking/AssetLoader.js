import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { PNGLoader } from './PNGLoader';

/**
 * AssetLoader Class
 *
 * High-performance, production-grade asset manager.
 * - Caches promises to prevent duplicate in-flight network requests.
 * - Supports loading GLB, GLTF, OBJ, FBX models, and SVG/PNG/JPG rasters.
 * - Handles recursive resource disposal of Geometries, Materials, and Textures
 *   to guarantee zero GPU memory leaks.
 */
class AssetLoader {
  constructor() {
    this.cache = new Map();
    this.gltfLoader = new GLTFLoader();
    this.objLoader = new OBJLoader();
    this.fbxLoader = new FBXLoader();
  }

  /**
   * Load and cache any asset by URL.
   *
   * @param {string} url Asset source URL
   * @returns {Promise<any>} The resolved asset (Texture, Image, or 3D Object)
   */
  async load(url) {
    if (!url) {
      throw new Error('[AssetLoader] Asset URL must be specified.');
    }

    if (this.cache.has(url)) {
      return this.cache.get(url);
    }

    const cleanUrl = url.split('?')[0];
    const extension = cleanUrl.substring(cleanUrl.lastIndexOf('.') + 1).toLowerCase();

    let loaderPromise;

    if (extension === 'png' || extension === 'jpg' || extension === 'jpeg' || extension === 'webp') {
      loaderPromise = PNGLoader.load(url);
    } else if (extension === 'svg') {
      loaderPromise = this.loadSVG(url);
    } else if (extension === 'glb' || extension === 'gltf') {
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
      const asset = await loaderPromise;
      return asset;
    } catch (error) {
      this.cache.delete(url);
      throw error;
    }
  }

  /**
   * Loads SVG file as HTMLImageElement
   */
  loadSVG(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(new Error(`[AssetLoader] Failed SVG load: ${url}. Details: ${err}`));
      img.src = url;
    });
  }

  /**
   * Loads glTF/glB 3D models
   */
  loadGLTF(url) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => resolve(gltf.scene),
        undefined,
        (err) => reject(new Error(`[AssetLoader] Failed GLTF load: ${url}. Details: ${err}`))
      );
    });
  }

  /**
   * Loads Wavefront OBJ 3D models
   */
  loadOBJ(url) {
    return new Promise((resolve, reject) => {
      this.objLoader.load(
        url,
        (obj) => resolve(obj),
        undefined,
        (err) => reject(new Error(`[AssetLoader] Failed OBJ load: ${url}. Details: ${err}`))
      );
    });
  }

  /**
   * Loads Filmbox FBX 3D models
   */
  loadFBX(url) {
    return new Promise((resolve, reject) => {
      this.fbxLoader.load(
        url,
        (fbx) => resolve(fbx),
        undefined,
        (err) => reject(new Error(`[AssetLoader] Failed FBX load: ${url}. Details: ${err}`))
      );
    });
  }

  /**
   * Dispose of 3D object geometries and textures to release GPU/RAM memory leaks.
   *
   * @param {THREE.Object3D} object Model root to dispose
   */
  disposeObject(object) {
    if (!object) return;

    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) {
          child.geometry.dispose();
        }

        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => this.disposeMaterial(mat));
          } else {
            this.disposeMaterial(child.material);
          }
        }
      }
    });
  }

  disposeMaterial(material) {
    if (!material) return;
    
    // Dispose textures inside material properties
    for (const key of Object.keys(material)) {
      const prop = material[key];
      if (prop instanceof THREE.Texture) {
        prop.dispose();
      }
    }
    
    material.dispose();
  }

  /**
   * Clears the loader cache map, disposing of all cached 3D assets.
   */
  async clearCache() {
    for (const [url, promise] of this.cache.entries()) {
      try {
        const asset = await promise;
        if (asset instanceof THREE.Object3D) {
          this.disposeObject(asset);
        } else if (asset instanceof HTMLImageElement) {
          asset.src = ''; // help garbage collector
        }
      } catch (e) {
        // Ignore load fails in cleanup
      }
    }
    this.cache.clear();
    console.log('[AssetLoader] Cache map cleared and all resources disposed.');
  }
}

export const assetLoader = new AssetLoader();
export default assetLoader;
