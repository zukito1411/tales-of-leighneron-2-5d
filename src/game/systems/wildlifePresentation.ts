import type Phaser from 'phaser';
import {viewDirection,worldPointInView} from '../presentation25d/plane';
import type {Vec2} from '../types';

const direction={x:0,y:0};

/** Select existing side/front/rear artwork without changing world travel. */
export function wildlifeFacing(scene:Phaser.Scene,heading:Vec2,out:{row:number;flip:boolean}){
  viewDirection(scene,heading.x,heading.y,direction);
  out.row=Math.abs(direction.x)>Math.abs(direction.y)*.8?0:direction.y>0?1:2;
  out.flip=out.row===0&&direction.x<0;
}

/** A flying/perched actor's painted Y is not its ground coordinate. Use its
 * actual height and perspective frustum, including the behind-camera check. */
export function wildlifeInView(scene:Phaser.Scene,ground:Vec2,altitude:number,margin:number){
  return worldPointInView(scene,ground.x,ground.y,altitude,margin);
}
