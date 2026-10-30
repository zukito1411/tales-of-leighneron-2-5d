import {highmereFurnishings} from './highmereFurnishings';
import {CAPITAL_BUILDING_SITES,CAPITAL_SHRINE_COURT} from './highmereComposition';
import type { TerrainKind, Vec2, TownDefinition } from '../game/types';
import { TOWNS, TOWN_BY_ID } from './towns';
import { ROAD_ROUTES,roadTouchesRect } from './roadRoutes';
import { spriteBounds, propPlacementBounds, overlaps, rectTouchesStreet, type Rect } from './settlementGeometry';
import { NPCS } from './npcs';
import {npcExteriorAnchors,npcStandingReservation} from './npcPositions';
import { TOWN_SHRINE_BY_ID } from './townShrines';
import { onHighmereRiver,onHighmereBridge,onWildernessBridge,onSettlementRiver } from './rivers';
import { SETTLEMENT_PROFILES, type SettlementProfile, type SettlementProfileId } from './settlementProfiles';
import {ROYAL_FORTIFICATION_PROPS,fortificationBlocksPath} from './fortifications';
import {StaticBoundsIndex} from '../game/systems/StaticBoundsIndex';
import {SETTLEMENT_DEFENSE_PROPS,DEFENSE_BY_ID,insideDefense} from './settlementDefenses';
import {settlementWardPlan,type WardDetail} from './settlementWards';
import {treeScale,type TreeTexture} from './treeArt';
import {REGION_SCENERY} from './regionScenery';
import {artFrameSize} from './art';
import {architectureMinimumWidth,architectureMinimumScale,architectureProfile} from './architecture';
import {citadelPlanning} from './settlementPlanning';
import {INTERIOR_ASSIGNMENTS} from './interiorAssignments';
import {BUILDING_PRESENTATION_GROWTH} from './environmentPresentation';
import occupancy from './settlementOccupancy.json';
import {coreSettlementDressing} from './settlementDressing';
import type {SettlementCommon} from './settlementCommons';
import {HIGHMERE_AVENUES,HIGHMERE_DISTRICTS,HIGHMERE_PLAN,royalWardOverlaps} from './highmerePlan';
import {civicBoardReserve} from './settlementCivic';
import {HIGHMERE_HOUSEHOLD_COURTS, highmereBoroughPlan} from './highmereBoroughs';
import {onStoneBridgeDeck,stoneBridgeScale} from './bridgeDeck';
import {harborBay,onHeadwaterStream} from './worldLandscape';
import {ELARION_LIFE_TREE_CLEARING,ELARION_LIFE_TREE_LOCAL} from './elarionLifeTree';

export interface LandParcel { id: string; purpose: string; x: number; y: number; width: number; height: number; terrain: TerrainKind }
export interface Street { id: string; width: number; points: Vec2[]; surface?:'stone'|'dirt' }
export interface BuildingLot extends Vec2 { frame: number; scale: number; growth?:number; label: string; purpose: string; frontage?:number; appearance?:{ texture:'world_buildings' | 'capital_buildings' | 'elven_villas'; frame:number }; wardId?:string; plot?:Rect; omitted?:boolean }
export interface Planting extends Vec2 { id: string; frame: number; scale: number; texture?:TreeTexture; purpose: string; wardId?:string }
export interface SettlementLayout {
  townId: string; authored: boolean; profile: SettlementProfile; bounds: LandParcel; baseTerrain: TerrainKind;
  parcels: LandParcel[]; streets: Street[]; buildings: BuildingLot[]; plantings: Planting[];
  pavedStreets?: boolean;
  waterway?: { x:number; width:number; crossings:number[] };
  details?:WardDetail[];
  commons?:SettlementCommon[];
}
export const inParcel = (x: number, y: number, p: LandParcel) => Math.abs(x - p.x) <= p.width / 2 && Math.abs(y - p.y) <= p.height / 2;
export function segmentDistance(x: number, y: number, a: Vec2, b: Vec2) {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length)) : 0;
  return Math.hypot(x - a.x - t * dx, y - a.y - t * dy);
}
export function onStreet(x: number, y: number, street: Street, margin = 0) {
  const radius=street.width/2+margin;if(radius<0)return false;
  for(let i=1;i<street.points.length;i++){
    const a=street.points[i-1],b=street.points[i],dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
    const t=length?Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/length)):0;
    if((x-a.x-dx*t)**2+(y-a.y-dy*t)**2<=radius*radius)return true;
  }
  return false;
}
const street = (id: string, width: number, points: number[][]): Street => ({ id, width, points: points.map(([x,y]) => ({ x,y })) });
const parcel = (id: string, purpose: string, terrain: TerrainKind, x: number, y: number, width: number, height: number): LandParcel => ({ id,purpose,terrain,x,y,width,height });

// The atlas establishes regional land use, not village-level survey coordinates.
// Oakmere is an authored road-and-farm settlement inside Trandum's cleared belt.
const oakmere: SettlementLayout = {
  townId: 'oakmere', authored: true, profile:SETTLEMENT_PROFILES.oakmere,baseTerrain: 'grass',
  bounds: parcel('village-edge','Cleared settlement and agricultural fringe','grass',0,100,2200,2000),
  buildings: [
    { x:350,y:220,frame:1,scale:.98,label:'Marrow Inn',purpose:'Travelers and trade beside the eastern road',appearance:{ texture:'world_buildings',frame:1 } },
    { x:-250,y:-220,frame:0,scale:1,label:'Guard Post',purpose:'Watch the western entrance and crown-road approach',appearance:{ texture:'world_buildings',frame:5 } },
    { x:-430,y:240,frame:0,scale:.98,label:'West Cottages',purpose:'Homes between the village and orchard',appearance:{ texture:'world_buildings',frame:0 } },
    { x:310,y:-205,frame:0,scale:1,label:'Pike Smithy',purpose:'Stone work apron separated from crops and dwellings',appearance:{ texture:'world_buildings',frame:2 } },
    { x:520,y:330,frame:0,scale:.98,label:'Ranger Lodge',purpose:'Eastern edge facing the woodland and hunting route',appearance:{ texture:'world_buildings',frame:0 } },
  ],
  parcels: [
    parcel('square','Central meeting plaza and quest board beside the public crossing','stone',0,150,380,380),
    parcel('shrine-court','Quiet ritual court and keeper forecourt beside the shrine grove','stone',55,-215,240,200),
    parcel('smith-apron','Non-flammable repair and loading surface','stone',270,-105,230,100),
    parcel('caravan-yard','Turn and unload carts near Torren','dirt',-300,35,160,145),
    parcel('training-ground','Open sparring ground beside Aldren','dirt',-140,125,180,145),
    parcel('inn-court','Travelers approach the south-facing inn door','dirt',350,260,260,95),
    parcel('herb-garden','Tended beds beside Mira and the east footpath','farmland',230,150,100,90),
    parcel('orchard','Food trees on the residential/agricultural fringe','grass',-650,195,240,270),
    parcel('farm:oakmere','Cleared crop field with a central access lane','farmland',-630,500,520,288),
    parcel('west-copse','Woodland retained beyond the guard post','forest',-740,-390,280,240),
    parcel('north-copse','Shrine woodland separated from the forge','forest',-100,-520,500,220),
  ],
  streets: [
    street('west-east-road',84,[[-1000,0],[1000,0]]),
    street('shrine-walk',56,[[0,0],[0,-200],[40,-270]]),
    street('south-walk',64,[[0,0],[0,400]]),
    street('training-walk',56,[[0,120],[-120,120],[-180,180]]),
    street('guard-access',56,[[-180,0],[-180,-90],[-250,-90],[-250,-180]]),
    street('west-home-access',56,[[-320,0],[-320,280],[-430,280],[-430,264]]),
    street('smith-access',56,[[240,0],[240,-100],[310,-100],[310,-181]]),
    street('inn-access',56,[[0,260],[170,260],[170,0]]),
    street('inn-frontage',56,[[170,260],[350,260],[350,244]]),
    street('ranger-access',56,[[620,0],[620,370],[520,370],[520,354]]),
    street('farm-lane',64,[[-320,280],[-320,400],[-630,400],[-630,720]]),
  ],
  plantings: [
    { id:'west-oak',x:-380,y:95,frame:0,scale:1.35,purpose:'Gate shade; keep the trunk off the road and the canopy off Torren' },
    { id:'courtyard-oak',x:-250,y:310,frame:0,scale:1.45,purpose:'Shade on the south edge, not over the trainer' },
    { id:'shrine-oak',x:-140,y:-200,frame:0,scale:1.4,purpose:'Separate quiet shrine court from western traffic' },
    { id:'shrine-pine',x:70,y:-340,frame:1,scale:1.4,purpose:'Northern windbreak outside the crown road' },
    { id:'east-garden-pine',x:450,y:70,frame:1,scale:1.35,purpose:'Northern inn garden, behind the building' },
    { id:'east-pine',x:690,y:390,frame:1,scale:1.4,purpose:'Woodland boundary beyond the ranger access lane' },
    { id:'forge-oak',x:460,y:-340,frame:0,scale:1.3,purpose:'Green buffer north of the smithy, clear of the crown road' },
    ...[-710,-590].flatMap((x,col) => [110,240].map((y,row): Planting => ({ id:`orchard:${col}:${row}`,x,y,frame:0,scale:.95,purpose:'Regular orchard spacing and harvest access' }))),
    ...[-850,-740,-630].map((x,i): Planting => ({ id:`western-copse:${i}`,x,y:-310 - (i % 2) * 100,frame:0,scale:1.4,purpose:'Retained woodland, not farmland or a street' })),
    ...[-270,-110,70].map((x,i): Planting => ({ id:i === 1 ? 'north-pine' : `northern-copse:${i}`,x,y:-470 - (i % 2) * 70,frame:i === 1 ? 1 : 0,scale:1.45,purpose:'Northern wooded shelter belt' })),
  ],
};

