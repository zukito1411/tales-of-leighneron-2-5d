import {describe,it,expect} from 'vitest';
import {GAME_FPS_CONFIG} from '../src/game/systems/framePacing';

describe('2.5D game frame pacing',()=>{
  it('enforces a 60 FPS game loop rather than the uncapped refresh rate',()=>{
    // Phaser's default target is 60, but its default limit is zero (uncapped).
    expect(GAME_FPS_CONFIG).toMatchObject({target:60,limit:60});
    expect(GAME_FPS_CONFIG.limit).toBe(GAME_FPS_CONFIG.target);
  });
  it('retains browser requestAnimationFrame scheduling',()=>{
    expect(GAME_FPS_CONFIG.forceSetTimeOut).toBe(false);
  });
});
