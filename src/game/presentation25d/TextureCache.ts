import Phaser from 'phaser';
import {LinearFilter,LinearMipmapLinearFilter,SRGBColorSpace,Texture,type WebGLRenderer} from 'three';
import type {FrameWorkBudget} from './FrameWorkBudget';
// Canvas-mode Phaser Text resizes its frame/canvas without updating the
// TextureSource dimensions. GPU allocation and UVs must use the actual image.
export function sourceWidth(source:Phaser.Textures.TextureSource){return source.image instanceof HTMLCanvasElement?source.image.width:source.width;}
export function sourceHeight(source:Phaser.Textures.TextureSource){return source.image instanceof HTMLCanvasElement?source.image.height:source.height;}

interface Entry {texture:Texture;lastUsed:number;bytes:number;uploadedVersion:number;width:number;height:number;text?:Phaser.GameObjects.Text;restorers:Array<()=>void>;restore:()=>void}
// Brief camera turns must not cause the same PNG/canvas to be reuploaded.
// Bounded, device-aware residency avoids runaway Android WebView memory use.
const IDLE_FRAMES=300;
const RESIDENCY_GRACE=120;
const MOBILE=/(Android|iPhone|iPad|iPod)/i.test(navigator.userAgent);
const MAX_RESIDENT_BYTES=(MOBILE?128:256)*1024*1024;
const MAX_IDLE_ENTRIES=MOBILE?48:80;
/** Observe the existing source upload boundary: animated atlas frames do not
 * reupload an image; mutable text, terrain, water and lighting update on demand. */
