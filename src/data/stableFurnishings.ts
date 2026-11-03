import type {InteriorArtKey} from './interiorArt';
import type {InteriorFurnishingUse} from './interiors';
import {HERO_BODY_HEIGHT} from './heroBodyRegistration';
import {STABLE_HAY_DEPTH,STABLE_RAIL_DEPTH} from './stableEntrance';

/** Shared physical depth and visible height for stable placement/presentation. */
export function stableFurnishingSpec(art:InteriorArtKey,use?:InteriorFurnishingUse){
 if(use==='stable-bedding')return {depth:STABLE_HAY_DEPTH,height:4};
 if(use==='stable-hay')return {depth:STABLE_HAY_DEPTH,height:HERO_BODY_HEIGHT*.8};
 if(use==='stable-gear')return {depth:.3,height:HERO_BODY_HEIGHT*.85};
 if(use!=='stable')return;
 if(art==='bench')return {depth:STABLE_RAIL_DEPTH,height:HERO_BODY_HEIGHT*.75};
 if(art==='barrel')return {depth:.86,height:HERO_BODY_HEIGHT*.55};
 if(art==='chest')return {depth:.45,height:HERO_BODY_HEIGHT*.56};
 if(art==='pantry')return {depth:.34,height:HERO_BODY_HEIGHT*1.18};
 if(art==='wardrobe')return {depth:.34,height:HERO_BODY_HEIGHT*1.45};
}
