import {Box3,Frustum,Matrix4,type PerspectiveCamera} from 'three';
import type Phaser from 'phaser';
import {CHUNK_SIZE} from '../../data/world';
import {VIEW_DISTANCE} from './environment';
import {PRESENTATION_HINT,type PresentationHint} from './plane';

/** Reusable frustum broad phase for local streaming and static art. The sky
 * has its own full-screen pass and never enters this residency selection. */
export class StreamVisibility {
  private readonly frustum=new Frustum();private readonly vp=new Matrix4();private readonly box=new Box3();
  private x=0;private y=0;
  key='';
  update(camera:PerspectiveCamera,focus:{x:number;y:number}){
    this.frustum.setFromProjectionMatrix(this.vp.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    this.x=focus.x;this.y=focus.y;
    const q=camera.quaternion,p=camera.projectionMatrix.elements;
    this.key=Math.floor(focus.x/64)+':'+Math.floor(focus.y/64)+':'
      +Math.round(q.x*128)+':'+Math.round(q.y*128)+':'+Math.round(q.z*128)+':'+Math.round(q.w*128)+':'
      +Math.round(camera.position.y/32)+':'+Math.round(p[0]*64)+':'+Math.round(p[5]*64);
  }
  chunk(cx:number,cy:number,margin=0,offsetX=0,offsetY=0){
    const left=cx*CHUNK_SIZE-offsetX,top=cy*CHUNK_SIZE-offsetY;
    const dx=Math.max(left-this.x,0,this.x-left-CHUNK_SIZE),dy=Math.max(top-this.y,0,this.y-top-CHUNK_SIZE);
    if(dx*dx+dy*dy>(VIEW_DISTANCE+margin+128)**2)return false;
    // Include tall authored silhouettes whose feet can be below/outside view.
    return this.intersects(left-margin-128,top-margin-128,left+CHUNK_SIZE+margin+128,top+CHUNK_SIZE+margin+128,1800);
  }
  image(image:Phaser.GameObjects.Image){
    const w=Math.abs(image.displayWidth),h=Math.abs(image.displayHeight),key=image.texture.key;
    if(key.startsWith('chunk:')||key==='shared-ocean-chunk')
      return this.intersects(image.x-image.originX*w,image.y-image.originY*h,image.x+(1-image.originX)*w,image.y+(1-image.originY)*h,256);
    // Also cover rotated ground art/bridges with a non-central origin.
    const rise=(image.getData(PRESENTATION_HINT) as PresentationHint|undefined)?.house?.riseScale??1;
    const radius=Math.max(w,h*rise)+128;
    return this.intersects(image.x-radius,image.y-radius,image.x+radius,image.y+radius,Math.max(256,h*rise+384));
  }
  private intersects(left:number,top:number,right:number,bottom:number,height:number){
    this.box.min.set(left,-128,top);this.box.max.set(right,height,bottom);
    return this.frustum.intersectsBox(this.box);
  }
}
