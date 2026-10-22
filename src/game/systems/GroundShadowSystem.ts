import Phaser from 'phaser';
import {ART_BY_KEY,type ArtTextureKey} from '../../data/art';
import {overlayViewport} from './renderSizing';
import {cloudShadowStamps} from './CloudShadowArt';
import {getEffectsQuality,EFFECTS_QUALITY_EVENT} from './effectsQuality';
import {getGraphicEffects} from './graphicsEffects';

type Actor=Phaser.GameObjects.Sprite|Phaser.GameObjects.Image;
export interface ShadowOptions {
 projection?:number;contactScale?:number;contactHeight?:number;contactOffset?:number;groundOffsetY?:number;contactOpacity?:number;
 /** Normalized atlas footpoint, independent of transparent padding. */
 groundPoint?:{x:number;y:number};projectionBottom?:number;
 /** Ground-plane footprint offsets; hollow structures keep separate contacts. */
 contacts?:readonly {x:number;y:number;width:number;height:number}[];
}
interface Caster extends ShadowOptions {actor:Actor;texture?:string;frame?:string|number;enabled?:boolean}
interface Layer {texture:Phaser.Textures.CanvasTexture;image:Phaser.GameObjects.Image}
const OVERSCAN=96;

/** Cached scenery and changing actors share sunlight and ground registration.
 * Camera overscan avoids repainting/uploading shadows on every scroll frame. */
