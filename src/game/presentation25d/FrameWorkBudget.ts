import type Phaser from 'phaser';

export type WorkKind='terrain'|'actors'|'elevation'|'upload'|'retire'|'geography';
/** One allowance shared by scene streaming and presentation. Atomic jobs may
 * overrun it, but that cost prevents additional background work this frame. */
export class FrameWorkBudget {
  private frame=-1;
  private used=0;
  private capacity=1.8;
  private uploadUsed=0;
  begin(frame:number,rawDelta:number){
    if(frame===this.frame)return;
    this.frame=frame;this.used=this.uploadUsed=0;
    this.capacity=rawDelta>32?.6:rawDelta>22?1:1.8;
  }
  remaining(kind:WorkKind,limit=Infinity){
    // Preserve an upload slot even when terrain/actor preparation is busy.
    const reserve=kind==='upload'?0:Math.max(0,Math.min(.45,this.capacity*.3)-this.uploadUsed);
    return Math.max(0,Math.min(limit,this.capacity-this.used-reserve));
  }
  charge(kind:WorkKind,start:number){this.chargeMs(kind,performance.now()-start);}
  chargeMs(kind:WorkKind,milliseconds:number){const cost=Math.max(0,milliseconds);this.used+=cost;if(kind==='upload')this.uploadUsed+=cost;}
  stats(){return {usedMs:this.used,allowanceMs:this.capacity};}
}
const budgets=new WeakMap<Phaser.Game,FrameWorkBudget>();
export function frameWork(game:Phaser.Game){
  let budget=budgets.get(game);
  if(!budget){budget=new FrameWorkBudget();budgets.set(game,budget);}
  budget.begin(game.loop.frame,game.loop.rawDelta);
  return budget;
}
export function releaseFrameWork(game:Phaser.Game){budgets.delete(game);}
