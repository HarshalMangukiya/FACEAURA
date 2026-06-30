import * as THREE from 'three';
import { IAccessoryPlugin } from '../IAccessoryPlugin';
import { MakeupShaderMaterial } from '../../rendering/MakeupShaders';
import { SceneManager } from '../../rendering/SceneManager';

export interface MakeupConfig {
  lipstickColor: string;
  lipstickOpacity: number;
  lipstickGloss: number;
  blushColor: string;
  blushOpacity: number;
  blushRadius: number;
  foundationColor: string;
  foundationOpacity: number;
  skinBrightening: number;
  contourOpacity: number;
  shadowColor: string;
  shadowOpacity: number;
  smoothness?: number;
  blemishReduction?: number;
  textureSize?: THREE.Vector2;
  visible?: boolean;
}

export class MakeupPlugin implements IAccessoryPlugin {
  private material: MakeupShaderMaterial;
  private sceneManager: SceneManager;
  public isApplied: boolean = false;
  private visible: boolean = true;

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
    this.material = new MakeupShaderMaterial();
  }

  /**
   * Applies the makeup shader on the face mesh geometry.
   */
  public attach(model: THREE.Group | null = null): void {
    this.apply();
  }

  private apply(): void {
    if (this.isApplied) return;
    this.sceneManager.setFaceMaterial(this.material);
    this.isApplied = true;
  }

  /**
   * Restores the default occlusion material on the face mesh.
   */
  public remove(): void {
    if (!this.isApplied) return;
    this.sceneManager.setFaceMaterial(null);
    this.isApplied = false;
  }

  /**
   * Updates landmark coordinates uniforms and sets current video texture.
   */
  public update(frame: { anchors: any; blendshapes?: any[]; dt: number; width: number; height: number; landmarks?: any[] }): void {
    if (!this.isApplied || !this.visible) return;

    if (frame.landmarks && frame.landmarks.length > 0) {
      this.material.updateFeatureUniforms(frame.landmarks);
    }

    const videoTexture = this.sceneManager.getVideoTexture();
    if (videoTexture) {
      this.material.uniforms.uVideoTexture.value = videoTexture;
    }
  }

  /**
   * Updates makeup styling shader uniforms directly.
   */
  public setConfig(config: Partial<MakeupConfig>): void {
    this.apply();

    if (config.visible !== undefined) {
      this.visible = config.visible;
      if (!this.visible) {
        this.remove();
        return;
      }
    }

    if (config.lipstickColor !== undefined) {
      this.material.uniforms.uLipstickColor.value.set(config.lipstickColor);
    }
    if (config.lipstickOpacity !== undefined) {
      this.material.uniforms.uLipstickOpacity.value = config.lipstickOpacity;
    }
    if (config.lipstickGloss !== undefined) {
      this.material.uniforms.uLipstickGloss.value = config.lipstickGloss;
    }

    if (config.blushColor !== undefined) {
      this.material.uniforms.uBlushColor.value.set(config.blushColor);
    }
    if (config.blushOpacity !== undefined) {
      this.material.uniforms.uBlushOpacity.value = config.blushOpacity;
    }
    if (config.blushRadius !== undefined) {
      this.material.uniforms.uBlushRadius.value = config.blushRadius;
    }

    if (config.foundationColor !== undefined) {
      this.material.uniforms.uFoundationColor.value.set(config.foundationColor);
    }
    if (config.foundationOpacity !== undefined) {
      this.material.uniforms.uFoundationOpacity.value = config.foundationOpacity;
    }
    if (config.skinBrightening !== undefined) {
      this.material.uniforms.uSkinBrightening.value = config.skinBrightening;
    }

    if (config.contourOpacity !== undefined) {
      this.material.uniforms.uContourOpacity.value = config.contourOpacity;
    }

    if (config.shadowColor !== undefined) {
      this.material.uniforms.uShadowColor.value.set(config.shadowColor);
    }
    if (config.shadowOpacity !== undefined) {
      this.material.uniforms.uShadowOpacity.value = config.shadowOpacity;
    }

    if (config.smoothness !== undefined) {
      this.material.uniforms['uSmoothness']!.value = config.smoothness;
    }
    if (config.blemishReduction !== undefined) {
      this.material.uniforms['uBlemishReduction']!.value = config.blemishReduction;
    }
    if (config.textureSize !== undefined) {
      this.material.uniforms['uTextureSize']!.value.copy(config.textureSize);
    }
  }

  public dispose(): void {
    this.remove();
  }
}

export default MakeupPlugin;
