import {BufferAttribute,BufferGeometry,InstancedBufferAttribute,InstancedMesh,Mesh,Scene,ShaderMaterial,SphereGeometry,Vector3,type Camera,type Texture,type WebGLRenderer} from 'three';
import {CINDERPEAK,cinderpeakRidge,cinderpeakVariation,type VolcanoPulse} from '../../data/cinderpeak';
import {seededRandom} from '../../utils/seededRandom';
import {getEffectsQuality} from '../systems/effectsQuality';
import type {DistanceAtmosphere} from './SpriteBatch';
// Only the landmark compresses distant depth; projected angles and ordinary
// terrain streaming stay unchanged. The shared far plane remains 4000.
const projection=`vec4 viewed=viewMatrix*world;float d=-viewed.z;
 if(d>3700.0)viewed.xyz*=(3700.0+250.0*(1.0-exp(-(d-3700.0)/250.0)))/d;
 gl_Position=projectionMatrix*viewed;`;
const vertex=`attribute float molten;varying vec2 tex;varying float heat;varying vec3 n;varying vec2 ground;
 void main(){tex=uv;heat=molten;n=normalize(mat3(modelMatrix)*normal);vec4 world=modelMatrix*vec4(position,1.0);ground=world.xz;${projection}}`;
const fragment=`uniform sampler2D artwork;uniform float time;uniform float pulse;
 uniform vec3 structureLightDirection;uniform vec3 structureFill;uniform vec3 structureKey;
 uniform vec2 fogFocus;uniform vec3 fogColor;varying vec2 tex;varying float heat;varying vec3 n;varying vec2 ground;
 void main(){
  vec2 tile=heat>.5?vec2(2.0,2.0):vec2(3.0,3.0);
  vec2 p=fract(tex+(heat>.5?vec2(0.0,time*.025):vec2(0.0)));
  vec3 paint=texture2D(artwork,vec2(tile.x,3.0-tile.y)*.25+(.004+p*.992)*.25).rgb;
  vec3 light=min(vec3(1.05),structureFill+structureKey*max(0.0,dot(normalize(n),structureLightDirection)));
  vec3 color=paint*light;
  if(heat>.5){float flow=.88+.12*sin(time*2.0+tex.y*18.0);color=mix(paint,vec3(1.0,.26,.018),.36)*flow*(1.0+pulse*.35);}
  float haze=smoothstep(1800.0,28000.0,distance(ground,fogFocus))*.90;
  gl_FragColor=vec4(mix(color,fogColor,haze),1.0);
  #include <colorspace_fragment>
 }`;
const ejectVertex=`attribute vec4 launch;attribute float rockSize;uniform float quakeTime;
 varying float ageFraction;varying vec3 n;varying vec2 ground;
 void main(){float age=quakeTime-launch.w;ageFraction=age/3.6;n=normal;
 vec3 p=position*rockSize+vec3(launch.x*age,launch.y*age-260.0*age*age,launch.z*age);
 vec4 world=modelMatrix*vec4(p,1.0);ground=world.xz;${projection}
 if(age<0.0||age>3.6)gl_Position=vec4(2.0,2.0,2.0,1.0);
 }`;
const ejectFragment=`uniform vec2 fogFocus;uniform vec3 fogColor;
 varying float ageFraction;varying vec3 n;varying vec2 ground;
 void main(){if(ageFraction<0.0||ageFraction>1.0)discard;
 vec3 color=mix(vec3(1.0,.72,.14),vec3(.78,.10,.012),ageFraction)*(.80+.20*max(0.0,n.y));
 gl_FragColor=vec4(mix(color,fogColor,smoothstep(1800.0,28000.0,distance(ground,fogFocus))*.90),1.0);
 #include <colorspace_fragment>
 }`;
