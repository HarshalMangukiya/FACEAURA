/**
 * AssetValidator.ts
 *
 * Inspects loaded 3D GLB/GLTF models for common design and export issues:
 * - Empty bounding boxes or NaN bounds.
 * - Outlier coordinate scale factors.
 * - Non-zero parent rotations.
 * - Missing vertex normal vectors.
 *
 * Automatically corrects and normalizes scales, rotations, and vertex normals
 * to guarantee stable tracking behavior in WebGL.
 */

import * as THREE from 'three';
import { AccessoryConfig } from '../accessories/AccessoryRegistry';

export class AssetValidator {
  constructor() {}

  /**
   * Validates and auto-corrects model geometries.
   *
   * @param model Three.js Group model to validate
   * @param config The category configuration metadata
   */
  public validateAndCorrect(model: THREE.Group, config: AccessoryConfig): void {
    if (!model) {
      throw new Error('[AssetValidator] Cannot validate null model.');
    }

    console.log(`[AssetValidator] Running validation check on slot "${config.category}"...`);

    // 1. Check scale normalization
    const scale = model.scale;
    if (Math.abs(scale.x - 1.0) > 0.001 || Math.abs(scale.y - 1.0) > 0.001 || Math.abs(scale.z - 1.0) > 0.001) {
      console.warn(`[AssetValidator] Warning: Accessory "${config.category}" has non-normalized scale:`, scale);
      // Correction: Reset local scale representation to 1.0 (scaling is handled dynamically by matrix solver)
      model.scale.set(1, 1, 1);
    }

    // 2. Check rotation offsets
    const rotation = model.rotation;
    if (Math.abs(rotation.x) > 0.001 || Math.abs(rotation.y) > 0.001 || Math.abs(rotation.z) > 0.001) {
      console.warn(`[AssetValidator] Warning: Accessory "${config.category}" has non-zero initial rotation:`, rotation);
      // Correction: Reset parent group rotation to 0 (rotation is mapped relative to head rotation)
      model.rotation.set(0, 0, 0);
    }

    // 3. Inspect child meshes and geometries
    let meshCount = 0;
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        meshCount++;
        const geom = child.geometry;

        if (!geom) {
          console.error(`[AssetValidator] Error: Mesh "${child.name}" is missing geometry!`);
          return;
        }

        // Compute bounding box if missing
        if (!geom.boundingBox) {
          geom.computeBoundingBox();
        }

        const box = geom.boundingBox!;
        if (isNaN(box.min.x) || isNaN(box.max.x)) {
          console.error(`[AssetValidator] Error: Geometry box of "${child.name}" contains NaN bounds!`);
          return;
        }

        // Verify normal vectors are present
        const normalAttr = geom.getAttribute('normal');
        if (!normalAttr || normalAttr.count === 0) {
          console.warn(`[AssetValidator] Mesh "${child.name}" has missing normals. Automatically generating...`);
          geom.computeVertexNormals();
        }

        // Auto-correct material side settings to prevent face culling
        if (child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          for (const mat of materials) {
            if (mat instanceof THREE.MeshStandardMaterial) {
              // Ensure shadows and double sides render cleanly
              mat.side = THREE.DoubleSide;
              mat.shadowSide = THREE.DoubleSide;
            }
          }
        }
      }
    });

    console.log(`[AssetValidator] "${config.category}" contains ${meshCount} mesh(es).`);

    if (meshCount === 0) {
      console.warn(`[AssetValidator] Warning: Model for category "${config.category}" contains no meshes.`);
    }

    // 4. Bounding box size sanity checks
    const boundingBox = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    boundingBox.getSize(size);
    console.log(`[AssetValidator] "${config.category}" bounding box size:`, size, `bounds:`, boundingBox);

    if (size.x < 0.001 || size.y < 0.001 || size.z < 0.001) {
      console.error(`[AssetValidator] Error: Model bounds are extremely flat or empty! Size:`, size);
    } else if (size.x > 100.0 || size.y > 100.0 || size.z > 100.0) {
      console.warn(`[AssetValidator] Warning: Model dimensions are exceptionally large! Size:`, size);
      // Correction: Uniformly scale down the vertices of geometry to normalized units (size.x ~ 1.0)
      const scaleFactor = 1.0 / size.x;
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.scale(scaleFactor, scaleFactor, scaleFactor);
          child.geometry.computeBoundingBox();
          child.geometry.computeBoundingSphere();
        }
      });
      console.log(`[AssetValidator] Auto-corrected bounds of "${config.category}" by scaling down geometry by: ${scaleFactor.toFixed(5)}`);
    }
  }
}

export const assetValidator = new AssetValidator();
export default assetValidator;
