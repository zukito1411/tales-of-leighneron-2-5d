import type Phaser from 'phaser';
import {actorAimDirection,type ActorDirection} from '../../data/directionalEnemyArt';
import {viewDirection} from '../presentation25d/plane';
const facing={x:0,y:0};
export function actorViewAim(scene:Phaser.Scene,x:number,y:number,previous:ActorDirection):ActorDirection {
  viewDirection(scene,x,y,facing);return actorAimDirection(facing.x,facing.y,previous);
}
export function actorViewTravel(scene:Phaser.Scene,x:number,y:number,previous:ActorDirection):ActorDirection {
  return Math.hypot(x,y)<3?previous:actorViewAim(scene,x,y,previous);
}
/** Side-only attack art mirrors in camera space, while its aim stays in world space. */
export function actorViewFlip(scene:Phaser.Scene,x:number,y:number,previous:boolean):boolean {
  viewDirection(scene,x,y,facing);
  return Math.abs(facing.x)<1e-6?previous:facing.x<0;
}
