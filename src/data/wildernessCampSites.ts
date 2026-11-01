import {StaticBoundsIndex} from '../game/systems/StaticBoundsIndex';
import type {Rect} from './settlementGeometry';
import type {RegionId,Vec2} from '../game/types';
export type WildernessCampKind='adventurer'|'knight'|'hostile';
export interface WildernessCampSite extends Vec2 {id:string;region:RegionId;kind:WildernessCampKind;bounds:Rect}
export const WILDERNESS_CAMPS:WildernessCampSite[]=[];
const sites=new StaticBoundsIndex<WildernessCampSite>([]);
const point={left:0,right:0,top:0,bottom:0};
export function registerWildernessCamp(site:WildernessCampSite){WILDERNESS_CAMPS.push(site);sites.add(site);}
export function wildernessCampReservations(bounds:Rect){return sites.query(bounds).map(site=>({x:site.x,y:site.y,bounds:site.bounds}));}
/** Friendly clearings exclude ambient hostile spawning and hostile feet. */
export function friendlyCampAt(x:number,y:number){
 const p=point;p.left=x-.01;p.right=x+.01;p.top=y-.01;p.bottom=y+.01;
 return sites.any(p,s=>s.kind!=='hostile'&&Math.hypot(x-s.x,y-s.y)<500);
}
