import {frameWork,releaseFrameWork} from './FrameWorkBudget';
import {FrameTiming} from './FrameTiming';
import {GpuTimer} from './GpuTimer';
import {ShaderWarmup} from './ShaderWarmup';
import {staticSpatialIndex} from './StaticSpatialIndex';
import {StreamVisibility} from './StreamVisibility';
import {bindResourcePreparation,clearResourcePreparation} from './resourcePreparation';
import Phaser from 'phaser';
import {
  Matrix4,OrthographicCamera,Raycaster,Scene,Vector2,Vector3,Vector4,WebGLRenderer,
  Mesh,PlaneGeometry,MeshBasicMaterial,SRGBColorSpace,Color,
  type Intersection,type Object3D,type Texture,
} from 'three';
import {SpriteBatch,pruneSpriteBatches} from './SpriteBatch';
import {OrbitCamera} from './OrbitCamera';
import {ElevationField,TERRAIN_GRID_SEGMENTS} from './ElevationField';
import {FRAME_DIAGNOSTICS_EVENT,getFrameDiagnosticsEnabled} from './renderDiagnostics';
import {getEffectsQuality} from '../systems/effectsQuality';
import {createHouseGeometry,createWallGeometry} from './HouseGeometry';
import {RenderBudget} from './RenderBudget';
import {getGraphicEffects} from '../systems/graphicsEffects';
import {RasterCache} from './RasterCache';
import {TextureCache} from './TextureCache';
import {WorldPostFX} from './WorldPostFX';
import {GpuSky} from './GpuSky';
import {GpuShadows} from './GpuShadows';
import {GpuCloudShadows} from './GpuCloudShadows';
import {GpuWeather} from './GpuWeather';
import {GpuNightMask} from './GpuNightMask';
import {GpuWater} from './GpuWater';
import {VIEW_DISTANCE,FOG_START} from './environment';
import type {GroundShadowSystem} from '../systems/GroundShadowSystem';
import type {WeatherSystem} from '../systems/WeatherSystem';
import type {DayNightSystem} from '../systems/DayNightSystem';
import type {WaterSurfaceSystem} from '../systems/WaterSurfaceSystem';
import {renderDensity} from '../systems/renderSizing';
import {nightStrength} from '../../data/environmentLights';
import {TELEGRAPH_PRESENTATION,type TelegraphPresentation} from '../systems/AttackTelegraph';
import {useGameStore} from '../../store/gameStore';
import {PRESENTATION_HINT,uprightPoint,bindPresentationView,clearPresentationView,type PresentationView,type PresentationHint,type PresentationPlane} from './plane';
import {GAME_DISPOSING} from '../systems/gameLifetime';

type ImageObject=Phaser.GameObjects.Image|Phaser.GameObjects.Sprite|Phaser.GameObjects.Text;
type DrawingObject=ImageObject|Phaser.GameObjects.Graphics|Phaser.GameObjects.Shape|Phaser.GameObjects.TileSprite;
interface LocalRect {left:number;top:number;width:number;height:number}
interface StaticPacket {
  frame:Phaser.Textures.Frame;hint:PresentationHint|undefined;source:Phaser.Textures.TextureSource;texture:Texture;
  x:number;y:number;scaleX:number;scaleY:number;rotation:number;originX:number;originY:number;depth:number;
  alpha:number;flipX:boolean;flipY:boolean;fillTint:boolean;blendMode:Phaser.GameObjects.Image['blendMode'];mask:Phaser.GameObjects.Image['mask'];billboard:boolean;ground:boolean;interior:boolean;key:string;
  matrix:Matrix4;rect:LocalRect;uv:Float64Array;colors:Uint32Array;repeat?:Float64Array;
}
// Phaser 3.90 exposes these fields at runtime but omits them from its declarations.
interface CameraEffectChannels {red:number;green:number;blue:number;alpha:number}
interface PresentedTileSprite extends Phaser.GameObjects.TileSprite {displayFrame:Phaser.Textures.Frame}
interface PresentationScene extends Phaser.Scene {
  readonly presentationFocus?:Readonly<{x:number;y:number}>;
  readonly inInterior?:boolean;
  readonly presentationHeightAt?:(x:number,y:number)=>number;
  readonly presentationControlsEnabled?:boolean;
  readonly presentationPause?:()=>void;
  readonly presentationShadows?:GroundShadowSystem;
  readonly presentationWeather?:WeatherSystem;
  readonly presentationLighting?:DayNightSystem;
  readonly presentationWater?:WaterSurfaceSystem;
}
const VERTICES=[[-.5,-.5],[.5,-.5],[-.5,.5],[.5,.5],[0,0]] as const;
function sceneWhiteSource(scene:Phaser.Scene){return scene.textures.getFrame('__WHITE')?.source;}

/** Presentation adapter for the complete existing game. The original scene
 * remains the sole owner of time, physics, AI, streaming, combat and saves.
 * CanvasRenderer prepares existing art; only Three.js draws the world. */
export class ThreePresentation {
  private readonly renderer:WebGLRenderer;
  private readonly gpuTimer:GpuTimer;
  private readonly shaderWarmup:ShaderWarmup;
  private readonly frameTiming=new FrameTiming();
  private readonly visibility=new StreamVisibility();
  private timingFrame=-1;
  private readonly billboardRight={value:new Vector2(1,0)};
  private readonly neutralModel=new Matrix4();
  private readonly staticPackets=new WeakMap<Phaser.GameObjects.Image,StaticPacket>();
  private readonly world=new Scene();
  private readonly background=new Scene();
  private readonly screen=new Scene();
  private readonly orbit:OrbitCamera;
  private readonly elevation=new ElevationField();
  private readonly budget:RenderBudget;
  private renderScale=0;
  private interior=false;
  private heightEnabled=false;
  private readonly heightAt=(x:number,y:number)=>this.heightEnabled?this.elevation.height(x,y):0;
  private view:PresentationView|undefined;
  private readonly screenCamera=new OrthographicCamera(0,1,0,1,-100,100);
  private readonly effectGeometry=new PlaneGeometry(1,1);
  private readonly flash=new Mesh(this.effectGeometry,new MeshBasicMaterial({transparent:true,depthTest:false,depthWrite:false}));
  private readonly fade=new Mesh(this.effectGeometry,new MeshBasicMaterial({transparent:true,depthTest:false,depthWrite:false}));
  private readonly batches=new Map<string,SpriteBatch>();
  private readonly textures=new TextureCache();
  private readonly postFX:WorldPostFX;
  private readonly sky:GpuSky;
  private readonly gpuShadows:GpuShadows;
  private readonly gpuClouds:GpuCloudShadows;
  private readonly gpuWeather:GpuWeather;
  private readonly gpuNight:GpuNightMask;
  private readonly gpuWater:GpuWater;
  private readonly atmosphere={fogFocus:{value:new Vector2()},fogColor:{value:new Color()},fogRange:{value:new Vector2()}};
  private readonly rasters:RasterCache;
  private readonly transform=new Phaser.GameObjects.Components.TransformMatrix();
  private readonly parentTransform=new Phaser.GameObjects.Components.TransformMatrix();
  private readonly model=new Matrix4();
  private readonly p0=new Vector3();private readonly p1=new Vector3();private readonly p2=new Vector3();
  private readonly projected=new Vector3();
  private readonly subject=new Vector3();
  private readonly projectedBounds={left:0,right:0,top:0,bottom:0,depth:0};
  private readonly localRect:LocalRect={left:0,top:0,width:0,height:0};
  private readonly atlasUV=new Float64Array(4);
  private readonly tileRepeat=new Float64Array(4);
  private readonly colors=new Uint32Array(4);
  private yawCos=1;private yawSin=0;private pitchSin=0;private pitchCos=1;private pitchTan=0;
  private readonly ray=new Raycaster();
  private readonly pointer=new Vector2();
  private readonly hits:Intersection<Object3D>[]=[];
  private readonly pickable:Object3D[]=[];
  private frame=0;private stopped=false;private width=0;private height=0;
  private readonly originalRender:Phaser.Renderer.Canvas.CanvasRenderer['render'];
  private readonly native:Phaser.Renderer.Canvas.CanvasRenderer;
  private readonly originalCanvasVisibility:string;
  private readonly originalMouseEnabled:boolean|undefined;
  private readonly originalTouchEnabled:boolean|undefined;
  private readonly missing=new Set<string>();
  private readonly masks=new WeakMap<Phaser.GameObjects.Graphics,{id:number;rects:Vector4[]}>();
  private nextMaskId=1;
  private frameDiagnostics=getFrameDiagnosticsEnabled();
  private diagnosticsParent:HTMLElement|null=null;
  private diagnosticsPanel:HTMLPreElement|null=null;
  private readonly diag={frames:0,total:0,worst:0,collect:0,render:0,deltaMax:0};
  private diagnosticAt=0;
  private readonly onDiagnosticChange=(event:Event)=>{this.frameDiagnostics=(event as CustomEvent<boolean>).detail;this.game.registry.set('presentationDiagnostics',this.frameDiagnostics);this.syncDiagnosticsPanel();};

