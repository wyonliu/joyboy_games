#!/usr/bin/env node
/**
 * JoyBoy Games - New Game Creator
 * Usage: node scripts/create-game.js <game-name> [--template <template>]
 */

import { mkdirSync, writeFileSync, cpSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const GAMES_DIR = join(ROOT, '..', 'games');

const gameName = process.argv[2];
if (!gameName) {
  console.error('Usage: node scripts/create-game.js <game-name>');
  process.exit(1);
}

const gameDir = join(GAMES_DIR, gameName);
if (existsSync(gameDir)) {
  console.error(`Game "${gameName}" already exists at ${gameDir}`);
  process.exit(1);
}

console.log(`Creating new game: ${gameName}`);
mkdirSync(gameDir, { recursive: true });
mkdirSync(join(gameDir, 'src'), { recursive: true });
mkdirSync(join(gameDir, 'public'), { recursive: true });
mkdirSync(join(gameDir, 'assets'), { recursive: true });

// package.json
writeFileSync(join(gameDir, 'package.json'), JSON.stringify({
  name: `@joyboy/${gameName}`,
  version: '1.0.0',
  type: 'module',
  scripts: {
    dev: 'vite --host',
    build: 'vite build',
    preview: 'vite preview --host',
  },
  dependencies: {},
  devDependencies: {
    vite: '^6.0.0',
    typescript: '^5.7.0',
  },
}, null, 2));

// tsconfig.json
writeFileSync(join(gameDir, 'tsconfig.json'), JSON.stringify({
  compilerOptions: {
    target: 'ES2020',
    module: 'ESNext',
    moduleResolution: 'bundler',
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    outDir: 'dist',
    rootDir: 'src',
    baseUrl: '.',
    paths: {
      '@joyboy/engine': ['../../scaffold/src/core/index.ts'],
      '@joyboy/engine/*': ['../../scaffold/src/core/*'],
      '@joyboy/platform': ['../../scaffold/src/platform/PlatformAdapter.ts'],
    },
  },
  include: ['src/**/*', '../../scaffold/src/**/*'],
}, null, 2));

// vite.config.ts
writeFileSync(join(gameDir, 'vite.config.ts'), `
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@joyboy/engine': resolve(__dirname, '../../scaffold/src/core/index.ts'),
      '@joyboy/platform': resolve(__dirname, '../../scaffold/src/platform/PlatformAdapter.ts'),
    },
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 8192,
    rollupOptions: {
      output: { manualChunks: undefined },
    },
  },
  server: { port: 3000 },
});
`.trim().replace(/__dirname/g, "'" + join(GAMES_DIR, gameName).replace(/'/g, "\\'") + "'"));

// Actually fix the vite config to use proper __dirname
writeFileSync(join(gameDir, 'vite.config.ts'), `import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@joyboy/engine': resolve(__dirname, '../../scaffold/src/core/index.ts'),
      '@joyboy/platform': resolve(__dirname, '../../scaffold/src/platform/PlatformAdapter.ts'),
    },
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 8192,
    rollupOptions: {
      output: { manualChunks: undefined },
    },
  },
  server: { port: 3000, host: true },
});
`);

// index.html
writeFileSync(join(gameDir, 'public', 'index.html'), `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${gameName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
    #game { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
    canvas { display: block; image-rendering: pixelated; }
  </style>
</head>
<body>
  <div id="game"></div>
  <script type="module" src="../src/main.ts"></script>
</body>
</html>
`);

// Move index.html to root for vite
writeFileSync(join(gameDir, 'index.html'), `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${gameName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
    #game { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
    canvas { display: block; }
  </style>
</head>
<body>
  <div id="game"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
`);

// main.ts template
writeFileSync(join(gameDir, 'src', 'main.ts'), `import { Engine, Scene, Input } from '@joyboy/engine';

class GameScene extends Scene {
  enter() { console.log('Game started!'); }
  exit() {}
  update(dt: number) {}
  render(ctx: CanvasRenderingContext2D, dt: number) {
    ctx.fillStyle = '#fff';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Hello JoyBoy!', this.engine.width / 2, this.engine.height / 2);
  }
}

const engine = new Engine({
  width: 390,
  height: 844,
  parent: 'game',
  backgroundColor: '#1a1a2e',
});

const input = new Input(engine.canvas);
engine.addScene('game', new GameScene());
engine.switchScene('game');
engine.start();
`);

// .gitignore
writeFileSync(join(gameDir, '.gitignore'), `node_modules/
dist/
.DS_Store
`);

console.log(`
Game "${gameName}" created at ${gameDir}

Next steps:
  cd games/${gameName}
  npm install
  npm run dev
`);
