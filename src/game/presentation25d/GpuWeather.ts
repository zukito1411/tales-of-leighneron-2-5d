import {CanvasTexture,InstancedBufferAttribute,InstancedMesh,LinearFilter,Matrix4,NormalBlending,PlaneGeometry,ShaderMaterial,SRGBColorSpace,Vector2,Vector3,Vector4,type Scene,type Texture,type PerspectiveCamera} from 'three';
import type {WeatherSystem} from '../systems/WeatherSystem';
import type {ElevationField} from './ElevationField';
import {elevationShader} from './ElevationField';
import {getGraphicEffects} from '../systems/graphicsEffects';
import {getEffectsQuality} from '../systems/effectsQuality';
import {authoredRoofs} from '../systems/authoredRoofs';

const vertex=`
attribute vec4 seed;
attribute float particleIndex;
uniform mat4 worldVP;
uniform vec3 cameraRight;
uniform vec3 cameraUp;
uniform vec2 focus;
uniform float time;
uniform float kind;
uniform float strength;
uniform float night;
uniform float wind;
uniform vec4 roofs[64];
uniform int roofCount;
${elevationShader}
varying vec2 particleUV;
varying float opacity;
varying float artCell;
void main(){
  particleUV=uv;
  bool wet=kind<1.5,ash=kind>3.5,ember=particleIndex>=96.0;
  float depth=0.4+mod(particleIndex,3.0)*0.3;
  float speed=wet?360.0:ash?18.0:kind<2.5?24.0:12.0;
  float age=fract(seed.y+time*speed*seed.z/620.0*(ember?-1.0:1.0));
  vec2 origin=floor(focus/64.0)*64.0;
  vec2 p=mod(seed.xy*1800.0+vec2(time*(12.0+wind*20.0)*seed.z,time*2.0)-origin,1800.0)-900.0+origin;
  if(!wet)p.x+=sin(time*.7+seed.w)*12.0;
  float ground=groundHeight(p),height=age*620.0;
  vec3 world=vec3(p.x,ground+height,p.y);
  float sx=wet?1.3:ash?(ember?24.0:5.0+depth*6.0):kind<2.5?3.5:6.0;
  float sy=wet?20.0:sx*(ash?1.0:.65);
  vec2 local=position.xy*vec2(sx,sy);
  if(ash&&!ember){float a=seed.w+time*.3*seed.z;local=mat2(cos(a),-sin(a),sin(a),cos(a))*local;}
  if(wet)local.x+=position.y*3.0;
  world+=cameraRight*local.x+cameraUp*local.y;
  opacity=strength*(wet?.42:ash?mix(.48,.9,night):.65);
  opacity*=smoothstep(0.0,45.0,height)*(1.0-smoothstep(570.0,620.0,height));
  opacity*=1.0-smoothstep(680.0,900.0,max(abs(p.x-focus.x),abs(p.y-focus.y)));
  if((wet||kind<2.5)&&height<160.0){
    for(int i=0;i<64;i++){if(i>=roofCount)break;vec4 r=roofs[i];if(p.x>=r.x&&p.x<=r.z&&p.y>=r.y&&p.y<=r.w){opacity=0.0;break;}}
  }
  artCell=ember?6.0+step(.5,night):mod(particleIndex,3.0)+step(.5,night)*3.0;
  gl_Position=worldVP*vec4(world,1.0);
}`;
const fragment=`
uniform sampler2D ashAtlas;
uniform sampler2D worldDepth;
uniform vec2 viewport;
uniform float kind;
uniform float night;
varying vec2 particleUV;
varying float opacity;
varying float artCell;
void main(){
  if(opacity<.005)discard;
  if(gl_FragCoord.z>texture2D(worldDepth,gl_FragCoord.xy/viewport).r+.00002)discard;
  vec4 pixel;
  if(kind>3.5){
    vec2 cell=vec2(mod(artCell,4.0),1.0-floor(artCell/4.0));
    pixel=texture2D(ashAtlas,(cell+clamp(particleUV,.02,.98))/vec2(4.0,2.0));
    if(night>.5)pixel.rgb*=1.6;
  }else{
    float edge=1.0-smoothstep(.5,1.0,length((particleUV-.5)*2.0));
    pixel=vec4(kind<1.5?vec3(.62,.77,.86):kind<2.5?vec3(.88,.94,.98):vec3(.62,.49,.31),edge);
  }
  gl_FragColor=vec4(pixel.rgb,pixel.a*opacity);
  #include <colorspace_fragment>
}`;

/** Static seeds, GPU motion and cached world-depth occlusion. Existing weather
 * owns transitions, clock, audio and the original ash/fog artwork. */
