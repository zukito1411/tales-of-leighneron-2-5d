/**
 * One fixed render-and-update budget for Phaser's shared gameplay / Three.js
 * presentation loop. Phaser's fps.target alone does NOT cap execution:
 * without fps.limit a 120 Hz Android display submits twice as many world,
 * GPU and simulation frames as the 60 FPS target can sustainably afford.
 *
 * Keep requestAnimationFrame: it aligns with screen refresh and does not
 * replace animation, effects, input, physics, or time-based gameplay.
 */
export const GAME_FPS_CONFIG={
  target:60,
  limit:60,
  forceSetTimeOut:false,
} as const;
