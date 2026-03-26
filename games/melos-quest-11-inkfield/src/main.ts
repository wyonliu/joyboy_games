// ============================================================================
// 墨渊求生 Inkfield — Phaser 3 · VS-style Survivors
// 麦洛的冒险 11 · Auto-attack · Swarm · Ink-wash weapons
// ============================================================================
import Phaser from 'phaser';

const W = 960, H = 640, MW = 4800, MH = 4800;
const F = '"Noto Serif SC", serif';

// ── Upgrades ──
interface Up { name: string; desc: string; fn: (g: GameScene) => void }
const UPS: Up[] = [
  { name: '墨弹·裂', desc: '射速+35%', fn: g => { g.uFireRate *= 0.65; } },
  { name: '墨弹·穿', desc: '穿透+1', fn: g => { g.uPierce++; } },
  { name: '墨弹·散', desc: '弹幕+2', fn: g => { g.uBullets += 2; } },
  { name: '铁壁', desc: '减伤40%', fn: g => { g.uDmgTaken *= 0.6; } },
  { name: '贪婪', desc: '拾取范围×2', fn: g => { g.uPickup *= 2; } },
  { name: '墨·重击', desc: '伤害+60%', fn: g => { g.uDmg *= 1.6; } },
  { name: '灵压抑制', desc: '灵机增速-40%', fn: g => { g.uLjRate *= 0.6; } },
  { name: '疾步', desc: '移速+30%', fn: g => { g.uSpd *= 1.3; } },
  { name: '再生', desc: '每秒回血5', fn: g => { g.uRegen += 5; } },
  { name: '连锁墨爆', desc: '击杀范围爆炸', fn: g => { g.uChain = true; } },
  { name: '吸灵', desc: '击杀回血10', fn: g => { g.uKillHeal += 10; } },
  { name: '墨雨', desc: '每2.5秒天降墨弹', fn: g => { g.uInkRain = true; } },
  { name: '墨·环绕', desc: '4枚环绕墨球', fn: g => { g.uOrbitals += 4; } },
  { name: '墨鞭', desc: '每3秒横扫鞭击', fn: g => { g.uWhip = true; } },
  { name: '巨墨', desc: '弹体+80%', fn: g => { g.uBulletScale *= 1.8; } },
  { name: '磁场', desc: '拾取范围+100', fn: g => { g.uPickup += 2; } },
];

// ── Audio ──
let ac: AudioContext | null = null, masterG: GainNode;
function initAudio() { if (ac) return; ac = new AudioContext(); masterG = ac.createGain(); masterG.gain.value = 0.3; masterG.connect(ac.destination); }
function _t(f: number, d: number, tp: OscillatorType = 'sine', v = 0.2, dl = 0) {
  if (!ac) return; const t = ac.currentTime + dl, o = ac.createOscillator(), g = ac.createGain();
  o.type = tp; o.frequency.value = f; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(g); g.connect(masterG); o.start(t); o.stop(t + d);
}
function _n(d: number, v = 0.08, fq = 2000) {
  if (!ac) return; const n = Math.floor(ac.sampleRate * d), b = ac.createBuffer(1, n, ac.sampleRate);
  const dt = b.getChannelData(0); for (let i = 0; i < n; i++) dt[i] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(); s.buffer = b; const g = ac.createGain(), fl = ac.createBiquadFilter();
  fl.type = 'lowpass'; fl.frequency.value = fq;
  g.gain.setValueAtTime(v, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + d);
  s.connect(fl); fl.connect(g); g.connect(masterG); s.start();
}
function _gz(f: number, v = 0.1) { [1, 2, 3, 5].forEach((h, i) => _t(f * h, i === 0 ? 1 : 0.4, i === 0 ? 'triangle' : 'sine', v / (h * 1.5))); }
const sfx = {
  shoot: () => { _n(0.04, 0.06, 3000); _t(200, 0.03, 'square', 0.05); },
  hit: () => { _t(140, 0.06, 'square', 0.08); _n(0.03, 0.05, 4000); },
  kill: () => { _gz(600, 0.1); _n(0.06, 0.03, 1000); },
  eliteKill: () => { _gz(400, 0.12); setTimeout(() => _gz(600, 0.08), 80); setTimeout(() => _gz(800, 0.06), 160); },
  whip: () => { _n(0.08, 0.1, 1500); _t(300, 0.05, 'sawtooth', 0.08); },
  dodge: () => { _n(0.04, 0.05, 6000); },
  levelUp: () => { _gz(523, 0.15); setTimeout(() => _gz(659, 0.12), 100); setTimeout(() => _gz(784, 0.1), 200); },
  bc: () => { _t(660, 0.03, 'sine', 0.08); _t(880, 0.03, 'sine', 0.05, 0.03); },
  death: () => { for (let i = 0; i < 5; i++) setTimeout(() => _t(400 - i * 40, 0.12, 'sine', 0.1), i * 250); },
  punchOut: () => { _t(800, 0.05, 'sine', 0.15); _gz(523, 0.12); },
};

// ── Boot ──
class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    const bar = this.add.graphics();
    this.load.on('progress', (v: number) => {
      bar.clear(); bar.fillStyle(0x0f0f0f); bar.fillRect(0, 0, W, H);
      bar.fillStyle(0x3a3a3a); bar.fillRect(W / 2 - 150, H / 2 + 20, 300 * v, 6);
    });
    this.add.text(W / 2, H / 2 - 10, '墨渊求生', { fontFamily: F, fontSize: '24px', color: '#aaa' }).setOrigin(0.5);

    this.load.image('ground', 'assets/bg/ground_02.jpg');
    this.load.image('sky', 'assets/bg/sky_mountains.jpg');
    this.load.image('taotie', 'assets/chars/taotie.png');
    this.load.image('taotie_side', 'assets/chars/taotie_side.png');
    this.load.image('qiongqi', 'assets/chars/qiongqi.png');
    this.load.image('baize', 'assets/chars/baize.png');
    this.load.image('hundun', 'assets/chars/hundun.png');
    this.load.image('e_soldier', 'assets/enemies/logic_soldier.png');
    this.load.image('e_hunter', 'assets/enemies/algo_hunter.png');
    this.load.image('e_enforcer', 'assets/enemies/protocol_enforcer.png');
    this.load.image('e_drone', 'assets/enemies/harvester_drone.png');

    // Generate procedural textures
    const mk = (key: string, cb: (g: Phaser.GameObjects.Graphics) => void, w: number, h: number) => {
      const g = this.make.graphics({}); cb(g); g.generateTexture(key, w, h); g.destroy();
    };
    // Ink bullet — elongated brush stroke shape
    mk('bullet', g => {
      g.fillStyle(0x1a1a28); g.fillEllipse(16, 5, 28, 8);
      g.fillStyle(0x0a0a18, 0.6); g.fillEllipse(14, 5, 20, 10);
      g.fillStyle(0xffffff, 0.3); g.fillCircle(22, 4, 2);
    }, 32, 10);
    // Big ink splash particle
    mk('ink', g => {
      g.fillStyle(0x1a1a2e); g.fillCircle(10, 10, 10);
      g.fillStyle(0x0f0f20, 0.5); g.fillEllipse(10, 14, 14, 6);
    }, 20, 20);
    // Gold spark
    mk('spark', g => {
      g.fillStyle(0xffd700); g.fillCircle(6, 6, 6);
      g.fillStyle(0xffffaa, 0.5); g.fillCircle(6, 5, 3);
    }, 12, 12);
    // Gem (jade green, glowing)
    mk('gem', g => {
      g.fillStyle(0x22cc88); g.fillCircle(8, 8, 8);
      g.fillStyle(0x88ffcc, 0.6); g.fillCircle(7, 6, 4);
      g.fillStyle(0xffffff, 0.3); g.fillCircle(6, 5, 2);
    }, 16, 16);
    // Gold gem
    mk('gem_gold', g => {
      g.fillStyle(0xdda800); g.fillCircle(9, 9, 9);
      g.fillStyle(0xffdd44, 0.6); g.fillCircle(8, 7, 5);
      g.fillStyle(0xffffff, 0.4); g.fillCircle(7, 6, 2);
    }, 18, 18);
    // Orbital ink ball
    mk('orbital', g => {
      g.fillStyle(0x2a1a3e); g.fillCircle(10, 10, 10);
      g.fillStyle(0x5533aa, 0.5); g.fillCircle(10, 10, 7);
      g.fillStyle(0xaa88ff, 0.3); g.fillCircle(8, 8, 3);
    }, 20, 20);
    // Whip slash arc
    mk('whip_seg', g => {
      g.fillStyle(0x1a1028); g.fillEllipse(12, 4, 24, 8);
    }, 24, 8);
    // Enemy bullet
    mk('ebullet', g => { g.fillStyle(0xff3333); g.fillCircle(5, 5, 5); }, 10, 10);
    // Ambient ink mote
    mk('mote', g => {
      g.fillStyle(0x1a1a2e, 0.4); g.fillCircle(4, 4, 4);
    }, 8, 8);
    // Shadow
    mk('shadow', g => {
      g.fillStyle(0x000000, 0.35); g.fillEllipse(16, 6, 32, 12);
    }, 32, 12);
  }
  create() { this.scene.start('Title'); }
}

