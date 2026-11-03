import type {Vec2} from '../game/types';
import {roomFloorContains,type RoomPlan,type RoomRect} from './interiors';

const contains=(r:RoomRect,p:Vec2)=>p.x>=r.x&&p.x<=r.x+r.width&&p.y>=r.y&&p.y<=r.y+r.height;

/** Resolve idle gaze from the actor's actual admitted position, including
 * relocations. Short floor/wall probes are independent of transient crowds;
 * a workbench or dining table may intentionally be the object being viewed. */
export function interiorIdleLookTarget(plan:RoomPlan,position:Vec2,walls:readonly RoomRect[],facing?:Vec2,lookAt?:Vec2):Vec2 {
 const room=plan.rooms.find(r=>contains(r,position))??plan.floors.find(r=>contains(r,position));
 const valid=(target:Vec2)=>{
  const dx=target.x-position.x,dy=target.y-position.y,length=Math.hypot(dx,dy);
  if(length<4)return false;
  const reach=Math.min(112,length);
  for(let d=16;d<=reach+15;d+=16){
   const step=Math.min(d,reach),x=position.x+dx/length*step,y=position.y+dy/length*step;
   if(!roomFloorContains(plan,x,y)||walls.some(r=>x>=r.x-6&&x<=r.x+r.width+6&&y>=r.y-6&&y<=r.y+r.height+6))return false;
  }
  return true;
 };
 // Table targets are room-local points, rather than a stale vector copied
 // from the original spawn slot after placement moved the patron elsewhere.
 if(lookAt&&(!room||contains(room,lookAt))&&valid(lookAt))return lookAt;
 if(facing&&!lookAt){
  const length=Math.hypot(facing.x,facing.y);
  if(length>.001){
   const target={x:position.x+facing.x/length*112,y:position.y+facing.y/length*112};
   if(valid(target))return target;
  }
 }
 let table:Vec2|undefined,best=320**2;
 for(const object of plan.objects){
  if(object.art!=='table')continue;
  const target={x:object.solid?object.solid.x+object.solid.width/2:object.x,
   y:object.solid?object.solid.y+object.solid.height/2:object.y-object.width*.25};
  if(room&&!contains(room,target))continue;
  const distance=(target.x-position.x)**2+(target.y-position.y)**2;
  if(distance<best&&valid(target)){table=target;best=distance;}
 }
 if(table)return table;
 if(room){const center={x:room.x+room.width/2,y:room.y+room.height/2};if(valid(center))return center;}
 for(const reach of [112,64])for(const [x,y] of [[0,1],[1,0],[-1,0],[0,-1]]){
  const target={x:position.x+x*reach,y:position.y+y*reach};if(valid(target))return target;
 }
 return position;
}
