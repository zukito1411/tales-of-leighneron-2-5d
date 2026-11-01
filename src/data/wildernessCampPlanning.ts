import {REGIONS} from './regions';
import {CHUNK_SIZE,WORLD_SEED,WORLD_WIDTH,WORLD_HEIGHT} from './world';
import {TOWNS} from './towns';
import {insideDefense} from './settlementDefenses';
import {WILDERNESS_SITES} from './wildernessSites';
import {propPlacementBounds,overlaps,type Rect} from './settlementGeometry';
import {WorldGenerator} from '../game/systems/WorldGenerator';
import {ExteriorPlacement} from '../game/systems/ExteriorPlacement';
import {StaticBoundsIndex} from '../game/systems/StaticBoundsIndex';
import {drainageDistance,harborShoreDistance} from './worldLandscape';
import {lakeShoreDistance} from './landscapeFeatures';
import {onCinderpeak} from './cinderpeak';
import {seededRandom} from '../utils/seededRandom';
import type {WildernessCampSite,WildernessCampKind} from './wildernessCampSites';
import {CAMP_OCCUPANT_STATIONS as stations,wildernessCampProps as makeProps} from './wildernessCampProps';
import {roadTouchesRect} from './roadRoutes';
import type {ContentDefinition,PropContentDefinition,Vec2} from '../game/types';

const pad=(r:Rect,n:number):Rect=>({left:r.left-n,right:r.right+n,top:r.top-n,bottom:r.bottom+n});
/** Offline authoring only. Runtime imports the resulting surveyed JSON. */
export function planWildernessCamps(content:readonly ContentDefinition[]){
 const accepted:WildernessCampSite[]=[],omitted:string[]=[];
 const terrain=new WorldGenerator(),existing=new ExteriorPlacement(content);
 const obstacles=new StaticBoundsIndex(content.map(d=>{
  if('frame' in d)return {bounds:propPlacementBounds(d.texture??'world_objects',d.frame,d.scale??1,d.world.x,d.world.y,d.anchor==='center','wallSegment' in d?d.wallSegment:undefined,d.rotation??0)};
  const r=d.kind==='creature'?(d.bossId?1500:800):d.kind==='npc'?300:800;
  return {bounds:{left:d.world.x-r,right:d.world.x+r,top:d.world.y-r,bottom:d.world.y+r}};
 }));
 const propsFit=(props:PropContentDefinition[],p:Vec2)=>{
  const bounds=props.map(d=>propPlacementBounds(d.texture!,d.frame,d.scale,d.world.x,d.world.y));
  for(let i=0;i<bounds.length;i++){
   const b=bounds[i];if(bounds.slice(i+1).some(other=>overlaps(b,other,12)))return false;
   for(const x of [b.left,(b.left+b.right)/2,b.right])for(const y of [b.top,(b.top+b.bottom)/2,b.bottom])if(!terrain.isWalkable(x,y))return false;
  }
  const placement=new ExteriorPlacement(props);
  return stations.every(s=>{
   const q={x:p.x+s.x,y:p.y+s.y};
   return terrain.isWalkable(q.x,q.y)&&!existing.blocksNpc(q,undefined,true)&&!placement.blocksNpc(q,undefined,true)
    &&[0,1,2,3,4,5,6,7].some(i=>{
      const a=i*Math.PI/4,exit={x:q.x+Math.cos(a)*384,y:q.y+Math.sin(a)*384};
      return terrain.isWalkablePath(q,exit)&&!existing.blocksAccessPath(q,exit)&&!placement.blocksAccessPath(q,exit);
    });
  });
 };
 for(const region of REGIONS)for(let slot=0;slot<4;slot++){
  const id=`wildcamp:${region.id}:${slot}`,kind:WildernessCampKind=slot===1?'knight':slot===2?'hostile':'adventurer';
  const random=seededRandom(WORLD_SEED+':'+id+':v1');
  let site:Vec2|undefined;
  for(let attempt=0;attempt<160;attempt++){
   const a=(attempt<48?slot/4+random()*.25:random())*Math.PI*2,r=3500+random()*16000;
   const p={x:Math.round((region.centerChunk.x+.5)*CHUNK_SIZE+Math.cos(a)*r),y:Math.round((region.centerChunk.y+.5)*CHUNK_SIZE+Math.sin(a)*r)};
   const b={left:p.x-430,right:p.x+430,top:p.y-430,bottom:p.y+420};
   if(roadTouchesRect(b,80))continue;
   if(b.left<1000||b.top<1000||b.right>WORLD_WIDTH-1000||b.bottom>WORLD_HEIGHT-1000||terrain.getRegionAt(p.x,p.y)!==region.id)continue;
   if(TOWNS.some(t=>insideDefense(t.id,p.x,p.y,900))||onCinderpeak(p.x,p.y,900)
    ||WILDERNESS_SITES.some(s=>Math.hypot(p.x-s.world.x,p.y-s.world.y)<1200)
    ||accepted.some(s=>Math.hypot(p.x-s.x,p.y-s.y)<2300)
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
   site=p;break;
  }
  if(!site){omitted.push(id);continue;}
  accepted.push({id,region:region.id,kind,...site,bounds:{left:site.x-500,right:site.x+500,top:site.y-500,bottom:site.y+500}});
 }
 return {seed:WORLD_SEED,version:1,sites:accepted,omitted};
}
