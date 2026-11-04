import {REGIONAL_TREE_SHEET} from './regionalTrees';
import {NATIVE_PROP_ART,type NativePropTexture} from './nativePropArt';
import {HERO_BODY_HEIGHT} from './heroBodyRegistration';
import {varkhulGroundPadding} from './varkhulArt';
import { HERO_PACK, SHRINE_PACK, clipSources, directionalSources, ENEMY_SOURCES,TROLL_SOURCES,DRAGON_SOURCES,DRAGON_FLY_SOURCES,TROLL_IMPACT_SOURCES,DIRECTION_CLIPS,ORC_SPEARMAN_IDLE_SOURCES,ORC_SPEARMAN_ATTACK_SOURCES,ORC_SPEARMAN_STATE_SOURCES, type SpriteSource } from './animationPacks';

import { PLAYER_EFFECTS, PLAYER_IDLE_ANIMATION, SPRITE_BOARDS, boardSources } from './spriteBoards';

import { NPC_IDLE_ART, npcIdleSources,npcDirectionalIdleTexture,type NpcDirectionalIdleTexture } from './npcIdleArt';
import { registerNpcWalkSources,NPC_WALK_ART,npcWalkTexture,npcWalkPath,type NpcWalkTexture } from './npcWalkArt';
import {DIRECTIONAL_ENEMY_ART} from './directionalEnemyArt';
import {BANDIT_COMBAT_TEXTURE} from './banditCombatArt';
import {SALT_KING_TEXTURE} from './saltKingArt';
import {PIRATE_TEXTURE,PIRATE_PATH} from './pirateArt';
import {BOATSWAIN_ART,BOATSWAIN_TEXTURE} from './boatswainArt';
import {GOBLIN_ART,GOBLIN_TEXTURE} from './goblinArt';
import {M14_ART,type M14Texture} from './m14Art';
import {GUARD_MARCH_ART,type GuardMarchTexture} from './guardMarchArt';
import {NPC_COMBAT_ART,type NpcCombatTexture} from './npcCombatArt';

import { PLAYER_SKILL_ART, skillArtSources } from './playerSkillArt';

import type { PlayerSkillTexture } from './activeSkills';

export type PlayerPresentationTexture = 'leigneron' | 'leigneron_idle' | 'leigneron_idle_sides' | 'leigneron_running';
type SourceArtTextureKey = NativePropTexture | typeof DIRECTIONAL_ENEMY_ART[number]['walkTexture'] | 'regional_trees' | 'elarion_tree' | 'elven_villas' | 'flower_fence' | 'darkav_props' | 'darkav_volcano' | 'enemy_troll' | 'enemy_dragon' | 'enemy_dragon_fly' | 'enemy_orc_raider' | 'enemy_orc_spearman' | 'enemy_orc_spearman_actions' | 'enemy_orc_spearman_states' | 'enemy_spear_projectile' | 'effect_troll_impact' | 'desert_props' | 'woodland_props' | 'climate_props' | 'flora' | PlayerSkillTexture | typeof NPC_IDLE_ART[number]['key'] | typeof NPC_IDLE_ART[number]['walk'] | PlayerPresentationTexture | 'leigneron_attack' | 'effect_fortification' | 'effect_hit' | 'effect_heal' | 'effect_slash' | 'effect_teleport' | 'npcs' | 'npc_guard' | 'npc_woman' | 'npc_huntress' | 'npc_villager' | 'npc_blacksmith' | 'npc_adventurer' | 'npc_attendant' | 'npc_general' | 'enemies' | 'world_objects' | 'world_buildings' | 'world_assets' | 'capital_buildings' | 'bridges' | 'others' | 'walls' | 'royal_walls' | 'terrain';
export type ArtTextureKey=SourceArtTextureKey|NpcWalkTexture|NpcDirectionalIdleTexture|typeof BANDIT_COMBAT_TEXTURE|typeof SALT_KING_TEXTURE|GuardMarchTexture|NpcCombatTexture|'port_dock'|'pirate_flagship'|typeof PIRATE_TEXTURE|typeof BOATSWAIN_TEXTURE|typeof GOBLIN_TEXTURE|M14Texture|'enemy_goblin_stone';

export type SpriteRegion = readonly [x: number, y: number, width: number, height: number];

// Upright player-body reference. Running keeps this source scale, not this
// bounding height: bent knees/forward lean must not enlarge the whole body.
export const HERO_VISIBLE_HEIGHT = HERO_BODY_HEIGHT;

interface ArtSheet {

  key: ArtTextureKey; path: string; columns: number; frameWidth: number; frameHeight: number;

  blackBackground: boolean; sourceSize?: readonly [number, number]; regions?: readonly SpriteRegion[];

