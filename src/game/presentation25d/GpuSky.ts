import {Color,LinearFilter,Matrix3,Matrix4,Mesh,NoBlending,OrthographicCamera,PlaneGeometry,Scene,ShaderMaterial,SRGBColorSpace,Texture,Vector3,type PerspectiveCamera,type WebGLRenderer} from 'three';
import {sunDirection,type WeatherPresentation} from './environment';

const vertex=`varying vec2 skyUV;void main(){skyUV=uv;gl_Position=vec4(position.xy,1.0,1.0);}`;
const fragment=`
uniform mat4 inverseProjection;
uniform mat3 cameraRotation;
uniform sampler2D artwork;
uniform float ready;
uniform float time;
uniform float daylight;
uniform float night;
uniform float cloudCover;
uniform vec3 sun;
uniform vec3 zenith;
uniform vec3 horizon;
varying vec2 skyUV;
vec4 cell(vec2 uv,vec2 origin){return texture2D(artwork,origin+clamp(uv,vec2(0.002),vec2(0.998))*0.5);}
vec4 disc(vec3 ray,vec3 direction,vec2 origin,float radius){
  float facing=dot(ray,direction);if(facing<0.96)return vec4(0.0);
  vec3 right=normalize(cross(vec3(0.0,1.0,0.0),direction));
  vec3 up=normalize(cross(direction,right));
  vec2 uv=vec2(dot(ray,right),dot(ray,up))/radius+0.5;
  if(any(lessThan(uv,vec2(0.0)))||any(greaterThan(uv,vec2(1.0))))return vec4(0.0);
  return cell(uv,origin);
}
vec3 starSeed(vec3 p){
  p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);
  return fract((p.xxy+p.yxx)*p.zyx);
}
vec3 stars(vec3 ray){
  // Cube-face coordinates avoid the spherical pole singularity. Centers
  // stay inside each cell, so stars never straddle a face boundary.
  vec3 a=abs(ray);vec2 uv;float face;
  if(a.x>=a.y&&a.x>=a.z){uv=ray.yz/a.x;face=ray.x>0.0?0.0:1.0;}
  else if(a.y>=a.z){uv=ray.xz/a.y;face=ray.y>0.0?2.0:3.0;}
  else{uv=ray.xy/a.z;face=ray.z>0.0?4.0:5.0;}
  vec2 grid=uv*55.0;
  vec3 seed=starSeed(vec3(floor(grid),face));
  float distance=length(fract(grid)-(.24+seed.xy*.52));
  float radius=mix(.045,.10,seed.x);
  float edge=max(length(fwidth(grid))*.55,.025);
  if(seed.z<.955)return vec3(0.0);
  float point=1.0-smoothstep(max(0.0,radius-edge),radius+edge,distance);
  // Filtered tiny points keep the night sky steady at adaptive resolutions.
  point*=min(1.0,radius*radius/(edge*edge));
  float twinkle=.86+.14*sin(time*(.65+seed.x)+seed.y*62.83);
  vec3 tint=mix(vec3(.60,.76,1.0),vec3(1.0,.89,.68),seed.y);
  return tint*point*twinkle*(.55+seed.x*.65);
}
void main(){
  vec4 view=inverseProjection*vec4(skyUV*2.0-1.0,1.0,1.0);
  vec3 ray=normalize(cameraRotation*view.xyz);
  float altitude=max(0.0,ray.y),dusk=pow(1.0-clamp(abs(sun.y)*4.0,0.0,1.0),2.0);
  vec3 color=mix(horizon,zenith,pow(altitude,0.55));
  float solarGlow=pow(max(0.0,dot(ray,sun)),12.0)*dusk*(1.0-cloudCover*.8);
  color+=vec3(.25,.085,.015)*solarGlow;
  // Stars share the existing sky pass, behind the moon and cloud artwork.
  // They need no asset load, per-star object, CPU animation or extra draw.
  if(night>.25&&ray.y>0.0){
    float visibility=smoothstep(.25,.95,night)*smoothstep(.01,.18,ray.y);
    color+=stars(ray)*visibility*pow(1.0-cloudCover,2.0);
  }
  if(ready>0.5){
    vec4 solar=disc(ray,sun,vec2(0.0,0.0),0.24);
    vec4 lunar=disc(ray,-sun,vec2(0.5,0.0),0.23);
    color=mix(color,solar.rgb,solar.a*(1.0-cloudCover*.88)*smoothstep(-.08,.04,sun.y));
    color=mix(color,lunar.rgb,lunar.a*night*(1.0-cloudCover*.85)*smoothstep(-.08,.04,-sun.y));
    if(ray.y>-.04){
      float azimuth=atan(ray.z,ray.x)/6.2831853;
      float elevation=asin(clamp(ray.y,-1.0,1.0))/1.5707963;
      vec2 p=vec2(fract(azimuth*5.0+time*.0016),clamp((elevation+.02)*1.7,0.0,1.0));
      vec4 cloud=cell(p,vec2(0.0,0.5));
      vec4 bank=cell(vec2(fract(azimuth*3.0-time*.0008+.37),clamp((elevation+.10)*2.6,0.0,1.0)),vec2(.5,.5));
      float cloudAlpha=(cloud.a*.72+bank.a*.55)*(.30+cloudCover*.70)*smoothstep(-.04,.06,ray.y);
      vec3 cloudLight=mix(vec3(.045,.065,.12),vec3(.82,.87,.94),daylight);
      cloudLight=mix(cloudLight,vec3(.42,.46,.52),cloudCover*.65);
      vec3 detail=mix(cloud.rgb,bank.rgb,bank.a*.5);
      color=mix(color,detail*cloudLight,clamp(cloudAlpha,0.0,.95));
    }
  }
  gl_FragColor=vec4(color,1.0);
  #include <colorspace_fragment>
}`;

