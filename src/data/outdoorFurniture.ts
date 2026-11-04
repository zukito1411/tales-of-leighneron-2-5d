import {TOWN_SHRINE_CONTENT_IDS,TELEPORT_SHRINE} from './townShrines';
import {polygonGroundBands} from './worldSpriteGeometry';
import {elarionCascade} from './elarionHighlands';
import {capitalPropStyle} from './highmereStreetStyle';
import {diningFurniture} from './interiorFurnitureLayout';
import type {Rect} from './settlementGeometry';

export function outdoorFitting(id:string){
 if(TOWN_SHRINE_CONTENT_IDS.has(id))return {art:'goddess-shrine' as const,depth:TELEPORT_SHRINE.depth};
 const style=capitalPropStyle(id);
 if(style==='pasture-fence')return {art:'fence' as const,depth:.06};
 if(style==='pasture-straw')return {art:'crate' as const,depth:.7};
 if(style==='pasture-trough')return {art:'barrel' as const,depth:.85};
 if(style==='windmill')return {art:'windmill' as const,depth:1};
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
 if(physical&&fitting.art==='windmill'){
  // The stone tower occupies the ground; the overhead sail sweep is reserved
  // by scenery placement, never converted into an invisible ground block.
  const c=Math.cos(rotation),s=Math.sin(rotation),cy=-width*fitting.depth/2;
  const cx=x-cy*s,cz=y+cy*c,r=width*.335;
  return {left:cx-r,right:cx+r,top:cz-r,bottom:cz+r};
 }
 if(!physical&&fitting.art==='windmill'){
  const c=Math.cos(rotation),s=Math.sin(rotation),back=-width*1.03,front=width*.04;
  const cx=x-(back+front)*s/2,cy=y+(back+front)*c/2;
  const hx=Math.abs(c)*width*.96+Math.abs(s)*(front-back)/2,hy=Math.abs(s)*width*.96+Math.abs(c)*(front-back)/2;
  return {left:cx-hx,right:cx+hx,top:cy-hy,bottom:cy+hy};
 }
 const fence=capitalPropStyle(id)==='pasture-fence';
 const half=width*(physical?fitting.art==='goddess-shrine'?.49:fence?.48:.46:.5);
 const c=Math.cos(rotation),s=Math.sin(rotation),back=-width*fitting.depth*(physical&&fence?.7:1),front=physical?fence?-width*fitting.depth*.3:-width*.01:0;
 const cx=x-(back+front)/2*s,cy=y+(back+front)/2*c;
 const hx=Math.abs(c)*half+Math.abs(s)*(front-back)/2,hy=Math.abs(s)*half+Math.abs(c)*(front-back)/2;
 return {left:cx-hx,right:cx+hx,top:cy-hy,bottom:cy+hy};
}
export function outdoorDiningLayout(x:number,y:number,width=144){
 return diningFurniture(x,y,width,58).map(o=>({art:o.art,x:o.x,y:o.y,width:o.width,rotation:(o.rotation??0)*Math.PI/180}));
}

/** Laundry hangs overhead; only its two timber posts occupy the ground. */
export function outdoorFittingBodies(id:string,x:number,y:number,width:number,rotation=0):Rect[]{
 if(capitalPropStyle(id)==='windmill'){
  const cx=x+Math.sin(rotation)*width/2,cy=y-Math.cos(rotation)*width/2,r=width*.33;
  return polygonGroundBands(Array.from({length:16},(_,i)=>{const a=i*Math.PI/8;return [cx+Math.cos(a)*r,cy+Math.sin(a)*r] as const;}));
 }
 if(capitalPropStyle(id)!=='laundry-line'){
  const r=outdoorFittingBounds(id,x,y,width,rotation,true);return r?[r]:[];
 }
 const c=Math.cos(rotation),s=Math.sin(rotation),half=width*.018*(Math.abs(c)+Math.abs(s));
 return [-.47,.47].map(u=>{const cx=x+(u*c+.05*s)*width,cy=y+(u*s-.05*c)*width;
  return {left:cx-half,right:cx+half,top:cy-half,bottom:cy+half};});
}

/** Complete modeled extents drive stream admission and scenery clearance.
 * The source cargo/fountain paintings supply materials, not model envelopes. */
export function outdoorSceneryBounds(id:string,x:number,y:number,width:number,rotation=0):Rect|undefined{
 const cascade=elarionCascade(id);
 if(cascade)return {left:x-cascade.width*.65,right:x+cascade.width*.65,top:y-cascade.run-32,bottom:y+32};
 const bounds=outdoorFittingBounds(id,x,y,width,rotation);if(!bounds)return;
 if(capitalPropStyle(id)==='windmill'){
  // Sails occupy a vertical plane. Reserve both their full lateral reach and
  // the elevated silhouette when selecting neighboring content chunks.
  return {left:x-width*.96,right:x+width*.96,top:y-width*2.6,bottom:y+width*.16};
 }
 return bounds;
}
