import type Phaser from 'phaser';
import type {StreamVisibility} from './StreamVisibility';
import {PRESENTATION_HINT,type PresentationHint} from './plane';

type StaticImage=Phaser.GameObjects.Image;
interface Entry {x:number;y:number;width:number;height:number;keys:string[]}
const CELL=1536;
export class StaticSpatialIndex {
  private readonly entries=new Map<StaticImage,Entry>();
  private readonly buckets=new Map<string,Set<StaticImage>>();
  private readonly visible=new Set<StaticImage>();
  private queryKey='';private dirty=true;
  constructor(scene:Phaser.Scene){
    const clear=()=>{this.entries.clear();this.buckets.clear();this.visible.clear();indices.delete(scene);};
    scene.events.once('shutdown',clear);scene.events.once('destroy',clear);
  }
  add(image:StaticImage){
    const previous=this.entries.get(image);
    if(previous)for(const key of previous.keys){const bucket=this.buckets.get(key);bucket?.delete(image);if(!bucket?.size)this.buckets.delete(key);}
    const rise=(image.getData(PRESENTATION_HINT) as PresentationHint|undefined)?.house?.riseScale??1;
    const radius=Math.max(960,Math.max(Math.abs(image.displayWidth),Math.abs(image.displayHeight)*rise)*1.7+512);
    const entry={x:image.x,y:image.y,width:image.displayWidth,height:image.displayHeight,keys:[] as string[]};
    for(let y=Math.floor((image.y-radius)/CELL);y<=Math.floor((image.y+radius)/CELL);y++)
      for(let x=Math.floor((image.x-radius)/CELL);x<=Math.floor((image.x+radius)/CELL);x++){
        const key=x+':'+y;let bucket=this.buckets.get(key);if(!bucket){bucket=new Set();this.buckets.set(key,bucket);}
        bucket.add(image);entry.keys.push(key);
      }
    this.entries.set(image,entry);this.dirty=true;
    if(!previous)image.once('destroy',()=>{
      const old=this.entries.get(image);if(!old)return;
      for(const key of old.keys){const bucket=this.buckets.get(key);bucket?.delete(image);if(!bucket?.size)this.buckets.delete(key);}
      this.entries.delete(image);this.visible.delete(image);this.dirty=true;
    });
  }
  query(bounds:{left:number;right:number;top:number;bottom:number}){
    const left=Math.floor(bounds.left/CELL),right=Math.floor(bounds.right/CELL),top=Math.floor(bounds.top/CELL),bottom=Math.floor(bounds.bottom/CELL);
    const key=left+':'+right+':'+top+':'+bottom;
    if(!this.dirty&&key===this.queryKey)return;
    this.dirty=false;this.queryKey=key;this.visible.clear();
    for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)for(const image of this.buckets.get(x+':'+y)??[])this.visible.add(image);
  }
  accepts(object:Phaser.GameObjects.GameObject,visibility?:StreamVisibility){
    const image=object as StaticImage,entry=this.entries.get(image);if(!entry)return true;
    // Housing edits or texture/scale replacements invalidate the index before
    // culling, including objects moving in from a previously excluded cell.
    if(entry.x!==image.x||entry.y!==image.y||entry.width!==image.displayWidth||entry.height!==image.displayHeight){this.add(image);return true;}
    return this.visible.has(image)&&(!visibility||visibility.image(image));
  }
  has(object:Phaser.GameObjects.GameObject){return this.entries.has(object as StaticImage);}
}
const indices=new WeakMap<Phaser.Scene,StaticSpatialIndex>();
export function staticSpatialIndex(scene:Phaser.Scene){let index=indices.get(scene);if(!index){index=new StaticSpatialIndex(scene);indices.set(scene,index);}return index;}
export function markStaticPresentation(image:StaticImage){staticSpatialIndex(image.scene).add(image);}
