import { create } from 'zustand';
import type {ScreenTransitionState} from '../data/screenTransition';
import {HOME_PRICE,FURNITURE_BY_ART,emptyHousing,parseHousing,housingFor,withHome,allHomeItems,type PlayerHousing,type HomeItem} from '../data/housing';
import {PLAYER_HOME_BY_ID} from '../data/playerHomes';
import type { ContentWorldState, NavigationState, QuestObjective, QuestRuntimeState, RegionId } from '../game/types';
import {sameNavigation} from '../utils/sameNavigation';
import { LEIGNERON } from '../data/player';
import { NPC_BY_ID,EDMUND_ATWOOD_ID } from '../data/npcs';
import {BOSS_BY_ID} from '../data/enemies';
import { TOWN_BY_ID } from '../data/towns';
import { advanceQuests } from '../game/systems/questProgress';
import { localSettlementTravelEnabled } from '../utils/localSettlementTravel';
import { initialActiveSkillStatus, type ActiveSkillStatus } from '../data/activeSkills';
import { BASE_ATTRIBUTES, attributeCap, STAT_POINTS_PER_LEVEL, attributeBudget, skillBudget, earnedRewards, xpTotalForLevel, levelForExperience, progressionStats, bossWeaponDropChance, bossArmorSetDropChance, supplyDropChance, SKILLS, type AttributeId, type PlayerAttributes, type SkillId } from '../data/progression';
import { QUEST_BY_ID } from '../data/quests';
import { initialQuests, conversationObjective } from '../game/systems/storyProgress';
import {questRequirementsMet} from '../game/systems/questDependencies';
import {completedStoryScenes,sceneQueue,questConsequences} from '../game/systems/storyScenes';
import {CAMPAIGN_REVISION_FLAG,INDOOR_STORY_FLAG,COMBAT_CLEARANCE_REVISION_FLAG} from '../data/campaign';
import {ADVENTURE_REVISION_FLAG} from '../data/adventure';
import {ROAD_STORIES_REVISION,ROAD_POLISH_REVISION} from '../data/roadStories';
import {reactiveStoryDialogue} from '../game/systems/storyDialogue';
import {ACTIVE_SKILL_BY_ID,DEFAULT_SKILL_SLOTS,type ActiveSkillId} from '../data/activeSkills';
import {BOSS_WEAPONS,POTIONS,canDropPotion,merchantStock,isBlacksmith,itemName,type PotionId} from '../data/economy';
import {MAX_WEAPON_UPGRADE,MAX_BOSS_MATERIALS,BOSS_WEAPON_IDS,type WeaponUpgradeLedger} from '../data/weaponUpgrades';
import {AWAKENING_BY_BOSS,AWAKENING_BY_WEAPON,AWAKENING_PROFILES,AWAKENING_HEART_COST,AWAKENING_HEART_DROP_CHANCE,MAX_BOSS_HEARTS,awakeningHeartId} from '../data/awakening';
import {WEAPON_BY_ID,WEAPONS} from '../data/weapons';
import {localPlayCheatsEnabled} from '../utils/localPlayCheats';
import {acceptUiAction} from '../utils/uiInputGuard';
import type {StoryPanelRef} from '../data/storyPanelArt';
import {emptyJournal,restoreJournal,discoverCreature,discoverJournalEntry,type JournalState} from '../data/journal';
import {ALICE_NPC_ID,ALICE_COMPANION_FLAG} from '../data/aliceCompanion';
import {contractById,boardContracts,contractBoardCycle,expireClaimedContracts,MAX_ACTIVE_CONTRACTS,outstandingContracts,advanceContracts,type ContractLedger} from '../data/contracts';
import {ARMOR_BY_ID,ARMOR_SLOTS,BOSS_ARMOR,SHADOW_MAGUS_ARMOR_IDS,emptyArmorLoadout,armorBonusesFor,NO_ARMOR_BONUSES,type ArmorBonuses,type ArmorLoadout,type ArmorSlot} from '../data/armor';
import {DUNGEON_BY_ID,DUNGEON_RESET_MS,dungeonCleared,dungeonResetReady,dungeonEnemyId,newDungeonProgress,type DungeonLedger} from '../data/dungeons';
import {TOWER_FLOORS,TOWER_QUEST_ID,MAGUS_TREASURE_FLOOR,towerCheckpoint,nextTowerWeeklyReset,gateTowerQuest,towerPracticeAvailable,towerFloorProgress,type TowerPractice} from '../data/towerOfMight';
import {BASE_LEVEL_CAP,MAX_PLAYER_LEVEL,playerLevelCap} from '../data/progression';
import {BREAKTHROUGH_ACCEPTED,BREAKTHROUGH_TRIAL,BREAKTHROUGH_COMPLETE,WORLD_ASCENSION,ASCENSION_CONFIRM_DELAY_MS} from '../data/breakthrough';

const LOCAL_TEST_GOLD=1_000_000_000;

type Panel = 'map' | 'regional-map' | 'inventory' | 'character' | 'pause' | 'travel' | 'journal' | 'codex' | 'harbor' | 'contracts' | 'housing' | 'tower-exit' | 'tower-practice' | null;

export interface DialogueState {
  npcId: string;
  lineIndex: number;
  lines?:string[];
  questId?:string;
  objectiveId?:string;
  choices?:QuestObjective['choices'];
}

export interface BossEncounter {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  phase?:1|2;
  refilling?:boolean;
}
export interface RareLootNotice {id:number;weaponId:string;kind:'weapon'|'material'|'salvage'|'armor'|'armor-salvage'|'armor-set'|'heart';gold:number;newArmorPieces?:number}
export interface LevelUpNotice {id:number;from:number;level:number;attributes:number;learning:number}

