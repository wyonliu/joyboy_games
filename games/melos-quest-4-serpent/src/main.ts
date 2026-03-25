/* ============================================================
   吞灵化龙 — Melo's Quest: Dragon Ascent
   A Snake/Slither.io game with 山海经 mythology & 水墨 art
   Complete single-file implementation
   ============================================================ */

// ─── Canvas Setup ───────────────────────────────────────────
const canvas = document.getElementById('gc') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const W = 390, H = 844;
const PR = Math.min(window.devicePixelRatio, 2);
canvas.width = W * PR; canvas.height = H * PR;
canvas.style.width = `${W}px`;
canvas.style.height = `${H}px`;
ctx.scale(PR, PR);

function resize() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  canvas.style.width = `${W * s}px`;
  canvas.style.height = `${H * s}px`;
}
resize(); addEventListener('resize', resize);

// ─── Constants ──────────────────────────────────────────────
const ARENA_R = 600;
const SEG_DIST = 8;
const BASE_SPEED = 1.8;
const BOOST_SPEED = 3.2;
const TURN_SPEED = 0.14;
const ORB_R = 5;
const POWERUP_R = 10;
const PARTICLE_CAP = 800;
const AI_COUNT = 5;
const MINIMAP_R = 50;
const MINIMAP_X = W - MINIMAP_R - 12;
const MINIMAP_Y = MINIMAP_R + 12;
const PI2 = Math.PI * 2;

// ─── Types & Enums ──────────────────────────────────────────
type GameScreen = 'title' | 'charSelect' | 'playing' | 'dead' | 'evolution' | 'leaderboard' | 'nameInput' | 'achievements';

interface Vec2 { x: number; y: number; }

interface Orb {
  x: number; y: number; r: number; val: number;
  hue: number; alpha: number; pulse: number;
  vx: number; vy: number;
  isEssence?: boolean; // from dead serpent — glows more
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; r: number;
  color: string; type: 'spark' | 'ink' | 'fire' | 'trail' | 'inkExplosion' | 'deathScatter' | 'speedLine' | 'inkMist' | 'inkRipple' | 'fireParticle';
}

interface PowerUp {
  x: number; y: number; kind: PowerKind;
  timer: number; pulse: number;
}

type PowerKind = 'speed' | 'shield' | 'magnet' | 'split' | 'freeze' | 'fire' | 'ghost';

interface ActivePower {
  kind: PowerKind;
  remaining: number;
}

interface Segment { x: number; y: number; }

interface Hazard {
  x: number; y: number;
  kind: 'whirlpool' | 'spiritGate';
  timer: number;
  angle: number;
  linkedHazard?: Hazard;
}

interface Serpent {
  segs: Segment[];
  angle: number;
  targetAngle: number;
  speed: number;
  alive: boolean;
  name: string;
  color: string;
  hue: number;
  isPlayer: boolean;
  score: number;
  kills: number;
  boosting: boolean;
  boostCooldown: number;
  powers: ActivePower[];
  stageCache: number;
  respawnTimer: number;
  aiTarget: Vec2 | null;
  aiTimer: number;
  aiAggression: number;
  frozen: boolean;
  frozenTimer: number;
  isBoss: boolean;
  burnTrail: Array<{ x: number; y: number; life: number }>;
  evolFlashTimer: number;
  prevAngle: number; // for direction-change ripple detection
  blinkTimer: number; // eye blink
}

interface CharDef {
  name: string; desc: string;
  speedMul: number; sizeMul: number; startLen: number;
  color: string;
}

interface Upgrade {
  name: string; desc: string; cost: number; maxLvl: number;
  key: string;
}

interface FloatingText {
  x: number; y: number; text: string; color: string;
  life: number; maxLife: number; size: number; glow: boolean;
}

interface AchievementDef {
  id: string; name: string; desc: string; check: () => boolean;
}

interface MelosPassport {
  totalCoins: number;
  gamesPlayed: Record<string, number>;
  achievements: string[];
  playerName: string;
}

// ─── Audio Engine (Procedural) ──────────────────────────────
const AudioCtx = window.AudioContext || (window as unknown as Record<string, unknown>).webkitAudioContext as typeof AudioContext;
let audioCtx: AudioContext | null = null;
function ensureAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playTone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', detune = 0) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  gain.gain.setValueAtTime(vol * masterVol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + dur);
}

function playNoise(dur: number, vol: number, freqLow: number, freqHigh: number) {
  if (!audioCtx) return;
  const bufferSize = audioCtx.sampleRate * dur;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  const bandpass = audioCtx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = (freqLow + freqHigh) / 2;
  bandpass.Q.value = 1;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(vol * masterVol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  source.connect(bandpass).connect(gain).connect(audioCtx.destination);
  source.start();
}

function sfxEatOrb(combo: number) {
  // Rising pitch pop with combo
  const freq = 500 + combo * 60;
  playTone(Math.min(freq, 1400), 0.06, 0.15, 'sine');
  // Pop overtone
  playTone(Math.min(freq * 2, 2800), 0.03, 0.06, 'sine');
}

function sfxEvolution(stage: number) {
  // Deep drum hit (stronger)
  playTone(50, 0.6, 0.3, 'sine');
  playTone(70, 0.4, 0.2, 'square');
  playNoise(0.2, 0.15, 80, 300);

  // Second drum
  setTimeout(() => {
    playTone(55, 0.5, 0.25, 'sine');
    playTone(75, 0.35, 0.18, 'square');
    playNoise(0.15, 0.12, 100, 400);
  }, 250);

  // Third drum (biggest)
  setTimeout(() => {
    playTone(45, 0.7, 0.3, 'sine');
    playTone(65, 0.5, 0.2, 'square');
    playNoise(0.25, 0.15, 60, 300);
  }, 500);

  // 5-note ascending pentatonic fanfare (C D E G A)
  setTimeout(() => {
    const notes = [523, 587, 659, 784, 880]; // C5, D5, E5, G5, A5
    notes.forEach((n, i) => {
      setTimeout(() => {
        playTone(n, 0.5, 0.12, 'triangle');
        if (i === notes.length - 1) {
          // Final note: hold + harmony
          playTone(n * 2, 0.8, 0.08, 'sine');
          playTone(n * 1.5, 0.6, 0.06, 'triangle');
        }
      }, i * 120);
    });
  }, 800);

  // Stage-specific embellishment
  if (stage >= 4) {
    setTimeout(() => {
      playTone(1047, 1.0, 0.15, 'triangle');
      playTone(1318, 0.8, 0.1, 'sine');
    }, 1500);
  }
}

function sfxKillSmall() {
  playNoise(0.08, 0.15, 800, 2000);
  playTone(300, 0.08, 0.12, 'square');
}

function sfxKillMedium() {
  playTone(80, 0.2, 0.18, 'sine');
  playNoise(0.12, 0.12, 400, 1200);
  setTimeout(() => playTone(500, 0.1, 0.08, 'triangle'), 50);
}

function sfxKillLarge() {
  playTone(50, 0.4, 0.25, 'sine');
  playTone(40, 0.5, 0.2, 'square');
  playNoise(0.3, 0.18, 200, 800);
  setTimeout(() => playTone(400, 0.15, 0.1, 'triangle'), 80);
  setTimeout(() => playTone(600, 0.12, 0.08, 'triangle'), 160);
  setTimeout(() => playTone(800, 0.15, 0.06, 'triangle'), 240);
}

function sfxBoost() {
  // Bass "whooom"
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(120, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 0.3);
  gain.gain.setValueAtTime(0.12 * masterVol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + 0.3);
}

function sfxDeath() {
  playTone(80, 0.5, 0.2, 'sawtooth');
  playTone(60, 0.6, 0.15, 'square');
  playTone(50, 0.3, 0.25, 'square');
  playTone(40, 0.4, 0.2, 'sawtooth');
}

function sfxKill(killedColor: string) {
  // Bass impact (60Hz, 0.3s)
  playTone(60, 0.3, 0.2, 'sine');
  // Ascending chime
  setTimeout(() => playTone(600, 0.12, 0.1, 'triangle'), 50);
  setTimeout(() => playTone(800, 0.12, 0.08, 'triangle'), 120);
  setTimeout(() => playTone(1000, 0.15, 0.06, 'triangle'), 190);
  // ignore killedColor param — just for the API
  void killedColor;
}

function sfxPowerUp() {
  playTone(800, 0.1, 0.1, 'sine');
  playTone(1000, 0.15, 0.08, 'triangle');
  playTone(1200, 0.12, 0.06, 'sine');
}

function sfxHeartbeat() {
  playTone(50, 0.15, 0.15, 'sine');
  setTimeout(() => playTone(50, 0.1, 0.1, 'sine'), 150);
}

function sfxAchievement() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((n, i) => {
    setTimeout(() => playTone(n, 0.3, 0.08, 'triangle'), i * 80);
  });
}

function sfxBossAppear() {
  // Dramatic horn — low brass-like rumble + rising tension
  playTone(65, 0.8, 0.25, 'sawtooth');
  playTone(98, 0.6, 0.2, 'square');
  playNoise(0.3, 0.12, 60, 200);
  setTimeout(() => {
    playTone(130, 0.5, 0.2, 'sawtooth');
    playTone(196, 0.4, 0.15, 'triangle');
  }, 300);
  setTimeout(() => {
    playTone(196, 0.6, 0.18, 'sawtooth');
    playTone(262, 0.5, 0.12, 'triangle');
    playNoise(0.2, 0.1, 100, 400);
  }, 600);
}

function sfxUITap() {
  playTone(1200, 0.04, 0.08, 'sine');
  playTone(1800, 0.03, 0.05, 'sine');
}

// ─── Layered BGM System ─────────────────────────────────────
let bgmPlaying = false;
let masterVol = 0.5;

// BGM nodes
let bgmDroneOsc: OscillatorNode | null = null;
let bgmDroneGain: GainNode | null = null;
let bgmLFO: OscillatorNode | null = null;
let bgmWindSource: AudioBufferSourceNode | null = null;
let bgmWindGain: GainNode | null = null;
let bgmMelodyTimer = 0;
let bgmKickTimer = 0;
let bgmTensionActive = false;

// Pentatonic scale for Chinese flute feel (C, D, E, G, A across octaves)
const PENTATONIC = [262, 294, 330, 392, 440, 523, 587, 659, 784, 880];

function startBGM() {
  if (!audioCtx || bgmPlaying) return;
  bgmPlaying = true;

  // Base drone: oscillating C2-D2
  bgmDroneOsc = audioCtx.createOscillator();
  bgmDroneGain = audioCtx.createGain();
  bgmDroneOsc.type = 'sine';
  bgmDroneOsc.frequency.value = 65; // C2
  bgmDroneGain.gain.value = 0.035 * masterVol;
  bgmLFO = audioCtx.createOscillator();
  const lfoGain = audioCtx.createGain();
  bgmLFO.frequency.value = 0.15;
  lfoGain.gain.value = 8; // oscillate between ~C2 and D2
  bgmLFO.connect(lfoGain).connect(bgmDroneOsc.frequency);
  bgmLFO.start();
  bgmDroneOsc.connect(bgmDroneGain).connect(audioCtx.destination);
  bgmDroneOsc.start();

  // Ambient wind (filtered noise at very low volume)
  startWindAmbient();
}

function startWindAmbient() {
  if (!audioCtx) return;
  const dur = 10;
  const bufferSize = audioCtx.sampleRate * dur;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  bgmWindSource = audioCtx.createBufferSource();
  bgmWindSource.buffer = buffer;
  bgmWindSource.loop = true;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;
  filter.Q.value = 0.5;
  bgmWindGain = audioCtx.createGain();
  bgmWindGain.gain.value = 0.012 * masterVol;
  bgmWindSource.connect(filter).connect(bgmWindGain).connect(audioCtx.destination);
  bgmWindSource.start();
}

function updateBGM(dt: number, isBoosting: boolean, nearBoss: boolean) {
  if (!audioCtx || !bgmPlaying) return;

  // Random pentatonic melody notes (Chinese flute feel)
  bgmMelodyTimer -= dt;
  if (bgmMelodyTimer <= 0) {
    bgmMelodyTimer = rand(0.8, 2.5);
    const note = PENTATONIC[randInt(0, PENTATONIC.length - 1)];
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = note;
    gain.gain.setValueAtTime(0.04 * masterVol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
  }

  // Rhythmic kick drum when boosting
  if (isBoosting) {
    bgmKickTimer -= dt;
    if (bgmKickTimer <= 0) {
      bgmKickTimer = 0.25;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.08 * masterVol, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    }
  }

  // Tension when near boss
  if (nearBoss && !bgmTensionActive) {
    bgmTensionActive = true;
    // Speed up melody
    bgmMelodyTimer = Math.min(bgmMelodyTimer, 0.3);
  } else if (!nearBoss) {
    bgmTensionActive = false;
  }

  // Tension notes — minor intervals when near boss
  if (nearBoss && Math.random() < dt * 2) {
    const minorNotes = [277, 311, 370, 415, 466]; // C#, Eb, F#, Ab, Bb — tension
    const note = minorNotes[randInt(0, minorNotes.length - 1)];
    playTone(note, 0.2, 0.025, 'triangle');
  }
}

function stopBGM() {
  if (bgmDroneOsc) { try { bgmDroneOsc.stop(); } catch (_) { /* ignore */ } bgmDroneOsc = null; }
  if (bgmLFO) { try { bgmLFO.stop(); } catch (_) { /* ignore */ } bgmLFO = null; }
  if (bgmWindSource) { try { bgmWindSource.stop(); } catch (_) { /* ignore */ } bgmWindSource = null; }
  bgmDroneGain = null;
  bgmWindGain = null;
  bgmPlaying = false;
}

// ─── State ──────────────────────────────────────────────────
let gameScreen: GameScreen = 'title';
let player: Serpent;
let aiSerpents: Serpent[] = [];
let orbs: Orb[] = [];
let powerUps: PowerUp[] = [];
let particles: Particle[] = [];
let hazards: Hazard[] = [];
let floatingTexts: FloatingText[] = [];
let camera: Vec2 = { x: 0, y: 0 };
let gameTime = 0;
let comboCount = 0;
let comboTimer = 0;
let shakeAmount = 0;
let slowMo = 1;
let slowMoTimer = 0;
let evolutionOverlay = 0;
let evolutionName = '';
let evolutionStage = 0;
let nearDeathFlash = 0;
let spiritStormTimer = 0;
let spiritStormActive = false;
let nextBossScore = 200;
let bossSpawned = false;
let dailySeed = 0;
let killCamTimer = 0;
let killCamTarget: Vec2 = { x: 0, y: 0 };
let freezeFrameTimer = 0;
let killFlashColor = '';
let killFlashTimer = 0;
let heartbeatTimer = 0;
let surviveTimer = 0; // for "survive 3 min" achievement
let nameInputText = '';
let nameInputActive = false;

// ─── Feeding Frenzy ─────────────────────────────────────────
let feedStreakCount = 0;
let feedStreakTimer = 0;
let feedFrenzyTimer = 0; // "暴食模式" active time
const FEED_FRENZY_THRESHOLD = 5;
const FEED_FRENZY_WINDOW = 3; // seconds
const FEED_FRENZY_DURATION = 4; // seconds

// ─── Kill Streak ─────────────────────────────────────────────
let killStreakCount = 0;
let killStreakTimer = 0;
const KILL_STREAK_WINDOW = 10; // seconds
let inkWaveTimer = 0;
let inkWaveOrigin: Vec2 = { x: 0, y: 0 };

// ─── Arena Events ────────────────────────────────────────────
let arenaEventTimer = 30;
let arenaEventActive = '';
let arenaEventDuration = 0;
let poisonCloudPos: Vec2 = { x: 0, y: 0 };
let poisonCloudR = 0;
let spiritLineStart: Vec2 = { x: 0, y: 0 };
let spiritLineEnd: Vec2 = { x: 0, y: 0 };

// ─── Boss System (timed) ────────────────────────────────────
let bossSpawnTimer = 60;
let activeBoss: Serpent | null = null;
let bossHealthMax = 0;

// ─── Evolution Invincibility ────────────────────────────────
let evolInvincTimer = 0;

// Persistent state
let highScore = 0;
let coins = 0;
let totalOrbsEaten = 0;
let totalKillsAllRuns = 0;
let selectedChar = 0;
let upgrades: Record<string, number> = { startLen: 0, magnetRange: 0, speed: 0, boostCost: 0, shieldDur: 0, orbValue: 0 };
let leaderboard: Array<{ name: string; score: number; stage: number; kills: number }> = [];
let unlockedAchievements: string[] = [];
let achievementPopup: { name: string; timer: number } | null = null;

// Input
let mouseX = W / 2, mouseY = H / 2;
let mouseDown = false;
let keys: Record<string, boolean> = {};
let joystickActive = false;
let joystickStart: Vec2 = { x: 0, y: 0 };
let joystickCurrent: Vec2 = { x: 0, y: 0 };
let tapBoost = false;
const isMobile = 'ontouchstart' in window;

// ─── Characters ─────────────────────────────────────────────
const CHARACTERS: CharDef[] = [
  { name: '麦洛蛇', desc: '均衡型', speedMul: 1, sizeMul: 1, startLen: 8, color: '#4a8' },
  { name: '灵蛇', desc: '速度型 (更快更细)', speedMul: 1.2, sizeMul: 0.8, startLen: 6, color: '#6af' },
  { name: '土蛇', desc: '力量型 (更慢更粗)', speedMul: 0.85, sizeMul: 1.3, startLen: 10, color: '#a74' },
];

// ─── Upgrades Defs ──────────────────────────────────────────
const UPGRADE_DEFS: Upgrade[] = [
  { name: '初始长度+3', desc: '起始更长', cost: 5, maxLvl: 5, key: 'startLen' },
  { name: '磁力范围+', desc: '吸收更远', cost: 8, maxLvl: 3, key: 'magnetRange' },
  { name: '速度+', desc: '基础速度提升', cost: 10, maxLvl: 3, key: 'speed' },
  { name: '冲刺消耗-', desc: '加速消耗更少', cost: 12, maxLvl: 3, key: 'boostCost' },
  { name: '护盾时间+', desc: '初始护盾更久', cost: 10, maxLvl: 3, key: 'shieldDur' },
  { name: '灵珠价值+', desc: '每颗灵珠更多分', cost: 15, maxLvl: 3, key: 'orbValue' },
];

// AI Serpent defs
const AI_DEFS = [
  { name: '巴蛇', hue: 0, color: '#944' },
  { name: '相柳', hue: 150, color: '#3a6' },
  { name: '肥遗', hue: 75, color: '#8a5' },
  { name: '腾蛇', hue: 270, color: '#749' },
  { name: '修蛇', hue: 200, color: '#468' },
];

const POWER_KINDS: PowerKind[] = ['speed', 'shield', 'magnet', 'split', 'freeze', 'fire', 'ghost'];
const POWER_LABELS: Record<PowerKind, string> = {
  speed: '速', shield: '盾', magnet: '磁', split: '分',
  freeze: '冰', fire: '火', ghost: '幽'
};
const POWER_COLORS: Record<PowerKind, string> = {
  speed: '#ff0', shield: '#0ff', magnet: '#f0f', split: '#f80',
  freeze: '#8ef', fire: '#f44', ghost: '#aaf'
};
const POWER_DURATIONS: Record<PowerKind, number> = {
  speed: 3, shield: 5, magnet: 5, split: 0, freeze: 3, fire: 4, ghost: 5
};

// ─── Achievement Definitions ────────────────────────────────
const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { id: 'lingse', name: '灵蛇', desc: '达到第二阶 (蛟)', check: () => player && player.stageCache >= 2 },
  { id: 'jiaolong', name: '蛟龙', desc: '达到第三阶 (螭)', check: () => player && player.stageCache >= 3 },
  { id: 'zhenlong', name: '真龙', desc: '达到第四阶 (龙)', check: () => player && player.stageCache >= 4 },
  { id: 'baisha', name: '百杀', desc: '累计击杀100条蛇', check: () => totalKillsAllRuns >= 100 },
  { id: 'busi', name: '不死', desc: '存活3分钟不死', check: () => surviveTimer >= 180 },
];

// ─── Melo's Passport ───────────────────────────────────────
function getPassport(): MelosPassport {
  try {
    const raw = localStorage.getItem('melos_passport');
    if (raw) return JSON.parse(raw);
  } catch (_) { /* ignore */ }
  return {
    totalCoins: 0,
    gamesPlayed: { '扶摇万里': 0, '百妖长夜': 0, '石破天惊': 0, '吞灵化龙': 0, '问天牌局': 0 },
    achievements: [],
    playerName: '旅行者'
  };
}

function updatePassport(addCoins: number) {
  const passport = getPassport();
  passport.totalCoins += addCoins;
  passport.gamesPlayed['吞灵化龙'] = (passport.gamesPlayed['吞灵化龙'] || 0) + 1;
  // Sync achievements
  for (const a of unlockedAchievements) {
    if (!passport.achievements.includes(a)) passport.achievements.push(a);
  }
  if (nameInputText) passport.playerName = nameInputText;
  try { localStorage.setItem('melos_passport', JSON.stringify(passport)); } catch (_) { /* ignore */ }
}

function getCrossGameBonus(): number {
  const passport = getPassport();
  let otherGamesPlayed = 0;
  for (const [key, val] of Object.entries(passport.gamesPlayed)) {
    if (key !== '吞灵化龙' && val > 0) otherGamesPlayed++;
  }
  return otherGamesPlayed > 0 ? 2 : 0; // +2 extra segments
}

