// ============================================================================
// 渡劫天梯 — Melo's Quest 10: Tribulation Climb
// A Crossy Road / Frogger style lane-hopper set in Chinese mythology
// tribulation (渡劫) theme. Climb upward through 5 realms of obstacles.
// Pure Canvas2D, zero external assets, Web Audio procedural synthesis.
// ============================================================================

// ─── Canvas Setup ───────────────────────────────────────────────────────────
const W = 390, H = 844;
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const PR = Math.min(window.devicePixelRatio || 1, 2);

canvas.width = W * PR;
canvas.height = H * PR;
canvas.style.width = `${W}px`;
canvas.style.height = `${H}px`;
ctx.scale(PR, PR);

function resizeCanvas() {
  const sx = window.innerWidth / W;
  const sy = window.innerHeight / H;
  const s = Math.min(sx, sy);
  canvas.style.width = `${W * s}px`;
  canvas.style.height = `${H * s}px`;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ─── Constants ──────────────────────────────────────────────────────────────
const LANE_H = 54;
const COLS = 7;
const CELL_W = W / COLS;
const PLAYER_START_ROW = 3;
const MAX_PARTICLES = 350;
const GOLD = '#c8a96e';
const GOLD_DARK = '#a07e48';
const INK = '#1a1a2e';
const HOP_DUR = 0.13;
const COMBO_TIMEOUT = 1.0;

// ─── Realm Definitions ─────────────────────────────────────────────────────
const enum Realm { Wind, Thunder, Fire, Ice, Chaos }

interface RealmDef {
  name: string; nameEn: string;
  bg1: string; bg2: string;
  accent: string; accent2: string;
  obsColor: string;
  lane: [string, string];
}

const REALMS: RealmDef[] = [
  { name: '风劫', nameEn: 'Wind',    bg1: '#0d1b2a', bg2: '#1b2838', accent: '#5588bb', accent2: '#88bbdd', obsColor: '#6699cc', lane: ['#162636', '#1a2d40'] },
  { name: '雷劫', nameEn: 'Thunder', bg1: '#0e0e1e', bg2: '#1a1a30', accent: '#9955dd', accent2: '#cc88ff', obsColor: '#aa66ee', lane: ['#151528', '#1a1a33'] },
  { name: '火劫', nameEn: 'Fire',    bg1: '#1e0e0a', bg2: '#2e1510', accent: '#dd6622', accent2: '#ff9944', obsColor: '#ee5511', lane: ['#251812', '#2e1c15'] },
  { name: '冰劫', nameEn: 'Ice',     bg1: '#0a1520', bg2: '#0e1e2e', accent: '#44ccdd', accent2: '#88eeff', obsColor: '#55ddee', lane: ['#0e1e28', '#122430'] },
  { name: '混沌劫', nameEn: 'Chaos', bg1: '#0e0e12', bg2: '#18141e', accent: '#dd44aa', accent2: '#ffcc33', obsColor: '#ff55cc', lane: ['#1a1220', '#201625'] },
];

// ─── Lane Types ─────────────────────────────────────────────────────────────
const enum LaneKind { Safe, Road, River, Hazard, Bonus, Boss }
const enum Dir { Left = -1, Right = 1 }

// ─── Interfaces ─────────────────────────────────────────────────────────────
interface Lane {
  kind: LaneKind; realm: Realm; y: number;
  obs: Obs[]; items: Item[];
  riverDir?: Dir; riverSpd?: number;
  hazTimer?: number; hazActive?: boolean; hazWarn?: number;
  bossHP?: number; bossMaxHP?: number; bossAtkTimer?: number; bossPat?: number;
  windDir?: Dir; windStr?: number;
  icy?: boolean;
}

interface Obs {
  x: number; w: number; spd: number; dir: Dir;
  visual: string; active: boolean; timer?: number;
}

interface Item {
  col: number; kind: 'stone' | 'shield' | 'fly' | 'freeze';
  taken: boolean; bob: number;
}

interface Ptcl {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number;
  color: string; sz: number;
  tag: string;
}

interface Passport {
  name: string; avatar: string; gamesPlayed: number;
  completedGames: string[]; currentStreak: number;
  totalScore: number; lastPlayed: string;
}

interface Skin {
  name: string; desc: string;
  c1: string; c2: string; scarf: string;
  cost: number; ability: string; abilityDesc: string;
  unlocked: boolean;
}

// ─── Achievement System (Red Seal Stamps) ─────────────────────────────────
interface Achievement {
  id: string; name: string; desc: string;
  check: () => boolean; unlocked: boolean;
  notifyT: number; // timer for notification popup
}

const ACHIEVEMENTS: Achievement[] = [
  { id: 'wind_50', name: '初渡风劫', desc: '通过50条道', check: () => maxRow >= 50, unlocked: false, notifyT: 0 },
  { id: 'thunder_100', name: '雷霆不惊', desc: '不死通过100条道', check: () => maxRow >= 100 && !pDead && deathCount === 0, unlocked: false, notifyT: 0 },
  { id: 'fire_stones', name: '火中取栗', desc: '收集50颗灵石', check: () => lifetimeStonesCollected >= 50, unlocked: false, notifyT: 0 },
  { id: 'ice_combo', name: '冰清玉洁', desc: '20连击', check: () => maxComboEver >= 20, unlocked: false, notifyT: 0 },
  { id: 'chaos_200', name: '超脱混沌', desc: '到达第200条道', check: () => maxRow >= 200, unlocked: false, notifyT: 0 },
];

let deathCount = 0;
let lifetimeStonesCollected = 0;
let maxComboEver = 0;
let achNotifyQueue: Achievement[] = [];
let achNotifyActive: Achievement | null = null;
let achNotifyTimer = 0;

function loadAchievements() {
  try {
    const d = localStorage.getItem('crossy_ach');
    if (d) {
      const saved = JSON.parse(d) as Record<string, boolean>;
      for (const a of ACHIEVEMENTS) { if (saved[a.id]) a.unlocked = true; }
    }
    lifetimeStonesCollected = parseInt(localStorage.getItem('crossy_lsc') || '0') || 0;
    maxComboEver = parseInt(localStorage.getItem('crossy_mce') || '0') || 0;
  } catch { /* */ }
}

function saveAchievements() {
  try {
    const d: Record<string, boolean> = {};
    for (const a of ACHIEVEMENTS) d[a.id] = a.unlocked;
    localStorage.setItem('crossy_ach', JSON.stringify(d));
    localStorage.setItem('crossy_lsc', '' + lifetimeStonesCollected);
    localStorage.setItem('crossy_mce', '' + maxComboEver);
  } catch { /* */ }
}

function checkAchievements() {
  for (const a of ACHIEVEMENTS) {
    if (!a.unlocked && a.check()) {
      a.unlocked = true;
      achNotifyQueue.push(a);
      saveAchievements();
    }
  }
}

function tickAchNotify(dt: number) {
  if (achNotifyActive) {
    achNotifyTimer -= dt;
    if (achNotifyTimer <= 0) achNotifyActive = null;
  }
  if (!achNotifyActive && achNotifyQueue.length > 0) {
    achNotifyActive = achNotifyQueue.shift()!;
    achNotifyTimer = 3.0;
    sfx('realm');
  }
}

function drawAchNotify() {
  if (!achNotifyActive) return;
  const a = achNotifyActive;
  const p = Math.min(1, achNotifyTimer / 0.3, (3.0 - (3.0 - achNotifyTimer)) > 2.5 ? (3.0 - achNotifyTimer) / 0.3 : 1);
  const fadeOut = achNotifyTimer < 0.5 ? achNotifyTimer / 0.5 : 1;
  const alpha = Math.min(p, fadeOut);
  const slideY = 60 + (1 - alpha) * -40;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Red seal stamp background
  const bw = 280, bh = 70;
  const bx = W / 2 - bw / 2, by = slideY;
  ctx.fillStyle = '#1a0a0a';
  rr(bx, by, bw, bh, 10); ctx.fill();
  ctx.strokeStyle = '#cc3333';
  ctx.lineWidth = 2;
  rr(bx, by, bw, bh, 10); ctx.stroke();

  // Red seal circle
  ctx.fillStyle = '#cc3333';
  ctx.beginPath(); ctx.arc(bx + 35, by + bh / 2, 20, 0, 6.28); ctx.fill();
  ctx.fillStyle = '#ffdddd';
  ctx.font = 'bold 16px "Noto Serif SC",serif'; ctx.textAlign = 'center';
  ctx.fillText('印', bx + 35, by + bh / 2 + 6);

  // Text
  ctx.fillStyle = '#cc3333'; ctx.font = 'bold 16px "Noto Serif SC",serif'; ctx.textAlign = 'left';
  ctx.fillText(a.name, bx + 65, by + 28);
  ctx.fillStyle = '#aa8888'; ctx.font = '12px "Noto Serif SC",serif';
  ctx.fillText(a.desc, bx + 65, by + 50);

  ctx.restore();
}

function drawAchievementScreen() {
  ctx.fillStyle = '#0a0a2a'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#cc3333'; ctx.font = 'bold 28px "Noto Serif SC",serif'; ctx.textAlign = 'center';
  ctx.fillText('红印成就', W / 2, 80);
  ctx.fillStyle = '#aa666688'; ctx.font = '14px "Noto Serif SC",serif';
  ctx.fillText('修仙印鉴', W / 2, 110);

  const cw = 320, ch = 80, gap = 12;
  const sx0 = W / 2 - cw / 2, sy0 = 140;
  for (let i = 0; i < ACHIEVEMENTS.length; i++) {
    const a = ACHIEVEMENTS[i];
    const cy = sy0 + i * (ch + gap);

    // Card background
    ctx.fillStyle = a.unlocked ? '#1a0808' : '#111122';
    rr(sx0, cy, cw, ch, 8); ctx.fill();
    ctx.strokeStyle = a.unlocked ? '#cc3333' : '#333344';
    ctx.lineWidth = 1.5;
    rr(sx0, cy, cw, ch, 8); ctx.stroke();

    // Seal stamp
    if (a.unlocked) {
      ctx.fillStyle = '#cc3333';
      ctx.beginPath(); ctx.arc(sx0 + 40, cy + ch / 2, 22, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#ffdddd';
      ctx.font = 'bold 18px "Noto Serif SC",serif'; ctx.textAlign = 'center';
      ctx.fillText('印', sx0 + 40, cy + ch / 2 + 6);
    } else {
      ctx.strokeStyle = '#444466';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx0 + 40, cy + ch / 2, 22, 0, 6.28); ctx.stroke();
      ctx.fillStyle = '#444466';
      ctx.font = '18px "Noto Serif SC",serif'; ctx.textAlign = 'center';
      ctx.fillText('?', sx0 + 40, cy + ch / 2 + 6);
    }

    // Title and desc
    ctx.fillStyle = a.unlocked ? '#cc3333' : '#666688';
    ctx.font = 'bold 16px "Noto Serif SC",serif'; ctx.textAlign = 'left';
    ctx.fillText(a.name, sx0 + 75, cy + 30);
    ctx.fillStyle = a.unlocked ? '#aa8888' : '#555566';
    ctx.font = '12px "Noto Serif SC",serif';
    ctx.fillText(a.desc, sx0 + 75, cy + 52);
  }

  drawBtn(W / 2 - 80, H - 80, 160, 44, '返回', GOLD_DARK, '#fff');
}

// ─── Tutorial Overlay ─────────────────────────────────────────────────────
let tutorialShown = false;
let tutorialPage = 0;
const TUTORIAL_PAGES = [
  { title: '渡劫天梯', sub: '修仙者的天路历程', lines: ['点击/上划 = 前进', '左右划 = 左右移动', '下划 = 后退'] },
  { title: '五大劫难', sub: '风·雷·火·冰·混沌', lines: ['每个境界有独特障碍', '集齐灵石解锁角色', '收集道具助你渡劫'] },
  { title: '道具说明', sub: '天降灵物', lines: ['护盾: 挡一次伤害', '飞行: 飞越数条道', '时停: 冻结障碍2秒'] },
  { title: '连击系统', sub: '快速跳跃累积连击', lines: ['连跳越快分数越高', '达成成就解锁红印', '挑战每日排行榜!'] },
];

function drawTutorial() {
  ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, W, H);

  const pg = TUTORIAL_PAGES[tutorialPage];

  // Decorative border
  ctx.strokeStyle = GOLD + '44'; ctx.lineWidth = 2;
  rr(30, 120, W - 60, H - 280, 12); ctx.stroke();

  // Page indicator dots
  for (let i = 0; i < TUTORIAL_PAGES.length; i++) {
    ctx.fillStyle = i === tutorialPage ? GOLD : GOLD + '33';
    ctx.beginPath(); ctx.arc(W / 2 - 30 + i * 20, 160, 4, 0, 6.28); ctx.fill();
  }

  // Title
  ctx.fillStyle = GOLD; ctx.font = 'bold 32px "Noto Serif SC",serif'; ctx.textAlign = 'center';
  ctx.shadowColor = GOLD; ctx.shadowBlur = 10;
  ctx.fillText(pg.title, W / 2, 230);
  ctx.shadowBlur = 0;

  // Subtitle
  ctx.fillStyle = GOLD + 'aa'; ctx.font = '16px "Noto Serif SC",serif';
  ctx.fillText(pg.sub, W / 2, 265);

  // Content lines
  ctx.fillStyle = '#ccccdd'; ctx.font = '16px "Noto Serif SC",serif';
  for (let i = 0; i < pg.lines.length; i++) {
    ctx.fillText(pg.lines[i], W / 2, 330 + i * 40);
  }

  // Visual illustration based on page
  if (tutorialPage === 0) {
    // Draw arrow keys
    const ax = W / 2, ay = 480;
    ctx.fillStyle = GOLD + '44';
    ctx.beginPath(); ctx.moveTo(ax, ay - 30); ctx.lineTo(ax - 15, ay - 10); ctx.lineTo(ax + 15, ay - 10); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(ax - 35, ay); ctx.lineTo(ax - 15, ay - 10); ctx.lineTo(ax - 15, ay + 10); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(ax + 35, ay); ctx.lineTo(ax + 15, ay - 10); ctx.lineTo(ax + 15, ay + 10); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(ax, ay + 30); ctx.lineTo(ax - 15, ay + 10); ctx.lineTo(ax + 15, ay + 10); ctx.closePath(); ctx.fill();
  } else if (tutorialPage === 1) {
    // Draw realm colors
    const colors = ['#5588bb', '#9955dd', '#dd6622', '#44ccdd', '#dd44aa'];
    const names = ['风', '雷', '火', '冰', '混'];
    for (let i = 0; i < 5; i++) {
      const rx = W / 2 - 100 + i * 50;
      ctx.fillStyle = colors[i]; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.arc(rx, 490, 16, 0, 6.28); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.font = 'bold 14px "Noto Serif SC",serif';
      ctx.fillText(names[i], rx, 496);
    }
  } else if (tutorialPage === 2) {
    // Draw item icons
    const items: Array<{ name: string; color: string; icon: string }> = [
      { name: '护盾', color: '#55aaff', icon: '盾' },
      { name: '飞行', color: '#ffdd55', icon: '飞' },
      { name: '时停', color: '#aaddff', icon: '冰' },
    ];
    for (let i = 0; i < items.length; i++) {
      const ix = W / 2 - 80 + i * 80;
      ctx.fillStyle = items[i].color;
      ctx.beginPath(); ctx.arc(ix, 490, 18, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#111'; ctx.font = 'bold 14px "Noto Serif SC",serif';
      ctx.fillText(items[i].icon, ix, 496);
    }
  }

  // Navigation buttons
  if (tutorialPage < TUTORIAL_PAGES.length - 1) {
    drawBtn(W / 2 - 80, H - 140, 160, 44, '下一页', GOLD, INK);
  } else {
    drawBtn(W / 2 - 80, H - 140, 160, 44, '开始修仙!', GOLD, INK);
  }
  if (tutorialPage > 0) {
    drawBtn(30, H - 140, 80, 44, '上一页', GOLD_DARK, '#fff');
  }
  drawBtn(W - 110, H - 140, 80, 44, '跳过', '#44444488', '#aaa');
}

// ─── Share Card ─────────────────────────────────────────────────────────────
let showShareCard = false;

function drawShareCard() {
  ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, W, H);

  // Card
  const cw = 320, ch = 440;
  const cx = W / 2 - cw / 2, cy = H / 2 - ch / 2 - 20;

  // Card bg with gradient
  const g = ctx.createLinearGradient(cx, cy, cx, cy + ch);
  g.addColorStop(0, '#1a0a2a'); g.addColorStop(0.4, '#0e0e2e'); g.addColorStop(1, '#0a0a1e');
  ctx.fillStyle = g;
  rr(cx, cy, cw, ch, 12); ctx.fill();
  ctx.strokeStyle = GOLD + '66'; ctx.lineWidth = 2;
  rr(cx, cy, cw, ch, 12); ctx.stroke();

  // Decorative corner elements
  const cornerSz = 20;
  ctx.strokeStyle = GOLD + '44'; ctx.lineWidth = 1.5;
  // Top-left
  ctx.beginPath(); ctx.moveTo(cx + 10, cy + cornerSz + 10); ctx.lineTo(cx + 10, cy + 10); ctx.lineTo(cx + cornerSz + 10, cy + 10); ctx.stroke();
  // Top-right
  ctx.beginPath(); ctx.moveTo(cx + cw - cornerSz - 10, cy + 10); ctx.lineTo(cx + cw - 10, cy + 10); ctx.lineTo(cx + cw - 10, cy + cornerSz + 10); ctx.stroke();
  // Bottom-left
  ctx.beginPath(); ctx.moveTo(cx + 10, cy + ch - cornerSz - 10); ctx.lineTo(cx + 10, cy + ch - 10); ctx.lineTo(cx + cornerSz + 10, cy + ch - 10); ctx.stroke();
  // Bottom-right
  ctx.beginPath(); ctx.moveTo(cx + cw - cornerSz - 10, cy + ch - 10); ctx.lineTo(cx + cw - 10, cy + ch - 10); ctx.lineTo(cx + cw - 10, cy + ch - cornerSz - 10); ctx.stroke();

  // Title
  ctx.fillStyle = GOLD; ctx.font = 'bold 28px "Noto Serif SC",serif'; ctx.textAlign = 'center';
  ctx.shadowColor = GOLD; ctx.shadowBlur = 10;
  ctx.fillText('渡劫天梯', W / 2, cy + 50); ctx.shadowBlur = 0;
  ctx.fillStyle = GOLD + '88'; ctx.font = '12px "Noto Serif SC",serif';
  ctx.fillText('Tribulation Climb', W / 2, cy + 72);

  // Player character
  const sk = SKINS[skinIdx];
  ctx.save(); ctx.translate(W / 2, cy + 120);
  ctx.fillStyle = sk.c1; rr(-10, -13, 20, 26, 5); ctx.fill();
  ctx.fillStyle = sk.c2; rr(-8, -11, 16, 10, 3); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(-3, -5, 2, 0, 6.28); ctx.fill();
  ctx.beginPath(); ctx.arc(3, -5, 2, 0, 6.28); ctx.fill();
  ctx.strokeStyle = sk.scarf; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-8, 0); ctx.quadraticCurveTo(-14, 8, -12, 16); ctx.stroke();
  ctx.restore();

  // Stats
  const statY = cy + 170;
  ctx.fillStyle = GOLD; ctx.font = 'bold 36px "Noto Serif SC",serif'; ctx.textAlign = 'center';
  ctx.fillText('' + score, W / 2, statY);
  ctx.fillStyle = GOLD + 'aa'; ctx.font = '14px "Noto Serif SC",serif';
  ctx.fillText('总得分', W / 2, statY + 24);

  // Stats grid
  const gY = statY + 50;
  const stats = [
    { label: '步数', val: '' + steps },
    { label: '灵石', val: '' + stones },
    { label: '最远', val: REALMS[realmFor(maxRow)].name },
    { label: '连击', val: '' + maxComboEver },
  ];
  for (let i = 0; i < stats.length; i++) {
    const sx = cx + 40 + (i % 2) * 140, sy = gY + Math.floor(i / 2) * 55;
    ctx.fillStyle = GOLD; ctx.font = 'bold 22px "Noto Serif SC",serif'; ctx.textAlign = 'center';
    ctx.fillText(stats[i].val, sx + 40, sy + 18);
    ctx.fillStyle = GOLD + '88'; ctx.font = '11px "Noto Serif SC",serif';
    ctx.fillText(stats[i].label, sx + 40, sy + 36);
  }

  // Realm badge
  const realmR = realmFor(maxRow);
  const realmRd = REALMS[realmR];
  ctx.fillStyle = realmRd.accent + '33';
  rr(cx + 60, gY + 120, cw - 120, 40, 8); ctx.fill();
  ctx.strokeStyle = realmRd.accent + '66'; ctx.lineWidth = 1;
  rr(cx + 60, gY + 120, cw - 120, 40, 8); ctx.stroke();
  ctx.fillStyle = realmRd.accent; ctx.font = 'bold 16px "Noto Serif SC",serif'; ctx.textAlign = 'center';
  ctx.fillText(`境界: ${realmRd.name}`, W / 2, gY + 146);

  // Achievement stamps earned
  const achUnlocked = ACHIEVEMENTS.filter(a => a.unlocked);
  if (achUnlocked.length > 0) {
    ctx.fillStyle = '#cc333388'; ctx.font = '11px "Noto Serif SC",serif'; ctx.textAlign = 'center';
    ctx.fillText(`红印 ${achUnlocked.length}/${ACHIEVEMENTS.length}`, W / 2, gY + 185);
    for (let i = 0; i < achUnlocked.length; i++) {
      const stampX = W / 2 - (achUnlocked.length - 1) * 18 + i * 36;
      ctx.fillStyle = '#cc333366';
      ctx.beginPath(); ctx.arc(stampX, gY + 210, 12, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#ffdddd88'; ctx.font = 'bold 10px "Noto Serif SC",serif';
      ctx.fillText('印', stampX, gY + 214);
    }
  }

  // Footer
  ctx.fillStyle = '#555'; ctx.font = '10px "Noto Serif SC",serif'; ctx.textAlign = 'center';
  ctx.fillText('麦洛的冒险 · 渡劫天梯', W / 2, cy + ch - 15);

  // Buttons
  drawBtn(W / 2 - 80, cy + ch + 15, 160, 44, '返回', GOLD_DARK, '#fff');
}

