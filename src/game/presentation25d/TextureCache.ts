import Phaser from 'phaser';
import {LinearFilter,SRGBColorSpace,Texture} from 'three';

interface Entry {texture:Texture;lastUsed:number;bytes:number;restore:()=>void}
const IDLE_FRAMES=90,MAX_RESIDENT_BYTES=64*1024*1024,MAX_IDLE_ENTRIES=32;
/** Observe the existing source upload boundary: animated atlas frames do not
 * reupload an image; mutable text, terrain, water and lighting update on demand. */
export class TextureCache {
  private readonly entries=new Map<Phaser.Textures.TextureSource,Entry>();
  private bytes=0;
  get(source:Phaser.Textures.TextureSource,frame:number){
    let entry=this.entries.get(source);
    if(!entry){
      const texture=new Texture(source.image);
      texture.colorSpace=SRGBColorSpace;texture.minFilter=texture.magFilter=LinearFilter;
      texture.generateMipmaps=false;texture.needsUpdate=true;
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
      entry={texture,lastUsed:frame,bytes:0,restore:()=>{if(source.update===update)source.update=original;for(const restore of restoreDynamic)restore();}};
      this.entries.set(source,entry);
    }
    const bytes=Math.max(1,source.width)*Math.max(1,source.height)*4;
    this.bytes+=bytes-entry.bytes;entry.bytes=bytes;
    entry.lastUsed=frame;return entry.texture;
  }
  private release(source:Phaser.Textures.TextureSource,entry:Entry){entry.restore();entry.texture.dispose();this.bytes-=entry.bytes;this.entries.delete(source);}
  prune(frame:number){
    let idle=0;
    for(const [source,entry] of this.entries){
      if(!source.image||frame-entry.lastUsed>IDLE_FRAMES)this.release(source,entry);
      else if(entry.lastUsed<frame)idle++;
    }
    // Brief view-edge reuse prevents repeated large atlas uploads during orbit.
    // Current-frame textures are required; only unused entries may be evicted.
    if(!idle||this.bytes<=MAX_RESIDENT_BYTES&&idle<=MAX_IDLE_ENTRIES)return;
    const retired=[...this.entries].filter(([,entry])=>entry.lastUsed<frame).sort((a,b)=>a[1].lastUsed-b[1].lastUsed);
    for(const [source,entry] of retired){
      if(this.bytes<=MAX_RESIDENT_BYTES&&idle<=MAX_IDLE_ENTRIES)break;
      this.release(source,entry);idle--;
    }
  }
  destroy(){for(const entry of this.entries.values()){entry.restore();entry.texture.dispose();}this.entries.clear();this.bytes=0;}
}
