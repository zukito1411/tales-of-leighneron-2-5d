import type { Vec2 } from '../game/types';
import { chunkCenter, CHUNK_SIZE } from './world';
import { ROAD_CONNECTIONS, TOWN_BY_ID } from './towns';
import {DRAINAGE} from './worldLandscape';
import {settlementEnvelope,settlementNorthBoundary,DEEPFORD_TRADE_STREET_Y} from './settlementPlanning';
import {stoneBridgeScale,stoneBridgeApproachSpan,stoneBridgePath} from './bridgeDeck';

export interface RoadRoute { id:string; from:string; to:string; width:number; points:Vec2[]; surface:'stone'|'dirt'; hierarchy:'royal'|'regional'|'trail'; crossings:Array<Vec2 & {width:number;scale:number}> }

// Surveyed mainland corridors. Waypoints follow valley floors and pass
// approaches rather than drawing a ruler line through every town pair.
const corridors:Record<string,Array<[number,number]>> = {
  'deepford:cibar-plains':[[58,62+620/1536],[58.8,62+620/1536],[61,64],[64,66]],
  'oakmere:highmere':[[22.5,24.3],[25,23.4],[28,22.4]],
  'highmere:willowcross':[[34,22.2],[37,23.2]],
  'willowcross:elarion':[[43,24],[47,21],[52,17.8]],
  'elarion:moonfall':[[59,18],[61,20]],
  'willowcross:starhold':[[47,25],[54,25.2],[61,25.3],[68,26],[74,27]],
  'starhold:redmesa':[[81,32],[81.5,38],[80,44]],
  'redmesa:deepford':[[74,53],[69,56],[63,59.5]],
  'deepford:highmere':[[53,56],[49,49],[44,42],[39,34],[35,27],[31.9,22.42],[31.2,22.42]],
  'moonfall:starhold':[[65,24],[69,25],[74,27]],
};

// Follow the authored cross streets before leaving the surveyed enclosure.
// This module deliberately does not import settlement layouts: those layouts
// reserve these approaches when fitting buildings, so importing them cycles.
function insideSurvey(id:string,p:Vec2){
  const town=TOWN_BY_ID[id],bounds=settlementEnvelope(town);
  return p.x>=town.world.x+bounds.left-320&&p.x<=town.world.x+bounds.right+320
    &&p.y>=town.world.y+bounds.top-320&&p.y<=town.world.y+bounds.bottom+320;
}
function approach(id:string,toward:Vec2):Vec2[]{
  const town=TOWN_BY_ID[id],bounds=settlementEnvelope(town),dx=toward.x-town.world.x,dy=toward.y-town.world.y;
  const local=(x:number,y:number)=>({x:town.world.x+x,y:town.world.y+y});
  if(id==='deepford'&&dx>0&&dy>0)return [town.world,local(0,DEEPFORD_TRADE_STREET_Y),local(bounds.right+480,DEEPFORD_TRADE_STREET_Y)];
  if(Math.abs(dx)>Math.abs(dy))return [town.world,local(Math.sign(dx)*(bounds.right+480),0)];
  if(id==='highmere')return dy<0
    ?[town.world,local(850,0),local(850,-2400),local(1400,-2400),local(1400,settlementNorthBoundary(town,1400)-480)]
    :[town.world,local(-600,0),local(-600,bounds.bottom+480)];
  if(id==='oakmere'&&dy<0)return [town.world,local(-550,0),local(-550,bounds.top-480)];
  return [town.world,local(0,dy<0?bounds.top-480:bounds.bottom+480)];
}
export const ROAD_ROUTES:RoadRoute[] = ROAD_CONNECTIONS.map(([from,to]):RoadRoute => {
 const surveyed=corridors[`${from}:${to}`].map(([x,y])=>chunkCenter(x,y))
   .filter(p=>!insideSurvey(from,p)&&!insideSurvey(to,p));
 return {
  id:`${from}:${to}`,from,to,width:from==='elarion'&&to==='moonfall'?96:from==='oakmere'?144:from==='starhold'||to==='starhold'?128:176,
  surface:from==='highmere'||to==='highmere'?'stone':'dirt',hierarchy:from==='highmere'||to==='highmere'?'royal':to==='moonfall'?'trail':'regional',crossings:[],
  points:[...approach(from,surveyed[0]??TOWN_BY_ID[to].world),...surveyed,
    ...approach(to,surveyed[surveyed.length-1]??TOWN_BY_ID[from].world).reverse()],
 };});

