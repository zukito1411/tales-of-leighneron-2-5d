import type {NativePropTexture} from '../data/nativePropArt';
export type RegionId =
  | 'trandum'
  | 'narenthil'
  | 'nardorous'
  | 'rindass'
  | 'druganwoods'
  | 'portquill'
  | 'frostlands'
  | 'darkav'
  | 'dead-sea';

export type TerrainKind = 'grass' | 'forest' | 'dirt' | 'stone' | 'snow' | 'ash' | 'sand' | 'water' | 'farmland' | 'marsh' | 'lava' | 'ice';

export type WeaponKind = 'sword' | 'greatsword' | 'axe' | 'spear' | 'bow' | 'crossbow' | 'staff' | 'dagger';

export interface Vec2 {
  x: number;
  y: number;
}

export interface RegionDefinition {
  id: RegionId;
  name: string;
  description: string;
  centerChunk: Vec2;
  primaryTerrain: TerrainKind;
  secondaryTerrain: TerrainKind;
  ambientThreat: number;
  climate: string;
  people: string;
  loreTags: string[];
}

export interface TownDefinition {
  id: string;
  name: string;
  regionId: RegionId;
  kind: 'capital' | 'town' | 'village' | 'harbor' | 'stronghold' | 'outpost';
  world: Vec2;
  mapPercent: Vec2;
  description: string;
  services: string[];
  tags: string[];
  starterKnown?: boolean;
}

export interface NpcRelationship {
  kind: 'mentor' | 'friend' | 'family-friend' | 'rival' | 'ally' | 'authority' | 'acquaintance' | 'mystery';
  trust: number;
  summary: string;
}

export interface NpcDefinition {
  id: string;
  name: string;
  title: string;
  townId: string;
  /** Identity/origin is independent of the settlement hosting a visitor. */
  ancestry?: 'human'|'elf'|'orc'|'dwarf';
  visualRegion?: RegionId;
  visitor?: boolean;
  settlementResident?: boolean;
  districtId?:string;
  role: string;
  spriteFrame: number;
  worldOffset: Vec2;
  spriteTexture?: 'npcs' | 'npc_guard' | 'npc_elven_guard_idle' | 'npc_elven_man_idle' | 'npc_elven_woman_idle' | 'npc_elven_king_idle' | 'npc_woman' | 'npc_huntress' | 'npc_villager' | 'npc_royal_guard' | 'npc_blacksmith' | 'npc_adventurer' | 'npc_attendant' | 'npc_general';
  weaponId?: string;
  schedule: Array<{ startHour: number; activity: string; location?: Vec2 }>;
  faction?: string;
  family?: string;
  connections?: Array<{ npcId: string; relationship: string }>;
  homeLocation?: Vec2;
  dialoguePersonality?: string;
  storyConsequences?: string[];
  formation?: { id:string; rank:number };
  relationshipToLeigneron: NpcRelationship;
  dialogue: string[];
  questIds: string[];
  /** Only suppress decorative name/title plates. Quest NPCs always retain theirs. */
  showOverheadLabels?: boolean;
  combatant?: boolean;
  patrolRadius?: number;
  stationary?: boolean;
  /** Offscreen return after a rescue; local coordinates in the home town. */
  storyReturn?: {questId:string;objectiveId:string;position:Vec2};
}

export interface WeaponDefinition {
  id: string;
  name: string;
  kind: WeaponKind;
  tier: number;
  damage: number;
  reach: number;
  cooldownMs: number;
  staminaCost: number;
  description: string;
  regionAffinity?: RegionId;
}

