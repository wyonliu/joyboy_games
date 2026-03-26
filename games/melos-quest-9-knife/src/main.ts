// ============================================================================
// 麦洛的冒险9：封印飞刃 (Melo's Quest 9: Seal Blade)
// Tap-Timing Knife Hit — Canvas 390×844
// ============================================================================

// ---------------------------------------------------------------------------
// 0. Constants & Types
// ---------------------------------------------------------------------------

const W = 390;
const H = 844;

const MAX_PARTICLES = 350;
const BLADE_SPEED = 800; // px/s
const TARGET_RADIUS = 80;
const TARGET_CENTER_X = W / 2;
const TARGET_CENTER_Y = 280;
const BLADE_LENGTH = 40;
const BLADE_WIDTH = 8;
const BLADE_EMBED_DEPTH = 18;
const MIN_BLADE_ARC_DIST = 0.18; // radians between embedded blades
const CRITICAL_SPOT_SIZE = 0.12; // radians
const NEAR_MISS_THRESHOLD = 0.28; // radians

const BLADE_LAUNCH_X = W / 2;
const BLADE_LAUNCH_Y = H - 160;

const NICKNAME_PRESETS = [
  '墨隐', '云渡', '霜吟', '岚归',
  '鹤影', '竹息', '泉鉴', '松铭',
];

const enum BladeType {
  FuDao = 0,    // 符刀 basic
  LeiBlade = 1, // 雷刃 chain lightning
  BingBlade = 2,// 冰刃 slows rotation
  HuoBlade = 3, // 火刃 explosion
  JinBlade = 4, // 金刃 passes through
}

const BLADE_NAMES = ['符刀', '雷刃', '冰刃', '火刃', '金刃'];
const BLADE_COLORS: string[] = [
  '#e8c547', // 符刀 gold
  '#6eb5ff', // 雷刃 blue
  '#a0f0ff', // 冰刃 cyan
  '#ff6a3a', // 火刃 orange-red
  '#ffe066', // 金刃 bright gold
];

const enum GameState {
  Title = 0,
  NicknameSelect = 1,
  ChapterSelect = 2,
  StageIntro = 3,
  Playing = 4,
  StageClear = 5,
  BossDefeated = 6,
  GameOver = 7,
  Paused = 8,
  Endless = 9,
  Tutorial = 10,
  ShareCard = 11,
  BladeShop = 12,
  AchievementPopup = 13,
}

// Achievement definitions
interface Achievement {
  id: string;
  name: string;
  description: string;
  sealChar: string;
  unlocked: boolean;
  unlockedAt: number;
}

const ACHIEVEMENT_DEFS: { id: string; name: string; description: string; sealChar: string }[] = [
  { id: 'novice', name: '封妖新手', description: '完成第一章所有关卡', sealChar: '封' },
  { id: 'combo30', name: '百刃不失', description: '达成30连击', sealChar: '刃' },
  { id: 'bagua', name: '八卦成阵', description: '形成八卦封印阵', sealChar: '阵' },
  { id: 'dragon', name: '屠龙勇士', description: '击败第四章龙宫之主', sealChar: '龙' },
  { id: 'chaos', name: '混沌封印', description: '通关全部五章', sealChar: '道' },
];

// Blade skin definitions
interface BladeSkin {
  id: string;
  name: string;
  color1: string;
  color2: string;
  trailColor: string;
  pattern: 'standard' | 'flame' | 'frost' | 'thunder' | 'void' | 'golden' | 'jade' | 'blood';
  unlocked: boolean;
  price: number;
}

const BLADE_SKINS: BladeSkin[] = [
  { id: 'standard', name: '符文刀', color1: '#e8c547', color2: '#c8a030', trailColor: '#e8c54780', pattern: 'standard', unlocked: true, price: 0 },
  { id: 'flame', name: '焰灵刃', color1: '#ff4500', color2: '#ff8c00', trailColor: '#ff450080', pattern: 'flame', unlocked: false, price: 500 },
  { id: 'frost', name: '寒冰锋', color1: '#00bfff', color2: '#87ceeb', trailColor: '#00bfff80', pattern: 'frost', unlocked: false, price: 500 },
  { id: 'thunder', name: '雷霆戟', color1: '#9370db', color2: '#dda0dd', trailColor: '#9370db80', pattern: 'thunder', unlocked: false, price: 800 },
  { id: 'void', name: '虚空裂', color1: '#2d1b69', color2: '#4a0080', trailColor: '#2d1b6980', pattern: 'void', unlocked: false, price: 1000 },
  { id: 'golden', name: '天帝剑', color1: '#ffd700', color2: '#ffec8b', trailColor: '#ffd70080', pattern: 'golden', unlocked: false, price: 1500 },
  { id: 'jade', name: '碧玉簪', color1: '#00c78c', color2: '#98fb98', trailColor: '#00c78c80', pattern: 'jade', unlocked: false, price: 800 },
  { id: 'blood', name: '血煞刀', color1: '#8b0000', color2: '#dc143c', trailColor: '#8b000080', pattern: 'blood', unlocked: false, price: 1200 },
];

// Confetti particle for celebration
interface ConfettiParticle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  color: string;
  rot: number; vr: number;
  life: number;
  shape: 'rect' | 'circle' | 'triangle';
}

// Near-miss slow motion state
interface SlowMotionState {
  active: boolean;
  timer: number;
  duration: number;
  factor: number;
}

// Tutorial step
interface TutorialStep {
  text: string;
  subText: string;
  icon: string;
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number; color: string;
  type: 'spark' | 'seal' | 'ink' | 'spirit' | 'glow' | 'ring' | 'snow' | 'fire' | 'lightning';
  rot: number; vr: number; alpha: number;
  text?: string;
}

interface EmbeddedBlade {
  angle: number;
  type: BladeType;
  embedTime: number;
}

interface FlyingBlade {
  x: number; y: number;
  vx: number; vy: number;
  type: BladeType;
  rot: number;
  active: boolean;
  trail: { x: number; y: number; alpha: number }[];
}

interface BounceBlade {
  x: number; y: number;
  vx: number; vy: number;
  rot: number; vr: number;
  type: BladeType;
  alpha: number;
}

interface FloatingText {
  x: number; y: number;
  text: string;
  color: string;
  size: number;
  life: number; maxLife: number;
  vy: number;
}

interface BossPattern {
  type: 'constant' | 'variable' | 'reverse' | 'burst' | 'stop_go' | 'multi_ring';
  baseSpeed: number;
  varianceAmp?: number;
  varianceFreq?: number;
  reverseInterval?: number;
  burstChance?: number;
  burstSpeed?: number;
  stopDuration?: number;
  goDuration?: number;
}

interface Boss {
  name: string;
  creature: string;
  hp: number;
  maxHp: number;
  bladesNeeded: number;
  patterns: BossPattern[];
  currentPattern: number;
  weakSpotAngle: number;
  weakSpotActive: boolean;
  weakSpotTimer: number;
  shieldAngles: number[];
  color1: string;
  color2: string;
  eyeColor: string;
  bodyType: 'round' | 'spiky' | 'serpent' | 'multi' | 'void';
  defeated: boolean;
}

interface Chapter {
  name: string;
  theme: string;
  bgColor1: string;
  bgColor2: string;
  accentColor: string;
  stages: StageConfig[];
}

interface StageConfig {
  bossIndex: number;
  bladesNeeded: number;
  difficulty: number;
}

interface PowerUp {
  x: number; y: number;
  vy: number;
  type: 'lei' | 'bing' | 'huo' | 'jin' | 'heal' | 'score';
  life: number;
  rot: number;
}

interface SealLine {
  a1: number; a2: number;
  alpha: number; life: number;
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

// ---------------------------------------------------------------------------
// 1. Canvas Setup
// ---------------------------------------------------------------------------

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const dpr = Math.min(window.devicePixelRatio || 1, 3);

function resizeCanvas(): void {
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
// 2. Audio System — Procedural Multi-Layer
// ---------------------------------------------------------------------------

class AudioSystem {
  private actx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private bgmStarted = false;

  // BGM layers
  private bassDrone: OscillatorNode | null = null;
  private bassDroneGain: GainNode | null = null;
  private percInterval: number | null = null;
  private erhuOsc: OscillatorNode | null = null;
  private erhuGain: GainNode | null = null;
  private erhuFilter: BiquadFilterNode | null = null;

  // Active nodes for cleanup
  private activeNodes: Set<AudioNode> = new Set();

  // Pentatonic scale (Chinese)
  private pentatonic = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99];
  // Minor pentatonic for ominous
  private minorPenta = [220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25];

  init(): void {
    if (this.actx) return;
    try {
      this.actx = new AudioContext();
      this.master = this.actx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.actx.destination);
    } catch { /* no audio */ }
  }

  get isMuted(): boolean { return this.muted; }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.master && this.actx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.6, this.actx.currentTime, 0.05);
    }
    try { localStorage.setItem('seal_blade_muted', this.muted ? '1' : '0'); } catch { /* ok */ }
  }

  loadMuteState(): void {
    try {
      this.muted = localStorage.getItem('seal_blade_muted') === '1';
    } catch { /* ok */ }
  }

  private scheduleCleanup(node: AudioNode, duration: number): void {
    this.activeNodes.add(node);
    setTimeout(() => {
      try {
        if ('stop' in node && typeof (node as OscillatorNode).stop === 'function') {
          try { (node as OscillatorNode).stop(); } catch { /* already stopped */ }
        }
        node.disconnect();
      } catch { /* ok */ }
      this.activeNodes.delete(node);
    }, duration * 1000 + 200);
  }

  private createOsc(freq: number, type: OscillatorType, dur: number, vol: number, _detune = 0): void {
    if (!this.actx || !this.master) return;
    const osc = this.actx.createOscillator();
    const gain = this.actx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = _detune;
    gain.gain.setValueAtTime(vol, this.actx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.actx.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(this.actx.currentTime + dur + 0.01);
    this.scheduleCleanup(osc, dur);
    this.scheduleCleanup(gain, dur);
  }

  private createNoise(dur: number, vol: number, highpass = 2000): void {
    if (!this.actx || !this.master) return;
    const bufSize = Math.max(1, Math.floor(this.actx.sampleRate * dur));
    const buffer = this.actx.createBuffer(1, bufSize, this.actx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const source = this.actx.createBufferSource();
    source.buffer = buffer;
    const gain = this.actx.createGain();
    gain.gain.setValueAtTime(vol, this.actx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.actx.currentTime + dur);
    const filter = this.actx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = highpass;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
    source.stop(this.actx.currentTime + dur + 0.01);
    this.scheduleCleanup(source, dur);
    this.scheduleCleanup(gain, dur);
    this.scheduleCleanup(filter, dur);
  }

  playThrow(): void {
    const pitchVar = 0.9 + Math.random() * 0.2;
    this.createNoise(0.15, 0.25, 3000 * pitchVar);
    this.createOsc(800 * pitchVar, 'sine', 0.08, 0.1);
  }

  playHit(): void {
    this.createOsc(150, 'sine', 0.15, 0.3);
    this.createOsc(1200, 'sine', 0.4, 0.08);
    this.createOsc(2400, 'sine', 0.25, 0.04);
    this.createNoise(0.05, 0.2, 1000);
  }

  playFail(): void {
    this.createNoise(0.2, 0.4, 800);
    this.createOsc(200, 'sawtooth', 0.3, 0.15);
    this.createOsc(150, 'square', 0.2, 0.1);
  }

  playCritical(): void {
    this.createOsc(130, 'sine', 1.0, 0.3);
    this.createOsc(260, 'sine', 0.8, 0.15);
    this.createOsc(520, 'sine', 0.6, 0.08);
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        this.createOsc(this.pentatonic[4 + (i % 4)] * 2, 'sine', 0.2, 0.06);
      }, i * 80);
    }
  }

  playNearMiss(): void {
    this.createOsc(600, 'sawtooth', 0.1, 0.12);
    this.createOsc(900, 'sine', 0.08, 0.08);
  }

  playCombo(level: number): void {
    const idx = Math.min(level, this.pentatonic.length - 1);
    this.createOsc(this.pentatonic[idx] * 2, 'sine', 0.2, 0.1);
    this.createOsc(this.pentatonic[idx] * 4, 'sine', 0.15, 0.05);
  }

  playBossDefeated(): void {
    const chords = [
      [261.63, 329.63, 392.00],
      [293.66, 369.99, 440.00],
      [329.63, 415.30, 523.25],
    ];
    chords.forEach((chord, ci) => {
      setTimeout(() => {
        chord.forEach(f => {
          this.createOsc(f, 'sine', 0.8, 0.12);
          this.createOsc(f * 2, 'sine', 0.5, 0.04);
        });
      }, ci * 300);
    });
  }

  playChapterTransition(): void {
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        this.createOsc(this.pentatonic[i], 'sine', 0.6 - i * 0.05, 0.08);
        this.createOsc(this.pentatonic[i] * 2, 'triangle', 0.4, 0.03);
      }, i * 60);
    }
  }

  playMenuTap(): void {
    this.createOsc(800, 'sine', 0.08, 0.1);
  }

  playPowerUp(): void {
    this.createOsc(523.25, 'sine', 0.15, 0.12);
    this.createOsc(659.25, 'sine', 0.15, 0.08);
    setTimeout(() => this.createOsc(783.99, 'sine', 0.2, 0.1), 100);
  }

  playSpecialCharge(): void {
    this.createOsc(200, 'sine', 0.5, 0.08);
    this.createOsc(400, 'triangle', 0.5, 0.04);
  }

  startBGM(): void {
    if (this.bgmStarted || !this.actx || !this.master) return;
    this.bgmStarted = true;

    // Bass drone
    this.bassDrone = this.actx.createOscillator();
    this.bassDroneGain = this.actx.createGain();
    this.bassDrone.type = 'sine';
    this.bassDrone.frequency.value = 55;
    this.bassDroneGain.gain.value = 0.08;
    this.bassDrone.connect(this.bassDroneGain);
    this.bassDroneGain.connect(this.master);
    this.bassDrone.start();

    // Erhu-like melody oscillator
    this.erhuOsc = this.actx.createOscillator();
    this.erhuGain = this.actx.createGain();
    this.erhuOsc.type = 'sawtooth';
    this.erhuOsc.frequency.value = this.minorPenta[0];
    this.erhuGain.gain.value = 0.02;
    this.erhuFilter = this.actx.createBiquadFilter();
    this.erhuFilter.type = 'bandpass';
    this.erhuFilter.frequency.value = 800;
    this.erhuFilter.Q.value = 3;
    this.erhuOsc.connect(this.erhuFilter);
    this.erhuFilter.connect(this.erhuGain);
    this.erhuGain.connect(this.master);
    this.erhuOsc.start();

    // Slowly modulate erhu melody
    let melodyIdx = 0;
    this.percInterval = window.setInterval(() => {
      if (!this.erhuOsc || !this.actx) return;
      melodyIdx = (melodyIdx + 1) % this.minorPenta.length;
      try {
        this.erhuOsc.frequency.setTargetAtTime(
          this.minorPenta[melodyIdx], this.actx.currentTime, 0.3
        );
      } catch { /* ok */ }
      // Percussion tick
      this.createNoise(0.03, 0.04, 5000);
    }, 1200);
  }

  stopBGM(): void {
    try {
      this.bassDrone?.stop();
      this.bassDrone?.disconnect();
      this.bassDroneGain?.disconnect();
      this.erhuOsc?.stop();
      this.erhuOsc?.disconnect();
      this.erhuGain?.disconnect();
      this.erhuFilter?.disconnect();
    } catch { /* ok */ }
    this.bassDrone = null;
    this.bassDroneGain = null;
    this.erhuOsc = null;
    this.erhuGain = null;
    this.erhuFilter = null;
    if (this.percInterval !== null) {
      clearInterval(this.percInterval);
      this.percInterval = null;
    }
    this.bgmStarted = false;
  }

  cleanupAll(): void {
    this.activeNodes.forEach(node => {
      try { node.disconnect(); } catch { /* ok */ }
    });
    this.activeNodes.clear();
  }
}

const audio = new AudioSystem();
audio.loadMuteState();

// ---------------------------------------------------------------------------
// 3. Procedural Drawing Helpers
// ---------------------------------------------------------------------------