export class TextureCache {
  private readonly entries=new Map<Phaser.Textures.TextureSource,Entry>();
  private bytes=0;
  private readonly pending=new Set<Phaser.Textures.TextureSource>();
  private uploads=0;private uploadMs=0;
  private coldCreates=0;
  private evictions=0;
  stats(){return {residentMiB:Math.round(this.bytes/1048576),textures:this.entries.size,coldCreates:this.coldCreates,evictions:this.evictions,pendingUploads:this.pending.size,preparedUploads:this.uploads,uploadMs:this.uploadMs};}
  get(source:Phaser.Textures.TextureSource,frame:number,text?:Phaser.GameObjects.Text){
    const width=sourceWidth(source),height=sourceHeight(source);
    let entry=this.entries.get(source);
    if(!entry){
      this.coldCreates++;
      const texture=new Texture(source.image);
      texture.colorSpace=SRGBColorSpace;texture.minFilter=texture.magFilter=LinearFilter;
      // Ground and the guttered model material tiles use mipmaps. Sprite
      // animation atlases retain their filtering to avoid neighboring poses.
      const ground=source.texture.key.startsWith('chunk:')||source.texture.key==='shared-ocean-chunk';
      const materials=source.texture.key.startsWith('painted-model-');
      texture.generateMipmaps=ground||materials;
      if(ground||materials){texture.minFilter=LinearMipmapLinearFilter;texture.anisotropy=ground?4:2;}
      texture.needsUpdate=true;
      texture.onUpdate=()=>{const current=this.entries.get(source);if(current){current.uploadedVersion=texture.version;this.pending.delete(source);}};
      const original=source.update;
      const originalDestroy=source.destroy;
      const update:typeof original=function(){const result=original.call(source);texture.needsUpdate=true;return result;};
      source.update=update;
      // Phaser returns canvas sources to its pool during remove(). Release
      // their Three copy at that same ownership boundary, even while the
      // streaming frame has exhausted its optional retirement allowance.
      const destroy:typeof originalDestroy=()=>{
        const current=this.entries.get(source);
        if(current)this.release(source,current);
        originalDestroy.call(source);
      };
      source.destroy=destroy;
      const restoreDynamic: (()=>void)[]=[];
      if(source.texture instanceof Phaser.Textures.DynamicTexture){
        const dynamic=source.texture,fill=dynamic.fill,clear=dynamic.clear,endDraw=dynamic.endDraw;
        const nextFill:typeof fill=(...args)=>{const result=fill.apply(dynamic,args);texture.needsUpdate=true;return result;};
        const nextClear:typeof clear=(...args)=>{const result=clear.apply(dynamic,args);texture.needsUpdate=true;return result;};
        const nextEnd:typeof endDraw=(...args)=>{const result=endDraw.apply(dynamic,args);texture.needsUpdate=true;return result;};
        dynamic.fill=nextFill;dynamic.clear=nextClear;dynamic.endDraw=nextEnd;
        restoreDynamic.push(()=>{if(dynamic.fill===nextFill)dynamic.fill=fill;if(dynamic.clear===nextClear)dynamic.clear=clear;if(dynamic.endDraw===nextEnd)dynamic.endDraw=endDraw;});
      }
      entry={texture,lastUsed:frame,bytes:0,uploadedVersion:-1,width,height,restorers:restoreDynamic,restore:()=>{if(source.update===update)source.update=original;if(source.destroy===destroy)source.destroy=originalDestroy;for(const restore of restoreDynamic)restore();}};
      this.entries.set(source,entry);
    }
    if(text&&entry.text!==text){
      // Canvas-mode Text.updateText redraws its existing canvas without calling
      // TextureSource.update. Observe that actual drawing boundary, including
      // style/wrapping changes, rather than comparing strings every frame.
      const original=text.updateText,texture=entry.texture;
      const update:typeof original=function(){const result=original.call(text);texture.needsUpdate=true;return result;};
      text.updateText=update;entry.text=text;
      entry.restorers.push(()=>{if(text.updateText===update)text.updateText=original;});
    }
    if(entry.width!==width||entry.height!==height){
      // WebGL2 immutable storage cannot accept a differently sized sub-image.
      // Keep the Texture identity used by batches; dispose its old GPU storage.
      entry.texture.dispose();entry.width=width;entry.height=height;
      entry.uploadedVersion=-1;entry.texture.needsUpdate=true;
    }
    if(entry.texture.image!==source.image){entry.texture.image=source.image;entry.texture.needsUpdate=true;}
    const bytes=Math.ceil(Math.max(1,width)*Math.max(1,height)*4*(entry.texture.generateMipmaps?4/3:1));
    this.bytes+=bytes-entry.bytes;entry.bytes=bytes;
    entry.lastUsed=frame;if(entry.uploadedVersion!==entry.texture.version)this.pending.add(source);return entry.texture;
  }
  prefetch(source:Phaser.Textures.TextureSource,frame:number){
    const entry=this.entries.get(source),bytes=Math.max(1,sourceWidth(source))*Math.max(1,sourceHeight(source))*4;
    if(!entry&&this.bytes+bytes>MAX_RESIDENT_BYTES||entry&&this.bytes>MAX_RESIDENT_BYTES&&entry.lastUsed<frame-2)return;
    this.get(source,frame);
  }
  ready(source:Phaser.Textures.TextureSource){const entry=this.entries.get(source);return Boolean(entry&&entry.uploadedVersion===entry.texture.version);}
  invalidate(){
    // A restored context must not eagerly reupload every old town/atlas.
    // get() requeues only sources requested by the live view or preload band.
    this.pending.clear();
    for(const entry of this.entries.values()){entry.uploadedVersion=-1;entry.texture.needsUpdate=true;}
  }
  prepare(renderer:WebGLRenderer,work:FrameWorkBudget){
    if(work.remaining('upload')<=0)return;
    // A GL upload is atomic. Do at most one cold/dirty source here, before it
    // becomes visible; never claim that initTexture itself is asynchronous.
    for(const source of this.pending){
      this.pending.delete(source);const entry=this.entries.get(source);
      if(!entry||!source.image)continue;
      if(entry.uploadedVersion===entry.texture.version)continue;
      const started=performance.now();
      renderer.initTexture(entry.texture);entry.uploadedVersion=entry.texture.version;
      this.uploads++;this.uploadMs+=performance.now()-started;work.charge('upload',started);break;
    }
  }
  private release(source:Phaser.Textures.TextureSource,entry:Entry){entry.restore();entry.texture.dispose();this.bytes-=entry.bytes;this.entries.delete(source);this.pending.delete(source);this.evictions++;}
  prune(frame:number){
    let idle=0,retired=0;
    // Destroy a maximum of two GPU resources per frame. A camera turn can
    // retire an entire biome's textures; disposing all of them at once causes
    // a second spike after the original upload.
    for(const [source,entry] of this.entries){
      if(entry.lastUsed<frame-RESIDENCY_GRACE)idle++;
      if((!source.image||frame-entry.lastUsed>IDLE_FRAMES)&&retired<2){
        this.release(source,entry);retired++;
        if(entry.lastUsed<frame-RESIDENCY_GRACE)idle--;
      }
    }
    if(retired>=2||this.bytes<=MAX_RESIDENT_BYTES&&idle<=MAX_IDLE_ENTRIES)return;
    // Evict only idle resources, oldest first; never drop visible assets.
    while((this.bytes>MAX_RESIDENT_BYTES||idle>MAX_IDLE_ENTRIES)&&retired<2){
      let oldest:Entry|undefined,oldestSource:Phaser.Textures.TextureSource|undefined;
      // Above the byte budget, reclaim sources absent from the last complete
      // view immediately. A two-second grace is only affordable below budget.
      const grace=this.bytes>MAX_RESIDENT_BYTES?2:RESIDENCY_GRACE;
      for(const [source,entry] of this.entries)if(entry.lastUsed<frame-grace&&(!oldest||entry.lastUsed<oldest.lastUsed)){oldest=entry;oldestSource=source;}
      if(!oldest||!oldestSource)break;
      if(oldest.lastUsed<frame-RESIDENCY_GRACE)idle--;
      this.release(oldestSource,oldest);retired++;
    }
  }
  destroy(){for(const entry of this.entries.values()){entry.restore();entry.texture.dispose();}this.entries.clear();this.pending.clear();this.bytes=0;}
}
