import {CASTLE_GUARD_POSTS} from './castleResidents';

/** Shared indoor residency, independent of exterior placement and content loading. */
export const INTERIOR_ASSIGNMENTS:Array<[string,string]>=[
  ['sena-marrow','Marrow Inn'],['joren-pike','Pike Smithy'],['torren-ashfield','West Cottages'],
  ['renna-vale','Royal Archive'],['lady-adria-vale','Crown Hall'],['barric-thorne','West Barracks'],
  ['maela-quill','Market Hall'],['osric-flint','Guild Forge'],['tamsin-reed','Westgate Inn'],
  ['davin-bridge','River Customs'],['sevrin-hale','Counting House'],['mairin-reed','Morrow Kitchen'],
  ['nella-harrow','Weavers Row'],['iven-harrow','Relief Warehouse'],['bela-reed','Caravan Inn'],
  ['elarion-king','Whitebough Hall'],['elarion-lorekeeper','Lore Archive'],['elarion-bowyer','Bowyer Hall'],
  ['moonfall-herbalist','Herbalist Cottage'],['dael-vale','Grove House'],
  ['starhold-quartermaster','Quartermaster Stores'],['redmesa-forgewright','Clan Forge'],
  ['deepford-runesmith','Hall Archive'],['deepford-boatwright','Boatwright Hall'],
  ['tidewatch-harbor-master','Harbor Guild'],['tidewatch-sailmaker','Sailmaker House'],
  ['skallheim-trader','Fish Traders Hall'],['blackspire-forgemaster','Forge Hall'],
  ['elarion-hall-guard-west','Whitebough Hall'],['elarion-hall-guard-east','Whitebough Hall'],
  ...CASTLE_GUARD_POSTS.map(post=>[post.npcId,post.building] as [string,string]),
];
