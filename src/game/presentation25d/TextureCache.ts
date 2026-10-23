import Phaser from 'phaser';
import {LinearFilter,SRGBColorSpace,Texture,type WebGLRenderer} from 'three';
import type {FrameWorkBudget} from './FrameWorkBudget';

interface Entry {texture:Texture;lastUsed:number;bytes:number;uploadedVersion:number;restore:()=>void}
// Brief camera turns must not cause the same PNG/canvas to be reuploaded.
// Bounded, device-aware residency avoids runaway Android WebView memory use.
const IDLE_FRAMES=300;
const MOBILE=/(Android|iPhone|iPad|iPod)/i.test(navigator.userAgent);
const MAX_RESIDENT_BYTES=(MOBILE?80:160)*1024*1024;
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
  get(source:Phaser.Textures.TextureSource,frame:number){
    let entry=this.entries.get(source);
    if(!entry){
      this.coldCreates++;
      const texture=new Texture(source.image);
      texture.colorSpace=SRGBColorSpace;texture.minFilter=texture.magFilter=LinearFilter;
      texture.generateMipmaps=false;texture.needsUpdate=true;
      texture.onUpdate=()=>{const current=this.entries.get(source);if(current){current.uploadedVersion=texture.version;this.pending.delete(source);}};
      const original=source.update;
      const update:typeof original=function(){const result=original.call(source);texture.needsUpdate=true;return result;};
      source.update=update;
      const restoreDynamic: (()=>void)[]=[];
      if(source.texture instanceof Phaser.Textures.DynamicTexture){
        const dynamic=source.texture,fill=dynamic.fill,clear=dynamic.clear,endDraw=dynamic.endDraw;
        const nextFill:typeof fill=(...args)=>{const result=fill.apply(dynamic,args);texture.needsUpdate=true;return result;};
        const nextClear:typeof clear=(...args)=>{const result=clear.apply(dynamic,args);texture.needsUpdate=true;return result;};
        const nextEnd:typeof endDraw=(...args)=>{const result=endDraw.apply(dynamic,args);texture.needsUpdate=true;return result;};
        dynamic.fill=nextFill;dynamic.clear=nextClear;dynamic.endDraw=nextEnd;
        restoreDynamic.push(()=>{if(dynamic.fill===nextFill)dynamic.fill=fill;if(dynamic.clear===nextClear)dynamic.clear=clear;if(dynamic.endDraw===nextEnd)dynamic.endDraw=endDraw;});
      }
      entry={texture,lastUsed:frame,bytes:0,uploadedVersion:-1,restore:()=>{if(source.update===update)source.update=original;for(const restore of restoreDynamic)restore();}};
      this.entries.set(source,entry);
    }
    if(entry.texture.image!==source.image){entry.texture.image=source.image;entry.texture.needsUpdate=true;}
    const bytes=Math.max(1,source.width)*Math.max(1,source.height)*4;
    this.bytes+=bytes-entry.bytes;entry.bytes=bytes;
    entry.lastUsed=frame;if(entry.uploadedVersion!==entry.texture.version)this.pending.add(source);return entry.texture;
  }
  prefetch(source:Phaser.Textures.TextureSource,frame:number){
    const entry=this.entries.get(source),bytes=Math.max(1,source.width)*Math.max(1,source.height)*4;
    if(!entry&&this.bytes+bytes>MAX_RESIDENT_BYTES||entry&&this.bytes>MAX_RESIDENT_BYTES&&entry.lastUsed<frame-2)return;
    this.get(source,frame);
  }
  ready(source:Phaser.Textures.TextureSource){const entry=this.entries.get(source);return Boolean(entry&&entry.uploadedVersion===entry.texture.version);}
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
      if(entry.lastUsed<frame-2)idle++;
      if((!source.image||frame-entry.lastUsed>IDLE_FRAMES)&&retired<2){
        this.release(source,entry);retired++;
        if(entry.lastUsed<frame-2)idle--;
      }
    }
    if(retired>=2||this.bytes<=MAX_RESIDENT_BYTES&&idle<=MAX_IDLE_ENTRIES)return;
    // Evict only idle resources, oldest first; never drop visible assets.
    while((this.bytes>MAX_RESIDENT_BYTES||idle>MAX_IDLE_ENTRIES)&&retired<2){
      let oldest:Entry|undefined,oldestSource:Phaser.Textures.TextureSource|undefined;
      for(const [source,entry] of this.entries)if(entry.lastUsed<frame-2&&(!oldest||entry.lastUsed<oldest.lastUsed)){oldest=entry;oldestSource=source;}
      if(!oldest||!oldestSource)break;
      this.release(oldestSource,oldest);retired++;idle--;
    }
  }
  destroy(){for(const entry of this.entries.values()){entry.restore();entry.texture.dispose();}this.entries.clear();this.pending.clear();this.bytes=0;}
}
