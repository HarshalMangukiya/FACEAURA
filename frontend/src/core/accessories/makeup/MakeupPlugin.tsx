/**
 * MakeupPlugin.tsx
 *
 * Integrates the WebGL MakeupShaderMaterial with the SceneManager.
 * Translates configuration choices (Lipstick shade, blush opacity, eyeshadow tone, skin brightening)
 * into uniforms updates, and maps dynamic landmarks features to shader coordinates.
 */

import * as THREE from 'three';
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
}

export class MakeupPlugin {
  private material: MakeupShaderMaterial;
  private sceneManager: SceneManager;
  private isApplied: boolean = false;

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
    this.material = new MakeupShaderMaterial();
  }

  /**
   * Applies the makeup shader on the face mesh geometry.
   */
  public apply() {
    if (this.isApplied) return;
    this.sceneManager.setFaceMaterial(this.material);
    this.isApplied = true;
  }

  /**
   * Restores the default occlusion material on the face mesh.
   */
  public remove() {
    if (!this.isApplied) return;
    this.sceneManager.setFaceMaterial(null);
    this.isApplied = false;
  }

  /**
   * Updates WebGL texture input with the current webcam video stream
   */
  public updateVideoTexture(videoTexture: THREE.VideoTexture) {
    this.material.uniforms.uVideoTexture.value = videoTexture;
  }

  /**
   * Updates landmark coordinates uniforms so shaders can track facial features.
   */
  public updatePose(landmarks: any[]) {
    if (this.isApplied && landmarks && landmarks.length > 0) {
      this.material.updateFeatureUniforms(landmarks);
    }
  }

  /**
   * Updates makeup styling options.
   *
   * @param config Configurations dictionary
   */
  public configure(config: Partial<MakeupConfig>) {
    this.apply();

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
  }
}
export default MakeupPlugin;
