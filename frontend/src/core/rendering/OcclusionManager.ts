/**
 * OcclusionManager.ts
 *
 * Manages the depth-masking (occlusion) system and the 3D face mesh overlays.
 *
 * Roles:
 * 1. Creates and maintains the FaceGeometry instance mapped to 468/478 landmarks.
 * 2. Creates the invisible occluder mesh, setting renderOrder = 0 with depthWrite enabled
 *    and colorWrite disabled. This masks accessories passing behind the head (e.g. glasses temple arms).
 * 3. Creates the secondary face mesh for makeup shaders and beauty smoothing (renderOrder = 1).
 */

import * as THREE from 'three';
import { FaceGeometry } from './FaceGeometry';

export class OcclusionManager {
  private faceGeometry: FaceGeometry;
  private occluderMesh: THREE.Mesh;
  private faceMesh: THREE.Mesh;
  private headGroup: THREE.Group;

  constructor(headGroup: THREE.Group) {
    this.headGroup = headGroup;

    // 1. Initialize core deformable FaceGeometry
    this.faceGeometry = new FaceGeometry();

    // 2. Initialize invisible depth occluding mesh
    const occlusionMaterial = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: true,
      transparent: false
    });

    this.occluderMesh = new THREE.Mesh(this.faceGeometry.getGeometry(), occlusionMaterial);
    this.occluderMesh.renderOrder = 0; // Render first to fill the depth buffer
    this.headGroup.add(this.occluderMesh);

    // 3. Initialize face mesh for shaders (beauty, makeup, filters)
    const baseFaceMaterial = new THREE.MeshBasicMaterial({ visible: false });
    this.faceMesh = new THREE.Mesh(this.faceGeometry.getGeometry(), baseFaceMaterial);
    this.faceMesh.renderOrder = 1; // Render after the depth mask
    this.headGroup.add(this.faceMesh);
  }

  /**
   * Updates face mesh coordinate vertices and normals relative to the head transform.
   *
   * @param landmarks Array of smoothed landmarks
   * @param width Video frame width
   * @param height Video frame height
   * @param headMatrixInverse Inverse head transformation matrix to localize vertices
   */
  public update(
    landmarks: any[],
    width: number,
    height: number,
    headMatrixInverse: THREE.Matrix4
  ): void {
    if (!landmarks || landmarks.length === 0) {
      this.occluderMesh.visible = false;
      this.faceMesh.visible = false;
      return;
    }

    this.occluderMesh.visible = true;
    this.faceGeometry.update(landmarks, width, height, headMatrixInverse);
  }

  /**
   * Sets custom material (like makeup shaders) on the face mesh.
   */
  public setFaceMaterial(material: THREE.Material | null): void {
    if (material) {
      this.faceMesh.material = material;
      this.faceMesh.visible = true;
    } else {
      this.faceMesh.visible = false;
    }
  }

  /**
   * Toggles visibility of the entire occlusion system.
   */
  public setVisible(visible: boolean): void {
    this.occluderMesh.visible = visible;
    if (!visible) {
      this.faceMesh.visible = false;
    }
  }

  /**
   * Returns the primary FaceGeometry instance.
   */
  public getFaceGeometry(): FaceGeometry {
    return this.faceGeometry;
  }

  /**
   * Disposes mesh geometries and materials.
   */
  public dispose(): void {
    this.headGroup.remove(this.occluderMesh);
    this.headGroup.remove(this.faceMesh);

    this.occluderMesh.geometry.dispose();
    (this.occluderMesh.material as THREE.Material).dispose();

    this.faceMesh.geometry.dispose();
    if (Array.isArray(this.faceMesh.material)) {
      this.faceMesh.material.forEach((m) => m.dispose());
    } else {
      this.faceMesh.material.dispose();
    }
  }
}

export default OcclusionManager;