// Highmere is Trandum's capital. Its market and crown wards occupy opposite
// sides of the civic crossing; one eastern bridge serves the river quay.
const highmere: SettlementLayout = {
  townId:'highmere',authored:true,profile:SETTLEMENT_PROFILES.highmere,baseTerrain:'grass',pavedStreets:true,
  bounds:parcel('capital-edge','Crown city, raised royal ward and inhabited lower quarters','grass',0,0,12200,12200),
  parcels:[
    parcel('central-ward','Civic plaza and public petitions','stone',0,200,1150,1100),
    parcel('military-ward','Open military drill court','dirt',2800,450,1000,700),
    parcel('lower-ward','Worker households and the existing relief investigation','dirt',-1700,1800,2300,1300),
  ],
  streets:[],
  buildings:[
    { x:-1250,y:-880,frame:2,scale:1.15,label:'Crown Watch',purpose:'Western crown ward guard tower',appearance:{ texture:'capital_buildings',frame:2 } },
    { x:HIGHMERE_PLAN.keep.x,y:HIGHMERE_PLAN.keep.y,frontage:HIGHMERE_PLAN.keep.width,frame:8,scale:2.2,label:'Crown Hall',purpose:'Royal castle, audience steps and seat of Trandum government',appearance:{ texture:'capital_buildings',frame:8 } },
    { x:-350,y:-850,frame:1,scale:1.05,label:'Royal Archive',purpose:'Records, charters and lore',appearance:{ texture:'capital_buildings',frame:1 } },
    { x:-1350,y:-360,frame:0,scale:1.08,label:'West Barracks',purpose:'Guard quarters near the western entrance',appearance:{ texture:'capital_buildings',frame:0 } },
    { x:-950,y:-350,frame:6,scale:1.04,label:'Crown Stable',purpose:'Horses and road patrol equipment',appearance:{ texture:'capital_buildings',frame:6 } },
    { x:-300,y:-350,frame:0,scale:1.08,label:'Charter House',purpose:'Petitions and legal records',appearance:{ texture:'world_buildings',frame:0 } },
    { x:650,y:-880,frame:2,scale:1.12,label:'North Bridge Watch',purpose:'Bridge toll and river watch',appearance:{ texture:'capital_buildings',frame:2 } },
    { x:1100,y:-880,frame:7,scale:1.12,label:'Market Hall',purpose:'Trandum grain, cloth and caravan trade',appearance:{ texture:'capital_buildings',frame:7 } },
    { x:1450,y:-330,frame:1,scale:1.05,label:'Counting House',purpose:'Merchant weights and contracts',appearance:{ texture:'capital_buildings',frame:1 } },
    { x:1100,y:-330,frame:7,scale:1,label:'River Customs',purpose:'Goods cleared from the eastern bridge',appearance:{ texture:'capital_buildings',frame:7 } },
    { x:-1350,y:280,frame:1,scale:1.05,label:'Westgate Inn',purpose:'Rooms for royal-road travelers',appearance:{ texture:'world_buildings',frame:1 } },
    { x:-950,y:270,frame:0,scale:1,label:'Westgate Homes',purpose:'Households and street vendors',appearance:{ texture:'world_buildings',frame:0 } },
    { x:-300,y:320,frame:3,scale:.9,label:'Crown Shrine',purpose:'Public rituals beside the stone road',appearance:{ texture:'world_buildings',frame:3 } },
    { x:650,y:270,frame:2,scale:1.06,label:'East Bridge Watch',purpose:'Security for river traffic',appearance:{ texture:'capital_buildings',frame:2 } },
    { x:1150,y:270,frame:2,scale:1.04,label:'Guild Forge',purpose:'Craft tools and armor repair',appearance:{ texture:'world_buildings',frame:2 } },
    { x:1084,y:318,frame:0,scale:.95,label:'Craft Guild',purpose:'Artisans and apprentices beside the forge court',appearance:{ texture:'capital_buildings',frame:0 } },
    { x:-1350,y:850,frame:0,scale:1.05,label:'South Homes',purpose:'Workers near the fields',appearance:{ texture:'capital_buildings',frame:0 } },
    { x:-950,y:850,frame:0,scale:1.03,label:'Orchard Lane',purpose:'City families and garden plots',appearance:{ texture:'world_buildings',frame:0 } },
    { x:1050,y:850,frame:5,scale:1.02,label:'South Smithy',purpose:'Wagon and farrier work',appearance:{ texture:'capital_buildings',frame:5 } },
    { x:1450,y:850,frame:7,scale:1.08,label:'Caravan Storehouse',purpose:'Freight bound for Willowcross',appearance:{ texture:'capital_buildings',frame:7 } },
    { x:-2460,y:-720,frame:0,scale:1.05,label:'Knights Headquarters',purpose:'Officers beside the drill lane',appearance:{texture:'capital_buildings',frame:0} },
    { x:-1860,y:-700,frame:5,scale:1,label:'Royal Armory',purpose:'Practice weapons and patrol supplies',appearance:{texture:'capital_buildings',frame:5} },
    { x:20,y:-980,frame:1,scale:1.15,label:'Ambassadors House',purpose:'Noble petitions and regional envoys',appearance:{texture:'capital_buildings',frame:1} },
    { x:1950,y:-740,frame:1,scale:1.05,label:'Cloth Exchange',purpose:'Merchant contracts and cloth sales',appearance:{texture:'capital_buildings',frame:1} },
    { x:2280,y:400,frame:7,scale:1,label:'Eastern Granary',purpose:'Food reserves beside freight routes',appearance:{texture:'capital_buildings',frame:7} },
    { x:-2350,y:1330,frame:0,scale:.85,label:'Reed Court',purpose:'Lower Ward shared houses and well',appearance:{texture:'world_buildings',frame:0} },
    { x:-1810,y:1320,frame:0,scale:.88,label:'Weavers Row',purpose:'Small homes of market workers',appearance:{texture:'world_buildings',frame:0} },
    { x:-1160,y:1350,frame:0,scale:.85,label:'Morrow Kitchen',purpose:'Communal meals and aid for missing workers',appearance:{texture:'world_buildings',frame:0} },
    { x:-2410,y:1820,frame:0,scale:.85,label:'Tanners Yard',purpose:'Weathered housing away from ceremonial streets',appearance:{texture:'world_buildings',frame:0} },
    { x:-1790,y:1780,frame:0,scale:.88,label:'Dockhands Rooms',purpose:'Shared rooms near the concealed receiving yard',appearance:{texture:'world_buildings',frame:0} },
    { x:-820,y:1830,frame:0,scale:.88,label:'South Ward School',purpose:'Worker petitions and evening lessons',appearance:{texture:'world_buildings',frame:0} },
    { x:-2370,y:2250,frame:4,scale:.95,label:'Abandoned Weighhouse',purpose:'Investigation site, not an ambient hostile spawn',appearance:{texture:'world_buildings',frame:4} },
    { x:1350,y:1960,frame:6,scale:1.12,label:'South Caravan Stable',purpose:'Freight horses and returning escorts',appearance:{texture:'capital_buildings',frame:6} },
    { x:2030,y:1950,frame:7,scale:1.12,label:'Relief Warehouse',purpose:'Reserved grain for outlying settlements',appearance:{texture:'capital_buildings',frame:7} },
  ],
  plantings:[
    { id:'west-park-oak',x:-1000,y:-1050,frame:0,scale:1.3,purpose:'Shade outside crown-ward traffic' },
    { id:'archive-oak',x:-200,y:-1080,frame:0,scale:1.25,purpose:'Shelter behind the archive' },
    { id:'south-garden-oak',x:-250,y:1080,frame:0,scale:1.35,purpose:'Riverbank civic garden' },
    { id:'south-garden-pine',x:70,y:1100,frame:1,scale:1.25,purpose:'Riverbank windbreak' },
    { id:'royal-garden:0',x:-2510,y:-1960,frame:0,scale:1.25,purpose:'Royal terrace garden' },
    { id:'royal-garden:1',x:-2510,y:-1400,frame:0,scale:1.25,purpose:'Royal terrace garden' },
    { id:'lower-well-oak',x:-2520,y:2050,frame:0,scale:1.1,purpose:'Shared courtyard shade' },
  ],
};

