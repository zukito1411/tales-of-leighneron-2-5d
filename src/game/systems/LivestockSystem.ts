import type Phaser from 'phaser';
import {GAME_DISPOSING} from './gameLifetime';
import {frameWork} from '../presentation25d/FrameWorkBudget';
import {preparePresentationSource} from '../presentation25d/resourcePreparation';
import {LIVESTOCK_SITES,type LivestockSite,type LivestockSpecies} from '../../data/livestockSites';
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
 contact?:Phaser.GameObjects.Image;
}
const WALK_POSES=[0,1,0,2] as const;
const ORDER:readonly LivestockSpecies[]=['chicken','chicken','goat','cow','chicken','goat'];
const RADIUS:Record<LivestockSpecies,number>={chicken:11,goat:23,cow:34,horse:45};
/** One bounded pool for outdoor livestock and the currently open stable.
 * Planning uses fair turns; posing/movement never searches the world. */
export class LivestockSystem {
 private readonly sites=new StaticBoundsIndex(LIVESTOCK_SITES.map(site=>({site,bounds:{left:site.x-400,right:site.x+400,top:site.y-400,bottom:site.y+400}})));
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
  if(!this.admission&&this.elapsed>=this.nextAdmission&&!this.loading&&!night)this.admission=this.admit(player);
  if(night){this.admission?.return(undefined);this.admission=null;}
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
   if(!this.context&&distance>2100&&!wildlifeInView(this.scene,sprite,100,180)){this.release(animal);continue;}
   animal.age+=step;if(night)animal.goal=null;
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
  if(this.admission.next().done){this.admission=null;this.nextAdmission=this.elapsed+1800;}
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
     if(night||this.elapsed<a.nextAt||a.goal&&distance>=105+RADIUS[a.species])continue;
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
    if(a.goal){const dx=a.goal.x-sprite.x,dy=a.goal.y-sprite.y,length=Math.hypot(dx,dy),run=Math.min(12,length);
     if(length>0)point={x:sprite.x+dx/length*run,y:sprite.y+dy/length*run};}
    if(this.clear(sprite,point,a))a.checkedAt=this.elapsed;
    else{a.goal=null;if(!wildlifeInView(this.scene,sprite,100,60))this.release(a);}
    return true;
   }
  }
  return false;
 }
 private separated(point:Vec2,owner?:Animal){
  const radius=owner?RADIUS[owner.species]:34;
  for(const a of this.animals)if(a!==owner&&a.sprite.active&&Math.hypot(a.sprite.x-point.x,a.sprite.y-point.y)<=radius+RADIUS[a.species]+22)return false;
  return true;
 }
 private route(from:Vec2,to:Vec2,radius:number){return this.context?.route(from,to,radius)??Boolean(this.host.livestockRoute?.(from,to,radius));}
 private clear(from:Vec2,to:Vec2,owner:Animal){return Math.hypot(to.x-owner.home.x,to.y-owner.home.y)<=owner.radius&&this.separated(to,owner)&&this.route(from,to,RADIUS[owner.species]);}
 private requestArt(species:LivestockSpecies){
  const abort=new AbortController(),job=loadLivestockArt(this.scene,species,abort.signal),request={abort,job};
  this.loading=request;this.retry.set(species,this.elapsed+60000);
  void job.ready.then(ready=>{
   if(this.disposed||this.loading!==request)return;
   this.loading=null;if(ready){this.retry.delete(species);this.nextAdmission=this.elapsed;}else this.sequence++;
  });
 }
 private *admit(player:Vec2):Generator<void>{
  if(this.loading||this.animals.filter(a=>a.sprite.active).length>=(this.context?4:6))return;
  const nearby:LivestockSite[]=this.context?[...this.context.sites]:this.sites.query({left:player.x-1350,right:player.x+1350,top:player.y-1350,bottom:player.y+1350})
   .map(v=>v.site).sort((a,b)=>(a.x-player.x)**2+(a.y-player.y)**2-(b.x-player.x)**2-(b.y-player.y)**2);
  let wild=false;
  if(!nearby.length&&!this.context){
   const habitat=this.host.habitat(player);if(habitat.biome!=='highland'||habitat.region==='darkav')return;
   wild=true;for(let i=0;i<6;i++){const a=(this.sequence+i)*2.4;nearby.push({id:'wild-goat',x:player.x+Math.cos(a)*480,y:player.y+Math.sin(a)*480,radius:160});}
  }
  for(const site of nearby.slice(0,8)){
   if(this.animals.filter(a=>a.sprite.active&&a.site===site.id).length>=(site.population??3))continue;
   const species=site.species?.[this.sequence%site.species.length]??(wild?'goat':ORDER[this.sequence%ORDER.length]);
   if(this.elapsed<(this.retry.get(species)??0))continue;
   for(let attempt=0;attempt<(site.fixed?1:5);attempt++){
    const angle=(this.sequence+attempt)*2.4,point={x:site.x+Math.cos(angle)*attempt*45,y:site.y+Math.sin(angle)*attempt*45};
    if(Math.hypot(point.x-player.x,point.y-player.y)<(this.context?100:190)||!this.separated(point)||!this.route(point,point,RADIUS[species])){yield;continue;}
    if(!this.scene.textures.exists(livestockTexture(species))){this.requestArt(species);return;}
    const source=this.scene.textures.get(livestockTexture(species)).get(0).source;
    while(!preparePresentationSource(this.scene.game,source))yield;
    // Upload preparation may span frames; recheck the live doorway and actors.
    if(!this.route(point,point,RADIUS[species])||Math.hypot(point.x-player.x,point.y-player.y)<(this.context?100:190)||!this.separated(point)){yield;continue;}
    let animal=this.animals.find(a=>!a.sprite.active);
    if(!animal){
     const sprite=this.scene.add.sprite(0,0,livestockTexture(species),0).setVisible(false).setActive(false).setName('wildlife:livestock:'+this.animals.length);
     onPlane(sprite,'upright');this.shadows.register(sprite,false,{projection:0,contactScale:.55,contactHeight:.4});
     animal={sprite,species,home:point,site:site.id,radius:site.radius,goal:null,heading:{x:1,y:0},age:0,nextAt:0,checkAt:0,checkedAt:0,graze:false};this.animals.push(animal);
    }
    if(!applyLivestockArt(this.scene,animal.sprite,species))return;
    Object.assign(animal,{species,home:point,site:site.id,radius:site.radius,goal:null,age:0,nextAt:this.elapsed+1500,checkAt:this.elapsed+160,checkedAt:this.elapsed,graze:false});
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