export interface GameState {
  housing:PlayerHousing;
  housingContext:string|null;
  housingEditing:boolean;
  buyHome:()=>boolean;
  saveHomeLayout:(items:HomeItem[],nextId:number)=>string|null;
  edmundBreakthrough:()=>void;
  edmundWorldAscension:(step:'warn'|'confirm'|'cancel')=>void;
  worldAscensionReadyAt:number;
  dungeons:DungeonLedger;
  activeDungeonId:string|null;
  discoverDungeon:(id:string)=>void;
  refreshDungeon:(id:string)=>void;
  recordDungeonDefeat:(id:string,slot:number)=>void;
  claimDungeonChest:(id:string)=>void;
  resetTowerRun:()=>void;
  nextTowerResetAt:number;
  refreshTowerWeek:()=>boolean;
  towerExitRequest:{floorId:string;confirmed:boolean}|null;
  requestTowerExit:(floorId:string)=>void;
  confirmTowerExit:()=>void;
  towerPractice:TowerPractice|null;
  towerPracticeRequest:{floorId:string;week:number}|null;
  openTowerPractice:()=>void;
  selectTowerPracticeFloor:(floorId:string,week:number)=>void;
  armorInventory:string[];
  equippedArmor:ArmorLoadout;
  armorBonuses:ArmorBonuses;
  equipArmor:(id:string)=>void;
  unequipArmor:(slot:ArmorSlot)=>void;
  contracts:ContractLedger;
  contractBoardTownId:string|null;
  openContractBoard:(townId:string)=>void;
  acceptContract:(id:string)=>void;
  claimContract:(id:string)=>void;
  abandonContract:(id:string)=>void;
  aliceRemark:{id:string;text:string}|null;
  dismissAliceRemark:(id:string)=>void;
  askAliceToAdventure:(following:boolean)=>void;
  journal:JournalState;
  discoverCreature:(enemyId:string,bossId?:string,defeated?:boolean)=>void;
  discoverRecord:(kind:'characters'|'regions'|'weapons',id:string)=>void;
  playerName: string;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  level: number;
  xp: number;
  attributes: PlayerAttributes;
  statPoints: number;
  skillPoints: number;
  learnedSkills: SkillId[];
  gold: number;
  weaponId: string;
  inventory: string[];
  weaponUpgrades:WeaponUpgradeLedger;
  bossMaterials:Record<string,number>;
  bossHearts:Record<string,number>;
  awakenedWeapons:string[];
  awakenBossWeapon:(npcId:string,weaponId:string)=>void;
  resetAttributes:(npcId:string)=>void;
  enhanceBossWeapon:(npcId:string,weaponId:string)=>void;
  consumables:Record<PotionId,number>;
  vitalRevision:number;
  learnedCombatArts:ActiveSkillId[];
  skillSlots:(ActiveSkillId|null)[];
  buyItem:(npcId:string,itemId:string)=>void;
  equipWeapon:(id:string)=>void;
  equipLocalWeaponForm:(id:string,awakened:boolean)=>void;
  usePotion:(id:PotionId)=>void;
  learnCombatArt:(id:ActiveSkillId)=>void;
  setSkillSlot:(slot:number,id:ActiveSkillId|null)=>void;
  worldX: number;
  worldY: number;
  regionId: RegionId;
  townId: string | null;
  day: number;
  minuteOfDay: number;
  weatherLabel:string;
  weatherAudio:boolean;
  harborPortId:string|null;
  passageRequest:string|null;
  passage:{from:string;to:string;progress:number}|null;
  screenTransition:ScreenTransitionState|null;
  panel: Panel;
  dialogue: DialogueState | null;
  toast: string | null;
  rareLootQueue:RareLootNotice[];
  nextRareLootId:number;
  levelUpNotice:LevelUpNotice|null;
  nextLevelUpId:number;
  dismissLevelUp:(id:number)=>void;
  dismissRareLoot:(id:number)=>void;
  quests: Record<string, QuestRuntimeState>;
  defeatedBosses: string[];
  bossEncounter: BossEncounter | null;
  targetLock:{id:string;name:string}|null;
  worldContent: ContentWorldState;
  unlockedTownShrines:string[];
  travelOriginTownId:string | null;
  travelRequest:string | null;
  travelRequestSource:'map' | 'shrine' | null;
  navigation: NavigationState;
  activeSkillStatus:ActiveSkillStatus;
  storyFlags:Record<string,boolean>;
  storyChoices:Record<string,string>;
  trackedQuestId:string|null;
  cinematic:{id:string;title:string;line:string;ready:boolean;covered?:boolean;ending?:boolean;focusNpcId?:string;illustration?:StoryPanelRef}|null;
  pendingCinematic:string|null;
  cinematicQueue:string[];
  skipCinematicRequested:boolean;
  chooseDialogue:(id:string)=>void;
  trackQuest:(id:string)=>void;
  setStoryFlag:(id:string)=>void;
  requestCinematicSkip:()=>void;
  setActiveSkillStatus:(status:ActiveSkillStatus) => void;
  setBossEncounter:(encounter:BossEncounter | null) => void;
  setVitals: (hp: number, stamina: number) => void;
  damagePlayer: (amount: number) => void;
  setWorldStatus: (worldX: number, worldY: number, regionId: RegionId, townId: string | null) => void;
  setClock: (day: number, minuteOfDay: number) => void;
  openPanel: (panel: Exclude<Panel, null>) => void;
  closePanel: () => void;
  openShrineTravel:(townId:string) => void;
  requestShrineTravel:(townId:string) => void;
  requestMapTravel:(townId:string) => void;
  clearShrineTravelRequest:() => void;
  startDialogue: (npcId: string) => void;
  advanceDialogue: () => void;
  endDialogue: () => void;
  showToast: (message: string) => void;
  clearToast: () => void;
  progressQuest: (type: QuestObjective['type'], targetId: string, amount?: number,questId?:string) => void;
  addRewards: (xp: number, gold: number) => void;
  markBossDefeated: (bossId: string) => void;
  recordEnemyDefeat: (enemyId: string, xp: number, gold: number, bossId?: string, worldContent?: ContentWorldState, contentId?:string, lootEligible?:boolean,defeatRegion?:RegionId) => void;
  allocateAttribute: (attribute: AttributeId) => void;
  unlockSkill: (skillId: SkillId) => void;
  setContentWorld: (worldContent: ContentWorldState) => void;
  setNavigation: (navigation: NavigationState) => void;
  hydrate: (partial: Partial<GameState>) => void;
  resetGame: () => void;
}

const initialQuestState = initialQuests;

const baseState = () => ({
  housing:emptyHousing(),housingContext:null as string|null,housingEditing:false,
  worldAscensionReadyAt:0,
  dungeons:{} as DungeonLedger,activeDungeonId:null as string|null,
  towerExitRequest:null as GameState['towerExitRequest'],
  towerPractice:null as TowerPractice|null,towerPracticeRequest:null as GameState['towerPracticeRequest'],
  nextTowerResetAt:nextTowerWeeklyReset(),
  armorInventory:[] as string[],equippedArmor:emptyArmorLoadout(),armorBonuses:{...NO_ARMOR_BONUSES},
  contracts:{} as ContractLedger,contractBoardTownId:null as string|null,
  aliceRemark:null as GameState['aliceRemark'],
  journal:restoreJournal(emptyJournal(),{inventory:localPlayCheatsEnabled()?WEAPONS.map(w=>w.id):['roadwarden-sword'],defeatedBosses:[],regionId:'trandum'}),
  playerName: LEIGNERON.name,
  hp: 100,
  maxHp: 100,
  stamina: 100,
  maxStamina: 100,
  level: localPlayCheatsEnabled()?BASE_LEVEL_CAP:1,
  xp: localPlayCheatsEnabled()?xpTotalForLevel(BASE_LEVEL_CAP):0,
  attributes: { ...BASE_ATTRIBUTES },
  statPoints: localPlayCheatsEnabled()?attributeBudget(BASE_LEVEL_CAP):0,
  skillPoints: localPlayCheatsEnabled()?skillBudget(BASE_LEVEL_CAP):0,
  learnedSkills: [] as SkillId[],
  gold: localPlayCheatsEnabled()?LOCAL_TEST_GOLD:18,
  weaponId: LEIGNERON.starterWeaponId,
  inventory: localPlayCheatsEnabled()?WEAPONS.map(w=>w.id):['roadwarden-sword'],
  weaponUpgrades:{} as WeaponUpgradeLedger,bossMaterials:{} as Record<string,number>,
  bossHearts:{} as Record<string,number>,awakenedWeapons:localPlayCheatsEnabled()?AWAKENING_PROFILES.map(p=>p.weaponId):[],
  consumables:{'healing-potion':2,'stamina-potion':1},vitalRevision:0,
  learnedCombatArts:[] as ActiveSkillId[],skillSlots:[...DEFAULT_SKILL_SLOTS] as (ActiveSkillId|null)[],
  worldX: LEIGNERON.spawn.x,
  worldY: LEIGNERON.spawn.y,
  regionId: 'trandum' as RegionId,
  townId: 'oakmere' as string | null,
  day: 1,
  minuteOfDay: 8 * 60,
  weatherLabel:'Clear skies',weatherAudio:true,
  harborPortId:null as string|null,passageRequest:null as string|null,passage:null as GameState['passage'],
  screenTransition:null as ScreenTransitionState|null,
  panel: null as Panel,
  dialogue: null as DialogueState | null,
  toast: 'Welcome to Mernodna.',
  rareLootQueue:[] as RareLootNotice[],nextRareLootId:0,
  levelUpNotice:null as LevelUpNotice|null,nextLevelUpId:0,
  quests: initialQuestState(),
  defeatedBosses: [] as string[],
  bossEncounter: null as BossEncounter | null,
  targetLock:null as GameState['targetLock'],
  worldContent: { states: {}, spawns: {}, nextSpawnSequence: 0 } as ContentWorldState,
  unlockedTownShrines:[] as string[],
  travelOriginTownId:null as string | null,
  travelRequest:null as string | null,
  travelRequestSource:null as 'map' | 'shrine' | null,
  navigation: { heading: Math.PI, target: null, markers: [], interaction: null } as NavigationState,
  activeSkillStatus:initialActiveSkillStatus(),
  storyFlags:{[CAMPAIGN_REVISION_FLAG]:true,[INDOOR_STORY_FLAG]:true,[ADVENTURE_REVISION_FLAG]:true,[COMBAT_CLEARANCE_REVISION_FLAG]:true,[ROAD_STORIES_REVISION]:true,[ROAD_POLISH_REVISION]:true} as Record<string,boolean>,storyChoices:{} as Record<string,string>,trackedQuestId:'first-road' as string|null,
  cinematic:null as GameState['cinematic'],pendingCinematic:'roadborn-opening' as string|null,cinematicQueue:[] as string[],skipCinematicRequested:false,
});

