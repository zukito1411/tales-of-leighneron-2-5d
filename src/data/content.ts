import {applyNativePropReplacements} from './nativePropReplacements';
import {fitAuthoredProps} from './authoredPropPlacement';
import {propFitsHabitat} from '../game/systems/propHabitat';
import {WorldGenerator} from '../game/systems/WorldGenerator';
import type { ContentDefinition, ContentState, PropContentDefinition, TownDefinition } from '../game/types';
import { BOSSES, ENEMY_BY_ID } from './enemies';
import { NPCS, NPC_BY_ID, NPC_NAME_ALIASES } from './npcs';
import {npcWorldPosition} from './npcPositions';
import { rewriteNpcMentions } from './npcPresentation';
import { TOWNS, TOWN_BY_ID } from './towns';
import { WORLD_ASSET_FRAMES as PROPS,artFrameSize } from './art';
import { FARM_PLOTS } from './landmarks';
import type {WardDetail} from './settlementWards';
import { SETTLEMENT_BY_ID, SETTLEMENT_LAYOUTS, buildingRenderScale, nearbySlots } from './settlements';
import { TOWN_SHRINES, townShrineContent } from './townShrines';
import { HIGHMERE_RIVER, onHighmereRiver,WILDERNESS_BRIDGES } from './rivers';
import { spriteBounds, propPlacementBounds, overlaps, rectTouchesStreet, propFoundation, type Rect } from './settlementGeometry';
import { ROAD_ROUTES } from './roadRoutes';
import {citadelPlanning} from './settlementPlanning';
import {architectureMinimumScale} from './architecture';
import type { ArtTextureKey } from './art';
import { ROYAL_FORTIFICATION_PROPS, fortificationBlocksPoint } from './fortifications';
import {SETTLEMENT_DEFENSE_PROPS,insideDefense} from './settlementDefenses';
import {WILDERNESS_SITES} from './wildernessSites';
import {isTreeArt} from './treeArt';
import {DRAGON_LAIR_CONTENT} from './dragonLair';
import {LAVA_FLOW,DRAINAGE,pathDistance,harborBay} from './worldLandscape';
import {lakeAt} from './landscapeFeatures';
import {StaticBoundsIndex} from '../game/systems/StaticBoundsIndex';
import {WORLD_WIDTH,WORLD_HEIGHT} from './world';
import {PORTS} from './ports';
import {FLAGSHIP_CONTENT,shipPoint} from './pirateFlagship';
import {addCampaignWorldContent} from './campaignWorld';
import {ROAD_BRIDGE_FRAME,stoneBridgeScale} from './bridgeDeck';

export const WORLD_CONTENT: ContentDefinition[] = [];
for(const port of PORTS)WORLD_CONTENT.push({id:'port:'+port.id,kind:'interactable',world:port.quay,
 texture:port.river?'bridges':'port_dock',frame:port.river?5:0,scale:port.river?1.65:.93,anchor:port.river?'bottom':'center',solid:false,name:port.name,description:port.description,repeatText:port.description,repeatable:true,portId:port.id});
