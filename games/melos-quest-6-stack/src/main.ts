// ============================================================================
// 麦洛的冒险6：登天叠塔 (Melo's Quest 6: Celestial Tower)
// Premium Tower Stacking Game — Canvas 390×844
// 水墨山海经 Ink-Wash Shanhaijing Style
// ============================================================================

// ---------------------------------------------------------------------------
// 0. Constants & Types
// ---------------------------------------------------------------------------

const W = 390;
const H = 844;

const BLOCK_H = 28;
const INITIAL_BLOCK_W = 200;
const MIN_BLOCK_W = 12;
const PERFECT_THRESHOLD = 3;
const NEAR_PERFECT_THRESHOLD = 6;
const SWING_BASE_SPEED = 3.2;
const SWING_ACCEL = 0.012;
const GRAVITY = 0.3;
const MAX_TOWER_LEAN = 18;

const enum Zone {
  Ground = 0,   // 地基 — stone foundation
  Cloud = 1,    // 云层 — jade among clouds
  Starfield = 2, // 星河 — marble among stars
  Heaven = 3,   // 仙宫 — crystal celestial palace
}

const ZONE_NAMES = ['地基', '云层', '星河', '仙宫'];
const ZONE_EN = ['Foundation', 'Cloud Realm', 'Starfield', 'Celestial Palace'];

interface Block {
  x: number;
  y: number;
  w: number;
  zone: Zone;
  wobbleOffset: number;
  wobblePhase: number;
  settled: boolean;
  roofStyle: number; // 0-3 architecture variation
}

interface FallingPiece {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  zone: Zone;
  alpha: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'dust' | 'spark' | 'leaf' | 'snow' | 'cloud' | 'golden' | 'ring' | 'ink' | 'star' | 'petal' | 'ember';
  rot: number;
  vr: number;
  alpha: number;
}

interface WeatherParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  alpha: number;
  type: 'leaf' | 'cloud' | 'snow' | 'golden' | 'star' | 'petal' | 'firefly';
  twinkle: number;
}

interface CollapseBlock {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  zone: Zone;
}

interface RippleRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

interface WindGust {
  strength: number;
  direction: number;
  duration: number;
  timer: number;
}

interface BossEvent {
  active: boolean;
  type: 'wind_blast' | 'shrink' | 'speed_up' | 'reverse';
  timer: number;
  duration: number;
  intensity: number;
  warningTimer: number;
}

interface Achievement {
  id: string;
  name: string;
  desc: string;
  unlocked: boolean;
  justUnlocked: boolean;
  showTimer: number;
}

interface Passport {
  name: string;
  avatar: string;
  gamesPlayed: number;
  completedGames: string[];
  currentStreak: number;
  totalScore: number;
  lastPlayed: string;
}

interface InkSplash {
  x: number;
  y: number;
  radius: number;
  targetRadius: number;
  alpha: number;
  drops: { dx: number; dy: number; r: number }[];
}

interface Constellation {
  stars: { x: number; y: number; brightness: number; size: number }[];
  connections: [number, number][];
  offsetY: number;
}

// ---------------------------------------------------------------------------
// 1. Canvas Setup
// ---------------------------------------------------------------------------

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const dpr = Math.min(window.devicePixelRatio || 1, 3);

function resizeCanvas() {
  const scaleX = window.innerWidth / W;
  const scaleY = window.innerHeight / H;
  const scale = Math.min(scaleX, scaleY);
  canvas.style.width = `${W * scale}px`;
  canvas.style.height = `${H * scale}px`;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ---------------------------------------------------------------------------
// 2. Seeded Random for Reproducible Visuals
// ---------------------------------------------------------------------------

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ---------------------------------------------------------------------------
// 3. Audio System — Procedural Multi-Layer BGM
// ---------------------------------------------------------------------------

class AudioSystem {
  private actx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;

  // BGM layers
  private bassDrone: OscillatorNode | null = null;
  private bassDroneGain: GainNode | null = null;
  private ambientOsc: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;
  private melodicOsc: OscillatorNode | null = null;
  private melodicGain: GainNode | null = null;
  private padOsc1: OscillatorNode | null = null;
  private padGain1: GainNode | null = null;
  private padOsc2: OscillatorNode | null = null;
  private padGain2: GainNode | null = null;
  private arpTimer = 0;
  private arpIndex = 0;

  private currentZone: Zone = Zone.Ground;
  private bgmStarted = false;

  // Chinese pentatonic (gong-shang-jue-zhi-yu) in multiple octaves
  private pentatonic = [
    261.63, 293.66, 329.63, 392.00, 440.00,
    523.25, 587.33, 659.25, 783.99, 880.00,
    1046.50, 1174.66, 1318.51
  ];

  // Zone-specific scales
  private zoneScales = [
    [130.81, 146.83, 164.81, 196.00, 220.00], // Ground: deeper
    [261.63, 293.66, 329.63, 392.00, 440.00], // Cloud: mid
    [523.25, 587.33, 659.25, 783.99, 880.00], // Starfield: higher
    [783.99, 880.00, 1046.50, 1174.66, 1318.51], // Heaven: highest
  ];

  init() {
    if (this.actx) return;
    this.actx = new AudioContext();
    this.master = this.actx.createGain();
    this.master.gain.value = 0.45;
    this.master.connect(this.actx.destination);
  }

  startBGM() {
    if (!this.actx || !this.master || this.bgmStarted) return;
    this.bgmStarted = true;
    const now = this.actx.currentTime;

    // Bass drone — deep foundation
    this.bassDrone = this.actx.createOscillator();
    this.bassDroneGain = this.actx.createGain();
    this.bassDrone.type = 'sine';
    this.bassDrone.frequency.value = 65.41;
    this.bassDroneGain.gain.value = 0.1;
    this.bassDrone.connect(this.bassDroneGain);
    this.bassDroneGain.connect(this.master);
    this.bassDrone.start(now);

    // Ambient pad — warm foundation
    this.ambientOsc = this.actx.createOscillator();
    this.ambientGain = this.actx.createGain();
    this.ambientOsc.type = 'sine';
    this.ambientOsc.frequency.value = 130.81;
    this.ambientGain.gain.value = 0.04;
    this.ambientOsc.connect(this.ambientGain);
    this.ambientGain.connect(this.master);
    this.ambientOsc.start(now);

    // Melodic layer — responds to combo
    this.melodicOsc = this.actx.createOscillator();
    this.melodicGain = this.actx.createGain();
    this.melodicOsc.type = 'triangle';
    this.melodicOsc.frequency.value = 523.25;
    this.melodicGain.gain.value = 0.0;
    this.melodicOsc.connect(this.melodicGain);
    this.melodicGain.connect(this.master);
    this.melodicOsc.start(now);

    // Pad layer 1 — fifth harmony
    this.padOsc1 = this.actx.createOscillator();
    this.padGain1 = this.actx.createGain();
    this.padOsc1.type = 'sine';
    this.padOsc1.frequency.value = 196.00;
    this.padGain1.gain.value = 0.025;
    this.padOsc1.connect(this.padGain1);
    this.padGain1.connect(this.master);
    this.padOsc1.start(now);

    // Pad layer 2 — octave shimmer
    this.padOsc2 = this.actx.createOscillator();
    this.padGain2 = this.actx.createGain();
    this.padOsc2.type = 'sine';
    this.padOsc2.frequency.value = 392.00;
    this.padGain2.gain.value = 0.015;
    this.padOsc2.connect(this.padGain2);
    this.padGain2.connect(this.master);
    this.padOsc2.start(now);
  }

  stopBGM() {
    const now = this.actx?.currentTime ?? 0;
    const fade = 0.2;
    try { this.bassDroneGain?.gain.linearRampToValueAtTime(0, now + fade); this.bassDrone?.stop(now + fade + 0.1); } catch {}
    try { this.ambientGain?.gain.linearRampToValueAtTime(0, now + fade); this.ambientOsc?.stop(now + fade + 0.1); } catch {}
    try { this.melodicGain?.gain.linearRampToValueAtTime(0, now + fade); this.melodicOsc?.stop(now + fade + 0.1); } catch {}
    try { this.padGain1?.gain.linearRampToValueAtTime(0, now + fade); this.padOsc1?.stop(now + fade + 0.1); } catch {}
    try { this.padGain2?.gain.linearRampToValueAtTime(0, now + fade); this.padOsc2?.stop(now + fade + 0.1); } catch {}
    this.bgmStarted = false;
  }

  updateZone(zone: Zone, combo: number) {
    if (!this.actx || !this.bgmStarted) return;
    const now = this.actx.currentTime;

    const bassFreqs = [65.41, 73.42, 87.31, 98.00];
    this.bassDrone?.frequency.exponentialRampToValueAtTime(bassFreqs[zone], now + 1.5);

    const ambientFreqs = [130.81, 146.83, 174.61, 196.0];
    this.ambientOsc?.frequency.exponentialRampToValueAtTime(ambientFreqs[zone], now + 1.5);

    // Pad harmony shifts per zone
    const padFreqs1 = [196.00, 220.00, 261.63, 329.63];
    const padFreqs2 = [392.00, 440.00, 523.25, 659.25];
    this.padOsc1?.frequency.exponentialRampToValueAtTime(padFreqs1[zone], now + 2.0);
    this.padOsc2?.frequency.exponentialRampToValueAtTime(padFreqs2[zone], now + 2.0);

    // Zone volume changes
    const padVol = zone >= Zone.Cloud ? 0.04 : 0.025;
    this.padGain1?.gain.linearRampToValueAtTime(padVol, now + 1.0);
    this.padGain2?.gain.linearRampToValueAtTime(padVol * 0.6, now + 1.0);

    // Melodic volume based on combo
    const melodicVol = Math.min(combo * 0.012, 0.07);
    this.melodicGain?.gain.linearRampToValueAtTime(melodicVol, now + 0.3);

    if (combo > 0) {
      const scale = this.zoneScales[zone];
      const noteIdx = combo % scale.length;
      this.melodicOsc?.frequency.exponentialRampToValueAtTime(scale[noteIdx], now + 0.1);
    }
  }

  // Arpeggiator tick — called from game loop
  tickArp(dt: number, zone: Zone, combo: number) {
    if (!this.actx || !this.master || !this.bgmStarted || combo < 3) return;
    this.arpTimer += dt;
    const interval = Math.max(0.15, 0.4 - combo * 0.02);
    if (this.arpTimer >= interval) {
      this.arpTimer = 0;
      this.arpIndex++;
      const scale = this.zoneScales[zone];
      const freq = scale[this.arpIndex % scale.length];
      this.playArpNote(freq, 0.03 + Math.min(combo * 0.005, 0.04));
    }
  }

  private playArpNote(freq: number, vol: number) {
    if (!this.actx || !this.master) return;
    const now = this.actx.currentTime;
    const osc = this.actx.createOscillator();
    const gain = this.actx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  playLand(zone: Zone, combo: number) {
    if (!this.actx || !this.master) return;
    const now = this.actx.currentTime;
    const osc = this.actx.createOscillator();
    const gain = this.actx.createGain();

    switch (zone) {
      case Zone.Ground:
        osc.type = 'sine';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        break;
      case Zone.Cloud:
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800 + combo * 30, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.3);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        break;
      case Zone.Starfield:
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1200 + combo * 40, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.5);
        gain.gain.setValueAtTime(0.10, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        break;
      case Zone.Heaven:
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1600 + combo * 50, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
        break;
    }

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.8);

    // Add sub-bass thump for weight
    if (zone <= Zone.Cloud) {
      const sub = this.actx.createOscillator();
      const subG = this.actx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(50, now);
      sub.frequency.exponentialRampToValueAtTime(25, now + 0.1);
      subG.gain.setValueAtTime(0.15, now);
      subG.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      sub.connect(subG);
      subG.connect(this.master);
      sub.start(now);
      sub.stop(now + 0.15);
    }
  }

  playPerfect(combo: number) {
    if (!this.actx || !this.master) return;
    const now = this.actx.currentTime;
    const baseFreq = 523.25 * Math.pow(2, Math.min(combo, 12) / 12);

    // Main chime
    const osc = this.actx.createOscillator();
    const gain = this.actx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.3);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.5);

    // Shimmer harmonic
    const osc2 = this.actx.createOscillator();
    const gain2 = this.actx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(baseFreq * 2, now);
    gain2.gain.setValueAtTime(0.05, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc2.connect(gain2);
    gain2.connect(this.master);
    osc2.start(now);
    osc2.stop(now + 0.4);

    // Fifth harmony
    const osc3 = this.actx.createOscillator();
    const gain3 = this.actx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(baseFreq * 1.5, now + 0.05);
    gain3.gain.setValueAtTime(0.04, now + 0.05);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc3.connect(gain3);
    gain3.connect(this.master);
    osc3.start(now + 0.05);
    osc3.stop(now + 0.4);
  }

  playSlice() {
    if (!this.actx || !this.master) return;
    const now = this.actx.currentTime;
    const bufferSize = Math.floor(this.actx.sampleRate * 0.08);
    const buffer = this.actx.createBuffer(1, bufferSize, this.actx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }
    const noise = this.actx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.actx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    const filter = this.actx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    noise.start(now);
    noise.stop(now + 0.1);
  }

  playCollapse() {
    if (!this.actx || !this.master) return;
    const now = this.actx.currentTime;

    // Deep rumble
    const osc = this.actx.createOscillator();
    const gain = this.actx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 1.5);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 1.5);

    // Noise rumble
    const bufferSize = Math.floor(this.actx.sampleRate * 1.2);
    const buffer = this.actx.createBuffer(1, bufferSize, this.actx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2) * 0.25;
    }
    const noise = this.actx.createBufferSource();
    noise.buffer = buffer;
    const nGain = this.actx.createGain();
    nGain.gain.setValueAtTime(0.12, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    const lpf = this.actx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 300;
    noise.connect(lpf);
    lpf.connect(nGain);
    nGain.connect(this.master);
    noise.start(now);
    noise.stop(now + 1.2);
  }

  playBossWarning() {
    if (!this.actx || !this.master) return;
    const now = this.actx.currentTime;
    // Ominous descending tone
    for (let i = 0; i < 3; i++) {
      const osc = this.actx.createOscillator();
      const gain = this.actx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(400 - i * 80, now + i * 0.15);
      gain.gain.setValueAtTime(0.06, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.12);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.15);
    }
  }

  playZoneTransition() {
    if (!this.actx || !this.master) return;
    const now = this.actx.currentTime;
    // Ascending arpeggio
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25];
    for (let i = 0; i < notes.length; i++) {
      const osc = this.actx.createOscillator();
      const gain = this.actx.createGain();
      osc.type = 'sine';
      osc.frequency.value = notes[i];
      const t = now + i * 0.08;
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.35);
    }
  }

  playAchievement() {
    if (!this.actx || !this.master) return;
    const now = this.actx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    for (let i = 0; i < notes.length; i++) {
      const osc = this.actx.createOscillator();
      const gain = this.actx.createGain();
      osc.type = 'sine';
      const t = now + i * 0.1;
      osc.frequency.value = notes[i];
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.45);
    }
  }

  playWindGust() {
    if (!this.actx || !this.master) return;
    const now = this.actx.currentTime;
    const bufferSize = Math.floor(this.actx.sampleRate * 0.8);
    const buffer = this.actx.createBuffer(1, bufferSize, this.actx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.sin(Math.PI * i / bufferSize);
      data[i] = (Math.random() * 2 - 1) * env * 0.15;
    }
    const noise = this.actx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.actx.createGain();
    gain.gain.value = 0.1;
    const bpf = this.actx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = 800;
    bpf.Q.value = 0.5;
    noise.connect(bpf);
    bpf.connect(gain);
    gain.connect(this.master);
    noise.start(now);
    noise.stop(now + 0.8);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) {
      this.master.gain.linearRampToValueAtTime(
        this.muted ? 0 : 0.45,
        (this.actx?.currentTime ?? 0) + 0.1
      );
    }
    return this.muted;
  }

  get isMuted() { return this.muted; }
}

const audio = new AudioSystem();

// ---------------------------------------------------------------------------
// 4. Sprite Cache — Pre-rendered Offscreen Canvases
// ---------------------------------------------------------------------------

class SpriteCache {
  private cache = new Map<string, OffscreenCanvas>();

