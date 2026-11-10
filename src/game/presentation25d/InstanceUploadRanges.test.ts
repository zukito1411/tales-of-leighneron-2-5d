import {describe,expect,it} from 'vitest';
import {MAX_INSTANCE_UPLOAD_GROUPS,planInstanceUploadRanges} from './InstanceUploadRanges';

describe('instance upload coalescing',()=>{
  it('merges nearby dirty slots into a single buffer transfer',()=>{
    const scratch:number[]=[];
    expect(planInstanceUploadRanges([1,8,23],1,24,scratch,2,24)).toEqual([1,24]);
    expect(scratch).toEqual([1,24]);
  });

  it('limits scattered updates to the permitted number of GL transfers',()=>{
    const out=planInstanceUploadRanges([0,40,80],0,81,[],2,24);
    expect(out).toEqual([0,81]);
    expect(out.length/2).toBeLessThanOrEqual(MAX_INSTANCE_UPLOAD_GROUPS);
  });

  it('falls back to a complete covered range for non-monotonic slots',()=>{
    expect(planInstanceUploadRanges([20,1],1,21,[],2,24)).toEqual([1,21]);
  });

  it('uploads dense dirty batches as one transfer',()=>{
    expect(planInstanceUploadRanges(Array.from({length:33},(_,i)=>i),0,33,[],2,24))
      .toEqual([0,33]);
  });

  it('reuses caller scratch storage',()=>{
    const scratch=[999,888];
    expect(planInstanceUploadRanges([],4,4,scratch)).toBe(scratch);
    expect(scratch).toEqual([]);
  });
});
