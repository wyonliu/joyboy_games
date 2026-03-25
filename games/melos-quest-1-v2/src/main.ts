/**
 * 麦洛的冒险：百妖长夜 (Melo's Quest: Endless Demon Night) v0.6
 * 水墨弹幕幸存者 — 孤单枪手 meets Vampire Survivors meets 水墨山海经
 *
 * v0.5: +复活 / 多角色 / 连杀系统 / 分享截图 / 排行榜 / 每日挑战 / Poki SDK桩
 */

// ═══════════════════════════════════════════════════
// CONSTANTS & CONFIG
// ═══════════════════════════════════════════════════

const W = 390, H = 844;
const PR = Math.min(window.devicePixelRatio, 2);
const ARENA_R = 800;

const C = {
  bg: '#06061a',
  paper: '#121230', paperDk: '#0e0e28', paperLt: '#1a1a40',
  ink: '#c8c8e8', inkLt: '#9090b8', inkFaint: '#606090',
  red: '#e03050', redDk: '#a01020', redLt: '#ff6888',
  blue: '#2060a0', blueLt: '#60b0e8', bluePale: '#80c8f8',
  gold: '#f0b840', goldDk: '#c89828', goldLt: '#f8d870',
  green: '#30a868', greenLt: '#60d898',
  purple: '#8060b8', purpleLt: '#b098e0',
  white: '#e0e0f0', black: '#000000',
  orange: '#e87040',
  moon: '#f0e8c0', moonGlow: 'rgba(240,232,192,0.08)',
  starDim: '#606890', starBright: '#d0d8f0',
};

// ═══════════════════════════════════════════════════
// CANVAS
// ═══════════════════════════════════════════════════

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d')!;
canvas.width = W * PR; canvas.height = H * PR;
canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
ctx.scale(PR, PR);
document.getElementById('game')!.appendChild(canvas);

function resize() {
  const p = canvas.parentElement!;
  const s = Math.min(p.clientWidth / W, p.clientHeight / H);
  canvas.style.width = W * s + 'px'; canvas.style.height = H * s + 'px';
}
window.addEventListener('resize', resize); resize();

const paperBuf = document.createElement('canvas');
paperBuf.width = W; paperBuf.height = H;
const paperCtx = paperBuf.getContext('2d')!;
(function generatePaper(c: CanvasRenderingContext2D, w: number, h: number) {
  // Rich dark night sky with 3-tone gradient
  const skyGrad = c.createLinearGradient(0, 0, 0, h);
  skyGrad.addColorStop(0, '#030312');
  skyGrad.addColorStop(0.25, '#080828');
  skyGrad.addColorStop(0.5, '#0a0a30');
  skyGrad.addColorStop(0.75, '#0c1038');
  skyGrad.addColorStop(1, '#121240');
  c.fillStyle = skyGrad; c.fillRect(0, 0, w, h);
  const id = c.getImageData(0, 0, w, h), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    d[i] += n; d[i+1] += n; d[i+2] += n + (Math.random() - 0.5) * 6;
  }
  c.putImageData(id, 0, 0);
  // Layered nebula clouds with varying depth
  for (let i = 0; i < 50; i++) {
    c.globalAlpha = Math.random() * 0.04;
    const nebColors = ['#1a1858','#0c1040','#201060','#0a0830','#181050'];
    c.fillStyle = nebColors[Math.floor(Math.random()*nebColors.length)];
    c.beginPath(); c.arc(Math.random()*w, Math.random()*h, 15+Math.random()*100, 0, Math.PI*2); c.fill();
  }
  // Distant mountain silhouettes at bottom
  c.globalAlpha = 0.06;
  c.fillStyle = '#0a0a25';
  c.beginPath(); c.moveTo(0, h*0.85);
  for(let i=0;i<=40;i++){const x=i/40*w;c.lineTo(x, h*0.85 - Math.sin(i*0.4)*h*0.08 - Math.cos(i*0.7)*h*0.05)}
  c.lineTo(w, h); c.lineTo(0, h); c.closePath(); c.fill();
  c.globalAlpha = 0.04;
  c.fillStyle = '#0c0c30';
  c.beginPath(); c.moveTo(0, h*0.9);
  for(let i=0;i<=40;i++){const x=i/40*w;c.lineTo(x, h*0.9 - Math.sin(i*0.6+1)*h*0.06 - Math.cos(i*0.9)*h*0.03)}
  c.lineTo(w, h); c.lineTo(0, h); c.closePath(); c.fill();
  // Terrain texture pattern: subtle ink wash strokes at bottom
  c.globalAlpha = 0.02;
  for(let i=0;i<60;i++){
    c.strokeStyle = Math.random()>0.5?'#303050':'#202040';
    c.lineWidth = 0.5+Math.random()*2;
    c.beginPath();
    const sx=Math.random()*w, sy=h*0.8+Math.random()*h*0.2;
    c.moveTo(sx,sy);
    c.quadraticCurveTo(sx+Math.random()*30-15, sy+Math.random()*10-5, sx+Math.random()*40-20, sy+Math.random()*8-4);
    c.stroke();
  }
  c.globalAlpha = 1;
})(paperCtx, W, H);

// ─── Floating ink-wash clouds (animated) ───
interface InkCloud {x:number;y:number;w:number;h:number;speed:number;alpha:number;seed:number}
const inkClouds: InkCloud[] = [];
for(let i=0;i<8;i++){
  inkClouds.push({x:Math.random()*W*2-W*0.5, y:Math.random()*H*0.5+H*0.05,
    w:60+Math.random()*120, h:15+Math.random()*30, speed:3+Math.random()*8,
    alpha:0.02+Math.random()*0.04, seed:Math.random()*100});
}
function drawInkClouds(cx:CanvasRenderingContext2D, t:number, parallaxX:number, parallaxY:number){
  for(const cl of inkClouds){
    const cx2 = ((cl.x + t*cl.speed - parallaxX*0.1) % (W+cl.w*2)) - cl.w;
    const cy2 = cl.y - parallaxY*0.05;
    cx.save(); cx.globalAlpha = cl.alpha;
    cx.fillStyle = '#1a1848';
    // Soft blob cluster
    for(let j=0;j<5;j++){
      const ox = Math.sin(cl.seed+j*1.5)*cl.w*0.3;
      const oy = Math.cos(cl.seed+j*2.1)*cl.h*0.3;
      cx.beginPath();
      cx.ellipse(cx2+ox, cy2+oy, cl.w*0.3+Math.sin(t*0.5+cl.seed+j)*5, cl.h*0.4, 0, 0, Math.PI*2);
      cx.fill();
    }
    cx.restore();
  }
}

// ─── Starfield (pre-generated) ───
const stars: {x:number,y:number,r:number,bright:number,twinkleSpeed:number}[] = [];
for(let i=0;i<200;i++){
  stars.push({x:Math.random()*W,y:Math.random()*H,r:0.3+Math.random()*1.5,
    bright:0.3+Math.random()*0.7,twinkleSpeed:0.5+Math.random()*3});
}

function drawStars(cx:CanvasRenderingContext2D, t:number){
  for(const s of stars){
    const tw = 0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.x * 0.1);
    cx.globalAlpha = s.bright * tw * 0.7;
    cx.fillStyle = s.r > 1 ? C.starBright : C.starDim;
    cx.beginPath(); cx.arc(s.x, s.y, s.r, 0, Math.PI*2); cx.fill();
  }
  cx.globalAlpha = 1;
}

function drawMoon(cx:CanvasRenderingContext2D, t:number){
  const mx = W * 0.78, my = H * 0.12, mr = 40;
  // Outer glow
  cx.save();
  const glow = cx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 3.5);
  glow.addColorStop(0, 'rgba(240,232,192,0.12)');
  glow.addColorStop(0.3, 'rgba(200,200,240,0.04)');
  glow.addColorStop(1, 'rgba(200,200,240,0)');
  cx.fillStyle = glow; cx.fillRect(mx - mr*4, my - mr*4, mr*8, mr*8);
  // Moon body
  cx.globalAlpha = 0.85;
  cx.fillStyle = C.moon;
  cx.beginPath(); cx.arc(mx, my, mr, 0, Math.PI*2); cx.fill();
  // Craters
  cx.globalAlpha = 0.1; cx.fillStyle = '#c0b890';
  cx.beginPath(); cx.arc(mx - 10, my - 8, 8, 0, Math.PI*2); cx.fill();
  cx.beginPath(); cx.arc(mx + 12, my + 5, 5, 0, Math.PI*2); cx.fill();
  cx.beginPath(); cx.arc(mx - 5, my + 12, 6, 0, Math.PI*2); cx.fill();
  cx.beginPath(); cx.arc(mx + 5, my - 14, 4, 0, Math.PI*2); cx.fill();
  // Moonlight haze
  cx.globalAlpha = 0.03 + Math.sin(t * 0.5) * 0.01;
  const haze = cx.createRadialGradient(mx, my, mr, mx, my, mr * 6);
  haze.addColorStop(0, 'rgba(240,232,192,0.15)');
  haze.addColorStop(1, 'rgba(240,232,192,0)');
  cx.fillStyle = haze; cx.fillRect(0, 0, W, H);
  cx.restore();
}

// ═══════════════════════════════════════════════════
// INPUT
// ═══════════════════════════════════════════════════

const keys = new Set<string>();
const kDown = new Set<string>();
let moveJoy = {x:0,y:0};
let tap = false;
let tapPos = {x:0,y:0};
let moveTouch: {id:number,sx:number,sy:number,cx:number,cy:number}|null = null;

function canvasPos(cx:number,cy:number){const r=canvas.getBoundingClientRect();return{x:(cx-r.left)*W/r.width,y:(cy-r.top)*H/r.height}}

window.addEventListener('keydown',e=>{if(!keys.has(e.code))kDown.add(e.code);keys.add(e.code)});
window.addEventListener('keyup',e=>keys.delete(e.code));

canvas.addEventListener('touchstart',e=>{
  e.preventDefault();
  initAudio();
  for(const t of e.changedTouches){
    const p=canvasPos(t.clientX,t.clientY);
    if(state==='playing'||state==='paused'){
      if(!moveTouch){moveTouch={id:t.identifier,sx:p.x,sy:p.y,cx:p.x,cy:p.y}}
      else{tap=true;tapPos=p}
    }else{
      tap=true;tapPos=p;
    }
  }
},{passive:false});

canvas.addEventListener('touchmove',e=>{
  e.preventDefault();
  for(const t of e.changedTouches){
    if(moveTouch&&t.identifier===moveTouch.id){
      const p=canvasPos(t.clientX,t.clientY);
      moveTouch.cx=p.x;moveTouch.cy=p.y;
      const dx=p.x-moveTouch.sx,dy=p.y-moveTouch.sy;
      const d=Math.sqrt(dx*dx+dy*dy);
      const md=50;
      if(d>8){const c=Math.min(d,md);moveJoy={x:dx/d*(c/md),y:dy/d*(c/md)}}
      else moveJoy={x:0,y:0};
    }
  }
},{passive:false});

canvas.addEventListener('touchend',e=>{
  e.preventDefault();
  for(const t of e.changedTouches){
    if(moveTouch&&t.identifier===moveTouch.id){
      moveTouch=null;moveJoy={x:0,y:0};
    }
  }
},{passive:false});

let mousePos = {x:W/2,y:H/2};
let mouseDown = false;
canvas.addEventListener('mousedown',e=>{mouseDown=true;initAudio();const p=canvasPos(e.clientX,e.clientY);mousePos=p;tap=true;tapPos=p});
canvas.addEventListener('mousemove',e=>{mousePos=canvasPos(e.clientX,e.clientY)});
canvas.addEventListener('mouseup',()=>{mouseDown=false});

function getMoveDir():{x:number,y:number}{
  if(Math.abs(moveJoy.x)>0.15||Math.abs(moveJoy.y)>0.15)return moveJoy;
  let x=0,y=0;
  if(keys.has('KeyW')||keys.has('ArrowUp'))y=-1;
  if(keys.has('KeyS')||keys.has('ArrowDown'))y=1;
  if(keys.has('KeyA')||keys.has('ArrowLeft'))x=-1;
  if(keys.has('KeyD')||keys.has('ArrowRight'))x=1;
  const l=Math.sqrt(x*x+y*y);return l>0?{x:x/l,y:y/l}:{x:0,y:0};
}

// ═══════════════════════════════════════════════════
// AUDIO ENGINE
// ═══════════════════════════════════════════════════

let au: AudioContext|null = null;
let masterGain: GainNode|null = null;
function initAudio(){
  if(au)return;
  au=new AudioContext();
  if(au.state==='suspended')au.resume();
  masterGain=au.createGain();
  masterGain.gain.value=0.7;
  masterGain.connect(au.destination);
  startBGM();
}
document.addEventListener('touchstart',initAudio,{once:true});
document.addEventListener('click',initAudio,{once:true});
document.addEventListener('keydown',initAudio,{once:true});

function getMaster():AudioNode{return masterGain||au!.destination}

function tone(f:number,dur:number,type:OscillatorType='sine',vol=0.1,delay=0){
  if(!au)return;
  const t0=au.currentTime+delay;
  const o=au.createOscillator(),g=au.createGain();
  o.type=type;o.frequency.value=f;
  g.gain.setValueAtTime(vol,t0);
  g.gain.exponentialRampToValueAtTime(0.001,t0+dur);
  o.connect(g);g.connect(getMaster());o.start(t0);o.stop(t0+dur);
}

// Frequency sweep oscillator
function sweep(f0:number,f1:number,dur:number,type:OscillatorType='sine',vol=0.15,delay=0){
  if(!au)return;
  const t0=au.currentTime+delay;
  const o=au.createOscillator(),g=au.createGain();
  o.type=type;o.frequency.setValueAtTime(f0,t0);o.frequency.exponentialRampToValueAtTime(Math.max(f1,20),t0+dur);
  g.gain.setValueAtTime(vol,t0);g.gain.exponentialRampToValueAtTime(0.001,t0+dur);
  o.connect(g);g.connect(getMaster());o.start(t0);o.stop(t0+dur);
}

// Filtered noise burst (lowpass/highpass)
function noiseBurst(dur:number,vol=0.12,freqCut=2000,type:'lowpass'|'highpass'|'bandpass'='lowpass',delay=0){
  if(!au)return;
  const t0=au.currentTime+delay;
  const buf=au.createBuffer(1,Math.ceil(au.sampleRate*dur),au.sampleRate);
  const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  const s=au.createBufferSource(),g=au.createGain(),flt=au.createBiquadFilter();
  s.buffer=buf;flt.type=type;flt.frequency.value=freqCut;flt.Q.value=1.0;
  g.gain.setValueAtTime(vol,t0);g.gain.exponentialRampToValueAtTime(0.001,t0+dur);
  s.connect(flt);flt.connect(g);g.connect(getMaster());s.start(t0);s.stop(t0+dur);
}

// Noise (unfiltered, for backward compat)
function noise(dur:number,vol=0.08){
  if(!au)return;
  const buf=au.createBuffer(1,Math.ceil(au.sampleRate*dur),au.sampleRate);
  const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1);
  const s=au.createBufferSource(),g=au.createGain();
  s.buffer=buf;g.gain.setValueAtTime(vol,au.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001,au.currentTime+dur);
  s.connect(g);g.connect(getMaster());s.start();
}

// Sub-bass thud (sine with fast decay)
function subBass(f:number,dur:number,vol=0.2,delay=0){
  if(!au)return;
  const t0=au.currentTime+delay;
  const o=au.createOscillator(),g=au.createGain();
  o.type='sine';o.frequency.setValueAtTime(f,t0);o.frequency.exponentialRampToValueAtTime(20,t0+dur);
  // Attack: quick punch then decay
  g.gain.setValueAtTime(0.001,t0);g.gain.linearRampToValueAtTime(vol,t0+0.008);
  g.gain.exponentialRampToValueAtTime(0.001,t0+dur);
  o.connect(g);g.connect(getMaster());o.start(t0);o.stop(t0+dur);
}

// Distorted tone (waveshaper)
function distTone(f:number,dur:number,type:OscillatorType='sawtooth',vol=0.12,distAmt=20,delay=0){
  if(!au)return;
  const t0=au.currentTime+delay;
  const o=au.createOscillator(),g=au.createGain(),ws=au.createWaveShaper();
  o.type=type;o.frequency.value=f;
  const curve=new Float32Array(256);
  for(let i=0;i<256;i++){const x=i*2/255-1;curve[i]=((Math.PI+distAmt)*x/(Math.PI+distAmt*Math.abs(x)))}
  ws.curve=curve;ws.oversample='2x';
  g.gain.setValueAtTime(vol,t0);g.gain.exponentialRampToValueAtTime(0.001,t0+dur);
  o.connect(ws);ws.connect(g);g.connect(getMaster());o.start(t0);o.stop(t0+dur);
}

// Procedural BGM — pentatonic water-ink ambient loop
let bgmInterval: number|null = null;
let bgmVol = 0.04;
function startBGM(){
  if(bgmInterval||!au)return;
  const penta = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3, 659.3]; // C pentatonic across 2 octaves
  let beatIdx = 0;
  bgmInterval = window.setInterval(()=>{
    if(!au||state==='title')return;
    const f = penta[beatIdx % penta.length];
    tone(f, 0.6, 'sine', bgmVol);
    if(beatIdx%2===0) tone(f*0.5, 0.8, 'sine', bgmVol*0.5); // bass
    if(beatIdx%4===0) tone(penta[(beatIdx+4)%penta.length], 0.4, 'triangle', bgmVol*0.6, 0.2); // harmony
    if(random()<0.3) tone(penta[floor(random()*penta.length)]*2, 0.3, 'sine', bgmVol*0.3, 0.1); // sparkle
    beatIdx++;
  }, 400);
}
function stopBGM(){if(bgmInterval){clearInterval(bgmInterval);bgmInterval=null}}

const SFX = {
  // ── UI tap: crisp click ──
  uiTap(){
    tone(1800,0.03,'square',0.08);
    tone(2400,0.02,'sine',0.06,0.01);
    noiseBurst(0.02,0.04,6000,'highpass');
  },
  // ── Game start: dramatic whoosh + rising chord ──
  gameStart(){
    noiseBurst(0.3,0.12,800,'lowpass');
    sweep(200,800,0.25,'sawtooth',0.1);
    subBass(80,0.3,0.18);
    tone(523,0.2,'sine',0.12,0.15);
    tone(659,0.2,'sine',0.1,0.22);
    tone(784,0.25,'sine',0.12,0.28);
    tone(1047,0.35,'sine',0.14,0.35);
    noiseBurst(0.15,0.06,3000,'highpass',0.1);
  },
  // ── Weapon fire: punchy snap with body ──
  shoot(){
    sweep(1200,400,0.06,'square',0.1);
    noiseBurst(0.03,0.07,4000,'highpass');
    subBass(120,0.04,0.06);
    tone(600,0.03,'triangle',0.04,0.01);
  },
  // ── Enemy hit: satisfying impact thwack ──
  hit(){
    subBass(200,0.08,0.15);
    noiseBurst(0.05,0.12,1500,'lowpass');
    sweep(800,200,0.06,'square',0.08);
    tone(300,0.04,'triangle',0.06,0.02);
  },
  // ── Enemy kill: meaty explosion pop ──
  kill(){
    subBass(150,0.15,0.2);
    noiseBurst(0.12,0.18,2000,'lowpass');
    sweep(600,100,0.12,'sawtooth',0.12);
    tone(800,0.06,'sine',0.08,0.02);
    tone(400,0.08,'triangle',0.06,0.04);
    noiseBurst(0.08,0.06,5000,'highpass',0.03);
  },
  // ── Player hit: heavy bass thud with distortion ──
  playerHit(){
    subBass(60,0.35,0.25);
    distTone(80,0.25,'sawtooth',0.15,40);
    noiseBurst(0.15,0.2,600,'lowpass');
    sweep(400,60,0.2,'square',0.1);
    noiseBurst(0.1,0.08,1200,'bandpass',0.05);
    tone(120,0.15,'triangle',0.08,0.1);
  },
  // ── Level up: triumphant ascending fanfare ──
  levelUp(){
    subBass(130,0.5,0.12);
    // Major chord arpeggio ascending
    const notes=[523,659,784,1047,1318];
    notes.forEach((f,i)=>{
      tone(f,0.22,'sine',0.14,i*0.08);
      tone(f*0.5,0.18,'triangle',0.06,i*0.08);
    });
    // Sparkle shimmer
    noiseBurst(0.3,0.06,6000,'highpass',0.2);
    tone(1568,0.4,'sine',0.1,0.4);
    sweep(2000,4000,0.15,'sine',0.05,0.45);
  },
  // ── XP/gem pickup: bright chime ──
  pickup(){
    tone(1100,0.06,'sine',0.1);
    tone(1650,0.08,'sine',0.08,0.03);
    tone(2200,0.04,'sine',0.05,0.05);
  },
  // ── Dash: whoosh ──
  dash(){
    noiseBurst(0.1,0.12,3000,'bandpass');
    sweep(800,200,0.08,'sawtooth',0.08);
    noiseBurst(0.06,0.06,6000,'highpass',0.02);
  },
  // ── Bomb: massive explosion ──
  bomb(){
    subBass(40,0.6,0.3);
    noiseBurst(0.4,0.25,800,'lowpass');
    distTone(60,0.5,'sawtooth',0.18,50);
    sweep(200,30,0.5,'square',0.12);
    noiseBurst(0.3,0.15,2000,'bandpass',0.05);
    noiseBurst(0.2,0.08,5000,'highpass',0.15);
  },
  // ── Wave start: atmospheric horn swell ──
  wave(){
    tone(220,0.4,'sine',0.08);
    tone(330,0.35,'triangle',0.06,0.1);
    tone(440,0.5,'sine',0.08,0.2);
    sweep(110,220,0.3,'sawtooth',0.04);
    noiseBurst(0.2,0.03,1000,'lowpass',0.15);
  },
  // ── Weapon evolution: epic ascending glissando ──
  evolve(){
    subBass(60,0.8,0.15);
    [523,659,784,1047,1318,1568,2093].forEach((f,i)=>{
      tone(f,0.18,'sine',0.1,i*0.07);
      tone(f*1.5,0.12,'triangle',0.04,i*0.07+0.03);
    });
    noiseBurst(0.4,0.08,6000,'highpass',0.2);
    sweep(500,3000,0.3,'sine',0.06,0.4);
    distTone(100,0.3,'sawtooth',0.06,20,0.1);
  },
  // ── Chest open: magical reveal ──
  chest(){
    tone(440,0.15,'sine',0.12);
    tone(660,0.12,'sine',0.1,0.08);
    tone(880,0.18,'sine',0.12,0.16);
    tone(1320,0.25,'sine',0.1,0.24);
    noiseBurst(0.15,0.05,5000,'highpass',0.12);
    subBass(110,0.2,0.08);
  },
  // ── Coin collect: bright metallic ring ──
  coin(){
    tone(1400,0.06,'square',0.08);
    tone(1800,0.05,'sine',0.07,0.02);
    tone(2800,0.03,'sine',0.04,0.04);
    noiseBurst(0.02,0.03,8000,'highpass',0.01);
  },
  // ── Boss roar: terrifying sub rumble + distortion ──
  bossRoar(){
    subBass(40,0.8,0.3);
    distTone(60,0.6,'sawtooth',0.2,50);
    distTone(63,0.55,'square',0.15,30,0.05);
    noiseBurst(0.5,0.18,400,'lowpass');
    sweep(300,40,0.6,'sawtooth',0.1,0.1);
    noiseBurst(0.3,0.1,1500,'bandpass',0.2);
  },
  // ── Boss drums: thunderous taiko sequence ──
  bossDrums(){
    // Hit 1
    subBass(80,0.25,0.25);noiseBurst(0.15,0.22,600,'lowpass');
    distTone(60,0.2,'square',0.12,30);
    // Hit 2
    subBass(70,0.2,0.22,0.25);noiseBurst(0.12,0.2,500,'lowpass',0.25);
    distTone(55,0.18,'square',0.1,25,0.25);
    // Hit 3 (bigger)
    subBass(60,0.3,0.28,0.5);noiseBurst(0.2,0.25,700,'lowpass',0.5);
    distTone(50,0.25,'sawtooth',0.15,40,0.5);
    // Final hit (massive)
    subBass(45,0.5,0.35,0.8);noiseBurst(0.35,0.3,800,'lowpass',0.8);
    distTone(40,0.4,'square',0.2,50,0.8);
    sweep(200,40,0.4,'sawtooth',0.1,0.8);
  },
  // ── Victory: triumphant fanfare ──
  victory(){
    subBass(130,0.8,0.15);
    [523,659,784,1047,784,1047,1318,1568].forEach((f,i)=>{
      tone(f,0.25,'sine',0.12,i*0.12);
      tone(f*0.5,0.2,'triangle',0.05,i*0.12);
    });
    noiseBurst(0.3,0.06,5000,'highpass',0.5);
    sweep(1000,3000,0.2,'sine',0.05,0.8);
    tone(2093,0.5,'sine',0.1,0.96);
  },
  // ── Death: mournful descending tones ──
  death(){
    subBass(50,0.8,0.2);
    sweep(400,60,0.6,'sawtooth',0.15);
    distTone(80,0.5,'square',0.1,30,0.15);
    tone(300,0.3,'sine',0.08,0.3);
    tone(200,0.4,'sine',0.06,0.5);
    tone(120,0.5,'triangle',0.05,0.7);
    noiseBurst(0.4,0.1,500,'lowpass',0.2);
  },
  // ── Combo streak: escalating pitch ping (called with combo count) ──
  combo(count:number){
    const baseF=600+Math.min(count,30)*40;
    tone(baseF,0.06,'sine',0.09);
    tone(baseF*1.5,0.04,'triangle',0.05,0.02);
    if(count>=10)noiseBurst(0.03,0.04,6000,'highpass',0.01);
    if(count>=25){tone(baseF*2,0.05,'sine',0.06,0.03);subBass(80,0.05,0.06)}
  },
};