// ─── Realm Transition Ceremony ──────────────────────────────────────────────
let ceremonyActive = false;
let ceremonyT = 0;
let ceremonyRealm = Realm.Wind;
let ceremonyRow = 0;
const CEREMONY_ROWS = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500];
let passedCeremonies = new Set<number>();

function triggerCeremony(row: number, realm: Realm) {
  if (passedCeremonies.has(row)) return;
  passedCeremonies.add(row);
  ceremonyActive = true;
  ceremonyT = 2.5;
  ceremonyRealm = realm;
  ceremonyRow = row;
  sfx('realm');
  // Golden particles burst
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * 6.28, s = 40 + Math.random() * 80;
    emit({ x: W / 2 + (Math.random() - 0.5) * 100, y: H / 2 + (Math.random() - 0.5) * 50,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      max: 1.5 + Math.random() * 1.0,
      color: Math.random() < 0.6 ? GOLD : REALMS[realm].accent,
      sz: 3 + Math.random() * 5, tag: 'ceremony' });
  }
}

function tickCeremony(dt: number) {
  if (!ceremonyActive) return;
  ceremonyT -= dt;
  // Keep emitting particles during ceremony
  if (ceremonyT > 0.5 && Math.random() < 0.3) {
    emit({ x: Math.random() * W, y: H / 2 + (Math.random() - 0.5) * 200,
      vx: (Math.random() - 0.5) * 30, vy: -30 - Math.random() * 40,
      max: 1.0 + Math.random() * 0.5,
      color: Math.random() < 0.5 ? GOLD : '#ffdd88',
      sz: 2 + Math.random() * 3, tag: 'ceremony' });
  }
  if (ceremonyT <= 0) ceremonyActive = false;
}

function drawCeremony() {
  if (!ceremonyActive) return;
  const p = ceremonyT / 2.5;
  const rd = REALMS[ceremonyRealm];

  // Background overlay with pulse
  const pulse = Math.sin(ceremonyT * 4) * 0.05 + 0.15;
  ctx.globalAlpha = p * (pulse + 0.2);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;

  // Main text
  if (p > 0.2 && p < 0.9) {
    const tAlpha = p < 0.4 ? (p - 0.2) / 0.2 : p > 0.8 ? (0.9 - p) / 0.1 : 1;
    ctx.globalAlpha = tAlpha;
    ctx.fillStyle = GOLD; ctx.font = 'bold 40px "Noto Serif SC",serif'; ctx.textAlign = 'center';
    ctx.shadowColor = GOLD; ctx.shadowBlur = 20;
    ctx.fillText('渡劫成功!', W / 2, H / 2 - 20);
    ctx.shadowBlur = 0;

    ctx.fillStyle = rd.accent; ctx.font = 'bold 20px "Noto Serif SC",serif';
    ctx.fillText(`第${ceremonyRow}道 · ${rd.name}`, W / 2, H / 2 + 20);

    ctx.fillStyle = GOLD + 'cc'; ctx.font = '14px "Noto Serif SC",serif';
    ctx.fillText('继续前进, 修仙者!', W / 2, H / 2 + 50);

    ctx.globalAlpha = 1;
  }
}

// ─── Enhanced Parallax Background Layers ────────────────────────────────────
interface BgLayer {
  speed: number; // parallax speed relative to camera
  elements: BgElement[];
}

interface BgElement {
  x: number; baseY: number; w: number; h: number; type: string;
  seed: number;
}

function generateBgLayers(): BgLayer[] {
  const layers: BgLayer[] = [];

  // Layer 0: Far mountains
  const farMountains: BgElement[] = [];
  for (let i = 0; i < 8; i++) {
    farMountains.push({ x: i * 80 - 40, baseY: 0.85, w: 100 + Math.random() * 60, h: 50 + Math.random() * 40, type: 'mountain', seed: Math.random() * 1000 });
  }
  layers.push({ speed: 0.02, elements: farMountains });

  // Layer 1: Mid clouds
  const midClouds: BgElement[] = [];
  for (let i = 0; i < 6; i++) {
    midClouds.push({ x: i * 100 + Math.random() * 50, baseY: 0.15 + Math.random() * 0.3, w: 60 + Math.random() * 50, h: 15 + Math.random() * 10, type: 'cloud', seed: Math.random() * 1000 });
  }
  layers.push({ speed: 0.08, elements: midClouds });

  // Layer 2: Near mist
  const nearMist: BgElement[] = [];
  for (let i = 0; i < 5; i++) {
    nearMist.push({ x: i * 120 - 30, baseY: 0.6 + Math.random() * 0.3, w: 120 + Math.random() * 80, h: 30 + Math.random() * 20, type: 'mist', seed: Math.random() * 1000 });
  }
  layers.push({ speed: 0.15, elements: nearMist });

  return layers;
}

let bgLayers: BgLayer[] = generateBgLayers();

