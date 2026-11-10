import {describe,expect,it} from 'vitest';
import {MAX_INSTANCE_UPLOAD_GROUPS,planInstanceUploadRanges} from '../src/game/presentation25d/InstanceUploadRanges';

describe('coalesced mobile GPU attribute uploads',()=>{
  const plan=(slots:number[],first:number,end:number)=>planInstanceUploadRanges(slots,first,end,[]);

  it('keeps adjacent and moderately separated dirty instances in a single GL call',()=>{
    expect(plan([0,1,3,8,19],0,20)).toEqual([0,20]);
  });
  it('keeps truly distant edits sparse within the bounded command budget',()=>{
    expect(plan([0,40,80,120],0,121)).toEqual([0,1,40,41,80,81,120,121]);
    expect(MAX_INSTANCE_UPLOAD_GROUPS).toBe(4);
  });
  it('chooses one contiguous upload over five or more individual driver calls',()=>{
    expect(plan([0,40,80,120,160],0,161)).toEqual([0,161]);
    expect(plan(Array.from({length:33},(_,i)=>i*4),0,129)).toEqual([0,129]);
  });
  it('conservatively handles unexpected unsorted updates and no edits',()=>{
    expect(plan([7,3],3,8)).toEqual([3,8]);
    expect(plan([],0,0)).toEqual([]);
  });
  it('preserves the exact final GPU bytes for static and changing objects',()=>{
    const spanScratch:number[]=[];
    // Deterministic patterns, including sparse changes, moving contiguous
    // actors and heavily changed batches. Every uploaded span may contain
    // unchanged bytes, but no actual dirty element can be missing.
    for(const size of [4,16]){
      for(let stride=1;stride<45;stride+=3){
        const cpu=new Float32Array(256*size);
        const baseline=new Float32Array(cpu.length).fill(-17);
        cpu.set(baseline);
        const dirty:number[]=[];
        for(let slot=0;slot<256;slot+=stride){
          dirty.push(slot);
          for(let c=0;c<size;c++)cpu[slot*size+c]=slot*10+c;
        }
        const gpu=baseline.slice();
        const spans=planInstanceUploadRanges(dirty,dirty[0],dirty[dirty.length-1]+1,spanScratch);
        expect(spans.length/2).toBeLessThanOrEqual(MAX_INSTANCE_UPLOAD_GROUPS);
        for(let i=0;i<spans.length;i+=2)
          gpu.set(cpu.subarray(spans[i]*size,spans[i+1]*size),spans[i]*size);
        expect(gpu).toEqual(cpu);
      }
    }
  });
});
