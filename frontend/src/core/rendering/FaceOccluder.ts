/**
 * FaceOccluder.ts
 *
 * Generates an invisible depth occluding mesh for the 3D FaceGeometry.
 * Prevents 3D assets (e.g. glasses temple arms or back hair) from rendering
 * in front of the user's face, ensuring accurate visual layers.
 */

import * as THREE from 'three';

export class FaceOccluder {
  private mesh: THREE.Mesh;

  constructor(geometry: THREE.BufferGeometry) {
    // Occlusion material: invisible, but writes to depth buffer to mask objects behind the face
    const occlusionMaterial = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: true,
      transparent: false
    });

    this.mesh = new THREE.Mesh(geometry, occlusionMaterial);
  }

  /**
   * Returns the constructed occluding mesh
   */
  public getMesh(): THREE.Mesh {
    return this.mesh;
  }
}

export default FaceOccluder;
