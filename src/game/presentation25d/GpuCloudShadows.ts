import {DoubleSide,Mesh,PlaneGeometry,ShaderMaterial,Vector2,Vector3,type Scene,type Texture} from 'three';
import {elevationShader,type ElevationField} from './ElevationField';
import type {DistanceAtmosphere} from './SpriteBatch';
import {sunDirection,type WeatherPresentation} from './environment';
import {getGraphicEffects} from '../systems/graphicsEffects';

const vertex=`${elevationShader}uniform vec2 focus;varying vec2 ground;
void main(){ground=vec2(position.x,-position.y)*5120.0+floor(focus/64.0)*64.0;vec3 p=vec3(ground.x,groundHeight(ground)+.045,ground.y);gl_Position=projectionMatrix*viewMatrix*vec4(p,1.0);}`;
const fragment=`uniform sampler2D artwork;uniform float time;uniform float strength;uniform float clouds;uniform float rays;
uniform vec2 fogFocus;uniform vec2 fogRange;varying vec2 ground;
void main(){
  vec2 uv=fract((ground+vec2(time*14.0,-time*3.4))/vec2(1550.0,980.0));
  float density=texture2D(artwork,vec2(0.001,.501)+uv*.498).a;
  float shade=density*strength*clouds;
  float beam=pow(max(0.0,sin((ground.x+ground.y*.36)*.0035+time*.006)),18.0)*rays*.035;
  float fade=1.0-smoothstep(fogRange.x,fogRange.y,distance(ground,fogFocus));
  float alpha=max(shade,beam)*fade;if(alpha<.002)discard;
  vec3 color=beam>shade?vec3(.95,.83,.62):vec3(.04,.065,.08);
  gl_FragColor=vec4(color,alpha);
  #include <colorspace_fragment>
}`;
/** One terrain-conforming GPU layer; cloud drift changes uniforms only. */
export class GpuCloudShadows {
  private readonly geometry=new PlaneGeometry(1,1,80,80);
  private readonly uniforms={focus:{value:new Vector2()},artwork:{value:null as Texture|null},time:{value:0},strength:{value:0},clouds:{value:1},rays:{value:1}};
  private readonly material:ShaderMaterial;private readonly mesh:Mesh;
  private readonly sun=new Vector3();private readonly reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  constructor(world:Scene,elevation:ElevationField,atmosphere:DistanceAtmosphere){
    this.material=new ShaderMaterial({uniforms:{...elevation.uniforms,...atmosphere,...this.uniforms},vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,depthTest:true,side:DoubleSide,forceSinglePass:true});
    this.mesh=new Mesh(this.geometry,this.material);this.mesh.frustumCulled=false;this.mesh.renderOrder=-9.98;this.mesh.visible=false;world.add(this.mesh);
  }
  update(artwork:Texture,ready:boolean,focus:{x:number;y:number},minute:number,weather:WeatherPresentation|undefined,interior:boolean){
    const effects=getGraphicEffects(),day=Math.max(0,sunDirection(minute,this.sun).y);
    this.mesh.visible=!interior&&ready&&day>.05&&(effects.cloudShadows||effects.sunRays);
    if(!this.mesh.visible)return;
    const u=this.uniforms;u.artwork.value=artwork;u.focus.value.set(focus.x,focus.y);
    u.time.value=this.reduced.matches?0:(weather?.elapsed??0)/1000;u.strength.value=day*(.13+(weather?.cloudCover??0)*.19);
    u.clouds.value=Number(effects.cloudShadows);u.rays.value=Number(effects.sunRays)*day*(1-(weather?.cloudCover??0));
  }
  destroy(){this.mesh.removeFromParent();this.geometry.dispose();this.material.dispose();}
}
