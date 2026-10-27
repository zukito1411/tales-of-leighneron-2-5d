import type {TownDefinition} from '../game/types';
import {SETTLEMENT_PROFILES,type SettlementProfileId} from './settlementProfiles';
import type {Rect} from './settlementGeometry';
import {CASTLE_FRONTAGE} from './architecture';

export const DEEPFORD_TRADE_STREET_Y=620;

/** Shared dimensions for plots, roads, defensive seams and terrain foundations. */
export function wardPlanning(town:TownDefinition){
  const urban=town.kind==='capital'||town.kind==='stronghold';
  return {columns:town.id==='highmere'?6:urban?4:town.kind==='village'?2:3,spacing:urban?620:560,lowerStreetY:town.id==='deepford'?DEEPFORD_TRADE_STREET_Y:undefined};
}
export function citadelPlanning(townId:string){
  const profile=SETTLEMENT_PROFILES[townId as SettlementProfileId];
  if(!profile?.citadel)return;
  const width=CASTLE_FRONTAGE,x=-width/2-520;
  const forecourt=980,gateY=townId==='highmere'?-990:-profile.bounds.height/2+160,y=gateY-forecourt;
  const depth=width*(profile.citadel==='palace'?.50:.54);
  return {x,y,width,depth,left:x-width/2-320,right:x+width/2+320,top:y-depth-320,bottom:gateY,forecourt};
}
function settlementCore(town:TownDefinition){
  const profile=SETTLEMENT_PROFILES[town.id as SettlementProfileId],ward=wardPlanning(town);
  const coreHalf=profile.bounds.width/2,hy=profile.bounds.height/2+160;
  // Include the productive outer commons; trimming a wall cannot consume an
  // existing field or force its neighboring household out of the settlement.
  const half=Math.max(coreHalf+600+(ward.columns-1)*ward.spacing+420,coreHalf+hy*1.465+140);
  return {left:-half,right:half,top:-profile.bounds.height/2-160,bottom:profile.bounds.height/2+160};
}
/** The inhabited rectangular wards and attached keep form one orthogonal plan.
 * A north precinct extends only as wide as the keep, avoiding empty city-wide
 * strips beside it. Roads, foundation flattening and collision share the union. */
export function settlementGroundPlan(town:TownDefinition){
  const core=settlementCore(town),citadel=citadelPlanning(town.id);
  if(!citadel)return {rectangles:[core],vertices:[{x:core.left,y:core.top},{x:core.right,y:core.top},{x:core.right,y:core.bottom},{x:core.left,y:core.bottom}]};
  const precinct:Rect={left:citadel.left-440,right:citadel.right+440,top:citadel.top-440,bottom:citadel.bottom};
  return {rectangles:[core,precinct],vertices:[{x:core.left,y:core.top},{x:precinct.left,y:core.top},
    {x:precinct.left,y:precinct.top},{x:precinct.right,y:precinct.top},{x:precinct.right,y:core.top},
    {x:core.right,y:core.top},{x:core.right,y:core.bottom},{x:core.left,y:core.bottom}]};
}
export function settlementEnvelope(town:TownDefinition){
  const rectangles=settlementGroundPlan(town).rectangles;
  return {left:Math.min(...rectangles.map(r=>r.left)),right:Math.max(...rectangles.map(r=>r.right)),
    top:Math.min(...rectangles.map(r=>r.top)),bottom:Math.max(...rectangles.map(r=>r.bottom))};
}
export function settlementNorthBoundary(town:TownDefinition,x:number){
  return Math.min(...settlementGroundPlan(town).rectangles.filter(r=>x>=r.left&&x<=r.right).map(r=>r.top));
}
export function fortificationSize(town:TownDefinition){
  const capital=town.kind==='capital',strong=town.kind==='stronghold',village=town.kind==='village';
  return {height:capital?320:strong?290:village?200:250,thickness:capital||strong?64:village?36:52,
    towerDiameter:capital?260:strong?230:village?170:210};
}
