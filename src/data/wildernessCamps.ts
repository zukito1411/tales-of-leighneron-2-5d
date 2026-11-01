import {REGIONS} from './regions';
import {CHUNK_SIZE,WORLD_SEED,WORLD_WIDTH,WORLD_HEIGHT} from './world';
import {TOWNS} from './towns';
import {insideDefense} from './settlementDefenses';
import {WILDERNESS_SITES} from './wildernessSites';
import {registerWildernessNpc} from './npcs';
import {artFrameSize} from './art';
import {propPlacementBounds,overlaps,type Rect} from './settlementGeometry';
import {WorldGenerator} from '../game/systems/WorldGenerator';
import {ExteriorPlacement} from '../game/systems/ExteriorPlacement';
import {StaticBoundsIndex} from '../game/systems/StaticBoundsIndex';
import {drainageDistance,harborShoreDistance} from './worldLandscape';
import {lakeShoreDistance} from './landscapeFeatures';
import {onCinderpeak} from './cinderpeak';
import {seededRandom} from '../utils/seededRandom';
import {WILDERNESS_CAMPS,registerWildernessCamp,type WildernessCampKind} from './wildernessCampSites';
import type {ContentDefinition,NpcDefinition,PropContentDefinition,RegionId,Vec2,WorldPropTexture} from '../game/types';

export const WILDERNESS_CAMP_SUMMARY={adventurer:0,knight:0,hostile:0,npcs:0,enemies:0,omitted:[] as string[]};
const stations=[{x:-110,y:15},{x:110,y:15},{x:0,y:300}];
const firstNames=['Bram','Nell','Hugh','Tessa','Orin','Mabel','Gareth','Iona','Perrin','Ada','Roland','Faye'];
const surnames=['Thornwick','Ashby','Merrin','Rowe','Briar','Fenwick','Dale','Hollis'];
const lines={
 adventurer:[['Road Adventurer','You can sit by the fire. We are leaving at first light.'],['Trail Scout','We found tracks past the next ridge. Bigger than a wolf’s.'],['Camp Quartermaster','Please leave the dry wood under the canvas. It took all afternoon to find.']],
 knight:[['Road Knight','The road is clear as far as the crossing. We check it again at dawn.'],['Watch Knight','Warm yourself if you need to. Keep the path beside the tents open.'],['Patrol Quartermaster','Three bedrolls, three bowls. I still somehow end up washing four.']],
} as const;
const pad=(r:Rect,n:number):Rect=>({left:r.left-n,right:r.right+n,top:r.top-n,bottom:r.bottom+n});
/** One bounded, seeded authoring pass over the final world. Appends only; all
 * approved town lots, story sites, NPCs and persisted IDs retain their data. */
