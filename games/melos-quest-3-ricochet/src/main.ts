// ============================================================================
// 麦洛的冒险：石破天惊 — Melo's Quest: Formation Breaker
// A brick-breaker roguelike with Chinese ink-wash (水墨) art style
// Part of the 麦洛的冒险 (Melo's Quest) series — Chapter 3
// ============================================================================

const W = 390, H = 844;

// --- HiDPI support ---
const PR = Math.min(window.devicePixelRatio || 1, 2);

// --- Canvas setup ---
const container = document.getElementById('game')!;
const canvas = document.createElement('canvas');
canvas.width = W * PR;
canvas.height = H * PR;
container.appendChild(canvas);
const ctx = canvas.getContext('2d')!;
ctx.scale(PR, PR);

// --- Responsive scaling ---
function resize(): void {
  const scaleX = window.innerWidth / W;
  const scaleY = window.innerHeight / H;
  const scale = Math.min(scaleX, scaleY);
  canvas.style.width = `${W * scale}px`;
  canvas.style.height = `${H * scale}px`;
}
resize();
window.addEventListener('resize', resize);

// --- Coordinate mapping ---
function canvasCoords(clientX: number, clientY: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / rect.width * W,
    y: (clientY - rect.top) / rect.height * H,
  };
}

// --- Seeded RNG ---
let rngSeed = Date.now();
function seedRng(s: number): void { rngSeed = s; }
function rng(): number {
  rngSeed = (rngSeed * 16807 + 0) % 2147483647;
  return (rngSeed - 1) / 2147483646;
}
function rngInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}
function rngPick<T>(arr: T[]): T { return arr[Math.floor(rng() * arr.length)]; }
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ============================================================================
// TYPES
// ============================================================================

type GameScreen = 'title' | 'charSelect' | 'playing' | 'upgrade' | 'death' | 'victory' | 'shop' | 'leaderboard' | 'daily' | 'nameInput';

type BrickType = 'normal' | 'tough' | 'gold' | 'explosive' | 'spirit' | 'boss';

interface Brick {
  x: number; y: number; w: number; h: number;
  type: BrickType;
  hp: number; maxHp: number;
  coins: number;
  moveDir?: number; moveSpeed?: number;
  shootTimer?: number;
  crackLevel: number;
  alive: boolean;
  flashTimer: number;
  critFlashTimer: number;
  whiteFlashTimer: number;
  // Living brick properties
  breathPhase: number;
  wobble: number;
  eyeType: number;
  fearLevel: number;
  painTimer: number;
  blinkTimer: number;
  // Regen brick properties
  regenTimer: number;
  canRegen: boolean;
  // Movement for later waves
  moveSine?: boolean;
  movePhase?: number;
  moveAmplitude?: number;
  moveBaseY?: number;
}

interface Ball {
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  speed: number;
  baseSpeed: number;
  fire: boolean;
  piercing: boolean;
  thunder: boolean;
  inkBomb: boolean;
  isSpirit: boolean;
  stuck: boolean;
  stuckOffset: number;
  active: boolean;
  comboSpeedBonus: number;
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  color: string;
  type: 'ink' | 'spark' | 'trail' | 'explosion' | 'coin' | 'inkdrip' | 'debris' | 'inksplash' | 'inkring' | 'bgwave' | 'golden' | 'firetrail' | 'electricarc' | 'inkbombtrail' | 'speedline';
  angle?: number;
  radius?: number;
  opacity?: number;
}

interface BossProjectile {
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  active: boolean;
}

interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  maxStacks: number;
}

interface ActiveUpgrade {
  id: string;
  stacks: number;
}

interface ShopItem {
  id: string;
  name: string;
  desc: string;
  cost: number;
  maxLevel: number;
}

interface CharDef {
  id: string;
  name: string;
  desc: string;
  paddleWidth: number;
  ballSpeed: number;
  lives: number;
  critChance: number;
  color: string;
}

interface LeaderEntry {
  name: string;
  score: number;
  wave: number;
  char: string;
  date: string;
  playerName: string;
}

interface FloatingText {
  x: number; y: number;
  text: string; color: string;
  timer: number; maxTimer: number;
  size?: number;
  glow?: boolean;
}

interface LightningBolt {
  x1: number; y1: number;
  x2: number; y2: number;
  life: number;
  maxLife: number;
}

interface MelosPassport {
  totalCoins: number;
  gamesPlayed: {
    '扶摇万里': number;
    '百妖长夜': number;
    '石破天惊': number;
    '吞灵化龙': number;
    '问天牌局': number;
  };
  achievements: string[];
  playerName: string;
}

interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
}

// ============================================================================
// CONSTANTS & DATA
// ============================================================================

const PADDLE_Y = H - 80;
const BALL_RADIUS = 7;
const BASE_BALL_SPEED = 7.0;
const BASE_PADDLE_W = 70;
const BASE_PADDLE_H = 14;
const BRICK_ROWS_START = 80;
const MAX_WAVES = 15;
const WALL_LEFT = 10;
const WALL_RIGHT = W - 10;
const WALL_TOP = 50;

const PENTATONIC = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3, 659.3];

// --- Achievement definitions ---
const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'wall_break', name: '破壁', desc: '通过第3波', icon: '壁' },
  { id: 'chain_15', name: '连环', desc: '达成15连击', icon: '环' },
  { id: 'thunder_5', name: '雷霆', desc: '一局中触发5次连锁爆炸', icon: '雷' },
  { id: 'no_death_wave', name: '不碎', desc: '无伤通过一波', icon: '盾' },
  { id: 'beat_15', name: '阵破', desc: '通过第15波', icon: '阵' },
];

// --- Wave names ---
const WAVE_NAMES: string[] = [
  '第一层 · 石林',
  '第二层 · 竹海',
  '第三层 · 碧潭',
  '第四层 · 金鳞阵',
  '第五层 · 守关兽',
  '第六层 · 烈焰峰',
  '第七层 · 鲲鹏展翅',
  '第八层 · 青龙出水',
  '第九层 · 白虎啸林',
  '第十层 · 墨影迷阵',
  '第十一层 · 玄武沉渊',
  '第十二层 · 凤凰涅槃',
  '第十三层 · 魔将降临',
  '第十四层 · 九幽之门',
  '第十五层 · 山海封印',
];

// --- Characters ---
const CHARACTERS: CharDef[] = [
  { id: 'melo', name: '麦洛', desc: '均衡型 · 山海旅者', paddleWidth: 0, ballSpeed: 0, lives: 3, critChance: 0, color: '#d4a574' },
  { id: 'fox', name: '灵狐', desc: '速度型 · 涂山之后', paddleWidth: -5, ballSpeed: 0.8, lives: 2, critChance: 0.1, color: '#ff8844' },
  { id: 'turtle', name: '石龟', desc: '防御型 · 玄武遗脉', paddleWidth: 15, ballSpeed: -0.3, lives: 4, critChance: 0, color: '#66aa88' },
];

// --- Upgrades pool ---
const UPGRADES: UpgradeDef[] = [
  { id: 'multiball', name: '分身弹', desc: '球分裂为2颗', icon: '◎', maxStacks: 3 },
  { id: 'fireball', name: '火焰弹', desc: '烧穿砖块不反弹', icon: '火', maxStacks: 1 },
  { id: 'thunder', name: '雷电弹', desc: '击中时链式闪电', icon: '雷', maxStacks: 2 },
  { id: 'bigpaddle', name: '阔板', desc: '板子加宽20', icon: '━', maxStacks: 3 },
  { id: 'sticky', name: '粘板', desc: '接住球可重新瞄准', icon: '◆', maxStacks: 1 },
  { id: 'shield', name: '护盾', desc: '额外一条命', icon: '盾', maxStacks: 3 },
  { id: 'slowmo', name: '缓时', desc: '球速降低15%', icon: '◑', maxStacks: 2 },
  { id: 'pierce', name: '穿透弹', desc: '球穿透砖块', icon: '穿', maxStacks: 1 },
  { id: 'inkbomb', name: '墨弹', desc: '击中时范围爆炸', icon: '●', maxStacks: 2 },
  { id: 'spirit', name: '灵伴', desc: '自动追踪辅助球', icon: '◇', maxStacks: 2 },
  { id: 'magnet', name: '磁板', desc: '球会微微偏向板子', icon: '∪', maxStacks: 2 },
  { id: 'crit', name: '暴击', desc: '15%几率3倍伤害', icon: '暴', maxStacks: 3 },
];

// --- Shop items ---
const SHOP_ITEMS: ShopItem[] = [
  { id: 'shop_paddle', name: '宽板基础', desc: '初始板子+10', cost: 50, maxLevel: 3 },
  { id: 'shop_speed', name: '弹速强化', desc: '球速+8%', cost: 60, maxLevel: 3 },
  { id: 'shop_life', name: '额外生命', desc: '初始+1命', cost: 80, maxLevel: 2 },
  { id: 'shop_coin', name: '聚财术', desc: '金币+25%', cost: 100, maxLevel: 2 },
  { id: 'shop_start', name: '起手升级', desc: '开局随机1升级', cost: 150, maxLevel: 1 },
];

// --- Name presets ---
const NAME_PRESETS = ['旅行者', '山海客', '破阵人', '墨侠', '逐风者'];

// ============================================================================
// GAME STATE
// ============================================================================

let gameScreen: GameScreen = 'title';
let selectedChar: CharDef = CHARACTERS[0];
let paddleX = W / 2;
let paddleW = BASE_PADDLE_W;
let paddleTargetX = W / 2;
let prevPaddleX = W / 2;
let balls: Ball[] = [];
let bricks: Brick[] = [];
let particles: Particle[] = [];
let bossProjectiles: BossProjectile[] = [];
let floatingTexts: FloatingText[] = [];
let lightningBolts: LightningBolt[] = [];

let score = 0;
let combo = 0;
let maxCombo = 0;
let comboTimer = 0;
let comboDisplayTimer = 0;
let wave = 1;
let lives = 3;
let totalCoins = 0;
let runCoins = 0;
let activeUpgrades: ActiveUpgrade[] = [];
let upgradeChoices: UpgradeDef[] = [];

let shakeX = 0, shakeY = 0, shakeMag = 0;
let waveTransition = 0;
let waveTransitionText = '';
let waveTransitionSubText = '';
let inkWashSweep = 0;
let launched = false;
let stickyMode = false;

// --- Freeze frame ---
let freezeFrames = 0;

// --- Paddle squash ---
let paddleSquash = 0;
let paddleSquashVel = 0;

// --- Ink drip timer ---
let inkDripTimer = 0;

// --- Screen edge flash ---
let screenEdgeFlash = 0;
let screenEdgeFlashColor = '#ffd700';

// --- Boss hit red flash ---
let bossHitFlash = 0;

// --- Achievement tracking ---
let runChainExplosions = 0;
let waveLivesStart = 0;
let newAchievements: string[] = [];

// --- Combo pulse ---
let comboPulseTimer = 0;

// --- Wukong system ---
let wukongActive = false;
let wukongTimer = 0;
let wukongStaffX = -100;
let wukongTriggered = false; // prevent re-trigger same combo

// --- Fury mode ---
let furyActive = false;
let furyTimer = 0;
let furyTriggeredCombo = 0; // last combo that triggered fury

// --- Mega cascade ---
let cascadeChainCount = 0;
let cascadeChainDisplayTimer = 0;

// --- Slow-mo last brick ---
let slowMoTimer = 0;
let slowMoFactor = 1;

// --- Perfect clear tracking ---
let waveLivesLost = false;

let frameCount = 0;
let lastTime = 0;
let dt = 1 / 60;

// --- Background wave animation ---
let bgWaveTime = 0;

// --- Persistence ---
let coins = 0;
let shopLevels: Record<string, number> = {};
let leaderboard: LeaderEntry[] = [];
let dailySeed = 0;
let isDailyRun = false;

// --- Passport ---
let passport: MelosPassport = {
  totalCoins: 0,
  gamesPlayed: { '扶摇万里': 0, '百妖长夜': 0, '石破天惊': 0, '吞灵化龙': 0, '问天牌局': 0 },
  achievements: [],
  playerName: '旅行者',
};

// --- Weekly best ---
let weeklyBest = 0;
let weeklyBestWeek = '';

// --- Name input state ---
let nameInputText = '';
let nameInputCursor = false;
let nameInputCursorTimer = 0;

// --- Input ---
let inputX = W / 2;
let inputActive = false;
let clickX = 0, clickY = 0, clicked = false;
let keysDown: Record<string, boolean> = {};

// --- Pre-rendered texture caches ---
let paperTextureCanvas: HTMLCanvasElement | null = null;
let vignetteCanvas: HTMLCanvasElement | null = null;
let stoneTexturePattern: CanvasPattern | null = null;
let bgCloudPhase = 0;

// ============================================================================
// PERSISTENCE
// ============================================================================

