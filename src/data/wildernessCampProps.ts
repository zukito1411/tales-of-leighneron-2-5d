import {artFrameSize} from './art';
import type {PropContentDefinition,Vec2,WorldPropTexture} from '../game/types';
export const CAMP_OCCUPANT_STATIONS=[{x:-110,y:15},{x:110,y:15},{x:0,y:300}] as const;
export const wildernessCampProps=(id:string,p:Vec2):PropContentDefinition[]=>{
  const items:readonly [string,WorldPropTexture,number,number,number,number][]=[
   ['tent-left','native_quest_landmarks',2,180,-185,-155],['tent-right','native_quest_landmarks',2,164,185,-155],
   ['fire','world_assets',6,66,0,110],['supplies','native_civic_bare',9,62,-245,145],
   ['barrels','native_civic_bare',8,58,245,145],['bench-left','native_civic_bare',7,95,-125,200],['bench-right','native_civic_bare',7,95,125,200],
  ];
  return items.map(([name,texture,frame,width,x,y])=>({id:id+':'+name,kind:'prop',texture,frame,scale:width/artFrameSize(texture,frame).width,world:{x:p.x+x,y:p.y+y},solid:true,placement:'fixed'}));
 };