/** Retained ridged basalt, an open crater and one GPU ballistic lava batch. */
export class GpuVolcano {
 private readonly geometry=new BufferGeometry();private readonly ejectGeometry=new SphereGeometry(1,8,6);
 private readonly uniforms={artwork:{value:null as Texture|null},time:{value:0},pulse:{value:0},quakeTime:{value:0}};
 private readonly material:ShaderMaterial;private readonly ejectMaterial:ShaderMaterial;
 private readonly surface:Mesh;private readonly ejecta:InstancedMesh;
 private readonly warmup=new Scene();private readonly warmEjecta:InstancedMesh;
 constructor(world:Scene,atmosphere:DistanceAtmosphere){
  const pos:number[]=[],uv:number[]=[],heat:number[]=[],indices:number[]=[];
  const push=(p:Vector3,u:number,v:number,molten=0)=>{const i=pos.length/3;pos.push(p.x,p.y,p.z);uv.push(u,v);heat.push(molten);return i;};
  const N=96,R=11,H=CINDERPEAK.height;
  const point=(t:number,i:number,lift=0)=>{
   const a=i/N*Math.PI*2,v=cinderpeakVariation(i),r=(CINDERPEAK.craterRadius+(CINDERPEAK.radius-CINDERPEAK.craterRadius)*Math.pow(1-t,.82))*cinderpeakRidge(i);
   const y=H*Math.pow(t,1.20)-140*Math.pow(1-t,8)+(Math.sin(a*5)*24+(v-.5)*70)*t;
   return new Vector3(Math.cos(a)*r,y+lift,Math.sin(a)*r);
  };
  for(let row=0;row<=R;row++)for(let i=0;i<=N;i++)push(point(row/R,i),i/N*15,row/R*9);
  for(let row=0;row<R;row++)for(let i=0;i<N;i++){
   const a=row*(N+1)+i,b=a+1,c=a+N+1,d=c+1;indices.push(a,c,b,b,c,d);
  }
  const inner=pos.length/3;
  for(let row=0;row<2;row++)for(let i=0;i<=N;i++){
   const a=i/N*Math.PI*2,p=point(1,i);if(row){p.x=Math.cos(a)*CINDERPEAK.craterRadius*.62;p.z=Math.sin(a)*CINDERPEAK.craterRadius*.62;p.y=H-230;}
   push(p,i/N*5,row,row?1:0);
  }
  for(let i=0;i<N;i++){const a=inner+i,b=a+1,c=a+N+1,d=c+1;indices.push(a,c,b,b,c,d);}
  const center=push(new Vector3(0,H-229,0),.5,.5,1),rim=pos.length/3;
  for(let i=0;i<=N;i++){const a=i/N*Math.PI*2;push(new Vector3(Math.cos(a)*CINDERPEAK.craterRadius*.63,H-229,Math.sin(a)*CINDERPEAK.craterRadius*.63),.5+Math.cos(a)*.5,.5+Math.sin(a)*.5,1);}
  for(let i=0;i<N;i++)indices.push(center,rim+i+1,rim+i);
  // Channels track the same ridge samples rather than floating planar cards.
  for(const start of [4,20,37,50,67,83]){
   const offset=pos.length/3;
   for(let row=0;row<=R;row++){
    const t=row/R,index=start+Math.sin(t*7+start)*.4;
    push(point(t,index,6),0,t*6,1);push(point(t,index+1,6),1,t*6,1);
   }
   for(let row=0;row<R;row++){const a=offset+row*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  this.geometry.setAttribute('position',new BufferAttribute(new Float32Array(pos),3));this.geometry.setAttribute('uv',new BufferAttribute(new Float32Array(uv),2));
  this.geometry.setAttribute('molten',new BufferAttribute(new Float32Array(heat),1));this.geometry.setIndex(indices);this.geometry.computeVertexNormals();
  const random=seededRandom('darkav:lava-ejecta:v1'),launch=new Float32Array(128*4),sizes=new Float32Array(128);
  for(let i=0;i<128;i++){const a=random()*Math.PI*2,speed=65+random()*170;launch.set([Math.cos(a)*speed,700+random()*470,Math.sin(a)*speed,((i*.61803398875)%1)*8.4],i*4);sizes[i]=9+random()*14;}
  this.ejectGeometry.setAttribute('launch',new InstancedBufferAttribute(launch,4));this.ejectGeometry.setAttribute('rockSize',new InstancedBufferAttribute(sizes,1));
  // Outward faces and inward crater faces are already wound correctly.
  // Cull the shell interior when an orbit camera enters the mountain, so
  // its back faces cannot cover the player or force camera auto-zoom.
  this.material=new ShaderMaterial({uniforms:{...atmosphere,...this.uniforms},vertexShader:vertex,fragmentShader:fragment});
  this.ejectMaterial=new ShaderMaterial({uniforms:{...atmosphere,...this.uniforms},vertexShader:ejectVertex,fragmentShader:ejectFragment});
  this.surface=new Mesh(this.geometry,this.material);this.ejecta=new InstancedMesh(this.ejectGeometry,this.ejectMaterial,128);
  this.surface.frustumCulled=this.ejecta.frustumCulled=false;this.surface.visible=this.ejecta.visible=false;
  this.surface.position.set(CINDERPEAK.x,0,CINDERPEAK.y);this.ejecta.position.set(CINDERPEAK.x,H-215,CINDERPEAK.y);world.add(this.surface,this.ejecta);
  this.warmEjecta=new InstancedMesh(this.ejectGeometry,this.ejectMaterial,1);this.warmEjecta.frustumCulled=false;
  this.warmup.add(new Mesh(this.geometry,this.material),this.warmEjecta);
 }
 preparePrograms(renderer:WebGLRenderer,camera:Camera){return renderer.compileAsync(this.warmup,camera).then(()=>{});}
 update(focus:{x:number;y:number}|undefined,base:number,atlas:Texture|null,time:number,pulse:VolcanoPulse|undefined,interior:boolean){
  this.surface.visible=Boolean(focus&&atlas&&!interior&&Math.hypot(focus.x-CINDERPEAK.x,focus.y-CINDERPEAK.y)<CINDERPEAK.maximumView);
  this.ejecta.visible=this.surface.visible&&Boolean(pulse?.active);if(!this.surface.visible)return;
  const u=this.uniforms;u.artwork.value=atlas;u.time.value=time;u.pulse.value=Math.min(1,(pulse?.intensity??0)/.0018);u.quakeTime.value=pulse?.seconds??0;
  this.surface.position.y=base;this.ejecta.position.y=base+CINDERPEAK.height-215;
  const quality=getEffectsQuality();this.ejecta.count=quality==='high'?128:quality==='low'?48:80;
 }
 destroy(){this.surface.removeFromParent();this.ejecta.removeFromParent();this.warmup.clear();this.ejecta.dispose();this.warmEjecta.dispose();this.geometry.dispose();this.ejectGeometry.dispose();this.material.dispose();this.ejectMaterial.dispose();}
}
