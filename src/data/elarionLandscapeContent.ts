import {ELARION_CASCADES} from './elarionHighlands';
import {artFrameSize} from './art';
import {propPlacementBounds,overlaps,type Rect} from './settlementGeometry';
import {worldRectTouchesStreet} from './settlements';
import type {ContentDefinition} from '../game/types';

/** Optional landscape never displaces existing authored buildings/quest sites.
 * This runs once, after the final NPC and service survey has been admitted. */
export function addElarionLandscape(content:ContentDefinition[],walkable:(x:number,y:number)=>boolean){
 for(const p of ELARION_CASCADES){
  if(content.some(d=>d.id===p.id))continue;
  const r:Rect={left:p.x-p.width/2-64,right:p.x+p.width/2+64,top:p.y-p.run-96,bottom:p.y+96};
  if(worldRectTouchesStreet(r,160))continue;
  if(content.some(d=>{
   const bounds='frame' in d?propPlacementBounds(d.texture??'world_objects',d.frame,d.scale??.6,d.world.x,d.world.y,d.anchor==='center',undefined,d.rotation??0)
    :{left:d.world.x-180,right:d.world.x+180,top:d.world.y-180,bottom:d.world.y+180};
   return overlaps(r,bounds,'description' in d?160:80);
  }))continue;
  let valid=true;
  for(let y=r.top;y<=r.bottom&&valid;y+=64)for(const x of [r.left,p.x,r.right])if(!walkable(x,y)){valid=false;break;}
  if(!valid)continue;
  content.push({id:p.id,kind:'prop',world:{x:p.x,y:p.y},texture:'native_civic_bare',frame:10,
   scale:p.width/artFrameSize('native_civic_bare',10).width,solid:false,placement:'fixed',label:'Whitebough Spring Cascade'});
 }
}
