import {describe,expect,it} from 'vitest';
import {FrameTiming} from '../src/game/presentation25d/FrameTiming';

describe('rendered-frame FPS diagnostics',()=>{
  it('reports ~60 rendered FPS from 60 Hz *presented* frame intervals',()=>{
    const timing=new FrameTiming();
    for(let i=0;i<300;i++)timing.add(1000/60);
    const stats=timing.stats();
    expect(stats.samples).toBe(300);
    expect(stats.fps).toBeCloseTo(60,2);
    expect(stats.onePercentLowFps).toBeCloseTo(60,2);
    expect(stats.p50).toBeCloseTo(1000/60,2);
    expect(stats.p95).toBeCloseTo(1000/60,2);
    expect(stats.over33).toBe(0);
  });

  it('captures rare presentation hitches without inflating normal frame percentiles',()=>{
    const timing=new FrameTiming();
    for(let i=0;i<297;i++)timing.add(1000/60);
    timing.add(33.34);
    timing.add(50.01);
    timing.add(83.34);
    const stats=timing.stats();
    expect(stats.over33).toBe(3);
    expect(stats.over50).toBe(2);
    expect(stats.maximum).toBeCloseTo(83.34,2);
    expect(stats.p95).toBeCloseTo(1000/60,2);
    expect(stats.onePercentLowFps).toBeLessThan(stats.fps);
    expect(stats.fps).toBeLessThan(60);
  });

  it('keeps only the last 300 intervals, ignoring invalid durations',()=>{
    const timing=new FrameTiming();
    timing.add(0);timing.add(-1);timing.add(NaN);timing.add(Infinity);
    for(let i=0;i<300;i++)timing.add(16.667);
    timing.add(40);
    const stats=timing.stats();
    expect(stats.samples).toBe(300);
    expect(stats.over33).toBe(1);
    expect(stats.p50).toBeCloseTo(16.667,2);
    timing.reset();
    expect(timing.stats().samples).toBe(0);
    for(let i=0;i<60;i++)timing.add(20);
    expect(timing.stats().fps).toBeCloseTo(50,2);
  });
});