function getWeekKey(): string {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${weekNum}`;
}

function saveData(): void {
  try {
    localStorage.setItem('mq3_coins', String(coins));
    localStorage.setItem('mq3_shop', JSON.stringify(shopLevels));
    localStorage.setItem('mq3_leaders', JSON.stringify(leaderboard));
    localStorage.setItem('mq3_weekly_best', String(weeklyBest));
    localStorage.setItem('mq3_weekly_week', weeklyBestWeek);
    localStorage.setItem('melos_passport', JSON.stringify(passport));
  } catch (_) { /* storage full */ }
}

function loadData(): void {
  try {
    coins = parseInt(localStorage.getItem('mq3_coins') || '0', 10);
    shopLevels = JSON.parse(localStorage.getItem('mq3_shop') || '{}');
    leaderboard = JSON.parse(localStorage.getItem('mq3_leaders') || '[]');

    // Weekly best
    const storedWeek = localStorage.getItem('mq3_weekly_week') || '';
    const currentWeek = getWeekKey();
    if (storedWeek === currentWeek) {
      weeklyBest = parseInt(localStorage.getItem('mq3_weekly_best') || '0', 10);
    } else {
      weeklyBest = 0;
    }
    weeklyBestWeek = currentWeek;

    // Passport
    const passportStr = localStorage.getItem('melos_passport');
    if (passportStr) {
      const p = JSON.parse(passportStr);
      passport = {
        totalCoins: p.totalCoins || 0,
        gamesPlayed: {
          '扶摇万里': p.gamesPlayed?.['扶摇万里'] || 0,
          '百妖长夜': p.gamesPlayed?.['百妖长夜'] || 0,
          '石破天惊': p.gamesPlayed?.['石破天惊'] || 0,
          '吞灵化龙': p.gamesPlayed?.['吞灵化龙'] || 0,
          '问天牌局': p.gamesPlayed?.['问天牌局'] || 0,
        },
        achievements: p.achievements || [],
        playerName: p.playerName || '旅行者',
      };
    }
  } catch (_) {
    coins = 0; shopLevels = {}; leaderboard = [];
  }
}

function getDailySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function unlockAchievement(id: string): void {
  if (!passport.achievements.includes(id)) {
    passport.achievements.push(id);
    newAchievements.push(id);
    const def = ACHIEVEMENTS.find(a => a.id === id);
    if (def) {
      spawnFloatingText(W / 2, H / 2 - 60, `印章解锁: ${def.name}`, '#ffd700', 22, true);
    }
    saveData();
  }
}

function updatePassport(): void {
  passport.gamesPlayed['石破天惊']++;
  passport.totalCoins = (passport.totalCoins || 0) + runCoins;
  saveData();
}

// ============================================================================
// AUDIO (Procedural Web Audio API)
// ============================================================================

let audioCtx: AudioContext | null = null;

function ensureAudio(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playBounce(): void {
  try {
    const ac = ensureAudio();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    const t = ac.currentTime;
    const freq = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.linearRampToValueAtTime(freq * 0.5, t + 0.12);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.12);
    osc.start(t); osc.stop(t + 0.12);
  } catch (_) { /* */ }
}

// Combo-pitched break sound: ascending pitch with combo
function playBreakCombo(currentCombo: number): void {
  try {
    const ac = ensureAudio();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    const t = ac.currentTime;
    // Pitch increases with combo: 400Hz base, +50Hz per combo, cap 1200Hz
    const baseFreq = Math.min(400 + currentCombo * 50, 1200);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.linearRampToValueAtTime(baseFreq * 0.3, t + 0.15);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.2);
    osc.start(t); osc.stop(t + 0.2);
  } catch (_) { /* */ }
}

function playUpgradeChime(): void {
  try {
    const ac = ensureAudio();
    const notes = [523.3, 659.3, 784.0];
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      const t = ac.currentTime + i * 0.12;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.3);
      osc.start(t); osc.stop(t + 0.3);
    });
  } catch (_) { /* */ }
}

function playExplosion(): void {
  try {
    const ac = ensureAudio();
    const bufSize = ac.sampleRate * 0.2;
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const gain = ac.createGain();
    src.connect(gain); gain.connect(ac.destination);
    const t = ac.currentTime;
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.2);
    src.start(t);
  } catch (_) { /* */ }
}

function playClick(): void {
  try {
    const ac = ensureAudio();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    const t = ac.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.05);
    osc.start(t); osc.stop(t + 0.05);
  } catch (_) { /* */ }
}

function playDeath(): void {
  try {
    const ac = ensureAudio();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    const t = ac.currentTime;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.linearRampToValueAtTime(40, t + 0.8);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.8);
    osc.start(t); osc.stop(t + 0.8);
  } catch (_) { /* */ }
}

function playBossDrum(): void {
  try {
    const ac = ensureAudio();
    for (let i = 0; i < 3; i++) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      const t = ac.currentTime + i * 0.2;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, t);
      osc.frequency.linearRampToValueAtTime(40, t + 0.15);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.18);
      osc.start(t); osc.stop(t + 0.18);
    }
  } catch (_) { /* */ }
}

// Enhanced brick hit with thwack
function playBrickHitThwack(comboCount: number): void {
  try {
    const ac = ensureAudio();
    const t = ac.currentTime;
    // Pentatonic pitch based on combo
    const noteIdx = Math.min(comboCount, PENTATONIC.length - 1);
    const freq = PENTATONIC[noteIdx];
    // Tonal hit
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.linearRampToValueAtTime(freq * 0.4, t + 0.08);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.1);
    osc.start(t); osc.stop(t + 0.1);
    // Short noise thwack
    const bufSize = Math.floor(ac.sampleRate * 0.03);
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize) * 0.8;
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const g2 = ac.createGain();
    src.connect(g2); g2.connect(ac.destination);
    g2.gain.setValueAtTime(0.1, t);
    g2.gain.linearRampToValueAtTime(0, t + 0.03);
    src.start(t);
  } catch (_) { /* */ }
}

// Brick destroy crunch
function playBrickDestroyCrunch(brickType: BrickType): void {
  try {
    const ac = ensureAudio();
    const t = ac.currentTime;
    // Base crunch noise
    const bufSize = Math.floor(ac.sampleRate * 0.15);
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 1.5);
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filt = ac.createBiquadFilter();
    filt.type = 'bandpass';
    // Different filter per type
    switch (brickType) {
      case 'gold': filt.frequency.value = 3000; break;
      case 'explosive': filt.frequency.value = 800; break;
      case 'boss': filt.frequency.value = 200; break;
      case 'tough': filt.frequency.value = 600; break;
      default: filt.frequency.value = 1500; break;
    }
    filt.Q.value = 2;
    const gain = ac.createGain();
    src.connect(filt); filt.connect(gain); gain.connect(ac.destination);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.15);
    src.start(t);
    // Additional deep layer for boss/tough
    if (brickType === 'boss' || brickType === 'tough') {
      const osc = ac.createOscillator();
      const g2 = ac.createGain();
      osc.connect(g2); g2.connect(ac.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(brickType === 'boss' ? 50 : 80, t);
      osc.frequency.linearRampToValueAtTime(20, t + 0.2);
      g2.gain.setValueAtTime(0.15, t);
      g2.gain.linearRampToValueAtTime(0, t + 0.2);
      osc.start(t); osc.stop(t + 0.2);
    }
  } catch (_) { /* */ }
}

// Combo milestone celebration
function playComboMilestone(milestone: number): void {
  try {
    const ac = ensureAudio();
    const t = ac.currentTime;
    const noteCount = Math.min(Math.floor(milestone / 5), 4);
    for (let i = 0; i <= noteCount; i++) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.type = 'sine';
      const freq = PENTATONIC[Math.min(i + 2, PENTATONIC.length - 1)] * (milestone >= 20 ? 2 : 1);
      const nt = t + i * 0.08;
      osc.frequency.setValueAtTime(freq, nt);
      gain.gain.setValueAtTime(0.12, nt);
      gain.gain.linearRampToValueAtTime(0, nt + 0.25);
      osc.start(nt); osc.stop(nt + 0.25);
    }
  } catch (_) { /* */ }
}

// Ball launch whoosh
function playLaunchWhoosh(): void {
  try {
    const ac = ensureAudio();
    const t = ac.currentTime;
    const bufSize = Math.floor(ac.sampleRate * 0.15);
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin(i / bufSize * Math.PI);
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filt = ac.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(500, t);
    filt.frequency.linearRampToValueAtTime(2000, t + 0.15);
    filt.Q.value = 3;
    const gain = ac.createGain();
    src.connect(filt); filt.connect(gain); gain.connect(ac.destination);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.15);
    src.start(t);
  } catch (_) { /* */ }
}

// Paddle hit pong with position-based pitch
function playPaddlePong(hitPos: number): void {
  try {
    const ac = ensureAudio();
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.type = 'sine';
    // hitPos is -1 to 1, center = lower pitch, edges = higher
    const freq = 300 + Math.abs(hitPos) * 400;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.linearRampToValueAtTime(freq * 0.6, t + 0.1);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.1);
    osc.start(t); osc.stop(t + 0.1);
  } catch (_) { /* */ }
}

// Wukong epic drum + gong
function playWukongSound(): void {
  try {
    const ac = ensureAudio();
    const t = ac.currentTime;
    // Deep drum
    for (let i = 0; i < 3; i++) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      const nt = t + i * 0.15;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(60, nt);
      osc.frequency.linearRampToValueAtTime(30, nt + 0.12);
      gain.gain.setValueAtTime(0.3, nt);
      gain.gain.linearRampToValueAtTime(0, nt + 0.15);
      osc.start(nt); osc.stop(nt + 0.15);
    }
    // Gong: filtered noise with resonance
    const bufSize = Math.floor(ac.sampleRate * 0.8);
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = Math.sin(i * 0.02) * Math.exp(-i / bufSize * 3) * 0.5
        + (Math.random() * 2 - 1) * Math.exp(-i / bufSize * 5) * 0.3;
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filt = ac.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = 300; filt.Q.value = 10;
    const gain2 = ac.createGain();
    src.connect(filt); filt.connect(gain2); gain2.connect(ac.destination);
    const gt = t + 0.5;
    gain2.gain.setValueAtTime(0.25, gt);
    gain2.gain.linearRampToValueAtTime(0, gt + 0.8);
    src.start(gt);
    // Ascending pentatonic fanfare
    const fanfare = [523.3, 659.3, 784.0, 880.0, 1046.5];
    fanfare.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      const ft = t + 0.8 + i * 0.1;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ft);
      gain.gain.setValueAtTime(0.12, ft);
      gain.gain.linearRampToValueAtTime(0, ft + 0.3);
      osc.start(ft); osc.stop(ft + 0.3);
    });
  } catch (_) { /* */ }
}

// Chain explosion with escalating pitch
function playChainExplosionSound(chainIdx: number): void {
  try {
    const ac = ensureAudio();
    const t = ac.currentTime;
    // Base explosion noise
    const bufSize = Math.floor(ac.sampleRate * 0.2);
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const gain = ac.createGain();
    src.connect(gain); gain.connect(ac.destination);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.2);
    src.start(t);
    // Pentatonic pitch that rises with chain
    const noteIdx = Math.min(chainIdx, PENTATONIC.length - 1);
    const osc = ac.createOscillator();
    const g2 = ac.createGain();
    osc.connect(g2); g2.connect(ac.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(PENTATONIC[noteIdx], t);
    osc.frequency.linearRampToValueAtTime(PENTATONIC[noteIdx] * 0.5, t + 0.15);
    g2.gain.setValueAtTime(0.15, t);
    g2.gain.linearRampToValueAtTime(0, t + 0.15);
    osc.start(t); osc.stop(t + 0.15);
  } catch (_) { /* */ }
}

// Boss defeat massive explosion
function playBossDefeatSound(): void {
  try {
    const ac = ensureAudio();
    const t = ac.currentTime;
    // Massive explosion sequence
    for (let i = 0; i < 5; i++) {
      const bufSize = Math.floor(ac.sampleRate * 0.3);
      const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let j = 0; j < bufSize; j++) {
        data[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / bufSize, 2);
      }
      const src = ac.createBufferSource();
      src.buffer = buf;
      const gain = ac.createGain();
      src.connect(gain); gain.connect(ac.destination);
      const nt = t + i * 0.12;
      gain.gain.setValueAtTime(0.2 - i * 0.02, nt);
      gain.gain.linearRampToValueAtTime(0, nt + 0.3);
      src.start(nt);
    }
    // Descending bass
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.linearRampToValueAtTime(30, t + 1.0);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.linearRampToValueAtTime(0, t + 1.0);
    osc.start(t); osc.stop(t + 1.0);
  } catch (_) { /* */ }
}

// Near miss whoosh
function playNearMissWhoosh(): void {
  try {
    const ac = ensureAudio();
    const t = ac.currentTime;
    const bufSize = Math.floor(ac.sampleRate * 0.2);
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin(i / bufSize * Math.PI) * 0.5;
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filt = ac.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(2000, t);
    filt.frequency.linearRampToValueAtTime(400, t + 0.2);
    filt.Q.value = 5;
    const gain = ac.createGain();
    src.connect(filt); filt.connect(gain); gain.connect(ac.destination);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.2);
    src.start(t);
  } catch (_) { /* */ }
}

// Boss hit: heavy bass impact
function playBossHit(): void {
  try {
    const ac = ensureAudio();
    // Deep bass hit
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    const t = ac.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(60, t);
    osc.frequency.linearRampToValueAtTime(30, t + 0.25);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.3);
    osc.start(t); osc.stop(t + 0.3);
    // Noise layer
    const bufSize = Math.floor(ac.sampleRate * 0.15);
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 3);
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filt = ac.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 200;
    const g2 = ac.createGain();
    src.connect(filt); filt.connect(g2); g2.connect(ac.destination);
    g2.gain.setValueAtTime(0.15, t);
    g2.gain.linearRampToValueAtTime(0, t + 0.15);
    src.start(t);
  } catch (_) { /* */ }
}

function playVictory(): void {
  try {
    const ac = ensureAudio();
    // Ascending pentatonic fanfare
    const notes = [523.3, 587.3, 659.3, 784.0, 880.0, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      const t = ac.currentTime + i * 0.13;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.linearRampToValueAtTime(0.06, t + 0.2);
      gain.gain.linearRampToValueAtTime(0, t + 0.5);
      osc.start(t); osc.stop(t + 0.5);
    });
  } catch (_) { /* */ }
}

function playThunder(): void {
  try {
    const ac = ensureAudio();
    const bufSize = Math.floor(ac.sampleRate * 0.15);
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 2);
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filt = ac.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 2000;
    const gain = ac.createGain();
    src.connect(filt); filt.connect(gain); gain.connect(ac.destination);
    gain.gain.setValueAtTime(0.15, ac.currentTime);
    gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.15);
    src.start(ac.currentTime);
  } catch (_) { /* */ }
}

// ============================================================================
// LAYERED PROCEDURAL BGM
// ============================================================================

let bgmPlaying = false;
let bgmTimers: number[] = [];
let bgmNodes: (OscillatorNode | AudioBufferSourceNode)[] = [];
let bgmGainNodes: GainNode[] = [];

function startBGM(): void {
  if (bgmPlaying) return;
  try {
    const ac = ensureAudio();
    bgmPlaying = true;

    // Layer 1: Erhu-like slow pentatonic melody (sawtooth + lowpass)
    const erhuMelody = [261.6, 329.6, 392.0, 440.0, 392.0, 329.6, 293.7, 261.6];
    let erhuIndex = 0;
    function playErhuNote(): void {
      if (!bgmPlaying) return;
      try {
        const ac2 = ensureAudio();
        const osc = ac2.createOscillator();
        const filt = ac2.createBiquadFilter();
        const gain = ac2.createGain();
        osc.connect(filt); filt.connect(gain); gain.connect(ac2.destination);
        const t = ac2.currentTime;
        osc.type = 'sawtooth';
        filt.type = 'lowpass'; filt.frequency.value = 800;
        osc.frequency.setValueAtTime(erhuMelody[erhuIndex % erhuMelody.length] * 0.5, t);
        gain.gain.setValueAtTime(0.025, t);
        gain.gain.linearRampToValueAtTime(0.018, t + 0.4);
        gain.gain.linearRampToValueAtTime(0, t + 0.6);
        osc.start(t); osc.stop(t + 0.6);
        bgmNodes.push(osc);
        erhuIndex++;
      } catch (_) { /* */ }
      bgmTimers.push(window.setTimeout(playErhuNote, 600));
    }
    playErhuNote();

    // Drone
    const drone = ac.createOscillator();
    const droneGain = ac.createGain();
    drone.connect(droneGain); droneGain.connect(ac.destination);
    drone.type = 'sine';
    drone.frequency.value = 65.4;
    droneGain.gain.value = 0.015;
    drone.start();
    bgmNodes.push(drone);
    bgmGainNodes.push(droneGain);

    // Layer 2: Guzheng-like plucks at wave 5+ (random pentatonic, filtered sine)
    function playGuzhengPluck(): void {
      if (!bgmPlaying) return;
      if (wave >= 5) {
        try {
          const ac2 = ensureAudio();
          const osc = ac2.createOscillator();
          const filt = ac2.createBiquadFilter();
          const gain = ac2.createGain();
          osc.connect(filt); filt.connect(gain); gain.connect(ac2.destination);
          const t = ac2.currentTime;
          osc.type = 'sine';
          const freq = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
          osc.frequency.setValueAtTime(freq, t);
          filt.type = 'bandpass'; filt.frequency.value = freq; filt.Q.value = 5;
          gain.gain.setValueAtTime(0.06, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
          osc.start(t); osc.stop(t + 0.4);
          bgmNodes.push(osc);
        } catch (_) { /* */ }
      }
      const interval = 800 + Math.random() * 1200;
      bgmTimers.push(window.setTimeout(playGuzhengPluck, interval));
    }
    bgmTimers.push(window.setTimeout(playGuzhengPluck, 2000));

    // Layer 3: Drum rhythm at wave 10+
    function playDrumKick(): void {
      if (!bgmPlaying) return;
      if (wave >= 10) {
        try {
          const ac2 = ensureAudio();
          const osc = ac2.createOscillator();
          const gain = ac2.createGain();
          osc.connect(gain); gain.connect(ac2.destination);
          const t = ac2.currentTime;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(80, t);
          osc.frequency.linearRampToValueAtTime(40, t + 0.12);
          gain.gain.setValueAtTime(0.12, t);
          gain.gain.linearRampToValueAtTime(0, t + 0.15);
          osc.start(t); osc.stop(t + 0.15);
          bgmNodes.push(osc);
        } catch (_) { /* */ }
      }
      bgmTimers.push(window.setTimeout(playDrumKick, 800));
    }
    bgmTimers.push(window.setTimeout(playDrumKick, 3000));

    // Boss wave: intense drum + low drone handled by playBossDrum
  } catch (_) { /* */ }
}

function stopBGM(): void {
  bgmPlaying = false;
  bgmNodes.forEach(o => { try { o.stop(); } catch (_) { /* */ } });
  bgmNodes = [];
  bgmGainNodes = [];
  bgmTimers.forEach(t => clearTimeout(t));
  bgmTimers = [];
}

// ============================================================================
// DRAWING HELPERS
// ============================================================================

function generatePaperTextureCanvas(): HTMLCanvasElement {
  const offscreen = document.createElement('canvas');
  offscreen.width = W;
  offscreen.height = H;
  const offCtx = offscreen.getContext('2d')!;
  const id = offCtx.createImageData(W, H);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const px = (i / 4) % W;
    const py = Math.floor((i / 4) / W);
    // Multi-tone paper with fiber variation
    const fiber = Math.sin(px * 0.5 + py * 0.3) * 5 + Math.sin(px * 0.08 + py * 0.12) * 8;
    const v = 218 + Math.floor(Math.random() * 22) + fiber;
    const warmth = Math.sin(py / H * Math.PI) * 8; // warmer in center
    d[i] = Math.min(255, v + warmth);
    d[i + 1] = Math.min(255, v - 6 + warmth * 0.5);
    d[i + 2] = Math.min(255, v - 18);
    d[i + 3] = 255;
  }
  offCtx.putImageData(id, 0, 0);
  // Add subtle stain blotches
  for (let s = 0; s < 8; s++) {
    const sx = Math.random() * W;
    const sy = Math.random() * H;
    const sr = 30 + Math.random() * 80;
    const stain = offCtx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    stain.addColorStop(0, `rgba(${160 + Math.random() * 40},${140 + Math.random() * 30},${100 + Math.random() * 20},0.06)`);
    stain.addColorStop(1, 'rgba(180,160,120,0)');
    offCtx.fillStyle = stain;
    offCtx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  }
  return offscreen;
}

function generateVignetteCanvas(): HTMLCanvasElement {
  const offscreen = document.createElement('canvas');
  offscreen.width = W;
  offscreen.height = H;
  const offCtx = offscreen.getContext('2d')!;
  // Stronger vignette with corner emphasis
  const grd = offCtx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, Math.max(W, H) * 0.7);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(0.5, 'rgba(0,0,0,0.05)');
  grd.addColorStop(0.8, 'rgba(0,0,0,0.2)');
  grd.addColorStop(1, 'rgba(0,0,0,0.45)');
  offCtx.fillStyle = grd;
  offCtx.fillRect(0, 0, W, H);
  // Extra corner darkening
  const corners = [[0, 0], [W, 0], [0, H], [W, H]];
  for (const [cx, cy] of corners) {
    const cg = offCtx.createRadialGradient(cx, cy, 0, cx, cy, 200);
    cg.addColorStop(0, 'rgba(0,0,0,0.15)');
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    offCtx.fillStyle = cg;
    offCtx.fillRect(0, 0, W, H);
  }
  return offscreen;
}

function generateStoneTexturePattern(): CanvasPattern | null {
  const tile = document.createElement('canvas');
  tile.width = 16;
  tile.height = 16;
  const tc = tile.getContext('2d')!;
  const id = tc.createImageData(16, 16);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = 128 + Math.floor(Math.random() * 40) - 20;
    d[i] = n; d[i + 1] = n; d[i + 2] = n; d[i + 3] = 30;
  }
  tc.putImageData(id, 0, 0);
  return ctx.createPattern(tile, 'repeat');
}

function drawPaperBg(): void {
  if (!paperTextureCanvas) paperTextureCanvas = generatePaperTextureCanvas();
  if (!vignetteCanvas) vignetteCanvas = generateVignetteCanvas();
  if (!stoneTexturePattern) stoneTexturePattern = generateStoneTexturePattern();
  ctx.drawImage(paperTextureCanvas, 0, 0);

  // Animated ink waves in background
  drawBackgroundWaves();

  // Animated ink-wash clouds drifting across (very subtle)
  drawInkWashClouds();

  ctx.drawImage(vignetteCanvas, 0, 0);

  // Combo atmospheric pulse
  if (gameScreen === 'playing' && combo >= 10 && comboDisplayTimer > 0) {
    const intensity = Math.min((combo - 10) / 20, 1);
    const pulse = Math.sin(frameCount * 0.08) * 0.5 + 0.5;
    ctx.save();
    const radGlow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 300);
    const alpha = intensity * pulse * 0.08;
    if (combo >= 20) {
      radGlow.addColorStop(0, `rgba(255,215,0,${alpha})`);
    } else {
      radGlow.addColorStop(0, `rgba(255,136,68,${alpha})`);
    }
    radGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = radGlow;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

function drawBackgroundWaves(): void {
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    // Gradient stroke per wave line
    const yBase = 150 + i * 160;
    ctx.strokeStyle = `rgba(26,26,46,${0.3 + i * 0.12})`;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 4) {
      const y = yBase + Math.sin((x * 0.01) + bgWaveTime * 0.5 + i * 1.5) * 20
        + Math.sin((x * 0.02) + bgWaveTime * 0.3 + i * 0.8) * 10;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawInkWashClouds(): void {
  bgCloudPhase += 0.003;
  ctx.save();
  for (let c = 0; c < 3; c++) {
    const cx = ((bgCloudPhase * (40 + c * 15) + c * 180) % (W + 200)) - 100;
    const cy = 120 + c * 260 + Math.sin(bgCloudPhase * 0.7 + c * 2) * 30;
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 80 + c * 20);
    cg.addColorStop(0, `rgba(30,25,45,${0.025 + c * 0.005})`);
    cg.addColorStop(0.6, `rgba(30,25,45,${0.01})`);
    cg.addColorStop(1, 'rgba(30,25,45,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(cx - 120, cy - 100, 240, 200);
  }
  ctx.restore();
}

function drawInkText(text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center', bold = false): void {
  ctx.save();
  ctx.font = `${bold ? '900' : '700'} ${size}px 'Noto Serif SC', serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  // Drop shadow (deeper for larger text)
  const shadowDist = size > 20 ? 2 : 1;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillText(text, x + shadowDist, y + shadowDist + 1);
  // Main text
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawButton(x: number, y: number, w: number, h: number, text: string, bg: string, textColor = '#f0e6d0'): boolean {
  ctx.save();

  // Drop shadow
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 3;

  // Gradient fill
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  // Parse bg to create lighter/darker variants
  grad.addColorStop(0, lightenColor(bg, 25));
  grad.addColorStop(0.4, bg);
  grad.addColorStop(1, darkenColor(bg, 20));
  ctx.fillStyle = grad;
  ctx.beginPath();
  roundRect(x, y, w, h, 8);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Inner highlight at top
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  roundRect(x + 2, y + 1, w - 4, h * 0.4, 6);
  ctx.fill();
  ctx.restore();

  // Border with slight gradient
  const borderGrad = ctx.createLinearGradient(x, y, x, y + h);
  borderGrad.addColorStop(0, 'rgba(255,255,255,0.15)');
  borderGrad.addColorStop(0.5, '#2a1f14');
  borderGrad.addColorStop(1, '#1a0f04');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  roundRect(x, y, w, h, 8);
  ctx.stroke();

  drawInkText(text, x + w / 2, y + h / 2, Math.min(h * 0.45, 18), textColor);
  ctx.restore();

  if (clicked && clickX >= x && clickX <= x + w && clickY >= y && clickY <= y + h) {
    playClick();
    return true;
  }
  return false;
}

// Color utility helpers
function lightenColor(hex: string, amount: number): string {
  const c = hexToRgb(hex);
  return `rgb(${Math.min(255, c.r + amount)},${Math.min(255, c.g + amount)},${Math.min(255, c.b + amount)})`;
}

function darkenColor(hex: string, amount: number): string {
  const c = hexToRgb(hex);
  return `rgb(${Math.max(0, c.r - amount)},${Math.max(0, c.g - amount)},${Math.max(0, c.b - amount)})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16) };
  }
  return { r: parseInt(h.substring(0, 2), 16), g: parseInt(h.substring(2, 4), 16), b: parseInt(h.substring(4, 6), 16) };
}

function roundRect(x: number, y: number, w: number, h: number, r: number): void {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ============================================================================
// PARTICLES
// ============================================================================

// Brick-type specific colors for particles
function getBrickParticleColors(type: BrickType): string[] {
  switch (type) {
    case 'normal': return ['#1a1a2e', '#2a2a3a', '#333355', '#0a0a1e'];
    case 'tough': return ['#4a3828', '#6b5030', '#3a2a1a', '#8b6020'];
    case 'gold': return ['#ffd700', '#ffaa00', '#cc8800', '#ffe066'];
    case 'explosive': return ['#ff4444', '#ff8800', '#ffcc00', '#ff2200'];
    case 'spirit': return ['#2a4a5a', '#4488cc', '#88ccee', '#336688'];
    case 'boss': return ['#ff4466', '#cc2244', '#880022', '#ff6688'];
  }
}

function spawnInkSplat(x: number, y: number, count: number, color = '#1a1a2e'): void {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 30 + Math.random() * 30,
      maxLife: 60,
      size: 2 + Math.random() * 5,
      color,
      type: 'ink',
    });
  }
}

// TRIPLED particle break with brick-type colors
function spawnBrickBreak(x: number, y: number, brickType: BrickType): void {
  const colors = getBrickParticleColors(brickType);
  // Ink bomb: 24 ink particles
  for (let i = 0; i < 24; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 5;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 25 + Math.random() * 35,
      maxLife: 60,
      size: 2 + Math.random() * 7,
      color: colors[Math.floor(Math.random() * colors.length)],
      type: 'ink',
    });
  }
  // Debris chunks: 12
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 4;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      life: 25 + Math.random() * 25,
      maxLife: 50,
      size: 2 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      type: 'debris',
    });
  }
  // Ink ring
  spawnInkRing(x, y);
}

function spawnTrail(x: number, y: number, color = 'rgba(30,30,50,0.8)'): void {
  particles.push({
    x: x + (Math.random() - 0.5) * 3,
    y: y + (Math.random() - 0.5) * 3,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    life: 20 + Math.random() * 15,
    maxLife: 35,
    size: 3 + Math.random() * 4,
    color,
    type: 'trail',
    opacity: 0.7,
  });
}

function spawnExplosion(x: number, y: number): void {
  for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 6;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 20 + Math.random() * 25,
      maxLife: 45,
      size: 3 + Math.random() * 8,
      color: ['#ff4444', '#ff8800', '#ffcc00', '#1a1a2e', '#ff2200', '#ffaa00'][Math.floor(Math.random() * 6)],
      type: 'explosion',
    });
  }
}

function spawnDebris(x: number, y: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 4;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      life: 25 + Math.random() * 25,
      maxLife: 50,
      size: 2 + Math.random() * 4,
      color: rngPick(['#3a2a1a', '#5a4a3a', '#2a1a0a', '#6b4020']),
      type: 'debris',
    });
  }
}

function spawnInkRing(x: number, y: number): void {
  particles.push({
    x, y,
    vx: 0, vy: 0,
    life: 30,
    maxLife: 30,
    size: 5,
    color: '#1a1a2e',
    type: 'inkring',
    radius: 5,
  });
}

function spawnInkSplash(x: number, y: number): void {
  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 7;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 20 + Math.random() * 25,
      maxLife: 45,
      size: 3 + Math.random() * 9,
      color: rngPick(['#1a1a2e', '#2a2a4e', '#0a0a1e', '#333355', '#111133']),
      type: 'inksplash',
    });
  }
}

function spawnCoinParticle(x: number, y: number): void {
  particles.push({
    x, y,
    vx: (Math.random() - 0.5) * 2,
    vy: -2 - Math.random() * 2,
    life: 40,
    maxLife: 40,
    size: 8,
    color: '#ffd700',
    type: 'coin',
  });
}

function spawnInkDrip(x: number, y: number): void {
  particles.push({
    x: x + (Math.random() - 0.5) * 6,
    y,
    vx: (Math.random() - 0.5) * 0.3,
    vy: 0.5 + Math.random() * 1.5,
    life: 40 + Math.random() * 30,
    maxLife: 70,
    size: 1.5 + Math.random() * 2.5,
    color: rngPick(['#2a1a0a', '#3a2a1a', '#1a1010']),
    type: 'inkdrip',
  });
}

// Paddle fast-move drips
function spawnPaddleDrips(x: number, y: number, count: number): void {
  for (let i = 0; i < count; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * 10,
      y,
      vx: (Math.random() - 0.5) * 0.5,
      vy: 0.3 + Math.random() * 1.0,
      life: 25 + Math.random() * 20,
      maxLife: 45,
      size: 1 + Math.random() * 2,
      color: rngPick(['#2a1a0a', '#3a2a1a', '#1a1010', '#4a3a2a']),
      type: 'inkdrip',
    });
  }
}

function spawnFloatingText(x: number, y: number, text: string, color: string, size?: number, glow?: boolean): void {
  floatingTexts.push({ x, y, text, color, timer: 50, maxTimer: 50, size, glow });
}

function addLightningBolt(x1: number, y1: number, x2: number, y2: number): void {
  lightningBolts.push({ x1, y1, x2, y2, life: 15, maxLife: 15 });
}

function updateParticles(): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.96;
    p.vy *= 0.96;
    if (p.type === 'coin') p.vy += 0.1;
    if (p.type === 'inkdrip' || p.type === 'inkbombtrail') { p.vy += 0.05; p.vx *= 0.9; }
    if (p.type === 'debris') p.vy += 0.08;
    if (p.type === 'golden') { p.vy += 0.02; p.vx *= 0.98; }
    if (p.type === 'firetrail') { p.vy -= 0.05; p.size *= 0.97; }
    if (p.type === 'inkring' && p.radius !== undefined) {
      p.radius += 2.5;
    }
    p.life--;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }

  // Update lightning bolts
  for (let i = lightningBolts.length - 1; i >= 0; i--) {
    lightningBolts[i].life--;
    if (lightningBolts[i].life <= 0) lightningBolts.splice(i, 1);
  }
}

function drawParticles(): void {
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife) * (p.opacity ?? 1);
    ctx.save();
    ctx.globalAlpha = alpha;

    if (p.type === 'coin') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#aa8800';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha * 0.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'inkring' && p.radius !== undefined) {
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6 * alpha;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3 * alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (p.type === 'debris') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.life * 0.2);
      const ds = p.size * alpha;
      // Gradient-filled debris chunk
      const debrisGrad = ctx.createLinearGradient(-ds / 2, -ds / 2, ds / 2, ds / 2);
      debrisGrad.addColorStop(0, lightenColor(p.color, 30));
      debrisGrad.addColorStop(1, p.color);
      ctx.fillStyle = debrisGrad;
      ctx.fillRect(-ds / 2, -ds / 2, ds, ds * 0.6);
      // Highlight edge
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(-ds / 2, -ds / 2, ds, ds * 0.15);
      ctx.restore();
    } else if (p.type === 'golden') {
      ctx.fillStyle = p.color;
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (p.type === 'firetrail') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      // Inner glow
      ctx.fillStyle = '#ffcc00';
      ctx.globalAlpha = alpha * 0.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha * 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'electricarc') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size * alpha;
      ctx.shadowColor = '#4488ff';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + (Math.random() - 0.5) * 10, p.y + (Math.random() - 0.5) * 10);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (p.type === 'speedline' && p.angle !== undefined) {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size * alpha;
      ctx.beginPath();
      const len = 8;
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - Math.cos(p.angle) * len, p.y - Math.sin(p.angle) * len);
      ctx.stroke();
    } else if (p.type === 'inkbombtrail') {
      ctx.fillStyle = p.color;
      // Drip shape: elongated
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.size * alpha * 0.6, p.size * alpha, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Draw lightning bolts
  for (const bolt of lightningBolts) {
    const alpha = bolt.life / bolt.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#88bbff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#4488ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(bolt.x1, bolt.y1);
    const dx = bolt.x2 - bolt.x1;
    const dy = bolt.y2 - bolt.y1;
    const segments = 5;
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const jx = (Math.random() - 0.5) * 20;
      const jy = (Math.random() - 0.5) * 20;
      ctx.lineTo(bolt.x1 + dx * t + jx, bolt.y1 + dy * t + jy);
    }
    ctx.lineTo(bolt.x2, bolt.y2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// ============================================================================
// GAME LOGIC
// ============================================================================

function getUpgradeStacks(id: string): number {
  const u = activeUpgrades.find(u => u.id === id);
  return u ? u.stacks : 0;
}

function getEffectivePaddleW(): number {
  let w = BASE_PADDLE_W + selectedChar.paddleWidth;
  w += getUpgradeStacks('bigpaddle') * 20;
  w += (shopLevels['shop_paddle'] || 0) * 10;
  return w;
}

function getEffectiveBallSpeed(): number {
  let s = BASE_BALL_SPEED + selectedChar.ballSpeed;
  s += (shopLevels['shop_speed'] || 0) * 0.4;
  s *= (1 - getUpgradeStacks('slowmo') * 0.15);
  return s;
}

function getCritChance(): number {
  return selectedChar.critChance + getUpgradeStacks('crit') * 0.15;
}

function getCoinMultiplier(): number {
  return 1 + (shopLevels['shop_coin'] || 0) * 0.25;
}

function createBall(x: number, y: number, vx: number, vy: number, isSpirit = false): Ball {
  const speed = getEffectiveBallSpeed();
  return {
    x, y, vx, vy,
    radius: BALL_RADIUS,
    speed,
    baseSpeed: speed,
    fire: getUpgradeStacks('fireball') > 0,
    piercing: getUpgradeStacks('pierce') > 0,
    thunder: getUpgradeStacks('thunder') > 0,
    inkBomb: getUpgradeStacks('inkbomb') > 0,
    isSpirit,
    stuck: false,
    stuckOffset: 0,
    active: true,
    comboSpeedBonus: 0,
  };
}

function launchBall(): void {
  if (launched) return;
  launched = true;
  const b = balls[0];
  if (b) {
    b.stuck = false;
    b.vx = (Math.random() - 0.5) * 2;
    b.vy = -b.speed;
    const mag = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    b.vx = (b.vx / mag) * b.speed;
    b.vy = (b.vy / mag) * b.speed;
    playLaunchWhoosh();
  }
}

function resetBallOnPaddle(): void {
  launched = false;
  balls = [createBall(paddleX, PADDLE_Y - BALL_RADIUS - BASE_PADDLE_H / 2 - 2, 0, 0)];
  balls[0].stuck = true;
  balls[0].stuckOffset = 0;

  // Spirit companions
  const spiritCount = getUpgradeStacks('spirit');
  for (let i = 0; i < spiritCount; i++) {
    const sb = createBall(paddleX + (i + 1) * 25, PADDLE_Y - 50, 0, 0, true);
    sb.stuck = true;
    sb.stuckOffset = (i + 1) * 25;
    balls.push(sb);
  }
}

// ============================================================================
// WAVE LAYOUT DESIGN
// ============================================================================

function generateWave(waveNum: number): void {
  bricks = [];
  bossProjectiles = [];

  const brickW = 38;
  const brickH = 18;
  const cols = 8;
  const startX = (W - cols * (brickW + 4)) / 2 + 2;
  const startY = BRICK_ROWS_START;

  const hasBoss = waveNum % 5 === 0;

  function addBrick(r: number, c: number, type: BrickType, extraHp = 0): void {
    const x = startX + c * (brickW + 4);
    const y = startY + r * (brickH + 4);

    let hp = 1;
    if (type === 'tough') hp = 2 + Math.floor(waveNum / 5) + extraHp;
    if (type === 'explosive') hp = 1;
    if (type === 'boss') hp = 10 + waveNum * 3;

    // Determine if brick should have regen (tough bricks in later waves)
    const shouldRegen = type === 'tough' && waveNum >= 6 && rng() < 0.25;

    const brick: Brick = {
      x, y, w: brickW, h: brickH,
      type, hp, maxHp: hp,
      coins: type === 'gold' ? rngInt(3, 6) : 0,
      crackLevel: 0,
      alive: true,
      flashTimer: 0,
      critFlashTimer: 0,
      whiteFlashTimer: 0,
      // Living brick
      breathPhase: rng() * Math.PI * 2,
      wobble: 0,
      eyeType: Math.floor(rng() * 4),
      fearLevel: 0,
      painTimer: 0,
      blinkTimer: 60 + Math.floor(rng() * 120),
      // Regen
      regenTimer: shouldRegen ? 300 : 0, // 5 seconds at 60fps
      canRegen: shouldRegen,
    };

    if (type === 'spirit') {
      brick.moveDir = rng() > 0.5 ? 1 : -1;
      brick.moveSpeed = 0.5 + rng() * 0.5;
    }

    // Moving bricks in later waves (30% of non-boss bricks in wave 8+)
    if (waveNum >= 8 && type !== 'boss' && type !== 'spirit' && rng() < 0.30) {
      brick.moveSine = true;
      brick.movePhase = rng() * Math.PI * 2;
      brick.moveAmplitude = 15 + rng() * 20;
      brick.moveBaseY = y;
    }

    bricks.push(brick);
  }

  function addBrickAbs(x: number, y: number, w: number, h: number, type: BrickType): void {
    const hp = type === 'boss' ? 10 + waveNum * 3 : 1;
    const brick: Brick = {
      x, y, w, h,
      type, hp, maxHp: hp,
      coins: type === 'gold' ? rngInt(3, 6) : (type === 'boss' ? 10 + waveNum : 0),
      crackLevel: 0,
      alive: true,
      flashTimer: 0,
      critFlashTimer: 0,
      whiteFlashTimer: 0,
      shootTimer: type === 'boss' ? 120 : undefined,
      breathPhase: rng() * Math.PI * 2,
      wobble: 0,
      eyeType: type === 'boss' ? 3 : Math.floor(rng() * 4),
      fearLevel: 0,
      painTimer: 0,
      blinkTimer: 60 + Math.floor(rng() * 120),
      regenTimer: 0,
      canRegen: false,
    };
    bricks.push(brick);
  }

  if (waveNum <= 3) {
    const rows = waveNum + 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let type: BrickType = 'normal';
        if (waveNum >= 2 && rng() < 0.1) type = 'gold';
        if (waveNum >= 3 && rng() < 0.08) type = 'tough';
            if (waveNum >= 3 && rng() < 0.08) type = 'explosive';
        addBrick(r, c, type);
      }
    }
  } else if (waveNum <= 6) {
    if (waveNum === 4) {
      const pattern = [
        [0,0,0,1,1,0,0,0],
        [0,0,1,1,1,1,0,0],
        [0,1,1,1,1,1,1,0],
        [1,1,1,1,1,1,1,1],
        [0,1,1,1,1,1,1,0],
        [0,0,1,1,1,1,0,0],
        [0,0,0,1,1,0,0,0],
      ];
      for (let r = 0; r < pattern.length; r++) {
        for (let c = 0; c < cols; c++) {
          if (pattern[r][c]) {
            const type: BrickType = rng() < 0.1 ? 'gold' : rng() < 0.15 ? 'explosive' : 'normal';
            addBrick(r, c, type);
          }
        }
      }
    } else if (waveNum === 5) {
      const pattern = [
        [0,0,0,1,1,0,0,0],
        [0,0,1,0,0,1,0,0],
        [0,1,0,0,0,0,1,0],
        [1,1,1,1,1,1,1,1],
      ];
      for (let r = 0; r < pattern.length; r++) {
        for (let c = 0; c < cols; c++) {
          if (pattern[r][c]) {
            const type: BrickType = rng() < 0.12 ? 'tough' : rng() < 0.15 ? 'explosive' : 'normal';
            addBrick(r, c, type);
          }
        }
      }
      const bossY = startY + 5 * (brickH + 4);
      addBrickAbs(W / 2 - 50, bossY, 100, 35, 'boss');
      playBossDrum();
    } else {
      const pattern = [
        [1,1,1,1,1,1,1,1],
        [0,1,1,1,1,1,1,0],
        [0,0,1,1,1,1,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,1,0,0,1,0,0],
        [0,1,0,0,0,0,1,0],
      ];
      for (let r = 0; r < pattern.length; r++) {
        for (let c = 0; c < cols; c++) {
          if (pattern[r][c]) {
            let type: BrickType = 'normal';
            if (rng() < 0.15) type = 'explosive';
            else if (rng() < 0.12) type = 'tough';
            else if (rng() < 0.08) type = 'gold';
            addBrick(r, c, type);
          }
        }
      }
    }
  } else if (waveNum <= 9) {
    if (waveNum === 7) {
      const pattern = [
        [0,0,0,1,1,0,0,0],
        [0,0,1,1,1,1,0,0],
        [0,1,1,1,1,1,1,0],
        [1,1,0,1,1,0,1,1],
        [1,0,0,1,1,0,0,1],
        [0,0,0,0,0,0,0,0],
        [0,1,0,0,0,0,1,0],
      ];
      for (let r = 0; r < pattern.length; r++) {
        for (let c = 0; c < cols; c++) {
          if (pattern[r][c]) {
            let type: BrickType = 'normal';
            if (r === 0 || r === 1) type = 'tough';
            else if (rng() < 0.1) type = 'spirit';
            else if (rng() < 0.08) type = 'explosive';
            addBrick(r, c, type);
          }
        }
      }
    } else if (waveNum === 8) {
      const pattern = [
        [0,1,1,0,0,0,1,0],
        [1,1,1,1,0,1,1,0],
        [0,1,1,1,1,1,0,0],
        [0,0,1,1,1,0,0,0],
        [0,0,0,1,1,1,0,0],
        [0,0,1,1,1,1,1,0],
        [0,1,1,0,0,1,1,1],
      ];
      for (let r = 0; r < pattern.length; r++) {
        for (let c = 0; c < cols; c++) {
          if (pattern[r][c]) {
            let type: BrickType = 'normal';
            if (rng() < 0.15) type = 'tough';
            else if (rng() < 0.12) type = 'spirit';
            else if (rng() < 0.08) type = 'gold';
            addBrick(r, c, type);
          }
        }
      }
    } else {
      const pattern = [
        [1,0,0,0,0,0,0,1],
        [1,1,0,0,0,0,1,1],
        [0,1,1,1,1,1,1,0],
        [0,1,1,1,1,1,1,0],
        [0,0,1,1,1,1,0,0],
        [0,1,0,1,1,0,1,0],
        [1,0,0,0,0,0,0,1],
      ];
      for (let r = 0; r < pattern.length; r++) {
        for (let c = 0; c < cols; c++) {
          if (pattern[r][c]) {
            let type: BrickType = 'normal';
            if (rng() < 0.18) type = 'tough';
            else if (rng() < 0.1) type = 'explosive';
            else if (rng() < 0.08) type = 'spirit';
            addBrick(r, c, type);
          }
        }
      }
    }
  } else if (waveNum <= 12) {
    if (waveNum === 10) {
      const pattern = [
        [1,1,1,1,1,1,1,1],
        [1,0,0,0,0,0,0,1],
        [1,0,1,1,1,1,0,1],
        [1,0,1,0,0,1,0,1],
        [1,0,0,0,0,0,0,1],
        [1,1,1,1,1,1,1,1],
      ];
      for (let r = 0; r < pattern.length; r++) {
        for (let c = 0; c < cols; c++) {
          if (pattern[r][c]) {
            let type: BrickType = 'normal';
            if (r === 0 || r === 5 || c === 0 || c === 7) type = 'tough';
            else if (rng() < 0.15) type = 'spirit';
            else if (rng() < 0.1) type = 'explosive';
            addBrick(r, c, type);
          }
        }
      }
      const bossY = startY + 7 * (brickH + 4);
      addBrickAbs(W / 2 - 50, bossY, 100, 35, 'boss');
      playBossDrum();
    } else if (waveNum === 11) {
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < cols; c++) {
          if ((r + c) % 2 === 0) {
            let type: BrickType = 'normal';
            if (r < 2) type = 'spirit';
            else if (rng() < 0.15) type = 'explosive';
            else if (rng() < 0.1) type = 'tough';
            addBrick(r, c, type);
          }
        }
      }
    } else {
      const pattern = [
        [0,0,1,1,1,1,0,0],
        [0,1,1,1,1,1,1,0],
        [1,1,0,1,1,0,1,1],
        [1,1,1,1,1,1,1,1],
        [0,1,1,0,0,1,1,0],
        [1,0,1,0,0,1,0,1],
        [0,0,0,1,1,0,0,0],
      ];
      for (let r = 0; r < pattern.length; r++) {
        for (let c = 0; c < cols; c++) {
          if (pattern[r][c]) {
            let type: BrickType = 'normal';
            if (rng() < 0.2) type = 'tough';
            else if (rng() < 0.15) type = 'spirit';
            else if (rng() < 0.1) type = 'explosive';
            else if (rng() < 0.08) type = 'gold';
            addBrick(r, c, type);
          }
        }
      }
    }
  } else if (waveNum <= 14) {
    if (waveNum === 13) {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < cols; c++) {
          let type: BrickType = 'tough';
          if (rng() < 0.2) type = 'explosive';
          else if (rng() < 0.15) type = 'spirit';
          else if (rng() < 0.1) type = 'gold';
          addBrick(r, c, type);
        }
      }
    } else {
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < cols; c++) {
          if (r === 0 || r === 5 || c % 3 === 0) {
            let type: BrickType = 'tough';
            if (rng() < 0.15) type = 'explosive';
            else if (rng() < 0.1) type = 'spirit';
            addBrick(r, c, type);
          }
        }
      }
    }
  } else {
    const pattern = [
      [0,0,1,1,1,1,0,0],
      [0,1,0,0,0,0,1,0],
      [1,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,1],
      [0,1,0,0,0,0,1,0],
      [0,0,1,1,1,1,0,0],
    ];
    for (let r = 0; r < pattern.length; r++) {
      for (let c = 0; c < cols; c++) {
        if (pattern[r][c]) {
          let type: BrickType = 'tough';
          if (rng() < 0.2) type = 'explosive';
          else if (rng() < 0.15) type = 'spirit';
          addBrick(r, c, type);
        }
      }
    }
    const bossY = startY + 2 * (brickH + 4) + 10;
    addBrickAbs(W / 2 - 60, bossY, 120, 40, 'boss');
    addBrick(2, 3, 'gold');
    addBrick(2, 4, 'gold');
    addBrick(3, 3, 'gold');
    addBrick(3, 4, 'gold');
    playBossDrum();
  }

  if (hasBoss && !bricks.some(b => b.type === 'boss')) {
    const rows = bricks.length > 0 ? Math.max(...bricks.map(b => Math.floor((b.y - startY) / (brickH + 4)))) + 1 : 4;
    const bossY = startY + (rows + 1) * (brickH + 4);
    addBrickAbs(W / 2 - 50, bossY, 100, 35, 'boss');
    playBossDrum();
  }
}

// --- Chain explosion tracking ---
let chainSize = 0;

function damageBrick(brick: Brick, dmg: number, ball: Ball): void {
  const isCrit = Math.random() < getCritChance();
  // Fury mode: +1 damage
  const furyBonus = furyActive ? 1 : 0;
  const finalDmg = (isCrit ? dmg * 3 : dmg) + furyBonus;
  brick.hp -= finalDmg;
  brick.flashTimer = 6;
  brick.whiteFlashTimer = 2;
  brick.crackLevel = Math.max(0, 1 - brick.hp / brick.maxHp);
  brick.wobble = 8; // trigger wobble animation
  brick.painTimer = 10;

  if (isCrit) {
    brick.critFlashTimer = 10;
    spawnFloatingText(brick.x + brick.w / 2, brick.y, '暴!', '#ff2222', 20, true);
    spawnInkSplat(brick.x + brick.w / 2, brick.y + brick.h / 2, 8, '#ff4444');
    shakeMag = Math.max(shakeMag, 5);
  }

  // Play enhanced hit sound
  playBrickHitThwack(combo);

  // Screen shake scaled by brick type
  if (brick.type === 'normal') shakeMag = Math.max(shakeMag, 2);
  else if (brick.type === 'tough') shakeMag = Math.max(shakeMag, 4);
  else if (brick.type === 'boss') {
    shakeMag = Math.max(shakeMag, 12);
    playBossHit();
    bossHitFlash = 8;
  }

  combo++;
  if (combo > maxCombo) maxCombo = combo;
  comboTimer = 120;
  comboDisplayTimer = 60;
  if (combo > 5) comboPulseTimer = 20;
  score += 10 * combo * (isCrit ? 3 : 1);

  // Combo milestones: 5, 10, 15, 20
  if (combo === 5 || combo === 10 || combo === 15 || combo === 20) {
    playComboMilestone(combo);
    const milestoneTexts: Record<number, string> = {
      5: '连击!', 10: '大连击!', 15: '超级连击!', 20: '极限连击!'
    };
    spawnFloatingText(W / 2, H / 2 - 40, milestoneTexts[combo] || '', '#ffd700', 24 + combo, true);
  }

  // Fury mode trigger: combo >= 15
  if (combo >= 15 && !furyActive && combo !== furyTriggeredCombo) {
    furyActive = true;
    furyTimer = 300; // 5 seconds at 60fps
    furyTriggeredCombo = combo;
    screenEdgeFlash = 15;
    screenEdgeFlashColor = '#ff2222';
    spawnFloatingText(W / 2, H / 2, '怒意!', '#ff0000', 36, true);
    // Boost ball speed
    for (const b of balls) {
      if (!b.isSpirit) {
        b.speed = b.baseSpeed * 1.3;
      }
    }
  }

  // Combo speed boost on ball: 2% per combo hit, cap at 30%
  if (!ball.isSpirit) {
    ball.comboSpeedBonus = Math.min(combo * 0.02, 0.30);
    ball.speed = ball.baseSpeed * (1 + ball.comboSpeedBonus) * (furyActive ? 1.3 : 1);
  }

  // Combo 10+ gold edge flash, 20+ ink ripples
  if (combo >= 10) {
    screenEdgeFlash = 8;
    screenEdgeFlashColor = furyActive ? '#ff2222' : '#ffd700';
  }
  if (combo >= 20) {
    // Ink ripples from hit point
    spawnInkRing(brick.x + brick.w / 2, brick.y + brick.h / 2);
    spawnInkSplash(brick.x + brick.w / 2, brick.y + brick.h / 2);
  }

  // Wukong check: 3% chance when combo reaches 20+
  if (combo >= 20 && !wukongActive && !wukongTriggered && Math.random() < 0.03) {
    triggerWukong();
  }

  // Achievement: 15 combo
  if (combo >= 15) unlockAchievement('chain_15');

  if (brick.hp <= 0) {
    brick.alive = false;
    playBrickDestroyCrunch(brick.type);

    // Enhanced brick break particles - more for boss
    const bx = brick.x + brick.w / 2;
    const by = brick.y + brick.h / 2;
    spawnBrickBreak(bx, by, brick.type);
    if (brick.type === 'boss') {
      // 30+ extra fragments for boss
      spawnDebris(bx, by, 30);
      spawnExplosion(bx, by);
      spawnInkSplash(bx, by);
    }

    // Freeze frame: every brick kill = 2 frames, every 5th combo = 4, boss = 15
    if (brick.type === 'boss') {
      freezeFrames = Math.max(freezeFrames, 15);
    } else if (combo % 5 === 0) {
      freezeFrames = Math.max(freezeFrames, 4);
    } else {
      freezeFrames = Math.max(freezeFrames, 2);
    }

    // Slow-mo on last brick
    const remainingBricks = bricks.filter(b => b.alive && b !== brick);
    if (remainingBricks.length === 1) {
      slowMoTimer = 30; // 0.5 seconds worth of frames
      slowMoFactor = 0.3;
    }

    if (brick.type === 'gold') {
      const c = Math.ceil(brick.coins * getCoinMultiplier());
      runCoins += c;
      spawnCoinParticle(bx, by);
      spawnFloatingText(bx, brick.y, `+${c}`, '#ffd700');
    }

    if (brick.type === 'explosive') {
      cascadeChainCount++;
      chainSize++;
      runChainExplosions++;
      if (runChainExplosions >= 5) unlockAchievement('thunder_5');
      playChainExplosionSound(cascadeChainCount);
      spawnExplosion(bx, by);
      spawnInkRing(bx, by);
      spawnDebris(bx, by, 12);

      // Mega cascade: radius increases by 20% per chain
      const baseRadius = 80;
      const cascadeRadius = baseRadius * Math.pow(1.2, cascadeChainCount - 1);
      shakeMag = Math.max(shakeMag, 8 + cascadeChainCount * 4);
      freezeFrames = Math.max(freezeFrames, 6);

      // Chain counter display
      cascadeChainDisplayTimer = 60;
      if (cascadeChainCount >= 2) {
        const chainSize2 = Math.min(20 + cascadeChainCount * 4, 48);
        spawnFloatingText(bx, by - 20, `连爆 x${cascadeChainCount}!`, '#ff4400', chainSize2, true);
      }

      // Chain 5+: violent screen shake, bg flash
      if (cascadeChainCount >= 5) {
        shakeMag = Math.max(shakeMag, 20);
        screenEdgeFlash = 15;
        screenEdgeFlashColor = '#ff4400';
      }

      // Chain 8+: all remaining bricks take 1 damage
      if (cascadeChainCount >= 8) {
        spawnFloatingText(W / 2, H / 2, '天崩地裂!', '#ff0000', 40, true);
        shakeMag = Math.max(shakeMag, 30);
        for (const b of bricks) {
          if (b.alive && b !== brick) {
            b.hp -= 1;
            b.flashTimer = 6;
            b.wobble = 10;
            b.crackLevel = Math.max(0, 1 - b.hp / b.maxHp);
            if (b.hp <= 0) {
              b.alive = false;
              spawnBrickBreak(b.x + b.w / 2, b.y + b.h / 2, b.type);
            }
          }
        }
      }

      // Damage all bricks in expanded radius
      for (const b of bricks) {
        if (b.alive && b !== brick) {
          const bdx = b.x + b.w / 2 - bx;
          const bdy = b.y + b.h / 2 - by;
          const dist = Math.hypot(bdx, bdy);
          if (dist < cascadeRadius) {
            addLightningBolt(bx, by, b.x + b.w / 2, b.y + b.h / 2);
            damageBrick(b, 2, ball);
          }
        }
      }
    }

    if (brick.type === 'boss') {
      score += 500;
      shakeMag = 12;
      freezeFrames = Math.max(freezeFrames, 15);
      playBossDefeatSound();
      spawnFloatingText(bx, brick.y, '击破!', '#ffcc00', 24, true);
      const c = Math.ceil(brick.coins * getCoinMultiplier());
      runCoins += c;
    }

    // Thunder chain
    if (ball.thunder) {
      playThunder();
      let thunderChainCount = getUpgradeStacks('thunder') + 1;
      const nearby = bricks.filter(b => b.alive && b !== brick)
        .sort((a, b2) =>
          Math.hypot(a.x - brick.x, a.y - brick.y) - Math.hypot(b2.x - brick.x, b2.y - brick.y));
      for (let i = 0; i < Math.min(thunderChainCount, nearby.length); i++) {
        const target = nearby[i];
        addLightningBolt(bx, by, target.x + target.w / 2, target.y + target.h / 2);
        damageBrick(target, 1, ball);
        spawnInkSplat(target.x + target.w / 2, target.y + target.h / 2, 4, '#4488ff');
      }
    }

    // Ink bomb area
    if (ball.inkBomb) {
      const bombRadius = 40 + getUpgradeStacks('inkbomb') * 15;
      spawnInkSplat(bx, by, 15, '#333355');
      for (const b of bricks) {
        if (b.alive && b !== brick) {
          const dist = Math.hypot(b.x + b.w / 2 - bx, b.y + b.h / 2 - by);
          if (dist < bombRadius) {
            damageBrick(b, 1, ball);
          }
        }
      }
    }
  }
}

// --- Wukong system ---
function triggerWukong(): void {
  wukongActive = true;
  wukongTimer = 90; // 1.5 seconds animation
  wukongStaffX = -100;
  wukongTriggered = true;
  playWukongSound();
  shakeMag = Math.max(shakeMag, 15);
  freezeFrames = Math.max(freezeFrames, 30); // dramatic freeze

  // Golden particles everywhere
  for (let i = 0; i < 60; i++) {
    particles.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6,
      life: 40 + Math.random() * 40,
      maxLife: 80,
      size: 3 + Math.random() * 6,
      color: ['#ffd700', '#ffaa00', '#ffcc44', '#fff'][Math.floor(Math.random() * 4)],
      type: 'golden',
    });
  }

  // Damage all bricks 50% of their max HP
  for (const b of bricks) {
    if (b.alive) {
      const dmg = Math.ceil(b.maxHp * 0.5);
      b.hp -= dmg;
      b.flashTimer = 10;
      b.wobble = 15;
      b.crackLevel = Math.max(0, 1 - b.hp / b.maxHp);
      spawnInkSplat(b.x + b.w / 2, b.y + b.h / 2, 5, '#ffd700');
      if (b.hp <= 0) {
        b.alive = false;
        spawnBrickBreak(b.x + b.w / 2, b.y + b.h / 2, b.type);
        score += 50;
      }
    }
  }

  spawnFloatingText(W / 2, H / 2 - 80, '齐天大圣!', '#ffd700', 42, true);
}

function checkBallBrickCollision(ball: Ball): boolean {
  let hitAny = false;
  for (const brick of bricks) {
    if (!brick.alive) continue;

    const closestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
    const closestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
    const distX = ball.x - closestX;
    const distY = ball.y - closestY;
    const dist = Math.sqrt(distX * distX + distY * distY);

    if (dist < ball.radius) {
      hitAny = true;
      chainSize = 0;
      damageBrick(brick, 1, ball);

      if (!ball.fire && !ball.piercing) {
        const overlapX = ball.radius - Math.abs(distX);
        const overlapY = ball.radius - Math.abs(distY);
        if (overlapX < overlapY) {
          ball.vx = -ball.vx;
          ball.x += distX > 0 ? overlapX : -overlapX;
        } else {
          ball.vy = -ball.vy;
          ball.y += distY > 0 ? overlapY : -overlapY;
        }
      }

      if (!ball.piercing && !ball.fire) break;
    }
  }
  return hitAny;
}

function updateBalls(): void {
  const pw = getEffectivePaddleW();

  for (const ball of balls) {
    if (!ball.active) continue;

    if (ball.stuck) {
      if (ball.isSpirit) {
        ball.x = paddleX + ball.stuckOffset;
        ball.y = PADDLE_Y - 40;
      } else {
        ball.x = paddleX + ball.stuckOffset;
        ball.y = PADDLE_Y - BALL_RADIUS - BASE_PADDLE_H / 2 - 2;
      }
      continue;
    }

    // Spirit ball auto-aim
    if (ball.isSpirit) {
      const nearest = bricks.filter(b => b.alive)
        .sort((a, b) =>
          Math.hypot(a.x + a.w / 2 - ball.x, a.y + a.h / 2 - ball.y) -
          Math.hypot(b.x + b.w / 2 - ball.x, b.y + b.h / 2 - ball.y))[0];
      if (nearest) {
        const tx = nearest.x + nearest.w / 2;
        const ty = nearest.y + nearest.h / 2;
        const angle = Math.atan2(ty - ball.y, tx - ball.x);
        ball.vx += Math.cos(angle) * 0.15;
        ball.vy += Math.sin(angle) * 0.15;
        const mag = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        const targetSpeed = ball.speed * 0.8;
        ball.vx = (ball.vx / mag) * targetSpeed;
        ball.vy = (ball.vy / mag) * targetSpeed;
      }
    }

    // Magnet: curve toward paddle
    if (getUpgradeStacks('magnet') > 0 && ball.vy > 0) {
      const magStr = getUpgradeStacks('magnet') * 0.05;
      const dx = paddleX - ball.x;
      ball.vx += Math.sign(dx) * magStr;
    }

    // Move (with slow-mo factor)
    const sloMo = slowMoTimer > 0 ? slowMoFactor : 1;
    const steps = 3;
    const svx = ball.vx / steps * sloMo;
    const svy = ball.vy / steps * sloMo;

    for (let s = 0; s < steps; s++) {
      ball.x += svx;
      ball.y += svy;

      // Wall collisions
      if (ball.x - ball.radius < WALL_LEFT) {
        ball.x = WALL_LEFT + ball.radius;
        ball.vx = Math.abs(ball.vx);
        playBounce();
      }
      if (ball.x + ball.radius > WALL_RIGHT) {
        ball.x = WALL_RIGHT - ball.radius;
        ball.vx = -Math.abs(ball.vx);
        playBounce();
      }
      if (ball.y - ball.radius < WALL_TOP) {
        ball.y = WALL_TOP + ball.radius;
        ball.vy = Math.abs(ball.vy);
        playBounce();
      }

      // Paddle collision
      if (ball.vy > 0 &&
        ball.y + ball.radius >= PADDLE_Y - BASE_PADDLE_H / 2 &&
        ball.y + ball.radius <= PADDLE_Y + BASE_PADDLE_H / 2 + 10 &&
        ball.x >= paddleX - pw / 2 - ball.radius &&
        ball.x <= paddleX + pw / 2 + ball.radius) {

        paddleSquash = 0.2;
        paddleSquashVel = 0;

        // Reset combo speed bonus on paddle hit
        ball.comboSpeedBonus = 0;
        ball.speed = ball.baseSpeed;

        if (stickyMode && getUpgradeStacks('sticky') > 0 && !ball.isSpirit) {
          ball.stuck = true;
          ball.stuckOffset = ball.x - paddleX;
          ball.vx = 0; ball.vy = 0;
          launched = false;
          break;
        }

        const hitPos = (ball.x - paddleX) / (pw / 2);
        const angle = hitPos * (Math.PI / 3);
        const speed = ball.speed;
        ball.vx = Math.sin(angle) * speed;
        ball.vy = -Math.cos(angle) * speed;
        ball.y = PADDLE_Y - BASE_PADDLE_H / 2 - ball.radius;
        playPaddlePong(hitPos);
        stickyMode = true;

        // Near miss detection: ball was very close to falling off
        if (ball.y > PADDLE_Y - BASE_PADDLE_H && (Math.abs(ball.x - paddleX) > pw / 2 * 0.8)) {
          playNearMissWhoosh();
          spawnFloatingText(ball.x, PADDLE_Y - 30, '险!', '#ff8844', 18, true);
        }
      }

      // Brick collisions
      checkBallBrickCollision(ball);
    }

    // Enhanced ball trails based on type
    if (frameCount % 1 === 0) {
      if (ball.fire) {
        // Fire trail - bright orange/red particles
        particles.push({
          x: ball.x + (Math.random() - 0.5) * 6,
          y: ball.y + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2 + 1,
          life: 15 + Math.random() * 10,
          maxLife: 25,
          size: 3 + Math.random() * 5,
          color: ['#ff4400', '#ff8800', '#ffcc00', '#ff2200'][Math.floor(Math.random() * 4)],
          type: 'firetrail',
          opacity: 0.8,
        });
      } else if (ball.thunder) {
        // Electric arcs
        particles.push({
          x: ball.x + (Math.random() - 0.5) * 10,
          y: ball.y + (Math.random() - 0.5) * 10,
          vx: (Math.random() - 0.5) * 3,
          vy: (Math.random() - 0.5) * 3,
          life: 8 + Math.random() * 8,
          maxLife: 16,
          size: 1 + Math.random() * 3,
          color: '#88bbff',
          type: 'electricarc',
          opacity: 0.9,
        });
      } else if (ball.inkBomb) {
        // Ink drip trail
        particles.push({
          x: ball.x + (Math.random() - 0.5) * 4,
          y: ball.y,
          vx: (Math.random() - 0.5) * 0.5,
          vy: 1 + Math.random() * 2,
          life: 20 + Math.random() * 15,
          maxLife: 35,
          size: 2 + Math.random() * 4,
          color: '#1a1a3e',
          type: 'inkbombtrail',
          opacity: 0.7,
        });
      } else if (!ball.isSpirit) {
        // Normal ball: speed lines at high speed
        const ballSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        if (ballSpeed > ball.baseSpeed * 1.1) {
          particles.push({
            x: ball.x - ball.vx * 0.5,
            y: ball.y - ball.vy * 0.5,
            vx: -ball.vx * 0.1,
            vy: -ball.vy * 0.1,
            life: 10 + Math.random() * 8,
            maxLife: 18,
            size: 1 + Math.random() * 2,
            color: 'rgba(30,30,50,0.6)',
            type: 'speedline',
            opacity: 0.6,
            angle: Math.atan2(ball.vy, ball.vx),
          });
        }
        spawnTrail(ball.x, ball.y, 'rgba(30,30,50,0.8)');
      } else {
        spawnTrail(ball.x, ball.y, 'rgba(100,160,200,0.5)');
      }
    }

    // Normalize speed
    const mag = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (mag > 0 && !ball.stuck) {
      const targetSpeed = ball.speed;
      ball.vx = (ball.vx / mag) * targetSpeed;
      ball.vy = (ball.vy / mag) * targetSpeed;
    }

    // Ball fell off bottom
    if (ball.y > H + 20) {
      ball.active = false;
    }
  }

  balls = balls.filter(b => b.active);

  if (balls.length === 0 && launched) {
    lives--;
    waveLivesLost = true;
    shakeMag = 6;
    if (lives <= 0) {
      playDeath();
      endRun(false);
    } else {
      resetBallOnPaddle();
    }
  }
}

function updateBricks(): void {
  // Find nearest ball for fear calculation
  let nearestBallX = W / 2, nearestBallY = H / 2;
  let minBallDist = 9999;
  for (const ball of balls) {
    if (!ball.active || ball.stuck) continue;
    for (const brick of bricks) {
      if (!brick.alive) continue;
      const d = Math.hypot(ball.x - brick.x - brick.w / 2, ball.y - brick.y - brick.h / 2);
      if (d < minBallDist) {
        nearestBallX = ball.x;
        nearestBallY = ball.y;
        minBallDist = d;
      }
    }
  }

  for (const brick of bricks) {
    if (!brick.alive) continue;

    // Living brick: breath animation
    brick.breathPhase += 0.05;

    // Wobble decay
    if (brick.wobble > 0) {
      brick.wobble *= 0.85;
      if (brick.wobble < 0.3) brick.wobble = 0;
    }

    // Pain timer decay
    if (brick.painTimer > 0) brick.painTimer--;

    // Blink timer
    brick.blinkTimer--;
    if (brick.blinkTimer <= 0) {
      brick.blinkTimer = 60 + Math.floor(Math.random() * 180);
    }

    // Fear: increases as ball approaches
    const distToBall = Math.hypot(nearestBallX - brick.x - brick.w / 2, nearestBallY - brick.y - brick.h / 2);
    const targetFear = distToBall < 100 ? (1 - distToBall / 100) : 0;
    brick.fearLevel += (targetFear - brick.fearLevel) * 0.1;

    // Regen: heal 1 HP every 5 seconds
    if (brick.canRegen && brick.hp < brick.maxHp) {
      brick.regenTimer--;
      if (brick.regenTimer <= 0) {
        brick.regenTimer = 300;
        brick.hp = Math.min(brick.hp + 1, brick.maxHp);
        brick.crackLevel = Math.max(0, 1 - brick.hp / brick.maxHp);
        // Green pulse visual
        spawnInkSplat(brick.x + brick.w / 2, brick.y + brick.h / 2, 3, '#44ff44');
      }
    }

    // Sine wave movement for later-wave bricks
    if (brick.moveSine && brick.movePhase !== undefined && brick.moveAmplitude !== undefined && brick.moveBaseY !== undefined) {
      brick.movePhase += 0.03;
      brick.y = brick.moveBaseY + Math.sin(brick.movePhase) * brick.moveAmplitude;
    }

    if (brick.type === 'spirit' && brick.moveDir !== undefined && brick.moveSpeed !== undefined) {
      brick.x += brick.moveDir * brick.moveSpeed;
      if (brick.x < WALL_LEFT || brick.x + brick.w > WALL_RIGHT) {
        brick.moveDir *= -1;
      }
    }

    if (brick.type === 'boss' && brick.shootTimer !== undefined) {
      brick.shootTimer--;
      if (brick.shootTimer <= 0) {
        brick.shootTimer = 90 + Math.floor(Math.random() * 60);
        const angle = Math.atan2(PADDLE_Y - brick.y - brick.h, paddleX - brick.x - brick.w / 2);
        bossProjectiles.push({
          x: brick.x + brick.w / 2,
          y: brick.y + brick.h,
          vx: Math.cos(angle) * 3,
          vy: Math.sin(angle) * 3,
          radius: 5,
          active: true,
        });
      }
    }

    if (brick.flashTimer > 0) brick.flashTimer--;
    if (brick.critFlashTimer > 0) brick.critFlashTimer--;
    if (brick.whiteFlashTimer > 0) brick.whiteFlashTimer--;
  }

  for (const proj of bossProjectiles) {
    if (!proj.active) continue;
    proj.x += proj.vx;
    proj.y += proj.vy;

    const pw = getEffectivePaddleW();
    if (proj.y + proj.radius >= PADDLE_Y - BASE_PADDLE_H / 2 &&
      proj.y - proj.radius <= PADDLE_Y + BASE_PADDLE_H / 2 &&
      proj.x >= paddleX - pw / 2 && proj.x <= paddleX + pw / 2) {
      proj.active = false;
      lives--;
      shakeMag = 6;
      spawnInkSplat(proj.x, proj.y, 8, '#ff4444');
      if (lives <= 0) {
        playDeath();
        endRun(false);
      }
    }

    if (proj.y > H + 20 || proj.x < 0 || proj.x > W) {
      proj.active = false;
    }
  }
  bossProjectiles = bossProjectiles.filter(p => p.active);
}

function checkWaveComplete(): void {
  if (gameScreen !== 'playing') return;
  if (waveTransition > 0) return;

  const remaining = bricks.filter(b => b.alive);
  if (remaining.length === 0) {
    // Achievement: no death wave
    const noLivesLost = lives >= waveLivesStart;
    if (noLivesLost) {
      unlockAchievement('no_death_wave');
    }
    // Achievement: wave 3
    if (wave >= 3) unlockAchievement('wall_break');
    // Achievement: wave 15
    if (wave >= 15) unlockAchievement('beat_15');

    // Perfect clear bonus
    if (noLivesLost) {
      runCoins += 50;
      spawnFloatingText(W / 2, H / 2 - 20, '完美破阵!', '#ffd700', 30, true);
      spawnFloatingText(W / 2, H / 2 + 20, '+50金币', '#ffd700', 18, true);
      // Spawn golden celebration particles
      for (let i = 0; i < 30; i++) {
        particles.push({
          x: W / 2 + (Math.random() - 0.5) * 200,
          y: H / 2 + (Math.random() - 0.5) * 100,
          vx: (Math.random() - 0.5) * 5,
          vy: (Math.random() - 0.5) * 5,
          life: 30 + Math.random() * 30,
          maxLife: 60,
          size: 3 + Math.random() * 5,
          color: ['#ffd700', '#ffaa00', '#fff'][Math.floor(Math.random() * 3)],
          type: 'golden',
        });
      }
      // Wukong chance on perfect clear
      if (!wukongActive && !wukongTriggered && Math.random() < 0.03) {
        triggerWukong();
      }
    }

    // Reset cascade chain counter
    cascadeChainCount = 0;

    if (wave >= MAX_WAVES) {
      playVictory();
      endRun(true);
    } else {
      prepareUpgradeChoices();
      gameScreen = 'upgrade';
      playUpgradeChime();
    }
  }
}

function prepareUpgradeChoices(): void {
  const available = UPGRADES.filter(u => {
    const stacks = getUpgradeStacks(u.id);
    return stacks < u.maxStacks;
  });
  upgradeChoices = shuffle(available).slice(0, 3);
  if (upgradeChoices.length === 0) upgradeChoices = shuffle([...UPGRADES]).slice(0, 3);
}

function applyUpgrade(upg: UpgradeDef): void {
  const existing = activeUpgrades.find(u => u.id === upg.id);
  if (existing) {
    existing.stacks++;
  } else {
    activeUpgrades.push({ id: upg.id, stacks: 1 });
  }

  if (upg.id === 'multiball') {
    const newBalls: Ball[] = [];
    for (const b of balls) {
      if (!b.isSpirit) {
        spawnInkSplash(b.x, b.y);
        const nb = createBall(b.x, b.y, -b.vx + (Math.random() - 0.5), b.vy, false);
        nb.stuck = b.stuck;
        newBalls.push(nb);
      }
    }
    balls.push(...newBalls);
  }

  if (upg.id === 'shield') {
    lives++;
  }

  if (upg.id === 'spirit') {
    const sb = createBall(paddleX + 30, PADDLE_Y - 50, (Math.random() - 0.5) * 3, -3, true);
    balls.push(sb);
  }

  for (const b of balls) {
    b.baseSpeed = getEffectiveBallSpeed();
    b.speed = b.baseSpeed * (1 + b.comboSpeedBonus);
    b.fire = getUpgradeStacks('fireball') > 0;
    b.piercing = getUpgradeStacks('pierce') > 0;
    b.thunder = getUpgradeStacks('thunder') > 0;
    b.inkBomb = getUpgradeStacks('inkbomb') > 0;
  }

  paddleW = getEffectivePaddleW();
}

function startRun(charDef: CharDef, daily = false): void {
  selectedChar = charDef;
  isDailyRun = daily;
  if (daily) {
    dailySeed = getDailySeed();
    seedRng(dailySeed);
  } else {
    seedRng(Date.now());
  }

  score = 0;
  combo = 0;
  maxCombo = 0;
  comboTimer = 0;
  comboDisplayTimer = 0;
  wave = 1;
  runCoins = 0;
  activeUpgrades = [];
  particles = [];
  floatingTexts = [];
  lightningBolts = [];
  bossProjectiles = [];
  freezeFrames = 0;
  paddleSquash = 0;
  paddleSquashVel = 0;
  runChainExplosions = 0;
  newAchievements = [];
  screenEdgeFlash = 0;
  bossHitFlash = 0;
  wukongActive = false;
  wukongTimer = 0;
  wukongTriggered = false;
  furyActive = false;
  furyTimer = 0;
  furyTriggeredCombo = 0;
  cascadeChainCount = 0;
  cascadeChainDisplayTimer = 0;
  slowMoTimer = 0;
  slowMoFactor = 1;
  waveLivesLost = false;

  lives = charDef.lives + (shopLevels['shop_life'] || 0);
  waveLivesStart = lives;
  paddleW = getEffectivePaddleW();
  paddleX = W / 2;
  paddleTargetX = W / 2;
  prevPaddleX = W / 2;

  if ((shopLevels['shop_start'] || 0) > 0) {
    const randUpg = rngPick(UPGRADES);
    applyUpgrade(randUpg);
    spawnFloatingText(W / 2, H / 2, `起手: ${randUpg.name}`, '#ffcc00');
  }

  generateWave(wave);
  resetBallOnPaddle();
  stickyMode = true;
  launched = false;
  gameScreen = 'playing';
  startBGM();
}

function endRun(victory: boolean): void {
  stopBGM();
  coins += runCoins;
  totalCoins += runCoins;

  // Update weekly best
  if (score > weeklyBest) {
    weeklyBest = score;
    weeklyBestWeek = getWeekKey();
  }

  const entry: LeaderEntry = {
    name: selectedChar.name,
    score,
    wave,
    char: selectedChar.id,
    date: new Date().toLocaleDateString('zh-CN'),
    playerName: passport.playerName,
  };
  leaderboard.push(entry);
  leaderboard.sort((a, b) => b.score - a.score);
  leaderboard = leaderboard.slice(0, 10);

  updatePassport();
  saveData();
  gameScreen = victory ? 'victory' : 'death';

  // On first game over, prompt for player name
  if (passport.playerName === '旅行者') {
    setTimeout(() => {
      changePlayerName();
    }, 800);
  }
}

function nextWave(): void {
  waveLivesStart = lives;
  wukongTriggered = false; // allow Wukong again next wave
  cascadeChainCount = 0;
  wave++;
  generateWave(wave);
  resetBallOnPaddle();
  stickyMode = true;
  launched = false;
  // Ink wash sweep transition
  inkWashSweep = 60;
  waveTransition = 90;
  const waveName = WAVE_NAMES[wave - 1] || `第${wave}波`;
  waveTransitionText = waveName;
  waveTransitionSubText = `第${wave}波`;
  gameScreen = 'playing';
}

// ============================================================================
// DRAWING - BRICKS
// ============================================================================

function drawBrickEyes(brick: Brick, cx: number, cy: number): void {
  // Find nearest ball for eye tracking
  let ballX = cx, ballY = cy + 100;
  for (const ball of balls) {
    if (ball.active && !ball.stuck) {
      const d = Math.hypot(ball.x - cx, ball.y - cy);
      if (d < Math.hypot(ballX - cx, ballY - cy)) {
        ballX = ball.x;
        ballY = ball.y;
      }
    }
  }

  // Eye tracking direction
  const dx = ballX - cx;
  const dy = ballY - cy;
  const dist = Math.hypot(dx, dy);
  const lookX = dist > 0 ? dx / dist * 1.5 : 0;
  const lookY = dist > 0 ? dy / dist * 1.0 : 0;

  const isBlinking = brick.blinkTimer <= 5;
  const isPaining = brick.painTimer > 0;
  const isFearing = brick.fearLevel > 0.3;

  // Eye positions - boss has wider set eyes
  const eyeSpacing = brick.type === 'boss' ? brick.w * 0.25 : brick.w * 0.18;
  const eyeY = cy - (brick.type === 'boss' ? 2 : 1);
  const leftEyeX = cx - eyeSpacing;
  const rightEyeX = cx + eyeSpacing;

  // Fear tremble
  const trembleX = isFearing ? (Math.random() - 0.5) * brick.fearLevel * 2 : 0;
  const trembleY = isFearing ? (Math.random() - 0.5) * brick.fearLevel * 1 : 0;

  ctx.save();

  if (isPaining) {
    // Pain: squeezed shut eyes (two horizontal lines)
    ctx.strokeStyle = brick.type === 'boss' ? '#ff4466' : '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(leftEyeX - 2 + trembleX, eyeY + trembleY);
    ctx.lineTo(leftEyeX + 2 + trembleX, eyeY + trembleY);
    ctx.moveTo(rightEyeX - 2 + trembleX, eyeY + trembleY);
    ctx.lineTo(rightEyeX + 2 + trembleX, eyeY + trembleY);
    ctx.stroke();
  } else if (isBlinking) {
    // Blinking: thin horizontal lines
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftEyeX - 1.5, eyeY);
    ctx.lineTo(leftEyeX + 1.5, eyeY);
    ctx.moveTo(rightEyeX - 1.5, eyeY);
    ctx.lineTo(rightEyeX + 1.5, eyeY);
    ctx.stroke();
  } else {
    // Eye size based on fear
    const baseSize = brick.type === 'boss' ? 2.5 : 1.8;
    const eyeSize = baseSize + (isFearing ? brick.fearLevel * 1.5 : 0);

    // Eye style varies by type
    let eyeColor = '#ffffff';
    if (brick.type === 'gold') eyeColor = '#ffd700';
    if (brick.type === 'explosive') eyeColor = '#ff4444';
    if (brick.type === 'boss') eyeColor = '#ff2244';

    // Draw eye whites (circles)
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(leftEyeX + trembleX, eyeY + trembleY, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightEyeX + trembleX, eyeY + trembleY, eyeSize, 0, Math.PI * 2);
    ctx.fill();

    // Pupils (track ball)
    const pupilSize = eyeSize * 0.5;
    ctx.fillStyle = brick.type === 'boss' ? '#440000' : '#1a1a2e';
    ctx.beginPath();
    ctx.arc(leftEyeX + lookX + trembleX, eyeY + lookY + trembleY, pupilSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightEyeX + lookX + trembleX, eyeY + lookY + trembleY, pupilSize, 0, Math.PI * 2);
    ctx.fill();

    // Special expressions
    if (brick.type === 'gold') {
      // Greedy smile - small arc below eyes
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx + trembleX, eyeY + 4 + trembleY, 3, 0, Math.PI);
      ctx.stroke();
    }
    if (brick.type === 'explosive') {
      // Angry eyebrows
      ctx.strokeStyle = '#ff2200';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(leftEyeX - 3 + trembleX, eyeY - 3 + trembleY);
      ctx.lineTo(leftEyeX + 1 + trembleX, eyeY - 4 + trembleY);
      ctx.moveTo(rightEyeX + 3 + trembleX, eyeY - 3 + trembleY);
      ctx.lineTo(rightEyeX - 1 + trembleX, eyeY - 4 + trembleY);
      ctx.stroke();
    }
    if (brick.type === 'boss') {
      // Fierce demon eyebrows + mouth
      ctx.strokeStyle = '#ff2244';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(leftEyeX - 4 + trembleX, eyeY - 4 + trembleY);
      ctx.lineTo(leftEyeX + 2 + trembleX, eyeY - 5 + trembleY);
      ctx.moveTo(rightEyeX + 4 + trembleX, eyeY - 4 + trembleY);
      ctx.lineTo(rightEyeX - 2 + trembleX, eyeY - 5 + trembleY);
      ctx.stroke();
      // Snarling mouth
      ctx.strokeStyle = '#ff4466';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 5 + trembleX, eyeY + 6 + trembleY);
      ctx.lineTo(cx - 2 + trembleX, eyeY + 8 + trembleY);
      ctx.lineTo(cx + 2 + trembleX, eyeY + 8 + trembleY);
      ctx.lineTo(cx + 5 + trembleX, eyeY + 6 + trembleY);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawBrick(brick: Brick): void {
  if (!brick.alive) return;

  ctx.save();
  const cx = brick.x + brick.w / 2;
  const cy = brick.y + brick.h / 2;

  // Breathing scale
  const breathScale = 0.95 + 0.10 * (0.5 + 0.5 * Math.sin(brick.breathPhase));

  // Wobble offset
  const wobbleX = brick.wobble * Math.sin(frameCount * 0.5) * 0.5;

  // Apply transforms
  ctx.translate(cx + wobbleX, cy);
  ctx.scale(breathScale, breathScale);
  ctx.translate(-cx, -cy);

  // White flash on hit (1 frame)
  if (brick.whiteFlashTimer > 0) {
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    roundRect(brick.x, brick.y, brick.w, brick.h, 4);
    ctx.fill();
    ctx.shadowBlur = 0;
    drawBrickEyes(brick, cx, cy);
    ctx.restore();
    return;
  }

  // Critical hit red flash
  if (brick.critFlashTimer > 0) {
    const flashAlpha = brick.critFlashTimer / 10;
    ctx.save();
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 20 * flashAlpha;
    ctx.fillStyle = `rgba(255,0,0,${flashAlpha * 0.4})`;
    ctx.fillRect(brick.x - 3, brick.y - 3, brick.w + 6, brick.h + 6);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Flash effect
  if (brick.flashTimer > 0) {
    ctx.globalAlpha = 0.5 + 0.5 * (brick.flashTimer / 6);
  }

  // Squash effect when hit (pain)
  if (brick.painTimer > 0) {
    const squash = brick.painTimer / 10 * 0.15;
    ctx.translate(cx, cy);
    ctx.scale(1 + squash, 1 - squash);
    ctx.translate(-cx, -cy);
  }

  // --- TYPE-SPECIFIC GLOW (shadowBlur aura) ---
  if (brick.type === 'explosive') {
    const emberPulse = 0.5 + 0.5 * Math.sin(frameCount * 0.15 + brick.breathPhase);
    ctx.shadowColor = `rgba(255,${Math.floor(60 + emberPulse * 40)},0,1)`;
    ctx.shadowBlur = 8 + emberPulse * 6;
  } else if (brick.type === 'gold') {
    const goldPulse = 0.5 + 0.5 * Math.sin(frameCount * 0.1 + brick.breathPhase);
    ctx.shadowColor = `rgba(255,215,0,${0.4 + goldPulse * 0.3})`;
    ctx.shadowBlur = 6 + goldPulse * 8;
  } else if (brick.type === 'boss') {
    const bossPulse = 0.5 + 0.5 * Math.sin(frameCount * 0.08);
    ctx.shadowColor = `rgba(140,30,80,${0.5 + bossPulse * 0.3})`;
    ctx.shadowBlur = 10 + bossPulse * 8;
  }

  // --- BRICK BODY: 3-tone gradient per type ---
  const bx = brick.x, by = brick.y, bw = brick.w, bh = brick.h;
  const bodyGrad = ctx.createLinearGradient(bx, by, bx, by + bh);

  switch (brick.type) {
    case 'normal':
      bodyGrad.addColorStop(0, '#40404f'); // highlight edge
      bodyGrad.addColorStop(0.45, '#2a2a3a'); // base
      bodyGrad.addColorStop(1, '#1a1a28'); // shadow edge
      break;
    case 'tough':
      bodyGrad.addColorStop(0, '#6b5838'); // lighter top
      bodyGrad.addColorStop(0.4, '#4a3828'); // base brown
      bodyGrad.addColorStop(1, '#2a1808'); // deep shadow
      break;
    case 'gold':
      bodyGrad.addColorStop(0, '#ffe066'); // bright gold top
      bodyGrad.addColorStop(0.4, '#d4a020'); // base gold
      bodyGrad.addColorStop(1, '#8b6510'); // deep gold shadow
      break;
    case 'explosive':
      bodyGrad.addColorStop(0, '#cc3020'); // bright red
      bodyGrad.addColorStop(0.5, '#8b1818'); // deep red
      bodyGrad.addColorStop(1, '#4a0808'); // very dark red
      break;
    case 'spirit':
      bodyGrad.addColorStop(0, '#4a7a9a'); // light blue
      bodyGrad.addColorStop(0.5, '#2a4a5a'); // base
      bodyGrad.addColorStop(1, '#1a2a3a'); // dark blue
      break;
    case 'boss':
      bodyGrad.addColorStop(0, '#3a1030'); // obsidian highlight
      bodyGrad.addColorStop(0.4, '#2a0820'); // deep obsidian
      bodyGrad.addColorStop(1, '#150410'); // near black
      break;
  }

  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  roundRect(bx, by, bw, bh, 4);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';

  // --- STONE TEXTURE OVERLAY ---
  if (stoneTexturePattern) {
    ctx.save();
    ctx.globalAlpha = brick.type === 'gold' ? 0.08 : 0.15;
    ctx.fillStyle = stoneTexturePattern;
    ctx.beginPath();
    roundRect(bx, by, bw, bh, 4);
    ctx.fill();
    ctx.restore();
  }

  // --- HIGHLIGHT SPOT (radial gradient for depth) ---
  ctx.save();
  const hlGrad = ctx.createRadialGradient(bx + bw * 0.3, by + bh * 0.25, 0, bx + bw * 0.3, by + bh * 0.25, bw * 0.6);
  hlGrad.addColorStop(0, 'rgba(255,255,255,0.18)');
  hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hlGrad;
  ctx.beginPath();
  roundRect(bx, by, bw, bh, 4);
  ctx.fill();
  ctx.restore();

  // --- TYPE-SPECIFIC DECORATIONS ---

  // Normal: drawn-in crack lines (stone crevices)
  if (brick.type === 'normal') {
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = '#0a0a15';
    ctx.lineWidth = 0.7;
    const seed = Math.floor(bx * 7 + by * 13);
    ctx.beginPath();
    ctx.moveTo(bx + (seed % 15) + 3, by + bh * 0.3);
    ctx.lineTo(bx + bw * 0.4, by + bh * 0.6);
    ctx.lineTo(bx + bw * 0.6, by + bh * 0.4);
    ctx.stroke();
    ctx.restore();
  }

  // Tough: metallic sheen gradient overlay
  if (brick.type === 'tough') {
    ctx.save();
    const sheenX = bx + (Math.sin(frameCount * 0.02 + brick.breathPhase) * 0.5 + 0.5) * bw;
    const sheen = ctx.createRadialGradient(sheenX, by + bh * 0.3, 0, sheenX, by + bh * 0.3, bw * 0.5);
    sheen.addColorStop(0, 'rgba(255,255,220,0.15)');
    sheen.addColorStop(1, 'rgba(255,255,220,0)');
    ctx.fillStyle = sheen;
    ctx.beginPath();
    roundRect(bx, by, bw, bh, 4);
    ctx.fill();
    ctx.restore();
  }

  // Gold: sparkle particles
  if (brick.type === 'gold') {
    ctx.save();
    const sparkleCount = 3;
    for (let s = 0; s < sparkleCount; s++) {
      const sp = (frameCount * 0.05 + s * 2.1 + brick.breathPhase) % (Math.PI * 2);
      const sx = bx + bw * (0.2 + Math.abs(Math.sin(sp)) * 0.6);
      const sy = by + bh * (0.2 + Math.abs(Math.cos(sp * 1.3)) * 0.6);
      const sparkleSize = 1.5 + Math.sin(sp * 3) * 1;
      ctx.fillStyle = `rgba(255,255,200,${0.4 + Math.sin(sp * 2) * 0.3})`;
      // 4-pointed star
      ctx.beginPath();
      ctx.moveTo(sx, sy - sparkleSize);
      ctx.lineTo(sx + sparkleSize * 0.3, sy);
      ctx.lineTo(sx, sy + sparkleSize);
      ctx.lineTo(sx - sparkleSize * 0.3, sy);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(sx - sparkleSize, sy);
      ctx.lineTo(sx, sy + sparkleSize * 0.3);
      ctx.lineTo(sx + sparkleSize, sy);
      ctx.lineTo(sx, sy - sparkleSize * 0.3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Explosive: ember glow particles
  if (brick.type === 'explosive') {
    ctx.save();
    for (let e = 0; e < 2; e++) {
      const ep = (frameCount * 0.08 + e * 3 + brick.breathPhase) % (Math.PI * 2);
      const ex = bx + bw * (0.3 + Math.sin(ep) * 0.3);
      const ey = by - 2 - Math.abs(Math.sin(ep * 0.7)) * 4;
      const eSize = 1.5 + Math.sin(ep * 2) * 0.8;
      ctx.fillStyle = `rgba(255,${Math.floor(100 + Math.sin(ep) * 80)},0,${0.5 + Math.sin(ep) * 0.3})`;
      ctx.beginPath();
      ctx.arc(ex, ey, eSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Boss: purple veins + pulsing aura
  if (brick.type === 'boss') {
    ctx.save();
    // Purple veins
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(frameCount * 0.06);
    ctx.strokeStyle = '#8844aa';
    ctx.lineWidth = 1;
    const seed = Math.floor(bx + by * 3);
    for (let v = 0; v < 4; v++) {
      ctx.beginPath();
      const vx = bx + bw * ((seed + v * 23) % 80 / 100 * 0.6 + 0.2);
      const vy = by + bh * ((seed + v * 37) % 80 / 100 * 0.6 + 0.2);
      ctx.moveTo(vx, vy);
      ctx.quadraticCurveTo(
        vx + ((v % 2) * 2 - 1) * 8, vy + 5,
        vx + ((v % 2) * 2 - 1) * 4, vy + bh * 0.4
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- INK BORDER ---
  ctx.strokeStyle = brick.type === 'boss' ? '#4a0828' : '#1a1a1a';
  ctx.lineWidth = brick.type === 'boss' ? 2 : 1.5;
  ctx.beginPath();
  roundRect(bx, by, bw, bh, 4);
  ctx.stroke();

  // Regen visual: green pulse
  if (brick.canRegen && brick.hp < brick.maxHp) {
    const regenPulse = Math.sin(frameCount * 0.1) * 0.15 + 0.15;
    ctx.fillStyle = `rgba(0,255,0,${regenPulse})`;
    ctx.beginPath();
    roundRect(bx, by, bw, bh, 4);
    ctx.fill();
  }

  // Draw living eyes on all bricks
  drawBrickEyes(brick, cx, cy);

  // Boss HP bar with gradient
  if (brick.type === 'boss') {
    const hpPct = brick.hp / brick.maxHp;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 3;
    ctx.fillStyle = '#200008';
    ctx.beginPath();
    roundRect(bx, by - 8, bw, 5, 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    const hpGrad = ctx.createLinearGradient(bx, by - 8, bx, by - 3);
    hpGrad.addColorStop(0, '#ff6666');
    hpGrad.addColorStop(0.5, '#ff2222');
    hpGrad.addColorStop(1, '#cc0000');
    ctx.fillStyle = hpGrad;
    ctx.beginPath();
    roundRect(bx + 1, by - 7, (bw - 2) * hpPct, 3, 1.5);
    ctx.fill();
    ctx.restore();
  }

  // --- CRACK LINES for damaged bricks (actual fissure patterns) ---
  if (brick.crackLevel > 0 && brick.type !== 'boss') {
    const cracks = Math.ceil(brick.crackLevel * 6);
    const seed = brick.x * 13 + brick.y * 7;

    // Dark crack lines
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < cracks; i++) {
      ctx.beginPath();
      const t = (seed + i * 37) % 100 / 100;
      const t2 = (seed + i * 53) % 100 / 100;
      const x1 = bx + bw * (0.1 + t * 0.8);
      const y1 = by + bh * (0.1 + t2 * 0.8);
      ctx.moveTo(x1, y1);
      const angle1 = (t * 6.28 + i);
      const len = 4 + brick.crackLevel * 12;
      const x2 = x1 + Math.cos(angle1) * len;
      const y2 = y1 + Math.sin(angle1) * len;
      ctx.lineTo(x2, y2);
      // Branch crack
      const midX = x1 + Math.cos(angle1) * len * 0.5;
      const midY = y1 + Math.sin(angle1) * len * 0.5;
      ctx.moveTo(midX, midY);
      ctx.lineTo(midX + Math.cos(angle1 + 0.8) * len * 0.5, midY + Math.sin(angle1 + 0.8) * len * 0.5);
      // Second branch
      if (brick.crackLevel > 0.5) {
        ctx.moveTo(midX, midY);
        ctx.lineTo(midX + Math.cos(angle1 - 0.9) * len * 0.4, midY + Math.sin(angle1 - 0.9) * len * 0.4);
      }
      ctx.stroke();
    }
    // Light edge along cracks (makes them look 3D)
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 0.6;
    for (let i = 0; i < cracks; i++) {
      ctx.beginPath();
      const t = (seed + i * 37) % 100 / 100;
      const t2 = (seed + i * 53) % 100 / 100;
      const x1 = bx + bw * (0.1 + t * 0.8) + 0.5;
      const y1 = by + bh * (0.1 + t2 * 0.8) + 0.5;
      const angle1 = (t * 6.28 + i);
      const len = 4 + brick.crackLevel * 12;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + Math.cos(angle1) * len, y1 + Math.sin(angle1) * len);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ============================================================================
// DRAWING - PADDLE & BALL
// ============================================================================

function drawPaddle(): void {
  const pw = getEffectivePaddleW();
  const ph = BASE_PADDLE_H;
  const px = paddleX - pw / 2;
  const py = PADDLE_Y - ph / 2;

  ctx.save();

  // Apply squash animation
  const squashScale = 1 - paddleSquash;
  const stretchScale = 1 + paddleSquash * 0.5;
  ctx.translate(paddleX, PADDLE_Y);
  ctx.scale(stretchScale, squashScale);
  ctx.translate(-paddleX, -PADDLE_Y);

  // Shadow underneath paddle
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(paddleX, PADDLE_Y + ph / 2 + 4, pw / 2 - 3, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Combo glow on paddle (with hit pulse)
  if (combo >= 5 || paddleSquash > 0.01) {
    const glowIntensity = Math.min(combo / 20, 1);
    const hitPulse = paddleSquash * 8;
    const glowColor = furyActive ? 'rgba(255,50,50,' : 'rgba(255,200,50,';
    ctx.shadowColor = furyActive ? '#ff2222' : '#ffd700';
    ctx.shadowBlur = 10 + glowIntensity * 20 + hitPulse;
    ctx.fillStyle = `${glowColor}${Math.min(glowIntensity * 0.3 + hitPulse * 0.1, 0.6)})`;
    ctx.beginPath();
    ctx.ellipse(paddleX, PADDLE_Y, pw / 2 + 5, ph / 2 + 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Main paddle body shadow
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;

  // Calligraphy brush shape with jade/wooden texture gradient
  const grad = ctx.createLinearGradient(px, py, px, py + ph);
  grad.addColorStop(0, '#5a4a38'); // highlight top
  grad.addColorStop(0.2, '#4a3a28');
  grad.addColorStop(0.5, '#2a1a0a'); // deep center
  grad.addColorStop(0.8, '#3a2a18');
  grad.addColorStop(1, '#4a3828'); // lit bottom edge

  ctx.fillStyle = grad;

  ctx.beginPath();
  const taperW = pw * 0.12;
  ctx.moveTo(px + taperW, py + ph * 0.4);
  ctx.quadraticCurveTo(px + pw * 0.15, py - ph * 0.1, px + pw * 0.3, py);
  ctx.lineTo(px + pw * 0.7, py);
  ctx.quadraticCurveTo(px + pw * 0.85, py - ph * 0.1, px + pw - taperW, py + ph * 0.4);
  ctx.quadraticCurveTo(px + pw, py + ph * 0.6, px + pw - taperW, py + ph * 0.7);
  ctx.quadraticCurveTo(px + pw * 0.85, py + ph * 1.1, px + pw * 0.7, py + ph);
  ctx.lineTo(px + pw * 0.3, py + ph);
  ctx.quadraticCurveTo(px + pw * 0.15, py + ph * 1.1, px + taperW, py + ph * 0.7);
  ctx.quadraticCurveTo(px, py + ph * 0.6, px + taperW, py + ph * 0.4);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Rounded end highlight spots
  ctx.save();
  const leftHL = ctx.createRadialGradient(px + taperW + 3, py + ph * 0.4, 0, px + taperW + 3, py + ph * 0.4, 8);
  leftHL.addColorStop(0, 'rgba(255,255,255,0.2)');
  leftHL.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = leftHL;
  ctx.fillRect(px, py, 20, ph);
  const rightHL = ctx.createRadialGradient(px + pw - taperW - 3, py + ph * 0.4, 0, px + pw - taperW - 3, py + ph * 0.4, 8);
  rightHL.addColorStop(0, 'rgba(255,255,255,0.2)');
  rightHL.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = rightHL;
  ctx.fillRect(px + pw - 20, py, 20, ph);
  ctx.restore();

  // Ink texture: dark center line
  ctx.strokeStyle = '#1a0a00';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px + pw * 0.2, PADDLE_Y);
  ctx.lineTo(px + pw * 0.8, PADDLE_Y);
  ctx.stroke();

  // Brush tip highlight (top shine)
  ctx.save();
  ctx.globalAlpha = 0.2;
  const topShine = ctx.createLinearGradient(paddleX - pw * 0.3, py, paddleX + pw * 0.3, py + 4);
  topShine.addColorStop(0, 'rgba(255,255,255,0)');
  topShine.addColorStop(0.5, 'rgba(255,255,255,1)');
  topShine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = topShine;
  ctx.beginPath();
  ctx.ellipse(paddleX, py + 3, pw * 0.3, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Red scarf mark at center (Melo brand consistency)
  ctx.fillStyle = '#cc3333';
  ctx.beginPath();
  ctx.moveTo(paddleX - 4, PADDLE_Y - 2);
  ctx.lineTo(paddleX + 4, PADDLE_Y - 2);
  ctx.lineTo(paddleX, PADDLE_Y + 4);
  ctx.closePath();
  ctx.fill();
  // Tiny fluttering tail
  ctx.strokeStyle = '#cc3333';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(paddleX, PADDLE_Y + 4);
  ctx.quadraticCurveTo(paddleX + 3 + Math.sin(frameCount * 0.15) * 2, PADDLE_Y + 7, paddleX + 1, PADDLE_Y + 9);
  ctx.stroke();

  ctx.restore();
}

function drawBalls(): void {
  for (const ball of balls) {
    if (!ball.active) continue;
    ctx.save();

    // --- COMET TAIL (decreasing alpha circles behind ball) ---
    if (!ball.stuck) {
      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      if (speed > 0.5) {
        const nx = -ball.vx / speed;
        const ny = -ball.vy / speed;
        const tailLen = ball.fire ? 8 : ball.thunder ? 7 : ball.inkBomb ? 6 : 5;
        for (let t = 1; t <= tailLen; t++) {
          const alpha = (1 - t / tailLen) * 0.35;
          const radius = ball.radius * (1 - t / tailLen * 0.6);
          const tx = ball.x + nx * t * 3.5;
          const ty = ball.y + ny * t * 3.5;
          ctx.globalAlpha = alpha;
          if (ball.fire) {
            const fireGrad = ctx.createRadialGradient(tx, ty, 0, tx, ty, radius * 1.5);
            fireGrad.addColorStop(0, '#ffcc00');
            fireGrad.addColorStop(0.5, '#ff6600');
            fireGrad.addColorStop(1, 'rgba(255,30,0,0)');
            ctx.fillStyle = fireGrad;
          } else if (ball.thunder) {
            ctx.fillStyle = `rgba(100,180,255,${alpha})`;
          } else if (ball.inkBomb) {
            ctx.fillStyle = `rgba(20,20,50,${alpha})`;
          } else {
            ctx.fillStyle = `rgba(30,30,50,${alpha})`;
          }
          ctx.beginPath();
          ctx.arc(tx, ty, radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }

    // --- OUTER GLOW (type-specific shadowBlur) ---
    if (ball.fire) {
      ctx.shadowColor = '#ff6600';
      ctx.shadowBlur = 18;
      const glow = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, ball.radius * 3.5);
      glow.addColorStop(0, 'rgba(255,120,0,0.35)');
      glow.addColorStop(0.5, 'rgba(255,60,0,0.15)');
      glow.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius * 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (ball.thunder) {
      ctx.shadowColor = '#4488ff';
      ctx.shadowBlur = 15;
      const glow = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, ball.radius * 3);
      glow.addColorStop(0, 'rgba(100,160,255,0.35)');
      glow.addColorStop(0.5, 'rgba(68,136,255,0.15)');
      glow.addColorStop(1, 'rgba(68,136,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius * 3, 0, Math.PI * 2);
      ctx.fill();
      // Electric arc trail (jagged lines around ball)
      ctx.strokeStyle = '#aaccff';
      ctx.lineWidth = 1;
      for (let a = 0; a < 3; a++) {
        const angle = frameCount * 0.3 + a * Math.PI * 2 / 3;
        const arcLen = ball.radius * 2;
        ctx.beginPath();
        ctx.moveTo(ball.x + Math.cos(angle) * ball.radius, ball.y + Math.sin(angle) * ball.radius);
        for (let seg = 1; seg <= 3; seg++) {
          const frac = seg / 3;
          ctx.lineTo(
            ball.x + Math.cos(angle) * (ball.radius + arcLen * frac) + (Math.random() - 0.5) * 5,
            ball.y + Math.sin(angle) * (ball.radius + arcLen * frac) + (Math.random() - 0.5) * 5
          );
        }
        ctx.stroke();
      }
    } else if (ball.inkBomb) {
      ctx.shadowColor = '#2a2a5a';
      ctx.shadowBlur = 10;
    } else if (ball.isSpirit) {
      ctx.shadowColor = '#88aadd';
      ctx.shadowBlur = 8;
    }

    // --- BALL BODY (radial gradient: bright core, softer edge) ---
    const bodyGrad = ctx.createRadialGradient(
      ball.x - ball.radius * 0.25, ball.y - ball.radius * 0.25, 0,
      ball.x, ball.y, ball.radius
    );

    if (ball.fire) {
      bodyGrad.addColorStop(0, '#ffee88');
      bodyGrad.addColorStop(0.4, '#ff8800');
      bodyGrad.addColorStop(1, '#cc3300');
    } else if (ball.thunder) {
      bodyGrad.addColorStop(0, '#eeeeff');
      bodyGrad.addColorStop(0.4, '#88bbff');
      bodyGrad.addColorStop(1, '#3366aa');
    } else if (ball.inkBomb) {
      bodyGrad.addColorStop(0, '#444466');
      bodyGrad.addColorStop(0.5, '#1a1a3e');
      bodyGrad.addColorStop(1, '#0a0a20');
    } else if (ball.isSpirit) {
      bodyGrad.addColorStop(0, '#cceeff');
      bodyGrad.addColorStop(0.5, '#88aacc');
      bodyGrad.addColorStop(1, '#5577aa');
    } else {
      bodyGrad.addColorStop(0, '#3a3a55');
      bodyGrad.addColorStop(0.5, '#1a1a2e');
      bodyGrad.addColorStop(1, '#0a0a18');
    }

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    // Highlight spot
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(ball.x - ball.radius * 0.3, ball.y - ball.radius * 0.3, ball.radius * 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// ============================================================================
// DRAWING - SCREEN EFFECTS
// ============================================================================

function drawScreenEdgeFlash(): void {
  if (screenEdgeFlash <= 0) return;
  const alpha = screenEdgeFlash / 8 * 0.5;
  ctx.save();
  ctx.globalAlpha = alpha;
  // Draw glowing border
  const grad = ctx.createLinearGradient(0, 0, 20, 0);
  grad.addColorStop(0, screenEdgeFlashColor);
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 20, H);

  const grad2 = ctx.createLinearGradient(W, 0, W - 20, 0);
  grad2.addColorStop(0, screenEdgeFlashColor);
  grad2.addColorStop(1, 'transparent');
  ctx.fillStyle = grad2;
  ctx.fillRect(W - 20, 0, 20, H);

  const grad3 = ctx.createLinearGradient(0, 0, 0, 20);
  grad3.addColorStop(0, screenEdgeFlashColor);
  grad3.addColorStop(1, 'transparent');
  ctx.fillStyle = grad3;
  ctx.fillRect(0, 0, W, 20);

  const grad4 = ctx.createLinearGradient(0, H, 0, H - 20);
  grad4.addColorStop(0, screenEdgeFlashColor);
  grad4.addColorStop(1, 'transparent');
  ctx.fillStyle = grad4;
  ctx.fillRect(0, H - 20, W, 20);

  ctx.restore();
}

function drawBossHitFlash(): void {
  if (bossHitFlash <= 0) return;
  const alpha = bossHitFlash / 8 * 0.3;
  ctx.save();
  ctx.globalAlpha = alpha;
  const grad = ctx.createLinearGradient(0, 0, 20, 0);
  grad.addColorStop(0, '#ff2222');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 20, H);
  const grad2 = ctx.createLinearGradient(W, 0, W - 20, 0);
  grad2.addColorStop(0, '#ff2222');
  grad2.addColorStop(1, 'transparent');
  ctx.fillStyle = grad2;
  ctx.fillRect(W - 20, 0, 20, H);
  ctx.restore();
}

function drawInkWashSweep(): void {
  if (inkWashSweep <= 0) return;
  const progress = 1 - inkWashSweep / 60;
  const waveX = progress * (W + 200) - 100;
  ctx.save();

  // Main sweep body with gradient edge
  const sweepGrad = ctx.createLinearGradient(waveX - 80, 0, waveX + 30, 0);
  sweepGrad.addColorStop(0, 'rgba(15,10,8,0.95)');
  sweepGrad.addColorStop(0.7, 'rgba(20,15,10,0.85)');
  sweepGrad.addColorStop(1, 'rgba(30,25,18,0)');
  ctx.fillStyle = sweepGrad;
  ctx.beginPath();
  ctx.moveTo(waveX - 120, 0);
  for (let y = 0; y <= H; y += 6) {
    const waviness = Math.sin(y * 0.03 + progress * 10) * 35 + Math.sin(y * 0.07 + progress * 5) * 15;
    ctx.lineTo(waveX + waviness, y);
  }
  ctx.lineTo(waveX - 120, H);
  ctx.closePath();
  ctx.fill();

  // Ink splatter particles along the wave front
  ctx.globalAlpha = 0.6;
  for (let s = 0; s < 6; s++) {
    const sy = H * (s + 0.5) / 6 + Math.sin(progress * 8 + s) * 20;
    const sx = waveX + Math.sin(sy * 0.04 + progress * 10) * 30 + 10;
    const sSize = 4 + Math.sin(s + progress * 5) * 3;
    ctx.fillStyle = `rgba(15,10,8,${0.3 + Math.random() * 0.3})`;
    ctx.beginPath();
    ctx.arc(sx, sy, sSize, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ============================================================================
// DRAWING - SCREENS
// ============================================================================

function renderTitle(): void {
  drawPaperBg();

  // Animated floating/rotating brick shapes in background
  ctx.save();
  for (let i = 0; i < 8; i++) {
    const phase = frameCount * 0.008 + i * 1.2;
    const bx = W * 0.1 + (i % 4) * (W * 0.25);
    const by = 100 + Math.floor(i / 4) * 300 + Math.sin(phase * 0.7) * 30;
    const rot = Math.sin(phase) * 0.3;
    const scale = 0.6 + Math.sin(phase * 0.5 + i) * 0.15;
    const brickAlpha = 0.06 + Math.sin(phase) * 0.02;
    ctx.save();
    ctx.globalAlpha = brickAlpha;
    ctx.translate(bx, by);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    // Mini brick shape
    const bw = 38, bh = 18;
    const bgGrad = ctx.createLinearGradient(-bw / 2, -bh / 2, -bw / 2, bh / 2);
    const colors = ['#2a2a3a', '#4a3828', '#8b7530', '#6b2020'];
    const ci = i % colors.length;
    bgGrad.addColorStop(0, lightenColor(colors[ci], 20));
    bgGrad.addColorStop(1, colors[ci]);
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    roundRect(-bw / 2, -bh / 2, bw, bh, 3);
    ctx.fill();
    // Occasionally one shattering (every 180 frames cycle)
    const shatterPhase = (frameCount + i * 40) % 180;
    if (shatterPhase > 160) {
      const frac = (shatterPhase - 160) / 20;
      ctx.globalAlpha = brickAlpha * (1 - frac);
      for (let f = 0; f < 4; f++) {
        const fx = (Math.sin(f * 2.3) * 15) * frac;
        const fy = (Math.cos(f * 1.7) * 12) * frac;
        ctx.fillStyle = colors[ci];
        ctx.fillRect(fx - 4, fy - 3, 8, 6);
      }
    }
    ctx.restore();
  }
  ctx.restore();

  // Brand line: 麦洛的冒险
  drawInkText('麦洛的冒险', W / 2, 130, 22, '#5a4a3a');

  // Main title: "石破天惊" with stone-cracking light effect
  ctx.save();
  // Draw dark stone text first
  ctx.font = '900 52px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Outer glow: light bursting through cracks
  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 25 + Math.sin(frameCount * 0.05) * 8;
  ctx.fillStyle = '#ffd700';
  ctx.globalAlpha = 0.3 + Math.sin(frameCount * 0.04) * 0.1;
  ctx.fillText('石破天惊', W / 2, 195);

  // Stone-colored main text
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  const stoneGrad = ctx.createLinearGradient(W / 2 - 100, 170, W / 2 + 100, 220);
  stoneGrad.addColorStop(0, '#3a3a48');
  stoneGrad.addColorStop(0.3, '#2a2a35');
  stoneGrad.addColorStop(0.5, '#4a4a58');
  stoneGrad.addColorStop(0.7, '#2a2a35');
  stoneGrad.addColorStop(1, '#3a3a48');
  ctx.fillStyle = stoneGrad;
  ctx.fillText('石破天惊', W / 2, 195);

  // Inner light through crack seams
  ctx.globalAlpha = 0.5 + Math.sin(frameCount * 0.06) * 0.2;
  ctx.shadowColor = '#ffeeaa';
  ctx.shadowBlur = 12;
  const crackGrad = ctx.createLinearGradient(W / 2 - 80, 180, W / 2 + 80, 210);
  crackGrad.addColorStop(0, 'rgba(255,230,150,0)');
  crackGrad.addColorStop(0.3, 'rgba(255,230,150,0.6)');
  crackGrad.addColorStop(0.5, 'rgba(255,255,200,0.8)');
  crackGrad.addColorStop(0.7, 'rgba(255,230,150,0.6)');
  crackGrad.addColorStop(1, 'rgba(255,230,150,0)');
  ctx.fillStyle = crackGrad;
  ctx.fillText('石破天惊', W / 2, 195);
  ctx.shadowBlur = 0;
  ctx.restore();

  drawInkText("Melo's Quest: Formation Breaker", W / 2, 240, 13, '#7a6a5a');

  // Decorative ink circle with gradient
  ctx.save();
  const circleGrad = ctx.createRadialGradient(W / 2, 350, 60, W / 2, 350, 82);
  circleGrad.addColorStop(0, 'rgba(30,30,50,0)');
  circleGrad.addColorStop(0.8, 'rgba(30,30,50,0.15)');
  circleGrad.addColorStop(1, 'rgba(30,30,50,0.05)');
  ctx.strokeStyle = circleGrad;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(W / 2, 350, 80, 0, Math.PI * 2);
  ctx.stroke();

  // Melo silhouette with red scarf
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#2a2a3a';
  ctx.beginPath();
  ctx.arc(W / 2, 340, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(W / 2 - 8, 360, 16, 25);
  ctx.shadowBlur = 0;
  // Red scarf on Melo
  ctx.fillStyle = '#cc3333';
  ctx.beginPath();
  ctx.moveTo(W / 2 - 10, 355);
  ctx.lineTo(W / 2 + 10, 355);
  ctx.lineTo(W / 2 + 15 + Math.sin(frameCount * 0.08) * 3, 370);
  ctx.lineTo(W / 2 - 5, 365);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Player name + rename button
  drawInkText(`${passport.playerName}`, W / 2, 435, 14, '#8b7530');
  if (drawButton(W / 2 + 50, 422, 50, 24, '改名', '#7a6a5a')) {
    changePlayerName();
  }

  // Buttons
  const btnW = 200, btnH = 46, startBtnX = W / 2 - btnW / 2;
  if (drawButton(startBtnX, 470, btnW, btnH, '开始冒险', '#3a2a1a')) {
    gameScreen = 'charSelect';
  }
  if (drawButton(startBtnX, 530, btnW, btnH, '每日挑战', '#2a3a2a')) {
    isDailyRun = true;
    gameScreen = 'charSelect';
  }
  if (drawButton(startBtnX, 590, btnW, btnH, '商店', '#2a2a3a')) {
    gameScreen = 'shop';
  }
  if (drawButton(startBtnX, 650, btnW, btnH, '排行榜', '#3a2a2a')) {
    gameScreen = 'leaderboard';
  }

  // Coins + weekly best with icons
  ctx.save();
  ctx.fillStyle = '#ffd700';
  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.arc(W / 2 - 88, 720, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
  drawInkText(`${coins}`, W / 2 - 60, 720, 14, '#8b7530');
  if (weeklyBest > 0) {
    drawInkText(`周最佳: ${weeklyBest}`, W / 2 + 60, 720, 14, '#5a7a3a');
  }

  // Achievements earned
  const earnedCount = passport.achievements.length;
  if (earnedCount > 0) {
    drawInkText(`印章: ${earnedCount}/${ACHIEVEMENTS.length}`, W / 2, 745, 12, '#888');
  }

  // Bottom brand: atmospheric watermark
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.font = '700 14px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#8a7a6a';
  ctx.fillText('麦洛的冒险 · 第三章', W / 2, 790);
  ctx.restore();
  drawInkText('v0.3.0', W / 2, 810, 10, '#888');
}

function renderNameInput(): void {
  drawPaperBg();

  drawInkText('为旅者取名', W / 2, 100, 28, '#1a1a2e', 'center', true);
  drawInkText('山海经中记载，每位旅者皆有真名', W / 2, 140, 13, '#7a6a5a');

  // Name presets
  drawInkText('快捷选择:', W / 2, 200, 14, '#5a4a3a');
  const presetY = 230;
  NAME_PRESETS.forEach((name, i) => {
    const bx = 30 + (i % 3) * 115;
    const by = presetY + Math.floor(i / 3) * 45;
    if (drawButton(bx, by, 105, 36, name, '#3a3a2a')) {
      passport.playerName = name;
      nameInputText = name;
      saveData();
      gameScreen = 'title';
    }
  });

  // Custom input display
  drawInkText('自定义名字:', W / 2, 350, 14, '#5a4a3a');
  ctx.save();
  ctx.fillStyle = '#f5ead0';
  ctx.beginPath();
  roundRect(W / 2 - 100, 370, 200, 40, 6);
  ctx.fill();
  ctx.strokeStyle = '#3a2a1a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  roundRect(W / 2 - 100, 370, 200, 40, 6);
  ctx.stroke();
  ctx.restore();

  const displayText = nameInputText + (nameInputCursor ? '|' : '');
  drawInkText(displayText || '点击输入...', W / 2, 390, 18, nameInputText ? '#1a1a2e' : '#aaa');

  if (nameInputText.length > 0) {
    if (drawButton(W / 2 - 50, 430, 100, 36, '确定', '#3a5a2a')) {
      passport.playerName = nameInputText;
      saveData();
      gameScreen = 'title';
    }
  }

  if (drawButton(W / 2 - 50, 480, 100, 36, '返回', '#3c3c2c')) {
    gameScreen = 'title';
  }
}

function renderCharSelect(): void {
  drawPaperBg();
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 8;
  drawInkText('选择角色', W / 2, 60, 28, '#1a1a2e', 'center', true);
  ctx.shadowBlur = 0;
  ctx.restore();

  const cardW = 110, cardH = 210;
  const totalW = CHARACTERS.length * cardW + (CHARACTERS.length - 1) * 12;
  const cStartX = (W - totalW) / 2;

  CHARACTERS.forEach((char, i) => {
    const x = cStartX + i * (cardW + 12);
    const y = 110;

    ctx.save();
    // Card shadow
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;

    // Card body gradient
    const cardGrad = ctx.createLinearGradient(x, y, x, y + cardH);
    cardGrad.addColorStop(0, '#faf0d8');
    cardGrad.addColorStop(1, '#e8d8b8');
    ctx.fillStyle = cardGrad;
    ctx.beginPath();
    roundRect(x, y, cardW, cardH, 10);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Character color border with gradient
    const borderGrad = ctx.createLinearGradient(x, y, x, y + cardH);
    borderGrad.addColorStop(0, lightenColor(char.color, 30));
    borderGrad.addColorStop(0.5, char.color);
    borderGrad.addColorStop(1, darkenColor(char.color, 30));
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    roundRect(x, y, cardW, cardH, 10);
    ctx.stroke();

    // Character avatar with glow
    ctx.shadowColor = char.color;
    ctx.shadowBlur = 12;
    const avatarGrad = ctx.createRadialGradient(x + cardW / 2, y + 55, 0, x + cardW / 2, y + 55, 25);
    avatarGrad.addColorStop(0, lightenColor(char.color, 40));
    avatarGrad.addColorStop(1, char.color);
    ctx.fillStyle = avatarGrad;
    ctx.beginPath();
    ctx.arc(x + cardW / 2, y + 55, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Face highlight
    ctx.fillStyle = '#f5ead0';
    ctx.beginPath();
    ctx.arc(x + cardW / 2, y + 50, 8, 0, Math.PI * 2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(x + cardW / 2 - 3, y + 49, 1.5, 0, Math.PI * 2);
    ctx.arc(x + cardW / 2 + 3, y + 49, 1.5, 0, Math.PI * 2);
    ctx.fill();

    drawInkText(char.name, x + cardW / 2, y + 105, 20, '#1a1a2e', 'center', true);
    drawInkText(char.desc, x + cardW / 2, y + 135, 9, '#5a4a3a');

    // Lives as heart icons
    const charLives = char.lives + (shopLevels['shop_life'] || 0);
    for (let l = 0; l < charLives; l++) {
      drawHeartIcon(x + cardW / 2 - (charLives * 8) + l * 16, y + 155, 5, true);
    }
    drawInkText(`命: ${charLives}`, x + cardW / 2, y + 185, 10, '#666');
    ctx.restore();

    if (clicked && clickX >= x && clickX <= x + cardW && clickY >= y && clickY <= y + cardH) {
      playClick();
      startRun(char, isDailyRun);
    }
  });

  if (drawButton(W / 2 - 60, 360, 120, 38, '返回', '#3c3c2c')) {
    gameScreen = 'title';
    isDailyRun = false;
  }
}

function drawHUDPanel(x: number, y: number, w: number, h: number): void {
  ctx.save();
  const panelGrad = ctx.createLinearGradient(x, y, x, y + h);
  panelGrad.addColorStop(0, 'rgba(40,28,16,0.85)');
  panelGrad.addColorStop(1, 'rgba(25,16,8,0.9)');
  ctx.fillStyle = panelGrad;
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  roundRect(x, y, w, h, 6);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Inner border highlight
  ctx.strokeStyle = 'rgba(255,230,200,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  roundRect(x + 1, y + 1, w - 2, h - 2, 5);
  ctx.stroke();
  // Outer border
  ctx.strokeStyle = 'rgba(80,60,30,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  roundRect(x, y, w, h, 6);
  ctx.stroke();
  ctx.restore();
}

function drawHeartIcon(x: number, y: number, size: number, filled: boolean): void {
  ctx.save();
  if (filled) {
    ctx.shadowColor = '#ff4466';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#ff3355';
  } else {
    ctx.fillStyle = 'rgba(100,60,60,0.4)';
  }
  ctx.beginPath();
  const s = size;
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
  ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Highlight
  if (filled) {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(x - s * 0.15, y + s * 0.3, s * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function renderHUD(): void {
  // Top bar: gradient panel
  drawHUDPanel(4, 2, W - 8, 44);

  // Score panel (left)
  drawInkText(`${score}`, 60, 16, 15, '#f0e6d0', 'center');
  drawInkText('分', 60, 33, 9, '#a09080', 'center');

  // Wave banner (center) - calligraphy style
  ctx.save();
  const waveGrad = ctx.createLinearGradient(W / 2 - 40, 8, W / 2 + 40, 8);
  waveGrad.addColorStop(0, 'rgba(255,215,150,0)');
  waveGrad.addColorStop(0.3, 'rgba(255,215,150,0.08)');
  waveGrad.addColorStop(0.5, 'rgba(255,215,150,0.12)');
  waveGrad.addColorStop(0.7, 'rgba(255,215,150,0.08)');
  waveGrad.addColorStop(1, 'rgba(255,215,150,0)');
  ctx.fillStyle = waveGrad;
  ctx.fillRect(W / 2 - 50, 6, 100, 18);
  ctx.restore();
  drawInkText(`第${wave}阵`, W / 2, 16, 14, '#f0e6d0', 'center', true);
  drawInkText(`/${MAX_WAVES}`, W / 2 + 30, 16, 10, '#a09080', 'center');

  // Lives: heart icons (right side)
  const heartStartX = W - 100;
  for (let i = 0; i < Math.min(lives + 1, 6); i++) {
    drawHeartIcon(heartStartX + i * 16, 9, 7, i < lives);
  }

  // Gold with icon
  ctx.save();
  ctx.fillStyle = '#ffd700';
  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.arc(32, 36, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#aa8800';
  ctx.beginPath();
  ctx.arc(32, 36, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  drawInkText(`${runCoins}`, 52, 36, 10, '#ffd700', 'left');

  // Combo counter with PULSE and GLOW
  if (combo > 1 && comboDisplayTimer > 0) {
    const alpha = Math.min(1, comboDisplayTimer / 20);
    ctx.save();
    ctx.globalAlpha = alpha;

    let comboSize = Math.min(16 + combo * 2, 48);

    // Pulse effect for combo > 5
    if (combo > 5 && comboPulseTimer > 0) {
      const pulseScale = 1 + Math.sin(comboPulseTimer * 0.5) * 0.15;
      comboSize *= pulseScale;
    }

    // Background glow burst for high combos
    if (combo >= 15) {
      const burstGrad = ctx.createRadialGradient(W / 2, 75, 0, W / 2, 75, comboSize * 2);
      const burstColor = combo >= 20 ? 'rgba(255,215,0,' : 'rgba(255,100,50,';
      burstGrad.addColorStop(0, `${burstColor}${0.15 * alpha})`);
      burstGrad.addColorStop(1, `${burstColor}0)`);
      ctx.fillStyle = burstGrad;
      ctx.fillRect(0, 50, W, 60);
    }

    if (combo >= 20) {
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 35;
    } else if (combo >= 10) {
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 25;
    } else if (combo >= 5) {
      ctx.shadowColor = '#ff8844';
      ctx.shadowBlur = 15;
    }

    const comboColor = combo >= 20 ? '#fff8e0' : combo >= 10 ? '#ffd700' : combo >= 5 ? '#ff8844' : '#ffcc44';
    drawInkText(`${combo}连击!`, W / 2, 75, comboSize, comboColor, 'center', true);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Active upgrades (bottom) with panel
  if (activeUpgrades.length > 0) {
    const uy = H - 30;
    const totalUpgs = activeUpgrades.length;
    const panelW = totalUpgs * 25 + 16;
    const panelX = W / 2 - panelW / 2;
    drawHUDPanel(panelX, uy - 14, panelW, 28);
    const startUX = W / 2 - (totalUpgs * 25) / 2;
    activeUpgrades.forEach((au, i) => {
      const def = UPGRADES.find(u => u.id === au.id);
      if (def) {
        drawInkText(def.icon, startUX + i * 25, uy, 14, '#f0e6d0');
        if (au.stacks > 1) {
          drawInkText(`${au.stacks}`, startUX + i * 25 + 8, uy - 6, 8, '#ffcc44');
        }
      }
    });
  }

  // Fury mode indicator
  if (furyActive) {
    const furyAlpha = 0.7 + 0.3 * Math.sin(frameCount * 0.2);
    ctx.save();
    ctx.globalAlpha = furyAlpha;
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 15;
    drawInkText('怒意!', W / 2, 56, 14, '#ff2222', 'center', true);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Cascade chain counter
  if (cascadeChainDisplayTimer > 0 && cascadeChainCount >= 2) {
    const alpha = Math.min(1, cascadeChainDisplayTimer / 20);
    const chainFontSize = Math.min(18 + cascadeChainCount * 3, 40);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = '#ff4400';
    ctx.shadowBlur = 20;
    drawInkText(`连爆 x${cascadeChainCount}!`, W / 2, H / 2 + 40, chainFontSize, '#ff4400', 'center', true);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

function drawWukongAnimation(): void {
  const progress = 1 - wukongTimer / 90;
  ctx.save();

  // Golden overlay
  const goldAlpha = progress < 0.3 ? progress / 0.3 * 0.4 : (progress > 0.7 ? (1 - progress) / 0.3 * 0.4 : 0.4);
  ctx.globalAlpha = goldAlpha;
  ctx.fillStyle = '#ffd700';
  ctx.fillRect(0, 0, W, H);

  // Staff sweep from left to right
  const staffX = -50 + progress * (W + 100);
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 6;
  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.moveTo(staffX, 50);
  ctx.lineTo(staffX, H - 50);
  ctx.stroke();
  // Staff end ornament
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.arc(staffX, 50, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(staffX, H - 50, 8, 0, Math.PI * 2);
  ctx.fill();

  // Wukong silhouette (ink brush style)
  if (progress > 0.2 && progress < 0.8) {
    const wkAlpha = progress < 0.4 ? (progress - 0.2) / 0.2 : (progress > 0.6 ? (0.8 - progress) / 0.2 : 1);
    ctx.globalAlpha = wkAlpha * 0.8;
    const wkX = W / 2;
    const wkY = H / 2 - 50;

    // Head (circle)
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(wkX, wkY - 30, 18, 0, Math.PI * 2);
    ctx.fill();

    // Headband (gold)
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(wkX, wkY - 30, 20, -Math.PI * 0.8, -Math.PI * 0.2);
    ctx.stroke();

    // Body
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.moveTo(wkX - 12, wkY - 12);
    ctx.lineTo(wkX + 12, wkY - 12);
    ctx.lineTo(wkX + 10, wkY + 25);
    ctx.lineTo(wkX - 10, wkY + 25);
    ctx.closePath();
    ctx.fill();

    // Cape (flowing, ink-wash)
    ctx.strokeStyle = '#cc3333';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(200,50,50,0.5)';
    ctx.beginPath();
    ctx.moveTo(wkX - 10, wkY - 10);
    ctx.quadraticCurveTo(wkX - 35, wkY + 10, wkX - 25 + Math.sin(frameCount * 0.2) * 8, wkY + 35);
    ctx.lineTo(wkX + 25 + Math.sin(frameCount * 0.2 + 1) * 8, wkY + 35);
    ctx.quadraticCurveTo(wkX + 35, wkY + 10, wkX + 10, wkY - 10);
    ctx.fill();
    ctx.stroke();

    // Staff in hand
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(wkX + 15, wkY - 20);
    ctx.lineTo(wkX + 40, wkY + 40);
    ctx.stroke();

    // Eyes (fierce)
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(wkX - 6, wkY - 32, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(wkX + 6, wkY - 32, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // "齐天大圣" text with glow
  if (progress > 0.3) {
    const textAlpha = Math.min((progress - 0.3) / 0.2, 1);
    ctx.globalAlpha = textAlpha;
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 30;
    ctx.font = '900 36px "Noto Serif SC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd700';
    ctx.fillText('齐天大圣!', W / 2, H / 2 + 60);
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

function renderPlaying(): void {
  drawPaperBg();

  ctx.save();
  ctx.translate(shakeX, shakeY);

  // Wall lines
  ctx.strokeStyle = 'rgba(30,20,10,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(WALL_LEFT, WALL_TOP);
  ctx.lineTo(WALL_LEFT, H);
  ctx.moveTo(WALL_RIGHT, WALL_TOP);
  ctx.lineTo(WALL_RIGHT, H);
  ctx.moveTo(WALL_LEFT, WALL_TOP);
  ctx.lineTo(WALL_RIGHT, WALL_TOP);
  ctx.stroke();

  // Draw bricks
  for (const brick of bricks) drawBrick(brick);

  // Boss projectiles with glow
  for (const proj of bossProjectiles) {
    if (!proj.active) continue;
    ctx.save();
    ctx.shadowColor = '#ff2222';
    ctx.shadowBlur = 12;
    const projGrad = ctx.createRadialGradient(proj.x, proj.y, 0, proj.x, proj.y, proj.radius);
    projGrad.addColorStop(0, '#ffcc44');
    projGrad.addColorStop(0.5, '#ff4444');
    projGrad.addColorStop(1, '#cc0000');
    ctx.fillStyle = projGrad;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Hot core
    ctx.fillStyle = '#ffffaa';
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Particles
  drawParticles();

  // Ball & paddle
  drawBalls();
  drawPaddle();

  ctx.restore();

  // Screen edge effects
  drawScreenEdgeFlash();
  drawBossHitFlash();

  // Fury mode: red border glow
  if (furyActive) {
    const furyPulse = 0.2 + 0.1 * Math.sin(frameCount * 0.15);
    ctx.save();
    ctx.globalAlpha = furyPulse;
    const grad = ctx.createLinearGradient(0, 0, 30, 0);
    grad.addColorStop(0, '#ff0000');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 30, H);
    const grad2 = ctx.createLinearGradient(W, 0, W - 30, 0);
    grad2.addColorStop(0, '#ff0000');
    grad2.addColorStop(1, 'transparent');
    ctx.fillStyle = grad2;
    ctx.fillRect(W - 30, 0, 30, H);
    const grad3 = ctx.createLinearGradient(0, 0, 0, 30);
    grad3.addColorStop(0, '#ff0000');
    grad3.addColorStop(1, 'transparent');
    ctx.fillStyle = grad3;
    ctx.fillRect(0, 0, W, 30);
    const grad4 = ctx.createLinearGradient(0, H, 0, H - 30);
    grad4.addColorStop(0, '#ff0000');
    grad4.addColorStop(1, 'transparent');
    ctx.fillStyle = grad4;
    ctx.fillRect(0, H - 30, W, 30);
    ctx.restore();

    // Fury particles
    if (frameCount % 3 === 0) {
      particles.push({
        x: Math.random() * W,
        y: H,
        vx: (Math.random() - 0.5) * 2,
        vy: -3 - Math.random() * 4,
        life: 20 + Math.random() * 20,
        maxLife: 40,
        size: 2 + Math.random() * 3,
        color: ['#ff0000', '#ff4400', '#ff8800'][Math.floor(Math.random() * 3)],
        type: 'spark',
        opacity: 0.6,
      });
    }
  }

  // Combo background pulse (10+): radial light burst from center
  if (combo >= 10 && comboDisplayTimer > 0) {
    const comboPulse = 0.04 + 0.02 * Math.sin(frameCount * 0.1);
    ctx.save();
    const burstGrad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 400);
    if (combo >= 20) {
      burstGrad.addColorStop(0, `rgba(255,215,0,${comboPulse * 1.5})`);
      burstGrad.addColorStop(0.5, `rgba(255,180,50,${comboPulse * 0.5})`);
    } else {
      burstGrad.addColorStop(0, `rgba(255,136,68,${comboPulse * 1.2})`);
      burstGrad.addColorStop(0.5, `rgba(255,100,50,${comboPulse * 0.4})`);
    }
    burstGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = burstGrad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // Wukong animation
  if (wukongActive) {
    drawWukongAnimation();
  }

  // HUD
  renderHUD();

  // Floating texts
  for (const ft of floatingTexts) {
    const alpha = ft.timer / ft.maxTimer;
    ctx.save();
    ctx.globalAlpha = alpha;
    const ftSize = ft.size || 14;

    if (ft.glow) {
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 12;
    }

    drawInkText(ft.text, ft.x, ft.y - (ft.maxTimer - ft.timer) * 0.5, ftSize, ft.color);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Ink wash sweep transition
  drawInkWashSweep();

  // Wave transition text: scroll/banner with decorative edges
  if (waveTransition > 0) {
    const alpha = Math.min(1, waveTransition / 30);
    const slideIn = waveTransition > 70 ? (90 - waveTransition) / 20 : (waveTransition > 20 ? 1 : waveTransition / 20);
    ctx.save();
    ctx.globalAlpha = alpha;

    const bannerY = H / 2 - 40;
    const bannerH = 80;
    const bannerW = W * 0.85;
    const bannerX = (W - bannerW) / 2;

    // Banner scroll background with gradient
    const bannerGrad = ctx.createLinearGradient(bannerX, bannerY, bannerX, bannerY + bannerH);
    bannerGrad.addColorStop(0, 'rgba(40,30,20,0.9)');
    bannerGrad.addColorStop(0.5, 'rgba(30,22,14,0.95)');
    bannerGrad.addColorStop(1, 'rgba(40,30,20,0.9)');
    ctx.fillStyle = bannerGrad;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    roundRect(bannerX, bannerY, bannerW, bannerH, 4);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Decorative edges (scroll curls)
    ctx.strokeStyle = 'rgba(200,180,140,0.3)';
    ctx.lineWidth = 1.5;
    // Top decorative line
    ctx.beginPath();
    ctx.moveTo(bannerX + 15, bannerY + 5);
    ctx.lineTo(bannerX + bannerW - 15, bannerY + 5);
    ctx.stroke();
    // Bottom decorative line
    ctx.beginPath();
    ctx.moveTo(bannerX + 15, bannerY + bannerH - 5);
    ctx.lineTo(bannerX + bannerW - 15, bannerY + bannerH - 5);
    ctx.stroke();
    // Corner ornaments
    ctx.fillStyle = 'rgba(200,180,140,0.2)';
    const ornSize = 6;
    for (const [ox, oy] of [[bannerX + 10, bannerY + 8], [bannerX + bannerW - 10, bannerY + 8],
                             [bannerX + 10, bannerY + bannerH - 8], [bannerX + bannerW - 10, bannerY + bannerH - 8]]) {
      ctx.beginPath();
      ctx.arc(ox, oy, ornSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Wave name text with glow
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 8;
    drawInkText(waveTransitionText, W / 2, H / 2 - 10, 26, '#f0e6d0', 'center', true);
    ctx.shadowBlur = 0;
    if (waveTransitionSubText && waveTransitionSubText !== waveTransitionText) {
      drawInkText(waveTransitionSubText, W / 2, H / 2 + 18, 13, '#aaa088', 'center');
    }
    ctx.restore();
  }

  // Launch hint
  if (!launched) {
    const blinkAlpha = 0.5 + 0.5 * Math.sin(frameCount * 0.08);
    ctx.save();
    ctx.globalAlpha = blinkAlpha;
    drawInkText('点击发射', W / 2, PADDLE_Y - 50, 16, '#5a4a3a');
    ctx.restore();
  }
}

function renderUpgrade(): void {
  drawPaperBg();

  // Dim overlay
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  ctx.save();
  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 10;
  drawInkText('选择升级', W / 2, 80, 28, '#1a1a2e', 'center', true);
  ctx.shadowBlur = 0;
  ctx.restore();
  drawInkText(`第${wave}波完成!`, W / 2, 120, 16, '#5a4a3a');

  const cardW = 110, cardH = 190;
  const totalW = upgradeChoices.length * cardW + (upgradeChoices.length - 1) * 12;
  const uStartX = (W - totalW) / 2;

  upgradeChoices.forEach((upg, i) => {
    const x = uStartX + i * (cardW + 12);
    const y = 155;

    ctx.save();

    // Card shadow
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;

    // Card body gradient
    const cardGrad = ctx.createLinearGradient(x, y, x, y + cardH);
    cardGrad.addColorStop(0, '#faf0d8');
    cardGrad.addColorStop(0.5, '#f0e4c8');
    cardGrad.addColorStop(1, '#e8d8b8');
    ctx.fillStyle = cardGrad;
    ctx.beginPath();
    roundRect(x, y, cardW, cardH, 10);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Card border frame (double border)
    ctx.strokeStyle = '#5a4a30';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    roundRect(x, y, cardW, cardH, 10);
    ctx.stroke();
    // Inner frame
    ctx.strokeStyle = 'rgba(180,160,120,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    roundRect(x + 4, y + 4, cardW - 8, cardH - 8, 7);
    ctx.stroke();

    // Icon area: darker bg circle with glow
    const iconCx = x + cardW / 2;
    const iconCy = y + 48;
    const iconGrad = ctx.createRadialGradient(iconCx, iconCy, 0, iconCx, iconCy, 28);
    iconGrad.addColorStop(0, 'rgba(42,30,20,0.15)');
    iconGrad.addColorStop(1, 'rgba(42,30,20,0)');
    ctx.fillStyle = iconGrad;
    ctx.beginPath();
    ctx.arc(iconCx, iconCy, 28, 0, Math.PI * 2);
    ctx.fill();

    // Decorative circle around icon
    ctx.strokeStyle = 'rgba(90,70,50,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(iconCx, iconCy, 24, 0, Math.PI * 2);
    ctx.stroke();

    drawInkText(upg.icon, iconCx, iconCy, 30, '#1a1a2e');

    // Divider line between icon and text
    ctx.strokeStyle = 'rgba(90,70,50,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 12, y + 80);
    ctx.lineTo(x + cardW - 12, y + 80);
    ctx.stroke();

    // Title area
    drawInkText(upg.name, x + cardW / 2, y + 98, 16, '#1a1a2e', 'center', true);

    // Description area
    drawInkText(upg.desc, x + cardW / 2, y + 125, 10, '#5a4a3a');

    const cur = getUpgradeStacks(upg.id);
    if (cur > 0) {
      // Stack indicator pips
      ctx.fillStyle = '#8b7530';
      for (let s = 0; s < upg.maxStacks; s++) {
        ctx.globalAlpha = s < cur ? 1 : 0.3;
        ctx.beginPath();
        const pipX = x + cardW / 2 - (upg.maxStacks - 1) * 6 + s * 12;
        ctx.arc(pipX, y + 155, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      drawInkText(`已有 x${cur}`, x + cardW / 2, y + 172, 9, '#8b7530');
    }

    ctx.restore();

    if (clicked && clickX >= x && clickX <= x + cardW && clickY >= y && clickY <= y + cardH) {
      playUpgradeChime();
      applyUpgrade(upg);
      nextWave();
    }
  });

  if (drawButton(W / 2 - 50, 375, 100, 32, '跳过', '#555')) {
    nextWave();
  }
}

function renderDeath(): void {
  drawPaperBg();

  // Dark overlay
  ctx.save();
  ctx.fillStyle = 'rgba(20,10,10,0.15)';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  ctx.save();
  ctx.shadowColor = '#6b2020';
  ctx.shadowBlur = 15;
  drawInkText('游戏结束', W / 2, 100, 36, '#6b2020', 'center', true);
  ctx.shadowBlur = 0;
  ctx.restore();

  // Stats panel
  const statY = 160;
  drawHUDPanel(30, statY - 10, W - 60, 260);

  drawInkText(`${passport.playerName}`, W / 2, statY + 15, 16, '#8b7530');
  drawInkText(`最终分数: ${score}`, W / 2, statY + 45, 20, '#f0e6d0');
  drawInkText(`到达波次: ${wave}/${MAX_WAVES}`, W / 2, statY + 75, 16, '#c0b8a0');
  drawInkText(`获得金币: ${runCoins}`, W / 2, statY + 100, 16, '#ffd700');
  drawInkText(`最高连击: ${maxCombo}`, W / 2, statY + 125, 16, '#c0b8a0');
  drawInkText(`角色: ${selectedChar.name}`, W / 2, statY + 150, 14, '#a09888');

  if (activeUpgrades.length > 0) {
    drawInkText('升级收集:', W / 2, statY + 180, 14, '#a09888');
    const upgText = activeUpgrades.map(au => {
      const def = UPGRADES.find(u => u.id === au.id);
      return def ? `${def.icon}x${au.stacks}` : '';
    }).join(' ');
    drawInkText(upgText, W / 2, statY + 205, 12, '#f0e6d0');
  }

  // New achievements
  if (newAchievements.length > 0) {
    ctx.save();
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 8;
    drawInkText('新印章:', W / 2, statY + 235, 14, '#ffd700');
    ctx.shadowBlur = 0;
    ctx.restore();
    const achText = newAchievements.map(id => {
      const def = ACHIEVEMENTS.find(a => a.id === id);
      return def ? `[${def.icon}]${def.name}` : '';
    }).join(' ');
    drawInkText(achText, W / 2, statY + 258, 12, '#cc8800');
  }

  if (drawButton(W / 2 - 70, 530, 140, 44, '再来一次', '#3a2a1a')) {
    gameScreen = 'charSelect';
  }
  if (drawButton(W / 2 - 70, 590, 140, 44, '分享战绩', '#2a3a2a')) {
    shareResult();
  }
  if (drawButton(W / 2 - 70, 650, 140, 44, '返回主页', '#3c3c2c')) {
    gameScreen = 'title';
  }
}

function renderVictoryScreen(): void {
  drawPaperBg();

  // Golden celebration overlay
  ctx.save();
  const victoryGlow = ctx.createRadialGradient(W / 2, 100, 0, W / 2, 100, 300);
  victoryGlow.addColorStop(0, `rgba(255,215,0,${0.08 + Math.sin(frameCount * 0.04) * 0.03})`);
  victoryGlow.addColorStop(1, 'rgba(255,215,0,0)');
  ctx.fillStyle = victoryGlow;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  ctx.save();
  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 25;
  drawInkText('通关!', W / 2, 80, 42, '#8b7530', 'center', true);
  ctx.shadowBlur = 0;
  ctx.restore();
  drawInkText('山海平定 · 阵法已破', W / 2, 130, 18, '#5a4a3a');

  // Stats panel
  const statY = 170;
  drawHUDPanel(30, statY - 10, W - 60, 220);

  drawInkText(`${passport.playerName}`, W / 2, statY + 15, 16, '#ffd700');
  drawInkText(`最终分数: ${score}`, W / 2, statY + 45, 22, '#f0e6d0');
  drawInkText(`获得金币: ${runCoins}`, W / 2, statY + 75, 16, '#ffd700');
  drawInkText(`角色: ${selectedChar.name}`, W / 2, statY + 100, 14, '#c0b8a0');

  if (activeUpgrades.length > 0) {
    drawInkText('升级收集:', W / 2, statY + 130, 14, '#a09888');
    const upgText = activeUpgrades.map(au => {
      const def = UPGRADES.find(u => u.id === au.id);
      return def ? `${def.icon}x${au.stacks}` : '';
    }).join(' ');
    drawInkText(upgText, W / 2, statY + 155, 12, '#f0e6d0');
  }

  // Achievements
  if (newAchievements.length > 0) {
    ctx.save();
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 10;
    drawInkText('新印章:', W / 2, statY + 185, 14, '#ffd700');
    ctx.shadowBlur = 0;
    ctx.restore();
    const achText = newAchievements.map(id => {
      const def = ACHIEVEMENTS.find(a => a.id === id);
      return def ? `[${def.icon}]${def.name}` : '';
    }).join(' ');
    drawInkText(achText, W / 2, statY + 208, 12, '#cc8800');
  }

  if (drawButton(W / 2 - 70, 500, 140, 44, '再来一次', '#3a2a1a')) {
    gameScreen = 'charSelect';
  }
  if (drawButton(W / 2 - 70, 560, 140, 44, '分享战绩', '#2a3a2a')) {
    shareResult();
  }
  if (drawButton(W / 2 - 70, 620, 140, 44, '返回主页', '#3c3c2c')) {
    gameScreen = 'title';
  }
}

function renderShop(): void {
  drawPaperBg();
  drawInkText('商店', W / 2, 50, 28, '#1a1a2e', 'center', true);

  // Coins display with icon
  ctx.save();
  ctx.fillStyle = '#ffd700';
  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(W / 2 - 55, 85, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
  drawInkText(`${coins}`, W / 2 - 30, 85, 16, '#8b7530', 'left');

  SHOP_ITEMS.forEach((item, i) => {
    const y = 120 + i * 90;
    const level = shopLevels[item.id] || 0;
    const maxed = level >= item.maxLevel;
    const cost = item.cost * (level + 1);

    ctx.save();
    // Card shadow
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;

    const shopGrad = ctx.createLinearGradient(30, y, 30, y + 78);
    shopGrad.addColorStop(0, maxed ? '#e8ddc0' : '#f8f0d8');
    shopGrad.addColorStop(1, maxed ? '#d8cdb0' : '#ece4c8');
    ctx.fillStyle = shopGrad;
    ctx.beginPath();
    roundRect(30, y, W - 60, 78, 8);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.strokeStyle = maxed ? '#a09080' : '#5a4a30';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    roundRect(30, y, W - 60, 78, 8);
    ctx.stroke();
    ctx.restore();

    drawInkText(item.name, 100, y + 22, 16, '#1a1a2e', 'left', true);
    drawInkText(item.desc, 100, y + 45, 11, '#5a4a3a', 'left');

    // Level pips instead of text circles
    for (let l = 0; l < item.maxLevel; l++) {
      ctx.save();
      ctx.fillStyle = l < level ? '#8b7530' : 'rgba(139,117,48,0.25)';
      if (l < level) {
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 4;
      }
      ctx.beginPath();
      ctx.arc(100 + l * 16, y + 64, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    if (maxed) {
      drawInkText('已满', W - 80, y + 40, 14, '#888');
    } else {
      if (drawButton(W - 120, y + 18, 80, 34, `${cost}金`, coins >= cost ? '#3a5a2a' : '#5a3a3a')) {
        if (coins >= cost) {
          coins -= cost;
          shopLevels[item.id] = level + 1;
          saveData();
        }
      }
    }
  });

  if (drawButton(W / 2 - 60, H - 80, 120, 38, '返回', '#3c3c2c')) {
    gameScreen = 'title';
  }
}

function renderLeaderboard(): void {
  drawPaperBg();
  drawInkText('排行榜', W / 2, 50, 28, '#1a1a2e', 'center', true);

  // Weekly best
  if (weeklyBest > 0) {
    drawInkText(`本周最佳: ${weeklyBest}`, W / 2, 80, 14, '#5a7a3a');
  }

  if (leaderboard.length === 0) {
    drawInkText('暂无记录', W / 2, 200, 18, '#888');
  } else {
    const headerY = 105;
    drawInkText('#', 30, headerY, 12, '#888', 'center');
    drawInkText('玩家', 80, headerY, 12, '#888', 'center');
    drawInkText('角色', 145, headerY, 12, '#888', 'center');
    drawInkText('分数', 220, headerY, 12, '#888', 'center');
    drawInkText('波次', 290, headerY, 12, '#888', 'center');
    drawInkText('日期', 350, headerY, 12, '#888', 'center');

    leaderboard.forEach((entry, i) => {
      const y = 135 + i * 32;
      const color = i === 0 ? '#8b7530' : i < 3 ? '#5a4a3a' : '#666';
      drawInkText(`${i + 1}`, 30, y, 14, color, 'center');
      drawInkText(entry.playerName || entry.name, 80, y, 12, color, 'center');
      drawInkText(entry.name, 145, y, 12, color, 'center');
      drawInkText(`${entry.score}`, 220, y, 14, color, 'center');
      drawInkText(`${entry.wave}`, 290, y, 14, color, 'center');
      drawInkText(entry.date, 350, y, 9, color, 'center');
    });
  }

  // Achievement seals section
  drawInkText('印章收集', W / 2, H - 230, 16, '#1a1a2e', 'center', true);
  ACHIEVEMENTS.forEach((ach, i) => {
    const ax = 40 + (i % 5) * 70;
    const ay = H - 200;
    const earned = passport.achievements.includes(ach.id);
    ctx.save();
    ctx.globalAlpha = earned ? 1 : 0.3;
    // Seal circle with gradient and glow
    if (earned) {
      ctx.shadowColor = '#cc2222';
      ctx.shadowBlur = 8;
    }
    const sealGrad = ctx.createRadialGradient(ax + 25, ay + 18, 0, ax + 25, ay + 22, 22);
    sealGrad.addColorStop(0, earned ? '#ee3333' : '#aaa');
    sealGrad.addColorStop(1, earned ? '#992222' : '#777');
    ctx.fillStyle = sealGrad;
    ctx.beginPath();
    ctx.arc(ax + 25, ay + 20, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Border ring
    ctx.strokeStyle = earned ? 'rgba(255,200,200,0.3)' : 'rgba(150,150,150,0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ax + 25, ay + 20, 20, 0, Math.PI * 2);
    ctx.stroke();
    drawInkText(ach.icon, ax + 25, ay + 20, 16, '#f0e6d0');
    ctx.restore();
    drawInkText(ach.name, ax + 25, ay + 50, 9, earned ? '#cc2222' : '#999');
  });

  if (drawButton(W / 2 - 60, H - 80, 120, 38, '返回', '#3c3c2c')) {
    gameScreen = 'title';
  }
}

function shareResult(): void {
  try {
    const challengeCode = score.toString(36).toUpperCase();
    const gameURL = location.origin + location.pathname;
    const text = `【石破天惊】${passport.playerName} 突破第 ${wave} 阵 · ${score}分 · ${runCoins}金\n` +
      `挑战码: ${challengeCode}\n` +
      `来挑战我吧! 👉 ${gameURL}\n` +
      `#麦洛的冒险 #石破天惊`;

    if (navigator.share) {
      navigator.share({ title: '麦洛的冒险：石破天惊', text }).then(() => {
        spawnFloatingText(W / 2, H / 2, '已分享!', '#3a8a3a', 18);
      }).catch(() => { /* user cancelled */ });
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        spawnFloatingText(W / 2, H / 2, '已复制到剪贴板!', '#3a8a3a', 18);
      }).catch(() => {
        spawnFloatingText(W / 2, H / 2, '分享失败', '#8a3a3a', 18);
      });
    }
  } catch (_) { /* share not available */ }
}