// ═══════════════════════════════════════════════════
// MATH UTILS
// ═══════════════════════════════════════════════════

const {sqrt,sin,cos,atan2,PI,floor,random,min,max,abs} = Math;
const TAU = PI*2;
const rand = (a:number,b:number)=>random()*(b-a)+a;
const randInt = (a:number,b:number)=>floor(random()*(b-a+1))+a;
const pick = <T>(a:T[]):T=>a[floor(random()*a.length)];
const clamp = (v:number,lo:number,hi:number)=>max(lo,min(hi,v));
const lerp = (a:number,b:number,t:number)=>a+(b-a)*t;
const dist = (x1:number,y1:number,x2:number,y2:number)=>sqrt((x2-x1)**2+(y2-y1)**2);
const norm = (x:number,y:number)=>{const l=sqrt(x*x+y*y);return l>0?{x:x/l,y:y/l}:{x:0,y:0}};
const angle = (x1:number,y1:number,x2:number,y2:number)=>atan2(y2-y1,x2-x1);

// ═══════════════════════════════════════════════════
// PARTICLES
// ═══════════════════════════════════════════════════

interface Particle {
  x:number;y:number;vx:number;vy:number;life:number;maxLife:number;
  size:number;sizeEnd:number;color:string;shape:'circle'|'spark'|'ring'|'ink'|'text';
  rot:number;rotSpeed:number;gravity:number;drag:number;
  text?:string; // for 'text' shape particles
}
let particles: Particle[] = [];

function emit(x:number,y:number,count:number,cfg:{
  color?:string|string[],speed?:[number,number],life?:[number,number],
  size?:[number,number],sizeEnd?:number,angle?:[number,number],
  gravity?:number,drag?:number,shape?:Particle['shape'],
}={}){
  const {
    color=C.white,speed=[30,120],life=[0.2,0.6],size=[1,4],sizeEnd=0,
    angle:aRange=[0,TAU],gravity=0,drag=0.97,shape='circle'
  } = cfg;
  if(particles.length>500)particles.splice(0,particles.length-500+count);
  for(let i=0;i<count;i++){
    const a=rand(aRange[0],aRange[1]),s=rand(speed[0],speed[1]);
    const c=Array.isArray(color)?pick(color):color;
    const l=rand(life[0],life[1]);
    particles.push({
      x,y,vx:cos(a)*s,vy:sin(a)*s,life:l,maxLife:l,
      size:rand(size[0],size[1]),sizeEnd,color:c,shape,
      rot:rand(0,TAU),rotSpeed:rand(-5,5),gravity,drag,
    });
  }
}

function updateParticles(dt:number){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.vx*=p.drag;p.vy*=p.drag;p.vy+=p.gravity*dt;
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.rotSpeed*dt;p.life-=dt;
    if(p.life<=0)particles.splice(i,1);
  }
}

function drawParticles(cx:CanvasRenderingContext2D,offX:number,offY:number){
  for(const p of particles){
    const t=1-p.life/p.maxLife;
    const sz=lerp(p.size,p.sizeEnd,t);
    const alpha=p.life/p.maxLife;
    if(sz<=0||alpha<=0)continue;
    cx.save();cx.translate(p.x-offX,p.y-offY);
    cx.rotate(p.rot);cx.globalAlpha=alpha;cx.fillStyle=p.color;
    switch(p.shape){
      case'circle':cx.beginPath();cx.arc(0,0,sz,0,TAU);cx.fill();break;
      case'spark':cx.strokeStyle=p.color;cx.lineWidth=max(1,sz*0.5);cx.lineCap='round';
        cx.beginPath();cx.moveTo(-sz*1.5,0);cx.lineTo(sz*1.5,0);cx.stroke();break;
      case'ring':cx.strokeStyle=p.color;cx.lineWidth=max(0.5,sz*0.3);
        cx.beginPath();cx.arc(0,0,sz,0,TAU);cx.stroke();break;
      case'ink':cx.beginPath();
        for(let i=0;i<=8;i++){const a=(i/8)*TAU;const r=sz*(0.7+random()*0.6);
          i===0?cx.moveTo(cos(a)*r,sin(a)*r):cx.lineTo(cos(a)*r,sin(a)*r)}
        cx.closePath();cx.fill();break;
      case'text':if(p.text){
        cx.font=`900 ${floor(sz)}px "Noto Serif SC",serif`;cx.textAlign='center';cx.textBaseline='middle';
        cx.fillText(p.text,0,0);}break;
    }
    cx.restore();
  }
}

// ═══════════════════════════════════════════════════
// FLOATING TEXT
// ═══════════════════════════════════════════════════

interface FloatText {x:number;y:number;text:string;color:string;life:number;size:number;vy:number}
let floatTexts: FloatText[] = [];
function addText(x:number,y:number,text:string,color:string,size=16){
  floatTexts.push({x,y,text,color,life:0.8,size,vy:-60});
}

// ═══════════════════════════════════════════════════
// META PROGRESSION (persisted in localStorage)
// ═══════════════════════════════════════════════════

interface Meta {
  coins:number;
  totalKills:number;
  runs:number;
  bestTime:number;
  bestKills:number;
  bestLevel:number;
  // Permanent upgrades (0-5 each)
  permAtk:number;permHp:number;permSpeed:number;permMagnet:number;permCrit:number;
  // Unlocked characters
  unlockedChars:string[];
  // Leaderboard (local top 10)
  leaderboard:{name:string,kills:number,time:number,level:number,char:string,date:string}[];
  // Daily seed
  dailySeed:string;dailyBest:number;
}

// ═══════════════════════════════════════════════════
// CHARACTER SYSTEM
// ═══════════════════════════════════════════════════

interface CharDef {
  id:string;name:string;desc:string;color:string;scarfColor:string;
  hpMod:number;speedMod:number;atkMod:number;cdMod:number;
  passive:string;cost:number;
}

const CHARACTERS: CharDef[] = [
  {id:'melo',name:'麦洛',desc:'均衡型·红巾少年',color:C.paperLt,scarfColor:C.red,
    hpMod:1,speedMod:1,atkMod:1,cdMod:1,passive:'无',cost:0},
  {id:'linghu',name:'灵狐',desc:'高速高暴击·脆皮',color:C.bluePale,scarfColor:C.blueLt,
    hpMod:0.7,speedMod:1.3,atkMod:0.9,cdMod:0.85,passive:'暴击率 +15%',cost:200},
  {id:'shigui',name:'石龟',desc:'高坦·吸血',color:C.paperDk,scarfColor:C.green,
    hpMod:1.8,speedMod:0.8,atkMod:0.8,cdMod:1.1,passive:'击杀回血 2',cost:200},
  {id:'zhuque',name:'朱雀',desc:'范围爆发·火焰灵气',color:C.redLt,scarfColor:C.gold,
    hpMod:0.9,speedMod:1.1,atkMod:1.2,cdMod:1,passive:'自带灵气',cost:500},
  {id:'xuanwu',name:'玄武',desc:'极坦·反弹伤害',color:C.inkLt,scarfColor:C.purpleLt,
    hpMod:2.2,speedMod:0.65,atkMod:0.7,cdMod:1.2,passive:'受击反弹 50%',cost:500},
];

let selectedChar = 'melo';
function getChar():CharDef{return CHARACTERS.find(c=>c.id===selectedChar)||CHARACTERS[0]}

const PERM_COSTS = [50,120,250,500,1000]; // cost for levels 1-5
const PERM_NAMES:{[k:string]:{name:string,desc:string,color:string}} = {
  permAtk:{name:'锻刃',desc:'基础攻击力 +2',color:C.red},
  permHp:{name:'铁骨',desc:'基础生命 +20',color:C.green},
  permSpeed:{name:'轻功',desc:'基础移速 +8%',color:C.blueLt},
  permMagnet:{name:'引灵',desc:'基础吸取 +15',color:C.purpleLt},
  permCrit:{name:'心眼',desc:'基础暴击 +3%',color:C.gold},
};

function loadMeta():Meta{
  try{const s=localStorage.getItem('shanhai_meta');if(s){const m=JSON.parse(s);
    // Migrate old saves
    if(!m.unlockedChars)m.unlockedChars=['melo'];
    if(!m.leaderboard)m.leaderboard=[];
    if(!m.dailySeed)m.dailySeed='';
    if(m.dailyBest===undefined)m.dailyBest=0;
    if(m.bestKills===undefined)m.bestKills=0;
    if(m.bestLevel===undefined)m.bestLevel=0;
    return m;
  }}catch{}
  return{coins:0,totalKills:0,runs:0,bestTime:0,bestKills:0,bestLevel:0,
    permAtk:0,permHp:0,permSpeed:0,permMagnet:0,permCrit:0,
    unlockedChars:['melo'],leaderboard:[],dailySeed:'',dailyBest:0};
}
function saveMeta(){localStorage.setItem('shanhai_meta',JSON.stringify(meta))}
let meta = loadMeta();

// ═══════════════════════════════════════════════════
// 麦洛护照 (Melo's Passport) — Cross-game shared system
// ═══════════════════════════════════════════════════
interface MelosPassport {
  totalCoins:number;
  gamesPlayed:Record<string,number>;
  achievements:string[];
  playerName:string;
}
function loadPassport():MelosPassport{
  try{const s=localStorage.getItem('melos_passport');if(s)return JSON.parse(s);}catch{}
  return{totalCoins:0,gamesPlayed:{'百妖长夜':0,'扶摇万里':0,'石破天惊':0,'吞灵化龙':0,'问天牌局':0},achievements:[],playerName:'旅行者'};
}
function savePassport(){localStorage.setItem('melos_passport',JSON.stringify(passport))}
function updatePassport(coinsEarned:number){
  passport.totalCoins+=coinsEarned;
  passport.gamesPlayed['百妖长夜']=(passport.gamesPlayed['百妖长夜']||0)+1;
  savePassport();
}
let passport = loadPassport();

// ═══════════════════════════════════════════════════
// ENTITIES
// ═══════════════════════════════════════════════════

interface Player {
  x:number;y:number;r:number;hp:number;maxHp:number;
  speed:number;facing:number;invuln:number;animT:number;
  shootTimer:number;shootCD:number;bulletDmg:number;bulletSpeed:number;bulletPierce:number;bulletCount:number;bulletSpread:number;
  dashCD:number;dashTimer:number;isDashing:boolean;dashDur:number;
  orbitalCount:number;orbitalDmg:number;orbitalSpeed:number;orbitalR:number;
  auraR:number;auraDmg:number;auraActive:boolean;
  bombCount:number;bombCD:number;bombTimer:number;
  // Chain lightning
  chainActive:boolean;chainDmg:number;chainRange:number;chainTimer:number;
  // Stats
  xp:number;level:number;kills:number;coins:number;
  xpMagnet:number;critChance:number;critMult:number;
  hpRegen:number;regenTimer:number;
  // Upgrade tracking for evolutions
  upgradeCounts:{[k:string]:number};
  // Revive & Combo
  revivesUsed:number;
  combo:number;comboTimer:number;maxCombo:number;
  charId:string;
}

let player: Player;

function initPlayer():Player{
  const ch=getChar();
  const baseHp=floor((100+meta.permHp*20)*ch.hpMod);
  const p:Player = {
    x:0,y:0,r:12,hp:baseHp,maxHp:baseHp,
    speed:floor(130*(1+meta.permSpeed*0.08)*ch.speedMod),facing:0,invuln:0,animT:0,
    shootTimer:0.01,shootCD:0.18*ch.cdMod,bulletDmg:floor((8+meta.permAtk*2)*ch.atkMod),  // shootTimer starts near 0 so first shot fires immediately
    bulletSpeed:400,bulletPierce:0,bulletCount:1,bulletSpread:0.12,
    dashCD:0,dashTimer:0,isDashing:false,dashDur:0.15,
    orbitalCount:0,orbitalDmg:5,orbitalSpeed:3,orbitalR:50,
    auraR:0,auraDmg:0,auraActive:false,
    bombCount:0,bombCD:0,bombTimer:0,
    chainActive:false,chainDmg:0,chainRange:0,chainTimer:0,
    xp:0,level:1,kills:0,coins:0,
    xpMagnet:60+meta.permMagnet*15,critChance:0.05+meta.permCrit*0.03,critMult:2,
    hpRegen:0,regenTimer:0,
    upgradeCounts:{},
    revivesUsed:0,combo:0,comboTimer:0,maxCombo:0,
    charId:selectedChar,
  };
  // Character passives
  if(ch.id==='linghu')p.critChance+=0.15;
  if(ch.id==='zhuque'){p.auraActive=true;p.auraR=35;p.auraDmg=2}
  return p;
}

interface Bullet {x:number;y:number;vx:number;vy:number;dmg:number;pierce:number;life:number;r:number;isEvolved?:boolean}
let bullets: Bullet[] = [];

interface EnemyBullet {x:number;y:number;vx:number;vy:number;dmg:number;life:number;r:number}
let enemyBullets: EnemyBullet[] = [];

interface Enemy {
  x:number;y:number;r:number;hp:number;maxHp:number;speed:number;
  type:string;animT:number;dmg:number;hitFlash:number;
  knockX:number;knockY:number;orbitalCD:number;
  isBoss:boolean;bossPhase:number;bossTimer:number;bossAttackCD:number;
}
let enemies: Enemy[] = [];

interface Gem {x:number;y:number;value:number;animT:number;magnetized:boolean;isCoin?:boolean}
let gems: Gem[] = [];

interface Chest {x:number;y:number;animT:number;hp:number}
let chests: Chest[] = [];

// Ink decals (persistent ground stains from kills)
interface InkDecal {x:number;y:number;r:number;alpha:number;color:string;rot:number}
let decals: InkDecal[] = [];

// ═══════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════

let waveTimer = 0, waveInterval = 3, waveNum = 0, gameTimer = 0;
const GAME_DURATION = 300;
let shake = 0, shakeT = 0, freezeT = 0, slowMoT = 0, slowMoRate = 0.3, flashAlpha = 0, flashColor = C.white;
// Death slow-motion state
let deathSlowMo = 0; // countdown; when >0, game runs at 10% speed before showing death screen
let deathSlowMoPending = false; // true = waiting for slow-mo to finish before transitioning to dead
// Boss entrance animation
let bossEntranceT = 0; let bossEntranceName = ''; let bossEntranceColor = C.red;
// Victory coin particles
interface CoinParticle {x:number;y:number;vx:number;vy:number;life:number;rot:number;rotSpeed:number}
let victoryCoins: CoinParticle[] = [];
let victoryT = 0;
// Combo screen flash tracker
let comboFlashAlpha = 0;

type State = 'title'|'playing'|'levelup'|'dead'|'victory'|'paused'|'shop'|'charselect'|'revive'|'share'|'leaderboard'|'daily';
let state: State = 'title';
let prevState: State = 'title';
let titleT = 0;
let reviveTimer = 0;
const REVIVE_COST = 50; // coins to revive
let isDaily = false; // daily challenge mode
let dailyRNG: ()=>number = Math.random; // seeded RNG for daily

interface Upgrade {
  id:string;name:string;desc:string;icon:string;color:string;
  apply:(p:Player)=>void;
}
let upgradeChoices: Upgrade[] = [];

// ═══════════════════════════════════════════════════
// WEAPON EVOLUTION SYSTEM
// ═══════════════════════════════════════════════════
// When you have enough levels of two specific upgrades, they fuse into an evolved form

interface Evolution {
  id:string;name:string;desc:string;icon:string;color:string;
  req:[string,number,string,number]; // [upgradeA, minLevelA, upgradeB, minLevelB]
  apply:(p:Player)=>void;
}

const EVOLUTIONS: Evolution[] = [
  {id:'evo_inkStorm',name:'墨岚',desc:'子弹→巨大墨弹，穿透全部+范围伤害',icon:'墨',color:C.ink,
    req:['锋矢',3,'穿杨',2],
    apply:p=>{p.bulletDmg+=10;p.bulletPierce=99;p.bulletSpeed*=0.7}},
  {id:'evo_galeBarrage',name:'风暴连珠',desc:'极速连射，弹幕倾泻',icon:'暴',color:C.gold,
    req:['连珠',3,'疾风',3],
    apply:p=>{p.bulletCount+=3;p.shootCD*=0.5;p.bulletDmg=floor(p.bulletDmg*0.6)}},
  {id:'evo_thunderAura',name:'雷域',desc:'灵气+雷珠→持续范围雷击',icon:'⚡',color:C.gold,
    req:['灵气',2,'雷珠',1],
    apply:p=>{p.auraR+=40;p.auraDmg+=8;p.chainActive=true;p.chainDmg=12;p.chainRange=100}},
  {id:'evo_jadeOrbit',name:'玉环阵',desc:'环刃大幅强化，数量翻倍',icon:'玉',color:C.greenLt,
    req:['环刃',3,'灵动',2],
    apply:p=>{p.orbitalCount*=2;p.orbitalDmg+=10;p.orbitalR+=20;p.orbitalSpeed*=1.5}},
  {id:'evo_lifeForce',name:'不死金身',desc:'极限回复+护甲',icon:'仙',color:C.gold,
    req:['坚甲',3,'回春',3],
    apply:p=>{p.maxHp+=80;p.hp=p.maxHp;p.hpRegen+=6}},
];

let achievedEvolutions = new Set<string>();
let pendingEvolution: Evolution|null = null;

function checkEvolutions(){
  for(const evo of EVOLUTIONS){
    if(achievedEvolutions.has(evo.id))continue;
    const [a,aLv,b,bLv] = evo.req;
    if((player.upgradeCounts[a]||0)>=aLv && (player.upgradeCounts[b]||0)>=bLv){
      pendingEvolution=evo;
      return;
    }
  }
}

// ═══════════════════════════════════════════════════
// UPGRADE POOL
// ═══════════════════════════════════════════════════

const ALL_UPGRADES: Upgrade[] = [
  {id:'锋矢',name:'锋矢',desc:'攻击力 +4',icon:'⚔',color:C.red,apply:p=>{p.bulletDmg+=4}},
  {id:'连珠',name:'连珠',desc:'同时发射 +1',icon:'◎',color:C.gold,apply:p=>{p.bulletCount++;p.bulletSpread+=0.08}},
  {id:'穿杨',name:'穿杨',desc:'子弹穿透 +1',icon:'➤',color:C.blueLt,apply:p=>{p.bulletPierce++}},
  {id:'疾风',name:'疾风',desc:'攻速提升 15%',icon:'风',color:C.greenLt,apply:p=>{p.shootCD*=0.85}},
  {id:'弹速',name:'弹速',desc:'弹速 +30%',icon:'→',color:C.bluePale,apply:p=>{p.bulletSpeed*=1.3}},
  {id:'灵动',name:'灵动',desc:'移速 +15%',icon:'足',color:C.green,apply:p=>{p.speed*=1.15}},
  {id:'坚甲',name:'坚甲',desc:'最大生命 +25',icon:'盾',color:C.paperDk,apply:p=>{p.maxHp+=25;p.hp+=25}},
  {id:'回春',name:'回春',desc:'每秒回复 2 HP',icon:'✚',color:C.red,apply:p=>{p.hpRegen+=2}},
  {id:'会心',name:'会心',desc:'暴击率 +8%',icon:'★',color:C.gold,apply:p=>{p.critChance+=0.08}},
  {id:'暴伤',name:'暴伤',desc:'暴击伤害 +50%',icon:'✧',color:C.goldLt,apply:p=>{p.critMult+=0.5}},
  {id:'吸星',name:'吸星',desc:'经验吸取范围 +40',icon:'磁',color:C.purpleLt,apply:p=>{p.xpMagnet+=40}},
  {id:'环刃',name:'环刃',desc:'获得/+1 环绕飞刃',icon:'◯',color:C.blueLt,apply:p=>{p.orbitalCount++;p.orbitalR+=8}},
  {id:'灵气',name:'灵气',desc:'获得/扩大灵气场',icon:'气',color:C.purpleLt,apply:p=>{if(!p.auraActive){p.auraActive=true;p.auraR=40;p.auraDmg=3}else{p.auraR+=15;p.auraDmg+=2}}},
  {id:'雷珠',name:'雷珠',desc:'获得/+1 炸弹(每10秒)',icon:'雷',color:C.gold,apply:p=>{p.bombCount++;p.bombCD=10;p.bombTimer=0}},
];

function getUpgradeChoices():Upgrade[]{
  // Check for pending evolution first
  if(pendingEvolution){
    return [{
      id:pendingEvolution.id,name:pendingEvolution.name,desc:pendingEvolution.desc,
      icon:pendingEvolution.icon,color:pendingEvolution.color,
      apply:p=>{pendingEvolution!.apply(p);achievedEvolutions.add(pendingEvolution!.id);
        SFX.evolve();doShake(8,0.4);doFlash(C.gold,0.5);
        emit(p.x,p.y,50,{color:[C.gold,C.white,C.red],speed:[100,300],life:[0.5,1.2],size:[3,8],shape:'spark'});
        addText(p.x,p.y-40,`${pendingEvolution!.name} 觉醒!`,C.gold,26);
        pendingEvolution=null;
      }
    }];
  }
  const pool = [...ALL_UPGRADES];
  const choices:Upgrade[]=[];
  for(let i=0;i<3&&pool.length>0;i++){
    const idx=randInt(0,pool.length-1);
    choices.push(pool.splice(idx,1)[0]);
  }
  return choices;
}

// ═══════════════════════════════════════════════════
// ENEMY DEFINITIONS & BOSS PATTERNS
// ═══════════════════════════════════════════════════

const ENEMY_CHARS:{[k:string]:string} = {hunDun:'混',biFang:'毕',taoTie:'饕',jiuWei:'九',yaksha:'夜'};
const ENEMY_NAMES:{[k:string]:string} = {hunDun:'混沌',biFang:'毕方',taoTie:'饕餮',jiuWei:'九尾',yaksha:'夜叉'};
const ENEMY_DEFS:{[k:string]:{hp:number;speed:number;dmg:number;r:number;color:string;bodyColor:string}} = {
  hunDun: {hp:15,speed:35,dmg:8,r:10,color:C.inkLt,bodyColor:C.ink},
  biFang: {hp:10,speed:55,dmg:6,r:8,color:C.red,bodyColor:C.redDk},
  taoTie: {hp:40,speed:20,dmg:15,r:16,color:C.goldDk,bodyColor:C.gold},
  jiuWei: {hp:25,speed:45,dmg:12,r:12,color:C.blueLt,bodyColor:C.blue},
  yaksha: {hp:8,speed:65,dmg:5,r:7,color:C.greenLt,bodyColor:C.green},
};

function spawnEnemy(type:string,x:number,y:number,scale:number,boss=false){
  const d=ENEMY_DEFS[type]||ENEMY_DEFS.hunDun;
  const bossScale=boss?4:1;
  enemies.push({
    x,y,r:d.r*bossScale,hp:floor(d.hp*scale*bossScale*bossScale),maxHp:floor(d.hp*scale*bossScale*bossScale),
    speed:d.speed*(boss?0.6:0.9+random()*0.2),type,animT:random()*10,
    dmg:floor(d.dmg*scale*(boss?2:1)),hitFlash:0,knockX:0,knockY:0,orbitalCD:0,
    isBoss:boss,bossPhase:0,bossTimer:0,bossAttackCD:boss?2:0,
  });
}

// Homing enemy bullet type
interface HomingBullet {x:number;y:number;vx:number;vy:number;dmg:number;life:number;r:number;homing:boolean;trail:number}
let homingBullets: HomingBullet[] = [];

function bossAttack(e:Enemy){
  const a=angle(e.x,e.y,player.x,player.y);
  const enraged=e.bossTimer>20; // Boss enrage after 20s
  const phase=e.bossPhase%5; // 5 patterns now
  switch(phase){
    case 0: // Ring of bullets
      for(let i=0;i<(enraged?16:12);i++){
        const ba=i/(enraged?16:12)*TAU;
        enemyBullets.push({x:e.x,y:e.y,vx:cos(ba)*120,vy:sin(ba)*120,dmg:e.dmg,life:3,r:4});
      }
      break;
    case 1: // Triple aimed shot
      for(let i=-1;i<=1;i++){
        const ba=a+i*0.25;
        enemyBullets.push({x:e.x,y:e.y,vx:cos(ba)*180,vy:sin(ba)*180,dmg:floor(e.dmg*1.5),life:2.5,r:5});
      }
      break;
    case 2: // Spiral burst
      for(let i=0;i<8;i++){
        const ba=a+i/8*TAU+e.bossTimer;
        enemyBullets.push({x:e.x,y:e.y,vx:cos(ba)*100,vy:sin(ba)*100,dmg:e.dmg,life:2,r:3});
      }
      break;
    case 3: // Cross pattern: 4 streams in + shape that rotate
      {const rotBase=e.bossTimer*0.5;
      for(let arm=0;arm<4;arm++){
        const armA=arm*PI/2+rotBase;
        for(let j=0;j<(enraged?4:3);j++){
          const spd=100+j*30;
          enemyBullets.push({x:e.x,y:e.y,vx:cos(armA)*spd,vy:sin(armA)*spd,dmg:e.dmg,life:2.5,r:3});
        }
      }}
      break;
    case 4: // Homing orbs: 4 slow-moving homing projectiles with trails
      for(let i=0;i<4;i++){
        const ba=a+i*PI/2;
        homingBullets.push({x:e.x,y:e.y,vx:cos(ba)*60,vy:sin(ba)*60,dmg:floor(e.dmg*1.2),life:4,r:6,homing:true,trail:0});
      }
      break;
  }
  e.bossPhase++;
  doShake(3,0.15);
  emit(e.x,e.y,8,{color:[C.red,C.gold],speed:[40,100],life:[0.1,0.3],size:[2,5],shape:'ink'});
}