  getBlock(w: number, h: number, zone: Zone, roofStyle: number = 0): OffscreenCanvas {
    const key = `block_${Math.round(w)}_${h}_${zone}_${roofStyle}`;
    let oc = this.cache.get(key);
    if (oc) return oc;

    const pad = 6;
    oc = new OffscreenCanvas(Math.ceil(w) + pad * 2, h + pad * 2);
    const c = oc.getContext('2d')!;
    c.translate(pad, pad);

    switch (zone) {
      case Zone.Ground: this.drawStoneBlock(c, w, h, roofStyle); break;
      case Zone.Cloud: this.drawJadeBlock(c, w, h, roofStyle); break;
      case Zone.Starfield: this.drawMarbleBlock(c, w, h, roofStyle); break;
      case Zone.Heaven: this.drawCrystalBlock(c, w, h, roofStyle); break;
    }

    this.cache.set(key, oc);
    return oc;
  }

  private drawStoneBlock(c: OffscreenCanvasRenderingContext2D, w: number, h: number, style: number) {
    // Dark stone with moss texture
    const baseColor = style % 2 === 0 ? '#3a3a2e' : '#44403a';
    c.fillStyle = baseColor;
    c.fillRect(0, 0, w, h);

    // Stone texture noise
    const noiseCount = Math.floor(w * h * 0.25);
    for (let i = 0; i < noiseCount; i++) {
      const px = Math.random() * w;
      const py = Math.random() * h;
      c.fillStyle = `rgba(${60 + Math.random() * 20}, ${55 + Math.random() * 15}, ${40 + Math.random() * 15}, 0.5)`;
      c.fillRect(px, py, 1 + Math.random(), 1 + Math.random());
    }

    // Horizontal mortar lines
    if (style === 0 || style === 2) {
      c.strokeStyle = 'rgba(0,0,0,0.15)';
      c.lineWidth = 0.5;
      const midY = h * 0.5;
      c.beginPath();
      c.moveTo(0, midY);
      c.lineTo(w, midY);
      c.stroke();
    }

    // Moss patches
    for (let i = 0; i < 3; i++) {
      const mx = Math.random() * (w - 10);
      const my = Math.random() * (h - 5);
      c.fillStyle = `rgba(60, ${100 + Math.random() * 40}, 50, 0.35)`;
      c.beginPath();
      c.ellipse(mx, my, 4 + Math.random() * 6, 2 + Math.random() * 3, 0, 0, Math.PI * 2);
      c.fill();
    }

    // Ink-wash edge — soft feathered top
    const topGrad = c.createLinearGradient(0, 0, 0, h * 0.3);
    topGrad.addColorStop(0, 'rgba(255,255,220,0.12)');
    topGrad.addColorStop(1, 'rgba(255,255,220,0)');
    c.fillStyle = topGrad;
    c.fillRect(0, 0, w, h * 0.3);

    // Chinese architecture eave detail (小翘角) for some blocks
    if (style >= 2 && w > 40) {
      this.drawEaveDetail(c, w, h, 'rgba(80,70,50,0.6)');
    }

    // Edge lines
    c.strokeStyle = 'rgba(0,0,0,0.25)';
    c.lineWidth = 1;
    c.strokeRect(0.5, 0.5, w - 1, h - 1);
  }

  private drawJadeBlock(c: OffscreenCanvasRenderingContext2D, w: number, h: number, style: number) {
    const hueShift = style * 8;
    const grad = c.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, `hsl(${148 + hueShift}, 45%, 32%)`);
    grad.addColorStop(0.5, `hsl(${148 + hueShift}, 50%, 40%)`);
    grad.addColorStop(1, `hsl(${148 + hueShift}, 45%, 32%)`);
    c.fillStyle = grad;
    c.fillRect(0, 0, w, h);

    // Jade vein patterns
    c.strokeStyle = 'rgba(180, 230, 190, 0.18)';
    c.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      const startX = Math.random() * w;
      const startY = Math.random() * h;
      c.moveTo(startX, startY);
      for (let j = 0; j < 5; j++) {
        c.lineTo(
          startX + (Math.random() - 0.5) * w * 0.6,
          startY + (Math.random() - 0.5) * h * 0.8
        );
      }
      c.stroke();
    }

    // Carved inner border
    c.strokeStyle = 'rgba(255,255,255,0.12)';
    c.lineWidth = 0.8;
    c.strokeRect(3, 3, w - 6, h - 6);

    // Chinese cloud pattern decoration
    if (w > 50 && style % 2 === 0) {
      this.drawCloudPattern(c, w, h, 'rgba(180, 230, 200, 0.15)');
    }

    // Eave detail
    if (style >= 1 && w > 40) {
      this.drawEaveDetail(c, w, h, 'rgba(40, 100, 60, 0.5)');
    }

    // Glossy highlight
    const gloss = c.createLinearGradient(0, 0, 0, h * 0.4);
    gloss.addColorStop(0, 'rgba(255,255,255,0.18)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gloss;
    c.fillRect(0, 0, w, h * 0.4);

    c.strokeStyle = 'rgba(0,60,20,0.35)';
    c.lineWidth = 1;
    c.strokeRect(0.5, 0.5, w - 1, h - 1);
  }

  private drawMarbleBlock(c: OffscreenCanvasRenderingContext2D, w: number, h: number, style: number) {
    const baseVal = 225 + style * 5;
    c.fillStyle = `rgb(${baseVal}, ${baseVal - 8}, ${baseVal - 20})`;
    c.fillRect(0, 0, w, h);

    // Marble veining noise
    const noiseCount = Math.floor(w * h * 0.15);
    for (let i = 0; i < noiseCount; i++) {
      const px = Math.random() * w;
      const py = Math.random() * h;
      const v = 200 + Math.random() * 55;
      c.fillStyle = `rgba(${v}, ${v - 5}, ${v - 15}, 0.4)`;
      c.fillRect(px, py, 1 + Math.random() * 2, 1);
    }

    // Gold inlay frame
    c.strokeStyle = 'rgba(200, 170, 80, 0.45)';
    c.lineWidth = 0.8;
    c.strokeRect(4, 4, w - 8, h - 8);

    // Gold corner ornaments
    const corners: [number, number][] = [[5, 5], [w - 5, 5], [5, h - 5], [w - 5, h - 5]];
    corners.forEach(([cx, cy]) => {
      c.fillStyle = 'rgba(200, 170, 80, 0.5)';
      c.beginPath();
      c.arc(cx, cy, 1.5, 0, Math.PI * 2);
      c.fill();
    });

    // Star/constellation dots for starfield theme
    if (style >= 1) {
      for (let i = 0; i < 3; i++) {
        const sx = 8 + Math.random() * (w - 16);
        const sy = 4 + Math.random() * (h - 8);
        c.fillStyle = 'rgba(180, 200, 255, 0.3)';
        c.beginPath();
        c.arc(sx, sy, 0.8, 0, Math.PI * 2);
        c.fill();
      }
    }

    // Eave detail
    if (style >= 2 && w > 40) {
      this.drawEaveDetail(c, w, h, 'rgba(180, 160, 120, 0.4)');
    }

    // Top shine
    const shine = c.createLinearGradient(0, 0, 0, h * 0.3);
    shine.addColorStop(0, 'rgba(255,255,255,0.35)');
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = shine;
    c.fillRect(0, 0, w, h * 0.3);

    c.strokeStyle = 'rgba(150,140,120,0.25)';
    c.lineWidth = 1;
    c.strokeRect(0.5, 0.5, w - 1, h - 1);
  }

  private drawCrystalBlock(c: OffscreenCanvasRenderingContext2D, w: number, h: number, style: number) {
    const hueBase = style * 15;
    const grad = c.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, `hsla(${270 + hueBase}, 60%, 82%, 0.85)`);
    grad.addColorStop(0.3, `hsla(${30 + hueBase}, 60%, 85%, 0.75)`);
    grad.addColorStop(0.7, `hsla(${270 + hueBase}, 60%, 82%, 0.85)`);
    grad.addColorStop(1, `hsla(${40 + hueBase}, 60%, 88%, 0.75)`);
    c.fillStyle = grad;
    c.fillRect(0, 0, w, h);

    // Inner glow
    const innerGlow = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    innerGlow.addColorStop(0, 'rgba(255, 255, 220, 0.45)');
    innerGlow.addColorStop(0.6, 'rgba(255, 220, 180, 0.15)');
    innerGlow.addColorStop(1, 'rgba(200, 180, 255, 0)');
    c.fillStyle = innerGlow;
    c.fillRect(0, 0, w, h);

    // Refraction lines
    c.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    c.lineWidth = 0.5;
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.moveTo(Math.random() * w * 0.3, 0);
      c.lineTo(w * 0.5 + Math.random() * w * 0.5, h);
      c.stroke();
    }

    // Celestial palace motif — pagoda roof silhouette
    if (w > 60 && style >= 1) {
      this.drawPagodaMotif(c, w, h);
    }

    // Bright edge
    c.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    c.lineWidth = 1;
    c.strokeRect(0.5, 0.5, w - 1, h - 1);

    // Outer glow
    c.shadowColor = 'rgba(255, 220, 150, 0.5)';
    c.shadowBlur = 4;
    c.strokeStyle = 'rgba(255, 220, 150, 0.25)';
    c.strokeRect(0.5, 0.5, w - 1, h - 1);
    c.shadowBlur = 0;
  }

  private drawEaveDetail(c: OffscreenCanvasRenderingContext2D, w: number, h: number, color: string) {
    // Chinese roof eave tips (翘角)
    c.strokeStyle = color;
    c.lineWidth = 1;
    // Left eave
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(-3, -3, -4, -5);
    c.stroke();
    // Right eave
    c.beginPath();
    c.moveTo(w, 0);
    c.quadraticCurveTo(w + 3, -3, w + 4, -5);
    c.stroke();
  }

  private drawCloudPattern(c: OffscreenCanvasRenderingContext2D, w: number, h: number, color: string) {
    // Simplified Chinese cloud (如意纹)
    c.strokeStyle = color;
    c.lineWidth = 0.6;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.15;
    c.beginPath();
    c.arc(cx - r, cy, r * 0.6, 0, Math.PI, true);
    c.arc(cx, cy - r * 0.3, r * 0.5, Math.PI, 0, true);
    c.arc(cx + r, cy, r * 0.6, 0, Math.PI, true);
    c.stroke();
  }

  private drawPagodaMotif(c: OffscreenCanvasRenderingContext2D, w: number, h: number) {
    // Tiny pagoda silhouette
    c.fillStyle = 'rgba(255, 240, 200, 0.12)';
    const cx = w / 2;
    const by = h * 0.8;
    const pw = w * 0.15;
    // Base
    c.fillRect(cx - pw / 2, by - h * 0.3, pw, h * 0.3);
    // Roof
    c.beginPath();
    c.moveTo(cx - pw * 0.8, by - h * 0.3);
    c.lineTo(cx, by - h * 0.55);
    c.lineTo(cx + pw * 0.8, by - h * 0.3);
    c.closePath();
    c.fill();
  }

  clear() {
    this.cache.clear();
  }
}

const sprites = new SpriteCache();

// ---------------------------------------------------------------------------
// 5. Constellation Generator (for Starfield zone background)
// ---------------------------------------------------------------------------

function generateConstellations(): Constellation[] {
  const constellations: Constellation[] = [];
  for (let c = 0; c < 6; c++) {
    const numStars = 4 + Math.floor(Math.random() * 5);
    const baseX = Math.random() * W;
    const baseY = Math.random() * 600;
    const stars: Constellation['stars'] = [];
    for (let i = 0; i < numStars; i++) {
      stars.push({
        x: baseX + (Math.random() - 0.5) * 120,
        y: baseY + (Math.random() - 0.5) * 80,
        brightness: 0.3 + Math.random() * 0.7,
        size: 0.8 + Math.random() * 1.5,
      });
    }
    // Connect adjacent stars
    const connections: [number, number][] = [];
    for (let i = 0; i < numStars - 1; i++) {
      connections.push([i, i + 1]);
    }
    if (numStars > 3) {
      connections.push([0, numStars - 1]);
    }
    constellations.push({ stars, connections, offsetY: c * 200 });
  }
  return constellations;
}

const constellations = generateConstellations();

// ---------------------------------------------------------------------------
// 6. Parallax Background System
// ---------------------------------------------------------------------------

interface ParallaxLayer {
  elements: { x: number; y: number; w: number; h: number; seed: number }[];
  speed: number;
}

function createParallaxLayers(): ParallaxLayer[] {
  // Layer 0: Distant ink-wash mountains
  const mountains: ParallaxLayer = { elements: [], speed: 0.02 };
  for (let i = 0; i < 10; i++) {
    mountains.elements.push({
      x: i * 50 - 30,
      y: 0,
      w: 70 + Math.random() * 80,
      h: 80 + Math.random() * 180,
      seed: Math.random(),
    });
  }

  // Layer 1: Mid clouds
  const midClouds: ParallaxLayer = { elements: [], speed: 0.05 };
  for (let i = 0; i < 14; i++) {
    midClouds.elements.push({
      x: Math.random() * W * 1.5 - W * 0.25,
      y: Math.random() * H,
      w: 40 + Math.random() * 90,
      h: 12 + Math.random() * 22,
      seed: Math.random(),
    });
  }

  // Layer 2: Near clouds / mist
  const nearClouds: ParallaxLayer = { elements: [], speed: 0.1 };
  for (let i = 0; i < 10; i++) {
    nearClouds.elements.push({
      x: Math.random() * W * 1.5 - W * 0.25,
      y: Math.random() * H,
      w: 50 + Math.random() * 120,
      h: 18 + Math.random() * 30,
      seed: Math.random(),
    });
  }

  return [mountains, midClouds, nearClouds];
}

// ---------------------------------------------------------------------------
// 7. Zone Helpers
// ---------------------------------------------------------------------------

function getZone(height: number): Zone {
  if (height >= 40) return Zone.Heaven;
  if (height >= 25) return Zone.Starfield;
  if (height >= 10) return Zone.Cloud;
  return Zone.Ground;
}

function getZoneBgColors(zone: Zone, _t: number): [string, string, string] {
  switch (zone) {
    case Zone.Ground: return ['#1a1a2e', '#2d2d44', '#3a3020'];
    case Zone.Cloud: return ['#1a2a3e', '#2a4a5e', '#2d3d2d'];
    case Zone.Starfield: return ['#060818', '#0a1530', '#14204a'];
    case Zone.Heaven: return ['#2a1a0a', '#5a3a10', '#8a6a20'];
  }
}

function getAmbientColor(zone: Zone): string {
  switch (zone) {
    case Zone.Ground: return 'rgba(255, 200, 100, 0.025)';
    case Zone.Cloud: return 'rgba(100, 200, 150, 0.025)';
    case Zone.Starfield: return 'rgba(80, 100, 200, 0.03)';
    case Zone.Heaven: return 'rgba(255, 220, 100, 0.05)';
  }
}

// ---------------------------------------------------------------------------
// 8. Game State
// ---------------------------------------------------------------------------

const enum GamePhase {
  Title,
  Tutorial,
  Playing,
  ZoneTransition,
  Dying,
  GameOver,
}

let phase: GamePhase = GamePhase.Title;
let tower: Block[] = [];
let currentBlock: { x: number; w: number; dir: number; speed: number } | null = null;
let fallingPieces: FallingPiece[] = [];
let particles: Particle[] = [];
let weatherParticles: WeatherParticle[] = [];
let collapseBlocks: CollapseBlock[] = [];
let rippleRings: RippleRing[] = [];
let inkSplashes: InkSplash[] = [];

let score = 0;
let combo = 0;
let maxCombo = 0;
let towerHeight = 0;
let bestHeight = 0;
let bestScore = 0;
let currentZone: Zone = Zone.Ground;
let cameraY = 0;
let targetCameraY = 0;
let slowMoTimer = 0;
let slowMoFactor = 1;
let collapseTimer = 0;
let gameOverTimer = 0;
let comboTextTimer = 0;
let comboText = '';
let shakeTimer = 0;
let shakeIntensity = 0;
let perfectBeamTimer = 0;
let perfectBeamX = 0;
let scoreMultiplier = 1;
let multiplierTimer = 0;

// Tower physics
let towerLean = 0;
let towerLeanTarget = 0;
let towerLeanVelocity = 0;

// Wind system
let wind: WindGust = { strength: 0, direction: 0, duration: 0, timer: 0 };
let windCooldown = 0;

// Boss events
let bossEvent: BossEvent = {
  active: false, type: 'wind_blast', timer: 0, duration: 0,
  intensity: 0, warningTimer: 0
};
let bossEventCooldown = 0;
let bossEventsTriggered = 0;

// Zone transition
let zoneTransitionTimer = 0;
let zoneTransitionFrom: Zone = Zone.Ground;
let zoneTransitionTo: Zone = Zone.Ground;

