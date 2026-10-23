import {AddEquation,Color,CustomBlending,DynamicDrawUsage,InstancedBufferAttribute,InstancedMesh,LinearFilter,Matrix4,Mesh,NormalBlending,OneMinusSrcAlphaFactor,OrthographicCamera,PlaneGeometry,Scene,ShaderMaterial,Vector2,WebGLRenderTarget,ZeroFactor,Vector3,type Texture,type WebGLRenderer} from 'three';
import type Phaser from 'phaser';
import type {DayNightSystem} from '../systems/DayNightSystem';
import {presentationAttachmentWorld,presentationView} from './plane';
import {FOG_START,VIEW_DISTANCE} from './environment';
import {getEffectsQuality} from '../systems/effectsQuality';
import {getGraphicEffects} from '../systems/graphicsEffects';

const eraseVertex=`attribute vec4 light;varying vec2 localUV;void main(){localUV=uv;gl_Position=vec4(light.xy+position.xy*light.zw*2.0,0.0,1.0);}`;
const eraseFragment=`varying vec2 localUV;void main(){float r=length((localUV-.5)*2.0);if(r>1.0)discard;float a=r<.3?mix(.88,.65,r/.3):.65*(1.0-(r-.3)/.7);gl_FragColor=vec4(0.0,0.0,0.0,a);}`;
const overlayVertex=`varying vec2 screenUV;void main(){screenUV=uv;gl_Position=vec4(position.xy,0.0,1.0);}`;
const overlayFragment=`uniform sampler2D mask;uniform sampler2D worldDepth;uniform float darkness;uniform mat4 inverseVP;uniform vec2 focus;uniform vec2 fogRange;varying vec2 screenUV;void main(){
  float depth=texture2D(worldDepth,screenUV).r;if(depth>.999999)discard;
  vec4 p=inverseVP*vec4(screenUV*2.0-1.0,depth*2.0-1.0,1.0);
  float surface=1.0-smoothstep(fogRange.x,fogRange.y,distance(p.xz/p.w,focus));
  gl_FragColor=vec4(.0006,.0018,.005,texture2D(mask,screenUV).a*darkness*surface);
  #include <colorspace_fragment>
}`;

/** Bounded GPU destination-out light pockets; no full-screen canvas uploads.
 * The world depth excludes sky pixels from the ground's darkness veil. */
