// ============================================================================
// 麦洛的冒险7：水墨画疆 (Melo's Quest 7: Ink Territory)
// Territory Capture Game — Canvas 390×844
// ============================================================================

// ---------------------------------------------------------------------------
// 0. Constants & Types
// ---------------------------------------------------------------------------

const W = 390;
const H = 844;
const GRID_SIZE = 10; // Each cell is 10x10 pixels in world space
const ARENA_COLS = 80; // 800px wide world
const ARENA_ROWS = 80; // 800px tall world
const PARTICLE_CAP = 500;
const JOYSTICK_DEADZONE = 15;
const SHRINK_INTERVAL = 30000; // 30 seconds
const BOSS_LEVEL_INTERVAL = 5;

const enum Dir {
  None = 0,
  Up = 1,
  Down = 2,
  Left = 3,
  Right = 4,
}

const enum GamePhase {
  Title = 0,
  Nickname = 1,
  ArenaSelect = 2,
  Playing = 3,
  Paused = 4,
  GameOver = 5,
  Victory = 6,
  LevelTransition = 7,
}

const enum PowerUpType {
  Shield = 0,    // 墨龙护身
  Speed = 1,     // 疾风步
  Invis = 2,     // 隐身墨
  Bomb = 3,      // 领地爆破
}

const enum AIPersonality {
  Cautious = 0,
  Aggressive = 1,
  Hunter = 2,
}

interface Vec2 {
  x: number;
  y: number;
}

interface Cell {
  owner: number; // -1=unclaimed, 0=player, 1+=AI
  trail: number; // -1=none, owner of trail
}

interface Player {
  x: number;
  y: number;
  dir: Dir;
  nextDir: Dir;
  speed: number;
  baseSpeed: number;
  alive: boolean;
  trail: Vec2[];
  territoryCount: number;
  color: string;
  trailColor: string;
  name: string;
  shieldTimer: number;
  speedTimer: number;
  invisTimer: number;
  kills: number;
  combos: number;
  maxCombo: number;
  respawnTimer: number;
  personality: AIPersonality;
  aiTimer: number;
  aiTargetDir: Dir;
  aiLoopSize: number;
  aiStepsInLoop: number;
  aiPhase: number; // 0=expanding, 1=returning
}

interface PowerUp {
  x: number;
  y: number;
  type: PowerUpType;
  timer: number;
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
  alpha: number;
  type: 'ink' | 'spark' | 'splash' | 'golden' | 'brush' | 'explosion';
  rot: number;
  vr: number;
}

interface BossEntity {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  name: string;
  attackTimer: number;
  moveTimer: number;
  dir: Dir;
  speed: number;
  size: number; // radius in cells
  ability: string;
  abilityTimer: number;
  trail: Vec2[];
  territoryCount: number;
  color: string;
  trailColor: string;
}

interface Arena {
  name: string;
  nameCN: string;
  bgColor: string;
  gridColor: string;
  territoryColors: string[];
  particleColor: string;
  description: string;
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

// Achievement (red seal stamp) definition
interface Achievement {
  id: string;
  nameCN: string;
  description: string;
  check: () => boolean;
  unlocked: boolean;
}

// Death ink explosion dissolving circle
interface DeathCircle {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
  speed: number;
}

// Ink splash animation for territory capture
interface InkSplashAnim {
  x: number;
  y: number;
  timer: number;
  maxTimer: number;
  color: string;
  particles: { angle: number; dist: number; size: number; speed: number }[];
}

// Combo text floating animation
interface ComboTextAnim {
  x: number;
  y: number;
  text: string;
  timer: number;
  maxTimer: number;
  color: string;
  size: number;
}

// Golden sparkle for power-up collection
interface GoldenSparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  twinklePhase: number;
}

// Tutorial step definition
interface TutorialStep {
  titleCN: string;
  descCN: string;
  icon: string;
}

// Share card data
interface ShareCardData {
  score: number;
  territoryPct: number;
  kills: number;
  level: number;
  time: string;
  nickname: string;
  arena: string;
  maxCombo: number;
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
// 2. Arenas
// ---------------------------------------------------------------------------

const ARENAS: Arena[] = [
  {
    name: 'Ink Pool', nameCN: '墨池',
    bgColor: '#0a0a16', gridColor: 'rgba(60,60,80,0.3)',
    territoryColors: ['#1a1a2e', '#16213e', '#0f3460', '#1a1a3e'],
    particleColor: '#4a4a7a', description: '静谧墨池，水墨氤氲',
  },
  {
    name: 'Cloud Sea', nameCN: '云海',
    bgColor: '#0e1225', gridColor: 'rgba(80,80,120,0.25)',
    territoryColors: ['#1c2541', '#3a506b', '#5bc0be', '#1c3f60'],
    particleColor: '#7fb3d3', description: '云海翻涌，仙气缭绕',
  },
  {
    name: 'Bamboo Forest', nameCN: '竹林',
    bgColor: '#0a120a', gridColor: 'rgba(60,90,60,0.3)',
    territoryColors: ['#1a2e1a', '#2d5a27', '#3e7a35', '#1e3e1a'],
    particleColor: '#6aaa5a', description: '修竹万竿，清风徐来',
  },
  {
    name: 'Volcano', nameCN: '火山',
    bgColor: '#160808', gridColor: 'rgba(100,50,30,0.3)',
    territoryColors: ['#2e1010', '#5a1a1a', '#8a2a0a', '#6a2020'],
    particleColor: '#ea6a3a', description: '烈焰焚天，熔岩奔流',
  },
  {
    name: 'Star Sky', nameCN: '星空',
    bgColor: '#05051a', gridColor: 'rgba(60,50,100,0.3)',
    territoryColors: ['#10102e', '#1a1050', '#2a1a6a', '#1e1040'],
    particleColor: '#aa8aff', description: '星河灿烂，银汉无声',
  },
];

const BOSS_NAMES = ['朱雀', '玄武', '青龙', '白虎', '麒麟'];
const BOSS_ABILITIES = ['火焰吐息', '玄武壁垒', '雷霆一击', '风刃斩', '圣光净化'];

// ---------------------------------------------------------------------------
// 3. State Variables
// ---------------------------------------------------------------------------

let phase: GamePhase = GamePhase.Title;

// Core game state
let grid: Cell[][] = [];
let player: Player;
let enemies: Player[] = [];
let powerUps: PowerUp[] = [];
let particles: Particle[] = [];
let boss: BossEntity | null = null;

// Camera
let camX = 0;
let camY = 0;

// Arena
let currentArena = 0;
let currentLevel = 1;
let arenaMinX = 0;
let arenaMinY = 0;
let arenaMaxX = ARENA_COLS;
let arenaMaxY = ARENA_ROWS;
let shrinkTimer = 0;
let totalCells = ARENA_COLS * ARENA_ROWS;

// Score
let score = 0;
let highScore = 0;
let territoryPercent = 0;
let survivalTime = 0;
let currentCombo = 0;
let comboTimer = 0;

// UI
let isMuted = false;
let isPaused = false;
let titleAlpha = 0;
let titleTimer = 0;
let transitionTimer = 0;
let transitionText = '';

// Joystick
let joystickActive = false;
let joystickOrigin: Vec2 = { x: 0, y: 0 };
let joystickCurrent: Vec2 = { x: 0, y: 0 };

// Passport
let passport: Passport | null = null;

// Achievement system
let achievements: Achievement[] = [];
let achievementPopup: { text: string; timer: number } | null = null;
let shieldUsedThisRound = false;
let aiTrappedInLoop = false;

// Enhanced visual effects
let deathCircles: DeathCircle[] = [];
let inkSplashAnims: InkSplashAnim[] = [];
let comboTextAnims: ComboTextAnim[] = [];
let goldenSparkles: GoldenSparkle[] = [];
let slowMoTimer = 0;
let slowMoFactor = 1.0;
let nearDeathWarning = false;

// Tutorial
let tutorialStep = -1; // -1 = not showing, 0-2 = steps
let tutorialShown = false;
let tutorialAlpha = 0;

// Share card
let shareCardCanvas: HTMLCanvasElement | null = null;
let showShareCard = false;

// Nickname
const NICKNAMES = ['墨竹先生', '云水居士', '青莲隐者', '幽兰仙子', '松风道人', '烟霞散人', '寒梅客', '溪山主人'];
let selectedNickname = 0;

// Color palette for players
const PLAYER_COLORS = ['#c83232', '#3264c8', '#32c864', '#c8a032', '#9632c8', '#32c8c8', '#c86432', '#6432c8'];
const PLAYER_TRAIL_COLORS = ['#ff5050', '#5080ff', '#50ff80', '#ffc850', '#c050ff', '#50ffff', '#ff8050', '#8050ff'];
const PLAYER_NAMES = ['麦洛', '墨蛟', '云蛇', '焰灵', '星魂', '竹影', '岩兽', '霜鹤'];

// ---------------------------------------------------------------------------
// 4. Audio System
// ---------------------------------------------------------------------------

class AudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmNodes: AudioNode[] = [];
  private bgmGain: GainNode | null = null;
  private bgmPlaying = false;
  private nodePool: AudioNode[] = [];

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = isMuted ? 0 : 0.5;
    } catch { /* audio not available */ }
  }

  setMute(m: boolean) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
  }

  private cleanupNode(node: AudioNode) {
    try { node.disconnect(); } catch { /* already disconnected */ }
    this.nodePool.push(node);
    if (this.nodePool.length > 50) {
      this.nodePool.splice(0, 25);
    }
  }

  private createOsc(type: OscillatorType, freq: number, duration: number, gain: number, delay = 0): OscillatorNode | null {
    if (!this.ctx || !this.masterGain) return null;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, this.ctx.currentTime + delay);
    g.gain.linearRampToValueAtTime(gain, this.ctx.currentTime + delay + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + delay + duration);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(this.ctx.currentTime + delay);
    osc.stop(this.ctx.currentTime + delay + duration + 0.1);
    osc.onended = () => {
      this.cleanupNode(osc);
      this.cleanupNode(g);
    };
    return osc;
  }

  private createNoise(duration: number, gain: number, delay = 0) {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const g = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 1;
    g.gain.setValueAtTime(0, this.ctx.currentTime + delay);
    g.gain.linearRampToValueAtTime(gain, this.ctx.currentTime + delay + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + delay + duration);
    source.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    source.start(this.ctx.currentTime + delay);
    source.onended = () => {
      this.cleanupNode(source);
      this.cleanupNode(filter);
      this.cleanupNode(g);
    };
  }

  // Pentatonic scale notes (C D E G A in different octaves)
  private pentatonic(octave: number, note: number): number {
    const scale = [261.63, 293.66, 329.63, 392.00, 440.00];
    return scale[note % 5] * Math.pow(2, octave - 4);
  }

  startBGM() {
    if (!this.ctx || !this.masterGain || this.bgmPlaying) return;
    this.bgmPlaying = true;
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.12;
    this.bgmGain.connect(this.masterGain);

    // Bass drone
    const bass = this.ctx.createOscillator();
    bass.type = 'sine';
    bass.frequency.value = 65.41; // C2
    const bassGain = this.ctx.createGain();
    bassGain.gain.value = 0.3;
    bass.connect(bassGain);
    bassGain.connect(this.bgmGain);
    bass.start();
    this.bgmNodes.push(bass, bassGain);

    // Sub bass modulation
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.2;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 10;
    lfo.connect(lfoGain);
    lfoGain.connect(bass.frequency);
    lfo.start();
    this.bgmNodes.push(lfo, lfoGain);

    // Pad chord
    const padFreqs = [130.81, 196.00, 261.63]; // C3, G3, C4
    for (const f of padFreqs) {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.value = 0.08;
      osc.connect(g);
      g.connect(this.bgmGain);
      osc.start();
      this.bgmNodes.push(osc, g);

      // Slow detune for dreamy effect
      const det = this.ctx.createOscillator();
      det.type = 'sine';
      det.frequency.value = 0.1 + Math.random() * 0.1;
      const detG = this.ctx.createGain();
      detG.gain.value = 3;
      det.connect(detG);
      detG.connect(osc.detune);
      det.start();
      this.bgmNodes.push(det, detG);
    }

    // Melodic sequence
    this.scheduleMelody();
  }

  private melodyTimeout: number | null = null;

  private scheduleMelody() {
    if (!this.ctx || !this.bgmPlaying) return;
    const melody = [0, 2, 4, 3, 1, 4, 2, 0, 3, 1, 4, 2, 0, 1, 3, 4];
    let delay = 0;
    for (let i = 0; i < melody.length; i++) {
      const note = this.pentatonic(5, melody[i]);
      this.createOsc('sine', note, 0.4, 0.06, delay);
      this.createOsc('triangle', note * 2, 0.2, 0.02, delay + 0.05);
      delay += 0.5;
    }
    this.melodyTimeout = window.setTimeout(() => this.scheduleMelody(), delay * 1000);
  }

  stopBGM() {
    this.bgmPlaying = false;
    if (this.melodyTimeout) {
      clearTimeout(this.melodyTimeout);
      this.melodyTimeout = null;
    }
    for (const node of this.bgmNodes) {
      try {
        if (node instanceof OscillatorNode) node.stop();
        node.disconnect();
      } catch { /* already stopped */ }
    }
    this.bgmNodes = [];
    this.bgmGain = null;
  }

  playCapture() {
    // Guzheng strum ascending
    const notes = [0, 2, 4, 3, 4];
    for (let i = 0; i < notes.length; i++) {
      const freq = this.pentatonic(5, notes[i]);
      this.createOsc('triangle', freq, 0.3, 0.1, i * 0.05);
      this.createOsc('sine', freq * 2, 0.15, 0.03, i * 0.05 + 0.01);
    }
  }

  playKill() {
    // Drum hit + whoosh
    this.createOsc('sine', 80, 0.3, 0.3);
    this.createOsc('sine', 60, 0.2, 0.2, 0.05);
    this.createNoise(0.15, 0.15, 0.02);
  }

  playDeath() {
    // Low frequency impact
    this.createOsc('sine', 40, 0.8, 0.4);
    this.createOsc('sine', 55, 0.6, 0.3, 0.1);
    this.createNoise(0.4, 0.2);
    this.createOsc('sawtooth', 30, 1.0, 0.1, 0.2);
  }

  playPowerUp() {
    // Chime ascending
    for (let i = 0; i < 5; i++) {
      const freq = this.pentatonic(5 + Math.floor(i / 5), i % 5);
      this.createOsc('sine', freq, 0.4, 0.08, i * 0.08);
    }
  }

  playCombo(level: number) {
    // Escalating tones
    for (let i = 0; i <= level; i++) {
      const freq = this.pentatonic(4, i % 5) * (1 + Math.floor(i / 5));
      this.createOsc('triangle', freq, 0.2, 0.1, i * 0.06);
    }
  }

  playLoopClose() {
    // Satisfying snap
    this.createOsc('sine', 600, 0.1, 0.15);
    this.createOsc('triangle', 800, 0.08, 0.1, 0.02);
    this.createNoise(0.05, 0.1);
  }

  playMenuClick() {
    this.createOsc('sine', 440, 0.1, 0.1);
    this.createOsc('triangle', 660, 0.05, 0.05, 0.02);
  }

  playBossAppear() {
    for (let i = 0; i < 8; i++) {
      this.createOsc('sawtooth', 100 + i * 50, 0.3, 0.08, i * 0.1);
    }
    this.createOsc('sine', 60, 1.0, 0.2, 0.3);
  }

  playVictory() {
    const melody = [0, 2, 4, 4, 3, 4, 2, 0];
    for (let i = 0; i < melody.length; i++) {
      const freq = this.pentatonic(5, melody[i]);
      this.createOsc('sine', freq, 0.5, 0.12, i * 0.15);
      this.createOsc('triangle', freq * 1.5, 0.3, 0.04, i * 0.15);
    }
  }

  playShrink() {
    this.createOsc('sawtooth', 200, 0.5, 0.08);
    this.createOsc('sine', 150, 0.6, 0.06, 0.1);
  }

  playNearMissSting() {
    // Quick tense staccato sting
    this.createOsc('sawtooth', 350, 0.08, 0.12);
    this.createOsc('square', 420, 0.06, 0.08, 0.02);
    this.createOsc('sine', 280, 0.1, 0.06, 0.04);
  }

  playAchievementUnlock() {
    // Majestic ascending chime for seal stamp unlock
    const notes = [0, 2, 4, 4, 3, 2, 4];
    for (let i = 0; i < notes.length; i++) {
      const freq = this.pentatonic(5, notes[i]);
      this.createOsc('sine', freq, 0.5, 0.1, i * 0.1);
      this.createOsc('triangle', freq * 1.5, 0.35, 0.05, i * 0.1 + 0.02);
    }
    // Final resonant tone
    this.createOsc('sine', this.pentatonic(6, 0), 0.8, 0.08, 0.8);
  }

  playComboKill(level: number) {
    // Escalating combo sound with increasing intensity
    for (let i = 0; i <= level; i++) {
      const freq = this.pentatonic(4 + Math.floor(i / 3), i % 5);
      this.createOsc('triangle', freq, 0.25, 0.1 + i * 0.02, i * 0.07);
      this.createOsc('sine', freq * 1.5, 0.15, 0.04 + i * 0.01, i * 0.07 + 0.02);
    }
    // Drum roll accent
    for (let i = 0; i < level; i++) {
      this.createOsc('sine', 80 - i * 5, 0.15, 0.08, i * 0.05);
    }
  }

  playGoldenChime() {
    // Sparkly chime for power-up collection
    const sparkleFreqs = [880, 1108, 1318, 1568, 1760];
    for (let i = 0; i < sparkleFreqs.length; i++) {
      this.createOsc('sine', sparkleFreqs[i], 0.2, 0.06, i * 0.04);
      this.createOsc('triangle', sparkleFreqs[i] * 0.5, 0.15, 0.03, i * 0.04 + 0.01);
    }
  }

  // Enhanced multi-layer BGM with water ambience, flute melody, and soft percussion
  private waterNoiseNode: AudioBufferSourceNode | null = null;
  private percInterval: number | null = null;

  startEnhancedBGM() {
    if (!this.ctx || !this.masterGain || this.bgmPlaying) return;
    this.bgmPlaying = true;
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.12;
    this.bgmGain.connect(this.masterGain);

    // Layer 1: Ambient water noise (filtered white noise)
    const waterDuration = 4;
    const waterBufSize = Math.floor(this.ctx.sampleRate * waterDuration);
    const waterBuf = this.ctx.createBuffer(1, waterBufSize, this.ctx.sampleRate);
    const waterData = waterBuf.getChannelData(0);
    for (let i = 0; i < waterBufSize; i++) {
      waterData[i] = (Math.random() * 2 - 1) * 0.3;
    }
    this.waterNoiseNode = this.ctx.createBufferSource();
    this.waterNoiseNode.buffer = waterBuf;
    this.waterNoiseNode.loop = true;
    const waterFilter = this.ctx.createBiquadFilter();
    waterFilter.type = 'lowpass';
    waterFilter.frequency.value = 400;
    waterFilter.Q.value = 0.5;
    const waterGain = this.ctx.createGain();
    waterGain.gain.value = 0.15;
    this.waterNoiseNode.connect(waterFilter);
    waterFilter.connect(waterGain);
    waterGain.connect(this.bgmGain);
    this.waterNoiseNode.start();
    this.bgmNodes.push(waterFilter, waterGain);

    // Layer 2: Bass drone
    const bass = this.ctx.createOscillator();
    bass.type = 'sine';
    bass.frequency.value = 65.41;
    const bassGain = this.ctx.createGain();
    bassGain.gain.value = 0.25;
    bass.connect(bassGain);
    bassGain.connect(this.bgmGain);
    bass.start();
    this.bgmNodes.push(bass, bassGain);

    // Sub bass modulation
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.15;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 8;
    lfo.connect(lfoGain);
    lfoGain.connect(bass.frequency);
    lfo.start();
    this.bgmNodes.push(lfo, lfoGain);

    // Layer 3: Pad chord (ethereal)
    const padFreqs = [130.81, 196.00, 261.63, 329.63];
    for (const f of padFreqs) {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.value = 0.06;
      osc.connect(g);
      g.connect(this.bgmGain);
      osc.start();
      this.bgmNodes.push(osc, g);

      const det = this.ctx.createOscillator();
      det.type = 'sine';
      det.frequency.value = 0.08 + Math.random() * 0.12;
      const detG = this.ctx.createGain();
      detG.gain.value = 4;
      det.connect(detG);
      detG.connect(osc.detune);
      det.start();
      this.bgmNodes.push(det, detG);
    }

    // Layer 4: Bamboo flute melody (higher register, breathy)
    this.scheduleFluteMelody();

    // Layer 5: Soft percussion
    this.schedulePercussion();
  }

  private fluteTimeout: number | null = null;

  private scheduleFluteMelody() {
    if (!this.ctx || !this.bgmPlaying) return;
    // Pentatonic melody patterns for bamboo flute feel
    const phrases = [
      [4, 3, 2, 0, -1, 2, 4, 3],
      [0, 2, 4, 4, 3, 1, 0, -1],
      [2, 4, 3, 2, 0, 1, 2, -1],
      [4, 2, 0, 1, 3, 4, 2, -1],
    ];
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    let delay = 0;
    for (let i = 0; i < phrase.length; i++) {
      if (phrase[i] < 0) {
        delay += 0.6; // rest
        continue;
      }
      const note = this.pentatonic(6, phrase[i]);
      // Breathy sine + soft triangle for flute-like timbre
      this.createOsc('sine', note, 0.5, 0.05, delay);
      this.createOsc('triangle', note * 2.01, 0.3, 0.015, delay + 0.03);
      // Subtle vibrato via slight pitch wobble
      this.createOsc('sine', note * 1.003, 0.45, 0.02, delay + 0.05);
      delay += 0.55 + Math.random() * 0.15;
    }
    this.fluteTimeout = window.setTimeout(() => this.scheduleFluteMelody(), (delay + 1.5) * 1000);
  }

  private schedulePercussion() {
    if (!this.ctx || !this.bgmPlaying) return;
    // Gentle woodblock / muted percussion
    const pattern = [1, 0, 0, 1, 0, 1, 0, 0]; // 1=hit, 0=rest
    let delay = 0;
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i]) {
        // Woodblock-like: short filtered noise burst
        this.createOsc('sine', 800 + Math.random() * 200, 0.05, 0.03, delay);
        this.createNoise(0.03, 0.02, delay);
      }
      delay += 0.5;
    }
    this.percInterval = window.setTimeout(() => this.schedulePercussion(), delay * 1000);
  }

  stopEnhancedBGM() {
    this.bgmPlaying = false;
    if (this.melodyTimeout) {
      clearTimeout(this.melodyTimeout);
      this.melodyTimeout = null;
    }
    if (this.fluteTimeout) {
      clearTimeout(this.fluteTimeout);
      this.fluteTimeout = null;
    }
    if (this.percInterval) {
      clearTimeout(this.percInterval);
      this.percInterval = null;
    }
    if (this.waterNoiseNode) {
      try { this.waterNoiseNode.stop(); this.waterNoiseNode.disconnect(); } catch { /* */ }
      this.waterNoiseNode = null;
    }
    for (const node of this.bgmNodes) {
      try {
        if (node instanceof OscillatorNode) node.stop();
        node.disconnect();
      } catch { /* already stopped */ }
    }
    this.bgmNodes = [];
    this.bgmGain = null;
  }

  playGuzhengCapture() {
    // Ascending guzheng strum - plucked string sound
    const strumNotes = [0, 1, 2, 3, 4, 3, 4];
    for (let i = 0; i < strumNotes.length; i++) {
      const freq = this.pentatonic(5, strumNotes[i]);
      // Sharp attack, quick decay for plucked string
      this.createOsc('triangle', freq, 0.35, 0.12, i * 0.04);
      this.createOsc('sine', freq * 2, 0.2, 0.04, i * 0.04 + 0.005);
      this.createOsc('sine', freq * 3, 0.12, 0.02, i * 0.04 + 0.008);
    }
  }

  playDrumSplatter() {
    // Deep drum hit
    this.createOsc('sine', 60, 0.4, 0.35);
    this.createOsc('sine', 45, 0.3, 0.25, 0.02);
    // Splatter whoosh
    this.createNoise(0.2, 0.2, 0.05);
    this.createNoise(0.15, 0.12, 0.1);
    // Impact transient
    this.createOsc('square', 120, 0.05, 0.15);
  }
}

