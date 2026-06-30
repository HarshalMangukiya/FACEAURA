/**
 * LightingEstimator.ts
 *
 * Real-time estimation of ambient brightness and color temperature from the webcam feed.
 * Analyzes video pixel distributions to dynamically adjust Three.js light intensity.
 */

import * as THREE from 'three';

export class LightingEstimator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 16;
    this.canvas.height = 16;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  /**
   * Estimates lighting intensity and average color from the video frame.
   *
   * @param video The active HTMLVideoElement stream
   */
  public estimateLighting(video: HTMLVideoElement): { intensity: number; color: THREE.Color } {
    if (!video || video.readyState < 2 || !this.ctx) {
      return { intensity: 1.0, color: new THREE.Color(0xffffff) };
    }

    try {
      // Draw 16x16 thumbnail of the video frame to average out the pixels quickly
      this.ctx.drawImage(video, 0, 0, 16, 16);
      const imgData = this.ctx.getImageData(0, 0, 16, 16).data;

      let r = 0, g = 0, b = 0;
      const totalPixels = imgData.length / 4;

      for (let i = 0; i < imgData.length; i += 4) {
        r += imgData[i]!;
        g += imgData[i + 1]!;
        b += imgData[i + 2]!;
      }

      const avgR = r / totalPixels;
      const avgG = g / totalPixels;
      const avgB = b / totalPixels;

      // Luma formula for perceptual brightness
      const luma = (0.299 * avgR + 0.587 * avgG + 0.114 * avgB) / 255;

      // Normalize estimated intensity to standard ranges (e.g. 0.6 to 1.6)
      const intensity = 0.6 + luma * 1.0;
      const color = new THREE.Color(avgR / 255, avgG / 255, avgB / 255);

      return { intensity, color };
    } catch (err) {
      // Fallback in case of CORS or browser security issues drawing video to canvas
      return { intensity: 1.0, color: new THREE.Color(0xffffff) };
    }
  }
}

export default LightingEstimator;