function drawRoundRect(x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawSealChar(x: number, y: number, size: number, char: string, color: string, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `bold ${size}px "Noto Serif SC", serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 15;
  ctx.fillText(char, x, y);
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawChineseFrame(x: number, y: number, w: number, h: number, color: string, lineWidth = 2): void {
  const corner = 8;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  drawRoundRect(x, y, w, h, 4);
  ctx.stroke();
  // Corner decorations
  const cl = corner;
  ctx.lineWidth = lineWidth + 1;
  ctx.beginPath(); ctx.moveTo(x, y + cl); ctx.lineTo(x, y); ctx.lineTo(x + cl, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + w - cl, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cl); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y + h - cl); ctx.lineTo(x, y + h); ctx.lineTo(x + cl, y + h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + w - cl, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cl); ctx.stroke();
  ctx.restore();
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function clamp(v: number, mn: number, mx: number): number { return Math.max(mn, Math.min(mx, v)); }
function angleDist(a: number, b: number): number {
  let d = ((b - a) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  return Math.abs(d);
}

// Suppress unused warnings
void lerp;
void BLADE_NAMES;

// ---------------------------------------------------------------------------
// 4. Boss / Creature Data
// ---------------------------------------------------------------------------

const CREATURES: { name: string; creature: string; color1: string; color2: string; eyeColor: string; bodyType: Boss['bodyType'] }[] = [
  // Chapter 1: 妖域 (Demon Realm)  0-6
  { name: '赤狐妖', creature: '九尾狐', color1: '#ff6b35', color2: '#8b2500', eyeColor: '#ffdd00', bodyType: 'round' },
  { name: '石精灵', creature: '磐石', color1: '#7a7a6a', color2: '#4a4a3a', eyeColor: '#a0ff80', bodyType: 'round' },
  { name: '风妖蛾', creature: '蛾精', color1: '#b39ddb', color2: '#5c3d99', eyeColor: '#e0e0ff', bodyType: 'spiky' },
  { name: '毒蟾王', creature: '蟾蜍', color1: '#4caf50', color2: '#1b5e20', eyeColor: '#ff4444', bodyType: 'round' },
  { name: '影豹使', creature: '墨豹', color1: '#37474f', color2: '#1a1a2e', eyeColor: '#ce93d8', bodyType: 'round' },
  { name: '树妖长', creature: '古树', color1: '#5d4037', color2: '#3e2723', eyeColor: '#76ff03', bodyType: 'spiky' },
  { name: '妖域主·白泽', creature: '白泽', color1: '#e0e0e0', color2: '#9e9e9e', eyeColor: '#ffd700', bodyType: 'multi' },
  // Chapter 2: 鬼蜮 (Ghost Domain) 7-13
  { name: '幽魂兵', creature: '鬼兵', color1: '#4dd0e1', color2: '#00695c', eyeColor: '#b2ff59', bodyType: 'round' },
  { name: '骨将军', creature: '骷髅', color1: '#e0e0d1', color2: '#757560', eyeColor: '#ff5252', bodyType: 'spiky' },
  { name: '灯笼鬼', creature: '灯笼', color1: '#ff7043', color2: '#d84315', eyeColor: '#fff176', bodyType: 'round' },
  { name: '纸人偶', creature: '纸人', color1: '#fff9c4', color2: '#f9a825', eyeColor: '#212121', bodyType: 'round' },
  { name: '冥河使', creature: '冥河', color1: '#263238', color2: '#1a237e', eyeColor: '#80deea', bodyType: 'serpent' },
  { name: '黑无常', creature: '无常', color1: '#212121', color2: '#000000', eyeColor: '#f44336', bodyType: 'spiky' },
  { name: '鬼蜮主·阎罗', creature: '阎罗', color1: '#4a148c', color2: '#1a0033', eyeColor: '#ff6e40', bodyType: 'multi' },
  // Chapter 3: 仙山 (Immortal Mountain) 14-20
  { name: '仙鹤童', creature: '仙鹤', color1: '#ffffff', color2: '#e0e0e0', eyeColor: '#f44336', bodyType: 'round' },
  { name: '灵猿师', creature: '灵猿', color1: '#a1887f', color2: '#6d4c41', eyeColor: '#ffc107', bodyType: 'round' },
  { name: '玉兔精', creature: '玉兔', color1: '#f5f5f5', color2: '#e0e0e0', eyeColor: '#e91e63', bodyType: 'round' },
  { name: '松灵翁', creature: '松精', color1: '#2e7d32', color2: '#1b5e20', eyeColor: '#ffeb3b', bodyType: 'spiky' },
  { name: '云中燕', creature: '云燕', color1: '#90caf9', color2: '#42a5f5', eyeColor: '#ffffff', bodyType: 'round' },
  { name: '丹鼎仙', creature: '丹仙', color1: '#ef5350', color2: '#c62828', eyeColor: '#ffd54f', bodyType: 'round' },
  { name: '仙山主·西王母', creature: '王母', color1: '#ce93d8', color2: '#7b1fa2', eyeColor: '#ffd700', bodyType: 'multi' },
  // Chapter 4: 龙宫 (Dragon Palace) 21-27
  { name: '虾兵', creature: '虾兵', color1: '#ef9a9a', color2: '#c62828', eyeColor: '#212121', bodyType: 'round' },
  { name: '蟹将', creature: '蟹将', color1: '#a5d6a7', color2: '#2e7d32', eyeColor: '#ffeb3b', bodyType: 'spiky' },
  { name: '鱼精使', creature: '鲤鱼', color1: '#ffcc80', color2: '#ef6c00', eyeColor: '#1a237e', bodyType: 'round' },
  { name: '海龟仙', creature: '灵龟', color1: '#80cbc4', color2: '#00695c', eyeColor: '#ffa726', bodyType: 'round' },
  { name: '珊瑚妖', creature: '珊瑚', color1: '#f48fb1', color2: '#c2185b', eyeColor: '#e0e0ff', bodyType: 'spiky' },
  { name: '蛟龙子', creature: '蛟龙', color1: '#4fc3f7', color2: '#0277bd', eyeColor: '#ff5252', bodyType: 'serpent' },
  { name: '龙宫主·敖广', creature: '龙王', color1: '#1565c0', color2: '#0d47a1', eyeColor: '#ffd700', bodyType: 'multi' },
  // Chapter 5: 混沌 (Primordial Chaos) 28-34
  { name: '混沌兽', creature: '混沌', color1: '#616161', color2: '#212121', eyeColor: '#ff1744', bodyType: 'void' },
  { name: '烛龙影', creature: '烛龙', color1: '#d32f2f', color2: '#b71c1c', eyeColor: '#ffeb3b', bodyType: 'serpent' },
  { name: '帝江', creature: '帝江', color1: '#ff6f00', color2: '#e65100', eyeColor: '#ffffff', bodyType: 'round' },
  { name: '穷奇', creature: '穷奇', color1: '#546e7a', color2: '#37474f', eyeColor: '#b2ff59', bodyType: 'spiky' },
  { name: '梼杌', creature: '梼杌', color1: '#6d4c41', color2: '#3e2723', eyeColor: '#ff5252', bodyType: 'spiky' },
  { name: '饕餮', creature: '饕餮', color1: '#4e342e', color2: '#1b0000', eyeColor: '#ffd700', bodyType: 'void' },
  { name: '混沌主·鸿钧', creature: '鸿钧', color1: '#9e9e9e', color2: '#424242', eyeColor: '#e0e0ff', bodyType: 'multi' },
];

function createBoss(index: number, difficulty: number, bladesNeeded: number): Boss {
  const ci = clamp(index, 0, CREATURES.length - 1);
  const c = CREATURES[ci];

  const patterns: BossPattern[] = [];
  const baseSpd = 0.8 + difficulty * 0.25;

  if (difficulty <= 2) {
    patterns.push({ type: 'constant', baseSpeed: baseSpd });
  } else if (difficulty <= 4) {
    patterns.push({ type: 'constant', baseSpeed: baseSpd * 0.7 });
    patterns.push({ type: 'variable', baseSpeed: baseSpd, varianceAmp: 0.5, varianceFreq: 0.3 });
  } else if (difficulty <= 6) {
    patterns.push({ type: 'variable', baseSpeed: baseSpd * 0.8, varianceAmp: 0.6, varianceFreq: 0.4 });
    patterns.push({ type: 'reverse', baseSpeed: baseSpd, reverseInterval: 3.0 });
  } else if (difficulty <= 8) {
    patterns.push({ type: 'variable', baseSpeed: baseSpd, varianceAmp: 0.8, varianceFreq: 0.5 });
    patterns.push({ type: 'burst', baseSpeed: baseSpd * 0.6, burstChance: 0.02, burstSpeed: baseSpd * 3 });
    patterns.push({ type: 'stop_go', baseSpeed: baseSpd * 1.2, stopDuration: 0.8, goDuration: 2.0 });
  } else {
    patterns.push({ type: 'reverse', baseSpeed: baseSpd * 1.1, reverseInterval: 2.0 });
    patterns.push({ type: 'burst', baseSpeed: baseSpd * 0.8, burstChance: 0.03, burstSpeed: baseSpd * 4 });
    patterns.push({ type: 'stop_go', baseSpeed: baseSpd * 1.5, stopDuration: 0.5, goDuration: 1.5 });
    if (c.bodyType === 'multi') {
      patterns.push({ type: 'multi_ring', baseSpeed: baseSpd * 1.3 });
    }
  }

  const shields: number[] = [];
  if (difficulty >= 7) {
    const numShields = Math.min(difficulty - 5, 4);
    for (let i = 0; i < numShields; i++) {
      shields.push((Math.PI * 2 * i) / numShields + Math.random() * 0.3);
    }
  }

  return {
    name: c.name,
    creature: c.creature,
    hp: bladesNeeded * 2 + difficulty * 3,
    maxHp: bladesNeeded * 2 + difficulty * 3,
    bladesNeeded,
    patterns,
    currentPattern: 0,
    weakSpotAngle: Math.random() * Math.PI * 2,
    weakSpotActive: false,
    weakSpotTimer: 0,
    shieldAngles: shields,
    color1: c.color1,
    color2: c.color2,
    eyeColor: c.eyeColor,
    bodyType: c.bodyType,
    defeated: false,
  };
}

// ---------------------------------------------------------------------------
// 5. Chapter / Stage Data
// ---------------------------------------------------------------------------

const chapters: Chapter[] = [
  {
    name: '妖域', theme: 'Demon Realm',
    bgColor1: '#1a0a0a', bgColor2: '#2d0a0a',
    accentColor: '#ff6b35',
    stages: [
      { bossIndex: 0, bladesNeeded: 6, difficulty: 1 },
      { bossIndex: 1, bladesNeeded: 7, difficulty: 2 },
      { bossIndex: 2, bladesNeeded: 7, difficulty: 2 },
      { bossIndex: 3, bladesNeeded: 8, difficulty: 3 },
      { bossIndex: 4, bladesNeeded: 8, difficulty: 3 },
      { bossIndex: 5, bladesNeeded: 9, difficulty: 4 },
      { bossIndex: 6, bladesNeeded: 12, difficulty: 5 },
    ],
  },
  {
    name: '鬼蜮', theme: 'Ghost Domain',
    bgColor1: '#0a0a1a', bgColor2: '#0a1a2d',
    accentColor: '#4dd0e1',
    stages: [
      { bossIndex: 7, bladesNeeded: 8, difficulty: 3 },
      { bossIndex: 8, bladesNeeded: 8, difficulty: 4 },
      { bossIndex: 9, bladesNeeded: 9, difficulty: 4 },
      { bossIndex: 10, bladesNeeded: 9, difficulty: 5 },
      { bossIndex: 11, bladesNeeded: 10, difficulty: 5 },
      { bossIndex: 12, bladesNeeded: 10, difficulty: 6 },
      { bossIndex: 13, bladesNeeded: 14, difficulty: 7 },
    ],
  },
  {
    name: '仙山', theme: 'Immortal Mountain',
    bgColor1: '#0f1a0a', bgColor2: '#0a2d1a',
    accentColor: '#a5d6a7',
    stages: [
      { bossIndex: 14, bladesNeeded: 9, difficulty: 5 },
      { bossIndex: 15, bladesNeeded: 10, difficulty: 5 },
      { bossIndex: 16, bladesNeeded: 10, difficulty: 6 },
      { bossIndex: 17, bladesNeeded: 11, difficulty: 6 },
      { bossIndex: 18, bladesNeeded: 11, difficulty: 7 },
      { bossIndex: 19, bladesNeeded: 12, difficulty: 7 },
      { bossIndex: 20, bladesNeeded: 15, difficulty: 8 },
    ],
  },
  {
    name: '龙宫', theme: 'Dragon Palace',
    bgColor1: '#0a0a2d', bgColor2: '#0a1a3d',
    accentColor: '#4fc3f7',
    stages: [
      { bossIndex: 21, bladesNeeded: 10, difficulty: 6 },
      { bossIndex: 22, bladesNeeded: 11, difficulty: 7 },
      { bossIndex: 23, bladesNeeded: 11, difficulty: 7 },
      { bossIndex: 24, bladesNeeded: 12, difficulty: 8 },
      { bossIndex: 25, bladesNeeded: 12, difficulty: 8 },
      { bossIndex: 26, bladesNeeded: 13, difficulty: 9 },
      { bossIndex: 27, bladesNeeded: 16, difficulty: 9 },
    ],
  },
  {
    name: '混沌', theme: 'Primordial Chaos',
    bgColor1: '#0a0a0a', bgColor2: '#1a0a1a',
    accentColor: '#ce93d8',
    stages: [
      { bossIndex: 28, bladesNeeded: 12, difficulty: 7 },
      { bossIndex: 29, bladesNeeded: 12, difficulty: 8 },
      { bossIndex: 30, bladesNeeded: 13, difficulty: 8 },
      { bossIndex: 31, bladesNeeded: 14, difficulty: 9 },
      { bossIndex: 32, bladesNeeded: 14, difficulty: 9 },
      { bossIndex: 33, bladesNeeded: 15, difficulty: 10 },
      { bossIndex: 34, bladesNeeded: 18, difficulty: 10 },
    ],
  },
];

// ---------------------------------------------------------------------------
// 6. Game State
// ---------------------------------------------------------------------------

let state: GameState = GameState.Title;
let prevState: GameState = GameState.Title;

let passport: Passport | null = null;
let currentChapter = 0;
let currentStage = 0;
let currentBoss: Boss | null = null;

let score = 0;
let combo = 0;
let maxCombo = 0;
let bladesRemaining = 0;
let totalBladesThrown = 0;
let totalBladesHit = 0;

// Rotation state
let targetAngle = 0;
let targetAngularVelocity = 1.0;
let rotationDirection = 1;
let patternTimer = 0;
let stopGoState: 'go' | 'stop' = 'go';
let stopGoTimer = 0;
let burstTimer = 0;

// Blade state
let embeddedBlades: EmbeddedBlade[] = [];
let flyingBlades: FlyingBlade[] = [];
let bounceBlades: BounceBlade[] = [];
let currentBladeType: BladeType = BladeType.FuDao;
let specialBladeInventory: number[] = [0, 0, 0, 0, 0];
let isCharging = false;
let chargeTime = 0;
const chargeMaxTime = 0.8;

// Seal pattern
let sealLines: SealLine[] = [];

// Particles
let particles: Particle[] = [];
let floatingTexts: FloatingText[] = [];
let powerUps: PowerUp[] = [];

// Screen effects
let screenShakeTimer = 0;
let screenShakeIntensity = 0;
let flashColor = '';
let flashTimer = 0;

// Boss animation
let bossHurtTimer = 0;
let bossBreathPhase = 0;

// UI bounds
const pauseButtonBounds = { x: 10, y: 10, w: 44, h: 44 };
const muteButtonBounds = { x: W - 54, y: 10, w: 44, h: 44 };

// Title / menu
let titleTime = 0;
let selectedNickname = 0;

// Stage intro
let introTimer = 0;

// Stage clear
let clearTimer = 0;

// Game over
let gameOverTimer = 0;

// Endless mode
let endlessWave = 0;
let endlessActive = false;

// Touch state
let lastTapTime = 0;
let longPressTimer: number | null = null;

// Timing
let lastTime = 0;

// Background spirit particles
let bgSpirits: { x: number; y: number; vx: number; vy: number; size: number; alpha: number; phase: number }[] = [];

// Chapter progress (persisted)
let chapterProgress: boolean[][] = [];

// Near-miss tracking
let nearMissShown = false;

// Achievement system
let achievements: Achievement[] = [];
let achievementPopupQueue: Achievement[] = [];
let achievementPopupTimer = 0;
let currentAchievementPopup: Achievement | null = null;

// Slow motion system
let slowMotion: SlowMotionState = { active: false, timer: 0, duration: 0.15, factor: 0.25 };

// Boss defeat celebration
let confettiParticles: ConfettiParticle[] = [];
let bossDefeatCelebrationTimer = 0;
let goldenFlashTimer = 0;
let calligraphyAlpha = 0;
let calligraphyScale = 0;

// Tutorial system
let tutorialShown = false;
let tutorialStep = 0;
let tutorialAlpha = 0;
let tutorialTimer = 0;
const TUTORIAL_STEPS: TutorialStep[] = [
  { text: '点击屏幕', subText: '投掷飞刃封印妖兽', icon: '刃' },
  { text: '避开已有飞刃', subText: '碰到已插入的飞刃会失败', icon: '避' },
  { text: '瞄准金色弱点', subText: '暴击造成三倍伤害', icon: '击' },
  { text: '收集道具', subText: '使用特殊飞刃获得优势', icon: '宝' },
  { text: '形成封印阵', subText: '均匀分布飞刃获得额外奖励', icon: '阵' },
];

// Share card
let shareCardVisible = false;
let shareCardAlpha = 0;

// Blade shop
let shopScrollY = 0;
let selectedSkinIndex = 0;
let equippedSkinIndex = 0;
let playerCoins = 0;

// Enhanced blade trail
const SEAL_HIT_CHARS = ['封', '印', '镇', '锁', '灭'];

// Golden seal character display on hit
let hitSealChar = '';
let hitSealX = 0;
let hitSealY = 0;
let hitSealTimer = 0;
let hitSealSize = 30;
let hitSealGolden = false;

// Endless mode enhancement
let endlessSpeedMultiplier = 1.0;
let endlessPatternComboTimer = 0;
let endlessRandomPatternActive = false;

// Suppress unused warnings
void prevState;

// ---------------------------------------------------------------------------
// 7. Passport System
// ---------------------------------------------------------------------------

function loadPassport(): void {
  try {
    const raw = localStorage.getItem('melos_passport');
    if (raw) passport = JSON.parse(raw);
  } catch { /* ok */ }
}

function savePassport(): void {
  if (!passport) return;
  try {
    localStorage.setItem('melos_passport', JSON.stringify(passport));
  } catch { /* ok */ }
}

function loadProgress(): void {
  try {
    const raw = localStorage.getItem('seal_blade_progress');
    if (raw) chapterProgress = JSON.parse(raw);
  } catch { /* ok */ }
  if (!chapterProgress || chapterProgress.length !== 5) {
    chapterProgress = chapters.map(ch => ch.stages.map(() => false));
  }
}

function saveProgress(): void {
  try {
    localStorage.setItem('seal_blade_progress', JSON.stringify(chapterProgress));
  } catch { /* ok */ }
}

function savePauseState(paused: boolean): void {
  try {
    localStorage.setItem('seal_blade_paused', paused ? '1' : '0');
  } catch { /* ok */ }
}

// ---------------------------------------------------------------------------
// 7b. Achievement System
// ---------------------------------------------------------------------------

function loadAchievements(): void {
  try {
    const raw = localStorage.getItem('seal_blade_achievements');
    if (raw) {
      const saved: Achievement[] = JSON.parse(raw);
      achievements = ACHIEVEMENT_DEFS.map(def => {
        const existing = saved.find(a => a.id === def.id);
        return {
          id: def.id,
          name: def.name,
          description: def.description,
          sealChar: def.sealChar,
          unlocked: existing ? existing.unlocked : false,
          unlockedAt: existing ? existing.unlockedAt : 0,
        };
      });
      return;
    }
  } catch { /* ok */ }
  achievements = ACHIEVEMENT_DEFS.map(def => ({
    id: def.id,
    name: def.name,
    description: def.description,
    sealChar: def.sealChar,
    unlocked: false,
    unlockedAt: 0,
  }));
}

function saveAchievements(): void {
  try {
    localStorage.setItem('seal_blade_achievements', JSON.stringify(achievements));
  } catch { /* ok */ }
}

function unlockAchievement(id: string): void {
  const ach = achievements.find(a => a.id === id);
  if (!ach || ach.unlocked) return;
  ach.unlocked = true;
  ach.unlockedAt = Date.now();
  saveAchievements();
  achievementPopupQueue.push(ach);
}

function checkAchievements(): void {
  // 封妖新手: complete chapter 1
  if (chapterProgress[0] && chapterProgress[0].every(s => s)) {
    unlockAchievement('novice');
  }
  // 百刃不失: 30 hit combo
  if (maxCombo >= 30) {
    unlockAchievement('combo30');
  }
  // 八卦成阵: form a seal pattern (checked in checkSealPatternBonus)
  // 屠龙勇士: defeat chapter 4 boss (checked in onBossDefeated)
  // 混沌封印: complete all chapters
  if (chapterProgress.every(ch => ch.every(s => s))) {
    unlockAchievement('chaos');
  }
}

function updateAchievementPopup(dt: number): void {
  if (currentAchievementPopup) {
    achievementPopupTimer -= dt;
    if (achievementPopupTimer <= 0) {
      currentAchievementPopup = null;
    }
  }
  if (!currentAchievementPopup && achievementPopupQueue.length > 0) {
    currentAchievementPopup = achievementPopupQueue.shift()!;
    achievementPopupTimer = 3.0;
  }
}

function drawAchievementPopup(): void {
  if (!currentAchievementPopup) return;
  const ach = currentAchievementPopup;
  const progress = Math.min(achievementPopupTimer / 3.0, 1);
  const slideIn = progress > 0.85 ? (1 - progress) / 0.15 : (progress < 0.15 ? progress / 0.15 : 1);
  const popupAlpha = Math.min(slideIn * 1.5, 1);

  const popupW = 280;
  const popupH = 80;
  const popupX = (W - popupW) / 2;
  const popupY = 20 + (1 - slideIn) * -100;

  ctx.save();
  ctx.globalAlpha = popupAlpha;

  // Background
  ctx.fillStyle = 'rgba(40, 20, 10, 0.92)';
  drawRoundRect(popupX, popupY, popupW, popupH, 10);
  ctx.fill();

  // Border
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2;
  drawRoundRect(popupX, popupY, popupW, popupH, 10);
  ctx.stroke();

  // Red seal stamp
  const stampX = popupX + 40;
  const stampY = popupY + popupH / 2;
  ctx.save();
  ctx.translate(stampX, stampY);
  const stampRot = Math.sin(achievementPopupTimer * 2) * 0.05;
  ctx.rotate(stampRot);

  // Stamp border (red circle)
  ctx.strokeStyle = '#cc2222';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.stroke();

  // Inner square
  ctx.strokeStyle = '#cc2222';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-14, -14, 28, 28);

  // Seal character
  ctx.font = 'bold 22px "Noto Serif SC", serif';
  ctx.fillStyle = '#cc2222';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ach.sealChar, 0, 0);

  ctx.restore();

  // Achievement name
  ctx.font = 'bold 16px "Noto Serif SC", serif';
  ctx.fillStyle = '#ffd700';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(ach.name, popupX + 75, popupY + 28);

  // Achievement description
  ctx.font = '12px "Noto Serif SC", serif';
  ctx.fillStyle = '#c8a850';
  ctx.fillText(ach.description, popupX + 75, popupY + 52);

  // "Achievement unlocked" label
  ctx.font = '10px "Noto Serif SC", serif';
  ctx.fillStyle = 'rgba(200,180,140,0.6)';
  ctx.textAlign = 'right';
  ctx.fillText('成就解锁', popupX + popupW - 15, popupY + 15);

  ctx.restore();
}

function drawAchievementStamps(): void {
  // Draw achievement stamps on title screen
  const startX = W / 2 - (achievements.length * 50) / 2 + 25;
  const stampY = H * 0.82;

  ctx.save();
  ctx.font = '11px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < achievements.length; i++) {
    const ach = achievements[i];
    const sx = startX + i * 50;

    ctx.save();
    ctx.globalAlpha = ach.unlocked ? 0.9 : 0.2;

    // Red seal stamp circle
    ctx.strokeStyle = ach.unlocked ? '#cc2222' : '#555';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, stampY, 18, 0, Math.PI * 2);
    ctx.stroke();

    // Inner square
    ctx.strokeStyle = ach.unlocked ? '#cc2222' : '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - 11, stampY - 11, 22, 22);

    // Character
    ctx.font = 'bold 16px "Noto Serif SC", serif';
    ctx.fillStyle = ach.unlocked ? '#cc2222' : '#555';
    ctx.fillText(ach.sealChar, sx, stampY);

    // Name below
    ctx.font = '9px "Noto Serif SC", serif';
    ctx.fillStyle = ach.unlocked ? '#c8a850' : '#444';
    ctx.fillText(ach.name, sx, stampY + 28);

    ctx.restore();
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// 7c. Blade Shop System
// ---------------------------------------------------------------------------

function loadShopData(): void {
  try {
    const raw = localStorage.getItem('seal_blade_shop');
    if (raw) {
      const data = JSON.parse(raw);
      playerCoins = data.coins || 0;
      equippedSkinIndex = data.equipped || 0;
      if (data.unlocked && Array.isArray(data.unlocked)) {
        for (const id of data.unlocked) {
          const skin = BLADE_SKINS.find(s => s.id === id);
          if (skin) skin.unlocked = true;
        }
      }
    }
  } catch { /* ok */ }
}

function saveShopData(): void {
  try {
    const data = {
      coins: playerCoins,
      equipped: equippedSkinIndex,
      unlocked: BLADE_SKINS.filter(s => s.unlocked).map(s => s.id),
    };
    localStorage.setItem('seal_blade_shop', JSON.stringify(data));
  } catch { /* ok */ }
}

function purchaseSkin(index: number): boolean {
  const skin = BLADE_SKINS[index];
  if (!skin || skin.unlocked) return false;
  if (playerCoins < skin.price) return false;
  playerCoins -= skin.price;
  skin.unlocked = true;
  saveShopData();
  return true;
}

function equipSkin(index: number): void {
  if (BLADE_SKINS[index] && BLADE_SKINS[index].unlocked) {
    equippedSkinIndex = index;
    saveShopData();
  }
}

function getEquippedSkin(): BladeSkin {
  return BLADE_SKINS[equippedSkinIndex] || BLADE_SKINS[0];
}

function drawBladeShop(): void {
  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0a0a1a');
  grad.addColorStop(1, '#1a0a0a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  drawBgSpirits();

  // Title
  ctx.font = 'bold 24px "Noto Serif SC", serif';
  ctx.fillStyle = '#ffd700';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('兵器铺', W / 2, 50);

  // Coins display
  ctx.font = '14px "Noto Serif SC", serif';
  ctx.fillStyle = '#ffd700';
  ctx.textAlign = 'right';
  ctx.fillText(`金币: ${playerCoins}`, W - 30, 50);

  // Blade skins list
  const cardH = 70;
  const cardW = W - 60;
  const startY = 85;

  for (let i = 0; i < BLADE_SKINS.length; i++) {
    const skin = BLADE_SKINS[i];
    const cy = startY + i * (cardH + 10) - shopScrollY;

    if (cy < 60 || cy > H - 60) continue;

    const isEquipped = i === equippedSkinIndex;
    const isSelected = i === selectedSkinIndex;

    ctx.save();
    ctx.globalAlpha = skin.unlocked ? 1 : 0.5;

    // Card background
    ctx.fillStyle = isSelected ? 'rgba(60,40,10,0.7)' : 'rgba(30,20,10,0.5)';
    drawRoundRect(30, cy, cardW, cardH, 6);
    ctx.fill();

    // Border
    if (isEquipped) {
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
    } else if (isSelected) {
      ctx.strokeStyle = skin.color1 + '80';
      ctx.lineWidth = 1.5;
    } else {
      ctx.strokeStyle = 'rgba(100,80,50,0.3)';
      ctx.lineWidth = 1;
    }
    drawRoundRect(30, cy, cardW, cardH, 6);
    ctx.stroke();

    // Blade preview (small blade shape)
    ctx.save();
    ctx.translate(65, cy + cardH / 2);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = skin.color1;
    ctx.shadowColor = skin.color1;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(-4, 5);
    ctx.lineTo(0, 3);
    ctx.lineTo(4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = skin.color2;
    ctx.fillRect(-2, 5, 4, 6);
    ctx.restore();

    // Name
    ctx.font = 'bold 15px "Noto Serif SC", serif';
    ctx.fillStyle = skin.unlocked ? skin.color1 : '#888';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(skin.name, 95, cy + 25);

    // Status
    ctx.font = '12px "Noto Serif SC", serif';
    if (isEquipped) {
      ctx.fillStyle = '#ffd700';
      ctx.fillText('已装备', 95, cy + 48);
    } else if (skin.unlocked) {
      ctx.fillStyle = '#a0a080';
      ctx.fillText('已拥有', 95, cy + 48);
    } else {
      ctx.fillStyle = '#ff9800';
      ctx.fillText(`${skin.price} 金币`, 95, cy + 48);
    }

    // Action button
    if (!isEquipped && skin.unlocked) {
      drawShopButton(cardW - 30, cy + cardH / 2, '装备', '#4caf50');
    } else if (!skin.unlocked) {
      const canBuy = playerCoins >= skin.price;
      drawShopButton(cardW - 30, cy + cardH / 2, '购买', canBuy ? '#ff9800' : '#555');
    }

    ctx.restore();
  }

  // Back button
  ctx.save();
  ctx.font = '16px "Noto Serif SC", serif';
  ctx.fillStyle = '#c8a850';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('< 返回', 20, H - 40);
  ctx.restore();
}

function drawShopButton(x: number, y: number, text: string, color: string): void {
  ctx.save();
  ctx.fillStyle = color + '30';
  drawRoundRect(x - 28, y - 12, 56, 24, 4);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  drawRoundRect(x - 28, y - 12, 56, 24, 4);
  ctx.stroke();
  ctx.font = '12px "Noto Serif SC", serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 7d. Tutorial System
// ---------------------------------------------------------------------------

function loadTutorialState(): void {
  try {
    tutorialShown = localStorage.getItem('seal_blade_tutorial_done') === '1';
  } catch { /* ok */ }
}

function saveTutorialState(): void {
  try {
    localStorage.setItem('seal_blade_tutorial_done', '1');
  } catch { /* ok */ }
}

function drawTutorialOverlay(): void {
  // Dim background
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, W, H);

  const step = TUTORIAL_STEPS[tutorialStep];
  const progress = Math.min(tutorialTimer / 0.5, 1);
  const fadeAlpha = progress;

  ctx.save();
  ctx.globalAlpha = fadeAlpha;

  // Central icon
  const iconY = H * 0.3;
  ctx.save();
  ctx.translate(W / 2, iconY);
  const pulse = 1 + Math.sin(tutorialTimer * 3) * 0.05;
  ctx.scale(pulse, pulse);

  // Icon circle
  ctx.fillStyle = 'rgba(255,215,0,0.15)';
  ctx.beginPath();
  ctx.arc(0, 0, 50, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Icon character
  ctx.font = 'bold 36px "Noto Serif SC", serif';
  ctx.fillStyle = '#ffd700';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(step.icon, 0, 0);
  ctx.restore();

  // Main text
  ctx.font = 'bold 24px "Noto Serif SC", serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(step.text, W / 2, H * 0.45);

  // Sub text
  ctx.font = '15px "Noto Serif SC", serif';
  ctx.fillStyle = '#c8a850';
  ctx.fillText(step.subText, W / 2, H * 0.52);

  // Step indicators
  const dotStartX = W / 2 - (TUTORIAL_STEPS.length * 20) / 2;
  for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
    ctx.beginPath();
    ctx.arc(dotStartX + i * 20 + 10, H * 0.6, 4, 0, Math.PI * 2);
    ctx.fillStyle = i === tutorialStep ? '#ffd700' : 'rgba(200,180,140,0.3)';
    ctx.fill();
  }

  // Tap to continue
  const tapAlpha = 0.4 + Math.sin(tutorialTimer * 2.5) * 0.3;
  ctx.globalAlpha = tapAlpha;
  ctx.font = '14px "Noto Serif SC", serif';
  ctx.fillStyle = '#c8a850';
  ctx.fillText('点击继续', W / 2, H * 0.7);

  // Skip button
  ctx.globalAlpha = 0.5;
  ctx.font = '12px "Noto Serif SC", serif';
  ctx.fillStyle = '#888';
  ctx.textAlign = 'right';
  ctx.fillText('跳过教程 >', W - 30, H - 40);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// 7e. Share Card System
// ---------------------------------------------------------------------------

function drawShareCard(): void {
  // Full-screen share card
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, W, H);

  const cardW = W - 60;
  const cardH = 500;
  const cardX = 30;
  const cardY = (H - cardH) / 2;

  ctx.save();
  ctx.globalAlpha = Math.min(shareCardAlpha * 2, 1);

  // Card background
  const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  cardGrad.addColorStop(0, '#1a0e05');
  cardGrad.addColorStop(0.5, '#2a1a0a');
  cardGrad.addColorStop(1, '#1a0e05');
  drawRoundRect(cardX, cardY, cardW, cardH, 12);
  ctx.fillStyle = cardGrad;
  ctx.fill();

  // Golden border
  drawChineseFrame(cardX, cardY, cardW, cardH, '#ffd700', 2);

  // Inner decorative border
  drawChineseFrame(cardX + 8, cardY + 8, cardW - 16, cardH - 16, '#c8a85050', 1);

  // Title
  ctx.font = 'bold 28px "Noto Serif SC", serif';
  ctx.fillStyle = '#ffd700';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 10;
  ctx.fillText('封印飞刃', W / 2, cardY + 50);
  ctx.shadowBlur = 0;

  ctx.font = '12px "Noto Serif SC", serif';
  ctx.fillStyle = 'rgba(200,180,140,0.5)';
  ctx.fillText("Melo's Quest 9: Seal Blade", W / 2, cardY + 78);

  // Divider
  ctx.strokeStyle = '#c8a85050';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + 30, cardY + 100);
  ctx.lineTo(cardX + cardW - 30, cardY + 100);
  ctx.stroke();

  // Player name
  if (passport) {
    ctx.font = 'bold 18px "Noto Serif SC", serif';
    ctx.fillStyle = '#e0d0a0';
    ctx.fillText(`道友: ${passport.name}`, W / 2, cardY + 130);
  }

  // Stats section
  const statsY = cardY + 165;
  const statItems = [
    { label: '最终得分', value: `${score}`, color: '#ffd700' },
    { label: '最大连击', value: `${maxCombo}x`, color: '#ff9800' },
    { label: '命中率', value: `${totalBladesThrown > 0 ? Math.floor(totalBladesHit / totalBladesThrown * 100) : 0}%`, color: '#4caf50' },
  ];

  for (let i = 0; i < statItems.length; i++) {
    const si = statItems[i];
    const sy = statsY + i * 55;

    ctx.font = '13px "Noto Serif SC", serif';
    ctx.fillStyle = '#a09070';
    ctx.textAlign = 'center';
    ctx.fillText(si.label, W / 2, sy);

    ctx.font = 'bold 26px "Noto Serif SC", serif';
    ctx.fillStyle = si.color;
    ctx.fillText(si.value, W / 2, sy + 28);
  }

  // Level info
  const levelY = statsY + statItems.length * 55 + 20;
  if (!endlessActive) {
    ctx.font = '14px "Noto Serif SC", serif';
    ctx.fillStyle = '#c8a850';
    ctx.fillText(`第${currentChapter + 1}章 · ${chapters[currentChapter].name} · 第${currentStage + 1}关`, W / 2, levelY);
  } else {
    ctx.font = '14px "Noto Serif SC", serif';
    ctx.fillStyle = '#c8a850';
    ctx.fillText(`无尽模式 · 第${endlessWave}波`, W / 2, levelY);
  }

  // Achievement stamps (earned ones)
  const stampStartY = levelY + 40;
  ctx.font = '12px "Noto Serif SC", serif';
  ctx.fillStyle = '#a09070';
  ctx.fillText('成就印章', W / 2, stampStartY);

  const earnedAch = achievements.filter(a => a.unlocked);
  const stampRowY = stampStartY + 30;
  const stampSpacing = 40;
  const stampRowX = W / 2 - (earnedAch.length * stampSpacing) / 2 + stampSpacing / 2;

  for (let i = 0; i < earnedAch.length; i++) {
    const sx = stampRowX + i * stampSpacing;
    ctx.save();
    ctx.strokeStyle = '#cc2222';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sx, stampRowY, 14, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = 'bold 14px "Noto Serif SC", serif';
    ctx.fillStyle = '#cc2222';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(earnedAch[i].sealChar, sx, stampRowY);
    ctx.restore();
  }

  if (earnedAch.length === 0) {
    ctx.font = '12px "Noto Serif SC", serif';
    ctx.fillStyle = '#555';
    ctx.fillText('尚未获得成就', W / 2, stampRowY);
  }

  // Watermark
  ctx.font = '10px "Noto Serif SC", serif';
  ctx.fillStyle = 'rgba(150,150,150,0.3)';
  ctx.fillText('JoyBoy Games | 麦洛的冒险系列', W / 2, cardY + cardH - 25);

  // Close hint
  ctx.font = '13px "Noto Serif SC", serif';
  ctx.fillStyle = 'rgba(200,180,140,0.5)';
  ctx.fillText('点击关闭', W / 2, cardY + cardH + 30);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// 7f. Confetti System (Boss Defeat Celebration)
// ---------------------------------------------------------------------------

function spawnConfetti(count: number): void {
  const colors = ['#ffd700', '#ff6b35', '#4dd0e1', '#a5d6a7', '#ce93d8', '#ff4444', '#ffeb3b', '#e0e0ff'];
  const shapes: ConfettiParticle['shape'][] = ['rect', 'circle', 'triangle'];
  for (let i = 0; i < count; i++) {
    confettiParticles.push({
      x: W * (0.2 + Math.random() * 0.6),
      y: -20 - Math.random() * 100,
      vx: (Math.random() - 0.5) * 200,
      vy: 100 + Math.random() * 200,
      size: 4 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 8,
      life: 3 + Math.random() * 2,
      shape: shapes[Math.floor(Math.random() * shapes.length)],
    });
  }
}

function updateConfetti(dt: number): void {
  for (let i = confettiParticles.length - 1; i >= 0; i--) {
    const c = confettiParticles[i];
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.vy += 80 * dt; // gravity
    c.vx *= 0.99;
    c.rot += c.vr * dt;
    c.life -= dt;
    if (c.life <= 0 || c.y > H + 30) {
      confettiParticles.splice(i, 1);
    }
  }
}

function drawConfetti(): void {
  for (const c of confettiParticles) {
    const alpha = Math.min(c.life, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    ctx.fillStyle = c.color;

    switch (c.shape) {
      case 'rect':
        ctx.fillRect(-c.size / 2, -c.size / 4, c.size, c.size / 2);
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(0, 0, c.size / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(0, -c.size / 2);
        ctx.lineTo(-c.size / 2, c.size / 2);
        ctx.lineTo(c.size / 2, c.size / 2);
        ctx.closePath();
        ctx.fill();
        break;
    }

    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// 7g. Slow Motion System
// ---------------------------------------------------------------------------

function triggerSlowMotion(): void {
  slowMotion.active = true;
  slowMotion.timer = slowMotion.duration;
}

function updateSlowMotion(dt: number): number {
  if (slowMotion.active) {
    slowMotion.timer -= dt;
    if (slowMotion.timer <= 0) {
      slowMotion.active = false;
      return dt;
    }
    return dt * slowMotion.factor;
  }
  return dt;
}

// ---------------------------------------------------------------------------
// 7h. Enhanced Hit Seal Character Display
// ---------------------------------------------------------------------------

function triggerHitSealChar(x: number, y: number, golden: boolean): void {
  hitSealChar = SEAL_HIT_CHARS[Math.floor(Math.random() * SEAL_HIT_CHARS.length)];
  hitSealX = x;
  hitSealY = y;
  hitSealTimer = golden ? 1.2 : 0.8;
  hitSealSize = golden ? 48 : 30;
  hitSealGolden = golden;
}

function updateHitSealChar(dt: number): void {
  if (hitSealTimer > 0) {
    hitSealTimer -= dt;
    hitSealY -= 25 * dt;
  }
}

function drawHitSealChar(): void {
  if (hitSealTimer <= 0 || !hitSealChar) return;
  const alpha = Math.min(hitSealTimer * 2, 1);
  const scale = hitSealGolden ? 1 + (1 - alpha) * 0.3 : 1;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(hitSealX, hitSealY);
  ctx.scale(scale, scale);

  if (hitSealGolden) {
    // Golden explosion ring
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 20;
    const ringSize = hitSealSize * (1 + (1 - alpha) * 1.5);
    ctx.beginPath();
    ctx.arc(0, 0, ringSize, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Extra glow particles
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI * 2 * i) / 4 + hitSealTimer * 3;
      const r = hitSealSize * 0.8;
      ctx.fillStyle = '#ffd700';
      ctx.globalAlpha = alpha * 0.5;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = alpha;
  }

  ctx.font = `bold ${hitSealSize}px "Noto Serif SC", serif`;
  ctx.fillStyle = hitSealGolden ? '#ffd700' : '#e8c547';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = hitSealGolden ? '#ffd700' : '#e8c547';
  ctx.shadowBlur = hitSealGolden ? 25 : 12;
  ctx.fillText(hitSealChar, 0, 0);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// 7i. Enhanced Motion Blur Trail
// ---------------------------------------------------------------------------

function drawBladeMotionBlur(blade: FlyingBlade): void {
  // Draw 3 ghost copies behind blade with decreasing alpha
  const ghostCount = 3;
  const trailLen = blade.trail.length;
  if (trailLen < 2) return;

  const skin = getEquippedSkin();

  for (let g = 0; g < ghostCount; g++) {
    const trailIdx = Math.max(0, trailLen - 1 - (g + 1) * 2);
    const t = blade.trail[trailIdx];
    if (!t || t.alpha <= 0) continue;

    const ghostAlpha = (1 - (g + 1) / (ghostCount + 1)) * 0.4;

    ctx.save();
    ctx.globalAlpha = ghostAlpha;
    ctx.translate(t.x, t.y);
    ctx.rotate(blade.rot);

    // Ghost blade shape (slightly wider / blurred feel)
    ctx.fillStyle = skin.trailColor || BLADE_COLORS[blade.type] + '60';
    ctx.beginPath();
    ctx.moveTo(0, -BLADE_LENGTH / 2);
    ctx.lineTo(-(BLADE_WIDTH / 2 + g), BLADE_LENGTH / 4);
    ctx.lineTo(0, BLADE_LENGTH / 6);
    ctx.lineTo((BLADE_WIDTH / 2 + g), BLADE_LENGTH / 4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// 7j. Ink Splash Burst on Throw
// ---------------------------------------------------------------------------

function spawnInkSplashBurst(x: number, y: number): void {
  // Burst of ink particles from bottom when throwing
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
    const spd = 80 + Math.random() * 120;
    spawnParticle({
      x: x + (Math.random() - 0.5) * 20,
      y: y + 5,
      vx: Math.cos(angle) * spd * 0.5,
      vy: Math.sin(angle) * spd,
      life: 0.4 + Math.random() * 0.3,
      maxLife: 0.7,
      size: 3 + Math.random() * 5,
      color: 'rgba(30,30,40,0.6)',
      type: 'ink',
    });
  }
  // A few upward-flying ink dots
  for (let i = 0; i < 5; i++) {
    spawnParticle({
      x: x + (Math.random() - 0.5) * 30,
      y: y,
      vx: (Math.random() - 0.5) * 40,
      vy: -(100 + Math.random() * 80),
      life: 0.3 + Math.random() * 0.2,
      maxLife: 0.5,
      size: 2 + Math.random() * 3,
      color: 'rgba(50,40,30,0.5)',
      type: 'ink',
    });
  }
}

// ---------------------------------------------------------------------------
// 7k. Triumphant Chord for Boss Defeat
// ---------------------------------------------------------------------------

function playTriumphantChord(): void {
  // Extended chord progression for boss defeat celebration
  // This is called alongside the existing playBossDefeated
  // We add additional harmony layers
  const chords = [
    [261.63, 329.63, 392.00, 523.25],  // C major 7
    [293.66, 369.99, 440.00, 587.33],  // D major 7
    [329.63, 415.30, 523.25, 659.25],  // E major 7
    [349.23, 440.00, 523.25, 698.46],  // F major add9
  ];
  chords.forEach((chord, ci) => {
    setTimeout(() => {
      chord.forEach(f => {
        audio.playCombo(Math.min(ci + 3, 8));
      });
    }, ci * 400 + 200);
  });
}

// ---------------------------------------------------------------------------
// 8. Particle System
// ---------------------------------------------------------------------------

function spawnParticle(p: Partial<Particle> & { x: number; y: number }): void {
  if (particles.length >= MAX_PARTICLES) return;
  particles.push({
    vx: 0, vy: 0, life: 1, maxLife: 1, size: 3,
    color: '#ffd700', type: 'spark', rot: 0, vr: 0, alpha: 1,
    ...p,
  });
}

function spawnHitEffect(x: number, y: number, type: BladeType): void {
  const color = BLADE_COLORS[type];
  for (let i = 0; i < 12; i++) {
    const a = (Math.PI * 2 * i) / 12 + Math.random() * 0.3;
    const spd = 50 + Math.random() * 100;
    spawnParticle({
      x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      life: 0.5 + Math.random() * 0.3, maxLife: 0.8,
      size: 2 + Math.random() * 3, color, type: 'spark',
    });
  }
  const chars = ['封', '印', '镇', '锁', '灭'];
  spawnParticle({
    x, y: y - 20, life: 1.0, maxLife: 1.0,
    size: 30, color: '#ffd700', type: 'seal', text: chars[type],
  });
}

function spawnCriticalEffect(x: number, y: number): void {
  for (let i = 0; i < 20; i++) {
    const a = (Math.PI * 2 * i) / 20;
    const spd = 80 + Math.random() * 120;
    spawnParticle({
      x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      life: 0.8 + Math.random() * 0.4, maxLife: 1.2,
      size: 3 + Math.random() * 4, color: '#ffd700', type: 'glow',
    });
  }
  spawnParticle({ x, y, life: 0.8, maxLife: 0.8, size: 5, color: '#ffd700', type: 'ring' });
}

function spawnFailEffect(x: number, y: number): void {
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8 + Math.random() * 0.4;
    const spd = 40 + Math.random() * 80;
    spawnParticle({
      x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      life: 0.4 + Math.random() * 0.2, maxLife: 0.6,
      size: 2 + Math.random() * 2, color: '#ff4444', type: 'spark',
    });
  }
}

function spawnBossDefeatedEffect(): void {
  for (let i = 0; i < 30; i++) {
    const a = (Math.PI * 2 * i) / 30;
    const spd = 100 + Math.random() * 150;
    spawnParticle({
      x: TARGET_CENTER_X, y: TARGET_CENTER_Y,
      vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      life: 1.5 + Math.random() * 0.5, maxLife: 2.0,
      size: 4 + Math.random() * 5, color: '#ffd700', type: 'glow',
    });
  }
  for (let i = 0; i < 5; i++) {
    spawnParticle({
      x: TARGET_CENTER_X + (Math.random() - 0.5) * 100,
      y: TARGET_CENTER_Y + (Math.random() - 0.5) * 100,
      life: 1.2, maxLife: 1.2, size: 10, color: '#ffd700', type: 'ring',
    });
  }
}

function spawnInkSplash(x: number, y: number): void {
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 30 + Math.random() * 60;
    spawnParticle({
      x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      life: 0.6 + Math.random() * 0.3, maxLife: 0.9,
      size: 4 + Math.random() * 6, color: 'rgba(30,30,40,0.7)', type: 'ink',
    });
  }
}

function spawnSpecialEffect(x: number, y: number, type: BladeType): void {
  if (type === BladeType.LeiBlade) {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 100;
      spawnParticle({
        x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        life: 0.3 + Math.random() * 0.2, maxLife: 0.5,
        size: 2 + Math.random() * 2, color: '#6eb5ff', type: 'lightning',
      });
    }
  } else if (type === BladeType.BingBlade) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 30 + Math.random() * 60;
      spawnParticle({
        x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        life: 0.8 + Math.random() * 0.4, maxLife: 1.2,
        size: 3 + Math.random() * 3, color: '#a0f0ff', type: 'snow',
      });
    }
  } else if (type === BladeType.HuoBlade) {
    for (let i = 0; i < 15; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 50 + Math.random() * 100;
      spawnParticle({
        x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        life: 0.6 + Math.random() * 0.4, maxLife: 1.0,
        size: 4 + Math.random() * 5, color: i % 2 === 0 ? '#ff6a3a' : '#ffcc00', type: 'fire',
      });
    }
  } else if (type === BladeType.JinBlade) {
    for (let i = 0; i < 8; i++) {
      spawnParticle({
        x: x + (Math.random() - 0.5) * 20,
        y: y + i * 10,
        life: 0.5 + Math.random() * 0.3, maxLife: 0.8,
        size: 3 + Math.random() * 3, color: '#ffe066', type: 'glow',
      });
    }
  }
}

function addFloatingText(x: number, y: number, text: string, color: string, size = 20): void {
  floatingTexts.push({
    x, y, text, color, size,
    life: 1.2, maxLife: 1.2, vy: -40,
  });
}

// ---------------------------------------------------------------------------
// 9. Background Spirits
// ---------------------------------------------------------------------------

function initBgSpirits(): void {
  bgSpirits = [];
  for (let i = 0; i < 25; i++) {
    bgSpirits.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 15,
      vy: (Math.random() - 0.5) * 10,
      size: 2 + Math.random() * 4,
      alpha: 0.1 + Math.random() * 0.3,
      phase: Math.random() * Math.PI * 2,
    });
  }
}

function updateBgSpirits(dt: number): void {
  for (const s of bgSpirits) {
    s.phase += dt * 0.5;
    s.x += s.vx * dt + Math.sin(s.phase) * 0.5;
    s.y += s.vy * dt + Math.cos(s.phase * 0.7) * 0.3;
    s.alpha = 0.1 + Math.sin(s.phase) * 0.15;
    if (s.x < -10) s.x = W + 10;
    if (s.x > W + 10) s.x = -10;
    if (s.y < -10) s.y = H + 10;
    if (s.y > H + 10) s.y = -10;
  }
}

function drawBgSpirits(): void {
  const ch = chapters[Math.min(currentChapter, chapters.length - 1)];
  for (const s of bgSpirits) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, s.alpha);
    ctx.fillStyle = ch.accentColor;
    ctx.shadowColor = ch.accentColor;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// 10. Boss Rotation Physics
// ---------------------------------------------------------------------------

function updateRotation(dt: number): void {
  if (!currentBoss) return;
  const pattern = currentBoss.patterns[currentBoss.currentPattern];
  patternTimer += dt;

  switch (pattern.type) {
    case 'constant':
      targetAngularVelocity = pattern.baseSpeed * rotationDirection;
      break;
    case 'variable':
      targetAngularVelocity = (pattern.baseSpeed + Math.sin(patternTimer * (pattern.varianceFreq || 0.3) * Math.PI * 2) * (pattern.varianceAmp || 0.5)) * rotationDirection;
      break;
    case 'reverse':
      if (patternTimer >= (pattern.reverseInterval || 3)) {
        rotationDirection *= -1;
        patternTimer = 0;
      }
      targetAngularVelocity = pattern.baseSpeed * rotationDirection;
      break;
    case 'burst':
      if (burstTimer > 0) {
        burstTimer -= dt;
        targetAngularVelocity = (pattern.burstSpeed || pattern.baseSpeed * 3) * rotationDirection;
      } else {
        targetAngularVelocity = pattern.baseSpeed * rotationDirection;
        if (Math.random() < (pattern.burstChance || 0.02)) {
          burstTimer = 0.5;
          if (Math.random() < 0.3) rotationDirection *= -1;
        }
      }
      break;
    case 'stop_go':
      stopGoTimer += dt;
      if (stopGoState === 'go') {
        targetAngularVelocity = pattern.baseSpeed * rotationDirection;
        if (stopGoTimer >= (pattern.goDuration || 2)) {
          stopGoState = 'stop';
          stopGoTimer = 0;
        }
      } else {
        targetAngularVelocity = 0;
        if (stopGoTimer >= (pattern.stopDuration || 0.8)) {
          stopGoState = 'go';
          stopGoTimer = 0;
          if (Math.random() < 0.4) rotationDirection *= -1;
        }
      }
      break;
    case 'multi_ring':
      targetAngularVelocity = (pattern.baseSpeed + Math.sin(patternTimer * 0.5 * Math.PI * 2) * pattern.baseSpeed * 0.8) * rotationDirection;
      if (patternTimer > 4) {
        rotationDirection *= -1;
        patternTimer = 0;
      }
      break;
  }

  // Apply ice blade slow effect
  const hasIce = embeddedBlades.some(b => b.type === BladeType.BingBlade);
  if (hasIce) targetAngularVelocity *= 0.5;

  // Endless mode speed multiplier
  if (endlessActive) {
    targetAngularVelocity *= endlessSpeedMultiplier;
  }

  targetAngle += targetAngularVelocity * dt;

  // Update weak spot
  if (currentBoss.weakSpotTimer <= 0) {
    currentBoss.weakSpotActive = Math.random() < 0.008;
    if (currentBoss.weakSpotActive) {
      currentBoss.weakSpotAngle = Math.random() * Math.PI * 2;
      currentBoss.weakSpotTimer = 3.0;
    }
  } else {
    currentBoss.weakSpotTimer -= dt;
    if (currentBoss.weakSpotTimer <= 0) {
      currentBoss.weakSpotActive = false;
    }
  }

  // Rotate shields
  for (let i = 0; i < currentBoss.shieldAngles.length; i++) {
    currentBoss.shieldAngles[i] += targetAngularVelocity * dt * 0.5;
  }
}

// ---------------------------------------------------------------------------
// 11. Blade Mechanics
// ---------------------------------------------------------------------------

function throwBlade(): void {
  if (flyingBlades.length > 0) return;
  if (bladesRemaining <= 0) return;
  if (state !== GameState.Playing) return;

  audio.playThrow();
  totalBladesThrown++;

  const blade: FlyingBlade = {
    x: BLADE_LAUNCH_X,
    y: BLADE_LAUNCH_Y,
    vx: 0,
    vy: -BLADE_SPEED,
    type: currentBladeType,
    rot: 0,
    active: true,
    trail: [],
  };

  flyingBlades.push(blade);
  spawnInkSplash(BLADE_LAUNCH_X, BLADE_LAUNCH_Y);
  spawnInkSplashBurst(BLADE_LAUNCH_X, BLADE_LAUNCH_Y);

  if (currentBladeType !== BladeType.FuDao) {
    specialBladeInventory[currentBladeType]--;
    if (specialBladeInventory[currentBladeType] <= 0) {
      currentBladeType = BladeType.FuDao;
    }
  }
}

function checkBladeCollision(blade: FlyingBlade): 'hit' | 'critical' | 'fail' | 'shield' | null {
  if (!currentBoss) return null;

  const dx = blade.x - TARGET_CENTER_X;
  const dy = blade.y - TARGET_CENTER_Y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > TARGET_RADIUS + BLADE_LENGTH) return null;

  if (dist <= TARGET_RADIUS + BLADE_EMBED_DEPTH) {
    const bladeAngle = Math.atan2(dy, dx);
    const normalizedAngle = ((bladeAngle - targetAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);

    // Check shield collision
    for (const shieldAngle of currentBoss.shieldAngles) {
      const sa = ((shieldAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      if (angleDist(normalizedAngle, sa) < 0.25) {
        return 'shield';
      }
    }

    // Check collision with embedded blades
    let nearestDist = Infinity;
    for (const eb of embeddedBlades) {
      const d = angleDist(normalizedAngle, eb.angle);
      nearestDist = Math.min(nearestDist, d);
      if (d < MIN_BLADE_ARC_DIST) {
        if (blade.type === BladeType.JinBlade) {
          continue;
        }
        return 'fail';
      }
    }

    // Check near miss
    if (nearestDist < NEAR_MISS_THRESHOLD && nearestDist >= MIN_BLADE_ARC_DIST) {
      nearMissShown = true;
    }

    // Check critical hit
    if (currentBoss.weakSpotActive) {
      const wsAngle = ((currentBoss.weakSpotAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      if (angleDist(normalizedAngle, wsAngle) < CRITICAL_SPOT_SIZE) {
        return 'critical';
      }
    }

    return 'hit';
  }

  return null;
}

function embedBlade(blade: FlyingBlade, critical: boolean): void {
  if (!currentBoss) return;
  const dx = blade.x - TARGET_CENTER_X;
  const dy = blade.y - TARGET_CENTER_Y;
  const bladeAngle = Math.atan2(dy, dx);
  const normalizedAngle = ((bladeAngle - targetAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);

  embeddedBlades.push({
    angle: normalizedAngle,
    type: blade.type,
    embedTime: performance.now(),
  });

  bladesRemaining--;

  let pts = 100;
  if (critical) pts = 300;
  pts *= (1 + combo * 0.1);
  score += Math.floor(pts);

  combo++;
  maxCombo = Math.max(maxCombo, combo);
  totalBladesHit++;

  const hitX = TARGET_CENTER_X + Math.cos(bladeAngle) * TARGET_RADIUS;
  const hitY = TARGET_CENTER_Y + Math.sin(bladeAngle) * TARGET_RADIUS;

  spawnHitEffect(hitX, hitY, blade.type);

  if (critical) {
    spawnCriticalEffect(hitX, hitY);
    audio.playCritical();
    addFloatingText(hitX, hitY - 30, '暴击! x3', '#ffd700', 28);
    screenShakeIntensity = 6;
    screenShakeTimer = 0.3;
    currentBoss.hp -= 3;
  } else {
    audio.playHit();
    currentBoss.hp -= 1;
  }

  // Enhanced hit seal character (golden for critical)
  triggerHitSealChar(hitX, hitY - 20, critical);

  if (nearMissShown) {
    addFloatingText(hitX + 30, hitY, '险!', '#ff6b35', 28);
    audio.playNearMiss();
    score += 50;
    triggerSlowMotion();
    nearMissShown = false;
  }

  if (combo > 1) {
    audio.playCombo(combo);
    if (combo % 5 === 0) {
      addFloatingText(W / 2, H / 2, `${combo}连击!`, '#ffd700', 32);
    }
  }

  if (blade.type !== BladeType.FuDao) {
    spawnSpecialEffect(hitX, hitY, blade.type);
  }

  // Lightning chain damage
  if (blade.type === BladeType.LeiBlade && embeddedBlades.length > 1) {
    currentBoss.hp -= Math.min(embeddedBlades.length - 1, 3);
  }

  // Fire explosion
  if (blade.type === BladeType.HuoBlade) {
    currentBoss.hp -= 2;
    screenShakeIntensity = 8;
    screenShakeTimer = 0.4;
  }

  // Seal pattern lines
  if (embeddedBlades.length >= 2) {
    const last = embeddedBlades[embeddedBlades.length - 1];
    const prev = embeddedBlades[embeddedBlades.length - 2];
    sealLines.push({ a1: prev.angle, a2: last.angle, alpha: 1.0, life: 3.0 });
  }

  checkSealPatternBonus();

  // Pattern escalation
  if (currentBoss.hp <= currentBoss.maxHp * 0.5 && currentBoss.currentPattern < currentBoss.patterns.length - 1) {
    currentBoss.currentPattern = Math.min(currentBoss.currentPattern + 1, currentBoss.patterns.length - 1);
    patternTimer = 0;
    addFloatingText(TARGET_CENTER_X, TARGET_CENTER_Y - TARGET_RADIUS - 30, '狂暴!', '#ff4444', 26);
  }

  bossHurtTimer = 0.15;

  if (currentBoss.hp <= 0) {
    currentBoss.defeated = true;
    onBossDefeated();
  }
}

function checkSealPatternBonus(): void {
  if (!currentBoss) return;
  if (embeddedBlades.length === 5) {
    const sorted = embeddedBlades.map(b => b.angle).sort((a, b) => a - b);
    const targetGap = Math.PI * 2 / 5;
    let isPattern = true;
    for (let i = 0; i < sorted.length; i++) {
      const next = sorted[(i + 1) % sorted.length];
      const gap = ((next - sorted[i]) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      if (Math.abs(gap - targetGap) > 0.4) { isPattern = false; break; }
    }
    if (isPattern) {
      score += 500;
      addFloatingText(TARGET_CENTER_X, TARGET_CENTER_Y + TARGET_RADIUS + 40, '五行阵! +500', '#ffd700', 24);
      currentBoss.hp -= 3;
    }
  }
  if (embeddedBlades.length === 8) {
    const sorted = embeddedBlades.map(b => b.angle).sort((a, b) => a - b);
    const targetGap = Math.PI * 2 / 8;
    let isPattern = true;
    for (let i = 0; i < sorted.length; i++) {
      const next = sorted[(i + 1) % sorted.length];
      const gap = ((next - sorted[i]) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      if (Math.abs(gap - targetGap) > 0.35) { isPattern = false; break; }
    }
    if (isPattern) {
      score += 1000;
      addFloatingText(TARGET_CENTER_X, TARGET_CENTER_Y + TARGET_RADIUS + 40, '八卦阵! +1000', '#ffd700', 28);
      currentBoss.hp -= 5;
      unlockAchievement('bagua');
    }
  }
}

function onBladeFail(blade: FlyingBlade): void {
  combo = 0;
  bladesRemaining--;

  bounceBlades.push({
    x: blade.x, y: blade.y,
    vx: (Math.random() - 0.5) * 200,
    vy: 100 + Math.random() * 200,
    rot: blade.rot,
    vr: (Math.random() - 0.5) * 10,
    type: blade.type,
    alpha: 1,
  });

  spawnFailEffect(blade.x, blade.y);
  audio.playFail();
  screenShakeIntensity = 4;
  screenShakeTimer = 0.2;
  flashColor = 'rgba(255,50,50,0.3)';
  flashTimer = 0.15;

  addFloatingText(blade.x, blade.y - 20, '失败!', '#ff4444', 22);

  if (bladesRemaining <= 0 && currentBoss && currentBoss.hp > 0) {
    setTimeout(() => {
      if (state === GameState.Playing) {
        state = GameState.GameOver;
        gameOverTimer = 0;
      }
    }, 800);
  }
}

function onBossDefeated(): void {
  audio.playBossDefeated();
  spawnBossDefeatedEffect();
  screenShakeIntensity = 10;
  screenShakeTimer = 0.5;

  // Enhanced boss defeat celebration
  goldenFlashTimer = 0.4;
  flashColor = 'rgba(255,215,0,0.5)';
  flashTimer = 0.4;
  bossDefeatCelebrationTimer = 4.0;
  calligraphyAlpha = 0;
  calligraphyScale = 0;

  // Spawn 35+ confetti particles
  spawnConfetti(40);

  // Triumphant chord progression
  playTriumphantChord();

  // Add coins based on difficulty
  const coinReward = 100 + (currentBoss ? Math.floor(currentBoss.maxHp * 5) : 50);
  playerCoins += coinReward;
  saveShopData();
  addFloatingText(W / 2, H * 0.6, `+${coinReward} 金币`, '#ffd700', 20);

  const numDrops = 1 + Math.floor(Math.random() * 3);
  const types: PowerUp['type'][] = ['lei', 'bing', 'huo', 'jin', 'heal', 'score'];
  for (let i = 0; i < numDrops; i++) {
    powerUps.push({
      x: TARGET_CENTER_X + (Math.random() - 0.5) * 100,
      y: TARGET_CENTER_Y,
      vy: 60 + Math.random() * 40,
      type: types[Math.floor(Math.random() * types.length)],
      life: 5,
      rot: 0,
    });
  }

  clearTimer = 0;
  state = GameState.StageClear;

  if (!endlessActive && currentChapter < chapters.length && currentStage < chapters[currentChapter].stages.length) {
    chapterProgress[currentChapter][currentStage] = true;
    saveProgress();
  }

  // Check achievements
  if (!endlessActive && currentChapter === 3 && currentStage === chapters[3].stages.length - 1) {
    unlockAchievement('dragon');
  }
  checkAchievements();

  if (passport) {
    passport.gamesPlayed++;
    passport.totalScore += score;
    passport.lastPlayed = new Date().toISOString().slice(0, 10);
    if (!passport.completedGames.includes('melos-quest-9')) {
      const allDone = chapterProgress.every(ch => ch.every(s => s));
      if (allDone) passport.completedGames.push('melos-quest-9');
    }
    savePassport();
  }
}

// ---------------------------------------------------------------------------
// 12. Power-Up System
// ---------------------------------------------------------------------------

function collectPowerUp(pu: PowerUp): void {
  audio.playPowerUp();
  switch (pu.type) {
    case 'lei':
      specialBladeInventory[BladeType.LeiBlade] += 2;
      addFloatingText(pu.x, pu.y, '+2 雷刃', '#6eb5ff', 20);
      break;
    case 'bing':
      specialBladeInventory[BladeType.BingBlade] += 2;
      addFloatingText(pu.x, pu.y, '+2 冰刃', '#a0f0ff', 20);
      break;
    case 'huo':
      specialBladeInventory[BladeType.HuoBlade] += 2;
      addFloatingText(pu.x, pu.y, '+2 火刃', '#ff6a3a', 20);
      break;
    case 'jin':
      specialBladeInventory[BladeType.JinBlade] += 1;
      addFloatingText(pu.x, pu.y, '+1 金刃', '#ffe066', 20);
      break;
    case 'heal':
      bladesRemaining += 3;
      addFloatingText(pu.x, pu.y, '+3 飞刃', '#a5d6a7', 20);
      break;
    case 'score':
      score += 300;
      addFloatingText(pu.x, pu.y, '+300', '#ffd700', 20);
      break;
  }
}

// ---------------------------------------------------------------------------
// 13. Stage Setup
// ---------------------------------------------------------------------------

function startStage(chapter: number, stage: number): void {
  currentChapter = chapter;
  currentStage = stage;
  endlessActive = false;

  const ch = chapters[chapter];
  const sc = ch.stages[stage];
  currentBoss = createBoss(sc.bossIndex, sc.difficulty, sc.bladesNeeded);
  bladesRemaining = sc.bladesNeeded + 3 + Math.floor(sc.difficulty * 0.5);
  resetStageState();

  state = GameState.StageIntro;
  introTimer = 0;

  audio.startBGM();
}

function startEndlessWave(): void {
  endlessActive = true;
  endlessWave++;
  const diff = Math.min(3 + endlessWave, 10);
  const blades = 6 + endlessWave * 2;
  const bossIdx = endlessWave % CREATURES.length;
  currentBoss = createBoss(bossIdx, diff, blades);
  bladesRemaining = blades + 4;

  // Endless mode: progressively faster rotation
  endlessSpeedMultiplier = 1.0 + endlessWave * 0.08;
  // Random pattern combos after wave 5
  endlessRandomPatternActive = endlessWave >= 5;
  endlessPatternComboTimer = 0;

  resetStageState();

  state = GameState.StageIntro;
  introTimer = 0;

  audio.startBGM();
}

function resetStageState(): void {
  embeddedBlades = [];
  flyingBlades = [];
  bounceBlades = [];
  sealLines = [];
  particles = [];
  floatingTexts = [];
  powerUps = [];
  targetAngle = 0;
  targetAngularVelocity = 1;
  rotationDirection = 1;
  patternTimer = 0;
  stopGoState = 'go';
  stopGoTimer = 0;
  burstTimer = 0;
  combo = 0;
  maxCombo = 0;
  totalBladesThrown = 0;
  totalBladesHit = 0;
  bossHurtTimer = 0;
  screenShakeTimer = 0;
  flashTimer = 0;
  nearMissShown = false;
  isCharging = false;
  chargeTime = 0;
}

// ---------------------------------------------------------------------------
// 14. Update Logic
// ---------------------------------------------------------------------------

function update(dt: number): void {
  titleTime += dt;
  bossBreathPhase += dt * 2;
  updateBgSpirits(dt);
  updateAchievementPopup(dt);
  updateHitSealChar(dt);

  // Share card fade in
  if (shareCardVisible) {
    shareCardAlpha = Math.min(shareCardAlpha + dt * 3, 1);
  } else {
    shareCardAlpha = Math.max(shareCardAlpha - dt * 3, 0);
  }

  // Tutorial timer
  if (state === GameState.Tutorial) {
    tutorialTimer += dt;
    tutorialAlpha = Math.min(tutorialAlpha + dt * 3, 1);
  }

  switch (state) {
    case GameState.Title:
    case GameState.NicknameSelect:
    case GameState.ChapterSelect:
    case GameState.BladeShop:
    case GameState.Tutorial:
      break;

    case GameState.StageIntro:
      introTimer += dt;
      if (introTimer > 2.5) {
        state = GameState.Playing;
      }
      break;

    case GameState.Playing: {
      // Apply slow motion
      const effectiveDt = updateSlowMotion(dt);
      updatePlaying(effectiveDt);

      // Endless mode: random pattern switches
      if (endlessActive && endlessRandomPatternActive && currentBoss) {
        endlessPatternComboTimer += dt;
        if (endlessPatternComboTimer > 3 + Math.random() * 2) {
          endlessPatternComboTimer = 0;
          const numPatterns = currentBoss.patterns.length;
          if (numPatterns > 1) {
            currentBoss.currentPattern = Math.floor(Math.random() * numPatterns);
            patternTimer = 0;
          }
          // Occasional direction change
          if (Math.random() < 0.3) {
            rotationDirection *= -1;
          }
        }
      }
      break;
    }

    case GameState.StageClear:
      clearTimer += dt;
      updateParticles(dt);
      updatePowerUps(dt);
      updateFloatingTexts(dt);
      updateConfetti(dt);

      // Boss defeat celebration animation
      if (bossDefeatCelebrationTimer > 0) {
        bossDefeatCelebrationTimer -= dt;
        calligraphyAlpha = Math.min(calligraphyAlpha + dt * 2, 1);
        calligraphyScale = Math.min(calligraphyScale + dt * 3, 1);
        if (goldenFlashTimer > 0) goldenFlashTimer -= dt;
      }
      break;

    case GameState.GameOver:
      gameOverTimer += dt;
      updateParticles(dt);
      updateFloatingTexts(dt);
      break;

    case GameState.Paused:
      break;
  }
}

function updatePlaying(dt: number): void {
  updateRotation(dt);

  if (isCharging) {
    chargeTime += dt;
    if (chargeTime >= chargeMaxTime) chargeTime = chargeMaxTime;
  }

  // Update flying blades
  for (let i = flyingBlades.length - 1; i >= 0; i--) {
    const blade = flyingBlades[i];
    if (!blade.active) { flyingBlades.splice(i, 1); continue; }

    blade.x += blade.vx * dt;
    blade.y += blade.vy * dt;
    blade.rot = Math.atan2(blade.vy, blade.vx) + Math.PI / 2;

    blade.trail.push({ x: blade.x, y: blade.y, alpha: 1 });
    if (blade.trail.length > 8) blade.trail.shift();
    for (const t of blade.trail) t.alpha -= dt * 4;

    const result = checkBladeCollision(blade);
    if (result === 'hit' || result === 'critical') {
      embedBlade(blade, result === 'critical');
      blade.active = false;
    } else if (result === 'fail' || result === 'shield') {
      onBladeFail(blade);
      blade.active = false;
    }

    if (blade.y < -50 || blade.y > H + 50) {
      blade.active = false;
    }
  }

  // Update bounce blades
  for (let i = bounceBlades.length - 1; i >= 0; i--) {
    const b = bounceBlades[i];
    b.vy += 400 * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.rot += b.vr * dt;
    b.alpha -= dt * 0.8;
    if (b.alpha <= 0 || b.y > H + 50) bounceBlades.splice(i, 1);
  }

  // Screen effects
  if (screenShakeTimer > 0) screenShakeTimer -= dt;
  if (flashTimer > 0) flashTimer -= dt;
  if (bossHurtTimer > 0) bossHurtTimer -= dt;

  // Seal lines fade
  for (let i = sealLines.length - 1; i >= 0; i--) {
    sealLines[i].life -= dt;
    sealLines[i].alpha = Math.min(1, sealLines[i].life);
    if (sealLines[i].life <= 0) sealLines.splice(i, 1);
  }

  updateParticles(dt);
  updateFloatingTexts(dt);
  updatePowerUps(dt);
}

function updateParticles(dt: number): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.alpha = Math.max(0, p.life / p.maxLife);
    p.rot += p.vr * dt;

    if (p.type === 'spark' || p.type === 'fire') p.vy += 50 * dt;
    if (p.type === 'snow') p.vx += Math.sin(p.rot) * 20 * dt;
    if (p.type === 'ring') p.size += 150 * dt;
    if (p.type === 'seal') { p.vy = -30; p.size *= 1.01; }

    if (p.life <= 0) particles.splice(i, 1);
  }
}

function updateFloatingTexts(dt: number): void {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.y += ft.vy * dt;
    ft.life -= dt;
    if (ft.life <= 0) floatingTexts.splice(i, 1);
  }
}

function updatePowerUps(dt: number): void {
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const pu = powerUps[i];
    pu.y += pu.vy * dt;
    pu.rot += dt * 2;
    pu.life -= dt;
    if (pu.life <= 0 || pu.y > H + 20) powerUps.splice(i, 1);
  }
}

// ---------------------------------------------------------------------------
// 15. Drawing — Boss / Target
// ---------------------------------------------------------------------------

function drawBoss(): void {
  if (!currentBoss) return;
  ctx.save();
  ctx.translate(TARGET_CENTER_X, TARGET_CENTER_Y);

  if (bossHurtTimer > 0) {
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 20;
  }

  const breathScale = 1 + Math.sin(bossBreathPhase) * 0.02;
  ctx.scale(breathScale, breathScale);

  drawBossBody(currentBoss);
  drawBossEyes(currentBoss);

  ctx.restore();

  drawTargetRing();
  drawEmbeddedBlades();
  drawShields();
  drawWeakSpot();
  drawSealLines();
}

function drawBossBody(boss: Boss): void {
  const r = TARGET_RADIUS - 10;

  // Background glow
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.shadowColor = boss.color1;
  ctx.shadowBlur = 30;
  ctx.beginPath();
  ctx.arc(0, 0, r + 15, 0, Math.PI * 2);
  ctx.fillStyle = boss.color1;
  ctx.fill();
  ctx.restore();

  // Main body gradient
  const grad = ctx.createRadialGradient(0, -r * 0.3, 0, 0, 0, r);
  grad.addColorStop(0, boss.color1);
  grad.addColorStop(1, boss.color2);

  ctx.save();
  switch (boss.bodyType) {
    case 'round':
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      // Inner patterns
      ctx.globalAlpha = 0.15;
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 * i) / 6 + bossBreathPhase * 0.1;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4, r * 0.2, 0, Math.PI * 2);
        ctx.strokeStyle = boss.eyeColor;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      break;

    case 'spiky': {
      ctx.beginPath();
      const spikes = 12;
      for (let i = 0; i < spikes; i++) {
        const a = (Math.PI * 2 * i) / spikes;
        const outerR = r + 8 + Math.sin(bossBreathPhase + i) * 3;
        const innerR = r * 0.75;
        if (i === 0) ctx.moveTo(Math.cos(a) * outerR, Math.sin(a) * outerR);
        else ctx.lineTo(Math.cos(a) * outerR, Math.sin(a) * outerR);
        const midA = a + Math.PI / spikes;
        ctx.lineTo(Math.cos(midA) * innerR, Math.sin(midA) * innerR);
      }
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      break;
    }

    case 'serpent':
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      // Scale pattern
      ctx.globalAlpha = 0.2;
      for (let row = -3; row <= 3; row++) {
        for (let col = -3; col <= 3; col++) {
          const sx = col * 18 + (row % 2) * 9;
          const sy = row * 15;
          if (sx * sx + sy * sy < r * r * 0.8) {
            ctx.beginPath();
            ctx.arc(sx, sy, 7, 0, Math.PI * 2);
            ctx.strokeStyle = boss.color1;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
      break;

    case 'multi':
      for (let ring = 3; ring >= 0; ring--) {
        const rr = r * (0.3 + ring * 0.25);
        ctx.beginPath();
        ctx.arc(0, 0, rr, 0, Math.PI * 2);
        ctx.fillStyle = ring % 2 === 0 ? boss.color1 : boss.color2;
        ctx.globalAlpha = 0.4 + ring * 0.15;
        ctx.fill();
      }
      ctx.globalAlpha = 0.3;
      {
        const symbols = ['阴', '阳', '金', '木', '水', '火', '土', '风'];
        ctx.font = '12px "Noto Serif SC", serif';
        ctx.fillStyle = boss.eyeColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < 8; i++) {
          const a = (Math.PI * 2 * i) / 8 + bossBreathPhase * 0.2;
          ctx.fillText(symbols[i], Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
        }
      }
      break;

    case 'void':
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0a0a';
      ctx.fill();
      // Spiral
      ctx.strokeStyle = boss.color1;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      for (let t = 0; t < Math.PI * 6; t += 0.1) {
        const sr = (t / (Math.PI * 6)) * r * 0.9;
        const sa = t + bossBreathPhase * 0.5;
        const sx = Math.cos(sa) * sr;
        const sy = Math.sin(sa) * sr;
        if (t === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      break;
  }
  ctx.restore();

  // Border ring
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.strokeStyle = boss.color1;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.6;
  ctx.stroke();
  ctx.restore();
}

function drawBossEyes(boss: Boss): void {
  const eyeSpacing = 18;
  const eyeY = -5;
  const eyeSize = 8;

  for (const side of [-1, 1]) {
    const ex = side * eyeSpacing;
    ctx.save();
    ctx.shadowColor = boss.eyeColor;
    ctx.shadowBlur = 12;
    ctx.fillStyle = boss.eyeColor;
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, eyeSize, eyeSize * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(ex + side * 2, eyeY, eyeSize * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.font = 'bold 14px "Noto Serif SC", serif';
  ctx.fillStyle = boss.eyeColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.6;
  ctx.fillText(boss.creature, 0, 25);
  ctx.restore();
}

function drawTargetRing(): void {
  ctx.save();
  ctx.translate(TARGET_CENTER_X, TARGET_CENTER_Y);
  ctx.rotate(targetAngle);

  ctx.beginPath();
  ctx.arc(0, 0, TARGET_RADIUS, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(200,180,100,0.4)';
  ctx.lineWidth = 3;
  ctx.stroke();

  const ticks = 24;
  for (let i = 0; i < ticks; i++) {
    const a = (Math.PI * 2 * i) / ticks;
    const inner = TARGET_RADIUS - 5;
    const outer = TARGET_RADIUS + 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
    ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
    ctx.strokeStyle = 'rgba(200,180,100,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();
}

function drawEmbeddedBlades(): void {
  for (const eb of embeddedBlades) {
    const worldAngle = eb.angle + targetAngle;
    const tipX = TARGET_CENTER_X + Math.cos(worldAngle) * TARGET_RADIUS;
    const tipY = TARGET_CENTER_Y + Math.sin(worldAngle) * TARGET_RADIUS;

    ctx.save();
    ctx.translate(tipX, tipY);
    ctx.rotate(worldAngle);

    const color = BLADE_COLORS[eb.type];
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;

    ctx.fillRect(-2, -BLADE_WIDTH / 2, BLADE_LENGTH - BLADE_EMBED_DEPTH, BLADE_WIDTH);

    ctx.fillStyle = '#8b6914';
    ctx.fillRect(BLADE_LENGTH - BLADE_EMBED_DEPTH - 4, -BLADE_WIDTH / 2 - 2, 8, BLADE_WIDTH + 4);

    ctx.fillStyle = '#ff4444';
    ctx.globalAlpha = 0.7;
    ctx.fillRect(BLADE_LENGTH - BLADE_EMBED_DEPTH, -1, 12, 2);

    ctx.restore();

    // Embed glow
    const timeSinceEmbed = (performance.now() - eb.embedTime) / 1000;
    if (timeSinceEmbed < 0.5) {
      ctx.save();
      ctx.globalAlpha = (0.5 - timeSinceEmbed) * 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 15;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(tipX, tipY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawShields(): void {
  if (!currentBoss) return;
  for (const sa of currentBoss.shieldAngles) {
    const sx = TARGET_CENTER_X + Math.cos(sa) * (TARGET_RADIUS + 12);
    const sy = TARGET_CENTER_Y + Math.sin(sa) * (TARGET_RADIUS + 12);

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(sa);

    ctx.strokeStyle = '#ff4466';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#ff4466';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(-12, 0, 12, -0.8, 0.8);
    ctx.stroke();

    ctx.restore();
  }
}

function drawWeakSpot(): void {
  if (!currentBoss || !currentBoss.weakSpotActive) return;
  const wsWorld = currentBoss.weakSpotAngle + targetAngle;
  const wx = TARGET_CENTER_X + Math.cos(wsWorld) * TARGET_RADIUS;
  const wy = TARGET_CENTER_Y + Math.sin(wsWorld) * TARGET_RADIUS;

  const pulse = Math.sin(bossBreathPhase * 4) * 0.3 + 0.7;

  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 15;
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.arc(wx, wy, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI * 2 * i) / 4 + bossBreathPhase * 2;
    ctx.beginPath();
    ctx.moveTo(wx + Math.cos(a) * 4, wy + Math.sin(a) * 4);
    ctx.lineTo(wx + Math.cos(a) * 12, wy + Math.sin(a) * 12);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSealLines(): void {
  for (const sl of sealLines) {
    if (sl.alpha <= 0) continue;
    const a1World = sl.a1 + targetAngle;
    const a2World = sl.a2 + targetAngle;
    const x1 = TARGET_CENTER_X + Math.cos(a1World) * TARGET_RADIUS;
    const y1 = TARGET_CENTER_Y + Math.sin(a1World) * TARGET_RADIUS;
    const x2 = TARGET_CENTER_X + Math.cos(a2World) * TARGET_RADIUS;
    const y2 = TARGET_CENTER_Y + Math.sin(a2World) * TARGET_RADIUS;

    ctx.save();
    ctx.globalAlpha = sl.alpha * 0.5;
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// 16. Drawing — Flying Blades
// ---------------------------------------------------------------------------

function drawBladeSkinPattern(skin: BladeSkin): void {
  // Draw pattern overlay on the blade based on skin type
  ctx.save();
  ctx.globalAlpha = 0.4;
  switch (skin.pattern) {
    case 'flame':
      // Fire wisps
      ctx.fillStyle = '#ffcc00';
      for (let i = 0; i < 3; i++) {
        const fy = -BLADE_LENGTH / 2 + i * 8 + Math.sin(bossBreathPhase * 5 + i) * 2;
        ctx.beginPath();
        ctx.arc((Math.random() - 0.5) * 3, fy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'frost':
      // Ice crystals
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < 2; i++) {
        const fy = -BLADE_LENGTH / 3 + i * 12;
        ctx.beginPath();
        for (let j = 0; j < 6; j++) {
          const a = (Math.PI * 2 * j) / 6;
          ctx.moveTo(0, fy);
          ctx.lineTo(Math.cos(a) * 3, fy + Math.sin(a) * 3);
        }
        ctx.stroke();
      }
      break;
    case 'thunder':
      // Lightning bolt line
      ctx.strokeStyle = '#dda0dd';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -BLADE_LENGTH / 2);
      ctx.lineTo(-2, -BLADE_LENGTH / 4);
      ctx.lineTo(2, 0);
      ctx.lineTo(-1, BLADE_LENGTH / 6);
      ctx.stroke();
      break;
    case 'void':
      // Void swirl
      ctx.strokeStyle = '#8a2be2';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let t = 0; t < Math.PI * 3; t += 0.3) {
        const vr = t * 1.2;
        const vx = Math.cos(t + bossBreathPhase) * vr * 0.3;
        const vy = -BLADE_LENGTH / 4 + Math.sin(t + bossBreathPhase) * vr * 0.3;
        if (t === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      }
      ctx.stroke();
      break;
    case 'golden':
      // Golden glow lines
      ctx.strokeStyle = '#ffec8b';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-BLADE_WIDTH / 2 + 1, BLADE_LENGTH / 4 - 2);
      ctx.lineTo(0, -BLADE_LENGTH / 2 + 4);
      ctx.lineTo(BLADE_WIDTH / 2 - 1, BLADE_LENGTH / 4 - 2);
      ctx.stroke();
      break;
    case 'jade':
      // Jade inner glow
      ctx.fillStyle = '#98fb98';
      ctx.beginPath();
      ctx.ellipse(0, -BLADE_LENGTH / 6, 2, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'blood':
      // Blood drip effect
      ctx.fillStyle = '#dc143c';
      for (let i = 0; i < 2; i++) {
        const bdy = -BLADE_LENGTH / 3 + i * 10;
        ctx.beginPath();
        ctx.arc(i % 2 === 0 ? -1 : 1, bdy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    default:
      break;
  }
  ctx.restore();
}

function drawFlyingBlades(): void {
  for (const blade of flyingBlades) {
    if (!blade.active) continue;

    // Enhanced motion blur trail (3 ghost copies)
    drawBladeMotionBlur(blade);

    // Original trail dots
    for (const t of blade.trail) {
      if (t.alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = t.alpha * 0.4;
      ctx.fillStyle = BLADE_COLORS[blade.type];
      ctx.beginPath();
      ctx.arc(t.x, t.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Main blade with equipped skin
    const skin = getEquippedSkin();
    ctx.save();
    ctx.translate(blade.x, blade.y);
    ctx.rotate(blade.rot);

    const bladeColor = blade.type === BladeType.FuDao ? skin.color1 : BLADE_COLORS[blade.type];
    ctx.fillStyle = bladeColor;
    ctx.shadowColor = bladeColor;
    ctx.shadowBlur = 10;

    // Blade shape (pointed)
    ctx.beginPath();
    ctx.moveTo(0, -BLADE_LENGTH / 2);
    ctx.lineTo(-BLADE_WIDTH / 2, BLADE_LENGTH / 4);
    ctx.lineTo(0, BLADE_LENGTH / 6);
    ctx.lineTo(BLADE_WIDTH / 2, BLADE_LENGTH / 4);
    ctx.closePath();
    ctx.fill();

    // Skin-specific patterns
    if (blade.type === BladeType.FuDao) {
      drawBladeSkinPattern(skin);
    }

    ctx.fillStyle = '#8b6914';
    ctx.fillRect(-3, BLADE_LENGTH / 4, 6, 10);

    ctx.fillStyle = '#ff4444';
    ctx.fillRect(-1.5, BLADE_LENGTH / 4 + 10, 3, 8);

    ctx.restore();
  }

  // Hit seal character
  drawHitSealChar();

  // Bounce blades
  for (const b of bounceBlades) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, b.alpha);
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rot);
    ctx.fillStyle = BLADE_COLORS[b.type];
    ctx.fillRect(-BLADE_WIDTH / 2, -BLADE_LENGTH / 2, BLADE_WIDTH, BLADE_LENGTH);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// 17. Drawing — UI Elements
// ---------------------------------------------------------------------------

function drawHP(): void {
  if (!currentBoss) return;
  const barW = 260;
  const barH = 16;
  const barX = (W - barW) / 2;
  const barY = TARGET_CENTER_Y + TARGET_RADIUS + 50;

  drawChineseFrame(barX - 4, barY - 4, barW + 8, barH + 8, '#c8a850', 1.5);

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  drawRoundRect(barX, barY, barW, barH, 3);
  ctx.fill();

  const hpPct = Math.max(0, currentBoss.hp / currentBoss.maxHp);
  const hpColor = hpPct > 0.5 ? '#4caf50' : hpPct > 0.25 ? '#ff9800' : '#f44336';
  if (hpPct > 0) {
    const hpGrad = ctx.createLinearGradient(barX, barY, barX + barW * hpPct, barY);
    hpGrad.addColorStop(0, hpColor);
    hpGrad.addColorStop(1, hpColor + '88');
    drawRoundRect(barX + 1, barY + 1, (barW - 2) * hpPct, barH - 2, 2);
    ctx.fillStyle = hpGrad;
    ctx.fill();
  }

  ctx.font = 'bold 14px "Noto Serif SC", serif';
  ctx.fillStyle = '#e0d0a0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(currentBoss.name, W / 2, barY - 8);
}

function drawScore(): void {
  ctx.save();
  ctx.font = 'bold 18px "Noto Serif SC", serif';
  ctx.fillStyle = '#ffd700';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 4;
  ctx.fillText(`${score}`, W / 2, 64);
  ctx.shadowBlur = 0;

  if (combo > 1) {
    ctx.font = 'bold 16px "Noto Serif SC", serif';
    ctx.fillStyle = '#ff9800';
    ctx.fillText(`${combo}x 连击`, W / 2, 86);
  }
  ctx.restore();
}

function drawBladesRemaining(): void {
  const startY = BLADE_LAUNCH_Y + 50;
  const spacing = 14;
  const count = Math.min(bladesRemaining, 20);

  for (let i = 0; i < count; i++) {
    const bx = W / 2 - (count * spacing) / 2 + i * spacing;
    ctx.save();
    ctx.fillStyle = i < 3 ? '#ff6b35' : '#e8c547';
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(bx, startY);
    ctx.lineTo(bx - 2, startY + 8);
    ctx.lineTo(bx + 2, startY + 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(bx - 1, startY + 8, 2, 5);
    ctx.restore();
  }

  ctx.font = '12px "Noto Serif SC", serif';
  ctx.fillStyle = '#a0a0a0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`剩余 ${bladesRemaining}`, W / 2, startY + 18);
}

function drawBladeSelector(): void {
  const selectorY = BLADE_LAUNCH_Y - 50;
  const types: BladeType[] = [BladeType.FuDao, BladeType.LeiBlade, BladeType.BingBlade, BladeType.HuoBlade, BladeType.JinBlade];
  const names = ['符', '雷', '冰', '火', '金'];
  const totalW = types.length * 44;
  const startX = (W - totalW) / 2;

  for (let i = 0; i < types.length; i++) {
    const bx = startX + i * 44 + 22;
    const by = selectorY;
    const isActive = currentBladeType === types[i];
    const count = i === 0 ? -1 : specialBladeInventory[types[i]];
    const available = i === 0 || count > 0;

    ctx.save();
    ctx.globalAlpha = available ? (isActive ? 1 : 0.5) : 0.2;

    ctx.fillStyle = isActive ? BLADE_COLORS[types[i]] + '40' : 'rgba(40,40,40,0.5)';
    ctx.beginPath();
    ctx.arc(bx, by, 18, 0, Math.PI * 2);
    ctx.fill();

    if (isActive) {
      ctx.strokeStyle = BLADE_COLORS[types[i]];
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.font = 'bold 14px "Noto Serif SC", serif';
    ctx.fillStyle = BLADE_COLORS[types[i]];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(names[i], bx, by);

    if (count >= 0) {
      ctx.font = '10px "Noto Serif SC", serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${count}`, bx, by + 14);
    }

    ctx.restore();
  }
}

