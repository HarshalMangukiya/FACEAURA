/**
 * GlassesOverlay.js
 * 
 * Computes 2D/3D affine transformation matrices to draw eyewear overlays on a Canvas.
 * Aligns the asset dynamically using computed left and right eye centers, supporting
 * head roll, yaw/pitch parallax shifts, and soft edge blending.
 */
export class GlassesOverlay {
  constructor() {
    // Default scale multiplier to scale the glasses relative to the distance between eye centers
    this.scaleMultiplier = 2.25;
  }

  /**
   * Render a glasses asset on the canvas context, aligned to face telemetry.
   * 
   * @param {CanvasRenderingContext2D} ctx Destination canvas 2D rendering context
   * @param {HTMLImageElement|HTMLCanvasElement} asset The loaded glasses image asset
   * @param {Object} telemetry The current frame's tracking telemetry from FaceTracker
   * @param {Object} [options] Blending and styling options
   * @param {number} [options.opacity=1.0] Master opacity of the overlay (0.0 to 1.0)
   * @param {number} [options.scale=1.0] User-defined scale override multiplier
   * @param {number} [options.offsetY=0] User-defined vertical pixel offset
   * @param {boolean} [options.softEdges=true] Enable soft edges rendering via drop shadow blending
   * @param {string} [options.shadowColor='rgba(0, 0, 0, 0.15)'] Shadow color for edge feathering
   * @param {number} [options.shadowBlur=5] Blur radius for edge feathering
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
      shadowColor = 'rgba(0, 0, 0, 0.15)',
      shadowBlur = 5
    } = options;

    // 1. Compute precise eye centers by averaging outer and inner corner landmarks
    // Left eye corner indexes: 33 (outer), 133 (inner)
    const leftEyeCenter = {
      x: (landmarks[33].x + landmarks[133].x) / 2,
      y: (landmarks[33].y + landmarks[133].y) / 2
    };

    // Right eye corner indexes: 263 (outer), 362 (inner)
    const rightEyeCenter = {
      x: (landmarks[263].x + landmarks[362].x) / 2,
      y: (landmarks[263].y + landmarks[362].y) / 2
    };

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    // Midpoint between left and right eye centers (nose bridge alignment point)
    const centerX = ((leftEyeCenter.x + rightEyeCenter.x) / 2) * canvasWidth;
    const centerY = ((leftEyeCenter.y + rightEyeCenter.y) / 2) * canvasHeight;

    // Distance between left and right eye centers
    const eyeDistancePixels = Math.hypot(
      (rightEyeCenter.x - leftEyeCenter.x) * canvasWidth,
      (rightEyeCenter.y - leftEyeCenter.y) * canvasHeight
    ) || 1.0;

    const aspect = asset.height / asset.width;
    const destWidth = eyeDistancePixels * this.scaleMultiplier * scale;
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

    // Move coordinate origin to computed midpoint
    ctx.translate(centerX, centerY);
    
    // Rotate to match roll
    const rollRad = rotation.roll * (Math.PI / 180);
    ctx.rotate(rollRad);

    // Apply Yaw and Pitch parallax translation offsets
    const yawShift = -rotation.yaw * (destWidth * 0.0014);
    const pitchShift = -rotation.pitch * (destHeight * 0.001);

    // Center glasses vertically relative to center line
    const verticalAdjustment = -destHeight / 2 + (offsetY || 0) + pitchShift;

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

const glassesOverlay = new GlassesOverlay();
export default glassesOverlay;
