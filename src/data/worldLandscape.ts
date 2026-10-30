import {HIGHMERE_PLAN} from './highmerePlan';
import {chunkCenter,CHUNK_SIZE} from './world';
import {TOWN_BY_ID} from './towns';
import type {Vec2} from '../game/types';
const local=(id:string,x:number,y:number):Vec2=>({x:TOWN_BY_ID[id].world.x+x,y:TOWN_BY_ID[id].world.y+y});
const chunks=(points:number[][])=>points.map(([x,y])=>chunkCenter(x,y));
export const DRAINAGE=[
  {id:'crown-river',width:168,points:[...chunks([[46,12],[39,15]]),...[[HIGHMERE_PLAN.riverX,-8500],[HIGHMERE_PLAN.riverX,-6500],[HIGHMERE_PLAN.riverX,-4000],[HIGHMERE_PLAN.riverX,0],[HIGHMERE_PLAN.riverX,3600],[5000,6000],[0,6650],[-2800,6500]].map(([x,y])=>local('highmere',x,y)),...chunks([[30,30],[24,35],[16,38],[2,40]])]},
  {id:'willow-tributary',width:120,points:[...chunks([[50,12],[45,17]]),...[[900,-5500],[700,-2600],[600,-1150],[600,1150],[700,2600],[1000,5500]].map(([x,y])=>local('willowcross',x,y)),...chunks([[38,31],[38,34],[34,34],[24,35]])]},
  {id:'rootwater',width:144,points:[...chunks([[65,48],[62,54]]),...[[750,-5500],[550,-2600],[450,-1450],[450,1450],[550,2600],[850,5500]].map(([x,y])=>local('deepford',x,y)),...chunks([[58,70],[55,80]])]},
  // Mountain meltwater and woodland springs join existing headwaters. Roads
  // survey these same paths and insert correctly oriented physical crossings.
  {id:'silverleaf-brook',width:72,points:chunks([[54,7],[53,10],[52,11],[50,12]])},
  {id:'skywater',width:88,points:chunks([[75,17],[70,18],[63,14],[56,12],[50,12]])},
  // Small tributaries provide countryside crossings, then join a real river.
  // Their road-facing reaches run north/south for the supplied arched bridges.
  {id:'orchard-brook',width:64,points:chunks([[25.2,19],[25.2,22],[25.2,25],[27,29],[30,30]])},
  {id:'greenward-run',width:64,points:chunks([[49,15],[49,19],[49,22],[49,26],[45,29],[38,31]])},
  {id:'cibar-rill',width:60,points:chunks([[61.6,60],[61.6,64],[61.6,67],[60,69],[58,70]])},
];
export const RIDGES=chunks([[61,15],[68,18],[75,23],[81,30],[83,38],[80,44]]);
export const WOODLAND_UPLANDS=chunks([[49,52],[52,56],[54,59],[55,64]]);
export const CROWN_DOWNS=chunks([[20,17],[23,18],[25,20]]);
export const LAVA_FLOW=[local('blackspire',6500,-6500),local('blackspire',7200,-2000),local('blackspire',9800,3000),local('blackspire',12000,6500)];
interface DrainageSegment {a:Vec2;b:Vec2;width:number;headwater:boolean;left:number;right:number;top:number;bottom:number}
const drainageCells=new Map<string,DrainageSegment[]>(),drainageCellSize=CHUNK_SIZE*2;
for(let r=0;r<DRAINAGE.length;r++)for(let i=1;i<DRAINAGE[r].points.length;i++){
  const river=DRAINAGE[r],a=river.points[i-1],b=river.points[i];
  const segment={a,b,width:river.width,headwater:r>=3,left:Math.min(a.x,b.x)-900,right:Math.max(a.x,b.x)+900,
    top:Math.min(a.y,b.y)-900,bottom:Math.max(a.y,b.y)+900};
  for(let y=Math.floor(segment.top/drainageCellSize);y<=Math.floor(segment.bottom/drainageCellSize);y++)
    for(let x=Math.floor(segment.left/drainageCellSize);x<=Math.floor(segment.right/drainageCellSize);x++){
      const key=x+':'+y,cell=drainageCells.get(key)??[];cell.push(segment);drainageCells.set(key,cell);
    }
}
function drainageSegmentDistance(x:number,y:number,s:DrainageSegment){
  const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,len=dx*dx+dy*dy;
  const t=len?Math.max(0,Math.min(1,((x-s.a.x)*dx+(y-s.a.y)*dy)/len)):0;
  return Math.hypot(x-s.a.x-t*dx,y-s.a.y-t*dy);
}
export function pathDistance(x:number,y:number,points:Vec2[],limit=12000){
  let best=Infinity;
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];
    if(x<Math.min(a.x,b.x)-limit||x>Math.max(a.x,b.x)+limit||y<Math.min(a.y,b.y)-limit||y>Math.max(a.y,b.y)+limit)continue;
    const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy,t=len?Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/len)):0;
    best=Math.min(best,Math.hypot(x-a.x-t*dx,y-a.y-t*dy));
  }return best;
}
export function drainageDistance(x:number,y:number){
  let closest=Infinity;
  for(const s of drainageCells.get(Math.floor(x/drainageCellSize)+':'+Math.floor(y/drainageCellSize))??[]){
    if(x<s.left||x>s.right||y<s.top||y>s.bottom)continue;
    closest=Math.min(closest,drainageSegmentDistance(x,y,s)-s.width/2);
  }
  return closest;
}
export function onHeadwaterStream(x:number,y:number){
  for(const s of drainageCells.get(Math.floor(x/drainageCellSize)+':'+Math.floor(y/drainageCellSize))??[])
    if(s.headwater&&drainageSegmentDistance(x,y,s)<=s.width/2)return true;
  return false;
}
const HARBOR_TOWNS=['tidewatch','skallheim'] as const;
function inHarborBay(x:number,y:number,id:typeof HARBOR_TOWNS[number]){
  const town=TOWN_BY_ID[id].world,dy=y-town.y;
  return dy>900&&dy<40000&&Math.abs(x-town.x)<1400+(dy-900)*.32;
}
export function harborBay(x:number,y:number){return HARBOR_TOWNS.some(id=>inHarborBay(x,y,id));}
/** Each bay is a convex trapezoid. All corners in the SAME bay prove the
 * entire rectangle is water, including the caller's shoreline feather gutter.
 * Shore/intersection chunks retain their ordinary terrain painter. */
export function harborWaterRect(left:number,top:number,right:number,bottom:number){
  return HARBOR_TOWNS.some(id=>inHarborBay(left,top,id)&&inHarborBay(right,top,id)
    &&inHarborBay(left,bottom,id)&&inHarborBay(right,bottom,id));
}
export function harborShoreDistance(x:number,y:number){return Math.min(...['tidewatch','skallheim'].map(id=>{const town=TOWN_BY_ID[id].world,dy=y-town.y,dx=Math.abs(x-town.x);
  if(dy<300||dy>40000)return Infinity;return dy>=900?Math.abs(dx-(1400+(dy-900)*.32)):dx<1400?900-dy:Infinity;}));}
