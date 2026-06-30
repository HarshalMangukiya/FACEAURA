/**
 * DebugPanel.tsx
 *
 * A floating glassmorphic diagnostics dashboard for Virtual Try-On developers.
 * Displays:
 * - Real-time rendering frame rate (FPS) and worker latency.
 * - Current Tracking State Machine status (Searching, Tracking, Lost, etc.).
 * - Estimated tracking confidence (Presence, Detection, and Tracking weights).
 * - Biometric face dimensions (eye distance, temple width, head depth).
 * - 3D Quaternion rotation coordinates [x, y, z, w].
 * - Real-time MediaPipe Blendshape coefficients (e.g. blinking, smiling, jaw open).
 * - Toggles for visual debug helpers: wireframe mesh, anchors, bounding boxes, pivots.
 *
 * Automatically self-disables in production environments (`import.meta.env.PROD`).
 */

import React, { useState } from 'react';

interface DebugPanelProps {
  telemetry: any;
  fps: number;
  showMesh: boolean;
  setShowMesh: (show: boolean) => void;
  showHelpers: boolean;
  setShowHelpers: (show: boolean) => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  telemetry,
  fps,
  showMesh,
  setShowMesh,
  showHelpers,
  setShowHelpers
}) => {
  // Hide panel in production environment automatically
  if (import.meta.env.PROD) {
    return null;
  }

  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'general' | 'biometrics' | 'blendshapes'>('general');

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 right-4 z-50 px-3 py-2 bg-slate-900/85 backdrop-blur border border-indigo-500/30 rounded-lg text-indigo-400 font-mono text-xs shadow-lg hover:bg-slate-800 transition-colors"
      >
        [debug panel]
      </button>
    );
  }

  const trackingState = telemetry?.trackingState || 'Searching';
  const confidence = telemetry?.confidence || { facePresenceScore: 0, faceDetectionConfidence: 0, trackingConfidence: 0 };
  const biometrics = telemetry?.biometrics || { templeDistance: 0, eyeDistance: 0, jawWidth: 0, faceHeight: 0, headDepth: 0 };
  const blendshapes = telemetry?.blendshapes || {};
  const pose = telemetry?.pose || { position: [0, 0, 0], quaternion: [0, 0, 0, 1] };
  const workerLatency = telemetry?.latency || 0;
  const anchors = telemetry?.anchors || {};

  return (
    <div className="fixed top-4 right-4 z-50 w-80 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl overflow-hidden font-mono text-xs text-slate-300">
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/50 border-b border-slate-800">
        <span className="font-semibold text-indigo-400 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          AR FACE DETECTOR HUD
        </span>
        <button
          onClick={() => setIsOpen(false)}
          className="text-slate-500 hover:text-slate-300 transition-colors"
        >
          [x]
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-900 bg-slate-950/50">
        {(['general', 'biometrics', 'blendshapes'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 text-[10px] text-center border-b uppercase font-semibold transition-all ${
              activeTab === tab
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-500 hover:text-slate-400'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Panel Content */}
      <div className="p-4 space-y-3.5 max-h-[350px] overflow-y-auto">
        {activeTab === 'general' && (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">FPS:</span>
              <span className={`font-bold ${fps > 45 ? 'text-emerald-400' : fps > 30 ? 'text-amber-400' : 'text-red-400'}`}>
                {fps} fps
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Worker Latency:</span>
              <span className="text-indigo-300">{workerLatency.toFixed(1)} ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tracking State:</span>
              <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                trackingState === 'Tracking' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                trackingState === 'Recovering' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                {trackingState.toUpperCase()}
              </span>
            </div>

            <hr className="border-slate-900" />

            <div className="space-y-1">
              <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Confidences</div>
              <div className="flex justify-between text-[11px]">
                <span>Presence:</span>
                <span className="text-slate-400">{(confidence.facePresenceScore * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>Detection:</span>
                <span className="text-slate-400">{(confidence.faceDetectionConfidence * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>Tracking:</span>
                <span className="text-slate-400">{(confidence.trackingConfidence * 100).toFixed(0)}%</span>
              </div>
            </div>

            <hr className="border-slate-900" />

            <div className="space-y-1">
              <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">WebGL Translation & Scale</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] text-slate-400 font-mono">
                <div className="col-span-2 text-indigo-300 font-semibold">Head Origin:</div>
                <div>X: {(pose.position?.[0] ?? 0).toFixed(4)}</div>
                <div>Y: {(pose.position?.[1] ?? 0).toFixed(4)}</div>
                <div>Z: {(pose.position?.[2] ?? 0).toFixed(4)}</div>
                <div className="col-span-2 text-indigo-300 font-semibold mt-1">Scale Vector:</div>
                <div>X: {(pose.scale?.[0] ?? 1.0).toFixed(4)}</div>
                <div>Y: {(pose.scale?.[1] ?? 1.0).toFixed(4)}</div>
                <div>Z: {(pose.scale?.[2] ?? 1.0).toFixed(4)}</div>
              </div>
            </div>

            <hr className="border-slate-900" />

            <div className="space-y-1">
              <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">WebGL Quaternion</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] text-slate-400 font-mono">
                <div>X: {(pose.quaternion?.[0] ?? 0).toFixed(4)}</div>
                <div>Y: {(pose.quaternion?.[1] ?? 0).toFixed(4)}</div>
                <div>Z: {(pose.quaternion?.[2] ?? 0).toFixed(4)}</div>
                <div>W: {(pose.quaternion?.[3] ?? 1).toFixed(4)}</div>
              </div>
            </div>

            <hr className="border-slate-900" />

            <div className="space-y-1">
              <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Resolved Anchors (Local)</div>
              <div className="max-h-[80px] overflow-y-auto space-y-1 text-[10px] text-slate-400 font-mono">
                {Object.keys(anchors).length === 0 ? (
                  <div className="text-slate-600">No anchors resolved</div>
                ) : (
                  Object.keys(anchors).map((key) => {
                    const aPos = anchors[key]?.position || [0, 0, 0];
                    return (
                      <div key={key} className="flex justify-between">
                        <span className="text-slate-500">{key}:</span>
                        <span>[{aPos[0].toFixed(2)}, {aPos[1].toFixed(2)}, {aPos[2].toFixed(2)}]</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <hr className="border-slate-900" />

            <div className="space-y-2">
              <div className="text-[10px] text-slate-500 font-bold uppercase">WebGL Debug Overlays</div>
              <div className="flex items-center justify-between">
                <span className="text-[11px]">Face Mesh Wireframe:</span>
                <input
                  type="checkbox"
                  checked={showMesh}
                  onChange={(e) => setShowMesh(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px]">Show Pivot & Helpers:</span>
                <input
                  type="checkbox"
                  checked={showHelpers}
                  onChange={(e) => setShowHelpers(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'biometrics' && (
          <div className="space-y-2 text-[11px]">
            <div className="text-[10px] text-indigo-400 font-bold uppercase mb-1">Face Sizes (Three.js units)</div>
            <div className="flex justify-between">
              <span className="text-slate-500">Temple Distance:</span>
              <span className="text-indigo-200">{biometrics.templeDistance.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Face Width:</span>
              <span className="text-indigo-200">{biometrics.faceWidth.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Face Height:</span>
              <span className="text-indigo-200">{biometrics.faceHeight.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Head Depth:</span>
              <span className="text-indigo-200">{biometrics.headDepth.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Eye Distance (IPD):</span>
              <span className="text-indigo-200">{biometrics.eyeDistance.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Jaw Width:</span>
              <span className="text-indigo-200">{biometrics.jawWidth.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Jaw Height:</span>
              <span className="text-indigo-200">{biometrics.jawHeight.toFixed(3)}</span>
            </div>
          </div>
        )}

        {activeTab === 'blendshapes' && (
          <div className="space-y-2 text-[11px] max-h-[220px] overflow-y-auto">
            <div className="text-[10px] text-indigo-400 font-bold uppercase mb-1">Expression coefficients</div>
            {Object.keys(blendshapes).length === 0 ? (
              <div className="text-slate-500 text-center py-4">No blendshape lock</div>
            ) : (
              Object.keys(blendshapes).map((key) => {
                const val = blendshapes[key];
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-400">{key}</span>
                      <span className="text-indigo-300">{(val * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-1">
                      <div
                        className="bg-indigo-500 h-1 rounded-full transition-all duration-75"
                        style={{ width: `${val * 100}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugPanel;