function changePlayerName(): void {
  const name = window.prompt('给自己取个名字吧（其他玩家可见）', passport.playerName || '');
  if (name && name.trim()) {
    passport.playerName = name.trim().slice(0, 12);
    saveData();
  }
}

// ============================================================================
// UPDATE & GAME LOOP
// ============================================================================

function update(): void {
  frameCount++;
  bgWaveTime += 0.016;

  // Freeze frame handling
  if (freezeFrames > 0) {
    freezeFrames--;
    return;
  }

  // Screen shake
  if (shakeMag > 0) {
    shakeX = (Math.random() - 0.5) * shakeMag;
    shakeY = (Math.random() - 0.5) * shakeMag;
    shakeMag *= 0.85;
    if (shakeMag < 0.5) { shakeMag = 0; shakeX = 0; shakeY = 0; }
  }

  // Screen edge flash decay
  if (screenEdgeFlash > 0) screenEdgeFlash--;
  if (bossHitFlash > 0) bossHitFlash--;
  if (comboPulseTimer > 0) comboPulseTimer--;
  if (inkWashSweep > 0) inkWashSweep--;

  // Wukong animation
  if (wukongActive) {
    wukongTimer--;
    wukongStaffX = -50 + (1 - wukongTimer / 90) * (W + 100);
    if (wukongTimer <= 0) {
      wukongActive = false;
    }
  }

  // Fury mode timer
  if (furyActive) {
    furyTimer--;
    if (furyTimer <= 0) {
      furyActive = false;
      // Reset ball speed
      for (const b of balls) {
        if (!b.isSpirit) {
          b.speed = b.baseSpeed * (1 + b.comboSpeedBonus);
        }
      }
    }
  }

  // Slow-mo timer
  if (slowMoTimer > 0) {
    slowMoTimer--;
    if (slowMoTimer <= 0) slowMoFactor = 1;
  }

  // Cascade chain display
  if (cascadeChainDisplayTimer > 0) cascadeChainDisplayTimer--;

  // Paddle squash spring animation
  if (paddleSquash > 0.005) {
    paddleSquashVel += -paddleSquash * 0.3;
    paddleSquashVel *= 0.75;
    paddleSquash += paddleSquashVel;
    if (paddleSquash < 0) paddleSquash = 0;
  } else {
    paddleSquash = 0;
  }

  // Name input cursor blink
  nameInputCursorTimer++;
  if (nameInputCursorTimer > 30) {
    nameInputCursor = !nameInputCursor;
    nameInputCursorTimer = 0;
  }

  if (gameScreen !== 'playing') return;

  // Wave transition
  if (waveTransition > 0) {
    waveTransition--;
    return;
  }

  // Combo timer
  if (comboTimer > 0) {
    comboTimer--;
    if (comboTimer <= 0) combo = 0;
  }
  if (comboDisplayTimer > 0) comboDisplayTimer--;

  // Paddle movement
  prevPaddleX = paddleX;
  if (keysDown['ArrowLeft'] || keysDown['a']) {
    paddleTargetX -= 6;
  }
  if (keysDown['ArrowRight'] || keysDown['d']) {
    paddleTargetX += 6;
  }
  if (inputActive) {
    paddleTargetX = inputX;
  }

  const pw = getEffectivePaddleW();
  paddleTargetX = Math.max(WALL_LEFT + pw / 2, Math.min(WALL_RIGHT - pw / 2, paddleTargetX));
  paddleX += (paddleTargetX - paddleX) * 0.3;

  // Paddle ink drips when moving fast
  const paddleSpeed = Math.abs(paddleX - prevPaddleX);
  if (paddleSpeed > 4) {
    spawnPaddleDrips(paddleX, PADDLE_Y + BASE_PADDLE_H / 2, Math.floor(paddleSpeed / 3));
  }

  // Ink drip from paddle edges occasionally
  inkDripTimer--;
  if (inkDripTimer <= 0) {
    inkDripTimer = 30 + Math.floor(Math.random() * 60);
    const side = Math.random() > 0.5 ? 1 : -1;
    spawnInkDrip(paddleX + side * pw / 2, PADDLE_Y + BASE_PADDLE_H / 2);
  }

  // Slow-mo: run fewer update steps
  // Update game objects (slow-mo applied inside ball movement)
  updateBalls();
  updateBricks();
  updateParticles();

  // Floating texts
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    floatingTexts[i].timer--;
    if (floatingTexts[i].timer <= 0) floatingTexts.splice(i, 1);
  }

  checkWaveComplete();
}

