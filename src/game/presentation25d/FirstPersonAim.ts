import type Phaser from 'phaser';
import {Vector3} from 'three';
import {presentationView,worldHeight} from './plane';

export const FIRST_PERSON_DAMAGE_EVENT='first-person-damage';
export interface FirstPersonInteraction {label:string;score:number;activate:()=>void}
const center=new Vector3(),bottom=new Vector3(),top=new Vector3(),edge=new Vector3();

/** A small, forgiving screen-space target around the authored contact point.
 * CPU projection only; no framebuffer reads, world traversal or image scans.
 * Callers retain their own immediate proximity and obstruction checks. */
export function firstPersonAimScore(scene:Phaser.Scene,x:number,y:number,height=80,halfWidth=28,base=0){
  const view=presentationView(scene);if(!view?.firstPerson)return Infinity;
  const ground=worldHeight(scene,x,y),camera=view.camera;
  center.set(x,ground+base+height/2,y).project(camera);
  if(center.z<-1||center.z>1)return Infinity;
  edge.set(x+Math.cos(view.yaw)*halfWidth,ground+base+height/2,y-Math.sin(view.yaw)*halfWidth).project(camera);
  const pad=.018,halfX=Math.max(.012,Math.abs(edge.x-center.x))+pad;
  if(Math.abs(center.x)>halfX)return Infinity;
  bottom.set(x,ground+base,y).project(camera);top.set(x,ground+base+height,y).project(camera);
  const low=Math.min(bottom.y,top.y)-pad,high=Math.max(bottom.y,top.y)+pad;
  if(low>0||high<0)return Infinity;
  return Math.abs(center.x)/halfX+Math.abs(center.y)/Math.max(.025,(high-low)/2)*.35;
}
