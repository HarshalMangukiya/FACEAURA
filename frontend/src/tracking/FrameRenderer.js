import hairOverlay from './HairOverlay';
import beardOverlay from './BeardOverlay';
import glassesOverlay from './GlassesOverlay';

// Reusable offscreen canvas for performance, avoiding frame allocations to prevent GC stuttering
let offscreenCanvas = null;
let offscreenCtx = null;

// WeakMap cache: originalHairAsset -> Map(colorName -> tintedCanvas)
const tintedHairCache = new WeakMap();

/**
 * FrameRenderer Class
 * 
 * Stateless drawing coordinator that implements the sequential client-side compositing pipeline.
 * Layers order: Video Background -> Tinted Hair -> Beard -> Glasses.
 */
export const FrameRenderer = {
  /**
   * Main render call containing the compositing pipeline steps.
   * 
   * @param {CanvasRenderingContext2D} ctx Destination canvas 2D context
   * @param {HTMLVideoElement} video Webcam video source
   * @param {Object} telemetry Telemetry data containing landmarks, rotation, scale, translation
   * @param {Object} assets Preloaded Image elements for { hair, beard, glasses }
   * @param {Object} [options] Rendering style options
   * @param {string} [options.hairColor='Original'] Selected hair color name or hex/rgba tint
   * @param {Object} [options.hairOptions] Individual overrides for Hair (opacity, scale, offsetY)
   * @param {Object} [options.beardOptions] Individual overrides for Beard (opacity, scale, offsetY)
   * @param {Object} [options.glassesOptions] Individual overrides for Glasses (opacity, scale, offsetY)
   * @param {boolean} [options.isMirrored=true] Whether to mirror the video frame background
   * @param {boolean} [options.showMesh=false] Whether to render the facial landmarks tracking mesh
   */
  render(ctx, video, telemetry, assets, options = {}) {
    if (!ctx || !video) return;

    const canvas = ctx.canvas;
    const {
      hairColor = 'Original',
      hairOptions = {},
      beardOptions = {},
      glassesOptions = {},
      isMirrored = true,
      showMesh = false
    } = options;

    // 1. CLEAR FRAME
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. STAGE 1: VIDEO BACKGROUND
    ctx.save();
    // Support mirror transformations for front webcam preview
    if (isMirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // If face details aren't tracked, skip overlays drawing
    if (!telemetry || !telemetry.faceDetected || !telemetry.landmarks || telemetry.landmarks.length === 0) {
      return;
    }

    // 3. STAGE 2: HAIR OVERLAY (with optional HSV-style tinting)
    if (assets.hair) {
      let finalHairAsset = assets.hair;

      if (hairColor && hairColor !== 'Original' && hairColor.toLowerCase() !== 'original') {
        finalHairAsset = this.getTintedHairAsset(assets.hair, hairColor);
      }

      hairOverlay.draw(ctx, finalHairAsset, telemetry, hairOptions);
    }

    // 4. STAGE 3: BEARD OVERLAY
    if (assets.beard) {
      beardOverlay.draw(ctx, assets.beard, telemetry, beardOptions);
    }

    // 5. STAGE 4: GLASSES OVERLAY
    if (assets.glasses) {
      glassesOverlay.draw(ctx, assets.glasses, telemetry, glassesOptions);
    }

    // 6. STAGE 5: DEBUG MESH OVERLAY
    if (showMesh && telemetry.landmarks) {
      this.drawDebugMesh(ctx, telemetry.landmarks);
    }
  },

  /**
   * Color-tinting pipeline that overlays colors on the hair texture
   * while preserving high-contrast highlights, midtones, and shadows.
   * 
   * @param {HTMLImageElement} hairAsset Original hair Image element
   * @param {string} color Selected color tint (hex, rgb, or color name)
   * @returns {HTMLCanvasElement|HTMLImageElement} The tinted texture canvas
   */
  getTintedHairAsset(hairAsset, color) {
    if (!hairAsset) return null;

    let assetColors = tintedHairCache.get(hairAsset);
    if (!assetColors) {
      assetColors = new Map();
      tintedHairCache.set(hairAsset, assetColors);
    }

    if (assetColors.has(color)) {
      return assetColors.get(color);
    }

    // Lazy-create offscreen canvas context
    if (!offscreenCanvas) {
      offscreenCanvas = document.createElement('canvas');
      offscreenCtx = offscreenCanvas.getContext('2d');
    }

    // Create a new cached canvas for this specific color tint to store in the lookup Map
    const cachedCanvas = document.createElement('canvas');
    cachedCanvas.width = hairAsset.width;
    cachedCanvas.height = hairAsset.height;
    const cachedCtx = cachedCanvas.getContext('2d');

    // Step A: Draw base hair template
    cachedCtx.drawImage(hairAsset, 0, 0);

    // Step B: Mask with solid color (source-in fills only transparent pixel bounds of original texture)
    cachedCtx.globalCompositeOperation = 'source-in';
    cachedCtx.fillStyle = this.resolveColor(color);
    cachedCtx.fillRect(0, 0, cachedCanvas.width, cachedCanvas.height);

    // Step C: Composite original texture back (destination-over blends base under color mask to restore contrast details)
    cachedCtx.globalCompositeOperation = 'destination-over';
    cachedCtx.drawImage(hairAsset, 0, 0);

    // Reset default composition mode
    cachedCtx.globalCompositeOperation = 'source-over';

    // Store in cache
    assetColors.set(color, cachedCanvas);
    console.log(`[FrameRenderer] Tinted and cached hair asset for color: ${color}`);

    return cachedCanvas;
  },

  /**
   * Helper to map name strings to rgba tint colors.
   */
  resolveColor(colorName) {
    const hexRegex = /^#([0-9a-f]{3}){1,2}$/i;
    const rgbRegex = /^rgb(a)?\(.*\)$/i;

    if (hexRegex.test(colorName) || rgbRegex.test(colorName)) {
      return colorName;
    }

    // Standard preset color maps with soft blending alpha configurations
    const colorMap = {
      black: 'rgba(15, 15, 15, 0.75)',
      brown: 'rgba(92, 64, 51, 0.55)',
      'dark brown': 'rgba(59, 35, 20, 0.65)',
      golden: 'rgba(212, 175, 55, 0.45)',
      blonde: 'rgba(250, 240, 190, 0.45)',
      'ash blonde': 'rgba(233, 214, 175, 0.45)',
      grey: 'rgba(128, 128, 128, 0.45)',
      silver: 'rgba(220, 220, 220, 0.45)',
      red: 'rgba(220, 38, 38, 0.45)',
      blue: 'rgba(37, 99, 235, 0.45)',
      purple: 'rgba(147, 51, 234, 0.45)',
      pink: 'rgba(244, 114, 182, 0.45)'
    };

    return colorMap[colorName.toLowerCase()] || 'rgba(99, 102, 241, 0.4)'; // Indigo fallback
  },

  /**
   * Helper to draw a futuristic vector line mesh connecting face landmarks.
   */
  drawDebugMesh(ctx, landmarks) {
    ctx.save();
    
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    
    // Draw micro-dots on key landmark vertices
    ctx.fillStyle = 'rgba(99, 102, 241, 0.45)'; // Sleek FaceAura Indigo Glow
    for (let i = 0; i < landmarks.length; i += 3) { // Step by 3 to draw a subset for performance
      const pt = landmarks[i];
      ctx.beginPath();
      ctx.arc(pt.x * w, pt.y * h, 1.5, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Draw connecting wires around facial boundaries
    // Eyes outer contour subset
    this.drawContourLines(ctx, landmarks, [33, 160, 158, 133, 153, 144, 33], 'rgba(99, 102, 241, 0.55)', 1);
    this.drawContourLines(ctx, landmarks, [362, 385, 387, 263, 373, 380, 362], 'rgba(99, 102, 241, 0.55)', 1);
    
    // Lips contour subset
    this.drawContourLines(ctx, landmarks, [61, 81, 13, 311, 291, 402, 14, 178, 61], 'rgba(236, 72, 153, 0.45)', 1.2); // Pink Glow lips

    // Eyebrows
    this.drawContourLines(ctx, landmarks, [70, 63, 66, 107, 55], 'rgba(139, 92, 246, 0.55)', 1);
    this.drawContourLines(ctx, landmarks, [300, 293, 296, 336, 285], 'rgba(139, 92, 246, 0.55)', 1);

    // Forehead anchor center circle
    const forehead = landmarks[10];
    if (forehead) {
      ctx.beginPath();
      ctx.arc(forehead.x * w, forehead.y * h, 4, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgb(168, 85, 247)'; // Violet center
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  },

  /**
   * Helper to draw connected line segments between an array of landmark indices.
   */
  drawContourLines(ctx, landmarks, indexArray, strokeStyle, lineWidth) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    
    ctx.beginPath();
    indexArray.forEach((idx, i) => {
      const pt = landmarks[idx];
      if (pt) {
        if (i === 0) ctx.moveTo(pt.x * w, pt.y * h);
        else ctx.lineTo(pt.x * w, pt.y * h);
      }
    });
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
};

export default FrameRenderer;
