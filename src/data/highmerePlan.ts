import type {Vec2} from '../game/types';
import {CAPITAL_LOCAL_STREETS,CAPITAL_SHRINE_SITE} from './highmereComposition';

/** Local capital survey. Independent of content/terrain initialization so the
 * renderer, foundations, roads, defenses and residents share one source. */
export const HIGHMERE_PLAN={radius:6100,segments:64,royalRadius:2100,royalSegments:32,
  royalCenter:{x:0,y:-3300},keep:{x:0,y:-3100,width:2090},royalHeight:180,
  riverX:7400,eastApproachX:8300,bridgeY:[0],mainBridge:{x:0,y:6650},bridgeClearWidth:220} as const;
/** Keep port travel, the visible boat, landing and signposts on one survey. */
export const HIGHMERE_QUAY={landing:{x:HIGHMERE_PLAN.riverX-260,y:1100},quay:{x:HIGHMERE_PLAN.riverX-150,y:1100},boat:{x:HIGHMERE_PLAN.riverX,y:1100}} as const;
export const HIGHMERE_SHRINE_SITE=CAPITAL_SHRINE_SITE;
export const HIGHMERE_WALL_APOTHEM=HIGHMERE_PLAN.radius*Math.cos(Math.PI/HIGHMERE_PLAN.segments);
export const HIGHMERE_ROYAL_APOTHEM=HIGHMERE_PLAN.royalRadius*Math.cos(Math.PI/HIGHMERE_PLAN.royalSegments);
export const HIGHMERE_ROYAL_GATE_Y=HIGHMERE_PLAN.royalCenter.y+HIGHMERE_ROYAL_APOTHEM;
export const HIGHMERE_ROYAL_POSTERN_Y=HIGHMERE_PLAN.royalCenter.y-HIGHMERE_ROYAL_APOTHEM;

/** Half-segment offset gives each cardinal gate a straight landing between
 * curved curtains. Whole wall sections retain their true physical thickness. */
export function ringVertices(center:Vec2,radius:number,segments:number):Vec2[]{
  return Array.from({length:segments},(_,i)=>{const a=(i+.5)*Math.PI*2/segments;
    return {x:center.x+Math.cos(a)*radius,y:center.y+Math.sin(a)*radius};});
}
export function insideHighmere(x:number,y:number,buffer=0){
  const inner=HIGHMERE_WALL_APOTHEM+buffer,outer=HIGHMERE_PLAN.radius+buffer,distanceSquared=x*x+y*y;
  if(outer<0||Math.abs(x)>outer||Math.abs(y)>outer||distanceSquared>outer*outer)return false;
  if(inner>=0&&distanceSquared<=inner*inner)return true;
  const step=Math.PI*2/HIGHMERE_PLAN.segments,a=Math.atan2(y,x);
  const edge=HIGHMERE_WALL_APOTHEM/Math.cos(a-Math.round(a/step)*step);
  return Math.hypot(x,y)<=edge+buffer;
}
/** Reserve the actual royal precinct, not the empty corners of its bounding
 * square; those corners belong to the noble and merchant approaches. */
export function royalWardOverlaps(rect:{left:number;right:number;top:number;bottom:number},clearance=0){
  const c=HIGHMERE_PLAN.royalCenter,dx=Math.max(rect.left-c.x,0,c.x-rect.right),dy=Math.max(rect.top-c.y,0,c.y-rect.bottom);
  return dx*dx+dy*dy<(HIGHMERE_PLAN.royalRadius+clearance)**2;
}
const smooth=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
function terrace(x:number,y:number,left:number,right:number,top:number,bottom:number,height:number){
  const distance=Math.hypot(Math.max(left-x,0,x-right),Math.max(top-y,0,y-bottom));
  return height*(1-smooth(distance/600));
}
/** Continuous, walkable grades rather than a cosmetic platform above physics.
 * The keep and its gardens have a broad level summit; the public road climbs. */
export function highmereElevation(x:number,y:number){
  const royal=HIGHMERE_PLAN.royalHeight*(1-smooth((Math.hypot(x,y-HIGHMERE_PLAN.royalCenter.y)-2250)/800));
  return Math.max(royal,terrace(x,y,-4750,-2350,-3600,-1500,80),terrace(x,y,2350,4750,-3600,-1500,65));
}
export const HIGHMERE_SENTRY_ANCHORS:Readonly<Record<string,Vec2>>={
  'ser-elin-ward':{x:-240,y:HIGHMERE_ROYAL_GATE_Y+240},
  'ser-tomas-rowe':{x:240,y:HIGHMERE_ROYAL_GATE_Y+240},
  'annor-lorn':{x:-240,y:-HIGHMERE_WALL_APOTHEM+240},
  'hestia-farrow':{x:240,y:HIGHMERE_WALL_APOTHEM-300},
};

