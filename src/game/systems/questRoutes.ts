import { ROAD_ROUTES } from '../../data/roadRoutes';
import { SETTLEMENT_ACCESS_ROADS } from '../../data/settlementAccessRoads';
import type { Vec2 } from '../types';
import {stoneBridgeApproachSpan} from '../../data/bridgeDeck';

interface Node extends Vec2 { links:Map<number,number> }
const nodes:Node[]=[];
const segments:Array<{a:number;b:number}>=[];
const node=(p:Vec2)=>{
  let i=nodes.findIndex(n=>Math.hypot(n.x-p.x,n.y-p.y)<1);
  if(i<0){i=nodes.length;nodes.push({...p,links:new Map()});}return i;
};
// Use the surveyed corridors, including their actual bridge approaches.
const routes=[...ROAD_ROUTES.map(r=>r.points),...SETTLEMENT_ACCESS_ROADS.map(r=>r.points)];
for(const points of routes)for(let i=1;i<points.length;i++){
  const a=node(points[i-1]),b=node(points[i]),cost=Math.hypot(nodes[a].x-nodes[b].x,nodes[a].y-nodes[b].y);
  nodes[a].links.set(b,cost);nodes[b].links.set(a,cost);segments.push({a,b});
}
function attachment(p:Vec2){
  let result:{a:number;b:number;point:Vec2;distance:number}|undefined;
  for(const {a,b} of segments){
    const start=nodes[a],end=nodes[b],dx=end.x-start.x,dy=end.y-start.y,len=dx*dx+dy*dy;
    const t=len?Math.max(0,Math.min(1,((p.x-start.x)*dx+(p.y-start.y)*dy)/len)):0;
    const point={x:start.x+dx*t,y:start.y+dy*t},distance=Math.hypot(p.x-point.x,p.y-point.y);
    if(!result||distance<result.distance)result={a,b,point,distance};
  }return result;
}
let cache:{key:string;path:Vec2[]}|undefined;
/** Bounded road-graph search; cached while walking within a small route cell. */
export function mainlandQuestWaypoint(from:Vec2,to:Vec2):Vec2|undefined {
  const nearBridge=ROAD_ROUTES.some(r=>r.crossings.some(p=>Math.abs(from.x-p.x)<stoneBridgeApproachSpan(p.scale)+80&&Math.abs(from.y-p.y)<150));
  if(!nearBridge&&Math.hypot(from.x-to.x,from.y-to.y)<1800)return;
  const cell=nearBridge?64:256;
  const key=`${cell}:${Math.floor(from.x/cell)},${Math.floor(from.y/cell)}:${Math.round(to.x/64)},${Math.round(to.y/64)}`;
  if(cache?.key!==key){
    const start=attachment(from),end=attachment(to);if(!start||!end)return;
    const dist=nodes.map(()=>Infinity),prev=nodes.map(()=>-1),open=new Set<number>();
    for(const i of [start.a,start.b]){dist[i]=Math.hypot(nodes[i].x-start.point.x,nodes[i].y-start.point.y);open.add(i);}
    let best=-1,bestCost=Infinity;
    while(open.size){
      let current=-1;for(const i of open)if(current<0||dist[i]<dist[current])current=i;
      open.delete(current);if(dist[current]>=bestCost)break;
      if(current===end.a||current===end.b){const cost=dist[current]+Math.hypot(nodes[current].x-end.point.x,nodes[current].y-end.point.y);
        if(cost<bestCost){best=current;bestCost=cost;}}
      for(const [next,cost] of nodes[current].links)if(dist[current]+cost<dist[next]){
        dist[next]=dist[current]+cost;prev[next]=current;open.add(next);
      }
    }
    const path:Vec2[]=[];
    if(best>=0){for(let i=best;i>=0;i=prev[i])path.unshift({x:nodes[i].x,y:nodes[i].y});
      path.unshift(start.point);path.push(end.point,to);
      // If both attachments share a segment, the road itself is the shortest
      // route. Don't send a traveler out to the town at either end and back.
      if(start.a===end.a&&start.b===end.b){path.splice(0,path.length,start.point,end.point,to);}
    }
    cache={key,path};
  }
  const path=cache?.path??[];
  let nearest=1,distance=Infinity;
  // Attach to a path segment, not its nearest vertex: the latter can send a
  // traveler back to a waypoint they have already passed. Small bridge steps
  // must not be skipped by the normal 150-unit open-road arrival threshold.
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;
    if(len<.001)continue;
    const t=Math.max(0,Math.min(1,((from.x-a.x)*dx+(from.y-a.y)*dy)/len));
    const d=Math.hypot(from.x-a.x-t*dx,from.y-a.y-t*dy);
    if(d<=distance){nearest=i;distance=d;}
  }
  const threshold=nearBridge?12:150;
  const next=path.slice(nearest).find(p=>Math.hypot(p.x-from.x,p.y-from.y)>threshold);
  return next&&Math.hypot(next.x-to.x,next.y-to.y)>1?next:undefined;
}
