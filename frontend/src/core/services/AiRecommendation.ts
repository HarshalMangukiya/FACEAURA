/**
 * AiRecommendation.ts
 *
 * Implements client-side Face Shape classification matching the backend Gaussian similarity equations,
 * and recommends hairstyles, beards, and eyewear matching the user's face shape.
 */

// Indices matching landmarker landmarks
const FOREHEAD_CENTER = 10;
const FOREHEAD_LEFT = 103;
const FOREHEAD_RIGHT = 332;
const CHEEKBONE_LEFT = 234;
const CHEEKBONE_RIGHT = 454;
const JAW_LEFT = 172;
const JAW_RIGHT = 397;
const CHIN = 152;

export interface FaceMeasurements {
  faceLength: number;
  foreheadWidth: number;
  cheekboneWidth: number;
  jawWidth: number;
}

export interface RecommendationResult {
  faceShape: string;
  confidence: number;
  measurements: FaceMeasurements;
  recommendedHairstyles: string[];
  recommendedBeards: string[];
  recommendedGlasses: string[];
}

export class AiRecommendationEngine {
  constructor() {}

  /**
   * Calculates similarity using a Gaussian penalty curve.
   */
  private calculateSimilarity(value: number, ideal: number, tolerance: number): number {
    return Math.exp(-Math.pow((value - ideal) / tolerance, 2));
  }

  /**
   * Measures physical facial boundaries.
   */
  public calculateMeasurements(landmarks: any[]): FaceMeasurements {
    if (!landmarks || landmarks.length < 468) {
      throw new Error('Invalid landmarks. Requires 468 FaceMesh points.');
    }

    const dist = (p1: any, p2: any) => {
      // 3D Euclidean distance
      return Math.hypot(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z) * 1000; // in mm units (approx scale)
    };

    const faceLength = dist(landmarks[FOREHEAD_CENTER], landmarks[CHIN]);
    const foreheadWidth = dist(landmarks[FOREHEAD_LEFT], landmarks[FOREHEAD_RIGHT]);
    const cheekboneWidth = dist(landmarks[CHEEKBONE_LEFT], landmarks[CHEEKBONE_RIGHT]);
    const jawWidth = dist(landmarks[JAW_LEFT], landmarks[JAW_RIGHT]);

    return {
      faceLength: Math.round(faceLength),
      foreheadWidth: Math.round(foreheadWidth),
      cheekboneWidth: Math.round(cheekboneWidth),
      jawWidth: Math.round(jawWidth)
    };
  }

