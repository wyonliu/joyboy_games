/**
 * JoyBoy Game Engine - Lightweight 2D game engine core
 * Handles game loop, scene management, input, and rendering pipeline.
 */

export interface GameConfig {
  width: number;
  height: number;
  canvas?: HTMLCanvasElement;
  parent?: string | HTMLElement;
  backgroundColor?: string;
  pixelRatio?: number;
  targetFPS?: number;
  debug?: boolean;
}

export type UpdateFn = (dt: number) => void;
export type RenderFn = (ctx: CanvasRenderingContext2D, dt: number) => void;

export class Engine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  pixelRatio: number;
  debug: boolean;

  private running = false;
  private lastTime = 0;
  private accumulator = 0;
  private fixedStep: number;
  private rafId = 0;

  private updateFn: UpdateFn | null = null;
  private renderFn: RenderFn | null = null;
  private scenes: Map<string, Scene> = new Map();
  private activeScene: Scene | null = null;

  constructor(config: GameConfig) {
    this.width = config.width;
    this.height = config.height;
    this.pixelRatio = config.pixelRatio ?? Math.min(window.devicePixelRatio, 2);
    this.debug = config.debug ?? false;
    this.fixedStep = 1 / (config.targetFPS ?? 60);

    // Create or use canvas
    if (config.canvas) {
      this.canvas = config.canvas;
    } else {
      this.canvas = document.createElement('canvas');
      const parent = typeof config.parent === 'string'
        ? document.getElementById(config.parent)
        : config.parent ?? document.body;
      parent!.appendChild(this.canvas);
    }

    this.canvas.width = this.width * this.pixelRatio;
    this.canvas.height = this.height * this.pixelRatio;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.canvas.style.backgroundColor = config.backgroundColor ?? '#000';

    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(this.pixelRatio, this.pixelRatio);

    // Auto-resize for mobile
    this.setupResize();
  }

  private setupResize() {
    const resize = () => {
      const parent = this.canvas.parentElement!;
      const scaleX = parent.clientWidth / this.width;
      const scaleY = parent.clientHeight / this.height;
      const scale = Math.min(scaleX, scaleY);
      this.canvas.style.width = `${this.width * scale}px`;
      this.canvas.style.height = `${this.height * scale}px`;
    };
    window.addEventListener('resize', resize);
    resize();
  }

  onUpdate(fn: UpdateFn) { this.updateFn = fn; }
  onRender(fn: RenderFn) { this.renderFn = fn; }

  addScene(name: string, scene: Scene) {
    scene.engine = this;
    this.scenes.set(name, scene);
  }

  switchScene(name: string) {
    if (this.activeScene) this.activeScene.exit();
    this.activeScene = this.scenes.get(name) ?? null;
    if (this.activeScene) this.activeScene.enter();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private loop = (now: number) => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);

    const dt = Math.min((now - this.lastTime) / 1000, 0.1); // cap at 100ms
    this.lastTime = now;
    this.accumulator += dt;

    // Fixed timestep update
    while (this.accumulator >= this.fixedStep) {
      if (this.activeScene) this.activeScene.update(this.fixedStep);
      if (this.updateFn) this.updateFn(this.fixedStep);
      this.accumulator -= this.fixedStep;
    }

    // Render
    this.ctx.save();
    this.ctx.clearRect(0, 0, this.width, this.height);
    if (this.activeScene) this.activeScene.render(this.ctx, dt);
    if (this.renderFn) this.renderFn(this.ctx, dt);
    this.ctx.restore();
  };
}

export abstract class Scene {
  engine!: Engine;
  abstract enter(): void;
  abstract exit(): void;
  abstract update(dt: number): void;
  abstract render(ctx: CanvasRenderingContext2D, dt: number): void;
}
