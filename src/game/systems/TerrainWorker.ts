import type {TerrainBaker} from './TerrainBaker';
import {resourceBitmaps,type TerrainRequest,type TerrainReply} from './TerrainBakeProtocol';
import type {ChunkSceneryPlan} from './chunkSceneryPlan';
import {ForegroundDeadline} from '../../utils/foregroundDeadline';

export interface TerrainJob {done:boolean;cancelled:boolean;bitmap?:ImageBitmap;plan?:ChunkSceneryPlan;error?:string}
/** One worker and one in-flight chunk. No unlimited message/bitmap queue.
 * Unsupported or failed WebViews retain the original incremental painter. */
export class TerrainWorker {
  private worker:Worker|undefined;
  private initialized=false;private failed=false;private stopped=false;
  private sequence=0;private current:{id:number;job:TerrainJob}|undefined;
  private readonly deadline=new ForegroundDeadline(()=>this.disable('Terrain worker timed out'));
  constructor(baker:TerrainBaker){
    if(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined'||typeof createImageBitmap==='undefined'){
      this.failed=true;return;
    }
    try{
      const worker=new Worker(new URL('./terrain.worker.ts',import.meta.url),{type:'module'});this.worker=worker;
      worker.onmessage=this.receive;worker.onerror=this.failure;worker.onmessageerror=this.failure;
      this.armTimeout(15000);
      void baker.workerResources(()=>!this.stopped&&!this.failed).then(resources=>{
        const images=resourceBitmaps(resources);
        if(this.stopped||this.failed){for(const image of images)image.close();return;}
        try{worker.postMessage({kind:'init',resources} satisfies TerrainRequest,images);}
        catch(error){for(const image of images)image.close();this.disable(String(error));}
      }).catch(error=>this.disable(String(error)));
    }catch(error){this.disable(String(error));}
  }
  get available(){return !this.failed&&!this.stopped;}
  get ready(){return this.available&&this.initialized&&!this.current;}
  begin(x:number,y:number,pixels:number):TerrainJob|null{
    if(!this.ready||!this.worker)return null;
    const job:TerrainJob={done:false,cancelled:false},id=++this.sequence;
    this.current={id,job};this.armTimeout(4000);
    try{this.worker.postMessage({kind:'bake',id,x,y,pixels} satisfies TerrainRequest);}
    catch(error){this.disable(String(error));}
    return job;
  }
  cancel(job:TerrainJob){
    const alreadyCancelled=job.cancelled;
    job.cancelled=true;job.bitmap?.close();job.bitmap=undefined;
    // A worker cannot interrupt its synchronous painter. Bound the abandoned
    // job's wait so a new region can fall back to the incremental painter.
    if(!alreadyCancelled&&this.current?.job===job)this.armTimeout(1000);
  }
  useIncrementalPainter(reason:string){if(this.available)this.disable(reason);}
  private readonly receive=({data}:MessageEvent<TerrainReply>)=>{
    if(this.stopped||this.failed){if(data.kind==='result')data.bitmap.close();return;}
    if(data.kind==='ready'){
      if(!this.initialized){this.deadline.clear();this.initialized=true;}
      return;
    }
    if(data.kind==='error'){
      if(this.current?.id===data.id||!this.initialized&&data.id===0)this.disable(data.message);
      return;
    }
    const pending=this.current;
    if(!pending||pending.id!==data.id){data.bitmap.close();return;}
    // Stale replies must never cancel another chunk's watchdog.
    this.deadline.clear();
    this.current=undefined;
    if(pending.job.cancelled){data.bitmap.close();pending.job.done=true;return;}
    pending.job.bitmap=data.bitmap;pending.job.plan=data.plan;pending.job.done=true;
  };
  private readonly failure=()=>this.disable('Terrain worker unavailable; using incremental terrain preparation');
  private armTimeout(milliseconds:number){this.deadline.start(milliseconds);}
  private disable(reason:string){
    this.failed=true;this.deadline.clear();
    if(this.worker){this.worker.onmessage=null;this.worker.onerror=null;this.worker.onmessageerror=null;this.worker.terminate();this.worker=undefined;}
    if(this.current){this.current.job.error=reason;this.current.job.done=true;this.current=undefined;}
  }
  destroy(){
    this.stopped=true;
    if(this.current)this.cancel(this.current.job);
    this.disable('Scene closed');
  }
}
