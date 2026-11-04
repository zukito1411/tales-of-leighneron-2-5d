import type {Rect} from './settlementGeometry';

export interface SettlementPasture {
 id:string;townId:string;x:number;y:number;width:number;height:number;terrain:'grass'|'dirt';
}
/** Admitted once against final content, before any streamed chunk is baked.
 * Workers receive this same small survey, rather than rerunning placement. */
export const SETTLEMENT_PASTURES:SettlementPasture[]=[];
const cells=new Map<string,SettlementPasture[]>(),CELL=512;
export function pastureBounds(p:SettlementPasture):Rect {
 return {left:p.x-p.width/2,right:p.x+p.width/2,top:p.y-p.height/2,bottom:p.y+p.height/2};
}
export function registerSettlementPasture(p:SettlementPasture){
 if(SETTLEMENT_PASTURES.some(old=>old.id===p.id))return;
 SETTLEMENT_PASTURES.push(p);const r=pastureBounds(p);
 for(let y=Math.floor(r.top/CELL);y<=Math.floor(r.bottom/CELL);y++)for(let x=Math.floor(r.left/CELL);x<=Math.floor(r.right/CELL);x++){
  const key=x+':'+y,list=cells.get(key)??[];list.push(p);cells.set(key,list);
 }
}
export function settlementPastureAt(x:number,y:number){
 for(const p of cells.get(Math.floor(x/CELL)+':'+Math.floor(y/CELL))??[])
  if(Math.abs(x-p.x)<=p.width/2&&Math.abs(y-p.y)<=p.height/2)return p;
}
