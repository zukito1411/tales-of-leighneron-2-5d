import {groundWorldView} from '../presentation25d/plane';
import Phaser from 'phaser';
import {CHUNK_SIZE} from '../../data/world';
import {ART_BY_KEY,type ArtTextureKey} from '../../data/art';
import {isTreeArt,treeLayerKey} from '../../data/treeArt';
import {propGroundProfile,propGroundColorWeight,groundSmoothstep,type PropGroundProfile} from '../../data/propGroundProfiles';

type Actor=Phaser.GameObjects.Sprite|Phaser.GameObjects.Image;
type Color=readonly [number,number,number];
interface Request {texture:ArtTextureKey;frame:number;profile:PropGroundProfile;ground:{x:number;y:number}}
interface Variant {key:string;source:string;color:Color;actors:Set<Actor>;pixels:number}
interface Bounds {left:number;top:number;right:number;bottom:number}
const MAX_VARIANTS=96;
// Keep only a few recently released, exact-color blends for backtracking.
// 1.5m pixels ~= 6 MB of uncompressed RGBA; both limits apply.
const MAX_IDLE_VARIANTS=6,MAX_IDLE_PIXELS=1_500_000;

/** Recolor only authored ground masks against actual baked surroundings.
 * Full frame dimensions, origin, collision registration and metadata survive. */
