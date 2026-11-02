import Phaser from 'phaser';
import {M14_ART,m14Animations,type M14ArtSpec} from '../../data/m14Art';
import type {RegionId} from '../types';
import {m14Sources,prepareM14ArtSteps} from './M14Art';
import {prepareSpriteSubjects} from './SpriteSubjectPreparation';
import type {ActorSpriteSubject} from './spriteComponents';

/** New families load on demand. Never evict a texture referenced by an actor;
 * short grace also covers temporary corpse sprites after the actor unloads. */
export class M14ArtResidency {
  private readonly resident=new Map<string,{spec:M14ArtSpec;lastUsed:number}>();
  private readonly pending=new Set<string>();
  private readonly failed=new Set<string>();
  private readonly abandoned=new Set<string>();
  private loading:M14ArtSpec|null=null;
  private segmenting:{spec:M14ArtSpec;abort:AbortController}|null=null;
  private preparing:{spec:M14ArtSpec;steps:Generator<void,void>}|null=null;
  private preparedFrame=-1;
  private disposed=false;
  private elapsed=0;
  private region:RegionId|null=null;
  constructor(private readonly scene:Phaser.Scene,private readonly referenced:(id:string)=>boolean,
    private readonly report:(message:string)=>void){}

  ensure(id:string):boolean {
    const spec=M14_ART.find(s=>s.id===id);if(!spec)return true;
    if(this.disposed||this.failed.has(id))return false;
    this.abandoned.delete(id);
    if(this.resident.has(id))return true;
    if(this.segmenting?.spec.id===id||this.preparing?.spec.id===id)return false;
    this.pending.add(id);this.pump();return false;
  }
  update(delta:number,region:RegionId){
    if(this.disposed)return;
    if(this.preparing&&this.preparedFrame!==this.scene.game.loop.frame){
      this.preparedFrame=this.scene.game.loop.frame;const job=this.preparing;
      try{
        if(job.steps.next().done){
          for(const clip of m14Animations(job.spec))this.scene.anims.create({key:clip.key,frames:clip.frames.map((frame,i)=>({key:clip.texture,frame,duration:clip.frameDurations?.[i]??0})),frameRate:clip.frameRate,repeat:clip.repeat});
          this.resident.set(job.spec.id,{spec:job.spec,lastUsed:this.scene.time.now});this.preparing=null;this.removeSources(job.spec);
        }
      }catch(error){job.steps.return();this.preparing=null;this.failed.add(job.spec.id);this.release(job.spec);this.removeSources(job.spec);this.report(`Could not prepare ${job.spec.id} artwork: ${String(error)}`);}
    }
    if(this.region!==region){
      this.region=region;
      for(const spec of M14_ART)if(!spec.boss&&spec.region===region)this.ensure(spec.id);
    }
    this.elapsed+=delta;if(this.elapsed<500)return;this.elapsed=0;
    for(const entry of this.resident.values())if(this.referenced(entry.spec.id))entry.lastUsed=this.scene.time.now;
    this.pump();
  }
  private pump(){
    if(this.disposed||this.loading||this.segmenting||this.preparing||this.scene.load.isLoading())return;
    const requests=[...this.pending].map(id=>M14_ART.find(s=>s.id===id)!)
      .filter(s=>!this.resident.has(s.id)&&!this.failed.has(s.id)).sort((a,b)=>Number(Boolean(b.boss))-Number(Boolean(a.boss)));
    // Two ambient families plus one boss; a full ambient cache cannot starve
    // an authored boss. No active actor's texture is ever evicted.
    const spec=requests.find(s=>[...this.resident.values()].filter(e=>Boolean(e.spec.boss)===Boolean(s.boss)).length<(s.boss?1:2)
      ||[...this.resident.values()].some(e=>Boolean(e.spec.boss)===Boolean(s.boss)&&!this.referenced(e.spec.id)&&this.scene.time.now-e.lastUsed>=5000));
    if(!spec)return;
    if([...this.resident.values()].filter(e=>Boolean(e.spec.boss)===Boolean(spec.boss)).length>=(spec.boss?1:2)){
      const disposable=[...this.resident.values()].filter(e=>Boolean(e.spec.boss)===Boolean(spec.boss)&&!this.referenced(e.spec.id)&&this.scene.time.now-e.lastUsed>=5000)
        .sort((a,b)=>a.lastUsed-b.lastUsed)[0];
      if(!disposable)return;
      this.release(disposable.spec);
    }
    this.loading=spec;this.pending.delete(spec.id);
    for(const source of m14Sources(spec))if(!this.scene.textures.exists(source.key))
      this.scene.load.image({key:source.key,url:source.path,xhrSettings:{responseType:'blob',timeout:15000}});
    this.scene.load.once(Phaser.Loader.Events.COMPLETE,this.complete,this);this.scene.load.start();
  }
  private complete(){
    const spec=this.loading;this.loading=null;if(!spec||this.disposed)return;
    try{
      // Do not decode/prepare a tower-only atlas after its room has closed.
      // Let shared loader requests settle normally; never reset other owners.
      if(this.abandoned.delete(spec.id))return;
      if(m14Sources(spec).some(s=>!this.scene.textures.exists(s.key)))throw new Error(`Missing ${spec.id} source image`);
      const job={spec,abort:new AbortController()};this.segmenting=job;
      void this.isolate(spec,job.abort.signal).then(subjects=>{
        if(this.disposed||this.segmenting!==job||job.abort.signal.aborted)return;
        this.segmenting=null;this.preparing={spec,steps:prepareM14ArtSteps(this.scene,spec,subjects)};
      }).catch(error=>{
        if(this.disposed||this.segmenting!==job)return;
        this.segmenting=null;this.failed.add(spec.id);this.release(spec);this.removeSources(spec);this.report(`Could not load ${spec.id} artwork: ${String(error)}`);
      });
    }catch(error){
      this.failed.add(spec.id);this.release(spec);
      this.report(`Could not load ${spec.id} artwork: ${error instanceof Error?error.message:String(error)}`);
    }finally{if(this.segmenting?.spec!==spec)this.removeSources(spec);}
    // Next update allows the content manager to activate this family before
    // any subsequent request can consider it for eviction.
  }
  private async isolate(spec:M14ArtSpec,signal:AbortSignal){
    const subjects=new Map<string,ActorSpriteSubject[]>();
    for(const file of m14Sources(spec)){
      if(spec.species===19&&file.kind!=='spells')continue;
      const image=this.scene.textures.get(file.key).getSourceImage() as HTMLImageElement;
      subjects.set(file.kind,await prepareSpriteSubjects(this.scene,image,file.columns,file.rows,file.path,signal,spec.species===19));
    }
    return subjects;
  }
  private removeSources(spec:M14ArtSpec){for(const source of m14Sources(spec))if(this.scene.textures.exists(source.key))this.scene.textures.remove(source.key);}
  private release(spec:M14ArtSpec){
    for(const clip of m14Animations(spec))if(this.scene.anims.exists(clip.key))this.scene.anims.remove(clip.key);
    if(this.scene.textures.exists(spec.texture))this.scene.textures.remove(spec.texture);
    for(const key of spec.auxiliaryTextures??[])if(this.scene.textures.exists(key))this.scene.textures.remove(key);
    this.resident.delete(spec.id);
  }
  forget(id:string){
    if(this.referenced(id))return;
    this.pending.delete(id);
    if(this.loading?.id===id)this.abandoned.add(id);
    if(this.segmenting?.spec.id===id){const job=this.segmenting;this.segmenting=null;job.abort.abort();this.removeSources(job.spec);}
    if(this.preparing?.spec.id===id){const job=this.preparing;this.preparing=null;job.steps.return();this.release(job.spec);this.removeSources(job.spec);}
    const entry=this.resident.get(id);if(entry)this.release(entry.spec);
  }
  destroy(){
    if(this.disposed)return;this.disposed=true;
    if(this.segmenting){const job=this.segmenting;this.segmenting=null;job.abort.abort();this.removeSources(job.spec);}
    this.preparing?.steps.return();this.preparing=null;
    this.scene.load.off(Phaser.Loader.Events.COMPLETE,this.complete,this);
    if(this.loading)this.scene.load.reset();
    for(const spec of M14_ART){this.release(spec);for(const s of m14Sources(spec))if(this.scene.textures.exists(s.key))this.scene.textures.remove(s.key);}
    if(this.scene.textures.exists('enemy_goblin_stone'))this.scene.textures.remove('enemy_goblin_stone');
    this.pending.clear();this.failed.clear();this.abandoned.clear();this.loading=null;
  }
}
