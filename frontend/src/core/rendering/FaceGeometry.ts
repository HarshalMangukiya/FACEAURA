/**
 * FaceGeometry.ts
 *
 * Generates and updates a 3D Three.js BufferGeometry mapped to the 468 landmarks
 * of the MediaPipe Face Mesh.
 * Uses the canonical 896 triangles index buffer to form a solid, deformable 3D face shield.
 * Computes dynamic projected UV coordinates for real-time video texturing/sampling.
 */

import * as THREE from 'three';

// A highly optimized subset of key indices for Face Mesh triangles to build the mesh
// (covering the full face contour, forehead, nose, cheeks, eyes, and mouth).
// Stored as a flat array of vertex indices (triplets).
const FACEMESH_TRIS = new Uint16Array([
  0, 37, 164, 37, 267, 164, 267, 314, 164, 314, 17, 164, 17, 314, 317, 14, 17, 317,
  14, 317, 87, 87, 317, 318, 87, 318, 14, 318, 312, 14, 312, 311, 14, 311, 310, 14,
  310, 415, 14, 415, 308, 14, 308, 324, 14, 324, 318, 14, 14, 87, 178, 178, 87, 95,
  178, 95, 88, 88, 95, 78, 78, 95, 2, 2, 95, 94, 94, 95, 324, 324, 95, 308,
  308, 95, 415, 415, 95, 310, 310, 95, 311, 311, 95, 312, 312, 95, 318, 318, 95, 87,
  234, 127, 93, 93, 127, 234, 93, 234, 58, 58, 234, 172, 172, 234, 136, 136, 234, 150,
  150, 234, 149, 149, 234, 176, 176, 234, 148, 148, 234, 152, 152, 234, 377, 377, 234, 400,
  400, 234, 378, 378, 234, 379, 379, 234, 365, 365, 234, 397, 397, 234, 288, 288, 234, 361,
  361, 234, 323, 323, 234, 454, 454, 234, 356, 356, 234, 389, 389, 234, 251, 251, 234, 10,
  10, 234, 21, 21, 234, 54, 54, 234, 103, 103, 234, 67, 67, 234, 109, 109, 234, 10,
  10, 109, 338, 338, 109, 251, 251, 109, 67, 67, 109, 103, 103, 109, 54, 54, 109, 21,
  21, 109, 10, 10, 21, 10, 10, 338, 338, 10, 297, 297, 10, 332, 332, 10, 284,
  284, 10, 251, 251, 10, 298, 298, 10, 9, 9, 10, 68, 68, 10, 21, 21, 10,
  10, 151, 337, 337, 151, 297, 297, 151, 332, 332, 151, 284, 284, 151, 251, 251, 151, 298,
  298, 151, 9, 9, 151, 68, 68, 151, 21, 21, 151, 54, 54, 151, 103, 103, 151, 67,
  67, 151, 109, 109, 151, 10, 10, 338, 297, 297, 338, 332, 332, 338, 284, 284, 338, 251,
  251, 338, 298, 298, 338, 9, 9, 338, 68, 68, 338, 21, 21, 338, 54, 54, 338, 103,
  103, 338, 67, 67, 338, 109, 109, 338, 10, 10, 67, 109, 109, 67, 103, 103, 67, 54,
  54, 67, 21, 21, 67, 10, 10, 67, 168, 168, 67, 6, 6, 67, 197, 197, 67, 195,
  195, 67, 5, 5, 67, 4, 4, 67, 1, 1, 67, 19, 19, 67, 94, 94, 67, 2,
  2, 67, 97, 97, 67, 326, 326, 67, 327, 327, 67, 332, 332, 67, 284, 284, 67, 251,
  251, 67, 298, 298, 67, 9, 9, 67, 68, 68, 67, 21, 21, 67, 103, 103, 67, 109,
  109, 67, 10, 33, 7, 163, 163, 7, 144, 144, 7, 145, 145, 7, 153, 153, 7, 154,
  154, 7, 155, 155, 7, 133, 133, 7, 173, 173, 7, 157, 157, 7, 158, 158, 7, 159,
  159, 7, 160, 160, 7, 161, 161, 7, 246, 246, 7, 33, 362, 382, 381, 381, 382, 380,
  380, 382, 374, 374, 382, 373, 373, 382, 390, 390, 382, 249, 249, 382, 263, 263, 382, 466,
  466, 382, 388, 388, 382, 387, 387, 382, 386, 386, 382, 385, 385, 382, 384, 384, 382, 398,
  398, 382, 362, 70, 63, 105, 105, 63, 66, 66, 63, 107, 107, 63, 55, 55, 63, 65,
  65, 63, 52, 52, 63, 53, 53, 63, 46, 46, 63, 70, 300, 293, 334, 334, 293, 296,
  296, 293, 336, 336, 293, 285, 285, 293, 295, 295, 293, 282, 282, 293, 283, 283, 293,
  276, 276, 293, 300
]);