for (const town of TOWNS) {
  WORLD_CONTENT.push({ id: `town:${town.id}`, kind: 'settlement', townId: town.id, world: { x: town.world.x, y: town.world.y - 80 } });
  const layout = SETTLEMENT_BY_ID[town.id];
  for (const [i,lot] of layout.buildings.entries()) {
    if(lot.omitted)continue;
    const shrine = TOWN_SHRINES.find(s => s.contentId === `town:${town.id}:building:${i}`);
    if (shrine) { WORLD_CONTENT.push(townShrineContent(shrine)); continue; }
    const world = { x:town.world.x + lot.x,y:town.world.y + lot.y };
    const texture = lot.appearance?.texture ?? 'world_buildings';
    const scale = buildingRenderScale(lot);
    const footprint = propFoundation(texture,lot.appearance?.frame ?? lot.frame,scale);
    WORLD_CONTENT.push({ id: `town:${town.id}:building:${i}`, kind: 'settlement-prop', world,
      frame:lot.appearance?.frame ?? lot.frame,texture,footprint,tint:layout.profile.buildingTint,
      scale,solid:true,...(layout.authored ? { label:lot.label } : {}) });
  }
}
{
  const town=TOWN_BY_ID.elarion,world=(x:number,y:number)=>({x:town.world.x+x,y:town.world.y+y});
  const court=citadelPlanning(town.id)!;
  // Repeat complete floral panels around the enlarged palace court. Their
  // lengths are fitted uniformly; posts and ornament are never elongated.
  const horizontal=artFrameSize('flower_fence',0),vertical=artFrameSize('flower_fence',1);
  const addFence=(id:string,x:number,y:number,frame:number,scale:number)=>{
    WORLD_CONTENT.push({id:'elarion:whitebough-fence:'+id,kind:'prop',world:world(x,y),
      texture:'flower_fence',frame,scale,solid:true,anchor:'center'});
  };
  const row=(side:string,a:number,b:number,y:number,start=0)=>{
    const count=Math.max(1,Math.ceil((b-a)/(horizontal.width*.96))),span=(b-a)/count,scale=span/(horizontal.width*.96);
    // The source's contact rail is .845 of the complete elevation.
    for(let i=0;i<count;i++)addFence(side+':'+(start+i),a+span*(i+.5),y-horizontal.height*.345*scale,0,scale);
    return count;
  };
  row('north',court.left,court.right,court.top);
  const southCount=row('south',court.left,court.x-130,court.bottom);
  row('south',court.x+130,court.right,court.bottom,southCount);
  const count=Math.ceil((court.bottom-court.top)/(vertical.height*.90)),span=(court.bottom-court.top)/count,scale=span/(vertical.height*.90);
  for(let i=0;i<count;i++)for(const [side,x] of [['west',court.left],['east',court.right]] as const){
    // Vertical source models anchor at the left edge of their contact strip.
    addFence(side+':'+i,x+vertical.width*.21*scale,court.top+span*(i+.5)-vertical.height*.01*scale,1,scale);
  }
}
for (const layout of SETTLEMENT_LAYOUTS) {
  const town = TOWN_BY_ID[layout.townId];
  for (const [index,decoration] of layout.profile.decorations.entries()) {
    WORLD_CONTENT.push({ id:`detail:${town.id}:civic:${index}`,kind:'prop',
      world:{ x:town.world.x + decoration.x,y:town.world.y + decoration.y },texture:'others',frame:decoration.frame,
      scale:decoration.scale,solid:decoration.solid ?? true });
  }
  for (const [i,[x,y]] of [[-180,-80],[210,-80],[-780,580],[780,580]].entries()) {
    WORLD_CONTENT.push({ id:`detail:${town.id}:street-lamp:${i}`,kind:'prop',world:{x:town.world.x+x,y:town.world.y+y},
      texture:'others',frame:town.kind==='village'?0:i>1?2:1,scale:.5,solid:false });
  }
  if (layout.waterway) for (const [i,y] of layout.waterway.crossings.entries()) WORLD_CONTENT.push({
    id:`bridge:${town.id}:${i}`,kind:'prop',world:{x:town.world.x+layout.waterway.x,y:town.world.y+y},
    texture:'bridges',frame:ROAD_BRIDGE_FRAME,scale:stoneBridgeScale(layout.waterway.width),solid:false,anchor:'center',
  });
  WORLD_CONTENT.push({id:`detail:${town.id}:court-bench`,kind:'prop',world:{x:town.world.x-320,y:town.world.y-80},
    texture:'others',frame:7,scale:.55,solid:false});
  if(town.kind!=='village') WORLD_CONTENT.push({id:`detail:${town.id}:loading-crates`,kind:'prop',
    world:{x:town.world.x-850,y:town.world.y+540},texture:'others',frame:9,scale:.55,solid:true});
}
const highmere = TOWN_BY_ID.highmere;
const cibar=TOWN_BY_ID['cibar-plains'].world;
WORLD_CONTENT.push({id:'clue:cibar-pump',kind:'interactable',world:{x:cibar.x-360,y:cibar.y+190},texture:'others',frame:10,scale:.6,name:'Shared irrigation pump',
  description:'The intake is blocked and a copper fitting is gone. Iren knows where the spare pieces were hidden.',repeatText:'The shared pump awaits its repaired fittings.',questTargetId:'cibar-pump',questEventType:'investigate',repeatable:true});
for(const [index,[x,y]] of [[-870,-100],[-1080,1040],[1040,1070]].entries())WORLD_CONTENT.push({
  id:'collect:cibar-fitting:'+index,kind:'loot-container',world:{x:cibar.x+x,y:cibar.y+y},texture:'others',frame:9,scale:.5,name:['Grain-store fitting','West-field fitting','East-field fitting'][index],
  description:'You recover a sealed copper fitting for Asha’s irrigation repair.',repeatText:'This store’s fitting has already been recovered.',questTargetId:'cibar-fitting',questEventType:'collect',requiredQuestId:'water-stops',
});
const cityPoint=(x:number,y:number)=>({x:highmere.world.x+x,y:highmere.world.y+y});
WORLD_CONTENT.push(
  {id:'clue:grain-receipt',kind:'interactable',world:cityPoint(-1640,1700),texture:'others',frame:6,scale:.65,name:'Torn waybill',description:'The torn waybill bears the royal grain seal. Its date was scratched in after the flour cart crossed the river.',repeatText:'The torn waybill is tucked safely away.',questTargetId:'clue:grain-receipt',questEventType:'investigate',repeatable:true},
  {id:'clue:weighhouse-ledger',kind:'interactable',world:cityPoint(-2250,2340),texture:'others',frame:9,scale:.55,name:'Charred grain tally',description:'Behind a loose stone is a list of the stolen flour sacks. Tovin’s name was forged beside the royal seal.',repeatText:'The hidden tally points to the stolen flour.',questTargetId:'clue:weighhouse-ledger',questEventType:'investigate',repeatable:true},
  {id:'clue:watch-signals',kind:'interactable',world:cityPoint(-1960,-250),texture:'others',frame:11,scale:.6,name:'Old watch board',description:'The marks send the guards to the east gate at dawn, the river bridge at noon, and the old storehouse at dusk. The order reveals which road was left open.',repeatText:'East gate at dawn, river bridge at noon, old storehouse at dusk.',questTargetId:'clue:watch-signals',questEventType:'investigate',repeatable:true},
  {id:'clue:relief-tally',kind:'interactable',world:cityPoint(1790,2190),texture:'others',frame:11,scale:.55,name:'Granary count',description:'The sacks left in the storehouse are enough to feed both wards through the first snow—if the doors are opened.',repeatText:'There is enough grain to feed the city.',questTargetId:'clue:relief-tally',questEventType:'investigate',repeatable:true},
  {id:'training:highmere-target',kind:'interactable',world:cityPoint(-1780,-320),texture:'others',frame:12,scale:.6,name:'Practice dummy',description:'Use this yard to practise three sword strikes, two dashes, and Azure Cleave. Keep your blade away from the townsfolk.',repeatText:'Practise inside the yard.',repeatable:true},
  {id:'watch:relief-yard',kind:'interactable',world:cityPoint(2190,2090),texture:'others',frame:12,scale:.6,name:'Storehouse watch',description:'Keep watch beside the storehouse while Iven checks the stolen flour.',repeatText:'The storehouse is safe for now.',repeatable:true},
);
// More detail follows authored district functions; the existing clearance pass
// still checks full art bounds before admitting these roadside objects.
for(const [i,[x,y,frame,scale]] of [
  [-180,-180,10,.9],[-200,250,7,.65],[-240,410,11,.65],[-1110,-1420,12,.6],[-880,-1430,3,.55],
  [1220,-130,5,.72],[1510,-100,5,.72],[1810,150,5,.68],[1950,620,8,.6],
  [-2270,-130,3,.6],[-1940,-120,8,.65],[-2250,1160,6,.55],[-1820,2050,8,.5],[-870,2080,5,.5],
  [1270,2210,8,.65],[1590,2270,9,.65],[-1700,2090,7,.45],
].entries()) WORLD_CONTENT.push({id:'detail:highmere:district:'+i,kind:'prop',world:cityPoint(x,y),texture:'others',frame,scale,solid:![7,12].includes(frame)});
for(const [i,[x,y]] of [[-2470,80],[-1970,80],[-1470,80],[-970,80],[-600,-570],[850,-570],[1330,80],[1810,80],[2310,80],[-600,1470],[850,1470],[-2100,1980],[2400,2180],[-1000,-1180]].entries())
  WORLD_CONTENT.push({id:'detail:highmere:avenue-lamp:'+i,kind:'prop',world:cityPoint(x,y),texture:'others',frame:y>1200?0:1,scale:.55,solid:false});
