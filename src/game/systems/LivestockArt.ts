import Phaser from 'phaser';
import type {FrameWorkBudget} from '../presentation25d/FrameWorkBudget';
import type {SpriteRegion} from '../../data/art';
import {createSpriteCropper} from './spriteArt';
import {losslessImagePath} from '../../utils/losslessImagePath';
import {ForegroundDeadline} from '../../utils/foregroundDeadline';

import type {LivestockSpecies} from '../../data/livestockSites';
export type {LivestockSpecies} from '../../data/livestockSites';
interface LivestockArt {
 path:string;height:number;regions:readonly SpriteRegion[];
 rowPaths?:readonly string[];roots?:readonly (readonly [number,number])[];
 standingColumn?:number;idleFrame?:number;grazingFrame?:number;walkCycle?:readonly number[];
}
export const LIVESTOCK_ART:Record<LivestockSpecies,LivestockArt>={
 horse:{path:'assets/wildlife/horse/east-v1.png',height:88,rowPaths:['assets/wildlife/horse/east-v1.png','assets/wildlife/horse/south-v1.png','assets/wildlife/horse/north-v1.png'],standingColumn:2,idleFrame:2,grazingFrame:2,walkCycle:[0,1,2,3],
  regions:[[31,143,590,419],[650,144,581,427],[28,692,594,423],[654,694,583,420],[251,32,249,548],[764,32,252,551],[249,639,251,515],[759,642,260,556],[265,52,198,544],[801,49,202,545],[263,667,204,529],[803,666,198,514]],
  roots:[[326.0,143],[940.5,144],[325.0,692],[945.5,694],[375.5,32],[890.0,32],[374.5,639],[889.0,642],[364.0,52],[902.0,49],[365.0,667],[902.0,666]]},
 chicken:{path:'assets/wildlife/chicken/poses-v1.png',height:25,regions:[[39,66,233,287],[353,65,233,288],[666,66,233,280],[984,77,239,275],[57,463,200,298],[370,463,200,298],[684,463,200,296],[999,462,197,297],[60,867,193,331],[373,867,194,332],[689,867,191,331],[999,952,198,246]]},
 goat:{path:'assets/wildlife/goat/poses-v1.png',height:49,regions:[[37,85,251,276],[342,87,258,270],[653,88,261,267],[969,152,263,208],[86,481,162,272],[397,483,162,271],[715,483,159,274],[1022,521,155,230],[87,874,152,305],[400,874,154,311],[711,874,157,309],[1018,941,194,238]]},
 cow:{path:'assets/wildlife/cow/poses-v1.png',height:72,regions:[[13,84,301,245],[325,85,300,241],[639,84,295,247],[954,121,292,208],[77,468,161,294],[394,468,158,296],[705,468,155,297],[1018,475,160,290],[74,870,163,308],[384,868,158,307],[695,868,165,306],[1001,912,211,266]]}
};
const CELL=128,FOOT=118,SOURCE_SIZE=1254;
export const livestockTexture=(species:LivestockSpecies)=>'wildlife-livestock:'+species;
interface AtlasPlan {
 texture?:Phaser.Textures.CanvasTexture;fit:number;feet:number[];roots:readonly (readonly [number,number])[];reference:number;complete:boolean;
}
/** A single uniform fit covers every direction and hoof pose. Historical
 * horse sheets use explicit head/body roots because their 2x2 padding varies. */
function registration(art:LivestockArt):AtlasPlan{
 const roots=art.roots??art.regions.map((_,i)=>[(i%4+.5)*SOURCE_SIZE/4,0] as const);
 const standing=art.standingColumn??0;
 const feet=[0,4,8].map(first=>{const i=first+standing,r=art.regions[i];return r[1]+r[3]-roots[i][1];});
 let fit=Infinity;
 for(const [i,[x,y,w,h]] of art.regions.entries()){
  const [cx,cy]=roots[i],foot=feet[Math.floor(i/4)];
  fit=Math.min(fit,60/Math.max(cx-x,x+w-cx),112/Math.max(1,foot-y+cy),8/Math.max(1,y+h-cy-foot));
 }
 return {fit,feet,roots,reference:standing,complete:false};
}
/** Prepare at most one source at a time; completed atlas rows release their
 * decoded source before the next image starts. Only the final atlas is shown. */