export interface EnemyDefinition {
  id: string;
  name: string;
  spriteFrame: number;
  spriteTexture?: 'enemies'|'enemy_troll'|'enemy_dragon'|'enemy_salt_king'|'enemy_cutlass_pirate'|'enemy_orc_raider'|'enemy_orc_spearman'|'enemy_pirate_boatswain'|'enemy_hedge_goblin'|'enemy_goblin_slinger'|'enemy_thornling'|'enemy_grove_spider'|'enemy_krag_chieftain'|'enemy_frost_wyrm'|'enemy_rootfather'|'enemy_ashen_seer'|'enemy_grand_magus';
  spriteTint?:number;
  appearanceMultiplier?:number;
  bodyRadius?:number;
  combatStyle?:'troll'|'dragon'|'spear-thrower'|'stone-thrower'|'boatswain';
  hp: number;
  damage: number;
  /** Fraction of incoming weapon/art damage absorbed, capped by tier scaling. */
  defense?: number;
  moveSpeed: number;
  aggroRange: number;
  attackRange: number;
  attackCooldownMs: number;
  xp: number;
  goldMin: number;
  goldMax: number;
  boss?: boolean;
  summonEnemyId?: string;
  summonCount?: number;
  summonComposition?: Array<{ enemyId: string; count: number; role: EncounterRole }>;
  summonCooldownMs?: number;
  attackWindupMs?: number;
  attackRecoveryMs?: number;
  attackRadius?: number;
  regionWeights: Partial<Record<RegionId, number>>;
}

export interface BossDefinition {
  id: string;
  enemyId: string;
  name: string;
  regionId: RegionId;
  world: Vec2;
  lore: string;
  respawns: boolean;
  respawnDelayMs?:number;
  attackStyle: 'melee' | 'slam' | 'pounce';
}

export interface QuestObjective {
  id: string;
  type: 'talk' | 'kill' | 'visit' | 'collect' | 'investigate' | 'deliver' | 'choice' | 'puzzle' | 'train' | 'escort' | 'quest' | 'encounter';
  targetId: string;
  amount: number;
  text: string;
  bossId?: string;
  contentId?: string;
  dialogue?: string[];
  choices?: Array<{ id:string; text:string; response:string; flag:string; correct?:boolean }>;
  cinematicId?: string;
  /** Restrict counted hunts to their authored camp, not ambient mobs. */
  killContentPrefix?: string;
  enemyIds?: string[];
  chapter?: string;
  rewardXp?: number;
  /** Final confrontation needs a battle during this stage, not an early kill. */
  requiresFreshDefeat?: boolean;
  /** A deliberate peaceful choice may resolve a later confrontation. */
  completedByFlag?:string;
  /** A quest dependency may require one stage, not its entire later ending. */
  targetObjectiveId?:string;
}

export interface QuestDefinition {
  id: string;
  name: string;
  giverNpcId: string;
  summary: string;
  objectives: QuestObjective[];
  rewardGold: number;
  rewardXp: number;
  nextQuestId?: string;
  prerequisiteQuestId?: string;
  prerequisiteObjective?:{questId:string;objectiveId:string};
  worldQuest?:boolean;
  kind?: 'main' | 'side';
  chapter?: string;
  resolution?: string;
}

export interface DynamicEventDefinition {
  id: string;
  name: string;
  regions: RegionId[];
  minHour?: number;
  maxHour?: number;
  enemyId?: string;
  enemyCount?: number;
  headline: string;
  description: string;
}

export interface QuestRuntimeState {
  status: 'locked' | 'active' | 'completed';
  objectiveProgress: Record<string, number>;
}

