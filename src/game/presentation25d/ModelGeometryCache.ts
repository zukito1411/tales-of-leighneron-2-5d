import type {BufferGeometry} from 'three';
import {createHouseGeometry,createWallGeometry,type HouseShape} from './HouseGeometry';
import {createFurnitureGeometry,type FurnitureShape} from './FurnitureGeometry';
import {cloneModelTopology,modelIsOpaque} from './modelTopology';
import type {PresentationHint} from './plane';
import type {FrameWorkBudget} from './FrameWorkBudget';
import {getEffectsQuality} from '../systems/effectsQuality';

/** Renderer-owned CPU templates. Batches always receive independent attributes
 * and GPU buffers, so retiring a shadow/fade batch cannot invalidate the world.
 * Full shape signatures deliberately include UV/material/pose/survey metadata. */
export class ModelGeometryCache {
  private readonly entries=new Map<string,{geometry:BufferGeometry;bytes:number}>();
  private bytes=0;
  private builds=0;private hits=0;private buildMs=0;private peakBuildMs=0;
  constructor(private readonly maxBytes=24*1024*1024,private readonly maxEntries=96){}
  private key(kind:string,shape:unknown){return getEffectsQuality()+':'+kind+':'+JSON.stringify(shape);}
  private template(key:string,build:()=>BufferGeometry,work?:FrameWorkBudget){
    const cached=this.entries.get(key);
    if(cached){this.entries.delete(key);this.entries.set(key,cached);this.hits++;return cached.geometry;}
    const start=performance.now(),geometry=build();
    // This certification is immutable too; don't repeat its full triangle
    // scan for world, shadow and foreground copies of the same template.
    modelIsOpaque(geometry);
    const cost=performance.now()-start;work?.chargeMs('geometry',cost);
    this.builds++;this.buildMs+=cost;this.peakBuildMs=Math.max(this.peakBuildMs,cost);
    let bytes=geometry.index?.array.byteLength??0;
    for(const attribute of Object.values(geometry.attributes))bytes+=attribute.array.byteLength;
    // An unusually large template may be used immediately but is not retained.
    if(bytes>this.maxBytes||this.maxEntries<1)return geometry;
    while(this.entries.size&&(this.entries.size>=this.maxEntries||this.bytes+bytes>this.maxBytes)){
      const oldest=this.entries.entries().next().value;if(!oldest)break;
      this.entries.delete(oldest[0]);this.bytes-=oldest[1].bytes;oldest[1].geometry.dispose();
    }
    this.entries.set(key,{geometry,bytes});this.bytes+=bytes;return geometry;
  }
  private copy(key:string,build:()=>BufferGeometry,work?:FrameWorkBudget){
    const template=this.template(key,build,work),copy=cloneModelTopology(template);
    if(!this.entries.has(key))template.dispose();
    return copy;
  }
  house(shape:HouseShape,inflate=0,emission=false,work?:FrameWorkBudget){
    return this.copy(this.key('house:'+inflate+':'+Number(emission),shape),()=>createHouseGeometry(shape,inflate,emission),work);
  }
  furniture(shape:FurnitureShape,emission=false,work?:FrameWorkBudget){
    return this.copy(this.key('furniture:'+Number(emission),shape),()=>createFurnitureGeometry(shape,emission),work);
  }
  wall(thickness:number,panel:NonNullable<PresentationHint['wall']>['panel'],work?:FrameWorkBudget){
    return this.copy(this.key('wall:'+thickness,panel),()=>createWallGeometry(thickness,panel),work);
  }
  /** Called while chunk scenery is hidden. A single topology build is atomic;
   * its actual cost is charged before another optional job can begin. */
  prepare(hint:PresentationHint|undefined,work:FrameWorkBudget){
    if(!hint||hint.overlay||!hint.house&&!hint.furniture&&!hint.wall)return true;
    const thickness=hint.wall?.thickness??0;
    if(!hint.house&&!hint.furniture&&thickness===0)return true;
    const key=hint.furniture?this.key('furniture:0',hint.furniture)
      :hint.house?this.key('house:0:0',hint.house)
      :this.key('wall:'+thickness,hint.wall!.panel);
    if(this.entries.has(key))return true;
    if(work.remaining('geometry',.5)<=0)return false;
    const geometry=this.template(key,()=>hint.furniture?createFurnitureGeometry(hint.furniture)
      :hint.house?createHouseGeometry(hint.house):createWallGeometry(thickness,hint.wall!.panel),work);
    // Oversized models still publish normally; never turn a cache cap into an
    // impossible readiness fence. The draw path can make its owned copy.
    if(!this.entries.has(key))geometry.dispose();
    return true;
  }
  stats(){return {entries:this.entries.size,cpuMiB:this.bytes/1024/1024,builds:this.builds,hits:this.hits,buildMs:this.buildMs,peakBuildMs:this.peakBuildMs};}
  destroy(){for(const entry of this.entries.values())entry.geometry.dispose();this.entries.clear();this.bytes=0;}
}
