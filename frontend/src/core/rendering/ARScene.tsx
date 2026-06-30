/**
 * ARScene.tsx
 *
 * A reusable React Component orchestrating the WebGL 3D AR Try-On experience.
 * Connects HTML5 Webcam, WebGL Canvas, FaceTracker (off-thread worker),
 * and SceneManager to attach 3D accessory models (hair, beard, glasses, caps)
 * and apply real-time beauty shaders and makeup tints.
 *
 * Exposes imperative public methods for loading, removing, and configuring
 * accessories, and capturing HD snapshots.
 */

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import FaceTracker from '../../tracking/FaceTracker';
import Camera from '../../modules/camera/Camera';
import SceneManager from './SceneManager';
import LightingEstimator from './LightingEstimator';
import DebugPanel from '../../components/DebugPanel';

const CameraComponent: any = Camera;

interface ARSceneProps {
  // Colors & Configs passed on startup / state sync
  hairColor?: string;
  beardColor?: string;

  hairOpacity?: number;
  hairScale?: number;
  beardDensity?: number;
  beardScale?: number;
  glassesScale?: number;
  glassesOffsetY?: number;
  glassesOffsetZ?: number;
  capScale?: number;
  capOffsetY?: number;
  capOffsetZ?: number;

  lipstickColor?: string;
  lipstickOpacity?: number;
  lipstickGloss?: number;
  blushColor?: string;
  blushOpacity?: number;
  foundationColor?: string;
  foundationOpacity?: number;
  skinBrightening?: number;
  contourOpacity?: number;
  shadowColor?: string;
  shadowOpacity?: number;

  beautyLevel?: number;
  lightIntensity?: number;
  shadowStrength?: number;

  showMesh?: boolean;
  isMirrored?: boolean;

  onTelemetryUpdate?: (telemetry: any) => void;
  onFpsUpdate?: (fps: number) => void;
  onInitScene?: (sceneContext: {
    sceneManager: SceneManager;
    canvas: HTMLCanvasElement;
    videoElement?: HTMLVideoElement;
  }) => void;
}

