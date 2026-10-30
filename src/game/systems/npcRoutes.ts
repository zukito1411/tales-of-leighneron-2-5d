import { SETTLEMENT_BY_ID } from '../../data/settlements';
import { MARCH_ROUTE, MARCH_LENGTH, MARCH_SPEED, MARCH_SPACING } from '../../data/capitalResidents';
import type { Vec2 } from '../types';
import {StaticBoundsIndex} from './StaticBoundsIndex';

interface Node extends Vec2 { links:Map<number,number> }
const graphs=new Map<string,Node[]>();
function graph(townId:string) {
  const saved=graphs.get(townId);if(saved)return saved;
  const nodes:Node[]=[],byPoint=new Map<string,number[]>();
  const segments=SETTLEMENT_BY_ID[townId].streets.flatMap(s=>s.points.slice(1).map((b,i)=>({a:s.points[i],b,points:[s.points[i],b]})))
    .map((s,id)=>({...s,id,bounds:{left:Math.min(s.a.x,s.b.x)-1,right:Math.max(s.a.x,s.b.x)+1,top:Math.min(s.a.y,s.b.y)-1,bottom:Math.max(s.a.y,s.b.y)+1}}));
  const index=new StaticBoundsIndex(segments);
  const node=(p:Vec2)=>{
    const x=Math.floor(p.x),y=Math.floor(p.y);
    for(let cy=y-1;cy<=y+1;cy++)for(let cx=x-1;cx<=x+1;cx++)
      for(const i of byPoint.get(cx+':'+cy)??[])if(Math.hypot(nodes[i].x-p.x,nodes[i].y-p.y)<1)return i;
    const i=nodes.length,key=x+':'+y,bucket=byPoint.get(key)??[];
    nodes.push({...p,links:new Map()});bucket.push(i);byPoint.set(key,bucket);return i;
  };
  for(const s of segments)for(const t of index.query(s.bounds)){
    if(t.id<=s.id||s.bounds.left>t.bounds.right||s.bounds.right<t.bounds.left||s.bounds.top>t.bounds.bottom||s.bounds.bottom<t.bounds.top)continue;
    const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,ex=t.b.x-t.a.x,ey=t.b.y-t.a.y,det=dx*ey-dy*ex;
    if(Math.abs(det)<.01){
      const insert=(a:Vec2,b:Vec2,p:Vec2,points:Vec2[])=>{
        const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy,u=len?((p.x-a.x)*dx+(p.y-a.y)*dy)/len:0;
        if(u>=0&&u<=1&&Math.hypot(p.x-a.x-u*dx,p.y-a.y-u*dy)<1)points.push(p);
      };
      insert(s.a,s.b,t.a,s.points);insert(s.a,s.b,t.b,s.points);
      insert(t.a,t.b,s.a,t.points);insert(t.a,t.b,s.b,t.points);continue;
    }
    const px=t.a.x-s.a.x,py=t.a.y-s.a.y,u=(px*ey-py*ex)/det,v=(px*dy-py*dx)/det;
    if(u>=0&&u<=1&&v>=0&&v<=1){const p={x:s.a.x+dx*u,y:s.a.y+dy*u};s.points.push(p);t.points.push(p);}
  }
  for(const s of segments){s.points.sort((p,q)=>Math.hypot(p.x-s.a.x,p.y-s.a.y)-Math.hypot(q.x-s.a.x,q.y-s.a.y));
    for(let i=1;i<s.points.length;i++){const a=node(s.points[i-1]),b=node(s.points[i]);if(a===b)continue;
      const d=Math.hypot(nodes[a].x-nodes[b].x,nodes[a].y-nodes[b].y);nodes[a].links.set(b,d);nodes[b].links.set(a,d);}}
  graphs.set(townId,nodes);return nodes;
}

interface QueueEntry {node:number;cost:number}
function push(queue:QueueEntry[],entry:QueueEntry){
  let i=queue.push(entry)-1;
  while(i>0){const parent=(i-1)>>1;if(queue[parent].cost<=entry.cost)break;queue[i]=queue[parent];i=parent;}queue[i]=entry;
}
function pop(queue:QueueEntry[]){
  const entry=queue[0],last=queue.pop()!;
  if(queue.length){let i=0;while(i*2+1<queue.length){let child=i*2+1;
    if(child+1<queue.length&&queue[child+1].cost<queue[child].cost)child++;
    if(queue[child].cost>=last.cost)break;queue[i]=queue[child];i=child;}queue[i]=last;}
  return entry;
}
/** Visibility-checked street graph routing; no teleporting through scenery.
 * A heap avoids sorting/copying the open set at every visited junction. */
export function npcStreetRoute(townId:string,from:Vec2,to:Vec2,canVisit:(a:Vec2,b:Vec2)=>boolean):Vec2[] {
  if(canVisit(from,to))return [to];
  const nodes=graph(townId),dist=nodes.map(()=>Infinity),prev=nodes.map(()=>-1),open:QueueEntry[]=[];
  const near=(p:Vec2)=>nodes.map((n,i)=>({i,d:Math.hypot(n.x-p.x,n.y-p.y)})).sort((a,b)=>a.d-b.d).slice(0,16).filter(n=>canVisit(p,nodes[n.i]));
  const destinations=new Map(near(to).map(n=>[n.i,n.d]));
  for(const n of near(from)){dist[n.i]=n.d;push(open,{node:n.i,cost:n.d});}
  let best=-1,bestCost=Infinity;
  while(open.length){
    const {node:current,cost:currentCost}=pop(open);
    if(currentCost!==dist[current])continue;
    if(currentCost>=bestCost)break;
    const tail=destinations.get(current);if(tail!==undefined&&currentCost+tail<bestCost){best=current;bestCost=currentCost+tail;}
    for(const [next,cost] of nodes[current].links){
      if(currentCost+cost>=dist[next])continue;
      // Probe only improving directed edges; settled/stale heap entries never
      // repeat work or reuse a traversal result in the opposite direction.
      if(!canVisit(nodes[current],nodes[next]))continue;
      dist[next]=currentCost+cost;prev[next]=current;push(open,{node:next,cost:dist[next]});
    }
  }
  if(best<0)return [];
  const path:Vec2[]=[to];for(let i=best;i>=0;i=prev[i])path.unshift({x:nodes[i].x,y:nodes[i].y});return path;
}

export function formationPosition(activeMs:number,rank:number):Vec2 {
  let remaining=(activeMs/1000*MARCH_SPEED+rank*MARCH_SPACING)%MARCH_LENGTH;
  for(let i=1;i<MARCH_ROUTE.length;i++){const a=MARCH_ROUTE[i-1],b=MARCH_ROUTE[i],length=Math.hypot(b.x-a.x,b.y-a.y);
    if(remaining<=length)return {x:a.x+(b.x-a.x)*remaining/length,y:a.y+(b.y-a.y)*remaining/length};remaining-=length;}
  return {...MARCH_ROUTE[0]};
}
