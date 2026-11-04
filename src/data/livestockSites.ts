import {SETTLEMENT_PASTURES,pastureBounds} from './settlementPastures';
import type {Rect} from './settlementGeometry';
import {SETTLEMENT_LAYOUTS,buildingBounds} from './settlements';
import {FARM_PLOTS} from './landmarks';
import {TOWN_BY_ID} from './towns';
import type {Vec2} from '../game/types';

export type LivestockSpecies='chicken'|'goat'|'cow'|'horse';
export interface LivestockSite extends Vec2 {id:string;radius:number;species?:readonly LivestockSpecies[];population?:number;fixed?:boolean;bounds?:Rect}

/** Chickens use small-settlement yards and explicitly named urban slums.
 * Actual feet/paths are still certified against the final world at admission. */
export const LIVESTOCK_SITES:readonly LivestockSite[]=[
 ...FARM_PLOTS.filter(p=>{const town=TOWN_BY_ID[p.townId];return town&&(town.kind==='village'||town.kind==='town');}).flatMap(p=>[-1,1].map(side=>({id:p.id+':'+side,
  x:p.x+side*(p.width/2+150),y:p.y+p.height/2+100,radius:180,species:['chicken'] as const,population:2}))),
 ...SETTLEMENT_LAYOUTS.flatMap(layout=>layout.parcels.filter(p=>/commoner|housing|weavers|burgage|household|slum/.test(p.id)
   &&['grass','dirt'].includes(p.terrain)).flatMap(p=>{
  const town=TOWN_BY_ID[layout.townId];if(town.regionId==='darkav'||town.kind!=='village'&&town.kind!=='town'&&!/slum/.test(p.id))return [];
  return [-1,1].map(side=>({id:'courtyard:'+p.id+':'+side,x:town.world.x+p.x+side*p.width*.27,
   y:town.world.y+p.y+p.height*.20,radius:110,species:['chicken'] as const,population:2}));
 })),
 ...SETTLEMENT_LAYOUTS.flatMap(layout=>layout.buildings.flatMap((lot,i)=>{
  if(lot.omitted||i%4!==0||!/home|cottage|hearth|dwelling|croft/i.test(lot.label)
    ||/noble|manor|villa|royal|temple/i.test(lot.label))return [];
  const town=TOWN_BY_ID[layout.townId];if(town.regionId==='darkav'||town.kind!=='village'&&town.kind!=='town')return [];
  const r=buildingBounds(lot),side=i%8===0?-1:1;
  return [{id:'house-yard:'+town.id+':'+i,x:town.world.x+(side<0?r.left-100:r.right+100),
    y:town.world.y+lot.y+155,radius:95,species:['chicken'] as const,population:2}];
 })),
];

/** Resolve only after content admission; no speculative livestock enclosure can
 * spawn animals if its fences/hay could not fit the final settlement survey. */
export function outdoorLivestockSites():readonly LivestockSite[]{
 return [...LIVESTOCK_SITES,...SETTLEMENT_PASTURES.map(p=>({id:p.id,x:p.x,y:p.y,radius:Math.min(165,p.width/2-65,p.height/2-60),
  species:['cow','goat'] as const,population:p.width<380?2:p.width<560?4:6,bounds:pastureBounds(p)}))];
}

const MEADOW_HERD:readonly LivestockSpecies[]=['cow','cow','goat'];
const WOODLAND_FLOCK:readonly LivestockSpecies[]=['chicken'];
const HILL_HERD:readonly LivestockSpecies[]=['goat'];
/** Feral/free-ranging groups use suitable dry land, never volcanic ground,
 * beaches, snowfields or water. Exact feet and routes are checked by the host.
 * No full-world spawn list or persistent animal simulation is created. */
export function roamingLivestockSpecies(region:string,biome:string,terrain:string,variant:number):readonly LivestockSpecies[]|undefined {
 if(region==='darkav'||region==='dead-sea'||!['grass','forest','dirt'].includes(terrain))return;
 if(biome==='highland'||biome==='dryland')return HILL_HERD;
 if(biome==='forest')return variant%3===0?HILL_HERD:WOODLAND_FLOCK;
 if(biome==='meadow')return variant%3===0?WOODLAND_FLOCK:MEADOW_HERD;
}
