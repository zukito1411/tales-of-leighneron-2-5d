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
