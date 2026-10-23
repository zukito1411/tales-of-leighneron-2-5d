import Phaser from 'phaser';
import {CanvasTexture,LinearFilter,SRGBColorSpace} from 'three';

export interface RasterFrame {
  texture:CanvasTexture;
  left:number;top:number;width:number;height:number;
  hash:number;lastUsed:number;
}
interface NativeCanvasObject extends Phaser.GameObjects.GameObject {
  x:number;y:number;rotation:number;scaleX:number;scaleY:number;
  scrollFactorX:number;scrollFactorY:number;alpha:number;blendMode:number;
  renderCanvas:(renderer:Phaser.Renderer.Canvas.CanvasRenderer,object:NativeCanvasObject,camera:Phaser.Cameras.Scene2D.Camera)=>void;
}
type RasterObject = Phaser.GameObjects.Graphics | Phaser.GameObjects.Shape | Phaser.GameObjects.TileSprite;

/** Phaser 3.90 compatibility boundary: rasterize vector paths / tiled floors,
 * never a screenshot of the world. Sprites keep their original GPU atlases.
 * No canvas readback, image decoding, global textures or additional frame loop. */
export class RasterCache {
  private readonly frames=new Map<RasterObject,RasterFrame>();
  private readonly camera=new Phaser.Cameras.Scene2D.Camera(0,0,1,1);
  constructor(private readonly renderer:Phaser.Renderer.Canvas.CanvasRenderer){}

  get(object:RasterObject,frame:number):RasterFrame|null {
    let hash=17;
    const mix=(n:number)=>{hash=Math.imul(hash,31)+(Math.round(n*1000)|0)|0;};
    if(object instanceof Phaser.GameObjects.Graphics){
      if(!object.commandBuffer.length)return null;
      for(const n of object.commandBuffer)if(typeof n==='number')mix(n);else mix(Number(n));
    }else{
      mix(object.width);mix(object.height);mix(object.displayOriginX);mix(object.displayOriginY);
      if(object instanceof Phaser.GameObjects.TileSprite){
        mix(object.tilePositionX);mix(object.tilePositionY);mix(object.tileScaleX);mix(object.tileScaleY);
        for(const char of object.texture.key+':'+object.frame.name)mix(char.charCodeAt(0));
      }else{
        mix(object.fillColor);mix(object.fillAlpha);mix(object.strokeColor);mix(object.strokeAlpha);mix(object.lineWidth);
        if(object instanceof Phaser.GameObjects.Arc){mix(object.startAngle);mix(object.endAngle);mix(object.radius);}
      }
    }
    let cached=this.frames.get(object);
    if(cached?.hash===hash){cached.lastUsed=frame;return cached;}
    const bounds=object instanceof Phaser.GameObjects.Graphics?graphicsBounds(object):{
      left:-object.displayOriginX-4,top:-object.displayOriginY-4,width:object.width+8,height:object.height+8};
    if(!bounds||bounds.width<=0||bounds.height<=0)return null;
    const scale=Math.min(1,2048/Math.max(bounds.width,bounds.height));
    const width=Math.max(1,Math.ceil(bounds.width*scale)),height=Math.max(1,Math.ceil(bounds.height*scale));
    if(!cached){
      const canvas=document.createElement('canvas'),texture=new CanvasTexture(canvas);
      texture.minFilter=texture.magFilter=LinearFilter;texture.generateMipmaps=false;texture.colorSpace=SRGBColorSpace;
      cached={texture,...bounds,hash,lastUsed:frame};this.frames.set(object,cached);
    }
    const canvas=cached.texture.image as HTMLCanvasElement;
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    const context=canvas.getContext('2d');if(!context)throw new Error('2.5D vector surface unavailable');
    context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,width,height);
    // A detached read-only drawing facade prevents local rasterization from
    // moving an actor, changing physics or modifying the original display list.
    const drawable=Object.create(object) as NativeCanvasObject;
    drawable.x=drawable.y=drawable.rotation=0;drawable.scaleX=drawable.scaleY=1;
    drawable.scrollFactorX=drawable.scrollFactorY=1;drawable.alpha=1;drawable.blendMode=Phaser.BlendModes.NORMAL;
    this.camera.setViewport(0,0,width,height).setOrigin(0,0).setZoom(scale).setScroll(bounds.left,bounds.top);
    this.camera.preRender();
    const previous=this.renderer.currentContext;
    try{this.renderer.currentContext=context;drawable.renderCanvas(this.renderer,drawable,this.camera);}
    finally{this.renderer.currentContext=previous;}
    Object.assign(cached,bounds,{hash,lastUsed:frame});cached.texture.needsUpdate=true;
    return cached;
  }
  prune(frame:number){
    let idle=0,bytes=0,released=0;
    // Rasterized Phaser vectors are expensive to redraw on first appearance.
    // Retain short camera-orbit misses; cap WebGL/Canvas disposal per frame.
    for(const [object,entry] of this.frames){
      if(!object.scene||frame-entry.lastUsed>240){
        if(released<2){this.release(object,entry);released++;}
      }else if(entry.lastUsed<frame){
        idle++;const canvas=entry.texture.image as HTMLCanvasElement;bytes+=canvas.width*canvas.height*4;
      }
    }
    const MAX_IDLE=48,MAX_IDLE_BYTES=12*1024*1024;
    if(released>=2||idle<=MAX_IDLE&&bytes<=MAX_IDLE_BYTES)return;
    while((idle>MAX_IDLE||bytes>MAX_IDLE_BYTES)&&released<2){
      let oldest:RasterFrame|undefined,oldestObject:RasterObject|undefined;
      for(const [object,entry] of this.frames)if(entry.lastUsed<frame&&(!oldest||entry.lastUsed<oldest.lastUsed)){oldest=entry;oldestObject=object;}
      if(!oldest||!oldestObject)break;
      const canvas=oldest.texture.image as HTMLCanvasElement;bytes-=canvas.width*canvas.height*4;idle--;
      this.release(oldestObject,oldest);released++;
    }
  }
  private release(object:RasterObject,entry:RasterFrame){
    entry.texture.dispose();const canvas=entry.texture.image as HTMLCanvasElement;canvas.width=canvas.height=1;
    this.frames.delete(object);
  }
  destroy(){for(const entry of this.frames.values()){entry.texture.dispose();const canvas=entry.texture.image as HTMLCanvasElement;canvas.width=canvas.height=1;}this.frames.clear();this.camera.destroy();}
}

