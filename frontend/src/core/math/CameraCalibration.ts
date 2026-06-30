/**
 * CameraCalibration.ts
 *
 * Estimates webcam intrinsic parameters (focal length, field of view, principal point)
 * based on input viewport dimensions, and generates matching projection details for Three.js.
 * Also provides utilities to correct perspective or lens distortions.
 */

export interface CameraIntrinsics {
  fx: number; // Focal length X (in pixels)
  fy: number; // Focal length Y (in pixels)
  cx: number; // Principal point X (usually width / 2)
  cy: number; // Principal point Y (usually height / 2)
  fov: number; // Vertical Field of View (in degrees)
  aspect: number; // Aspect ratio (width / height)
}

export class CameraCalibration {
  private width: number = 640;
  private height: number = 480;

  constructor() {}

  /**
   * Compute camera intrinsics for a given video/viewport dimension.
   * Assumes a standard webcam focal length factor of ~0.8 to 1.0 times the width.
   *
   * @param width Video frame width in pixels
   * @param height Video frame height in pixels
   */
  public getIntrinsics(width: number, height: number): CameraIntrinsics {
    this.width = width;
    this.height = height;

    const aspect = width / height;

    // Estimate focal length (in pixels). Standard webcams have a diagonal FOV of ~60-70 degrees,
    // which corresponds to a focal length of ~0.8 * width.
    const fx = width * 0.82;
    const fy = fx; // Square pixels assumption

    // Principal point: center of the image plane
    const cx = width / 2;
    const cy = height / 2;

    // Calculate vertical FOV in degrees: FOV = 2 * arctan(height / (2 * fy))
    const fov = 2 * Math.atan(height / (2 * fy)) * (180 / Math.PI);

    return {
      fx,
      fy,
      cx,
      cy,
      fov: Number(fov.toFixed(2)),
      aspect
    };
  }

  /**
   * Applies the estimated camera intrinsics to configure a Three.js PerspectiveCamera.
   * This aligns the 3D WebGL render space viewport with the camera's real physical projection.
   *
   * @param camera Three.js PerspectiveCamera instance
   * @param width Viewport width
   * @param height Viewport height
   */
  public calibrateThreeCamera(camera: any, width: number, height: number): void {
    const intrinsics = this.getIntrinsics(width, height);
    camera.fov = intrinsics.fov;
    camera.aspect = intrinsics.aspect;
    camera.updateProjectionMatrix();

    // Position camera at z = 10 to match the normalized 10 units scale of the face mesh and accessories
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
  }

  /**
   * Solves a simplified barrel distortion correction factor.
   * Standard barrel distortion: r_distorted = r * (1 + k1 * r^2 + k2 * r^4)
   */
  public getBarrelCorrectionShaderUniforms(k1: number = -0.05, k2: number = 0.01) {
    return {
      uDistortionK1: { value: k1 },
      uDistortionK2: { value: k2 }
    };
  }
}

export const cameraCalibration = new CameraCalibration();
export default cameraCalibration;