// ─── Persistence ────────────────────────────────────────────
function saveData() {
  const data = { highScore, coins, selectedChar, upgrades, leaderboard, totalKillsAllRuns, unlockedAchievements, playerName: nameInputText };
  try { localStorage.setItem('melos_dragon_ascent', JSON.stringify(data)); } catch (_) { /* ignore */ }
  // Also migrate from old key
}

function loadData() {
  try {
    // Try new key first, then old key
    let raw = localStorage.getItem('melos_dragon_ascent');
    if (!raw) {
      raw = localStorage.getItem('melos_serpent');
      if (raw) {
        // Migrate
        localStorage.setItem('melos_dragon_ascent', raw);
        localStorage.removeItem('melos_serpent');
      }
    }
    if (raw) {
      const d = JSON.parse(raw);
      highScore = d.highScore || 0;
      coins = d.coins || 0;
      selectedChar = d.selectedChar || 0;
      upgrades = { ...upgrades, ...(d.upgrades || {}) };
      leaderboard = d.leaderboard || [];
      totalKillsAllRuns = d.totalKillsAllRuns || 0;
      unlockedAchievements = d.unlockedAchievements || [];
      nameInputText = d.playerName || '';
    }
  } catch (_) { /* ignore */ }
}

// ─── Helpers ────────────────────────────────────────────────
function rand(min: number, max: number) { return min + Math.random() * (max - min); }
function randInt(min: number, max: number) { return Math.floor(rand(min, max + 1)); }
function dist(a: Vec2, b: Vec2) { return Math.hypot(a.x - b.x, a.y - b.y); }
function angleTo(a: Vec2, b: Vec2) { return Math.atan2(b.y - a.y, b.x - a.x); }
function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= PI2;
  while (d < -Math.PI) d += PI2;
  return a + d * t;
}
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function inArena(_x: number, _y: number, margin = 0) {
  return _x * _x + _y * _y < (ARENA_R - margin) * (ARENA_R - margin);
}
function randInArena(margin = 30): Vec2 {
  const a = Math.random() * PI2;
  const r = Math.sqrt(Math.random()) * (ARENA_R - margin);
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

function getStage(len: number): number {
  if (len >= 100) return 4;
  if (len >= 50) return 3;
  if (len >= 20) return 2;
  return 1;
}

function getStageInfo(stage: number): { name: string; color: string; hue: number } {
  switch (stage) {
    case 1: return { name: '小蛇', color: '#5a5', hue: 120 };
    case 2: return { name: '蛟', color: '#58c', hue: 210 };
    case 3: return { name: '螭', color: '#a5c', hue: 280 };
    case 4: return { name: '龙', color: '#ca5', hue: 45 };
    default: return { name: '小蛇', color: '#5a5', hue: 120 };
  }
}

function addFloatingText(x: number, y: number, text: string, color: string, size = 24, glow = false) {
  floatingTexts.push({ x, y, text, color, life: 2, maxLife: 2, size, glow });
}

// ─── Serpent Factory ────────────────────────────────────────
function createSerpent(
  x: number, y: number, name: string, color: string, hue: number,
  isPlayer: boolean, startLen: number, isBoss = false
): Serpent {
  const segs: Segment[] = [];
  for (let i = 0; i < startLen; i++) {
    segs.push({ x: x - i * SEG_DIST, y });
  }
  return {
    segs, angle: 0, targetAngle: 0, speed: BASE_SPEED,
    alive: true, name, color, hue, isPlayer,
    score: 0, kills: 0, boosting: false, boostCooldown: 0,
    powers: [], stageCache: 1, respawnTimer: 0,
    aiTarget: null, aiTimer: 0, aiAggression: 0.3,
    frozen: false, frozenTimer: 0, isBoss,
    burnTrail: [],
    evolFlashTimer: 0,
    prevAngle: 0,
    blinkTimer: rand(2, 5),
  };
}

// ─── Game Init ──────────────────────────────────────────────
function initGame() {
  gameTime = 0;
  comboCount = 0;
  comboTimer = 0;
  shakeAmount = 0;
  slowMo = 1;
  slowMoTimer = 0;
  evolutionOverlay = 0;
  nearDeathFlash = 0;
  spiritStormTimer = rand(30, 60);
  spiritStormActive = false;
  nextBossScore = 200;
  bossSpawned = false;
  totalOrbsEaten = 0;
  particles = [];
  hazards = [];
  floatingTexts = [];
  killCamTimer = 0;
  freezeFrameTimer = 0;
  killFlashTimer = 0;
  heartbeatTimer = 0;
  surviveTimer = 0;
  feedStreakCount = 0;
  feedStreakTimer = 0;
  feedFrenzyTimer = 0;
  killStreakCount = 0;
  killStreakTimer = 0;
  inkWaveTimer = 0;
  arenaEventTimer = 30;
  arenaEventActive = '';
  arenaEventDuration = 0;
  bossSpawnTimer = 60;
  activeBoss = null;
  bossHealthMax = 0;
  evolInvincTimer = 0;

  const charDef = CHARACTERS[selectedChar];
  const extraLen = upgrades.startLen * 3;
  const crossGameBonus = getCrossGameBonus();
  const startLen = charDef.startLen + extraLen + crossGameBonus;
  const displayName = nameInputText || charDef.name;
  player = createSerpent(0, 0, displayName, charDef.color, 120, true, startLen);

  // Apply shield duration upgrade as initial shield
  const shieldDurUpgrade = upgrades.shieldDur || 0;
  if (shieldDurUpgrade > 0) {
    player.powers.push({ kind: 'shield', remaining: 2 + shieldDurUpgrade * 1.5 });
  }

  aiSerpents = [];
  for (let i = 0; i < AI_COUNT; i++) {
    spawnAI(i);
  }

  orbs = [];
  for (let i = 0; i < 80; i++) spawnOrb();

  powerUps = [];
  for (let i = 0; i < 3; i++) spawnPowerUp();

  // Spawn initial ink mist particles
  for (let i = 0; i < 30; i++) {
    const pos = randInArena(20);
    particles.push({
      x: pos.x, y: pos.y,
      vx: rand(-0.05, 0.05), vy: rand(-0.05, 0.05),
      life: rand(5, 15), maxLife: 15,
      r: rand(10, 30),
      color: 'rgba(100,90,70,0.03)',
      type: 'inkMist',
    });
  }
}

function spawnAI(idx: number, isBoss = false) {
  const def = AI_DEFS[idx % AI_DEFS.length];
  const pos = randInArena(80);
  const startLen = isBoss ? 80 : randInt(6, 12);
  const s = createSerpent(pos.x, pos.y, def.name, def.color, def.hue, false, startLen, isBoss);
  s.angle = Math.random() * PI2;
  s.aiAggression = 0.3 + gameTime * 0.001;
  if (isBoss) {
    s.name = '远古' + def.name;
    s.aiAggression = 0.9;
  }
  if (idx < aiSerpents.length) {
    aiSerpents[idx] = s;
  } else {
    aiSerpents.push(s);
  }
}

function spawnOrb(x?: number, y?: number, val?: number, isEssence = false) {
  const pos = (x !== undefined && y !== undefined) ? { x, y } : randInArena(20);
  const orbValueUpgrade = upgrades.orbValue || 0;
  const baseVal = val || 1;
  orbs.push({
    x: pos.x, y: pos.y, r: ORB_R, val: baseVal + orbValueUpgrade,
    hue: isEssence ? rand(30, 60) : rand(100, 200), alpha: 1, pulse: Math.random() * PI2,
    vx: 0, vy: 0,
    isEssence,
  });
}

function spawnPowerUp() {
  const pos = randInArena(40);
  const kind = POWER_KINDS[randInt(0, POWER_KINDS.length - 1)];
  powerUps.push({ x: pos.x, y: pos.y, kind, timer: 30, pulse: 0 });
}

function spawnHazard() {
  const kind = Math.random() < 0.5 ? 'whirlpool' : 'spiritGate';
  const pos = randInArena(100);
  const h: Hazard = { x: pos.x, y: pos.y, kind, timer: 20, angle: 0 };
  if (kind === 'spiritGate') {
    const linked: Hazard = {
      x: -pos.x + rand(-50, 50),
      y: -pos.y + rand(-50, 50),
      kind: 'spiritGate',
      timer: 20,
      angle: 0,
    };
    h.linkedHazard = linked;
    linked.linkedHazard = h;
    hazards.push(h, linked);
  } else {
    hazards.push(h);
  }
}

// ─── Particles ──────────────────────────────────────────────
function addParticle(
  x: number, y: number, color: string, type: Particle['type'] = 'spark',
  count = 1, spread = 2, life = 0.5
) {
  for (let i = 0; i < count && particles.length < PARTICLE_CAP; i++) {
    particles.push({
      x, y,
      vx: rand(-spread, spread),
      vy: rand(-spread, spread),
      life, maxLife: life,
      r: rand(1, 3),
      color, type,
    });
  }
}

function addInkExplosion(x: number, y: number, color: string, count: number) {
  for (let i = 0; i < count && particles.length < PARTICLE_CAP; i++) {
    const angle = (i / count) * PI2 + rand(-0.3, 0.3);
    const speed = rand(2, 8);
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: rand(0.8, 1.5), maxLife: 1.5,
      r: rand(3, 8),
      color, type: 'inkExplosion',
    });
  }
}

function addInkRipple(x: number, y: number) {
  for (let i = 0; i < 6 && particles.length < PARTICLE_CAP; i++) {
    const angle = (i / 6) * PI2;
    particles.push({
      x, y,
      vx: Math.cos(angle) * 1.5,
      vy: Math.sin(angle) * 1.5,
      life: 0.4, maxLife: 0.4,
      r: rand(2, 4),
      color: 'rgba(120,110,90,0.3)',
      type: 'inkRipple',
    });
  }
}

// ─── Input Handling ─────────────────────────────────────────
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  mouseX = (e.clientX - rect.left) / rect.width * W;
  mouseY = (e.clientY - rect.top) / rect.height * H;
});
canvas.addEventListener('mousedown', e => {
  e.preventDefault();
  ensureAudio();
  mouseDown = true;
  handleClick(
    (e.clientX - canvas.getBoundingClientRect().left) / canvas.getBoundingClientRect().width * W,
    (e.clientY - canvas.getBoundingClientRect().top) / canvas.getBoundingClientRect().height * H
  );
});
canvas.addEventListener('mouseup', () => { mouseDown = false; });

addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

// Track touch identifiers for joystick vs boost
let joystickTouchId: number | null = null;
let boostTouchId: number | null = null;

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  ensureAudio();
  const rect = canvas.getBoundingClientRect();
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    const tx = (t.clientX - rect.left) / rect.width * W;
    const ty = (t.clientY - rect.top) / rect.height * H;

    if (gameScreen !== 'playing') {
      handleClick(tx, ty);
      return;
    }

    // First touch becomes joystick (appears at touch location), second becomes boost
    if (joystickTouchId === null) {
      joystickTouchId = t.identifier;
      joystickActive = true;
      joystickStart = { x: tx, y: ty };
      joystickCurrent = { x: tx, y: ty };
    } else if (boostTouchId === null) {
      boostTouchId = t.identifier;
      tapBoost = true;
    }
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    if (t.identifier === joystickTouchId) {
      const tx = (t.clientX - rect.left) / rect.width * W;
      const ty = (t.clientY - rect.top) / rect.height * H;
      joystickCurrent = { x: tx, y: ty };
    }
  }
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    if (t.identifier === joystickTouchId) {
      joystickTouchId = null;
      joystickActive = false;
    }
    if (t.identifier === boostTouchId) {
      boostTouchId = null;
      tapBoost = false;
    }
  }
}, { passive: false });

// ─── Click Handling (menus) ─────────────────────────────────
function handleClick(cx: number, cy: number) {
  sfxUITap();
  if (gameScreen === 'nameInput') {
    // Preset name grid: 2 columns x 4 rows starting at y=350
    const PRESET_NAMES = ['麦洛', '山海客', '逐风者', '墨侠', '灵蛇使', '龙行者', '御风人', '自定义...'];
    const gridStartY = 350;
    const gridCols = 2;
    const cellW = 150;
    const cellH = 55;
    const gridStartX = W / 2 - cellW;

    for (let i = 0; i < PRESET_NAMES.length; i++) {
      const col = i % gridCols;
      const row = Math.floor(i / gridCols);
      const bx = gridStartX + col * cellW;
      const by = gridStartY + row * cellH;
      if (cx >= bx && cx <= bx + cellW - 10 && cy >= by && cy <= by + cellH - 10) {
        if (PRESET_NAMES[i] === '自定义...') {
          const custom = window.prompt('取个名字吧', '');
          if (custom && custom.trim()) {
            nameInputText = custom.trim().slice(0, 12);
          } else {
            return; // cancelled
          }
        } else {
          nameInputText = PRESET_NAMES[i];
        }
        const passport = getPassport();
        passport.playerName = nameInputText;
        try { localStorage.setItem('melos_passport', JSON.stringify(passport)); } catch (_) { /* ignore */ }
        saveData();
        gameScreen = 'title';
        nameInputActive = false;
        return;
      }
    }
    return;
  }

  if (gameScreen === 'title') {
    // Rename tap area (near player name line y=425, roughly y 412-435)
    if (cy > 412 && cy < 438) { changePlayerName(); return; }
    // Play button region
    if (cy > 440 && cy < 510) { gameScreen = 'charSelect'; return; }
    // Leaderboard
    if (cy > 520 && cy < 570) { gameScreen = 'leaderboard'; return; }
    // Achievements
    if (cy > 570 && cy < 610) { gameScreen = 'achievements'; return; }
    // Upgrades area
    if (cy > 630 && cy < 880) {
      const idx = Math.floor((cy - 640) / 46);
      if (idx >= 0 && idx < UPGRADE_DEFS.length) {
        const u = UPGRADE_DEFS[idx];
        const lvl = upgrades[u.key] || 0;
        if (lvl < u.maxLvl && coins >= u.cost) {
          coins -= u.cost;
          upgrades[u.key] = lvl + 1;
          sfxPowerUp();
          saveData();
        }
      }
      return;
    }
    return;
  }

  if (gameScreen === 'charSelect') {
    const baseY = 250;
    for (let i = 0; i < CHARACTERS.length; i++) {
      const y = baseY + i * 140;
      if (cy > y && cy < y + 120) {
        selectedChar = i;
        saveData();
        initGame();
        gameScreen = 'playing';
        startBGM();
        return;
      }
    }
    // Back button
    if (cy > 750) { gameScreen = 'title'; return; }
    return;
  }

  if (gameScreen === 'dead') {
    if (cy > 550 && cy < 610) { initGame(); gameScreen = 'playing'; startBGM(); return; }
    if (cy > 620 && cy < 670) { gameScreen = 'title'; stopBGM(); return; }
    if (cy > 680 && cy < 730) { shareResult(); return; }
    return;
  }

  if (gameScreen === 'leaderboard') {
    if (cy > 750) { gameScreen = 'title'; return; }
    return;
  }

  if (gameScreen === 'achievements') {
    if (cy > 750) { gameScreen = 'title'; return; }
    return;
  }
}

function shareResult() {
  const info = getStageInfo(player.stageCache);
  const pName = nameInputText || '旅行者';
  const challengeCode = (player.score * 37 + player.segs.length).toString(36).toUpperCase();
  const gameURL = location.origin + location.pathname;
  const text = `【吞灵化龙】${pName} 化身${info.name} · 长度${player.segs.length} · 击杀${player.kills}\n挑战码: ${challengeCode}\n来挑战我吧! 👉 ${gameURL}\n#麦洛的冒险 #吞灵化龙`;
  try {
    if (navigator.share) {
      navigator.share({ title: '麦洛的冒险：吞灵化龙', text }).catch(() => { /* ignore */ });
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        addFloatingText(W / 2, 500, '已复制到剪贴板', '#0f0', 20);
      }).catch(() => { /* ignore */ });
    }
  } catch (_) { /* ignore */ }
}

function changePlayerName() {
  const name = window.prompt('给自己取个名字吧（其他玩家可见）', nameInputText || '');
  if (name && name.trim()) {
    nameInputText = name.trim().slice(0, 12);
    const passport = getPassport();
    passport.playerName = nameInputText;
    try { localStorage.setItem('melos_passport', JSON.stringify(passport)); } catch (_) { /* ignore */ }
    saveData();
  }
}

// ─── Achievement Check ──────────────────────────────────────
function checkAchievements() {
  for (const def of ACHIEVEMENT_DEFS) {
    if (unlockedAchievements.includes(def.id)) continue;
    if (def.check()) {
      unlockedAchievements.push(def.id);
      achievementPopup = { name: def.name, timer: 3 };
      sfxAchievement();
      saveData();
    }
  }
}

