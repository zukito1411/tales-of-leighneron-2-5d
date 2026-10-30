import {artFrameSize} from './art';
import {TOWN_BY_ID} from './towns';
import {SETTLEMENT_BY_ID} from './settlements';
import {CAPITAL_BUILDING_SITES,CAPITAL_SHRINE_COURT} from './highmereComposition';
import {insideHighmere,royalWardOverlaps} from './highmerePlan';
import {NPCS} from './npcs';
import {npcExteriorAnchors,npcStandingReservation} from './npcPositions';
import {INTERIOR_ASSIGNMENTS} from './interiorAssignments';
import {propPlacementBounds,spriteBounds,overlaps,rectTouchesStreet,type Rect} from './settlementGeometry';
import {StaticBoundsIndex} from '../game/systems/StaticBoundsIndex';
import {worldSpriteProfile} from './worldSpriteGeometry';
import {CAPITAL_SHOPFRONTS,type CapitalPropStyle} from './highmereStreetStyle';
import type {ContentDefinition,PropContentDefinition,Vec2,WorldPropTexture} from '../game/types';

export interface CapitalDressingSummary {added:number;byKind:Record<string,number>;omitted:number}
export const CAPITAL_DRESSING:CapitalDressingSummary={added:0,byKind:{},omitted:0};
const pad=(r:Rect,n:number):Rect=>({left:r.left-n,right:r.right+n,top:r.top-n,bottom:r.bottom+n});
/** Add only in remaining space AFTER every approved placement pass. This
 * function never edits, reorders or removes an existing content definition. */
