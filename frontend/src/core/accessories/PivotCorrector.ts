/**
 * PivotCorrector.ts
 *
 * Automatically inspects the 3D bounding box of loaded GLB/GLTF models and repositions
 * their pivot points (local origin) to the correct anatomical center of rotation/attachment.
 *
 * Alignment Rules:
 * 1. Hair: Pivot at the bottom-center of the hairstyle mesh, allowing it to sit naturally on the scalp
 *    and overlap slightly with the forehead without floating.
 * 2. Glasses: Pivot at the center of the nose bridge (between the eyes, back edge of frame).
 * 3. Cap: Pivot at the forehead rim (bottom-center of the opening crown).
 * 4. Beard: Pivot at the top-center (where it attaches under the nose and cheeks).
 */

import * as THREE from 'three';

export class PivotCorrector {
  constructor() {}

  /**
   * Computes the bounding box of a 3D model.
   */
  public computeBoundingBox(model: THREE.Group): THREE.Box3 {
    // Force compute bounding boxes on all children meshes first to ensure accuracy
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (!child.geometry.boundingBox) {
          child.geometry.computeBoundingBox();
        }
      }
    });
    return new THREE.Box3().setFromObject(model);
  }

  /**
   * Repositions the pivot of the 3D group by shifting all children relative to the origin (0, 0, 0).
   *
   * @param model Three.js Group model
   * @param category Accessory category (hair, beard, glasses, caps)
   */
  public correctPivot(model: THREE.Group, category: string): void {
    const box = this.computeBoundingBox(model);
    
    const center = new THREE.Vector3();
    box.getCenter(center);
    
    const size = new THREE.Vector3();
    box.getSize(size);

    const shift = new THREE.Vector3();

    // Map pivot translation according to category alignment rules
    switch (category) {
      case 'hair':
        // Origin at bottom-center of the hairstyle
        // Shift X to center, Y to bottom of the mesh, Z to center
        shift.set(-center.x, -box.min.y, -center.z);
        break;

      case 'glasses':
        // Origin between the eyes / nose bridge
        // Shift X to center, Y to center, Z to back edge (closer to the face)
        shift.set(-center.x, -center.y, -box.min.z);
        break;

      case 'beard':
        // Origin at top-center of the beard
        // Shift X to center, Y to top, Z to back edge (so it wraps chin)
        shift.set(-center.x, -box.max.y, -box.max.z);
        break;

      case 'caps':
        // Origin at forehead entry rim (bottom center of crown)
        shift.set(-center.x, -box.min.y, -center.z);
        break;

      default:
        // Default: shift origin to exact center of bounding box
        shift.copy(center).negate();
        break;
    }

    // Shift child objects to move their geometries relative to the new pivot
    model.traverse((child) => {
      if (child === model) return;
      // Shift direct children to avoid compounding translations
      if (child.parent === model) {
        child.position.add(shift);
      }
    });

    console.log(`[PivotCorrector] Pivot corrected for ${category}. Bounding box size:`, size, `Shift offset applied:`, shift);
  }
}

export const pivotCorrector = new PivotCorrector();
export default pivotCorrector;
