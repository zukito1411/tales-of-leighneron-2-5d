import {HIGHMERE_SHRINE_SITE} from './highmerePlan';
import { TOWNS } from './towns';
import type { InteractableContentDefinition, Vec2 } from '../game/types';
import {artFrameSize} from './art';
import {spriteBounds,type Rect} from './settlementGeometry';
import {architectureMinimumScale} from './architecture';
import {BUILDING_PRESENTATION_GROWTH} from './environmentPresentation';

export const TELEPORT_SHRINE={texture:'native_story_bare',frame:11,width:180,depth:1,rise:1.68} as const;

export interface TownShrine {
  townId:string; contentId:string; name:string; world:Vec2; arrival:Vec2; scale:number; court:Rect;
}

export const TOWN_SHRINES:TownShrine[] = TOWNS.map(town => {
  const offset = town.id === 'oakmere' ? { x:40,y:-270 } : town.id === 'highmere' ? HIGHMERE_SHRINE_SITE : { x:140,y:-110 };
  const world = { x:town.world.x + offset.x,y:town.world.y + offset.y };
  const size=artFrameSize(TELEPORT_SHRINE.texture,TELEPORT_SHRINE.frame);
  // Preserve the established sacred court when replacing its central monument.
  // Changing the display asset must not refit neighboring houses or streets.
  const courtTexture=town.id==='elarion'?'elven_villas':'world_buildings',courtFrame=town.id==='elarion'?4:3;
  const oldSize=artFrameSize(courtTexture,courtFrame);
  const courtScale=Math.max((town.id==='highmere'?.9:.8)*(town.id==='elarion'?1.35:1)*BUILDING_PRESENTATION_GROWTH,
    architectureMinimumScale(courtTexture,courtFrame,oldSize.width,oldSize.height));
  const court=spriteBounds(courtTexture,courtFrame,courtScale,world.x,world.y);
  return { townId:town.id,contentId:town.id === 'oakmere' ? 'shrine:oakmere-road'
    : town.id === 'highmere' ? 'town:highmere:building:12' : `shrine:${town.id}:wayfarer`,
    name:`${town.name} ${town.id === 'highmere' ? 'Crown' : 'Wayfarer'} Shrine`,world,
    arrival:{ x:world.x,y:world.y + 64 },
    court,scale:TELEPORT_SHRINE.width/size.width };
});
export const TOWN_SHRINE_BY_ID = Object.fromEntries(TOWN_SHRINES.map(shrine => [shrine.townId,shrine])) as Record<string,TownShrine>;

export const TOWN_SHRINE_CONTENT_IDS:ReadonlySet<string>=new Set(TOWN_SHRINES.map(s=>s.contentId));

export function townShrineContent(shrine:TownShrine):InteractableContentDefinition {
  return { id:shrine.contentId,kind:'interactable',world:shrine.world,texture:TELEPORT_SHRINE.texture,
    frame:TELEPORT_SHRINE.frame,scale:shrine.scale,name:shrine.name,townShrineId:shrine.townId,
    description:'Attune to this shrine to unlock its settlement for shrine travel.',
    repeatText:'Choose an attuned settlement shrine to travel to.' };
}
