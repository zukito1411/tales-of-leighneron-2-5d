import {NPCS,registerHighmereStreetNpc} from './npcs';
import {npcExteriorAnchors,npcStandingReservation} from './npcPositions';
import {INTERIOR_ASSIGNMENTS} from './interiorAssignments';
import {TOWN_BY_ID} from './towns';
import {SETTLEMENT_BY_ID} from './settlements';
import {CAPITAL_SHRINE_COURT,CAPITAL_BUILDING_SITES} from './highmereComposition';
import {insideHighmere,royalWardOverlaps} from './highmerePlan';
import {capitalPropStyle} from './highmereStreetStyle';
import {artFrameSize} from './art';
import {propPlacementBounds,overlaps,rectTouchesStreet,type Rect} from './settlementGeometry';
import {ExteriorPlacement} from '../game/systems/ExteriorPlacement';
import {StaticBoundsIndex} from '../game/systems/StaticBoundsIndex';
import {worldSpriteProfile} from './worldSpriteGeometry';
import type {ContentDefinition,NpcDefinition,Vec2,WorldPropTexture} from '../game/types';

export const HIGHMERE_MARKET_LIFE={sellers:0,neighbors:0,details:0,unattended:[] as string[]};
const names=['Martha Cresswell','Benedict Woolmer','Lucy Hartwick','Philip Reedcroft','Agatha Fenwell','Rafe Turner','Edith Bookwell','Willa Barley'];
const trades={
 'produce-stall':{title:'Greengrocer',line:'Picked this morning. The small apples are the sweet ones.',texture:'npc_villager'},
 'cloth-stall':{title:'Cloth Seller',line:'Mind the blue cloth. The dye is still drying.',texture:'npc_attendant'},
 'herb-stall':{title:'Herbalist',line:'Mint on the left, feverfew on the right. Please keep them apart.',texture:'npc_attendant'},
 'tools-stall':{title:'Tool Seller',line:'Try the balance before you buy. That little hammer is heavier than it looks.',texture:'npc_blacksmith'},
 'bread-stall':{title:'Market Baker',line:'The crust is still warm. I brought another basket down from the ovens.',texture:'npc_villager'},
 'book-stall':{title:'Bookseller',line:'Maps in the shallow tray. Keep the bindings out of the rain.',texture:'npc_adventurer'},
} as const;
/** Work with the final admitted content. Never create a seller for a rejected
 * stall, move an existing actor, or reuse somebody else's quest identity. */
