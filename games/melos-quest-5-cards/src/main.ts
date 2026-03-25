// ============================================================================
// 碎星连珠 — Melo's Quest: Shattered Stars
// A match-3 puzzle game with Chinese Five Elements & explosive chain reactions
// ============================================================================

// --- All top-level variables declared first to avoid TDZ issues ---
const W = 390, H = 844;
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const PR = Math.min(window.devicePixelRatio || 1, 2);

// Grid constants
const COLS = 8, ROWS = 8;
const CELL = 44, GAP = 2;
const GRID_W = COLS * CELL + (COLS - 1) * GAP;
const GRID_H = ROWS * CELL + (ROWS - 1) * GAP;
const GRID_X = (W - GRID_W) / 2;
const GRID_Y = 195;

// Element types
const FIRE = 0, WATER = 1, WOOD = 2, METAL = 3, EARTH = 4;
const ELEM_COUNT = 5;
// Special types
const SP_NONE = 0, SP_STRIPED_H = 1, SP_STRIPED_V = 2, SP_BOMB = 3, SP_RAINBOW = 4;

const ELEM_NAMES = ['火', '水', '木', '金', '土'];
const ELEM_COLORS: [string, string, string][] = [
  ['#ff6644', '#ffaa33', '#ff2200'], // Fire: center, mid, edge
  ['#44aaff', '#66ddff', '#2244cc'], // Water
  ['#44dd55', '#aaff55', '#228833'], // Wood
  ['#ffdd44', '#fff8aa', '#cc9900'], // Metal
  ['#cc8844', '#ffbb66', '#885522'], // Earth
];
const ELEM_GLOW = ['#ff440088', '#44aaff88', '#44dd5588', '#ffdd4488', '#cc884488'];

// Game state
type Screen = 'title' | 'playing' | 'levelComplete' | 'gameOver' | 'collection';
type BoardState = 'idle' | 'selected' | 'swapping' | 'checking' | 'swapBack' |
  'destroying' | 'falling' | 'spawning' | 'cascadeCheck' | 'specialCombo' |
  'bonus' | 'shuffle' | 'levelTransition';

interface Gem {
  type: number;
  special: number;
  vx: number; vy: number;
  vs: number;
  va: number;
  removing: boolean;
  spawning: boolean;
  shimmer: number;
  // Landing bounce
  landBounce: number;    // 0 = no bounce, 1 = just landed
  landBounceV: number;   // velocity for spring
  // Destruction flash timer
  destroyFlash: number;
  // Wink timer for idle animation
  winkTimer: number;
  // Idle float phase (unique per gem)
  idlePhase: number;
  // Swap pop scale (for swap feel)
  swapPop: number;
  // Invalid swap wobble
  wobble: number;
  wobbleCount: number;
  // Hitstop: gem is frozen white before destruction
  hitstop: number;
  // Anticipation particles spawned flag
  hitstopParticlesSpawned: boolean;
  // Dust landing flag
  dustSpawned: boolean;
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string;
  size: number;
  type: 'spark' | 'star' | 'ring' | 'trail' | 'ember' | 'droplet' | 'leaf' | 'shard' | 'fragment' | 'beam' | 'dust' | 'anticipation';
  rotation?: number;
  rotSpeed?: number;
  // For anticipation particles: target position to converge toward
  targetX?: number;
  targetY?: number;
}

interface FloatingText {
  x: number; y: number;
  text: string;
  color: string;
  size: number;
  life: number; maxLife: number;
  vy: number;
}

interface LevelDef {
  target: number;
  moves: number;
}

interface MeloPassport {
  totalCoins: number;
  gamesPlayed: Record<string, number>;
  achievements: string[];
  playerName: string;
}

// Animation durations (seconds)
const ANIM_SWAP = 0.18;
const ANIM_DESTROY = 0.22;
const ANIM_FALL_ROW = 0.06;
const ANIM_BONUS_DELAY = 0.12;

// State variables
let screen: Screen = 'title';
let boardState: BoardState = 'idle';
let grid: (Gem | null)[][] = [];
let selectedR = -1, selectedC = -1;
let swapR1 = -1, swapC1 = -1, swapR2 = -1, swapC2 = -1;
let justSwapped = false;
let cascadeLevel = 0;
let animTimer = 0;
let frameCount = 0;
let lastTime = 0;
let score = 0;
let displayScore = 0; // for rolling score counter
let movesLeft = 0;
let level = 1;
let totalScore = 0;
let highScore = 0;
let comboText = '';
let comboTextTimer = 0;
let shakeX = 0, shakeY = 0, shakeMag = 0, shakeTimer = 0;
let slowMo = 1.0;
let slowMoTimer = 0;
let screenFlash = 0;
let particles: Particle[] = [];
let floatingTexts: FloatingText[] = [];
let tapX = -1, tapY = -1;
let tapConsumed = false;
let titleGemAngle = 0;
let bonusMoves = 0;
let bonusTimer = 0;
let levelScore = 0;
let stars = 0;
let shuffleTimer = 0;
let hintTimer = 0;
let hintR1 = -1, hintC1 = -1, hintR2 = -1, hintC2 = -1;
let boardTexture: CanvasPattern | null = null;
let levelTransTimer = 0;
let pendingSpecials: {r: number, c: number, special: number, type: number}[] = [];
let screenTransition = 0;
let matchSetsThisStep: {r: number, c: number}[][] = [];
let bonusPhase: 'placing' | 'exploding' | 'done' = 'placing';

// New: Swipe/drag input state
let dragActive = false;
let dragStartR = -1, dragStartC = -1;
let dragStartX = 0, dragStartY = 0;
let dragExecuted = false;

// New: ambient particles for background
let ambientParticles: {x: number, y: number, vx: number, vy: number, life: number, size: number, alpha: number}[] = [];

// New: board breathing effect
let boardBreathTimer = 0;
let boardBreathMag = 0;

// New: idle timer for wink animation
let idleTimer = 0;

// Multiplier display
let multiplierDisplay = 0;
let multiplierTimer = 0;

// Score HUD juice
let scorePopTimer = 0;
let lastDisplayedScore = 0;

// Combo escalation: board pulse, brighten, slam
let boardPulseTimer = 0;
let boardBrightenTimer = 0;
let boardSlamTimer = 0;
let boardSlamPhase: 'lift' | 'slam' | 'none' = 'none';

// Hitstop state
let hitstopTimer = 0;
let hitstopActive = false;

// Audio
let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let audioInited = false;

// Ambient drone state
let droneOsc1: OscillatorNode | null = null;
let droneOsc2: OscillatorNode | null = null;
let droneGain: GainNode | null = null;
let droneMuted = false;
let droneTargetFreq = 55;

// Passport
let passport: MeloPassport = loadPassport();

// Leaderboard
let leaderboard: {name: string, score: number, level: number}[] = [];

// ============================================================================
// RESIZE
// ============================================================================

function resize(): void {
  const scaleX = window.innerWidth / W;
  const scaleY = window.innerHeight / H;
  const scale = Math.min(scaleX, scaleY);
  canvas.width = W * PR;
  canvas.height = H * PR;
  canvas.style.width = `${W * scale}px`;
  canvas.style.height = `${H * scale}px`;
  ctx.setTransform(PR, 0, 0, PR, 0, 0);
  createBoardTexture();
}
resize();
window.addEventListener('resize', resize);

// ============================================================================
// AUDIO ENGINE
// ============================================================================

function initAudio(): void {
  if (audioInited) return;
  try {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(audioCtx.destination);
    audioInited = true;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    // Start ambient drone
    startDrone();
  } catch { /* ignore */ }
}

function playTone(freq: number, dur: number, vol = 0.3, type: OscillatorType = 'sine', detune = 0): void {
  if (!audioCtx || !masterGain) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start();
  osc.stop(audioCtx.currentTime + dur);
}

// Play a tone with delayed onset (for reverb/echo feel)
function playToneDelayed(freq: number, dur: number, vol: number, type: OscillatorType, delayMs: number): void {
  setTimeout(() => playTone(freq, dur, vol, type), delayMs);
}

function playNoise(dur: number, vol = 0.1, filterFreq = 2000, filterType: BiquadFilterType = 'lowpass'): void {
  if (!audioCtx || !masterGain) return;
  const bufSize = Math.floor(audioCtx.sampleRate * dur);
  const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const filter = audioCtx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain!);
  src.start();
  src.stop(audioCtx.currentTime + dur);
}

function playSweep(startF: number, endF: number, dur: number, vol = 0.2, type: OscillatorType = 'sine'): void {
  if (!audioCtx || !masterGain) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(startF, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(endF, audioCtx.currentTime + dur);
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start();
  osc.stop(audioCtx.currentTime + dur);
}

// --- Ambient Drone ---
function startDrone(): void {
  if (!audioCtx || !masterGain || droneOsc1) return;
  droneGain = audioCtx.createGain();
  droneGain.gain.value = 0.04; // very subtle
  droneGain.connect(masterGain);
  droneOsc1 = audioCtx.createOscillator();
  droneOsc1.type = 'sine';
  droneOsc1.frequency.value = droneTargetFreq;
  droneOsc1.connect(droneGain);
  droneOsc1.start();
  droneOsc2 = audioCtx.createOscillator();
  droneOsc2.type = 'sine';
  droneOsc2.frequency.value = droneTargetFreq * 1.502; // perfect fifth, slightly detuned
  const droneGain2 = audioCtx.createGain();
  droneGain2.gain.value = 0.6; // quieter second voice
  droneOsc2.connect(droneGain2);
  droneGain2.connect(droneGain);
  droneOsc2.start();
}

function updateDrone(dominantElement: number, isComboing: boolean): void {
  if (!droneGain || !droneOsc1 || !droneOsc2 || !audioCtx) return;
  // Mute during combos
  const targetVol = isComboing ? 0.0 : 0.04;
  const now = audioCtx.currentTime;
  droneGain.gain.setTargetAtTime(targetVol, now, 0.3);
  // Shift pitch based on dominant element
  const elemDroneFreq = [55, 65, 49, 82, 41]; // sub-bass variants per element
  const tgt = elemDroneFreq[Math.max(0, Math.min(dominantElement, 4))];
  droneOsc1.frequency.setTargetAtTime(tgt, now, 1.0);
  droneOsc2.frequency.setTargetAtTime(tgt * 1.502, now, 1.0);
}

function getDominantElement(): number {
  const counts = [0, 0, 0, 0, 0];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const g = grid[r]?.[c];
    if (g && !g.removing && g.type >= 0 && g.type < ELEM_COUNT) counts[g.type]++;
  }
  let maxIdx = 0;
  for (let i = 1; i < ELEM_COUNT; i++) if (counts[i] > counts[maxIdx]) maxIdx = i;
  return maxIdx;
}

// Fire: 440Hz, Water: 523Hz, Wood: 330Hz, Metal: 784Hz, Earth: 220Hz
const ELEM_FREQ = [440, 523, 330, 784, 220];

