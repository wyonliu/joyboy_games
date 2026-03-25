// ═══════════════════════════════════════════════════════════════════════════
// 麦洛的冒险：扶摇万里 Melo's Quest: Soaring Winds
// A one-tap precision flying game with Chinese ink-wash art style
// and Shanhai Jing mythology theme.
// ═══════════════════════════════════════════════════════════════════════════

// ── Constants ──────────────────────────────────────────────────────────────
const W = 390;
const H = 844;
const GRAVITY = 680; // px/s^2
const FLAP_VEL = -260; // px/s upward
const PLAYER_RADIUS = 14;
const NEAR_MISS_MARGIN = 10;
const MAX_PARTICLES = 300;
const COIN_RATE = 5; // 1 coin per N points
const BOSS_INTERVAL = 20;
const DAILY_SEED_KEY = 'cloud_crossing_daily_seed';
const HIGH_SCORE_KEY = 'cloud_crossing_high';
const LEADERBOARD_KEY = 'cloud_crossing_lb';
const DAILY_LB_KEY = 'cloud_crossing_daily_lb';
const DAILY_PLAYED_KEY = 'cloud_crossing_daily_played';
const CHARS_KEY = 'cloud_crossing_chars';
const COINS_KEY = 'cloud_crossing_coins';
const SELECTED_CHAR_KEY = 'cloud_crossing_sel_char';
const DAILY_BEST_KEY = 'cloud_crossing_daily_best';
const PASSPORT_KEY = 'melos_passport';
const ACHIEVEMENTS_KEY = 'cloud_crossing_achievements';
const PLAYER_NAME_KEY = 'cloud_crossing_player_name';
const GHOST_DATA_KEY = 'melos_ghost_2';
const GHOST_SCORE_KEY = 'melos_ghost_2_score';
const GHOST_MAX_FRAMES = 18000; // 5 min at 60fps

// ── Types ──────────────────────────────────────────────────────────────────
type GameScreen = 'title' | 'playing' | 'dead' | 'charSelect' | 'leaderboard' | 'nameInput';

interface Obstacle {
  x: number;
  gapY: number;
  gapH: number;
  passed: boolean;
  type: ObstacleType;
  movingOffset: number;
  movingAmp: number;
  movingSpeed: number;
  creatureIdx: number;
  gap2Y?: number;
  gap2H?: number;
  nearMissTriggered?: boolean;
  hasLantern: boolean;
  hasVines: boolean;
}

type ObstacleType = 'classic' | 'creature' | 'moving' | 'double' | 'boss';

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number;
  color: string; type: 'trail' | 'death' | 'near_miss' | 'combo' | 'cloud' | 'powerup_trail' | 'star' | 'ink_drop' | 'score_pop';
  active: boolean;
  text?: string;
  scale?: number;
}

interface LeaderboardEntry {
  score: number;
  date: string;
  char: number;
  name?: string;
}

interface CharDef {
  name: string;
  desc: string;
  unlockScore: number;
  radiusMult: number;
  extraHP: number;
  color: string;
  scarfColor: string;
}

// Power-up types
type PowerUpType = 'coin' | 'shield' | 'magnet' | 'wings';

interface PowerUp {
  x: number;
  y: number;
  baseY: number;
  type: PowerUpType;
  bobPhase: number;
  active: boolean;
}

// Floating text
interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  size: number;
  scale?: number;
  vy?: number;
}

// Scarf segment for trailing animation
interface ScarfSegment {
  x: number;
  y: number;
}

// Cloud particle for parallax layer
interface CloudDrift {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
  blobSeed: number; // for unique blob shapes
}

// Achievement definition
interface Achievement {
  id: string;
  name: string;
  desc: string;
  threshold: number;
  unlocked: boolean;
}

// Melo's Passport
interface MelosPassport {
  totalCoins: number;
  gamesPlayed: Record<string, number>;
  achievements: string[];
  playerName: string;
}

// ── Seeded RNG ─────────────────────────────────────────────────────────────
class SeededRNG {
  private s: number;
  constructor(seed: number) { this.s = seed; }
  next(): number {
    this.s = (this.s * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (this.s >>> 0) / 0xFFFFFFFF;
  }
  range(a: number, b: number): number { return a + this.next() * (b - a); }
  int(a: number, b: number): number { return Math.floor(this.range(a, b + 1)); }
}

function getDailySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Passport helpers ─────────────────────────────────────────────────────
function loadPassport(): MelosPassport {
  try {
    const data = JSON.parse(localStorage.getItem(PASSPORT_KEY) || 'null');
    if (data && typeof data === 'object') {
      return {
        totalCoins: data.totalCoins || 0,
        gamesPlayed: data.gamesPlayed || { '扶摇万里': 0, '百妖长夜': 0, '石破天惊': 0, '吞灵化龙': 0, '问天牌局': 0 },
        achievements: data.achievements || [],
        playerName: data.playerName || '旅行者',
      };
    }
  } catch { /* ignore */ }
  return {
    totalCoins: 0,
    gamesPlayed: { '扶摇万里': 0, '百妖长夜': 0, '石破天惊': 0, '吞灵化龙': 0, '问天牌局': 0 },
    achievements: [],
    playerName: '旅行者',
  };
}

function savePassport(passport: MelosPassport) {
  localStorage.setItem(PASSPORT_KEY, JSON.stringify(passport));
}

function updatePassportCoins(amount: number) {
  const p = loadPassport();
  p.totalCoins += amount;
  savePassport(p);
}

function incrementPassportGamesPlayed() {
  const p = loadPassport();
  p.gamesPlayed['扶摇万里'] = (p.gamesPlayed['扶摇万里'] || 0) + 1;
  savePassport(p);
}

function getPlayerName(): string {
  const saved = localStorage.getItem(PLAYER_NAME_KEY);
  if (saved) return saved;
  const p = loadPassport();
  return p.playerName;
}

function setPlayerName(name: string) {
  localStorage.setItem(PLAYER_NAME_KEY, name);
  const p = loadPassport();
  p.playerName = name;
  savePassport(p);
}

function changePlayerName() {
  nameInputValue = getPlayerName();
  setScreen('nameInput');
}

// ── Achievement definitions ──────────────────────────────────────────────
const ACHIEVEMENT_DEFS: Achievement[] = [
  { id: 'first_flight', name: '初飞', desc: '得分达到10', threshold: 10, unlocked: false },
  { id: 'cloud_walk', name: '凌云', desc: '得分达到30', threshold: 30, unlocked: false },
  { id: 'sky_break', name: '破天', desc: '得分达到50', threshold: 50, unlocked: false },
  { id: 'immortal', name: '仙人', desc: '得分达到80', threshold: 80, unlocked: false },
  { id: 'legend', name: '传说', desc: '得分达到100', threshold: 100, unlocked: false },
];

function loadAchievements(): string[] {
  try {
    return JSON.parse(localStorage.getItem(ACHIEVEMENTS_KEY) || '[]');
  } catch { return []; }
}

function saveAchievements(ids: string[]) {
  localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(ids));
  // Also sync to passport
  const p = loadPassport();
  p.achievements = ids;
  savePassport(p);
}

function checkAndUnlockAchievements(currentScore: number): Achievement[] {
  const unlocked = loadAchievements();
  const newlyUnlocked: Achievement[] = [];
  for (const a of ACHIEVEMENT_DEFS) {
    if (currentScore >= a.threshold && !unlocked.includes(a.id)) {
      unlocked.push(a.id);
      newlyUnlocked.push(a);
    }
  }
  if (newlyUnlocked.length > 0) {
    saveAchievements(unlocked);
  }
  return newlyUnlocked;
}

// ── Audio Engine ───────────────────────────────────────────────────────────
class GameAudio {
  private ctx: AudioContext | null = null;
  private init() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  // Public: ensure AudioContext is created on user gesture (mobile browsers require this)
  ensureInit() { this.init(); }
  private noise(duration: number, gain: number, freq?: number) {
    if (this.muted) return;
    this.init();
    const c = this.ctx!;
    const t = c.currentTime;
    const len = Math.floor(c.sampleRate * duration);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    if (freq) {
      const flt = c.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.value = freq;
      flt.Q.value = 2;
      src.connect(flt).connect(g).connect(c.destination);
    } else {
      src.connect(g).connect(c.destination);
    }
    src.start(t);
    src.stop(t + duration);
  }
  private tone(freq: number, duration: number, gain: number, type: OscillatorType = 'sine') {
    if (this.muted) return;
    this.init();
    const c = this.ctx!;
    const t = c.currentTime;
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + duration);
  }
  tap() { this.noise(0.08, 0.15, 3000); }
  score(n: number) {
    const baseFreq = 880 + Math.min(n, 50) * 8;
    this.tone(baseFreq, 0.12, 0.12, 'triangle');
  }
  // Whoosh sound for obstacle pass
  whoosh() {
    if (this.muted) return;
    this.init();
    const c = this.ctx!;
    const t = c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.05);
    const g = c.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.05);
  }
  // Bass thud for collision impact
  impactThud() {
    if (this.muted) return;
    this.init();
    const c = this.ctx!;
    const t = c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(60, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.2);
    const g = c.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  }
  nearMissChime() {
    if (this.muted) return;
    this.init();
    const c = this.ctx!;
    const t = c.currentTime;
    const freqs = [880, 1108, 1320];
    for (let i = 0; i < freqs.length; i++) {
      const osc = c.createOscillator();
      osc.type = 'sine';
      const startT = t + i * 0.04;
      osc.frequency.setValueAtTime(freqs[i], startT);
      const g = c.createGain();
      g.gain.setValueAtTime(0, startT);
      g.gain.linearRampToValueAtTime(0.1, startT + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, startT + 0.15);
      osc.connect(g).connect(c.destination);
      osc.start(startT);
      osc.stop(startT + 0.15);
    }
  }
  powerUp() {
    if (this.muted) return;
    this.init();
    const c = this.ctx!;
    const t = c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523, t);
    osc.frequency.exponentialRampToValueAtTime(1047, t + 0.1);
    const g = c.createGain();
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  }
  coinCollect() {
    this.tone(1200, 0.08, 0.08, 'sine');
  }
  death() {
    // Freeze frame handled by caller; play impact thud + death sound
    this.impactThud();
    this.tone(80, 0.4, 0.2, 'sawtooth');
    this.noise(0.3, 0.2, 200);
  }
  achievementSound() {
    if (this.muted) return;
    this.init();
    const c = this.ctx!;
    const t = c.currentTime;
    const notes = [523, 659, 784, 1047];
    for (let i = 0; i < notes.length; i++) {
      const osc = c.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = notes[i];
      const g = c.createGain();
      const st = t + i * 0.1;
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.12, st + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.4);
      osc.connect(g).connect(c.destination);
      osc.start(st); osc.stop(st + 0.4);
    }
  }
  milestone(n: number) {
    if (this.muted) return;
    const base = n >= 100 ? 523 : n >= 50 ? 440 : n >= 25 ? 392 : 349;
    const delays = [0, 0.08, 0.16, 0.24];
    const freqs = [base, base * 1.25, base * 1.5, base * 2];
    this.init();
    const c = this.ctx!;
    for (let i = 0; i < 4; i++) {
      const osc = c.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freqs[i];
      const g = c.createGain();
      const t = c.currentTime + delays[i];
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.1, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(g).connect(c.destination);
      osc.start(t); osc.stop(t + 0.3);
    }
  }

  // UI tap (subtle click)
  uiTap() {
    if (this.muted) return;
    this.init();
    const c = this.ctx!;
    const t = c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.03);
    const g = c.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  // Stage transition (ethereal rising shimmer)
  stageTransition() {
    if (this.muted) return;
    this.init();
    const c = this.ctx!;
    const t = c.currentTime;
    // Rising shimmer: three staggered sine tones
    const freqs = [440, 554, 659];
    for (let i = 0; i < freqs.length; i++) {
      const osc = c.createOscillator();
      osc.type = 'sine';
      const st = t + i * 0.08;
      osc.frequency.setValueAtTime(freqs[i], st);
      osc.frequency.exponentialRampToValueAtTime(freqs[i] * 1.5, st + 0.4);
      const g = c.createGain();
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.07, st + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.5);
      osc.connect(g).connect(c.destination);
      osc.start(st);
      osc.stop(st + 0.5);
    }
    // Soft noise shimmer
    this.noise(0.3, 0.04, 4000);
  }

  // Combo sound (rising pitch based on combo count)
  comboHit(count: number) {
    if (this.muted) return;
    this.init();
    const c = this.ctx!;
    const t = c.currentTime;
    const freq = 600 + Math.min(count, 10) * 80;
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.2, t + 0.06);
    const g = c.createGain();
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  // Flap sound (soft wind whoosh + pitch)
  flapSound() {
    if (this.muted) return;
    this.init();
    const c = this.ctx!;
    const t = c.currentTime;
    // Quick pitch rise
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.06);
    const g = c.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.08);
    // Soft noise for wing air
    this.noise(0.06, 0.04, 2000);
  }

  // ── Layered procedural BGM ──────────────────────────────────────────────
  private bgmPlaying = false;
  private bgmDroneOsc: OscillatorNode | null = null;
  private bgmDroneGain: GainNode | null = null;
  private bgmMelodyTimer = 0;
  private bgmPercTimer = 0;
  private bgmHarmTimer = 0;
  private bgmScore = 0;
  private bgmScheduleId: ReturnType<typeof setTimeout> | null = null;
  muted = gameMuted;

  playBGM() {
    if (this.muted) return;
    this.init();
    if (this.bgmPlaying) return;
    this.bgmPlaying = true;
    const c = this.ctx!;

    // Layer 1: Deep drone bass (C2 ~65Hz)
    this.bgmDroneOsc = c.createOscillator();
    this.bgmDroneOsc.type = 'sine';
    this.bgmDroneOsc.frequency.value = 65;
    this.bgmDroneGain = c.createGain();
    this.bgmDroneGain.gain.value = 0.04;
    this.bgmDroneOsc.connect(this.bgmDroneGain).connect(c.destination);
    this.bgmDroneOsc.start();

    this.bgmMelodyTimer = 0;
    this.bgmPercTimer = 0;
    this.bgmHarmTimer = 0;
    this.scheduleBGMLayers();
  }

  stopBGM() {
    if (this.bgmScheduleId !== null) {
      clearTimeout(this.bgmScheduleId);
      this.bgmScheduleId = null;
    }
    this.bgmPlaying = false;
    if (this.bgmDroneOsc) {
      try { this.bgmDroneOsc.stop(); } catch { /* ignore */ }
      this.bgmDroneOsc = null;
    }
    this.bgmDroneGain = null;
  }

  updateBGMScore(s: number) {
    this.bgmScore = s;
  }

  private scheduleBGMLayers() {
    if (!this.bgmPlaying || !this.ctx) return;
    const c = this.ctx;
    const now = c.currentTime;

    // Layer 2: Pentatonic melody (guzheng-like: sine with fast attack, slow decay)
    const pentatonic = [262, 294, 330, 392, 440, 523, 587, 659];
    if (now >= this.bgmMelodyTimer) {
      const freq = pentatonic[Math.floor(Math.random() * pentatonic.length)];
      const dur = 0.6 + Math.random() * 0.4;
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = c.createGain();
      // Guzheng-like: fast attack, slow exponential decay
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.05, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(g).connect(c.destination);
      osc.start(now);
      osc.stop(now + dur);
      this.bgmMelodyTimer = now + 0.4 + Math.random() * 0.4;
    }

    // Layer 3: Rhythmic percussion at score > 20
    if (this.bgmScore > 20 && now >= this.bgmPercTimer) {
      const len = Math.floor(c.sampleRate * 0.08);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource();
      src.buffer = buf;
      const flt = c.createBiquadFilter();
      flt.type = 'highpass';
      flt.frequency.value = 800;
      const g = c.createGain();
      g.gain.setValueAtTime(0.06, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      src.connect(flt).connect(g).connect(c.destination);
      src.start(now);
      src.stop(now + 0.08);
      this.bgmPercTimer = now + 0.6;
    }

    // Layer 4: Higher octave harmony at score > 50
    if (this.bgmScore > 50 && now >= this.bgmHarmTimer) {
      const highPenta = [523, 587, 659, 784, 880, 1047];
      const freq = highPenta[Math.floor(Math.random() * highPenta.length)];
      const dur = 0.8 + Math.random() * 0.5;
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.025, now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(g).connect(c.destination);
      osc.start(now);
      osc.stop(now + dur);
      this.bgmHarmTimer = now + 0.8 + Math.random() * 0.6;
    }

    this.bgmScheduleId = setTimeout(() => this.scheduleBGMLayers(), 100);
  }
}

// ── Character Definitions ──────────────────────────────────────────────────
const CHARACTERS: CharDef[] = [
  { name: '麦洛', desc: '红巾少年 勇敢的小冒险家', unlockScore: 0, radiusMult: 1, extraHP: 0, color: '#3a2518', scarfColor: '#c23030' },
  { name: '灵狐', desc: '灵巧如风 体型更小', unlockScore: 30, radiusMult: 0.75, extraHP: 0, color: '#c26020', scarfColor: '#f0d050' },
  { name: '石龟', desc: '坚如磐石 可挡一击', unlockScore: 50, radiusMult: 1.15, extraHP: 1, color: '#506050', scarfColor: '#80c0a0' },
];

// ── Creature Definitions (Shanhai Jing) ─────────────────────────────────
const CREATURES = ['穷奇', '刑天', '飞廉'];

// ── Main Game ──────────────────────────────────────────────────────────────
const container = document.getElementById('game')!;
const canvas = document.createElement('canvas');
canvas.width = W;
canvas.height = H;
container.appendChild(canvas);
const ctx = canvas.getContext('2d')!;

// Scale canvas for HiDPI but keep CSS size
function resizeCanvas() {
  const aspect = W / H;
  const ww = window.innerWidth;
  const wh = window.innerHeight;
  let cw: number, ch: number;
  if (ww / wh < aspect) { cw = ww; ch = ww / aspect; }
  else { ch = wh; cw = wh * aspect; }
  canvas.style.width = `${cw}px`;
  canvas.style.height = `${ch}px`;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Regenerate vignette since canvas resize clears context state
  if (vignetteGrad !== null || paperCanvas !== null) {
    vignetteGrad = generateVignette();
  }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ── State ──────────────────────────────────────────────────────────────────
// Mute state (must be declared before GameAudio so the constructor reads correct value)
const MUTE_KEY = 'cloud_crossing_muted';
let gameMuted = localStorage.getItem(MUTE_KEY) === 'true';

const audio = new GameAudio();
let gameScreen: GameScreen = 'title';
let score = 0;
let highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10);
let coins = parseInt(localStorage.getItem(COINS_KEY) || '0', 10);
let combo = 0;
let comboTimer = 0;
let nearMisses = 0;
let totalCoinsEarned = 0;
let nearMissChain = 0;
let nearMissChainDisplay = 0;

// Player
let playerY = H / 2;
let playerVy = 0;
let playerHP = 0;
let shieldActive = false;
let shieldTimer = 0;
let reviveUsed = false;

// Death animation state
let deathAnimating = false;
let deathAnimTimer = 0;
let deathPlayerY = 0;
let deathPlayerVy = 0;
let deathPlayerRotation = 0;
// Freeze frame on death (100ms pause)
let deathFreezeTimer = 0;

// Screen white flash on collision
let collisionFlashTimer = 0;

// Obstacles
let obstacles: Obstacle[] = [];
let obstacleTimer = 0;
let scrollSpeed = 120;
const OBSTACLE_WIDTH = 56;

// Power-ups
let powerUps: PowerUp[] = [];
let powerUpTimer = 0;
let magnetActive = false;
let magnetTimer = 0;
let wingsActive = false;
let wingsTimer = 0;
let shieldPowerUpActive = false;

// Floating texts
let floatingTexts: FloatingText[] = [];

// Scarf segments (trailing animation)
const SCARF_SEGMENTS = 3;
let scarfSegments: ScarfSegment[] = [];

// Cloud drift particles (parallax layer)
let cloudDrifts: CloudDrift[] = [];

// Wing flap animation
let wingFlapTimer = 0;
let wingFlapAngle = 0;

// Ghost Race replay system
let ghostRaceData: number[] = [];          // recorded playerY each frame during current run
let ghostRaceFrameIndex = 0;              // current frame index for replay
let ghostReplayData: number[] | null = null; // loaded ghost data from previous best
let ghostReplayScore = 0;                  // the score the ghost achieved
let ghostSurpassed = false;                // whether player has passed ghost's death point
let ghostSurpassFlashTimer = 0;            // timer for "超越幽影!" celebration

function loadGhostReplay(): void {
  try {
    const raw = localStorage.getItem(GHOST_DATA_KEY);
    const sc = localStorage.getItem(GHOST_SCORE_KEY);
    if (raw && sc) {
      ghostReplayData = JSON.parse(raw);
      ghostReplayScore = parseInt(sc, 10) || 0;
    } else {
      ghostReplayData = null;
      ghostReplayScore = 0;
    }
  } catch {
    ghostReplayData = null;
    ghostReplayScore = 0;
  }
}

function saveGhostData(data: number[], ghostScore: number): void {
  try {
    // Cap to prevent localStorage bloat
    const capped = data.slice(0, GHOST_MAX_FRAMES);
    localStorage.setItem(GHOST_DATA_KEY, JSON.stringify(capped));
    localStorage.setItem(GHOST_SCORE_KEY, String(ghostScore));
  } catch { /* localStorage full, ignore */ }
}

// Ghost afterimage trail
interface GhostImage {
  x: number; y: number; alpha: number; rotation: number; charIdx: number;
}
let ghostImages: GhostImage[] = [];
let ghostSpawnTimer = 0;

// God-ray data for dawn/dusk
interface GodRay {
  x: number; angle: number; width: number; length: number; alpha: number; speed: number;
}
let godRays: GodRay[] = [];
let godRaysInitialized = false;

// Gold border flash for near-miss
let goldBorderTimer = 0;

// Parallax mountains
interface MountainLayer {
  peaks: number[];
  offset: number;
  speed: number;
  alpha: number;
  baseY: number;
  hasTrees: boolean;
  hasPagoda: boolean;
  pagodaIdx: number;
}
let mountainLayers: MountainLayer[] = [];

// Particles
const particles: Particle[] = [];
let particlePool: Particle[] = [];

// Screen effects
let shakeTimer = 0;
let shakeMag = 0;
let flashTimer = 0;
let slowMoTimer = 0;
let slowMoFactor = 1;

// Player glow
let glowPhase = 0;

// Daily challenge
let isDailyChallenge = false;
let dailyRNG: SeededRNG | null = null;
let dailyRank = 0;
let dailyGlobalBest = 0;

// Character
let selectedChar = parseInt(localStorage.getItem(SELECTED_CHAR_KEY) || '0', 10);
let unlockedChars: boolean[] = loadUnlockedChars();

// Leaderboard
let leaderboard: LeaderboardEntry[] = loadLeaderboard(LEADERBOARD_KEY);
let dailyLeaderboard: LeaderboardEntry[] = loadDailyLeaderboard();

// UI animation
let titleTime = 0;
let deathTime = 0;
let playTime = 0;

// Screen transition cooldown to prevent accidental chained taps
let screenTransitionCooldown = 0;
const SCREEN_TRANSITION_COOLDOWN = 0.35; // seconds

// Cloud animation offset
let cloudBob = 0;

// Ink vignette (precomputed)
let vignetteGrad: CanvasGradient | null = null;

// Paper texture (precomputed)
let paperCanvas: HTMLCanvasElement | null = null;

// Title mountain scene scroll
let titleScroll = 0;

// Star particles for night sky
let stars: { x: number; y: number; size: number; twinklePhase: number; twinkleSpeed: number }[] = [];

