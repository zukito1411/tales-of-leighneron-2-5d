import Phaser from 'phaser';
import {NPC_COMBAT_DIRECTIONS,npcCombatKey,NPC_ARROW_TEXTURE,NPC_ARROW_PATH,type NpcCombatSpec} from '../../data/npcCombatArt';
import {npcCombatSourceKey,prepareNpcCombatSheetSteps,prepareNpcArrow} from './NpcCombatArt';
import type {SpriteAnimation} from '../../data/animationPacks';
import {prepareSpriteSubjects} from './SpriteSubjectPreparation';
import type {ActorSpriteSubject} from './spriteComponents';
const artOwners=new WeakMap<Phaser.Scene,Set<NpcCombatResidency>>();

/** Shared loader, bounded cache. Never evict a sheet still used by a fighter
 * or a regional sentry walking back to its post. No world-wide NPC preload. */
export class NpcCombatResidency {
  private readonly resident=new Map<string,NpcCombatSpec>();
  private readonly pending=new Map<string,NpcCombatSpec>();
  private readonly failures=new Map<string,number>();
  private loading:NpcCombatSpec|null=null;
  private preparing:{spec:NpcCombatSpec;steps:Generator<void,SpriteAnimation[]>}|null=null;
  private segmenting:{spec:NpcCombatSpec;abort:AbortController}|null=null;
  private preparedFrame=-1;
  private disposed=false;