const SFX = {
  // --- A. Element-specific match sounds ---
  gemMatch(type: number, cascade: number): void {
    const pitchMult = Math.pow(1.06, cascade);
    const t = Math.max(0, Math.min(type, 4));
    const baseF = ELEM_FREQ[t];
    const f = baseF * pitchMult;

    switch (t) {
      case FIRE: // Warm sine + distortion crackle
        playTone(f, 0.18, 0.25, 'sine');
        playTone(f * 1.01, 0.15, 0.12, 'sawtooth'); // slight distortion character
        playNoise(0.06, 0.12 + cascade * 0.02, 4000 + cascade * 500); // crackle
        break;
      case WATER: // Pure sine with chorus (two detuned oscillators)
        playTone(f, 0.2, 0.22, 'sine');
        playTone(f, 0.2, 0.15, 'sine', 12); // detuned +12 cents for chorus
        playTone(f, 0.2, 0.15, 'sine', -12); // detuned -12 cents for chorus
        break;
      case WOOD: // Triangle wave, soft organic
        playTone(f, 0.22, 0.22, 'triangle');
        playTone(f * 2, 0.15, 0.06, 'triangle'); // gentle overtone
        break;
      case METAL: // Bright square + metallic ring (high overtone)
        playTone(f, 0.1, 0.2, 'square');
        playTone(f * 3, 0.25, 0.08, 'sine'); // metallic ring overtone
        playTone(f * 5.04, 0.18, 0.04, 'sine'); // inharmonic shimmer
        break;
      case EARTH: // Low sine + sub-bass rumble
        playTone(f, 0.25, 0.28, 'sine');
        playTone(f * 0.5, 0.3, 0.15, 'sine'); // sub-bass
        playNoise(0.1, 0.06, 300, 'lowpass'); // deep rumble
        break;
    }

    // --- B. Rising pitch: harmony at cascade 3+, chord at cascade 5+ ---
    if (cascade >= 3) {
      // Major third harmony
      playTone(f * 1.26, 0.15, 0.12, 'sine');
    }
    if (cascade >= 5) {
      // Full major chord: root + third + fifth
      playTone(f, 0.18, 0.1, 'sine');
      playTone(f * 1.26, 0.18, 0.08, 'sine');
      playTone(f * 1.5, 0.18, 0.08, 'sine');
    }
    // Echo/reverb feel: replay 100ms later at 40% volume
    playToneDelayed(f, 0.12, 0.1, 'sine', 100);
  },
  gemSwap(): void {
    playSweep(300, 600, 0.12, 0.15, 'sine');
  },
  invalidSwap(): void {
    playTone(150, 0.15, 0.2, 'square');
    playTone(120, 0.2, 0.15, 'square');
  },
  specialCreate(): void {
    playTone(600, 0.1, 0.2, 'sine');
    playTone(800, 0.1, 0.2, 'sine');
    setTimeout(() => {
      playTone(1000, 0.15, 0.25, 'sine');
      playTone(1200, 0.2, 0.15, 'triangle');
    }, 80);
  },
  // --- F. Striped: directional sweep ---
  stripedActivate(horizontal = true): void {
    if (horizontal) {
      // Left-to-right pitch sweep
      playSweep(200, 1200, 0.3, 0.3, 'sawtooth');
    } else {
      // Top-to-bottom pitch sweep (high to low)
      playSweep(1200, 200, 0.3, 0.3, 'sawtooth');
    }
    playNoise(0.25, 0.15, 4000);
    // Whoosh tail
    playToneDelayed(800, 0.15, 0.08, 'sine', 150);
  },
  // --- F. Bomb: deep bass THUMP + expanding ring ---
  bombActivate(): void {
    playTone(50, 0.5, 0.45, 'sine'); // deep THUMP
    playTone(80, 0.3, 0.3, 'square');
    // Expanding ring: pitch drops
    playSweep(600, 80, 0.4, 0.2, 'sine');
    playNoise(0.35, 0.3, 1500);
    setTimeout(() => playNoise(0.2, 0.2, 800), 50);
  },
  // --- F. Rainbow: all 5 element tones rapid arpeggio + shimmer ---
  rainbowActivate(): void {
    // Rapid ascending arpeggio of all 5 elements
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        playTone(ELEM_FREQ[i] * 1.5, 0.25, 0.18, 'sine');
        playTone(ELEM_FREQ[i] * 1.5, 0.25, 0.1, 'sine', 15); // shimmer detune
      }, i * 40);
    }
    // High shimmer tail
    setTimeout(() => {
      playTone(2000, 0.4, 0.08, 'sine');
      playTone(2000, 0.4, 0.06, 'sine', 20);
      playTone(2500, 0.35, 0.05, 'triangle');
    }, 200);
    playSweep(300, 1500, 0.5, 0.15, 'triangle');
  },
  comboSound(level: number): void {
    const base = 400 * Math.pow(1.12, level);
    playTone(base, 0.2, 0.3, 'sine');
    playTone(base * 1.25, 0.15, 0.2, 'triangle');
    playTone(base * 1.5, 0.12, 0.15, 'sine');
    if (level >= 4) {
      playSweep(base, base * 2, 0.4, 0.2, 'sawtooth');
      playNoise(0.15, 0.1, 6000);
    }
  },
  // --- E. Level complete: ascending pentatonic C-D-E-G-A-C ---
  levelComplete(): void {
    const notes = [523, 587, 659, 784, 880, 1047]; // C5-D5-E5-G5-A5-C6 pentatonic
    notes.forEach((f, i) => {
      setTimeout(() => {
        playTone(f, 0.4, 0.25, 'sine');
        playTone(f * 0.5, 0.4, 0.12, 'triangle');
        // Subtle reverb echo
        playToneDelayed(f, 0.25, 0.08, 'sine', 80);
      }, i * 100);
    });
  },
  // --- E. Game over: descending minor scale, slower ---
  gameOver(): void {
    const notes = [523, 493, 440, 392, 349, 330, 262]; // C5 down to C4 natural minor
    notes.forEach((f, i) => {
      setTimeout(() => {
        playTone(f, 0.6, 0.2, 'sine');
        playToneDelayed(f, 0.3, 0.06, 'sine', 100);
      }, i * 180);
    });
  },
  bonusMove(): void {
    playSweep(800, 1600, 0.15, 0.2, 'sine');
    playNoise(0.08, 0.1, 5000);
  },
  // --- E. UI tap: crisp click + subtle reverb tail ---
  uiTap(): void {
    playTone(1200, 0.06, 0.15, 'sine');
    playTone(1800, 0.04, 0.08, 'sine');
    // Reverb tail
    playToneDelayed(1200, 0.08, 0.04, 'sine', 60);
  },
  boardShuffle(): void {
    playSweep(600, 200, 0.3, 0.2, 'triangle');
    playNoise(0.3, 0.15, 2000);
    setTimeout(() => playSweep(200, 800, 0.3, 0.2, 'triangle'), 300);
  },
  rainbowCombo(): void {
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        playTone(300 + i * 150, 0.3, 0.2, 'sine');
        playTone((300 + i * 150) * 1.5, 0.2, 0.1, 'triangle');
      }, i * 50);
    }
    setTimeout(() => {
      playTone(60, 0.6, 0.4, 'sine');
      playNoise(0.5, 0.3, 2000);
    }, 400);
  },
  // --- C. Landing sound: pitch based on column, volume/depth based on fall distance ---
  landClink(col = 3, fallDist = 1): void {
    // Column maps to pitch: left=low, right=high
    const basePitch = 1400 + (col / (COLS - 1)) * 1200; // 1400Hz (left) to 2600Hz (right)
    // Heavier falls (greater distance) = louder and deeper
    const depthFactor = Math.min(fallDist / ROWS, 1.0);
    const vol = 0.06 + depthFactor * 0.08;
    const pitchShift = 1.0 - depthFactor * 0.3; // deeper for heavier falls
    playTone(basePitch * pitchShift, 0.06, vol, 'sine');
    playTone(basePitch * pitchShift * 1.5, 0.04, vol * 0.4, 'triangle');
  },
};

// ============================================================================
// PASSPORT
// ============================================================================

function loadPassport(): MeloPassport {
  try {
    const raw = localStorage.getItem('melos_passport');
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {
    totalCoins: 0,
    gamesPlayed: { '百妖长夜': 0, '扶摇万里': 0, '石破天惊': 0, '吞灵化龙': 0, '碎星连珠': 0 },
    achievements: [],
    playerName: '旅行者',
  };
}

function savePassport(): void {
  localStorage.setItem('melos_passport', JSON.stringify(passport));
}

function loadLeaderboardData(): void {
  try {
    const raw = localStorage.getItem('shattered_stars_lb');
    if (raw) leaderboard = JSON.parse(raw);
  } catch { /* ignore */ }
}

function saveLeaderboard(): void {
  localStorage.setItem('shattered_stars_lb', JSON.stringify(leaderboard.slice(0, 10)));
}

function loadHighScore(): void {
  try {
    const raw = localStorage.getItem('shattered_stars_hi');
    if (raw) highScore = parseInt(raw) || 0;
  } catch { /* ignore */ }
}

function saveHighScore(): void {
  if (totalScore > highScore) {
    highScore = totalScore;
    localStorage.setItem('shattered_stars_hi', String(highScore));
  }
}

// ============================================================================
// BOARD TEXTURE
// ============================================================================

function createBoardTexture(): void {
  const tc = document.createElement('canvas');
  tc.width = 64; tc.height = 64;
  const tctx = tc.getContext('2d')!;
  const grad = tctx.createRadialGradient(32, 32, 5, 32, 32, 45);
  grad.addColorStop(0, '#151530');
  grad.addColorStop(1, '#0a0a1e');
  tctx.fillStyle = grad;
  tctx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * 0.15;
    tctx.fillStyle = `rgba(180, 180, 255, ${a})`;
    tctx.fillRect(Math.random() * 64, Math.random() * 64, 1, 1);
  }
  boardTexture = ctx.createPattern(tc, 'repeat');
}

// ============================================================================
// PARTICLE SYSTEM (ENHANCED)
// ============================================================================

function spawnParticle(x: number, y: number, color: string, type: Particle['type'] = 'spark', count = 1): void {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = type === 'spark' ? 80 + Math.random() * 160 :
                  type === 'ember' ? 20 + Math.random() * 40 :
                  type === 'droplet' ? 60 + Math.random() * 120 :
                  type === 'leaf' ? 15 + Math.random() * 30 :
                  type === 'shard' ? 100 + Math.random() * 200 :
                  type === 'fragment' ? 80 + Math.random() * 150 :
                  type === 'beam' ? 5 :
                  30 + Math.random() * 60;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: type === 'ember' ? -(30 + Math.random() * 50) : Math.sin(angle) * speed - (type === 'star' ? 50 : 0),
      life: type === 'ember' ? 0.6 + Math.random() * 0.8 :
            type === 'beam' ? 0.3 + Math.random() * 0.2 :
            0.4 + Math.random() * 0.4,
      maxLife: type === 'ember' ? 0.6 + Math.random() * 0.8 :
               type === 'beam' ? 0.3 + Math.random() * 0.2 :
               0.4 + Math.random() * 0.4,
      color,
      size: type === 'ring' ? 15 + Math.random() * 10 :
            type === 'ember' ? 1.5 + Math.random() * 2 :
            type === 'shard' ? 3 + Math.random() * 5 :
            type === 'fragment' ? 4 + Math.random() * 6 :
            type === 'beam' ? 200 :
            2 + Math.random() * 4,
      type,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 10,
    });
  }
}

function spawnElementShatter(x: number, y: number, type: number, count: number): void {
  const color = type >= 0 && type < 5 ? ELEM_COLORS[type][0] : '#ffffff';
  const midColor = type >= 0 && type < 5 ? ELEM_COLORS[type][1] : '#dddddd';
  // Common shatter pieces
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 100 + Math.random() * 200;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 30,
      life: 0.5 + Math.random() * 0.5,
      maxLife: 0.5 + Math.random() * 0.5,
      color: Math.random() > 0.5 ? color : midColor,
      size: 2 + Math.random() * 4,
      type: 'shard',
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 15,
    });
  }
  // Element-specific extras
  if (type === FIRE) {
    spawnParticle(x, y, '#ff6622', 'ember', Math.floor(count * 0.8));
    spawnParticle(x, y, '#ffaa33', 'ember', Math.floor(count * 0.5));
  } else if (type === WATER) {
    spawnParticle(x, y, '#66ddff', 'droplet', Math.floor(count * 0.8));
    spawnParticle(x, y, '#44aaff', 'droplet', Math.floor(count * 0.5));
  } else if (type === WOOD) {
    spawnParticle(x, y, '#88ff44', 'leaf', Math.floor(count * 0.8));
    spawnParticle(x, y, '#44dd55', 'leaf', Math.floor(count * 0.5));
  } else if (type === METAL) {
    // Spark shower
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 150 + Math.random() * 250;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.2 + Math.random() * 0.3,
        maxLife: 0.2 + Math.random() * 0.3,
        color: Math.random() > 0.5 ? '#ffffff' : '#ffee88',
        size: 1 + Math.random() * 2,
        type: 'spark',
      });
    }
  } else if (type === EARTH) {
    spawnParticle(x, y, '#cc8844', 'fragment', Math.floor(count * 0.8));
    spawnParticle(x, y, '#aa6633', 'fragment', Math.floor(count * 0.5));
  }
}

function spawnMatchParticles(r: number, c: number, type: number, cascade: number): void {
  const cx = cellX(c) + CELL / 2;
  const cy = cellY(r) + CELL / 2;
  const count = 8 + cascade * 4;
  // Shatter into pieces
  spawnElementShatter(cx, cy, type, count);
  // Flash at center
  spawnParticle(cx, cy, '#ffffff', 'star', Math.min(cascade + 1, 6));
  if (cascade >= 3) spawnParticle(cx, cy, '#ffffff', 'ring', 1);
}

function spawnSpecialParticles(r: number, c: number, special: number): void {
  const cx = cellX(c) + CELL / 2;
  const cy = cellY(r) + CELL / 2;
  if (special === SP_STRIPED_H || special === SP_STRIPED_V) {
    // Animated beam effect
    for (let i = 0; i < COLS; i++) spawnParticle(cellX(i) + CELL / 2, cy, '#ffff88', 'spark', 3);
    if (special === SP_STRIPED_V) {
      for (let i = 0; i < ROWS; i++) spawnParticle(cx, cellY(i) + CELL / 2, '#ffff88', 'spark', 3);
    }
    // Beam particle
    particles.push({
      x: special === SP_STRIPED_H ? GRID_X : cx,
      y: special === SP_STRIPED_H ? cy : GRID_Y,
      vx: 0, vy: 0,
      life: 0.35, maxLife: 0.35,
      color: '#ffffcc',
      size: special === SP_STRIPED_H ? GRID_W : GRID_H,
      type: 'beam',
      rotation: special === SP_STRIPED_H ? 0 : Math.PI / 2,
    });
  } else if (special === SP_BOMB) {
    spawnParticle(cx, cy, '#ff8844', 'spark', 25);
    spawnParticle(cx, cy, '#ffff44', 'ring', 3);
    spawnParticle(cx, cy, '#ffffff', 'star', 5);
  } else if (special === SP_RAINBOW) {
    for (let i = 0; i < 5; i++) spawnParticle(cx, cy, ELEM_COLORS[i][0], 'spark', 8);
    spawnParticle(cx, cy, '#ffffff', 'ring', 2);
    spawnParticle(cx, cy, '#ffffff', 'star', 8);
  }
}

function updateParticles(dt: number): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    if (p.type === 'beam') continue; // beams don't move
    if (p.type === 'anticipation') {
      // Converge toward target
      if (p.targetX !== undefined && p.targetY !== undefined) {
        const dx = p.targetX - p.x, dy = p.targetY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 1) {
          const speed = 200 + (1 - p.life / p.maxLife) * 400; // accelerate as they converge
          p.vx = (dx / dist) * speed;
          p.vy = (dy / dist) * speed;
        }
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    } else if (p.type === 'dust') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 80 * dt; // slight gravity on dust
      p.vx *= 0.95;
    } else {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type === 'ember') {
        p.vy -= 40 * dt;
        p.vx += (Math.random() - 0.5) * 100 * dt;
      } else if (p.type === 'leaf') {
        p.vy += 30 * dt;
        p.vx += Math.sin(p.life * 10) * 30 * dt;
      } else if (p.type === 'droplet') {
        p.vy += 300 * dt;
      } else {
        p.vy += 200 * dt;
      }
      p.vx *= 0.97;
    }
    if (p.type === 'ring') p.size += 80 * dt;
    if (p.rotation !== undefined && p.rotSpeed !== undefined) p.rotation += p.rotSpeed * dt;
  }
}

function spawnAnticipationParticles(cx: number, cy: number): void {
  for (let i = 0; i < 6; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 20 + Math.random() * 15;
    particles.push({
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      vx: 0, vy: 0,
      life: 0.06, maxLife: 0.06,
      color: '#ffffff',
      size: 1.5 + Math.random() * 1.5,
      type: 'anticipation',
      targetX: cx,
      targetY: cy,
    });
  }
}