// Every approach follows the actual road polyline, including bends inside a city.
function approaches(town:TownDefinition):Street[] {
  return ROAD_ROUTES.filter(r => r.from === town.id || r.to === town.id).map(route => {
    const points = route.from === town.id ? route.points : [...route.points].reverse();
    const local:Vec2[] = [{ x:0,y:0 }];
    for (const p of points.slice(1)) {
      local.push({ x:p.x-town.world.x,y:p.y-town.world.y });
      // The enclosure extends beyond the building survey. Keep the approach
      // through its actual passage so settlement terrain cannot erase the road.
      if (!insideDefense(town.id,p.x,p.y)) break;
    }
    return { id:'approach:'+route.id,width:route.width,points:local };
  });
}

interface DistrictPlan {
  avenues: Array<[string,number,number[][]]>;
  districts: Array<[string,string,TerrainKind,number,number,number,number]>;
  lots: Array<[string,number,number,number]>;
  waterway?: { x:number; width:number };
}
const districtPlans:Record<string,DistrictPlan> = {
  'cibar-plains':{
    avenues:[['grain-road',88,[[-1250,0],[0,0],[1250,0]]],['irrigation-lane',64,[[0,-1150],[0,0],[0,650],[0,1200]]],['farm-track',60,[[-1100,700],[0,700],[1100,700]]],
      ['west-field-access',56,[[-740,700],[-740,1040],[-740,1260]]],['east-field-access',56,[[740,700],[740,1040],[740,1260]]]],
    districts:[['grain-square','Public tally, shared well and caravan market','stone',0,100,430,320],
      ['farm:cibar-plains:west','Family grain allotments and irrigation access','farmland',-740,1040,500,280],
      ['farm:cibar-plains:east','Seed plots supplying the river-halls','farmland',740,1040,500,280],
      ['orchard-yard','Farmhouse gardens and sheltered meeting space','grass',-700,-680,700,550]],
    lots:[['Grain Exchange',7,-780,-190],['South Road Inn',1,720,-210],['Irrigation Smithy',5,860,430],['Brook Farmhouse',0,-730,440],['Seed Guild House',0,-360,-640],['Caravan Stable',6,-1100,-180],['Plains Watch',2,780,-710]],
  },
  willowcross: {
    avenues:[['bridge-market',86,[[-1200,0],[0,0],[1200,0]]],['stable-lane',64,[[-1000,600],[0,600],[1000,600]]],['north-road',64,[[0,-1050],[0,0],[0,950]]]],
    districts:[['market','River crossing and caravan market','stone',-300,-170,900,700],['stable-yard','Stables and fletchers beside the east road','dirt',-650,680,800,500],['farm:willowcross','Market gardens with wagon access','farmland',-630,970,440,256]],
    lots:[['Bridgekeeper Hall',0,-550,-180],['Caravan Inn',1,-950,-250],['Fletcher Workshop',5,-450,400],['Eastbank Store',7,950,-180],['Crown Stable',6,-1000,400],['Riverside Homes',0,950,400],['Grain House',7,340,800]],
    waterway:{ x:600,width:120 },
  },
  elarion: {
    avenues:[['whitebough-way',100,[[-1450,0],[0,0],[1450,0]]],['lore-processional',82,[[0,-1300],[0,-600],[0,0],[0,700],[0,1300]]],['bough-court',76,[[-1200,-600],[0,-600],[1200,-600]]],['bowyer-walk',64,[[-1200,700],[0,700],[1200,700]]]],
    districts:[['lore-ward','Lore halls around the ceremonial avenue','stone',-650,-780,1100,650],['bowyard','Craft gardens and ranger homes','grass',650,420,1100,850],['ancient-grove','Retained woodland behind the lore halls','forest',-500,1100,900,420]],
    lots:[['Whitebough Hall',9,-700,-760],['Ward Chapel',4,620,-780],['Lore Archive',7,-1100,-170],['Council House',1,-480,-170],['Bowyer Hall',5,550,-160],['Ranger Stable',6,1120,-160],['Herbalist House',0,-1050,490],['Livingwood Lodge',0,-450,490],['Moon Survey House',2,600,480],['Trade Hall',8,1130,490]],
  },
  moonfall: {
    avenues:[['grove-trail',60,[[-900,0],[0,0],[900,0]]],['herbalist-walk',52,[[0,-820],[0,0],[0,650],[-650,650]]]],
    districts:[['ritual-clearing','Quiet clearing around the standing-stone shrine','stone',0,-100,300,220],['moon-garden','Herb beds kept outside the grove trail','farmland',-600,720,340,220],['moon-grove','Old woodland surrounding the homes','forest',520,580,600,500]],
    lots:[['Herbalist Cottage',0,-440,-200],['Standing-Stone Chapel',4,500,-210],['Ranger Lodge',6,-470,430],['Grove House',0,530,410],['Travelers Shelter',0,-730,-540]],
  },
  starhold: {
    avenues:[['pass-avenue',108,[[-1450,0],[0,0],[1450,0]]],['beacon-ascent',90,[[0,1250],[0,650],[0,0],[0,-650],[0,-1300]]],['upper-terrace',80,[[-1250,-650],[0,-650],[1250,-650]]],['caravan-terrace',86,[[-1300,650],[0,650],[1300,650]]]],
    districts:[['citadel-terrace','Citadel administration above the pass','stone',-630,-780,1100,600],['caravan-yard','Broad paved staging area for mountain caravans','stone',650,680,1000,500],['snow-garden','Snowbound shelter trees','snow',-650,1090,1000,420]],
    lots:[['Pass Watch',2,-1100,-820],['Citadel Hall',1,-500,-820],['Beacon Tower',9,630,-820],['Quartermaster Stores',7,-1000,-180],['Armorer Forge',5,-450,-180],['Pass Temple',4,570,-180],['Mountain Stable',6,1120,-180],['Caravan Inn',1,-1030,440],['Rope Guild',0,-470,440],['Watch Barracks',0,760,430]],
  },
  redmesa: {
    avenues:[['clan-market',94,[[-1350,0],[0,0],[1350,0]]],['warband-road',80,[[0,-1250],[0,-600],[0,0],[0,620],[0,1200]]],['pen-lane',68,[[-1200,620],[0,620],[1200,620]]]],
    districts:[['clan-court','Assembly space and clan administration','stone',-650,-700,1100,650],['beast-yard','Livestock holding away from the market','dirt',650,850,950,540],['forge-quarter','Fire-safe work district','stone',650,-300,1000,500]],
    lots:[['Clan Assembly Hall',0,-760,-720],['Iron-Tusk Storehouse',7,-1100,-170],['Clan Forge',5,650,-190],['Market House',1,1100,-170],['Beastmaster Stable',6,650,430],['Rider Lodge',0,-650,430],['Caravan Shelter',0,-1050,900]],
  },
  deepford: {
    avenues:[['river-hall-way',100,[[-1450,0],[0,0],[1450,0]]],['mine-road',88,[[0,-1300],[0,-620],[0,0],[0,620],[0,1300]]],['forge-quay',82,[[-1250,-620],[0,-620],[1250,-620]]],['boatwright-quay',76,[[-1250,620],[0,620],[1250,620]]]],
    districts:[['river-hall','Civic and guild halls on the west bank','stone',-700,-760,1200,700],['mine-guild','Ore stores and fire-safe workshops','stone',850,-210,1000,600],['boatwright-yard','Timber and boat fittings near the lower crossing','dirt',-700,810,1000,550]],
    lots:[['Great River Hall',8,-850,-800],['Rune Forge',5,850,-800],['Mine Guild',0,-1100,-180],['Hall Archive',1,-480,-180],['Ore Store',7,850,-180],['River Watch',9,1250,-180],['Boatwright Hall',6,-1050,420],['Craft Homes',0,-470,420],['Guild Inn',1,850,420],['Timber Store',7,-850,1040]],
    waterway:{ x:450,width:144 },
  },
  tidewatch: {
    avenues:[['harbor-market',94,[[-1350,0],[0,0],[1350,0]]],['cargo-way',80,[[0,-1000],[0,0],[0,650]]],['quayside',84,[[-1300,650],[0,650],[1300,650]]]],
    districts:[['merchant-ward','Cargo contracts and sea trade','stone',-650,-450,1000,700],['shipyard','Boat fittings and stored timber beside the quay','dirt',650,410,1000,420],['harbor-basin','Sheltered water beside the southern quay','water',0,1170,2700,780]],
    lots:[['Harbor Guild',7,-740,-210],['Sailmaker House',0,-1120,-550],['Seafarers Inn',1,730,-250],['Anchor Forge',5,1100,430],['Shipyard Stable',6,520,430],['Fishmarket Hall',0,-550,430],['Customs House',7,-1050,430]],
  },
  skallheim: {
    avenues:[['longhouse-road',90,[[-1250,0],[0,0],[1250,0]]],['beacon-walk',72,[[0,-1050],[0,0],[0,640]]],['fish-quay',76,[[-1150,640],[0,640],[1150,640]]]],
    districts:[['longhouse-court','Clan meeting and winter provisions','stone',-650,-520,1000,800],['hunter-yard','Sheltered snow camp behind the longhouses','snow',650,-560,1000,780],['frost-basin','Harbor waters beyond the fish quay','water',0,1120,2500,650]],
    lots:[['Clan Longhouse',0,-750,-220],['Hunters Lodge',6,730,-230],['Winter Store',7,-1050,420],['Fish Traders Hall',1,-450,420],['Beacon Watch',2,930,420],['Harpoon Forge',5,480,430],['Winter Shelter',0,1000,-700]],
  },
  blackspire: {
    avenues:[['citadel-avenue',106,[[-1450,0],[0,0],[1450,0]]],['forge-processional',90,[[0,-1610],[0,-1300],[0,-630],[0,0],[0,650],[0,1250],[0,1610]]],['upper-ward',76,[[-1250,-630],[0,-630],[1250,-630]]],['chainworks-road',82,[[-1250,650],[0,650],[1250,650]]]],
    districts:[['citadel-ward','Council and guarded archive above the forges','stone',-650,-790,1100,650],['forge-ward','Volcanic craft and chainworks','ash',700,-210,1100,650],['lower-homes','Worker homes separated from furnace loading','stone',-650,790,1100,700]],
    lots:[['Obsidian Citadel',8,-850,-830],['Ash Watch',2,760,-830],['Forge Hall',5,680,-190],['Citadel Archive',0,-1100,-180],['Chain Store',7,1200,-180],['Signal Tower',9,-480,-180],['Ash Road Barracks',0,-1080,420],['Chainwright Homes',0,-450,420],['Forge Guild',5,750,420],['Black Dock Stores',7,-800,1030]],
  },
};

