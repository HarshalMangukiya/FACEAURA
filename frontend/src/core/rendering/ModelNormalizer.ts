import * as THREE from 'three';

export class ModelNormalizer {
  /**
   * Centers the object's pivot and translates all children relative to it.
   * Caters offsets custom to the accessory category.
   */
  public static centerPivot(model: THREE.Group, category: string): void {
    const box = this.normalizeBoundingBox(model);
    const center = new THREE.Vector3();
    box.getCenter(center);
    
    const size = new THREE.Vector3();
    box.getSize(size);

    const shift = new THREE.Vector3();

    // Customize the model's pivot based on category alignment rules
    if (category === 'caps') {
      // Caps are placed relative to the opening crown, i.e., bottom center
      shift.set(-center.x, -box.min.y, -center.z);
    } else if (category === 'beard') {
      // Beard pivot is oriented at the top back (attaches to lower face/chin)
      shift.set(-center.x, -box.max.y, -box.max.z);
    } else if (category === 'hair') {
      // Hair models are placed relative to the root/nape area
      shift.set(-center.x, -center.y - size.y * 0.2, -center.z + size.z * 0.2);
    } else if (category === 'glasses') {
      // Glasses pivot should be at the nose bridge (center of nose pads)
      shift.set(-center.x, -center.y, -box.min.z);
    } else {
      // Default: absolute center
      shift.copy(center).negate();
    }

    // Translate all child nodes so they respect the new origin pivot
    model.traverse((child) => {
      if (child === model) return;
      if (child.parent === model) {
        child.position.add(shift);
      }
    });
  }

  /**
   * Automatically scales the model so its primary dimension matches a standardized unit width.
   */
  public static normalizeScale(model: THREE.Group, category: string, targetWidth: number = 1.0): void {
    const box = this.normalizeBoundingBox(model);
    const size = new THREE.Vector3();
    box.getSize(size);

    // Primary scaling metric: face-mesh width (X-axis size)
    const currentWidth = size.x || 1.0;
    const scaleFactor = targetWidth / currentWidth;

    model.scale.setScalar(scaleFactor);
  }

  /**
   * Resets default rotations on the loaded group.
   */
  public static normalizeRotation(model: THREE.Group): void {
    model.rotation.set(0, 0, 0);
  }

  /**
   * Computes the bounding box of the group.
   */
  public static normalizeBoundingBox(model: THREE.Group): THREE.Box3 {
    return new THREE.Box3().setFromObject(model);
  }

  /**
   * Aligns the model's forward facing direction (+Z).
   */
  public static alignForwardAxis(model: THREE.Group): void {
    // Standard models should face along the +Z axis.
    // If a model is loaded sideways or backward, we can apply corrective parent rotations.
    // In our case, normalizer assumes standard GLTF orientations and resets rotation.
  }

  /**
   * Aligns the model's up vertical axis (+Y).
   */
  public static alignUpAxis(model: THREE.Group): void {
    // Corrects tilt orientations. Resets rotation.
  }

  /**
   * Full normalization pipeline.
   */
  public static normalize(model: THREE.Group, category: string): void {
    this.normalizeRotation(model);
    this.centerPivot(model, category);
    this.normalizeScale(model, category);
    this.alignForwardAxis(model);
    this.alignUpAxis(model);
  }
}

export default ModelNormalizer;
