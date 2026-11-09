import {describe,it,expect} from 'vitest';
import {GAME_FPS_CONFIG} from '../src/game/systems/framePacing';

describe('2.5D high refresh frame pacing',()=>{
  it('uses rAF without an artificial 60 FPS cap',()=>{
    expect(GAME_FPS_CONFIG).toMatchObject({target:60,limit:0,forceSetTimeOut:false});
  });
  it('preserves Phaser timing reference without forcing setTimeout',()=>{
    expect(GAME_FPS_CONFIG.target).toBeGreaterThan(0);
    expect(GAME_FPS_CONFIG.forceSetTimeOut).toBe(false);
  });
});
