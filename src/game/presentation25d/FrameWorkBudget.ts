import type Phaser from 'phaser';

export type WorkKind='terrain'|'actors'|'elevation'|'upload'|'retire'|'geography'|'navigation'|'geometry'|'shaders';

/** Optional tasks share the spare part of the *actual* rAF period, not a
 * fixed 16.7ms assumption. Returning a small nonzero allowance ensures
 * visible terrain and essential actor admission can always make progress.
 *
 * The CPU cost is from the previous presentation frame. Do not use GPU time
 * here: disjoint timer queries are unavailable on many Android WebViews.
 */
export function optionalWorkAllowanceMs(rawDelta:number,lastPresentationCpuMs=0){
  const cadence=Number.isFinite(rawDelta)&&rawDelta>0?Math.min(50,Math.max(4,rawDelta)):1000/60;
  // Keep optional work below roughly 9% of the available display interval.
  const baseline=Math.max(.35,Math.min(1.8,cadence*.085));
  const backlog=cadence>32?.45:cadence>22?.7:cadence>18?.85:1;
  const headroom=lastPresentationCpuMs>0&&Number.isFinite(lastPresentationCpuMs)
    ?Math.max(.4,Math.min(1,(cadence-lastPresentationCpuMs-1)/3)):1;
  return Math.max(.3,Math.min(1.8,baseline*backlog*headroom));
}

/** One allowance shared by scene streaming and presentation. Atomic jobs may
 * overrun it, but that cost prevents additional background work this frame. */
export class FrameWorkBudget {
  private frame=-1;
  private used=0;
  private capacity=1.8;
  private uploadUsed=0;
  private navigationUsed=0;
  private previousPresentationMs=0;
  begin(frame:number,rawDelta:number){
    if(frame===this.frame)return;
    this.frame=frame;this.used=this.uploadUsed=this.navigationUsed=0;
    this.capacity=optionalWorkAllowanceMs(rawDelta,this.previousPresentationMs);
  }
  reportPresentationMs(milliseconds:number){
    if(Number.isFinite(milliseconds)&&milliseconds>=0)this.previousPresentationMs=milliseconds;
  }
  remaining(kind:WorkKind,limit=Infinity){
    // Preserve a bounded upload/navigation opportunity without allowing
    // background work to consume a large fraction of a 120 Hz frame.
    const reserve=(kind==='upload'?0:Math.max(0,Math.min(.45,this.capacity*.3)-this.uploadUsed))
      +(kind==='navigation'?0:Math.max(0,Math.min(.18,this.capacity*.25)-this.navigationUsed));
    return Math.max(0,Math.min(limit,this.capacity-this.used-reserve));
  }
  charge(kind:WorkKind,start:number){this.chargeMs(kind,performance.now()-start);}
  chargeMs(kind:WorkKind,milliseconds:number){const cost=Math.max(0,milliseconds);this.used+=cost;if(kind==='upload')this.uploadUsed+=cost;if(kind==='navigation')this.navigationUsed+=cost;}
  stats(){return {usedMs:this.used,allowanceMs:this.capacity,lastPresentationCpuMs:this.previousPresentationMs};}
}
const budgets=new WeakMap<Phaser.Game,FrameWorkBudget>();
export function frameWork(game:Phaser.Game){
  let budget=budgets.get(game);
  if(!budget){budget=new FrameWorkBudget();budgets.set(game,budget);}
  budget.begin(game.loop.frame,game.loop.rawDelta);
  return budget;
}
export function releaseFrameWork(game:Phaser.Game){budgets.delete(game);}