const audio = new AudioSystem();

// ---------------------------------------------------------------------------
// 5. Passport Integration
// ---------------------------------------------------------------------------

function loadPassport() {
  try {
    const raw = localStorage.getItem('melos_passport');
    if (raw) passport = JSON.parse(raw);
  } catch { /* no passport */ }
}

function savePassport() {
  if (!passport) return;
  try {
    localStorage.setItem('melos_passport', JSON.stringify(passport));
  } catch { /* storage unavailable */ }
}

// ---------------------------------------------------------------------------
// 5b. Achievement System (Red Seal Stamps)
// ---------------------------------------------------------------------------

function initAchievements() {
  const saved = loadAchievementData();
  achievements = [
    {
      id: 'territory_30',
      nameCN: '开疆拓土',
      description: '占领30%领地',
      check: () => territoryPercent >= 30,
      unlocked: saved.includes('territory_30'),
    },
    {
      id: 'territory_70',
      nameCN: '一统天下',
      description: '占领70%领地',
      check: () => territoryPercent >= 70,
      unlocked: saved.includes('territory_70'),
    },
    {
      id: 'kill_3',
      nameCN: '以寡敌众',
      description: '单局击杀3个AI',
      check: () => player.kills >= 3,
      unlocked: saved.includes('kill_3'),
    },
    {
      id: 'shield_used',
      nameCN: '墨龙护体',
      description: '使用护盾道具',
      check: () => shieldUsedThisRound,
      unlocked: saved.includes('shield_used'),
    },
    {
      id: 'trap_ai',
      nameCN: '画地为牢',
      description: '用闭环困住AI',
      check: () => aiTrappedInLoop,
      unlocked: saved.includes('trap_ai'),
    },
  ];
}

function loadAchievementData(): string[] {
  try {
    const raw = localStorage.getItem('mq7_achievements');
    if (raw) return JSON.parse(raw);
  } catch { /* no data */ }
  return [];
}

function saveAchievementData() {
  try {
    const unlocked = achievements.filter(a => a.unlocked).map(a => a.id);
    localStorage.setItem('mq7_achievements', JSON.stringify(unlocked));
  } catch { /* storage unavailable */ }
}

function checkAchievements() {
  for (const ach of achievements) {
    if (!ach.unlocked && ach.check()) {
      ach.unlocked = true;
      saveAchievementData();
      audio.playAchievementUnlock();
      achievementPopup = { text: ach.nameCN, timer: 3.0 };
    }
  }
}

function drawAchievementPopup() {
  if (!achievementPopup) return;
  const popupAlpha = Math.min(1, achievementPopup.timer, (3.0 - (3.0 - achievementPopup.timer)));
  const fadeAlpha = achievementPopup.timer < 0.5 ? achievementPopup.timer / 0.5 : popupAlpha;
  ctx.globalAlpha = fadeAlpha;

  const popW = 200;
  const popH = 70;
  const popX = (W - popW) / 2;
  const popY = H * 0.15;

  // Red seal stamp background
  ctx.fillStyle = 'rgba(160, 30, 30, 0.9)';
  roundRect(popX, popY, popW, popH, 6);
  ctx.fill();
  ctx.strokeStyle = '#c83232';
  ctx.lineWidth = 2;
  roundRect(popX, popY, popW, popH, 6);
  ctx.stroke();

  // Seal stamp icon (square)
  const stampSize = 36;
  const stampX = popX + 14;
  const stampY = popY + (popH - stampSize) / 2;
  ctx.fillStyle = '#8b1a1a';
  ctx.fillRect(stampX, stampY, stampSize, stampSize);
  ctx.strokeStyle = '#e04040';
  ctx.lineWidth = 2;
  ctx.strokeRect(stampX, stampY, stampSize, stampSize);
  ctx.font = 'bold 14px "Noto Serif SC", serif';
  ctx.fillStyle = '#e04040';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('印', stampX + stampSize / 2, stampY + stampSize / 2);
  ctx.textBaseline = 'alphabetic';

  // Achievement text
  ctx.font = 'bold 14px "Noto Serif SC", serif';
  ctx.fillStyle = '#ffd700';
  ctx.textAlign = 'left';
  ctx.fillText(achievementPopup.text, popX + 60, popY + 28);

  ctx.font = '10px "Noto Serif SC", serif';
  ctx.fillStyle = '#ffcccc';
  ctx.fillText('成就解锁！', popX + 60, popY + 48);

  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
}

function drawAchievementStamps(baseX: number, baseY: number) {
  // Draw 5 red seal stamps in a row
  const stampSize = 32;
  const gap = 8;
  const totalW = achievements.length * stampSize + (achievements.length - 1) * gap;
  const startX = baseX - totalW / 2;

  for (let i = 0; i < achievements.length; i++) {
    const ach = achievements[i];
    const x = startX + i * (stampSize + gap);
    const y = baseY;

    if (ach.unlocked) {
      // Unlocked: red seal stamp
      ctx.fillStyle = '#8b1a1a';
      ctx.fillRect(x, y, stampSize, stampSize);
      ctx.strokeStyle = '#e04040';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, stampSize, stampSize);

      // Stamp character (first char of name)
      ctx.font = 'bold 12px "Noto Serif SC", serif';
      ctx.fillStyle = '#e04040';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ach.nameCN.charAt(0), x + stampSize / 2, y + stampSize / 2);
    } else {
      // Locked: grey outline
      ctx.fillStyle = 'rgba(60, 60, 60, 0.4)';
      ctx.fillRect(x, y, stampSize, stampSize);
      ctx.strokeStyle = '#555555';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, stampSize, stampSize);

      ctx.font = '16px "Noto Serif SC", serif';
      ctx.fillStyle = '#444444';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', x + stampSize / 2, y + stampSize / 2);
    }
    ctx.textBaseline = 'alphabetic';
  }

  // Stamp name on hover / below
  ctx.font = '8px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < achievements.length; i++) {
    const ach = achievements[i];
    const x = startX + i * (stampSize + gap) + stampSize / 2;
    ctx.fillStyle = ach.unlocked ? '#c8a96e' : '#555555';
    ctx.fillText(ach.nameCN, x, baseY + stampSize + 12);
  }
}

// ---------------------------------------------------------------------------
// 5c. Tutorial System
// ---------------------------------------------------------------------------

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    titleCN: '移动',
    descCN: '滑动屏幕或使用方向键\n控制麦洛移动',
    icon: '↕',
  },
  {
    titleCN: '画圈',
    descCN: '离开你的领地\n在空白区域留下墨迹',
    icon: '✒',
  },
  {
    titleCN: '占领',
    descCN: '回到你的领地\n形成闭环占领区域！',
    icon: '⬡',
  },
];

function loadTutorialState(): boolean {
  try {
    return localStorage.getItem('mq7_tutorial_done') === '1';
  } catch { return false; }
}

function saveTutorialState() {
  try {
    localStorage.setItem('mq7_tutorial_done', '1');
  } catch { /* storage unavailable */ }
}

function drawTutorialOverlay() {
  if (tutorialStep < 0 || tutorialStep >= TUTORIAL_STEPS.length) return;

  tutorialAlpha = Math.min(1, tutorialAlpha + 0.05);
  ctx.globalAlpha = tutorialAlpha;

  // Dim background
  ctx.fillStyle = 'rgba(10, 10, 22, 0.75)';
  ctx.fillRect(0, 0, W, H);

  const step = TUTORIAL_STEPS[tutorialStep];
  const cardW = 280;
  const cardH = 200;
  const cardX = (W - cardW) / 2;
  const cardY = H * 0.3;

  // Card background
  ctx.fillStyle = 'rgba(20, 20, 40, 0.95)';
  ctx.strokeStyle = '#c8a96e';
  ctx.lineWidth = 2;
  roundRect(cardX, cardY, cardW, cardH, 12);
  ctx.fill();
  roundRect(cardX, cardY, cardW, cardH, 12);
  ctx.stroke();

  // Step indicator dots
  for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
    ctx.beginPath();
    ctx.arc(W / 2 + (i - 1) * 18, cardY + 20, 4, 0, Math.PI * 2);
    ctx.fillStyle = i === tutorialStep ? '#c8a96e' : '#4a4a5a';
    ctx.fill();
  }

  // Icon
  ctx.font = '36px "Noto Serif SC", serif';
  ctx.fillStyle = '#c8a96e';
  ctx.textAlign = 'center';
  ctx.fillText(step.icon, W / 2, cardY + 65);

  // Title
  ctx.font = 'bold 20px "Noto Serif SC", serif';
  ctx.fillStyle = '#c8a96e';
  ctx.fillText(step.titleCN, W / 2, cardY + 100);

  // Description (split by newline)
  ctx.font = '13px "Noto Serif SC", serif';
  ctx.fillStyle = '#aaa09e';
  const lines = step.descCN.split('\n');
  lines.forEach((line, i) => {
    ctx.fillText(line, W / 2, cardY + 125 + i * 20);
  });

  // Next / Start button
  const btnText = tutorialStep < TUTORIAL_STEPS.length - 1 ? '下一步' : '开始游戏';
  const btnW = 140;
  const btnH = 38;
  const btnX = (W - btnW) / 2;
  const btnY = cardY + cardH - 50;

  ctx.fillStyle = 'rgba(200, 169, 110, 0.15)';
  ctx.strokeStyle = '#c8a96e';
  ctx.lineWidth = 1.5;
  roundRect(btnX, btnY, btnW, btnH, 6);
  ctx.fill();
  roundRect(btnX, btnY, btnW, btnH, 6);
  ctx.stroke();

  ctx.font = 'bold 14px "Noto Serif SC", serif';
  ctx.fillStyle = '#c8a96e';
  ctx.fillText(btnText, W / 2, btnY + 24);

  // Skip text
  ctx.font = '10px "Noto Serif SC", serif';
  ctx.fillStyle = '#6a6a7a';
  ctx.fillText('点击任意处跳过', W / 2, cardY + cardH + 20);

  ctx.globalAlpha = 1;
}

