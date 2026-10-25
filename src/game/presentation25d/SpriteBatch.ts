import {
  AdditiveBlending,BufferAttribute,DoubleSide,DynamicDrawUsage,InstancedBufferAttribute,
  InstancedMesh,Matrix4,NormalBlending,PlaneGeometry,Scene,ShaderMaterial,Texture,Vector4,Vector2,Vector3,Color,type BufferGeometry,
} from 'three';
import {lightOcclusionShader} from './LightOcclusion';
import {waveVertexDeclarations,waveVertexMotion,waveFragmentDeclarations} from './WaveEnergyShader';
import {elevationShader,TERRAIN_GRID_SEGMENTS,type ElevationField} from './ElevationField';
import type Phaser from 'phaser';
export interface DistanceAtmosphere {
  fogFocus:{value:import('three').Vector2};fogColor:{value:import('three').Color};fogRange:{value:import('three').Vector2};
  visualTime?:{value:number};
  architectureAtlas?:{value:Texture|null};furnishingsAtlas?:{value:Texture|null};buildingDetailsAtlas?:{value:Texture|null};
  natureAtlas?:{value:Texture|null};
  worldDepth?:{value:Texture|null};depthClipRange?:{value:Vector2};depthTexel?:{value:Vector2};
  structureLightDirection?:{value:Vector3};structureFill?:{value:Color};structureKey?:{value:Color};
}

