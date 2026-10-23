import {getEffectsQuality,EFFECTS_QUALITY_EVENT} from '../systems/effectsQuality';
/** Bound fill rate independently of art resolution and logical input units.
 * Sustained slow frames reduce only backing resolution; effects stay enabled. */
export class RenderBudget {
  private quality=getEffectsQuality();private factor=1;private average=16.7;private elapsed=0;private good=0;
  private readonly changed=()=>{this.quality=getEffectsQuality();this.factor=1;this.average=16.7;this.elapsed=this.good=0;};
  constructor(){window.addEventListener(EFFECTS_QUALITY_EVENT,this.changed);}
  scale(width:number,height:number,density:number,delta:number,adaptive:boolean,active:boolean){
    const low=this.quality==='low';
    const base=Math.min(1,(low?1.1:1.5)/density,Math.sqrt((low?1200000:2400000)/(width*height)),2048/Math.max(width,height));
    if(!adaptive)this.factor=1;
    else if(active&&!document.hidden&&delta>0&&delta<180){
      this.average+=(Math.min(delta,100)-this.average)*.035;this.elapsed+=delta;
      if(this.average<18.5)this.good+=delta;else this.good=0;
      if(this.elapsed>2800&&this.average>24){this.factor=Math.max(Math.min(1,.9/(density*base)),this.factor*.9);this.elapsed=0;}
      else if(this.good>8000&&this.factor<1){this.factor=Math.min(1,this.factor+.05);this.elapsed=this.good=0;}
    }
    return base*this.factor;
  }
  destroy(){window.removeEventListener(EFFECTS_QUALITY_EVENT,this.changed);}
}