function handleTutorialTap(pos: Vec2) {
  const cardW = 280;
  const cardH = 200;
  const cardY = H * 0.3;
  const btnW = 140;
  const btnH = 38;
  const btnX = (W - btnW) / 2;
  const btnY = cardY + cardH - 50;

  // Next button
  if (pos.x >= btnX && pos.x <= btnX + btnW && pos.y >= btnY && pos.y <= btnY + btnH) {
    audio.playMenuClick();
    tutorialStep++;
    tutorialAlpha = 0;
    if (tutorialStep >= TUTORIAL_STEPS.length) {
      tutorialStep = -1;
      tutorialShown = true;
      saveTutorialState();
    }
    return;
  }

  // Click anywhere else to skip
  tutorialStep = -1;
  tutorialShown = true;
  saveTutorialState();
}

// ---------------------------------------------------------------------------
// 5d. Enhanced Visual Effect Systems
// ---------------------------------------------------------------------------

function spawnDeathCircles(x: number, y: number, color: string) {
  for (let i = 0; i < 5; i++) {
    deathCircles.push({
      x: x + rand(-15, 15),
      y: y + rand(-15, 15),
      radius: 2,
      maxRadius: 30 + rand(10, 40),
      alpha: 0.8,
      color,
      speed: 40 + i * 15,
    });
  }
}

function updateDeathCircles(dt: number) {
  for (let i = deathCircles.length - 1; i >= 0; i--) {
    const dc = deathCircles[i];
    dc.radius += dc.speed * dt;
    dc.alpha = Math.max(0, 1 - dc.radius / dc.maxRadius);
    if (dc.radius >= dc.maxRadius) {
      deathCircles.splice(i, 1);
    }
  }
}

function drawDeathCircles() {
  for (const dc of deathCircles) {
    const sx = dc.x - camX;
    const sy = dc.y - camY;
    if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) continue;
    ctx.globalAlpha = dc.alpha * 0.6;
    ctx.beginPath();
    ctx.arc(sx, sy, dc.radius, 0, Math.PI * 2);
    ctx.strokeStyle = dc.color;
    ctx.lineWidth = 3 * dc.alpha;
    ctx.stroke();
    // Inner dissolve fill
    ctx.globalAlpha = dc.alpha * 0.15;
    ctx.fillStyle = dc.color;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function spawnInkSplashAnim(centerX: number, centerY: number, color: string) {
  const anim: InkSplashAnim = {
    x: centerX,
    y: centerY,
    timer: 1.2,
    maxTimer: 1.2,
    color,
    particles: [],
  };
  for (let i = 0; i < 12; i++) {
    anim.particles.push({
      angle: (Math.PI * 2 * i) / 12 + rand(-0.2, 0.2),
      dist: 0,
      size: rand(3, 8),
      speed: rand(30, 80),
    });
  }
  inkSplashAnims.push(anim);
}

function updateInkSplashAnims(dt: number) {
  for (let i = inkSplashAnims.length - 1; i >= 0; i--) {
    const anim = inkSplashAnims[i];
    anim.timer -= dt;
    for (const p of anim.particles) {
      p.dist += p.speed * dt;
      p.speed *= 0.95;
    }
    if (anim.timer <= 0) {
      inkSplashAnims.splice(i, 1);
    }
  }
}

function drawInkSplashAnims() {
  for (const anim of inkSplashAnims) {
    const sx = anim.x - camX;
    const sy = anim.y - camY;
    if (sx < -100 || sx > W + 100 || sy < -100 || sy > H + 100) continue;
    const alpha = anim.timer / anim.maxTimer;
    ctx.globalAlpha = alpha * 0.7;
    for (const p of anim.particles) {
      const px = sx + Math.cos(p.angle) * p.dist;
      const py = sy + Math.sin(p.angle) * p.dist;
      ctx.beginPath();
      ctx.arc(px, py, p.size * alpha, 0, Math.PI * 2);
      ctx.fillStyle = anim.color;
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function spawnComboText(x: number, y: number, combo: number) {
  const texts = ['', '', 'DOUBLE!', 'TRIPLE!', 'QUAD!', 'PENTA!'];
  const text = combo < texts.length ? texts[combo] : `${combo}x COMBO!`;
  comboTextAnims.push({
    x, y,
    text,
    timer: 2.0,
    maxTimer: 2.0,
    color: combo >= 4 ? '#ff4444' : combo >= 3 ? '#ffaa00' : '#ffd700',
    size: 14 + combo * 2,
  });
}

function updateComboTextAnims(dt: number) {
  for (let i = comboTextAnims.length - 1; i >= 0; i--) {
    const anim = comboTextAnims[i];
    anim.timer -= dt;
    anim.y -= 20 * dt;
    if (anim.timer <= 0) {
      comboTextAnims.splice(i, 1);
    }
  }
}

function drawComboTextAnims() {
  for (const anim of comboTextAnims) {
    const sx = anim.x - camX;
    const sy = anim.y - camY;
    if (sx < -100 || sx > W + 100 || sy < -50 || sy > H + 50) continue;
    const alpha = Math.min(1, anim.timer / 0.5);
    const scale = 1 + (1 - anim.timer / anim.maxTimer) * 0.3;
    ctx.globalAlpha = alpha;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(scale, scale);
    ctx.font = `bold ${anim.size}px "Noto Serif SC", serif`;
    ctx.fillStyle = anim.color;
    ctx.textAlign = 'center';
    // Text shadow
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.fillText(anim.text, 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function spawnGoldenSparkles(x: number, y: number, count: number) {
  for (let i = 0; i < count; i++) {
    if (goldenSparkles.length >= 100) break;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(2, 6);
    goldenSparkles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - rand(1, 3),
      life: 1,
      maxLife: rand(0.6, 1.5),
      size: rand(1.5, 4),
      twinklePhase: rand(0, Math.PI * 2),
    });
  }
}

function updateGoldenSparkles(dt: number) {
  for (let i = goldenSparkles.length - 1; i >= 0; i--) {
    const s = goldenSparkles[i];
    s.x += s.vx * dt * 60;
    s.y += s.vy * dt * 60;
    s.vy += 1.5 * dt; // gravity
    s.vx *= 0.98;
    s.life -= dt / s.maxLife;
    s.twinklePhase += dt * 12;
    if (s.life <= 0) {
      goldenSparkles.splice(i, 1);
    }
  }
}

function drawGoldenSparkles() {
  for (const s of goldenSparkles) {
    const sx = s.x - camX;
    const sy = s.y - camY;
    if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;
    const twinkle = 0.5 + 0.5 * Math.sin(s.twinklePhase);
    ctx.globalAlpha = s.life * twinkle;
    const size = s.size * (0.5 + s.life * 0.5);

    // Star shape
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    for (let j = 0; j < 4; j++) {
      const angle = (j * Math.PI) / 2 + s.twinklePhase * 0.3;
      const px = sx + Math.cos(angle) * size;
      const py = sy + Math.sin(angle) * size;
      if (j === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
      const innerAngle = angle + Math.PI / 4;
      const ipx = sx + Math.cos(innerAngle) * size * 0.4;
      const ipy = sy + Math.sin(innerAngle) * size * 0.4;
      ctx.lineTo(ipx, ipy);
    }
    ctx.closePath();
    ctx.fill();

    // Glow
    ctx.globalAlpha = s.life * twinkle * 0.3;
    ctx.beginPath();
    ctx.arc(sx, sy, size * 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd700';
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Near-death detection: check if any AI is within 3 cells of player trail
function checkNearDeath(): boolean {
  if (player.trail.length < 2) return false;
  for (const e of enemies) {
    if (!e.alive) continue;
    const eCell = worldToCell(e.x, e.y);
    for (const tc of player.trail) {
      const d = Math.abs(eCell.x - tc.x) + Math.abs(eCell.y - tc.y);
      if (d <= 3) return true;
    }
  }
  return false;
}

// Trail brush width varies with speed
function getTrailBrushWidth(p: Player): number {
  const baseWidth = GRID_SIZE - 2;
  if (p.dir === Dir.None) return baseWidth;
  const speedRatio = p.speed / p.baseSpeed;
  // Faster = thinner, slower = thicker
  if (speedRatio > 1.2) return baseWidth * 0.6;
  if (speedRatio < 0.8) return baseWidth * 1.3;
  return baseWidth;
}

// Check if AI was trapped inside a loop
function checkAITrappedInLoop(capturedCells: Vec2[]): boolean {
  if (capturedCells.length < 5) return false;
  // Build a set of captured cell coords
  const capturedSet = new Set<string>();
  for (const c of capturedCells) {
    capturedSet.add(`${c.x},${c.y}`);
  }
  // Check if any alive enemy is inside the captured area
  for (const e of enemies) {
    if (!e.alive) continue;
    const eCell = worldToCell(e.x, e.y);
    if (capturedSet.has(`${eCell.x},${eCell.y}`)) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// 5e. Share Card Generation
// ---------------------------------------------------------------------------

function generateShareCard(): HTMLCanvasElement {
  const cardW = 360;
  const cardH = 480;
  const card = document.createElement('canvas');
  card.width = cardW;
  card.height = cardH;
  const c = card.getContext('2d')!;

  // Background gradient
  const bgGrad = c.createLinearGradient(0, 0, 0, cardH);
  bgGrad.addColorStop(0, '#0a0a16');
  bgGrad.addColorStop(0.5, '#0e1225');
  bgGrad.addColorStop(1, '#0a0a16');
  c.fillStyle = bgGrad;
  c.fillRect(0, 0, cardW, cardH);

  // Decorative border
  c.strokeStyle = '#c8a96e';
  c.lineWidth = 3;
  c.strokeRect(10, 10, cardW - 20, cardH - 20);

  // Inner border
  c.strokeStyle = 'rgba(200, 169, 110, 0.3)';
  c.lineWidth = 1;
  c.strokeRect(18, 18, cardW - 36, cardH - 36);

  // Corner decorations
  const corners = [[22, 22], [cardW - 22, 22], [22, cardH - 22], [cardW - 22, cardH - 22]];
  for (const [cx, cy] of corners) {
    c.fillStyle = '#c8a96e';
    c.beginPath();
    c.arc(cx, cy, 4, 0, Math.PI * 2);
    c.fill();
  }

  // Title
  c.font = 'bold 28px "Noto Serif SC", serif';
  c.fillStyle = '#c8a96e';
  c.textAlign = 'center';
  c.fillText('水墨画疆', cardW / 2, 65);

  c.font = '12px "Noto Serif SC", serif';
  c.fillStyle = '#8a7a5e';
  c.fillText('Ink Territory', cardW / 2, 85);

  // Divider
  c.strokeStyle = '#c8a96e40';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(40, 100);
  c.lineTo(cardW - 40, 100);
  c.stroke();

  // Player name
  const displayName = passport?.name || NICKNAMES[selectedNickname];
  c.font = 'bold 18px "Noto Serif SC", serif';
  c.fillStyle = '#ffffff';
  c.fillText(displayName, cardW / 2, 135);

  // Arena
  c.font = '12px "Noto Serif SC", serif';
  c.fillStyle = '#8a7a5e';
  c.fillText(ARENAS[currentArena].nameCN + ' · ' + ARENAS[currentArena].name, cardW / 2, 158);

  // Stats grid
  const statsStartY = 185;
  const statPairs: [string, string][] = [
    ['得分', score.toString()],
    ['领地', `${territoryPercent.toFixed(1)}%`],
    ['击杀', player.kills.toString()],
    ['最高连击', player.maxCombo.toString()],
    ['层数', currentLevel.toString()],
    ['存活', `${Math.floor(survivalTime / 60)}:${Math.floor(survivalTime % 60).toString().padStart(2, '0')}`],
  ];

  for (let i = 0; i < statPairs.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const sx = col === 0 ? cardW * 0.3 : cardW * 0.7;
    const sy = statsStartY + row * 55;

    // Stat value (large)
    c.font = 'bold 22px "Noto Serif SC", serif';
    c.fillStyle = '#c8a96e';
    c.fillText(statPairs[i][1], sx, sy);

    // Stat label (small)
    c.font = '11px "Noto Serif SC", serif';
    c.fillStyle = '#8a7a5e';
    c.fillText(statPairs[i][0], sx, sy + 18);
  }

  // Achievement stamps
  const stampY = statsStartY + 175;
  c.font = '11px "Noto Serif SC", serif';
  c.fillStyle = '#8a7a5e';
  c.textAlign = 'center';
  c.fillText('成就印章', cardW / 2, stampY);

  const stampSize = 28;
  const stampGap = 6;
  const totalStampW = achievements.length * stampSize + (achievements.length - 1) * stampGap;
  const stampStartX = (cardW - totalStampW) / 2;

  for (let i = 0; i < achievements.length; i++) {
    const ach = achievements[i];
    const ax = stampStartX + i * (stampSize + stampGap);
    const ay = stampY + 10;

    if (ach.unlocked) {
      c.fillStyle = '#8b1a1a';
      c.fillRect(ax, ay, stampSize, stampSize);
      c.strokeStyle = '#e04040';
      c.lineWidth = 1.5;
      c.strokeRect(ax, ay, stampSize, stampSize);
      c.font = 'bold 10px "Noto Serif SC", serif';
      c.fillStyle = '#e04040';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(ach.nameCN.charAt(0), ax + stampSize / 2, ay + stampSize / 2);
    } else {
      c.fillStyle = 'rgba(60,60,60,0.4)';
      c.fillRect(ax, ay, stampSize, stampSize);
      c.strokeStyle = '#555555';
      c.lineWidth = 1;
      c.strokeRect(ax, ay, stampSize, stampSize);
      c.font = '14px "Noto Serif SC", serif';
      c.fillStyle = '#444444';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('?', ax + stampSize / 2, ay + stampSize / 2);
    }
    c.textBaseline = 'alphabetic';
  }

  // High score badge
  if (score >= highScore && score > 0) {
    c.font = 'bold 13px "Noto Serif SC", serif';
    c.fillStyle = '#ffaa00';
    c.textAlign = 'center';
    c.fillText('★ 新纪录 ★', cardW / 2, stampY + 55);
  }

  // Footer
  c.font = '10px "Noto Serif SC", serif';
  c.fillStyle = '#444444';
  c.textAlign = 'center';
  c.fillText('JoyBoy Games · Melo\'s Quest 7', cardW / 2, cardH - 25);

  return card;
}

function drawShareCardOverlay() {
  if (!showShareCard || !shareCardCanvas) return;

  ctx.fillStyle = 'rgba(5, 5, 10, 0.9)';
  ctx.fillRect(0, 0, W, H);

  // Draw the share card centered
  const scale = Math.min((W - 30) / shareCardCanvas.width, (H - 120) / shareCardCanvas.height);
  const drawW = shareCardCanvas.width * scale;
  const drawH = shareCardCanvas.height * scale;
  const drawX = (W - drawW) / 2;
  const drawY = 30;

  ctx.drawImage(shareCardCanvas, drawX, drawY, drawW, drawH);

  // Close / share buttons
  const btnY = drawY + drawH + 15;
  const closeBtnW = 100;
  const closeBtnH = 36;

  // Close button
  ctx.fillStyle = 'rgba(100, 50, 50, 0.2)';
  ctx.strokeStyle = '#aa6666';
  ctx.lineWidth = 1;
  roundRect(W / 2 - closeBtnW - 10, btnY, closeBtnW, closeBtnH, 6);
  ctx.fill();
  roundRect(W / 2 - closeBtnW - 10, btnY, closeBtnW, closeBtnH, 6);
  ctx.stroke();
  ctx.font = '13px "Noto Serif SC", serif';
  ctx.fillStyle = '#aa6666';
  ctx.textAlign = 'center';
  ctx.fillText('关闭', W / 2 - closeBtnW / 2 - 10, btnY + 23);

  // Save button
  ctx.fillStyle = 'rgba(200, 169, 110, 0.15)';
  ctx.strokeStyle = '#c8a96e';
  ctx.lineWidth = 1;
  roundRect(W / 2 + 10, btnY, closeBtnW, closeBtnH, 6);
  ctx.fill();
  roundRect(W / 2 + 10, btnY, closeBtnW, closeBtnH, 6);
  ctx.stroke();
  ctx.font = '13px "Noto Serif SC", serif';
  ctx.fillStyle = '#c8a96e';
  ctx.fillText('保存', W / 2 + closeBtnW / 2 + 10, btnY + 23);
}

function handleShareCardTap(pos: Vec2) {
  if (!showShareCard || !shareCardCanvas) return false;

  const scale = Math.min((W - 30) / shareCardCanvas.width, (H - 120) / shareCardCanvas.height);
  const drawH = shareCardCanvas.height * scale;
  const btnY = 30 + drawH + 15;
  const closeBtnW = 100;
  const closeBtnH = 36;

  // Close button
  if (pos.x >= W / 2 - closeBtnW - 10 && pos.x <= W / 2 - 10 && pos.y >= btnY && pos.y <= btnY + closeBtnH) {
    showShareCard = false;
    shareCardCanvas = null;
    return true;
  }

  // Save button - download card image
  if (pos.x >= W / 2 + 10 && pos.x <= W / 2 + closeBtnW + 10 && pos.y >= btnY && pos.y <= btnY + closeBtnH) {
    try {
      const link = document.createElement('a');
      link.download = `ink-territory-${Date.now()}.png`;
      link.href = shareCardCanvas.toDataURL('image/png');
      link.click();
    } catch { /* save failed */ }
    showShareCard = false;
    shareCardCanvas = null;
    return true;
  }

  // Click anywhere else to close
  showShareCard = false;
  shareCardCanvas = null;
  return true;
}

function loadHighScore(): number {
  try {
    const v = localStorage.getItem('mq7_highscore');
    return v ? parseInt(v, 10) : 0;
  } catch { return 0; }
}

function saveHighScore(s: number) {
  try {
    localStorage.setItem('mq7_highscore', s.toString());
  } catch { /* storage unavailable */ }
}

function loadMuteState(): boolean {
  try {
    return localStorage.getItem('mq7_muted') === '1';
  } catch { return false; }
}

function saveMuteState(m: boolean) {
  try {
    localStorage.setItem('mq7_muted', m ? '1' : '0');
  } catch { /* storage unavailable */ }
}

// ---------------------------------------------------------------------------
// 6. Utility Functions
// ---------------------------------------------------------------------------

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// ---------------------------------------------------------------------------
// 7. Grid & Territory System
// ---------------------------------------------------------------------------

function initGrid() {
  grid = [];
  for (let r = 0; r < ARENA_ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c < ARENA_COLS; c++) {
      grid[r][c] = { owner: -1, trail: -1 };
    }
  }
  arenaMinX = 0;
  arenaMinY = 0;
  arenaMaxX = ARENA_COLS;
  arenaMaxY = ARENA_ROWS;
  totalCells = ARENA_COLS * ARENA_ROWS;
}

function isInBounds(cx: number, cy: number): boolean {
  return cx >= arenaMinX && cx < arenaMaxX && cy >= arenaMinY && cy < arenaMaxY;
}

function gridAt(cx: number, cy: number): Cell | null {
  if (cy < 0 || cy >= ARENA_ROWS || cx < 0 || cx >= ARENA_COLS) return null;
  return grid[cy][cx];
}

function worldToCell(wx: number, wy: number): Vec2 {
  return { x: Math.floor(wx / GRID_SIZE), y: Math.floor(wy / GRID_SIZE) };
}

function countTerritory(owner: number): number {
  let count = 0;
  for (let r = arenaMinY; r < arenaMaxY; r++) {
    for (let c = arenaMinX; c < arenaMaxX; c++) {
      if (grid[r][c].owner === owner) count++;
    }
  }
  return count;
}

// Flood fill to capture enclosed territory
function captureTerritory(owner: number, trailCells: Vec2[]): number {
  // Mark trail cells as owned
  for (const t of trailCells) {
    if (isInBounds(t.x, t.y)) {
      grid[t.y][t.x].owner = owner;
      grid[t.y][t.x].trail = -1;
    }
  }

  // Find enclosed areas using flood fill from edges
  const rows = arenaMaxY - arenaMinY;
  const cols = arenaMaxX - arenaMinX;
  const visited: boolean[][] = [];
  for (let r = 0; r < rows; r++) {
    visited[r] = new Array(cols).fill(false);
  }

  // Mark all cells owned by this owner as visited (they're boundaries)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r + arenaMinY][c + arenaMinX].owner === owner) {
        visited[r][c] = true;
      }
    }
  }

  // Flood fill from each edge to find reachable (non-enclosed) cells
  const queue: number[] = [];

  function enqueue(lr: number, lc: number) {
    if (lr >= 0 && lr < rows && lc >= 0 && lc < cols && !visited[lr][lc]) {
      visited[lr][lc] = true;
      queue.push(lr * cols + lc);
    }
  }

  // Top and bottom edges
  for (let c = 0; c < cols; c++) {
    enqueue(0, c);
    enqueue(rows - 1, c);
  }
  // Left and right edges
  for (let r = 0; r < rows; r++) {
    enqueue(r, 0);
    enqueue(r, cols - 1);
  }

  while (queue.length > 0) {
    const idx = queue.pop()!;
    const qr = Math.floor(idx / cols);
    const qc = idx % cols;
    enqueue(qr - 1, qc);
    enqueue(qr + 1, qc);
    enqueue(qr, qc - 1);
    enqueue(qr, qc + 1);
  }

  // All unvisited cells that aren't owned by someone else become our territory
  let captured = 0;
  const capturedCells: Vec2[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!visited[r][c]) {
        const gr = r + arenaMinY;
        const gc = c + arenaMinX;
        const cell = grid[gr][gc];
        // Check if this cell has another player's trail - kill them
        if (cell.trail >= 0 && cell.trail !== owner) {
          killByCapture(cell.trail, owner);
        }
        cell.owner = owner;
        cell.trail = -1;
        captured++;
        capturedCells.push({ x: gc, y: gr });
      }
    }
  }

  // Spawn particles for captured territory
  if (captured > 0) {
    const arena = ARENAS[currentArena];
    const maxP = Math.min(captured, 30);
    for (let i = 0; i < maxP; i++) {
      const ci = Math.floor(Math.random() * capturedCells.length);
      const cell = capturedCells[ci];
      spawnParticle(
        cell.x * GRID_SIZE + GRID_SIZE / 2,
        cell.y * GRID_SIZE + GRID_SIZE / 2,
        'splash', arena.particleColor
      );
    }
  }

  return captured;
}

function killByCapture(victimId: number, killerId: number) {
  if (victimId === 0) {
    if (player.shieldTimer > 0) return;
    playerDeath();
  } else {
    const idx = victimId - 1;
    if (idx >= 0 && idx < enemies.length && enemies[idx].alive) {
      if (enemies[idx].shieldTimer > 0) return;
      killEnemy(idx, killerId);
    }
  }
}

function clearTrail(ownerId: number) {
  for (let r = 0; r < ARENA_ROWS; r++) {
    for (let c = 0; c < ARENA_COLS; c++) {
      if (grid[r][c].trail === ownerId) {
        grid[r][c].trail = -1;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 8. Player & Enemy Creation
// ---------------------------------------------------------------------------

function createPlayer(id: number, startX: number, startY: number, personality: AIPersonality = AIPersonality.Cautious): Player {
  const p: Player = {
    x: startX * GRID_SIZE + GRID_SIZE / 2,
    y: startY * GRID_SIZE + GRID_SIZE / 2,
    dir: Dir.None,
    nextDir: Dir.None,
    speed: 1.8,
    baseSpeed: 1.8,
    alive: true,
    trail: [],
    territoryCount: 0,
    color: PLAYER_COLORS[id % PLAYER_COLORS.length],
    trailColor: PLAYER_TRAIL_COLORS[id % PLAYER_TRAIL_COLORS.length],
    name: id === 0 ? (passport?.name || PLAYER_NAMES[0]) : PLAYER_NAMES[id % PLAYER_NAMES.length],
    shieldTimer: 0,
    speedTimer: 0,
    invisTimer: 0,
    kills: 0,
    combos: 0,
    maxCombo: 0,
    respawnTimer: 0,
    personality,
    aiTimer: 0,
    aiTargetDir: Dir.Up,
    aiLoopSize: personality === AIPersonality.Cautious ? 6 : personality === AIPersonality.Aggressive ? 15 : 10,
    aiStepsInLoop: 0,
    aiPhase: 0,
  };

  // Claim starting territory (3x3 area)
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = startX + dx;
      const cy = startY + dy;
      if (isInBounds(cx, cy)) {
        grid[cy][cx].owner = id;
      }
    }
  }
  p.territoryCount = 9;

  return p;
}

function spawnEnemies(count: number) {
  enemies = [];
  const personalities = [AIPersonality.Cautious, AIPersonality.Aggressive, AIPersonality.Hunter];
  for (let i = 0; i < count; i++) {
    const margin = 10;
    let sx: number, sy: number;
    let attempts = 0;
    do {
      sx = randInt(arenaMinX + margin, arenaMaxX - margin);
      sy = randInt(arenaMinY + margin, arenaMaxY - margin);
      attempts++;
    } while (attempts < 50 && dist(sx, sy, player.x / GRID_SIZE, player.y / GRID_SIZE) < 15);

    const personality = personalities[i % personalities.length];
    const enemy = createPlayer(i + 1, sx, sy, personality);
    enemy.speed = 1.6 + currentLevel * 0.05;
    enemy.baseSpeed = enemy.speed;
    enemies.push(enemy);
  }
}

function spawnBoss(level: number) {
  const bossIdx = (Math.floor(level / BOSS_LEVEL_INTERVAL) - 1) % BOSS_NAMES.length;
  const cx = Math.floor((arenaMinX + arenaMaxX) / 2);
  const cy = Math.floor((arenaMinY + arenaMaxY) / 2);

  boss = {
    x: cx * GRID_SIZE + GRID_SIZE / 2,
    y: cy * GRID_SIZE + GRID_SIZE / 2,
    hp: 5 + level,
    maxHp: 5 + level,
    name: BOSS_NAMES[bossIdx],
    attackTimer: 3,
    moveTimer: 0,
    dir: Dir.Right,
    speed: 1.2,
    size: 3,
    ability: BOSS_ABILITIES[bossIdx],
    abilityTimer: 5,
    trail: [],
    territoryCount: 0,
    color: '#ff4444',
    trailColor: '#ff8888',
  };

  // Boss claims large starting territory
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const bx = cx + dx;
      const by = cy + dy;
      if (isInBounds(bx, by)) {
        grid[by][bx].owner = 99; // Boss owner ID
        boss.territoryCount++;
      }
    }
  }

  audio.playBossAppear();
}

// ---------------------------------------------------------------------------
// 9. Power-Up System
// ---------------------------------------------------------------------------

function spawnPowerUp() {
  if (powerUps.length >= 3) return;
  let cx: number, cy: number;
  let attempts = 0;
  do {
    cx = randInt(arenaMinX + 5, arenaMaxX - 5);
    cy = randInt(arenaMinY + 5, arenaMaxY - 5);
    attempts++;
  } while (attempts < 30 && grid[cy][cx].owner >= 0);

  powerUps.push({
    x: cx * GRID_SIZE + GRID_SIZE / 2,
    y: cy * GRID_SIZE + GRID_SIZE / 2,
    type: randInt(0, 3) as PowerUpType,
    timer: 15,
  });
}

function getPlayerId(p: Player): number {
  if (p === player) return 0;
  const idx = enemies.indexOf(p);
  return idx >= 0 ? idx + 1 : -1;
}

function applyPowerUp(p: Player, type: PowerUpType) {
  // Golden sparkle particles on collection
  spawnGoldenSparkles(p.x, p.y, 20);
  audio.playGoldenChime();

  switch (type) {
    case PowerUpType.Shield:
      p.shieldTimer = 5;
      if (p === player) shieldUsedThisRound = true;
      break;
    case PowerUpType.Speed:
      p.speedTimer = 5;
      p.speed = p.baseSpeed * 1.6;
      break;
    case PowerUpType.Invis:
      p.invisTimer = 5;
      break;
    case PowerUpType.Bomb: {
      // Remove nearby enemy territory
      const cellPos = worldToCell(p.x, p.y);
      const radius = 8;
      const pId = getPlayerId(p);
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy <= radius * radius) {
            const bx = cellPos.x + dx;
            const by = cellPos.y + dy;
            if (isInBounds(bx, by)) {
              const cell = grid[by][bx];
              if (cell.owner >= 0 && cell.owner !== pId) {
                cell.owner = -1;
                spawnParticle(bx * GRID_SIZE + GRID_SIZE / 2, by * GRID_SIZE + GRID_SIZE / 2, 'explosion', '#ff6644');
              }
            }
          }
        }
      }
      break;
    }
  }
  audio.playPowerUp();
}

const POWERUP_COLORS = ['#44aaff', '#44ff88', '#aa88ff', '#ff6644'];

// ---------------------------------------------------------------------------
// 10. Particle System
// ---------------------------------------------------------------------------

function spawnParticle(x: number, y: number, type: Particle['type'], color: string) {
  if (particles.length >= PARTICLE_CAP) return;
  const angle = rand(0, Math.PI * 2);
  const speed = rand(0.5, 3);
  particles.push({
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 1,
    maxLife: rand(0.5, 1.5),
    size: rand(2, 6),
    color,
    alpha: 1,
    type,
    rot: rand(0, Math.PI * 2),
    vr: rand(-2, 2),
  });
}

function spawnInkExplosion(x: number, y: number, color: string, count: number) {
  for (let i = 0; i < count; i++) {
    if (particles.length >= PARTICLE_CAP) break;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(2, 8);
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      maxLife: rand(0.8, 2.0),
      size: rand(3, 10),
      color,
      alpha: 1,
      type: 'explosion',
      rot: rand(0, Math.PI * 2),
      vr: rand(-3, 3),
    });
  }
}

