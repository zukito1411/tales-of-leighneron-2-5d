import type {ContentDefinition,Vec2} from '../types';
import {highmereBridgeRailsBlock} from '../../data/rivers';
import {StaticBoundsIndex} from './StaticBoundsIndex';
import {architectureProfile,architecturePassageFootprints} from '../../data/architecture';
import {artFrameSize,ART_BY_KEY} from '../../data/art';
import {propFoundation,spriteBounds,rotateRect,overlaps,type Rect} from '../../data/settlementGeometry';
import {worldSpriteProfile,polygonGroundBands,type GroundPoint} from '../../data/worldSpriteGeometry';
import {worldPropBodies,worldPropKind} from '../../data/worldPropGroundPlan';
import {fortificationBlocksPoint,fortificationBlocksPath} from '../../data/fortifications';
import {segmentTouchesRect} from '../../data/settlementGeometry';

/** Immutable geometry from *all* authored outdoor scenery. Unlike Arcade bodies
 * it is valid before chunks load, and never changes when the camera turns.
 * Structures with genuine gate/opening geometry keep their public passage;
 * wall curtains are covered by the dedicated exact fortification collision. */
interface Obstacle {id:string; bounds:Rect; solids:Rect[]; front?:Rect; cover?:Rect; rest?:Rect; footY:number}
const union=(a:Rect,b:Rect):Rect=>({
  left:Math.min(a.left,b.left),right:Math.max(a.right,b.right),
  top:Math.min(a.top,b.top),bottom:Math.max(a.bottom,b.bottom),
});
export class ExteriorPlacement {
  private readonly index:StaticBoundsIndex<Obstacle>;
  constructor(content:readonly ContentDefinition[]){
    const entries:Obstacle[]=[];
    for(const d of content){
      if(!('frame' in d))continue;
      const texture=d.texture??'world_objects',scale=d.scale??.6;
      const profile=worldSpriteProfile(texture,d.frame),architecture=architectureProfile(texture,d.frame);
      if(profile?.floor)continue;
      const solid=('solid' in d&&d.solid)||Boolean(profile?.forceSolid);
      if(!solid)continue;
      const source=spriteBounds(texture,d.frame,scale,d.world.x,d.world.y,d.anchor==='center');
      // Curved curtain walls are checked against their surveyed endpoints in
      // fortificationBlocksPoint(). A gate's opening must remain traversable,
      // but its physical left and right supports still block quest characters.
      if(architecture?.curtain)continue;
      let solids:Rect[]=[];
      const angle=d.rotation??0,c=Math.cos(angle),sn=Math.sin(angle);
      const rotated=(points:GroundPoint[])=>polygonGroundBands(points.map(([x,y])=>{
        const dx=x-d.world.x,dy=y-d.world.y;return [d.world.x+dx*c-dy*sn,d.world.y+dx*sn+dy*c] as GroundPoint;
      }));
      const rectangle=(r:Rect)=>angle?rotated([[r.left,r.top],[r.right,r.top],[r.right,r.bottom],[r.left,r.bottom]]):[r];
      if(architecture?.opening?.length){
        const regions=ART_BY_KEY[texture],src=regions.regions?.[d.frame],mark=regions.groundPoints?.[d.frame];
        const anchor=src&&mark?(mark[0]-src[0])/src[2]:.5,width=artFrameSize(texture,d.frame).width*scale;
        for(const part of architecturePassageFootprints(architecture)??[])solids.push(...rectangle({
          left:d.world.x+(part.left-anchor)*width,right:d.world.x+(part.right-anchor)*width,
          top:d.world.y+part.back*width,bottom:d.world.y+part.front*width,
        }));
      }else{
        // Keep the source contact contours as well as the modeled volume,
        // matching the bodies created when this same actor is streamed in.
        for(const polygon of profile?.solids??[])solids.push(...rotated(polygon.map(([x,y])=>
          [source.left+x*(source.right-source.left),source.top+y*(source.bottom-source.top)] as GroundPoint)));
        if(architecture&&!architecture.board){
          const width=artFrameSize(texture,d.frame).width*scale,tiers=architecture.tiers;
          const base=tiers?.reduce((a,b)=>b.bottom>a.bottom?b:a),l=base?.left??architecture.roof[0][0],r=base?.right??architecture.roof.at(-1)![0];
          const depth=width*(tiers?Math.max(...tiers.map(t=>t.right-t.left),architecture.hip?architecture.hip.right-architecture.hip.left:0):architecture.depth);
          if(tiers){const radius=(r-l)*width/2,cx=source.left+(l+r)*width/2;
            solids.push(...rotated(Array.from({length:16},(_,i)=>{const a=i/16*Math.PI*2;
              return [cx+Math.sin(a)*radius,d.world.y-depth/2+Math.cos(a)*radius] as GroundPoint;})));
          }else solids.push(...rectangle({left:source.left+l*width,right:source.left+r*width,top:d.world.y-depth,bottom:d.world.y-4}));
        }else if(!architecture)solids.push(...worldPropBodies(texture,d.frame,source,d.world,angle));
        if(!solids.length){
          const size='footprint' in d&&d.footprint?d.footprint:propFoundation(texture,d.frame,scale);
          solids.push(...rectangle({left:d.world.x-size.width/2,right:d.world.x+size.width/2,top:source.bottom-size.height,bottom:source.bottom}));
        }
      }
      if(!solids.length)continue;
      // Roof silhouettes matter for houses/towers; gates are pass-through
      // scenery, so their hanging arch must not close the actual aperture.
      const art=worldPropKind(texture,d.frame),painted=rotateRect(source,d.world.x,d.world.y,angle);
      const front=architecture&&!architecture.board&&!architecture.opening?.length
        ||Boolean(art&&['stall','well','tent','wagon','columns'].includes(art))?painted:undefined;
      const bounds=solids.reduce((a,b)=>union(a,b),front??solids[0]);
      entries.push({id:d.id,bounds:union(bounds,painted),solids,front,cover:front,
        rest:architecture?.opening?.length?solids.reduce(union):undefined,footY:d.world.y});
    }
    this.index=new StaticBoundsIndex(entries);
  }
  /** Full character silhouette clearance, including structures not yet
   * streamed. No per-frame iteration over the world's authored content. */
  blocksNpc(p:Vec2,excludeId?:string,standing=false){
    if(fortificationBlocksPoint(p.x,p.y,standing?44:30)||highmereBridgeRailsBlock(p,p,30))return true;
    const feet={left:p.x-24,right:p.x+24,top:p.y-28,bottom:p.y+8};
    const person={left:p.x-30,right:p.x+30,top:p.y-96,bottom:p.y+8};
    return this.index.any(person,o=>o.id!==excludeId&&(
      o.solids.some(s=>overlaps(feet,s))||
      Boolean(standing&&o.rest&&overlaps(person,o.rest))||
      Boolean(o.front&&o.footY>p.y&&overlaps(person,o.front!))));
  }
  /** Public access uses player-sized swept feet and physical supports only.
   * Standing exclusions must never seal an otherwise open gateway. */
  blocksAccessPath(from:Vec2,to:Vec2,excludeId?:string){
    if(fortificationBlocksPath(from,to,12)||highmereBridgeRailsBlock(from,to,12))return true;
    const bounds={left:Math.min(from.x,to.x)-11,right:Math.max(from.x,to.x)+11,
      top:Math.min(from.y,to.y)-24,bottom:Math.max(from.y,to.y)+2};
    return this.index.any(bounds,o=>o.id!==excludeId&&o.solids.some(s=>segmentTouchesRect(from,to,{
      left:s.left-11,right:s.right+11,top:s.top-2,bottom:s.bottom+24})));
  }
  /** Hostile feet use their real diameter, including bosses and alpha wolves.
   * Spawn clearance also excludes concealed positions under building artwork;
   * movement uses only solids so genuine arches stay traversable. */
  blocksEnemy(p:Vec2,radius:number,spawn=false){
    if(fortificationBlocksPoint(p.x,p.y,radius+3)||highmereBridgeRailsBlock(p,p,radius+3))return true;
    const feet={left:p.x-radius-2,right:p.x+radius+2,top:p.y-radius*2-2,bottom:p.y+2};
    const person={...feet,top:p.y-Math.max(96,radius*3)};
    return this.index.any(spawn?person:feet,o=>o.solids.some(s=>overlaps(feet,s))
      ||Boolean(spawn&&o.cover&&p.y<=o.footY+radius*2&&overlaps(person,o.cover)));
  }
  blocksEnemyPath(from:Vec2,to:Vec2,radius:number){
    if(fortificationBlocksPath(from,to,radius+3)||highmereBridgeRailsBlock(from,to,radius+3))return true;
    const bounds={left:Math.min(from.x,to.x)-radius-2,right:Math.max(from.x,to.x)+radius+2,
      top:Math.min(from.y,to.y)-radius*2-2,bottom:Math.max(from.y,to.y)+2};
    return this.index.any(bounds,o=>o.solids.some(s=>segmentTouchesRect(from,to,{
      left:s.left-radius-2,right:s.right+radius+2,top:s.top-2,bottom:s.bottom+radius*2+2})));
  }
  /** Quest items need reachable space around the object, not only a free
   * anchor pixel. Skip the object's own authored collider when relocating it. */
  blocksQuestItem(p:Vec2,excludeId:string,envelope?:Rect){
    if(fortificationBlocksPoint(p.x,p.y,34)||highmereBridgeRailsBlock(p,p,34))return true;
    const contact={left:p.x-23,right:p.x+23,top:p.y-43,bottom:p.y+12};
    const item=envelope?union(contact,envelope):contact;
    return this.index.any(item,o=>o.id!==excludeId&&(
      o.solids.some(s=>overlaps(item,s))||
      Boolean(o.rest&&overlaps(item,o.rest))||
      Boolean(o.front&&o.footY>p.y&&overlaps(item,o.front!))));
  }
}
