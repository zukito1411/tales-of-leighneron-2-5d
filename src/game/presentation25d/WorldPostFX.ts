import {
  Color,DepthTexture,LinearFilter,Mesh,NoBlending,OrthographicCamera,
  PlaneGeometry,Scene,ShaderMaterial,UnsignedIntType,Vector2,Vector3,Matrix4,SRGBColorSpace,WebGLRenderTarget,
  type Texture,type WebGLRenderer,type PerspectiveCamera,
} from 'three';
import {getGraphicEffects} from '../systems/graphicsEffects';
import {getEffectsQuality,EFFECTS_QUALITY_EVENT} from '../systems/effectsQuality';
import type {GpuSky} from './GpuSky';
import {FOG_START,VIEW_DISTANCE,type WeatherPresentation} from './environment';

const vertexShader=`
varying vec2 vUv;
void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}
`;
const depthFunctions=`
uniform sampler2D sceneDepth;
uniform vec2 clipRange;
uniform float focusDistance;
uniform float focusRange;
uniform float focusFalloff;
uniform vec2 focusUV;
uniform float aspect;
varying vec2 vUv;
float eyeDepth(vec2 uv){
  float depth=texture2D(sceneDepth,uv).r;
  return clipRange.x*clipRange.y/(clipRange.y-depth*(clipRange.y-clipRange.x));
}
float circleOfConfusion(vec2 uv,float depth){
  // Empty background pixels do not belong to a distant wall or landscape.
  if(depth>clipRange.y-1.0)return 0.0;
  float delta=depth-focusDistance;
  float amount=delta>=0.0?smoothstep(focusRange,focusRange+focusFalloff,delta)
    :0.8*smoothstep(focusRange*1.25,focusRange*1.25+focusFalloff*1.4,-delta);
  // Protect the playable area around the subject, including nearby warnings.
  float distanceFromSubject=length((uv-focusUV)*vec2(aspect,1.0));
  return amount*smoothstep(0.17,0.38,distanceFromSubject);
}
`;
const blurShader=`
uniform sampler2D sourceColor;
uniform vec2 direction;
${depthFunctions}
void main(){
  float depth=eyeDepth(vUv),blur=circleOfConfusion(vUv,depth);
  if(blur<0.01){gl_FragColor=texture2D(sourceColor,vUv);return;}
  vec3 sum=vec3(0.0);float total=0.0;
  for(int i=-2;i<=2;i++){
    float tap=float(i);
    vec2 uv=clamp(vUv+direction*(tap*0.5)*blur,vec2(0.0),vec2(1.0));
    float neighborDepth=eyeDepth(uv);
    // Reject unrelated surfaces to avoid dark roof/tree halos bleeding onto
    // a sharp actor or foreground colors smearing over distant scenery.
    float edge=1.0-smoothstep(focusRange*0.18,focusRange*0.65,abs(neighborDepth-depth));
    float weight=exp(-tap*tap*0.65)*edge;
    sum+=texture2D(sourceColor,uv).rgb*weight;total+=weight;
  }
  gl_FragColor=vec4(sum/max(total,0.0001),1.0);
}
`;
const compositeShader=`
uniform sampler2D sourceColor;
uniform sampler2D blurredColor;
uniform vec2 sourceTexel;
uniform float dofEnabled;
uniform float hazeStrength;
uniform float gradingEnabled;
uniform vec3 hazeColor;
uniform sampler2D mistArtwork;
uniform float mistAmount;
uniform vec3 mistColor;
uniform float weatherTime;
uniform float overcast;
uniform mat4 inverseVP;
uniform vec2 atmosphereFocus;
uniform vec2 atmosphereRange;
${depthFunctions}
void main(){
  vec3 original=texture2D(sourceColor,vUv).rgb;
  float depth=eyeDepth(vUv);
  float blur=dofEnabled*circleOfConfusion(vUv,depth);
  vec3 color=original;
  if(gradingEnabled>0.5){
    vec3 neighborhood=(texture2D(sourceColor,vUv+vec2(sourceTexel.x,0.0)).rgb
      +texture2D(sourceColor,vUv-vec2(sourceTexel.x,0.0)).rgb
      +texture2D(sourceColor,vUv+vec2(0.0,sourceTexel.y)).rgb
      +texture2D(sourceColor,vUv-vec2(0.0,sourceTexel.y)).rgb)*0.25;
    // Small bounded detail contrast retains painted timber/stone texture in
    // focus. It never adds noise, outlines or replacement artwork.
    color+=clamp(original-neighborhood,vec3(-0.035),vec3(0.035))*0.30;
  }
  if(dofEnabled>0.5)color=mix(color,texture2D(blurredColor,vUv).rgb,blur*0.94);
  float distanceHaze=smoothstep(focusRange*0.5,focusRange+focusFalloff*1.8,depth-focusDistance);
  if(depth>clipRange.y-1.0)distanceHaze=0.0;
  color=mix(color,hazeColor,distanceHaze*hazeStrength);
  if(depth<clipRange.y-1.0){
    vec4 p=inverseVP*vec4(vUv*2.0-1.0,texture2D(sceneDepth,vUv).r*2.0-1.0,1.0);
    vec2 ground=p.xz/p.w;
    float surfaceFade=1.0-smoothstep(atmosphereRange.x,atmosphereRange.y,distance(ground,atmosphereFocus));
    color=mix(color,color*vec3(.78,.85,.91),overcast*surfaceFade);
    if(mistAmount>.001){
      float density=texture2D(mistArtwork,fract(ground*.0012+vec2(weatherTime*.003,-weatherTime*.001))).a;
      density+=texture2D(mistArtwork,fract(ground*.0007-vec2(weatherTime*.0015,weatherTime*.0007))).a*.65;
      float distant=smoothstep(80.0,950.0,depth);
      color=mix(color,mistColor,clamp(mistAmount*(.12+density*.38)*distant*surfaceFade,0.0,.62));
    }
  }
  if(gradingEnabled>0.5){
    float light=clamp(dot(color,vec3(0.2126,0.7152,0.0722)),0.0,1.0);
    color*=mix(vec3(0.97,0.99,1.025),vec3(1.035,1.01,0.975),smoothstep(0.06,0.65,light));
    color=(color-0.18)*1.035+0.18;
    vec2 edge=(vUv-0.5)*2.0;
    color*=1.0-0.09*smoothstep(0.45,1.65,dot(edge,edge));
  }
  gl_FragColor=vec4(max(color,vec3(0.0)),1.0);
  #include <colorspace_fragment>
}
`;

