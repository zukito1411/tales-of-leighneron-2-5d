import type { GameState } from '../store/gameStore';
import {parseHousing,allHomeItems} from '../data/housing';
import { BOSSES, ENEMY_BY_ID,isWolfFamily } from '../data/enemies';
import { QUESTS } from '../data/quests';
import { REGIONS } from '../data/regions';
import { TOWN_BY_ID } from '../data/towns';
import { WEAPON_BY_ID } from '../data/weapons';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../data/world';
import { advanceQuests } from '../game/systems/questProgress';
import { CONTENT_BY_ID, initialContentState } from '../data/content';
import { TOWN_SHRINES } from '../data/townShrines';
import { retiredBoundaryId } from '../data/settlementGeometry';
import type { ContentState, ContentWorldState, CreatureContentDefinition, EncounterBehavior, EncounterRole } from '../game/types';
import { BASE_ATTRIBUTES, MAX_PLAYER_LEVEL, ATTRIBUTE_CAP, STAT_POINTS_PER_LEVEL, attributeBudget, skillBudget, legacySkillBudget, earnedRewards, SKILLS, levelForExperience, xpTotalForLevel, xpNeededForLevel, legacyXpNeededForLevel, legacyXpTotalForLevel, progressionStats, type PlayerAttributes, type SkillId } from '../data/progression';
import {CINEMATICS} from '../data/cinematics';
import {questConsequences} from '../game/systems/storyScenes';
import {WorldGenerator} from '../game/systems/WorldGenerator';
import {onFlagshipDeck,flagshipWalkable} from '../data/pirateFlagship';
import {CAMPAIGN_REVISION_FLAG,INDOOR_STORY_FLAG,INDOOR_STORY_STAGES,COMBAT_CLEARANCE_REVISION_FLAG} from '../data/campaign';
import {ADVENTURE_REVISION_FLAG} from '../data/adventure';
import {ROAD_STORIES_REVISION,ROAD_POLISH_REVISION,ROAD_STORY_FLAG_BUDGET} from '../data/roadStories';
import {migrateRoadStoryProgress} from '../game/systems/roadStoryMigration';
import {ACTIVE_SKILL_BY_ID,DEFAULT_SKILL_SLOTS,type ActiveSkillId} from '../data/activeSkills';
import {POTIONS,type PotionId} from '../data/economy';
import {BOSS_WEAPON_IDS,MAX_WEAPON_UPGRADE,MAX_BOSS_MATERIALS} from '../data/weaponUpgrades';
import {AWAKENING_BY_BOSS,MAX_BOSS_HEARTS} from '../data/awakening';
import {MAX_AREA_MONSTER_LEVEL,globalMonsterBonus,scaledEnemy} from '../data/enemyTiers';
import {parseJournal,restoreJournal,type JournalState} from '../data/journal';
import {parseContracts} from '../data/contracts';
import {parseArmor,armorBonusesFor} from '../data/armor';
import {parseDungeons} from '../data/dungeons';
import {nextTowerWeeklyReset,gateTowerQuest} from '../data/towerOfMight';
import {BASE_LEVEL_CAP,playerLevelCap,attributeCap} from '../data/progression';
import {BREAKTHROUGH_ACCEPTED,BREAKTHROUGH_TRIAL,BREAKTHROUGH_COMPLETE,WORLD_ASCENSION,ASCENDED_MONSTER_LEVEL} from '../data/breakthrough';
import {parseBossPhaseSnapshot} from '../game/systems/BossPhaseState';

export type SavedState = Pick<GameState, 'hp' | 'stamina' | 'level' | 'xp' | 'attributes' | 'statPoints' | 'skillPoints' | 'learnedSkills' | 'gold' | 'weaponId' | 'inventory' | 'worldX' | 'worldY' | 'regionId' | 'townId' | 'day' | 'minuteOfDay' | 'quests' | 'defeatedBosses' | 'worldContent' | 'unlockedTownShrines' | 'storyFlags' | 'storyChoices' | 'trackedQuestId'> & Partial<Pick<GameState,'consumables'|'learnedCombatArts'|'skillSlots'|'weaponUpgrades'|'bossMaterials'|'bossHearts'|'awakenedWeapons'|'nextTowerResetAt'>>;
export interface SaveData { version: 7; savedAt: string; state: SavedState & {housing?:GameState['housing'];cinematicQueue?:string[];journal?:JournalState;contracts?:GameState['contracts'];armorInventory?:string[];equippedArmor?:GameState['equippedArmor'];dungeons?:GameState['dungeons']} }

let lastSaveValidationProblem:string|null=null;
export function getSaveValidationProblem(){return lastSaveValidationProblem;}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function numberIn(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(v => typeof v === 'string');
}
function playerAttributes(value: unknown,cap=ATTRIBUTE_CAP): value is PlayerAttributes {
  return record(value) && Object.keys(BASE_ATTRIBUTES).every(id =>
    numberIn(value[id], 0, cap) && Number.isInteger(value[id]));
}
function skillIds(value: unknown): value is SkillId[] {
  const allowed = SKILLS.map(skill => skill.id);
  return strings(value) && value.every(id => allowed.some(skillId => skillId === id)) && new Set(value).size === value.length;
}

// Enemy HP is level-scaled and alpha wolves get another 35% HP. The old
// 8x-base-HP validator rejected legitimate level-30 alpha wolves and all
// higher-level monsters, blocking saves after encounters or world streaming.
// Validate against the maximum attainable scaling rather than a fixed ratio.
function maximumSavedEnemyHp(definition:CreatureContentDefinition):number {
  const enemy=ENEMY_BY_ID[definition.enemyId];
  const level=Math.max(ASCENDED_MONSTER_LEVEL,MAX_AREA_MONSTER_LEVEL+(enemy.boss?10:5)+globalMonsterBonus(MAX_PLAYER_LEVEL));
  // Varkhul used to have 1,800 base HP. Keep that historical validation ceiling
  // so an existing wounded/max-HP record survives the reduction. Actor restore
  // already converts its saved HP fraction onto today's smaller maximum.
  const scaled=scaledEnemy(enemy.id==='ash-dragon'?{...enemy,hp:Math.max(enemy.hp,1800)}:enemy,level,true).hp;
  return definition.wolfAlpha?Math.round(scaled*1.35):scaled;
}

