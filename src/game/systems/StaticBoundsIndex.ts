import {overlaps,type Rect} from '../../data/settlementGeometry';
/** Spatial buckets for authored geometry; append while preparing a plan,
 * then keep inserted bounds fixed. Queries touch only the requested cells. */
export class StaticBoundsIndex<T extends {bounds:Rect}> {
 private readonly cells=new Map<string,T[]>();
 constructor(items:readonly T[],private readonly size=512){
  for(const item of items)this.add(item);
 }
 /** Append-only preparation; callers must not mutate an inserted rectangle. */
 add(item:T){this.eachCell(item.bounds,key=>{const cell=this.cells.get(key)??[];cell.push(item);this.cells.set(key,cell);});}
 query(bounds:Rect){
  const result=new Set<T>();this.eachCell(bounds,key=>{for(const item of this.cells.get(key)??[])result.add(item);});return [...result];
 }
 /** Allocation-free early-exit query for frequent path probes; no Set/array
  * is created per sampled NPC movement waypoint. */
 any(bounds:Rect,predicate:(item:T)=>boolean){
  for(let y=Math.floor(bounds.top/this.size);y<=Math.floor(bounds.bottom/this.size);y++)
   for(let x=Math.floor(bounds.left/this.size);x<=Math.floor(bounds.right/this.size);x++)
    for(const item of this.cells.get(x+':'+y)??[])
     if(overlaps(bounds,item.bounds)&&predicate(item))return true;
  return false;
 }
 private eachCell(bounds:Rect,visit:(key:string)=>void){
  for(let y=Math.floor(bounds.top/this.size);y<=Math.floor(bounds.bottom/this.size);y++)
   for(let x=Math.floor(bounds.left/this.size);x<=Math.floor(bounds.right/this.size);x++)visit(x+':'+y);
 }
}
