import {NPCS} from '../../data/npcs';
import {QUESTS} from '../../data/quests';
import {CINEMATICS} from '../../data/cinematics';
import {INTERIOR_ENTRIES,NPC_INTERIOR_BY_ID,type InteriorEntry,type InteriorResident} from '../../data/interiors';
import {TOWN_BY_ID} from '../../data/towns';
import {isPlayerHome} from '../../data/playerHomes';
import {npcSchedulePosition,npcWorldPosition} from '../../data/npcPositions';
import {worldPointInView} from '../presentation25d/plane';
import type {FrameWorkBudget} from '../presentation25d/FrameWorkBudget';
import type {NpcDefinition,Vec2} from '../types';
import type {Npc} from '../entities/Npc';
import type {WorldScene} from '../scenes/WorldScene';

interface Routine {npc:NpcDefinition;seed:number;home?:InteriorEntry;inn?:InteriorEntry;work?:InteriorEntry;guard:boolean}
interface Visit {entry:InteriorEntry;period:string}
interface TownLife {people:Routine[];ready:boolean;steps:Generator<void>;phase:number;projection:Generator<void>|null}
const hash=(id:string)=>{let value=0;for(const c of id)value=(value*31+c.charCodeAt(0))>>>0;return value;};
// Quest contacts, permanent workplaces, escorts and cinematic identities keep
// their established availability. This set is built once, never per frame.
const protectedIds=new Set([...QUESTS.flatMap(q=>[q.giverNpcId,...q.objectives.map(o=>o.targetId)]),
 ...Object.values(CINEMATICS).flatMap(c=>c.shots.flatMap(s=>s.focusNpcId?[s.focusNpcId]:[]))]);

/** Disposable actors share the existing content ledger. Only finite routine
 * plans/door visits live here; no second simulation or saved NPC identities. */
