import Phaser from 'phaser';
import {awakenedProfile,awakeningArtPath,type AwakeningProfile} from '../../data/awakening';
import {AWAKENED_HERO_STATES,AWAKENED_HERO_DENSITY,type AwakenedHeroManifest} from '../../data/awakenedHero';
import {ART_BY_KEY,type ArtTextureKey} from '../../data/art';
import {useGameStore} from '../../store/gameStore';
import {heroFrameData} from './heroFrameData';
import {losslessImagePath} from '../../utils/losslessImagePath';
import {onPlane,PRESENTATION_HINT,type PresentationHint} from '../presentation25d/plane';
let nextOwner=0;

/** Cosmetic-only presentation. The original actor still owns animation timing,
 * collision, skills, hitboxes and armor stats. Only one outfit is retained.
 * All cropping/registration is authored offline, never scanned during play. */
export class AwakenedHeroVisual{
 private readonly owner=++nextOwner;
 private readonly model:Phaser.GameObjects.Sprite;
 private hidden:Phaser.GameObjects.Sprite|null=null;
 private hiddenFilter=0;
 private current:{slug:string;manifest:AwakenedHeroManifest;keys:Map<string,string>}|null=null;
 private loading='';private epoch=0;private disposed=false;private retryAt=0;private retrySlug='';
 private abort:AbortController|null=null;
 constructor(private readonly scene:Phaser.Scene,private readonly beforeSwap:()=>void=()=>{}){
  this.model=scene.add.sprite(0,0,'leigneron',0).setVisible(false).setName('awakened-hero');
 }
 get readyForm(){return this.current?.slug??null;}
 private restore(){if(this.hidden?.active)this.hidden.cameraFilter=this.hiddenFilter;this.hidden=null;}
 update(actor:Phaser.GameObjects.Sprite):Phaser.GameObjects.Sprite{
  this.restore();this.model.setVisible(false);
  const state=useGameStore.getState(),profile=awakenedProfile(state.weaponId,state.awakenedWeapons);
  if(!profile||!actor.active){if(this.loading){this.epoch++;this.abort?.abort();this.loading='';}return actor;}
  if(this.current?.slug===profile.slug&&this.loading&&this.loading!==profile.slug){this.epoch++;this.abort?.abort();this.loading='';}
  if(this.current?.slug!==profile.slug){
   if(this.loading!==profile.slug&&(this.retrySlug!==profile.slug||Date.now()>=this.retryAt))void this.load(profile);
   return actor;
  }
  const index=Number(actor.frame.name),mapping=AWAKENED_HERO_STATES.find(s=>s.key===actor.texture.key&&index>=s.offset&&index<s.offset+s.frames);
  if(!mapping)return actor;
  const frame=index-mapping.offset,spec=this.current.manifest.states[mapping.state]?.frames[frame],key=this.current.keys.get(mapping.state);
  if(!spec||!key)return actor;
  const density=ART_BY_KEY[actor.texture.key as ArtTextureKey]?.density??heroFrameData(actor.frame).heroDensity??2;
  if(this.model.texture.key!==key||Number(this.model.frame.name)!==frame)this.model.setTexture(key,frame);
  const bodyScale=spec.bodyScale??1,bodyOffsetY=spec.bodyOffsetY??0;
  // Keep actor position/physics fixed. An adjusted origin moves the entire
  // registered pose AND its gripping hand together, with no recrop/resampling.
  this.model.setOrigin(spec.originX,spec.originY-bodyOffsetY*AWAKENED_HERO_DENSITY/(bodyScale*spec.height))
   .setScale(actor.scaleX*density*bodyScale/AWAKENED_HERO_DENSITY,actor.scaleY*density*bodyScale/AWAKENED_HERO_DENSITY).setPosition(actor.x,actor.y)
   .setRotation(actor.rotation).setFlip(actor.flipX,actor.flipY).setAlpha(actor.alpha).setDepth(actor.depth).setVisible(actor.visible);
  this.model.cameraFilter=actor.cameraFilter;
  const hint=actor.getData(PRESENTATION_HINT) as PresentationHint|undefined;
  onPlane(this.model,'upright',hint?.anchor);
  if(actor.tintFill)this.model.setTintFill(actor.tintTopLeft,actor.tintTopRight,actor.tintBottomLeft,actor.tintBottomRight);
  else this.model.setTint(actor.tintTopLeft,actor.tintTopRight,actor.tintBottomLeft,actor.tintBottomRight);
  this.hidden=actor;this.hiddenFilter=actor.cameraFilter;
  actor.cameraFilter|=this.scene.cameras.main.id;
  return this.model;
 }
 private async load(profile:AwakeningProfile){
  const epoch=++this.epoch;this.abort?.abort();const abort=new AbortController();this.abort=abort;
  this.loading=profile.slug;const keys=new Map<string,string>();
  const current=()=>!this.disposed&&epoch===this.epoch;
  const alive=()=>current()&&!abort.signal.aborted;
  const timeout=window.setTimeout(()=>abort.abort(),15000);
  try{
   const root=import.meta.env.BASE_URL+awakeningArtPath(profile,'');
   const response=await fetch(root+'manifest-v1.json',{signal:abort.signal});
   if(!response.ok)throw new Error('Missing cosmetic manifest');
   const manifest:AwakenedHeroManifest=await response.json();
   const states=[...new Map(AWAKENED_HERO_STATES.map(s=>[s.state,s])).values()];
   const finite=(n:number)=>Number.isFinite(n);
   if(manifest.version!==1||manifest.density!==AWAKENED_HERO_DENSITY||!manifest.states||states.some(s=>{
    const state=manifest.states[s.state];
    return !state||!Number.isInteger(state.width)||!Number.isInteger(state.height)||state.width<=0||state.height<=0||state.width>2048||state.height>2048
     ||!Array.isArray(state.frames)||state.frames.length!==s.frames||state.frames.some(f=>
      ![f.x,f.y,f.width,f.height].every(Number.isInteger)||f.x<0||f.y<0||f.width<=0||f.height<=0||f.x+f.width>state.width||f.y+f.height>state.height
      ||f.originX!==.5||!finite(f.originY)||Math.abs(f.originY)>8
      ||Boolean(f.bodyScale!==undefined&&(!finite(f.bodyScale)||f.bodyScale<.5||f.bodyScale>2))
      ||Boolean(f.bodyOffsetY!==undefined&&(!finite(f.bodyOffsetY)||Math.abs(f.bodyOffsetY)>128))
      ||Boolean(f.grip&&(![f.grip.x,f.grip.y,f.grip.angle].every(finite)||f.grip.x<0||f.grip.y<0||f.grip.x>f.width||f.grip.y>f.height)));
   }))throw new Error('Incomplete or invalid cosmetic animation registration');
   // Decode/upload at most two small prepared state atlases concurrently. Raw
   // high-resolution authoring sheets are never loaded by the game.
   let next=0;
   const worker=async()=>{while(next<states.length&&alive()){
    const spec=states[next++],image=new Image();image.decoding='async';
    const cancel=()=>{image.src='';};abort.signal.addEventListener('abort',cancel,{once:true});
    try{image.src=import.meta.env.BASE_URL+losslessImagePath(awakeningArtPath(profile,spec.state+'-atlas-v1.png'));await image.decode();}
    finally{abort.signal.removeEventListener('abort',cancel);}
    if(!alive())return;
    const meta=manifest.states[spec.state];
    if(image.width!==meta.width||image.height!==meta.height||image.width>2048||image.height>2048)throw new Error('Invalid cosmetic atlas dimensions');
    // Yield between uploads instead of packing/recoloring a whole outfit in
    // one gameplay frame. These callbacks exist only while an outfit loads.
    await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));if(!alive())return;
    const key=`awakened-hero:${this.owner}:${profile.slug}:${epoch}:${spec.state}`,texture=this.scene.textures.addImage(key,image);
    if(!texture)throw new Error('Could not register cosmetic atlas');keys.set(spec.state,key);
    meta.frames.forEach((f,i)=>{
     const frame=texture.add(i,0,f.x,f.y,f.width,f.height);
     if(frame)frame.customData={weaponGrip:f.grip,heroDensity:AWAKENED_HERO_DENSITY,heroBodyScale:f.bodyScale??1,visibleBounds:{left:0,top:0,width:f.width/AWAKENED_HERO_DENSITY,height:f.height/AWAKENED_HERO_DENSITY}};
    });
   }};
   const results=await Promise.allSettled([worker(),worker()]);
   const failed=results.find(r=>r.status==='rejected');
   if(failed?.status==='rejected')throw failed.reason;
   if(!alive())return;
   this.beforeSwap();this.restore();this.model.setTexture('leigneron',0).setVisible(false);
   if(this.current)for(const key of this.current.keys.values())this.scene.textures.remove(key);
   this.current={slug:profile.slug,manifest,keys};this.retryAt=0;
  }catch(error){
   if(current()){
    this.retryAt=Date.now()+15000;this.retrySlug=profile.slug;
    console.warn('Awakened outfit could not load:',profile.slug,error);
    useGameStore.setState({toast:'Your awakened weapon is equipped. Its outfit could not load; normal appearance is retained safely.'});
   }
  }finally{
   window.clearTimeout(timeout);
   if(this.current?.keys!==keys)for(const key of keys.values())this.scene.textures.remove(key);
   if(current())this.loading='';
  }
 }
 destroy(){
  this.disposed=true;this.epoch++;this.abort?.abort();this.restore();this.model.destroy();
  if(this.current)for(const key of this.current.keys.values())this.scene.textures.remove(key);this.current=null;
 }
}