/** One sky draw. Illustrated 2D atlas layers move in angular world space;
 * no cube-map decoding, CPU repaint, per-cloud object or independent clock. */
export class GpuSky {
  get artwork(){return this.texture;}
  get sunlight():Readonly<Vector3>{return this.sun;}
  get ready(){return this.uniforms.ready.value>0;}
  readonly horizon=new Color();
  private readonly scene=new Scene();private readonly camera=new OrthographicCamera(-1,1,1,-1,0,1);
  private readonly geometry=new PlaneGeometry(2,2);private readonly texture=new Texture();
  private readonly sun=new Vector3();private readonly rotation=new Matrix3();
  private readonly dayTop=new Color(0x4579aa);private readonly dayHorizon=new Color(0xaac9d1);
  private readonly nightTop=new Color(0x071023);private readonly nightHorizon=new Color(0x202c42);private readonly duskHorizon=new Color(0xd39b77);
  private readonly overcastHorizon=new Color(0x58616a);
  private readonly uniforms={inverseProjection:{value:new Matrix4()},cameraRotation:{value:this.rotation},artwork:{value:this.texture},ready:{value:0},time:{value:0},daylight:{value:0},night:{value:0},cloudCover:{value:0},sun:{value:this.sun},zenith:{value:new Color()},horizon:{value:this.horizon}};
  private readonly material:ShaderMaterial;
  private image:HTMLImageElement|null=null;private disposed=false;private started=false;
  private readonly reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  constructor(){
    this.material=new ShaderMaterial({uniforms:this.uniforms,vertexShader:vertex,fragmentShader:fragment,depthTest:false,depthWrite:false,blending:NoBlending,toneMapped:false});
    const quad=new Mesh(this.geometry,this.material);quad.frustumCulled=false;this.scene.add(quad);
    this.texture.colorSpace=SRGBColorSpace;this.texture.minFilter=this.texture.magFilter=LinearFilter;this.texture.generateMipmaps=false;
  }
  private load(){
    if(this.started)return;this.started=true;
    const image=new Image();this.image=image;image.decoding='async';
    image.onload=()=>{if(this.disposed)return;this.texture.image=image;this.texture.needsUpdate=true;this.uniforms.ready.value=1;image.onload=image.onerror=null;};
    image.onerror=()=>{if(!this.disposed)console.warn('[sky] Optional sky artwork could not load.');image.onload=image.onerror=null;};
    image.src=import.meta.env.BASE_URL+'assets/environment/sky-atlas-v1.png';
  }
  update(camera:PerspectiveCamera,minute:number,night:number,weather:WeatherPresentation|undefined){
    this.load();sunDirection(minute,this.sun);
    const day=1-night,cover=weather?.cloudCover??0,dusk=Math.max(0,1-Math.abs(this.sun.y)*5);
    this.horizon.copy(this.nightHorizon).lerp(this.dayHorizon,day).lerp(this.duskHorizon,dusk*(1-cover)*.6);
    this.horizon.lerp(this.overcastHorizon,cover*.35);
    this.uniforms.zenith.value.copy(this.nightTop).lerp(this.dayTop,day).lerp(this.horizon,cover*.45);
    this.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
    this.rotation.setFromMatrix4(camera.matrixWorld);
    this.uniforms.daylight.value=day;this.uniforms.night.value=night;this.uniforms.cloudCover.value=cover;
    this.uniforms.time.value=this.reduced.matches?0:(weather?.elapsed??0)/1000;
  }
  render(renderer:WebGLRenderer){renderer.render(this.scene,this.camera);}
  destroy(){this.disposed=true;if(this.image){this.image.onload=this.image.onerror=null;this.image.src='';this.image=null;}this.texture.dispose();this.geometry.dispose();this.material.dispose();this.scene.clear();}
}
