import {HIGHMERE_QUAY} from './highmerePlan';
import {TOWN_BY_ID} from './towns';
import {DRAINAGE} from './worldLandscape';
import type {Vec2} from '../game/types';

export interface Port {id:string;name:string;townId:string;landing:Vec2;quay:Vec2;boat:Vec2;channel:Vec2[];river:boolean;description:string}
const h=TOWN_BY_ID.highmere.world;
const capitalPoint=(p:Vec2)=>({x:h.x+p.x,y:h.y+p.y});
const capitalBoat=capitalPoint(HIGHMERE_QUAY.boat);
const downstream=DRAINAGE[0].points.findIndex(p=>p.x===capitalBoat.x&&p.y>capitalBoat.y);
const island=(id:string):Port=>{
 const t=TOWN_BY_ID[id].world,boat={x:t.x+915,y:t.y+1180},landing={x:t.x+700,y:t.y+825};
 return {id,name:id==='tidewatch'?'Tidewatch Harbor':'Skallheim Harbor',townId:id,
  landing,quay:{...landing},boat,channel:[boat,{x:boat.x,y:t.y+23000}],river:false,
  description:id==='tidewatch'?'The harbor crews carry grain, travelers and warnings across the sea.':'The beacon fleet keeps a passage open through the southern ice bay.'};
};
export const PORTS:Port[]=[
 {id:'highmere',name:'Highmere River Quay',townId:'highmere',landing:capitalPoint(HIGHMERE_QUAY.landing),quay:capitalPoint(HIGHMERE_QUAY.quay),boat:capitalBoat,
  channel:[capitalBoat,...DRAINAGE[0].points.slice(downstream)],river:true,
  description:'Outside Eastgate, follow the paved west-bank promenade south to the Crown River packet. The quay carries passengers to the islands and Ashen Landing.'},
 island('tidewatch'),island('skallheim'),
 {id:'blackspire',name:'Ashen Landing · Darkav',townId:'blackspire',landing:{x:162048,y:27616},quay:{x:162048,y:27616},boat:{x:162263,y:27976},
  channel:[{x:162263,y:27976},{x:162048,y:28744}],river:false,
  description:'The basalt shore is safe to land on. Follow the marked ash road north to Blackspire and the forge.'},
];
export const PORT_BY_ID=Object.fromEntries(PORTS.map(p=>[p.id,p])) as Record<string,Port>;
export interface PortDeckRect {left:number;right:number;back:number;front:number}
// One survey for the solid deck geometry and walkability, relative to the quay.
const COASTAL_DECK:readonly PortDeckRect[]=[{left:-24,right:24,back:-10,front:244},{left:-99,right:99,back:244,front:277}];
const RIVER_DECK:readonly PortDeckRect[]=[{left:-76,right:76,back:-28,front:28}];
export function portDeckRects(river:boolean){return river?RIVER_DECK:COASTAL_DECK;}
/** Walk only the actual deck, leaving surrounding water intact. */
export function onPortDeck(x:number,y:number){
 return PORTS.some(port=>{
  const dx=x-port.quay.x,dy=y-port.quay.y;
  return portDeckRects(port.river).some(r=>dx>=r.left&&dx<=r.right&&dy>=r.back&&dy<=r.front);
 });
}
export const ASHEN_DOCK_ROAD=[TOWN_BY_ID.blackspire.world,{x:162048,y:TOWN_BY_ID.blackspire.world.y+2500},{x:162048,y:27616}];
