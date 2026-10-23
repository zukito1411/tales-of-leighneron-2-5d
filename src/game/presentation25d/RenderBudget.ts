import {getEffectsQuality,EFFECTS_QUALITY_EVENT} from '../systems/effectsQuality';

/** Stable GPU backing dimensions are more important than chasing instantaneous
 * FPS. Resizing every few seconds invalidates all world/depth/blur/night FBOs,
 * which itself creates the visible hitch we are trying to eliminate. */
export class RenderBudget {
  private quality=getEffectsQuality();
  private factor=1;
  private average=16.7;
  private elapsed=0;
  private reduced=false;
  private readonly changed=()=>{
    this.quality=getEffectsQuality();
    this.factor=1;
    this.average=16.7;
    this.elapsed=0;
    this.reduced=false;
  };
  constructor(){window.addEventListener(EFFECTS_QUALITY_EVENT,this.changed);}
  scale(width:number,height:number,density:number,delta:number,adaptive:boolean,active:boolean){
    const low=this.quality==='low';
    const base=Math.min(1,(low?1.1:1.5)/density,Math.sqrt((low?1200000:2400000)/(width*height)),2048/Math.max(width,height));
    if(!adaptive){
      this.factor=1;this.average=16.7;this.elapsed=0;this.reduced=false;
    }else if(active&&!this.reduced&&!document.hidden&&delta>0&&delta<180){
      this.average+=(Math.min(delta,100)-this.average)*.025;
      this.elapsed+=delta;
      // At most one backing-buffer adjustment in a session. No automatic
      // upscaling/reallocation cycle while the player moves or turns.
      if(this.elapsed>=8000){
        if(this.average>23){
          this.factor=Math.max(.72,Math.min(1,.90/(density*base)));
          this.reduced=true;
        }else this.elapsed=0;
      }
    }
    return base*this.factor;
  }
  destroy(){window.removeEventListener(EFFECTS_QUALITY_EVENT,this.changed);}
}