function render(): void {
  ctx.clearRect(0, 0, W, H);

  switch (gameScreen) {
    case 'title': renderTitle(); break;
    case 'nameInput': renderNameInput(); break;
    case 'charSelect': renderCharSelect(); break;
    case 'playing': renderPlaying(); break;
    case 'upgrade': renderUpgrade(); break;
    case 'death': renderDeath(); break;
    case 'victory': renderVictoryScreen(); break;
    case 'shop': renderShop(); break;
    case 'leaderboard': renderLeaderboard(); break;
    case 'daily': renderTitle(); break;
  }
}

function gameLoop(timestamp: number): void {
  dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  clicked = false;

  if (pendingClick) {
    clicked = true;
    clickX = pendingClick.x;
    clickY = pendingClick.y;
    pendingClick = null;
  }

  update();
  render();

  clicked = false;

  requestAnimationFrame(gameLoop);
}

// ============================================================================
// INPUT HANDLING
// ============================================================================

let pendingClick: { x: number; y: number } | null = null;

// Touch
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  ensureAudio();
  const touch = e.touches[0];
  const pos = canvasCoords(touch.clientX, touch.clientY);
  inputX = pos.x;
  inputActive = true;
  pendingClick = pos;

  if (gameScreen === 'playing' && !launched) {
    launchBall();
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const pos = canvasCoords(touch.clientX, touch.clientY);
  inputX = pos.x;
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  inputActive = false;
}, { passive: false });

