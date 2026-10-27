import type {SaveData} from './saveValidation';
import {ForegroundDeadline} from './foregroundDeadline';

export interface SavePreparation {id:number;data:SaveData}
export type PreparedSave={id:number;raw:string;problem:null}|{id:number;raw:null;problem:string};

/** One worker and one snapshot in flight. It has no storage access; only the
 * current live session may commit its validated result on the main thread. */
export class SaveWorker {
  private worker:Worker|undefined;
  private sequence=0;
  private pending:{id:number;complete:(result:PreparedSave|null)=>void}|undefined;
  private readonly deadline=new ForegroundDeadline(()=>this.fail());
  constructor(){
    if(typeof Worker==='undefined')return;
    try{
      this.worker=new Worker(new URL('./save.worker.ts',import.meta.url),{type:'module'});
      this.worker.onmessage=({data}:MessageEvent<PreparedSave>)=>{
        const pending=this.pending;if(!pending||data.id!==pending.id)return;
        this.pending=undefined;this.deadline.clear();pending.complete(data);
      };
      this.worker.onerror=this.worker.onmessageerror=()=>this.fail();
    }catch{this.worker=undefined;}
  }
  get available(){return Boolean(this.worker);}
  get busy(){return this.pending!==undefined;}
  prepare(data:SaveData,complete:(result:PreparedSave|null)=>void){
    if(!this.worker||this.pending)return false;
    const id=++this.sequence;this.pending={id,complete};this.deadline.start(30000);
    try{this.worker.postMessage({id,data} satisfies SavePreparation);}
    catch{this.fail();}
    return true;
  }
  private fail(){
    const pending=this.pending;this.destroy();pending?.complete(null);
  }
  destroy(){
    this.deadline.clear();this.pending=undefined;
    if(this.worker){this.worker.onmessage=null;this.worker.onerror=null;this.worker.onmessageerror=null;this.worker.terminate();this.worker=undefined;}
  }
}
