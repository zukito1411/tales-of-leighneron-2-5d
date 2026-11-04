import Phaser from 'phaser';
import {REGIONAL_TREE_SHEET as ART} from '../../data/regionalTrees';
import {losslessImagePath} from '../../utils/losslessImagePath';
import {ForegroundDeadline} from '../../utils/foregroundDeadline';
import {createSpriteCropper} from './spriteArt';

/** One optional atlas per game, one decoded source and one cropped tree per
 * yielded step. The chunk owner supplies the existing streaming work budget. */
export class RegionalTreeArt {
 private image:HTMLImageElement|null=null;private decoded=false;private failed=false;private disposed=false;
 private texture:Phaser.Textures.CanvasTexture|undefined;private frame=0;private retryAt=0;
 private readonly deadline=new ForegroundDeadline(()=>this.fail());
 constructor(private readonly scene:Phaser.Scene){}
 private releaseImage(){if(this.image){this.image.onload=this.image.onerror=null;this.image.removeAttribute('src');this.image=null;}this.decoded=false;}
 private fail(){
  this.deadline.clear();this.failed=true;this.retryAt=performance.now()+60000;this.releaseImage();
  if(this.texture&&this.scene.textures.exists(ART.key)&&this.scene.textures.get(ART.key)===this.texture)this.scene.textures.remove(ART.key);
  this.texture=undefined;this.frame=0;
 }
 private start(){
  this.failed=false;const image=new Image();this.image=image;image.decoding='async';
  const decoded=()=>{
   if(this.disposed||this.image!==image)return;
   this.deadline.clear();
   if(image.naturalWidth!==ART.sourceSize[0]||image.naturalHeight!==ART.sourceSize[1]){this.fail();return;}
   this.decoded=true;
  };
  image.onload=()=>{if(typeof image.decode==='function')void image.decode().then(decoded,()=>{if(this.image===image)this.fail();});else decoded();};
  image.onerror=()=>{if(this.image===image)this.fail();};
  this.deadline.start(20000);image.src=import.meta.env.BASE_URL+losslessImagePath(ART.path);
 }
 *prepare():Generator<void,boolean>{
  if(this.disposed)return false;
  if(this.scene.textures.exists(ART.key)&&!this.texture)return true;
  if(this.failed&&performance.now()<this.retryAt)return false;
  if(!this.image&&!this.texture)this.start();
  while(!this.decoded&&!this.failed&&!this.disposed)yield;
  if(this.disposed||this.failed||!this.image)return false;
  try{
   const W=ART.frameWidth*ART.density,H=ART.frameHeight*ART.density;
   if(!this.texture){this.texture=this.scene.textures.createCanvas(ART.key,W*3,H*2)??undefined;if(!this.texture)throw new Error('Tree atlas unavailable');}
   const ctx=this.texture.getContext(),crop=createSpriteCropper();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
   const fit=Math.min((ART.frameWidth-4)/Math.max(...ART.regions.map(r=>r[2])),(ART.frameHeight-4)/Math.max(...ART.regions.map(r=>r[3])))*ART.density;
   while(this.frame<6){
    const i=this.frame,[sx,sy,sw,sh]=ART.regions[i],x=i%3*W,y=Math.floor(i/3)*H;
    const width=sw*fit,height=sh*fit,left=(W-width)/2,top=H-4-height;
    crop(ctx,this.image,ART.regions[i],x+left,y+top,width,height);
    const frame=this.texture.add(i,0,x,y,W,H);
    if(frame)frame.customData={visibleBounds:{left:left/ART.density,top:top/ART.density,width:width/ART.density,height:height/ART.density},sourceRegion:[sx,sy,sw,sh]};
    this.frame++;yield;
   }
   this.texture.refresh();this.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);this.texture=undefined;this.releaseImage();return true;
  }catch(error){console.warn('[trees] Regional tree artwork unavailable:',error);this.fail();return false;}
 }
 destroy(){this.disposed=true;this.deadline.clear();this.releaseImage();if(this.texture)this.fail();}
}
