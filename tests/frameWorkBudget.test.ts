import {describe,expect,it} from 'vitest';
import {FrameWorkBudget,optionalWorkAllowanceMs} from '../src/game/presentation25d/FrameWorkBudget';

describe('uncapped display-synced optional work',()=>{
  it('spends less background CPU at 120 Hz than 60 Hz',()=>{
    expect(optionalWorkAllowanceMs(1000/120)).toBeLessThan(optionalWorkAllowanceMs(1000/60));
    expect(optionalWorkAllowanceMs(1000/120)).toBeGreaterThan(0);
  });
  it('backs off on a slow frame and when presentation already consumes the period',()=>{
    expect(optionalWorkAllowanceMs(33.4)).toBeLessThan(optionalWorkAllowanceMs(16.6));
    expect(optionalWorkAllowanceMs(8.33,10)).toBeLessThan(optionalWorkAllowanceMs(8.33,1));
  });
  it('still advances when the browser reports invalid timing',()=>{
    expect(optionalWorkAllowanceMs(0)).toBeGreaterThan(0);
    expect(Number.isFinite(optionalWorkAllowanceMs(NaN,Infinity))).toBe(true);
  });
  it('holds the allowance constant during the same frame, and honors uploads',()=>{
    const work=new FrameWorkBudget();
    work.begin(1,8.33);
    const initial=work.stats().allowanceMs;
    const before=work.remaining('upload');
    expect(before).toBeGreaterThan(0);
    work.chargeMs('upload',.25);
    work.begin(1,33.3);
    expect(work.stats().allowanceMs).toBe(initial);
    expect(work.remaining('upload')).toBeLessThan(before);
    work.reportPresentationMs(10);
    work.begin(2,8.33);
    expect(work.stats().allowanceMs).toBeLessThan(initial);
  });
});
