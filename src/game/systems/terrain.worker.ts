import {TerrainBaker} from './TerrainBaker';
import {WorldGenerator} from './WorldGenerator';
import {planChunkScenerySteps} from './chunkSceneryPlan';
import {CHUNK_SIZE} from '../../data/world';
import type {TerrainRequest,TerrainReply} from './TerrainBakeProtocol';

interface TerrainWorkerScope {
  onmessage:((event:MessageEvent<TerrainRequest>)=>void)|null;
  postMessage:(message:TerrainReply,transfer?:Transferable[])=>void;
}
const scope=self as unknown as TerrainWorkerScope;
const world=new WorldGenerator();let baker:TerrainBaker|undefined;
scope.onmessage=({data})=>{
  let bitmap:ImageBitmap|undefined;
  try{
    if(data.kind==='init'){baker=new TerrainBaker(data.resources);scope.postMessage({kind:'ready'});return;}
    if(!baker)throw new Error('Terrain worker is not ready');
    const canvas=new OffscreenCanvas(data.pixels,data.pixels),context=canvas.getContext('2d');
    if(!context)throw new Error('Worker canvas is unavailable');
    const scale=data.pixels/CHUNK_SIZE;context.setTransform(scale,0,0,scale,0,0);
    baker.draw(context,world,data.x,data.y);
    const steps=planChunkScenerySteps(world,data.x,data.y);
    let result=steps.next();while(!result.done)result=steps.next();
    bitmap=canvas.transferToImageBitmap();
    scope.postMessage({kind:'result',id:data.id,bitmap,plan:result.value},[bitmap]);
    bitmap=undefined;
  }catch(error){bitmap?.close();scope.postMessage({kind:'error',id:data.kind==='bake'?data.id:0,message:String(error)});}
};