export interface CapitalDistrict {id:string;name:string;purpose:string;terrain:'grass'|'stone'|'dirt'|'farmland';x:number;y:number;width:number;height:number}
export const HIGHMERE_DISTRICTS:readonly CapitalDistrict[]=[
  {id:'noble-quarter',name:'Noble Quarter',purpose:'Raised limestone residences, paved embassy courts, heraldic lamps and planted parterres',terrain:'stone',x:-3500,y:-2400,width:3000,height:2600},
  {id:'temple-terrace',name:'Temple of the Dawn Terrace',purpose:'Paved chapel courts, fountains and tended pilgrimage gardens',terrain:'stone',x:3500,y:-2400,width:3000,height:2600},
  {id:'royal-gardens',name:'Royal Gardens',purpose:'Tended gardens and a rear processional walk around the keep',terrain:'grass',x:0,y:-4550,width:2100,height:650},
  {id:'capital-plaza',name:'Crown and Common Plaza',purpose:'Central public quest board, petitions and a clear ceremonial crossing',terrain:'stone',x:0,y:100,width:760,height:760},
  {id:'guild-market',name:'Market and Guild Borough',purpose:'Markets, craft courts and sheltered merchant approaches',terrain:'stone',x:-2900,y:400,width:3300,height:1100},
  {id:'weavers-green',name:'Weavers Common',purpose:'Cloth exchange, neighborhood wells and household gathering courts',terrain:'grass',x:-3450,y:3100,width:2200,height:1600},
  {id:'commoner-quarter',name:'Commoner Housing',purpose:'Lower western homes, communal kitchens and accessible side lanes',terrain:'dirt',x:-3200,y:3400,width:3200,height:2200},
  {id:'rural-quarter',name:'Rural Quarter and Farmstead Edge',purpose:'Stone farmstead courts, granaries, stables, cart yards and separate food gardens',terrain:'stone',x:3200,y:3400,width:3200,height:2200},
  {id:'farm:highmere:east',name:'East Allotments',purpose:'Productive crop strips beside the southern gate approach',terrain:'farmland',x:2400,y:5100,width:1000,height:280},
  {id:'farm:highmere:west',name:'Household Gardens',purpose:'Lower ward food gardens and clear harvest approaches',terrain:'farmland',x:-2400,y:4950,width:1400,height:480},
];

/** Preserve the existing 24 ward house slots, spread into neighborhoods rather
 * than extending six houses in a straight line outside the capital core. */
export function highmereWardSite(side:-1|1,row:number,column:number){
  const bay=Math.floor(column/3),slot=column%3;
  const x=row===0?2600+(2-slot)*950:bay===0?2700+(2-slot)*1000:1800+(2-slot)*1000;
  return {x:side*x,y:row===0?-1800-bay*1100:3000+bay*1200};
}
export function highmereWardActivities(side:-1|1){return {
  work:{x:side*3500,y:850},social:{x:side*3500,y:350},home:{x:side*3500,y:3370},
};}

/** A wide, closed public watch circuit around the western market ward.
 * The exact same points reserve terrain, prop clearance and formation travel. */
export const HIGHMERE_MARCH_ROUTE:readonly Vec2[]=[{x:-5100,y:0},{x:-1200,y:0},
  {x:-1200,y:1100},{x:-5100,y:1100},{x:-5100,y:0}];
export const HIGHMERE_MARCH_SPACING=120;
export const HIGHMERE_MARCH_STATIONS:Readonly<Record<string,{position:Vec2;home:Vec2}>>=Object.fromEntries(
  ['odel-wren','bessa-holt','hugh-merrit','sella-ford','orrik-pike','mina-thorne'].map((id,rank)=>[id,{
    position:{x:HIGHMERE_MARCH_ROUTE[0].x+rank*HIGHMERE_MARCH_SPACING,y:0},home:{x:-4250+rank*150,y:-130},
  }]));

export const HIGHMERE_ROYAL_WALK:readonly Vec2[]=[{x:0,y:HIGHMERE_ROYAL_POSTERN_Y},{x:0,y:-4900},
  {x:-1300,y:-4400},{x:-1300,y:-1900},{x:0,y:-1600}];

export const HIGHMERE_AVENUES:ReadonlyArray<{id:string;width:number;points:Vec2[];surface:'stone'|'dirt'}>=[
  {id:'kings-road',width:208,surface:'stone',points:[{x:0,y:HIGHMERE_ROYAL_GATE_Y+60},{x:0,y:0},{x:0,y:7600}]},
  {id:'crown-plaza-ring',width:64,surface:'stone',points:Array.from({length:25},(_,i)=>({x:Math.cos(i*Math.PI/12)*600,y:150+Math.sin(i*Math.PI/12)*600}))},
  {id:'capital-crossing',width:176,surface:'stone',points:[{x:-6600,y:0},{x:0,y:0},{x:HIGHMERE_PLAN.eastApproachX,y:0}]},
  {id:'market-crossing',width:112,surface:'stone',points:[{x:-5100,y:1100},{x:0,y:1100},{x:5100,y:1100}]},
  {id:'crown-watch-circuit',width:104,surface:'stone',points:HIGHMERE_MARCH_ROUTE.map(p=>({...p}))},
  ...CAPITAL_LOCAL_STREETS,
  // This branch is wholly outside the curtain. All quay traffic uses Eastgate.
  {id:'river-quay-approach',width:160,surface:'stone',points:[{x:6400,y:0},{x:6400,y:1100},{...HIGHMERE_QUAY.landing}]},
  {id:'river-quay-promenade',width:220,surface:'stone',points:[{x:HIGHMERE_QUAY.landing.x,y:500},{x:HIGHMERE_QUAY.landing.x,y:1900}]},
  {id:'royal-garden-walk',width:104,surface:'stone',points:HIGHMERE_ROYAL_WALK.map(p=>({...p}))},
  {id:'royal-east-garden-walk',width:72,surface:'stone',points:HIGHMERE_ROYAL_WALK.map(p=>({x:-p.x,y:p.y}))},
];