// Mouse
canvas.addEventListener('mousedown', (e) => {
  ensureAudio();
  const pos = canvasCoords(e.clientX, e.clientY);
  inputX = pos.x;
  inputActive = true;
  pendingClick = pos;

  if (gameScreen === 'playing' && !launched) {
    launchBall();
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (inputActive) {
    const pos = canvasCoords(e.clientX, e.clientY);
    inputX = pos.x;
  }
});

canvas.addEventListener('mouseup', () => {
  inputActive = false;
});

// Keyboard
window.addEventListener('keydown', (e) => {
  keysDown[e.key] = true;
  if (e.key === ' ' && gameScreen === 'playing' && !launched) {
    ensureAudio();
    launchBall();
  }
  // Name input handling
  if (gameScreen === 'nameInput') {
    if (e.key === 'Backspace') {
      nameInputText = nameInputText.slice(0, -1);
    } else if (e.key === 'Enter' && nameInputText.length > 0) {
      passport.playerName = nameInputText;
      saveData();
      gameScreen = 'title';
    } else if (e.key.length === 1 && nameInputText.length < 8) {
      nameInputText += e.key;
    }
  }
});

window.addEventListener('keyup', (e) => {
  keysDown[e.key] = false;
});

// ============================================================================
// INIT
// ============================================================================

loadData();

// First launch: show name input
if (!localStorage.getItem('melos_passport')) {
  gameScreen = 'nameInput';
}

lastTime = performance.now();
requestAnimationFrame(gameLoop);