function drawParallaxBg() {
  const rd = REALMS[curRealm];

  // Base gradient
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, rd.bg1); g.addColorStop(1, rd.bg2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // Layer 0: Far mountains
  const l0 = bgLayers[0];
  ctx.fillStyle = rd.bg2;
  ctx.globalAlpha = 0.4;
  for (const el of l0.elements) {
    const ox = ((el.x - camY * l0.speed * 50) % (W + 200)) - 100;
    const finalX = ox < -150 ? ox + W + 200 : ox;
    const ey = H * el.baseY;
    ctx.beginPath();
    ctx.moveTo(finalX - el.w / 2, H);
    // Mountain peaks with variation
    const peakX = finalX;
    const peakY = ey - el.h;
    ctx.lineTo(finalX - el.w * 0.3, ey - el.h * 0.6);
    ctx.lineTo(peakX, peakY);
    ctx.lineTo(finalX + el.w * 0.2, ey - el.h * 0.5);
    ctx.lineTo(finalX + el.w / 2, H);
    ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Layer 1: Mid clouds
  const l1 = bgLayers[1];
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = rd.accent;
  for (const el of l1.elements) {
    const ox = ((el.x - camY * l1.speed * 30 + frame * 0.05) % (W + 200)) - 100;
    const finalX = ox < -150 ? ox + W + 200 : ox;
    const ey = H * el.baseY + Math.sin(frame * 0.008 + el.seed) * 10;
    ctx.beginPath();
    ctx.ellipse(finalX, ey, el.w / 2, el.h / 2, 0, 0, 6.28);
    ctx.fill();
    // Second blob for cloud shape
    ctx.beginPath();
    ctx.ellipse(finalX + el.w * 0.25, ey - el.h * 0.2, el.w * 0.35, el.h * 0.4, 0, 0, 6.28);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Layer 2: Near mist
  const l2 = bgLayers[2];
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = rd.accent2;
  for (const el of l2.elements) {
    const ox = ((el.x - camY * l2.speed * 20 + frame * 0.1) % (W + 300)) - 150;
    const finalX = ox < -200 ? ox + W + 300 : ox;
    const ey = H * el.baseY + Math.sin(frame * 0.01 + el.seed) * 15;
    ctx.beginPath();
    ctx.ellipse(finalX, ey, el.w / 2, el.h / 2, 0, 0, 6.28);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ─── Enhanced Lane Visuals ──────────────────────────────────────────────────
// Fish jumping data per lane
interface FishJump {
  x: number; phase: number; active: boolean; speed: number;
}

const laneDecorations: Map<number, {
  fishJumps: FishJump[];
  grassPhases: number[];
  flowerPositions: Array<{ x: number; color: string; phase: number }>;
  creatureVariant: number;
}> = new Map();

function getLaneDeco(row: number) {
  if (!laneDecorations.has(row)) {
    const r = new Rng(row * 7919 + 31337);
    const fishes: FishJump[] = [];
    if (r.next() < 0.4) {
      for (let i = 0; i < r.int(1, 2); i++) {
        fishes.push({ x: r.next() * W, phase: r.next() * 6.28, active: true, speed: 0.5 + r.next() * 1.5 });
      }
    }
    const grassP: number[] = [];
    for (let i = 0; i < COLS; i++) grassP.push(r.next() * 6.28);
    const flowers: Array<{ x: number; color: string; phase: number }> = [];
    const flowerColors = ['#ff6688', '#ffaa44', '#aaddff', '#ffdd55', '#dd88ff'];
    if (r.next() < 0.5) {
      for (let i = 0; i < r.int(1, 4); i++) {
        flowers.push({ x: r.next() * W, color: r.pick(flowerColors), phase: r.next() * 6.28 });
      }
    }
    laneDecorations.set(row, {
      fishJumps: fishes,
      grassPhases: grassP,
      flowerPositions: flowers,
      creatureVariant: r.int(0, 4),
    });
  }
  return laneDecorations.get(row)!;
}

function drawEnhancedRiver(l: Lane, sy: number) {
  const rd = REALMS[l.realm];
  // Animated water waves with sine offset
  ctx.fillStyle = l.realm === Realm.Fire ? '#44220088' : l.realm === Realm.Ice ? '#22445588' : '#11335588';
  ctx.fillRect(0, sy, W, LANE_H);

  // Sine wave water surface
  ctx.strokeStyle = rd.accent + '55'; ctx.lineWidth = 1;
  for (let wave = 0; wave < 3; wave++) {
    ctx.beginPath();
    const waveY = sy + 10 + wave * 15;
    const waveOff = frame * 0.04 * (l.riverDir || 1) + wave * 2;
    for (let x = 0; x < W; x += 4) {
      const y2 = waveY + Math.sin(x * 0.03 + waveOff) * 3 + Math.sin(x * 0.07 + waveOff * 1.5) * 1.5;
      if (x === 0) ctx.moveTo(x, y2); else ctx.lineTo(x, y2);
    }
    ctx.stroke();
  }

  // Lily pads (for non-fire/ice)
  if (l.realm !== Realm.Fire && l.realm !== Realm.Ice) {
    const deco = getLaneDeco(l.y);
    const padSeeds = [l.y * 13 % 5, l.y * 29 % 7, l.y * 41 % 3];
    for (let i = 0; i < Math.min(2, padSeeds.length); i++) {
      const padX = (padSeeds[i] * 67 + i * 130 + frame * 0.2 * (l.riverDir || 1)) % (W + 40) - 20;
      const padY = sy + LANE_H / 2 + Math.sin(frame * 0.03 + i * 2) * 3; // subtle bob
      ctx.fillStyle = '#33774422';
      ctx.beginPath();
      ctx.ellipse(padX, padY, 12, 8, 0.3 + i * 0.5, 0, Math.PI * 1.8);
      ctx.fill();
      ctx.strokeStyle = '#55995533'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(padX, padY, 12, 8, 0.3 + i * 0.5, 0, Math.PI * 1.8);
      ctx.stroke();
    }

    // Occasional fish jumping
    for (const fish of deco.fishJumps) {
      if (!fish.active) continue;
      fish.phase += 0.03;
      const jumpCycle = (fish.phase * fish.speed) % (Math.PI * 2);
      if (jumpCycle < Math.PI) {
        const jumpH = Math.sin(jumpCycle) * 18;
        const fx = (fish.x + frame * 0.3 * (l.riverDir || 1)) % (W + 40) - 20;
        const fy = sy + LANE_H / 2 - jumpH;
        ctx.save(); ctx.translate(fx, fy);
        ctx.rotate(jumpCycle < Math.PI / 2 ? -0.4 : 0.4);
        ctx.fillStyle = '#ffaa5588';
        ctx.beginPath();
        ctx.moveTo(6, 0); ctx.quadraticCurveTo(0, -4, -6, 0);
        ctx.quadraticCurveTo(0, 4, 6, 0); ctx.fill();
        // Tail
        ctx.beginPath(); ctx.moveTo(-6, 0);
        ctx.lineTo(-10, -3); ctx.lineTo(-10, 3); ctx.closePath(); ctx.fill();
        ctx.restore();

        // Splash ripples
        if (jumpCycle < 0.3 || jumpCycle > Math.PI - 0.3) {
          ctx.strokeStyle = '#ffffff22'; ctx.lineWidth = 1;
          const rippleR = jumpCycle < 0.3 ? (0.3 - jumpCycle) * 30 : (jumpCycle - Math.PI + 0.3) * 30;
          ctx.beginPath(); ctx.ellipse(fx, sy + LANE_H / 2, rippleR, rippleR * 0.3, 0, 0, 6.28); ctx.stroke();
        }
      }
    }
  }

  // Platforms
  for (const o of l.obs) drawPlatform(o, sy, l.realm);
}

function drawEnhancedSafe(l: Lane, sy: number) {
  const rd = REALMS[l.realm];
  const deco = getLaneDeco(l.y);

  // Base pattern
  ctx.globalAlpha = 0.1; ctx.fillStyle = rd.accent;
  for (let i = 0; i < 3; i++) {
    const sx = (l.y * 97 + i * 137) % W;
    ctx.beginPath(); ctx.ellipse(sx, sy + LANE_H / 2, 30 + (l.y * 13 % 20), 8, 0, 0, 6.28); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Swaying grass
  ctx.strokeStyle = rd.accent + '44'; ctx.lineWidth = 1;
  for (let i = 0; i < COLS; i++) {
    const gx = i * CELL_W + CELL_W / 2 + ((l.y * 7) % 10 - 5);
    const sway = Math.sin(frame * 0.03 + deco.grassPhases[i]) * 4;
    const grassH = 8 + (l.y * 3 + i * 7) % 6;
    ctx.beginPath();
    ctx.moveTo(gx, sy + LANE_H - 2);
    ctx.quadraticCurveTo(gx + sway * 0.5, sy + LANE_H - grassH / 2, gx + sway, sy + LANE_H - grassH);
    ctx.stroke();
    // Second blade
    ctx.beginPath();
    ctx.moveTo(gx + 3, sy + LANE_H - 2);
    ctx.quadraticCurveTo(gx + 3 + sway * 0.7, sy + LANE_H - grassH * 0.7, gx + 3 + sway * 1.2, sy + LANE_H - grassH * 0.8);
    ctx.stroke();
  }

  // Flower particles
  for (const fl of deco.flowerPositions) {
    fl.phase += 0.01;
    const fy = sy + LANE_H - 6 + Math.sin(fl.phase) * 2;
    ctx.fillStyle = fl.color + '88';
    // Petals
    for (let p = 0; p < 5; p++) {
      const pa = (p / 5) * 6.28 + fl.phase * 0.3;
      const px = fl.x + Math.cos(pa) * 4;
      const py = fy + Math.sin(pa) * 3;
      ctx.beginPath(); ctx.arc(px, py, 2, 0, 6.28); ctx.fill();
    }
    // Center
    ctx.fillStyle = '#ffdd5588';
    ctx.beginPath(); ctx.arc(fl.x, fy, 1.5, 0, 6.28); ctx.fill();
  }
}

function drawEnhancedRoad(l: Lane, sy: number, rd: RealmDef) {
  const deco = getLaneDeco(l.y);

  // Road markings
  ctx.strokeStyle = rd.accent + '22'; ctx.lineWidth = 1;
  ctx.setLineDash([8, 12]);
  ctx.beginPath(); ctx.moveTo(0, sy + LANE_H / 2); ctx.lineTo(W, sy + LANE_H / 2); ctx.stroke();
  ctx.setLineDash([]);

  // Draw obstacles with variety
  for (const o of l.obs) {
    drawEnhancedObs(o, sy, l.realm, deco.creatureVariant);
  }
}

function drawEnhancedObs(o: Obs, sy: number, realm: Realm, variant: number) {
  const cx = o.x, cy = sy + LANE_H / 2;
  const hw = o.w / 2, hh = (LANE_H - 12) / 2;
  const rd = REALMS[realm];
  ctx.save(); ctx.translate(cx, cy);

  switch (realm) {
    case Realm.Wind: {
      if (variant % 3 === 0) {
        // Whirlwind variant
        ctx.fillStyle = rd.obsColor; ctx.globalAlpha = 0.7;
        for (let i = 0; i < 3; i++) {
          const a = frame * 0.12 + i * 2.1;
          const r2 = hw * (0.3 + i * 0.2);
          ctx.beginPath(); ctx.ellipse(Math.cos(a) * r2 * 0.3, Math.sin(a) * r2 * 0.2, hw * 0.5, hh * 0.4, a * 0.5, 0, 6.28); ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (variant % 3 === 1) {
        // Flying debris variant
        ctx.fillStyle = rd.obsColor + 'cc';
        for (let i = 0; i < 4; i++) {
          const da = frame * 0.08 + i * 1.57;
          const dr = hw * 0.5;
          ctx.save(); ctx.translate(Math.cos(da) * dr * 0.4, Math.sin(da) * dr * 0.3);
          ctx.rotate(da);
          ctx.fillRect(-5, -2, 10, 4);
          ctx.restore();
        }
      } else {
        // Original wind obs
        ctx.fillStyle = rd.obsColor; ctx.globalAlpha = 0.8;
        const wb = Math.sin(frame * 0.1) * 3;
        ctx.beginPath(); ctx.ellipse(wb, 0, hw, hh, 0, 0, 6.28); ctx.fill();
        ctx.globalAlpha = 1;
      }
      break;
    }
    case Realm.Thunder: {
      if (variant % 2 === 0) {
        // Electric orb
        ctx.fillStyle = rd.obsColor;
        ctx.beginPath(); ctx.arc(0, 0, hw * 0.7, 0, 6.28); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
          const a = frame * 0.15 + i * Math.PI / 2;
          const r1 = hw * 0.7, r2 = hw * 1.1;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
          ctx.lineTo(Math.cos(a + 0.2) * (r1 + r2) / 2, Math.sin(a + 0.2) * (r1 + r2) / 2);
          ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); ctx.stroke();
        }
      } else {
        // Thunder beast variant
        ctx.fillStyle = '#6633aa';
        ctx.beginPath(); ctx.ellipse(0, 0, hw * 0.8, hh * 0.7, 0, 0, 6.28); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-hw * 0.25, -hh * 0.15, 3, 0, 6.28); ctx.fill();
        ctx.beginPath(); ctx.arc(hw * 0.25, -hh * 0.15, 3, 0, 6.28); ctx.fill();
        ctx.fillStyle = '#ff4444';
        ctx.beginPath(); ctx.arc(-hw * 0.25, -hh * 0.15, 1.5, 0, 6.28); ctx.fill();
        ctx.beginPath(); ctx.arc(hw * 0.25, -hh * 0.15, 1.5, 0, 6.28); ctx.fill();
        // Sparks around
        ctx.strokeStyle = '#ffdd55'; ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const sa = frame * 0.2 + i * 2;
          const sr = hw * 0.9;
          ctx.beginPath();
          ctx.moveTo(Math.cos(sa) * sr, Math.sin(sa) * sr);
          ctx.lineTo(Math.cos(sa) * sr * 1.3, Math.sin(sa) * sr * 1.3);
          ctx.stroke();
        }
      }
      break;
    }
    case Realm.Fire: {
      if (variant % 3 === 0) {
        // Fire serpent variant
        ctx.fillStyle = '#ff3300';
        for (let i = 0; i < 5; i++) {
          const seg = i - 2;
          const sx = seg * hw * 0.3;
          const sy2 = Math.sin(frame * 0.1 + i * 0.8) * 5;
          ctx.beginPath(); ctx.arc(sx, sy2, hw * 0.25 - Math.abs(seg) * 2, 0, 6.28); ctx.fill();
        }
        ctx.fillStyle = '#ffaa33';
        ctx.beginPath(); ctx.arc(-hw * 0.3, Math.sin(frame * 0.1) * 5 - 3, 2, 0, 6.28); ctx.fill();
        ctx.beginPath(); ctx.arc(-hw * 0.1, Math.sin(frame * 0.1 + 0.8) * 5 - 3, 2, 0, 6.28); ctx.fill();
      } else {
        // Original fireball
        ctx.fillStyle = '#ff4411';
        ctx.beginPath(); ctx.arc(0, 0, hw * 0.6, 0, 6.28); ctx.fill();
        ctx.fillStyle = '#ffaa33';
        for (let i = 0; i < 5; i++) {
          const fa = frame * 0.2 + i * 1.2;
          const fr = hw * 0.3 + Math.sin(fa) * hw * 0.15;
          const fx = Math.cos(i * 1.3) * hw * 0.4;
          const fy = Math.sin(i * 1.3) * hh * 0.4 - Math.abs(Math.sin(fa)) * 5;
          ctx.beginPath(); ctx.arc(fx, fy, fr, 0, 6.28); ctx.fill();
        }
        ctx.fillStyle = '#ffee88';
        ctx.beginPath(); ctx.arc(0, 0, hw * 0.3, 0, 6.28); ctx.fill();
      }
      break;
    }
    case Realm.Ice: {
      if (variant % 2 === 0) {
        // Ice golem variant
        ctx.fillStyle = '#88aacc'; rr(-hw, -hh, hw * 2, hh * 2, 6); ctx.fill();
        ctx.fillStyle = '#aaccee44'; ctx.fillRect(-hw + 3, -hh + 3, hw * 2 - 6, 4);
        // Crystal spikes
        ctx.fillStyle = '#aaddff66';
        ctx.beginPath(); ctx.moveTo(-hw * 0.3, -hh); ctx.lineTo(-hw * 0.15, -hh - 8); ctx.lineTo(0, -hh); ctx.fill();
        ctx.beginPath(); ctx.moveTo(hw * 0.1, -hh); ctx.lineTo(hw * 0.3, -hh - 6); ctx.lineTo(hw * 0.5, -hh); ctx.fill();
      } else {
        // Sliding boulder
        ctx.fillStyle = '#88aacc'; rr(-hw, -hh, hw * 2, hh * 2, 6); ctx.fill();
        ctx.fillStyle = '#aaccee44'; ctx.fillRect(-hw + 3, -hh + 3, hw * 2 - 6, 4);
        ctx.strokeStyle = '#ffffff33'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-hw + 5, -hh + 5); ctx.lineTo(-hw + 15, -hh + 5); ctx.stroke();
      }
      break;
    }
    default: { // Chaos
      const hue = (frame * 3 + o.x) % 360;
      ctx.fillStyle = `hsl(${hue},70%,50%)`;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * 6.28 + frame * 0.05;
        const r = hw * 0.5 + Math.sin(a * 3 + frame * 0.1) * hw * 0.3;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
      // Chaos eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-hw * 0.15, -hh * 0.1, 3, 0, 6.28); ctx.fill();
      ctx.beginPath(); ctx.arc(hw * 0.15, -hh * 0.1, 3, 0, 6.28); ctx.fill();
      ctx.fillStyle = `hsl(${(hue + 180) % 360},90%,40%)`;
      ctx.beginPath(); ctx.arc(-hw * 0.15, -hh * 0.1, 1.5, 0, 6.28); ctx.fill();
      ctx.beginPath(); ctx.arc(hw * 0.15, -hh * 0.1, 1.5, 0, 6.28); ctx.fill();
    }
  }
  ctx.restore();
}

function drawEnhancedHazard(l: Lane, sy: number) {
  const rd = REALMS[l.realm];

  // Telegraphed warning with enhanced visuals
  if (l.hazWarn && l.hazWarn > 0) {
    // Flashing warning zone
    const flashIntensity = Math.sin(l.hazWarn * 20) * 0.5 + 0.5;
    ctx.fillStyle = rd.accent + Math.floor(flashIntensity * 80).toString(16).padStart(2, '0');
    for (const o of l.obs) ctx.fillRect(o.x, sy, o.w, LANE_H);

    // Rumble effect - slight offset on warning text
    const rumbleX = Math.sin(l.hazWarn * 40) * 2;
    const rumbleY = Math.cos(l.hazWarn * 35) * 1.5;

    // Warning text with glow
    ctx.fillStyle = '#ff4444'; ctx.font = 'bold 18px "Noto Serif SC",serif'; ctx.textAlign = 'center';
    ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 8;
    for (const o of l.obs) ctx.fillText('!', o.x + o.w / 2 + rumbleX, sy + LANE_H / 2 + 5 + rumbleY);
    ctx.shadowBlur = 0;

    // Warning stripes at edges
    ctx.strokeStyle = '#ff444466'; ctx.lineWidth = 2;
    for (const o of l.obs) {
      const stripeW = 4;
      for (let i = 0; i < o.w; i += 12) {
        ctx.beginPath();
        ctx.moveTo(o.x + i, sy);
        ctx.lineTo(o.x + i + stripeW, sy + LANE_H);
        ctx.stroke();
      }
    }
  }

  if (l.hazActive) {
    for (const o of l.obs) {
      if (o.visual === 'lightning') drawZap(o.x + o.w / 2, sy, o.w, LANE_H);
      else if (o.visual === 'fire_wall') drawFireWall(sy);
      else { ctx.fillStyle = rd.accent + '88'; ctx.fillRect(o.x, sy + 4, o.w, LANE_H - 8); }
    }
  }
}

// ─── Enhanced Player Animation ──────────────────────────────────────────────
let breatheT = 0;
let idleT = 0;
let inkDeathPtcls: Array<{ x: number; y: number; vx: number; vy: number; sz: number; life: number; max: number; color: string; rot: number; rotV: number }> = [];
let deathInkActive = false;

function drawEnhancedPlayer() {
  if (pDead && deathInkActive) {
    // Ink dissolution death animation
    for (const p of inkDeathPtcls) {
      const a = p.life / p.max;
      ctx.globalAlpha = a;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      // Ink blot shape
      ctx.beginPath();
      const sz = p.sz * (1 + (1 - a) * 1.5);
      ctx.ellipse(0, 0, sz, sz * 0.7, 0, 0, 6.28);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    return;
  }
  if (pDead) return;

  const sk = SKINS[skinIdx];
  ctx.save();
  ctx.translate(pX, pY + LANE_H / 2 - 2);

  // Hop arc
  let arc = 0;
  if (pHop) { const t = 1 - pHopT / HOP_DUR; arc = Math.sin(t * Math.PI) * 20; }
  ctx.translate(0, -arc);

  // Idle breathing animation
  if (!pHop && !pDead) {
    idleT += 0.016;
    breatheT += 0.03;
    const breathScale = 1 + Math.sin(breatheT) * 0.02;
    // We'll apply this subtly through squash values
    pSqX = pSqX * (1 + (breathScale - 1) * 0.5);
    pSqY = pSqY * (1 + (1 / breathScale - 1) * 0.5);
  } else {
    idleT = 0;
  }

  // Flying effect
  if (pFlying) {
    ctx.shadowColor = '#ffdd55'; ctx.shadowBlur = 15;
    ctx.fillStyle = '#ffdd5555';
    ctx.beginPath(); ctx.ellipse(-12, 5, 10, 6, -0.3, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.ellipse(12, 5, 10, 6, 0.3, 0, 6.28); ctx.fill();
  }

  // Shield aura
  if (pShield > 0) {
    const shieldPulse = Math.sin(frame * 0.1) * 3;
    ctx.strokeStyle = '#55aaff66'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 18 + shieldPulse, 0, 6.28); ctx.stroke();
    ctx.strokeStyle = '#55aaff22'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, 22 + shieldPulse, 0, 6.28); ctx.stroke();
  }

  // Direction-facing (flip sprite)
  ctx.scale(pFace, 1);
  ctx.scale(pSqX, pSqY);

  // Body
  ctx.fillStyle = sk.c1; rr(-8, -10, 16, 20, 4); ctx.fill();
  ctx.fillStyle = sk.c2; rr(-6, -8, 12, 8, 2); ctx.fill();

  // Eyes (always face original direction)
  ctx.save(); ctx.scale(pFace, 1); // un-flip for eyes
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(-3 + 1, -3, 2, 0, 6.28); ctx.fill();
  ctx.beginPath(); ctx.arc(3 + 1, -3, 2, 0, 6.28); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-2.5 + 1.5, -3.5, 0.8, 0, 6.28); ctx.fill();
  ctx.beginPath(); ctx.arc(3.5 + 1.5, -3.5, 0.8, 0, 6.28); ctx.fill();

  // Mouth
  ctx.strokeStyle = '#111'; ctx.lineWidth = 1;
  ctx.beginPath();
  if (pHop) ctx.arc(0, 2, 2, 0, Math.PI);
  else if (combo > 5) { // Excited mouth for high combo
    ctx.arc(0, 1, 3, 0, Math.PI);
  } else ctx.arc(0, 1.5, 2, 0.2, Math.PI - 0.2);
  ctx.stroke();
  ctx.restore();

  ctx.shadowBlur = 0;
  ctx.restore();

  // Enhanced scarf with spring physics (3 segments with thicker -> thinner)
  if (pScarf.length >= 2) {
    const scarfWidths = [5, 4, 3.5, 3, 2.5, 2, 1.5, 1];
    for (let i = 0; i < pScarf.length - 1; i++) {
      const w = scarfWidths[Math.min(i, scarfWidths.length - 1)];
      const alpha = 1 - i / pScarf.length * 0.5;
      ctx.strokeStyle = sk.scarf;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pScarf[i].x, pScarf[i].y + LANE_H / 2 - 2);
      ctx.lineTo(pScarf[i + 1].x, pScarf[i + 1].y + LANE_H / 2 - 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Scarf tip forking
    const last = pScarf[pScarf.length - 1];
    ctx.strokeStyle = sk.scarf + '66'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(last.x, last.y + LANE_H / 2 - 2);
    ctx.lineTo(last.x - 4, last.y + LANE_H / 2 + 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(last.x, last.y + LANE_H / 2 - 2);
    ctx.lineTo(last.x + 4, last.y + LANE_H / 2 + 4); ctx.stroke();
  }

  // Enhanced near miss text
  if (nmT > 0.3) {
    ctx.save();
    const nmAlpha = Math.min(1, (nmT - 0.3) * 3);
    ctx.globalAlpha = nmAlpha;
    const nmScale = 1 + (0.6 - nmT) * 0.5;
    ctx.translate(nmX, nmY - 30 - (0.6 - nmT) * 40);
    ctx.scale(nmScale, nmScale);
    ctx.fillStyle = '#ffdd44';
    ctx.font = 'bold 28px "Noto Serif SC",serif'; ctx.textAlign = 'center';
    ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 15;
    ctx.fillText('险!', 0, 0);
    ctx.fillStyle = GOLD + 'cc'; ctx.font = 'bold 14px "Noto Serif SC",serif';
    ctx.fillText('+10', 0, 22);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Combo multiplier text
  if (combo > 2) {
    ctx.save();
    const comboScale = 1 + Math.sin(frame * 0.15) * 0.1;
    ctx.translate(pX, pY + LANE_H / 2 - 40);
    ctx.scale(comboScale, comboScale);
    ctx.fillStyle = GOLD; ctx.font = 'bold 14px "Noto Serif SC",serif'; ctx.textAlign = 'center';
    ctx.shadowColor = GOLD; ctx.shadowBlur = 5;
    ctx.fillText(`${combo}连!`, 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

function triggerInkDeath(x: number, y: number) {
  deathInkActive = true;
  inkDeathPtcls = [];
  // Break character into ink particles
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * 6.28;
    const s = 20 + Math.random() * 60;
    const offX = (Math.random() - 0.5) * 16;
    const offY = (Math.random() - 0.5) * 20;
    inkDeathPtcls.push({
      x: x + offX, y: y + LANE_H / 2 + offY,
      vx: Math.cos(a) * s + (Math.random() - 0.5) * 20,
      vy: Math.sin(a) * s - 30,
      sz: 2 + Math.random() * 5,
      life: 1.0 + Math.random() * 0.8,
      max: 1.0 + Math.random() * 0.8,
      color: Math.random() < 0.4 ? '#111122' :
             Math.random() < 0.6 ? '#223344' :
             Math.random() < 0.8 ? SKINS[skinIdx].c1 + '88' : SKINS[skinIdx].scarf + '66',
      rot: Math.random() * 6.28,
      rotV: (Math.random() - 0.5) * 8,
    });
  }
}

function tickInkDeath(dt: number) {
  if (!deathInkActive) return;
  let alive = false;
  for (const p of inkDeathPtcls) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 40 * dt; // gravity
    p.vx *= 0.98;
    p.rot += p.rotV * dt;
    p.life -= dt;
    p.sz += 1.5 * dt; // expand
    if (p.life > 0) alive = true;
  }
  if (!alive) deathInkActive = false;
}

// ─── Enhanced Combo System ──────────────────────────────────────────────────
let lastHopTime = 0;
let quickHopStreak = 0;
const QUICK_HOP_THRESHOLD = 0.3; // seconds

function processQuickHop() {
  const now = performance.now() / 1000;
  const elapsed = now - lastHopTime;
  lastHopTime = now;

  if (elapsed < QUICK_HOP_THRESHOLD && elapsed > 0.05) {
    quickHopStreak++;
    if (quickHopStreak > 1) {
      const bonusScore = quickHopStreak * 5;
      score += bonusScore;
      // Quick hop particles
      for (let i = 0; i < quickHopStreak; i++) {
        emit({
          x: pTX + (Math.random() - 0.5) * 30,
          y: pTY + (Math.random() - 0.5) * 10,
          vx: (Math.random() - 0.5) * 50,
          vy: -50 - Math.random() * 30,
          max: 0.4 + Math.random() * 0.3,
          color: Math.random() < 0.5 ? '#ffdd55' : GOLD,
          sz: 2 + Math.random() * 2,
          tag: 'quick_hop'
        });
      }
    }
  } else {
    quickHopStreak = 0;
  }
}

// ─── Haptic Feedback ────────────────────────────────────────────────────────
function haptic(intensity: number) {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(Math.floor(intensity * 50));
    }
  } catch { /* not supported */ }
}

// ─── Character Skins ────────────────────────────────────────────────────────
const SKINS: Skin[] = [
  { name: '麦洛', desc: 'Melo',   c1: '#ffcc66', c2: '#ee9933', scarf: '#cc3333', cost: 0,   ability: '',             abilityDesc: '无特殊能力', unlocked: true },
  { name: '精卫', desc: 'Jingwei', c1: '#dd6688', c2: '#aa3355', scarf: '#ff9988', cost: 50,  ability: 'fly_ext',      abilityDesc: '飞行距离+2', unlocked: false },
  { name: '白泽', desc: 'Baize',   c1: '#eeeeff', c2: '#aabbcc', scarf: '#6688aa', cost: 80,  ability: 'foresight',    abilityDesc: '危险预警提前', unlocked: false },
  { name: '九尾狐', desc: '9-Tail', c1: '#ffaa44', c2: '#dd7722', scarf: '#ff6644', cost: 100, ability: 'speed',        abilityDesc: '移动速度+20%', unlocked: false },
  { name: '青龙', desc: 'Azure',   c1: '#33bbaa', c2: '#228877', scarf: '#55ddcc', cost: 150, ability: 'shield_start', abilityDesc: '开局自带护盾', unlocked: false },
  { name: '朱雀', desc: 'Vermil',  c1: '#ff4433', c2: '#cc2211', scarf: '#ffaa33', cost: 150, ability: 'fire_imm',     abilityDesc: '火劫伤害减半', unlocked: false },
  { name: '玄武', desc: 'Tortoise',c1: '#336655', c2: '#224433', scarf: '#4488aa', cost: 200, ability: 'ice_imm',      abilityDesc: '冰劫不打滑', unlocked: false },
  { name: '鲲鹏', desc: 'Kunpeng', c1: '#8855cc', c2: '#6633aa', scarf: '#ddbb55', cost: 300, ability: 'dbl_stone',    abilityDesc: '灵石双倍', unlocked: false },
];

const NICKNAMES = [
  '墨竹隐士', '云水禅心', '松风雅客', '清溪归人',
  '月影闲人', '烟霞散仙', '碧落寻仙', '沧浪渔叟',
];

// ─── Audio Engine ───────────────────────────────────────────────────────────
let ac: AudioContext | null = null;
let muted = localStorage.getItem('crossy_muted') === '1';
let mGain: GainNode | null = null;
let bgmNodes: { o: OscillatorNode; g: GainNode }[] = [];
let bgmRealm = -1;

function initAudio() {
  if (ac) return;
  try {
    ac = new AudioContext();
    mGain = ac.createGain();
    mGain.gain.value = muted ? 0 : 0.4;
    mGain.connect(ac.destination);
  } catch { /* */ }
}

function setMuted(m: boolean) {
  muted = m;
  localStorage.setItem('crossy_muted', m ? '1' : '0');
  if (mGain) mGain.gain.value = m ? 0 : 0.4;
}

function stopBGM() {
  if (!ac) return;
  const t = ac.currentTime;
  for (const n of bgmNodes) {
    try {
      n.g.gain.setValueAtTime(n.g.gain.value, t);
      n.g.gain.linearRampToValueAtTime(0, t + 0.5);
      n.o.stop(t + 0.6);
    } catch { /* */ }
  }
  bgmNodes = [];
  bgmRealm = -1;
}

function startBGM(realm: Realm) {
  if (!ac || !mGain) return;
  if (bgmRealm === realm) return;
  stopBGM();
  bgmRealm = realm;
  const t = ac.currentTime;

  const scales = [
    [220, 247, 277, 330, 370],
    [196, 220, 261, 294, 330],
    [261, 294, 330, 392, 440],
    [330, 370, 415, 494, 554],
    [185, 220, 247, 294, 330],
  ];
  const sc = scales[realm];

  function addLayer(type: OscillatorType, freq: number, vol: number) {
    const g = ac!.createGain(); g.gain.value = vol; g.connect(mGain!);
    const o = ac!.createOscillator(); o.type = type; o.frequency.value = freq;
    o.connect(g); o.start(t);
    bgmNodes.push({ o, g });
    return { o, g };
  }

  // Drone
  addLayer('sine', sc[0] / 2, 0.06);
  // Pad
  addLayer('triangle', sc[2], 0.03);

  // Melody
  const mel = addLayer(realm === Realm.Fire ? 'sawtooth' : 'triangle', sc[0], 0);
  const noteLen = realm === Realm.Chaos ? 0.6 : 0.8;
  for (let i = 0; i < 64; i++) {
    const nt = t + i * noteLen;
    const ni = (i * 3 + (i % 3 === 0 ? 2 : i % 5)) % sc.length;
    const oct = i % 8 < 4 ? 1 : 2;
    mel.o.frequency.setValueAtTime(sc[ni] * oct, nt);
    mel.g.gain.setValueAtTime(0.025, nt);
    mel.g.gain.linearRampToValueAtTime(0.0, nt + noteLen * 0.9);
  }

  // Percussion
  if (realm !== Realm.Ice) {
    const perc = addLayer('square', 55, 0);
    const bl = realm === Realm.Chaos ? 0.3 : 0.4;
    for (let i = 0; i < 128; i++) {
      const bt = t + i * bl;
      if (i % 4 === 0 || i % 4 === 3) {
        perc.g.gain.setValueAtTime(0.02, bt);
        perc.g.gain.linearRampToValueAtTime(0, bt + 0.05);
        perc.o.frequency.setValueAtTime(i % 4 === 0 ? 80 : 60, bt);
      }
    }
  }
}

function sfx(type: string, p?: number) {
  if (!ac || !mGain || muted) return;
  const t = ac.currentTime;
  try {
    const make = (tp: OscillatorType, f: number, vol: number, dur: number) => {
      const g = ac!.createGain(); g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur); g.connect(mGain!);
      const o = ac!.createOscillator(); o.type = tp; o.frequency.value = f;
      o.connect(g); o.start(t); o.stop(t + dur + 0.05);
      return { o, g };
    };

    switch (type) {
      case 'hop': {
        const f = 400 + (p || 0) * 40;
        const { o } = make('sine', f, 0.15, 0.12);
        o.frequency.exponentialRampToValueAtTime(f * 0.7, t + 0.1);
        break;
      }
      case 'collect': {
        const { o } = make('sine', 800, 0.12, 0.3);
        o.frequency.exponentialRampToValueAtTime(1200, t + 0.1);
        o.frequency.exponentialRampToValueAtTime(1600, t + 0.2);
        break;
      }
      case 'near_miss': {
        const { o } = make('sawtooth', 300, 0.2, 0.4);
        o.frequency.exponentialRampToValueAtTime(150, t + 0.3);
        const r = make('sine', 660, 0, 0.5);
        r.g.gain.setValueAtTime(0, t);
        r.g.gain.setValueAtTime(0.1, t + 0.15);
        r.g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        break;
      }
      case 'death': {
        const { o } = make('sawtooth', 200, 0.3, 1.0);
        o.frequency.exponentialRampToValueAtTime(40, t + 0.8);
        break;
      }
      case 'boss': {
        make('sine', 80, 0.25, 1.5);
        make('triangle', 160, 0.1, 1.0);
        break;
      }
      case 'combo': {
        const pent = [523, 587, 659, 784, 880];
        make('sine', pent[Math.min(p || 0, 4)], 0.1, 0.2);
        break;
      }
      case 'powerup': {
        const { o } = make('sine', 600, 0.12, 0.4);
        o.frequency.exponentialRampToValueAtTime(1200, t + 0.15);
        o.frequency.exponentialRampToValueAtTime(1800, t + 0.3);
        break;
      }
      case 'realm': {
        const pent = [261, 330, 392, 523, 659];
        for (let i = 0; i < 5; i++) {
          const g = ac!.createGain();
          const st = t + i * 0.12;
          g.gain.setValueAtTime(0.08, st);
          g.gain.exponentialRampToValueAtTime(0.001, st + 0.4);
          g.connect(mGain!);
          const o = ac!.createOscillator(); o.type = 'sine';
          o.frequency.value = pent[i]; o.connect(g); o.start(st); o.stop(st + 0.45);
        }
        break;
      }
    }
  } catch { /* */ }
}

// ─── Seeded Random ──────────────────────────────────────────────────────────
class Rng {
  s: number;
  constructor(s: number) { this.s = s; }
  next() { this.s = (this.s * 16807) % 2147483647; return (this.s - 1) / 2147483646; }
  int(a: number, b: number) { return Math.floor(this.next() * (b - a + 1)) + a; }
  pick<T>(a: T[]): T { return a[Math.floor(this.next() * a.length)]; }
}

function dailySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

// ─── Game State ─────────────────────────────────────────────────────────────
type Scene = 'title' | 'nick' | 'play' | 'pause' | 'over' | 'shop' | 'daily' | 'achievements' | 'tutorial' | 'share';

let scene: Scene = 'title';
let rng = new Rng(Date.now());

// Player
let pCol = 3, pRow = 0;
let pX = 0, pY = 0, pTX = 0, pTY = 0;
let pHop = false, pHopT = 0;
let pSqX = 1, pSqY = 1;
let pDead = false, pDeadT = 0;
let pOnRiv = false, pRivVx = 0;
let pFace: Dir = Dir.Right;
let pScarf: { x: number; y: number }[] = [];
let pShield = 0, pFlyN = 0, pFlying = false, pFreezeT = 0;

// Camera
let camY = 0, camSpd = 0.8;

// Score
let score = 0, hiScore = 0, steps = 0, maxRow = 0;
let stones = 0, totalStones = 0;
let curRealm = Realm.Wind;
let combo = 0, comboT = 0, scoreMul = 1;

// Near-miss
let nmT = 0, nmSlow = false, nmX = 0, nmY = 0;

// Lanes
let lanes: Lane[] = [];
let genTo = -1;

// Particles
let ptcls: Ptcl[] = [];

// Effects
let shakeT = 0, shakeI = 0;
let flashT = 0, flashC = '#fff';
let realmT = 0, realmFrom = Realm.Wind, realmTo = Realm.Wind;
let chaosT = 0;

// Boss
let bossOn = false, bossRow = -1, bossAtkX = -1, bossAtkT = 0, bossFlashT = 0;

// UI
let paused = false, frame = 0, lastT = 0;
let passport: Passport | null = null;
let skinIdx = 0;
let titleBob = 0;
let isDaily = false;
const dseed = dailySeed();
let dailyBest = 0;

const BTN_P = { x: 10, y: 10, w: 40, h: 40 };
const BTN_M = { x: W - 50, y: 10, w: 40, h: 40 };

// ─── Passport & Save ────────────────────────────────────────────────────────
function loadPassport() {
  try { const r = localStorage.getItem('melos_passport'); if (r) passport = JSON.parse(r); } catch { /* */ }
}
function savePassport() {
  if (!passport) return;
  try { localStorage.setItem('melos_passport', JSON.stringify(passport)); } catch { /* */ }
}

function loadData() {
  try {
    hiScore = parseInt(localStorage.getItem('crossy_hi') || '0') || 0;
    totalStones = parseInt(localStorage.getItem('crossy_ts') || '0') || 0;
    skinIdx = parseInt(localStorage.getItem('crossy_sk') || '0') || 0;
    dailyBest = parseInt(localStorage.getItem('crossy_d' + dseed) || '0') || 0;
    tutorialShown = localStorage.getItem('crossy_tut') === '1';
    const u = localStorage.getItem('crossy_ul');
    if (u) { const a = JSON.parse(u) as boolean[]; a.forEach((v, i) => { if (i < SKINS.length) SKINS[i].unlocked = v; }); }
  } catch { /* */ }
  loadAchievements();
}
function saveData() {
  try {
    localStorage.setItem('crossy_hi', '' + hiScore);
    localStorage.setItem('crossy_ts', '' + totalStones);
    localStorage.setItem('crossy_sk', '' + skinIdx);
    localStorage.setItem('crossy_d' + dseed, '' + dailyBest);
    localStorage.setItem('crossy_ul', JSON.stringify(SKINS.map(s => s.unlocked)));
  } catch { /* */ }
}

// ─── Lane Generation ────────────────────────────────────────────────────────
function realmFor(row: number): Realm {
  return (Math.floor(row / 100) % 5) as Realm;
}

function genLane(row: number): Lane {
  const realm = realmFor(row);
  const r = isDaily ? new Rng(dseed * 1000 + row) : rng;

  // Boss every 100 steps
  if (row > 0 && row % 100 === 0) {
    return { kind: LaneKind.Boss, realm, y: row, obs: [], items: [],
      bossHP: 3 + Math.floor(row / 200), bossMaxHP: 3 + Math.floor(row / 200),
      bossAtkTimer: 2, bossPat: 0 };
  }

  // Safe every ~7 rows or at start
  if (row % 7 === 0 || row < 3) {
    const l: Lane = { kind: LaneKind.Safe, realm, y: row, obs: [], items: [] };
    if (row > 5 && r.next() < 0.3)
      l.items.push({ col: r.int(0, COLS - 1), kind: 'stone', taken: false, bob: r.next() * 6.28 });
    return l;
  }

  // Bonus
  if (row > 10 && r.next() < 0.08) {
    const l: Lane = { kind: LaneKind.Bonus, realm, y: row, obs: [], items: [] };
    const n = r.int(2, 4); const used = new Set<number>();
    for (let i = 0; i < n; i++) {
      let c: number; do { c = r.int(0, COLS - 1); } while (used.has(c)); used.add(c);
      const kinds: Item['kind'][] = ['stone', 'stone', 'stone', 'shield', 'fly', 'freeze'];
      l.items.push({ col: c, kind: r.pick(kinds), taken: false, bob: r.next() * 6.28 });
    }
    return l;
  }

  // Type selection
  const roll = r.next();
  const kind: LaneKind = roll < 0.4 ? LaneKind.Road : roll < 0.65 ? LaneKind.River
    : roll < 0.85 ? LaneKind.Hazard : LaneKind.Safe;

  const dir = r.next() < 0.5 ? Dir.Left : Dir.Right;
  const diff = Math.min(row / 500, 1);
  const bSpd = 40 + diff * 60;

  const l: Lane = { kind, realm, y: row, obs: [], items: [] };

  if (kind === LaneKind.Road) {
    const n = r.int(1, 2 + Math.floor(diff * 2));
    const sp = bSpd * (0.8 + r.next() * 0.6);
    const vmap: Record<number, string[]> = {
      [Realm.Wind]: ['gust', 'debris'], [Realm.Thunder]: ['spark', 'cloud'],
      [Realm.Fire]: ['fireball', 'cart'], [Realm.Ice]: ['boulder', 'sled'],
      [Realm.Chaos]: ['orb', 'walker'],
    };
    for (let i = 0; i < n; i++) {
      l.obs.push({ x: r.next() * W, w: r.int(40, 70), spd: sp * (0.8 + r.next() * 0.4),
        dir, visual: r.pick(vmap[realm]), active: true });
    }
  } else if (kind === LaneKind.River) {
    l.riverDir = dir; l.riverSpd = 30 + diff * 30 + r.next() * 20;
    const n = r.int(2, 4);
    const vis = realm === Realm.Ice ? 'ice_raft' : realm === Realm.Fire ? 'rock_raft' : 'log';
    for (let i = 0; i < n; i++) {
      l.obs.push({ x: (W / n) * i + r.next() * 30, w: r.int(50, 90),
        spd: l.riverSpd!, dir, visual: vis, active: true });
    }
  } else if (kind === LaneKind.Hazard) {
    l.hazTimer = r.next() * 2; l.hazActive = false; l.hazWarn = 0;
    if (realm === Realm.Thunder) {
      const sc = r.int(1, COLS - 2);
      l.obs.push({ x: sc * CELL_W, w: CELL_W * 2, spd: 0, dir: Dir.Left,
        visual: 'lightning', active: false, timer: 0 });
    } else if (realm === Realm.Fire) {
      l.obs.push({ x: 0, w: W, spd: 0, dir: Dir.Left, visual: 'fire_wall', active: false, timer: 0 });
    } else {
      l.obs.push({ x: r.int(0, 3) * CELL_W, w: CELL_W * r.int(2, 4), spd: 0,
        dir: Dir.Left, visual: 'hazard', active: false, timer: 0 });
    }
  }

  // Realm modifiers
  if (realm === Realm.Wind) { l.windDir = r.next() < 0.5 ? Dir.Left : Dir.Right; l.windStr = 15 + r.next() * 25; }
  if (realm === Realm.Ice && kind !== LaneKind.River) { l.icy = r.next() < 0.4; }

  // Items
  if (row > 3 && r.next() < 0.15) {
    l.items.push({ col: r.int(0, COLS - 1), kind: 'stone', taken: false, bob: r.next() * 6.28 });
  }

  return l;
}

function ensureLanes() {
  const top = camY + Math.ceil(H / LANE_H) + 5;
  while (genTo < top + 10) { genTo++; lanes.push(genLane(genTo)); }
  while (lanes.length > 0 && lanes[0].y < camY - 10) lanes.shift();
}

function getLane(row: number): Lane | undefined {
  return lanes.find(l => l.y === row);
}

// ─── Particle System ────────────────────────────────────────────────────────
function emit(p: Omit<Ptcl, 'life'> & { life?: number }) {
  if (ptcls.length >= MAX_PARTICLES) ptcls.shift();
  ptcls.push({ ...p, life: p.life ?? p.max } as Ptcl);
}

function burst(x: number, y: number, c: string, n: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, s = 20 + Math.random() * 40;
    emit({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      max: 0.4 + Math.random() * 0.3, color: c, sz: 2 + Math.random() * 3, tag: 'dust' });
  }
}

function inkDeath(x: number, y: number) {
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * 6.28, s = 30 + Math.random() * 80;
    emit({ x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20,
      max: 0.8 + Math.random() * 0.6,
      color: Math.random() < 0.5 ? '#111122' : '#223344',
      sz: 3 + Math.random() * 6, tag: 'ink' });
  }
}

