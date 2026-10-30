import { TOWN_BY_ID } from './towns';
import {ROAD_ROUTES} from './roadRoutes';
import {DRAINAGE,pathDistance} from './worldLandscape';
import {onStoneBridgeDeck,stoneBridgeApproachSpan,stoneBridgeScale,royalBridgeRailBlocksPath,ROYAL_BRIDGE_WALK_INSET} from './bridgeDeck';
import {CHUNK_SIZE} from './world';
import {HIGHMERE_PLAN} from './highmerePlan';

const highmere = TOWN_BY_ID.highmere.world;

// The capital's river skirts its eastern/southern ramparts. The broad eastern bank
// crossing and the southern gate bridge share artwork and navigation surveys.
export const HIGHMERE_RIVER = {
  width:168,
  points:DRAINAGE[0].points,
  bridgeY:[...HIGHMERE_PLAN.bridgeY],
};
export const HIGHMERE_BRIDGE_POINTS=HIGHMERE_RIVER.bridgeY.map(crossing=>{
  const y=highmere.y+crossing;
  for(let i=1;i<HIGHMERE_RIVER.points.length;i++){
    const a=HIGHMERE_RIVER.points[i-1],b=HIGHMERE_RIVER.points[i];
    if(y<Math.min(a.y,b.y)||y>Math.max(a.y,b.y)||a.y===b.y)continue;
    return {x:a.x+(b.x-a.x)*(y-a.y)/(b.y-a.y),y};
  }
  throw new Error('Highmere bridge is outside its surveyed river.');
});

export function highmereRiverDistance(x:number,y:number) {
  return pathDistance(x,y,HIGHMERE_RIVER.points,700);
}

export function onHighmereRiver(x:number,y:number) {
  return highmereRiverDistance(x,y) <= HIGHMERE_RIVER.width / 2;
}

export function onHighmereBridge(x:number,y:number) {
  return bridgeCandidates(x,y).some(p=>!p.wilderness&&onStoneBridgeDeck(x,y,p.x,p.y,p.scale,p.heading,ROYAL_BRIDGE_WALK_INSET));
}

// Continue local river reaches beyond the town survey; never end a river at
// a settlement/chunk boundary. The distant pools are provisional headwaters.
export const SETTLEMENT_RIVERS=[
  {townId:'willowcross',x:600,width:120,halfHeight:1150},
  {townId:'deepford',x:450,width:144,halfHeight:1450},
].map(r=>{
  const points=DRAINAGE[r.townId==='willowcross'?1:2].points;
  return {...r,points};
});
export function onSettlementRiver(x:number,y:number) {
  return SETTLEMENT_RIVERS.some(r=>pathDistance(x,y,r.points,700)<=r.width/2);
}
export const WILDERNESS_BRIDGES=ROAD_ROUTES.flatMap(r=>r.crossings.map((p,i)=>({...p,id:`bridge:road:${r.id}:${i}`})));
export const HIGHMERE_BRIDGE_SCALE=stoneBridgeScale(HIGHMERE_RIVER.width,HIGHMERE_PLAN.bridgeClearWidth);
export const HIGHMERE_MAIN_BRIDGE={x:highmere.x+HIGHMERE_PLAN.mainBridge.x,y:highmere.y+HIGHMERE_PLAN.mainBridge.y,
  scale:HIGHMERE_BRIDGE_SCALE,heading:Math.PI/2};
type BridgeSurvey={x:number;y:number;scale:number;wilderness:boolean;heading?:number};
const bridgeCells=new Map<string,BridgeSurvey[]>();
const bridgeSurveys:BridgeSurvey[]=[...HIGHMERE_BRIDGE_POINTS.map(p=>({...p,scale:HIGHMERE_BRIDGE_SCALE,wilderness:false})),
  {...HIGHMERE_MAIN_BRIDGE,wilderness:false},
  ...WILDERNESS_BRIDGES.map(p=>({...p,wilderness:true}))];
for(const p of bridgeSurveys){
  const span=stoneBridgeApproachSpan(p.scale),rotated=Math.abs(Math.sin(p.heading??0))>.5;
  const half=rotated?180:span,height=rotated?span:Math.max(180,HIGHMERE_PLAN.bridgeClearWidth/2+32);
  for(let cy=Math.floor((p.y-height)/CHUNK_SIZE);cy<=Math.floor((p.y+height)/CHUNK_SIZE);cy++)
    for(let cx=Math.floor((p.x-half)/CHUNK_SIZE);cx<=Math.floor((p.x+half)/CHUNK_SIZE);cx++){
      const key=cx+':'+cy,list=bridgeCells.get(key)??[];list.push(p);bridgeCells.set(key,list);
    }
}
const noBridges:readonly BridgeSurvey[]=[];
function bridgeCandidates(x:number,y:number):readonly BridgeSurvey[]{
  return bridgeCells.get(Math.floor(x/CHUNK_SIZE)+':'+Math.floor(y/CHUNK_SIZE))??noBridges;
}
export function onWildernessBridge(x:number,y:number){return bridgeCandidates(x,y).some(p=>
  p.wilderness&&onStoneBridgeDeck(x,y,p.x,p.y,p.scale));}

export function highmereBridgeRailsBlock(from:{x:number;y:number},to=from,radius=0){
  for(let y=Math.floor((Math.min(from.y,to.y)-radius)/CHUNK_SIZE);y<=Math.floor((Math.max(from.y,to.y)+radius)/CHUNK_SIZE);y++)
    for(let x=Math.floor((Math.min(from.x,to.x)-radius)/CHUNK_SIZE);x<=Math.floor((Math.max(from.x,to.x)+radius)/CHUNK_SIZE);x++)
      for(const p of bridgeCells.get(x+':'+y)??noBridges)
        if(!p.wilderness&&royalBridgeRailBlocksPath(from,to,p.x,p.y,p.scale,p.heading,radius))return true;
  return false;
}

const bridgePoint={x:0,y:0};
export function highmereBridgeRailBlocksPoint(x:number,y:number,radius=0){
  if(!bridgeCandidates(x,y).some(p=>!p.wilderness))return false;
  bridgePoint.x=x;bridgePoint.y=y;return highmereBridgeRailsBlock(bridgePoint,bridgePoint,radius);
}
