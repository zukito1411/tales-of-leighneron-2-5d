import {describe,it,expect} from 'vitest';
import {seaRoute,routePosition,isSailingWater,type TrafficRoute} from '../src/game/systems/travelRoutes';
import {WorldGenerator} from '../src/game/systems/WorldGenerator';
import {TOWN_BY_ID} from '../src/data/towns';
import {CHUNK_SIZE} from '../src/data/world';
import {fortificationBlocksPath} from '../src/data/fortifications';
import {BOAT_HULL_CLEARANCE} from '../src/game/systems/VehicleArt';

describe('traveling world scenery',()=>{
  const world=new WorldGenerator();
  it('turns and waits at route ends without jumps, and repeats after a complete trip',()=>{
    const route:TrafficRoute={id:'fixture',kind:'boat',points:[{x:0,y:0},{x:100,y:0},{x:100,y:100}],length:200,speed:10,phase:0};
    expect(routePosition(route,10000)).toMatchObject({x:100,y:0,moving:true});
    expect(routePosition(route,21000)).toMatchObject({x:100,y:100,moving:false});
    expect(routePosition(route,25000)).toMatchObject({x:100,y:90,dy:-100});
    expect(routePosition(route,46000)).toMatchObject({x:0,y:0,moving:false});
    expect(routePosition(route,48000)).toEqual(routePosition(route,0));
    const before=routePosition(route,23999),after=routePosition(route,24001);
    expect(Math.hypot(before.x-after.x,before.y-after.y)).toBeLessThan(.02);
  });
  it('builds reproducible harbor lanes with clearance on both sides of the hull',()=>{
    const harbor=TOWN_BY_ID.tidewatch.world,cx=Math.floor(harbor.x/CHUNK_SIZE),cy=Math.floor((harbor.y+1800)/CHUNK_SIZE);
    const candidates=[-1,0,1].flatMap(dx=>[0,1,2].map(dy=>({cx:cx+dx,cy:cy+dy})))
      .map(p=>({ ...p,route:seaRoute(world,p.cx,p.cy)})).filter(p=>p.route);
    expect(candidates.length).toBeGreaterThan(0);
    for(const {cx,cy,route} of candidates){
      expect(seaRoute(world,cx,cy)).toEqual(route);
      expect(fortificationBlocksPath(route!.points[0],route!.points[1],BOAT_HULL_CLEARANCE)).toBe(false);
      for(let t=0;t<80000;t+=1000){const p=routePosition(route!,t),length=Math.hypot(p.dx,p.dy);
        for(const [ox,oy] of [[0,0],[BOAT_HULL_CLEARANCE,0],[-BOAT_HULL_CLEARANCE,0],[0,BOAT_HULL_CLEARANCE],[0,-BOAT_HULL_CLEARANCE]])expect(isSailingWater(world,p.x+ox,p.y+oy)).toBe(true);}
    }
    expect(isSailingWater(world,TOWN_BY_ID.oakmere.world.x,TOWN_BY_ID.oakmere.world.y)).toBe(false);
    expect(isSailingWater(world,-100,100)).toBe(false);
  });
});
