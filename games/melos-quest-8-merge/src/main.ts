// ============================================================================
// 合灵演化 | Spirit Merge — Melo's Quest 8
// A Suika-style physics merge game with Chinese mythology spirit beasts
// Single-file TypeScript · Canvas2D · Web Audio procedural synthesis
// ============================================================================

// ---------------------------------------------------------------------------
// §0  Constants & Types
// ---------------------------------------------------------------------------

const W = 390;
const H = 844;
const DPR = Math.min(window.devicePixelRatio || 1, 3);

const PARTICLE_CAP = 350;
const GRAVITY = 980;          // px/s²
const RESTITUTION = 0.3;
const FRICTION_COEFF = 0.1;
const SUBSTEPS = 4;
const SLEEP_THRESHOLD = 0.5;  // px/frame
const DANGER_Y = 140;
const DANGER_TIMEOUT = 3000;  // ms
const CONTAINER_L = 20;
const CONTAINER_R = W - 20;
const CONTAINER_B = H - 50;
const DROP_ZONE_Y = 85;
const COMBO_WINDOW = 1000;
const SPIRIT_EVENT_INTERVAL = 5; // every N high-tier merges
const TIER_COUNT = 12;

const PRESET_NICKNAMES = [
  '墨染清风', '云水禅心', '竹影横斜', '松涛听雪',
  '兰亭序客', '秋水伊人', '浮生若梦', '烟雨江南',
];

// ---------------------------------------------------------------------------
// §0.1  Spirit definitions
// ---------------------------------------------------------------------------

interface SpiritDef {
  name: string;
  radius: number;
  baseColor: string;    // main fill
  glowColor: string;    // outer glow / halo
  darkColor: string;    // shadow / dark accent
  points: number;
}

// radius: tier 1 = 12, each +5  →  tier 12 = 67
const SPIRIT_DEFS: SpiritDef[] = [
  { name: '灵萤', radius: 12, baseColor: '#00ffcc', glowColor: '#00ffcc', darkColor: '#005544', points: 1 },
  { name: '灵蝶', radius: 17, baseColor: '#66ccff', glowColor: '#88ddff', darkColor: '#224466', points: 3 },
  { name: '灵鱼', radius: 22, baseColor: '#33ee99', glowColor: '#55ffbb', darkColor: '#116633', points: 8 },
  { name: '灵兔', radius: 27, baseColor: '#ffcc44', glowColor: '#ffdd77', darkColor: '#885500', points: 20 },
  { name: '灵鹤', radius: 32, baseColor: '#ffaa33', glowColor: '#ffcc66', darkColor: '#774400', points: 50 },
  { name: '灵鹿', radius: 37, baseColor: '#ffdd66', glowColor: '#ffee99', darkColor: '#886600', points: 120 },
  { name: '灵虎', radius: 42, baseColor: '#bb55ff', glowColor: '#dd88ff', darkColor: '#440088', points: 280 },
  { name: '灵龟', radius: 47, baseColor: '#ff4466', glowColor: '#ff7799', darkColor: '#880022', points: 650 },
  { name: '灵凤', radius: 52, baseColor: '#ffffff', glowColor: '#ffdddd', darkColor: '#885555', points: 1500 },
  { name: '灵麟', radius: 57, baseColor: '#ff66aa', glowColor: '#ffaacc', darkColor: '#880044', points: 3500 },
  { name: '灵龙', radius: 62, baseColor: '#88ffbb', glowColor: '#bbffdd', darkColor: '#226644', points: 8000 },
  { name: '混沌', radius: 67, baseColor: '#ffeedd', glowColor: '#ffffff', darkColor: '#664422', points: 20000 },
];

// Tier color group helper — used for themed particle bursts
function tierColorGroup(t: number): 'cool' | 'warm' | 'royal' | 'celestial' {
  if (t <= 2) return 'cool';
  if (t <= 5) return 'warm';
  if (t <= 8) return 'royal';
  return 'celestial';
}

// Group-themed accent colors for particles/effects
const GROUP_ACCENTS: Record<string, string[]> = {
  cool:      ['#00ffcc', '#66ccff', '#33ee99', '#88ffdd'],
  warm:      ['#ffcc44', '#ffaa33', '#ffdd66', '#ff8833'],
  royal:     ['#bb55ff', '#ff4466', '#ffffff', '#dd88ff'],
  celestial: ['#ff66aa', '#88ffbb', '#ffeedd', '#ffaacc'],
};

// Spirit English names for UI
const SPIRIT_NAMES_EN = [
  'Firefly', 'Butterfly', 'Fish', 'Rabbit', 'Crane', 'Deer',
  'Tiger', 'Turtle', 'Phoenix', 'Qilin', 'Dragon', 'Chaos',
];

// ---------------------------------------------------------------------------
// §0.2  Melo Passport
// ---------------------------------------------------------------------------

interface MeloPassport {
  nickname: string;
  coins: number;
  achievements: string[];
  playCount: number;
}

function loadPassport(): MeloPassport {
  try {
    const raw = localStorage.getItem('meloPassport');
    if (raw) return JSON.parse(raw) as MeloPassport;
  } catch { /* */ }
  return { nickname: '', coins: 0, achievements: [], playCount: 0 };
}

function savePassport(p: MeloPassport): void {
  try { localStorage.setItem('meloPassport', JSON.stringify(p)); } catch { /* */ }
}

// ---------------------------------------------------------------------------
// §0.3  Persist helpers
// ---------------------------------------------------------------------------

function loadBool(key: string, def: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === 'true') return true;
    if (v === 'false') return false;
  } catch { /* */ }
  return def;
}

function saveBool(key: string, v: boolean): void {
  try { localStorage.setItem(key, String(v)); } catch { /* */ }
}

function loadNum(key: string, def: number): number {
  try {
    const v = localStorage.getItem(key);
    if (v !== null) return Number(v);
  } catch { /* */ }
  return def;
}

// ---------------------------------------------------------------------------
// §1  Vec2 math helpers
// ---------------------------------------------------------------------------

function v2dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

function v2len(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function rnd(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo);
}

function rndInt(lo: number, hi: number): number {
  return Math.floor(rnd(lo, hi + 1));
}

// ---------------------------------------------------------------------------
// §2  Spirit (physics body)
// ---------------------------------------------------------------------------

let _spiritId = 0;

class Spirit {
  id: number;
  tier: number;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  radius: number;
  sleeping = false;
  merged = false;
  born: number;
  angle = 0;
  av = 0; // angular velocity

  constructor(tier: number, x: number, y: number) {
    this.id = _spiritId++;
    this.tier = tier;
    this.x = x;
    this.y = y;
    this.radius = SPIRIT_DEFS[tier].radius;
    this.born = performance.now();
    this.av = rnd(-2, 2);
  }

  mass(): number { return this.radius * this.radius; }
}

// ---------------------------------------------------------------------------
// §3  Particle system (hard cap 350)
// ---------------------------------------------------------------------------

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  color: string;
  kind: 'dot' | 'spark' | 'ring';
}

class Particles {
  pool: Particle[] = [];

  emit(
    x: number, y: number, count: number,
    color: string, speed: number, life: number,
    kind: Particle['kind'] = 'dot',
  ): void {
    const room = PARTICLE_CAP - this.pool.length;
    const n = Math.min(count, Math.max(0, room));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.3 + Math.random() * 0.7);
      this.pool.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life, maxLife: life,
        size: 1.5 + Math.random() * 3.5,
        color,
        kind,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.pool.length - 1; i >= 0; i--) {
      const p = this.pool[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 180 * dt;         // light gravity on particles
      p.life -= dt;
      if (p.life <= 0) {
        // swap-remove
        this.pool[i] = this.pool[this.pool.length - 1];
        this.pool.pop();
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.pool) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = a;
      if (p.kind === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - a) * 5 + 2, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'spark') {
        const ang = Math.atan2(p.vy, p.vx);
        const len = p.size * 2.5;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(p.x - Math.cos(ang) * len, p.y - Math.sin(ang) * len);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// §4  Audio engine (Web Audio procedural)
// ---------------------------------------------------------------------------

class Audio {
  ac: AudioContext | null = null;
  master: GainNode | null = null;
  bgmGain: GainNode | null = null;
  sfxGain: GainNode | null = null;
  muted: boolean;
  private bgmRunning = false;
  private bgmNodes: AudioNode[] = [];
  private melodyTimer: number | null = null;
  private gc: { node: AudioNode; die: number }[] = [];

  constructor(muted: boolean) { this.muted = muted; }

  init(): void {
    if (this.ac) return;
    try {
      this.ac = new AudioContext();
      this.master = this.ac.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ac.destination);
      this.bgmGain = this.ac.createGain();
      this.bgmGain.gain.value = 0.22;
      this.bgmGain.connect(this.master);
      this.sfxGain = this.ac.createGain();
      this.sfxGain.gain.value = 0.45;
      this.sfxGain.connect(this.master);
    } catch { /* no audio */ }
  }

  resume(): void {
    if (this.ac?.state === 'suspended') this.ac.resume().catch(() => {});
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ac)
      this.master.gain.setTargetAtTime(m ? 0 : 1, this.ac.currentTime, 0.05);
  }

  private sched(node: AudioNode, dur: number): void {
    this.gc.push({ node, die: performance.now() + dur * 1000 + 600 });
  }

  cleanup(): void {
    const now = performance.now();
    for (let i = this.gc.length - 1; i >= 0; i--) {
      if (now >= this.gc[i].die) {
        try { this.gc[i].node.disconnect(); } catch { /* */ }
        this.gc[i] = this.gc[this.gc.length - 1];
        this.gc.pop();
      }
    }
  }

  // ---- BGM ----
  startBGM(): void {
    if (this.bgmRunning || !this.ac || !this.bgmGain) return;
    this.bgmRunning = true;
    // Pad drone on root + fifth
    const mkPad = (freq: number, vol: number) => {
      const o = this.ac!.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      const g = this.ac!.createGain();
      g.gain.value = vol;
      const f = this.ac!.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 280;
      o.connect(f); f.connect(g); g.connect(this.bgmGain!);
      o.start();
      this.bgmNodes.push(o, g, f);
    };
    mkPad(110, 0.14);
    mkPad(165, 0.07);
    this.melodyLoop();
  }

  private melodyLoop(): void {
    if (!this.ac || !this.bgmGain || !this.bgmRunning) return;
    const pentatonic = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3];
    const now = this.ac.currentTime;
    const len = 0.55;
    const cnt = rndInt(3, 6);
    for (let i = 0; i < cnt; i++) {
      const freq = pentatonic[rndInt(0, pentatonic.length - 1)];
      const o = this.ac.createOscillator();
      o.type = 'triangle'; o.frequency.value = freq;
      const g = this.ac.createGain();
      g.gain.setValueAtTime(0, now + i * len);
      g.gain.linearRampToValueAtTime(0.05, now + i * len + 0.04);
      g.gain.linearRampToValueAtTime(0, now + i * len + len * 0.85);
      o.connect(g); g.connect(this.bgmGain);
      o.start(now + i * len); o.stop(now + i * len + len);
      this.sched(o, i * len + len + 0.3);
      this.sched(g, i * len + len + 0.3);
    }
    const next = (cnt * len + 1.5 + Math.random() * 2) * 1000;
    this.melodyTimer = window.setTimeout(() => this.melodyLoop(), next);
  }

  stopBGM(): void {
    this.bgmRunning = false;
    for (const n of this.bgmNodes) {
      try { (n as OscillatorNode).stop?.(); } catch { /* */ }
      try { n.disconnect(); } catch { /* */ }
    }
    this.bgmNodes = [];
    if (this.melodyTimer !== null) { clearTimeout(this.melodyTimer); this.melodyTimer = null; }
  }

  // ---- SFX ----
  private tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0): void {
    if (!this.ac || !this.sfxGain) return;
    const t = this.ac.currentTime + delay;
    const o = this.ac.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    const g = this.ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.01);
    this.sched(o, delay + dur + 0.05);
    this.sched(g, delay + dur + 0.05);
  }

  playDrop(tier: number): void {
    const f = 200 + tier * 35;
    this.tone(f, 0.12, 'sine', 0.28);
  }

  playMerge(tier: number): void {
    const base = 220 + tier * 55;
    this.tone(base, 0.30, 'triangle', 0.22);
    this.tone(base * 1.5, 0.30, 'triangle', 0.18, 0.03);
  }

  playCombo(level: number): void {
    const base = 330 + level * 25;
    const n = Math.min(level + 2, 6);
    for (let i = 0; i < n; i++) {
      this.tone(base * Math.pow(1.2, i), 0.18, 'sine', 0.13, i * 0.06);
    }
  }

  playBounce(): void {
    if (!this.ac || !this.sfxGain) return;
    const t = this.ac.currentTime;
    const o = this.ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(75, t);
    o.frequency.exponentialRampToValueAtTime(35, t + 0.05);
    const g = this.ac.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + 0.06);
    this.sched(o, 0.08); this.sched(g, 0.08);
  }

  playTension(): void {
    if (!this.ac || !this.sfxGain) return;
    const t = this.ac.currentTime;
    const o = this.ac.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = 55;
    const flt = this.ac.createBiquadFilter();
    flt.type = 'lowpass'; flt.frequency.value = 190;
    const g = this.ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.13, t + 0.25);
    g.gain.linearRampToValueAtTime(0, t + 1.3);
    o.connect(flt); flt.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + 1.4);
    this.sched(o, 1.5); this.sched(flt, 1.5); this.sched(g, 1.5);
  }

  playChainReaction(): void {
    const notes = [330, 440, 550, 660, 770, 880];
    for (let i = 0; i < notes.length; i++) {
      this.tone(notes[i], 0.22, 'sine', 0.10, i * 0.07);
    }
  }

  playClick(): void { this.tone(600, 0.07, 'sine', 0.14); }

  // --- Enhanced Audio: Pentatonic scale merge sounds ---
  // Chinese pentatonic: gong, shang, jue, zhi, yu (C D E G A)
  private readonly PENTATONIC_FREQS = [
    261.6, 293.7, 329.6, 392.0, 440.0,   // octave 4
    523.3, 587.3, 659.3, 784.0, 880.0,   // octave 5
    1046.5, 1174.7,                        // octave 6 (for highest tiers)
  ];

  playMergePentatonic(tier: number): void {
    if (!this.ac || !this.sfxGain) return;
    // Map tier to pentatonic note (escalating pitch)
    const noteIdx = Math.min(tier, this.PENTATONIC_FREQS.length - 1);
    const freq = this.PENTATONIC_FREQS[noteIdx];

    // Primary note
    this.tone(freq, 0.35, 'triangle', 0.20);
    // Perfect fifth harmony
    this.tone(freq * 1.5, 0.30, 'sine', 0.12, 0.02);
    // Octave shimmer for high tiers
    if (tier >= 6) {
      this.tone(freq * 2, 0.25, 'sine', 0.08, 0.04);
    }
    // Sub bass thump for very high tiers
    if (tier >= 8) {
      this.tone(freq * 0.5, 0.4, 'sine', 0.15, 0.01);
    }
  }

  // Satisfying "pop" sound on drop contact with floor/wall
  playDropPop(): void {
    if (!this.ac || !this.sfxGain) return;
    const t = this.ac.currentTime;

    // White noise burst (pop)
    const bufferSize = this.ac.sampleRate * 0.03;
    const buffer = this.ac.createBuffer(1, bufferSize, this.ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }
    const noise = this.ac.createBufferSource();
    noise.buffer = buffer;

    const flt = this.ac.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.value = 800;
    flt.Q.value = 2;

    const g = this.ac.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    noise.connect(flt);
    flt.connect(g);
    g.connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 0.07);

    this.sched(noise, 0.1);
    this.sched(flt, 0.1);
    this.sched(g, 0.1);

    // Also a quick tonal pop
    this.tone(420, 0.05, 'sine', 0.12);
  }

  // Near-overflow heartbeat drone
  private heartbeatNode: OscillatorNode | null = null;
  private heartbeatGain: GainNode | null = null;
  heartbeatActive = false;

  startHeartbeat(): void {
    if (!this.ac || !this.sfxGain || this.heartbeatActive) return;
    this.heartbeatActive = true;

    const t = this.ac.currentTime;
    const o = this.ac.createOscillator();
    o.type = 'sine';
    o.frequency.value = 40;

    const g = this.ac.createGain();
    g.gain.setValueAtTime(0, t);

    const flt = this.ac.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = 80;

    // LFO for heartbeat rhythm
    const lfo = this.ac.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 1.2; // ~72 BPM
    const lfoGain = this.ac.createGain();
    lfoGain.gain.value = 0.08;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);

    o.connect(flt);
    flt.connect(g);
    g.connect(this.sfxGain);
    o.start(t);
    lfo.start(t);

    this.heartbeatNode = o;
    this.heartbeatGain = g;
    this.bgmNodes.push(o, g, flt, lfo, lfoGain);
  }

  updateHeartbeatIntensity(danger: number): void {
    if (!this.heartbeatGain || !this.ac) return;
    // danger is 0-1
    const vol = danger * 0.12;
    this.heartbeatGain.gain.setTargetAtTime(vol, this.ac.currentTime, 0.1);
  }

  stopHeartbeat(): void {
    if (!this.heartbeatActive) return;
    this.heartbeatActive = false;
    if (this.heartbeatNode) {
      try { this.heartbeatNode.stop(); } catch { /* */ }
      this.heartbeatNode = null;
    }
    this.heartbeatGain = null;
  }

  // Chain reaction cascading tones (ascending pentatonic scale)
  playChainCascade(comboLevel: number): void {
    if (!this.ac || !this.sfxGain) return;
    const pentatonic = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3, 659.3];
    const startIdx = Math.min(comboLevel, pentatonic.length - 3);
    const noteCount = Math.min(comboLevel + 1, 6);

    for (let i = 0; i < noteCount; i++) {
      const idx = Math.min(startIdx + i, pentatonic.length - 1);
      this.tone(pentatonic[idx], 0.2, 'triangle', 0.10, i * 0.08);
      // Harmonic sparkle
      if (i % 2 === 0) {
        this.tone(pentatonic[idx] * 2, 0.12, 'sine', 0.04, i * 0.08 + 0.02);
      }
    }
  }

  // Spirit burst dramatic sound
  playSpiritBurst(): void {
    if (!this.ac || !this.sfxGain) return;
    const t = this.ac.currentTime;

    // Deep impact
    const o1 = this.ac.createOscillator();
    o1.type = 'sine';
    o1.frequency.setValueAtTime(80, t);
    o1.frequency.exponentialRampToValueAtTime(30, t + 0.5);
    const g1 = this.ac.createGain();
    g1.gain.setValueAtTime(0.25, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o1.connect(g1); g1.connect(this.sfxGain);
    o1.start(t); o1.stop(t + 0.65);
    this.sched(o1, 0.7); this.sched(g1, 0.7);

    // Rising shimmer
    const o2 = this.ac.createOscillator();
    o2.type = 'sawtooth';
    o2.frequency.setValueAtTime(200, t + 0.1);
    o2.frequency.exponentialRampToValueAtTime(800, t + 0.4);
    const flt = this.ac.createBiquadFilter();
    flt.type = 'bandpass'; flt.frequency.value = 500; flt.Q.value = 3;
    const g2 = this.ac.createGain();
    g2.gain.setValueAtTime(0, t + 0.1);
    g2.gain.linearRampToValueAtTime(0.08, t + 0.2);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o2.connect(flt); flt.connect(g2); g2.connect(this.sfxGain);
    o2.start(t + 0.1); o2.stop(t + 0.55);
    this.sched(o2, 0.6); this.sched(flt, 0.6); this.sched(g2, 0.6);

    // Cascading chimes
    const chimes = [523.3, 659.3, 784.0, 1046.5];
    for (let i = 0; i < chimes.length; i++) {
      this.tone(chimes[i], 0.3, 'sine', 0.06, 0.15 + i * 0.05);
    }
  }
}