for (const [index,bridgeY] of HIGHMERE_RIVER.bridgeY.entries()) {
  const y = highmere.world.y + bridgeY;
  const segmentIndex = HIGHMERE_RIVER.points.slice(1).findIndex((point,i) =>
    y >= Math.min(HIGHMERE_RIVER.points[i].y,point.y) && y <= Math.max(HIGHMERE_RIVER.points[i].y,point.y));
  if (segmentIndex < 0) throw new Error(`Highmere bridge ${index} is outside the river survey.`);
  const start = HIGHMERE_RIVER.points[segmentIndex], end = HIGHMERE_RIVER.points[segmentIndex + 1];
  const t = end.y === start.y ? 0 : (y - start.y) / (end.y - start.y);
  WORLD_CONTENT.push({ id:`bridge:highmere:${index}`,kind:'prop',world:{ x:start.x + (end.x - start.x) * t,y },
    texture:'bridges',frame:ROAD_BRIDGE_FRAME,scale:stoneBridgeScale(HIGHMERE_RIVER.width),solid:false,anchor:'center' });
}
for (const npc of NPCS) {
  WORLD_CONTENT.push({ id: `npc:${npc.id}`, kind: 'npc', npcId: npc.id,
    world: npcWorldPosition(npc) });
}
for (const boss of BOSSES) {
  // Keep authored boss territories outside the larger settlement boundaries.
  const town = TOWNS.find(t => insideDefense(t.id,boss.world.x,boss.world.y,160));
  const layout = town ? SETTLEMENT_BY_ID[town.id] : undefined;
  const inside = town && layout && insideDefense(town.id,boss.world.x,boss.world.y,160);
  let world={x:boss.world.x,y:boss.world.y+(boss.id==='captain-varr'?110:0)};
  if(inside&&town&&layout){const dx=world.x-town.world.x,dy=world.y-town.world.y,length=Math.max(1,Math.hypot(dx,dy));
    for(let step=96;step<20000;step+=96){const candidate={x:world.x+(dx||1)/length*step,y:world.y+dy/length*step};
      if(!TOWNS.some(t=>insideDefense(t.id,candidate.x,candidate.y,180))){world=candidate;break;}}}
  WORLD_CONTENT.push({ id: `boss:${boss.id}`, kind: 'creature', enemyId: boss.enemyId, bossId: boss.id,
    world });
}
const home = TOWN_BY_ID.oakmere.world;
const near = (x: number, y: number) => ({ x: home.x + x, y: home.y + y });
WORLD_CONTENT.push(
  { id: 'prop:east-watchtower', kind: 'prop', world: near(1400, -850), texture:'world_buildings',frame:4,scale:1.2,solid:true,footprint:propFoundation('world_buildings',4,1.2) },
  // The authored starter encounter is a complete five-wolf family, not a lone wolf.
  { id: 'creature:oakmere-wolf-east', kind: 'creature', world: near(1300, 1350), enemyId: 'gray-wolf',wolfPackId:'oakmere-wolf-pack',wolfAlpha:true },
  { id: 'creature:oakmere-wolf-east:1', kind: 'creature', world: near(1345, 1380), enemyId: 'gray-wolf',wolfPackId:'oakmere-wolf-pack' },
  { id: 'creature:oakmere-wolf-east:2', kind: 'creature', world: near(1255, 1385), enemyId: 'gray-wolf',wolfPackId:'oakmere-wolf-pack' },
  { id: 'creature:oakmere-wolf-east:3', kind: 'creature', world: near(1330, 1305), enemyId: 'gray-wolf',wolfPackId:'oakmere-wolf-pack' },
  { id: 'creature:oakmere-wolf-east:4', kind: 'creature', world: near(1235, 1310), enemyId: 'gray-wolf',wolfPackId:'oakmere-wolf-pack' },
  { id: 'creature:oakmere-boar-north', kind: 'creature', world: near(-650, -1350), enemyId: 'rindass-boar' },
  { id: 'sign:oakmere-east-road', kind: 'interactable', world: near(500, -100), texture: 'world_assets', frame: PROPS.sign, scale: .8, name: 'East road marker',
    description: 'Old watchtower: northeast of Oakmere. Highmere: follow the crown road north. Aldren marked the watchtower route on this stone.',
    repeatText: 'The watchtower stands northeast of Oakmere; the crown road runs north toward Highmere.' },
  { id: 'loot:oakmere-road-cache', kind: 'loot-container', world: near(560, 110), texture: 'world_assets', frame: PROPS.cargo, scale: 1, name: 'Roadwarden supply cache', rewardGold: 12,
    description: 'Aldren left twelve coins here for road supplies. The cache is now empty.', repeatText: 'The roadwarden cache is empty.' },
  { id: 'harvest:oakmere-berries', kind: 'harvestable', world: near(-500, 220), texture: 'world_assets', frame: PROPS.tree, scale: .45, name: 'Wild berry patch', restoreHp: 12,
    description: 'You gather the ripe berries and recover a little health.', repeatText: 'There are no ripe berries left on this patch.' },
  { id: 'entrance:oakmere-old-cellar', kind: 'dungeon-entrance', world: near(650, -500), texture:'world_buildings',frame:4,name: 'Sealed roadwarden cellar',
    description: 'The old cellar entrance is sealed by fallen stone. You record the site for a future expedition.',
    repeatText: 'The cellar remains sealed. It will need excavation before anyone can enter.' },
  { id: 'shrine:oakmere-road', kind: 'interactable', world: near(40, -270), texture:'world_buildings',frame:3,scale:.8,name: 'Oakmere road shrine',
    description: 'A small lantern burns for travelers. Orin tends this shrine and records the omens brought from the road.',
    repeatText: 'The lantern still burns. Orin keeps watch over the road.' },
  { id: 'camp:oakmere-fire', kind: 'interactable', world: near(-380, 280), texture: 'world_assets', frame: PROPS.fire, scale: 1, name: 'Travelers’ campfire', restoreHp: 14,
    description: 'You rest beside the travelers’ fire and recover a little health.', repeatText: 'The embers glow softly. You have already rested here.' },
  { id: 'creature:old-shrine-wraith', kind: 'creature', world: near(2000, -1150), enemyId: 'marsh-wraith' },
  { id: 'prop:old-shrine', kind: 'prop', world: near(2050, -1220), frame: 3, scale: 1.2, solid: true },
);
const varrSite=WORLD_CONTENT.find(d=>d.id==='boss:captain-varr')!.world;
const watchtower=WORLD_CONTENT.find(d=>d.id==='prop:east-watchtower')!;
watchtower.world={x:varrSite.x,y:varrSite.y-110};
// Krag's Iron-Tusk warband holds two persistent Rindass wilderness encounters;
// ambient raiders also roam valid dryland/highland outside protected settlements.
for(const siteId of ['clan-road-muster','southern-caravan-rest'] as const){
  const site=WILDERNESS_SITES.find(entry=>entry.id===siteId);
  if(!site)throw new Error(`Missing authored Rindass warband site: ${siteId}`);
  // Stand in the clearing, not on the discovery marker or ruined foundation.
  for(const [slot,[dx,dy]] of [[0,[120,180]],[1,[186,152]],[2,[58,142]]] as const)
    WORLD_CONTENT.push({id:`creature:krag-warband:${siteId}:${slot}`,kind:'creature',enemyId:'rindass-orc-raider',
      world:{x:site.world.x+dx,y:site.world.y+dy},eventSpawn:true,encounterId:`krag-warband:${siteId}`});
}
// Visible, persistent field patrols outside Red Mesa's protected perimeter.
// These use the existing streaming/encounter ledger rather than requiring a
// lucky ambient roll. Each new patrol is two melee fighters and one thrower.
const redmesa=TOWN_BY_ID.redmesa.world;
// Scavengers gather by abandoned freight, never in the working farm/town.
// Keep them beyond the civilian camp's 300-unit protected rest radius.
const goblinStore=WILDERNESS_SITES.find(s=>s.id==='crown-freight-camp')!;
const goblinHome={x:goblinStore.world.x+500,y:goblinStore.world.y+300};
for(const [slot,dx,dy] of [[0,0,0],[1,68,28],[2,-62,38]] as const){
  const world={x:goblinHome.x+dx,y:goblinHome.y+dy};
  WORLD_CONTENT.push({id:`creature:hedge-goblins:freight:${slot}`,kind:'creature',enemyId:slot===2?'goblin-stone-slinger':'hedge-goblin',world,eventSpawn:true,
    encounterId:'hedge-goblins:freight',encounterBehavior:{home:{...goblinHome},station:{...world},leashRadius:700,
      slot,role:slot===2?'ranged':slot===0?'leader':'melee'}});
}
// Diseased roots and shaded nests are authored wilderness encounters, not
// hostile residents of healthy elven streets/gardens.
for(const [siteId,enemyId,dx,dy] of [
  ['greenward-ruin','blighted-thornling',620,400],
  ['moon-pilgrim-grove','blighted-thornling',500,-550],
  ['moon-pilgrim-grove','grove-spider',-580,630],
] as const){
  const site=WILDERNESS_SITES.find(s=>s.id===siteId)!;
  const home={x:site.world.x+dx,y:site.world.y+dy};
  for(const [slot,ox,oy] of [[0,0,0],[1,80,25],[2,-75,40]] as const){
    const world={x:home.x+ox,y:home.y+oy};
    WORLD_CONTENT.push({id:`creature:${enemyId}:${siteId}:${slot}`,kind:'creature',enemyId,world,eventSpawn:true,
      encounterId:`${enemyId}:${siteId}`,encounterBehavior:{home:{...home},station:{...world},leashRadius:700,
        slot,role:slot===0?'leader':'melee'}});
  }
}
// North/south courts end at +/-1560; east/west flanks extend much farther.
// Do not mistake the rectangular town bounds for the actual defended area.
for(const [side,dx,dy] of [['north',700,-2200],['south',-700,2200]] as const){
  const home={x:redmesa.x+dx,y:redmesa.y+dy};
  for(const [slot,ox,oy] of [[0,0,0],[1,68,34],[2,-72,46]] as const){
    const world={x:home.x+ox,y:home.y+oy};
    WORLD_CONTENT.push({id:`creature:krag-warband:redmesa-${side}:${slot}`,kind:'creature',
      enemyId:slot===2?'rindass-orc-spearman':'rindass-orc-raider',world,eventSpawn:true,
      encounterId:`krag-warband:redmesa-${side}`,
      encounterBehavior:{home:{...home},station:{...world},leashRadius:900,slot,
        role:slot===2?'ranged':slot===0?'leader':'melee'}});
  }
}
// Preserve the existing Oakmere shrine ID and the capital's shrine building ID.
// Every other settlement gets an accessible shrine beside its central street.
for (const shrine of TOWN_SHRINES) {
  const index = WORLD_CONTENT.findIndex(d => d.id === shrine.contentId);
  if (index >= 0) WORLD_CONTENT[index] = townShrineContent(shrine);
  else WORLD_CONTENT.push(townShrineContent(shrine));
}
const details: Array<[string, keyof typeof PROPS, number, number, number]> = [
  ['road-boulder','rock',1050,-470,1.1], ['farm-boulder','rock',-940,520,1],
  ['caravan-cargo','cargo',-330,40,1],
  ['training-fence-west','fence',-220,235,.8], ['training-fence-east','fence',-145,235,.8],
];
for (const [id, frame, x, y, scale] of details) WORLD_CONTENT.push({
  id: `detail:oakmere:${id}`, kind: 'prop', world: near(x,y), texture: 'world_assets', frame: PROPS[frame], scale, solid: true,
});
for (const layout of SETTLEMENT_LAYOUTS) for (const tree of layout.plantings) {
  const town = TOWN_BY_ID[layout.townId];
  WORLD_CONTENT.push({ id:`detail:${layout.townId}:${tree.id}`,kind:'prop',texture:tree.texture??'world_assets',frame:tree.frame,scale:tree.scale,solid:false,
    world:{ x:town.world.x + tree.x,y:town.world.y + tree.y } });
}
for (const plot of FARM_PLOTS) {
  const layout = SETTLEMENT_BY_ID[plot.townId], town = TOWN_BY_ID[plot.townId];
  let fence = 0, wheat = 0;
  for (const side of [-1,1]) for (let x = plot.x - plot.width / 2 + 36; x < plot.x + plot.width / 2; x += 74) {
    const y = plot.y + side * (plot.height / 2 + 8);
    const rect=spriteBounds('world_assets',PROPS.fence,.85,x-town.world.x,y-town.world.y);
    if (layout.streets.some(s => rectTouchesStreet(rect,s,12))
      ||![rect.left,rect.right].every(px=>[rect.top,rect.bottom].every(py=>insideDefense(town.id,town.world.x+px,town.world.y+py,-24)))) continue;
    WORLD_CONTENT.push({ id:`${plot.id}:fence:${fence++}`,kind:'prop',world:{ x,y },texture:'world_assets',frame:PROPS.fence,scale:.85,solid:true });
  }
  for (let y = plot.y - plot.height / 2 + 44; y <= plot.y + plot.height / 2 - 44 && wheat < 18; y += 56)
    for (let x = plot.x - plot.width / 2 + 44; x <= plot.x + plot.width / 2 - 44 && wheat < 18; x += 56) {
    const rect=spriteBounds('world_assets',PROPS.wheat,.75,x-town.world.x,y-town.world.y);
    if (layout.streets.some(s => rectTouchesStreet(rect,s,30))) continue;
    WORLD_CONTENT.push({ id:`${plot.id}:wheat:${wheat++}`,kind:'prop',world:{ x,y },texture:'world_assets',frame:PROPS.wheat,scale:.75,solid:false });
  }
}
// Freestanding settlement structures share the house sizing rule before their
// roadside fitting pass. Surveyed wall/gate scales already own their apertures.
for(const definition of WORLD_CONTENT){
  if(!('frame' in definition))continue;
  const texture=definition.texture??'world_objects';if(texture==='royal_walls')continue;
  const size=artFrameSize(texture,definition.frame),scale=Math.max(definition.scale??1,
    architectureMinimumScale(texture,definition.frame,size.width,size.height));
  if(scale<=(definition.scale??1))continue;
  definition.scale=scale;
  if('footprint' in definition)definition.footprint=propFoundation(texture,definition.frame,scale);
}
// Place loose objects alongside circulation, never on it. Full visible bounds
// protect roofs, canopies, named residents, shrine forecourts and other props.
// Optional new court dressing yields to existing story/stock/civic placements.
// Reserve the fitted furniture here too: the later append must not let the
// loose-object pass unknowingly move a sign or cache into the same footprint.
function fixedSettlementPlacement(d:ContentDefinition){
  if(!('frame' in d))return true;
  return d.kind==='settlement-prop'||'townShrineId' in d||'portId' in d||d.id.startsWith('farm:')||d.id.startsWith('bridge:')
    ||d.id.endsWith('harbor-pier')||d.id.startsWith('elarion:whitebough-fence:')
    ||isTreeArt(d.texture??'',d.frame)&&d.id.startsWith('detail:');
}
function layoutDetailContent(town:TownDefinition,detail:WardDetail):PropContentDefinition {
  return {id:`detail:${town.id}:${detail.id}`,kind:'prop',world:{x:town.world.x+detail.x,y:town.world.y+detail.y},
    texture:detail.texture,frame:detail.frame,scale:detail.scale,solid:detail.solid,
    footprint:propFoundation(detail.texture,detail.frame,detail.scale),...(detail.label?{label:detail.label}:{})};
}
const deferredCourtDetails=new Map<string,{detail:WardDetail;town:TownDefinition}>();
const fittedDetailBounds:Rect[]=[];
for(const layout of SETTLEMENT_LAYOUTS){
  const town=TOWN_BY_ID[layout.townId];
  const originals=WORLD_CONTENT.filter(d=>'frame' in d&&fixedSettlementPlacement(d)&&Math.abs(d.world.x-town.world.x)<layout.bounds.width&&Math.abs(d.world.y-town.world.y)<layout.bounds.height)
    .map(d=>'frame' in d?propPlacementBounds(d.texture??'world_objects',d.frame,d.scale??1,d.world.x,d.world.y):{left:0,right:0,top:0,bottom:0});
  for(const detail of layout.details??[]){
    const rect=spriteBounds(detail.texture,detail.frame,detail.scale,town.world.x+detail.x,town.world.y+detail.y);
    if(detail.id.startsWith('court:')&&originals.some(r=>overlaps(rect,r,12))){
      const definition=layoutDetailContent(town,detail);
      deferredCourtDetails.set(definition.id,{detail,town});WORLD_CONTENT.push(definition);
      continue; // The shared loose-object fitter below relocates it safely.
    }
    fittedDetailBounds.push(rect);
  }
}
const placed:Rect[] = WORLD_CONTENT.filter(d=>d.kind==='npc'||'frame' in d&&fixedSettlementPlacement(d))
  .map(d=>d.kind==='npc' ? {left:d.world.x-32,right:d.world.x+32,top:d.world.y-76,bottom:d.world.y+35}
    : 'frame' in d ? propPlacementBounds(d.texture??'world_objects',d.frame,'scale' in d?d.scale??1:1,d.world.x,d.world.y) : {left:0,right:0,top:0,bottom:0});