  density: number; atlasColumns?: number;
  groundPadding?:number;streamed?:boolean;

  sourceInset?: number;

  trimRegions?: boolean;

  groundPoints?:readonly (readonly [number,number])[];

  sources?:readonly SpriteSource[]; contentSize?:readonly [number,number];

  names: readonly string[];

}



// Logical sizes and texture density are independent of collision sizes. Keep

// source illustrations intact; measured regions also support irregular sheets.

const poseNames = ['front','left','right','back'].flatMap(direction =>

  Array.from({ length: 6 }, (_, i) => `${direction}-${i === 0 ? 'idle' : `step-${i}`}`));

// Preserve manifest crops, registration points and the shared side-pose scale.
const heroDirectionalSources: SpriteSource[] = directionalSources(HERO_PACK);

const boardFront = (key:string):SpriteSource => boardSources(SPRITE_BOARDS.find(board => board.key === key)!)[0];

// Compatibility for content that still names one of the old eight role frames.

// Use supplied replacement art, never the removed strip or a restored backup.

// The traveler/hunter share the adventurer outfit until their dedicated art arrives.

const castSources:SpriteSource[] = [

  { ...npcIdleSources(NPC_IDLE_ART.find(entry=>entry.walk==='npc_guard')!)[0],renderScale:76/454 },boardFront('npc_attendant'),

  boardFront('npc_adventurer'),boardFront('npc_huntress'),boardFront('npc_blacksmith'),

  boardFront('npc_general'),boardFront('npc_adventurer'),{ ...directionalSources(SHRINE_PACK)[0],renderScale:76/160 },

];

