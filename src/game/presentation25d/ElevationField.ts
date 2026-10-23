import {DataTexture,FloatType,NearestFilter,RedFormat,Vector4} from 'three';
import {CHUNK_SIZE} from '../../data/world';

export const ELEVATION_CELL_SIZE=64;
export const TERRAIN_GRID_SEGMENTS=CHUNK_SIZE/ELEVATION_CELL_SIZE;
const CELL=ELEVATION_CELL_SIZE,TEXTURE_SIZE=129,LIMIT=TEXTURE_SIZE*TEXTURE_SIZE*2;
/** One bounded, shared height field for terrain, decals and sprite feet. The
 * illustrated terrain still supplies every visible ground pixel. */
/** A camera-rotation-independent field. A square centered on the player
 * covers the entire 2,400-unit visible radius in every viewing direction.
 * Subsequent center changes prepare a complete second buffer incrementally:
 * terrain never sees half-written samples or a moving view-edge clamp. */
export class ElevationField {
  private readonly samples=new Map<number,number>();
  private readonly pixels=new Float32Array(TEXTURE_SIZE*TEXTURE_SIZE);
  private sample:(x:number,y:number)=>number=()=>0;
  private left=Infinity;private top=Infinity;private columns=0;
  private centerX=Infinity;private centerY=Infinity;
  private pending:{
    centerX:number;centerY:number;left:number;top:number;
    pixels:Float32Array;steps:Generator<void,void>
  }|undefined;
  readonly texture=new DataTexture(this.pixels,TEXTURE_SIZE,TEXTURE_SIZE,RedFormat,FloatType);
  readonly uniforms={heightMap:{value:this.texture},heightBounds:{value:new Vector4(0,0,CELL,CELL)},heightEnabled:{value:false}};
  constructor(){this.texture.minFilter=this.texture.magFilter=NearestFilter;this.texture.generateMipmaps=false;this.texture.needsUpdate=true;}
  setSource(sample:(x:number,y:number)=>number){
    if(this.sample===sample)return;
    this.sample=sample;this.samples.clear();this.left=this.centerX=this.centerY=Infinity;
    this.columns=0;this.pending=undefined;
  }
  private vertex(x:number,y:number){
    const key=x*1048576+y,old=this.samples.get(key);if(old!==undefined)return old;
    const value=Math.fround(this.sample(x*CELL,y*CELL));
    if(this.samples.size>=LIMIT)this.samples.delete(this.samples.keys().next().value!);
    this.samples.set(key,value);return value;
  }
  height(x:number,y:number){
    const gx=Math.floor(x/CELL),gy=Math.floor(y/CELL),u=x/CELL-gx,v=y/CELL-gy;
    const a=this.vertex(gx,gy),b=this.vertex(gx+1,gy),c=this.vertex(gx,gy+1),d=this.vertex(gx+1,gy+1);
    return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
  }
  private center(focus:{x:number;y:number}){
    return {x:Math.round(focus.x/CHUNK_SIZE)*CHUNK_SIZE,y:Math.round(focus.y/CHUNK_SIZE)*CHUNK_SIZE};
  }
  private publish(centerX:number,centerY:number,pixels:Float32Array){
    this.pixels.set(pixels);
    const half=(TEXTURE_SIZE-1)*CELL/2;
    this.left=centerX-half;this.top=centerY-half;
    this.centerX=centerX;this.centerY=centerY;
    this.columns=TEXTURE_SIZE;
    this.uniforms.heightBounds.value.set(this.left,this.top,(TEXTURE_SIZE-1)*CELL,(TEXTURE_SIZE-1)*CELL);
    this.texture.needsUpdate=true;
  }
  private *build(left:number,top:number,pixels:Float32Array):Generator<void,void>{
    const gx=left/CELL,gy=top/CELL;
    for(let y=0;y<TEXTURE_SIZE;y++){
      for(let x=0;x<TEXTURE_SIZE;x++){
        pixels[y*TEXTURE_SIZE+x]=this.vertex(gx+x,gy+y);
        if((x&15)===15)yield;
      }
      yield;
    }
  }
  prepare(bounds:{left:number;top:number;right:number;bottom:number},enabled:boolean,focus?:{x:number;y:number}){
    this.uniforms.heightEnabled.value=enabled;
    if(!enabled){this.pending=undefined;return;}
    const point=focus??{x:(bounds.left+bounds.right)/2,y:(bounds.top+bounds.bottom)/2};
    const target=this.center(point);
    if(this.columns===0){
      // First frame is normally covered by the initial scene transition.
      const half=(TEXTURE_SIZE-1)*CELL/2,pixels=new Float32Array(this.pixels.length);
      const steps=this.build(target.x-half,target.y-half,pixels);
      while(!steps.next().done){ /* Initial terrain needs a complete first buffer. */ }
      this.publish(target.x,target.y,pixels);
      return;
    }
    // Rotation cannot move the texture; only meaningful player travel does.
    // Half-extent is 4,096 units, with >1,400 units beyond the view radius.
    if(Math.abs(point.x-this.centerX)<=1024&&Math.abs(point.y-this.centerY)<=1024){
      this.pending=undefined;return;
    }
    if(this.pending)return;
    if(target.x===this.centerX&&target.y===this.centerY)return;
    const half=(TEXTURE_SIZE-1)*CELL/2,pixels=new Float32Array(this.pixels.length);
    this.pending={centerX:target.x,centerY:target.y,left:target.x-half,top:target.y-half,
      pixels,steps:this.build(target.x-half,target.y-half,pixels)};
  }
  /** One short, measured slice after presentation; expensive height queries
   * never rebuild a texture synchronously in response to yaw or pitch. */
  preload(_bounds:{left:number;top:number;right:number;bottom:number},enabled:boolean,budgetMs:number){
    if(!enabled){this.pending=undefined;return;}
    const job=this.pending;if(!job)return;
    const deadline=performance.now()+budgetMs;
    for(let i=0;i<64;i++){
      if(job.steps.next().done){
        this.publish(job.centerX,job.centerY,job.pixels);
        this.pending=undefined;break;
      }
      if(performance.now()>=deadline)break;
    }
  }
  destroy(){this.pending=undefined;this.texture.dispose();this.samples.clear();}
}

export const elevationShader=`
uniform sampler2D heightMap;
uniform vec4 heightBounds;
uniform bool heightEnabled;
float groundHeight(vec2 p){
  if(!heightEnabled)return 0.0;
  vec2 size=heightBounds.zw/${CELL.toFixed(1)}+1.0;
  vec2 cell=clamp((p-heightBounds.xy)/${CELL.toFixed(1)},vec2(0.0),size-1.001);
  vec2 base=floor(cell),f=fract(cell);
  float a=texture2D(heightMap,(base+0.5)/${TEXTURE_SIZE.toFixed(1)}).r;
  float b=texture2D(heightMap,(base+vec2(1.5,0.5))/${TEXTURE_SIZE.toFixed(1)}).r;
  float c=texture2D(heightMap,(base+vec2(0.5,1.5))/${TEXTURE_SIZE.toFixed(1)}).r;
  float d=texture2D(heightMap,(base+1.5)/${TEXTURE_SIZE.toFixed(1)}).r;
  return f.x+f.y<=1.0?a+(b-a)*f.x+(c-a)*f.y:d+(c-d)*(1.0-f.x)+(b-d)*(1.0-f.y);
}
`;
