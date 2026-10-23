import {DataTexture,Scene,type Camera,type WebGLRenderer} from 'three';
import {SpriteBatch,type DistanceAtmosphere} from './SpriteBatch';
import type {ElevationField} from './ElevationField';

/** A tiny retained set keeps finite shared shader programs resident. It never
 * draws loading artwork or builds another simulation. Materials stay alive
 * until teardown, so precompiled programs aren't immediately disposed. */
export class ShaderWarmup {
  private readonly texture=new DataTexture(new Uint8Array([255,255,255,255]),1,1);
  private readonly scene=new Scene();private readonly batches:SpriteBatch[]=[];
  readonly ready:Promise<void>;
  constructor(renderer:WebGLRenderer,camera:Camera,elevation:ElevationField,atmosphere:DistanceAtmosphere){
    this.texture.needsUpdate=true;
    this.batches.push(new SpriteBatch(this.scene,this.texture,false,false,0,[],false,true,true,true,false,elevation,4,atmosphere));
    this.batches.push(new SpriteBatch(this.scene,this.texture,false,false,0,[],false,false,true,false,false,elevation,false,atmosphere));
    this.batches.push(new SpriteBatch(this.scene,this.texture,true,true,0));
    this.ready=renderer.compileAsync(this.scene,camera).then(()=>{}).catch(()=>{});
  }
  destroy(){for(const batch of this.batches)batch.destroy();this.batches.length=0;this.texture.dispose();}
}
