/**
 * Simple audio manager with Web Audio API.
 * Handles BGM, SFX, volume control, and mobile unlock.
 */

export class Audio {
  private ctx: AudioContext | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();
  private bgmSource: AudioBufferSourceNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private currentBGM = '';
  private unlocked = false;

  constructor() {
    // Defer context creation until user interaction (mobile requirement)
    const unlock = () => {
      if (this.unlocked) return;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.connect(this.masterGain);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.masterGain);
      this.bgmGain.gain.value = 0.3;
      this.sfxGain.gain.value = 0.7;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.unlocked = true;
    };
    document.addEventListener('touchstart', unlock, { once: true });
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
  }

  async load(name: string, url: string): Promise<void> {
    if (!this.ctx) return;
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const audio = await this.ctx.decodeAudioData(buf);
    this.sounds.set(name, audio);
  }

  // Generate simple tones for prototyping (no asset files needed)
  generateTone(name: string, freq: number, duration: number, type: OscillatorType = 'sine') {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const envelope = Math.min(1, (length - i) / (sampleRate * 0.1)); // fade out
      let wave = 0;
      switch (type) {
        case 'sine': wave = Math.sin(2 * Math.PI * freq * t); break;
        case 'square': wave = Math.sin(2 * Math.PI * freq * t) > 0 ? 1 : -1; break;
        case 'sawtooth': wave = 2 * (freq * t - Math.floor(freq * t + 0.5)); break;
        case 'triangle': wave = Math.abs(4 * (freq * t - Math.floor(freq * t + 0.75) + 0.25)) - 1; break;
      }
      data[i] = wave * envelope * 0.3;
    }
    this.sounds.set(name, buffer);
  }

  playSFX(name: string) {
    if (!this.ctx || !this.sfxGain) return;
    const buf = this.sounds.get(name);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.sfxGain);
    src.start();
  }

  playBGM(name: string, loop = true) {
    if (!this.ctx || !this.bgmGain) return;
    if (this.currentBGM === name) return;
    this.stopBGM();
    const buf = this.sounds.get(name);
    if (!buf) return;
    this.bgmSource = this.ctx.createBufferSource();
    this.bgmSource.buffer = buf;
    this.bgmSource.loop = loop;
    this.bgmSource.connect(this.bgmGain);
    this.bgmSource.start();
    this.currentBGM = name;
  }

  stopBGM() {
    if (this.bgmSource) {
      this.bgmSource.stop();
      this.bgmSource = null;
    }
    this.currentBGM = '';
  }

  setBGMVolume(v: number) { if (this.bgmGain) this.bgmGain.gain.value = v; }
  setSFXVolume(v: number) { if (this.sfxGain) this.sfxGain.gain.value = v; }
  setMasterVolume(v: number) { if (this.masterGain) this.masterGain.gain.value = v; }
}
