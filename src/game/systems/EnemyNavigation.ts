import type {Vec2} from '../types';

type Clear=(from:Vec2,to:Vec2)=>boolean;
interface Node {point:Vec2;g:number;score:number;parent:Node|null;key:string}
interface Route {target:Vec2;path:Vec2[];until:number;retryAt:number;pending:boolean}
interface Search {route:Route;from:Vec2;target:Vec2;clear:Clear;open:Node[];costs:Map<string,number>;best:Node;visited:number}
const STEP=48,MAX_NODES=480,MAX_COST=1800;
const DIRECTIONS= [[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[-1,-1],[1,-1]] as const;
const distance=(a:Vec2,b:Vec2)=>Math.hypot(a.x-b.x,a.y-b.y);
function push(heap:Node[],node:Node){
  let i=heap.push(node)-1;
  while(i>0){const parent=(i-1)>>1;if(heap[parent].score<=node.score)break;heap[i]=heap[parent];i=parent;}heap[i]=node;
}
function pop(heap:Node[]){
  const first=heap[0],last=heap.pop()!;
  if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;
    if(child+1<heap.length&&heap[child+1].score<heap[child].score)child++;
    if(heap[child].score>=last.score)break;heap[i]=heap[child];i=child;}heap[i]=last;}
  return first;
}
/** Incremental local A*: one rotating search slice per simulation frame,
 * at most 20 expansions / 1 ms between nodes. No full-world scan or physics
 * bypass. Cached routes and failed-route cooldowns prevent wall-probe storms. */
export class EnemyNavigation {
  private routes=new WeakMap<object,Route>();
  private readonly jobs=new Map<object,Search>();
  private workedFrame=-1;
  point(owner:object,from:Vec2,target:Vec2,now:number,frame:number,clear:Clear):Vec2{
    this.work(frame,now);
    let route=this.routes.get(owner);
    if(route&&distance(route.target,target)>112){this.forget(owner);route=undefined;}
    if(route){
      while(route.path.length&&distance(from,route.path[0])<24)route.path.shift();
      if(route.path.length&&now<route.until){
        // Every current edge is swept again: newly streamed scenery is real.
        const next=route.path[0],length=distance(from,next),step=Math.min(1,48/Math.max(1,length));
        if(clear(from,{x:from.x+(next.x-from.x)*step,y:from.y+(next.y-from.y)*step}))return next;
        route.path.length=0;this.jobs.delete(owner);route.pending=false;
      }
      if(route.pending||now<route.retryAt)return target;
    }
    // Direct travel is cached too; expensive long terrain probes are not 60 Hz.
    if(clear(from,target)){
      route={target:{...target},path:[{...target}],until:now+350,retryAt:now+350,pending:false};
      this.routes.set(owner,route);return target;
    }
    route={target:{...target},path:[],until:now+4000,retryAt:now+1000,pending:true};
    const first:Node={point:{x:from.x,y:from.y},g:0,score:distance(from,target),parent:null,key:'0:0'};
    this.routes.set(owner,route);this.jobs.set(owner,{route,from:{...from},target:{...target},clear,open:[first],costs:new Map([['0:0',0]]),best:first,visited:0});
    return target;
  }
  private work(frame:number,now:number){
    if(frame===this.workedFrame)return;this.workedFrame=frame;
    const next=this.jobs.entries().next();if(next.done)return;
    const [owner,job]=next.value;this.jobs.delete(owner);
    const deadline=performance.now()+1;
    for(let expanded=0;job.open.length&&job.visited<MAX_NODES&&expanded<20;expanded++){
      if(expanded&&performance.now()>=deadline)break;
      const node=pop(job.open);
      if(node.g!==(job.costs.get(node.key)??Infinity))continue;
      job.visited++;
      if(distance(node.point,job.target)<distance(job.best.point,job.target))job.best=node;
      if(distance(node.point,job.target)<=STEP*2&&job.clear(node.point,job.target)){
        this.finish(job,node,now,true);return;
      }
      for(const [dx,dy] of DIRECTIONS){
        const point={x:node.point.x+dx*STEP,y:node.point.y+dy*STEP};
        const g=node.g+Math.hypot(dx,dy)*STEP;
        const key=Math.round((point.x-job.from.x)/STEP)+':'+Math.round((point.y-job.from.y)/STEP);
        if(g>MAX_COST||(job.costs.get(key)??Infinity)<=g||!job.clear(node.point,point))continue;
        job.costs.set(key,g);push(job.open,{point,g,score:g+distance(point,job.target),parent:node,key});
      }
    }
    if(!job.open.length||job.visited>=MAX_NODES)this.finish(job,job.best,now,false);
    else this.jobs.set(owner,job); // Round-robin: a boxed-in foe cannot monopolize work.
  }
  private finish(job:Search,last:Node,now:number,reached:boolean){
    const path:Vec2[]=reached?[{...job.target}]:[];
    // An unreachable destination may still have a useful closer approach.
    if(reached||distance(last.point,job.target)+STEP<distance(job.from,job.target)){
      for(let node:Node|null=last;node?.parent;node=node.parent)path.unshift(node.point);
    }
    job.route.path=path;job.route.pending=false;job.route.until=now+3000;job.route.retryAt=now+1000;
  }
  forget(owner:object){this.jobs.delete(owner);this.routes.delete(owner);}
  clear(){this.jobs.clear();this.routes=new WeakMap();this.workedFrame=-1;}
}
