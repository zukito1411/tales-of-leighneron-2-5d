import type Phaser from 'phaser';
import {actorSpriteSubjects,actorSpriteGridSubjects,type ActorSpriteSubject} from './spriteComponents';
export interface SubjectRequest {id:number;pixels:Uint8ClampedArray;width:number;height:number;columns:number;rows:number;name:string;grid:boolean}
export interface SubjectReply {id:number;subjects?:ActorSpriteSubject[];error?:string}
interface Job {resolve:(subjects:ActorSpriteSubject[])=>void;reject:(error:Error)=>void;cleanup:()=>void}
const owners=new WeakMap<Phaser.Scene,SpriteSubjectPreparation>();
const aborted=()=>new DOMException('Artwork preparation cancelled','AbortError');

/** One worker per live scene, at most two optional source sheets in flight.
 * Only source isolation moves off-thread; authored crops, fitting and palette
 * remain identical. Eager boot preparation keeps its existing staged path. */
class SpriteSubjectPreparation {
  private readonly jobs=new Map<number,Job>();
  private readonly requests=new Map<number,SubjectRequest>();
  private activeId:number|null=null;
  private worker:Worker|null=null;private nextId=0;private disposed=false;
  private readonly stop=()=>this.destroy();
  constructor(private readonly scene:Phaser.Scene){
    scene.events.once('shutdown',this.stop);
    scene.events.once('destroy',this.stop);
  }
  async prepare(image:HTMLImageElement,columns:number,rows:number,name:string,signal:AbortSignal,grid:boolean){
    if(this.disposed||signal.aborted)throw aborted();
    if(this.jobs.size>=2)throw new Error('Optional artwork preparation queue is full');
    // Reading one decoded source is bounded; the expensive connected-component
    // flood fill and pixel isolation no longer run inside the gameplay tick.
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image,0,0);
    const pixels=ctx.getImageData(0,0,image.width,image.height).data;canvas.width=canvas.height=1;
    if(typeof Worker==='undefined'){
      await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
      if(this.disposed||signal.aborted)throw aborted();
      return grid?actorSpriteGridSubjects(pixels,image.width,image.height,columns,rows,{keepDetachedDetails:true}):actorSpriteSubjects(pixels,image.width,image.height,columns,rows,name);
    }
    const id=++this.nextId;
    return new Promise<ActorSpriteSubject[]>((resolve,reject)=>{
      const cancel=()=>{
        const job=this.jobs.get(id);if(!job)return;
        this.jobs.delete(id);this.requests.delete(id);job.cleanup();reject(aborted());
        // Stop obsolete CPU work rather than building an invisible native
        // worker-message queue on repeated room/outfit changes. A queued
        // request from another owner is retained and starts on a fresh worker.
        if(this.activeId===id){this.worker?.terminate();this.worker=null;this.activeId=null;}
        this.pump();
      };
      const timeout=window.setTimeout(()=>this.fail(new Error('Artwork worker timed out')),15000);
      const cleanup=()=>{signal.removeEventListener('abort',cancel);window.clearTimeout(timeout);};
      this.jobs.set(id,{resolve,reject,cleanup});signal.addEventListener('abort',cancel,{once:true});
      this.requests.set(id,{id,pixels,width:image.width,height:image.height,columns,rows,name,grid});this.pump();
    });
  }
  private pump(){
    if(this.disposed||this.activeId!==null)return;
    const request=this.requests.values().next().value as SubjectRequest|undefined;if(!request)return;
    try{
    if(!this.worker){
      this.worker=new Worker(new URL('./spriteSubjects.worker.ts',import.meta.url),{type:'module'});
      this.worker.onmessage=({data}:MessageEvent<SubjectReply>)=>{
        if(data.id!==this.activeId)return;this.activeId=null;
        const job=this.jobs.get(data.id);if(!job)return;
        this.jobs.delete(data.id);job.cleanup();
        if(data.subjects)job.resolve(data.subjects);else job.reject(new Error(data.error??'Artwork isolation failed'));
        this.pump();
      };
      this.worker.onerror=event=>{this.fail(new Error(event.message||'Artwork worker failed'));};
    }
    this.activeId=request.id;this.requests.delete(request.id);
    this.worker.postMessage(request,[request.pixels.buffer]);
    }catch(error){this.fail(error instanceof Error?error:new Error(String(error)));}
  }
  private fail(error:Error){this.worker?.terminate();this.worker=null;this.activeId=null;for(const job of this.jobs.values()){job.cleanup();job.reject(error);}this.jobs.clear();this.requests.clear();}
  private destroy(){
    if(this.disposed)return;this.disposed=true;this.fail(aborted());owners.delete(this.scene);
    this.scene.events.off('shutdown',this.stop);this.scene.events.off('destroy',this.stop);
  }
}
export function prepareSpriteSubjects(scene:Phaser.Scene,image:HTMLImageElement,columns:number,rows:number,name:string,signal:AbortSignal,grid=false){
  let owner=owners.get(scene);if(!owner){owner=new SpriteSubjectPreparation(scene);owners.set(scene,owner);}
  return owner.prepare(image,columns,rows,name,signal,grid);
}
