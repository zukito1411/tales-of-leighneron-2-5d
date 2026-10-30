import {ART_BY_KEY,artFrameSize} from './art';
import {segmentTouchesRect} from './settlementGeometry';
import type {Vec2} from '../game/types';

// Existing straight timber crossing. One shared source survey drives artwork,
// road endpoints and walkability; legacy helper names remain for callers.
export const ROAD_BRIDGE_FRAME=0;
const region=ART_BY_KEY.bridges.regions![ROAD_BRIDGE_FRAME],anchor=ART_BY_KEY.bridges.groundPoints![ROAD_BRIDGE_FRAME];
const sourceFit=artFrameSize('bridges',ROAD_BRIDGE_FRAME).width/region[2];
const deck={left:90,right:393,back:196,front:261};
export const ROYAL_BRIDGE_RAILS=[[196,200],[257,261]] as const;
export const ROYAL_BRIDGE_WALK_INSET=10;
export const ROYAL_BRIDGE_RAIL_MARGIN=2.6,ROYAL_BRIDGE_END_MARGIN=4.2;
export function stoneBridgeScale(waterSpan:number,minimumClearWidth=0){
  return Math.max(3.3,(waterSpan+96)/((deck.right-deck.left)*sourceFit),minimumClearWidth/((deck.front-deck.back-ROYAL_BRIDGE_WALK_INSET*2)*sourceFit));
}
export function stoneBridgeApproachSpan(scale:number){
  return Math.max(anchor[0]-deck.left,deck.right-anchor[0])*sourceFit*scale+32;
}
export function stoneBridgePath(cx:number,cy:number,scale:number){
  const fit=sourceFit*scale;
  return [deck.left,anchor[0],deck.right].map(x=>({x:cx+(x-anchor[0])*fit,y:cy}));
}
export function onStoneBridgeDeck(x:number,y:number,cx:number,cy:number,scale=3.3,heading=0,inset=4){
  const c=Math.cos(heading),s=Math.sin(heading),dx=x-cx,dy=y-cy;
  const fit=sourceFit*scale,px=(dx*c+dy*s)/fit+anchor[0],py=(-dx*s+dy*c)/fit+anchor[1];
  return px>=deck.left&&px<=deck.right&&py>=deck.back+inset&&py<=deck.front-inset;
}

/** The rendered royal balustrades, including their pier caps, leave the same
 * wide central lane in both loaded physics and unloaded placement checks. */
export function royalBridgeRailBlocksPath(from:Vec2,to:Vec2,cx:number,cy:number,scale:number,heading=0,radius=0){
  const fit=sourceFit*scale,c=Math.cos(heading),s=Math.sin(heading);
  const local=(p:Vec2)=>({x:((p.x-cx)*c+(p.y-cy)*s)/fit+anchor[0],y:(-(p.x-cx)*s+(p.y-cy)*c)/fit+anchor[1]});
  const a=local(from),b=local(to),pad=radius/fit;
  return ROYAL_BRIDGE_RAILS.some(([back,front])=>segmentTouchesRect(a,b,{left:deck.left-ROYAL_BRIDGE_END_MARGIN-pad,right:deck.right+ROYAL_BRIDGE_END_MARGIN+pad,
    top:back-ROYAL_BRIDGE_RAIL_MARGIN-pad,bottom:front+ROYAL_BRIDGE_RAIL_MARGIN+pad}));
}