function spawnBrushStroke(x: number, y: number, color: string) {
  if (particles.length >= PARTICLE_CAP) return;
  particles.push({
    x, y,
    vx: rand(-0.5, 0.5),
    vy: rand(-0.5, 0.5),
    life: 1,
    maxLife: rand(0.3, 0.8),
    size: rand(4, 8),
    color,
    alpha: 0.6,
    type: 'brush',
    rot: rand(0, Math.PI * 2),
    vr: 0,
  });
}

function updateParticles(dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    p.vx *= 0.97;
    p.vy *= 0.97;
    p.rot += p.vr * dt;
    p.life -= dt / p.maxLife;
    p.alpha = Math.max(0, p.life);
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// 11. Movement & Collision
// ---------------------------------------------------------------------------

function moveDir(dir: Dir): Vec2 {
  switch (dir) {
    case Dir.Up: return { x: 0, y: -1 };
    case Dir.Down: return { x: 0, y: 1 };
    case Dir.Left: return { x: -1, y: 0 };
    case Dir.Right: return { x: 1, y: 0 };
    default: return { x: 0, y: 0 };
  }
}

function oppositeDir(dir: Dir): Dir {
  switch (dir) {
    case Dir.Up: return Dir.Down;
    case Dir.Down: return Dir.Up;
    case Dir.Left: return Dir.Right;
    case Dir.Right: return Dir.Left;
    default: return Dir.None;
  }
}

function movePlayer(p: Player, dt: number, id: number) {
  if (!p.alive) return;
  if (p.dir === Dir.None) return;

  const mv = moveDir(p.dir);
  const speed = p.speed * GRID_SIZE * dt * 4;
  const newX = p.x + mv.x * speed;
  const newY = p.y + mv.y * speed;

  const oldCell = worldToCell(p.x, p.y);
  const newCell = worldToCell(newX, newY);

  // Boundary check
  if (!isInBounds(newCell.x, newCell.y)) {
    if (id === 0) {
      // Player hits boundary while trailing => die
      if (p.trail.length > 0) {
        playerDeath();
        return;
      }
    }
    // Bounce off wall
    p.dir = oppositeDir(p.dir);
    return;
  }

  // Check if entering a new cell
  if (newCell.x !== oldCell.x || newCell.y !== oldCell.y) {
    const destCell = gridAt(newCell.x, newCell.y);
    if (destCell) {
      // Check trail collision (someone crossing another's trail)
      if (destCell.trail >= 0 && destCell.trail !== id) {
        killByCapture(destCell.trail, id);
      }

      // Check self-trail collision
      if (destCell.trail === id && p.trail.length > 1) {
        if (id === 0) {
          if (p.shieldTimer <= 0) {
            playerDeath();
            return;
          }
        } else {
          killEnemy(id - 1, id);
          return;
        }
      }

      const isOnOwnTerritory = destCell.owner === id;
      const wasOnOwnTerritory = gridAt(oldCell.x, oldCell.y)?.owner === id;

      if (!isOnOwnTerritory && wasOnOwnTerritory) {
        // Leaving own territory - start trail
        p.trail = [{ x: oldCell.x, y: oldCell.y }];
      }

      if (!isOnOwnTerritory && p.trail.length > 0) {
        // Continuing trail
        const lastTrail = p.trail[p.trail.length - 1];
        if (lastTrail.x !== newCell.x || lastTrail.y !== newCell.y) {
          p.trail.push({ x: newCell.x, y: newCell.y });
          grid[newCell.y][newCell.x].trail = id;
          // Brush stroke particle
          if (Math.random() < 0.3) {
            spawnBrushStroke(newX, newY, p.trailColor);
          }
        }
      }

      if (isOnOwnTerritory && p.trail.length > 2) {
        // Closing the loop - capture territory
        audio.playLoopClose();
        const trailCopy = [...p.trail];
        const killsBefore = id === 0 ? player.kills : 0;
        const captured = captureTerritory(id, p.trail);
        p.trail = [];
        clearTrail(id);
        p.territoryCount = countTerritory(id);

        if (captured > 0) {
          audio.playGuzhengCapture();
          audio.playCapture();

          // Ink splash animation from captured area center
          if (id === 0 && trailCopy.length > 0) {
            let centerX = 0, centerY = 0;
            for (const tc of trailCopy) {
              centerX += tc.x;
              centerY += tc.y;
            }
            centerX = (centerX / trailCopy.length) * GRID_SIZE + GRID_SIZE / 2;
            centerY = (centerY / trailCopy.length) * GRID_SIZE + GRID_SIZE / 2;
            spawnInkSplashAnim(centerX, centerY, p.trailColor);
          }

          if (id === 0) {
            const bonus = Math.floor(captured * 10);
            score += bonus;

            // Combo kill system: multiple enemies killed in one loop
            const killsInLoop = player.kills - killsBefore;
            if (killsInLoop >= 2) {
              audio.playComboKill(killsInLoop);
              const comboBonus = killsInLoop * 150;
              score += comboBonus;
              spawnComboText(player.x, player.y - 20, killsInLoop);
            }

            if (currentCombo > 1) {
              audio.playCombo(currentCombo);
              score += currentCombo * 50;
            }

            // Check if AI was trapped inside the loop
            if (checkAITrappedInLoop(trailCopy)) {
              aiTrappedInLoop = true;
            }
          }
        }
      }
    }
  }

  p.x = newX;
  p.y = newY;
}

function playerDeath() {
  if (!player.alive) return;
  player.alive = false;
  audio.playDeath();
  spawnInkExplosion(player.x, player.y, '#ff3333', 40);
  spawnDeathCircles(player.x, player.y, '#ff3333');
  clearTrail(0);
  player.trail = [];

  // Check achievements before game over
  checkAchievements();

  // Generate share card
  shareCardCanvas = generateShareCard();

  phase = GamePhase.GameOver;

  if (passport) {
    passport.gamesPlayed++;
    passport.totalScore += score;
    passport.lastPlayed = new Date().toISOString().slice(0, 10);
    savePassport();
  }

  if (score > highScore) {
    highScore = score;
    saveHighScore(highScore);
  }
}

function killEnemy(idx: number, killerId: number) {
  if (idx < 0 || idx >= enemies.length) return;
  const enemy = enemies[idx];
  if (!enemy.alive) return;

  enemy.alive = false;
  enemy.respawnTimer = 5;
  spawnInkExplosion(enemy.x, enemy.y, enemy.color, 25);
  spawnDeathCircles(enemy.x, enemy.y, enemy.color);
  clearTrail(idx + 1);
  enemy.trail = [];

  // Remove their territory
  for (let r = arenaMinY; r < arenaMaxY; r++) {
    for (let c = arenaMinX; c < arenaMaxX; c++) {
      if (grid[r][c].owner === idx + 1) {
        grid[r][c].owner = -1;
      }
    }
  }

  if (killerId === 0) {
    player.kills++;
    currentCombo++;
    comboTimer = 3;
    if (currentCombo > player.maxCombo) player.maxCombo = currentCombo;
    audio.playDrumSplatter();
    audio.playKill();
    score += 100 * currentCombo;

    // Combo text for consecutive kills
    if (currentCombo >= 2) {
      spawnComboText(enemy.x, enemy.y - 15, currentCombo);
      audio.playComboKill(currentCombo);
    }
  }
}

function respawnEnemy(idx: number) {
  const enemy = enemies[idx];
  let sx: number, sy: number;
  let attempts = 0;
  do {
    sx = randInt(arenaMinX + 5, arenaMaxX - 5);
    sy = randInt(arenaMinY + 5, arenaMaxY - 5);
    attempts++;
  } while (attempts < 30 && (grid[sy][sx].owner >= 0 || dist(sx, sy, player.x / GRID_SIZE, player.y / GRID_SIZE) < 10));

  enemy.x = sx * GRID_SIZE + GRID_SIZE / 2;
  enemy.y = sy * GRID_SIZE + GRID_SIZE / 2;
  enemy.alive = true;
  enemy.dir = Dir.None;
  enemy.trail = [];
  enemy.shieldTimer = 2; // Brief invulnerability on spawn

  // Reclaim starting territory
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = sx + dx;
      const cy = sy + dy;
      if (isInBounds(cx, cy)) {
        grid[cy][cx].owner = idx + 1;
      }
    }
  }
  enemy.territoryCount = 9;
}

