import {NPCS} from '../../data/npcs';
import {WORLD_CONTENT} from '../../data/content';
import {TOWN_BY_ID} from '../../data/towns';
import {SETTLEMENT_BY_ID,worldRectTouchesStreet,segmentDistance} from '../../data/settlements';
import {MARCH_ROUTE} from '../../data/capitalResidents';
import {spriteBounds,overlaps,propFoundation,type Rect} from '../../data/settlementGeometry';
import {fortificationBlocksPoint} from '../../data/fortifications';
import {worldSpriteProfile} from '../../data/worldSpriteGeometry';
import {StaticBoundsIndex} from './StaticBoundsIndex';
import {WorldGenerator} from './WorldGenerator';
import type {NpcDefinition,Vec2} from '../types';

export function npcMayPatrol(npc:NpcDefinition){
 return !npc.stationary&&(npc.spriteTexture==='npc_royal_guard'||npc.spriteTexture==='npc_elven_guard_idle'
  ||npc.spriteTexture==='npc_guard'&&TOWN_BY_ID[npc.townId].regionId==='trandum');
}
export const npcPersonalSpace=(a:Vec2,b:Vec2)=>Math.abs(a.x-b.x)>=80||Math.abs(a.y-b.y)>=112;
const standingStreetQuery={left:0,right:0,top:0,bottom:0};
export function npcStandingOffRoad(npc:NpcDefinition|undefined,p:Vec2){
 const q=standingStreetQuery;q.left=q.right=p.x;q.top=q.bottom=p.y;
 if(worldRectTouchesStreet(q,30))return false;
 const town=TOWN_BY_ID.highmere,dx=p.x-town.world.x,dy=p.y-town.world.y;
 if(npc?.townId==='highmere'||Math.abs(dx)<3000&&Math.abs(dy)<1500)
   for(let i=1;i<MARCH_ROUTE.length;i++)if(segmentDistance(dx,dy,MARCH_ROUTE[i-1],MARCH_ROUTE[i])<76)return false;
 return true;
}
export interface NpcPlacement {position:Vec2;home:Vec2;schedule:Vec2[]}

/** Used by the placement audit to author fixed, reviewable neighborhood slots.
 * Does not depend on which chunks happen to be loaded or on NPC spawn order. */
export function createNpcPlacementSurvey(){
 const terrain=new WorldGenerator();
 const props=WORLD_CONTENT.flatMap(d=>{
  if(!('frame' in d)||!('scale' in d)||d.scale===undefined||!d.texture)return [];
  const profile=worldSpriteProfile(d.texture,d.frame);
  if(profile?.floor||!(('solid' in d&&d.solid)||profile?.forceSolid))return [];
  const bounds=spriteBounds(d.texture,d.frame,d.scale,d.world.x,d.world.y,d.anchor==='center');
  const fallback='footprint' in d&&d.footprint?d.footprint:propFoundation(d.texture,d.frame,d.scale);
  // Conservative ground bounds from the same authored contours as physics.
  const solids=profile?.solids.map(p=>({left:bounds.left+Math.min(...p.map(v=>v[0]))*(bounds.right-bounds.left),
   right:bounds.left+Math.max(...p.map(v=>v[0]))*(bounds.right-bounds.left),
   top:bounds.top+Math.min(...p.map(v=>v[1]))*(bounds.bottom-bounds.top),
   bottom:bounds.top+Math.max(...p.map(v=>v[1]))*(bounds.bottom-bounds.top)}))
   ??[{left:d.world.x-fallback.width/2,right:d.world.x+fallback.width/2,top:bounds.bottom-fallback.height,bottom:bounds.bottom}];
  return [{id:d.id,y:d.world.y,bounds,solids}];
 });
 const index=new StaticBoundsIndex(props);
 const clear=(p:Vec2)=>{
  if(!terrain.isWalkable(p.x,p.y)||fortificationBlocksPoint(p.x,p.y,26))return false;
  const person={left:p.x-30,right:p.x+30,top:p.y-98,bottom:p.y+6};
  const feet={left:p.x-24,right:p.x+24,top:p.y-28,bottom:p.y+8};
  return !index.query(person).some(o=>o.solids.some(s=>overlaps(feet,s))||o.y>p.y&&overlaps(person,o.bounds));
 };
 const offRoad=npcStandingOffRoad;
 const reserved:Array<{id:string;point:Vec2}>=[];
 const choose=(npc:NpcDefinition,local:Vec2)=>{
  const town=TOWN_BY_ID[npc.townId],preferred={x:town.world.x+local.x,y:town.world.y+local.y};
  const available=(p:Vec2)=>clear(p)&&offRoad(npc,p)&&reserved.every(r=>r.id===npc.id||npcPersonalSpace(p,r.point));
  for(let radius=0;radius<=960;radius+=32){
   const count=radius===0?1:Math.max(16,Math.ceil(2*Math.PI*radius/32));
   for(let i=0;i<count;i++){
    // Start towards the forecourt, rather than towards the roof behind a shop.
    const angle=Math.PI/2+i*2*Math.PI/count,p={x:Math.round(preferred.x+Math.cos(angle)*radius),y:Math.round(preferred.y+Math.sin(angle)*radius)};
    if(available(p)){reserved.push({id:npc.id,point:p});return p;}
   }
  }
  throw new Error('No clear neighborhood slot for '+npc.id+' at '+JSON.stringify(local));
 };
 const placements:Record<string,NpcPlacement>={};
 // Quest givers and fixed sentries keep first choice of their working courts.
 const ordered=[...NPCS].sort((a,b)=>Number(Boolean(b.questIds.length||b.stationary))-Number(Boolean(a.questIds.length||a.stationary))||a.id.localeCompare(b.id));
 for(const npc of ordered){
  const town=TOWN_BY_ID[npc.townId],world=(p:Vec2)=>({x:town.world.x+p.x,y:town.world.y+p.y});
  placements[npc.id]={position:npc.formation?world(npc.worldOffset):choose(npc,npc.worldOffset),home:{x:0,y:0},schedule:[]};
 }
 for(const npc of ordered){
  const entry=placements[npc.id];entry.home=entry.position;
  if(npcMayPatrol(npc)){
   entry.home=choose(npc,npc.homeLocation??npc.worldOffset);
   entry.schedule=npc.schedule.map(period=>choose(npc,npc.formation&&period.startHour>=20?npc.homeLocation??npc.worldOffset:period.location??npc.worldOffset));
  }else entry.schedule=npc.schedule.map(()=>entry.position);
 }
 return {placements,clear,offRoad,choose};
}
