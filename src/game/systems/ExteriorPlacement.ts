import type {ContentDefinition,Vec2} from '../types';
import {StaticBoundsIndex} from './StaticBoundsIndex';
import {architectureProfile} from '../../data/architecture';
import {propFoundation,propPlacementBounds,spriteBounds,overlaps,type Rect} from '../../data/settlementGeometry';
import {worldSpriteProfile} from '../../data/worldSpriteGeometry';
import {fortificationBlocksPoint} from '../../data/fortifications';

/** Immutable geometry from *all* authored outdoor scenery. Unlike Arcade bodies
 * it is valid before chunks load, and never changes when the camera turns.
 * Structures with genuine gate/opening geometry keep their public passage;
 * wall curtains are covered by the dedicated exact fortification collision. */
interface Obstacle {id:string; bounds:Rect; solids:Rect[]; front?:Rect; footY:number}
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
      const wall=('wallSegment' in d&&d.wallSegment)?d.wallSegment:undefined;
      // These are intentional passage openings, not solid rectangles. The
      // exact curtain/wall line blocker still protects their supporting runs.
      if(architecture?.opening?.length||architecture?.curtain)continue;
      let solids:Rect[];
      if(wall)solids=[propPlacementBounds(texture,d.frame,scale,d.world.x,d.world.y,false,wall)];
      else if(architecture&&!architecture.board)solids=[propPlacementBounds(texture,d.frame,scale,d.world.x,d.world.y,d.anchor==='center')];
      else if(profile?.solids.length)solids=profile.solids.map(points=>({
        left:source.left+Math.min(...points.map(p=>p[0]))*(source.right-source.left),
        right:source.left+Math.max(...points.map(p=>p[0]))*(source.right-source.left),
        top:source.top+Math.min(...points.map(p=>p[1]))*(source.bottom-source.top),
        bottom:source.top+Math.max(...points.map(p=>p[1]))*(source.bottom-source.top),
      }));
      else{
        const size='footprint' in d&&d.footprint?d.footprint:propFoundation(texture,d.frame,scale);
        solids=[{left:d.world.x-size.width/2,right:d.world.x+size.width/2,
          top:source.bottom-size.height,bottom:source.bottom}];
      }
      const front=architecture&&!architecture.board?source:undefined;
      const bounds=solids.reduce((a,b)=>union(a,b),front??solids[0]);
      entries.push({id:d.id,bounds,solids,front,footY:d.world.y});
    }
    this.index=new StaticBoundsIndex(entries);
  }
  /** Full character silhouette clearance, including structures not yet
   * streamed. No per-frame iteration over the world's authored content. */
  blocksNpc(p:Vec2,excludeId?:string){
    if(fortificationBlocksPoint(p.x,p.y,30))return true;
    const feet={left:p.x-24,right:p.x+24,top:p.y-28,bottom:p.y+8};
    const person={left:p.x-30,right:p.x+30,top:p.y-96,bottom:p.y+8};
    return this.index.query(person).some(o=>o.id!==excludeId&&(
      o.solids.some(s=>overlaps(feet,s))||
      Boolean(o.front&&o.footY>p.y&&overlaps(person,o.front!))));
  }
  /** Quest items need reachable space around the object, not only a free
   * anchor pixel. Skip the object's own authored collider when relocating it. */
  blocksQuestItem(p:Vec2,excludeId:string){
    if(fortificationBlocksPoint(p.x,p.y,34))return true;
    const item={left:p.x-23,right:p.x+23,top:p.y-43,bottom:p.y+12};
    return this.index.query(item).some(o=>o.id!==excludeId&&(
      o.solids.some(s=>overlaps(item,s))||
      Boolean(o.front&&o.footY>p.y&&overlaps(item,o.front!))));
  }
}