// ---------------------------------------------------------------------------
// 12. AI System
// ---------------------------------------------------------------------------

function updateAI(enemy: Player, idx: number, dt: number) {
  if (!enemy.alive) return;

  enemy.aiTimer -= dt;
  if (enemy.aiTimer > 0) return;

  const id = idx + 1;
  const cellPos = worldToCell(enemy.x, enemy.y);
  const onOwnTerritory = gridAt(cellPos.x, cellPos.y)?.owner === id;

  switch (enemy.personality) {
    case AIPersonality.Cautious:
      enemy.aiTimer = 0.3;
      if (enemy.trail.length > enemy.aiLoopSize) {
        navigateToOwnTerritory(enemy, id);
      } else if (onOwnTerritory && enemy.trail.length === 0) {
        enemy.dir = pickExpandDirection(enemy, id);
      } else if (enemy.trail.length > 0) {
        if (Math.random() < 0.3) {
          enemy.dir = pickSafeDirection(enemy, id);
        }
      } else {
        enemy.dir = pickExpandDirection(enemy, id);
      }
      break;

    case AIPersonality.Aggressive:
      enemy.aiTimer = 0.2;
      if (enemy.trail.length > enemy.aiLoopSize) {
        navigateToOwnTerritory(enemy, id);
      } else if (onOwnTerritory && enemy.trail.length === 0) {
        enemy.dir = pickExpandDirection(enemy, id);
      } else {
        if (Math.random() < 0.15 || !isSafe(enemy, enemy.dir, id)) {
          enemy.dir = pickSafeDirection(enemy, id);
        }
      }
      break;

    case AIPersonality.Hunter:
      enemy.aiTimer = 0.25;
      if (enemy.trail.length > enemy.aiLoopSize) {
        navigateToOwnTerritory(enemy, id);
      } else if (player.trail.length > 0 && enemy.trail.length < 5 && player.invisTimer <= 0) {
        navigateToTarget(enemy, player.trail[player.trail.length - 1], id);
      } else if (onOwnTerritory && enemy.trail.length === 0) {
        enemy.dir = pickExpandDirection(enemy, id);
      } else {
        if (Math.random() < 0.2 || !isSafe(enemy, enemy.dir, id)) {
          enemy.dir = pickSafeDirection(enemy, id);
        }
      }
      break;
  }
}

function pickExpandDirection(p: Player, id: number): Dir {
  const cellPos = worldToCell(p.x, p.y);
  const dirs: Dir[] = [Dir.Up, Dir.Down, Dir.Left, Dir.Right];
  const validDirs: Dir[] = [];

  for (const d of dirs) {
    if (d === oppositeDir(p.dir) && p.dir !== Dir.None) continue;
    const mv = moveDir(d);
    const nx = cellPos.x + mv.x * 3;
    const ny = cellPos.y + mv.y * 3;
    if (isInBounds(nx, ny) && gridAt(nx, ny)?.owner !== id) {
      validDirs.push(d);
    }
  }

  if (validDirs.length === 0) {
    return dirs[randInt(0, 3)];
  }
  return validDirs[randInt(0, validDirs.length - 1)];
}

function pickSafeDirection(p: Player, id: number): Dir {
  const dirs: Dir[] = [Dir.Up, Dir.Down, Dir.Left, Dir.Right];
  const safeDirs: Dir[] = [];

  for (const d of dirs) {
    if (d === oppositeDir(p.dir) && p.dir !== Dir.None) continue;
    if (isSafe(p, d, id)) {
      safeDirs.push(d);
    }
  }

  if (safeDirs.length === 0) {
    return dirs[randInt(0, 3)];
  }
  return safeDirs[randInt(0, safeDirs.length - 1)];
}

function isSafe(p: Player, dir: Dir, id: number): boolean {
  const cellPos = worldToCell(p.x, p.y);
  const mv = moveDir(dir);
  for (let i = 1; i <= 3; i++) {
    const nx = cellPos.x + mv.x * i;
    const ny = cellPos.y + mv.y * i;
    if (!isInBounds(nx, ny)) return false;
    const cell = gridAt(nx, ny);
    if (cell && cell.trail === id) return false;
  }
  return true;
}

function navigateToOwnTerritory(p: Player, id: number) {
  const cellPos = worldToCell(p.x, p.y);
  let bestDist = Infinity;
  let bestDir: Dir = p.dir !== Dir.None ? p.dir : Dir.Up;

  const dirs: Dir[] = [Dir.Up, Dir.Down, Dir.Left, Dir.Right];
  for (const d of dirs) {
    if (d === oppositeDir(p.dir) && p.dir !== Dir.None && p.trail.length > 1) continue;
    const mv = moveDir(d);
    for (let dd = 1; dd <= 20; dd++) {
      const nx = cellPos.x + mv.x * dd;
      const ny = cellPos.y + mv.y * dd;
      if (!isInBounds(nx, ny)) break;
      const cell = gridAt(nx, ny);
      if (cell && cell.trail === id) break;
      if (cell && cell.owner === id) {
        if (dd < bestDist) {
          bestDist = dd;
          bestDir = d;
        }
        break;
      }
    }
  }

  p.dir = bestDir;
}

function navigateToTarget(p: Player, target: Vec2, id: number) {
  const cellPos = worldToCell(p.x, p.y);
  const dx = target.x - cellPos.x;
  const dy = target.y - cellPos.y;

  let preferDir: Dir;
  if (Math.abs(dx) > Math.abs(dy)) {
    preferDir = dx > 0 ? Dir.Right : Dir.Left;
  } else {
    preferDir = dy > 0 ? Dir.Down : Dir.Up;
  }

  if (isSafe(p, preferDir, id) && preferDir !== oppositeDir(p.dir)) {
    p.dir = preferDir;
  } else {
    p.dir = pickSafeDirection(p, id);
  }
}

// ---------------------------------------------------------------------------
// 13. Boss Logic
// ---------------------------------------------------------------------------

function updateBoss(dt: number) {
  if (!boss) return;

  boss.moveTimer -= dt;
  if (boss.moveTimer <= 0) {
    boss.moveTimer = 0.5;
    const dirs: Dir[] = [Dir.Up, Dir.Down, Dir.Left, Dir.Right];
    const bossCell = worldToCell(boss.x, boss.y);
    const playerCell = worldToCell(player.x, player.y);
    const dx = playerCell.x - bossCell.x;
    const dy = playerCell.y - bossCell.y;

    if (Math.random() < 0.5) {
      if (Math.abs(dx) > Math.abs(dy)) {
        boss.dir = dx > 0 ? Dir.Right : Dir.Left;
      } else {
        boss.dir = dy > 0 ? Dir.Down : Dir.Up;
      }
    } else {
      boss.dir = dirs[randInt(0, 3)];
    }
  }

  // Move boss
  const mv = moveDir(boss.dir);
  const speed = boss.speed * GRID_SIZE * dt * 3;
  boss.x = clamp(boss.x + mv.x * speed, arenaMinX * GRID_SIZE + 30, arenaMaxX * GRID_SIZE - 30);
  boss.y = clamp(boss.y + mv.y * speed, arenaMinY * GRID_SIZE + 30, arenaMaxY * GRID_SIZE - 30);

  // Boss territory claim
  const bossCell = worldToCell(boss.x, boss.y);
  for (let dy = -boss.size; dy <= boss.size; dy++) {
    for (let dx = -boss.size; dx <= boss.size; dx++) {
      if (dx * dx + dy * dy <= boss.size * boss.size) {
        const cx = bossCell.x + dx;
        const cy = bossCell.y + dy;
        if (isInBounds(cx, cy)) {
          const cell = grid[cy][cx];
          if (cell.trail === 0 && player.shieldTimer <= 0) {
            playerDeath();
            return;
          }
          if (cell.owner !== 99 && Math.random() < 0.02) {
            cell.owner = 99;
          }
        }
      }
    }
  }

  // Boss ability
  boss.abilityTimer -= dt;
  if (boss.abilityTimer <= 0) {
    boss.abilityTimer = 5 + Math.random() * 3;
    bossAbility();
  }

  // Check if player captured boss territory (damages boss)
  boss.territoryCount = countTerritory(99);
  if (boss.territoryCount < 10 && boss.hp > 0) {
    boss.hp--;
    boss.territoryCount = 0;
    const bc = worldToCell(boss.x, boss.y);
    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        const cx = bc.x + dx;
        const cy = bc.y + dy;
        if (isInBounds(cx, cy)) {
          grid[cy][cx].owner = 99;
          boss.territoryCount++;
        }
      }
    }
    spawnInkExplosion(boss.x, boss.y, '#ffaa00', 20);
  }

  // Boss death
  if (boss.hp <= 0) {
    spawnInkExplosion(boss.x, boss.y, '#ffdd44', 50);
    audio.playVictory();
    score += 500;
    for (let r = arenaMinY; r < arenaMaxY; r++) {
      for (let c = arenaMinX; c < arenaMaxX; c++) {
        if (grid[r][c].owner === 99) {
          grid[r][c].owner = -1;
        }
      }
    }
    boss = null;
  }

  // Collision with player
  if (player.alive && boss) {
    const d = dist(player.x, player.y, boss.x, boss.y);
    if (d < boss.size * GRID_SIZE && player.shieldTimer <= 0) {
      playerDeath();
    }
  }
}

function bossAbility() {
  if (!boss) return;
  const bossCell = worldToCell(boss.x, boss.y);

  // Fire wave - claims a line of territory
  const dirVal = randInt(1, 4) as Dir;
  const mv = moveDir(dirVal);
  for (let i = 0; i < 15; i++) {
    const cx = bossCell.x + mv.x * i;
    const cy = bossCell.y + mv.y * i;
    if (isInBounds(cx, cy)) {
      grid[cy][cx].owner = 99;
      if (grid[cy][cx].trail === 0 && player.shieldTimer <= 0) {
        playerDeath();
        return;
      }
      spawnParticle(cx * GRID_SIZE + GRID_SIZE / 2, cy * GRID_SIZE + GRID_SIZE / 2, 'explosion', '#ff4400');
    }
  }
}

// ---------------------------------------------------------------------------
// 14. Game Loop Updates
// ---------------------------------------------------------------------------

let powerUpSpawnTimer = 8;

function updateGame(dt: number) {
  if (phase !== GamePhase.Playing) return;

  // Tutorial check for first-time players
  if (!tutorialShown && tutorialStep >= 0) return;

  // Near-death slow-motion
  nearDeathWarning = checkNearDeath();
  if (nearDeathWarning && slowMoTimer <= 0) {
    slowMoTimer = 0.2;
    slowMoFactor = 0.4;
    audio.playNearMissSting();
  }
  if (slowMoTimer > 0) {
    slowMoTimer -= dt;
    dt *= slowMoFactor;
    slowMoFactor = lerp(slowMoFactor, 1.0, 0.1);
  }

  survivalTime += dt;

  // Update enhanced visual effect systems
  updateDeathCircles(dt);
  updateInkSplashAnims(dt);
  updateComboTextAnims(dt);
  updateGoldenSparkles(dt);

  // Achievement popup timer
  if (achievementPopup) {
    achievementPopup.timer -= dt;
    if (achievementPopup.timer <= 0) {
      achievementPopup = null;
    }
  }

  // Update combo timer
  if (comboTimer > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) {
      currentCombo = 0;
    }
  }

  // Process next direction for player
  if (player.nextDir !== Dir.None) {
    if (player.nextDir !== oppositeDir(player.dir) || player.trail.length === 0) {
      player.dir = player.nextDir;
    }
    player.nextDir = Dir.None;
  }

  // Update timers
  player.shieldTimer = Math.max(0, player.shieldTimer - dt);
  player.speedTimer = Math.max(0, player.speedTimer - dt);
  player.invisTimer = Math.max(0, player.invisTimer - dt);
  if (player.speedTimer <= 0) player.speed = player.baseSpeed;

  // Move player
  movePlayer(player, dt, 0);

  // Update enemies
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.alive) {
      e.respawnTimer -= dt;
      if (e.respawnTimer <= 0) {
        respawnEnemy(i);
      }
      continue;
    }
    e.shieldTimer = Math.max(0, e.shieldTimer - dt);
    e.speedTimer = Math.max(0, e.speedTimer - dt);
    if (e.speedTimer <= 0) e.speed = e.baseSpeed;
    updateAI(e, i, dt);
    movePlayer(e, dt, i + 1);
  }

  // Update boss
  if (boss) {
    updateBoss(dt);
  }

  // Power-up spawning
  powerUpSpawnTimer -= dt;
  if (powerUpSpawnTimer <= 0) {
    powerUpSpawnTimer = 8 + Math.random() * 5;
    spawnPowerUp();
  }

  // Power-up collection & timer
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const pu = powerUps[i];
    pu.timer -= dt;
    if (pu.timer <= 0) {
      powerUps.splice(i, 1);
      continue;
    }

    // Player collection
    if (player.alive && dist(player.x, player.y, pu.x, pu.y) < GRID_SIZE * 2) {
      applyPowerUp(player, pu.type);
      powerUps.splice(i, 1);
      continue;
    }

    // Enemy collection
    let collected = false;
    for (const e of enemies) {
      if (e.alive && dist(e.x, e.y, pu.x, pu.y) < GRID_SIZE * 2) {
        applyPowerUp(e, pu.type);
        collected = true;
        break;
      }
    }
    if (collected) {
      powerUps.splice(i, 1);
    }
  }

  // Arena shrinking
  shrinkTimer -= dt;
  if (shrinkTimer <= 0) {
    shrinkTimer = SHRINK_INTERVAL / 1000;
    shrinkArena();
  }

  // Update territory percent
  player.territoryCount = countTerritory(0);
  territoryPercent = (player.territoryCount / totalCells) * 100;

  // Score for territory
  score += Math.floor(player.territoryCount * 0.01);

  // Check achievements periodically
  checkAchievements();

  // Victory condition: capture 60% territory
  if (territoryPercent >= 60 && !boss) {
    levelComplete();
  }

  // Update camera
  camX = lerp(camX, player.x - W / 2, 0.1);
  camY = lerp(camY, player.y - H / 2, 0.1);
  camX = clamp(camX, arenaMinX * GRID_SIZE - 20, arenaMaxX * GRID_SIZE - W + 20);
  camY = clamp(camY, arenaMinY * GRID_SIZE - 20, arenaMaxY * GRID_SIZE - H + 20);

  // Update particles
  updateParticles(dt);
}

