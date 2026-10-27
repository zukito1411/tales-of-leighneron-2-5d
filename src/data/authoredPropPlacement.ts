import {artFrameSize,type ArtTextureKey} from './art';
import type {ContentDefinition,Vec2,WorldPropTexture} from '../game/types';
import {WorldGenerator} from '../game/systems/WorldGenerator';
import {propFitsHabitat} from '../game/systems/propHabitat';
import {StaticBoundsIndex} from '../game/systems/StaticBoundsIndex';
import {bossArenaBounds} from '../game/systems/bossArenas';
import {spriteBounds,propPlacementBounds,overlaps,rectTouchesStreet,type Rect} from './settlementGeometry';
import {worldSpriteProfile} from './worldSpriteGeometry';
import {isNativePropReplacement} from './nativePropReplacements';
import {ROAD_ROUTES} from './roadRoutes';
import {SETTLEMENT_LAYOUTS} from './settlements';
import {TOWN_BY_ID} from './towns';
import {fortificationBlocksPoint} from './fortifications';
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
  const moving=content.filter(d=>'frame' in d&&(isNativePropReplacement(d.id)
    ||d.kind==='prop'&&habitatProp(d.texture??'',d.frame)
      &&!propFitsHabitat(d.texture??'world_objects',d.frame,world,d.world.x,d.world.y,d.scale??1)))
    .sort((a,b)=>Number(isNativePropReplacement(b.id))-Number(isNativePropReplacement(a.id)));
  for(const d of moving)changed.add(d.id);
  const board=(d:ContentDefinition)=>'frame' in d&&(
    (d.texture==='others'||d.texture==='native_civic_bare')&&d.frame===11
    ||d.texture==='world_assets'&&d.frame===5);
  const obstacles=new StaticBoundsIndex(content.flatMap(d=>{
    if(changed.has(d.id)||board(d))return [];
    if('frame' in d){
      if(worldSpriteProfile(d.texture??'world_objects',d.frame)?.floor)return [];
      return [{bounds:propPlacementBounds(d.texture??'world_objects',d.frame,d.scale??1,d.world.x,d.world.y,d.anchor==='center')}];
    }
    return [{bounds:bossArenaBounds(d)??{left:d.world.x-35,right:d.world.x+35,top:d.world.y-76,bottom:d.world.y+20}}];
  }));
  const placed:Rect[]=[];
  for(const d of moving){
    if(!('frame' in d))continue;
    const texture:ArtTextureKey=d.texture??'world_objects',scale=d.scale??1;
    const signal=d.id.startsWith('story:signal-fire:');
    const clueId=d.id.endsWith('winter-signal')?'story:frost-lantern':'story:beacon-kit';
    const clue=signal?content.find(entry=>entry.id===clueId):undefined;
    const preferred=clue?{x:clue.world.x+110,y:clue.world.y+40}:{...d.world};
    const region=world.getRegionAt(preferred.x,preferred.y),aboard=onFlagshipDeck(preferred.x,preferred.y);
    const candidates=[preferred,...[32,64,96,144,224,320,480,640,960].flatMap(radius=>
      Array.from({length:16},(_,i)=>({x:preferred.x+Math.cos(i*Math.PI/8)*radius,y:preferred.y+Math.sin(i*Math.PI/8)*radius})))];
    const fits=(p:Vec2)=>{
      if(world.getRegionAt(p.x,p.y)!==region||fortificationBlocksPoint(p.x,p.y,40))return false;
      if(!propFitsHabitat(texture,d.frame,world,p.x,p.y,scale))return false;
      const r=spriteBounds(texture,d.frame,scale,p.x,p.y);
      if(!aboard&&ROAD_ROUTES.some(road=>rectTouchesStreet(r,road,20)))return false;
      if(SETTLEMENT_LAYOUTS.some(layout=>{const town=TOWN_BY_ID[layout.townId];
        const local={left:r.left-town.world.x,right:r.right-town.world.x,top:r.top-town.world.y,bottom:r.bottom-town.world.y};
        return layout.streets.some(street=>rectTouchesStreet(local,street,16));
      }))return false;
      for(const x of [r.left,(r.left+r.right)/2,r.right])for(const y of [r.top,(r.top+r.bottom)/2,r.bottom]){
        if(!world.isWalkable(x,y)||!aboard&&flagshipFootprint(x,y))return false;
        if(aboard&&!onFlagshipDeck(x,y))return false;
      }
      const padded={left:r.left-16,right:r.right+16,top:r.top-16,bottom:r.bottom+16};
      return !obstacles.query(padded).some(o=>overlaps(r,o.bounds,16))&&!placed.some(b=>overlaps(r,b,16));
    };
    const position=candidates.find(fits);
    if(position)d.world=position;
    else if(d.kind==='prop'&&(!isNativePropReplacement(d.id)||d.id.startsWith('detail:'))){
      // Optional decoration may be omitted if no compatible ground is nearby.
      // Quest objects, actors, buildings, bridges and their IDs are never removed.
      content.splice(content.indexOf(d),1);continue;
    }else AUTHORED_PROP_PLACEMENT_ISSUES.push(d.id);
    placed.push(spriteBounds(texture,d.frame,scale,d.world.x,d.world.y));
  }
}
