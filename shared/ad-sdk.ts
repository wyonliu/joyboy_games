/**
 * Universal Ad SDK Adapter for Melo's Quest 1-5
 *
 * Supports Poki, CrazyGames, and GameDistribution with a unified API.
 * Auto-detects the loaded SDK at runtime so the same build works on any platform.
 * Falls back to a stub (console-log) mode for development / itch.io.
 *
 * Usage:
 *   import { AdSDK } from '../../shared/ad-sdk';
 *   await AdSDK.init();
 *   AdSDK.gameplayStart();
 *   AdSDK.gameplayStop();
 *   await AdSDK.showInterstitial();
 *   const watched = await AdSDK.showRewarded();
 */

// ---------------------------------------------------------------------------
// Type declarations for third-party SDK globals
// ---------------------------------------------------------------------------

interface PokiSDKGlobal {
  init(): Promise<void>;
  gameplayStart(): void;
  gameplayStop(): void;
  commercialBreak(): Promise<void>;
  rewardedBreak(): Promise<boolean>;
  setDebug(enabled: boolean): void;
}

interface CrazyGamesSDKGlobal {
  init(): Promise<void>;
  game: {
    gameplayStart(): void;
    gameplayStop(): void;
  };
  ad: {
    requestAd(type: 'midgame' | 'rewarded'): Promise<void>;
  };
}

interface GameDistributionSDKGlobal {
  showAd(): Promise<void>;
  showRewardedAd(): Promise<{ success: boolean }>;
}

declare global {
  interface Window {
    PokiSDK?: PokiSDKGlobal;
    CrazyGames?: { SDK: CrazyGamesSDKGlobal };
    gdsdk?: GameDistributionSDKGlobal;
  }
}

// ---------------------------------------------------------------------------
// Platform enum & detection
// ---------------------------------------------------------------------------

export type AdPlatform = 'poki' | 'crazygames' | 'gamedistribution' | 'stub';

function detectPlatform(): AdPlatform {
  if (typeof window === 'undefined') return 'stub';
  if (window.PokiSDK) return 'poki';
  if (window.CrazyGames?.SDK) return 'crazygames';
  if (window.gdsdk) return 'gamedistribution';
  return 'stub';
}

// ---------------------------------------------------------------------------
// Platform adapters
// ---------------------------------------------------------------------------

interface PlatformAdapter {
  name: AdPlatform;
  init(): Promise<void>;
  gameplayStart(): void;
  gameplayStop(): void;
  showInterstitial(): Promise<void>;
  /** Resolves `true` if the user watched the full ad, `false` otherwise. */
  showRewarded(): Promise<boolean>;
}

// ---- Stub (dev / itch.io) ------------------------------------------------

function createStubAdapter(): PlatformAdapter {
  const log = (msg: string) => console.log(`[AdSDK:stub] ${msg}`);
  return {
    name: 'stub',
    async init() { log('init (no-op)'); },
    gameplayStart() { log('gameplayStart'); },
    gameplayStop() { log('gameplayStop'); },
    async showInterstitial() { log('showInterstitial (skipped)'); },
    async showRewarded() { log('showRewarded (auto-granted)'); return true; },
  };
}

// ---- Poki ----------------------------------------------------------------

function createPokiAdapter(): PlatformAdapter {
  const sdk = window.PokiSDK!;
  return {
    name: 'poki',
    async init() { await sdk.init(); },
    gameplayStart() { sdk.gameplayStart(); },
    gameplayStop() { sdk.gameplayStop(); },
    async showInterstitial() { await sdk.commercialBreak(); },
    async showRewarded() {
      const success = await sdk.rewardedBreak();
      return success;
    },
  };
}

// ---- CrazyGames ----------------------------------------------------------

function createCrazyGamesAdapter(): PlatformAdapter {
  const sdk = window.CrazyGames!.SDK;
  return {
    name: 'crazygames',
    async init() { await sdk.init(); },
    gameplayStart() { sdk.game.gameplayStart(); },
    gameplayStop() { sdk.game.gameplayStop(); },
    async showInterstitial() { await sdk.ad.requestAd('midgame'); },
    async showRewarded() {
      try {
        await sdk.ad.requestAd('rewarded');
        return true;
      } catch {
        return false;
      }
    },
  };
}

// ---- GameDistribution ----------------------------------------------------

