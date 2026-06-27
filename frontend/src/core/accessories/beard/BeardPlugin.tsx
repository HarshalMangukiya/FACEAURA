/**
 * BeardPlugin.tsx
 *
 * Manages loading, caching, and rendering of 3D facial hair/Beard styles (GLTF/GLB).
 * Supports:
 * - Mouth opening adaptation (Y-axis mesh stretching driven by jaw blendshapes).
 * - Jaw width adaptation (X-axis mesh scale adjustments based on biometric distances).
 * - Dynamic recoloring and alpha transparency blending.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class BeardPlugin {
  private loader: GLTFLoader;
  private currentModel: THREE.Group | null = null;
  private modelCache = new Map<string, THREE.Group>();
  private headGroup: THREE.Group;
  private envMap: THREE.Texture | null = null;

  // Options
  private scale: number = 1.0;
  private offsetY: number = -0.15;
  private offsetZ: number = 0.08;
  private beardColor: string = 'Original';

  // Biometric scale adjustments
  private jawScaleX: number = 1.0;
  private jawStretchY: number = 1.0;

  constructor(headGroup: THREE.Group, envMap: THREE.Texture | null) {
    this.headGroup = headGroup;
    this.envMap = envMap;
    this.loader = new GLTFLoader();
  }

  /**
   * Loads beard model and attaches it to the lower face.
   */
  public async loadBeard(modelUrl: string): Promise<THREE.Group | null> {
    this.clear();

    if (this.modelCache.has(modelUrl)) {
      const cached = this.modelCache.get(modelUrl)!.clone();
      this.attachToHead(cached);
      return cached;
    }

    return new Promise((resolve) => {
      this.loader.load(
        modelUrl,
        (gltf) => {
          const model = gltf.scene;
          
          this.applyBeardMaterials(model);
          this.modelCache.set(modelUrl, model);
          
          const cloned = model.clone();
          this.attachToHead(cloned);
          resolve(cloned);
        },
        undefined,
        (err) => {
          console.error('[BeardPlugin] Failed to load 3D beard model:', err);
          resolve(null);
        }
      );
    });
  }

  private applyBeardMaterials(model: THREE.Group) {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        const mat = child.material as THREE.MeshStandardMaterial;
        if (mat) {
          mat.envMap = this.envMap;
          mat.envMapIntensity = 0.6;
          mat.transparent = true;
          mat.alphaTest = 0.1;
          mat.roughness = 0.90;
        }
      }
    });
  }

  private attachToHead(model: THREE.Group) {
    this.currentModel = model;

    // Position around jaw/chin line
    model.position.set(0, this.offsetY * 10, this.offsetZ * 10);
    model.scale.set(
      this.scale * 10.0 * this.jawScaleX,
      this.scale * 10.0 * this.jawStretchY,
      this.scale * 10.0
    );

    this.headGroup.add(model);
    this.setColor(this.beardColor);
  }

  /**
   * Adapts the beard width and stretches it vertically based on mouth open states.
   *
   * @param landmarks FaceMesh landmarks
   * @param blendshapes MediaPipe FaceLandmarker blendshape estimates
   */
  public updateExpressions(landmarks: any[], blendshapes?: any[]) {
    if (!this.currentModel || !landmarks || landmarks.length < 172) return;

    // 1. Jaw width adaptation (scale X-axis)
    // Left jaw: 172, Right jaw: 397
    const leftJaw = landmarks[172];
    const rightJaw = landmarks[397];
    const jawWidth = Math.hypot(rightJaw.x - leftJaw.x, rightJaw.y - leftJaw.y, rightJaw.z - leftJaw.z);
    
    // Normal jaw width factor: typical distance is 0.16 units
    this.jawScaleX = jawWidth / 0.16;

    // 2. Mouth opening adaptation (stretch Y-axis)
    // Search for jawOpen (usually index 25 or named 'jawOpen') in blendshapes
    let jawOpenVal = 0;
    if (blendshapes && blendshapes.length > 0) {
      const jawOpenShape = blendshapes.find(b => b.categoryName === 'jawOpen' || b.name === 'jawOpen');
      if (jawOpenShape) {
        jawOpenVal = jawOpenShape.score; // 0.0 to 1.0
      }
    }

    // Dynamic stretch multiplier: stretch beard downward up to 20% under wide jaw openings
    this.jawStretchY = 1.0 + (jawOpenVal * 0.20);

    // Apply combined scales to the model
    this.currentModel.scale.set(
      this.scale * 10.0 * this.jawScaleX,
      this.scale * 10.0 * this.jawStretchY,
      this.scale * 10.0
    );
  }

  /**
   * Recolors the beard meshes.
   */
  public setColor(colorName: string) {
    this.beardColor = colorName;
    if (!this.currentModel) return;

    let targetColor = new THREE.Color(0x3a2314); // Default Dark Brown
    
    const colorMap: Record<string, number> = {
      black: 0x0c0c0c,
      brown: 0x5c4033,
      'dark brown': 0x3b2314,
      golden: 0xb58e24,
      blonde: 0xe6df9c,
      'ash blonde': 0xbfaa8a,
      grey: 0x7a7a7a,
      silver: 0xcccccc,
      red: 0x992222,
      blue: 0x1d4ed8,
      purple: 0x7e22ce,
      pink: 0xdb2777
    };

    const resolved = colorMap[colorName.toLowerCase()];
    if (resolved !== undefined) {
      targetColor.setHex(resolved);
    } else if (colorName.startsWith('#')) {
      targetColor.set(colorName);
    } else {
      // Original
      this.currentModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.MeshStandardMaterial;
          if (mat) mat.color.setHex(0xffffff);
        }
      });
      return;
    }

    this.currentModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material as THREE.MeshStandardMaterial;
        if (mat) {
          mat.color.copy(targetColor);
        }
      }
    });
  }

  public setOffsets(scale: number, offsetY: number, offsetZ: number) {
    this.scale = scale;
    this.offsetY = offsetY;
    this.offsetZ = offsetZ;

    if (this.currentModel) {
      this.currentModel.position.set(0, offsetY * 10, offsetZ * 10);
      this.currentModel.scale.set(
        scale * 10.0 * this.jawScaleX,
        scale * 10.0 * this.jawStretchY,
        scale * 10.0
      );
    }
  }

  public clear() {
    if (this.currentModel) {
      this.headGroup.remove(this.currentModel);
      this.currentModel = null;
    }
  }
}
export default BeardPlugin;