  constructor(private readonly scene:Phaser.Scene,private readonly referenced:(spec:NpcCombatSpec)=>boolean,
    private readonly report:(message:string)=>void){
    const owners=artOwners.get(scene)??new Set<NpcCombatResidency>();owners.add(this);artOwners.set(scene,owners);
  }
  ensure(spec:NpcCombatSpec){
    if(this.disposed)return false;
    if(this.scene.anims.exists(npcCombatKey(spec,'attack','down'))
      &&(spec.mode!=='bow'||this.scene.textures.exists(NPC_ARROW_TEXTURE))){
      if(!spec.eager)this.resident.set(spec.id,spec);return true;
    }
    if(this.scene.time.now<(this.failures.get(spec.id)??0))return false;
    if(this.loading?.id===spec.id||this.preparing?.spec.id===spec.id||this.segmenting?.spec.id===spec.id)return false;
    this.pending.set(spec.id,spec);return false;
  }
  update(){
    if(this.disposed)return;
    if(this.preparing){
      // Multiple maintain calls in the same frame still consume only one step.
      if(this.preparedFrame===this.scene.game.loop.frame)return;
      this.preparedFrame=this.scene.game.loop.frame;
      const {spec,steps}=this.preparing;
      try{
        const result=steps.next();
        if(!result.done)return;
        for(const clip of result.value)this.scene.anims.create({key:clip.key,
          frames:clip.frames.map(frame=>({key:clip.texture,frame})),frameRate:clip.frameRate,repeat:clip.repeat});
        this.resident.delete(spec.id);this.resident.set(spec.id,spec);this.failures.delete(spec.id);
        this.preparing=null;this.removeSources(spec);
      }catch(error){this.preparing=null;steps.return([]);this.failed(spec,error);this.removeSources(spec);}
      return;
    }
    // Keep a bounded cache of already prepared animation atlases across road-party
    // unloads. Releasing them after only 500 ms forced expensive PNG pixel scans,
    // canvas repacking and GPU uploads each time the next party approached.
    // The six-atlas cap below still evicts an unused sheet when a new one needs
    // room, and destroy() releases everything on scene shutdown.
    if(this.loading||this.segmenting||this.scene.load.isLoading())return;
    // Alice, story allies and road parties share the same texture namespace.
    // Serialize preparation too, not only downloads, to prevent partial reads.
    for(const owner of artOwners.get(this.scene)??[])if(owner!==this&&(owner.loading||owner.preparing||owner.segmenting))return;
    const spec=this.pending.values().next().value as NpcCombatSpec|undefined;if(!spec)return;
    if(this.scene.anims.exists(npcCombatKey(spec,'attack','down'))
      &&(spec.mode!=='bow'||this.scene.textures.exists(NPC_ARROW_TEXTURE))){
      this.pending.delete(spec.id);this.resident.set(spec.id,spec);return;
    }
    if(this.resident.size>=6){
      const unused=[...this.resident.values()].find(s=>!this.referenced(s));
      if(!unused)return;this.release(unused);
    }
    this.pending.delete(spec.id);this.loading=spec;
    spec.sources.forEach((source,i)=>{
      const key=npcCombatSourceKey(spec,i);
      if(!this.scene.textures.exists(key))this.scene.load.image({key,url:source.path,xhrSettings:{responseType:'blob',timeout:15000}});
    });
    if(spec.mode==='bow'&&!this.scene.textures.exists(NPC_ARROW_TEXTURE))
      this.scene.load.image({key:'npc-arrow-source',url:NPC_ARROW_PATH,xhrSettings:{responseType:'blob',timeout:15000}});
    this.scene.load.once(Phaser.Loader.Events.COMPLETE,this.complete,this);this.scene.load.start();
  }
  private complete(){
    const spec=this.loading;this.loading=null;if(!spec||this.disposed)return;
    this.pending.delete(spec.id);
    try{
      if(spec.sources.some((_,i)=>!this.scene.textures.exists(npcCombatSourceKey(spec,i))))throw new Error('Missing source image');
      const job={spec,abort:new AbortController()};this.segmenting=job;
      void this.isolate(spec,job.abort.signal).then(subjects=>{
        if(this.disposed||this.segmenting!==job||job.abort.signal.aborted)return;
        this.segmenting=null;this.preparing={spec,steps:this.prepare(spec,subjects)};
      }).catch(error=>{
        if(this.disposed||this.segmenting!==job)return;
        this.segmenting=null;this.failed(spec,error);this.removeSources(spec);
      });
    }catch(error){
      this.failed(spec,error);this.removeSources(spec);
    }
  }
  private async isolate(spec:NpcCombatSpec,signal:AbortSignal){
    const subjects=new Map<number,ActorSpriteSubject[]>();
    for(const [i,file] of spec.sources.entries()){
      const image=this.scene.textures.get(npcCombatSourceKey(spec,i)).getSourceImage() as HTMLImageElement;
      subjects.set(i,await prepareSpriteSubjects(this.scene,image,file.columns,file.rows,file.path,signal));
    }
    if(spec.mode==='bow'&&!this.scene.textures.exists(NPC_ARROW_TEXTURE)&&this.scene.textures.exists('npc-arrow-source')){
      const image=this.scene.textures.get('npc-arrow-source').getSourceImage() as HTMLImageElement;
      subjects.set(-1,await prepareSpriteSubjects(this.scene,image,1,1,'NPC arrow',signal));
    }
    return subjects;
  }
  private *prepare(spec:NpcCombatSpec,subjects:ReadonlyMap<number,ActorSpriteSubject[]>):Generator<void,SpriteAnimation[]>{
    const clips=this.scene.anims.exists(npcCombatKey(spec,'attack','down'))?[]:yield* prepareNpcCombatSheetSteps(this.scene,spec,subjects);
    // Keep the arrow readback separate from the atlas upload.
    yield;
    if(spec.mode==='bow'&&!this.scene.textures.exists(NPC_ARROW_TEXTURE))prepareNpcArrow(this.scene,'npc-arrow-source',subjects.get(-1)?.[0]);
    return clips;
  }
  private failed(spec:NpcCombatSpec,error:unknown){
    const firstFailure=!this.failures.has(spec.id);
    this.release(spec);this.failures.set(spec.id,this.scene.time.now+15000);
    if(firstFailure)this.report(`Could not prepare ${spec.id} assistance art: ${error instanceof Error?error.message:String(error)}`);
  }
  private removeSources(spec:NpcCombatSpec){
    spec.sources.forEach((_,i)=>{const key=npcCombatSourceKey(spec,i);if(this.scene.textures.exists(key))this.scene.textures.remove(key);});
    if(this.scene.textures.exists('npc-arrow-source'))this.scene.textures.remove('npc-arrow-source');
  }
  private release(spec:NpcCombatSpec){
    this.resident.delete(spec.id);
    // A road party and Alice can use the same huntress sheet. One loader must
    // not remove its frames while another system still needs them.
    if([...artOwners.get(this.scene)??[]].some(owner=>owner!==this&&owner.referenced(spec)))return;
    for(const direction of NPC_COMBAT_DIRECTIONS)for(const state of ['attack','walk'] as const){
      const key=npcCombatKey(spec,state,direction);if(this.scene.anims.exists(key))this.scene.anims.remove(key);
    }
    if(this.scene.textures.exists(spec.texture))this.scene.textures.remove(spec.texture);
  }
  cancelPending(){
    this.pending.clear();
    const segmenting=this.segmenting;
    if(segmenting&&!this.referenced(segmenting.spec)){this.segmenting=null;segmenting.abort.abort();this.removeSources(segmenting.spec);}
    const job=this.preparing;
    if(job&&!this.referenced(job.spec)){
      this.preparing=null;job.steps.return([]);this.release(job.spec);this.removeSources(job.spec);
    }
  }
  destroy(){
    if(this.disposed)return;this.disposed=true;artOwners.get(this.scene)?.delete(this);
    if(this.segmenting){const job=this.segmenting;this.segmenting=null;job.abort.abort();this.removeSources(job.spec);}
    this.scene.load.off(Phaser.Loader.Events.COMPLETE,this.complete,this);
    if(this.preparing){
      const job=this.preparing;this.preparing=null;job.steps.return([]);this.release(job.spec);this.removeSources(job.spec);
    }
    if(this.loading)for(const [i] of this.loading.sources.entries()){
      const key=npcCombatSourceKey(this.loading,i);if(this.scene.textures.exists(key))this.scene.textures.remove(key);
    }
    this.loading=null;
    if(this.scene.textures.exists('npc-arrow-source'))this.scene.textures.remove('npc-arrow-source');
    for(const spec of this.resident.values())this.release(spec);
    this.pending.clear();this.failures.clear();
    if(!artOwners.get(this.scene)?.size&&this.scene.textures.exists(NPC_ARROW_TEXTURE))this.scene.textures.remove(NPC_ARROW_TEXTURE);
  }
}