// Tutorial
let tutorialStep = 0;
let tutorialTimer = 0;
let hasPlayedBefore = false;

let paused = false;
let frameCount = 0;
let lastTime = 0;

let parallaxLayers = createParallaxLayers();

// Achievements
let achievements: Achievement[] = [
  { id: 'first_perfect', name: '初手完美', desc: '首次完美堆叠', unlocked: false, justUnlocked: false, showTimer: 0 },
  { id: 'combo_5', name: '五连击', desc: '达成5连击完美', unlocked: false, justUnlocked: false, showTimer: 0 },
  { id: 'combo_10', name: '天工开物', desc: '达成10连击完美', unlocked: false, justUnlocked: false, showTimer: 0 },
  { id: 'reach_cloud', name: '入云端', desc: '到达云层', unlocked: false, justUnlocked: false, showTimer: 0 },
  { id: 'reach_star', name: '摘星辰', desc: '到达星河', unlocked: false, justUnlocked: false, showTimer: 0 },
  { id: 'reach_heaven', name: '登天宫', desc: '到达仙宫', unlocked: false, justUnlocked: false, showTimer: 0 },
  { id: 'height_20', name: '二十层楼', desc: '堆叠20层', unlocked: false, justUnlocked: false, showTimer: 0 },
  { id: 'height_50', name: '摩天之塔', desc: '堆叠50层', unlocked: false, justUnlocked: false, showTimer: 0 },
  { id: 'survive_boss', name: '逆风而行', desc: '在Boss事件中存活', unlocked: false, justUnlocked: false, showTimer: 0 },
  { id: 'score_1000', name: '千分大师', desc: '得分达到1000', unlocked: false, justUnlocked: false, showTimer: 0 },
];
let achievementQueue: Achievement[] = [];

// Passport
let passport: Passport | null = null;

// ---------------------------------------------------------------------------
// 9. Passport & Storage Integration
// ---------------------------------------------------------------------------

function loadPassport() {
  try {
    const raw = localStorage.getItem('melos_passport');
    if (raw) passport = JSON.parse(raw);
  } catch {}
}

function savePassport() {
  if (!passport) return;
  try {
    localStorage.setItem('melos_passport', JSON.stringify(passport));
  } catch {}
}

function loadBestHeight(): number {
  try { return parseFloat(localStorage.getItem('pagoda_best_height') || '0') || 0; } catch { return 0; }
}

function saveBestHeight(h: number) {
  try { localStorage.setItem('pagoda_best_height', String(h)); } catch {}
}

function loadBestScore(): number {
  try { return parseFloat(localStorage.getItem('pagoda_best_score') || '0') || 0; } catch { return 0; }
}

function saveBestScore(s: number) {
  try { localStorage.setItem('pagoda_best_score', String(s)); } catch {}
}

function loadAchievements() {
  try {
    const raw = localStorage.getItem('pagoda_achievements');
    if (raw) {
      const saved: string[] = JSON.parse(raw);
      for (const a of achievements) {
        if (saved.includes(a.id)) a.unlocked = true;
      }
    }
  } catch {}
  try {
    hasPlayedBefore = localStorage.getItem('pagoda_played') === '1';
  } catch {}
}

function saveAchievements() {
  try {
    const ids = achievements.filter(a => a.unlocked).map(a => a.id);
    localStorage.setItem('pagoda_achievements', JSON.stringify(ids));
  } catch {}
}

function unlockAchievement(id: string) {
  const a = achievements.find(v => v.id === id);
  if (a && !a.unlocked) {
    a.unlocked = true;
    a.justUnlocked = true;
    a.showTimer = 3.0;
    achievementQueue.push(a);
    audio.playAchievement();
    saveAchievements();
  }
}

// ---------------------------------------------------------------------------
// 10. Wind System
// ---------------------------------------------------------------------------

function spawnWindGust() {
  wind = {
    strength: 0.5 + Math.random() * 1.5,
    direction: Math.random() < 0.5 ? -1 : 1,
    duration: 2 + Math.random() * 3,
    timer: 0,
  };
  audio.playWindGust();
}

function updateWind(dt: number) {
  if (wind.timer < wind.duration && wind.strength > 0) {
    wind.timer += dt;
    const progress = wind.timer / wind.duration;
    // Bell curve intensity
    const envelope = Math.sin(progress * Math.PI);
    const currentStrength = wind.strength * envelope;

    // Apply wind to current block
    if (currentBlock && phase === GamePhase.Playing) {
      currentBlock.x += wind.direction * currentStrength * 0.3 * dt * 60;
    }

    // Tower lean from wind
    towerLeanTarget = wind.direction * currentStrength * 1.5;
  } else {
    towerLeanTarget = 0;
  }

  // Random wind spawning
  if (phase === GamePhase.Playing) {
    windCooldown -= dt;
    if (windCooldown <= 0 && towerHeight >= 8) {
      const chance = 0.003 + towerHeight * 0.0002;
      if (Math.random() < chance) {
        spawnWindGust();
        windCooldown = 5 + Math.random() * 5;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 11. Boss Event System
// ---------------------------------------------------------------------------

function triggerBossEvent() {
  const types: BossEvent['type'][] = ['wind_blast', 'shrink', 'speed_up', 'reverse'];
  const type = types[Math.floor(Math.random() * types.length)];

  bossEvent = {
    active: true,
    type,
    timer: 0,
    duration: type === 'wind_blast' ? 3 : type === 'shrink' ? 1 : 4,
    intensity: 1 + bossEventsTriggered * 0.2,
    warningTimer: 1.5,
  };
  bossEventsTriggered++;
  audio.playBossWarning();
}

function updateBossEvent(dt: number) {
  if (!bossEvent.active) {
    // Check if should trigger
    bossEventCooldown -= dt;
    if (bossEventCooldown <= 0 && towerHeight >= 15 && phase === GamePhase.Playing) {
      // Boss events every ~15 blocks after height 15
      const threshold = 15 + bossEventsTriggered * 12;
      if (towerHeight >= threshold) {
        triggerBossEvent();
        bossEventCooldown = 8 + Math.random() * 8;
      }
    }
    return;
  }

  // Warning phase
  if (bossEvent.warningTimer > 0) {
    bossEvent.warningTimer -= dt;
    if (bossEvent.warningTimer <= 0) {
      // Apply the event
      applyBossEvent();
    }
    return;
  }

  bossEvent.timer += dt;
  if (bossEvent.timer >= bossEvent.duration) {
    bossEvent.active = false;
    unlockAchievement('survive_boss');
  }
}

function applyBossEvent() {
  if (!currentBlock) return;
  switch (bossEvent.type) {
    case 'wind_blast':
      wind = {
        strength: 2 + bossEvent.intensity,
        direction: Math.random() < 0.5 ? -1 : 1,
        duration: bossEvent.duration,
        timer: 0,
      };
      audio.playWindGust();
      break;
    case 'shrink':
      if (currentBlock) {
        currentBlock.w = Math.max(currentBlock.w * 0.7, MIN_BLOCK_W * 2);
      }
      break;
    case 'speed_up':
      if (currentBlock) {
        currentBlock.speed *= 1.5 + bossEvent.intensity * 0.2;
      }
      break;
    case 'reverse':
      if (currentBlock) {
        currentBlock.dir *= -1;
        currentBlock.speed *= 1.2;
      }
      break;
  }
}

function getBossEventName(): string {
  switch (bossEvent.type) {
    case 'wind_blast': return '狂风来袭!';
    case 'shrink': return '塔块缩小!';
    case 'speed_up': return '速度暴增!';
    case 'reverse': return '方向逆转!';
  }
}

// ---------------------------------------------------------------------------
// 12. Weather System
// ---------------------------------------------------------------------------

function spawnWeatherParticle(zone: Zone) {
  switch (zone) {
    case Zone.Ground: {
      // Falling leaves & petals
      const isLeaf = Math.random() < 0.7;
      weatherParticles.push({
        x: Math.random() * W,
        y: -10 + cameraY,
        vx: Math.random() * 0.5 - 0.25 + Math.sin(frameCount * 0.01) * 0.3,
        vy: 0.4 + Math.random() * 0.4,
        size: isLeaf ? 3 + Math.random() * 4 : 2 + Math.random() * 3,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.05,
        alpha: 0.3 + Math.random() * 0.4,
        type: isLeaf ? 'leaf' : 'petal',
        twinkle: 0,
      });
      break;
    }
    case Zone.Cloud: {
      // Cloud wisps & fireflies
      const isCloud = Math.random() < 0.6;
      if (isCloud) {
        weatherParticles.push({
          x: -20,
          y: Math.random() * H + cameraY - H * 0.5,
          vx: 0.3 + Math.random() * 0.3,
          vy: Math.random() * 0.1 - 0.05,
          size: 20 + Math.random() * 35,
          rot: 0, vr: 0,
          alpha: 0.04 + Math.random() * 0.08,
          type: 'cloud',
          twinkle: 0,
        });
      } else {
        weatherParticles.push({
          x: Math.random() * W,
          y: Math.random() * H + cameraY - H * 0.3,
          vx: (Math.random() - 0.5) * 0.3,
          vy: -0.1 - Math.random() * 0.2,
          size: 1.5 + Math.random() * 2,
          rot: 0, vr: 0,
          alpha: 0.2 + Math.random() * 0.5,
          type: 'firefly',
          twinkle: Math.random() * Math.PI * 2,
        });
      }
      break;
    }
    case Zone.Starfield: {
      // Stars & snow
      const isStar = Math.random() < 0.4;
      if (isStar) {
        weatherParticles.push({
          x: Math.random() * W,
          y: Math.random() * H + cameraY - H * 0.5,
          vx: 0, vy: 0,
          size: 0.5 + Math.random() * 2,
          rot: 0, vr: 0,
          alpha: Math.random() * 0.8,
          type: 'star',
          twinkle: Math.random() * Math.PI * 2,
        });
      } else {
        weatherParticles.push({
          x: Math.random() * W,
          y: -5 + cameraY,
          vx: Math.random() * 0.3 - 0.15,
          vy: 0.3 + Math.random() * 0.4,
          size: 1.5 + Math.random() * 2,
          rot: 0, vr: 0,
          alpha: 0.4 + Math.random() * 0.4,
          type: 'snow',
          twinkle: 0,
        });
      }
      break;
    }
    case Zone.Heaven: {
      // Golden sparkles ascending
      weatherParticles.push({
        x: Math.random() * W,
        y: Math.random() * H + cameraY - H * 0.5,
        vx: Math.random() * 0.2 - 0.1,
        vy: -0.2 - Math.random() * 0.4,
        size: 1 + Math.random() * 2.5,
        rot: 0, vr: 0,
        alpha: Math.random() * 0.7,
        type: 'golden',
        twinkle: Math.random() * Math.PI * 2,
      });
      break;
    }
  }
}

function updateWeather(dt: number) {
  const rates = [0.035, 0.025, 0.06, 0.08];
  if (Math.random() < rates[currentZone]) {
    spawnWeatherParticle(currentZone);
  }

  // Wind effect on weather
  const windEffect = wind.timer < wind.duration ? wind.direction * wind.strength * Math.sin(wind.timer / wind.duration * Math.PI) * 0.5 : 0;

  for (let i = weatherParticles.length - 1; i >= 0; i--) {
    const p = weatherParticles[i];
    p.x += (p.vx + windEffect * 0.3) * dt * 60;
    p.y += p.vy * dt * 60;
    p.rot += p.vr * dt * 60;
    p.twinkle += dt * 3;

    // Leaf sway
    if (p.type === 'leaf' || p.type === 'petal') {
      p.vx += Math.sin(frameCount * 0.02 + p.y * 0.01) * 0.008;
    }

    // Remove if off screen
    const screenY = p.y - cameraY;
    if (screenY > H + 50 || screenY < -50 || p.x < -60 || p.x > W + 60) {
      weatherParticles.splice(i, 1);
    }
  }

  // Cap
  if (weatherParticles.length > 80) {
    weatherParticles.splice(0, weatherParticles.length - 80);
  }
}

// ---------------------------------------------------------------------------
// 13. Particle Effects
// ---------------------------------------------------------------------------

function spawnLandingParticles(x: number, y: number, w: number, zone: Zone) {
  const count = 14 + Math.floor(Math.random() * 10);
  for (let i = 0; i < count; i++) {
    const angle = Math.PI + (Math.random() - 0.5) * Math.PI * 0.8;
    const speed = 1 + Math.random() * 3;
    let color: string;
    switch (zone) {
      case Zone.Ground: color = `rgba(${120 + Math.random() * 40}, ${100 + Math.random() * 30}, ${70 + Math.random() * 30}, 1)`; break;
      case Zone.Cloud: color = `rgba(${60 + Math.random() * 40}, ${180 + Math.random() * 40}, ${100 + Math.random() * 40}, 1)`; break;
      case Zone.Starfield: color = `rgba(${220 + Math.random() * 35}, ${215 + Math.random() * 35}, ${200 + Math.random() * 35}, 1)`; break;
      case Zone.Heaven: color = `rgba(${255}, ${220 + Math.random() * 35}, ${100 + Math.random() * 80}, 1)`; break;
    }
    particles.push({
      x: x - w / 2 + Math.random() * w,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.4 + Math.random() * 0.3,
      maxLife: 0.4 + Math.random() * 0.3,
      size: 1.5 + Math.random() * 2.5,
      color,
      type: 'dust',
      rot: 0, vr: 0, alpha: 1,
    });
  }
}

function spawnPerfectEffect(x: number, y: number) {
  // Golden ripple ring
  rippleRings.push({ x, y, radius: 5, maxRadius: 130, alpha: 0.8 });

  // Light beam
  perfectBeamTimer = 1.2;
  perfectBeamX = x;

  // Sparkle particles
  for (let i = 0; i < 24; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3.5;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.5,
      life: 0.5 + Math.random() * 0.5,
      maxLife: 0.5 + Math.random() * 0.5,
      size: 2 + Math.random() * 3,
      color: `rgba(255, ${200 + Math.random() * 55}, ${50 + Math.random() * 100}, 1)`,
      type: 'spark',
      rot: 0, vr: 0, alpha: 1,
    });
  }

  // Ink splash for combo >= 3
  if (combo >= 3) {
    spawnInkSplash(x, y);
  }
}

function spawnInkSplash(x: number, y: number) {
  const drops: InkSplash['drops'] = [];
  for (let i = 0; i < 5 + Math.floor(Math.random() * 4); i++) {
    drops.push({
      dx: (Math.random() - 0.5) * 40,
      dy: (Math.random() - 0.5) * 20,
      r: 2 + Math.random() * 5,
    });
  }
  inkSplashes.push({
    x, y,
    radius: 3,
    targetRadius: 15 + Math.random() * 10,
    alpha: 0.6,
    drops,
  });
}

function spawnZoneTransitionParticles(zone: Zone) {
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H + cameraY;
    let color: string;
    let type: Particle['type'] = 'spark';
    switch (zone) {
      case Zone.Cloud:
        color = `rgba(${100 + Math.random() * 80}, ${200 + Math.random() * 55}, ${150 + Math.random() * 50}, 1)`;
        type = 'leaf';
        break;
      case Zone.Starfield:
        color = `rgba(${180 + Math.random() * 75}, ${190 + Math.random() * 65}, 255, 1)`;
        type = 'star';
        break;
      case Zone.Heaven:
        color = `rgba(255, ${220 + Math.random() * 35}, ${80 + Math.random() * 100}, 1)`;
        type = 'golden';
        break;
      default:
        color = `rgba(200, 180, 150, 1)`;
    }
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 3,
      vy: -1 - Math.random() * 3,
      life: 1 + Math.random() * 1,
      maxLife: 1 + Math.random() * 1,
      size: 2 + Math.random() * 4,
      color, type,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.1,
      alpha: 1,
    });
  }
}

function spawnEmbers(x: number, y: number, count: number) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * 40,
      y: y + (Math.random() - 0.5) * 10,
      vx: (Math.random() - 0.5) * 1.5,
      vy: -1 - Math.random() * 2,
      life: 0.8 + Math.random() * 0.8,
      maxLife: 0.8 + Math.random() * 0.8,
      size: 1 + Math.random() * 2,
      color: `rgba(255, ${150 + Math.random() * 80}, ${30 + Math.random() * 50}, 1)`,
      type: 'ember',
      rot: 0, vr: 0, alpha: 1,
    });
  }
}