placed.push(...fittedDetailBounds);
for(const d of WORLD_CONTENT) {
  if(!('frame' in d)||fixedSettlementPlacement(d)) continue;
  const texture:ArtTextureKey=d.texture??'world_objects',scale=d.scale??1;
  const layout=SETTLEMENT_LAYOUTS.find(s=>{const t=TOWN_BY_ID[s.townId];return Math.abs(d.world.x-t.world.x)<s.bounds.width/2+600&&Math.abs(d.world.y-t.world.y)<s.bounds.height/2+600;});
  if(!layout) continue;
  const town=TOWN_BY_ID[layout.townId],preferred={...d.world};
  let position:typeof preferred|undefined;
  // Larger houses can fill the old 512-unit search area. Expand only when it
  // is exhausted, reuse the existing bounded grids, and retain every detail.
  for(const radius of [512,1024,1536]){
    for(const p of nearbySlots(preferred,radius)){
      if(radius>512&&Math.max(Math.abs(p.x-preferred.x),Math.abs(p.y-preferred.y))<=(radius===1536?1024:512))continue;
      const rect=spriteBounds(texture,d.frame,scale,p.x,p.y);
      const local={left:rect.left-town.world.x,right:rect.right-town.world.x,top:rect.top-town.world.y,bottom:rect.bottom-town.world.y};
      const fits=[local.left,local.right].every(x=>[local.top,local.bottom].every(y=>insideDefense(town.id,town.world.x+x,town.world.y+y,-64)))
        && !fortificationBlocksPoint(p.x,p.y,45) && !layout.streets.some(s=>rectTouchesStreet(local,s,12))&&!ROAD_ROUTES.some(r=>rectTouchesStreet(rect,r,12))
        && ![rect.left,(rect.left+rect.right)/2,rect.right].some(x=>[rect.top,(rect.top+rect.bottom)/2,rect.bottom].some(y=>onHighmereRiver(x,y)))
        && (!layout.waterway || local.right<layout.waterway.x-layout.waterway.width/2-16 || local.left>layout.waterway.x+layout.waterway.width/2+16)
        && !placed.some(r=>overlaps(rect,r,16)) && !layout.parcels.some(p=>p.terrain==='water' && overlaps(local,{left:p.x-p.width/2,right:p.x+p.width/2,top:p.y-p.height/2,bottom:p.y+p.height/2}));
      if(fits){position=p;break;}
    }
    if(position)break;
  }
  if(!position) throw new Error('No clear roadside location for '+d.id);
  d.world=position;placed.push(spriteBounds(texture,d.frame,scale,position.x,position.y));
}
// Relocated court furniture keeps the same ID and registration; publish its
// final coordinates back to the layout instead of silently dropping detail.
for(const d of WORLD_CONTENT){
  const deferred=deferredCourtDetails.get(d.id);if(!deferred)continue;
  deferred.detail.x=d.world.x-deferred.town.world.x;deferred.detail.y=d.world.y-deferred.town.world.y;
}
for(const layout of SETTLEMENT_LAYOUTS){const town=TOWN_BY_ID[layout.townId];
  for(const detail of layout.details??[]){
    const d=layoutDetailContent(town,detail);if(!deferredCourtDetails.has(d.id))WORLD_CONTENT.push(d);
  }
}
deferredCourtDetails.clear();
for(const bridge of WILDERNESS_BRIDGES)WORLD_CONTENT.push({id:bridge.id,kind:'prop',world:{x:bridge.x,y:bridge.y},texture:'bridges',frame:ROAD_BRIDGE_FRAME,scale:bridge.scale,solid:false,anchor:'center'});
for(const site of WILDERNESS_SITES){
  WORLD_CONTENT.push({id:'discovery:'+site.id,kind:'interactable',world:site.world,texture:'others',frame:11,scale:.58,name:site.name,
    description:site.description,repeatText:site.description,repeatable:true,discoveryId:site.id,questTargetId:site.id,questEventType:'investigate'});
  WORLD_CONTENT.push({id:'detail:wilderness:'+site.id,kind:'prop',world:{x:site.world.x-150,y:site.world.y-110},
    texture:site.id.startsWith('darkav:')?'darkav_props':site.style==='ruin'?'world_buildings':site.style==='camp'?'world_assets':'others',
    frame:site.id.startsWith('darkav:')?3:site.style==='ruin'?4:site.style==='camp'?6:7,
    scale:site.style==='ruin'?.8:.65,solid:site.style==='ruin'});
}
WORLD_CONTENT.push(...ROYAL_FORTIFICATION_PROPS,...SETTLEMENT_DEFENSE_PROPS,...DRAGON_LAIR_CONTENT);
WORLD_CONTENT.push(...FLAGSHIP_CONTENT,{id:'loot:pirate-flagship:cargo',kind:'loot-container',world:shipPoint(535,920),
  texture:'others',frame:9,scale:.45,solid:false,name:'Captured cargo chest',rewardGold:35,
  description:'The crew kept a share of its stolen cargo here. You recover thirty-five coins.',repeatText:'The stolen cargo chest is empty.'});
