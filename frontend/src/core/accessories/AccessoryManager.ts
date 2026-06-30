/**
 * AccessoryManager.ts
 *
 * Orchestrator wrapper around the AccessoryRegistry.
 * Acts as the public API surface for loading, removing, and configuring try-on overlays,
 * maintaining 100% backward-compatibility with the React interface.
 */

import * as THREE from 'three';
import { IAccessoryPlugin } from './IAccessoryPlugin';
import { AccessoryRegistry } from './AccessoryRegistry';
import MakeupPlugin from './makeup/MakeupPlugin';
import { FallbackAssetResolver } from '../assets/FallbackAssetResolver';

export class AccessoryManager {
  private headGroup: THREE.Group;
  private sceneManager: any;
  
  // Registry for config-driven GLTF assets
  private registry: AccessoryRegistry;
  
  // Custom shader-based makeup plugin
  private plugins = new Map<string, IAccessoryPlugin>();
  
  private activeAssets = new Map<string, any>();
  private visibility = new Map<string, boolean>();

  constructor(headGroup: THREE.Group, sceneManager: any) {
    this.headGroup = headGroup;
    this.sceneManager = sceneManager;

    // 1. Initialize config-driven registry
    this.registry = new AccessoryRegistry(this.headGroup);

    // 2. Initialize shader beauty plugin separately
    this.plugins.set('makeup', new MakeupPlugin(sceneManager));

    // Initialize visibility map
    this.visibility.set('makeup', true);
    for (const key of ['hair', 'glasses', 'beard', 'caps', 'helmet', 'mask', 'leftEarring', 'rightEarring', 'necklace']) {
      this.visibility.set(key, true);
    }
  }

  /**
   * Sets the environment map on all 3D plugins to enable PBR reflections.
   */
  public setEnvMap(envMap: THREE.Texture | null): void {
    // registry will propagate to loaded models, but we can set it
  }

  /**
   * Loads an accessory and attaches it to its category plugin slot.
   */
  public async loadAccessory(category: string, asset: any): Promise<boolean> {
    if (category === 'makeup') {
      const makeupPlugin = this.plugins.get('makeup');
      if (makeupPlugin) {
        if (!asset) {
          makeupPlugin.remove();
          this.activeAssets.delete('makeup');
        } else {
          this.activeAssets.set('makeup', asset);
          makeupPlugin.attach(null);
          makeupPlugin.setConfig(asset);
        }
      }
      return true;
    }

    // Standard 3D Asset Path via registry
    if (!asset) {
      this.removeAccessory(category);
      return true;
    }

    try {
      this.activeAssets.set(category, asset);
      const url = FallbackAssetResolver.resolve(category, asset);

      // Smooth removal transition (fade-out current)
      const existing = this.registry.getActivePlugin(category);
      if (existing) {
        existing.remove();
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      // Delegate loading, validation, and factory creation to registry
      const plugin = await this.registry.loadAndInstantiate(category, url);
      
      // Ensure visibility is respected
      if (plugin) {
        plugin.setConfig({ visible: this.visibility.get(category) ?? true });
      }

      return plugin !== null;
    } catch (err) {
      console.error(`[AccessoryManager] Failed to load model for slot ${category}:`, err);
      return false;
    }
  }

  /**
   * Replaces an accessory slot (synonymous with loading).
   */
  public async replaceAccessory(category: string, asset: any): Promise<boolean> {
    return this.loadAccessory(category, asset);
  }

  /**
   * Removes an accessory from the scene with a smooth transition.
   */
  public removeAccessory(category: string): void {
    if (category === 'makeup') {
      const makeup = this.plugins.get('makeup');
      if (makeup) {
        makeup.remove();
        this.activeAssets.delete('makeup');
      }
      return;
    }

    this.registry.remove(category);
    this.activeAssets.delete(category);
  }

  /**
   * Removes all active overlays.
   */
  public removeAll(): void {
    const makeup = this.plugins.get('makeup');
    makeup?.remove();
    this.registry.disposeAll();
    this.activeAssets.clear();
  }

  /**
   * Toggles the rendering visibility of a plugin.
   */
  public setVisible(category: string, visible: boolean): void {
    this.visibility.set(category, visible);
    if (category === 'makeup') {
      const makeup = this.plugins.get('makeup');
      makeup?.setConfig({ visible });
    } else {
      const plugin = this.registry.getActivePlugin(category);
      plugin?.setConfig({ visible });
    }
  }

  /**
   * Propagates resolved anchors, biometrics, and jaw blendshapes to active plugins.
   */
  public update(frame: {
    anchors: any;
    biometrics: any;
    jawOpenScore: number;
    blendshapes: any;
    dt: number;
    width: number;
    height: number;
  }): void {
    // Update makeup if visible
    if (this.visibility.get('makeup')) {
      const makeup = this.plugins.get('makeup');
      makeup?.update(frame);
    }

    // Update all config-driven registry plugins
    this.registry.updateAll(frame);
  }

  /**
   * Updates configuration settings (scales, colors, opacities) on a specific plugin.
   */
  public updateConfig(category: string, config: any): void {
    if (category === 'makeup') {
      const makeup = this.plugins.get('makeup');
      makeup?.setConfig(config);
    } else {
      const plugin = this.registry.getActivePlugin(category);
      plugin?.setConfig(config);
    }
  }

  /**
   * Completely disposes of all resources.
   */
  public dispose(): void {
    const makeup = this.plugins.get('makeup');
    makeup?.dispose();
    this.registry.disposeAll();
    this.activeAssets.clear();
  }

  /**
   * Exposes active assets dictionary.
   */
  public getActiveAccessories(): Record<string, any> {
    const active: Record<string, any> = {};
    for (const [key, value] of this.activeAssets.entries()) {
      active[key] = value;
    }
    return active;
  }

  /**
   * Exposes the registry.
   */
  public getRegistry(): AccessoryRegistry {
    return this.registry;
  }

  /**
   * Returns complete diagnostics payload.
   */
  public getDiagnostics() {
    const loadedPlugins = ['makeup', ...Array.from(this.registry.getActivePlugins().keys())];
    const loadedModels: string[] = [];
    const currentAccessory: Record<string, string> = {};

    const makeup = this.plugins.get('makeup') as any;
    if (makeup && makeup.isApplied) {
      currentAccessory['makeup'] = 'Active Shader';
    }

    const activePlugins = this.registry.getActivePlugins();
    for (const [category, plugin] of activePlugins.entries()) {
      const p = plugin as any;
      if (p.currentModel) {
        loadedModels.push(category);
        currentAccessory[category] = p.currentAssetUrl || 'Configured Model';
      }
    }

    return {
      loadedPlugins,
      loadedModels,
      currentAccessory
    };
  }
}

export default AccessoryManager;