function authoredLayout(town:TownDefinition):SettlementLayout {
  const plan = districtPlans[town.id], profile = SETTLEMENT_PROFILES[town.id as SettlementProfileId];
  const baseTerrain:TerrainKind = town.regionId === 'frostlands' || town.regionId === 'nardorous' ? 'snow' : town.regionId === 'darkav' ? 'ash'
    : town.regionId === 'rindass' ? 'dirt' : 'grass';
  const streets = plan.avenues.map(([id,width,points]) => street(id,width,points));
  if(town.kind==='harbor') streets.push(street('pier-access',44,[[700,650],[700,830]]));
  if (town.id === 'willowcross') streets.push(street('farm-access',64,[[0,970],[-630,970]]));
  return { townId:town.id,authored:true,profile,pavedStreets:town.kind !== 'village',baseTerrain,
    bounds:parcel('settlement-edge',profile.architecture,baseTerrain,0,0,profile.bounds.width,profile.bounds.height),
    parcels:plan.districts.map(args => parcel(...args)),streets,
    buildings:plan.lots.map(([label,frame,x,y]) => ({ x,y,frame,scale:1,label,purpose:label+' — '+profile.architecture,
      appearance:{texture:town.id==='elarion'?'elven_villas' as const:'capital_buildings' as const,frame} })),
    plantings:[],...(plan.waterway ? { waterway:{ ...plan.waterway,crossings:[] } } : {}) };
}

export function buildingRenderScale(lot:BuildingLot) {
  const authored=lot.scale * (lot.appearance?.texture === 'capital_buildings' ? lot.frame === 8 ? 1.12 : 1.45
    : lot.appearance?.texture === 'elven_villas' ? lot.frame===2 ? 1.6
      : lot.frame===9 ? 1.75 : lot.frame===4 ? 1.5 : [7,8].includes(lot.frame) ? 1.3 : 1.08 : 1) * (lot.growth??1);
  const texture=lot.appearance?.texture??'world_buildings',frame=lot.appearance?.frame??lot.frame;
  const size=artFrameSize(texture,frame),minimum=Math.max(architectureMinimumScale(texture,frame,size.width,size.height),(lot.frontage??0)/size.width);
  // Constrained burgage plots choose their scale before placement; a larger
  // requested garden-growth factor must not silently omit an existing home.
  const available=lot.plot?(lot.plot.right-lot.plot.left-24)/Math.max(1,size.width):Infinity;
  return Math.max(minimum,Math.min(authored,available));
}
export function buildingBounds(lot:BuildingLot) {
  return propPlacementBounds(lot.appearance?.texture??'world_buildings',lot.appearance?.frame??lot.frame,
    buildingRenderScale(lot),lot.x,lot.y);
}
/** Standing/turning space outside a south-facing village entrance. This is
 * public circulation, not part of the house's solid collision volume. */
