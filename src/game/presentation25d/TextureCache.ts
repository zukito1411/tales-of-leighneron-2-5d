import Phaser from 'phaser';
import {LinearFilter,SRGBColorSpace,Texture} from 'three';

interface Entry {texture:Texture;lastUsed:number;restore:()=>void}
/** Observe the existing source upload boundary: animated atlas frames do not
 * reupload an image; mutable text, terrain, water and lighting update on demand. */
export class TextureCache {
  private readonly entries=new Map<Phaser.Textures.TextureSource,Entry>();
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
      entry={texture,lastUsed:frame,restore:()=>{if(source.update===update)source.update=original;for(const restore of restoreDynamic)restore();}};
      this.entries.set(source,entry);
    }
    entry.lastUsed=frame;return entry.texture;
  }
  prune(frame:number){for(const [source,entry] of this.entries)if(frame-entry.lastUsed>2){entry.restore();entry.texture.dispose();this.entries.delete(source);}}
  destroy(){for(const entry of this.entries.values()){entry.restore();entry.texture.dispose();}this.entries.clear();}
}
