import {CanvasTexture,DoubleSide,LinearFilter,Mesh,PlaneGeometry,ShaderMaterial,Vector2,Vector4,type Scene,type Texture} from 'three';
import type Phaser from 'phaser';
import type {WaterSurfaceSystem} from '../systems/WaterSurfaceSystem';
import type {TextureCache} from './TextureCache';
import {elevationShader,type ElevationField} from './ElevationField';
import type {DistanceAtmosphere} from './SpriteBatch';
import {WATER_SURFACE} from '../../data/waterLevels';

const vertex=`${elevationShader}uniform vec2 focus;varying vec2 ground;
void main(){ground=vec2(position.x,-position.y)*5120.0+floor(focus/64.0)*64.0;vec3 p=vec3(ground.x,${WATER_SURFACE.toFixed(1)},ground.y);gl_Position=projectionMatrix*viewMatrix*vec4(p,1.0);}`;
const fragment=`uniform sampler2D shore;uniform sampler2D foam;uniform vec4 frames[4];uniform vec4 bounds;uniform vec2 maskTexel;uniform float time;uniform bool openSea;
uniform vec2 fogFocus;uniform vec2 fogRange;varying vec2 ground;
vec4 art(vec2 p,int frame){vec4 r=frames[frame];return texture2D(foam,r.xy+clamp(p,vec2(.002),vec2(.998))*r.zw);}
void main(){
  float land=1.0,bank=0.0;
  if(!openSea){
    vec2 uv=(ground-bounds.xy)/bounds.zw;uv.y=1.0-uv.y;
    if(any(lessThan(uv,vec2(0.0)))||any(greaterThan(uv,vec2(1.0))))discard;
    land=texture2D(shore,uv).a;if(land<.02)discard;
    bank=1.0-min(min(texture2D(shore,uv+vec2(maskTexel.x*2.0,0.0)).a,texture2D(shore,uv-vec2(maskTexel.x*2.0,0.0)).a),
      min(texture2D(shore,uv+vec2(0.0,maskTexel.y*2.0)).a,texture2D(shore,uv-vec2(0.0,maskTexel.y*2.0)).a));
  }
  float phase=mod(floor(time/.22),4.0),blend=fract(time/.22);int a=int(phase),b=int(mod(phase+1.0,4.0));
  vec2 uv=fract((ground+vec2(time*6.0,time*3.0))/vec2(240.0,144.0));
  vec4 pixel=mix(art(uv,a),art(uv,b),blend);
  if(bank>.01){vec4 edge=art(fract(ground/38.0),a);pixel=mix(pixel,edge,bank*.7);}
  float fade=1.0-smoothstep(fogRange.x,fogRange.y,distance(ground,fogFocus));
  // The painted bed remains below a separate, level water surface. Shallow
  // turquoise banks transition to deeper blue; the original foam supplies detail.
  vec3 water=mix(vec3(.025,.105,.16),vec3(.075,.24,.26),bank);
  water=mix(water,pixel.rgb,pixel.a*mix(.10,.32,bank));
  gl_FragColor=vec4(water,land*mix(.82,.72,bank)*fade);
  #include <colorspace_fragment>
}`;

/** Original foam artwork scrolls/blends on the GPU. The cached CPU coastline
 * mask uploads only when viewport coverage or terrain cells change. */
export class GpuWater {
  // Height is constant; all coastline/foam/depth colour detail is sampled per
  // fragment. Subdivision changes no surface position or interpolated ground UV.
  private readonly geometry=new PlaneGeometry(1,1);
  private readonly uniforms={focus:{value:new Vector2()},shore:{value:null as Texture|null},foam:{value:null as Texture|null},frames:{value:Array.from({length:4},()=>new Vector4())},bounds:{value:new Vector4()},maskTexel:{value:new Vector2()},time:{value:0},openSea:{value:false}};
  private readonly material:ShaderMaterial;private readonly mesh:Mesh;
  private source:WaterSurfaceSystem|undefined;private mask:CanvasTexture|undefined;private version=-1;
  constructor(world:Scene,elevation:ElevationField,atmosphere:DistanceAtmosphere,private readonly textures:TextureCache){
    this.material=new ShaderMaterial({uniforms:{...elevation.uniforms,...atmosphere,...this.uniforms},vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,depthTest:true,side:DoubleSide,forceSinglePass:true});
    this.mesh=new Mesh(this.geometry,this.material);this.mesh.frustumCulled=false;this.mesh.renderOrder=-9.99;this.mesh.visible=false;world.add(this.mesh);
  }
  update(scene:Phaser.Scene,source:WaterSurfaceSystem|undefined,focus:{x:number;y:number},frame:number,interior:boolean){
    if(source!==this.source){this.mask?.dispose();this.mask=undefined;this.source=source;this.version=-1;}
    const state=source?.presentation;this.mesh.visible=Boolean(state?.enabled&&!interior);
    if(!state||!this.mesh.visible)return;
    const first=scene.textures.getFrame('water-foam',0);if(!first?.source.image){this.mesh.visible=false;return;}
    const u=this.uniforms;u.foam.value=this.textures.get(first.source,frame);u.focus.value.set(focus.x,focus.y);u.time.value=state.elapsed/1000;u.openSea.value=state.openSea;
    for(let i=0;i<4;i++){const f=scene.textures.getFrame('water-foam',i);if(f)u.frames.value[i].set((f.cutX+.25)/f.source.width,1-(f.cutY+f.cutHeight-.25)/f.source.height,(f.cutWidth-.5)/f.source.width,(f.cutHeight-.5)/f.source.height);}
    if(!state.openSea){
      if(!this.mask){this.mask=new CanvasTexture(state.mask);this.mask.minFilter=this.mask.magFilter=LinearFilter;this.mask.generateMipmaps=false;}
      if(this.version!==state.version){this.mask.needsUpdate=true;this.version=state.version;}
      u.shore.value=this.mask;u.bounds.value.set(state.x,state.y,state.width,state.height);u.maskTexel.value.set(1/state.mask.width,1/state.mask.height);
    }
  }
  destroy(){this.mask?.dispose();this.mesh.removeFromParent();this.geometry.dispose();this.material.dispose();this.source=undefined;}
}
