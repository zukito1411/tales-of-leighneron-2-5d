import Phaser from 'phaser';
import {
  Matrix4,OrthographicCamera,Raycaster,Scene,Vector2,Vector3,Vector4,WebGLRenderer,
  type Intersection,type Object3D,type Texture,
} from 'three';
import {SpriteBatch} from './SpriteBatch';
import {RasterCache} from './RasterCache';
import {TextureCache} from './TextureCache';
import {PRESENTATION_HINT,CAMERA_SIN,CAMERA_COS,type PresentationHint,type PresentationPlane} from './plane';
import {GAME_DISPOSING} from '../systems/gameLifetime';

type ImageObject=Phaser.GameObjects.Image|Phaser.GameObjects.Sprite|Phaser.GameObjects.Text;
type DrawingObject=ImageObject|Phaser.GameObjects.Graphics|Phaser.GameObjects.Shape|Phaser.GameObjects.TileSprite;
interface LocalRect {left:number;top:number;width:number;height:number}
const SIN=CAMERA_SIN,COS=CAMERA_COS;
const HEIGHT=6000;
const VERTICES=[[-.5,-.5],[.5,-.5],[-.5,.5],[.5,.5]] as const;

/** Presentation adapter for the complete existing game. The original scene
 * remains the sole owner of time, physics, AI, streaming, combat and saves.
 * CanvasRenderer prepares existing art; only Three.js draws the world. */
export class ThreePresentation {
  private readonly renderer:WebGLRenderer;
  private readonly world=new Scene();
  private readonly background=new Scene();
  private readonly screen=new Scene();
  private readonly camera=new OrthographicCamera(-1,1,1,-1,.1,20000);
  private readonly screenCamera=new OrthographicCamera(0,1,0,1,-100,100);
  private readonly batches=new Map<string,SpriteBatch>();
  private readonly textures=new TextureCache();
  private readonly rasters:RasterCache;
  private readonly transform=new Phaser.GameObjects.Components.TransformMatrix();
  private readonly parentTransform=new Phaser.GameObjects.Components.TransformMatrix();
  private readonly model=new Matrix4();
  private readonly p0=new Vector3();private readonly p1=new Vector3();private readonly p2=new Vector3();
  private readonly projected=new Vector3();
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