export class GroundShadowSystem {
 private readonly casters=new Map<Actor,Caster>();
 private readonly scenery=new Set<Caster>();
 private readonly moving=new Set<Caster>();
 private readonly silhouettes=new Map<string,HTMLCanvasElement>();
 private readonly staticVisible:Array<{caster:Caster;frame:Phaser.Textures.Frame}>=[];
 private readonly movingVisible:Array<{caster:Caster;frame:Phaser.Textures.Frame}>=[];
 private readonly staticLayer:Layer;
 private readonly actorLayer:Layer;
 private readonly cloudLayer:Layer;
 private readonly contact=document.createElement('canvas');
 private readonly clouds=cloudShadowStamps(getEffectsQuality()==='low'?3:5);
 private readonly reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
 // LEIGHNERON_CLOUD_SHADOW_OPTIMIZATION_V1
 // Keep clouds anchored to world coordinates, but translate their cached canvas
 // as wind blows. Canvas texture uploads happen only on occasional recaptures.
 private lightweight=getEffectsQuality()==='low';
 private cloudResolution=this.lightweight?.42:.66;
 private readonly onQualityChange=()=>{
  const next=getEffectsQuality()==='low';
  if(next===this.lightweight)return;
  this.lightweight=next;this.cloudResolution=next?.42:.66;
  this.cloudLightKey='';this.cloudDrawMs=10000;
 };
 private cloudPaintElapsed=0;
 private cloudLightKey='';
 private base={x:Infinity,y:Infinity,zoom:0};
 private drawMs=100;private staticScanMs=250;private cloudDrawMs=2000;private cloudElapsed=0;private staticDirty=true;
 private lightingKey='';private sceneryStamp:string|null=null;private actorStamp:string|null=null;
 constructor(private readonly scene:Phaser.Scene){
  const viewport=overlayViewport(scene);
  const makeLayer=(key:string,name:string,depth:number,resolution=1):Layer=>{
   const texture=scene.textures.createCanvas(key,
    Math.max(1,Math.round((viewport.width+OVERSCAN*2)*resolution)),
    Math.max(1,Math.round((viewport.height+OVERSCAN*2)*resolution)))!;
   // Cloud shadows are soft; LINEAR filtering avoids blocky edges at low DPI.
   texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
   return {texture,image:scene.add.image(0,0,key).setOrigin(0).setDepth(depth).setName(name)};
  };
  this.staticLayer=makeLayer('ground-shadows','world-ground-shadows',-940);
  this.actorLayer=makeLayer('ground-shadows-dynamic','actor-ground-shadows',-939);
  this.cloudLayer=makeLayer('passing-cloud-shadows','world-cloud-shadows',-945,this.cloudResolution);
  window.addEventListener(EFFECTS_QUALITY_EVENT,this.onQualityChange);
  this.contact.width=192;this.contact.height=64;const ctx=this.contact.getContext('2d')!;
  ctx.translate(96,32);ctx.scale(1,.32);
  const stamp=ctx.createRadialGradient(0,0,0,0,0,96);
  stamp.addColorStop(0,'rgba(14,19,18,.78)');stamp.addColorStop(.28,'rgba(14,19,18,.56)');
  stamp.addColorStop(.65,'rgba(14,19,18,.2)');stamp.addColorStop(1,'rgba(14,19,18,0)');
  ctx.fillStyle=stamp;ctx.fillRect(-96,-96,192,192);
 }
 register(actor:Actor,retainArtwork=false,options:ShadowOptions={}){
  if(this.casters.has(actor))return;
  const caster:Caster={actor,...options,...(retainArtwork?{texture:actor.texture.key,frame:actor.frame.name}:{})};
  this.casters.set(actor,caster);(retainArtwork?this.scenery:this.moving).add(caster);
  // Moving actors are drawn on their own layer. Their arrival/departure must
  // not invalidate the much larger static scenery shadow canvas.
  if(retainArtwork)this.staticDirty=true;else this.actorStamp=null;
  actor.once('destroy',()=>{
   this.casters.delete(actor);this.scenery.delete(caster);this.moving.delete(caster);
   if(retainArtwork)this.staticDirty=true;else this.actorStamp=null;
  });
 }
 /** Climbers/airborne decorations can suppress ground contact without
  * allocating another caster or changing ordinary actor shadow defaults. */
 setEnabled(actor:Actor,enabled:boolean){
  const caster=this.casters.get(actor);if(!caster||caster.enabled===enabled)return;
  caster.enabled=enabled;this.actorStamp=null;
  if(this.scenery.has(caster))this.staticDirty=true;
 }
 update(delta:number,hour:number,cloudCover=0,windStrength=.18){
  this.drawMs+=delta;this.staticScanMs+=delta;
  this.cloudDrawMs+=delta;
  if(!this.reducedMotion.matches)this.cloudElapsed+=Math.min(100,Math.max(0,delta))*(.016+Math.max(0,Math.min(1,windStrength))*.032);
  const viewport=overlayViewport(this.scene),view=this.scene.cameras.main.worldView,zoom=viewport.zoom;
  const width=viewport.width+OVERSCAN*2,height=viewport.height+OVERSCAN*2;
  const shifted=this.base.zoom!==zoom||this.staticLayer.texture.width!==width||this.staticLayer.texture.height!==height
   ||this.cloudLayer.texture.width!==Math.max(1,Math.round(width*this.cloudResolution))
   ||this.cloudLayer.texture.height!==Math.max(1,Math.round(height*this.cloudResolution))
   ||Math.abs((view.x-this.base.x)*zoom-OVERSCAN)>OVERSCAN/2
   ||Math.abs((view.y-this.base.y)*zoom-OVERSCAN)>OVERSCAN/2;
  if(shifted){
   this.base={x:view.x-OVERSCAN/zoom,y:view.y-OVERSCAN/zoom,zoom};this.staticDirty=true;this.actorStamp=null;
   for(const layer of [this.cloudLayer,this.staticLayer,this.actorLayer]){
    const resolution=layer===this.cloudLayer?this.cloudResolution:1;
    const tw=Math.max(1,Math.round(width*resolution)),th=Math.max(1,Math.round(height*resolution));
    if(layer.texture.width!==tw||layer.texture.height!==th)layer.texture.setSize(tw,th);
    layer.image.setPosition(this.base.x,this.base.y).setDisplaySize(width/zoom,height/zoom);
   }
  }
  // Static scenery needs no redraw for subpixel clock changes. Actor shadows
  // follow at up to 30 Hz, and unchanged poses do not upload another texture.
  const cloud=Math.round(Math.min(1,Math.max(0,cloudCover))*8)/8,sunHour=Math.floor(hour*10)/10;
  const daylight=sunHour>=6&&sunHour<=18?Math.max(0,Math.sin((sunHour-6)/12*Math.PI)):0;
  // Contact shadows have identical pixels after sunset. Changing the clock
  // or cloud cover must not invalidate them while solar projections are off.
  const lightKey=daylight<=.02?'contact':sunHour+':'+cloud;
  if(lightKey!==this.lightingKey){this.lightingKey=lightKey;this.staticDirty=true;this.actorStamp=null;}
  // Keep the original maximum culling reach at night, including custom
  // contact offsets. Its bounds stay fixed while solar projections are off.
  const castX=daylight<=.02?.62:Math.cos((sunHour-6)/12*Math.PI)*(.22+(1-daylight)*.4),castY=daylight<=.02?.4:.16+(1-daylight)*.24;
  const graphics=getGraphicEffects();
  const cloudKey=Math.round(daylight*20)+':'+cloud+':'+graphics.cloudShadows+':'+graphics.sunRays;
  // Cloud movement is a cheap image transform on every frame; only repaint
  // when lighting/viewport changes, the buffer nears its overscan edge, or
  // the weather needs an occasional refreshed cloud pattern.
  const driftPx=Math.abs(this.cloudElapsed-this.cloudPaintElapsed)*zoom;
  const cloudInterval=this.lightweight?1400:850;
  if(!graphics.cloudShadows&&!graphics.sunRays){this.cloudLayer.image.setVisible(false);this.cloudLightKey='';}
  else if(shifted||cloudKey!==this.cloudLightKey||driftPx>OVERSCAN*.4
    ||daylight>.02&&!this.reducedMotion.matches&&this.cloudDrawMs>=cloudInterval){
   this.cloudDrawMs=0;this.cloudLightKey=cloudKey;
   this.cloudPaintElapsed=this.cloudElapsed;
   this.paintClouds(daylight,cloud);
  }
  const cloudShift=this.cloudElapsed-this.cloudPaintElapsed;
  this.cloudLayer.image.setPosition(this.base.x+cloudShift,this.base.y-cloudShift*.24);
  if(this.staticDirty||this.staticScanMs>=(this.lightweight?650:250)){
   this.staticScanMs=0;const visible=this.visible(this.scenery,width,height,castX,castY,this.staticVisible),stamp=this.stamp(visible);
   if(this.staticDirty||stamp!==this.sceneryStamp){this.paint(this.staticLayer,visible,daylight,castX,castY,cloud);this.sceneryStamp=stamp;}
   this.staticDirty=false;
  }
  this.actorLayer.image.setVisible(graphics.dynamicShadows);
  if(!graphics.dynamicShadows){this.actorStamp=null;return;}
  if(this.drawMs<(this.lightweight?70:33)&&!shifted)return;
  this.drawMs=0;const visible=this.visible(this.moving,width,height,castX,castY,this.movingVisible),stamp=this.stamp(visible);
  if(stamp===this.actorStamp)return;
  this.paint(this.actorLayer,visible,daylight,castX,castY,cloud);this.actorStamp=stamp;
 }
 /** Reuse the existing soft ground-contact artwork for bounded interiors;
  * room/actor destruction owns every image and removes its update listener. */
 interiorContact(actor:Actor,depthAt:(y:number)=>number){
  const key='interior-contact-shadow';
  if(!this.scene.textures.exists(key))this.scene.textures.addCanvas(key,this.contact);
  const image=this.scene.add.image(actor.x,actor.y,key).setDepth(depthAt(actor.y));
  const sync=()=>{
   const bounds=((actor.frame.customData??{}) as {visibleBounds?:{width:number}}).visibleBounds;
   const density=ART_BY_KEY[actor.texture.key as ArtTextureKey]?.density??1;
   const width=(bounds?bounds.width*density:actor.frame.cutWidth)*Math.abs(actor.scaleX),radius=Math.max(8,Math.min(30,width*.34));
   image.setPosition(actor.x,actor.y).setDisplaySize(radius*2,radius*2/3).setDepth(depthAt(actor.y))
    .setVisible(actor.visible&&getGraphicEffects().dynamicShadows).setAlpha(actor.alpha);
  };
  const release=()=>image.destroy();
  this.scene.events.on(Phaser.Scenes.Events.POST_UPDATE,sync);actor.once('destroy',release);
  image.once('destroy',()=>{this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE,sync);actor.off('destroy',release);});sync();return image;
 }
 private visible(casters:Set<Caster>,width:number,height:number,castX:number,castY:number,
  result:Array<{caster:Caster;frame:Phaser.Textures.Frame}>){
  let count=0;
  for(const caster of casters){
   const {actor,texture,frame:fixedFrame}=caster;if(caster.enabled===false||!actor.active||!actor.visible||actor.alpha<.05)continue;
   const frame=texture?this.scene.textures.getFrame(texture,fixedFrame):actor.frame;if(!frame)continue;
   const w=frame.cutWidth*Math.abs(actor.scaleX),h=frame.cutHeight*Math.abs(actor.scaleY);
   const reach=w+h*Math.abs(castX)*(caster.projection??1),down=h*castY*(caster.projection??1)+w;
   if(actor.x+reach<this.base.x||actor.x-reach>this.base.x+width/this.base.zoom
    ||actor.y+down<this.base.y||actor.y-w>this.base.y+height/this.base.zoom)continue;
   if(count<result.length){result[count].caster=caster;result[count].frame=frame;}
   else result.push({caster,frame});
   count++;
  }
  result.length=count;
  return result;
 }
 private stamp(visible:Array<{caster:Caster;frame:Phaser.Textures.Frame}>){
  let stamp='';
  // Preserve exact keys without producing intermediate arrays per caster.
  for(const {caster:{actor},frame} of visible){
   if(stamp)stamp+=';';
   stamp+=frame.texture.key+','+frame.name+','
     +Math.round(actor.x*this.base.zoom*4)+','+Math.round(actor.y*this.base.zoom*4)+','
     +actor.scaleX+','+actor.scaleY+','+actor.rotation+','+actor.alpha+','
     +actor.originX+','+actor.originY+','+actor.flipX+','+actor.flipY;
  }
  return stamp;
 }
 private paint(layer:Layer,visible:Array<{caster:Caster;frame:Phaser.Textures.Frame}>,daylight:number,castX:number,castY:number,cloud:number){
  const ctx=layer.texture.getContext(),zoom=this.base.zoom;ctx.clearRect(0,0,layer.texture.width,layer.texture.height);
  for(const {caster,frame} of visible){
   const {actor}=caster;
   const sx=Math.abs(actor.scaleX)*zoom*(actor.flipX?-1:1),sy=Math.abs(actor.scaleY)*zoom*(actor.flipY?-1:1);
   const cos=Math.cos(actor.rotation),sin=Math.sin(actor.rotation),a=sx*cos,b=sx*sin,c=-sy*sin,d=sy*cos;
   const ox=actor.originX*frame.cutWidth,oy=actor.originY*frame.cutHeight;
   const gx=caster.groundPoint?caster.groundPoint.x*frame.cutWidth:ox,gy=caster.groundPoint?caster.groundPoint.y*frame.cutHeight:oy;
   const actorX=(actor.x-this.base.x)*zoom,actorY=(actor.y-this.base.y)*zoom;
   const x=actorX+a*(gx-ox)+c*(gy-oy),y=actorY+b*(gx-ox)+d*(gy-oy)+(caster.groundOffsetY??0)*zoom;
   const bounds=((frame.customData??{}) as {visibleBounds?:{width:number}}).visibleBounds;
   const density=ART_BY_KEY[frame.texture.key as ArtTextureKey]?.density??1;
   const visibleWidth=(bounds?bounds.width*density:frame.cutWidth)*Math.abs(actor.scaleX);
   const radius=Math.max(5,Math.min(220,visibleWidth*.34))*(caster.contactScale??1)*zoom;
   const contactHeight=caster.contactHeight??(2/3),contactY=y+radius*(caster.contactOffset??0);
   ctx.save();ctx.globalAlpha=actor.alpha*(caster.contactOpacity??1);
   if(caster.contacts){for(const contact of caster.contacts){
     const w=contact.width*zoom,h=contact.height*zoom;
     ctx.drawImage(this.contact,actorX+contact.x*zoom-w/2,actorY+contact.y*zoom-h/2,w,h);
   }}else if(radius>0)ctx.drawImage(this.contact,x-radius,contactY-radius*contactHeight/2,radius*2,radius*contactHeight);
   ctx.restore();
   const projection=caster.projection??1;if(daylight<=.02||projection===0)continue;
   const silhouette=this.silhouette(frame,caster.projectionBottom);
   const px=castX*projection,py=castY*projection;
   const m0=a-px*b,m1=-py*b,m2=c-px*d,m3=-py*d;
   ctx.save();
    // At an inclined camera, an entire painted building silhouette projected
    // onto the ground becomes an opaque-looking black carpet. Preserve moving
    // sunlight while keeping these ground shadows translucent and understated.
    const perspective=this.scene.game.registry.get('presentation')==='three-2.5d';
    ctx.globalAlpha=(perspective?.16+daylight*.07:.34+daylight*.3)*(1-cloud*.35)*actor.alpha;
   ctx.setTransform(m0,m1,m2,m3,x-m0*gx-m2*gy,y-m1*gx-m3*gy);
   ctx.drawImage(silhouette,0,0,frame.cutWidth,frame.cutHeight);ctx.restore();
  }
  layer.texture.refresh();
 }
 private paintClouds(daylight:number,cloudCover:number){
  const layer=this.cloudLayer,ctx=layer.texture.getContext(),zoom=this.base.zoom*this.cloudResolution;
  ctx.clearRect(0,0,layer.texture.width,layer.texture.height);
  const graphics=getGraphicEffects();
  layer.image.setVisible(daylight>.02&&(graphics.cloudShadows||graphics.sunRays));
  if(daylight<=.02)return;
  // LEIGHNERON_CLOUD_SHADOW_VISIBILITY_V2
  // Template pixels already have alpha: do not multiply them by another tiny
  // early-morning factor. A softer daylight curve keeps clear cloud shapes
  // visible between sunrise and sunset without creating nighttime shadows.
  const cover=Math.min(1,Math.max(0,cloudCover));
  // LEIGHNERON_WEATHER_SKY_MANUAL_A
  const strength=Math.min(.62,Math.pow(Math.max(0,daylight),.55)*(.38+cover*.20));
  const sun=Math.max(0,Math.min(1,(daylight-.30)/.45))*Math.max(0,1-cover*1.8);
  if(graphics.sunRays&&sun>.08){
   const n=this.lightweight?1:2;
   for(let i=0;i<n;i++){
    ctx.save();
    ctx.translate(layer.texture.width*(.24+i*.50),layer.texture.height*.43);
    ctx.rotate(-.32);
    ctx.scale(layer.texture.width*.11,layer.texture.height*.64);
    const opacity=sun*(this.lightweight ? .075 : .11);
    const glow=ctx.createRadialGradient(0,0,0,0,0,1);
    glow.addColorStop(0,'rgba(255,244,213,'+opacity.toFixed(3)+')');
    glow.addColorStop(.45,'rgba(255,244,213,'+(opacity*.45).toFixed(3)+')');
    glow.addColorStop(1,'rgba(255,244,213,0)');
    ctx.fillStyle=glow;
    ctx.fillRect(-1,-1,2,2);
    ctx.restore();
   }
  }
  const driftX=this.cloudElapsed,driftY=-this.cloudElapsed*.24;
  const left=this.base.x,right=left+layer.texture.width/zoom,top=this.base.y,bottom=top+layer.texture.height/zoom;
  const stepX=900,stepY=640;
  const firstX=Math.floor((left-driftX-1100)/stepX),lastX=Math.ceil((right-driftX+1100)/stepX);
  const firstY=Math.floor((top-driftY-900)/stepY),lastY=Math.ceil((bottom-driftY+900)/stepY);
  const random=(x:number,y:number,salt:number)=>{
   const value=Math.sin(x*127.1+y*311.7+salt*74.7)*43758.5453;
   return value-Math.floor(value);
  };
  if(graphics.cloudShadows)for(let gy=firstY;gy<=lastY;gy++)for(let gx=firstX;gx<=lastX;gx++){
   if(random(gx,gy,9)>.22+cover*.60)continue;
   const seed=random(gx,gy,1),x=(gx+.25+random(gx,gy,2)*.5)*stepX+driftX;
   const y=(gy+.25+random(gx,gy,3)*.5)*stepY+driftY;
   const px=(x-left)*zoom,py=(y-top)*zoom,rotation=(seed-.5)*.7;
   const stamp=this.clouds[Math.floor(random(gx,gy,4)*this.clouds.length)],w=(980+seed*420)*zoom,h=(680+random(gx,gy,5)*280)*zoom;
   ctx.save();ctx.translate(px,py);ctx.rotate(rotation);ctx.globalAlpha=strength*(.75+random(gx,gy,8)*.25);
   ctx.drawImage(stamp,-w/2,-h/2,w,h);ctx.restore();
  }
  layer.texture.refresh();
 }
 private silhouette(frame:Phaser.Textures.Frame,bottom=1){
  const key=`${frame.texture.key}:${frame.name}:${bottom}`,cached=this.silhouettes.get(key);
  if(cached){this.silhouettes.delete(key);this.silhouettes.set(key,cached);return cached;}
  const canvas=document.createElement('canvas'),ratio=Math.min(1,192/Math.max(frame.cutWidth,frame.cutHeight));
  canvas.width=Math.max(1,Math.round(frame.cutWidth*ratio));canvas.height=Math.max(1,Math.round(frame.cutHeight*ratio));
  const ctx=canvas.getContext('2d')!;
  ctx.drawImage(frame.source.image as CanvasImageSource,frame.cutX,frame.cutY,frame.cutWidth,frame.cutHeight,0,0,canvas.width,canvas.height);
  if(bottom<1){
   // Fade out the illustrated dirt/grass pad before projection. Its grounding
   // comes from the surveyed contact footprint, not a stretched ground decal.
   const end=Math.max(0,Math.min(canvas.height,bottom*canvas.height)),start=Math.max(0,end-8);
   const mask=ctx.createLinearGradient(0,start,0,Math.max(start+1,end));
   mask.addColorStop(0,'rgba(0,0,0,1)');mask.addColorStop(1,'rgba(0,0,0,0)');
   ctx.globalCompositeOperation='destination-in';ctx.fillStyle=mask;ctx.fillRect(0,0,canvas.width,canvas.height);
  }
  ctx.globalCompositeOperation='source-in';ctx.fillStyle='#111916';ctx.fillRect(0,0,canvas.width,canvas.height);
  const soft=document.createElement('canvas');soft.width=canvas.width;soft.height=canvas.height;
  const softCtx=soft.getContext('2d')!;softCtx.filter='blur(1px)';softCtx.drawImage(canvas,0,0);
  // Road travelers introduce more animation poses. Cache their full-detail
  // silhouettes across repeat appearances instead of re-blurring each pose.
  // Bound memory use with the existing LRU eviction policy.
  if(this.silhouettes.size>=256)this.silhouettes.delete(this.silhouettes.keys().next().value!);
  this.silhouettes.set(key,soft);return soft;
 }
 destroy(){
  window.removeEventListener(EFFECTS_QUALITY_EVENT,this.onQualityChange);
  this.casters.clear();this.scenery.clear();this.moving.clear();this.silhouettes.clear();
  this.staticVisible.length=0;this.movingVisible.length=0;
  for(const layer of [this.cloudLayer,this.staticLayer,this.actorLayer]){layer.image.destroy();this.scene.textures.remove(layer.texture.key);}
  if(this.scene.textures.exists('interior-contact-shadow'))this.scene.textures.remove('interior-contact-shadow');
  this.contact.width=this.contact.height=1;
 }
}

// LEIGHNERON_MOBILE_GRAPHICS_NPC_FIX_V1
