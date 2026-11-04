import {settlementPastureAt} from '../../data/settlementPastures';
import {protectedSettlementAt} from '../../data/settlements';
import type Phaser from 'phaser';
import {GAME_DISPOSING} from './gameLifetime';
import {frameWork} from '../presentation25d/FrameWorkBudget';
import {preparePresentationSource} from '../presentation25d/resourcePreparation';
import {outdoorLivestockSites,roamingLivestockSpecies,type LivestockSite,type LivestockSpecies} from '../../data/livestockSites';
import type {Rect} from '../../data/settlementGeometry';
import type {Vec2} from '../types';
import {onPlane} from '../presentation25d/plane';
import {StaticBoundsIndex} from './StaticBoundsIndex';
import type {GroundShadowSystem} from './GroundShadowSystem';
import type {WildlifeHost} from './AmbientWildlifeSystem';
import {wildlifeFacing,wildlifeInView} from './wildlifePresentation';
import {setDepthIfChanged} from './renderDepth';
import {applyLivestockArt,loadLivestockArt,livestockTexture,LIVESTOCK_ART,type LivestockArtLoad} from './LivestockArt';

export interface InteriorLivestockContext {
 sites:readonly LivestockSite[];
 route(from:Vec2,to:Vec2,radius:number):boolean;
 depthAt(y:number):number;
}
interface Animal {
 sprite:Phaser.GameObjects.Sprite;species:LivestockSpecies;home:Vec2;site:string;radius:number;
 goal:Vec2|null;heading:Vec2;age:number;nextAt:number;checkAt:number;checkedAt:number;graze:boolean;
 contact?:Phaser.GameObjects.Image;bounds?:Rect;roaming?:boolean;
}
const WALK_POSES=[0,1,0,2] as const;
const ORDER:readonly LivestockSpecies[]=['chicken','chicken','goat','cow','chicken','goat'];
const RADIUS:Record<LivestockSpecies,number>={chicken:11,goat:23,cow:34,horse:45};
const OUTDOOR_LIMIT=12,ROAMING_CELL=768;
/** One bounded pool for outdoor livestock and the currently open stable.
 * Planning uses fair turns; posing/movement never searches the world. */