// ---------------------------------------------------------------------------
// §5  Procedural spirit rendering
// ---------------------------------------------------------------------------

function drawSpiritProc(
  ctx: CanvasRenderingContext2D,
  tier: number, x: number, y: number,
  r: number, angle: number, alpha = 1,
): void {
  const d = SPIRIT_DEFS[tier];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;

  // Outer glow
  const og = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.15);
  og.addColorStop(0, d.glowColor + '44');
  og.addColorStop(1, d.glowColor + '00');
  ctx.fillStyle = og;
  ctx.beginPath(); ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2); ctx.fill();

  // Main body gradient
  const bg = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.05, 0, 0, r);
  bg.addColorStop(0, lightenHex(d.baseColor, 50));
  bg.addColorStop(0.55, d.baseColor);
  bg.addColorStop(1, d.darkColor);
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

  // Tier detail
  drawTierDetail(ctx, tier, r);

  // Ink-wash texture (faint splotches)
  ctx.globalAlpha = alpha * 0.10;
  ctx.fillStyle = '#000';
  for (let i = 0; i < 4; i++) {
    const ox = Math.sin(i * 2.7 + tier * 1.3) * r * 0.45;
    const oy = Math.cos(i * 3.1 + tier * 0.9) * r * 0.45;
    ctx.beginPath(); ctx.arc(ox, oy, r * 0.16, 0, Math.PI * 2); ctx.fill();
  }

  // Highlight
  ctx.globalAlpha = alpha * 0.28;
  const hl = ctx.createRadialGradient(-r * 0.22, -r * 0.28, 0, -r * 0.22, -r * 0.28, r * 0.45);
  hl.addColorStop(0, 'rgba(255,255,255,0.7)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.beginPath(); ctx.arc(-r * 0.22, -r * 0.28, r * 0.45, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// §5.1  Enhanced spirit rendering — animated details
// ---------------------------------------------------------------------------

// Global animation time for spirit animations (set each frame from Game.animT)
let _spiritAnimTime = 0;

function drawSpiritAnimatedOverlay(
  ctx: CanvasRenderingContext2D,
  tier: number, x: number, y: number,
  r: number, _angle: number, alpha: number,
): void {
  const d = SPIRIT_DEFS[tier];
  const t = _spiritAnimTime;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;

  // 1) Glow pulse — all tiers get a breathing glow
  const breathCycle = Math.sin(t * 2.5 + tier * 0.8) * 0.5 + 0.5;
  const glowR = r * (1.2 + breathCycle * 0.25);
  const glowAlpha = 0.08 + breathCycle * 0.12;
  ctx.globalAlpha = alpha * glowAlpha;
  const gg = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, glowR);
  gg.addColorStop(0, d.glowColor + '33');
  gg.addColorStop(0.6, d.glowColor + '11');
  gg.addColorStop(1, d.glowColor + '00');
  ctx.fillStyle = gg;
  ctx.beginPath(); ctx.arc(0, 0, glowR, 0, Math.PI * 2); ctx.fill();

  // 2) Breathing scale effect (subtle body pulse)
  const breathScale = 1 + Math.sin(t * 2.0 + tier * 1.1) * 0.015;
  ctx.scale(breathScale, breathScale);

  // 3) Eye blink animation (applicable to tiers with eyes: 2-11)
  if (tier >= 2) {
    drawEyeBlink(ctx, tier, r, t);
  }

  // 4) Tier-specific animated features
  switch (tier) {
    case 0: animFirefly(ctx, r, t); break;
    case 1: animButterfly(ctx, r, t); break;
    case 2: animFishTail(ctx, r, t); break;
    case 3: animRabbitEars(ctx, r, t); break;
    case 4: animCraneWings(ctx, r, t); break;
    case 5: animDeerAntlers(ctx, r, t); break;
    case 6: animTigerBreath(ctx, r, t); break;
    case 7: animTurtleShell(ctx, r, t); break;
    case 8: animPhoenixEmbers(ctx, r, t); break;
    case 9: animQilinFlames(ctx, r, t); break;
    case 10: animDragonWhiskers(ctx, r, t); break;
    case 11: animChaosOrbit(ctx, r, t); break;
  }

  ctx.restore();
}

