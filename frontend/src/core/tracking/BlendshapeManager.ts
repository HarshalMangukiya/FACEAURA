/**
 * BlendshapeManager.ts
 *
 * Manages the extraction and subscription lifecycle of MediaPipe FaceLandmarker blendshape scores.
 * Exposes a reactive hook for components and plugins to deform meshes or react to expressions
 * (e.g. blinking, smiling, puffing cheeks, jaw opening).
 */

import { useState, useEffect } from 'react';

export type BlendshapeName =
  | 'jawOpen'
  | 'mouthSmileLeft'
  | 'mouthSmileRight'
  | 'eyeBlinkLeft'
  | 'eyeBlinkRight'
  | 'browInnerUp'
  | 'browOuterUpLeft'
  | 'browOuterUpRight'
  | 'cheekPuff'
  | 'mouthPucker'
  | 'mouthOpen'
  | 'noseSneer';

export class BlendshapeManager {
  private coefficients: Record<string, number> = {};
  private listeners: Set<(coefficients: Record<string, number>) => void> = new Set();

  constructor() {
    this.reset();
  }

  /**
   * Updates current coefficients from raw MediaPipe classification outputs and alerts listeners.
   */
  public update(categories: Array<{ categoryName: string; score: number; name?: string; value?: number }>): void {
    if (!categories) return;

    // Reset coefficients to avoid stale states
    this.coefficients = {};

    for (const item of categories) {
      const name = item.categoryName || item.name;
      const score = item.score !== undefined ? item.score : (item.value !== undefined ? item.value : 0);
      if (name) {
        this.coefficients[name] = score;
      }
    }

    // Add mouthOpen alias from jawOpen if missing
    if (this.coefficients['jawOpen'] !== undefined && this.coefficients['mouthOpen'] === undefined) {
      this.coefficients['mouthOpen'] = this.coefficients['jawOpen'];
    }

    this.notifyListeners();
  }

  /**
   * Gets the score for a specific blendshape (defaulting to 0.0).
   */
  public getScore(name: string): number {
    return this.coefficients[name] || 0.0;
  }

  /**
   * Exposes raw coefficients dictionary.
   */
  public getCoefficients(): Record<string, number> {
    return { ...this.coefficients };
  }

  /**
   * Subscribes to updates. Returns an unsubscribe function.
   */
  public subscribe(listener: (coeffs: Record<string, number>) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.coefficients);
      } catch (err) {
        console.error('[BlendshapeManager] Error in listener callback:', err);
      }
    });
  }

  /**
   * Resets coefficients.
   */
  public reset(): void {
    this.coefficients = {
      jawOpen: 0,
      mouthSmileLeft: 0,
      mouthSmileRight: 0,
      eyeBlinkLeft: 0,
      eyeBlinkRight: 0,
      browInnerUp: 0,
      browOuterUpLeft: 0,
      browOuterUpRight: 0,
      cheekPuff: 0,
      mouthPucker: 0,
      mouthOpen: 0,
      noseSneer: 0
    };
    this.notifyListeners();
  }
}

// Singleton global manager instance for context-free imports
export const blendshapeManager = new BlendshapeManager();

/**
 * Custom React Hook to subscribe to real-time blendshape parameters.
 */
export function useBlendshapes(manager: BlendshapeManager = blendshapeManager): Record<string, number> {
  const [coeffs, setCoeffs] = useState<Record<string, number>>(() => manager.getCoefficients());

  useEffect(() => {
    // Sync initial coefficients
    setCoeffs(manager.getCoefficients());
    
    // Subscribe to updates
    return manager.subscribe((newCoeffs) => {
      setCoeffs(newCoeffs);
    });
  }, [manager]);

  return coeffs;
}

export default blendshapeManager;
