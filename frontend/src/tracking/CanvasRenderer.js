import assetLoader from './AssetLoader';
import FrameRenderer from './FrameRenderer';

/**
 * CanvasRenderer Class
 * 
 * Manages the visible HTML5 Canvas element. It handles loading and caching
 * of assets, canvas dimensions matching on viewport/video changes, and schedules 
 * the high-frequency drawing ticks inside a requestAnimationFrame loop to render 
 * at 60 FPS without flickering.
 */
export class CanvasRenderer {
  /**
   * @param {HTMLCanvasElement} canvasElement The target rendering canvas
   * @param {HTMLVideoElement} videoElement The active webcam video feed
   */
  constructor(canvasElement, videoElement) {
    if (!canvasElement) {
      throw new Error('[CanvasRenderer] A target HTMLCanvasElement is required.');
    }
    if (!videoElement) {
      throw new Error('[CanvasRenderer] A source HTMLVideoElement is required.');
    }

    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.video = videoElement;
    
    this.isRendering = false;
    this.frameId = null;
    
    // Cached Image elements for loaded overlays
    this.assets = {
      hair: null,
      beard: null,
      glasses: null
    };

    // Current requested asset source URLs
    this.assetUrls = {
      hair: null,
      beard: null,
      glasses: null
    };

    // Rendering pipeline configurations
    this.options = {
      hairColor: 'Original',
      isMirrored: true,
      hairOptions: {
        softEdges: true,
        shadowBlur: 6,
        opacity: 1.0,
        customScale: 1.0,
        customOffsetY: 0
      },
      beardOptions: {
        opacity: 1.0,
        scale: 1.0,
        offsetY: 0
      },
      glassesOptions: {
        opacity: 1.0,
        scale: 1.0,
        offsetY: 0
      }
    };

    this.latestTelemetry = null;
  }

  /**
   * Set or update overlay assets of specific types (hair, beard, glasses).
   * Initiates async loading and caches details.
   * 
   * @param {'hair'|'beard'|'glasses'} type Target overlay slot
   * @param {string|null} url Asset URL path or null to clear slot
   */
  async setAsset(type, url) {
    if (!['hair', 'beard', 'glasses'].includes(type)) {
      throw new Error(`[CanvasRenderer] Invalid asset slot type: "${type}".`);
    }

    this.assetUrls[type] = url;
    if (!url) {
      this.assets[type] = null;
      return;
    }

    try {
      const img = await assetLoader.load(url);
      
      // Prevent race conditions: only store if selection has not changed in the meantime
      if (this.assetUrls[type] === url) {
        this.assets[type] = img;
      }
    } catch (err) {
      console.error(`[CanvasRenderer] Failed to configure ${type} asset from: ${url}`, err);
      if (this.assetUrls[type] === url) {
        this.assets[type] = null;
      }
    }
  }

  /**
   * Updates rendering pipeline configurations.
   * 
   * @param {Object} newOptions Dictionary of overlay rendering options
   */
  setOptions(newOptions) {
    this.options = {
      ...this.options,
      ...newOptions,
      // Merge individual overlay subsets nested details
      hairOptions: {
        ...this.options.hairOptions,
        ...(newOptions.hairOptions || {})
      },
      beardOptions: {
        ...this.options.beardOptions,
        ...(newOptions.beardOptions || {})
      },
      glassesOptions: {
        ...this.options.glassesOptions,
        ...(newOptions.glassesOptions || {})
      }
    };
  }

  /**
   * Updates face tracking data to render.
   * 
   * @param {Object} telemetry Telemetry data compiled from FaceTracker
   */
  updateTelemetry(telemetry) {
    this.latestTelemetry = telemetry;
  }

  /**
   * Start the requestAnimationFrame rendering loop.
   */
  start() {
    if (this.isRendering) return;
    
    this.isRendering = true;
    console.log('[CanvasRenderer] Rendering loop started.');
    this.tick();
  }

  /**
   * Stop the active rendering loop.
   */
  stop() {
    this.isRendering = false;
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    console.log('[CanvasRenderer] Rendering loop stopped.');
  }

  /**
   * High-frequency animation frame execution.
   */
  tick() {
    if (!this.isRendering) return;

    // A. Match dimensions dynamic updates
    this.resizeCanvasToVideo();

    // B. Run layered composition
    if (this.video && this.video.readyState >= 2) {
      FrameRenderer.render(
        this.ctx,
        this.video,
        this.latestTelemetry,
        this.assets,
        this.options
      );
    }

    // C. Re-schedule loop frame
    if (this.isRendering) {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  /**
   * Synchronizes canvas dimensions to match the source video stream
   * to avoid pixel distortion and aspect ratio anomalies.
   */
  resizeCanvasToVideo() {
    if (!this.video || !this.canvas) return;

    const targetWidth = this.video.videoWidth || 640;
    const targetHeight = this.video.videoHeight || 480;

    if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
      this.canvas.width = targetWidth;
      this.canvas.height = targetHeight;
      console.log(`[CanvasRenderer] Output Canvas resized to: ${targetWidth}x${targetHeight}`);
    }
  }
}

export default CanvasRenderer;
