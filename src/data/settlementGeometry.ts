import { artFrameSize, type ArtTextureKey } from './art';
import {architectureProfile} from './architecture';
import type { Vec2 } from '../game/types';
import {isTreeArt,treeFootprint} from './treeArt';
import {worldPropBodies} from './worldPropGroundPlan';

export interface Rect { left:number; top:number; right:number; bottom:number }
export function overlaps(a:Rect,b:Rect,gap = 0) {
  return a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;
}
export function spriteBounds(texture:ArtTextureKey,frame:number,scale:number,x:number,y:number,center = false):Rect {
  const size = artFrameSize(texture,frame), width = size.width * scale, height = size.height * scale;
  const bottom = center ? y + height / 2 : y - 2 * scale;
  const architecture=architectureProfile(texture,frame);
  // A wide model can extend farther north than its original painted facade.
  // Reserve that ground volume in the same planners that protect roads/NPCs.
  const depth=architecture&&!architecture.board&&!architecture.curtain
    ?width*(architecture.tiers?Math.max(...architecture.tiers.map(t=>t.right-t.left),architecture.hip?architecture.hip.right-architecture.hip.left:0):architecture.depth):0;
  return {left:x-width/2,right:x+width/2,top:Math.min(bottom-height,y-depth),bottom};
}
/** Placement uses a modeled building's ground plan. Painted facade height
 * remains available through spriteBounds for streaming and screen coverage. */
export function propPlacementBounds(texture:ArtTextureKey,frame:number,scale:number,x:number,y:number,center=false,segment?:{dx:number;dy:number;thickness?:number},rotation=0):Rect {
  if(segment){
    const pad=(segment.thickness??32)/2;
    return {left:x-Math.abs(segment.dx)/2-pad,right:x+Math.abs(segment.dx)/2+pad,top:y-Math.abs(segment.dy)/2-pad,bottom:y+Math.abs(segment.dy)/2+pad};
  }
  const bounds=spriteBounds(texture,frame,scale,x,y,center),profile=architectureProfile(texture,frame);
  if(!profile||profile.board||profile.curtain){
    const result=rotateRect(bounds,x,y,rotation);
    if(!profile)for(const body of worldPropBodies(texture,frame,bounds,{x,y},rotation,false)){
      result.left=Math.min(result.left,body.left);result.right=Math.max(result.right,body.right);
      result.top=Math.min(result.top,body.top);result.bottom=Math.max(result.bottom,body.bottom);
    }
    return result;
  }
  const width=artFrameSize(texture,frame).width*scale;
  const depth=profile.tiers?Math.max(...profile.tiers.map(t=>t.right-t.left),profile.hip?profile.hip.right-profile.hip.left:0):profile.depth;
  return rotateRect({...bounds,top:y-width*(depth+.035)},x,y,rotation);
}
/** Rotate an authored ground envelope around its actual world foot anchor. */
export function rotateRect(rect:Rect,x:number,y:number,angle:number):Rect {
  if(!angle)return {...rect};
  const c=Math.cos(angle),s=Math.sin(angle),dx=(rect.left+rect.right)/2-x,dy=(rect.top+rect.bottom)/2-y;
  const cx=x+dx*c-dy*s,cy=y+dx*s+dy*c;
  const hx=(Math.abs(c)*(rect.right-rect.left)+Math.abs(s)*(rect.bottom-rect.top))/2;
  const hy=(Math.abs(s)*(rect.right-rect.left)+Math.abs(c)*(rect.bottom-rect.top))/2;
  return {left:cx-hx,right:cx+hx,top:cy-hy,bottom:cy+hy};
}
function segmentTouchesBounds(a:Vec2,b:Vec2,left:number,top:number,right:number,bottom:number){
  let lo=0,hi=1;
  for(let axis=0;axis<2;axis++){
    const start=axis===0?a.x:a.y,delta=axis===0?b.x-a.x:b.y-a.y;
    const min=axis===0?left:top,max=axis===0?right:bottom;
    if(Math.abs(delta)<.000001){if(start<min||start>max)return false;continue;}
    const t0=(min-start)/delta,t1=(max-start)/delta;
    lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));
    if(lo>hi)return false;
  }
  return true;
}
export function segmentTouchesRect(a:Vec2,b:Vec2,r:Rect){return segmentTouchesBounds(a,b,r.left,r.top,r.right,r.bottom);}
export function rectTouchesStreet(r:Rect,s:{width:number;points:readonly Vec2[]},gap=0){
  const pad=s.width/2+gap;
  for(let i=1;i<s.points.length;i++)if(segmentTouchesBounds(s.points[i-1],s.points[i],r.left-pad,r.top-pad,r.right+pad,r.bottom+pad))return true;
  return false;
}
export function propFoundation(texture:ArtTextureKey,frame:number,scale:number) {
  const size = artFrameSize(texture,frame);
  if (isTreeArt(texture,frame)) return treeFootprint(texture,frame,scale);
  return { width:size.width * scale * .72,height:Math.min(56,size.height * scale * .25) };
}
export const retiredBoundaryId = (id:string) => /^settlement:(wall|gate|gate-tower):/.test(id);