function realmPtcls(realm: Realm) {
  const rd = REALMS[realm];
  for (let i = 0; i < 3; i++) {
    const x = Math.random() * W, sy = Math.random() * H;
    switch (realm) {
      case Realm.Wind:
        emit({ x, y: sy, vx: (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 60), vy: (Math.random() - 0.5) * 10, max: 1 + Math.random(), color: rd.accent2, sz: 1 + Math.random() * 2, tag: 'wind' });
        break;
      case Realm.Thunder:
        if (Math.random() < 0.1)
          emit({ x, y: sy, vx: (Math.random() - 0.5) * 20, vy: 50 + Math.random() * 30, max: 0.2 + Math.random() * 0.2, color: '#fff', sz: 1 + Math.random(), tag: 'zap' });
        break;
      case Realm.Fire:
        emit({ x, y: H + 10, vx: (Math.random() - 0.5) * 15, vy: -(30 + Math.random() * 50), max: 1 + Math.random() * 1.5, color: Math.random() < 0.5 ? '#ff6622' : '#ffaa44', sz: 1.5 + Math.random() * 2.5, tag: 'ember' });
        break;
      case Realm.Ice:
        emit({ x, y: -10, vx: (Math.random() - 0.5) * 20, vy: 15 + Math.random() * 25, max: 2 + Math.random(), color: '#ccddff', sz: 1 + Math.random() * 2, tag: 'ice' });
        break;
      case Realm.Chaos:
        emit({ x, y: sy, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, max: 0.5 + Math.random() * 0.5, color: `hsl(${Math.random() * 360},80%,60%)`, sz: 2 + Math.random() * 3, tag: 'chaos' });
        break;
    }
  }
}

function tickPtcls(dt: number) {
  for (let i = ptcls.length - 1; i >= 0; i--) {
    const p = ptcls[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.tag === 'ember' || p.tag === 'dust') p.vy -= 10 * dt;
    if (p.tag === 'ink') { p.sz += 2 * dt; p.vx *= 0.95; p.vy *= 0.95; }
    if (p.life <= 0) ptcls.splice(i, 1);
  }
}

// ─── Coordinate Conversion ──────────────────────────────────────────────────
function rowY(row: number): number { return H - (row - camY) * LANE_H - LANE_H; }
function colX(col: number): number { return col * CELL_W + CELL_W / 2; }

// ─── Core Logic ─────────────────────────────────────────────────────────────
function resetGame() {
  rng = isDaily ? new Rng(dseed) : new Rng(Date.now());
  pCol = 3; pRow = 0;
  pX = colX(3); pY = rowY(0); pTX = pX; pTY = pY;
  pHop = false; pHopT = 0; pSqX = 1; pSqY = 1;
  pDead = false; pDeadT = 0; pOnRiv = false; pRivVx = 0;
  pFace = Dir.Right; pScarf = [];
  pShield = 0; pFlyN = 0; pFlying = false; pFreezeT = 0;
  camY = -PLAYER_START_ROW; camSpd = 0.8;
  score = 0; steps = 0; maxRow = 0; stones = 0;
  curRealm = Realm.Wind; combo = 0; comboT = 0; scoreMul = 1;
  nmT = 0; nmSlow = false;
  bossOn = false; bossRow = -1; bossAtkX = -1; bossAtkT = 0; bossFlashT = 0;
  shakeT = 0; flashT = 0; realmT = 0; chaosT = 0;
  lanes = []; ptcls = []; genTo = -1;
  // Reset new state
  resetSessionStats();
  deathCount = 0;
  ceremonyActive = false; ceremonyT = 0;
  passedCeremonies = new Set<number>();
  deathInkActive = false; inkDeathPtcls = [];
  breatheT = 0; idleT = 0;
  lastHopTime = 0; quickHopStreak = 0;
  showShareCard = false;
  laneDecorations.clear();
  bgLayers = generateBgLayers();
  achNotifyQueue = []; achNotifyActive = null;
  if (SKINS[skinIdx].ability === 'shield_start') pShield = 1;
  ensureLanes();
  pX = colX(pCol); pTX = pX; pY = rowY(pRow); pTY = pY;
  scene = 'play';
  initAudio(); startBGM(Realm.Wind);
}

function hop(dr: number, dc: number) {
  if (pHop || pDead) return;
  if (pFlying && dr <= 0) return;

  const nc = Math.max(0, Math.min(COLS - 1, pCol + dc));
  const nr = pRow + dr;
  if (nr < Math.floor(camY) - 1) return;

  pCol = nc; pRow = nr;
  pHop = true; pHopT = HOP_DUR;
  if (dc !== 0) pFace = dc > 0 ? Dir.Right : Dir.Left;
  pSqX = 0.7; pSqY = 1.3;
  pTX = colX(pCol); pTY = rowY(pRow);
  steps++; score += 10 * scoreMul;

  if (pFlying) { pFlyN--; if (pFlyN <= 0) pFlying = false; }

  combo++; comboT = COMBO_TIMEOUT;
  if (combo > 2) {
    scoreMul = 1 + Math.floor(combo / 3) * 0.5;
    sfx('combo', combo);
    for (let i = 0; i < 3; i++)
      emit({ x: pTX + (Math.random() - 0.5) * 20, y: pTY,
        vx: (Math.random() - 0.5) * 40, vy: -40 - Math.random() * 30,
        max: 0.5, color: GOLD, sz: 3, tag: 'combo' });
  }

  if (nr > maxRow) { maxRow = nr; score += 5; }

  // Track max combo for achievements
  if (combo > maxComboEver) {
    maxComboEver = combo;
    saveAchievements();
  }

  // Quick hop combo processing
  processQuickHop();

  // Realm transition
  const nrealm = realmFor(nr);
  if (nrealm !== curRealm) {
    realmFrom = curRealm; realmTo = nrealm; realmT = 1.5;
    curRealm = nrealm; sfx('realm'); startBGM(nrealm);
  }

  // Ceremony check at milestone rows
  for (const cr of CEREMONY_ROWS) {
    if (nr >= cr && !passedCeremonies.has(cr)) {
      triggerCeremony(cr, realmFor(cr));
    }
  }

  // Achievement checks
  checkAchievements();

  sfx('hop', getLane(nr)?.kind ?? 0);
  burst(pTX, pTY + 15, REALMS[curRealm].accent, 5);
}

