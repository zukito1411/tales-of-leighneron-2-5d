import type {CapitalTrade} from './highmereStreetStyle';
import type {InteriorFurnishingUse,InteriorProfile,RoomKind} from './interiors';

/** Dress existing lots using the same trade identity as their exterior sign.
 * Room decoration never changes the building ID, services or saved ownership. */
export function establishmentFurnishingUse(profile:InteriorProfile,name:string,trade?:CapitalTrade):InteriorFurnishingUse|undefined {
 if(profile==='inn')return 'tavern';
 if(['guild','armory','store','stable','barracks'].includes(profile))return profile as 'guild'|'armory'|'store'|'stable'|'barracks';
 if(profile==='castle'||profile==='villa'||profile==='cave')return;
 if(/\brestaurant\b|\bcaf[eé]\b|tea ?house|eatery|dining house/i.test(name))return 'restaurant';
 if(/bakery|baker|pastr|patisserie/i.test(name))return 'bakery';
 // Neighborhood housing retains its domestic layout even in a trade ward.
 if(/\bhomes?\b|\b(?:upper|lower) house\b|\brow\b|\byard\b|\blane\b/i.test(name))return;
 if(trade==='clothier'||/tailor|cloth|weaver|sailmaker|dyer/i.test(name))return 'clothier';
 if(trade==='bakery'&&profile!=='kitchen')return 'bakery';
 if(trade==='herbalist')return 'herbalist';
 if(trade==='bookseller'&&profile!=='archive')return 'bookseller';
 if(profile==='kitchen')return 'restaurant';
 return;
}

export function roomFurnishingUse(kind:RoomKind):InteriorFurnishingUse|undefined {
 if(kind==='tavern')return 'tavern';
 if(kind==='dining')return 'restaurant';
 if(kind==='storage')return 'store';
 if(kind==='market')return 'market';
 if(kind==='office'||kind==='archive'||kind==='library'||kind==='council')return 'guild';
 if(['guild','armory','stable','barracks','kitchen','workshop','chapel'].includes(kind))
  return kind as 'guild'|'armory'|'stable'|'barracks'|'kitchen'|'workshop'|'chapel';
 return;
}
