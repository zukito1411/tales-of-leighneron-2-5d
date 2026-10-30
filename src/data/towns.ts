import type { TownDefinition } from '../game/types';
import { chunkCenter } from './world';
import { ATLAS_TOWNS,ATLAS_WIDTH,ATLAS_HEIGHT } from './mapSurvey';

const place = (chunkX: number, chunkY: number, dx = 0, dy = 0) => {
  const center = chunkCenter(chunkX, chunkY);
  return { x: center.x + dx, y: center.y + dy };
};

export const TOWNS: TownDefinition[] = [
  {
    id: 'oakmere', name: 'Oakmere', regionId: 'trandum', kind: 'village', world: place(22, 25), mapPercent: { x: 28, y: 33 },
    description: 'Leigneron’s home village: farms, an old roadside shrine, a smithy, an inn, and the west road.',
    services: ['Inn', 'Blacksmith', 'General Store', 'Shrine'], tags: ['starter', 'farmland', 'road'], starterKnown: true,
  },
  {
    id: 'highmere', name: 'Highmere', regionId: 'trandum', kind: 'capital', world: place(31, 22), mapPercent: { x: 33, y: 28 },
    description: 'The kingdom capital: circular limestone ramparts, a raised royal citadel, noble and temple terraces, markets, working households and riverside farmsteads.',
    services: ['Castle', 'Guild Hall', 'Market', 'Smiths', 'Stables'], tags: ['capital', 'human'], starterKnown: true,
  },
  {
    id: 'willowcross', name: 'Willowcross', regionId: 'trandum', kind: 'town', world: place(40, 25), mapPercent: { x: 41, y: 31 },
    description: 'A bridge town where the eastern royal road begins climbing toward Narenthil and Nardorous.',
    services: ['Inn', 'Stable', 'Fletcher'], tags: ['bridge', 'road'], starterKnown: true,
  },
  {
    id: 'elarion', name: 'Elarion', regionId: 'narenthil', kind: 'capital', world: place(56, 16), mapPercent: { x: 54, y: 21 },
    description: 'A white-stone city woven into ancient living trees and high forest bridges.',
    services: ['Lore Hall', 'Bowyer', 'Herbalist', 'Waystone'], tags: ['capital', 'elven'],
  },
  {
    id: 'moonfall', name: 'Moonfall Grove', regionId: 'narenthil', kind: 'village', world: place(62, 22), mapPercent: { x: 58, y: 28 },
    description: 'A quiet settlement protecting a moonlit grove and a line of ancient standing stones.',
    services: ['Herbalist', 'Ranger Lodge'], tags: ['forest', 'mythic'],
  },
  {
    id: 'starhold', name: 'Starhold', regionId: 'nardorous', kind: 'capital', world: place(80, 27), mapPercent: { x: 71, y: 31 },
    description: 'A mountain citadel overlooking snowy switchbacks and fortified bridges.',
    services: ['Armorer', 'Mountaineers', 'Temple', 'Caravan Yard'], tags: ['capital', 'mountain'],
  },
  {
    id: 'redmesa', name: 'Red Mesa', regionId: 'rindass', kind: 'stronghold', world: place(79, 50), mapPercent: { x: 68, y: 48 },
    description: 'A vast orcan stronghold surrounded by clan camps, livestock pens, and fighting grounds.',
    services: ['Clan Hall', 'Forge', 'Beastmaster', 'Market Camp'], tags: ['capital', 'orcan'],
  },
  {
    id: 'deepford', name: 'Deepford', regionId: 'druganwoods', kind: 'capital', world: place(58, 62), mapPercent: { x: 54, y: 62 },
    description: 'A dwarven river-hall where bridges, mills, mines, and workshops meet.',
    services: ['Runesmith', 'Mine Guild', 'Boatwright', 'Inn'], tags: ['capital', 'dwarven'],
  },
  {
    id: 'tidewatch', name: 'Tidewatch', regionId: 'portquill', kind: 'harbor', world: place(27, 70), mapPercent: { x: 31, y: 73 },
    description: 'Portquill’s largest harbor, crowded with explorers, fishing fleets, merchants, and smugglers.',
    services: ['Shipyard', 'Market', 'Harbor Guild', 'Inn'], tags: ['capital', 'harbor'],
  },
  {
    id: 'skallheim', name: 'Skallheim', regionId: 'frostlands', kind: 'harbor', world: place(99, 70), mapPercent: { x: 82, y: 70 },
    description: 'A fortified frost harbor of longhouses, fish camps, watch beacons, and reindeer pens.',
    services: ['Longhouse', 'Hunter Lodge', 'Harpooner', 'Trader'], tags: ['capital', 'frost'],
  },
  {
    id: 'blackspire', name: 'Blackspire', regionId: 'darkav', kind: 'capital', world: place(105, 10), mapPercent: { x: 82, y: 12 },
    description: 'Darkav’s obsidian citadel, lit by forges and lava channels beneath an active volcanic peak.',
    services: ['Forge Hall', 'Citadel', 'Black Dock', 'Cult Quarter'], tags: ['capital', 'volcanic'],
  },
];

TOWNS.push({id:'cibar-plains',name:'Cibar Plains',regionId:'druganwoods',kind:'town',world:place(66,66),mapPercent:{x:0,y:0},
  description:'Druganwoods’ southern grain country: irrigation channels, family farms and a caravan market serving the river-halls.',
  services:['Grain Exchange','Smithy','Inn','Shrine'],tags:['plains','farmland','river-trade']});
for(const town of TOWNS){const pixel=ATLAS_TOWNS[town.id];town.mapPercent={x:pixel[0]/ATLAS_WIDTH*100,y:pixel[1]/ATLAS_HEIGHT*100};}
export const TOWN_BY_ID = Object.fromEntries(TOWNS.map((town) => [town.id, town])) as Record<string, TownDefinition>;

export const ROAD_CONNECTIONS: Array<[string, string]> = [
  ['oakmere', 'highmere'],
  ['highmere', 'willowcross'],
  ['willowcross', 'elarion'],
  ['elarion', 'moonfall'],
  ['moonfall', 'starhold'],
  ['willowcross', 'starhold'],
  ['starhold', 'redmesa'],
  ['redmesa', 'deepford'],
  ['deepford', 'highmere'],
  ['deepford','cibar-plains'],
];
