import {describe,expect,it} from 'vitest';
import {CameraMotionProfiler,wrappedAngularDelta} from '../src/game/presentation25d/CameraMotionProfiler';

describe('camera rotation independent of player movement',()=>{
  it('tracks turning in place separately from walking',()=>{
    const profiler=new CameraMotionProfiler();
    expect(profiler.record(1000,0,0,200,300)).toBeNull();
    expect(profiler.record(1500,.1,0,200,300)).toBeNull();
    const s=profiler.record(2050,.2,.025,200,300)!;
    expect(s.mode).toBe('TURNING');
    expect(s.turningFrames).toBe(2);
    expect(s.travelFrames).toBe(0);
    expect(s.yawDegreesPerSecond).toBeGreaterThan(5);
    expect(s.yawPeakDegreesPerSecond).toBeGreaterThan(0);
  });
  it('handles wraparound at full revolution without a 360 degree spike',()=>{
    expect(Math.abs(wrappedAngularDelta(-Math.PI+.01,Math.PI-.01))).toBeCloseTo(.02,5);
    const profiler=new CameraMotionProfiler();
    profiler.record(1000,Math.PI-.01,0,0,0);
    const s=profiler.record(2100,-Math.PI+.01,0,0,0)!;
    expect(s.mode).toBe('TURNING');
    expect(s.yawPeakDegreesPerSecond).toBeLessThan(3);
  });
  it('reports moving and rotating together without losing either signal',()=>{
    const profiler=new CameraMotionProfiler();
    profiler.record(1000,0,0,0,0);
    const s=profiler.record(2100,.2,.1,20,12)!;
    expect(s.mode).toBe('TURNING + TRAVELING');
    expect(s.turningFrames).toBe(1);
    expect(s.travelFrames).toBe(1);
  });
  it('reports true idle and resets between diagnostic sessions',()=>{
    const profiler=new CameraMotionProfiler();
    profiler.record(1000,0,0,0,0);
    const a=profiler.record(2100,0,0,0,0)!;
    expect(a.mode).toBe('STILL');
    expect(a.turningFrames).toBe(0);
    profiler.reset();
    expect(profiler.record(2300,0,0,0,0)).toBeNull();
    const b=profiler.record(3500,0,0,0,0)!;
    expect(b.mode).toBe('STILL');
    expect(b.sampleFrames).toBe(1);
  });
});