function kill() {
  if (pDead) return;
  if (pShield > 0) {
    pShield--;
    shakeT = 0.2; shakeI = 5; flashT = 0.1; flashC = '#fff';
    burst(pX, pY, '#fff', 15); sfx('powerup');
    return;
  }
  pDead = true; pDeadT = 2; deathCount++;
  sfx('death'); inkDeath(pX, pY); triggerInkDeath(pX, pY);
  shakeT = 0.5; shakeI = 12; stopBGM();
  haptic(1.0);
  if (score > hiScore) hiScore = score;
  if (isDaily && score > dailyBest) dailyBest = score;
  totalStones += stones; saveData();
  if (passport) {
    passport.gamesPlayed++; passport.totalScore += score;
    passport.lastPlayed = new Date().toISOString().split('T')[0];
    if (!passport.completedGames.includes('tribulation-climb') && steps >= 500)
      passport.completedGames.push('tribulation-climb');
    savePassport();
  }
}

function nearMiss(x: number, y: number) {
  if (nmT > 0) return;
  nmT = 0.6; nmSlow = true; nmX = x; nmY = y;
  score += 50 * scoreMul; shakeT = 0.15; shakeI = 4;
  sfx('near_miss'); burst(x, y, '#ffdd44', 8);
  haptic(0.3);
  sessionStats.nearMisses++;
  addScorePopup(x, y - 20, '+' + Math.floor(50 * scoreMul), '#ffdd44');
}

function checkHits() {
  if (pDead || pHop) return;
  const lane = getLane(pRow);
  if (!lane) return;
  const px = pX, pw = 18;

  // River
  if (lane.kind === LaneKind.River && !pFlying) {
    let on = false;
    for (const o of lane.obs) {
      if (o.active && px > o.x - o.w / 2 - pw && px < o.x + o.w / 2 + pw)
        { on = true; pOnRiv = true; pRivVx = o.spd * o.dir; break; }
    }
    if (!on) { kill(); return; }
  } else { pOnRiv = false; pRivVx = 0; }

  // Road
  if (lane.kind === LaneKind.Road && !pFlying) {
    for (const o of lane.obs) {
      if (!o.active) continue;
      const d = Math.abs(px - o.x);
      if (d < o.w / 2 + pw - 5) { kill(); return; }
      if (d < o.w / 2 + pw + 15 && d >= o.w / 2 + pw - 5)
        nearMiss(px, rowY(pRow));
    }
  }

  // Hazard
  if (lane.kind === LaneKind.Hazard && !pFlying) {
    for (const o of lane.obs) {
      if (!o.active) continue;
      if (px > o.x - 5 && px < o.x + o.w + 5) {
        if (curRealm === Realm.Fire && SKINS[skinIdx].ability === 'fire_imm') {
          shakeT = 0.15; shakeI = 3;
        } else { kill(); return; }
      }
    }
  }

  // Boss attack
  if (lane.kind === LaneKind.Boss && lane.bossHP && lane.bossHP > 0 && bossAtkX >= 0) {
    if (Math.abs(px - bossAtkX) < CELL_W && !pFlying) { kill(); return; }
  }

  // Items
  for (const c of lane.items) {
    if (c.taken) continue;
    if (Math.abs(px - colX(c.col)) < CELL_W * 0.7) {
      c.taken = true;
      const cx = colX(c.col), cy = rowY(pRow);
      switch (c.kind) {
        case 'stone': {
          const amt = SKINS[skinIdx].ability === 'dbl_stone' ? 2 : 1;
          stones += amt; score += 25 * amt; sfx('collect'); burst(cx, cy, GOLD, 8);
          lifetimeStonesCollected += amt; checkAchievements(); break;
        }
        case 'shield': pShield = 1; sfx('powerup'); burst(cx, cy, '#88ddff', 10); break;
        case 'fly': {
          const ext = SKINS[skinIdx].ability === 'fly_ext' ? 2 : 0;
          pFlyN = 5 + ext; pFlying = true; sfx('powerup'); burst(cx, cy, '#ffdd55', 10); break;
        }
        case 'freeze': pFreezeT = 3; sfx('powerup'); burst(cx, cy, '#aaddff', 10); break;
      }
    }
  }

  // Off-screen
  if (px < -10 || px > W + 10) kill();
}

function tickLanes(dt: number) {
  const frozen = pFreezeT > 0;
  const eDt = frozen ? dt * 0.05 : dt;

  for (const l of lanes) {
    if (l.kind === LaneKind.Road || l.kind === LaneKind.River) {
      for (const o of l.obs) {
        o.x += o.spd * o.dir * eDt;
        if (o.dir === Dir.Right && o.x > W + o.w) o.x = -o.w;
        if (o.dir === Dir.Left && o.x < -o.w) o.x = W + o.w;
      }
    }

    if (l.kind === LaneKind.Hazard) {
      l.hazTimer = (l.hazTimer || 0) + eDt;
      const cycle = 3, warn = 0.8, act = 0.6;
      const ph = l.hazTimer % cycle;
      if (ph > cycle - warn - act && ph < cycle - act) {
        l.hazWarn = (l.hazWarn || 0) + eDt; l.hazActive = false;
        for (const o of l.obs) o.active = false;
      } else if (ph >= cycle - act) {
        l.hazActive = true; for (const o of l.obs) o.active = true;
      } else {
        l.hazActive = false; l.hazWarn = 0; for (const o of l.obs) o.active = false;
      }
    }

    // Boss
    if (l.kind === LaneKind.Boss && l.bossHP && l.bossHP > 0) {
      if (!bossOn && pRow >= l.y - 3 && pRow <= l.y + 1) {
        bossOn = true; bossRow = l.y; bossAtkT = 2; sfx('boss');
      }
      if (bossOn && l.y === bossRow) {
        bossAtkT -= eDt;
        if (bossAtkT <= 0) {
          l.bossPat = ((l.bossPat || 0) + 1) % 3;
          bossAtkX = l.bossPat === 0 ? colX(1) : l.bossPat === 1 ? colX(5) : colX(3);
          bossAtkT = 1.5; bossFlashT = 0.5;
          shakeT = 0.2; shakeI = 6;
          for (let i = 0; i < 10; i++)
            emit({ x: bossAtkX + (Math.random() - 0.5) * CELL_W * 2,
              y: rowY(bossRow) + (Math.random() - 0.5) * 30,
              vx: (Math.random() - 0.5) * 60, vy: 30 + Math.random() * 40,
              max: 0.5, color: REALMS[l.realm].accent, sz: 4, tag: 'boss' });
          if (pRow === bossRow && Math.abs(pX - bossAtkX) >= CELL_W) {
            l.bossHP--; score += 100; flashT = 0.1; flashC = '#ffdd00';
            if (l.bossHP <= 0) {
              bossOn = false; bossRow = -1; bossAtkX = -1;
              score += 500; burst(W / 2, rowY(l.y), GOLD, 25);
            }
          }
        }
      }
    }
  }
}

function tickScarf(dt: number) {
  if (pScarf.length === 0) {
    for (let i = 0; i < 8; i++) pScarf.push({ x: pX - i * 3, y: pY });
  }
  pScarf[0].x = pX - pFace * 8; pScarf[0].y = pY + 2;
  for (let i = 1; i < pScarf.length; i++) {
    const prev = pScarf[i - 1], cur = pScarf[i];
    const dx = prev.x - cur.x, dy = prev.y - cur.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 5) { const r = 5 / d; cur.x = prev.x - dx * r; cur.y = prev.y - dy * r; }
    cur.y += 10 * dt;
    const lane = getLane(pRow);
    if (lane?.windDir !== undefined) cur.x += lane.windDir * 8 * dt;
  }
}

function update(fdt: number) {
  if (scene !== 'play' || paused) return;
  const ts = nmSlow ? 0.3 : 1;
  const dt = fdt * ts;

  if (comboT > 0) { comboT -= dt; if (comboT <= 0) { combo = 0; scoreMul = 1; } }
  if (pFreezeT > 0) pFreezeT -= dt;
  if (nmT > 0) { nmT -= dt; if (nmT <= 0) nmSlow = false; }

  camSpd = Math.min(0.8 + steps * 0.002, 3.5);
  camY += camSpd * dt;
  const tCam = pRow - PLAYER_START_ROW;
  if (tCam > camY) camY += (tCam - camY) * 3 * dt;

  if (!pDead && pRow < camY - 1) kill();

  if (pHop) {
    pHopT -= fdt;
    if (pHopT <= 0) { pHop = false; pHopT = 0; pSqX = 1.2; pSqY = 0.8; }
  }
  pSqX += (1 - pSqX) * 10 * fdt;
  pSqY += (1 - pSqY) * 10 * fdt;

  const ls = 15;
  pX += (pTX - pX) * ls * fdt;
  pY += (pTY - pY) * ls * fdt;

  if (pOnRiv && !pHop) {
    pX += pRivVx * dt; pTX += pRivVx * dt;
    pCol = Math.max(0, Math.min(COLS - 1, Math.round((pX - CELL_W / 2) / CELL_W)));
  }
  if (!pHop && !pDead) {
    const lane = getLane(pRow);
    if (lane?.windDir !== undefined && lane.windStr) {
      pX += lane.windDir * lane.windStr * dt;
      pTX += lane.windDir * lane.windStr * dt;
      pCol = Math.max(0, Math.min(COLS - 1, Math.round((pX - CELL_W / 2) / CELL_W)));
    }
    if (lane?.icy && SKINS[skinIdx].ability !== 'ice_imm') {
      pX += pFace * 15 * dt; pTX += pFace * 15 * dt;
    }
  }
  if (!pHop) { pTY = rowY(pRow); if (!pOnRiv) pTX = colX(pCol); }
  else { pTY = rowY(pRow); pTX = colX(pCol); }

  tickScarf(fdt); tickLanes(dt); checkHits(); ensureLanes();
  if (frame % 3 === 0) realmPtcls(curRealm);
  tickPtcls(fdt);
  tickCeremony(fdt);
  tickInkDeath(fdt);
  tickAchNotify(fdt);
  tickWeather(fdt);
  tickScorePopups(fdt);
  tickCalliTexts(fdt);
  tickTrail();
  sessionStats.timeAlive += fdt;
  sessionStats.realmsVisited.add(curRealm);
  if (combo > sessionStats.maxCombo) sessionStats.maxCombo = combo;
  updateAmbient(curRealm);

  if (shakeT > 0) shakeT -= fdt;
  if (flashT > 0) flashT -= fdt;
  if (realmT > 0) realmT -= fdt;
  if (curRealm === Realm.Chaos) chaosT += fdt;
  if (bossFlashT > 0) bossFlashT -= fdt;

  // Check achievements periodically
  if (frame % 60 === 0) checkAchievements();
  if (screenTransT > 0) screenTransT -= fdt;

  if (pDead) { pDeadT -= fdt; if (pDeadT <= 0) scene = 'over'; }
}

// ─── Drawing Helpers ────────────────────────────────────────────────────────
function rr(x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawBtn(x: number, y: number, w: number, h: number, txt: string, bg: string, fg: string) {
  ctx.fillStyle = bg; rr(x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = bg + '88'; ctx.lineWidth = 1; rr(x, y, w, h, 8); ctx.stroke();
  ctx.fillStyle = fg;
  ctx.font = 'bold 16px "Noto Serif SC",serif';
  ctx.textAlign = 'center'; ctx.fillText(txt, x + w / 2, y + h / 2 + 6);
}

// ─── Render: Background ─────────────────────────────────────────────────────
function drawBg() {
  const rd = REALMS[curRealm];
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, rd.bg1); g.addColorStop(1, rd.bg2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // Mountains
  ctx.fillStyle = rd.bg2;
  const mo = camY * 5;
  for (let i = 0; i < 5; i++) {
    const mx = (i * 120 - mo % 600 + 600) % 600 - 80;
    const mh = 60 + Math.sin(i * 2.7) * 30;
    ctx.beginPath(); ctx.moveTo(mx - 60, H); ctx.lineTo(mx, H - mh); ctx.lineTo(mx + 60, H); ctx.fill();
  }
  // Clouds
  ctx.globalAlpha = 0.15; ctx.fillStyle = rd.accent;
  const co = camY * 15;
  for (let i = 0; i < 4; i++) {
    const cx = (i * 130 + 40 - co * 0.3 % 600 + 600) % 600 - 50;
    const cy = 100 + Math.sin(i * 1.5 + frame * 0.01) * 20;
    ctx.beginPath(); ctx.ellipse(cx, cy, 50 + i * 10, 15, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ─── Render: Lane ───────────────────────────────────────────────────────────
function drawLane(l: Lane) {
  const sy = rowY(l.y);
  if (sy < -LANE_H - 20 || sy > H + LANE_H + 20) return;
  const rd = REALMS[l.realm];

  // Base
  ctx.fillStyle = rd.lane[l.y % 2];
  ctx.fillRect(0, sy, W, LANE_H);

  switch (l.kind) {
    case LaneKind.Safe: {
      ctx.globalAlpha = 0.1; ctx.fillStyle = rd.accent;
      for (let i = 0; i < 3; i++) {
        const sx = (l.y * 97 + i * 137) % W;
        ctx.beginPath(); ctx.ellipse(sx, sy + LANE_H / 2, 30 + (l.y * 13 % 20), 8, 0, 0, 6.28); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = rd.accent + '33'; ctx.lineWidth = 1;
      for (let i = 0; i < COLS; i++) {
        const gx = i * CELL_W + CELL_W / 2 + ((l.y * 7) % 10 - 5);
        ctx.beginPath(); ctx.moveTo(gx - 5, sy + LANE_H - 5);
        ctx.lineTo(gx, sy + LANE_H - 10); ctx.lineTo(gx + 5, sy + LANE_H - 5); ctx.stroke();
      }
      break;
    }
    case LaneKind.River: {
      ctx.fillStyle = l.realm === Realm.Fire ? '#44220088' : l.realm === Realm.Ice ? '#22445588' : '#11335588';
      ctx.fillRect(0, sy, W, LANE_H);
      ctx.strokeStyle = rd.accent + '44'; ctx.lineWidth = 1;
      const ro = frame * 0.03 * (l.riverDir || 1);
      for (let i = 0; i < 6; i++) {
        const rx = (i * 70 + ro * 30) % (W + 40) - 20;
        ctx.beginPath(); ctx.moveTo(rx, sy + LANE_H / 2 - 3);
        ctx.quadraticCurveTo(rx + 15, sy + LANE_H / 2 - 8, rx + 30, sy + LANE_H / 2 - 3); ctx.stroke();
      }
      for (const o of l.obs) drawPlatform(o, sy, l.realm);
      break;
    }
    case LaneKind.Road: {
      ctx.strokeStyle = rd.accent + '22'; ctx.lineWidth = 1;
      ctx.setLineDash([8, 12]);
      ctx.beginPath(); ctx.moveTo(0, sy + LANE_H / 2); ctx.lineTo(W, sy + LANE_H / 2); ctx.stroke();
      ctx.setLineDash([]);
      for (const o of l.obs) drawObs(o, sy, l.realm);
      break;
    }
    case LaneKind.Hazard: {
      if (l.hazWarn && l.hazWarn > 0) {
        if (Math.sin(l.hazWarn * 20) > 0) {
          ctx.fillStyle = rd.accent + '33';
          for (const o of l.obs) ctx.fillRect(o.x, sy, o.w, LANE_H);
        }
        ctx.fillStyle = '#ff4444'; ctx.font = '16px "Noto Serif SC",serif'; ctx.textAlign = 'center';
        for (const o of l.obs) ctx.fillText('!', o.x + o.w / 2, sy + LANE_H / 2 + 5);
      }
      if (l.hazActive) {
        for (const o of l.obs) {
          if (o.visual === 'lightning') drawZap(o.x + o.w / 2, sy, o.w, LANE_H);
          else if (o.visual === 'fire_wall') drawFireWall(sy);
          else { ctx.fillStyle = rd.accent + '88'; ctx.fillRect(o.x, sy + 4, o.w, LANE_H - 8); }
        }
      }
      break;
    }
    case LaneKind.Bonus: {
      ctx.fillStyle = GOLD + '11'; ctx.fillRect(0, sy, W, LANE_H);
      ctx.strokeStyle = GOLD + '33'; ctx.lineWidth = 1; ctx.strokeRect(1, sy + 1, W - 2, LANE_H - 2);
      break;
    }
    case LaneKind.Boss: drawBossGate(l, sy); break;
  }

  // Icy overlay
  if (l.icy) {
    ctx.globalAlpha = 0.2; ctx.fillStyle = '#88ccff'; ctx.fillRect(0, sy, W, LANE_H); ctx.globalAlpha = 1;
    ctx.strokeStyle = '#aaddff44'; ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const ix = (l.y * 53 + i * 79) % W;
      drawCrystal(ix, sy + LANE_H / 2, 6);
    }
  }
  // Wind lines
  if (l.windDir !== undefined && l.windStr && l.windStr > 20) {
    ctx.strokeStyle = '#88bbdd33'; ctx.lineWidth = 1;
    const wo = frame * 2 * l.windDir;
    for (let i = 0; i < 4; i++) {
      const wy = sy + 10 + i * 12;
      const wx = (wo + i * 100) % (W + 60) - 30;
      ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + 20 * l.windDir, wy); ctx.stroke();
    }
  }

  // Items
  for (const c of l.items) {
    if (c.taken) continue;
    c.bob += 0.05;
    drawItem(c, colX(c.col), sy + LANE_H / 2 + Math.sin(c.bob) * 4);
  }
}

function drawLaneEnhanced(l: Lane) {
  const sy = rowY(l.y);
  if (sy < -LANE_H - 20 || sy > H + LANE_H + 20) return;
  const rd = REALMS[l.realm];

  // Base
  ctx.fillStyle = rd.lane[l.y % 2];
  ctx.fillRect(0, sy, W, LANE_H);

  switch (l.kind) {
    case LaneKind.Safe: {
      drawEnhancedSafe(l, sy);
      break;
    }
    case LaneKind.River: {
      drawEnhancedRiver(l, sy);
      break;
    }
    case LaneKind.Road: {
      drawEnhancedRoad(l, sy, rd);
      break;
    }
    case LaneKind.Hazard: {
      drawEnhancedHazard(l, sy);
      break;
    }
    case LaneKind.Bonus: {
      ctx.fillStyle = GOLD + '11'; ctx.fillRect(0, sy, W, LANE_H);
      ctx.strokeStyle = GOLD + '33'; ctx.lineWidth = 1; ctx.strokeRect(1, sy + 1, W - 2, LANE_H - 2);
      // Sparkle effect on bonus lane
      const sparkleT = frame * 0.05;
      for (let i = 0; i < 4; i++) {
        const sx = (l.y * 41 + i * 97 + Math.floor(sparkleT * 10)) % W;
        const sparkleAlpha = (Math.sin(sparkleT + i * 1.5) * 0.5 + 0.5) * 0.3;
        ctx.globalAlpha = sparkleAlpha;
        ctx.fillStyle = GOLD;
        ctx.beginPath(); ctx.arc(sx, sy + LANE_H / 2, 2, 0, 6.28); ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case LaneKind.Boss: drawBossGate(l, sy); break;
  }

  // Icy overlay
  if (l.icy) {
    ctx.globalAlpha = 0.2; ctx.fillStyle = '#88ccff'; ctx.fillRect(0, sy, W, LANE_H); ctx.globalAlpha = 1;
    ctx.strokeStyle = '#aaddff44'; ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const ix = (l.y * 53 + i * 79) % W;
      drawCrystal(ix, sy + LANE_H / 2, 6);
    }
  }
  // Wind lines
  if (l.windDir !== undefined && l.windStr && l.windStr > 20) {
    ctx.strokeStyle = '#88bbdd33'; ctx.lineWidth = 1;
    const wo = frame * 2 * l.windDir;
    for (let i = 0; i < 4; i++) {
      const wy = sy + 10 + i * 12;
      const wx = (wo + i * 100) % (W + 60) - 30;
      ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + 20 * l.windDir, wy); ctx.stroke();
    }
  }

  // Realm-specific ground decoration
  drawRealmGroundFX(l.realm, sy, l.y);

  // Items
  for (const c of l.items) {
    if (c.taken) continue;
    c.bob += 0.05;
    drawItem(c, colX(c.col), sy + LANE_H / 2 + Math.sin(c.bob) * 4);
  }
}

function drawPlatform(o: Obs, sy: number, realm: Realm) {
  const x = o.x - o.w / 2, y = sy + 5, h = LANE_H - 10;
  if (o.visual === 'ice_raft') {
    ctx.fillStyle = '#88bbcc'; ctx.fillRect(x, y, o.w, h);
    ctx.fillStyle = '#aaddee44'; ctx.fillRect(x + 3, y + 3, o.w - 6, h - 6);
  } else if (o.visual === 'rock_raft') {
    ctx.fillStyle = '#554433'; ctx.fillRect(x, y, o.w, h);
    ctx.fillStyle = '#66554433'; ctx.fillRect(x + 2, y + 2, o.w - 4, 3);
  } else {
    ctx.fillStyle = '#665533'; rr(x, y, o.w, h, 4); ctx.fill();
    ctx.fillStyle = '#77664422';
    ctx.fillRect(x + 4, y + h / 2 - 1, o.w - 8, 2);
  }
}

function drawObs(o: Obs, sy: number, realm: Realm) {
  const cx = o.x, cy = sy + LANE_H / 2;
  const hw = o.w / 2, hh = (LANE_H - 12) / 2;
  const rd = REALMS[realm];
  ctx.save(); ctx.translate(cx, cy);

  switch (realm) {
    case Realm.Wind: {
      ctx.fillStyle = rd.obsColor; ctx.globalAlpha = 0.8;
      const wb = Math.sin(frame * 0.1) * 3;
      ctx.beginPath(); ctx.ellipse(wb, 0, hw, hh, 0, 0, 6.28); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#bbddff66'; ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const ly = -hh + i * hh;
        ctx.beginPath(); ctx.moveTo(-hw + 5, ly);
        ctx.quadraticCurveTo(0, ly + 3, hw - 5, ly); ctx.stroke();
      }
      break;
    }
    case Realm.Thunder: {
      ctx.fillStyle = rd.obsColor;
      ctx.beginPath(); ctx.arc(0, 0, hw * 0.7, 0, 6.28); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        const a = frame * 0.15 + i * Math.PI / 2;
        const r1 = hw * 0.7, r2 = hw * 1.1;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
        ctx.lineTo(Math.cos(a + 0.2) * (r1 + r2) / 2, Math.sin(a + 0.2) * (r1 + r2) / 2);
        ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); ctx.stroke();
      }
      break;
    }
    case Realm.Fire: {
      ctx.fillStyle = '#ff4411';
      ctx.beginPath(); ctx.arc(0, 0, hw * 0.6, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#ffaa33';
      for (let i = 0; i < 5; i++) {
        const fa = frame * 0.2 + i * 1.2;
        const fr = hw * 0.3 + Math.sin(fa) * hw * 0.15;
        const fx = Math.cos(i * 1.3) * hw * 0.4;
        const fy = Math.sin(i * 1.3) * hh * 0.4 - Math.abs(Math.sin(fa)) * 5;
        ctx.beginPath(); ctx.arc(fx, fy, fr, 0, 6.28); ctx.fill();
      }
      ctx.fillStyle = '#ffee88';
      ctx.beginPath(); ctx.arc(0, 0, hw * 0.3, 0, 6.28); ctx.fill();
      break;
    }
    case Realm.Ice: {
      ctx.fillStyle = '#88aacc'; rr(-hw, -hh, hw * 2, hh * 2, 6); ctx.fill();
      ctx.fillStyle = '#aaccee44'; ctx.fillRect(-hw + 3, -hh + 3, hw * 2 - 6, 4);
      ctx.strokeStyle = '#ffffff33'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-hw + 5, -hh + 5); ctx.lineTo(-hw + 15, -hh + 5); ctx.stroke();
      break;
    }
    default: { // Chaos
      const hue = (frame * 3 + o.x) % 360;
      ctx.fillStyle = `hsl(${hue},70%,50%)`;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * 6.28 + frame * 0.05;
        const r = hw * 0.5 + Math.sin(a * 3 + frame * 0.1) * hw * 0.3;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}

function drawZap(x: number, y: number, w: number, h: number) {
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
  ctx.shadowColor = '#aaf'; ctx.shadowBlur = 15;
  ctx.beginPath();
  let lx = x, ly = y;
  for (let i = 0; i < 6; i++) {
    lx += (Math.random() - 0.5) * w * 0.4;
    ly += h / 6;
    ctx.lineTo(lx, ly);
  }
  ctx.stroke();
  ctx.lineWidth = 1.5; ctx.beginPath();
  ctx.moveTo(x + (Math.random() - 0.5) * 10, y + h * 0.3);
  ctx.lineTo(x + w * 0.3 * (Math.random() < 0.5 ? 1 : -1), y + h * 0.5);
  ctx.stroke(); ctx.shadowBlur = 0;
}

function drawFireWall(y: number) {
  for (let i = 0; i < W; i += 8) {
    const fh = 20 + Math.sin(i * 0.1 + frame * 0.15) * 15;
    const g = ctx.createLinearGradient(i, y + LANE_H, i, y + LANE_H - fh);
    g.addColorStop(0, '#ff220088'); g.addColorStop(0.5, '#ff660066'); g.addColorStop(1, '#ffaa0000');
    ctx.fillStyle = g; ctx.fillRect(i, y + LANE_H - fh, 8, fh);
  }
}

function drawCrystal(x: number, y: number, sz: number) {
  ctx.save(); ctx.translate(x, y);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * 6.28;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * sz, Math.sin(a) * sz); ctx.stroke();
    const bx = Math.cos(a) * sz * 0.6, by = Math.sin(a) * sz * 0.6;
    ctx.beginPath(); ctx.moveTo(bx, by);
    ctx.lineTo(bx + Math.cos(a + 0.5) * sz * 0.3, by + Math.sin(a + 0.5) * sz * 0.3); ctx.stroke();
  }
  ctx.restore();
}

function drawBossGate(l: Lane, sy: number) {
  const rd = REALMS[l.realm];
  const g = ctx.createLinearGradient(0, sy - 20, 0, sy + LANE_H + 20);
  g.addColorStop(0, rd.accent + '44'); g.addColorStop(0.5, rd.accent + '88'); g.addColorStop(1, rd.accent + '44');
  ctx.fillStyle = g; ctx.fillRect(0, sy - 10, W, LANE_H + 20);

  ctx.fillStyle = GOLD_DARK;
  ctx.fillRect(10, sy - 15, 20, LANE_H + 30);
  ctx.fillRect(W - 30, sy - 15, 20, LANE_H + 30);

  ctx.strokeStyle = GOLD; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(10, sy - 15);
  ctx.quadraticCurveTo(W / 2, sy - 50, W - 10, sy - 15); ctx.stroke();

  if (l.bossHP !== undefined && l.bossMaxHP) {
    const bw = 120, bh = 8, bx = W / 2 - bw / 2, by = sy - 25;
    ctx.fillStyle = '#333'; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#dd3333'; ctx.fillRect(bx, by, bw * (l.bossHP / l.bossMaxHP), bh);
    ctx.strokeStyle = GOLD + '88'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh);
  }

  ctx.fillStyle = GOLD; ctx.font = 'bold 14px "Noto Serif SC",serif'; ctx.textAlign = 'center';
  ctx.fillText('— 劫关 —', W / 2, sy + LANE_H / 2 + 5);

  if (bossOn && bossRow === l.y && bossFlashT > 0) {
    ctx.fillStyle = `rgba(255,50,50,${bossFlashT})`;
    ctx.beginPath(); ctx.arc(bossAtkX, sy + LANE_H / 2, CELL_W * 0.8, 0, 6.28); ctx.fill();
  }
}