export const ART_SHEETS: readonly ArtSheet[] = [
  ...NATIVE_PROP_ART,
  {key:'enemy_orc_spearman',path:'assets/enemies/rindass_orc_range/walk.png',columns:4,atlasColumns:4,density:2,frameWidth:160,frameHeight:128,blackBackground:false,sources:ORC_SPEARMAN_IDLE_SOURCES,names:['spearman-idle-down','spearman-idle-left','spearman-idle-right','spearman-idle-up']},
  {key:'enemy_orc_spearman_actions',path:'assets/enemies/rindass_orc_range/action.png',columns:24,atlasColumns:6,density:2,frameWidth:160,frameHeight:128,blackBackground:false,sources:ORC_SPEARMAN_ATTACK_SOURCES,names:Array.from({length:24},(_,i)=>`spearman-throw-${i}`)},
  {key:'enemy_orc_spearman_states',path:'assets/enemies/rindass_orc_range/death.png',columns:24,atlasColumns:6,density:2,frameWidth:160,frameHeight:128,blackBackground:false,sources:ORC_SPEARMAN_STATE_SOURCES,names:Array.from({length:24},(_,i)=>`spearman-state-${i}`)},
  {key:'enemy_spear_projectile',path:'assets/enemies/rindass_orc_range/spear.png',sourceSize:[2172,724],columns:1,atlasColumns:1,density:2,frameWidth:128,frameHeight:32,blackBackground:false,trimRegions:true,regions:[[0,0,2172,724]],names:['rindass-throwing-spear']},
  {key:'darkav_volcano',path:'assets/sprites/darkav_volcano.png',sourceSize:[1254,1254],columns:1,density:1,
    frameWidth:1024,frameHeight:1024,blackBackground:false,trimRegions:true,regions:[[0,0,1254,1254]],names:['cinderpeak-volcano']},
  {key:'darkav_props',path:'assets/sprites/lava_snow.png',columns:4,atlasColumns:4,density:2,
    frameWidth:320,frameHeight:352,blackBackground:false,
    sources:[
      {path:'assets/sprites/lava_snow.png',cell:[475,53,314,350],imageSize:[1254,1254],renderScale:.8,name:'charred-bare-tree'},
      {path:'assets/sprites/fauna_1.png',cell:[615,572,335,216],imageSize:[1254,1254],renderScale:.8,name:'burnt-fallen-log'},
      {path:'assets/sprites/fauna_1.png',cell:[979,570,258,223],imageSize:[1254,1254],renderScale:.8,name:'burnt-stump'},
      {path:'assets/sprites/buildings.png',cell:[500,633,464,390],imageSize:[1448,1086],renderScale:.64,name:'scorched-ruined-arch'},
    ],names:['charred-bare-tree','burnt-fallen-log','burnt-stump','scorched-ruined-arch']},
  // These are irregular illustrations, not a 3x4 tile grid. Bounds measured
  // from the supplied 1254px originals preserve whole objects (no cut edges).
  {key:'desert_props',path:'assets/sprites/desert_1.png',sourceSize:[1254,1254],columns:12,atlasColumns:4,density:2,frameWidth:256,frameHeight:256,blackBackground:false,
    regions:[[44,75,273,327],[351,107,262,292],[654,132,274,269],[964,143,253,255],[32,440,295,264],[344,505,279,197],
      [637,489,372,221],[1028,432,188,270],[19,821,301,239],[338,731,384,335],[733,839,237,226],[981,739,254,327]],
    names:['flowering-cactus','prickly-pear','desert-scrub','dry-grass','sandstone-stack','sandstone-shelf','abandoned-wagon','caravan-sign','caravan-crates','trader-tent','bleached-bones','ruined-sandstone-arch']},
  {key:'woodland_props',path:'assets/sprites/fauna_1.png',sourceSize:[1254,1254],columns:12,atlasColumns:4,density:2,frameWidth:256,frameHeight:256,blackBackground:false,
    regions:[[24,165,271,243],[334,177,269,236],[635,152,299,262],[971,175,264,236],[21,507,275,275],[369,475,201,312],
      [615,572,335,216],[979,570,258,223],[22,974,255,174],[304,875,336,275],[668,937,273,208],[995,851,220,302]],
    names:['bank-reeds','wildflower-bed','woodland-fern','dense-shrub','flowering-shrub','young-tree','fallen-mossy-log','old-stump','mossy-stones','highland-outcrop','mushroom-colony','forest-waymarker']},
  {key:'climate_props',path:'assets/sprites/lava_snow.png',sourceSize:[1254,1254],columns:12,atlasColumns:4,density:2,frameWidth:256,frameHeight:256,blackBackground:false,
    regions:[[79,13,331,384],[475,53,314,350],[851,44,325,353],[42,412,367,269],[444,452,382,222],[872,394,328,292],
      [57,688,351,255],[466,680,330,265],[837,717,388,230],[57,934,346,301],[441,947,368,286],[845,1019,379,210]],
    names:['snow-pine','bare-winter-tree','blue-ice-spire','snow-boulder','snow-fence','winter-watch-brazier','ember-crystals','basalt-columns','lava-boulder','cinder-brazier','volcanic-rune-altar','lava-pool']},
  {key:'flora',path:'assets/sprites/flora.png',sourceSize:[1448,1086],columns:12,atlasColumns:6,density:2,frameWidth:160,frameHeight:128,blackBackground:false,
    regions:[[196,182,162,103],[517,180,178,104],[916,164,169,114],[1106,163,157,107],[26,288,228,173],[1063,272,162,220],
      [1239,276,183,243],[1116,540,310,146],[1265,862,151,130],[28,873,211,177],[534,587,335,165],[666,450,146,132]],
    names:['white-wildflowers','yellow-wildflowers','blue-wildflowers','berry-shrub','meadow-shrub','reedbed','cattails','dry-grass','dry-scrub','sage-brush','mossy-stones','woodland-fern']},

  { key:'leigneron',path:HERO_PACK.animations.walk_down.png,columns:24,atlasColumns:6,density:4,frameWidth:80,frameHeight:80,blackBackground:false,

    sources:heroDirectionalSources,contentSize:[104,128],names:poseNames },

  { key:'leigneron_idle',path:HERO_PACK.animations.idle_front.png,columns:6,atlasColumns:6,density:4,
    frameWidth:80,frameHeight:80,blackBackground:false,sources:clipSources(HERO_PACK,'idle_front'),
    names:Array.from({ length:6 },(_,i) => `idle-${i}`) },

  { key:'leigneron_idle_sides',path:HERO_PACK.animations.idle_side.png,columns:6,atlasColumns:6,density:4,
    frameWidth:80,frameHeight:80,blackBackground:false,sources:clipSources(HERO_PACK,'idle_side'),
    names:Array.from({ length:6 },(_,i) => `idle-side-${i}`) },

  { key:'leigneron_running',path:HERO_PACK.animations.run_side.png,columns:6,atlasColumns:6,density:4,
    frameWidth:80,frameHeight:80,blackBackground:false,sources:clipSources(HERO_PACK,'run_side'),
    names:Array.from({ length:6 },(_,i) => `run-side-${i}`) },

  { key:'npc_woman',path:SHRINE_PACK.animations.walk_down.png,columns:24,atlasColumns:6,density:4,frameWidth:64,frameHeight:80,blackBackground:false,

    sources:registerNpcWalkSources('npc_woman',directionalSources(SHRINE_PACK)),contentSize:[128,160],names:poseNames },
  { key:'npcs',path:castSources[0].path,columns:8,density:4,frameWidth:96,frameHeight:80,blackBackground:false,sources:castSources,

    names:['guard','attendant','traveler','huntress','smith','roadwarden','hunter-provisional','shrine-keeper'] },

  { key:'enemies',path:ENEMY_SOURCES[0].path,columns:ENEMY_SOURCES.length,atlasColumns:10,density:2,frameWidth:96,frameHeight:80,blackBackground:false,

    sources:ENEMY_SOURCES,contentSize:[176,158],names:ENEMY_SOURCES.map(source => source.name) },
  {key:'enemy_troll',path:TROLL_SOURCES[0].path,columns:TROLL_SOURCES.length,atlasColumns:8,density:2,frameWidth:192,frameHeight:160,groundPadding:8,blackBackground:false,
    sources:TROLL_SOURCES,names:TROLL_SOURCES.map(s=>s.name)},
  {key:'enemy_dragon',path:DRAGON_SOURCES[0].path,columns:DRAGON_SOURCES.length,atlasColumns:6,density:2,frameWidth:320,frameHeight:256,groundPadding:varkhulGroundPadding('enemy_dragon'),blackBackground:false,
    sources:DRAGON_SOURCES,names:DRAGON_SOURCES.map(s=>s.name)},
  {key:'enemy_dragon_fly',path:DRAGON_FLY_SOURCES[0].path,columns:6,atlasColumns:3,density:2,frameWidth:416,frameHeight:416,groundPadding:varkhulGroundPadding('enemy_dragon_fly'),blackBackground:false,
    sources:DRAGON_FLY_SOURCES,names:DRAGON_FLY_SOURCES.map(s=>s.name)},
  {key:'effect_troll_impact',path:TROLL_IMPACT_SOURCES[0].path,columns:4,atlasColumns:4,density:2,frameWidth:96,frameHeight:64,groundPadding:16,blackBackground:false,
    sources:TROLL_IMPACT_SOURCES,names:TROLL_IMPACT_SOURCES.map(s=>s.name)},

  { key: 'world_objects', path: 'assets/sprites/world_objects.png', columns: 4, density: 2, frameWidth: 224, frameHeight: 224, blackBackground: false,

    sourceSize: [2172, 724], regions: [[40,242,432,333],[518,119,610,456],[1155,221,536,359],[1722,210,410,381]],

    names: ['cottage','inn-townhouse','ruined-arch','road-shrine'] },

  {key:'elarion_tree',path:'assets/sprites/elarion-tree.png',columns:1,density:2,frameWidth:640,frameHeight:640,
    blackBackground:false,sourceSize:[1280,1280],regions:[[0,0,1280,1280]],names:['elarion-tree-of-life']},

  {key:'elven_villas',path:'assets/sprites/elven-villa.png',columns:10,atlasColumns:4,density:2,frameWidth:384,frameHeight:384,blackBackground:false,
    sourceSize:[1448,1086],regions:[[23,145,328,281],[363,45,393,388],[769,11,200,423],[993,47,440,374],
      [14,427,321,313],[343,468,378,271],[732,452,362,284],[1105,420,324,320],
      [34,749,617,323],[669,738,743,334]],
    names:['elven-cottage','elven-manor','elven-watchtower','elven-gate','elven-chapel','elven-smithy',
      'elven-stable','elven-guildhall','elven-estate','elven-palace']},
  {key:'flower_fence',path:'assets/sprites/flower-fence.png',columns:4,atlasColumns:3,density:2,frameWidth:600,frameHeight:320,blackBackground:false,
    sources:[
      {path:'assets/sprites/flower-fence.png',cell:[0,0,910,265],imageSize:[1536,1024],renderScale:290/490,anchor:[455,150.5],name:'flower-fence-horizontal'},
      {path:'assets/sprites/flower-fence.png',cell:[958,12,155,474],imageSize:[1536,1024],renderScale:270/463,anchor:[1027,254.5],name:'flower-fence-vertical-a'},
      {path:'assets/sprites/flower-fence.png',cell:[1138,12,160,474],imageSize:[1536,1024],renderScale:230/474,name:'flower-fence-vertical-b'},
      {path:'assets/sprites/flower-fence.png',cell:[1330,12,206,474],imageSize:[1536,1024],renderScale:230/474,name:'flower-fence-vertical-c'},
    ],
    names:['flower-fence-horizontal','flower-fence-vertical-a','flower-fence-vertical-b','flower-fence-vertical-c']},

  { key:'world_buildings',path:'assets/sprites/buildings.png',columns:6,atlasColumns:3,density:2,frameWidth:224,frameHeight:224,blackBackground:false,

    sourceSize:[1448,1086],regions:[[30,117,432,387],[483,46,474,455],[991,129,437,372],[61,566,372,446],[500,633,464,390],[1040,522,327,505]],

    names:['thatched-cottage','marrow-inn','pike-smithy','road-shrine','ruined-cellar','watchtower'] },

  { key:'capital_buildings',path:'assets/sprites/capital_buildings.png',columns:10,atlasColumns:5,density:2,frameWidth:384,frameHeight:384,blackBackground:false,

    sourceSize:[1448,1086],trimRegions:true,

    regions:[[16,171,353,243],[381,102,372,314],[772,14,189,401],[969,76,463,335],

      [16,422,292,297],[317,465,382,255],[710,480,351,240],[1077,423,357,305],

      [244,714,712,359],[975,728,260,337]],

    names:['town-hall','manor','watchtower','gatehouse','chapel','smithy','stable','storehouse','castle','signal-tower'] },

  {key:'port_dock',path:'assets/vehicles/coastal-pier.png',columns:1,density:2,frameWidth:320,frameHeight:416,blackBackground:false,
    sourceSize:[1024,1536],trimRegions:true,regions:[[71,75,888,1367]],groundPoints:[[512,260]],names:['coastal-pier']},
  { key:'bridges',path:'assets/sprites/bridges.png',columns:9,atlasColumns:3,density:2,frameWidth:224,frameHeight:224,blackBackground:false,

    sourceSize:[1448,1086],trimRegions:true,

    regions:[[31,115,420,206],[465,114,947,242],[16,402,536,275],[572,406,436,271],

      [1010,405,420,264],[18,760,403,252],[432,708,367,319],[820,732,277,303],[1107,715,326,308]],

    groundPoints:[[241,229],[938,230],[284,472],[790,510],[1220,515],[219,870],[615,890],[958,920],[1270,925]],

    names:['timber-crossing','long-timber-bridge','stone-arch-bridge','broken-stone-bridge','rope-bridge',

      'marsh-dock','harbor-pier','stone-stairs','covered-footgate'] },

  { key:'others',path:'assets/sprites/others.png',columns:14,atlasColumns:7,density:2,frameWidth:224,frameHeight:224,blackBackground:false,

    sourceSize:[1448,1086],trimRegions:true,

    regions:[[51,49,238,365],[338,59,194,354],[604,89,239,325],[932,87,176,323],[1181,103,210,311],

      [20,443,399,325],[438,447,265,311],[721,612,257,160],[982,559,221,198],[1209,542,220,219],

      [57,820,416,224],[502,778,292,276],[930,763,181,293],[1213,775,166,284]],

    names:['hanging-lantern','stone-lamp','road-lamp','brazier','direction-sign','market-stall','village-well',

      'bench','barrels','cargo-crates','fountain','notice-board','royal-banner','beacon'] },

  { key:'royal_walls',path:'assets/sprites/walls.png',columns:6,atlasColumns:5,density:2,frameWidth:320,frameHeight:320,blackBackground:false,
    sourceSize:[1448,1086],regions:[[26,384,132,183],[794,379,137,184],[320,595,329,205],[787,593,127,199],[1045,601,375,191],[250,818,305,207]],
    groundPoints:[[93,510.5],[862,511.5],[482.5,756],[850,785],[1234,770],[402,993]],
    names:['rising-curtain','falling-curtain','horizontal-curtain','corner-tower','south-facing-gate','open-south-facing-gate'] },
  { key:'walls',path:'assets/sprites/walls.png',columns:25,atlasColumns:5,density:2,frameWidth:320,frameHeight:320,blackBackground:false,

    sourceSize:[1448,1086],trimRegions:true,

    regions:[[52,140,100,211],[164,140,107,210],[282,68,146,281],[441,71,108,273],[560,95,146,254],

      [723,106,112,243],[847,188,107,163],[974,166,124,190],[1110,145,166,199],[1287,129,148,215],

      [26,384,132,183],[175,384,171,184],[359,386,259,187],[628,379,161,191],[794,379,137,184],

      [935,378,186,197],[1140,368,238,202],[18,595,272,209],[320,595,329,205],[787,593,127,199],

      [936,601,98,191],[1045,601,375,191],[748,821,362,210],[1114,827,146,193],[1267,819,153,210]],

    names:['broken-wall-pillar','wall-corner-low','wall-bastion','wall-tower-slim','wall-tower-square',

      'wall-pillar-short','wall-pillar-ivy','wall-battlement','wall-ruin-high','wall-ruin-low',

      'wall-corner-west','wall-corner-angle','wall-corner-turn','wall-crosswall','wall-corner-east',

      'wall-battlement-low','wall-straight-tower','wall-gate-keep','wall-straight-bastion','wall-watch-post',

      'wall-royal-arch','wall-great-gate','wall-ruined-arch','wall-broken-run','wall-ivy-arch'] },

  REGIONAL_TREE_SHEET,
  { key: 'world_assets', path: 'assets/sprites/world_assets.png', columns: 8, density: 4, frameWidth: 128, frameHeight: 128, blackBackground: false,

    sourceSize: [2172, 724], regions: [[14,127,368,436],[386,132,254,427],[644,335,334,228],[986,370,290,193],[1291,374,223,189],[1543,319,149,244],[1696,370,188,193],[1896,368,263,188]],

    names: ['broadleaf-tree','pine','boulder','fence','wheat','signpost','campfire','cargo'] },

  { key: 'terrain', path: 'assets/tiles/terrain.png', columns: 8, density: 1, frameWidth: 256, frameHeight: 256, sourceInset: 12, blackBackground: false,

    names: ['grass','dirt','stone','farmland','forest','sand','snow','water'] },

  ...SPRITE_BOARDS.map(board => ({ key:board.key as ArtTextureKey,path:board.path,columns:24,atlasColumns:6,density:2,

    frameWidth:board.frameWidth,frameHeight:board.frameHeight,blackBackground:false,sources:boardSources(board),names:poseNames })),

  ...NPC_IDLE_ART.map(entry => ({ key:entry.key,path:entry.path,columns:6,atlasColumns:6,density:2,

    frameWidth:96,frameHeight:entry.walk==='npc_elven_king'?168:entry.height,blackBackground:false,sources:npcIdleSources(entry),

    names:Array.from({ length:6 },(_,i) => `idle-${i}`) })),

  ...PLAYER_SKILL_ART.map(art => ({ key:art.texture,path:art.path,columns:6,atlasColumns:3,density:2,

    frameWidth:192,frameHeight:256,blackBackground:false,sources:skillArtSources(art),

    names:Array.from({ length:6 },(_,i) => `${art.id}-${i}`) })),

  ...PLAYER_EFFECTS.map(({ name,path }) => ({ key:`effect_${name}` as ArtTextureKey,path,columns:6,atlasColumns:3,density:2,

    frameWidth:128,frameHeight:128,blackBackground:false,sourceSize:[1536,1024] as const,

    regions:Array.from({ length:6 },(_,i):SpriteRegion => [(i % 3) * 512,Math.floor(i / 3) * 512,512,512]),

    names:Array.from({ length:6 },(_,i) => `${name}-${i}`) })),

];



