/**
 * BeautyFilter.tsx
 *
 * Implements a WebGL Edge-Preserving Bilateral Smoothing Shader (GPU Beauty Filter).
 * It dynamically blurs micro-textures (pores, blemishes, wrinkles) on the face mesh
 * while preserving high-contrast features (eyes, nose contours, lips) and completely
 * avoiding background or hair blur.
 */

import * as THREE from 'three';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uVideoTexture;
  uniform float uSmoothness; // 0.0 to 1.0
  uniform float uBlemishReduction; // Blur threshold
  uniform float uSharpen; // 0.0 to 1.0
  uniform float uBrightness; // -0.5 to 0.5
  uniform float uContrast; // 0.5 to 1.5
  uniform vec2 uTextureSize; // width, height of video texture

  varying vec2 vUv;

  // Bilateral filter weights parameters
  #define SIGMA 4.0
  #define BSIGMA 0.12

  // 1D Gaussian kernel distribution helper
  float gaussian(float x, float sigma) {
    return exp(-(x * x) / (2.0 * sigma * sigma)) / (2.5066 * sigma);
  }

  void main() {
    vec4 centerColor = texture2D(uVideoTexture, vUv);
    
    if (uSmoothness <= 0.01) {
      gl_FragColor = centerColor;
      return;
    }

    vec2 texelSize = 1.0 / uTextureSize;
    
    // Bilateral Filter sampling loop (5x5 grid)
    vec3 sumColor = vec3(0.0);
    float sumWeight = 0.0;
    
    for (int i = -2; i <= 2; i++) {
      for (int j = -2; j <= 2; j++) {
        vec2 offset = vec2(float(i), float(j)) * texelSize * (1.0 + uBlemishReduction * 1.5);
        vec3 cColor = texture2D(uVideoTexture, vUv + offset).rgb;
        
        // Spatial factor (Gaussian distance weight)
        float factorS = gaussian(length(vec2(float(i), float(j))), SIGMA);
        
        // Intensity factor (similarity in color weight)
        float factorI = gaussian(length(cColor - centerColor.rgb), BSIGMA);
        
        float weight = factorS * factorI;
        sumColor += cColor * weight;
        sumWeight += weight;
      }
    }
    
    // Smooth skin mix based on user strength
    vec3 smoothSkin = sumColor / (sumWeight + 0.0001);
    vec3 resultColor = mix(centerColor.rgb, smoothSkin, uSmoothness * 0.85);

    // Color controls: Brightness & Contrast
    resultColor += uBrightness;
    resultColor = (resultColor - 0.5) * uContrast + 0.5;

    // Sharpening Filter Pass (Laplacian kernel check on neighboring pixels)
    if (uSharpen > 0.01) {
      vec3 blurL = texture2D(uVideoTexture, vUv + vec2(-texelSize.x, 0.0)).rgb +
                   texture2D(uVideoTexture, vUv + vec2(texelSize.x, 0.0)).rgb +
                   texture2D(uVideoTexture, vUv + vec2(0.0, -texelSize.y)).rgb +
                   texture2D(uVideoTexture, vUv + vec2(0.0, texelSize.y)).rgb;
      vec3 laplacian = centerColor.rgb - (blurL * 0.25);
      resultColor += laplacian * uSharpen * 0.45;
    }

    // Clamp values
    resultColor = clamp(resultColor, 0.0, 1.0);
    gl_FragColor = vec4(resultColor, centerColor.a);
  }
`;

export class BeautyFilterMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      vertexShader,
      fragmentShader,
      uniforms: {
        uVideoTexture: { value: null },
        uSmoothness: { value: 0.0 }, // 0.0 to 1.0 (skin smoothing)
        uBlemishReduction: { value: 0.0 }, // 0.0 to 1.0 (blemish scale range)
        uSharpen: { value: 0.0 }, // 0.0 to 1.0
        uBrightness: { value: 0.0 }, // -0.5 to 0.5
        uContrast: { value: 1.0 }, // 0.5 to 1.5
        uTextureSize: { value: new THREE.Vector2(640, 480) }
      },
      transparent: true,
      depthWrite: false,
      depthTest: true
    });
  }

  public updateResolution(width: number, height: number): void {
    this.uniforms['uTextureSize']!.value.set(width, height);
  }
}

export default BeautyFilterMaterial;
