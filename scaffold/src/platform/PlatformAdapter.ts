/**
 * Platform abstraction layer.
 * Provides unified API for Poki, WeChat, Douyin, and standalone web.
 */

export interface PlatformAdapter {
  name: string;
  init(): Promise<void>;
  // Ads
  showRewardedAd(): Promise<boolean>;
  showInterstitialAd(): Promise<void>;
  // Analytics
  trackEvent(name: string, params?: Record<string, any>): void;
  // Social
  shareGame(title: string, imageUrl?: string): Promise<void>;
  // Lifecycle
  onPause(cb: () => void): void;
  onResume(cb: () => void): void;
  // Leaderboard
  submitScore(score: number): Promise<void>;
  getLeaderboard(): Promise<{ name: string; score: number }[]>;
}

export class WebPlatform implements PlatformAdapter {
  name = 'web';
  async init() { console.log('[Platform] Web standalone mode'); }
  async showRewardedAd() { console.log('[Ad] Rewarded ad (mock)'); return true; }
  async showInterstitialAd() { console.log('[Ad] Interstitial (mock)'); }
  trackEvent(name: string, params?: Record<string, any>) {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', name, params);
    }
  }
  async shareGame(title: string) {
    if (navigator.share) {
      await navigator.share({ title, url: location.href });
    }
  }
  onPause(cb: () => void) { document.addEventListener('visibilitychange', () => { if (document.hidden) cb(); }); }
  onResume(cb: () => void) { document.addEventListener('visibilitychange', () => { if (!document.hidden) cb(); }); }
  async submitScore(score: number) {
    const scores = JSON.parse(localStorage.getItem('jb_scores') || '[]');
    scores.push({ name: 'Player', score, date: Date.now() });
    scores.sort((a: any, b: any) => b.score - a.score);
    localStorage.setItem('jb_scores', JSON.stringify(scores.slice(0, 100)));
  }
  async getLeaderboard() {
    return JSON.parse(localStorage.getItem('jb_scores') || '[]').slice(0, 10);
  }
}

// Poki adapter (stub - requires Poki SDK loaded)
export class PokiPlatform implements PlatformAdapter {
  name = 'poki';
  private sdk: any;
  async init() {
    this.sdk = (window as any).PokiSDK;
    if (this.sdk) await this.sdk.init();
  }
  async showRewardedAd(): Promise<boolean> {
    if (!this.sdk) return false;
    return new Promise(resolve => {
      this.sdk.rewardedBreak().then(() => resolve(true)).catch(() => resolve(false));
    });
  }
  async showInterstitialAd() {
    if (this.sdk) await this.sdk.commercialBreak();
  }
  trackEvent(name: string) { /* Poki handles analytics */ }
  async shareGame(title: string) { /* Poki handles sharing */ }
  onPause(cb: () => void) { document.addEventListener('visibilitychange', () => { if (document.hidden) cb(); }); }
  onResume(cb: () => void) { document.addEventListener('visibilitychange', () => { if (!document.hidden) cb(); }); }
  async submitScore() { /* Poki doesn't have leaderboard API */ }
  async getLeaderboard() { return []; }
}

export function detectPlatform(): PlatformAdapter {
  if (typeof window !== 'undefined' && (window as any).PokiSDK) return new PokiPlatform();
  // Future: detect wx (WeChat), tt (Douyin)
  return new WebPlatform();
}