  constructor(private readonly game:Phaser.Game,parent:HTMLElement){
    if(!(game.renderer instanceof Phaser.Renderer.Canvas.CanvasRenderer))throw new Error('2.5D requires the Phaser canvas compatibility backend');
    this.native=game.renderer;this.originalRender=this.native.render;this.rasters=new RasterCache(this.native);
    // On tile-based mobile GPUs default framebuffer MSAA can duplicate
    // bandwidth costs on top of the world/depth postprocessing targets.
    // Normal preserves detail on both platforms; Low remains an explicit choice.
    this.renderer=new WebGLRenderer({alpha:false,antialias:getEffectsQuality()!=='low',powerPreference:'high-performance'});
    const context=this.renderer.getContext();if(!('beginQuery' in context))throw new Error('2.5D requires WebGL 2');
    this.gpuTimer=new GpuTimer(context);
    this.budget=new RenderBudget();
    // The game submits multiple Three.js render passes per frame. Keep their
    // draw call totals, rather than resetting renderer.info after each pass.
    this.renderer.info.autoReset=false;
    this.renderer.setPixelRatio(1);this.renderer.autoClear=false;
    this.postFX=new WorldPostFX();
    this.sky=new GpuSky();this.gpuShadows=new GpuShadows(this.world,this.textures,this.elevation,this.atmosphere);
    this.gpuClouds=new GpuCloudShadows(this.world,this.elevation,this.atmosphere);
    this.gpuWeather=new GpuWeather(this.screen,this.elevation);this.gpuNight=new GpuNightMask(this.screen);
    this.gpuWater=new GpuWater(this.world,this.elevation,this.atmosphere,this.textures);
    this.flash.renderOrder=Number.MAX_SAFE_INTEGER-1;this.fade.renderOrder=Number.MAX_SAFE_INTEGER;
    this.flash.visible=this.fade.visible=false;this.screen.add(this.flash,this.fade);
    const canvas=this.renderer.domElement;canvas.className='three-world-canvas';
    canvas.setAttribute('aria-label','Tales of Leighneron 2.5D world');
    Object.assign(canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',touchAction:'none'});
    parent.append(canvas);
    this.diagnosticsParent=parent;this.syncDiagnosticsPanel();
    game.registry.set('presentationDiagnostics',this.frameDiagnostics);
    window.addEventListener(FRAME_DIAGNOSTICS_EVENT,this.onDiagnosticChange);
    this.orbit=new OrbitCamera(canvas,parent,this.onPointer,()=>{for(const scene of this.game.scene.getScenes(true))(scene as PresentationScene).presentationPause?.();});
    this.shaderWarmup=new ShaderWarmup(this.renderer,this.orbit.camera,this.elevation,this.atmosphere);
    void this.postFX.warm(this.renderer);
    bindResourcePreparation(game,{request:source=>{this.textures.get(source,this.frame);},ready:source=>this.textures.ready(source)});
    this.originalCanvasVisibility=game.canvas.style.visibility;game.canvas.style.visibility='hidden';
    this.originalMouseEnabled=game.input.mouse?.enabled;this.originalTouchEnabled=game.input.touch?.enabled;
    if(game.input.mouse)game.input.mouse.enabled=false;if(game.input.touch)game.input.touch.enabled=false;
    canvas.addEventListener('webglcontextlost',this.onContextLost);
    // The scene manager still executes its normal camera pre-render and emits
    // POST_RENDER only after this draw, preserving world-ready/save protection.
    this.native.render=(scene,children,camera)=>this.draw(scene,children,camera);
    game.events.once(GAME_DISPOSING,this.destroy,this);
    game.events.once(Phaser.Core.Events.DESTROY,this.destroy,this);
    game.registry.set('presentation','three-2.5d');
  }

  private draw(scene:Phaser.Scene,children:Phaser.GameObjects.GameObject[],camera:Phaser.Cameras.Scene2D.Camera){
    if(this.stopped)return;
    const profStart=this.frameDiagnostics?performance.now():0;
    if('renderToTexture' in camera&&camera.renderToTexture){this.originalRender.call(this.native,scene,children,camera);return;}
    this.frame++;
    const work=frameWork(this.game);
    this.gpuTimer.poll();
    if(this.frameDiagnostics&&this.timingFrame!==this.game.loop.frame){this.frameTiming.add(this.game.loop.rawDelta);this.timingFrame=this.game.loop.frame;}
    const adaptive=getGraphicEffects().adaptiveResolution;
    const sampleGpu=(this.frameDiagnostics||adaptive)&&this.frame%(this.frameDiagnostics?4:12)===0;
    this.textures.prepare(this.renderer,work);
    this.renderer.info.reset();
    this.native.emit(Phaser.Renderer.Events.RENDER,scene,camera);
    const width=this.game.scale.width,height=this.game.scale.height;
    const presentation=scene as PresentationScene,density=renderDensity(scene);
    const scale=this.budget.scale(width,height,density,this.game.loop.rawDelta,adaptive,presentation.presentationControlsEnabled===true,this.gpuTimer.milliseconds);
    if(this.width!==width||this.height!==height||Math.abs(this.renderScale-scale)>.001){
      this.width=width;this.height=height;this.renderScale=scale;this.renderer.setDrawingBufferSize(width,height,scale);
      this.screenCamera.right=width;this.screenCamera.bottom=height;this.screenCamera.updateProjectionMatrix();
    }
    this.interior=presentation.inInterior===true;
    this.heightEnabled=!this.interior&&Boolean(presentation.presentationHeightAt);
    if(presentation.presentationHeightAt)this.elevation.setSource(presentation.presentationHeightAt);
    this.orbit.update(camera,presentation.presentationFocus??camera.midPoint,this.heightAt,this.game.loop.delta,presentation.presentationControlsEnabled===true);
    this.visibility.update(this.orbit.camera,this.orbit.focusGround);
    this.yawCos=Math.cos(this.orbit.yaw);this.yawSin=Math.sin(this.orbit.yaw);
    this.billboardRight.value.set(this.yawCos,-this.yawSin);
    this.pitchSin=Math.sin(this.orbit.pitch);this.pitchCos=Math.cos(this.orbit.pitch);this.pitchTan=Math.tan(this.orbit.pitch);
    if(!this.view)this.view={camera:this.orbit.camera,native:camera,yaw:this.orbit.yaw,pitch:this.orbit.pitch,
      bounds:this.orbit.bounds,focusGround:this.orbit.focusGround,height:this.heightAt,visibility:this.visibility};
    else{this.view.native=camera;this.view.yaw=this.orbit.yaw;this.view.pitch=this.orbit.pitch;}
    bindPresentationView(scene,this.view);
    const focus=this.orbit.focusGround;
    this.subject.set(focus.x,this.heightAt(focus.x,focus.y)+28,focus.y).project(this.orbit.camera);
    this.elevation.prepare(this.orbit.bounds,this.heightEnabled,this.orbit.focusGround);
    const state=useGameStore.getState(),minute=(presentation.presentationLighting?.getHour()??state.minuteOfDay/60)*60,night=nightStrength(minute),weather=presentation.presentationWeather;
    if(presentation.presentationFocus&&!this.interior)this.sky.update(this.orbit.camera,minute,night,weather?.presentation);
    this.atmosphere.fogFocus.value.set(focus.x,focus.y);this.atmosphere.fogColor.value.copy(this.sky.horizon);
    this.atmosphere.fogRange.value.set(this.interior?0:FOG_START,this.interior?0:VIEW_DISTANCE);
    this.gpuShadows.update(scene,presentation.presentationShadows,minute,weather?.cloudCover??0,this.orbit.yaw,this.frame,this.interior,this.orbit.bounds);
    this.gpuClouds.update(this.sky.artwork,this.sky.ready,focus,minute,weather?.presentation,this.interior||!presentation.presentationFocus);
    this.gpuWater.update(scene,presentation.presentationWater,focus,this.frame,this.interior);
    this.gpuWeather.update(weather,this.orbit.camera,focus,night,this.interior,this.orbit.bounds);
    for(const batch of this.batches.values())batch.begin();
    camera.emit(Phaser.Cameras.Scene2D.Events.PRE_RENDER,camera);
    const spatial=staticSpatialIndex(scene);spatial.query(this.orbit.bounds);
    for(const object of children)if(spatial.accepts(object,this.visibility))this.collect(object,camera,1,undefined,undefined);
    this.pickable.length=0;
    for(const batch of this.batches.values()){
      batch.finish();
      if(batch.mesh.visible&&(batch.interactive||batch.mesh.userData.presentationOccluder)&&batch.mesh.parent===this.world)this.pickable.push(batch.mesh);
    }
    const retireStart=performance.now(),retireMs=work.remaining('retire',.3);
    pruneSpriteBatches(this.batches,this.frame,80,2,retireStart+retireMs);
    if(performance.now()-retireStart<retireMs)this.textures.prune(this.frame);
    if(performance.now()-retireStart<retireMs)this.rasters.prune(this.frame);
    work.charge('retire',retireStart);
    const profCollect=this.frameDiagnostics?performance.now():0;
    this.gpuTimer.begin(sampleGpu);
    this.renderer.setClearColor(camera.backgroundColor.color,1);this.renderer.clear();
    this.syncCameraEffect(this.flash,camera.flashEffect.isRunning?camera.flashEffect:undefined);
    this.syncCameraEffect(this.fade,camera.fadeEffect.isRunning||camera.fadeEffect.isComplete?camera.fadeEffect:undefined);
    const nightActive=this.gpuNight.active(night,this.interior);
    const mergeNight=nightActive&&!this.screen.children.some(object=>object.visible&&object.renderOrder<1_000_000);
    if(nightActive){
      const depth=this.postFX.prepareWorld(this.renderer.domElement.width,this.renderer.domElement.height);
      this.gpuNight.render(this.renderer,scene,presentation.presentationLighting,depth,night,this.interior,density,mergeNight);
    }else this.gpuNight.render(this.renderer,scene,presentation.presentationLighting,null,night,this.interior,density);
    const nightComposition=this.gpuNight.composition;
    this.postFX.setNight(mergeNight?nightComposition.mask:null,nightComposition.darkness);
    this.postFX.render(this.renderer,{world:this.world,camera:this.orbit.camera,background:this.background,backgroundCamera:this.screenCamera,
      width:this.renderer.domElement.width,height:this.renderer.domElement.height,density:density*this.renderScale,focus:presentation.presentationFocus,
      focusHeight:presentation.presentationFocus?this.heightAt(presentation.presentationFocus.x,presentation.presentationFocus.y):0,
      night,interior:this.interior,sky:presentation.presentationFocus&&!this.interior?this.sky:undefined,
      depthNeeded:this.gpuWeather.needsDepth||this.gpuNight.active(night,this.interior),weather:weather?.presentation,mist:this.gpuWeather.fog});
    this.gpuWeather.setDepth(this.postFX.depth,this.renderer.domElement.width,this.renderer.domElement.height);

    const profRender=this.frameDiagnostics?performance.now():0;
    // Screen-space UI, weather, darkness and camera transitions stay sharp and
    // retain their existing order after world focus/colour processing.
    this.renderer.clearDepth();this.renderer.render(this.screen,this.screenCamera);
    this.gpuTimer.end();
    camera.dirty=false;
    camera.emit(Phaser.Cameras.Scene2D.Events.POST_RENDER,camera);
    if(!this.stopped){
      // Uploads have a reserved share of the same allowance used by streaming.
      const elevationStart=performance.now(),elevationMs=work.remaining('elevation',.5);
      if(elevationMs>0)this.elevation.preload(this.orbit.bounds,this.heightEnabled&&presentation.presentationControlsEnabled===true,elevationMs);
      work.charge('elevation',elevationStart);
    }
    if(this.frameDiagnostics)this.recordDiagnostics(profStart,profCollect,profRender,performance.now());
  }

  private syncDiagnosticsPanel(){
    if(!this.frameDiagnostics){this.diagnosticsPanel?.remove();this.diagnosticsPanel=null;return;}
    if(!this.diagnosticsParent||this.diagnosticsPanel)return;
    const panel=document.createElement('pre');
    panel.setAttribute('aria-label','2.5D rendering diagnostics');
    Object.assign(panel.style,{position:'absolute',left:'8px',top:'8px',zIndex:'30',
      background:'rgba(0,0,0,.82)',color:'#ffffff',padding:'8px',
      font:'11px/1.4 monospace',whiteSpace:'pre',pointerEvents:'none',
      borderRadius:'4px',maxWidth:'95vw'});
    panel.textContent='Measuring 2.5D frame pacing...';
    this.diagnosticsPanel=panel;this.diagnosticsParent.append(panel);
  }
  private recordDiagnostics(start:number,collected:number,world:number,done:number){
    const d=this.diag;
    d.frames++;d.total+=done-start;d.collect+=collected-start;d.render+=world-collected;
    d.worst=Math.max(d.worst,done-start);d.deltaMax=Math.max(d.deltaMax,this.game.loop.rawDelta);
    if(done-this.diagnosticAt<1000)return;
    const frames=Math.max(1,d.frames);
    const textureCache=this.textures.stats();
    const stream=this.game.registry.get('presentationStreamPerf') as {
      active:number;pending:number;visibleMissing:number;fallbacks:number;terrainCache:number;retiring:number
    }|undefined;
    const renderInfo=this.renderer.info.render;
    const pacing=this.frameTiming.stats();
    const result={pacing,gpuMs:this.gpuTimer.milliseconds,simulationCpuMs:this.game.registry.get('simulationCpuMs') as number|undefined,
      backgroundWork:frameWork(this.game).stats(),drawCalls:renderInfo.calls,triangles:renderInfo.triangles,
      cpuAvgMs:d.total/frames,cpuPeakMs:d.worst,
      collectionAvgMs:d.collect/frames,renderAvgMs:d.render/frames,
      longestFrameMs:d.deltaMax,shaderBatches:this.batches.size,
      gpuTextures:this.renderer.info.memory.textures,textureCache,stream};
    this.game.registry.set('presentationPerf',result);
    if(this.diagnosticsPanel){
      const n=(v:number)=>v.toFixed(1);
      this.diagnosticsPanel.textContent='2.5D frame pacing (ms)\n'
        +'Raw frame p50/p95/p99: '+n(pacing.p50)+' / '+n(pacing.p95)+' / '+n(pacing.p99)+'\n'
        +'Raw peak: '+n(pacing.maximum)+' | >33ms '+pacing.over33+' | >50ms '+pacing.over50+' / '+pacing.samples+'\n'
        +'Simulation CPU: '+n(result.simulationCpuMs??0)+' | GPU: '+(result.gpuMs===null?'unavailable':n(result.gpuMs))+'\n'
        +'Presentation CPU avg/peak: '+n(result.cpuAvgMs)+' / '+n(result.cpuPeakMs)+'\n'
        +'Collect/render avg: '+n(result.collectionAvgMs)+' / '+n(result.renderAvgMs)+'\n'
        +'Draw calls: '+result.drawCalls+' | Triangles: '+result.triangles+'\n'
        +'Batches: '+result.shaderBatches+' | GPU textures: '+result.gpuTextures+'\n'
        +'Resident cache: '+textureCache.residentMiB+' MiB / '+textureCache.textures
          +' | cold '+textureCache.coldCreates+' | evict '+textureCache.evictions+'\n'
        +'Upload queue: '+textureCache.pendingUploads+' | Background: '+n(result.backgroundWork.usedMs)+' / '+n(result.backgroundWork.allowanceMs)+'\n'
        +(stream?'Terrain: '+stream.active+' active, '+stream.pending+' pending'
          +', '+stream.visibleMissing+' missing, '+stream.terrainCache+' cached':'Terrain: not ready');
    }
    Object.assign(d,{frames:0,total:0,worst:0,collect:0,render:0,deltaMax:0});
    this.diagnosticAt=done;
  }

  private syncCameraEffect(mesh:Mesh<PlaneGeometry,MeshBasicMaterial>,effect?:Phaser.Cameras.Scene2D.Effects.Flash|Phaser.Cameras.Scene2D.Effects.Fade){
    const channels=effect as (typeof effect&CameraEffectChannels)|undefined;
    mesh.visible=Boolean(channels&&channels.alpha>0);
    if(!channels||!mesh.visible)return;
    mesh.position.set(this.width/2,this.height/2,0);mesh.scale.set(this.width,this.height,1);
    mesh.material.color.setRGB(channels.red/255,channels.green/255,channels.blue/255,SRGBColorSpace);
    mesh.material.opacity=channels.alpha;
  }

  private collect(object:Phaser.GameObjects.GameObject,camera:Phaser.Cameras.Scene2D.Camera,parentAlpha:number,inherited?:PresentationHint,parentAnchor?:{x:number;y:number}){
    if(!object.active||!('visible' in object)||!object.visible||object.cameraFilter&camera.id)return;
    let alpha=parentAlpha*('alpha' in object&&typeof object.alpha==='number'?object.alpha:1);
    if(alpha<=.001)return;
    const explicit=object.getData(PRESENTATION_HINT) as PresentationHint|undefined;
    if(object instanceof Phaser.GameObjects.Container){
      const hint=explicit??inherited??{plane:'upright'};
      const matrix=object.getWorldTransformMatrix(this.transform,this.parentTransform);
      const anchor=parentAnchor??{x:matrix.tx,y:matrix.ty};
      for(const child of object.list)this.collect(child,camera,alpha,hint,anchor);
      return;
    }
    if(!(object instanceof Phaser.GameObjects.Image||object instanceof Phaser.GameObjects.Sprite||object instanceof Phaser.GameObjects.Text
      ||object instanceof Phaser.GameObjects.Graphics||object instanceof Phaser.GameObjects.Shape||object instanceof Phaser.GameObjects.TileSprite)){
      if(!this.missing.has(object.type)){this.missing.add(object.type);console.warn('[2.5d] Unsupported presentation object',object.type);}return;
    }
    const emissionOwner=object.getData('emissionOwner') as Phaser.GameObjects.Sprite|undefined;
    const hint:PresentationHint|undefined=explicit??inherited??(emissionOwner?{plane:'upright',anchor:emissionOwner}:undefined);
    const plane=hint?.plane??this.defaultPlane(object);
    const house=hint?.house??(emissionOwner?.getData(PRESENTATION_HINT) as PresentationHint|undefined)?.house;
    const houseVolume=Boolean(house)&&!emissionOwner&&!hint?.overlay;
    const wallDepth=!emissionOwner&&!hint?.overlay?hint?.wall?.thickness??0:0;
    const volumeDepth=houseVolume?house!.depth:wallDepth;
    const staticImage=object instanceof Phaser.GameObjects.Image&&staticSpatialIndex(object.scene).has(object)
      &&!object.parentContainer&&!hint?.anchor&&!hint?.overlay&&!house&&!hint?.beam&&!hint?.worldDirection&&!hint?.wall&&!hint?.depthOffset
      &&!object.isCropped&&(plane==='ground'||plane==='upright'&&!object.input?.enabled);
    if(staticImage&&this.collectStatic(object,camera,alpha,hint))return;
    // Conservative early culling. The old code rasterized offscreen Graphics
    // and calculated matrices/elevation for offscreen sprites before inView().
    // Unanchored objects can be rejected using their actual world positions;
    // keep all attachments/containers and screen overlays on the normal path.
    if(plane!=='screen'&&!hint?.overlay&&!hint?.anchor&&!emissionOwner
      &&!object.parentContainer
      &&(object instanceof Phaser.GameObjects.Image
        ||object instanceof Phaser.GameObjects.Sprite
        ||object instanceof Phaser.GameObjects.TileSprite)){
      const bounds=this.orbit.bounds;
      const extent=Math.max(Math.abs(object.displayWidth),Math.abs(object.displayHeight));
      const margin=Math.max(960,extent*1.7+512);
      if(object.x<bounds.left-margin||object.x>bounds.right+margin
        ||object.y<bounds.top-margin||object.y>bounds.bottom+margin)return;
    }
    const warning=object.getData(TELEGRAPH_PRESENTATION) as TelegraphPresentation|undefined;
    const warningArea=warning?.area;
    let texture:Texture|undefined,source:Phaser.Textures.TextureSource|undefined;
    const rect=this.localRect,uv=this.atlasUV;
    let repeat:Float64Array|undefined;
    const tiled=object instanceof Phaser.GameObjects.TileSprite;
    if(warningArea){
      const r=warningArea.radius,range=warningArea.kind==='line'?(warningArea.range??r):0;
      source=sceneWhiteSource(object.scene);
      rect.left=-r-3;rect.top=-r-3;rect.width=range+r*2+6;rect.height=r*2+6;
      uv[0]=warningArea.kind==='circle'?0:warningArea.kind==='ring'?1:warningArea.kind==='line'?2:3;
      uv[1]=r;uv[2]=warningArea.range??r;uv[3]=warningArea.innerRadius??0;
      repeat=this.tileRepeat;repeat[0]=warning.progress;repeat[1]=warningArea.halfAngle??Math.acos(.6);repeat[2]=Number(warningArea.flatEnd===true);repeat[3]=0;
    }else if(tiled){
      const frame=(object as PresentedTileSprite).displayFrame;
      if(!frame?.source?.image||!object.tileScaleX||!object.tileScaleY)return;
      source=frame.source;
      rect.left=-object.displayOriginX;rect.top=-object.displayOriginY;rect.width=object.width;rect.height=object.height;
      uv[0]=(frame.cutX+.25)/frame.source.width;uv[1]=1-(frame.cutY+frame.cutHeight-.25)/frame.source.height;
      uv[2]=(frame.cutWidth-.5)/frame.source.width;uv[3]=(frame.cutHeight-.5)/frame.source.height;
      const rx=object.width/(frame.width*object.tileScaleX),ry=object.height/(frame.height*object.tileScaleY);
      repeat=this.tileRepeat;repeat[0]=rx;repeat[1]=ry;repeat[2]=object.tilePositionX/frame.width;repeat[3]=-object.tilePositionY/frame.height-ry;
    }else if(object instanceof Phaser.GameObjects.Graphics||object instanceof Phaser.GameObjects.Shape){
      const raster=this.rasters.get(object,this.frame);if(!raster)return;
      texture=raster.texture;rect.left=raster.left;rect.top=raster.top;rect.width=raster.width;rect.height=raster.height;
      uv[0]=uv[1]=0;uv[2]=uv[3]=1;
    }else{
      const frame=object.frame;if(!frame?.source?.image)return;
      source=frame.source;
      // Text canvases can use a 2x backing buffer even when the Phaser
      // TextureSource keeps resolution=1. Without this correction name labels
      // become huge dark panels instead of crisp text above NPCs.
      const resolution=object instanceof Phaser.GameObjects.Text
        ?Math.max(1,frame.cutWidth/Math.max(1,object.width)):(frame.source.resolution||1);
      // Atlas cutting coordinates belong in UVs, not in world-space geometry.
      // Only genuinely trimmed frames carry a local sprite-source offset.
      let left=-object.displayOriginX+(frame.trimmed?frame.x:0),top=-object.displayOriginY+(frame.trimmed?frame.y:0);
      let w=frame.cutWidth,h=frame.cutHeight,sx=frame.cutX,sy=frame.cutY;
      const flipX='flipX' in object&&object.flipX,flipY='flipY' in object&&object.flipY;
      if('isCropped' in object&&object.isCropped){
        interface Crop {x:number;y:number;width:number;height:number;cx:number;cy:number;cw:number;ch:number;flipX:boolean;flipY:boolean}
        const crop={...(object as ImageObject&{_crop:Crop})._crop};
        frame.updateCropUVs(crop,flipX,flipY);
        w=crop.cw;h=crop.ch;sx=crop.cx;sy=crop.cy;
        left=-object.displayOriginX+crop.x;top=-object.displayOriginY+crop.y;
        // Match the original WebGL sprite path: crop UVs account for source
        // flips; mirror the local rectangle once in the common branch below.
      }
      if(flipX&&!frame.customPivot)left+=-frame.realWidth+object.displayOriginX*2;
      if(flipY&&!frame.customPivot)top+=-frame.realHeight+object.displayOriginY*2;
      if(flipX)left=-left-w/resolution;if(flipY)top=-top-h/resolution;
      rect.left=left;rect.top=top;rect.width=w/resolution;rect.height=h/resolution;
      const inset=.25,sw=frame.source.width,sh=frame.source.height;
      let u=(sx+inset)/sw,v=1-(sy+h-inset)/sh,du=(w-inset*2)/sw,dv=(h-inset*2)/sh;
      if(flipX){u+=du;du=-du;}if(flipY){v+=dv;dv=-dv;}
      uv[0]=u;uv[1]=v;uv[2]=du;uv[3]=dv;
    }
    if(source&&(object instanceof Phaser.GameObjects.Image||object instanceof Phaser.GameObjects.Sprite))this.textures.prefetch(source,this.frame);
    object.getWorldTransformMatrix(this.transform,this.parentTransform);
    if(hint?.worldDirection&&plane==='upright'){
      const d=hint.worldDirection,c=this.yawCos,s=this.yawSin;
      const angle=Math.atan2((d.x*s+d.y*c)*this.pitchTan,d.x*c-d.y*s);
      const sx=Math.hypot(this.transform.a,this.transform.b),sy=Math.hypot(this.transform.c,this.transform.d);
      this.transform.applyITRS(this.transform.tx,this.transform.ty,angle,sx,sy);
    }
    // Phaser's camera matrix also carries follow/cinematic shake and zoom.
    if(plane==='screen'){
      const m=Phaser.GameObjects.GetCalcMatrix(object,camera,object.parentContainer?object.parentContainer.getWorldTransformMatrix():undefined).calc;
      this.transform.copyFrom(m);
    }
    const anchorX=hint?.anchor?.x??parentAnchor?.x??this.transform.tx;
    const anchorY=hint?.anchor?.y??parentAnchor?.y??this.transform.ty;
    if(hint?.overlay&&!this.interior){
      const f=this.orbit.focusGround,t=Math.max(0,Math.min(1,(Math.hypot(anchorX-f.x,anchorY-f.y)-FOG_START)/(VIEW_DISTANCE-FOG_START)));
      alpha*=1-t*t*(3-2*t);if(alpha<=.001)return;
    }
    const ownerElevation=hint?.anchor?.presentationElevation??('presentationElevation' in object&&typeof object.presentationElevation==='number'?object.presentationElevation:0);
    const anchorHeight=plane==='upright'?this.heightAt(anchorX,anchorY):0;
    const houseScaleX=house?Math.hypot(this.transform.a,this.transform.b):1;
    const houseScaleY=house?Math.hypot(this.transform.c,this.transform.d):1;
    const houseCos=house?this.transform.a/houseScaleX:1,houseSin=house?this.transform.b/houseScaleX:0;
    const lift=hint?.elevation??this.groundLift(object),project=(x:number,y:number,out:Vector3)=>{
      const px=this.transform.a*x+this.transform.c*y+this.transform.tx;
      const py=this.transform.b*x+this.transform.d*y+this.transform.ty;
      if(plane==='screen')out.set(px,py,0);
      else if(hint?.beam){
        const beam=hint.beam,t=Math.max(0,Math.min(1,((px-beam.x)*beam.dx+(py-beam.y)*beam.dy)/beam.length));
        uprightPoint(beam.mouthX??beam.x,beam.mouthY??beam.y,beam.anchorX,beam.anchorY,out,object.scene);
        out.set(px+(out.x-beam.x)*(1-t),out.y*(1-t),py+(out.z-beam.y)*(1-t));
      }
      else if(plane==='ground')out.set(px,lift,py);
      else if(house&&hint?.overlay){
        const dx=this.transform.tx-anchorX,angle=hint.anchor?.rotation??0;
        out.set(anchorX+dx*Math.cos(angle)+x*houseScaleX*this.yawCos,
          anchorHeight+anchorY-this.transform.ty-y*houseScaleY+ownerElevation,
          anchorY+dx*Math.sin(angle)-x*houseScaleX*this.yawSin);
      }
      else if(house){
        const dx=x*houseScaleX;
        out.set(this.transform.tx+dx*houseCos,anchorHeight+anchorY-this.transform.ty-y*houseScaleY+ownerElevation,
          this.transform.ty+dx*houseSin);
      }
      else if(hint?.wall){
        const dx=px-anchorX;
        out.set(hint.wall.axis==='x'?px:anchorX,anchorHeight+anchorY-py+ownerElevation,hint.wall.axis==='x'?anchorY:anchorY+dx);
      }
      else{const dx=px-anchorX;out.set(anchorX+dx*this.yawCos,anchorHeight+anchorY-py+ownerElevation,anchorY-dx*this.yawSin);}
    };
    project(rect.left,rect.top+rect.height,this.p0);
    project(rect.left+rect.width,rect.top+rect.height,this.p1);
    project(rect.left,rect.top,this.p2);
    if(hint?.overlay&&plane!=='screen'){
      // Preserve world anchoring while sharing exact depth order with screen
      // darkness and weather. These are tiny planes, not world screenshots.
      for(const p of [this.p0,this.p1,this.p2]){
        p.project(this.orbit.camera);p.set((p.x+1)*this.width/2,(1-p.y)*this.height/2,0);
      }
    }
    const xx=this.p1.x-this.p0.x,xy=this.p1.y-this.p0.y,xz=this.p1.z-this.p0.z;
    const yx=this.p2.x-this.p0.x,yy=this.p2.y-this.p0.y,yz=this.p2.z-this.p0.z;
    // Small depth offsets preserve front/back sword and foliage ordering when
    // several prepared sprite layers share the same foot point.
    const offset=plane==='upright'&&!hint?.overlay?(hint?.depthOffset??Math.max(-1,Math.min(1,(object.depth-(hint?.anchor?.depth??object.depth))*2))):0;
    // A true basis normal keeps facade/screen matrices invertible as well as
    // ground/billboard matrices. Raycasting must use the rendered transform.
    const nx=xy*yz-xz*yy,ny=xz*yx-xx*yz,nz=xx*yy-xy*yx,length=Math.hypot(nx,ny,nz)||1;
    const normalScale=volumeDepth>0?Math.hypot(xx,xy,xz):1;
    const facadeOffset=house&&emissionOwner ? .015 : 0;
    this.model.set(xx,yx,nx/length*normalScale,this.p0.x+(xx+yx)/2+offset*this.pitchCos*this.yawSin-facadeOffset*houseSin,
      xy,yy,ny/length*normalScale,this.p0.y+(xy+yy)/2+offset*this.pitchSin,
      xz,yz,nz/length*normalScale,this.p0.z+(xz+yz)/2+offset*this.pitchCos*this.yawCos+facadeOffset*houseCos,0,0,0,1);
    if(houseVolume&&house?.segment){
      const segment=house.segment,span=Math.max(1,Math.hypot(segment.dx,segment.dy)),ux=segment.dx/span,uz=segment.dy/span;
      const thickness=segment.thickness,h=segment.height;
      this.model.set(segment.dx,0,-uz*thickness,anchorX-uz*thickness/2,
        0,h,0,anchorHeight+h/2,
        segment.dy,0,ux*thickness,anchorY+ux*thickness/2,0,0,0,1);
    }
    if(plane!=='screen'&&!hint?.overlay&&!this.inView(plane==='ground',volumeDepth))return;
    // Fade only foreground scenery whose projected rectangle covers the subject.
    // The original art and depth remain intact outside that small sight line.
    if(plane==='upright'&&!hint?.overlay&&(!hint?.anchor||hint.wall)
      &&object.getData('presentation25dPlayerVisual')!==true
      &&!(object instanceof Phaser.GameObjects.Text)
      &&!(object instanceof Phaser.GameObjects.Sprite&&'body' in object&&object.body)){
      const b=this.projectedBounds;
      if(b.depth<this.subject.z-.00001&&this.subject.x>b.left&&this.subject.x<b.right&&this.subject.y>b.top&&this.subject.y<b.bottom)alpha*=.28;
    }
    const overlay=plane==='screen'||hint?.overlay===true;
    const additive='blendMode' in object&&object.blendMode===Phaser.BlendModes.ADD;
    // Solid floors render in the opaque pass. Ground decals blend afterward
    // without claiming depth: a translucent shadow must never prevent the
    // terrain behind it from being drawn. Lift also orders coplanar decals.
    const order=overlay?object.depth:plane==='ground'?-10+lift:0;
    const groundBase=plane==='ground'&&this.isGroundBase(object);
    const span=Math.max(Math.hypot(xx,xy,xz),Math.hypot(yx,yy,yz));
    const terrainGrid=plane==='ground'&&!overlay?(groundBase?TERRAIN_GRID_SEGMENTS:span>128?Math.min(64,Math.max(4,2**Math.ceil(Math.log2(span/32)))):4):1;
    const opaque=groundBase&&!additive&&alpha*camera.alpha>=.999;
    const depthWrite=!overlay&&!additive&&(groundBase||plane!=='ground')&&alpha*camera.alpha>=.999;
    const fillTint='tintFill' in object&&object.tintFill===true;
    const mask=this.rectangularMask(object);
    if(source)texture=this.textures.get(source,this.frame);
    if(!texture)return;
    const billboard=staticImage&&plane==='upright'&&!object.input?.enabled;
    const key=Number(billboard)+':'+texture.uuid+':'+Number(additive)+':'+Number(fillTint)+':'+Number(overlay)+':'+plane+':'+order+':'+Number(opaque)+':'+Number(depthWrite)+':'+Number(tiled)+':'+terrainGrid+':'+(mask?.id??0)+':'+Number(Boolean(warningArea))+':'+(houseVolume?house!.profile.id+(house!.segment?':surveyed':''):wallDepth?'panel:'+wallDepth:'');
    let batch=this.batches.get(key);
    if(!batch){batch=new SpriteBatch(object.name==='interior-backdrop'?this.background:overlay?this.screen:this.world,texture,additive,overlay,order,mask?.rects,fillTint,opaque,depthWrite,plane==='ground'&&!overlay,tiled,this.elevation,terrainGrid,overlay?undefined:this.atmosphere,false,Boolean(warningArea),houseVolume?()=>createHouseGeometry(house!):wallDepth?()=>createWallGeometry(wallDepth):undefined,billboard,this.billboardRight);this.batches.set(key,batch);}
    const colors=this.colors;
    if('tintTopLeft' in object&&typeof object.tintTopLeft==='number'){
      colors[0]=object.tintTopLeft;colors[1]=object.tintTopRight;colors[2]=object.tintBottomLeft;colors[3]=object.tintBottomRight;
    }else colors.fill(0xffffff);
    if(warningArea&&warning)colors.fill(warning.color);
    let submitted=this.model;
    if(billboard){
      // Store yaw-neutral world transforms. Only one shared camera uniform
      // changes while orbiting; static instance buffers remain unchanged.
      this.neutralModel.copy(this.model);this.rotateModel(this.neutralModel,anchorX,anchorY,-this.orbit.yaw);submitted=this.neutralModel;
      repeat=this.tileRepeat;repeat[0]=anchorX;repeat[1]=anchorY;repeat[2]=repeat[3]=0;
    }
    batch.add(submitted,uv,colors,alpha*camera.alpha,object,rect,this.frame,repeat);
    if(staticImage&&source)this.staticPackets.set(object,{
      frame:object.frame,hint,source,texture,x:object.x,y:object.y,scaleX:object.scaleX,scaleY:object.scaleY,
      rotation:object.rotation,originX:object.originX,originY:object.originY,depth:object.depth,
      alpha:alpha*camera.alpha,flipX:object.flipX,flipY:object.flipY,fillTint:object.tintFill,blendMode:object.blendMode,mask:object.mask,billboard,ground:plane==='ground',interior:this.interior,key,
      matrix:submitted.clone(),rect:{...rect},uv:new Float64Array(uv),colors:new Uint32Array(colors),repeat:repeat?new Float64Array(repeat):undefined,
    });
    camera.addToRenderList(object);
  }

  private rotateModel(matrix:Matrix4,x:number,z:number,angle:number){
    const e=matrix.elements,c=Math.cos(angle),s=Math.sin(angle);
    for(let column=0;column<3;column++){const i=column*4,a=e[i],b=e[i+2];e[i]=a*c+b*s;e[i+2]=-a*s+b*c;}
    const a=e[12]-x,b=e[14]-z;e[12]=x+a*c+b*s;e[14]=z-a*s+b*c;
  }
  private collectStatic(object:Phaser.GameObjects.Image,camera:Phaser.Cameras.Scene2D.Camera,alpha:number,hint:PresentationHint|undefined){
    const packet=this.staticPackets.get(object);
    if(!packet||packet.billboard&&object.input?.enabled||packet.frame!==object.frame||packet.hint!==hint||packet.interior!==this.interior
      ||packet.x!==object.x||packet.y!==object.y||packet.scaleX!==object.scaleX||packet.scaleY!==object.scaleY
      ||packet.flipX!==object.flipX||packet.flipY!==object.flipY||packet.fillTint!==object.tintFill||packet.blendMode!==object.blendMode||packet.mask!==object.mask
      ||packet.rotation!==object.rotation||packet.originX!==object.originX||packet.originY!==object.originY||packet.depth!==object.depth
      ||packet.colors[0]!==object.tintTopLeft||packet.colors[1]!==object.tintTopRight||packet.colors[2]!==object.tintBottomLeft||packet.colors[3]!==object.tintBottomRight)return false;
    this.model.copy(packet.matrix);if(packet.billboard)this.rotateModel(this.model,packet.x,packet.y,this.orbit.yaw);
    if(!this.inView(packet.ground))return true;
    if(packet.billboard&&object.getData('presentation25dPlayerVisual')!==true){
      const b=this.projectedBounds;if(b.depth<this.subject.z-.00001&&this.subject.x>b.left&&this.subject.x<b.right&&this.subject.y>b.top&&this.subject.y<b.bottom)alpha*=.28;
    }
    const batch=this.batches.get(packet.key),texture=this.textures.get(packet.source,this.frame);
    if(!batch||texture!==packet.texture||packet.alpha!==alpha*camera.alpha)return false;
    batch.add(packet.matrix,packet.uv,packet.colors,packet.alpha,object,packet.rect,this.frame,packet.repeat);
    camera.addToRenderList(object);return true;
  }

  private inView(ground:boolean,backDepth=0){
    let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity,depth=0,near=Infinity,far=-Infinity;
    const count=backDepth>0?8:ground?5:4;
    for(let i=0;i<count;i++){const [x,y]=VERTICES[backDepth>0?i%4:i];this.projected.set(x,y,i>=4&&backDepth>0?-backDepth:0).applyMatrix4(this.model);
      if(ground)this.projected.y+=this.heightAt(this.projected.x,this.projected.z);
      this.projected.project(this.orbit.camera);
      left=Math.min(left,this.projected.x);right=Math.max(right,this.projected.x);top=Math.min(top,this.projected.y);bottom=Math.max(bottom,this.projected.y);
      depth+=this.projected.z/count;near=Math.min(near,this.projected.z);far=Math.max(far,this.projected.z);}
    // Bounds depth is used only for upright foreground fading. Ground center
    // sampling includes hill crests which a flat-corner test would miss.
    const b=this.projectedBounds;b.left=left;b.right=right;b.top=top;b.bottom=bottom;b.depth=depth;
    return far>=-1&&near<=1&&right>=-1.15&&left<=1.15&&bottom>=-1.15&&top<=1.15;
  }
  private rectangularMask(object:DrawingObject){
    if(!('mask' in object)||!(object.mask instanceof Phaser.Display.Masks.GeometryMask))return;
    const graphic=object.mask.geometryMask;
    let saved=this.masks.get(graphic);if(saved)return saved;
    const commands=graphic.commandBuffer,rects:Vector4[]=[];
    // Shipping interior light masks contain one fill-style followed by floor
    // rectangles. Other shapes are diagnosed instead of silently misclipped.
    for(let i=0;i<commands.length;){
      const id=Number(commands[i++]);
      // Graphics always begins with LINE_STYLE and FILL_STYLE, including
      // transparent defaults. Neither changes rectangular mask geometry.
      if(id===6)i+=3;
      else if(id===7)i+=2;
      else if(id===3){const x=Number(commands[i]),y=Number(commands[i+1]);rects.push(new Vector4(x,y,x+Number(commands[i+2]),y+Number(commands[i+3])));i+=4;}
      else throw new Error('2.5D geometry mask requires rectangular floor regions');
    }
    if(rects.length>16)throw new Error('2.5D floor mask exceeds sixteen regions');
    saved={id:this.nextMaskId++,rects};this.masks.set(graphic,saved);return saved;
  }
  private defaultPlane(object:DrawingObject):PresentationPlane{
    // The darkness quad is camera-fitted world art, but must be composited in
    // screen space; sending it to the tilted ground plane creates huge black slabs.
    if(object.name==='night-darkness')return 'screen';
    if(object.scrollFactorX===0&&object.scrollFactorY===0)return 'screen';
    if(object instanceof Phaser.GameObjects.Text)return 'upright';
    const name=object.name,key='texture' in object?object.texture.key:'';
    if(object.depth<0||object instanceof Phaser.GameObjects.TileSprite
      ||/shadow|target-ring|telegraph|warning|ember-snare-field|river-and-sea/.test(name)
      ||/contact-shadow|night-overlay|warm-light/.test(key))return 'ground';
    if(object instanceof Phaser.GameObjects.Graphics)return /enemy-health|enemy-target:/.test(name)?'upright':'ground';
    return 'upright';
  }
  private groundLift(object:DrawingObject){
    if(object.name==='night-darkness')return .4;
    if(/shadow/.test(object.name))return .04;
    if(/telegraph|warning|target/.test(object.name))return .12;
    if(object instanceof Phaser.GameObjects.TileSprite)return -.02;
    if(object.name==='river-and-sea-surface')return .01;
    return object.depth<=-1000?-.1:0;
  }
  private isGroundBase(object:DrawingObject){
    const key='texture' in object?object.texture.key:'';
    return key.startsWith('chunk:')||key==='shared-ocean-chunk'||object.name==='tower-round-chamber'
      ||object instanceof Phaser.GameObjects.TileSprite&&object.name!=='ocean-foam-surface';
  }
  private readonly onPointer=(event:PointerEvent)=>{
    if(this.stopped||event.button!==0)return;
    const rect=this.renderer.domElement.getBoundingClientRect();
    if(this.orbit.locked)this.pointer.set(0,0);
    else this.pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    this.ray.setFromCamera(this.pointer,this.orbit.camera);this.hits.length=0;
    this.ray.intersectObjects(this.pickable,true,this.hits);
    for(const hit of this.hits){
      const batch=hit.object.userData.batch as SpriteBatch|undefined;
      const entry=(hit.instanceId===undefined?undefined:batch?.objects[hit.instanceId]) as {object:DrawingObject;rect:LocalRect}|undefined;
      const object=entry?.object;
      // Picking a transparent corner of the original house artwork must not
      // block selection. This reads one prepared canvas texel on clicks only,
      // never the WebGL framebuffer or an image scan in the frame loop.
      if(hit.object.userData.presentationOccluder&&hit.uv
        &&(object instanceof Phaser.GameObjects.Image||object instanceof Phaser.GameObjects.Sprite)){
        const frame=object.frame,canvas=frame.source.image;
        if(canvas instanceof HTMLCanvasElement){
          const x=frame.cutX+Math.max(0,Math.min(frame.cutWidth-1,Math.floor(hit.uv.x*frame.cutWidth)));
          const y=frame.cutY+Math.max(0,Math.min(frame.cutHeight-1,Math.floor((1-hit.uv.y)*frame.cutHeight)));
          if((canvas.getContext('2d')?.getImageData(x,y,1,1).data[3]??255)<20)continue;
        }
      }
      if(entry&&object instanceof Phaser.GameObjects.GameObject&&object.active&&object.input?.enabled&&hit.uv){
        const x=entry.rect.left+hit.uv.x*entry.rect.width+('displayOriginX' in object?object.displayOriginX:0);
        const y=entry.rect.top+(1-hit.uv.y)*entry.rect.height+('displayOriginY' in object?object.displayOriginY:0);
        if(!object.input.hitAreaCallback(object.input.hitArea,x,y,object))continue;
        // Scene callbacks retain their existing proximity, menu and story guards.
        object.emit(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN,this.game.input.activePointer,x,y,event);break;
      }
      if(hit.object.userData.presentationOccluder)break;
    }
  };
  private readonly onContextLost=(event:Event)=>{
    event.preventDefault();
    this.game.registry.set('presentationError','The 2.5D graphics context was lost. Return to the menu and reopen your save.');
    this.game.loop.sleep();
  };
  destroy(){
    if(this.stopped)return;this.stopped=true;
    window.removeEventListener(FRAME_DIAGNOSTICS_EVENT,this.onDiagnosticChange);
    this.diagnosticsPanel?.remove();this.diagnosticsPanel=null;this.diagnosticsParent=null;
    this.game.events.off(GAME_DISPOSING,this.destroy,this);this.game.events.off(Phaser.Core.Events.DESTROY,this.destroy,this);
    this.native.render=this.originalRender;
    this.game.canvas.style.visibility=this.originalCanvasVisibility;
    if(this.game.input.mouse&&this.originalMouseEnabled!==undefined)this.game.input.mouse.enabled=this.originalMouseEnabled;
    if(this.game.input.touch&&this.originalTouchEnabled!==undefined)this.game.input.touch.enabled=this.originalTouchEnabled;
    const canvas=this.renderer.domElement;canvas.removeEventListener('webglcontextlost',this.onContextLost);this.orbit.destroy();clearPresentationView(this.game);
    for(const batch of this.batches.values())batch.destroy();this.batches.clear();
    this.gpuNight.destroy();this.gpuWeather.destroy();this.gpuWater.destroy();this.gpuClouds.destroy();this.gpuShadows.destroy();this.sky.destroy();
    clearResourcePreparation(this.game);releaseFrameWork(this.game);this.gpuTimer.destroy();this.shaderWarmup.destroy();
    this.budget.destroy();this.postFX.destroy();this.elevation.destroy();this.rasters.destroy();this.textures.destroy();this.renderer.dispose();canvas.remove();
    this.effectGeometry.dispose();this.flash.material.dispose();this.fade.material.dispose();
    this.hits.length=0;this.pickable.length=0;this.transform.destroy();this.parentTransform.destroy();
  }
}