const directionalSheets: ArtSheet[] = DIRECTIONAL_ENEMY_ART.map(a => ({
  key: a.walkTexture,
  path: a.sourcePath,
  columns: a.frameCount,
  atlasColumns: a.species >= 8 ? 6 : 5,
  frameWidth: a.frameWidth,
  frameHeight: a.frameHeight,
  groundPadding:varkhulGroundPadding(a.walkTexture),
  density: 2,
  blackBackground: false,
  names: Array.from(
    { length: a.frameCount },
    (_, i) => `${a.id}:directional:${i}`
  ),
}));
const npcDirectionalIdleSheets:ArtSheet[]=NPC_IDLE_ART.flatMap(entry=>{
 const walk=ART_SHEETS.find(sheet=>sheet.key===entry.walk);
 if(!walk)return [];
 return [{key:npcDirectionalIdleTexture(entry.walk),path:walk.path,columns:12,atlasColumns:4,
  frameWidth:walk.frameWidth,frameHeight:walk.frameHeight,density:walk.density,blackBackground:false,
  names:['left','right','up'].flatMap(direction=>Array.from({length:4},(_,i)=>direction+':idle:'+i))}];
});
const banditCombatSheet:ArtSheet={key:BANDIT_COMBAT_TEXTURE,path:'assets/enemies/refined/road-bandit-attack.png',columns:18,atlasColumns:6,
 frameWidth:192,frameHeight:144,density:2,blackBackground:false,names:Array.from({length:18},(_,i)=>'bandit-combat:'+i)};
