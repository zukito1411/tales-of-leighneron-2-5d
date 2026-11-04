/** Deliberate planted courts fitted to the current immutable town survey.
 * These replace repeated speculative garden sweeps. Every composition is still
 * checked against current doors, streets, structures and scheduled NPC space;
 * future conflicting edits omit the complete composition, never move a house.
 * Oakmere includes its bare north-wall band; Highmere includes open merchant,
 * terrace and southern approaches. Coordinates are settlement-local. */
export interface SettlementGardenSite {id:string;x:number;y:number;compact:boolean}
export const SETTLEMENT_GARDEN_SITES:Readonly<Record<string,readonly SettlementGardenSite[]>>={
 oakmere:[
  {id:"north-wall-west",x:-2032.4,y:-1160,compact:true},
  {id:"north-wall-guard",x:-1392.4,y:-1160,compact:true},
  {id:"north-wall-centre",x:-1072.4,y:-1160,compact:true},
  {id:"north-wall-east",x:1167.6,y:-1160,compact:true},
  {id:"south-west-yard",x:-1129,y:800.8,compact:true},
  {id:"north-east-court",x:1129,y:-799.2,compact:true},
  {id:"east-wall-green",x:2709.6,y:-640.136,compact:true},
 ],
 highmere:[
  {id:"royal-gate-west",x:-1750,y:-1161,compact:false},
  {id:"central-east-green",x:877.607,y:-465.794,compact:false},
  {id:"upper-west-garden",x:-2312.652,y:-4512.652,compact:false},
  {id:"upper-east-garden",x:2487.348,y:-4192.652,compact:false},
  {id:"west-terrace-outer",x:-3272.652,y:-3872.652,compact:false},
  {id:"west-terrace-inner",x:-2632.652,y:-3872.652,compact:false},
  {id:"east-terrace-garden",x:3127.348,y:-3872.652,compact:false},
  {id:"temple-gate-green",x:1847.348,y:-1312.652,compact:false},
  {id:"south-east-wall",x:1384.987,y:5529.178,compact:true},
  {id:"south-west-wall",x:-1920.272,y:5366.801,compact:true},
  {id:"west-upper-wall",x:-4223.421,y:-3827.886,compact:true},
  {id:"north-west-wall",x:-1920.272,y:-5366.801,compact:true},
  {id:"north-east-wall",x:1920.272,y:-5366.801,compact:true},
  {id:"traders-green",x:-2260,y:-293,compact:true},
 ],
};
