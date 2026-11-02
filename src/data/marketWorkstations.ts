import {spriteBounds} from './settlementGeometry';
import {worldPropGroundPlan} from './worldPropGroundPlan';
import type {PropContentDefinition,Vec2} from '../game/types';

/** Use the same foot origin, depth and floor heading as the rendered stall. */
export function marketWorkstation(stall:PropContentDefinition){
 const texture=stall.texture??'world_objects',r=spriteBounds(texture,stall.frame,stall.scale,stall.world.x,stall.world.y,stall.anchor==='center');
 const w=r.right-r.left,h=r.bottom-r.top,plan=worldPropGroundPlan(texture,stall.frame,w,h);
 if(plan?.art!=='stall')return;
 const a=stall.rotation??0,c=Math.cos(a),s=Math.sin(a);
 const fx=r.left+plan.localX*w-stall.world.x,fy=r.top+plan.localY*h-stall.world.y;
 const point=(x:number,z:number):Vec2=>({x:stall.world.x+(fx+x*w)*c-(fy+z*w)*s,y:stall.world.y+(fx+x*w)*s+(fy+z*w)*c});
 return {approach:point(0,.12),stations:[0,-.15,.15].map(x=>point(x,-plan.depth*.86))
   .concat([0,-.15,.15].map(x=>point(x,-plan.depth-36/w)))};
}