function invalidSave(reason:string):null {
  lastSaveValidationProblem=reason;
  return null;
}

function contentInvalid(id:string,reason:string):null {
  lastSaveValidationProblem=`World content ${id}: ${reason}`;
  return null;
}

function validateContent(value: unknown): ContentWorldState | null {
  if (!record(value) || !record(value.states) || !record(value.spawns)
    || !numberIn(value.nextSpawnSequence) || !Number.isInteger(value.nextSpawnSequence))
    return contentInvalid('ledger','invalid structure or spawn sequence');
  const spawns: Record<string, CreatureContentDefinition> = {};
  const geography=new WorldGenerator();
  const slots = new Map<string, Set<number>>();
  const groupHomes = new Map<string, {x:number;y:number;radius:number}>();
  for (const [id, d] of Object.entries(value.spawns)) {
    if (!record(d) || d.kind !== 'creature' || d.id !== id || !/^spawn:\d+$/.test(id)
      || Number(id.slice(6)) >= value.nextSpawnSequence || typeof d.enemyId !== 'string'
      || !Object.hasOwn(ENEMY_BY_ID, d.enemyId) || ENEMY_BY_ID[d.enemyId].boss
      || !record(d.world) || !numberIn(d.world.x, 0, WORLD_WIDTH - 1) || !numberIn(d.world.y, 0, WORLD_HEIGHT - 1)
      || typeof d.eventSpawn !== 'boolean'
      || (d.encounterId !== undefined && (typeof d.encounterId !== 'string'
        || !/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,99}$/.test(d.encounterId)
        || (d.wolfPackId !== undefined && d.encounterId !== d.wolfPackId)))
      || (d.wolfPackId !== undefined && (!isWolfFamily(d.enemyId) || typeof d.wolfPackId !== 'string' || d.wolfPackId.length > 100))
      || (d.wolfAlpha !== undefined && (!isWolfFamily(d.enemyId) || typeof d.wolfAlpha !== 'boolean'))) return contentInvalid(id,'invalid generated spawn definition');
    const behavior = d.encounterBehavior;
    let parsedBehavior: EncounterBehavior | undefined;
    if (behavior !== undefined) {
      if (!record(behavior) || !record(behavior.home) || !record(behavior.station) || (!d.encounterId && !d.wolfPackId)
        || !numberIn(behavior.home.x,0,WORLD_WIDTH-1) || !numberIn(behavior.home.y,0,WORLD_HEIGHT-1)
        || !numberIn(behavior.station.x,0,WORLD_WIDTH-1) || !numberIn(behavior.station.y,0,WORLD_HEIGHT-1)
        || !numberIn(behavior.leashRadius,256,1600) || !numberIn(behavior.slot,0,15) || !Number.isInteger(behavior.slot)
        || typeof behavior.role !== 'string' || !['leader','melee','flanker','ranged','heavy'].includes(behavior.role)
        || Math.hypot(behavior.station.x-behavior.home.x,behavior.station.y-behavior.home.y)>behavior.leashRadius*.4
        || d.wolfPackId && (behavior.role !== (d.wolfAlpha?'leader':'flanker') || (d.wolfAlpha ? behavior.slot!==0 : behavior.slot===0))) return contentInvalid(id,'invalid encounter behavior');
      const key=d.wolfPackId?`wolf:${d.wolfPackId}`:`encounter:${d.encounterId}`;
      const occupied=slots.get(key)??new Set<number>();
      if(occupied.has(behavior.slot))return contentInvalid(id,'duplicate encounter slot');
      occupied.add(behavior.slot);slots.set(key,occupied);
      const home=groupHomes.get(key);
      if(home&&(home.x!==behavior.home.x||home.y!==behavior.home.y||home.radius!==behavior.leashRadius))return contentInvalid(id,'inconsistent encounter home');
      groupHomes.set(key,{x:behavior.home.x,y:behavior.home.y,radius:behavior.leashRadius});
      parsedBehavior={home:{x:behavior.home.x,y:behavior.home.y},station:{x:behavior.station.x,y:behavior.station.y},
        leashRadius:behavior.leashRadius,role:behavior.role as EncounterRole,slot:behavior.slot};
    }
    // Convert legacy coastal bandits without new IDs or resetting damage/deaths.
    const pirate=d.enemyId==='road-bandit'&&geography.getRegionAt(d.world.x,d.world.y)==='portquill';
    const home=parsedBehavior?.home??{x:d.world.x,y:d.world.y};
    const frostWolf=d.enemyId==='gray-wolf'&&geography.getRegionAt(home.x,home.y)==='frostlands';
    spawns[id] = { id, kind: 'creature', enemyId: pirate?'cutlass-pirate':frostWolf?'frost-wolf':d.enemyId, world: { x: d.world.x, y: d.world.y }, eventSpawn: d.eventSpawn,
      ...(parsedBehavior?{encounterBehavior:parsedBehavior}:{}),
      ...(typeof d.encounterId === 'string'?{encounterId:d.encounterId}:{}),
      ...(typeof d.wolfPackId === 'string'?{wolfPackId:d.wolfPackId}:{}),
      ...(typeof d.wolfAlpha === 'boolean'?{wolfAlpha:d.wolfAlpha}:{}) };
  }
  const states: Record<string, ContentState> = {};
  for (const [id, s] of Object.entries(value.states)) {
    // Cosmetic perimeter walls/gates were retired. Keep all gameplay records.
    if (retiredBoundaryId(id)) continue;
    // A prior release mistakenly created a second Edmund. Ignore its stale NPC
    // snapshot so removing that duplicate cannot invalidate existing saves.
    if (id === 'npc:edmund-hale') continue;
    const definition = Object.hasOwn(CONTENT_BY_ID, id) ? CONTENT_BY_ID[id] : spawns[id];
    if(!definition&&(/^defense:[^:]+:(curtain|tower|entrance):/.test(id)||/^fort:highmere:(curtain|return|corner):/.test(id)))continue;
    // Cosmetic infill may be omitted/repositioned by a later layout. It must
    // not invalidate an otherwise valid player/quest/boss save.
    if(!definition&&(/^detail:/.test(id)||/^farm:[^:]+:/.test(id)||/^town:[^:]+:building:\d+$/.test(id)))continue;
    const decorativeFarm=/^farm:([^:]+):(fence|wheat):\d+$/.exec(id);
    if(!definition && decorativeFarm && Object.hasOwn(TOWN_BY_ID,decorativeFarm[1])) continue;
    if (!definition || !record(s) || !numberIn(s.x, 0, WORLD_WIDTH - 1) || !numberIn(s.y, 0, WORLD_HEIGHT - 1)
      || (s.defeated !== undefined && typeof s.defeated !== 'boolean') || (s.used !== undefined && typeof s.used !== 'boolean')
      || (s.trust !== undefined && !numberIn(s.trust, 0, 100))
      || (s.respawnAt!==undefined && (!numberIn(s.respawnAt)||!Number.isInteger(s.respawnAt)||s.defeated!==true
        ||definition.kind!=='creature'||!definition.id.startsWith('pirate:flagship:crew:')&&!BOSSES.some(b=>b.id===definition.bossId&&b.respawns&&b.respawnDelayMs))))
      return contentInvalid(id,'invalid actor state, coordinates, or respawn flag');
    const bossPhase=definition.kind==='creature'&&definition.bossId&&!s.defeated?parseBossPhaseSnapshot(s.bossPhase):undefined;
    // Zero HP is living state only for a boss's explicitly saved refill. Do not
    // broaden this exception to ordinary enemies or a finished second form.
    if(s.hp===0&&s.defeated!==true&&!bossPhase?.refill)return contentInvalid(id,'zero HP without defeat or boss refill');
    if(s.hp!==undefined || s.hpMax!==undefined){
      if(definition.kind!=='creature')return contentInvalid(id,'non-creature has combat health');
      const maxHp=maximumSavedEnemyHp(definition);
      if(s.hp!==undefined&&!numberIn(s.hp,0,maxHp))return contentInvalid(id,`HP ${s.hp} is outside the scaled limit ${maxHp}`);
      if(s.hpMax!==undefined&&!numberIn(s.hpMax,1,maxHp))return contentInvalid(id,`maximum HP ${s.hpMax} is outside the scaled limit ${maxHp}`);
    }
    // Salt King moved from the inland/shore camps onto his flagship.
    // Repair legacy/off-deck positions only; retain valid deck movement, wounds,
    // defeat state and the exact existing respawn deadline.
    const relocatedSaltKing=definition.kind==='creature'&&definition.bossId==='salt-king'
      &&(!onFlagshipDeck(s.x,s.y)||!flagshipWalkable(s.x,s.y,24));
    const position=relocatedSaltKing?definition.world:{x:s.x,y:s.y};
    let summonWave:ContentState['summonWave'];
    let encounterPlacement:ContentState['encounterPlacement'];
    if(s.encounterPlacement!==undefined){
      const p=s.encounterPlacement;
      if(definition.kind!=='creature'||!definition.encounterBehavior||!record(p)||!record(p.home)||!record(p.station)
        ||!numberIn(p.home.x,0,WORLD_WIDTH-1)||!numberIn(p.home.y,0,WORLD_HEIGHT-1)
        ||!numberIn(p.station.x,0,WORLD_WIDTH-1)||!numberIn(p.station.y,0,WORLD_HEIGHT-1)
        ||Math.hypot(p.station.x-p.home.x,p.station.y-p.home.y)>320)return contentInvalid(id,'invalid encounter placement');
      // An authored clearing may move in a later map revision. Discard only
      // stale placement metadata, not the player's save or real defeat flags.
      if(Math.hypot(p.home.x-definition.world.x,p.home.y-definition.world.y)<=3200
        &&geography.getRegionAt(p.home.x,p.home.y)===geography.getRegionAt(definition.world.x,definition.world.y))
        encounterPlacement={home:{x:p.home.x,y:p.home.y},station:{x:p.station.x,y:p.station.y}};
    }
    if(s.summonWave!==undefined){
      const wave=s.summonWave;
      if(definition.kind!=='creature'||!definition.bossId||!ENEMY_BY_ID[definition.enemyId].summonComposition
        ||!record(wave)||typeof wave.encounterId!=='string'
        ||!wave.encounterId.startsWith(`boss-wave:${definition.bossId}:`)
        ||!/^boss-wave:[a-zA-Z0-9:_-]{1,90}$/.test(wave.encounterId)
        ||!strings(wave.members)||wave.members.length>512||new Set(wave.members).size!==wave.members.length
        ||!wave.members.every(member=>Object.hasOwn(spawns,member)&&spawns[member].eventSpawn===true)
        ||!numberIn(wave.nextAt)||!Number.isInteger(wave.nextAt)
        ||wave.members.length>0&&wave.nextAt!==0
        ||!wave.encounterId.endsWith(':legacy')&&wave.members.some(member=>spawns[member].encounterId!==wave.encounterId))return contentInvalid(id,'invalid boss summon wave');
      summonWave={encounterId:wave.encounterId,members:[...wave.members],nextAt:wave.nextAt};
    }
    states[id] = { x: position.x, y: position.y,
      ...(typeof s.hp === 'number' ? { hp: s.hp } : {}), ...(typeof s.trust === 'number' ? { trust: s.trust } : {}),
      ...(typeof s.hpMax==='number'?{hpMax:s.hpMax}:{}),
      ...(bossPhase?{bossPhase}:{}),
      ...(typeof s.defeated === 'boolean' ? { defeated: s.defeated } : {}), ...(typeof s.used === 'boolean' ? { used: s.used } : {}),
      ...(typeof s.respawnAt==='number'?{respawnAt:s.respawnAt}:{}),
      ...(summonWave?{summonWave}:{}),
      ...(encounterPlacement?{encounterPlacement}:{}),
    };
  }
  const owners=new Set<string>();
  for(const state of Object.values(states))for(const member of state.summonWave?.members??[]){
    if(owners.has(member))return contentInvalid(member,'summon assigned to multiple bosses');
    owners.add(member);
  }
  return { states, spawns, nextSpawnSequence: value.nextSpawnSequence };
}

