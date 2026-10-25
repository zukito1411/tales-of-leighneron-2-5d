import {PORT_BY_ID,type Port} from '../../data/ports';
import {useGameStore} from '../../store/gameStore';
import {saveGame} from '../../utils/save';
import type {WorldScene} from '../scenes/WorldScene';
import type {WorldGenerator} from './WorldGenerator';
import type {WorldTrafficSystem,Vehicle} from './WorldTrafficSystem';
import type {Vec2} from '../types';

interface Voyage {
  from:Port;to:Port;end:Vec2;elapsed:number;waiting:number;readyFrames:number;
  phase:'departure'|'fading'|'arrival'|'settling'|'revealing';vessel:Vehicle|null;landing:Vec2|null;
}
const DEPARTURE_MS=1800,DEPARTURE_DISTANCE=48,ARRIVAL_TIMEOUT_MS=30000;

/** Only the harbor departure is shown. The hidden crossing does not generate
 * an ocean graph or stream every intermediate chunk. */
export class ShipPassageSystem {
  private voyage:Voyage|null=null;
  private disposed=false;
  constructor(private readonly scene:WorldScene,private readonly world:WorldGenerator,private readonly fleet:WorldTrafficSystem){}
  get active(){return this.voyage!==null;}
  get safePosition(){return this.voyage?.landing??this.voyage?.from.landing;}
  begin(fromId:string,toId:string){
    const from=PORT_BY_ID[fromId],to=PORT_BY_ID[toId],store=useGameStore.getState();
    if(this.disposed||this.active||this.scene.screenTransition.active||!from||!to||from===to
      ||this.scene.inInterior||this.scene.storyCombatActive||store.cinematic||store.pendingCinematic
      ||!this.scene.player.active||!this.scene.player.visible||this.scene.player.hp<=0
      ||Math.hypot(this.scene.player.x-from.landing.x,this.scene.player.y-from.landing.y)>140)return false;
    if(![from.boat.x,from.boat.y,to.landing.x,to.landing.y].every(Number.isFinite))return false;
    let vessel:Vehicle|null=null;
    try{
      const end=this.departureEnd(from);
      vessel=this.fleet.createVessel('passage-vessel',from.boat.x,from.boat.y,from.river?.8:1.25);
      this.fleet.showPassenger(vessel);
      this.voyage={from,to,end,elapsed:0,waiting:0,readyFrames:0,phase:'departure',vessel,landing:null};
      const dx=end.x-from.boat.x,dy=end.y-from.boat.y;
      this.fleet.positionVessel(vessel,from.boat.x,from.boat.y,dx,dy||(!dx?-1:0),false);
      this.scene.player.resetInput();this.scene.player.setVisible(false);this.scene.physics.world.pause();
      this.scene.cameras.main.stopFollow().centerOn(from.boat.x,from.boat.y-90);
      this.scene.streamCinematicView(true,undefined,false);
      store.hydrate({passage:{from:fromId,to:toId,progress:0},panel:null,harborPortId:null,passageRequest:null});
      return true;
    }catch(error){
      if(this.voyage)this.recover(error);
      else{if(vessel)this.fleet.releaseVessel(vessel);this.scene.notify('The boat could not depart. You remain at the dock.');}
      console.warn('[passage] Departure could not start:',error);return false;
    }
  }
  update(delta:number){
    const v=this.voyage;if(!v||this.disposed||!Number.isFinite(delta)||delta<=0)return;
    const step=Math.min(delta,100);
    try{
      if(v.phase==='departure'||v.phase==='fading'){
        if(!v.vessel?.sprite.active)throw new Error('Passage boat was retired before departure finished');
        v.elapsed=Math.min(DEPARTURE_MS,v.elapsed+step);
        const t=v.elapsed/DEPARTURE_MS,dx=v.end.x-v.from.boat.x,dy=v.end.y-v.from.boat.y;
        const x=v.from.boat.x+dx*t,y=v.from.boat.y+dy*t;
        this.fleet.positionVessel(v.vessel,x,y,dx,dy||(!dx?-1:0),v.phase==='departure'&&(dx!==0||dy!==0));
        this.scene.cameras.main.centerOn(x,y-90);this.scene.streamCinematicView(true,undefined,false);
        if(v.phase==='departure'&&v.elapsed>=DEPARTURE_MS){
          if(!this.scene.screenTransition.begin('sail',v.to.name,false,'At sea'))throw new Error('Another transition is already active');
          v.phase='fading';this.status(v,.3);
        }
        if(v.phase==='fading'&&this.scene.screenTransition.covered){
          this.releaseBoat(v);v.phase='arrival';this.status(v,.6);
          this.scene.preparePassageView(v.to.landing);
        }
      }else if(v.phase==='arrival'||v.phase==='settling'){
        v.waiting+=Math.min(delta,1000);
        const destination=v.landing??v.to.landing;
        v.readyFrames=this.scene.preparePassageView(destination)?v.readyFrames+1:0;
        if(v.readyFrames>=3){
          if(v.phase==='arrival'){
            const landing=this.scene.passageLanding(v.to.landing);
            if(!landing)throw new Error('The destination dock has no safe landing');
            v.landing=landing;this.scene.landFromPassage(landing,true);
            // Recheck the actual feet/camera position after any dock offset,
            // including the actors admitted once the player is in this region.
            v.phase='settling';v.readyFrames=0;return;
          }
          useGameStore.getState().setStoryFlag('landed:'+v.to.id);
          saveGame();v.phase='revealing';v.waiting=0;this.status(v,.95);this.scene.screenTransition.reveal();
        }else if(v.waiting>=ARRIVAL_TIMEOUT_MS)throw new Error('Destination preparation timed out');
      }else if(!this.scene.screenTransition.active){
        this.voyage=null;useGameStore.getState().hydrate({passage:null});
        this.scene.player.resetInput();this.scene.physics.world.resume();
        this.scene.notify('Arrived at '+v.to.name+'. '+v.to.description);
      }else{
        v.waiting+=Math.min(delta,1000);
        if(v.waiting>5000)throw new Error('Arrival reveal did not complete');
      }
    }catch(error){this.recover(error);}
  }
  private departureEnd(from:Port):Vec2{
    const next=from.channel.find(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.hypot(p.x-from.boat.x,p.y-from.boat.y)>1);
    if(!next)return {...from.boat};
    const dx=next.x-from.boat.x,dy=next.y-from.boat.y,length=Math.hypot(dx,dy),distance=Math.min(DEPARTURE_DISTANCE,length);
    let end={...from.boat};
    for(let i=1;i<=8;i++){
      const p={x:from.boat.x+dx/length*distance*i/8,y:from.boat.y+dy/length*distance*i/8};
      if(this.world.getTerrainAt(p.x,p.y)!=='water')break;end=p;
    }
    return end;
  }
  private status(v:Voyage,progress:number){useGameStore.getState().hydrate({passage:{from:v.from.id,to:v.to.id,progress}});}
  private releaseBoat(v:Voyage){const boat=v.vessel;v.vessel=null;if(boat)this.fleet.releaseVessel(boat);}
  private recover(error:unknown){
    const v=this.voyage;if(!v)return;
    console.warn('[passage] Returning to a safe dock:',error);
    try{this.releaseBoat(v);}catch(cleanup){console.warn('[passage] Boat cleanup:',cleanup);}
    try{if(this.scene.player.active)this.scene.landFromPassage(v.landing??v.from.landing,true);}
    catch(recovery){console.warn('[passage] Dock recovery:',recovery);}
    finally{
      this.voyage=null;this.scene.screenTransition.cancel();
      useGameStore.getState().hydrate({passage:null,passageRequest:null});
      if(this.scene.player.active){
        this.scene.player.setVisible(true);this.scene.player.resetInput();
        try{this.scene.retryArrivalPreparation();}catch(retry){console.warn('[passage] Terrain retry:',retry);}
        try{if(!this.scene.coverWorldArrival(v.landing??v.from.landing))this.scene.physics.world.resume();}
        catch(cover){console.warn('[passage] Recovery cover:',cover);this.scene.screenTransition.cancel();this.scene.physics.world.resume();}
      }
    }
    this.scene.notify('The crossing was interrupted. You are back at a dock.');
  }
  destroy(){
    this.disposed=true;const v=this.voyage;this.voyage=null;
    try{if(v)this.releaseBoat(v);}finally{
      if(v)this.scene.screenTransition.cancel();
      useGameStore.getState().hydrate({passage:null,passageRequest:null});
      if(v&&this.scene.player?.active){this.scene.player.setVisible(true);this.scene.player.resetInput();}
    }
  }
}