// ─── Update Logic ───────────────────────────────────────────
function update(dt: number) {
  if (gameScreen === 'title' || gameScreen === 'charSelect' || gameScreen === 'leaderboard' || gameScreen === 'nameInput' || gameScreen === 'achievements') return;

  if (gameScreen === 'evolution') {
    evolutionOverlay -= dt;
    if (evolutionOverlay <= 0) {
      gameScreen = 'playing';
      slowMo = 1;
    }
    // Don't return - let the game keep updating underneath the overlay
  }

  if (gameScreen === 'dead') return;

  // Freeze frame (kill impact) - skip physics but still update visuals
  const isFrozen = freezeFrameTimer > 0;
  if (isFrozen) {
    freezeFrameTimer -= dt;
  }

  // Kill flash
  if (killFlashTimer > 0) {
    killFlashTimer -= dt;
  }

  // Kill-cam timer
  if (killCamTimer > 0) {
    killCamTimer -= dt;
  }

  // Ink wave effect
  if (inkWaveTimer > 0) {
    inkWaveTimer -= dt;
  }

  // Slow-mo
  if (slowMoTimer > 0) {
    slowMoTimer -= dt;
    // slowMo is set where triggered (different values for kill vs evolution)
    if (slowMoTimer <= 0) slowMo = 1;
  }
  const eDt = dt * slowMo;
  gameTime += eDt;

  // Kill streak timer
  if (killStreakTimer > 0) {
    killStreakTimer -= eDt;
    if (killStreakTimer <= 0) killStreakCount = 0;
  }

  // Feed frenzy timer
  if (feedStreakTimer > 0) {
    feedStreakTimer -= eDt;
    if (feedStreakTimer <= 0) feedStreakCount = 0;
  }
  if (feedFrenzyTimer > 0) {
    feedFrenzyTimer -= eDt;
  }

  // Evolution invincibility
  if (evolInvincTimer > 0) {
    evolInvincTimer -= eDt;
  }

  // Survive timer for achievement
  if (player.alive) {
    surviveTimer += eDt;
  }

  // Update BGM layers
  let nearBoss = false;
  for (const ai of aiSerpents) {
    if (ai.alive && ai.isBoss && player.alive) {
      if (dist(player.segs[0], ai.segs[0]) < 200) nearBoss = true;
    }
    // Also check large snakes
    if (ai.alive && ai.segs.length > 40 && player.alive) {
      if (dist(player.segs[0], ai.segs[0]) < 150) nearBoss = true;
    }
  }
  updateBGM(eDt, player.alive && player.boosting, nearBoss);

  // Spirit storm
  spiritStormTimer -= eDt;
  if (spiritStormTimer <= 0 && !spiritStormActive) {
    spiritStormActive = true;
    spiritStormTimer = 10;
    for (let i = 0; i < 50; i++) spawnOrb();
  }
  if (spiritStormActive) {
    spiritStormTimer -= eDt;
    if (spiritStormTimer <= 0) {
      spiritStormActive = false;
      spiritStormTimer = rand(30, 60);
    }
  }

  // Spawn orbs continuously
  if (orbs.length < 60 + gameTime * 0.5) {
    spawnOrb();
  }

  // Spawn powerups
  if (powerUps.length < 3 + Math.floor(gameTime / 30)) {
    if (Math.random() < 0.005) spawnPowerUp();
  }

  // Spawn hazards after 60 seconds
  if (gameTime > 60 && hazards.length < 4) {
    if (Math.random() < 0.002) spawnHazard();
  }

  // Spawn ink mist
  if (particles.filter(p => p.type === 'inkMist').length < 20) {
    const pos = randInArena(20);
    particles.push({
      x: pos.x, y: pos.y,
      vx: rand(-0.03, 0.03), vy: rand(-0.03, 0.03),
      life: rand(8, 15), maxLife: 15,
      r: rand(15, 35),
      color: 'rgba(100,90,70,0.03)',
      type: 'inkMist',
    });
  }

  // Update hazards
  for (let i = hazards.length - 1; i >= 0; i--) {
    const h = hazards[i];
    h.timer -= eDt;
    h.angle += eDt * 2;
    if (h.timer <= 0) {
      if (h.linkedHazard) {
        const li = hazards.indexOf(h.linkedHazard);
        if (li >= 0) hazards.splice(li, 1);
      }
      hazards.splice(hazards.indexOf(h), 1);
      continue;
    }

    const allSerps = [player, ...aiSerpents];
    for (const s of allSerps) {
      if (!s.alive) continue;
      const head = s.segs[0];
      const d = dist(head, h);

      if (h.kind === 'whirlpool') {
        if (d < 80) {
          const pull = (80 - d) / 80 * 0.5;
          const a = angleTo(head, h);
          head.x += Math.cos(a) * pull * eDt * 60;
          head.y += Math.sin(a) * pull * eDt * 60;
          if (Math.random() < 0.1) {
            addParticle(h.x + rand(-30, 30), h.y + rand(-30, 30), 'rgba(100,80,200,0.5)', 'ink', 1, 1, 0.3);
          }
        }
      } else if (h.kind === 'spiritGate' && h.linkedHazard) {
        if (d < 15) {
          const linked = h.linkedHazard;
          const dx = head.x - h.x;
          const dy = head.y - h.y;
          for (const seg of s.segs) {
            seg.x += (linked.x - h.x) + dx;
            seg.y += (linked.y - h.y) + dy;
          }
          addParticle(linked.x, linked.y, '#a8f', 'spark', 8, 3, 0.5);
        }
      }
    }
  }

  // === PHYSICS SECTION (skipped during freeze frames) ===
  if (!isFrozen) {

  // Arena events
  arenaEventTimer -= eDt;
  if (arenaEventTimer <= 0 && !arenaEventActive) {
    const events = ['灵潮涌动', '百蛇入侵', '灵脉爆发', '毒雾蔓延'];
    arenaEventActive = events[randInt(0, events.length - 1)];
    arenaEventDuration = arenaEventActive === '灵潮涌动' ? 5 : arenaEventActive === '百蛇入侵' ? 0.1 : arenaEventActive === '灵脉爆发' ? 3 : 5;
    addFloatingText(player.alive ? player.segs[0].x : 0, player.alive ? player.segs[0].y - 60 : 0, arenaEventActive, '#ffd700', 32, true);

    if (arenaEventActive === '灵潮涌动') {
      for (let i = 0; i < 50; i++) spawnOrb();
    } else if (arenaEventActive === '百蛇入侵') {
      for (let i = 0; i < 5; i++) {
        const idx = aiSerpents.length;
        spawnAI(idx);
      }
      arenaEventDuration = 0; // instant
    } else if (arenaEventActive === '灵脉爆发') {
      const a = Math.random() * PI2;
      const r = rand(100, ARENA_R - 100);
      spiritLineStart = { x: Math.cos(a) * r, y: Math.sin(a) * r };
      spiritLineEnd = { x: -Math.cos(a) * r, y: -Math.sin(a) * r };
    } else if (arenaEventActive === '毒雾蔓延') {
      poisonCloudPos = randInArena(150);
      poisonCloudR = 20;
    }
  }
  if (arenaEventActive) {
    arenaEventDuration -= eDt;

    if (arenaEventActive === '毒雾蔓延') {
      poisonCloudR = Math.min(poisonCloudR + 30 * eDt, 120);
      // Drain segments from snakes inside
      const allSerps = [player, ...aiSerpents];
      for (const s of allSerps) {
        if (!s.alive) continue;
        if (dist(s.segs[0], poisonCloudPos) < poisonCloudR) {
          if (Math.random() < eDt) { // ~1 segment per second
            if (s.segs.length > 3) {
              const tail = s.segs[s.segs.length - 1];
              s.segs.pop();
              addParticle(tail.x, tail.y, '#a040a0', 'ink', 2, 1, 0.4);
            }
          }
        }
      }
    }

    if (arenaEventActive === '灵脉爆发') {
      // Check if player crosses the line
      if (player.alive) {
        const head = player.segs[0];
        const lineLen = dist(spiritLineStart, spiritLineEnd);
        const dToLine = Math.abs((spiritLineEnd.y - spiritLineStart.y) * head.x - (spiritLineEnd.x - spiritLineStart.x) * head.y + spiritLineEnd.x * spiritLineStart.y - spiritLineEnd.y * spiritLineStart.x) / lineLen;
        if (dToLine < 15) {
          // Check within segment bounds
          const dx = spiritLineEnd.x - spiritLineStart.x;
          const dy = spiritLineEnd.y - spiritLineStart.y;
          const t = ((head.x - spiritLineStart.x) * dx + (head.y - spiritLineStart.y) * dy) / (dx * dx + dy * dy);
          if (t > 0 && t < 1) {
            // Give +5 length
            for (let i = 0; i < 5; i++) {
              const last = player.segs[player.segs.length - 1];
              player.segs.push({ x: last.x, y: last.y });
            }
            player.score += 5;
            addFloatingText(head.x, head.y - 20, '+5 灵脉!', '#ffd700', 24, true);
            addParticle(head.x, head.y, '#ffd700', 'spark', 10, 4, 0.5);
            arenaEventDuration = 0; // consumed
          }
        }
      }
    }

    if (arenaEventDuration <= 0) {
      arenaEventActive = '';
      arenaEventTimer = 30;
    }
  }

  // Timed boss spawn (every 60s)
  bossSpawnTimer -= eDt;
  if (bossSpawnTimer <= 0 && !activeBoss) {
    bossSpawnTimer = 60;
    const bossIdx = aiSerpents.length;
    const def = AI_DEFS[bossIdx % AI_DEFS.length];
    const pos = randInArena(80);
    const boss = createSerpent(pos.x, pos.y, '远古' + def.name, '#ffd700', def.hue, false, 80, true);
    boss.aiAggression = 0.9;
    boss.angle = Math.random() * PI2;
    aiSerpents.push(boss);
    activeBoss = boss;
    bossHealthMax = boss.segs.length;
    addFloatingText(pos.x, pos.y - 30, '远古妖蛇现世!', '#ff4444', 30, true);
    sfxBossAppear();
  }
  // Track active boss
  if (activeBoss && !activeBoss.alive) {
    activeBoss = null;
  }

  // Update player input
  updatePlayerInput(eDt);

  // Update player serpent
  if (player.alive) {
    updateSerpent(player, eDt);
    checkOrbCollection(player);
    checkPowerUpCollection(player);
    if (evolInvincTimer <= 0) {
      checkSelfCollision(player);
      checkBoundaryCollision(player);
      checkSerpentVsSerpentCollision(player);
    }
  }

  // Update AI
  for (const ai of aiSerpents) {
    if (!ai.alive) {
      ai.respawnTimer -= eDt;
      if (ai.respawnTimer <= 0) {
        const idx = aiSerpents.indexOf(ai);
        spawnAI(idx, ai.isBoss);
      }
      continue;
    }
    if (ai.frozen) {
      ai.frozenTimer -= eDt;
      if (ai.frozenTimer <= 0) ai.frozen = false;
      continue;
    }
    updateAI(ai, eDt);
    updateSerpent(ai, eDt);
    checkOrbCollection(ai);
    checkBoundaryCollision(ai);
    checkSerpentVsSerpentCollision(ai);
  }

  // Score-based boss spawn (keep for backwards compat)
  if (player.score >= nextBossScore && !bossSpawned) {
    bossSpawned = true;
    const bossIdx = aiSerpents.length;
    const def = AI_DEFS[bossIdx % AI_DEFS.length];
    const pos = randInArena(80);
    const boss = createSerpent(pos.x, pos.y, '远古' + def.name, def.color, def.hue, false, 80, true);
    boss.aiAggression = 0.9;
    boss.angle = Math.random() * PI2;
    aiSerpents.push(boss);
    if (!activeBoss) { activeBoss = boss; bossHealthMax = boss.segs.length; }
    nextBossScore = nextBossScore < 500 ? 500 : 1000;
    if (nextBossScore > 1000) nextBossScore = nextBossScore + 500;
    bossSpawned = false;
  }

  } // end freeze frame skip

  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.type === 'inkMist') {
      // Very slow drift
      p.x += p.vx * eDt * 60;
      p.y += p.vy * eDt * 60;
      // Keep in arena
      const pd = Math.hypot(p.x, p.y);
      if (pd > ARENA_R - 50) {
        p.vx = -p.x / pd * 0.02;
        p.vy = -p.y / pd * 0.02;
      }
    } else {
      p.x += p.vx * eDt * 60;
      p.y += p.vy * eDt * 60;
    }
    if (p.type === 'deathScatter') {
      p.vy += 0.05 * eDt * 60;
      p.vx *= 0.98;
    }
    if (p.type === 'inkRipple') {
      p.r += eDt * 15; // expand
    }
    p.life -= eDt;
    if (p.life <= 0) { particles.splice(i, 1); }
  }

  // Update floating texts
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.life -= eDt;
    ft.y -= 30 * eDt;
    if (ft.life <= 0) floatingTexts.splice(i, 1);
  }

  // Power-up timers
  for (let i = powerUps.length - 1; i >= 0; i--) {
    powerUps[i].timer -= eDt;
    powerUps[i].pulse += eDt * 3;
    if (powerUps[i].timer <= 0) powerUps.splice(i, 1);
  }

  // Orb physics
  for (const o of orbs) {
    o.x += o.vx * eDt * 60;
    o.y += o.vy * eDt * 60;
    o.vx *= 0.95;
    o.vy *= 0.95;
    o.pulse += eDt * 2;
    const od = Math.hypot(o.x, o.y);
    if (od > ARENA_R - 10) {
      const pushBack = (od - ARENA_R + 10) / od;
      o.x -= o.x * pushBack;
      o.y -= o.y * pushBack;
    }
  }

  // Shake decay
  shakeAmount *= 0.9;

  // Combo timer
  if (comboTimer > 0) {
    comboTimer -= eDt;
    if (comboTimer <= 0) comboCount = 0;
  }

  // Near-death detection & heartbeat
  nearDeathFlash = 0;
  if (player.alive) {
    let closestDist = 999;
    for (const ai of aiSerpents) {
      if (!ai.alive) continue;
      // Only trigger for larger snakes
      if (ai.segs.length <= player.segs.length) continue;
      const d = dist(player.segs[0], ai.segs[0]);
      if (d < closestDist) closestDist = d;
    }
    if (closestDist < 50) {
      nearDeathFlash = (1 - closestDist / 50) * 0.6;
      heartbeatTimer -= eDt;
      if (heartbeatTimer <= 0) {
        heartbeatTimer = 0.6;
        sfxHeartbeat();
      }
    }
  }

  // Burn trails
  for (const s of [player, ...aiSerpents]) {
    for (let i = s.burnTrail.length - 1; i >= 0; i--) {
      s.burnTrail[i].life -= eDt;
      if (s.burnTrail[i].life <= 0) s.burnTrail.splice(i, 1);
    }
    if (s.evolFlashTimer > 0) s.evolFlashTimer -= eDt;
    // Blink timer
    s.blinkTimer -= eDt;
    if (s.blinkTimer <= 0) s.blinkTimer = rand(2, 5);
  }

  // Camera
  if (killCamTimer > 0) {
    camera.x += (killCamTarget.x - camera.x) * 0.15;
    camera.y += (killCamTarget.y - camera.y) * 0.15;
  } else if (player.alive) {
    camera.x += (player.segs[0].x - camera.x) * 0.1;
    camera.y += (player.segs[0].y - camera.y) * 0.1;
  }

  // Achievement popup timer
  if (achievementPopup) {
    achievementPopup.timer -= dt;
    if (achievementPopup.timer <= 0) achievementPopup = null;
  }

  // Check achievements periodically
  if (Math.random() < dt * 0.5) {
    checkAchievements();
  }
}

function updatePlayerInput(dt: number) {
  if (!player.alive) return;

  const charDef = CHARACTERS[selectedChar];
  const speedUpgrade = upgrades.speed * 0.1;

  if (joystickActive) {
    const dx = joystickCurrent.x - joystickStart.x;
    const dy = joystickCurrent.y - joystickStart.y;
    const jDist = Math.hypot(dx, dy);
    if (jDist > 5) {
      player.targetAngle = Math.atan2(dy, dx);
    }
  } else if (!isMobile) {
    const screenX = W / 2;
    const screenY = H / 2;
    const dx = mouseX - screenX;
    const dy = mouseY - screenY;
    if (Math.hypot(dx, dy) > 5) {
      player.targetAngle = Math.atan2(dy, dx);
    }
  }

  // WASD
  let wdx = 0, wdy = 0;
  if (keys['w'] || keys['arrowup']) wdy -= 1;
  if (keys['s'] || keys['arrowdown']) wdy += 1;
  if (keys['a'] || keys['arrowleft']) wdx -= 1;
  if (keys['d'] || keys['arrowright']) wdx += 1;
  if (wdx !== 0 || wdy !== 0) {
    player.targetAngle = Math.atan2(wdy, wdx);
  }

  // Boost
  const wantBoost = keys[' '] || mouseDown || tapBoost;
  const boostCostReduction = upgrades.boostCost * 0.15;
  if (wantBoost && player.segs.length > 5 && player.boostCooldown <= 0) {
    if (!player.boosting) {
      sfxBoost(); // Play whooom on activation
    }
    player.boosting = true;
    player.speed = BOOST_SPEED * charDef.speedMul * (1 + speedUpgrade);
    // Shed segments
    if (Math.random() < (0.15 - boostCostReduction) * dt * 60) {
      const tail = player.segs[player.segs.length - 1];
      player.segs.pop();
      spawnOrb(tail.x, tail.y, 1);
    }
  } else {
    player.boosting = false;
    player.speed = BASE_SPEED * charDef.speedMul * (1 + speedUpgrade);
  }

  // Speed power
  if (player.powers.some(p => p.kind === 'speed')) {
    player.speed *= 1.5;
  }
  // Feeding frenzy speed boost
  if (feedFrenzyTimer > 0) {
    player.speed *= 1.5;
  }
}

function updateSerpent(s: Serpent, dt: number) {
  // Store previous angle for ripple detection
  const prevAngle = s.angle;

  s.angle = lerpAngle(s.angle, s.targetAngle, TURN_SPEED * dt * 60);

  const head = s.segs[0];
  head.x += Math.cos(s.angle) * s.speed * dt * 60;
  head.y += Math.sin(s.angle) * s.speed * dt * 60;

  // Body follows
  for (let i = 1; i < s.segs.length; i++) {
    const prev = s.segs[i - 1];
    const seg = s.segs[i];
    const dx = seg.x - prev.x;
    const dy = seg.y - prev.y;
    const d = Math.hypot(dx, dy);
    if (d > SEG_DIST) {
      const ratio = SEG_DIST / d;
      seg.x = prev.x + dx * ratio;
      seg.y = prev.y + dy * ratio;
    }
  }

  // Direction-change ink ripple
  let angleDelta = s.angle - prevAngle;
  while (angleDelta > Math.PI) angleDelta -= PI2;
  while (angleDelta < -Math.PI) angleDelta += PI2;
  if (Math.abs(angleDelta) > 0.05) {
    if (Math.random() < Math.abs(angleDelta) * 2) {
      addInkRipple(head.x, head.y);
    }
  }
  s.prevAngle = s.angle;

  // Active power timers
  for (let i = s.powers.length - 1; i >= 0; i--) {
    s.powers[i].remaining -= dt;
    if (s.powers[i].remaining <= 0) s.powers.splice(i, 1);
  }

  // Fire trail
  if (s.powers.some(p => p.kind === 'fire')) {
    s.burnTrail.push({ x: head.x, y: head.y, life: 4 });
    addParticle(head.x, head.y, '#f42', 'fire', 1, 1, 0.3);
  }

  // Boost speed lines — radiating backward
  if (s.boosting) {
    const backAngle = s.angle + Math.PI;
    for (let i = 0; i < 3; i++) {
      const spreadAngle = backAngle + rand(-0.5, 0.5);
      const spd = rand(4, 8);
      if (particles.length < PARTICLE_CAP) {
        particles.push({
          x: head.x + rand(-3, 3), y: head.y + rand(-3, 3),
          vx: Math.cos(spreadAngle) * spd,
          vy: Math.sin(spreadAngle) * spd,
          life: 0.2, maxLife: 0.2,
          r: rand(1, 2.5),
          color: s.isPlayer ? '#fff' : s.color,
          type: 'speedLine',
        });
      }
    }
    // Afterimage on body
    if (Math.random() < 0.3 && s.segs.length > 3) {
      const midSeg = s.segs[Math.floor(s.segs.length * 0.3)];
      addParticle(midSeg.x, midSeg.y, `hsla(${s.hue},40%,50%,0.3)`, 'trail', 1, 0.5, 0.2);
    }
  }

  // Stage 4 dragon particles
  const stage = getStage(s.segs.length);
  if (stage >= 4) {
    // Golden particle trail
    if (Math.random() < 0.4) {
      const trailSeg = s.segs[Math.min(3, s.segs.length - 1)];
      addParticle(trailSeg.x + rand(-3, 3), trailSeg.y + rand(-3, 3), '#ffd700', 'trail', 1, 0.5, 0.4);
    }
    // Occasional flame bursts from mouth
    if (Math.random() < 0.15) {
      const mouthX = head.x + Math.cos(s.angle) * 10;
      const mouthY = head.y + Math.sin(s.angle) * 10;
      addParticle(mouthX, mouthY, '#f80', 'fire', 2, 2, 0.3);
    }
  }

  // Evolution check
  const newStage = getStage(s.segs.length);
  if (newStage > s.stageCache) {
    s.stageCache = newStage;
    const info = getStageInfo(newStage);
    s.evolFlashTimer = 0.6;
    if (s.isPlayer) {
      const evolNames: Record<number, string> = {
        2: '化身·角蛇!',
        3: '化身·蛟龙!',
        4: '化身·神龙!'
      };
      evolutionName = evolNames[newStage] || info.name;
      evolutionStage = newStage;
      evolutionOverlay = 1.5;
      gameScreen = 'evolution';
      slowMoTimer = 0.5; // evolution slow-mo
      slowMo = 0.6;
      sfxEvolution(newStage);

      // Old body segments fly outward as particles
      for (let si = 0; si < s.segs.length; si += 2) {
        const seg = s.segs[si];
        const scatterAngle = angleTo(head, seg) + rand(-0.3, 0.3);
        const scatterSpeed = rand(4, 10);
        if (particles.length < PARTICLE_CAP) {
          particles.push({
            x: seg.x, y: seg.y,
            vx: Math.cos(scatterAngle) * scatterSpeed,
            vy: Math.sin(scatterAngle) * scatterSpeed,
            life: 1.0, maxLife: 1.0,
            r: rand(3, 6),
            color: info.color,
            type: 'inkExplosion',
          });
        }
      }

      // Full-screen ink explosion (more dramatic)
      addInkExplosion(head.x, head.y, info.color, 80);
      addParticle(head.x, head.y, '#fff', 'ink', 40, 10, 1.5);

      // Screen shake
      shakeAmount = 15;

      // 2s invincibility after evolution
      evolInvincTimer = 2.0;
    }
  }
}

function updateAI(ai: Serpent, dt: number) {
  ai.aiTimer -= dt;

  ai.aiAggression = clamp(0.2 + gameTime * 0.005, 0.2, 0.95);
  if (ai.isBoss) ai.aiAggression = 0.9;

  if (ai.aiTimer <= 0) {
    ai.aiTimer = rand(0.2, 0.8);
    let bestTarget: Vec2 | null = null;
    let bestScore = -Infinity;

    for (const o of orbs) {
      const d = dist(ai.segs[0], o);
      const score = o.val / (d + 1) * 100;
      if (score > bestScore) {
        bestScore = score;
        bestTarget = { x: o.x, y: o.y };
      }
    }

    if (player.alive) {
      const d = dist(ai.segs[0], player.segs[0]);
      const aiLen = ai.segs.length;
      const playerLen = player.segs.length;

      if (aiLen > playerLen * 1.3 && d < 200) {
        if (ai.aiAggression > 0.4) {
          const predictDist = d * 0.5;
          bestTarget = {
            x: player.segs[0].x + Math.cos(player.angle) * predictDist,
            y: player.segs[0].y + Math.sin(player.angle) * predictDist,
          };
        }
      } else if (aiLen < playerLen * 0.7 && d < 150) {
        const away = angleTo(player.segs[0], ai.segs[0]);
        bestTarget = {
          x: ai.segs[0].x + Math.cos(away) * 150,
          y: ai.segs[0].y + Math.sin(away) * 150,
        };
      } else if (d < 100) {
        const playerHeadDir = player.angle;
        const headTargetX = player.segs[0].x + Math.cos(playerHeadDir) * 50;
        const headTargetY = player.segs[0].y + Math.sin(playerHeadDir) * 50;
        const dToHeadPath = dist(ai.segs[0], { x: headTargetX, y: headTargetY });
        if (dToHeadPath < 40) {
          const dodgeSide = Math.random() < 0.5 ? 1 : -1;
          bestTarget = {
            x: ai.segs[0].x + Math.cos(playerHeadDir + Math.PI / 2 * dodgeSide) * 80,
            y: ai.segs[0].y + Math.sin(playerHeadDir + Math.PI / 2 * dodgeSide) * 80,
          };
        }
      }

      if (player.boosting && d < 180) {
        const playerToAI = angleTo(player.segs[0], ai.segs[0]);
        let adiff = player.angle - playerToAI;
        while (adiff > Math.PI) adiff -= PI2;
        while (adiff < -Math.PI) adiff += PI2;
        if (Math.abs(adiff) < 0.8) {
          const fleeAngle = playerToAI + (Math.random() < 0.5 ? 0.5 : -0.5);
          bestTarget = {
            x: ai.segs[0].x + Math.cos(fleeAngle) * 200,
            y: ai.segs[0].y + Math.sin(fleeAngle) * 200,
          };
        }
      }
    }

    for (const other of aiSerpents) {
      if (other === ai || !other.alive) continue;
      const d = dist(ai.segs[0], other.segs[0]);
      if (d < 40 && other.segs.length > ai.segs.length) {
        const away = angleTo(other.segs[0], ai.segs[0]);
        bestTarget = {
          x: ai.segs[0].x + Math.cos(away) * 100,
          y: ai.segs[0].y + Math.sin(away) * 100,
        };
      }
    }

    for (const h of hazards) {
      if (h.kind === 'whirlpool') {
        const d = dist(ai.segs[0], h);
        if (d < 100) {
          const away = angleTo(h, ai.segs[0]);
          bestTarget = {
            x: ai.segs[0].x + Math.cos(away) * 120,
            y: ai.segs[0].y + Math.sin(away) * 120,
          };
        }
      }
    }

    const headDist = Math.hypot(ai.segs[0].x, ai.segs[0].y);
    if (headDist > ARENA_R - 60) {
      bestTarget = { x: 0, y: 0 };
    }

    ai.aiTarget = bestTarget;
  }

  if (ai.aiTarget) {
    ai.targetAngle = angleTo(ai.segs[0], ai.aiTarget);
  }

  const stage = getStage(ai.segs.length);
  ai.speed = BASE_SPEED * (1 + stage * 0.05);

  ai.boosting = false;
  if (ai.aiTarget && ai.segs.length > 8) {
    const targetDist = dist(ai.segs[0], ai.aiTarget);

    if (player.alive) {
      const playerDist = dist(player.segs[0], ai.segs[0]);
      if (playerDist < 120 && targetDist < 60 && Math.random() < 0.3) {
        ai.boosting = true;
        ai.speed = BOOST_SPEED;
        if (Math.random() < 0.015) {
          const tail = ai.segs[ai.segs.length - 1];
          ai.segs.pop();
          spawnOrb(tail.x, tail.y, 1);
        }
      }
    }

    if (ai.isBoss && player.alive) {
      const d = dist(ai.segs[0], player.segs[0]);
      if (d < 100 && ai.segs.length > 20) {
        ai.boosting = true;
        ai.speed = BOOST_SPEED;
        if (Math.random() < 0.02) {
          const tail = ai.segs[ai.segs.length - 1];
          ai.segs.pop();
          spawnOrb(tail.x, tail.y, 1);
        }
      }
    }

    if (ai.aiAggression > 0.6 && player.alive && ai.segs.length > player.segs.length * 1.2) {
      const d = dist(ai.segs[0], player.segs[0]);
      if (d < 150 && ai.segs.length > 15) {
        ai.boosting = true;
        ai.speed = BOOST_SPEED * 0.9;
        if (Math.random() < 0.01) {
          const tail = ai.segs[ai.segs.length - 1];
          ai.segs.pop();
          spawnOrb(tail.x, tail.y, 1);
        }
      }
    }
  }
}