/** Upgrade older saves while preserving progress and the existing content ledger. */
export function migrateSave(data: unknown): unknown {
  let migrated = data;
  if (record(migrated) && migrated.version === 1 && record(migrated.state)) {
    const worldContent: ContentWorldState = { states: {}, spawns: {}, nextSpawnSequence: 0 };
    if (strings(migrated.state.defeatedBosses)) {
      for (const id of migrated.state.defeatedBosses) {
        const definition = CONTENT_BY_ID[`boss:${id}`];
        if (definition) worldContent.states[definition.id] = { ...initialContentState(definition), hp: 0, defeated: true };
      }
    }
    migrated = { ...migrated, version: 2, state: { ...migrated.state, worldContent } };
  }
  if (record(migrated) && migrated.version === 2 && record(migrated.state)) {
    const priorLevel = numberIn(migrated.state.level, 1) ? Math.floor(migrated.state.level) : 1;
    migrated = { ...migrated, version: 3, state: { ...migrated.state, attributes: { ...BASE_ATTRIBUTES },
      statPoints: Math.max(0, priorLevel - 1) * 3, skillPoints: Math.max(0, priorLevel - 1), learnedSkills: [] } };
  }
  if (record(migrated) && migrated.version === 3 && record(migrated.state)) {
    const world = migrated.state.worldContent;
    const states = record(world) && record(world.states) ? world.states : {};
    const unlockedTownShrines = TOWN_SHRINES.filter(shrine => {
      const state = states[shrine.contentId];
      return record(state) && state.used === true;
    }).map(shrine => shrine.townId);
    migrated = { ...migrated,version:4,state:{ ...migrated.state,unlockedTownShrines } };
  }
  if(record(migrated)&&migrated.version===4&&record(migrated.state)){
    const old=migrated.state;
    const level=typeof old.level==='number'&&Number.isFinite(old.level)?Math.max(1,Math.floor(old.level)):1;
    const rawXp=typeof old.xp==='number'&&Number.isFinite(old.xp)?old.xp:0;
    const oldInto=Math.max(0,rawXp-(level-1)*250);
    // Preserve current level and the percentage of its old experience bar.
    const xp=xpTotalForLevel(level)+Math.round(Math.min(1,oldInto/250)*xpNeededForLevel(level));
    const content=old.worldContent;
    const states:Record<string,unknown>=record(content)&&record(content.states)?{...content.states}:{};
    for(const boss of BOSSES){
      const id='boss:'+boss.id;
      const previous=states[id];
      if((Array.isArray(old.defeatedBosses)&&old.defeatedBosses.includes(boss.id))||
        (record(previous)&&previous.defeated===true)){
        const def=CONTENT_BY_ID[id];
        if(def){const base=record(previous)?previous:initialContentState(def);
          states[id]={...base,hp:0,defeated:true,respawnAt:typeof base.respawnAt==='number'?Math.min(base.respawnAt,Date.now()+20*60*1000):
            (Number.isFinite(Date.parse(String(migrated.savedAt)))?Date.parse(String(migrated.savedAt)):Date.now())+20*60*1000};
        }
      }
    }
    migrated={...migrated,version:5,state:{...old,xp,
      worldContent:record(content)?{...content,states}:content}};
  }
  if(record(migrated)&&migrated.version===5&&record(migrated.state)){
    const old=migrated.state;
    // Migrate only structurally valid allocations; malformed saves still use
    // the existing last-good/recovery path rather than being silently repaired.
    if(!record(old.attributes)||!['strength','vitality','agility'].every(id=>
      numberIn((old.attributes as Record<string,unknown>)[id],0,10000)&&Number.isInteger((old.attributes as Record<string,unknown>)[id]))
      ||!skillIds(old.learnedSkills)||!numberIn(old.xp)||!numberIn(old.hp,1)||!numberIn(old.stamina))return migrated;
    const xp=Math.min(old.xp,xpTotalForLevel(BASE_LEVEL_CAP)),level=levelForExperience(xp,BASE_LEVEL_CAP);
    let attributes=Object.fromEntries(Object.entries(BASE_ATTRIBUTES).map(([id,base])=>[id,(old.attributes as Record<string,unknown>)[id]??base])) as PlayerAttributes;
    // A free respec preserves the complete legal budget when an old build no
    // longer fits. Never truncate invested points without returning them.
    if(Object.values(attributes).some(n=>!Number.isInteger(n)||n<0||n>ATTRIBUTE_CAP)
      ||Object.values(attributes).reduce((sum,n)=>sum+n,0)>attributeBudget(level))attributes={...BASE_ATTRIBUTES};
    // Legacy players at level 30 may have already spent their old final point.
    let remaining=legacySkillBudget(level);
    const learnedCombatArts:ActiveSkillId[]=[];
    if(old.learnedCombatArts!==undefined&&(!strings(old.learnedCombatArts)||!old.learnedCombatArts.every(id=>Object.hasOwn(ACTIVE_SKILL_BY_ID,id))))return migrated;
    for(const id of (old.learnedCombatArts??[]) as ActiveSkillId[]){
      const cost=ACTIVE_SKILL_BY_ID[id].learnCost;
      if(cost&&!learnedCombatArts.includes(id)&&remaining>=cost){learnedCombatArts.push(id);remaining-=cost;}
    }
    // Preserve usable, equipped arts first when changed talent prices require
    // a partial respec; then retain talents in prerequisite order.
    const learnedSkills:SkillId[]=[];
    for(const skill of SKILLS)if(old.learnedSkills.includes(skill.id)&&remaining>=skill.cost
      &&(!skill.requires||learnedSkills.includes(skill.requires))){learnedSkills.push(skill.id);remaining-=skill.cost;}
    const derived=progressionStats(attributes,learnedSkills);
    const skillSlots=Array.isArray(old.skillSlots)?old.skillSlots.map(id=>typeof id==='string'&&Object.hasOwn(ACTIVE_SKILL_BY_ID,id)
      &&(!ACTIVE_SKILL_BY_ID[id as ActiveSkillId].learnCost||learnedCombatArts.includes(id as ActiveSkillId))?id:null):[...DEFAULT_SKILL_SLOTS];
    const quests=record(old.quests)?{...old.quests}:old.quests;
    // IDs and completed stages survive larger clear objectives. Partial kills
    // remain actual kills; new camp members supply the outstanding quota.
    if(record(quests))for(const definition of QUESTS){
      const runtime=quests[definition.id];if(!record(runtime)||!record(runtime.objectiveProgress))continue;
      const progress={...runtime.objectiveProgress};
      for(const o of definition.objectives)if(o.type==='kill'&&!o.bossId&&o.amount>=15){
        const legacyAmount=['flagship-deck','frost-store-defense'].includes(o.id)?5:3;
        const frontier=definition.objectives.reduce((last,stage,index)=>numberIn(progress[stage.id],stage.amount)?index:last,-1);
        if(runtime.status==='completed'||numberIn(progress[o.id],legacyAmount)
          ||o.id==='break-blockade'&&frontier>definition.objectives.indexOf(o))progress[o.id]=o.amount;
      }
      quests[definition.id]={...runtime,objectiveProgress:progress};
    }
    migrated={...migrated,version:6,state:{...old,level,xp,attributes,learnedSkills,learnedCombatArts,skillSlots,quests,
      hp:Math.min(derived.maxHp,Math.max(1,old.hp)),stamina:Math.min(derived.maxStamina,old.stamina),
      statPoints:attributeBudget(level)-Object.values(attributes).reduce((sum,n)=>sum+n,0),skillPoints:remaining}};
  }
  if(record(migrated)&&migrated.version===6&&record(migrated.state)){
    const old=migrated.state;
    const flags=record(old.storyFlags)?old.storyFlags:{};
    const cap=flags[BREAKTHROUGH_COMPLETE]===true?MAX_PLAYER_LEVEL:BASE_LEVEL_CAP;
    // Do not silently repair corrupt XP/level pairs. The usual save-recovery
    // mechanism must retain any malformed snapshot instead of overwriting it.
    if(!numberIn(old.level,1,cap)||!Number.isInteger(old.level)
      ||!numberIn(old.xp,0,legacyXpTotalForLevel(cap)))return migrated;
    let previousLevel=1;
    while(previousLevel<cap&&old.xp>=legacyXpTotalForLevel(previousLevel+1))previousLevel++;
    if(previousLevel!==old.level)return migrated;
    let xp=old.xp;
    if(cap>BASE_LEVEL_CAP&&old.level>=BASE_LEVEL_CAP){
      if(old.level===cap)xp=xpTotalForLevel(cap);
      else{
        const oldInto=old.xp-legacyXpTotalForLevel(old.level);
        const oldRequired=legacyXpNeededForLevel(old.level);
        const newRequired=xpNeededForLevel(old.level);
        // Preserve the *percentage* toward the next level, not merely raw
        // cumulative XP (which would demote existing post-50 characters).
        xp=xpTotalForLevel(old.level)
          +Math.min(newRequired-1,Math.floor(oldInto/oldRequired*newRequired));
      }
    }
    migrated={...migrated,version:7,state:{...old,xp}};
  }
  return migrated;
}

