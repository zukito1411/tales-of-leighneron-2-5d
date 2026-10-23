import {DataTexture,FloatType,NearestFilter,RedFormat,Vector4} from 'three';
import {CHUNK_SIZE} from '../../data/world';

export const ELEVATION_CELL_SIZE=64;
export const TERRAIN_GRID_SEGMENTS=CHUNK_SIZE/ELEVATION_CELL_SIZE;
const CELL=ELEVATION_CELL_SIZE,TEXTURE_SIZE=129,LIMIT=TEXTURE_SIZE*TEXTURE_SIZE*2;
/** One bounded, shared height field for terrain, decals and sprite feet. The
 * illustrated terrain still supplies every visible ground pixel. */
export class ElevationField {
  private readonly samples=new Map<number,number>();
  private readonly pixels=new Float32Array(TEXTURE_SIZE*TEXTURE_SIZE);
  private sample:(x:number,y:number)=>number=()=>0;
  private left=Infinity;private top=Infinity;private columns=0;private rows=0;
  private preloadKey='';private preloading:Generator<void>|undefined;
  // WebGL allocates immutable texture storage on first upload. Changing image
  // dimensions later leaves the old allocation behind; only contents may move.
  readonly texture=new DataTexture(this.pixels,TEXTURE_SIZE,TEXTURE_SIZE,RedFormat,FloatType);
  readonly uniforms={heightMap:{value:this.texture},heightBounds:{value:new Vector4(0,0,CELL,CELL)},heightEnabled:{value:false}};
  constructor(){this.texture.minFilter=this.texture.magFilter=NearestFilter;this.texture.generateMipmaps=false;this.texture.needsUpdate=true;}
  setSource(sample:(x:number,y:number)=>number){if(this.sample===sample)return;this.sample=sample;this.samples.clear();this.left=Infinity;this.preloading=undefined;this.preloadKey='';}
  private vertex(x:number,y:number){
    const key=x*1048576+y,old=this.samples.get(key);if(old!==undefined)return old;
    // Feet and GPU vertices use the same float samples and triangle diagonal.
    const value=Math.fround(this.sample(x*CELL,y*CELL));
    if(this.samples.size>=LIMIT)this.samples.delete(this.samples.keys().next().value!);
    this.samples.set(key,value);return value;
  }
  height(x:number,y:number){
    const gx=Math.floor(x/CELL),gy=Math.floor(y/CELL),u=x/CELL-gx,v=y/CELL-gy;
    const a=this.vertex(gx,gy),b=this.vertex(gx+1,gy),c=this.vertex(gx,gy+1),d=this.vertex(gx+1,gy+1);
    // Match the ground grid's triangle diagonal, rather than a different
    // bilinear floor that could leave feet hovering above its triangles.
    return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
  }
  prepare(bounds:{left:number;top:number;right:number;bottom:number},enabled:boolean){
    this.uniforms.heightEnabled.value=enabled;if(!enabled)return;
    // Cover complete terrain chunks, including the vertices just outside the
    // camera footprint. Clamping those vertices to a moving viewport edge
    // would deform a chunk's slopes as the camera moved. The bounded 2,400-unit
    // view fits at most five chunks per axis plus this one-cell gutter.
    const left=Math.floor((bounds.left-192)/CHUNK_SIZE)*CHUNK_SIZE-CELL;
    const top=Math.floor((bounds.top-192)/CHUNK_SIZE)*CHUNK_SIZE-CELL;
    const right=Math.ceil((bounds.right+192)/CHUNK_SIZE)*CHUNK_SIZE+CELL;
    const bottom=Math.ceil((bounds.bottom+192)/CHUNK_SIZE)*CHUNK_SIZE+CELL;
    if(left>=this.left&&top>=this.top
      &&right<=this.left+(this.columns-1)*CELL&&bottom<=this.top+(this.rows-1)*CELL)return;
    const columns=Math.min(TEXTURE_SIZE,Math.round((right-left)/CELL)+1);
    const rows=Math.min(TEXTURE_SIZE,Math.round((bottom-top)/CELL)+1);
    for(let y=0;y<rows;y++)for(let x=0;x<columns;x++)this.pixels[y*TEXTURE_SIZE+x]=this.vertex(left/CELL+x,top/CELL+y);
    this.left=left;this.top=top;this.columns=columns;this.rows=rows;
    this.texture.needsUpdate=true;
    this.uniforms.heightBounds.value.set(left,top,(columns-1)*CELL,(rows-1)*CELL);
  }
  /** Prepare only a bounded margin of the actual camera footprint. Exact
   * heights are cached ahead of coverage changes, without moving GPU terrain
   * or publishing a partially sampled surface. No background loop is added. */
  preload(bounds:{left:number;top:number;right:number;bottom:number},enabled:boolean,budgetMs:number){
    if(!enabled){this.preloading=undefined;this.preloadKey='';return;}
    const left=Math.floor((bounds.left-512)/CHUNK_SIZE)*CHUNK_SIZE/CELL-1;
    const top=Math.floor((bounds.top-512)/CHUNK_SIZE)*CHUNK_SIZE/CELL-1;
    const right=Math.ceil((bounds.right+512)/CHUNK_SIZE)*CHUNK_SIZE/CELL+1;
    const bottom=Math.ceil((bounds.bottom+512)/CHUNK_SIZE)*CHUNK_SIZE/CELL+1;
    const key=left+':'+top+':'+right+':'+bottom;
    if(key!==this.preloadKey){
      this.preloadKey=key;
      this.preloading=this.warm(left,top,Math.min(right,left+TEXTURE_SIZE-1),Math.min(bottom,top+TEXTURE_SIZE-1));
    }
    const job=this.preloading;if(!job)return;
    const deadline=performance.now()+budgetMs;
    for(let steps=0;steps<64;steps++){
      if(job.next().done){this.preloading=undefined;break;}
      if(performance.now()>=deadline)break;
    }
  }
  private *warm(left:number,top:number,right:number,bottom:number):Generator<void>{
    for(let y=top;y<=bottom;y++){
      for(let x=left;x<=right;x++)if(!this.samples.has(x*1048576+y)){this.vertex(x,y);yield;}
      yield;
    }
  }
  destroy(){this.preloading=undefined;this.preloadKey='';this.texture.dispose();this.samples.clear();}
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