const saltKingCombatSheet:ArtSheet={...banditCombatSheet,key:SALT_KING_TEXTURE,path:'assets/enemies/salt_king/attack.png',
 frameWidth:160,frameHeight:112,
 names:Array.from({length:18},(_,i)=>'salt-king-combat:'+i)};
const orcRaiderCombatSheet:ArtSheet={...banditCombatSheet,key:'enemy_orc_raider',path:'assets/enemies/rindass_orc_raider/actions.png',
 frameWidth:160,frameHeight:128,names:Array.from({length:18},(_,i)=>'rindass-orc-raider-combat:'+i)};
const guardMarchSheets:ArtSheet[]=GUARD_MARCH_ART.map(art=>({key:art.texture,path:art.path,columns:24,atlasColumns:6,
 density:2,frameWidth:128,frameHeight:144,blackBackground:false,names:poseNames}));
const npcCombatSheets:ArtSheet[]=NPC_COMBAT_ART.map(art=>({key:art.texture,path:art.sources[0].path,
 columns:art.frames*(art.walkRows?8:4),atlasColumns:art.walkRows?6:art.frames,
 density:2,frameWidth:art.id==='elven-guard'?208:160,frameHeight:art.id==='elven-guard'?192:160,
 groundPadding:art.id==='elven-guard'?36:20,blackBackground:false,
 names:Array.from({length:art.frames*(art.walkRows?8:4)},(_,i)=>art.id+':pose:'+i)}));