function spawnWave(){
  waveNum++;
  const scale = 1 + (gameTimer/GAME_DURATION)*2.5;
  const count = min(35, 8 + waveNum*2);
  const types = gameTimer<60?['hunDun','yaksha']
    :gameTimer<120?['hunDun','biFang','yaksha']
    :gameTimer<180?['hunDun','biFang','taoTie','yaksha']
    :['hunDun','biFang','taoTie','jiuWei','yaksha'];

  for(let i=0;i<count;i++){
    const a=rand(0,TAU);
    // First 3 waves: spawn enemies closer so action starts immediately
    const dMin=waveNum<=3?150:350, dMax=waveNum<=3?300:500;
    const d=rand(dMin,dMax);
    spawnEnemy(pick(types),player.x+cos(a)*d,player.y+sin(a)*d,scale);
  }

  // Boss every 8 waves
  if(waveNum%8===0){
    const bossType=pick(['taoTie','jiuWei','hunDun']);
    const a=rand(0,TAU);
    spawnEnemy(bossType,player.x+cos(a)*400,player.y+sin(a)*400,scale,true);
    SFX.bossRoar();SFX.bossDrums();doShake(6,0.4);
    // Boss entrance: full-screen ink splash + name in calligraphy
    bossEntranceT=1.0;
    bossEntranceName=ENEMY_NAMES[bossType]||'妖王';
    bossEntranceColor=ENEMY_DEFS[bossType]?.color||C.red;
    addText(player.x,player.y-60,'妖王降临!',C.red,28);
    flashAlpha=0.3;flashColor=C.ink;
  }

  // Treasure chest every 5 waves
  if(waveNum%5===0){
    const a=rand(0,TAU),d=rand(100,250);
    chests.push({x:player.x+cos(a)*d,y:player.y+sin(a)*d,animT:0,hp:3});
  }

  waveInterval=max(1.5, 3 - gameTimer*0.005);
}

// ═══════════════════════════════════════════════════
// GAME LOGIC
// ═══════════════════════════════════════════════════

function startGame(){
  player=initPlayer();
  bullets=[];enemies=[];gems=[];particles=[];floatTexts=[];
  enemyBullets=[];homingBullets=[];chests=[];decals=[];achievedEvolutions.clear();pendingEvolution=null;
  waveTimer=0;waveNum=0;waveInterval=2;gameTimer=0;
  shake=0;shakeT=0;freezeT=0;slowMoT=0;slowMoRate=0.3;flashAlpha=0;
  deathSlowMo=0;deathSlowMoPending=false;bossEntranceT=0;comboFlashAlpha=0;victoryCoins=[];victoryT=0;
  state='playing';player.invuln=1.5;
  meta.runs++;saveMeta();
  Poki.gameplayStart();
  // Tutorial hint for first run
  if(meta.runs<=2){
    addText(0,30,'WASD移动 · 自动攻击',C.ink,16);
    addText(0,55,'Shift闪避 · 升级选技能',C.inkLt,13);
  }
}

function xpToLevel(level:number):number{
  // Lower XP for first few levels so first upgrade comes fast
  if(level<=1)return 5;
  if(level<=2)return 7;
  if(level<=3)return 9;
  return 8+level*4;
}

function checkLevelUp(){
  const needed=xpToLevel(player.level);
  if(player.xp>=needed){
    player.xp-=needed;player.level++;
    checkEvolutions();
    upgradeChoices=getUpgradeChoices();
    state='levelup';
    SFX.levelUp();
    emit(player.x,player.y,30,{color:[C.gold,C.goldLt,C.white],speed:[80,200],life:[0.5,1],size:[2,6],shape:'spark'});
    flashAlpha=0.3;flashColor=C.gold;
  }
}

function applyUpgrade(idx:number){
  if(idx>=0&&idx<upgradeChoices.length){
    SFX.uiTap();
    const u=upgradeChoices[idx];
    u.apply(player);
    player.upgradeCounts[u.id]=(player.upgradeCounts[u.id]||0)+1;
    state='playing';
  }
}

function doShake(amount:number,dur:number){shake=amount;shakeT=dur}
function doFreeze(dur:number){freezeT=dur}
function doFlash(color:string,alpha:number){flashColor=color;flashAlpha=alpha}

function shootBullets(){
  const dir=player.facing;const count=player.bulletCount;
  const spread=player.bulletSpread;
  const startAngle=dir-spread*(count-1)/2;
  const evolved=achievedEvolutions.has('evo_inkStorm');
  for(let i=0;i<count;i++){
    const a=startAngle+spread*i+rand(-0.03,0.03);
    bullets.push({
      x:player.x+cos(a)*player.r,y:player.y+sin(a)*player.r,
      vx:cos(a)*player.bulletSpeed,vy:sin(a)*player.bulletSpeed,
      dmg:player.bulletDmg,pierce:player.bulletPierce,life:evolved?1.2:0.8,r:evolved?6:3,
      isEvolved:evolved,
    });
  }
  SFX.shoot();
  emit(player.x+cos(dir)*15,player.y+sin(dir)*15,4,{
    color:[C.gold,C.white],speed:[40,100],life:[0.05,0.15],size:[1,3],
    angle:[dir-0.5,dir+0.5],shape:'spark',
  });
}

function doBomb(bx:number,by:number){
  SFX.bomb();doShake(8,0.3);doFlash(C.white,0.4);
  const bombR=120;
  for(const e of enemies){
    if(dist(bx,by,e.x,e.y)<bombR){
      const dmg=30+player.level*5;
      damageEnemy(e,dmg);
      const n=norm(e.x-bx,e.y-by);
      e.knockX+=n.x*200;e.knockY+=n.y*200;
    }
  }
  emit(bx,by,40,{color:[C.ink,C.inkLt,C.red],speed:[100,300],life:[0.3,0.8],size:[3,10],shape:'ink',gravity:100});
  emit(bx,by,20,{color:[C.gold,C.white],speed:[50,200],life:[0.2,0.5],size:[2,5],shape:'spark'});
  emit(bx,by,3,{color:[C.white],speed:[0,5],life:[0.3,0.5],size:[30,60],sizeEnd:120,shape:'ring',drag:1});
}

function damageEnemy(e:Enemy,dmg:number){
  const isCrit=random()<player.critChance;
  const finalDmg=isCrit?floor(dmg*player.critMult):dmg;
  e.hp-=finalDmg;e.hitFlash=0.1;
  addText(e.x+rand(-10,10),e.y-e.r-5,isCrit?`${finalDmg}!`:`${finalDmg}`,isCrit?C.gold:C.white,isCrit?20:14);
  emit(e.x,e.y,isCrit?8:3,{color:[C.ink,C.red],speed:[30,80],life:[0.1,0.3],size:[1,3],shape:'ink'});
  if(e.hp<=0)killEnemy(e);
}

function doChainLightning(fromX:number,fromY:number,remaining:number){
  if(remaining<=0||!player.chainActive)return;
  let nearest:Enemy|null=null,nd=Infinity;
  for(const e of enemies){
    if(e.hp<=0)continue;
    const d=dist(fromX,fromY,e.x,e.y);
    if(d<player.chainRange&&d<nd){nd=d;nearest=e}
  }
  if(nearest){
    damageEnemy(nearest,player.chainDmg);
    // Visual lightning line
    emit(fromX+(nearest.x-fromX)*0.5,fromY+(nearest.y-fromY)*0.5,3,{
      color:[C.gold,C.white],speed:[10,30],life:[0.05,0.15],size:[1,2],shape:'spark'});
    doChainLightning(nearest.x,nearest.y,remaining-1);
  }
}

function killEnemy(e:Enemy){
  e.hp=0;player.kills++;
  // Combo system
  player.combo++;player.comboTimer=2;
  if(player.combo>player.maxCombo)player.maxCombo=player.combo;
  // Combo escalating pitch sound
  if(player.combo>=3)SFX.combo(player.combo);
  // Combo milestones with screen flash
  if(player.combo===50){
    addText(player.x,player.y-40,`${player.combo} 连斩!!`,C.red,28);
    comboFlashAlpha=0.4;doShake(6,0.3);SFX.evolve();
    emit(player.x,player.y,30,{color:[C.red,C.gold,C.white],speed:[80,250],life:[0.4,0.8],size:[3,7],shape:'spark'});
  } else if(player.combo===25){
    addText(player.x,player.y-40,`${player.combo} 连斩!`,C.gold,26);
    comboFlashAlpha=0.3;doShake(4,0.2);SFX.chest();
    emit(player.x,player.y,20,{color:[C.gold,C.white],speed:[60,200],life:[0.3,0.7],size:[2,6],shape:'spark'});
  } else if(player.combo===10){
    addText(player.x,player.y-35,`${player.combo} 连!`,C.goldLt,20);
    comboFlashAlpha=0.2;SFX.chest();
    emit(player.x,player.y,15,{color:[C.gold,C.white],speed:[60,180],life:[0.3,0.6],size:[2,5],shape:'spark'});
  } else if(player.combo%25===0&&player.combo>50){
    addText(player.x,player.y-40,`${player.combo} 连斩!`,C.red,26);
    comboFlashAlpha=0.3;SFX.chest();
    emit(player.x,player.y,20,{color:[C.red,C.gold,C.white],speed:[60,200],life:[0.3,0.7],size:[2,6],shape:'spark'});
  }
  // Stone turtle (shigui) passive: heal on kill
  if(player.charId==='shigui')player.hp=min(player.maxHp,player.hp+2);
  // Kill milestones
  if(player.kills%100===0&&player.kills>0){
    const bonus=floor(player.kills/10);
    player.coins+=bonus;addText(player.x,player.y-50,`${player.kills}斩! +${bonus}金`,C.gold,22);
    SFX.chest();doFlash(C.gold,0.2);
    emit(player.x,player.y,25,{color:[C.gold,C.white],speed:[60,200],life:[0.4,0.8],size:[2,6],shape:'spark'});
  }
  // Ink decal on ground — bigger splatter (doubled)
  const decalColor=ENEMY_DEFS[e.type]?.color||C.ink;
  decals.push({x:e.x,y:e.y,r:e.r*(e.isBoss?6:3)+rand(4,12),alpha:0.1,color:decalColor,rot:rand(0,TAU)});
  if(decals.length>80)decals.shift();
  const value = e.isBoss?20:e.maxHp>=30?5:e.maxHp>=15?3:1;
  gems.push({x:e.x,y:e.y,value,animT:0,magnetized:false});
  // Drop coins
  const coinChance=e.isBoss?1:0.15;
  if(random()<coinChance){
    const cv=e.isBoss?randInt(5,15):randInt(1,3);
    gems.push({x:e.x+rand(-10,10),y:e.y+rand(-10,10),value:cv,animT:0,magnetized:false,isCoin:true});
  }
  // Bigger ink splatter (doubled particle count)
  emit(e.x,e.y,e.isBoss?60:30,{color:[C.ink,C.inkLt,ENEMY_DEFS[e.type]?.color||C.ink],
    speed:[50,e.isBoss?300:220],life:[0.3,0.8],size:[3,e.isBoss?14:10],shape:'ink',gravity:80});
  emit(e.x,e.y,8,{color:[C.white],speed:[20,60],life:[0.1,0.3],size:[1,3],shape:'spark'});
  // Enemy type character floats up from corpse in ink-brush style
  const typeChar=ENEMY_CHARS[e.type];
  if(typeChar){
    const tSize=e.isBoss?40:22;
    particles.push({x:e.x,y:e.y,vx:rand(-5,5),vy:-50,life:1.2,maxLife:1.2,
      size:tSize,sizeEnd:tSize*1.3,color:decalColor,shape:'text',text:typeChar,
      rot:rand(-0.15,0.15),rotSpeed:0,gravity:-10,drag:0.97});
  }
  SFX.kill();
  // Freeze frames: 20ms on normal kills, 100ms on boss kills
  doShake(e.isBoss?8:2,e.isBoss?0.3:0.06);doFreeze(e.isBoss?0.1:0.02);
  if(e.isBoss){
    doFlash(C.gold,0.4);slowMoT=0.5;slowMoRate=0.3;
    addText(e.x,e.y-30,'妖王已诛!',C.gold,24);
  }
  // Time dilation on last enemy of each wave
  const aliveEnemies=enemies.filter(en=>en!==e&&en.hp>0).length;
  if(aliveEnemies===0&&waveNum>0){
    slowMoT=0.5;slowMoRate=0.3;
  }
  // Chain lightning on kill
  if(player.chainActive)doChainLightning(e.x,e.y,3);
  checkLevelUp();
}

function updatePlayer(dt:number){
  player.animT+=dt;
  player.invuln=max(0,player.invuln-dt);
  // Combo decay
  if(player.combo>0){player.comboTimer-=dt;if(player.comboTimer<=0){player.combo=0}}
  // HP regen
  if(player.hpRegen>0){player.regenTimer+=dt;
    if(player.regenTimer>=1){player.regenTimer-=1;player.hp=min(player.maxHp,player.hp+player.hpRegen)}}
  // Dash
  if(player.dashCD>0)player.dashCD-=dt;
  if(player.isDashing){player.dashTimer-=dt;if(player.dashTimer<=0)player.isDashing=false}
  if((keys.has('ShiftLeft')||keys.has('ShiftRight')||keys.has('KeyK'))&&player.dashCD<=0&&!player.isDashing){
    const md=getMoveDir();
    if(md.x!==0||md.y!==0){
      player.isDashing=true;player.dashTimer=player.dashDur;player.dashCD=0.8;player.invuln=0.2;
      SFX.dash();
      emit(player.x,player.y,10,{color:[C.blueLt,C.white],speed:[40,120],life:[0.1,0.3],size:[1,4],shape:'spark',
        angle:[player.facing+PI-0.5,player.facing+PI+0.5]});
    }
  }
  // Movement
  const md=getMoveDir();const spd=player.isDashing?player.speed*3:player.speed;
  if(md.x!==0||md.y!==0){
    player.x+=md.x*spd*dt;player.y+=md.y*spd*dt;
    player.facing=atan2(md.y,md.x);
    if(random()<0.3)emit(player.x-md.x*8+rand(-3,3),player.y-md.y*8+rand(-3,3),1,{
      color:player.isDashing?C.blueLt:C.inkFaint,speed:[2,8],life:[0.15,0.35],size:[1,2.5],sizeEnd:0,shape:'ink',drag:0.95});
    // Ink trail particles when moving fast (speed > 80% of max)
    if(spd>player.speed*0.8&&random()<0.5){
      emit(player.x-md.x*6+rand(-4,4),player.y-md.y*6+rand(-4,4),2,{
        color:[C.ink,C.inkLt,C.inkFaint],speed:[5,20],life:[0.2,0.5],size:[1.5,4],sizeEnd:0,shape:'ink',drag:0.92,gravity:15});
    }
  }
  // Aim: mouse manual > auto-aim nearest enemy (joystick = move only)
  if(!moveTouch&&mouseDown){
    player.facing=angle(player.x,player.y,mousePos.x+player.x-W/2,mousePos.y+player.y-H/2);
  } else if(enemies.length>0){
    let nearest:Enemy|null=null,nd=Infinity;
    for(const e of enemies){const d=dist(player.x,player.y,e.x,e.y);if(d<nd){nd=d;nearest=e}}
    if(nearest)player.facing=angle(player.x,player.y,nearest.x,nearest.y);
  }
  // Arena bounds
  const d=dist(0,0,player.x,player.y);
  if(d>ARENA_R){const n=norm(player.x,player.y);player.x=n.x*ARENA_R;player.y=n.y*ARENA_R}
  // Auto-shoot
  player.shootTimer-=dt;
  if(player.shootTimer<=0){player.shootTimer=player.shootCD;shootBullets()}
  // Bomb
  if(player.bombCount>0){
    player.bombTimer+=dt;
    if(player.bombTimer>=player.bombCD){
      player.bombTimer=0;
      let bestX=player.x,bestY=player.y,bestCount=0;
      for(const e of enemies){let c=0;for(const e2 of enemies)if(dist(e.x,e.y,e2.x,e2.y)<120)c++;
        if(c>bestCount){bestCount=c;bestX=e.x;bestY=e.y}}
      for(let i=0;i<player.bombCount;i++)doBomb(bestX+rand(-30,30),bestY+rand(-30,30));
    }
  }
  // Chain lightning periodic
  if(player.chainActive){
    player.chainTimer+=dt;
    if(player.chainTimer>=0.8){player.chainTimer=0;doChainLightning(player.x,player.y,5)}
  }
}

function updateBullets(dt:number){
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
    if(b.life<=0){bullets.splice(i,1);continue}
    for(const e of enemies){
      if(e.hp<=0)continue;
      if(dist(b.x,b.y,e.x,e.y)<b.r+e.r){
        damageEnemy(e,b.dmg);
        const n=norm(b.vx,b.vy);e.knockX+=n.x*40;e.knockY+=n.y*40;
        // Evolved bullets do AOE
        if(b.isEvolved){
          for(const e2 of enemies){
            if(e2!==e&&e2.hp>0&&dist(b.x,b.y,e2.x,e2.y)<40)
              damageEnemy(e2,floor(b.dmg*0.5));
          }
          emit(b.x,b.y,6,{color:[C.ink,C.inkLt],speed:[30,80],life:[0.1,0.25],size:[3,6],shape:'ink'});
        }
        if(b.pierce>0){b.pierce--;b.dmg=floor(b.dmg*0.7)}else{bullets.splice(i,1)}
        break;
      }
    }
  }
}

function updateEnemyBullets(dt:number){
  for(let i=enemyBullets.length-1;i>=0;i--){
    const b=enemyBullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
    if(b.life<=0){enemyBullets.splice(i,1);continue}
    if(player.invuln<=0&&dist(b.x,b.y,player.x,player.y)<b.r+player.r){
      player.hp-=b.dmg;player.invuln=0.3;
      SFX.playerHit();doShake(4,0.15);doFlash(C.red,0.2);
      addText(player.x,player.y-25,`-${b.dmg}`,C.red,18);
      emit(player.x,player.y,6,{color:[C.red],speed:[30,80],life:[0.1,0.3],size:[1,3],shape:'ink'});
      enemyBullets.splice(i,1);
      if(player.hp<=0){player.hp=0;
        if(player.revivesUsed<1&&meta.coins>=REVIVE_COST){state='revive';reviveTimer=5}
        else{// Death slow-motion: slow to 10% for 1.5s before showing death screen
          deathSlowMo=1.5;deathSlowMoPending=true;
          SFX.death();
          emit(player.x,player.y,50,{color:[C.ink,C.red,C.white],speed:[60,250],life:[0.3,1],size:[2,8],shape:'ink',gravity:60});
          doShake(10,0.5);doFlash(C.red,0.5);}
      }
    }
  }
}

function updateEnemies(dt:number){
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i];
    if(e.hp<=0){enemies.splice(i,1);continue}
    e.animT+=dt;e.hitFlash=max(0,e.hitFlash-dt);
    if(e.orbitalCD>0)e.orbitalCD-=dt;
    // Boss attacks
    if(e.isBoss){
      e.bossTimer+=dt;e.bossAttackCD-=dt;
      const enraged=e.bossTimer>20;
      // Enrage: attack speed doubles
      const atkInterval=enraged?(1+random()*0.5):(2+random());
      if(e.bossAttackCD<=0){e.bossAttackCD=atkInterval;bossAttack(e)}
    }
    // Separation
    for(let j=i+1;j<enemies.length;j++){
      const e2=enemies[j];if(e2.hp<=0)continue;
      const dx=e2.x-e.x,dy=e2.y-e.y,d=sqrt(dx*dx+dy*dy),minD=e.r+e2.r;
      if(d<minD&&d>0.1){const push=(minD-d)*0.5,nx=dx/d,ny=dy/d;
        e.x-=nx*push*0.5;e.y-=ny*push*0.5;e2.x+=nx*push*0.5;e2.y+=ny*push*0.5}
    }
    // Knockback
    if(abs(e.knockX)>1||abs(e.knockY)>1){
      e.x+=e.knockX*dt*5;e.y+=e.knockY*dt*5;e.knockX*=0.85;e.knockY*=0.85;
    } else {
      const dx=player.x-e.x,dy=player.y-e.y,d=dist(0,0,dx,dy);
      if(d>e.r){e.x+=dx/d*e.speed*dt;e.y+=dy/d*e.speed*dt}
    }
    // Hit player
    if(player.invuln<=0&&dist(e.x,e.y,player.x,player.y)<e.r+player.r){
      player.hp-=e.dmg;player.invuln=0.5;
      SFX.playerHit();doShake(6,0.2);doFreeze(0.08);doFlash(C.red,0.3);
      addText(player.x,player.y-25,`-${e.dmg}`,C.red,20);
      emit(player.x,player.y,12,{color:[C.red,C.redLt],speed:[40,120],life:[0.2,0.5],size:[2,5],shape:'ink'});
      const n=norm(e.x-player.x,e.y-player.y);e.knockX+=n.x*80;e.knockY+=n.y*80;
      // Xuanwu passive: reflect 50% damage
      if(player.charId==='xuanwu'){const ref=floor(e.dmg*0.5);e.hp-=ref;e.hitFlash=0.1;
        addText(e.x,e.y-10,`反${ref}`,C.purpleLt,12);if(e.hp<=0)killEnemy(e)}
      if(player.hp<=0){player.hp=0;
        if(player.revivesUsed<1&&meta.coins>=REVIVE_COST){state='revive';reviveTimer=5}
        else{// Death slow-motion
          deathSlowMo=1.5;deathSlowMoPending=true;
          SFX.death();
          emit(player.x,player.y,50,{color:[C.ink,C.red,C.white],speed:[60,250],life:[0.3,1],size:[2,8],shape:'ink',gravity:60});
          doShake(10,0.5);doFlash(C.red,0.5);}}
    }
    // Aura
    if(player.auraActive&&dist(e.x,e.y,player.x,player.y)<player.auraR){
      e.hp-=player.auraDmg*dt;e.hitFlash=0.03;if(e.hp<=0)killEnemy(e)}
  }
  // Orbitals (with cooldown)
  if(player.orbitalCount>0){
    for(let oi=0;oi<player.orbitalCount;oi++){
      const a=player.animT*player.orbitalSpeed+oi*(TAU/player.orbitalCount);
      const ox=player.x+cos(a)*player.orbitalR,oy=player.y+sin(a)*player.orbitalR;
      for(const e of enemies){
        if(e.hp<=0||e.orbitalCD>0)continue;
        if(dist(ox,oy,e.x,e.y)<8+e.r){
          damageEnemy(e,player.orbitalDmg);e.orbitalCD=0.3;
          const n=norm(e.x-ox,e.y-oy);e.knockX+=n.x*60;e.knockY+=n.y*60}
      }
    }
  }
}

function updateGems(dt:number){
  for(let i=gems.length-1;i>=0;i--){
    const g=gems[i];g.animT+=dt;
    const d=dist(g.x,g.y,player.x,player.y);
    if(d<player.xpMagnet)g.magnetized=true;
    if(g.magnetized){const n=norm(player.x-g.x,player.y-g.y);
      const spd=300+200*(1-d/player.xpMagnet);g.x+=n.x*spd*dt;g.y+=n.y*spd*dt}
    if(d<20){
      if(g.isCoin){player.coins+=g.value;meta.coins+=g.value;SFX.coin();
        addText(g.x,g.y-10,`+${g.value}金`,C.gold,14)}
      else{player.xp+=g.value;SFX.pickup();checkLevelUp()}
      gems.splice(i,1);
    }
  }
}

function updateChests(dt:number){
  for(let i=chests.length-1;i>=0;i--){
    const ch=chests[i];ch.animT+=dt;
    // Check bullet collision
    for(let j=bullets.length-1;j>=0;j--){
      if(dist(bullets[j].x,bullets[j].y,ch.x,ch.y)<18){
        ch.hp--;bullets.splice(j,1);
        emit(ch.x,ch.y,5,{color:[C.gold,C.paper],speed:[20,60],life:[0.1,0.3],size:[1,3],shape:'spark'});
        if(ch.hp<=0){
          // Open chest: drop coins + grant a random upgrade
          SFX.chest();doFlash(C.gold,0.2);
          for(let k=0;k<5;k++){
            gems.push({x:ch.x+rand(-15,15),y:ch.y+rand(-15,15),value:randInt(2,5),animT:0,magnetized:false,isCoin:true})}
          emit(ch.x,ch.y,20,{color:[C.gold,C.goldLt,C.white],speed:[50,150],life:[0.3,0.7],size:[2,6],shape:'spark'});
          addText(ch.x,ch.y-20,'宝箱!',C.gold,20);
          chests.splice(i,1);break;
        }
      }
    }
  }
}