function spawnDustParticles(cx: number, cy: number): void {
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI + Math.random() * Math.PI; // upward half
    const speed = 30 + Math.random() * 50;
    particles.push({
      x: cx + (Math.random() - 0.5) * CELL * 0.5,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: -(20 + Math.random() * 40),
      life: 0.3 + Math.random() * 0.2,
      maxLife: 0.3 + Math.random() * 0.2,
      color: 'rgba(180, 180, 200, 0.5)',
      size: 1.5 + Math.random() * 2,
      type: 'dust',
    });
  }
}

// ============================================================================
// AMBIENT PARTICLES
// ============================================================================

function initAmbientParticles(): void {
  for (let i = 0; i < 30; i++) {
    ambientParticles.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 8,
      vy: -(5 + Math.random() * 10),
      life: Math.random() * 10,
      size: 0.5 + Math.random() * 1.5,
      alpha: 0.1 + Math.random() * 0.2,
    });
  }
}
initAmbientParticles();

function updateAmbientParticles(dt: number): void {
  for (const p of ambientParticles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.y < -10 || p.life < 0) {
      p.x = Math.random() * W;
      p.y = H + 10;
      p.life = 5 + Math.random() * 10;
      p.vx = (Math.random() - 0.5) * 8;
      p.vy = -(5 + Math.random() * 10);
    }
  }
}

// ============================================================================
// FLOATING TEXTS
// ============================================================================

function addFloatingText(x: number, y: number, text: string, color: string, size = 20): void {
  floatingTexts.push({ x, y, text, color, size, life: 1.0, maxLife: 1.0, vy: -60 });
}

function updateFloatingTexts(dt: number): void {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.life -= dt;
    if (ft.life <= 0) { floatingTexts.splice(i, 1); continue; }
    ft.y += ft.vy * dt;
    ft.vy *= 0.95;
  }
}

// ============================================================================
// GRID HELPERS
// ============================================================================

function cellX(c: number): number { return GRID_X + c * (CELL + GAP); }
function cellY(r: number): number { return GRID_Y + r * (CELL + GAP); }

function makeGem(type: number, special = SP_NONE): Gem {
  return { type, special, vx: 0, vy: 0, vs: 1, va: 1, removing: false, spawning: false, shimmer: Math.random() * Math.PI * 2,
    landBounce: 0, landBounceV: 0, destroyFlash: 0, winkTimer: 0,
    idlePhase: Math.random() * Math.PI * 2, swapPop: 0, wobble: 0, wobbleCount: 0,
    hitstop: 0, hitstopParticlesSpawned: false, dustSpawned: false };
}

function randomType(): number { return Math.floor(Math.random() * ELEM_COUNT); }

function initBoard(): void {
  grid = [];
  for (let r = 0; r < ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c < COLS; c++) {
      let type = randomType();
      while (
        (c >= 2 && grid[r][c - 1]?.type === type && grid[r][c - 2]?.type === type) ||
        (r >= 2 && grid[r - 1]?.[c]?.type === type && grid[r - 2]?.[c]?.type === type)
      ) { type = randomType(); }
      grid[r][c] = makeGem(type);
    }
  }
}

function gridSwap(r1: number, c1: number, r2: number, c2: number): void {
  const temp = grid[r1][c1];
  grid[r1][c1] = grid[r2][c2];
  grid[r2][c2] = temp;
}

function isAdjacent(r1: number, c1: number, r2: number, c2: number): boolean {
  return (Math.abs(r1 - r2) + Math.abs(c1 - c2)) === 1;
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}

// ============================================================================
// MATCH FINDING
// ============================================================================

interface MatchGroup {
  cells: {r: number, c: number}[];
  length: number;
  dir: 'h' | 'v';
}

function findMatches(): MatchGroup[] {
  const matches: MatchGroup[] = [];

  for (let r = 0; r < ROWS; r++) {
    let runStart = 0;
    for (let c = 1; c <= COLS; c++) {
      const cur = c < COLS ? grid[r][c] : null;
      const start = grid[r][runStart];
      if (cur && start && cur.type === start.type && cur.type >= 0 && !cur.removing && !start.removing) continue;
      const len = c - runStart;
      if (len >= 3 && start && start.type >= 0) {
        const cells: {r: number, c: number}[] = [];
        for (let i = runStart; i < c; i++) cells.push({ r, c: i });
        matches.push({ cells, length: len, dir: 'h' });
      }
      runStart = c;
    }
  }

  for (let c = 0; c < COLS; c++) {
    let runStart = 0;
    for (let r = 1; r <= ROWS; r++) {
      const cur = r < ROWS ? grid[r][c] : null;
      const start = grid[runStart][c];
      if (cur && start && cur.type === start.type && cur.type >= 0 && !cur.removing && !start.removing) continue;
      const len = r - runStart;
      if (len >= 3 && start && start.type >= 0) {
        const cells: {r: number, c: number}[] = [];
        for (let i = runStart; i < r; i++) cells.push({ r: i, c });
        matches.push({ cells, length: len, dir: 'v' });
      }
      runStart = r;
    }
  }

  return matches;
}

// ============================================================================
// SPECIAL GEM DETERMINATION
// ============================================================================

function determineSpecials(matches: MatchGroup[]): {r: number, c: number, special: number, type: number}[] {
  const specials: {r: number, c: number, special: number, type: number}[] = [];
  const usedCells = new Set<string>();
  const cellKey = (r: number, c: number) => `${r},${c}`;

  const cellMatches = new Map<string, MatchGroup[]>();
  for (const m of matches) {
    for (const cell of m.cells) {
      const key = cellKey(cell.r, cell.c);
      if (!cellMatches.has(key)) cellMatches.set(key, []);
      cellMatches.get(key)!.push(m);
    }
  }

  // L/T intersections → Bomb
  for (const [key, ms] of cellMatches) {
    if (ms.length >= 2 && !usedCells.has(key)) {
      const [rStr, cStr] = key.split(',');
      const r = parseInt(rStr), c = parseInt(cStr);
      const type = grid[r][c]?.type ?? 0;
      let placeR = r, placeC = c;
      for (const m of ms) {
        for (const cell of m.cells) {
          if ((cell.r === swapR1 && cell.c === swapC1) || (cell.r === swapR2 && cell.c === swapC2)) {
            placeR = cell.r; placeC = cell.c;
          }
          usedCells.add(cellKey(cell.r, cell.c));
        }
      }
      specials.push({ r: placeR, c: placeC, special: SP_BOMB, type });
    }
  }

  // 4+ and 5+ specials
  for (const m of matches) {
    const unusedCells = m.cells.filter(c => !usedCells.has(cellKey(c.r, c.c)));
    if (unusedCells.length === 0) continue;
    let placeR = m.cells[Math.floor(m.cells.length / 2)].r;
    let placeC = m.cells[Math.floor(m.cells.length / 2)].c;
    for (const cell of m.cells) {
      if ((cell.r === swapR1 && cell.c === swapC1) || (cell.r === swapR2 && cell.c === swapC2)) {
        placeR = cell.r; placeC = cell.c; break;
      }
    }
    const type = grid[m.cells[0].r][m.cells[0].c]?.type ?? 0;
    if (m.length >= 5) {
      specials.push({ r: placeR, c: placeC, special: SP_RAINBOW, type });
      for (const cell of m.cells) usedCells.add(cellKey(cell.r, cell.c));
    } else if (m.length === 4) {
      const sp = m.dir === 'h' ? SP_STRIPED_V : SP_STRIPED_H;
      specials.push({ r: placeR, c: placeC, special: sp, type });
      for (const cell of m.cells) usedCells.add(cellKey(cell.r, cell.c));
    }
  }

  return specials;
}

// ============================================================================
// SPECIAL GEM ACTIVATION
// ============================================================================

function activateSpecial(r: number, c: number, gem: Gem): {r: number, c: number}[] {
  const cells: {r: number, c: number}[] = [];
  if (gem.special === SP_STRIPED_H) {
    SFX.stripedActivate(true);
    for (let cc = 0; cc < COLS; cc++) if (grid[r][cc] && !grid[r][cc]!.removing) cells.push({ r, c: cc });
  } else if (gem.special === SP_STRIPED_V) {
    SFX.stripedActivate(false);
    for (let rr = 0; rr < ROWS; rr++) if (grid[rr][c] && !grid[rr][c]!.removing) cells.push({ r: rr, c });
  } else if (gem.special === SP_BOMB) {
    SFX.bombActivate();
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc) && grid[nr][nc] && !grid[nr][nc]!.removing) cells.push({ r: nr, c: nc });
    }
  } else if (gem.special === SP_RAINBOW) {
    SFX.rainbowActivate();
    const counts = [0, 0, 0, 0, 0];
    for (let rr = 0; rr < ROWS; rr++) for (let cc = 0; cc < COLS; cc++) {
      const g = grid[rr][cc];
      if (g && g.type >= 0 && g.type < 5 && !g.removing) counts[g.type]++;
    }
    let targetType = counts.indexOf(Math.max(...counts));
    const otherR = (r === swapR1 && c === swapC1) ? swapR2 : swapR1;
    const otherC = (r === swapR1 && c === swapC1) ? swapC2 : swapC1;
    const other = grid[otherR]?.[otherC];
    if (other && other.type >= 0 && other.type < 5) targetType = other.type;
    for (let rr = 0; rr < ROWS; rr++) for (let cc = 0; cc < COLS; cc++) {
      const g = grid[rr][cc];
      if (g && g.type === targetType && !g.removing) cells.push({ r: rr, c: cc });
    }
  }
  spawnSpecialParticles(r, c, gem.special);
  return cells;
}

// ============================================================================
// SPECIAL COMBINATION EFFECTS
// ============================================================================

function handleSpecialCombo(r1: number, c1: number, r2: number, c2: number): boolean {
  const g1 = grid[r1][c1], g2 = grid[r2][c2];
  if (!g1 || !g2) return false;
  if (g1.special === SP_NONE && g2.special === SP_NONE) return false;

  // Both rainbow = clear entire board
  if (g1.special === SP_RAINBOW && g2.special === SP_RAINBOW) {
    SFX.rainbowCombo();
    triggerShake(20); slowMo = 0.2; slowMoTimer = 1.0; screenFlash = 1.0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const g = grid[r][c];
      if (g) { g.removing = true; g.destroyFlash = 0.05; g.vs = 0; g.va = 0; spawnMatchParticles(r, c, g.type, 8); score += 50; levelScore += 50; }
    }
    addFloatingText(W / 2, H / 2 - 50, '天崩地裂!', '#ff4444', 36);
    cascadeLevel = 6; boardState = 'destroying'; animTimer = ANIM_DESTROY * 2;
    return true;
  }

  // Rainbow + any special
  if (g1.special === SP_RAINBOW || g2.special === SP_RAINBOW) {
    const rainbow = g1.special === SP_RAINBOW ? g1 : g2;
    const other = g1.special === SP_RAINBOW ? g2 : g1;
    const otherR = g1.special === SP_RAINBOW ? r2 : r1;
    const otherC = g1.special === SP_RAINBOW ? c2 : c1;
    SFX.rainbowCombo(); triggerShake(15); screenFlash = 0.8;
    let targetType = other.type;
    if (targetType < 0 || targetType >= 5) {
      const counts = [0, 0, 0, 0, 0];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const g = grid[r][c];
        if (g && g.type >= 0 && g.type < 5) counts[g.type]++;
      }
      targetType = counts.indexOf(Math.max(...counts));
    }
    rainbow.removing = true; rainbow.vs = 0; rainbow.va = 0;
    const specialType = other.special !== SP_NONE ? other.special : SP_BOMB;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const g = grid[r][c];
      if (g && g.type === targetType && !g.removing) {
        const extraCells = activateSpecial(r, c, { ...g, special: specialType } as Gem);
        for (const ec of extraCells) {
          const eg = grid[ec.r][ec.c];
          if (eg && !eg.removing) { eg.removing = true; spawnMatchParticles(ec.r, ec.c, eg.type, 5); score += 30; levelScore += 30; }
        }
        g.removing = true; spawnMatchParticles(r, c, g.type, 5); score += 30; levelScore += 30;
      }
    }
    other.removing = true; spawnMatchParticles(otherR, otherC, other.type, 5);
    cascadeLevel = 5; boardState = 'destroying'; animTimer = ANIM_DESTROY * 2;
    return true;
  }

  // Bomb + Bomb = 5x5
  if (g1.special === SP_BOMB && g2.special === SP_BOMB) {
    SFX.bombActivate(); triggerShake(12);
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const nr = r1 + dr, nc = c1 + dc;
      if (inBounds(nr, nc) && grid[nr][nc] && !grid[nr][nc]!.removing) {
        grid[nr][nc]!.removing = true; spawnMatchParticles(nr, nc, grid[nr][nc]!.type, 4); score += 20; levelScore += 20;
      }
    }
    cascadeLevel = 4; boardState = 'destroying'; animTimer = ANIM_DESTROY * 1.5;
    return true;
  }

  // Striped + Bomb = 3 rows + 3 columns
  if ((g1.special === SP_BOMB || g2.special === SP_BOMB) &&
      (g1.special === SP_STRIPED_H || g1.special === SP_STRIPED_V || g2.special === SP_STRIPED_H || g2.special === SP_STRIPED_V)) {
    SFX.stripedActivate(); SFX.bombActivate(); triggerShake(12);
    const cr = r1, cc = c1;
    for (let dr = -1; dr <= 1; dr++) {
      const rr = cr + dr;
      if (rr >= 0 && rr < ROWS) for (let c = 0; c < COLS; c++) {
        if (grid[rr][c] && !grid[rr][c]!.removing) { grid[rr][c]!.removing = true; spawnMatchParticles(rr, c, grid[rr][c]!.type, 3); score += 15; levelScore += 15; }
      }
    }
    for (let dc = -1; dc <= 1; dc++) {
      const ccc = cc + dc;
      if (ccc >= 0 && ccc < COLS) for (let r = 0; r < ROWS; r++) {
        if (grid[r][ccc] && !grid[r][ccc]!.removing) { grid[r][ccc]!.removing = true; spawnMatchParticles(r, ccc, grid[r][ccc]!.type, 3); score += 15; levelScore += 15; }
      }
    }
    cascadeLevel = 4; boardState = 'destroying'; animTimer = ANIM_DESTROY * 1.5;
    return true;
  }

  // Striped + Striped = cross
  if ((g1.special === SP_STRIPED_H || g1.special === SP_STRIPED_V) &&
      (g2.special === SP_STRIPED_H || g2.special === SP_STRIPED_V)) {
    SFX.stripedActivate(); triggerShake(8);
    for (let c = 0; c < COLS; c++) if (grid[r1][c] && !grid[r1][c]!.removing) {
      grid[r1][c]!.removing = true; spawnMatchParticles(r1, c, grid[r1][c]!.type, 3); score += 10; levelScore += 10;
    }
    for (let r = 0; r < ROWS; r++) if (grid[r][c1] && !grid[r][c1]!.removing) {
      grid[r][c1]!.removing = true; spawnMatchParticles(r, c1, grid[r][c1]!.type, 3); score += 10; levelScore += 10;
    }
    cascadeLevel = 3; boardState = 'destroying'; animTimer = ANIM_DESTROY * 1.5;
    return true;
  }

  return false;
}

