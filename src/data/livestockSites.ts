import {SETTLEMENT_LAYOUTS,buildingBounds} from './settlements';
import {FARM_PLOTS} from './landmarks';
import {TOWN_BY_ID} from './towns';
import type {Vec2} from '../game/types';

export type LivestockSpecies='chicken'|'goat'|'cow'|'horse';
export interface LivestockSite extends Vec2 {id:string;radius:number;species?:readonly LivestockSpecies[];population?:number;fixed?:boolean}

/** Farm edges and stable side yards, never the planted crop beds themselves.
 * Actual feet/paths are still certified against the final world at admission. */
export const LIVESTOCK_SITES:readonly LivestockSite[]=[
 ...FARM_PLOTS.flatMap(p=>[-1,1].map(side=>({id:p.id+':'+side,
  x:p.x+side*(p.width/2+150),y:p.y+p.height/2+100,radius:240}))),
 ...SETTLEMENT_LAYOUTS.flatMap(layout=>layout.parcels.filter(p=>/commoner|housing|weavers|burgage|household|slum/.test(p.id)
   &&['grass','dirt'].includes(p.terrain)).flatMap(p=>{
  const town=TOWN_BY_ID[layout.townId];if(town.regionId==='darkav')return [];
  return [-1,1].map(side=>({id:'courtyard:'+p.id+':'+side,x:town.world.x+p.x+side*p.width*.27,
   y:town.world.y+p.y+p.height*.20,radius:110,species:['chicken'] as const,population:2}));
 })),
 ...SETTLEMENT_LAYOUTS.flatMap(layout=>layout.buildings.flatMap((lot,i)=>{
  if(lot.omitted||i%4!==0||!/home|cottage|hearth|dwelling|croft/i.test(lot.label)
    ||/noble|manor|villa|royal|temple/i.test(lot.label))return [];
  const town=TOWN_BY_ID[layout.townId];if(town.regionId==='darkav')return [];
  const r=buildingBounds(lot),side=i%8===0?-1:1;
  return [{id:'house-yard:'+town.id+':'+i,x:town.world.x+(side<0?r.left-100:r.right+100),
    y:town.world.y+lot.y+155,radius:95,species:['chicken'] as const,population:2}];
 })),
 ...SETTLEMENT_LAYOUTS.flatMap(layout=>layout.buildings.flatMap((lot,i)=>{
  if(lot.omitted||!/stable|barn|fodder|granary/i.test(lot.label))return [];
  const town=TOWN_BY_ID[layout.townId];if(town.regionId==='darkav')return [];
  const r=buildingBounds(lot);
  return [-1,1].map(side=>({id:'stable:'+town.id+':'+i+':'+side,
   x:town.world.x+(side<0?r.left-160:r.right+160),y:town.world.y+lot.y+240,radius:260}));
 })),
];
