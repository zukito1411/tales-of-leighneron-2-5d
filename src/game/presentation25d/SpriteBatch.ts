import {
  AdditiveBlending,BufferAttribute,DoubleSide,DynamicDrawUsage,InstancedBufferAttribute,
  InstancedMesh,Matrix4,NormalBlending,PlaneGeometry,Scene,ShaderMaterial,Texture,Vector4,Vector2,Color,type BufferGeometry,
} from 'three';
import {elevationShader,TERRAIN_GRID_SEGMENTS,type ElevationField} from './ElevationField';
import type Phaser from 'phaser';
export interface DistanceAtmosphere {
  fogFocus:{value:import('three').Vector2};fogColor:{value:import('three').Color};fogRange:{value:import('three').Vector2};
}

interface LocalRect {left:number;top:number;width:number;height:number}
interface PickEntry {object:Phaser.GameObjects.GameObject|undefined;rect:LocalRect}
// Phaser tint bytes are sRGB; shared Three textures are sampled in linear light.
// Cache the conversion once rather than applying powers to every fragment.
const LINEAR_TINT=Float32Array.from({length:256},(_,i)=>{const value=i/255;return value<=.04045?value/12.92:Math.pow((value+.055)/1.055,2.4);});

const vertexShader=`
attribute vec4 atlasRect;
attribute vec4 instanceTint;
attribute vec4 instanceTintTR;
attribute vec4 instanceTintBL;
attribute vec4 instanceTintBR;
attribute vec4 tileRepeat;
uniform bool groundSurface;
uniform bool architecture;
varying vec2 localUV;
varying vec4 effectData;
varying vec2 repeatUV;
varying vec4 frameRect;
${elevationShader}
varying vec2 atlasUV;
varying vec4 tint;
varying vec2 groundPosition;
varying float sourceY;
varying float shadowBottom;
void main(){
  localUV=uv;effectData=tileRepeat;
  sourceY=1.0-uv.y;
  shadowBottom=tileRepeat.x;
  atlasUV=atlasRect.xy+uv*atlasRect.zw;
  repeatUV=uv*tileRepeat.xy+tileRepeat.zw;frameRect=atlasRect;
  tint=mix(mix(instanceTintBL,instanceTintBR,uv.x),mix(instanceTint,instanceTintTR,uv.x),uv.y);
  vec4 world=instanceMatrix*vec4(position,1.0);
  if(architecture){
    mat3 basis=mat3(instanceMatrix);
    vec3 n=normalize(basis*(normal/vec3(dot(basis[0],basis[0]),dot(basis[1],basis[1]),dot(basis[2],basis[2]))));
    tint.rgb*=0.78+0.22*max(0.0,dot(n,normalize(vec3(-0.4,0.85,0.3))));
  }
  groundPosition=world.xz;
  if(groundSurface)world.y+=groundHeight(world.xz);
  gl_Position=projectionMatrix*viewMatrix*world;
}`;
const fragmentShader=`
uniform sampler2D atlas;
uniform bool fillTint;
uniform bool tiled;
uniform bool shadow;
uniform bool fadeOnly;
uniform bool telegraph;
varying vec2 localUV;
varying vec4 effectData;
uniform vec2 atlasTexel;
uniform vec2 fogFocus;
uniform vec3 fogColor;
uniform vec2 fogRange;
varying float sourceY;
varying float shadowBottom;
varying vec2 repeatUV;
varying vec4 frameRect;
varying vec2 atlasUV;
varying vec4 tint;
varying vec2 groundPosition;
uniform int clipCount;
uniform vec4 clipRects[16];
float warningDistance(vec2 p,float radius){
  float shape=frameRect.x;
  if(shape<.5)return length(p)-radius;
  if(shape<1.5)return max(length(p)-radius,frameRect.w-length(p));
  if(shape<2.5)return length(vec2(p.x-clamp(p.x,0.0,frameRect.z),p.y))-radius;
  float angle=abs(atan(p.y,p.x))-effectData.y;
  float edge=sin(clamp(angle,-1.5707963,1.5707963))*length(p);
  return max(edge,effectData.z>.5?max(-p.x,p.x-radius*cos(effectData.y)):length(p)-radius);
}
vec4 warningPixel(){
  float r=frameRect.y,range=frameRect.x>1.5&&frameRect.x<2.5?frameRect.z:0.0;
  vec2 p=vec2(mix(-r-3.0,range+r+3.0,localUV.x),(0.5-localUV.y)*(r*2.0+6.0));
  float d=warningDistance(p,r),aa=max(.45,fwidth(d));
  float inside=1.0-smoothstep(-aa,aa,d);
  float boundary=1.0-smoothstep(1.0,2.0+aa,abs(d));
  float progress=effectData.x,fill=0.0;
  if(frameRect.x<1.5){
    float turn=fract(atan(p.x,-p.y)/6.2831853+1.0);
    fill=step(turn,progress)*inside;
  }else if(frameRect.x<2.5){
    float traveled=length(vec2(p.x-clamp(p.x,0.0,frameRect.z*progress),p.y))-r;
    fill=(1.0-smoothstep(-aa,aa,traveled))*inside;
  }else fill=(1.0-smoothstep(-aa,aa,warningDistance(p,r*progress)))*inside;
  fill*=step(.0001,progress);
  vec3 color=progress>=.95?mix(tint.rgb,vec3(1.0,.822,.631),boundary):tint.rgb;
  return vec4(color,max(boundary*.85,inside*.07+fill*(.22+progress*.16)));
}
void main(){
  if(clipCount>0){
    bool inside=false;
    for(int i=0;i<16;i++){
      if(i>=clipCount)break;
      vec4 r=clipRects[i];
      if(groundPosition.x>=r.x&&groundPosition.y>=r.y&&groundPosition.x<=r.z&&groundPosition.y<=r.w)inside=true;
    }
    if(!inside)discard;
  }
  vec4 pixel=telegraph?warningPixel():texture2D(atlas,tiled?frameRect.xy+fract(repeatUV)*frameRect.zw:atlasUV);
  if(shadow){
    vec2 lo=min(frameRect.xy,frameRect.xy+frameRect.zw),hi=max(frameRect.xy,frameRect.xy+frameRect.zw);
    vec2 t=atlasTexel*2.0;
    pixel.a=pixel.a*0.4+(texture2D(atlas,clamp(atlasUV+vec2(t.x,0.0),lo,hi)).a
      +texture2D(atlas,clamp(atlasUV-vec2(t.x,0.0),lo,hi)).a
      +texture2D(atlas,clamp(atlasUV+vec2(0.0,t.y),lo,hi)).a
      +texture2D(atlas,clamp(atlasUV-vec2(0.0,t.y),lo,hi)).a)*0.15;
    if(shadowBottom<0.999)pixel.a*=1.0-smoothstep(max(0.0,shadowBottom-0.025),shadowBottom,sourceY);
  }
  if(!telegraph)pixel.rgb=fillTint?tint.rgb:pixel.rgb*tint.rgb;
  pixel.a*=tint.a;
  float haze=fogRange.y>0.0?smoothstep(fogRange.x,fogRange.y,distance(groundPosition,fogFocus)):0.0;
  if(shadow||fadeOnly)pixel.a*=1.0-haze;
  else pixel.rgb=mix(pixel.rgb,fogColor,haze);
  if(pixel.a<(shadow?0.001:0.025))discard;
  gl_FragColor=pixel;
  #include <colorspace_fragment>
}`;