// ============================================================================
// MATCH PROCESSING (ENHANCED with hitstop flash)
// ============================================================================

function processMatches(matches: MatchGroup[]): void {
  cascadeLevel++;
  pendingSpecials = determineSpecials(matches);

  const cellSet = new Set<string>();
  const allCells: {r: number, c: number}[] = [];
  matchSetsThisStep = [];

  for (const m of matches) {
    const matchCells: {r: number, c: number}[] = [];
    for (const cell of m.cells) {
      const key = `${cell.r},${cell.c}`;
      matchCells.push(cell);
      if (!cellSet.has(key)) { cellSet.add(key); allCells.push(cell); }
    }
    matchSetsThisStep.push(matchCells);
  }

  // Activate specials being destroyed
  const additionalCells: {r: number, c: number}[] = [];
  for (const cell of allCells) {
    const g = grid[cell.r][cell.c];
    if (g && g.special !== SP_NONE) {
      const isBeingCreated = pendingSpecials.some(s => s.r === cell.r && s.c === cell.c);
      if (!isBeingCreated) {
        const extra = activateSpecial(cell.r, cell.c, g);
        for (const e of extra) {
          const key = `${e.r},${e.c}`;
          if (!cellSet.has(key)) { cellSet.add(key); additionalCells.push(e); }
        }
      }
    }
  }
  allCells.push(...additionalCells);

  for (const cell of allCells) {
    const g = grid[cell.r][cell.c];
    if (g) {
      g.removing = true;
      g.hitstop = 0.06; // 60ms hitstop before destruction
      g.hitstopParticlesSpawned = false;
      g.destroyFlash = 0.06; // white flash during hitstop
    }
  }
  hitstopTimer = 0.06;
  hitstopActive = true;

  const baseScore = allCells.length * 10;
  const matchScore = baseScore * cascadeLevel;
  score += matchScore;
  levelScore += matchScore;

  if (allCells.length > 0) SFX.gemMatch(grid[allCells[0].r][allCells[0].c]?.type ?? 0, cascadeLevel);

  const avgR = allCells.reduce((s, c) => s + c.r, 0) / allCells.length;
  const avgC = allCells.reduce((s, c) => s + c.c, 0) / allCells.length;
  addFloatingText(cellX(avgC) + CELL / 2, cellY(avgR) + CELL / 2, `+${matchScore}`, '#ffffff', 16 + Math.min(cascadeLevel * 2, 12));

  // Multiplier display
  if (cascadeLevel >= 2) {
    multiplierDisplay = cascadeLevel;
    multiplierTimer = 1.5;
  }

  if (cascadeLevel >= 2) {
    const texts = ['', '', '好!', '妙!', '绝!', '天降神迹!', '逆天改命!', '开天辟地!'];
    comboText = texts[Math.min(cascadeLevel, 7)];
    comboTextTimer = 1.2;
    SFX.comboSound(cascadeLevel);
  }

  // Enhanced cascade escalation with juice
  if (cascadeLevel >= 2) triggerShake(3);
  if (cascadeLevel >= 3) {
    triggerShake(6); slowMo = 0.7; slowMoTimer = 0.3;
    // Board pulse: all gems briefly pulse scale
    boardPulseTimer = 0.3;
  }
  if (cascadeLevel >= 4) {
    triggerShake(10); slowMo = 0.3; slowMoTimer = 0.5;
    boardPulseTimer = 0.4;
    // Board brighten (lightning flash)
    boardBrightenTimer = 0.15;
  }
  if (cascadeLevel >= 5) {
    triggerShake(15); slowMo = 0.2; slowMoTimer = 0.6; screenFlash = 0.8;
    boardBreathMag = 1.0; boardBreathTimer = 0.5;
    boardPulseTimer = 0.5;
    boardBrightenTimer = 0.2;
    // Slam effect: all gems lift then slam
    boardSlamTimer = 0.4;
    boardSlamPhase = 'lift';
  }
}

// ============================================================================
// GRAVITY & SPAWNING
// ============================================================================

function removeDestroyedGems(): void {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (grid[r][c]?.removing) grid[r][c] = null;
  }
}

function placeSpecials(): void {
  for (const sp of pendingSpecials) {
    const gem = makeGem(sp.type, sp.special);
    gem.vs = 1.5; gem.spawning = true;
    grid[sp.r][sp.c] = gem;
    SFX.specialCreate();
    spawnParticle(cellX(sp.c) + CELL / 2, cellY(sp.r) + CELL / 2, '#ffffff', 'star', 5);
  }
  pendingSpecials = [];
}

function applyGravity(): number {
  let maxDrop = 0;
  for (let c = 0; c < COLS; c++) {
    let writeR = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r][c]) {
        if (r !== writeR) {
          const dropDist = writeR - r;
          grid[writeR][c] = grid[r][c];
          // Stagger: lower rows get a slight head start (negative vy = above current pos)
          // Row-based stagger: gems landing in lower rows get slightly less initial offset
          // This creates a cascade wave where bottom gems land first
          const stagger = (ROWS - 1 - writeR) * 3; // lower rows have less delay
          grid[writeR][c]!.vy = (r - writeR) * (CELL + GAP) + stagger;
          grid[writeR][c]!.landBounce = 1.0;
          grid[writeR][c]!.dustSpawned = false;
          grid[r][c] = null;
          maxDrop = Math.max(maxDrop, dropDist);
        }
        writeR--;
      }
    }
    let emptyCount = 0;
    for (let r = writeR; r >= 0; r--) {
      emptyCount++;
      const gem = makeGem(randomType());
      // Staggered spawn: gems for lower target rows get less initial offset
      const stagger = (ROWS - 1 - r) * 3;
      gem.vy = -(emptyCount) * (CELL + GAP) - 20 + stagger;
      gem.spawning = true;
      gem.landBounce = 1.0;
      gem.dustSpawned = false;
      grid[r][c] = gem;
      maxDrop = Math.max(maxDrop, emptyCount + (writeR - r));
    }
  }
  return maxDrop;
}

// ============================================================================
// VALID MOVES CHECK
// ============================================================================

function hasValidMoves(): boolean {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (c < COLS - 1) {
      gridSwap(r, c, r, c + 1);
      const has = findMatches().length > 0;
      gridSwap(r, c, r, c + 1);
      if (has) return true;
    }
    if (r < ROWS - 1) {
      gridSwap(r, c, r + 1, c);
      const has = findMatches().length > 0;
      gridSwap(r, c, r + 1, c);
      if (has) return true;
    }
  }
  return false;
}

function findHint(): void {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (c < COLS - 1) {
      gridSwap(r, c, r, c + 1);
      if (findMatches().length > 0) { gridSwap(r, c, r, c + 1); hintR1 = r; hintC1 = c; hintR2 = r; hintC2 = c + 1; return; }
      gridSwap(r, c, r, c + 1);
    }
    if (r < ROWS - 1) {
      gridSwap(r, c, r + 1, c);
      if (findMatches().length > 0) { gridSwap(r, c, r + 1, c); hintR1 = r; hintC1 = c; hintR2 = r + 1; hintC2 = c; return; }
      gridSwap(r, c, r + 1, c);
    }
  }
  hintR1 = -1;
}

function shuffleBoard(): void {
  const types: number[] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (grid[r][c]) types.push(grid[r][c]!.type);
  for (let i = types.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [types[i], types[j]] = [types[j], types[i]]; }
  let idx = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (grid[r][c]) { grid[r][c]!.type = types[idx++]; grid[r][c]!.special = SP_NONE; }
  SFX.boardShuffle();
}

// ============================================================================
// LEVEL SYSTEM
// ============================================================================

function getLevelDef(lvl: number): LevelDef {
  return { moves: 20 + Math.floor(lvl / 3) * 2, target: Math.floor(300 * Math.pow(1.35, lvl - 1)) };
}

function startLevel(lvl: number): void {
  level = lvl;
  const def = getLevelDef(lvl);
  movesLeft = def.moves;
  levelScore = 0; cascadeLevel = 0;
  initBoard();
  boardState = 'idle'; selectedR = -1; selectedC = -1;
  hintTimer = 0; hintR1 = -1;
  comboText = ''; comboTextTimer = 0; pendingSpecials = [];
  bonusPhase = 'placing';
  dragActive = false; dragExecuted = false;
}

function startGame(): void {
  score = 0; totalScore = 0; level = 1; displayScore = 0;
  startLevel(1);
  screen = 'playing';
}

function checkLevelComplete(): void {
  const def = getLevelDef(level);
  if (levelScore >= def.target) {
    bonusMoves = movesLeft;
    if (bonusMoves > 0) { boardState = 'bonus'; bonusTimer = ANIM_BONUS_DELAY; bonusPhase = 'placing'; }
    else finishLevel();
  } else if (movesLeft <= 0) {
    endGame();
  }
}

function finishLevel(): void {
  const def = getLevelDef(level);
  stars = 1;
  if (levelScore >= def.target * 1.5) stars = 2;
  if (levelScore >= def.target * 2.0) stars = 3;
  totalScore += levelScore;
  SFX.levelComplete();
  screen = 'levelComplete';
  screenTransition = 1.0;
  saveHighScore();
  passport.gamesPlayed['碎星连珠'] = Math.max(passport.gamesPlayed['碎星连珠'] || 0, level);
  savePassport();
}

function endGame(): void {
  totalScore += levelScore;
  saveHighScore();
  SFX.gameOver();
  screen = 'gameOver'; screenTransition = 1.0;
  leaderboard.push({ name: passport.playerName, score: totalScore, level });
  leaderboard.sort((a, b) => b.score - a.score);
  leaderboard = leaderboard.slice(0, 10);
  saveLeaderboard();
  passport.gamesPlayed['碎星连珠'] = Math.max(passport.gamesPlayed['碎星连珠'] || 0, level);
  savePassport();
}

// ============================================================================
// SCREEN SHAKE
// ============================================================================

function triggerShake(magnitude: number): void {
  shakeMag = Math.max(shakeMag, magnitude);
  shakeTimer = 0.3;
}

function updateShake(dt: number): void {
  if (shakeTimer > 0) {
    shakeTimer -= dt;
    const t = Math.max(0, shakeTimer / 0.3);
    const mag = shakeMag * t;
    shakeX = (Math.random() * 2 - 1) * mag;
    shakeY = (Math.random() * 2 - 1) * mag;
  } else { shakeX = 0; shakeY = 0; shakeMag = 0; }
}

// ============================================================================
// INPUT — SWIPE/DRAG + TAP FALLBACK
// ============================================================================

function canvasPos(clientX: number, clientY: number): {x: number, y: number} {
  const rect = canvas.getBoundingClientRect();
  return { x: (clientX - rect.left) * (W / rect.width), y: (clientY - rect.top) * (H / rect.height) };
}

function gridPos(px: number, py: number): {r: number, c: number} | null {
  const c = Math.floor((px - GRID_X) / (CELL + GAP));
  const r = Math.floor((py - GRID_Y) / (CELL + GAP));
  if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
    const localX = px - cellX(c), localY = py - cellY(r);
    if (localX >= 0 && localX <= CELL && localY >= 0 && localY <= CELL) return { r, c };
  }
  return null;
}

function executeSwap(r1: number, c1: number, r2: number, c2: number): void {
  swapR1 = r1; swapC1 = c1; swapR2 = r2; swapC2 = c2;
  justSwapped = true;
  const g1 = grid[swapR1][swapC1], g2 = grid[swapR2][swapC2];
  if (g1 && g2) {
    // Pop feel: scale up briefly
    g1.swapPop = 1.0;
    g2.swapPop = 1.0;
    const dx = (swapC2 - swapC1) * (CELL + GAP), dy = (swapR2 - swapR1) * (CELL + GAP);
    gridSwap(swapR1, swapC1, swapR2, swapC2);
    grid[swapR1][swapC1]!.vx = dx; grid[swapR1][swapC1]!.vy = dy;
    grid[swapR2][swapC2]!.vx = -dx; grid[swapR2][swapC2]!.vy = -dy;
  }
  SFX.gemSwap(); boardState = 'swapping'; animTimer = ANIM_SWAP;
  selectedR = -1; selectedC = -1;
}