function promptPlayerName(){
  if(passport.playerName&&passport.playerName!=='旅行者')return;
  changePlayerName();
}
function changePlayerName(){
  const current=passport.playerName&&passport.playerName!=='旅行者'?passport.playerName:'';
  const name=window.prompt('给自己取个名字吧（其他玩家可见）',current);
  if(name&&name.trim()){
    passport.playerName=name.trim().slice(0,12);
    savePassport();
  }
}
function endRun(){
  meta.totalKills+=player.kills;
  const survived=floor(gameTimer);
  if(survived>meta.bestTime)meta.bestTime=survived;
  if(player.kills>meta.bestKills)meta.bestKills=player.kills;
  if(player.level>meta.bestLevel)meta.bestLevel=player.level;
  meta.coins+=player.coins;
  meta.runs=(meta.runs||0)+1;
  // Add to leaderboard
  const pName=passport.playerName&&passport.playerName!=='旅行者'?passport.playerName:getChar().name;
  const entry={name:pName,kills:player.kills,time:survived,level:player.level,
    char:player.charId,date:new Date().toLocaleDateString()};
  meta.leaderboard.push(entry);
  meta.leaderboard.sort((a,b)=>b.kills-a.kills);
  if(meta.leaderboard.length>10)meta.leaderboard=meta.leaderboard.slice(0,10);
  // Daily challenge
  if(isDaily&&player.kills>meta.dailyBest)meta.dailyBest=player.kills;
  saveMeta();
  updatePassport(player.coins);
  // First run: prompt for player name
  if(meta.runs===1)setTimeout(promptPlayerName,800);
}

function doRevive(){
  meta.coins-=REVIVE_COST;saveMeta();
  player.revivesUsed++;player.hp=floor(player.maxHp*0.5);player.invuln=2;
  state='playing';
  SFX.levelUp();doFlash(C.gold,0.4);
  emit(player.x,player.y,40,{color:[C.gold,C.white],speed:[80,250],life:[0.4,1],size:[2,7],shape:'spark'});
  addText(player.x,player.y-30,'复活!',C.gold,26);
  // Clear nearby enemies
  for(const e of enemies){if(dist(e.x,e.y,player.x,player.y)<100){e.knockX+=(e.x-player.x)*3;e.knockY+=(e.y-player.y)*3}}
  enemyBullets=[];
}

// Seeded RNG for daily challenges
function seededRNG(seed:string):()=>number{
  let h=0;for(let i=0;i<seed.length;i++){h=((h<<5)-h)+seed.charCodeAt(i);h|=0}
  return()=>{h=h*1103515245+12345;return(h>>>16&32767)/32768};
}

function getDailySeed():string{const d=new Date();return `shanhai_${d.getFullYear()}_${d.getMonth()}_${d.getDate()}`}

// Share screenshot — designed to be visually striking even to non-players
function generateChallengeCode(kills:number,level:number):string{
  return ((kills*97+level*31+7)>>>0).toString(36).toUpperCase().slice(-5);
}

async function shareResult(){
  const gameURL='https://shanhai.joyboy.games';
  const dispName=passport.playerName&&passport.playerName!=='旅行者'?passport.playerName:getChar().name;
  const code=generateChallengeCode(player.kills,player.level);
  const shareText=`【百妖长夜】${dispName} 斩杀 ${player.kills} 妖 · Lv.${player.level} · ${player.coins}金\n挑战码: ${code}\n来挑战我吧! 👉 ${gameURL}\n#麦洛的冒险 #百妖长夜`;
  // Try Web Share API (mobile)
  if(navigator.share){
    try{
      await navigator.share({title:'麦洛的冒险：百妖长夜',text:shareText});
      addText(W/2,H/2,'分享成功!',C.gold,22);
      return;
    }catch{}
  }
  // Fallback: copy to clipboard
  try{
    await navigator.clipboard.writeText(shareText);
    addText(W/2,H/2,'已复制!',C.gold,22);
  }catch{
    // Last resort: prompt
    window.prompt('复制以下文字分享:',shareText);
  }
}

// Poki SDK stub (replace with real SDK when deploying)
const Poki = {
  commercialBreak(){/* PokiSDK.commercialBreak() */},
  rewardedBreak():Promise<boolean>{return Promise.resolve(true)/* PokiSDK.rewardedBreak() */},
  gameplayStart(){/* PokiSDK.gameplayStart() */},
  gameplayStop(){/* PokiSDK.gameplayStop() */},
};

function updateHomingBullets(dt:number){
  for(let i=homingBullets.length-1;i>=0;i--){
    const b=homingBullets[i];
    b.life-=dt;if(b.life<=0){homingBullets.splice(i,1);continue}
    // Home toward player
    if(b.homing){
      const a=angle(b.x,b.y,player.x,player.y);
      const turnRate=1.5*dt;
      const ca=atan2(b.vy,b.vx);
      let da=a-ca;while(da>PI)da-=TAU;while(da<-PI)da+=TAU;
      const na=ca+clamp(da,-turnRate,turnRate);
      const spd=sqrt(b.vx*b.vx+b.vy*b.vy);
      b.vx=cos(na)*spd;b.vy=sin(na)*spd;
    }
    b.x+=b.vx*dt;b.y+=b.vy*dt;
    // Trail particles
    b.trail+=dt;
    if(b.trail>0.05){b.trail=0;
      emit(b.x,b.y,1,{color:[C.red,C.redLt],speed:[2,8],life:[0.15,0.3],size:[2,4],sizeEnd:0,shape:'circle',drag:0.95});}
    // Hit player
    if(player.invuln<=0&&dist(b.x,b.y,player.x,player.y)<b.r+player.r){
      player.hp-=b.dmg;player.invuln=0.3;
      SFX.playerHit();doShake(4,0.15);doFlash(C.red,0.2);
      addText(player.x,player.y-25,`-${b.dmg}`,C.red,18);
      emit(player.x,player.y,6,{color:[C.red],speed:[30,80],life:[0.1,0.3],size:[1,3],shape:'ink'});
      homingBullets.splice(i,1);
      if(player.hp<=0){player.hp=0;
        if(player.revivesUsed<1&&meta.coins>=REVIVE_COST){state='revive';reviveTimer=5}
        else{deathSlowMo=1.5;deathSlowMoPending=true;SFX.death();
          emit(player.x,player.y,50,{color:[C.ink,C.red,C.white],speed:[60,250],life:[0.3,1],size:[2,8],shape:'ink',gravity:60});
          doShake(10,0.5);doFlash(C.red,0.5);}
      }
    }
  }
}

function update(dt:number){
  if(freezeT>0){freezeT-=dt;return}
  // Death slow-motion countdown
  if(deathSlowMoPending&&deathSlowMo>0){
    deathSlowMo-=dt;
    const dtSlow=dt*0.1; // 10% speed
    if(flashAlpha>0)flashAlpha=max(0,flashAlpha-dtSlow*3);
    if(shakeT>0)shakeT-=dtSlow;else shake=0;
    updateParticles(dtSlow);
    for(let i=floatTexts.length-1;i>=0;i--){
      const f=floatTexts[i];f.y+=f.vy*dtSlow;f.vy*=0.92;f.life-=dtSlow;
      if(f.life<=0)floatTexts.splice(i,1)}
    if(deathSlowMo<=0){
      deathSlowMoPending=false;state='dead';endRun();Poki.gameplayStop();
    }
    kDown.clear();tap=false;
    return;
  }
  const dtMod=slowMoT>0?(slowMoT-=dt,dt*slowMoRate):dt;
  if(flashAlpha>0)flashAlpha=max(0,flashAlpha-dtMod*3);
  if(comboFlashAlpha>0)comboFlashAlpha=max(0,comboFlashAlpha-dtMod*4);
  if(shakeT>0)shakeT-=dtMod;else shake=0;
  if(bossEntranceT>0)bossEntranceT=max(0,bossEntranceT-dtMod);

  switch(state){
    case'title':titleT+=dt;
      // Tap regions on title screen — matched to drawTitle button layout
      // btnY0=H*0.52, btnH0=52, btnHN=38, gap=7
      if(tap){
        const _by0=H*0.52, _bh0=52, _bhn=38, _gap=7;
        const _b0t=_by0-_bh0/2, _b0b=_by0+_bh0/2;
        const _b1c=_by0+_bh0/2+_gap+_bhn/2, _b1t=_b1c-_bhn/2, _b1b=_b1c+_bhn/2;
        const _b2c=_b1c+_bhn+_gap, _b2t=_b2c-_bhn/2, _b2b=_b2c+_bhn/2;
        const _b3c=_b2c+_bhn+_gap, _b3t=_b3c-_bhn/2, _b3b=_b3c+_bhn/2;
        const _b4c=_b3c+_bhn+_gap, _b4t=_b4c-_bhn/2, _b4b=_b4c+_bhn/2;
        if(tapPos.y>H*0.43&&tapPos.y<H*0.50){SFX.uiTap();changePlayerName()} // Rename tap region
        else if(tapPos.y>=_b0t&&tapPos.y<=_b0b){SFX.gameStart();startGame();Poki.gameplayStart()}
        else if(tapPos.y>=_b1t&&tapPos.y<=_b1b){SFX.uiTap();state='shop'}
        else if(tapPos.y>=_b2t&&tapPos.y<=_b2b){SFX.uiTap();state='charselect'}
        else if(tapPos.y>=_b3t&&tapPos.y<=_b3b){SFX.uiTap();state='leaderboard'}
        else if(tapPos.y>=_b4t&&tapPos.y<=_b4b){SFX.uiTap();isDaily=true;startGame();Poki.gameplayStart()}
      }
      if(kDown.has('Space')||kDown.has('Enter')){SFX.gameStart();startGame();Poki.gameplayStart()}
      break;
    case'playing':
      gameTimer+=dtMod;
      updatePlayer(dtMod);updateBullets(dtMod);updateEnemyBullets(dtMod);updateHomingBullets(dtMod);
      updateEnemies(dtMod);updateGems(dtMod);updateChests(dtMod);updateParticles(dtMod);
      for(let i=floatTexts.length-1;i>=0;i--){
        const f=floatTexts[i];f.y+=f.vy*dtMod;f.vy*=0.92;f.life-=dtMod;
        if(f.life<=0)floatTexts.splice(i,1)}
      waveTimer+=dtMod;if(waveTimer>=waveInterval){waveTimer=0;spawnWave()}
      if(gameTimer>=GAME_DURATION){state='victory';SFX.victory();endRun();Poki.gameplayStop();
        emit(player.x,player.y,60,{color:[C.gold,C.red,C.blueLt,C.white],speed:[80,300],life:[0.5,1.5],size:[2,8],shape:'spark'});
        // Spawn victory coin particles
        victoryCoins=[];victoryT=0;
        for(let i=0;i<40;i++){victoryCoins.push({x:rand(20,W-20),y:rand(-200,-20),vx:rand(-20,20),vy:rand(40,120),life:8,rot:rand(0,TAU),rotSpeed:rand(-3,3)})}
      }
      if(kDown.has('Escape')||kDown.has('KeyP')){prevState='playing';state='paused'}
      break;
    case'levelup':
      updateParticles(dtMod*0.3);
      if(kDown.has('Digit1'))applyUpgrade(0);
      if(kDown.has('Digit2'))applyUpgrade(1);
      if(kDown.has('Digit3'))applyUpgrade(2);
      if(tap){
        const cardW=110,cardH=160,gap=10,totalW=cardW*3+gap*2;
        const startX=(W-totalW)/2,startY=H*0.35;
        if(upgradeChoices.length===1){
          const cx=W/2-cardW/2,cy=startY;
          if(tapPos.x>=cx&&tapPos.x<=cx+cardW&&tapPos.y>=cy&&tapPos.y<=cy+cardH)applyUpgrade(0);
        } else {
          for(let i=0;i<3;i++){
            const cx=startX+i*(cardW+gap),cy=startY;
            if(tapPos.x>=cx&&tapPos.x<=cx+cardW&&tapPos.y>=cy&&tapPos.y<=cy+cardH){applyUpgrade(i);break}
          }
        }
      }
      break;
    case'paused':
      if(kDown.has('Escape')||kDown.has('KeyP')||kDown.has('Space')||tap){SFX.uiTap();state=prevState}
      break;
    case'revive':
      reviveTimer-=dt;titleT+=dt;
      if(reviveTimer<=0){// Times up, die for real
        state='dead';SFX.death();endRun();Poki.gameplayStop();Poki.commercialBreak()}
      if(tap){
        if(tapPos.y>H*0.45&&tapPos.y<H*0.55){SFX.uiTap();doRevive()}// Revive button
        else if(tapPos.y>H*0.58&&tapPos.y<H*0.65){SFX.uiTap();// Give up
          state='dead';SFX.death();endRun();Poki.gameplayStop();Poki.commercialBreak()}
      }
      if(kDown.has('Space')){doRevive()}
      if(kDown.has('Escape')){state='dead';SFX.death();endRun();Poki.gameplayStop()}
      break;
    case'dead':case'victory':
      titleT+=dt;updateParticles(dtMod);
      // Victory coin particles
      if(state==='victory'){victoryT+=dt;
        for(const c of victoryCoins){c.x+=c.vx*dt;c.vy+=150*dt;c.y+=c.vy*dt;c.rot+=c.rotSpeed*dt;c.life-=dt;
          if(c.y>H+20){c.y=-20;c.vy=rand(40,120);c.x=rand(20,W-20);c.life=8}}
        victoryCoins=victoryCoins.filter(c=>c.life>0);
      }
      for(const f of floatTexts){f.y+=f.vy*dtMod;f.life-=dtMod}
      floatTexts=floatTexts.filter(f=>f.life>0);
      if(tap){
        if(tapPos.y>H*0.7&&tapPos.y<H*0.77){SFX.uiTap();shareResult()} // Share button
        else if(tapPos.y>H*0.77){SFX.uiTap();state='title';isDaily=false;Poki.commercialBreak()} // Return
      }
      if(kDown.has('Space')||kDown.has('Enter')){SFX.uiTap();state='title';isDaily=false}
      break;
    case'shop':
      if(tap){handleShopTap();SFX.uiTap()}
      if(kDown.has('Escape')||kDown.has('Backspace')){SFX.uiTap();state='title'}
      // Back button tap
      if(tap&&tapPos.y>H*0.86){SFX.uiTap();state='title'}
      break;
    case'charselect':
      if(tap){handleCharTap();SFX.uiTap()}
      if(kDown.has('Escape')){SFX.uiTap();state='title'}
      if(tap&&tapPos.y>H*0.88){SFX.uiTap();state='title'}
      break;
    case'leaderboard':
      if(kDown.has('Escape')||tap){SFX.uiTap();state='title'}
      break;
  }
  kDown.clear();tap=false;
}

function handleShopTap(){
  const permKeys = Object.keys(PERM_NAMES) as (keyof Meta)[];
  const startY=H*0.3;
  for(let i=0;i<permKeys.length;i++){
    const k=permKeys[i];
    const level=(meta[k] as number);
    if(level>=5)continue;
    const cost=PERM_COSTS[level];
    if(meta.coins<cost)continue;
    const bx=W/2-80,by=startY+i*55,bw=160,bh=44;
    if(tapPos.x>=bx&&tapPos.x<=bx+bw&&tapPos.y>=by&&tapPos.y<=by+bh){
      meta.coins-=cost;(meta[k] as number)++;saveMeta();
      SFX.levelUp();break;
    }
  }
}

function handleCharTap(){
  const startY=H*0.2;
  for(let i=0;i<CHARACTERS.length;i++){
    const ch=CHARACTERS[i];
    const bx=20,by=startY+i*70,bw=W-40,bh=60;
    if(tapPos.x>=bx&&tapPos.x<=bx+bw&&tapPos.y>=by&&tapPos.y<=by+bh){
      if(meta.unlockedChars.includes(ch.id)){
        selectedChar=ch.id;SFX.pickup();
      } else if(meta.coins>=ch.cost){
        meta.coins-=ch.cost;meta.unlockedChars.push(ch.id);saveMeta();
        selectedChar=ch.id;SFX.evolve();
      }
      break;
    }
  }
}

// ═══════════════════════════════════════════════════
// RENDERING
// ═══════════════════════════════════════════════════

function drawInkCircle(cx:CanvasRenderingContext2D,x:number,y:number,r:number,fill:string,stroke:string,lineW=1.5){
  cx.save();cx.fillStyle=fill;cx.globalAlpha=0.9;
  cx.beginPath();const pts=16;
  for(let i=0;i<=pts;i++){const a=(i/pts)*TAU;const v=1+(sin(a*3+r)*0.1);
    const px=x+cos(a)*r*v,py=y+sin(a)*r*v;i===0?cx.moveTo(px,py):cx.lineTo(px,py)}
  cx.closePath();cx.fill();
  if(lineW>0){cx.strokeStyle=stroke;cx.lineWidth=lineW;cx.globalAlpha=0.7;cx.stroke()}
  cx.restore();
}

// ─── Player afterimage history for motion trail ───
const playerTrail: {x:number;y:number;facing:number;t:number}[] = [];

function drawPlayer(cx:CanvasRenderingContext2D,px:number,py:number){
  const p=player;const bob=sin(p.animT*8)*2;const breath=sin(p.animT*3)*0.5;
  const ch=getChar();
  const md=getMoveDir();
  const isMoving=md.x!==0||md.y!==0;

  // Record trail position
  playerTrail.push({x:px,y:py,facing:p.facing,t:p.animT});
  if(playerTrail.length>6)playerTrail.shift();

  // ─── Ground shadow ───
  cx.save();
  const shadowGrad=cx.createRadialGradient(px,py+p.r+4,0,px,py+p.r+4,p.r*1.5);
  shadowGrad.addColorStop(0,'rgba(0,0,0,0.25)');shadowGrad.addColorStop(1,'rgba(0,0,0,0)');
  cx.fillStyle=shadowGrad;
  cx.beginPath();cx.ellipse(px,py+p.r+4,p.r*1.3,p.r*0.4,0,0,TAU);cx.fill();
  cx.restore();

  // ─── Afterimage trail (3 ghost copies when moving) ───
  if(isMoving && playerTrail.length>=3){
    for(let ti=0;ti<3;ti++){
      const idx=max(0,playerTrail.length-2-ti*2);
      if(idx>=playerTrail.length)continue;
      const tr=playerTrail[idx];
      const alpha=0.12-ti*0.035;
      cx.save();cx.globalAlpha=alpha;
      cx.translate(tr.x,tr.y);
      // Ghost body with gradient
      const ghostGrad=cx.createRadialGradient(0,bob,0,0,bob,p.r+breath);
      ghostGrad.addColorStop(0,ch.scarfColor);ghostGrad.addColorStop(1,'rgba(0,0,0,0)');
      cx.fillStyle=ghostGrad;
      cx.beginPath();cx.arc(0,bob,p.r+breath,0,TAU);cx.fill();
      cx.restore();
    }
  }

  if(p.invuln>0){
    // Invincibility: golden pulsing shield
    const shieldPulse=0.3+sin(p.animT*12)*0.15;
    cx.save();
    cx.shadowBlur=20;cx.shadowColor='rgba(240,184,64,0.6)';
    const shieldGrad=cx.createRadialGradient(px,py+bob,p.r,px,py+bob,p.r*2.2);
    shieldGrad.addColorStop(0,'rgba(240,184,64,'+shieldPulse+')');
    shieldGrad.addColorStop(0.6,'rgba(240,216,112,0.1)');
    shieldGrad.addColorStop(1,'rgba(240,216,112,0)');
    cx.fillStyle=shieldGrad;
    cx.beginPath();cx.arc(px,py+bob,p.r*2.2,0,TAU);cx.fill();
    // Shield ring
    cx.globalAlpha=shieldPulse+0.2;cx.strokeStyle=C.gold;cx.lineWidth=1.5;
    cx.beginPath();cx.arc(px,py+bob,p.r*1.6+sin(p.animT*8)*2,0,TAU);cx.stroke();
    cx.shadowBlur=0;cx.restore();
    // Still flicker slightly at low invuln
    if(p.invuln<0.3&&floor(p.invuln*20)%2===0)cx.globalAlpha=0.5;
  }

  // Dash trail (enhanced with glow)
  if(p.isDashing){
    for(let i=3;i>0;i--){
      cx.save();cx.globalAlpha=0.12*i;
      cx.shadowBlur=8;cx.shadowColor=C.blueLt;
      const tx=px-cos(p.facing)*i*10,ty=py-sin(p.facing)*i*10+bob;
      const trGrad=cx.createRadialGradient(tx,ty,0,tx,ty,p.r);
      trGrad.addColorStop(0,C.blueLt);trGrad.addColorStop(1,'rgba(96,176,232,0)');
      cx.fillStyle=trGrad;cx.beginPath();cx.arc(tx,ty,p.r,0,TAU);cx.fill();
      cx.shadowBlur=0;cx.restore();
    }
    cx.globalAlpha=1;
  }

  // ─── Aura (enhanced with glow) ───
  if(p.auraActive){
    cx.save();
    const auraColor=player.chainActive?C.gold:C.purpleLt;
    cx.shadowBlur=15;cx.shadowColor=auraColor;
    cx.globalAlpha=0.1+sin(p.animT*4)*0.04;
    cx.strokeStyle=auraColor;cx.lineWidth=2.5;
    cx.beginPath();cx.arc(px,py,p.auraR,0,TAU);cx.stroke();
    cx.globalAlpha=0.04;
    const aGrad=cx.createRadialGradient(px,py,p.auraR*0.5,px,py,p.auraR);
    aGrad.addColorStop(0,auraColor);aGrad.addColorStop(1,'rgba(0,0,0,0)');
    cx.fillStyle=aGrad;cx.beginPath();cx.arc(px,py,p.auraR,0,TAU);cx.fill();
    cx.shadowBlur=0;cx.restore();
  }

  // ─── Orbitals (enhanced with trail + glow) ───
  for(let i=0;i<p.orbitalCount;i++){
    const a=p.animT*p.orbitalSpeed+i*(TAU/p.orbitalCount);
    const ox=px+cos(a)*p.orbitalR,oy=py+sin(a)*p.orbitalR+bob;
    cx.save();
    // Trail
    for(let tt=1;tt<=3;tt++){
      const ta=a-tt*0.15*p.orbitalSpeed;
      const ttx=px+cos(ta)*p.orbitalR,tty=py+sin(ta)*p.orbitalR+bob;
      cx.globalAlpha=0.15-tt*0.04;cx.fillStyle=C.blueLt;
      cx.beginPath();cx.arc(ttx,tty,4-tt*0.5,0,TAU);cx.fill();
    }
    // Glow
    cx.shadowBlur=12;cx.shadowColor=C.blueLt;
    cx.globalAlpha=0.85;
    const orbGrad=cx.createRadialGradient(ox,oy,0,ox,oy,6);
    orbGrad.addColorStop(0,C.white);orbGrad.addColorStop(0.4,C.blueLt);orbGrad.addColorStop(1,C.blue);
    cx.fillStyle=orbGrad;cx.beginPath();cx.arc(ox,oy,5,0,TAU);cx.fill();
    cx.strokeStyle=C.bluePale;cx.lineWidth=1;cx.stroke();
    cx.shadowBlur=0;cx.restore();
  }

  cx.save();cx.translate(px,py);

  // ─── Scarf (enhanced: thicker, flowing, gradient) ───
  cx.save();
  const sd=p.facing+PI;
  const scarfCol=ch.scarfColor;
  cx.lineCap='round';cx.lineJoin='round';
  // Main scarf stroke
  for(let layer=0;layer<2;layer++){
    cx.globalAlpha=layer===0?0.4:0.85;
    cx.strokeStyle=scarfCol;
    cx.lineWidth=layer===0?6:3.5;
    cx.beginPath();cx.moveTo(cos(sd)*5,sin(sd)*5+bob);
    for(let i=1;i<=7;i++){
      const wave=sin(p.animT*6+i*0.8)*0.4;
      const sx2=cos(sd)*5+cos(sd+wave)*i*5.5;
      const sy2=sin(sd)*5+sin(sd+wave)*i*5.5+bob+i*1.8;
      cx.lineTo(sx2,sy2);
    }
    cx.stroke();
  }
  // Scarf highlight
  cx.globalAlpha=0.3;cx.strokeStyle=C.white;cx.lineWidth=1;
  cx.beginPath();cx.moveTo(cos(sd)*5,sin(sd)*5+bob);
  cx.lineTo(cos(sd)*5+cos(sd)*8,sin(sd)*5+sin(sd)*8+bob+2);
  cx.stroke();
  cx.restore();

  // ─── Body (radial gradient with 3-tone: shadow/base/highlight) ───
  cx.save();
  const bodyR=p.r+breath;
  const bodyGrad=cx.createRadialGradient(-bodyR*0.3,-bodyR*0.3+bob,bodyR*0.1, 0,bob,bodyR*1.1);
  bodyGrad.addColorStop(0,'#2a2a58'); // highlight
  bodyGrad.addColorStop(0.5,ch.color); // base
  bodyGrad.addColorStop(1,'#0a0a1e'); // shadow
  cx.fillStyle=bodyGrad;cx.globalAlpha=0.92;
  cx.beginPath();
  const pts=16;
  for(let i=0;i<=pts;i++){const a=(i/pts)*TAU;const v=1+(sin(a*3+bodyR)*0.08);
    const bpx=cos(a)*bodyR*v,bpy=sin(a)*bodyR*v+bob;
    i===0?cx.moveTo(bpx,bpy):cx.lineTo(bpx,bpy);}
  cx.closePath();cx.fill();
  // Dark outline
  cx.strokeStyle='#080818';cx.lineWidth=2.5;cx.globalAlpha=0.75;cx.stroke();
  // Rim highlight
  cx.strokeStyle='rgba(200,200,232,0.15)';cx.lineWidth=1;cx.stroke();
  cx.restore();

  // ─── Eyes (expressive, larger, with pupils and highlights) ───
  const ex=cos(p.facing)*4.5,ey=sin(p.facing)*4.5+bob;
  // Eye whites
  cx.fillStyle='#d0d0e8';cx.globalAlpha=0.9;
  cx.beginPath();cx.ellipse(ex-3,ey-1,3,2.5,0,0,TAU);cx.fill();
  cx.beginPath();cx.ellipse(ex+3,ey-1,3,2.5,0,0,TAU);cx.fill();
  // Pupils
  const pupOff=0.5; // pupils look in facing direction
  cx.fillStyle='#0a0a18';cx.globalAlpha=0.95;
  cx.beginPath();cx.arc(ex-3+cos(p.facing)*pupOff,ey-1+sin(p.facing)*pupOff,1.8,0,TAU);cx.fill();
  cx.beginPath();cx.arc(ex+3+cos(p.facing)*pupOff,ey-1+sin(p.facing)*pupOff,1.8,0,TAU);cx.fill();
  // Eye highlights (white dots)
  cx.fillStyle='#ffffff';cx.globalAlpha=0.85;
  cx.beginPath();cx.arc(ex-3.5,ey-2,0.7,0,TAU);cx.fill();
  cx.beginPath();cx.arc(ex+2.5,ey-2,0.7,0,TAU);cx.fill();

  // ─── Hair (enhanced with multiple strands) ───
  cx.strokeStyle='#0a0a18';cx.lineWidth=2.5;cx.lineCap='round';cx.globalAlpha=0.85;
  cx.beginPath();cx.moveTo(-2,-p.r+bob);
  cx.quadraticCurveTo(cos(p.facing)*12,-p.r-10+bob+sin(p.animT*4)*2.5,cos(p.facing)*8,-p.r+2+bob);cx.stroke();
  cx.lineWidth=1.5;cx.globalAlpha=0.6;
  cx.beginPath();cx.moveTo(2,-p.r+bob);
  cx.quadraticCurveTo(cos(p.facing)*8+3,-p.r-6+bob+sin(p.animT*4.5+1)*2,cos(p.facing)*6+2,-p.r+3+bob);cx.stroke();

  // ─── Muzzle flash (enhanced with glow) ───
  if(p.shootTimer>p.shootCD*0.7){
    cx.save();
    cx.shadowBlur=15;cx.shadowColor='rgba(240,184,64,0.8)';
    cx.globalAlpha=0.7;
    const mfx=cos(p.facing)*18,mfy=sin(p.facing)*18+bob;
    const mfGrad=cx.createRadialGradient(mfx,mfy,0,mfx,mfy,6+random()*2);
    mfGrad.addColorStop(0,C.white);mfGrad.addColorStop(0.4,C.gold);mfGrad.addColorStop(1,'rgba(240,184,64,0)');
    cx.fillStyle=mfGrad;cx.beginPath();cx.arc(mfx,mfy,6+random()*2,0,TAU);cx.fill();
    cx.shadowBlur=0;cx.restore();
  }
  cx.restore();cx.globalAlpha=1;
}

