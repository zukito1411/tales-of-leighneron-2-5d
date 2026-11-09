import {describe,expect,it} from 'vitest';
import {MovementStreamProfiler} from '../src/game/systems/MovementStreamProfiler';

describe('diagnostic-only movement streaming measurements',()=>{
  it('separates terrain, projected view and content admission costs',()=>{
    const profiler=new MovementStreamProfiler();
    expect(profiler.record(1000,false,.2,.1,.4)).toBeNull();
    expect(profiler.record(1500,true,1.2,.2,4)).toBeNull();
    const s=profiler.record(2000,true,12,.3,1)!;
    expect(s).not.toBeNull();
    expect(s.sampleFrames).toBe(3);
    expect(s.movingFrames).toBe(2);
    expect(s.terrainPeakMs).toBe(12);
    expect(s.contentPeakMs).toBe(4);
    expect(s.viewPeakMs).toBe(.3);
    expect(s.streamingHitches).toBe(1);
    expect(s.terrainAvgMs).toBeCloseTo(13.4/3);
  });
  it('resets its one-second history and does not publish early',()=>{
    const profiler=new MovementStreamProfiler();
    profiler.record(100,true,4,1,5);
    profiler.reset();
    expect(profiler.record(1000,false,.1,.1,.1)).toBeNull();
    const stats=profiler.record(2100,false,.1,.1,.1)!;
    expect(stats.streamingHitches).toBe(0);
    expect(stats.movingFrames).toBe(0);
    expect(stats.terrainPeakMs).toBe(.1);
    expect(profiler.record(2300,true,.1,.1,.1)).toBeNull();
  });
  it('ignores invalid durations rather than propagating NaN to the HUD',()=>{
    const profiler=new MovementStreamProfiler();
    profiler.record(1000,false,NaN,-2,Infinity);
    const stats=profiler.record(2200,true,1,1,1)!;
    expect(Number.isFinite(stats.terrainAvgMs+stats.viewAvgMs+stats.contentAvgMs)).toBe(true);
    expect(stats.streamingHitches).toBe(0);
  });
});
