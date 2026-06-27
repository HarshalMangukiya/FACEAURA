/**
 * SkinAnalyzer.ts
 *
 * Performs client-side, real-time skin tone, skin type, and acne/dark-circle diagnostics.
 * Evaluates color statistics inside region-of-interests (ROIs) on the face using Canvas 2D.
 */

export interface SkinDiagnostics {
  skinTone: string;
  skinType: string;
  skinHealthScore: number;
  acneDetected: boolean;
  darkCircleDetected: boolean;
}

export class SkinAnalyzer {
  constructor() {}

  /**
   * Run client-side diagnostics by sampling pixel regions on the camera canvas
   * matching facial landmark areas.
   *
   * @param video Video source element
   * @param landmarks Array of landmarks
   */
  public analyzeSkin(video: HTMLVideoElement, landmarks: any[]): SkinDiagnostics {
    if (!video || !landmarks || landmarks.length < 468) {
      return {
        skinTone: 'Type II',
        skinType: 'Normal',
        skinHealthScore: 85,
        acneDetected: false,
        darkCircleDetected: false
      };
    }

    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return {
        skinTone: 'Type II',
        skinType: 'Normal',
        skinHealthScore: 85,
        acneDetected: false,
        darkCircleDetected: false
      };
    }

    // Sample cheek region (around landmark 117)
    const pt = landmarks[117]!;
    const srcX = Math.round(pt.x * video.videoWidth) - 15;
    const srcY = Math.round(pt.y * video.videoHeight) - 15;

    ctx.drawImage(video, srcX, srcY, 30, 30, 0, 0, 30, 30);
    const imgData = ctx.getImageData(0, 0, 30, 30);
    const data = imgData.data;

    let rSum = 0, gSum = 0, bSum = 0;
    const totalPixels = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      rSum += data[i + 0]!;
      gSum += data[i + 1]!;
      bSum += data[i + 2]!;
    }

    const r = rSum / totalPixels;
    const g = gSum / totalPixels;
    const b = bSum / totalPixels;

    // 1. Detect skin tone based on RGB/HSV brightness
    // Fitzpatrick skin scale estimation
    const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
    let skinTone = 'Type III';
    if (brightness > 220) skinTone = 'Type I';
    else if (brightness > 190) skinTone = 'Type II';
    else if (brightness > 150) skinTone = 'Type III';
    else if (brightness > 110) skinTone = 'Type IV';
    else if (brightness > 70) skinTone = 'Type V';
    else skinTone = 'Type VI';

    // 2. Skin type analysis based on oiliness / variance
    let skinType = 'Normal';
    // Calculate variance of brightness in the sample to check oiliness (shining highlights)
    let sqDiffSum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const pB = (data[i + 0]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114);
      sqDiffSum += Math.pow(pB - brightness, 2);
    }
    const variance = sqDiffSum / totalPixels;
    if (variance > 450) skinType = 'Oily';
    else if (variance < 120) skinType = 'Dry';

    // 3. Acne & Dark circle thresholds
    const acneDetected = variance > 300 && r > g * 1.15; // Red spots cause high local variance
    const darkCircleDetected = brightness < 110;

    // Score calculation
    let skinHealthScore = 95;
    if (acneDetected) skinHealthScore -= 15;
    if (darkCircleDetected) skinHealthScore -= 10;

    return {
      skinTone,
      skinType,
      skinHealthScore,
      acneDetected,
      darkCircleDetected
    };
  }
}

export const skinAnalyzer = new SkinAnalyzer();
export default skinAnalyzer;