function handleTap(px: number, py: number): void {
  if (screen === 'title') { SFX.uiTap(); startGame(); return; }
  if (screen === 'levelComplete') { SFX.uiTap(); startLevel(level + 1); screen = 'playing'; return; }
  if (screen === 'gameOver') { SFX.uiTap(); screen = 'title'; return; }
  if (screen !== 'playing') return;
  if (boardState !== 'idle' && boardState !== 'selected') return;

  const pos = gridPos(px, py);
  if (!pos) {
    if (boardState === 'selected') { selectedR = -1; selectedC = -1; boardState = 'idle'; }
    return;
  }

  if (boardState === 'idle') {
    selectedR = pos.r; selectedC = pos.c; boardState = 'selected';
    SFX.uiTap(); hintTimer = 0; hintR1 = -1;
    return;
  }

  if (boardState === 'selected') {
    if (pos.r === selectedR && pos.c === selectedC) { selectedR = -1; selectedC = -1; boardState = 'idle'; return; }
    if (isAdjacent(selectedR, selectedC, pos.r, pos.c)) {
      executeSwap(selectedR, selectedC, pos.r, pos.c);
    } else {
      selectedR = pos.r; selectedC = pos.c; SFX.uiTap();
    }
  }
}

// Pointer events: implement press+drag swipe
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault(); initAudio();
  const pos = canvasPos(e.clientX, e.clientY);
  tapX = pos.x; tapY = pos.y; tapConsumed = false;
  dragExecuted = false;

  if (screen === 'playing' && (boardState === 'idle' || boardState === 'selected')) {
    const gp = gridPos(pos.x, pos.y);
    if (gp) {
      dragActive = true;
      dragStartR = gp.r;
      dragStartC = gp.c;
      dragStartX = pos.x;
      dragStartY = pos.y;
      // Immediately select this gem
      selectedR = gp.r; selectedC = gp.c; boardState = 'selected';
      hintTimer = 0; hintR1 = -1;
    }
  }
}, { passive: false });

canvas.addEventListener('pointermove', (e) => {
  e.preventDefault();
  if (!dragActive || dragExecuted) return;
  if (screen !== 'playing') return;
  if (boardState !== 'selected') { dragActive = false; return; }

  const pos = canvasPos(e.clientX, e.clientY);
  const dx = pos.x - dragStartX;
  const dy = pos.y - dragStartY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Threshold: half a cell size to trigger swap
  const threshold = CELL * 0.4;
  if (dist >= threshold) {
    // Determine direction
    let sr = 0, sc = 0;
    if (Math.abs(dx) > Math.abs(dy)) sc = dx > 0 ? 1 : -1;
    else sr = dy > 0 ? 1 : -1;
    const nr = dragStartR + sr, nc = dragStartC + sc;
    if (inBounds(nr, nc) && selectedR === dragStartR && selectedC === dragStartC) {
      executeSwap(dragStartR, dragStartC, nr, nc);
      dragExecuted = true;
      tapConsumed = true;
    }
    dragActive = false;
  }
}, { passive: false });

canvas.addEventListener('pointerup', (e) => {
  e.preventDefault();
  dragActive = false;

  if (!tapConsumed && !dragExecuted) {
    const pos = canvasPos(e.clientX, e.clientY);
    const dx = pos.x - tapX, dy = pos.y - tapY;
    if (dx * dx + dy * dy < 400) {
      // It's a tap
      handleTap(pos.x, pos.y);
    }
    tapConsumed = true;
  }
  dragExecuted = false;
}, { passive: false });

canvas.addEventListener('pointerleave', () => {
  dragActive = false;
});

// ============================================================================
// RENDERING — HELPERS
// ============================================================================

function drawRoundRect(x: number, y: number, w: number, h: number, r: number): void {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawText(text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center'): void {
  ctx.font = `bold ${size}px 'Noto Serif SC', serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}

function drawTextWithShadow(text: string, x: number, y: number, size: number, color: string, shadowColor = 'rgba(0,0,0,0.5)', align: CanvasTextAlign = 'center'): void {
  ctx.font = `bold ${size}px 'Noto Serif SC', serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillStyle = shadowColor; ctx.fillText(text, x + 1, y + 2);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}

// ============================================================================
// RENDERING — UNIQUE ANIMATED GEM VISUALS
// ============================================================================

function drawGemFire(r: number, shimmer: number): void {
  // Inner flame gradient
  const grad = ctx.createRadialGradient(-r * 0.1, r * 0.1, r * 0.05, 0, 0, r);
  grad.addColorStop(0, '#ffee66');
  grad.addColorStop(0.3, '#ff8833');
  grad.addColorStop(0.7, '#ff4411');
  grad.addColorStop(1, '#cc2200');
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = grad; ctx.fill();

  // Pulsing inner glow
  const glowR = r * (0.6 + Math.sin(shimmer * 2) * 0.1);
  const iglow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
  iglow.addColorStop(0, 'rgba(255, 200, 100, 0.6)');
  iglow.addColorStop(1, 'rgba(255, 100, 0, 0)');
  ctx.beginPath(); ctx.arc(0, 0, glowR, 0, Math.PI * 2);
  ctx.fillStyle = iglow; ctx.fill();

  // Flame tongues on top using bezier curves
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
  for (let i = 0; i < 4; i++) {
    const baseX = -r * 0.4 + i * r * 0.27;
    const h = r * (0.3 + Math.sin(shimmer * 3 + i * 1.7) * 0.15 + Math.random() * 0.05);
    ctx.beginPath();
    ctx.moveTo(baseX - r * 0.08, 0);
    ctx.bezierCurveTo(baseX - r * 0.06, -h * 0.5, baseX + r * 0.06, -h * 0.7, baseX, -h);
    ctx.bezierCurveTo(baseX + r * 0.06, -h * 0.7, baseX + r * 0.1, -h * 0.3, baseX + r * 0.08, 0);
    ctx.fillStyle = `rgba(255, ${180 + Math.floor(Math.random() * 60)}, 0, ${0.4 + Math.random() * 0.3})`;
    ctx.fill();
  }
  ctx.restore();
}

function drawGemWater(r: number, shimmer: number): void {
  // Base blue orb
  const grad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r);
  grad.addColorStop(0, '#aaddff');
  grad.addColorStop(0.4, '#44aaff');
  grad.addColorStop(0.8, '#2266dd');
  grad.addColorStop(1, '#1144aa');
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = grad; ctx.fill();

  // Wave line oscillating inside
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
  ctx.strokeStyle = 'rgba(150, 220, 255, 0.5)';
  ctx.lineWidth = 1.5;
  for (let w = 0; w < 3; w++) {
    ctx.beginPath();
    const yOff = -r * 0.3 + w * r * 0.3;
    for (let x = -r; x <= r; x += 2) {
      const waveY = yOff + Math.sin(x * 0.15 + shimmer * 2 + w) * r * 0.1;
      if (x === -r) ctx.moveTo(x, waveY); else ctx.lineTo(x, waveY);
    }
    ctx.stroke();
  }
  ctx.restore();

  // Ripple rings
  const ripplePhase = (shimmer * 0.8) % (Math.PI * 2);
  const rippleR = r * 0.3 + (ripplePhase / (Math.PI * 2)) * r * 0.6;
  const rippleAlpha = 1 - ripplePhase / (Math.PI * 2);
  ctx.beginPath(); ctx.arc(0, 0, rippleR, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(150, 220, 255, ${rippleAlpha * 0.3})`;
  ctx.lineWidth = 1; ctx.stroke();

  // Caustic pattern
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
  ctx.globalAlpha = 0.15;
  for (let i = 0; i < 5; i++) {
    const cx = Math.sin(shimmer + i * 1.3) * r * 0.4;
    const cy = Math.cos(shimmer * 0.7 + i * 1.7) * r * 0.4;
    const cr = r * 0.15 + Math.sin(shimmer * 2 + i) * r * 0.05;
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
    cg.addColorStop(0, '#aaddff');
    cg.addColorStop(1, 'transparent');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawGemWood(r: number, shimmer: number): void {
  // Base green orb
  const grad = ctx.createRadialGradient(-r * 0.15, -r * 0.15, r * 0.1, 0, 0, r);
  grad.addColorStop(0, '#bbff88');
  grad.addColorStop(0.4, '#55cc44');
  grad.addColorStop(0.8, '#338833');
  grad.addColorStop(1, '#226622');
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = grad; ctx.fill();

  // Tree ring / spiral pattern
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
  ctx.strokeStyle = 'rgba(100, 180, 60, 0.3)';
  ctx.lineWidth = 0.8;
  for (let ring = 0; ring < 4; ring++) {
    const rr = r * 0.2 + ring * r * 0.18;
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();

  // Leaf shapes swaying
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2 / 3) + shimmer * 0.3;
    const lx = Math.cos(angle) * r * 0.45;
    const ly = Math.sin(angle) * r * 0.45;
    const sway = Math.sin(shimmer * 1.5 + i * 2) * 0.17; // ±10°
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(angle + sway);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.15, r * 0.08, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(100, 220, 60, ${0.5 + Math.sin(shimmer + i) * 0.2})`;
    ctx.fill();
    // Leaf vein
    ctx.beginPath();
    ctx.moveTo(-r * 0.12, 0);
    ctx.lineTo(r * 0.12, 0);
    ctx.strokeStyle = 'rgba(60, 150, 30, 0.5)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // Green sparkle particles (drawn as small dots)
  for (let i = 0; i < 3; i++) {
    const sx = Math.sin(shimmer * 1.2 + i * 2.3) * r * 0.5;
    const sy = Math.cos(shimmer * 0.9 + i * 3.1) * r * 0.5;
    const sa = 0.3 + Math.sin(shimmer * 3 + i) * 0.3;
    ctx.beginPath(); ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(180, 255, 100, ${sa})`; ctx.fill();
  }
}

function drawGemMetal(r: number, shimmer: number): void {
  // Octagonal faceted shape instead of circle
  ctx.save();
  const sides = 8;
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / sides;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();

  // Metallic gradient
  const grad = ctx.createLinearGradient(-r, -r, r, r);
  grad.addColorStop(0, '#fff8cc');
  grad.addColorStop(0.3, '#ffdd44');
  grad.addColorStop(0.5, '#ffee88');
  grad.addColorStop(0.7, '#ccaa22');
  grad.addColorStop(1, '#aa8800');
  ctx.fillStyle = grad; ctx.fill();

  // Facet edges
  ctx.strokeStyle = 'rgba(255, 255, 200, 0.3)';
  ctx.lineWidth = 1; ctx.stroke();

  // Rotating specular highlight sweep (like CD reflection)
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / sides;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.clip();

  const sweepAngle = shimmer * 1.5;
  const sx = Math.cos(sweepAngle) * r * 1.2;
  const sy = Math.sin(sweepAngle) * r * 1.2;
  const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 0.8);
  sg.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
  sg.addColorStop(0.3, 'rgba(255, 255, 200, 0.3)');
  sg.addColorStop(1, 'rgba(255, 255, 200, 0)');
  ctx.fillStyle = sg;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();

  // Bright white glint that moves
  const glintAngle = shimmer * 2;
  const glintX = Math.cos(glintAngle) * r * 0.4;
  const glintY = Math.sin(glintAngle) * r * 0.4;
  ctx.beginPath(); ctx.arc(glintX, glintY, r * 0.08, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; ctx.fill();
  // Glint cross
  ctx.beginPath();
  ctx.moveTo(glintX - r * 0.15, glintY); ctx.lineTo(glintX + r * 0.15, glintY);
  ctx.moveTo(glintX, glintY - r * 0.15); ctx.lineTo(glintX, glintY + r * 0.15);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}

function drawGemEarth(r: number, shimmer: number): void {
  // Hexagonal crystal shape
  ctx.save();
  const sides = 6;
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 6;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();

  // Amber/brown crystal gradient
  const grad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r);
  grad.addColorStop(0, '#ffcc77');
  grad.addColorStop(0.4, '#cc8844');
  grad.addColorStop(0.8, '#995533');
  grad.addColorStop(1, '#663322');
  ctx.fillStyle = grad; ctx.fill();

  // Crystal fracture lines
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 6;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.clip();

  ctx.strokeStyle = 'rgba(200, 150, 80, 0.3)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 4; i++) {
    const x1 = Math.sin(i * 2.5 + shimmer * 0.1) * r * 0.8;
    const y1 = Math.cos(i * 3.1 + shimmer * 0.12) * r * 0.8;
    const x2 = Math.sin(i * 1.7 + shimmer * 0.08 + 2) * r * 0.9;
    const y2 = Math.cos(i * 2.3 + shimmer * 0.09 + 1) * r * 0.9;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  ctx.restore();

  // Warm amber inner glow
  const glowPhase = 0.5 + Math.sin(shimmer * 1.5) * 0.15;
  const iglow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.6);
  iglow.addColorStop(0, `rgba(255, 200, 100, ${glowPhase * 0.4})`);
  iglow.addColorStop(1, 'rgba(200, 120, 50, 0)');
  ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = iglow; ctx.fill();

  // Crystal edge highlight
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 6;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.strokeStyle = 'rgba(255, 200, 120, 0.4)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}

function drawGem(x: number, y: number, gem: Gem, size: number): void {
  const isSelected = (boardState === 'selected' && selectedR >= 0 &&
    Math.abs(y - cellY(selectedR)) < 2 && Math.abs(x - cellX(selectedC)) < 2);

  // Idle breathing pulse for all gems
  const breathe = 1.0 + Math.sin(gem.shimmer) * 0.015;

  // Idle float: subtle +-1px vertical, unique phase per gem
  const idleFloat = (!gem.removing && !gem.spawning && gem.landBounce <= 0)
    ? Math.sin(gem.idlePhase) * 1.0 : 0;

  // Landing bounce: enhanced squash & stretch
  let scaleX = 1.0, scaleY = 1.0;
  let bounceOffsetY = 0;
  if (gem.landBounce > 0) {
    const t = gem.landBounce;
    // Spring: compress to 0.85x vertical, expand to 1.15x horizontal, spring back
    const spring = Math.sin(t * Math.PI * 3) * t;
    scaleX = 1.0 + spring * 0.15;   // expand wide (up to 1.15x)
    scaleY = 1.0 - spring * 0.15;   // compress short (down to 0.85x)
    bounceOffsetY = Math.sin(t * Math.PI * 2) * t * 4;
  }

  // Swap pop: brief scale up to 1.15x then snap
  let swapPopScale = 1.0;
  if (gem.swapPop > 0) {
    swapPopScale = 1.0 + gem.swapPop * 0.15;
  }

  // Invalid swap wobble: side-to-side 3 times
  let wobbleOffsetX = 0;
  if (gem.wobble > 0) {
    wobbleOffsetX = Math.sin(gem.wobble * Math.PI * 6) * gem.wobble * 5;
  }

  // Board pulse (cascade 3+)
  let pulseScale = 1.0;
  if (boardPulseTimer > 0 && !gem.removing) {
    pulseScale = 1.0 + Math.sin(boardPulseTimer * Math.PI * 4) * 0.05;
  }

  // Board slam offset (cascade 5+)
  let slamOffset = 0;
  if (boardSlamTimer > 0 && !gem.removing) {
    if (boardSlamPhase === 'lift') {
      slamOffset = -Math.sin(boardSlamTimer * Math.PI * 2) * 4;
    } else if (boardSlamPhase === 'slam') {
      slamOffset = Math.sin(boardSlamTimer * Math.PI * 4) * boardSlamTimer * 3;
    }
  }

  // Selected gem scale up
  const selectScale = isSelected ? 1.1 : 1.0;

  const s = size * gem.vs * breathe * selectScale * swapPopScale * pulseScale;
  if (s <= 0 || gem.va <= 0) return;
  ctx.save();
  ctx.globalAlpha = gem.va;
  ctx.translate(x + CELL / 2 + wobbleOffsetX, y + CELL / 2 + bounceOffsetY + idleFloat + slamOffset);
  ctx.scale(scaleX, scaleY);

  const r = s * 0.42;
  const type = gem.type;

  // Drop shadow
  ctx.save();
  ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowOffsetY = 3;
  if (type === METAL) {
    // Octagon shadow
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 8;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
  } else if (type === EARTH) {
    // Hexagon shadow
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
  } else {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  }
  ctx.fillStyle = '#00000001'; ctx.fill();
  ctx.restore();

  // Hitstop + destroy flash: bright white during hitstop, then shatter
  if (gem.hitstop > 0) {
    // Frozen bright white during hitstop
    ctx.beginPath(); ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.7 + gem.hitstop * 5})`;
    ctx.fill();
  } else if (gem.destroyFlash > 0) {
    ctx.beginPath(); ctx.arc(0, 0, r * 1.2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${gem.destroyFlash * 12})`;
    ctx.fill();
  }

  // Draw element-specific visual
  if (type === FIRE) drawGemFire(r, gem.shimmer);
  else if (type === WATER) drawGemWater(r, gem.shimmer);
  else if (type === WOOD) drawGemWood(r, gem.shimmer);
  else if (type === METAL) drawGemMetal(r, gem.shimmer);
  else if (type === EARTH) drawGemEarth(r, gem.shimmer);
  else {
    // Fallback for any other type
    const colors = ['#ffffff', '#ddddff', '#8888aa'];
    const grad = ctx.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.1, 0, 0, r);
    grad.addColorStop(0, colors[1]); grad.addColorStop(0.5, colors[0]); grad.addColorStop(1, colors[2]);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = grad; ctx.fill();
  }

  // Outer glow
  if (type >= 0 && type < 5) {
    ctx.save();
    ctx.shadowBlur = 10 + Math.sin(gem.shimmer) * 3;
    ctx.shadowColor = ELEM_GLOW[type];
    if (type === METAL) {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 8;
        if (i === 0) ctx.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
        else ctx.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
      }
      ctx.closePath();
    } else if (type === EARTH) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
        if (i === 0) ctx.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
        else ctx.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
      }
      ctx.closePath();
    } else {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
    }
    ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.fill();
    ctx.restore();
  }

  // Specular highlight for circle-based gems (fire, water, wood)
  if (type !== METAL && type !== EARTH) {
    ctx.beginPath(); ctx.ellipse(-r * 0.2, -r * 0.3, r * 0.35, r * 0.2, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.15, r * 0.25, r * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
  }

  // Selected glow effect: pulsing glow ring
  if (isSelected) {
    const glowPulse = 0.5 + Math.sin(frameCount * 0.12) * 0.3;
    const glowRadius = r * (1.1 + Math.sin(frameCount * 0.08) * 0.05);
    // Outer glow ring
    ctx.save();
    ctx.shadowBlur = 20 + Math.sin(frameCount * 0.1) * 8;
    ctx.shadowColor = `rgba(255, 255, 255, ${glowPulse})`;
    if (type === METAL) {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 8;
        if (i === 0) ctx.moveTo(Math.cos(a) * glowRadius, Math.sin(a) * glowRadius);
        else ctx.lineTo(Math.cos(a) * glowRadius, Math.sin(a) * glowRadius);
      }
      ctx.closePath();
    } else if (type === EARTH) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
        if (i === 0) ctx.moveTo(Math.cos(a) * glowRadius, Math.sin(a) * glowRadius);
        else ctx.lineTo(Math.cos(a) * glowRadius, Math.sin(a) * glowRadius);
      }
      ctx.closePath();
    } else {
      ctx.beginPath(); ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    }
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 + glowPulse * 0.4})`;
    ctx.lineWidth = 2 + glowPulse;
    ctx.stroke();
    ctx.restore();
    // Inner glow ring (second ring)
    ctx.save();
    ctx.globalAlpha = glowPulse * 0.3;
    ctx.beginPath(); ctx.arc(0, 0, glowRadius + 3, 0, Math.PI * 2);
    ctx.strokeStyle = type >= 0 && type < 5 ? ELEM_COLORS[type][1] : '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  // Wink animation (subtle blink when idle)
  if (gem.winkTimer > 0) {
    const winkAlpha = Math.sin(gem.winkTimer * Math.PI) * 0.4;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${winkAlpha})`; ctx.fill();
  }

  // Special overlays
  if (gem.special === SP_STRIPED_H || gem.special === SP_STRIPED_V) {
    ctx.save(); ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    if (gem.special === SP_STRIPED_H) {
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(-r, i * r * 0.35); ctx.lineTo(r, i * r * 0.35); ctx.stroke(); }
    } else {
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.35, -r); ctx.lineTo(i * r * 0.35, r); ctx.stroke(); }
    }
    ctx.restore();
  }

  if (gem.special === SP_BOMB) {
    const pulse = 0.8 + Math.sin(frameCount * 0.15) * 0.2;
    ctx.beginPath(); ctx.arc(0, 0, r * pulse * 1.1, 0, Math.PI * 2);
    ctx.strokeStyle = '#ff4444aa'; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = '#ffaa44aa'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.5); ctx.lineTo(r * 0.5, r * 0.5);
    ctx.moveTo(r * 0.5, -r * 0.5); ctx.lineTo(-r * 0.5, r * 0.5); ctx.stroke();
  }

  if (gem.special === SP_RAINBOW) {
    const hue = (frameCount * 3) % 360;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.1, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${hue}, 100%, 70%, 0.7)`; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${(hue + 120) % 360}, 100%, 70%, 0.4)`; ctx.lineWidth = 2; ctx.stroke();
    const sparkleAngle = frameCount * 0.08;
    for (let i = 0; i < 4; i++) {
      const a = sparkleAngle + i * Math.PI / 2;
      ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, 2, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${(hue + i * 90) % 360}, 100%, 90%, 0.8)`; ctx.fill();
    }
  }

  ctx.restore();
}