export function buildingForecourt(lot:BuildingLot):Rect {
  const bounds=buildingBounds(lot);
  return {left:bounds.left-24,right:bounds.right+24,top:lot.y+2,bottom:lot.y+180};
}
function closestPoint(p:Vec2,a:Vec2,b:Vec2,out:Vec2={x:0,y:0}):Vec2 {
  const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
  const t=length ? Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)) : 0;
  out.x=a.x+dx*t;out.y=a.y+dy*t;return out;
}
// Bounded local placement grids, shared by lots and their roadside details.
const slotOffsets=new Map<string,readonly Vec2[]>();
export function *nearbySlots(preferred:Vec2,radius=480,step=32):Generator<Vec2>{
  const key=radius+':'+step;
  let offsets=slotOffsets.get(key);
  if(!offsets){
    const points:Vec2[]=[];
    for(let y=-radius;y<=radius;y+=step)for(let x=-radius;x<=radius;x+=step)points.push({x,y});
    points.sort((a,b)=>(a.x*a.x+a.y*a.y)-(b.x*b.x+b.y*b.y));offsets=points;
    // Fixed search radii only; retain at most eight reusable local grids.
    if(slotOffsets.size>=8)slotOffsets.delete(slotOffsets.keys().next().value!);
    slotOffsets.set(key,offsets);
  }
  for(const offset of offsets)yield {x:preferred.x+offset.x,y:preferred.y+offset.y};
}
function nearbySlot(preferred:Vec2,radius:number,accept:(point:Vec2)=>boolean){
  for(const point of nearbySlots(preferred,radius))if(accept(point))return point;
}
function prepareLayout(layout:SettlementLayout,requestedGrowth=BUILDING_PRESENTATION_GROWTH) {
  const town=TOWN_BY_ID[layout.townId], shrine=TOWN_SHRINE_BY_ID[town.id];
  // Preserve the visible authored content through this scale revision. Old
  // unfitted optional plots do not become extra world objects as a side effect.
  const prior=occupancy[layout.townId as keyof typeof occupancy];
  const priorBuildings=new Set<number>(prior?.buildings),priorTrees=new Set<string>(prior?.plantings),priorDetails=new Set<string>(prior?.details);
  const wards=settlementWardPlan(town),citadel=citadelPlanning(town.id),borough=town.id==='highmere'?highmereBoroughPlan():undefined;
  if(town.id==='highmere'){
    const districts=new Set(HIGHMERE_DISTRICTS.map(d=>d.id));
    layout.parcels=layout.parcels.filter(p=>!districts.has(p.id));
    layout.parcels.push(...HIGHMERE_DISTRICTS.map(d=>({...d})));
    layout.streets.push(...HIGHMERE_AVENUES.map(s=>({...s,points:s.points.map(p=>({...p}))})));
  }
  const isCitadel=(lot:BuildingLot)=>{
    const id=architectureProfile(lot.appearance?.texture??'world_buildings',lot.appearance?.frame??lot.frame)?.id;
    return Boolean(citadel&&(id==='castle'||id==='elven-palace'));
  };
  // Append new lots: original building indices, shrine IDs and story sites stay
  // intact. Streets are reserved before any new building/decorative placement.
  layout.streets.push(...wards.streets);
  layout.parcels.push(...wards.parcels,...(borough?.parcels??[]));
  layout.buildings.push(...wards.buildings,...(borough?.buildings??[]));
  if(citadel){
    for(const lot of layout.buildings)if(isCitadel(lot))Object.assign(lot,{x:citadel.x,y:citadel.y});
    layout.streets=layout.streets.filter(s=>s.id!=='castle-approach');
    layout.streets.push({id:'castle-approach',width:104,points:[{x:0,y:0},{x:citadel.x,y:0},{x:citadel.x,y:citadel.y+96}]});
    // Replace the old small paved ward with lawns, a door apron and a clear
    // processional walk. Existing planting can occupy these new side gardens.
    const oldCourt:Record<string,string>={highmere:'crown-ward',elarion:'lore-ward',deepford:'river-hall',blackspire:'citadel-ward'};
    layout.parcels=layout.parcels.filter(p=>p.id!==oldCourt[town.id]);
    layout.parcels.push(parcel(oldCourt[town.id]??'citadel-court','Keep precinct and tended side gardens',layout.baseTerrain,
      (citadel.left+citadel.right)/2,(citadel.top+citadel.bottom)/2,citadel.right-citadel.left,citadel.bottom-citadel.top),
      parcel('citadel-door-apron','Audience steps and arrival court','stone',citadel.x,citadel.y+100,citadel.width+140,140),
      parcel('citadel-processional','Clear gate-to-door ceremonial walk','stone',citadel.x,(citadel.y+citadel.bottom)/2,208,citadel.forecourt+180));
  }
  if(town.id==='highmere'){
    layout.buildings.forEach((lot,index)=>{const site=CAPITAL_BUILDING_SITES[index];if(site){Object.assign(lot,site);lot.plot=undefined;}});
    layout.parcels.push(parcel('hearth-shrine-garden','Dedicated shrine garden, open arrival and southern outlook','grass',1100,4250,1300,2100),
      parcel('hearth-shrine-court','Paved shrine forecourt and public gathering place','stone',1100,4040,650,580));
  }
  const indoorIds=new Set(INTERIOR_ASSIGNMENTS.filter(([,name])=>layout.buildings.some(lot=>lot.label===name&&!lot.omitted)).map(([id])=>id));
  for(const [index,lot] of layout.buildings.entries()){
    lot.growth=requestedGrowth;
    if(prior&&index<prior.buildingSlots&&!priorBuildings.has(index))lot.omitted=true;
  }
  layout.plantings.push(...wards.plantings,...(borough?.plantings??[]));
  layout.streets.push(...approaches(town));
  for(const [index,points] of DEFENSE_BY_ID[town.id].approaches.entries())layout.streets.push({id:'defensive-approach:'+index,width:town.id==='highmere'?88:64,
    points:points.map(p=>({x:p.x-town.world.x,y:p.y-town.world.y}))});
  const anchors=NPCS.filter(n=>n.townId===town.id&&!indoorIds.has(n.id)).flatMap(n=>npcExteriorAnchors(n));
  const reserved:Rect[]=anchors.map(p=>npcStandingReservation(p));
  if(town.id==='highmere')reserved.push(CAPITAL_SHRINE_COURT);
  const accessReservations:Rect[]=anchors.map(p=>({left:p.x-32,right:p.x+32,top:p.y-32,bottom:p.y+16}));
  const boardReserve=civicBoardReserve(town.id);if(boardReserve){reserved.push(boardReserve);accessReservations.push(boardReserve);}
  const elvenShrine=shrine.townId==='elarion';
  if(town.id==='elarion'){
    const grove=ELARION_LIFE_TREE_CLEARING;
    reserved.push(grove);
    layout.parcels.push(parcel('life-tree-grove','Tree of Life lawn beside the Whitebough approach','grass',
      ELARION_LIFE_TREE_LOCAL.x,ELARION_LIFE_TREE_LOCAL.y,grove.right-grove.left,grove.bottom-grove.top));
  }
  reserved.push(spriteBounds(elvenShrine?'elven_villas':'world_buildings',elvenShrine?4:3,
    shrine.scale,shrine.world.x-town.world.x,shrine.world.y-town.world.y));
  for(const p of layout.parcels.filter(p=>p.terrain==='farmland' || p.terrain==='water')) reserved.push({left:p.x-p.width/2,right:p.x+p.width/2,top:p.y-p.height/2,bottom:p.y+p.height/2});
  // Reserve actual tower/gate bodies before placing houses, not only the
  // centerline of the curtain. Corner towers extend beyond the court boundary.
  for(const defense of [...(town.id==='highmere'?ROYAL_FORTIFICATION_PROPS:[]),
    ...SETTLEMENT_DEFENSE_PROPS.filter(d=>d.id.startsWith(`defense:${town.id}:`))]){
    if(defense.wallSegment){
      if(town.id==='highmere'&&defense.id.startsWith('fort:highmere:'))reserved.push(propPlacementBounds(defense.texture??'royal_walls',defense.frame,defense.scale??1,
        defense.world.x-town.world.x,defense.world.y-town.world.y,true,defense.wallSegment));
      continue;
    }
    const bounds=propPlacementBounds(defense.texture??'royal_walls',defense.frame,defense.scale??1,
      defense.world.x-town.world.x,defense.world.y-town.world.y);
    reserved.push(bounds);
    if(!architectureProfile(defense.texture??'royal_walls',defense.frame)?.opening?.length)accessReservations.push(bounds);
  }
  // Establish crossings from the authored public streets before adding house
  // frontages. A porch connection cannot manufacture a new bridge implicitly.
  if(layout.waterway){const water=layout.waterway;
    for(const road of layout.streets)for(let i=1;i<road.points.length;i++){
      const a=road.points[i-1],b=road.points[i];if((a.x-water.x)*(b.x-water.x)>0||Math.abs(b.x-a.x)<1)continue;
      const y=a.y+(b.y-a.y)*(water.x-a.x)/(b.x-a.x);
      if(!water.crossings.some(old=>Math.abs(old-y)<96))water.crossings.push(y);
    }
  }
  const accessIndex=new StaticBoundsIndex(accessReservations.map(bounds=>({bounds})));
  let reservedIndex=new StaticBoundsIndex(reserved.map(bounds=>({bounds})));
  const occupiedIndex=new StaticBoundsIndex<{bounds:Rect}>([]),overlapQuery={left:0,right:0,top:0,bottom:0};
  const touchesReservation=(r:Rect,gap:number,shrineGarden=false)=>{
    const q=overlapQuery;q.left=r.left-gap;q.right=r.right+gap;q.top=r.top-gap;q.bottom=r.bottom+gap;
    return reservedIndex.any(q,o=>(!shrineGarden||o.bounds!==CAPITAL_SHRINE_COURT)&&overlaps(r,o.bounds,gap))||occupiedIndex.any(q,o=>overlaps(r,o.bounds,gap));
  };
  const occupied:Rect[]=[];
  const forecourts:Rect[]=[];
  // More than the narrow 96-unit door lane should remain visually open in
  // front of Highmere facades. Reserve it for trees/furniture only AFTER all
  // houses are fitted, so the 100 authored homes keep their current plots.
  const dressingForecourts:Rect[]=[];
  const within=(r:Rect)=>r.left>=-layout.bounds.width/2+32 && r.right<=layout.bounds.width/2-32
    && r.top>=layout.bounds.y-layout.bounds.height/2+32 && r.bottom<=layout.bounds.y+layout.bounds.height/2-32;
  const enclosed=(r:Rect)=>[r.left,r.right].every(x=>[r.top,r.bottom].every(y=>insideDefense(town.id,town.world.x+x,town.world.y+y,-80)));
  const riverFree=(r:Rect)=>!layout.waterway || r.right<layout.waterway.x-layout.waterway.width/2-24 || r.left>layout.waterway.x+layout.waterway.width/2+24;
  const highmereRiverFree=(r:Rect)=>town.id!=='highmere' || ![r.left,(r.left+r.right)/2,r.right].some(x=>
    [r.top,(r.top+r.bottom)/2,r.bottom].some(y=>onHighmereRiver(town.world.x+x,town.world.y+y)));
  const accessQuery={left:0,right:0,top:0,bottom:0},fromWorld={x:0,y:0},toWorld={x:0,y:0};
  const link={width:40,points:[{x:0,y:0},{x:0,y:0}]};
  const clearConnection=(from:Vec2,to:Vec2,own?:Rect)=>{
    const length=Math.hypot(to.x-from.x,to.y-from.y);if(length>1024)return false;
    link.points[0].x=from.x;link.points[0].y=from.y;link.points[1].x=to.x;link.points[1].y=to.y;
    const q=accessQuery,pad=32;q.left=Math.min(from.x,to.x)-pad;q.right=Math.max(from.x,to.x)+pad;
    q.top=Math.min(from.y,to.y)-pad;q.bottom=Math.max(from.y,to.y)+pad;
    if(accessIndex.any(q,o=>rectTouchesStreet(o.bounds,link,12))
      ||occupiedIndex.any(q,o=>rectTouchesStreet(o.bounds,link,12))||own&&rectTouchesStreet(own,link,12))return false;
    fromWorld.x=town.world.x+from.x;fromWorld.y=town.world.y+from.y;
    toWorld.x=town.world.x+to.x;toWorld.y=town.world.y+to.y;
    if(fortificationBlocksPath(fromWorld,toWorld,32))return false;
    const steps=Math.max(1,Math.ceil(length/8)),nx=length?-(to.y-from.y)/length*32:0,ny=length?(to.x-from.x)/length*32:0;
    for(let i=0;i<=steps;i++)for(let side=-1;side<=1;side++){
      const x=from.x+(to.x-from.x)*i/steps+nx*side,y=from.y+(to.y-from.y)*i/steps+ny*side;
      const wx=town.world.x+x,wy=town.world.y+y;
      const bridge=onHighmereBridge(wx,wy)||onWildernessBridge(wx,wy)
        ||Boolean(layout.waterway?.crossings.some(c=>onStoneBridgeDeck(x,y,layout.waterway!.x,c,stoneBridgeScale(layout.waterway!.width))));
      if(!bridge&&(town.id==='highmere'&&onHighmereRiver(wx,wy)||Boolean(layout.waterway)&&onSettlementRiver(wx,wy)||onHeadwaterStream(wx,wy)||town.kind==='harbor'&&harborBay(wx,wy)
        ||layout.waterway&&Math.abs(x-layout.waterway.x)<=layout.waterway.width/2
        ||layout.parcels.some(p=>p.terrain==='water'&&inParcel(x,y,p))))return false;
    }
    return true;
  };
  const connectionCandidate={x:0,y:0};
  const findConnection=(door:Vec2,own?:Rect,excludeStreet?:string)=>{
    let best:Vec2|undefined,bestDistance=1024**2;
    for(const road of layout.streets){if(road.id===excludeStreet)continue;
      for(let i=1;i<road.points.length;i++){
        const p=closestPoint(door,road.points[i-1],road.points[i],connectionCandidate),distance=(p.x-door.x)**2+(p.y-door.y)**2;
        if(p.y<door.y||distance>bestDistance||!clearConnection(door,p,own))continue;
        best={x:p.x,y:p.y};bestDistance=distance;
      }
    }
    return best;
  };
  // Expanded settlements can exhaust an old lot's local search even though
  // their newer public streets have usable frontage. Search those surveyed
  // frontages before failing a required building, retaining every clearance
  // check below. This bounded fallback runs only after local fitting fails.
  function* buildingCandidates(lot:BuildingLot,radius:number,step:number,refit:boolean):Generator<Vec2,void>{
    yield* nearbySlots(lot,radius,step);
    if(!refit||isCitadel(lot))return;
    const offset=buildingBounds({...lot,x:0,y:0}),candidates:Vec2[]=[];
    for(const road of layout.streets){
      if(road.id.startsWith('frontage:')||road.id==='shrine-frontage')continue;
      const margin=road.width/2;
      for(let i=1;i<road.points.length;i++){
        const a=road.points[i-1],b=road.points[i],length=Math.hypot(b.x-a.x,b.y-a.y);
        const samples=Math.min(128,Math.max(1,Math.ceil(length/128)));
        for(let j=0;j<=samples;j++){
          const x=a.x+(b.x-a.x)*j/samples,y=a.y+(b.y-a.y)*j/samples;
          candidates.push({x,y:y-margin-48},
            {x:x-margin-56-offset.right,y:y-34},{x:x+margin+56-offset.left,y:y-34});
        }
      }
    }
    candidates.sort((a,b)=>(a.x-lot.x)**2+(a.y-lot.y)**2-(b.x-lot.x)**2-(b.y-lot.y)**2);
    yield* candidates;
  }
  // Landmarks reserve their parcel first; processing order never changes IDs.
  const lots=[...layout.buildings.entries()].filter(([,lot])=>!lot.omitted).sort((a,b)=>{
    // Existing civic/story lots reserve first, then the new constrained plots.
    if(Boolean(a[1].wardId)!==Boolean(b[1].wardId))return a[1].wardId?1:-1;
    if(isCitadel(a[1])!==isCitadel(b[1]))return isCitadel(a[1])?-1:1;
    if(prior&&Boolean(a[0]>=prior.buildingSlots)!==Boolean(b[0]>=prior.buildingSlots))return a[0]>=prior.buildingSlots?1:-1;
    const ra=buildingBounds(a[1]),rb=buildingBounds(b[1]);
    return (rb.right-rb.left)*(rb.bottom-rb.top)-(ra.right-ra.left)*(ra.bottom-ra.top);
  });
  // Fit original plots first. A relocated workshop must not take a home plot
  // that has not had its first placement attempt yet.
  const placements=lots.map(([index,lot])=>({index,lot,relocating:false}));
  for(const {index,lot,relocating} of placements) {
    const surveyed=town.id==='highmere'?CAPITAL_BUILDING_SITES[index]:undefined;
    if(surveyed){
      const rect=buildingBounds(lot);occupied.push(rect);occupiedIndex.add({bounds:rect});
      if(index!==1){
        const door={x:lot.x,y:lot.y+34},connection={x:lot.x,y:surveyed.frontY};
        forecourts.push({left:lot.x-64,right:lot.x+64,top:lot.y+2,bottom:surveyed.frontY+24});
        layout.streets.push({id:'frontage:'+index,width:48,surface:lot.x<0&&lot.y>2000?'dirt':'stone',points:[connection,door]});
      }
      continue;
    }
    if ('town:'+town.id+':building:'+index===shrine.contentId) {
      occupied.push(buildingBounds(lot));occupiedIndex.add({bounds:occupied.at(-1)!});
      layout.streets.push(street('shrine-frontage',40,[[lot.x,lot.y+64],[lot.x,lot.y+34]]));continue;
    }
    let placed=false;
    const texture=lot.appearance?.texture??'world_buildings',frame=lot.appearance?.frame??lot.frame;
    const compact=architectureMinimumWidth(texture,frame)>0?0:1;
    const sizes=[...new Set([requestedGrowth,Math.min(requestedGrowth,1.08),Math.min(requestedGrowth,1.04),1,compact])];
    const attempts=relocating?[{growth:compact,refit:true}]:sizes.map(growth=>({growth,refit:false}));
    const triedScales=new Set<number>();
    for(const {growth,refit} of attempts){
      lot.growth=growth;
      // Minimum frontage/door clearance can make several growth choices equal.
      // Search that geometry once rather than repeating the same bounded grid.
      const renderScale=buildingRenderScale(lot);
      if(triedScales.has(renderScale))continue;
      triedScales.add(renderScale);
      const searchRadius=refit?1280:lot.wardId?160:town.id==='elarion'&&lot.appearance?.texture==='elven_villas'&&lot.frame===2?800:960;
      for(const point of buildingCandidates(lot,searchRadius,lot.wardId&&!refit?16:32,refit)) {
        const candidate={ ...lot,...point },rect=buildingBounds(candidate);
        const forecourt=town.id==='oakmere'?buildingForecourt(candidate):{left:point.x-48,right:point.x+48,top:point.y+2,bottom:point.y+128};
        const plot=lot.plot;
        const localPlot=Boolean(plot&&rect.left>=plot.left&&rect.right<=plot.right&&rect.top>=plot.top&&rect.bottom<=plot.bottom);
        // If the original tiny plot cannot contain a complete house, fit the
        // nearest clear space in the same outer ward. Every road, resident,
        // crop and admitted lot still reserves its space before this succeeds.
        const inWard=Math.sign(point.x)===Math.sign(lot.x)&&Math.abs(point.x)>layout.bounds.width/2+120;
        const castle=isCitadel(lot);
        const validSite=castle&&citadel?rect.left>=citadel.left+200&&rect.right<=citadel.right-200
          &&rect.top>=citadel.top+200&&rect.bottom<=citadel.bottom-200
          :lot.wardId?enclosed(rect)&&(refit?town.id==='highmere'||inWard:localPlot):refit?enclosed(rect):within(rect)&&(town.id!=='highmere'||enclosed(rect));
        if(citadel&&!castle&&(town.id==='highmere'?royalWardOverlaps(rect,56):overlaps(rect,citadel,56)))continue;
        if(!validSite||!riverFree(rect)||!highmereRiverFree(rect)||layout.streets.some(s=>rectTouchesStreet(rect,s,12))
          ||touchesReservation(rect,56)) continue;
        // Check both directions: an earlier house's doorway cannot face the
        // back of a later house, nor can a new frontage consume an earlier
        // footprint. Shared open forecourts may meet; buildings may not.
        if(forecourts.some(r=>overlaps(rect,r,24))
          ||forecourt&&(!enclosed(forecourt)||occupied.some(r=>overlaps(forecourt,r,24))))continue;
        const door={ x:point.x,y:point.y+34 };
        const connection=findConnection(door,rect);
        if(!connection) continue;
        Object.assign(lot,point);
        if(refit)lot.plot={left:rect.left-12,right:rect.right+12,top:rect.top-12,bottom:rect.bottom+12};
        occupied.push(rect);occupiedIndex.add({bounds:rect});
        if(forecourt)forecourts.push(forecourt);
        if(town.id==='highmere')dressingForecourts.push({
          left:rect.left-24,right:rect.right+24,top:point.y+2,bottom:point.y+180,
        });
        layout.streets.push({id:'frontage:'+index,width:40,points:[connection,door]});placed=true;break;
      }
      if(placed)break;
    }
    if(!placed){
      // A road/shore constrained outer plot can remain an open garden. Never
      // scatter its building elsewhere or abort boot to satisfy a house count.
      if(lot.wardId){
        if(!relocating){placements.push({index,lot,relocating:true});continue;}
        lot.omitted=true;
      }
      else if(!relocating){placements.push({index,lot,relocating:true});continue;}
      else throw new Error('No clear authored parcel for '+town.id+'/'+lot.label);
    }
  }
  // A fitted house may move within its plot to clear a road, neighbor or wall.
  // Its well, flower beds, porch seat and lantern must move by that same
  // displacement; otherwise they remain at the old empty/blocked lot. Use the
  // stable source courtyard IDs and alter only optional dressing, not houses,
  // NPCs, quest objects or authored street geometry.
  if(town.id==='highmere'&&borough){
    const homes=new Map<string,BuildingLot>(layout.buildings.filter(lot=>!lot.omitted&&lot.wardId?.startsWith('capital:house:'))
      .map(lot=>[lot.wardId!.slice('capital:house:'.length),lot]));
    for(const court of HIGHMERE_HOUSEHOLD_COURTS){
      const placed=homes.get(court.id);
      if(!placed)continue;
      const dx=placed.x-court.x,dy=placed.y-court.y;
      if(dx===0&&dy===0)continue;
      const prefix='capital:'+court.id+':';
      for(const detail of borough.details)if(detail.id.startsWith(prefix)){
        detail.x+=dx;detail.y+=dy;
      }
    }
  }
  // Keep the actual doors and the full south-facing facades usable. These
  // supplementary reservations only affect later optional decoration fitting,
  // never the existing building placement or mandatory public routes.
  reserved.push(...forecourts,...dressingForecourts);
  if(citadel&&town.id!=='highmere'){
    const t=24;
    reserved.push({left:citadel.left-t,right:citadel.right+t,top:citadel.top-t,bottom:citadel.top+t},
      {left:citadel.left-t,right:citadel.left+t,top:citadel.top,bottom:citadel.bottom},
      {left:citadel.right-t,right:citadel.right+t,top:citadel.top,bottom:citadel.bottom},
      {left:citadel.left,right:citadel.x-130,top:citadel.bottom-t,bottom:citadel.bottom+t},
      {left:citadel.x+130,right:citadel.right,top:citadel.bottom-t,bottom:citadel.bottom+t});
  }
  // Reserve shrine forecourts and approach them from the nearest existing street.
  const shrineDoor={x:shrine.arrival.x-town.world.x,y:shrine.arrival.y-town.world.y};
  const access=findConnection(shrineDoor,undefined,'shrine-frontage');
  if(access) layout.streets.push({id:'shrine-forecourt',width:40,points:[access,shrineDoor]});
  reservedIndex=new StaticBoundsIndex(reserved.map(bounds=>({bounds})));
  const authoredTrees=[...layout.plantings];
  if(town.id==='elarion')for(const [index,[x,y]] of [
    [-1300,-1200],[1320,-1200],[-1420,-470],[1430,-420],[-1370,520],[1420,620],
    [-1220,1120],[-850,1270],[-380,1360],[420,1320],[970,1220],[1370,1150],
  ].entries())authoredTrees.push({id:'whitebough-young-tree:'+index,x,y,frame:5,texture:'woodland_props',
    scale:1,purpose:'Young flowering shade tree in a protected garden'});
  // Deliberate edge groves / winter windbreaks, not trees scattered into streets.
  if(town.id!=='oakmere') for(const side of [-1,1]) for(const y of [-1000,-350,350,1000]) authoredTrees.push({
    id:'shelter:'+side+':'+y,x:side*(layout.bounds.width/2-160),y,frame:town.regionId==='nardorous'||town.regionId==='frostlands'?1:0,
    scale:1.15,purpose:'District edge shelter belt, clear of approaches',
  });
  layout.plantings=[];
  authoredTrees.sort((a,b)=>Number(priorTrees.has(b.id))-Number(priorTrees.has(a.id)));
  for(const original of authoredTrees) {
    if(town.id!=='highmere'&&prior&&layout.plantings.length>=prior.plantings.length)break;
    // Orchard trees are pruned; courtyard trees and woodland giants are not.
    const cold=town.regionId==='frostlands'||town.regionId==='nardorous';
    const texture:TreeTexture=original.texture??(cold?'climate_props':'world_assets');
    const frame=cold?0:original.frame;
    const height=texture==='woodland_props'?205:original.id.includes('orchard')?190:original.wardId?245:Math.min(335,REGION_SCENERY[town.regionId].treeHeight);
    const tree={...original,texture,frame,scale:treeScale(texture,frame,height)};
    if(town.regionId==='darkav'||town.regionId==='rindass'&&original.id.startsWith('shelter:'))continue;
    const p=nearbySlot(tree,town.id==='highmere'?128:priorTrees.has(tree.id)?1536:tree.wardId?128:tree.id.startsWith('shelter:')?448:1024,point=>{
      const r=spriteBounds(texture,tree.frame,tree.scale,point.x,point.y);
      return (tree.wardId||priorTrees.has(tree.id)?enclosed(r):within(r))&&riverFree(r)&&highmereRiverFree(r)
        &&!layout.streets.some(s=>rectTouchesStreet(r,s,20)||onStreet(point.x,point.y,s,18))
        && !touchesReservation(r,18);
    });
    if(p){const placed={...tree,...p};layout.plantings.push(placed);occupied.push(spriteBounds(texture,tree.frame,tree.scale,p.x,p.y));occupiedIndex.add({bounds:occupied.at(-1)!});}
    // Decorative shade never forces a blocked street or prevents startup when
    // a larger canopy cannot fit a constrained plot. Story content stays put.
  }
  layout.details=[];
  const courtDetails=coreSettlementDressing(town,layout,layout.buildings.map(buildingBounds));
  // Existing district landmarks keep their space; optional new front gardens
  // and furniture use the remaining clear courts rather than displacing them.
  const details=(town.id==='highmere'?[...highmereFurnishings(),...(borough?.details??[]),...courtDetails]:[...wards.details,...(borough?.details??[]),...courtDetails])
    .filter(d=>town.id!=='highmere'||!((d.texture==='others'||d.texture==='native_civic_bare')&&(d.frame<=2||d.frame===11)&&!d.id.includes('-light:'))).sort((a,b)=>Number(priorDetails.has(b.id))-Number(priorDetails.has(a.id)));
  for(const detail of details){
    if(town.id!=='highmere'&&prior&&layout.details.length>=prior.details.length)break;
    const point=nearbySlot(detail,town.id==='highmere'?0:priorDetails.has(detail.id)?1024:128,p=>{
      const rect=propPlacementBounds(detail.texture,detail.frame,detail.scale,p.x,p.y);
      return enclosed(rect)&&riverFree(rect)&&highmereRiverFree(rect)
        &&!layout.streets.some(s=>rectTouchesStreet(rect,s,12))
        &&!touchesReservation(rect,16,town.id==='highmere'&&detail.id.startsWith('capital:shrine-'));
    });
    if(point){const placed:WardDetail={...detail,...point,...(town.id==='highmere'?{placement:'fixed' as const}:{})};layout.details.push(placed);
      occupied.push(propPlacementBounds(detail.texture,detail.frame,detail.scale,point.x,point.y));occupiedIndex.add({bounds:occupied.at(-1)!});}
  }

}

