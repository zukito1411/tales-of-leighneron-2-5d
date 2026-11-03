import {DataTexture,Scene,WebGLRenderTarget,InstancedMesh,Mesh,type Camera,type Object3D,type WebGLRenderer} from 'three';
import {SpriteBatch,type DistanceAtmosphere} from './SpriteBatch';
import type {ElevationField} from './ElevationField';
import {createWallGeometry} from './HouseGeometry';
import {createCombatEffectGeometry} from './CombatEffectGeometry';
import type {FrameWorkBudget} from './FrameWorkBudget';

/** A tiny retained set keeps finite shared shader programs resident. It never
 * draws loading artwork or builds another simulation. Materials stay alive
 * until teardown, so precompiled programs aren't immediately disposed. */
export class ShaderWarmup {
  private readonly texture=new DataTexture(new Uint8Array([255,255,255,255]),1,1);
  private readonly scene=new Scene();private readonly optionalScene=new Scene();private readonly batches:SpriteBatch[]=[];
  private readonly worldTarget=new WebGLRenderTarget(1,1,{depthBuffer:false,stencilBuffer:false});
  private optionalWorld=false;
  private disposed=false;private optional:Object3D[]=[];private optionalIndex=0;private optionalBusy=false;private optionalEpoch=0;private optionalObject:Object3D|undefined;private optionalParallel:boolean|undefined;
  readonly ready:Promise<void>;
  constructor(renderer:WebGLRenderer,camera:Camera,elevation:ElevationField,atmosphere:DistanceAtmosphere){
    this.texture.needsUpdate=true;
    this.batches.push(new SpriteBatch(this.scene,this.texture,false,false,0,[],false,true,true,true,false,elevation,4,atmosphere));
    this.batches.push(new SpriteBatch(this.scene,this.texture,false,false,0,[],false,false,true,false,false,elevation,false,atmosphere));
    this.batches.push(new SpriteBatch(this.scene,this.texture,true,true,0));
    // Retain the shared architecture shader before the first town enters
    // view. All roof/wall styles share this program and their existing atlases.
    this.batches.push(new SpriteBatch(this.scene,this.texture,false,false,0,[],false,false,true,false,false,elevation,false,atmosphere,false,false,()=>createWallGeometry(.06)));
    this.batches.push(this.batches[this.batches.length-1].createForegroundVariant());
    // Combat has two shader defines distinct from scenery. Retaining these
    // tiny shared programs avoids driver compilation on the first attack.
    for(const kind of ['slash','wave'] as const)this.batches.push(new SpriteBatch(this.scene,this.texture,true,false,1,[],false,false,false,false,false,elevation,false,atmosphere,
      false,false,undefined,false,undefined,undefined,true,false,()=>createCombatEffectGeometry(kind,false)));
    this.ready=this.compile(renderer,camera);
  }
  async compile(renderer:WebGLRenderer,camera:Camera){
    if(this.disposed)return;
    await renderer.compileAsync(this.scene,camera);
    if(this.disposed)return;
    // WorldPostFX renders into a linear colour target. Three includes output
    // colour space in the program key, so warming only the display variant
    // leaves the first world-space slash compiling again during combat.
    const previous=renderer.getRenderTarget();let world:Promise<unknown>;
    try{renderer.setRenderTarget(this.worldTarget);world=renderer.compileAsync(this.scene,camera);}
    finally{renderer.setRenderTarget(previous);}
    await world;
  }
  queueOptional(objects:readonly Object3D[]){this.optional=objects.slice();this.optionalIndex=0;this.optionalWorld=false;this.optionalEpoch++;}
  /** Compile one output variant after a world frame, sharing the live effect
   * geometry/material without copying its particle buffers or moving it. */
  advanceOptional(renderer:WebGLRenderer,camera:Camera,work:FrameWorkBudget){
    if(this.disposed||this.optionalBusy||this.optionalIndex>=this.optional.length||work.remaining('shaders',.3)<.2)return;
    this.optionalParallel??=Boolean(renderer.getContext().getExtension('KHR_parallel_shader_compile'));
    // Leave first-use compilation as the fallback when precompilation may
    // block the game loop on this device.
    if(!this.optionalParallel){this.optionalIndex=this.optional.length;return;}
    const start=performance.now(),epoch=this.optionalEpoch,source=this.optional[this.optionalIndex];
    const target=this.optionalWorld?this.worldTarget:null;
    if(this.optionalWorld)this.optionalIndex++;this.optionalWorld=!this.optionalWorld;
    // Compile the same instancing variant without copying a live particle buffer.
    const object=source instanceof InstancedMesh?new InstancedMesh(source.geometry,source.material,1)
      :source instanceof Mesh?new Mesh(source.geometry,source.material):source.clone(false);
    object.visible=true;this.optionalScene.add(object);this.optionalObject=object;this.optionalBusy=true;
    const compileTarget=(target:WebGLRenderTarget|null)=>{
      const previous=renderer.getRenderTarget();let ready:Promise<unknown>;
      try{renderer.setRenderTarget(target);ready=renderer.compileAsync(this.optionalScene,camera);}
      finally{renderer.setRenderTarget(previous);}
      return ready;
    };
    void (async()=>{
      try{
        const ready=compileTarget(target);work.charge('shaders',start);await ready;
        // Both program variants are queued as separate jobs so a resolved
        // promise cannot introduce another compile outside the frame allowance.
      }
      catch{/* Optional effects retain their normal first-use compilation fallback. */}
      finally{
        object.removeFromParent();if(object instanceof InstancedMesh)object.dispose();
        if(epoch===this.optionalEpoch){this.optionalObject=undefined;this.optionalBusy=false;}
      }
    })();
  }
  restartOptional(){this.optionalEpoch++;this.optionalIndex=0;this.optionalWorld=false;this.optionalBusy=false;this.optionalObject?.removeFromParent();this.optionalObject=undefined;}
  destroy(){this.disposed=true;this.optionalEpoch++;this.optional.length=0;this.optionalIndex=0;this.optionalObject?.removeFromParent();this.optionalObject=undefined;for(const batch of this.batches)batch.destroy();this.batches.length=0;this.worldTarget.dispose();this.texture.dispose();}
}
