import { PNGLoader } from './PNGLoader';

/**
 * AssetLoader Class
 * 
 * General-purpose asset loader that manages cache maps and delegates
 * loading jobs based on file extensions. Supports PNG, SVG, and structures
 * future GLB 3D model loaders.
 */
class AssetLoader {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Load and cache any assets by URL.
   * Handles PNG, SVG, and GLB loading tasks.
   * 
   * @param {string} url Asset source URL
   * @returns {Promise<any>} The resolved asset object
   */
  async load(url) {
    if (!url) {
      throw new Error('[AssetLoader] Asset URL must be specified.');
    }

    // Check if asset is already cached (either in-flight promise or resolved asset)
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }

    // Parse extension from URL, removing query parameters
    const cleanUrl = url.split('?')[0];
    const extension = cleanUrl.substring(cleanUrl.lastIndexOf('.') + 1).toLowerCase();
    
    let loaderPromise;

    if (extension === 'png' || extension === 'jpg' || extension === 'jpeg') {
      loaderPromise = PNGLoader.load(url);
    } else if (extension === 'svg') {
      loaderPromise = this.loadSVG(url);
    } else if (extension === 'glb' || extension === 'gltf') {
      loaderPromise = this.loadGLB(url);
    } else {
      // Default fallback to PNG loader for unknown extensions (useful for image endpoints)
      console.warn(`[AssetLoader] Unknown extension ".${extension}". Defaulting to PNGLoader.`);
      loaderPromise = PNGLoader.load(url);
    }

    // Store the loading promise in cache map to prevent multiple downloads of same url
    this.cache.set(url, loaderPromise);

    try {
      const asset = await loaderPromise;
      return asset;
    } catch (error) {
      // Remove failed promise from cache so future attempts can retry
      this.cache.delete(url);
      throw error;
    }
  }

  /**
   * Load SVG files as standard image objects.
   * 
   * @param {string} url SVG asset URL
   * @returns {Promise<HTMLImageElement>} Resolved with image element containing SVG source
   */
  loadSVG(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        resolve(img);
      };
      
      img.onerror = (err) => {
        reject(new Error(`[AssetLoader] Failed to load SVG image at: ${url}. Details: ${err.message}`));
      };
      
      img.src = url;
    });
  }

  /**
   * GLB loader placeholder as requested for future 3D glTF formats support.
   * 
   * @param {string} url GLB asset URL
   * @returns {Promise<Object>} Resolved placeholder metadata object
   */
  async loadGLB(url) {
    console.warn(`[AssetLoader] GLB/GLTF model loaders are structured for future development. URL: ${url}`);
    
    // Return a structured placeholder conforming to Three.js mesh loading schemas
    return {
      type: 'glb',
      url,
      isPlaceholder: true,
      data: null
    };
  }

  /**
   * Clear all cached assets.
   */
  clearCache() {
    this.cache.clear();
    console.log('[AssetLoader] Cache map cleared.');
  }
}

export const assetLoader = new AssetLoader();
export default assetLoader;