// Cached sky gradient to prevent flickering (FIX 1)
let cachedSkyGrad: CanvasGradient | null = null;
let cachedSkyScore = -1;

// ── Stage theme system (FIX 2) ──────────────────────────────────────────────
type StageTheme = 'peach_valley' | 'bamboo_grove' | 'red_cliff' | 'spirit_mist' | 'starry_crossing';

interface StageParticle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number;
  color: string; alpha: number;
  type: 'petal' | 'bamboo_leaf' | 'ember' | 'wisp' | 'shooting_star' | 'fog';
  rotation: number; rotSpeed: number;
  // shooting star specific
  tailLength?: number;
}

const MAX_STAGE_PARTICLES = 60;
let stageParticles: StageParticle[] = [];

// Fog layers for spirit mist stage
interface FogLayer {
  x: number; y: number; width: number; height: number; speed: number; alpha: number;
}
let fogLayers: FogLayer[] = [];
let fogInitialized = false;

// Aurora bands for starry crossing
let auroraPhase = 0;

// Stage transition announcement
let stageAnnounceName = '';
let stageAnnounceSubtitle = '';
let stageAnnounceTimer = 0;
const STAGE_ANNOUNCE_DURATION = 2.5;
let lastStageTheme: StageTheme | null = null;

// Shooting star cooldown
let shootingStarCooldown = 0;

// Achievement display queue
let achievementDisplayQueue: Achievement[] = [];
let achievementDisplayTimer = 0;

// Name input state
let nameInputValue = '';
const PRESET_NAMES = ['麦洛', '山海客', '逐风者', '墨侠', '凌云客', '御风人', '飞仙', '自定义'];

// Challenge code
let challengeCode = '';

// Leaderboard tab state
let showDailyLeaderboard = false;

// Pause state
let gamePaused = false;

// Mute state (declared earlier, before GameAudio instantiation)

// Hold-to-flap delay timer
let holdDelayTimeout: ReturnType<typeof setTimeout> | null = null;

// ── Persistence helpers ────────────────────────────────────────────────────
function loadLeaderboard(key: string): LeaderboardEntry[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); }
  catch { return []; }
}

function loadDailyLeaderboard(): LeaderboardEntry[] {
  try {
    const data = JSON.parse(localStorage.getItem(DAILY_LB_KEY) || '{}');
    if (data.date === getTodayStr()) return data.entries || [];
    return [];
  } catch { return []; }
}

function saveDailyLeaderboard(entries: LeaderboardEntry[]) {
  localStorage.setItem(DAILY_LB_KEY, JSON.stringify({ date: getTodayStr(), entries }));
}

function loadUnlockedChars(): boolean[] {
  try {
    const arr = JSON.parse(localStorage.getItem(CHARS_KEY) || '[true,false,false]');
    return arr as boolean[];
  } catch { return [true, false, false]; }
}

function saveUnlockedChars() {
  localStorage.setItem(CHARS_KEY, JSON.stringify(unlockedChars));
}

function addToLeaderboard(lb: LeaderboardEntry[], entry: LeaderboardEntry): LeaderboardEntry[] {
  lb.push(entry);
  lb.sort((a, b) => b.score - a.score);
  return lb.slice(0, 10);
}

function hasDailyBeenPlayed(): boolean {
  return localStorage.getItem(DAILY_PLAYED_KEY) === getTodayStr();
}

function loadDailyGlobalBest(): number {
  try {
    const data = JSON.parse(localStorage.getItem(DAILY_BEST_KEY) || '{}');
    if (data.date === getTodayStr()) return data.score || 0;
    return 0;
  } catch { return 0; }
}

function saveDailyGlobalBest(s: number) {
  const current = loadDailyGlobalBest();
  if (s > current) {
    localStorage.setItem(DAILY_BEST_KEY, JSON.stringify({ date: getTodayStr(), score: s }));
  }
}

// ── Challenge code (base36 of score + seed) ──────────────────────────────
function generateChallengeCode(s: number): string {
  const seed = getDailySeed();
  const combined = (seed * 1000 + s) & 0x7FFFFFFF;
  return combined.toString(36).toUpperCase();
}

// ── Particle pool ──────────────────────────────────────────────────────────
function getParticle(): Particle | null {
  if (particlePool.length > 0) return particlePool.pop()!;
  const activeCount = particles.filter(p => p.active).length;
  if (activeCount >= MAX_PARTICLES) {
    // Recycle the oldest active particle instead of returning null
    for (const p of particles) {
      if (p.active) {
        p.active = false;
        return p;
      }
    }
    return null;
  }
  const p: Particle = { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#000', type: 'trail', active: false };
  particles.push(p);
  return p;
}

function spawnParticle(x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, type: Particle['type']) {
  const p = getParticle();
  if (!p) return;
  p.x = x; p.y = y; p.vx = vx; p.vy = vy;
  p.life = life; p.maxLife = life; p.size = size;
  p.color = color; p.type = type; p.active = true;
  p.text = undefined;
  p.scale = undefined;
}

// ── Score pop: bouncing "+1" ─────────────────────────────────────────────
function spawnScorePop(x: number, y: number, comboMult: number) {
  const text = comboMult > 1 ? `+${comboMult}` : '+1';
  const size = 18 + Math.min(comboMult, 5) * 3;
  floatingTexts.push({
    x, y,
    text,
    color: comboMult > 3 ? '#ffd700' : comboMult > 1 ? '#c23030' : '#1a1a1a',
    life: 0.8,
    maxLife: 0.8,
    size,
    scale: 1.5, // starts big, shrinks to 1
    vy: -80 - comboMult * 10,
  });
}

// ── Floating text helpers ──────────────────────────────────────────────────
function spawnFloatingText(x: number, y: number, text: string, color: string, size: number = 28) {
  floatingTexts.push({ x, y, text, color, life: 1.0, maxLife: 1.0, size });
}

// ── Cloud drift initialization (fluffy layered clouds) ───────────────────
function initCloudDrifts() {
  cloudDrifts = [];
  const count = 5 + Math.floor(Math.random() * 4); // 5-8 clouds
  for (let i = 0; i < count; i++) {
    cloudDrifts.push({
      x: Math.random() * W * 1.5,
      y: Math.random() * H * 0.45,
      size: 40 + Math.random() * 80,
      speed: 4 + Math.random() * 18,
      alpha: 0.08 + Math.random() * 0.12,
      blobSeed: Math.random() * 1000,
    });
  }
}

// ── God-ray initialization ───────────────────────────────────────────────
function initGodRays() {
  godRays = [];
  for (let i = 0; i < 5; i++) {
    godRays.push({
      x: Math.random() * W,
      angle: -0.15 + Math.random() * 0.3,
      width: 20 + Math.random() * 40,
      length: H * 0.5 + Math.random() * H * 0.4,
      alpha: 0.02 + Math.random() * 0.04,
      speed: 3 + Math.random() * 8,
    });
  }
  godRaysInitialized = true;
}

// ── Star initialization ────────────────────────────────────────────────────
function initStars() {
  stars = [];
  for (let i = 0; i < 60; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H * 0.5,
      size: 0.5 + Math.random() * 2,
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleSpeed: 1 + Math.random() * 3,
    });
  }
}

// ── Paper texture generation ───────────────────────────────────────────────
function generatePaperTexture(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const cx = c.getContext('2d')!;
  cx.fillStyle = '#f0e6d3';
  cx.fillRect(0, 0, W, H);
  const imgData = cx.getImageData(0, 0, W, H);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 20;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  cx.putImageData(imgData, 0, 0);
  cx.globalAlpha = 0.03;
  for (let i = 0; i < 2000; i++) {
    cx.fillStyle = Math.random() > 0.5 ? '#000' : '#fff';
    cx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
  }
  cx.globalAlpha = 1;
  return c;
}

// ── Vignette generation ────────────────────────────────────────────────────
function generateVignette(): CanvasGradient {
  const g = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.7, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.35)');
  return g;
}

// ── Mountain generation (with tree lines & pagoda) ──────────────────────
function generateMountains() {
  mountainLayers = [];
  const layerConfigs = [
    { speed: 0.15, alpha: 0.12, baseY: H * 0.6, peakH: 200, count: 8, hasTrees: true, hasPagoda: true },
    { speed: 0.35, alpha: 0.2, baseY: H * 0.7, peakH: 160, count: 6, hasTrees: true, hasPagoda: false },
    { speed: 0.6, alpha: 0.35, baseY: H * 0.8, peakH: 120, count: 5, hasTrees: false, hasPagoda: false },
  ];
  for (const cfg of layerConfigs) {
    const peaks: number[] = [];
    for (let i = 0; i < cfg.count + 4; i++) {
      peaks.push(cfg.baseY - Math.random() * cfg.peakH);
    }
    mountainLayers.push({
      peaks, offset: 0, speed: cfg.speed, alpha: cfg.alpha, baseY: cfg.baseY,
      hasTrees: cfg.hasTrees,
      hasPagoda: cfg.hasPagoda,
      pagodaIdx: Math.floor(Math.random() * peaks.length),
    });
  }
}