function drawEnemy(cx:CanvasRenderingContext2D,e:Enemy,offX:number,offY:number){
  const ex=e.x-offX,ey=e.y-offY;const def=ENEMY_DEFS[e.type]||ENEMY_DEFS.hunDun;const bob=sin(e.animT*3)*1.5;
  if(e.hitFlash>0)cx.save();

  // ─── Ground shadow for all enemies ───
  cx.save();
  const shR=e.r*(e.isBoss?1.5:1.2);
  const eShadow=cx.createRadialGradient(ex,ey+e.r+3+bob,0,ex,ey+e.r+3+bob,shR);
  eShadow.addColorStop(0,'rgba(0,0,0,0.2)');eShadow.addColorStop(1,'rgba(0,0,0,0)');
  cx.fillStyle=eShadow;cx.beginPath();cx.ellipse(ex,ey+e.r+3+bob,shR,shR*0.3,0,0,TAU);cx.fill();
  cx.restore();

  // Boss glow (enhanced with shadowBlur + particle aura)
  if(e.isBoss){const enraged=e.bossTimer>20;
    cx.save();
    cx.shadowBlur=enraged?30:15;cx.shadowColor=enraged?'rgba(224,48,80,0.5)':'rgba(224,48,80,0.2)';
    cx.globalAlpha=enraged?0.2+sin(e.animT*4)*0.1:0.08+sin(e.animT*2)*0.04;
    const bossGlow=cx.createRadialGradient(ex,ey+bob,e.r*0.5,ex,ey+bob,e.r*(enraged?2.8:2.2));
    bossGlow.addColorStop(0,enraged?'rgba(224,48,80,0.3)':'rgba(224,48,80,0.15)');
    bossGlow.addColorStop(0.5,'rgba(240,184,64,0.08)');
    bossGlow.addColorStop(1,'rgba(0,0,0,0)');
    cx.fillStyle=bossGlow;cx.beginPath();cx.arc(ex,ey+bob,e.r*(enraged?2.8:2.2),0,TAU);cx.fill();
    if(enraged){
      cx.globalAlpha=0.12+sin(e.animT*6)*0.08;cx.strokeStyle=C.red;cx.lineWidth=2;
      cx.beginPath();cx.arc(ex,ey+bob,e.r*2.5+sin(e.animT*3)*5,0,TAU);cx.stroke();
    }
    cx.shadowBlur=0;cx.restore();
  }

  switch(e.type){
    case'hunDun':{
      // Amorphous blob body with gradient
      cx.save();cx.globalAlpha=0.8;
      const hdGrad=cx.createRadialGradient(ex-e.r*0.2,ey-e.r*0.2+bob,e.r*0.1,ex,ey+bob,e.r*1.1);
      hdGrad.addColorStop(0,e.hitFlash>0?C.white:'#a0a0c8');
      hdGrad.addColorStop(0.5,e.hitFlash>0?C.white:def.bodyColor);
      hdGrad.addColorStop(1,'#303060');
      cx.fillStyle=hdGrad;
      cx.beginPath();
      for(let i=0;i<=12;i++){const a=(i/12)*TAU;const r=e.r*(1+sin(a*3+e.animT*2)*0.2+cos(a*5+e.animT)*0.1);
        i===0?cx.moveTo(ex+cos(a)*r,ey+sin(a)*r+bob):cx.lineTo(ex+cos(a)*r,ey+sin(a)*r+bob)}
      cx.closePath();cx.fill();
      cx.strokeStyle='#1a1a40';cx.lineWidth=e.isBoss?2.5:1.5;cx.globalAlpha=0.6;cx.stroke();cx.restore();
      // Multiple glowing eyes
      const eyeCount=e.isBoss?5:3;
      for(let i=0;i<eyeCount;i++){
        const eAngle=i*2.1+e.animT*0.3;
        const eex=ex+cos(eAngle)*e.r*0.3,eey=ey+sin(eAngle)*e.r*0.25+bob;
        const eyeSz=e.isBoss?3.5:1.8;
        cx.save();cx.shadowBlur=6;cx.shadowColor='rgba(224,48,80,0.6)';
        cx.fillStyle=C.red;cx.globalAlpha=0.9;
        cx.beginPath();cx.arc(eex,eey,eyeSz,0,TAU);cx.fill();
        cx.fillStyle=C.white;cx.globalAlpha=0.5;
        cx.beginPath();cx.arc(eex-eyeSz*0.3,eey-eyeSz*0.3,eyeSz*0.35,0,TAU);cx.fill();
        cx.shadowBlur=0;cx.restore();
      }
      break;
    }
    case'biFang':{const wf=sin(e.animT*8)*0.4;
      // Body with fire gradient
      cx.save();
      const bfGrad=cx.createRadialGradient(ex,ey+bob,0,ex,ey+bob,e.r*1.1);
      bfGrad.addColorStop(0,e.hitFlash>0?C.white:'#ff9060');
      bfGrad.addColorStop(0.6,e.hitFlash>0?C.white:def.color);
      bfGrad.addColorStop(1,def.bodyColor);
      cx.fillStyle=bfGrad;cx.globalAlpha=0.9;
      cx.beginPath();const bfPts=14;
      for(let i=0;i<=bfPts;i++){const a=(i/bfPts)*TAU;const v=1+(sin(a*3+e.r)*0.08);
        cx.lineTo(ex+cos(a)*e.r*v,ey+sin(a)*e.r*v+bob)}
      cx.closePath();cx.fill();
      cx.strokeStyle='#601020';cx.lineWidth=1.5;cx.globalAlpha=0.5;cx.stroke();
      cx.restore();
      // Wings with gradient
      cx.save();cx.globalAlpha=0.75;
      for(const dir of [-1,1]){
        const wingGrad=cx.createLinearGradient(ex,ey+bob,ex+dir*e.r*2,ey-e.r+bob);
        wingGrad.addColorStop(0,C.gold);wingGrad.addColorStop(1,'rgba(240,184,64,0.2)');
        cx.strokeStyle=wingGrad;cx.lineWidth=e.isBoss?3:2;cx.lineCap='round';
        cx.beginPath();cx.moveTo(ex+dir*e.r*0.5,ey+bob);
        cx.quadraticCurveTo(ex+dir*e.r*1.5,ey-e.r+wf*e.r*dir+bob,ex+dir*e.r*1.8,ey+bob);cx.stroke();
        // Second wing layer
        cx.globalAlpha=0.4;cx.lineWidth=e.isBoss?2:1;
        cx.beginPath();cx.moveTo(ex+dir*e.r*0.3,ey-e.r*0.3+bob);
        cx.quadraticCurveTo(ex+dir*e.r*1.2,ey-e.r*1.2+wf*e.r*dir*0.5+bob,ex+dir*e.r*1.5,ey-e.r*0.2+bob);cx.stroke();
      }
      cx.restore();
      // Fire eye
      cx.save();cx.shadowBlur=8;cx.shadowColor='rgba(240,184,64,0.8)';
      cx.fillStyle=C.gold;cx.globalAlpha=0.95;cx.beginPath();cx.arc(ex,ey-e.r*0.1+bob,e.isBoss?5:2.5,0,TAU);cx.fill();
      cx.fillStyle=C.white;cx.globalAlpha=0.5;cx.beginPath();cx.arc(ex-1,ey-e.r*0.1-1+bob,e.isBoss?2:1,0,TAU);cx.fill();
      cx.shadowBlur=0;cx.restore();
      break;}
    case'taoTie':{
      // Body with gradient
      cx.save();
      const ttGrad=cx.createRadialGradient(ex-e.r*0.2,ey-e.r*0.2+bob,e.r*0.1,ex,ey+bob,e.r*1.1);
      ttGrad.addColorStop(0,e.hitFlash>0?C.white:'#e8c868');
      ttGrad.addColorStop(0.5,e.hitFlash>0?C.white:def.color);
      ttGrad.addColorStop(1,'#604820');
      cx.fillStyle=ttGrad;cx.globalAlpha=0.9;
      cx.beginPath();const ttPts=16;
      for(let i=0;i<=ttPts;i++){const a=(i/ttPts)*TAU;const v=1+(sin(a*3+e.r)*0.1);
        cx.lineTo(ex+cos(a)*e.r*v,ey+sin(a)*e.r*v+bob)}
      cx.closePath();cx.fill();
      cx.strokeStyle='#1a1a10';cx.lineWidth=2;cx.globalAlpha=0.6;cx.stroke();
      cx.restore();
      // Horns
      cx.strokeStyle='#1a1a10';cx.lineWidth=e.isBoss?3.5:2.5;cx.lineCap='round';cx.globalAlpha=0.85;
      [-1,1].forEach(dir=>{cx.beginPath();cx.moveTo(ex+dir*e.r*0.6,ey-e.r*0.5+bob);
        cx.quadraticCurveTo(ex+dir*e.r,ey-e.r*1.3+bob,ex+dir*e.r*0.7,ey-e.r*0.9+bob);cx.stroke()});
      // Maw with gradient
      const mawGrad=cx.createRadialGradient(ex,ey+e.r*0.3+bob,0,ex,ey+e.r*0.3+bob,e.r*0.5);
      mawGrad.addColorStop(0,'#200808');mawGrad.addColorStop(1,C.redDk);
      cx.fillStyle=mawGrad;cx.globalAlpha=0.85;
      cx.beginPath();cx.ellipse(ex,ey+e.r*0.3+bob,e.r*0.5,e.r*0.2*(1+sin(e.animT*3)*0.3),0,0,TAU);cx.fill();
      // Teeth
      cx.fillStyle='#e8e0c0';
      for(let i=0;i<4;i++){const tx=ex-e.r*0.3+i*e.r*0.2;
        cx.beginPath();cx.moveTo(tx,ey+e.r*0.15+bob);cx.lineTo(tx+2,ey+e.r*0.4+bob);cx.lineTo(tx+4,ey+e.r*0.15+bob);cx.fill()}
      // Glowing eyes
      cx.save();cx.shadowBlur=8;cx.shadowColor='rgba(224,48,80,0.6)';
      cx.fillStyle=C.red;cx.globalAlpha=0.95;
      [-1,1].forEach(dir=>{cx.beginPath();cx.ellipse(ex+dir*e.r*0.3,ey-e.r*0.15+bob,e.isBoss?5:3,e.isBoss?3:2,0,0,TAU);cx.fill()});
      cx.fillStyle=C.white;cx.globalAlpha=0.4;
      [-1,1].forEach(dir=>{cx.beginPath();cx.arc(ex+dir*e.r*0.3-1,ey-e.r*0.15-1+bob,e.isBoss?2:1,0,TAU);cx.fill()});
      cx.shadowBlur=0;cx.restore();
      break;}
    case'jiuWei':{
      // Body with soft blue gradient
      cx.save();
      const jwGrad=cx.createRadialGradient(ex-e.r*0.2,ey-e.r*0.2+bob,e.r*0.1,ex,ey+bob,e.r*1.1);
      jwGrad.addColorStop(0,e.hitFlash>0?C.white:'#d0d8f0');
      jwGrad.addColorStop(0.5,e.hitFlash>0?C.white:C.paperLt);
      jwGrad.addColorStop(1,def.color);
      cx.fillStyle=jwGrad;cx.globalAlpha=0.9;
      cx.beginPath();const jwPts=14;
      for(let i=0;i<=jwPts;i++){const a=(i/jwPts)*TAU;const v=1+(sin(a*3+e.r)*0.08);
        cx.lineTo(ex+cos(a)*e.r*v,ey+sin(a)*e.r*v+bob)}
      cx.closePath();cx.fill();
      cx.strokeStyle=def.color;cx.lineWidth=1.5;cx.globalAlpha=0.5;cx.stroke();
      cx.restore();
      // Tails with gradient
      cx.save();cx.globalAlpha=0.6;
      {const dx=player.x-(ex+offX),dy=player.y-(ey+offY),tp=atan2(dy,dx),td=tp+PI;
      const tailCount=e.isBoss?12:7;
      for(let i=0;i<tailCount;i++){const ta=td+(i-(tailCount-1)/2)*0.15;
        const tailGrad=cx.createLinearGradient(ex,ey+bob,ex+cos(ta)*e.r*2.5,ey+sin(ta)*e.r*2.5+bob);
        tailGrad.addColorStop(0,i%2===0?def.bodyColor:C.gold);tailGrad.addColorStop(1,'rgba(0,0,0,0)');
        cx.strokeStyle=tailGrad;cx.lineWidth=e.isBoss?2.5:1.5;cx.lineCap='round';
        cx.beginPath();cx.moveTo(ex+cos(ta)*e.r*0.5,ey+sin(ta)*e.r*0.5+bob);
        cx.quadraticCurveTo(ex+cos(ta)*e.r*2+sin(e.animT*3+i)*8,ey+sin(ta)*e.r*2+cos(e.animT*2.5+i)*6+bob,
          ex+cos(ta)*e.r*2.5,ey+sin(ta)*e.r*2.5+bob);cx.stroke();
        // Tail tip glow
        if(e.isBoss){cx.globalAlpha=0.15;cx.fillStyle=C.blueLt;
          cx.beginPath();cx.arc(ex+cos(ta)*e.r*2.5,ey+sin(ta)*e.r*2.5+bob,3,0,TAU);cx.fill();cx.globalAlpha=0.6;}
      }}
      cx.restore();
      // Glowing eyes
      cx.save();cx.shadowBlur=6;cx.shadowColor='rgba(96,176,232,0.6)';
      cx.fillStyle=def.color;cx.globalAlpha=0.95;
      [-1,1].forEach(dir=>{cx.beginPath();cx.ellipse(ex+dir*e.r*0.25,ey-e.r*0.1+bob,e.isBoss?4:2.5,e.isBoss?2.5:1.5,dir*0.2,0,TAU);cx.fill()});
      cx.fillStyle=C.white;cx.globalAlpha=0.4;
      [-1,1].forEach(dir=>{cx.beginPath();cx.arc(ex+dir*e.r*0.25-0.5,ey-e.r*0.1-0.5+bob,e.isBoss?1.5:0.8,0,TAU);cx.fill()});
      cx.shadowBlur=0;cx.restore();
      // Ears
      [-1,1].forEach(dir=>{
        cx.save();
        const earGrad=cx.createLinearGradient(ex+dir*e.r*0.4,ey-e.r*0.5+bob,ex+dir*e.r*0.7,ey-e.r*1.1+bob);
        earGrad.addColorStop(0,C.paperLt);earGrad.addColorStop(1,def.color);
        cx.beginPath();cx.moveTo(ex+dir*e.r*0.4,ey-e.r*0.5+bob);
        cx.lineTo(ex+dir*e.r*0.7,ey-e.r*1.1+bob);cx.lineTo(ex+dir*e.r*0.1,ey-e.r*0.6+bob);
        cx.fillStyle=earGrad;cx.globalAlpha=0.75;cx.fill();cx.strokeStyle=def.color;cx.lineWidth=1;cx.stroke();
        cx.restore();
      });
      break;}
    default:{ // yaksha - enhanced speedy imp
      cx.save();
      const ykGrad=cx.createRadialGradient(ex-e.r*0.2,ey-e.r*0.2+bob,0,ex,ey+bob,e.r*1.1);
      ykGrad.addColorStop(0,e.hitFlash>0?C.white:'#80e8b0');
      ykGrad.addColorStop(0.6,e.hitFlash>0?C.white:def.color);
      ykGrad.addColorStop(1,'#184830');
      cx.fillStyle=ykGrad;cx.globalAlpha=0.9;
      cx.beginPath();const ykPts=10;
      for(let i=0;i<=ykPts;i++){const a=(i/ykPts)*TAU;const v=1+(sin(a*4+e.animT*4)*0.12);
        cx.lineTo(ex+cos(a)*e.r*v,ey+sin(a)*e.r*v+bob)}
      cx.closePath();cx.fill();
      cx.strokeStyle='#0a2018';cx.lineWidth=1;cx.globalAlpha=0.5;cx.stroke();
      cx.restore();
      // Glowing eye
      cx.save();cx.shadowBlur=5;cx.shadowColor='rgba(224,48,80,0.5)';
      cx.fillStyle=C.red;cx.globalAlpha=0.9;cx.beginPath();cx.arc(ex,ey-e.r*0.1+bob,e.isBoss?3:1.8,0,TAU);cx.fill();
      cx.fillStyle=C.white;cx.globalAlpha=0.4;cx.beginPath();cx.arc(ex-0.3,ey-e.r*0.1-0.3+bob,0.5,0,TAU);cx.fill();
      cx.shadowBlur=0;cx.restore();
      // Speed lines (motion blur)
      cx.save();cx.globalAlpha=0.15;cx.strokeStyle=def.color;cx.lineWidth=1;
      for(let i=0;i<3;i++){
        cx.beginPath();cx.moveTo(ex-cos(e.animT+i)*e.r*1.5,ey+bob+sin(e.animT*2+i)*e.r*0.5);
        cx.lineTo(ex-cos(e.animT+i)*e.r*2.5,ey+bob+sin(e.animT*2+i)*e.r*0.5);cx.stroke();}
      cx.restore();
    }
  }

  // ─── HP bar (enhanced with gradient + glow) ───
  if(e.maxHp>=20&&e.hp<e.maxHp){
    const bw=e.r*2.2,bh=e.isBoss?5:3,bx=ex-bw/2,by=ey-e.r-8+bob;
    const hpRatio=e.hp/e.maxHp;
    // Background
    cx.save();
    cx.globalAlpha=0.5;cx.fillStyle='#0a0a18';
    roundRect(cx,bx-1,by-1,bw+2,bh+2,2);cx.fill();
    // HP fill with gradient
    const hpGrad=cx.createLinearGradient(bx,by,bx,by+bh);
    if(hpRatio>0.5){hpGrad.addColorStop(0,C.greenLt);hpGrad.addColorStop(1,C.green)}
    else if(hpRatio>0.25){hpGrad.addColorStop(0,C.goldLt);hpGrad.addColorStop(1,C.gold)}
    else{hpGrad.addColorStop(0,C.redLt);hpGrad.addColorStop(1,C.red)}
    cx.globalAlpha=0.9;cx.fillStyle=hpGrad;
    roundRect(cx,bx,by,bw*hpRatio,bh,1.5);cx.fill();
    // Shine
    cx.globalAlpha=0.2;cx.fillStyle=C.white;
    roundRect(cx,bx,by,bw*hpRatio,bh*0.4,1);cx.fill();
    if(e.isBoss){cx.globalAlpha=0.7;cx.font='700 9px sans-serif';cx.textAlign='center';cx.fillStyle=C.white;
      cx.shadowBlur=3;cx.shadowColor='rgba(0,0,0,0.5)';
      cx.fillText(`${floor(e.hp)}`,ex,by-3);cx.shadowBlur=0;}
    cx.restore();
  }
  if(e.hitFlash>0)cx.restore();cx.globalAlpha=1;
}

// Helper: rounded rectangle path
function roundRect(cx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){
  cx.beginPath();cx.moveTo(x+r,y);cx.lineTo(x+w-r,y);cx.arcTo(x+w,y,x+w,y+r,r);
  cx.lineTo(x+w,y+h-r);cx.arcTo(x+w,y+h,x+w-r,y+h,r);
  cx.lineTo(x+r,y+h);cx.arcTo(x,y+h,x,y+h-r,r);
  cx.lineTo(x,y+r);cx.arcTo(x,y,x+r,y,r);cx.closePath();
}

function drawBullet(cx:CanvasRenderingContext2D,b:Bullet,offX:number,offY:number){
  const bx=b.x-offX,by=b.y-offY;
  cx.save();cx.translate(bx,by);cx.rotate(atan2(b.vy,b.vx));
  if(b.isEvolved){
    // Evolved: big ink orb with glow + ink trail
    cx.save();cx.shadowBlur=18;cx.shadowColor='rgba(200,200,232,0.4)';
    // Outer glow
    const evoGlow=cx.createRadialGradient(0,0,0,0,0,b.r*2.5);
    evoGlow.addColorStop(0,'rgba(200,200,232,0.2)');evoGlow.addColorStop(1,'rgba(0,0,0,0)');
    cx.globalAlpha=0.4;cx.fillStyle=evoGlow;cx.beginPath();cx.arc(0,0,b.r*2.5,0,TAU);cx.fill();
    // Ink body with gradient
    const evoBody=cx.createRadialGradient(-b.r*0.3,-b.r*0.3,0,0,0,b.r);
    evoBody.addColorStop(0,C.inkLt);evoBody.addColorStop(0.6,C.ink);evoBody.addColorStop(1,'#303060');
    cx.globalAlpha=0.8;cx.fillStyle=evoBody;cx.beginPath();
    for(let i=0;i<=8;i++){const a=(i/8)*TAU;const r=b.r*(0.8+sin(a*3)*0.3);
      i===0?cx.moveTo(cos(a)*r,sin(a)*r):cx.lineTo(cos(a)*r,sin(a)*r)}
    cx.closePath();cx.fill();
    // Core
    cx.globalAlpha=0.5;cx.fillStyle=C.red;cx.beginPath();cx.arc(0,0,b.r*0.4,0,TAU);cx.fill();
    cx.shadowBlur=0;cx.restore();
    // Trail
    cx.globalAlpha=0.2;cx.fillStyle=C.inkLt;cx.beginPath();cx.ellipse(-b.r*2,0,b.r*2,b.r*0.5,0,0,TAU);cx.fill();
  } else {
    // Trail gradient
    const trailGrad=cx.createLinearGradient(-12,0,b.r,0);
    trailGrad.addColorStop(0,'rgba(200,200,232,0)');trailGrad.addColorStop(0.5,'rgba(200,200,232,0.2)');trailGrad.addColorStop(1,C.inkLt);
    cx.globalAlpha=0.4;cx.fillStyle=trailGrad;cx.beginPath();cx.ellipse(-5,0,10,2.5,0,0,TAU);cx.fill();
    // Bullet body with gradient
    cx.save();cx.shadowBlur=6;cx.shadowColor='rgba(200,200,232,0.4)';
    const bGrad=cx.createRadialGradient(-1,-0.5,0,0,0,b.r+1);
    bGrad.addColorStop(0,C.white);bGrad.addColorStop(0.3,C.inkLt);bGrad.addColorStop(1,C.ink);
    cx.globalAlpha=0.95;cx.fillStyle=bGrad;cx.beginPath();cx.ellipse(0,0,b.r+1.5,b.r*0.7,0,0,TAU);cx.fill();
    cx.shadowBlur=0;cx.restore();
    // Tip glow
    cx.globalAlpha=0.6;
    const tipGrad=cx.createRadialGradient(b.r+1,0,0,b.r+1,0,2.5);
    tipGrad.addColorStop(0,C.gold);tipGrad.addColorStop(1,'rgba(240,184,64,0)');
    cx.fillStyle=tipGrad;cx.beginPath();cx.arc(b.r+1,0,2.5,0,TAU);cx.fill();
  }
  cx.restore();
}