function checkOrbCollection(s: Serpent) {
  const head = s.segs[0];
  const baseMagnet = s.powers.some(p => p.kind === 'magnet')
    ? 80 + (s.isPlayer ? upgrades.magnetRange * 20 : 0) : 0;
  const frenzyMagnet = (s.isPlayer && feedFrenzyTimer > 0) ? 60 : 0;
  const magnetRange = Math.max(baseMagnet, frenzyMagnet);

  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i];
    const d = dist(head, o);

    // Magnet attraction
    if (magnetRange > 0 && d < magnetRange) {
      const a = angleTo(o, head);
      o.vx += Math.cos(a) * 3;
      o.vy += Math.sin(a) * 3;
    }

    if (d < 12) {
      orbs.splice(i, 1);
      const last = s.segs[s.segs.length - 1];
      s.segs.push({ x: last.x, y: last.y });
      s.score += o.val;

      if (s.isPlayer) {
        totalOrbsEaten++;
        if (totalOrbsEaten % 10 === 0) {
          coins++;
          saveData();
        }
        comboCount++;
        comboTimer = 1.5;

        // Feeding frenzy tracking
        feedStreakCount++;
        feedStreakTimer = FEED_FRENZY_WINDOW;
        sfxEatOrb(feedStreakCount); // pitches up with consecutive eats

        if (feedStreakCount >= FEED_FRENZY_THRESHOLD && feedFrenzyTimer <= 0) {
          feedFrenzyTimer = FEED_FRENZY_DURATION;
          addFloatingText(head.x, head.y - 30, '暴食模式!', '#ffd700', 28, true);
          shakeAmount = 5;
          // Trigger golden glow burst
          addParticle(head.x, head.y, '#ffd700', 'spark', 12, 5, 0.6);
          playTone(800, 0.15, 0.12, 'triangle');
          playTone(1000, 0.12, 0.1, 'triangle');
        }

        if (comboCount > 5) {
          shakeAmount = Math.min(comboCount * 0.3, 4);
        }
      }

      // Squash-stretch pop for new segment
      addParticle(last.x, last.y, s.isPlayer ? '#ffd700' : s.color, 'spark', 2, 1.5, 0.25);
      addParticle(o.x, o.y, `hsl(${o.hue},80%,60%)`, 'spark', 3, 2, 0.3);
    }
  }
}

function checkPowerUpCollection(s: Serpent) {
  if (!s.isPlayer) return;
  const head = s.segs[0];

  for (let i = powerUps.length - 1; i >= 0; i--) {
    const p = powerUps[i];
    if (dist(head, p) < 18) {
      powerUps.splice(i, 1);
      sfxPowerUp();
      applyPower(s, p.kind);
      addParticle(p.x, p.y, POWER_COLORS[p.kind], 'spark', 8, 3, 0.5);
    }
  }
}

function applyPower(s: Serpent, kind: PowerKind) {
  if (kind === 'split') {
    const shedCount = Math.floor(s.segs.length * 0.3);
    for (let i = 0; i < shedCount; i++) {
      const seg = s.segs.pop();
      if (seg) spawnOrb(seg.x + rand(-5, 5), seg.y + rand(-5, 5), 1);
    }
    s.powers.push({ kind: 'magnet', remaining: 3 });
    return;
  }

  if (kind === 'freeze') {
    for (const ai of aiSerpents) {
      if (ai.alive) {
        ai.frozen = true;
        ai.frozenTimer = 3;
      }
    }
    return;
  }

  let dur = POWER_DURATIONS[kind];
  if (kind === 'shield') {
    dur += (upgrades.shieldDur || 0) * 1.5;
  }
  const existing = s.powers.find(p => p.kind === kind);
  if (existing) { existing.remaining = dur; }
  else { s.powers.push({ kind, remaining: dur }); }
}

function checkSelfCollision(s: Serpent) {
  if (s.powers.some(p => p.kind === 'shield' || p.kind === 'ghost')) return;
  const head = s.segs[0];
  for (let i = 10; i < s.segs.length; i++) {
    if (dist(head, s.segs[i]) < 6) {
      killSerpent(s, s.isPlayer ? null : s);
      return;
    }
  }
}

function checkBoundaryCollision(s: Serpent) {
  const head = s.segs[0];
  const d = Math.hypot(head.x, head.y);
  if (d > ARENA_R) {
    killSerpent(s, null);
  }
}

function checkSerpentVsSerpentCollision(s: Serpent) {
  if (!s.alive) return;
  const head = s.segs[0];
  const allSerpents = [player, ...aiSerpents];

  for (const other of allSerpents) {
    if (other === s || !other.alive) continue;

    for (let i = 5; i < other.segs.length; i++) {
      if (dist(head, other.segs[i]) < 7) {
        killSerpent(s, other);
        return;
      }
    }

    if (s.isPlayer || other.isPlayer) {
      const burner = s.isPlayer ? s : other;
      const target = s.isPlayer ? other : s;
      if (burner.powers.some(p => p.kind === 'fire')) {
        for (const bt of burner.burnTrail) {
          if (dist(target.segs[0], bt) < 12) {
            killSerpent(target, burner);
            return;
          }
        }
      }
    }
  }
}

function killSerpent(s: Serpent, killer: Serpent | null) {
  s.alive = false;
  const head = s.segs[0];

  // Drop essence orbs (glow and pulse more)
  for (let i = 0; i < s.segs.length; i += 2) {
    const seg = s.segs[i];
    spawnOrb(seg.x + rand(-8, 8), seg.y + rand(-8, 8), 2, true);
  }

  if (s.isPlayer) {
    // Death drama: scatter body with physics + trailing ink particles
    for (let i = 0; i < s.segs.length; i++) {
      const seg = s.segs[i];
      const scatterAngle = angleTo(head, seg) + rand(-0.5, 0.5);
      const scatterSpeed = rand(3, 8);
      if (particles.length < PARTICLE_CAP) {
        particles.push({
          x: seg.x, y: seg.y,
          vx: Math.cos(scatterAngle) * scatterSpeed,
          vy: Math.sin(scatterAngle) * scatterSpeed,
          life: 1.5, maxLife: 1.5,
          r: rand(3, 6),
          color: s.color,
          type: 'deathScatter',
        });
      }
      addParticle(seg.x, seg.y, s.color, 'ink', 2, 3, 0.8);
    }

    sfxDeath();
    shakeAmount = 15;
    killCamTimer = 1.5;
    killCamTarget = { x: head.x, y: head.y };
    slowMoTimer = 1.0;
    slowMo = 0.2; // Dramatic slow-mo on player death

    leaderboard.push({
      name: nameInputText || CHARACTERS[selectedChar].name,
      score: s.score,
      stage: s.stageCache,
      kills: s.kills,
    });
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 10);
    if (s.score > highScore) highScore = s.score;
    totalKillsAllRuns += s.kills;
    updatePassport(Math.floor(totalOrbsEaten / 10));
    saveData();
    stopBGM();
    setTimeout(() => {
      gameScreen = 'dead';
      // Prompt for name on first game over if still default
      if (!nameInputText || nameInputText === '旅行者') {
        setTimeout(() => { changePlayerName(); }, 800);
      }
    }, 1500);
  } else {
    // AI death — scatter body with physics + ink (3x more dramatic)
    for (let i = 0; i < Math.min(s.segs.length, 30); i++) {
      const seg = s.segs[i];
      // 3 particles per segment for dramatic scatter
      for (let j = 0; j < 3; j++) {
        const scatterAngle = angleTo(head, seg) + rand(-0.8, 0.8);
        const scatterSpeed = rand(3, 10);
        if (particles.length < PARTICLE_CAP) {
          particles.push({
            x: seg.x + rand(-3, 3), y: seg.y + rand(-3, 3),
            vx: Math.cos(scatterAngle) * scatterSpeed,
            vy: Math.sin(scatterAngle) * scatterSpeed,
            life: 1.5, maxLife: 1.5,
            r: rand(2, 6),
            color: s.color,
            type: 'deathScatter',
          });
        }
      }
      addParticle(seg.x, seg.y, s.color, 'ink', 3, 4, 0.8);
    }
    s.respawnTimer = 3;
  }

  if (killer && killer.isPlayer) {
    killer.kills++;
    // Kill impact effects
    freezeFrameTimer = 0.04; // 40ms = ~2.5 frames hit-stop
    shakeAmount = Math.max(shakeAmount, 10);
    killFlashColor = s.color;
    killFlashTimer = 0.1;

    // Size-based kill sounds
    const victimLen = s.segs.length;
    if (victimLen >= 50 || s.isBoss) {
      sfxKillLarge();
    } else if (victimLen >= 20) {
      sfxKillMedium();
    } else {
      sfxKillSmall();
    }

    // Damage number
    addFloatingText(head.x + rand(-20, 20), head.y - 30, `${victimLen}`, '#ff8', 22, false);

    // "击杀 [name]!" floating text
    addFloatingText(head.x, head.y - 20, `击杀 ${s.name}!`, '#fff', 28, true);

    // Kill streak
    killStreakCount++;
    killStreakTimer = KILL_STREAK_WINDOW;
    if (killStreakCount >= 3) {
      const streakNames: Record<number, string> = {
        3: '三连杀!',
        4: '四连杀!',
        5: '五连杀·天诛!',
      };
      const streakName = killStreakCount >= 5 ? '五连杀·天诛!' : (streakNames[killStreakCount] || `${killStreakCount}连杀!`);
      addFloatingText(killer.segs[0].x, killer.segs[0].y - 50, streakName, '#ff4444', 34, true);
      shakeAmount = Math.max(shakeAmount, 5 + killStreakCount * 3);

      // At 5-kill streak: screen-wide ink wave
      if (killStreakCount >= 5) {
        inkWaveTimer = 1.0;
        inkWaveOrigin = { x: killer.segs[0].x, y: killer.segs[0].y };
        playTone(100, 0.5, 0.2, 'sine');
        playTone(200, 0.3, 0.15, 'triangle');
      }
    }

    // Boss kill celebration
    if (s.isBoss) {
      addFloatingText(head.x, head.y - 60, '妖蛇伏诛!', '#ffd700', 36, true);
      addParticle(head.x, head.y, '#ffd700', 'spark', 30, 6, 1.0);
      addInkExplosion(head.x, head.y, '#ffd700', 40);
      // Drop 10 extra orbs
      for (let i = 0; i < 10; i++) {
        spawnOrb(head.x + rand(-40, 40), head.y + rand(-40, 40), 3, true);
      }
      if (activeBoss === s) activeBoss = null;
    }

    // Kill slow-mo: brief for regular, longer for boss/streak
    if (s.isBoss) {
      slowMoTimer = 0.5;
      slowMo = 0.3;
    } else if (killStreakCount >= 3) {
      slowMoTimer = 0.3;
      slowMo = 0.4;
    } else {
      slowMoTimer = 0.15;
      slowMo = 0.5;
    }
  }
}