export class LivestockSystem {
 private readonly sites=new StaticBoundsIndex(outdoorLivestockSites().map(site=>({site,bounds:{left:site.x-400,right:site.x+400,top:site.y-400,bottom:site.y+400}})));
 private readonly animals:Animal[]=[];
 private context:InteriorLivestockContext|null=null;
 private admission:Generator<void>|null=null;
 private loading:{abort:AbortController;job:LivestockArtLoad}|null=null;
 private disposed=false;private elapsed=0;private nextAdmission=1500;private sequence=0;
 private workTurn=0;private actorCursor=0;
 private readonly retry=new Map<LivestockSpecies,number>();
 private readonly facing={row:0,flip:false};
 private readonly stepPoint={x:0,y:0};
 constructor(private readonly scene:Phaser.Scene,private readonly host:WildlifeHost,private readonly shadows:GroundShadowSystem){scene.game.events.once(GAME_DISPOSING,this.destroy,this);}
 get interior(){return this.context!==null;}
 setInterior(context:InteriorLivestockContext|null){this.reset();this.context=context;}
 update(delta:number,player:Vec2,hour:number){
  if(this.disposed||!this.context&&!this.host.livestockRoute||!Number.isFinite(delta))return;
  const step=Math.max(0,Math.min(80,delta));this.elapsed+=step;
  const work=frameWork(this.scene.game),night=!this.context&&(hour<5||hour>=21);
  this.loading?.job.advance(work);
  // Sleeping livestock still exist at night/dawn. Only their wandering rests;
  // arriving at 04:52 must not produce an empty pasture until a later reload.
  if(!this.admission&&this.elapsed>=this.nextAdmission&&!this.loading)this.admission=this.admit(player);
  // Reserve a planning/admission turn even when low FPS leaves every safety
  // check due. Rotate actor selection rather than favoring the first sprite.
  if(work.remaining('actors',.2)>.08){
   const turn=this.workTurn++%4,start=performance.now();
   try{
    if(turn===3&&this.advanceAdmission()){/* An admission step owns this turn. */}
    else if(!this.behavior(player,night,turn===2))this.advanceAdmission();
   }finally{work.charge('actors',start);}
  }
  for(const animal of this.animals){
   const sprite=animal.sprite;if(!sprite.active)continue;
   const distance=Math.hypot(sprite.x-player.x,sprite.y-player.y);
   if(!this.context&&distance>1450&&!wildlifeInView(this.scene,sprite,100,180)){this.release(animal);continue;}
   animal.age+=step;if(night&&distance>=160)animal.goal=null;
   let moving=false;
   // Stop a stale moving route until its next bounded safety turn succeeds.
   if(animal.goal&&this.elapsed-animal.checkedAt<480){
    const dx=animal.goal.x-sprite.x,dy=animal.goal.y-sprite.y,len=Math.hypot(dx,dy);
    if(len<3)animal.goal=null;
    else{
     const speed=distance<160?animal.species==='chicken'?65:45:animal.species==='cow'?17:25;
     const amount=Math.min(len,speed*step/1000),x=sprite.x+dx/len*amount,y=sprite.y+dy/len*amount;
     this.stepPoint.x=x;this.stepPoint.y=y;
     if(this.separated(this.stepPoint,animal)&&Math.hypot(x-player.x,y-player.y)>RADIUS[animal.species]+28){
      sprite.setPosition(x,y);animal.heading.x=dx/len;animal.heading.y=dy/len;moving=true;
     }else animal.goal=null;
    }
   }
   wildlifeFacing(this.scene,animal.heading,this.facing);
   const art=LIVESTOCK_ART[animal.species],cycle=art.walkCycle??WALK_POSES;
   const pose=moving?cycle[Math.floor(animal.age/(animal.species==='chicken'?125:190))%cycle.length]:animal.graze?(art.grazingFrame??3):(art.idleFrame??0);
   const frame=this.facing.row*4+pose,alpha=Math.min(1,animal.age/400);
   if(Number(sprite.frame.name)!==frame)sprite.setFrame(frame);
   if(sprite.flipX!==this.facing.flip)sprite.setFlipX(this.facing.flip);
   setDepthIfChanged(sprite,this.context?.depthAt(sprite.y)??sprite.y);
   if(sprite.alpha!==alpha)sprite.setAlpha(alpha);
  }
 }
 private advanceAdmission(){
  if(!this.admission)return false;
  if(this.admission.next().done){this.admission=null;this.nextAdmission=this.elapsed+600;}
  return true;
 }
 private behavior(player:Vec2,night:boolean,decisionsFirst:boolean){
  for(let pass=0;pass<2;pass++){
   const decision=decisionsFirst?pass===0:pass===1;
   for(let n=0;n<this.animals.length;n++){
    const i=(this.actorCursor+n)%this.animals.length,a=this.animals[i],sprite=a.sprite;
    if(!sprite.active)continue;
    const distance=Math.hypot(sprite.x-player.x,sprite.y-player.y);
    if(decision){
     if(night&&distance>=105+RADIUS[a.species]||this.elapsed<a.nextAt||a.goal&&distance>=105+RADIUS[a.species])continue;
     this.actorCursor=(i+1)%this.animals.length;a.graze=false;
     let goal:Vec2;
     if(distance<105+RADIUS[a.species]){
      const dx=sprite.x-player.x,dy=sprite.y-player.y,len=Math.hypot(dx,dy)||1;
      goal={x:sprite.x+dx/len*110,y:sprite.y+dy/len*110};a.nextAt=this.elapsed+700;
     }else{
      a.nextAt=this.elapsed+2500+(this.sequence++%5)*650;a.graze=this.sequence%3!==0;
      const angle=this.sequence*2.3999632297,run=Math.min(a.radius*.7,45+(this.sequence%4)*20);
      goal={x:a.home.x+Math.cos(angle)*run,y:a.home.y+Math.sin(angle)*run};
     }
     if(!a.graze){a.goal=this.clear(sprite,goal,a)?goal:null;a.checkedAt=this.elapsed;}
     return true;
    }
    if(this.elapsed<a.checkAt)continue;
    this.actorCursor=(i+1)%this.animals.length;a.checkAt=this.elapsed+(a.goal?160:700);
    let point:Vec2=sprite;
    // Certify the complete distance possible before the 480 ms expiry,
    // including a chicken's faster escape speed. Never outwalk a short probe.
    if(a.goal){const dx=a.goal.x-sprite.x,dy=a.goal.y-sprite.y,length=Math.hypot(dx,dy),run=Math.min(34,length);
     if(length>0)point={x:sprite.x+dx/length*run,y:sprite.y+dy/length*run};}
    if(this.clear(sprite,point,a))a.checkedAt=this.elapsed;
    else{a.goal=null;if(!wildlifeInView(this.scene,sprite,100,60))this.release(a);}
    return true;
   }
  }
  return false;
 }
 private separated(point:Vec2,owner?:Animal,radius=owner?RADIUS[owner.species]:34){
  for(const a of this.animals)if(a!==owner&&a.sprite.active&&Math.hypot(a.sprite.x-point.x,a.sprite.y-point.y)<=radius+RADIUS[a.species]+22)return false;
  return true;
 }
 private route(from:Vec2,to:Vec2,radius:number){return this.context?.route(from,to,radius)??Boolean(this.host.livestockRoute?.(from,to,radius));}
 private inBounds(point:Vec2,bounds:Rect|undefined,radius:number,species:LivestockSpecies){return (species!=='chicken'||!settlementPastureAt(point.x,point.y))&&(!bounds||point.x>=bounds.left+radius+22&&point.x<=bounds.right-radius-22&&point.y>=bounds.top+radius+22&&point.y<=bounds.bottom-radius-22);}
 private clear(from:Vec2,to:Vec2,owner:Animal){return (!owner.roaming||!protectedSettlementAt(to.x,to.y))&&this.inBounds(to,owner.bounds,RADIUS[owner.species],owner.species)&&Math.hypot(to.x-owner.home.x,to.y-owner.home.y)<=owner.radius&&this.separated(to,owner)&&this.route(from,to,RADIUS[owner.species]);}
 private requestArt(species:LivestockSpecies){
  const abort=new AbortController(),job=loadLivestockArt(this.scene,species,abort.signal),request={abort,job};
  this.loading=request;this.retry.set(species,this.elapsed+60000);
  void job.ready.then(ready=>{
   if(this.disposed||this.loading!==request)return;
   this.loading=null;if(ready){this.retry.delete(species);this.nextAdmission=this.elapsed;}else this.sequence++;
  });
 }
 private *roamingSites(player:Vec2):Generator<LivestockSite|undefined>{
  if(protectedSettlementAt(player.x,player.y))return;
  const cx=Math.floor(player.x/ROAMING_CELL),cy=Math.floor(player.y/ROAMING_CELL);
  // Nine stable local cells, not a world scan or a camera-dependent spawn
  // ring. Each probe yields back to the existing per-frame work allowance.
  for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++){
   const hash=((Math.imul(x,73856093)^Math.imul(y,19349663))>>>0);
   const point={x:(x+.28+(hash%41)/100)*ROAMING_CELL,y:(y+.28+((hash>>>8)%41)/100)*ROAMING_CELL};
   if(protectedSettlementAt(point.x,point.y)){yield;continue;}
   const h=this.host.habitat(point),species=roamingLivestockSpecies(h.region,h.biome,h.terrain,hash);
   yield species?{id:'roaming:'+x+':'+y,...point,radius:210,species,population:species[0]==='chicken'?4:3}:undefined;
  }
 }
 private *admit(player:Vec2):Generator<void>{
  if(this.loading||this.animals.filter(a=>a.sprite.active).length>=(this.context?4:OUTDOOR_LIMIT))return;
  const nearby:LivestockSite[]=this.context?[...this.context.sites]:this.sites.query({left:player.x-1350,right:player.x+1350,top:player.y-1350,bottom:player.y+1350})
   .map(v=>v.site);
  if(!this.context)for(const site of this.roamingSites(player)){if(site)nearby.push(site);yield;}
  nearby.sort((a,b)=>(a.x-player.x)**2+(a.y-player.y)**2-(b.x-player.x)**2-(b.y-player.y)**2);
  for(const site of nearby.slice(0,12)){
   const wild=site.id.startsWith('roaming:');
   const population=this.animals.filter(a=>a.sprite.active&&a.site===site.id).length;
   if(population>=(site.population??3))continue;
   const species=site.species?.[this.sequence%site.species.length]??(wild?'goat':ORDER[this.sequence%ORDER.length]);
   if(!this.context&&!wild&&species!=='chicken'&&!site.bounds)continue;
   if(this.elapsed<(this.retry.get(species)??0))continue;
   for(let attempt=0;attempt<(site.fixed?1:9);attempt++){
    const angle=(this.sequence+attempt)*2.4,run=site.fixed?0:Math.min(site.radius,Math.sqrt(attempt)*65),point={x:site.x+Math.cos(angle)*run,y:site.y+Math.sin(angle)*run};
    if(wild&&protectedSettlementAt(point.x,point.y)||Math.hypot(point.x-player.x,point.y-player.y)<(this.context?100:140)||!this.inBounds(point,site.bounds,RADIUS[species],species)||!this.separated(point,undefined,RADIUS[species])||!this.route(point,point,RADIUS[species])){yield;continue;}
    if(!this.scene.textures.exists(livestockTexture(species))){this.requestArt(species);return;}
    const source=this.scene.textures.get(livestockTexture(species)).get(0).source;
    while(!preparePresentationSource(this.scene.game,source))yield;
    // Upload preparation may span frames; recheck the live doorway and actors.
    if(wild&&protectedSettlementAt(point.x,point.y)||!this.inBounds(point,site.bounds,RADIUS[species],species)||!this.route(point,point,RADIUS[species])||Math.hypot(point.x-player.x,point.y-player.y)<(this.context?100:140)||!this.separated(point,undefined,RADIUS[species])){yield;continue;}
    let animal=this.animals.find(a=>!a.sprite.active);
    if(!animal){
     const sprite=this.scene.add.sprite(0,0,livestockTexture(species),0).setVisible(false).setActive(false).setName('wildlife:livestock:'+this.animals.length);
     onPlane(sprite,'upright');this.shadows.register(sprite,false,{projection:0,contactScale:.55,contactHeight:.4});
     animal={sprite,species,home:point,site:site.id,radius:site.radius,goal:null,heading:{x:1,y:0},age:0,nextAt:0,checkAt:0,checkedAt:0,graze:false};this.animals.push(animal);
    }
    if(!applyLivestockArt(this.scene,animal.sprite,species))return;
    Object.assign(animal,{species,home:site,site:site.id,radius:site.radius,bounds:site.bounds,roaming:wild,goal:null,age:0,nextAt:this.elapsed+1500,checkAt:this.elapsed+160,checkedAt:this.elapsed,graze:false});
    animal.heading.x=this.sequence%2?1:-1;animal.heading.y=0;animal.sprite.cameraFilter=0;
    animal.sprite.setPosition(point.x,point.y).setDepth(this.context?.depthAt(point.y)??point.y).setAlpha(0).setVisible(true).setActive(true);
    this.shadows.setEnabled(animal.sprite,!this.context);
    if(this.context)animal.contact=this.shadows.interiorContact(animal.sprite,this.context.depthAt);
    this.sequence++;return;
   }
  }
 }
 private release(animal:Animal){animal.goal=null;animal.contact?.destroy();animal.contact=undefined;animal.sprite.setVisible(false).setActive(false);this.shadows.setEnabled(animal.sprite,false);}
 reset(){this.admission?.return(undefined);this.admission=null;const load=this.loading;this.loading=null;load?.abort.abort();this.retry.clear();for(const animal of this.animals)this.release(animal);this.nextAdmission=this.elapsed+1500;}
 destroy(){if(this.disposed)return;this.disposed=true;this.scene.game.events.off(GAME_DISPOSING,this.destroy,this);this.reset();this.context=null;for(const animal of this.animals)animal.sprite.destroy();this.animals.length=0;}
}