function drawEnemyBullet(cx:CanvasRenderingContext2D,b:EnemyBullet,offX:number,offY:number){
  const bx=b.x-offX,by=b.y-offY;
  cx.save();
  // Outer glow
  cx.shadowBlur=10;cx.shadowColor='rgba(224,48,80,0.4)';
  const ebGlow=cx.createRadialGradient(bx,by,0,bx,by,b.r*2);
  ebGlow.addColorStop(0,'rgba(255,104,136,0.3)');ebGlow.addColorStop(1,'rgba(0,0,0,0)');
  cx.globalAlpha=0.5;cx.fillStyle=ebGlow;cx.beginPath();cx.arc(bx,by,b.r*2,0,TAU);cx.fill();
  // Body with gradient
  const ebBody=cx.createRadialGradient(bx-b.r*0.2,by-b.r*0.2,0,bx,by,b.r);
  ebBody.addColorStop(0,C.redLt);ebBody.addColorStop(0.5,C.red);ebBody.addColorStop(1,C.redDk);
  cx.globalAlpha=0.9;cx.fillStyle=ebBody;cx.beginPath();cx.arc(bx,by,b.r,0,TAU);cx.fill();
  // Core
  cx.globalAlpha=0.4;cx.fillStyle=C.white;cx.beginPath();cx.arc(bx-b.r*0.2,by-b.r*0.2,b.r*0.3,0,TAU);cx.fill();
  cx.shadowBlur=0;cx.restore();
}

function drawGem(cx:CanvasRenderingContext2D,g:Gem,offX:number,offY:number){
  const gx=g.x-offX,gy=g.y-offY+sin(g.animT*4)*3;
  if(g.isCoin){
    // Metallic coin with spinning effect + glow
    const sz=5.5;const spinW=abs(cos(g.animT*5))*sz;
    cx.save();
    cx.shadowBlur=8;cx.shadowColor='rgba(240,184,64,0.5)';
    // Glow
    const coinGlow=cx.createRadialGradient(gx,gy,0,gx,gy,sz+5);
    coinGlow.addColorStop(0,'rgba(240,184,64,0.25)');coinGlow.addColorStop(1,'rgba(0,0,0,0)');
    cx.globalAlpha=0.5+sin(g.animT*3)*0.15;cx.fillStyle=coinGlow;cx.beginPath();cx.arc(gx,gy,sz+5,0,TAU);cx.fill();
    // Coin body with metallic gradient
    const coinGrad=cx.createLinearGradient(gx-spinW,gy-sz,gx+spinW,gy+sz);
    coinGrad.addColorStop(0,C.goldLt);coinGrad.addColorStop(0.3,C.gold);coinGrad.addColorStop(0.7,C.goldDk);coinGrad.addColorStop(1,C.goldLt);
    cx.globalAlpha=0.95;cx.fillStyle=coinGrad;
    cx.beginPath();cx.ellipse(gx,gy,max(2,spinW),sz,0,0,TAU);cx.fill();
    cx.strokeStyle='#a07820';cx.lineWidth=0.8;cx.stroke();
    // Shine highlight
    if(spinW>3){cx.globalAlpha=0.4;cx.fillStyle=C.white;
      cx.beginPath();cx.ellipse(gx-1,gy-1.5,1.5,2.5,0,0,TAU);cx.fill();}
    cx.shadowBlur=0;cx.restore();return;
  }
  // Experience gem with radial gradient + pulsing glow + particle orbit
  const sz=g.value>=5?6.5:g.value>=3?5.5:4.5;
  const gemColor=g.value>=5?C.gold:g.value>=3?C.blueLt:C.greenLt;
  const gemColorDk=g.value>=5?C.goldDk:g.value>=3?C.blue:C.green;
  cx.save();
  cx.shadowBlur=10;cx.shadowColor=gemColor;
  // Pulsing outer glow
  const pulse=0.2+sin(g.animT*4)*0.1;
  const gemGlow=cx.createRadialGradient(gx,gy,0,gx,gy,sz+6);
  gemGlow.addColorStop(0,gemColor);gemGlow.addColorStop(0.4,'rgba(0,0,0,0.1)');gemGlow.addColorStop(1,'rgba(0,0,0,0)');
  cx.globalAlpha=pulse;cx.fillStyle=gemGlow;cx.beginPath();cx.arc(gx,gy,sz+6,0,TAU);cx.fill();
  // Gem body with radial gradient
  const gemBody=cx.createRadialGradient(gx-sz*0.2,gy-sz*0.3,0,gx,gy,sz);
  gemBody.addColorStop(0,C.white);gemBody.addColorStop(0.3,gemColor);gemBody.addColorStop(1,gemColorDk);
  cx.globalAlpha=0.95;cx.fillStyle=gemBody;
  cx.beginPath();cx.moveTo(gx,gy-sz);cx.lineTo(gx+sz*0.7,gy);cx.lineTo(gx,gy+sz);cx.lineTo(gx-sz*0.7,gy);cx.closePath();cx.fill();
  // Highlight
  cx.globalAlpha=0.5;cx.fillStyle=C.white;
  cx.beginPath();cx.moveTo(gx,gy-sz*0.6);cx.lineTo(gx+sz*0.3,gy-sz*0.1);cx.lineTo(gx-sz*0.1,gy-sz*0.1);cx.closePath();cx.fill();
  // Orbiting particle
  const orbA=g.animT*6;
  cx.globalAlpha=0.4;cx.fillStyle=C.white;
  cx.beginPath();cx.arc(gx+cos(orbA)*sz*1.2,gy+sin(orbA)*sz*1.2,1,0,TAU);cx.fill();
  cx.shadowBlur=0;cx.restore();
}

function drawChest(cx:CanvasRenderingContext2D,ch:Chest,offX:number,offY:number){
  const x=ch.x-offX,y=ch.y-offY+sin(ch.animT*2)*2;
  cx.save();
  // Ground shadow
  cx.globalAlpha=0.15;
  const chShadow=cx.createRadialGradient(x,y+14,0,x,y+14,18);
  chShadow.addColorStop(0,'rgba(0,0,0,0.3)');chShadow.addColorStop(1,'rgba(0,0,0,0)');
  cx.fillStyle=chShadow;cx.beginPath();cx.ellipse(x,y+14,18,6,0,0,TAU);cx.fill();
  // Golden glow aura
  cx.shadowBlur=20;cx.shadowColor='rgba(240,184,64,0.4)';
  const chGlow=cx.createRadialGradient(x,y,0,x,y,28);
  chGlow.addColorStop(0,'rgba(240,184,64,0.2)');chGlow.addColorStop(0.5,'rgba(240,184,64,0.08)');chGlow.addColorStop(1,'rgba(0,0,0,0)');
  cx.globalAlpha=0.3+sin(ch.animT*3)*0.15;cx.fillStyle=chGlow;cx.beginPath();cx.arc(x,y,28,0,TAU);cx.fill();
  cx.shadowBlur=0;
  // Box body with gradient
  const boxGrad=cx.createLinearGradient(x-12,y-8,x-12,y+8);
  boxGrad.addColorStop(0,C.goldDk);boxGrad.addColorStop(0.5,'#8a6820');boxGrad.addColorStop(1,'#604810');
  cx.globalAlpha=0.95;cx.fillStyle=boxGrad;
  roundRect(cx,x-12,y-6,24,16,3);cx.fill();
  cx.strokeStyle='#3a2808';cx.lineWidth=1.5;cx.stroke();
  // Metal bands
  cx.globalAlpha=0.4;cx.fillStyle='#a08030';
  cx.fillRect(x-12,y-2,24,2);cx.fillRect(x-12,y+4,24,2);
  // Lid with gradient
  const lidGrad=cx.createLinearGradient(x-14,y-12,x-14,y-4);
  lidGrad.addColorStop(0,C.goldLt);lidGrad.addColorStop(0.5,C.gold);lidGrad.addColorStop(1,C.goldDk);
  cx.globalAlpha=0.95;cx.fillStyle=lidGrad;
  roundRect(cx,x-14,y-12,28,8,3);cx.fill();
  cx.strokeStyle='#3a2808';cx.lineWidth=1.5;cx.stroke();
  // Lid highlight
  cx.globalAlpha=0.25;cx.fillStyle=C.white;
  roundRect(cx,x-12,y-11,24,3,2);cx.fill();
  // Lock gem (glowing ruby)
  cx.save();cx.shadowBlur=6;cx.shadowColor='rgba(224,48,80,0.6)';
  const lockGrad=cx.createRadialGradient(x-0.5,y-0.5,0,x,y,3.5);
  lockGrad.addColorStop(0,C.redLt);lockGrad.addColorStop(0.5,C.red);lockGrad.addColorStop(1,C.redDk);
  cx.globalAlpha=0.95;cx.fillStyle=lockGrad;cx.beginPath();cx.arc(x,y,3.5,0,TAU);cx.fill();
  cx.fillStyle=C.white;cx.globalAlpha=0.3;cx.beginPath();cx.arc(x-1,y-1,1,0,TAU);cx.fill();
  cx.shadowBlur=0;cx.restore();
  // HP dots (small gems)
  cx.globalAlpha=0.8;
  for(let i=0;i<ch.hp;i++){
    const dotGrad=cx.createRadialGradient(x-5+i*6,y+16,0,x-5+i*6,y+16,2.5);
    dotGrad.addColorStop(0,C.redLt);dotGrad.addColorStop(1,C.red);
    cx.fillStyle=dotGrad;cx.beginPath();cx.arc(x-5+i*6,y+16,2.5,0,TAU);cx.fill();}
  cx.restore();
}

function drawMinimap(cx:CanvasRenderingContext2D){
  const mapR=35,mapX=W-mapR-12,mapY=mapR+62;
  const scale=mapR/ARENA_R;
  cx.save();
  // Background with gradient
  const mapBg=cx.createRadialGradient(mapX,mapY,0,mapX,mapY,mapR);
  mapBg.addColorStop(0,'rgba(10,10,30,0.25)');mapBg.addColorStop(1,'rgba(10,10,30,0.4)');
  cx.fillStyle=mapBg;cx.beginPath();cx.arc(mapX,mapY,mapR,0,TAU);cx.fill();
  // Border
  cx.globalAlpha=0.35;cx.strokeStyle='#404070';cx.lineWidth=1;cx.beginPath();cx.arc(mapX,mapY,mapR,0,TAU);cx.stroke();
  // Enemies (dots with glow for bosses)
  for(const e of enemies){
    const dx=(e.x-player.x)*scale,dy=(e.y-player.y)*scale;
    if(dx*dx+dy*dy>mapR*mapR)continue;
    if(e.isBoss){
      cx.save();cx.shadowBlur=4;cx.shadowColor='rgba(224,48,80,0.5)';
      cx.globalAlpha=0.8;cx.fillStyle=C.red;
      cx.beginPath();cx.arc(mapX+dx,mapY+dy,3,0,TAU);cx.fill();
      cx.shadowBlur=0;cx.restore();
    }else{
      cx.globalAlpha=0.5;cx.fillStyle=C.red;
      cx.beginPath();cx.arc(mapX+dx,mapY+dy,1.2,0,TAU);cx.fill();
    }
  }
  // Chests
  cx.globalAlpha=0.7;cx.fillStyle=C.gold;
  for(const ch of chests){
    const dx=(ch.x-player.x)*scale,dy=(ch.y-player.y)*scale;
    cx.beginPath();cx.arc(mapX+dx,mapY+dy,2,0,TAU);cx.fill();
  }
  // Player (with glow)
  cx.save();cx.shadowBlur=5;cx.shadowColor='rgba(200,200,232,0.5)';
  cx.globalAlpha=0.95;cx.fillStyle=C.white;
  cx.beginPath();cx.arc(mapX,mapY,2.5,0,TAU);cx.fill();
  cx.shadowBlur=0;cx.restore();
  cx.restore();
}

function drawHUD(cx:CanvasRenderingContext2D){
  // HUD background panel with gradient
  cx.save();
  const hudGrad=cx.createLinearGradient(0,0,0,58);
  hudGrad.addColorStop(0,'rgba(6,6,26,0.75)');hudGrad.addColorStop(0.8,'rgba(6,6,26,0.5)');hudGrad.addColorStop(1,'rgba(6,6,26,0)');
  cx.fillStyle=hudGrad;cx.fillRect(0,0,W,58);
  cx.globalAlpha=0.2;cx.fillStyle='#404080';cx.fillRect(0,56,W,1);cx.restore();

  // ─── HP bar (rounded with gradient + glow when low) ───
  const hpW=125,hpH=11,hpX=12,hpY=28;const hpR=player.hp/player.maxHp;
  cx.save();
  // Background
  cx.globalAlpha=0.35;cx.fillStyle='#0a0a18';
  roundRect(cx,hpX-1,hpY-1,hpW+2,hpH+2,5);cx.fill();
  // HP fill with 3-tone gradient
  const hpGrad=cx.createLinearGradient(hpX,hpY,hpX,hpY+hpH);
  if(hpR>0.6){hpGrad.addColorStop(0,'#ff5070');hpGrad.addColorStop(0.5,C.red);hpGrad.addColorStop(1,'#a01020')}
  else if(hpR>0.3){hpGrad.addColorStop(0,C.goldLt);hpGrad.addColorStop(0.5,C.gold);hpGrad.addColorStop(1,C.goldDk)}
  else{hpGrad.addColorStop(0,'#ff3050');hpGrad.addColorStop(0.5,C.redDk);hpGrad.addColorStop(1,'#600818')}
  cx.globalAlpha=0.95;cx.fillStyle=hpGrad;
  roundRect(cx,hpX,hpY,hpW*hpR,hpH,4);cx.fill();
  // Shine
  cx.globalAlpha=0.25;cx.fillStyle=C.white;
  roundRect(cx,hpX+1,hpY+1,hpW*hpR-2,hpH*0.35,3);cx.fill();
  // Border
  cx.globalAlpha=0.4;cx.strokeStyle='#404060';cx.lineWidth=1;
  roundRect(cx,hpX,hpY,hpW,hpH,4);cx.stroke();
  // Low HP glow effect
  if(hpR<0.3&&hpR>0){
    cx.shadowBlur=12;cx.shadowColor='rgba(224,48,80,0.5)';
    cx.globalAlpha=0.3+sin(gameTimer*6)*0.15;cx.strokeStyle=C.red;cx.lineWidth=2;
    roundRect(cx,hpX-1,hpY-1,hpW+2,hpH+2,5);cx.stroke();
    cx.shadowBlur=0;
  }
  cx.restore();
  // HP text
  cx.save();cx.shadowBlur=3;cx.shadowColor='rgba(0,0,0,0.5)';
  cx.font='900 10px "Noto Serif SC",serif';cx.textAlign='center';cx.fillStyle=C.white;cx.globalAlpha=0.9;
  cx.fillText(`${floor(player.hp)}/${player.maxHp}`,hpX+hpW/2,hpY-3);
  cx.shadowBlur=0;cx.restore();

  // ─── XP bar (sleek with level number + glow pulse near level up) ───
  const xpN=xpToLevel(player.level);const xpR=player.xp/xpN;
  cx.save();
  cx.globalAlpha=0.25;cx.fillStyle='#0a0a18';
  roundRect(cx,hpX,hpY+hpH+3,hpW,4,2);cx.fill();
  const xpGrad=cx.createLinearGradient(hpX,0,hpX+hpW*xpR,0);
  xpGrad.addColorStop(0,C.goldDk);xpGrad.addColorStop(1,C.gold);
  cx.globalAlpha=0.9;cx.fillStyle=xpGrad;
  roundRect(cx,hpX,hpY+hpH+3,hpW*xpR,4,2);cx.fill();
  // XP glow when near level up
  if(xpR>0.8){
    cx.shadowBlur=8;cx.shadowColor='rgba(240,184,64,0.4)';
    cx.globalAlpha=0.4+sin(gameTimer*8)*0.2;cx.strokeStyle=C.gold;cx.lineWidth=1;
    roundRect(cx,hpX-1,hpY+hpH+2,hpW+2,6,3);cx.stroke();
    cx.shadowBlur=0;
  }
  cx.restore();

  // ─── Level badge ───
  cx.save();cx.shadowBlur=4;cx.shadowColor='rgba(0,0,0,0.4)';
  cx.font='900 16px "Noto Serif SC",serif';cx.textAlign='left';cx.fillStyle=C.goldLt;cx.globalAlpha=0.95;
  cx.fillText(`Lv.${player.level}`,hpX+hpW+10,hpY+9);
  cx.shadowBlur=0;cx.restore();

  // ─── Timer (center, styled) ───
  const tL=max(0,GAME_DURATION-gameTimer);const mins=floor(tL/60);const secs=floor(tL%60);
  cx.save();
  if(tL<30){cx.shadowBlur=8;cx.shadowColor='rgba(224,48,80,0.4)'}
  cx.font='900 20px "Noto Serif SC",serif';cx.textAlign='center';
  cx.fillStyle=tL<30?C.red:C.white;cx.globalAlpha=tL<30?0.9+sin(gameTimer*5)*0.1:0.85;
  cx.fillText(`${mins}:${secs.toString().padStart(2,'0')}`,W/2,32);
  cx.shadowBlur=0;cx.restore();

  // ─── Stats panel (kills/coins/wave with background) ───
  cx.save();
  // Panel background
  cx.globalAlpha=0.3;cx.fillStyle='#0a0a20';
  roundRect(cx,W-90,8,80,42,6);cx.fill();
  cx.globalAlpha=0.2;cx.strokeStyle='#404060';cx.lineWidth=0.5;
  roundRect(cx,W-90,8,80,42,6);cx.stroke();
  cx.font='900 12px "Noto Serif SC",serif';cx.textAlign='right';
  cx.shadowBlur=2;cx.shadowColor='rgba(0,0,0,0.4)';
  cx.fillStyle=C.white;cx.globalAlpha=0.8;cx.fillText(`${player.kills} 斩`,W-16,22);
  cx.fillStyle=C.goldLt;cx.globalAlpha=0.8;cx.fillText(`${player.coins} 金`,W-16,36);
  cx.fillStyle=C.inkLt;cx.globalAlpha=0.6;cx.fillText(`第${waveNum}波`,W-16,50);
  cx.shadowBlur=0;cx.globalAlpha=1;cx.restore();
  // Evolution indicator
  if(achievedEvolutions.size>0){
    cx.font='700 10px "Noto Serif SC",serif';cx.textAlign='left';cx.fillStyle=C.gold;cx.globalAlpha=0.7;
    let ey=hpY+hpH+12;
    for(const eid of achievedEvolutions){
      const evo=EVOLUTIONS.find(e=>e.id===eid);
      if(evo){cx.fillText(`★${evo.name}`,hpX,ey);ey+=12}
    }
  }
  // Off-screen enemy indicators
  const margin=20;
  const offscreen=enemies.filter(e=>{const ex=e.x-player.x+W/2,ey=e.y-player.y+H/2;
    return ex<margin||ex>W-margin||ey<55+margin||ey>H-margin})
    .sort((a,b)=>dist(a.x,a.y,player.x,player.y)-dist(b.x,b.y,player.x,player.y)).slice(0,8);
  for(const e of offscreen){
    const ex=e.x-player.x+W/2,ey=e.y-player.y+H/2;
    const a=atan2(ey-H/2,ex-W/2);
    const ix=clamp(W/2+cos(a)*180,margin,W-margin),iy=clamp(H/2+sin(a)*180,55+margin,H-margin);
    cx.save();cx.translate(ix,iy);cx.rotate(a);cx.globalAlpha=e.isBoss?0.8:0.4;
    cx.fillStyle=e.isBoss?C.gold:C.red;
    cx.beginPath();cx.moveTo(8,0);cx.lineTo(-4,-4);cx.lineTo(-4,4);cx.closePath();cx.fill();cx.restore();
  }
  // Enemy count
  if(enemies.length>40){cx.font='700 11px "Noto Serif SC",serif';cx.textAlign='center';
    cx.fillStyle=C.red;cx.globalAlpha=0.6+sin(gameTimer*5)*0.2;cx.fillText(`⚠ ${enemies.length}只妖`,W/2,50);cx.globalAlpha=1}
  // Mobile joystick
  if(moveTouch){cx.save();cx.globalAlpha=0.12;cx.strokeStyle=C.ink;cx.lineWidth=2;
    cx.beginPath();cx.arc(moveTouch.sx,moveTouch.sy,50,0,TAU);cx.stroke();
    cx.globalAlpha=0.25;cx.fillStyle=C.ink;
    cx.beginPath();cx.arc(moveTouch.sx+moveJoy.x*40,moveTouch.sy+moveJoy.y*40,14,0,TAU);cx.fill();cx.restore()}
  // Minimap
  drawMinimap(cx);
  // Pause hint
  cx.font='400 9px sans-serif';cx.textAlign='left';cx.fillStyle=C.inkFaint;cx.globalAlpha=0.3;
  cx.fillText('ESC暂停',4,H-6);cx.globalAlpha=1;
}

// ─── Title screen demon silhouettes ───
interface TitleDemon {x:number;y:number;speed:number;size:number;type:number;alpha:number}
const titleDemons: TitleDemon[] = [];
for(let i=0;i<5;i++){
  titleDemons.push({x:-50-random()*200,y:H*0.5+random()*H*0.2,speed:8+random()*15,
    size:15+random()*25,type:floor(random()*3),alpha:0.04+random()*0.06});
}

// ─── Title screen floating particles ───
interface TitleParticle {x:number;y:number;vx:number;vy:number;size:number;alpha:number;life:number}
const titleParts: TitleParticle[] = [];
for(let i=0;i<30;i++){
  titleParts.push({x:random()*W,y:random()*H,vx:random()*8-4,vy:-5-random()*10,
    size:0.5+random()*2,alpha:0.1+random()*0.3,life:random()*10});
}

