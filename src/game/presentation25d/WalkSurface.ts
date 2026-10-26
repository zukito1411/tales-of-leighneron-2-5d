import {onHighmereBridge,onWildernessBridge} from '../../data/rivers';
import {onPortDeck} from '../../data/ports';
import {onFlagshipBoarding} from '../../data/pirateFlagship';

export const BRIDGE_DECK_HEIGHT=8;
export const SHIP_DECK_HEIGHT=0;
export const STAIR_STEPS=5,STAIR_HALF_WIDTH=.43;
const MAX_STEP_HEIGHT=32,MAX_WALK_SLOPE=1.5;
type Point=Readonly<{x:number;y:number}>;
type Height=(x:number,y:number)=>number;
export interface StairWalkSurface {x:number;y:number;width:number;depth:number;rise:number;heading:number;lift:number}
/** Exact tread tops, using the same normalized survey as the stair mesh. */
export function stairSurfaceHeight(surface:StairWalkSurface,x:number,y:number):number|undefined {
  const c=Math.cos(surface.heading),s=Math.sin(surface.heading),dx=x-surface.x,dy=y-surface.y;
  const right=(dx*c+dy*s)/surface.width,back=(-dx*s+dy*c)/surface.width;
  if(Math.abs(right)>STAIR_HALF_WIDTH||back>=0||back< -surface.depth)return undefined;
  return surface.lift+surface.rise*surface.width*Math.min(STAIR_STEPS,Math.floor(-back/surface.depth*STAIR_STEPS)+1)/STAIR_STEPS;
}
/** Reject abrupt upward cliffs throughout a swept movement, including dash
 * endpoints. Downward edges remain available to the vertical falling solver. */
export function surfacePathWalkable(height:Height,from:Point,to:Point){
  const distance=Math.hypot(to.x-from.x,to.y-from.y);if(distance<.001)return true;
  const steps=Math.max(1,Math.ceil(distance/24)),span=distance/steps;
  let previous=height(from.x,from.y);
  for(let i=1;i<=steps;i++){
    const next=height(from.x+(to.x-from.x)*i/steps,from.y+(to.y-from.y)*i/steps);
    if(next-previous>MAX_STEP_HEIGHT+span*MAX_WALK_SLOPE)return false;
    previous=next;
  }
  return true;
}
/** Preserve travel speed along the actual 3D slope rather than its XY shadow. */
export function surfaceSpeedScale(height:Height,x:number,y:number,dx:number,dy:number){
  const amount=Math.hypot(dx,dy);if(amount<.001)return 1;
  const run=24,rise=height(x+dx/amount*run,y+dy/amount*run)-height(x,y);
  return Math.max(.45,1/Math.hypot(1,rise/run));
}
/** Exact authored XY footprints, independent of the coarse terrain height grid.
 * Shared by rendering, navigation and grounded movement. */
export function walkSurfaceHeight(x:number,y:number):number|undefined {
  if(onFlagshipBoarding(x,y))return SHIP_DECK_HEIGHT;
  if(onPortDeck(x,y)||onHighmereBridge(x,y)||onWildernessBridge(x,y))return BRIDGE_DECK_HEIGHT;
  return undefined;
}