WORLD_CONTENT.push({id:'sign:pirate-flagship',kind:'interactable',world:shipPoint(1060,855),texture:'world_assets',
  frame:PROPS.sign,scale:.6,solid:false,name:'Outlaw anchorage',
  description:'The Salt King’s flagship is moored west of this shore. Cross the eastern gangplank on foot; armed deckhands guard the cargo. The harbor ferry remains at Tidewatch’s civilian quay.',
  repeatText:'The pirate flagship lies west across the wooden gangplank. The Salt King commands his crew from the aft deck.'});
const elarion=TOWN_BY_ID.elarion;
// Tree of Life now roots in the open grass east of the Whitebough palace
// approach and north of the central stone road (the marked Elarion courtyard).
// Keep the existing model, world ID, trunk collider and asset registrations.
export const ELARION_LIFE_TREE_ID='landmark:elarion-tree-of-life';
const elarionCourt=citadelPlanning(elarion.id)!;
export const ELARION_LIFE_TREE_POSITION={
  x:elarion.world.x+elarionCourt.x+400,
  y:elarion.world.y-440,
};
WORLD_CONTENT.push({id:ELARION_LIFE_TREE_ID,kind:'prop',
  world:{...ELARION_LIFE_TREE_POSITION},texture:'elarion_tree',frame:0,scale:.8,solid:true,
  footprint:{width:78,height:62},streamRadiusChunks:2});
