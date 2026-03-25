#!/usr/bin/env npx tsx
/**
 * Melo's Quest Thumbnail Generator
 * Generates ink-wash style cover images for all 5 games.
 *
 * Usage: npx tsx publish/generate-thumbnails.ts
 * Output: publish/thumbnails/<game-id>-<size>.png
 *
 * Requires: npm install canvas
 */

import { createCanvas, type Canvas, type CanvasRenderingContext2D } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';

// ── Types ──
interface GameDef {
  id: string;
  title: string;
  subtitle: string;
  tagline: string;
  accent: string;
  accentLight: string;
  drawIcon: (ctx: CanvasRenderingContext2D, w: number, h: number, accent: string) => void;
}

interface SizeDef {
  label: string;
  w: number;
  h: number;
  suffix: string;
}

// ── Seeded RNG ──
function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Drawing Utilities ──

function fillParchment(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
  grad.addColorStop(0, '#f5e6c8');
  grad.addColorStop(0.6, '#e8d5a8');
  grad.addColorStop(1, '#d4c090');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const rng = mulberry32(seed || 42);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (rng() - 0.5) * 30;
    data[i] += n;
    data[i + 1] += n;
    data[i + 2] += n - 5;
  }
  ctx.putImageData(imgData, 0, 0);

  ctx.save();
  ctx.globalAlpha = 0.03;
  ctx.strokeStyle = '#8b7355';
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    const y = rng() * h;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(
      w * 0.3, y + (rng() - 0.5) * 20,
      w * 0.7, y + (rng() - 0.5) * 20,
      w, y + (rng() - 0.5) * 10
    );
    ctx.lineWidth = rng() * 1.5 + 0.5;
    ctx.stroke();
  }
  ctx.restore();
}