// ─── Rendering ──────────────────────────────────────────────
function render() {
  ctx.save();
  // Deep dark gradient background instead of flat black
  const mainBgGrad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.8);
  mainBgGrad.addColorStop(0, '#0d0b08');
  mainBgGrad.addColorStop(1, '#040306');
  ctx.fillStyle = mainBgGrad;
  ctx.fillRect(0, 0, W, H);

  if (gameScreen === 'title') { renderTitle(); ctx.restore(); return; }
  if (gameScreen === 'charSelect') { renderCharSelect(); ctx.restore(); return; }
  if (gameScreen === 'leaderboard') { renderLeaderboard(); ctx.restore(); return; }
  if (gameScreen === 'nameInput') { renderNameInput(); ctx.restore(); return; }
  if (gameScreen === 'achievements') { renderAchievements(); ctx.restore(); return; }

  // Game rendering (playing, dead, evolution)
  const shakeX = (Math.random() - 0.5) * shakeAmount;
  const shakeY = (Math.random() - 0.5) * shakeAmount;

  ctx.translate(W / 2 + shakeX, H / 2 + shakeY);
  ctx.translate(-camera.x, -camera.y);

  renderBackground();
  renderArenaBackground();
  renderHazards();
  renderOrbs();
  renderPowerUps();

  // Burn trails
  for (const s of [player, ...aiSerpents]) {
    for (const bt of s.burnTrail) {
      const a = bt.life / 4;
      ctx.fillStyle = `rgba(255,60,20,${a * 0.4})`;
      ctx.beginPath();
      ctx.arc(bt.x, bt.y, 6, 0, PI2);
      ctx.fill();
    }
  }

  renderParticles();

  // AI serpents
  for (const ai of aiSerpents) {
    if (ai.alive) renderSerpent(ai);
  }

  // Player serpent
  if (player.alive) renderSerpent(player);

  // Floating texts (world space)
  for (const ft of floatingTexts) {
    const alpha = ft.life / ft.maxLife;
    ctx.save();
    if (ft.glow) {
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 15;
    }
    ctx.globalAlpha = alpha;
    ctx.fillStyle = ft.color;
    ctx.font = `bold ${ft.size}px "Noto Serif SC"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }

  ctx.restore();

  // Ink wave effect (5-kill streak)
  if (inkWaveTimer > 0) {
    ctx.save();
    const waveProgress = 1 - inkWaveTimer;
    const waveR = waveProgress * Math.max(W, H) * 1.5;
    const waveAlpha = inkWaveTimer * 0.3;
    ctx.strokeStyle = `rgba(60,40,30,${waveAlpha})`;
    ctx.lineWidth = 20 * inkWaveTimer;
    ctx.beginPath();
    ctx.arc(W / 2 + (inkWaveOrigin.x - camera.x), H / 2 + (inkWaveOrigin.y - camera.y), waveR, 0, PI2);
    ctx.stroke();
    ctx.restore();
  }

  // HUD
  if (gameScreen === 'playing' || gameScreen === 'evolution') {
    renderHUD();
    renderMinimap();

    // Boss health bar at top
    if (activeBoss && activeBoss.alive) {
      ctx.save();
      const barW = 200;
      const barH = 10;
      const barX = W / 2 - barW / 2;
      const barY = 55;
      const healthPct = activeBoss.segs.length / bossHealthMax;

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      roundRect(ctx, barX - 5, barY - 15, barW + 10, barH + 25, 6, true);

      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 11px "Noto Serif SC"';
      ctx.textAlign = 'center';
      ctx.fillText(activeBoss.name, W / 2, barY - 2);

      ctx.fillStyle = 'rgba(80,0,0,0.8)';
      ctx.fillRect(barX, barY + 2, barW, barH);
      ctx.fillStyle = healthPct > 0.3 ? '#ff4444' : '#ff0000';
      ctx.fillRect(barX, barY + 2, barW * clamp(healthPct, 0, 1), barH);
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY + 2, barW, barH);
      ctx.restore();
    }
  }

  // Kill flash — screen edge flash with killed serpent's color
  if (killFlashTimer > 0 && killFlashColor) {
    const flashAlpha = killFlashTimer / 0.1 * 0.4;
    ctx.save();
    // Top edge
    const grad1 = ctx.createLinearGradient(0, 0, 0, 60);
    grad1.addColorStop(0, killFlashColor.replace(')', `,${flashAlpha})`).replace('rgb', 'rgba').replace('#', ''));
    grad1.addColorStop(1, 'rgba(0,0,0,0)');
    // Use a simpler approach
    ctx.globalAlpha = flashAlpha;
    ctx.fillStyle = killFlashColor;
    ctx.fillRect(0, 0, W, 8);
    ctx.fillRect(0, H - 8, W, 8);
    ctx.fillRect(0, 0, 8, H);
    ctx.fillRect(W - 8, 0, 8, H);
    ctx.restore();
  }

  // Near-death red vignette pulse
  if (nearDeathFlash > 0 && gameScreen === 'playing') {
    ctx.save();
    const vignetteGrad = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.7);
    vignetteGrad.addColorStop(0, 'rgba(255,0,0,0)');
    vignetteGrad.addColorStop(1, `rgba(255,0,0,${nearDeathFlash * (0.3 + Math.sin(gameTime * 8) * 0.1)})`);
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // Evolution overlay
  if (gameScreen === 'evolution') {
    renderEvolutionOverlay();
  }

  // Spirit storm indicator
  if (spiritStormActive) {
    ctx.fillStyle = `rgba(200,180,255,${0.1 + Math.sin(gameTime * 5) * 0.05})`;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#edf';
    ctx.font = 'bold 18px "Noto Serif SC"';
    ctx.textAlign = 'center';
    ctx.fillText('灵 气 风 暴', W / 2, 80);
  }

  // Screen edge golden sparkle trail when boosting at high speed
  if (player.alive && player.boosting && gameScreen === 'playing') {
    ctx.save();
    ctx.globalAlpha = 0.4;
    for (let sp = 0; sp < 4; sp++) {
      const sparkX = rand(0, W);
      const sparkY = rand(0, 6);
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, rand(1, 2.5), 0, PI2);
      ctx.fill();
      // Bottom edge
      ctx.beginPath();
      ctx.arc(rand(0, W), H - rand(0, 6), rand(1, 2.5), 0, PI2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Death screen
  if (gameScreen === 'dead') {
    renderDeathScreen();
  }

  // Joystick
  if (joystickActive && gameScreen === 'playing') {
    renderJoystick();
  }

  // Achievement popup
  if (achievementPopup) {
    const ap = achievementPopup;
    const alpha = ap.timer > 2.5 ? (3 - ap.timer) * 2 : ap.timer > 0.5 ? 1 : ap.timer * 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(200,160,60,0.9)';
    roundRect(ctx, W / 2 - 100, 100, 200, 50, 10, true);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px "Noto Serif SC"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`印章: ${ap.name}`, W / 2, 125);
    ctx.restore();
  }
}

function renderBackground() {
  const parallaxX = camera.x * 0.1;
  const parallaxY = camera.y * 0.1;

  // Layer 1: Farthest mountains (very faint, slow parallax)
  ctx.save();
  ctx.globalAlpha = 0.035;
  ctx.fillStyle = '#6a5a4a';
  ctx.beginPath();
  const mw1 = 300;
  for (let i = -5; i < 6; i++) {
    const mx = i * mw1 - parallaxX * 0.15;
    const my = -parallaxY * 0.1;
    const mh = 120 + Math.sin(i * 1.2 + 2.5) * 60;
    ctx.moveTo(mx - mw1 / 2, my + 250);
    ctx.quadraticCurveTo(mx - mw1 / 3, my + 250 - mh * 0.5, mx - mw1 * 0.1, my + 250 - mh * 0.9);
    ctx.quadraticCurveTo(mx + mw1 * 0.05, my + 250 - mh, mx + mw1 * 0.1, my + 250 - mh * 0.85);
    ctx.quadraticCurveTo(mx + mw1 / 3, my + 250 - mh * 0.4, mx + mw1 / 2, my + 250);
  }
  ctx.fill();
  ctx.restore();

  // Layer 2: Mid mountains (medium parallax)
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = '#8a7a5a';
  ctx.beginPath();
  const mw2 = 220;
  for (let i = -4; i < 5; i++) {
    const mx = i * mw2 - parallaxX * 0.4;
    const my = -parallaxY * 0.25;
    const mh = 90 + Math.sin(i * 1.7 + 0.5) * 45;
    ctx.moveTo(mx - mw2 / 2, my + 200);
    ctx.quadraticCurveTo(mx - mw2 / 4, my + 200 - mh * 0.7, mx, my + 200 - mh);
    ctx.quadraticCurveTo(mx + mw2 / 4, my + 200 - mh * 0.8, mx + mw2 / 2, my + 200);
  }
  ctx.fill();
  ctx.restore();

  // Layer 3: Closest mountains (most parallax, more detail)
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = '#a8957a';
  ctx.beginPath();
  for (let i = -3; i < 4; i++) {
    const mx = i * 250 + 80 - parallaxX * 0.8;
    const my = -parallaxY * 0.5;
    const mh = 100 + Math.sin(i * 2.3 + 1) * 50;
    ctx.moveTo(mx - 125, my + 300);
    ctx.quadraticCurveTo(mx - 50, my + 300 - mh * 0.6, mx, my + 300 - mh);
    ctx.quadraticCurveTo(mx + 60, my + 300 - mh * 0.7, mx + 125, my + 300);
  }
  ctx.fill();
  ctx.restore();

  // Atmospheric fog patches drifting
  ctx.save();
  const fogT = gameTime * 0.15;
  for (let i = 0; i < 5; i++) {
    const fx = Math.sin(fogT + i * 3.7) * 400 - parallaxX * 0.3;
    const fy = Math.cos(fogT * 0.7 + i * 2.1) * 300 - parallaxY * 0.3;
    const fogR = 80 + Math.sin(fogT + i) * 30;
    const fogGrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, fogR);
    fogGrad.addColorStop(0, 'rgba(120,110,90,0.025)');
    fogGrad.addColorStop(1, 'rgba(120,110,90,0)');
    ctx.fillStyle = fogGrad;
    ctx.beginPath();
    ctx.arc(fx, fy, fogR, 0, PI2);
    ctx.fill();
  }
  ctx.restore();
}

function renderArenaBackground() {
  // Outer void with dissolving edge
  const voidGrad = ctx.createRadialGradient(0, 0, ARENA_R - 30, 0, 0, ARENA_R + 80);
  voidGrad.addColorStop(0, 'rgba(5,5,8,0)');
  voidGrad.addColorStop(0.5, 'rgba(3,3,5,0.7)');
  voidGrad.addColorStop(1, '#020204');
  ctx.fillStyle = '#020204';
  ctx.beginPath();
  ctx.arc(0, 0, ARENA_R + 80, 0, PI2);
  ctx.fill();

  // Arena base gradient (richer tones)
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, ARENA_R);
  grad.addColorStop(0, '#1c1a14');
  grad.addColorStop(0.3, '#181612');
  grad.addColorStop(0.6, '#141210');
  grad.addColorStop(0.85, '#0e0c0a');
  grad.addColorStop(1, '#080706');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, ARENA_R, 0, PI2);
  ctx.fill();

  // Player-following spotlight (warm golden light centered on player)
  if (player && player.alive) {
    const px = player.segs[0].x;
    const py = player.segs[0].y;
    const playerStage = getStage(player.segs.length);
    const lightR = 220 + playerStage * 30;
    const lightPulse = 0.08 + Math.sin(gameTime * 2) * 0.015;
    const lightGrad = ctx.createRadialGradient(px, py, 0, px, py, lightR);
    lightGrad.addColorStop(0, `rgba(255,210,100,${lightPulse})`);
    lightGrad.addColorStop(0.3, `rgba(255,180,60,${lightPulse * 0.5})`);
    lightGrad.addColorStop(0.7, `rgba(200,150,50,${lightPulse * 0.15})`);
    lightGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lightGrad;
    ctx.beginPath();
    ctx.arc(px, py, lightR, 0, PI2);
    ctx.fill();
  }

  // Water-like surface with faint ripple animation
  ctx.save();
  const t = gameTime * 0.3;
  // Ink-wash flowing patterns (subtle background texture)
  ctx.globalAlpha = 0.035;
  for (let i = 0; i < 8; i++) {
    const cx2 = Math.cos(t + i * 1.1) * ARENA_R * 0.5;
    const cy2 = Math.sin(t * 0.7 + i * 0.9) * ARENA_R * 0.5;
    const swirlR = 120 + Math.sin(t + i) * 40;
    const swirl = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, swirlR);
    swirl.addColorStop(0, 'rgba(140,120,90,1)');
    swirl.addColorStop(0.6, 'rgba(120,100,70,0.5)');
    swirl.addColorStop(1, 'rgba(140,120,90,0)');
    ctx.fillStyle = swirl;
    ctx.beginPath();
    ctx.arc(cx2, cy2, swirlR, 0, PI2);
    ctx.fill();
  }

  // Faint ripple rings centered on origin
  ctx.globalAlpha = 0.02;
  ctx.strokeStyle = 'rgba(140,130,100,1)';
  ctx.lineWidth = 0.5;
  for (let r = 0; r < 3; r++) {
    const rippleR = ((gameTime * 30 + r * 150) % (ARENA_R * 0.8));
    const rippleAlpha = 1 - rippleR / (ARENA_R * 0.8);
    ctx.globalAlpha = rippleAlpha * 0.02;
    ctx.beginPath();
    ctx.arc(0, 0, rippleR, 0, PI2);
    ctx.stroke();
  }
  ctx.restore();

  // Grid dots with subtle glow
  ctx.fillStyle = 'rgba(100,90,70,0.08)';
  const camXF = Math.floor(camera.x / 50) * 50;
  const camYF = Math.floor(camera.y / 50) * 50;
  for (let gx = camXF - 300; gx < camXF + 300; gx += 50) {
    for (let gy = camYF - 500; gy < camYF + 500; gy += 50) {
      if (gx * gx + gy * gy < ARENA_R * ARENA_R) {
        ctx.fillRect(gx - 1, gy - 1, 2, 2);
      }
    }
  }

  renderInkCloudBorder();

  ctx.strokeStyle = 'rgba(180,160,120,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, ARENA_R * 0.5, 0, PI2);
  ctx.stroke();

  // Arena events rendering
  if (arenaEventActive === '毒雾蔓延') {
    ctx.save();
    const pAlpha = 0.15 + Math.sin(gameTime * 3) * 0.05;
    const pGrad = ctx.createRadialGradient(poisonCloudPos.x, poisonCloudPos.y, 0, poisonCloudPos.x, poisonCloudPos.y, poisonCloudR);
    pGrad.addColorStop(0, `rgba(160,40,180,${pAlpha})`);
    pGrad.addColorStop(0.7, `rgba(120,20,150,${pAlpha * 0.5})`);
    pGrad.addColorStop(1, 'rgba(100,0,120,0)');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.arc(poisonCloudPos.x, poisonCloudPos.y, poisonCloudR, 0, PI2);
    ctx.fill();
    ctx.restore();
  }

  if (arenaEventActive === '灵脉爆发') {
    ctx.save();
    ctx.strokeStyle = `rgba(255,215,0,${0.5 + Math.sin(gameTime * 8) * 0.3})`;
    ctx.lineWidth = 4;
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(spiritLineStart.x, spiritLineStart.y);
    ctx.lineTo(spiritLineEnd.x, spiritLineEnd.y);
    ctx.stroke();
    ctx.restore();
  }
}

function renderInkCloudBorder() {
  const segments = 80;
  const t = gameTime * 0.5;

  // Mystical glow color based on player evolution stage
  const playerStage = player ? getStage(player.segs.length) : 1;
  const stageHue = playerStage === 4 ? 45 : playerStage === 3 ? 280 : playerStage === 2 ? 210 : 120;
  const glowPulse = 0.3 + Math.sin(gameTime * 2) * 0.1;

  ctx.save();
  // Outer glow
  ctx.strokeStyle = `hsla(${stageHue},60%,50%,${glowPulse * 0.15})`;
  ctx.lineWidth = 12;
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * PI2;
    const wobble = Math.sin(angle * 6 + t) * 5 + Math.sin(angle * 10 - t * 1.3) * 3;
    const r = ARENA_R + wobble;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  ctx.strokeStyle = `hsla(${stageHue},50%,60%,0.35)`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * PI2;
    const wobble = Math.sin(angle * 6 + t) * 5 +
                   Math.sin(angle * 10 - t * 1.3) * 3 +
                   Math.sin(angle * 3 + t * 0.7) * 4;
    const r = ARENA_R + wobble;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#b8a888';
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * PI2 + t * 0.1;
    const puffR = 15 + Math.sin(i * 3 + t) * 8;
    const r = ARENA_R + Math.sin(i * 2.5 + t * 0.8) * 8;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * r, Math.sin(angle) * r, puffR, 0, PI2);
    ctx.fill();
  }
  ctx.restore();
}

function renderHazards() {
  for (const h of hazards) {
    if (h.kind === 'whirlpool') {
      ctx.save();
      ctx.translate(h.x, h.y);
      const alpha = Math.min(h.timer / 3, 1) * 0.4;
      for (let ring = 0; ring < 4; ring++) {
        ctx.strokeStyle = `rgba(120,80,200,${alpha * (1 - ring * 0.2)})`;
        ctx.lineWidth = 2 - ring * 0.4;
        ctx.beginPath();
        const ringR = 15 + ring * 15;
        for (let i = 0; i <= 30; i++) {
          const angle = (i / 30) * PI2 + h.angle * (1 + ring * 0.3);
          const wobble = Math.sin(angle * 4 + h.angle * 2) * 3;
          const x = Math.cos(angle) * (ringR + wobble);
          const y = Math.sin(angle) * (ringR + wobble);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.fillStyle = `rgba(100,60,180,${alpha * 0.3})`;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, PI2);
      ctx.fill();

      // Swirling particles around whirlpool
      for (let sp = 0; sp < 6; sp++) {
        const spAngle = h.angle * 2 + sp * PI2 / 6;
        const spR = 30 + Math.sin(spAngle * 2) * 10;
        const spx = Math.cos(spAngle) * spR;
        const spy = Math.sin(spAngle) * spR;
        ctx.fillStyle = `rgba(160,120,255,${alpha * 0.5})`;
        ctx.beginPath();
        ctx.arc(spx, spy, 2, 0, PI2);
        ctx.fill();
      }

      ctx.restore();
    } else if (h.kind === 'spiritGate') {
      ctx.save();
      ctx.translate(h.x, h.y);
      const alpha = Math.min(h.timer / 3, 1);

      // Outer glow
      ctx.fillStyle = `rgba(160,120,255,${alpha * 0.08})`;
      ctx.beginPath();
      ctx.arc(0, 0, 35, 0, PI2);
      ctx.fill();

      ctx.strokeStyle = `rgba(160,120,255,${alpha * 0.6})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 18 + Math.sin(h.angle * 2) * 3, 0, PI2);
      ctx.stroke();
      ctx.fillStyle = `rgba(180,140,255,${alpha * 0.15})`;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, PI2);
      ctx.fill();

      // Swirling particles around gate
      for (let sp = 0; sp < 8; sp++) {
        const spAngle = h.angle * 1.5 + sp * PI2 / 8;
        const spR = 20 + Math.sin(spAngle * 3 + h.angle) * 5;
        const spx = Math.cos(spAngle) * spR;
        const spy = Math.sin(spAngle) * spR;
        ctx.fillStyle = `rgba(200,180,255,${alpha * 0.6})`;
        ctx.beginPath();
        ctx.arc(spx, spy, 1.5, 0, PI2);
        ctx.fill();
      }

      ctx.fillStyle = `rgba(200,180,255,${alpha * 0.8})`;
      ctx.font = 'bold 14px "Noto Serif SC"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('门', 0, 0);
      ctx.restore();
    }
  }
}

function renderOrbs() {
  for (const o of orbs) {
    const screenX = o.x - camera.x + W / 2;
    const screenY = o.y - camera.y + H / 2;
    if (screenX < -20 || screenX > W + 20 || screenY < -20 || screenY > H + 20) continue;

    const pulse = 1 + Math.sin(o.pulse) * 0.2;
    const r = o.r * pulse;

    // Glow halo with radial gradient (bright center, soft edge)
    const glowMul = o.isEssence ? 5 : (o.val >= 3 ? 4 : 3);
    const glowR = r * glowMul;
    const glowGrad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, glowR);
    const glowAlpha = o.isEssence ? (0.2 + Math.sin(o.pulse * 2) * 0.1) : 0.12;
    glowGrad.addColorStop(0, `hsla(${o.hue},80%,70%,${glowAlpha})`);
    glowGrad.addColorStop(0.4, `hsla(${o.hue},70%,60%,${glowAlpha * 0.5})`);
    glowGrad.addColorStop(1, `hsla(${o.hue},60%,50%,0)`);
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(o.x, o.y, glowR, 0, PI2);
    ctx.fill();

    // Core with radial gradient
    const coreGrad = ctx.createRadialGradient(o.x - r * 0.2, o.y - r * 0.2, 0, o.x, o.y, r);
    coreGrad.addColorStop(0, o.isEssence ? `hsl(${o.hue},95%,85%)` : `hsl(${o.hue},90%,80%)`);
    coreGrad.addColorStop(0.6, o.isEssence ? `hsl(${o.hue},90%,70%)` : `hsl(${o.hue},80%,65%)`);
    coreGrad.addColorStop(1, o.isEssence ? `hsl(${o.hue},85%,55%)` : `hsl(${o.hue},70%,50%)`);
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(o.x, o.y, r, 0, PI2);
    ctx.fill();

    // Rotating inner pattern (small cross that rotates)
    if (r > 3) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.translate(o.x, o.y);
      ctx.rotate(o.pulse * 0.8);
      ctx.strokeStyle = `hsla(${o.hue},100%,90%,0.5)`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, 0);
      ctx.lineTo(r * 0.5, 0);
      ctx.moveTo(0, -r * 0.5);
      ctx.lineTo(0, r * 0.5);
      ctx.stroke();
      ctx.restore();
    }

    // Highlight
    ctx.fillStyle = `hsla(${o.hue},90%,95%,0.7)`;
    ctx.beginPath();
    ctx.arc(o.x - r * 0.3, o.y - r * 0.3, r * 0.35, 0, PI2);
    ctx.fill();

    // Magnetism light trail (when orb is moving toward player)
    if (Math.abs(o.vx) > 0.5 || Math.abs(o.vy) > 0.5) {
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = `hsl(${o.hue},80%,70%)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(o.x, o.y);
      ctx.lineTo(o.x - o.vx * 4, o.y - o.vy * 4);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function renderPowerUps() {
  for (const p of powerUps) {
    const screenX = p.x - camera.x + W / 2;
    const screenY = p.y - camera.y + H / 2;
    if (screenX < -30 || screenX > W + 30 || screenY < -30 || screenY > H + 30) continue;

    const pulse = 1 + Math.sin(p.pulse) * 0.15;
    const r = POWERUP_R * pulse;
    const col = POWER_COLORS[p.kind];

    // Outer glow with radial gradient
    const outerGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
    outerGrad.addColorStop(0, col.replace(')', ',0.15)').replace('rgb', 'rgba').replace('#ff0', 'rgba(255,255,0,0.15)').replace('#0ff', 'rgba(0,255,255,0.15)').replace('#f0f', 'rgba(255,0,255,0.15)').replace('#f80', 'rgba(255,136,0,0.15)').replace('#8ef', 'rgba(136,238,255,0.15)').replace('#f44', 'rgba(255,68,68,0.15)').replace('#aaf', 'rgba(170,170,255,0.15)'));
    outerGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = outerGrad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 3, 0, PI2);
    ctx.fill();

    // Orbiting particle ring
    ctx.save();
    ctx.globalAlpha = 0.4;
    for (let orb = 0; orb < 4; orb++) {
      const orbAngle = p.pulse * 1.5 + orb * Math.PI / 2;
      const orbR = r * 1.6;
      const ox = p.x + Math.cos(orbAngle) * orbR;
      const oy = p.y + Math.sin(orbAngle) * orbR;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(ox, oy, 1.5, 0, PI2);
      ctx.fill();
    }
    ctx.restore();

    // Hexagonal frame with glow
    ctx.save();
    ctx.shadowColor = col;
    ctx.shadowBlur = 8;
    // Hex fill (gradient from dark center)
    const hexGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    hexGrad.addColorStop(0, 'rgba(30,28,22,0.9)');
    hexGrad.addColorStop(1, 'rgba(20,18,14,0.85)');
    ctx.fillStyle = hexGrad;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 - Math.PI / 6;
      const hpx = p.x + Math.cos(a) * r;
      const hpy = p.y + Math.sin(a) * r;
      i === 0 ? ctx.moveTo(hpx, hpy) : ctx.lineTo(hpx, hpy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Label
    ctx.save();
    ctx.shadowColor = col;
    ctx.shadowBlur = 6;
    ctx.fillStyle = col;
    ctx.font = `bold ${Math.floor(r)}px "Noto Serif SC"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(POWER_LABELS[p.kind], p.x, p.y + 1);
    ctx.restore();
  }
}