export class SettlementLifeSystem {
 private readonly towns=new Map<string,TownLife>();
 private readonly routines=new Map<string,Routine>();
 private readonly visits=new Map<string,Visit>();
 private readonly checks=new WeakMap<Npc,number>();
 constructor(private readonly scene:WorldScene){}
 private town(id:string){
  let value=this.towns.get(id);
  if(!value){value={people:[],ready:false,steps:this.build(id),phase:-1,projection:null};this.towns.set(id,value);}
  return value;
 }
 private *build(townId:string):Generator<void>{
  const town=this.towns.get(townId)!,entries=INTERIOR_ENTRIES.filter(e=>e.townId===townId&&!isPlayerHome(e.id));
  const counts=new Map<string,number>();
  const choose=(npc:NpcDefinition,profiles:InteriorEntry['profile'][],capacity:number,seed:number)=>{
   const p=npcWorldPosition(npc),near:Array<{entry:InteriorEntry;distance:number}>=[];
   for(const entry of entries){
    if(!profiles.includes(entry.profile)||(counts.get(entry.id)??0)>=capacity)continue;
    const distance=(entry.door.x-p.x)**2+(entry.door.y-p.y)**2;
    let at=near.findIndex(v=>distance<v.distance);if(at<0)at=near.length;
    if(at<3){near.splice(at,0,{entry,distance});if(near.length>3)near.pop();}
   }
   // Vary neighboring households, never choose a distant tavern simply
   // because its hash slot differs from the nearest district's establishment.
   const neighboring=near.filter(p=>p.distance<=(near[0]?.distance??0)+600**2);
   const entry=neighboring[seed%neighboring.length]?.entry;
   if(entry)counts.set(entry.id,(counts.get(entry.id)??0)+1);
   return entry;
  };
  for(const npc of NPCS){
   if(npc.townId!==townId)continue;
   // Sentries and marching files never abandon their assigned gates/routes.
   if(protectedIds.has(npc.id)||npc.questIds.length||NPC_INTERIOR_BY_ID[npc.id]
    ||npc.campId||npc.storyReturn||npc.formation||npc.id==='alice'||npc.id.startsWith('road-life:'))continue;
   const seed=hash(npc.id),role=npc.title+' '+npc.role;
   const guard=/guard|watch|sentry|sentinel|warder|captain|soldier|militia|templar/i.test(role);
   if(guard&&(npc.stationary||seed%3!==0))continue;
   const home=choose(npc,guard?['barracks']:['home','villa'],guard?5:4,seed);
   const inn=guard?undefined:choose(npc,['inn'],8,seed);
   const workProfiles:InteriorEntry['profile'][]=/smith|forge|armorer/i.test(role)?['workshop','armory']
    :/stable|groom|horse|tack/i.test(role)?['stable']
    :/scribe|archiv|scholar|noble|council/i.test(role)?['archive','civic']
    :/guild|craft|weav|tool|cloth/i.test(role)?['guild','workshop']
    :/porter|cargo|grain|store|warehouse/i.test(role)?['store']:[];
   const work=guard?undefined:choose(npc,workProfiles,4,seed);
   const routine={npc,seed,home,inn,work,guard};town.people.push(routine);this.routines.set(npc.id,routine);
   yield;
  }
  town.ready=true;
 }
 *prepareTown(id:string):Generator<void>{
  const town=this.town(id);while(!town.ready){town.steps.next();yield;}
 }
 advance(work:FrameWorkBudget){
  const allowance=work.remaining('actors',.25);if(allowance<=0)return;
  const start=performance.now(),deadline=start+allowance;
  for(const town of this.towns.values()){
   if(!town.ready){for(let n=0;n<4&&performance.now()<deadline;n++){if(town.steps.next().done)break;}}
   else {
    const phase=Math.floor(this.scene.getWorldHour()*6);
    if(town.phase!==phase){town.phase=phase;town.projection?.return(undefined);town.projection=this.projectTown(town);}
    for(let n=0;n<4&&town.projection&&performance.now()<deadline;n++)if(town.projection.next().done)town.projection=null;
   }
   if(performance.now()>=deadline)break;
  }
  work.charge('actors',start);
 }
 private *projectTown(town:TownLife):Generator<void>{
  for(const r of town.people){
   if(!this.scene.routineNpcActor(r.npc.id)){
    const visit=this.desired(r.npc);if(visit)this.visits.set(r.npc.id,visit);
    const door=this.visits.get(r.npc.id)?.entry.door;
    if(door)this.scene.relocateUnloadedRoutineNpc(r.npc.id,door);
   }
   yield;
  }
 }
 private desired(npc:NpcDefinition):Visit|undefined {
  const town=this.town(npc.townId);if(!town.ready)return;
  const r=this.routines.get(npc.id);if(!r)return;
  const hour=this.scene.getWorldHour(),offset=(r.seed%24)/60;
  let entry:InteriorEntry|undefined,activity='';
  if(r.guard){
   // Only an assigned relief fraction rests; the other watches remain outdoors.
   if(Math.floor(hour/3)%3===Math.floor(r.seed/3)%3){entry=r.home;activity='guard-rest';}
  }else if(hour<6+offset||hour>=22+(r.seed%90)/60){entry=r.home??r.inn;activity='home';}
  else if(hour>=18+offset){entry=r.inn??r.home;activity='supper';}
  else if(hour>=8+offset&&hour<17){entry=r.work;activity='work';}
  return entry?{entry,period:entry.id+':'+activity}:undefined;
 }
 /** Active pedestrians finish the journey; unloaded residents are projected
  * directly into the current room without spawning a world-sized crowd. */
 roomFor(npc:NpcDefinition):InteriorEntry|undefined {
  const desired=this.desired(npc);if(!desired)return;
  const actor=this.scene.routineNpcActor(npc.id);
  if(!actor||this.scene.inInterior){
   if(!actor){this.visits.set(npc.id,desired);this.scene.relocateUnloadedRoutineNpc(npc.id,desired.entry.door);}
   return desired.entry;
  }
  return this.visits.get(npc.id)?.period===desired.period?desired.entry:undefined;
 }
 claimInterior(npcId:string,entry:InteriorEntry){
  const r=this.routines.get(npcId),visit=r&&this.desired(r.npc);if(!visit||visit.entry.id!==entry.id)return;
  this.visits.set(npcId,visit);const actor=this.scene.routineNpcActor(npcId);if(actor)this.scene.enterRoutineRoom(actor,entry.door);
 }
 spawnPosition(npc:NpcDefinition):Vec2|undefined {return this.visits.get(npc.id)?.entry.door;}
 updateNpc(npc:Npc,time:number){
  if(time<(this.checks.get(npc)??0))return;
  this.checks.set(npc,time+300+(hash(npc.definition.id)%200));
  if(npc.escorting||npc.adventureCompanion)return;
  const visit=this.desired(npc.definition);
  if(!visit){
   const r=this.routines.get(npc.definition.id);
   if(!r||!npc.canStoryWalk){npc.setSettlementVisit(null);return;}
   // Returning workers rejoin their authored district courts instead of
   // lingering at the doorway where streaming restored them.
   const hour=this.scene.getWorldHour(),periods=npc.definition.schedule;
   let index=periods.length-1;for(let i=periods.length-1;i>=0;i--)if(periods[i].startHour<=hour){index=i;break;}
   const local=npcSchedulePosition(npc.definition,index),town=TOWN_BY_ID[npc.definition.townId].world;
   const goal=this.scene.safeExteriorNpcDestination({x:local.x+town.x,y:local.y+town.y},npc);
   if(goal)npc.setSettlementVisit({point:goal,key:'street:'+index});
   return;
  }
  const entry=visit.entry;
  if(npc.canStoryWalk){
   const goal=this.scene.safeExteriorNpcDestination(entry.door,npc);
   if(!goal||Math.hypot(goal.x-entry.door.x,goal.y-entry.door.y)>180)return;
   npc.setSettlementVisit({point:goal,key:visit.period});
   // Use the certified forecourt approach, never the building's solid facade.
   if(Math.hypot(npc.x-goal.x,npc.y-goal.y)>24)return;
   // The player can hold a doorway open; do not disappear during interaction.
   if(Math.hypot(npc.x-this.scene.player.x,npc.y-this.scene.player.y)<96)return;
  }else if(worldPointInView(this.scene,npc.x,npc.y,100,160))return;
  this.visits.set(npc.definition.id,visit);
  this.scene.enterRoutineRoom(npc,entry.door);
 }
 residents(entry:InteriorEntry):InteriorResident[]{
  const town=this.town(entry.townId);if(!town.ready)return [];
  return town.people.filter(r=>this.roomFor(r.npc)?.id===entry.id).map((r,slot)=>({npcId:r.npc.id,entry,slot}));
 }
 clear(){for(const town of this.towns.values()){town.steps.return(undefined);town.projection?.return(undefined);}this.towns.clear();this.routines.clear();this.visits.clear();}
}