  constructor(private readonly game:Phaser.Game,parent:HTMLElement){
    if(!(game.renderer instanceof Phaser.Renderer.Canvas.CanvasRenderer))throw new Error('2.5D requires the Phaser canvas compatibility backend');
    this.native=game.renderer;this.originalRender=this.native.render;this.rasters=new RasterCache(this.native);
    this.renderer=new WebGLRenderer({alpha:false,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(1);this.renderer.autoClear=false;
    const canvas=this.renderer.domElement;canvas.className='three-world-canvas';
    canvas.setAttribute('aria-label','Tales of Leighneron 2.5D world');
    Object.assign(canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',touchAction:'none'});
    parent.append(canvas);
    this.originalCanvasVisibility=game.canvas.style.visibility;game.canvas.style.visibility='hidden';
    this.originalMouseEnabled=game.input.mouse?.enabled;this.originalTouchEnabled=game.input.touch?.enabled;
    if(game.input.mouse)game.input.mouse.enabled=false;if(game.input.touch)game.input.touch.enabled=false;
    canvas.addEventListener('pointerdown',this.onPointer);
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
    if('renderToTexture' in camera&&camera.renderToTexture){this.originalRender.call(this.native,scene,children,camera);return;}
    this.frame++;
    const width=this.game.scale.width,height=this.game.scale.height;
    if(this.width!==width||this.height!==height){
      this.width=width;this.height=height;this.renderer.setSize(width,height,false);
      this.screenCamera.right=width;this.screenCamera.bottom=height;this.screenCamera.updateProjectionMatrix();
    }
    const halfW=width/camera.zoom/2,halfH=height/camera.zoom/2;
    this.camera.left=-halfW;this.camera.right=halfW;this.camera.top=halfH;this.camera.bottom=-halfH;
    this.camera.position.set(camera.midPoint.x,HEIGHT*SIN,camera.midPoint.y+HEIGHT*COS);
    this.camera.lookAt(camera.midPoint.x,0,camera.midPoint.y);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
    for(const batch of this.batches.values())batch.begin();
    camera.emit(Phaser.Cameras.Scene2D.Events.PRE_RENDER,camera);
    for(const object of children)this.collect(object,camera,1,undefined,undefined);
    this.pickable.length=0;
    for(const [key,batch] of this.batches){
      batch.finish();
      if(this.frame-batch.lastUsed>2){batch.destroy();this.batches.delete(key);}
      else if(batch.mesh.visible)this.pickable.push(batch.mesh);
    }
    this.textures.prune(this.frame);this.rasters.prune(this.frame);
    this.renderer.setClearColor(camera.backgroundColor.color,1);this.renderer.clear();
    this.renderer.render(this.background,this.screenCamera);
    this.renderer.render(this.world,this.camera);this.renderer.clearDepth();this.renderer.render(this.screen,this.screenCamera);
    camera.dirty=false;
  }

  private collect(object:Phaser.GameObjects.GameObject,camera:Phaser.Cameras.Scene2D.Camera,parentAlpha:number,inherited?:PresentationHint,parentAnchor?:number){
    if(!object.active||!('visible' in object)||!object.visible||object.cameraFilter&camera.id)return;
    const alpha=parentAlpha*('alpha' in object&&typeof object.alpha==='number'?object.alpha:1);
    if(alpha<=.001)return;
    const explicit=object.getData(PRESENTATION_HINT) as PresentationHint|undefined;
    if(object instanceof Phaser.GameObjects.Container){
      const hint=explicit??inherited??{plane:'upright'};
      for(const child of object.list)this.collect(child,camera,alpha,hint,parentAnchor??object.y);
      return;
    }
    if(!(object instanceof Phaser.GameObjects.Image||object instanceof Phaser.GameObjects.Sprite||object instanceof Phaser.GameObjects.Text
      ||object instanceof Phaser.GameObjects.Graphics||object instanceof Phaser.GameObjects.Shape||object instanceof Phaser.GameObjects.TileSprite)){
      if(!this.missing.has(object.type)){this.missing.add(object.type);console.warn('[2.5d] Unsupported presentation object',object.type);}return;
    }
    const emissionOwner=object.getData('emissionOwner') as Phaser.GameObjects.Sprite|undefined;
    const hint=explicit??inherited??(emissionOwner?{plane:'upright' as const,anchor:emissionOwner}:undefined);
    const plane=hint?.plane??this.defaultPlane(object);
    const anchor=hint?.anchor?.y??parentAnchor??object.y;
    let texture:Texture,rect:LocalRect,uv:readonly number[];
    if(object instanceof Phaser.GameObjects.Graphics||object instanceof Phaser.GameObjects.Shape||object instanceof Phaser.GameObjects.TileSprite){
      const raster=this.rasters.get(object,this.frame);if(!raster)return;
      texture=raster.texture;rect=raster;uv=[0,0,1,1];
    }else{
      const frame=object.frame;if(!frame?.source?.image)return;
      texture=this.textures.get(frame.source,this.frame);
      const resolution=frame.source.resolution||1;
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
        if(flipX)left=-left-w;if(flipY)top=-top-h;
      }
      if(flipX&&!frame.customPivot)left+=-frame.realWidth+object.displayOriginX*2;
      if(flipY&&!frame.customPivot)top+=-frame.realHeight+object.displayOriginY*2;
      if(flipX)left=-left-w/resolution;if(flipY)top=-top-h/resolution;
      rect={left,top,width:w/resolution,height:h/resolution};
      const inset=.25,sw=frame.source.width,sh=frame.source.height;
      let u=(sx+inset)/sw,v=1-(sy+h-inset)/sh,du=(w-inset*2)/sw,dv=(h-inset*2)/sh;
      if(flipX){u+=du;du=-du;}if(flipY){v+=dv;dv=-dv;}
      uv=[u,v,du,dv];
    }
    object.getWorldTransformMatrix(this.transform,this.parentTransform);
    // Phaser's camera matrix also carries follow/cinematic shake and zoom.
    if(plane==='screen'){
      const m=Phaser.GameObjects.GetCalcMatrix(object,camera,object.parentContainer?object.parentContainer.getWorldTransformMatrix():undefined).calc;
      this.transform.copyFrom(m);
    }
    const lift=this.groundLift(object),project=(x:number,y:number,out:Vector3)=>{
      const px=this.transform.a*x+this.transform.c*y+this.transform.tx;
      const py=this.transform.b*x+this.transform.d*y+this.transform.ty;
      if(plane==='screen')out.set(px,py,0);
      else if(plane==='ground')out.set(px,lift,py);
      else{const h=anchor-py;out.set(px,h*SIN,anchor-h*COS);}
    };
    project(rect.left,rect.top+rect.height,this.p0);
    project(rect.left+rect.width,rect.top+rect.height,this.p1);
    project(rect.left,rect.top,this.p2);
    const xx=this.p1.x-this.p0.x,xy=this.p1.y-this.p0.y,xz=this.p1.z-this.p0.z;
    const yx=this.p2.x-this.p0.x,yy=this.p2.y-this.p0.y,yz=this.p2.z-this.p0.z;
    // Small depth offsets preserve front/back sword and foliage ordering when
    // several prepared sprite layers share the same foot point.
    const offset=plane==='upright'?Math.max(-1,Math.min(1,(object.depth-(hint?.anchor?.depth??object.depth))*2)):0;
    this.model.set(xx,yx,0,this.p0.x+(xx+yx)/2,xy,yy,1,this.p0.y+(xy+yy)/2+offset*SIN,
      xz,yz,0,this.p0.z+(xz+yz)/2+offset*COS,0,0,0,1);
    if(plane!=='screen'&&!this.inView())return;
    const overlay=plane==='screen'||object.name==='night-darkness';
    const additive='blendMode' in object&&object.blendMode===Phaser.BlendModes.ADD;
    const order=overlay?Math.round(object.depth):0;
    const mask=this.rectangularMask(object);
    const key=texture.uuid+':'+Number(additive)+':'+(overlay?order:plane)+':'+(mask?.id??0);
    let batch=this.batches.get(key);
    if(!batch){batch=new SpriteBatch(object.name==='interior-backdrop'?this.background:plane==='screen'?this.screen:this.world,texture,additive,overlay,order,mask?.rects);this.batches.set(key,batch);}
    const color='tintTopLeft' in object&&typeof object.tintTopLeft==='number'?object.tintTopLeft:0xffffff;
    batch.add(this.model,uv,color,alpha*camera.alpha,{object,rect},this.frame);
    camera.addToRenderList(object);
  }

  private inView(){
    let left=Infinity,right=-Infinity,top=-Infinity,bottom=Infinity;
    for(const [x,y] of VERTICES){this.projected.set(x,y,0).applyMatrix4(this.model).project(this.camera);
      left=Math.min(left,this.projected.x);right=Math.max(right,this.projected.x);top=Math.max(top,this.projected.y);bottom=Math.min(bottom,this.projected.y);}
    return right>=-1.15&&left<=1.15&&top>=-1.15&&bottom<=1.15;
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
      if(id===7)i+=2;
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
    return object.depth<=-1000?-.1:0;
  }
  private readonly onPointer=(event:PointerEvent)=>{
    if(this.stopped||event.button!==0)return;
    const rect=this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    this.ray.setFromCamera(this.pointer,this.camera);this.hits.length=0;
    this.ray.intersectObjects(this.pickable.filter(mesh=>mesh.parent===this.world),false,this.hits);
    for(const hit of this.hits){
      const batch=hit.object.userData.batch as SpriteBatch|undefined;
      const entry=(hit.instanceId===undefined?undefined:batch?.objects[hit.instanceId]) as {object:DrawingObject;rect:LocalRect}|undefined;
      const object=entry?.object;
      if(entry&&object instanceof Phaser.GameObjects.GameObject&&object.active&&object.input?.enabled&&hit.uv){
        const x=entry.rect.left+hit.uv.x*entry.rect.width+('displayOriginX' in object?object.displayOriginX:0);
        const y=entry.rect.top+(1-hit.uv.y)*entry.rect.height+('displayOriginY' in object?object.displayOriginY:0);
        if(!object.input.hitAreaCallback(object.input.hitArea,x,y,object))continue;
        // Scene callbacks retain their existing proximity, menu and story guards.
        object.emit(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN,this.game.input.activePointer,x,y,event);break;
      }
    }
  };
  private readonly onContextLost=(event:Event)=>{
    event.preventDefault();
    this.game.registry.set('presentationError','The 2.5D graphics context was lost. Return to the menu and reopen your save.');
    this.game.loop.sleep();
  };
  destroy(){
    if(this.stopped)return;this.stopped=true;
    this.game.events.off(GAME_DISPOSING,this.destroy,this);this.game.events.off(Phaser.Core.Events.DESTROY,this.destroy,this);
    this.native.render=this.originalRender;
    this.game.canvas.style.visibility=this.originalCanvasVisibility;
    if(this.game.input.mouse&&this.originalMouseEnabled!==undefined)this.game.input.mouse.enabled=this.originalMouseEnabled;
    if(this.game.input.touch&&this.originalTouchEnabled!==undefined)this.game.input.touch.enabled=this.originalTouchEnabled;
    const canvas=this.renderer.domElement;canvas.removeEventListener('pointerdown',this.onPointer);canvas.removeEventListener('webglcontextlost',this.onContextLost);
    for(const batch of this.batches.values())batch.destroy();this.batches.clear();
    this.rasters.destroy();this.textures.destroy();this.renderer.dispose();canvas.remove();
    this.hits.length=0;this.pickable.length=0;this.transform.destroy();this.parentTransform.destroy();
  }
}