const npcWalkSheets:ArtSheet[]=NPC_WALK_ART.map(art=>({key:npcWalkTexture(art.walk)!,path:npcWalkPath(art),
 columns:16,atlasColumns:4,density:2,frameWidth:128,frameHeight:128,groundPadding:12,blackBackground:false,
 names:Array.from({length:16},(_,i)=>art.id+':walk:'+i)}));
const pirateSheet:ArtSheet={key:PIRATE_TEXTURE,path:PIRATE_PATH,columns:49,atlasColumns:6,
  frameWidth:160,frameHeight:112,density:2,blackBackground:false,names:Array.from({length:49},(_,i)=>'cutlass-pirate:'+i)};
const boatswainSheet:ArtSheet={key:BOATSWAIN_TEXTURE,path:BOATSWAIN_ART.walk.path,columns:76,atlasColumns:8,
  frameWidth:128,frameHeight:128,groundPadding:16,density:2,blackBackground:false,names:Array.from({length:76},(_,i)=>'pirate-boatswain:'+i)};
const goblinSheet:ArtSheet={key:GOBLIN_TEXTURE,path:GOBLIN_ART.walk.path,columns:44,atlasColumns:8,
  frameWidth:128,frameHeight:112,groundPadding:14,density:2,blackBackground:false,names:Array.from({length:44},(_,i)=>'hedge-goblin:'+i)};
