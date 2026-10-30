import {artFrameSize,type ArtTextureKey} from './art';
import type {ContentDefinition,Vec2,WorldPropTexture} from '../game/types';
import {WorldGenerator} from '../game/systems/WorldGenerator';
import {propFitsHabitat} from '../game/systems/propHabitat';
import {StaticBoundsIndex} from '../game/systems/StaticBoundsIndex';
import {bossArenaBounds} from '../game/systems/bossArenas';
import {propPlacementBounds,overlaps,type Rect} from './settlementGeometry';
import {worldSpriteProfile} from './worldSpriteGeometry';
import {isNativePropReplacement} from './nativePropReplacements';
import {insideDefense} from './settlementDefenses';
import {architectureProfile} from './architecture';
import {isTreeArt} from './treeArt';
import {NPCS} from './npcs';
import {npcExteriorAnchors,npcStandingReservation} from './npcPositions';
import {INTERIOR_ASSIGNMENTS} from './interiorAssignments';
import {SETTLEMENT_LAYOUTS,nearbySlots,worldRectTouchesStreet} from './settlements';
import {TOWN_BY_ID} from './towns';
import {CIVIC_BOARD_SITES,civicBoardReserve} from './settlementCivic';
import {fortificationBlocksPoint} from './fortifications';
import {CAPITAL_SHRINE_COURT} from './highmereComposition';
import {flagshipFootprint,onFlagshipDeck} from './pirateFlagship';

/** Kept visible to development tools; never hide an unfitted quest objective. */
export const AUTHORED_PROP_PLACEMENT_ISSUES:string[]=[];

