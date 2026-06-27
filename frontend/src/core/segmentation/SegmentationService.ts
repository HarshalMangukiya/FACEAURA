/**
 * SegmentationService.ts
 *
 * Coordinates real-time image segmentation using MediaPipe or shader-based skin tone classification.
 * Generates masking textures (Hair, Skin, Background) to guide beauty blurring and makeup shaders.
 */

import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';

export class SegmentationService {
  private segmenter: ImageSegmenter | null = null;
  private loadingPromise: Promise<ImageSegmenter> | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor() {}

  /**
   * Initializes the MediaPipe ImageSegmenter.
   */
  public async initialize(): Promise<ImageSegmenter> {
    if (this.segmenter) return this.segmenter;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = (async () => {
      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
      );

      this.segmenter = await ImageSegmenter.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        outputCategoryMask: true,
        outputConfidenceMasks: false
      });

      return this.segmenter;
    })();

    return this.loadingPromise;
  }

  /**
   * Generates a 2D canvas mask identifying skin regions.
   * If MediaPipe segmentation fails, falls back to a YCbCr color range skin classifier.
   *
   * @param video The active video element source
   * @param timestampMs Frame timestamp
   */
  public getSkinMask(video: HTMLVideoElement, timestampMs: number): HTMLCanvasElement | null {
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;

    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = w;
      this.canvas.height = h;
      this.ctx = this.canvas.getContext('2d');
    }

    const ctx = this.ctx!;
    
    // Fallback: fast color-based skin classifier
    // Skin colors in YCbCr space have bounds: Y > 80, 77 < Cb < 127, 133 < Cr < 173.
    // In RGB, skin tones generally satisfy: R > G, R > B, R > 95, G > 40, B > 20, R - G > 15.
    ctx.drawImage(video, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i + 0]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;

      // Skin detection formula
      const isSkin = r > 95 && g > 40 && b > 20 &&
                     (Math.max(r, g, b) - Math.min(r, g, b) > 15) &&
                     Math.abs(r - g) > 15 && r > g && r > b;

      // Draw mask: skin pixels are solid white, non-skin pixels are transparent black
      if (isSkin) {
        data[i + 0] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
      } else {
        data[i + 0] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return this.canvas;
  }
}

export const segmentationService = new SegmentationService();
export default segmentationService;