function drawTitle(cx:CanvasRenderingContext2D){
  cx.drawImage(paperBuf,0,0);
  drawStars(cx, titleT);

  // ─── Animated ink-wash clouds drifting ───
  drawInkClouds(cx, titleT, 0, 0);

  drawMoon(cx, titleT);

  // ─── Mountains (layered with depth) ───
  // Far mountains
  cx.save();cx.globalAlpha=0.06;cx.fillStyle='#141838';cx.beginPath();cx.moveTo(0,H*0.65);
  for(let i=0;i<=30;i++)cx.lineTo(i/30*W,H*0.65-sin(i*0.6)*H*0.12-cos(i*1.1)*H*0.06);
  cx.lineTo(W,H*0.65);cx.lineTo(W,H*0.75);cx.lineTo(0,H*0.75);cx.closePath();cx.fill();cx.restore();
  // Near mountains
  cx.save();cx.globalAlpha=0.1;cx.fillStyle='#0c0c28';cx.beginPath();cx.moveTo(0,H*0.72);
  for(let i=0;i<=25;i++)cx.lineTo(i/25*W,H*0.72-sin(i*0.8+1)*H*0.1-cos(i*1.4)*H*0.05);
  cx.lineTo(W,H*0.72);cx.lineTo(W,H*0.8);cx.lineTo(0,H*0.8);cx.closePath();cx.fill();cx.restore();

  // ─── Demon silhouettes passing across screen ───
  for(const d of titleDemons){
    d.x+=d.speed*0.016;
    if(d.x>W+100){d.x=-50-random()*100;d.y=H*0.45+random()*H*0.25}
    cx.save();cx.globalAlpha=d.alpha;cx.fillStyle='#0a0a20';
    cx.translate(d.x,d.y);
    // Simple demon silhouette shapes
    cx.beginPath();
    if(d.type===0){// Blob shape
      for(let i=0;i<=8;i++){const a=(i/8)*TAU;const r=d.size*(1+sin(a*3+titleT)*0.2);
        i===0?cx.moveTo(cos(a)*r,sin(a)*r):cx.lineTo(cos(a)*r,sin(a)*r)}
    }else if(d.type===1){// Winged shape
      cx.ellipse(0,0,d.size,d.size*0.6,0,0,TAU);
      cx.moveTo(-d.size*1.5,-d.size*0.3);cx.quadraticCurveTo(-d.size,d.size*sin(titleT*2)*0.3-d.size*0.8,0,0);
      cx.moveTo(d.size*1.5,-d.size*0.3);cx.quadraticCurveTo(d.size,d.size*sin(titleT*2+1)*0.3-d.size*0.8,0,0);
    }else{// Tall narrow shape
      cx.ellipse(0,0,d.size*0.5,d.size*0.8,0,0,TAU);
    }
    cx.closePath();cx.fill();
    // Red eyes
    cx.globalAlpha=d.alpha*3;cx.fillStyle=C.red;
    cx.beginPath();cx.arc(-d.size*0.15,-d.size*0.1,1.5,0,TAU);cx.arc(d.size*0.15,-d.size*0.1,1.5,0,TAU);cx.fill();
    cx.restore();
  }

  // ─── Floating particles ───
  for(const p of titleParts){
    p.x+=p.vx*0.016;p.y+=p.vy*0.016;p.life-=0.016;
    if(p.life<=0||p.y<-10){p.x=random()*W;p.y=H+10;p.life=5+random()*5;p.vy=-5-random()*10}
    cx.save();cx.globalAlpha=p.alpha*min(1,p.life);cx.fillStyle=C.inkFaint;
    cx.beginPath();cx.arc(p.x,p.y,p.size,0,TAU);cx.fill();cx.restore();
  }

  // ─── Ornament rings with glow ───
  const pulse=sin(titleT*1.5)*0.08;
  cx.save();cx.shadowBlur=10;cx.shadowColor='rgba(240,232,192,0.1)';
  cx.globalAlpha=0.05+pulse;cx.strokeStyle=C.moon;cx.lineWidth=1;
  [90,110,130,150].forEach(r=>{cx.beginPath();cx.arc(W/2,H*0.30,r,0,TAU);cx.stroke()});
  cx.shadowBlur=0;cx.restore();

  // ─── Title "百妖长夜" with calligraphy ink-drip effect + glow ───
  cx.save();
  cx.textAlign='center';cx.textBaseline='middle';
  // Ink drip decorations below title
  cx.globalAlpha=0.12;cx.fillStyle=C.ink;
  const drips=[{x:W/2-60,h:12},{x:W/2-20,h:18},{x:W/2+30,h:8},{x:W/2+65,h:15}];
  for(const d of drips){
    cx.beginPath();cx.moveTo(d.x,H*0.28);cx.lineTo(d.x+1.5,H*0.28+d.h+sin(titleT*2+d.x)*3);
    cx.lineTo(d.x+3,H*0.28);cx.fill();
    // Drip blob at bottom
    cx.beginPath();cx.arc(d.x+1.5,H*0.28+d.h+sin(titleT*2+d.x)*3,2,0,TAU);cx.fill();
  }
  // Shadow
  cx.font='900 54px "Noto Serif SC",serif';
  cx.fillStyle='#000000';cx.globalAlpha=0.3;cx.fillText('百妖长夜',W/2+3,H*0.24+3);
  // Glow behind text
  cx.shadowBlur=25;cx.shadowColor='rgba(200,200,232,0.3)';
  cx.fillStyle=C.ink;cx.globalAlpha=0.95;cx.fillText('百妖长夜',W/2,H*0.24);
  cx.shadowBlur=0;
  // Highlight pass
  cx.globalAlpha=0.15;cx.fillStyle=C.white;cx.fillText('百妖长夜',W/2-1,H*0.24-1);
  cx.restore();

  // Subtitle
  cx.font='700 13px "Noto Serif SC",serif';cx.textAlign='center';cx.fillStyle=C.inkFaint;cx.globalAlpha=0.6;
  cx.fillText("Melo's Quest: Endless Demon Night",W/2,H*0.31);
  // Series title
  cx.font='900 18px "Noto Serif SC",serif';cx.fillStyle=C.red;cx.globalAlpha=0.85;
  cx.save();cx.shadowBlur=8;cx.shadowColor='rgba(224,48,80,0.3)';
  cx.fillText('麦洛的冒险',W/2,H*0.37);cx.shadowBlur=0;cx.restore();

  // ─── Seal stamp (enhanced with texture) ───
  cx.save();cx.translate(W*0.82,H*0.20);cx.rotate(-0.1);
  // Stamp shadow
  cx.globalAlpha=0.15;cx.fillStyle='#000';cx.fillRect(-19,-19,40,40);
  // Stamp body
  cx.fillStyle=C.red;cx.globalAlpha=0.65;cx.fillRect(-20,-20,40,40);
  // Stamp border wear
  cx.globalAlpha=0.2;cx.strokeStyle=C.redDk;cx.lineWidth=2;cx.strokeRect(-20,-20,40,40);
  cx.fillStyle=C.paper;cx.globalAlpha=0.92;cx.font='900 16px "Noto Serif SC",serif';cx.textAlign='center';cx.textBaseline='middle';
  cx.fillText('麦洛',0,0);cx.restore();

  // ─── Menu buttons (styled cards with background + border) ───
  const btnH0=52;const btnHN=38;const gap=7;const btnW=240;const btnW0=260;
  const btnY0=H*0.52;
  const btns=[
    {text:'开始战斗',color:C.white,accent:C.red,h:btnH0,w:btnW0,y:btnY0},
    {text:`强化 · ${meta.coins}金`,color:C.goldLt,accent:C.gold,h:btnHN,w:btnW,y:btnY0+btnH0/2+gap+btnHN/2},
    {text:`角色 · ${getChar().name}`,color:C.bluePale,accent:C.blueLt,h:btnHN,w:btnW,y:btnY0+btnH0/2+gap+(btnHN+gap)+btnHN/2},
    {text:'排行榜',color:C.inkLt,accent:C.ink,h:btnHN,w:btnW,y:btnY0+btnH0/2+gap+(btnHN+gap)*2+btnHN/2},
    {text:`每日挑战`,color:C.redLt,accent:C.red,h:btnHN,w:btnW,y:btnY0+btnH0/2+gap+(btnHN+gap)*3+btnHN/2},
  ];
  for(let i=0;i<btns.length;i++){
    const b=btns[i];const bx=W/2-b.w/2,by=b.y-b.h/2;
    cx.save();
    // Button background
    const btnGrad=cx.createLinearGradient(bx,by,bx,by+b.h);
    if(i===0){
      btnGrad.addColorStop(0,'rgba(60,15,25,0.6)');btnGrad.addColorStop(1,'rgba(30,8,15,0.8)');
    }else{
      btnGrad.addColorStop(0,'rgba(20,20,50,0.5)');btnGrad.addColorStop(1,'rgba(10,10,30,0.7)');
    }
    cx.globalAlpha=0.85;cx.fillStyle=btnGrad;
    roundRect(cx,bx,by,b.w,b.h,i===0?12:8);cx.fill();
    // Border
    cx.globalAlpha=i===0?0.7:0.3;cx.strokeStyle=b.accent;cx.lineWidth=i===0?2:1;
    roundRect(cx,bx,by,b.w,b.h,i===0?12:8);cx.stroke();
    // First button gets animated glow
    if(i===0){
      cx.shadowBlur=18;cx.shadowColor=b.accent;
      cx.globalAlpha=0.2+sin(titleT*3)*0.12;cx.strokeStyle=b.accent;cx.lineWidth=2.5;
      roundRect(cx,bx-2,by-2,b.w+4,b.h+4,14);cx.stroke();
      cx.shadowBlur=0;
      // Inner glow
      cx.globalAlpha=0.06+sin(titleT*2)*0.03;
      const iglow=cx.createRadialGradient(W/2,b.y,0,W/2,b.y,b.w*0.5);
      iglow.addColorStop(0,'rgba(224,48,80,0.2)');iglow.addColorStop(1,'rgba(224,48,80,0)');
      cx.fillStyle=iglow;cx.fillRect(bx,by,b.w,b.h);
    }
    // Text
    cx.globalAlpha=0.97;
    cx.font=i===0?'900 22px "Noto Serif SC",serif':'700 15px "Noto Serif SC",serif';
    cx.textAlign='center';cx.fillStyle=b.color;
    // Text shadow for start button
    if(i===0){cx.shadowBlur=6;cx.shadowColor='rgba(224,48,80,0.4)'}
    cx.fillText(b.text,W/2,b.y+(i===0?2:1));
    cx.shadowBlur=0;
    cx.restore();
  }

  // Player name display
  if(passport.playerName&&passport.playerName!=='旅行者'){
    cx.font='400 13px "Noto Serif SC",serif';cx.textAlign='center';cx.fillStyle=C.goldLt;cx.globalAlpha=0.7;
    cx.fillText(`${passport.playerName} · 麦洛护照`,W/2,H*0.44);
    cx.font='400 10px "Noto Serif SC",serif';cx.fillStyle=C.inkFaint;cx.globalAlpha=0.4;
    cx.fillText('点击改名',W/2,H*0.47);
  } else {
    cx.font='400 11px "Noto Serif SC",serif';cx.textAlign='center';cx.fillStyle=C.inkFaint;cx.globalAlpha=0.4;
    cx.fillText('点击取名',W/2,H*0.44);
  }

  // ─── Stats ───
  cx.font='400 11px "Noto Serif SC",serif';cx.textAlign='center';cx.fillStyle=C.inkFaint;cx.globalAlpha=0.45;
  cx.fillText(`${meta.runs}局 · ${meta.totalKills}斩 · 最高${meta.bestKills}斩`,W/2,H*0.90);

  // ─── Credits with subtle styling ───
  cx.font='400 10px "Noto Serif SC",serif';cx.fillStyle=C.inkFaint;cx.globalAlpha=0.3;
  cx.fillText('JoyBoy Games × 水墨山海',W/2,H*0.935);
  cx.font='400 10px "Noto Serif SC",serif';cx.globalAlpha=0.2;
  cx.fillText('麦洛的冒险 · 第一章',W/2,H*0.96);cx.globalAlpha=1;
}

function drawShop(cx:CanvasRenderingContext2D){
  cx.drawImage(paperBuf,0,0);
  drawStars(cx, performance.now()/1000);
  // Title with glow
  cx.save();cx.shadowBlur=12;cx.shadowColor='rgba(200,200,232,0.2)';
  cx.font='900 32px "Noto Serif SC",serif';cx.textAlign='center';cx.textBaseline='middle';
  cx.fillStyle=C.white;cx.globalAlpha=0.95;cx.fillText('永久强化',W/2,H*0.15);
  cx.shadowBlur=0;cx.restore();
  cx.font='700 14px "Noto Serif SC",serif';cx.fillStyle=C.goldLt;cx.globalAlpha=0.85;cx.textAlign='center';
  cx.fillText(`持有 ${meta.coins} 金`,W/2,H*0.22);
  const permKeys = Object.keys(PERM_NAMES) as (keyof typeof PERM_NAMES)[];
  const startY=H*0.3;
  for(let i=0;i<permKeys.length;i++){
    const k=permKeys[i];const info=PERM_NAMES[k];
    const level=(meta[k as keyof Meta] as number);
    const bx=W/2-85,by=startY+i*58,bw=170,bh=48;
    cx.save();
    // Card background with gradient
    const shopCardGrad=cx.createLinearGradient(bx,by,bx,by+bh);
    shopCardGrad.addColorStop(0,'rgba(18,18,48,0.85)');shopCardGrad.addColorStop(1,'rgba(10,10,28,0.9)');
    cx.globalAlpha=0.95;cx.fillStyle=shopCardGrad;
    roundRect(cx,bx,by,bw,bh,8);cx.fill();
    // Border
    cx.strokeStyle=info.color;cx.lineWidth=1;cx.globalAlpha=0.5;
    roundRect(cx,bx,by,bw,bh,8);cx.stroke();
    // Content
    cx.globalAlpha=0.95;cx.font='900 14px "Noto Serif SC",serif';cx.textAlign='left';cx.fillStyle=C.white;
    cx.fillText(`${info.name} Lv.${level}/5`,bx+12,by+19);
    cx.font='400 10px "Noto Serif SC",serif';cx.fillStyle=C.inkLt;
    cx.fillText(info.desc,bx+12,by+34);
    if(level<5){
      const cost=PERM_COSTS[level];
      cx.textAlign='right';cx.font='700 12px "Noto Serif SC",serif';
      cx.fillStyle=meta.coins>=cost?C.goldLt:C.inkFaint;
      cx.fillText(`${cost}金`,bx+bw-12,by+26);
    } else {cx.textAlign='right';cx.font='700 12px "Noto Serif SC",serif';cx.fillStyle=C.greenLt;cx.fillText('MAX',bx+bw-12,by+26)}
    // Level pips (glowing when filled)
    for(let j=0;j<5;j++){
      cx.save();
      if(j<level){cx.shadowBlur=4;cx.shadowColor=info.color}
      cx.globalAlpha=j<level?0.9:0.2;cx.fillStyle=j<level?info.color:C.inkFaint;
      cx.beginPath();cx.arc(bx+14+j*13,by+bh-7,3.5,0,TAU);cx.fill();
      cx.shadowBlur=0;cx.restore();
    }
    cx.restore();
  }
  // Back button
  cx.save();cx.globalAlpha=0.5;cx.fillStyle='rgba(20,20,50,0.4)';
  roundRect(cx,W/2-60,H*0.86,120,28,8);cx.fill();
  cx.globalAlpha=0.5;cx.font='700 14px "Noto Serif SC",serif';cx.textAlign='center';cx.fillStyle=C.inkLt;
  cx.fillText('ESC 返回',W/2,H*0.875);cx.restore();cx.globalAlpha=1;
}

function getUpgradePreview(id:string):string{
  switch(id){
    case'锋矢':return `${player.bulletDmg} → ${player.bulletDmg+4} 攻击`;
    case'连珠':return `${player.bulletCount} → ${player.bulletCount+1} 弹数`;
    case'穿杨':return `${player.bulletPierce} → ${player.bulletPierce+1} 穿透`;
    case'疾风':return `${floor(1000/player.shootCD)}→${floor(1000/(player.shootCD*0.85))} 射速`;
    case'弹速':return `${floor(player.bulletSpeed)} → ${floor(player.bulletSpeed*1.3)} 弹速`;
    case'灵动':return `${floor(player.speed)} → ${floor(player.speed*1.15)} 移速`;
    case'坚甲':return `${player.maxHp} → ${player.maxHp+25} HP`;
    case'回春':return `+2/秒 (现${player.hpRegen}/秒)`;
    case'会心':return `${floor(player.critChance*100)}% → ${floor((player.critChance+0.08)*100)}% 暴击`;
    case'暴伤':return `${floor(player.critMult*100)}% → ${floor((player.critMult+0.5)*100)}% 暴伤`;
    case'吸星':return `${floor(player.xpMagnet)} → ${floor(player.xpMagnet+40)} 吸取`;
    case'环刃':return `${player.orbitalCount} → ${player.orbitalCount+1} 环刃`;
    case'灵气':return player.auraActive?`范围 ${floor(player.auraR)}→${floor(player.auraR+15)}`:'获得灵气场';
    case'雷珠':return `${player.bombCount} → ${player.bombCount+1} 炸弹`;
    default:return '';
  }
}

function drawLevelUp(cx:CanvasRenderingContext2D){
  // Darkened overlay with slight blur-like effect
  cx.save();cx.globalAlpha=0.65;cx.fillStyle='#030310';cx.fillRect(0,0,W,H);cx.restore();
  const isEvo=upgradeChoices.length===1&&EVOLUTIONS.some(e=>e.id===upgradeChoices[0].id);
  if(isEvo){
    // Evolution screen - golden with full glow treatment
    cx.save();cx.shadowBlur=20;cx.shadowColor='rgba(240,184,64,0.5)';
    cx.font='900 30px "Noto Serif SC",serif';cx.textAlign='center';cx.textBaseline='middle';
    cx.fillStyle=C.gold;cx.globalAlpha=0.95;cx.fillText('武器觉醒!',W/2,H*0.2);
    cx.shadowBlur=0;cx.restore();
    const u=upgradeChoices[0];
    const cardW=150,cardH=190,cx2=W/2-cardW/2,cy=H*0.32;
    cx.save();
    // Card glow
    cx.shadowBlur=25;cx.shadowColor='rgba(240,184,64,0.4)';
    // Card background gradient
    const evoCardGrad=cx.createLinearGradient(cx2,cy,cx2,cy+cardH);
    evoCardGrad.addColorStop(0,'#1a1840');evoCardGrad.addColorStop(0.3,'#121230');evoCardGrad.addColorStop(1,'#0a0a20');
    cx.globalAlpha=0.97;cx.fillStyle=evoCardGrad;
    roundRect(cx,cx2,cy,cardW,cardH,12);cx.fill();
    // Gold border
    cx.strokeStyle=C.gold;cx.lineWidth=2.5;cx.globalAlpha=0.9;
    roundRect(cx,cx2,cy,cardW,cardH,12);cx.stroke();
    cx.shadowBlur=0;
    // Icon area gradient
    const iconGrad=cx.createLinearGradient(cx2,cy,cx2,cy+55);
    iconGrad.addColorStop(0,'rgba(240,184,64,0.2)');iconGrad.addColorStop(1,'rgba(0,0,0,0)');
    cx.globalAlpha=1;cx.fillStyle=iconGrad;
    roundRect(cx,cx2,cy,cardW,55,12);cx.fill();
    // Icon
    cx.globalAlpha=0.95;cx.font='900 40px "Noto Serif SC",serif';cx.fillStyle=u.color;cx.textAlign='center';
    cx.fillText(u.icon,W/2,cy+38);
    // Name
    cx.font='900 22px "Noto Serif SC",serif';cx.fillStyle=C.white;cx.fillText(u.name,W/2,cy+80);
    // Desc
    cx.font='400 12px "Noto Serif SC",serif';cx.fillStyle=C.inkLt;cx.fillText(u.desc,W/2,cy+105);
    // Action hint
    cx.font='700 14px "Noto Serif SC",serif';cx.fillStyle=C.gold;cx.globalAlpha=0.5+sin(gameTimer*4)*0.2;
    cx.fillText('点击获取',W/2,cy+cardH-22);cx.restore();
  } else {
    // Level up header with glow
    cx.save();cx.shadowBlur=15;cx.shadowColor='rgba(240,184,64,0.4)';
    cx.font='900 30px "Noto Serif SC",serif';cx.textAlign='center';cx.textBaseline='middle';
    cx.fillStyle=C.gold;cx.globalAlpha=0.95;cx.fillText(`升至 ${player.level} 级`,W/2,H*0.22);
    cx.shadowBlur=0;cx.restore();
    cx.font='700 14px "Noto Serif SC",serif';cx.fillStyle=C.inkLt;cx.globalAlpha=0.6;cx.textAlign='center';
    cx.fillText('选择一项强化',W/2,H*0.28);
    const cardW=110,cardH=165,gap=10,totalW=cardW*3+gap*2;const startX=(W-totalW)/2,startY=H*0.35;
    for(let i=0;i<upgradeChoices.length;i++){
      const u=upgradeChoices[i];const cx2=startX+i*(cardW+gap),cy=startY;
      cx.save();
      // Card background with gradient
      const cardGrad=cx.createLinearGradient(cx2,cy,cx2,cy+cardH);
      cardGrad.addColorStop(0,'#1a1840');cardGrad.addColorStop(0.3,'#121230');cardGrad.addColorStop(1,'#0a0a20');
      cx.globalAlpha=0.95;cx.fillStyle=cardGrad;
      roundRect(cx,cx2,cy,cardW,cardH,10);cx.fill();
      // Border with color accent
      cx.strokeStyle=u.color;cx.lineWidth=1.5;cx.globalAlpha=0.6;
      roundRect(cx,cx2,cy,cardW,cardH,10);cx.stroke();
      // Icon area with color tint
      const iconArea=cx.createLinearGradient(cx2,cy,cx2,cy+42);
      iconArea.addColorStop(0,u.color);iconArea.addColorStop(1,'rgba(0,0,0,0)');
      cx.globalAlpha=0.15;cx.fillStyle=iconArea;
      roundRect(cx,cx2,cy,cardW,42,10);cx.fill();
      // Icon
      cx.globalAlpha=0.95;cx.font='900 28px "Noto Serif SC",serif';cx.textAlign='center';cx.fillStyle=u.color;
      cx.fillText(u.icon,cx2+cardW/2,cy+28);
      // Name
      cx.font='900 15px "Noto Serif SC",serif';cx.fillStyle=C.white;cx.fillText(u.name,cx2+cardW/2,cy+62);
      // Description
      cx.font='400 10px "Noto Serif SC",serif';cx.fillStyle=C.inkLt;cx.fillText(u.desc,cx2+cardW/2,cy+82);
      // Upgrade preview
      const preview=getUpgradePreview(u.id);
      if(preview){cx.font='700 10px "Noto Serif SC",serif';cx.fillStyle=C.greenLt;cx.globalAlpha=0.9;
        cx.fillText(preview,cx2+cardW/2,cy+98)}
      // Current level
      const lvl=player.upgradeCounts[u.id]||0;
      if(lvl>0){cx.font='400 10px "Noto Serif SC",serif';cx.fillStyle=C.gold;cx.globalAlpha=0.6;
        cx.fillText(`已有 ×${lvl}`,cx2+cardW/2,cy+114)}
      // Key hint
      cx.font='700 11px sans-serif';cx.fillStyle=C.inkFaint;cx.globalAlpha=0.4;
      cx.fillText(`[${i+1}]`,cx2+cardW/2,cy+cardH-14);
      cx.restore();
    }
  }
}

function drawPause(cx:CanvasRenderingContext2D){
  cx.save();
  const pauseGrad=cx.createRadialGradient(W/2,H*0.45,50,W/2,H*0.45,W*0.8);
  pauseGrad.addColorStop(0,'rgba(6,6,26,0.65)');pauseGrad.addColorStop(1,'rgba(3,3,16,0.8)');
  cx.fillStyle=pauseGrad;cx.fillRect(0,0,W,H);cx.restore();
  // Title
  cx.save();cx.shadowBlur=15;cx.shadowColor='rgba(200,200,232,0.2)';
  cx.font='900 42px "Noto Serif SC",serif';cx.textAlign='center';cx.textBaseline='middle';
  cx.fillStyle=C.white;cx.globalAlpha=0.9;cx.fillText('暂停',W/2,H*0.38);
  cx.shadowBlur=0;cx.restore();
  cx.font='700 15px "Noto Serif SC",serif';cx.textAlign='center';cx.fillStyle=C.inkLt;cx.globalAlpha=0.55;
  cx.fillText('按 ESC 继续',W/2,H*0.48);
  // Stats panel
  cx.save();cx.globalAlpha=0.4;cx.fillStyle='rgba(18,18,48,0.5)';
  roundRect(cx,W/2-100,H*0.53,200,achievedEvolutions.size>0?80:40,8);cx.fill();cx.restore();
  cx.font='400 13px "Noto Serif SC",serif';cx.fillStyle=C.white;cx.globalAlpha=0.6;cx.textAlign='center';
  cx.fillText(`Lv.${player.level} · ${player.kills}斩 · ${player.coins}金`,W/2,H*0.57);
  if(achievedEvolutions.size>0){
    cx.fillStyle=C.gold;let ey=H*0.63;
    for(const eid of achievedEvolutions){const evo=EVOLUTIONS.find(e=>e.id===eid);
      if(evo){cx.fillText(`★ ${evo.name}`,W/2,ey);ey+=18}}
  }
  cx.globalAlpha=1;
}

function drawVictory(cx:CanvasRenderingContext2D){
  cx.drawImage(paperBuf,0,0);
  drawStars(cx, performance.now()/1000);
  drawMoon(cx, performance.now()/1000);
  // Falling gold coins particle effect (enhanced)
  for(const c of victoryCoins){
    cx.save();cx.translate(c.x,c.y);cx.rotate(c.rot);
    cx.globalAlpha=min(1,c.life)*0.85;
    cx.shadowBlur=6;cx.shadowColor='rgba(240,184,64,0.3)';
    const cw=8*abs(cos(c.rot*2));
    const coinGrad=cx.createLinearGradient(-cw,0,cw,0);
    coinGrad.addColorStop(0,C.goldDk);coinGrad.addColorStop(0.5,C.goldLt);coinGrad.addColorStop(1,C.goldDk);
    cx.fillStyle=coinGrad;cx.beginPath();cx.ellipse(0,0,max(2,cw),8,0,0,TAU);cx.fill();
    cx.strokeStyle='#a07820';cx.lineWidth=0.8;cx.stroke();
    if(cw>4){cx.globalAlpha=0.5;cx.fillStyle=C.white;cx.beginPath();cx.ellipse(-1,-2,1.5,2.5,0,0,TAU);cx.fill();}
    cx.shadowBlur=0;cx.restore();
  }
  // Title with glow
  cx.save();cx.shadowBlur=25;cx.shadowColor='rgba(240,184,64,0.5)';
  cx.font='900 48px "Noto Serif SC",serif';cx.textAlign='center';cx.textBaseline='middle';
  cx.fillStyle=C.gold;cx.globalAlpha=0.95;cx.fillText('通关',W/2,H*0.28);
  cx.shadowBlur=0;cx.restore();
  cx.font='900 20px "Noto Serif SC",serif';cx.fillStyle=C.white;cx.globalAlpha=0.8;cx.textAlign='center';
  cx.fillText('山海妖兽已被镇压',W/2,H*0.38);
  cx.font='700 16px "Noto Serif SC",serif';cx.fillStyle=C.inkLt;cx.globalAlpha=0.75;
  cx.fillText(`${player.kills} 斩 · Lv.${player.level} · ${player.coins} 金`,W/2,H*0.46);
  if(achievedEvolutions.size>0){cx.fillStyle=C.gold;cx.globalAlpha=0.6;
    cx.fillText(`觉醒: ${[...achievedEvolutions].map(id=>EVOLUTIONS.find(e=>e.id===id)?.name).join(' ')}`,W/2,H*0.52)}
  // Styled buttons
  const shareBtnY=H*0.72;
  cx.save();cx.globalAlpha=0.7;cx.fillStyle='rgba(20,20,50,0.5)';
  roundRect(cx,W/2-80,shareBtnY-15,160,30,8);cx.fill();
  cx.strokeStyle=C.gold;cx.lineWidth=1;cx.globalAlpha=0.5;
  roundRect(cx,W/2-80,shareBtnY-15,160,30,8);cx.stroke();
  cx.globalAlpha=0.9;cx.font='700 16px "Noto Serif SC",serif';cx.fillStyle=C.gold;cx.textAlign='center';
  cx.fillText('分享挑战',W/2,shareBtnY+1);cx.restore();
  cx.globalAlpha=0.4+sin(titleT*3)*0.2;cx.fillStyle=C.inkLt;cx.font='700 14px "Noto Serif SC",serif';cx.textAlign='center';
  cx.fillText('点击返回',W/2,H*0.80);cx.globalAlpha=1;
}

