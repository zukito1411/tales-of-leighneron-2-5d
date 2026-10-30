import slots from './npcPositions.json';
import {HIGHMERE_SENTRY_ANCHORS,HIGHMERE_MARCH_STATIONS} from './highmerePlan';
import type {NpcDefinition,Vec2} from '../game/types';
import {TOWN_BY_ID} from './towns';

/** Audited feet positions, in the NPC's existing work/home neighborhood.
 * Separate from identity data so relocating a resident cannot move scenery. */
export const NPC_POSITIONS=slots as Record<string,{position:Vec2;home:Vec2;schedule:Vec2[];arrival?:Vec2}>;
for(const [id,p] of Object.entries(HIGHMERE_SENTRY_ANCHORS)){
 const old=NPC_POSITIONS[id];if(old)NPC_POSITIONS[id]={...old,position:{...p},home:{...p},schedule:old.schedule.map(()=>({...p}))};
}
for(const [id,p] of Object.entries(HIGHMERE_MARCH_STATIONS)){
 const old=NPC_POSITIONS[id];if(old)NPC_POSITIONS[id]={...old,position:{...p.position},home:{...p.home},
  schedule:old.schedule.map((_,i)=>({... (i===0?p.position:p.home)}))};
}
export function npcEscortArrival(){
 const p=NPC_POSITIONS['tovin-reed'].arrival!,town=TOWN_BY_ID.highmere;
 return {x:town.world.x+p.x,y:town.world.y+p.y};
}
export function npcWorldPosition(npc:NpcDefinition,kind:'position'|'home'='position'){
 const p=NPC_POSITIONS[npc.id]?.[kind]??(kind==='home'?npc.homeLocation:undefined)??npc.worldOffset,town=TOWN_BY_ID[npc.townId];
 return {x:town.world.x+p.x,y:town.world.y+p.y};
}
export function npcSchedulePosition(npc:NpcDefinition,index:number){
 return NPC_POSITIONS[npc.id]?.schedule[index]??npc.schedule[index]?.location??npc.worldOffset;
}

export function npcExteriorAnchors(npc:NpcDefinition):Vec2[]{
 const slots=NPC_POSITIONS[npc.id];
 const points=[slots?.position??npc.worldOffset,slots?.home??npc.homeLocation??npc.worldOffset,
   ...(slots?.schedule??npc.schedule.map((_,i)=>npcSchedulePosition(npc,i))),slots?.arrival,npc.storyReturn?.position];
 const seen=new Set<string>(),result:Vec2[]=[];
 for(const p of points){if(!p)continue;const key=p.x+':'+p.y;if(!seen.has(key)){seen.add(key);result.push(p);}}
 return result;
}
export function npcStandingReservation(point:Vec2,x=0,y=0){return {
 left:x+point.x-36,right:x+point.x+36,top:y+point.y-100,bottom:y+point.y+16,
};}
