/**
 * HairOverlay.js
 * 
 * Computes 2D/3D affine transformation matrices to draw hair overlays on a Canvas.
 * Aligns the asset dynamically using forehead landmarks and face contour vectors,
 * supporting scaling, rotation, translation, and soft edge blending.
 */
export class HairOverlay {
  constructor() {
    // Default scaling multiplier to ensure the hairstyle wraps around the skull,
    // which is wider than standard cheek-to-cheek face mesh contours.
    this.scaleMultiplier = 1.35;
    
    // Vertical offset modifier to position the top of the hairstyle asset
    // slightly above the forehead index (landmark 10).
    this.offsetYMultiplier = -0.38;
  }

  /**
   * Render a hairstyle asset on the canvas context, aligned to face telemetry.
   * 
   * @param {CanvasRenderingContext2D} ctx Destination canvas 2D rendering context
   * @param {HTMLImageElement|HTMLCanvasElement} asset The loaded hair image asset
   * @param {Object} telemetry The current frame's tracking telemetry from FaceTracker
   * @param {Object} [options] Blending and styling options
   * @param {boolean} [options.softEdges=true] Enable soft edges rendering via drop shadow blending
   * @param {string} [options.shadowColor='rgba(0, 0, 0, 0.15)'] Shadow color for edge feathering
   * @param {number} [options.shadowBlur=6] Blur radius for edge feathering
   * @param {number} [options.opacity=1.0] Master opacity of the overlay (0.0 to 1.0)
   * @param {number} [options.customScale=1.0] User-defined scale override multiplier
   * @param {number} [options.customOffsetY=0] User-defined vertical pixel offset
   */
  draw(ctx, asset, telemetry, options = {}) {
    if (!ctx || !asset || !telemetry || !telemetry.faceDetected) {
      return;
    }

    const { landmarks, rotation } = telemetry;
    if (!landmarks || landmarks.length === 0) {
      return;
    }

    const {
      softEdges = true,
      shadowColor = 'rgba(0, 0, 0, 0.15)',
      shadowBlur = 6,
      opacity = 1.0,
      customScale = 1.0,
      customOffsetY = 0
    } = options;

    // 1. Extract key alignment anchors
    const foreheadCenter = landmarks[10];
    const leftCheek = landmarks[234];
    const rightCheek = landmarks[454];

    if (!foreheadCenter || !leftCheek || !rightCheek) {
      return;
    }

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    // 2. Projected coordinate center of the forehead on canvas space
    const centerX = foreheadCenter.x * canvasWidth;
    const centerY = foreheadCenter.y * canvasHeight;

    // Horizontal face width in pixel dimensions on canvas
    const faceWidthPixels = Math.hypot(
      (rightCheek.x - leftCheek.x) * canvasWidth,
      (rightCheek.y - leftCheek.y) * canvasHeight
    ) || 1.0;

    // Determine target size for the asset, preserving its native aspect ratio
    const assetAspect = asset.height / asset.width;
    const destWidth = faceWidthPixels * this.scaleMultiplier * customScale;
    const destHeight = destWidth * assetAspect;

    // 3. Apply Canvas Transformation Pipeline
    ctx.save();

    // Configure transparency
    ctx.globalAlpha = opacity;

    // Implement soft edges using subtle drop shadow filters to blend hair margins
    if (softEdges) {
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = shadowBlur;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 4;
    }

    // Move coordinate origin to forehead center anchor
    ctx.translate(centerX, centerY);

    // Apply head roll rotation (converted from degrees to radians)
    const rollRad = rotation.roll * (Math.PI / 180);
    ctx.rotate(rollRad);

    // Apply Yaw and Pitch parallax skew offsets (pseudo-3D shift)
    // As user turns left/right, skew the overlay coordinates in opposition.
    // As user tilts up/down, shift overlay vertically.
    const yawShift = -rotation.yaw * (destWidth * 0.0035);
    const pitchShift = -rotation.pitch * (destHeight * 0.0018);

    // Compute base vertical translation to align bottom of hair layout above forehead center
    const baseVerticalOffset = destHeight * this.offsetYMultiplier;
    const verticalAdjustment = baseVerticalOffset + pitchShift + customOffsetY;

    // Dynamic vertical squash/stretch factor to simulate head pitch perspective
    // Nodding down shows more top hair surface, nodding up hides it
    const pitchScaleFactor = 1.0 + (rotation.pitch * 0.0025);
    const dynamicHeight = destHeight * Math.max(0.75, Math.min(1.25, pitchScaleFactor));

    // Draw the asset image centered horizontally and offset vertically
    ctx.drawImage(
      asset,
      -destWidth / 2 + yawShift,
      verticalAdjustment,
      destWidth,
      dynamicHeight
    );

    ctx.restore();
  }
}

export const hairOverlay = new HairOverlay();
export default hairOverlay;