function updateParticles(dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    p.rot += p.vr * dt * 60;

    // Gravity varies by type
    if (p.type === 'ember') {
      p.vy -= 0.02 * dt * 60; // embers rise
      p.vx *= 0.99;
    } else if (p.type === 'star' || p.type === 'golden') {
      p.vy += 0.01 * dt * 60; // very light gravity
    } else {
      p.vy += 0.08 * dt * 60;
    }

    p.life -= dt;
    p.alpha = Math.max(0, p.life / p.maxLife);

    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }

  // Update ripple rings
  for (let i = rippleRings.length - 1; i >= 0; i--) {
    const r = rippleRings[i];
    r.radius += 120 * dt;
    r.alpha = Math.max(0, 1 - r.radius / r.maxRadius) * 0.8;
    if (r.radius >= r.maxRadius) {
      rippleRings.splice(i, 1);
    }
  }

  // Update ink splashes
  for (let i = inkSplashes.length - 1; i >= 0; i--) {
    const s = inkSplashes[i];
    s.radius += (s.targetRadius - s.radius) * 0.15;
    s.alpha -= dt * 0.4;
    if (s.alpha <= 0) {
      inkSplashes.splice(i, 1);
    }
  }

  // Perfect beam
  if (perfectBeamTimer > 0) perfectBeamTimer -= dt;

  // Cap particles
  if (particles.length > 250) {
    particles.splice(0, particles.length - 250);
  }
}

// ---------------------------------------------------------------------------
// 14. Tower Wobble Physics
// ---------------------------------------------------------------------------