function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string) {
  const grad = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.25,
    w / 2, h / 2, Math.max(w, h) * 0.75
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.6, 'rgba(30,20,10,0.08)');
  grad.addColorStop(0.85, 'rgba(20,15,5,0.25)');
  grad.addColorStop(1, 'rgba(10,5,0,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = 0.12;
  const glow = ctx.createRadialGradient(w / 2, h * 0.35, 0, w / 2, h * 0.35, Math.max(w, h) * 0.5);
  glow.addColorStop(0, accent);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawInkBorder(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string) {
  ctx.save();
  const rng = mulberry32(7);
  ctx.strokeStyle = 'rgba(30,20,10,0.6)';
  ctx.lineWidth = 3;
  const m = 12;
  ctx.beginPath();
  ctx.moveTo(m, m);
  for (let x = m; x <= w - m; x += 8) ctx.lineTo(x, m + (rng() - 0.5) * 3);
  for (let y = m; y <= h - m; y += 8) ctx.lineTo(w - m + (rng() - 0.5) * 3, y);
  for (let x = w - m; x >= m; x -= 8) ctx.lineTo(x, h - m + (rng() - 0.5) * 3);
  for (let y = h - m; y >= m; y -= 8) ctx.lineTo(m + (rng() - 0.5) * 3, y);
  ctx.closePath();
  ctx.stroke();

  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.4;
  const m2 = 18;
  ctx.strokeRect(m2, m2, w - m2 * 2, h - m2 * 2);
  ctx.restore();
}

function drawTitle(ctx: CanvasRenderingContext2D, w: number, h: number, game: GameDef) {
  const scale = Math.min(w, h) / 512;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const titleY = h * 0.18;
  const titleSize = Math.round(42 * scale);

  ctx.fillStyle = 'rgba(20,10,0,0.3)';
  ctx.font = `bold ${titleSize}px "Georgia", "Times New Roman", serif`;
  ctx.fillText(game.title, w / 2 + 2, titleY + 2);

  ctx.fillStyle = '#1a0f00';
  ctx.fillText(game.title, w / 2, titleY);

  const subY = titleY + titleSize * 0.8;
  const subSize = Math.round(30 * scale);
  ctx.font = `bold ${subSize}px "SimSun", "Songti SC", "Noto Serif CJK SC", serif`;
  ctx.fillStyle = game.accent;
  ctx.globalAlpha = 0.9;
  ctx.fillText(game.subtitle, w / 2, subY);

  const tagY = subY + subSize * 0.9;
  const tagSize = Math.round(16 * scale);
  ctx.globalAlpha = 0.6;
  ctx.font = `italic ${tagSize}px "Georgia", serif`;
  ctx.fillStyle = '#3a2a10';
  ctx.fillText(game.tagline, w / 2, tagY);

  ctx.restore();
}

function drawBranding(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const scale = Math.min(w, h) / 512;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const size = Math.round(13 * scale);
  ctx.font = `${size}px "Georgia", serif`;
  ctx.fillStyle = 'rgba(60,40,20,0.5)';
  ctx.fillText('JoyBoy Games', w / 2, h - 16 * scale);
  ctx.restore();
}

function drawInkSplat(
  ctx: CanvasRenderingContext2D, x: number, y: number, r: number,
  color: string, rng: () => number
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.15 + rng() * 0.15;
  ctx.beginPath();
  const pts = 8 + Math.floor(rng() * 6);
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const rr = r * (0.6 + rng() * 0.8);
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ── Game Icon Drawings ──

function drawShanhai(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string) {
  const cx = w / 2, cy = h * 0.58;
  const scale = Math.min(w, h) / 512;
  const rng = mulberry32(101);

  ctx.save();
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const len = 60 * scale + rng() * 40 * scale;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
    ctx.strokeStyle = `rgba(30,15,5,${0.2 + rng() * 0.3})`;
    ctx.lineWidth = (2 + rng() * 4) * scale;
    ctx.lineCap = 'round';
    ctx.stroke();

    for (let j = 0; j < 3; j++) {
      const t = 0.4 + rng() * 0.6;
      const sx = cx + Math.cos(angle) * len * t + (rng() - 0.5) * 15 * scale;
      const sy = cy + Math.sin(angle) * len * t + (rng() - 0.5) * 15 * scale;
      drawInkSplat(ctx, sx, sy, (3 + rng() * 5) * scale, '#1a0f00', rng);
    }
  }

  drawInkSplat(ctx, cx, cy, 25 * scale, accent, rng);
  drawInkSplat(ctx, cx, cy, 18 * scale, '#1a0f00', rng);

  ctx.fillStyle = 'rgba(20,10,0,0.6)';
  const creatures: Array<(x: number, y: number, s: number) => void> = [
    (x, y, s) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x - 8 * s, y - 10 * s, x - 15 * s, y - 5 * s);
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 8 * s, y - 10 * s, x + 15 * s, y - 5 * s);
      ctx.strokeStyle = 'rgba(20,10,0,0.5)';
      ctx.lineWidth = 1.5 * s;
      ctx.stroke();
    },
    (x, y, s) => {
      ctx.beginPath();
      ctx.ellipse(x, y, 10 * s, 6 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - 8 * s, y + 4 * s, 2 * s, 6 * s);
      ctx.fillRect(x - 3 * s, y + 4 * s, 2 * s, 6 * s);
      ctx.fillRect(x + 3 * s, y + 4 * s, 2 * s, 6 * s);
      ctx.fillRect(x + 7 * s, y + 4 * s, 2 * s, 6 * s);
    },
    (x, y, s) => {
      ctx.beginPath();
      ctx.moveTo(x - 10 * s, y);
      ctx.bezierCurveTo(x - 5 * s, y - 6 * s, x + 5 * s, y + 6 * s, x + 12 * s, y);
      ctx.strokeStyle = 'rgba(20,10,0,0.5)';
      ctx.lineWidth = 2 * s;
      ctx.stroke();
    },
  ];

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + 0.3;
    const dist = (90 + rng() * 30) * scale;
    creatures[i % creatures.length](cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, scale);
  }
  ctx.restore();
}