interface WorldFrame {
  world:Scene;camera:PerspectiveCamera;background:Scene;backgroundCamera:OrthographicCamera;
  width:number;height:number;density:number;focus:Readonly<{x:number;y:number}>|undefined;
  night:number;interior:boolean;focusHeight:number;sky?:GpuSky;depthNeeded:boolean;
  weather?:WeatherPresentation;mist?:Texture;
}
interface Targets {world:WebGLRenderTarget;horizontal?:WebGLRenderTarget;vertical?:WebGLRenderTarget}

/** World-only, depth-aware focus and atmospheric separation. All buffers are
 * bounded to the existing backing viewport; blur works below CSS resolution.
 * No second world render, CPU readback, asset loading or independent loop.
 */
export class WorldPostFX {
  private readonly scene=new Scene();
  private readonly camera=new OrthographicCamera(-1,1,1,-1,0,1);
  private readonly geometry=new PlaneGeometry(2,2);
  private readonly focusPoint=new Vector3();
  private readonly hazeDay=new Color(0x9ba9b3);
  private readonly hazeNight=new Color(0x202c46);
  private readonly common={
    sceneDepth:{value:null as Texture|null},clipRange:{value:new Vector2(.1,20000)},
    focusDistance:{value:6000},focusRange:{value:150},focusFalloff:{value:300},
    focusUV:{value:new Vector2(.5,.5)},aspect:{value:1},
  };
  private readonly blur=new ShaderMaterial({
    uniforms:{...this.common,sourceColor:{value:null as Texture|null},direction:{value:new Vector2()}},
    vertexShader,fragmentShader:blurShader,depthTest:false,depthWrite:false,blending:NoBlending,toneMapped:false,
  });
  private readonly composite=new ShaderMaterial({
    uniforms:{...this.common,sourceColor:{value:null as Texture|null},blurredColor:{value:null as Texture|null},
      sourceTexel:{value:new Vector2()},dofEnabled:{value:1},hazeStrength:{value:.14},
      mistArtwork:{value:null as Texture|null},mistAmount:{value:0},mistColor:{value:new Color()},weatherTime:{value:0},overcast:{value:0},inverseVP:{value:new Matrix4()},atmosphereFocus:{value:new Vector2()},atmosphereRange:{value:new Vector2(FOG_START,VIEW_DISTANCE)},
      gradingEnabled:{value:1},hazeColor:{value:new Color()}},
    vertexShader,fragmentShader:compositeShader,depthTest:false,depthWrite:false,blending:NoBlending,toneMapped:false,
  });
  private readonly quad=new Mesh(this.geometry,this.composite);
  private targets:Targets|null=null;
  private quality=getEffectsQuality();
  private readonly onQualityChange=()=>{this.quality=getEffectsQuality();};

