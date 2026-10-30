/** Presentation-only identities. Existing IDs, lots, doorways and services stay
 * authoritative; these are not new shop inventories or interior replacements. */
export type CapitalShopStyle='cafe'|'clothier'|'armorer'|'guild'|'herbalist'|'bakery'|'provisions'|'bookseller';
export const CAPITAL_SHOPFRONTS:Readonly<Record<string,CapitalShopStyle>>={
 'town:highmere:building:2':'bookseller',
 'town:highmere:building:7':'provisions',
 'town:highmere:building:10':'cafe',
 'town:highmere:building:14':'armorer',
 'town:highmere:building:15':'guild',
 'town:highmere:building:21':'armorer',
 'town:highmere:building:23':'clothier',
 'town:highmere:building:27':'bakery',
 'town:highmere:building:86':'clothier',
 'town:highmere:building:87':'guild',
 'town:highmere:building:88':'provisions',
 'town:highmere:building:90':'bakery',
 'town:highmere:building:91':'guild',
 'town:highmere:building:92':'clothier',
 'town:highmere:building:93':'herbalist',
};
export type CapitalPropStyle='cafe-table'|'cafe-chair'|'flower-pot'|'arms-rack'|'cloth-counter'
  |'produce-stall'|'cloth-stall'|'herb-stall'|'tools-stall'|'bread-stall'|'book-stall';
const STALL_STOCK:readonly CapitalPropStyle[]=['cloth-stall','produce-stall','herb-stall','tools-stall','herb-stall','bread-stall'];
export function capitalPropStyle(id:string):CapitalPropStyle|undefined{
 const prefix='detail:highmere:streetlife:';
 if(id.startsWith(prefix)){const kind=id.slice(prefix.length).split(':')[0];
  return (['cafe-table','cafe-chair','flower-pot','arms-rack','cloth-counter','produce-stall','cloth-stall','herb-stall','tools-stall','bread-stall','book-stall'] as const).find(style=>style===kind);
 }
 if(id.startsWith('detail:highmere:capital:market:-1:'))return STALL_STOCK[Number(id.split(':').at(-1))%STALL_STOCK.length];
 return undefined;
}
