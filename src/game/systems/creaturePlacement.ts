import { protectedSettlementAt, SETTLEMENT_ENEMY_BUFFER } from '../../data/settlements';
import { TOWN_BY_ID } from '../../data/towns';
import {SETTLEMENT_PROFILES,type SettlementProfileId} from '../../data/settlementProfiles';
import type { ContentDefinition, ContentWorldState, CreatureContentDefinition, Vec2 } from '../types';

interface CreatureTerritory { canCreatureOccupy(x: number, y: number): boolean }

export function findCreaturePlacement(preferred: Vec2, territory: CreatureTerritory): Vec2 | null {
  if (territory.canCreatureOccupy(preferred.x,preferred.y)) return { ...preferred };
  const layout = protectedSettlementAt(preferred.x,preferred.y);
  if (layout) {
    const town = TOWN_BY_ID[layout.townId], profile=SETTLEMENT_PROFILES[layout.townId as SettlementProfileId];
    const gap = SETTLEMENT_ENEMY_BUFFER + 32;
    const hx=profile.bounds.width/2+160,hy=profile.bounds.height/2+160;
    const flank=hx+2*Math.max(0,hy-Math.abs(preferred.y-town.world.y));
    const candidates = [
      { x:town.world.x - flank - gap*3,y:preferred.y },
      { x:town.world.x + flank + gap*3,y:preferred.y },
      { x:preferred.x,y:town.world.y - hy - gap },
      { x:preferred.x,y:town.world.y + hy + gap },
    ].sort((a,b) => Math.hypot(a.x - preferred.x,a.y - preferred.y) - Math.hypot(b.x - preferred.x,b.y - preferred.y));
    for (const candidate of candidates) if (territory.canCreatureOccupy(candidate.x,candidate.y)) return candidate;
  }
  // Bounded fallback handles coastal towns, water and old invalid positions.
  for (const radius of [48,80,128,176,256,384,512,768,1024,1536,2048,3072,4096]) for (let i = 0; i < 16; i++) {
    const angle = i * Math.PI / 8, x = preferred.x + Math.cos(angle) * radius, y = preferred.y + Math.sin(angle) * radius;
    if (territory.canCreatureOccupy(x,y)) return { x,y };
  }
  return null; // Keep the logical record dormant rather than resetting/killing it.
}

/** Repair old in-town positions without changing IDs, health, deaths or rewards. */
export function repairCreaturePlacements(definitions: ContentDefinition[], persisted: ContentWorldState, territory: CreatureTerritory, fits?:(definition:CreatureContentDefinition,point:Vec2)=>boolean): ContentWorldState {
  const states = { ...persisted.states };
  for (const definition of [...definitions,...Object.values(persisted.spawns)]) {
    if (definition.kind !== 'creature') continue;
    const state = states[definition.id];
    if (state?.defeated) continue;
    const preferred = state ?? definition.world;
    const valid=(x:number,y:number)=>territory.canCreatureOccupy(x,y)&&(!fits||fits(definition,{x,y}));
    if (valid(preferred.x,preferred.y)) continue;
    const position = findCreaturePlacement(preferred,{canCreatureOccupy:valid});
    if (position) {
      const prior=state?.encounterPlacement??definition.encounterBehavior;
      const home=prior&&valid(prior.home.x,prior.home.y)?prior.home:position;
      states[definition.id] = { ...(state ?? definition.world),...position,
        ...(prior?{encounterPlacement:{home:{...home},station:{...position}}}:{}) };
    }
  }
  return { ...persisted,states };
}