  /**
   * Classifies face shape based on facial measurements and ratios.
   * Shapes: Oval, Round, Square, Rectangle, Heart, Diamond.
   */
  public classifyFaceShape(measurements: FaceMeasurements): { faceShape: string; confidence: number } {
    const fl = measurements.faceLength;
    const fw = measurements.foreheadWidth;
    const cw = measurements.cheekboneWidth;
    const jw = measurements.jawWidth;

    if (cw <= 0 || jw <= 0) {
      return { faceShape: 'Oval', confidence: 0.0 };
    }

    const r1 = fl / cw; // Length / Width ratio
    const r2 = jw / cw; // Jaw / Cheek ratio
    const r3 = fw / jw; // Forehead / Jaw ratio
    const r4 = fw / cw; // Forehead / Cheek ratio

    const scores: Record<string, number> = {};

    // Oval Face Shape Rules
    scores['Oval'] = Math.pow(
      this.calculateSimilarity(r1, 1.20, 0.18) *
      this.calculateSimilarity(r3, 1.10, 0.15) *
      this.calculateSimilarity(r2, 0.80, 0.12) *
      this.calculateSimilarity(r4, 0.90, 0.12),
      0.25
    );

    // Round Face Shape Rules
    const roundBase = Math.pow(
      this.calculateSimilarity(r1, 0.98, 0.10) *
      this.calculateSimilarity(r3, 1.02, 0.12) *
      this.calculateSimilarity(r2, 0.82, 0.12) *
      this.calculateSimilarity(r4, 0.85, 0.12),
      0.25
    );
    const roundBonus = (cw > fw && cw > jw) ? 1.0 : 0.5;
    scores['Round'] = roundBase * roundBonus;

    // Square Face Shape Rules
    const squareBase = Math.pow(
      this.calculateSimilarity(r1, 0.98, 0.10) *
      this.calculateSimilarity(r3, 1.00, 0.12) *
      this.calculateSimilarity(r2, 0.92, 0.12) *
      this.calculateSimilarity(r4, 0.92, 0.12),
      0.25
    );
    const squareBonus = (jw / cw > 0.85) ? 1.0 : 0.5;
    scores['Square'] = squareBase * squareBonus;

    // Rectangle Face Shape Rules
    const rectBase = Math.pow(
      this.calculateSimilarity(r1, 1.35, 0.20) *
      this.calculateSimilarity(r3, 1.00, 0.12) *
      this.calculateSimilarity(r2, 0.88, 0.12) *
      this.calculateSimilarity(r4, 0.88, 0.12),
      0.25
    );
    const rectBonus = (r1 > 1.12) ? 1.0 : 0.4;
    scores['Rectangle'] = rectBase * rectBonus;

    // Heart Face Shape Rules
    const heartBase = Math.pow(
      this.calculateSimilarity(r4, 1.08, 0.12) *
      this.calculateSimilarity(r3, 1.25, 0.20) *
      this.calculateSimilarity(r2, 0.75, 0.12) *
      this.calculateSimilarity(r1, 1.10, 0.18),
      0.25
    );
    const heartBonus = (fw > cw && fw > jw) ? 1.0 : 0.5;
    scores['Heart'] = heartBase * heartBonus;

    // Diamond Face Shape Rules
    const diamondBase = Math.pow(
      this.calculateSimilarity(r1, 1.15, 0.15) *
      this.calculateSimilarity(r4, 0.80, 0.12) *
      this.calculateSimilarity(r2, 0.75, 0.12) *
      this.calculateSimilarity(r3, 1.05, 0.15),
      0.25
    );
    const diamondBonus = (cw > fw && cw > jw) ? 1.0 : 0.5;
    scores['Diamond'] = diamondBase * diamondBonus;

    // Find best face shape match
    let bestShape = 'Oval';
    let maxScore = 0;
    
    for (const [shape, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        bestShape = shape;
      }
    }

    return {
      faceShape: bestShape,
      confidence: Number(maxScore.toFixed(2))
    };
  }

  /**
   * Recommends hairstyles, beard styles, and glasses according to face shape rules.
   */
  public getRecommendations(landmarks: any[]): RecommendationResult {
    const measurements = this.calculateMeasurements(landmarks);
    const { faceShape, confidence } = this.classifyFaceShape(measurements);

    const styleRules: Record<string, { hair: string[]; beard: string[]; glasses: string[] }> = {
      Oval: {
        hair: ['Pompadour', 'Quiff', 'Slick Back', 'Textured Crop', 'Side Part'],
        beard: ['Stubble', 'Short Beard', 'Full Beard'],
        glasses: ['Aviator', 'Rectangle Frame', 'Wayfarer']
      },
      Round: {
        hair: ['High Fade', 'Pompadour', 'Faux Hawk', 'Quiff'],
        beard: ['Goatee', 'Extended Goatee'],
        glasses: ['Rectangle Frame', 'Square Frame']
      },
      Square: {
        hair: ['Side Part', 'Crew Cut', 'Textured Crop'],
        beard: ['Light Stubble', 'Full Beard'],
        glasses: ['Round Frame', 'Oval Frame']
      },
      Heart: {
        hair: ['Fringe', 'Side Swept', 'Layered Cut'],
        beard: ['Stubble', 'Clean Shaven'],
        glasses: ['Bottom Heavy Frames', 'Round Frames']
      },
      Diamond: {
        hair: ['Textured Fringe', 'Side Part'],
        beard: ['Short Stubble', 'Goatee'],
        glasses: ['Oval Frames', 'Rimless Frames']
      },
      Rectangle: {
        hair: ['Fringe', 'Side Part', 'Layered Medium Hair'],
        beard: ['Short Beard', 'Stubble'],
        glasses: ['Large Frames', 'Round Frames']
      }
    };

    const recommendations = styleRules[faceShape] || styleRules['Oval']!;

    return {
      faceShape,
      confidence,
      measurements,
      recommendedHairstyles: recommendations.hair,
      recommendedBeards: recommendations.beard,
      recommendedGlasses: recommendations.glasses
    };
  }
}

export const aiRecommendationEngine = new AiRecommendationEngine();
export default aiRecommendationEngine;
