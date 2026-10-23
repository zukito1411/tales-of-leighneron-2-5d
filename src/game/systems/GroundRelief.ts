import {createNoise2D} from 'simplex-noise';
import {seededRandom} from '../../utils/seededRandom';
import {CHUNK_SIZE,TILE_SIZE} from '../../data/world';
import {REGION_SCENERY} from '../../data/regionScenery';
import {TERRAIN_MASK_SIZE} from './terrainArt';
import type {WorldGenerator} from './WorldGenerator';

const hills=createNoise2D(seededRandom('mernondna:upland-contours'));
/** World-space hill light/valley shade baked once with the chunk. This is
 * painted relief, not false 3D elevation or new invisible cliff collision. */
export function drawGroundRelief(ctx:CanvasRenderingContext2D,mask:HTMLCanvasElement,world:WorldGenerator,chunkX:number,chunkY:number,terrain:Uint8Array){
  const steps=drawGroundReliefSteps(ctx,mask,world,chunkX,chunkY,terrain);while(!steps.next().done){/* Synchronous callers only. */}
}
export function* drawGroundReliefSteps(ctx:CanvasRenderingContext2D,mask:HTMLCanvasElement,world:WorldGenerator,chunkX:number,chunkY:number,terrain:Uint8Array):Generator<void,void>{
  const m=mask.getContext('2d')!,pixels=m.createImageData(TERRAIN_MASK_SIZE,TERRAIN_MASK_SIZE);
  for(let row=0;row<TERRAIN_MASK_SIZE;row++){
  yield;
  for(let col=0;col<TERRAIN_MASK_SIZE;col++){
    const cell=row*TERRAIN_MASK_SIZE+col,kind=terrain[cell];
    if(![0,4,5,6,8,9].includes(kind))continue; // Preserve paving, crops, sea and lava.
    const x=chunkX*CHUNK_SIZE+(col-.5)*TILE_SIZE,y=chunkY*CHUNK_SIZE+(row-.5)*TILE_SIZE;
    const region=world.getRegionAt(x,y),profile=REGION_SCENERY[region];
    const height=hills(x*.0007,y*.0007),dx=hills((x+64)*.0007,y*.0007)-height,dy=hills(x*.0007,(y+64)*.0007)-height;
    const upland=region==='nardorous'||region==='druganwoods';
    const shade=Math.max(-1,Math.min(1,height*.45-(dx+dy)*(upland?3.4:1.2)));
    const color=shade<-.05?(region==='darkav'?'#351610':'#22342d'):profile.groundTint;
    pixels.data[cell*4]=parseInt(color.slice(1,3),16);pixels.data[cell*4+1]=parseInt(color.slice(3,5),16);pixels.data[cell*4+2]=parseInt(color.slice(5,7),16);
    pixels.data[cell*4+3]=Math.round(8+Math.abs(shade)*(upland?48:27));
  }}
  m.putImageData(pixels,0,0);ctx.save();ctx.imageSmoothingEnabled=true;
  ctx.drawImage(mask,-TILE_SIZE,-TILE_SIZE,TERRAIN_MASK_SIZE*TILE_SIZE,TERRAIN_MASK_SIZE*TILE_SIZE);ctx.restore();
}
