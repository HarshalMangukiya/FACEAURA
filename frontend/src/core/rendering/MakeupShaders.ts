/**
 * MakeupShaders.ts
 *
 * Houses custom WebGL Vertex and Fragment shaders for rendering localized, realistic
 * makeup effects (Lipstick, Foundation, Blush, Contour, Eyeshadow) on the 3D FaceGeometry.
 * Utilizes dynamic uniforms for landmark feature points to locate lips, cheeks, and eyes.
 */

import * as THREE from 'three';

// Vertex Shader: Projects face vertices and passes UVs, normals, and positions
const vertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Fragment Shader: Blends camera feed with multiple makeup layers using alpha masks and lighting
const fragmentShader = `
  uniform sampler2D uVideoTexture;
  
  // Lipstick Uniforms
  uniform vec3 uLipstickColor;
  uniform float uLipstickOpacity;
  uniform float uLipstickGloss; // Specular shininess
  
  // Blush Uniforms
  uniform vec3 uBlushColor;
  uniform float uBlushOpacity;
  uniform vec2 uLeftCheekCenter;
  uniform vec2 uRightCheekCenter;
  uniform float uBlushRadius;

  // Foundation & Skin Brightening Uniforms
  uniform vec3 uFoundationColor;
  uniform float uFoundationOpacity;
  uniform float uSkinBrightening;

  // Shadow / Contour Uniforms
  uniform float uContourOpacity;
  uniform vec2 uLeftContourCenter;
  uniform vec2 uRightContourCenter;

  // Eye Shadow Uniforms
  uniform vec3 uShadowColor;
  uniform float uShadowOpacity;
  uniform vec2 uLeftEyeCenter;
  uniform vec2 uRightEyeCenter;

  // Lips Boundary Coordinates (passed to isolate lips)
  uniform vec2 uLipBoundsMin;
  uniform vec2 uLipBoundsMax;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  // Helper: calculate distance to line segment (for lip contouring)
  float distToSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
  }

  void main() {
    // 1. Sample original camera frame texture at this UV location
    vec4 baseColor = texture2D(uVideoTexture, vUv);
    vec3 finalColor = baseColor.rgb;

    // 2. APPLY FOUNDATION (All skin area - base layer)
    // Foundation is applied softly across the face geometry to even skin tone
    if (uFoundationOpacity > 0.0) {
      // Skin brightening factor
      vec3 foundationColor = mix(uFoundationColor, vec3(1.0), uSkinBrightening * 0.15);
      finalColor = mix(finalColor, foundationColor, uFoundationOpacity * 0.35);
    }

    // 3. APPLY BLUSH (cheeks)
    // Soft radial gradient falloff centered on cheeks landmarks
    if (uBlushOpacity > 0.0) {
      float distL = distance(vUv, uLeftCheekCenter);
      float distR = distance(vUv, uRightCheekCenter);
      
      float weightL = smoothstep(uBlushRadius, 0.0, distL);
      float weightR = smoothstep(uBlushRadius, 0.0, distR);
      float blushWeight = max(weightL, weightR);

      finalColor = mix(finalColor, uBlushColor, blushWeight * uBlushOpacity * 0.4);
    }

    // 4. APPLY CONTOUR (shadows along cheek hollows)
    if (uContourOpacity > 0.0) {
      float distL = distance(vUv, uLeftContourCenter);
      float distR = distance(vUv, uRightContourCenter);
      
      float contourWeight = max(smoothstep(0.09, 0.01, distL), smoothstep(0.09, 0.01, distR));
      // Darken the contour areas
      finalColor = mix(finalColor, finalColor * 0.65, contourWeight * uContourOpacity);
    }

    // 5. APPLY EYE SHADOW (above eyes)
    if (uShadowOpacity > 0.0) {
      // Offset slightly upwards in UV space
      vec2 shadowCenterL = uLeftEyeCenter + vec2(0.0, 0.018);
      vec2 shadowCenterR = uRightEyeCenter + vec2(0.0, 0.018);

      float distL = distance(vUv, shadowCenterL);
      float distR = distance(vUv, shadowCenterR);

      float shadowWeight = max(smoothstep(0.035, 0.005, distL), smoothstep(0.035, 0.005, distR));
      finalColor = mix(finalColor, uShadowColor, shadowWeight * uShadowOpacity * 0.35);
    }

    // 6. APPLY LIPSTICK
    // Check if UV is within lips bounding box
    if (uLipstickOpacity > 0.0 && 
        vUv.x >= uLipBoundsMin.x && vUv.x <= uLipBoundsMax.x && 
        vUv.y >= uLipBoundsMin.y && vUv.y <= uLipBoundsMax.y) {
      
      // Calculate closeness to lips bounding box center (approximation of lips mask)
      vec2 lipsCenter = (uLipBoundsMin + uLipBoundsMax) * 0.5;
      float dx = (vUv.x - lipsCenter.x) / (uLipBoundsMax.x - uLipBoundsMin.x + 0.0001);
      float dy = (vUv.y - lipsCenter.y) / (uLipBoundsMax.y - uLipBoundsMin.y + 0.0001);
      
      // Lips shape mask: oval/ellipse bound
      float lipsMask = 1.0 - smoothstep(0.75, 1.0, (dx * dx * 1.5) + (dy * dy * 2.2));
      
      if (lipsMask > 0.0) {
        // Specular highlight calculation for Lip Gloss
        vec3 N = normalize(vNormal);
        vec3 V = normalize(vViewPosition);
        vec3 H = normalize(V + vec3(0.0, 0.0, 1.0)); // Assume light source comes from camera
        
        float spec = pow(max(dot(N, H), 0.0), 32.0);
        vec3 glossHighlight = vec3(spec * uLipstickGloss * 0.6);

        // Blend lipstick color and gloss specular highlights
        vec3 lipstickBase = mix(finalColor, uLipstickColor, uLipstickOpacity * 0.8);
        vec3 lipstickGlossy = lipstickBase + glossHighlight;

        finalColor = mix(finalColor, lipstickGlossy, lipsMask * uLipstickOpacity);
      }
    }

    // Skin Brightening Post Factor
    if (uSkinBrightening > 0.0) {
      finalColor = finalColor * (1.0 + uSkinBrightening * 0.08);
    }

    gl_FragColor = vec4(finalColor, baseColor.a);
  }
`;

