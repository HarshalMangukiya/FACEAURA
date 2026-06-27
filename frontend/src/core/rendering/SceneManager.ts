/**
 * SceneManager.ts
 *
 * The main WebGL orchestrator for the 3D AR Try-On experience.
 * Manages:
 * - Three.js WebGLRenderer, PerspectiveCamera, and Scene.
 * - Webcam background plane with a dynamic VideoTexture.
 * - Dynamic HDR lighting using a PMREMGenerator environment map and directional shadows.
 * - Face mesh instance (FaceGeometry) for occlusion, beauty, and makeup shaders.
 * - spring-mass physics updates for swinging accessories (earrings, necklaces, hair physics).
 */

import * as THREE from 'three';
import { FaceGeometry } from './FaceGeometry';
import { CameraCalibration } from '../math/CameraCalibration';
import { PoseEstimator } from '../pose/PoseEstimator';
import { OneEuroFilter3D } from '../math/OneEuroFilter';

export class SceneManager {
  private container: HTMLCanvasElement;
  private videoElement: HTMLVideoElement;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  
  // Video Background Plane
  private videoTexture: THREE.VideoTexture;
  private bgMesh: THREE.Mesh;

  // Face Tracking Mesh
  private faceGeometry: FaceGeometry;
  private faceMesh: THREE.Mesh;
  private occlusionMaterial: THREE.Material;

  // Lights & Environment
  private ambientLight: THREE.AmbientLight;
  private dirLight: THREE.DirectionalLight;
  private pmremGenerator: THREE.PMREMGenerator;
  private envMap: THREE.Texture | null = null;

  // Services
  private cameraCalibration = new CameraCalibration();
  private poseEstimator = new PoseEstimator();
  private poseFilter = new OneEuroFilter3D(1.2, 0.005);

  // Group for placing accessories relative to head coordinates
  private headGroup: THREE.Group;

  // Physics simulation variables
  private lastTime: number = performance.now();
  private physicsCallbacks: Array<(dt: number) => void> = [];

  constructor(canvas: HTMLCanvasElement, video: HTMLVideoElement) {
    this.container = canvas;
    this.videoElement = video;

    // 1. Initialize WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.container,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true // Required for capturing snapshots
    });
    this.renderer.setSize(canvas.width, canvas.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 2. Initialize Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, canvas.width / canvas.height, 0.1, 1000);
    this.scene.add(this.camera);

    // 3. Create head pivot group (for attaching accessories)
    this.headGroup = new THREE.Group();
    this.scene.add(this.headGroup);

    // 4. Initialize dynamic video background texture & plane
    this.videoTexture = new THREE.VideoTexture(this.videoElement);
    this.videoTexture.colorSpace = THREE.SRGBColorSpace;

    const bgGeom = new THREE.PlaneGeometry(2, 2);
    const bgMat = new THREE.MeshBasicMaterial({
      map: this.videoTexture,
      depthWrite: false,
      depthTest: false
    });
    this.bgMesh = new THREE.Mesh(bgGeom, bgMat);
    // Align background mesh to clip space plane
    this.bgMesh.position.set(0, 0, -99); // Place far back
    this.camera.add(this.bgMesh); // Bind background to camera movement

    // 5. Initialize 3D Face Geometry & Materials
    this.faceGeometry = new FaceGeometry();

    // Occlusion material: invisible, but writes to depth buffer to mask objects behind the face
    this.occlusionMaterial = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: true,
      transparent: false
    });

    this.faceMesh = new THREE.Mesh(this.faceGeometry.getGeometry(), this.occlusionMaterial);
    // Add face mesh to head group so it deforms and rotates with head movement
    this.headGroup.add(this.faceMesh);

    // 6. Setup PMREMGenerator for reflection environment mapping
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremGenerator.compileEquirectangularShader();
    this.generateDefaultEnvMap();

    // 7. Setup Lights
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.dirLight.position.set(0, 5, 5);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.bias = -0.001;
    this.scene.add(this.dirLight);
  }

  /**
   * Set dynamic HDR exposure configurations.
   */
  public setExposure(exposure: number) {
    this.renderer.toneMappingExposure = exposure;
  }

  /**
   * Generates a neutral gradient HDRI environment map for reflections.
   */
  private generateDefaultEnvMap() {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8AARAwMjDAGMAcYAAP5AgWPAj1cAAAAAElFTkSuQmCC';
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.needsUpdate = true;
      const cubeRenderTarget = this.pmremGenerator.fromCubemap(new THREE.CubeTexture([tex, tex, tex, tex, tex, tex]));
      this.envMap = cubeRenderTarget.texture;
      this.scene.environment = this.envMap;
    };
  }

  /**
   * Sets custom beauty/makeup materials on the face mesh.
   */
  public setFaceMaterial(material: THREE.Material | null) {
    if (material) {
      this.faceMesh.material = material;
    } else {
      this.faceMesh.material = this.occlusionMaterial;
    }
  }

  /**
   * Register a physics spring tick handler (e.g. for dynamic hair/earrings).
   */
  public registerPhysicsCallback(cb: (dt: number) => void) {
    this.physicsCallbacks.push(cb);
  }

  /**
   * Returns the main Three scene, camera, head group, and environment texture.
   */
  public getRenderContext() {
    return {
      scene: this.scene,
      camera: this.camera,
      headGroup: this.headGroup,
      envMap: this.envMap,
      renderer: this.renderer
    };
  }

  /**
   * Updates face pose estimation, adjusts geometry and camera matrices,
   * fires physics damping, and draws WebGL overlays.
   *
   * @param telemetry Telemetry data from face tracker
   */
  public render(telemetry: any): void {
    const width = this.container.width || 640;
    const height = this.container.height || 480;

    // A. Perform Camera Calibration matrix adjustments
    this.cameraCalibration.calibrateThreeCamera(this.camera, width, height);

    // B. Re-scale Background plane to cover camera field of view exactly
    const dist = 99; // camera distance
    const fovRad = (this.camera.fov * Math.PI) / 180;
    const bgH = 2 * Math.tan(fovRad / 2) * dist;
    const bgW = bgH * this.camera.aspect;
    this.bgMesh.scale.set(bgW / 2, bgH / 2, 1);

    if (telemetry && telemetry.faceDetected && telemetry.landmarks && telemetry.landmarks.length > 0) {
      // 1. Solve head pose translation/rotation
      const rawPose = this.poseEstimator.estimatePose(
        telemetry.landmarks,
        telemetry.facialTransformationMatrix,
        telemetry.blendshapes,
        width,
        height
      );

      // 2. Filter pose rotations to isolate tracking micro-jitters
      const filteredPos = this.poseFilter.filter(rawPose.position, performance.now());
      
      // Update head pivot positions
      this.headGroup.position.copy(filteredPos);
      this.headGroup.quaternion.copy(rawPose.quaternion);

      // 3. Update the Face mesh geometry coordinates
      this.faceGeometry.update(telemetry.landmarks, width, height);
      this.faceMesh.visible = true;
    } else {
      // Fade/Hide face mesh if lost tracking
      this.faceMesh.visible = false;
    }

    // C. Step spring physics simulations
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1); // clamp to avoid spikes
    this.lastTime = now;
    
    this.physicsCallbacks.forEach(cb => cb(dt));

    // D. Render main WebGL frame
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Disposes renderer and environment assets.
   */
  public dispose(): void {
    this.pmremGenerator.dispose();
    if (this.envMap) this.envMap.dispose();
    this.videoTexture.dispose();
    this.renderer.dispose();
  }
}
export default SceneManager;