function drawCloudLeap(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string) {
  const scale = Math.min(w, h) / 512;
  const rng = mulberry32(202);
  const baseY = h * 0.75;

  ctx.save();

  const layers = [
    { y: baseY - 30 * scale, color: 'rgba(40,50,60,0.15)', height: 120 * scale },
    { y: baseY - 10 * scale, color: 'rgba(40,50,60,0.25)', height: 100 * scale },
    { y: baseY + 15 * scale, color: 'rgba(30,40,50,0.4)', height: 80 * scale },
  ];

  layers.forEach((layer, li) => {
    ctx.beginPath();
    ctx.moveTo(0, h);
    const peaks = 5 + li;
    for (let i = 0; i <= peaks; i++) {
      const x = (i / peaks) * w;
      const peakH = layer.height * (0.5 + rng() * 0.5);
      ctx.lineTo(x, i % 2 === 0 ? layer.y - peakH : layer.y - peakH * 0.3);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = layer.color;
    ctx.fill();
  });

  for (let i = 0; i < 3; i++) {
    const cloudY = baseY - 50 * scale - i * 35 * scale;
    ctx.beginPath();
    ctx.ellipse(w / 2 + (rng() - 0.5) * 100 * scale, cloudY, 120 * scale + rng() * 60 * scale, 12 * scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(245,230,200,0.3)';
    ctx.fill();
  }

  const figX = w * 0.55, figY = h * 0.42;
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.ellipse(figX, figY, 5 * scale, 8 * scale, -0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(figX - 3 * scale, figY + 3 * scale);
  ctx.bezierCurveTo(figX - 15 * scale, figY + 10 * scale, figX - 25 * scale, figY + 5 * scale, figX - 35 * scale, figY + 15 * scale);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.5 * scale;
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(figX - 4 * scale, figY - 2 * scale);
  ctx.lineTo(figX - 14 * scale, figY - 8 * scale);
  ctx.moveTo(figX + 4 * scale, figY - 2 * scale);
  ctx.lineTo(figX + 12 * scale, figY - 10 * scale);
  ctx.strokeStyle = 'rgba(20,10,0,0.6)';
  ctx.lineWidth = 2 * scale;
  ctx.stroke();

  ctx.globalAlpha = 0.3;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.arc(
      figX - 20 * scale - i * 12 * scale,
      figY + 10 * scale + i * 5 * scale + (rng() - 0.5) * 8 * scale,
      (3 - i * 0.3) * scale, 0, Math.PI * 2
    );
    ctx.fillStyle = accent;
    ctx.fill();
  }
  ctx.restore();
}

function drawRicochet(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string) {
  const scale = Math.min(w, h) / 512;
  const rng = mulberry32(303);

  ctx.save();

  const gridX = w * 0.2, gridY = h * 0.4;
  const gridW = w * 0.6, gridH = h * 0.25;
  const cols = 7, rows = 4;
  const bw = gridW / cols, bh = gridH / rows;

  const r = parseInt(accent.slice(1, 3), 16);
  const g = parseInt(accent.slice(3, 5), 16);
  const b = parseInt(accent.slice(5, 7), 16);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (rng() > 0.25) {
        const x = gridX + col * bw;
        const y = gridY + row * bh;
        ctx.fillStyle = rng() > 0.5 ? 'rgba(30,20,10,0.2)' : `rgba(${r},${g},${b},0.15)`;
        ctx.fillRect(x + 1, y + 1, bw - 2, bh - 2);
        ctx.strokeStyle = 'rgba(30,20,10,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 1, y + 1, bw - 2, bh - 2);
      }
    }
  }

  const points: [number, number][] = [
    [w * 0.15, h * 0.8], [w * 0.3, h * 0.42], [w * 0.45, h * 0.65],
    [w * 0.55, h * 0.38], [w * 0.7, h * 0.55], [w * 0.82, h * 0.35],
  ];

  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.5 * scale;
  ctx.globalAlpha = 0.5;
  ctx.setLineDash([6 * scale, 4 * scale]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(points[points.length - 1][0], points[points.length - 1][1], 8 * scale, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.strokeStyle = '#1a0f00';
  ctx.lineWidth = 1.5 * scale;
  ctx.stroke();

  ctx.globalAlpha = 0.4;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i];
    for (let j = 0; j < 4; j++) {
      const a = (j / 4) * Math.PI * 2 + rng() * 0.5;
      const len = (8 + rng() * 6) * scale;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
      ctx.strokeStyle = '#1a0f00';
      ctx.lineWidth = 1 * scale;
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = '#3a2a10';
  ctx.lineWidth = 2 * scale;
  const scrollR = 20 * scale;
  ctx.beginPath();
  ctx.arc(w * 0.12, h * 0.38, scrollR, 0, Math.PI * 1.5, true);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w * 0.88, h * 0.38, scrollR, Math.PI * 0.5, Math.PI, false);
  ctx.stroke();

  ctx.restore();
}

function drawSpiritSerpent(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string) {
  const cx = w / 2, cy = h * 0.58;
  const scale = Math.min(w, h) / 512;
  const rng = mulberry32(404);

  ctx.save();
  ctx.globalAlpha = 0.7;

  const bodyPts: [number, number][] = [];
  for (let t = 0; t <= 1; t += 0.02) {
    const angle = t * Math.PI * 5;
    const r = (30 + t * 60) * scale;
    bodyPts.push([
      cx + Math.cos(angle) * r * 0.7,
      cy + Math.sin(angle) * r * 0.5 - t * 30 * scale,
    ]);
  }

  ctx.beginPath();
  ctx.moveTo(bodyPts[0][0], bodyPts[0][1]);
  for (let i = 1; i < bodyPts.length; i++) ctx.lineTo(bodyPts[i][0], bodyPts[i][1]);
  ctx.strokeStyle = '#1a0f00';
  ctx.lineWidth = 10 * scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.35;
  ctx.stroke();

  ctx.lineWidth = 6 * scale;
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.4;
  ctx.stroke();

  const headPt = bodyPts[bodyPts.length - 1];
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.ellipse(headPt[0], headPt[1] - 5 * scale, 12 * scale, 8 * scale, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = '#1a0f00';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(headPt[0] + 4 * scale, headPt[1] - 8 * scale, 2.5 * scale, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.9;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(headPt[0] - 5 * scale, headPt[1] - 10 * scale);
  ctx.lineTo(headPt[0] - 12 * scale, headPt[1] - 25 * scale);
  ctx.moveTo(headPt[0] + 2 * scale, headPt[1] - 12 * scale);
  ctx.lineTo(headPt[0] + 5 * scale, headPt[1] - 27 * scale);
  ctx.strokeStyle = '#1a0f00';
  ctx.lineWidth = 2 * scale;
  ctx.globalAlpha = 0.6;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(headPt[0] + 10 * scale, headPt[1] - 5 * scale);
  ctx.bezierCurveTo(
    headPt[0] + 25 * scale, headPt[1] - 15 * scale,
    headPt[0] + 30 * scale, headPt[1] - 10 * scale,
    headPt[0] + 40 * scale, headPt[1] - 20 * scale
  );
  ctx.moveTo(headPt[0] + 10 * scale, headPt[1]);
  ctx.bezierCurveTo(
    headPt[0] + 25 * scale, headPt[1] + 5 * scale,
    headPt[0] + 35 * scale, headPt[1] - 5 * scale,
    headPt[0] + 42 * scale, headPt[1] + 5 * scale
  );
  ctx.strokeStyle = 'rgba(30,15,5,0.4)';
  ctx.lineWidth = 1.5 * scale;
  ctx.stroke();

  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 15; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = (80 + rng() * 40) * scale;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist * 0.6, (1.5 + rng() * 2.5) * scale, 0, Math.PI * 2);
    ctx.fillStyle = rng() > 0.5 ? accent : '#1a0f00';
    ctx.fill();
  }

  ctx.restore();
}

function drawFateCards(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string) {
  const cx = w / 2, cy = h * 0.57;
  const scale = Math.min(w, h) / 512;
  const rng = mulberry32(505);

  ctx.save();

  const cardW = 45 * scale, cardH = 65 * scale;
  const spread = 14 * scale;

  const symFuncs: Array<(ctx: CanvasRenderingContext2D, s: number) => void> = [
    // Sun
    (ctx, s) => {
      ctx.beginPath(); ctx.arc(0, 0, 10 * s, 0, Math.PI * 2); ctx.stroke();
      for (let j = 0; j < 8; j++) {
        const a = j * Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 12 * s, Math.sin(a) * 12 * s);
        ctx.lineTo(Math.cos(a) * 16 * s, Math.sin(a) * 16 * s);
        ctx.stroke();
      }
    },
    // Triangle
    (ctx, s) => {
      ctx.beginPath();
      ctx.moveTo(0, -14 * s); ctx.lineTo(-12 * s, 10 * s); ctx.lineTo(12 * s, 10 * s);
      ctx.closePath(); ctx.stroke();
    },
    // Diamond
    (ctx, s) => {
      ctx.beginPath();
      ctx.moveTo(0, -14 * s); ctx.lineTo(10 * s, 0); ctx.lineTo(0, 14 * s); ctx.lineTo(-10 * s, 0);
      ctx.closePath(); ctx.stroke();
    },
    // Wave
    (ctx, s) => {
      for (let j = -1; j <= 1; j++) {
        ctx.beginPath();
        ctx.moveTo(-12 * s, j * 8 * s);
        ctx.bezierCurveTo(-4 * s, j * 8 * s - 6 * s, 4 * s, j * 8 * s + 6 * s, 12 * s, j * 8 * s);
        ctx.stroke();
      }
    },
    // Star
    (ctx, s) => {
      ctx.beginPath();
      for (let j = 0; j < 5; j++) {
        const a = j * Math.PI * 2 / 5 - Math.PI / 2;
        const a2 = a + Math.PI / 5;
        ctx.lineTo(Math.cos(a) * 14 * s, Math.sin(a) * 14 * s);
        ctx.lineTo(Math.cos(a2) * 6 * s, Math.sin(a2) * 6 * s);
      }
      ctx.closePath(); ctx.stroke();
    },
  ];

  for (let i = 0; i < 5; i++) {
    const angle = (i - 2) * 0.18;
    const offsetX = (i - 2) * spread;
    const offsetY = Math.abs(i - 2) * 5 * scale;

    ctx.save();
    ctx.translate(cx + offsetX, cy + offsetY);
    ctx.rotate(angle);

    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(-cardW / 2 + 3 * scale, -cardH / 2 + 3 * scale, cardW, cardH);

    ctx.fillStyle = '#f0e4cc';
    ctx.fillRect(-cardW / 2, -cardH / 2, cardW, cardH);
    ctx.strokeStyle = 'rgba(40,25,10,0.5)';
    ctx.lineWidth = 1.5 * scale;
    ctx.strokeRect(-cardW / 2, -cardH / 2, cardW, cardH);

    ctx.strokeStyle = accent;
    ctx.lineWidth = 0.8 * scale;
    ctx.globalAlpha = 0.4;
    ctx.strokeRect(-cardW / 2 + 3 * scale, -cardH / 2 + 3 * scale, cardW - 6 * scale, cardH - 6 * scale);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = i === 2 ? accent : 'rgba(40,25,10,0.45)';
    ctx.lineWidth = 1.5 * scale;
    symFuncs[i](ctx, scale);

    ctx.restore();
  }

  ctx.globalAlpha = 0.15;
  const auraGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 50 * scale);
  auraGrad.addColorStop(0, accent);
  auraGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = auraGrad;
  ctx.fillRect(cx - 60 * scale, cy - 60 * scale, 120 * scale, 120 * scale);

  ctx.globalAlpha = 0.2;
  for (let i = 0; i < 12; i++) {
    const px = cx + (rng() - 0.5) * 200 * scale;
    const py = cy + (rng() - 0.5) * 140 * scale;
    ctx.beginPath();
    ctx.arc(px, py, (1 + rng() * 2) * scale, 0, Math.PI * 2);
    ctx.fillStyle = rng() > 0.5 ? accent : '#f0e4cc';
    ctx.fill();
  }

  ctx.restore();
}