function drawDeath(cx:CanvasRenderingContext2D){
  // Dark overlay with gradient
  cx.save();
  const deathGrad=cx.createRadialGradient(W/2,H*0.4,50,W/2,H*0.4,W);
  deathGrad.addColorStop(0,'rgba(10,10,30,0.7)');deathGrad.addColorStop(1,'rgba(3,3,16,0.85)');
  cx.fillStyle=deathGrad;cx.fillRect(0,0,W,H);cx.restore();
  // Title with red glow
  cx.save();cx.shadowBlur=20;cx.shadowColor='rgba(224,48,80,0.3)';
  cx.font='900 44px "Noto Serif SC",serif';cx.textAlign='center';cx.textBaseline='middle';
  cx.fillStyle=C.white;cx.globalAlpha=0.9;cx.fillText('魂归山海',W/2,H*0.3);
  cx.shadowBlur=0;cx.restore();
  cx.font='700 16px "Noto Serif SC",serif';cx.textAlign='center';cx.fillStyle=C.inkLt;cx.globalAlpha=0.7;
  const t=floor(gameTimer),m=floor(t/60),s=t%60;
  const dispName=passport.playerName&&passport.playerName!=='旅行者'?passport.playerName:getChar().name;
  cx.fillText(`${dispName} · 存活 ${m}:${s.toString().padStart(2,'0')}`,W/2,H*0.39);
  // Kill count with glow
  cx.save();cx.shadowBlur=10;cx.shadowColor='rgba(240,184,64,0.3)';
  cx.font='900 34px "Noto Serif SC",serif';cx.fillStyle=C.gold;cx.globalAlpha=0.95;
  cx.fillText(`${player.kills} 斩`,W/2,H*0.47);cx.shadowBlur=0;cx.restore();
  if(player.maxCombo>=10){cx.font='700 14px "Noto Serif SC",serif';cx.fillStyle=C.redLt;cx.globalAlpha=0.7;cx.textAlign='center';
    cx.fillText(`最高 ${player.maxCombo} 连斩`,W/2,H*0.53)}
  cx.font='700 14px "Noto Serif SC",serif';cx.textAlign='center';cx.fillStyle=C.goldLt;cx.globalAlpha=0.6;
  cx.fillText(`获得 ${player.coins} 金`,W/2,H*0.58);
  if(achievedEvolutions.size>0){cx.fillStyle=C.gold;cx.globalAlpha=0.5;
    cx.fillText(`觉醒: ${[...achievedEvolutions].map(id=>EVOLUTIONS.find(e=>e.id===id)?.name).join(' ')}`,W/2,H*0.63)}
  // Styled buttons
  const shareBtnY=H*0.72;
  cx.save();cx.globalAlpha=0.7;cx.fillStyle='rgba(20,20,50,0.5)';
  roundRect(cx,W/2-80,shareBtnY-15,160,30,8);cx.fill();
  cx.strokeStyle=C.gold;cx.lineWidth=1;cx.globalAlpha=0.4;
  roundRect(cx,W/2-80,shareBtnY-15,160,30,8);cx.stroke();
  cx.globalAlpha=0.9;cx.font='700 16px "Noto Serif SC",serif';cx.fillStyle=C.gold;cx.textAlign='center';
  cx.fillText('分享挑战',W/2,shareBtnY+1);cx.restore();
  cx.globalAlpha=0.4+sin(titleT*3)*0.2;cx.fillStyle=C.inkLt;cx.font='700 14px "Noto Serif SC",serif';cx.textAlign='center';
  cx.fillText('点击返回',W/2,H*0.80);cx.globalAlpha=1;
}

function drawRevive(cx:CanvasRenderingContext2D){
  cx.save();
  const revGrad=cx.createRadialGradient(W/2,H*0.4,50,W/2,H*0.4,W);
  revGrad.addColorStop(0,'rgba(10,10,30,0.75)');revGrad.addColorStop(1,'rgba(3,3,16,0.9)');
  cx.fillStyle=revGrad;cx.fillRect(0,0,W,H);cx.restore();
  // Title
  cx.save();cx.shadowBlur=15;cx.shadowColor='rgba(224,48,80,0.3)';
  cx.font='900 36px "Noto Serif SC",serif';cx.textAlign='center';cx.textBaseline='middle';
  cx.fillStyle=C.white;cx.globalAlpha=0.9;cx.fillText('你已倒下',W/2,H*0.3);
  cx.shadowBlur=0;cx.restore();
  // Countdown with glow
  const tLeft=max(0,reviveTimer);
  cx.save();
  cx.shadowBlur=20;cx.shadowColor=tLeft<2?'rgba(224,48,80,0.5)':'rgba(240,184,64,0.5)';
  cx.font='900 60px "Noto Serif SC",serif';cx.textAlign='center';cx.fillStyle=tLeft<2?C.red:C.gold;
  cx.globalAlpha=0.85+sin(titleT*5)*0.15;cx.fillText(`${floor(tLeft+1)}`,W/2,H*0.4);
  cx.shadowBlur=0;cx.restore();
  // Revive button (styled)
  cx.save();
  const revBtnGrad=cx.createLinearGradient(W/2-80,H*0.47,W/2-80,H*0.47+40);
  revBtnGrad.addColorStop(0,C.goldLt);revBtnGrad.addColorStop(0.5,C.gold);revBtnGrad.addColorStop(1,C.goldDk);
  cx.globalAlpha=0.95;cx.fillStyle=revBtnGrad;
  roundRect(cx,W/2-80,H*0.47,160,40,10);cx.fill();
  cx.strokeStyle='#a07820';cx.lineWidth=1;cx.globalAlpha=0.5;
  roundRect(cx,W/2-80,H*0.47,160,40,10);cx.stroke();
  cx.fillStyle='#1a1010';cx.globalAlpha=0.95;cx.font='900 18px "Noto Serif SC",serif';cx.textAlign='center';
  cx.fillText(`复活 (${REVIVE_COST}金)`,W/2,H*0.49+20);
  cx.restore();
  // Give up
  cx.globalAlpha=0.4;cx.fillStyle=C.inkLt;cx.font='700 14px "Noto Serif SC",serif';cx.textAlign='center';
  cx.fillText('放弃',W/2,H*0.62);cx.globalAlpha=1;
}

function drawCharSelect(cx:CanvasRenderingContext2D){
  cx.drawImage(paperBuf,0,0);
  drawStars(cx, performance.now()/1000);
  drawMoon(cx, performance.now()/1000);
  // Title
  cx.save();cx.shadowBlur=12;cx.shadowColor='rgba(200,200,232,0.2)';
  cx.font='900 28px "Noto Serif SC",serif';cx.textAlign='center';cx.textBaseline='middle';
  cx.fillStyle=C.white;cx.globalAlpha=0.95;cx.fillText('选择角色',W/2,H*0.1);
  cx.shadowBlur=0;cx.restore();
  cx.font='700 12px "Noto Serif SC",serif';cx.textAlign='center';cx.fillStyle=C.goldLt;cx.globalAlpha=0.75;
  cx.fillText(`${meta.coins} 金`,W/2,H*0.15);
  const startY=H*0.2;
  for(let i=0;i<CHARACTERS.length;i++){
    const ch=CHARACTERS[i];const unlocked=meta.unlockedChars.includes(ch.id);
    const bx=20,by=startY+i*70,bw=W-40,bh=60;
    cx.save();
    // Card background
    const charCardGrad=cx.createLinearGradient(bx,by,bx,by+bh);
    charCardGrad.addColorStop(0,'rgba(18,18,48,0.8)');charCardGrad.addColorStop(1,'rgba(10,10,28,0.85)');
    cx.globalAlpha=unlocked?0.95:0.6;cx.fillStyle=charCardGrad;
    roundRect(cx,bx,by,bw,bh,10);cx.fill();
    // Border with selection glow
    if(ch.id===selectedChar){
      cx.shadowBlur=8;cx.shadowColor='rgba(240,184,64,0.3)';
      cx.strokeStyle=C.gold;cx.lineWidth=2;cx.globalAlpha=0.8;
      roundRect(cx,bx,by,bw,bh,10);cx.stroke();cx.shadowBlur=0;
    } else {
      cx.strokeStyle=C.inkFaint;cx.lineWidth=1;cx.globalAlpha=0.4;
      roundRect(cx,bx,by,bw,bh,10);cx.stroke();
    }
    // Character avatar with glow
    cx.save();cx.shadowBlur=6;cx.shadowColor=ch.scarfColor;
    const avGrad=cx.createRadialGradient(bx+22,by+bh/2,0,bx+22,by+bh/2,10);
    avGrad.addColorStop(0,ch.scarfColor);avGrad.addColorStop(1,ch.color);
    cx.fillStyle=avGrad;cx.globalAlpha=0.9;cx.beginPath();cx.arc(bx+22,by+bh/2,9,0,TAU);cx.fill();
    cx.strokeStyle='rgba(0,0,0,0.3)';cx.lineWidth=1.5;cx.stroke();
    cx.shadowBlur=0;cx.restore();
    // Name
    cx.font='900 16px "Noto Serif SC",serif';cx.textAlign='left';cx.fillStyle=C.white;cx.globalAlpha=0.95;
    cx.fillText(ch.name,bx+38,by+20);
    cx.font='400 11px "Noto Serif SC",serif';cx.fillStyle=C.inkLt;
    cx.fillText(ch.desc,bx+38,by+36);
    cx.fillText(`被动: ${ch.passive}`,bx+38,by+50);
    // Cost / status
    cx.textAlign='right';cx.font='700 12px "Noto Serif SC",serif';
    if(!unlocked){cx.fillStyle=meta.coins>=ch.cost?C.goldLt:C.inkFaint;cx.fillText(`${ch.cost}金`,bx+bw-14,by+30)}
    else if(ch.id===selectedChar){cx.fillStyle=C.greenLt;cx.fillText('已选',bx+bw-14,by+30)}
    else{cx.fillStyle=C.inkFaint;cx.fillText('已有',bx+bw-14,by+30)}
    cx.restore();
  }
  // Back button
  cx.save();cx.globalAlpha=0.5;cx.fillStyle='rgba(20,20,50,0.4)';
  roundRect(cx,W/2-60,H*0.90,120,28,8);cx.fill();
  cx.globalAlpha=0.5;cx.font='700 14px "Noto Serif SC",serif';cx.textAlign='center';cx.fillStyle=C.inkLt;
  cx.fillText('点击返回',W/2,H*0.92);cx.restore();cx.globalAlpha=1;
}

function drawLeaderboard(cx:CanvasRenderingContext2D){
  cx.drawImage(paperBuf,0,0);
  drawStars(cx, performance.now()/1000);
  // Title with glow
  cx.save();cx.shadowBlur=12;cx.shadowColor='rgba(200,200,232,0.2)';
  cx.font='900 28px "Noto Serif SC",serif';cx.textAlign='center';cx.textBaseline='middle';
  cx.fillStyle=C.white;cx.globalAlpha=0.95;cx.fillText('排行榜',W/2,H*0.08);
  cx.shadowBlur=0;cx.restore();
  if(meta.leaderboard.length===0){
    cx.font='400 14px "Noto Serif SC",serif';cx.textAlign='center';cx.fillStyle=C.inkFaint;cx.globalAlpha=0.5;
    cx.fillText('还没有记录，去战斗吧!',W/2,H*0.3);
  } else {
    const startY=H*0.14;
    for(let i=0;i<meta.leaderboard.length;i++){
      const e=meta.leaderboard[i];const y=startY+i*44;
      cx.save();
      // Row background
      const rowGrad=cx.createLinearGradient(15,y-4,W-15,y-4);
      rowGrad.addColorStop(0,i===0?'rgba(240,184,64,0.1)':'rgba(18,18,48,0.4)');
      rowGrad.addColorStop(1,'rgba(10,10,28,0.3)');
      cx.globalAlpha=0.8;cx.fillStyle=rowGrad;
      roundRect(cx,15,y-4,W-30,38,6);cx.fill();
      if(i===0){cx.strokeStyle=C.gold;cx.lineWidth=1;cx.globalAlpha=0.3;roundRect(cx,15,y-4,W-30,38,6);cx.stroke()}
      cx.globalAlpha=i===0?0.95:0.75;
      // Rank
      cx.font=i<3?'900 20px "Noto Serif SC",serif':'700 16px "Noto Serif SC",serif';
      cx.textAlign='left';cx.fillStyle=i===0?C.gold:i===1?'#c0c0d0':i===2?C.orange:C.inkLt;
      cx.fillText(`${i+1}.`,25,y+14);
      // Name
      cx.font='700 14px "Noto Serif SC",serif';cx.fillStyle=C.white;
      cx.fillText(`${e.name}`,55,y+10);
      // Stats
      cx.font='400 11px "Noto Serif SC",serif';cx.fillStyle=C.inkLt;
      const m=floor(e.time/60),s=e.time%60;
      cx.fillText(`Lv.${e.level} · ${m}:${s.toString().padStart(2,'0')}`,55,y+26);
      // Kills
      cx.textAlign='right';cx.font='900 16px "Noto Serif SC",serif';
      cx.fillStyle=i===0?C.gold:C.white;cx.fillText(`${e.kills} 斩`,W-25,y+14);
      cx.font='400 9px sans-serif';cx.fillStyle=C.inkFaint;cx.fillText(e.date,W-25,y+28);
      cx.restore();
    }
  }
  // Back button
  cx.save();cx.globalAlpha=0.4;cx.fillStyle='rgba(20,20,50,0.4)';
  roundRect(cx,W/2-55,H*0.91,110,26,8);cx.fill();
  cx.globalAlpha=0.45;cx.font='400 13px "Noto Serif SC",serif';cx.textAlign='center';cx.fillStyle=C.inkLt;
  cx.fillText('点击返回',W/2,H*0.93);cx.restore();cx.globalAlpha=1;
}

function render(){
  ctx.clearRect(0,0,W,H);
  if(state==='title'){drawTitle(ctx);return}
  if(state==='shop'){drawShop(ctx);return}
  if(state==='charselect'){drawCharSelect(ctx);return}
  if(state==='leaderboard'){drawLeaderboard(ctx);return}
  // Game world
  const offX=player.x-W/2,offY=player.y-H/2;
  // Screen shake with independent H/V randomness
  const sx=shake>0?(random()-0.5)*shake*2.2:0,sy=shake>0?(random()-0.5)*shake*1.8:0;
  ctx.save();ctx.translate(sx,sy);
  ctx.drawImage(paperBuf,0,0);
  drawStars(ctx, gameTimer);
  // Floating ink-wash clouds with parallax
  drawInkClouds(ctx, gameTimer, offX, offY);
  drawMoon(ctx, gameTimer);
  // Grid (faint moonlit lines with subtle gradient)
  ctx.save();const gs=80;ctx.globalAlpha=0.05;ctx.strokeStyle='#303060';ctx.lineWidth=0.5;
  const gx0=floor((offX-W)/gs)*gs,gy0=floor((offY-H)/gs)*gs;
  for(let gx=gx0;gx<offX+W*2;gx+=gs){ctx.beginPath();ctx.moveTo(gx-offX,0);ctx.lineTo(gx-offX,H);ctx.stroke()}
  for(let gy=gy0;gy<offY+H*2;gy+=gs){ctx.beginPath();ctx.moveTo(0,gy-offY);ctx.lineTo(W,gy-offY);ctx.stroke()}
  ctx.restore();
  // Arena with ink-wash boundary
  ctx.save();const asx=-offX,asy=-offY;
  // Brush-stroke circle (irregular like calligraphy)
  ctx.globalAlpha=0.1;ctx.strokeStyle=C.ink;ctx.lineWidth=4;ctx.lineCap='round';
  ctx.beginPath();
  for(let i=0;i<=64;i++){const a=(i/64)*TAU;const r=ARENA_R*(1+sin(a*7)*0.008+cos(a*13)*0.005);
    i===0?ctx.moveTo(asx+cos(a)*r,asy+sin(a)*r):ctx.lineTo(asx+cos(a)*r,asy+sin(a)*r)}
  ctx.closePath();ctx.stroke();
  // Inner decorative pattern (ancient motif)
  ctx.globalAlpha=0.025;ctx.lineWidth=1;
  for(let ring=0.4;ring<=0.7;ring+=0.15){
    ctx.beginPath();for(let i=0;i<=32;i++){const a=(i/32)*TAU;const r=ARENA_R*ring;
      i===0?ctx.moveTo(asx+cos(a)*r,asy+sin(a)*r):ctx.lineTo(asx+cos(a)*r,asy+sin(a)*r)}
    ctx.closePath();ctx.stroke();
  }
  // Dark mist outside arena
  ctx.globalAlpha=0.4;ctx.fillStyle='#030310';ctx.beginPath();ctx.rect(-500,-500,W+1000,H+1000);
  ctx.arc(asx,asy,ARENA_R,0,TAU,true);ctx.fill();
  // Soft gradient at arena edge (eerie night glow)
  const grad=ctx.createRadialGradient(asx,asy,ARENA_R*0.85,asx,asy,ARENA_R);
  grad.addColorStop(0,'rgba(6,6,26,0)');grad.addColorStop(1,'rgba(6,6,26,0.2)');
  ctx.globalAlpha=1;ctx.fillStyle=grad;ctx.beginPath();ctx.arc(asx,asy,ARENA_R,0,TAU);ctx.fill();
  ctx.restore();
  // Player-following vignette (lighter near player, darker at edges)
  ctx.save();
  const vigCx=W/2+(sx||0),vigCy=H/2+(sy||0);
  const vig=ctx.createRadialGradient(vigCx,vigCy,W*0.15,vigCx,vigCy,W*0.7);
  vig.addColorStop(0,'rgba(6,6,26,0)');
  vig.addColorStop(0.4,'rgba(6,6,26,0)');
  vig.addColorStop(0.7,'rgba(6,6,26,0.15)');
  vig.addColorStop(1,'rgba(6,6,26,0.45)');
  ctx.fillStyle=vig;ctx.fillRect(0,0,W,H);ctx.restore();
  // Ink decals (ground stains from kills)
  for(const d of decals){
    ctx.save();ctx.translate(d.x-offX,d.y-offY);ctx.rotate(d.rot);
    ctx.globalAlpha=d.alpha;ctx.fillStyle=d.color;
    ctx.beginPath();
    for(let i=0;i<=6;i++){const a=(i/6)*TAU;const r=d.r*(0.6+sin(a*3+d.rot)*0.4);
      i===0?ctx.moveTo(cos(a)*r,sin(a)*r):ctx.lineTo(cos(a)*r,sin(a)*r)}
    ctx.closePath();ctx.fill();ctx.restore();
  }
  // Chests
  for(const ch of chests)drawChest(ctx,ch,offX,offY);
  // Gems
  for(const g of gems)drawGem(ctx,g,offX,offY);
  // Bullets
  for(const b of bullets)drawBullet(ctx,b,offX,offY);
  // Enemy bullets
  for(const b of enemyBullets)drawEnemyBullet(ctx,b,offX,offY);
  // Homing bullets (enhanced with glow + trail)
  for(const b of homingBullets){
    const bx=b.x-offX,by=b.y-offY;
    ctx.save();
    ctx.shadowBlur=15;ctx.shadowColor='rgba(224,48,80,0.5)';
    // Outer glow
    const hmGlow=ctx.createRadialGradient(bx,by,0,bx,by,b.r*3);
    hmGlow.addColorStop(0,'rgba(255,104,136,0.3)');hmGlow.addColorStop(0.5,'rgba(224,48,80,0.1)');hmGlow.addColorStop(1,'rgba(0,0,0,0)');
    ctx.globalAlpha=0.6;ctx.fillStyle=hmGlow;ctx.beginPath();ctx.arc(bx,by,b.r*3,0,TAU);ctx.fill();
    // Body with gradient
    const hmBody=ctx.createRadialGradient(bx-b.r*0.2,by-b.r*0.2,0,bx,by,b.r);
    hmBody.addColorStop(0,C.gold);hmBody.addColorStop(0.4,C.redLt);hmBody.addColorStop(1,C.red);
    ctx.globalAlpha=0.95;ctx.fillStyle=hmBody;ctx.beginPath();ctx.arc(bx,by,b.r,0,TAU);ctx.fill();
    // Inner core
    ctx.globalAlpha=0.5;ctx.fillStyle=C.white;ctx.beginPath();ctx.arc(bx-b.r*0.2,by-b.r*0.2,b.r*0.35,0,TAU);ctx.fill();
    ctx.shadowBlur=0;ctx.restore();
  }
  // Enemies
  enemies.sort((a,b)=>a.y-b.y);
  for(const e of enemies)drawEnemy(ctx,e,offX,offY);
  // Player
  drawPlayer(ctx,W/2+sx,H/2+sy);
  // Particles
  drawParticles(ctx,offX,offY);
  // Float texts with shadow for readability
  for(const ft of floatTexts){ctx.save();ctx.globalAlpha=ft.life/0.8;
    ctx.font=`900 ${ft.size}px "Noto Serif SC",serif`;ctx.textAlign='center';
    ctx.shadowBlur=4;ctx.shadowColor='rgba(0,0,0,0.5)';
    ctx.fillStyle=ft.color;ctx.fillText(ft.text,ft.x-offX,ft.y-offY);
    ctx.shadowBlur=0;ctx.restore()}
  ctx.restore();
  // Flash
  if(flashAlpha>0){ctx.save();ctx.globalAlpha=flashAlpha;ctx.fillStyle=flashColor;ctx.fillRect(0,0,W,H);ctx.restore()}
  // HUD
  drawHUD(ctx);
  // Combo flash overlay
  if(comboFlashAlpha>0){ctx.save();ctx.globalAlpha=comboFlashAlpha;ctx.fillStyle=C.gold;ctx.fillRect(0,0,W,H);ctx.restore()}
  // Overlays
  // Large combo counter with glow effect
  if(state==='playing'&&player.combo>=5){
    ctx.save();
    const comboSize=player.combo>=50?44:player.combo>=25?38:player.combo>=10?30:24;
    ctx.font=`900 ${comboSize}px "Noto Serif SC",serif`;ctx.textAlign='center';
    const comboColor=player.combo>=50?C.red:player.combo>=25?C.gold:player.combo>=10?C.goldLt:C.white;
    const glowColor=player.combo>=50?'rgba(224,48,80,0.4)':player.combo>=25?'rgba(240,184,64,0.4)':'rgba(200,200,232,0.2)';
    ctx.shadowBlur=player.combo>=25?15:8;ctx.shadowColor=glowColor;
    ctx.fillStyle=comboColor;ctx.globalAlpha=0.75+sin(player.animT*8)*0.2;
    ctx.fillText(`${player.combo} 连斩`,W/2,H*0.12);
    ctx.shadowBlur=0;
    ctx.restore();
  }
  // Boss entrance overlay: full-screen ink splash + calligraphy name
  if(bossEntranceT>0){
    ctx.save();
    const t=bossEntranceT; // 1.0 → 0
    // Ink splash effect
    ctx.globalAlpha=t*0.5;ctx.fillStyle=C.ink;ctx.fillRect(0,0,W,H);
    // Ink splatter decorations
    ctx.globalAlpha=t*0.3;
    for(let i=0;i<8;i++){
      const sx2=sin(i*1.7+t*5)*W*0.3+W/2,sy2=cos(i*2.3+t*3)*H*0.2+H*0.4;
      ctx.beginPath();
      for(let j=0;j<=6;j++){const a=(j/6)*TAU;const r=30+sin(j*3+i)*15;
        j===0?ctx.moveTo(sx2+cos(a)*r,sy2+sin(a)*r):ctx.lineTo(sx2+cos(a)*r,sy2+sin(a)*r)}
      ctx.closePath();ctx.fill();
    }
    // Boss name in large calligraphy
    ctx.globalAlpha=min(1,(1-t)*3)*0.9;
    ctx.font='900 56px "Noto Serif SC",serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle=bossEntranceColor;
    ctx.fillText(bossEntranceName,W/2+2,H*0.42+2); // shadow
    ctx.fillStyle=C.paper;
    ctx.fillText(bossEntranceName,W/2,H*0.42);
    ctx.font='700 18px "Noto Serif SC",serif';ctx.fillStyle=C.red;ctx.globalAlpha=min(1,(1-t)*3)*0.7;
    ctx.fillText('妖王降临',W/2,H*0.52);
    ctx.restore();
  }
  if(state==='levelup')drawLevelUp(ctx);
  if(state==='paused')drawPause(ctx);
  if(state==='revive')drawRevive(ctx);
  if(state==='dead')drawDeath(ctx);
  if(state==='victory')drawVictory(ctx);
}

// ═══════════════════════════════════════════════════
// GAME LOOP
// ═══════════════════════════════════════════════════

let lastT=performance.now();
function loop(now:number){
  requestAnimationFrame(loop);
  const dt=min((now-lastT)/1000,0.1);lastT=now;
  update(dt);render();
}
requestAnimationFrame(loop);