WORLD_CONTENT.push({id:'landmark:darkav-cinderpeak',kind:'prop',world:{...LAVA_FLOW[0]},texture:'darkav_volcano',frame:0,
  scale:3.2,solid:true,streamRadiusChunks:2,label:'Cinderpeak Volcano'});
const blackspireTint=SETTLEMENT_BY_ID.blackspire.profile.buildingTint;
for(const definition of WORLD_CONTENT){
  if(!('frame' in definition)||!insideDefense('blackspire',definition.world.x,definition.world.y))continue;
  if(definition.kind==='prop'||definition.kind==='settlement-prop'||'description' in definition)
    definition.tint=blackspireTint;
}
addCampaignWorldContent(WORLD_CONTENT);
for (let i = 0; i < WORLD_CONTENT.length; i += 1) {
  WORLD_CONTENT[i] = rewriteNpcMentions(WORLD_CONTENT[i], NPC_NAME_ALIASES);
}
// Discovery/story boards are appended after the old town-only placement pass.
// Fit them now, against final streets, bridge art and neighboring objects.
const townsWithContractBoards=new Set<string>();
for(let i=0;i<WORLD_CONTENT.length;i++){
  const d=WORLD_CONTENT[i],townId=d.id.startsWith('detail:')?d.id.split(':')[1]:undefined;
  if(d.kind!=='prop'||!townId||!Object.hasOwn(TOWN_BY_ID,townId)
    ||(d.texture!=='others'&&d.texture!=='native_civic_bare')||d.frame!==11)continue;
  townsWithContractBoards.add(townId);
  WORLD_CONTENT[i]={...d,kind:'interactable',contractTownId:townId,name:`${TOWN_BY_ID[townId].name} quest board`,
    description:'Local hunting contracts and regional bounties.',repeatText:'Read the posted contracts.',repeatable:true};
}
for(const town of TOWNS)if(!townsWithContractBoards.has(town.id)){
  WORLD_CONTENT.push({id:`contracts:board:${town.id}`,kind:'interactable',contractTownId:town.id,
    world:{x:town.world.x+360,y:town.world.y+185},texture:'others',frame:11,scale:.55,solid:true,
    name:`${town.name} quest board`,description:'Local hunting contracts and regional bounties.',
    repeatText:'Read the posted contracts.',repeatable:true});
}
applyNativePropReplacements(WORLD_CONTENT);
fitAuthoredProps(WORLD_CONTENT);
const isRoadsideBoard=(d:ContentDefinition)=>'frame' in d
  &&((d.texture==='others'||d.texture==='native_civic_bare')&&d.frame===11||d.texture==='world_assets'&&d.frame===PROPS.sign);
