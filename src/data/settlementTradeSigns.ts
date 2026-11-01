import {SETTLEMENT_BY_ID} from './settlements';
import {capitalTrade,type CapitalTrade} from './highmereStreetStyle';
/** Existing business labels own identity. No new inventory, service or lot. */
function labelledTrade(label:string):CapitalTrade|undefined {
 const s=label.toLowerCase();
 // Neighborhood names describe residents too; a weavers' ward is not a
 // clothing shop on every lot. Keep dedicated trade houses and civic houses.
 if(/\b(?:upper|lower) house\b|\bhomes?\b/.test(s))return;
 const rules:readonly [RegExp,CapitalTrade][]=[
  [/armou?r|weapon|bowyer|fletcher|harpoon/,'armorer'],[/forge|smith|farrier|chainworks/,'smith'],
  [/barracks|headquarters|watch|garrison|knight|sentry|signal tower/,'barracks'],[/castle|citadel|palace|crown|royal hall|whitebough hall|clan assembly hall|great river hall|bridgekeeper hall/,'crown'],
  [/temple|chapel|shrine|hospitaller/,'chapel'],[/archive|library|school|charter/,'bookseller'],
  [/bakery|baker|kitchen|oven/,'bakery'],[/inn\b|tavern|teahouse|tea house|cafe|café/,'tavern'],
  [/cloth|weaver|dyer|tailor|canvas|leather|tannery/,'clothier'],[/stable|corral|saddle/,'stable'],
  [/herb|apothecary|healer|gardenkeeper/,'herbalist'],[/carpenter|wainwright|boatwright|shipwright|boughcraft/,'carpenter'],
  [/mason|stonecut/,'mason'],[/granary|\bstores?\b|storehouse|warehouse|provision|grain|fish camp/,'provisions'],
  [/market|merchant|counting|exchange|customs|trad(?:e|er)/,'merchant'],[/rider lodge/,'stable'],[/ranger lodge|hunters? lodge|guild/,'guild'],[/chainwright|furnace.*workshop/,'smith'],[/workshop/,'carpenter'],
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
