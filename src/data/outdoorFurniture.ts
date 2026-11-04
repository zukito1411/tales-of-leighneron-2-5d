import {capitalPropStyle} from './highmereStreetStyle';
import {diningFurniture} from './interiorFurnitureLayout';
import type {Rect} from './settlementGeometry';

export function outdoorFitting(id:string){
 const style=capitalPropStyle(id);
 if(style==='cafe-table')return {art:'table' as const,depth:.5};
 if(style==='cafe-chair')return {art:'chair' as const,depth:.5};
 if(style==='laundry-line')return {art:'banner' as const,depth:.10};
 if(style==='flower-pot')return {art:'planter' as const,depth:.55};
 if(style==='hay-bales')return {art:'cargo' as const,depth:.62};
}
/** Source atlas paint supplies materials only. Authored widths and front-foot
 * anchors are identical to indoor dining furniture, independent of cargo art. */
export function outdoorFittingBounds(id:string,x:number,y:number,width:number,rotation=0,physical=false):Rect|undefined{
 const fitting=outdoorFitting(id);if(!fitting)return;
 const half=width*(physical?.46:.5);
 const c=Math.cos(rotation),s=Math.sin(rotation),back=-width*fitting.depth,front=physical?-width*.01:0;
 const cx=x-(back+front)/2*s,cy=y+(back+front)/2*c;
 const hx=Math.abs(c)*half+Math.abs(s)*(front-back)/2,hy=Math.abs(s)*half+Math.abs(c)*(front-back)/2;
 return {left:cx-hx,right:cx+hx,top:cy-hy,bottom:cy+hy};
}
export function outdoorDiningLayout(x:number,y:number,width=144){
 return diningFurniture(x,y,width,58).map(o=>({art:o.art,x:o.x,y:o.y,width:o.width,rotation:(o.rotation??0)*Math.PI/180}));
}

/** Laundry hangs overhead; only its two timber posts occupy the ground. */
export function outdoorFittingBodies(id:string,x:number,y:number,width:number,rotation=0):Rect[]{
 if(capitalPropStyle(id)!=='laundry-line'){
  const r=outdoorFittingBounds(id,x,y,width,rotation,true);return r?[r]:[];
 }
 const c=Math.cos(rotation),s=Math.sin(rotation),half=width*.018*(Math.abs(c)+Math.abs(s));
 return [-.47,.47].map(u=>{const cx=x+(u*c+.05*s)*width,cy=y+(u*s-.05*c)*width;
  return {left:cx-half,right:cx+half,top:cy-half,bottom:cy+half};});
}