export function fitAuthoredProps(content:ContentDefinition[]){
  AUTHORED_PROP_PLACEMENT_ISSUES.length=0;
  const world=new WorldGenerator(),changed=new Set<string>();
  // The common furniture's grass skirt is artwork, not a terrain tile. On bare
  // ground use a complete bare variant, fitting inside the old reserved envelope.
  for(const d of content){
    if(!('frame' in d))continue;
    const texture=d.texture??'world_objects',scale=d.scale??1;
    let next:WorldPropTexture|undefined,frame=d.frame;
    if(texture==='others'&&!propFitsHabitat(texture,frame,world,d.world.x,d.world.y,scale))next='native_civic_bare';
    if(texture==='world_assets'&&!propFitsHabitat(texture,frame,world,d.world.x,d.world.y,scale)){
      if(frame===5){next='native_civic_bare';frame=4;}
      if(frame===7){next='native_civic_bare';frame=9;}
      if(frame===6){next='native_civic_bare';frame=3;}
    }
    if(texture==='darkav_props'&&frame<=2){next='native_region_props';}
    if(!next)continue;
    const old=artFrameSize(texture,d.frame),size=artFrameSize(next,frame);
    d.texture=next;d.frame=frame;
    d.scale=Math.min(old.width*scale/size.width,old.height*scale/size.height);
    if(texture==='darkav_props')d.tint=0xffffff;
    // Only the newly substituted quests grow. Ordinary furniture keeps its
    // previously fitted dimensions and location.
  }
  const habitatProp=(texture:string,frame:number)=>['woodland_props','desert_props','climate_props','native_region_props','flora'].includes(texture)
    ||texture==='world_assets'&&frame<=2;
  const settlementFor=(p:Vec2)=>SETTLEMENT_LAYOUTS.find(layout=>insideDefense(layout.townId,p.x,p.y));
  const looseInSettlement=(d:ContentDefinition)=>{
    if(!('frame' in d)||d.placement==='fixed'||d.kind==='settlement-prop'||!settlementFor(d.world))return false;
    const texture=d.texture??'world_objects';
    if(architectureProfile(texture,d.frame)||worldSpriteProfile(texture,d.frame)?.floor||isTreeArt(texture,d.frame)
      ||d.id.startsWith('farm:')||d.id.startsWith('fort:')||d.id.startsWith('defense:')||d.id.startsWith('bridge:')
      ||d.id.startsWith('elarion:whitebough-fence:')||'townShrineId' in d||'portId' in d)return false;
    return d.kind==='prop'||'description' in d;
  };
  const priority=(d:ContentDefinition)=>Number(isNativePropReplacement(d.id))*2+Number('questTargetId' in d&&Boolean(d.questTargetId));
  const moving=content.filter(d=>d.placement!=='fixed'&&'frame' in d&&(isNativePropReplacement(d.id)||looseInSettlement(d)
    ||d.kind==='prop'&&habitatProp(d.texture??'',d.frame)
      &&!propFitsHabitat(d.texture??'world_objects',d.frame,world,d.world.x,d.world.y,d.scale??1)))
    .sort((a,b)=>priority(b)-priority(a));
  for(const d of moving)changed.add(d.id);
  const board=(d:ContentDefinition)=>'frame' in d&&(
    (d.texture==='others'||d.texture==='native_civic_bare')&&d.frame===11
    ||d.texture==='world_assets'&&d.frame===5);
  const civicReservations=Object.keys(CIVIC_BOARD_SITES).map(id=>{const r=civicBoardReserve(id)!,town=TOWN_BY_ID[id];
    return {bounds:{left:town.world.x+r.left,right:town.world.x+r.right,top:town.world.y+r.top,bottom:town.world.y+r.bottom}};});
  const indoor=new Set(INTERIOR_ASSIGNMENTS.map(([id])=>id));
  const people=NPCS.filter(n=>!indoor.has(n.id)).flatMap(n=>{const town=TOWN_BY_ID[n.townId];
    return npcExteriorAnchors(n).map(p=>({bounds:npcStandingReservation(p,town.world.x,town.world.y)}));});
  const shrineTown=TOWN_BY_ID.highmere.world;
  const shrineCourt={bounds:{left:shrineTown.x+CAPITAL_SHRINE_COURT.left,right:shrineTown.x+CAPITAL_SHRINE_COURT.right,
    top:shrineTown.y+CAPITAL_SHRINE_COURT.top,bottom:shrineTown.y+CAPITAL_SHRINE_COURT.bottom}};
  const obstacles=new StaticBoundsIndex([shrineCourt,...civicReservations,...people,...content.flatMap(d=>{
    if(changed.has(d.id)||board(d)||d.kind==='npc')return [];
    if('frame' in d){
      if(worldSpriteProfile(d.texture??'world_objects',d.frame)?.floor)return [];
      return [{bounds:propPlacementBounds(d.texture??'world_objects',d.frame,d.scale??1,d.world.x,d.world.y,d.anchor==='center','wallSegment' in d?d.wallSegment:undefined,d.rotation??0)}];
    }
    return [{bounds:bossArenaBounds(d)??{left:d.world.x-35,right:d.world.x+35,top:d.world.y-76,bottom:d.world.y+20}}];
  })]);
  const placed=new StaticBoundsIndex<{bounds:Rect}>([]);
  for(const d of moving){
    if(!('frame' in d))continue;
    const texture:ArtTextureKey=d.texture??'world_objects',scale=d.scale??1;
    const signal=d.id.startsWith('story:signal-fire:');
    const clueId=d.id.endsWith('winter-signal')?'story:frost-lantern':'story:beacon-kit';
    const clue=signal?content.find(entry=>entry.id===clueId):undefined;
    const preferred=clue?{x:clue.world.x+110,y:clue.world.y+40}:{...d.world};
    const region=world.getRegionAt(preferred.x,preferred.y),aboard=onFlagshipDeck(preferred.x,preferred.y),settlement=settlementFor(preferred);
    const candidates=[preferred,...[32,64,96,144,224,320,480,640,960].flatMap(radius=>
      Array.from({length:16},(_,i)=>({x:preferred.x+Math.cos(i*Math.PI/8)*radius,y:preferred.y+Math.sin(i*Math.PI/8)*radius})))];
    const offset=propPlacementBounds(texture,d.frame,scale,0,0,d.anchor==='center',undefined,d.rotation??0);
    const envelope={left:0,right:0,top:0,bottom:0},padded={left:0,right:0,top:0,bottom:0};
    const fits=(p:Vec2)=>{
      const r=envelope;r.left=p.x+offset.left;r.right=p.x+offset.right;r.top=p.y+offset.top;r.bottom=p.y+offset.bottom;
      if(settlement&&![r.left,r.right].every(x=>[r.top,r.bottom].every(y=>insideDefense(settlement.townId,x,y,-64))))return false;
      if(!aboard&&worldRectTouchesStreet(r,16))return false;
      padded.left=r.left-16;padded.right=r.right+16;padded.top=r.top-16;padded.bottom=r.bottom+16;
      if(obstacles.any(padded,o=>overlaps(r,o.bounds,16))||placed.any(padded,o=>overlaps(r,o.bounds,16)))return false;
      if(world.getRegionAt(p.x,p.y)!==region||fortificationBlocksPoint(p.x,p.y,40))return false;
      if(!propFitsHabitat(texture,d.frame,world,p.x,p.y,scale))return false;
      for(let ix=0;ix<3;ix++)for(let iy=0;iy<3;iy++){
        const x=ix===0?r.left:ix===1?(r.left+r.right)/2:r.right,y=iy===0?r.top:iy===1?(r.top+r.bottom)/2:r.bottom;
        if(!world.isWalkable(x,y)||!aboard&&flagshipFootprint(x,y)||aboard&&!onFlagshipDeck(x,y))return false;
      }
      return true;
    };
    let position=candidates.find(fits);
    // Admitted settlement dressing can be boxed in by the larger buildings.
    // Sparse compass samples miss narrow garden clearings: exhaust a bounded
    // nearby grid before recording an unresolved placement.
    if(!position&&(settlement||d.id.startsWith('detail:'))){
      for(const p of nearbySlots(preferred,1536))if(fits(p)){position=p;break;}
    }
    if(position)d.world=position;
    else AUTHORED_PROP_PLACEMENT_ISSUES.push(d.id); // Retain IDs/artwork; never silently delete an unfitted feature.
    placed.add({bounds:{left:d.world.x+offset.left,right:d.world.x+offset.right,top:d.world.y+offset.top,bottom:d.world.y+offset.bottom}});
    // Existing layout consumers see the final source-safe furniture positions.
    if(settlement){const town=TOWN_BY_ID[settlement.townId],prefix='detail:'+settlement.townId+':';
      const detail=d.id.startsWith(prefix)?settlement.details?.find(item=>item.id===d.id.slice(prefix.length)):undefined;
      if(detail){detail.x=d.world.x-town.world.x;detail.y=d.world.y-town.world.y;}
    }
  }
}
