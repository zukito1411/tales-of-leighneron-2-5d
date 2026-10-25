import {useGameStore} from '../../store/gameStore';
import type {ScreenTransitionKind,ScreenTransitionPhase,ScreenTransitionState} from '../../data/screenTransition';

let nextTransitionId=0;
/** One scene-owned clock for DOM fades. No timers survive a scene shutdown,
 * and React receives phase/focus changes rather than per-frame progress. */
export class ScreenTransitionSystem {
  private state:ScreenTransitionState|null=null;
  private elapsed=0;
  private readonly reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  get active(){return this.state!==null;}
  get covered(){return this.state?.phase==='covered';}
  get morning(){return this.state?.phase==='morning';}
  begin(kind:ScreenTransitionKind,label:string,covered=false){
    if(this.active)return false;
    this.elapsed=0;
    this.state={id:++nextTransitionId,kind,phase:covered?'covered':'fade-out',label,
      duration:this.reduced.matches?180:550,nightDuration:this.reduced.matches?700:2200,paused:false};
    this.publish();return true;
  }
  update(delta:number,paused:boolean){
    const state=this.state;if(!state)return;
    this.setPaused(paused);
    if(paused||!Number.isFinite(delta)||delta<=0)return;
    this.elapsed+=Math.min(delta,100);
    if(this.elapsed<state.duration)return;
    if(state.phase==='fade-out')this.phase('covered',0);
    else if(state.phase==='night')this.phase('morning',0);
    else if(state.phase==='fade-in')this.cancel();
  }
  setPaused(paused:boolean){
    if(this.state&&this.state.paused!==paused){this.state.paused=paused;this.publish();}
  }
  night(){if(this.covered)this.phase('night',this.state!.nightDuration);}
  reveal(){if(this.state&&this.state.phase!=='fade-in')this.phase('fade-in',this.reduced.matches?200:650);}
  cancel(){
    const id=this.state?.id;this.state=null;this.elapsed=0;
    if(id!==undefined&&useGameStore.getState().screenTransition?.id===id)
      useGameStore.getState().hydrate({screenTransition:null});
  }
  private phase(phase:ScreenTransitionPhase,duration:number){
    if(!this.state)return;
    this.state={...this.state,phase,duration};this.elapsed=0;this.publish();
  }
  private publish(){if(this.state)useGameStore.getState().hydrate({screenTransition:{...this.state}});}
  destroy(){this.cancel();}
}