export class PropGroundBlend{
  private readonly variants=new Map<string,Variant>();
  private readonly idleVariants=new Set<Variant>();
  private idlePixels=0;
  // Alpha bounds are determined by source frame, not by the local ground.
  // Reuse them across different recolored variants of the same artwork.
  private readonly frameBounds=new Map<string,Bounds|null>();
  private readonly bindings=new Map<Actor,Variant>();
  private readonly pending=new Map<Actor,Request>();
  private serial=0;
  private retryMs=0;
  private readonly retry=(_time:number,delta:number)=>{
    // Recolor only one full-size variant per budget tick, rather than eight
    // pixel scans and GPU uploads during the same frame as terrain creation.
    // Maintain a full-detail blend queue, but reduce continual background
    // canvas readbacks/uploads during traversal after the earlier spike fix.
    this.retryMs+=delta;if(this.retryMs<70||!this.pending.size)return;this.retryMs=0;
    const view=groundWorldView(this.scene);
    let unavailable=0;
    const pass=(visible:boolean)=>{
      // Prefer visible art without allocating/sorting the full pending queue.
      for(const [actor,request] of this.pending){
        if(!actor.active){this.pending.delete(actor);continue;}
        if(view.contains(actor.x,actor.y)!==visible)continue;
        if(this.prepare(actor,request)){this.pending.delete(actor);return true;}
        if(++unavailable>=4)return true; // Retry unavailable wood later.
      }
      return false;
    };
    if(!pass(true))pass(false);
  };
  constructor(private readonly scene:Phaser.Scene){scene.events.on(Phaser.Scenes.Events.POST_UPDATE,this.retry);}
  apply(actor:Actor,texture:ArtTextureKey,frame:number,ground:{x:number;y:number}={x:actor.x,y:actor.y}){
    const profile=propGroundProfile(texture,frame);if(!profile||this.bindings.has(actor)||this.pending.has(actor))return;
    const request={texture,frame,profile,ground};
    // Preserve the original artwork until the matching full-detail variant
    // is ready; scenery construction never blocks on this pixel operation.
    this.pending.set(actor,request);
    actor.once('destroy',()=>{this.pending.delete(actor);this.unbind(actor);});
  }
  private prepare(actor:Actor,request:Request){
    const {texture,frame,profile}=request;
    // TreeSway installs wood after scenery registration. Blend stationary
    // roots after that handoff; its moving canopy keeps its own original art.
    const split=isTreeArt(texture,frame)&&!(texture==='climate_props'&&frame===1)
      &&this.scene.textures.exists(treeLayerKey(texture,'wood'));
    if(split&&actor.texture.key!==treeLayerKey(texture,'wood'))return false;
    const source=actor.frame,sourceId=`${source.texture.key}:${source.name}`;
    const color=this.groundColor(actor,request);if(!color)return false;
    const id=`${sourceId}:${color.join(':')}`;
    let variant=this.variants.get(id);
    if(!variant){
      // Prefer releasing truly unused blended textures before merging two
      // visibly different live variants. No color or mask approximation added.
      while(this.variants.size>=MAX_VARIANTS&&this.idleVariants.size)this.evictOldestIdle();
      if(this.variants.size>=MAX_VARIANTS)this.mergeSimilarVariants();
      if(this.variants.size>=MAX_VARIANTS){
        variant=[...this.variants.values()].filter(v=>v.source===sourceId)
          .sort((a,b)=>this.colorDistance(a.color,color)-this.colorDistance(b.color,color))[0];
        if(!variant)return false;
      }else{
        const w=source.cutWidth,h=source.cutHeight,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
        const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
        ctx.drawImage(source.source.image as CanvasImageSource,source.cutX,source.cutY,w,h,0,0,w,h);
        const pixels=ctx.getImageData(0,0,w,h),data=pixels.data;
        let bounds=this.frameBounds.get(sourceId);
        if(bounds===undefined&&!this.frameBounds.has(sourceId)){
          bounds=this.bounds(data,w,h);
          if(this.frameBounds.size>=128)this.frameBounds.delete(this.frameBounds.keys().next().value!);
          this.frameBounds.set(sourceId,bounds);
        }
        if(!bounds||!this.recolor(data,w,h,bounds,profile,color))return true;
        ctx.putImageData(pixels,0,0);
        const key=`prop-ground-blend:${this.serial++}`,prepared=this.scene.textures.addCanvas(key,canvas);
        if(!prepared)return false;
        prepared.get('__BASE').customData={...source.customData,groundBlend:{source:sourceId,material:profile.material,color:[...color]}};
        prepared.setFilter(Phaser.Textures.FilterMode.LINEAR);
        variant={key,source:sourceId,color,actors:new Set(),pixels:w*h};this.variants.set(id,variant);
      }
    }
    if(this.idleVariants.delete(variant))this.idlePixels-=variant.pixels;
    this.bindings.set(actor,variant);variant.actors.add(actor);actor.setTexture(variant.key);return true;
  }
  private groundColor(actor:Actor,{texture,ground:point}:Request):Color|null{
    const cx=Math.floor(point.x/CHUNK_SIZE),cy=Math.floor(point.y/CHUNK_SIZE),key=`chunk:${cx}:${cy}`;
    if(!this.scene.textures.exists(key))return null;
    const ground=this.scene.textures.get(key);if(!(ground instanceof Phaser.Textures.CanvasTexture))return null;
    const meta=actor.frame.customData as {visibleBounds?:{width:number}};
    const width=(meta.visibleBounds?.width??ART_BY_KEY[texture].frameWidth)*ART_BY_KEY[texture].density*Math.abs(actor.scaleX);
    const radius=Math.max(8,Math.min(72,width*.38)),x=point.x-cx*CHUNK_SIZE,y=point.y-cy*CHUNK_SIZE;
    const left=Math.max(0,Math.floor(x-radius)),top=Math.max(0,Math.floor(y-8));
    const right=Math.min(CHUNK_SIZE,Math.ceil(x+radius+1)),bottom=Math.min(CHUNK_SIZE,Math.ceil(y+6));
    if(right<=left||bottom<=top)return null;
    const data=ground.getContext().getImageData(left,top,right-left,bottom-top).data;
    // The exact same three-channel median as before, but no sorting or
    // per-sample arrays. Histograms are 256 buckets per channel.
    const red=new Uint16Array(256),green=new Uint16Array(256),blue=new Uint16Array(256);
    let count=0;
    for(let i=0;i<data.length;i+=16)if(data[i+3]>200){
      red[data[i]]++;green[data[i+1]]++;blue[data[i+2]]++;count++;
    }
    if(!count)return null;
    const median=(hist:Uint16Array)=>{
      const mid=Math.floor(count/2);let seen=0;
      for(let value=0;value<256;value++){seen+=hist[value];if(seen>mid)return Math.round(value/8)*8;}
      return 0;
    };
    return [median(red),median(green),median(blue)];
  }
  private bounds(data:Uint8ClampedArray,w:number,h:number):Bounds|null{
    let left=w,top=h,right=0,bottom=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>32){
      left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
    }
    return left<=right&&top<bottom?{left,top,right,bottom}:null;
  }
  private recolor(data:Uint8ClampedArray,w:number,h:number,bounds:Bounds,profile:PropGroundProfile,color:Color){
    const span=bounds.bottom-bounds.top,begin=Math.max(0,Math.floor(bounds.top+span*profile.top));
    const band=span*(1-profile.top),width=Math.max(1,bounds.right-bounds.left);
    const weights=new Uint8Array(w*(h-begin)),edges=new Uint8Array(weights.length);
    let lumaSum=0,weightSum=0;
    for(let y=begin;y<h;y++)for(let x=0;x<w;x++){
      const i=(y*w+x)*4,j=(y-begin)*w+x,alpha=data[i+3];edges[j]=alpha>16?4:0;
      if(!alpha)continue;
      const nx=(x-bounds.left)/width,ny=(y-bounds.top)/span;
      if(profile.protect?.some(([l,t,r,b])=>nx>=l&&nx<=r&&ny>=t&&ny<=b))continue;
      const spatial=groundSmoothstep((y-begin)/Math.max(2,band*.22));
      const weight=propGroundColorWeight(profile.material,data[i],data[i+1],data[i+2])*spatial;
      weights[j]=Math.round(weight*255);
      if(weight>.35){lumaSum+=(data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722)*weight;weightSum+=weight;}
    }
    if(weightSum<2)return false;
    // Distance to the transparent contour softens the sides as well as the
    // bottom. Upper objects and protected foundations never enter this mask.
    for(let y=0;y<h-begin;y++)for(let x=0;x<w;x++){
      const i=y*w+x;if(!edges[i])continue;
      edges[i]=Math.min(edges[i],x?edges[i-1]+1:1,y?edges[i-w]+1:4);
    }
    for(let y=h-begin-1;y>=0;y--)for(let x=w-1;x>=0;x--){
      const i=y*w+x;if(!edges[i])continue;
      edges[i]=Math.min(edges[i],x<w-1?edges[i+1]+1:1,y<h-begin-1?edges[i+w]+1:1);
    }
    const reference=lumaSum/weightSum;
    for(let y=begin;y<h;y++)for(let x=0;x<w;x++){
      const i=(y*w+x)*4,j=(y-begin)*w+x;if(!weights[j])continue;
      const weight=Math.min(1,weights[j]/255*1.2),luma=data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722;
      const shade=Math.max(.3,Math.min(1.3,luma/Math.max(1,reference)));
      for(let c=0;c<3;c++)data[i+c]=Math.round(data[i+c]*(1-weight)+Math.min(255,color[c]*shade)*weight);
      const edge=groundSmoothstep(edges[j]/4);
      // The soil itself admits a little of the tile's real grain/ripples;
      // its perimeter fades further, while unmasked objects remain opaque.
      data[i+3]=Math.round(data[i+3]*(1-weight*(.24+(1-edge)*.70)));
    }
    return true;
  }
  private colorDistance(a:Color,b:Color){return a.reduce((sum,n,i)=>sum+(n-b[i])**2,0);}
  private mergeSimilarVariants(){
    let pair:[Variant,Variant]|null=null,best=Infinity;
    const variants=[...this.variants.values()];
    for(let i=0;i<variants.length;i++)for(let j=i+1;j<variants.length;j++){
      const a=variants[i],b=variants[j];if(a.source!==b.source)continue;
      const distance=this.colorDistance(a.color,b.color);if(distance<best){pair=[a,b];best=distance;}
    }
    if(!pair)return;
    const [keep,release]=pair;
    for(const actor of release.actors){actor.setTexture(keep.key);keep.actors.add(actor);this.bindings.set(actor,keep);}
    release.actors.clear();this.remove(release);
  }
  private unbind(actor:Actor){
    const variant=this.bindings.get(actor);if(!variant)return;
    this.bindings.delete(actor);variant.actors.delete(actor);
    if(!variant.actors.size){
      // Revisit the same tree or building without rescanning, recoloring and
      // uploading its bottom mask. Memory is bounded independently of actors.
      this.idleVariants.add(variant);this.idlePixels+=variant.pixels;
      while(this.idleVariants.size>MAX_IDLE_VARIANTS||this.idlePixels>MAX_IDLE_PIXELS)this.evictOldestIdle();
    }
  }
  private evictOldestIdle(){
    const oldest=this.idleVariants.values().next().value as Variant|undefined;
    if(oldest)this.remove(oldest);
  }
  private remove(variant:Variant){
    if(this.idleVariants.delete(variant))this.idlePixels-=variant.pixels;
    for(const [id,item] of this.variants)if(item===variant){this.variants.delete(id);break;}
    if(this.scene.textures.exists(variant.key))this.scene.textures.remove(variant.key);
  }
  destroy(){
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE,this.retry);this.pending.clear();this.bindings.clear();
    for(const variant of this.variants.values())if(this.scene.textures.exists(variant.key))this.scene.textures.remove(variant.key);
    this.variants.clear();this.idleVariants.clear();this.idlePixels=0;this.frameBounds.clear();
  }
}
