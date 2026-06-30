import * as THREE from 'three';
import { MakeupShaderMaterial } from './MakeupShaders';

export class MaterialFactory {
  private static materialCache = new Map<string, THREE.Material>();

  /**
   * Generates or fetches a cached material.
   */
  private static getCachedOrCreate<T extends THREE.Material>(key: string, creator: () => T): T {
    if (this.materialCache.has(key)) {
      return this.materialCache.get(key) as T;
    }
    const material = creator();
    this.materialCache.set(key, material);
    return material;
  }

  /**
   * High-fidelity refractive glass material for eyewear lenses.
   */
  public static createGlassMaterial(envMap: THREE.Texture | null, color = 0xffffff): THREE.MeshPhysicalMaterial {
    const key = `glass_${color}_${envMap ? envMap.id : 'no-env'}`;
    return this.getCachedOrCreate(key, () => {
      return new THREE.MeshPhysicalMaterial({
        color: color,
        transparent: true,
        opacity: 0.2,
        metalness: 0.1,
        roughness: 0.05,
        transmission: 0.9,      // Refractive transparency
        thickness: 0.5,         // Optical thickness
        ior: 1.52,              // Index of refraction of glass
        envMap: envMap,
        envMapIntensity: 1.5,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05
      });
    });
  }

  /**
   * Soft alpha-blended hair material.
   */
  public static createHairMaterial(envMap: THREE.Texture | null, color = 0xffffff): THREE.MeshStandardMaterial {
    const key = `hair_${color}_${envMap ? envMap.id : 'no-env'}`;
    return this.getCachedOrCreate(key, () => {
      return new THREE.MeshStandardMaterial({
        color: color,
        transparent: true,
        alphaTest: 0.15,
        roughness: 0.8,
        metalness: 0.1,
        envMap: envMap,
        envMapIntensity: 0.8,
        shadowSide: THREE.DoubleSide
      });
    });
  }

  /**
   * Polished metallic material for glasses frames/accessories.
   */
  public static createMetalMaterial(envMap: THREE.Texture | null, color = 0xdcdcdc): THREE.MeshStandardMaterial {
    const key = `metal_${color}_${envMap ? envMap.id : 'no-env'}`;
    return this.getCachedOrCreate(key, () => {
      return new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.15,
        metalness: 1.0,
        envMap: envMap,
        envMapIntensity: 1.5
      });
    });
  }

  /**
   * Standard plastic material for eyewear frames.
   */
  public static createPlasticMaterial(envMap: THREE.Texture | null, color = 0x111111): THREE.MeshStandardMaterial {
    const key = `plastic_${color}_${envMap ? envMap.id : 'no-env'}`;
    return this.getCachedOrCreate(key, () => {
      return new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.35,
        metalness: 0.0,
        envMap: envMap,
        envMapIntensity: 1.0
      });
    });
  }

  /**
   * Matte fabric material for caps and beanies.
   */
  public static createFabricMaterial(envMap: THREE.Texture | null, color = 0x333333): THREE.MeshStandardMaterial {
    const key = `fabric_${color}_${envMap ? envMap.id : 'no-env'}`;
    return this.getCachedOrCreate(key, () => {
      return new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.9,
        metalness: 0.0,
        envMap: envMap,
        envMapIntensity: 0.5
      });
    });
  }

  /**
   * Realistic skin material for occluders/meshes.
   */
  public static createSkinMaterial(envMap: THREE.Texture | null, color = 0xf5cad2): THREE.MeshStandardMaterial {
    const key = `skin_${color}_${envMap ? envMap.id : 'no-env'}`;
    return this.getCachedOrCreate(key, () => {
      return new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.6,
        metalness: 0.0,
        envMap: envMap,
        envMapIntensity: 0.7
      });
    });
  }

  /**
   * Biometric makeup material mapping lipstick, blush, and smoothing.
   */
  public static createMakeupMaterial(): MakeupShaderMaterial {
    const key = 'makeup_shader';
    return this.getCachedOrCreate(key, () => {
      return new MakeupShaderMaterial();
    });
  }

  /**
   * Depth occluding material (writes to depth buffer, hides accessories behind the head).
   */
  public static createOcclusionMaterial(): THREE.MeshBasicMaterial {
    const key = 'occlusion';
    return this.getCachedOrCreate(key, () => {
      return new THREE.MeshBasicMaterial({
        colorWrite: false,
        depthWrite: true,
        transparent: false
      });
    });
  }

  /**
   * Transparent shadow plane material.
   */
  public static createShadowMaterial(opacity = 0.4): THREE.ShadowMaterial {
    const key = `shadow_${opacity}`;
    return this.getCachedOrCreate(key, () => {
      const mat = new THREE.ShadowMaterial();
      mat.opacity = opacity;
      return mat;
    });
  }

  /**
   * Clears the material cache and disposes of all cached materials.
   */
  public static clearCache(): void {
    for (const [key, material] of this.materialCache.entries()) {
      material.dispose();
    }
    this.materialCache.clear();
    console.log('[MaterialFactory] Cached materials disposed.');
  }
}

export default MaterialFactory;