export const ARScene = forwardRef<any, ARSceneProps>(({
  hairColor = 'Original',
  beardColor = 'Original',

  hairOpacity = 1.0,
  hairScale = 1.0,
  beardDensity = 1.0,
  beardScale = 1.0,
  glassesScale = 1.0,
  glassesOffsetY = 0.05,
  glassesOffsetZ = 0.15,
  capScale = 1.0,
  capOffsetY = 0.22,
  capOffsetZ = -0.02,

  lipstickColor = '#d11a2a',
  lipstickOpacity = 0.0,
  lipstickGloss = 0.0,
  blushColor = '#e07a5f',
  blushOpacity = 0.0,
  foundationColor = '#f0c8a0',
  foundationOpacity = 0.0,
  skinBrightening = 0.0,
  contourOpacity = 0.0,
  shadowColor = '#582f0e',
  shadowOpacity = 0.0,

  beautyLevel = 0.0,
  lightIntensity = 1.0,
  shadowStrength = 1.0,

  showMesh = false,
  isMirrored = true,

  onTelemetryUpdate,
  onFpsUpdate,
  onInitScene
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  const [showMeshState, setShowMeshState] = useState(showMesh);
  const [showHelpersState, setShowHelpersState] = useState(false);
  const [telemetryState, setTelemetryState] = useState<any>(null);
  const [fpsState, setFpsState] = useState<number>(60);

  const trackerRef = useRef<FaceTracker | null>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);
  const lightingEstimatorRef = useRef<LightingEstimator | null>(null);

  const lastFrameTime = useRef<number>(performance.now());
  const frameCount = useRef<number>(0);

  const latestTelemetryRef = useRef<any>(null);

  // Store active configs in a ref to avoid stale closure state
  const configRef = useRef({
    hairColor, beardColor,
    hairOpacity, hairScale, beardDensity, beardScale,
    glassesScale, glassesOffsetY, glassesOffsetZ,
    capScale, capOffsetY, capOffsetZ,
    lipstickColor, lipstickOpacity, lipstickGloss,
    blushColor, blushOpacity,
    foundationColor, foundationOpacity,
    skinBrightening, contourOpacity, shadowColor, shadowOpacity,
    beautyLevel, lightIntensity, shadowStrength, showMesh
  });

  useEffect(() => {
    configRef.current = {
      hairColor, beardColor,
      hairOpacity, hairScale, beardDensity, beardScale,
      glassesScale, glassesOffsetY, glassesOffsetZ,
      capScale, capOffsetY, capOffsetZ,
      lipstickColor, lipstickOpacity, lipstickGloss,
      blushColor, blushOpacity,
      foundationColor, foundationOpacity,
      skinBrightening, contourOpacity, shadowColor, shadowOpacity,
      beautyLevel, lightIntensity, shadowStrength, showMesh
    };
  }, [
    hairColor, beardColor,
    hairOpacity, hairScale, beardDensity, beardScale,
    glassesScale, glassesOffsetY, glassesOffsetZ,
    capScale, capOffsetY, capOffsetZ,
    lipstickColor, lipstickOpacity, lipstickGloss,
    blushColor, blushOpacity,
    foundationColor, foundationOpacity,
    skinBrightening, contourOpacity, shadowColor, shadowOpacity,
    beautyLevel, lightIntensity, shadowStrength, showMesh
  ]);

  // Expose imperative methods to parent component
  useImperativeHandle(ref, () => ({
    applyAccessory: async (category: string, item: any) => {
      if (sceneManagerRef.current) {
        return await sceneManagerRef.current.applyAccessory(category, item);
      }
      return false;
    },
    removeAccessory: (category: string) => {
      sceneManagerRef.current?.removeAccessory(category);
    },
    updateAccessoryConfig: (category: string, config: any) => {
      sceneManagerRef.current?.updateAccessoryConfig(category, config);
    },
    clearAccessories: () => {
      sceneManagerRef.current?.clearAccessories();
    },
    snapshot: (format: 'image/jpeg' | 'image/png' = 'image/jpeg', width?: number, height?: number): string => {
      if (sceneManagerRef.current) {
        return sceneManagerRef.current.captureSnapshot(format, width, height);
      }
      return '';
    },
    snapshotTransparent: (): string => {
      if (sceneManagerRef.current) {
        return sceneManagerRef.current.captureTransparentSnapshot();
      }
      return '';
    }
  }));

  // Wrap parent callback props in stable refs to prevent re-triggering the main setup effect
  const onInitSceneRef = useRef(onInitScene);
  const onTelemetryUpdateRef = useRef(onTelemetryUpdate);
  const onFpsUpdateRef = useRef(onFpsUpdate);

  useEffect(() => {
    onInitSceneRef.current = onInitScene;
    onTelemetryUpdateRef.current = onTelemetryUpdate;
    onFpsUpdateRef.current = onFpsUpdate;
  }, [onInitScene, onTelemetryUpdate, onFpsUpdate]);

  // Initialize SceneManager
  useEffect(() => {
    if (!videoElement || !canvasRef.current) return;

    console.log('[ARScene] Mounting SceneManager and WebGL Plugins...');

    // Resize canvas dimensions to match video dimensions initially
    const videoWidth = videoElement.videoWidth || 640;
    const videoHeight = videoElement.videoHeight || 480;
    canvasRef.current.width = videoWidth;
    canvasRef.current.height = videoHeight;

    const sceneManager = new SceneManager(canvasRef.current, videoElement);
    sceneManagerRef.current = sceneManager;

    const lightingEstimator = new LightingEstimator();
    lightingEstimatorRef.current = lightingEstimator;

    const { renderer } = sceneManager.getRenderContext();
    renderer.setSize(videoWidth, videoHeight, false);
    canvasRef.current.style.removeProperty('width');
    canvasRef.current.style.removeProperty('height');

    // Notify parent of initialization
    if (onInitSceneRef.current) {
      onInitSceneRef.current({
        sceneManager,
        canvas: canvasRef.current,
        videoElement
      });
    }

    // Start independent WebGL render loop (decoulped from FaceTracker, ensures continuous 60fps output)
    let renderFrameId: number;

    const runRenderLoop = () => {
      if (!sceneManagerRef.current) return;

      const cfg = configRef.current;
      const sMgr = sceneManagerRef.current;
      const t = latestTelemetryRef.current;

      // Ensure canvas resolution matches video feed resolution dynamically
      const vw = videoElement.videoWidth || 640;
      const vh = videoElement.videoHeight || 480;
      if (canvasRef.current && (canvasRef.current.width !== vw || canvasRef.current.height !== vh)) {
        canvasRef.current.width = vw;
        canvasRef.current.height = vh;
        const { renderer: r } = sMgr.getRenderContext();
        r.setSize(vw, vh, false);
        canvasRef.current.style.removeProperty('width');
        canvasRef.current.style.removeProperty('height');
      }

      // 1. Calculate FPS
      const now = performance.now();
      frameCount.current++;
      if (now - lastFrameTime.current >= 1000) {
        const currentFps = Math.round((frameCount.current * 1000) / (now - lastFrameTime.current));
        if (onFpsUpdateRef.current) onFpsUpdateRef.current(currentFps);
        if (!import.meta.env.PROD) setFpsState(currentFps);
        frameCount.current = 0;
        lastFrameTime.current = now;
      }

      // 2. Dynamic Lighting Estimation
      if (lightingEstimatorRef.current) {
        const estimated = lightingEstimatorRef.current.estimateLighting(videoElement);
        sMgr.setLighting(estimated.intensity * cfg.lightIntensity, cfg.shadowStrength);
      }

      // 3. Render WebGL Frame and update plugins pose
      sMgr.render(t);

      renderFrameId = requestAnimationFrame(runRenderLoop);
    };

    runRenderLoop();

    // Start off-thread FaceTracker loop
    const tracker = new FaceTracker({ alpha: 0.45 });
    trackerRef.current = tracker;

    const startARLoop = async () => {
      try {
        await tracker.start(videoElement, (t: any) => {
          // Enrich tracking telemetry with runtime diagnostics from SceneManager
          if (sceneManagerRef.current) {
            const diags = sceneManagerRef.current.getDiagnostics();
            t.diagnostics = diags;
          }
          latestTelemetryRef.current = t;
          if (onTelemetryUpdateRef.current) {
            onTelemetryUpdateRef.current(t);
          }
          if (!import.meta.env.PROD) {
            setTelemetryState(t);
          }
        });
      } catch (err) {
        console.error('[ARScene] Failed to run AR tracking loop:', err);
      }
    };

    startARLoop();

    // Resize observer to adapt WebGLRenderer aspect ratios
    const resizeObserver = new ResizeObserver(() => {
      if (!videoElement || !canvasRef.current || !sceneManagerRef.current) return;
      const w = videoElement.videoWidth || 640;
      const h = videoElement.videoHeight || 480;
      if (canvasRef.current.width !== w || canvasRef.current.height !== h) {
        canvasRef.current.width = w;
        canvasRef.current.height = h;
        const { renderer: r } = sceneManagerRef.current.getRenderContext();
        r.setSize(w, h, false);
        canvasRef.current.style.removeProperty('width');
        canvasRef.current.style.removeProperty('height');
      }
    });
    resizeObserver.observe(videoElement);

    return () => {
      console.log('[ARScene] Tearing down WebGL Try-On Scene...');
      resizeObserver.disconnect();
      cancelAnimationFrame(renderFrameId);
      tracker.stop();
      sceneManager.dispose();
      trackerRef.current = null;
      sceneManagerRef.current = null;
      lightingEstimatorRef.current = null;
    };
  }, [videoElement]);

  // Synchronize ShowMesh debug wireframe state
  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setShowMesh(showMesh);
    }
  }, [showMesh]);

  // Synchronize Makeup configuration shader uniforms
  useEffect(() => {
    if (sceneManagerRef.current) {
      const hasActiveShader =
        beautyLevel > 0.01 ||
        lipstickOpacity > 0.01 ||
        blushOpacity > 0.01 ||
        foundationOpacity > 0.01 ||
        skinBrightening > 0.01 ||
        contourOpacity > 0.01 ||
        shadowOpacity > 0.01;

      if (hasActiveShader) {
        sceneManagerRef.current.updateAccessoryConfig('makeup', {
          visible: true,
          lipstickColor,
          lipstickOpacity,
          lipstickGloss,
          blushColor,
          blushOpacity,
          blushRadius: 0.06,
          foundationColor,
          foundationOpacity,
          skinBrightening,
          contourOpacity,
          shadowColor,
          shadowOpacity,
          smoothness: beautyLevel,
          blemishReduction: beautyLevel,
          textureSize: videoElement
            ? new THREE.Vector2(videoElement.videoWidth || 640, videoElement.videoHeight || 480)
            : new THREE.Vector2(640, 480)
        });
      } else {
        sceneManagerRef.current.updateAccessoryConfig('makeup', { visible: false });
      }
    }
  }, [
    lipstickColor, lipstickOpacity, lipstickGloss,
    blushColor, blushOpacity,
    foundationColor, foundationOpacity,
    skinBrightening, contourOpacity, shadowColor, shadowOpacity,
    beautyLevel, videoElement
  ]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950 rounded-2xl border border-slate-850 shadow-inner">
      <canvas
        ref={canvasRef}
        className={`w-full h-full object-cover transition-transform duration-300 ${
          isMirrored ? 'scale-x-[-1]' : ''
        }`}
      />

      <DebugPanel
        telemetry={telemetryState}
        fps={fpsState}
        showMesh={showMeshState}
        setShowMesh={(show) => {
          setShowMeshState(show);
          sceneManagerRef.current?.setShowMesh(show);
        }}
        showHelpers={showHelpersState}
        setShowHelpers={(show) => {
          setShowHelpersState(show);
          sceneManagerRef.current?.setShowHelpers(show);
        }}
      />

      {/* Visually-hidden active webcam container to force browser frames decoding */}
      <div style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        opacity: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: -1000
      }}>
        <CameraComponent autoStart={true} onVideoReady={(el: HTMLVideoElement) => setVideoElement(el)} />
      </div>
    </div>
  );
});

export default ARScene;
