import type {GeographyRequest,GeographyReply} from './GeographyProtocol';
import {ForegroundDeadline} from '../../utils/foregroundDeadline';

interface Client {generation:number;receive:(reply:GeographyReply|null)=>void}
interface Job {id:number;client:Client;generation:number;request:GeographyRequest}
/** One shared worker, one active request and at most one queued request per
 * consumer. The minimap and shoreline never start independent main-thread scans. */
class GeographyQueue {
  private readonly clients=new Set<Client>();
  private readonly pending=new Map<Client,Job>();
  private worker:Worker|undefined;private failed=false;private sequence=0;
  private current:Job|undefined;
  private readonly deadline=new ForegroundDeadline(()=>this.fail());
  constructor(){
    if(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined'){this.failed=true;return;}
    try{
      this.worker=new Worker(new URL('./geography.worker.ts',import.meta.url),{type:'module'});
      this.worker.onmessage=({data}:MessageEvent<GeographyReply>)=>this.receive(data);
      this.worker.onerror=this.worker.onmessageerror=()=>this.fail();
    }catch{this.failed=true;}
  }
  get available(){return !this.failed&&Boolean(this.worker);}
  add(receive:Client['receive']){const client={generation:0,receive};this.clients.add(client);return client;}
  request(client:Client,request:GeographyRequest){
    if(!this.available)return false;
    if(this.current?.client===client&&this.current.generation===client.generation)this.armTimeout(1000);
    client.generation++;
    this.pending.set(client,{id:++this.sequence,client,generation:client.generation,request});this.pump();return true;
  }
  cancel(client:Client){
    // Synchronous worker painting cannot be interrupted. A discarded region
    // must not hold every other geography consumer for the full job timeout.
    // Only shorten once: repeated camera movement cannot extend the deadline.
    if(this.current?.client===client&&this.current.generation===client.generation)this.armTimeout(1000);
    client.generation++;this.pending.delete(client);
  }
  remove(client:Client){this.cancel(client);this.clients.delete(client);if(!this.clients.size){this.stop();shared=undefined;}}
  private pump(){
    if(this.current||!this.worker||this.failed)return;
    const jobs=this.pending.values();let next:Job|undefined;
    for(const job of jobs){next??=job;if(job.request.kind==='water'){next=job;break;}}
    if(!next)return;
    this.pending.delete(next.client);this.current=next;
    this.armTimeout(30000);
    try{this.worker.postMessage({...next.request,id:next.id});}catch{this.fail();}
  }
  private receive(reply:GeographyReply){
    const job=this.current;
    if(!job||reply.id!==job.id){if('bitmap' in reply)reply.bitmap.close();return;}
    this.deadline.clear();this.current=undefined;
    if('error' in reply){this.fail();return;}
    try{
      if(this.clients.has(job.client)&&job.generation===job.client.generation)job.client.receive(reply);
      else reply.bitmap.close();
    }catch(error){
      reply.bitmap.close();console.warn('[geography] Result could not be applied; using incremental preparation',error);this.fail();
    }finally{this.pump();}
  }
  private armTimeout(milliseconds:number){this.deadline.start(milliseconds);}
  private fail(){
    if(this.failed)return;
    this.failed=true;this.stop();
    // One consumer's cleanup failure must not leave the others marked busy.
    for(const client of this.clients){try{client.receive(null);}catch(error){console.warn('[geography] Fallback notification failed',error);}}
  }
  private stop(){
    this.deadline.clear();
    if(this.worker){this.worker.onmessage=null;this.worker.onerror=null;this.worker.onmessageerror=null;this.worker.terminate();this.worker=undefined;}
    this.pending.clear();this.current=undefined;
  }
}
let shared:GeographyQueue|undefined;
export class GeographyWorker {
  private readonly queue=shared??(shared=new GeographyQueue());
  private readonly client:Client;private disposed=false;
  constructor(receive:Client['receive']){this.client=this.queue.add(receive);}
  get available(){return !this.disposed&&this.queue.available;}
  request(request:GeographyRequest){return !this.disposed&&this.queue.request(this.client,request);}
  cancel(){if(!this.disposed)this.queue.cancel(this.client);}
  destroy(){if(this.disposed)return;this.disposed=true;this.queue.remove(this.client);}
}