function drawChargeIndicator(): void {
  if (!isCharging) return;
  const pct = chargeTime / chargeMaxTime;
  const cx = BLADE_LAUNCH_X;
  const cy = BLADE_LAUNCH_Y;

  ctx.save();
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, 25, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
  ctx.stroke();

  if (pct >= 1) {
    ctx.globalAlpha = 0.5 + Math.sin(bossBreathPhase * 6) * 0.3;
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

function drawPauseButton(): void {
  const { x, y, w, h } = pauseButtonBounds;
  ctx.save();
  ctx.fillStyle = 'rgba(30,30,30,0.6)';
  drawRoundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(200,180,100,0.5)';
  ctx.lineWidth = 1;
  drawRoundRect(x, y, w, h, 8);
  ctx.stroke();

  ctx.fillStyle = '#e0d0a0';
  if (state === GameState.Paused) {
    ctx.beginPath();
    ctx.moveTo(x + 15, y + 12);
    ctx.lineTo(x + 15, y + 32);
    ctx.lineTo(x + 32, y + 22);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(x + 14, y + 12, 6, 20);
    ctx.fillRect(x + 24, y + 12, 6, 20);
  }
  ctx.restore();
}

function drawMuteButton(): void {
  const { x, y, w, h } = muteButtonBounds;
  ctx.save();
  ctx.fillStyle = 'rgba(30,30,30,0.6)';
  drawRoundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(200,180,100,0.5)';
  ctx.lineWidth = 1;
  drawRoundRect(x, y, w, h, 8);
  ctx.stroke();

  // Draw speaker icon with lines instead of emoji
  ctx.fillStyle = '#e0d0a0';
  ctx.strokeStyle = '#e0d0a0';
  ctx.lineWidth = 2;
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Speaker body
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy - 4);
  ctx.lineTo(cx - 3, cy - 4);
  ctx.lineTo(cx + 3, cy - 9);
  ctx.lineTo(cx + 3, cy + 9);
  ctx.lineTo(cx - 3, cy + 4);
  ctx.lineTo(cx - 8, cy + 4);
  ctx.closePath();
  ctx.fill();

  if (!audio.isMuted) {
    // Sound waves
    ctx.beginPath();
    ctx.arc(cx + 5, cy, 6, -0.6, 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 5, cy, 10, -0.6, 0.6);
    ctx.stroke();
  } else {
    // X mark
    ctx.beginPath();
    ctx.moveTo(cx + 6, cy - 5);
    ctx.lineTo(cx + 14, cy + 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 14, cy - 5);
    ctx.lineTo(cx + 6, cy + 5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles(): void {
  for (const p of particles) {
    if (p.alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = p.alpha;

    if (p.type === 'seal' && p.text) {
      drawSealChar(p.x, p.y, p.size, p.text, p.color, p.alpha);
    } else if (p.type === 'ring') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.type === 'lightning') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.vx * 0.05 + (Math.random() - 0.5) * 8, p.y + p.vy * 0.05 + (Math.random() - 0.5) * 8);
      ctx.stroke();
    } else if (p.type === 'ink') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.size, p.size * 0.7, p.rot, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'snow') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 * i) / 6 + p.rot;
        if (i === 0) ctx.moveTo(p.x + Math.cos(a) * p.size, p.y + Math.sin(a) * p.size);
        else ctx.lineTo(p.x + Math.cos(a) * p.size, p.y + Math.sin(a) * p.size);
      }
      ctx.closePath();
      ctx.fill();
    } else if (p.type === 'fire') {
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + p.alpha * 0.5), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      if (p.type === 'glow') {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.alpha, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawFloatingTexts(): void {
  for (const ft of floatingTexts) {
    const alpha = ft.life / ft.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${ft.size}px "Noto Serif SC", serif`;
    ctx.fillStyle = ft.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = ft.color;
    ctx.shadowBlur = 6;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }
}

function drawPowerUps(): void {
  for (const pu of powerUps) {
    ctx.save();
    ctx.translate(pu.x, pu.y);
    ctx.rotate(pu.rot);

    let color: string;
    let icon: string;
    switch (pu.type) {
      case 'lei': color = '#6eb5ff'; icon = '雷'; break;
      case 'bing': color = '#a0f0ff'; icon = '冰'; break;
      case 'huo': color = '#ff6a3a'; icon = '火'; break;
      case 'jin': color = '#ffe066'; icon = '金'; break;
      case 'heal': color = '#a5d6a7'; icon = '刃'; break;
      case 'score': color = '#ffd700'; icon = '宝'; break;
      default: color = '#ffffff'; icon = '?'; break;
    }

    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = color + '40';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.font = 'bold 16px "Noto Serif SC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, 0, 0);

    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// 18. Drawing — Screens
// ---------------------------------------------------------------------------

function drawBackground(): void {
  const ch = chapters[Math.min(currentChapter, chapters.length - 1)];
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, ch.bgColor1);
  grad.addColorStop(1, ch.bgColor2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function drawTitleScreen(): void {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0a0a1a');
  grad.addColorStop(0.5, '#1a0a2a');
  grad.addColorStop(1, '#0a0a0e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  drawBgSpirits();

  // Title
  const titleY = H * 0.22;
  ctx.save();
  ctx.font = 'bold 42px "Noto Serif SC", serif';
  ctx.fillStyle = '#ffd700';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 20;
  ctx.fillText('封印飞刃', W / 2, titleY);

  ctx.shadowBlur = 0;
  ctx.font = '16px "Noto Serif SC", serif';
  ctx.fillStyle = 'rgba(200,180,140,0.7)';
  ctx.fillText("Melo's Quest 9: Seal Blade", W / 2, titleY + 40);
  ctx.restore();

  // Animated blade in center
  const bladeY = H * 0.42;
  const wobble = Math.sin(titleTime * 2) * 5;
  ctx.save();
  ctx.translate(W / 2, bladeY + wobble);
  ctx.rotate(Math.sin(titleTime * 1.5) * 0.1);

  ctx.fillStyle = '#e8c547';
  ctx.shadowColor = '#e8c547';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.moveTo(0, -40);
  ctx.lineTo(-8, 10);
  ctx.lineTo(0, 5);
  ctx.lineTo(8, 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8b6914';
  ctx.fillRect(-4, 10, 8, 14);
  ctx.fillStyle = '#ff4444';
  ctx.fillRect(-1.5, 24, 3, 16);
  ctx.restore();

  // Rotating seal circle
  ctx.save();
  ctx.translate(W / 2, bladeY);
  ctx.rotate(titleTime * 0.3);
  ctx.strokeStyle = 'rgba(255,215,0,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 70, 0, Math.PI * 2);
  ctx.stroke();
  const sealChars = ['封', '印', '镇', '锁', '灭', '禁', '缚', '定'];
  ctx.font = '12px "Noto Serif SC", serif';
  ctx.fillStyle = 'rgba(255,215,0,0.25)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < sealChars.length; i++) {
    const a = (Math.PI * 2 * i) / sealChars.length;
    ctx.fillText(sealChars[i], Math.cos(a) * 70, Math.sin(a) * 70);
  }
  ctx.restore();

  // Start button
  const btnY = H * 0.65;
  const pulse = Math.sin(titleTime * 3) * 0.1 + 0.9;
  ctx.save();
  ctx.globalAlpha = pulse;
  drawChineseFrame(W / 2 - 80, btnY - 22, 160, 44, '#c8a850', 2);
  ctx.fillStyle = 'rgba(30,20,10,0.7)';
  drawRoundRect(W / 2 - 78, btnY - 20, 156, 40, 4);
  ctx.fill();
  ctx.font = 'bold 20px "Noto Serif SC", serif';
  ctx.fillStyle = '#ffd700';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('开始封印', W / 2, btnY);
  ctx.restore();

  // Endless mode button
  const endBtnY = btnY + 60;
  ctx.save();
  ctx.globalAlpha = 0.7;
  drawChineseFrame(W / 2 - 70, endBtnY - 18, 140, 36, '#8a7a50', 1.5);
  ctx.fillStyle = 'rgba(30,20,10,0.5)';
  drawRoundRect(W / 2 - 68, endBtnY - 16, 136, 32, 4);
  ctx.fill();
  ctx.font = '16px "Noto Serif SC", serif';
  ctx.fillStyle = '#c8a850';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('无尽模式', W / 2, endBtnY);
  ctx.restore();

  // Shop button
  const shopBtnY = endBtnY + 55;
  ctx.save();
  ctx.globalAlpha = 0.6;
  drawChineseFrame(W / 2 - 55, shopBtnY - 15, 110, 30, '#6a8a50', 1.5);
  ctx.fillStyle = 'rgba(20,30,10,0.5)';
  drawRoundRect(W / 2 - 53, shopBtnY - 13, 106, 26, 4);
  ctx.fill();
  ctx.font = '14px "Noto Serif SC", serif';
  ctx.fillStyle = '#a0c880';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('兵器铺', W / 2, shopBtnY);
  ctx.restore();

  // Achievement stamps
  if (achievements.length > 0) {
    drawAchievementStamps();
  }

  // Passport name
  if (passport) {
    ctx.font = '14px "Noto Serif SC", serif';
    ctx.fillStyle = 'rgba(200,180,140,0.5)';
    ctx.textAlign = 'center';
    ctx.fillText(`道友: ${passport.name}`, W / 2, H - 60);
  }

  ctx.font = '11px "Noto Serif SC", serif';
  ctx.fillStyle = 'rgba(150,150,150,0.3)';
  ctx.textAlign = 'center';
  ctx.fillText('麦洛的冒险 第九章', W / 2, H - 30);
}

function drawNicknameSelect(): void {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0a0a1a');
  grad.addColorStop(1, '#0a0a0e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  drawBgSpirits();

  ctx.font = 'bold 24px "Noto Serif SC", serif';
  ctx.fillStyle = '#ffd700';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('选择道号', W / 2, 100);

  ctx.font = '14px "Noto Serif SC", serif';
  ctx.fillStyle = 'rgba(200,180,140,0.6)';
  ctx.fillText('Choose your Dao name', W / 2, 130);

  const cols = 2;
  const cellW = 140;
  const cellH = 50;
  const startX = (W - cols * cellW - 20) / 2;
  const startY = 180;

  for (let i = 0; i < NICKNAME_PRESETS.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = startX + col * (cellW + 20) + cellW / 2;
    const cy = startY + row * (cellH + 15) + cellH / 2;
    const selected = i === selectedNickname;

    ctx.save();
    if (selected) {
      drawChineseFrame(cx - cellW / 2, cy - cellH / 2, cellW, cellH, '#ffd700', 2);
      ctx.fillStyle = 'rgba(60,40,10,0.6)';
    } else {
      drawChineseFrame(cx - cellW / 2, cy - cellH / 2, cellW, cellH, '#6a6040', 1);
      ctx.fillStyle = 'rgba(30,20,10,0.4)';
    }
    drawRoundRect(cx - cellW / 2 + 2, cy - cellH / 2 + 2, cellW - 4, cellH - 4, 3);
    ctx.fill();

    ctx.font = `bold ${selected ? 20 : 18}px "Noto Serif SC", serif`;
    ctx.fillStyle = selected ? '#ffd700' : '#c8a850';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(NICKNAME_PRESETS[i], cx, cy);
    ctx.restore();
  }

  // Confirm button
  const btnY = startY + Math.ceil(NICKNAME_PRESETS.length / cols) * (cellH + 15) + 30;
  ctx.save();
  drawChineseFrame(W / 2 - 60, btnY - 18, 120, 36, '#c8a850', 2);
  ctx.fillStyle = 'rgba(40,30,10,0.7)';
  drawRoundRect(W / 2 - 58, btnY - 16, 116, 32, 4);
  ctx.fill();
  ctx.font = 'bold 18px "Noto Serif SC", serif';
  ctx.fillStyle = '#ffd700';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('确认', W / 2, btnY);
  ctx.restore();
}

function drawChapterSelect(): void {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0a0a1a');
  grad.addColorStop(1, '#0a0a0e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  drawBgSpirits();

  ctx.font = 'bold 22px "Noto Serif SC", serif';
  ctx.fillStyle = '#ffd700';
  ctx.textAlign = 'center';
  ctx.fillText('选择篇章', W / 2, 60);

  const cardH = 120;
  const cardW = W - 60;
  const startY = 100;

  for (let ci = 0; ci < chapters.length; ci++) {
    const ch = chapters[ci];
    const cy = startY + ci * (cardH + 15);
    const isUnlocked = ci === 0 || (chapterProgress[ci - 1] && chapterProgress[ci - 1].every(s => s));
    const stagesDone = chapterProgress[ci] ? chapterProgress[ci].filter(s => s).length : 0;

    ctx.save();
    ctx.globalAlpha = isUnlocked ? 1 : 0.35;

    const cardGrad = ctx.createLinearGradient(30, cy, 30 + cardW, cy);
    cardGrad.addColorStop(0, ch.bgColor1);
    cardGrad.addColorStop(1, ch.bgColor2);
    drawRoundRect(30, cy, cardW, cardH, 6);
    ctx.fillStyle = cardGrad;
    ctx.fill();

    drawChineseFrame(30, cy, cardW, cardH, ch.accentColor + '80', 1.5);

    ctx.font = 'bold 26px "Noto Serif SC", serif';
    ctx.fillStyle = ch.accentColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`第${ci + 1}章 · ${ch.name}`, 50, cy + 15);

    ctx.font = '13px "Noto Serif SC", serif';
    ctx.fillStyle = 'rgba(200,200,200,0.6)';
    ctx.fillText(ch.theme, 50, cy + 48);

    // Progress dots
    const dotY = cy + 80;
    for (let si = 0; si < ch.stages.length; si++) {
      const dx = 50 + si * 22;
      const done = chapterProgress[ci] && chapterProgress[ci][si];
      ctx.beginPath();
      ctx.arc(dx, dotY, 6, 0, Math.PI * 2);
      ctx.fillStyle = done ? ch.accentColor : 'rgba(100,100,100,0.5)';
      ctx.fill();
      if (si === ch.stages.length - 1) {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    ctx.font = '11px "Noto Serif SC", serif';
    ctx.fillStyle = 'rgba(200,200,200,0.5)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${stagesDone}/${ch.stages.length}`, 30 + cardW - 15, dotY);

    if (!isUnlocked) {
      ctx.font = '20px "Noto Serif SC", serif';
      ctx.fillStyle = 'rgba(200,200,200,0.5)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('锁', 30 + cardW - 30, cy + cardH / 2);
    }

    ctx.restore();
  }

  // Back button
  ctx.save();
  ctx.font = '16px "Noto Serif SC", serif';
  ctx.fillStyle = '#c8a850';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('< 返回', 20, H - 40);
  ctx.restore();
}

