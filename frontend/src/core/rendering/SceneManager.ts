/**
 * SceneManager.ts
 *
 * Orchestrates the WebGL 3D AR Try-On experience:
 * - Reconstructs Vector3, Quaternion, and Matrix4 coordinates from TypedArrays.
 * - Leverages AccessoryRegistry to instantiate and update plugins from JSON configurations.
 * - Adjusts PBR material roughness and environment mapping dynamically.
 * - Prevents runtime memory allocations using static scratch pools.
 */

import * as THREE from 'three';
import { CameraCalibration } from '../math/CameraCalibration';
import { OcclusionManager } from './OcclusionManager';
import { ShadowGenerator } from './ShadowGenerator';
import { AccessoryManager } from '../accessories/AccessoryManager';
import { blendshapeManager } from '../tracking/BlendshapeManager';
import { performanceManager } from './PerformanceManager';
import { SnapshotManager } from './SnapshotManager';
import { assetLoader } from '../../tracking/AssetLoader';

export class SceneManager {
  private container: HTMLCanvasElement;
  private videoElement: HTMLVideoElement;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  
  // Video Background Plane
  private videoTexture: THREE.VideoTexture;
  private bgMesh: THREE.Mesh;

  // Lights & Environment
  private ambientLight: THREE.AmbientLight;
  private dirLight: THREE.DirectionalLight;
  private pmremGenerator: THREE.PMREMGenerator;
  private envMap: THREE.Texture | null = null;

  // Upgraded Core Modules
  private cameraCalibration = new CameraCalibration();
  private occlusionManager: OcclusionManager;
  
  // Group for placing accessories relative to head coordinates
  private headGroup: THREE.Group;

  // Physics simulation variables
  private lastTime: number = performance.now();
  private physicsCallbacks: Array<(dt: number) => void> = [];

  private accessoryManager: AccessoryManager;

  // ==========================================
  // STATIC REUSABLE MEMORY POOLS (GC-FREE)
  // ==========================================
  private static scratchPos = new THREE.Vector3();
  private static scratchQuat = new THREE.Quaternion();
  private static scratchScale = new THREE.Vector3();
  private static headMatrixInverse = new THREE.Matrix4();

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
    this.renderer.setSize(canvas.width, canvas.height, false);
    canvas.style.removeProperty('width');
    canvas.style.removeProperty('height');
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
    this.bgMesh.position.set(0, 0, -9.9); // Place far back
    this.camera.add(this.bgMesh); // Bind background to camera movement

    // 5. Setup Occlusion Manager (encapsulates face geometry and depth masking)
    this.occlusionManager = new OcclusionManager(this.headGroup);

    // 6. Setup PMREMGenerator for reflection environment mapping
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremGenerator.compileEquirectangularShader();

    // 7. Setup Lights
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.dirLight.position.set(0, 5, 5);
    this.scene.add(this.dirLight);

    new ShadowGenerator(this.renderer, this.dirLight);

    // 8. Initialize accessory manager (registry orchestrator)
    this.accessoryManager = new AccessoryManager(this.headGroup, this);

    this.generateDefaultEnvMap();
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

