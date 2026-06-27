import assetLoader from './AssetLoader';
import FrameRenderer from './FrameRenderer';
import { SceneManager } from '../core/rendering/SceneManager';
import { GlassesPlugin } from '../core/accessories/glasses/GlassesPlugin';
import { HairPlugin } from '../core/accessories/hair/HairPlugin';
import { BeardPlugin } from '../core/accessories/beard/BeardPlugin';
import { MakeupPlugin } from '../core/accessories/makeup/MakeupPlugin';

/**
 * CanvasRenderer Class
 *
 * Orchestrator that manages the visible HTML5 Canvas element.
 * If WebGL is supported, instantiates a Three.js SceneManager to render high-fidelity
 * 3D/PBR accessories, WebGL beauty shaders, and makeup maps.
 * Fallbacks gracefully to Canvas 2D image composition on unsupported devices.
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

    // WebGL / ThreeJS Engine Integration
    this.webglSupported = this.checkWebGLSupport();
    this.sceneManager = null;
    this.glassesPlugin = null;
    this.hairPlugin = null;
    this.beardPlugin = null;
    this.makeupPlugin = null;

    // 2D Legacy Fallback Caches
    this.assets = { hair: null, beard: null, glasses: null };
    this.assetUrls = { hair: null, beard: null, glasses: null };

    // Rendering pipeline configurations
    this.options = {
      hairColor: 'Original',
      showMesh: false,
      isMirrored: true,
      hairOptions: { opacity: 1.0, customScale: 1.0, offsetY: 0, offsetZ: -0.05 },
      beardOptions: { opacity: 1.0, scale: 1.0, offsetY: -0.15, offsetZ: 0.08 },
      glassesOptions: { opacity: 1.0, scale: 1.0, offsetY: 0.05, offsetZ: 0.15 },
      beautyOptions: { smoothness: 0.0, blemishReduction: 0.0, sharpen: 0.0, brightness: 0.0, contrast: 1.0 }
    };

    this.latestTelemetry = null;

    // Initialize 3D Engine if supported
    if (this.webglSupported) {
      try {
        console.log('[CanvasRenderer] WebGL supported, spinning up Three.js scene manager...');
        this.sceneManager = new SceneManager(this.canvas, this.video);
        const { headGroup, envMap } = this.sceneManager.getRenderContext();

        this.glassesPlugin = new GlassesPlugin(headGroup, envMap);
        this.hairPlugin = new HairPlugin(headGroup, envMap);
        this.beardPlugin = new BeardPlugin(headGroup, envMap);
        this.makeupPlugin = new MakeupPlugin(this.sceneManager);

        // Register hair physics spring updates into the ThreeJS render tick
        this.sceneManager.registerPhysicsCallback((dt) => {
          this.hairPlugin.updatePhysics(dt);
        });
      } catch (err) {
        console.error('[CanvasRenderer] WebGL initialization failed, falling back to 2D canvas context:', err);
        this.webglSupported = false;
        this.ctx = this.canvas.getContext('2d');
      }
    }
  }

  /**
   * Safe check for WebGL contexts
   */
  checkWebGLSupport() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  /**
   * Set or update overlay assets (hair, beard, glasses).
   */
  async setAsset(type, url) {
    if (!['hair', 'beard', 'glasses'].includes(type)) {
      throw new Error(`[CanvasRenderer] Invalid asset slot type: "${type}".`);
    }

    this.assetUrls[type] = url;

    // A. 3D WebGL Pipeline: load GLTF/GLB models
    if (this.webglSupported) {
      if (!url) {
        if (type === 'hair') this.hairPlugin.clear();
        if (type === 'beard') this.beardPlugin.clear();
        if (type === 'glasses') this.glassesPlugin.clear();
        return;
      }

      // Convert 2D assets paths to generic GLB models or load if path contains .glb/.gltf
      // If path contains standard png assets, we can load them onto 3D billboards (planes)
      // inside the WebGL scene as fallback. For try-on, we load models if available.
      let modelUrl = url;
      // Map standard images to demo GLTF assets if path matches seed values
      if (url.includes('hairstyles/')) {
        modelUrl = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BoomBox/glTF-Binary/BoomBox.glb'; // Demo asset fallback
      } else if (url.includes('glasses/')) {
        modelUrl = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/WaterBottle/glTF-Binary/WaterBottle.glb'; // Demo frames fallback
      }

      try {
        if (type === 'hair') await this.hairPlugin.loadHair(modelUrl);
        if (type === 'beard') await this.beardPlugin.loadBeard(modelUrl);
        if (type === 'glasses') await this.glassesPlugin.loadGlasses(modelUrl);
      } catch (err) {
        console.error(`[CanvasRenderer] Failed to load 3D asset ${type} from ${modelUrl}:`, err);
      }
      return;
    }

    // B. 2D Legacy Context: load PNGs
    if (!url) {
      this.assets[type] = null;
      return;
    }

    try {
      const img = await assetLoader.load(url);
      if (this.assetUrls[type] === url) {
        this.assets[type] = img;
      }
    } catch (err) {
      console.error(`[CanvasRenderer] Failed to load 2D asset ${type} from ${url}:`, err);
      if (this.assetUrls[type] === url) {
        this.assets[type] = null;
      }
    }
  }

  /**
   * Updates rendering options (colors, opacity, scaling offsets).
   */
  setOptions(newOptions) {
    this.options = {
      ...this.options,
      ...newOptions,
      hairOptions: { ...this.options.hairOptions, ...(newOptions.hairOptions || {}) },
      beardOptions: { ...this.options.beardOptions, ...(newOptions.beardOptions || {}) },
      glassesOptions: { ...this.options.glassesOptions, ...(newOptions.glassesOptions || {}) },
      beautyOptions: { ...this.options.beautyOptions, ...(newOptions.beautyOptions || {}) }
    };

    if (this.webglSupported) {
      // Propagate configurations to plugins
      const { hairOptions, beardOptions, glassesOptions, hairColor } = this.options;
      
      this.hairPlugin.setColor(hairColor);
      this.hairPlugin.setOffsets(hairOptions.customScale, hairOptions.offsetY || 0.18, hairOptions.offsetZ || -0.05);

      this.beardPlugin.setColor(hairColor);
      this.beardPlugin.setOffsets(beardOptions.scale, beardOptions.offsetY || -0.15, beardOptions.offsetZ || 0.08);

      this.glassesPlugin.setOffsets(glassesOptions.scale, glassesOptions.offsetY || 0.05, glassesOptions.offsetZ || 0.15);

      // Configure Makeup shaders (dynamic demo settings)
      this.makeupPlugin.configure({
        lipstickColor: hairColor === 'Original' ? '#d11a2a' : hairColor,
        lipstickOpacity: this.assetUrls.hair ? 0.35 : 0.0, // apply default tint
        lipstickGloss: 0.5
      });
    }
  }

  updateTelemetry(telemetry) {
    this.latestTelemetry = telemetry;

    if (this.webglSupported && telemetry && telemetry.faceDetected) {
      // Propagate landmark movements to guide facial accessory scaling and blendshapes stretch
      this.hairPlugin.setColor(this.options.hairColor); // re-sync
      this.beardPlugin.updateExpressions(telemetry.landmarks, telemetry.blendshapes);
      this.glassesPlugin.updatePose(telemetry.landmarks);
      this.makeupPlugin.updatePose(telemetry.landmarks);
    }
  }

  start() {
    if (this.isRendering) return;
    this.isRendering = true;
    console.log('[CanvasRenderer] Rendering tick started.');
    this.tick();
  }

  stop() {
    this.isRendering = false;
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    console.log('[CanvasRenderer] Rendering tick stopped.');
  }

  tick() {
    if (!this.isRendering) return;

    this.resizeCanvasToVideo();

    if (this.video && this.video.readyState >= 2) {
      // A. WebGL Rendering Path
      if (this.webglSupported && this.sceneManager) {
        this.sceneManager.render(this.latestTelemetry);
      } else {
        // B. 2D Context Fallback Path
        FrameRenderer.render(
          this.ctx,
          this.video,
          this.latestTelemetry,
          this.assets,
          this.options
        );
      }
    }

    if (this.isRendering) {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  resizeCanvasToVideo() {
    if (!this.video || !this.canvas) return;

    const targetWidth = this.video.videoWidth || 640;
    const targetHeight = this.video.videoHeight || 480;

    if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
      this.canvas.width = targetWidth;
      this.canvas.height = targetHeight;
      
      if (this.webglSupported && this.sceneManager) {
        const { renderer } = this.sceneManager.getRenderContext();
        renderer.setSize(targetWidth, targetHeight);
      }
      
      console.log(`[CanvasRenderer] Canvas dimensions synchronized to: ${targetWidth}x${targetHeight}`);
    }
  }

  destroy() {
    this.stop();
    if (this.webglSupported && this.sceneManager) {
      this.sceneManager.dispose();
      this.sceneManager = null;
    }
  }
}

export default CanvasRenderer;
