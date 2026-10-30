import type {Vec2} from '../types';
import {ROAD_ROUTES} from '../../data/roadRoutes';
import {SETTLEMENT_LAYOUTS} from '../../data/settlements';
import {TOWN_BY_ID} from '../../data/towns';
import {StaticBoundsIndex} from './StaticBoundsIndex';
import type {ExteriorPlacement} from './ExteriorPlacement';
import type {WorldGenerator} from './WorldGenerator';

interface PublicSegment {a:Vec2;b:Vec2;bounds:{left:number;right:number;top:number;bottom:number}}
interface Search {steps:Generator<void,Vec2|null>;result:Vec2|null;done:boolean;used:number;retryAt:number}
const DIRECTIONS=[[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[-1,-1],[1,-1]] as const;
const publicSegments=new StaticBoundsIndex<PublicSegment>([
  ...ROAD_ROUTES.map(road=>road.points),
  ...SETTLEMENT_LAYOUTS.flatMap(layout=>layout.streets.map(street=>{
    const town=TOWN_BY_ID[layout.townId];
    return street.points.map(p=>({x:town.world.x+p.x,y:town.world.y+p.y}));
  })),
].flatMap(points=>points.slice(1).map((b,i)=>{
  const a=points[i];return {a,b,bounds:{left:Math.min(a.x,b.x),right:Math.max(a.x,b.x),top:Math.min(a.y,b.y),bottom:Math.max(a.y,b.y)}};
})));

/** Local access certificates and resumable placement. Searches never create
 * actors, alter saves, decode artwork or run an independent timer/frame loop. */
export class ExteriorAccess {
  private readonly searches=new Map<string,Search>();
  constructor(private readonly terrain:WorldGenerator,private readonly scenery:ExteriorPlacement,
    private readonly height:(x:number,y:number)=>number){}

  request(key:string,create:()=>Generator<void,Vec2|null>,valid:(p:Vec2)=>boolean,now:number):Vec2|null {
    let search=this.searches.get(key);
    if(search?.done&&search.result&&!valid(search.result)){this.searches.delete(key);search=undefined;}
    if(search?.done&&!search.result&&now>=search.retryAt){this.searches.delete(key);search=undefined;}
    if(!search){
      // Bound both completed certificates and abandoned offscreen jobs.
      if(this.searches.size>=128)this.searches.delete(this.searches.keys().next().value!);
      search={steps:create(),result:null,done:false,used:now,retryAt:0};this.searches.set(key,search);
    }
    search.used=now;
    return search.done?search.result:null;
  }
  advance(now:number,allowance:number){
    if(allowance<=0)return;
    const deadline=performance.now()+allowance;
    // Rotate jobs after each small probe so one enclosed lot cannot delay a
    // different quest contact. Successful positions remain bounded and cached.
    for(let count=0;count<64&&performance.now()<deadline;count++){
      let selected:Search|undefined,key='';
      for(const [id,search] of this.searches){
        if(now-search.used>5000){this.searches.delete(id);continue;}
        if(!search.done){selected=search;key=id;break;}
      }
      if(!selected)break;
      const step=selected.steps.next();
      if(step.done){selected.done=true;selected.result=step.value;selected.retryAt=now+1000;}
      this.searches.delete(key);this.searches.set(key,selected);
    }
  }
  /** A successful result has a swept, terrain-checked connection to an
   * authored street/road, or an escape into open countryside outside a town. */
  *reachable(p:Vec2,excludeId?:string):Generator<void,boolean>{
    const segments=publicSegments.query({left:p.x-768,right:p.x+768,top:p.y-768,bottom:p.y+768});
    const approaches=segments.map(({a,b})=>{
      const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
      const t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;
      return {x:a.x+dx*t,y:a.y+dy*t};
    }).filter(target=>(target.x-p.x)**2+(target.y-p.y)**2<=768**2).sort((a,b)=>(a.x-p.x)**2+(a.y-p.y)**2-(b.x-p.x)**2-(b.y-p.y)**2).slice(0,8);
    for(const target of approaches){if(yield* this.clearPath(p,target,excludeId))return true;yield;}
    // Remote quest sites may be far from a painted road. They must still have
    // an actual exit into surrounding countryside, not an enclosed clear pixel.
    if(!this.terrain.getTownAt(p.x,p.y))for(const [dx,dy] of DIRECTIONS){
      const target={x:p.x+dx*384,y:p.y+dy*384};
      if(!this.terrain.getTownAt(target.x,target.y)&&(yield* this.clearPath(p,target,excludeId)))return true;
      yield;
    }
    // Small courts sometimes need a turn before the street comes into view.
    // Explore only this neighborhood; cap nodes and yield between every edge.
    const queue:Vec2[]=[p],visited=new Set<string>(['0:0']);
    for(let head=0;head<queue.length&&head<256;head++){
      const from=queue[head];
      if(head>0&&this.terrain.isRoad(from.x,from.y))return true;
      if(!this.terrain.getTownAt(from.x,from.y)&&Math.hypot(from.x-p.x,from.y-p.y)>=384)return true;
      yield;
      for(const [dx,dy] of DIRECTIONS){
        const to={x:from.x+dx*48,y:from.y+dy*48};
        const ix=Math.round((to.x-p.x)/48),iy=Math.round((to.y-p.y)/48),key=ix+':'+iy;
        if(Math.abs(ix)>16||Math.abs(iy)>16||visited.has(key))continue;
        if(yield* this.clearPath(from,to,excludeId)){visited.add(key);queue.push(to);}
        yield;
      }
    }
    return false;
  }
  private *clearPath(from:Vec2,to:Vec2,excludeId?:string):Generator<void,boolean>{
    if(this.scenery.blocksAccessPath(from,to,excludeId))return false;
    const count=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y)/8));
    let previous=this.height(from.x,from.y);
    const span=Math.hypot(to.x-from.x,to.y-from.y)/count;
    for(let i=0;i<=count;i++){
      const x=from.x+(to.x-from.x)*i/count,y=from.y+(to.y-from.y)*i/count;
      if(!this.terrain.isWalkable(x,y))return false;
      const height=this.height(x,y);
      // Both directions must be usable: quest contacts cannot require an
      // irreversible drop into their enclosure.
      if(Math.abs(height-previous)>32+span*1.5)return false;
      previous=height;yield;
    }
    return true;
  }
  clear(){this.searches.clear();}
}