function drawStageIntro(): void {
  drawBackground();
  drawBgSpirits();

  if (!currentBoss) return;

  const progress = Math.min(introTimer / 2.5, 1);
  const ch = chapters[Math.min(currentChapter, chapters.length - 1)];

  // Boss reveal
  ctx.save();
  ctx.globalAlpha = Math.min(progress * 2, 1);
  ctx.translate(TARGET_CENTER_X, TARGET_CENTER_Y);
  const revealScale = 0.5 + progress * 0.5;
  ctx.scale(revealScale, revealScale);
  drawBossBody(currentBoss);
  drawBossEyes(currentBoss);
  ctx.restore();

  // Stage text
  if (progress > 0.3) {
    const textAlpha = Math.min((progress - 0.3) * 3, 1);
    ctx.save();
    ctx.globalAlpha = textAlpha;

    if (!endlessActive) {
      ctx.font = '14px "Noto Serif SC", serif';
      ctx.fillStyle = ch.accentColor;
      ctx.textAlign = 'center';
      ctx.fillText(`第${currentChapter + 1}章 · ${ch.name}`, W / 2, TARGET_CENTER_Y + TARGET_RADIUS + 60);

      ctx.font = 'bold 18px "Noto Serif SC", serif';
      ctx.fillStyle = '#e0d0a0';
      ctx.fillText(`第${currentStage + 1}关`, W / 2, TARGET_CENTER_Y + TARGET_RADIUS + 85);
    } else {
      ctx.font = 'bold 18px "Noto Serif SC", serif';
      ctx.fillStyle = '#e0d0a0';
      ctx.textAlign = 'center';
      ctx.fillText(`无尽 · 第${endlessWave}波`, W / 2, TARGET_CENTER_Y + TARGET_RADIUS + 70);

      // Show speed multiplier for endless mode
      ctx.font = '13px "Noto Serif SC", serif';
      ctx.fillStyle = endlessSpeedMultiplier > 1.5 ? '#ff6b35' : '#c8a850';
      ctx.fillText(`速度 x${endlessSpeedMultiplier.toFixed(1)}`, W / 2, TARGET_CENTER_Y + TARGET_RADIUS + 92);

      if (endlessRandomPatternActive) {
        ctx.font = '12px "Noto Serif SC", serif';
        ctx.fillStyle = '#ce93d8';
        ctx.fillText('随机组合模式', W / 2, TARGET_CENTER_Y + TARGET_RADIUS + 108);
      }
    }

    ctx.font = 'bold 28px "Noto Serif SC", serif';
    ctx.fillStyle = currentBoss.eyeColor;
    ctx.shadowColor = currentBoss.eyeColor;
    ctx.shadowBlur = 15;
    ctx.fillText(currentBoss.name, W / 2, TARGET_CENTER_Y + TARGET_RADIUS + 120);

    ctx.restore();
  }

  if (progress > 0.6) {
    ctx.save();
    ctx.globalAlpha = Math.min((progress - 0.6) * 4, 1);
    ctx.font = '15px "Noto Serif SC", serif';
    ctx.fillStyle = '#c8a850';
    ctx.textAlign = 'center';
    ctx.fillText(`需要封印 ${currentBoss.bladesNeeded} 刃`, W / 2, TARGET_CENTER_Y + TARGET_RADIUS + 155);
    ctx.restore();
  }
}

