import type {TerrainHeightRange} from '../systems/TerrainHeightField';
import {Box3,Frustum,Matrix4,type PerspectiveCamera} from 'three';
import type Phaser from 'phaser';
import {CHUNK_SIZE} from '../../data/world';
import {VIEW_DISTANCE} from './environment';
import {PRESENTATION_HINT,type PresentationHint} from './plane';

/** Reusable frustum broad phase for local streaming and static art. The sky
 * has its own full-screen pass and never enters this residency selection. */
export class StreamVisibility {
  private readonly frustum=new Frustum();private readonly vp=new Matrix4();private readonly box=new Box3();
  private x=0;private y=0;private terrainMin=0;private terrainMax=0;
  key='';
  update(camera:PerspectiveCamera,focus:{x:number;y:number},terrain?:Readonly<TerrainHeightRange>){
    this.frustum.setFromProjectionMatrix(this.vp.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    this.x=focus.x;this.y=focus.y;
    const valid=terrain&&Number.isFinite(terrain.min)&&Number.isFinite(terrain.max)&&terrain.min<=terrain.max;
    this.terrainMin=valid?terrain.min:0;this.terrainMax=valid?terrain.max:0;
    const q=camera.quaternion,p=camera.projectionMatrix.elements;
    this.key=Math.floor(focus.x/64)+':'+Math.floor(focus.y/64)+':'
      +Math.round(q.x*128)+':'+Math.round(q.y*128)+':'+Math.round(q.z*128)+':'+Math.round(q.w*128)+':'
      +Math.round(camera.position.y/32)+':'+Math.round(p[0]*64)+':'+Math.round(p[5]*64)+':'+this.terrainMin+':'+this.terrainMax;
  }
  chunk(cx:number,cy:number,margin=0,offsetX=0,offsetY=0){
    const left=cx*CHUNK_SIZE-offsetX,top=cy*CHUNK_SIZE-offsetY;
    const dx=Math.max(left-this.x,0,this.x-left-CHUNK_SIZE),dy=Math.max(top-this.y,0,this.y-top-CHUNK_SIZE);
    if(dx*dx+dy*dy>(VIEW_DISTANCE+margin+128)**2)return false;
    // Include tall authored silhouettes whose feet can be below/outside view.
    return this.intersects(left-margin-128,top-margin-128,left+CHUNK_SIZE+margin+128,top+CHUNK_SIZE+margin+128,this.terrainMin-128,this.terrainMax+1800);
  }
  ground(left:number,top:number,right:number,bottom:number,baseMin=0,baseMax=baseMin){
    // GPU ground vertices are displaced after their instance matrix. A slab
    // fixed below 256 incorrectly rejected Elarion's 640-unit terrain.
    return this.intersects(left,top,right,bottom,this.terrainMin+baseMin-2,this.terrainMax+baseMax+2);
  }
  image(image:Phaser.GameObjects.Image|Phaser.GameObjects.Sprite){
    const w=Math.abs(image.displayWidth),h=Math.abs(image.displayHeight),key=image.texture.key;
    if(key.startsWith('chunk:')||key==='shared-ocean-chunk')
      return this.ground(image.x-image.originX*w,image.y-image.originY*h,image.x+(1-image.originX)*w,image.y+(1-image.originY)*h);
    // Also cover rotated ground art/bridges with a non-central origin.
    const house=(image.getData(PRESENTATION_HINT) as PresentationHint|undefined)?.house;
    const rise=(house?.riseScale??1)+(house?.floorLift??0);
    const radius=Math.max(w,h*rise)+128;
    return this.intersects(image.x-radius,image.y-radius,image.x+radius,image.y+radius,this.terrainMin-128,this.terrainMax+Math.max(256,h*rise+384));
  }
  private intersects(left:number,top:number,right:number,bottom:number,minHeight:number,maxHeight:number){
    this.box.min.set(left,minHeight,top);this.box.max.set(right,maxHeight,bottom);
    return this.frustum.intersectsBox(this.box);
  }
}