  constructor(){
    this.quad.frustumCulled=false;this.scene.add(this.quad);
    window.addEventListener(EFFECTS_QUALITY_EVENT,this.onQualityChange);
  }
  get depth(){return this.targets?.world.depthTexture??null;}

  render(renderer:WebGLRenderer,frame:WorldFrame){
    // Loading/asset preparation scenes do not allocate or compile world FX.
    const focus=frame.focus,effects=focus?getGraphicEffects():undefined;
    const environmental=Boolean(!frame.interior&&frame.weather&&(frame.weather.mist>.001||frame.weather.cloudCover>.001));
    if(!focus||!effects||!frame.depthNeeded&&!environmental&&!effects.depthOfField&&!effects.depthHaze&&!effects.cinematicColor){
      this.releaseTargets();
      frame.sky?.render(renderer);
      renderer.render(frame.background,frame.backgroundCamera);renderer.render(frame.world,frame.camera);return;
    }
    const low=this.quality==='low',cssWidth=frame.width/frame.density,cssHeight=frame.height/frame.density;
    const scale=Math.min(low ? .5 : .7,960/cssWidth,960/cssHeight,Math.sqrt(650000/(cssWidth*cssHeight)));
    const bw=Math.max(1,Math.floor(cssWidth*scale)),bh=Math.max(1,Math.floor(cssHeight*scale));
    const targets=this.prepareTargets(frame.width,frame.height,bw,bh,effects.depthOfField);
    this.common.sceneDepth.value=targets.world.depthTexture;
    this.common.clipRange.value.set(frame.camera.near,frame.camera.far);
    this.focusPoint.set(focus.x,frame.focusHeight+24,focus.y).applyMatrix4(frame.camera.matrixWorldInverse);
    this.common.focusDistance.value=-this.focusPoint.z;
    const depthSpan=this.common.focusDistance.value*.9;
    this.common.focusRange.value=Math.max(95,Math.min(180,depthSpan*.20));
    this.common.focusFalloff.value=Math.max(180,depthSpan*.42);
    this.focusPoint.set(focus.x,frame.focusHeight+24,focus.y).project(frame.camera);
    this.common.focusUV.value.set((this.focusPoint.x+1)/2,(this.focusPoint.y+1)/2);
    this.common.aspect.value=frame.width/frame.height;
    this.composite.uniforms.sourceColor.value=targets.world.texture;
    this.composite.uniforms.blurredColor.value=targets.vertical?.texture??targets.world.texture;
    this.composite.uniforms.sourceTexel.value.set(1/frame.width,1/frame.height);
    this.composite.uniforms.dofEnabled.value=Number(effects.depthOfField);
    this.composite.uniforms.hazeStrength.value=effects.depthHaze?(frame.interior ? .035 : .15)*(1-frame.night*.45):0;
    this.composite.uniforms.hazeColor.value.copy(this.hazeDay).lerp(this.hazeNight,frame.night);
    if(frame.sky)this.composite.uniforms.hazeColor.value.copy(frame.sky.horizon);
    this.composite.uniforms.gradingEnabled.value=Number(effects.cinematicColor);
    const weather=frame.interior?undefined:frame.weather;
    this.composite.uniforms.mistArtwork.value=frame.mist??null;
    this.composite.uniforms.mistAmount.value=frame.mist?(weather?.mist??0):0;
    this.composite.uniforms.weatherTime.value=(weather?.elapsed??0)/1000;
    this.composite.uniforms.overcast.value=(weather?.cloudCover??0)*.5;
    if(weather)this.composite.uniforms.mistColor.value.setRGB(weather.fogTint[0]/255,weather.fogTint[1]/255,weather.fogTint[2]/255,SRGBColorSpace).multiplyScalar(1-frame.night*.7);
    this.composite.uniforms.atmosphereFocus.value.set(focus.x,focus.y);
    this.composite.uniforms.inverseVP.value.multiplyMatrices(frame.camera.projectionMatrix,frame.camera.matrixWorldInverse).invert();
    const previous=renderer.getRenderTarget();
    try{
      renderer.setRenderTarget(targets.world);renderer.clear();
      frame.sky?.render(renderer);
      renderer.render(frame.background,frame.backgroundCamera);renderer.render(frame.world,frame.camera);
      if(effects.depthOfField&&targets.horizontal&&targets.vertical){
        const radius=low?3:5;
        this.quad.material=this.blur;this.blur.uniforms.sourceColor.value=targets.world.texture;
        this.blur.uniforms.direction.value.set(radius/cssWidth,0);this.blur.uniformsNeedUpdate=true;
        renderer.setRenderTarget(targets.horizontal);renderer.render(this.scene,this.camera);
        this.blur.uniforms.sourceColor.value=targets.horizontal.texture;
        this.blur.uniforms.direction.value.set(0,radius/cssHeight);this.blur.uniformsNeedUpdate=true;
        renderer.setRenderTarget(targets.vertical);renderer.render(this.scene,this.camera);
      }
      this.quad.material=this.composite;this.composite.uniformsNeedUpdate=true;
      renderer.setRenderTarget(previous);renderer.render(this.scene,this.camera);
    }finally{renderer.setRenderTarget(previous);}
  }