      // Propagate environmental mapping
      assetLoader.setEnvMap(this.envMap);
      this.accessoryManager.setEnvMap(this.envMap);
    };
  }

  /**
   * Sets custom beauty/makeup materials on the face mesh.
   */
  public setFaceMaterial(material: THREE.Material | null) {
    this.occlusionManager.setFaceMaterial(material);
  }

  /**
   * Register a physics spring tick handler.
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
   * Runtime accessory hooks delegation
   */
  public async applyAccessory(category: string, item: any): Promise<boolean> {
    return this.accessoryManager.loadAccessory(category, item);
  }

  public updateAccessoryConfig(category: string, config: any): void {
    this.accessoryManager.updateConfig(category, config);
  }

  public removeAccessory(category: string): void {
    this.accessoryManager.removeAccessory(category);
  }

  public clearAccessories(): void {
    this.accessoryManager.removeAll();
  }

  /**
   * Captures screen snapshot using SnapshotManager.
   */
  public captureSnapshot(format: 'image/jpeg' | 'image/png' = 'image/jpeg', width?: number, height?: number): string {
    if (width && height) {
      return SnapshotManager.captureHD(this.renderer, this.scene, this.camera, width, height, format);
    }
    return SnapshotManager.capture(this.renderer, this.scene, this.camera, format);
  }

  public captureTransparentSnapshot(): string {
    return SnapshotManager.captureTransparent(this.renderer, this.scene, this.camera, this.bgMesh);
  }

  /**
   * Returns active diagnostics details.
   */
  public getDiagnostics() {
    const accDiag = this.accessoryManager.getDiagnostics();
    const pos = this.headGroup.position;
    const quat = this.headGroup.quaternion;
    const scl = this.headGroup.scale;

    return {
      ...accDiag,
      pose: { x: pos.x, y: pos.y, z: pos.z },
      quaternion: { x: quat.x, y: quat.y, z: quat.z, w: quat.w },
      scale: { x: scl.x, y: scl.y, z: scl.z }
    };
  }

  /**
   * Adjusts material PBR settings based on luma brightness.
   *
   * @param luma Estimated luma brightness [0.6..1.6]
   */
  public adjustMaterialLighting(luma: number): void {
    // 1. Exposure and light scaling
    const exposure = 0.8 + (luma - 0.6) * 0.4;
    this.renderer.toneMappingExposure = Math.max(0.6, Math.min(1.4, exposure));
    
    // Scale shadows and light intensities
    const pSettings = performanceManager.getSettings();
    const showShadows = pSettings.enableShadows;
    this.dirLight.castShadow = showShadows && (luma > 0.7);

    // 2. Adjust active accessory materials
    const activePlugins = this.accessoryManager.getRegistry().getActivePlugins();
    for (const plugin of activePlugins.values()) {
      const model = (plugin as any).currentModel;
      if (model) {
        model.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh) {
            const mat = child.material as THREE.MeshStandardMaterial;
            if (mat) {
              // Brighter environment reflection in outdoor/bright scenes
              mat.envMapIntensity = luma * 1.15;
              
              // Slightly make metallic objects shinier in bright conditions
              if (luma > 1.25) {
                mat.roughness = Math.max(0.05, mat.roughness - 0.12);
              } else if (luma < 0.85) {
                mat.roughness = Math.min(0.95, mat.roughness + 0.10);
              }
            }
          }
        });
      }
    }
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

    // Force upload current video frame to GPU texture
    this.videoTexture.needsUpdate = true;

    // A. Perform Camera Calibration matrix adjustments
    this.cameraCalibration.calibrateThreeCamera(this.camera, width, height);

    // B. Re-scale Background plane to cover camera field of view exactly
    const dist = 9.9; // camera distance
    const fovRad = (this.camera.fov * Math.PI) / 180;
    const bgH = 2 * Math.tan(fovRad / 2) * dist;
    const bgW = bgH * this.camera.aspect;
    this.bgMesh.scale.set(bgW / 2, bgH / 2, 1);

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1); // clamp to avoid spikes
    this.lastTime = now;

    if (telemetry && telemetry.faceDetected && telemetry.pose) {
      // 1. Reconstruct head position and quaternion rotation from TypedArrays (GC-Free)
      const posVec = SceneManager.scratchPos.fromArray(telemetry.pose.position);
      const quatVec = SceneManager.scratchQuat.fromArray(telemetry.pose.quaternion);
      const scaleVec = SceneManager.scratchScale.fromArray(telemetry.pose.scale || [1, 1, 1]);

      // Copy values directly
      this.headGroup.position.copy(posVec);
      this.headGroup.quaternion.copy(quatVec);
      this.headGroup.scale.copy(scaleVec);
      this.headGroup.visible = true;

      // 2. Compose and invert local head matrix
      const headMatrixInverse = SceneManager.headMatrixInverse.compose(posVec, quatVec, scaleVec).invert();

      // 3. Update occlusion mesh and face geometry (respect performance scaling)
      const pSettings = performanceManager.getSettings();
      if (performanceManager.shouldUpdateThisFrame(pSettings.occlusionUpdateInterval)) {
        this.occlusionManager.update(telemetry.landmarks, width, height, headMatrixInverse);
      }

      // 4. Update the BlendshapeManager coefficients
      if (telemetry.blendshapes && performanceManager.shouldUpdateThisFrame(pSettings.blendshapeUpdateInterval)) {
        const rawBlendshapes = Object.keys(telemetry.blendshapes).map(key => ({
          categoryName: key,
          score: telemetry.blendshapes[key]
        }));
        blendshapeManager.update(rawBlendshapes);
      }

      // 5. Extract jaw open score
      const jawOpenScore = telemetry.blendshapes?.jawOpen ?? 0;

      // 6. Propagate anchors, biometrics, and animation step details to accessories
      this.accessoryManager.update({
        anchors: telemetry.anchors,
        biometrics: telemetry.biometrics,
        jawOpenScore,
        blendshapes: telemetry.blendshapes,
        dt,
        width,
        height
      });

      if (this.helpersGroup && this.helpersGroup.visible) {
        this.setShowHelpers(true, telemetry);
      }
    } else {
      // Fade/Hide meshes if lost tracking
      this.occlusionManager.setVisible(false);
      this.headGroup.visible = false;
    }

    // C. Step spring physics simulations
    this.physicsCallbacks.forEach(cb => cb(dt));

    // E. Render main WebGL frame
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Get the active video texture feed.
   */
  public getVideoTexture(): THREE.VideoTexture {
    return this.videoTexture;
  }

  /**
   * Toggle visibility of the face wireframe helper.
   */
  private wireframeMesh: THREE.Mesh | null = null;
  public setShowMesh(show: boolean): void {
    if (show) {
      if (!this.wireframeMesh) {
        const wireframeMat = new THREE.MeshBasicMaterial({
          color: 0x6366f1, // Indigo-500
          wireframe: true,
          transparent: true,
          opacity: 0.4
        });
        const geom = this.occlusionManager.getFaceGeometry().getGeometry();
        this.wireframeMesh = new THREE.Mesh(geom, wireframeMat);
        this.headGroup.add(this.wireframeMesh);
      }
      this.wireframeMesh.visible = true;
    } else if (this.wireframeMesh) {
      this.wireframeMesh.visible = false;
    }
  }

  private createTextSprite(text: string, color: string = '#6366f1'): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'; // slate-900 background
      ctx.fillRect(0, 0, 128, 32);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(1, 1, 126, 30);
      ctx.fillStyle = '#f8fafc'; // slate-50 text
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 64, 16);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.5, 0.125, 1);
    return sprite;
  }

  private helpersGroup: THREE.Group | null = null;
  public setShowHelpers(show: boolean, telemetry?: any): void {
    if (show) {
      if (!this.helpersGroup) {
        this.helpersGroup = new THREE.Group();
        this.headGroup.add(this.helpersGroup);
      }
      this.helpersGroup.clear();

      // A. Draw Bounding Boxes and Pivots of active accessories
      const activePlugins = this.accessoryManager.getRegistry().getActivePlugins();
      for (const plugin of activePlugins.values()) {
        const model = (plugin as any).currentModel;
        if (model && model.visible) {
          const boxHelper = new THREE.BoxHelper(model, 0x00ff00);
          this.helpersGroup.add(boxHelper);
          
          const axesHelper = new THREE.AxesHelper(0.3);
          axesHelper.position.copy(model.position);
          this.helpersGroup.add(axesHelper);

          // Add Pivot Label
          const pivotLabel = this.createTextSprite(`PIVOT: ${(plugin as any).category}`, '#10b981');
          pivotLabel.position.copy(model.position).y += 0.15;
          this.helpersGroup.add(pivotLabel);
        }
      }

      if (telemetry) {
        // B. Draw Head Origin [0, 0, 0] in local coordinates
        const originGeo = new THREE.SphereGeometry(0.03, 8, 8);
        const originMat = new THREE.MeshBasicMaterial({ color: 0xef4444, depthTest: false, depthWrite: false });
        const originMesh = new THREE.Mesh(originGeo, originMat);
        originMesh.position.set(0, 0, 0);
        this.helpersGroup.add(originMesh);

        const originAxes = new THREE.AxesHelper(0.4);
        this.helpersGroup.add(originAxes);

        const originLabel = this.createTextSprite('HEAD ORIGIN', '#ef4444');
        originLabel.position.set(0, 0.2, 0);
        this.helpersGroup.add(originLabel);

        // C. Draw Anchors
        if (telemetry.anchors) {
          for (const key of Object.keys(telemetry.anchors)) {
            const anchor = telemetry.anchors[key];
            if (anchor && anchor.position) {
              const aPos = new THREE.Vector3().fromArray(anchor.position);
              
              // Draw anchor dot
              const anchorGeo = new THREE.SphereGeometry(0.015, 8, 8);
              const anchorMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, depthTest: false, depthWrite: false });
              const anchorMesh = new THREE.Mesh(anchorGeo, anchorMat);
              anchorMesh.position.copy(aPos);
              this.helpersGroup.add(anchorMesh);

              // Draw label
              const labelText = `ANCHOR: ${key}`;
              const labelSprite = this.createTextSprite(labelText, '#3b82f6');
              labelSprite.position.copy(aPos).y += 0.08;
              this.helpersGroup.add(labelSprite);
            }
          }
        }

        // D. Draw Key Landmark Index Numbers
        if (telemetry.landmarks && telemetry.landmarks.length > 0) {
          const keyIndices = [10, 151, 152, 234, 454, 33, 263, 6, 172, 397, 13];
          const labelsMap: Record<number, string> = {
            10: '10: Hairline',
            151: '151: Glabella',
            152: '152: Chin',
            234: '234: L Ear',
            454: '454: R Ear',
            33: '33: L Eye',
            263: '263: R Eye',
            6: '6: Nose',
            172: '172: L Jaw',
            397: '397: R Jaw',
            13: '13: Lips'
          };
          const aspect = (this.container.width || 640) / (this.container.height || 480);
          
          for (const idx of keyIndices) {
            const pt = telemetry.landmarks[idx];
            if (pt) {
              // Convert landmark to local coordinates
              const worldPt = new THREE.Vector3(
                (pt.x - 0.5) * aspect * 10,
                -(pt.y - 0.5) * 10,
                -pt.z * 10
              );
              
              // Localize by applying headMatrixInverse
              worldPt.applyMatrix4(SceneManager.headMatrixInverse);

              // Draw point
              const dotGeo = new THREE.SphereGeometry(0.012, 6, 6);
              const dotMat = new THREE.MeshBasicMaterial({ color: 0x8b5cf6, depthTest: false, depthWrite: false });
              const dotMesh = new THREE.Mesh(dotGeo, dotMat);
              dotMesh.position.copy(worldPt);
              this.helpersGroup.add(dotMesh);

              // Draw index label
              const text = labelsMap[idx] || String(idx);
              const labelSprite = this.createTextSprite(text, '#8b5cf6');
              labelSprite.position.copy(worldPt).y += 0.05;
              this.helpersGroup.add(labelSprite);
            }
          }
        }
      }

      this.helpersGroup.visible = true;
    } else if (this.helpersGroup) {
      this.helpersGroup.visible = false;
    }
  }

  /**
   * Adjusts directional and ambient light values in real time.
   */
  public setLighting(intensity: number, shadowStrength: number): void {
    const pSettings = performanceManager.getSettings();
    
    // Scale light intensity
    this.dirLight.intensity = intensity * 1.2;
    this.ambientLight.intensity = intensity * 0.95;
    
    // Toggle shadow casting dynamically based on performance monitor
    this.dirLight.castShadow = pSettings.enableShadows && shadowStrength > 0.05;
    this.dirLight.shadow.bias = -0.0005 * shadowStrength;
  }

  /**
   * Disposes renderer and environment assets.
   */
  public dispose(): void {
    this.pmremGenerator.dispose();
    if (this.envMap) this.envMap.dispose();
    this.videoTexture.dispose();
    if (this.wireframeMesh) {
      this.headGroup.remove(this.wireframeMesh);
      this.wireframeMesh.geometry.dispose();
      (this.wireframeMesh.material as THREE.Material).dispose();
    }
    if (this.helpersGroup) {
      this.headGroup.remove(this.helpersGroup);
      this.helpersGroup.clear();
    }
    this.occlusionManager.dispose();
    this.accessoryManager.dispose();
    this.renderer.dispose();
  }
}

export default SceneManager;