const m14Sheets:ArtSheet[]=M14_ART.map(spec=>({key:spec.texture,path:`assets/enemies/${spec.folder}/${spec.species===19?'atlas-hd-v2':spec.boss?'walk-v2':'walk'}.png`,columns:spec.species===19?62:44,atlasColumns:8,
  frameWidth:spec.frameWidth,frameHeight:spec.frameHeight,groundPadding:14,density:2,blackBackground:false,names:Array.from({length:spec.species===19?62:44},(_,i)=>spec.id+':'+i)}));
const goblinStoneSheet:ArtSheet={key:'enemy_goblin_stone',path:'assets/enemies/goblin_stone_slinger/stone.png',columns:1,atlasColumns:1,
  frameWidth:32,frameHeight:32,density:2,blackBackground:false,names:['goblin-stone']};
const flagshipSheet:ArtSheet={key:'pirate_flagship',path:'assets/vehicles/pirate_flagship/ship-boardable.png',columns:1,atlasColumns:1,
  frameWidth:1024,frameHeight:1536,density:1,blackBackground:false,names:['moored-pirate-flagship']};
export const ART_BY_KEY = Object.fromEntries([...ART_SHEETS,...directionalSheets,...npcDirectionalIdleSheets,banditCombatSheet,saltKingCombatSheet,orcRaiderCombatSheet,pirateSheet,boatswainSheet,goblinSheet,...m14Sheets,goblinStoneSheet,flagshipSheet,...guardMarchSheets,...npcCombatSheets,...npcWalkSheets].map(sheet => [sheet.key, sheet])) as Record<ArtTextureKey, ArtSheet>;

export function artScale(key: ArtTextureKey) { return 1 / ART_BY_KEY[key].density; }

export function actorScaleForHeight(key: ArtTextureKey, frame: number, height: number) {

  return artScale(key) * height / Math.max(1, artFrameSize(key, frame).height);

}

// Artwork feet, gameplay footpoints and depth share world y. Padding remains
// inside the atlas; do not leave the visible soles twenty pixels below y.

export function actorArtLayout(key: ArtTextureKey) {

  const sheet = ART_BY_KEY[key];

  return { originY: (sheet.frameHeight - (sheet.groundPadding??2)) / sheet.frameHeight,

    bodyX: sheet.frameWidth / 2 - 9, bodyY: sheet.frameHeight - 24,

    labelY: -(sheet.frameHeight - 22) - 12 };

}

