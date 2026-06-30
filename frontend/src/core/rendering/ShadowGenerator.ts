/**
 * ShadowGenerator.ts
 *
 * Configures high-quality soft shadow mapping parameters on the Three.js
 * WebGLRenderer and DirectionalLight to blend 3D assets realistically with the user's face.
 */

import * as THREE from 'three';

export class ShadowGenerator {
  constructor(renderer: THREE.WebGLRenderer, light: THREE.DirectionalLight) {
    // 1. Enable soft shadow maps on renderer
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 2. Configure Directional Light shadow projections
    light.castShadow = true;
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;
    
    // Near & far bounds enclosing the face coordinate spaces
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 25;
    
    // Tight orthographic projection bounds to focus shadow resolution around the face
    const d = 4;
    light.shadow.camera.left = -d;
    light.shadow.camera.right = d;
    light.shadow.camera.top = d;
    light.shadow.camera.bottom = -d;

    // Adjust shadow bias to avoid self-shadowing artifacts (acne/noise) on the face mesh
    light.shadow.bias = -0.0005;
  }
}

export default ShadowGenerator;
