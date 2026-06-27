/**
 * FaceShapeDetector.ts
 *
 * Client-side face shape detection using 3D coordinate vector projection.
 * Calculates facial ratios (R1, R2, R3, R4) and runs Gaussian similarity matching.
 * Matches backend Django rules exactly.
 */

import { aiRecommendationEngine, FaceMeasurements } from '../services/AiRecommendation';

export class FaceShapeDetector {
  constructor() {}

  /**
   * Run shape classification on FaceMesh landmarks.
   *
   * @param landmarks Array of 468 landmarks
   * @returns Face shape name and classification confidence
   */
  public detect(landmarks: any[]): { faceShape: string; confidence: number; measurements: FaceMeasurements } {
    const measurements = aiRecommendationEngine.calculateMeasurements(landmarks);
    const result = aiRecommendationEngine.classifyFaceShape(measurements);

    return {
      faceShape: result.faceShape,
      confidence: result.confidence,
      measurements
    };
  }
}

export const faceShapeDetector = new FaceShapeDetector();
export default faceShapeDetector;