export function artFrameSize(key: ArtTextureKey, frame: number) {
  if(GUARD_MARCH_ART.some(art=>art.texture===key))return {width:80,height:76*1.27};
  // Gameplay calculations must agree with the standardized render height.
  if (key === 'leigneron') return { width: frame >= 6 && frame < 18 ? 69 : 59, height: HERO_VISIBLE_HEIGHT };
  if (key === 'leigneron_idle') return { width: 59, height: HERO_VISIBLE_HEIGHT };
  if (key === 'leigneron_idle_sides' || key === 'leigneron_running') return { width: 69, height: HERO_VISIBLE_HEIGHT };

  const sheet = ART_BY_KEY[key], region = sheet.regions?.[frame];

  const source = sheet.sources?.[frame];

  if (source?.renderScale) return { width:source.cell[2] * source.renderScale,height:source.cell[3] * source.renderScale };

  if (sheet.contentSize) {

    const [width,height] = sheet.contentSize, fit = Math.min((sheet.frameWidth - 4) / width,(sheet.frameHeight - 4) / height);

    return { width:width * fit,height:height * fit };

  }

  const fit = sheet.regions ? Math.min((sheet.frameWidth - 4) / Math.max(...sheet.regions.map(r => r[2])),

    (sheet.frameHeight - 4) / Math.max(...sheet.regions.map(r => r[3]))) : 1;

  return { width: region ? region[2] * fit : sheet.frameWidth, height: region ? region[3] * fit : sheet.frameHeight };

}

export function worldPropFootprint(frame: number, scale: number) {

  const size = artFrameSize('world_objects', frame);

  return { width: size.width * scale * .72, height: Math.min(56, size.height * scale * .25) };

}



/** Centered crossings anchor their actual deck, never empty atlas padding. */

export function worldPropOrigin(key:ArtTextureKey,frame:number,anchor:'center'|'bottom') {

  if(anchor==='bottom') return {x:.5,y:1};
  if(key==='flower_fence')return {x:.5,y:.5};
  if(key==='pirate_flagship')return {x:.5,y:.5}; // Exact measured source/layout alignment.

  const sheet=ART_BY_KEY[key],point=sheet.groundPoints?.[frame],region=sheet.regions?.[frame];

  const size=artFrameSize(key,frame);

  if(point&&region){const fit=size.width/region[2];return {

    x:(sheet.frameWidth/2+(point[0]-region[0]-region[2]/2)*fit)/sheet.frameWidth,

    y:(sheet.frameHeight-2-(region[1]+region[3]-point[1])*fit)/sheet.frameHeight,

  };}

  return {x:.5,y:(sheet.frameHeight-2-size.height/2)/sheet.frameHeight};

}



export const WORLD_ASSET_FRAMES = { tree: 0, pine: 1, rock: 2, fence: 3, wheat: 4, sign: 5, fire: 6, cargo: 7 } as const;



export const PLAYER_ANIMATIONS = [...DIRECTION_CLIPS.map((state,direction) => ({ key:`leigneron-${state.slice(5)}`,texture:'leigneron',

  frames:Array.from({ length:HERO_PACK.animations[state].frames },(_,i) => direction * 6 + i),

  frameRate:HERO_PACK.animations[state].frameRate,repeat:HERO_PACK.animations[state].repeat })),PLAYER_IDLE_ANIMATION,
  ...(['idle_side','run_side'] as const).map(state => ({
    key:state === 'idle_side' ? 'leigneron-idle-side' : 'leigneron-run-side',
    texture:state === 'idle_side' ? 'leigneron_idle_sides' : 'leigneron_running',
    frames:Array.from({ length:HERO_PACK.animations[state].frames },(_,i) => i),
    frameRate:HERO_PACK.animations[state].frameRate,repeat:HERO_PACK.animations[state].repeat,
    frameDurations:HERO_PACK.animations[state].frameDurations,
  }))];



// Board frames use the same direction/stride layout as the manifest packs.

// Every named NPC with a 24-pose sheet can actually walk when its routine moves.

export const NPC_ANIMATIONS = ART_SHEETS.filter(sheet => sheet.key.startsWith('npc_') && sheet.columns === 24)

  .flatMap(sheet => DIRECTION_CLIPS.map((clip,direction) => ({

    key:`${sheet.key}-${clip.slice(5)}`,texture:sheet.key,

    frames:Array.from({ length:6 },(_,i) => direction * 6 + i),

    frameRate:sheet.key === 'npc_woman' ? SHRINE_PACK.animations[clip].frameRate : 8,

    repeat:-1,

  }))).concat(NPC_IDLE_ART.map(entry => ({ key:`${entry.walk}-idle`,texture:entry.key,

    frames:Array.from({ length:6 },(_,i) => i),frameRate:2.5,repeat:-1 })));