export class GpuWeather {
  private readonly geometry=new PlaneGeometry(1,1);
  private readonly uniforms={worldVP:{value:new Matrix4()},cameraRight:{value:new Vector3()},cameraUp:{value:new Vector3()},focus:{value:new Vector2()},
    time:{value:0},kind:{value:0},strength:{value:0},night:{value:0},wind:{value:0},roofs:{value:Array.from({length:64},()=>new Vector4())},roofCount:{value:0},
    ashAtlas:{value:null as Texture|null},worldDepth:{value:null as Texture|null},viewport:{value:new Vector2()}};
  private readonly material:ShaderMaterial;private readonly mesh:InstancedMesh;
  private source:WeatherSystem|undefined;private ash:CanvasTexture|undefined;
  fog:CanvasTexture|undefined;
  private lastRoofAt=-Infinity;private readonly roofCenter=new Vector2(Infinity,Infinity);
  private readonly reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  constructor(screen:Scene,elevation:ElevationField){
    this.material=new ShaderMaterial({uniforms:{...elevation.uniforms,...this.uniforms},vertexShader:vertex,fragmentShader:fragment,transparent:true,depthTest:false,depthWrite:false,blending:NormalBlending});
    this.mesh=new InstancedMesh(this.geometry,this.material,104);this.mesh.frustumCulled=false;this.mesh.visible=false;screen.add(this.mesh);
  }
  update(source:WeatherSystem|undefined,camera:PerspectiveCamera,focus:{x:number;y:number},night:number,interior:boolean,bounds:{left:number;right:number;top:number;bottom:number}){
    if(source!==this.source){
      this.releaseArtwork();this.source=source;
      if(source)this.prepare(source);
    }
    if(!source||interior){this.mesh.visible=false;return;}
    const state=source.presentation,effects=getGraphicEffects(),ash=state.region==='darkav'||state.kind==='ash';
    const wet=state.kind==='rain'||state.kind==='storm',snow=state.kind==='snow',dust=state.kind==='wind'||state.kind==='dust';
    this.mesh.visible=effects.weatherParticles&&(wet||snow||dust||ash)&&(state.strength>.001||ash);
    if(!this.mesh.visible)return;
    const u=this.uniforms,low=getEffectsQuality()==='low',kind=ash?4:snow?2:wet?1:3;
    this.mesh.count=ash?104:wet?(state.kind==='storm'?(low?42:96):(low?30:60)):snow?(low?28:72):20;
    this.mesh.renderOrder=ash?1_000_000.5:999_990;
    u.kind.value=kind;u.time.value=this.reduced.matches&&ash?0:state.elapsed/1000;u.night.value=night;
    u.strength.value=ash?.65+.35*state.strength:state.strength;u.wind.value=state.wind;u.focus.value.set(focus.x,focus.y);
    u.worldVP.value.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    const m=camera.matrixWorld.elements;u.cameraRight.value.set(m[0],m[1],m[2]);u.cameraUp.value.set(m[4],m[5],m[6]);
    if(state.elapsed-this.lastRoofAt>350||Math.hypot(focus.x-this.roofCenter.x,focus.y-this.roofCenter.y)>200){
      this.lastRoofAt=state.elapsed;this.roofCenter.set(focus.x,focus.y);
      let count=0;
      for(const roof of authoredRoofs.query(bounds)){
        if(count>=64)break;const r=roof.bounds;u.roofs.value[count++].set(r.left,r.top,r.right,r.bottom);
      }
      u.roofCount.value=count;
    }
  }
  get needsDepth(){return this.mesh.visible;}
  setDepth(texture:Texture|null,width:number,height:number){this.uniforms.worldDepth.value=texture;this.uniforms.viewport.value.set(width,height);}
  private prepare(source:WeatherSystem){
    const art=source.ashArtwork,canvas=document.createElement('canvas');canvas.width=96;canvas.height=48;
    const context=canvas.getContext('2d')!,images=[...art.dayArtwork,...art.nightArtwork,art.dayEmberArtwork,art.nightEmberArtwork];
    for(let i=0;i<images.length;i++)context.drawImage(images[i],i%4*24,Math.floor(i/4)*24,24,24);
    this.ash=new CanvasTexture(canvas);this.ash.colorSpace=SRGBColorSpace;this.ash.minFilter=this.ash.magFilter=LinearFilter;this.ash.generateMipmaps=false;
    this.fog=new CanvasTexture(source.fogArtwork);this.fog.minFilter=this.fog.magFilter=LinearFilter;this.fog.generateMipmaps=false;
    this.uniforms.ashAtlas.value=this.ash;
    const seeds=new Float32Array(104*4),indices=new Float32Array(104);
    for(let i=0;i<104;i++){const p=source.particleSeeds[i%96];seeds.set([p.x,p.y,p.speed,p.phase],i*4);indices[i]=i;}
    // Dispose old GPU bindings before replacing attributes on scene re-entry.
    // The immutable plane's CPU arrays remain available for the next upload.
    this.geometry.dispose();
    this.geometry.setAttribute('seed',new InstancedBufferAttribute(seeds,4));this.geometry.setAttribute('particleIndex',new InstancedBufferAttribute(indices,1));
  }
  private releaseArtwork(){this.ash?.dispose();this.fog?.dispose();this.ash=undefined;this.fog=undefined;this.uniforms.ashAtlas.value=null;this.lastRoofAt=-Infinity;this.roofCenter.set(Infinity,Infinity);}
  destroy(){this.releaseArtwork();this.mesh.removeFromParent();this.mesh.dispose();this.geometry.dispose();this.material.dispose();this.source=undefined;}
}
