/**
 * 2D Camera with smooth follow, shake, and bounds.
 */

import { lerp, clamp } from './Utils.js';

export class Camera {
  x = 0;
  y = 0;
  private targetX = 0;
  private targetY = 0;
  private smoothing = 0.1;

  // Shake
  private shakeAmount = 0;
  private shakeDuration = 0;
  private shakeTimer = 0;
  offsetX = 0;
  offsetY = 0;

  // Bounds
  private minX = -Infinity;
  private maxX = Infinity;
  private minY = -Infinity;
  private maxY = Infinity;

  constructor(private viewWidth: number, private viewHeight: number) {}

  follow(x: number, y: number) {
    this.targetX = x - this.viewWidth / 2;
    this.targetY = y - this.viewHeight / 2;
  }

  setBounds(minX: number, minY: number, maxX: number, maxY: number) {
    this.minX = minX;
    this.minY = minY;
    this.maxX = maxX - this.viewWidth;
    this.maxY = maxY - this.viewHeight;
  }

  setSmoothing(s: number) { this.smoothing = s; }

  shake(amount: number, duration: number) {
    this.shakeAmount = amount;
    this.shakeDuration = duration;
    this.shakeTimer = 0;
  }

  update(dt: number) {
    this.x = lerp(this.x, this.targetX, this.smoothing);
    this.y = lerp(this.y, this.targetY, this.smoothing);
    this.x = clamp(this.x, this.minX, this.maxX);
    this.y = clamp(this.y, this.minY, this.maxY);

    // Shake
    if (this.shakeTimer < this.shakeDuration) {
      this.shakeTimer += dt;
      const intensity = this.shakeAmount * (1 - this.shakeTimer / this.shakeDuration);
      this.offsetX = (Math.random() - 0.5) * 2 * intensity;
      this.offsetY = (Math.random() - 0.5) * 2 * intensity;
    } else {
      this.offsetX = 0;
      this.offsetY = 0;
    }
  }

  apply(ctx: CanvasRenderingContext2D) {
    ctx.translate(-Math.round(this.x + this.offsetX), -Math.round(this.y + this.offsetY));
  }
}