function drawItem(c: Item, x: number, y: number) {
  ctx.save(); ctx.translate(x, y);
  switch (c.kind) {
    case 'stone': {
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.moveTo(0, -8); ctx.lineTo(6, -2); ctx.lineTo(4, 6); ctx.lineTo(-4, 6); ctx.lineTo(-6, -2);
      ctx.closePath(); ctx.fill();
      ctx.shadowColor = GOLD; ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffe088'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, 6.28); ctx.fill();
      ctx.shadowBlur = 0; break;
    }
    case 'shield': {
      ctx.fillStyle = '#55aaff';
      ctx.beginPath();
      ctx.moveTo(0, -8); ctx.lineTo(7, -4); ctx.lineTo(7, 2); ctx.lineTo(0, 8);
      ctx.lineTo(-7, 2); ctx.lineTo(-7, -4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#88ccff'; ctx.font = 'bold 10px serif'; ctx.textAlign = 'center';
      ctx.fillText('盾', 0, 3); break;
    }
    case 'fly': {
      ctx.fillStyle = '#ffdd55';
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-10, -8, -6, 4);
      ctx.quadraticCurveTo(0, 0, 6, 4);
      ctx.quadraticCurveTo(10, -8, 0, 0); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 8px serif'; ctx.textAlign = 'center';
      ctx.fillText('飞', 0, 4); break;
    }
    case 'freeze': {
      ctx.strokeStyle = '#aaddff'; ctx.lineWidth = 1.5;
      drawCrystal(0, 0, 7); break;
    }
  }
  ctx.restore();
}

// ─── Render: Player ─────────────────────────────────────────────────────────
function drawPlayer() {
  if (pDead) return;
  const sk = SKINS[skinIdx];
  ctx.save();
  ctx.translate(pX, pY + LANE_H / 2 - 2);

  let arc = 0;
  if (pHop) { const t = 1 - pHopT / HOP_DUR; arc = Math.sin(t * Math.PI) * 20; }
  ctx.translate(0, -arc);

  if (pFlying) {
    ctx.shadowColor = '#ffdd55'; ctx.shadowBlur = 15;
    ctx.fillStyle = '#ffdd5555';
    ctx.beginPath(); ctx.ellipse(-12, 5, 10, 6, -0.3, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.ellipse(12, 5, 10, 6, 0.3, 0, 6.28); ctx.fill();
  }
  if (pShield > 0) {
    ctx.strokeStyle = '#55aaff66'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 18, 0, 6.28); ctx.stroke();
  }

  ctx.scale(pSqX, pSqY);

  // Body
  ctx.fillStyle = sk.c1; rr(-8, -10, 16, 20, 4); ctx.fill();
  ctx.fillStyle = sk.c2; rr(-6, -8, 12, 8, 2); ctx.fill();

  // Eyes
  const ed = pFace;
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(-3 + ed, -3, 2, 0, 6.28); ctx.fill();
  ctx.beginPath(); ctx.arc(3 + ed, -3, 2, 0, 6.28); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-2.5 + ed * 1.5, -3.5, 0.8, 0, 6.28); ctx.fill();
  ctx.beginPath(); ctx.arc(3.5 + ed * 1.5, -3.5, 0.8, 0, 6.28); ctx.fill();

  // Mouth
  ctx.strokeStyle = '#111'; ctx.lineWidth = 1;
  ctx.beginPath();
  if (pHop) ctx.arc(0, 2, 2, 0, Math.PI);
  else ctx.arc(0, 1.5, 2, 0.2, Math.PI - 0.2);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.restore();

  // Scarf
  if (pScarf.length >= 2) {
    ctx.strokeStyle = sk.scarf; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(pScarf[0].x, pScarf[0].y + LANE_H / 2 - 2);
    for (let i = 1; i < pScarf.length; i++)
      ctx.lineTo(pScarf[i].x, pScarf[i].y + LANE_H / 2 - 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    const last = pScarf[pScarf.length - 1];
    ctx.strokeStyle = sk.scarf + '88';
    ctx.beginPath(); ctx.moveTo(last.x, last.y + LANE_H / 2 - 2);
    ctx.lineTo(last.x - 3, last.y + LANE_H / 2 + 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(last.x, last.y + LANE_H / 2 - 2);
    ctx.lineTo(last.x + 3, last.y + LANE_H / 2 + 3); ctx.stroke();
  }

  // Near miss text
  if (nmT > 0.3) {
    ctx.save(); ctx.globalAlpha = Math.min(1, (nmT - 0.3) * 3);
    ctx.fillStyle = '#ffdd44'; ctx.font = 'bold 24px "Noto Serif SC",serif'; ctx.textAlign = 'center';
    ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 10;
    ctx.fillText('险!', nmX, nmY - 30 - (0.6 - nmT) * 30);
    ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.restore();
  }
}

// ─── Render: Particles ──────────────────────────────────────────────────────
function drawPtcls() {
  for (const p of ptcls) {
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a; ctx.fillStyle = p.color;
    if (p.tag === 'ink') { ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, 6.28); ctx.fill(); }
    else if (p.tag === 'zap') { ctx.fillRect(p.x, p.y, p.sz, p.sz * 3); }
    else if (p.tag === 'wind') { ctx.fillRect(p.x, p.y, p.sz * 4, 1); }
    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, 6.28); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

// ─── Render: HUD ────────────────────────────────────────────────────────────
function drawHUD() {
  ctx.fillStyle = GOLD; ctx.font = 'bold 18px "Noto Serif SC",serif'; ctx.textAlign = 'center';
  ctx.fillText('' + score, W / 2, 32);
  ctx.font = '12px "Noto Serif SC",serif'; ctx.fillStyle = GOLD + 'aa';
  ctx.fillText(`第${steps}步`, W / 2, 50);

  ctx.textAlign = 'left'; ctx.fillStyle = GOLD; ctx.font = '14px "Noto Serif SC",serif';
  ctx.fillText(`灵石 ${stones}`, 60, 36);

  const rd = REALMS[curRealm];
  ctx.textAlign = 'right'; ctx.fillStyle = rd.accent; ctx.font = 'bold 14px "Noto Serif SC",serif';
  ctx.fillText(rd.name, W - 60, 36);

  if (combo > 2) {
    ctx.textAlign = 'center'; ctx.fillStyle = GOLD; ctx.font = 'bold 16px "Noto Serif SC",serif';
    ctx.fillText(`x${scoreMul.toFixed(1)} 连击`, W / 2, 70);
  }

  let iy = 90;
  ctx.textAlign = 'center'; ctx.font = '12px "Noto Serif SC",serif';
  if (pShield > 0) { ctx.fillStyle = '#55aaff'; ctx.fillText('护盾', W / 2, iy); iy += 16; }
  if (pFlying) { ctx.fillStyle = '#ffdd55'; ctx.fillText(`飞行 ${pFlyN}`, W / 2, iy); iy += 16; }
  if (pFreezeT > 0) { ctx.fillStyle = '#aaddff'; ctx.fillText(`时停 ${pFreezeT.toFixed(1)}s`, W / 2, iy); }

  // Pause btn
  ctx.fillStyle = GOLD + '88'; rr(BTN_P.x, BTN_P.y, BTN_P.w, BTN_P.h, 6); ctx.fill();
  ctx.fillStyle = INK;
  if (paused) {
    ctx.beginPath(); ctx.moveTo(BTN_P.x + 14, BTN_P.y + 10);
    ctx.lineTo(BTN_P.x + 28, BTN_P.y + 20); ctx.lineTo(BTN_P.x + 14, BTN_P.y + 30);
    ctx.closePath(); ctx.fill();
  } else {
    ctx.fillRect(BTN_P.x + 13, BTN_P.y + 10, 5, 20);
    ctx.fillRect(BTN_P.x + 22, BTN_P.y + 10, 5, 20);
  }

  // Mute btn
  ctx.fillStyle = GOLD + '88'; rr(BTN_M.x, BTN_M.y, BTN_M.w, BTN_M.h, 6); ctx.fill();
  ctx.fillStyle = INK; ctx.font = '16px serif'; ctx.textAlign = 'center';
  ctx.fillText(muted ? '🔇' : '🔊', BTN_M.x + BTN_M.w / 2, BTN_M.y + 27);

  // Foresight ability
  if (SKINS[skinIdx].ability === 'foresight') {
    for (let r = pRow + 1; r <= pRow + 5; r++) {
      const l = getLane(r);
      if (l && l.kind === LaneKind.Hazard && l.hazWarn && l.hazWarn > 0) {
        const sy = rowY(r);
        ctx.fillStyle = '#ff444466'; ctx.fillRect(0, sy, W, 2);
      }
    }
  }
}

// ─── Render: Overlays ───────────────────────────────────────────────────────
function drawRealmOverlay() {
  if (realmT <= 0) return;
  const p = realmT / 1.5;
  const rd = REALMS[realmTo];
  ctx.globalAlpha = p * 0.4; ctx.fillStyle = rd.accent; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  if (p > 0.3) {
    ctx.globalAlpha = Math.min(1, (p - 0.3) * 2);
    ctx.fillStyle = rd.accent; ctx.font = 'bold 36px "Noto Serif SC",serif'; ctx.textAlign = 'center';
    ctx.shadowColor = rd.accent; ctx.shadowBlur = 20;
    ctx.fillText(rd.name, W / 2, H / 2 - 10);
    ctx.font = '16px "Noto Serif SC",serif'; ctx.fillStyle = GOLD;
    ctx.fillText(`— ${rd.nameEn} Tribulation —`, W / 2, H / 2 + 20);
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }
}

function drawChaos() {
  if (curRealm !== Realm.Chaos) return;
  const i = Math.sin(chaosT * 2) * 0.03;
  if (Math.abs(i) > 0.01) {
    ctx.globalAlpha = Math.abs(i);
    ctx.fillStyle = i > 0 ? '#ff000022' : '#0000ff22';
    ctx.fillRect(i * 100, 0, W, H);
    ctx.globalAlpha = 1;
  }
}

// ─── Screens ────────────────────────────────────────────────────────────────
function drawTitle() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0a0a2a'); g.addColorStop(0.5, '#151535'); g.addColorStop(1, '#0a0a1e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  titleBob += 0.02;
  if (ptcls.length < 30)
    emit({ x: Math.random() * W, y: H + 10, vx: (Math.random() - 0.5) * 10, vy: -(10 + Math.random() * 20),
      max: 3 + Math.random() * 2, color: Math.random() < 0.5 ? GOLD + '88' : '#8855cc88',
      sz: 1.5 + Math.random() * 2, tag: 'ember' });
  tickPtcls(0.016); drawPtcls();

  const ty = 200 + Math.sin(titleBob) * 8;
  ctx.fillStyle = GOLD; ctx.font = 'bold 42px "Noto Serif SC",serif'; ctx.textAlign = 'center';
  ctx.shadowColor = GOLD; ctx.shadowBlur = 15;
  ctx.fillText('渡劫天梯', W / 2, ty); ctx.shadowBlur = 0;

  ctx.fillStyle = GOLD + 'cc'; ctx.font = '18px "Noto Serif SC",serif';
  ctx.fillText('Tribulation Climb', W / 2, ty + 35);
  ctx.font = '14px "Noto Serif SC",serif'; ctx.fillStyle = '#888';
  ctx.fillText('麦洛的冒险 第十章', W / 2, ty + 60);

  if (hiScore > 0) {
    ctx.fillStyle = GOLD + '88'; ctx.font = '14px "Noto Serif SC",serif';
    ctx.fillText(`最高分: ${hiScore}`, W / 2, ty + 90);
  }

  // Player preview
  const py = 430;
  ctx.save(); ctx.translate(W / 2, py);
  const sk = SKINS[skinIdx];
  const bob = Math.sin(titleBob * 2) * 4;
  ctx.translate(0, bob);
  ctx.fillStyle = sk.c1; rr(-12, -15, 24, 30, 6); ctx.fill();
  ctx.fillStyle = sk.c2; rr(-10, -13, 20, 12, 4); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(-4, -6, 2.5, 0, 6.28); ctx.fill();
  ctx.beginPath(); ctx.arc(4, -6, 2.5, 0, 6.28); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-3.5, -6.5, 1, 0, 6.28); ctx.fill();
  ctx.beginPath(); ctx.arc(4.5, -6.5, 1, 0, 6.28); ctx.fill();
  ctx.strokeStyle = sk.scarf; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-10, -2);
  ctx.quadraticCurveTo(-18 + Math.sin(titleBob * 3) * 4, 5, -15, 15 + Math.sin(titleBob * 2) * 3);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = GOLD + 'aa'; ctx.font = '13px "Noto Serif SC",serif';
  ctx.fillText(sk.name, W / 2, py + 40);

  const by = 510, bw = 200, bh = 46;
  drawBtn(W / 2 - bw / 2, by, bw, bh, '开始渡劫', GOLD, INK);
  drawBtn(W / 2 - bw / 2, by + 56, bw, bh, `每日挑战 (${dailyBest})`, '#8855cc', '#fff');
  drawBtn(W / 2 - bw / 2, by + 112, bw, 38, `灵石商店 (${totalStones}石)`, GOLD_DARK, '#fff');
  // Achievement count
  const achCount = ACHIEVEMENTS.filter(a => a.unlocked).length;
  drawBtn(W / 2 - bw / 2, by + 158, bw, 38, `红印成就 (${achCount}/${ACHIEVEMENTS.length})`, '#cc3333', '#ffdddd');

  if (passport) {
    ctx.fillStyle = GOLD + '66'; ctx.font = '12px "Noto Serif SC",serif';
    ctx.fillText(`旅者: ${passport.name}`, W / 2, H - 60);
  }
  ctx.fillStyle = '#666'; ctx.font = '12px "Noto Serif SC",serif';
  ctx.fillText('点击前进 · 左右滑动 · 下滑后退', W / 2, H - 30);

  // Mute
  ctx.fillStyle = GOLD + '88'; rr(BTN_M.x, BTN_M.y, BTN_M.w, BTN_M.h, 6); ctx.fill();
  ctx.fillStyle = INK; ctx.font = '16px serif'; ctx.textAlign = 'center';
  ctx.fillText(muted ? '🔇' : '🔊', BTN_M.x + BTN_M.w / 2, BTN_M.y + 27);
}