export class GpuNightMask {
  private readonly scene=new Scene();private readonly camera=new OrthographicCamera(-1,1,1,-1,0,1);
  private readonly geometry=new PlaneGeometry(1,1);private readonly overlayGeometry=new PlaneGeometry(2,2);
  private readonly lights=new InstancedBufferAttribute(new Float32Array(512*4),4).setUsage(DynamicDrawUsage);
  private readonly erase=new ShaderMaterial({vertexShader:eraseVertex,fragmentShader:eraseFragment,transparent:true,depthTest:false,depthWrite:false,
    blending:CustomBlending,blendEquation:AddEquation,blendSrc:ZeroFactor,blendDst:OneMinusSrcAlphaFactor,blendSrcAlpha:ZeroFactor,blendDstAlpha:OneMinusSrcAlphaFactor});
  private readonly holes=new InstancedMesh(this.geometry,this.erase,512);
  private readonly uniforms={mask:{value:null as Texture|null},worldDepth:{value:null as Texture|null},darkness:{value:0},inverseVP:{value:new Matrix4()},focus:{value:new Vector2()},fogRange:{value:new Vector2(FOG_START,VIEW_DISTANCE)}};
  private readonly material=new ShaderMaterial({uniforms:this.uniforms,vertexShader:overlayVertex,fragmentShader:overlayFragment,transparent:true,depthTest:false,depthWrite:false,blending:NormalBlending});
  private readonly overlay=new Mesh(this.overlayGeometry,this.material);
  private target:WebGLRenderTarget|undefined;private readonly color=new Color();
  private readonly point={x:0,y:0,z:0};private readonly edge={x:0,y:0,z:0};private readonly projected=new Vector3();
  constructor(screen:Scene){
    this.geometry.setAttribute('light',this.lights);this.holes.frustumCulled=false;this.scene.add(this.holes);
    this.overlay.frustumCulled=false;this.overlay.renderOrder=1_000_000;this.overlay.visible=false;screen.add(this.overlay);
  }
  active(night:number,interior:boolean){return night>0&&!interior&&getGraphicEffects().nightDarkness;}
  render(renderer:WebGLRenderer,scene:Phaser.Scene,source:DayNightSystem|undefined,depth:Texture|null,night:number,interior:boolean,density:number){
    this.overlay.visible=this.active(night,interior)&&Boolean(source&&depth);
    if(!this.overlay.visible||!source||!depth){this.release();return;}
    const low=getEffectsQuality()==='low',camera=scene.cameras.main;
    const width=Math.max(1,Math.min(1280,Math.round(camera.width/density*(low?.65:1)))),height=Math.max(1,Math.min(960,Math.round(camera.height/density*(low?.65:1))));
    if(!this.target)this.target=new WebGLRenderTarget(width,height,{depthBuffer:false,stencilBuffer:false,minFilter:LinearFilter,magFilter:LinearFilter,generateMipmaps:false});
    else if(this.target.width!==width||this.target.height!==height)this.target.setSize(width,height);
    const view=presentationView(scene);
    if(!view){this.overlay.visible=false;this.release();return;}
    let count=0;
    for(const node of source.gpuLights()){
      const actor=node.actor;if(!actor.active||!actor.visible||actor.cameraFilter&camera.id)continue;
      // Never project lights behind the camera: perspective division can
      // otherwise turn a rearward lantern into a fullscreen darkness eraser.
      presentationAttachmentWorld(scene,actor,actor.x+node.x,actor.y+node.y,this.point);
      this.projected.set(this.point.x,this.point.y,this.point.z).applyMatrix4(view.camera.matrixWorldInverse);
      const depth=-this.projected.z;
      if(!Number.isFinite(depth)||depth<=view.camera.near||depth>=view.camera.far)continue;
      this.projected.set(this.point.x,this.point.y,this.point.z).project(view.camera);
      const x=this.projected.x,y=this.projected.y;
      if(!Number.isFinite(x)||!Number.isFinite(y)||this.projected.z < -1||this.projected.z > 1)continue;
      presentationAttachmentWorld(scene,actor,actor.x+node.x+node.radius,actor.y+node.y,this.edge);
      this.projected.set(this.edge.x,this.edge.y,this.edge.z).applyMatrix4(view.camera.matrixWorldInverse);
      if(-this.projected.z<=view.camera.near)continue;
      this.projected.set(this.edge.x,this.edge.y,this.edge.z).project(view.camera);
      if(!Number.isFinite(this.projected.x))continue;
      const rx=Math.min(1.2,Math.abs(this.projected.x-x)),ry=rx*camera.width/camera.height;
      if(rx<=0||x+rx<-1||x-rx>1||y+ry<-1||y-ry>1)continue;
      const flicker=node.fire?.96+Math.sin(source.presentationTime*.013+node.phase)*.04:1;
      this.lights.setXYZW(count++,x,y,rx*flicker,ry*flicker);
      if(count>=(low?18:512))break;
    }
    this.holes.count=count;this.holes.visible=count>0;this.lights.clearUpdateRanges();if(count){this.lights.addUpdateRange(0,count*4);this.lights.needsUpdate=true;}
    const previous=renderer.getRenderTarget(),alpha=renderer.getClearAlpha();renderer.getClearColor(this.color);
    try{renderer.setRenderTarget(this.target);renderer.setClearColor(0x000000,1);renderer.clear();if(count)renderer.render(this.scene,this.camera);}
    finally{renderer.setRenderTarget(previous);renderer.setClearColor(this.color,alpha);}
    this.uniforms.mask.value=this.target.texture;this.uniforms.worldDepth.value=depth;this.uniforms.darkness.value=night*.84;
    this.uniforms.inverseVP.value.multiplyMatrices(view.camera.projectionMatrix,view.camera.matrixWorldInverse).invert();
    this.uniforms.focus.value.set(view.focusGround.x,view.focusGround.y);
  }
  private release(){this.target?.dispose();this.target=undefined;this.uniforms.mask.value=null;this.uniforms.worldDepth.value=null;}
  destroy(){this.release();this.overlay.removeFromParent();this.holes.dispose();this.geometry.dispose();this.overlayGeometry.dispose();this.erase.dispose();this.material.dispose();this.scene.clear();}
}