// Oakmere remains a farm village; enclosure approaches are added separately.
oakmere.streets=[
  street('west-east-road',84,[[-1100,0],[0,0],[1100,0]]),
  street('shrine-walk',56,[[0,0],[0,-120],[40,-120],[40,-220]]),
  street('south-walk',64,[[0,0],[0,360],[0,720]]),
  street('work-lane',56,[[-550,-120],[0,-120],[700,-120]]),
  street('residential-lane',56,[[-900,360],[0,360],[850,360]]),
  street('farm-lane',64,[[-630,360],[-630,500],[-630,720]]),
];
export const SETTLEMENT_LAYOUTS:SettlementLayout[]=TOWNS.map(t=>t.id==='oakmere'?oakmere:t.id==='highmere'?highmere:authoredLayout(t));
for(const layout of SETTLEMENT_LAYOUTS){
  const original=structuredClone(layout);
  try{prepareLayout(layout);}catch(error){
    if(!(error instanceof Error)||!error.message.startsWith('No clear authored parcel'))throw error;
    // Keep all important original lots if enlargement exhausts a constrained
    // core. Retry its original architectural scale, not roads/actor placement.
    prepareLayout(original,1);Object.assign(layout,original);
    console.warn('[settlement art] Retained constrained core scale in '+layout.townId);
  }
}
export const SETTLEMENT_BY_ID=Object.fromEntries(SETTLEMENT_LAYOUTS.map(s=>[s.townId,s])) as Record<string,SettlementLayout>;

