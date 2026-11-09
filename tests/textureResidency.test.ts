import {describe,expect,it} from 'vitest';
import {textureGraceMs,TEXTURE_IDLE_MS,TEXTURE_RESIDENCY_GRACE_MS}
  from '../src/game/presentation25d/textureResidency';

describe('high-refresh texture residency',()=>{
  const soft=128*1048576,emergency=288*1048576;
  it('uses milliseconds rather than counting 60/120/144 Hz frames',()=>{
    expect(TEXTURE_IDLE_MS).toBe(5000);
    expect(textureGraceMs(100*1048576,soft,emergency)).toBe(TEXTURE_RESIDENCY_GRACE_MS);
    expect(textureGraceMs(239*1048576,soft,emergency)).toBe(850);
    expect(textureGraceMs(350*1048576,soft,emergency)).toBe(65);
  });
  it('protects briefly occluded textures during normal soft pressure',()=>{
    expect(textureGraceMs(239*1048576,soft,emergency)).toBeGreaterThan(2*1000/60);
    expect(textureGraceMs(239*1048576,soft,emergency)).toBeGreaterThan(2*1000/144);
  });
  it('recognizes the emergency threshold without reducing art quality',()=>{
    expect(textureGraceMs(emergency,soft,emergency)).toBe(850);
    expect(textureGraceMs(emergency+1,soft,emergency)).toBe(65);
  });
});
