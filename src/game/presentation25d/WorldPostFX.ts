import {
  Color,DepthTexture,LinearFilter,Mesh,NoBlending,OrthographicCamera,
  PlaneGeometry,Scene,ShaderMaterial,UnsignedIntType,Vector2,Vector3,Matrix4,SRGBColorSpace,WebGLRenderTarget,
  type Texture,type WebGLRenderer,type PerspectiveCamera,
} from 'three';
import {getGraphicEffects} from '../systems/graphicsEffects';
import {getEffectsQuality,EFFECTS_QUALITY_EVENT} from '../systems/effectsQuality';
import type {GpuSky} from './GpuSky';
import {VISUAL_QUALITY} from './VisualQuality';
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
uniform vec2 lockUV;
uniform vec2 lockRadius;
uniform float lockDepth;
uniform float lockDepthRange;
uniform float lockEnabled;
varying vec2 vUv;
float eyeDepth(vec2 uv){
  float depth=texture2D(sceneDepth,uv).r;
  return clipRange.x*clipRange.y/(clipRange.y-depth*(clipRange.y-clipRange.x));
}
float lockedProtection(vec2 uv,float depth){
  if(lockEnabled<.5)return 0.0;
  vec2 d=abs((uv-lockUV)/max(lockRadius,vec2(.001)));
  float extent=max(d.x,d.y);
  return (1.0-smoothstep(1.0,1.16,extent))*(1.0-smoothstep(lockDepthRange*.7,lockDepthRange,abs(depth-lockDepth)));
}
float circleOfConfusion(vec2 uv,float depth){
  // Empty background pixels do not belong to a distant wall or landscape.
  if(depth>clipRange.y-1.0)return 0.0;
  float delta=depth-focusDistance;
  // Ground under the player and nearby furniture must remain readable.
  // Cinematic softness belongs behind the playable area, never in front.
  float amount=smoothstep(focusRange,focusRange+focusFalloff,max(0.0,delta));
  // Protect the playable area around the subject, including nearby warnings.
  float distanceFromSubject=length((uv-focusUV)*vec2(aspect,1.0));
  return amount*smoothstep(0.17,0.38,distanceFromSubject)*(1.0-lockedProtection(uv,depth));
}
`;
const blurShader=`
uniform sampler2D sourceColor;
uniform vec2 direction;
uniform float bloomEnabled;
uniform float bloomFirstPass;
${depthFunctions}
float highlight(vec3 color,float depth){
  if(depth>clipRange.y-1.0)return 0.0;
  float peak=max(color.r,max(color.g,color.b));
  float chroma=peak-min(color.r,min(color.g,color.b));
  // Soft-knee highlights, excluding the sky and ordinary pale masonry.
  return smoothstep(.72,.98,peak)*(.25+.75*smoothstep(.06,.32,chroma));
}
void main(){
  float depth=eyeDepth(vUv),blur=circleOfConfusion(vUv,depth);
  if(blur<0.01&&bloomEnabled<.5){gl_FragColor=texture2D(sourceColor,vUv);return;}
  vec3 sum=vec3(0.0);float total=0.0,glow=0.0;
  for(int i=-2;i<=2;i++){
    float tap=float(i);
    vec2 uv=clamp(vUv+direction*(tap*0.5)*(bloomEnabled>.5?1.0:blur),vec2(0.0),vec2(1.0));
    float neighborDepth=eyeDepth(uv);
    // Reject unrelated surfaces to avoid dark roof/tree halos bleeding onto
    // a sharp actor or foreground colors smearing over distant scenery.
    float edge=1.0-smoothstep(focusRange*0.18,focusRange*0.65,abs(neighborDepth-depth));
    float weight=exp(-tap*tap*0.65)*edge;
    vec4 sampleColor=texture2D(sourceColor,uv);
    sum+=sampleColor.rgb*weight;total+=weight;
    if(bloomEnabled>.5)glow+=(bloomFirstPass>.5?highlight(sampleColor.rgb,neighborDepth):sampleColor.a)*weight;
  }
  // RGB retains focus filtering; unused alpha carries highlight energy.
  gl_FragColor=vec4(sum/max(total,0.0001),glow/max(total,0.0001));
}
`;
const compositeShader=`
uniform sampler2D sourceColor;
uniform sampler2D blurredColor;
uniform vec2 sourceTexel;
uniform float dofEnabled;
uniform float hazeStrength;
uniform float gradingEnabled;
uniform float edgeSmoothing;
uniform float bloomStrength;
uniform vec3 hazeColor;
uniform sampler2D mistArtwork;
uniform float mistAmount;
uniform vec3 mistColor;
uniform float weatherTime;
uniform float overcast;
uniform mat4 inverseVP;
uniform vec2 atmosphereFocus;
uniform vec2 atmosphereRange;
uniform sampler2D nightMask;
uniform float nightOpacity;
uniform vec2 sunUV;
uniform float sunShafts;
uniform float shaftSamples;
${depthFunctions}
void main(){
  vec3 original=texture2D(sourceColor,vUv).rgb;
  float rawDepth=texture2D(sceneDepth,vUv).r;
  float depth=clipRange.x*clipRange.y/(clipRange.y-rawDepth*(clipRange.y-clipRange.x));
  float protection=lockedProtection(vUv,depth);
  float blur=dofEnabled*circleOfConfusion(vUv,depth);
  vec3 color=original;
  if(edgeSmoothing>0.5){
    vec3 east=texture2D(sourceColor,vUv+vec2(sourceTexel.x,0.0)).rgb;
    vec3 west=texture2D(sourceColor,vUv-vec2(sourceTexel.x,0.0)).rgb;
    vec3 north=texture2D(sourceColor,vUv+vec2(0.0,sourceTexel.y)).rgb;
    vec3 south=texture2D(sourceColor,vUv-vec2(0.0,sourceTexel.y)).rgb;
    vec3 neighborhood=(east+west+north+south)*.25;
    vec3 luma=vec3(.299,.587,.114);
    float center=dot(original,luma),e=dot(east,luma),w=dot(west,luma),n=dot(north,luma),s=dot(south,luma);
    float high=max(center,max(max(e,w),max(n,s))),low=min(center,min(min(e,w),min(n,s)));
    float contrast=high-low;
    // Depth gates distinguish silhouettes from painted grain and roof tiles.
    // High uses world-target MSAA; Normal smooths silhouettes in this pass.
    float edgeDepth=max(max(abs(eyeDepth(vUv+vec2(sourceTexel.x,0.0))-depth),abs(eyeDepth(vUv-vec2(sourceTexel.x,0.0))-depth)),
      max(abs(eyeDepth(vUv+vec2(0.0,sourceTexel.y))-depth),abs(eyeDepth(vUv-vec2(0.0,sourceTexel.y))-depth)));
    if(edgeDepth>max(3.0,depth*.012)&&contrast>max(.045,high*.16)){
      // FXAA direction follows the edge, using the existing four luma taps.
      // No multisample depth buffer, history, extra world render or FXAA pass.
      vec2 gradient=vec2(w-e,s-n);
      vec2 tangent=vec2(-gradient.y,gradient.x);
      float reduce=max((e+w+n+s)*.03125,.0078125);
      tangent=clamp(tangent/(min(abs(tangent.x),abs(tangent.y))+reduce),vec2(-6.0),vec2(6.0))*sourceTexel;
      vec3 inner=(texture2D(sourceColor,vUv-tangent/6.0).rgb+texture2D(sourceColor,vUv+tangent/6.0).rgb)*.5;
      vec3 outer=inner*.5+(texture2D(sourceColor,vUv-tangent*.5).rgb+texture2D(sourceColor,vUv+tangent*.5).rgb)*.25;
      float outerLuma=dot(outer,luma);
      color=outerLuma<low||outerLuma>high?inner:outer;
      // Soften subpixel stair steps without blurring the whole scene.
      float subpixel=clamp(abs(dot(neighborhood,luma)-center)/max(contrast,.001)-.2,0.0,.55);
      color=mix(color,neighborhood,subpixel*subpixel);
    }
    // Small bounded detail contrast retains painted timber/stone texture in
    // focus. It never adds noise, outlines or replacement artwork.
    // Preserve the painterly diffuse texture; no unsharp-mask contrast boost.
  }
  if(dofEnabled>0.5||bloomStrength>.001){
    vec4 filtered=texture2D(blurredColor,vUv);
    if(dofEnabled>0.5)color=mix(color,filtered.rgb,blur*0.30);
    // Screen-like blending retains highlight detail rather than clipping it.
    float peak=max(filtered.r,max(filtered.g,filtered.b));
    vec3 glowColor=mix(vec3(1.0,.94,.85),filtered.rgb/max(.001,peak),.75);
    color+=glowColor*filtered.a*bloomStrength*(1.0-clamp(color,0.0,1.0))*(1.0-protection*.8);
  }
  float distanceHaze=smoothstep(max(650.0,focusRange),max(1800.0,focusRange+focusFalloff*1.8),depth-focusDistance);
  if(depth>clipRange.y-1.0)distanceHaze=0.0;
  color=mix(color,hazeColor,distanceHaze*hazeStrength*(1.0-protection));
  float surfaceFade=0.0;
  if(depth<clipRange.y-1.0){
    vec4 p=inverseVP*vec4(vUv*2.0-1.0,rawDepth*2.0-1.0,1.0);
    vec2 ground=p.xz/p.w;
    surfaceFade=1.0-smoothstep(atmosphereRange.x,atmosphereRange.y,distance(ground,atmosphereFocus));
    color=mix(color,color*vec3(.78,.85,.91),overcast*surfaceFade);
    if(mistAmount>.001){
      float density=texture2D(mistArtwork,fract(ground*.0012+vec2(weatherTime*.003,-weatherTime*.001))).a;
      density+=texture2D(mistArtwork,fract(ground*.0007-vec2(weatherTime*.0015,weatherTime*.0007))).a*.65;
      float distant=smoothstep(80.0,950.0,depth);
      color=mix(color,mistColor,clamp(mistAmount*(.12+density*.38)*distant*surfaceFade*(1.0-protection),0.0,.62));
    }
  }
  // Bounded radial depth-mask integration in the existing colour pass.
  // No extra world render, readback, allocation or fullscreen raymarch pass.
  if(sunShafts>.001){
    vec2 toward=sunUV-vUv;
    float illumination=0.0,total=0.0;
    for(int i=0;i<8;i++){
      if(float(i)>=shaftSamples)break;
      float t=(float(i)+.5)/shaftSamples;
      vec2 q=vUv+toward*t;
      float weight=1.0-t*.45;
      if(q.x>=0.0&&q.x<=1.0&&q.y>=0.0&&q.y<=1.0)illumination+=smoothstep(.99990,.999999,texture2D(sceneDepth,q).r)*weight;
      total+=weight;
    }
    float spread=exp(-length(toward*vec2(aspect,1.0))*1.8);
    float belowSun=smoothstep(0.0,.12,sunUV.y-vUv.y);
    color+=vec3(1.0,.94,.82)*sunShafts*(illumination/max(.001,total))*.085*spread*belowSun;
  }
  if(gradingEnabled>0.5){
    float light=clamp(dot(color,vec3(0.2126,0.7152,0.0722)),0.0,1.0);
    color*=mix(vec3(0.97,0.99,1.025),vec3(1.035,1.01,0.975),smoothstep(0.06,0.65,light));
    color=(color-0.18)*1.025+0.18;
    vec2 edge=(vUv-0.5)*2.0;
    color*=1.0-0.045*smoothstep(0.45,1.65,dot(edge,edge));
  }
  gl_FragColor=vec4(max(color,vec3(0.0)),1.0);
  #include <colorspace_fragment>
  // Match the former screen overlay's blending in output colour space.
  // Only merge when no lower-order screen object must precede darkness.
  if(nightOpacity>0.0&&rawDepth<=.999999){
    vec3 veil=linearToOutputTexel(vec4(.0006,.0018,.005,1.0)).rgb;
    gl_FragColor.rgb=mix(gl_FragColor.rgb,veil,texture2D(nightMask,vUv).a*nightOpacity*surfaceFade);
  }
}
`;

interface WorldFrame {
  world:Scene;camera:PerspectiveCamera;background:Scene;backgroundCamera:OrthographicCamera;
  width:number;height:number;density:number;focus:Readonly<{x:number;y:number}>|undefined;
  night:number;interior:boolean;focusHeight:number;sky?:GpuSky;depthNeeded:boolean;
  weather?:WeatherPresentation;mist?:Texture;
  afterWorldRender?:(depth:Texture)=>void;
  lockedTarget?:{x:number;y:number;displayWidth:number;displayHeight:number;presentationElevation?:number};lockedGroundHeight?:number;
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
  private readonly sunPoint=new Vector3();
  private readonly hazeDay=new Color(0x9ba9b3);
  private readonly hazeNight=new Color(0x202c46);
  private readonly common={
    sceneDepth:{value:null as Texture|null},clipRange:{value:new Vector2(.1,20000)},
    focusDistance:{value:6000},focusRange:{value:150},focusFalloff:{value:300},
    focusUV:{value:new Vector2(.5,.5)},aspect:{value:1},
    lockUV:{value:new Vector2()},lockRadius:{value:new Vector2(.1,.1)},lockDepth:{value:0},lockDepthRange:{value:100},lockEnabled:{value:0},
  };
  private readonly blur=new ShaderMaterial({
    uniforms:{...this.common,sourceColor:{value:null as Texture|null},direction:{value:new Vector2()},bloomEnabled:{value:0},bloomFirstPass:{value:1}},
    vertexShader,fragmentShader:blurShader,depthTest:false,depthWrite:false,blending:NoBlending,toneMapped:false,
  });
  private readonly composite=new ShaderMaterial({
    uniforms:{...this.common,nightMask:{value:null as Texture|null},nightOpacity:{value:0},sourceColor:{value:null as Texture|null},blurredColor:{value:null as Texture|null},
      sourceTexel:{value:new Vector2()},dofEnabled:{value:1},bloomStrength:{value:0},hazeStrength:{value:.14},
      sunUV:{value:new Vector2(.5,.5)},sunShafts:{value:0},shaftSamples:{value:8},
      mistArtwork:{value:null as Texture|null},mistAmount:{value:0},mistColor:{value:new Color()},weatherTime:{value:0},overcast:{value:0},inverseVP:{value:new Matrix4()},atmosphereFocus:{value:new Vector2()},atmosphereRange:{value:new Vector2(FOG_START,VIEW_DISTANCE)},
      gradingEnabled:{value:1},edgeSmoothing:{value:1},hazeColor:{value:new Color()}},
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
  async warm(renderer:WebGLRenderer){
    const scene=new Scene();scene.add(new Mesh(this.geometry,this.blur),new Mesh(this.geometry,this.composite));
    try{await renderer.compileAsync(scene,this.camera);}
    finally{scene.clear();}
  }
  setNight(mask:Texture|null,darkness:number){this.composite.uniforms.nightMask.value=mask;this.composite.uniforms.nightOpacity.value=mask?darkness:0;}
  prepareWorld(width:number,height:number,samples=0){
    if(this.targets&&this.targets.world.samples!==samples)this.releaseTargets();
    if(!this.targets){
      const depth=new DepthTexture(width,height,UnsignedIntType);depth.name='world-focus-depth';
      const world=new WebGLRenderTarget(width,height,{minFilter:LinearFilter,magFilter:LinearFilter,generateMipmaps:false,
        depthBuffer:true,stencilBuffer:false,depthTexture:depth,samples,resolveDepthBuffer:true});
      world.texture.name='world-focus-color';this.targets={world};
    }
    if(this.targets.world.width!==width||this.targets.world.height!==height)this.targets.world.setSize(width,height);
    return this.targets.world.depthTexture;
  }
  get depth(){return this.targets?.world.depthTexture??null;}

  render(renderer:WebGLRenderer,frame:WorldFrame){
    // Loading/asset preparation scenes do not allocate or compile world FX.
    const focus=frame.focus,effects=focus?getGraphicEffects():undefined;
    const environmental=Boolean(!frame.interior&&(effects?.sunRays||frame.weather&&(frame.weather.mist>.001||frame.weather.cloudCover>.001)));
    if(!focus||!effects||this.quality!=='high'&&!frame.depthNeeded&&!environmental&&!effects.depthOfField&&!effects.depthHaze&&!effects.cinematicColor&&!(effects.lightBloom&&this.quality!=='low')){
      this.releaseTargets();
      frame.sky?.render(renderer);
      renderer.render(frame.background,frame.backgroundCamera);renderer.render(frame.world,frame.camera);return;
    }
    const low=this.quality==='low',profile=VISUAL_QUALITY[this.quality],cssWidth=frame.width/frame.density,cssHeight=frame.height/frame.density;
    const mobile=/(Android|iPhone|iPad|iPod)/i.test(navigator.userAgent);
    const samples=this.quality==='high'?Math.min(mobile?2:4,renderer.capabilities.maxSamples):0;
    // Mobile Low must prioritize player input and camera smoothness over two
    // optional fullscreen blur passes. Depth, lighting, haze and silhouettes
    // stay enabled. High and Normal retain distant depth of field.
    const blurEnabled=effects.depthOfField&&!low;
    // Normal packs bloom into the existing bounded focus buffers. Low keeps
    // the painted lamp/window halos without introducing fullscreen blur work.
    const bloomEnabled=effects.lightBloom&&!low;
    const filterEnabled=blurEnabled||bloomEnabled;
    const scale=Math.min(profile.blurScale,profile.blurEdge/cssWidth,profile.blurEdge/cssHeight,Math.sqrt(profile.blurPixels/(cssWidth*cssHeight)));
    const bw=Math.max(1,Math.floor(cssWidth*scale)),bh=Math.max(1,Math.floor(cssHeight*scale));
    const targets=this.prepareTargets(frame.width,frame.height,bw,bh,filterEnabled,samples);
    this.common.sceneDepth.value=targets.world.depthTexture;
    this.common.clipRange.value.set(frame.camera.near,frame.camera.far);
    this.focusPoint.set(focus.x,frame.focusHeight+24,focus.y).applyMatrix4(frame.camera.matrixWorldInverse);
    this.common.focusDistance.value=-this.focusPoint.z;
    const depthSpan=this.common.focusDistance.value*.9;
    this.common.focusRange.value=frame.interior?Math.max(140,Math.min(240,depthSpan*.28)):Math.max(600,depthSpan*.65);
    this.common.focusFalloff.value=frame.interior?Math.max(260,depthSpan*.55):Math.max(700,depthSpan*.85);
    this.focusPoint.set(focus.x,frame.focusHeight+24,focus.y).project(frame.camera);
    this.common.focusUV.value.set((this.focusPoint.x+1)/2,(this.focusPoint.y+1)/2);
    this.common.aspect.value=frame.width/frame.height;
    const lock=frame.lockedTarget;this.common.lockEnabled.value=0;
    if(lock){
      const h=Math.max(60,Math.abs(lock.displayHeight)),w=Math.max(50,Math.abs(lock.displayWidth));
      const y=(frame.lockedGroundHeight??0)+(lock.presentationElevation??0)+h*.45;
      this.focusPoint.set(lock.x,y,lock.y).applyMatrix4(frame.camera.matrixWorldInverse);
      const depth=-this.focusPoint.z;
      if(depth>frame.camera.near){
        const span=2*depth*Math.tan(frame.camera.fov*Math.PI/360);
        this.common.lockDepth.value=depth;this.common.lockDepthRange.value=Math.max(45,h*.65+w*.2);
        this.common.lockRadius.value.set(w*.60/(span*frame.camera.aspect)+8/cssWidth,h*.60/span+8/cssHeight);
        this.focusPoint.set(lock.x,y,lock.y).project(frame.camera);
        this.common.lockUV.value.set((this.focusPoint.x+1)/2,(this.focusPoint.y+1)/2);this.common.lockEnabled.value=1;
      }
    }
    this.composite.uniforms.sourceColor.value=targets.world.texture;
    this.composite.uniforms.blurredColor.value=targets.vertical?.texture??targets.world.texture;
    this.composite.uniforms.sourceTexel.value.set(1/frame.width,1/frame.height);
    this.composite.uniforms.dofEnabled.value=Number(blurEnabled);
    this.composite.uniforms.bloomStrength.value=bloomEnabled ? .08+frame.night*.04 : 0;
    this.composite.uniforms.hazeStrength.value=effects.depthHaze?(frame.interior ? .035 : .08+(frame.weather?.mist??0)*.10)*(1-frame.night*.45):0;
    this.composite.uniforms.hazeColor.value.copy(this.hazeDay).lerp(this.hazeNight,frame.night);
    if(frame.sky)this.composite.uniforms.hazeColor.value.copy(frame.sky.horizon);
    this.composite.uniforms.gradingEnabled.value=Number(effects.cinematicColor);
    this.composite.uniforms.edgeSmoothing.value=Number(!low&&samples===0);
    const weather=frame.interior?undefined:frame.weather;
    const shafts=this.composite.uniforms;shafts.sunShafts.value=0;shafts.shaftSamples.value=low?4:8;
    if(effects.sunRays&&!frame.interior&&frame.sky&&frame.sky.sunlight.y>.02){
      const direction=frame.sky.sunlight;
      this.sunPoint.set(direction.x,direction.y,direction.z).transformDirection(frame.camera.matrixWorldInverse);
      if(this.sunPoint.z<-.01){
        this.sunPoint.set(direction.x,direction.y,direction.z).multiplyScalar(frame.camera.far*.5).add(frame.camera.position).project(frame.camera);
        const x=(this.sunPoint.x+1)/2,y=(this.sunPoint.y+1)/2;
        if(x>-.65&&x<1.65&&y>.62&&y<1.65){
          shafts.sunUV.value.set(x,y);
          shafts.sunShafts.value=Math.min(1,direction.y*3)*(1-frame.night)*Math.max(0,1-(weather?.cloudCover??0)*1.15)*Math.max(0,1-Math.max(0,-x,x-1,-y,y-1)/.65);
        }
      }
    }
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
      frame.afterWorldRender?.(targets.world.depthTexture!);
      if(filterEnabled&&targets.horizontal&&targets.vertical){
        const radius=low?3:5;
        this.quad.material=this.blur;this.blur.uniforms.sourceColor.value=targets.world.texture;
        this.blur.uniforms.bloomEnabled.value=Number(bloomEnabled);this.blur.uniforms.bloomFirstPass.value=1;
        this.blur.uniforms.direction.value.set(radius/cssWidth,0);this.blur.uniformsNeedUpdate=true;
        renderer.setRenderTarget(targets.horizontal);renderer.render(this.scene,this.camera);
        this.blur.uniforms.sourceColor.value=targets.horizontal.texture;
        this.blur.uniforms.bloomFirstPass.value=0;
        this.blur.uniforms.direction.value.set(0,radius/cssHeight);this.blur.uniformsNeedUpdate=true;
        renderer.setRenderTarget(targets.vertical);renderer.render(this.scene,this.camera);
      }
      this.quad.material=this.composite;this.composite.uniformsNeedUpdate=true;
      renderer.setRenderTarget(previous);renderer.render(this.scene,this.camera);
    }finally{renderer.setRenderTarget(previous);}
  }

  private prepareTargets(width:number,height:number,bw:number,bh:number,dof:boolean,samples:number):Targets {
    this.prepareWorld(width,height,samples);
    const targets=this.targets!;
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