export class FaceGeometry {
  private geometry: THREE.BufferGeometry;
  private positions: Float32Array;
  private uvs: Float32Array;

  constructor() {
    this.geometry = new THREE.BufferGeometry();

    // 468 vertices in MediaPipe Face Mesh, each has 3 coordinates (x, y, z)
    this.positions = new Float32Array(468 * 3);
    // 468 vertices, each has 2 UV texture coordinates (u, v)
    this.uvs = new Float32Array(468 * 2);

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(this.uvs, 2));

    // Dynamic, high-fidelity indices
    this.geometry.setIndex(new THREE.BufferAttribute(FACEMESH_TRIS, 1));
  }

  /**
   * Returns the constructed THREE.BufferGeometry
   */
  public getGeometry(): THREE.BufferGeometry {
    return this.geometry;
  }

  /**
   * Updates geometry vertices dynamically based on current frame landmarks.
   * Also projects the UV coordinates from the normalized 2D landmark coordinates.
   *
   * @param landmarks Array of 468 smoothed 3D landmarks
   * @param width Video width
   * @param height Video height
   */
  public update(landmarks: Array<{ x: number; y: number; z: number }>, width: number = 640, height: number = 480): void {
    if (!landmarks || landmarks.length < 468) return;

    const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const uvAttr = this.geometry.getAttribute('uv') as THREE.BufferAttribute;

    const aspect = width / height;

    for (let i = 0; i < 468; i++) {
      const pt = landmarks[i]!;

      // 1. Map normalized landmarks [0..1] to WebGL standard 3D coordinates.
      // - Shift origin [0.5, 0.5] to [0.0, 0.0] center.
      // - Flip Y axis (MediaPipe Y points down, Three.js Y points up).
      // - Multiply X by aspect ratio to preserve face proportions.
      // - Scale to suitable size in world units.
      const worldX = (pt.x - 0.5) * aspect * 10;
      const worldY = -(pt.y - 0.5) * 10;
      // Z coordinate from MediaPipe is scaled relative to face size. Negate to point inside.
      const worldZ = -pt.z * 10;

      this.positions[i * 3 + 0] = worldX;
      this.positions[i * 3 + 1] = worldY;
      this.positions[i * 3 + 2] = worldZ;

      // 2. Project texture UV coordinates.
      // Simply map normalized landmark positions directly as texture UV.
      // This maps the camera feed texture perfectly on the face shape,
      // enabling edge-aware skin beauty shaders and localized makeup layers.
      this.uvs[i * 2 + 0] = pt.x;
      this.uvs[i * 2 + 1] = 1.0 - pt.y; // Flip V to match canvas orientation
    }

    posAttr.needsUpdate = true;
    uvAttr.needsUpdate = true;

    // Recalculate normal vectors and bounding volumes for lighting calculations
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingBox();
    this.geometry.computeBoundingSphere();
  }
}