// ============================================================================
// RENDERING — BOARD & UI
// ============================================================================

function drawBoard(): void {
  ctx.save();
  drawRoundRect(GRID_X - 8, GRID_Y - 8, GRID_W + 16, GRID_H + 16, 12);
  ctx.fillStyle = 'rgba(10, 10, 30, 0.8)'; ctx.fill();
  ctx.strokeStyle = 'rgba(100, 120, 200, 0.3)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();

  // Grid cells with faint glow
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    drawRoundRect(cellX(c), cellY(r), CELL, CELL, 6);
    // Subtle cell glow
    const cellGlow = ctx.createRadialGradient(cellX(c) + CELL / 2, cellY(r) + CELL / 2, 0, cellX(c) + CELL / 2, cellY(r) + CELL / 2, CELL * 0.6);
    cellGlow.addColorStop(0, 'rgba(40, 40, 80, 0.5)');
    cellGlow.addColorStop(1, 'rgba(20, 20, 50, 0.5)');
    ctx.fillStyle = cellGlow; ctx.fill();
    ctx.strokeStyle = 'rgba(60, 60, 120, 0.2)'; ctx.lineWidth = 0.5; ctx.stroke();
  }

  // Selection highlight
  if (boardState === 'selected' && selectedR >= 0) {
    ctx.save(); ctx.shadowBlur = 12; ctx.shadowColor = '#ffffff88';
    drawRoundRect(cellX(selectedC) - 2, cellY(selectedR) - 2, CELL + 4, CELL + 4, 8);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }

  // Hint highlight
  if (hintR1 >= 0 && boardState === 'idle') {
    const pulse = 0.5 + Math.sin(frameCount * 0.1) * 0.3;
    ctx.save(); ctx.globalAlpha = pulse;
    for (const [hr, hc] of [[hintR1, hintC1], [hintR2, hintC2]]) {
      drawRoundRect(cellX(hc) - 1, cellY(hr) - 1, CELL + 2, CELL + 2, 7);
      ctx.strokeStyle = '#ffdd44'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();
  }

  // Board brighten effect (lightning flash for cascade 4+)
  if (boardBrightenTimer > 0) {
    ctx.save();
    ctx.globalAlpha = boardBrightenTimer * 2;
    drawRoundRect(GRID_X - 8, GRID_Y - 8, GRID_W + 16, GRID_H + 16, 12);
    ctx.fillStyle = 'rgba(180, 190, 255, 0.3)';
    ctx.fill();
    ctx.restore();
  }

  // Board breathing effect after big combos
  if (boardBreathMag > 0) {
    const breathScale = 1 + Math.sin(frameCount * 0.15) * boardBreathMag * 0.01;
    ctx.save();
    ctx.translate(GRID_X + GRID_W / 2, GRID_Y + GRID_H / 2);
    ctx.scale(breathScale, breathScale);
    ctx.translate(-(GRID_X + GRID_W / 2), -(GRID_Y + GRID_H / 2));
  }

  // Draw gems
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const gem = grid[r][c];
    if (!gem) continue;
    drawGem(cellX(c) + gem.vx, cellY(r) + gem.vy, gem, CELL);
  }

  if (boardBreathMag > 0) {
    ctx.restore();
  }
}