/** One instanced draw per source atlas / blend / layer. No texture per pose. */
export class SpriteBatch {
  mesh:InstancedMesh;
  private capacity=32;
  private used=0;
  private readonly material:ShaderMaterial;
  private atlas:InstancedBufferAttribute;
  private tint:InstancedBufferAttribute;
  private tintTR:InstancedBufferAttribute;
  private tintBL:InstancedBufferAttribute;
  private tintBR:InstancedBufferAttribute;
  private repeat:InstancedBufferAttribute;
  private readonly segments:number;
  private readonly dirtyStart=new Int32Array(7);
  private readonly dirtyEnd=new Int32Array(7);
  private attributes:BufferAttribute[]=[];
  lastUsed=0;
  interactive=false;
  readonly objects:PickEntry[]=[];
  private readonly slots:PickEntry[]=[];

  constructor(private readonly scene:Scene,texture:Texture,additive:boolean,overlay:boolean,order:number,clips:readonly Vector4[]=[],fillTint=false,opaque=false,depthWrite=!overlay&&!additive,ground=false,tiled=false,elevation?:ElevationField,terrain:boolean|number=false,atmosphere?:DistanceAtmosphere,shadow=false,telegraph=false,private readonly geometryFactory?:()=>BufferGeometry){
    const image=texture.image as {width?:number;height?:number}|undefined;
    this.material=new ShaderMaterial({uniforms:{...elevation?.uniforms,fogFocus:{value:new Vector2()},fogColor:{value:new Color()},fogRange:{value:new Vector2()},...atmosphere,atlas:{value:texture},fillTint:{value:fillTint},tiled:{value:tiled},shadow:{value:shadow},telegraph:{value:telegraph},architecture:{value:Boolean(geometryFactory)&&!shadow},fadeOnly:{value:additive||ground&&!opaque},atlasTexel:{value:new Vector2(1/Math.max(1,image?.width??1),1/Math.max(1,image?.height??1))},groundSurface:{value:ground},clipCount:{value:clips.length},
      clipRects:{value:Array.from({length:16},(_,i)=>clips[i]??new Vector4())}},vertexShader,fragmentShader,
      transparent:!opaque,depthTest:!overlay,depthWrite,side:DoubleSide,forceSinglePass:true,
      polygonOffset:ground&&!opaque,polygonOffsetFactor:-1,polygonOffsetUnits:-2,
      blending:additive?AdditiveBlending:NormalBlending});
    this.segments=typeof terrain==='number'?terrain:terrain?TERRAIN_GRID_SEGMENTS:ground?(shadow?8:4):1;
    const geometry=this.createGeometry();
    this.atlas=new InstancedBufferAttribute(new Float32Array(this.capacity*4),4).setUsage(DynamicDrawUsage);
    this.tint=new InstancedBufferAttribute(new Float32Array(this.capacity*4),4).setUsage(DynamicDrawUsage);
    const makeTint=()=>new InstancedBufferAttribute(new Float32Array(this.capacity*4),4).setUsage(DynamicDrawUsage);
    this.tintTR=makeTint();this.tintBL=makeTint();this.tintBR=makeTint();
    this.repeat=makeTint();geometry.setAttribute('tileRepeat',this.repeat);
    geometry.setAttribute('atlasRect',this.atlas);geometry.setAttribute('instanceTint',this.tint);
    geometry.setAttribute('instanceTintTR',this.tintTR);geometry.setAttribute('instanceTintBL',this.tintBL);geometry.setAttribute('instanceTintBR',this.tintBR);
    this.mesh=new InstancedMesh(geometry,this.material,this.capacity);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);this.mesh.frustumCulled=false;this.mesh.renderOrder=order;
    this.mesh.userData.batch=this;this.mesh.userData.presentationOccluder=Boolean(geometryFactory)&&!shadow;scene.add(this.mesh);
    this.bindAttributes();this.begin();
  }
  begin(){this.used=0;this.interactive=false;this.dirtyStart.fill(2147483647);this.dirtyEnd.fill(-1);}
  add(matrix:Matrix4,uv:ArrayLike<number>,colors:ArrayLike<number>,alpha:number,object:Phaser.GameObjects.GameObject,rect:LocalRect,frame:number,repeat?:ArrayLike<number>){
    if(this.used===this.capacity)this.grow();
    const slot=this.used++;
    if(object.input?.enabled)this.interactive=true;
    const data=this.mesh.instanceMatrix.array,elements=matrix.elements,offset=slot*16;
    let changed=false;
    for(let i=0;i<16;i++){const value=Math.fround(elements[i]);if(data[offset+i]!==value){data[offset+i]=value;changed=true;}}
    if(changed)this.mark(0,slot);
    this.write4(this.atlas,1,slot,uv[0],uv[1],uv[2],uv[3]);
    this.write4(this.repeat,6,slot,repeat?.[0]??1,repeat?.[1]??1,repeat?.[2]??0,repeat?.[3]??0);
    this.writeTint(this.tint,2,slot,colors[0],alpha);this.writeTint(this.tintTR,3,slot,colors[1],alpha);
    this.writeTint(this.tintBL,4,slot,colors[2],alpha);this.writeTint(this.tintBR,5,slot,colors[3],alpha);
    let entry=this.slots[slot];
    if(!entry){entry={object,rect:{left:0,top:0,width:0,height:0}};this.slots[slot]=entry;}
    this.objects[slot]=entry;
    entry.object=object;entry.rect.left=rect.left;entry.rect.top=rect.top;entry.rect.width=rect.width;entry.rect.height=rect.height;
    this.lastUsed=frame;
    return slot;
  }
  private mark(index:number,slot:number){this.dirtyStart[index]=Math.min(this.dirtyStart[index],slot);this.dirtyEnd[index]=Math.max(this.dirtyEnd[index],slot+1);}
  private write4(attribute:InstancedBufferAttribute,index:number,slot:number,x:number,y:number,z:number,w:number){
    x=Math.fround(x);y=Math.fround(y);z=Math.fround(z);w=Math.fround(w);
    const data=attribute.array,offset=slot*4;
    if(data[offset]===x&&data[offset+1]===y&&data[offset+2]===z&&data[offset+3]===w)return;
    attribute.setXYZW(slot,x,y,z,w);this.mark(index,slot);
  }
  private writeTint(attribute:InstancedBufferAttribute,index:number,slot:number,color:number,alpha:number){this.write4(attribute,index,slot,LINEAR_TINT[(color>>>16)&255],LINEAR_TINT[(color>>>8)&255],LINEAR_TINT[color&255],alpha);}
  finish(){
    const countChanged=this.mesh.count!==this.used;
    this.mesh.count=this.used;this.mesh.visible=this.used>0;
    // Keep bounded slot/rectangle storage when view-edge instances disappear,
    // but release their actor references rather than retaining unloaded scenes.
    for(let i=this.used;i<this.objects.length;i++)this.objects[i].object=undefined;
    this.objects.length=this.used;
    if(!this.used)return;
    const attributes=this.attributes;
    for(let i=0;i<attributes.length;i++){
      const start=this.dirtyStart[i],end=this.dirtyEnd[i];if(end<0)continue;
      const attribute=attributes[i];
      attribute.clearUpdateRanges();attribute.addUpdateRange(start*attribute.itemSize,(end-start)*attribute.itemSize);attribute.needsUpdate=true;
    }
    // Raycasting uses the current instance transforms after actors move.
    if(countChanged||this.dirtyEnd[0]>=0)this.mesh.boundingSphere=null;
  }
  private bindAttributes(){this.attributes=[this.mesh.instanceMatrix,this.atlas,this.tint,this.tintTR,this.tintBL,this.tintBR,this.repeat];}
  private createGeometry(){return this.geometryFactory?.()??new PlaneGeometry(1,1,this.segments,this.segments);}
  private grow(){
    const previous=this.mesh,capacity=this.capacity*2,geometry=this.createGeometry();
    const atlas=new Float32Array(capacity*4),tint=new Float32Array(capacity*4);
    atlas.set(this.atlas.array);tint.set(this.tint.array);
    this.atlas=new InstancedBufferAttribute(atlas,4).setUsage(DynamicDrawUsage);
    this.tint=new InstancedBufferAttribute(tint,4).setUsage(DynamicDrawUsage);
    const growTint=(previous:InstancedBufferAttribute)=>{
      const data=new Float32Array(capacity*4);data.set(previous.array);
      return new InstancedBufferAttribute(data,4).setUsage(DynamicDrawUsage);
    };
    this.tintTR=growTint(this.tintTR);this.tintBL=growTint(this.tintBL);this.tintBR=growTint(this.tintBR);
    this.repeat=growTint(this.repeat);geometry.setAttribute('tileRepeat',this.repeat);
    geometry.setAttribute('atlasRect',this.atlas);geometry.setAttribute('instanceTint',this.tint);
    geometry.setAttribute('instanceTintTR',this.tintTR);geometry.setAttribute('instanceTintBL',this.tintBL);geometry.setAttribute('instanceTintBR',this.tintBR);
    const next=new InstancedMesh(geometry,this.material,capacity);
    (next.instanceMatrix as BufferAttribute).setUsage(DynamicDrawUsage);
    next.instanceMatrix.array.set(previous.instanceMatrix.array);
    next.frustumCulled=false;next.renderOrder=previous.renderOrder;next.userData.batch=this;next.userData.presentationOccluder=previous.userData.presentationOccluder;
    this.scene.remove(previous);previous.geometry.dispose();previous.dispose();this.scene.add(next);
    this.mesh=next;this.capacity=capacity;this.bindAttributes();
  }
  destroy(){this.scene.remove(this.mesh);this.mesh.geometry.dispose();this.mesh.dispose();this.material.dispose();this.objects.length=this.slots.length=0;}
}

/** Retain a small recent set across view-edge occlusion and animation gaps.
 * Destroying after two missed frames repeatedly recreates buffers/materials. */
export function pruneSpriteBatches(batches:Map<string,SpriteBatch>,frame:number,maxIdle=80){
  let idle=0;
  for(const [key,batch] of batches){
    if(batch.mesh.visible)continue;
    if(frame-batch.lastUsed>180){batch.destroy();batches.delete(key);}
    else idle++;
  }
  if(idle<=maxIdle)return;
  const retired=[...batches].filter(([,batch])=>!batch.mesh.visible).sort((a,b)=>a[1].lastUsed-b[1].lastUsed);
  for(const [key,batch] of retired){
    if(idle<=maxIdle)break;
    batch.destroy();batches.delete(key);idle--;
  }
}
