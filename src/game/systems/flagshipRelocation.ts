import {FLAGSHIP_OFFSHORE_SHIFT,onFlagshipBoarding,onFlagshipDeck,flagshipWalkable,SALT_KING_DECK_HOME} from '../../data/pirateFlagship';
import type {ContentWorldState,Vec2} from '../types';

/** A one-time layout migration. Preserve injuries, deaths, cargo, ownership,
 * encounter stations and deadlines; only onboard coordinates follow the hull. */
export function relocateFlagship(world:ContentWorldState,player:Vec2){
  if(world.flagshipLayoutVersion===1)return {world,player};
  const move=(p:Vec2):Vec2=>{
    const shifted={x:p.x+FLAGSHIP_OFFSHORE_SHIFT,y:p.y};
    // A player standing on the old shore end can stay on the extended plank.
    return onFlagshipDeck(shifted.x,shifted.y)||!onFlagshipBoarding(p.x,p.y)&&onFlagshipBoarding(shifted.x,shifted.y)?shifted:{x:p.x,y:p.y};
  };
  const states={...world.states},spawns={...world.spawns};
  const summons=new Set(states['boss:salt-king']?.summonWave?.members??[]);
  for(const [id,state] of Object.entries(states)){
    if(id!=='boss:salt-king'&&!id.startsWith('pirate:flagship:crew:')&&!summons.has(id))continue;
    let point=move(state);
    if(id==='boss:salt-king'&&(!onFlagshipDeck(point.x,point.y)||!flagshipWalkable(point.x,point.y,24)))point=SALT_KING_DECK_HOME;
    const placement=state.encounterPlacement;
    states[id]={...state,...point,...(placement?{encounterPlacement:{home:move(placement.home),station:move(placement.station)}}:{})};
  }
  for(const [id,spawn] of Object.entries(spawns)){
    if(!summons.has(id))continue;
    const behavior=spawn.encounterBehavior;
    spawns[id]={...spawn,world:move(spawn.world),...(behavior?{encounterBehavior:{...behavior,home:move(behavior.home),station:move(behavior.station)}}:{})};
  }
  return {world:{...world,states,spawns,flagshipLayoutVersion:1 as const},player:move(player)};
}
