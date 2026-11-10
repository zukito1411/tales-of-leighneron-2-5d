import Phaser from 'phaser';
import {Capacitor,registerPlugin} from '@capacitor/core';
import {LinearFilter,LinearMipmapLinearFilter,SRGBColorSpace,Texture,type WebGLRenderer} from 'three';
import type {FrameWorkBudget} from './FrameWorkBudget';
import {getEffectsQuality} from '../systems/effectsQuality';
import {VISUAL_QUALITY} from './VisualQuality';
import {ACTIVE_SOURCE_LEASE_MS,RECENT_PRESSURE_RECREATE_MS,TEXTURE_IDLE_MS,TEXTURE_RESIDENCY_GRACE_MS,textureGraceMs,mayRetireTexture,textureCacheBudgetMiB} from './textureResidency';
// Canvas-mode Phaser Text resizes its frame/canvas without updating the
// TextureSource dimensions. GPU allocation and UVs must use the actual image.
export function sourceWidth(source:Phaser.Textures.TextureSource){return source.image instanceof HTMLCanvasElement?source.image.width:source.width;}
export function sourceHeight(source:Phaser.Textures.TextureSource){return source.image instanceof HTMLCanvasElement?source.image.height:source.height;}

interface Entry {texture:Texture;lastUsed:number;lastUsedAtMs:number;leaseUntilMs:number;bytes:number;uploadedVersion:number;width:number;height:number;text?:Phaser.GameObjects.Text;restorers:Array<()=>void>;restore:()=>void}
// Brief camera turns must not cause the same PNG/canvas to be reuploaded.
// Bounded, device-aware residency avoids runaway Android WebView memory use.
const MOBILE=/(Android|iPhone|iPad|iPod)/i.test(navigator.userAgent);
const RAM_MIB=1024*1024;
const INITIAL_RAM_GIB=Number((navigator as Navigator&{deviceMemory?:number}).deviceMemory);
const initialBudget=textureCacheBudgetMiB(Number.isFinite(INITIAL_RAM_GIB)&&INITIAL_RAM_GIB>0?INITIAL_RAM_GIB:undefined,MOBILE);
const MAX_IDLE_ENTRIES=MOBILE?48:80;
// Texture budgets are soft: a live scene's full-quality textures cannot be
// thrown out just because the view itself exceeds 128 MiB. Give recently seen
// resources time to be reused on camera turns, but accelerate cleanup when
// memory grows far beyond the normal working set. Never rescale source art.
const nativeMemory=registerPlugin<{profile():Promise<{physicalRamGiB:number;lowMemory:boolean}>}>('GameMemory');
/** Observe the existing source upload boundary: animated atlas frames do not
 * reupload an image; mutable text, terrain, water and lighting update on demand. */
