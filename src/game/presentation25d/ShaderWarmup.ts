import {DataTexture,Scene,WebGLRenderTarget,type Camera,type WebGLRenderer} from 'three';
import {SpriteBatch,type DistanceAtmosphere} from './SpriteBatch';
import type {ElevationField} from './ElevationField';
import {createWallGeometry} from './HouseGeometry';
import {createCombatEffectGeometry} from './CombatEffectGeometry';

/** A tiny retained set keeps finite shared shader programs resident. It never
 * draws loading artwork or builds another simulation. Materials stay alive
 * until teardown, so precompiled programs aren't immediately disposed. */
export class ShaderWarmup {
  private readonly texture=new DataTexture(new Uint8Array([255,255,255,255]),1,1);
  private readonly scene=new Scene();private readonly batches:SpriteBatch[]=[];
  private readonly worldTarget=new WebGLRenderTarget(1,1,{depthBuffer:false,stencilBuffer:false});
  private disposed=false;
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
  destroy(){this.disposed=true;for(const batch of this.batches)batch.destroy();this.batches.length=0;this.worldTarget.dispose();this.texture.dispose();}
}