function createGameDistributionAdapter(): PlatformAdapter {
  const sdk = window.gdsdk!;
  return {
    name: 'gamedistribution',
    // GD SDK auto-initialises via the script tag; nothing extra needed.
    async init() {},
    // GD SDK has no gameplay-tracking API.
    gameplayStart() {},
    gameplayStop() {},
    async showInterstitial() { await sdk.showAd(); },
    async showRewarded() {
      try {
        const result = await sdk.showRewardedAd();
        return result?.success ?? false;
      } catch {
        return false;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function createAdapter(platform: AdPlatform): PlatformAdapter {
  switch (platform) {
    case 'poki': return createPokiAdapter();
    case 'crazygames': return createCrazyGamesAdapter();
    case 'gamedistribution': return createGameDistributionAdapter();
    default: return createStubAdapter();
  }
}

// ---------------------------------------------------------------------------
// Public singleton
// ---------------------------------------------------------------------------

let adapter: PlatformAdapter | null = null;
let initialized = false;

function getAdapter(): PlatformAdapter {
  if (!adapter) {
    adapter = createAdapter(detectPlatform());
  }
  return adapter;
}

export const AdSDK = {
  /** Detected (or forced) platform name. Available after first call. */
  get platform(): AdPlatform {
    return getAdapter().name;
  },

  /**
   * Initialise the underlying SDK. Call once at game boot.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  async init(): Promise<void> {
    if (initialized) return;
    await getAdapter().init();
    initialized = true;
    console.log(`[AdSDK] initialized on platform: ${getAdapter().name}`);
  },

  /** Notify the SDK that active gameplay has started. */
  gameplayStart(): void {
    getAdapter().gameplayStart();
  },

  /** Notify the SDK that active gameplay has stopped (pause / menu / death). */
  gameplayStop(): void {
    getAdapter().gameplayStop();
  },

  /**
   * Show an interstitial (commercial break) ad.
   * Call between levels, on death screens, etc.
   * Always resolves — failures are swallowed so game flow is never blocked.
   */
  async showInterstitial(): Promise<void> {
    try {
      await getAdapter().showInterstitial();
    } catch (err) {
      console.warn('[AdSDK] interstitial failed:', err);
    }
  },

  /**
   * Show a rewarded ad. Resolves `true` if the user watched the full ad
   * and should receive a reward, `false` otherwise.
   *
   * Convenience overload: pass a callback and it will be invoked with the
   * result so you can use either style:
   *   const ok = await AdSDK.showRewarded();
   *   AdSDK.showRewarded((ok) => { if (ok) grantReward(); });
   */
  async showRewarded(callback?: (success: boolean) => void): Promise<boolean> {
    let success = false;
    try {
      success = await getAdapter().showRewarded();
    } catch (err) {
      console.warn('[AdSDK] rewarded failed:', err);
    }
    callback?.(success);
    return success;
  },

  /**
   * Force a specific platform adapter (useful for testing).
   * Must be called *before* `init()`.
   */
  _forceAdapter(platform: AdPlatform): void {
    adapter = createAdapter(platform);
    initialized = false;
  },
};

// ---------------------------------------------------------------------------
// Script-tag helper
// ---------------------------------------------------------------------------

/** URLs for each platform's SDK script. */
export const AD_SDK_URLS: Record<Exclude<AdPlatform, 'stub'>, string> = {
  poki: 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js',
  crazygames: 'https://sdk.crazygames.com/crazygames-sdk-v3.js',
  gamedistribution: 'https://html5.api.gamedistribution.com/main.min.js',
};

/**
 * Returns a `<script>` tag string for the given platform.
 *
 * ```ts
 * document.head.insertAdjacentHTML('beforeend', adScriptTag('poki'));
 * ```
 */
export function adScriptTag(platform: Exclude<AdPlatform, 'stub'>): string {
  return `<script src="${AD_SDK_URLS[platform]}"><\/script>`;
}

/**
 * Dynamically loads a platform SDK by injecting its `<script>` tag and
 * waiting for it to finish loading. Returns a promise that resolves once
 * the script's `onload` fires.
 */
export function loadAdSDK(platform: Exclude<AdPlatform, 'stub'>): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (typeof document === 'undefined') {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = AD_SDK_URLS[platform];
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`[AdSDK] failed to load ${platform} SDK`));
    document.head.appendChild(script);
  });
}