// Eye blink: every few seconds, eyes close briefly
function drawEyeBlink(
  ctx: CanvasRenderingContext2D, tier: number, r: number, t: number,
): void {
  // Blink cycle: open most of the time, quick close every ~3.5s
  const blinkPeriod = 3.5 + (tier % 3) * 0.5;
  const blinkPhase = (t % blinkPeriod) / blinkPeriod;
  // Blink happens in last 5% of cycle
  if (blinkPhase > 0.95) {
    const blinkProgress = (blinkPhase - 0.95) / 0.05;
    const squish = Math.sin(blinkProgress * Math.PI); // 0 -> 1 -> 0
    // Draw eyelid overlay
    ctx.globalAlpha *= 0.7;
    ctx.fillStyle = SPIRIT_DEFS[tier].darkColor;

    // Generic eye positions based on tier
    const eyePositions = getEyePositions(tier, r);
    for (const [ex, ey, eSize] of eyePositions) {
      ctx.beginPath();
      ctx.ellipse(ex, ey, eSize * 1.3, eSize * squish * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function getEyePositions(tier: number, r: number): [number, number, number][] {
  switch (tier) {
    case 2: return [[-r * 0.3, -r * 0.12, r * 0.06]];
    case 3: return [[-r * 0.17, -r * 0.02, r * 0.055], [r * 0.17, -r * 0.02, r * 0.055]];
    case 4: return [[0, -r * 0.2, r * 0.04]];
    case 5: return [[-r * 0.15, -r * 0.05, r * 0.04], [r * 0.15, -r * 0.05, r * 0.04]];
    case 6: return [[-r * 0.2, -r * 0.1, r * 0.06], [r * 0.2, -r * 0.1, r * 0.06]];
    case 7: return [[-r * 0.04, -r * 0.65, r * 0.025], [r * 0.04, -r * 0.65, r * 0.025]];
    case 8: return [[-r * 0.05, -r * 0.12, r * 0.03], [r * 0.05, -r * 0.12, r * 0.03]];
    case 9: return [[-r * 0.12, -r * 0.15, r * 0.04], [r * 0.12, -r * 0.15, r * 0.04]];
    case 10: return [[-r * 0.16, -r * 0.08, r * 0.05], [r * 0.16, -r * 0.08, r * 0.05]];
    case 11: return [[-r * 0.08, 0, r * 0.04], [r * 0.08, 0, r * 0.04]];
    default: return [];
  }
}

// Tier 0: Firefly — tiny glow particles orbiting
function animFirefly(ctx: CanvasRenderingContext2D, r: number, t: number): void {
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 4; i++) {
    const angle = t * 3 + (i / 4) * Math.PI * 2;
    const dist = r * 0.7 + Math.sin(t * 4 + i * 1.5) * r * 0.15;
    const px = Math.cos(angle) * dist;
    const py = Math.sin(angle) * dist;
    const gSize = 2 + Math.sin(t * 6 + i * 2) * 1;

    const grd = ctx.createRadialGradient(px, py, 0, px, py, gSize * 2);
    grd.addColorStop(0, '#ccffee');
    grd.addColorStop(0.5, '#00ffcc44');
    grd.addColorStop(1, '#00ffcc00');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(px, py, gSize * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Tier 1: Butterfly — wing flap animation
function animButterfly(ctx: CanvasRenderingContext2D, r: number, t: number): void {
  const flapAngle = Math.sin(t * 5) * 0.3;
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#aaccff';

  ctx.save();
  ctx.rotate(flapAngle);
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -r * 0.05, r * 0.15, r * 0.1, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.rotate(-flapAngle);
  ctx.beginPath();
  ctx.ellipse(r * 0.35, -r * 0.05, r * 0.15, r * 0.1, 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Tier 2: Fish — tail wag
function animFishTail(ctx: CanvasRenderingContext2D, r: number, t: number): void {
  const wag = Math.sin(t * 4) * r * 0.12;
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#55dd99';
  ctx.beginPath();
  ctx.moveTo(r * 0.5, 0);
  ctx.lineTo(r * 0.85 + wag, -r * 0.25);
  ctx.quadraticCurveTo(r * 0.7, 0, r * 0.85 + wag, r * 0.25);
  ctx.closePath();
  ctx.fill();
}

// Tier 3: Rabbit — ear twitch
function animRabbitEars(ctx: CanvasRenderingContext2D, r: number, t: number): void {
  // Occasional ear twitch
  const twitchCycle = t % 4;
  if (twitchCycle > 3.5 && twitchCycle < 3.8) {
    const twitch = Math.sin((twitchCycle - 3.5) * Math.PI / 0.3) * 0.15;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#ffe088';
    ctx.beginPath();
    ctx.ellipse(r * 0.22, -r * 0.55, r * 0.1, r * 0.28, 0.15 + twitch, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Tier 4: Crane — wing flap (slower, majestic)
function animCraneWings(ctx: CanvasRenderingContext2D, r: number, t: number): void {
  const flap = Math.sin(t * 1.5) * 0.12;
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = '#ffddbb';

  // Left wing extension
  ctx.save();
  ctx.rotate(-flap);
  ctx.beginPath();
  ctx.moveTo(-r * 0.05, 0);
  ctx.quadraticCurveTo(-r * 0.85, -r * 0.55, -r * 0.7, r * 0.1);
  ctx.quadraticCurveTo(-r * 0.3, 0, -r * 0.05, 0);
  ctx.fill();
  ctx.restore();

  // Right wing extension
  ctx.save();
  ctx.rotate(flap);
  ctx.beginPath();
  ctx.moveTo(r * 0.05, 0);
  ctx.quadraticCurveTo(r * 0.85, -r * 0.55, r * 0.7, r * 0.1);
  ctx.quadraticCurveTo(r * 0.3, 0, r * 0.05, 0);
  ctx.fill();
  ctx.restore();
}

// Tier 5: Deer — antler glow shimmer
function animDeerAntlers(ctx: CanvasRenderingContext2D, r: number, t: number): void {
  const shimmer = Math.sin(t * 3) * 0.5 + 0.5;
  ctx.globalAlpha = shimmer * 0.25;
  ctx.fillStyle = '#ffee88';

  // Glow points at antler tips
  const tips = [
    [-r * 0.12 + -1 * r * 0.35, -r * 0.55],
    [-r * 0.12 + -1 * r * 0.05, -r * 0.82],
    [r * 0.12 + 1 * r * 0.35, -r * 0.55],
    [r * 0.12 + 1 * r * 0.05, -r * 0.82],
  ];
  for (const [tx, ty] of tips) {
    const grd = ctx.createRadialGradient(tx, ty, 0, tx, ty, r * 0.1);
    grd.addColorStop(0, '#ffee88');
    grd.addColorStop(1, '#ffee8800');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(tx, ty, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Tier 6: Tiger — fierce breathing effect (nostrils flare)
function animTigerBreath(ctx: CanvasRenderingContext2D, r: number, t: number): void {
  const breath = Math.sin(t * 2) * 0.5 + 0.5;
  ctx.globalAlpha = breath * 0.2;
  // Breath mist from nose area
  ctx.fillStyle = '#bb55ff33';
  const breathSize = r * 0.15 + breath * r * 0.08;
  ctx.beginPath();
  ctx.arc(0, r * 0.15, breathSize, 0, Math.PI * 2);
  ctx.fill();

  // Eye glow intensifies with breath
  ctx.globalAlpha = 0.15 + breath * 0.15;
  const eyeGlow = ctx.createRadialGradient(-r * 0.2, -r * 0.1, 0, -r * 0.2, -r * 0.1, r * 0.12);
  eyeGlow.addColorStop(0, '#ffcc0088');
  eyeGlow.addColorStop(1, '#ffcc0000');
  ctx.fillStyle = eyeGlow;
  ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.1, r * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(r * 0.2, -r * 0.1, r * 0.12, 0, Math.PI * 2); ctx.fill();
}

// Tier 7: Turtle — shell segments pulse
function animTurtleShell(ctx: CanvasRenderingContext2D, r: number, t: number): void {
  ctx.globalAlpha = 0.15;
  // Hex segments glow in sequence
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const phase = (Math.sin(t * 2 + i * 1.05) * 0.5 + 0.5);
    ctx.globalAlpha = phase * 0.15;
    ctx.fillStyle = '#ff6688';
    const hx = Math.cos(a) * r * 0.36;
    const hy = Math.sin(a) * r * 0.36;
    ctx.beginPath();
    for (let j = 0; j < 6; j++) {
      const ha = (j / 6) * Math.PI * 2 - Math.PI / 6;
      const px = hx + Math.cos(ha) * r * 0.16;
      const py = hy + Math.sin(ha) * r * 0.16;
      j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
}

// Tier 8: Phoenix — ember particles rising
function animPhoenixEmbers(ctx: CanvasRenderingContext2D, r: number, t: number): void {
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 8; i++) {
    const seed = i * 1.7 + 0.5;
    const lifetime = (t * 1.5 + seed) % 2.0;
    const ey = -lifetime * r * 0.6;
    const ex = Math.sin(t * 2 + seed * 3) * r * 0.3;
    const size = (1 - lifetime / 2.0) * 2.5;
    const eAlpha = (1 - lifetime / 2.0) * 0.6;

    ctx.globalAlpha = eAlpha;
    ctx.fillStyle = i % 2 === 0 ? '#ff6633' : '#ffaa22';
    ctx.beginPath();
    ctx.arc(ex, ey, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Tier 9: Qilin — flame mane flicker
function animQilinFlames(ctx: CanvasRenderingContext2D, r: number, t: number): void {
  ctx.globalAlpha = 0.2;
  for (let i = 0; i < 5; i++) {
    const fx = (i - 2) * r * 0.14;
    const flicker = Math.sin(t * 6 + i * 1.8) * r * 0.05;
    const fHeight = r * 0.2 + Math.sin(t * 4 + i * 2.3) * r * 0.06;
    ctx.fillStyle = i % 2 === 0 ? '#ff668888' : '#ffaa4488';
    ctx.beginPath();
    ctx.ellipse(fx + flicker, -r * 0.33 - fHeight * 0.3, r * 0.06, fHeight, (i - 2) * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  // Horn glow
  const hornGlow = Math.sin(t * 3) * 0.5 + 0.5;
  ctx.globalAlpha = hornGlow * 0.3;
  const hg = ctx.createRadialGradient(0, -r * 0.78, 0, 0, -r * 0.78, r * 0.15);
  hg.addColorStop(0, '#ffee88');
  hg.addColorStop(1, '#ffee8800');
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.arc(0, -r * 0.78, r * 0.15, 0, Math.PI * 2); ctx.fill();
}

// Tier 10: Dragon — whisker sway + eye fire
function animDragonWhiskers(ctx: CanvasRenderingContext2D, r: number, t: number): void {
  const sway = Math.sin(t * 2) * r * 0.08;
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = '#88ffbb';
  ctx.lineWidth = 1.2;

  // Animated whiskers
  ctx.beginPath();
  ctx.moveTo(-r * 0.12, r * 0.05);
  ctx.quadraticCurveTo(-r * 0.45 + sway, -r * 0.08, -r * 0.55 + sway * 1.5, r * 0.12);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r * 0.12, r * 0.05);
  ctx.quadraticCurveTo(r * 0.45 - sway, -r * 0.08, r * 0.55 - sway * 1.5, r * 0.12);
  ctx.stroke();

  // Glowing eyes with fire trail
  for (const dir of [-1, 1]) {
    const ex = dir * r * 0.16;
    const ey = -r * 0.08;
    ctx.globalAlpha = 0.3;
    const eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, r * 0.1);
    eg.addColorStop(0, '#ff333388');
    eg.addColorStop(1, '#ff333300');
    ctx.fillStyle = eg;
    ctx.beginPath(); ctx.arc(ex, ey, r * 0.1, 0, Math.PI * 2); ctx.fill();

    // Fire trail behind eyes
    for (let i = 1; i <= 3; i++) {
      const tx = ex + dir * i * r * 0.06 + Math.sin(t * 5 + i) * r * 0.02;
      const ty = ey + i * r * 0.02;
      ctx.globalAlpha = 0.15 / i;
      ctx.fillStyle = '#ff6633';
      ctx.beginPath(); ctx.arc(tx, ty, r * 0.03, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// Tier 11: Chaos — orbiting prismatic sparks with trails
function animChaosOrbit(ctx: CanvasRenderingContext2D, r: number, t: number): void {
  const spectrum = ['#ff4444', '#ffaa44', '#ffff44', '#44ff44', '#4488ff', '#aa44ff'];

  // Orbiting energy wisps
  for (let i = 0; i < 12; i++) {
    const orbitSpeed = 0.8 + (i % 3) * 0.3;
    const orbitRadius = r * (0.4 + (i % 4) * 0.1);
    const angle = t * orbitSpeed + (i / 12) * Math.PI * 2;
    const ox = Math.cos(angle) * orbitRadius;
    const oy = Math.sin(angle) * orbitRadius * 0.7; // squished orbit

    ctx.globalAlpha = 0.3 + Math.sin(t * 3 + i) * 0.15;
    ctx.fillStyle = spectrum[i % spectrum.length];
    ctx.beginPath();
    ctx.arc(ox, oy, r * 0.03, 0, Math.PI * 2);
    ctx.fill();

    // Trail
    for (let trail = 1; trail <= 3; trail++) {
      const ta = angle - trail * 0.15;
      const tx = Math.cos(ta) * orbitRadius;
      const ty = Math.sin(ta) * orbitRadius * 0.7;
      ctx.globalAlpha = (0.15 - trail * 0.04);
      ctx.beginPath();
      ctx.arc(tx, ty, r * 0.02, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Central pulsing energy
  const pulse = Math.sin(t * 4) * 0.5 + 0.5;
  ctx.globalAlpha = 0.15 + pulse * 0.1;
  const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.3);
  cg.addColorStop(0, '#ffffff44');
  cg.addColorStop(1, '#ffffff00');
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2); ctx.fill();
}

// ---------------------------------------------------------------------------
// §5.2  Tier-specific ambient particle aura system
// ---------------------------------------------------------------------------

interface AuraParticle {
  spiritId: number;
  ox: number;    // offset from spirit center
  oy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  vx: number;
  vy: number;
}

class SpiritAuraSystem {
  particles: AuraParticle[] = [];
  private timer = 0;
  private readonly MAX_AURA = 120;

  update(spirits: Spirit[], dt: number): void {
    this.timer += dt;

    // Emit new aura particles periodically
    if (this.timer >= 0.15) {
      this.timer = 0;
      for (const s of spirits) {
        if (s.merged || s.sleeping) continue;
        if (this.particles.length >= this.MAX_AURA) break;

        // Only high-detail auras for certain tiers
        if (s.tier === 0) {
          // Firefly: tiny glowing dots
          this.particles.push(this.makeAura(s, '#00ffcc', 1.5, 1.2, 0.3));
        } else if (s.tier === 8) {
          // Phoenix: ember particles
          this.particles.push(this.makeAura(s, Math.random() > 0.5 ? '#ff7744' : '#ffcc44', 2, 1.0, 0.5));
        } else if (s.tier === 11) {
          // Chaos: prismatic
          const spec = ['#ff4444', '#ffaa44', '#44ff44', '#4488ff', '#aa44ff'];
          this.particles.push(this.makeAura(s, spec[Math.floor(Math.random() * spec.length)], 1.8, 1.5, 0.4));
        } else if (s.tier >= 6) {
          // High tiers: subtle aura
          if (Math.random() < 0.3) {
            this.particles.push(this.makeAura(s, SPIRIT_DEFS[s.tier].glowColor, 1.2, 1.0, 0.2));
          }
        }
      }
    }

    // Update existing
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.ox += p.vx * dt;
      p.oy += p.vy * dt;
      p.vy -= 15 * dt; // float upward
      p.life -= dt;
      if (p.life <= 0) {
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
      }
    }
  }

  private makeAura(s: Spirit, color: string, size: number, life: number, spread: number): AuraParticle {
    const angle = Math.random() * Math.PI * 2;
    const dist = s.radius * (0.8 + Math.random() * 0.4);
    return {
      spiritId: s.id,
      ox: Math.cos(angle) * dist,
      oy: Math.sin(angle) * dist,
      size: size * (0.5 + Math.random() * 0.5),
      life, maxLife: life,
      color,
      vx: rnd(-spread, spread) * 20,
      vy: rnd(-spread, spread) * 20 - 10,
    };
  }

  draw(ctx: CanvasRenderingContext2D, spirits: Spirit[]): void {
    const spiritMap = new Map<number, Spirit>();
    for (const s of spirits) {
      if (!s.merged) spiritMap.set(s.id, s);
    }

    for (const p of this.particles) {
      const s = spiritMap.get(p.spiritId);
      if (!s) continue;
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = a * 0.5;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(s.x + p.ox, s.y + p.oy, p.size * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// §5.3  Enhanced merge effects
// ---------------------------------------------------------------------------

// Spiral ink explosion particle system
interface SpiralParticle {
  x: number; y: number;
  angle: number;
  dist: number;
  speed: number;
  angularSpeed: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

class SpiralExplosionSystem {
  particles: SpiralParticle[] = [];
  private readonly MAX_SPIRAL = 200;

  emit(x: number, y: number, tier: number): void {
    const d = SPIRIT_DEFS[tier];
    const group = tierColorGroup(tier);
    const accents = GROUP_ACCENTS[group];
    const count = Math.min(22 + tier * 3, this.MAX_SPIRAL - this.particles.length);

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 40 + Math.random() * 60 + tier * 8;
      this.particles.push({
        x, y,
        angle,
        dist: 0,
        speed,
        angularSpeed: 3 + Math.random() * 4, // spiral rotation
        life: 0.6 + Math.random() * 0.4,
        maxLife: 0.6 + Math.random() * 0.4,
        size: 1.5 + Math.random() * 2.5,
        color: i % 3 === 0 ? d.baseColor : accents[i % accents.length],
      });
    }
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.dist += p.speed * dt;
      p.angle += p.angularSpeed * dt;
      p.angularSpeed *= 0.97; // slow rotation
      p.life -= dt;
      if (p.life <= 0) {
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      const px = p.x + Math.cos(p.angle) * p.dist;
      const py = p.y + Math.sin(p.angle) * p.dist;

      ctx.globalAlpha = a * 0.7;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px, py, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
      ctx.fill();

      // Ink trail
      if (p.dist > 5) {
        const trailDist = p.dist - 4;
        const tx = p.x + Math.cos(p.angle - 0.2) * trailDist;
        const ty = p.y + Math.sin(p.angle - 0.2) * trailDist;
        ctx.globalAlpha = a * 0.2;
        ctx.beginPath();
        ctx.arc(tx, ty, p.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

// Ring shockwave effect (expanding concentric ring on merge)
interface ShockwaveRing {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  maxRadius: number;
  color: string;
  thickness: number;
}

class ShockwaveSystem {
  rings: ShockwaveRing[] = [];

  emit(x: number, y: number, tier: number): void {
    const d = SPIRIT_DEFS[tier];
    const maxR = d.radius * 2.5 + tier * 5;
    this.rings.push({
      x, y,
      life: 0.5, maxLife: 0.5,
      maxRadius: maxR,
      color: d.glowColor,
      thickness: 2 + tier * 0.3,
    });
    // Secondary ring slightly delayed
    if (tier >= 4) {
      this.rings.push({
        x, y,
        life: 0.65, maxLife: 0.65,
        maxRadius: maxR * 1.3,
        color: d.baseColor,
        thickness: 1.5,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i].life -= dt;
      if (this.rings[i].life <= 0) {
        this.rings.splice(i, 1);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const ring of this.rings) {
      const prog = 1 - ring.life / ring.maxLife;
      const r = ring.maxRadius * prog;
      const alpha = (1 - prog) * 0.5;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = ring.thickness * (1 - prog * 0.7);
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

// Freeze frame manager for high-tier merges
class FreezeFrameManager {
  private freezeRemaining = 0;
  private active = false;

  trigger(duration: number): void {
    this.freezeRemaining = duration;
    this.active = true;
  }

  consume(dt: number): { frozen: boolean; adjustedDt: number } {
    if (!this.active) return { frozen: false, adjustedDt: dt };
    this.freezeRemaining -= dt;
    if (this.freezeRemaining <= 0) {
      this.active = false;
      // Return remaining dt after freeze ends
      return { frozen: false, adjustedDt: Math.max(0, -this.freezeRemaining) };
    }
    return { frozen: true, adjustedDt: 0 };
  }
}

// ---------------------------------------------------------------------------
// §5.4  Spirit Burst (灵气爆发) enhanced event system
// ---------------------------------------------------------------------------

interface SpiritBurstState {
  active: boolean;
  timer: number;      // remaining time
  intensity: number;  // vibration intensity
}

function initSpiritBurstState(): SpiritBurstState {
  return { active: false, timer: 0, intensity: 0 };
}

function triggerSpiritBurst(state: SpiritBurstState): void {
  state.active = true;
  state.timer = 0.5;
  state.intensity = 1.0;
}

function updateSpiritBurst(state: SpiritBurstState, spirits: Spirit[], dt: number): void {
  if (!state.active) return;
  state.timer -= dt;
  state.intensity = clamp(state.timer / 0.5, 0, 1);

  // Violently vibrate all spirits
  for (const s of spirits) {
    if (s.merged) continue;
    s.sleeping = false;
    const vibeX = rnd(-1, 1) * 12 * state.intensity;
    const vibeY = rnd(-1, 1) * 12 * state.intensity;
    s.vx += vibeX;
    s.vy += vibeY;
  }

  if (state.timer <= 0) {
    state.active = false;
  }
}

function drawSpiritBurstOverlay(
  ctx: CanvasRenderingContext2D,
  state: SpiritBurstState,
  _t: number,
): void {
  if (!state.active) return;
  const alpha = state.intensity * 0.15;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffcc44';
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// §5.5  Share card generation at game over
// ---------------------------------------------------------------------------

function generateShareCard(
  score: number,
  maxTier: number,
  combo: number,
  nickname: string,
  stamps: SealStamp[],
): HTMLCanvasElement {
  const cw = 600, ch = 400;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, ch);
  bg.addColorStop(0, '#0a0a2e');
  bg.addColorStop(0.5, '#121240');
  bg.addColorStop(1, '#0a0a28');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cw, ch);

  // Stars
  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = 0.3 + Math.random() * 0.5;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(Math.random() * cw, Math.random() * ch, 0.5 + Math.random() * 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Decorative border
  ctx.strokeStyle = '#6644aa44';
  ctx.lineWidth = 2;
  ctx.strokeRect(15, 15, cw - 30, ch - 30);
  ctx.strokeStyle = '#8866cc22';
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 20, cw - 40, ch - 40);

  // Title
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 32px "Noto Serif SC", serif';
  ctx.fillStyle = '#eeddff';
  ctx.fillText('合灵演化', cw / 2, 55);
  ctx.font = '14px "Noto Serif SC", serif';
  ctx.fillStyle = '#8877aa';
  ctx.fillText('Spirit Merge — Melo\'s Quest 8', cw / 2, 82);

  // Score
  ctx.font = 'bold 48px "Noto Serif SC", serif';
  ctx.fillStyle = '#ffddaa';
  ctx.fillText(`${score}`, cw / 2, 140);
  ctx.font = '14px "Noto Serif SC", serif';
  ctx.fillStyle = '#aa9977';
  ctx.fillText('修炼积分', cw / 2, 170);

  // Stats row
  const statsY = 210;
  ctx.font = '14px "Noto Serif SC", serif';

  // Nickname
  ctx.fillStyle = '#9988bb';
  ctx.textAlign = 'left';
  ctx.fillText(`道号: ${nickname}`, 45, statsY);

  // Max tier
  if (maxTier > 0) {
    ctx.fillStyle = '#ccbbee';
    ctx.fillText(`最高灵兽: ${SPIRIT_DEFS[maxTier].name}`, 45, statsY + 25);
  }

  // Combo
  ctx.fillStyle = '#ccbbee';
  ctx.fillText(`最高连合: ${combo}`, 45, statsY + 50);

  // Draw spirit icon for max tier
  if (maxTier > 0) {
    const sd = SPIRIT_DEFS[maxTier];
    const iconX = cw - 100;
    const iconY = statsY + 20;
    const iconR = sd.radius * 0.5;

    // Simple spirit circle (no rotation needed for share card)
    const ig = ctx.createRadialGradient(iconX, iconY, iconR * 0.2, iconX, iconY, iconR);
    ig.addColorStop(0, lightenHex(sd.baseColor, 50));
    ig.addColorStop(0.55, sd.baseColor);
    ig.addColorStop(1, sd.darkColor);
    ctx.fillStyle = ig;
    ctx.beginPath(); ctx.arc(iconX, iconY, iconR, 0, Math.PI * 2); ctx.fill();

    ctx.textAlign = 'center';
    ctx.font = '11px "Noto Serif SC", serif';
    ctx.fillStyle = '#ccbbee';
    ctx.fillText(sd.name, iconX, iconY + iconR + 14);
  }

  // Seal stamps row
  const stampY = 320;
  ctx.textAlign = 'center';
  ctx.font = '12px "Noto Serif SC", serif';
  ctx.fillStyle = '#cc4444';
  ctx.fillText('灵印集', cw / 2, stampY - 20);

  const stampSize = 36;
  const stampSpacing = 50;
  const stampStartX = cw / 2 - ((stamps.length - 1) * stampSpacing) / 2;

  for (let i = 0; i < stamps.length; i++) {
    const sx = stampStartX + i * stampSpacing;
    const stamp = stamps[i];

    ctx.globalAlpha = stamp.unlocked ? 0.85 : 0.15;
    ctx.strokeStyle = stamp.unlocked ? '#cc2222' : '#444444';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx - stampSize / 2, stampY - stampSize / 2, stampSize, stampSize);
    ctx.strokeStyle = stamp.unlocked ? '#dd3333' : '#555555';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(sx - stampSize / 2 + 3, stampY - stampSize / 2 + 3, stampSize - 6, stampSize - 6);

    ctx.fillStyle = stamp.unlocked ? '#cc2222' : '#555555';
    ctx.font = `bold ${Math.round(stampSize * 0.28)}px "Noto Serif SC", serif`;
    if (stamp.name.length === 4) {
      const cs = stampSize * 0.14;
      ctx.fillText(stamp.name[0], sx - cs, stampY - cs);
      ctx.fillText(stamp.name[1], sx + cs, stampY - cs);
      ctx.fillText(stamp.name[2], sx - cs, stampY + cs);
      ctx.fillText(stamp.name[3], sx + cs, stampY + cs);
    } else {
      ctx.fillText(stamp.name, sx, stampY);
    }
  }
  ctx.globalAlpha = 1;

  // Footer
  ctx.font = '11px "Noto Serif SC", serif';
  ctx.fillStyle = '#555566';
  ctx.fillText('JoyBoy Games — Melo\'s Quest', cw / 2, ch - 25);

  return canvas;
}

// Share card overlay state
interface ShareCardState {
  visible: boolean;
  canvas: HTMLCanvasElement | null;
  fadeIn: number;
}

function initShareCardState(): ShareCardState {
  return { visible: false, canvas: null, fadeIn: 0 };
}

function showShareCard(state: ShareCardState, shareCanvas: HTMLCanvasElement): void {
  state.visible = true;
  state.canvas = shareCanvas;
  state.fadeIn = 0;
}

function updateShareCard(state: ShareCardState, dt: number): void {
  if (!state.visible) return;
  state.fadeIn = Math.min(state.fadeIn + dt * 3, 1);
}

function drawShareCard(
  ctx: CanvasRenderingContext2D,
  state: ShareCardState,
): void {
  if (!state.visible || !state.canvas) return;
  const alpha = state.fadeIn;
  ctx.save();
  ctx.globalAlpha = alpha * 0.8;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  ctx.globalAlpha = alpha;
  // Scale and center the share card
  const cardW = W - 40;
  const cardH = cardW * (state.canvas.height / state.canvas.width);
  const cardX = 20;
  const cardY = (H - cardH) / 2 - 30;
  ctx.drawImage(state.canvas, cardX, cardY, cardW, cardH);

  // Instructions
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#9988bb';
  ctx.font = '13px "Noto Serif SC", serif';
  ctx.fillText('长按截图分享', W / 2, cardY + cardH + 25);
  ctx.fillText('点击任意处关闭', W / 2, cardY + cardH + 48);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// §5.6  Enhanced tutorial overlay for first-time players
// ---------------------------------------------------------------------------

function isFirstTimePlaying(): boolean {
  try {
    return localStorage.getItem('sm8_tutorial_shown') !== 'true';
  } catch { return true; }
}

function markTutorialShown(): void {
  try {
    localStorage.setItem('sm8_tutorial_shown', 'true');
  } catch { /* */ }
}

function lightenHex(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + amt);
  const g = Math.min(255, ((n >> 8) & 0xff) + amt);
  const b = Math.min(255, (n & 0xff) + amt);
  return `rgb(${r},${g},${b})`;
}

// --- Per-tier detail drawings ---

function drawTierDetail(ctx: CanvasRenderingContext2D, tier: number, r: number): void {
  ctx.globalAlpha *= 1; // keep inherited alpha
  switch (tier) {
    case 0: tierFirefly(ctx, r); break;
    case 1: tierButterfly(ctx, r); break;
    case 2: tierFish(ctx, r); break;
    case 3: tierRabbit(ctx, r); break;
    case 4: tierCrane(ctx, r); break;
    case 5: tierDeer(ctx, r); break;
    case 6: tierTiger(ctx, r); break;
    case 7: tierTurtle(ctx, r); break;
    case 8: tierPhoenix(ctx, r); break;
    case 9: tierQilin(ctx, r); break;
    case 10: tierDragon(ctx, r); break;
    case 11: tierChaos(ctx, r); break;
  }
}

function tierFirefly(ctx: CanvasRenderingContext2D, r: number): void {
  // Bright core + radiating lines
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#ccffee';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#aaffdd';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.32, Math.sin(a) * r * 0.32);
    ctx.lineTo(Math.cos(a) * r * 0.65, Math.sin(a) * r * 0.65);
    ctx.stroke();
  }
}

function tierButterfly(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = '#bbddff';
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.05, r * 0.45, r * 0.32, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(r * 0.3, -r * 0.05, r * 0.45, r * 0.32, 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#88bbff';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(0, -r * 0.35); ctx.lineTo(0, r * 0.35); ctx.stroke();
  // Wing eye spots
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#4488cc';
  ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.05, r * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(r * 0.3, -r * 0.05, r * 0.12, 0, Math.PI * 2); ctx.fill();
}

function tierFish(ctx: CanvasRenderingContext2D, r: number): void {
  // Scale arcs
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = '#88ffcc';
  ctx.lineWidth = 0.7;
  for (let row = -2; row <= 2; row++) {
    for (let col = -2; col <= 2; col++) {
      const sx = col * r * 0.22 + (row % 2) * r * 0.11;
      const sy = row * r * 0.18;
      if (sx * sx + sy * sy < r * r * 0.55) {
        ctx.beginPath(); ctx.arc(sx, sy, r * 0.1, 0, Math.PI); ctx.stroke();
      }
    }
  }
  // Tail fan
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#55dd99';
  ctx.beginPath();
  ctx.moveTo(r * 0.5, 0);
  ctx.lineTo(r * 0.85, -r * 0.3);
  ctx.quadraticCurveTo(r * 0.7, 0, r * 0.85, r * 0.3);
  ctx.closePath(); ctx.fill();
  // Eye
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.12, r * 0.07, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.12, r * 0.03, 0, Math.PI * 2); ctx.fill();
}

function tierRabbit(ctx: CanvasRenderingContext2D, r: number): void {
  // Ears
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#ffe088';
  ctx.beginPath(); ctx.ellipse(-r * 0.22, -r * 0.55, r * 0.1, r * 0.28, -0.15, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(r * 0.22, -r * 0.55, r * 0.1, r * 0.28, 0.15, 0, Math.PI * 2); ctx.fill();
  // Inner ear pink
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#ffaaaa';
  ctx.beginPath(); ctx.ellipse(-r * 0.22, -r * 0.55, r * 0.05, r * 0.18, -0.15, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(r * 0.22, -r * 0.55, r * 0.05, r * 0.18, 0.15, 0, Math.PI * 2); ctx.fill();
  // Eyes
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = '#442200';
  ctx.beginPath(); ctx.arc(-r * 0.17, -r * 0.02, r * 0.055, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(r * 0.17, -r * 0.02, r * 0.055, 0, Math.PI * 2); ctx.fill();
  // Nose + mouth
  ctx.fillStyle = '#ff8866';
  ctx.beginPath(); ctx.arc(0, r * 0.1, r * 0.035, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#aa6644';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(0, r * 0.13); ctx.lineTo(-r * 0.08, r * 0.2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, r * 0.13); ctx.lineTo(r * 0.08, r * 0.2); ctx.stroke();
}

function tierCrane(ctx: CanvasRenderingContext2D, r: number): void {
  // Spread wings
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#ffddbb';
  // Left wing
  ctx.beginPath();
  ctx.moveTo(-r * 0.05, 0);
  ctx.quadraticCurveTo(-r * 0.8, -r * 0.5, -r * 0.65, r * 0.15);
  ctx.quadraticCurveTo(-r * 0.3, 0, -r * 0.05, 0);
  ctx.fill();
  // Right wing
  ctx.beginPath();
  ctx.moveTo(r * 0.05, 0);
  ctx.quadraticCurveTo(r * 0.8, -r * 0.5, r * 0.65, r * 0.15);
  ctx.quadraticCurveTo(r * 0.3, 0, r * 0.05, 0);
  ctx.fill();
  // Black wingtips
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, -r * 0.15);
  ctx.quadraticCurveTo(-r * 0.8, -r * 0.5, -r * 0.65, r * 0.15);
  ctx.lineTo(-r * 0.45, 0); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(r * 0.5, -r * 0.15);
  ctx.quadraticCurveTo(r * 0.8, -r * 0.5, r * 0.65, r * 0.15);
  ctx.lineTo(r * 0.45, 0); ctx.closePath(); ctx.fill();
  // Red crown
  ctx.globalAlpha = 0.65;
  ctx.fillStyle = '#ff3333';
  ctx.beginPath(); ctx.arc(0, -r * 0.3, r * 0.09, 0, Math.PI * 2); ctx.fill();
  // Beak
  ctx.fillStyle = '#dd9933';
  ctx.beginPath();
  ctx.moveTo(-r * 0.03, -r * 0.15);
  ctx.lineTo(0, -r * 0.05);
  ctx.lineTo(r * 0.03, -r * 0.15);
  ctx.closePath(); ctx.fill();
}

function tierDeer(ctx: CanvasRenderingContext2D, r: number): void {
  // Antlers
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = '#ddbb55';
  ctx.lineWidth = 1.8;
  const drawAntler = (sx: number, dir: number) => {
    ctx.beginPath();
    ctx.moveTo(sx, -r * 0.25);
    ctx.lineTo(sx + dir * r * 0.15, -r * 0.65);
    ctx.lineTo(sx + dir * r * 0.35, -r * 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx + dir * r * 0.15, -r * 0.65);
    ctx.lineTo(sx + dir * r * 0.05, -r * 0.82);
    ctx.stroke();
  };
  drawAntler(-r * 0.12, -1);
  drawAntler(r * 0.12, 1);
  // Spots
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#fff';
  const spots = [[0.1, 0.1], [-0.15, -0.05], [0.2, 0.2], [-0.05, 0.25]];
  for (const [sx, sy] of spots) {
    ctx.beginPath(); ctx.arc(sx * r, sy * r, r * 0.05, 0, Math.PI * 2); ctx.fill();
  }
  // Eyes
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#553311';
  ctx.beginPath(); ctx.arc(-r * 0.15, -r * 0.05, r * 0.04, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(r * 0.15, -r * 0.05, r * 0.04, 0, Math.PI * 2); ctx.fill();
}

function tierTiger(ctx: CanvasRenderingContext2D, r: number): void {
  // Stripes
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = '#220044';
  ctx.lineWidth = 2.2;
  for (let i = -2; i <= 2; i++) {
    const ox = i * r * 0.18;
    ctx.beginPath();
    ctx.moveTo(ox, -r * 0.38);
    ctx.quadraticCurveTo(ox + r * 0.08, 0, ox, r * 0.38);
    ctx.stroke();
  }
  // 王 character
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#220044';
  ctx.font = `bold ${r * 0.32}px "Noto Serif SC", serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('王', 0, -r * 0.32);
  // Eyes
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = '#ffcc00';
  ctx.beginPath(); ctx.ellipse(-r * 0.2, -r * 0.1, r * 0.09, r * 0.05, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(r * 0.2, -r * 0.1, r * 0.09, r * 0.05, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.1, r * 0.03, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(r * 0.2, -r * 0.1, r * 0.03, 0, Math.PI * 2); ctx.fill();
}

function tierTurtle(ctx: CanvasRenderingContext2D, r: number): void {
  // Hexagonal shell
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = '#ff6688';
  ctx.lineWidth = 1.3;
  hexShape(ctx, 0, 0, r * 0.22);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    hexShape(ctx, Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36, r * 0.18);
  }
  // Head peeks out top
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#ff8899';
  ctx.beginPath(); ctx.ellipse(0, -r * 0.62, r * 0.1, r * 0.16, 0, 0, Math.PI * 2); ctx.fill();
  // Eyes on head
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = '#220011';
  ctx.beginPath(); ctx.arc(-r * 0.04, -r * 0.65, r * 0.025, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(r * 0.04, -r * 0.65, r * 0.025, 0, Math.PI * 2); ctx.fill();
}

function hexShape(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
    const px = cx + Math.cos(a) * s;
    const py = cy + Math.sin(a) * s;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.stroke();
}

function tierPhoenix(ctx: CanvasRenderingContext2D, r: number): void {
  // Feather flames radiating out
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const len = r * (0.55 + Math.sin(i * 1.5) * 0.15);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = i % 2 === 0 ? '#ff7744' : '#ffcc44';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(
      Math.cos(a + 0.25) * len * 0.65, Math.sin(a + 0.25) * len * 0.65,
      Math.cos(a) * len, Math.sin(a) * len,
    );
    ctx.quadraticCurveTo(
      Math.cos(a - 0.25) * len * 0.65, Math.sin(a - 0.25) * len * 0.65,
      0, 0,
    );
    ctx.fill();
  }
  // Long tail feathers (3)
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = '#ff8855';
  ctx.lineWidth = 1.5;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(0, r * 0.2);
    ctx.quadraticCurveTo(i * r * 0.3, r * 0.6, i * r * 0.15, r * 0.9);
    ctx.stroke();
  }
  // Crown / crest
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(0, -r * 0.12, r * 0.1, 0, Math.PI * 2); ctx.fill();
  // Eyes
  ctx.fillStyle = '#ff2222';
  ctx.beginPath(); ctx.arc(-r * 0.05, -r * 0.12, r * 0.025, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(r * 0.05, -r * 0.12, r * 0.025, 0, Math.PI * 2); ctx.fill();
}

function tierQilin(ctx: CanvasRenderingContext2D, r: number): void {
  // Cloud swirls
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = '#ffaacc';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const cx = Math.cos(a) * r * 0.33;
    const cy = Math.sin(a) * r * 0.33;
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.14, a, a + Math.PI * 1.4); ctx.stroke();
  }
  // Horn
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = '#ffdd88';
  ctx.beginPath();
  ctx.moveTo(-r * 0.04, -r * 0.3);
  ctx.lineTo(0, -r * 0.78);
  ctx.lineTo(r * 0.04, -r * 0.3);
  ctx.closePath(); ctx.fill();
  // Flame mane
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#ff6688';
  for (let i = 0; i < 4; i++) {
    const fx = (i - 1.5) * r * 0.14;
    ctx.beginPath();
    ctx.ellipse(fx, -r * 0.33, r * 0.07, r * 0.18, (i - 1.5) * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Scales on body
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = '#ff88aa';
  ctx.lineWidth = 0.6;
  for (let row = 0; row < 3; row++) {
    for (let col = -1; col <= 1; col++) {
      const sx = col * r * 0.2 + (row % 2) * r * 0.1;
      const sy = r * 0.05 + row * r * 0.15;
      ctx.beginPath(); ctx.arc(sx, sy, r * 0.08, 0, Math.PI); ctx.stroke();
    }
  }
}

function tierDragon(ctx: CanvasRenderingContext2D, r: number): void {
  // Serpentine body curve
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = '#aaffcc';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-r * 0.45, r * 0.3);
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    ctx.lineTo(
      -r * 0.45 + t * r * 0.9,
      r * 0.3 + Math.sin(t * Math.PI * 3) * r * 0.18,
    );
  }
  ctx.stroke();
  // Horns
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = '#77ffaa';
  ctx.beginPath();
  ctx.moveTo(-r * 0.18, -r * 0.15);
  ctx.lineTo(-r * 0.32, -r * 0.65);
  ctx.lineTo(-r * 0.05, -r * 0.25); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(r * 0.18, -r * 0.15);
  ctx.lineTo(r * 0.32, -r * 0.65);
  ctx.lineTo(r * 0.05, -r * 0.25); ctx.fill();
  // Glowing eyes
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#ff3333';
  ctx.beginPath(); ctx.arc(-r * 0.16, -r * 0.08, r * 0.05, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(r * 0.16, -r * 0.08, r * 0.05, 0, Math.PI * 2); ctx.fill();
  // Whiskers
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = '#88ffbb';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-r * 0.12, r * 0.05);
  ctx.quadraticCurveTo(-r * 0.45, -r * 0.08, -r * 0.55, r * 0.12);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r * 0.12, r * 0.05);
  ctx.quadraticCurveTo(r * 0.45, -r * 0.08, r * 0.55, r * 0.12);
  ctx.stroke();
  // Scales along body
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = '#66eebb';
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 5; i++) {
    const bx = -r * 0.3 + i * r * 0.15;
    const by = r * 0.3 + Math.sin((i / 8) * Math.PI * 3) * r * 0.15;
    ctx.beginPath(); ctx.arc(bx, by, r * 0.06, 0, Math.PI); ctx.stroke();
  }
}

function tierChaos(ctx: CanvasRenderingContext2D, r: number): void {
  // Prismatic concentric arcs
  const spectrum = ['#ff4444', '#ffaa44', '#ffff44', '#44ff44', '#4488ff', '#aa44ff'];
  ctx.lineWidth = 2;
  for (let i = 0; i < spectrum.length; i++) {
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = spectrum[i];
    const rr = r * (0.28 + i * 0.1);
    ctx.beginPath();
    ctx.arc(0, 0, rr, (i / spectrum.length) * Math.PI * 2, (i / spectrum.length) * Math.PI * 2 + Math.PI * 1.15);
    ctx.stroke();
  }
  // Taiji (yin-yang) in center
  ctx.globalAlpha = 0.5;
  const tr = r * 0.18;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, tr, -Math.PI / 2, Math.PI / 2);
  ctx.arc(0, tr * 0.5, tr * 0.5, Math.PI / 2, -Math.PI / 2, true);
  ctx.arc(0, -tr * 0.5, tr * 0.5, Math.PI / 2, -Math.PI / 2);
  ctx.fill();
  ctx.fillStyle = '#1a0a20';
  ctx.beginPath();
  ctx.arc(0, 0, tr, Math.PI / 2, -Math.PI / 2);
  ctx.arc(0, -tr * 0.5, tr * 0.5, -Math.PI / 2, Math.PI / 2, true);
  ctx.arc(0, tr * 0.5, tr * 0.5, -Math.PI / 2, Math.PI / 2);
  ctx.fill();
  // Orbiting sparks
  ctx.globalAlpha = 0.55;
  const t = performance.now() / 1000;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + t * 0.5;
    const ox = Math.cos(a) * r * 0.55;
    const oy = Math.sin(a) * r * 0.55;
    ctx.fillStyle = spectrum[i % spectrum.length];
    ctx.beginPath(); ctx.arc(ox, oy, r * 0.035, 0, Math.PI * 2); ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// §6  Drawing utilities
// ---------------------------------------------------------------------------

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rad: number): void {
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.arcTo(x + w, y, x + w, y + rad, rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
  ctx.lineTo(x + rad, y + h);
  ctx.arcTo(x, y + h, x, y + h - rad, rad);
  ctx.lineTo(x, y + rad);
  ctx.arcTo(x, y, x + rad, y, rad);
  ctx.closePath();
}

function drawTextWithShadow(
  ctx: CanvasRenderingContext2D, text: string,
  x: number, y: number,
  fillColor: string, shadowColor: string, blur: number,
): void {
  ctx.save();
  ctx.shadowColor = shadowColor;
  ctx.shadowBlur = blur;
  ctx.fillStyle = fillColor;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// §7  Merge animation data
// ---------------------------------------------------------------------------

interface MergeAnim {
  x: number; y: number;
  tier: number;
  t0: number;
  dur: number;
}

// ---------------------------------------------------------------------------
// §7.1  Score popup (floating text)
// ---------------------------------------------------------------------------

interface ScorePopup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

class ScorePopupSystem {
  popups: ScorePopup[] = [];

  add(x: number, y: number, text: string, color: string, size = 16, life = 1.2): void {
    this.popups.push({ x, y, text, color, life, maxLife: life, size });
  }

  update(dt: number): void {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.y -= 40 * dt;     // float upward
      p.life -= dt;
      if (p.life <= 0) {
        this.popups[i] = this.popups[this.popups.length - 1];
        this.popups.pop();
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of this.popups) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      const scale = 1 + (1 - a) * 0.3;     // slight scale-up as it fades
      ctx.globalAlpha = a;
      ctx.font = `bold ${Math.round(p.size * scale)}px "Noto Serif SC", serif`;
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// §7.2  Background cloud layer
// ---------------------------------------------------------------------------

interface BgCloud {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  opacity: number;
}

function makeClouds(n: number): BgCloud[] {
  const out: BgCloud[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      x: Math.random() * W,
      y: rnd(100, H - 100),
      w: rnd(60, 160),
      h: rnd(20, 50),
      speed: rnd(3, 12),
      opacity: rnd(0.015, 0.04),
    });
  }
  return out;
}

function updateClouds(clouds: BgCloud[], dt: number): void {
  for (const c of clouds) {
    c.x += c.speed * dt;
    if (c.x > W + c.w) {
      c.x = -c.w;
      c.y = rnd(100, H - 100);
    }
  }
}

function drawClouds(ctx: CanvasRenderingContext2D, clouds: BgCloud[]): void {
  for (const c of clouds) {
    ctx.globalAlpha = c.opacity;
    ctx.fillStyle = '#8888cc';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Second smaller ellipse offset for more natural shape
    ctx.beginPath();
    ctx.ellipse(c.x + c.w * 0.2, c.y - c.h * 0.15, c.w * 0.35, c.h * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// §7.3  Spirit trail effect (motion blur hint)
// ---------------------------------------------------------------------------

interface TrailPoint {
  x: number;
  y: number;
  tier: number;
  radius: number;
  age: number;
}

class TrailSystem {
  trails: TrailPoint[] = [];
  private timer = 0;

  addFromSpirits(spirits: Spirit[], dt: number): void {
    this.timer += dt;
    // Only add trail points every ~50ms and only for fast-moving spirits
    if (this.timer < 0.05) return;
    this.timer = 0;
    for (const s of spirits) {
      if (s.merged || s.sleeping) continue;
      const speed = v2len(s.vx, s.vy);
      if (speed > 150) {
        this.trails.push({ x: s.x, y: s.y, tier: s.tier, radius: s.radius * 0.5, age: 0 });
      }
    }
    // Hard limit trails
    while (this.trails.length > 60) this.trails.shift();
  }

  update(dt: number): void {
    for (let i = this.trails.length - 1; i >= 0; i--) {
      this.trails[i].age += dt;
      if (this.trails[i].age > 0.3) {
        this.trails[i] = this.trails[this.trails.length - 1];
        this.trails.pop();
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const t of this.trails) {
      const a = 1 - t.age / 0.3;
      ctx.globalAlpha = a * 0.15;
      ctx.fillStyle = SPIRIT_DEFS[t.tier].glowColor;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// §7.4  Tutorial overlay
// ---------------------------------------------------------------------------

interface TutorialStep {
  text: string;
  subtext: string;
  duration: number;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  { text: '拖动 移动灵体', subtext: 'Drag to position', duration: 2.5 },
  { text: '松手 释放灵体', subtext: 'Release to drop', duration: 2.5 },
  { text: '同灵相触 合而为一', subtext: 'Matching spirits merge!', duration: 3.0 },
  { text: '十二阶化混沌', subtext: '12 tiers to Primordial Chaos', duration: 3.0 },
];

class TutorialOverlay {
  active = false;
  step = 0;
  stepTimer = 0;
  shown = false;

  start(): void {
    if (this.shown) return;
    this.active = true;
    this.step = 0;
    this.stepTimer = 0;
    this.shown = true;
  }

  update(dt: number): void {
    if (!this.active) return;
    this.stepTimer += dt;
    if (this.stepTimer >= TUTORIAL_STEPS[this.step].duration) {
      this.stepTimer = 0;
      this.step++;
      if (this.step >= TUTORIAL_STEPS.length) {
        this.active = false;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;
    const s = TUTORIAL_STEPS[this.step];
    const progress = this.stepTimer / s.duration;
    // Fade in/out
    let alpha = 1;
    if (progress < 0.15) alpha = progress / 0.15;
    else if (progress > 0.8) alpha = (1 - progress) / 0.2;
    alpha = clamp(alpha, 0, 1);

    ctx.save();
    ctx.globalAlpha = alpha * 0.85;
    // Dark backdrop strip
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, H * 0.4, W, 90);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = alpha;

    ctx.fillStyle = '#eeddff';
    ctx.font = 'bold 20px "Noto Serif SC", serif';
    ctx.fillText(s.text, W / 2, H * 0.4 + 30);

    ctx.fillStyle = '#9988aa';
    ctx.font = '13px "Noto Serif SC", serif';
    ctx.fillText(s.subtext, W / 2, H * 0.4 + 60);

    // Step indicator dots
    ctx.globalAlpha = alpha * 0.6;
    for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
      ctx.fillStyle = i === this.step ? '#ccbbee' : '#555566';
      ctx.beginPath();
      ctx.arc(W / 2 + (i - 1.5) * 14, H * 0.4 + 78, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// §7.5  Screen flash effect
// ---------------------------------------------------------------------------

interface ScreenFlash {
  color: string;
  life: number;
  maxLife: number;
}

class FlashSystem {
  flashes: ScreenFlash[] = [];

  add(color: string, duration = 0.3): void {
    this.flashes.push({ color, life: duration, maxLife: duration });
  }

  update(dt: number): void {
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].life -= dt;
      if (this.flashes[i].life <= 0) {
        this.flashes.splice(i, 1);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const f of this.flashes) {
      const a = clamp(f.life / f.maxLife, 0, 1) * 0.25;
      ctx.globalAlpha = a;
      ctx.fillStyle = f.color;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// §7.6  Statistics tracker
// ---------------------------------------------------------------------------

interface GameStats {
  mergesPerTier: number[];
  maxCombo: number;
  totalDrops: number;
  spiritEventCount: number;
  playTimeMs: number;
}

function emptyStats(): GameStats {
  return {
    mergesPerTier: new Array(TIER_COUNT).fill(0),
    maxCombo: 0,
    totalDrops: 0,
    spiritEventCount: 0,
    playTimeMs: 0,
  };
}

// ---------------------------------------------------------------------------
// §7.7  Animated background decorative elements (floating runes)
// ---------------------------------------------------------------------------

interface FloatingRune {
  x: number;
  y: number;
  char: string;
  size: number;
  speed: number;
  opacity: number;
  angle: number;
  av: number;
}

const RUNE_CHARS = ['灵', '气', '道', '玄', '仙', '神', '天', '地', '阴', '阳', '风', '雷'];

function makeRunes(n: number): FloatingRune[] {
  const out: FloatingRune[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      x: Math.random() * W,
      y: Math.random() * H,
      char: RUNE_CHARS[Math.floor(Math.random() * RUNE_CHARS.length)],
      size: rnd(10, 18),
      speed: rnd(5, 15),
      opacity: rnd(0.03, 0.07),
      angle: rnd(0, Math.PI * 2),
      av: rnd(-0.3, 0.3),
    });
  }
  return out;
}

function updateRunes(runes: FloatingRune[], dt: number): void {
  for (const r of runes) {
    r.y -= r.speed * dt;
    r.angle += r.av * dt;
    if (r.y < -30) {
      r.y = H + 30;
      r.x = Math.random() * W;
    }
  }
}

function drawRunes(ctx: CanvasRenderingContext2D, runes: FloatingRune[]): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const r of runes) {
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.angle);
    ctx.globalAlpha = r.opacity;
    ctx.fillStyle = '#6655aa';
    ctx.font = `${r.size}px "Noto Serif SC", serif`;
    ctx.fillText(r.char, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// §7.8  Achievement definitions & display
// ---------------------------------------------------------------------------

interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  icon: string;  // single character
}

const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'sm8_first', name: '初入灵境', desc: '完成第一次合灵', icon: '☯' },
  { id: 'sm8_tiger', name: '虎啸山林', desc: '合出灵虎 (Tier 7)', icon: '🐯' },
  { id: 'sm8_phoenix', name: '凤鸣九天', desc: '合出灵凤 (Tier 9)', icon: '🔥' },
  { id: 'sm8_dragon', name: '龙腾四海', desc: '合出灵龙 (Tier 11)', icon: '🐉' },
  { id: 'sm8_chaos', name: '混沌初开', desc: '合出混沌 (Tier 12)', icon: '✦' },
  { id: 'sm8_combo5', name: '五连珠', desc: '达成5连合', icon: '💎' },
  { id: 'sm8_combo10', name: '十连珠', desc: '达成10连合', icon: '🌟' },
  { id: 'sm8_score10k', name: '万灵之力', desc: '单局获得10000分', icon: '🏆' },
  { id: 'sm8_score50k', name: '灵力无边', desc: '单局获得50000分', icon: '👑' },
  { id: 'sm8_event3', name: '灵气纵横', desc: '单局触发3次灵气爆发', icon: '⚡' },
];

// 5 Red Seal Stamp achievements (stored separately in localStorage)
interface SealStamp {
  id: string;
  name: string;
  desc: string;
  condition: string;
  unlocked: boolean;
}

const SEAL_STAMP_DEFS: { id: string; name: string; desc: string; condition: string }[] = [
  { id: 'seal_first_merge', name: '初合灵体', desc: '完成第一次合灵', condition: 'first_merge' },
  { id: 'seal_crane', name: '灵鹤翱翔', desc: '达到第五阶灵兽', condition: 'tier5' },
  { id: 'seal_dragon', name: '灵龙现世', desc: '达到第九阶灵兽', condition: 'tier9' },
  { id: 'seal_chaos', name: '混沌初开', desc: '达到最高阶混沌', condition: 'max_tier' },
  { id: 'seal_chain', name: '连锁反应', desc: '达成5连合以上', condition: 'combo5' },
];

function loadSealStamps(): SealStamp[] {
  const stamps: SealStamp[] = SEAL_STAMP_DEFS.map(d => ({
    ...d,
    unlocked: false,
  }));
  try {
    const raw = localStorage.getItem('sm8_seal_stamps');
    if (raw) {
      const saved = JSON.parse(raw) as string[];
      for (const s of stamps) {
        if (saved.includes(s.id)) s.unlocked = true;
      }
    }
  } catch { /* */ }
  return stamps;
}

function saveSealStamps(stamps: SealStamp[]): void {
  try {
    const unlocked = stamps.filter(s => s.unlocked).map(s => s.id);
    localStorage.setItem('sm8_seal_stamps', JSON.stringify(unlocked));
  } catch { /* */ }
}

function unlockSealStamp(stamps: SealStamp[], condition: string): SealStamp | null {
  const stamp = stamps.find(s => s.condition === condition && !s.unlocked);
  if (stamp) {
    stamp.unlocked = true;
    saveSealStamps(stamps);
    return stamp;
  }
  return null;
}

// Draw a single red seal stamp (Chinese-style square seal in vermillion)
function drawSealStamp(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number,
  text: string, unlocked: boolean, alpha = 1,
): void {
  ctx.save();
  ctx.globalAlpha = alpha * (unlocked ? 1 : 0.2);
  ctx.translate(x, y);

  // Slight random rotation for hand-stamped feel
  const rotHash = text.charCodeAt(0) * 0.03 - 0.06;
  ctx.rotate(unlocked ? rotHash : 0);

  const half = size / 2;

  // Outer border (weathered red)
  ctx.strokeStyle = unlocked ? '#cc2222' : '#444444';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(-half, -half, size, size);

  // Inner border
  ctx.strokeStyle = unlocked ? '#dd3333' : '#555555';
  ctx.lineWidth = 1;
  ctx.strokeRect(-half + 4, -half + 4, size - 8, size - 8);

  // Text (seal script style - 2 characters stacked or side by side)
  ctx.fillStyle = unlocked ? '#cc2222' : '#555555';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.round(size * 0.32)}px "Noto Serif SC", serif`;

  if (text.length === 4) {
    // 2x2 grid for 4-char names
    const cs = size * 0.18;
    ctx.fillText(text[0], -cs, -cs);
    ctx.fillText(text[1], cs, -cs);
    ctx.fillText(text[2], -cs, cs);
    ctx.fillText(text[3], cs, cs);
  } else {
    ctx.fillText(text, 0, 0);
  }

  // Weathering effect (small gaps in the seal)
  if (unlocked) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 5; i++) {
      const wx = Math.sin(i * 2.1 + text.charCodeAt(0)) * half * 0.6;
      const wy = Math.cos(i * 1.7 + text.charCodeAt(1 % text.length)) * half * 0.6;
      ctx.beginPath();
      ctx.arc(wx, wy, size * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.restore();
}

// Draw the seal stamps collection panel
function drawSealStampsPanel(
  ctx: CanvasRenderingContext2D,
  stamps: SealStamp[],
  x: number, y: number,
  t: number,
): void {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Title
  ctx.fillStyle = '#cc4444';
  ctx.font = 'bold 16px "Noto Serif SC", serif';
  ctx.fillText('灵印集', x, y);

  ctx.fillStyle = '#886655';
  ctx.font = '11px "Noto Serif SC", serif';
  ctx.fillText('Seal Stamps', x, y + 18);

  // Stamps row
  const stampSize = 48;
  const spacing = 58;
  const startX = x - ((stamps.length - 1) * spacing) / 2;
  const stampY = y + 55;

  for (let i = 0; i < stamps.length; i++) {
    const sx = startX + i * spacing;
    const stamp = stamps[i];

    // Pulse newly unlocked stamps
    const pulseAlpha = stamp.unlocked
      ? 0.85 + Math.sin(t * 2 + i) * 0.15
      : 0.4;

    drawSealStamp(ctx, sx, stampY, stampSize, stamp.name, stamp.unlocked, pulseAlpha);

    // Description below
    ctx.fillStyle = stamp.unlocked ? '#aa7766' : '#555555';
    ctx.font = '9px "Noto Serif SC", serif';
    ctx.fillText(stamp.desc, sx, stampY + stampSize / 2 + 14);
  }

  ctx.restore();
}

// Seal stamp unlock notification (special red flash)
interface SealNotif {
  stamp: SealStamp;
  life: number;
  maxLife: number;
}

class SealNotifier {
  queue: SealNotif[] = [];
  current: SealNotif | null = null;

  notify(stamp: SealStamp): void {
    this.queue.push({ stamp, life: 4.0, maxLife: 4.0 });
  }

  update(dt: number): void {
    if (this.current) {
      this.current.life -= dt;
      if (this.current.life <= 0) this.current = null;
    }
    if (!this.current && this.queue.length > 0) {
      this.current = this.queue.shift()!;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.current) return;
    const n = this.current;
    const progress = 1 - n.life / n.maxLife;

    let alpha = 1;
    if (progress < 0.12) alpha = progress / 0.12;
    else if (progress > 0.8) alpha = (1 - progress) / 0.2;
    alpha = clamp(alpha, 0, 1);

    // Slide in from top
    let yOff = -80;
    if (progress < 0.12) yOff = lerp(-80, 0, progress / 0.12);
    else if (progress > 0.8) yOff = lerp(0, -80, (progress - 0.8) / 0.2);
    else yOff = 0;

    const by = 95 + yOff;
    ctx.save();
    ctx.globalAlpha = alpha;

    // Red-tinted background
    ctx.fillStyle = 'rgba(80,20,20,0.9)';
    roundRect(ctx, 30, by, W - 60, 60, 12);
    ctx.fill();
    ctx.strokeStyle = '#cc3333';
    ctx.lineWidth = 2;
    roundRect(ctx, 30, by, W - 60, 60, 12);
    ctx.stroke();

    // Seal stamp icon
    drawSealStamp(ctx, 65, by + 30, 36, n.stamp.name, true, alpha);

    // Text
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffccaa';
    ctx.font = 'bold 15px "Noto Serif SC", serif';
    ctx.fillText('灵印解锁!', 95, by + 20);
    ctx.fillStyle = '#cc8866';
    ctx.font = '12px "Noto Serif SC", serif';
    ctx.fillText(n.stamp.name + ' — ' + n.stamp.desc, 95, by + 42);

    ctx.restore();
  }
}

// Notification for newly unlocked achievement
interface AchievementNotif {
  def: AchievementDef;
  life: number;
  maxLife: number;
}

class AchievementNotifier {
  queue: AchievementNotif[] = [];
  current: AchievementNotif | null = null;

  notify(def: AchievementDef): void {
    this.queue.push({ def, life: 3.5, maxLife: 3.5 });
  }

  update(dt: number): void {
    if (this.current) {
      this.current.life -= dt;
      if (this.current.life <= 0) this.current = null;
    }
    if (!this.current && this.queue.length > 0) {
      this.current = this.queue.shift()!;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.current) return;
    const n = this.current;
    const progress = 1 - n.life / n.maxLife;
    // Slide in from top
    let yOff = -60;
    if (progress < 0.15) yOff = lerp(-60, 0, progress / 0.15);
    else if (progress > 0.85) yOff = lerp(0, -60, (progress - 0.85) / 0.15);
    else yOff = 0;

    const by = 65 + yOff;
    ctx.save();
    ctx.globalAlpha = clamp(progress < 0.15 ? progress / 0.15 : progress > 0.85 ? (1 - progress) / 0.15 : 1, 0, 1);

    // Background
    ctx.fillStyle = 'rgba(40,20,80,0.85)';
    roundRect(ctx, 30, by, W - 60, 50, 10);
    ctx.fill();
    ctx.strokeStyle = '#8866cc';
    ctx.lineWidth = 1.5;
    roundRect(ctx, 30, by, W - 60, 50, 10);
    ctx.stroke();

    // Icon
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffdd88';
    ctx.fillText(n.def.icon, 45, by + 25);

    // Text
    ctx.fillStyle = '#eeddff';
    ctx.font = 'bold 14px "Noto Serif SC", serif';
    ctx.fillText(n.def.name, 75, by + 18);
    ctx.fillStyle = '#aa99bb';
    ctx.font = '11px "Noto Serif SC", serif';
    ctx.fillText(n.def.desc, 75, by + 36);

    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// §7.9  Calligraphy-style decorative border for special events
// ---------------------------------------------------------------------------

function drawCalligraphyBorder(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string, alpha: number, t: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;

  // Corner decorations — simple brush-stroke curves
  const cs = 15; // corner size

  // Top-left
  ctx.beginPath();
  ctx.moveTo(x, y + cs);
  ctx.lineTo(x, y);
  ctx.lineTo(x + cs, y);
  ctx.stroke();
  // Decorative dot
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x + 3, y + 3, 2, 0, Math.PI * 2); ctx.fill();

  // Top-right
  ctx.beginPath();
  ctx.moveTo(x + w - cs, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + cs);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(x + w - 3, y + 3, 2, 0, Math.PI * 2); ctx.fill();

  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(x, y + h - cs);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + cs, y + h);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(x + 3, y + h - 3, 2, 0, Math.PI * 2); ctx.fill();

  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(x + w - cs, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w, y + h - cs);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(x + w - 3, y + h - 3, 2, 0, Math.PI * 2); ctx.fill();

  // Animated flowing line segments along edges
  const dashLen = 20;
  const offset = (t * 30) % (dashLen * 2);
  ctx.setLineDash([dashLen, dashLen]);
  ctx.lineDashOffset = -offset;
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = alpha * 0.4;

  // Top edge
  ctx.beginPath(); ctx.moveTo(x + cs + 5, y); ctx.lineTo(x + w - cs - 5, y); ctx.stroke();
  // Bottom edge
  ctx.beginPath(); ctx.moveTo(x + cs + 5, y + h); ctx.lineTo(x + w - cs - 5, y + h); ctx.stroke();
  // Left edge
  ctx.beginPath(); ctx.moveTo(x, y + cs + 5); ctx.lineTo(x, y + h - cs - 5); ctx.stroke();
  // Right edge
  ctx.beginPath(); ctx.moveTo(x + w, y + cs + 5); ctx.lineTo(x + w, y + h - cs - 5); ctx.stroke();

  ctx.setLineDash([]);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// §7.10  Spirit event announcement overlay
// ---------------------------------------------------------------------------

interface EventAnnouncement {
  text: string;
  life: number;
  maxLife: number;
}

class EventAnnouncementSystem {
  current: EventAnnouncement | null = null;

  trigger(text: string, dur = 2.0): void {
    this.current = { text, life: dur, maxLife: dur };
  }

  update(dt: number): void {
    if (this.current) {
      this.current.life -= dt;
      if (this.current.life <= 0) this.current = null;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.current) return;
    const e = this.current;
    const prog = 1 - e.life / e.maxLife;

    let alpha = 1;
    if (prog < 0.1) alpha = prog / 0.1;
    else if (prog > 0.7) alpha = (1 - prog) / 0.3;
    alpha = clamp(alpha, 0, 1);

    const scale = 1 + Math.sin(prog * Math.PI * 4) * 0.02;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Background
    ctx.fillStyle = 'rgba(80,40,10,0.6)';
    roundRect(ctx, W / 2 - 120, H * 0.35 - 25, 240, 50, 12);
    ctx.fill();

    drawCalligraphyBorder(ctx, W / 2 - 120, H * 0.35 - 25, 240, 50, '#ffaa44', alpha * 0.7, prog * e.maxLife);

    ctx.font = `bold ${Math.round(22 * scale)}px "Noto Serif SC", serif`;
    ctx.fillStyle = '#ffdd88';
    ctx.fillText(e.text, W / 2, H * 0.35);

    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// §7.11  Container ripple effect on merge
// ---------------------------------------------------------------------------

interface Ripple {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  maxRadius: number;
  color: string;
}

class RippleSystem {
  ripples: Ripple[] = [];

  add(x: number, y: number, color: string, maxR = 60, life = 0.6): void {
    this.ripples.push({ x, y, life, maxLife: life, maxRadius: maxR, color });
  }

  update(dt: number): void {
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      this.ripples[i].life -= dt;
      if (this.ripples[i].life <= 0) {
        this.ripples.splice(i, 1);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const r of this.ripples) {
      const prog = 1 - r.life / r.maxLife;
      const radius = r.maxRadius * prog;
      const alpha = (1 - prog) * 0.35;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2 * (1 - prog) + 0.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// §8  Star field background
// ---------------------------------------------------------------------------

interface BgStar { x: number; y: number; s: number; b: number; }

function makeStars(n: number): BgStar[] {
  const out: BgStar[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ x: Math.random() * W, y: Math.random() * H, s: 0.4 + Math.random() * 1.4, b: 0.25 + Math.random() * 0.75 });
  }
  return out;
}

// ---------------------------------------------------------------------------
// §8.1  Draw all 12 spirit tiers in encyclopedia grid
// ---------------------------------------------------------------------------

function drawEncyclopedia(
  ctx: CanvasRenderingContext2D,
  maxReached: number,
  mergesPerTier: number[],
  startX: number,
  startY: number,
  t: number,
): void {
  const cols = 4, cellW = 80, cellH = 82;
  const ox = startX - (cols * cellW) / 2 + cellW / 2;
  for (let i = 0; i < TIER_COUNT; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const cx = ox + col * cellW;
    const cy = startY + row * cellH;
    const reached = i <= maxReached;
    const d = SPIRIT_DEFS[i];
    const merges = mergesPerTier[i] || 0;

    // Background tile
    ctx.fillStyle = reached ? 'rgba(40,30,60,0.4)' : 'rgba(20,15,30,0.3)';
    roundRect(ctx, cx - 35, cy - 22, 70, 60, 6);
    ctx.fill();
    if (reached) {
      ctx.strokeStyle = 'rgba(120,100,160,0.3)';
      ctx.lineWidth = 1;
      roundRect(ctx, cx - 35, cy - 22, 70, 60, 6);
      ctx.stroke();
    }

    drawSpiritProc(ctx, i, cx, cy - 4, d.radius * 0.32, reached ? t * 0.3 + i * 0.5 : 0, reached ? 0.85 : 0.15);

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = reached ? '#ccbbee' : '#333344';
    ctx.font = '10px "Noto Serif SC", serif';
    ctx.fillText(reached ? d.name : '???', cx, cy + 20);

    if (reached && merges > 0) {
      ctx.fillStyle = '#776699';
      ctx.font = '8px "Noto Serif SC", serif';
      ctx.fillText(`×${merges}`, cx, cy + 31);
    }
  }
}

// ---------------------------------------------------------------------------
// §8.2  Draw game stats summary
// ---------------------------------------------------------------------------

function drawStatsSummary(
  ctx: CanvasRenderingContext2D,
  stats: GameStats,
  x: number, y: number,
): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lines = [
    { label: '释放灵体', value: `${stats.totalDrops}` },
    { label: '合灵次数', value: `${stats.mergesPerTier.reduce((a, b) => a + b, 0)}` },
    { label: '最高连合', value: `${stats.maxCombo}` },
    { label: '灵气爆发', value: `${stats.spiritEventCount}` },
    { label: '修炼时长', value: formatTime(stats.playTimeMs) },
  ];

  for (let i = 0; i < lines.length; i++) {
    const ly = y + i * 20;
    ctx.fillStyle = '#887799';
    ctx.font = '12px "Noto Serif SC", serif';
    ctx.textAlign = 'right';
    ctx.fillText(lines[i].label, x - 5, ly);
    ctx.fillStyle = '#bbaacc';
    ctx.font = '12px "Noto Serif SC", serif';
    ctx.textAlign = 'left';
    ctx.fillText(lines[i].value, x + 5, ly);
  }
}

function formatTime(ms: number): string {
  const secs = Math.floor(ms / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// §9  Main Game class
// ---------------------------------------------------------------------------

type Scene = 'title' | 'nickname' | 'play' | 'pause' | 'over';

class Game {
  cvs: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  au: Audio;
  px: Particles;
  pp: MeloPassport;

  scene: Scene = 'title';

  // Gameplay
  spirits: Spirit[] = [];
  score = 0;
  best = 0;
  combo = 0;
  lastMerge = 0;
  hiTierMerges = 0;
  totalMerges = 0;
  curTier = 0;
  nxtTier = 0;
  dropX = W / 2;
  canDrop = true;
  dropCD = 0;       // seconds until next drop allowed
  dangerMs = 0;
  gMul = 1;         // gravity multiplier (progressive difficulty)
  mergeAnims: MergeAnim[] = [];
  shakeI = 0;
  shakeD = 0;
  shakeX = 0;
  shakeY = 0;

  // Input
  touching = false;
  touchX = W / 2;

  // UI
  muted: boolean;
  stars: BgStar[];
  animT = 0;
  lastTension = 0;
  lastSpiritEvt = 0;

  // Highest tier achieved
  maxTierReached = 0;

  // Enhanced systems
  scorePopups: ScorePopupSystem;
  clouds: BgCloud[];
  trails: TrailSystem;
  tutorial: TutorialOverlay;
  flashes: FlashSystem;
  stats: GameStats;
  runes: FloatingRune[];
  achNotifier: AchievementNotifier;
  eventAnnouncer: EventAnnouncementSystem;
  ripples: RippleSystem;
  spiralExplosions: SpiralExplosionSystem;
  shockwaves: ShockwaveSystem;
  freezeFrame: FreezeFrameManager;
  spiritBurst: SpiritBurstState;
  auraSystem: SpiritAuraSystem;
  sealStamps: SealStamp[];
  sealNotifier: SealNotifier;
  shareCard: ShareCardState;

  constructor() {
    this.cvs = document.getElementById('gameCanvas') as HTMLCanvasElement;
    this.ctx = this.cvs.getContext('2d')!;
    this.muted = loadBool('sm8_muted', false);
    this.au = new Audio(this.muted);
    this.px = new Particles();
    this.pp = loadPassport();
    this.best = loadNum('sm8_best', 0);
    this.stars = makeStars(85);
    this.scorePopups = new ScorePopupSystem();
    this.clouds = makeClouds(8);
    this.trails = new TrailSystem();
    this.tutorial = new TutorialOverlay();
    this.flashes = new FlashSystem();
    this.stats = emptyStats();
    this.runes = makeRunes(12);
    this.achNotifier = new AchievementNotifier();
    this.eventAnnouncer = new EventAnnouncementSystem();
    this.ripples = new RippleSystem();
    this.spiralExplosions = new SpiralExplosionSystem();
    this.shockwaves = new ShockwaveSystem();
    this.freezeFrame = new FreezeFrameManager();
    this.spiritBurst = initSpiritBurstState();
    this.auraSystem = new SpiritAuraSystem();
    this.sealStamps = loadSealStamps();
    this.sealNotifier = new SealNotifier();
    this.shareCard = initShareCardState();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
  }

  resize(): void {
    const ww = window.innerWidth, wh = window.innerHeight;
    const sc = Math.min(ww / W, wh / H);
    this.cvs.width = W * DPR;
    this.cvs.height = H * DPR;
    this.cvs.style.width = `${W * sc}px`;
    this.cvs.style.height = `${H * sc}px`;
    this.ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  // ----- Input -----
  bindInput(): void {
    const pos = (e: MouseEvent | Touch) => {
      const r = this.cvs.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
    };
    this.cvs.addEventListener('mousedown', e => { e.preventDefault(); this.au.init(); this.au.resume(); this.onDown(pos(e)); });
    this.cvs.addEventListener('mousemove', e => { this.onMove(pos(e)); });
    this.cvs.addEventListener('mouseup', e => { this.onUp(pos(e)); });
    this.cvs.addEventListener('touchstart', e => { e.preventDefault(); this.au.init(); this.au.resume(); this.onDown(pos(e.touches[0])); }, { passive: false });
    this.cvs.addEventListener('touchmove', e => { e.preventDefault(); this.onMove(pos(e.touches[0])); }, { passive: false });
    this.cvs.addEventListener('touchend', e => { e.preventDefault(); this.onUp({ x: this.touchX, y: DROP_ZONE_Y }); }, { passive: false });
  }

  onDown(p: { x: number; y: number }): void {
    switch (this.scene) {
      case 'title': this.clickTitle(p); return;
      case 'nickname': this.clickNick(p); return;
      case 'over': this.clickOver(p); return;
      case 'play': case 'pause':
        // Pause btn top-left
        if (p.x < 50 && p.y < 50) { this.togglePause(); return; }
        // Mute btn top-right
        if (p.x > W - 50 && p.y < 50) { this.toggleMute(); return; }
        if (this.scene === 'pause') return;
        this.touching = true;
        this.touchX = clamp(p.x, CONTAINER_L + 20, CONTAINER_R - 20);
        this.dropX = this.touchX;
        return;
    }
  }

  onMove(p: { x: number; y: number }): void {
    if (this.scene === 'play' && this.touching) {
      this.touchX = clamp(p.x, CONTAINER_L + 20, CONTAINER_R - 20);
      this.dropX = this.touchX;
    }
  }

  onUp(_p: { x: number; y: number }): void {
    if (this.scene === 'play' && this.touching && this.canDrop) {
      this.drop();
    }
    this.touching = false;
  }

  // ----- Scene clicks -----
  clickTitle(p: { x: number; y: number }): void {
    if (p.y > 500 && p.y < 560) {
      this.au.init(); this.au.resume(); this.au.playClick();
      if (this.pp.nickname) this.startGame(); else this.scene = 'nickname';
    }
    if (this.pp.nickname && p.y > 570 && p.y < 610) {
      this.au.playClick(); this.scene = 'nickname';
    }
  }

  clickNick(p: { x: number; y: number }): void {
    const startY = 265;
    const gap = 58;
    for (let i = 0; i < PRESET_NICKNAMES.length; i++) {
      const row = Math.floor(i / 2), col = i % 2;
      const bx = col === 0 ? W * 0.25 : W * 0.75;
      const by = startY + row * gap;
      if (Math.abs(p.x - bx) < 82 && Math.abs(p.y - by) < 24) {
        this.pp.nickname = PRESET_NICKNAMES[i];
        savePassport(this.pp);
        this.au.playClick();
        this.startGame();
        return;
      }
    }
  }

  clickOver(p: { x: number; y: number }): void {
    // If share card is visible, close it on any click
    if (this.shareCard.visible) {
      this.shareCard.visible = false;
      this.au.playClick();
      return;
    }

    // Retry button (~610)
    if (p.y > 584 && p.y < 636) { this.au.playClick(); this.startGame(); return; }
    // Share button (~672)
    if (p.y > 650 && p.y < 694 && Math.abs(p.x - W / 2) < 62) {
      this.au.playClick();
      showShareCard(this.shareCard, this.shareCard.canvas!);
      return;
    }
    // Title button (~730)
    if (p.y > 708 && p.y < 752) { this.au.playClick(); this.scene = 'title'; }
  }

  togglePause(): void {
    this.au.playClick();
    if (this.scene === 'play') { this.scene = 'pause'; }
    else if (this.scene === 'pause') { this.scene = 'play'; }
  }

  toggleMute(): void {
    this.muted = !this.muted;
    this.au.setMuted(this.muted);
    saveBool('sm8_muted', this.muted);
    if (!this.muted) this.au.playClick();
  }

  // ----- Game logic -----
  startGame(): void {
    this.scene = 'play';
    this.spirits = [];
    this.score = 0;
    this.combo = 0;
    this.lastMerge = 0;
    this.hiTierMerges = 0;
    this.totalMerges = 0;
    this.dangerMs = 0;
    this.gMul = 1;
    this.mergeAnims = [];
    this.shakeI = 0; this.shakeX = 0; this.shakeY = 0;
    this.canDrop = true;
    this.dropCD = 0;
    this.dropX = W / 2;
    this.touching = false;
    this.px.pool = [];
    this.maxTierReached = 0;
    this.curTier = this.rndTier();
    this.nxtTier = this.rndTier();
    this.pp.playCount++;
    savePassport(this.pp);
    this.au.init(); this.au.resume(); this.au.startBGM();

    // Reset enhanced systems
    this.scorePopups = new ScorePopupSystem();
    this.trails = new TrailSystem();
    this.flashes = new FlashSystem();
    this.stats = emptyStats();
    this.ripples = new RippleSystem();
    this.spiralExplosions = new SpiralExplosionSystem();
    this.shockwaves = new ShockwaveSystem();
    this.freezeFrame = new FreezeFrameManager();
    this.spiritBurst = initSpiritBurstState();
    this.auraSystem = new SpiritAuraSystem();
    this.shareCard = initShareCardState();
    this.achNotifier = new AchievementNotifier();
    this.sealNotifier = new SealNotifier();
    this.eventAnnouncer = new EventAnnouncementSystem();

    // Tutorial for first-time players
    if (isFirstTimePlaying()) {
      this.tutorial.start();
      markTutorialShown();
    }
  }

  rndTier(): number {
    let max = 2;
    if (this.score > 500) max = 3;
    if (this.score > 2000) max = 4;
    if (this.score > 8000) max = 5;
    const w: number[] = [];
    for (let i = 0; i <= max; i++) w.push(Math.pow(0.5, i));
    const tot = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * tot;
    for (let i = 0; i <= max; i++) { r -= w[i]; if (r <= 0) return i; }
    return 0;
  }

  drop(): void {
    if (!this.canDrop) return;
    const s = new Spirit(this.curTier, this.dropX, DROP_ZONE_Y);
    s.vy = 60;
    this.spirits.push(s);
    this.au.playDrop(this.curTier);
    this.au.playDropPop(); // satisfying pop on drop
    this.canDrop = false;
    this.dropCD = 0.4;
    this.curTier = this.nxtTier;
    this.nxtTier = this.rndTier();
    this.stats.totalDrops++;
  }

  // ----- Physics -----
  physics(dt: number): void {
    const sub = dt / SUBSTEPS;
    const g = GRAVITY * this.gMul;

    for (let step = 0; step < SUBSTEPS; step++) {
      for (const s of this.spirits) {
        if (s.merged || s.sleeping) continue;
        s.vy += g * sub;
        s.x += s.vx * sub;
        s.y += s.vy * sub;
        s.angle += s.av * sub;
        s.av *= 0.997;

        // Walls
        if (s.x - s.radius < CONTAINER_L) {
          s.x = CONTAINER_L + s.radius;
          s.vx = Math.abs(s.vx) * RESTITUTION;
          s.av += s.vy * 0.008;
          if (Math.abs(s.vx) > 25) this.au.playBounce();
        }
        if (s.x + s.radius > CONTAINER_R) {
          s.x = CONTAINER_R - s.radius;
          s.vx = -Math.abs(s.vx) * RESTITUTION;
          s.av -= s.vy * 0.008;
          if (Math.abs(s.vx) > 25) this.au.playBounce();
        }
        // Floor
        if (s.y + s.radius > CONTAINER_B) {
          s.y = CONTAINER_B - s.radius;
          const bounce = -Math.abs(s.vy) * RESTITUTION;
          if (Math.abs(s.vy) > 35) this.au.playBounce();
          s.vy = Math.abs(bounce) < 6 ? 0 : bounce;
          s.vx *= (1 - FRICTION_COEFF);
          s.av += s.vx * 0.004;
        }
      }

      // Circle–circle collisions
      const N = this.spirits.length;
      for (let i = 0; i < N; i++) {
        const a = this.spirits[i];
        if (a.merged) continue;
        for (let j = i + 1; j < N; j++) {
          const b = this.spirits[j];
          if (b.merged) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          const minD = a.radius + b.radius;
          if (d2 >= minD * minD || d2 < 0.0001) continue;
          const dist = Math.sqrt(d2);
          const nx = dx / dist, ny = dy / dist;
          const overlap = minD - dist;
          const mA = a.mass(), mB = b.mass(), mT = mA + mB;

          // Separate
          a.x -= nx * overlap * (mB / mT);
          a.y -= ny * overlap * (mB / mT);
          b.x += nx * overlap * (mA / mT);
          b.y += ny * overlap * (mA / mT);

          // Impulse
          const dvn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (dvn > 0) {
            const imp = (2 * dvn) / mT;
            const rest = (1 + RESTITUTION) * 0.5;
            a.vx -= imp * mB * nx * rest;
            a.vy -= imp * mB * ny * rest;
            b.vx += imp * mA * nx * rest;
            b.vy += imp * mA * ny * rest;
            const tang = nx * (a.vy - b.vy) - ny * (a.vx - b.vx);
            a.av += tang * 0.015;
            b.av -= tang * 0.015;
          }

          a.sleeping = false;
          b.sleeping = false;

          // Merge check
          if (a.tier === b.tier && a.tier < TIER_COUNT - 1 && !a.merged && !b.merged) {
            this.mergeSpirits(a, b);
          }
        }
      }

      // Sleep
      for (const s of this.spirits) {
        if (s.merged) continue;
        if (v2len(s.vx, s.vy) < SLEEP_THRESHOLD && s.y + s.radius >= CONTAINER_B - 2) {
          s.sleeping = true; s.vx = 0; s.vy = 0;
        }
      }
    }

    // Clean up merged
    this.spirits = this.spirits.filter(s => !s.merged);
  }

  mergeSpirits(a: Spirit, b: Spirit): void {
    const tier = a.tier + 1;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    a.merged = true; b.merged = true;

    const ns = new Spirit(tier, mx, my);
    ns.vx = (a.vx + b.vx) * 0.3;
    ns.vy = (a.vy + b.vy) * 0.3 - 60;
    this.spirits.push(ns);

    if (tier > this.maxTierReached) this.maxTierReached = tier;

    // Score & combo
    const now = performance.now();
    this.combo = (now - this.lastMerge < COMBO_WINDOW) ? this.combo + 1 : 1;
    this.lastMerge = now;
    const pts = SPIRIT_DEFS[tier].points * Math.min(this.combo, 10);
    this.score += pts;
    this.gMul = 1 + clamp(this.score / 60000, 0, 0.35);
    this.totalMerges++;

    // High-tier events
    if (tier >= 5) {
      this.hiTierMerges++;
      if (this.hiTierMerges % SPIRIT_EVENT_INTERVAL === 0 && now - this.lastSpiritEvt > 3000) {
        this.spiritEvent();
        this.lastSpiritEvt = now;
      }
    }

    // Enhanced Audio: pentatonic merge + chain cascade
    this.au.playMergePentatonic(tier);
    if (this.combo > 1) {
      this.au.playChainCascade(this.combo);
    }

    // Merge anim
    this.mergeAnims.push({ x: mx, y: my, tier, t0: now, dur: 420 });

    // Enhanced particles: spiral ink explosion + shockwave
    const d = SPIRIT_DEFS[tier];
    this.px.emit(mx, my, 14 + tier * 3, d.baseColor, 90 + tier * 18, 0.6, 'dot');
    this.px.emit(mx, my, 5 + tier, d.glowColor, 130 + tier * 14, 0.4, 'spark');
    this.px.emit(mx, my, 2, '#ffffff', 0, 0.55, 'ring');

    // Spiral ink explosion
    this.spiralExplosions.emit(mx, my, tier);

    // Ring shockwave
    this.shockwaves.emit(mx, my, tier);

    // Ripple at merge point
    this.ripples.add(mx, my, d.glowColor, d.radius * 2 + 30, 0.7);

    // Score popup floating upward
    const comboText = this.combo > 1 ? ` x${this.combo}` : '';
    this.scorePopups.add(mx, my - 20, `+${pts}${comboText}`, d.baseColor, 14 + Math.min(tier, 8) * 1.5, 1.5);

    // Screen flash for high tiers
    if (tier >= 4) {
      this.flashes.add(d.glowColor, 0.2 + tier * 0.03);
    }

    // Screen shake proportional to tier (higher = more shake)
    if (tier >= 3) {
      this.shakeI = 1 + tier * 1.0;
      this.shakeD = 0.88;
    }

    // Freeze frame on high-tier merges (tier 6+): 0.1s pause
    if (tier >= 6) {
      this.freezeFrame.trigger(0.1);
    }

    // Event announcement for special merges
    if (tier === 4) {
      this.eventAnnouncer.trigger('灵鹤翱翔!');
    } else if (tier === 8) {
      this.eventAnnouncer.trigger('灵凤涅槃!');
    } else if (tier === 10) {
      this.eventAnnouncer.trigger('灵龙现世!');
    } else if (tier === TIER_COUNT - 1) {
      this.eventAnnouncer.trigger('混沌初开!');
      this.flashes.add('#ffffff', 0.6);
    }

    // Update stats
    this.stats.mergesPerTier[tier] = (this.stats.mergesPerTier[tier] || 0) + 1;
    if (this.combo > this.stats.maxCombo) this.stats.maxCombo = this.combo;

    // Best score
    if (this.score > this.best) {
      this.best = this.score;
      try { localStorage.setItem('sm8_best', String(this.best)); } catch { /* */ }
    }

    // --- Achievement checks ---
    // Existing achievement system
    if (tier === TIER_COUNT - 1 && !this.pp.achievements.includes('sm8_chaos')) {
      this.pp.achievements.push('sm8_chaos');
      savePassport(this.pp);
    }
    // First merge
    if (this.totalMerges === 1 && !this.pp.achievements.includes('sm8_first')) {
      this.pp.achievements.push('sm8_first');
      savePassport(this.pp);
      const achDef = ACHIEVEMENTS.find(a => a.id === 'sm8_first');
      if (achDef) this.achNotifier.notify(achDef);
    }
    // Tiger tier 6
    if (tier >= 6 && !this.pp.achievements.includes('sm8_tiger')) {
      this.pp.achievements.push('sm8_tiger');
      savePassport(this.pp);
      const achDef = ACHIEVEMENTS.find(a => a.id === 'sm8_tiger');
      if (achDef) this.achNotifier.notify(achDef);
    }
    // Phoenix tier 8
    if (tier >= 8 && !this.pp.achievements.includes('sm8_phoenix')) {
      this.pp.achievements.push('sm8_phoenix');
      savePassport(this.pp);
      const achDef = ACHIEVEMENTS.find(a => a.id === 'sm8_phoenix');
      if (achDef) this.achNotifier.notify(achDef);
    }
    // Dragon tier 10
    if (tier >= 10 && !this.pp.achievements.includes('sm8_dragon')) {
      this.pp.achievements.push('sm8_dragon');
      savePassport(this.pp);
      const achDef = ACHIEVEMENTS.find(a => a.id === 'sm8_dragon');
      if (achDef) this.achNotifier.notify(achDef);
    }
    // Combo 5
    if (this.combo >= 5 && !this.pp.achievements.includes('sm8_combo5')) {
      this.pp.achievements.push('sm8_combo5');
      savePassport(this.pp);
      const achDef = ACHIEVEMENTS.find(a => a.id === 'sm8_combo5');
      if (achDef) this.achNotifier.notify(achDef);
    }
    // Combo 10
    if (this.combo >= 10 && !this.pp.achievements.includes('sm8_combo10')) {
      this.pp.achievements.push('sm8_combo10');
      savePassport(this.pp);
      const achDef = ACHIEVEMENTS.find(a => a.id === 'sm8_combo10');
      if (achDef) this.achNotifier.notify(achDef);
    }
    // Score 10k
    if (this.score >= 10000 && !this.pp.achievements.includes('sm8_score10k')) {
      this.pp.achievements.push('sm8_score10k');
      savePassport(this.pp);
      const achDef = ACHIEVEMENTS.find(a => a.id === 'sm8_score10k');
      if (achDef) this.achNotifier.notify(achDef);
    }
    // Score 50k
    if (this.score >= 50000 && !this.pp.achievements.includes('sm8_score50k')) {
      this.pp.achievements.push('sm8_score50k');
      savePassport(this.pp);
      const achDef = ACHIEVEMENTS.find(a => a.id === 'sm8_score50k');
      if (achDef) this.achNotifier.notify(achDef);
    }

    // --- Seal Stamp checks ---
    // First merge
    if (this.totalMerges === 1) {
      const s = unlockSealStamp(this.sealStamps, 'first_merge');
      if (s) this.sealNotifier.notify(s);
    }
    // Tier 5+ (crane = tier 4 in 0-indexed)
    if (tier >= 4) {
      const s = unlockSealStamp(this.sealStamps, 'tier5');
      if (s) this.sealNotifier.notify(s);
    }
    // Tier 9+ (tier 8 in 0-indexed)
    if (tier >= 8) {
      const s = unlockSealStamp(this.sealStamps, 'tier9');
      if (s) this.sealNotifier.notify(s);
    }
    // Max tier
    if (tier === TIER_COUNT - 1) {
      const s = unlockSealStamp(this.sealStamps, 'max_tier');
      if (s) this.sealNotifier.notify(s);
    }
    // 5+ combo chain
    if (this.combo >= 5) {
      const s = unlockSealStamp(this.sealStamps, 'combo5');
      if (s) this.sealNotifier.notify(s);
    }
  }

  spiritEvent(): void {
    this.au.playSpiritBurst();
    this.au.playChainReaction();
    this.shakeI = 10; this.shakeD = 0.92;

    // Trigger the enhanced spirit burst vibration
    triggerSpiritBurst(this.spiritBurst);

    // Push spirits outward from center
    for (const s of this.spirits) {
      if (s.merged) continue;
      s.sleeping = false;
      s.vx += rnd(-200, 200);
      s.vy -= rnd(100, 250);
    }

    // Massive particle explosion
    this.px.emit(W / 2, H * 0.4, 45, '#ffcc44', 200, 1.2, 'spark');
    this.px.emit(W / 2, H * 0.4, 15, '#ffffff', 0, 0.9, 'ring');
    this.px.emit(W / 2, H * 0.4, 30, '#ff8844', 150, 0.8, 'dot');

    // Spiral explosion
    this.spiralExplosions.emit(W / 2, H * 0.4, 8);

    // Shockwave
    this.shockwaves.emit(W / 2, H * 0.4, 8);

    // Screen flash
    this.flashes.add('#ffcc44', 0.4);

    // Event announcement
    this.eventAnnouncer.trigger('灵气爆发!');

    // Track stats
    this.stats.spiritEventCount++;

    // Achievement check for 3 events
    if (this.stats.spiritEventCount >= 3 && !this.pp.achievements.includes('sm8_event3')) {
      this.pp.achievements.push('sm8_event3');
      savePassport(this.pp);
      const achDef = ACHIEVEMENTS.find(a => a.id === 'sm8_event3');
      if (achDef) this.achNotifier.notify(achDef);
    }
  }

  checkDanger(dt: number): void {
    const now = performance.now();
    let above = false;
    for (const s of this.spirits) {
      if (s.merged) continue;
      if (now - s.born < 1200) continue; // grace period for just-dropped
      if (s.y - s.radius < DANGER_Y) { above = true; break; }
    }
    if (above) {
      this.dangerMs += dt * 1000;
      if (now - this.lastTension > 2200) { this.au.playTension(); this.lastTension = now; }
    } else {
      this.dangerMs = Math.max(0, this.dangerMs - dt * 2000);
    }
    if (this.dangerMs >= DANGER_TIMEOUT) this.gameOver();
  }

  gameOver(): void {
    this.scene = 'over';
    this.au.stopBGM();
    this.au.stopHeartbeat();
    this.pp.coins += Math.floor(this.score / 10);
    savePassport(this.pp);
    for (let i = 0; i < 5; i++) {
      const tier = rndInt(0, TIER_COUNT - 1);
      this.px.emit(rnd(W * 0.2, W * 0.8), rnd(H * 0.25, H * 0.45), 18, SPIRIT_DEFS[tier].baseColor, 110, 1.1, 'spark');
    }

    // Generate share card
    const shareCanvas = generateShareCard(
      this.score, this.maxTierReached, this.stats.maxCombo,
      this.pp.nickname, this.sealStamps,
    );
    this.shareCard = initShareCardState();
    this.shareCard.canvas = shareCanvas;
  }

  // ----- Main update -----
  update(dt: number): void {
    this.animT += dt;
    _spiritAnimTime = this.animT; // set global for spirit animations
    this.au.cleanup();

    if (this.scene === 'play') {
      // Freeze frame check
      const { frozen, adjustedDt } = this.freezeFrame.consume(dt);
      const gameDt = frozen ? 0 : adjustedDt;

      if (!this.canDrop) { this.dropCD -= gameDt; if (this.dropCD <= 0) this.canDrop = true; }

      if (!frozen) {
        this.physics(gameDt);
        this.checkDanger(gameDt);

        // Spirit burst vibration
        updateSpiritBurst(this.spiritBurst, this.spirits, gameDt);

        // Heartbeat drone based on danger level
        const dangerPct = this.dangerMs / DANGER_TIMEOUT;
        if (dangerPct > 0.3) {
          if (!this.au.heartbeatActive) this.au.startHeartbeat();
          this.au.updateHeartbeatIntensity(dangerPct);
        } else if (this.au.heartbeatActive) {
          this.au.stopHeartbeat();
        }
      }

      const now = performance.now();
      this.mergeAnims = this.mergeAnims.filter(m => now - m.t0 < m.dur);
      if (this.shakeI > 0.1) {
        // Add spirit burst shake on top
        const burstShake = this.spiritBurst.active ? this.spiritBurst.intensity * 3 : 0;
        this.shakeX = rnd(-1, 1) * (this.shakeI * 2 + burstShake);
        this.shakeY = rnd(-1, 1) * (this.shakeI * 2 + burstShake);
        this.shakeI *= this.shakeD;
      } else if (this.spiritBurst.active) {
        this.shakeX = rnd(-1, 1) * this.spiritBurst.intensity * 4;
        this.shakeY = rnd(-1, 1) * this.spiritBurst.intensity * 4;
      } else {
        this.shakeX = 0; this.shakeY = 0; this.shakeI = 0;
      }

      // Update enhanced systems
      this.scorePopups.update(gameDt);
      this.trails.addFromSpirits(this.spirits, gameDt);
      this.trails.update(gameDt);
      this.auraSystem.update(this.spirits, gameDt);
      this.spiralExplosions.update(gameDt);
      this.shockwaves.update(gameDt);
      this.ripples.update(gameDt);
      this.flashes.update(gameDt);
      this.tutorial.update(gameDt);

      // Update stats play time
      this.stats.playTimeMs += gameDt * 1000;
    }

    // Update systems that run across all scenes
    this.px.update(dt);
    updateClouds(this.clouds, dt);
    updateRunes(this.runes, dt);
    this.achNotifier.update(dt);
    this.sealNotifier.update(dt);
    this.eventAnnouncer.update(dt);
    updateShareCard(this.shareCard, dt);
  }

  // ----- Render -----
  draw(): void {
    const c = this.ctx;
    c.save();
    if (this.scene === 'play') c.translate(this.shakeX, this.shakeY);

    this.drawBg(c);

    switch (this.scene) {
      case 'title':    this.drawTitle(c); break;
      case 'nickname': this.drawNick(c); break;
      case 'play':     this.drawPlay(c); break;
      case 'pause':    this.drawPlay(c); this.drawPauseOvl(c); break;
      case 'over':     this.drawOver(c); break;
    }
    c.restore();
  }

  drawBg(c: CanvasRenderingContext2D): void {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#050516');
    g.addColorStop(0.5, '#090928');
    g.addColorStop(1, '#070720');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);

    const t = this.animT;
    for (const s of this.stars) {
      const tw = 0.5 + Math.sin(t * 1.8 + s.x * 0.08 + s.y * 0.06) * 0.5;
      c.globalAlpha = s.b * tw * 0.55;
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(s.x, s.y, s.s, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;

    // Background clouds
    drawClouds(c, this.clouds);

    // Floating runes
    drawRunes(c, this.runes);
  }

  // ---------- Title screen ----------
  drawTitle(c: CanvasRenderingContext2D): void {
    const t = this.animT;
    c.textAlign = 'center'; c.textBaseline = 'middle';

    drawTextWithShadow(c, '合灵演化', W / 2, 200, '#eeddff', '#6644ff', 22);
    c.font = 'bold 44px "Noto Serif SC", serif';
    // (the shadow call set font implicitly, re-set for measurements)
    // Actually drawTextWithShadow doesn't set font, let's set before:
    c.font = 'bold 44px "Noto Serif SC", serif';
    drawTextWithShadow(c, '合灵演化', W / 2, 200, '#eeddff', '#6644ff', 22);

    c.fillStyle = '#8877aa'; c.font = '18px "Noto Serif SC", serif';
    c.fillText('Spirit Merge', W / 2, 252);
    c.fillStyle = '#665588'; c.font = '14px "Noto Serif SC", serif';
    c.fillText('麦洛的冒险 · 第八章', W / 2, 285);

    // Floating spirits
    for (let i = 0; i < 6; i++) {
      const tier = i * 2;
      const a = (i / 6) * Math.PI * 2 + t * 0.28;
      const sx = W / 2 + Math.cos(a) * 105;
      const sy = 385 + Math.sin(a) * 38;
      const sc = 0.45 + (Math.sin(a) + 1) * 0.25;
      const al = 0.35 + (Math.sin(a) + 1) * 0.3;
      drawSpiritProc(c, tier, sx, sy, SPIRIT_DEFS[tier].radius * sc, t * 0.4 + i, al);
    }

    if (this.best > 0) {
      c.fillStyle = '#aa9944'; c.font = '16px "Noto Serif SC", serif';
      c.fillText(`最高分: ${this.best}`, W / 2, 445);
    }
    if (this.pp.nickname) {
      c.fillStyle = '#9988bb'; c.font = '15px "Noto Serif SC", serif';
      c.fillText(`道号: ${this.pp.nickname}`, W / 2, 473);
    }

    // Start button
    const by = 530;
    const pulse = Math.sin(t * 3) * 0.1 + 0.9;
    c.save();
    c.shadowColor = '#4488ff'; c.shadowBlur = 15 * pulse;
    c.strokeStyle = '#6688cc'; c.lineWidth = 2;
    roundRect(c, W / 2 - 82, by - 26, 164, 52, 12); c.stroke();
    c.fillStyle = 'rgba(25,25,70,0.7)';
    roundRect(c, W / 2 - 82, by - 26, 164, 52, 12); c.fill();
    c.restore();
    c.fillStyle = '#ccddff'; c.font = 'bold 20px "Noto Serif SC", serif';
    c.fillText('开始修炼', W / 2, by);

    if (this.pp.nickname) {
      c.fillStyle = '#666688'; c.font = '13px "Noto Serif SC", serif';
      c.fillText('更换道号', W / 2, 590);
    }

    // Show seal stamps on title screen
    const unlockedCount = this.sealStamps.filter(s => s.unlocked).length;
    if (unlockedCount > 0) {
      drawSealStampsPanel(c, this.sealStamps, W / 2, 620, this.animT);
    }

    c.fillStyle = '#444466'; c.font = '12px "Noto Serif SC", serif';
    c.fillText('拖动放置 · 同灵合一 · 十二化混沌', W / 2, 740);
    c.fillText('Drop spirits · Match to merge · Reach Chaos!', W / 2, 758);
  }

  // ---------- Nickname ----------
  drawNick(c: CanvasRenderingContext2D): void {
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#ccbbee'; c.font = 'bold 28px "Noto Serif SC", serif';
    c.fillText('选择道号', W / 2, 165);
    c.fillStyle = '#8877aa'; c.font = '14px "Noto Serif SC", serif';
    c.fillText('Choose your spirit name', W / 2, 205);

    const sY = 265, gap = 58;
    for (let i = 0; i < PRESET_NICKNAMES.length; i++) {
      const row = Math.floor(i / 2), col = i % 2;
      const bx = col === 0 ? W * 0.25 : W * 0.75;
      const by = sY + row * gap;
      c.strokeStyle = '#554477'; c.lineWidth = 1.5;
      roundRect(c, bx - 78, by - 22, 156, 44, 8); c.stroke();
      c.fillStyle = 'rgba(28,18,48,0.6)';
      roundRect(c, bx - 78, by - 22, 156, 44, 8); c.fill();
      c.fillStyle = '#ddccee'; c.font = '16px "Noto Serif SC", serif';
      c.fillText(PRESET_NICKNAMES[i], bx, by);
    }
  }

  // ---------- Play ----------
  drawPlay(c: CanvasRenderingContext2D): void {
    this.drawContainer(c);

    // Danger line
    const dAlpha = this.dangerMs > 0 ? 0.3 + Math.sin(this.animT * 8) * 0.2 : 0.12;
    c.strokeStyle = this.dangerMs > 1000 ? `rgba(255,40,40,${(dAlpha + 0.35).toFixed(2)})` : `rgba(255,90,90,${dAlpha.toFixed(2)})`;
    c.lineWidth = 1; c.setLineDash([5, 4]);
    c.beginPath(); c.moveTo(CONTAINER_L, DANGER_Y); c.lineTo(CONTAINER_R, DANGER_Y); c.stroke();
    c.setLineDash([]);

    if (this.dangerMs > 500) {
      const wa = clamp(this.dangerMs / DANGER_TIMEOUT, 0, 1) * (0.5 + Math.sin(this.animT * 6) * 0.5);
      c.globalAlpha = wa; c.fillStyle = '#ff3333';
      c.font = 'bold 15px "Noto Serif SC", serif'; c.textAlign = 'center';
      c.fillText('危！', W / 2, DANGER_Y - 12);
      c.globalAlpha = 1;
    }

    // Ghost + drop guide
    if (this.canDrop && this.scene === 'play') {
      c.strokeStyle = 'rgba(255,255,255,0.08)';
      c.lineWidth = 1; c.setLineDash([3, 5]);
      c.beginPath(); c.moveTo(this.dropX, DROP_ZONE_Y + 15); c.lineTo(this.dropX, CONTAINER_B); c.stroke();
      c.setLineDash([]);
      drawSpiritProc(c, this.curTier, this.dropX, DROP_ZONE_Y, SPIRIT_DEFS[this.curTier].radius, 0, 0.45);
    }

    // Spirit trails (motion blur)
    this.trails.draw(c);

    // Spirit aura particles (behind spirits)
    this.auraSystem.draw(c, this.spirits);

    // Spirits with enhanced animated overlays
    for (const s of this.spirits) {
      if (s.merged) continue;
      drawSpiritProc(c, s.tier, s.x, s.y, s.radius, s.angle);
      drawSpiritAnimatedOverlay(c, s.tier, s.x, s.y, s.radius, s.angle, 1);
    }

    // Merge flashes
    const now = performance.now();
    for (const m of this.mergeAnims) {
      const prog = (now - m.t0) / m.dur;
      const sc = 1 + Math.sin(prog * Math.PI) * 0.4;
      const al = 1 - prog;
      const d = SPIRIT_DEFS[m.tier];
      c.globalAlpha = al * 0.45;
      c.strokeStyle = d.baseColor; c.lineWidth = 2.5;
      c.beginPath(); c.arc(m.x, m.y, d.radius * sc * 1.6, 0, Math.PI * 2); c.stroke();
      // Second smaller ring
      c.globalAlpha = al * 0.25;
      c.strokeStyle = d.glowColor; c.lineWidth = 1.5;
      c.beginPath(); c.arc(m.x, m.y, d.radius * sc * 2.2, 0, Math.PI * 2); c.stroke();
    }
    c.globalAlpha = 1;

    // Enhanced effects
    this.spiralExplosions.draw(c);
    this.shockwaves.draw(c);
    this.ripples.draw(c);
    this.px.draw(c);

    // Score popups
    this.scorePopups.draw(c);

    // Screen flashes
    this.flashes.draw(c);

    // Spirit burst overlay
    drawSpiritBurstOverlay(c, this.spiritBurst, this.animT);

    // HUD
    this.drawHUD(c);

    // Tutorial overlay
    this.tutorial.draw(c);

    // Achievement notification
    this.achNotifier.draw(c);

    // Seal stamp notification
    this.sealNotifier.draw(c);

    // Event announcement
    this.eventAnnouncer.draw(c);
  }

  drawContainer(c: CanvasRenderingContext2D): void {
    // Subtle inner fill
    c.fillStyle = 'rgba(8,8,28,0.35)';
    c.fillRect(CONTAINER_L, DANGER_Y, CONTAINER_R - CONTAINER_L, CONTAINER_B - DANGER_Y);

    // Bamboo borders
    const bw = 6;
    const bambooGrad = (x1: number, x2: number) => {
      const g = c.createLinearGradient(x1, 0, x2, 0);
      g.addColorStop(0, '#1a3322'); g.addColorStop(0.3, '#2a5533');
      g.addColorStop(0.5, '#3a7744'); g.addColorStop(0.7, '#2a5533');
      g.addColorStop(1, '#1a3322'); return g;
    };
    // Left
    c.fillStyle = bambooGrad(CONTAINER_L - bw / 2, CONTAINER_L + bw / 2);
    c.fillRect(CONTAINER_L - bw / 2, DANGER_Y, bw, CONTAINER_B - DANGER_Y);
    // Right
    c.fillStyle = bambooGrad(CONTAINER_R - bw / 2, CONTAINER_R + bw / 2);
    c.fillRect(CONTAINER_R - bw / 2, DANGER_Y, bw, CONTAINER_B - DANGER_Y);
    // Bottom
    const bg = c.createLinearGradient(0, CONTAINER_B - bw / 2, 0, CONTAINER_B + bw / 2);
    bg.addColorStop(0, '#1a3322'); bg.addColorStop(0.3, '#2a5533');
    bg.addColorStop(0.5, '#3a7744'); bg.addColorStop(0.7, '#2a5533');
    bg.addColorStop(1, '#1a3322');
    c.fillStyle = bg;
    c.fillRect(CONTAINER_L - bw / 2, CONTAINER_B - bw / 2, CONTAINER_R - CONTAINER_L + bw, bw);
    // Nodes / joints
    c.fillStyle = '#4a8855';
    for (let y = DANGER_Y + 75; y < CONTAINER_B; y += 75) {
      c.fillRect(CONTAINER_L - bw / 2 - 1, y - 2, bw + 2, 4);
      c.fillRect(CONTAINER_R - bw / 2 - 1, y - 2, bw + 2, 4);
    }
  }

  drawHUD(c: CanvasRenderingContext2D): void {
    // Top bar
    c.fillStyle = 'rgba(0,0,0,0.45)';
    c.fillRect(0, 0, W, 58);

    c.textAlign = 'center'; c.textBaseline = 'middle';

    // Score
    c.fillStyle = '#ffddaa'; c.font = 'bold 24px "Noto Serif SC", serif';
    c.fillText(`${this.score}`, W / 2, 28);

    // Combo
    if (this.combo > 1 && performance.now() - this.lastMerge < COMBO_WINDOW + 600) {
      const cA = clamp(1 - (performance.now() - this.lastMerge - COMBO_WINDOW) / 600, 0, 1);
      c.globalAlpha = cA;
      c.fillStyle = '#ff8844'; c.font = 'bold 15px "Noto Serif SC", serif';
      c.fillText(`${this.combo}连合!`, W / 2, 50);
      c.globalAlpha = 1;
    }

    // Next preview
    c.textAlign = 'left';
    c.fillStyle = '#8888aa'; c.font = '11px "Noto Serif SC", serif';
    c.fillText('次:', 62, 28);
    drawSpiritProc(c, this.nxtTier, 97, 28, SPIRIT_DEFS[this.nxtTier].radius * 0.45, 0, 0.65);

    // Pause / Mute
    c.textAlign = 'center'; c.fillStyle = 'rgba(255,255,255,0.6)';
    c.font = '20px sans-serif';
    c.fillText(this.scene === 'pause' ? '\u25B6' : '\u23F8', 26, 26);
    c.fillText(this.muted ? '\uD83D\uDD07' : '\uD83D\uDD0A', W - 26, 26);

    // Bottom bar
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, H - 38, W, 38);
    c.fillStyle = '#8888aa'; c.font = '12px "Noto Serif SC", serif'; c.textAlign = 'center';
    c.fillText(`灵体: ${this.spirits.filter(s => !s.merged).length}`, W * 0.2, H - 16);
    c.fillText(`合: ${this.totalMerges}`, W * 0.5, H - 16);
    c.fillText(`最高: ${this.best}`, W * 0.8, H - 16);

    // Evolution chain indicator
    this.drawEvolutionBar(c);

    // Danger bar
    if (this.dangerMs > 0) {
      const pct = this.dangerMs / DANGER_TIMEOUT;
      c.fillStyle = `rgba(255,${Math.floor(80 * (1 - pct))},${Math.floor(40 * (1 - pct))},0.75)`;
      c.fillRect(CONTAINER_L, DANGER_Y - 3, (CONTAINER_R - CONTAINER_L) * pct, 3);
    }
  }

  drawEvolutionBar(c: CanvasRenderingContext2D): void {
    // Small tier icons at the very bottom showing which tiers have been reached
    const barY = H - 36;
    const barH = 3;
    const barW = CONTAINER_R - CONTAINER_L;
    c.fillStyle = 'rgba(255,255,255,0.05)';
    c.fillRect(CONTAINER_L, barY, barW, barH);

    // Fill proportional to max tier reached
    if (this.maxTierReached > 0) {
      const pct = this.maxTierReached / (TIER_COUNT - 1);
      const grad = c.createLinearGradient(CONTAINER_L, 0, CONTAINER_L + barW * pct, 0);
      grad.addColorStop(0, '#00ffcc44');
      grad.addColorStop(1, SPIRIT_DEFS[this.maxTierReached].baseColor + '88');
      c.fillStyle = grad;
      c.fillRect(CONTAINER_L, barY, barW * pct, barH);
    }
  }

  drawPauseOvl(c: CanvasRenderingContext2D): void {
    c.fillStyle = 'rgba(0,0,10,0.6)';
    c.fillRect(0, 0, W, H);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#ccbbee'; c.font = 'bold 36px "Noto Serif SC", serif';
    c.fillText('修炼暂停', W / 2, H / 2 - 30);
    c.fillStyle = '#8877aa'; c.font = '16px "Noto Serif SC", serif';
    c.fillText('点击 \u23F8 继续', W / 2, H / 2 + 20);

    // Show evolution chain while paused
    this.drawEvolutionChainDisplay(c);
  }

  drawEvolutionChainDisplay(c: CanvasRenderingContext2D): void {
    // Show all 12 tiers in a grid during pause
    c.fillStyle = '#9988bb'; c.font = '14px "Noto Serif SC", serif';
    c.textAlign = 'center';
    c.fillText('灵兽图鉴', W / 2, H / 2 + 70);

    const cols = 4, rows = 3;
    const cellW = 80, cellH = 72;
    const startX = W / 2 - (cols * cellW) / 2 + cellW / 2;
    const startY = H / 2 + 100;
    for (let i = 0; i < TIER_COUNT; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      const cx = startX + col * cellW;
      const cy = startY + row * cellH;
      const reached = i <= this.maxTierReached;
      const d = SPIRIT_DEFS[i];
      drawSpiritProc(c, i, cx, cy - 8, d.radius * 0.38, 0, reached ? 0.85 : 0.2);
      c.fillStyle = reached ? '#ccbbee' : '#444455';
      c.font = '10px "Noto Serif SC", serif';
      c.fillText(d.name, cx, cy + 16);
    }
  }

  // ---------- Game over ----------
  drawOver(c: CanvasRenderingContext2D): void {
    // Check if share card is showing
    if (this.shareCard.visible) {
      drawShareCard(c, this.shareCard);
      return;
    }

    c.fillStyle = 'rgba(5,5,18,0.78)';
    c.fillRect(0, 0, W, H);
    c.textAlign = 'center'; c.textBaseline = 'middle';

    c.font = 'bold 40px "Noto Serif SC", serif';
    drawTextWithShadow(c, '灵力溃散', W / 2, 120, '#ff8877', '#ff4444', 16);

    c.fillStyle = '#aa8877'; c.font = '16px "Noto Serif SC", serif';
    c.fillText('Spirit Overflow', W / 2, 158);

    c.fillStyle = '#ffddaa'; c.font = 'bold 30px "Noto Serif SC", serif';
    c.fillText(`${this.score}`, W / 2, 210);
    c.fillStyle = '#aa9977'; c.font = '14px "Noto Serif SC", serif';
    c.fillText('修炼积分', W / 2, 238);

    if (this.score >= this.best && this.score > 0) {
      c.fillStyle = '#ffaa44'; c.font = 'bold 16px "Noto Serif SC", serif';
      c.fillText('新纪录!', W / 2, 262);
    }

    // Max tier reached with spirit icon
    if (this.maxTierReached > 0) {
      const d = SPIRIT_DEFS[this.maxTierReached];
      c.fillStyle = '#9988bb'; c.font = '13px "Noto Serif SC", serif';
      c.fillText(`最高灵兽: ${d.name}`, W / 2, 290);
      drawSpiritProc(c, this.maxTierReached, W / 2, 322, d.radius * 0.35, this.animT * 0.3, 0.8);
    }

    // Stats summary
    drawStatsSummary(c, this.stats, W / 2, 370);

    c.textAlign = 'center';
    c.fillStyle = '#aa9944'; c.font = '14px "Noto Serif SC", serif';
    c.fillText(`获得灵币: ${Math.floor(this.score / 10)}`, W / 2, 480);

    // Seal stamps display
    drawSealStampsPanel(c, this.sealStamps, W / 2, 505, this.animT);

    // Retry button
    const ry = 610;
    c.strokeStyle = '#6688cc'; c.lineWidth = 2;
    roundRect(c, W / 2 - 82, ry - 26, 164, 52, 12); c.stroke();
    c.fillStyle = 'rgba(25,25,70,0.7)';
    roundRect(c, W / 2 - 82, ry - 26, 164, 52, 12); c.fill();
    c.fillStyle = '#ccddff'; c.font = 'bold 18px "Noto Serif SC", serif';
    c.fillText('再次修炼', W / 2, ry);

    // Share card button
    const shareY = 672;
    c.strokeStyle = '#cc4444'; c.lineWidth = 1.5;
    roundRect(c, W / 2 - 62, shareY - 22, 124, 44, 8); c.stroke();
    c.fillStyle = 'rgba(80,20,20,0.5)';
    roundRect(c, W / 2 - 62, shareY - 22, 124, 44, 8); c.fill();
    c.fillStyle = '#ffaa88'; c.font = '15px "Noto Serif SC", serif';
    c.fillText('分享卡片', W / 2, shareY);

    // Title button
    const ty = 730;
    c.strokeStyle = '#555577'; c.lineWidth = 1.5;
    roundRect(c, W / 2 - 62, ty - 22, 124, 44, 8); c.stroke();
    c.fillStyle = 'rgba(18,18,38,0.5)';
    roundRect(c, W / 2 - 62, ty - 22, 124, 44, 8); c.fill();
    c.fillStyle = '#9999bb'; c.font = '15px "Noto Serif SC", serif';
    c.fillText('返回', W / 2, ty);

    this.px.draw(c);
  }
}

// ---------------------------------------------------------------------------
// §10  Bootstrap & main loop
// ---------------------------------------------------------------------------

function main(): void {
  const game = new Game();
  let last = performance.now();

  function loop(now: number): void {
    const raw = (now - last) / 1000;
    last = now;
    const dt = Math.min(raw, 1 / 30); // clamp to avoid death spiral
    game.update(dt);
    game.draw();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

main();