function shrinkArena() {
  if (arenaMaxX - arenaMinX <= 30 || arenaMaxY - arenaMinY <= 30) return;

  arenaMinX += 1;
  arenaMinY += 1;
  arenaMaxX -= 1;
  arenaMaxY -= 1;
  totalCells = (arenaMaxX - arenaMinX) * (arenaMaxY - arenaMinY);

  audio.playShrink();

  // Kill anything outside bounds
  for (let r = 0; r < ARENA_ROWS; r++) {
    for (let c = 0; c < ARENA_COLS; c++) {
      if (!isInBounds(c, r)) {
        grid[r][c].owner = -1;
        grid[r][c].trail = -1;
      }
    }
  }

  // Check if player is outside
  const pCell = worldToCell(player.x, player.y);
  if (!isInBounds(pCell.x, pCell.y)) {
    player.x = clamp(player.x, arenaMinX * GRID_SIZE + GRID_SIZE, (arenaMaxX - 1) * GRID_SIZE);
    player.y = clamp(player.y, arenaMinY * GRID_SIZE + GRID_SIZE, (arenaMaxY - 1) * GRID_SIZE);
  }

  // Move enemies inside
  for (const e of enemies) {
    const eCell = worldToCell(e.x, e.y);
    if (!isInBounds(eCell.x, eCell.y)) {
      e.x = clamp(e.x, arenaMinX * GRID_SIZE + GRID_SIZE, (arenaMaxX - 1) * GRID_SIZE);
      e.y = clamp(e.y, arenaMinY * GRID_SIZE + GRID_SIZE, (arenaMaxY - 1) * GRID_SIZE);
    }
  }

  // Spawn shrink particles at border
  for (let i = 0; i < 20; i++) {
    const side = randInt(0, 3);
    let px: number, py: number;
    switch (side) {
      case 0: px = rand(arenaMinX, arenaMaxX) * GRID_SIZE; py = arenaMinY * GRID_SIZE; break;
      case 1: px = rand(arenaMinX, arenaMaxX) * GRID_SIZE; py = arenaMaxY * GRID_SIZE; break;
      case 2: px = arenaMinX * GRID_SIZE; py = rand(arenaMinY, arenaMaxY) * GRID_SIZE; break;
      default: px = arenaMaxX * GRID_SIZE; py = rand(arenaMinY, arenaMaxY) * GRID_SIZE; break;
    }
    spawnParticle(px, py, 'ink', '#c8a96e');
  }
}

function levelComplete() {
  audio.playVictory();
  score += 200 + currentLevel * 50;
  currentLevel++;
  transitionText = `第${currentLevel}层`;
  transitionTimer = 2.5;
  phase = GamePhase.LevelTransition;

  if (passport) {
    if (!passport.completedGames.includes('mq7')) {
      passport.completedGames.push('mq7');
    }
    passport.totalScore += score;
    passport.lastPlayed = new Date().toISOString().slice(0, 10);
    savePassport();
  }
}

function startLevel() {
  initGrid();
  shrinkTimer = SHRINK_INTERVAL / 1000;
  powerUpSpawnTimer = 5;
  powerUps = [];
  particles = [];
  boss = null;
  currentCombo = 0;
  comboTimer = 0;

  // Place player at a good starting position
  const startX = Math.floor(ARENA_COLS * 0.3);
  const startY = Math.floor(ARENA_ROWS * 0.5);
  player = createPlayer(0, startX, startY);
  player.name = passport?.name || NICKNAMES[selectedNickname];
  player.dir = Dir.None;

  // Spawn enemies (more as level increases)
  const enemyCount = Math.min(2 + Math.floor(currentLevel / 2), 7);
  spawnEnemies(enemyCount);

  // Boss level
  if (currentLevel % BOSS_LEVEL_INTERVAL === 0) {
    spawnBoss(currentLevel);
  }

  // Center camera
  camX = player.x - W / 2;
  camY = player.y - H / 2;

  phase = GamePhase.Playing;
}

// ---------------------------------------------------------------------------
// 15. Drawing Functions
// ---------------------------------------------------------------------------

function drawInkWashCell(x: number, y: number, w: number, h: number, owner: number) {
  const arena = ARENAS[currentArena];
  const colorIdx = owner % arena.territoryColors.length;
  const baseColor = arena.territoryColors[colorIdx];

  ctx.fillStyle = baseColor;
  ctx.fillRect(x, y, w, h);

  // Add subtle ink-wash variation
  const seed = (Math.floor(x / GRID_SIZE) * 137 + Math.floor(y / GRID_SIZE) * 311) % 100;
  if (seed < 30) {
    ctx.globalAlpha = 0.15;
    if (owner === 0) {
      ctx.fillStyle = '#c8323280';
    } else if (owner === 99) {
      ctx.fillStyle = '#ff444480';
    } else {
      ctx.fillStyle = '#ffffff15';
    }
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
  }
}

function drawGrid() {
  const arena = ARENAS[currentArena];
  const startCol = Math.max(arenaMinX, Math.floor(camX / GRID_SIZE));
  const endCol = Math.min(arenaMaxX, Math.ceil((camX + W) / GRID_SIZE) + 1);
  const startRow = Math.max(arenaMinY, Math.floor(camY / GRID_SIZE));
  const endRow = Math.min(arenaMaxY, Math.ceil((camY + H) / GRID_SIZE) + 1);

  // Draw territory cells
  for (let r = startRow; r < endRow; r++) {
    for (let c = startCol; c < endCol; c++) {
      const cell = grid[r][c];
      const sx = c * GRID_SIZE - camX;
      const sy = r * GRID_SIZE - camY;

      if (cell.owner >= 0) {
        drawInkWashCell(sx, sy, GRID_SIZE, GRID_SIZE, cell.owner);
      }

      // Draw trail with variable brush width
      if (cell.trail >= 0) {
        const trailOwner = cell.trail;
        const color = trailOwner === 0 ? PLAYER_TRAIL_COLORS[0] :
          trailOwner === 99 ? '#ff8888' :
            PLAYER_TRAIL_COLORS[trailOwner % PLAYER_TRAIL_COLORS.length];
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = color;
        // Variable brush width based on owner speed
        const ownerPlayer = trailOwner === 0 ? player : (trailOwner > 0 && trailOwner <= enemies.length ? enemies[trailOwner - 1] : null);
        const brushW = ownerPlayer ? getTrailBrushWidth(ownerPlayer) : (GRID_SIZE - 2);
        const inset = (GRID_SIZE - brushW) / 2;
        ctx.fillRect(sx + inset, sy + inset, brushW, brushW);
        ctx.globalAlpha = 1;
      }
    }
  }

  // Draw grid lines
  ctx.strokeStyle = arena.gridColor;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let c = startCol; c <= endCol; c += 5) {
    const sx = c * GRID_SIZE - camX;
    ctx.moveTo(sx, startRow * GRID_SIZE - camY);
    ctx.lineTo(sx, endRow * GRID_SIZE - camY);
  }
  for (let r = startRow; r <= endRow; r += 5) {
    const sy = r * GRID_SIZE - camY;
    ctx.moveTo(startCol * GRID_SIZE - camX, sy);
    ctx.lineTo(endCol * GRID_SIZE - camX, sy);
  }
  ctx.stroke();

  // Draw arena boundary
  ctx.strokeStyle = '#c8a96e';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 3]);
  ctx.strokeRect(
    arenaMinX * GRID_SIZE - camX,
    arenaMinY * GRID_SIZE - camY,
    (arenaMaxX - arenaMinX) * GRID_SIZE,
    (arenaMaxY - arenaMinY) * GRID_SIZE
  );
  ctx.setLineDash([]);
}

