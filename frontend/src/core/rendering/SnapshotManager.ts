import * as THREE from 'three';

export class SnapshotManager {
  /**
   * Captures the current rendering canvas at its existing screen resolution.
   */
  public static capture(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, format: 'image/jpeg' | 'image/png' = 'image/jpeg'): string {
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL(format, format === 'image/jpeg' ? 0.95 : undefined);
  }

  /**
   * Captures the canvas at high definition (1080p, 1440p, 4K) by temporarily resizing
   * the WebGL viewport and aspect ratios.
   */
  public static captureHD(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number,
    format: 'image/jpeg' | 'image/png' = 'image/jpeg'
  ): string {
    // 1. Store original viewport dimensions
    const originalSize = new THREE.Vector2();
    renderer.getSize(originalSize);
    const originalPixelRatio = renderer.getPixelRatio();
    const originalAspect = camera.aspect;

    // 2. Temporarily resize to target HD resolution
    renderer.setPixelRatio(1); // Force exact pixel dimensions
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // 3. Render frame
    renderer.render(scene, camera);

    // 4. Capture raw data URL
    const dataUrl = renderer.domElement.toDataURL(format, format === 'image/jpeg' ? 0.95 : undefined);

    // 5. Restore original renderer state
    renderer.setPixelRatio(originalPixelRatio);
    renderer.setSize(originalSize.x, originalSize.y, false);
    camera.aspect = originalAspect;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera); // redraw standard frame

    return dataUrl;
  }

  /**
   * Captures a snapshot with transparent background (removes video background plane temporarily).
   */
  public static captureTransparent(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    bgMesh: THREE.Mesh
  ): string {
    // Hide webcam background mesh
    const originalVisible = bgMesh.visible;
    bgMesh.visible = false;

    // Set clear alpha to 0
    const originalClearAlpha = renderer.getClearAlpha();
    renderer.setClearAlpha(0);

    // Render frame
    renderer.render(scene, camera);

    // Capture PNG to preserve transparency channel
    const dataUrl = renderer.domElement.toDataURL('image/png');

    // Restore state
    bgMesh.visible = originalVisible;
    renderer.setClearAlpha(originalClearAlpha);
    renderer.render(scene, camera);

    return dataUrl;
  }

  /**
   * Triggers client-side browser file download.
   */
  public static download(dataUrl: string, filename: string): void {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Helper to convert a DataURL string back to a Blob object.
   */
  public static dataURLtoBlob(dataUrl: string): Blob {
    const arr = dataUrl.split(',');
    const match = arr[0].match(/:(.*?);/);
    const mime = match ? match[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  /**
   * Prepares and uploads snapshot to Django/backend try-on endpoint.
   */
  public static async upload(
    dataUrl: string,
    uploadFn: (file: File) => Promise<any>,
    filename = 'live_look.jpg'
  ): Promise<any> {
    const blob = this.dataURLtoBlob(dataUrl);
    const file = new File([blob], filename, { type: blob.type });
    return uploadFn(file);
  }
}

export default SnapshotManager;