export function parseSave(raw: string): SaveData | null {
  lastSaveValidationProblem=null;
  try {
    const data = migrateSave(JSON.parse(raw));
    if (!record(data) || data.version !== 7 || !record(data.state)) return invalidSave('unsupported save structure or version');
    const s = data.state;
    // The short-lived duplicate Edmund was discoverable and could be saved in
    // the character journal. Retire only that exact old ID before strict
    // validation; all other unknown or malformed entries still fail safely.
    const savedJournal=s.journal;
    const safeJournal=record(savedJournal)&&Array.isArray(savedJournal.characters)
      ?{...savedJournal,characters:savedJournal.characters.filter((id:unknown)=>id!=='edmund-hale')}
      :savedJournal;
    const journal=parseJournal(safeJournal);
    if(!journal)return invalidSave('invalid journal records');
    if(s.cinematicQueue!==undefined&&(!strings(s.cinematicQueue)||s.cinematicQueue.length>64))return invalidSave('invalid cinematic queue');
    const savedFlags=s.storyFlags??{},storyChoices=s.storyChoices??{};
    const contracts=parseContracts(s.contracts);
    if(!contracts)return invalidSave('invalid notice-board contracts');
    const dungeons=parseDungeons(s.dungeons);
    if(!dungeons)return invalidSave('invalid cave discovery or clear progress');
    if(!record(savedFlags)||!Object.values(savedFlags).every(v=>typeof v==='boolean')
      ||!record(storyChoices)||!Object.values(storyChoices).every(v=>typeof v==='string'&&v.length<100)
      ||Object.keys(savedFlags).length>512+ROAD_STORY_FLAG_BUDGET||Object.keys(storyChoices).length>512) return invalidSave('invalid story flags or choices');
    const storyFlags={...savedFlags} as Record<string,boolean>;
    const cap=playerLevelCap(storyFlags);
    if(storyFlags[BREAKTHROUGH_TRIAL]&&!storyFlags[BREAKTHROUGH_ACCEPTED]
      ||storyFlags[BREAKTHROUGH_COMPLETE]&&!storyFlags[BREAKTHROUGH_TRIAL]
      ||storyFlags[BREAKTHROUGH_ACCEPTED]&&(!numberIn(s.level,BASE_LEVEL_CAP,cap))
      ||storyFlags[WORLD_ASCENSION]&&(!storyFlags[BREAKTHROUGH_COMPLETE]||s.level!==MAX_PLAYER_LEVEL))return invalidSave('invalid breakthrough trial history');
    const legacyCampaign=!storyFlags[CAMPAIGN_REVISION_FLAG];
    if (!strings(s.unlockedTownShrines) || new Set(s.unlockedTownShrines).size !== s.unlockedTownShrines.length
      || !s.unlockedTownShrines.every(id => Object.hasOwn(TOWN_BY_ID,id))) return invalidSave('invalid unlocked shrines');
    if (!playerAttributes(s.attributes,attributeCap(storyFlags)) || !numberIn(s.statPoints, 0, 10000) || !Number.isInteger(s.statPoints)
      || !numberIn(s.skillPoints, 0, 10000) || !Number.isInteger(s.skillPoints) || !skillIds(s.learnedSkills)) return invalidSave('invalid player attributes or skill points');
    const armor=parseArmor(s.armorInventory,s.equippedArmor);
    if(!armor)return invalidSave('invalid armor inventory or equipment slots');
    const derived = progressionStats(s.attributes, s.learnedSkills,armorBonusesFor(armor.equippedArmor));
    if (!numberIn(s.hp, 1, derived.maxHp) || !numberIn(s.stamina, 0, derived.maxStamina) || !numberIn(s.xp) || !numberIn(s.gold)
      || !numberIn(s.level, 1, MAX_PLAYER_LEVEL) || !Number.isInteger(s.level)
      || !numberIn(s.worldX, 0, WORLD_WIDTH - 1) || !numberIn(s.worldY, 0, WORLD_HEIGHT - 1)
      || !numberIn(s.day, 1) || !numberIn(s.minuteOfDay, 0, 1439.999999)
      || typeof s.weaponId !== 'string' || !Object.hasOwn(WEAPON_BY_ID, s.weaponId)
      || !strings(s.inventory) || !s.inventory.every(id => Object.hasOwn(WEAPON_BY_ID, id)) || !s.inventory.includes(s.weaponId)
      || !strings(s.defeatedBosses) || !s.defeatedBosses.every(id => BOSSES.some(b => b.id === id))
      || (!REGIONS.some(r => r.id === s.regionId) && s.regionId !== 'dead-sea')
      || (s.townId !== null && (typeof s.townId !== 'string' || !Object.hasOwn(TOWN_BY_ID, s.townId)))
      || !record(s.quests)) return invalidSave('invalid player vitals, equipment, position, or quest ledger');
    const quests: GameState['quests'] = {};
    for (const definition of QUESTS) {
      const quest = s.quests[definition.id];
      if (quest === undefined && definition.id !== 'first-road') {
        quests[definition.id] = { status: 'locked', objectiveProgress: {} };
        continue;
      }
      if (!record(quest) || typeof quest.status !== 'string' || !['active', 'locked', 'completed'].includes(quest.status) || !record(quest.objectiveProgress)) return invalidSave(`invalid quest ${definition.id}`);
      let progress = {...quest.objectiveProgress};
      if(!storyFlags[COMBAT_CLEARANCE_REVISION_FLAG]){
        // A previous release could turn a 15-kill stage into a one-step report.
        // Preserve stages already passed, without crediting a current partial
        // hunt or awarding any milestone again. Stable IDs remain unchanged.
        const frontier=quest.status==='completed'?definition.objectives.length:
          definition.objectives.reduce((last,o,i)=>typeof progress[o.id]==='number'&&Number(progress[o.id])>=o.amount?i:last,-1);
        for(const [index,o] of definition.objectives.entries())if(o.type==='kill'&&o.killContentPrefix&&o.amount>=15
          &&index<frontier&&typeof progress[o.id]==='number'&&Number.isInteger(progress[o.id])
          &&Number(progress[o.id])>=1&&Number(progress[o.id])<o.amount)
          progress[o.id]=o.amount;
      }
      if(!storyFlags[ADVENTURE_REVISION_FLAG]){
        const frontier=quest.status==='completed'?definition.objectives.length-1:
          definition.objectives.reduce((last,o,i)=>progress[o.id]===o.amount?i:last,-1);
        for(let i=0;i<=frontier;i++){
          const o=definition.objectives[i];
          if((o.type==='encounter'||o.id==='pilgrim-safe')&&progress[o.id]===undefined)progress[o.id]=o.amount;
        }
      }
      if(!storyFlags[INDOOR_STORY_FLAG]){
        const frontier=quest.status==='completed'?definition.objectives.length-1:
          definition.objectives.reduce((last,o,i)=>progress[o.id]===o.amount?i:last,-1);
        for(const id of INDOOR_STORY_STAGES[definition.id]??[]){
          const i=definition.objectives.findIndex(o=>o.id===id);
          if(i>=0&&i<=frontier&&progress[id]===undefined)progress[id]=definition.objectives[i].amount;
        }
      }
      if(legacyCampaign){
        const required:Record<string,string[]>={
          'first-road':['talk-aldren','kill-varr','return-aldren'],
          'crown-summons':['old-charter','capital','report','customs','households','witness','guard-report','audience','mandate'],
          'eight-regions':['moonlit-warden','stonejaw','iron-tusk','rootfather','salt-king','frost-wyrm','ashen-seer','return-aldren-after-regions'],
          'returning-ember':['vexa-warning','survey-ward','repel-varkhul','dain-report','vexa-resolution'],
        };
        const legacyStages=required[definition.id];
        if(quest.status==='completed'&&legacyStages&&!legacyStages.every(id=>progress[id]===1))return invalidSave(`legacy quest ${definition.id} is missing objectives`);
        // Grandfather additions only behind the player's saved frontier. Never
        // reset rewards, invent choices, or skip newly introduced future work.
        const frontier=quest.status==='completed'?definition.objectives.length-1:
          definition.objectives.reduce((last,o,i)=>progress[o.id]===o.amount?i:last,-1);
        for(let i=0;i<=frontier;i++){
          const objective=definition.objectives[i];
          if(legacyStages&&progress[objective.id]===undefined)progress[objective.id]=objective.amount;
          if(progress[objective.id]===objective.amount&&objective.cinematicId)storyFlags['scene:'+objective.cinematicId]=true;
        }
      }
      if(definition.id==='eight-regions'&&quest.status==='active'&&s.quests['crown-summons']===undefined){
        const oldBossObjectives=definition.objectives.filter(o=>o.bossId);
        const towns=['elarion','starhold','redmesa','deepford','tidewatch','skallheim','blackspire'];
        oldBossObjectives.forEach((objective,i)=>{if(progress[objective.id]===1){
          for(const prefix of ['brief:','evidence:','report:'])progress[prefix+towns[i]]=1;
        }});
      }
      if(definition.id==='eight-regions'&&quest.status==='completed'){
        const legacy=['moonlit-warden','stonejaw','iron-tusk','rootfather','salt-king','frost-wyrm','ashen-seer','return-aldren-after-regions'];
        if(legacy.every(id=>progress[id]===1)&&definition.objectives.some(o=>progress[o.id]===undefined)){
          for(const objective of definition.objectives)if(!legacy.includes(objective.id))progress[objective.id]=objective.amount;
          storyFlags['legacy:regional-finished']=true;
        }
      }
      if(!storyFlags[ROAD_STORIES_REVISION]||!storyFlags[ROAD_POLISH_REVISION])progress=migrateRoadStoryProgress(definition.objectives,
        quest.status as GameState['quests'][string]['status'],progress);
      const objectiveProgress: Record<string, number> = {};
      for (const objective of definition.objectives) {
        const value = progress[objective.id];
        if (value !== undefined && !numberIn(value, 0, objective.amount)) return invalidSave(`invalid quest progress ${definition.id}/${objective.id}`);
        if (typeof value === 'number') objectiveProgress[objective.id] = value;
      }
      if (quest.status === 'completed' && !definition.objectives.every(o => (Number(progress[o.id]) || 0) >= o.amount)) return invalidSave(`completed quest ${definition.id} is missing objectives`);
      quests[definition.id] = { status: quest.status as 'locked' | 'active' | 'completed', objectiveProgress };
    }
    if(['active','completed'].includes(quests['eight-regions']?.status??'')&&s.quests['crown-summons']===undefined){
      quests['crown-summons']={status:'completed',objectiveProgress:Object.fromEntries(QUESTS.find(q=>q.id==='crown-summons')!.objectives.map(o=>[o.id,o.amount]))};
      if(quests['eight-regions'].status==='completed')storyFlags['legacy:regional-finished']=true;
      for(const objective of QUESTS.find(q=>q.id==='crown-summons')!.objectives)
        if(objective.cinematicId)storyFlags['scene:'+objective.cinematicId]=true;
    }
    const state = s as unknown as SavedState;
    // Additive equipment schema: old installations keep their four original
    // arts and receive no repeat free items when these fields are absent.
    const consumables=s.consumables===undefined?{'healing-potion':0,'stamina-potion':0}:s.consumables;
    if(!record(consumables)||!Object.keys(POTIONS).every(id=>numberIn(consumables[id],0,99)&&Number.isInteger(consumables[id])))return invalidSave('invalid consumables');
    const weaponUpgrades=s.weaponUpgrades??{},bossMaterials=s.bossMaterials??{};
    const bossHearts=s.bossHearts??{},awakenedWeapons=s.awakenedWeapons??[];
    if(!record(bossHearts)||Object.entries(bossHearts).some(([id,count])=>!Object.hasOwn(AWAKENING_BY_BOSS,id)||!numberIn(count,0,MAX_BOSS_HEARTS)||!Number.isInteger(count))
      ||!strings(awakenedWeapons)||new Set(awakenedWeapons).size!==awakenedWeapons.length
      ||awakenedWeapons.some(id=>!BOSS_WEAPON_IDS.has(id)||!(s.inventory as string[]).includes(id)))return invalidSave('invalid awakening hearts or weapons');
    const validForgeLedger=(value:unknown,max:number)=>record(value)&&Object.entries(value).every(([id,count])=>
      BOSS_WEAPON_IDS.has(id)&&numberIn(count,0,max)&&Number.isInteger(count));
    if(!validForgeLedger(weaponUpgrades,MAX_WEAPON_UPGRADE)
      ||!validForgeLedger(bossMaterials,MAX_BOSS_MATERIALS)
      ||Object.keys(weaponUpgrades).some(id=>Number((weaponUpgrades as Record<string,number>)[id])>0&&!(s.inventory as string[]).includes(id)))
      return invalidSave('invalid boss weapon upgrades or forge materials');
    let invalidReturnedWeapon=false;
    const housing=parseHousing(s.housing,{returnWeapon:id=>{
      if(!BOSS_WEAPON_IDS.has(id)||!(s.inventory as string[]).includes(id)){invalidReturnedWeapon=true;return;}
      const ledger=bossMaterials as Record<string,number>;ledger[id]=(ledger[id]??0)+1;
    }});
    if(invalidReturnedWeapon||!validForgeLedger(bossMaterials,MAX_BOSS_MATERIALS))return invalidSave('invalid recovered housing weapon copies');
    if(!housing||allHomeItems(housing).some(i=>i.weaponId&&(!BOSS_WEAPON_IDS.has(i.weaponId)||!(s.inventory as string[]).includes(i.weaponId))))return invalidSave('invalid player housing');
    if([...BOSS_WEAPON_IDS].some(id=>Number((bossMaterials as Record<string,number>)[id]??0)+allHomeItems(housing).filter(i=>i.weaponId===id).length>MAX_BOSS_MATERIALS))return invalidSave('too many stored and displayed weapon copies');
    const learnedCombatArts=s.learnedCombatArts??[];
    if(!strings(learnedCombatArts)||new Set(learnedCombatArts).size!==learnedCombatArts.length
      ||!learnedCombatArts.every(id=>Object.hasOwn(ACTIVE_SKILL_BY_ID,id)&&Boolean(ACTIVE_SKILL_BY_ID[id as ActiveSkillId].learnCost)))return invalidSave('invalid learned combat arts');
    const skillSlots=s.skillSlots===undefined?[...DEFAULT_SKILL_SLOTS]:s.skillSlots;
    if(!Array.isArray(skillSlots)||skillSlots.length!==4||!skillSlots.every(id=>id===null||typeof id==='string'&&Object.hasOwn(ACTIVE_SKILL_BY_ID,id)
      &&(id!=='barrage'||numberIn(s.level,60,75)&&cap===75)
      &&(!ACTIVE_SKILL_BY_ID[id as ActiveSkillId].learnCost||learnedCombatArts.includes(id)))
      ||new Set(skillSlots.filter(Boolean)).size!==skillSlots.filter(Boolean).length)return invalidSave('invalid equipped skill slots');
    const validatedSkills=s.learnedSkills;
    const allocatedLearningPoints=SKILLS.filter(skill=>validatedSkills.includes(skill.id)).reduce((sum,skill)=>sum+skill.cost,0)
      +learnedCombatArts.reduce((sum,id)=>sum+(ACTIVE_SKILL_BY_ID[id as ActiveSkillId].learnCost??0),0)+s.skillPoints;
    // Previous level-50 builds gave only 28 learning points at 29 and above;
    // the old level-30 build gave 29 points at level 30. Both are legitimate
    // saves. Grant exactly one missing completion point to the former, without
    // changing purchased arts, talents, or an existing 29-point allocation.
    const previousBudget=skillBudget(s.level)-(s.level>=29?1:0);
    const needsCompletionPoint=s.level>=29&&allocatedLearningPoints===previousBudget;
    if(s.level!==levelForExperience(s.xp,cap)||s.xp>xpTotalForLevel(cap)
      ||Object.values(s.attributes).reduce((sum,n)=>sum+Number(n),0)+s.statPoints!==attributeBudget(s.level)
      ||allocatedLearningPoints!==skillBudget(s.level)&&!needsCompletionPoint)return invalidSave('level, XP, or allocated-point budget mismatch');
    const worldContent = validateContent(s.worldContent);
    if (!worldContent) return invalidSave(lastSaveValidationProblem??'invalid world-content ledger');
    storyFlags[CAMPAIGN_REVISION_FLAG]=true;
    storyFlags[INDOOR_STORY_FLAG]=true;
    storyFlags[ADVENTURE_REVISION_FLAG]=true;
    storyFlags[COMBAT_CLEARANCE_REVISION_FLAG]=true;
    storyFlags[ROAD_STORIES_REVISION]=true;
    storyFlags[ROAD_POLISH_REVISION]=true;
    // Existing progressed players don't get a new-game prologue on resume.
    if(legacyCampaign)storyFlags['scene:roadborn-opening']=true;
    const result = advanceQuests(gateTowerQuest(quests), state.defeatedBosses,undefined,storyFlags,worldContent);
    const rewards=earnedRewards(result.xp,result.gold,state.attributes,state.learnedSkills);
    const xp = Math.min(xpTotalForLevel(cap),state.xp + rewards.xp);
    const levelsGained = Math.max(0, levelForExperience(xp) - levelForExperience(state.xp));
    const learningPointsGained=Math.max(0,skillBudget(levelForExperience(xp))-skillBudget(levelForExperience(state.xp)));
    return { version: 7, savedAt: typeof data.savedAt === 'string' ? data.savedAt : '', state: {
      ...state,journal:restoreJournal(journal,state),contracts,...armor,dungeons,housing,
      nextTowerResetAt:typeof s.nextTowerResetAt==='number'&&Number.isSafeInteger(s.nextTowerResetAt)&&s.nextTowerResetAt>=0&&s.nextTowerResetAt<8640000000000000
        ?s.nextTowerResetAt:nextTowerWeeklyReset(),
       weaponUpgrades:weaponUpgrades as Record<string,number>,bossMaterials:bossMaterials as Record<string,number>,bossHearts:bossHearts as Record<string,number>,awakenedWeapons,
       consumables:consumables as Record<PotionId,number>,learnedCombatArts:learnedCombatArts as ActiveSkillId[],skillSlots:skillSlots as (ActiveSkillId|null)[], worldContent, quests: result.quests, xp, gold: state.gold + rewards.gold,
      storyFlags:questConsequences(result.quests,storyFlags as Record<string,boolean>),storyChoices:storyChoices as Record<string,string>,
      cinematicQueue:strings(s.cinematicQueue)?[...new Set(s.cinematicQueue)].filter(id=>Object.hasOwn(CINEMATICS,id)&&!storyFlags['scene:'+id]):[],
      trackedQuestId:typeof s.trackedQuestId==='string'&&result.quests[s.trackedQuestId]?.status==='active'?s.trackedQuestId:
        QUESTS.find(q=>q.kind==='main'&&result.quests[q.id]?.status==='active')?.id??null,
      level: levelForExperience(xp), statPoints: state.statPoints + levelsGained * STAT_POINTS_PER_LEVEL,
      skillPoints: state.skillPoints + learningPointsGained + (needsCompletionPoint?1:0),
    } };
  } catch(error) {
    return invalidSave(error instanceof Error?`save parser error: ${error.message}`:'save parser error');
  }
}