function drawPlayingScreen(): void {
  drawBackground();

  // Screen shake
  let shakeApplied = false;
  if (screenShakeTimer > 0) {
    const shake = screenShakeIntensity * (screenShakeTimer / 0.3);
    ctx.save();
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    shakeApplied = true;
  }

  drawBgSpirits();
  drawBoss();
  drawFlyingBlades();
  drawParticles();
  drawPowerUps();
  drawFloatingTexts();

  if (shakeApplied) {
    ctx.restore();
  }

  // Flash overlay
  if (flashTimer > 0 && flashColor) {
    ctx.save();
    ctx.globalAlpha = flashTimer / 0.15;
    ctx.fillStyle = flashColor;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // UI
  drawHP();
  drawScore();
  drawBladesRemaining();
  drawBladeSelector();
  drawChargeIndicator();

  // Chapter/stage info
  if (!endlessActive) {
    ctx.font = '12px "Noto Serif SC", serif';
    ctx.fillStyle = 'rgba(200,180,140,0.4)';
    ctx.textAlign = 'center';
    ctx.fillText(`${chapters[currentChapter].name} · ${currentStage + 1}/${chapters[currentChapter].stages.length}`, W / 2, 50);
  } else {
    ctx.font = '12px "Noto Serif SC", serif';
    ctx.fillStyle = 'rgba(200,180,140,0.4)';
    ctx.textAlign = 'center';
    ctx.fillText(`无尽 · 第${endlessWave}波`, W / 2, 50);
  }
}

function drawStageClear(): void {
  drawBackground();

  // Golden flash overlay for boss defeat
  if (goldenFlashTimer > 0) {
    ctx.save();
    ctx.globalAlpha = goldenFlashTimer / 0.4 * 0.6;
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  drawBgSpirits();
  drawParticles();
  drawPowerUps();
  drawFloatingTexts();
  drawConfetti();

  const progress = Math.min(clearTimer / 3.0, 1);

  // Boss defeat calligraphy text "封印完成!"
  if (bossDefeatCelebrationTimer > 0 && calligraphyAlpha > 0) {
    ctx.save();
    const cScale = 0.5 + calligraphyScale * 0.5;
    ctx.globalAlpha = calligraphyAlpha * Math.min(bossDefeatCelebrationTimer, 1);
    ctx.translate(W / 2, H * 0.15);
    ctx.scale(cScale, cScale);

    // Calligraphy style text with brush stroke feel
    ctx.font = 'bold 44px "Noto Serif SC", serif';
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 25;
    ctx.fillText('封印完成!', 0, 0);
    ctx.shadowBlur = 0;

    // Decorative underline
    ctx.strokeStyle = '#ffd70080';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-100, 30);
    ctx.lineTo(100, 30);
    ctx.stroke();

    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = Math.min(progress * 3, 1);

  ctx.font = 'bold 36px "Noto Serif SC", serif';
  ctx.fillStyle = '#ffd700';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 20;
  ctx.fillText('封印成功', W / 2, H * 0.25);
  ctx.shadowBlur = 0;

  if (currentBoss) {
    ctx.font = '18px "Noto Serif SC", serif';
    ctx.fillStyle = '#e0d0a0';
    ctx.fillText(`${currentBoss.name} 已被封印`, W / 2, H * 0.32);
  }
  ctx.restore();

  // Stats
  if (progress > 0.3) {
    const statsAlpha = Math.min((progress - 0.3) * 3, 1);
    ctx.save();
    ctx.globalAlpha = statsAlpha;

    const statsY = H * 0.42;

    drawChineseFrame(60, statsY - 10, W - 120, 160, '#c8a850', 1.5);
    ctx.fillStyle = 'rgba(20,15,10,0.7)';
    drawRoundRect(62, statsY - 8, W - 124, 156, 4);
    ctx.fill();

    ctx.font = '15px "Noto Serif SC", serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#c8a850';
    const lines = [
      `得分: ${score}`,
      `最大连击: ${maxCombo}`,
      `命中率: ${totalBladesThrown > 0 ? Math.floor(totalBladesHit / totalBladesThrown * 100) : 0}%`,
      `剩余飞刃: ${bladesRemaining}`,
    ];
    lines.forEach((line, i) => {
      ctx.fillText(line, W / 2, statsY + 20 + i * 32);
    });

    ctx.restore();
  }

  // Continue button
  if (progress > 0.8) {
    ctx.save();
    ctx.globalAlpha = Math.min((progress - 0.8) * 5, 1);
    const btnY = H * 0.78;
    drawChineseFrame(W / 2 - 70, btnY - 20, 140, 40, '#c8a850', 2);
    ctx.fillStyle = 'rgba(40,30,10,0.7)';
    drawRoundRect(W / 2 - 68, btnY - 18, 136, 36, 4);
    ctx.fill();
    ctx.font = 'bold 18px "Noto Serif SC", serif';
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('继续', W / 2, btnY);
    ctx.restore();
  }
}

function drawGameOver(): void {
  drawBackground();
  drawBgSpirits();
  drawParticles();
  drawFloatingTexts();

  const progress = Math.min(gameOverTimer / 2.0, 1);

  ctx.fillStyle = `rgba(0,0,0,${progress * 0.5})`;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = Math.min(progress * 2, 1);

  ctx.font = 'bold 36px "Noto Serif SC", serif';
  ctx.fillStyle = '#ff4444';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#ff4444';
  ctx.shadowBlur = 15;
  ctx.fillText('封印失败', W / 2, H * 0.28);
  ctx.shadowBlur = 0;

  ctx.font = '16px "Noto Serif SC", serif';
  ctx.fillStyle = '#e0a0a0';
  ctx.fillText('飞刃耗尽...', W / 2, H * 0.35);

  ctx.font = 'bold 22px "Noto Serif SC", serif';
  ctx.fillStyle = '#ffd700';
  ctx.fillText(`得分: ${score}`, W / 2, H * 0.45);

  ctx.font = '15px "Noto Serif SC", serif';
  ctx.fillStyle = '#c8a850';
  ctx.fillText(`最大连击: ${maxCombo}`, W / 2, H * 0.52);

  ctx.restore();

  // Buttons
  if (progress > 0.6) {
    ctx.save();
    ctx.globalAlpha = Math.min((progress - 0.6) * 3, 1);

    const retryY = H * 0.65;
    drawChineseFrame(W / 2 - 70, retryY - 20, 140, 40, '#c8a850', 2);
    ctx.fillStyle = 'rgba(40,30,10,0.7)';
    drawRoundRect(W / 2 - 68, retryY - 18, 136, 36, 4);
    ctx.fill();
    ctx.font = 'bold 18px "Noto Serif SC", serif';
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('重新封印', W / 2, retryY);

    const backY = retryY + 55;
    drawChineseFrame(W / 2 - 60, backY - 16, 120, 32, '#8a7a50', 1.5);
    ctx.fillStyle = 'rgba(30,20,10,0.5)';
    drawRoundRect(W / 2 - 58, backY - 14, 116, 28, 4);
    ctx.fill();
    ctx.font = '15px "Noto Serif SC", serif';
    ctx.fillStyle = '#c8a850';
    ctx.fillText('返回', W / 2, backY);

    // Share card button
    const shareY = backY + 50;
    drawChineseFrame(W / 2 - 50, shareY - 14, 100, 28, '#6a8a50', 1.5);
    ctx.fillStyle = 'rgba(20,30,10,0.5)';
    drawRoundRect(W / 2 - 48, shareY - 12, 96, 24, 4);
    ctx.fill();
    ctx.font = '13px "Noto Serif SC", serif';
    ctx.fillStyle = '#a0c880';
    ctx.fillText('分享战绩', W / 2, shareY);

    ctx.restore();
  }

  // Draw share card if visible
  if (shareCardAlpha > 0) {
    drawShareCard();
  }
}

function drawPausedOverlay(): void {
  drawPlayingScreen();

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);

  ctx.font = 'bold 32px "Noto Serif SC", serif';
  ctx.fillStyle = '#ffd700';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('暂停', W / 2, H * 0.35);

  ctx.font = '16px "Noto Serif SC", serif';
  ctx.fillStyle = '#c8a850';
  ctx.fillText('点击继续键继续', W / 2, H * 0.42);

  const resumeY = H * 0.55;
  drawChineseFrame(W / 2 - 70, resumeY - 20, 140, 40, '#c8a850', 2);
  ctx.fillStyle = 'rgba(40,30,10,0.7)';
  drawRoundRect(W / 2 - 68, resumeY - 18, 136, 36, 4);
  ctx.fill();
  ctx.font = 'bold 18px "Noto Serif SC", serif';
  ctx.fillStyle = '#ffd700';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('继续', W / 2, resumeY);

  const backY = resumeY + 55;
  drawChineseFrame(W / 2 - 60, backY - 16, 120, 32, '#8a7a50', 1.5);
  ctx.fillStyle = 'rgba(30,20,10,0.5)';
  drawRoundRect(W / 2 - 58, backY - 14, 116, 28, 4);
  ctx.fill();
  ctx.font = '15px "Noto Serif SC", serif';
  ctx.fillStyle = '#c8a850';
  ctx.fillText('返回主页', W / 2, backY);
}

// ---------------------------------------------------------------------------
// 19. Main Draw
// ---------------------------------------------------------------------------

function draw(): void {
  ctx.clearRect(0, 0, W, H);

  switch (state) {
    case GameState.Title:
      drawTitleScreen();
      break;
    case GameState.NicknameSelect:
      drawNicknameSelect();
      break;
    case GameState.ChapterSelect:
      drawChapterSelect();
      break;
    case GameState.StageIntro:
      drawStageIntro();
      break;
    case GameState.Playing:
      drawPlayingScreen();
      break;
    case GameState.StageClear:
      drawStageClear();
      break;
    case GameState.GameOver:
      drawGameOver();
      break;
    case GameState.Paused:
      drawPausedOverlay();
      break;
    case GameState.Tutorial:
      drawTutorialOverlay();
      break;
    case GameState.BladeShop:
      drawBladeShop();
      break;
  }

  // Always draw pause/mute buttons when in game
  if (state === GameState.Playing || state === GameState.Paused) {
    drawPauseButton();
    drawMuteButton();
  } else if (state === GameState.Title) {
    drawMuteButton();
  }

  // Achievement popup overlay (always on top)
  drawAchievementPopup();

  // Slow motion visual indicator
  if (slowMotion.active) {
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // Edge vignette
    ctx.save();
    const vigGrad = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.7);
    vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vigGrad.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// 20. Input Handling
// ---------------------------------------------------------------------------

function getCanvasPos(clientX: number, clientY: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / rect.width * W,
    y: (clientY - rect.top) / rect.height * H,
  };
}

function isInBounds(x: number, y: number, bounds: { x: number; y: number; w: number; h: number }): boolean {
  return x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h;
}

function handleTouchStart(x: number, y: number): void {
  audio.init();

  // Mute button
  if (state === GameState.Title || state === GameState.Playing || state === GameState.Paused) {
    if (isInBounds(x, y, muteButtonBounds)) {
      audio.toggleMute();
      audio.playMenuTap();
      return;
    }
  }

  // Pause button
  if (state === GameState.Playing) {
    if (isInBounds(x, y, pauseButtonBounds)) {
      prevState = state;
      state = GameState.Paused;
      savePauseState(true);
      audio.playMenuTap();
      return;
    }
  }

  switch (state) {
    case GameState.Title:
      handleTitleTouch(x, y);
      break;
    case GameState.NicknameSelect:
      handleNicknameTouch(x, y);
      break;
    case GameState.ChapterSelect:
      handleChapterTouch(x, y);
      break;
    case GameState.Playing:
      handlePlayingTouchStart(x, y);
      break;
    case GameState.StageClear:
      handleStageClearTouch(x, y);
      break;
    case GameState.GameOver:
      handleGameOverTouch(x, y);
      break;
    case GameState.Paused:
      handlePausedTouch(x, y);
      break;
    case GameState.Tutorial:
      handleTutorialTouch(x, y);
      break;
    case GameState.BladeShop:
      handleShopTouch(x, y);
      break;
  }
}

function handleTouchEnd(): void {
  if (isCharging && state === GameState.Playing) {
    if (chargeTime >= chargeMaxTime) {
      for (let t = 1; t <= 4; t++) {
        if (specialBladeInventory[t] > 0) {
          currentBladeType = t as BladeType;
          audio.playPowerUp();
          break;
        }
      }
    }
    isCharging = false;
    chargeTime = 0;
  }
  if (longPressTimer !== null) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

function handleTitleTouch(x: number, y: number): void {
  const btnY = H * 0.65;
  if (x > W / 2 - 80 && x < W / 2 + 80 && y > btnY - 22 && y < btnY + 22) {
    audio.playMenuTap();
    if (!passport) {
      state = GameState.NicknameSelect;
    } else {
      // Show tutorial for first-time players
      if (!tutorialShown) {
        tutorialStep = 0;
        tutorialTimer = 0;
        tutorialAlpha = 0;
        state = GameState.Tutorial;
      } else {
        state = GameState.ChapterSelect;
      }
    }
    return;
  }

  const endBtnY = btnY + 60;
  if (x > W / 2 - 70 && x < W / 2 + 70 && y > endBtnY - 18 && y < endBtnY + 18) {
    audio.playMenuTap();
    if (!passport) {
      state = GameState.NicknameSelect;
      return;
    }
    // Check if story is completed for endless mode access
    const allDone = chapterProgress.every(ch => ch.every(s => s));
    if (!allDone) {
      addFloatingText(W / 2, endBtnY - 30, '通关后解锁', '#ff6b35', 14);
      return;
    }
    score = 0;
    endlessWave = 0;
    endlessActive = true;
    startEndlessWave();
    return;
  }

  // Shop button
  const shopBtnY = endBtnY + 55;
  if (x > W / 2 - 55 && x < W / 2 + 55 && y > shopBtnY - 15 && y < shopBtnY + 15) {
    audio.playMenuTap();
    shopScrollY = 0;
    selectedSkinIndex = equippedSkinIndex;
    state = GameState.BladeShop;
    return;
  }
}

function handleNicknameTouch(x: number, y: number): void {
  const cols = 2;
  const cellW = 140;
  const cellH = 50;
  const startX = (W - cols * cellW - 20) / 2;
  const startY = 180;

  for (let i = 0; i < NICKNAME_PRESETS.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = startX + col * (cellW + 20);
    const cy = startY + row * (cellH + 15);
    if (x >= cx && x <= cx + cellW && y >= cy && y <= cy + cellH) {
      selectedNickname = i;
      audio.playMenuTap();
      return;
    }
  }

  const btnY = startY + Math.ceil(NICKNAME_PRESETS.length / cols) * (cellH + 15) + 30;
  if (x > W / 2 - 60 && x < W / 2 + 60 && y > btnY - 18 && y < btnY + 18) {
    audio.playMenuTap();
    passport = {
      name: NICKNAME_PRESETS[selectedNickname],
      avatar: '',
      gamesPlayed: 0,
      completedGames: [],
      currentStreak: 0,
      totalScore: 0,
      lastPlayed: new Date().toISOString().slice(0, 10),
    };
    savePassport();
    state = GameState.ChapterSelect;
  }
}

function handleChapterTouch(x: number, y: number): void {
  const cardH = 120;
  const startY = 100;

  if (x < 100 && y > H - 60) {
    audio.playMenuTap();
    state = GameState.Title;
    return;
  }

  for (let ci = 0; ci < chapters.length; ci++) {
    const cy = startY + ci * (cardH + 15);
    const isUnlocked = ci === 0 || (chapterProgress[ci - 1] && chapterProgress[ci - 1].every(s => s));
    if (!isUnlocked) continue;

    if (x >= 30 && x <= W - 30 && y >= cy && y <= cy + cardH) {
      audio.playMenuTap();
      const firstIncomplete = chapterProgress[ci] ? chapterProgress[ci].findIndex(s => !s) : 0;
      const stageIdx = firstIncomplete >= 0 ? firstIncomplete : 0;
      score = 0;
      startStage(ci, stageIdx);
      return;
    }
  }
}

function handlePlayingTouchStart(x: number, y: number): void {
  // Blade selector
  const selectorY = BLADE_LAUNCH_Y - 50;
  const types: BladeType[] = [BladeType.FuDao, BladeType.LeiBlade, BladeType.BingBlade, BladeType.HuoBlade, BladeType.JinBlade];
  const totalSelectorW = types.length * 44;
  const startX = (W - totalSelectorW) / 2;

  for (let i = 0; i < types.length; i++) {
    const bx = startX + i * 44 + 22;
    const by = selectorY;
    if (Math.abs(x - bx) < 20 && Math.abs(y - by) < 20) {
      const available = i === 0 || specialBladeInventory[types[i]] > 0;
      if (available) {
        currentBladeType = types[i];
        audio.playMenuTap();
      }
      return;
    }
  }

  // Power-up collection
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const pu = powerUps[i];
    if (Math.abs(x - pu.x) < 25 && Math.abs(y - pu.y) < 25) {
      collectPowerUp(pu);
      powerUps.splice(i, 1);
      return;
    }
  }

  // Double tap detection
  const now = performance.now();
  const isDoubleTap = (now - lastTapTime) < 300;
  lastTapTime = now;

  if (isDoubleTap) {
    throwBlade();
    return;
  }

  // Long press detection
  longPressTimer = window.setTimeout(() => {
    isCharging = true;
    chargeTime = 0;
    audio.playSpecialCharge();
    longPressTimer = null;
  }, 250);

  // Normal throw
  throwBlade();
}

function handleStageClearTouch(x: number, y: number): void {
  if (clearTimer < 2.4) return;

  for (let i = powerUps.length - 1; i >= 0; i--) {
    const pu = powerUps[i];
    if (Math.abs(x - pu.x) < 25 && Math.abs(y - pu.y) < 25) {
      collectPowerUp(pu);
      powerUps.splice(i, 1);
      return;
    }
  }

  const btnY = H * 0.78;
  if (x > W / 2 - 70 && x < W / 2 + 70 && y > btnY - 20 && y < btnY + 20) {
    audio.playMenuTap();

    if (endlessActive) {
      startEndlessWave();
      return;
    }

    if (currentStage < chapters[currentChapter].stages.length - 1) {
      startStage(currentChapter, currentStage + 1);
    } else if (currentChapter < chapters.length - 1) {
      audio.playChapterTransition();
      startStage(currentChapter + 1, 0);
    } else {
      state = GameState.Title;
      audio.stopBGM();
    }
    return;
  }
}

function handleGameOverTouch(x: number, y: number): void {
  if (gameOverTimer < 1.2) return;

  // Close share card if visible
  if (shareCardVisible) {
    shareCardVisible = false;
    return;
  }

  // Check share button
  if (handleGameOverShareTouch(x, y)) return;

  const retryY = H * 0.65;
  if (x > W / 2 - 70 && x < W / 2 + 70 && y > retryY - 20 && y < retryY + 20) {
    audio.playMenuTap();
    score = 0;
    if (endlessActive) {
      endlessWave = 0;
      startEndlessWave();
    } else {
      startStage(currentChapter, currentStage);
    }
    return;
  }

  const backY = retryY + 55;
  if (x > W / 2 - 60 && x < W / 2 + 60 && y > backY - 16 && y < backY + 16) {
    audio.playMenuTap();
    audio.stopBGM();
    state = GameState.Title;
    return;
  }
}

function handlePausedTouch(x: number, y: number): void {
  if (isInBounds(x, y, pauseButtonBounds)) {
    state = GameState.Playing;
    savePauseState(false);
    audio.playMenuTap();
    return;
  }

  const resumeY = H * 0.55;
  if (x > W / 2 - 70 && x < W / 2 + 70 && y > resumeY - 20 && y < resumeY + 20) {
    state = GameState.Playing;
    savePauseState(false);
    audio.playMenuTap();
    return;
  }

  const backY = resumeY + 55;
  if (x > W / 2 - 60 && x < W / 2 + 60 && y > backY - 16 && y < backY + 16) {
    audio.playMenuTap();
    audio.stopBGM();
    state = GameState.Title;
    savePauseState(false);
    return;
  }
}

function handleTutorialTouch(x: number, y: number): void {
  // Skip button
  if (x > W - 100 && y > H - 60) {
    audio.playMenuTap();
    tutorialShown = true;
    saveTutorialState();
    state = GameState.ChapterSelect;
    return;
  }

  // Advance to next step
  audio.playMenuTap();
  tutorialStep++;
  tutorialTimer = 0;
  if (tutorialStep >= TUTORIAL_STEPS.length) {
    tutorialShown = true;
    saveTutorialState();
    state = GameState.ChapterSelect;
  }
}

function handleShopTouch(x: number, y: number): void {
  // Back button
  if (x < 100 && y > H - 60) {
    audio.playMenuTap();
    state = GameState.Title;
    return;
  }

  // Blade skin cards
  const cardH = 70;
  const cardW = W - 60;
  const startY = 85;

  for (let i = 0; i < BLADE_SKINS.length; i++) {
    const cy = startY + i * (cardH + 10) - shopScrollY;
    if (cy < 60 || cy > H - 60) continue;

    if (x >= 30 && x <= 30 + cardW && y >= cy && y <= cy + cardH) {
      selectedSkinIndex = i;
      const skin = BLADE_SKINS[i];

      // Check if tapping action button area (right side)
      if (x > cardW - 30) {
        if (skin.unlocked && i !== equippedSkinIndex) {
          equipSkin(i);
          audio.playPowerUp();
        } else if (!skin.unlocked) {
          if (purchaseSkin(i)) {
            audio.playPowerUp();
            addFloatingText(W / 2, cy + cardH / 2, '购买成功!', '#ffd700', 18);
          } else {
            addFloatingText(W / 2, cy + cardH / 2, '金币不足', '#ff4444', 14);
          }
        }
      } else {
        audio.playMenuTap();
      }
      return;
    }
  }
}

function handleGameOverShareTouch(x: number, y: number): boolean {
  // Check share button
  const retryY = H * 0.65;
  const backY = retryY + 55;
  const shareY = backY + 50;
  if (x > W / 2 - 50 && x < W / 2 + 50 && y > shareY - 14 && y < shareY + 14) {
    audio.playMenuTap();
    shareCardVisible = true;
    shareCardAlpha = 0;
    return true;
  }
  return false;
}

// Event listeners
canvas.addEventListener('touchstart', (e: TouchEvent) => {
  e.preventDefault();
  const touch = e.touches[0];
  const pos = getCanvasPos(touch.clientX, touch.clientY);
  handleTouchStart(pos.x, pos.y);
}, { passive: false });

canvas.addEventListener('touchend', (e: TouchEvent) => {
  e.preventDefault();
  handleTouchEnd();
}, { passive: false });

canvas.addEventListener('mousedown', (e: MouseEvent) => {
  const pos = getCanvasPos(e.clientX, e.clientY);
  handleTouchStart(pos.x, pos.y);
});

canvas.addEventListener('mouseup', () => {
  handleTouchEnd();
});

// Keyboard support
window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    audio.init();
    if (state === GameState.Playing) {
      throwBlade();
    } else if (state === GameState.Title) {
      handleTitleTouch(W / 2, H * 0.65);
    }
  }
  if (e.code === 'Escape') {
    if (state === GameState.Playing) {
      prevState = state;
      state = GameState.Paused;
      savePauseState(true);
    } else if (state === GameState.Paused) {
      state = GameState.Playing;
      savePauseState(false);
    }
  }
  if (e.code >= 'Digit1' && e.code <= 'Digit5' && state === GameState.Playing) {
    const idx = parseInt(e.code.charAt(5)) - 1;
    if (idx === 0 || specialBladeInventory[idx] > 0) {
      currentBladeType = idx as BladeType;
    }
  }
  if (e.code === 'KeyM') {
    audio.init();
    audio.toggleMute();
  }
});

// ---------------------------------------------------------------------------
// 21. Game Loop
// ---------------------------------------------------------------------------

function gameLoop(timestamp: number): void {
  if (lastTime === 0) lastTime = timestamp;
  const rawDt = (timestamp - lastTime) / 1000;
  const dt = Math.min(rawDt, 1 / 30);
  lastTime = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(gameLoop);
}

// ---------------------------------------------------------------------------
// 22. Initialization
// ---------------------------------------------------------------------------

function init(): void {
  loadPassport();
  loadProgress();
  loadAchievements();
  loadShopData();
  loadTutorialState();
  audio.loadMuteState();
  initBgSpirits();

  state = GameState.Title;
  lastTime = 0;

  requestAnimationFrame(gameLoop);
}

init();
