/**
 * PNGLoader.js
 * 
 * Simple promise-wrapped loader for PNG and JPG raster assets.
 * Sets appropriate crossOrigin configuration to avoid canvas taint issues.
 */
export const PNGLoader = {
  /**
   * Load an image from a URL.
   * 
   * @param {string} url The path or remote URL to the image asset
   * @returns {Promise<HTMLImageElement>} Resolved with the loaded image element
   */
  load(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      // Prevent canvas taining if drawing images from remote domains (e.g. Django media servers)
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        resolve(img);
      };
      
      img.onerror = (err) => {
        reject(new Error(`[PNGLoader] Failed to load image at: ${url}. Details: ${err.message || 'Network error'}`));
      };
      
      img.src = url;
    });
  }
};

export default PNGLoader;