export function addWildernessCamps(content:ContentDefinition[]){
 if(content.some(d=>d.id.startsWith('wildcamp:')))return;
 const terrain=new WorldGenerator(),existing=new ExteriorPlacement(content);
 const obstacles=new StaticBoundsIndex(content.map(d=>{
  if('frame' in d)return {bounds:propPlacementBounds(d.texture??'world_objects',d.frame,d.scale??1,d.world.x,d.world.y,d.anchor==='center','wallSegment' in d?d.wallSegment:undefined,d.rotation??0)};
  const r=d.kind==='creature'?(d.bossId?1500:800):d.kind==='npc'?300:800;
  return {bounds:{left:d.world.x-r,right:d.world.x+r,top:d.world.y-r,bottom:d.world.y+r}};
 }));
 const makeProps=(id:string,p:Vec2):PropContentDefinition[]=>{
  const items:readonly [string,WorldPropTexture,number,number,number,number][]=[
   ['tent-left','native_quest_landmarks',2,180,-185,-155],['tent-right','native_quest_landmarks',2,164,185,-155],
   ['fire','world_assets',6,66,0,110],['supplies','native_civic_bare',9,62,-245,145],
   ['barrels','native_civic_bare',8,58,245,145],['bench-left','native_civic_bare',7,95,-125,200],['bench-right','native_civic_bare',7,95,125,200],
  ];
  return items.map(([name,texture,frame,width,x,y])=>({id:id+':'+name,kind:'prop',texture,frame,scale:width/artFrameSize(texture,frame).width,world:{x:p.x+x,y:p.y+y},solid:true,placement:'fixed'}));
 };
 const propsFit=(props:PropContentDefinition[],p:Vec2)=>{
  const bounds=props.map(d=>propPlacementBounds(d.texture!,d.frame,d.scale,d.world.x,d.world.y));
  for(let i=0;i<bounds.length;i++){
   const b=bounds[i];if(bounds.slice(i+1).some(other=>overlaps(b,other,12)))return false;
   for(const x of [b.left,(b.left+b.right)/2,b.right])for(const y of [b.top,(b.top+b.bottom)/2,b.bottom])if(!terrain.isWalkable(x,y))return false;
  }
  const placement=new ExteriorPlacement(props);
  return stations.every(s=>{
   const q={x:p.x+s.x,y:p.y+s.y};
   return terrain.isWalkable(q.x,q.y)&&!existing.blocksNpc(q,undefined,true)&&!placement.blocksNpc(q,undefined,true);
  });
 };
 for(const region of REGIONS)for(let slot=0;slot<4;slot++){
  const id=`wildcamp:${region.id}:${slot}`,kind:WildernessCampKind=slot===1?'knight':slot===2?'hostile':'adventurer';
  const random=seededRandom(WORLD_SEED+':'+id+':v1');
  let site:Vec2|undefined,props:PropContentDefinition[]=[];
  for(let attempt=0;attempt<160;attempt++){
   const a=(attempt<48?slot/4+random()*.25:random())*Math.PI*2,r=3500+random()*16000;
   const p={x:Math.round((region.centerChunk.x+.5)*CHUNK_SIZE+Math.cos(a)*r),y:Math.round((region.centerChunk.y+.5)*CHUNK_SIZE+Math.sin(a)*r)};
   const b={left:p.x-430,right:p.x+430,top:p.y-430,bottom:p.y+420};
   if(b.left<1000||b.top<1000||b.right>WORLD_WIDTH-1000||b.bottom>WORLD_HEIGHT-1000||terrain.getRegionAt(p.x,p.y)!==region.id)continue;
   if(TOWNS.some(t=>insideDefense(t.id,p.x,p.y,900))||onCinderpeak(p.x,p.y,900)
    ||WILDERNESS_SITES.some(s=>Math.hypot(p.x-s.world.x,p.y-s.world.y)<1200)
    ||WILDERNESS_CAMPS.some(s=>Math.hypot(p.x-s.x,p.y-s.y)<2300)
    ||Math.min(drainageDistance(p.x,p.y),harborShoreDistance(p.x,p.y),lakeShoreDistance(p.x,p.y))<600
    ||obstacles.any(pad(b,80),o=>overlaps(b,o.bounds,80)))continue;
   let valid=true,lo=Infinity,hi=-Infinity;
   for(const x of [b.left,p.x,b.right])for(const y of [b.top,p.y,b.bottom]){
    if(terrain.getRegionAt(x,y)!==region.id||!terrain.isWalkable(x,y)||terrain.isRoad(x,y,80)){valid=false;break;}
    const h=terrain.getElevationAt(x,y);lo=Math.min(lo,h);hi=Math.max(hi,h);
   }
   if(!valid||hi-lo>(region.id==='nardorous'?48:region.id==='darkav'?36:24))continue;
   if(![0,1,2,3,4,5,6,7].some(i=>{
    const a=i*Math.PI/4,q={x:p.x+Math.cos(a)*400,y:p.y+Math.sin(a)*400};
    return terrain.isWalkablePath(p,q)&&!existing.blocksAccessPath(p,q);
   }))continue;
   const planned=makeProps(id,p);if(!propsFit(planned,p))continue;
   site=p;props=planned;break;
  }
  if(!site){WILDERNESS_CAMP_SUMMARY.omitted.push(id);continue;}
  const p=site;
  content.push(...props);
  registerWildernessCamp({id,region:region.id,kind,...p,bounds:{left:p.x-500,right:p.x+500,top:p.y-500,bottom:p.y+500}});
  WILDERNESS_CAMP_SUMMARY[kind]++;
  if(kind==='hostile'){
   const enemies=campEnemies(region.id);
   for(let i=0;i<3;i++){
    const q={x:p.x+stations[i].x,y:p.y+stations[i].y};
    content.push({id:id+':enemy:'+i,kind:'creature',enemyId:enemies[i],eventSpawn:true,world:q,encounterId:id,
     encounterBehavior:{home:{...p},station:q,leashRadius:650,role:i===0?'leader':i===2?'ranged':'melee',slot:i}});
    WILDERNESS_CAMP_SUMMARY.enemies++;
   }
  }else{
   const town=TOWNS.reduce((a,b)=>Math.hypot(a.world.x-p.x,a.world.y-p.y)<Math.hypot(b.world.x-p.x,b.world.y-p.y)?a:b);
   for(let i=0;i<3;i++){
    const q={x:p.x+stations[i].x,y:p.y+stations[i].y},local={x:q.x-town.world.x,y:q.y-town.world.y};
    const count=WILDERNESS_CAMP_SUMMARY.npcs,[title,line]=lines[kind][i];
    const npc:NpcDefinition={id:id+':npc:'+i,name:firstNames[count%12]+' '+surnames[Math.floor(count/12)%8],title,townId:town.id,
     ancestry:'human',visualRegion:'trandum',visitor:true,settlementResident:true,spriteTexture:kind==='knight'?'npc_royal_guard':i===2?'npc_attendant':'npc_adventurer',spriteFrame:0,
     campId:id,worldOffset:local,homeLocation:local,stationary:i<2,patrolRadius:i===2?26:0,showOverheadLabels:i<2,
     combatant:kind==='knight',...(kind==='knight'?{weaponId:'oak-shield-blade'}:{}),role:title,
     schedule:[{startHour:0,activity:i===2?'Checks camp supplies':'Keeps watch beside the fire',location:local}],
     relationshipToLeigneron:{kind:'acquaintance',trust:40,summary:'A traveler met beside a wilderness campfire.'},dialogue:[line],questIds:[]};
    registerWildernessNpc(npc);content.push({id:'npc:'+npc.id,kind:'npc',npcId:npc.id,world:q});WILDERNESS_CAMP_SUMMARY.npcs++;
   }
  }
 }
}
function campEnemies(region:RegionId):readonly string[]{
 if(region==='rindass')return ['rindass-orc-raider','rindass-orc-raider','rindass-orc-spearman'];
 if(region==='portquill')return ['cutlass-pirate','cutlass-pirate','cutlass-pirate'];
 if(region==='narenthil'||region==='druganwoods')return ['hedge-goblin','hedge-goblin','goblin-stone-slinger'];
 return ['road-bandit','road-bandit','road-bandit'];
}
