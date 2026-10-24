import {WorldGenerator} from './WorldGenerator';
import {MINI_TERRAIN_COLORS,WATER_CELL_SIZE,type GeographyMessage,type GeographyReply} from './GeographyProtocol';
import {WORLD_WIDTH,WORLD_HEIGHT} from '../../data/world';

interface GeographyScope {
  onmessage:((event:MessageEvent<GeographyMessage>)=>void)|null;
  postMessage:(message:GeographyReply,transfer?:Transferable[])=>void;
}
const scope=self as unknown as GeographyScope,world=new WorldGenerator();
scope.onmessage=({data})=>{
  let bitmap:ImageBitmap|undefined;
  try{
    const canvas=new OffscreenCanvas(data.pixels,data.pixels),ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('Geography canvas unavailable');
    const count=data.kind==='water'?data.extent/WATER_CELL_SIZE:48,cell=data.extent/count,pixel=data.pixels/count;
    let hasWater=false;
    for(let row=0;row<count;row++)for(let col=0;col<count;col++){
      const x=data.x+(col+.5)*cell,y=data.y+(row+.5)*cell;
      const terrain=x<0||y<0||x>=WORLD_WIDTH||y>=WORLD_HEIGHT?'water':data.kind==='water'?world.getGroundTerrainAt(x,y):world.getTerrainAt(x,y);
      if(data.kind==='water'){
        if(terrain!=='water')continue;
        ctx.fillStyle='#fff';hasWater=true;
      }else ctx.fillStyle=MINI_TERRAIN_COLORS[terrain];
      ctx.fillRect(col*pixel,row*pixel,Math.ceil(pixel),Math.ceil(pixel));
    }
    bitmap=canvas.transferToImageBitmap();scope.postMessage({id:data.id,bitmap,hasWater},[bitmap]);bitmap=undefined;
  }catch(error){bitmap?.close();scope.postMessage({id:data.id,error:String(error)});}
};
