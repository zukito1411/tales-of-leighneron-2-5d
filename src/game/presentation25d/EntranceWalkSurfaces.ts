import type {HouseShape} from './HouseGeometry';
import {architectureEntryTreads,type EntryTread} from './ArchitectureEntry';
interface Owner {x:number;y:number;rotation:number;originX:number;originY:number;displayWidth:number;displayHeight:number;active:boolean;visible:boolean}
interface Surface {owner:Owner;treads:EntryTread[];x:number;y:number;width:number;height:number;c:number;s:number;base:number;enabled:boolean;cells:number[]}
const CELL=256,key=(x:number,y:number)=>x*1048576+y;
/** Only streamed entrances are indexed. A foot query visits one spatial cell,
 * allocates no arrays and never scans the world or rebuilds a model. */
export class EntranceWalkSurfaces {
 private readonly owners=new Map<Owner,Surface>();
 private readonly cells=new Map<number,Set<Surface>>();
 register(owner:Owner,shape:HouseShape,base:number,enabled:boolean){
  this.remove(owner);const treads=architectureEntryTreads(shape);if(!treads.length)return;
  const width=Math.abs(owner.displayWidth),height=Math.abs(owner.displayHeight),c=Math.cos(owner.rotation),s=Math.sin(owner.rotation);
  const surface:Surface={owner,treads,x:owner.x,y:owner.y,width,height,c,s,base,enabled,cells:[]};
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  for(const t of treads)for(const u of [t.left,t.right])for(const z of [t.back,t.front]){
   const dx=(u+.5-owner.originX)*width,dy=z*width,x=owner.x+dx*c-dy*s,y=owner.y+dx*s+dy*c;
   left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  for(let y=Math.floor(top/CELL);y<=Math.floor(bottom/CELL);y++)for(let x=Math.floor(left/CELL);x<=Math.floor(right/CELL);x++){
   const k=key(x,y),cell=this.cells.get(k)??new Set<Surface>();cell.add(surface);this.cells.set(k,cell);surface.cells.push(k);
  }
  this.owners.set(owner,surface);
 }
 heightAt(x:number,y:number,terrain:number){
  let height=terrain;const entries=this.cells.get(key(Math.floor(x/CELL),Math.floor(y/CELL)));if(!entries)return height;
  for(const p of entries){
   if(!p.enabled||!p.owner.active||!p.owner.visible)continue;
   const dx=x-p.x,dy=y-p.y,u=(dx*p.c+dy*p.s)/p.width-.5+p.owner.originX,z=(-dx*p.s+dy*p.c)/p.width;
   for(const t of p.treads)if(u>=t.left&&u<=t.right&&z>=t.back&&z<=t.front)
    height=Math.max(height,p.base+(p.owner.originY-.5+t.top)*p.height);
  }
  return height;
 }
 enable(owner:Owner,enabled:boolean){const surface=this.owners.get(owner);if(surface)surface.enabled=enabled;}
 remove(owner:Owner){
  const surface=this.owners.get(owner);if(!surface)return;
  for(const k of surface.cells){const cell=this.cells.get(k);cell?.delete(surface);if(!cell?.size)this.cells.delete(k);}
  this.owners.delete(owner);
 }
 clear(){this.owners.clear();this.cells.clear();}
}