export class TextureCache {
  private softResidentBytes=initialBudget.softMiB*RAM_MIB;
  private emergencyResidentBytes=initialBudget.emergencyMiB*RAM_MIB;
  private ramGiB=Number.isFinite(INITIAL_RAM_GIB)&&INITIAL_RAM_GIB>0?INITIAL_RAM_GIB:0;
  private disposed=false;
  constructor(){
    // Chrome's deviceMemory is optional and intentionally coarse; Android's
    // own read-only memory profile supplies the real RAM tier in the APK.
    // Neither source is a GPU VRAM claim. All values stay hard bounded.
    if(MOBILE&&Capacitor.getPlatform()==='android')
      void nativeMemory.profile().then(profile=>{
        if(this.disposed||!Number.isFinite(profile.physicalRamGiB)||profile.physicalRamGiB<=0)return;
        this.applyRamProfile(profile.physicalRamGiB);
      }).catch(()=>{});
  }
  private applyRamProfile(ramGiB:number){
    this.ramGiB=ramGiB;
    const budget=textureCacheBudgetMiB(ramGiB,MOBILE);
    this.softResidentBytes=budget.softMiB*RAM_MIB;
    this.emergencyResidentBytes=budget.emergencyMiB*RAM_MIB;
    this.prefetchPaused=this.bytes>this.softResidentBytes;
  }
  // Sampler policy is fixed for this renderer lifetime. Changing a menu preset
  // must not dirty/reupload every resident terrain and model atlas at once.
  private readonly profile=VISUAL_QUALITY[getEffectsQuality()];
  private readonly entries=new Map<Phaser.Textures.TextureSource,Entry>();
  private bytes=0;
  private frameTimeMs=0;
  /** Called once per rendered frame; no performance.now() in the many
   * repeated TextureCache.get calls for shared atlases. */
  beginFrame(nowMs:number){if(Number.isFinite(nowMs))this.frameTimeMs=nowMs;}
  private readonly pending=new Set<Phaser.Textures.TextureSource>();
  private uploads=0;private uploadMs=0;
  private uploadPeakMs=0;private uploadOverBudget=0;
  private coldCreates=0;
  private evictions=0;
  private pressureEvictions=0;
  private idleEvictions=0;
  private sourceDisposals=0;
  private pressureRecreates=0;
  private readonly pressureRemovedAt=new WeakMap<Phaser.Textures.TextureSource,number>();
  private prefetchPaused=false;
  private prefetchSuppressed=0;
  stats(){
    let activeSourceMiB=0,recentVisibleMiB=0;
    for(const entry of this.entries.values()){
      if(entry.leaseUntilMs>this.frameTimeMs)activeSourceMiB+=entry.bytes;
      else if(this.frameTimeMs-entry.lastUsedAtMs<=1000)recentVisibleMiB+=entry.bytes;
    }
    return {
      residentMiB:Math.round(this.bytes/1048576),activeSourceMiB:Math.round(activeSourceMiB/1048576),
      recentVisibleMiB:Math.round(recentVisibleMiB/1048576),
      budgetMiB:Math.round(this.softResidentBytes/1048576),
      emergencyMiB:Math.round(this.emergencyResidentBytes/1048576),ramGiB:this.ramGiB,
      textures:this.entries.size,coldCreates:this.coldCreates,evictions:this.evictions,
      pressureEvictions:this.pressureEvictions,pressureRecreates:this.pressureRecreates,
      idleEvictions:this.idleEvictions,sourceDisposals:this.sourceDisposals,
      pendingUploads:this.pending.size,preparedUploads:this.uploads,uploadMs:this.uploadMs,
       uploadPeakMs:this.uploadPeakMs,uploadOverBudget:this.uploadOverBudget,
      prefetchPaused:this.prefetchPaused,prefetchSuppressed:this.prefetchSuppressed
    };
  }
  get(source:Phaser.Textures.TextureSource,frame:number,text?:Phaser.GameObjects.Text){
    const width=sourceWidth(source),height=sourceHeight(source);
    let entry=this.entries.get(source);
    // Shared atlases can be requested hundreds of times in one draw. Their
    // memory charge changes only when image identity/dimensions change. Keep
    // immediate dirty-version checks, including updates made in this frame.
    if(entry&&entry.width===width&&entry.height===height&&entry.texture.image===source.image&&(!text||entry.text===text)){
      entry.lastUsed=frame;entry.lastUsedAtMs=this.frameTimeMs;
      if(entry.uploadedVersion!==entry.texture.version)this.pending.add(source);
      return entry.texture;
    }
    if(!entry){
      this.coldCreates++;
      const removedAt=this.pressureRemovedAt.get(source);
      if(removedAt!==undefined){
        if(this.frameTimeMs-removedAt<RECENT_PRESSURE_RECREATE_MS)this.pressureRecreates++;
        this.pressureRemovedAt.delete(source);
      }
      const texture=new Texture(source.image);
      texture.colorSpace=SRGBColorSpace;texture.minFilter=texture.magFilter=LinearFilter;
      // Ground and the guttered model material tiles use mipmaps. Sprite
      // animation atlases retain their filtering to avoid neighboring poses.
      const ground=source.texture.key.startsWith('chunk:')||source.texture.key==='shared-ocean-chunk';
      const materials=source.texture.key.startsWith('painted-model-');
      texture.generateMipmaps=ground||materials;
      if(ground||materials){texture.minFilter=LinearMipmapLinearFilter;texture.anisotropy=ground?this.profile.groundAnisotropy:this.profile.modelAnisotropy;}
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
        if(current)this.release(source,current,'source');
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
      entry={texture,lastUsed:frame,lastUsedAtMs:this.frameTimeMs,leaseUntilMs:0,bytes:0,uploadedVersion:-1,width,height,restorers:restoreDynamic,restore:()=>{if(source.update===update)source.update=original;if(source.destroy===destroy)source.destroy=originalDestroy;for(const restore of restoreDynamic)restore();}};
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
    if(this.bytes>this.softResidentBytes)this.prefetchPaused=true;
    entry.lastUsed=frame;entry.lastUsedAtMs=this.frameTimeMs;
    if(entry.uploadedVersion!==entry.texture.version)this.pending.add(source);return entry.texture;
  }
  prefetch(source:Phaser.Textures.TextureSource,frame:number){
    // The active world streamer asks us to warm each resident chunk source
    // every ~150ms. Even when memory exceeds the speculative prefetch budget,
    // preserve ALREADY allocated active sources instead of evicting them 65ms
    // later and rebuilding their full-resolution GPU texture on camera turns.
    // This is a lease on existing memory, not an allocation or quality change.
    const entry=this.entries.get(source);
    if(entry&&source.image){
      entry.leaseUntilMs=Math.max(entry.leaseUntilMs,this.frameTimeMs+ACTIVE_SOURCE_LEASE_MS);
      if(entry.width!==sourceWidth(source)||entry.height!==sourceHeight(source)||entry.texture.image!==source.image)
        this.get(source,frame);
      else if(entry.uploadedVersion!==entry.texture.version)this.pending.add(source);
      return;
    }
    // New speculative sources must still respect the existing cap. Mandatory
    // visible-chunk uploads use preparePresentationSource, not this method.
    if(this.prefetchPaused&&this.bytes<=this.softResidentBytes*.75)this.prefetchPaused=false;
    const key=source.texture.key;
    const mipmaps=key.startsWith('chunk:')||key==='shared-ocean-chunk'||key.startsWith('painted-model-');
    const bytes=Math.ceil(Math.max(1,sourceWidth(source))*Math.max(1,sourceHeight(source))*4*(mipmaps?4/3:1));
    if(this.prefetchPaused||this.bytes+bytes>this.softResidentBytes*.85){
      this.prefetchSuppressed++;return;
    }
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
      const uploadCost=performance.now()-started;
      this.uploads++;this.uploadMs+=uploadCost;
      this.uploadPeakMs=Math.max(this.uploadPeakMs,uploadCost);
      if(uploadCost>8.333)this.uploadOverBudget++;
      work.chargeMs('upload',uploadCost);break;
    }
  }
  private release(source:Phaser.Textures.TextureSource,entry:Entry,reason:'source'|'idle'|'pressure'){
    entry.restore();entry.texture.dispose();this.bytes-=entry.bytes;this.entries.delete(source);this.pending.delete(source);this.evictions++;
    if(reason==='source'){this.sourceDisposals++;this.pressureRemovedAt.delete(source);}
    else if(reason==='idle'){this.idleEvictions++;this.pressureRemovedAt.delete(source);}
    else {this.pressureEvictions++;this.pressureRemovedAt.set(source,this.frameTimeMs);}
  }
  prune(_frame:number){
    let idle=0,retired=0;
    // Destroy a maximum of two GPU resources per frame. A camera turn can
    // retire an entire biome's textures; disposing all of them at once causes
    // a second spike after the original upload.
    for(const [source,entry] of this.entries){
      const age=this.frameTimeMs-entry.lastUsedAtMs;
      const protectedSource=entry.leaseUntilMs>this.frameTimeMs;
      if(!protectedSource&&age>TEXTURE_RESIDENCY_GRACE_MS)idle++;
      if((!source.image||!protectedSource&&age>TEXTURE_IDLE_MS)&&retired<2){
        this.release(source,entry,'idle');retired++;
        if(!protectedSource&&age>TEXTURE_RESIDENCY_GRACE_MS)idle--;
      }
    }
    if(retired>=2||this.bytes<=this.softResidentBytes&&idle<=MAX_IDLE_ENTRIES)return;
    // Evict only idle resources, oldest first; never drop visible assets.
    while((this.bytes>this.softResidentBytes||idle>MAX_IDLE_ENTRIES)&&retired<2){
      let oldest:Entry|undefined,oldestSource:Phaser.Textures.TextureSource|undefined;
      // The normal working set can exceed the *soft* budget. Two-frame
      // eviction was causing recently visible textures to be discarded during
      // camera turns. Keep a short reuse window unless emergency pressure
      // demands quicker retirement; still retire no more than two per frame.
      const graceMs=textureGraceMs(this.bytes,this.softResidentBytes,this.emergencyResidentBytes);
      for(const [source,entry] of this.entries)if(mayRetireTexture(this.frameTimeMs,entry.lastUsedAtMs,entry.leaseUntilMs,graceMs)
        &&(!oldest||entry.lastUsedAtMs<oldest.lastUsedAtMs)){oldest=entry;oldestSource=source;}
      if(!oldest||!oldestSource)break;
      if(this.frameTimeMs-oldest.lastUsedAtMs>TEXTURE_RESIDENCY_GRACE_MS)idle--;
      this.release(oldestSource,oldest,'pressure');retired++;
    }
  }
  destroy(){this.disposed=true;for(const entry of this.entries.values()){entry.restore();entry.texture.dispose();}this.entries.clear();this.pending.clear();this.bytes=0;}
}
