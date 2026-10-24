import {TOWN_BY_ID} from './towns';
import type {ContentDefinition,Vec2} from '../game/types';

/** Measured against ship.png (1024x1536). Bow north, eastern boarding plank. */
export const FLAGSHIP={id:'pirate:flagship',scale:1.3,width:1024,height:1536,
  topLeft:{x:TOWN_BY_ID.tidewatch.world.x+1000,y:TOWN_BY_ID.tidewatch.world.y+1700}};
export const shipPoint=(x:number,y:number):Vec2=>({x:FLAGSHIP.topLeft.x+x*FLAGSHIP.scale,y:FLAGSHIP.topLeft.y+y*FLAGSHIP.scale});
/** Shared art/model hull survey; gameplay keeps the existing inner deck. */
export const FLAGSHIP_HULL:readonly (readonly [number,number])[]=[[414,172],[490,228],[546,354],[615,510],[677,705],[690,1030],[650,1300],
  [574,1438],[414,1514],[255,1440],[167,1296],[126,1090],[129,825],[171,553],[259,314],[351,199]];
export const SALT_KING_DECK_HOME=shipPoint(410,910);
export function isFlagshipCombatant(id:string,encounterKey?:string|null,home?:Vec2){
  return id==='boss:salt-king'||id.startsWith('pirate:flagship:crew:')
    ||Boolean(encounterKey?.startsWith('encounter:')&&home&&onFlagshipDeck(home.x,home.y));
}
export const FLAGSHIP_DECK:readonly Vec2[]=[{x:385,y:260},{x:485,y:320},{x:565,y:480},{x:605,y:700},
  {x:620,y:835},{x:600,y:970},{x:215,y:970},{x:205,y:850},{x:235,y:660},{x:300,y:420}];
export const FLAGSHIP_GANGPLANK={left:590,right:1000,top:780,bottom:834};
export const FLAGSHIP_OBSTACLES=[{left:366,right:457,top:577,bottom:657}];
const local=(x:number,y:number)=>({x:(x-FLAGSHIP.topLeft.x)/FLAGSHIP.scale,y:(y-FLAGSHIP.topLeft.y)/FLAGSHIP.scale});
function inPolygon(p:Vec2,polygon:readonly Vec2[]){
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j];
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}
const inRect=(p:Vec2,r:{left:number;right:number;top:number;bottom:number},margin=0)=>
  p.x>=r.left-margin&&p.x<=r.right+margin&&p.y>=r.top-margin&&p.y<=r.bottom+margin;
const left=FLAGSHIP.topLeft.x,top=FLAGSHIP.topLeft.y,scale=FLAGSHIP.scale;
export function onFlagshipDeck(x:number,y:number){
  if(x<left+205*scale||x>left+620*scale||y<top+260*scale||y>top+970*scale)return false;
  return inPolygon(local(x,y),FLAGSHIP_DECK);
}
export function onFlagshipBoarding(x:number,y:number){
  // Terrain baking calls this globally: reject distant samples before creating
  // points or visiting polygon edges. Detailed work stays local to one ship.
  if(x<left+205*scale||x>left+1000*scale||y<top+260*scale||y>top+970*scale)return false;
  return onFlagshipDeck(x,y)||inRect(local(x,y),FLAGSHIP_GANGPLANK);
}
export function flagshipObstacle(x:number,y:number,margin=10){return FLAGSHIP_OBSTACLES.some(r=>inRect(local(x,y),r,margin/FLAGSHIP.scale));}
export function flagshipFootprint(x:number,y:number){return x>=left+120*scale&&x<=left+1018*scale&&y>=top+200*scale&&y<=top+1500*scale;}
export function flagshipWalkable(x:number,y:number,radius=10){
  return !flagshipObstacle(x,y,radius)&&[[0,0],[-radius,0],[radius,0],[0,-radius],[0,radius]].every(([dx,dy])=>{
    if(onFlagshipBoarding(x+dx,y+dy))return true;
    const p=local(x+dx,y+dy);
    // The eastern end lands well beyond the surveyed bay edge. Do not make
    // a body-radius-sized invisible gap where the plank joins dry beach.
    return p.x>=FLAGSHIP_GANGPLANK.right&&p.x<=FLAGSHIP_GANGPLANK.right+12
      &&p.y>FLAGSHIP_GANGPLANK.top&&p.y<FLAGSHIP_GANGPLANK.bottom;
  });
}
const NAV_NODES=[[310,860],[535,860],[310,700],[535,700],[310,515],[510,515],[410,380],[410,860],[595,805]].map(([x,y])=>shipPoint(x,y));
const deckLine=(a:Vec2,b:Vec2)=>{
  const steps=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/16));
  for(let i=0;i<=steps;i++){
    const x=a.x+(b.x-a.x)*i/steps,y=a.y+(b.y-a.y)*i/steps;
    if(!onFlagshipDeck(x,y)||!flagshipWalkable(x,y))return false;
  }
  return true;
};
// Nine fixed nodes; no full-world pathfinding or per-frame graph construction.
const edges=NAV_NODES.map((a,i)=>NAV_NODES.flatMap((b,j)=>i!==j&&deckLine(a,b)?[j]:[]));
export function flagshipNavigation(from:Vec2,target:Vec2):Vec2{
  if(deckLine(from,target))return target;
  const starts=NAV_NODES.map((p,i)=>({p,i,d:Math.hypot(p.x-from.x,p.y-from.y)}))
    .filter(n=>deckLine(from,n.p)).sort((a,b)=>a.d-b.d);
  const goal=NAV_NODES.map((p,i)=>({i,d:Math.hypot(p.x-target.x,p.y-target.y)})).sort((a,b)=>a.d-b.d)[0].i;
  if(!starts.length)return from;
  const queue=[starts[0].i],previous=new Map<number,number>([[queue[0],-1]]);
  for(let index=0;index<queue.length&&!previous.has(goal);index++)for(const next of edges[queue[index]]){
    if(previous.has(next))continue;previous.set(next,queue[index]);queue.push(next);
  }
  if(!previous.has(goal))return starts[0].p;
  const route=[goal];while(previous.get(route[0])!==-1)route.unshift(previous.get(route[0])!);
  return NAV_NODES[route[Math.hypot(starts[0].p.x-from.x,starts[0].p.y-from.y)<24&&route.length>1?1:0]];
}
export const FLAGSHIP_CONTENT:ContentDefinition[]=[{id:FLAGSHIP.id,kind:'prop',texture:'pirate_flagship',frame:0,
  world:shipPoint(512,768),scale:FLAGSHIP.scale,anchor:'center',solid:false,streamRadiusChunks:2,label:'The Salt King’s Flagship'},
  ...[[310,860],[535,860],[310,700],[535,700],[410,380]].map(([x,y],slot):ContentDefinition=>({
    id:`pirate:flagship:crew:${slot}`,kind:'creature',enemyId:slot===1||slot===3?'pirate-boatswain':'cutlass-pirate',world:shipPoint(x,y),
    encounterId:'pirate-flagship',encounterBehavior:{home:shipPoint(410,720),station:shipPoint(x,y),
      leashRadius:1400,role:slot===1||slot===3?'heavy':slot===0?'leader':'melee',slot},
  })),
];