export class MakeupShaderMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      vertexShader,
      fragmentShader,
      uniforms: {
        uVideoTexture: { value: null },
        
        // Lipstick
        uLipstickColor: { value: new THREE.Color('#d11a2a') },
        uLipstickOpacity: { value: 0.0 },
        uLipstickGloss: { value: 0.0 },
        
        // Blush
        uBlushColor: { value: new THREE.Color('#e07a5f') },
        uBlushOpacity: { value: 0.0 },
        uLeftCheekCenter: { value: new THREE.Vector2(0, 0) },
        uRightCheekCenter: { value: new THREE.Vector2(0, 0) },
        uBlushRadius: { value: 0.06 },

        // Foundation & Brightening
        uFoundationColor: { value: new THREE.Color('#f0c8a0') },
        uFoundationOpacity: { value: 0.0 },
        uSkinBrightening: { value: 0.0 },

        // Contour
        uContourOpacity: { value: 0.0 },
        uLeftContourCenter: { value: new THREE.Vector2(0, 0) },
        uRightContourCenter: { value: new THREE.Vector2(0, 0) },

        // Eye Shadow
        uShadowColor: { value: new THREE.Color('#582f0e') },
        uShadowOpacity: { value: 0.0 },
        uLeftEyeCenter: { value: new THREE.Vector2(0, 0) },
        uRightEyeCenter: { value: new THREE.Vector2(0, 0) },

        // Lips Bounds
        uLipBoundsMin: { value: new THREE.Vector2(0, 0) },
        uLipBoundsMax: { value: new THREE.Vector2(0, 0) }
      },
      transparent: true,
      depthWrite: false,
      depthTest: true
    });
  }

  /**
   * Helper to update feature coordinates uniforms from landmarks
   */
  public updateFeatureUniforms(landmarks: any[]): void {
    if (!landmarks || landmarks.length < 468) return;

    // Helper to get UV coordinate (x, 1.0 - y)
    const getUV = (index: number) => {
      const pt = landmarks[index]!;
      return new THREE.Vector2(pt.x, 1.0 - pt.y);
    };

    // Lips indices: 61 (left-most), 291 (right-most), 13 (upper-mid), 14 (lower-mid)
    const lipL = getUV(61);
    const lipR = getUV(291);
    const lipTop = getUV(13);
    const lipBottom = getUV(14);

    const minX = Math.min(lipL.x, lipR.x, lipTop.x, lipBottom.x) - 0.005;
    const maxX = Math.max(lipL.x, lipR.x, lipTop.x, lipBottom.x) + 0.005;
    const minY = Math.min(lipL.y, lipR.y, lipTop.y, lipBottom.y) - 0.003;
    const maxY = Math.max(lipL.y, lipR.y, lipTop.y, lipBottom.y) + 0.003;

    this.uniforms['uLipBoundsMin']!.value.set(minX, minY);
    this.uniforms['uLipBoundsMax']!.value.set(maxX, maxY);

    // Cheeks center indices: 117 (left), 346 (right)
    this.uniforms['uLeftCheekCenter']!.value.copy(getUV(117));
    this.uniforms['uRightCheekCenter']!.value.copy(getUV(346));

    // Contour hollow indices: 123 (left contour), 352 (right contour)
    this.uniforms['uLeftContourCenter']!.value.copy(getUV(123));
    this.uniforms['uRightContourCenter']!.value.copy(getUV(352));

    // Eyes center estimation: 159 (left eye top), 386 (right eye top)
    this.uniforms['uLeftEyeCenter']!.value.copy(getUV(159));
    this.uniforms['uRightEyeCenter']!.value.copy(getUV(386));
  }
}
export default MakeupShaderMaterial;
