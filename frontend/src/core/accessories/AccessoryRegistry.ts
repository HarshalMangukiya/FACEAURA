/**
 * AccessoryRegistry.ts
 *
 * A central, configuration-driven registry for Virtual Try-On accessories.
 * Handles the registering of categories (hair, glasses, cap, beard, etc.), GLB model loading,
 * asset validation, and instantiation of configured AccessoryPlugins.
 *
 * Separates configuration metadata (e.g., offsets, physics constants, scaling factors)
 * from core tracking and rendering execution.
 */

import * as THREE from 'three';
import { IAccessoryPlugin } from './IAccessoryPlugin';
import { AccessoryPlugin } from './AccessoryPlugin';
import { assetLoader } from '../../tracking/AssetLoader';
import { assetValidator } from '../assets/AssetValidator';

export interface AccessoryConfig {
  category: string;
  primaryAnchor: string;
  pivot: 'bottom-center' | 'between-eyes' | 'forehead' | 'top-center' | 'center';
  scaling: {
    widthSource: 'temple-distance' | 'eye-distance' | 'jaw-width' | 'face-width';
    heightSource: 'forehead-chin' | 'eye-height' | 'jaw-height' | 'none';
    depthSource: 'head-depth' | 'none';
    widthMultiplier: number;
    heightMultiplier: number;
    depthMultiplier: number;
  };
  offsets: {
    yScaleFactor?: number; // percentage multiplier of facial dimensions
    zScaleFactor?: number;
    xScaleFactor?: number;
  };
  physics?: {
    stiffness: number;
    damping: number;
    mass: number;
    maxSway: number;
  };
  blendshapeSupport?: Record<string, { scaleY?: number; offsetY?: number; scaleX?: number }>;
  occlusion?: boolean;
}

export class AccessoryRegistry {
  private configs = new Map<string, AccessoryConfig>();
  private activePlugins = new Map<string, IAccessoryPlugin>();
  private headGroup: THREE.Group;

  constructor(headGroup: THREE.Group) {
    this.headGroup = headGroup;
    this.registerDefaults();
  }

  /**
   * Register a custom accessory category configuration.
   */
  public register(category: string, config: AccessoryConfig): void {
    this.configs.set(category, config);
    console.log(`[AccessoryRegistry] Registered configuration for: ${category}`);
  }

  /**
   * Gets a registered configuration.
   */
  public getConfig(category: string): AccessoryConfig | undefined {
    return this.configs.get(category);
  }

  /**
   * Factory creation: Loads and instantiates an accessory into an active plugin.
   */
  public async loadAndInstantiate(category: string, assetUrl: string): Promise<IAccessoryPlugin | null> {
    const config = this.configs.get(category);
    if (!config) {
      console.error(`[AccessoryRegistry] No configuration registered for category: ${category}`);
      return null;
    }

    try {
      console.log(`[AccessoryRegistry] Loading GLB model for ${category}: ${assetUrl}`);

      // 1. Fetch model (handles both 3D GLTF and 2D Image billboards)
      const model = await assetLoader.loadModel(assetUrl, category);
      if (!model) {
        throw new Error(`AssetLoader returned null for url: ${assetUrl}`);
      }

      // 2. Run Asset Validation & Corrections
      assetValidator.validateAndCorrect(model, config);

      // 3. Create the generic configured AccessoryPlugin
      const plugin = new AccessoryPlugin(category, this.headGroup, {
        category,
        stiffness: config.physics?.stiffness,
        damping: config.physics?.damping,
        mass: config.physics?.mass,
        maxSway: config.physics?.maxSway
      });

      // Pass configuration to the plugin
      plugin.setConfig({
        pivot: config.pivot,
        scaling: config.scaling,
        offsets: config.offsets,
        blendshapeSupport: config.blendshapeSupport,
        occlusion: config.occlusion ?? true
      });

      // 4. Attach model (repositions pivot, sets visibility)
      plugin.attach(model);

      // Store active plugin
      const existing = this.activePlugins.get(category);
      if (existing) {
        existing.dispose();
      }
      this.activePlugins.set(category, plugin);

      return plugin;
    } catch (err) {
      console.error(`[AccessoryRegistry] Failed to instantiate accessory ${category}:`, err);
      return null;
    }
  }

  /**
   * Removes an accessory from the registry slot.
   */
  public remove(category: string): void {
    const plugin = this.activePlugins.get(category);
    if (plugin) {
      plugin.remove();
      this.activePlugins.delete(category);
    }
  }

  /**
   * Returns an active plugin instance.
   */
  public getActivePlugin(category: string): IAccessoryPlugin | undefined {
    return this.activePlugins.get(category);
  }

  /**
   * Exposes all active plugins.
   */
  public getActivePlugins(): Map<string, IAccessoryPlugin> {
    return this.activePlugins;
  }

  /**
   * Updates all active accessories.
   */
  public updateAll(frame: any): void {
    for (const plugin of this.activePlugins.values()) {
      plugin.update(frame);
    }
  }

  /**
   * Disposes of all registered resources.
   */
  public disposeAll(): void {
    for (const plugin of this.activePlugins.values()) {
      plugin.dispose();
    }
    this.activePlugins.clear();
  }

