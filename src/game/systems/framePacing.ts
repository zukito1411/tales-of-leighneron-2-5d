/**
 * Run on every browser requestAnimationFrame (up to the display/WebView's
 * actual refresh cadence), not Phaser's optional integer FPS limiter.
 *
 * The renderer and all existing gameplay still use elapsed-time deltas.
 * Arcade physics keeps a separate 60 Hz fixed timestep in MernondnaGame.ts.
 * 'target' is Phaser's initial/smoothing reference, NOT a render cap.
 */
export const GAME_FPS_CONFIG={
  target:60,
  limit:0,
  forceSetTimeOut:false,
} as const;