function drawHUD(): void {
  const barGrad = ctx.createLinearGradient(0, 0, 0, 80);
  barGrad.addColorStop(0, 'rgba(10, 10, 40, 0.95)');
  barGrad.addColorStop(1, 'rgba(10, 10, 40, 0.6)');
  ctx.fillStyle = barGrad; ctx.fillRect(0, 0, W, 80);

  drawTextWithShadow(`第 ${level} 关`, 60, 25, 16, '#aaccff');

  // Rolling score display with pop effect
  const dispScore = Math.floor(displayScore);
  if (scorePopTimer > 0) {
    const popScale = 1.0 + scorePopTimer * 0.3; // up to 1.3x
    const goldLerp = Math.min(1, scorePopTimer * 3); // fade from gold to white
    ctx.save();
    ctx.translate(W / 2, 25);
    ctx.scale(popScale, popScale);
    const r = Math.floor(255);
    const g = Math.floor(255 - goldLerp * 34);  // 255 -> 221
    const b = Math.floor(255 - goldLerp * 187);  // 255 -> 68
    drawTextWithShadow(`${dispScore}`, 0, 0, 22, `rgb(${r},${g},${b})`);
    ctx.restore();
  } else {
    drawTextWithShadow(`${dispScore}`, W / 2, 25, 22, '#ffffff');
  }

  const def = getLevelDef(level);
  const progress = Math.min(1, levelScore / def.target);
  drawTextWithShadow(`目标: ${def.target}`, W / 2, 50, 13, '#88aacc');

  const barX = 80, barY = 62, barW = W - 160, barH = 8;
  drawRoundRect(barX, barY, barW, barH, 4); ctx.fillStyle = 'rgba(30, 30, 60, 0.8)'; ctx.fill();
  if (progress > 0) {
    drawRoundRect(barX, barY, barW * progress, barH, 4);
    const pGrad = ctx.createLinearGradient(barX, barY, barX + barW * progress, barY);
    pGrad.addColorStop(0, '#4488ff'); pGrad.addColorStop(1, '#44ffaa');
    ctx.fillStyle = pGrad; ctx.fill();
  }

  drawTextWithShadow(`${movesLeft}`, W - 50, 25, 24, movesLeft <= 3 ? '#ff4444' : '#ffdd44');
  drawTextWithShadow('步', W - 50, 48, 12, '#88aacc');
  drawTextWithShadow(`最高: ${highScore}`, 60, 48, 11, '#666688');

  // Multiplier display during cascades — large, glowing, center-screen
  if (multiplierTimer > 0 && multiplierDisplay >= 2) {
    const mLife = Math.min(1, multiplierTimer / 0.5);
    ctx.save();
    ctx.globalAlpha = mLife * 0.9;
    // Dramatic scale: overshoot then settle
    const t = 1 - mLife;
    const mScale = t < 0.2 ? 1 + (1 - t / 0.2) * 0.5 : 1.0; // overshoot at start
    ctx.translate(W / 2, H / 2 - 60);
    ctx.scale(mScale, mScale);
    // Outer glow
    ctx.shadowBlur = 40; ctx.shadowColor = '#ffaa44';
    drawText(`x${multiplierDisplay}`, 0, 0, 52, '#ffdd44');
    ctx.shadowBlur = 20; ctx.shadowColor = '#ff6600';
    drawText(`x${multiplierDisplay}`, 0, 0, 52, '#ffffff');
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// ============================================================================
// RENDERING — EFFECTS (ENHANCED)
// ============================================================================

function drawParticles(): void {
  for (const p of particles) {
    const life = p.life / p.maxLife;
    ctx.save(); ctx.globalAlpha = life;

    if (p.type === 'beam') {
      // Animated beam of light
      const beamAlpha = life * 0.6;
      ctx.save();
      ctx.globalAlpha = beamAlpha;
      if (p.rotation && Math.abs(p.rotation - Math.PI / 2) < 0.1) {
        // Vertical beam
        const beamW = 8;
        const grad = ctx.createLinearGradient(p.x - beamW, 0, p.x + beamW, 0);
        grad.addColorStop(0, 'rgba(255,255,200,0)');
        grad.addColorStop(0.5, p.color);
        grad.addColorStop(1, 'rgba(255,255,200,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(p.x - beamW, p.y, beamW * 2, p.size);
      } else {
        // Horizontal beam
        const beamH = 8;
        const grad = ctx.createLinearGradient(0, p.y - beamH, 0, p.y + beamH);
        grad.addColorStop(0, 'rgba(255,255,200,0)');
        grad.addColorStop(0.5, p.color);
        grad.addColorStop(1, 'rgba(255,255,200,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(p.x, p.y - beamH, p.size, beamH * 2);
      }
      ctx.restore();
    } else if (p.type === 'spark') {
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * life);
      grad.addColorStop(0, p.color); grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad; ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + life * 0.5), 0, Math.PI * 2); ctx.fill();
    } else if (p.type === 'star') {
      ctx.fillStyle = '#ffffff'; ctx.shadowBlur = 6; ctx.shadowColor = p.color;
      const sz = p.size * life;
      ctx.beginPath(); ctx.moveTo(p.x, p.y - sz); ctx.lineTo(p.x + sz * 0.3, p.y);
      ctx.lineTo(p.x, p.y + sz); ctx.lineTo(p.x - sz * 0.3, p.y); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(p.x - sz, p.y); ctx.lineTo(p.x, p.y + sz * 0.3);
      ctx.lineTo(p.x + sz, p.y); ctx.lineTo(p.x, p.y - sz * 0.3); ctx.closePath(); ctx.fill();
    } else if (p.type === 'ring') {
      ctx.strokeStyle = p.color; ctx.lineWidth = 2 * life;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.stroke();
    } else if (p.type === 'ember') {
      // Glowing ember
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
      grad.addColorStop(0, p.color); grad.addColorStop(0.5, p.color); grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad; ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + life * 0.5), 0, Math.PI * 2); ctx.fill();
    } else if (p.type === 'droplet') {
      // Water droplet - teardrop shape
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(p.vy, p.vx) + Math.PI / 2);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size * 0.6, p.size, 0, 0, Math.PI * 2);
      ctx.fillStyle = p.color; ctx.fill();
      ctx.restore();
    } else if (p.type === 'leaf') {
      // Leaf particle
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation || 0);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size * 1.2, p.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = p.color; ctx.fill();
      ctx.restore();
    } else if (p.type === 'shard') {
      // Angular shard piece
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation || 0);
      ctx.beginPath();
      const sz = p.size * life;
      ctx.moveTo(-sz, -sz * 0.3);
      ctx.lineTo(sz * 0.3, -sz);
      ctx.lineTo(sz, sz * 0.5);
      ctx.lineTo(-sz * 0.3, sz * 0.7);
      ctx.closePath();
      ctx.fillStyle = p.color; ctx.fill();
      ctx.restore();
    } else if (p.type === 'fragment') {
      // Rock fragment
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation || 0);
      const sz = p.size * life;
      ctx.beginPath();
      ctx.moveTo(-sz, 0);
      ctx.lineTo(-sz * 0.3, -sz);
      ctx.lineTo(sz * 0.5, -sz * 0.7);
      ctx.lineTo(sz, sz * 0.2);
      ctx.lineTo(sz * 0.3, sz);
      ctx.closePath();
      ctx.fillStyle = p.color; ctx.fill();
      ctx.restore();
    } else if (p.type === 'trail') {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * life, 0, Math.PI * 2); ctx.fill();
    } else if (p.type === 'dust') {
      // Soft dust puff
      const dustAlpha = life * 0.6;
      ctx.globalAlpha = dustAlpha;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * (1 + (1 - life) * 0.5));
      grad.addColorStop(0, 'rgba(200, 200, 220, 0.6)');
      grad.addColorStop(1, 'rgba(200, 200, 220, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + (1 - life) * 0.5), 0, Math.PI * 2); ctx.fill();
    } else if (p.type === 'anticipation') {
      // Small white converging dot
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 4; ctx.shadowColor = '#ffffff';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * life, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }
}

function drawFloatingTexts(): void {
  for (const ft of floatingTexts) {
    const life = ft.life / ft.maxLife;
    ctx.save(); ctx.globalAlpha = life;
    const scale = 1 + (1 - life) * 0.3;
    ctx.translate(ft.x, ft.y); ctx.scale(scale, scale);
    drawTextWithShadow(ft.text, 0, 0, ft.size, ft.color);
    ctx.restore();
  }
}