  /**
   * Registers default configurations for core categories.
   */
  private registerDefaults(): void {
    // Hair
    this.register('hair', {
      category: 'hair',
      primaryAnchor: 'hair',
      pivot: 'bottom-center',
      scaling: {
        widthSource: 'temple-distance',
        heightSource: 'forehead-chin',
        depthSource: 'head-depth',
        widthMultiplier: 1.05,
        heightMultiplier: 1.05,
        depthMultiplier: 1.05
      },
      offsets: {
        yScaleFactor: -0.02, // slightly overlap forehead
        zScaleFactor: -0.05
      },
      physics: {
        stiffness: 18.0,
        damping: 3.5,
        mass: 0.015,
        maxSway: 0.40
      }
    });

    // Glasses
    this.register('glasses', {
      category: 'glasses',
      primaryAnchor: 'glasses',
      pivot: 'between-eyes',
      scaling: {
        widthSource: 'eye-distance',
        heightSource: 'eye-height',
        depthSource: 'head-depth',
        widthMultiplier: 2.3,
        heightMultiplier: 2.3,
        depthMultiplier: 0.95
      },
      offsets: {
        yScaleFactor: 0.08, // slightly above nose bridge
        zScaleFactor: 0.05
      }
    });

    // Beard
    this.register('beard', {
      category: 'beard',
      primaryAnchor: 'beard',
      pivot: 'top-center',
      scaling: {
        widthSource: 'jaw-width',
        heightSource: 'jaw-height',
        depthSource: 'head-depth',
        widthMultiplier: 1.0,
        heightMultiplier: 1.0,
        depthMultiplier: 0.8
      },
      offsets: {
        yScaleFactor: -0.25, // lower down onto chin
        zScaleFactor: 0.08
      },
      blendshapeSupport: {
        jawOpen: { scaleY: 0.20 } // stretch beard when jaw opens
      }
    });

    // Caps
    this.register('caps', {
      category: 'caps',
      primaryAnchor: 'caps',
      pivot: 'forehead',
      scaling: {
        widthSource: 'temple-distance',
        heightSource: 'forehead-chin',
        depthSource: 'head-depth',
        widthMultiplier: 1.0,
        heightMultiplier: 0.9,
        depthMultiplier: 1.0
      },
      offsets: {
        yScaleFactor: 0.02,
        zScaleFactor: -0.03
      }
    });

    // Helmet
    this.register('helmet', {
      category: 'helmet',
      primaryAnchor: 'caps',
      pivot: 'forehead',
      scaling: {
        widthSource: 'temple-distance',
        heightSource: 'forehead-chin',
        depthSource: 'head-depth',
        widthMultiplier: 1.15,
        heightMultiplier: 1.10,
        depthMultiplier: 1.15
      },
      offsets: {
        yScaleFactor: 0.05,
        zScaleFactor: 0.0
      }
    });

    // Mask
    this.register('mask', {
      category: 'mask',
      primaryAnchor: 'forehead',
      pivot: 'center',
      scaling: {
        widthSource: 'temple-distance',
        heightSource: 'forehead-chin',
        depthSource: 'head-depth',
        widthMultiplier: 1.0,
        heightMultiplier: 0.95,
        depthMultiplier: 0.6
      },
      offsets: {
        yScaleFactor: -0.10,
        zScaleFactor: 0.08
      }
    });

    // Earrings
    this.register('leftEarring', {
      category: 'leftEarring',
      primaryAnchor: 'leftEarring',
      pivot: 'center',
      scaling: {
        widthSource: 'eye-distance',
        heightSource: 'none',
        depthSource: 'none',
        widthMultiplier: 0.25,
        heightMultiplier: 0.25,
        depthMultiplier: 0.25
      },
      offsets: {
        yScaleFactor: -0.05
      },
      physics: {
        stiffness: 25.0,
        damping: 2.0,
        mass: 0.005,
        maxSway: 0.25
      }
    });

    this.register('rightEarring', {
      category: 'rightEarring',
      primaryAnchor: 'rightEarring',
      pivot: 'center',
      scaling: {
        widthSource: 'eye-distance',
        heightSource: 'none',
        depthSource: 'none',
        widthMultiplier: 0.25,
        heightMultiplier: 0.25,
        depthMultiplier: 0.25
      },
      offsets: {
        yScaleFactor: -0.05
      },
      physics: {
        stiffness: 25.0,
        damping: 2.0,
        mass: 0.005,
        maxSway: 0.25
      }
    });

    // Necklace
    this.register('necklace', {
      category: 'necklace',
      primaryAnchor: 'necklace',
      pivot: 'center',
      scaling: {
        widthSource: 'face-width',
        heightSource: 'none',
        depthSource: 'none',
        widthMultiplier: 0.65,
        heightMultiplier: 0.65,
        depthMultiplier: 0.65
      },
      offsets: {
        yScaleFactor: -0.15
      },
      physics: {
        stiffness: 12.0,
        damping: 4.5,
        mass: 0.020,
        maxSway: 0.30
      }
    });
  }
}
export default AccessoryRegistry;