// Enclosures and foundations share authored ground plans, including Highmere’s ring. Retired wall
// IDs are handled by save migration, not restored as separate invisible solids.

export function settlementAt(x: number, y: number) {
  return SETTLEMENT_LAYOUTS.find(s => insideDefense(s.townId,x,y));
}
export const SETTLEMENT_ENEMY_BUFFER = 96;
export function protectedSettlementAt(x: number, y: number) {
  return SETTLEMENT_LAYOUTS.find(s => {
    if(insideDefense(s.townId,x,y,SETTLEMENT_ENEMY_BUFFER))return true;
    const town = TOWN_BY_ID[s.townId], bounds = s.bounds;
    return Math.abs(x - town.world.x - bounds.x) <= bounds.width / 2 + SETTLEMENT_ENEMY_BUFFER
      && Math.abs(y - town.world.y - bounds.y) <= bounds.height / 2 + SETTLEMENT_ENEMY_BUFFER;
  });
}
// Immutable authored topology, indexed lazily per layout. Buckets retain
// source order so overlapping paving/streets keep their original priority.
const TERRAIN_CELL=512;
interface TerrainIndex {streets:Map<string,Street[]>;parcels:Map<string,LandParcel[]>;streetCount:number;parcelCount:number}
const terrainIndices=new WeakMap<SettlementLayout,TerrainIndex>();
const NO_STREETS:readonly Street[]=[],NO_PARCELS:readonly LandParcel[]=[];
function terrainIndex(layout:SettlementLayout){
  let index=terrainIndices.get(layout);
  if(index&&index.streetCount===layout.streets.length&&index.parcelCount===layout.parcels.length)return index;
  index={streets:new Map(),parcels:new Map(),streetCount:layout.streets.length,parcelCount:layout.parcels.length};
  const cells=(rect:Rect,add:(key:string)=>void)=>{
    for(let y=Math.floor(rect.top/TERRAIN_CELL);y<=Math.floor(rect.bottom/TERRAIN_CELL);y++)
      for(let x=Math.floor(rect.left/TERRAIN_CELL);x<=Math.floor(rect.right/TERRAIN_CELL);x++)add(x+':'+y);
  };
  for(const road of layout.streets){
    const keys=new Set<string>(),pad=road.width/2;
    for(let i=1;i<road.points.length;i++){
      const a=road.points[i-1],b=road.points[i];
      cells({left:Math.min(a.x,b.x)-pad,right:Math.max(a.x,b.x)+pad,top:Math.min(a.y,b.y)-pad,bottom:Math.max(a.y,b.y)+pad},key=>keys.add(key));
    }
    for(const key of keys){const bucket=index.streets.get(key)??[];bucket.push(road);index.streets.set(key,bucket);}
  }
  for(const parcel of layout.parcels)cells({left:parcel.x-parcel.width/2,right:parcel.x+parcel.width/2,
    top:parcel.y-parcel.height/2,bottom:parcel.y+parcel.height/2},key=>{
    const bucket=index!.parcels.get(key)??[];bucket.push(parcel);index!.parcels.set(key,bucket);
  });
  terrainIndices.set(layout,index);return index;
}
export function settlementStreetAt(layout:SettlementLayout,x:number,y:number,margin=0):Street|undefined{
  const index=terrainIndex(layout),pad=Math.max(0,margin);
  for(let cy=Math.floor((y-pad)/TERRAIN_CELL);cy<=Math.floor((y+pad)/TERRAIN_CELL);cy++)
    for(let cx=Math.floor((x-pad)/TERRAIN_CELL);cx<=Math.floor((x+pad)/TERRAIN_CELL);cx++)
      for(const road of index.streets.get(cx+':'+cy)??NO_STREETS)if(onStreet(x,y,road,margin))return road;
  return undefined;
}
/** Reuse the existing terrain street buckets for complete object envelopes. */
export function settlementRectTouchesStreet(layout:SettlementLayout,rect:Rect,margin=0){
  const index=terrainIndex(layout),pad=Math.max(0,margin);
  for(let cy=Math.floor((rect.top-pad)/TERRAIN_CELL);cy<=Math.floor((rect.bottom+pad)/TERRAIN_CELL);cy++)
    for(let cx=Math.floor((rect.left-pad)/TERRAIN_CELL);cx<=Math.floor((rect.right+pad)/TERRAIN_CELL);cx++)
      for(const road of index.streets.get(cx+':'+cy)??NO_STREETS)if(rectTouchesStreet(rect,road,margin))return true;
  return false;
}
const worldStreetQuery={left:0,right:0,top:0,bottom:0};
export function worldRectTouchesStreet(rect:Rect,margin=0){
  if(roadTouchesRect(rect,margin))return true;
  for(const layout of SETTLEMENT_LAYOUTS){
    const town=TOWN_BY_ID[layout.townId],local=worldStreetQuery;
    local.left=rect.left-town.world.x;local.right=rect.right-town.world.x;local.top=rect.top-town.world.y;local.bottom=rect.bottom-town.world.y;
    if(settlementRectTouchesStreet(layout,local,margin))return true;
  }
  return false;
}