function drawComboText(): void {
  if (comboTextTimer <= 0 || !comboText) return;
  const life = comboTextTimer / 1.2;
  ctx.save();
  // Fade out in last 30%
  ctx.globalAlpha = life < 0.3 ? life / 0.3 : 1.0;
  // Bounce in: overshoot scale then settle (elastic ease-out)
  const appear = 1 - life; // 0 at start -> 1 at end
  let scale: number;
  if (appear < 0.15) {
    // Quick overshoot: 0 -> 1.4
    scale = (appear / 0.15) * 1.4;
  } else if (appear < 0.3) {
    // Settle back: 1.4 -> 0.95
    const t = (appear - 0.15) / 0.15;
    scale = 1.4 - t * 0.45;
  } else if (appear < 0.4) {
    // Small bounce: 0.95 -> 1.05
    const t = (appear - 0.3) / 0.1;
    scale = 0.95 + t * 0.1;
  } else {
    // Settle: 1.05 -> 1.0
    const t = Math.min(1, (appear - 0.4) / 0.1);
    scale = 1.05 - t * 0.05;
  }
  ctx.translate(W / 2, GRID_Y - 40); ctx.scale(scale, scale);
  // Dramatic glow
  ctx.shadowBlur = 30; ctx.shadowColor = '#ffdd44';
  drawText(comboText, 0, 0, 36, '#ffdd44');
  ctx.shadowBlur = 15; ctx.shadowColor = '#ff8800';
  drawText(comboText, 0, 0, 36, '#ffffff');
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawScreenFlash(): void {
  if (screenFlash <= 0) return;
  ctx.save(); ctx.globalAlpha = screenFlash * 0.5;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawAmbientParticles(): void {
  ctx.save();
  for (const p of ambientParticles) {
    ctx.globalAlpha = p.alpha * 0.6;
    ctx.fillStyle = '#aabbee';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ============================================================================
// RENDERING — SCREENS
// ============================================================================

function drawTitle(): void {
  if (boardTexture) { ctx.fillStyle = boardTexture; ctx.fillRect(0, 0, W, H); }
  else { ctx.fillStyle = '#0a0a1e'; ctx.fillRect(0, 0, W, H); }

  // Stars
  ctx.save();
  for (let i = 0; i < 80; i++) {
    const sx = (Math.sin(i * 137.508 + frameCount * 0.001) * 0.5 + 0.5) * W;
    const sy = (Math.cos(i * 97.3 + frameCount * 0.0015) * 0.5 + 0.5) * H;
    ctx.globalAlpha = 0.3 + Math.sin(frameCount * 0.05 + i) * 0.3;
    ctx.fillStyle = '#aabbff'; ctx.beginPath(); ctx.arc(sx, sy, 1, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // Ambient particles on title
  drawAmbientParticles();

  // Orbiting gems with NEW animated visuals + particle trails
  titleGemAngle += 0.01;
  for (let i = 0; i < 5; i++) {
    const angle = titleGemAngle + i * (Math.PI * 2 / 5);
    const orbitR = 100 + Math.sin(angle * 0.5) * 15;
    const gx = W / 2 + Math.cos(angle) * orbitR - CELL / 2;
    const gy = 260 + Math.sin(angle) * 40 - CELL / 2;
    const depth = (Math.sin(angle) + 1) / 2;
    const gem = makeGem(i);
    gem.vs = 0.7 + depth * 0.4; gem.va = 0.5 + depth * 0.5;
    gem.shimmer = frameCount * 0.05 + i;
    drawGem(gx, gy, gem, CELL);

    // Particle trail behind orbiting gems
    if (frameCount % 3 === 0) {
      const color = ELEM_COLORS[i][0];
      particles.push({
        x: gx + CELL / 2, y: gy + CELL / 2,
        vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10,
        life: 0.5 + Math.random() * 0.5, maxLife: 0.5 + Math.random() * 0.5,
        color, size: 1 + Math.random() * 2, type: 'trail',
      });
    }
  }

  // Title with shimmer/sparkle effect
  ctx.save();
  ctx.shadowBlur = 30; ctx.shadowColor = '#4488ff';
  drawText('碎星连珠', W / 2, 170, 42, '#ffffff');
  ctx.shadowBlur = 0; ctx.restore();
  drawText('碎星连珠', W / 2, 170, 42, '#eeeeff');

  // Shimmer sparkle on title text
  const shimmerX = W / 2 - 80 + ((frameCount * 2) % 160);
  ctx.save();
  ctx.globalAlpha = 0.5 + Math.sin(frameCount * 0.1) * 0.3;
  ctx.beginPath(); ctx.arc(shimmerX, 170, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff'; ctx.shadowBlur = 8; ctx.shadowColor = '#ffffff';
  ctx.fill();
  ctx.restore();

  drawText('Shattered Stars', W / 2, 210, 14, '#6688aa');
  drawText('麦洛的冒险 · 伍', W / 2, 340, 14, 'rgba(100, 120, 180, 0.6)');

  // Start button
  const btnY = 430;
  ctx.save();
  drawRoundRect(W / 2 - 100, btnY - 25, 200, 50, 25);
  const btnGrad = ctx.createLinearGradient(W / 2 - 100, btnY - 25, W / 2 + 100, btnY + 25);
  btnGrad.addColorStop(0, '#2244aa'); btnGrad.addColorStop(1, '#4466cc');
  ctx.fillStyle = btnGrad; ctx.fill();
  ctx.shadowBlur = 15; ctx.shadowColor = '#4488ff88';
  ctx.strokeStyle = '#6688dd'; ctx.lineWidth = 1; ctx.stroke();
  ctx.shadowBlur = 0; ctx.restore();

  const pulse = 0.8 + Math.sin(frameCount * 0.06) * 0.2;
  ctx.save(); ctx.globalAlpha = pulse;
  drawText('开始冒险', W / 2, btnY, 20, '#ffffff');
  ctx.restore();

  if (highScore > 0) drawText(`最高分: ${highScore}`, W / 2, 510, 14, '#6688aa');
  drawText(passport.playerName, W / 2, 550, 13, '#445566');
  drawText('JoyBoy Games', W / 2, H - 40, 11, 'rgba(100, 100, 150, 0.4)');
}

function drawLevelComplete(): void {
  ctx.save(); ctx.globalAlpha = 0.7; ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, W, H); ctx.restore();
  const life = Math.min(1, (1 - screenTransition) * 2);
  ctx.save(); ctx.globalAlpha = life;

  drawRoundRect(W / 2 - 150, 200, 300, 350, 20);
  const panelGrad = ctx.createLinearGradient(W / 2 - 150, 200, W / 2 + 150, 550);
  panelGrad.addColorStop(0, '#1a1a40'); panelGrad.addColorStop(1, '#0a0a2a');
  ctx.fillStyle = panelGrad; ctx.fill();
  ctx.strokeStyle = '#4466aa'; ctx.lineWidth = 1; ctx.stroke();

  ctx.shadowBlur = 15; ctx.shadowColor = '#ffdd44';
  drawText('关卡完成!', W / 2, 250, 28, '#ffdd44');
  ctx.shadowBlur = 0;

  for (let i = 0; i < 3; i++) {
    const sx = W / 2 - 60 + i * 60;
    const filled = i < stars;
    ctx.font = `${filled ? 36 : 30}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (filled) { ctx.shadowBlur = 10; ctx.shadowColor = '#ffdd44'; }
    ctx.fillStyle = filled ? '#ffdd44' : '#333355';
    ctx.fillText('\u2605', sx, 300); ctx.shadowBlur = 0;
  }

  drawText(`得分: ${levelScore}`, W / 2, 360, 20, '#ffffff');
  drawText(`第 ${level} 关`, W / 2, 395, 16, '#8899bb');

  drawRoundRect(W / 2 - 80, 450, 160, 44, 22);
  ctx.fillStyle = '#2244aa'; ctx.fill();
  drawText('下一关', W / 2, 472, 18, '#ffffff');
  ctx.restore();
}

function drawGameOver(): void {
  ctx.save(); ctx.globalAlpha = 0.8; ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, W, H); ctx.restore();
  const life = Math.min(1, (1 - screenTransition) * 2);
  ctx.save(); ctx.globalAlpha = life;

  drawRoundRect(W / 2 - 160, 150, 320, 500, 20);
  const panelGrad = ctx.createLinearGradient(W / 2 - 160, 150, W / 2 + 160, 650);
  panelGrad.addColorStop(0, '#1a0a0a'); panelGrad.addColorStop(1, '#0a0a1a');
  ctx.fillStyle = panelGrad; ctx.fill();
  ctx.strokeStyle = '#663333'; ctx.lineWidth = 1; ctx.stroke();

  drawText('游戏结束', W / 2, 200, 28, '#ff6644');
  drawText(`最终得分: ${totalScore}`, W / 2, 260, 20, '#ffffff');
  drawText(`到达第 ${level} 关`, W / 2, 295, 16, '#8899bb');

  if (totalScore >= highScore && totalScore > 0) {
    ctx.save(); ctx.shadowBlur = 10; ctx.shadowColor = '#ffdd44';
    drawText('新纪录!', W / 2, 335, 22, '#ffdd44'); ctx.restore();
  }

  drawText('排行榜', W / 2, 380, 16, '#aabbcc');
  for (let i = 0; i < Math.min(5, leaderboard.length); i++) {
    const entry = leaderboard[i], ey = 405 + i * 28;
    const rank = i === 0 ? '1.' : i === 1 ? '2.' : i === 2 ? '3.' : `${i + 1}.`;
    drawText(rank, W / 2 - 100, ey, 14, '#888888', 'left');
    drawText(entry.name, W / 2 - 50, ey, 14, '#cccccc', 'left');
    drawText(`${entry.score}`, W / 2 + 110, ey, 14, '#aaaacc', 'right');
  }

  drawRoundRect(W / 2 - 80, 560, 160, 40, 20);
  ctx.fillStyle = '#2244aa'; ctx.fill();
  drawText('再来一局', W / 2, 580, 16, '#ffffff');
  ctx.restore();
}

// ============================================================================
// RENDERING — BACKGROUND
// ============================================================================

function drawBackground(): void {
  if (boardTexture) { ctx.fillStyle = boardTexture; ctx.fillRect(0, 0, W, H); }
  else { ctx.fillStyle = '#0a0a1e'; ctx.fillRect(0, 0, W, H); }

  ctx.save();
  for (let i = 0; i < 40; i++) {
    const sx = ((i * 137.508) % 1) * W, sy = ((i * 97.3 + 0.3) % 1) * H;
    ctx.globalAlpha = 0.15 + Math.sin(frameCount * 0.03 + i * 2) * 0.1;
    ctx.fillStyle = '#8899cc'; ctx.beginPath(); ctx.arc(sx, sy, 0.8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // Ambient floating particles (stardust)
  drawAmbientParticles();

  const vig = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.9);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  // Enhanced vignette during big cascades
  const vigAlpha = 0.4 + (cascadeLevel >= 4 ? 0.2 : 0);
  vig.addColorStop(1, `rgba(0,0,0,${vigAlpha})`);
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
}

// ============================================================================
// UPDATE
// ============================================================================

function updateGemAnimations(dt: number): void {
  const speed = 12;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const gem = grid[r][c];
    if (!gem) continue;

    const prevVy = gem.vy;
    gem.vx += (0 - gem.vx) * Math.min(1, speed * dt);

    // Quadratic easing for falling: accelerate as gems fall
    if (Math.abs(gem.vy) > 0.5) {
      // Use quadratic easing: speed up as offset decreases
      const fallSpeed = speed * (1 + Math.abs(gem.vy) / 100); // accelerate based on remaining distance
      gem.vy += (0 - gem.vy) * Math.min(1, fallSpeed * dt);
    } else {
      gem.vy = 0;
    }

    // Detect landing: vy was significant and now near zero
    if (gem.landBounce > 0 && Math.abs(gem.vy) < 2 && Math.abs(prevVy) > 8) {
      // Trigger bounce spring
      gem.landBounceV = 1;
      SFX.landClink();
      // Spawn dust particles at landing point
      if (!gem.dustSpawned) {
        gem.dustSpawned = true;
        spawnDustParticles(cellX(c) + CELL / 2, cellY(r) + CELL);
      }
    }

    // Update landing bounce spring (150ms duration = dt * 6.67)
    if (gem.landBounce > 0) {
      gem.landBounce -= dt * 6.67; // ~150ms total
      if (gem.landBounce < 0) { gem.landBounce = 0; gem.dustSpawned = false; }
    }

    // Swap pop decay
    if (gem.swapPop > 0) {
      gem.swapPop -= dt * 8; // fast decay ~125ms
      if (gem.swapPop < 0) gem.swapPop = 0;
    }

    // Invalid swap wobble
    if (gem.wobble > 0) {
      gem.wobble -= dt * 5;
      if (gem.wobble < 0) gem.wobble = 0;
    }

    // Hitstop: freeze during hitstop, then shatter
    if (gem.hitstop > 0) {
      gem.hitstop -= dt;
      // Spawn anticipation particles during hitstop
      if (!gem.hitstopParticlesSpawned) {
        gem.hitstopParticlesSpawned = true;
        spawnAnticipationParticles(cellX(c) + CELL / 2, cellY(r) + CELL / 2);
      }
      if (gem.hitstop <= 0) {
        // Now actually shatter
        spawnMatchParticles(r, c, gem.type, cascadeLevel);
      }
    }

    if (gem.removing) {
      gem.destroyFlash -= dt;
      // Only shrink/fade after hitstop is done
      if (gem.hitstop <= 0) {
        gem.vs += (0 - gem.vs) * Math.min(1, 10 * dt);
        gem.va += (0 - gem.va) * Math.min(1, 10 * dt);
      }
    } else if (gem.spawning) {
      gem.vs += (1 - gem.vs) * Math.min(1, 12 * dt);
      if (Math.abs(gem.vs - 1) < 0.02) { gem.vs = 1; gem.spawning = false; }
    }
    gem.shimmer += dt * 3;

    // Idle float: subtle +-1px vertical per gem
    gem.idlePhase += dt * 1.5;

    // Wink timer
    if (gem.winkTimer > 0) gem.winkTimer -= dt;
  }
}

function allAnimsDone(): boolean {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const gem = grid[r][c];
    if (!gem) continue;
    if (Math.abs(gem.vx) > 1 || Math.abs(gem.vy) > 1) return false;
    if (gem.removing && gem.vs > 0.05) return false;
    if (gem.spawning) return false;
  }
  return true;
}

function update(dt: number): void {
  frameCount++;
  let effectiveDt = dt;
  if (slowMoTimer > 0) { slowMoTimer -= dt; effectiveDt = dt * slowMo; if (slowMoTimer <= 0) slowMo = 1.0; }
  if (screenFlash > 0) screenFlash -= dt * 3;
  if (screenTransition > 0) screenTransition -= dt * 2;
  if (comboTextTimer > 0) comboTextTimer -= dt;
  if (multiplierTimer > 0) multiplierTimer -= dt;
  if (boardBreathTimer > 0) { boardBreathTimer -= dt; if (boardBreathTimer <= 0) boardBreathMag = 0; }
  if (boardBreathMag > 0) boardBreathMag *= (1 - dt * 2);
  if (boardPulseTimer > 0) boardPulseTimer -= dt;
  if (boardBrightenTimer > 0) boardBrightenTimer -= dt;
  if (boardSlamTimer > 0) {
    boardSlamTimer -= dt;
    if (boardSlamPhase === 'lift' && boardSlamTimer < 0.2) boardSlamPhase = 'slam';
    if (boardSlamTimer <= 0) boardSlamPhase = 'none';
  }
  if (hitstopTimer > 0) hitstopTimer -= dt;
  if (hitstopActive && hitstopTimer <= 0) hitstopActive = false;
  // Score pop timer
  if (scorePopTimer > 0) scorePopTimer -= dt;
  // Detect score change for pop effect
  const currentDispScore = Math.floor(displayScore);
  if (currentDispScore > lastDisplayedScore + 5) {
    scorePopTimer = 0.3;
    lastDisplayedScore = currentDispScore;
  }

  // Rolling score counter
  if (displayScore < levelScore) {
    const diff = levelScore - displayScore;
    displayScore += Math.max(1, diff * dt * 8);
    if (displayScore > levelScore) displayScore = levelScore;
  }

  // Idle timer for wink animation
  if (screen === 'playing' && (boardState === 'idle' || boardState === 'selected')) {
    hintTimer += dt;
    idleTimer += dt;
    if (hintTimer >= 5 && hintR1 < 0) findHint();

    // Random sparkle wink every 4-5 seconds
    if (idleTimer >= 2) {
      if (Math.random() < dt * 0.22) { // ~once per 4.5s
        const wr = Math.floor(Math.random() * ROWS);
        const wc = Math.floor(Math.random() * COLS);
        if (grid[wr][wc] && !grid[wr][wc]!.removing) {
          grid[wr][wc]!.winkTimer = 0.4;
        }
      }
    }
  } else {
    idleTimer = 0;
  }

  updateShake(dt);
  updateParticles(effectiveDt);
  updateFloatingTexts(effectiveDt);
  updateAmbientParticles(effectiveDt);

  // D. Update ambient drone based on board state
  if (audioInited && screen === 'playing') {
    const isComboing = cascadeLevel >= 2;
    updateDrone(getDominantElement(), isComboing);
  }

  if (screen !== 'playing') return;

  updateGemAnimations(effectiveDt);
  animTimer -= effectiveDt;

  switch (boardState) {
    case 'idle': case 'selected': break;

    case 'swapping':
      if (animTimer <= 0 && allAnimsDone()) {
        const g1 = grid[swapR1][swapC1], g2 = grid[swapR2][swapC2];
        if (g1 && g2 && g1.special !== SP_NONE && g2.special !== SP_NONE) {
          if (handleSpecialCombo(swapR1, swapC1, swapR2, swapC2)) { movesLeft--; justSwapped = false; hintTimer = 0; hintR1 = -1; idleTimer = 0; break; }
        }
        boardState = 'checking';
      }
      break;

    case 'checking': {
      const matches = findMatches();
      if (matches.length > 0) {
        processMatches(matches);
        boardState = 'destroying'; animTimer = ANIM_DESTROY;
        if (justSwapped) { movesLeft--; justSwapped = false; hintTimer = 0; hintR1 = -1; idleTimer = 0; }
      } else if (justSwapped) {
        gridSwap(swapR1, swapC1, swapR2, swapC2);
        const g1 = grid[swapR1][swapC1], g2 = grid[swapR2][swapC2];
        if (g1 && g2) {
          const dx = (swapC2 - swapC1) * (CELL + GAP), dy = (swapR2 - swapR1) * (CELL + GAP);
          g1.vx = dx; g1.vy = dy; g2.vx = -dx; g2.vy = -dy;
          // Wobble/shake for invalid swap
          g1.wobble = 1.0; g1.wobbleCount = 0;
          g2.wobble = 1.0; g2.wobbleCount = 0;
        }
        SFX.invalidSwap(); justSwapped = false;
        boardState = 'swapBack'; animTimer = ANIM_SWAP * 1.5; // slightly longer for wobble
      } else {
        cascadeLevel = 0; boardState = 'idle';
        if (!hasValidMoves()) { shuffleBoard(); boardState = 'shuffle'; shuffleTimer = 0.6; }
        else checkLevelComplete();
      }
      break;
    }

    case 'swapBack':
      if (animTimer <= 0 && allAnimsDone()) boardState = 'idle';
      break;

    case 'destroying':
      if (animTimer <= 0) {
        removeDestroyedGems(); placeSpecials();
        const maxDrop = applyGravity();
        boardState = 'falling'; animTimer = Math.max(0.15, maxDrop * ANIM_FALL_ROW);
      }
      break;

    case 'falling':
      if (animTimer <= 0 && allAnimsDone()) boardState = 'checking';
      break;

    case 'shuffle':
      shuffleTimer -= dt;
      if (shuffleTimer <= 0) {
        if (!hasValidMoves()) { shuffleBoard(); shuffleTimer = 0.6; }
        else boardState = 'idle';
      }
      break;

    case 'bonus':
      bonusTimer -= dt;
      if (bonusTimer <= 0 && bonusPhase === 'placing') {
        if (bonusMoves > 0) {
          bonusMoves--; movesLeft--;
          const validCells: {r: number, c: number}[] = [];
          for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
            if (grid[r][c] && grid[r][c]!.special === SP_NONE) validCells.push({ r, c });
          }
          if (validCells.length > 0) {
            const cell = validCells[Math.floor(Math.random() * validCells.length)];
            const specials = [SP_STRIPED_H, SP_STRIPED_V, SP_BOMB];
            grid[cell.r][cell.c]!.special = specials[Math.floor(Math.random() * specials.length)];
            spawnParticle(cellX(cell.c) + CELL / 2, cellY(cell.r) + CELL / 2, '#ffdd44', 'star', 5);
            SFX.bonusMove(); triggerShake(3);
          }
          bonusTimer = ANIM_BONUS_DELAY;
        } else {
          // Activate all specials
          bonusPhase = 'exploding';
          for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
            const g = grid[r][c];
            if (g && g.special !== SP_NONE && !g.removing) {
              const cells = activateSpecial(r, c, g);
              for (const cell of cells) {
                const eg = grid[cell.r][cell.c];
                if (eg && !eg.removing) { eg.removing = true; spawnMatchParticles(cell.r, cell.c, eg.type, 5); score += 20; levelScore += 20; }
              }
              g.removing = true; spawnMatchParticles(r, c, g.type, 5); score += 20; levelScore += 20;
            }
          }
          triggerShake(15); screenFlash = 0.8;
          boardState = 'destroying'; animTimer = ANIM_DESTROY * 2;
          bonusPhase = 'done';
        }
      }
      break;

    case 'levelTransition': break;
  }

  // After cascades from bonus resolve
  if (bonusPhase === 'done' && boardState === 'idle') {
    bonusPhase = 'placing';
    finishLevel();
  }
}

// ============================================================================
// RENDER
// ============================================================================

function render(): void {
  ctx.clearRect(0, 0, W, H);
  if (screen === 'title') { drawTitle(); drawParticles(); return; }

  ctx.save(); ctx.translate(shakeX, shakeY);
  drawBackground(); drawBoard(); drawHUD();
  drawParticles(); drawFloatingTexts(); drawComboText();
  ctx.restore();

  drawScreenFlash();
  if (screen === 'levelComplete') drawLevelComplete();
  if (screen === 'gameOver') drawGameOver();
}

// ============================================================================
// GAME LOOP
// ============================================================================

function gameLoop(timestamp: number): void {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;
  update(dt); render();
  requestAnimationFrame(gameLoop);
}

// ============================================================================
// INIT
// ============================================================================

loadLeaderboardData();
loadHighScore();

// Suppress unused
void matchSetsThisStep;
void levelTransTimer;
void FIRE; void WATER; void WOOD; void METAL; void EARTH;
void hitstopActive;

lastTime = performance.now();
requestAnimationFrame(gameLoop);
