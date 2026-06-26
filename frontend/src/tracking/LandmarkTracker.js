/**
 * LandmarkTracker.js
 * 
 * Maps raw 468 MediaPipe landmarks to specific facial regions (Eyes, Eyebrows, Nose, Lips, Jaw, Forehead, Hairline)
 * and applies an Exponential Moving Average (EMA) filter to smooth coordinates and avoid shaking.
 */

// Define explicit indices for each facial feature region from the 468 Face Mesh mapping
export const FEATURE_INDICES = {
  leftEye: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
  rightEye: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
  leftEyebrow: [70, 63, 105, 66, 107, 55, 65, 52, 53, 46],
  rightEyebrow: [300, 293, 334, 296, 336, 285, 295, 282, 283, 276],
  outerLips: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 95],
  innerLips: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191],
  nose: [168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 98, 97, 326, 327],
  jaw: [58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323],
  forehead: [10, 67, 109, 103, 54, 21, 68, 9, 298, 251, 284, 332, 338, 297, 337],
  hairline: [10, 151, 9, 8, 109, 338, 251, 67, 21, 54, 103]
};

export class LandmarkTracker {
  /**
   * @param {number} [alpha=0.45] Smoothing factor (0 < alpha <= 1). Lower = smoother but more lag; Higher = responsive but jittery.
   */
  constructor(alpha = 0.45) {
    this.alpha = alpha;
    this.smoothed = null;
  }

  /**
   * Update the internal cache of landmarks using Exponential Moving Average (EMA).
   * 
   * @param {Array<{x:number, y:number, z:number}>} rawLandmarks 468 raw landmarks from MediaPipe
   * @returns {Array<{x:number, y:number, z:number}>} Smoothed landmarks list
   */
  update(rawLandmarks) {
    if (!rawLandmarks || rawLandmarks.length === 0) {
      return null;
    }

    // Initialize smoothed landmarks if first frame
    if (!this.smoothed || this.smoothed.length !== rawLandmarks.length) {
      this.smoothed = rawLandmarks.map(p => ({ x: p.x, y: p.y, z: p.z }));
      return this.smoothed;
    }

    const alpha = this.alpha;
    const oneMinusAlpha = 1 - alpha;

    // Apply EMA update in-place to minimize GC pauses
    for (let i = 0; i < rawLandmarks.length; i++) {
      const raw = rawLandmarks[i];
      const smooth = this.smoothed[i];

      smooth.x = alpha * raw.x + oneMinusAlpha * smooth.x;
      smooth.y = alpha * raw.y + oneMinusAlpha * smooth.y;
      smooth.z = alpha * raw.z + oneMinusAlpha * smooth.z;
    }

    return this.smoothed;
  }

  /**
   * Reset the smoothed landmarks cache.
   */
  reset() {
    this.smoothed = null;
  }

  /**
   * Get the current complete list of 468 smoothed landmarks.
   */
  getLandmarks() {
    return this.smoothed;
  }

  /**
   * Extracts landmarks belonging to a specific index list.
   * 
   * @param {Array<number>} indices List of indexes to extract
   * @returns {Array<{x:number, y:number, z:number}>} Extracted landmark coordinates
   */
  extractRegion(indices) {
    if (!this.smoothed) return [];
    return indices.map(idx => this.smoothed[idx]).filter(Boolean);
  }

  /**
   * Expose specific helper getters for tracked regions.
   */
  getEyes() {
    return {
      left: this.extractRegion(FEATURE_INDICES.leftEye),
      right: this.extractRegion(FEATURE_INDICES.rightEye)
    };
  }

  getEyebrows() {
    return {
      left: this.extractRegion(FEATURE_INDICES.leftEyebrow),
      right: this.extractRegion(FEATURE_INDICES.rightEyebrow)
    };
  }

  getLips() {
    return {
      outer: this.extractRegion(FEATURE_INDICES.outerLips),
      inner: this.extractRegion(FEATURE_INDICES.innerLips)
    };
  }

  getNose() {
    return this.extractRegion(FEATURE_INDICES.nose);
  }

  getJaw() {
    return this.extractRegion(FEATURE_INDICES.jaw);
  }

  getForehead() {
    return this.extractRegion(FEATURE_INDICES.forehead);
  }

  getHairline() {
    return this.extractRegion(FEATURE_INDICES.hairline);
  }

  /**
   * Compile all smoothed facial features into a structured dictionary.
   */
  getAllFeatures() {
    if (!this.smoothed) return null;

    return {
      eyes: this.getEyes(),
      eyebrows: this.getEyebrows(),
      lips: this.getLips(),
      nose: this.getNose(),
      jaw: this.getJaw(),
      forehead: this.getForehead(),
      hairline: this.getHairline()
    };
  }
}

export default LandmarkTracker;