export function settlementTerrain(layout: SettlementLayout, x: number, y: number): TerrainKind {
  if(TOWN_BY_ID[layout.townId].kind==='harbor' && Math.abs(x-700)<=60 && y>=650 && y<=835) return 'stone';
  if(layout.waterway && Math.abs(x-layout.waterway.x)<=layout.waterway.width/2)
    return layout.waterway.crossings.some(c=>onStoneBridgeDeck(x,y,layout.waterway!.x,c,stoneBridgeScale(layout.waterway!.width)))?'stone':'water';
  const index=terrainIndex(layout),parcels=index.parcels.get(Math.floor(x/TERRAIN_CELL)+':'+Math.floor(y/TERRAIN_CELL))??NO_PARCELS;
  if(parcels.some(p=>p.terrain==='water'&&inParcel(x,y,p))) return 'water';
  // Paved courts override street dirt; streets cut access lanes through fields.
  if (parcels.some(p => p.terrain === 'stone' && inParcel(x,y,p))) return 'stone';
  const road=settlementStreetAt(layout,x,y);
  if (road) return road.surface ?? (layout.pavedStreets ? 'stone' : 'dirt');
  if (parcels.some(p=>p.terrain==='farmland'&&inParcel(x,y,p))) return 'farmland';
  return parcels.find(p => inParcel(x,y,p))?.terrain ?? layout.baseTerrain;
}