/** Exclusive final chest and recovery banking use one idempotent award path. */
function magusTreasure(state:GameState,id:string):Partial<GameState>{
  if(id!==MAGUS_TREASURE_FLOOR)return {};
  const missing=SHADOW_MAGUS_ARMOR_IDS.filter(item=>!state.armorInventory.includes(item));
  if(!missing.length)return {};
  return {armorInventory:[...state.armorInventory,...missing],nextRareLootId:state.nextRareLootId+1,
    rareLootQueue:[...state.rareLootQueue,{id:state.nextRareLootId,kind:'armor-set',weaponId:SHADOW_MAGUS_ARMOR_IDS[0],gold:0,newArmorPieces:missing.length}]};
}
function experienceProgress(state: GameState, xp: number) {
  const cap=playerLevelCap(state.storyFlags);
  const totalXp = Math.min(xpTotalForLevel(cap),state.xp + xp);
  const level = levelForExperience(totalXp,cap);
  const levelsGained = Math.max(0, level - state.level);
  const learningPointsGained=Math.max(0,skillBudget(level)-skillBudget(state.level));
  return {
    xp: totalXp,
    level,
    statPoints: state.statPoints + levelsGained * STAT_POINTS_PER_LEVEL,
    skillPoints: state.skillPoints + learningPointsGained,
    ...(levelsGained?{levelUpNotice:{id:state.nextLevelUpId,from:state.levelUpNotice?.from??state.level,level,
      attributes:(state.levelUpNotice?.attributes??0)+levelsGained*STAT_POINTS_PER_LEVEL,
      learning:(state.levelUpNotice?.learning??0)+learningPointsGained},nextLevelUpId:state.nextLevelUpId+1}:{}),
    ...(levelsGained ? { toast: `Level ${level}! +${levelsGained * STAT_POINTS_PER_LEVEL} attribute points${learningPointsGained ? ` and +${learningPointsGained} learning point${learningPointsGained === 1 ? '' : 's'}` : ''}.${state.level<60&&level>=60?' Barrage unlocked! Equip it in Status > Usable skills.':''}` } : {}),
  };
}

/** Settle earned boss chests before clearing run/week masks. Gear, quests and
 * all non-tower dungeons are untouched; an expired week pays at most once. */
function settleTowerRun(state:GameState,expired=false,now=Date.now()):Partial<GameState>{
  const checkpoint=towerCheckpoint(state.dungeons),dungeons={...state.dungeons};
  let xp=0,gold=0,magusReward=false;
  for(const d of TOWER_FLOORS){
    const p=dungeons[d.id];if(!p)continue;
    const earned=d.tower!.floor===5&&dungeonCleared(d,p)&&!p.claimed;
    if(earned){
      const reward=earnedRewards(d.xp,d.gold,state.attributes,state.learnedSkills,state.armorBonuses);
      xp+=reward.xp;gold+=reward.gold;if(d.id===MAGUS_TREASURE_FLOOR)magusReward=true;
    }
    if(expired||d.tower!.chamber>checkpoint)delete dungeons[d.id];
    else if(earned)dungeons[d.id]={...p,claimed:true};
  }
  return {...experienceProgress(state,xp),gold:state.gold+gold,dungeons,towerExitRequest:null,towerPractice:null,towerPracticeRequest:null,
    nextTowerResetAt:expired?nextTowerWeeklyReset(now):state.nextTowerResetAt,
    ...(magusReward?magusTreasure(state,MAGUS_TREASURE_FLOOR):{}),...(['tower-exit','tower-practice'].includes(state.panel??'')?{panel:null}:{})};
}