function drawNick() {
  ctx.fillStyle = '#0a0a2a'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = GOLD; ctx.font = 'bold 28px "Noto Serif SC",serif'; ctx.textAlign = 'center';
  ctx.fillText('选择称号', W / 2, 100);
  ctx.font = '14px "Noto Serif SC",serif'; ctx.fillStyle = GOLD + '88';
  ctx.fillText('为你的旅者选一个名号', W / 2, 130);

  const gc = 2, gw = 160, gh = 44, gg = 12;
  const sx = W / 2 - (gc * gw + (gc - 1) * gg) / 2, sy0 = 170;
  for (let i = 0; i < NICKNAMES.length; i++) {
    const c = i % gc, r = Math.floor(i / gc);
    const bx = sx + c * (gw + gg), by = sy0 + r * (gh + gg);
    ctx.fillStyle = GOLD + '33'; rr(bx, by, gw, gh, 6); ctx.fill();
    ctx.strokeStyle = GOLD + '66'; ctx.lineWidth = 1; rr(bx, by, gw, gh, 6); ctx.stroke();
    ctx.fillStyle = GOLD; ctx.font = '16px "Noto Serif SC",serif'; ctx.textAlign = 'center';
    ctx.fillText(NICKNAMES[i], bx + gw / 2, by + gh / 2 + 6);
  }
}

function drawShop() {
  ctx.fillStyle = '#0a0a2a'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = GOLD; ctx.font = 'bold 28px "Noto Serif SC",serif'; ctx.textAlign = 'center';
  ctx.fillText('灵石商店', W / 2, 80);
  ctx.font = '14px "Noto Serif SC",serif'; ctx.fillStyle = GOLD + 'aa';
  ctx.fillText(`灵石余额: ${totalStones}`, W / 2, 110);

  const cw = 160, ch = 90, cols = 2, gap = 12;
  const sx = W / 2 - (cols * cw + (cols - 1) * gap) / 2, sy0 = 140;
  for (let i = 0; i < SKINS.length; i++) {
    const sk = SKINS[i];
    const c = i % cols, r = Math.floor(i / cols);
    const cx = sx + c * (cw + gap), cy = sy0 + r * (ch + gap);
    ctx.fillStyle = skinIdx === i ? GOLD + '33' : '#1a1a3a';
    rr(cx, cy, cw, ch, 6); ctx.fill();
    if (skinIdx === i) { ctx.strokeStyle = GOLD; ctx.lineWidth = 2; rr(cx, cy, cw, ch, 6); ctx.stroke(); }
    ctx.fillStyle = sk.c1; ctx.beginPath(); ctx.arc(cx + 25, cy + 30, 12, 0, 6.28); ctx.fill();
    ctx.fillStyle = sk.c2; ctx.beginPath(); ctx.arc(cx + 25, cy + 26, 8, 0, 6.28); ctx.fill();
    ctx.strokeStyle = sk.scarf; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx + 15, cy + 32);
    ctx.quadraticCurveTo(cx + 10, cy + 40, cx + 12, cy + 48); ctx.stroke();
    ctx.fillStyle = sk.unlocked ? GOLD : '#666'; ctx.font = 'bold 13px "Noto Serif SC",serif'; ctx.textAlign = 'left';
    ctx.fillText(sk.name, cx + 45, cy + 25);
    ctx.fillStyle = sk.unlocked ? GOLD + 'aa' : '#555'; ctx.font = '10px "Noto Serif SC",serif';
    ctx.fillText(sk.abilityDesc, cx + 45, cy + 42);
    if (sk.unlocked) {
      ctx.fillStyle = skinIdx === i ? '#55cc55' : GOLD + '88';
      ctx.fillText(skinIdx === i ? '使用中' : '点击选择', cx + 45, cy + 58);
    } else {
      ctx.fillStyle = '#cc8833';
      ctx.fillText(`${sk.cost} 灵石`, cx + 45, cy + 58);
    }
  }
  drawBtn(W / 2 - 80, H - 80, 160, 44, '返回', GOLD_DARK, '#fff');
}

function drawOver() {
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#cc3333'; ctx.font = 'bold 36px "Noto Serif SC",serif'; ctx.textAlign = 'center';
  ctx.fillText('渡劫失败', W / 2, 200);
  ctx.fillStyle = GOLD; ctx.font = '18px "Noto Serif SC",serif';
  ctx.fillText(`得分: ${score}`, W / 2, 260);
  if (score >= hiScore && score > 0) {
    ctx.fillStyle = '#ffdd44'; ctx.font = 'bold 16px "Noto Serif SC",serif';
    ctx.fillText('新纪录!', W / 2, 290);
  }
  ctx.fillStyle = GOLD + 'aa'; ctx.font = '14px "Noto Serif SC",serif';
  ctx.fillText(`最高分: ${hiScore}`, W / 2, 320);
  ctx.fillText(`步数: ${steps}`, W / 2, 345);
  ctx.fillText(`灵石: +${stones}`, W / 2, 370);
  const rr2 = realmFor(maxRow);
  ctx.fillStyle = REALMS[rr2].accent;
  ctx.fillText(`最远: ${REALMS[rr2].name}`, W / 2, 395);
  drawBtn(W / 2 - 100, 440, 200, 46, '再次渡劫', GOLD, INK);
  drawBtn(W / 2 - 100, 498, 200, 46, '分享战绩', '#8855cc', '#fff');
  drawBtn(W / 2 - 100, 556, 200, 46, '返回主界面', GOLD_DARK, '#fff');
}

function drawPause() {
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = GOLD; ctx.font = 'bold 32px "Noto Serif SC",serif'; ctx.textAlign = 'center';
  ctx.fillText('暂停', W / 2, H / 2 - 60);
  ctx.font = '14px "Noto Serif SC",serif'; ctx.fillStyle = GOLD + '88';
  ctx.fillText(`得分: ${score} · 步数: ${steps}`, W / 2, H / 2 - 20);
  drawBtn(W / 2 - 100, H / 2 + 20, 200, 50, '继续', GOLD, INK);
  drawBtn(W / 2 - 100, H / 2 + 85, 200, 50, '返回主界面', GOLD_DARK, '#fff');
}

// ─── Main Render ────────────────────────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, W, H);

  if (scene === 'title') { drawTitle(); return; }
  if (scene === 'nick') { drawNick(); return; }
  if (scene === 'shop') { drawShop(); return; }
  if (scene === 'achievements') { drawAchievementScreen(); return; }
  if (scene === 'tutorial') { drawTutorial(); return; }
  if (scene === 'share') { drawShareCard(); return; }

  // Game world
  ctx.save();
  if (shakeT > 0) ctx.translate((Math.random() - 0.5) * shakeI * 2, (Math.random() - 0.5) * shakeI * 2);
  drawParallaxBg();

  const vb = Math.floor(camY) - 2, vt = Math.ceil(camY) + Math.ceil(H / LANE_H) + 2;
  for (const l of lanes) { if (l.y >= vb && l.y <= vt) drawLaneEnhanced(l); }
  drawEnhancedPlayer();
  drawEnhancedPtcls();
  drawChaos();

  if (flashT > 0) {
    ctx.globalAlpha = flashT * 3; ctx.fillStyle = flashC; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  }
  drawRealmOverlay();
  drawCeremony();
  ctx.restore();

  drawForegroundEffects();
  drawDangerIndicator();
  drawVignette();
  drawLaneGridHints();
  drawMiniMap();
  drawDailyInfo();
  drawHUD();
  drawAchNotify();
  drawScreenTrans();
  if (scene === 'pause') drawPause();
  if (scene === 'over') drawDetailedOver();
}

// ─── Input ──────────────────────────────────────────────────────────────────
let tSX = 0, tSY = 0, tST = 0, tOn = false;

function hit(x: number, y: number, r: { x: number; y: number; w: number; h: number }) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function coords(e: Touch | MouseEvent) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
}

function onDown(x: number, y: number) {
  tSX = x; tSY = y; tST = performance.now(); tOn = true;

  if (hit(x, y, BTN_M)) { initAudio(); setMuted(!muted); return; }

  if (scene === 'title') {
    initAudio();
    const by = 510, bw = 200, bh = 46, bx = W / 2 - bw / 2;
    if (x >= bx && x <= bx + bw) {
      if (y >= by && y <= by + bh) {
        isDaily = false;
        if (!tutorialShown) { tutorialShown = true; localStorage.setItem('crossy_tut', '1'); scene = 'tutorial'; return; }
        if (!passport) scene = 'nick'; else resetGame(); return;
      }
      if (y >= by + 56 && y <= by + 56 + bh) { isDaily = true; if (!passport) scene = 'nick'; else resetGame(); return; }
      if (y >= by + 112 && y <= by + 150) { scene = 'shop'; return; }
      if (y >= by + 158 && y <= by + 196) { scene = 'achievements'; return; }
    }
    return;
  }
  if (scene === 'tutorial') {
    // Next page button
    if (x >= W / 2 - 80 && x <= W / 2 + 80 && y >= H - 140 && y <= H - 96) {
      if (tutorialPage < TUTORIAL_PAGES.length - 1) { tutorialPage++; }
      else { tutorialPage = 0; if (!passport) scene = 'nick'; else resetGame(); }
      return;
    }
    // Previous page
    if (tutorialPage > 0 && x >= 30 && x <= 110 && y >= H - 140 && y <= H - 96) {
      tutorialPage--; return;
    }
    // Skip
    if (x >= W - 110 && x <= W - 30 && y >= H - 140 && y <= H - 96) {
      tutorialPage = 0; if (!passport) scene = 'nick'; else resetGame(); return;
    }
    return;
  }
  if (scene === 'achievements') {
    if (x >= W / 2 - 80 && x <= W / 2 + 80 && y >= H - 80 && y <= H - 36) { scene = 'title'; }
    return;
  }
  if (scene === 'share') {
    if (x >= W / 2 - 80 && x <= W / 2 + 80) {
      // Return button
      const btnY = H / 2 - 440 / 2 - 20 + 440 + 15;
      if (y >= btnY && y <= btnY + 44) { scene = 'over'; }
    }
    return;
  }
  if (scene === 'nick') {
    const gc = 2, gw = 160, gh = 44, gg = 12;
    const sx0 = W / 2 - (gc * gw + (gc - 1) * gg) / 2, sy0 = 170;
    for (let i = 0; i < NICKNAMES.length; i++) {
      const c = i % gc, r = Math.floor(i / gc);
      const bx = sx0 + c * (gw + gg), by = sy0 + r * (gh + gg);
      if (x >= bx && x <= bx + gw && y >= by && y <= by + gh) {
        passport = { name: NICKNAMES[i], avatar: '麦洛', gamesPlayed: 0,
          completedGames: [], currentStreak: 0, totalScore: 0,
          lastPlayed: new Date().toISOString().split('T')[0] };
        savePassport(); resetGame(); return;
      }
    }
    return;
  }
  if (scene === 'shop') {
    const cw = 160, ch = 90, cols = 2, gap = 12;
    const sx0 = W / 2 - (cols * cw + (cols - 1) * gap) / 2, sy0 = 140;
    for (let i = 0; i < SKINS.length; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      const cx = sx0 + c * (cw + gap), cy = sy0 + r * (ch + gap);
      if (x >= cx && x <= cx + cw && y >= cy && y <= cy + ch) {
        if (SKINS[i].unlocked) { skinIdx = i; saveData(); }
        else if (totalStones >= SKINS[i].cost) {
          totalStones -= SKINS[i].cost; SKINS[i].unlocked = true;
          skinIdx = i; saveData(); sfx('collect');
        }
        return;
      }
    }
    if (x >= W / 2 - 80 && x <= W / 2 + 80 && y >= H - 80 && y <= H - 36) { scene = 'title'; }
    return;
  }
  if (scene === 'over') {
    const bx = W / 2 - 100;
    if (x >= bx && x <= bx + 200 && y >= 440 && y <= 486) { resetGame(); return; }
    if (x >= bx && x <= bx + 200 && y >= 498 && y <= 544) { scene = 'share'; return; }
    if (x >= bx && x <= bx + 200 && y >= 556 && y <= 602) { scene = 'title'; return; }
    return;
  }
  if (scene === 'pause') {
    const bx = W / 2 - 100;
    if (x >= bx && x <= bx + 200 && y >= H / 2 + 20 && y <= H / 2 + 70) { paused = false; scene = 'play'; return; }
    if (x >= bx && x <= bx + 200 && y >= H / 2 + 85 && y <= H / 2 + 135) { paused = false; stopBGM(); scene = 'title'; return; }
    return;
  }
  if (scene === 'play' && hit(x, y, BTN_P)) { paused = true; scene = 'pause'; return; }
}

function onUp(x: number, y: number) {
  if (!tOn) return; tOn = false;
  if (scene !== 'play') return;
  const dx = x - tSX, dy = y - tSY;
  const el = performance.now() - tST;
  const dist = Math.sqrt(dx * dx + dy * dy);
  initAudio();
  if (dist < 20 || el < 150) { hop(1, 0); }
  else if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 30) hop(0, 1); else if (dx < -30) hop(0, -1);
  } else {
    if (dy > 30) hop(-1, 0); else if (dy < -30) hop(1, 0);
  }
}

canvas.addEventListener('touchstart', e => { e.preventDefault(); const c = coords(e.touches[0]); onDown(c.x, c.y); }, { passive: false });
canvas.addEventListener('touchend', e => { e.preventDefault(); if (e.changedTouches.length > 0) { const c = coords(e.changedTouches[0]); onUp(c.x, c.y); } }, { passive: false });
canvas.addEventListener('mousedown', e => { const c = coords(e); onDown(c.x, c.y); });
canvas.addEventListener('mouseup', e => { const c = coords(e); onUp(c.x, c.y); });

document.addEventListener('keydown', e => {
  if (scene === 'play' && !paused) {
    initAudio();
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') hop(1, 0);
    else if (e.key === 'ArrowDown' || e.key === 's') hop(-1, 0);
    else if (e.key === 'ArrowLeft' || e.key === 'a') hop(0, -1);
    else if (e.key === 'ArrowRight' || e.key === 'd') hop(0, 1);
    else if (e.key === 'Escape' || e.key === 'p') { paused = true; scene = 'pause'; }
  } else if (scene === 'pause') {
    if (e.key === 'Escape' || e.key === 'p') { paused = false; scene = 'play'; }
  } else if (scene === 'title') {
    if (e.key === 'Enter' || e.key === ' ') { initAudio(); isDaily = false; if (!passport) scene = 'nick'; else resetGame(); }
  } else if (scene === 'over') {
    if (e.key === 'Enter' || e.key === ' ') resetGame();
    else if (e.key === 'Escape') scene = 'title';
  } else if (scene === 'achievements' || scene === 'share') {
    if (e.key === 'Escape' || e.key === 'Enter') scene = scene === 'share' ? 'over' : 'title';
  } else if (scene === 'tutorial') {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
      if (tutorialPage < TUTORIAL_PAGES.length - 1) tutorialPage++;
      else { tutorialPage = 0; if (!passport) scene = 'nick'; else resetGame(); }
    } else if (e.key === 'ArrowLeft' && tutorialPage > 0) {
      tutorialPage--;
    } else if (e.key === 'Escape') {
      tutorialPage = 0; if (!passport) scene = 'nick'; else resetGame();
    }
  }
});

// ─── Session Statistics ─────────────────────────────────────────────────────
interface SessionStats {
  nearMisses: number;
  maxCombo: number;
  itemsCollected: number;
  realmsVisited: Set<Realm>;
  timeAlive: number;
  bossesDefeated: number;
  ceremonyPassed: number;
}

let sessionStats: SessionStats = {
  nearMisses: 0, maxCombo: 0, itemsCollected: 0,
  realmsVisited: new Set([Realm.Wind]), timeAlive: 0,
  bossesDefeated: 0, ceremonyPassed: 0,
};

function resetSessionStats() {
  sessionStats = {
    nearMisses: 0, maxCombo: 0, itemsCollected: 0,
    realmsVisited: new Set([Realm.Wind]), timeAlive: 0,
    bossesDefeated: 0, ceremonyPassed: 0,
  };
}

// ─── Weather Effects ────────────────────────────────────────────────────────
interface WeatherDrop {
  x: number; y: number; vx: number; vy: number; len: number; alpha: number;
}

let weatherDrops: WeatherDrop[] = [];
const MAX_WEATHER = 60;

function tickWeather(dt: number) {
  // Add new drops based on realm
  const spawnRate = curRealm === Realm.Ice ? 3 : curRealm === Realm.Wind ? 2 : curRealm === Realm.Fire ? 1 : 0;
  for (let i = 0; i < spawnRate; i++) {
    if (weatherDrops.length >= MAX_WEATHER) break;
    const drop: WeatherDrop = {
      x: Math.random() * W,
      y: -10,
      vx: curRealm === Realm.Wind ? (30 + Math.random() * 40) * (Math.random() < 0.5 ? -1 : 1) : (Math.random() - 0.5) * 10,
      vy: curRealm === Realm.Ice ? 60 + Math.random() * 40 : curRealm === Realm.Fire ? -40 - Math.random() * 30 : 80 + Math.random() * 40,
      len: curRealm === Realm.Ice ? 3 + Math.random() * 4 : 6 + Math.random() * 8,
      alpha: 0.2 + Math.random() * 0.3,
    };
    if (curRealm === Realm.Fire) drop.y = H + 10;
    weatherDrops.push(drop);
  }

  // Update drops
  for (let i = weatherDrops.length - 1; i >= 0; i--) {
    const d = weatherDrops[i];
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    if (d.y > H + 20 || d.y < -20 || d.x < -20 || d.x > W + 20) {
      weatherDrops.splice(i, 1);
    }
  }
}