function *prepare(scene:Phaser.Scene,species:LivestockSpecies,image:HTMLImageElement,plan:AtlasPlan,first:number,end:number){
 const key=livestockTexture(species),art=LIVESTOCK_ART[species];
 if(!plan.texture){const texture=scene.textures.createCanvas(key,CELL*4,CELL*3);if(!texture)throw new Error('Could not prepare livestock atlas');plan.texture=texture;}
 const texture=plan.texture,target=texture.getContext(),crop=createSpriteCropper();target.imageSmoothingEnabled=true;
 for(let i=first;i<end;i++){
  const [x,y,w,h]=art.regions[i],[rootX,rootY]=plan.roots[i],cx=i%4*CELL,cy=Math.floor(i/4)*CELL;
  const dx=cx+CELL/2+(x-rootX)*plan.fit,dy=cy+FOOT+(y-rootY-plan.feet[Math.floor(i/4)])*plan.fit;
  crop(target,image,art.regions[i],dx,dy,w*plan.fit,h*plan.fit);
  const frame=texture.add(i,0,cx,cy,CELL,CELL);
  if(frame)frame.customData={visibleBounds:{left:dx-cx,top:dy-cy,width:w*plan.fit,height:h*plan.fit}};
  yield;
 }
 if(end===art.regions.length){
  texture.refresh();texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  scene.registry.set(key+':scale',art.height/(art.regions[plan.reference][3]*plan.fit));plan.complete=true;
 }
}
export interface LivestockArtLoad {ready:Promise<boolean>;advance(work:FrameWorkBudget):void}
/** Optional serial decoding and budgeted preparation, outside cold startup. */
export function loadLivestockArt(scene:Phaser.Scene,species:LivestockSpecies,signal:AbortSignal):LivestockArtLoad{
 const key=livestockTexture(species);if(scene.textures.exists(key))return {ready:Promise.resolve(true),advance:()=>{}};
 let advance:(work:FrameWorkBudget)=>void=()=>{};
 const ready=new Promise<boolean>(resolve=>{
  const art=LIVESTOCK_ART[species],paths=art.rowPaths??[art.path],plan=registration(art);
  let image:HTMLImageElement|null=null,done=false,row=0,steps:Generator<void>|null=null;
  const deadline=new ForegroundDeadline(()=>finish(false));
  const releaseImage=()=>{if(image){image.onload=image.onerror=null;image.removeAttribute('src');image=null;}};
  const finish=(result:boolean)=>{
   if(done)return;done=true;deadline.clear();signal.removeEventListener('abort',cancel);
   try{steps?.return(undefined);}catch(error){console.warn('[wildlife] Atlas cleanup:',error);}steps=null;
   if(!plan.complete&&plan.texture&&scene.textures.exists(key)&&scene.textures.get(key)===plan.texture)scene.textures.remove(key);
   releaseImage();resolve(result&&!signal.aborted);
  };
  const cancel=()=>finish(false);signal.addEventListener('abort',cancel,{once:true});
  const startImage=()=>{
   if(done||signal.aborted)return;
   const owned=new Image();image=owned;owned.decoding='async';
   const failed=()=>{if(!done&&image===owned)finish(false);};
   const decoded=()=>{
    if(done||signal.aborted||image!==owned)return;deadline.clear();
    if(owned.naturalWidth!==SOURCE_SIZE||owned.naturalHeight!==SOURCE_SIZE){console.warn('[wildlife] Livestock artwork registration changed:',species);finish(false);return;}
    steps=prepare(scene,species,owned,plan,art.rowPaths?row*4:0,art.rowPaths?(row+1)*4:art.regions.length);
   };
   owned.onload=()=>{if(typeof owned.decode==='function')void owned.decode().then(decoded,failed);else decoded();};
   owned.onerror=failed;deadline.start(20000);owned.src=import.meta.env.BASE_URL+losslessImagePath(paths[row]);
  };
  advance=work=>{
   if(done||!steps||signal.aborted)return;
   const allowance=work.remaining('actors',.2);if(allowance<=0)return;
   const start=performance.now();
   try{for(let n=0;n<2;n++){
    if(steps.next().done){
     steps=null;releaseImage();
     if(++row===paths.length)finish(true);else startImage();
     break;
    }
    if(performance.now()-start>=allowance)break;
   }}catch(error){console.warn('[wildlife] Livestock artwork unavailable:',species,error);finish(false);}
   finally{work.charge('actors',start);}
  };
  if(signal.aborted){cancel();return;}startImage();
 });
 return {ready,advance:work=>advance(work)};
}
export function applyLivestockArt(scene:Phaser.Scene,sprite:Phaser.GameObjects.Sprite,species:LivestockSpecies){
 const key=livestockTexture(species),scale=Number(scene.registry.get(key+':scale'));
 if(!scene.textures.exists(key)||!Number.isFinite(scale)||scale<=0)return false;
 sprite.setTexture(key,LIVESTOCK_ART[species].idleFrame??0).setOrigin(.5,FOOT/CELL).setScale(scale);return true;
}
