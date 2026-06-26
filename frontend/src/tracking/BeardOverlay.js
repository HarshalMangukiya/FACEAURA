/**
 * BeardOverlay.js
 * 
 * Computes 2D/3D affine transformation matrices to draw beard overlays on a Canvas.
 * Aligns the asset dynamically using jawline landmarks, supporting head roll,
 * yaw perspective shifting, and soft edge blending.
 */
export class BeardOverlay {
  constructor() {
    // Default scaling multiplier to ensure the beard wraps around the jawline contour
    this.scaleMultiplier = 1.35;
    
    // Vertical offset modifier to position the top of the beard asset sit naturally
    this.offsetYMultiplier = -0.68;
  }

  /**
   * Render a beard asset on the canvas context, aligned to face telemetry.
   * 
   * @param {CanvasRenderingContext2D} ctx Destination canvas 2D rendering context
   * @param {HTMLImageElement|HTMLCanvasElement} asset The loaded beard image asset
   * @param {Object} telemetry The current frame's tracking telemetry from FaceTracker
   * @param {Object} [options] Blending and styling options
   * @param {number} [options.opacity=1.0] Master opacity of the overlay (0.0 to 1.0)
   * @param {number} [options.scale=1.0] User-defined scale override multiplier
   * @param {number} [options.offsetY=0] User-defined vertical pixel offset
   * @param {boolean} [options.softEdges=true] Enable soft edges rendering via drop shadow blending
   * @param {string} [options.shadowColor='rgba(0, 0, 0, 0.12)'] Shadow color for edge feathering
   * @param {number} [options.shadowBlur=4] Blur radius for edge feathering
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
      opacity = 1.0,
      scale = 1.0,
      offsetY = 0,
      softEdges = true,
      shadowColor = 'rgba(0, 0, 0, 0.12)',
      shadowBlur = 4
    } = options;

    // 1. Extract key alignment anchors
    const chin = landmarks[152];
    const leftJaw = landmarks[58];
    const rightJaw = landmarks[288];

    if (!chin || !leftJaw || !rightJaw) {
      return;
    }

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    // Center anchor on the bottom chin boundary
    const centerX = chin.x * canvasWidth;
    const centerY = chin.y * canvasHeight;

    // Jaw width in pixel units
    const jawWidthPixels = Math.hypot(
      (rightJaw.x - leftJaw.x) * canvasWidth,
      (rightJaw.y - leftJaw.y) * canvasHeight
    ) || 1.0;

    const aspect = asset.height / asset.width;
    const destWidth = jawWidthPixels * this.scaleMultiplier * scale;
    const destHeight = destWidth * aspect;

    // 2. Apply Canvas Transformation Pipeline
    ctx.save();
    ctx.globalAlpha = opacity;

    if (softEdges) {
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = shadowBlur;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
    }

    // Move to chin center coordinate origin
    ctx.translate(centerX, centerY);
    
    // Rotate to match face roll
    const rollRad = rotation.roll * (Math.PI / 180);
    ctx.rotate(rollRad);

    // Apply Yaw parallax offset shift (pseudo-3D shift)
    const yawShift = -rotation.yaw * (destWidth * 0.0028);

    // Adjust vertical alignment so the beard sits over jawline
    const verticalAdjustment = destHeight * this.offsetYMultiplier + (offsetY || 0);

    ctx.drawImage(
      asset,
      -destWidth / 2 + yawShift,
      verticalAdjustment,
      destWidth,
      destHeight
    );

    ctx.restore();
  }
}

const beardOverlay = new BeardOverlay();
export default beardOverlay;