export interface CutawayUniforms {
  cutawayViewport:{value:Vector2};cutawaySubject:{value:Vector4};cutawayTarget:{value:Vector4};
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
uniform bool cutawayEnabled;
uniform bool structureShading;
uniform vec3 structureLightDirection;
uniform vec3 structureFill;
uniform vec3 structureKey;
uniform bool billboard;
uniform vec2 billboardRight;
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
varying float cameraDepth;
${waveVertexDeclarations}
#ifdef COMBAT_SURFACES
attribute float combatOpacity;
varying float energyOpacity;
#endif
#ifdef STRUCTURE_SURFACES
attribute vec4 surfaceRect;
attribute vec4 cutoutPivot;
uniform float visualTime;
varying float paintedFire;
attribute vec2 surfaceUV;
varying vec4 materialRect;
varying vec2 materialUV;
#endif
void main(){
#ifdef COMBAT_SURFACES
  energyOpacity=combatOpacity;
#endif
#ifdef STRUCTURE_SURFACES
  materialRect=surfaceRect;materialUV=surfaceUV;paintedFire=step(.00001,cutoutPivot.w);
#endif
  localUV=uv;effectData=tileRepeat;
  sourceY=1.0-uv.y;
  shadowBottom=tileRepeat.x;
  atlasUV=atlasRect.xy+uv*atlasRect.zw;
  repeatUV=uv*tileRepeat.xy+tileRepeat.zw;frameRect=atlasRect;
  tint=mix(mix(instanceTintBL,instanceTintBR,uv.x),mix(instanceTint,instanceTintTR,uv.x),uv.y);
  vec3 presentedPosition=position;
${waveVertexMotion}
  vec4 world=instanceMatrix*vec4(presentedPosition,1.0);
  if(billboard){
    float horizontal=world.x-tileRepeat.x;
    world.x=tileRepeat.x+horizontal*billboardRight.x;
    world.z=tileRepeat.y+horizontal*billboardRight.y;
  }
#ifdef STRUCTURE_SURFACES
  if(cutoutPivot.w>0.0){
    vec4 pivot=instanceMatrix*vec4(cutoutPivot.xyz,1.0);
    float scale=length(instanceMatrix[0].xyz),rise=clamp((position.y-cutoutPivot.y)/cutoutPivot.w,0.0,1.0);
    float phase=visualTime*5.0+dot(pivot.xz,vec2(.013,.019));
    float sway=sin(phase+rise*3.0)*rise*rise*cutoutPivot.w*.025;
    float x=(position.x-cutoutPivot.x+sway)*scale;
    world=vec4(pivot.x+x*billboardRight.x,pivot.y+(position.y-cutoutPivot.y)*scale*(1.0+sin(phase*.83)*.025),pivot.z+x*billboardRight.y,1.0);
  }
#endif
  if(architecture&&structureShading
#ifdef STRUCTURE_SURFACES
    &&paintedFire<.5
#endif
  ){
    mat3 basis=mat3(instanceMatrix);
    vec3 n=normalize(basis*(normal/vec3(dot(basis[0],basis[0]),dot(basis[1],basis[1]),dot(basis[2],basis[2]))));
    // Hemisphere fill and the shared sun/moon key reveal every elevation.
    // Vertex lighting keeps the painted materials and fragment cost intact.
    tint.rgb*=min(vec3(1.05),structureFill*(.90+.10*max(n.y,0.0))+structureKey*max(0.0,dot(n,structureLightDirection)));
  }
  groundPosition=world.xz;
  if(groundSurface)world.y+=groundHeight(world.xz);
  vec4 viewed=viewMatrix*world;cameraDepth=-viewed.z;
  gl_Position=projectionMatrix*viewed;
}`;
const fragmentShader=`
uniform sampler2D atlas;
uniform sampler2D worldDepth;
uniform vec2 depthClipRange;
uniform vec2 depthTexel;
uniform bool occludedOverlay;
uniform bool fillTint;
uniform bool tiled;
uniform bool shadow;
uniform bool fadeOnly;
uniform bool telegraph;
uniform bool architecture;
uniform bool cutawayEnabled;
uniform vec2 cutawayViewport;
uniform vec4 cutawaySubject;
uniform vec4 cutawayTarget;
varying vec2 localUV;
varying vec4 effectData;
uniform vec2 atlasTexel;
uniform vec2 fogFocus;
uniform vec3 fogColor;
uniform vec2 fogRange;
varying float sourceY;
varying float shadowBottom;
varying float cameraDepth;
#ifdef COMBAT_SURFACES
varying float energyOpacity;
#endif
varying vec2 repeatUV;
varying vec4 frameRect;
varying vec2 atlasUV;
varying vec4 tint;
varying vec2 groundPosition;
#ifdef STRUCTURE_SURFACES
varying vec4 materialRect;
varying vec2 materialUV;
varying float paintedFire;
uniform float visualTime;
uniform sampler2D architectureAtlas;
uniform sampler2D furnishingsAtlas;
uniform sampler2D buildingDetailsAtlas;
uniform sampler2D natureAtlas;
#endif
uniform int clipCount;
uniform vec4 clipRects[16];
float cutaway(vec4 subject){
  if(subject.w<=0.0||cameraDepth>=subject.z-6.0)return 0.0;
  vec2 d=(gl_FragCoord.xy/cutawayViewport-subject.xy)*vec2(cutawayViewport.x/cutawayViewport.y*1.5,1.0);
  return 1.0-smoothstep(.66,1.0,length(d)/subject.w);
}
#ifdef STRUCTURE_SURFACES
float materialNoise(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
vec2 paintedMaterialUV(){
  vec2 within=1.0-abs(fract(materialUV*.5)*2.0-1.0);
  // Four-pixel gutters inside each cell avoid adjacent material/atlas bleed.
  return materialRect.xy+mix(vec2(.012),vec2(.988),within)*.25;
}
vec3 paintedMaterialPixel(){
  vec2 uv=paintedMaterialUV();
  // Derivatives must come from the continuous coordinates, not mirrored
  // fract seams. Swatch gutters remain isolated through the useful mip levels.
  vec2 dx=dFdx(materialUV)*.244,dy=dFdy(materialUV)*.244;
  if(materialRect.w< -19.5)return textureGrad(natureAtlas,uv,dx,dy).rgb;
  if(materialRect.w< -17.5)return textureGrad(buildingDetailsAtlas,uv,dx,dy).rgb;
  return materialRect.w< -16.5?textureGrad(furnishingsAtlas,uv,dx,dy).rgb:textureGrad(architectureAtlas,uv,dx,dy).rgb;
}
vec3 modelPigment(){
  if(materialRect.w< -15.5)return paintedMaterialPixel();
  vec3 base=materialRect.xyz;float kind=-materialRect.w;
  if(kind<1.5)return base;
  vec2 p=materialUV;
  // Small modeled fountains share the existing clock and draw call. Positive
  // time moves stream highlights down the upward-oriented cylinder UVs.
  if(kind>7.5&&kind<9.5){
    float wave=kind>8.5?sin(p.y*32.0+visualTime*6.0):sin(length(p)*62.0-visualTime*2.4)+sin(p.x*31.0+p.y*19.0-visualTime*1.2)*.35;
    float glint=smoothstep(.75,1.0,wave);
    return mix(base,vec3(.65,.88,.94),glint*(kind>8.5?.28:.13));
  }
  float detail=1.0-smoothstep(.025,.14,max(length(dFdx(p)),length(dFdy(p))));
  if(kind>6.5){
    float rough=materialNoise(floor(p*18.0))*.65+materialNoise(floor(p*70.0))*.35-.5;
    return base*(1.0+rough*detail*.16);
  }
  if(kind<2.5){
    float grain=materialNoise(floor(p*vec2(120.0,8.0)))-.5;
    float seam=abs(fract(p.x*7.0)-.5),aa=max(fwidth(p.x*7.0),.012);
    float join=smoothstep(.48-aa,.5,seam);
    return base*(1.0+detail*(grain*.075-join*.12));
  }
  if(kind<3.5||kind>5.5){
    vec2 grid=p*vec2(kind>5.5?15.0:14.0,kind>5.5?22.0:18.0);
    grid.x+=mod(floor(grid.y),2.0)*.5;
    vec2 edge=min(fract(grid),1.0-fract(grid)),aa=max(fwidth(grid),vec2(.008));
    float joint=1.0-smoothstep(.015,.035+min(aa.x,aa.y),min(edge.x,edge.y));
    float tile=materialNoise(floor(grid))-.5;
    return base*(1.0+detail*(tile*.12-joint*.18));
  }
  float grain=materialNoise(floor(p*(kind<4.5?160.0:60.0)))-.5;
  return base*(1.0+grain*detail*.035);
}
#endif
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
${lightOcclusionShader}
${waveFragmentDeclarations}
void main(){
  float glowVisibility=1.0;
  // Only explicitly marked world glows use effectData as an occlusion record.
  // The screen compositor keeps UI clear while lights sample real world depth.
  if(occludedOverlay){
    float n=depthClipRange.x,f=depthClipRange.y;
    float lightDepth=n*f/(f-effectData.z*(f-n));
    glowVisibility=lightVisibility(worldDepth,effectData.xy,gl_FragCoord.xy/cutawayViewport,lightDepth,depthClipRange,depthTexel,effectData.w);
    if(glowVisibility<.001)discard;
  }
  if(architecture&&cutawayEnabled){
    float reveal=max(cutaway(cutawaySubject),cutaway(cutawayTarget));
    // A stable sight-line cutout avoids crawling screen-door noise on walls.
    // The existing FXAA pass smooths the rim while the character remains clear.
    if(reveal>.25)discard;
  }
  if(clipCount>0){
    bool inside=false;
    for(int i=0;i<16;i++){
      if(i>=clipCount)break;
      vec4 r=clipRects[i];
      if(groundPosition.x>=r.x&&groundPosition.y>=r.y&&groundPosition.x<=r.z&&groundPosition.y<=r.w)inside=true;
    }
    if(!inside)discard;
  }
  vec2 sampleUV=tiled?frameRect.xy+fract(repeatUV)*frameRect.zw:atlasUV;
#ifdef STRUCTURE_SURFACES
  if(abs(materialRect.z)>0.0&&materialRect.w>0.0){
    vec2 patchSize=abs(materialRect.zw*frameRect.zw);
    vec2 inset=min(vec2(.25),atlasTexel*.75/max(patchSize,vec2(.000001)));
    // Mirrored tiles keep a bounded swatch continuous at repeat boundaries.
    vec2 within=mix(inset,vec2(1.0)-inset,1.0-abs(fract(materialUV*.5)*2.0-1.0));
    sampleUV=frameRect.xy+(materialRect.xy+within*vec2(abs(materialRect.z),materialRect.w))*frameRect.zw;
  }
#endif
  vec4 pixel;
#ifdef STRUCTURE_SURFACES
  // Negative height encodes a solid linear material (glass, metal, fabric).
  // It shares the atlas draw and avoids sampling a whole painted facade.
  if(materialRect.w<0.0){
    pixel=vec4(shadow||fillTint?tint.rgb:modelPigment(),1.0);
    if(materialRect.w< -18.5&&materialRect.w> -19.5)pixel.a=texture2D(buildingDetailsAtlas,paintedMaterialUV()).a;
  }
  else
#endif
  pixel=telegraph?warningPixel():texture2D(atlas,sampleUV);
#ifdef STRUCTURE_SURFACES
  if(materialRect.z<0.0&&materialRect.w>0.0){
    vec4 painted=texture2D(atlas,atlasUV);
    if(fadeOnly&&!shadow)pixel=painted;
    else pixel.rgb=mix(pixel.rgb,painted.rgb,smoothstep(.10,.85,painted.a));
  }
#endif
#ifdef STRUCTURE_SURFACES
  // The cropped source contains the real painted flame, not a cone. Reject
  // dark logs/stone inside its rectangle so only fire moves with the camera.
  if(paintedFire>.5)pixel.a*=smoothstep(.22,.50,pixel.r)*smoothstep(.12,.30,pixel.r-pixel.b);
  else if(abs(materialRect.z)>0.0&&materialRect.w>0.0)pixel.a=1.0;
#endif
  if(shadow){
#ifdef STRUCTURE_SURFACES
    if(paintedFire>.5)discard;
    if(materialRect.w>=0.0){
#endif
    vec2 lo=min(frameRect.xy,frameRect.xy+frameRect.zw),hi=max(frameRect.xy,frameRect.xy+frameRect.zw);
    vec2 t=atlasTexel*2.0;
    pixel.a=pixel.a*0.4+(texture2D(atlas,clamp(sampleUV+vec2(t.x,0.0),lo,hi)).a
      +texture2D(atlas,clamp(sampleUV-vec2(t.x,0.0),lo,hi)).a
      +texture2D(atlas,clamp(sampleUV+vec2(0.0,t.y),lo,hi)).a
      +texture2D(atlas,clamp(sampleUV-vec2(0.0,t.y),lo,hi)).a)*0.15;
#ifdef STRUCTURE_SURFACES
    }
#endif
    if(shadowBottom<0.999
#ifdef STRUCTURE_SURFACES
      &&materialRect.z==0.0
#endif
    )pixel.a*=1.0-smoothstep(max(0.0,shadowBottom-0.025),shadowBottom,sourceY);
  }
  if(!telegraph)pixel.rgb=fillTint?tint.rgb:pixel.rgb*tint.rgb;
#ifdef WAVE_ENERGY
  pixel=waveEnergyPixel(pixel);
#endif
  pixel.a*=tint.a*glowVisibility;
#ifdef COMBAT_SURFACES
  pixel.a*=energyOpacity;
#endif
  float haze=fogRange.y>0.0?smoothstep(fogRange.x,fogRange.y,distance(groundPosition,fogFocus)):0.0;
  if(shadow||fadeOnly)pixel.a*=1.0-haze;
  else pixel.rgb=mix(pixel.rgb,fogColor,haze);
  if(pixel.a<(shadow||occludedOverlay?0.001:0.025))discard;
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

  constructor(private readonly scene:Scene,texture:Texture,additive:boolean,overlay:boolean,order:number,clips:readonly Vector4[]=[],fillTint=false,opaque=false,depthWrite=!overlay&&!additive,ground=false,tiled=false,elevation?:ElevationField,terrain:boolean|number=false,atmosphere?:DistanceAtmosphere,shadow=false,telegraph=false,private readonly geometryFactory?:()=>BufferGeometry,billboard=false,billboardRight?:{value:Vector2},cutawayUniforms?:CutawayUniforms,cutawayEnabled=true,occludedOverlay=false,private readonly combatGeometry?:()=>BufferGeometry){
    if(billboard)this.capacity=128;
    const image=texture.image as {width?:number;height?:number}|undefined;
    this.material=new ShaderMaterial({defines:combatGeometry?{COMBAT_SURFACES:1}:geometryFactory?{STRUCTURE_SURFACES:1}:{},uniforms:{worldDepth:{value:texture},depthClipRange:{value:new Vector2(2,4000)},depthTexel:{value:new Vector2(1,1)},occludedOverlay:{value:occludedOverlay},cutawayEnabled:{value:cutawayEnabled},cutawayViewport:cutawayUniforms?.cutawayViewport??{value:new Vector2(1,1)},cutawaySubject:cutawayUniforms?.cutawaySubject??{value:new Vector4()},cutawayTarget:cutawayUniforms?.cutawayTarget??{value:new Vector4()},architectureAtlas:atmosphere?.architectureAtlas??{value:texture},furnishingsAtlas:atmosphere?.furnishingsAtlas??{value:texture},buildingDetailsAtlas:atmosphere?.buildingDetailsAtlas??{value:texture},natureAtlas:atmosphere?.natureAtlas??{value:texture},visualTime:atmosphere?.visualTime??{value:0},billboard:{value:billboard},billboardRight:billboardRight??{value:new Vector2(1,0)},...elevation?.uniforms,fogFocus:{value:new Vector2()},fogColor:{value:new Color()},fogRange:{value:new Vector2()},structureLightDirection:{value:new Vector3(-.4,.85,.3).normalize()},structureFill:{value:new Color().setRGB(.74,.76,.80)},structureKey:{value:new Color().setRGB(.26,.24,.20)},...atmosphere,atlas:{value:texture},fillTint:{value:fillTint},tiled:{value:tiled},shadow:{value:shadow},telegraph:{value:telegraph},architecture:{value:Boolean(geometryFactory)&&!shadow},structureShading:{value:!additive},fadeOnly:{value:additive||ground&&!opaque},atlasTexel:{value:new Vector2(1/Math.max(1,image?.width??1),1/Math.max(1,image?.height??1))},groundSurface:{value:ground},clipCount:{value:clips.length},
      clipRects:{value:Array.from({length:16},(_,i)=>clips[i]??new Vector4())}},vertexShader,fragmentShader,
      transparent:!opaque,depthTest:!overlay,depthWrite,side:DoubleSide,forceSinglePass:true,
      polygonOffset:ground&&!opaque,polygonOffsetFactor:-1,polygonOffsetUnits:-2,
      blending:additive?AdditiveBlending:NormalBlending});
    this.segments=typeof terrain==='number'?terrain:terrain?TERRAIN_GRID_SEGMENTS:ground?(shadow?8:4):1;
    const geometry=this.createGeometry();
    if(geometry.userData.energyWave===true)this.material.defines.WAVE_ENERGY=1;
    this.atlas=new InstancedBufferAttribute(new Float32Array(this.capacity*4),4).setUsage(DynamicDrawUsage);
    this.tint=new InstancedBufferAttribute(new Float32Array(this.capacity*4),4).setUsage(DynamicDrawUsage);
    const makeTint=()=>new InstancedBufferAttribute(new Float32Array(this.capacity*4),4).setUsage(DynamicDrawUsage);
    this.tintTR=makeTint();this.tintBL=makeTint();this.tintBR=makeTint();
    this.repeat=makeTint();geometry.setAttribute('tileRepeat',this.repeat);
    geometry.setAttribute('atlasRect',this.atlas);geometry.setAttribute('instanceTint',this.tint);
    geometry.setAttribute('instanceTintTR',this.tintTR);geometry.setAttribute('instanceTintBL',this.tintBL);geometry.setAttribute('instanceTintBR',this.tintBR);
    this.mesh=new InstancedMesh(geometry,this.material,this.capacity);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);this.mesh.frustumCulled=false;this.mesh.renderOrder=order;
    this.mesh.userData.batch=this;this.mesh.userData.presentationOccluder=Boolean(geometryFactory)&&!shadow&&cutawayEnabled;scene.add(this.mesh);
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
  private createGeometry(){return this.combatGeometry?.()??this.geometryFactory?.()??new PlaneGeometry(1,1,this.segments,this.segments);}
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
export function pruneSpriteBatches(batches:Map<string,SpriteBatch>,frame:number,maxIdle=80,maxReleases=2,deadline=Infinity){
  let idle=0,released=0;
  for(const [key,batch] of batches){
    if(batch.mesh.visible)continue;
    if(frame-batch.lastUsed>180&&released<maxReleases&&performance.now()<deadline){batch.destroy();batches.delete(key);released++;}
    else idle++;
  }
  if(idle<=maxIdle||released>=maxReleases||performance.now()>=deadline)return;
  // Select a couple of oldest idle entries without allocating/sorting a map copy.
  while(idle>maxIdle&&released<maxReleases&&performance.now()<deadline){
    let oldest:SpriteBatch|undefined,oldestKey='';
    for(const [key,batch] of batches)if(!batch.mesh.visible&&(!oldest||batch.lastUsed<oldest.lastUsed)){oldest=batch;oldestKey=key;}
    if(!oldest)break;
    oldest.destroy();batches.delete(oldestKey);idle--;released++;
  }
}