// Align every new river crossing to the actual east/west bridge illustration.
// Existing town-center approaches already match their authored local decks.
for(const route of ROAD_ROUTES){const aligned:Vec2[]=[route.points[0]];
  for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i],hits:Array<Vec2 & {t:number;width:number;scale:number}>=[];
    for(const river of DRAINAGE)for(let j=1;j<river.points.length;j++){
      const c=river.points[j-1],d=river.points[j],dx=b.x-a.x,dy=b.y-a.y,ex=d.x-c.x,ey=d.y-c.y,det=dx*ey-dy*ex;
      if(Math.abs(det)<.001||Math.abs(ey)<Math.abs(ex)*.45)continue;
      const t=((c.x-a.x)*ey-(c.y-a.y)*ex)/det,u=((c.x-a.x)*dy-(c.y-a.y)*dx)/det;
      if(t<=0||t>=1||u<0||u>1)continue;
      const waterSpan=river.width*Math.hypot(ex,ey)/Math.abs(ey);
      const p={x:a.x+dx*t,y:a.y+dy*t,t,width:waterSpan,scale:stoneBridgeScale(waterSpan)};
      if(Math.hypot(p.x-TOWN_BY_ID[route.from].world.x,p.y-TOWN_BY_ID[route.from].world.y)<3000
        ||Math.hypot(p.x-TOWN_BY_ID[route.to].world.x,p.y-TOWN_BY_ID[route.to].world.y)<3000)continue;
      if(!hits.some(h=>Math.hypot(h.x-p.x,h.y-p.y)<300))hits.push(p);
    }
    for(const hit of hits.sort((p,q)=>p.t-q.t)){
      const sign=b.x>=a.x?1:-1,half=Math.max(hit.width/2+60,stoneBridgeApproachSpan(hit.scale));
      const deck=stoneBridgePath(hit.x,hit.y,hit.scale);
      if(sign<0)deck.reverse();
      aligned.push({x:hit.x-sign*half,y:hit.y},...deck,{x:hit.x+sign*half,y:hit.y});route.crossings.push(hit);
    }
    aligned.push(b);
  }route.points=aligned;
}
// Immutable spatial buckets avoid scanning every road and allocating sliced
// point arrays for each terrain pixel, tree slot and creature movement query.
interface RoadSegment {a:Vec2;b:Vec2;route:RoadRoute}
const roadCells=new Map<string,RoadSegment[]>(),cellSize=CHUNK_SIZE*2;
for(const route of ROAD_ROUTES)for(let i=1;i<route.points.length;i++){
  const segment={a:route.points[i-1],b:route.points[i],route},pad=route.width/2;
  for(let y=Math.floor((Math.min(segment.a.y,segment.b.y)-pad)/cellSize);y<=Math.floor((Math.max(segment.a.y,segment.b.y)+pad)/cellSize);y++)
    for(let x=Math.floor((Math.min(segment.a.x,segment.b.x)-pad)/cellSize);x<=Math.floor((Math.max(segment.a.x,segment.b.x)+pad)/cellSize);x++){
      const key=x+':'+y,list=roadCells.get(key)??[];list.push(segment);roadCells.set(key,list);
    }
}
export function roadSurfaceAt(x:number,y:number){
  const point={x,y};
  for(const s of roadCells.get(Math.floor(x/cellSize)+':'+Math.floor(y/cellSize))??[])
    if(segmentDistance(point,s.a,s.b)<=s.route.width/2)return s.route.surface;
}

export function segmentDistance(point:Vec2,a:Vec2,b:Vec2) {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  const t = length ? Math.max(0,Math.min(1,((point.x - a.x) * dx + (point.y - a.y) * dy) / length)) : 0;
  return Math.hypot(point.x - a.x - t * dx,point.y - a.y - t * dy);
}

export function onRoadRoute(x:number,y:number,clearance = 0) {
  const point = { x,y },pad=Math.max(0,clearance);
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(pad))return false;
  for(let cy=Math.floor((y-pad)/cellSize);cy<=Math.floor((y+pad)/cellSize);cy++)
    for(let cx=Math.floor((x-pad)/cellSize);cx<=Math.floor((x+pad)/cellSize);cx++)
      for(const s of roadCells.get(cx+':'+cy)??[])
        if(segmentDistance(point,s.a,s.b)<=s.route.width/2+pad)return true;
  return false;
}