  private prepareTargets(width:number,height:number,bw:number,bh:number,dof:boolean):Targets {
    if(!this.targets){
      const depth=new DepthTexture(width,height,UnsignedIntType);depth.name='world-focus-depth';
      const world=new WebGLRenderTarget(width,height,{minFilter:LinearFilter,magFilter:LinearFilter,generateMipmaps:false,
        depthBuffer:true,stencilBuffer:false,depthTexture:depth});
      world.texture.name='world-focus-color';this.targets={world};
    }
    const targets=this.targets;
    if(targets.world.width!==width||targets.world.height!==height)targets.world.setSize(width,height);
    if(dof){
      if(!targets.horizontal)targets.horizontal=new WebGLRenderTarget(bw,bh,{depthBuffer:false,stencilBuffer:false,minFilter:LinearFilter,magFilter:LinearFilter,generateMipmaps:false});
      if(!targets.vertical)targets.vertical=targets.horizontal.clone();
      for(const target of [targets.horizontal,targets.vertical])if(target.width!==bw||target.height!==bh)target.setSize(bw,bh);
    }else{
      targets.horizontal?.dispose();targets.vertical?.dispose();targets.horizontal=targets.vertical=undefined;
    }
    return targets;
  }
  private releaseTargets(){
    if(!this.targets)return;
    // RenderTarget disposal also owns its depth texture in Three.js.
    this.targets.world.dispose();this.targets.horizontal?.dispose();this.targets.vertical?.dispose();this.targets=null;
    this.common.sceneDepth.value=null;this.blur.uniforms.sourceColor.value=null;
    this.composite.uniforms.sourceColor.value=this.composite.uniforms.blurredColor.value=null;
  }
  destroy(){
    window.removeEventListener(EFFECTS_QUALITY_EVENT,this.onQualityChange);this.releaseTargets();
    this.geometry.dispose();this.blur.dispose();this.composite.dispose();this.scene.remove(this.quad);
  }
}