function renderParticles() {
  for (const p of particles) {
    const a = p.life / p.maxLife;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    if (p.type === 'ink' || p.type === 'inkExplosion') {
      ctx.beginPath();
      const pr = p.type === 'inkExplosion' ? p.r * (1.5 + (1 - a) * 2) : p.r * (1 + (1 - a));
      ctx.arc(p.x, p.y, pr, 0, PI2);
      ctx.fill();
      if (p.type === 'inkExplosion' && a > 0.3) {
        ctx.globalAlpha = a * 0.3;
        ctx.beginPath();
        ctx.arc(p.x + p.vx * 2, p.y + p.vy * 2, pr * 0.6, 0, PI2);
        ctx.fill();
      }
    } else if (p.type === 'fire' || p.type === 'fireParticle') {
      ctx.fillStyle = `rgba(255,${Math.floor(100 * a)},0,${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * a, 0, PI2);
      ctx.fill();
    } else if (p.type === 'deathScatter') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.5 + a * 0.5), 0, PI2);
      ctx.fill();
      ctx.globalAlpha = a * 0.2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 2, 0, PI2);
      ctx.fill();
    } else if (p.type === 'speedLine') {
      ctx.globalAlpha = a * 0.6;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.r;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
      ctx.stroke();
    } else if (p.type === 'trail') {
      ctx.globalAlpha = a * 0.4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (1 + (1 - a) * 0.5), 0, PI2);
      ctx.fill();
    } else if (p.type === 'inkMist') {
      ctx.globalAlpha = a * 0.03;
      ctx.fillStyle = 'rgba(120,110,90,1)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, PI2);
      ctx.fill();
    } else if (p.type === 'inkRipple') {
      ctx.globalAlpha = a * 0.25;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, PI2);
      ctx.stroke();
    } else {
      ctx.fillRect(p.x - p.r * a, p.y - p.r * a, p.r * 2 * a, p.r * 2 * a);
    }
    ctx.globalAlpha = 1;
  }
}

function renderSerpent(s: Serpent) {
  if (s.segs.length < 2) return;

  const stage = getStage(s.segs.length);
  const info = s.isPlayer ? getStageInfo(stage) : { name: '', color: s.color, hue: s.hue };
  const charDef = s.isPlayer ? CHARACTERS[selectedChar] : null;
  const sizeMul = charDef ? charDef.sizeMul : (s.isBoss ? 1.5 : 1);

  const isGhost = s.powers.some(p => p.kind === 'ghost');
  if (isGhost) ctx.globalAlpha = 0.5;

  const hasShield = s.powers.some(p => p.kind === 'shield');

  if (s.frozen) ctx.globalAlpha = 0.6;

  const evolFlashing = s.evolFlashTimer > 0 && Math.sin(s.evolFlashTimer * 30) > 0;

  const isDragon = stage >= 4;
  const goldenShimmer = isDragon ? 0.3 + Math.sin(gameTime * 4) * 0.15 : 0;
  const isLongSnake = s.segs.length >= 30;

  const totalSegs = s.segs.length;

  // Ink trail behind the snake
  if (s.isPlayer && Math.random() < 0.3) {
    const trailIdx = Math.min(totalSegs - 1, Math.floor(totalSegs * 0.8));
    const trailSeg = s.segs[trailIdx];
    addParticle(trailSeg.x + rand(-2, 2), trailSeg.y + rand(-2, 2),
      `hsla(${s.isPlayer ? info.hue : s.hue},30%,30%,0.15)`, 'trail', 1, 0.3, 0.6);
  }

  // Feeding frenzy golden glow
  if (s.isPlayer && feedFrenzyTimer > 0) {
    ctx.save();
    ctx.globalAlpha = 0.08 + Math.sin(gameTime * 8) * 0.04;
    ctx.fillStyle = '#ffd700';
    for (let fi = 0; fi < totalSegs; fi += 2) {
      const fSeg = s.segs[fi];
      ctx.beginPath();
      ctx.arc(fSeg.x, fSeg.y, 12 * sizeMul, 0, PI2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Trail afterimage effect (last few positions drawn at decreasing alpha)
  if (s.boosting || isDragon) {
    ctx.save();
    const trailCount = isDragon ? 4 : 2;
    for (let tr = 1; tr <= trailCount; tr++) {
      const trailAlpha = (1 - tr / (trailCount + 1)) * (isDragon ? 0.08 : 0.05);
      ctx.globalAlpha = trailAlpha;
      const offset = tr * 2;
      if (offset < totalSegs) {
        for (let i = offset; i < Math.min(totalSegs, offset + 20); i += 2) {
          const seg = s.segs[i];
          const tFrac = i / totalSegs;
          let bw = (3 + 4 * sizeMul);
          if (tFrac > 0.85) bw *= (1 - (tFrac - 0.85) / 0.15) * 0.8;
          else if (tFrac < 0.15) bw *= (0.85 + tFrac / 0.15 * 0.15);
          ctx.fillStyle = evolFlashing ? '#fff' : `hsla(${s.isPlayer ? info.hue : s.hue},40%,40%,1)`;
          ctx.beginPath();
          ctx.arc(seg.x, seg.y, Math.max(bw * 0.8, 1), 0, PI2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  // Dragon form (stage 4): golden glow aura drawn UNDER body
  if (isDragon && !evolFlashing) {
    ctx.save();
    ctx.globalAlpha = 0.06 + goldenShimmer * 0.04;
    for (let i = 0; i < totalSegs; i += 2) {
      const seg = s.segs[i];
      const auraGrad = ctx.createRadialGradient(seg.x, seg.y, 0, seg.x, seg.y, 14 * sizeMul);
      auraGrad.addColorStop(0, 'rgba(255,200,50,0.3)');
      auraGrad.addColorStop(1, 'rgba(255,200,50,0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(seg.x, seg.y, 14 * sizeMul, 0, PI2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Body segments — with gradient fills and scale pattern
  for (let i = totalSegs - 1; i >= 1; i--) {
    const seg = s.segs[i];
    const screenX = seg.x - camera.x + W / 2;
    const screenY = seg.y - camera.y + H / 2;
    if (screenX < -40 || screenX > W + 40 || screenY < -40 || screenY > H + 40) continue;

    const tFrac = i / totalSegs;
    let bodyW: number;
    if (tFrac > 0.85) {
      bodyW = (3 + 4 * sizeMul) * (1 - (tFrac - 0.85) / 0.15) * 0.8;
    } else if (tFrac < 0.15) {
      bodyW = (3 + 4 * sizeMul) * (0.85 + tFrac / 0.15 * 0.15);
    } else {
      bodyW = (3 + 4 * sizeMul);
    }
    bodyW = Math.max(bodyW, 1);

    // Enhanced serpentine wave motion
    const waveAmp = s.boosting ? 2.5 : 1.8;
    const waveFreq = s.boosting ? 4 : 3;
    const undulate = Math.sin(i * 0.3 + gameTime * waveFreq) * waveAmp + Math.sin(i * 0.15 + gameTime * 1.5) * 0.8;

    let hue = s.isPlayer ? info.hue : s.hue;
    let sat = s.isPlayer ? 65 : 40;
    let lit = s.isPlayer ? 48 + (1 - tFrac) * 15 : 30 + (1 - tFrac) * 12;

    if (s.isPlayer) {
      // Player always has a bright, warm gold/orange base tint so they stand out
      if (stage >= 4) { hue = 45; sat = 75; lit = 55 + (1 - tFrac) * 15; }
      else if (stage >= 3) { hue = 42; sat = 65; lit = 50 + (1 - tFrac) * 12; }
      else if (stage >= 2) { hue = 38; sat = 68; lit = 48 + (1 - tFrac) * 12; }
      else { hue = 35; sat = 70; lit = 46 + (1 - tFrac) * 14; }
    }

    if (evolFlashing) {
      hue = 0; sat = 0; lit = 95;
    }

    if (isDragon && !evolFlashing) {
      lit += goldenShimmer * 20;
      sat = Math.min(sat + 15, 100);
    }

    // Golden scale shimmer at length 30+
    if (isLongSnake && !isDragon && !evolFlashing && i % 3 === 0) {
      const shimmer = Math.sin(i * 0.5 + gameTime * 4) * 0.15;
      if (shimmer > 0) {
        lit += shimmer * 25;
        sat = Math.min(sat + 10, 80);
      }
    }

    const segX = seg.x;
    const segY = seg.y + undulate;

    // Outer glow (shadowBlur) — brighter for player
    if (bodyW > 2) {
      ctx.save();
      if (s.isPlayer) {
        ctx.shadowColor = `rgba(255,200,60,0.5)`;
        ctx.shadowBlur = bodyW * 1.5;
      } else {
        ctx.shadowColor = `hsla(${hue},${sat}%,${lit + 15}%,0.3)`;
        ctx.shadowBlur = bodyW * 0.6;
      }
      ctx.fillStyle = `hsl(${hue},${sat}%,${lit}%)`;
      ctx.beginPath();
      ctx.arc(segX, segY, bodyW, 0, PI2);
      ctx.fill();
      ctx.restore();
    }

    // 3-tone gradient body (shadow -> base -> highlight)
    if (bodyW > 1.5) {
      const bodyGrad = ctx.createRadialGradient(
        segX - bodyW * 0.3, segY - bodyW * 0.3, 0,
        segX, segY, bodyW
      );
      bodyGrad.addColorStop(0, `hsl(${hue},${Math.min(sat + 15, 100)}%,${Math.min(lit + 18, 90)}%)`);
      bodyGrad.addColorStop(0.5, `hsl(${hue},${sat}%,${lit}%)`);
      bodyGrad.addColorStop(1, `hsl(${hue},${Math.max(sat - 5, 0)}%,${Math.max(lit - 12, 10)}%)`);
      ctx.fillStyle = bodyGrad;
    } else {
      ctx.fillStyle = `hsl(${hue},${sat}%,${lit}%)`;
    }
    ctx.beginPath();
    ctx.arc(segX, segY, bodyW, 0, PI2);
    ctx.fill();

    // Scale pattern overlay (diamond shapes for stage 2+)
    if (stage >= 2 && i % 2 === 0 && bodyW > 2 && !evolFlashing) {
      ctx.save();
      ctx.globalAlpha = stage >= 3 ? 0.2 : 0.12;
      ctx.strokeStyle = `hsl(${hue},${sat + 10}%,${lit + 15}%)`;
      ctx.lineWidth = 0.4;
      // Small diamond scale
      const scaleS = bodyW * 0.5;
      ctx.beginPath();
      ctx.moveTo(segX, segY - scaleS);
      ctx.lineTo(segX + scaleS * 0.7, segY);
      ctx.lineTo(segX, segY + scaleS);
      ctx.lineTo(segX - scaleS * 0.7, segY);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // Ridge/spine for stage 2+ (small bumps along the back)
    if (stage >= 2 && i % 4 === 0 && i > 0 && i < totalSegs - 2 && bodyW > 2) {
      const prevSeg = s.segs[Math.max(0, i - 1)];
      const bodyAngle = Math.atan2(seg.y - prevSeg.y, seg.x - prevSeg.x);
      const spineLen = bodyW * (stage >= 3 ? 0.6 : 0.4);
      const spineAngle = bodyAngle - Math.PI / 2;
      ctx.fillStyle = `hsla(${hue},${sat + 10}%,${lit + 8}%,0.4)`;
      ctx.beginPath();
      ctx.arc(
        segX + Math.cos(spineAngle) * bodyW * 0.5,
        segY + Math.sin(spineAngle) * bodyW * 0.5,
        spineLen, 0, PI2
      );
      ctx.fill();
    }

    // Fins (stage 3+)
    if (stage >= 3 && i % 6 === 0 && i > 0 && i < totalSegs - 3) {
      const prevSeg = s.segs[Math.max(0, i - 1)];
      const bodyAngle = Math.atan2(seg.y - prevSeg.y, seg.x - prevSeg.x);
      const finLen = bodyW * (stage >= 4 ? 2.2 : 1.8);
      ctx.save();
      ctx.globalAlpha = 0.35;
      for (const side of [-1, 1]) {
        const finAngle = bodyAngle + Math.PI / 2 * side;
        const finWave = Math.sin(i * 0.4 + gameTime * 3 + side) * 0.3;
        const fx = segX + Math.cos(finAngle + finWave) * finLen;
        const fy = segY + Math.sin(finAngle + finWave) * finLen;
        // Fin as triangle
        ctx.fillStyle = `hsla(${hue},${sat}%,${lit + 10}%,0.3)`;
        ctx.beginPath();
        ctx.moveTo(segX, segY);
        ctx.lineTo(fx, fy);
        ctx.lineTo(segX + Math.cos(bodyAngle) * bodyW, segY + Math.sin(bodyAngle) * bodyW);
        ctx.closePath();
        ctx.fill();
        // Fin edge glow
        ctx.strokeStyle = `hsla(${hue},${sat + 15}%,${lit + 20}%,0.25)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(segX, segY);
        ctx.lineTo(fx, fy);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Outline
    ctx.strokeStyle = `hsla(${hue},${sat + 10}%,${Math.max(lit - 15, 8)}%,0.45)`;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(segX, segY, bodyW, 0, PI2);
    ctx.stroke();

    // Dragon fire trail
    if (isDragon && i % 4 === 0 && s.boosting) {
      addParticle(seg.x, seg.y, '#f80', 'fire', 1, 1, 0.2);
    }
  }

  // Tail tip (enhanced with gradient)
  if (totalSegs > 2) {
    const tailSeg = s.segs[totalSegs - 1];
    const prevTail = s.segs[totalSegs - 2];
    const tailAngle = Math.atan2(tailSeg.y - prevTail.y, tailSeg.x - prevTail.x);
    const tailLen = 8 * sizeMul;
    const hue3 = s.isPlayer ? info.hue : s.hue;
    ctx.save();
    ctx.shadowColor = evolFlashing ? '#fff' : `hsl(${hue3},50%,40%)`;
    ctx.shadowBlur = 4;
    ctx.fillStyle = evolFlashing ? '#fff' : `hsl(${hue3},45%,35%)`;
    ctx.beginPath();
    ctx.moveTo(
      tailSeg.x + Math.cos(tailAngle + Math.PI / 2) * 2.5,
      tailSeg.y + Math.sin(tailAngle + Math.PI / 2) * 2.5
    );
    ctx.lineTo(
      tailSeg.x + Math.cos(tailAngle) * tailLen,
      tailSeg.y + Math.sin(tailAngle) * tailLen
    );
    ctx.lineTo(
      tailSeg.x + Math.cos(tailAngle - Math.PI / 2) * 2.5,
      tailSeg.y + Math.sin(tailAngle - Math.PI / 2) * 2.5
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Head
  const head = s.segs[0];
  const baseHeadR = (5 + (stage >= 4 ? 3 : stage >= 3 ? 2 : stage >= 2 ? 1 : 0)) * sizeMul;
  // Player head is noticeably larger so it stands out
  const headR = s.isPlayer ? baseHeadR * 1.35 : baseHeadR;
  const hue2 = s.isPlayer ? info.hue : s.hue;

  // ── Player-specific bright glowing halo/aura ──
  if (s.isPlayer) {
    ctx.save();
    const haloPulse = 0.6 + Math.sin(gameTime * 3) * 0.2;
    const haloR = headR * 3.5;
    const haloGrad = ctx.createRadialGradient(head.x, head.y, headR * 0.5, head.x, head.y, haloR);
    haloGrad.addColorStop(0, `rgba(255,200,60,${haloPulse * 0.25})`);
    haloGrad.addColorStop(0.4, `rgba(255,160,30,${haloPulse * 0.12})`);
    haloGrad.addColorStop(1, 'rgba(255,140,20,0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(head.x, head.y, haloR, 0, PI2);
    ctx.fill();
    // Bright ring
    ctx.shadowColor = 'rgba(255,200,60,0.7)';
    ctx.shadowBlur = 15 + Math.sin(gameTime * 5) * 5;
    ctx.strokeStyle = `rgba(255,200,60,${haloPulse * 0.4})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(head.x, head.y, headR * 2, 0, PI2);
    ctx.stroke();
    ctx.restore();
  }

  // Head glow with shadowBlur
  ctx.save();
  if (s.isPlayer) {
    ctx.shadowColor = 'rgba(255,200,60,0.6)';
    ctx.shadowBlur = headR * 2.5;
    ctx.fillStyle = 'rgba(255,200,60,0.18)';
  } else {
    ctx.shadowColor = isDragon ? 'rgba(255,180,40,0.4)' : `hsla(${hue2},60%,50%,0.3)`;
    ctx.shadowBlur = headR * 1.5;
    ctx.fillStyle = `hsla(${hue2},60%,50%,0.12)`;
  }
  ctx.beginPath();
  ctx.arc(head.x, head.y, headR * 2, 0, PI2);
  ctx.fill();
  ctx.restore();

  // Head with gradient
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(s.angle);
  const headGrad = ctx.createRadialGradient(-headR * 0.3, -headR * 0.2, 0, 0, 0, headR * 1.2);
  if (evolFlashing) {
    headGrad.addColorStop(0, '#fff');
    headGrad.addColorStop(1, '#ddd');
  } else if (s.isPlayer) {
    // Player head is always bright gold/orange
    headGrad.addColorStop(0, 'hsl(42,80%,65%)');
    headGrad.addColorStop(0.5, 'hsl(38,70%,52%)');
    headGrad.addColorStop(1, 'hsl(35,60%,38%)');
  } else if (isDragon) {
    headGrad.addColorStop(0, 'hsl(45,75%,60%)');
    headGrad.addColorStop(0.5, 'hsl(45,65%,50%)');
    headGrad.addColorStop(1, 'hsl(45,55%,35%)');
  } else {
    headGrad.addColorStop(0, `hsl(${hue2},45%,42%)`);
    headGrad.addColorStop(0.5, `hsl(${hue2},40%,32%)`);
    headGrad.addColorStop(1, `hsl(${hue2},35%,22%)`);
  }
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, headR * 1.2, headR, 0, 0, PI2);
  ctx.fill();
  ctx.strokeStyle = evolFlashing ? '#ddd' : `hsl(${hue2},60%,25%)`;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Jaw/mouth shape
  ctx.strokeStyle = `hsla(${hue2},40%,20%,0.6)`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(headR * 0.9, -headR * 0.35);
  ctx.quadraticCurveTo(headR * 1.4, -headR * 0.1, headR * 1.35, 0);
  ctx.quadraticCurveTo(headR * 1.4, headR * 0.1, headR * 0.9, headR * 0.35);
  ctx.stroke();

  // Melo's red mark (红巾 reference)
  if (s.isPlayer) {
    ctx.save();
    ctx.shadowColor = '#c33';
    ctx.shadowBlur = 4;
    const markGrad = ctx.createRadialGradient(-headR * 0.1, 0, 0, -headR * 0.1, 0, headR * 0.25);
    markGrad.addColorStop(0, '#e44');
    markGrad.addColorStop(1, '#a22');
    ctx.fillStyle = markGrad;
    ctx.beginPath();
    ctx.arc(-headR * 0.1, 0, headR * 0.22, 0, PI2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();

  // Eyes with direction tracking, blinking, and glow
  const isBlinking = s.blinkTimer < 0.15;
  const eyeAngle = s.angle;
  const eyeOffset = headR * 0.5;
  const eyeR = headR * 0.35;
  for (const side of [-1, 1]) {
    const ex = head.x + Math.cos(eyeAngle + side * 0.5) * eyeOffset;
    const ey = head.y + Math.sin(eyeAngle + side * 0.5) * eyeOffset;

    // Eye glow
    if (!isBlinking) {
      ctx.save();
      const glowColor = isDragon ? 'rgba(255,160,0,0.35)' : stage >= 3 ? 'rgba(160,80,255,0.25)' : stage >= 2 ? 'rgba(80,160,255,0.2)' : s.isPlayer ? 'rgba(100,200,100,0.15)' : `hsla(${s.hue},50%,50%,0.1)`;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = eyeR * 3;
      ctx.fillStyle = glowColor;
      ctx.beginPath();
      ctx.arc(ex, ey, eyeR * 2, 0, PI2);
      ctx.fill();
      ctx.restore();
    }

    // Eye white with gradient
    const eyeGrad = ctx.createRadialGradient(ex - eyeR * 0.2, ey - eyeR * 0.2, 0, ex, ey, eyeR * 1.2);
    eyeGrad.addColorStop(0, isDragon ? '#fff8e0' : '#fff');
    eyeGrad.addColorStop(1, isDragon ? '#e8d8a0' : '#ddd');
    ctx.fillStyle = eyeGrad;
    ctx.beginPath();
    if (isBlinking) {
      ctx.ellipse(ex, ey, eyeR * 1.2, eyeR * 0.2, eyeAngle, 0, PI2);
    } else {
      ctx.ellipse(ex, ey, eyeR * 1.2, eyeR, eyeAngle, 0, PI2);
    }
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    if (!isBlinking) {
      // Iris (colored ring)
      const pupilOffsetX = Math.cos(eyeAngle) * eyeR * 0.35;
      const pupilOffsetY = Math.sin(eyeAngle) * eyeR * 0.35;
      const irisColor = isDragon ? '#c44' : stage >= 3 ? '#84c' : stage >= 2 ? '#48c' : s.isPlayer ? '#4a8' : `hsl(${s.hue},50%,40%)`;
      ctx.fillStyle = irisColor;
      ctx.beginPath();
      ctx.arc(ex + pupilOffsetX, ey + pupilOffsetY, eyeR * 0.6, 0, PI2);
      ctx.fill();

      // Pupil
      ctx.fillStyle = isDragon ? '#600' : '#111';
      if (stage >= 3) {
        // Slit pupil
        ctx.save();
        ctx.translate(ex + pupilOffsetX, ey + pupilOffsetY);
        ctx.rotate(eyeAngle + Math.PI / 2);
        ctx.fillRect(-eyeR * 0.12, -eyeR * 0.55, eyeR * 0.24, eyeR * 1.1);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(ex + pupilOffsetX, ey + pupilOffsetY, eyeR * 0.35, 0, PI2);
        ctx.fill();
      }
      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(
        ex - Math.cos(eyeAngle) * eyeR * 0.1 + Math.cos(eyeAngle + Math.PI / 2 * side) * eyeR * 0.15,
        ey - Math.sin(eyeAngle) * eyeR * 0.1 + Math.sin(eyeAngle + Math.PI / 2 * side) * eyeR * 0.15,
        eyeR * 0.2, 0, PI2
      );
      ctx.fill();
    }
  }

  // Horn bumps for stage 2 (small)
  if (stage === 2) {
    for (const side of [-1, 1]) {
      const hornBase = s.angle + side * 0.5;
      const hx1 = head.x + Math.cos(hornBase) * headR * 0.9;
      const hy1 = head.y + Math.sin(hornBase) * headR * 0.9;
      const hornAngle = s.angle - Math.PI * 0.6 * side;
      const hornLen = headR * 0.8;
      ctx.fillStyle = `hsl(${hue2},45%,45%)`;
      ctx.beginPath();
      ctx.moveTo(hx1, hy1);
      ctx.lineTo(
        hx1 + Math.cos(hornAngle) * hornLen,
        hy1 + Math.sin(hornAngle) * hornLen
      );
      ctx.lineTo(
        hx1 + Math.cos(hornBase + side * 0.3) * headR * 0.4,
        hy1 + Math.sin(hornBase + side * 0.3) * headR * 0.4
      );
      ctx.closePath();
      ctx.fill();
    }
  }

  // Horns (stage 3+) — enhanced with gradient
  if (stage >= 3) {
    for (const side of [-1, 1]) {
      const hornBase = s.angle + side * 0.6;
      const hx1 = head.x + Math.cos(hornBase) * headR;
      const hy1 = head.y + Math.sin(hornBase) * headR;
      const hornAngle = s.angle - Math.PI * 0.7 * side;
      const hornLen = headR * (stage >= 4 ? 2.8 : 2);

      ctx.save();
      ctx.shadowColor = isDragon ? 'rgba(200,160,60,0.3)' : `hsla(${hue2},50%,50%,0.2)`;
      ctx.shadowBlur = 4;
      ctx.strokeStyle = isDragon ? '#c8a040' : `hsl(${hue2},45%,50%)`;
      ctx.lineWidth = stage >= 4 ? 3.5 : 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hx1, hy1);
      const hx2 = hx1 + Math.cos(hornAngle) * hornLen * 0.6;
      const hy2 = hy1 + Math.sin(hornAngle) * hornLen * 0.6;
      const hx3 = hx2 + Math.cos(hornAngle - side * 0.3) * hornLen * 0.4;
      const hy3 = hy2 + Math.sin(hornAngle - side * 0.3) * hornLen * 0.4;
      ctx.quadraticCurveTo(hx2, hy2, hx3, hy3);
      ctx.stroke();

      ctx.fillStyle = isDragon ? '#e8c060' : `hsl(${hue2},35%,60%)`;
      ctx.beginPath();
      ctx.arc(hx3, hy3, 2, 0, PI2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Dragon form (stage 4) extras
  if (stage >= 4) {
    // Whiskers that wave with movement — thicker, with glow
    for (const side of [-1, 1]) {
      const wx = head.x + Math.cos(s.angle) * headR;
      const wy = head.y + Math.sin(s.angle) * headR;
      ctx.save();
      ctx.shadowColor = 'rgba(255,200,80,0.3)';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = `hsla(45,70%,60%,0.7)`;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      const wAngle = s.angle + side * 0.3 + Math.sin(gameTime * 4 + side) * 0.2;
      ctx.quadraticCurveTo(
        wx + Math.cos(wAngle) * 20,
        wy + Math.sin(wAngle) * 20,
        wx + Math.cos(wAngle + side * 0.4) * 35,
        wy + Math.sin(wAngle + side * 0.4) * 35
      );
      ctx.stroke();
      ctx.restore();
    }

    // Mane particles (flowing from behind head)
    if (Math.random() < 0.4) {
      const maneAngle = s.angle + Math.PI + rand(-0.5, 0.5);
      addParticle(
        head.x + Math.cos(maneAngle) * headR,
        head.y + Math.sin(maneAngle) * headR,
        `hsla(${rand(30, 55)},80%,${rand(55, 75)}%,0.5)`, 'trail', 1, 1.5, 0.5
      );
    }

    // Fire from mouth when boosting
    if (s.boosting) {
      const mouthX = head.x + Math.cos(s.angle) * headR * 1.5;
      const mouthY = head.y + Math.sin(s.angle) * headR * 1.5;
      addParticle(mouthX, mouthY, '#f60', 'fire', 2, 2, 0.3);
    }
  }

  // Shield visual — enhanced with glow
  if (hasShield) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,255,255,0.5)';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = 'rgba(0,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(head.x, head.y, headR * 2.5, 0, PI2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Boost afterimage
  if (s.boosting) {
    const tail = s.segs[s.segs.length - 1];
    addParticle(tail.x, tail.y, s.isPlayer ? info.color : s.color, 'spark', 1, 2, 0.2);
  }

  // ── Player indicator: pulsing arrow + "YOU" + name tag ──
  if (s.isPlayer) {
    ctx.save();
    const indY = head.y - headR - 18;
    const bobOffset = Math.sin(gameTime * 4) * 3;
    // Pulsing downward arrow
    const arrowY = indY - 12 + bobOffset;
    ctx.fillStyle = `rgba(255,220,60,${0.7 + Math.sin(gameTime * 5) * 0.2})`;
    ctx.shadowColor = 'rgba(255,200,40,0.8)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(head.x, arrowY + 8);
    ctx.lineTo(head.x - 6, arrowY);
    ctx.lineTo(head.x + 6, arrowY);
    ctx.closePath();
    ctx.fill();
    // "YOU" text
    ctx.shadowBlur = 6;
    ctx.font = 'bold 10px "Noto Serif SC"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('YOU', head.x, arrowY - 2 + bobOffset);
    ctx.restore();

    // Player name tag with colored background
    ctx.save();
    const pName = s.name;
    ctx.font = 'bold 11px "Noto Serif SC"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const nameW = ctx.measureText(pName).width + 12;
    const nameX = head.x - nameW / 2;
    const nameY = head.y - headR - 34 + bobOffset;
    // Background pill
    ctx.fillStyle = 'rgba(200,160,40,0.75)';
    ctx.shadowColor = 'rgba(255,200,60,0.5)';
    ctx.shadowBlur = 6;
    roundRect(ctx, nameX, nameY - 11, nameW, 15, 7, true);
    // Name text
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.fillText(pName, head.x, nameY + 1);
    ctx.restore();
  }

  // Name label — with subtle shadow (AI snakes)
  if (!s.isPlayer) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 3;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `${s.isBoss ? 'bold ' : ''}11px "Noto Serif SC"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(s.name, head.x, head.y - headR - 8);
    if (s.isBoss) {
      ctx.fillStyle = '#f44';
      ctx.shadowColor = 'rgba(255,0,0,0.4)';
      ctx.fillText('BOSS', head.x, head.y - headR - 20);
    }
    ctx.restore();
  }

  ctx.globalAlpha = 1;
}

function renderHUD() {
  const stage = getStage(player.segs.length);
  const info = getStageInfo(stage);

  // HUD panel background with rounded rect and subtle border
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  roundRect(ctx, 0, 0, W, 52, 0, true);
  ctx.strokeStyle = 'rgba(180,160,120,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 52);
  ctx.lineTo(W, 52);
  ctx.stroke();
  ctx.restore();

  // Left panel: score info with subtle bg
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  roundRect(ctx, 6, 4, 90, 42, 6, true);
  ctx.restore();

  ctx.fillStyle = '#eee';
  ctx.font = 'bold 15px "Noto Serif SC"';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`长 ${player.segs.length}`, 12, 22);

  ctx.fillStyle = '#ccc';
  ctx.font = '13px "Noto Serif SC"';
  ctx.fillText(`分 ${player.score}`, 12, 40);

  // Center: stage name with glow
  ctx.save();
  ctx.shadowColor = info.color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = info.color;
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px "Noto Serif SC"';
  ctx.fillText(info.name, W / 2, 20);
  ctx.restore();

  // Evolution progress bar — sleek with glow when close
  const nextThreshold = stage === 1 ? 20 : stage === 2 ? 50 : stage === 3 ? 100 : 999;
  const prevThreshold = stage === 1 ? 0 : stage === 2 ? 20 : stage === 3 ? 50 : 100;
  const progress = stage >= 4 ? 1 : (player.segs.length - prevThreshold) / (nextThreshold - prevThreshold);
  const barX = W / 2 - 45;
  const barY = 28;
  const barW2 = 90;
  const barH2 = 7;

  // Bar bg
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  roundRect(ctx, barX, barY, barW2, barH2, 3, true);
  // Bar fill with gradient
  if (progress > 0) {
    ctx.save();
    const barGrad = ctx.createLinearGradient(barX, barY, barX + barW2 * progress, barY);
    barGrad.addColorStop(0, info.color);
    barGrad.addColorStop(1, `hsla(${info.hue},70%,70%,0.9)`);
    ctx.fillStyle = barGrad;
    roundRect(ctx, barX, barY, barW2 * clamp(progress, 0, 1), barH2, 3, true);
    // Glow when close to evolution
    if (progress > 0.7 && stage < 4) {
      ctx.shadowColor = info.color;
      ctx.shadowBlur = 8 + Math.sin(gameTime * 6) * 4;
      roundRect(ctx, barX, barY, barW2 * clamp(progress, 0, 1), barH2, 3, true);
    }
    ctx.restore();
  }
  // Bar border
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 0.5;
  roundRect(ctx, barX, barY, barW2, barH2, 3, false, true);

  // Next stage label
  if (stage < 4) {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '9px "Noto Serif SC"';
    ctx.textAlign = 'center';
    ctx.fillText(`${player.segs.length}/${nextThreshold}`, W / 2, barY + barH2 + 10);
  }

  ctx.fillStyle = '#f88';
  ctx.textAlign = 'right';
  ctx.font = '13px "Noto Serif SC"';
  ctx.fillText(`击: ${player.kills}`, W - MINIMAP_R * 2 - 20, 22);

  ctx.fillStyle = '#fc0';
  ctx.fillText(`币: ${coins}`, W - MINIMAP_R * 2 - 20, 42);

  let powerY = 60;
  for (const p of player.powers) {
    ctx.fillStyle = POWER_COLORS[p.kind];
    ctx.font = 'bold 13px "Noto Serif SC"';
    ctx.textAlign = 'left';
    ctx.fillText(`${POWER_LABELS[p.kind]} ${p.remaining.toFixed(1)}s`, 12, powerY);
    powerY += 18;
  }

  if (comboCount > 3) {
    ctx.fillStyle = `rgba(255,200,50,${0.5 + Math.sin(gameTime * 8) * 0.3})`;
    ctx.font = 'bold 20px "Noto Serif SC"';
    ctx.textAlign = 'center';
    ctx.fillText(`${comboCount} 连击!`, W / 2, 75);
  }

  // Feeding frenzy indicator
  if (feedFrenzyTimer > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(255,215,0,${0.6 + Math.sin(gameTime * 10) * 0.3})`;
    ctx.font = 'bold 18px "Noto Serif SC"';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 10;
    ctx.fillText(`暴食模式 ${feedFrenzyTimer.toFixed(1)}s`, W / 2, 95);
    ctx.restore();
  }

  // Kill streak indicator
  if (killStreakCount >= 3 && killStreakTimer > 0) {
    ctx.fillStyle = `rgba(255,68,68,${0.6 + Math.sin(gameTime * 6) * 0.3})`;
    ctx.font = 'bold 16px "Noto Serif SC"';
    ctx.textAlign = 'center';
    ctx.fillText(`${killStreakCount}连杀`, W / 2, 115);
  }

  // Arena event indicator
  if (arenaEventActive) {
    ctx.save();
    const evtAlpha = 0.6 + Math.sin(gameTime * 5) * 0.3;
    ctx.fillStyle = `rgba(255,215,0,${evtAlpha})`;
    ctx.font = 'bold 16px "Noto Serif SC"';
    ctx.textAlign = 'center';
    ctx.fillText(arenaEventActive, W / 2, H - 60);
    ctx.restore();
  }

  // Evolution invincibility indicator
  if (evolInvincTimer > 0 && gameScreen === 'playing') {
    ctx.fillStyle = `rgba(255,215,0,${0.4 + Math.sin(gameTime * 12) * 0.3})`;
    ctx.font = '13px "Noto Serif SC"';
    ctx.textAlign = 'center';
    ctx.fillText(`无敌 ${evolInvincTimer.toFixed(1)}s`, W / 2, 135);
  }

  if (isMobile && gameScreen === 'playing') {
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '11px "Noto Serif SC"';
    ctx.textAlign = 'right';
    ctx.fillText('右侧点击=冲刺', W - 10, H - 20);
  }
}

function renderMinimap() {
  const mx = MINIMAP_X;
  const my = MINIMAP_Y;

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.arc(mx, my, MINIMAP_R, 0, PI2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(180,160,120,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.arc(mx, my, MINIMAP_R, 0, PI2);
  ctx.clip();

  const scale = MINIMAP_R / ARENA_R;

  ctx.strokeStyle = 'rgba(180,160,120,0.2)';
  ctx.beginPath();
  ctx.arc(mx, my, MINIMAP_R - 2, 0, PI2);
  ctx.stroke();

  for (const h of hazards) {
    ctx.fillStyle = h.kind === 'whirlpool' ? 'rgba(120,80,200,0.5)' : 'rgba(160,120,255,0.5)';
    ctx.beginPath();
    ctx.arc(mx + h.x * scale, my + h.y * scale, 2, 0, PI2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(150,200,150,0.3)';
  for (let i = 0; i < orbs.length; i += 3) {
    const o = orbs[i];
    ctx.fillRect(mx + o.x * scale - 0.5, my + o.y * scale - 0.5, 1, 1);
  }

  ctx.fillStyle = '#fff';
  for (const p of powerUps) {
    ctx.fillRect(mx + p.x * scale - 1, my + p.y * scale - 1, 2, 2);
  }

  for (const ai of aiSerpents) {
    if (!ai.alive) continue;
    ctx.fillStyle = ai.color;
    const ax = mx + ai.segs[0].x * scale;
    const ay = my + ai.segs[0].y * scale;
    ctx.beginPath();
    ctx.arc(ax, ay, ai.isBoss ? 3 : 2, 0, PI2);
    ctx.fill();
  }

  if (player.alive) {
    const px = mx + player.segs[0].x * scale;
    const py = my + player.segs[0].y * scale;
    // Pulsing glow ring on minimap
    ctx.save();
    ctx.shadowColor = 'rgba(255,200,60,0.8)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#fc0';
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, PI2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,220,80,${0.5 + Math.sin(gameTime * 4) * 0.3})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, PI2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function renderEvolutionOverlay() {
  const progress = 1 - evolutionOverlay / 1.5;
  const alpha = progress < 0.2 ? progress / 0.2 : progress > 0.75 ? (1 - progress) / 0.25 : 1;
  const info = getStageInfo(evolutionStage);
  const isGoldStage = evolutionStage >= 4;

  // Quick white flash at start
  if (progress < 0.08) {
    const flashAlpha = (1 - progress / 0.08) * 0.7;
    ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
    ctx.fillRect(0, 0, W, H);
  }

  // Semi-transparent overlay banner at top (not full darken — keep gameplay visible)
  const bannerH = 160;
  const bannerY = H / 2 - bannerH / 2;
  ctx.save();
  const bannerGrad = ctx.createLinearGradient(0, bannerY - 30, 0, bannerY + bannerH + 30);
  bannerGrad.addColorStop(0, 'rgba(0,0,0,0)');
  bannerGrad.addColorStop(0.15, `rgba(0,0,0,${alpha * 0.65})`);
  bannerGrad.addColorStop(0.5, `rgba(0,0,0,${alpha * 0.75})`);
  bannerGrad.addColorStop(0.85, `rgba(0,0,0,${alpha * 0.65})`);
  bannerGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bannerGrad;
  ctx.fillRect(0, bannerY - 30, W, bannerH + 60);
  ctx.restore();

  // Expanding ring burst (quick)
  if (progress < 0.4) {
    const ringProgress = progress / 0.4;
    const expR = ringProgress * Math.max(W, H) * 0.6;
    const ringAlpha = (1 - ringProgress) * 0.15;
    ctx.save();
    ctx.strokeStyle = isGoldStage ? `rgba(255,215,0,${ringAlpha})` : `hsla(${info.hue},60%,60%,${ringAlpha})`;
    ctx.lineWidth = 6 * (1 - ringProgress);
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, expR, 0, PI2);
    ctx.stroke();
    ctx.restore();
  }

  // Single white flash pulse
  if (progress < 0.3) {
    const flashAlpha = Math.sin(progress / 0.3 * Math.PI) * 0.25;
    if (flashAlpha > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // Evolution calligraphy — scaled entrance, with glow
  ctx.save();
  ctx.shadowColor = isGoldStage ? '#ffd700' : info.color;
  ctx.shadowBlur = 35 + Math.sin(gameTime * 8) * 10;
  ctx.fillStyle = isGoldStage ? '#ffd700' : info.color;
  ctx.globalAlpha = alpha;

  const textScale = progress < 0.2 ? 0.6 + (progress / 0.2) * 0.4 : 1;
  ctx.font = `bold ${Math.floor(52 * textScale)}px "Noto Serif SC"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(evolutionName, W / 2, H / 2 - 15);

  // Second glow layer
  ctx.shadowBlur = 50;
  ctx.globalAlpha = alpha * 0.25;
  ctx.fillText(evolutionName, W / 2, H / 2 - 15);
  ctx.restore();

  // Particles around text
  const particleCount = isGoldStage ? 4 : 2;
  for (let p = 0; p < particleCount; p++) {
    if (Math.random() < 0.7) {
      const fx = W / 2 + rand(-120, 120);
      const fy = H / 2 - 15 + rand(-30, 30);
      ctx.save();
      ctx.globalAlpha = alpha * rand(0.3, 0.7);
      ctx.fillStyle = isGoldStage
        ? `hsl(${rand(20, 50)},100%,${rand(50, 80)}%)`
        : `hsl(${rand(info.hue - 20, info.hue + 20)},80%,${rand(50, 80)}%)`;
      ctx.beginPath();
      ctx.arc(fx, fy, rand(1.5, 5), 0, PI2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Sub-info
  ctx.globalAlpha = alpha;
  const stageNames = ['', '小蛇', '蛟', '螭', '龙'];
  const stageDescs = ['', '', '水中蛟龙·万鳞初生', '无角之龙·破浪而行', '真龙现世·翻云覆雨'];
  ctx.fillStyle = `rgba(255,255,255,${alpha * 0.7})`;
  ctx.font = '18px "Noto Serif SC"';
  ctx.textAlign = 'center';
  ctx.fillText(`第${evolutionStage}阶: ${stageNames[evolutionStage]}`, W / 2, H / 2 + 35);
  ctx.font = '14px "Noto Serif SC"';
  ctx.fillStyle = `rgba(255,255,200,${alpha * 0.5})`;
  ctx.fillText(stageDescs[evolutionStage], W / 2, H / 2 + 60);

  ctx.globalAlpha = 1;
}

function renderDeathScreen() {
  // Dark overlay with vignette
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, W, H);
  const deathVig = ctx.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, W * 0.8);
  deathVig.addColorStop(0, 'rgba(0,0,0,0)');
  deathVig.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = deathVig;
  ctx.fillRect(0, 0, W, H);

  // Parchment-style stat card with shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 5;
  const cardGrad = ctx.createLinearGradient(W / 2 - 140, 130, W / 2 + 140, 520);
  cardGrad.addColorStop(0, 'rgba(35,30,25,0.92)');
  cardGrad.addColorStop(0.5, 'rgba(40,35,28,0.95)');
  cardGrad.addColorStop(1, 'rgba(30,25,20,0.92)');
  ctx.fillStyle = cardGrad;
  roundRect(ctx, W / 2 - 150, 120, 300, 400, 16, true);
  ctx.strokeStyle = 'rgba(180,150,80,0.3)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, W / 2 - 150, 120, 300, 400, 16, false, true);
  // Inner border
  ctx.strokeStyle = 'rgba(180,150,80,0.1)';
  ctx.lineWidth = 0.5;
  roundRect(ctx, W / 2 - 143, 127, 286, 386, 12, false, true);
  ctx.restore();

  // Brand
  ctx.fillStyle = 'rgba(200,160,64,0.5)';
  ctx.font = '13px "Noto Serif SC"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('麦洛的冒险：吞灵化龙', W / 2, 155);

  // Title with glow
  ctx.save();
  ctx.shadowColor = 'rgba(200,60,60,0.5)';
  ctx.shadowBlur = 15;
  ctx.fillStyle = '#c44';
  ctx.font = 'bold 36px "Noto Serif SC"';
  ctx.fillText('魂归天地', W / 2, 205);
  ctx.restore();

  // Decorative line
  ctx.strokeStyle = 'rgba(180,150,80,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 80, 220);
  ctx.lineTo(W / 2 + 80, 220);
  ctx.stroke();

  // Player name
  if (nameInputText) {
    ctx.fillStyle = 'rgba(200,180,100,0.8)';
    ctx.font = '16px "Noto Serif SC"';
    ctx.fillText(nameInputText, W / 2, 250);
  }

  const info = getStageInfo(player.stageCache);
  // Stats with proper spacing and typography
  const statsY = 285;
  const statsGap = 35;
  const statLabels = ['最终形态', '长度', '分数', '击杀', '最高分'];
  const statValues = [info.name, `${player.segs.length}`, `${player.score}`, `${player.kills}`, `${highScore}`];
  const statColors = [info.color, '#ddd', '#ddd', '#f88', '#fc0'];

  for (let i = 0; i < statLabels.length; i++) {
    const sy = statsY + i * statsGap;
    ctx.fillStyle = 'rgba(180,170,150,0.5)';
    ctx.font = '13px "Noto Serif SC"';
    ctx.textAlign = 'left';
    ctx.fillText(statLabels[i], W / 2 - 80, sy);
    ctx.fillStyle = statColors[i];
    ctx.font = 'bold 16px "Noto Serif SC"';
    ctx.textAlign = 'right';
    ctx.fillText(statValues[i], W / 2 + 80, sy);
  }

  // Coins earned
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fc0';
  ctx.font = 'bold 16px "Noto Serif SC"';
  ctx.fillText(`+${Math.floor(totalOrbsEaten / 10)} 金币`, W / 2, 485);

  // Buttons — card style with gradient
  // Retry
  ctx.save();
  const retryGrad = ctx.createLinearGradient(W / 2 - 80, 545, W / 2 + 80, 595);
  retryGrad.addColorStop(0, 'rgba(40,150,50,0.85)');
  retryGrad.addColorStop(1, 'rgba(50,180,60,0.9)');
  ctx.fillStyle = retryGrad;
  ctx.shadowColor = 'rgba(80,200,80,0.3)';
  ctx.shadowBlur = 10;
  roundRect(ctx, W / 2 - 80, 545, 160, 50, 10, true);
  ctx.strokeStyle = 'rgba(120,255,120,0.2)';
  ctx.lineWidth = 1;
  roundRect(ctx, W / 2 - 80, 545, 160, 50, 10, false, true);
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px "Noto Serif SC"';
  ctx.fillText('再来一次', W / 2, 578);

  // Home
  ctx.save();
  ctx.fillStyle = 'rgba(60,60,65,0.85)';
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 6;
  roundRect(ctx, W / 2 - 80, 615, 160, 40, 10, true);
  ctx.strokeStyle = 'rgba(150,150,150,0.2)';
  ctx.lineWidth = 1;
  roundRect(ctx, W / 2 - 80, 615, 160, 40, 10, false, true);
  ctx.restore();
  ctx.fillStyle = '#ccc';
  ctx.font = '16px "Noto Serif SC"';
  ctx.fillText('返回主页', W / 2, 642);

  // Share
  ctx.save();
  const shareGrad = ctx.createLinearGradient(W / 2 - 80, 675, W / 2 + 80, 715);
  shareGrad.addColorStop(0, 'rgba(40,90,180,0.85)');
  shareGrad.addColorStop(1, 'rgba(50,110,210,0.9)');
  ctx.fillStyle = shareGrad;
  ctx.shadowColor = 'rgba(60,120,200,0.3)';
  ctx.shadowBlur = 6;
  roundRect(ctx, W / 2 - 80, 675, 160, 40, 10, true);
  ctx.strokeStyle = 'rgba(100,160,255,0.2)';
  ctx.lineWidth = 1;
  roundRect(ctx, W / 2 - 80, 675, 160, 40, 10, false, true);
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.fillText('分享战绩', W / 2, 702);
}

function renderTitle() {
  const t = Date.now() * 0.001;

  // Rich dark gradient background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#050308');
  bgGrad.addColorStop(0.2, '#0a0810');
  bgGrad.addColorStop(0.4, '#0d0a06');
  bgGrad.addColorStop(0.6, '#0d0a08');
  bgGrad.addColorStop(0.8, '#080610');
  bgGrad.addColorStop(1, '#040206');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Flowing ink-wash cloud layers (animated bezier curves)
  ctx.save();
  for (let layer = 0; layer < 3; layer++) {
    const layerAlpha = 0.025 + layer * 0.01;
    const speed = 0.15 + layer * 0.1;
    const yBase = 100 + layer * 80;
    ctx.fillStyle = `rgba(${140 - layer * 20},${120 - layer * 15},${90 - layer * 10},${layerAlpha})`;
    ctx.beginPath();
    ctx.moveTo(-20, yBase + 60);
    for (let i = 0; i < 5; i++) {
      const x1 = i * (W / 4) + Math.sin(t * speed + i * 1.5 + layer) * 30;
      const y1 = yBase + Math.sin(t * speed * 0.7 + i * 2 + layer * 0.5) * 40 - 20;
      const x2 = (i + 0.5) * (W / 4) + Math.cos(t * speed * 0.5 + i) * 25;
      const y2 = yBase + Math.cos(t * speed * 0.9 + i * 1.3 + layer) * 35;
      ctx.quadraticCurveTo(x1, y1, x2, y2);
    }
    ctx.lineTo(W + 20, yBase + 60);
    ctx.lineTo(W + 20, yBase + 120);
    ctx.lineTo(-20, yBase + 120);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Floating particle atmosphere: dust motes, spirit orbs
  ctx.save();
  for (let i = 0; i < 30; i++) {
    const px = (Math.sin(t * 0.3 + i * 7.3) * 0.5 + 0.5) * W;
    const py = (Math.cos(t * 0.2 + i * 4.7) * 0.5 + 0.5) * H - (t * 15 + i * 40) % H;
    const pyWrapped = ((py % H) + H) % H;
    const pSize = 1 + Math.sin(t * 2 + i) * 0.5;
    const pAlpha = 0.15 + Math.sin(t * 1.5 + i * 2) * 0.1;
    // Spirit orb glow
    if (i < 8) {
      const orbGrad = ctx.createRadialGradient(px, pyWrapped, 0, px, pyWrapped, 12);
      orbGrad.addColorStop(0, `rgba(200,180,120,${pAlpha * 0.5})`);
      orbGrad.addColorStop(1, 'rgba(200,180,120,0)');
      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(px, pyWrapped, 12, 0, PI2);
      ctx.fill();
    }
    ctx.fillStyle = `rgba(200,190,160,${pAlpha})`;
    ctx.beginPath();
    ctx.arc(px, pyWrapped, pSize, 0, PI2);
    ctx.fill();
  }
  ctx.restore();

  // Stylized snake silhouette that undulates (bezier curves, gradient fill)
  ctx.save();
  const snakeGrad = ctx.createLinearGradient(W * 0.2, 180, W * 0.8, 260);
  snakeGrad.addColorStop(0, 'rgba(30,25,20,0.6)');
  snakeGrad.addColorStop(0.3, 'rgba(80,65,30,0.3)');
  snakeGrad.addColorStop(0.7, 'rgba(180,150,60,0.15)');
  snakeGrad.addColorStop(1, 'rgba(200,170,80,0.08)');
  ctx.strokeStyle = snakeGrad;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const snakeLen = 60;
  for (let i = 0; i < snakeLen; i++) {
    const frac = i / snakeLen;
    const baseAngle = frac * Math.PI * 3 + t * 0.8;
    const radiusX = 50 + frac * 90;
    const radiusY = 20 + frac * 30 + Math.sin(t * 0.5 + frac * 4) * 10;
    const sx = W / 2 + Math.cos(baseAngle) * radiusX;
    const sy = 210 + Math.sin(baseAngle) * radiusY + frac * 30;
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();
  // Snake head glow at front
  const headFrac = 0;
  const headAngle = headFrac * Math.PI * 3 + t * 0.8;
  const hsx = W / 2 + Math.cos(headAngle) * 50;
  const hsy = 210 + Math.sin(headAngle) * 20;
  const headGlow = ctx.createRadialGradient(hsx, hsy, 0, hsx, hsy, 15);
  headGlow.addColorStop(0, 'rgba(200,160,60,0.25)');
  headGlow.addColorStop(1, 'rgba(200,160,60,0)');
  ctx.fillStyle = headGlow;
  ctx.beginPath();
  ctx.arc(hsx, hsy, 15, 0, PI2);
  ctx.fill();
  ctx.restore();

  // Brand: 麦洛的冒险
  ctx.save();
  ctx.shadowColor = 'rgba(200,160,64,0.4)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = 'rgba(200,160,64,0.8)';
  ctx.font = '18px "Noto Serif SC"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('麦洛的冒险', W / 2, 310);
  ctx.restore();

  // Title: 吞灵化龙 with glow and pulsing scale
  ctx.save();
  const titleScale = 1 + Math.sin(t * 1.5) * 0.02;
  ctx.translate(W / 2, 370);
  ctx.scale(titleScale, titleScale);
  ctx.shadowColor = '#c8a040';
  ctx.shadowBlur = 30 + Math.sin(t * 2) * 10;
  ctx.fillStyle = '#c8a040';
  ctx.font = 'bold 48px "Noto Serif SC"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('吞灵化龙', 0, 0);
  // Second glow layer
  ctx.shadowBlur = 50;
  ctx.globalAlpha = 0.3;
  ctx.fillText('吞灵化龙', 0, 0);
  ctx.restore();

  ctx.fillStyle = 'rgba(200,180,100,0.5)';
  ctx.font = '14px "Noto Serif SC"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText("Melo's Quest: Dragon Ascent", W / 2, 400);

  // Player name + rename button
  if (nameInputText) {
    ctx.fillStyle = 'rgba(200,200,200,0.5)';
    ctx.font = '12px "Noto Serif SC"';
    const nameLabel = `旅行者: ${nameInputText}`;
    ctx.fillText(nameLabel, W / 2, 425);
    const nameW = ctx.measureText(nameLabel).width;
    ctx.fillStyle = 'rgba(200,160,64,0.6)';
    ctx.fillText('改名', W / 2 + nameW / 2 + 16, 425);
  }

  // Play button — card style with gradient, glow, press animation
  ctx.save();
  const btnGrad = ctx.createLinearGradient(W / 2 - 90, 440, W / 2 + 90, 500);
  btnGrad.addColorStop(0, 'rgba(40,140,50,0.9)');
  btnGrad.addColorStop(0.5, 'rgba(60,180,70,0.95)');
  btnGrad.addColorStop(1, 'rgba(40,140,50,0.9)');
  ctx.fillStyle = btnGrad;
  ctx.shadowColor = 'rgba(80,200,80,0.4)';
  ctx.shadowBlur = 12;
  roundRect(ctx, W / 2 - 90, 440, 180, 55, 12, true);
  ctx.strokeStyle = 'rgba(120,255,120,0.3)';
  ctx.lineWidth = 1;
  roundRect(ctx, W / 2 - 90, 440, 180, 55, 12, false, true);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px "Noto Serif SC"';
  ctx.fillText('开始游戏', W / 2, 475);
  ctx.restore();

  // Leaderboard button
  ctx.save();
  const lbGrad = ctx.createLinearGradient(W / 2 - 70, 520, W / 2 + 70, 560);
  lbGrad.addColorStop(0, 'rgba(50,50,120,0.8)');
  lbGrad.addColorStop(1, 'rgba(70,70,160,0.8)');
  ctx.fillStyle = lbGrad;
  ctx.shadowColor = 'rgba(100,100,200,0.3)';
  ctx.shadowBlur = 8;
  roundRect(ctx, W / 2 - 70, 520, 140, 40, 8, true);
  ctx.strokeStyle = 'rgba(140,140,220,0.3)';
  ctx.lineWidth = 1;
  roundRect(ctx, W / 2 - 70, 520, 140, 40, 8, false, true);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ddd';
  ctx.font = '16px "Noto Serif SC"';
  ctx.fillText('排行榜', W / 2, 546);
  ctx.restore();

  // Achievements button
  ctx.save();
  const achGrad = ctx.createLinearGradient(W / 2 - 70, 570, W / 2 + 70, 606);
  achGrad.addColorStop(0, 'rgba(120,90,30,0.8)');
  achGrad.addColorStop(1, 'rgba(160,120,40,0.8)');
  ctx.fillStyle = achGrad;
  ctx.shadowColor = 'rgba(200,160,60,0.3)';
  ctx.shadowBlur = 8;
  roundRect(ctx, W / 2 - 70, 570, 140, 36, 8, true);
  ctx.strokeStyle = 'rgba(220,180,80,0.3)';
  ctx.lineWidth = 1;
  roundRect(ctx, W / 2 - 70, 570, 140, 36, 8, false, true);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fc0';
  ctx.font = '15px "Noto Serif SC"';
  ctx.fillText('印章成就', W / 2, 594);
  ctx.restore();

  // High score
  ctx.fillStyle = 'rgba(200,180,100,0.7)';
  ctx.font = '14px "Noto Serif SC"';
  ctx.fillText(`最高分: ${highScore}  金币: ${coins}`, W / 2, 625);

  // Upgrades
  ctx.fillStyle = 'rgba(200,180,100,0.5)';
  ctx.font = 'bold 14px "Noto Serif SC"';
  ctx.fillText('— 永久升级 —', W / 2, 645);

  for (let i = 0; i < UPGRADE_DEFS.length; i++) {
    const u = UPGRADE_DEFS[i];
    const lvl = upgrades[u.key] || 0;
    const y = 665 + i * 46;
    const canBuy = lvl < u.maxLvl && coins >= u.cost;

    // Card-style upgrade row
    ctx.save();
    if (canBuy) {
      const upGrad = ctx.createLinearGradient(20, y - 14, W - 20, y + 24);
      upGrad.addColorStop(0, 'rgba(40,90,40,0.6)');
      upGrad.addColorStop(1, 'rgba(50,110,50,0.5)');
      ctx.fillStyle = upGrad;
    } else {
      ctx.fillStyle = 'rgba(30,30,35,0.6)';
    }
    roundRect(ctx, 20, y - 14, W - 40, 38, 6, true);
    ctx.strokeStyle = canBuy ? 'rgba(120,200,120,0.2)' : 'rgba(80,80,80,0.2)';
    ctx.lineWidth = 1;
    roundRect(ctx, 20, y - 14, W - 40, 38, 6, false, true);
    ctx.restore();

    ctx.fillStyle = canBuy ? '#cfc' : '#888';
    ctx.font = '13px "Noto Serif SC"';
    ctx.textAlign = 'left';
    ctx.fillText(`${u.name} (Lv${lvl}/${u.maxLvl})`, 30, y + 4);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#fc0';
    ctx.fillText(lvl >= u.maxLvl ? 'MAX' : `${u.cost}币`, W - 30, y + 4);
    ctx.textAlign = 'center';
  }

  // Bottom brand with atmospheric fade
  ctx.save();
  ctx.globalAlpha = 0.25 + Math.sin(t * 0.8) * 0.05;
  ctx.fillStyle = 'rgba(200,160,64,1)';
  ctx.font = '12px "Noto Serif SC"';
  ctx.fillText('麦洛的冒险 · 第四章', W / 2, H - 20);
  ctx.restore();
}

function renderCharSelect() {
  // Rich dark gradient background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#050308');
  bgGrad.addColorStop(0.5, '#0a0810');
  bgGrad.addColorStop(1, '#050306');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#c8a040';
  ctx.font = 'bold 28px "Noto Serif SC"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('选择角色', W / 2, 80);

  // Cross-game bonus indicator
  const bonus = getCrossGameBonus();
  if (bonus > 0) {
    ctx.fillStyle = '#fc0';
    ctx.font = '13px "Noto Serif SC"';
    ctx.fillText(`麦洛护照加成: +${bonus}初始长度`, W / 2, 110);
  }

  ctx.fillStyle = 'rgba(200,180,100,0.5)';
  ctx.font = '14px "Noto Serif SC"';
  ctx.fillText('点击选择角色开始游戏', W / 2, 135);

  const baseY = 250;
  for (let i = 0; i < CHARACTERS.length; i++) {
    const c = CHARACTERS[i];
    const y = baseY + i * 140;
    const selected = i === selectedChar;

    ctx.fillStyle = selected ? 'rgba(80,120,60,0.5)' : 'rgba(30,30,30,0.7)';
    ctx.strokeStyle = selected ? c.color : 'rgba(100,100,100,0.3)';
    ctx.lineWidth = 2;
    roundRect(ctx, 30, y, W - 60, 120, 10, true);
    ctx.strokeStyle = selected ? c.color : 'rgba(100,100,100,0.3)';
    roundRect(ctx, 30, y, W - 60, 120, 10, false, true);

    // Preview
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.arc(80, y + 50, 25, 0, PI2);
    ctx.fill();
    // Red mark (Melo reference)
    ctx.fillStyle = '#c33';
    ctx.beginPath();
    ctx.arc(78, y + 48, 4, 0, PI2);
    ctx.fill();
    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(85, y + 45, 5, 0, PI2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(87, y + 45, 2.5, 0, PI2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px "Noto Serif SC"';
    ctx.textAlign = 'left';
    ctx.fillText(c.name, 120, y + 35);

    ctx.fillStyle = '#aaa';
    ctx.font = '13px "Noto Serif SC"';
    ctx.fillText(c.desc, 120, y + 58);

    ctx.fillStyle = '#888';
    ctx.font = '11px "Noto Serif SC"';
    ctx.fillText(`速度x${c.speedMul} 体型x${c.sizeMul} 初始长度${c.startLen}`, 120, y + 80);

    if (selected) {
      ctx.fillStyle = c.color;
      ctx.font = 'bold 12px "Noto Serif SC"';
      ctx.fillText('已选择', 120, y + 100);
    }
  }

  // Back button
  ctx.fillStyle = 'rgba(100,100,100,0.6)';
  roundRect(ctx, W / 2 - 60, 760, 120, 40, 8, true);
  ctx.fillStyle = '#ccc';
  ctx.font = '15px "Noto Serif SC"';
  ctx.textAlign = 'center';
  ctx.fillText('返回', W / 2, 786);
}

function renderLeaderboard() {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#c8a040';
  ctx.font = 'bold 28px "Noto Serif SC"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('排行榜', W / 2, 60);

  if (leaderboard.length === 0) {
    ctx.fillStyle = '#666';
    ctx.font = '16px "Noto Serif SC"';
    ctx.fillText('暂无记录', W / 2, 200);
  } else {
    for (let i = 0; i < leaderboard.length; i++) {
      const e = leaderboard[i];
      const y = 120 + i * 55;
      const info = getStageInfo(e.stage);

      ctx.fillStyle = i === 0 ? 'rgba(200,160,60,0.15)' : 'rgba(30,30,30,0.5)';
      roundRect(ctx, 20, y - 10, W - 40, 45, 6, true);

      ctx.fillStyle = i === 0 ? '#fc0' : '#aaa';
      ctx.font = 'bold 14px "Noto Serif SC"';
      ctx.textAlign = 'left';
      ctx.fillText(`#${i + 1} ${e.name}`, 30, y + 12);

      ctx.fillStyle = info.color;
      ctx.font = '12px "Noto Serif SC"';
      ctx.fillText(info.name, 160, y + 12);

      ctx.fillStyle = '#888';
      ctx.textAlign = 'right';
      ctx.fillText(`分${e.score} 杀${e.kills}`, W - 30, y + 12);

      ctx.textAlign = 'left';
    }
  }

  ctx.fillStyle = 'rgba(100,100,100,0.6)';
  roundRect(ctx, W / 2 - 60, 760, 120, 40, 8, true);
  ctx.fillStyle = '#ccc';
  ctx.font = '15px "Noto Serif SC"';
  ctx.textAlign = 'center';
  ctx.fillText('返回', W / 2, 786);
}

function renderNameInput() {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(200,160,64,0.7)';
  ctx.font = '16px "Noto Serif SC"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('麦洛的冒险', W / 2, 200);

  ctx.fillStyle = '#c8a040';
  ctx.font = 'bold 28px "Noto Serif SC"';
  ctx.fillText('选择旅行者之名', W / 2, 280);

  ctx.fillStyle = 'rgba(200,180,100,0.5)';
  ctx.font = '14px "Noto Serif SC"';
  ctx.fillText('此名字将记录在麦洛护照中', W / 2, 320);

  // Preset name grid: 2 columns x 4 rows
  const PRESET_NAMES = ['麦洛', '山海客', '逐风者', '墨侠', '灵蛇使', '龙行者', '御风人', '自定义...'];
  const gridStartY = 350;
  const gridCols = 2;
  const cellW = 150;
  const cellH = 55;
  const gridStartX = W / 2 - cellW;

  for (let i = 0; i < PRESET_NAMES.length; i++) {
    const col = i % gridCols;
    const row = Math.floor(i / gridCols);
    const bx = gridStartX + col * cellW;
    const by = gridStartY + row * cellH;

    const isCustom = PRESET_NAMES[i] === '自定义...';
    ctx.fillStyle = isCustom ? 'rgba(150,120,50,0.6)' : 'rgba(50,50,50,0.7)';
    ctx.strokeStyle = '#c8a040';
    ctx.lineWidth = 1.5;
    roundRect(ctx, bx, by, cellW - 10, cellH - 10, 8, true);
    roundRect(ctx, bx, by, cellW - 10, cellH - 10, 8, false, true);

    ctx.fillStyle = isCustom ? '#fc0' : '#fff';
    ctx.font = isCustom ? '15px "Noto Serif SC"' : 'bold 18px "Noto Serif SC"';
    ctx.textAlign = 'center';
    ctx.fillText(PRESET_NAMES[i], bx + (cellW - 10) / 2, by + (cellH - 10) / 2 + 6);
  }
}

function renderAchievements() {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#c8a040';
  ctx.font = 'bold 28px "Noto Serif SC"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('印章成就', W / 2, 60);

  ctx.fillStyle = 'rgba(200,180,100,0.5)';
  ctx.font = '14px "Noto Serif SC"';
  ctx.fillText(`已解锁: ${unlockedAchievements.length}/${ACHIEVEMENT_DEFS.length}`, W / 2, 90);

  for (let i = 0; i < ACHIEVEMENT_DEFS.length; i++) {
    const def = ACHIEVEMENT_DEFS[i];
    const y = 130 + i * 70;
    const unlocked = unlockedAchievements.includes(def.id);

    ctx.fillStyle = unlocked ? 'rgba(150,120,40,0.3)' : 'rgba(30,30,30,0.5)';
    roundRect(ctx, 20, y, W - 40, 55, 8, true);

    if (unlocked) {
      ctx.strokeStyle = '#c8a040';
      ctx.lineWidth = 1.5;
      roundRect(ctx, 20, y, W - 40, 55, 8, false, true);
    }

    // Seal icon
    ctx.fillStyle = unlocked ? '#c8a040' : '#444';
    ctx.font = 'bold 22px "Noto Serif SC"';
    ctx.textAlign = 'center';
    ctx.fillText(unlocked ? '印' : '?', 55, y + 35);

    // Name & desc
    ctx.fillStyle = unlocked ? '#fc0' : '#888';
    ctx.font = 'bold 16px "Noto Serif SC"';
    ctx.textAlign = 'left';
    ctx.fillText(def.name, 85, y + 25);

    ctx.fillStyle = unlocked ? '#ccc' : '#666';
    ctx.font = '12px "Noto Serif SC"';
    ctx.fillText(def.desc, 85, y + 45);
  }

  ctx.fillStyle = 'rgba(100,100,100,0.6)';
  roundRect(ctx, W / 2 - 60, 760, 120, 40, 8, true);
  ctx.fillStyle = '#ccc';
  ctx.font = '15px "Noto Serif SC"';
  ctx.textAlign = 'center';
  ctx.fillText('返回', W / 2, 786);
}

function renderJoystick() {
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.arc(joystickStart.x, joystickStart.y, 50, 0, PI2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const dx = joystickCurrent.x - joystickStart.x;
  const dy = joystickCurrent.y - joystickStart.y;
  const d = Math.hypot(dx, dy);
  const maxD = 40;
  const thumbX = d > maxD
    ? joystickStart.x + dx / d * maxD
    : joystickCurrent.x;
  const thumbY = d > maxD
    ? joystickStart.y + dy / d * maxD
    : joystickCurrent.y;

  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.arc(thumbX, thumbY, 20, 0, PI2);
  ctx.fill();
}

// ─── Util: Rounded Rectangle ────────────────────────────────
function roundRect(
  c: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
  fill = false, stroke = false
) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.arcTo(x + w, y, x + w, y + r, r);
  c.lineTo(x + w, y + h - r);
  c.arcTo(x + w, y + h, x + w - r, y + h, r);
  c.lineTo(x + r, y + h);
  c.arcTo(x, y + h, x, y + h - r, r);
  c.lineTo(x, y + r);
  c.arcTo(x, y, x + r, y, r);
  c.closePath();
  if (fill) c.fill();
  if (stroke) c.stroke();
}

// ─── Game Loop ──────────────────────────────────────────────
let lastTime = 0;
function gameLoop(timestamp: number) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  update(dt);
  render();

  requestAnimationFrame(gameLoop);
}

// ─── Init ───────────────────────────────────────────────────
loadData();
dailySeed = new Date().getDate() * 1000 + new Date().getMonth();

// Show name input on first launch
if (!nameInputText) {
  const passport = getPassport();
  if (passport.playerName && passport.playerName !== '旅行者') {
    nameInputText = passport.playerName;
  } else {
    gameScreen = 'nameInput';
    nameInputActive = true;
  }
}

requestAnimationFrame(gameLoop);