export function addHighmereStreetLife(content:ContentDefinition[],walkable:(x:number,y:number)=>boolean){
 if(content.some(d=>d.id.startsWith('detail:highmere:streetlife:')))return;
 CAPITAL_DRESSING.added=0;CAPITAL_DRESSING.byKind={};CAPITAL_DRESSING.omitted=0;
 const town=TOWN_BY_ID.highmere,layout=SETTLEMENT_BY_ID.highmere,origin=town.world;
 const world=(p:Vec2)=>({x:origin.x+p.x,y:origin.y+p.y});
 const local=(r:Rect):Rect=>({left:r.left-origin.x,right:r.right-origin.x,top:r.top-origin.y,bottom:r.bottom-origin.y});
 const blockers:{bounds:Rect}[]=[],people:{bounds:Rect}[]=[];
 const indoor=new Set(INTERIOR_ASSIGNMENTS.map(([id])=>id));
 for(const d of content){
  if(Math.abs(d.world.x-origin.x)>8500||Math.abs(d.world.y-origin.y)>8500)continue;
  if(d.kind==='npc'){if(!indoor.has(d.npcId))people.push({bounds:npcStandingReservation(d.world)});continue;}
  if(!('frame' in d)||worldSpriteProfile(d.texture??'world_objects',d.frame)?.floor)continue;
  blockers.push({bounds:propPlacementBounds(d.texture??'world_objects',d.frame,d.scale??1,d.world.x,d.world.y,d.anchor==='center',
    'wallSegment' in d?d.wallSegment:undefined,d.rotation??0)});
 }
 for(const npc of NPCS)if(npc.townId==='highmere'&&!indoor.has(npc.id))
  for(const p of npcExteriorAnchors(npc))people.push({bounds:npcStandingReservation(p,origin.x,origin.y)});
 const index=new StaticBoundsIndex(blockers),residents=new StaticBoundsIndex(people);
 const doors=Object.entries(CAPITAL_BUILDING_SITES).map(([,s])=>({left:s.x-90,right:s.x+90,top:s.y-8,bottom:s.frontY+48}));
 const protectedBeds=layout.parcels.filter(p=>p.terrain==='farmland'||p.terrain==='water').map(p=>({left:p.x-p.width/2,right:p.x+p.width/2,top:p.y-p.height/2,bottom:p.y+p.height/2}));
 const envelope=(d:PropContentDefinition):Rect=>{
  const r=propPlacementBounds(d.texture!,d.frame,d.scale,d.world.x,d.world.y,false,undefined,d.rotation??0);
  // propPlacementBounds reserves the full source and modeled ground depth.
  // Upright furniture height is not extra ground behind its feet.
  return r;
 };
 const fits=(d:PropContentDefinition)=>{
  const r=envelope(d),l=local(r),p={x:d.world.x-origin.x,y:d.world.y-origin.y};
  if(!insideHighmere(p.x,p.y,-200)||royalWardOverlaps(l,90)||overlaps(l,CAPITAL_SHRINE_COURT,40)
    ||protectedBeds.some(b=>overlaps(l,b,24))||doors.some(b=>overlaps(l,b,18)))return false;
  if(layout.streets.some(s=>rectTouchesStreet(l,s,24)))return false;
  if(index.any(pad(r,18),o=>overlaps(r,o.bounds,18))||residents.any(pad(r,38),o=>overlaps(r,o.bounds,38)))return false;
  for(const x of [r.left,r.right])for(const y of [r.top,r.bottom])if(!walkable(x,y))return false;
  return true;
 };
 const add=(id:string,kind:string,p:Vec2,texture:WorldPropTexture,frame:number,width:number,rotation=0)=>{
  if(CAPITAL_DRESSING.added>=180)return false;
  const scale=width/artFrameSize(texture,frame).width;
  const d:PropContentDefinition={id:'detail:highmere:streetlife:'+kind+':'+id,kind:'prop',world:world(p),texture,frame,scale,
    solid:kind!=='flowers',placement:'fixed',...(rotation?{rotation}:{})};
  if(!fits(d)){CAPITAL_DRESSING.omitted++;return false;}
  const r=envelope(d);index.add({bounds:r});content.push(d);
  CAPITAL_DRESSING.added++;CAPITAL_DRESSING.byKind[kind]=(CAPITAL_DRESSING.byKind[kind]??0)+1;return true;
 };
 // Shop-associated street furnishings: deliberately in front courts, to one
 // side of each existing entrance, with a broad, unobstructed central approach.
 for(const [id,style] of Object.entries(CAPITAL_SHOPFRONTS)){
  const slot=Number(id.split(':').at(-1)),site=CAPITAL_BUILDING_SITES[slot];if(!site)continue;
  const side=slot%2?-1:1,cx=site.x+side*230,cy=site.frontY-105;
  if(style==='cafe'||style==='bakery'){
   for(const [i,x] of [cx,cx-side*480].entries()){
    if(!add('shop:'+slot+':'+i,'cafe-table',{x,y:cy},'native_civic_bare',9,74))continue;
    add('shop:'+slot+':'+i+':w','cafe-chair',{x:x-110,y:cy+4},'native_civic_bare',7,36,Math.PI/2);
    add('shop:'+slot+':'+i+':e','cafe-chair',{x:x+110,y:cy+4},'native_civic_bare',7,36,-Math.PI/2);
   }
  }else if(style==='clothier')add('shop:'+slot,'cloth-counter',{x:cx,y:cy},'native_civic_bare',9,95);
  else if(style==='armorer')add('shop:'+slot,'arms-rack',{x:cx,y:cy},'native_civic_bare',9,82);
  else add('shop:'+slot,'barrels',{x:cx,y:cy},'native_civic_bare',8,78);
  for(const side of [-1,1])add('shop:'+slot+':'+side,'flower-pot',{x:site.x+side*320,y:site.y+100},'woodland_props',1,58);
 }
 // An open-air tea terrace beside the western civic approach, away from
 // the central quest board and processional crossing.
 for(const [i,p] of [{x:-960,y:550},{x:-710,y:550}].entries()){
  if(add('plaza:'+i,'cafe-table',p,'native_civic_bare',9,74)){
   add('plaza:'+i+':w','cafe-chair',{x:p.x-105,y:p.y+4},'native_civic_bare',7,36,Math.PI/2);
   add('plaza:'+i+':e','cafe-chair',{x:p.x+105,y:p.y+4},'native_civic_bare',7,36,-Math.PI/2);
  }
 }
 add('market:cloth-display','cloth-counter',{x:-3200,y:800},'native_civic_bare',9,90);
 add('market:arms-display','arms-rack',{x:-2420,y:800},'native_civic_bare',9,70);
 // A second layer of properly stocked stalls, with alternating cloth canopies
 // and different goods. The current six stalls keep their exact placement.
 const stocks:CapitalPropStyle[]=['produce-stall','bread-stall','cloth-stall','herb-stall','book-stall','tools-stall'];
 for(const [row,y] of [300,810,1480].entries())for(let i=0;i<6;i++){
  const x=-4700+i*580,kind=stocks[(i+row*3)%stocks.length];
  add('market:'+row+':'+i,kind,{x,y},'native_civic_bare',5,180);
  add('market:'+row+':'+i,'barrels',{x:x+220,y:y+40},'native_civic_bare',8,62);
 }
 // Street-edge vignettes. No furniture is placed in road centres or on the
 // guards' march circuit. Rejected candidates are omitted, never scattered.
 for(const [row,y] of [1100,1800,2600,3200,3800,4400].entries()){
  const xs=row<2?[-4800,-4100,-3300,-2500,-1700,1700,2500,3300,4100,4800]:[-4050,-3350,-2650,-1950,1950,2650,3350,4050];
  for(const [i,x] of xs.entries()){
   const p={x,y:y+150};
   if(i%3===0){add('lane:'+row+':'+i,'bench',p,'native_civic_bare',7,110);
    add('lane:'+row+':'+i,'flower-pot',{x:x+155,y:y+150},'woodland_props',1,60);}
   else if(i%3===1)add('lane:'+row+':'+i,'flower-pot',p,'woodland_props',1,65);
   else add('lane:'+row+':'+i,'barrels',p,'native_civic_bare',8,62);
  }
 }
 // Upper civic terraces stay more formal than the working lower streets.
 for(const side of [-1,1])for(const [i,y] of [-2850,-1950,-850].entries())for(const x of [2450,3950,4650]){
  add('terrace:'+side+':'+i+':'+x,'flower-pot',{x:side*x,y:y+125},'woodland_props',1,72);
  if(x===3950)add('terrace:'+side+':'+i,'bench',{x:side*(x+170),y:y+125},'native_civic_bare',7,112);
 }
 // Small flower/herb borders soften long bare road verges without large new
 // trees, additional lamps, emitters, particles or full-screen effects.
 for(const side of [-1,1])for(let i=0;i<24;i++){
  const y=500+i*210;
  add('avenue:'+side+':'+i,'flowers',{x:side*330,y},'woodland_props',i%2?1:2,55);
 }
}