interface ContentBase { id: string; world: Vec2; /** Authored composition already admitted by the layout planner. */ placement?:'fixed' }
export type WorldPropTexture = NativePropTexture | 'flora' | 'pirate_flagship' | 'port_dock' | 'elarion_tree' | 'elven_villas' | 'flower_fence' | 'darkav_props' | 'darkav_volcano' | 'world_assets' | 'world_objects' | 'world_buildings' | 'capital_buildings' | 'bridges' | 'others' | 'walls' | 'royal_walls' | 'desert_props' | 'woodland_props' | 'climate_props';
export interface NpcContentDefinition extends ContentBase { kind: 'npc'; npcId: string }
export type EncounterRole = 'leader' | 'melee' | 'flanker' | 'ranged' | 'heavy';
export interface EncounterBehavior {
  home: Vec2; station: Vec2; leashRadius: number; role: EncounterRole; slot: number;
}
export interface CreatureContentDefinition extends ContentBase {
  kind: 'creature'; enemyId: string; bossId?: string; eventSpawn?: boolean;
  /** Authored full patrol admitted only after its mission starts and the clearing is free. */
  campaignReserve?:boolean;
  /** Optional persistent encounter identity; omitted by older saves. */
  encounterId?: string;
  encounterBehavior?: EncounterBehavior;
  /** Persistent identity of a coordinated wolf pack. */
  wolfPackId?: string; wolfAlpha?: boolean;
}
export interface PropContentDefinition extends ContentBase {
  kind: 'prop' | 'settlement-prop'; frame: number; scale: number; solid: boolean;
  texture?: WorldPropTexture;
  footprint?: { width:number; height:number };
  rotation?: number;
  anchor?: 'center' | 'bottom';
  centerCollider?: boolean;
  /** Surveyed world-space wall run; presentation uses it without rotating the source art. */
  wallSegment?: {dx:number;dy:number;height?:number;thickness?:number};
  streamRadiusChunks?:number;
  tint?: number;
  label?: string;
}
export interface SettlementContentDefinition extends ContentBase { kind: 'settlement'; townId: string }
export interface InteractableContentDefinition extends ContentBase {
  kind: 'interactable' | 'harvestable' | 'loot-container' | 'dungeon-entrance';
  name: string; frame: number; description: string; repeatText: string;
  rewardGold?: number; restoreHp?: number;
  texture?: WorldPropTexture; scale?: number;
  tint?: number;
  solid?: boolean;
  townShrineId?: string;
  questTargetId?: string;
  questEventType?: QuestObjective['type'];
  rotation?:number;
  anchor?:'center'|'bottom';
  repeatable?:boolean;
  requiredQuestId?: string;
  discoveryId?:string;
  portId?:string;
  contractTownId?:string;
}
export type ContentDefinition = NpcContentDefinition | CreatureContentDefinition | PropContentDefinition | SettlementContentDefinition | InteractableContentDefinition;
export interface BossPhaseSnapshot {
  phase:2;
  refill?:{elapsedMs:number;startRatio:number};
}
export interface ContentState extends Vec2 {
  /** Validated replacement arena for an authored patrol; survives streaming/save/load. */
  encounterPlacement?:{home:Vec2;station:Vec2};
  hp?: number; hpMax?:number; defeated?: boolean; used?: boolean; trust?: number;
  /** Spent resolve and an unfinished roar survive world streaming/save/load. */
  bossPhase?:BossPhaseSnapshot;
  respawnAt?:number;
  /** Empty members means a cleared wave, with its post-defeat UTC deadline. */
  summonWave?: { encounterId: string; members: string[]; nextAt: number };
}
export interface ContentWorldState {
  states: Record<string, ContentState>;
  spawns: Record<string, CreatureContentDefinition>;
  nextSpawnSequence: number;
}

export interface QuestTarget extends Vec2 {
  contentId: string; label: string; questId: string; objectiveId: string; type: QuestObjective['type'];
  /** Legacy route metadata; current guidance always points directly at x/y. */
  waypoint?: Vec2 & {label:string};
  /** Travel instructions never redirect the pointer away from the destination. */
  travelHint?:string;
  worldLocation?:Vec2;
  /** Virtual story markers are local only to their owning room. */
  interiorId?:string;
}
export interface NavigationMarker extends Vec2 {
  id: string; label: string; kind: 'npc' | 'enemy' | 'boss' | 'building' | 'town' | 'landmark';
  service?:'inn'|'blacksmith'|'contracts'|'harbor'|'shrine'|'cave'|'home'|'tower';
}
export interface NavigationState {
  heading: number; target: QuestTarget | null; markers: NavigationMarker[]; interaction: string | null;
  playerPosition?:Vec2;
  interiorName?:string;
  interiorFloors?:Array<Vec2&{width:number;height:number}>;
  interiorCircle?:Vec2&{radius:number};
}

// LEIGHNERON_WOLF_PACKS_ROAD_BANDITS_V1