function drawMountainLayer(layer: MountainLayer, scrollOff: number) {
  ctx.save();
  ctx.globalAlpha = layer.alpha;
  const segW = W / (layer.peaks.length - 3);
  const off = (scrollOff * layer.speed) % segW;

  // Build mountain path
  ctx.beginPath();
  ctx.moveTo(0, H);
  let minPeakY = H;
  for (let i = 0; i < layer.peaks.length; i++) {
    const x = i * segW - off;
    const y = layer.peaks[i];
    if (y < minPeakY) minPeakY = y;
    if (i === 0) ctx.lineTo(x, y);
    else {
      const prevX = (i - 1) * segW - off;
      const cpx = (prevX + x) / 2;
      ctx.quadraticCurveTo(cpx, layer.peaks[i - 1] - 20, x, y);
    }
  }
  ctx.lineTo(W + 100, H);
  ctx.closePath();

  // Rich multi-tone gradient fill with atmospheric haze at peaks
  const mtGrad = ctx.createLinearGradient(0, minPeakY - 10, 0, H);
  mtGrad.addColorStop(0, '#3a3a5e');    // lighter at peak (atmospheric haze)
  mtGrad.addColorStop(0.08, '#2e2e50'); // transition
  mtGrad.addColorStop(0.25, '#242444'); // mid-upper
  mtGrad.addColorStop(0.5, '#1c1c38');  // mid
  mtGrad.addColorStop(0.75, '#141430'); // lower shadow
  mtGrad.addColorStop(1, '#08081a');    // deep base shadow
  ctx.fillStyle = mtGrad;
  ctx.fill();
  // Atmospheric haze at peaks - subtle lighter overlay near ridgeline
  ctx.save();
  ctx.globalAlpha = layer.alpha * 0.15;
  const hazeGrad = ctx.createLinearGradient(0, minPeakY - 5, 0, minPeakY + 60);
  hazeGrad.addColorStop(0, 'rgba(100,100,160,0.4)');
  hazeGrad.addColorStop(1, 'rgba(100,100,160,0)');
  ctx.fillStyle = hazeGrad;
  ctx.fill();
  ctx.restore();

  // Ink-wash soft edges: multiple brush strokes with varying alpha/width for natural feel
  // Layer 1: thick soft blur stroke
  ctx.save();
  ctx.globalAlpha = layer.alpha * 0.3;
  ctx.strokeStyle = 'rgba(80,70,120,0.4)';
  ctx.lineWidth = 5;
  ctx.shadowColor = 'rgba(40,40,80,0.4)';
  ctx.shadowBlur = 12;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < layer.peaks.length; i++) {
    const x = i * segW - off;
    const y = layer.peaks[i];
    if (i === 0) ctx.moveTo(x, y);
    else {
      const prevX = (i - 1) * segW - off;
      const cpx = (prevX + x) / 2;
      ctx.quadraticCurveTo(cpx, layer.peaks[i - 1] - 20, x, y);
    }
  }
  ctx.stroke();
  ctx.restore();
  // Layer 2: thinner sharper stroke for definition
  ctx.save();
  ctx.globalAlpha = layer.alpha * 0.5;
  ctx.strokeStyle = 'rgba(50,45,80,0.6)';
  ctx.lineWidth = 1.5;
  ctx.shadowColor = 'rgba(30,30,60,0.2)';
  ctx.shadowBlur = 4;
  ctx.beginPath();
  for (let i = 0; i < layer.peaks.length; i++) {
    const x = i * segW - off;
    const y = layer.peaks[i];
    if (i === 0) ctx.moveTo(x, y - 1);
    else {
      const prevX = (i - 1) * segW - off;
      const cpx = (prevX + x) / 2;
      ctx.quadraticCurveTo(cpx, layer.peaks[i - 1] - 21, x, y - 1);
    }
  }
  ctx.stroke();
  ctx.restore();
  // Layer 3: subtle highlight along top of ridge
  ctx.save();
  ctx.globalAlpha = layer.alpha * 0.15;
  ctx.strokeStyle = 'rgba(140,140,180,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < layer.peaks.length; i++) {
    const x = i * segW - off;
    const y = layer.peaks[i];
    if (i === 0) ctx.moveTo(x, y - 3);
    else {
      const prevX = (i - 1) * segW - off;
      const cpx = (prevX + x) / 2;
      ctx.quadraticCurveTo(cpx, layer.peaks[i - 1] - 23, x, y - 3);
    }
  }
  ctx.stroke();
  ctx.restore();

  // Rock texture pattern overlay (subtle dithered dots)
  ctx.save();
  ctx.globalAlpha = layer.alpha * 0.15;
  ctx.fillStyle = '#555';
  const texSeed = layer.baseY * 7;
  for (let i = 0; i < 40; i++) {
    const rx = ((texSeed + i * 97.3) % W);
    const ry = layer.baseY + ((texSeed + i * 53.7) % (H - layer.baseY)) * 0.8;
    const rs = 0.5 + ((texSeed + i * 31.1) % 2);
    ctx.beginPath();
    ctx.arc(rx, ry, rs, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Tree lines at peaks (enhanced with gradient trunks)
  if (layer.hasTrees) {
    for (let i = 0; i < layer.peaks.length; i++) {
      const x = i * segW - off;
      const y = layer.peaks[i];
      for (let t = -2; t <= 2; t++) {
        const tx = x + t * 9;
        const th = 8 + Math.abs(t) * 3;
        const treeGrad = ctx.createLinearGradient(tx, y, tx, y - th);
        treeGrad.addColorStop(0, '#1a1a2e');
        treeGrad.addColorStop(1, '#2a2a4e');
        ctx.fillStyle = treeGrad;
        ctx.beginPath();
        ctx.moveTo(tx - 4, y);
        ctx.quadraticCurveTo(tx - 1, y - th * 0.6, tx, y - th);
        ctx.quadraticCurveTo(tx + 1, y - th * 0.6, tx + 4, y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // Pagoda silhouette at one peak (enhanced)
  if (layer.hasPagoda) {
    const pi = layer.pagodaIdx;
    if (pi < layer.peaks.length) {
      const px = pi * segW - off;
      const py = layer.peaks[pi];
      const pw = 14;
      const ph = 28;
      // Pagoda gradient
      const pagGrad = ctx.createLinearGradient(px, py - ph - 8, px, py);
      pagGrad.addColorStop(0, '#2a2a4e');
      pagGrad.addColorStop(1, '#1a1a2e');
      ctx.fillStyle = pagGrad;
      // Base
      ctx.fillRect(px - pw / 2, py - ph, pw, ph);
      // Eaves (curved)
      for (let e = 0; e < 3; e++) {
        const ey = py - ph + e * 9;
        const ew = pw + 8 - e * 2;
        ctx.beginPath();
        ctx.moveTo(px - ew / 2, ey);
        ctx.quadraticCurveTo(px, ey - 5, px + ew / 2, ey);
        ctx.lineTo(px + ew / 2 - 2, ey + 2);
        ctx.lineTo(px - ew / 2 + 2, ey + 2);
        ctx.closePath();
        ctx.fill();
      }
      // Spire with glow
      ctx.beginPath();
      ctx.moveTo(px - 1.5, py - ph);
      ctx.lineTo(px, py - ph - 10);
      ctx.lineTo(px + 1.5, py - ph);
      ctx.closePath();
      ctx.fill();
      // Tiny lantern glow on pagoda
      ctx.save();
      ctx.globalAlpha = layer.alpha * 0.6;
      const lanGrad = ctx.createRadialGradient(px, py - ph / 2, 0, px, py - ph / 2, 8);
      lanGrad.addColorStop(0, 'rgba(255,180,80,0.5)');
      lanGrad.addColorStop(1, 'rgba(255,180,80,0)');
      ctx.fillStyle = lanGrad;
      ctx.beginPath();
      ctx.arc(px, py - ph / 2, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore();
}

// ── Stage theme system ──────────────────────────────────────────────────────
function getStageTheme(): StageTheme {
  if (score < 20) return 'peach_valley';
  if (score < 40) return 'bamboo_grove';
  if (score < 60) return 'red_cliff';
  if (score < 80) return 'spirit_mist';
  return 'starry_crossing';
}

function getStageName(theme: StageTheme): { name: string; subtitle: string } {
  switch (theme) {
    case 'peach_valley': return { name: '桃花谷', subtitle: '晨曦' };
    case 'bamboo_grove': return { name: '翠竹林', subtitle: '午后' };
    case 'red_cliff': return { name: '赤壁崖', subtitle: '黄昏' };
    case 'spirit_mist': return { name: '灵雾泽', subtitle: '暮色' };
    case 'starry_crossing': return { name: '星河渡', subtitle: '深夜' };
  }
}

function checkStageTransition() {
  const current = getStageTheme();
  if (lastStageTheme !== null && current !== lastStageTheme) {
    const info = getStageName(current);
    stageAnnounceName = info.name;
    stageAnnounceSubtitle = info.subtitle;
    stageAnnounceTimer = STAGE_ANNOUNCE_DURATION;
    audio.stageTransition();
    // Reset fog when entering spirit mist
    if (current === 'spirit_mist') {
      fogLayers = [];
      fogInitialized = false;
    }
  }
  lastStageTheme = current;
}

function initFogLayers() {
  fogLayers = [];
  for (let i = 0; i < 6; i++) {
    fogLayers.push({
      x: Math.random() * W * 2 - W * 0.5,
      y: H * 0.2 + Math.random() * H * 0.6,
      width: 150 + Math.random() * 350,
      height: 25 + Math.random() * 50,
      speed: 5 + Math.random() * 18,
      alpha: 0.04 + Math.random() * 0.1 * (0.5 + i * 0.1), // varying density
    });
  }
  fogInitialized = true;
}

function spawnStageParticles(dt: number) {
  const theme = getStageTheme();
  const count = stageParticles.length;

  switch (theme) {
    case 'peach_valley': {
      // Floating peach blossom petals
      if (count < 20 && Math.random() < 0.15) {
        stageParticles.push({
          x: W + 10, y: Math.random() * H * 0.8,
          vx: -30 - Math.random() * 40, vy: 15 + Math.random() * 25,
          life: 6, maxLife: 6, size: 3 + Math.random() * 4,
          color: Math.random() < 0.5 ? '#ffb3c6' : '#ff8fab',
          alpha: 0.5 + Math.random() * 0.3,
          type: 'petal', rotation: Math.random() * Math.PI * 2,
          rotSpeed: 1 + Math.random() * 2,
        });
      }
      break;
    }
    case 'bamboo_grove': {
      // Bamboo leaves drifting
      if (count < 15 && Math.random() < 0.08) {
        stageParticles.push({
          x: W + 10, y: Math.random() * H * 0.7,
          vx: -20 - Math.random() * 30, vy: 10 + Math.random() * 20,
          life: 5, maxLife: 5, size: 4 + Math.random() * 3,
          color: Math.random() < 0.6 ? '#5a8a3a' : '#7aaa5a',
          alpha: 0.4 + Math.random() * 0.3,
          type: 'bamboo_leaf', rotation: Math.random() * Math.PI * 2,
          rotSpeed: 0.5 + Math.random() * 1.5,
        });
      }
      break;
    }
    case 'red_cliff': {
      // Floating embers / fire particles
      if (count < 25 && Math.random() < 0.18) {
        stageParticles.push({
          x: Math.random() * W, y: H + 10,
          vx: -5 + Math.random() * 10, vy: -40 - Math.random() * 60,
          life: 2 + Math.random() * 2, maxLife: 3, size: 1.5 + Math.random() * 3,
          color: Math.random() < 0.5 ? '#ff6030' : '#ffa040',
          alpha: 0.6 + Math.random() * 0.3,
          type: 'ember', rotation: 0, rotSpeed: 0,
        });
      }
      break;
    }
    case 'spirit_mist': {
      // Ghostly wisps floating upward
      if (count < 20 && Math.random() < 0.1) {
        stageParticles.push({
          x: Math.random() * W, y: H * 0.5 + Math.random() * H * 0.5,
          vx: -3 + Math.random() * 6, vy: -15 - Math.random() * 25,
          life: 3 + Math.random() * 2, maxLife: 4, size: 2 + Math.random() * 3,
          color: Math.random() < 0.5 ? '#c0a0ff' : '#e0d0ff',
          alpha: 0.3 + Math.random() * 0.3,
          type: 'wisp', rotation: 0, rotSpeed: 0,
        });
      }
      // Init fog layers if needed
      if (!fogInitialized) initFogLayers();
      break;
    }
    case 'starry_crossing': {
      // Shooting stars occasionally
      shootingStarCooldown -= dt;
      if (count < 5 && shootingStarCooldown <= 0 && Math.random() < 0.02) {
        const startX = Math.random() * W * 0.8;
        const startY = Math.random() * H * 0.3;
        stageParticles.push({
          x: startX, y: startY,
          vx: 200 + Math.random() * 150, vy: 80 + Math.random() * 60,
          life: 0.6 + Math.random() * 0.4, maxLife: 0.8, size: 2,
          color: '#fffde0', alpha: 0.9,
          type: 'shooting_star', rotation: 0, rotSpeed: 0,
          tailLength: 40 + Math.random() * 30,
        });
        shootingStarCooldown = 3 + Math.random() * 5;
      }
      break;
    }
  }
}

function updateStageParticles(dt: number) {
  for (let i = stageParticles.length - 1; i >= 0; i--) {
    const sp = stageParticles[i];
    sp.x += sp.vx * dt;
    sp.y += sp.vy * dt;
    sp.rotation += sp.rotSpeed * dt;
    sp.life -= dt;

    // Petal sway
    if (sp.type === 'petal') {
      sp.vx += Math.sin(sp.life * 3) * 15 * dt;
    }
    // Bamboo leaf sway
    if (sp.type === 'bamboo_leaf') {
      sp.vx += Math.sin(sp.life * 2) * 10 * dt;
    }
    // Wisp wobble
    if (sp.type === 'wisp') {
      sp.x += Math.sin(sp.life * 4) * 8 * dt;
    }
    // Ember flicker
    if (sp.type === 'ember') {
      sp.vx += (Math.random() - 0.5) * 30 * dt;
    }

    if (sp.life <= 0 || sp.x < -30 || sp.x > W + 30 || sp.y < -30 || sp.y > H + 30) {
      // Swap-and-pop for O(1) removal
      stageParticles[i] = stageParticles[stageParticles.length - 1];
      stageParticles.pop();
      // Re-check the swapped element at same index
      // (loop is reverse so we just continue; the swapped element at i will be checked next iteration if i > 0)
    }
  }

  // Update fog layers
  if (getStageTheme() === 'spirit_mist' && fogInitialized) {
    for (const fog of fogLayers) {
      fog.x -= fog.speed * dt;
      if (fog.x + fog.width < -50) {
        fog.x = W + 50;
        fog.y = H * 0.3 + Math.random() * H * 0.5;
      }
    }
  }

  // Aurora phase
  if (getStageTheme() === 'starry_crossing') {
    auroraPhase += dt * 0.5;
  }

  // Stage announce timer
  if (stageAnnounceTimer > 0) {
    stageAnnounceTimer -= dt;
  }
}

function drawStageParticles() {
  for (const sp of stageParticles) {
    const lifeRatio = sp.life / sp.maxLife;
    const fadeAlpha = sp.alpha * Math.min(1, lifeRatio * 3) * Math.min(1, sp.life);
    ctx.save();
    ctx.globalAlpha = fadeAlpha;

    if (sp.type === 'petal') {
      ctx.translate(sp.x, sp.y);
      ctx.rotate(sp.rotation);
      // Petal with gradient fill
      const petalGrad = ctx.createRadialGradient(-sp.size * 0.2, 0, 0, 0, 0, sp.size);
      petalGrad.addColorStop(0, '#ffe0ea');
      petalGrad.addColorStop(0.5, sp.color);
      petalGrad.addColorStop(1, 'rgba(200,100,130,0.3)');
      ctx.fillStyle = petalGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, sp.size, sp.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Petal highlight
      ctx.globalAlpha = fadeAlpha * 0.6;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.ellipse(-sp.size * 0.2, -sp.size * 0.1, sp.size * 0.3, sp.size * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (sp.type === 'bamboo_leaf') {
      ctx.translate(sp.x, sp.y);
      ctx.rotate(sp.rotation);
      // Gradient-filled bamboo leaf
      const leafGrad = ctx.createLinearGradient(-sp.size, 0, sp.size, 0);
      leafGrad.addColorStop(0, '#3a6a2a');
      leafGrad.addColorStop(0.4, sp.color);
      leafGrad.addColorStop(0.6, '#8aba6a');
      leafGrad.addColorStop(1, '#5a8a3a');
      ctx.fillStyle = leafGrad;
      ctx.beginPath();
      ctx.moveTo(-sp.size, 0);
      ctx.quadraticCurveTo(0, -sp.size * 0.4, sp.size, 0);
      ctx.quadraticCurveTo(0, sp.size * 0.4, -sp.size, 0);
      ctx.fill();
      // Center vein
      ctx.strokeStyle = 'rgba(40,80,30,0.3)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(-sp.size * 0.8, 0);
      ctx.lineTo(sp.size * 0.8, 0);
      ctx.stroke();
    } else if (sp.type === 'ember') {
      // Ember with radial glow
      const emberGrad = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, sp.size * 3 * lifeRatio);
      emberGrad.addColorStop(0, sp.color);
      emberGrad.addColorStop(0.3, sp.color);
      emberGrad.addColorStop(0.6, 'rgba(255,100,30,0.15)');
      emberGrad.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = emberGrad;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size * 3 * lifeRatio, 0, Math.PI * 2);
      ctx.fill();
      // Bright core
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = fadeAlpha * 0.6;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size * 0.4 * lifeRatio, 0, Math.PI * 2);
      ctx.fill();
    } else if (sp.type === 'wisp') {
      // Wisp with proper radial gradient glow
      const wispGrad = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, sp.size * 4);
      wispGrad.addColorStop(0, `rgba(192,160,255,${fadeAlpha * 0.6})`);
      wispGrad.addColorStop(0.3, `rgba(192,160,255,${fadeAlpha * 0.3})`);
      wispGrad.addColorStop(0.7, `rgba(160,120,230,${fadeAlpha * 0.08})`);
      wispGrad.addColorStop(1, 'rgba(160,120,230,0)');
      ctx.fillStyle = wispGrad;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size * 4, 0, Math.PI * 2);
      ctx.fill();
      // Bright center
      ctx.fillStyle = sp.color;
      ctx.globalAlpha = fadeAlpha * 0.8;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size * 0.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (sp.type === 'shooting_star') {
      const tailLen = sp.tailLength || 40;
      const angle = Math.atan2(sp.vy, sp.vx);
      const grad = ctx.createLinearGradient(
        sp.x, sp.y,
        sp.x - Math.cos(angle) * tailLen, sp.y - Math.sin(angle) * tailLen
      );
      grad.addColorStop(0, `rgba(255,253,224,${fadeAlpha})`);
      grad.addColorStop(1, 'rgba(255,253,224,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = sp.size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(sp.x - Math.cos(angle) * tailLen, sp.y - Math.sin(angle) * tailLen);
      ctx.stroke();
      // Bright head
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawFogLayers() {
  if (!fogInitialized) return;
  for (const fog of fogLayers) {
    ctx.save();
    ctx.globalAlpha = fog.alpha;
    // Layered fog with varying density via radial gradient
    const cx = fog.x + fog.width / 2;
    const cy = fog.y + fog.height / 2;
    const fogGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, fog.width * 0.55);
    fogGrad.addColorStop(0, 'rgba(180,160,220,0.8)');
    fogGrad.addColorStop(0.4, 'rgba(180,160,220,0.5)');
    fogGrad.addColorStop(0.7, 'rgba(180,160,220,0.2)');
    fogGrad.addColorStop(1, 'rgba(180,160,220,0)');
    ctx.fillStyle = fogGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, fog.width * 0.55, fog.height * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawAurora() {
  if (getStageTheme() !== 'starry_crossing') return;
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const phase = auroraPhase + i * 1.2;
    const y = 30 + i * 25 + Math.sin(phase * 0.7) * 15;
    const alpha = 0.04 + Math.sin(phase * 1.1) * 0.02;
    const hue = (phase * 30 + i * 60) % 360;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= W; x += 10) {
      const wave = Math.sin(x * 0.015 + phase) * 20 + Math.sin(x * 0.008 + phase * 0.6) * 15;
      ctx.lineTo(x, y + wave);
    }
    ctx.lineTo(W, y + 50);
    ctx.lineTo(0, y + 50);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawStageAnnouncement() {
  if (stageAnnounceTimer <= 0) return;
  const elapsed = STAGE_ANNOUNCE_DURATION - stageAnnounceTimer;
  let alpha: number;
  if (elapsed < 0.5) {
    alpha = elapsed / 0.5;
  } else if (elapsed < 1.8) {
    alpha = 1;
  } else {
    alpha = Math.max(0, (STAGE_ANNOUNCE_DURATION - elapsed) / 0.7);
  }
  const scale = elapsed < 0.5 ? 1.3 - 0.3 * (elapsed / 0.5) : 1.0;

  ctx.save();
  ctx.translate(W / 2, H * 0.35);
  ctx.scale(scale, scale);

  // Calligraphy card with ink-wash border frame
  const cardW = 260;
  const cardH = 90;
  // Card shadow
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 4;
  // Card background gradient
  ctx.globalAlpha = alpha * 0.88;
  const cardGrad = ctx.createLinearGradient(0, -cardH / 2, 0, cardH / 2);
  cardGrad.addColorStop(0, '#1a1a2a');
  cardGrad.addColorStop(0.5, '#222238');
  cardGrad.addColorStop(1, '#1a1a2a');
  ctx.fillStyle = cardGrad;
  const cr = 10;
  ctx.beginPath();
  ctx.moveTo(-cardW / 2 + cr, -cardH / 2);
  ctx.lineTo(cardW / 2 - cr, -cardH / 2);
  ctx.quadraticCurveTo(cardW / 2, -cardH / 2, cardW / 2, -cardH / 2 + cr);
  ctx.lineTo(cardW / 2, cardH / 2 - cr);
  ctx.quadraticCurveTo(cardW / 2, cardH / 2, cardW / 2 - cr, cardH / 2);
  ctx.lineTo(-cardW / 2 + cr, cardH / 2);
  ctx.quadraticCurveTo(-cardW / 2, cardH / 2, -cardW / 2, cardH / 2 - cr);
  ctx.lineTo(-cardW / 2, -cardH / 2 + cr);
  ctx.quadraticCurveTo(-cardW / 2, -cardH / 2, -cardW / 2 + cr, -cardH / 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Ink-wash border decorations (brush stroke corners)
  ctx.globalAlpha = alpha * 0.5;
  ctx.strokeStyle = '#c9a030';
  ctx.lineWidth = 2;
  // Top-left corner
  ctx.beginPath();
  ctx.moveTo(-cardW / 2 + 8, -cardH / 2 + 20);
  ctx.lineTo(-cardW / 2 + 8, -cardH / 2 + 8);
  ctx.lineTo(-cardW / 2 + 20, -cardH / 2 + 8);
  ctx.stroke();
  // Top-right corner
  ctx.beginPath();
  ctx.moveTo(cardW / 2 - 20, -cardH / 2 + 8);
  ctx.lineTo(cardW / 2 - 8, -cardH / 2 + 8);
  ctx.lineTo(cardW / 2 - 8, -cardH / 2 + 20);
  ctx.stroke();
  // Bottom-left corner
  ctx.beginPath();
  ctx.moveTo(-cardW / 2 + 8, cardH / 2 - 20);
  ctx.lineTo(-cardW / 2 + 8, cardH / 2 - 8);
  ctx.lineTo(-cardW / 2 + 20, cardH / 2 - 8);
  ctx.stroke();
  // Bottom-right corner
  ctx.beginPath();
  ctx.moveTo(cardW / 2 - 20, cardH / 2 - 8);
  ctx.lineTo(cardW / 2 - 8, cardH / 2 - 8);
  ctx.lineTo(cardW / 2 - 8, cardH / 2 - 20);
  ctx.stroke();

  // Inner decorative line
  ctx.globalAlpha = alpha * 0.2;
  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = '#c9a030';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(-cardW / 2 + 14, -cardH / 2 + 14, cardW - 28, cardH - 28);
  ctx.setLineDash([]);

  ctx.globalAlpha = alpha;
  // Subtitle (smaller, above)
  ctx.fillStyle = '#c9a030';
  ctx.font = `400 15px 'Noto Serif SC', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(stageAnnounceSubtitle, 0, -20);
  // Horizontal line separator
  ctx.strokeStyle = 'rgba(201,160,48,0.4)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-60, -8);
  ctx.lineTo(60, -8);
  ctx.stroke();
  // Main name (large calligraphy with multi-layer glow)
  // Outer glow pass
  ctx.save();
  ctx.globalAlpha = alpha * 0.3;
  ctx.shadowColor = 'rgba(201,160,48,0.6)';
  ctx.shadowBlur = 25;
  ctx.fillStyle = 'rgba(201,160,48,0.01)';
  ctx.font = `900 44px 'Noto Serif SC', serif`;
  ctx.fillText(stageAnnounceName, 0, 22);
  ctx.restore();
  // Main text with crisp glow
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#f0e6d3';
  ctx.font = `900 44px 'Noto Serif SC', serif`;
  ctx.shadowColor = 'rgba(201,160,48,0.5)';
  ctx.shadowBlur = 14;
  ctx.fillText(stageAnnounceName, 0, 22);
  ctx.shadowBlur = 0;
  // Faint ink texture overlay on text (subtle noise)
  ctx.globalAlpha = alpha * 0.05;
  ctx.fillStyle = '#000';
  for (let di = 0; di < 10; di++) {
    const dx = -60 + (di * 13.7 + stageAnnounceName.length * 7) % 120;
    const dy = 14 + (di * 9.3) % 16;
    ctx.fillRect(dx, dy, 1, 1);
  }
  ctx.restore();
}

// ── Sky color palette based on score (cached to prevent flickering) ────────
function getSkyGradient(): CanvasGradient {
  // Return cached gradient if score hasn't changed
  if (cachedSkyGrad !== null && cachedSkyScore === score) {
    return cachedSkyGrad;
  }

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  if (score < 20) {
    const t = score / 20;
    // Peach Valley: warm dawn colors
    const r1 = 255 - t * 50;
    const g1 = 180 - t * 30;
    const b1 = 160 - t * 60;
    const r2 = 250 - t * 40;
    const g2 = 210 + t * 30;
    const b2 = 200 + t * 50;
    grad.addColorStop(0, `rgb(${r1},${g1},${b1})`);
    grad.addColorStop(1, `rgb(${r2},${g2},${b2})`);
  } else if (score < 40) {
    // Bamboo Grove: green-tinted afternoon
    const t = (score - 20) / 20;
    const r1 = 205 - t * 85;
    const g1 = 150 + t * 50;
    const b1 = 100 + t * 40;
    const r2 = 210 - t * 50;
    const g2 = 230 + t * 10;
    const b2 = 210 + t * 20;
    grad.addColorStop(0, `rgb(${r1},${g1},${b1})`);
    grad.addColorStop(1, `rgb(${r2},${g2},${b2})`);
  } else if (score < 60) {
    // Red Cliff: orange/red dusk
    const t = (score - 40) / 20;
    const r1 = 120 + t * 80;
    const g1 = 200 - t * 120;
    const b1 = 140 - t * 80;
    const r2 = 160 + t * 60;
    const g2 = 240 - t * 140;
    const b2 = 230 - t * 150;
    grad.addColorStop(0, `rgb(${r1},${g1},${b1})`);
    grad.addColorStop(1, `rgb(${r2},${g2},${b2})`);
  } else if (score < 80) {
    // Spirit Mist: purple misty twilight
    const t = (score - 60) / 20;
    const r1 = 200 - t * 140;
    const g1 = 80 - t * 50;
    const b1 = 60 + t * 80;
    const r2 = 220 - t * 80;
    const g2 = 100 - t * 60;
    const b2 = 80 + t * 60;
    grad.addColorStop(0, `rgb(${r1},${g1},${b1})`);
    grad.addColorStop(1, `rgb(${r2},${g2},${b2})`);
  } else {
    // Starry Crossing: deep night
    grad.addColorStop(0, '#0a0a2e');
    grad.addColorStop(0.5, '#1a1a4e');
    grad.addColorStop(1, '#0f0f3a');
  }

  cachedSkyGrad = grad;
  cachedSkyScore = score;
  return grad;
}

// ── Drawing helpers ────────────────────────────────────────────────────────
function inkBrushRect(x: number, y: number, w: number, h: number, alpha: number = 0.85) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  const r = 3;
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.fill();
  ctx.globalAlpha = alpha * 0.3;
  // Deterministic splatter positions based on x/y to prevent flickering
  const seed = x * 73.13 + y * 37.97;
  for (let i = 0; i < 6; i++) {
    const si = seed + i * 127.31;
    const bx = x + ((si * 9301 + 49297) % 233280) / 233280 * w;
    const by = y + ((si * 7919 + 12553) % 233280) / 233280 * 4 - 2;
    const r1 = 2 + ((si * 3571 + 81929) % 233280) / 233280 * 3;
    ctx.beginPath();
    ctx.arc(bx, by, r1, 0, Math.PI * 2);
    ctx.fill();
    const by2 = y + h + ((si * 6173 + 29191) % 233280) / 233280 * 4 - 2;
    const r2 = 2 + ((si * 4201 + 63949) % 233280) / 233280 * 3;
    ctx.beginPath();
    ctx.arc(bx, by2, r2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ── Brush-stroke texture on pillars + architecture silhouettes ──────────────
function drawPillarWithTexture(x: number, y: number, w: number, h: number, isTop: boolean, hasLantern: boolean = false, hasVines: boolean = false) {
  // Rich multi-tone gradient fill with depth
  ctx.save();
  ctx.globalAlpha = 0.9;
  // Horizontal gradient for 3D cylindrical feel
  const pillarGrad = ctx.createLinearGradient(x, y, x + w, y);
  pillarGrad.addColorStop(0, '#080810');     // deep shadow left
  pillarGrad.addColorStop(0.15, '#12121c');  // shadow
  pillarGrad.addColorStop(0.35, '#1e1e2a');  // mid
  pillarGrad.addColorStop(0.55, '#26263a');  // highlight
  pillarGrad.addColorStop(0.75, '#1e1e2a');  // mid
  pillarGrad.addColorStop(1, '#080810');      // deep shadow right
  ctx.fillStyle = pillarGrad;
  // Slightly rounded shape for ink-wash feel
  const pr = 4;
  ctx.beginPath();
  ctx.moveTo(x + pr, y);
  ctx.lineTo(x + w - pr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + pr);
  ctx.lineTo(x + w, y + h - pr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - pr, y + h);
  ctx.lineTo(x + pr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - pr);
  ctx.lineTo(x, y + pr);
  ctx.quadraticCurveTo(x, y, x + pr, y);
  ctx.fill();

  // Ink-wash soft edge highlight on pillar sides
  ctx.globalAlpha = 0.08;
  const edgeGrad = ctx.createLinearGradient(x, y, x + w, y);
  edgeGrad.addColorStop(0, '#fff');
  edgeGrad.addColorStop(0.15, 'transparent');
  edgeGrad.addColorStop(0.85, 'transparent');
  edgeGrad.addColorStop(1, '#fff');
  ctx.fillStyle = edgeGrad;
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  // Rock texture pattern overlay
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = '#888';
  const stableHash = Math.floor(x * 3 + y * 7 + h * 13);
  for (let i = 0; i < 8; i++) {
    const rx = x + 3 + ((stableHash + i * 47) % (w - 6));
    const ry = y + 3 + ((stableHash + i * 73) % Math.max(1, h - 6));
    const rs = 0.8 + ((stableHash + i * 19) % 15) / 10;
    ctx.beginPath();
    ctx.arc(rx, ry, rs, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Brush-stroke texture (vertical streaks)
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const sx = x + 4 + ((stableHash + i * 37) % Math.max(1, w - 8));
    ctx.beginPath();
    ctx.moveTo(sx, y + 2);
    ctx.bezierCurveTo(sx + 2, y + h * 0.3, sx - 2, y + h * 0.7, sx + 1, y + h - 2);
    ctx.stroke();
  }
  ctx.restore();

  // Vines/moss texture (curvy, with leaf nodes)
  if (hasVines && h > 20) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#2a6a2a';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const vx = x + 4 + ((stableHash + i * 53) % Math.max(1, w - 8));
      const vy = isTop ? y + h : y;
      const vlen = 12 + ((stableHash + i * 29) % 20);
      const dir = isTop ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(vx, vy);
      const cp1x = vx + Math.sin(i * 2.1) * 12;
      const cp1y = vy + dir * vlen * 0.4;
      const cp2x = vx + Math.sin(i * 3.3) * 8;
      const cp2y = vy + dir * vlen * 0.7;
      const endX = vx + Math.sin(i * 1.7) * 6;
      const endY = vy + dir * vlen;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
      ctx.stroke();
      // Small leaf at end
      ctx.fillStyle = '#3a7a3a';
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.ellipse(endX, endY, 3, 1.5, Math.sin(i) * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.35;
    }
    ctx.restore();
  }

  // Architecture silhouettes
  if (h > 30) {
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = '#1a1a1a';
    if (isTop) {
      const baseY2 = y + h;
      const midX = x + w / 2;
      // Curved eave with ink-wash shadow
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;
      ctx.beginPath();
      ctx.moveTo(x - 8, baseY2);
      ctx.quadraticCurveTo(x, baseY2 - 10, midX, baseY2 - 16);
      ctx.quadraticCurveTo(x + w, baseY2 - 10, x + w + 8, baseY2);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillRect(midX - 2, baseY2 - 16, 4, 8);
    } else {
      const topY = y;
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = -2;
      ctx.beginPath();
      ctx.moveTo(x - 6, topY);
      ctx.quadraticCurveTo(x + w / 2, topY + 12, x + w + 6, topY);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // Lantern detail (with radial gradient glow)
      if (hasLantern) {
        const midX = x + w / 2;
        // Lantern string
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(midX, topY);
        ctx.lineTo(midX, topY + 25);
        ctx.stroke();
        // Lantern body with gradient
        const lanBodyGrad = ctx.createRadialGradient(midX, topY + 30, 0, midX, topY + 30, 8);
        lanBodyGrad.addColorStop(0, '#e84040');
        lanBodyGrad.addColorStop(0.6, '#c23030');
        lanBodyGrad.addColorStop(1, '#8a1818');
        ctx.fillStyle = lanBodyGrad;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.ellipse(midX, topY + 30, 7, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        // Radial glow from lantern
        ctx.globalAlpha = 1;
        const lanGlow = ctx.createRadialGradient(midX, topY + 30, 0, midX, topY + 30, 22);
        lanGlow.addColorStop(0, 'rgba(255,130,50,0.25)');
        lanGlow.addColorStop(0.5, 'rgba(255,100,30,0.08)');
        lanGlow.addColorStop(1, 'rgba(255,80,20,0)');
        ctx.fillStyle = lanGlow;
        ctx.beginPath();
        ctx.arc(midX, topY + 30, 22, 0, Math.PI * 2);
        ctx.fill();
        // Lantern top/bottom caps
        ctx.fillStyle = '#997a33';
        ctx.globalAlpha = 0.7;
        ctx.fillRect(midX - 4, topY + 22, 8, 2);
        ctx.fillRect(midX - 3, topY + 37, 6, 2);
      } else {
        const midX = x + w / 2;
        ctx.beginPath();
        ctx.arc(midX, topY + 18, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c23030';
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(midX, topY + 18, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

function drawCreature(cx_: number, cy: number, idx: number, size: number) {
  ctx.save();
  ctx.translate(cx_, cy);
  ctx.fillStyle = '#1a1a1a';
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.85;

  if (idx === 0) {
    // 穷奇 - winged tiger-like beast
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.5, size * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(size * 0.4, -size * 0.1, size * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-size * 0.1, -size * 0.2);
    ctx.quadraticCurveTo(-size * 0.4, -size * 0.7, -size * 0.6, -size * 0.3);
    ctx.quadraticCurveTo(-size * 0.3, -size * 0.25, -size * 0.1, -size * 0.2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(size * 0.1, -size * 0.2);
    ctx.quadraticCurveTo(size * 0.1, -size * 0.65, size * 0.4, -size * 0.4);
    ctx.quadraticCurveTo(size * 0.3, -size * 0.2, size * 0.1, -size * 0.2);
    ctx.fill();
    ctx.fillStyle = '#c23030';
    ctx.beginPath();
    ctx.arc(size * 0.45, -size * 0.15, size * 0.04, 0, Math.PI * 2);
    ctx.fill();
  } else if (idx === 1) {
    // 刑天 - headless warrior
    ctx.beginPath();
    ctx.moveTo(-size * 0.2, -size * 0.4);
    ctx.lineTo(size * 0.2, -size * 0.4);
    ctx.lineTo(size * 0.25, size * 0.4);
    ctx.lineTo(-size * 0.25, size * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-size * 0.2, -size * 0.2);
    ctx.lineTo(-size * 0.55, -size * 0.1);
    ctx.lineTo(-size * 0.6, -size * 0.35);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(size * 0.2, -size * 0.2);
    ctx.lineTo(size * 0.55, -size * 0.15);
    ctx.lineTo(size * 0.55, size * 0.1);
    ctx.stroke();
    ctx.fillStyle = '#c23030';
    ctx.beginPath();
    ctx.arc(-size * 0.06, -size * 0.05, size * 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(size * 0.06, -size * 0.05, size * 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c23030';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, size * 0.08, size * 0.08, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else {
    // 飞廉 - wind deity
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.35, size * 0.25, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(size * 0.25, -size * 0.15);
    ctx.quadraticCurveTo(size * 0.4, -size * 0.45, size * 0.5, -size * 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(size * 0.5, -size * 0.4, size * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(size * 0.5, -size * 0.5);
    ctx.lineTo(size * 0.4, -size * 0.7);
    ctx.moveTo(size * 0.5, -size * 0.5);
    ctx.lineTo(size * 0.6, -size * 0.65);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-size * 0.1, -size * 0.15);
    ctx.quadraticCurveTo(-size * 0.5, -size * 0.6, -size * 0.65, -size * 0.2);
    ctx.quadraticCurveTo(-size * 0.4, -size * 0.1, -size * 0.1, -size * 0.15);
    ctx.fill();
    ctx.fillStyle = '#c23030';
    ctx.beginPath();
    ctx.arc(size * 0.53, -size * 0.42, size * 0.03, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawMelo(x: number, y: number, charIdx: number, time: number, rotation?: number) {
  const ch = CHARACTERS[charIdx];
  const r = PLAYER_RADIUS * ch.radiusMult;

  ctx.save();
  ctx.translate(x, y);
  if (rotation) ctx.rotate(rotation);

  // Glow effect underneath (multi-layered radial gradient with shadowBlur)
  if (gameScreen === 'playing' && !deathAnimating) {
    const glowAlpha = 0.18 + Math.sin(glowPhase * 1.2) * 0.1;
    const glowPulse = 1 + Math.sin(glowPhase * 0.8) * 0.08;
    // Outer soft glow via shadowBlur
    ctx.save();
    ctx.shadowColor = `rgba(255,160,50,${glowAlpha * 0.6})`;
    ctx.shadowBlur = 25 * glowPulse;
    ctx.fillStyle = 'rgba(255,170,68,0.01)';
    ctx.beginPath();
    ctx.arc(0, r * 0.3, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Inner warm glow gradient
    const underGlow = ctx.createRadialGradient(0, r * 0.3, 0, 0, r * 0.5, r * 2.8 * glowPulse);
    underGlow.addColorStop(0, `rgba(255,190,90,${glowAlpha * 0.7})`);
    underGlow.addColorStop(0.25, `rgba(255,170,68,${glowAlpha * 0.5})`);
    underGlow.addColorStop(0.55, `rgba(255,140,40,${glowAlpha * 0.2})`);
    underGlow.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = underGlow;
    ctx.beginPath();
    ctx.arc(0, r * 0.5, r * 2.8 * glowPulse, 0, Math.PI * 2);
    ctx.fill();
  }

  // Speed lines when diving fast
  if (gameScreen === 'playing' && !deathAnimating && Math.abs(playerVy) > 200) {
    const speedAlpha = Math.min(0.4, Math.abs(playerVy) / 800);
    ctx.globalAlpha = speedAlpha;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const sx = -r * 0.8 - i * 4;
      const sy = (i - 2) * r * 0.4;
      const slen = 15 + i * 5;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - slen, sy + (playerVy > 0 ? -3 : 3));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Cloud mount - soft bezier-curve cloud with rich gradient
  const bob = Math.sin(time * 3) * 2;
  const cloudY = r + 5 + bob;
  ctx.save();
  // Cloud drop shadow
  ctx.shadowColor = 'rgba(0,0,0,0.12)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  // Main cloud body - radial gradient (white center, transparent edge)
  const cloudGrad = ctx.createRadialGradient(-r * 0.15, cloudY - r * 0.1, 0, 0, cloudY, r * 1.7);
  cloudGrad.addColorStop(0, 'rgba(255,255,255,0.85)');
  cloudGrad.addColorStop(0.3, 'rgba(248,248,252,0.75)');
  cloudGrad.addColorStop(0.6, 'rgba(230,232,240,0.55)');
  cloudGrad.addColorStop(0.85, 'rgba(210,215,225,0.25)');
  cloudGrad.addColorStop(1, 'rgba(200,205,218,0.05)');
  ctx.fillStyle = cloudGrad;
  ctx.globalAlpha = 0.8;
  // Main body - bezier puff shape instead of ellipse
  ctx.beginPath();
  ctx.moveTo(-r * 1.4, cloudY + r * 0.1);
  ctx.bezierCurveTo(-r * 1.5, cloudY - r * 0.25, -r * 0.8, cloudY - r * 0.55, -r * 0.2, cloudY - r * 0.45);
  ctx.bezierCurveTo(r * 0.3, cloudY - r * 0.6, r * 1.0, cloudY - r * 0.35, r * 1.3, cloudY + r * 0.05);
  ctx.bezierCurveTo(r * 1.4, cloudY + r * 0.4, r * 0.5, cloudY + r * 0.55, 0, cloudY + r * 0.5);
  ctx.bezierCurveTo(-r * 0.5, cloudY + r * 0.55, -r * 1.3, cloudY + r * 0.4, -r * 1.4, cloudY + r * 0.1);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Side puffs with individual gradients
  const lpGrad = ctx.createRadialGradient(-r * 0.8, cloudY - r * 0.05, 0, -r * 0.8, cloudY, r * 0.9);
  lpGrad.addColorStop(0, 'rgba(250,250,255,0.7)');
  lpGrad.addColorStop(0.7, 'rgba(225,228,238,0.35)');
  lpGrad.addColorStop(1, 'rgba(210,215,228,0.05)');
  ctx.fillStyle = lpGrad;
  ctx.beginPath();
  ctx.ellipse(-r * 0.75, cloudY + r * 0.02, r * 0.85, r * 0.42, -0.1, 0, Math.PI * 2);
  ctx.fill();
  const rpGrad = ctx.createRadialGradient(r * 0.6, cloudY + r * 0.05, 0, r * 0.6, cloudY + r * 0.05, r * 0.75);
  rpGrad.addColorStop(0, 'rgba(250,250,255,0.65)');
  rpGrad.addColorStop(0.7, 'rgba(225,228,238,0.3)');
  rpGrad.addColorStop(1, 'rgba(210,215,228,0.05)');
  ctx.fillStyle = rpGrad;
  ctx.beginPath();
  ctx.ellipse(r * 0.65, cloudY + r * 0.05, r * 0.72, r * 0.38, 0.1, 0, Math.PI * 2);
  ctx.fill();
  // Top specular highlight
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(-r * 0.15, cloudY - r * 0.2, r * 0.65, r * 0.15, -0.15, 0, Math.PI * 2);
  ctx.fill();
  // Bottom shadow edge
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#667';
  ctx.beginPath();
  ctx.ellipse(0, cloudY + r * 0.35, r * 1.1, r * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Red scarf (红巾) flowing behind - velocity-reactive length with rich gradient
  ctx.globalAlpha = 0.92;
  const scarfWave = Math.sin(time * 5) * 5;
  const wave2 = Math.sin(time * 5 + 1.2) * 6;
  const wave3 = Math.sin(time * 4.5 + 2.4) * 4;
  const wave4 = Math.sin(time * 3.8 + 3.6) * 3;
  // Scarf extends longer at high speed
  const speedFactor = gameScreen === 'playing' ? Math.min(1.8, 1.0 + Math.abs(playerVy) / 400) : 1.0;
  const scarfLen = r * 3.0 * speedFactor;
  const scarfTipLen = r * 3.8 * speedFactor;

  // Build scarf as filled shape with multi-stop gradient
  ctx.save();
  const scarfGrad = ctx.createLinearGradient(-r * 0.3, 0, -scarfLen, 0);
  scarfGrad.addColorStop(0, ch.scarfColor);
  scarfGrad.addColorStop(0.25, ch.scarfColor);
  // Mid-tone highlight band
  const scarfR = parseInt(ch.scarfColor.slice(1, 3), 16) || 194;
  const scarfG = parseInt(ch.scarfColor.slice(3, 5), 16) || 48;
  const scarfB = parseInt(ch.scarfColor.slice(5, 7), 16) || 48;
  scarfGrad.addColorStop(0.45, `rgba(${Math.min(255, scarfR + 40)},${Math.min(255, scarfG + 30)},${Math.min(255, scarfB + 20)},0.9)`);
  scarfGrad.addColorStop(0.7, `rgba(${scarfR},${scarfG},${scarfB},0.6)`);
  scarfGrad.addColorStop(1, `rgba(${scarfR},${scarfG},${scarfB},0.1)`);
  ctx.fillStyle = scarfGrad;
  // Scarf shadow
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, -r * 0.3);
  ctx.bezierCurveTo(-r * 0.8, -r * 0.25 + scarfWave * 0.3, -r * 1.2, -r * 0.15 + scarfWave, -r * 1.8 * speedFactor, r * 0.2 + scarfWave * 0.5);
  ctx.bezierCurveTo(-r * 2.1 * speedFactor, r * 0.1 + wave2 * 0.5, -r * 2.4 * speedFactor, r * 0.0 + wave2, -scarfLen, r * 0.5 + wave2 * 0.4);
  ctx.bezierCurveTo(-r * 2.6 * speedFactor, r * 0.65 + wave3 * 0.5, -r * 2.0 * speedFactor, r * 0.6 + wave3, -r * 1.8 * speedFactor, r * 0.6 + scarfWave * 0.3);
  ctx.bezierCurveTo(-r * 1.2 * speedFactor, r * 0.5 + scarfWave * 0.5, -r * 0.6, r * 0.35 + scarfWave * 0.7, -r * 0.25, r * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  // Scarf edge highlights - top edge brighter, bottom edge darker
  ctx.strokeStyle = `rgba(255,255,255,${0.12 + Math.sin(time * 3) * 0.04})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, -r * 0.3);
  ctx.bezierCurveTo(-r * 0.8, -r * 0.25 + scarfWave * 0.3, -r * 1.2, -r * 0.15 + scarfWave, -r * 1.8 * speedFactor, r * 0.2 + scarfWave * 0.5);
  ctx.bezierCurveTo(-r * 2.1 * speedFactor, r * 0.1 + wave2 * 0.5, -r * 2.4 * speedFactor, r * 0.0 + wave2, -scarfLen, r * 0.5 + wave2 * 0.4);
  ctx.stroke();
  // Darker bottom fold line
  ctx.strokeStyle = `rgba(${Math.max(0, scarfR - 50)},${Math.max(0, scarfG - 25)},${Math.max(0, scarfB - 15)},0.25)`;
  ctx.beginPath();
  ctx.moveTo(-r * 0.25, r * 0.15);
  ctx.bezierCurveTo(-r * 0.6, r * 0.35, -r * 1.2 * speedFactor, r * 0.5, -r * 1.8 * speedFactor, r * 0.6 + scarfWave * 0.3);
  ctx.stroke();
  ctx.restore();

  // Scarf tip extended with wispy trailing - longer when fast
  if (gameScreen === 'playing' && scarfSegments.length >= 2) {
    ctx.save();
    // Wispy trail tip
    const tipAlpha = 0.3 * speedFactor;
    ctx.globalAlpha = tipAlpha;
    const tipGrad = ctx.createLinearGradient(-scarfLen, 0, -scarfTipLen, 0);
    tipGrad.addColorStop(0, ch.scarfColor);
    tipGrad.addColorStop(1, `rgba(${scarfR},${scarfG},${scarfB},0)`);
    ctx.strokeStyle = tipGrad;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-scarfLen, r * 0.5 + wave2 * 0.4);
    ctx.bezierCurveTo(-scarfLen - r * 0.2, r * 0.3 + wave3, -scarfLen - r * 0.4, r * 0.2 + wave4, -scarfTipLen, r * 0.7 + wave4 * 0.3);
    ctx.stroke();
    // Second wispy tendril
    ctx.globalAlpha = tipAlpha * 0.5;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-scarfLen + r * 0.2, r * 0.4 + wave2 * 0.3);
    ctx.bezierCurveTo(-scarfLen, r * 0.1 + wave4, -scarfLen - r * 0.3, r * 0.5 + wave3 * 0.5, -scarfTipLen + r * 0.3, r * 0.9 + wave4 * 0.5);
    ctx.stroke();
    ctx.restore();
  }

  // Wing flap animation on tap
  const wingAngle = wingFlapTimer > 0 ? Math.sin(wingFlapTimer * 20) * 0.6 : 0;

  // Body with gradient fill and dark outline
  ctx.globalAlpha = 1;

  if (charIdx === 1) {
    // 灵狐 - fox shape with gradient
    const foxGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    foxGrad.addColorStop(0, '#e08030');
    foxGrad.addColorStop(0.6, ch.color);
    foxGrad.addColorStop(1, '#8a4010');
    ctx.fillStyle = foxGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.8, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Dark outline
    ctx.strokeStyle = '#5a2808';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Ears with gradient
    ctx.fillStyle = foxGrad;
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, -r * 0.5);
    ctx.lineTo(-r * 0.2, -r * 0.95);
    ctx.lineTo(0, -r * 0.5);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 0.1, -r * 0.5);
    ctx.lineTo(r * 0.3, -r * 0.95);
    ctx.lineTo(r * 0.5, -r * 0.5);
    ctx.fill();
    ctx.stroke();
    // Fluffy tail
    ctx.strokeStyle = ch.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, r * 0.2);
    ctx.quadraticCurveTo(-r * 1.3, -r * 0.4, -r * 0.8, -r * 0.7);
    ctx.stroke();
    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(r * 0.15, -r * 0.1, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(r * 0.18, -r * 0.1, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
    // Eye glint
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(r * 0.2, -r * 0.13, r * 0.03, 0, Math.PI * 2);
    ctx.fill();
  } else if (charIdx === 2) {
    // 石龟 - turtle shape with gradient
    const turtGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    turtGrad.addColorStop(0, '#708070');
    turtGrad.addColorStop(0.5, ch.color);
    turtGrad.addColorStop(1, '#3a4a3a');
    ctx.fillStyle = turtGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2a3a2a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Shell pattern
    ctx.strokeStyle = '#3a4a3a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.6, r * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -r * 0.35);
    ctx.lineTo(-r * 0.3, r * 0.35);
    ctx.moveTo(r * 0.3, -r * 0.35);
    ctx.lineTo(r * 0.3, r * 0.35);
    ctx.moveTo(0, -r * 0.4);
    ctx.lineTo(0, r * 0.4);
    ctx.stroke();
    // Head
    ctx.fillStyle = '#607060';
    ctx.beginPath();
    ctx.ellipse(r * 0.75, 0, r * 0.3, r * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a4a3a';
    ctx.stroke();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(r * 0.85, -r * 0.08, r * 0.05, 0, Math.PI * 2);
    ctx.fill();
    if (shieldActive) {
      ctx.globalAlpha = 0.3 + Math.sin(time * 6) * 0.15;
      ctx.strokeStyle = '#80ffc0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    // 麦洛 - 红巾少年 with rich 3-tone gradient body and strong dark outline
    // Shadow underneath body
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(r * 0.05, r * 0.15, r * 0.95, r * 0.85, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // 3-tone radial gradient: highlight / base / shadow
    const meloGrad = ctx.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.1, r * 0.1, r * 0.1, r * 1.05);
    meloGrad.addColorStop(0, '#7a5a40');     // highlight
    meloGrad.addColorStop(0.3, '#5a3a28');   // mid highlight
    meloGrad.addColorStop(0.6, ch.color);    // base
    meloGrad.addColorStop(0.85, '#2a1508');  // shadow
    meloGrad.addColorStop(1, '#1a0a02');     // deep shadow at edge
    ctx.fillStyle = meloGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    // Strong dark outline with slight glow
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 3;
    ctx.strokeStyle = '#1a0a04';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Specular highlight (top-left)
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(-r * 0.25, -r * 0.35, r * 0.25, r * 0.15, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Headband (红巾) detail with gradient
    ctx.save();
    ctx.globalAlpha = 0.7;
    const hbGrad = ctx.createLinearGradient(-r, -r * 0.5, r, -r * 0.5);
    hbGrad.addColorStop(0, `rgba(${scarfR},${scarfG},${scarfB},0.3)`);
    hbGrad.addColorStop(0.3, ch.scarfColor);
    hbGrad.addColorStop(0.7, ch.scarfColor);
    hbGrad.addColorStop(1, `rgba(${scarfR},${scarfG},${scarfB},0.3)`);
    ctx.strokeStyle = hbGrad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.95, -Math.PI * 0.8, -Math.PI * 0.2);
    ctx.stroke();
    ctx.restore();
    // Eyes (larger, more expressive)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(r * 0.2, -r * 0.15, r * 0.22, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(r * 0.25, -r * 0.15, r * 0.11, 0, Math.PI * 2);
    ctx.fill();
    // Eye glint
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(r * 0.28, -r * 0.2, r * 0.04, 0, Math.PI * 2);
    ctx.fill();
    // Blush
    ctx.fillStyle = 'rgba(200,80,80,0.35)';
    ctx.beginPath();
    ctx.ellipse(r * 0.5, r * 0.15, r * 0.17, r * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tiny smile
    ctx.strokeStyle = '#2a1508';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(r * 0.3, r * 0.1, r * 0.1, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // Wing flap on tap - dramatic spread with gradient feathers and glow
    if (wingFlapTimer > 0) {
      const flapAlpha = Math.min(1, wingFlapTimer * 5);
      const flapSpread = Math.sin(wingFlapTimer * 18) * 0.8;
      ctx.save();
      ctx.globalAlpha = 0.55 * flapAlpha;
      // Wing glow
      ctx.shadowColor = 'rgba(255,220,180,0.4)';
      ctx.shadowBlur = 12 * flapAlpha;
      // Left wing with gradient
      const lwGrad = ctx.createLinearGradient(-r * 0.3, -r * 0.2, -r * 1.8, -r * 1.2);
      lwGrad.addColorStop(0, 'rgba(255,255,255,0.6)');
      lwGrad.addColorStop(0.4, 'rgba(245,230,210,0.5)');
      lwGrad.addColorStop(1, 'rgba(230,200,170,0.1)');
      ctx.fillStyle = lwGrad;
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, -r * 0.1);
      ctx.bezierCurveTo(-r * 0.8, -r * 0.6 - flapSpread * r, -r * 1.6, -r * 1.3 - wingAngle * r, -r * 1.0, -r * 0.9 - flapSpread * r * 0.5);
      ctx.bezierCurveTo(-r * 0.6, -r * 0.5 - flapSpread * r * 0.3, -r * 0.4, -r * 0.3, -r * 0.3, -r * 0.1);
      ctx.fill();
      // Feather edge lines
      ctx.strokeStyle = `rgba(200,180,160,${flapAlpha * 0.3})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.3 - flapSpread * r * 0.2);
      ctx.lineTo(-r * 1.3, -r * 1.1 - wingAngle * r * 0.8);
      ctx.stroke();
      // Right wing with gradient
      const rwGrad = ctx.createLinearGradient(r * 0.3, -r * 0.2, r * 1.8, -r * 1.2);
      rwGrad.addColorStop(0, 'rgba(255,255,255,0.6)');
      rwGrad.addColorStop(0.4, 'rgba(245,230,210,0.5)');
      rwGrad.addColorStop(1, 'rgba(230,200,170,0.1)');
      ctx.fillStyle = rwGrad;
      ctx.beginPath();
      ctx.moveTo(r * 0.3, -r * 0.1);
      ctx.bezierCurveTo(r * 0.8, -r * 0.6 - flapSpread * r, r * 1.6, -r * 1.3 - wingAngle * r, r * 1.0, -r * 0.9 - flapSpread * r * 0.5);
      ctx.bezierCurveTo(r * 0.6, -r * 0.5 - flapSpread * r * 0.3, r * 0.4, -r * 0.3, r * 0.3, -r * 0.1);
      ctx.fill();
      // Feather edge
      ctx.strokeStyle = `rgba(200,180,160,${flapAlpha * 0.3})`;
      ctx.beginPath();
      ctx.moveTo(r * 0.5, -r * 0.3 - flapSpread * r * 0.2);
      ctx.lineTo(r * 1.3, -r * 1.1 - wingAngle * r * 0.8);
      ctx.stroke();
      ctx.restore();
    }

    if (shieldActive) {
      ctx.globalAlpha = 0.3 + Math.sin(time * 6) * 0.15;
      ctx.strokeStyle = '#80ffc0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Blue aura for shield power-up (with glow)
  if (shieldPowerUpActive) {
    const shieldGlow = ctx.createRadialGradient(0, 0, r, 0, 0, r * 1.8);
    shieldGlow.addColorStop(0, 'rgba(68,136,255,0.2)');
    shieldGlow.addColorStop(0.5, 'rgba(68,136,255,0.08)');
    shieldGlow.addColorStop(1, 'rgba(68,136,255,0)');
    ctx.fillStyle = shieldGlow;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.3 + Math.sin(time * 8) * 0.1;
    ctx.strokeStyle = '#4488ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#4488ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Wings power-up visual (golden, with glow)
  if (wingsActive) {
    ctx.save();
    ctx.globalAlpha = 0.55 + Math.sin(time * 10) * 0.2;
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 10;
    const wGrad = ctx.createLinearGradient(-r * 1.5, -r * 1.2, r * 1.5, -r * 1.2);
    wGrad.addColorStop(0, '#ffd700');
    wGrad.addColorStop(0.5, '#ffe880');
    wGrad.addColorStop(1, '#ffd700');
    ctx.fillStyle = wGrad;
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, -r * 0.3);
    ctx.quadraticCurveTo(-r * 1.6, -r * 1.3, -r * 0.3, -r * 0.8);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.5, -r * 0.3);
    ctx.quadraticCurveTo(r * 1.6, -r * 1.3, r * 0.3, -r * 0.8);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

// ── Calligraphy text ───────────────────────────────────────────────────────
function drawCalliText(text: string, x: number, y: number, size: number, color: string = '#1a1a1a', alpha: number = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.font = `900 ${size}px 'Noto Serif SC', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Ink shadow with blur for depth
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = Math.max(4, size * 0.08);
  ctx.shadowOffsetY = Math.max(2, size * 0.04);
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawText(text: string, x: number, y: number, size: number, color: string = '#1a1a1a', align: CanvasTextAlign = 'center', weight: string = '700') {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px 'Noto Serif SC', serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ── Red seal stamp drawing ─────────────────────────────────────────────────
function drawSealStamp(x: number, y: number, text: string, size: number = 22, unlocked: boolean = true) {
  ctx.save();
  ctx.translate(x, y);
  // Outer circle
  ctx.strokeStyle = unlocked ? '#c23030' : '#ccc';
  ctx.lineWidth = 2;
  ctx.globalAlpha = unlocked ? 0.85 : 0.3;
  ctx.beginPath();
  ctx.arc(0, 0, size, 0, Math.PI * 2);
  ctx.stroke();
  // Inner square border
  const inner = size * 0.7;
  ctx.strokeRect(-inner / 2, -inner / 2, inner, inner);
  // Text
  ctx.fillStyle = unlocked ? '#c23030' : '#ccc';
  ctx.font = `900 ${size * 0.8}px 'Noto Serif SC', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 1);
  ctx.restore();
}

// ── Button helper ──────────────────────────────────────────────────────────
interface Button { x: number; y: number; w: number; h: number; label: string; action: () => void; }
let buttons: Button[] = [];

function drawButton(b: Button, style: 'primary' | 'secondary' = 'secondary') {
  ctx.save();
  const r = 10;

  // Button path helper
  function btnPath() {
    ctx.beginPath();
    ctx.moveTo(b.x + r, b.y);
    ctx.lineTo(b.x + b.w - r, b.y);
    ctx.quadraticCurveTo(b.x + b.w, b.y, b.x + b.w, b.y + r);
    ctx.lineTo(b.x + b.w, b.y + b.h - r);
    ctx.quadraticCurveTo(b.x + b.w, b.y + b.h, b.x + b.w - r, b.y + b.h);
    ctx.lineTo(b.x + r, b.y + b.h);
    ctx.quadraticCurveTo(b.x, b.y + b.h, b.x, b.y + b.h - r);
    ctx.lineTo(b.x, b.y + r);
    ctx.quadraticCurveTo(b.x, b.y, b.x + r, b.y);
  }

  // Drop shadow
  ctx.shadowColor = style === 'primary' ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.1)';
  ctx.shadowBlur = style === 'primary' ? 10 : 6;
  ctx.shadowOffsetY = 2;

  if (style === 'primary') {
    // Gradient background for primary
    const btnGrad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
    btnGrad.addColorStop(0, '#2a2a2a');
    btnGrad.addColorStop(0.5, '#1a1a1a');
    btnGrad.addColorStop(1, '#0e0e0e');
    ctx.fillStyle = btnGrad;
    ctx.globalAlpha = 0.92;
  } else {
    // Gradient background for secondary
    const btnGrad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
    btnGrad.addColorStop(0, 'rgba(245,239,227,0.85)');
    btnGrad.addColorStop(1, 'rgba(230,220,200,0.7)');
    ctx.fillStyle = btnGrad;
    ctx.globalAlpha = 0.9;
  }

  btnPath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Border
  ctx.globalAlpha = style === 'primary' ? 0.4 : 0.25;
  ctx.strokeStyle = style === 'primary' ? '#555' : '#999';
  ctx.lineWidth = 1;
  btnPath();
  ctx.stroke();

  // Top highlight (glass effect)
  ctx.globalAlpha = style === 'primary' ? 0.08 : 0.15;
  const hlGrad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h * 0.5);
  hlGrad.addColorStop(0, '#fff');
  hlGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = hlGrad;
  btnPath();
  ctx.fill();

  ctx.globalAlpha = 1;
  const textColor = style === 'primary' ? '#f0e6d3' : '#1a1a1a';
  drawText(b.label, b.x + b.w / 2, b.y + b.h / 2, 17, textColor);
  ctx.restore();
}

// ── Obstacle generation ────────────────────────────────────────────────────
function getGapWidth(): number {
  const startGap = 180;
  const minGap = 120;
  // Logarithmic curve: stays wider longer in the 25-45 range, then narrows gradually
  // At score 25: ~163, score 35: ~155, score 45: ~147, score 50: ~143, score 80+: ~125
  const t = Math.min(1, Math.log(1 + score) / Math.log(1 + 80));
  return startGap - (startGap - minGap) * t;
}

function getScrollSpeed(): number {
  if (score <= 20) {
    return 120 + score * 1.5;
  } else {
    const base = 120 + 20 * 1.5;
    const extra = (score - 20);
    return Math.min(300, base + extra * 3);
  }
}

function rng(): number {
  return dailyRNG ? dailyRNG.next() : Math.random();
}

function rngRange(a: number, b: number): number {
  return a + rng() * (b - a);
}

function chooseObstacleType(): ObstacleType {
  if (score > 0 && score % BOSS_INTERVAL === 0) return 'boss';
  if (score >= 25 && rng() < 0.2) return 'double';
  if (score >= 15 && rng() < 0.3) return 'moving';
  if (rng() < 0.25) return 'creature';
  return 'classic';
}

function spawnObstacle() {
  const type = chooseObstacleType();
  const gapH = type === 'boss' ? getGapWidth() * 1.1 : getGapWidth();
  const minY = gapH / 2 + 40;
  const maxY = H - gapH / 2 - 40;
  const gapY = rngRange(minY, maxY);

  const obs: Obstacle = {
    x: W + OBSTACLE_WIDTH,
    gapY,
    gapH,
    passed: false,
    type,
    movingOffset: 0,
    movingAmp: type === 'moving' ? rngRange(30, 60) : 0,
    movingSpeed: type === 'moving' ? rngRange(1.5, 3) : 0,
    creatureIdx: Math.floor(rng() * CREATURES.length),
    nearMissTriggered: false,
    hasLantern: rng() < 0.3,
    hasVines: rng() < 0.25,
  };

  if (type === 'double') {
    const gap2H = gapH * 0.9;
    const gap2Y = rngRange(gap2H / 2 + 40, H - gap2H / 2 - 40);
    obs.gap2Y = gap2Y;
    obs.gap2H = gap2H;
  }

  obstacles.push(obs);
}

// ── Power-up spawning ──────────────────────────────────────────────────────
function spawnPowerUp(x: number) {
  const types: PowerUpType[] = ['coin', 'coin', 'coin', 'shield', 'magnet', 'wings'];
  const type = types[Math.floor(rng() * types.length)];
  const y = rngRange(80, H - 80);
  powerUps.push({
    x,
    y,
    baseY: y,
    type,
    bobPhase: rng() * Math.PI * 2,
    active: true,
  });
}

// ── Game logic ─────────────────────────────────────────────────────────────
function resetGame() {
  gamePaused = false;
  score = 0;
  combo = 0;
  comboTimer = 0;
  nearMisses = 0;
  totalCoinsEarned = 0;
  nearMissChain = 0;
  nearMissChainDisplay = 0;
  playerY = H / 2;
  playerVy = 0;
  playerHP = CHARACTERS[selectedChar].extraHP;
  shieldActive = playerHP > 0;
  shieldTimer = 0;
  reviveUsed = false;
  obstacles = [];
  obstacleTimer = 0;
  scrollSpeed = 120;
  shakeTimer = 0;
  flashTimer = 0;
  slowMoTimer = 0;
  slowMoFactor = 1;
  playTime = 0;
  goldBorderTimer = 0;
  deathAnimating = false;
  deathAnimTimer = 0;
  deathPlayerRotation = 0;
  deathFreezeTimer = 0;
  collisionFlashTimer = 0;
  glowPhase = 0;
  challengeCode = '';
  wingFlapTimer = 0;
  ghostImages = [];
  ghostSpawnTimer = 0;
  godRaysInitialized = false;

  // Power-ups
  powerUps = [];
  powerUpTimer = 0;
  magnetActive = false;
  magnetTimer = 0;
  wingsActive = false;
  wingsTimer = 0;
  shieldPowerUpActive = false;

  // Floating texts
  floatingTexts = [];

  // Achievement display
  achievementDisplayQueue = [];
  achievementDisplayTimer = 0;

  // Scarf segments
  scarfSegments = [];
  for (let i = 0; i < SCARF_SEGMENTS; i++) {
    scarfSegments.push({ x: W * 0.15, y: H / 2 });
  }

  // Clear particles
  for (const p of particles) {
    if (p.active) { p.active = false; particlePool.push(p); }
  }

  // Clear stage system
  stageParticles = [];
  fogLayers = [];
  fogInitialized = false;
  stageAnnounceTimer = 0;
  lastStageTheme = null;
  cachedSkyGrad = null;
  cachedSkyScore = -1;

  // Reset mountain offsets
  for (const layer of mountainLayers) {
    layer.offset = 0;
  }
  shootingStarCooldown = 0;
  auroraPhase = 0;

  if (isDailyChallenge) {
    dailyRNG = new SeededRNG(getDailySeed());
    dailyGlobalBest = loadDailyGlobalBest();
  } else {
    dailyRNG = null;
  }

  // Ghost race system
  ghostRaceData = [];
  ghostRaceFrameIndex = 0;
  ghostSurpassed = false;
  ghostSurpassFlashTimer = 0;
  loadGhostReplay();

  incrementPassportGamesPlayed();
}

function flap() {
  if (gameScreen !== 'playing') return;
  if (gamePaused) return;
  playerVy = FLAP_VEL;
  wingFlapTimer = 0.3; // trigger wing flap animation
  audio.flapSound();
}

function startDeathAnimation() {
  deathAnimating = true;
  deathAnimTimer = 0;
  deathFreezeTimer = 0.1; // 100ms freeze frame
  deathPlayerY = playerY;
  deathPlayerVy = -80;
  deathPlayerRotation = 0;

  // White flash on collision (50ms)
  collisionFlashTimer = 0.05;
  // Bass thud on impact
  audio.impactThud();

  // Screen shake (strong, 8px, 0.5s)
  shakeTimer = 0.5;
  shakeMag = 8;

  // Death particles (ink splash)
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 50 + Math.random() * 150;
    spawnParticle(
      W * 0.15, playerY,
      Math.cos(a) * sp, Math.sin(a) * sp,
      0.8 + Math.random() * 0.5,
      3 + Math.random() * 6,
      '#1a1a1a', 'death'
    );
  }
}

function die() {
  // Guard against re-entry during death animation (e.g. shield acquired during anim)
  // Allow the final die() call when animation completes (deathAnimating is true but timer expired)
  if (deathAnimating && deathAnimTimer < 1.0 && deathPlayerY <= H + 50) return;

  if (shieldPowerUpActive) {
    shieldPowerUpActive = false;
    shakeTimer = 0.15;
    shakeMag = 4;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      spawnParticle(W * 0.15, playerY, Math.cos(a) * 100, Math.sin(a) * 100, 0.5, 4, '#4488ff', 'near_miss');
    }
    return;
  }

  if (playerHP > 0) {
    playerHP--;
    shieldActive = playerHP > 0;
    shieldTimer = 1;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      spawnParticle(W * 0.15, playerY, Math.cos(a) * 100, Math.sin(a) * 100, 0.5, 4, '#80ffc0', 'near_miss');
    }
    return;
  }

  if (!deathAnimating) {
    startDeathAnimation();
    audio.death();
    return;
  }

  setScreen('dead');
  deathTime = 0;
  deathAnimating = false;
  flashTimer = 0.15;
  audio.stopBGM();
  clearHoldTimers();

  // Final death particles
  for (let i = 0; i < 15; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 50 + Math.random() * 200;
    spawnParticle(
      W * 0.15, deathPlayerY,
      Math.cos(a) * sp, Math.sin(a) * sp,
      0.5 + Math.random() * 0.5,
      3 + Math.random() * 8,
      '#1a1a1a', 'death'
    );
  }

  // Update scores
  const earnedCoins = Math.floor(score / COIN_RATE);
  totalCoinsEarned = earnedCoins;
  coins += earnedCoins;
  localStorage.setItem(COINS_KEY, String(coins));

  // Update passport coins
  updatePassportCoins(earnedCoins);

  if (score > highScore) {
    highScore = score;
    localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
  }

  // Save ghost data if this run beats the previous ghost score
  if (score > ghostReplayScore && ghostRaceData.length > 0) {
    saveGhostData(ghostRaceData, score);
  }

  // Check achievements
  const newAch = checkAndUnlockAchievements(score);
  if (newAch.length > 0) {
    achievementDisplayQueue.push(...newAch);
    achievementDisplayTimer = 3;
    audio.achievementSound();
  }

  // Generate challenge code
  challengeCode = generateChallengeCode(score);

  // Unlock characters
  for (let i = 0; i < CHARACTERS.length; i++) {
    if (!unlockedChars[i] && score >= CHARACTERS[i].unlockScore) {
      unlockedChars[i] = true;
    }
  }
  saveUnlockedChars();

  const entry: LeaderboardEntry = { score, date: getTodayStr(), char: selectedChar, name: getPlayerName() };
  if (isDailyChallenge) {
    dailyLeaderboard = addToLeaderboard(dailyLeaderboard, entry);
    saveDailyLeaderboard(dailyLeaderboard);
    localStorage.setItem(DAILY_PLAYED_KEY, getTodayStr());
    dailyRank = dailyLeaderboard.findIndex(e => e.score === score && e.date === entry.date) + 1;
    saveDailyGlobalBest(score);
  } else {
    leaderboard = addToLeaderboard(leaderboard, entry);
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaderboard));
    dailyRank = 0;
  }

  // Show name input screen on first game over if still using default name
  if (getPlayerName() === '旅行者') {
    setTimeout(() => {
      nameInputValue = '';
      setScreen('nameInput');
    }, 800);
  }
}

function revive() {
  if (reviveUsed) return;
  if (coins < 10) return;
  coins -= 10;
  localStorage.setItem(COINS_KEY, String(coins));
  reviveUsed = true;
  setScreen('playing');
  playerVy = FLAP_VEL;
  deathAnimating = false;
  if (obstacles.length > 0) {
    const nearest = obstacles.reduce((a, b) => Math.abs(a.x - W * 0.15) < Math.abs(b.x - W * 0.15) ? a : b);
    obstacles = obstacles.filter(o => o !== nearest);
  }
  audio.playBGM();
}

// ── Collision detection ────────────────────────────────────────────────────
function checkCollision(obs: Obstacle): { hit: boolean; nearMiss: boolean } {
  const px = W * 0.15;
  const py = playerY;
  const pr = PLAYER_RADIUS * CHARACTERS[selectedChar].radiusMult;

  const effectiveGapY = obs.gapY + (obs.type === 'moving' ? Math.sin(obs.movingOffset) * obs.movingAmp : 0);
  const halfGap = obs.gapH / 2;

  const obsLeft = obs.x;
  const obsRight = obs.x + OBSTACLE_WIDTH;

  if (px + pr > obsLeft && px - pr < obsRight) {
    const topWallBottom = effectiveGapY - halfGap;
    const bottomWallTop = effectiveGapY + halfGap;

    if (py - pr < topWallBottom) return { hit: true, nearMiss: false };
    if (py + pr > bottomWallTop) return { hit: true, nearMiss: false };

    const topMargin = (py - pr) - topWallBottom;
    const bottomMargin = bottomWallTop - (py + pr);
    const minMargin = Math.min(topMargin, bottomMargin);
    if (minMargin < NEAR_MISS_MARGIN) return { hit: false, nearMiss: true };
  }

  return { hit: false, nearMiss: false };
}

function checkDoubleGapCollision(obs: Obstacle): { hit: boolean; nearMiss: boolean } {
  if (!obs.gap2Y || !obs.gap2H) return { hit: false, nearMiss: false };

  const px = W * 0.15;
  const py = playerY;
  const pr = PLAYER_RADIUS * CHARACTERS[selectedChar].radiusMult;

  const secondX = obs.x + OBSTACLE_WIDTH + 30;
  const obsLeft = secondX;
  const obsRight = secondX + OBSTACLE_WIDTH;

  if (px + pr > obsLeft && px - pr < obsRight) {
    const halfGap = obs.gap2H / 2;
    const topWallBottom = obs.gap2Y - halfGap;
    const bottomWallTop = obs.gap2Y + halfGap;

    if (py - pr < topWallBottom) return { hit: true, nearMiss: false };
    if (py + pr > bottomWallTop) return { hit: true, nearMiss: false };

    const topMargin = (py - pr) - topWallBottom;
    const bottomMargin = bottomWallTop - (py + pr);
    const minMargin = Math.min(topMargin, bottomMargin);
    if (minMargin < NEAR_MISS_MARGIN) return { hit: false, nearMiss: true };
  }

  return { hit: false, nearMiss: false };
}

// ── Near-miss trigger ──────────────────────────────────────────────────────
function triggerNearMiss(obs: Obstacle) {
  if (obs.nearMissTriggered) return;
  obs.nearMissTriggered = true;

  nearMisses++;
  nearMissChain++;
  nearMissChainDisplay = 2;
  combo++;
  comboTimer = 2;

  const bonus = nearMissChain;
  score += bonus;

  slowMoTimer = 0.2;

  audio.nearMissChime();
  if (combo > 1) audio.comboHit(combo);

  goldBorderTimer = 0.1;

  const px = W * 0.15;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const sp = 60 + Math.random() * 80;
    spawnParticle(px, playerY, Math.cos(a) * sp, Math.sin(a) * sp, 0.5, 3 + Math.random() * 3, '#ffd700', 'near_miss');
  }

  // Show the actual near-miss bonus in the score pop
  spawnScorePop(px + 20, playerY - 30, bonus > 0 ? bonus : 1);
  const chainText = nearMissChain > 1 ? `险! x${nearMissChain}` : '险!';
  spawnFloatingText(px + 30, playerY - 20, chainText, '#ffd700', 28);
}

// ── Power-up collision ────────────────────────────────────────────────────
function checkPowerUpCollision() {
  const px = W * 0.15;
  const py = playerY;
  const pr = PLAYER_RADIUS * CHARACTERS[selectedChar].radiusMult;
  const collectRadius = magnetActive ? 80 : pr + 12;

  for (const pu of powerUps) {
    if (!pu.active) continue;
    const dx = px - pu.x;
    const dy = py - pu.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < collectRadius) {
      pu.active = false;
      switch (pu.type) {
        case 'coin':
          coins += 5;
          localStorage.setItem(COINS_KEY, String(coins));
          updatePassportCoins(5);
          audio.coinCollect();
          spawnFloatingText(pu.x, pu.y, '+5', '#ffd700', 20);
          break;
        case 'shield':
          shieldPowerUpActive = true;
          audio.powerUp();
          spawnFloatingText(pu.x, pu.y, '护盾!', '#4488ff', 22);
          break;
        case 'magnet':
          magnetActive = true;
          magnetTimer = 5;
          audio.powerUp();
          spawnFloatingText(pu.x, pu.y, '磁铁!', '#aa44ff', 22);
          break;
        case 'wings':
          wingsActive = true;
          wingsTimer = 3;
          audio.powerUp();
          spawnFloatingText(pu.x, pu.y, '飞翼!', '#ffd700', 22);
          break;
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const color = pu.type === 'coin' ? '#ffd700' : pu.type === 'shield' ? '#4488ff' : pu.type === 'magnet' ? '#aa44ff' : '#ffd700';
        spawnParticle(pu.x, pu.y, Math.cos(a) * 50, Math.sin(a) * 50, 0.4, 3, color, 'near_miss');
      }
    }
  }
}

// ── Update ─────────────────────────────────────────────────────────────────
function update(dt: number) {
  titleTime += dt;
  titleScroll += dt * 20;

  // Screen transition cooldown
  if (screenTransitionCooldown > 0) screenTransitionCooldown -= dt;

  // Achievement display timer
  if (achievementDisplayTimer > 0) {
    achievementDisplayTimer -= dt;
  }

  // Freeze game update when paused
  if (gamePaused && gameScreen === 'playing') return;

  if (gameScreen === 'dead') {
    deathTime += dt;
    if (shakeTimer > 0) shakeTimer -= dt;
    if (flashTimer > 0) flashTimer -= dt;
    for (const p of particles) {
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 200 * dt;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; particlePool.push(p); }
    }
    return;
  }

  if (gameScreen !== 'playing') return;

  playTime += dt;
  glowPhase += dt * Math.PI * 2 * 1.2; // ~72bpm heartbeat

  // Wing flap timer
  if (wingFlapTimer > 0) wingFlapTimer -= dt;

  // Ghost afterimage trail at high speed
  ghostSpawnTimer -= dt;
  if (Math.abs(playerVy) > 180 && ghostSpawnTimer <= 0) {
    ghostImages.push({ x: W * 0.15, y: playerY, alpha: 0.35, rotation: 0, charIdx: selectedChar });
    ghostSpawnTimer = 0.06;
  }
  for (let i = ghostImages.length - 1; i >= 0; i--) {
    ghostImages[i].alpha -= dt * 2;
    if (ghostImages[i].alpha <= 0) ghostImages.splice(i, 1);
  }

  // Update BGM score for layered music
  audio.updateBGMScore(score);

  // Death animation
  if (deathAnimating) {
    // Freeze frame
    if (deathFreezeTimer > 0) {
      deathFreezeTimer -= dt;
      // Update collision flash during freeze
      if (collisionFlashTimer > 0) collisionFlashTimer -= dt;
      if (shakeTimer > 0) shakeTimer -= dt;
      return; // Don't update anything else during freeze
    }

    deathAnimTimer += dt;
    deathPlayerVy += GRAVITY * 1.2 * dt;
    deathPlayerY += deathPlayerVy * dt;
    deathPlayerRotation += 8 * dt;

    if (collisionFlashTimer > 0) collisionFlashTimer -= dt;
    if (shakeTimer > 0) shakeTimer -= dt;

    if (Math.random() < 0.6) {
      spawnParticle(
        W * 0.15, deathPlayerY,
        -30 + Math.random() * -30, -10 + Math.random() * 20,
        0.3, 2 + Math.random() * 3,
        '#1a1a1a', 'death'
      );
    }

    if (deathAnimTimer >= 1.0 || deathPlayerY > H + 50) {
      playerY = deathPlayerY;
      die();
    }

    // Update particles during death anim
    for (const p of particles) {
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type === 'death') p.vy += 150 * dt;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; particlePool.push(p); }
    }
    return;
  }

  // Slow-mo
  if (slowMoTimer > 0) {
    slowMoTimer -= dt;
    slowMoFactor = 0.3;
  } else {
    slowMoFactor = 1;
  }

  const sDt = dt * slowMoFactor;

  // Physics
  const effectiveGravity = wingsActive ? GRAVITY * 0.6 : GRAVITY;
  playerVy += effectiveGravity * sDt;
  playerY += playerVy * sDt;

  // Ghost race: record playerY each frame and advance replay index
  if (ghostRaceData.length < GHOST_MAX_FRAMES) {
    ghostRaceData.push(playerY);
  }
  ghostRaceFrameIndex++;

  // Ghost surpass flash timer
  if (ghostSurpassFlashTimer > 0) ghostSurpassFlashTimer -= dt;

  // Check if player surpassed ghost
  if (ghostReplayData && !ghostSurpassed && score > ghostReplayScore) {
    ghostSurpassed = true;
    ghostSurpassFlashTimer = 2.0;
    // Celebration particles
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const sp = 80 + Math.random() * 120;
      spawnParticle(
        W * 0.15, playerY,
        Math.cos(a) * sp, Math.sin(a) * sp,
        0.8 + Math.random() * 0.4,
        3 + Math.random() * 5,
        '#c0c0c0', 'star'
      );
    }
  }

  // Update scarf segments
  if (scarfSegments.length > 0) {
    const targetX = W * 0.15;
    const targetY = playerY;
    scarfSegments[0].x += (targetX - scarfSegments[0].x) * 0.15;
    scarfSegments[0].y += (targetY - scarfSegments[0].y) * 0.15;
    for (let i = 1; i < scarfSegments.length; i++) {
      scarfSegments[i].x += (scarfSegments[i - 1].x - scarfSegments[i].x) * 0.1;
      scarfSegments[i].y += (scarfSegments[i - 1].y - scarfSegments[i].y) * 0.1;
    }
  }

  // Shield timer
  if (shieldTimer > 0) shieldTimer -= dt;

  // Combo timer
  if (comboTimer > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) combo = 0;
  }

  // Gold border timer
  if (goldBorderTimer > 0) goldBorderTimer -= dt;

  // Near-miss chain display timer
  if (nearMissChainDisplay > 0) nearMissChainDisplay -= dt;

  // Power-up timers
  if (magnetTimer > 0) {
    magnetTimer -= dt;
    if (magnetTimer <= 0) magnetActive = false;
  }
  if (wingsTimer > 0) {
    wingsTimer -= dt;
    if (wingsTimer <= 0) wingsActive = false;
  }

  // Cloud bob
  cloudBob += dt;

  // Scroll speed
  scrollSpeed = getScrollSpeed();

  // Ceiling/floor collision
  const pr = PLAYER_RADIUS * CHARACTERS[selectedChar].radiusMult;
  if (playerY - pr < 0 || playerY + pr > H) {
    die();
    return;
  }

  // Obstacle spawning
  obstacleTimer -= sDt;
  if (obstacleTimer <= 0) {
    spawnObstacle();
    const spacing = 220 + Math.max(0, 30 - score) * 2;
    obstacleTimer = spacing / scrollSpeed;
  }

  // Power-up spawning
  powerUpTimer -= sDt;
  if (powerUpTimer <= 0) {
    if (rng() < 0.5) {
      spawnPowerUp(W + 30);
    }
    powerUpTimer = rngRange(2.5, 5);
  }

  // Move obstacles
  for (const obs of obstacles) {
    obs.x -= scrollSpeed * sDt;
    if (obs.type === 'moving') {
      obs.movingOffset += obs.movingSpeed * sDt;
    }

    // Check scoring
    const px = W * 0.15;
    if (!obs.passed && obs.x + OBSTACLE_WIDTH < px) {
      obs.passed = true;
      score++;

      if (!obs.nearMissTriggered) {
        nearMissChain = 0;
      }

      audio.score(score);
      audio.whoosh(); // Satisfying whoosh on pass

      // Score pop "+1"
      spawnScorePop(px + 20, playerY - 30, combo > 0 ? combo : 1);

      // Milestone check
      if (score === 10 || score === 25 || score === 50 || score === 100) {
        audio.milestone(score);
      }

      // Check achievements during gameplay
      const newAch = checkAndUnlockAchievements(score);
      if (newAch.length > 0) {
        achievementDisplayQueue.push(...newAch);
        achievementDisplayTimer = 3;
        audio.achievementSound();
      }
    }

    // Check collision
    const result = checkCollision(obs);
    if (result.hit) { die(); return; }
    if (result.nearMiss && !obs.nearMissTriggered) {
      triggerNearMiss(obs);
    }

    // Double gap collision
    if (obs.type === 'double') {
      const r2 = checkDoubleGapCollision(obs);
      if (r2.hit) { die(); return; }
      if (r2.nearMiss && !obs.nearMissTriggered) {
        triggerNearMiss(obs);
      }
    }
  }

  // Remove off-screen obstacles
  obstacles = obstacles.filter(o => o.x > -OBSTACLE_WIDTH * 3);

  // Move and update power-ups
  for (const pu of powerUps) {
    if (!pu.active) continue;
    pu.x -= scrollSpeed * sDt;
    pu.bobPhase += dt * 3;
    pu.y = pu.baseY + Math.sin(pu.bobPhase) * 12;

    if (magnetActive && pu.type === 'coin') {
      const dx = W * 0.15 - pu.x;
      const dy = playerY - pu.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120 && dist > 0) {
        pu.x += (dx / dist) * 200 * dt;
        pu.baseY += (dy / dist) * 200 * dt;
      }
    }

    if (Math.random() < 0.3) {
      const color = pu.type === 'coin' ? '#ffd700' : pu.type === 'shield' ? '#4488ff' : pu.type === 'magnet' ? '#aa44ff' : '#ffd700';
      spawnParticle(pu.x, pu.y, rngRange(-10, 10), rngRange(-20, -5), 0.3, 2, color, 'powerup_trail');
    }
  }
  powerUps = powerUps.filter(pu => pu.active && pu.x > -20);

  // Power-up collision
  checkPowerUpCollision();

  // Update floating texts (with scale for score pops, constant upward drift)
  for (const ft of floatingTexts) {
    ft.life -= dt;
    if (ft.vy !== undefined) {
      ft.y += ft.vy * dt;
      // Decelerate upward but never reverse direction (no gravity pulling back down)
      if (ft.vy < -20) ft.vy *= 0.96;
    } else {
      ft.y -= 40 * dt;
    }
    if (ft.scale !== undefined && ft.scale > 1) {
      ft.scale = Math.max(1, ft.scale - dt * 4);
    }
  }
  floatingTexts = floatingTexts.filter(ft => ft.life > 0);

  // Update cloud drifts
  for (const cd of cloudDrifts) {
    cd.x -= cd.speed * dt;
    if (cd.x + cd.size < 0) {
      cd.x = W + cd.size;
      cd.y = Math.random() * H * 0.5;
    }
  }

  // Update mountain parallax offsets (was in draw — must use dt for smooth motion)
  // Note: drawMountainLayer multiplies scrollOff by layer.speed for parallax,
  // so we store raw scroll distance here (without layer.speed).
  for (const layer of mountainLayers) {
    layer.offset += scrollSpeed * dt;
  }

  // Stage theme system: check transitions and spawn particles
  checkStageTransition();
  spawnStageParticles(dt);
  updateStageParticles(dt);

  // Trail particles — more vivid, with ink drops
  if (playTime > 0.1) {
    // Regular trail (increased frequency)
    if (Math.random() < 0.6) {
      const trailSize = 1.5 + (scrollSpeed - 120) / 130 * 2;
      spawnParticle(
        W * 0.15 - pr, playerY + rngRange(-4, 4),
        rngRange(-40, -80), rngRange(-10, 10),
        0.3 + Math.random() * 0.3,
        trailSize,
        'rgba(60,60,60,0.5)', 'trail'
      );
    }
    // Ink drops (larger, less frequent)
    if (Math.random() < 0.12) {
      spawnParticle(
        W * 0.15 - pr - 5, playerY + rngRange(-6, 6),
        rngRange(-20, -50), rngRange(-15, 15),
        0.5 + Math.random() * 0.4,
        4 + Math.random() * 5,
        'rgba(30,30,30,0.4)', 'ink_drop'
      );
    }
  }

  // Update particles
  for (const p of particles) {
    if (!p.active) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.type === 'death') p.vy += 150 * dt;
    p.life -= dt;
    if (p.life <= 0) { p.active = false; particlePool.push(p); }
  }

  // Update shake
  if (shakeTimer > 0) shakeTimer -= dt;
}

// ── Draw obstacle ──────────────────────────────────────────────────────────
function drawObstacle(obs: Obstacle) {
  const effectiveGapY = obs.gapY + (obs.type === 'moving' ? Math.sin(obs.movingOffset) * obs.movingAmp : 0);
  const halfGap = obs.gapH / 2;

  const topH = effectiveGapY - halfGap;
  const bottomY = effectiveGapY + halfGap;
  const bottomH = H - bottomY;

  if (obs.type === 'boss') {
    const bossWidth = OBSTACLE_WIDTH * 2;
    drawPillarWithTexture(obs.x - OBSTACLE_WIDTH / 2, 0, bossWidth, topH, true, false, obs.hasVines);
    drawPillarWithTexture(obs.x - OBSTACLE_WIDTH / 2, bottomY, bossWidth, bottomH, false, obs.hasLantern, obs.hasVines);
    drawCreature(obs.x + OBSTACLE_WIDTH / 2, effectiveGapY - halfGap - 30, obs.creatureIdx, 40);
    ctx.save();
    ctx.strokeStyle = '#c23030';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(obs.x - OBSTACLE_WIDTH / 2, topH);
    ctx.lineTo(obs.x + bossWidth - OBSTACLE_WIDTH / 2, topH);
    ctx.moveTo(obs.x - OBSTACLE_WIDTH / 2, bottomY);
    ctx.lineTo(obs.x + bossWidth - OBSTACLE_WIDTH / 2, bottomY);
    ctx.stroke();
    ctx.restore();
  } else if (obs.type === 'creature') {
    drawPillarWithTexture(obs.x, 0, OBSTACLE_WIDTH, topH, true, false, obs.hasVines);
    drawPillarWithTexture(obs.x, bottomY, OBSTACLE_WIDTH, bottomH, false, obs.hasLantern, obs.hasVines);
    drawCreature(obs.x + OBSTACLE_WIDTH / 2, topH - 25, obs.creatureIdx, 28);
  } else if (obs.type === 'double') {
    drawPillarWithTexture(obs.x, 0, OBSTACLE_WIDTH, topH, true, false, obs.hasVines);
    drawPillarWithTexture(obs.x, bottomY, OBSTACLE_WIDTH, bottomH, false, obs.hasLantern, false);
    if (obs.gap2Y !== undefined && obs.gap2H !== undefined) {
      const x2 = obs.x + OBSTACLE_WIDTH + 30;
      const top2H = obs.gap2Y - obs.gap2H / 2;
      const bottom2Y = obs.gap2Y + obs.gap2H / 2;
      drawPillarWithTexture(x2, 0, OBSTACLE_WIDTH, top2H, true, false, false);
      drawPillarWithTexture(x2, bottom2Y, OBSTACLE_WIDTH, H - bottom2Y, false, obs.hasLantern, obs.hasVines);
    }
  } else {
    drawPillarWithTexture(obs.x, 0, OBSTACLE_WIDTH, topH, true, false, obs.hasVines);
    drawPillarWithTexture(obs.x, bottomY, OBSTACLE_WIDTH, bottomH, false, obs.hasLantern, obs.hasVines);
  }
}

// ── Draw power-up ──────────────────────────────────────────────────────────
function drawPowerUp(pu: PowerUp) {
  ctx.save();
  ctx.translate(pu.x, pu.y);

  switch (pu.type) {
    case 'coin': {
      // Outer glow
      const coinGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 18);
      coinGlow.addColorStop(0, 'rgba(255,215,0,0.2)');
      coinGlow.addColorStop(1, 'rgba(255,215,0,0)');
      ctx.fillStyle = coinGlow;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      // Coin body gradient
      const coinGrad = ctx.createRadialGradient(-3, -3, 0, 0, 0, 10);
      coinGrad.addColorStop(0, '#ffe860');
      coinGrad.addColorStop(0.6, '#ffd700');
      coinGrad.addColorStop(1, '#c9a030');
      ctx.fillStyle = coinGrad;
      ctx.globalAlpha = 0.92;
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#997a33';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#8a6a20';
      ctx.font = '700 10px "Noto Serif SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('币', 0, 0);
      break;
    }
    case 'shield': {
      // Glow ring
      const shieldGlow = ctx.createRadialGradient(0, 0, 6, 0, 0, 20);
      shieldGlow.addColorStop(0, 'rgba(68,136,255,0.3)');
      shieldGlow.addColorStop(1, 'rgba(68,136,255,0)');
      ctx.fillStyle = shieldGlow;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.75 + Math.sin(playTime * 4) * 0.2;
      const shGrad = ctx.createRadialGradient(-3, -3, 0, 0, 0, 12);
      shGrad.addColorStop(0, '#88bbff');
      shGrad.addColorStop(0.5, '#4488ff');
      shGrad.addColorStop(1, '#2266dd');
      ctx.fillStyle = shGrad;
      ctx.shadowColor = '#4488ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // Shield icon
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.7;
      ctx.font = '700 12px "Noto Serif SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('盾', 0, 0);
      break;
    }
    case 'magnet': {
      // Glow ring
      const magGlow = ctx.createRadialGradient(0, 0, 5, 0, 0, 18);
      magGlow.addColorStop(0, 'rgba(170,68,255,0.3)');
      magGlow.addColorStop(1, 'rgba(170,68,255,0)');
      ctx.fillStyle = magGlow;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.85;
      const mgGrad = ctx.createRadialGradient(-2, -2, 0, 0, 0, 11);
      mgGrad.addColorStop(0, '#cc77ff');
      mgGrad.addColorStop(0.5, '#aa44ff');
      mgGrad.addColorStop(1, '#7722cc');
      ctx.fillStyle = mgGrad;
      ctx.shadowColor = '#aa44ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // U-shape magnet icon
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 2, 5, 0, Math.PI);
      ctx.moveTo(-5, 2);
      ctx.lineTo(-5, -4);
      ctx.moveTo(5, 2);
      ctx.lineTo(5, -4);
      ctx.stroke();
      break;
    }
    case 'wings': {
      // Glow
      const wingGlow = ctx.createRadialGradient(0, -3, 0, 0, -3, 18);
      wingGlow.addColorStop(0, 'rgba(255,215,0,0.3)');
      wingGlow.addColorStop(1, 'rgba(255,215,0,0)');
      ctx.fillStyle = wingGlow;
      ctx.beginPath();
      ctx.arc(0, -3, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.85 + Math.sin(playTime * 5) * 0.12;
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 8;
      const wGrad = ctx.createLinearGradient(-15, -12, 15, -12);
      wGrad.addColorStop(0, '#ffd700');
      wGrad.addColorStop(0.5, '#ffe880');
      wGrad.addColorStop(1, '#ffd700');
      ctx.fillStyle = wGrad;
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.quadraticCurveTo(-16, -13, -5, -3);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.quadraticCurveTo(16, -13, 5, -3);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#c9a030';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.quadraticCurveTo(-16, -13, -5, -3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.quadraticCurveTo(16, -13, 5, -3);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

// ── Draw cloud drifts (fluffy gradient clouds with depth) ────────────────
function drawCloudDrifts() {
  for (const cd of cloudDrifts) {
    ctx.save();
    const seed = cd.blobSeed;
    const n = 4 + Math.floor(seed % 3);

    // Draw shadow layer first
    ctx.globalAlpha = cd.alpha * 0.3;
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(cd.x + 3, cd.y + 4, cd.size * 0.95, cd.size * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Main cloud body with radial gradient
    const cGrad = ctx.createRadialGradient(cd.x - cd.size * 0.2, cd.y - cd.size * 0.1, 0, cd.x, cd.y, cd.size);
    cGrad.addColorStop(0, `rgba(255,255,255,${cd.alpha * 1.5})`);
    cGrad.addColorStop(0.5, `rgba(240,240,250,${cd.alpha * 1.2})`);
    cGrad.addColorStop(1, `rgba(220,225,235,${cd.alpha * 0.3})`);
    ctx.fillStyle = cGrad;
    ctx.globalAlpha = 1; // alpha is baked into gradient

    // Main blob
    ctx.beginPath();
    ctx.ellipse(cd.x, cd.y, cd.size, cd.size * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sub-blobs with individual gradients for fluffy feel
    for (let i = 0; i < n; i++) {
      const angle = (seed * (i + 1) * 0.7) % (Math.PI * 2);
      const dist = cd.size * 0.25 + (seed * (i + 2) * 0.3) % (cd.size * 0.35);
      const bx = cd.x + Math.cos(angle) * dist;
      const by = cd.y + Math.sin(angle) * dist * 0.35;
      const bsize = cd.size * (0.35 + ((seed * (i + 3) * 0.5) % 0.35));

      const bGrad = ctx.createRadialGradient(bx - bsize * 0.2, by - bsize * 0.15, 0, bx, by, bsize);
      bGrad.addColorStop(0, `rgba(255,255,255,${cd.alpha * 1.3})`);
      bGrad.addColorStop(0.7, `rgba(235,238,245,${cd.alpha * 0.8})`);
      bGrad.addColorStop(1, `rgba(215,220,230,${cd.alpha * 0.1})`);
      ctx.fillStyle = bGrad;
      ctx.beginPath();
      ctx.ellipse(bx, by, bsize, bsize * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Top highlight for volume
    ctx.globalAlpha = cd.alpha * 0.4;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(cd.x - cd.size * 0.15, cd.y - cd.size * 0.12, cd.size * 0.5, cd.size * 0.12, -0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// ── Draw sky background ─────────────────────────────────────────────────
function drawSkyBackground() {
  if (gameScreen === 'playing' || deathAnimating) {
    ctx.save();
    ctx.fillStyle = getSkyGradient();
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // Stars for night mode (score >= 80)
    if (score >= 70) {
      const nightAlpha = Math.min(1, (score - 70) / 10);
      for (const star of stars) {
        const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(playTime * star.twinkleSpeed + star.twinklePhase));
        ctx.save();
        ctx.globalAlpha = nightAlpha * twinkle;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // Moon
      if (score >= 80) {
        ctx.save();
        ctx.globalAlpha = nightAlpha * 0.8;
        ctx.fillStyle = '#fffde0';
        ctx.beginPath();
        ctx.arc(W - 60, 80, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = nightAlpha * 0.6;
        ctx.fillStyle = '#0a0a2e';
        ctx.beginPath();
        ctx.arc(W - 50, 75, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  } else {
    if (paperCanvas) ctx.drawImage(paperCanvas, 0, 0);
  }
}

// ── Draw screens ───────────────────────────────────────────────────────────
function drawTitle() {
  if (paperCanvas) ctx.drawImage(paperCanvas, 0, 0);

  // Animated parallax mountains behind the title
  for (const layer of mountainLayers) {
    drawMountainLayer(layer, titleScroll);
  }

  // Drifting clouds on title
  drawCloudDrifts();

  // Brand watermark at top (subtle)
  ctx.save();
  ctx.globalAlpha = 0.5;
  drawText('麦洛的冒险', W / 2, H * 0.10, 14, '#888');
  ctx.restore();

  // "扶摇万里" stunning calligraphy treatment with ink-drip shadow
  const titleY = H * 0.21;
  const pulse = 1 + Math.sin(titleTime * 2) * 0.015;
  ctx.save();
  ctx.translate(W / 2, titleY);
  ctx.scale(pulse, pulse);

  // Ink drip shadow - multi-layered for wet ink effect
  ctx.save();
  ctx.font = `900 58px 'Noto Serif SC', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Deepest drip (stretched)
  ctx.globalAlpha = 0.025;
  ctx.fillStyle = '#0a0a0a';
  ctx.fillText('扶摇万里', 6, 14);
  // Mid drip
  ctx.globalAlpha = 0.04;
  ctx.fillText('扶摇万里', 4, 9);
  // Near drip
  ctx.globalAlpha = 0.07;
  ctx.fillText('扶摇万里', 2.5, 5.5);
  // Tight shadow
  ctx.globalAlpha = 0.12;
  ctx.fillText('扶摇万里', 1.5, 3);
  // Drip tendrils (ink running down)
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(-20, 28, 2, 12 + Math.sin(titleTime) * 3);
  ctx.fillRect(45, 30, 1.5, 8 + Math.sin(titleTime + 1) * 2);
  ctx.fillRect(-55, 26, 1.5, 10 + Math.sin(titleTime + 2) * 3);
  ctx.restore();

  // Main title with dramatic multi-layer glow
  // Outer red glow
  ctx.save();
  ctx.shadowColor = 'rgba(194,48,48,0.35)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = 'rgba(194,48,48,0.01)';
  ctx.font = `900 58px 'Noto Serif SC', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('扶摇万里', 0, 0);
  ctx.restore();
  // Inner warm glow
  ctx.save();
  ctx.shadowColor = 'rgba(255,200,150,0.2)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#1a1a1a';
  ctx.font = `900 58px 'Noto Serif SC', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('扶摇万里', 0, 0);
  ctx.restore();
  // Crisp main text on top
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#1a1a1a';
  ctx.font = `900 58px 'Noto Serif SC', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('扶摇万里', 0, 0);
  ctx.restore();

  // Decorative red underline with gradient and ornaments
  ctx.save();
  const ulGrad = ctx.createLinearGradient(-90, 32, 90, 32);
  ulGrad.addColorStop(0, 'rgba(194,48,48,0)');
  ulGrad.addColorStop(0.15, 'rgba(194,48,48,0.5)');
  ulGrad.addColorStop(0.5, 'rgba(194,48,48,0.6)');
  ulGrad.addColorStop(0.85, 'rgba(194,48,48,0.5)');
  ulGrad.addColorStop(1, 'rgba(194,48,48,0)');
  ctx.strokeStyle = ulGrad;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(-90, 32);
  ctx.lineTo(90, 32);
  ctx.stroke();
  // Decorative diamond at center
  ctx.fillStyle = '#c23030';
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(0, 29); ctx.lineTo(3, 32); ctx.lineTo(0, 35); ctx.lineTo(-3, 32);
  ctx.closePath();
  ctx.fill();
  // Dot ornaments at ends
  ctx.beginPath();
  ctx.arc(-92, 32, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(92, 32, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();

  drawText("Melo's Quest: Soaring Winds", W / 2, titleY + 48, 12, '#888');

  // High score and coins in a polished info card with gradient and shadow
  const infoBarY = titleY + 68;
  const infoBarW = 220;
  const infoBarH = 54;
  const ibr = 10;
  ctx.save();
  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.12)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 2;
  // Gradient fill
  const ibGrad = ctx.createLinearGradient(W / 2 - infoBarW / 2, infoBarY, W / 2 - infoBarW / 2, infoBarY + infoBarH);
  ibGrad.addColorStop(0, 'rgba(250,245,235,0.75)');
  ibGrad.addColorStop(0.5, 'rgba(245,239,227,0.65)');
  ibGrad.addColorStop(1, 'rgba(235,228,215,0.55)');
  ctx.fillStyle = ibGrad;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(W / 2 - infoBarW / 2 + ibr, infoBarY);
  ctx.lineTo(W / 2 + infoBarW / 2 - ibr, infoBarY);
  ctx.quadraticCurveTo(W / 2 + infoBarW / 2, infoBarY, W / 2 + infoBarW / 2, infoBarY + ibr);
  ctx.lineTo(W / 2 + infoBarW / 2, infoBarY + infoBarH - ibr);
  ctx.quadraticCurveTo(W / 2 + infoBarW / 2, infoBarY + infoBarH, W / 2 + infoBarW / 2 - ibr, infoBarY + infoBarH);
  ctx.lineTo(W / 2 - infoBarW / 2 + ibr, infoBarY + infoBarH);
  ctx.quadraticCurveTo(W / 2 - infoBarW / 2, infoBarY + infoBarH, W / 2 - infoBarW / 2, infoBarY + infoBarH - ibr);
  ctx.lineTo(W / 2 - infoBarW / 2, infoBarY + ibr);
  ctx.quadraticCurveTo(W / 2 - infoBarW / 2, infoBarY, W / 2 - infoBarW / 2 + ibr, infoBarY);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Border
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  // Divider line between score and coins
  ctx.globalAlpha = 0.12;
  ctx.beginPath();
  ctx.moveTo(W / 2, infoBarY + 6);
  ctx.lineTo(W / 2, infoBarY + infoBarH - 6);
  ctx.stroke();
  ctx.restore();
  drawText(`最高: ${highScore}`, W / 2 - 50, infoBarY + 16, 15, '#333', 'center');
  drawText(`金币: ${coins}`, W / 2 + 50, infoBarY + 16, 15, '#997a33', 'center');

  // Player name
  const pName = getPlayerName();
  drawText(`${pName}`, W / 2, infoBarY + 38, 13, '#666');

  // Achievement seals row
  const unlockedAch = loadAchievements();
  const sealY = titleY + 158;
  const sealSpacing = 50;
  const sealStartX = W / 2 - (ACHIEVEMENT_DEFS.length - 1) * sealSpacing / 2;
  for (let i = 0; i < ACHIEVEMENT_DEFS.length; i++) {
    const a = ACHIEVEMENT_DEFS[i];
    const isUnlocked = unlockedAch.includes(a.id);
    drawSealStamp(sealStartX + i * sealSpacing, sealY, a.name, 16, isUnlocked);
  }

  // Melo preview
  drawMelo(W / 2, H * 0.48, selectedChar, titleTime);

  // Buttons
  buttons = [];

  const btnW = 200;
  const btnH = 48;
  const btnX = W / 2 - btnW / 2;
  let btnY = H * 0.56;

  const startBtn: Button = { x: btnX, y: btnY, w: btnW, h: btnH, label: '点击开始', action: () => {
    isDailyChallenge = false;
    resetGame();
    setScreen('playing');
    audio.playBGM();
  }};
  buttons.push(startBtn);
  drawButton(startBtn, 'primary');

  btnY += 55;
  const dailyPlayed = hasDailyBeenPlayed();
  const dailyBtn: Button = { x: btnX, y: btnY, w: btnW, h: btnH, label: dailyPlayed ? '每日挑战 (已完成)' : '每日挑战', action: () => {
    if (dailyPlayed) return;
    isDailyChallenge = true;
    resetGame();
    setScreen('playing');
    audio.playBGM();
  }};
  buttons.push(dailyBtn);
  drawButton(dailyBtn, dailyPlayed ? 'secondary' : 'primary');

  btnY += 55;
  const charBtn: Button = { x: btnX, y: btnY, w: btnW, h: btnH, label: '选择角色', action: () => { setScreen('charSelect'); }};
  buttons.push(charBtn);
  drawButton(charBtn);

  btnY += 55;
  const lbBtn: Button = { x: btnX, y: btnY, w: btnW, h: btnH, label: '排行榜', action: () => { setScreen('leaderboard'); }};
  buttons.push(lbBtn);
  drawButton(lbBtn);

  btnY += 55;
  const nameBtn: Button = { x: btnX, y: btnY, w: btnW, h: btnH, label: '修改名字', action: () => {
    nameInputValue = getPlayerName();
    setScreen('nameInput');
  }};
  buttons.push(nameBtn);
  drawButton(nameBtn);

  // Mute button (top-right on title)
  const titleMuteBtnX = W - 44;
  const titleMuteBtnY = 15;
  const titleMuteBtn: Button = {
    x: titleMuteBtnX, y: titleMuteBtnY, w: 32, h: 32,
    label: '', action: () => {
      gameMuted = !gameMuted;
      audio.muted = gameMuted;
      localStorage.setItem(MUTE_KEY, String(gameMuted));
      if (gameMuted) { audio.stopBGM(); }
    }
  };
  buttons.push(titleMuteBtn);
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = 'rgba(240,230,211,0.6)';
  ctx.beginPath();
  ctx.arc(titleMuteBtnX + 16, titleMuteBtnY + 16, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.font = '700 14px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(gameMuted ? '静' : '音', titleMuteBtnX + 16, titleMuteBtnY + 16);
  ctx.restore();

  // Chapter indicator at bottom
  drawText('麦洛的冒险 · 第二章', W / 2, H - 40, 12, '#999');

  // Vignette
  if (vignetteGrad) {
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawPlaying() {
  buttons = [];
  drawSkyBackground();

  // Aurora (behind clouds, for starry crossing)
  drawAurora();

  drawCloudDrifts();

  // Fog layers (spirit mist stage, behind mountains)
  if (getStageTheme() === 'spirit_mist') {
    drawFogLayers();
  }

  // Parallax mountains (offsets updated in update())
  for (const layer of mountainLayers) {
    drawMountainLayer(layer, layer.offset);
  }

  // Stage-specific particles (between background and obstacles)
  drawStageParticles();

  // Obstacles
  for (const obs of obstacles) {
    drawObstacle(obs);
  }

  // Power-ups
  for (const pu of powerUps) {
    if (pu.active) drawPowerUp(pu);
  }

  // Particles (behind player) - enhanced with gradients and glow
  for (const p of particles) {
    if (!p.active) continue;
    const alpha = p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (p.type === 'ink_drop') {
      // Ink drop: gradient blob with feathered edge
      const inkGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * alpha);
      inkGrad.addColorStop(0, 'rgba(20,20,20,0.6)');
      inkGrad.addColorStop(0.5, 'rgba(30,30,30,0.35)');
      inkGrad.addColorStop(1, 'rgba(40,40,40,0)');
      ctx.fillStyle = inkGrad;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.size * alpha * 1.2, p.size * alpha * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'near_miss') {
      // Near miss: glowing golden particle
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      const nmGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      nmGrad.addColorStop(0, '#fff');
      nmGrad.addColorStop(0.3, p.color);
      nmGrad.addColorStop(1, 'rgba(255,215,0,0)');
      ctx.fillStyle = nmGrad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'death') {
      // Death: darker with subtle gradient
      const dGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * alpha);
      dGrad.addColorStop(0, '#1a1a1a');
      dGrad.addColorStop(0.6, '#2a2a2a');
      dGrad.addColorStop(1, 'rgba(26,26,26,0)');
      ctx.fillStyle = dGrad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha * 1.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'powerup_trail') {
      // Powerup trail: glowing dot
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 4;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Regular trail: soft fading dot
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // God-rays during dawn/dusk phases - gradient-filled diagonal beams
  if (score >= 15 && score < 75) {
    if (!godRaysInitialized) initGodRays();
    const rayIntensity = score < 30 ? (score - 15) / 15 : score > 55 ? (75 - score) / 20 : 1;
    ctx.save();
    for (const ray of godRays) {
      ctx.globalAlpha = ray.alpha * rayIntensity;
      const rx = ray.x + Math.sin(playTime * ray.speed * 0.1) * 20;
      const rayEndX = rx + ray.angle * ray.length;
      // Gradient from top (bright) to bottom (transparent)
      const rayGrad = ctx.createLinearGradient(rx, 0, rayEndX, ray.length);
      rayGrad.addColorStop(0, 'rgba(255,240,200,0.2)');
      rayGrad.addColorStop(0.3, 'rgba(255,230,180,0.12)');
      rayGrad.addColorStop(0.7, 'rgba(255,220,160,0.05)');
      rayGrad.addColorStop(1, 'rgba(255,210,140,0)');
      ctx.fillStyle = rayGrad;
      ctx.beginPath();
      ctx.moveTo(rx - ray.width / 2, 0);
      ctx.lineTo(rx + ray.width / 2, 0);
      ctx.lineTo(rx + ray.width * 0.8 + ray.angle * ray.length, ray.length);
      ctx.lineTo(rx - ray.width * 0.3 + ray.angle * ray.length, ray.length);
      ctx.closePath();
      ctx.fill();
      // Soft edge glow on ray borders
      ctx.globalAlpha = ray.alpha * rayIntensity * 0.3;
      ctx.strokeStyle = 'rgba(255,240,210,0.1)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  // Ghost Race replay (rendered behind real player)
  if (ghostReplayData && ghostRaceFrameIndex > 0) {
    const gi = Math.min(ghostRaceFrameIndex - 1, ghostReplayData.length - 1);
    if (gi < ghostReplayData.length) {
      const ghostY = ghostReplayData[gi];
      const ghostX = W * 0.15;
      const ghostR = PLAYER_RADIUS * 0.85; // slightly smaller

      ctx.save();

      // Ghost trail (silver particles behind)
      if (ghostRaceFrameIndex % 3 === 0) {
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#c0c0c0';
        for (let t = 1; t <= 3; t++) {
          const trailIdx = Math.max(0, gi - t * 4);
          if (trailIdx < ghostReplayData.length) {
            const ty = ghostReplayData[trailIdx];
            ctx.beginPath();
            ctx.arc(ghostX + t * 4, ty, ghostR * (1 - t * 0.2), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Ghost body - semi-transparent silver/grey
      ctx.globalAlpha = 0.3;
      const ghostGrad = ctx.createRadialGradient(ghostX, ghostY, 0, ghostX, ghostY, ghostR * 1.5);
      ghostGrad.addColorStop(0, 'rgba(192,192,192,0.4)');
      ghostGrad.addColorStop(0.5, 'rgba(160,160,160,0.25)');
      ghostGrad.addColorStop(1, 'rgba(128,128,128,0)');
      ctx.fillStyle = ghostGrad;
      ctx.beginPath();
      ctx.arc(ghostX, ghostY, ghostR * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Inner body
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#b0b0b0';
      ctx.beginPath();
      ctx.arc(ghostX, ghostY, ghostR, 0, Math.PI * 2);
      ctx.fill();

      // Eyes (simple dots)
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#666';
      ctx.beginPath();
      ctx.arc(ghostX - ghostR * 0.3, ghostY - ghostR * 0.15, 1.5, 0, Math.PI * 2);
      ctx.arc(ghostX + ghostR * 0.1, ghostY - ghostR * 0.15, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // "幽影" label above ghost
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#999';
      ctx.font = '600 10px "Noto Serif SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`幽影 (${ghostReplayScore})`, ghostX, ghostY - ghostR - 6);

      ctx.restore();

      // Ghost death marker: show "×" at the last frame position when we are near/past it
      if (gi >= ghostReplayData.length - 5) {
        const deathY = ghostReplayData[ghostReplayData.length - 1];
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#999';
        ctx.font = '700 16px "Noto Serif SC", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('×', ghostX, deathY);
        ctx.restore();
      }
    }
  }

  // "超越幽影!" celebration text
  if (ghostSurpassFlashTimer > 0) {
    const alpha = Math.min(1, ghostSurpassFlashTimer);
    const scale = 1 + (2.0 - ghostSurpassFlashTimer) * 0.1;
    ctx.save();
    ctx.translate(W / 2, H * 0.3);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#c0c0c0';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 12;
    ctx.font = '900 28px "Noto Serif SC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('超越幽影!', 0, 0);
    ctx.restore();
  }

  // Ghost afterimage trail (behind player) - gradient bodies with glow
  for (const ghost of ghostImages) {
    ctx.save();
    ctx.translate(ghost.x, ghost.y);
    const gch = CHARACTERS[ghost.charIdx];
    const gr = PLAYER_RADIUS * gch.radiusMult;
    // Outer glow
    const ghostGlow = ctx.createRadialGradient(0, 0, gr * 0.3, 0, 0, gr * 1.8);
    ghostGlow.addColorStop(0, `rgba(255,170,68,${ghost.alpha * 0.15})`);
    ghostGlow.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = ghostGlow;
    ctx.beginPath();
    ctx.arc(0, 0, gr * 1.8, 0, Math.PI * 2);
    ctx.fill();
    // Body gradient ghost
    ctx.globalAlpha = ghost.alpha * 0.45;
    const ghostBodyGrad = ctx.createRadialGradient(-gr * 0.2, -gr * 0.2, 0, 0, 0, gr);
    ghostBodyGrad.addColorStop(0, gch.color);
    ghostBodyGrad.addColorStop(0.6, gch.color);
    ghostBodyGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ghostBodyGrad;
    ctx.beginPath();
    ctx.arc(0, 0, gr, 0, Math.PI * 2);
    ctx.fill();
    // Scarf ghost trace
    ctx.globalAlpha = ghost.alpha * 0.25;
    ctx.strokeStyle = gch.scarfColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-gr * 0.3, 0);
    ctx.quadraticCurveTo(-gr * 1.5, gr * 0.1, -gr * 2.2, gr * 0.3);
    ctx.stroke();
    ctx.restore();
  }

  // Player (or death animation)
  if (deathAnimating) {
    drawMelo(W * 0.15, deathPlayerY, selectedChar, playTime, deathPlayerRotation);
  } else {
    drawMelo(W * 0.15, playerY, selectedChar, playTime);
  }

  // Floating texts (with scale for score pops)
  for (const ft of floatingTexts) {
    const alpha = Math.min(1, ft.life / ft.maxLife * 2);
    ctx.save();
    if (ft.scale && ft.scale > 1) {
      ctx.translate(ft.x, ft.y);
      ctx.scale(ft.scale, ft.scale);
      drawCalliText(ft.text, 0, 0, ft.size, ft.color, alpha);
    } else {
      drawCalliText(ft.text, ft.x, ft.y, ft.size, ft.color, alpha);
    }
    ctx.restore();
  }

  // HUD - Score panel with rounded rect, rich gradient bg, border, inner decoration
  ctx.save();
  const scorePanelW = 130;
  const scorePanelH = 52;
  const scorePanelX = W / 2 - scorePanelW / 2;
  const scorePanelY = 30;

  // Rounded rect path helper
  function scoreRRect() {
    const spr = 16;
    ctx.beginPath();
    ctx.moveTo(scorePanelX + spr, scorePanelY);
    ctx.lineTo(scorePanelX + scorePanelW - spr, scorePanelY);
    ctx.quadraticCurveTo(scorePanelX + scorePanelW, scorePanelY, scorePanelX + scorePanelW, scorePanelY + spr);
    ctx.lineTo(scorePanelX + scorePanelW, scorePanelY + scorePanelH - spr);
    ctx.quadraticCurveTo(scorePanelX + scorePanelW, scorePanelY + scorePanelH, scorePanelX + scorePanelW - spr, scorePanelY + scorePanelH);
    ctx.lineTo(scorePanelX + spr, scorePanelY + scorePanelH);
    ctx.quadraticCurveTo(scorePanelX, scorePanelY + scorePanelH, scorePanelX, scorePanelY + scorePanelH - spr);
    ctx.lineTo(scorePanelX, scorePanelY + spr);
    ctx.quadraticCurveTo(scorePanelX, scorePanelY, scorePanelX + spr, scorePanelY);
  }

  // Drop shadow
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 3;
  // Panel background - richer 3-stop gradient
  const panelGrad = ctx.createLinearGradient(scorePanelX, scorePanelY, scorePanelX, scorePanelY + scorePanelH);
  panelGrad.addColorStop(0, 'rgba(250,245,235,0.92)');
  panelGrad.addColorStop(0.4, 'rgba(245,239,227,0.88)');
  panelGrad.addColorStop(1, 'rgba(228,218,198,0.82)');
  ctx.fillStyle = panelGrad;
  scoreRRect();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Top highlight (glass)
  ctx.globalAlpha = 0.2;
  const topHl = ctx.createLinearGradient(scorePanelX, scorePanelY, scorePanelX, scorePanelY + scorePanelH * 0.4);
  topHl.addColorStop(0, '#fff');
  topHl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = topHl;
  scoreRRect();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Panel border
  ctx.strokeStyle = 'rgba(26,26,26,0.18)';
  ctx.lineWidth = 1;
  scoreRRect();
  ctx.stroke();

  // Inner subtle decorative border
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(scorePanelX + 4, scorePanelY + 4, scorePanelW - 8, scorePanelH - 8);
  ctx.globalAlpha = 1;

  ctx.restore();
  // Score text with subtle shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.1)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1;
  drawCalliText(String(score), W / 2, scorePanelY + scorePanelH / 2, 40, '#1a1a1a', 0.92);
  ctx.restore();

  // Near-miss chain multiplier with glow
  if (nearMissChain > 1 && nearMissChainDisplay > 0) {
    const chainAlpha = Math.min(1, nearMissChainDisplay);
    ctx.save();
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 12 * chainAlpha;
    drawCalliText(`x${nearMissChain}`, W / 2 + 70, scorePanelY + scorePanelH / 2, 22, '#ffd700', chainAlpha);
    ctx.restore();
  }

  // Coins panel (top right)
  ctx.save();
  const coinPanelW = 85;
  const coinPanelH = 28;
  const coinPanelX = W - coinPanelW - 10;
  const coinPanelY = 22;
  ctx.fillStyle = 'rgba(245,239,227,0.7)';
  ctx.shadowColor = 'rgba(0,0,0,0.1)';
  ctx.shadowBlur = 6;
  const cpr = 10;
  ctx.beginPath();
  ctx.moveTo(coinPanelX + cpr, coinPanelY);
  ctx.lineTo(coinPanelX + coinPanelW - cpr, coinPanelY);
  ctx.quadraticCurveTo(coinPanelX + coinPanelW, coinPanelY, coinPanelX + coinPanelW, coinPanelY + cpr);
  ctx.lineTo(coinPanelX + coinPanelW, coinPanelY + coinPanelH - cpr);
  ctx.quadraticCurveTo(coinPanelX + coinPanelW, coinPanelY + coinPanelH, coinPanelX + coinPanelW - cpr, coinPanelY + coinPanelH);
  ctx.lineTo(coinPanelX + cpr, coinPanelY + coinPanelH);
  ctx.quadraticCurveTo(coinPanelX, coinPanelY + coinPanelH, coinPanelX, coinPanelY + coinPanelH - cpr);
  ctx.lineTo(coinPanelX, coinPanelY + cpr);
  ctx.quadraticCurveTo(coinPanelX, coinPanelY, coinPanelX + cpr, coinPanelY);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Coin icon with gradient
  const coinIconGrad = ctx.createRadialGradient(coinPanelX + 18, coinPanelY + coinPanelH / 2, 0, coinPanelX + 18, coinPanelY + coinPanelH / 2, 8);
  coinIconGrad.addColorStop(0, '#ffe040');
  coinIconGrad.addColorStop(1, '#c9a030');
  ctx.fillStyle = coinIconGrad;
  ctx.beginPath();
  ctx.arc(coinPanelX + 18, coinPanelY + coinPanelH / 2, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#997a33';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#8a6a20';
  ctx.font = '700 8px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('币', coinPanelX + 18, coinPanelY + coinPanelH / 2);
  ctx.restore();
  drawText(`${coins + Math.floor(score / COIN_RATE)}`, coinPanelX + coinPanelW - 10, coinPanelY + coinPanelH / 2, 14, '#997a33', 'right');

  // Active power-up indicators (icon-based with progress rings)
  let puY = H - 30;
  if (magnetActive) {
    ctx.save();
    const progress = magnetTimer / 5;
    ctx.strokeStyle = '#aa44ff';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#aa44ff';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(30, puY, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(170,68,255,0.15)';
    ctx.beginPath();
    ctx.arc(30, puY, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawText('磁', 30, puY, 11, '#aa44ff', 'center', '700');
    drawText(`${magnetTimer.toFixed(1)}s`, 55, puY, 10, '#aa44ff', 'left', '400');
    puY -= 32;
  }
  if (wingsActive) {
    ctx.save();
    const progress = wingsTimer / 3;
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(30, puY, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,215,0,0.15)';
    ctx.beginPath();
    ctx.arc(30, puY, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawText('翼', 30, puY, 11, '#c9a030', 'center', '700');
    drawText(`${wingsTimer.toFixed(1)}s`, 55, puY, 10, '#c9a030', 'left', '400');
    puY -= 32;
  }
  if (shieldPowerUpActive) {
    ctx.save();
    ctx.strokeStyle = '#4488ff';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#4488ff';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(30, puY, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(68,136,255,0.15)';
    ctx.beginPath();
    ctx.arc(30, puY, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawText('盾', 30, puY, 11, '#4488ff', 'center', '700');
  }

  // Combo indicator - dramatic scaling, glow, and fire effect at high combos
  if (combo > 1 && comboTimer > 0) {
    const comboAlpha = Math.min(1, comboTimer);
    const comboScale = combo > 8 ? 1.4 : combo > 5 ? 1.25 : combo > 3 ? 1.15 : 1.0;
    const comboPulse = 1 + Math.sin(playTime * 12) * (combo > 5 ? 0.06 : 0.03);
    ctx.save();
    ctx.translate(W / 2, 100);
    ctx.scale(comboScale * comboPulse, comboScale * comboPulse);
    // Outer glow ring at high combos
    if (combo > 5) {
      const ringGlow = ctx.createRadialGradient(0, 0, 10, 0, 0, 60);
      ringGlow.addColorStop(0, `rgba(194,48,48,${comboAlpha * 0.2})`);
      ringGlow.addColorStop(0.5, `rgba(255,100,30,${comboAlpha * 0.08})`);
      ringGlow.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = ringGlow;
      ctx.beginPath();
      ctx.arc(0, 0, 60, 0, Math.PI * 2);
      ctx.fill();
    }
    // Multiple shadow layers for strong glow
    if (combo > 3) {
      ctx.shadowColor = combo > 6 ? '#ff4020' : '#c23030';
      ctx.shadowBlur = (combo > 6 ? 25 : 15) * comboAlpha;
    }
    const comboColor = combo > 6 ? '#ff3030' : '#c23030';
    const comboSize = combo > 8 ? 34 : combo > 5 ? 30 : combo > 3 ? 26 : 24;
    drawCalliText(`${combo}x 连击!`, 0, 0, comboSize, comboColor, comboAlpha);
    // Accent underline at high combos
    if (combo > 4) {
      ctx.globalAlpha = comboAlpha * 0.5;
      const ulGrad = ctx.createLinearGradient(-40, 0, 40, 0);
      ulGrad.addColorStop(0, 'rgba(194,48,48,0)');
      ulGrad.addColorStop(0.3, comboColor);
      ulGrad.addColorStop(0.7, comboColor);
      ulGrad.addColorStop(1, 'rgba(194,48,48,0)');
      ctx.strokeStyle = ulGrad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-50, comboSize * 0.6);
      ctx.lineTo(50, comboSize * 0.6);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Near miss flash - gold border
  if (goldBorderTimer > 0) {
    ctx.save();
    ctx.globalAlpha = goldBorderTimer * 10;
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, W - 6, H - 6);
    ctx.restore();
  }

  // Collision white flash
  if (collisionFlashTimer > 0) {
    ctx.save();
    ctx.globalAlpha = collisionFlashTimer * 20; // 50ms flash
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // Slow-mo tint
  if (slowMoTimer > 0) {
    ctx.save();
    ctx.globalAlpha = slowMoTimer * 2;
    ctx.fillStyle = 'rgba(255,215,0,0.05)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // Daily challenge indicator
  if (isDailyChallenge) {
    drawText('每日挑战', W / 2, 95, 12, '#c23030');
    if (dailyGlobalBest > 0) {
      drawText(`今日最高: ${dailyGlobalBest}`, W / 2, 115, 11, '#997a33');
    }
  }

  // Stage transition announcement
  drawStageAnnouncement();

  // Achievement unlock notification (card style with glow)
  if (achievementDisplayTimer > 0 && achievementDisplayQueue.length > 0) {
    const ach = achievementDisplayQueue[0];
    const alpha = Math.min(1, achievementDisplayTimer, (3 - achievementDisplayTimer) * 2);
    const achCardX = W / 2 - 110;
    const achCardY = H * 0.14;
    const achCardW = 220;
    const achCardH = 54;
    ctx.save();
    // Card shadow
    ctx.shadowColor = 'rgba(194,48,48,0.3)';
    ctx.shadowBlur = 15;
    ctx.globalAlpha = alpha * 0.92;
    const achGrad = ctx.createLinearGradient(achCardX, achCardY, achCardX, achCardY + achCardH);
    achGrad.addColorStop(0, '#f8f2e6');
    achGrad.addColorStop(1, '#f0e6d3');
    ctx.fillStyle = achGrad;
    const achR = 8;
    ctx.beginPath();
    ctx.moveTo(achCardX + achR, achCardY);
    ctx.lineTo(achCardX + achCardW - achR, achCardY);
    ctx.quadraticCurveTo(achCardX + achCardW, achCardY, achCardX + achCardW, achCardY + achR);
    ctx.lineTo(achCardX + achCardW, achCardY + achCardH - achR);
    ctx.quadraticCurveTo(achCardX + achCardW, achCardY + achCardH, achCardX + achCardW - achR, achCardY + achCardH);
    ctx.lineTo(achCardX + achR, achCardY + achCardH);
    ctx.quadraticCurveTo(achCardX, achCardY + achCardH, achCardX, achCardY + achCardH - achR);
    ctx.lineTo(achCardX, achCardY + achR);
    ctx.quadraticCurveTo(achCardX, achCardY, achCardX + achR, achCardY);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#c23030';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = alpha;
    drawSealStamp(achCardX + 30, achCardY + achCardH / 2, ach.name, 14, true);
    drawText(`印章解锁: ${ach.name}`, achCardX + achCardW / 2 + 15, achCardY + achCardH / 2, 14, '#c23030');
    ctx.restore();
  }
  // Advance achievement queue when timer expires
  if (achievementDisplayTimer <= 0 && achievementDisplayQueue.length > 0) {
    achievementDisplayQueue.shift();
    if (achievementDisplayQueue.length > 0) achievementDisplayTimer = 3;
  }

  // Pause button (top-right)
  const pauseBtnX = W - 44;
  const pauseBtnY = 58;
  const pauseBtn: Button = {
    x: pauseBtnX, y: pauseBtnY, w: 32, h: 32,
    label: '', action: () => { gamePaused = !gamePaused; }
  };
  buttons.push(pauseBtn);
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = 'rgba(240,230,211,0.6)';
  ctx.beginPath();
  ctx.arc(pauseBtnX + 16, pauseBtnY + 16, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  if (gamePaused) {
    // Play triangle icon
    ctx.beginPath();
    ctx.moveTo(pauseBtnX + 12, pauseBtnY + 8);
    ctx.lineTo(pauseBtnX + 24, pauseBtnY + 16);
    ctx.lineTo(pauseBtnX + 12, pauseBtnY + 24);
    ctx.closePath();
    ctx.fill();
  } else {
    // Pause bars icon
    ctx.fillRect(pauseBtnX + 10, pauseBtnY + 9, 5, 14);
    ctx.fillRect(pauseBtnX + 18, pauseBtnY + 9, 5, 14);
  }
  ctx.restore();

  // Mute button (below pause)
  const muteBtnX = W - 44;
  const muteBtnY = 96;
  const muteBtn: Button = {
    x: muteBtnX, y: muteBtnY, w: 32, h: 32,
    label: '', action: () => {
      gameMuted = !gameMuted;
      audio.muted = gameMuted;
      localStorage.setItem(MUTE_KEY, String(gameMuted));
      if (gameMuted) { audio.stopBGM(); } else if (gameScreen === 'playing' && !gamePaused) { audio.playBGM(); }
    }
  };
  buttons.push(muteBtn);
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = 'rgba(240,230,211,0.6)';
  ctx.beginPath();
  ctx.arc(muteBtnX + 16, muteBtnY + 16, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.font = '700 14px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(gameMuted ? '静' : '音', muteBtnX + 16, muteBtnY + 16);
  ctx.restore();

  // Pause overlay
  if (gamePaused) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#f0e6d3';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    drawCalliText('暂停', W / 2, H * 0.4, 48, '#1a1a1a', 0.9);
    drawText('点击继续按钮或按P键', W / 2, H * 0.4 + 50, 14, '#666');
  }

  // Vignette
  if (vignetteGrad) {
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawDead() {
  if (paperCanvas) ctx.drawImage(paperCanvas, 0, 0);

  for (const layer of mountainLayers) {
    drawMountainLayer(layer, layer.offset);
  }

  for (const obs of obstacles) {
    drawObstacle(obs);
  }

  // Death particles
  for (const p of particles) {
    if (!p.active) continue;
    const alpha = p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Flash
  if (flashTimer > 0) {
    ctx.save();
    ctx.globalAlpha = flashTimer * 5;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // Overlay
  const fadeIn = Math.min(1, deathTime * 2);
  ctx.save();
  ctx.globalAlpha = fadeIn * 0.6;
  ctx.fillStyle = '#f0e6d3';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  if (fadeIn < 0.5) return;

  const alpha = Math.min(1, (fadeIn - 0.5) * 2);

  // Score card - parchment style with shadow and border
  const cardX = 35;
  const cardY = H * 0.10;
  const cardW = W - 70;
  const cardH = 430;

  ctx.save();
  ctx.globalAlpha = alpha * 0.97;
  // Card shadow (deeper)
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 25;
  ctx.shadowOffsetY = 5;
  // Parchment gradient
  const parchGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  parchGrad.addColorStop(0, '#f8f2e6');
  parchGrad.addColorStop(0.3, '#f5efe3');
  parchGrad.addColorStop(0.7, '#f2eade');
  parchGrad.addColorStop(1, '#ede4d4');
  ctx.fillStyle = parchGrad;
  const r = 14;
  ctx.beginPath();
  ctx.moveTo(cardX + r, cardY);
  ctx.lineTo(cardX + cardW - r, cardY);
  ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + r);
  ctx.lineTo(cardX + cardW, cardY + cardH - r);
  ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - r, cardY + cardH);
  ctx.lineTo(cardX + r, cardY + cardH);
  ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - r);
  ctx.lineTo(cardX, cardY + r);
  ctx.quadraticCurveTo(cardX, cardY, cardX + r, cardY);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Solid border
  ctx.strokeStyle = 'rgba(26,26,26,0.15)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // Ink-wash frame decoration (brush stroke corners)
  ctx.save();
  ctx.globalAlpha = alpha * 0.4;
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2;
  const insetX = cardX + 12;
  const insetY = cardY + 12;
  const insetW = cardW - 24;
  const insetH = cardH - 24;
  // Corner brackets
  const cornerLen = 18;
  // TL
  ctx.beginPath();
  ctx.moveTo(insetX, insetY + cornerLen);
  ctx.lineTo(insetX, insetY);
  ctx.lineTo(insetX + cornerLen, insetY);
  ctx.stroke();
  // TR
  ctx.beginPath();
  ctx.moveTo(insetX + insetW - cornerLen, insetY);
  ctx.lineTo(insetX + insetW, insetY);
  ctx.lineTo(insetX + insetW, insetY + cornerLen);
  ctx.stroke();
  // BL
  ctx.beginPath();
  ctx.moveTo(insetX, insetY + insetH - cornerLen);
  ctx.lineTo(insetX, insetY + insetH);
  ctx.lineTo(insetX + cornerLen, insetY + insetH);
  ctx.stroke();
  // BR
  ctx.beginPath();
  ctx.moveTo(insetX + insetW - cornerLen, insetY + insetH);
  ctx.lineTo(insetX + insetW, insetY + insetH);
  ctx.lineTo(insetX + insetW, insetY + insetH - cornerLen);
  ctx.stroke();
  // Inner dotted line
  ctx.globalAlpha = alpha * 0.12;
  ctx.setLineDash([3, 5]);
  ctx.lineWidth = 0.5;
  ctx.strokeRect(insetX + 6, insetY + 6, insetW - 12, insetH - 12);
  ctx.setLineDash([]);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = alpha;

  let ty = cardY + 35;
  drawText('麦洛的冒险', W / 2, ty, 13, '#aaa');
  ty += 28;
  drawCalliText('游戏结束', W / 2, ty, 30);
  ty += 50;

  // Score number: large, dramatic, with multi-layer glow
  const isNewRecord = score >= highScore && score > 0;
  ctx.save();
  // Outer glow layer
  if (isNewRecord) {
    ctx.shadowColor = 'rgba(194,48,48,0.6)';
    ctx.shadowBlur = 35;
    // Draw ghost text for extra glow
    ctx.globalAlpha = alpha * 0.3;
    ctx.fillStyle = '#c23030';
    ctx.font = `900 56px 'Noto Serif SC', serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(score), W / 2, ty);
    ctx.globalAlpha = alpha;
  }
  ctx.restore();
  // Main score text
  ctx.save();
  if (isNewRecord) {
    ctx.shadowColor = 'rgba(194,48,48,0.5)';
    ctx.shadowBlur = 20;
  } else {
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 12;
  }
  drawCalliText(String(score), W / 2, ty, 60, isNewRecord ? '#c23030' : '#1a1a1a');
  ctx.restore();
  // Score underline accent
  ctx.save();
  ctx.globalAlpha = alpha * 0.25;
  const scoreUlColor = isNewRecord ? '#c23030' : '#1a1a1a';
  const scoreUlGrad = ctx.createLinearGradient(W / 2 - 50, ty + 30, W / 2 + 50, ty + 30);
  scoreUlGrad.addColorStop(0, 'rgba(0,0,0,0)');
  scoreUlGrad.addColorStop(0.3, scoreUlColor);
  scoreUlGrad.addColorStop(0.7, scoreUlColor);
  scoreUlGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.strokeStyle = scoreUlGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 50, ty + 32);
  ctx.lineTo(W / 2 + 50, ty + 32);
  ctx.stroke();
  ctx.restore();

  ty += 35;
  if (isNewRecord) {
    ctx.save();
    // Pulsing glow behind "new record"
    const nrPulse = 0.6 + Math.sin(deathTime * 4) * 0.15;
    ctx.shadowColor = `rgba(194,48,48,${nrPulse})`;
    ctx.shadowBlur = 14;
    drawText('新纪录!', W / 2, ty, 18, '#c23030');
    ctx.restore();
    ty += 24;
  } else {
    drawText(`最高分: ${highScore}`, W / 2, ty, 14, '#666');
    ty += 22;
  }

  // Separator line
  ctx.save();
  ctx.globalAlpha = alpha * 0.2;
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(cardX + 30, ty);
  ctx.lineTo(cardX + cardW - 30, ty);
  ctx.stroke();
  ctx.restore();
  ty += 12;

  drawText(`${getPlayerName()}`, W / 2, ty, 14, '#333');
  ty += 22;

  drawText(`金币获得: +${totalCoinsEarned}`, W / 2, ty, 14, '#997a33');
  ty += 20;
  drawText(`近距离闪避: ${nearMisses}`, W / 2, ty, 14, '#666');
  ty += 20;
  drawText(`角色: ${CHARACTERS[selectedChar].name}`, W / 2, ty, 14, '#666');

  if (isDailyChallenge && dailyRank > 0) {
    ty += 20;
    drawText(`每日排名: #${dailyRank}`, W / 2, ty, 14, '#c23030');
  }

  // Achievements
  const unlockedAch = loadAchievements();
  ty += 25;
  const achCount = ACHIEVEMENT_DEFS.filter(a => unlockedAch.includes(a.id)).length;
  drawText(`印章: ${achCount}/${ACHIEVEMENT_DEFS.length}`, W / 2, ty, 12, '#666');

  // Challenge code
  if (challengeCode) {
    ty += 22;
    drawText(`挑战码: ${challengeCode}`, W / 2, ty, 12, '#997a33');
  }

  ctx.restore();

  // Buttons
  buttons = [];
  const btnW = 140;
  const btnH = 44;
  let btnY = cardY + cardH + 15;

  // Revive button
  if (!reviveUsed && coins >= 10 && deathTime > 0.5) {
    const revBtn: Button = { x: W / 2 - btnW / 2, y: btnY, w: btnW, h: btnH, label: `复活 (10币)`, action: revive };
    buttons.push(revBtn);
    drawButton(revBtn, 'primary');
    btnY += 50;
  }

  // Retry
  const retryBtn: Button = { x: W / 2 - btnW - 10, y: btnY, w: btnW, h: btnH, label: '再来一次', action: () => {
    resetGame();
    setScreen('playing');
    audio.playBGM();
  }};
  buttons.push(retryBtn);
  drawButton(retryBtn, 'primary');

  // Title
  const titleBtn: Button = { x: W / 2 + 10, y: btnY, w: btnW, h: btnH, label: '返回', action: () => { setScreen('title'); }};
  buttons.push(titleBtn);
  drawButton(titleBtn);

  btnY += 50;

  // Share
  const shareBtn: Button = { x: W / 2 - btnW / 2, y: btnY, w: btnW, h: btnH, label: '分享成绩', action: shareResult };
  buttons.push(shareBtn);
  drawButton(shareBtn);

  // Vignette
  if (vignetteGrad) {
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawCharSelect() {
  if (paperCanvas) ctx.drawImage(paperCanvas, 0, 0);
  for (const layer of mountainLayers) {
    drawMountainLayer(layer, titleScroll);
  }

  drawCalliText('选择角色', W / 2, 60, 36);

  buttons = [];

  for (let i = 0; i < CHARACTERS.length; i++) {
    const ch = CHARACTERS[i];
    const cardY = 120 + i * 200;
    const cardX = 30;
    const cardW = W - 60;
    const cardH = 175;
    const unlocked = unlockedChars[i];
    const isSelected = selectedChar === i;

    ctx.save();
    ctx.globalAlpha = unlocked ? 0.9 : 0.4;
    ctx.fillStyle = isSelected ? '#e8dcc8' : '#f5efe3';
    ctx.shadowColor = 'rgba(0,0,0,0.1)';
    ctx.shadowBlur = 8;
    const r = 10;
    ctx.beginPath();
    ctx.moveTo(cardX + r, cardY);
    ctx.lineTo(cardX + cardW - r, cardY);
    ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + r);
    ctx.lineTo(cardX + cardW, cardY + cardH - r);
    ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - r, cardY + cardH);
    ctx.lineTo(cardX + r, cardY + cardH);
    ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - r);
    ctx.lineTo(cardX, cardY + r);
    ctx.quadraticCurveTo(cardX, cardY, cardX + r, cardY);
    ctx.fill();
    ctx.restore();

    if (isSelected) {
      ctx.save();
      ctx.strokeStyle = '#c23030';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cardX + r, cardY);
      ctx.lineTo(cardX + cardW - r, cardY);
      ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + r);
      ctx.lineTo(cardX + cardW, cardY + cardH - r);
      ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - r, cardY + cardH);
      ctx.lineTo(cardX + r, cardY + cardH);
      ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - r);
      ctx.lineTo(cardX, cardY + r);
      ctx.quadraticCurveTo(cardX, cardY, cardX + r, cardY);
      ctx.stroke();
      ctx.restore();
    }

    drawMelo(cardX + 60, cardY + cardH / 2, i, titleTime);

    const textX = cardX + 120;
    drawText(ch.name, textX, cardY + 30, 22, unlocked ? '#1a1a1a' : '#999', 'left', '900');
    drawText(ch.desc, textX, cardY + 58, 13, unlocked ? '#666' : '#aaa', 'left', '400');

    if (!unlocked) {
      drawText(`解锁条件: ${ch.unlockScore}分`, textX, cardY + 82, 12, '#c23030', 'left', '400');
    } else if (ch.extraHP > 0) {
      drawText(`特殊: +${ch.extraHP} 护盾`, textX, cardY + 82, 12, '#3a8a5a', 'left', '400');
    } else if (ch.radiusMult < 1) {
      drawText('特殊: 体型缩小25%', textX, cardY + 82, 12, '#3a8a5a', 'left', '400');
    }

    if (unlocked) {
      const btnLabel = isSelected ? '已选择' : '选择';
      const btn: Button = {
        x: cardX + cardW - 100, y: cardY + cardH - 50, w: 80, h: 36,
        label: btnLabel,
        action: () => {
          selectedChar = i;
          localStorage.setItem(SELECTED_CHAR_KEY, String(i));
        }
      };
      buttons.push(btn);
      drawButton(btn, isSelected ? 'secondary' : 'primary');
    }
  }

  const backBtn: Button = { x: W / 2 - 70, y: H - 80, w: 140, h: 44, label: '返回', action: () => { setScreen('title'); } };
  buttons.push(backBtn);
  drawButton(backBtn, 'primary');

  if (vignetteGrad) {
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawLeaderboard() {
  if (paperCanvas) ctx.drawImage(paperCanvas, 0, 0);
  for (const layer of mountainLayers) {
    drawMountainLayer(layer, titleScroll);
  }

  drawCalliText('排行榜', W / 2, 55, 36);

  buttons = [];

  const tabY = 90;
  const normalLb = leaderboard;
  const dailyLb = dailyLeaderboard;

  const tabNormal: Button = { x: W / 2 - 120, y: tabY, w: 110, h: 36, label: '总排行', action: () => { showDailyLeaderboard = false; } };
  const tabDaily: Button = { x: W / 2 + 10, y: tabY, w: 110, h: 36, label: '每日挑战', action: () => { showDailyLeaderboard = true; } };
  buttons.push(tabNormal);
  buttons.push(tabDaily);
  drawButton(tabNormal, showDailyLeaderboard ? 'secondary' : 'primary');
  drawButton(tabDaily, showDailyLeaderboard ? 'primary' : 'secondary');

  const lb = showDailyLeaderboard ? dailyLb : normalLb;

  const startY = 150;
  if (lb.length === 0) {
    drawText('暂无记录', W / 2, startY + 60, 16, '#999');
  } else {
    for (let i = 0; i < lb.length; i++) {
      const entry = lb[i];
      const y = startY + i * 50;

      ctx.save();
      ctx.globalAlpha = i % 2 === 0 ? 0.05 : 0.1;
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(30, y, W - 60, 45);
      ctx.restore();

      const rankColor = i === 0 ? '#c9a030' : i === 1 ? '#8a8a8a' : i === 2 ? '#a06030' : '#666';
      drawText(`#${i + 1}`, 55, y + 22, 18, rankColor, 'center', '900');
      drawText(String(entry.score), 120, y + 22, 20, '#1a1a1a', 'center', '900');
      drawText(entry.name || CHARACTERS[entry.char]?.name || '?', 210, y + 22, 14, '#666', 'center');
      drawText(entry.date, 320, y + 22, 11, '#999', 'center');
    }
  }

  const backBtn: Button = { x: W / 2 - 70, y: H - 80, w: 140, h: 44, label: '返回', action: () => { setScreen('title'); } };
  buttons.push(backBtn);
  drawButton(backBtn, 'primary');

  if (vignetteGrad) {
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, W, H);
  }
}

// ── Name input screen ──────────────────────────────────────────────────────
function drawNameInput() {
  if (paperCanvas) ctx.drawImage(paperCanvas, 0, 0);
  for (const layer of mountainLayers) {
    drawMountainLayer(layer, titleScroll);
  }

  drawCalliText('取名', W / 2, 80, 36);
  drawText('选择或输入你的名字', W / 2, 120, 14, '#666');

  buttons = [];

  // Preset name buttons
  const presetY = 170;
  for (let i = 0; i < PRESET_NAMES.length; i++) {
    const name = PRESET_NAMES[i];
    const bx = 40 + (i % 3) * 110;
    const by = presetY + Math.floor(i / 3) * 50;
    const isSelected = nameInputValue === name;
    const btn: Button = {
      x: bx, y: by, w: 100, h: 40,
      label: name,
      action: () => {
        if (name === '自定义') {
          // Clear input so user can type a custom name via keyboard
          nameInputValue = '';
        } else {
          nameInputValue = name;
        }
      },
    };
    buttons.push(btn);
    drawButton(btn, isSelected ? 'primary' : 'secondary');
  }

  // Current name display
  const inputY = presetY + Math.ceil(PRESET_NAMES.length / 3) * 50 + 30;
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.globalAlpha = 0.8;
  ctx.fillRect(60, inputY, W - 120, 50);
  ctx.strokeStyle = '#1a1a1a';
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 1;
  ctx.strokeRect(60, inputY, W - 120, 50);
  ctx.restore();
  drawCalliText(nameInputValue || '旅行者', W / 2, inputY + 25, 24);

  // Confirm button
  const confirmBtn: Button = {
    x: W / 2 - 70, y: inputY + 70, w: 140, h: 48,
    label: '确认',
    action: () => {
      const finalName = nameInputValue.trim() || '旅行者';
      setPlayerName(finalName);
      setScreen('title');
    },
  };
  buttons.push(confirmBtn);
  drawButton(confirmBtn, 'primary');

  // Back button
  const backBtn: Button = { x: W / 2 - 70, y: inputY + 130, w: 140, h: 44, label: '返回', action: () => { setScreen('title'); } };
  buttons.push(backBtn);
  drawButton(backBtn);

  if (vignetteGrad) {
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, W, H);
  }
}

// ── Share result (H5 text link) ──────────────────────────────────────────
async function shareResult() {
  const pName = getPlayerName();
  const code = challengeCode || score.toString(36).toUpperCase();
  const gameURL = location.origin + location.pathname;
  const shareText =
    `【扶摇万里】${pName} 飞越 ${score} 里 · ${totalCoinsEarned}金\n` +
    `挑战码: ${code}\n` +
    `来挑战我吧! 👉 ${gameURL}\n` +
    `#麦洛的冒险 #扶摇万里`;

  try {
    if (navigator.share) {
      await navigator.share({ title: '扶摇万里', text: shareText });
      spawnFloatingText(W / 2, H / 2, '分享成功!', '#2a7a2a', 24);
    } else {
      await navigator.clipboard.writeText(shareText);
      spawnFloatingText(W / 2, H / 2, '已复制!', '#2a7a2a', 24);
    }
  } catch {
    // Fallback: try clipboard if share was cancelled/failed
    try {
      await navigator.clipboard.writeText(shareText);
      spawnFloatingText(W / 2, H / 2, '已复制!', '#2a7a2a', 24);
    } catch {
      // Last resort: prompt with text
      window.prompt('复制分享文本:', shareText);
    }
  }
}

// ── Draw ───────────────────────────────────────────────────────────────────
function draw() {
  ctx.save();

  // Screen shake
  if (shakeTimer > 0) {
    const sx = (Math.random() - 0.5) * shakeMag * 2;
    const sy = (Math.random() - 0.5) * shakeMag * 2;
    ctx.translate(sx, sy);
  }

  switch (gameScreen) {
    case 'title': drawTitle(); break;
    case 'playing': drawPlaying(); break;
    case 'dead': drawDead(); break;
    case 'charSelect': drawCharSelect(); break;
    case 'leaderboard': drawLeaderboard(); break;
    case 'nameInput': drawNameInput(); break;
  }

  ctx.restore();
}

// ── Input handling ─────────────────────────────────────────────────────────
function getCanvasPos(clientX: number, clientY: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

// Helper to change screen with cooldown to prevent accidental chained taps
function setScreen(screen: GameScreen) {
  gameScreen = screen;
  screenTransitionCooldown = SCREEN_TRANSITION_COOLDOWN;
  buttons = []; // clear stale buttons immediately
  clearHoldTimers();
  if (screen !== 'playing') gamePaused = false;
}

function handleTap(cx: number, cy: number) {
  // Ensure audio context is initialized on first user gesture (mobile requirement)
  audio.ensureInit();

  // During screen transition cooldown, only allow flaps in playing state
  if (screenTransitionCooldown > 0 && gameScreen !== 'playing') {
    return;
  }

  // Check buttons first (only if not in cooldown for non-playing screens)
  for (const b of buttons) {
    if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) {
      audio.uiTap();
      b.action();
      return;
    }
  }

  if (gameScreen === 'playing') {
    flap();
  }
}

// Long-press = rapid flap (hold to keep tapping)
let holdInterval: ReturnType<typeof setInterval> | null = null;
let isPointerDown = false;

function clearHoldTimers() {
  if (holdDelayTimeout) { clearTimeout(holdDelayTimeout); holdDelayTimeout = null; }
  if (holdInterval) { clearInterval(holdInterval); holdInterval = null; }
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  isPointerDown = true;
  const pos = getCanvasPos(e.clientX, e.clientY);
  handleTap(pos.x, pos.y);
  // Start rapid flap after 200ms hold delay, then every 120ms
  clearHoldTimers();
  if (gameScreen === 'playing') {
    holdDelayTimeout = setTimeout(() => {
      holdInterval = setInterval(() => {
        if (gamePaused) return;
        if (isPointerDown && gameScreen === 'playing') flap();
      }, 120);
    }, 200);
  }
});
canvas.addEventListener('pointerup', () => {
  isPointerDown = false;
  clearHoldTimers();
});
canvas.addEventListener('pointercancel', () => {
  isPointerDown = false;
  clearHoldTimers();
});

document.addEventListener('keydown', (e) => {
  audio.ensureInit();

  if (gameScreen === 'nameInput') {
    if (e.key === 'Backspace') {
      nameInputValue = nameInputValue.slice(0, -1);
      return;
    }
    if (e.key === 'Enter') {
      const finalName = nameInputValue.trim() || '旅行者';
      setPlayerName(finalName);
      setScreen('title');
      return;
    }
    if (e.key.length === 1 && nameInputValue.length < 8) {
      nameInputValue += e.key;
      return;
    }
  }

  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    if (screenTransitionCooldown > 0 && gameScreen !== 'playing') return;
    if (gameScreen === 'playing') {
      flap();
    } else if (gameScreen === 'title') {
      isDailyChallenge = false;
      resetGame();
      setScreen('playing');
      audio.playBGM();
    } else if (gameScreen === 'dead') {
      resetGame();
      setScreen('playing');
      audio.playBGM();
    }
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (gameScreen === 'playing') {
      gamePaused = !gamePaused;
      return;
    }
  }
  if (e.code === 'Escape') {
    if (screenTransitionCooldown > 0) return;
    if (gameScreen === 'charSelect' || gameScreen === 'leaderboard' || gameScreen === 'nameInput') {
      setScreen('title');
    }
  }
});

// ── Init ───────────────────────────────────────────────────────────────────
paperCanvas = generatePaperTexture();
vignetteGrad = generateVignette();
generateMountains();
initCloudDrifts();
initStars();

// Check if player has set a name, if not show name input on first visit
if (!localStorage.getItem(PLAYER_NAME_KEY)) {
  nameInputValue = '';
  gameScreen = 'nameInput';
}

// ── Game loop ──────────────────────────────────────────────────────────────
let lastTime = performance.now();

function gameLoop(time: number) {
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;

  update(dt);
  draw();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
