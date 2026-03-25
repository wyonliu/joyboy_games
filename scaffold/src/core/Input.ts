/**
 * Unified input system - keyboard + touch + gamepad
 * Mobile-first with virtual joystick support.
 */

export interface Vec2 { x: number; y: number; }

export class Input {
  private keys: Set<string> = new Set();
  private keysJustPressed: Set<string> = new Set();
  private keysJustReleased: Set<string> = new Set();

  // Touch/pointer
  private _pointerDown = false;
  private _pointerPos: Vec2 = { x: 0, y: 0 };
  private _pointerStartPos: Vec2 = { x: 0, y: 0 };
  private _swipeDir: Vec2 = { x: 0, y: 0 };
  private _tapped = false;
  private tapTimeout: ReturnType<typeof setTimeout> | null = null;

  // Virtual joystick
  private joystickActive = false;
  private joystickOrigin: Vec2 = { x: 0, y: 0 };
  private _joystickDir: Vec2 = { x: 0, y: 0 };
  private joystickRadius = 50;

  private canvas: HTMLCanvasElement;
  private scale = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.bindKeyboard();
    this.bindPointer();
  }

  private bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this.keysJustPressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.keysJustReleased.add(e.code);
    });
  }

  private getPointerPos(e: Touch | MouseEvent): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (this.canvas.width / this.canvas.clientWidth / (window.devicePixelRatio > 1 ? Math.min(window.devicePixelRatio, 2) : 1)),
      y: (e.clientY - rect.top) * (this.canvas.height / this.canvas.clientHeight / (window.devicePixelRatio > 1 ? Math.min(window.devicePixelRatio, 2) : 1)),
    };
  }

  private bindPointer() {
    // Touch events
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      this._pointerDown = true;
      this._pointerPos = this.getPointerPos(t);
      this._pointerStartPos = { ...this._pointerPos };
      this.joystickActive = true;
      this.joystickOrigin = { ...this._pointerPos };
      this._tapped = false;
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      this._pointerPos = this.getPointerPos(t);
      if (this.joystickActive) {
        const dx = this._pointerPos.x - this.joystickOrigin.x;
        const dy = this._pointerPos.y - this.joystickOrigin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const clamped = Math.min(dist, this.joystickRadius);
        if (dist > 0) {
          this._joystickDir = { x: (dx / dist) * (clamped / this.joystickRadius), y: (dy / dist) * (clamped / this.joystickRadius) };
        }
      }
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      const dx = this._pointerPos.x - this._pointerStartPos.x;
      const dy = this._pointerPos.y - this._pointerStartPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 15) this._tapped = true;
      if (dist > 30) {
        this._swipeDir = { x: dx / dist, y: dy / dist };
      }
      this._pointerDown = false;
      this.joystickActive = false;
      this._joystickDir = { x: 0, y: 0 };
    }, { passive: false });

    // Mouse fallback
    this.canvas.addEventListener('mousedown', (e) => {
      this._pointerDown = true;
      this._pointerPos = this.getPointerPos(e);
      this._pointerStartPos = { ...this._pointerPos };
    });
    this.canvas.addEventListener('mousemove', (e) => {
      this._pointerPos = this.getPointerPos(e);
    });
    this.canvas.addEventListener('mouseup', () => {
      const dx = this._pointerPos.x - this._pointerStartPos.x;
      const dy = this._pointerPos.y - this._pointerStartPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 10) this._tapped = true;
      this._pointerDown = false;
    });
  }

  // Keyboard
  isDown(code: string): boolean { return this.keys.has(code); }
  justPressed(code: string): boolean { return this.keysJustPressed.has(code); }
  justReleased(code: string): boolean { return this.keysJustReleased.has(code); }

  // Direction from WASD/Arrows
  getDirection(): Vec2 {
    // Joystick takes priority on mobile
    if (this.joystickActive) return this._joystickDir;

    let x = 0, y = 0;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y += 1;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    const len = Math.sqrt(x * x + y * y);
    if (len > 0) return { x: x / len, y: y / len };
    return { x: 0, y: 0 };
  }

  // Pointer
  get pointerDown(): boolean { return this._pointerDown; }
  get pointerPos(): Vec2 { return this._pointerPos; }
  get tapped(): boolean { return this._tapped; }
  get swipeDirection(): Vec2 { return this._swipeDir; }
  get joystickDirection(): Vec2 { return this._joystickDir; }

  // Call at end of each frame
  endFrame() {
    this.keysJustPressed.clear();
    this.keysJustReleased.clear();
    this._tapped = false;
    this._swipeDir = { x: 0, y: 0 };
  }
}