// ── Title ──
class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }
  create() {
    this.cameras.main.setBackgroundColor('#0a0808');
    if (this.textures.exists('sky')) {
      const sky = this.add.image(W / 2, H * 0.3, 'sky').setDisplaySize(W * 1.4, H * 0.55).setAlpha(0.35);
      this.tweens.add({ targets: sky, x: W / 2 + 20, duration: 8000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    // Floating ink motes on title
    if (this.textures.exists('mote')) {
      this.add.particles(W / 2, H / 2, 'mote', {
        x: { min: -W / 2, max: W / 2 }, y: { min: -H / 2, max: H / 2 },
        speed: { min: 5, max: 20 }, scale: { start: 0.8, end: 0 }, alpha: { start: 0.3, end: 0 },
        lifespan: { min: 3000, max: 6000 }, frequency: 200, quantity: 1,
      });
    }
    this.add.rectangle(W / 2, H / 2, W, H, 0x0a0808, 0.55);
    // Title with ink brush feel
    const title = this.add.text(W / 2, H * 0.22, '墨渊求生', { fontFamily: F, fontSize: '52px', color: '#e8dcc8', fontStyle: 'bold' }).setOrigin(0.5).setShadow(3, 3, '#000', 8);
    this.tweens.add({ targets: title, scaleX: 1.01, scaleY: 1.01, duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.text(W / 2, H * 0.31, 'Inkfield', { fontFamily: F, fontSize: '18px', color: '#776655' }).setOrigin(0.5);
    this.add.text(W / 2, H * 0.37, '山海经异兽在末日废墟里打工修网线', { fontFamily: F, fontSize: '13px', color: '#554433' }).setOrigin(0.5);
    // Characters — bigger, with shadows
    ['taotie', 'qiongqi', 'baize', 'hundun'].forEach((k, i) => {
      const cx = W / 2 - 135 + i * 90, cy = H * 0.52;
      this.add.ellipse(cx, cy + 34, 36, 9, 0x000000, 0.25);
      if (this.textures.exists(k)) {
        const s = this.add.image(cx, cy, k).setDisplaySize(56, 66);
        this.tweens.add({ targets: s, y: cy - 5, duration: 1200 + i * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      this.add.text(cx, cy + 44, ['饕餮', '穷奇', '白泽', '混沌'][i], { fontFamily: F, fontSize: '11px', color: '#887766' }).setOrigin(0.5);
    });
    this.add.text(W / 2, H * 0.70, 'WASD移动 · 自动射击 · 空格翻滚 · F撤离', { fontFamily: F, fontSize: '12px', color: '#555' }).setOrigin(0.5);
    this.add.text(W / 2, H * 0.75, '击杀 → 灵核 → 升级灵器 → 灵机爆发前撤离', { fontFamily: F, fontSize: '12px', color: '#555' }).setOrigin(0.5);
    const cta = this.add.text(W / 2, H * 0.86, '— 点击上班打卡 —', { fontFamily: F, fontSize: '22px', color: '#e8dcc8', fontStyle: 'bold' }).setOrigin(0.5);
    this.tweens.add({ targets: cta, alpha: 0.2, duration: 800, yoyo: true, repeat: -1 });
    this.add.text(W / 2, H * 0.95, 'Phaser 3 · AI水墨 · JoyBoy Games', { fontFamily: F, fontSize: '9px', color: '#443' }).setOrigin(0.5);
    this.input.once('pointerdown', () => { initAudio(); this.scene.start('Game'); });
  }
}

// ── GAME SCENE — VS-style Survivors ─────────────────────────────────────────
class GameScene extends Phaser.Scene {
  player!: Phaser.Physics.Arcade.Sprite;
  playerShadow!: Phaser.GameObjects.Image;
  pHp = 200; pMaxHp = 200; invuln = 0; dodgeCd = 0;
  // Upgrade stats
  uFireRate = 1; uPierce = 0; uBullets = 1; uDmg = 1; uDmgTaken = 1;
  uSpd = 1; uPickup = 1; uLjRate = 1; uRegen = 0; uKillHeal = 0;
  uChain = false; uInkRain = false; uOrbitals = 0; uWhip = false;
  uBulletScale = 1;
  shootCd = 0; whipCd = 0;
  // Orbital tracking
  orbitalSprites: Phaser.GameObjects.Image[] = [];
  orbitalAngle = 0;
  // Groups
  walls!: Phaser.Physics.Arcade.StaticGroup;
  bullets!: Phaser.Physics.Arcade.Group;
  enemies!: Phaser.Physics.Arcade.Group;
  gems!: Phaser.Physics.Arcade.Group;
  extPts!: Phaser.Physics.Arcade.Group;
  // Systems
  lingji = 0; lingjiS = 0; kills = 0; sessionT = 0; peakLj = 0; totalLoot = 0;
  xp = 0; xpNext = 6; level = 0; chainKills = 0; chainTimer = 0;
  wave = 0; waveTimer = 0; spawnTimer = 0;
  bcMsg = ''; bcTimer = 0; bcQ: string[] = [];
  ambTimer = 0; rainTimer = 0;
  paused = false;
  // Rendering
  inkRT!: Phaser.GameObjects.RenderTexture;
  inkE!: Phaser.GameObjects.Particles.ParticleEmitter;
  sparkE!: Phaser.GameObjects.Particles.ParticleEmitter;
  moteE!: Phaser.GameObjects.Particles.ParticleEmitter;
  hudG!: Phaser.GameObjects.Graphics;
  hudT: Record<string, Phaser.GameObjects.Text> = {};
  upgradeUI: Phaser.GameObjects.GameObject[] = [];
  cam!: Phaser.Cameras.Scene2D.Camera;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;

  constructor() { super('Game'); }

  create() {
    this.cam = this.cameras.main;
    this.cam.setBounds(0, 0, MW, MH);
    this.cam.setBackgroundColor('#080a06');
    this.physics.world.setBounds(0, 0, MW, MH);

    // ── 2.5D Parallax layers ──
    // Far sky
    if (this.textures.exists('sky'))
      this.add.image(MW / 2, MH * 0.15, 'sky').setDisplaySize(MW * 2, MH * 0.4).setScrollFactor(0.06, 0.04).setAlpha(0.3).setDepth(-200);

    // Mid ruins silhouettes — more layers, varying depths
    for (let layer = 0; layer < 3; layer++) {
      const sf = 0.15 + layer * 0.08;
      const mg = this.add.graphics().setScrollFactor(sf, sf * 0.8).setDepth(-150 + layer * 10).setAlpha(0.08 + layer * 0.03);
      for (let i = 0; i < 15; i++) {
        const rx = Phaser.Math.Between(0, MW * 1.5), rh = Phaser.Math.Between(30, 100 - layer * 20);
        mg.fillStyle(0x1a1510 + layer * 0x050505); mg.fillRect(rx, MH * 0.25 - rh, Phaser.Math.Between(15, 60), rh);
      }
    }

    // Ground — dark base + tiled texture + color overlay
    this.add.rectangle(MW / 2, MH / 2, MW, MH, 0x0c100a).setDepth(-100);
    if (this.textures.exists('ground'))
      this.add.tileSprite(MW / 2, MH / 2, MW, MH, 'ground').setAlpha(0.45).setDepth(-90);

    // Ground decorations — more variety, glowing veins
    const decoG = this.add.graphics().setDepth(-80);
    for (let i = 0; i < 400; i++) {
      const dx = Phaser.Math.Between(60, MW - 60), dy = Phaser.Math.Between(60, MH - 60);
      if (Math.random() < 0.15) {
        // Glowing vein
        decoG.lineStyle(1, 0x3322aa, 0.08);
        const len = Phaser.Math.Between(20, 80), ang = Math.random() * Math.PI * 2;
        decoG.lineBetween(dx, dy, dx + Math.cos(ang) * len, dy + Math.sin(ang) * len);
      } else if (Math.random() < 0.4) {
        decoG.fillStyle(Phaser.Math.Between(0, 1) ? 0x1a1a1a : 0x221c18, 0.2);
        decoG.fillCircle(dx, dy, Phaser.Math.Between(2, 7));
      } else {
        decoG.fillStyle(0x151210, 0.15);
        decoG.fillRect(dx, dy, Phaser.Math.Between(3, 18), Phaser.Math.Between(1, 4));
      }
    }

    // Foreground mist — multiple layers for depth
    for (let fl = 0; fl < 2; fl++) {
      const fogG = this.add.graphics().setScrollFactor(1.1 + fl * 0.08, 1.05 + fl * 0.05).setDepth(500 + fl).setAlpha(0.03 + fl * 0.01);
      for (let i = 0; i < 12; i++) {
        fogG.fillStyle(fl === 0 ? 0x1a1028 : 0x0a1820);
        fogG.fillCircle(Phaser.Math.Between(0, MW), Phaser.Math.Between(0, MH), Phaser.Math.Between(80, 250));
      }
    }

    // ── Persistent ink marks ──
    this.inkRT = this.add.renderTexture(0, 0, MW, MH).setDepth(-70).setAlpha(0.55);

    // ── Particles ──
    this.inkE = this.add.particles(0, 0, 'ink', {
      speed: { min: 40, max: 250 }, scale: { start: 1.2, end: 0 }, alpha: { start: 0.7, end: 0 },
      lifespan: { min: 250, max: 600 }, gravityY: 40, emitting: false, rotate: { min: 0, max: 360 },
    }).setDepth(300);
    this.sparkE = this.add.particles(0, 0, 'spark', {
      speed: { min: 100, max: 450 }, scale: { start: 1, end: 0 }, alpha: { start: 1, end: 0 },
      lifespan: { min: 100, max: 350 }, emitting: false,
    }).setDepth(301);
    // Ambient floating ink motes
    this.moteE = this.add.particles(MW / 2, MH / 2, 'mote', {
      x: { min: -MW / 2, max: MW / 2 }, y: { min: -MH / 2, max: MH / 2 },
      speed: { min: 3, max: 12 }, scale: { start: 0.6, end: 0 }, alpha: { start: 0.2, end: 0 },
      lifespan: { min: 4000, max: 8000 }, frequency: 80, quantity: 1,
    }).setDepth(250);

    // ── Physics groups ──
    this.walls = this.physics.add.staticGroup();
    this.bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 600 });
    this.enemies = this.physics.add.group({ maxSize: 300 });
    this.gems = this.physics.add.group({ maxSize: 600 });
    this.extPts = this.physics.add.group();

    // ── Player ──
    const pKey = this.textures.exists('taotie') ? 'taotie' : 'bullet';
    // Player shadow
    this.playerShadow = this.add.image(MW / 2, MH / 2 + 30, 'shadow').setDisplaySize(44, 14).setDepth(99).setAlpha(0.4);
    this.player = this.physics.add.sprite(MW / 2, MH / 2, pKey).setDisplaySize(56, 68).setDepth(100);
    this.player.setCircle(16, this.player.width / 2 - 16, this.player.height / 2 - 16);
    this.player.setCollideWorldBounds(true).setDamping(true).setDrag(0.0006).setMaxVelocity(400);
    this.cam.startFollow(this.player, true, 0.09, 0.09);

    // ── Map ──
    this.genMap();

    // ── Colliders ──
    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.enemies, this.walls);
    this.physics.add.overlap(this.bullets, this.enemies, this.bulletHitEnemy as any, undefined, this);
    this.physics.add.overlap(this.enemies, this.player, this.enemyTouchPlayer as any, undefined, this);

    // ── Input ──
    const kb = this.input.keyboard!;
    this.keys = {
      w: kb.addKey('W'), s: kb.addKey('S'), a: kb.addKey('A'), d: kb.addKey('D'),
      up: kb.addKey('UP'), down: kb.addKey('DOWN'), left: kb.addKey('LEFT'), right: kb.addKey('RIGHT'),
      space: kb.addKey('SPACE'), f: kb.addKey('F'),
    };
    this.input.mouse!.disableContextMenu();

    // ── HUD ──
    this.createHUD();

    // ── Init ──
    this.resetStats();
    this.broadcast('欢迎入职。自动射击已激活。生存，搜刮，撤离。');

    // Spawn initial wave immediately — screen should never be empty
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Phaser.Math.Between(400, 800);
      this.spawnEnemy(
        Phaser.Math.Clamp(MW / 2 + Math.cos(angle) * dist, 60, MW - 60),
        Phaser.Math.Clamp(MH / 2 + Math.sin(angle) * dist, 60, MH - 60),
        0
      );
    }
  }

  resetStats() {
    this.pHp = this.pMaxHp = 200; this.lingji = this.lingjiS = 0;
    this.kills = this.sessionT = this.peakLj = this.totalLoot = 0;
    this.xp = 0; this.xpNext = 6; this.level = 0;
    this.chainKills = this.chainTimer = 0; this.wave = 0; this.waveTimer = 0;
    this.uFireRate = 1; this.uPierce = 0; this.uBullets = 1; this.uDmg = 1;
    this.uDmgTaken = 1; this.uSpd = 1; this.uPickup = 1; this.uLjRate = 1;
    this.uRegen = 0; this.uKillHeal = 0; this.uChain = false; this.uInkRain = false;
    this.uOrbitals = 0; this.uWhip = false; this.uBulletScale = 1;
    this.shootCd = 0; this.whipCd = 0; this.invuln = 0; this.dodgeCd = 0;
    this.paused = false; this.spawnTimer = 0; this.ambTimer = 0; this.rainTimer = 0;
    this.bcMsg = ''; this.bcTimer = 0; this.bcQ = [];
    this.orbitalSprites.forEach(s => s.destroy());
    this.orbitalSprites = []; this.orbitalAngle = 0;
  }

  genMap() {
    const bw = 35;
    [[MW / 2, bw / 2, MW, bw], [MW / 2, MH - bw / 2, MW, bw], [bw / 2, MH / 2, bw, MH], [MW - bw / 2, MH / 2, bw, MH]]
      .forEach(([x, y, w, h]) => this.addWall(x, y, w, h));
    // Scattered ruins — more variety
    for (let i = 0; i < 50; i++) {
      const horiz = Math.random() > 0.5;
      this.addWall(
        Phaser.Math.Between(250, MW - 250), Phaser.Math.Between(250, MH - 250),
        horiz ? Phaser.Math.Between(40, 180) : Phaser.Math.Between(8, 16),
        horiz ? Phaser.Math.Between(8, 16) : Phaser.Math.Between(40, 180)
      );
    }
    this.addExtPt(180, 180); this.addExtPt(MW - 180, MH - 180);
    if (Math.random() > 0.3) this.addExtPt(MW - 180, 180);
  }

  addWall(cx: number, cy: number, w: number, h: number) {
    const g = this.add.graphics().setDepth(11);
    const x = cx - w / 2, y = cy - h / 2, top = 8;
    // 3D extrusion effect — top face + front face + edge highlights
    g.fillStyle(0x605848, 0.8); g.fillRect(x - 1, y - top, w + 2, top); // top face (lighter)
    g.fillStyle(0x2d2620, 0.9); g.fillRect(x, y, w, h); // front face
    g.lineStyle(1, 0x0f0c08, 0.5); g.strokeRect(x - 1, y - top, w + 2, h + top + 1);
    // Subtle glow on edges
    g.lineStyle(1, 0x443828, 0.2); g.lineBetween(x, y - top, x + w, y - top);
    const wall = this.walls.create(cx, cy) as Phaser.Physics.Arcade.Sprite;
    wall.setVisible(false).refreshBody(); wall.body!.setSize(w, h);
  }

  addExtPt(x: number, y: number) {
    const c = this.add.circle(x, y, 28, 0x44cc88, 0.12).setStrokeStyle(2, 0x44cc88, 0.5).setDepth(8);
    this.tweens.add({ targets: c, scale: 1.4, alpha: 0.06, duration: 1200, yoyo: true, repeat: -1 });
    // Pulsing glow ring
    const c2 = this.add.circle(x, y, 35, 0x44cc88, 0).setStrokeStyle(1, 0x44cc88, 0.3).setDepth(7);
    this.tweens.add({ targets: c2, scale: 2, alpha: 0, duration: 2000, repeat: -1 });
    this.add.text(x, y - 38, '撤离点', { fontFamily: F, fontSize: '10px', color: '#4c8' }).setOrigin(0.5).setDepth(8);
    const ep = this.extPts.create(x, y) as Phaser.Physics.Arcade.Sprite;
    ep.setVisible(false); ep.body!.setCircle(30);
  }

  // ── UPDATE ──
  update(_t: number, delta: number) {
    if (this.paused) return;
    const dt = delta / 1000;
    this.sessionT += dt;

    this.updateMovement(dt);
    this.updateAutoFire(dt);
    this.updateOrbitals(dt);
    this.updateWhip(dt);
    this.updateEnemyAI(dt);
    this.updateGems();
    this.updateExtraction();
    this.updateSpawning(dt);
    this.updateLingji(dt);
    this.updateWaves(dt);
    this.updateChain(dt);
    this.updateRegen(dt);
    this.updateInkRain(dt);
    this.updateBC(dt);
    this.updateAmbient(dt);

    // Player shadow follows
    this.playerShadow.setPosition(this.player.x, this.player.y + 30);
    this.player.setDepth(this.player.y);

    this.lingjiS = Phaser.Math.Linear(this.lingjiS, this.lingji, 0.06);
    // Camera zoom — pull back at high lingji to show the horde
    const targetZoom = this.lingji > 80 ? 0.82 : this.lingji > 60 ? 0.88 : this.lingji > 40 ? 0.94 : 1;
    this.cam.setZoom(Phaser.Math.Linear(this.cam.zoom, targetZoom, 0.012));
    this.updateHUD();

    // Cleanup bullets
    this.bullets.getChildren().forEach(c => {
      const b = c as Phaser.Physics.Arcade.Sprite;
      if (!b.active) return;
      const age = (b.getData('age') || 0) + dt;
      b.setData('age', age);
      // Stamp ink trail along bullet path
      if (age < 1.5 && Math.random() < 0.3) this.stampInk(b.x, b.y, Phaser.Math.Between(2, 4));
      if (age > 2) b.destroy();
    });
  }

  // ── MOVEMENT ──
  updateMovement(dt: number) {
    let ax = 0, ay = 0;
    if (this.keys.w.isDown || this.keys.up.isDown) ay = -1;
    if (this.keys.s.isDown || this.keys.down.isDown) ay = 1;
    if (this.keys.a.isDown || this.keys.left.isDown) ax = -1;
    if (this.keys.d.isDown || this.keys.right.isDown) ax = 1;
    const il = Math.hypot(ax, ay); if (il > 0) { ax /= il; ay /= il; }

    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.player.setAlpha(this.invuln > 0 && Math.floor(this.invuln * 20) % 2 ? 0.3 : 1);

    // Dodge roll
    if ((this.keys.space.isDown) && this.dodgeCd <= 0 && il > 0) {
      this.dodgeCd = 0.4; this.invuln = 0.2;
      this.player.setVelocity(ax * 600, ay * 600);
      sfx.dodge();
      this.inkE.emitParticleAt(this.player.x, this.player.y, 8);
      // Leave ink trail during dodge
      for (let i = 0; i < 3; i++) {
        this.time.delayedCall(i * 40, () => {
          if (this.player.active) this.stampInk(this.player.x, this.player.y, Phaser.Math.Between(6, 12));
        });
      }
      return;
    }

    const spd = 240 * this.uSpd;
    this.player.setVelocity(
      Phaser.Math.Linear(this.player.body!.velocity.x, ax * spd, 0.16),
      Phaser.Math.Linear(this.player.body!.velocity.y, ay * spd, 0.16)
    );

    // Sprite facing
    const ptr = this.input.activePointer;
    const wp = this.cam.getWorldPoint(ptr.x, ptr.y);
    this.player.setFlipX(wp.x < this.player.x);
    const sideKey = 'taotie_side', frontKey = 'taotie';
    const deg = ((Phaser.Math.Angle.Between(this.player.x, this.player.y, wp.x, wp.y) * 180 / Math.PI) + 360) % 360;
    const wantSide = deg < 60 || deg > 300 || (deg > 120 && deg < 240);
    const wantKey = wantSide && this.textures.exists(sideKey) ? sideKey : frontKey;
    if (this.textures.exists(wantKey) && this.player.texture.key !== wantKey)
      this.player.setTexture(wantKey).setDisplaySize(56, 68);
  }

  // ── AUTO-FIRE (ink brush bullets) ──
  updateAutoFire(dt: number) {
    this.shootCd = Math.max(0, this.shootCd - dt * 1000);
    if (this.shootCd > 0) return;
    this.shootCd = 160 * this.uFireRate;

    const wp = this.cam.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y);
    const baseAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, wp.x, wp.y);
    const baseDmg = Math.floor(25 * this.uDmg);
    const count = this.uBullets;
    const spread = count > 1 ? 0.45 : 0;

    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (count > 1 ? -spread / 2 + spread * i / (count - 1) : 0) + (Math.random() - 0.5) * 0.05;
      const bx = this.player.x + Math.cos(angle) * 22, by = this.player.y + Math.sin(angle) * 22;
      const b = this.bullets.get(bx, by, 'bullet') as Phaser.Physics.Arcade.Sprite;
      if (!b) continue;
      const sz = 14 * this.uBulletScale;
      b.setActive(true).setVisible(true).setPosition(bx, by).setDisplaySize(sz, sz * 0.4);
      b.setRotation(angle);
      b.body!.enable = true;
      b.setVelocity(Math.cos(angle) * 600, Math.sin(angle) * 600);
      b.setData('dmg', baseDmg); b.setData('age', 0); b.setData('pierce', this.uPierce);
    }
    sfx.shoot();
    // Muzzle ink splash
    this.inkE.emitParticleAt(this.player.x + Math.cos(baseAngle) * 25, this.player.y + Math.sin(baseAngle) * 25, 2);
    // Recoil
    this.player.body!.velocity.x -= Math.cos(baseAngle) * 18;
    this.player.body!.velocity.y -= Math.sin(baseAngle) * 18;
  }

  // ── ORBITAL WEAPONS (VS Bible-style) ──
  updateOrbitals(dt: number) {
    // Ensure correct number of orbital sprites
    while (this.orbitalSprites.length < this.uOrbitals) {
      const orb = this.add.image(this.player.x, this.player.y, 'orbital').setDisplaySize(24, 24).setDepth(110);
      this.orbitalSprites.push(orb);
    }
    if (this.uOrbitals === 0) return;

    this.orbitalAngle += dt * 2.5; // rotation speed
    const radius = 80;
    const px = this.player.x, py = this.player.y;

    this.orbitalSprites.forEach((orb, i) => {
      const a = this.orbitalAngle + (i * Math.PI * 2 / this.uOrbitals);
      const ox = px + Math.cos(a) * radius, oy = py + Math.sin(a) * radius;
      orb.setPosition(ox, oy).setRotation(a);

      // Check collision with enemies
      this.enemies.getChildren().forEach(c => {
        const e = c as Phaser.Physics.Arcade.Sprite;
        if (!e.active) return;
        if (Phaser.Math.Distance.Between(ox, oy, e.x, e.y) < 28) {
          const d = e.data.values;
          d.hp -= Math.floor(18 * this.uDmg);
          this.inkE.emitParticleAt(e.x, e.y, 4);
          e.setTintFill(0xffffff);
          this.time.delayedCall(50, () => { if (e.active) e.clearTint(); });
          // Knockback away from orbital
          const ka = Phaser.Math.Angle.Between(ox, oy, e.x, e.y);
          e.body!.velocity.x += Math.cos(ka) * 120;
          e.body!.velocity.y += Math.sin(ka) * 120;
          if (d.hp <= 0) this.killEnemy(e);
        }
      });

      // Visual trail
      if (Math.random() < 0.4) this.stampInk(ox, oy, Phaser.Math.Between(3, 6));
    });
  }

  // ── WHIP WEAPON (VS Whip-style sweep) ──
  updateWhip(dt: number) {
    if (!this.uWhip) return;
    this.whipCd -= dt;
    if (this.whipCd > 0) return;
    this.whipCd = 3;

    sfx.whip();
    const px = this.player.x, py = this.player.y;
    const wp = this.cam.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y);
    const baseA = Phaser.Math.Angle.Between(px, py, wp.x, wp.y);
    const whipRange = 140, whipArc = 2.2; // wide sweep

    // Visual: draw sweep arc
    const sweepG = this.add.graphics().setDepth(200);
    sweepG.lineStyle(6, 0x1a1028, 0.7);
    const segments = 12;
    for (let i = 0; i < segments; i++) {
      const a1 = baseA - whipArc / 2 + whipArc * i / segments;
      const a2 = baseA - whipArc / 2 + whipArc * (i + 1) / segments;
      const r = whipRange * (0.5 + 0.5 * Math.sin(Math.PI * i / segments));
      sweepG.lineBetween(
        px + Math.cos(a1) * r, py + Math.sin(a1) * r,
        px + Math.cos(a2) * r, py + Math.sin(a2) * r
      );
      this.inkE.emitParticleAt(px + Math.cos(a1) * r, py + Math.sin(a1) * r, 2);
    }
    // Fade and destroy sweep visual
    this.tweens.add({ targets: sweepG, alpha: 0, duration: 300, onComplete: () => sweepG.destroy() });

    // Damage enemies in arc
    const dmg = Math.floor(40 * this.uDmg);
    this.enemies.getChildren().forEach(c => {
      const e = c as Phaser.Physics.Arcade.Sprite;
      if (!e.active) return;
      const dist = Phaser.Math.Distance.Between(px, py, e.x, e.y);
      if (dist > whipRange) return;
      const angleToE = Phaser.Math.Angle.Between(px, py, e.x, e.y);
      let angleDiff = angleToE - baseA;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      if (Math.abs(angleDiff) < whipArc / 2) {
        e.data.values.hp -= dmg;
        this.floatText(e.x, e.y - 20, `${dmg}`, '#aa88ff', 18);
        // Heavy knockback
        const ka = Phaser.Math.Angle.Between(px, py, e.x, e.y);
        e.body!.velocity.x += Math.cos(ka) * 250;
        e.body!.velocity.y += Math.sin(ka) * 250;
        this.inkE.emitParticleAt(e.x, e.y, 5);
        e.setTintFill(0xffffff);
        this.time.delayedCall(60, () => { if (e.active) e.clearTint(); });
        if (e.data.values.hp <= 0) this.killEnemy(e);
      }
    });
    this.cam.shake(60, 0.004);
  }

  // ── ENEMY AI ──
  updateEnemyAI(_dt: number) {
    const px = this.player.x, py = this.player.y;
    const ag = 1 + (this.lingji > 50 ? 0.35 : 0) + (this.lingji > 75 ? 0.45 : 0);
    this.enemies.getChildren().forEach(c => {
      const e = c as Phaser.Physics.Arcade.Sprite;
      if (!e.active) return;
      const d = e.data.values;
      const dist = Phaser.Math.Distance.Between(e.x, e.y, px, py);
      if (dist < 700 || d.alert) {
        d.alert = true;
        const a = Phaser.Math.Angle.Between(e.x, e.y, px, py);
        const spd = d.spd * ag;
        e.setVelocity(
          Phaser.Math.Linear(e.body!.velocity.x, Math.cos(a) * spd, 0.07),
          Phaser.Math.Linear(e.body!.velocity.y, Math.sin(a) * spd, 0.07)
        );
        e.setFlipX(px < e.x);
      } else {
        if (Math.random() < 0.01) d.wAngle = Math.random() * 6.28;
        e.setVelocity(
          Phaser.Math.Linear(e.body!.velocity.x, Math.cos(d.wAngle || 0) * 30, 0.03),
          Phaser.Math.Linear(e.body!.velocity.y, Math.sin(d.wAngle || 0) * 30, 0.03)
        );
      }
      e.setRotation(Math.sin(this.time.now / 250 + e.x) * 0.04);
      e.setDepth(e.y);
    });
  }

  // ── SPAWNING ──
  updateSpawning(dt: number) {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    const maxE = this.lingji < 25 ? 50 : this.lingji < 50 ? 80 : this.lingji < 75 ? 130 : 200;
    if (this.enemies.countActive() >= maxE) { this.spawnTimer = 0.3; return; }
    const batch = Math.min(Phaser.Math.Between(3, 6 + this.wave), maxE - this.enemies.countActive());
    this.spawnTimer = Math.max(0.2, 1.2 - this.wave * 0.08 - this.lingji * 0.006);
    for (let i = 0; i < batch; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Phaser.Math.Between(450, 750);
      const sx = Phaser.Math.Clamp(this.player.x + Math.cos(angle) * dist, 60, MW - 60);
      const sy = Phaser.Math.Clamp(this.player.y + Math.sin(angle) * dist, 60, MH - 60);
      let type = 0;
      if (this.wave >= 2 && Math.random() < 0.25 + this.wave * 0.04) type = 1;
      if (this.wave >= 3 && Math.random() < 0.1 + this.wave * 0.02) type = 2;
      if (this.wave >= 5 && Math.random() < 0.05) type = 3; // boss drone
      this.spawnEnemy(sx, sy, type);
    }
  }

  spawnEnemy(x: number, y: number, type: number) {
    const keys = ['e_soldier', 'e_hunter', 'e_enforcer', 'e_drone'];
    const sizes: [number, number][] = [[42, 50], [46, 54], [58, 68], [72, 80]];
    const key = this.textures.exists(keys[type]) ? keys[type] : 'ebullet';
    const e = this.enemies.get(x, y, key) as Phaser.Physics.Arcade.Sprite;
    if (!e) return;
    e.setActive(true).setVisible(true).setPosition(x, y);
    const [sw, sh] = sizes[type];
    e.setDisplaySize(sw, sh).setCircle(e.width * 0.3, e.width * 0.2, e.height * 0.2);
    e.setCollideWorldBounds(true);
    const hpMult = 1 + this.wave * 0.18;
    e.setData({
      type, hp: Math.floor([35, 90, 220, 600][type] * hpMult), maxHp: Math.floor([35, 90, 220, 600][type] * hpMult),
      spd: [75, 110, 50, 40][type], dmg: [10, 20, 35, 60][type], alert: false, wAngle: Math.random() * 6.28,
      xp: [1, 3, 6, 12][type],
    });
    // Spawn flash
    e.setAlpha(0);
    this.tweens.add({ targets: e, alpha: 1, duration: 200 });
  }

  // ── COMBAT ──
  bulletHitEnemy(bullet: Phaser.Physics.Arcade.Sprite, enemy: Phaser.Physics.Arcade.Sprite) {
    if (!bullet.active || !enemy.active) return;
    const dmg = bullet.getData('dmg') || 25;
    const d = enemy.data.values;
    d.hp -= dmg; d.alert = true;
    // Heavy knockback
    enemy.body!.velocity.x += bullet.body!.velocity.x * 0.15;
    enemy.body!.velocity.y += bullet.body!.velocity.y * 0.15;
    sfx.hit();
    // Hit flash
    enemy.setTintFill(0xffffff);
    this.time.delayedCall(50, () => { if (enemy.active) enemy.clearTint(); });
    // Ink explosion at impact
    this.inkE.emitParticleAt(bullet.x, bullet.y, 5);
    this.stampInk(bullet.x, bullet.y, Phaser.Math.Between(5, 14));
    // Damage number — big and bold
    this.floatText(enemy.x + Phaser.Math.Between(-10, 10), enemy.y - 24, `${dmg}`, '#fff', 18);
    // Pierce or destroy
    const p = bullet.getData('pierce') || 0;
    if (p > 0) { bullet.setData('pierce', p - 1); } else { bullet.destroy(); }
    this.cam.shake(30, 0.002);
    if (d.hp <= 0) this.killEnemy(enemy);
  }

  killEnemy(enemy: Phaser.Physics.Arcade.Sprite) {
    const d = enemy.data.values;
    const isBig = d.type >= 1;
    isBig ? sfx.eliteKill() : sfx.kill();

    // ★ MASSIVE VISUAL FEEDBACK ★
    // Ink explosion — scale with enemy type
    const inkCount = isBig ? 35 : 22;
    const sparkCount = isBig ? 25 : 15;
    this.inkE.emitParticleAt(enemy.x, enemy.y, inkCount);
    this.sparkE.emitParticleAt(enemy.x, enemy.y, sparkCount);
    // Permanent ink stain on ground — BIG
    this.stampInk(enemy.x, enemy.y, Phaser.Math.Between(20, isBig ? 50 : 35));
    if (isBig) {
      // Secondary splatter
      for (let i = 0; i < 4; i++) {
        const sa = Math.random() * Math.PI * 2, sd = Phaser.Math.Between(15, 40);
        this.stampInk(enemy.x + Math.cos(sa) * sd, enemy.y + Math.sin(sa) * sd, Phaser.Math.Between(8, 18));
      }
    }

    // Slowmo — noticeable
    this.time.timeScale = 0.2;
    this.time.delayedCall(isBig ? 140 : 90, () => { this.time.timeScale = 1; });
    // Camera effects
    this.cam.shake(isBig ? 120 : 60, isBig ? 0.008 : 0.004);
    if (isBig) this.cam.flash(60, 255, 200, 50, true);

    // Chain kill tracking
    this.chainKills++; this.chainTimer = 2.5;
    if (this.chainKills >= 3) {
      this.floatText(this.player.x, this.player.y - 60, `连斩 ×${this.chainKills}!`, '#ffd700', 24);
      // Bonus particles for chain
      this.sparkE.emitParticleAt(this.player.x, this.player.y, 8);
    }
    if (this.chainKills >= 8) {
      this.floatText(this.player.x, this.player.y - 90, '墨意纵横!', '#ff44ff', 28);
      this.cam.flash(100, 180, 80, 255, true);
    }

    // Drop gems — more from bigger enemies
    const gemCount = (d.xp || 1) + (isBig ? 2 : 0);
    for (let i = 0; i < gemCount; i++) {
      const gx = enemy.x + Phaser.Math.Between(-20, 20), gy = enemy.y + Phaser.Math.Between(-20, 20);
      const gem = this.gems.get(gx, gy, d.type >= 2 ? 'gem_gold' : 'gem') as Phaser.Physics.Arcade.Sprite;
      if (gem) {
        gem.setActive(true).setVisible(true).setPosition(gx, gy).setDisplaySize(14, 14).setDepth(50);
        gem.setData('val', [Phaser.Math.Between(80, 400), Phaser.Math.Between(300, 1200), Phaser.Math.Between(800, 2000), Phaser.Math.Between(2000, 5000)][d.type]);
        // Gems scatter outward then slow
        const ga = Math.random() * Math.PI * 2;
        gem.setVelocity(Math.cos(ga) * 100, Math.sin(ga) * 100);
        this.tweens.add({ targets: gem, scaleX: 1.3, scaleY: 1.3, duration: 100, yoyo: true });
      }
    }

    // Chain explosion
    if (this.uChain) {
      this.enemies.getChildren().forEach(c => {
        const e2 = c as Phaser.Physics.Arcade.Sprite;
        if (e2.active && e2 !== enemy && Phaser.Math.Distance.Between(enemy.x, enemy.y, e2.x, e2.y) < 90) {
          e2.data.values.hp -= Math.floor(30 * this.uDmg);
          this.inkE.emitParticleAt(e2.x, e2.y, 6);
          this.floatText(e2.x, e2.y - 20, `${Math.floor(30 * this.uDmg)}`, '#ff8844', 14);
          if (e2.data.values.hp <= 0) this.killEnemy(e2);
        }
      });
    }

    if (this.uKillHeal > 0) this.pHp = Math.min(this.pMaxHp, this.pHp + this.uKillHeal);
    this.kills++;
    this.addLj((d.type >= 2 ? 6 : d.type >= 1 ? 3 : 1.5) * this.uLjRate);
    enemy.destroy();
  }

  enemyTouchPlayer(_player: Phaser.Physics.Arcade.Sprite, enemy: Phaser.Physics.Arcade.Sprite) {
    if (this.invuln > 0 || !enemy.active) return;
    const dmg = Math.floor((enemy.data.values.dmg || 10) * this.uDmgTaken);
    this.pHp -= dmg; this.invuln = 0.45;
    this.addLj(2);
    const a = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
    this.player.body!.velocity.x += Math.cos(a) * 350;
    this.player.body!.velocity.y += Math.sin(a) * 350;
    this.cam.shake(180, 0.01); this.cam.flash(100, 100, 20, 20);
    this.inkE.setParticleTint(0x8a2020);
    this.inkE.emitParticleAt(this.player.x, this.player.y, 10);
    this.inkE.setParticleTint(0x1a1a2e);
    this.floatText(this.player.x, this.player.y - 25, `-${dmg}`, '#ff3333', 22);
    _t(60, 0.1, 'sawtooth', 0.08);
    if (this.pHp <= 0) this.die();
  }

  // ── GEMS (magnetic pickup) ──
  updateGems() {
    const px = this.player.x, py = this.player.y;
    const range = 70 * this.uPickup;
    this.gems.getChildren().forEach(c => {
      const g = c as Phaser.Physics.Arcade.Sprite;
      if (!g.active) return;
      const dist = Phaser.Math.Distance.Between(g.x, g.y, px, py);
      if (dist < range) {
        const a = Phaser.Math.Angle.Between(g.x, g.y, px, py);
        const pullSpd = Math.max(300, 800 - dist * 4);
        g.x += Math.cos(a) * pullSpd * 0.016;
        g.y += Math.sin(a) * pullSpd * 0.016;
        if (dist < 22) {
          const val = g.getData('val') || 100;
          this.totalLoot += val; this.xp++;
          g.destroy();
          this.sparkE.emitParticleAt(px, py, 3);
          sfx.bc();
          if (this.xp >= this.xpNext) this.triggerLevelUp();
        }
      }
      // Slow down scattered gems
      if (g.body) {
        g.body.velocity.x *= 0.94;
        g.body.velocity.y *= 0.94;
      }
    });
  }

  // ── LEVEL UP ──
  triggerLevelUp() {
    this.xp = 0; this.xpNext = Math.floor(this.xpNext * 1.35) + 2;
    this.level++;
    sfx.levelUp();
    this.paused = true;
    this.physics.world.pause();
    this.cam.flash(200, 255, 215, 0, true);

    const choices = Phaser.Utils.Array.Shuffle([...UPS]).slice(0, 3);

    const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.8).setScrollFactor(0).setDepth(2000);
    this.upgradeUI.push(bg);

    // Ink splash decoration
    const splashG = this.add.graphics().setScrollFactor(0).setDepth(2001);
    splashG.fillStyle(0x1a1a2e, 0.15);
    for (let i = 0; i < 8; i++) {
      splashG.fillCircle(Phaser.Math.Between(50, W - 50), Phaser.Math.Between(50, H - 50), Phaser.Math.Between(30, 80));
    }
    this.upgradeUI.push(splashG);

    const title = this.add.text(W / 2, H * 0.14, `灵机共振 · Lv.${this.level}`, {
      fontFamily: F, fontSize: '28px', color: '#ffd700', fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2002);
    this.upgradeUI.push(title);
    const sub = this.add.text(W / 2, H * 0.22, '选择一项灵器升级', {
      fontFamily: F, fontSize: '13px', color: '#aaa'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2002);
    this.upgradeUI.push(sub);

    choices.forEach((up, i) => {
      const cx = W / 2 - 220 + i * 220, cy = H * 0.52;
      const card = this.add.rectangle(cx, cy, 180, 180, 0x12121e, 0.95).setStrokeStyle(2, 0x4466cc)
        .setScrollFactor(0).setDepth(2003).setInteractive({ useHandCursor: true });
      // Card ink decoration
      const cardG = this.add.graphics().setScrollFactor(0).setDepth(2003);
      cardG.fillStyle(0x1a1a3e, 0.2); cardG.fillCircle(cx, cy - 20, 25);
      const nm = this.add.text(cx, cy - 20, up.name, {
        fontFamily: F, fontSize: '18px', color: '#e8dcc8', fontStyle: 'bold'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2004);
      const ds = this.add.text(cx, cy + 20, up.desc, {
        fontFamily: F, fontSize: '13px', color: '#aaa'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2004);
      this.upgradeUI.push(card, cardG, nm, ds);

      // Hover: gold border + scale
      card.on('pointerover', () => { card.setStrokeStyle(3, 0xffd700); this.tweens.add({ targets: [card, nm, ds], scaleX: 1.05, scaleY: 1.05, duration: 100 }); });
      card.on('pointerout', () => { card.setStrokeStyle(2, 0x4466cc); this.tweens.add({ targets: [card, nm, ds], scaleX: 1, scaleY: 1, duration: 100 }); });
      card.on('pointerdown', () => { up.fn(this); this.closeUpgradeUI(); });
    });
  }

  closeUpgradeUI() {
    this.upgradeUI.forEach(o => o.destroy());
    this.upgradeUI = [];
    this.paused = false;
    this.physics.world.resume();
    this.cam.flash(100, 100, 180, 255, true);
  }

  // ── EXTRACTION ──
  updateExtraction() {
    if (!this.keys.f.isDown) return;
    this.extPts.getChildren().forEach(c => {
      const e = c as Phaser.Physics.Arcade.Sprite;
      if (Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y) < 45) {
        sfx.punchOut();
        this.scene.start('Extracted', {
          sessionT: this.sessionT, kills: this.kills, totalLoot: this.totalLoot,
          peakLj: this.peakLj, level: this.level,
        });
      }
    });
  }

  // ── WAVES ──
  updateWaves(dt: number) {
    this.waveTimer += dt;
    const newWave = Math.floor(this.waveTimer / 80);
    if (newWave > this.wave) {
      this.wave = newWave;
      this.broadcast(`第${this.wave}波 · 灵机异常波动检测中...`);
      this.addLj(6 + this.wave * 3);
      this.cam.shake(400, 0.006);
      // Wave burst — spawn extra enemies
      for (let i = 0; i < 8 + this.wave * 3; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Phaser.Math.Between(400, 600);
        const type = this.wave >= 4 && Math.random() < 0.15 ? 2 : this.wave >= 2 && Math.random() < 0.3 ? 1 : 0;
        this.spawnEnemy(
          Phaser.Math.Clamp(this.player.x + Math.cos(angle) * dist, 60, MW - 60),
          Phaser.Math.Clamp(this.player.y + Math.sin(angle) * dist, 60, MH - 60),
          type
        );
      }
    }
    if (this.waveTimer % 80 > 68 && this.waveTimer % 80 < 69) {
      this.broadcast(`警告：${Math.ceil(80 - this.waveTimer % 80)}秒后下一波`);
    }
  }

  // ── LINGJI ──
  updateLingji(dt: number) {
    const moving = this.player.body!.velocity.length() > 10;
    if (!moving) this.lingji = Math.max(0, this.lingji - dt * 0.25);
    if (this.lingji >= 75) this.pHp -= dt * (this.lingji >= 90 ? 5 : 1.5);
    if (this.pHp <= 0) this.die();
    this.peakLj = Math.max(this.peakLj, this.lingji);
    const ls = Math.floor(this.lingjiS);
    if (ls === 25) this.broadcast('灵机浓度上升。建议注意防护。');
    if (ls === 50) this.broadcast('灵机超标。请勿恐慌。');
    if (ls === 75) this.broadcast('收割预警。感谢您的贡献。');
    if (ls === 90) this.broadcast('……您还在吗？');
  }

  updateChain(dt: number) { if (this.chainTimer > 0) { this.chainTimer -= dt; } else { this.chainKills = 0; } }
  updateRegen(dt: number) { if (this.uRegen > 0) this.pHp = Math.min(this.pMaxHp, this.pHp + this.uRegen * dt); }

  updateInkRain(dt: number) {
    if (!this.uInkRain) return;
    this.rainTimer -= dt;
    if (this.rainTimer > 0) return;
    this.rainTimer = 2.5;
    const dmg = Math.floor(20 * this.uDmg);
    for (let i = 0; i < 12; i++) {
      const rx = this.player.x + Phaser.Math.Between(-180, 180), ry = this.player.y + Phaser.Math.Between(-180, 180);
      this.inkE.emitParticleAt(rx, ry, 6);
      this.sparkE.emitParticleAt(rx, ry, 2);
      this.stampInk(rx, ry, Phaser.Math.Between(10, 22));
      this.enemies.getChildren().forEach(c => {
        const e = c as Phaser.Physics.Arcade.Sprite;
        if (e.active && Phaser.Math.Distance.Between(rx, ry, e.x, e.y) < 45) {
          e.data.values.hp -= dmg;
          this.floatText(e.x, e.y - 15, `${dmg}`, '#6688ff', 14);
          if (e.data.values.hp <= 0) this.killEnemy(e);
        }
      });
    }
    this.cam.shake(50, 0.003);
  }

  // ── HELPERS ──
  addLj(n: number) {
    const prev = Math.floor(this.lingji / 25);
    this.lingji = Phaser.Math.Clamp(this.lingji + n, 0, 100);
    if (Math.floor(this.lingji / 25) > prev) sfx.levelUp();
  }

  broadcast(msg: string) { this.bcQ.push(msg); }
  updateBC(dt: number) {
    if (this.bcTimer > 0) this.bcTimer -= dt;
    if (this.bcTimer <= 0 && this.bcQ.length) { this.bcMsg = this.bcQ.shift()!; this.bcTimer = 3.5; sfx.bc(); }
  }

  updateAmbient(dt: number) {
    this.ambTimer -= dt; if (this.ambTimer > 0) return;
    this.ambTimer = Math.max(0.35, 1.1 - this.lingji * 0.008);
    const ns = [261, 293, 329, 392, 440, 523, 587, 659], n = ns[~~(Math.random() * ns.length)];
    if (this.lingji < 25) { if (Math.random() < 0.2) _gz(n, 0.02); }
    else if (this.lingji < 50) _gz(n, 0.016);
    else if (this.lingji < 75) { _gz(n, 0.013); _t(n * 0.99, 0.2, 'sawtooth', 0.007); }
    else { _t(n, 0.1, 'sawtooth', 0.01); _n(0.06, 0.008, 500); }
  }

  stampInk(x: number, y: number, r: number) {
    const g = this.make.graphics({});
    const color = this.lingji >= 80 ? 0x8c6414 : this.lingji >= 55 ? 0x501e78 : 0x1a1928;
    g.fillStyle(color, 0.35);
    g.fillCircle(0, 0, r);
    // Add splatter extensions
    if (r > 8) {
      const exts = Phaser.Math.Between(2, 4);
      for (let i = 0; i < exts; i++) {
        const ea = Math.random() * Math.PI * 2, ed = r * 0.6;
        g.fillEllipse(Math.cos(ea) * ed, Math.sin(ea) * ed, r * 0.4, r * 0.25);
      }
    }
    this.inkRT.draw(g, x, y); g.destroy();
  }

  floatText(x: number, y: number, text: string, color: string, size: number) {
    const t = this.add.text(x, y, text, { fontFamily: F, fontSize: `${size}px`, color, fontStyle: 'bold' })
      .setOrigin(0.5).setDepth(1000).setStroke('#000', 4);
    this.tweens.add({ targets: t, y: y - 50, alpha: 0, scaleX: 1.3, scaleY: 1.3, duration: 700, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  die() {
    sfx.death();
    this.cam.shake(600, 0.015); this.cam.flash(400, 120, 20, 20);
    this.inkE.emitParticleAt(this.player.x, this.player.y, 50);
    this.sparkE.emitParticleAt(this.player.x, this.player.y, 35);
    this.stampInk(this.player.x, this.player.y, 60);
    this.time.delayedCall(900, () => {
      this.scene.start('Death', { sessionT: this.sessionT, kills: this.kills, totalLoot: this.totalLoot, peakLj: this.peakLj, level: this.level });
    });
  }

  // ── HUD ──
  createHUD() {
    this.hudG = this.add.graphics().setScrollFactor(0).setDepth(1500);
    const mt = (k: string, x: number, y: number, sz: string, c: string, style = '') => {
      this.hudT[k] = this.add.text(x, y, '', { fontFamily: F, fontSize: sz, color: c, fontStyle: style }).setScrollFactor(0).setDepth(1501);
    };
    mt('lj', W / 2, 22, '11px', '#fff', 'bold');
    mt('hp', 100, 54, '9px', '#fff');
    mt('info1', 18, 16, '9px', '#777');
    mt('info2', 18, 32, '13px', '#eee', 'bold');
    mt('weap', 18, 76, '10px', '#aaa');
    mt('inv', 20, H - 28, '12px', '#bbb');
    mt('time', W - 20, 20, '11px', '#aaa');
    mt('kills', W - 20, 36, '11px', '#aaa');
    mt('wave', W - 20, 52, '11px', '#daa');
    mt('enemies', W - 20, 68, '9px', '#888');
    mt('bc', W / 2, H - 58, '12px', '#c8e6ff');
    mt('xp', W / 2, 40, '9px', '#4a8');
    this.hudT.lj.setOrigin(0.5); this.hudT.bc.setOrigin(0.5); this.hudT.xp.setOrigin(0.5);
    this.hudT.time.setOrigin(1, 0); this.hudT.kills.setOrigin(1, 0);
    this.hudT.wave.setOrigin(1, 0); this.hudT.enemies.setOrigin(1, 0);
  }

  updateHUD() {
    const g = this.hudG; g.clear();
    // Lingji bar — prominent
    const lW = 280, lH = 16, lX = (W - lW) / 2, lY = 8;
    g.fillStyle(0x000000, 0.65); g.fillRoundedRect(lX - 4, lY - 4, lW + 8, lH + 8, 4);
    const lc = this.lingji >= 90 ? 0xcc4411 : this.lingji >= 75 ? 0xddaa33 : this.lingji >= 50 ? 0x8833ff : this.lingji >= 25 ? 0x4488ff : 0x44aa99;
    g.fillStyle(lc, 0.9); g.fillRect(lX, lY, lW * (this.lingjiS / 100), lH);
    g.lineStyle(1, 0xffffff, 0.12); [25, 50, 75, 90].forEach(m => g.lineBetween(lX + lW * m / 100, lY, lX + lW * m / 100, lY + lH));
    const sn = ['安宁', '涌动', '狂潮', '溢界', '灵爆'][this.lingjiS < 25 ? 0 : this.lingjiS < 50 ? 1 : this.lingjiS < 75 ? 2 : this.lingjiS < 90 ? 3 : 4];
    this.hudT.lj.setText(`灵机 ${~~this.lingji} · ${sn}`);

    // XP bar
    const xpW = 180, xpX = (W - xpW) / 2, xpY = 32;
    g.fillStyle(0x000000, 0.4); g.fillRect(xpX, xpY, xpW, 7);
    g.fillStyle(0x44aa88, 0.8); g.fillRect(xpX, xpY, xpW * (this.xp / this.xpNext), 7);
    this.hudT.xp.setText(`Lv.${this.level} · ${this.xp}/${this.xpNext}`);

    // Badge
    g.fillStyle(0x000000, 0.65); g.fillRoundedRect(8, 8, 190, 52, 4);
    this.hudT.info1.setText('墨渊求生 · 外勤工牌');
    this.hudT.info2.setText('饕餮 · 回收专员');
    const hpW = 170;
    g.fillStyle(0x333333); g.fillRect(18, 48, hpW, 8);
    g.fillStyle(this.pHp > 80 ? 0x44aa44 : this.pHp > 40 ? 0xaaaa44 : 0xcc4444);
    g.fillRect(18, 48, hpW * Phaser.Math.Clamp(this.pHp / this.pMaxHp, 0, 1), 8);
    this.hudT.hp.setText(`${Math.ceil(Math.max(0, this.pHp))}/${this.pMaxHp}`);
    this.hudT.weap.setText(`弹幕×${this.uBullets} 穿透${this.uPierce} 伤害×${this.uDmg.toFixed(1)}${this.uOrbitals ? ' 环绕' + this.uOrbitals : ''}${this.uWhip ? ' 墨鞭' : ''}`);

    // Loot bar
    g.fillStyle(0x000000, 0.55); g.fillRoundedRect(8, H - 40, 200, 28, 4);
    this.hudT.inv.setText(`搜刮 ¥${this.totalLoot.toLocaleString()}`);

    // Stats panel
    g.fillStyle(0x000000, 0.55); g.fillRoundedRect(W - 160, 12, 150, 64, 4);
    this.hudT.time.setText(`${~~(this.sessionT / 60)}:${(~~(this.sessionT % 60)).toString().padStart(2, '0')}`);
    this.hudT.kills.setText(`击杀 ${this.kills}`);
    this.hudT.wave.setText(`第${this.wave}波`);
    this.hudT.enemies.setText(`敌人 ${this.enemies.countActive()}`);

    // Broadcast
    if (this.bcTimer > 0) {
      const ba = Phaser.Math.Clamp(this.bcTimer, 0, 1);
      g.fillStyle(0x000000, 0.7 * ba); g.fillRoundedRect(W / 2 - 240, H - 74, 480, 28, 4);
      this.hudT.bc.setText(this.bcMsg).setAlpha(ba);
    } else { this.hudT.bc.setAlpha(0); }

    // Vignette effects
    if (this.lingjiS > 35) {
      g.fillStyle(this.lingjiS > 75 ? 0x301800 : 0x1a0030, Phaser.Math.Clamp((this.lingjiS - 35) / 90, 0, 0.5));
      g.fillRect(0, 0, W, H);
    }
    if (this.pHp < 50) {
      g.fillStyle(0x6a1010, (1 - this.pHp / 50) * (0.15 + Math.sin(this.time.now / 120) * 0.08));
      g.fillRect(0, 0, W, H);
    }

    // Minimap
    const mmW = 110, mmH = 110, mmX = W - mmW - 10, mmY = H - mmH - 10;
    g.fillStyle(0x000000, 0.55); g.fillRoundedRect(mmX - 3, mmY - 3, mmW + 6, mmH + 6, 4);
    g.fillStyle(0xee4444, 0.8);
    this.enemies.getChildren().forEach(c => {
      const e = c as Phaser.Physics.Arcade.Sprite;
      if (e.active) g.fillRect(mmX + (e.x / MW) * mmW, mmY + (e.y / MH) * mmH, 2, 2);
    });
    g.fillStyle(0x44cc88);
    this.extPts.getChildren().forEach(c => {
      const e = c as Phaser.Physics.Arcade.Sprite;
      g.fillRect(mmX + (e.x / MW) * mmW - 2, mmY + (e.y / MH) * mmH - 2, 5, 5);
    });
    g.fillStyle(0xffffff);
    g.fillRect(mmX + (this.player.x / MW) * mmW - 2, mmY + (this.player.y / MH) * mmH - 2, 5, 5);
  }
}

// ── Death ──
class DeathScene extends Phaser.Scene {
  constructor() { super('Death'); }
  create(data: Record<string, number>) {
    this.cameras.main.setBackgroundColor('rgba(10,6,6,0.97)');
    // Ink motes
    if (this.textures.exists('mote'))
      this.add.particles(W / 2, H / 2, 'mote', { x: { min: -W / 2, max: W / 2 }, y: { min: -H / 2, max: H / 2 }, speed: { min: 3, max: 10 }, alpha: { start: 0.2, end: 0 }, lifespan: 4000, frequency: 300 });
    this.add.text(W / 2, H * 0.18, '工伤', { fontFamily: F, fontSize: '48px', color: '#aa3333', fontStyle: 'bold' }).setOrigin(0.5).setShadow(2, 2, '#000', 8);
    this.add.text(W / 2, H * 0.26, '您所拨打的外勤已离线', { fontFamily: F, fontSize: '14px', color: '#665555' }).setOrigin(0.5);
    [`外勤时间: ${~~(data.sessionT / 60)}分${~~(data.sessionT % 60)}秒`, `击杀: ${data.kills}`, `搜刮: ¥${(data.totalLoot || 0).toLocaleString()}（已损失）`, `灵机峰值: ${~~data.peakLj}`, `灵器等级: Lv.${data.level || 0}`].forEach((s, i) => {
      this.add.text(W / 2, H * 0.36 + i * 22, s, { fontFamily: F, fontSize: '13px', color: '#888' }).setOrigin(0.5);
    });
    const cmt = data.peakLj > 75 ? '该外勤因灵机辐射超标——算了，就是浪。' : data.kills === 0 ? '该外勤尚未产出任何绩效。' : '建议下次注意安全。';
    this.add.text(W / 2, H * 0.62, `公司评语：${cmt}`, { fontFamily: F, fontSize: '12px', color: '#554' }).setOrigin(0.5);
    const cta = this.add.text(W / 2, H * 0.80, '— 点击重新打卡 —', { fontFamily: F, fontSize: '18px', color: '#ccc', fontStyle: 'bold' }).setOrigin(0.5);
    this.tweens.add({ targets: cta, alpha: 0.2, duration: 700, yoyo: true, repeat: -1 });
    this.input.once('pointerdown', () => this.scene.start('Game'));
  }
}

// ── Extracted ──
class ExtractedScene extends Phaser.Scene {
  constructor() { super('Extracted'); }
  create(data: Record<string, number>) {
    this.cameras.main.setBackgroundColor('#eef5e0');
    if (this.textures.exists('sky')) this.add.image(W / 2, H * 0.5, 'sky').setDisplaySize(W, H * 0.5).setAlpha(0.12);
    this.add.text(W / 2, H * 0.14, '打卡下班', { fontFamily: F, fontSize: '42px', color: '#2a6a2a', fontStyle: 'bold' }).setOrigin(0.5).setShadow(2, 2, '#000', 4);
    this.add.text(W / 2, H * 0.22, '辛苦了。明天继续。', { fontFamily: F, fontSize: '13px', color: '#666' }).setOrigin(0.5);
    const st = data.peakLj < 25 ? 0 : data.peakLj < 50 ? 1 : data.peakLj < 75 ? 2 : data.peakLj < 90 ? 3 : 4;
    const mt = [1, 1.3, 1.8, 2.5, 4][st], fl = ~~((data.totalLoot || 0) * mt);
    [['外勤时间', `${~~(data.sessionT / 60)}分${~~(data.sessionT % 60)}秒`], ['击杀', `${data.kills}`], ['搜刮总值', `¥${(data.totalLoot || 0).toLocaleString()}`], ['灵力倍率', `×${mt.toFixed(1)}`], ['最终收入', `¥${fl.toLocaleString()}`], ['灵器等级', `Lv.${data.level || 0}`]].forEach(([l, v], i) => {
      const y = H * 0.30 + i * 24;
      this.add.text(W / 2 - 10, y, l as string, { fontFamily: F, fontSize: '13px', color: '#888' }).setOrigin(1, 0.5);
      this.add.text(W / 2 + 10, y, v as string, { fontFamily: F, fontSize: i === 4 ? '16px' : '13px', color: i === 4 ? '#c8a020' : '#333', fontStyle: i === 4 ? 'bold' : 'normal' }).setOrigin(0, 0.5);
    });
    let r = 'D'; if (fl > 3000) r = 'C'; if (fl > 8000) r = 'B'; if (fl > 15000) r = 'A'; if (fl > 30000) r = 'S';
    this.add.text(W / 2, H * 0.72, r, { fontFamily: F, fontSize: '56px', fontStyle: 'bold', color: r === 'S' ? '#c8a020' : r === 'A' ? '#4a4' : '#888' }).setOrigin(0.5);
    this.add.text(W / 2, H * 0.79, '绩效评级', { fontFamily: F, fontSize: '11px', color: '#888' }).setOrigin(0.5);
    const cta = this.add.text(W / 2, H * 0.90, '— 点击再来一单 —', { fontFamily: F, fontSize: '18px', color: '#333', fontStyle: 'bold' }).setOrigin(0.5);
    this.tweens.add({ targets: cta, alpha: 0.2, duration: 700, yoyo: true, repeat: -1 });
    this.input.once('pointerdown', () => this.scene.start('Game'));
  }
}

// ── Config ──
new Phaser.Game({
  type: Phaser.AUTO, width: W, height: H, parent: document.body,
  backgroundColor: '#080808', pixelArt: false,
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 } } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, TitleScene, GameScene, DeathScene, ExtractedScene],
  input: { activePointers: 2 },
});