function updateTowerPhysics(dt: number) {
  // Tower lean dynamics (spring-damper)
  const springK = 3.0;
  const damping = 0.85;

  const leanForce = (towerLeanTarget - towerLean) * springK;
  towerLeanVelocity += leanForce * dt;
  towerLeanVelocity *= Math.pow(damping, dt * 60);
  towerLean += towerLeanVelocity * dt * 60;

  // Clamp lean
  towerLean = Math.max(-MAX_TOWER_LEAN, Math.min(MAX_TOWER_LEAN, towerLean));

  // Update individual block wobble
  for (let i = 1; i < tower.length; i++) {
    const b = tower[i];
    if (!b.settled) {
      b.wobbleOffset *= 0.92;
      b.wobblePhase += dt * 12;
      if (Math.abs(b.wobbleOffset) < 0.1) {
        b.settled = true;
        b.wobbleOffset = 0;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 15. Game Logic
// ---------------------------------------------------------------------------

function resetGame() {
  tower = [];
  fallingPieces = [];
  particles = [];
  collapseBlocks = [];
  rippleRings = [];
  weatherParticles = [];
  inkSplashes = [];
  score = 0;
  combo = 0;
  maxCombo = 0;
  towerHeight = 0;
  currentZone = Zone.Ground;
  cameraY = 0;
  targetCameraY = 0;
  slowMoTimer = 0;
  slowMoFactor = 1;
  collapseTimer = 0;
  gameOverTimer = 0;
  comboTextTimer = 0;
  perfectBeamTimer = 0;
  shakeTimer = 0;
  scoreMultiplier = 1;
  multiplierTimer = 0;
  towerLean = 0;
  towerLeanTarget = 0;
  towerLeanVelocity = 0;
  wind = { strength: 0, direction: 0, duration: 0, timer: 0 };
  windCooldown = 5;
  bossEvent = { active: false, type: 'wind_blast', timer: 0, duration: 0, intensity: 0, warningTimer: 0 };
  bossEventCooldown = 10;
  bossEventsTriggered = 0;
  sprites.clear();

  bestHeight = loadBestHeight();
  bestScore = loadBestScore();

  // Base block
  tower.push({
    x: W / 2,
    y: H - 60,
    w: INITIAL_BLOCK_W,
    zone: Zone.Ground,
    wobbleOffset: 0,
    wobblePhase: 0,
    settled: true,
    roofStyle: 0,
  });

  spawnMovingBlock();
  phase = GamePhase.Playing;
}

function spawnMovingBlock() {
  const topBlock = tower[tower.length - 1];
  let w = topBlock.w;

  // Combo width bonuses
  if (combo >= 10) {
    w = INITIAL_BLOCK_W;
  } else if (combo >= 5) {
    w = Math.min(w * 1.2, INITIAL_BLOCK_W);
  } else if (combo >= 3) {
    w = Math.min(w * 1.1, INITIAL_BLOCK_W);
  }

  const speed = SWING_BASE_SPEED + tower.length * SWING_ACCEL;
  const dir = Math.random() < 0.5 ? 1 : -1;

  currentBlock = {
    x: dir > 0 ? -w / 2 : W + w / 2,
    w,
    dir,
    speed,
  };
}

function dropBlock() {
  if (!currentBlock || phase !== GamePhase.Playing) return;

  const topBlock = tower[tower.length - 1];
  const topY = topBlock.y - BLOCK_H;
  const cx = currentBlock.x;
  const cw = currentBlock.w;
  const tx = topBlock.x;
  const tw = topBlock.w;

  // Calculate overlap
  const cLeft = cx - cw / 2;
  const cRight = cx + cw / 2;
  const tLeft = tx - tw / 2;
  const tRight = tx + tw / 2;

  const overlapLeft = Math.max(cLeft, tLeft);
  const overlapRight = Math.min(cRight, tRight);
  const overlapW = overlapRight - overlapLeft;

  if (overlapW <= 0) {
    startCollapse();
    return;
  }

  const offset = Math.abs(cx - tx);
  const isPerfect = offset <= PERFECT_THRESHOLD;
  const isNearPerfect = offset <= NEAR_PERFECT_THRESHOLD && !isPerfect;
  const heightLevel = tower.length;
  const zone = getZone(heightLevel);
  const roofStyle = Math.floor(Math.random() * 4);

  if (isPerfect) {
    // Perfect stack — keep full width of top block
    const newW = currentBlock.w;
    const newX = tx;
    tower.push({
      x: newX, y: topY, w: newW, zone, roofStyle,
      wobbleOffset: 0, wobblePhase: 0, settled: true,
    });
    combo++;
    if (combo > maxCombo) maxCombo = combo;

    // Score with multiplier
    const baseScore = heightLevel * 3 + combo * 5;
    score += Math.floor(baseScore * scoreMultiplier);

    // Increase multiplier on perfect
    scoreMultiplier = Math.min(scoreMultiplier + 0.1, 3.0);
    multiplierTimer = 5;

    spawnPerfectEffect(newX, topY);
    audio.playPerfect(combo);
    audio.playLand(zone, combo);

    try { navigator.vibrate(50); } catch {}

    // Achievement checks
    if (!achievements[0].unlocked) unlockAchievement('first_perfect');
    if (combo >= 5) unlockAchievement('combo_5');
    if (combo >= 10) unlockAchievement('combo_10');

    // Combo text
    if (combo >= 15) {
      comboText = '仙人之技!';
      comboTextTimer = 2.5;
      spawnEmbers(newX, topY, 15);
    } else if (combo >= 10) {
      comboText = '天工开物!';
      comboTextTimer = 2.0;
      spawnEmbers(newX, topY, 10);
    } else if (combo >= 5) {
      comboText = '完美连击!';
      comboTextTimer = 1.5;
    } else if (combo >= 3) {
      comboText = '恢复!';
      comboTextTimer = 1.0;
    } else {
      comboText = '完美!';
      comboTextTimer = 0.8;
    }

    shakeTimer = 0.12;
    shakeIntensity = 2.5;
  } else {
    // Normal stack with slice
    const newX = (overlapLeft + overlapRight) / 2;
    const newW = overlapW;

    if (newW < MIN_BLOCK_W) {
      startCollapse();
      return;
    }

    tower.push({
      x: newX, y: topY, w: newW, zone, roofStyle,
      wobbleOffset: (cx - tx) * 0.3,
      wobblePhase: 0,
      settled: false,
    });
    combo = 0;
    scoreMultiplier = Math.max(1, scoreMultiplier - 0.3);
    score += Math.floor(heightLevel * scoreMultiplier);

    // Slice off the overhanging piece
    let sliceX: number, sliceW: number;
    if (cx > tx) {
      sliceX = overlapRight + (cRight - overlapRight) / 2;
      sliceW = cRight - overlapRight;
    } else {
      sliceX = cLeft + (overlapLeft - cLeft) / 2;
      sliceW = overlapLeft - cLeft;
    }

    if (sliceW > 1) {
      fallingPieces.push({
        x: sliceX, y: topY, w: sliceW, h: BLOCK_H,
        vx: (cx > tx ? 1 : -1) * (2 + Math.random() * 2),
        vy: -1 - Math.random() * 2,
        rot: 0,
        vr: (cx > tx ? 1 : -1) * (0.02 + Math.random() * 0.05),
        zone, alpha: 1,
      });
      audio.playSlice();
    }

    spawnLandingParticles(newX, topY, newW, zone);
    audio.playLand(zone, 0);

    // Apply wobble force to tower lean
    towerLeanTarget = (cx - tx) * 0.15;
    towerLeanVelocity += (cx - tx) * 0.05;

    try { navigator.vibrate(10); } catch {}

    shakeTimer = 0.08;
    shakeIntensity = 1.5;

    if (isNearPerfect) {
      slowMoTimer = 0.3;
    }
  }

  // Update tower height and zone
  towerHeight = tower.length - 1;
  const newZone = getZone(towerHeight);
  if (newZone !== currentZone) {
    // Zone transition!
    zoneTransitionFrom = currentZone;
    zoneTransitionTo = newZone;
    zoneTransitionTimer = 2.0;
    currentZone = newZone;
    audio.playZoneTransition();
    spawnZoneTransitionParticles(newZone);

    // Zone achievements
    if (newZone === Zone.Cloud) unlockAchievement('reach_cloud');
    if (newZone === Zone.Starfield) unlockAchievement('reach_star');
    if (newZone === Zone.Heaven) unlockAchievement('reach_heaven');
  }
  audio.updateZone(currentZone, combo);

  // Height achievements
  if (towerHeight >= 20) unlockAchievement('height_20');
  if (towerHeight >= 50) unlockAchievement('height_50');
  if (score >= 1000) unlockAchievement('score_1000');

  // Update camera
  const blockScreenY = topY - cameraY;
  if (blockScreenY < H * 0.45) {
    targetCameraY = topY - H * 0.45;
  }

  // Save best
  if (towerHeight > bestHeight) {
    bestHeight = towerHeight;
    saveBestHeight(bestHeight);
  }
  if (score > bestScore) {
    bestScore = score;
    saveBestScore(bestScore);
  }

  // Spawn next
  currentBlock = null;
  setTimeout(() => {
    if (phase === GamePhase.Playing) {
      spawnMovingBlock();
    }
  }, 150);
}

function startCollapse() {
  phase = GamePhase.Dying;
  collapseTimer = 0;
  audio.playCollapse();
  audio.stopBGM();

  try { navigator.vibrate(200); } catch {}

  // Convert tower blocks to physics collapse blocks
  for (let i = tower.length - 1; i >= 0; i--) {
    const b = tower[i];
    const delay = (tower.length - 1 - i) * 0.05;
    setTimeout(() => {
      collapseBlocks.push({
        x: b.x, y: b.y, w: b.w, h: BLOCK_H,
        vx: (Math.random() - 0.5) * 6,
        vy: -2 - Math.random() * 4,
        rot: 0,
        vr: (Math.random() - 0.5) * 0.15,
        zone: b.zone,
      });
    }, delay * 1000);
  }

  // Falling current block
  if (currentBlock) {
    const topBlock = tower[tower.length - 1];
    fallingPieces.push({
      x: currentBlock.x,
      y: topBlock.y - BLOCK_H,
      w: currentBlock.w, h: BLOCK_H,
      vx: currentBlock.dir * currentBlock.speed,
      vy: 0, rot: 0,
      vr: 0.03 * currentBlock.dir,
      zone: getZone(tower.length),
      alpha: 1,
    });
    currentBlock = null;
  }

  shakeTimer = 1.5;
  shakeIntensity = 8;

  setTimeout(() => {
    phase = GamePhase.GameOver;
    gameOverTimer = 0;

    // Update passport
    if (passport) {
      passport.gamesPlayed++;
      if (towerHeight >= 40 && !passport.completedGames.includes('celestial-tower')) {
        passport.completedGames.push('celestial-tower');
      }
      passport.totalScore += score;
      passport.lastPlayed = new Date().toISOString().slice(0, 10);
      savePassport();
    }

    try { localStorage.setItem('pagoda_played', '1'); } catch {}
  }, 2500);
}

// ---------------------------------------------------------------------------
// 16. Update Loop
// ---------------------------------------------------------------------------

function update(dt: number) {
  frameCount++;

  // Slow motion
  if (slowMoTimer > 0) {
    slowMoTimer -= dt;
    slowMoFactor = 0.3;
  } else {
    slowMoFactor = 1;
  }

  const effectiveDt = dt * slowMoFactor;

  // Shake
  if (shakeTimer > 0) shakeTimer -= dt;
  // Combo text
  if (comboTextTimer > 0) comboTextTimer -= dt;
  // Multiplier decay
  if (multiplierTimer > 0) {
    multiplierTimer -= dt;
    if (multiplierTimer <= 0) {
      scoreMultiplier = Math.max(1, scoreMultiplier - 0.05);
    }
  }
  // Zone transition
  if (zoneTransitionTimer > 0) zoneTransitionTimer -= dt;

  // Achievement display
  for (const a of achievements) {
    if (a.showTimer > 0) a.showTimer -= dt;
  }

  if (phase === GamePhase.Playing && !paused) {
    // Move current block
    if (currentBlock) {
      currentBlock.x += currentBlock.dir * currentBlock.speed * effectiveDt * 60;

      // Bounce off edges
      if (currentBlock.x > W + currentBlock.w / 2 + 20) {
        currentBlock.dir = -1;
      } else if (currentBlock.x < -currentBlock.w / 2 - 20) {
        currentBlock.dir = 1;
      }
    }

    updateWeather(effectiveDt);
    updateWind(effectiveDt);
    updateBossEvent(effectiveDt);
    updateTowerPhysics(effectiveDt);

    // BGM arpeggiator
    audio.tickArp(effectiveDt, currentZone, combo);
  }

  if (phase === GamePhase.Tutorial) {
    tutorialTimer += dt;
  }

  // Camera lerp
  cameraY += (targetCameraY - cameraY) * 0.05 * dt * 60;

  // Update falling pieces
  for (let i = fallingPieces.length - 1; i >= 0; i--) {
    const p = fallingPieces[i];
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    p.vy += GRAVITY * dt * 60;
    p.rot += p.vr * dt * 60;
    p.alpha -= 0.5 * dt;
    const screenY = p.y - cameraY;
    if (screenY > H + 100 || p.alpha <= 0) {
      fallingPieces.splice(i, 1);
    }
  }

  // Update collapse blocks
  for (let i = collapseBlocks.length - 1; i >= 0; i--) {
    const b = collapseBlocks[i];
    b.x += b.vx * dt * 60;
    b.y += b.vy * dt * 60;
    b.vy += GRAVITY * dt * 60;
    b.rot += b.vr * dt * 60;
    const screenY = b.y - cameraY;
    if (screenY > H + 200) {
      collapseBlocks.splice(i, 1);
    }
  }

  updateParticles(dt);

  if (phase === GamePhase.GameOver) {
    gameOverTimer += dt;
  }
}

// ---------------------------------------------------------------------------
// 17. Drawing — Background & Parallax
// ---------------------------------------------------------------------------

function drawBackground() {
  const [topC, midC, botC] = getZoneBgColors(currentZone, frameCount);

  // Zone transition blend
  if (zoneTransitionTimer > 0) {
    const blend = Math.min(zoneTransitionTimer / 2.0, 1);
    const [fromTop, fromMid, fromBot] = getZoneBgColors(zoneTransitionFrom, frameCount);
    // Use from-colors fading out (approximate by alpha overlay)
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, topC);
    grad.addColorStop(0.5, midC);
    grad.addColorStop(1, botC);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.globalAlpha = blend * 0.5;
    const oGrad = ctx.createLinearGradient(0, 0, 0, H);
    oGrad.addColorStop(0, fromTop);
    oGrad.addColorStop(0.5, fromMid);
    oGrad.addColorStop(1, fromBot);
    ctx.fillStyle = oGrad;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, topC);
    grad.addColorStop(0.5, midC);
    grad.addColorStop(1, botC);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawInkWashMountains() {
  const camOff = cameraY;
  const layer0 = parallaxLayers[0];

  // Multiple mountain layers with ink-wash style
  for (let layerIdx = 0; layerIdx < 2; layerIdx++) {
    const alphaBase = layerIdx === 0 ? 0.15 : 0.25;
    const heightMult = layerIdx === 0 ? 0.7 : 1.0;
    const speedMult = layerIdx === 0 ? 0.5 : 1.0;

    ctx.fillStyle = `rgba(30, 30, 50, ${alphaBase})`;
    ctx.beginPath();
    ctx.moveTo(0, H);

    for (const el of layer0.elements) {
      const sx = el.x + layerIdx * 25;
      const sy = H - el.h * heightMult * 0.5 - camOff * layer0.speed * speedMult;

      // Ink-wash mountain profile — soft curves
      ctx.lineTo(sx, sy + el.h * heightMult);
      ctx.quadraticCurveTo(
        sx + el.w * 0.25, sy + el.h * heightMult * 0.3,
        sx + el.w * 0.5, sy
      );
      ctx.quadraticCurveTo(
        sx + el.w * 0.75, sy + el.h * heightMult * 0.3,
        sx + el.w, sy + el.h * heightMult
      );
    }

    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    // Ink-wash mist at mountain base
    if (layerIdx === 1) {
      const mistY = H - 50 - camOff * layer0.speed;
      const mistGrad = ctx.createLinearGradient(0, mistY - 30, 0, mistY + 30);
      mistGrad.addColorStop(0, 'rgba(200, 210, 230, 0)');
      mistGrad.addColorStop(0.5, 'rgba(200, 210, 230, 0.06)');
      mistGrad.addColorStop(1, 'rgba(200, 210, 230, 0)');
      ctx.fillStyle = mistGrad;
      ctx.fillRect(0, mistY - 30, W, 60);
    }
  }
}

function drawParallaxClouds() {
  const camOff = cameraY;

  for (let li = 1; li < parallaxLayers.length; li++) {
    const layer = parallaxLayers[li];
    for (const el of layer.elements) {
      const sx = el.x + Math.sin(frameCount * 0.003 + el.seed * 10) * (8 + li * 4);
      const sy = el.y - camOff * layer.speed;
      const wrappedY = ((sy % (H + 100)) + H + 100) % (H + 100) - 50;
      const baseAlpha = li === 1 ? 0.035 : 0.025;
      ctx.fillStyle = `rgba(200, 210, 230, ${baseAlpha + el.seed * 0.03})`;
      ctx.beginPath();
      ctx.ellipse(sx + el.w / 2, wrappedY, el.w / 2, el.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawConstellations() {
  if (currentZone < Zone.Starfield) return;

  const alpha = currentZone === Zone.Starfield ? 0.5 : 0.3;

  for (const con of constellations) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const offsetY = con.offsetY - cameraY * 0.03;

    // Draw connection lines
    ctx.strokeStyle = 'rgba(150, 170, 255, 0.2)';
    ctx.lineWidth = 0.5;
    for (const [a, b] of con.connections) {
      const sa = con.stars[a];
      const sb = con.stars[b];
      ctx.beginPath();
      ctx.moveTo(sa.x, sa.y + offsetY);
      ctx.lineTo(sb.x, sb.y + offsetY);
      ctx.stroke();
    }

    // Draw stars
    for (const star of con.stars) {
      const twinkle = 0.5 + Math.sin(frameCount * 0.05 + star.x * 0.1) * 0.5;
      ctx.fillStyle = `rgba(200, 210, 255, ${star.brightness * twinkle})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y + offsetY, star.size * twinkle, 0, Math.PI * 2);
      ctx.fill();

      // Glow
      if (star.brightness > 0.6) {
        ctx.shadowColor = 'rgba(180, 200, 255, 0.5)';
        ctx.shadowBlur = 4;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// 18. Drawing — Weather & Particles
// ---------------------------------------------------------------------------

function drawWeather() {
  for (const p of weatherParticles) {
    const sx = p.x;
    const sy = p.y - cameraY;

    ctx.save();
    ctx.globalAlpha = p.alpha;

    switch (p.type) {
      case 'leaf': {
        ctx.translate(sx, sy);
        ctx.rotate(p.rot);
        ctx.fillStyle = `rgb(${120 + Math.floor(Math.random() * 30)}, ${80 + Math.floor(Math.random() * 40)}, 30)`;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(80, 50, 10, 0.3)';
        ctx.lineWidth = 0.3;
        ctx.beginPath();
        ctx.moveTo(-p.size * 0.8, 0);
        ctx.lineTo(p.size * 0.8, 0);
        ctx.stroke();
        break;
      }
      case 'petal': {
        ctx.translate(sx, sy);
        ctx.rotate(p.rot);
        ctx.fillStyle = `rgba(255, ${180 + Math.floor(Math.random() * 50)}, ${180 + Math.floor(Math.random() * 40)}, ${p.alpha})`;
        ctx.beginPath();
        // Petal shape
        ctx.moveTo(0, -p.size * 0.5);
        ctx.quadraticCurveTo(p.size * 0.6, 0, 0, p.size * 0.5);
        ctx.quadraticCurveTo(-p.size * 0.6, 0, 0, -p.size * 0.5);
        ctx.fill();
        break;
      }
      case 'cloud': {
        ctx.fillStyle = `rgba(200, 210, 230, ${p.alpha})`;
        ctx.beginPath();
        ctx.ellipse(sx, sy, p.size, p.size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'firefly': {
        const pulse = 0.5 + Math.sin(p.twinkle) * 0.5;
        ctx.fillStyle = `rgba(180, 255, 150, ${p.alpha * pulse})`;
        ctx.shadowColor = 'rgba(150, 255, 100, 0.4)';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size * (0.7 + pulse * 0.3), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        break;
      }
      case 'snow': {
        ctx.fillStyle = `rgba(240, 245, 255, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'star': {
        const twinkle = 0.3 + Math.sin(p.twinkle) * 0.7;
        ctx.fillStyle = `rgba(220, 230, 255, ${p.alpha * twinkle})`;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size * (0.5 + twinkle * 0.5), 0, Math.PI * 2);
        ctx.fill();
        if (twinkle > 0.7) {
          // Cross-shaped twinkle
          ctx.strokeStyle = `rgba(220, 230, 255, ${p.alpha * twinkle * 0.3})`;
          ctx.lineWidth = 0.3;
          ctx.beginPath();
          ctx.moveTo(sx - p.size * 2, sy);
          ctx.lineTo(sx + p.size * 2, sy);
          ctx.moveTo(sx, sy - p.size * 2);
          ctx.lineTo(sx, sy + p.size * 2);
          ctx.stroke();
        }
        break;
      }
      case 'golden': {
        const pulse = 0.5 + Math.sin(p.twinkle) * 0.5;
        ctx.fillStyle = `rgba(255, 220, 100, ${p.alpha * pulse})`;
        ctx.shadowColor = 'rgba(255, 200, 50, 0.3)';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size * (0.8 + pulse * 0.4), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        break;
      }
    }

    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    const sx = p.x;
    const sy = p.y - cameraY;

    ctx.save();
    ctx.globalAlpha = p.alpha;

    if (p.type === 'spark' || p.type === 'ember') {
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
    }

    ctx.fillStyle = p.color;

    if (p.type === 'star') {
      // Four-pointed star shape
      const sz = p.size * p.alpha;
      ctx.beginPath();
      ctx.moveTo(sx, sy - sz);
      ctx.lineTo(sx + sz * 0.3, sy);
      ctx.lineTo(sx, sy + sz);
      ctx.lineTo(sx - sz * 0.3, sy);
      ctx.closePath();
      ctx.fill();
    } else if (p.type === 'ink') {
      // Ink blob
      ctx.beginPath();
      ctx.arc(sx, sy, p.size * p.alpha, 0, Math.PI * 2);
      ctx.fill();
      // Ink tendrils
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 0.5;
      for (let j = 0; j < 3; j++) {
        const angle = p.rot + j * Math.PI * 0.67;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(
          sx + Math.cos(angle) * p.size * 2 * p.alpha,
          sy + Math.sin(angle) * p.size * 2 * p.alpha
        );
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.arc(sx, sy, p.size * p.alpha, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Ripple rings
  for (const r of rippleRings) {
    const sy = r.y - cameraY;
    ctx.save();
    ctx.globalAlpha = r.alpha;
    ctx.strokeStyle = 'rgba(255, 220, 100, 1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r.x, sy, r.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Ink splashes
  for (const s of inkSplashes) {
    const sy = s.y - cameraY;
    ctx.save();
    ctx.globalAlpha = s.alpha;
    ctx.fillStyle = 'rgba(20, 20, 30, 0.6)';
    // Main splash
    ctx.beginPath();
    ctx.arc(s.x, sy, s.radius, 0, Math.PI * 2);
    ctx.fill();
    // Splash drops
    for (const d of s.drops) {
      ctx.beginPath();
      ctx.arc(s.x + d.dx * (s.radius / s.targetRadius), sy + d.dy * (s.radius / s.targetRadius), d.r * (s.radius / s.targetRadius), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Perfect beam
  if (perfectBeamTimer > 0) {
    const alpha = perfectBeamTimer;
    const beamGrad = ctx.createLinearGradient(perfectBeamX - 15, 0, perfectBeamX + 15, 0);
    beamGrad.addColorStop(0, `rgba(255, 220, 100, 0)`);
    beamGrad.addColorStop(0.3, `rgba(255, 220, 100, ${alpha * 0.25})`);
    beamGrad.addColorStop(0.5, `rgba(255, 255, 200, ${alpha * 0.4})`);
    beamGrad.addColorStop(0.7, `rgba(255, 220, 100, ${alpha * 0.25})`);
    beamGrad.addColorStop(1, `rgba(255, 220, 100, 0)`);
    ctx.fillStyle = beamGrad;
    ctx.fillRect(perfectBeamX - 35, 0, 70, H);
  }
}

// ---------------------------------------------------------------------------
// 19. Drawing — Tower & Blocks
// ---------------------------------------------------------------------------

function drawBlock(block: Block, screenY: number, leanOffset: number) {
  const sx = block.x - block.w / 2 + leanOffset;
  const sy = screenY;
  const wobble = block.settled ? 0 : Math.sin(block.wobblePhase) * block.wobbleOffset;

  const sprite = sprites.getBlock(block.w, BLOCK_H, block.zone, block.roofStyle);
  const pad = 6;
  ctx.drawImage(sprite, sx - pad + wobble, sy - pad);
}

function drawTower() {
  // Draw from bottom to top with lean effect
  const towerLen = tower.length;

  for (let i = 0; i < towerLen; i++) {
    const b = tower[i];
    const screenY = b.y - cameraY;

    // Cull off-screen blocks
    if (screenY > H + BLOCK_H || screenY < -BLOCK_H * 2) continue;

    // Progressive lean — higher blocks lean more
    const heightFraction = i / Math.max(towerLen - 1, 1);
    const leanOffset = towerLean * heightFraction * heightFraction;

    drawBlock(b, screenY, leanOffset);
  }
}

function drawCurrentBlock() {
  if (!currentBlock || phase !== GamePhase.Playing) return;

  const topBlock = tower[tower.length - 1];
  const y = topBlock.y - BLOCK_H;
  const screenY = y - cameraY;
  const zone = getZone(tower.length);

  // Draw shadow/guide line on tower top
  const shadowX = currentBlock.x;
  const shadowY = topBlock.y - cameraY;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.fillRect(shadowX - currentBlock.w / 2, shadowY - 2, currentBlock.w, 3);

  // Alignment guide — vertical dashed line
  ctx.save();
  ctx.setLineDash([2, 3]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(currentBlock.x, screenY);
  ctx.lineTo(currentBlock.x, screenY + 200);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Draw block
  const roofStyle = Math.floor(frameCount * 0.001) % 4;
  const sprite = sprites.getBlock(currentBlock.w, BLOCK_H, zone, roofStyle);
  const pad = 6;
  ctx.drawImage(sprite, currentBlock.x - currentBlock.w / 2 - pad, screenY - pad);
}

function drawFallingPieces() {
  for (const p of fallingPieces) {
    const sx = p.x;
    const sy = p.y - cameraY;
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.translate(sx, sy + p.h / 2);
    ctx.rotate(p.rot);
    const sprite = sprites.getBlock(p.w, p.h, p.zone);
    const pad = 6;
    ctx.drawImage(sprite, -p.w / 2 - pad, -p.h / 2 - pad);
    ctx.restore();
  }
}

function drawCollapseBlocks() {
  for (const b of collapseBlocks) {
    const sx = b.x;
    const sy = b.y - cameraY;
    ctx.save();
    ctx.translate(sx, sy + b.h / 2);
    ctx.rotate(b.rot);
    const sprite = sprites.getBlock(b.w, b.h, b.zone);
    const pad = 6;
    ctx.drawImage(sprite, -b.w / 2 - pad, -b.h / 2 - pad);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// 20. Drawing — Ambient & Effects
// ---------------------------------------------------------------------------

function drawAmbientLight() {
  ctx.fillStyle = getAmbientColor(currentZone);
  ctx.fillRect(0, 0, W, H);

  // Vignette
  const vigGrad = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.7);
  vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
  vigGrad.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = vigGrad;
  ctx.fillRect(0, 0, W, H);
}

function drawBestHeightLine() {
  if (bestHeight <= 0 || phase === GamePhase.Title) return;

  const bestY = (H - 60) - bestHeight * BLOCK_H;
  const screenY = bestY - cameraY;
  if (screenY < -20 || screenY > H + 20) return;

  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(255, 200, 50, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, screenY);
  ctx.lineTo(W - 20, screenY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = '10px "Noto Serif SC", serif';
  ctx.fillStyle = 'rgba(255, 200, 50, 0.5)';
  ctx.textAlign = 'right';
  ctx.fillText(`最高 ${bestHeight}`, W - 25, screenY - 4);
  ctx.restore();
}

function drawHeightMarkers() {
  ctx.save();
  ctx.font = '9px "Noto Serif SC", serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.textAlign = 'right';

  for (let h = 5; h <= 60; h += 5) {
    const y = (H - 60) - h * BLOCK_H;
    const screenY = y - cameraY;
    if (screenY < 0 || screenY > H) continue;

    ctx.fillText(`${h}`, W - 8, screenY + 3);
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 0.5;
    ctx.moveTo(W - 25, screenY);
    ctx.lineTo(W - 5, screenY);
    ctx.stroke();

    // Zone boundary markers
    if (h === 10 || h === 25 || h === 40) {
      ctx.strokeStyle = 'rgba(255, 200, 100, 0.15)';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(10, screenY);
      ctx.lineTo(W - 30, screenY);
      ctx.stroke();
      ctx.setLineDash([]);

      const zoneIdx = h === 10 ? 1 : h === 25 ? 2 : 3;
      ctx.fillStyle = 'rgba(255, 200, 100, 0.2)';
      ctx.textAlign = 'left';
      ctx.fillText(ZONE_NAMES[zoneIdx], 12, screenY - 3);
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    }
  }
  ctx.restore();
}

function drawWindIndicator() {
  if (wind.strength <= 0 || wind.timer >= wind.duration) return;

  const progress = wind.timer / wind.duration;
  const intensity = Math.sin(progress * Math.PI);
  const alpha = intensity * 0.4;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Wind streaks
  for (let i = 0; i < 8; i++) {
    const y = 100 + i * 90 + Math.sin(frameCount * 0.05 + i) * 20;
    const x = wind.direction > 0 ? -20 + frameCount * 2 % (W + 40) : W + 20 - frameCount * 2 % (W + 40);
    const len = 30 + intensity * 40;

    ctx.strokeStyle = 'rgba(200, 220, 255, 0.3)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + wind.direction * len, y + Math.sin(frameCount * 0.03 + i) * 5);
    ctx.stroke();
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// 21. Drawing — UI
// ---------------------------------------------------------------------------

function drawUI() {
  // Score
  ctx.save();
  ctx.font = '900 28px "Noto Serif SC", serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 4;
  ctx.fillText(`${score}`, 20, 50);
  ctx.shadowBlur = 0;

  // Score multiplier
  if (scoreMultiplier > 1.05) {
    ctx.font = '12px "Noto Serif SC", serif';
    ctx.fillStyle = `rgba(255, 220, 100, ${0.5 + Math.sin(frameCount * 0.08) * 0.3})`;
    ctx.fillText(`x${scoreMultiplier.toFixed(1)}`, 20 + ctx.measureText(`${score}`).width + 8, 50);
  }

  // Height & Zone
  ctx.font = '14px "Noto Serif SC", serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillText(`层数: ${towerHeight}`, 20, 72);

  ctx.fillStyle = 'rgba(255, 220, 150, 0.7)';
  ctx.fillText(`${ZONE_NAMES[currentZone]} (${ZONE_EN[currentZone]})`, 20, 90);

  ctx.restore();

  // Combo counter
  if (combo > 0 && phase === GamePhase.Playing) {
    const comboScale = 1 + Math.min(combo * 0.05, 0.4);
    const glowAlpha = Math.min(combo * 0.1, 0.8);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `900 ${Math.floor(20 * comboScale)}px "Noto Serif SC", serif`;
    ctx.shadowColor = `rgba(255, 200, 50, ${glowAlpha})`;
    ctx.shadowBlur = 10 + combo * 2;
    ctx.fillStyle = 'rgba(255, 220, 100, 0.9)';
    ctx.fillText(`${combo}x 连击`, W / 2, 130);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Combo text popup
  if (comboTextTimer > 0 && comboText) {
    const popScale = comboTextTimer > 0.6 ? 1.2 : 1.0;
    const popAlpha = Math.min(comboTextTimer * 2, 1);
    ctx.save();
    ctx.globalAlpha = popAlpha;
    ctx.textAlign = 'center';
    ctx.font = `900 ${Math.floor(32 * popScale)}px "Noto Serif SC", serif`;
    ctx.shadowColor = 'rgba(255, 150, 0, 0.8)';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#fff';
    ctx.fillText(comboText, W / 2, H * 0.35 - (1 - comboTextTimer) * 30);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Boss event warning
  if (bossEvent.active && bossEvent.warningTimer > 0) {
    const flash = Math.sin(frameCount * 0.3) > 0 ? 0.8 : 0.3;
    ctx.save();
    ctx.globalAlpha = flash;
    ctx.textAlign = 'center';
    ctx.font = '900 24px "Noto Serif SC", serif';
    ctx.fillStyle = '#ff4444';
    ctx.shadowColor = 'rgba(255, 0, 0, 0.6)';
    ctx.shadowBlur = 10;
    ctx.fillText(getBossEventName(), W / 2, H * 0.2);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Red border flash
    ctx.save();
    ctx.globalAlpha = flash * 0.15;
    ctx.strokeStyle = '#ff2222';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, W - 4, H - 4);
    ctx.restore();
  }

  // Boss event active indicator
  if (bossEvent.active && bossEvent.warningTimer <= 0) {
    const remaining = bossEvent.duration - bossEvent.timer;
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = 'rgba(255, 50, 50, 0.15)';
    ctx.fillRect(0, 0, W, 4);
    // Progress bar
    const progress = 1 - bossEvent.timer / bossEvent.duration;
    ctx.fillStyle = 'rgba(255, 50, 50, 0.6)';
    ctx.fillRect(0, 0, W * progress, 4);
    ctx.restore();
  }

  // Wind indicator
  drawWindIndicator();

  // Pause button
  drawButton(W - 45, 35, 28, paused ? '\u25B6' : '\u2759\u2759', 'pause');
  // Mute button
  drawButton(W - 80, 35, 28, audio.isMuted ? '\uD83D\uDD07' : '\uD83D\uDD0A', 'mute');

  // Achievement notifications
  drawAchievementNotifications();
}

function drawButton(x: number, y: number, size: number, icon: string, _id: string) {
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = `${size * 0.45}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.fillText(icon, x, y);
  ctx.restore();
}

function drawAchievementNotifications() {
  let yOffset = 110;
  for (const a of achievements) {
    if (a.showTimer > 0) {
      const fadeIn = Math.min((3 - a.showTimer) * 3, 1);
      const fadeOut = Math.min(a.showTimer * 2, 1);
      const alpha = Math.min(fadeIn, fadeOut);

      ctx.save();
      ctx.globalAlpha = alpha;

      // Banner background
      const bw = 260;
      const bh = 44;
      const bx = (W - bw) / 2;
      const by = yOffset;

      ctx.fillStyle = 'rgba(40, 30, 15, 0.85)';
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 8);
      ctx.fill();

      ctx.strokeStyle = 'rgba(200, 170, 80, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 8);
      ctx.stroke();

      // Achievement icon
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255, 220, 100, 0.9)';
      ctx.fillText('\u2B50', bx + 10, by + 28);

      // Name
      ctx.font = '900 14px "Noto Serif SC", serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(a.name, bx + 34, by + 20);

      // Description
      ctx.font = '10px "Noto Serif SC", serif';
      ctx.fillStyle = 'rgba(200, 200, 200, 0.7)';
      ctx.fillText(a.desc, bx + 34, by + 36);

      ctx.restore();
      yOffset += 52;
    }
  }
}

// ---------------------------------------------------------------------------
// 22. Drawing — Title Screen
// ---------------------------------------------------------------------------

function drawMeloCharacter(x: number, y: number, scale: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Body (ink-wash style)
  const bodyBob = Math.sin(frameCount * 0.04) * 3;

  // Robe
  ctx.fillStyle = '#2a4a6a';
  ctx.beginPath();
  ctx.moveTo(-12, 5 + bodyBob);
  ctx.lineTo(-15, 30 + bodyBob);
  ctx.quadraticCurveTo(-10, 35 + bodyBob, 0, 33 + bodyBob);
  ctx.quadraticCurveTo(10, 35 + bodyBob, 15, 30 + bodyBob);
  ctx.lineTo(12, 5 + bodyBob);
  ctx.closePath();
  ctx.fill();

  // Robe sash
  ctx.fillStyle = '#c4a040';
  ctx.fillRect(-3, 10 + bodyBob, 6, 3);

  // Head
  ctx.fillStyle = '#f5e6d0';
  ctx.beginPath();
  ctx.arc(0, -5 + bodyBob, 12, 0, Math.PI * 2);
  ctx.fill();

  // Hair bun (古代发髻)
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.arc(0, -15 + bodyBob, 7, 0, Math.PI * 2);
  ctx.fill();
  // Hair pin
  ctx.strokeStyle = '#c4a040';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-8, -16 + bodyBob);
  ctx.lineTo(8, -14 + bodyBob);
  ctx.stroke();

  // Eyes
  const blink = Math.sin(frameCount * 0.02) > 0.95 ? 0.1 : 1;
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.ellipse(-4, -5 + bodyBob, 1.5, 2 * blink, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(4, -5 + bodyBob, 1.5, 2 * blink, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mouth — slight smile
  ctx.strokeStyle = '#8a6040';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(0, -1 + bodyBob, 3, 0.1, Math.PI - 0.1);
  ctx.stroke();

  // Cheek blush
  ctx.fillStyle = 'rgba(255, 150, 130, 0.3)';
  ctx.beginPath();
  ctx.ellipse(-7, -2 + bodyBob, 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(7, -2 + bodyBob, 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawTitle() {
  ctx.save();

  // Animated background
  drawBackground();
  drawInkWashMountains();
  drawParallaxClouds();

  // Ink-wash decorative brush strokes
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const startX = 50 + i * 70;
    const startY = H * 0.15 + Math.sin(frameCount * 0.01 + i) * 10;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(
      startX + 30, startY + 40 + Math.sin(frameCount * 0.02 + i) * 10,
      startX + 10, startY + 80
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Title text
  const pulse = 0.85 + Math.sin(frameCount * 0.03) * 0.15;
  ctx.textAlign = 'center';

  // Main title — large calligraphy style
  ctx.font = '900 44px "Noto Serif SC", serif';
  ctx.shadowColor = 'rgba(255, 180, 50, 0.5)';
  ctx.shadowBlur = 20;
  ctx.fillStyle = `rgba(255, 240, 200, ${pulse})`;
  ctx.fillText('登天叠塔', W / 2, H * 0.25);
  ctx.shadowBlur = 0;

  // Subtitle
  ctx.font = '16px "Noto Serif SC", serif';
  ctx.fillStyle = 'rgba(200, 200, 220, 0.7)';
  ctx.fillText('Celestial Tower', W / 2, H * 0.25 + 40);

  // Melo subtitle
  ctx.font = '12px "Noto Serif SC", serif';
  ctx.fillStyle = 'rgba(180, 180, 200, 0.5)';
  ctx.fillText("Melo's Quest 6", W / 2, H * 0.25 + 65);

  // Draw Melo character
  drawMeloCharacter(W / 2, H * 0.42, 1.8);

  // Passport info
  if (passport) {
    ctx.font = '14px "Noto Serif SC", serif';
    ctx.fillStyle = 'rgba(200, 200, 220, 0.6)';
    ctx.fillText(`${passport.avatar} ${passport.name}`, W / 2, H * 0.55);
    ctx.font = '11px "Noto Serif SC", serif';
    ctx.fillStyle = 'rgba(180, 180, 200, 0.4)';
    ctx.fillText(`已游玩 ${passport.gamesPlayed} 次 | 总分 ${passport.totalScore}`, W / 2, H * 0.55 + 22);
  }

  // Best records
  if (bestHeight > 0 || bestScore > 0) {
    ctx.font = '13px "Noto Serif SC", serif';
    ctx.fillStyle = 'rgba(255, 220, 100, 0.55)';
    const records: string[] = [];
    if (bestHeight > 0) records.push(`最高 ${bestHeight} 层`);
    if (bestScore > 0) records.push(`最高分 ${bestScore}`);
    ctx.fillText(records.join(' | '), W / 2, H * 0.62);
  }

  // Achievements count
  const unlockedCount = achievements.filter(a => a.unlocked).length;
  if (unlockedCount > 0) {
    ctx.font = '11px "Noto Serif SC", serif';
    ctx.fillStyle = 'rgba(200, 180, 120, 0.4)';
    ctx.fillText(`成就: ${unlockedCount}/${achievements.length}`, W / 2, H * 0.66);
  }

  // Tap to start
  const tapPulse = 0.4 + Math.sin(frameCount * 0.05) * 0.3;
  ctx.font = '18px "Noto Serif SC", serif';
  ctx.fillStyle = `rgba(255, 255, 255, ${tapPulse + 0.3})`;
  ctx.fillText('点击开始', W / 2, H * 0.74);

  // Instructions
  ctx.font = '11px "Noto Serif SC", serif';
  ctx.fillStyle = 'rgba(180, 180, 200, 0.35)';
  ctx.fillText('点击放下方块 · 对齐叠塔 · 登临天界', W / 2, H * 0.78);

  // Decorative tower preview
  drawTitleTower();

  ctx.restore();
}

function drawTitleTower() {
  const baseX = W / 2;
  const baseY = H * 0.92;
  const blockW = 60;
  const blockH = 10;

  for (let i = 0; i < 8; i++) {
    const y = baseY - i * blockH;
    const w = blockW - i * 3;
    const zone: Zone = i < 2 ? Zone.Ground : i < 4 ? Zone.Cloud : i < 6 ? Zone.Starfield : Zone.Heaven;
    const sprite = sprites.getBlock(w, blockH, zone, i % 4);
    const sway = Math.sin(frameCount * 0.02 + i * 0.5) * i * 0.3;
    ctx.globalAlpha = 0.55 + i * 0.03;
    const pad = 6;
    ctx.drawImage(sprite, baseX - w / 2 - pad + sway, y - pad);
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// 23. Drawing — Tutorial
// ---------------------------------------------------------------------------

function drawTutorial() {
  // Draw game scene underneath
  drawBackground();
  drawInkWashMountains();
  drawParallaxClouds();

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';

  const steps = [
    { title: '叠塔登天', desc: '点击屏幕放下方块\n对齐下方方块进行堆叠', icon: '\u261D' },
    { title: '完美堆叠', desc: '精确对齐可触发完美效果\n连续完美可获得连击加成', icon: '\u2B50' },
    { title: '风与逆境', desc: '高处有风会影响方块移动\nBoss事件会增加挑战', icon: '\uD83C\uDF2C' },
    { title: '登临天界', desc: '穿越四大区域\n地基 → 云层 → 星河 → 仙宫', icon: '\uD83C\uDFEF' },
  ];

  const step = steps[Math.min(tutorialStep, steps.length - 1)];
  const fadeIn = Math.min(tutorialTimer * 3, 1);

  ctx.globalAlpha = fadeIn;

  // Icon
  ctx.font = '48px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(step.icon, W / 2, H * 0.3);

  // Title
  ctx.font = '900 28px "Noto Serif SC", serif';
  ctx.fillStyle = 'rgba(255, 240, 200, 0.9)';
  ctx.fillText(step.title, W / 2, H * 0.42);

  // Description
  ctx.font = '15px "Noto Serif SC", serif';
  ctx.fillStyle = 'rgba(200, 200, 220, 0.8)';
  const lines = step.desc.split('\n');
  lines.forEach((line, i) => {
    ctx.fillText(line, W / 2, H * 0.50 + i * 24);
  });

  // Progress dots
  const dotY = H * 0.65;
  for (let i = 0; i < steps.length; i++) {
    ctx.fillStyle = i === tutorialStep ? 'rgba(255, 220, 100, 0.8)' : 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(W / 2 - (steps.length - 1) * 10 + i * 20, dotY, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tap instruction
  const tapPulse = 0.4 + Math.sin(frameCount * 0.05) * 0.3;
  ctx.font = '14px "Noto Serif SC", serif';
  ctx.fillStyle = `rgba(255, 255, 255, ${tapPulse + 0.3})`;
  if (tutorialStep < steps.length - 1) {
    ctx.fillText('点击继续', W / 2, H * 0.75);
  } else {
    ctx.fillText('点击开始游戏', W / 2, H * 0.75);
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// 24. Drawing — Game Over
// ---------------------------------------------------------------------------

function drawGameOver() {
  ctx.save();

  // Darken
  const overlayAlpha = Math.min(gameOverTimer * 0.8, 0.7);
  ctx.fillStyle = `rgba(0, 0, 0, ${overlayAlpha})`;
  ctx.fillRect(0, 0, W, H);

  if (gameOverTimer > 0.5) {
    const fadeIn = Math.min((gameOverTimer - 0.5) * 2, 1);
    ctx.globalAlpha = fadeIn;
    ctx.textAlign = 'center';

    // Title
    ctx.font = '900 36px "Noto Serif SC", serif';
    ctx.fillStyle = 'rgba(255, 200, 150, 0.9)';
    ctx.fillText('塔倾', W / 2, H * 0.2);

    // Zone reached
    ctx.font = '18px "Noto Serif SC", serif';
    ctx.fillStyle = 'rgba(255, 220, 150, 0.7)';
    ctx.fillText(`抵达: ${ZONE_NAMES[currentZone]} (${ZONE_EN[currentZone]})`, W / 2, H * 0.27);

    // Score card — calligraphy style
    const cardY = H * 0.32;
    const cardH = 220;
    const cardX = W * 0.08;
    const cardW = W * 0.84;

    // Card background
    ctx.fillStyle = 'rgba(30, 25, 20, 0.85)';
    ctx.strokeStyle = 'rgba(200, 170, 80, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 8);
    ctx.fill();
    ctx.stroke();

    // Gold inner border
    ctx.strokeStyle = 'rgba(200, 170, 80, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(cardX + 6, cardY + 6, cardW - 12, cardH - 12, 4);
    ctx.stroke();

    // Score
    ctx.font = '900 42px "Noto Serif SC", serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${score}`, W / 2, cardY + 55);

    ctx.font = '12px "Noto Serif SC", serif';
    ctx.fillStyle = 'rgba(200, 180, 140, 0.7)';
    ctx.fillText('得分', W / 2, cardY + 75);

    // Stats grid
    const statsY = cardY + 105;
    const col1 = W * 0.25;
    const col2 = W * 0.5;
    const col3 = W * 0.75;

    ctx.font = '900 18px "Noto Serif SC", serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText(`${towerHeight}`, col1, statsY);
    ctx.fillText(`${maxCombo}x`, col2, statsY);
    ctx.fillText(`x${scoreMultiplier.toFixed(1)}`, col3, statsY);

    ctx.font = '10px "Noto Serif SC", serif';
    ctx.fillStyle = 'rgba(180, 170, 140, 0.6)';
    ctx.fillText('层数', col1, statsY + 18);
    ctx.fillText('最高连击', col2, statsY + 18);
    ctx.fillText('倍率', col3, statsY + 18);

    // Boss events survived
    if (bossEventsTriggered > 0) {
      ctx.font = '12px "Noto Serif SC", serif';
      ctx.fillStyle = 'rgba(255, 150, 100, 0.6)';
      ctx.fillText(`Boss事件: ${bossEventsTriggered}`, W / 2, statsY + 45);
    }

    // Best record
    if (towerHeight >= bestHeight && towerHeight > 0) {
      ctx.font = '900 14px "Noto Serif SC", serif';
      ctx.fillStyle = 'rgba(255, 220, 100, 0.9)';
      ctx.shadowColor = 'rgba(255, 200, 50, 0.5)';
      ctx.shadowBlur = 8;
      ctx.fillText('新纪录!', W / 2, cardY + cardH - 25);
      ctx.shadowBlur = 0;
    } else {
      ctx.font = '12px "Noto Serif SC", serif';
      ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
      ctx.fillText(`最高: ${bestHeight} 层 | 最高分: ${bestScore}`, W / 2, cardY + cardH - 25);
    }

    // Achievements earned this game
    const newAchievements = achievements.filter(a => a.justUnlocked);
    if (newAchievements.length > 0 && gameOverTimer > 1.0) {
      const achY = cardY + cardH + 20;
      ctx.font = '12px "Noto Serif SC", serif';
      ctx.fillStyle = 'rgba(255, 220, 100, 0.7)';
      ctx.fillText(`获得成就:`, W / 2, achY);
      newAchievements.forEach((a, i) => {
        ctx.fillStyle = 'rgba(255, 240, 200, 0.6)';
        ctx.fillText(`\u2B50 ${a.name}`, W / 2, achY + 18 + i * 16);
      });
    }

    // Retry button
    if (gameOverTimer > 1.5) {
      const retryAlpha = Math.min((gameOverTimer - 1.5) * 2, 1);
      ctx.globalAlpha = retryAlpha;

      const btnY = H * 0.78;
      ctx.fillStyle = 'rgba(200, 170, 80, 0.8)';
      ctx.beginPath();
      ctx.roundRect(W / 2 - 75, btnY - 24, 150, 48, 24);
      ctx.fill();

      ctx.font = '900 18px "Noto Serif SC", serif';
      ctx.fillStyle = '#1a1a0a';
      ctx.fillText('再来一次', W / 2, btnY + 7);

      // Back to title
      ctx.font = '13px "Noto Serif SC", serif';
      ctx.fillStyle = 'rgba(200, 200, 220, 0.5)';
      ctx.fillText('点击其他区域返回标题', W / 2, btnY + 45);
    }
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// 25. Drawing — Zone Transition
// ---------------------------------------------------------------------------

function drawZoneTransition() {
  if (zoneTransitionTimer <= 0) return;

  const progress = 1 - zoneTransitionTimer / 2.0;
  const alpha = Math.sin(progress * Math.PI) * 0.4;

  ctx.save();

  // Flash overlay in zone color
  let flashColor: string;
  switch (zoneTransitionTo) {
    case Zone.Cloud: flashColor = `rgba(100, 200, 150, ${alpha})`; break;
    case Zone.Starfield: flashColor = `rgba(100, 120, 255, ${alpha})`; break;
    case Zone.Heaven: flashColor = `rgba(255, 200, 80, ${alpha})`; break;
    default: flashColor = `rgba(150, 120, 80, ${alpha})`; break;
  }
  ctx.fillStyle = flashColor;
  ctx.fillRect(0, 0, W, H);

  // Zone name announcement
  if (progress < 0.6) {
    const textAlpha = Math.sin(progress / 0.6 * Math.PI);
    ctx.globalAlpha = textAlpha;
    ctx.textAlign = 'center';

    ctx.font = '900 36px "Noto Serif SC", serif';
    ctx.shadowColor = 'rgba(255, 220, 100, 0.6)';
    ctx.shadowBlur = 15;
    ctx.fillStyle = 'rgba(255, 240, 200, 0.9)';
    ctx.fillText(ZONE_NAMES[zoneTransitionTo], W / 2, H * 0.3);

    ctx.font = '14px "Noto Serif SC", serif';
    ctx.fillStyle = 'rgba(200, 200, 220, 0.7)';
    ctx.fillText(ZONE_EN[zoneTransitionTo], W / 2, H * 0.3 + 35);

    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// 26. Main Render
// ---------------------------------------------------------------------------

function render() {
  ctx.save();

  // Screen shake
  if (shakeTimer > 0) {
    const sx = (Math.random() - 0.5) * shakeIntensity * 2;
    const sy = (Math.random() - 0.5) * shakeIntensity * 2;
    ctx.translate(sx, sy);
    shakeIntensity *= 0.95;
  }

  if (phase === GamePhase.Title) {
    drawTitle();
  } else if (phase === GamePhase.Tutorial) {
    drawTutorial();
  } else {
    drawBackground();
    drawInkWashMountains();
    drawParallaxClouds();
    drawConstellations();
    drawWeather();
    drawBestHeightLine();
    drawHeightMarkers();
    drawTower();
    drawCurrentBlock();
    drawFallingPieces();
    drawCollapseBlocks();
    drawParticles();
    drawAmbientLight();
    drawUI();

    drawZoneTransition();

    if (phase === GamePhase.GameOver) {
      drawGameOver();
    }

    // Pause overlay
    if (paused && phase === GamePhase.Playing) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.font = '900 30px "Noto Serif SC", serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillText('暂停', W / 2, H / 2 - 10);
      ctx.font = '14px "Noto Serif SC", serif';
      ctx.fillStyle = 'rgba(200, 200, 220, 0.5)';
      ctx.fillText('点击继续', W / 2, H / 2 + 20);
    }
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// 27. Game Loop
// ---------------------------------------------------------------------------

function gameLoop(timestamp: number) {
  if (!lastTime) lastTime = timestamp;
  let dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  // Clamp dt
  if (dt > 0.05) dt = 0.05;
  if (dt <= 0) dt = 0.016;

  if (phase === GamePhase.Title) {
    frameCount++;
  }

  if (!paused || phase !== GamePhase.Playing) {
    update(dt);
  }

  render();
  requestAnimationFrame(gameLoop);
}

// ---------------------------------------------------------------------------
// 28. Input Handling
// ---------------------------------------------------------------------------

function getCanvasPos(e: Touch | MouseEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) / (rect.width / W),
    y: (e.clientY - rect.top) / (rect.height / H),
  };
}

function handleTap(pos: { x: number; y: number }) {
  // Check UI buttons first (on most screens)
  if (phase === GamePhase.Playing || phase === GamePhase.Title) {
    const pauseDist = Math.hypot(pos.x - (W - 45), pos.y - 35);
    if (pauseDist < 20 && phase === GamePhase.Playing) {
      paused = !paused;
      return;
    }

    const muteDist = Math.hypot(pos.x - (W - 80), pos.y - 35);
    if (muteDist < 20) {
      audio.init();
      audio.toggleMute();
      return;
    }
  }

  switch (phase) {
    case GamePhase.Title:
      audio.init();
      loadPassport();
      loadAchievements();
      bestHeight = loadBestHeight();
      bestScore = loadBestScore();

      if (!hasPlayedBefore) {
        phase = GamePhase.Tutorial;
        tutorialStep = 0;
        tutorialTimer = 0;
      } else {
        resetGame();
        audio.startBGM();
      }
      break;

    case GamePhase.Tutorial:
      tutorialTimer = 0;
      tutorialStep++;
      if (tutorialStep >= 4) {
        resetGame();
        audio.init();
        audio.startBGM();
        try { localStorage.setItem('pagoda_played', '1'); } catch {}
        hasPlayedBefore = true;
      }
      break;

    case GamePhase.Playing:
      if (!paused) {
        audio.init();
        dropBlock();
      }
      break;

    case GamePhase.GameOver:
      if (gameOverTimer > 1.5) {
        const btnY = H * 0.78;
        if (pos.x > W / 2 - 75 && pos.x < W / 2 + 75 &&
            pos.y > btnY - 24 && pos.y < btnY + 24) {
          // Reset achievement just-unlocked flags
          for (const a of achievements) a.justUnlocked = false;
          resetGame();
          audio.init();
          audio.startBGM();
        } else {
          // Tap elsewhere — back to title
          for (const a of achievements) a.justUnlocked = false;
          phase = GamePhase.Title;
        }
      }
      break;
  }
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  handleTap(getCanvasPos(e));
});

// Keyboard support
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    handleTap({ x: W / 2, y: H / 2 });
  }
  if (e.code === 'KeyP') {
    if (phase === GamePhase.Playing) paused = !paused;
  }
  if (e.code === 'KeyM') {
    audio.init();
    audio.toggleMute();
  }
});

// ---------------------------------------------------------------------------
// 29. Procedural Ink-Wash Art System
// ---------------------------------------------------------------------------

class InkWashRenderer {
  // Draw a procedural Chinese mountain silhouette
  static drawMountainRange(
    ctx: CanvasRenderingContext2D,
    baseY: number,
    numPeaks: number,
    maxHeight: number,
    color: string,
    alpha: number,
    seed: number
  ) {
    const rng = seededRandom(seed);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-10, baseY);

    let x = -10;
    for (let i = 0; i < numPeaks; i++) {
      const peakX = x + 30 + rng() * 60;
      const peakH = maxHeight * (0.4 + rng() * 0.6);
      const peakY = baseY - peakH;

      // Ascending slope
      const cp1x = x + (peakX - x) * 0.3;
      const cp1y = baseY - peakH * 0.2;
      ctx.quadraticCurveTo(cp1x, cp1y, peakX, peakY);

      // Descending slope
      const nextX = peakX + 20 + rng() * 40;
      const cp2x = peakX + (nextX - peakX) * 0.7;
      const cp2y = baseY - peakH * 0.15;
      ctx.quadraticCurveTo(cp2x, cp2y, nextX, baseY - rng() * 15);

      x = nextX;
    }

    ctx.lineTo(W + 10, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Draw ink-wash style tree
  static drawInkTree(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    height: number,
    alpha: number,
    seed: number
  ) {
    const rng = seededRandom(seed);
    ctx.save();
    ctx.globalAlpha = alpha;

    // Trunk
    ctx.strokeStyle = 'rgba(40, 30, 20, 0.8)';
    ctx.lineWidth = 2 + rng() * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const topY = y - height;
    const bendX = x + (rng() - 0.5) * 15;
    ctx.quadraticCurveTo(bendX, y - height * 0.5, x + (rng() - 0.5) * 8, topY);
    ctx.stroke();

    // Branches
    const numBranches = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < numBranches; i++) {
      const branchY = y - height * (0.3 + rng() * 0.5);
      const branchLen = 10 + rng() * 20;
      const dir = rng() < 0.5 ? -1 : 1;
      ctx.lineWidth = 0.8 + rng();
      ctx.beginPath();
      ctx.moveTo(x + (rng() - 0.5) * 3, branchY);
      ctx.quadraticCurveTo(
        x + dir * branchLen * 0.5, branchY - 5,
        x + dir * branchLen, branchY - 2 + rng() * 8
      );
      ctx.stroke();

      // Leaf clusters
      ctx.fillStyle = `rgba(${50 + rng() * 30}, ${60 + rng() * 40}, ${30 + rng() * 20}, 0.4)`;
      ctx.beginPath();
      ctx.arc(x + dir * branchLen, branchY, 5 + rng() * 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Canopy
    ctx.fillStyle = `rgba(${40 + rng() * 30}, ${50 + rng() * 40}, ${25 + rng() * 20}, 0.35)`;
    ctx.beginPath();
    ctx.arc(x + (rng() - 0.5) * 5, topY + 5, 8 + rng() * 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // Draw a traditional Chinese pagoda silhouette
  static drawPagodaSilhouette(
    ctx: CanvasRenderingContext2D,
    x: number, baseY: number,
    floors: number,
    width: number,
    alpha: number
  ) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(30, 25, 35, 0.8)';

    let currentY = baseY;
    let currentW = width;

    for (let f = 0; f < floors; f++) {
      const floorH = (width * 0.3) * (1 - f * 0.05);
      const roofOverhang = currentW * 0.15;

      // Floor body
      ctx.fillRect(x - currentW / 2, currentY - floorH, currentW, floorH);

      // Roof
      ctx.beginPath();
      ctx.moveTo(x - currentW / 2 - roofOverhang, currentY - floorH);
      // Curved eave left
      ctx.quadraticCurveTo(
        x - currentW / 2 - roofOverhang - 3, currentY - floorH - 5,
        x - currentW / 2 - roofOverhang + 2, currentY - floorH - 3
      );
      ctx.lineTo(x, currentY - floorH - floorH * 0.3);
      ctx.lineTo(x + currentW / 2 + roofOverhang - 2, currentY - floorH - 3);
      // Curved eave right
      ctx.quadraticCurveTo(
        x + currentW / 2 + roofOverhang + 3, currentY - floorH - 5,
        x + currentW / 2 + roofOverhang, currentY - floorH
      );
      ctx.closePath();
      ctx.fill();

      currentY -= floorH + floorH * 0.2;
      currentW *= 0.85;
    }

    // Spire
    ctx.beginPath();
    ctx.moveTo(x - 2, currentY);
    ctx.lineTo(x, currentY - width * 0.3);
    ctx.lineTo(x + 2, currentY);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // Draw flowing water / river
  static drawWater(
    ctx: CanvasRenderingContext2D,
    y: number,
    width: number,
    height: number,
    time: number,
    alpha: number
  ) {
    ctx.save();
    ctx.globalAlpha = alpha;

    // Water body
    const waterGrad = ctx.createLinearGradient(0, y, 0, y + height);
    waterGrad.addColorStop(0, 'rgba(60, 80, 120, 0.3)');
    waterGrad.addColorStop(0.5, 'rgba(40, 60, 100, 0.4)');
    waterGrad.addColorStop(1, 'rgba(30, 50, 80, 0.2)');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, y, width, height);

    // Ripple lines
    ctx.strokeStyle = 'rgba(150, 180, 220, 0.15)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 6; i++) {
      const ry = y + 5 + i * (height / 6);
      ctx.beginPath();
      for (let rx = 0; rx < width; rx += 3) {
        const wave = Math.sin(rx * 0.03 + time * 0.02 + i) * 2;
        if (rx === 0) ctx.moveTo(rx, ry + wave);
        else ctx.lineTo(rx, ry + wave);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  // Draw ink-wash style cloud (detailed)
  static drawInkCloud(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    width: number, height: number,
    alpha: number
  ) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(210, 215, 230, 0.6)';

    // Multiple overlapping ellipses
    const numBlobs = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numBlobs; i++) {
      const bx = x + (i - numBlobs / 2) * (width / numBlobs) * 0.8;
      const by = y + (Math.random() - 0.5) * height * 0.3;
      const bw = width * (0.3 + Math.random() * 0.2);
      const bh = height * (0.5 + Math.random() * 0.3);
      ctx.beginPath();
      ctx.ellipse(bx, by, bw, bh, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Soft edge fade
    const fadeGrad = ctx.createRadialGradient(x, y, 0, x, y, width * 0.6);
    fadeGrad.addColorStop(0, 'rgba(220, 225, 240, 0.3)');
    fadeGrad.addColorStop(1, 'rgba(220, 225, 240, 0)');
    ctx.fillStyle = fadeGrad;
    ctx.fillRect(x - width, y - height, width * 2, height * 2);

    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// 30. Procedural Background Scenery
// ---------------------------------------------------------------------------

// Pre-generated scenery elements
interface SceneryElement {
  type: 'tree' | 'pagoda' | 'rock' | 'lantern';
  x: number;
  baseY: number;
  seed: number;
  scale: number;
  parallaxSpeed: number;
}

const sceneryElements: SceneryElement[] = [];

function generateScenery() {
  sceneryElements.length = 0;

  // Trees scattered at ground level
  for (let i = 0; i < 12; i++) {
    sceneryElements.push({
      type: 'tree',
      x: Math.random() * W * 1.2 - W * 0.1,
      baseY: H - 30 + Math.random() * 20,
      seed: Math.floor(Math.random() * 10000),
      scale: 0.4 + Math.random() * 0.6,
      parallaxSpeed: 0.03 + Math.random() * 0.05,
    });
  }

  // A few pagoda silhouettes in the distance
  for (let i = 0; i < 3; i++) {
    sceneryElements.push({
      type: 'pagoda',
      x: 40 + Math.random() * (W - 80),
      baseY: H - 80 - Math.random() * 100,
      seed: Math.floor(Math.random() * 10000),
      scale: 0.3 + Math.random() * 0.4,
      parallaxSpeed: 0.01 + Math.random() * 0.02,
    });
  }

  // Decorative rocks
  for (let i = 0; i < 6; i++) {
    sceneryElements.push({
      type: 'rock',
      x: Math.random() * W,
      baseY: H - 20 + Math.random() * 15,
      seed: Math.floor(Math.random() * 10000),
      scale: 0.3 + Math.random() * 0.5,
      parallaxSpeed: 0.04 + Math.random() * 0.04,
    });
  }
}

generateScenery();

function drawScenery() {
  for (const el of sceneryElements) {
    const screenY = el.baseY - cameraY * el.parallaxSpeed;

    // Only draw if visible
    if (screenY < -100 || screenY > H + 50) continue;

    switch (el.type) {
      case 'tree':
        InkWashRenderer.drawInkTree(ctx, el.x, screenY, 30 * el.scale, 0.12, el.seed);
        break;
      case 'pagoda':
        InkWashRenderer.drawPagodaSilhouette(ctx, el.x, screenY, 3, 20 * el.scale, 0.08);
        break;
      case 'rock': {
        ctx.save();
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = 'rgba(60, 55, 45, 0.8)';
        const rng = seededRandom(el.seed);
        ctx.beginPath();
        const rw = 8 + rng() * 12;
        const rh = 5 + rng() * 8;
        ctx.ellipse(el.x, screenY, rw * el.scale, rh * el.scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 31. Enhanced Rendering Pipeline
// ---------------------------------------------------------------------------

// Scanline / CRT subtle effect for retro feel (very subtle)
function drawScanlines() {
  ctx.save();
  ctx.globalAlpha = 0.02;
  ctx.fillStyle = '#000';
  for (let y = 0; y < H; y += 3) {
    ctx.fillRect(0, y, W, 1);
  }
  ctx.restore();
}

// Chromatic aberration on collapse
function drawChromaticAberration() {
  if (phase !== GamePhase.Dying || shakeTimer <= 0) return;
  const intensity = Math.min(shakeIntensity * 0.3, 3);
  if (intensity < 0.5) return;

  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.globalCompositeOperation = 'screen';
  // Red channel shift
  ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
  ctx.fillRect(-intensity, 0, W, H);
  // Blue channel shift
  ctx.fillStyle = 'rgba(0, 0, 255, 0.1)';
  ctx.fillRect(intensity, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

// Floating score numbers
interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  timer: number;
  maxTimer: number;
  size: number;
}

const floatingTexts: FloatingText[] = [];

function spawnFloatingScore(x: number, y: number, value: number, isPerfect: boolean) {
  floatingTexts.push({
    x,
    y,
    text: `+${value}`,
    color: isPerfect ? 'rgba(255, 220, 100, 0.9)' : 'rgba(255, 255, 255, 0.7)',
    timer: 1.2,
    maxTimer: 1.2,
    size: isPerfect ? 18 : 14,
  });
}

function updateFloatingTexts(dt: number) {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.timer -= dt;
    ft.y -= 30 * dt;
    if (ft.timer <= 0) {
      floatingTexts.splice(i, 1);
    }
  }
}

function drawFloatingTexts() {
  for (const ft of floatingTexts) {
    const alpha = Math.min(ft.timer / ft.maxTimer * 2, 1);
    const screenY = ft.y - cameraY;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.font = `900 ${ft.size}px "Noto Serif SC", serif`;
    ctx.fillStyle = ft.color;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 3;
    ctx.fillText(ft.text, ft.x, screenY);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// 32. Enhanced Drop Logic with Floating Scores
// ---------------------------------------------------------------------------

// Override dropBlock to spawn floating scores
const originalScoreRef = { value: 0 };

function trackScoreChange(before: number, after: number, x: number, y: number, isPerfect: boolean) {
  const diff = after - before;
  if (diff > 0) {
    spawnFloatingScore(x, y, diff, isPerfect);
  }
}

// Wrap the existing dropBlock to add floating score
const _origDropBlock = dropBlock;

// ---------------------------------------------------------------------------
// 33. Procedural Ground Detail
// ---------------------------------------------------------------------------

function drawGroundDetail() {
  const groundY = H - 60 - cameraY;
  if (groundY > H + 10) return;
  if (groundY < -200) return;

  // Ground fill
  ctx.save();
  const gGrad = ctx.createLinearGradient(0, groundY, 0, groundY + 60);
  gGrad.addColorStop(0, 'rgba(50, 45, 35, 0.8)');
  gGrad.addColorStop(0.3, 'rgba(40, 38, 30, 0.9)');
  gGrad.addColorStop(1, 'rgba(30, 28, 22, 1)');
  ctx.fillStyle = gGrad;
  ctx.fillRect(0, groundY, W, H - groundY + 100);

  // Ground texture
  ctx.fillStyle = 'rgba(70, 65, 50, 0.3)';
  for (let i = 0; i < 30; i++) {
    const gx = Math.random() * W;
    const gy = groundY + 5 + Math.random() * 40;
    ctx.fillRect(gx, gy, 2 + Math.random() * 4, 1);
  }

  // Grass tufts
  ctx.strokeStyle = 'rgba(80, 100, 60, 0.3)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 20; i++) {
    const gx = i * (W / 20) + Math.sin(i * 3.7) * 8;
    const gy = groundY;
    for (let j = 0; j < 3; j++) {
      ctx.beginPath();
      ctx.moveTo(gx + j * 2, gy);
      const sway = Math.sin(frameCount * 0.02 + i + j) * 2;
      ctx.quadraticCurveTo(gx + j * 2 + sway, gy - 6, gx + j * 2 + sway * 1.5, gy - 8 - Math.random() * 4);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// 34. Statistics Tracking
// ---------------------------------------------------------------------------

interface GameStats {
  totalBlocks: number;
  perfectBlocks: number;
  totalGames: number;
  longestCombo: number;
  highestZone: Zone;
  totalPlayTime: number;
}

let sessionStats: GameStats = {
  totalBlocks: 0,
  perfectBlocks: 0,
  totalGames: 0,
  longestCombo: 0,
  highestZone: Zone.Ground,
  totalPlayTime: 0,
};

function loadStats(): GameStats {
  try {
    const raw = localStorage.getItem('pagoda_stats');
    if (raw) return JSON.parse(raw);
  } catch {}
  return { totalBlocks: 0, perfectBlocks: 0, totalGames: 0, longestCombo: 0, highestZone: Zone.Ground, totalPlayTime: 0 };
}

function saveStats() {
  try {
    localStorage.setItem('pagoda_stats', JSON.stringify(sessionStats));
  } catch {}
}

// ---------------------------------------------------------------------------
// 35. Enhanced Render Pipeline (with new systems)
// ---------------------------------------------------------------------------

// Patch the main render to include new drawing systems
const _origRender = render;

function enhancedRender() {
  ctx.save();

  // Screen shake
  if (shakeTimer > 0) {
    const sx = (Math.random() - 0.5) * shakeIntensity * 2;
    const sy = (Math.random() - 0.5) * shakeIntensity * 2;
    ctx.translate(sx, sy);
    shakeIntensity *= 0.95;
  }

  if (phase === GamePhase.Title) {
    enhancedDrawTitle();
  } else if (phase === GamePhase.Tutorial) {
    drawTutorial();
  } else {
    drawBackground();
    drawInkWashMountains();
    drawParallaxClouds();
    drawConstellations();
    drawScenery();
    drawGroundDetail();
    drawWeather();
    drawBestHeightLine();
    drawHeightMarkers();
    drawTower();
    drawCurrentBlock();
    drawFallingPieces();
    drawCollapseBlocks();
    drawParticles();
    drawFloatingTexts();
    drawAmbientLight();
    drawChromaticAberration();
    drawScanlines();
    drawUI();
    drawZoneTransition();

    if (phase === GamePhase.GameOver) {
      drawGameOver();
    }

    // Pause overlay
    if (paused && phase === GamePhase.Playing) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.font = '900 30px "Noto Serif SC", serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillText('暂停', W / 2, H / 2 - 10);
      ctx.font = '14px "Noto Serif SC", serif';
      ctx.fillStyle = 'rgba(200, 200, 220, 0.5)';
      ctx.fillText('点击继续', W / 2, H / 2 + 20);

      // Pause stats
      ctx.font = '11px "Noto Serif SC", serif';
      ctx.fillStyle = 'rgba(180, 180, 200, 0.4)';
      ctx.fillText(`层数 ${towerHeight} | 分数 ${score} | 连击 ${combo}x`, W / 2, H / 2 + 50);
    }
  }

  ctx.restore();
}

// Enhanced update
const _origUpdate = update;

function enhancedUpdate(dt: number) {
  _origUpdate(dt);
  updateFloatingTexts(dt);

  // Track play time
  if (phase === GamePhase.Playing && !paused) {
    sessionStats.totalPlayTime += dt;
  }
}

// Enhanced game loop
function enhancedGameLoop(timestamp: number) {
  if (!lastTime) lastTime = timestamp;
  let dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;
  if (dt > 0.05) dt = 0.05;
  if (dt <= 0) dt = 0.016;

  if (phase === GamePhase.Title) {
    frameCount++;
  }

  if (!paused || phase !== GamePhase.Playing) {
    enhancedUpdate(dt);
  }

  enhancedRender();
  requestAnimationFrame(enhancedGameLoop);
}

// ---------------------------------------------------------------------------
// 36. Calligraphy Text Renderer
// ---------------------------------------------------------------------------

class CalligraphyText {
  // Draw text with ink-wash brush stroke effect
  static drawBrushText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number, y: number,
    fontSize: number,
    color: string,
    alpha: number
  ) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.font = `900 ${fontSize}px "Noto Serif SC", serif`;

    // Shadow for depth
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Main text
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);

    // Highlight pass
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.globalAlpha = alpha * 0.3;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(text, x - 1, y - 1);

    ctx.restore();
  }

  // Draw vertical Chinese text (top to bottom)
  static drawVerticalText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number, startY: number,
    fontSize: number,
    color: string,
    alpha: number
  ) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.font = `${fontSize}px "Noto Serif SC", serif`;
    ctx.fillStyle = color;

    for (let i = 0; i < text.length; i++) {
      ctx.fillText(text[i], x, startY + i * (fontSize * 1.3));
    }

    ctx.restore();
  }

  // Decorative border frame
  static drawFrame(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    w: number, h: number,
    alpha: number
  ) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgba(200, 170, 80, 0.5)';
    ctx.lineWidth = 1.5;

    // Outer frame
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.stroke();

    // Inner frame
    ctx.strokeStyle = 'rgba(200, 170, 80, 0.25)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.roundRect(x + 5, y + 5, w - 10, h - 10, 2);
    ctx.stroke();

    // Corner ornaments (简化回纹)
    const cornerSize = 8;
    const corners: [number, number, number][] = [
      [x + 3, y + 3, 0],
      [x + w - 3, y + 3, Math.PI / 2],
      [x + w - 3, y + h - 3, Math.PI],
      [x + 3, y + h - 3, -Math.PI / 2],
    ];

    ctx.strokeStyle = 'rgba(200, 170, 80, 0.4)';
    ctx.lineWidth = 1;
    for (const [cx, cy, rot] of corners) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(cornerSize, 0);
      ctx.lineTo(cornerSize, cornerSize * 0.3);
      ctx.moveTo(0, 0);
      ctx.lineTo(0, cornerSize);
      ctx.lineTo(cornerSize * 0.3, cornerSize);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// 37. Seal Stamp (印章) Renderer
// ---------------------------------------------------------------------------

function drawSealStamp(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  size: number,
  text: string,
  alpha: number
) {
  ctx.save();
  ctx.globalAlpha = alpha;

  // Red seal background
  ctx.fillStyle = 'rgba(180, 30, 20, 0.85)';
  ctx.beginPath();
  ctx.roundRect(x - size / 2, y - size / 2, size, size, 3);
  ctx.fill();

  // Border
  ctx.strokeStyle = 'rgba(200, 40, 30, 0.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x - size / 2 + 2, y - size / 2 + 2, size - 4, size - 4, 2);
  ctx.stroke();

  // Seal text (white)
  ctx.fillStyle = 'rgba(240, 230, 210, 0.9)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${size * 0.45}px "Noto Serif SC", serif`;
  ctx.fillText(text, x, y + 1);

  // Weathering effect — random dots
  ctx.fillStyle = 'rgba(240, 230, 210, 0.15)';
  for (let i = 0; i < 8; i++) {
    const dx = (Math.random() - 0.5) * size * 0.8;
    const dy = (Math.random() - 0.5) * size * 0.8;
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, 0.5 + Math.random(), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// 38. Enhanced Title with All New Systems
// ---------------------------------------------------------------------------

// Override drawTitle to use CalligraphyText and seal
const _origDrawTitle = drawTitle;

function enhancedDrawTitle() {
  ctx.save();

  drawBackground();
  drawInkWashMountains();
  drawParallaxClouds();
  drawScenery();

  // Ink-wash decorative brush strokes
  ctx.globalAlpha = 0.04;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    const startX = 40 + i * 75;
    const startY = H * 0.12 + Math.sin(frameCount * 0.01 + i) * 8;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(
      startX + 25, startY + 35 + Math.sin(frameCount * 0.02 + i) * 8,
      startX + 8, startY + 70
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Main title with calligraphy
  const pulse = 0.85 + Math.sin(frameCount * 0.03) * 0.15;
  CalligraphyText.drawBrushText(ctx, '登天叠塔', W / 2, H * 0.25, 44, `rgba(255, 240, 200, ${pulse})`, 1);

  // Seal stamp
  drawSealStamp(ctx, W / 2 + 95, H * 0.23, 28, '麦', 0.6);

  // Subtitle
  ctx.textAlign = 'center';
  ctx.font = '16px "Noto Serif SC", serif';
  ctx.fillStyle = 'rgba(200, 200, 220, 0.7)';
  ctx.fillText('Celestial Tower', W / 2, H * 0.25 + 40);

  ctx.font = '12px "Noto Serif SC", serif';
  ctx.fillStyle = 'rgba(180, 180, 200, 0.5)';
  ctx.fillText("Melo's Quest 6", W / 2, H * 0.25 + 62);

  // Melo character
  drawMeloCharacter(W / 2, H * 0.41, 1.8);

  // Passport info
  if (passport) {
    ctx.font = '14px "Noto Serif SC", serif';
    ctx.fillStyle = 'rgba(200, 200, 220, 0.6)';
    ctx.fillText(`${passport.avatar} ${passport.name}`, W / 2, H * 0.54);
    ctx.font = '11px "Noto Serif SC", serif';
    ctx.fillStyle = 'rgba(180, 180, 200, 0.4)';
    ctx.fillText(`已游玩 ${passport.gamesPlayed} 次 | 总分 ${passport.totalScore}`, W / 2, H * 0.54 + 22);
  }

  // Records
  if (bestHeight > 0 || bestScore > 0) {
    ctx.font = '13px "Noto Serif SC", serif';
    ctx.fillStyle = 'rgba(255, 220, 100, 0.55)';
    const records: string[] = [];
    if (bestHeight > 0) records.push(`最高 ${bestHeight} 层`);
    if (bestScore > 0) records.push(`最高分 ${bestScore}`);
    ctx.fillText(records.join(' | '), W / 2, H * 0.62);
  }

  // Achievements count
  const unlockedCount = achievements.filter(a => a.unlocked).length;
  if (unlockedCount > 0) {
    ctx.font = '11px "Noto Serif SC", serif';
    ctx.fillStyle = 'rgba(200, 180, 120, 0.4)';
    ctx.fillText(`成就: ${unlockedCount}/${achievements.length}`, W / 2, H * 0.66);
  }

  // Tap to start
  const tapPulse = 0.4 + Math.sin(frameCount * 0.05) * 0.3;
  ctx.font = '18px "Noto Serif SC", serif';
  ctx.fillStyle = `rgba(255, 255, 255, ${tapPulse + 0.3})`;
  ctx.fillText('点击开始', W / 2, H * 0.74);

  ctx.font = '11px "Noto Serif SC", serif';
  ctx.fillStyle = 'rgba(180, 180, 200, 0.35)';
  ctx.fillText('点击放下方块 · 对齐叠塔 · 登临天界', W / 2, H * 0.78);

  // Decorative frame around title area
  CalligraphyText.drawFrame(ctx, W * 0.08, H * 0.17, W * 0.84, H * 0.08, 0.15);

  drawTitleTower();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// 39. Init (using enhanced systems)
// ---------------------------------------------------------------------------

sessionStats = loadStats();
loadPassport();
loadAchievements();
bestHeight = loadBestHeight();
bestScore = loadBestScore();

// Use enhanced game loop instead of original
requestAnimationFrame(enhancedGameLoop);