export const useGameStore = create<GameState>((set, get) => ({
  ...baseState(),
  edmundWorldAscension:step=>set(state=>{
    if(step==='cancel')return {worldAscensionReadyAt:0};
    const dialogue=state.dialogue,npc=NPC_BY_ID[EDMUND_ATWOOD_ID];
    if(state.level!==MAX_PLAYER_LEVEL||!state.storyFlags[BREAKTHROUGH_COMPLETE]||state.storyFlags[WORLD_ASCENSION]
      ||dialogue?.npcId!==EDMUND_ATWOOD_ID||dialogue.questId||dialogue.choices?.length
      ||dialogue.lineIndex<(dialogue.lines??npc.dialogue).length-1||state.panel||state.cinematic||state.hp<=0||state.activeSkillStatus.casting)return {};
    if(step==='warn')return acceptUiAction()?{worldAscensionReadyAt:Date.now()+ASCENSION_CONFIRM_DELAY_MS}:{};
    // A second, delayed interaction is mandatory; opening the warning cannot
    // propagate a pointer/key event into an irreversible confirmation.
    if(!state.worldAscensionReadyAt||Date.now()<state.worldAscensionReadyAt||!acceptUiAction())return {};
    return {worldAscensionReadyAt:0,storyFlags:{...state.storyFlags,[WORLD_ASCENSION]:true},
      dialogue:{...dialogue,lines:['All right, lad. We cannot undo this. You’ll need everything I’ve taught you, and more besides. Don’t mistake a familiar road for a safe one.','And come home when you’re tired. You’re not too strong to need a meal and a night’s rest. I’ll be here.'],lineIndex:0},
      toast:'World Ascension is permanent: all enemies Lv.120, stronger HP and attacks. Attribute caps raised to 60.'};
  }),
  edmundBreakthrough:()=>set(state=>{
    const dialogue=state.dialogue,npc=NPC_BY_ID[EDMUND_ATWOOD_ID];
    if(state.level<BASE_LEVEL_CAP||dialogue?.npcId!==EDMUND_ATWOOD_ID||dialogue.questId||dialogue.choices?.length
      ||dialogue.lineIndex<(dialogue.lines??npc.dialogue).length-1||state.panel||state.cinematic||state.activeSkillStatus.casting||state.storyFlags[BREAKTHROUGH_COMPLETE])return state;
    if(!state.storyFlags[BREAKTHROUGH_ACCEPTED])return {storyFlags:{...state.storyFlags,[BREAKTHROUGH_ACCEPTED]:true},
      dialogue:{...dialogue,lines:['You’ve learned all I can teach you here. If you’re set on going further, go back to Darkav and face Varkhul again. Keep your head this time. Watch him, not just your sword.','Then come home and tell me how you did it. I want to know you can survive out there without me beside you.'],lineIndex:0},
      toast:'Breakthrough trial accepted: defeat Varkhul, then report to Edmund.'};
    if(!state.storyFlags[BREAKTHROUGH_TRIAL])return {toast:'Trial in progress: face Varkhul again in Darkav, then return to Edmund in Oakmere.'};
    return {storyFlags:{...state.storyFlags,[BREAKTHROUGH_COMPLETE]:true},
      dialogue:{...dialogue,lines:['There you are. I’ve been watching the road since morning. Sit down—no, the sword can wait. Tell me what happened.','You’ve come a long way from the lad who used to shut his eyes when I swung at him. There’s more you can learn yet. For tonight, though, you’ve earned a rest.'],lineIndex:0},
      toast:'Breakthrough complete! Level cap raised to 75. Barrage unlocks at level 60.'};
  }),
  resetTowerRun:()=>set(state=>settleTowerRun(state,Date.now()>=state.nextTowerResetAt)),
  refreshTowerWeek:()=>{
    const state=get(),now=Date.now();
    // The scene must release its active actors before replacing their ledger.
    if(now<state.nextTowerResetAt||state.activeDungeonId&&DUNGEON_BY_ID[state.activeDungeonId]?.tower)return false;
    set(settleTowerRun(state,true,now));return true;
  },
  requestTowerExit:floorId=>set(state=>{
    const d=DUNGEON_BY_ID[floorId];
    if(!d?.tower||state.activeDungeonId!==floorId||!dungeonCleared(d,towerFloorProgress(floorId,state.dungeons,state.towerPractice))
      ||state.panel||state.dialogue||state.cinematic||state.hp<=0||state.activeSkillStatus.casting)return {};
    return {panel:'tower-exit',towerExitRequest:{floorId,confirmed:false}};
  }),
  confirmTowerExit:()=>set(state=>state.panel==='tower-exit'&&state.towerExitRequest&&acceptUiAction()
    ?{panel:null,towerExitRequest:{...state.towerExitRequest,confirmed:true}}:{}),
  openTowerPractice:()=>set(state=>{
    const d=state.activeDungeonId?DUNGEON_BY_ID[state.activeDungeonId]:undefined;
    if(!d?.tower||state.panel||state.dialogue||state.cinematic||state.hp<=0||state.activeSkillStatus.casting
      ||!dungeonCleared(d,towerFloorProgress(d.id,state.dungeons,state.towerPractice))
      ||!towerPracticeAvailable(state.dungeons,state.nextTowerResetAt))return {};
    return {panel:'tower-practice',towerPracticeRequest:null};
  }),
  selectTowerPracticeFloor:(floorId,week)=>set(state=>{
    if(state.panel!=='tower-practice'||!acceptUiAction())return {};
    if(week!==state.nextTowerResetAt||!towerPracticeAvailable(state.dungeons,state.nextTowerResetAt))
      return {panel:null,towerPracticeRequest:null,toast:'The tower has renewed. Complete this week’s tower to unlock practice again.'};
    const current=state.activeDungeonId?DUNGEON_BY_ID[state.activeDungeonId]:undefined;
    if(!DUNGEON_BY_ID[floorId]?.tower||!current?.tower||!dungeonCleared(current,towerFloorProgress(current.id,state.dungeons,state.towerPractice))
      ||state.dialogue||state.cinematic||state.hp<=0||state.activeSkillStatus.casting)return {};
    return {panel:null,towerPractice:{floorId,week,progress:newDungeonProgress()},towerPracticeRequest:{floorId,week}};
  }),
  discoverDungeon:id=>set(state=>Object.hasOwn(DUNGEON_BY_ID,id)&&!state.dungeons[id]
    ?{dungeons:{...state.dungeons,[id]:newDungeonProgress()},toast:`Discovered: ${DUNGEON_BY_ID[id].name}`} :{}),
  refreshDungeon:id=>set(state=>Object.hasOwn(DUNGEON_BY_ID,id)&&!DUNGEON_BY_ID[id].tower&&state.activeDungeonId!==id&&dungeonResetReady(state.dungeons[id])
    ?{dungeons:{...state.dungeons,[id]:newDungeonProgress(((state.dungeons[id].rotation??0)+1)%1000000)}}:state),
  recordDungeonDefeat:(id,slot)=>set(state=>{
    if(state.towerPractice){
      const practice=state.towerPractice,d=DUNGEON_BY_ID[id];
      if(!d?.tower||practice.floorId!==id||state.activeDungeonId!==id||practice.week!==state.nextTowerResetAt||Date.now()>=practice.week
        ||!Number.isInteger(slot)||slot<0||slot>=d.enemies.length||practice.progress.defeated&(1<<slot))return {};
      return {towerPractice:{...practice,progress:{...practice.progress,defeated:practice.progress.defeated|(1<<slot)}}};
    }
    const d=DUNGEON_BY_ID[id],p=state.dungeons[id];
    if(!d||!p||state.activeDungeonId!==id||p.claimed||!Number.isInteger(slot)||slot<0||slot>=d.enemies.length||p.defeated&(1<<slot))return {};
    return {dungeons:{...state.dungeons,[id]:{...p,defeated:p.defeated|(1<<slot)}},journal:discoverCreature(state.journal,dungeonEnemyId(d,slot,p),undefined,true)};
  }),
  claimDungeonChest:id=>set(state=>{
    if(state.towerPractice&&DUNGEON_BY_ID[id]?.tower)return {};
    const d=DUNGEON_BY_ID[id],p=state.dungeons[id];
    if(!d||!p||p.claimed||state.activeDungeonId!==id||!dungeonCleared(d,p)||state.panel||state.dialogue||state.cinematic||state.hp<=0||state.activeSkillStatus.casting)return {};
    const reward=earnedRewards(d.xp,d.gold,state.attributes,state.learnedSkills,state.armorBonuses);
    const contracts={...state.contracts};
    for(const [key,progress] of Object.entries(contracts))if(contractById(key)?.dungeonId===id&&!progress.claimed)contracts[key]={...progress,progress:1};
    return {...experienceProgress(state,reward.xp),gold:state.gold+reward.gold,dungeons:{...state.dungeons,[id]:{...p,claimed:true,...(!d.tower?{respawnAt:Date.now()+DUNGEON_RESET_MS}:{})}},contracts,...magusTreasure(state,id),
      toast:d.tower?(d.tower.floor===5?`${d.name}: +${reward.gold}G and +${reward.xp} XP. This chamber's reward has been claimed. Interact again to ascend.`:'Floor cleared. The next arena awaits.')
        :`${d.name} cleared! Chest: +${reward.gold}G and +${reward.xp} XP. Cave reset: 20 minutes. Leave and return to challenge it again. Any accepted cave contract is ready at its notice board.`};
  }),
  askAliceToAdventure:following=>{
    const state=get(),dialogue=state.dialogue;
    if(dialogue?.npcId!==ALICE_NPC_ID||dialogue.choices?.length||state.panel||state.cinematic
      ||dialogue.lineIndex<(dialogue.lines??NPC_BY_ID[ALICE_NPC_ID].dialogue).length-1)return;
    // Finish any quest conversation normally before changing party membership.
    get().endDialogue();if(get().dialogue)return;
    set(current=>({storyFlags:{...current.storyFlags,[ALICE_COMPANION_FLAG]:following},aliceRemark:null,
      toast:following?'Alice: "Let me get my bow. I\'m coming with you."':'Alice: "I\'ll head home to Oakmere. Come find me when you\'re ready."'}));
  },
  discoverCreature:(enemyId,bossId,defeated=false)=>set(state=>{
    const journal=discoverCreature(state.journal,enemyId,bossId,defeated);
    return journal===state.journal?state:{journal};
  }),
  discoverRecord:(kind,id)=>set(state=>{
    const journal=discoverJournalEntry(state.journal,kind,id);return journal===state.journal?state:{journal};
  }),
  buyItem:(npcId,itemId)=>set(state=>{
    const dialogue=state.dialogue,npc=NPC_BY_ID[npcId];
    if(dialogue?.npcId!==npcId||!npc||state.cinematic||state.panel||dialogue.choices?.length
      ||dialogue.lineIndex<(dialogue.lines??npc.dialogue).length-1)return {};
    const offer=merchantStock(npcId).find(o=>o.id===itemId);
    if(!offer||state.gold<offer.price||state.level<offer.minLevel)return {toast:'You need more gold or experience for that purchase.'};
    if(ARMOR_BY_ID[itemId]){
      if(state.armorInventory.includes(itemId))return {toast:'That armor is already in your bag.'};
      return {gold:localPlayCheatsEnabled()?LOCAL_TEST_GOLD:state.gold-offer.price,armorInventory:[...state.armorInventory,itemId],toast:`Purchased ${itemName(itemId)}. Equip it in your bag.`};
    }
    if(WEAPON_BY_ID[itemId]){
      if(state.inventory.includes(itemId))return {toast:'That blade is already in your bag.'};
      return {gold:localPlayCheatsEnabled()?LOCAL_TEST_GOLD:state.gold-offer.price,inventory:[...state.inventory,itemId],journal:discoverJournalEntry(state.journal,'weapons',itemId),toast:`Purchased ${itemName(itemId)}. Equip it in your bag.`};
    }
    const id=itemId as PotionId;if(!POTIONS[id]||state.consumables[id]>=99)return {toast:'You cannot carry any more of that draught.'};
    return {gold:localPlayCheatsEnabled()?LOCAL_TEST_GOLD:state.gold-offer.price,consumables:{...state.consumables,[id]:state.consumables[id]+1},toast:`Purchased ${itemName(id)}.`};
  }),
  resetAttributes:npcId=>set(state=>{
    const dialogue=state.dialogue,lines=dialogue?.lines??NPC_BY_ID[npcId]?.dialogue??[];
    if(npcId!==EDMUND_ATWOOD_ID||dialogue?.npcId!==npcId||dialogue.choices?.length||state.panel||state.cinematic
      ||!dialogue||dialogue.lineIndex<lines.length-1||state.activeSkillStatus.casting)return {};
    const spent=Object.values(state.attributes).reduce((sum,n)=>sum+n,0);
    if(!spent)return {toast:'You have not assigned any attributes yet.'};
    if(state.gold<1500)return {toast:'Edmund needs 1,500 gold to retrain you.'};
    const derived=progressionStats({...BASE_ATTRIBUTES},state.learnedSkills,state.armorBonuses);
    return {gold:localPlayCheatsEnabled()?LOCAL_TEST_GOLD:state.gold-1500,
      attributes:{...BASE_ATTRIBUTES},statPoints:state.statPoints+spent,
      maxHp:derived.maxHp,maxStamina:derived.maxStamina,
      hp:Math.max(1,Math.min(derived.maxHp,Math.round(state.hp/state.maxHp*derived.maxHp))),
      stamina:Math.max(0,Math.min(derived.maxStamina,Math.round(state.stamina/state.maxStamina*derived.maxStamina))),
      vitalRevision:state.vitalRevision+1,
      toast:`Edmund returned ${spent} attribute points for 1,500 gold. Your skills are unchanged.`};
  }),
  awakenBossWeapon:(npcId,weaponId)=>set(state=>{
    const profile=AWAKENING_BY_WEAPON[weaponId],dialogue=state.dialogue;
    if(!profile||!state.inventory.includes(weaponId)||state.awakenedWeapons.includes(weaponId)
      ||dialogue?.npcId!==npcId||!isBlacksmith(npcId)||dialogue.questId||dialogue.choices?.length
      ||dialogue.lineIndex<(dialogue.lines??NPC_BY_ID[npcId]?.dialogue??[]).length-1
      ||state.panel||state.cinematic||state.activeSkillStatus.casting||state.hp<=0)return {};
    const hearts=state.bossHearts[profile.bossId]??0;
    if(hearts<AWAKENING_HEART_COST)return {toast:`Bring ${AWAKENING_HEART_COST} ${profile.heart} to awaken this weapon.`};
    if(!acceptUiAction())return {};
    return {bossHearts:{...state.bossHearts,[profile.bossId]:hearts-AWAKENING_HEART_COST},
      awakenedWeapons:[...state.awakenedWeapons,weaponId],toast:`${profile.name} awakened! Equip it to wear ${profile.form}. Enhancement rank preserved; armor stats are unchanged.`};
  }),
  enhanceBossWeapon:(npcId,weaponId)=>set(state=>{
    const dialogue=state.dialogue,lines=dialogue?.lines??NPC_BY_ID[npcId]?.dialogue??[];
    if(dialogue?.npcId!==npcId||!isBlacksmith(npcId)||!dialogue||dialogue.choices?.length
      ||dialogue.lineIndex<lines.length-1||state.panel||state.cinematic||state.activeSkillStatus.casting
      ||!BOSS_WEAPON_IDS.has(weaponId)||!state.inventory.includes(weaponId))return {};
    const rank=state.weaponUpgrades[weaponId]??0,materials=state.bossMaterials[weaponId]??0;
    if(rank>=MAX_WEAPON_UPGRADE)return {toast:'This boss weapon is already fully enhanced.'};
    if(materials<1)return {toast:'Bring a duplicate of this same boss weapon to the forge.'};
    return {weaponUpgrades:{...state.weaponUpgrades,[weaponId]:rank+1},
      bossMaterials:{...state.bossMaterials,[weaponId]:materials-1},
      toast:`${state.awakenedWeapons.includes(weaponId)?AWAKENING_BY_WEAPON[weaponId].name:itemName(weaponId)} enhanced to +${rank+1}!`};
  }),
  equipWeapon:id=>set(state=>state.panel==='inventory'&&!state.dialogue&&!state.cinematic&&!state.activeSkillStatus.casting&&state.inventory.includes(id)&&Object.hasOwn(WEAPON_BY_ID,id)
    ?{weaponId:id,toast:`Equipped ${state.awakenedWeapons.includes(id)?AWAKENING_BY_WEAPON[id]?.name??WEAPON_BY_ID[id].name:WEAPON_BY_ID[id].name}.`}:{}),
  equipLocalWeaponForm:(id,awakened)=>set(state=>{
    const profile=AWAKENING_BY_WEAPON[id];
    if(!localPlayCheatsEnabled()||!profile||!state.inventory.includes(id)||state.panel!=='inventory'
      ||state.dialogue||state.cinematic||state.activeSkillStatus.casting||state.hp<=0)return {};
    const forms=state.awakenedWeapons.filter(weaponId=>weaponId!==id);
    return {weaponId:id,awakenedWeapons:awakened?[...forms,id]:forms,
      toast:`Local test: equipped ${awakened?profile.name:WEAPON_BY_ID[id].name}. Enhancement rank preserved.`};
  }),
  equipArmor:id=>set(state=>{
    const item=Object.hasOwn(ARMOR_BY_ID,id)?ARMOR_BY_ID[id]:undefined;
    if(!item||state.panel!=='inventory'||state.dialogue||state.cinematic||state.hp<=0||state.activeSkillStatus.casting
      ||!state.armorInventory.includes(id)||state.level<item.minLevel||state.equippedArmor[item.slot]===id)return {};
    const equippedArmor={...state.equippedArmor,[item.slot]:id},armorBonuses=armorBonusesFor(equippedArmor);
    const derived=progressionStats(state.attributes,state.learnedSkills,armorBonuses);
    return {equippedArmor,armorBonuses,maxHp:derived.maxHp,hp:Math.min(state.hp,derived.maxHp),
      vitalRevision:state.vitalRevision+1,toast:`Equipped ${item.name}.`};
  }),
  unequipArmor:slot=>set(state=>{
    if(!ARMOR_SLOTS.includes(slot)||!state.equippedArmor[slot]||state.panel!=='inventory'||state.dialogue||state.cinematic||state.hp<=0||state.activeSkillStatus.casting)return {};
    const equippedArmor={...state.equippedArmor,[slot]:null},armorBonuses=armorBonusesFor(equippedArmor);
    const derived=progressionStats(state.attributes,state.learnedSkills,armorBonuses);
    return {equippedArmor,armorBonuses,maxHp:derived.maxHp,hp:Math.min(state.hp,derived.maxHp),
      vitalRevision:state.vitalRevision+1,toast:`Removed ${slot} armor.`};
  }),
  usePotion:id=>set(state=>{
    const p=POTIONS[id];if((state.panel!==null&&state.panel!=='inventory')||state.dialogue||state.cinematic||!p||state.hp<=0||state.activeSkillStatus.casting||state.consumables[id]<=0)return {};
    if((p.hp&&state.hp>=state.maxHp)||(p.stamina&&state.stamina>=state.maxStamina))return {toast:'No need to drink that yet.'};
    return {hp:Math.min(state.maxHp,state.hp+p.hp),stamina:Math.min(state.maxStamina,state.stamina+p.stamina),
      vitalRevision:state.vitalRevision+1,consumables:{...state.consumables,[id]:state.consumables[id]-1},toast:`Used ${p.name}.`};
  }),
  learnCombatArt:id=>set(state=>{
    const s=ACTIVE_SKILL_BY_ID[id];if(!s?.learnCost||state.panel!=='character'||state.level<s.minLevel||state.skillPoints<s.learnCost||state.learnedCombatArts.includes(id))return {};
    return {skillPoints:state.skillPoints-s.learnCost,learnedCombatArts:[...state.learnedCombatArts,id],toast:`Learned ${s.name}. Assign it to one of your four slots.`};
  }),
  setSkillSlot:(slot,id)=>set(state=>{
    if(state.panel!=='character'||state.activeSkillStatus.casting||!Number.isInteger(slot)||slot<0||slot>3)return {};
    if(id==='barrage'&&!state.storyFlags[BREAKTHROUGH_COMPLETE])return {};
    if(id){const s=ACTIVE_SKILL_BY_ID[id];if(!s||state.level<s.minLevel||s.learnCost&&!state.learnedCombatArts.includes(id))return {};}
    const slots=state.skillSlots.map(value=>id&&value===id?null:value);slots[slot]=id;
    return {skillSlots:slots};
  }),
  setVitals: (hp, stamina) => set(state=>state.hp===hp&&state.stamina===stamina?state:{hp,stamina}),
  damagePlayer: (amount) => set((state) => ({ hp: Math.max(0, state.hp - amount) })),
  setWorldStatus: (worldX, worldY, regionId, townId) => set(state=>{
    const journal=discoverJournalEntry(state.journal,'regions',regionId);
    return state.worldX===worldX&&state.worldY===worldY&&state.regionId===regionId&&state.townId===townId&&state.journal===journal
      ?state:{worldX,worldY,regionId,townId,journal};
  }),
  setClock: (day, minuteOfDay) => set(state=>{
    // On each three-day boundary, forget only expired claimed offers.
    // Active or completed-but-uncollected contracts remain available.
    if(contractBoardCycle(day)===contractBoardCycle(state.day))return {day,minuteOfDay};
    return {day,minuteOfDay,contracts:expireClaimedContracts(state.contracts,day)};
  }),
  openPanel: (panel) => {if(!get().cinematic&&!get().screenTransition&&!get().passage)set({ panel });},
  closePanel: () => set({ panel: null,towerExitRequest:null,towerPracticeRequest:null,contractBoardTownId:null,travelOriginTownId:null,travelRequest:null,travelRequestSource:null }),
  openContractBoard:townId=>set(state=>Object.hasOwn(TOWN_BY_ID,townId)&&!state.panel&&!state.dialogue&&!state.cinematic
    ?{panel:'contracts',contractBoardTownId:townId,aliceRemark:null}:{}),
  acceptContract:id=>set(state=>{
    const c=contractById(id);
    if(!c||state.panel!=='contracts'||state.contractBoardTownId!==c.townId||state.contracts[id]||state.cinematic
      ||!boardContracts(c.townId,state.day).some(offer=>offer.id===id))return {};
    if(outstandingContracts(state.contracts)>=MAX_ACTIVE_CONTRACTS)return {toast:`Finish or abandon a contract first. You can carry ${MAX_ACTIVE_CONTRACTS}.`};
    // A renewed bounty/cave should never stack with an older unclaimed
    // commission for the same boss/chest and pay twice from a single clear.
    const sameTarget=Object.entries(state.contracts).some(([otherId,p])=>{
      if(p.claimed)return false;
      const other=contractById(otherId);
      return Boolean(other&&(c.bossId&&other.bossId===c.bossId
        ||c.dungeonId&&other.dungeonId===c.dungeonId));
    });
    if(sameTarget)return {toast:'Finish or abandon your existing bounty or cave contract for this target first.'};
    // An already-opened chest cannot fulfill a newly accepted cave job.
    return {contracts:{...state.contracts,[id]:{progress:0,claimed:false}},
      toast:`Accepted: ${c.title}.${c.dungeonId?' Clear the cave and open its chest after accepting.':' Only new defeats count.'}`};
  }),
  claimContract:id=>set(state=>{
    const c=contractById(id),p=state.contracts[id];
    if(!c||!p||p.claimed||p.progress!==c.amount||state.panel!=='contracts'||state.contractBoardTownId!==c.townId||state.cinematic)return {};
    const reward=earnedRewards(c.xp,c.gold,state.attributes,state.learnedSkills,state.armorBonuses);
    return {contracts:{...state.contracts,[id]:{...p,claimed:true}},...experienceProgress(state,reward.xp),gold:state.gold+reward.gold,
      toast:`Contract fulfilled: +${reward.gold}G and +${reward.xp} XP.`};
  }),
  abandonContract:id=>set(state=>{
    const p=state.contracts[id];
    if(!p||p.claimed||(state.panel!=='contracts'&&state.panel!=='journal'))return {};
    const contracts={...state.contracts};delete contracts[id];
    return {contracts,toast:'Contract abandoned. Its progress has been cleared.'};
  }),
  dismissAliceRemark:id=>set(state=>state.aliceRemark?.id===id?{aliceRemark:null}:{}),
  openShrineTravel:(townId) => set(state => {
    if (!Object.hasOwn(TOWN_BY_ID,townId)) return {};
    const unlocked = state.unlockedTownShrines.includes(townId);
    return { panel:'travel',travelOriginTownId:townId,travelRequest:null,travelRequestSource:null,
      unlockedTownShrines:unlocked ? state.unlockedTownShrines : [...state.unlockedTownShrines,townId],
      ...(!unlocked ? { toast:`${TOWN_BY_ID[townId].name} shrine attuned. Shrine travel unlocked.` } : {}) };
  }),
  requestShrineTravel:(townId) => set(state => {
    if (state.panel !== 'travel' || !state.travelOriginTownId || townId === state.travelOriginTownId
      || !Object.hasOwn(TOWN_BY_ID,townId)
      || !localSettlementTravelEnabled() && !state.unlockedTownShrines.includes(townId)) return {};
    if(!acceptUiAction())return {};
    return { travelRequest:townId,travelRequestSource:'shrine',panel:null };
  }),
  requestMapTravel:(townId) => set(state => {
    if (!['map','regional-map'].includes(state.panel??'') || state.dialogue || !Object.hasOwn(TOWN_BY_ID,townId)
      || !localSettlementTravelEnabled() && !state.unlockedTownShrines.includes(townId)) return {};
    if(!acceptUiAction())return {};
    return { travelRequest:townId,travelRequestSource:'map',travelOriginTownId:null,panel:null };
  }),
  clearShrineTravelRequest:() => set({ travelRequest:null,travelOriginTownId:null,travelRequestSource:null }),
  startDialogue: (npcId) => {
    const state=get(),npc=NPC_BY_ID[npcId];
    if (!npc || state.panel || state.dialogue || state.cinematic) return;
    const existingConversation=conversationObjective(npcId,state.quests,state.trackedQuestId);
    let quests=state.quests,trackedQuestId=existingConversation?.questId??state.trackedQuestId;
    for(const id of npc.questIds) {
      const q=QUEST_BY_ID[id];
      if(q && quests[id]?.status==='locked' && questRequirementsMet(q,quests,QUEST_BY_ID) && !['first-road','eight-regions'].includes(id)) {
        quests={...quests,[id]:{status:'active',objectiveProgress:id===TOWER_QUEST_ID?quests[id].objectiveProgress:{}}};if(!existingConversation&&(!trackedQuestId||quests[trackedQuestId]?.status!=='active'))trackedQuestId=id;
      }
    }
    const context=conversationObjective(npcId,quests,trackedQuestId);
    const outcome=state.storyFlags['relief-household-charter']?'The old warrants have been cancelled. The palace is letting families stay there while we try to find their relatives.':state.storyFlags['relief-joint-council']?'The families are allowed into the hearings now. Nobody can move them away while we’re still looking for their relatives.':null;
    const localOutcome=['celia-brook','asha-stonevein','iren-copperwake'].includes(npcId)
      &&state.storyFlags['cibar-irrigation-repaired']?
      state.storyFlags['cibar-public-water']?'People know what happened to Celia’s brother now. The people he helped don’t have to give their names unless they want to.':'We’ve sent the evidence to Isabel. The families are keeping the survivors’ names private.':null;
    // News travels unevenly. The archive and watch know official reports;
    // every shopkeeper in Highmere should not recite the same announcement.
    const highmereOutcome=state.quests['crown-summons']?.status==='completed'
      &&['renna-vale','captain-yselle-ward','davin-bridge'].includes(npcId)?
      state.storyFlags['main-public-reports']?'We’ve sent warnings to the towns. I hope people take them seriously.':state.storyFlags['main-watch-reports']?'Isabel’s riders have been carrying letters to the other towns. I hope they get through safely.':'We’ve had some worrying reports from the other towns. I’m still trying to find out what’s true.':null;
    const reaction=reactiveStoryDialogue(npcId,state.quests,state.storyFlags);
    const lines=context?.objective.dialogue ?? (reaction??(highmereOutcome?[highmereOutcome,...npc.dialogue]:localOutcome?[localOutcome,...npc.dialogue]:outcome&&['mairin-reed','nella-harrow','maela-quill','renna-vale'].includes(npcId)?[outcome,...npc.dialogue]:npc.dialogue));
    set({worldAscensionReadyAt:0,quests,trackedQuestId,journal:discoverJournalEntry(state.journal,'characters',npcId),dialogue:{npcId,lineIndex:0,lines,...(context?{questId:context.questId,objectiveId:context.objective.id,choices:context.objective.choices}:{})}});
  },
  advanceDialogue: () => set((state) => state.dialogue&&acceptUiAction()
    &&state.dialogue.lineIndex<(state.dialogue.lines??NPC_BY_ID[state.dialogue.npcId]?.dialogue??[]).length-1
    ? { dialogue: { ...state.dialogue, lineIndex: state.dialogue.lineIndex + 1 } } : {}),
  endDialogue: () => {
    const dialogue=get().dialogue;
    if(!dialogue||!acceptUiAction())return;
    set({dialogue:null,worldAscensionReadyAt:0});
    // Opening/abandoning a conversation isn’t delivering evidence or hearing it.
    if(!dialogue||dialogue.choices?.length||!dialogue.questId
      ||dialogue.lineIndex<(dialogue.lines?.length??1)-1)return;
    const context=conversationObjective(dialogue.npcId,get().quests,dialogue.questId);
    if(context?.questId===dialogue.questId&&context.objective.id===dialogue.objectiveId
      &&['talk','deliver'].includes(context.objective.type))get().progressQuest(context.objective.type,dialogue.npcId,1,dialogue.questId);
  },
  chooseDialogue:(id)=>{
    const state=get(),dialogue=state.dialogue;
    if(!dialogue || dialogue.lineIndex<(dialogue.lines?.length??1)-1 || !dialogue.questId) return;
    const objective=QUEST_BY_ID[dialogue.questId]?.objectives.find(o=>o.id===dialogue.objectiveId);
    const choice=dialogue.choices?.find(c=>c.id===id);
    if(!objective||!choice||!acceptUiAction()) return;
    if(choice.correct===false){set({toast:choice.response,dialogue:{...dialogue,lineIndex:0,lines:[choice.response]}});return;}
    set({storyChoices:{...state.storyChoices,[dialogue.questId+':'+objective.id]:id},
      storyFlags:{...state.storyFlags,...(choice.flag?{[choice.flag]:true}:{})},
      dialogue:{npcId:dialogue.npcId,lineIndex:0,lines:[choice.response]}});
    get().progressQuest(objective.type,objective.targetId,1,dialogue.questId);
    get().showToast(choice.response);
  },
  trackQuest:(id)=>{if(get().quests[id]?.status==='active')set({trackedQuestId:id});},
  setStoryFlag:(id)=>set(state=>({storyFlags:{...state.storyFlags,[id]:true}})),
  requestCinematicSkip:()=>set({skipCinematicRequested:true}),
  showToast: (message) => set({ toast: message }),
  clearToast: () => set({ toast: null }),
  progressQuest: (type, targetId, amount = 1,questId) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const state = get();
    const result = advanceQuests(state.quests, state.defeatedBosses, { type, targetId, amount,questId },state.storyFlags,state.worldContent);
    const scenes=sceneQueue(state.pendingCinematic,state.cinematicQueue,completedStoryScenes(state.quests,result.quests,state.storyFlags),state.storyFlags);
    const shrines=['elarion','starhold','redmesa','deepford','tidewatch','skallheim','blackspire'].filter(id=>(result.quests['eight-regions']?.objectiveProgress['report:'+id]??0)>=1);
    const rewards=earnedRewards(result.xp,result.gold,state.attributes,state.learnedSkills,state.armorBonuses);
    const progression = experienceProgress(state, rewards.xp);
    const completed=Object.keys(result.quests).some(id=>state.quests[id]?.status!=='completed'&&result.quests[id].status==='completed');
    const rewardToast = rewards.xp || rewards.gold ? `${completed?'Quest complete':'Story milestone'} — +${rewards.xp} XP, +${rewards.gold} gold` : null;
    set({ quests: result.quests, gold: state.gold + rewards.gold, ...progression,
      trackedQuestId:state.trackedQuestId&&result.quests[state.trackedQuestId]?.status==='completed'?QUEST_BY_ID[state.trackedQuestId]?.nextQuestId??null:state.trackedQuestId,
      ...scenes,storyFlags:questConsequences(result.quests,state.storyFlags),unlockedTownShrines:[...new Set([...state.unlockedTownShrines,...shrines])],
      ...(rewardToast ? { toast: progression.toast ? `${rewardToast}. ${progression.toast}` : rewardToast } : {}),
    });
  },
  addRewards: (xp, gold) => set((state) => {
    if(!Number.isFinite(xp)||!Number.isFinite(gold)||xp<0||gold<0)return {};
    const rewards=earnedRewards(xp,gold,state.attributes,state.learnedSkills,state.armorBonuses);
    return { ...experienceProgress(state, rewards.xp), gold: state.gold + rewards.gold };
  }),
  markBossDefeated: (bossId) => set((state) => state.defeatedBosses.includes(bossId) ? {} : { defeatedBosses: [...state.defeatedBosses, bossId] }),
  recordEnemyDefeat: (enemyId, xp, gold, bossId, worldContent, contentId, lootEligible=true,defeatRegion) => set((state) => {
    const known=bossId&&state.defeatedBosses.includes(bossId);
    if(known){
      const id=`boss:${bossId}`,previous=state.worldContent.states[id],defeated=worldContent?.states[id];
      // Permanent quest history is not a repeat-battle reward token. A boss
      // must actually return alive in the content ledger, then transition to
      // defeated in the scene’s snapshot. Replaying a death notification (or
      // submitting the same defeated snapshot) cannot pay XP/gold again.
      if(!BOSS_BY_ID[bossId!]?.respawns||!previous||previous.defeated||!(typeof previous.hp==='number'&&previous.hp>0)
        ||!defeated?.defeated||defeated.hp!==0)return {};
    }
    const defeatedBosses = bossId&&!known ? [...state.defeatedBosses, bossId] : state.defeatedBosses;
    const result = advanceQuests(state.quests, defeatedBosses, { type: 'kill', targetId: enemyId, amount: 1,contentId },state.storyFlags,worldContent??state.worldContent);
    const rewards=earnedRewards(xp+result.xp,gold+result.gold,state.attributes,state.learnedSkills,state.armorBonuses);
    const progression = experienceProgress(state, rewards.xp);
    const trophy=bossId?BOSS_WEAPONS[bossId]:undefined;
    const dropped=trophy&&Math.random()<bossWeaponDropChance(state.attributes,state.armorBonuses)?trophy:undefined;
    const duplicate=dropped&&state.inventory.includes(dropped.id);
    const displayedCopies=dropped?allHomeItems(state.housing).filter(i=>!i.stored&&i.weaponId===dropped.id).length:0;
    const excess=Boolean(duplicate&&dropped&&(state.bossMaterials[dropped.id]??0)+displayedCopies>=MAX_BOSS_MATERIALS);
    const salvage=excess&&dropped?earnedRewards(0,dropped.salvage,state.attributes,state.learnedSkills,state.armorBonuses).gold:0;
    const armorPool=bossId&&lootEligible?BOSS_ARMOR[bossId]:undefined;
    const fullArmorSet=Boolean(armorPool?.length&&Math.random()<bossArmorSetDropChance(state.attributes,state.armorBonuses));
    const armorRoll=armorPool&&Math.random()<bossWeaponDropChance(state.attributes,state.armorBonuses);
    const missingArmor=armorRoll?armorPool.filter(a=>!state.armorInventory.includes(a.id)):[];
    const armorChoices=missingArmor.length?missingArmor:armorPool;
    const armorDrop=armorRoll&&armorChoices?armorChoices[Math.floor(Math.random()*armorChoices.length)]:undefined;
    // A full-set roll upgrades the armor reward to all three pieces. Never
    // award the single-piece roll again as an immediate duplicate of the set.
    const armorDrops=fullArmorSet?armorPool!:(armorDrop?[armorDrop]:[]);
    const newArmor=armorDrops.filter(a=>!state.armorInventory.includes(a.id));
    const armorSalvage=armorDrops.reduce((total,a)=>total+(state.armorInventory.includes(a.id)
      ?earnedRewards(0,a.salvage,state.attributes,state.learnedSkills,state.armorBonuses).gold:0),0);
    const notices:RareLootNotice[]=[];
    const heart=bossId&&lootEligible?AWAKENING_BY_BOSS[bossId]:undefined;
    const heartCount=heart?(state.bossHearts[heart.bossId]??0):0;
    const heartDrop=Boolean(heart&&heartCount<MAX_BOSS_HEARTS&&Math.random()<AWAKENING_HEART_DROP_CHANCE);
    if(heart&&heartDrop)notices.push({id:state.nextRareLootId,weaponId:awakeningHeartId(heart.bossId),kind:'heart',gold:0});
    if(dropped)notices.push({id:state.nextRareLootId+notices.length,weaponId:dropped.id,kind:duplicate?(excess?'salvage':'material'):'weapon',gold:salvage});
    if(fullArmorSet)notices.push({id:state.nextRareLootId+notices.length,weaponId:armorDrops[0].id,kind:'armor-set',gold:armorSalvage,newArmorPieces:newArmor.length});
    else if(armorDrop)notices.push({id:state.nextRareLootId+notices.length,weaponId:armorDrop.id,kind:newArmor.length?'armor':'armor-salvage',gold:armorSalvage});
    // Ordinary enemies can occasionally drop a carried draught. No extra
    // potion rolls for temporary boss summons, wildlife or story-only fights.
    const supplyRoll=!bossId&&lootEligible&&canDropPotion(enemyId)
      &&Math.random()<supplyDropChance(state.attributes,state.armorBonuses);
    const primaryPotion:PotionId=supplyRoll&&Math.random()>=.65?'stamina-potion':'healing-potion';
    const otherPotion:PotionId=primaryPotion==='healing-potion'?'stamina-potion':'healing-potion';
    const potion=supplyRoll?(state.consumables[primaryPotion]<99?primaryPotion:
      state.consumables[otherPotion]<99?otherPotion:null):null;
    let journal=discoverCreature(state.journal,enemyId,bossId,true);
    if(dropped)journal=discoverJournalEntry(journal,'weapons',dropped.id);
    const contracts=lootEligible?advanceContracts(state.contracts,enemyId,defeatRegion??state.regionId,bossId):state.contracts;
    const ready=contracts!==state.contracts?Object.keys(contracts).find(id=>{
      const p=contracts[id],previous=state.contracts[id],c=contractById(id);
      return p!==previous&&Boolean(c)&&p.progress===c!.amount;
    }):undefined;
    const breakthroughKill=bossId==='varkhul'&&lootEligible&&state.storyFlags[BREAKTHROUGH_ACCEPTED]&&!state.storyFlags[BREAKTHROUGH_TRIAL];
    const consequenceFlags=questConsequences(result.quests,state.storyFlags);
    return { defeatedBosses, journal, quests: result.quests, ...progression, gold: state.gold + rewards.gold+salvage+armorSalvage,
      ...(heart&&heartDrop?{bossHearts:{...state.bossHearts,[heart.bossId]:heartCount+1}}:{}),
      ...(notices.length?{rareLootQueue:[...state.rareLootQueue,...notices].slice(-8),nextRareLootId:state.nextRareLootId+notices.length}:{}),
      ...(newArmor.length?{armorInventory:[...state.armorInventory,...newArmor.map(a=>a.id)]}:{}),
      contracts,...(ready?{toast:`Contract ready: ${contractById(ready)!.title}. Return to its town notice board.`}:{}),
      ...(dropped?{inventory:duplicate?state.inventory:[...state.inventory,dropped.id],
        ...(duplicate&&!excess?{bossMaterials:{...state.bossMaterials,[dropped.id]:(state.bossMaterials[dropped.id]??0)+1}}:{}),
        toast:duplicate?(excess?`Material storage full: ${itemName(dropped.id)} sold for ${salvage} gold.`:`Duplicate ${itemName(dropped.id)}! Take it to a blacksmith to enhance your weapon.`):`Rare spoil: ${itemName(dropped.id)}! Look in your bag.`}:{}),
      ...(potion?{consumables:{...state.consumables,[potion]:state.consumables[potion]+1},
        toast:`Found ${itemName(potion)}! Check your bag.`}:{}),
      ...sceneQueue(state.pendingCinematic,state.cinematicQueue,completedStoryScenes(state.quests,result.quests,state.storyFlags),state.storyFlags),storyFlags:breakthroughKill?{...consequenceFlags,[BREAKTHROUGH_TRIAL]:true}:consequenceFlags,
      ...(breakthroughKill?{toast:'Breakthrough trial complete: report your victory to Edmund in Oakmere.'}:{}),
      ...(worldContent ? { worldContent } : {}) };
  }),
  dismissRareLoot:id=>set(state=>({rareLootQueue:state.rareLootQueue.filter(notice=>notice.id!==id)})),
  dismissLevelUp:id=>set(state=>state.levelUpNotice?.id===id?{levelUpNotice:null}:{}),
  allocateAttribute: (attribute) => set((state) => {
    if (state.statPoints <= 0 || !Object.hasOwn(BASE_ATTRIBUTES,attribute) || state.attributes[attribute]>=attributeCap(state.storyFlags)) return {};
    const attributes = { ...state.attributes, [attribute]: state.attributes[attribute] + 1 };
    const derived = progressionStats(attributes, state.learnedSkills,state.armorBonuses);
    const addedHp=Math.max(0,derived.maxHp-state.maxHp);
    return { attributes, statPoints: state.statPoints - 1, maxHp: derived.maxHp, maxStamina: derived.maxStamina,
      ...(addedHp?{hp:Math.min(derived.maxHp,state.hp+addedHp),vitalRevision:state.vitalRevision+1}:{}),
      toast: `${attribute[0].toUpperCase()}${attribute.slice(1)} increased.` };
  }),
  unlockSkill: (skillId) => set((state) => {
    const skill = SKILLS.find(entry => entry.id === skillId);
    if (!skill || state.skillPoints < skill.cost || state.level < skill.minLevel || (skill.requires&&!state.learnedSkills.includes(skill.requires)) || state.learnedSkills.includes(skillId)) return {};
    const learnedSkills = [...state.learnedSkills, skillId];
    const derived = progressionStats(state.attributes, learnedSkills,state.armorBonuses);
    const addedHp=Math.max(0,derived.maxHp-state.maxHp);
    return { learnedSkills, skillPoints: state.skillPoints - skill.cost, maxHp: derived.maxHp, maxStamina: derived.maxStamina,
      ...(addedHp?{hp:Math.min(derived.maxHp,state.hp+addedHp),vitalRevision:state.vitalRevision+1}:{}),
      toast: `Skill learned: ${skill.name}.` };
  }),
  setContentWorld: (worldContent) => set({ worldContent }),
  setNavigation: (navigation) => set(state=>sameNavigation(state.navigation,navigation)?state:{navigation}),
  setActiveSkillStatus:(activeSkillStatus) => set(state=>{
    const previous=state.activeSkillStatus;
    return previous.casting===activeSkillStatus.casting&&previous.rallyRemaining===activeSkillStatus.rallyRemaining
      &&Object.keys(ACTIVE_SKILL_BY_ID).every(id=>previous.cooldowns[id as keyof typeof ACTIVE_SKILL_BY_ID]===activeSkillStatus.cooldowns[id as keyof typeof ACTIVE_SKILL_BY_ID])
      ?state:{activeSkillStatus};
  }),
  setBossEncounter:(bossEncounter) => set({ bossEncounter }),
  hydrate: (partial) => set(state=>{
    if(partial.quests)partial={...partial,quests:gateTowerQuest(partial.quests)};
    const cap=playerLevelCap(partial.storyFlags??state.storyFlags);
    const level=Math.min(cap,partial.level??state.level);
    const xp=Math.min(xpTotalForLevel(cap),partial.xp??state.xp);
    if(!localPlayCheatsEnabled())return {...partial,level,xp};
    const gained=Math.max(0,cap-level);
    return {...partial,level:cap,xp:xpTotalForLevel(cap),
      statPoints:(partial.statPoints??state.statPoints)+gained*STAT_POINTS_PER_LEVEL,
      skillPoints:(partial.skillPoints??state.skillPoints)
        +Math.max(0,skillBudget(cap)-skillBudget(level)),
      gold:LOCAL_TEST_GOLD,inventory:WEAPONS.map(w=>w.id),
      // Unlock on save hydration, but don't undo a local form selection every
      // time weather, streaming, cinematics or UI state call hydrate().
      awakenedWeapons:partial.awakenedWeapons!==undefined?AWAKENING_PROFILES.map(p=>p.weaponId):state.awakenedWeapons};
  }),
  buyHome:()=>{
    const s=get();
    const id=s.housingContext?.startsWith('purchase:')?s.housingContext.slice(9):'',property=PLAYER_HOME_BY_ID[id],home=housingFor(s.housing,id);
    if(!property||s.panel!=='housing'||home.owned||s.gold<HOME_PRICE||s.cinematic||s.hp<=0)return false;
    if(!acceptUiAction())return false;
    set({housing:withHome(s.housing,id,{...home,owned:true}),gold:localPlayCheatsEnabled()?LOCAL_TEST_GOLD:s.gold-HOME_PRICE,
      toast:`${property.homeName} is yours. Enter through ${property.name}.`});return true;
  },
  saveHomeLayout:(items,nextId)=>{
    const s=get();
    const id=s.housingContext??'',home=housingFor(s.housing,id);
    if(!PLAYER_HOME_BY_ID[id]||!home.owned||s.panel!=='housing'||!s.housingEditing||s.cinematic)return 'Open the editor inside your home first.';
    const parsed=parseHousing({owned:true,items,nextId});if(!parsed)return 'This layout is invalid. Keep rooms, doors and beds reachable.';
    const old=new Map(home.items.map(i=>[i.id,i]));let cost=0;
    const materials={...s.bossMaterials};
    for(const i of home.items)if(i.weaponId)materials[i.weaponId]=(materials[i.weaponId]??0)+1;
    for(const i of parsed.items){
      const previous=old.get(i.id);
      if(previous&&(previous.art!==i.art||previous.kit!==i.kit))return 'An existing furniture item cannot change its type.';
      if(!previous){if(i.id<home.nextId||i.stored)return 'Invalid new furniture item.';cost+=FURNITURE_BY_ART[i.art]!.price;}
      if(i.weaponId){if(!BOSS_WEAPON_IDS.has(i.weaponId)||(materials[i.weaponId]??0)<1)return 'A spare copy of that boss weapon is required for the rack.';materials[i.weaponId]--;}
    }
    if(s.gold<cost)return `You need ${cost}G to finish this layout.`;
    if(Object.values(materials).some(n=>n>MAX_BOSS_MATERIALS))return 'Your spare-weapon storage is full. Use a duplicate at the forge before clearing this rack.';
    if(nextId<home.nextId)return 'Invalid furniture sequence.';
    const housing=withHome(s.housing,id,parsed);
    if([...BOSS_WEAPON_IDS].some(weaponId=>(materials[weaponId]??0)+allHomeItems(housing).filter(i=>i.weaponId===weaponId).length>MAX_BOSS_MATERIALS))return 'Your spare-weapon storage is full.';
    set({housing,bossMaterials:materials,gold:localPlayCheatsEnabled()?LOCAL_TEST_GOLD:s.gold-cost,housingEditing:false,
      toast:`Home furnished${cost?` for ${cost}G`:''}. Your rooms are ready.`});return null;
  },
  resetGame: () => set(baseState()),
}));
