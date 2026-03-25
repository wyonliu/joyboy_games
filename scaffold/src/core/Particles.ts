/**
 * Lightweight particle system for effects (ink splatter, hit effects, etc).
 */

import { randFloat } from './Utils.js';

export interface ParticleConfig {
  x: number;
  y: number;
  count: number;
  speed?: [number, number];
  life?: [number, number];
  size?: [number, number];
  color?: string | string[];
  gravity?: number;
  fadeOut?: boolean;
  angle?: [number, number]; // radians
  drag?: number;
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  color: string;
  active: boolean;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  gravity = 0;
  fadeOut = true;
  drag = 0.98;

  emit(config: ParticleConfig) {
    const {
      x, y, count,
      speed = [50, 150],
      life = [0.3, 1],
      size = [2, 6],
      color = '#fff',
      gravity = 0,
      fadeOut = true,
      angle = [0, Math.PI * 2],
      drag = 0.98,
    } = config;

    this.gravity = gravity;
    this.fadeOut = fadeOut;
    this.drag = drag;

    for (let i = 0; i < count; i++) {
      const a = randFloat(angle[0], angle[1]);
      const s = randFloat(speed[0], speed[1]);
      const l = randFloat(life[0], life[1]);
      const c = Array.isArray(color) ? color[Math.floor(Math.random() * color.length)] : color;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: l, maxLife: l,
        size: randFloat(size[0], size[1]),
        color: c,
        active: true,
      });
    }
  }

  update(dt: number) {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.vx *= this.drag;
      p.vy *= this.drag;
      p.vy += this.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) p.active = false;
    }
    this.particles = this.particles.filter(p => p.active);
  }

  render(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      if (!p.active) continue;
      const alpha = this.fadeOut ? p.life / p.maxLife : 1;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  get count(): number { return this.particles.length; }
  clear() { this.particles = []; }
}
