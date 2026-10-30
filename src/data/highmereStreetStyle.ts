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

/** Row-major cells in the versioned, painted trade-emblem atlas. */
export const CAPITAL_TRADE_TILES={tavern:0,bakery:1,clothier:2,smith:3,armorer:4,guild:5,barracks:6,
 merchant:7,herbalist:8,bookseller:9,stable:10,provisions:11,carpenter:12,mason:13,chapel:14,crown:15} as const;
export type CapitalTrade=keyof typeof CAPITAL_TRADE_TILES;
const TRADE_SLOTS:Readonly<Partial<Record<number,CapitalTrade>>>={
 0:'barracks',1:'crown',2:'bookseller',3:'barracks',4:'stable',5:'bookseller',6:'barracks',7:'provisions',8:'merchant',9:'merchant',
 10:'tavern',12:'chapel',13:'barracks',14:'smith',15:'carpenter',18:'smith',19:'provisions',20:'barracks',21:'armorer',
 23:'clothier',24:'provisions',27:'bakery',30:'bookseller',32:'stable',33:'provisions',
 86:'clothier',87:'merchant',88:'provisions',89:'smith',90:'bakery',91:'guild',92:'clothier',93:'herbalist',
 94:'bookseller',95:'herbalist',96:'chapel',97:'chapel',98:'herbalist',99:'herbalist',
};
export function capitalTrade(id:string):CapitalTrade|undefined{
 const prefix='town:highmere:building:';
 return id.startsWith(prefix)?TRADE_SLOTS[Number(id.slice(prefix.length))]:undefined;
}