function drawMelo(p: Player, isMainPlayer: boolean) {
  if (!p.alive) return;
  if (p.invisTimer > 0 && !isMainPlayer) return;

  const sx = p.x - camX;
  const sy = p.y - camY;

  // Skip if off screen
  if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) return;

  const alpha = (p.invisTimer > 0 && isMainPlayer) ? 0.3 : 1;
  ctx.globalAlpha = alpha;

  // Shield glow
  if (p.shieldTimer > 0) {
    ctx.beginPath();
    ctx.arc(sx, sy, 12, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(68, 170, 255, 0.3)';
    ctx.fill();
    ctx.strokeStyle = '#44aaff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Speed trail
  if (p.speedTimer > 0) {
    const smv = moveDir(p.dir);
    for (let i = 1; i <= 3; i++) {
      ctx.globalAlpha = alpha * (0.3 - i * 0.08);
      ctx.beginPath();
      ctx.arc(sx - smv.x * i * 5, sy - smv.y * i * 5, 6, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
    ctx.globalAlpha = alpha;
  }

  // Body (circle)
  ctx.beginPath();
  ctx.arc(sx, sy, 6, 0, Math.PI * 2);
  ctx.fillStyle = p.color;
  ctx.fill();
  ctx.strokeStyle = isMainPlayer ? '#ffffff' : '#aaaaaa';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Inner highlight
  ctx.beginPath();
  ctx.arc(sx - 1.5, sy - 1.5, 2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fill();

  // Red scarf for main player
  if (isMainPlayer && p.dir !== Dir.None) {
    const smv = moveDir(p.dir);
    ctx.beginPath();
    ctx.moveTo(sx - smv.x * 3, sy - smv.y * 3);
    const scarfJitter1 = Math.sin(performance.now() * 0.01) * 1.5;
    const scarfJitter2 = Math.cos(performance.now() * 0.012) * 2;
    ctx.lineTo(sx - smv.x * 10 + scarfJitter1, sy - smv.y * 10 + scarfJitter1);
    ctx.lineTo(sx - smv.x * 8 + scarfJitter2, sy - smv.y * 8 + 3);
    ctx.fillStyle = '#ff3333';
    ctx.fill();
  }

  // Direction indicator
  if (p.dir !== Dir.None) {
    const dmv = moveDir(p.dir);
    ctx.beginPath();
    ctx.moveTo(sx + dmv.x * 8, sy + dmv.y * 8);
    ctx.lineTo(sx + dmv.x * 4 + dmv.y * 3, sy + dmv.y * 4 + dmv.x * 3);
    ctx.lineTo(sx + dmv.x * 4 - dmv.y * 3, sy + dmv.y * 4 - dmv.x * 3);
    ctx.closePath();
    ctx.fillStyle = p.color;
    ctx.fill();
  }

  ctx.globalAlpha = 1;

  // Name tag
  ctx.font = '8px "Noto Serif SC", serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(p.name, sx, sy - 12);
}

function drawBoss() {
  if (!boss) return;
  const sx = boss.x - camX;
  const sy = boss.y - camY;

  if (sx < -40 || sx > W + 40 || sy < -40 || sy > H + 40) return;

  // Boss aura
  const auraSize = boss.size * GRID_SIZE + Math.sin(performance.now() / 300) * 5;
  ctx.beginPath();
  ctx.arc(sx, sy, auraSize, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, auraSize);
  grad.addColorStop(0, 'rgba(255, 68, 68, 0.4)');
  grad.addColorStop(1, 'rgba(255, 68, 68, 0)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Boss body
  ctx.beginPath();
  ctx.arc(sx, sy, boss.size * GRID_SIZE * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = '#cc2222';
  ctx.fill();
  ctx.strokeStyle = '#ff6644';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Boss eyes
  ctx.fillStyle = '#ffdd00';
  ctx.beginPath();
  ctx.arc(sx - 6, sy - 3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sx + 6, sy - 3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(sx - 6, sy - 3, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sx + 6, sy - 3, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Boss name
  ctx.font = 'bold 11px "Noto Serif SC", serif';
  ctx.fillStyle = '#ff4444';
  ctx.textAlign = 'center';
  ctx.fillText(`神兽·${boss.name}`, sx, sy - boss.size * GRID_SIZE - 5);

  // HP bar
  const hpBarW = 40;
  const hpBarH = 4;
  const hpFrac = boss.hp / boss.maxHp;
  ctx.fillStyle = '#333333';
  ctx.fillRect(sx - hpBarW / 2, sy - boss.size * GRID_SIZE - 15, hpBarW, hpBarH);
  ctx.fillStyle = hpFrac > 0.5 ? '#44ff44' : hpFrac > 0.25 ? '#ffaa00' : '#ff4444';
  ctx.fillRect(sx - hpBarW / 2, sy - boss.size * GRID_SIZE - 15, hpBarW * hpFrac, hpBarH);
}

function drawPowerUps() {
  const now = performance.now();
  for (const pu of powerUps) {
    const sx = pu.x - camX;
    const sy = pu.y - camY;
    if (sx < -15 || sx > W + 15 || sy < -15 || sy > H + 15) continue;

    const bob = Math.sin(now / 400 + pu.x) * 3;
    const color = POWERUP_COLORS[pu.type];

    // Glow
    ctx.beginPath();
    ctx.arc(sx, sy + bob, 10, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(sx, sy + bob, 0, sx, sy + bob, 10);
    grad.addColorStop(0, color + '80');
    grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad;
    ctx.fill();

    // Icon
    ctx.beginPath();
    ctx.arc(sx, sy + bob, 6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Symbol
    ctx.font = '7px "Noto Serif SC", serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const symbols = ['龙', '风', '隐', '爆'];
    ctx.fillText(symbols[pu.type], sx, sy + bob + 0.5);
    ctx.textBaseline = 'alphabetic';
  }
}

function drawParticles() {
  for (const p of particles) {
    const sx = p.x - camX;
    const sy = p.y - camY;
    if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;

    ctx.globalAlpha = p.alpha;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(p.rot);

    switch (p.type) {
      case 'ink':
      case 'splash':
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        break;
      case 'spark':
      case 'golden':
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        break;
      case 'brush':
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size / 3, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'explosion':
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (1 + (1 - p.alpha) * 0.5), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        break;
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

function drawJoystick() {
  if (!joystickActive) return;

  // Outer ring
  ctx.beginPath();
  ctx.arc(joystickOrigin.x, joystickOrigin.y, 45, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(200, 169, 110, 0.15)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(200, 169, 110, 0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner knob
  const dx = joystickCurrent.x - joystickOrigin.x;
  const dy = joystickCurrent.y - joystickOrigin.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const maxDist = 35;
  const knobX = joystickOrigin.x + (d > maxDist ? dx / d * maxDist : dx);
  const knobY = joystickOrigin.y + (d > maxDist ? dy / d * maxDist : dy);

  ctx.beginPath();
  ctx.arc(knobX, knobY, 15, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(200, 169, 110, 0.5)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(200, 169, 110, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawHUD() {
  // Top bar background
  ctx.fillStyle = 'rgba(10, 10, 22, 0.7)';
  ctx.fillRect(0, 0, W, 50);

  // Pause button (top-left)
  ctx.fillStyle = '#c8a96e';
  ctx.font = '18px "Noto Serif SC", serif';
  ctx.textAlign = 'left';
  ctx.fillText(isPaused ? '▶' : '⏸', 12, 32);

  // Mute button (top-right)
  ctx.textAlign = 'right';
  ctx.fillText(isMuted ? '♪' : '♫', W - 12, 32);

  // Territory %
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px "Noto Serif SC", serif';
  ctx.fillStyle = '#c8a96e';
  ctx.fillText(`领地 ${territoryPercent.toFixed(1)}%`, W / 2, 20);

  // Score
  ctx.font = '11px "Noto Serif SC", serif';
  ctx.fillStyle = '#aaaaaa';
  ctx.fillText(`得分: ${score}`, W / 2, 38);

  // Level indicator
  ctx.textAlign = 'left';
  ctx.font = '10px "Noto Serif SC", serif';
  ctx.fillStyle = '#c8a96e';
  ctx.fillText(`Lv.${currentLevel}`, 50, 20);

  // Arena name
  ctx.fillText(ARENAS[currentArena].nameCN, 50, 38);

  // Kills & combo
  ctx.textAlign = 'right';
  ctx.fillText(`击杀: ${player.kills}`, W - 50, 20);
  if (currentCombo > 1) {
    ctx.fillStyle = '#ffaa00';
    ctx.font = 'bold 12px "Noto Serif SC", serif';
    ctx.fillText(`连击 x${currentCombo}`, W - 50, 38);
  }

  // Power-up indicators
  let indicatorY = 60;
  ctx.textAlign = 'left';
  ctx.font = '9px "Noto Serif SC", serif';
  if (player.shieldTimer > 0) {
    ctx.fillStyle = '#44aaff';
    ctx.fillText(`墨龙护身 ${player.shieldTimer.toFixed(1)}s`, 10, indicatorY);
    indicatorY += 14;
  }
  if (player.speedTimer > 0) {
    ctx.fillStyle = '#44ff88';
    ctx.fillText(`疾风步 ${player.speedTimer.toFixed(1)}s`, 10, indicatorY);
    indicatorY += 14;
  }
  if (player.invisTimer > 0) {
    ctx.fillStyle = '#aa88ff';
    ctx.fillText(`隐身墨 ${player.invisTimer.toFixed(1)}s`, 10, indicatorY);
    indicatorY += 14;
  }

  // Minimap (bottom-right)
  drawMinimap();

  // Survival time
  ctx.font = '9px "Noto Serif SC", serif';
  ctx.fillStyle = '#888888';
  ctx.textAlign = 'left';
  const minutes = Math.floor(survivalTime / 60);
  const seconds = Math.floor(survivalTime % 60);
  ctx.fillText(`${minutes}:${seconds.toString().padStart(2, '0')}`, 10, H - 10);

  // Boss HP bar at top
  if (boss) {
    const barW = W - 80;
    const barH = 6;
    const barX = 40;
    const barY = 55;
    ctx.fillStyle = '#333333';
    ctx.fillRect(barX, barY, barW, barH);
    const hpFrac = boss.hp / boss.maxHp;
    ctx.fillStyle = hpFrac > 0.5 ? '#ff4444' : '#ff8800';
    ctx.fillRect(barX, barY, barW * hpFrac, barH);
    ctx.font = '9px "Noto Serif SC", serif';
    ctx.fillStyle = '#ff6644';
    ctx.textAlign = 'center';
    ctx.fillText(`神兽·${boss.name} HP:${boss.hp}/${boss.maxHp}`, W / 2, barY - 2);
  }
}

function drawMinimap() {
  const mmW = 80;
  const mmH = 80;
  const mmX = W - mmW - 8;
  const mmY = H - mmH - 8;
  const scaleX = mmW / (arenaMaxX - arenaMinX);
  const scaleY = mmH / (arenaMaxY - arenaMinY);

  // Background
  ctx.fillStyle = 'rgba(10, 10, 22, 0.8)';
  ctx.fillRect(mmX, mmY, mmW, mmH);
  ctx.strokeStyle = 'rgba(200, 169, 110, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mmX, mmY, mmW, mmH);

  // Territory (sampled for performance)
  const step = 3;
  for (let r = arenaMinY; r < arenaMaxY; r += step) {
    for (let c = arenaMinX; c < arenaMaxX; c += step) {
      const cell = grid[r][c];
      if (cell.owner >= 0) {
        const color = cell.owner === 0 ? '#c83232' :
          cell.owner === 99 ? '#ff4444' :
            PLAYER_COLORS[cell.owner % PLAYER_COLORS.length];
        ctx.fillStyle = color;
        ctx.fillRect(
          mmX + (c - arenaMinX) * scaleX,
          mmY + (r - arenaMinY) * scaleY,
          scaleX * step + 0.5,
          scaleY * step + 0.5
        );
      }
    }
  }

  // Player position
  const px = mmX + (player.x / GRID_SIZE - arenaMinX) * scaleX;
  const py = mmY + (player.y / GRID_SIZE - arenaMinY) * scaleY;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(px, py, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Camera viewport
  const vpX = mmX + (camX / GRID_SIZE - arenaMinX) * scaleX;
  const vpY = mmY + (camY / GRID_SIZE - arenaMinY) * scaleY;
  const vpW = (W / GRID_SIZE) * scaleX;
  const vpH = (H / GRID_SIZE) * scaleY;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(vpX, vpY, vpW, vpH);
}

// ---------------------------------------------------------------------------
// 16. UI Screens
// ---------------------------------------------------------------------------

function drawTitleScreen() {
  titleTimer += 0.016;
  titleAlpha = Math.min(1, titleAlpha + 0.02);

  ctx.fillStyle = '#0a0a16';
  ctx.fillRect(0, 0, W, H);

  // Decorative ink wash background
  ctx.globalAlpha = 0.15;
  for (let i = 0; i < 8; i++) {
    const x = W * 0.2 + Math.sin(titleTimer * 0.3 + i * 0.8) * 80;
    const y = H * 0.3 + Math.cos(titleTimer * 0.2 + i * 1.1) * 60;
    const r = 50 + Math.sin(titleTimer * 0.5 + i) * 20;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, '#c8a96e');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;

  // Title
  ctx.globalAlpha = titleAlpha;
  ctx.font = 'bold 36px "Noto Serif SC", serif';
  ctx.fillStyle = '#c8a96e';
  ctx.textAlign = 'center';
  ctx.fillText('水墨画疆', W / 2, H * 0.22);

  ctx.font = '14px "Noto Serif SC", serif';
  ctx.fillStyle = '#8a7a5e';
  ctx.fillText('Ink Territory', W / 2, H * 0.27);

  // Subtitle
  ctx.font = '12px "Noto Serif SC", serif';
  ctx.fillStyle = '#6a6a6a';
  ctx.fillText('麦洛的冒险 · 第七章', W / 2, H * 0.32);

  // Ink wash decoration
  ctx.strokeStyle = '#c8a96e40';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W * 0.2, H * 0.35);
  ctx.bezierCurveTo(W * 0.4, H * 0.34, W * 0.6, H * 0.36, W * 0.8, H * 0.35);
  ctx.stroke();

  // Instructions
  ctx.font = '13px "Noto Serif SC", serif';
  ctx.fillStyle = '#c8a96e';
  const instructions = [
    '控制麦洛留下墨迹',
    '回到领地形成闭环',
    '围住区域占领领地',
    '小心敌人切断你的墨迹！',
  ];
  instructions.forEach((text, i) => {
    ctx.fillText(text, W / 2, H * 0.42 + i * 24);
  });

  // Game features
  ctx.font = '10px "Noto Serif SC", serif';
  ctx.fillStyle = '#8a7a5e';
  const features = ['五大主题竞技场', '智能AI对手', '神兽Boss战', '道具系统'];
  features.forEach((text, i) => {
    const x = W * 0.25 + (i % 2) * W * 0.5;
    const y = H * 0.57 + Math.floor(i / 2) * 20;
    ctx.fillText(text, x, y);
  });

  // Start button
  const btnW = 180;
  const btnH = 48;
  const btnX = (W - btnW) / 2;
  const btnY = H * 0.68;
  const pulse = Math.sin(titleTimer * 3) * 0.1 + 0.9;

  ctx.fillStyle = `rgba(200, 169, 110, ${0.15 * pulse})`;
  ctx.strokeStyle = '#c8a96e';
  ctx.lineWidth = 2;
  roundRect(btnX, btnY, btnW, btnH, 8);
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 18px "Noto Serif SC", serif';
  ctx.fillStyle = '#c8a96e';
  ctx.fillText('开始游戏', W / 2, btnY + 30);

  // Mute button (top-right)
  ctx.font = '18px "Noto Serif SC", serif';
  ctx.textAlign = 'right';
  ctx.fillText(isMuted ? '♪' : '♫', W - 12, 32);
  ctx.textAlign = 'center';

  // High score
  if (highScore > 0) {
    ctx.font = '11px "Noto Serif SC", serif';
    ctx.fillStyle = '#6a6a6a';
    ctx.fillText(`最高分: ${highScore}`, W / 2, H * 0.82);
  }

  // Passport name
  if (passport?.name) {
    ctx.font = '10px "Noto Serif SC", serif';
    ctx.fillStyle = '#8a7a5e';
    ctx.fillText(`旅人: ${passport.name}`, W / 2, H * 0.88);
  }

  // Achievement stamps on title
  const anyUnlocked = achievements.some(a => a.unlocked);
  if (anyUnlocked) {
    ctx.font = '9px "Noto Serif SC", serif';
    ctx.fillStyle = '#6a6a6a';
    ctx.fillText('成就印章', W / 2, H * 0.89);
    drawAchievementStamps(W / 2, H * 0.90);
  }

  // Version
  ctx.font = '9px "Noto Serif SC", serif';
  ctx.fillStyle = '#444444';
  ctx.fillText('v1.1 · JoyBoy Games', W / 2, H * 0.97);

  ctx.globalAlpha = 1;
}

function drawNicknameScreen() {
  ctx.fillStyle = '#0a0a16';
  ctx.fillRect(0, 0, W, H);

  ctx.font = 'bold 22px "Noto Serif SC", serif';
  ctx.fillStyle = '#c8a96e';
  ctx.textAlign = 'center';
  ctx.fillText('选择称号', W / 2, H * 0.12);

  ctx.font = '11px "Noto Serif SC", serif';
  ctx.fillStyle = '#8a7a5e';
  ctx.fillText('以何名号行走于水墨之间？', W / 2, H * 0.17);

  // Nickname buttons
  const cols = 2;
  const btnW = 150;
  const btnH = 40;
  const gapX = 15;
  const gapY = 10;
  const startX = (W - (cols * btnW + (cols - 1) * gapX)) / 2;
  const startY = H * 0.22;

  for (let i = 0; i < NICKNAMES.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * (btnW + gapX);
    const y = startY + row * (btnH + gapY);

    const selected = i === selectedNickname;
    ctx.fillStyle = selected ? 'rgba(200, 169, 110, 0.2)' : 'rgba(60, 60, 80, 0.3)';
    ctx.strokeStyle = selected ? '#c8a96e' : '#4a4a6a';
    ctx.lineWidth = selected ? 2 : 1;
    roundRect(x, y, btnW, btnH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.font = selected ? 'bold 14px "Noto Serif SC", serif' : '13px "Noto Serif SC", serif';
    ctx.fillStyle = selected ? '#c8a96e' : '#8a8a9a';
    ctx.fillText(NICKNAMES[i], x + btnW / 2, y + btnH / 2 + 5);
  }

  // Confirm button
  const confirmY = startY + Math.ceil(NICKNAMES.length / cols) * (btnH + gapY) + 20;
  ctx.fillStyle = 'rgba(200, 169, 110, 0.15)';
  ctx.strokeStyle = '#c8a96e';
  ctx.lineWidth = 2;
  roundRect((W - 160) / 2, confirmY, 160, 44, 8);
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 16px "Noto Serif SC", serif';
  ctx.fillStyle = '#c8a96e';
  ctx.fillText('确认', W / 2, confirmY + 28);
}

function drawArenaSelect() {
  ctx.fillStyle = '#0a0a16';
  ctx.fillRect(0, 0, W, H);

  ctx.font = 'bold 22px "Noto Serif SC", serif';
  ctx.fillStyle = '#c8a96e';
  ctx.textAlign = 'center';
  ctx.fillText('选择竞技场', W / 2, H * 0.08);

  const cardW = W - 40;
  const cardH = 100;
  const gap = 10;
  const startY = H * 0.12;

  for (let i = 0; i < ARENAS.length; i++) {
    const arena = ARENAS[i];
    const y = startY + i * (cardH + gap);
    const selected = i === currentArena;

    // Card background
    ctx.fillStyle = selected ? arena.bgColor : '#0e0e1e';
    ctx.strokeStyle = selected ? '#c8a96e' : '#3a3a5a';
    ctx.lineWidth = selected ? 2 : 1;
    roundRect(20, y, cardW, cardH, 8);
    ctx.fill();
    ctx.stroke();

    // Arena preview - mini ink wash circles
    ctx.globalAlpha = 0.3;
    for (let j = 0; j < 3; j++) {
      const cx = 60 + j * 25;
      const cy = y + 50;
      ctx.fillStyle = arena.territoryColors[j];
      ctx.beginPath();
      ctx.arc(cx, cy, 15, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Arena name
    ctx.font = selected ? 'bold 18px "Noto Serif SC", serif' : '16px "Noto Serif SC", serif';
    ctx.fillStyle = selected ? '#c8a96e' : '#8a8a9a';
    ctx.textAlign = 'left';
    ctx.fillText(arena.nameCN, 140, y + 35);

    ctx.font = '10px "Noto Serif SC", serif';
    ctx.fillStyle = '#6a6a6a';
    ctx.fillText(arena.name, 140, y + 52);

    ctx.font = '11px "Noto Serif SC", serif';
    ctx.fillStyle = selected ? '#aaa08e' : '#5a5a6a';
    ctx.fillText(arena.description, 140, y + 72);

    // Selection indicator
    if (selected) {
      ctx.fillStyle = '#c8a96e';
      ctx.beginPath();
      ctx.arc(cardW + 5, y + cardH / 2, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Start button
  const btnY = startY + ARENAS.length * (cardH + gap) + 10;
  ctx.fillStyle = 'rgba(200, 169, 110, 0.15)';
  ctx.strokeStyle = '#c8a96e';
  ctx.lineWidth = 2;
  roundRect((W - 180) / 2, btnY, 180, 48, 8);
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 18px "Noto Serif SC", serif';
  ctx.fillStyle = '#c8a96e';
  ctx.textAlign = 'center';
  ctx.fillText('进入竞技场', W / 2, btnY + 30);
}

function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(10, 10, 22, 0.7)';
  ctx.fillRect(0, 0, W, H);

  ctx.font = 'bold 28px "Noto Serif SC", serif';
  ctx.fillStyle = '#c8a96e';
  ctx.textAlign = 'center';
  ctx.fillText('暂停', W / 2, H * 0.35);

  ctx.font = '13px "Noto Serif SC", serif';
  ctx.fillStyle = '#8a7a5e';
  ctx.fillText(`领地: ${territoryPercent.toFixed(1)}%  得分: ${score}`, W / 2, H * 0.42);
  ctx.fillText(`击杀: ${player.kills}  最高连击: ${player.maxCombo}`, W / 2, H * 0.47);

  // Resume button
  ctx.fillStyle = 'rgba(200, 169, 110, 0.15)';
  ctx.strokeStyle = '#c8a96e';
  ctx.lineWidth = 2;
  roundRect((W - 160) / 2, H * 0.55, 160, 44, 8);
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 16px "Noto Serif SC", serif';
  ctx.fillStyle = '#c8a96e';
  ctx.fillText('继续', W / 2, H * 0.55 + 28);

  // Quit button
  ctx.fillStyle = 'rgba(100, 50, 50, 0.15)';
  ctx.strokeStyle = '#aa6666';
  ctx.lineWidth = 1;
  roundRect((W - 140) / 2, H * 0.65, 140, 38, 6);
  ctx.fill();
  ctx.stroke();

  ctx.font = '14px "Noto Serif SC", serif';
  ctx.fillStyle = '#aa6666';
  ctx.fillText('退出', W / 2, H * 0.65 + 24);
}

function drawGameOverScreen() {
  ctx.fillStyle = 'rgba(10, 10, 22, 0.85)';
  ctx.fillRect(0, 0, W, H);

  // Ink splash effect
  for (let i = 0; i < 5; i++) {
    const x = W * 0.3 + Math.sin(i * 1.3) * 80;
    const y = H * 0.25 + Math.cos(i * 0.9) * 40;
    const r = 30 + i * 10;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(60, 30, 30, ${0.3 - i * 0.05})`;
    ctx.fill();
  }

  ctx.font = 'bold 32px "Noto Serif SC", serif';
  ctx.fillStyle = '#c83232';
  ctx.textAlign = 'center';
  ctx.fillText('墨迹消散', W / 2, H * 0.25);

  ctx.font = '12px "Noto Serif SC", serif';
  ctx.fillStyle = '#8a6a6a';
  ctx.fillText('Game Over', W / 2, H * 0.30);

  // Stats
  ctx.font = '14px "Noto Serif SC", serif';
  ctx.fillStyle = '#c8a96e';
  const stats = [
    `得分: ${score}`,
    `领地: ${territoryPercent.toFixed(1)}%`,
    `击杀: ${player.kills}`,
    `最高连击: ${player.maxCombo}`,
    `存活时间: ${Math.floor(survivalTime / 60)}:${Math.floor(survivalTime % 60).toString().padStart(2, '0')}`,
    `层数: ${currentLevel}`,
  ];
  stats.forEach((text, i) => {
    ctx.fillText(text, W / 2, H * 0.38 + i * 26);
  });

  if (score >= highScore && score > 0) {
    ctx.font = 'bold 14px "Noto Serif SC", serif';
    ctx.fillStyle = '#ffaa00';
    ctx.fillText('新纪录！', W / 2, H * 0.38 + stats.length * 26 + 10);
  }

  // Achievement stamps
  drawAchievementStamps(W / 2, H * 0.62);

  // Retry button
  const btnY = H * 0.72;
  ctx.fillStyle = 'rgba(200, 169, 110, 0.15)';
  ctx.strokeStyle = '#c8a96e';
  ctx.lineWidth = 2;
  roundRect((W - 160) / 2, btnY, 160, 44, 8);
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 16px "Noto Serif SC", serif';
  ctx.fillStyle = '#c8a96e';
  ctx.textAlign = 'center';
  ctx.fillText('再来一次', W / 2, btnY + 28);

  // Share card button
  const shareY = btnY + 54;
  ctx.fillStyle = 'rgba(100, 80, 50, 0.15)';
  ctx.strokeStyle = '#aa8844';
  ctx.lineWidth = 1.5;
  roundRect((W - 160) / 2, shareY, 160, 38, 6);
  ctx.fill();
  roundRect((W - 160) / 2, shareY, 160, 38, 6);
  ctx.stroke();

  ctx.font = '13px "Noto Serif SC", serif';
  ctx.fillStyle = '#aa8844';
  ctx.fillText('战绩卡片', W / 2, shareY + 24);

  // Back to title
  const backY = shareY + 48;
  ctx.fillStyle = 'rgba(80, 80, 100, 0.15)';
  ctx.strokeStyle = '#6a6a8a';
  ctx.lineWidth = 1;
  roundRect((W - 140) / 2, backY, 140, 38, 6);
  ctx.fill();
  roundRect((W - 140) / 2, backY, 140, 38, 6);
  ctx.stroke();

  ctx.font = '13px "Noto Serif SC", serif';
  ctx.fillStyle = '#8a8a9a';
  ctx.fillText('返回主页', W / 2, backY + 24);
}

function drawLevelTransition() {
  transitionTimer -= 0.016;

  ctx.fillStyle = 'rgba(10, 10, 22, 0.9)';
  ctx.fillRect(0, 0, W, H);

  const progress = 1 - transitionTimer / 2.5;
  const scale = 0.5 + Math.sin(progress * Math.PI) * 0.5;

  ctx.save();
  ctx.translate(W / 2, H * 0.4);
  ctx.scale(scale, scale);

  ctx.font = 'bold 28px "Noto Serif SC", serif';
  ctx.fillStyle = '#c8a96e';
  ctx.textAlign = 'center';
  ctx.fillText(transitionText, 0, 0);

  ctx.font = '14px "Noto Serif SC", serif';
  ctx.fillStyle = '#8a7a5e';
  const isBossLevel = currentLevel % BOSS_LEVEL_INTERVAL === 0;
  ctx.fillText(isBossLevel ? '神兽降临...' : '领地已定，新局开始', 0, 35);

  ctx.restore();

  if (transitionTimer <= 0) {
    startLevel();
  }
}

// Utility: rounded rectangle
function roundRect(x: number, y: number, w: number, h: number, r: number) {
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

// ---------------------------------------------------------------------------
// 17. Input Handling
// ---------------------------------------------------------------------------

function getCanvasCoords(clientX: number, clientY: number): Vec2 {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (W / rect.width),
    y: (clientY - rect.top) * (H / rect.height),
  };
}

function handleTitleTap(pos: Vec2) {
  audio.init();

  // Mute button
  if (pos.x > W - 40 && pos.y < 45) {
    isMuted = !isMuted;
    saveMuteState(isMuted);
    audio.setMute(isMuted);
    return;
  }

  // Start button area
  const btnY = H * 0.68;
  if (pos.y >= btnY && pos.y <= btnY + 48 && pos.x >= (W - 180) / 2 && pos.x <= (W + 180) / 2) {
    audio.playMenuClick();
    if (passport?.name) {
      phase = GamePhase.ArenaSelect;
    } else {
      phase = GamePhase.Nickname;
    }
  }
}

function handleNicknameTap(pos: Vec2) {
  const cols = 2;
  const btnW = 150;
  const btnH = 40;
  const gapX = 15;
  const gapY = 10;
  const startX = (W - (cols * btnW + (cols - 1) * gapX)) / 2;
  const startY = H * 0.22;

  // Nickname selection
  for (let i = 0; i < NICKNAMES.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * (btnW + gapX);
    const y = startY + row * (btnH + gapY);
    if (pos.x >= x && pos.x <= x + btnW && pos.y >= y && pos.y <= y + btnH) {
      selectedNickname = i;
      audio.playMenuClick();
      return;
    }
  }

  // Confirm button
  const confirmY = startY + Math.ceil(NICKNAMES.length / cols) * (btnH + gapY) + 20;
  if (pos.y >= confirmY && pos.y <= confirmY + 44 && pos.x >= (W - 160) / 2 && pos.x <= (W + 160) / 2) {
    audio.playMenuClick();
    if (!passport) {
      passport = {
        name: NICKNAMES[selectedNickname],
        avatar: '',
        gamesPlayed: 0,
        completedGames: [],
        currentStreak: 0,
        totalScore: 0,
        lastPlayed: new Date().toISOString().slice(0, 10),
      };
    } else {
      passport.name = NICKNAMES[selectedNickname];
    }
    savePassport();
    phase = GamePhase.ArenaSelect;
  }
}

function handleArenaSelectTap(pos: Vec2) {
  const cardW = W - 40;
  const cardH = 100;
  const gap = 10;
  const startY = H * 0.12;

  // Arena cards
  for (let i = 0; i < ARENAS.length; i++) {
    const y = startY + i * (cardH + gap);
    if (pos.x >= 20 && pos.x <= 20 + cardW && pos.y >= y && pos.y <= y + cardH) {
      currentArena = i;
      audio.playMenuClick();
      return;
    }
  }

  // Start button
  const btnY = startY + ARENAS.length * (cardH + gap) + 10;
  if (pos.y >= btnY && pos.y <= btnY + 48 && pos.x >= (W - 180) / 2 && pos.x <= (W + 180) / 2) {
    audio.playMenuClick();
    currentLevel = 1;
    score = 0;
    survivalTime = 0;
    shieldUsedThisRound = false;
    aiTrappedInLoop = false;
    audio.startEnhancedBGM();
    startLevel();

    // Show tutorial for first-time players
    if (!loadTutorialState()) {
      tutorialStep = 0;
      tutorialAlpha = 0;
      tutorialShown = false;
    } else {
      tutorialShown = true;
    }
  }
}

function handlePlayingTap(pos: Vec2) {
  // Pause button
  if (pos.x < 40 && pos.y < 50) {
    isPaused = true;
    phase = GamePhase.Paused;
    return;
  }

  // Mute button
  if (pos.x > W - 40 && pos.y < 50) {
    isMuted = !isMuted;
    saveMuteState(isMuted);
    audio.setMute(isMuted);
    return;
  }
}

function handlePauseTap(pos: Vec2) {
  // Resume button
  const resumeY = H * 0.55;
  if (pos.y >= resumeY && pos.y <= resumeY + 44 && pos.x >= (W - 160) / 2 && pos.x <= (W + 160) / 2) {
    isPaused = false;
    phase = GamePhase.Playing;
    audio.playMenuClick();
    return;
  }

  // Quit button
  const quitY = H * 0.65;
  if (pos.y >= quitY && pos.y <= quitY + 38 && pos.x >= (W - 140) / 2 && pos.x <= (W + 140) / 2) {
    isPaused = false;
    audio.stopBGM();
    audio.stopEnhancedBGM();
    phase = GamePhase.Title;
    titleAlpha = 0;
    audio.playMenuClick();
    return;
  }
}

function handleGameOverTap(pos: Vec2) {
  // Check share card overlay first
  if (showShareCard) {
    handleShareCardTap(pos);
    return;
  }

  // Retry button
  const btnY = H * 0.72;
  if (pos.y >= btnY && pos.y <= btnY + 44 && pos.x >= (W - 160) / 2 && pos.x <= (W + 160) / 2) {
    audio.playMenuClick();
    score = 0;
    survivalTime = 0;
    currentLevel = 1;
    shieldUsedThisRound = false;
    aiTrappedInLoop = false;
    startLevel();
    return;
  }

  // Share card button
  const shareY = btnY + 54;
  if (pos.y >= shareY && pos.y <= shareY + 38 && pos.x >= (W - 160) / 2 && pos.x <= (W + 160) / 2) {
    audio.playMenuClick();
    if (!shareCardCanvas) {
      shareCardCanvas = generateShareCard();
    }
    showShareCard = true;
    return;
  }

  // Back to title
  const backY = shareY + 48;
  if (pos.y >= backY && pos.y <= backY + 38 && pos.x >= (W - 140) / 2 && pos.x <= (W + 140) / 2) {
    audio.playMenuClick();
    audio.stopBGM();
    audio.stopEnhancedBGM();
    phase = GamePhase.Title;
    titleAlpha = 0;
    return;
  }
}

// Touch events
canvas.addEventListener('touchstart', (e: TouchEvent) => {
  e.preventDefault();
  const touch = e.touches[0];
  const pos = getCanvasCoords(touch.clientX, touch.clientY);

  switch (phase) {
    case GamePhase.Title: handleTitleTap(pos); break;
    case GamePhase.Nickname: handleNicknameTap(pos); break;
    case GamePhase.ArenaSelect: handleArenaSelectTap(pos); break;
    case GamePhase.Playing:
      if (tutorialStep >= 0) {
        handleTutorialTap(pos);
        break;
      }
      handlePlayingTap(pos);
      if (pos.y > 50) {
        joystickActive = true;
        joystickOrigin = { x: pos.x, y: pos.y };
        joystickCurrent = { x: pos.x, y: pos.y };
      }
      break;
    case GamePhase.Paused: handlePauseTap(pos); break;
    case GamePhase.GameOver: handleGameOverTap(pos); break;
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e: TouchEvent) => {
  e.preventDefault();
  if (!joystickActive || phase !== GamePhase.Playing) return;
  const touch = e.touches[0];
  const pos = getCanvasCoords(touch.clientX, touch.clientY);
  joystickCurrent = { x: pos.x, y: pos.y };

  const dx = joystickCurrent.x - joystickOrigin.x;
  const dy = joystickCurrent.y - joystickOrigin.y;
  const d = Math.sqrt(dx * dx + dy * dy);

  if (d > JOYSTICK_DEADZONE) {
    if (Math.abs(dx) > Math.abs(dy)) {
      player.nextDir = dx > 0 ? Dir.Right : Dir.Left;
    } else {
      player.nextDir = dy > 0 ? Dir.Down : Dir.Up;
    }
  }
}, { passive: false });

canvas.addEventListener('touchend', (e: TouchEvent) => {
  e.preventDefault();
  joystickActive = false;
}, { passive: false });

// Mouse events (desktop testing)
canvas.addEventListener('mousedown', (e: MouseEvent) => {
  const pos = getCanvasCoords(e.clientX, e.clientY);
  switch (phase) {
    case GamePhase.Title: handleTitleTap(pos); break;
    case GamePhase.Nickname: handleNicknameTap(pos); break;
    case GamePhase.ArenaSelect: handleArenaSelectTap(pos); break;
    case GamePhase.Playing:
      if (tutorialStep >= 0) {
        handleTutorialTap(pos);
        break;
      }
      handlePlayingTap(pos);
      if (pos.y > 50) {
        joystickActive = true;
        joystickOrigin = { x: pos.x, y: pos.y };
        joystickCurrent = { x: pos.x, y: pos.y };
      }
      break;
    case GamePhase.Paused: handlePauseTap(pos); break;
    case GamePhase.GameOver: handleGameOverTap(pos); break;
  }
});

canvas.addEventListener('mousemove', (e: MouseEvent) => {
  if (!joystickActive || phase !== GamePhase.Playing) return;
  const pos = getCanvasCoords(e.clientX, e.clientY);
  joystickCurrent = { x: pos.x, y: pos.y };

  const dx = joystickCurrent.x - joystickOrigin.x;
  const dy = joystickCurrent.y - joystickOrigin.y;
  const d = Math.sqrt(dx * dx + dy * dy);

  if (d > JOYSTICK_DEADZONE) {
    if (Math.abs(dx) > Math.abs(dy)) {
      player.nextDir = dx > 0 ? Dir.Right : Dir.Left;
    } else {
      player.nextDir = dy > 0 ? Dir.Down : Dir.Up;
    }
  }
});

canvas.addEventListener('mouseup', () => {
  joystickActive = false;
});

// Keyboard (desktop)
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (phase === GamePhase.Playing) {
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W':
        player.nextDir = Dir.Up; break;
      case 'ArrowDown': case 's': case 'S':
        player.nextDir = Dir.Down; break;
      case 'ArrowLeft': case 'a': case 'A':
        player.nextDir = Dir.Left; break;
      case 'ArrowRight': case 'd': case 'D':
        player.nextDir = Dir.Right; break;
      case 'Escape': case 'p': case 'P':
        isPaused = true;
        phase = GamePhase.Paused;
        break;
      case 'm': case 'M':
        isMuted = !isMuted;
        saveMuteState(isMuted);
        audio.setMute(isMuted);
        break;
    }
  } else if (phase === GamePhase.Paused) {
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      isPaused = false;
      phase = GamePhase.Playing;
    }
  } else if (phase === GamePhase.Title) {
    if (e.key === 'Enter' || e.key === ' ') {
      audio.init();
      if (passport?.name) {
        phase = GamePhase.ArenaSelect;
      } else {
        phase = GamePhase.Nickname;
      }
    }
  }
});

// ---------------------------------------------------------------------------
// 18. Main Game Loop
// ---------------------------------------------------------------------------

let lastTime = 0;

function gameLoop(timestamp: number) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  // Clear
  const arena = ARENAS[currentArena];
  ctx.fillStyle = phase === GamePhase.Playing || phase === GamePhase.Paused ? arena.bgColor : '#0a0a16';
  ctx.fillRect(0, 0, W, H);

  switch (phase) {
    case GamePhase.Title:
      drawTitleScreen();
      break;

    case GamePhase.Nickname:
      drawNicknameScreen();
      break;

    case GamePhase.ArenaSelect:
      drawArenaSelect();
      break;

    case GamePhase.Playing:
      updateGame(dt);
      drawGrid();
      drawPowerUps();
      drawInkSplashAnims();
      drawDeathCircles();
      drawParticles();
      drawGoldenSparkles();
      for (const e of enemies) {
        drawMelo(e, false);
      }
      if (boss) drawBoss();
      drawMelo(player, true);
      drawComboTextAnims();
      drawJoystick();
      drawHUD();
      drawAchievementPopup();
      // Near-death warning vignette
      if (nearDeathWarning) {
        ctx.globalAlpha = 0.15 + Math.sin(performance.now() * 0.01) * 0.08;
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(0, 0, W, 5);
        ctx.fillRect(0, H - 5, W, 5);
        ctx.fillRect(0, 0, 5, H);
        ctx.fillRect(W - 5, 0, 5, H);
        ctx.globalAlpha = 1;
      }
      // Tutorial overlay (on top of game)
      if (tutorialStep >= 0) {
        drawTutorialOverlay();
      }
      break;

    case GamePhase.Paused:
      drawGrid();
      drawPowerUps();
      drawInkSplashAnims();
      drawDeathCircles();
      drawParticles();
      drawGoldenSparkles();
      for (const e of enemies) drawMelo(e, false);
      if (boss) drawBoss();
      drawMelo(player, true);
      drawComboTextAnims();
      drawHUD();
      drawPauseOverlay();
      break;

    case GamePhase.GameOver:
      drawGrid();
      drawDeathCircles();
      drawParticles();
      if (showShareCard) {
        drawShareCardOverlay();
      } else {
        drawGameOverScreen();
      }
      break;

    case GamePhase.LevelTransition:
      drawLevelTransition();
      break;
  }

  requestAnimationFrame(gameLoop);
}

// ---------------------------------------------------------------------------
// 19. Init
// ---------------------------------------------------------------------------

isMuted = loadMuteState();
highScore = loadHighScore();
loadPassport();
initAchievements();

// Initialize a default player object so references don't fail before game starts
player = {
  x: 0, y: 0, dir: Dir.None, nextDir: Dir.None,
  speed: 1.8, baseSpeed: 1.8, alive: false, trail: [],
  territoryCount: 0, color: '#c83232', trailColor: '#ff5050',
  name: '', shieldTimer: 0, speedTimer: 0, invisTimer: 0,
  kills: 0, combos: 0, maxCombo: 0, respawnTimer: 0,
  personality: AIPersonality.Cautious, aiTimer: 0,
  aiTargetDir: Dir.Up, aiLoopSize: 6, aiStepsInLoop: 0, aiPhase: 0,
};

requestAnimationFrame(gameLoop);