export function addHighmereMarketLife(content:ContentDefinition[],walkable:(x:number,y:number)=>boolean){
 if(content.some(d=>d.id.startsWith('npc:capital:highmere:street:')))return;
 const town=TOWN_BY_ID.highmere,layout=SETTLEMENT_BY_ID.highmere,origin=town.world;
 const indoor=new Set(INTERIOR_ASSIGNMENTS.map(([id])=>id));
 const people=NPCS.filter(n=>n.townId==='highmere'&&!indoor.has(n.id)).flatMap(n=>npcExteriorAnchors(n).map(p=>({bounds:npcStandingReservation(p,origin.x,origin.y)})));
 const residents=new StaticBoundsIndex(people),placement=new ExteriorPlacement(content);
 const local=(p:Vec2)=>({x:p.x-origin.x,y:p.y-origin.y});
 const body=(p:Vec2):Rect=>({left:p.x-30,right:p.x+30,top:p.y-30,bottom:p.y+10});
 const streetClear=(p:Vec2)=>!layout.streets.some(s=>rectTouchesStreet(body(local(p)),s,12));
 const clear=(p:Vec2)=>walkable(p.x,p.y)&&streetClear(p)&&!placement.blocksNpc(p,undefined,true)
  &&!residents.any(npcStandingReservation(p),o=>overlaps(npcStandingReservation(p),o.bounds,10));
 const addPerson=(id:string,name:string,title:string,preferred:Vec2,texture:NpcDefinition['spriteTexture'],line:string,moving=false,workplaceId?:string)=>{
  const candidates=[preferred,...[40,72,112,152,192].flatMap(r=>[0,Math.PI/4,-Math.PI/4,Math.PI/2,-Math.PI/2].map(a=>({x:preferred.x+Math.sin(a)*r,y:preferred.y+Math.cos(a)*r})))];
  const p=candidates.find(clear);if(!p)return false;
  const point=local(p),npc: NpcDefinition={id:'capital:highmere:street:'+id,name,title,townId:'highmere',
   ancestry:'human',visualRegion:'trandum',settlementResident:true,spriteTexture:texture,spriteFrame:0,
   worldOffset:point,homeLocation:point,workplaceId,stationary:!moving,townRoutine:moving,patrolRadius:moving?30:0,
   showOverheadLabels:!moving,role:title,districtId:'Market and Guild Borough',
   relationshipToLeigneron:{kind:'acquaintance',trust:42,summary:'A familiar face in Highmere’s working streets.'},
   schedule:[{startHour:0,activity:moving?'Visits the neighborhood':'Tends the counter',location:point}],
   dialogue:[line],questIds:[]};
  registerHighmereStreetNpc(npc);content.push({id:'npc:'+npc.id,kind:'npc',npcId:npc.id,world:p});
  residents.add({bounds:npcStandingReservation(p)});return true;
 };
 const stalls=content.filter(d=>d.kind==='prop'&&d.id.startsWith('detail:highmere:')&&capitalPropStyle(d.id)?.endsWith('-stall'));
 HIGHMERE_MARKET_LIFE.sellers=0;HIGHMERE_MARKET_LIFE.neighbors=0;HIGHMERE_MARKET_LIFE.details=0;HIGHMERE_MARKET_LIFE.unattended=[];
 for(const [i,stall] of stalls.entries()){
  const style=capitalPropStyle(stall.id),trade=style&&style in trades?trades[style as keyof typeof trades]:undefined;
  if(!trade)continue;
  // Attend the open end of the counter. This is real unobstructed standing
  // space, not an exemption from the stall's solid frame/counter or roof.
  const p={x:stall.world.x+(i%2?-1:1)*112,y:stall.world.y+52};
  if(addPerson('seller:'+stall.id,names[i%names.length],trade.title,p,trade.texture,trade.line,false,stall.id))HIGHMERE_MARKET_LIFE.sellers++;
  else HIGHMERE_MARKET_LIFE.unattended.push(stall.id);
 }
 for(const [i,[x,y,name,title,texture,line]] of ([
  [-1100,550,'Anne Millcroft','Tea House Runner','npc_attendant','One moment. These cups are going cold.'],
  [-650,740,'Osric Brook','Market Porter','npc_villager','Leave that gap clear. I have another load coming through.'],
  [-3600,1250,'Cecily Finch','Market Shopper','npc_attendant','I came for flour. Somehow I have bought ribbon as well.'],
  [-2500,1350,'Edwin Hale','Guild Messenger','npc_adventurer','Three deliveries left, then I can sit down.'],
  [2550,1900,'Tom Ashwell','Forge Apprentice','npc_blacksmith','Master says I can make nails until they all come out the same length.'],
  [3400,2000,'Bess Turner','Guild Apprentice','npc_villager','That bench was mine. The good one, with all four legs the same length.'],
  [-1850,2050,'Margery Reed','Baker’s Runner','npc_attendant','If you want the seeded loaf, ask before the watch changes.'],
  [4200,-680,'Rowan Fen','Garden Hand','npc_villager','The roses do well here. The wind does not reach this wall.'],
 ] as const).entries())if(addPerson('neighbor:'+i,name,title,{x:origin.x+x,y:origin.y+y},texture,line,true))HIGHMERE_MARKET_LIFE.neighbors++;
 // A separate append pass preserves every previously approved detail, too.
 const obstacles=content.filter(d=>'frame' in d&&!worldSpriteProfile(d.texture??'world_objects',d.frame)?.floor).map(d=>{
  if(!('frame' in d))throw new Error('Missing street-detail frame');
  return {bounds:propPlacementBounds(d.texture??'world_objects',d.frame,d.scale??1,d.world.x,d.world.y,d.anchor==='center','wallSegment' in d?d.wallSegment:undefined,d.rotation??0)};
 });
 const index=new StaticBoundsIndex(obstacles),doors=Object.values(CAPITAL_BUILDING_SITES).map(s=>({left:s.x-90,right:s.x+90,top:s.y-8,bottom:s.frontY+48}));
 const beds=layout.parcels.filter(p=>p.terrain==='water'||p.terrain==='farmland').map(p=>({left:p.x-p.width/2,right:p.x+p.width/2,top:p.y-p.height/2,bottom:p.y+p.height/2}));
 const addProp=(id:string,p:Vec2,texture:WorldPropTexture,frame:number,width:number)=>{
  if(HIGHMERE_MARKET_LIFE.details>=72)return;
  const world={x:origin.x+p.x,y:origin.y+p.y},scale=width/artFrameSize(texture,frame).width;
  const r=propPlacementBounds(texture,frame,scale,world.x,world.y),l={left:r.left-origin.x,right:r.right-origin.x,top:r.top-origin.y,bottom:r.bottom-origin.y};
  if(!insideHighmere(p.x,p.y,-200)||royalWardOverlaps(l,90)||overlaps(l,CAPITAL_SHRINE_COURT,40)
   ||doors.some(d=>overlaps(l,d,24))||beds.some(d=>overlaps(l,d,24))||layout.streets.some(s=>rectTouchesStreet(l,s,24)))return;
  const query={left:r.left-24,right:r.right+24,top:r.top-24,bottom:r.bottom+24};
  if(index.any(query,o=>overlaps(r,o.bounds,24))||residents.any(query,o=>overlaps(r,o.bounds,24)))return;
  for(const x of [r.left,r.right])for(const y of [r.top,r.bottom])if(!walkable(x,y))return;
  content.push({id:'detail:highmere:everyday:'+id,kind:'prop',texture,frame,scale,world,solid:true,placement:'fixed'});
  index.add({bounds:r});HIGHMERE_MARKET_LIFE.details++;
 };
 // Delivery stacks beside storefronts; small planted courts farther uphill.
 for(const [slot,site] of Object.entries(CAPITAL_BUILDING_SITES))for(const side of [-1,1]){
  const p={x:site.x+side*270,y:site.frontY-65};
  if(Number(slot)%4===0)addProp('delivery:'+slot+':'+side,p,'native_civic_bare',9,58);
  else if(Number(slot)%4===1)addProp('barrels:'+slot+':'+side,p,'native_civic_bare',8,50);
 }
 for(const [row,y] of [1390,2190,2890,3490,4090].entries())for(const side of [-1,1])for(const x of [2050,2850,3650,4450])
  addProp('court:'+row+':'+side+':'+x,{x:x*side,y},'native_civic_bare',row%2?7:8,row%2?92:48);
 // Working smiths use the existing finished training/tool/delivery assets.
 for(const [i,p] of [{x:2120,y:2100},{x:2250,y:2100},{x:2840,y:2000},{x:3650,y:2000}].entries())
  addProp('craft:'+i,p,'native_story_bare',i<2?5:4,i<2?66:140);
}
