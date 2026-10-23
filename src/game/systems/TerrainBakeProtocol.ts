import type {TerrainBakeResources} from './TerrainBaker';
import type {ChunkSceneryPlan} from './chunkSceneryPlan';
export type TerrainRequest={kind:'init';resources:TerrainBakeResources}|{kind:'bake';id:number;x:number;y:number;pixels:number};
export type TerrainReply={kind:'ready'}|{kind:'result';id:number;bitmap:ImageBitmap;plan:ChunkSceneryPlan}|{kind:'error';id:number;message:string};
export function resourceBitmaps(resources:TerrainBakeResources){
  const images=new Set<ImageBitmap>();
  for(const source of resources.patternImages)if(source instanceof ImageBitmap)images.add(source);
  for(const [,art] of resources.cover)if(art.source instanceof ImageBitmap)images.add(art.source);
  return [...images];
}
