import {CHUNK_SIZE} from '../../data/world';
import {WORLD_CONTENT} from '../../data/content';
import {StaticBoundsIndex} from './StaticBoundsIndex';
import {spriteBounds} from '../../data/settlementGeometry';
import {bossArenaBounds} from './bossArenas';
import {planLandmarkScenerySteps} from './LandmarkScenery';
import {planWildernessTreeSteps,planWildernessDetailSteps,type SceneryTree,type SceneryDetail} from './sceneryPlan';
import type {WorldGenerator} from './WorldGenerator';
const authoredReservations=new StaticBoundsIndex(WORLD_CONTENT.map(d=>({definition:d,
  bounds:{left:d.world.x,right:d.world.x,top:d.world.y,bottom:d.world.y}})),CHUNK_SIZE);
export interface ChunkSceneryPlan {trees:SceneryTree[];details:SceneryDetail[]}
export function* planChunkScenerySteps(world:WorldGenerator,chunkX:number,chunkY:number):Generator<void,ChunkSceneryPlan>{
      const cx=(chunkX+.5)*CHUNK_SIZE,cy=(chunkY+.5)*CHUNK_SIZE;
      const sites=authoredReservations.query({left:cx-CHUNK_SIZE,right:cx+CHUNK_SIZE,top:cy-CHUNK_SIZE,bottom:cy+CHUNK_SIZE})
        .map(item=>item.definition).filter(d=>Math.abs(d.world.x-cx)<CHUNK_SIZE&&Math.abs(d.world.y-cy)<CHUNK_SIZE);
      const reservations=sites.map(d=>{
        const arena=bossArenaBounds(d);
        return {...d.world,...('frame' in d?{bounds:spriteBounds(d.texture??'world_objects',d.frame,d.scale??1,d.world.x,d.world.y)}:{}),
          ...(arena?{bounds:arena}:{})};
      });
      const nearbyLandmarks=yield* planLandmarkScenerySteps(chunkX,chunkY,world,true);
      const landmarkDetails=nearbyLandmarks.filter(d=>Math.floor(d.x/CHUNK_SIZE)===chunkX&&Math.floor(d.y/CHUNK_SIZE)===chunkY);
      const landmarks=nearbyLandmarks.map(d=>({...d,bounds:spriteBounds(d.texture,d.frame,d.scale,d.x,d.y)}));
      yield;
      const trees=yield* planWildernessTreeSteps(chunkX,chunkY,world,[...reservations,...landmarks]);
      const treeReservations=trees.map(t=>({...t,bounds:spriteBounds(t.texture,t.frame,t.scale,t.x,t.y)}));
      const wildernessDetails=yield* planWildernessDetailSteps(chunkX,chunkY,world,[...reservations,...landmarks,...treeReservations]);
      const details=[...landmarkDetails,...wildernessDetails];
  return {trees,details};
}
