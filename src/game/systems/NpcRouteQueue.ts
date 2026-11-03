import type {Vec2} from '../types';
import type {FrameWorkBudget} from '../presentation25d/FrameWorkBudget';
import {npcStreetRouteSteps,type NpcRouteVisit} from './npcRoutes';
import {pedestrianBlocksSegment,type PedestrianObstacle} from './pedestrianSpacing';

interface RouteJob {steps:Generator<void,Vec2[],void>;complete:(path:Vec2[])=>void;priority:boolean}
/** One cancellable request per live NPC. Physics and animation retain their
 * existing clock; only route planning shares the bounded background allowance. */
export class NpcRouteQueue {
 private readonly jobs=new Map<object,RouteJob>();
 private readonly edges=new Map<string,boolean>();
 private epoch='';private turn=0;
 constructor(private readonly revision:()=>string){}
 request(owner:object,town:string,from:Vec2,to:Vec2,clear:NpcRouteVisit,complete:(path:Vec2[])=>void,priority=false,avoid?:PedestrianObstacle){
  this.cancel(owner);
  // Snapshot one local obstruction for this request. Never save crowd state
  // into the shared static-edge cache, or poison another pedestrian's route.
  const obstacle=avoid?{...avoid}:undefined;
  const crowdClear=(a:Vec2,b:Vec2)=>!obstacle||!pedestrianBlocksSegment(a,b,obstacle,obstacle.radius);
  // The route builder probes destination connectors outward, although the
  // actual final leg runs inward. Never authorize re-entry into an occupied goal.
  const connector:NpcRouteVisit=(a,b)=>crowdClear(a,b)
    &&(a.x!==to.x||a.y!==to.y||crowdClear(b,a))?clear(a,b):false;
  const edge: NpcRouteVisit=function*(this:NpcRouteQueue,a:Vec2,b:Vec2){
   if(!crowdClear(a,b))return false;
   while(true){
    const epoch=this.revision();if(epoch!==this.epoch){this.epoch=epoch;this.edges.clear();}
    const key=town+':'+a.x+':'+a.y+'>'+b.x+':'+b.y,cached=this.edges.get(key);
    if(cached!==undefined)return cached;
    const probe=clear(a,b),result=typeof probe==='boolean'?probe:yield* probe;
    // Do not return a mixed-revision edge after scenery publication.
    if(epoch!==this.revision()){yield;continue;}
    if(this.edges.size>=2048)this.edges.delete(this.edges.keys().next().value!);
    this.edges.set(key,result);return result;
   }
  }.bind(this);
  this.jobs.set(owner,{steps:npcStreetRouteSteps(town,from,to,connector,edge),complete,priority});
 }
 cancel(owner:object){const job=this.jobs.get(owner);this.jobs.delete(owner);job?.steps.return([]);}
 advance(work:FrameWorkBudget){
  const allowance=work.remaining('navigation',.35);if(allowance<=0||!this.jobs.size)return;
  const start=performance.now(),deadline=start+allowance;
  try{
   for(let count=0;this.jobs.size&&count<256&&performance.now()<deadline;count++){
    let selected=this.jobs.entries().next().value!;
    if(this.turn++%4!==0)for(const pair of this.jobs)if(pair[1].priority){selected=pair;break;}
    const [owner,job]=selected;this.jobs.delete(owner);
    const result=job.steps.next();
    if(result.done)job.complete(result.value);else this.jobs.set(owner,job);
   }
  }finally{work.charge('navigation',start);}
 }
 clear(){for(const owner of this.jobs.keys())this.cancel(owner);this.edges.clear();this.epoch='';}
}
