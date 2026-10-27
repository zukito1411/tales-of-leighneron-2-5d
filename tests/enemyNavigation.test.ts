import {describe,it,expect} from 'vitest';
import {EnemyNavigation} from '../src/game/systems/EnemyNavigation';
import type {Vec2} from '../src/game/types';

const obstacle={left:80,right:240,top:-140,bottom:140};
function clear(a:Vec2,b:Vec2){
  let lo=0,hi=1;
  for(const [v,d,min,max] of [[a.x,b.x-a.x,obstacle.left,obstacle.right],[a.y,b.y-a.y,obstacle.top,obstacle.bottom]]){
    if(Math.abs(d)<.000001){if(v<min||v>max)return true;continue;}
    const x=(min-v)/d,y=(max-v)/d;lo=Math.max(lo,Math.min(x,y));hi=Math.min(hi,Math.max(x,y));if(lo>hi)return true;
  }
  return false;
}
describe('bounded enemy detours',()=>{
  it('finds swept waypoints around a wide wall instead of requiring a forward opening',()=>{
    const nav=new EnemyNavigation(),owner={},from={x:0,y:0},target={x:340,y:0};
    let point=nav.point(owner,from,target,0,0,clear);
    for(let frame=1;frame<300&&point===target;frame++)point=nav.point(owner,from,target,frame*16,frame,clear);
    expect(point).not.toBe(target);expect(clear(from,point)).toBe(true);
    expect(Math.abs(point.y)).toBeGreaterThan(0);
  });
  it('rotates work between independent blocked foes',()=>{
    const nav=new EnemyNavigation(),owners=[{},{},{}],from={x:0,y:0},target={x:340,y:0};
    const points=owners.map(o=>nav.point(o,from,target,0,0,clear));
    for(let frame=1;frame<500&&points.some(p=>p===target);frame++)
      owners.forEach((o,i)=>{points[i]=nav.point(o,from,target,frame*16,frame,clear);});
    expect(points.every(p=>p!==target&&clear(from,p))).toBe(true);
  });
  it('cancels unloaded actors and keeps failed routes bounded',()=>{
    const nav=new EnemyNavigation(),owner={},from={x:0,y:0},target={x:340,y:0};let probes=0;
    const blocked=()=>{probes++;return false;};nav.point(owner,from,target,0,0,blocked);
    nav.forget(owner);const prior=probes;
    nav.point({},from,target,16,1,()=>true);expect(probes).toBe(prior);
    nav.point(owner,from,target,32,2,blocked);nav.point(owner,from,target,48,3,blocked);
    const failed=probes;
    for(let frame=4;frame<30;frame++)nav.point(owner,from,target,frame*16,frame,blocked);
    expect(probes).toBe(failed);nav.clear();
  });
  it('revalidates a short swept segment without reprobeing the whole clear route each frame',()=>{
    const nav=new EnemyNavigation(),owner={},from={x:0,y:0},target={x:800,y:0};const lengths:number[]=[];
    const open=(a:Vec2,b:Vec2)=>{lengths.push(Math.hypot(a.x-b.x,a.y-b.y));return true;};
    nav.point(owner,from,target,0,0,open);nav.point(owner,from,target,16,1,open);
    expect(lengths).toEqual([800,48]);
  });
});
