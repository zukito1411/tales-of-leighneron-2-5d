import type {Vec2} from '../types';
import {harborBay} from '../../data/worldLandscape';
import {CHUNK_SIZE,WORLD_WIDTH,WORLD_HEIGHT} from '../../data/world';
import {seededRandom} from '../../utils/seededRandom';
import {fortificationBlocksPoint,fortificationBlocksPath} from '../../data/fortifications';
import type {WorldGenerator} from './WorldGenerator';
import {BOAT_HULL_CLEARANCE} from './VehicleArt';

export interface TravelPath {id:string;points:Vec2[];length:number;speed:number;phase:number;endpointClearance?:number}
export interface TrafficRoute extends TravelPath {kind:'boat'}
export function pathLength(points:Vec2[]){return points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-points[i].x,p.y-points[i].y),0);}
// Boats on the same lane reuse the immutable route length table.
const routeLengths=new WeakMap<Vec2[],number[]>();
/** Active-play clock gives stable positions across renderer unloading. Endpoints
 * have a short loading pause; direction reverses without teleporting. */
export function routePosition(route:TravelPath,elapsedMs:number){
  const inset=route.endpointClearance??0,span=Math.max(0,route.length-inset*2);
  const travel=span/route.speed*1000,pause=4000,cycle=2*(travel+pause);
  const time=((elapsedMs+route.phase)%cycle+cycle)%cycle;
  const outbound=time<travel+pause;
  const distance=inset+(outbound?Math.min(span,time*route.speed/1000):Math.max(0,span-(time-travel-pause)*route.speed/1000));
  const point=routePointAtDistance(route,distance);
  return {...point,distance,forward:outbound,dx:point.dx*(outbound?1:-1),dy:point.dy*(outbound?1:-1),moving:outbound?time<travel:time<travel*2+pause};
}

/** Sample a boat's center along its measured lane. */
export function routePointAtDistance(route:TravelPath,distance:number){
  distance=Math.max(0,Math.min(route.length,distance));
  let cumulative=routeLengths.get(route.points);
  if(!cumulative){cumulative=[0];for(let i=1;i<route.points.length;i++)cumulative.push(cumulative.at(-1)!+Math.hypot(route.points[i].x-route.points[i-1].x,route.points[i].y-route.points[i-1].y));routeLengths.set(route.points,cumulative);}
  let lo=1,hi=cumulative.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(cumulative[mid]<distance)lo=mid+1;else hi=mid;}
  const a=route.points[lo-1],b=route.points[lo],length=cumulative[lo]-cumulative[lo-1],t=length?Math.max(0,Math.min(1,(distance-cumulative[lo-1])/length)):0;
  return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,dx:b.x-a.x,dy:b.y-a.y};
}

export function isSailingWater(world:WorldGenerator,x:number,y:number){
  return x>=0&&y>=0&&x<WORLD_WIDTH&&y<WORLD_HEIGHT
    &&world.getTerrainAt(x,y)==='water'&&(world.getRegionAt(x,y)==='dead-sea'||harborBay(x,y));
}
/** Deterministic water lanes near the camera. Hull-width samples prohibit
 * grounding at a shore; rivers and bridges never become sea traffic lanes. */
export function seaRoute(world:WorldGenerator,cx:number,cy:number):TrafficRoute|null{
  const id=`boat:${cx}:${cy}`,rng=seededRandom(id);
  for(let attempt=0;attempt<16;attempt++){
    const a={x:(cx+.15+rng()*.7)*CHUNK_SIZE,y:(cy+.15+rng()*.7)*CHUNK_SIZE};
    const angle=rng()*Math.PI*2,length=420+rng()*420,dx=Math.cos(angle),dy=Math.sin(angle);
    const b={x:a.x+dx*length,y:a.y+dy*length};
    if(fortificationBlocksPath(a,b,BOAT_HULL_CLEARANCE))continue;
    let safe=true;
    for(let d=0;d<=Math.ceil(length/24);d++){
      const t=Math.min(length,d*24),x=a.x+dx*t,y=a.y+dy*t;
      const radius=BOAT_HULL_CLEARANCE;
      if(![[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]].every(([ox,oy])=>
        isSailingWater(world,x+ox,y+oy)&&!fortificationBlocksPoint(x+ox,y+oy,12))){safe=false;break;}
    }
    if(safe)return {id,kind:'boat',points:[a,b],length,speed:28+rng()*12,phase:rng()*40000};
  }
  return null;
}
