import {DataTexture,FloatType,NearestFilter,RedFormat,Vector4} from 'three';
import {CHUNK_SIZE} from '../../data/world';
import {TerrainHeightField,ELEVATION_CELL_SIZE} from '../systems/TerrainHeightField';

export {ELEVATION_CELL_SIZE} from '../systems/TerrainHeightField';
export const TERRAIN_GRID_SEGMENTS=CHUNK_SIZE/ELEVATION_CELL_SIZE;
const CELL=ELEVATION_CELL_SIZE,TEXTURE_SIZE=129;
/** One bounded, shared height field for terrain, decals and sprite feet. The
 * illustrated terrain still supplies every visible ground pixel. */
/** A camera-rotation-independent field. A square centered on the player
 * covers the entire 2,400-unit visible radius in every viewing direction.
 * Initial and subsequent views prepare a complete second buffer incrementally:
 * terrain never sees half-written samples or a moving view-edge clamp. */
export class ElevationField {
  private field=new TerrainHeightField();
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
  setSource(sample:(x:number,y:number)=>number,field?:TerrainHeightField){
    if(this.sample===sample&&(!field||this.field===field))return;
    this.sample=sample;this.field=field??new TerrainHeightField(sample);this.left=this.centerX=this.centerY=Infinity;
    this.columns=0;this.pending=undefined;
  }
  get initialized(){return this.columns>0;}
  private vertex(x:number,y:number){
    return this.field.vertex(x,y);
  }
  height(x:number,y:number){
    return this.field.height(x,y);
  }
  readyAt(point:{x:number;y:number}){
    return this.columns>0&&Math.abs(point.x-this.centerX)<=1024&&Math.abs(point.y-this.centerY)<=1024;
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
    // Initial terrain uses the same bounded job as later travel. The renderer
    // keeps startup covered until a complete buffer has actually been drawn.
    // Rotation cannot move the texture; only meaningful player travel does.
    // Half-extent is 4,096 units, with >1,400 units beyond the view radius.
    if(this.initialized&&Math.abs(point.x-this.centerX)<=1024&&Math.abs(point.y-this.centerY)<=1024){
      this.pending=undefined;return;
    }
    // Teleporting again must not finish/publish an obsolete region first.
    if(this.pending){
      if(this.pending.centerX===target.x&&this.pending.centerY===target.y)return;
      this.pending.steps.return();this.pending=undefined;
    }
    if(target.x===this.centerX&&target.y===this.centerY)return;
    const half=(TEXTURE_SIZE-1)*CELL/2,pixels=new Float32Array(this.pixels.length);
    this.pending={centerX:target.x,centerY:target.y,left:target.x-half,top:target.y-half,
      pixels,steps:this.build(target.x-half,target.y-half,pixels)};
  }
  /** One short, measured slice after presentation; expensive height queries
   * never rebuild a texture synchronously in response to yaw or pitch. */
  preload(_bounds:{left:number;top:number;right:number;bottom:number},enabled:boolean,budgetMs:number){
    if(!enabled){this.pending=undefined;return;}
    const job=this.pending;if(!job||budgetMs<=0)return;
    const deadline=performance.now()+budgetMs;
    for(let i=0;i<64;i++){
      if(job.steps.next().done){
        this.publish(job.centerX,job.centerY,job.pixels);
        this.pending=undefined;break;
      }
      if(performance.now()>=deadline)break;
    }
  }
  destroy(){this.pending=undefined;this.texture.dispose();}
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