const boardObstacles=new StaticBoundsIndex(WORLD_CONTENT.flatMap(d=>'frame' in d&&!isRoadsideBoard(d)
  ?[{bounds:spriteBounds(d.texture??'world_objects',d.frame,d.scale??1,d.world.x,d.world.y,d.anchor==='center')}]:[]));
const boardPlacements:Rect[]=[];
const boardGeography=new WorldGenerator();
for(const d of WORLD_CONTENT){
  if(!isRoadsideBoard(d)||!('frame' in d))continue;
  const texture=d.texture??'world_objects',scale=d.scale??1,preferred={...d.world};
  const boardTown='contractTownId' in d&&d.contractTownId?TOWN_BY_ID[d.contractTownId]:undefined;
  const boardSettlement=boardTown?SETTLEMENT_BY_ID[boardTown.id]:undefined;
  const fits=(p:{x:number;y:number})=>{
    const rect=spriteBounds(texture,d.frame,scale,p.x,p.y,d.anchor==='center');
    // Contract boards belong to their issuing settlement, even when an
    // obstruction makes the shared placement pass search farther afield.
    if(boardTown&&boardSettlement){
      const bounds=boardSettlement.bounds,cx=boardTown.world.x+bounds.x,cy=boardTown.world.y+bounds.y;
      if(rect.left<cx-bounds.width/2||rect.right>cx+bounds.width/2
        ||rect.top<cy-bounds.height/2||rect.bottom>cy+bounds.height/2)return false;
    }
    if(!propFitsHabitat(texture,d.frame,boardGeography,p.x,p.y,scale))return false;
    if(rect.left<0||rect.top<0||rect.right>=WORLD_WIDTH||rect.bottom>=WORLD_HEIGHT)return false;
    if(fortificationBlocksPoint(p.x,p.y,50)||harborBay(p.x,p.y)||lakeAt(p.x,p.y))return false;
    if(ROAD_ROUTES.some(r=>rectTouchesStreet(rect,r,20)))return false;
    if(SETTLEMENT_LAYOUTS.some(layout=>{const town=TOWN_BY_ID[layout.townId];
      const local={left:rect.left-town.world.x,right:rect.right-town.world.x,top:rect.top-town.world.y,bottom:rect.bottom-town.world.y};
      return layout.streets.some(s=>rectTouchesStreet(local,s,20));}))return false;
    const pad=Math.max(rect.right-rect.left,rect.bottom-rect.top)/2+12;
    if(DRAINAGE.some(r=>pathDistance(p.x,p.y,r.points,160)<r.width/2+pad))return false;
    if(pathDistance(p.x,p.y,LAVA_FLOW,300)<110+pad)return false;
    return !boardObstacles.query({left:rect.left-16,right:rect.right+16,top:rect.top-16,bottom:rect.bottom+16}).some(o=>overlaps(rect,o.bounds,16))
      &&!boardPlacements.some(other=>overlaps(rect,other,16));
  };
  const candidates=[preferred,...[96,144,224,320,480,640,960,1280].flatMap(radius=>Array.from({length:16},(_,i)=>({
    x:preferred.x+Math.cos(i*Math.PI/8)*radius,y:preferred.y+Math.sin(i*Math.PI/8)*radius})))];
  const position=candidates.find(fits);
  if(position)d.world=position;
  boardPlacements.push(spriteBounds(texture,d.frame,scale,d.world.x,d.world.y,d.anchor==='center'));
}
export const CONTENT_BY_ID = Object.fromEntries(WORLD_CONTENT.map(d => [d.id, d])) as Record<string, ContentDefinition>;
export function initialContentState(definition: ContentDefinition): ContentState {
  return { ...definition.world,
    ...(definition.kind === 'creature' ? { hp: ENEMY_BY_ID[definition.enemyId].hp,hpMax:ENEMY_BY_ID[definition.enemyId].hp } : {}),
    ...(definition.kind === 'npc' ? { trust: NPC_BY_ID[definition.npcId].relationshipToLeigneron.trust } : {}),
  };
}

// LEIGHNERON_WOLF_PACKS_ROAD_BANDITS_V1
