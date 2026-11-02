import {AttackTelegraph} from './AttackTelegraph';
import {authoredRoofs} from './authoredRoofs';
import {seededRandom} from '../../utils/seededRandom';
import type {WorldScene} from '../scenes/WorldScene';
import type {WeatherPresentation} from '../presentation25d/environment';
import type {AttackArea} from './attackWarning';
export interface StormBolt {id:number;x:number;y:number;age:number;height:number}
export const STORM_WARNING_MS=1800,STORM_RADIUS=64,STORM_DAMAGE_FRACTION=.6;

/** One committed, dodgeable strike at a time. The world owns damage and the
 * active-play clock; the renderer only reads the short-lived bolt snapshot. */
export class StormHazardSystem {
  readonly presentation:{bolt:StormBolt|null}={bolt:null};
  private readonly warning:AttackTelegraph;
  private readonly random=seededRandom('thunderstorm-hazards');
  private remaining=10000;private sequence=0;
  private strike:{area:AttackArea;age:number;hit:boolean}|null=null;
  constructor(private readonly scene:WorldScene){this.warning=new AttackTelegraph(scene,'storm-strike-warning',false);}
  private sheltered(x:number,y:number){return authoredRoofs.query({left:x,top:y,right:x,bottom:y}).length>0;}
  update(delta:number,weather:WeatherPresentation,blocked:boolean){
    if(blocked||weather.kind!=='storm'||weather.strength<.6){this.clear();return;}
    const dt=Math.max(0,Math.min(delta,100));
    const bolt=this.presentation.bolt;if(bolt){bolt.age+=dt;if(bolt.age>=600)this.presentation.bolt=null;}
    weather.lightningFlash=this.presentation.bolt?Math.max(0,1-this.presentation.bolt.age/240):0;
    if(!this.strike){
      this.remaining-=dt;if(this.remaining>0)return;
      this.remaining=10000+this.random()*12000;
      const p=this.scene.player,aimed=this.random()<.5,angle=this.random()*Math.PI*2,distance=120+this.random()*300;
      const point={x:p.x+(aimed?0:Math.cos(angle)*distance),y:p.y+(aimed?0:Math.sin(angle)*distance)};
      if(!this.scene.safeSkillPosition(point)||this.sheltered(point.x,point.y))return;
      this.strike={area:{kind:'circle',...point,radius:STORM_RADIUS,angle:0},age:0,hit:false};
    }
    const strike=this.strike;strike.age+=dt;
    if(!strike.hit){
      this.warning.draw(strike.area,strike.age/STORM_WARNING_MS,this.scene.playerRenderDepth(strike.area.y)-.05,0x62baff);
      if(strike.age<STORM_WARNING_MS)return;
      strike.hit=true;this.warning.clear();
      this.presentation.bolt={id:++this.sequence,x:strike.area.x,y:strike.area.y,age:0,height:1500};
      weather.lightningFlash=1;
      this.scene.presentationWeather.thunder();
      this.scene.shakeCombatCamera(180,.003);
      const p=this.scene.player;
      if(Math.hypot(p.x-strike.area.x,p.y-strike.area.y)<=STORM_RADIUS+8&&!this.sheltered(p.x,p.y))
        this.scene.damagePlayer(Math.ceil(p.maxHp*STORM_DAMAGE_FRACTION),strike.area);
    }
    if(strike.age>=STORM_WARNING_MS+600)this.strike=null;
  }
  clear(){this.strike=null;this.presentation.bolt=null;this.warning.clear();this.scene.presentationWeather.presentation.lightningFlash=0;}
  destroy(){this.clear();this.warning.destroy();}
}