function drawWeather() {
  if (curRealm === Realm.Thunder || curRealm === Realm.Chaos) return;
  const rd = REALMS[curRealm];

  for (const d of weatherDrops) {
    ctx.globalAlpha = d.alpha;
    if (curRealm === Realm.Ice) {
      // Snowflakes
      ctx.fillStyle = '#ccddff';
      ctx.beginPath(); ctx.arc(d.x, d.y, d.len * 0.4, 0, 6.28); ctx.fill();
    } else if (curRealm === Realm.Fire) {
      // Rising embers
      ctx.fillStyle = Math.random() < 0.5 ? '#ff6622' : '#ffaa44';
      ctx.beginPath(); ctx.arc(d.x, d.y, d.len * 0.3, 0, 6.28); ctx.fill();
    } else if (curRealm === Realm.Wind) {
      // Horizontal wind streaks
      ctx.strokeStyle = rd.accent2;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + d.vx * 0.1, d.y + d.vy * 0.02);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

// ─── Realm-Specific Ground Decorations ──────────────────────────────────────
function drawRealmGroundFX(realm: Realm, sy: number, row: number) {
  const rd = REALMS[realm];
  switch (realm) {
    case Realm.Wind: {
      // Dust swirls on ground
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = rd.accent;
      const swirl = Math.sin(frame * 0.02 + row * 2.3) * 20;
      ctx.beginPath(); ctx.ellipse(W / 2 + swirl, sy + LANE_H - 5, 40, 6, 0, 0, 6.28); ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case Realm.Thunder: {
      // Electric ground crackle
      if (Math.random() < 0.02) {
        ctx.strokeStyle = '#ffffff33'; ctx.lineWidth = 1;
        const sx = Math.random() * W;
        ctx.beginPath(); ctx.moveTo(sx, sy + LANE_H);
        ctx.lineTo(sx + (Math.random() - 0.5) * 20, sy + LANE_H - 5);
        ctx.lineTo(sx + (Math.random() - 0.5) * 10, sy + LANE_H - 2);
        ctx.stroke();
      }
      break;
    }
    case Realm.Fire: {
      // Heat shimmer
      ctx.globalAlpha = 0.04;
      ctx.fillStyle = '#ff4400';
      const shimmer = Math.sin(frame * 0.05 + row * 1.7) * 3;
      ctx.fillRect(0, sy + shimmer, W, 2);
      ctx.globalAlpha = 1;
      break;
    }
    case Realm.Ice: {
      // Frost crystals on ground edges
      ctx.strokeStyle = '#aaddff22'; ctx.lineWidth = 0.5;
      for (let i = 0; i < 3; i++) {
        const fx = (row * 83 + i * 131) % W;
        for (let j = 0; j < 4; j++) {
          const a = (j / 4) * 6.28 + row * 0.5;
          ctx.beginPath();
          ctx.moveTo(fx, sy + LANE_H - 2);
          ctx.lineTo(fx + Math.cos(a) * 5, sy + LANE_H - 2 + Math.sin(a) * 3);
          ctx.stroke();
        }
      }
      break;
    }
    case Realm.Chaos: {
      // Distortion lines
      if (frame % 10 < 3) {
        ctx.globalAlpha = 0.05;
        ctx.fillStyle = `hsl(${(frame * 5 + row * 20) % 360},80%,60%)`;
        ctx.fillRect(0, sy + (frame * 3 % LANE_H), W, 2);
        ctx.globalAlpha = 1;
      }
      break;
    }
  }
}

// ─── Score Popup System ─────────────────────────────────────────────────────
interface ScorePopup {
  x: number; y: number; text: string; color: string;
  life: number; max: number;
}

let scorePopups: ScorePopup[] = [];

function addScorePopup(x: number, y: number, text: string, color: string) {
  scorePopups.push({ x, y, text, color, life: 1.2, max: 1.2 });
}

function tickScorePopups(dt: number) {
  for (let i = scorePopups.length - 1; i >= 0; i--) {
    scorePopups[i].life -= dt;
    scorePopups[i].y -= 30 * dt;
    if (scorePopups[i].life <= 0) scorePopups.splice(i, 1);
  }
}

function drawScorePopups() {
  for (const p of scorePopups) {
    const alpha = Math.min(1, p.life / 0.3, p.life > 0.9 ? (p.max - (p.max - p.life)) / 0.3 : 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.font = 'bold 14px "Noto Serif SC",serif'; ctx.textAlign = 'center';
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}

// ─── Distance Markers ───────────────────────────────────────────────────────
function drawDistanceMarkers() {
  for (const l of lanes) {
    if (l.y % 25 !== 0 || l.y === 0) continue;
    const sy = rowY(l.y);
    if (sy < -20 || sy > H + 20) continue;
    ctx.fillStyle = GOLD + '33'; ctx.font = '10px "Noto Serif SC",serif'; ctx.textAlign = 'right';
    ctx.fillText(`${l.y}`, W - 5, sy + LANE_H / 2 + 3);
  }
}

// ─── Enhanced Game Over Stats ───────────────────────────────────────────────
function drawDetailedOver() {
  ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, 0, W, H);

  // Title with ink wash effect
  ctx.fillStyle = '#cc3333'; ctx.font = 'bold 36px "Noto Serif SC",serif'; ctx.textAlign = 'center';
  ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 10;
  ctx.fillText('渡劫失败', W / 2, 160);
  ctx.shadowBlur = 0;

  // Score
  ctx.fillStyle = GOLD; ctx.font = 'bold 42px "Noto Serif SC",serif';
  ctx.fillText('' + score, W / 2, 215);
  if (score >= hiScore && score > 0) {
    ctx.fillStyle = '#ffdd44'; ctx.font = 'bold 14px "Noto Serif SC",serif';
    ctx.fillText('新纪录!', W / 2, 240);
  }

  // Stats grid
  ctx.fillStyle = GOLD + 'aa'; ctx.font = '13px "Noto Serif SC",serif';
  const stats2 = [
    { label: '最高分', val: '' + hiScore },
    { label: '步数', val: '' + steps },
    { label: '灵石', val: `+${stones}` },
    { label: '险避', val: '' + sessionStats.nearMisses },
    { label: '最高连击', val: '' + sessionStats.maxCombo },
    { label: '存活时间', val: `${sessionStats.timeAlive.toFixed(1)}s` },
  ];
  for (let i = 0; i < stats2.length; i++) {
    const sx = W / 2 - 120 + (i % 3) * 80, sy = 270 + Math.floor(i / 3) * 45;
    ctx.fillStyle = GOLD + '88'; ctx.textAlign = 'center';
    ctx.fillText(stats2[i].val, sx + 40, sy);
    ctx.fillStyle = GOLD + '55'; ctx.font = '10px "Noto Serif SC",serif';
    ctx.fillText(stats2[i].label, sx + 40, sy + 16);
    ctx.font = '13px "Noto Serif SC",serif';
  }

  // Realm reached
  const rr2 = realmFor(maxRow);
  ctx.fillStyle = REALMS[rr2].accent;
  ctx.font = 'bold 16px "Noto Serif SC",serif'; ctx.textAlign = 'center';
  ctx.fillText(`最远: ${REALMS[rr2].name} (第${maxRow}道)`, W / 2, 380);

  // Realms visited indicator
  const visitedArr = Array.from(sessionStats.realmsVisited);
  for (let i = 0; i < visitedArr.length; i++) {
    const rx = W / 2 - (visitedArr.length - 1) * 20 + i * 40;
    ctx.fillStyle = REALMS[visitedArr[i]].accent;
    ctx.beginPath(); ctx.arc(rx, 408, 10, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '9px "Noto Serif SC",serif';
    ctx.fillText(REALMS[visitedArr[i]].name.charAt(0), rx, 412);
  }

  drawBtn(W / 2 - 100, 440, 200, 46, '再次渡劫', GOLD, INK);
  drawBtn(W / 2 - 100, 498, 200, 46, '分享战绩', '#8855cc', '#fff');
  drawBtn(W / 2 - 100, 556, 200, 46, '返回主界面', GOLD_DARK, '#fff');
}

// ─── Power-up Visual Effects ────────────────────────────────────────────────
function drawPowerupEffects() {
  // Shield shimmer
  if (pShield > 0 && !pDead) {
    ctx.globalAlpha = 0.03 + Math.sin(frame * 0.08) * 0.02;
    ctx.fillStyle = '#55aaff';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  // Flying trail
  if (pFlying && !pDead) {
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#ffdd55';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    // Wing particles
    if (frame % 3 === 0) {
      for (let i = 0; i < 2; i++) {
        emit({
          x: pX + (Math.random() - 0.5) * 30,
          y: pY + LANE_H / 2 + 5,
          vx: (Math.random() - 0.5) * 20,
          vy: 20 + Math.random() * 20,
          max: 0.5 + Math.random() * 0.3,
          color: '#ffdd5555',
          sz: 2 + Math.random() * 2,
          tag: 'fly_trail'
        });
      }
    }
  }

  // Freeze effect
  if (pFreezeT > 0) {
    ctx.globalAlpha = 0.05; ctx.fillStyle = '#88ddff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    // Freeze border vignette
    ctx.strokeStyle = '#88ddff22'; ctx.lineWidth = 4;
    rr(2, 2, W - 4, H - 4, 0); ctx.stroke();
  }
}

// ─── Calligraphy Text Effects ───────────────────────────────────────────────
interface CalliText {
  text: string; x: number; y: number;
  life: number; max: number;
  color: string; size: number;
  style: 'fade' | 'grow' | 'slide';
}

let calliTexts: CalliText[] = [];

function addCalliText(text: string, x: number, y: number, color: string, size: number, style: CalliText['style'] = 'fade') {
  calliTexts.push({ text, x, y, life: 2.0, max: 2.0, color, size, style });
}

function tickCalliTexts(dt: number) {
  for (let i = calliTexts.length - 1; i >= 0; i--) {
    calliTexts[i].life -= dt;
    if (calliTexts[i].style === 'slide') calliTexts[i].y -= 20 * dt;
    if (calliTexts[i].life <= 0) calliTexts.splice(i, 1);
  }
}

function drawCalliTexts() {
  for (const ct of calliTexts) {
    const p = ct.life / ct.max;
    let alpha = 1;
    if (p > 0.8) alpha = (1 - p) / 0.2;
    else if (p < 0.3) alpha = p / 0.3;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = ct.color;
    const scale = ct.style === 'grow' ? 0.5 + p * 0.5 : 1;
    ctx.font = `bold ${ct.size * scale}px "Noto Serif SC",serif`;
    ctx.textAlign = 'center';
    if (ct.style !== 'grow') {
      ctx.shadowColor = ct.color; ctx.shadowBlur = 8;
    }
    ctx.fillText(ct.text, ct.x, ct.y);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
}

// ─── Lane Row Number Indicator ──────────────────────────────────────────────
function drawRowIndicator() {
  if (scene !== 'play') return;
  // Show current row
  ctx.fillStyle = GOLD + '44'; ctx.font = '10px "Noto Serif SC",serif'; ctx.textAlign = 'left';
  ctx.fillText(`道 ${pRow}`, 5, H - 10);
}

// ─── Ambient Sound Layer ────────────────────────────────────────────────────
let ambientNodes: { o: OscillatorNode; g: GainNode }[] = [];
let lastAmbientRealm = -1;

function updateAmbient(realm: Realm) {
  if (!ac || !mGain) return;
  if (realm === lastAmbientRealm) return;
  lastAmbientRealm = realm;

  // Clean up old
  for (const n of ambientNodes) {
    try { n.g.gain.setValueAtTime(n.g.gain.value, ac.currentTime);
      n.g.gain.linearRampToValueAtTime(0, ac.currentTime + 0.5);
      n.o.stop(ac.currentTime + 0.6); } catch { /* */ }
  }
  ambientNodes = [];

  const t = ac.currentTime;
  // Realm-specific ambient
  switch (realm) {
    case Realm.Wind: {
      // Whistling wind
      const g = ac.createGain(); g.gain.value = 0.015; g.connect(mGain);
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = 2000;
      o.connect(g); o.start(t);
      // Modulate for wind sound
      for (let i = 0; i < 30; i++) {
        o.frequency.setValueAtTime(1800 + Math.sin(i * 0.7) * 400, t + i * 1.5);
        o.frequency.linearRampToValueAtTime(2200 + Math.cos(i * 0.5) * 300, t + i * 1.5 + 0.75);
      }
      ambientNodes.push({ o, g });
      break;
    }
    case Realm.Ice: {
      // Crystalline hum
      const g = ac.createGain(); g.gain.value = 0.008; g.connect(mGain);
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = 3000;
      o.connect(g); o.start(t);
      ambientNodes.push({ o, g });
      break;
    }
    default: break;
  }
}

// ─── Trail Effect ───────────────────────────────────────────────────────────
interface TrailPoint {
  x: number; y: number; alpha: number;
}

let trail: TrailPoint[] = [];
const MAX_TRAIL = 12;

function tickTrail() {
  if (pDead || pHop) return;
  trail.unshift({ x: pX, y: pY + LANE_H / 2, alpha: 0.3 });
  if (trail.length > MAX_TRAIL) trail.pop();
  for (const t of trail) t.alpha -= 0.025;
  trail = trail.filter(t => t.alpha > 0);
}

function drawTrail() {
  if (pFlying) {
    for (const t of trail) {
      ctx.globalAlpha = t.alpha * 0.5;
      ctx.fillStyle = '#ffdd55';
      ctx.beginPath(); ctx.arc(t.x, t.y, 4, 0, 6.28); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// ─── Extended Rendering Pipeline ────────────────────────────────────────────
// These are called from the main render to add layers of polish

function drawForegroundEffects() {
  drawWeather();
  drawPowerupEffects();
  drawScorePopups();
  drawCalliTexts();
  drawTrail();
  drawRowIndicator();
  drawDistanceMarkers();
}

// ─── Vignette Effect ────────────────────────────────────────────────────────
function drawVignette() {
  const grd = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.8);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);
}

// ─── Mini Map ───────────────────────────────────────────────────────────────
function drawMiniMap() {
  if (scene !== 'play') return;
  const mmW = 30, mmH = 100;
  const mmX = W - mmW - 5, mmY = 60;

  ctx.fillStyle = '#00000044';
  rr(mmX, mmY, mmW, mmH, 4); ctx.fill();

  // Current position indicator
  const progress = Math.min(1, pRow / 200);
  const dotY = mmY + mmH - progress * mmH;
  ctx.fillStyle = GOLD;
  ctx.beginPath(); ctx.arc(mmX + mmW / 2, dotY, 3, 0, 6.28); ctx.fill();

  // Realm boundaries
  for (let i = 1; i <= 4; i++) {
    const bndY = mmY + mmH - (i * 100 / 200) * mmH;
    if (bndY > mmY && bndY < mmY + mmH) {
      ctx.strokeStyle = REALMS[i % 5].accent + '66'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(mmX + 2, bndY); ctx.lineTo(mmX + mmW - 2, bndY); ctx.stroke();
    }
  }

  // Realm labels
  ctx.fillStyle = GOLD + '44'; ctx.font = '7px "Noto Serif SC",serif'; ctx.textAlign = 'center';
  ctx.fillText('道', mmX + mmW / 2, mmY - 3);
}

// ─── Daily Challenge Info ───────────────────────────────────────────────────
function drawDailyInfo() {
  if (!isDaily || scene !== 'play') return;
  ctx.fillStyle = '#8855cc88'; ctx.font = '11px "Noto Serif SC",serif'; ctx.textAlign = 'center';
  ctx.fillText('每日挑战', W / 2, H - 20);
  ctx.fillStyle = '#8855cc55'; ctx.font = '10px "Noto Serif SC",serif';
  ctx.fillText(`今日最佳: ${dailyBest}`, W / 2, H - 6);
}

// ─── Enhanced Particle Drawing ──────────────────────────────────────────────
function drawEnhancedPtcls() {
  for (const p of ptcls) {
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;

    switch (p.tag) {
      case 'ink': {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, 6.28); ctx.fill();
        // Ink splash detail
        if (p.sz > 4) {
          ctx.globalAlpha = a * 0.5;
          ctx.beginPath(); ctx.arc(p.x + p.sz * 0.3, p.y - p.sz * 0.2, p.sz * 0.4, 0, 6.28); ctx.fill();
        }
        break;
      }
      case 'zap': {
        ctx.fillRect(p.x, p.y, p.sz, p.sz * 3);
        // Glow
        ctx.globalAlpha = a * 0.3;
        ctx.fillRect(p.x - 1, p.y - 1, p.sz + 2, p.sz * 3 + 2);
        break;
      }
      case 'wind': {
        ctx.fillRect(p.x, p.y, p.sz * 4, 1);
        ctx.globalAlpha = a * 0.5;
        ctx.fillRect(p.x + 2, p.y + 2, p.sz * 3, 1);
        break;
      }
      case 'ceremony': {
        // Golden sparkle with cross shape
        ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, 6.28); ctx.fill();
        ctx.globalAlpha = a * 0.6;
        ctx.fillRect(p.x - p.sz * 1.5, p.y - 0.5, p.sz * 3, 1);
        ctx.fillRect(p.x - 0.5, p.y - p.sz * 1.5, 1, p.sz * 3);
        break;
      }
      case 'quick_hop': {
        // Streak shape
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - p.sz);
        ctx.lineTo(p.x + p.sz * 0.5, p.y);
        ctx.lineTo(p.x, p.y + p.sz);
        ctx.lineTo(p.x - p.sz * 0.5, p.y);
        ctx.closePath(); ctx.fill();
        break;
      }
      default: {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, 6.28); ctx.fill();
        break;
      }
    }
  }
  ctx.globalAlpha = 1;
}

// ─── Screen Transition Effect ───────────────────────────────────────────────
let screenTransT = 0;
let screenTransFrom: Scene = 'title';
let screenTransTo: Scene = 'title';

function triggerScreenTrans(from: Scene, to: Scene) {
  screenTransFrom = from;
  screenTransTo = to;
  screenTransT = 0.5;
}

function drawScreenTrans() {
  if (screenTransT <= 0) return;
  const p = screenTransT / 0.5;
  ctx.globalAlpha = p < 0.5 ? p * 2 : (1 - p) * 2;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}

// ─── Danger Indicator ───────────────────────────────────────────────────────
function drawDangerIndicator() {
  if (scene !== 'play' || pDead) return;

  // Edge danger glow when near screen bottom
  const screenBottom = pY + LANE_H;
  if (screenBottom > H * 0.8) {
    const danger = (screenBottom - H * 0.8) / (H * 0.2);
    ctx.globalAlpha = danger * 0.15;
    const grd = ctx.createLinearGradient(0, H - 60, 0, H);
    grd.addColorStop(0, 'rgba(255,0,0,0)');
    grd.addColorStop(1, 'rgba(255,0,0,1)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, H - 60, W, 60);
    ctx.globalAlpha = 1;
  }

  // Side danger when near edge
  if (pX < 40 || pX > W - 40) {
    const side = pX < 40 ? 'left' : 'right';
    const edgeDist = side === 'left' ? pX : W - pX;
    const danger = 1 - edgeDist / 40;
    ctx.globalAlpha = danger * 0.1;
    if (side === 'left') {
      const grd = ctx.createLinearGradient(0, 0, 40, 0);
      grd.addColorStop(0, 'rgba(255,100,0,1)');
      grd.addColorStop(1, 'rgba(255,100,0,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, 40, H);
    } else {
      const grd = ctx.createLinearGradient(W - 40, 0, W, 0);
      grd.addColorStop(0, 'rgba(255,100,0,0)');
      grd.addColorStop(1, 'rgba(255,100,0,1)');
      ctx.fillStyle = grd;
      ctx.fillRect(W - 40, 0, 40, H);
    }
    ctx.globalAlpha = 1;
  }
}

// ─── Grid Overlay (Debug-style polish) ──────────────────────────────────────
function drawLaneGridHints() {
  if (scene !== 'play') return;
  // Subtle column indicators at bottom
  ctx.strokeStyle = GOLD + '08'; ctx.lineWidth = 1;
  for (let i = 1; i < COLS; i++) {
    const gx = i * CELL_W;
    ctx.beginPath(); ctx.moveTo(gx, H - 40); ctx.lineTo(gx, H); ctx.stroke();
  }
}

// ─── Game Loop ──────────────────────────────────────────────────────────────
function loop(ts: number) {
  const fdt = lastT === 0 ? 0.016 : Math.min((ts - lastT) / 1000, 0.05);
  lastT = ts; frame++;
  update(fdt);
  render();
  requestAnimationFrame(loop);
}

// ─── Init ───────────────────────────────────────────────────────────────────
loadPassport();
loadData();
requestAnimationFrame(loop);
