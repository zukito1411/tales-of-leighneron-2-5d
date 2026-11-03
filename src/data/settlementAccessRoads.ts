import type {Vec2} from '../game/types';
import {TOWN_BY_ID} from './towns';
import {TOWER_DOOR} from './towerOfMight';
import {ASHEN_DOCK_ROAD} from './ports';
import {BLACKSPIRE_LAIR_ROADS,DRAGON_LAIR_TRAIL} from './dragonLair';
import {settlementEnvelope} from './settlementPlanning';
import {ROAD_ROUTES} from './roadRoutes';

export interface SettlementAccessRoad {
  id:string;townId:string;width:number;points:Vec2[];surface:'stone'|'dirt';
}
const oak=TOWN_BY_ID.oakmere.world,black=TOWN_BY_ID.blackspire.world;
const localOak=(x:number,y:number):Vec2=>({x:oak.x+x,y:oak.y+y});
/** Existing service/quest corridors participate in the same wall survey as
 * regional roads. These reference the original dock/lair coordinates and IDs
 * rather than introducing a second route or moving their quest destinations. */
export const SETTLEMENT_ACCESS_ROADS:readonly SettlementAccessRoad[]=[
  {id:'tower-town-link',townId:'oakmere',width:64,surface:'dirt',
    // Join the work lane west of the shrine. A straight road north from the
    // square would run through its existing building and tended grove.
    points:[oak,localOak(-550,0),localOak(-550,-120),localOak(-550,-900),localOak(0,-900),localOak(0,-1200)]},
  {id:'tower-approach',townId:'oakmere',width:130,surface:'dirt',
    points:[localOak(0,-1200),{x:TOWER_DOOR.x,y:TOWER_DOOR.y+100}]},
  {id:'ashen-dock',townId:'blackspire',width:96,surface:'dirt',points:ASHEN_DOCK_ROAD},
  ...BLACKSPIRE_LAIR_ROADS.map((points,index):SettlementAccessRoad=>({id:'lair-access:'+index,townId:'blackspire',width:88,surface:'dirt',points:[black,...points]})),
  {id:'lair-trail',townId:'blackspire',width:88,surface:'dirt',
    // The upper connector is a real junction on the long eastern trail.
    points:[DRAGON_LAIR_TRAIL[0],DRAGON_LAIR_TRAIL[1],BLACKSPIRE_LAIR_ROADS[1].at(-1)!,...DRAGON_LAIR_TRAIL.slice(2)]},
];

/** Clip only the settlement's road reservation to a bounded preload apron.
 * The global painted trails keep their original full lengths and geometry. */
export function settlementAccessStreets(townId:string){
  const town=TOWN_BY_ID[townId],bounds=settlementEnvelope(town),margin=320;
  const result:Array<{id:string;width:number;surface:'stone'|'dirt';points:Vec2[]}>=[];
  const roads=[...SETTLEMENT_ACCESS_ROADS.filter(road=>road.townId===townId),
    ...ROAD_ROUTES.filter(road=>road.from!==townId&&road.to!==townId)];
  for(const road of roads){
    for(let i=1;i<road.points.length;i++){
      const a={x:road.points[i-1].x-town.world.x,y:road.points[i-1].y-town.world.y};
      const b={x:road.points[i].x-town.world.x,y:road.points[i].y-town.world.y},dx=b.x-a.x,dy=b.y-a.y;
      let lo=0,hi=1;
      for(const [start,delta,min,max] of [[a.x,dx,bounds.left-margin,bounds.right+margin],[a.y,dy,bounds.top-margin,bounds.bottom+margin]]){
        if(Math.abs(delta)<.00001){if(start<min||start>max){hi=-1;break;}}
        else{const t0=(min-start)/delta,t1=(max-start)/delta;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));}
      }
      if(hi<lo||Math.hypot(dx,dy)*(hi-lo)<1)continue;
      result.push({id:'service-access:'+road.id+':'+i,width:road.width,surface:road.surface,
        points:[{x:a.x+dx*lo,y:a.y+dy*lo},{x:a.x+dx*hi,y:a.y+dy*hi}]});
    }
  }
  return result;
}