// ── Config ──

const GAMES: GameDef[] = [
  { id: 'shanhai-survivors', title: "Melo's Quest 1", subtitle: '山海幸存者', tagline: 'Shanhai Survivors', accent: '#c0392b', accentLight: '#e74c3c', drawIcon: drawShanhai },
  { id: 'cloud-leap', title: "Melo's Quest 2", subtitle: '云端纵跃', tagline: 'Cloud Leap', accent: '#2471a3', accentLight: '#3498db', drawIcon: drawCloudLeap },
  { id: 'ricochet-scroll', title: "Melo's Quest 3", subtitle: '弹珠古卷', tagline: 'Ricochet Scroll', accent: '#1e8449', accentLight: '#27ae60', drawIcon: drawRicochet },
  { id: 'spirit-serpent', title: "Melo's Quest 4", subtitle: '灵蛇诡道', tagline: 'Spirit Serpent', accent: '#6c3483', accentLight: '#8e44ad', drawIcon: drawSpiritSerpent },
  { id: 'fate-cards', title: "Melo's Quest 5", subtitle: '命运五牌', tagline: 'Fate Cards', accent: '#b7950b', accentLight: '#d4ac0d', drawIcon: drawFateCards },
];

const SIZES: SizeDef[] = [
  { label: '512x512 (Poki)', w: 512, h: 512, suffix: 'poki' },
  { label: '800x450 (CrazyGames)', w: 800, h: 450, suffix: 'cover' },
  { label: '630x500 (itch.io)', w: 630, h: 500, suffix: 'itchio' },
];

// ── Main ──

function renderThumbnail(canvas: Canvas, game: GameDef, w: number, h: number) {
  const ctx = canvas.getContext('2d');
  fillParchment(ctx, w, h, game.id.length * 7);
  game.drawIcon(ctx, w, h, game.accent);
  drawVignette(ctx, w, h, game.accent);
  drawInkBorder(ctx, w, h, game.accent);
  drawTitle(ctx, w, h, game);
  drawBranding(ctx, w, h);
}

async function main() {
  const outDir = path.join(__dirname, 'thumbnails');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  let count = 0;
  for (const game of GAMES) {
    for (const size of SIZES) {
      const canvas = createCanvas(size.w, size.h);
      renderThumbnail(canvas, game, size.w, size.h);

      const filename = `${game.id}-${size.suffix}.png`;
      const filepath = path.join(outDir, filename);
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(filepath, buffer);
      count++;
      console.log(`  [${count}/15] ${filename} (${size.w}x${size.h})`);
    }
  }

  console.log(`\nDone! ${count} thumbnails saved to ${outDir}`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