/** Conservative local path bounds, including transformed paths and stroke
 * padding. Command arities match the pinned Phaser 3.90 Graphics renderer. */
function graphicsBounds(object:Phaser.GameObjects.Graphics){
  const commands=object.commandBuffer;
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity,padding=4;
  const matrix=new DOMMatrix(),stack:DOMMatrix[]=[];
  let current=matrix;
  const point=(x:number,y:number)=>{const px=current.a*x+current.c*y+current.e,py=current.b*x+current.d*y+current.f;left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py);};
  const number=(i:number)=>Number(commands[i]);
  for(let i=0;i<commands.length;){
    const id=number(i++);
    switch(id){
      case 0:{const x=number(i),y=number(i+1),r=number(i+2);point(x-r,y-r);point(x+r,y-r);point(x-r,y+r);point(x+r,y+r);i+=7;break;}
      case 3:{const x=number(i),y=number(i+1),w=number(i+2),h=number(i+3);point(x,y);point(x+w,y);point(x,y+h);point(x+w,y+h);i+=4;break;}
      case 4:case 5:point(number(i),number(i+1));i+=2;break;
      case 6:padding=Math.max(padding,number(i)*Math.max(Math.hypot(current.a,current.b),Math.hypot(current.c,current.d))+2);i+=3;break;
      case 7:i+=2;break;
      case 10:case 11:for(let p=0;p<6;p+=2)point(number(i+p),number(i+p+1));i+=6;break;
      case 14:stack.push(DOMMatrix.fromMatrix(current));break;
      case 15:current=stack.pop()??new DOMMatrix();break;
      case 16:current.translateSelf(number(i),number(i+1));i+=2;break;
      case 17:current.scaleSelf(number(i),number(i+1));i+=2;break;
      case 18:current.rotateSelf(number(i)*180/Math.PI);i++;break;
      case 21:i+=8;break;
      case 22:i+=9;break;
      case 1:case 2:case 8:case 9:break;
      default:throw new Error('Unsupported Phaser vector command: '+id);
    }
  }
  return Number.isFinite(left)?{left:left-padding,top:top-padding,width:right-left+padding*2,height:bottom-top+padding*2}:null;
}
