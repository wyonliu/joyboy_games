/**
 * Common utilities for game development.
 */

// Random
export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// Math
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export function angle(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

export function normalize(x: number, y: number): { x: number; y: number } {
  const len = Math.sqrt(x * x + y * y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

// Collision
export function rectOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function circleOverlap(
  x1: number, y1: number, r1: number,
  x2: number, y2: number, r2: number
): boolean {
  return dist(x1, y1, x2, y2) < r1 + r2;
}

// Easing functions
export const ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => t * (2 - t),
  inOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  inCubic: (t: number) => t * t * t,
  outCubic: (t: number) => (--t) * t * t + 1,
  outBack: (t: number) => { const s = 1.70158; return (t -= 1) * t * ((s + 1) * t + s) + 1; },
  outElastic: (t: number) => t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1,
};

// Timer
export class Timer {
  elapsed = 0;
  duration: number;
  loop: boolean;
  done = false;
  private callback: (() => void) | null;

  constructor(duration: number, callback?: () => void, loop = false) {
    this.duration = duration;
    this.callback = callback ?? null;
    this.loop = loop;
  }

  update(dt: number): boolean {
    if (this.done && !this.loop) return false;
    this.elapsed += dt;
    if (this.elapsed >= this.duration) {
      if (this.callback) this.callback();
      if (this.loop) {
        this.elapsed -= this.duration;
      } else {
        this.done = true;
      }
      return true;
    }
    return false;
  }

  get progress(): number {
    return clamp(this.elapsed / this.duration, 0, 1);
  }

  reset() {
    this.elapsed = 0;
    this.done = false;
  }
}

// Object pool for performance
export class Pool<T> {
  private items: T[] = [];
  private factory: () => T;
  private reset: (item: T) => void;

  constructor(factory: () => T, reset: (item: T) => void, initialSize = 0) {
    this.factory = factory;
    this.reset = reset;
    for (let i = 0; i < initialSize; i++) {
      this.items.push(factory());
    }
  }

  get(): T {
    if (this.items.length > 0) {
      const item = this.items.pop()!;
      this.reset(item);
      return item;
    }
    return this.factory();
  }

  release(item: T) {
    this.items.push(item);
  }
}
