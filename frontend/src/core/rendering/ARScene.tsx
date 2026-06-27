/**
 * ARScene.tsx
 *
 * A reusable React Component packaging the HTML5 Webcam, the target rendering Canvas,
 * the FaceTracker process, and the Diagnostics Dashboard HUD.
 */

import React, { useEffect, useRef, useState } from 'react';
import FaceTracker from '../../tracking/FaceTracker';
import CanvasRenderer from '../../tracking/CanvasRenderer';
import Camera from '../../modules/camera/Camera';
import DiagnosticsDashboard from '../ui/DiagnosticsDashboard';

const CameraComponent: any = Camera;

interface ARSceneProps {
  hairUrl?: string | null;
  beardUrl?: string | null;
  glassesUrl?: string | null;
  hairColor?: string;
  showMesh?: boolean;
  isMirrored?: boolean;
  opacity?: number;
  scale?: number;
  onTelemetryUpdate?: (telemetry: any) => void;
}

export const ARScene: React.FC<ARSceneProps> = ({
  hairUrl = null,
  beardUrl = null,
  glassesUrl = null,
  hairColor = 'Original',
  showMesh = false,
  isMirrored = true,
  opacity = 1.0,
  scale = 1.0,
  onTelemetryUpdate
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  
  const trackerRef = useRef<FaceTracker | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  
  const [telemetry, setTelemetry] = useState<any>(null);
  const [fps, setFps] = useState<number>(60);
  
  const lastFrameTime = useRef<number>(performance.now());
  const frameCount = useRef<number>(0);

  // Initialize Tracker and Renderer
  useEffect(() => {
    if (!videoElement || !canvasRef.current) return;

    console.log('[ARScene] Spawning FaceTracker and CanvasRenderer...');
    const tracker = new FaceTracker({ alpha: 0.45 });
    const renderer = new CanvasRenderer(canvasRef.current, videoElement);

    trackerRef.current = tracker;
    rendererRef.current = renderer;

    const startAR = async () => {
      try {
        await tracker.start(videoElement, (t: any) => {
          // Calculate FPS
          const now = performance.now();
          frameCount.current++;
          if (now - lastFrameTime.current >= 1000) {
            setFps(Math.round((frameCount.current * 1000) / (now - lastFrameTime.current)));
            frameCount.current = 0;
            lastFrameTime.current = now;
          }

          setTelemetry(t);
          renderer.updateTelemetry(t);
          if (onTelemetryUpdate) {
            onTelemetryUpdate(t);
          }
        });

        renderer.start();
      } catch (err) {
        console.error('[ARScene] Failed to start AR loop:', err);
      }
    };

    startAR();

    return () => {
      console.log('[ARScene] Tearing down AR loops...');
      tracker.stop();
      renderer.stop();
      trackerRef.current = null;
      rendererRef.current = null;
    };
  }, [videoElement, onTelemetryUpdate]); // Add missing hook dependency

  // Synchronize dynamic assets
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setAsset('hair', hairUrl);
      rendererRef.current.setAsset('beard', beardUrl);
      rendererRef.current.setAsset('glasses', glassesUrl);
    }
  }, [hairUrl, beardUrl, glassesUrl]);

  // Synchronize options
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setOptions({
        hairColor,
        showMesh,
        isMirrored,
        hairOptions: { opacity, customScale: scale },
        beardOptions: { opacity, scale },
        glassesOptions: { opacity, scale }
      });
    }
  }, [hairColor, showMesh, isMirrored, opacity, scale]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950 rounded-2xl border border-slate-850 shadow-inner">
      <canvas
        ref={canvasRef}
        className={`w-full h-full object-cover ${isMirrored ? 'scale-x-[-1]' : ''}`}
      />
      
      {/* Hidden camera initialization */}
      <div style={{ display: 'none' }}>
        <CameraComponent autoStart={true} onVideoReady={(el: HTMLVideoElement) => setVideoElement(el)} />
      </div>

      {/* Real-time Diagnostics HUD Overlay */}
      <DiagnosticsDashboard telemetry={telemetry} fps={fps} />
    </div>
  );
};

export default ARScene;
