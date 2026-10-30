import type {ArtTextureKey} from './art';
import {worldSpriteProfile,polygonGroundBands,type GroundPoint} from './worldSpriteGeometry';
import type {FurnitureArt} from '../game/presentation25d/FurnitureGeometry';
import type {Rect} from './settlementGeometry';

const civic:Readonly<Record<number,FurnitureArt>>={0:'lampPost',1:'lampPost',2:'lampPost',3:'brazier',4:'sign',5:'stall',6:'well',7:'bench',8:'barrels',9:'cargo',10:'fountain',12:'banner',13:'brazier'};
const story:Readonly<Record<number,FurnitureArt>>={0:'lectern',1:'satchel',2:'ledger',3:'lantern',4:'wagon',5:'dummy',6:'pump',7:'keepsake',8:'keepsake',9:'keepsake',10:'chest',11:'waystone'};
const depths:Partial<Record<FurnitureArt,number>>={table:.60,chair:.50,planter:.55,weaponRack:.30,well:.88,fountain:.42,barrels:.76,cargo:.62,crate:.62,chest:.58,
  stall:.72,tent:.80,wagon:.68,bench:.38,rock:.58,columns:.56,crystals:.55,waystone:.38,shrine:.45,sack:.50,brazier:.44,satchel:.40,ledger:.62};
const kinds:Partial<Record<ArtTextureKey,Readonly<Record<number,FurnitureArt>>>>={
  others:civic,native_civic_bare:civic,native_story_bare:story,native_story_props:story,
  world_assets:{2:'rock',3:'fence',5:'sign',6:'brazier',7:'cargo'},
  desert_props:{4:'rock',5:'rock',6:'wagon',7:'sign',8:'cargo',9:'tent',11:'arch'},
  woodland_props:{8:'rock',9:'rock',11:'sign'},
  climate_props:{2:'crystals',3:'rock',4:'fence',5:'brazier',6:'crystals',7:'columns',8:'rock',9:'brazier',10:'shrine'},
  flower_fence:{0:'fence',1:'fence',2:'fence',3:'fence'},
  native_quest_landmarks:{0:'well',1:'brazier',2:'tent',3:'waystone',4:'sealed-gate',5:'sack'},
};
export function worldPropKind(texture:ArtTextureKey,index:number):FurnitureArt|undefined {
  return texture==='elarion_tree'?'life-tree':kinds[texture]?.[index];
}

/** The same source-relative foot anchor and model depth drive prepared models,
 * authoring clearance and unloaded physical queries. No artwork is decoded. */
export function worldPropGroundPlan(texture:ArtTextureKey,index:number,w:number,h:number,override?:FurnitureArt){
  const art=override??worldPropKind(texture,index);if(!art||art==='life-tree')return;
  const polygons=worldSpriteProfile(texture,index)?.solids??[];
  let l=.08,r=.92,t=.70,bottom=.97;
  if(polygons.length){l=Infinity;r=-Infinity;t=Infinity;bottom=-Infinity;
    for(const polygon of polygons)for(const [x,y] of polygon){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);bottom=Math.max(bottom,y);}}
  const vertical=texture==='flower_fence'&&index>0;
  const modelScale=vertical?(bottom-t)*h/w:1;
  const localX=vertical?l:(l+r)/2,localY=vertical?(t+bottom)/2:bottom;
  const depth=vertical?(r-l)*w/(w*modelScale):Math.max(depths[art]??.10,(bottom-t)*h/w);
  return {art,l,r,t,bottom,vertical,modelScale,localX,localY,depth};
}

export function propPassageFootprints(art:FurnitureArt,depth:number):ReadonlyArray<readonly [number,number,number,number]> {
  if(art==='arch'||art==='doorway'||art==='tower-door-open')return [[-.48,-.30,-depth,0],[.30,.48,-depth,0]];
  if(art==='fence')return [[-.48,.48,-depth*.7,-depth*.3]];
  if(art==='stairs')return [[-.48,-.43,-depth,0],[.43,.48,-depth,0]];
  return [];
}

/** Structural bodies only: tall lamp paint must never become a tall invisible
 * ground rectangle, and arches/fences keep their modeled open spaces. */
export function worldPropBodies(texture:ArtTextureKey,index:number,source:Rect,anchor:{x:number;y:number},rotation=0,bands=true):Rect[]{
  const w=source.right-source.left,h=source.bottom-source.top;
  const plan=worldPropGroundPlan(texture,index,w,h);if(!plan)return [];
  const {art,modelScale,depth}=plan;
  if(['keepsake','banner'].includes(art))return [];
  const originX=anchor.x,originY=anchor.y;
  const actorCos=Math.cos(rotation),actorSin=Math.sin(rotation);
  const dx=source.left+plan.localX*w-originX,dy=source.top+plan.localY*h-originY;
  const x=originX+dx*actorCos-dy*actorSin,y=originY+dx*actorSin+dy*actorCos;
  const width=w*modelScale,heading=rotation+(plan.vertical?Math.PI/2:0),c=Math.cos(heading),s=Math.sin(heading);
  const parts=art==='arch'||art==='fence'?propPassageFootprints(art,depth):[[-.46,.46,-depth,-.01] as const];
  const result:Rect[]=[];
  for(const [left,right,back,front] of parts){
    if(!bands){
      const dx=(left+right)*width/2,dy=(back+front)*width/2,cx=x+dx*c-dy*s,cy=y+dx*s+dy*c;
      const hx=(Math.abs(c)*(right-left)+Math.abs(s)*(front-back))*width/2;
      const hy=(Math.abs(s)*(right-left)+Math.abs(c)*(front-back))*width/2;
      result.push({left:cx-hx,right:cx+hx,top:cy-hy,bottom:cy+hy});continue;
    }
    const polygon:GroundPoint[]=[[left,back],[right,back],[right,front],[left,front]].map(([u,v])=>
      [x+(u*c-v*s)*width,y+(u*s+v*c)*width] as GroundPoint);
    result.push(...polygonGroundBands(polygon));
  }
  return result;
}
