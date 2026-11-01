import {SETTLEMENT_BY_ID} from './settlements';
import {capitalTrade,type CapitalTrade} from './highmereStreetStyle';
/** Existing business labels own identity. No new inventory, service or lot. */
function labelledTrade(label:string):CapitalTrade|undefined {
 const s=label.toLowerCase();
 const rules:readonly [RegExp,CapitalTrade][]=[
  [/armou?r|weapon|bowyer|fletcher|harpoon/,'armorer'],[/forge|smith|farrier|chainworks/,'smith'],
  [/barracks|headquarters|watch house|garrison|knight|sentry/,'barracks'],[/castle|citadel|palace|crown|royal hall/,'crown'],
  [/temple|chapel|shrine|hospitaller/,'chapel'],[/archive|library|school|charter/,'bookseller'],
  [/bakery|baker|kitchen|oven/,'bakery'],[/inn\b|tavern|teahouse|tea house|cafe|café/,'tavern'],
  [/cloth|weaver|dyer|tailor|canvas|leather|tannery/,'clothier'],[/stable|corral|saddle/,'stable'],
  [/herb|apothecary|healer|gardenkeeper/,'herbalist'],[/carpenter|wainwright|boatwright|shipwright|boughcraft/,'carpenter'],
  [/mason|stonecut/,'mason'],[/granary|storehouse|warehouse|provision|grain|fish camp/,'provisions'],
  [/market|merchant|counting|exchange|customs|trader/,'merchant'],[/guild/,'guild'],
 ];
 return rules.find(([pattern])=>pattern.test(s))?.[1];
}
export const SETTLEMENT_TRADE_SIGNS:Readonly<Record<string,CapitalTrade>>=Object.fromEntries(
 Object.values(SETTLEMENT_BY_ID).flatMap(layout=>layout.buildings.flatMap((lot,i)=>{
  if(lot.omitted)return [];
  const id=`town:${layout.townId}:building:${i}`,trade=capitalTrade(id)??labelledTrade(lot.label);
  return trade?[[id,trade]]:[];
 })));
export function settlementTrade(id:string){return SETTLEMENT_TRADE_SIGNS[id];}
