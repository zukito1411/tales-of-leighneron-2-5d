import {groundWorldView} from '../presentation25d/plane';
import Phaser from 'phaser';
import {housingFor} from '../../data/housing';
import {isGameDisposing} from '../systems/gameLifetime';
import {PLAYER_HOMES,PLAYER_HOME_BY_ID,isPlayerHome} from '../../data/playerHomes';
import {BASIC_ATTACK_CHAIN,type BasicAttackStep} from '../../data/basicAttackCombo';
import {LevelUpFeedback} from '../systems/LevelUpFeedback';
import {AmbientRoadLifeSystem} from '../systems/AmbientRoadLifeSystem';
import {AliceCompanionSystem} from '../systems/AliceCompanionSystem';
import {ALICE_NPC_ID,aliceIsFollowing} from '../../data/aliceCompanion';
import {INN_REST_COST,innRestAvailable} from '../../data/innRest';
import {MAP_INNS,MAP_BLACKSMITHS} from '../../data/mapServices';
import {getGraphicEffects} from '../systems/graphicsEffects';
import {InteriorSession} from '../systems/InteriorSession';
import {DungeonSystem} from '../systems/DungeonSystem';
import {DUNGEON_LEADER_SCALE,type DungeonDefinition} from '../../data/dungeons';
import {TOWER_BOSS_PROFILES} from '../../data/bossCombatProfiles';
import {TOWER_ENTRY_ID,towerCombatStats} from '../../data/towerOfMight';
import {TOWER_MUSIC} from '../systems/regionMusic';
import {CAVE_LEADER_PROFILES} from '../../data/bossCombatProfiles';
import {StoryEncounterSystem} from '../systems/StoryEncounterSystem';
import {findCampaignPatrolPlacement} from '../systems/campaignPatrolPlacement';
import {storyEncounterInCourtyard,type StoryEncounter} from '../../data/adventure';
import {citizenModel} from '../systems/RegionalCitizenArt';
import {NPC_INTERIOR_BY_ID,INTERIOR_RESIDENTS,INTERIOR_ENTRIES} from '../../data/interiors';
import type {StoryShot} from '../../data/cinematics';
import {STORY_RESIDENTS} from '../../data/storyResidents';
import { BOSSES,BOSS_BY_ID, ENEMIES, ENEMY_BY_ID,isWolfFamily,enemyAppearanceMultiplier } from '../../data/enemies';
import { BOSS_RESPAWN_MS, encounterRewardFactor } from '../../data/enemyTiers';
import {restoredEnemyHealth} from '../systems/enemyHealth';
import {authoredRoofs} from '../systems/authoredRoofs';
import { LEIGNERON } from '../../data/player';
import { NPCS, NPC_BY_ID } from '../../data/npcs';
import {npcWorldPosition,npcEscortArrival} from '../../data/npcPositions';
import {npcMayPatrol,npcPersonalSpace,npcStandingOffRoad} from '../systems/npcPlacement';
import { TOWN_BY_ID } from '../../data/towns';
import {nearestRespawnTown,respawnArrivalCandidates} from '../systems/respawnLocation';
import { ROAD_ROUTES } from '../../data/roadRoutes';
import { TOWN_SHRINE_BY_ID } from '../../data/townShrines';
import { PORT_BY_ID,PORTS,onPortDeck } from '../../data/ports';
import { WORLD_CONTENT, CONTENT_BY_ID, initialContentState } from '../../data/content';
import {enhancedWeapon} from '../../data/weaponUpgrades';
import { CHUNK_SIZE, STREAM_RADIUS, WORLD_HEIGHT, WORLD_WIDTH } from '../../data/world';
import { useGameStore } from '../../store/gameStore';
import { seededRandom } from '../../utils/seededRandom';
import { saveGame, setSaveSnapshotProvider } from '../../utils/save';
import {BOOT_OPTIONAL_AUDIO_ASSETS} from '../../data/bootOptionalAudio';
import {authoritativeSavePosition} from '../systems/authoritativeSavePosition';
import { mobileInput } from '../input';
import { Enemy } from '../entities/Enemy';
import { Npc } from '../entities/Npc';
import { Player } from '../entities/Player';
import type { ContentDefinition, ContentState, EnemyDefinition, InteractableContentDefinition, NavigationMarker, NpcDefinition, PropContentDefinition, QuestTarget, RegionId, Vec2, WeaponDefinition, WorldPropTexture } from '../types';
import { ChunkManager } from '../systems/ChunkManager';
import { DayNightSystem } from '../systems/DayNightSystem';
import { EventDirector, type EventDirectorHost } from '../systems/EventDirector';
import { WorldGenerator } from '../systems/WorldGenerator';
import { ContentChunkManager, restoreLegacySummonWaves, type EncounterSpawnMember } from '../systems/ContentChunkManager';
import { EncounterCoordinator } from '../systems/EncounterCoordinator';
import { AmbientWildlifeSystem } from '../systems/AmbientWildlifeSystem';
import {PirateFlagshipArt} from '../systems/PirateFlagshipArt';
import {FLAGSHIP,FLAGSHIP_CONTENT,flagshipFootprint,flagshipWalkable,flagshipNavigation,onFlagshipDeck,onFlagshipBoarding,isFlagshipCombatant} from '../../data/pirateFlagship';
import {tidewatchGullHabitat} from '../systems/wildlifeCover';
import { resolveQuestTarget, questBearing } from '../systems/questNavigation';
import { artScale, artFrameSize, worldPropOrigin } from '../../data/art';
import { repairCreaturePlacements } from '../systems/creaturePlacement';
import {normalizePirateCrews} from '../systems/pirateCrewMigration';
import {normalizeGoblinCrews} from '../systems/goblinCrewMigration';
import {M14ArtResidency} from '../systems/M14ArtResidency';
import {M14_ART} from '../../data/m14Art';
import { progressionStats, playerDamageGrowth, earnedRewards } from '../../data/progression';
import { localSettlementTravelEnabled } from '../../utils/localSettlementTravel';
import type { ActiveSkillDefinition } from '../../data/activeSkills';
import { propFoundation, spriteBounds, overlaps } from '../../data/settlementGeometry';
import { objectiveIsCurrent,nextObjective } from '../systems/storyProgress';
import { fortificationBlocksPath, fortificationBlocksPoint } from '../../data/fortifications';
import { CinematicDirector } from '../systems/CinematicDirector';
import { formationPosition } from '../systems/npcRoutes';
import { QUEST_BY_ID } from '../../data/quests';
import { TargetingSystem } from '../systems/TargetingSystem';
import {WeatherSystem} from '../systems/WeatherSystem';
import {TreeSwaySystem} from '../systems/TreeSwaySystem';
import {WaterSurfaceSystem} from '../systems/WaterSurfaceSystem';
import {GroundShadowSystem} from '../systems/GroundShadowSystem';
import {WorldTrafficSystem} from '../systems/WorldTrafficSystem';
import {SpearProjectileSystem} from '../systems/SpearProjectileSystem';
import {ShipPassageSystem} from '../systems/ShipPassageSystem';
import {EnemySoundSystem,type EnemySoundCue} from '../systems/EnemySoundSystem';
import {isPirateEnemy} from '../../data/pirateArt';
import {WorldSpriteSystem,WORLD_SPRITE_OWNER} from '../systems/WorldSpriteSystem';
import {VolcanicTremor} from '../systems/VolcanicTremor';
import {VolcanicCameraShake} from '../systems/VolcanicCameraShake';
import {renderDensity} from '../systems/renderSizing';
import {projectedGroundHalfExtents,projectedGroundView} from '../presentation25d/plane';
import {groundMarkerPosition} from '../systems/groundMarkers';
import {inDragonArena,DRAGON_BOSS_ID} from '../../data/dragonLair';
import {isTreeArt,treeFootprint} from '../../data/treeArt';
import {WILDERNESS_SITES} from '../../data/wildernessSites';
import { creatureFitsHabitat, creatureHabitatWeight, hostileCapacity, MAX_LIVE_HOSTILES, MAX_PERSISTENT_SPAWNS, type CreatureHabitat, type EncounterAdmission } from '../systems/encounterAdmission';

type ContentActor = Phaser.GameObjects.Sprite | Phaser.GameObjects.Text;
const authoredBosses = WORLD_CONTENT.filter(d => d.kind === 'creature' && d.bossId);
const authoredClearStages=Object.values(QUEST_BY_ID).flatMap(quest=>quest.objectives.flatMap(objective=>
  objective.killContentPrefix?[{questId:quest.id,objective}]:[]));
const clearStageFor=(id:string)=>authoredClearStages.find(stage=>id.startsWith(stage.objective.killContentPrefix!));
// LEIGHNERON_MOBILE_GRAPHICS_NPC_FIX_V1: cache tree crowns around Oakmere, rather than scanning every
// world tree during NPC route planning. Actual tree feet and physics stay intact.
const oakmereTreeCanopies=WORLD_CONTENT
  .filter((d): d is PropContentDefinition=>d.kind==='prop')
  .filter(d=>isTreeArt(d.texture??'',d.frame)
    &&Math.abs(d.world.x-TOWN_BY_ID.oakmere.world.x)<1400
    &&Math.abs(d.world.y-TOWN_BY_ID.oakmere.world.y)<1400)
  .map(d=>({y:d.world.y,bounds:spriteBounds(d.texture??'world_assets',d.frame,d.scale,d.world.x,d.world.y)}));

export class WorldScene extends Phaser.Scene implements EventDirectorHost {
  player!: Player;
  targeting!:TargetingSystem;
  private readonly worldGenerator = new WorldGenerator();
  private chunkManager!: ChunkManager;
  private nextStreamingSnapshotAt=0;
  private dayNight!: DayNightSystem;
  private weather!:WeatherSystem;
  private treeSway!:TreeSwaySystem;
  private waterSurface!:WaterSurfaceSystem;
  private groundShadows!:GroundShadowSystem;
  private traffic!:WorldTrafficSystem;
  private spearProjectiles!:SpearProjectileSystem;
  private m14Art!:M14ArtResidency;
  private passage!:ShipPassageSystem;
  private enemySounds!:EnemySoundSystem;
  private worldSprites!:WorldSpriteSystem;
  private wildlife!:AmbientWildlifeSystem;
  private flagshipArt!:PirateFlagshipArt;
  private volcanicTremor!:VolcanicTremor;
  private volcanicShake!:VolcanicCameraShake;
  private readonly onVolcanicRumble=(seconds:number,intensity:number)=>this.volcanicShake.setRumble(seconds,intensity);
  private readonly onVolcanicSilence=()=>this.volcanicShake.stopRumble();
  private eventDirector!: EventDirector;
  private readonly enemies = new Set<Enemy>();
  private readonly npcs: Npc[] = [];
  private buildings!: Phaser.Physics.Arcade.StaticGroup;
  private treeBodies!: Phaser.Physics.Arcade.StaticGroup;
  private npcBodies!: Phaser.Physics.Arcade.Group;
  private creatureBodies!: Phaser.Physics.Arcade.Group;
  private contentManager!: ContentChunkManager<ContentActor>;
  private readonly regionalNpcSlots=new Map<string,Vec2>();
  private readonly regionalNpcRetryAt=new Map<string,number>();
  private interiors!:InteriorSession;
  private dungeons!:DungeonSystem;
  private storyEncounters!:StoryEncounterSystem;
  private levelUpFeedback!:LevelUpFeedback;
  private roadLife!:AmbientRoadLifeSystem;
  private aliceCompanion!:AliceCompanionSystem;
  get inInterior(){return Boolean(this.interiors?.active);}
  get presentationFocus(){
    return this.player?.active&&this.player.visible&&!this.cinematicDirector?.active
      ?this.player:this.cameras.main.midPoint;
  }
  readonly presentationHeightAt=(x:number,y:number)=>this.worldGenerator?.getElevationAt(x,y)??0;
  get presentationShadows(){return this.groundShadows;}
  get presentationWeather(){return this.weather;}
  get presentationLighting(){return this.dayNight;}
  get presentationWater(){return this.waterSurface;}
  readonly presentationPause=()=>{if(this.presentationControlsEnabled)this.panelActions.add('pause');};
  get presentationControlsEnabled(){
    const state=useGameStore.getState();
    return Boolean(this.player?.active&&this.focused&&!state.panel&&!state.dialogue&&!state.cinematic
      &&!state.pendingCinematic&&!state.housingEditing&&!this.cinematicDirector?.active&&!this.passage?.active);
  }
  get activeInteriorId(){return this.interiors?.currentEntry?.id??null;}
  get storyCombatActive(){return Boolean(this.storyEncounters?.active||this.dungeons?.fighting);}
  get storyInteraction(){return this.dungeons?.prompt??this.storyEncounters?.prompt??null;}
  get dungeonEntries(){return this.dungeons?.entries??[];}
  get dungeonMarkers(){return this.dungeons?.markers??[];}
  isDungeonEnemy(enemy:Enemy){return Boolean(this.dungeons?.owns(enemy));}
  beginDungeon(id:string){this.dungeons.begin(id);}
  closeDungeon(resetTower=true){this.dungeons?.close(resetTower);}
  returnFromTower(){
    if(this.activeInteriorId!==TOWER_ENTRY_ID)return;
    this.interiors.exit();this.player.resetInput();this.targeting.clear();
    const destination=TOWN_SHRINE_BY_ID.oakmere.arrival;
    this.chunkManager.update(destination.x,destination.y,true);this.contentManager.update(destination.x,destination.y);
    const landing=[destination,...respawnArrivalCandidates(TOWN_BY_ID.oakmere)].find(p=>this.worldGenerator.isWalkable(p.x,p.y)&&!this.isBlockedByBuilding(p.x,p.y)
      &&!this.npcs.some(n=>n.active&&Math.hypot(n.x-p.x,n.y-p.y)<36));
    if(landing){
      this.restoreOutsidePosition(landing);this.player.lastDirection.set(0,1);
      this.cameras.main.centerOn(landing.x,landing.y);this.playEffect('teleport',landing.x,landing.y);
      this.notify('Returned to Oakmere. Your last boss checkpoint is safe.');
    }else{
      this.chunkManager.update(this.player.x,this.player.y,true);this.contentManager.update(this.player.x,this.player.y);
      this.notify('Oakmere’s arrival is obstructed. You have been returned safely outside the tower.');
    }
    this.cameras.main.flash(500,0,0,0);this.refreshWorldLighting();this.syncState();this.updateNavigation();saveGame();
  }
  dungeonPoint(point:Vec2){return this.interiors.localPoint(point);}
  dungeonEntranceSuitable(point:Vec2,region:RegionId){return this.worldGenerator.getRegionAt(point.x,point.y)===region&&!this.worldGenerator.isRoad(point.x,point.y,110);}
  registerDungeonEntrance(image:Phaser.GameObjects.Image,tower=false){
    this.physics.add.existing(image,true);this.buildings.add(image);
    const body=image.body as Phaser.Physics.Arcade.StaticBody;
    if(tower){body.setSize(240,110);body.position.set(image.x-120,image.y-170);body.center.set(body.x+120,body.y+55);}
    else{body.setSize(150,60);body.position.set(image.x-75,image.y-image.displayHeight+35);body.center.set(body.x+75,body.y+30);}
  }
  createDungeonEnemy(d:DungeonDefinition,slot:number,p:Vec2,enemyId=d.enemies[slot]){
    const base=ENEMY_BY_ID[enemyId],elite=d.tower?d.tower.floor===5:slot===d.enemies.length-1;
    const towerStep=d.tower?d.tower.chamber-1:0;
    const tuned={...base,boss:false,name:elite?d.captain:`Hardened ${base.name}`,
      appearanceMultiplier:enemyAppearanceMultiplier({...base,boss:false})*(elite?DUNGEON_LEADER_SCALE:1),
      bodyRadius:(base.bodyRadius??11)*(elite?DUNGEON_LEADER_SCALE:1),
      hp:Math.round(base.hp*(elite?4.2:1.65)),
      damage:Math.round(base.damage*(elite?1.9:1.25)),
      moveSpeed:base.moveSpeed*(d.tower?(elite?1.15:1.06):1),
      aggroRange:d.tower?2000:900,attackCooldownMs:Math.round(base.attackCooldownMs*(elite?.85:.95)),summonComposition:undefined,summonEnemyId:undefined,
      xp:0,goldMin:0,goldMax:0};
    const enemy=new Enemy(this,tuned,p.x,p.y,`dungeon-event:${d.id}:${slot}`,true,null,false,null,undefined,d.enemyLevel,
      elite?(d.tower?TOWER_BOSS_PROFILES[towerStep]:CAVE_LEADER_PROFILES[d.id]):undefined,
      d.tower?towerCombatStats(d.tower.chamber,d.tower.floor,base):undefined);
    this.creatureBodies.add(enemy);this.enemies.add(enemy);this.combatEnemyListDirty=true;this.addInteriorContact(enemy);return enemy;
  }
  get combatAllowed(){return !this.inInterior||this.storyCombatActive;}
  playerRenderDepth(y:number){return this.interiors?.playerRenderDepth(y)??y;}
  private readonly interactables = new Map<string, { definition: InteractableContentDefinition; actor: ContentActor }>();
  private lastSafe = { x: LEIGNERON.spawn.x, y: LEIGNERON.spawn.y };
  private hudAccumulator = 0;
  private spawnAccumulator = 0;
  private nextAmbientIntervalMs = 11000;
  private spawnAttempts = 0;
  private nextRoadBanditsAt=0;
  private readonly encounters=new EncounterCoordinator();
  private readonly combatEnemyList:Enemy[]=[];
  private combatEnemyListDirty=true;
  private readonly shipPaths=new WeakMap<Enemy,{until:number;target:Vec2;point:Vec2}>();
  private focused = true;
  private wasBlocked = false;
  // Lethal hits can arrive inside enemy timers and projectile iterations.
  // Finish the transition at the start of a subsequent scene update.
  private pendingRespawn:Vec2|null=null;
  private readonly panelActions = new Set<'map' | 'inventory' | 'character' | 'pause' | 'dialogue' | 'journal' | 'codex'>();
  private readonly heldPanelKeys = new Set<string>();
  private questGuide!: Phaser.GameObjects.Graphics;
  private questMarker!: Phaser.GameObjects.Graphics;
  private questTarget: QuestTarget | null = null;
  private storyCampRetryAt=new Map<string,number>();
  activePlayMs=0;
  private cinematicDirector!:CinematicDirector;
  private reliefWatchMs=0;
  private shuttingDown=false;
  private nextImpactSoundAt=0;
  private nextCombatShakeAt=0;
  private knockbackBudgetUntil=0;
  private knockbackBudget=0;
  private impactVariation=0;
  private readonly combatReducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly pathObstacleBounds=new Phaser.Geom.Rectangle(0,0,0,0);
  getWorldHour(){return this.dayNight.getHour();}
  restAtHome(){
    const s=useGameStore.getState();
    const id=this.interiors.currentEntry?.id,home=housingFor(s.housing,id);
    if(!this.focused||!isPlayerHome(id)||!this.interiors.ready||!home.owned
      ||!this.interiors.homeBedInReach()||this.cinematicDirector.active||this.storyCombatActive||s.panel||s.cinematic||s.dialogue||s.housingEditing)return;
    if(!this.dayNight.sleepUntilMorning()){
      this.notify('You can sleep at home at night, from 18:00 until 06:00.');return;
    }
    this.player.restoreRestVitals();this.player.resetInput();
    this.syncState();this.cameras.main.flash(650,0,0,0);this.notify('You rest at home. Health and stamina restored; it is 06:00.');saveGame();
  }
  restAtInn(){
    const store=useGameStore.getState(),entry=this.interiors.currentEntry;
    if(!this.focused||!this.interiors.ready||entry?.profile!=='inn'||this.storyCombatActive
      ||this.cinematicDirector.active||store.panel||store.dialogue||store.cinematic||store.pendingCinematic)return;
    if(!innRestAvailable(this.dayNight.getHour()*60)){
      this.notify('Inn beds are available at night, from 18:00 until 06:00.');return;
    }
    if(store.gold<INN_REST_COST){this.notify(`You need ${INN_REST_COST}G for a room until morning.`);return;}
    if(!this.dayNight.sleepUntilMorning())return;
    store.hydrate({gold:store.gold-INN_REST_COST});
    this.player.restoreRestVitals();this.player.resetInput();
    this.cameras.main.flash(650,0,0,0);
    this.notify(`You slept at ${entry.name}. Health and stamina restored. It is now 06:00. Room: ${INN_REST_COST}G.`);
    // The snapshot provider captures the authoritative clock and safe exterior
    // position. This one-off save also persists payment without a new schema.
    saveGame();
  }
  getCombatEnemies(){
    if(this.inInterior)return this.dungeons?.active?this.dungeons.enemies:[...this.enemies].filter(e=>this.storyEncounters.owns(e));
    if(this.combatEnemyListDirty){
      this.combatEnemyList.length=0;
      for(const enemy of this.enemies)this.combatEnemyList.push(enemy);
      this.combatEnemyListDirty=false;
    }
    return this.combatEnemyList;
  }
  storyResidents(){return this.inInterior?this.interiors.getResidents():this.npcs.filter(n=>!n.definition.id.startsWith('road-life:'));}
  ambientOpponentFor(enemy:Enemy){return this.aliceCompanion?.opponent(enemy)??this.roadLife?.opponent(enemy)??null;}
  get companionActor(){return this.aliceCompanion?.actor??null;}
  get interiorCompanionActor(){return this.aliceCompanion?.roomActor??null;}
  get companionLocationReady(){return !this.inInterior||this.interiors.ready;}
  adventureAlice(){
    const actor=this.contentManager.activateNpcForPresentation('npc:'+ALICE_NPC_ID);
    return actor instanceof Npc?actor:null;
  }
  returnAliceHome(){
    const definition=CONTENT_BY_ID['npc:'+ALICE_NPC_ID];
    this.contentManager.patchState(definition.id,{...definition.world});
  }
  companionCanStand(point:Vec2,npc:Npc){
    return Math.hypot(point.x-this.player.x,point.y-this.player.y)>=52
      &&(this.inInterior?this.interiors.ready&&this.interiors.combatFeet(point.x,point.y,18,npc,true):this.npcCanStandAt(point.x,point.y,npc));
  }
  companionPathClear(from:Vec2,to:Vec2,npc:Npc){
    // Use static room geometry indoors. Transient actors must not turn a
    // narrow hallway into a blocked route while outdoor physics is paused.
    if(this.inInterior)return this.interiors.ready&&this.interiors.companionPath(from,to,npc);
    return this.canNpcVisit(from,to)&&this.canTraverseGround(from,to)
      &&!this.npcPathBlocker(from,to,npc);
  }
  talkToCompanion(){
    const npc=this.companionActor;
    if(!npc||this.storyCombatActive||Math.hypot(npc.x-this.player.x,npc.y-this.player.y)>180
      ||!this.hasClearPath(npc.x,npc.y,this.player.x,this.player.y))return false;
    useGameStore.getState().startDialogue(ALICE_NPC_ID);return true;
  }
  canRoadNpcFight(enemy:Enemy){
    const content=this.contentManager.getDefinition(enemy.instanceId);
    return !enemy.definition.boss&&!this.storyActor(enemy)&&!this.contentManager.getSummonOwner(enemy.instanceId)
      &&!enemy.encounterKey?.startsWith('encounter:boss-wave:')&&!(content?.kind==='creature'&&content.campaignReserve);
  }
  damageRoadNpc(npc:Npc,damage:number){if(!this.aliceCompanion?.damage(npc,damage))this.roadLife?.damage(npc,damage);}
  createRoadNpc(definition:NpcDefinition,point:Vec2){
    const npc=new Npc(this,definition,point.x,point.y,point);
    npc.disableInteractive();this.npcBodies.add(npc);this.npcs.push(npc);this.groundShadows.register(npc);
    return npc;
  }
  releaseRoadNpc(npc:Npc){this.npcBodies.remove(npc);this.destroyContentActor(npc);}
  ensureStoryEnemy(id:string){return this.m14Art.ensure(id);}
  releaseTowerBossArt(){this.m14Art?.forget('grand-magus');}
  storyEncounterAnchor(e:StoryEncounter):Vec2|undefined{
    if(e.interiorNpcId){
      const room=NPC_INTERIOR_BY_ID[e.interiorNpcId];
      if(room&&storyEncounterInCourtyard(e,useGameStore.getState().storyFlags))return this.inInterior?undefined:room.entry.door;
      if(!this.interiors.ready||this.activeInteriorId!==room?.entry.id)return;
      const npc=this.interiors.getActor(e.interiorNpcId);return npc?{x:npc.x,y:npc.y+80}:undefined;
    }
    if(this.inInterior)return;
    const actor=e.npcId?this.contentManager.getActor('npc:'+e.npcId):undefined;
    return actor??(e.npcId?this.contentManager.getState('npc:'+e.npcId):e.contentId?
      this.contentManager.getState(e.contentId):undefined);
  }
  storySpawnClear(p:Vec2,enemyId:string,from:Vec2=this.player,radiusScale=1){
    const radius=(ENEMY_BY_ID[enemyId].bodyRadius??11)*radiusScale;
    return this.inInterior?this.interiors.combatFeet(p.x,p.y,radius)&&this.interiors.combatPath(from,p,radius)
      :this.worldGenerator.isWalkable(p.x,p.y)&&!this.isBlockedByBuilding(p.x,p.y)
        &&!this.worldSprites.blocksPath({x:p.x-radius,y:p.y},{x:p.x+radius,y:p.y},radius*2,radius*2)
        &&[-radius,radius].every(dx=>[-radius*2,0].every(dy=>this.worldGenerator.isWalkable(p.x+dx,p.y+dy)))
        &&this.hasClearPath(from.x,from.y,p.x,p.y)&&this.worldGenerator.isWalkablePath(from,p)
        &&!this.npcs.some(n=>n.active&&Math.hypot(n.x-p.x,n.y-p.y)<65);
  }
  /** Walk a bounded connected component, not just straight rays from the player.
   * This finds usable floor around furniture and through doorways. It runs only
   * on a wave-placement retry, never on every enemy/frame. */
  storySpawnCandidates(anchor:Vec2,radius:number,enemyId:string){
    const step=32,nodes:Vec2[]=[{x:this.player.x,y:this.player.y}],seen=new Set<string>(['0:0']);
    const candidates:Vec2[]=[];
    for(let head=0;head<nodes.length&&head<900;head++){
      const point=nodes[head];
      if(head>0)candidates.push(point);
      for(const [dx,dy] of [[step,0],[-step,0],[0,step],[0,-step]]){
        const next={x:point.x+dx,y:point.y+dy};
        const key=Math.round((next.x-this.player.x)/step)+':'+Math.round((next.y-this.player.y)/step);
        if(seen.has(key)||Math.hypot(next.x-anchor.x,next.y-anchor.y)>radius)continue;
        seen.add(key);
        if(nodes.length<900&&this.storySpawnClear(next,enemyId,point))nodes.push(next);
      }
    }
    return candidates.sort((a,b)=>Math.abs(Math.hypot(a.x-this.player.x,a.y-this.player.y)-240)
      -Math.abs(Math.hypot(b.x-this.player.x,b.y-this.player.y)-240));
  }
  recoverStoryEncounter(e:StoryEncounter){
    const room=e.interiorNpcId&&NPC_INTERIOR_BY_ID[e.interiorNpcId];
    if(!room||this.activeInteriorId!==room.entry.id)return false;
    useGameStore.getState().setStoryFlag(`encounter:${e.id}:courtyard`);
    this.interiors.exit();
    this.notify('There is no room to fight here. Meet the attackers outside, then return for the records.');
    return true;
  }
  createStoryEnemy(id:string,p:Vec2,instanceId:string){
    const enemy=this.createContentActor({id:instanceId,kind:'creature',enemyId:id,world:p,eventSpawn:true},{...p}) as Enemy;
    try{if(this.inInterior)this.addInteriorContact(enemy);return enemy;}
    catch(error){this.destroyContentActor(enemy);throw error;}
  }
  addInteriorContact(actor:Phaser.GameObjects.Sprite){return this.groundShadows.interiorContact(actor,y=>this.playerRenderDepth(y)-1);}
  lightStorySignal(id:string){
    this.contentManager.getActor('story:signal-fire:'+id)?.setVisible(true);
    const clue=id==='mountain-signal'?'story:beacon-kit':id==='winter-signal'?'story:frost-lantern':undefined;
    if(clue)this.contentManager.getActor(clue)?.setVisible(false);
  }
  releaseStoryEnemy(enemy:Enemy){this.forgetOrcSpears(enemy.instanceId);this.destroyContentActor(enemy);}
  storyActor(enemy:Enemy){return enemy.instanceId.startsWith('story-event:')||enemy.instanceId.startsWith('dungeon-event:');}
  canEnemyTargetPlayer(enemy:Enemy){
    return this.storyActor(enemy)?Boolean(this.dungeons?.owns(enemy)?this.dungeons.allows(this.player):this.storyEncounters?.owns(enemy)&&this.storyEncounters.allows(this.player))
      :!this.inInterior&&this.isEnemyTerritory(this.player.x,this.player.y);
  }
  updateInteriorStoryCombat(time:number,delta:number,blocked:boolean){
    if(this.dungeons.active)this.dungeons.update(time,blocked);else this.storyEncounters.update(time,delta,blocked);
    if(!this.inInterior)return; // A confirmed tower portal restored the overworld.
    blocked=blocked||this.cinematicDirector.active;
    if(!blocked)this.targeting.update();
    for(const enemy of [...this.enemies]){
      if(!this.storyEncounters.owns(enemy)&&!this.dungeons.owns(enemy)){enemy.updatePresentation(this.player.x,this.player.y,true);continue;}
      if(!blocked){enemy.updateEnemy(time,Math.min(delta,80));if(enemy.active)this.interiors.advanceEnemy(enemy,delta);}
      if(enemy.active){enemy.setDepth(this.playerRenderDepth(enemy.y));enemy.updatePresentation(this.player.x,this.player.y,blocked);}
    }
    if(!blocked)this.spearProjectiles.update(delta);
  }
  playEnemyVocal(definition:EnemyDefinition,instanceId:string,cue:EnemySoundCue,x:number,y:number){
    if(!useGameStore.getState().weatherAudio||this.sound.locked)return;
    this.enemySounds.play(definition,instanceId,cue,x,y);
  }
  forgetEnemySound(instanceId:string){this.enemySounds.forget(instanceId);}
  playDragonSound(instanceId:string,cue:'roar'|'breath'|'flight',x:number,y:number,duration:number){this.enemySounds.playEffect(instanceId,cue,x,y,duration);}
  stopDragonSound(instanceId:string,cue?:'roar'|'breath'|'flight'){this.enemySounds.stopEffect(instanceId,cue);}
  canSeeEnemy(enemy:Enemy){return this.inInterior?this.storyEncounters.owns(enemy)||this.dungeons.owns(enemy):this.dayNight.isIlluminated(enemy.x,enemy.y)||Math.hypot(enemy.x-this.player.x,enemy.y-this.player.y)<180;}
  safeSkillPosition(point:Vec2){return this.inInterior?this.interiors.playerFeet(point.x,point.y):this.worldGenerator.isWalkable(point.x,point.y)&&!this.isBlockedByBuilding(point.x,point.y);}
  canTraverseGround(from:Vec2,to:Vec2){
    if(this.inInterior)return this.interiors.clearPath(from,to);
    // Swept feet catch thin object/wall contours before the terrain sampling.
    return !fortificationBlocksPath(from,to,12)&&!this.worldSprites.blocksPath(from,to)
      &&this.worldGenerator.isWalkablePath(from,to);
  }
  restoreOutsidePosition(point:Vec2){
    (this.player.body as Phaser.Physics.Arcade.Body).reset(point.x,point.y);
    this.lastSafe={...point};this.player.setDepth(point.y);
  }
  prepareStoryArena(){this.aliceCompanion?.pauseForStory();this.roadLife?.clear();this.contentManager.suspendCreatures();this.spearProjectiles.clear();this.wildlife.reset();}
  cancelStoryEncounter(){this.storyEncounters?.clear();this.player.resetInput();this.spearProjectiles.clear();}
  interactWithStory(){return this.dungeons?.interact()||this.storyEncounters.interact();}
  playStoryIntro(id:string){return this.cinematicDirector.start('encounter-'+id);}
  skillLanding(target:Vec2,range:number):Vec2 {
    const from={x:this.player.x,y:this.player.y};
    const candidates=[32,48,64].flatMap(radius=>Array.from({length:16},(_,i)=>({x:target.x+Math.cos(i*Math.PI/8)*radius,y:target.y+Math.sin(i*Math.PI/8)*radius})));
    candidates.sort((a,b)=>Math.hypot(a.x-from.x,a.y-from.y)-Math.hypot(b.x-from.x,b.y-from.y));
    return candidates.find(p=>Math.hypot(p.x-from.x,p.y-from.y)<=range&&this.safeSkillPosition(p)&&this.canNpcVisit(from,p))??from;
  }
  applySkillDamage(enemy:Enemy,skill:ActiveSkillDefinition,multiplier:number,direction:Phaser.Math.Vector2,weaponId=this.getEquippedWeapon().id) {
    if(!enemy.active||enemy.hp<=0)return;
    const progression=progressionStats(useGameStore.getState().attributes,useGameStore.getState().learnedSkills,useGameStore.getState().armorBonuses);
    const level=useGameStore.getState().level;
    const growth=playerDamageGrowth(level);
    const inventory=useGameStore.getState(),weapon=enhancedWeapon(weaponId,inventory.weaponUpgrades,inventory.awakenedWeapons);
    enemy.takeDamage(Math.max(1,Math.round(weapon.damage*progression.damageMultiplier*progression.skillDamageMultiplier*growth*multiplier)),direction,
      {forceStagger:skill.id==='crescent-flurry',weaponId:weapon.id,procHitWeight:Math.min(1,multiplier),
        impact:skill.id==='skyfall-slam'?'slam':skill.id==='iron-tempest'?'heavy':'light'});
  }
  cinematicLocation(shot:StoryShot){return (shot.focusNpcId?NPC_INTERIOR_BY_ID[shot.focusNpcId]?.entry:undefined)
    ??(shot.interiorId?INTERIOR_ENTRIES.find(entry=>entry.id===shot.interiorId):undefined);}
  get cinematicLocationId(){return this.interiors.currentEntry?.id??'world';}
  beginCinematicView(){
    this.aliceCompanion?.pauseForStory();
    this.interiors.beginCinematic();this.prepareStoryActors();this.targeting.clear();
    this.questGuide.clear();this.questGuide.setVisible(false);this.questMarker.setVisible(false);this.spearProjectiles.clear();this.wildlife.reset();this.volcanicTremor.pause();
  }
  prepareCinematicShot(shot:StoryShot){return this.interiors.showCinematicLocation(this.cinematicLocation(shot)??null);}
  restoreCinematicLocation(){return this.interiors.restoreCinematicLocation();}
  recoverCinematicLocation(){this.interiors.recoverCinematicLocation();}
  constrainCinematicCamera(x:number,y:number,zoom:number){return this.interiors.constrainCamera(x,y,zoom);}
  cinematicTarget(shot:StoryShot){return (shot.focusNpcId?this.storyActorPosition(shot.focusNpcId):undefined)
    ??(this.inInterior?this.interiors.viewCenter:shot);}
  cinematicSubjectReady(id?:string){return !id||Boolean(this.inInterior?this.interiors.getActor(id):this.contentManager.getActor('npc:'+id));}
  cinematicTransitionReady(target:Vec2,zoom:number,focusNpcId?:string){
    if(this.inInterior)return this.interiors.ready&&this.cinematicSubjectReady(focusNpcId);
    const camera=this.cameras.main;camera.preRender();
    const half=projectedGroundHalfExtents(camera),factor=camera.zoom/Math.min(camera.zoom,zoom);
    const halfWidth=half.x*factor,halfHeight=half.y*factor;
    return this.chunkManager.hasView({
      left:Math.min(camera.midPoint.x,target.x)-halfWidth,
      right:Math.max(camera.midPoint.x,target.x)+halfWidth,
      top:Math.min(camera.midPoint.y,target.y)-halfHeight,
      bottom:Math.max(camera.midPoint.y,target.y)+halfHeight,
    })&&this.cinematicSubjectReady(focusNpcId);
  }
  streamCinematicView(x:number,y:number):boolean;
  streamCinematicView(staged?:boolean,focusNpcId?:string,checkSubjects?:boolean):boolean;
  streamCinematicView(viewOrX:boolean|number=false,focusOrY?:string|number,checkSubjects=true):boolean{
    const staged=typeof viewOrX==='boolean'&&viewOrX,focusNpcId=typeof focusOrY==='string'?focusOrY:undefined;
    if(this.inInterior)return this.interiors.ready&&this.cinematicSubjectReady(focusNpcId);
    const camera=this.cameras.main;camera.preRender();
    // Preserve explicit-location callers outside cinematics; the director and
    // voyage always use the actual camera after setting its position/zoom.
    const explicit=typeof viewOrX==='number'&&typeof focusOrY==='number'&&!this.cinematicDirector?.active;
    const x=explicit&&typeof viewOrX==='number'?viewOrX:camera.midPoint.x;
    const y=explicit&&typeof focusOrY==='number'?focusOrY:camera.midPoint.y;
    const view=projectedGroundView(camera,x,y);
    const ready=this.chunkManager.updateView(view,staged);
    this.contentManager.update(x,y,view);
    if(focusNpcId)this.contentManager.activateNpcForPresentation('npc:'+focusNpcId);
    return ready&&(!checkSubjects||this.cinematicSubjectReady(focusNpcId));
  }
  resumeAfterCinematic(){
    this.player.resetInput();this.questGuide.setVisible(true);
    const state=useGameStore.getState();
    if(!this.inInterior&&this.focused&&!state.panel&&!state.dialogue&&!this.passage.active)this.physics.world.resume();
    else this.physics.world.pause();
    if(!this.inInterior)this.refreshWorldLighting();
  }
  storyActorPosition(id:string){
    if(this.inInterior){const resident=this.interiors.getActor(id);return resident?{x:resident.x,y:resident.y-35}:undefined;}
    const actor=this.interiors?.getActor(id)??this.contentManager.getActor('npc:'+id)
      ??NPC_INTERIOR_BY_ID[id]?.entry.door??this.contentManager.getState('npc:'+id);
    return actor?{x:actor.x,y:actor.y-35}:undefined;
  }
  prepareStoryActors(){for(const npc of this.npcs)if(!npc.definition.formation)npc.storyRest();}
  escortArrival(){return npcEscortArrival();}
  recordTraining(targetId:string) {
    if(this.inInterior)return;
    const target=this.contentManager.getActor('training:highmere-target');
    if(target&&Math.hypot(this.player.x-target.x,this.player.y-target.y)<240
      && this.hasClearPath(this.player.x,this.player.y,target.x,target.y,target)) useGameStore.getState().progressQuest('train',targetId);
  }

  constructor() {
    super('world');
  }

  canNpcVisit(from: { x: number; y: number }, to: { x: number; y: number }) {
    if(this.inInterior)return this.interiors.combatPath(from,to);
    const distance = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
    const steps = Math.max(1, Math.ceil(distance / 24));
    for (let i = 0; i <= steps; i++) {
      const x = Phaser.Math.Linear(from.x, to.x, i / steps);
      const y = Phaser.Math.Linear(from.y, to.y, i / steps);
      if (!this.worldGenerator.isWalkable(x, y) || this.isBlockedByBuilding(x, y) || this.isNpcObscured(x,y)) return false;
    }
    return !this.worldSprites.blocksPath(from,to)&&this.hasClearPath(from.x, from.y, to.x, to.y);
  }

  /** Nearest person in an NPC's intended segment; used for local crowd avoidance. */
  npcPathBlocker(from:Vec2,to:Vec2,exclude?:Npc):Vec2|null {
    const dx=to.x-from.x,dy=to.y-from.y,len2=dx*dx+dy*dy;
    if(len2<1)return null;
    let best=Infinity,point:Vec2|null=null;
    // This runs for every walking road NPC. Traverse existing actors directly
    // instead of allocating a filtered crowd list on every movement frame.
    const includeRoadLife=Boolean(exclude?.definition.id.startsWith('road-life:'));
    // A character farther than 43 px outside this segment's rectangle cannot
    // collide with it. Cull them before doing projection or square roots.
    const left=Math.min(from.x,to.x)-43,right=Math.max(from.x,to.x)+43;
    const top=Math.min(from.y,to.y)-43,bottom=Math.max(from.y,to.y)+43;
    for(let i=0;i<=this.npcs.length;i++){
      const other=i===this.npcs.length?this.player:this.npcs[i];
      if(!other||other===exclude||!other.active)continue;
      if(i<this.npcs.length&&!includeRoadLife&&(other as Npc).definition.id.startsWith('road-life:'))continue;
      if(other.x<left||other.x>right||other.y<top||other.y>bottom)continue;
      const vx=other.x-from.x,vy=other.y-from.y;
      const fraction=Math.max(0,Math.min(1,(vx*dx+vy*dy)/len2));
      const projectedX=from.x+dx*fraction,projectedY=from.y+dy*fraction;
      const sideGap=Math.hypot(other.x-projectedX,other.y-projectedY);
      const ahead=Math.hypot(vx,vy);
      if(ahead<8||sideGap>=43||fraction<=0)continue;
      if(ahead<best){best=ahead;point={x:other.x,y:other.y};}
    }
    return point;
  }
  npcCanStandAt(x:number,y:number,exclude?:Npc,regional=false):boolean {
    return this.worldGenerator.isWalkable(x,y)&&!this.isBlockedByBuilding(x,y)
      &&!this.isNpcObscured(x,y,regional||Boolean(exclude?.usesRegionalPresentation))
      &&this.npcs.every(n=>!n.active||n===exclude||(npcMayPatrol(n.definition)?Math.hypot(n.x-x,n.y-y)>=64:npcPersonalSpace(n,{x,y})))
      &&(!this.player?.active||Math.hypot(this.player.x-x,this.player.y-y)>=52);
  }

  create() {
    this.shuttingDown=false;
    // Register before constructing anything that owns listeners or resources.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,this.shutdown,this);
    this.events.once(Phaser.Scenes.Events.DESTROY,this.shutdown,this);
    try {
    this.nextImpactSoundAt=0;this.nextCombatShakeAt=0;this.knockbackBudgetUntil=0;this.knockbackBudget=0;
    this.registry.set('loadingStage','Creating world actors');
    this.pendingRespawn=null;
    this.regionalNpcSlots.clear();
    this.regionalNpcRetryAt.clear();
    this.spearProjectiles=new SpearProjectileSystem(this);
    this.m14Art=new M14ArtResidency(this,id=>{
      for(const enemy of this.enemies)if(enemy.active&&enemy.definition.id===id)return true;
      return false;
    },message=>this.notify(message));
    this.cameras.main.shakeEffect.destroy();
    this.volcanicShake=new VolcanicCameraShake(this.cameras.main);
    this.cameras.main.shakeEffect=this.volcanicShake;
    this.volcanicTremor=new VolcanicTremor();
    useGameStore.getState().setBossEncounter(null);
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.dayNight = new DayNightSystem(this);
    this.weather=new WeatherSystem(this,this.worldGenerator);
    this.treeSway=new TreeSwaySystem(this);
    this.waterSurface=new WaterSurfaceSystem(this,this.worldGenerator);
    this.groundShadows=new GroundShadowSystem(this);
    this.cinematicDirector=new CinematicDirector(this);
    this.activePlayMs=0;
    this.eventDirector = new EventDirector(this);
    this.buildings = this.physics.add.staticGroup();
    this.treeBodies = this.physics.add.staticGroup();
    this.wildlife=new AmbientWildlifeSystem(this,{
      habitat:point=>({region:this.worldGenerator.getRegionAt(point.x,point.y),
        biome:this.worldGenerator.getBiomeAt(point.x,point.y),terrain:this.worldGenerator.getTerrainAt(point.x,point.y)}),
      clearRoute:(from,to)=>this.wildlifeRouteClear(from,to),
      birdSite:point=>this.birdGroundSite(point),
      gullFlyby:player=>this.tidewatchGullFlyby(player),
      coastalSite:point=>this.coastalBirdSite(point),
    },this.groundShadows);
    this.worldSprites=new WorldSpriteSystem(this,this.treeBodies,this.groundShadows,this.wildlife);
    this.flagshipArt=new PirateFlagshipArt(this,this.treeBodies);
    this.traffic=new WorldTrafficSystem(this,this.worldGenerator,this.groundShadows);
    this.passage=new ShipPassageSystem(this,this.worldGenerator,this.traffic);
    this.enemySounds=new EnemySoundSystem(this);
    this.npcBodies = this.physics.add.group();
    this.creatureBodies = this.physics.add.group();
    this.chunkManager = new ChunkManager(this,this.worldGenerator,this.treeSway,this.dayNight,this.worldSprites);
    this.enemies.clear();this.combatEnemyListDirty=true; this.npcs.length = 0; this.interactables.clear();
    this.storyCampRetryAt.clear();
    this.spawnAttempts = 0; this.spawnAccumulator = 0; this.hudAccumulator = 0;
    this.nextAmbientIntervalMs = 11000; this.nextRoadBanditsAt=0; this.encounters.clear();
    this.focused = true; this.wasBlocked = false;

    const state = useGameStore.getState();
    const nearSaved=[{x:state.worldX,y:state.worldY},...[128,256,512,1024,2048,4096,8192].flatMap(radius=>Array.from({length:24},(_,i)=>({x:state.worldX+Math.cos(i*Math.PI/12)*radius,y:state.worldY+Math.sin(i*Math.PI/12)*radius})))];
    const safeSaved=nearSaved.find(p=>this.worldGenerator.isWalkable(p.x,p.y))??LEIGNERON.spawn;
    const spawnX=safeSaved.x,spawnY=safeSaved.y;
    this.player = new Player(this, spawnX, spawnY);
    this.levelUpFeedback=new LevelUpFeedback(this);
    this.roadLife=new AmbientRoadLifeSystem(this,this.worldGenerator);
    this.groundShadows.register(this.player);
    this.targeting=new TargetingSystem(this);
    this.lastSafe = { x: spawnX, y: spawnY };

    this.physics.add.collider(this.player, this.buildings);
    this.physics.add.collider(this.player, this.treeBodies);
    // Regional residents and recruited Alice have physical foot separation.
    // Existing town patrol collision behavior stays unchanged.
    this.physics.add.collider(this.player,this.npcBodies,undefined,(_player,npc)=>npc instanceof Npc&&(npc.usesRegionalPresentation||npc.adventureCompanion));
    // People aren't immovable street barriers. Their patrols still avoid props.
    this.physics.add.collider(this.creatureBodies, this.buildings);
    this.physics.add.collider(this.creatureBodies, this.treeBodies);
    // Ground enemies cannot occupy the same feet position. Wolves retain their
    // approved soft pack separation; dragon flight uses its own movement system.
    this.physics.add.collider(this.creatureBodies,this.creatureBodies,undefined,(a,b)=>
      a instanceof Enemy&&b instanceof Enemy&&a.hp>0&&b.hp>0
      &&a.definition.combatStyle!=='dragon'&&b.definition.combatStyle!=='dragon'
      &&!(a.wolfPackId&&b.wolfPackId));
    this.physics.add.collider(this.npcBodies, this.buildings);
    this.physics.add.collider(this.npcBodies, this.treeBodies);
    this.physics.add.collider(this.npcBodies, this.npcBodies);
    this.registry.set('loadingStage','Restoring saved encounters');
    let logical = { ...state.worldContent, states: { ...state.worldContent.states } };
    // Defeat history remains permanent for quests; the content ledger, not
    // defeatedBosses, controls the 20-minute battle respawn timer.
    for (const bossId of state.defeatedBosses) {
      const definition=WORLD_CONTENT.find(d=>d.id===`boss:${bossId}`);
      if(definition&&!logical.states[definition.id])logical.states[definition.id]={
        ...initialContentState(definition),hp:0,defeated:true,respawnAt:Date.now()+BOSS_RESPAWN_MS,
      };
    }
    // Migrate only surviving camp actors still at the old marker positions.
    // Keep health/defeat history and actors that have already wandered away.
    for(const siteId of ['clan-road-muster','southern-caravan-rest']){
      const site=WILDERNESS_SITES.find(s=>s.id===siteId)!;
      for(const definition of WORLD_CONTENT){
        if(!definition.id.startsWith(`creature:krag-warband:${siteId}:`))continue;
        const saved=logical.states[definition.id];
        if(saved&&!saved.defeated&&Math.hypot(saved.x-site.world.x,saved.y-site.world.y)<100)
          logical.states[definition.id]={...saved,...definition.world};
      }
    }
    logical = restoreLegacySummonWaves(WORLD_CONTENT,logical);
    logical = repairCreaturePlacements(WORLD_CONTENT,logical,this.worldGenerator);
    logical=normalizePirateCrews(logical,this.worldGenerator,(x,y)=>this.canEnemyOccupy(x,y));
    logical=normalizeGoblinCrews(logical,this.worldGenerator,(x,y)=>this.canEnemyOccupy(x,y)
      &&creatureFitsHabitat(ENEMY_BY_ID['goblin-stone-slinger'],this.habitatAt(x,y)));
    this.registry.set('loadingStage','Indexing saved world actors');
    this.contentManager = new ContentChunkManager(WORLD_CONTENT, logical, {
      initialState: initialContentState,
      keepActive:definition=>definition.kind==='npc'&&definition.npcId===ALICE_NPC_ID&&aliceIsFollowing(useGameStore.getState().storyFlags),
      canActivate: (definition, runtime) => {
        if(definition.kind==='creature'&&this.storyCombatActive)return false;
        if(definition.kind==='npc'&&NPC_INTERIOR_BY_ID[definition.npcId])return false;
        if(definition.kind==='npc'&&(NPC_BY_ID[definition.npcId].settlementResident||citizenModel(NPC_BY_ID[definition.npcId])!==undefined)){
          if(this.time.now<(this.regionalNpcRetryAt.get(definition.id)??0))return false;
          const npc=NPC_BY_ID[definition.npcId],home=useGameStore.getState().storyFlags['relocated:'+definition.id]?runtime:definition.world;
          const offsets:Array<[number,number]>=[[0,0]];
          for(const radius of [64,96,128,176,224,280,352,448,576])
            for(const [dx,dy] of [[0,-1],[-1,0],[1,0],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]])offsets.push([dx*radius,dy*radius]);
          const point=offsets.map(([dx,dy])=>({x:home.x+dx,y:home.y+dy}))
            .find(p=>this.npcCanStandAt(p.x,p.y,undefined,true)&&npcStandingOffRoad(npc,p));
          if(point){this.regionalNpcSlots.set(definition.id,point);this.regionalNpcRetryAt.delete(definition.id);}
          else this.regionalNpcRetryAt.set(definition.id,this.time.now+1000);
          return Boolean(point); // Never spawn an unchecked fallback in scenery.
        }
        if(definition.kind!=='creature')return true;
        // Read actual authored quotas; a 15-kill mission cannot disappear at
        // the old 3/5-kill threshold. Preserve repeatable flagship crews.
        const mission=clearStageFor(definition.id);
        if(mission&&!definition.id.startsWith('pirate:flagship:crew:')){
          const story=useGameStore.getState();
          if((story.quests[mission.questId]?.objectiveProgress[mission.objective.id]??0)>=mission.objective.amount)return false;
        }
        const m14=!ENEMY_BY_ID[definition.enemyId].boss&&(definition.enemyId==='hedge-goblin'||M14_ART.some(spec=>spec.id===definition.enemyId));
        // A native pack may chase briefly beyond its home habitat. Restoring
        // its surviving actors must not strand them dormant on a meadow edge.
        const habitatPoint=m14&&!mission?definition.encounterBehavior?.home??runtime:runtime;
        const summon=Boolean(this.contentManager.getSummonOwner(definition.id));
        return this.isEnemyTerritory(runtime.x,runtime.y)
          &&(summon||Boolean(mission)||!m14&&!['rindass-orc-raider','rindass-orc-spearman'].includes(definition.enemyId)
            ||creatureFitsHabitat(ENEMY_BY_ID[definition.enemyId],this.habitatAt(habitatPoint.x,habitatPoint.y)))
          &&(summon||this.m14LocationAllowed(definition.enemyId,habitatPoint.x,habitatPoint.y))
          &&this.m14Art.ensure(definition.enemyId)
          &&this.encounterCapacity(definition.bossId?'boss':'restore')>0;
      },
      canActivateGroup: members => members.length <= this.encounterCapacity('restore')
        && members.every(({ state }) => this.canEnemyOccupy(state.x,state.y)),
      prepareCreatureGroup:members=>{
        if(!members[0]||members[0].definition.id.startsWith('pirate:flagship:crew:'))return true;
        const mission=clearStageFor(members[0].definition.id);if(!mission)return true;
        const group=members[0].definition.encounterId??members[0].definition.wolfPackId??members[0].definition.id;
        const groupKey=members[0].definition.wolfPackId?'wolf:'+members[0].definition.wolfPackId:'encounter:'+group;
        const reserve=members.some(m=>m.definition.campaignReserve)||group.includes(':reserve:');
        if(reserve&&nextObjective(mission.questId,useGameStore.getState().quests)?.id!==mission.objective.id)return false;
        const deployClear=(p:Vec2)=>Math.hypot(p.x-this.player.x,p.y-this.player.y)>=160
          &&![...this.enemies].some(e=>e.active&&e.hp>0&&e.encounterKey!==groupKey&&Math.hypot(e.x-p.x,e.y-p.y)<240);
        const region=this.worldGenerator.getRegionAt(members[0].definition.world.x,members[0].definition.world.y);
        const fits=(enemyId:string,point:Vec2)=>{
          const radius=ENEMY_BY_ID[enemyId].bodyRadius??11;
          return this.canEnemyOccupy(point.x,point.y)&&this.m14LocationAllowed(enemyId,point.x,point.y)
            &&this.worldGenerator.getRegionAt(point.x,point.y)===region
            &&[-radius,radius].every(dx=>[-radius*2,0].every(dy=>this.canEnemyOccupy(point.x+dx,point.y+dy)))
            &&!this.worldSprites.blocksPath({x:point.x-radius,y:point.y},{x:point.x+radius,y:point.y},radius*2,radius*2);
        };
        const valid=members.every(({definition,state},index)=>fits(definition.enemyId,state)
          &&members.slice(index+1).every(m=>Math.hypot(state.x-m.state.x,state.y-m.state.y)>=64));
        if(valid&&(!reserve||members.every(m=>deployClear(m.state))))return true;
        if(valid&&reserve&&members.some(m=>[...this.enemies].some(e=>e.active&&e.hp>0&&e.encounterKey!==groupKey
          &&Math.hypot(e.x-m.state.x,e.y-m.state.y)<240)))return false;
        if(this.time.now<(this.storyCampRetryAt.get(group)??0))return false;
        this.storyCampRetryAt.set(group,this.time.now+2500);
        // Never move a patrol that is already fighting. Restore missing
        // members only after the current group leaves the active area.
        if([...this.enemies].some(e=>e.active&&e.hp>0&&e.encounterKey===groupKey))return false;
        const size=WORLD_CONTENT.filter(d=>d.kind==='creature'&&(d.encounterId??d.wolfPackId)===group).length;
        const placement=findCampaignPatrolPlacement(members,size,(id,p)=>fits(id,p)
          &&authoredBosses.every(b=>Math.hypot(b.world.x-p.x,b.world.y-p.y)>620),
          (a,b)=>this.hasClearPath(a.x,a.y,b.x,b.y)&&this.worldGenerator.isWalkablePath(a,b),deployClear);
        if(!placement)return false;
        for(const [index,member] of members.entries()){
          const station=placement.positions[index];
          this.contentManager.patchState(member.definition.id,{...station,
            encounterPlacement:{home:{...placement.home},station:{...station}}});
        }
        return false; // Re-read the corrected ledger on the next streaming pass.
      },
      canRespawn: definition => definition.id!=='boss:salt-king'&&!definition.id.startsWith('pirate:flagship:crew:')
        ||!onFlagshipBoarding(this.player.x,this.player.y)&&Math.hypot(this.player.x-FLAGSHIP.topLeft.x-530,this.player.y-FLAGSHIP.topLeft.y-900)>1200,
      create: (definition, runtime) => this.createContentActor(definition, runtime),
      position: actor => actor,
      capture: (definition, actor) => ({ ...(definition.kind==='npc'&&definition.npcId===ALICE_NPC_ID
        &&aliceIsFollowing(useGameStore.getState().storyFlags)?definition.world:{x:actor.x,y:actor.y}),
        ...(definition.kind === 'creature' ? { hp: (actor as Enemy).hp,hpMax:(actor as Enemy).definition.hp,
          bossPhase:(actor as Enemy).bossPhaseSnapshot } : {}),
      }),
      destroy: actor => this.destroyContentActor(actor),
    });

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 1, 1);
    this.cameras.main.setRoundPixels(true);
    this.updateCameraZoom();
    this.scale.on('resize', this.updateCameraZoom, this);
    this.game.events.on(Phaser.Core.Events.BLUR, this.onBlur, this);
    this.game.events.on(Phaser.Core.Events.FOCUS, this.onFocus, this);
    setSaveSnapshotProvider(() => this.syncState());
    this.interiors=new InteriorSession(this);
    this.dungeons=new DungeonSystem(this);
    this.storyEncounters=new StoryEncounterSystem(this);
    this.aliceCompanion=new AliceCompanionSystem(this);

    this.registry.set('loadingStage','Drawing nearby terrain');
    // First boot (including Continue) must not synchronously bake the full
    // 3x3 terrain neighborhood: nine 1536px canvases can exhaust Android
    // graphics memory before the first frame. Render just the visible view
    // initially; normal update() streams the offscreen neighbors later.
    this.chunkManager.update(this.player.x, this.player.y, true);
    this.registry.set('loadingStage','Activating nearby world actors');
    this.contentManager.update(this.player.x, this.player.y,
      projectedGroundView(this.cameras.main,this.player.x,this.player.y));
    // Layout updates can put a saved player inside a new foundation.
    // Repair position only, never health, stamina or story progress.
    if(this.isBlockedByBuilding(this.player.x,this.player.y)) {
      const candidates=[48,80,128,192,256,384,512].flatMap(radius=>Array.from({length:16},(_,i)=>({
        x:spawnX+Math.cos(i*Math.PI/8)*radius,y:spawnY+Math.sin(i*Math.PI/8)*radius,
      })));
      const safe=candidates.find(p=>this.worldGenerator.isWalkable(p.x,p.y)&&!this.isBlockedByBuilding(p.x,p.y))??LEIGNERON.spawn;
      (this.player.body as Phaser.Physics.Arcade.Body).reset(safe.x,safe.y);this.lastSafe={...safe};
      this.chunkManager.update(safe.x,safe.y,true);this.contentManager.update(safe.x,safe.y);
    }
    this.questGuide = this.add.graphics().setDepth(9100).setName('quest-direction-guide');
    this.questMarker = this.add.graphics().setDepth(9100).setName('quest-target-marker');
    this.updateNavigation();
    // Older interrupted death transitions may have saved the hero at 0 HP.
    // Recover that save on the next update, without resetting game progress.
    if(this.player.hp<=0)this.requestPlayerRespawn();

    if (!this.input.keyboard) throw new Error('Keyboard input is unavailable.');
    for (const [action, key] of [['map', 'M'], ['inventory', 'I'], ['character', 'C'], ['pause', 'ESC'],['journal','J'],['codex','B']] as const) {
      this.input.keyboard.addKey(key).setEmitOnRepeat(false).on('down', () => {
        if(action!=='pause'&&document.activeElement?.matches('input,textarea,select,[contenteditable="true"]'))return;
        this.panelActions.add(action);
      });
    }
    for (const key of ['E', 'SPACE']) this.input.keyboard.addKey(key).on('down', () => {
      if (useGameStore.getState().dialogue) this.panelActions.add('dialogue');
    });

    this.notify('Oakmere is open to explore. Follow the eastern road and speak with Edmund beyond the farms.');
    this.registry.set('loadingStage','Waiting for first frame');
    this.game.events.on(Phaser.Core.Events.POST_RENDER,this.onFirstWorldRender,this);
    } catch (error) {
      const stage=this.registry.get('loadingStage');
      const detail=error instanceof Error?error.message:String(error);
      console.error('[startup] WorldScene construction failed at',stage,error);
      // A failed scene construction can be swallowed by the engine's lifecycle.
      // Publish the failure to React, where the stored-save export stays usable.
      this.registry.set('assetError',`World startup failed while ${String(stage??'preparing the world')}: ${detail}. Your save remains available for export.`);
      setSaveSnapshotProvider();
      this.scene.pause(); // Never update a partially constructed gameplay scene.
    }
  }

  private onFirstWorldRender(){
      // Do not consume readiness on an inactive frame, or announce a world
      // whose game has already been scheduled for disposal by React/retry.
      if(this.shuttingDown||isGameDisposing(this.game)||!this.sys.isActive())return;
      this.game.events.off(Phaser.Core.Events.POST_RENDER,this.onFirstWorldRender,this);
      this.registry.set('worldReady',true);
      // Optional sound effects must not prevent the first playable frame.
      // All combat callers already skip sounds absent from the audio cache.
      // Decode them AFTER the world is playable, with limited concurrency
      // to protect cold Android WebView startups.
      this.time.delayedCall(900,()=>{
        if(!this.sys.isActive())return;
        this.load.maxParallelDownloads=2;
        this.load.on('loaderror',(file:Phaser.Loader.File)=>{
          if(file.type==='audio')console.warn('[audio] Optional effect unavailable:',file.key);
        });
        for(const [key,path] of BOOT_OPTIONAL_AUDIO_ASSETS)
          if(!this.cache.audio.exists(key))this.load.audio(key,path);
        this.load.start();
      });
  }

  update(time: number, delta: number) {
    if(this.pendingRespawn){
      const death=this.pendingRespawn;this.pendingRespawn=null;
      this.respawnPlayer(death);
      return; // No combat or movement runs during the transition frame.
    }
    const feedbackState=useGameStore.getState();
    this.weather.setMusicOverride(this.activeInteriorId===TOWER_ENTRY_ID?TOWER_MUSIC:null);
    const feedbackBlocked=!this.focused||Boolean(feedbackState.panel||feedbackState.dialogue||feedbackState.cinematic||feedbackState.pendingCinematic||this.passage?.active||this.cinematicDirector?.active);
    this.levelUpFeedback?.update(delta,feedbackBlocked);
    this.roadLife?.update(delta,feedbackBlocked||this.inInterior||this.storyCombatActive);
    this.aliceCompanion?.update(time,delta,feedbackBlocked||Boolean(this.storyEncounters?.active));
    this.handlePanelHotkeys();
    if(this.cinematicDirector.active){this.updateCinematicPresentation(time,delta);return;}
    const travelStore=useGameStore.getState();
    if(this.interiors?.active){
      this.weather.updateInteriorAudio(delta,!this.focused||Boolean(travelStore.panel||travelStore.dialogue));
      this.enemySounds.pause(!this.focused||Boolean(travelStore.panel||travelStore.dialogue)||!this.storyCombatActive);
      if(travelStore.travelRequest||travelStore.passageRequest){
        travelStore.hydrate({travelRequest:null,passageRequest:null});this.notify('Leave the building before travelling.');
      }
      if(this.interiors.ready&&this.focused&&!travelStore.panel&&!travelStore.dialogue&&!this.cinematicDirector.active&&travelStore.pendingCinematic){
        if(!this.cinematicDirector.start(travelStore.pendingCinematic))travelStore.hydrate({pendingCinematic:travelStore.cinematicQueue[0]??null,cinematicQueue:travelStore.cinematicQueue.slice(1)});
      }
      if(this.cinematicDirector.active){this.updateCinematicPresentation(time,delta);return;}
      this.interiors.update(time,delta,!this.focused||Boolean(travelStore.panel||travelStore.dialogue));
      return;
    }
    this.enemySounds.pause(!this.focused||Boolean(travelStore.panel||travelStore.dialogue||travelStore.cinematic||this.passage.active));
    if(travelStore.passageRequest){const from=travelStore.harborPortId,to=travelStore.passageRequest;travelStore.hydrate({passageRequest:null});if(from)this.passage.begin(from,to);}
    this.volcanicTremor.update(delta,this.worldGenerator.getRegionAt(this.player.x,this.player.y)==='darkav',
      !this.focused||Boolean(travelStore.panel||travelStore.dialogue||travelStore.cinematic||this.passage.active||this.cinematicDirector.active),
      this.onVolcanicRumble,this.onVolcanicSilence,!travelStore.weatherAudio);
    if(this.passage.active){
      this.spearProjectiles.clear();
      this.wildlife.reset();
      const paused=!this.focused||Boolean(travelStore.panel);this.physics.world.pause();this.player.discardActions();
      this.dayNight.setFirefliesEnabled(false);
      this.passage.update(paused?0:delta);this.weather.update(paused?0:delta,this.cameras.main.midPoint.x,this.cameras.main.midPoint.y,paused);
      this.dayNight.update(paused?0:delta,this.cameras.main.midPoint.x,this.cameras.main.midPoint.y);
      this.waterSurface.update(paused?0:delta);this.traffic.update(paused?0:delta);this.groundShadows.update(paused?0:delta,this.dayNight.getHour(),this.weather.cloudCover,this.weather.windStrength);return;
    }
    const story=useGameStore.getState();
    if(this.focused&&!story.panel&&!story.dialogue) {
      const pending=story.pendingCinematic;
      if(pending){if(!this.cinematicDirector.start(pending))story.hydrate({pendingCinematic:story.cinematicQueue[0]??null,cinematicQueue:story.cinematicQueue.slice(1)});else return;}
      if(this.worldGenerator.getTownAt(this.player.x,this.player.y)?.id==='highmere'
        && !story.storyFlags['scene:highmere-arrival'] && this.cinematicDirector.start('highmere-arrival'))return;
    }
    this.storyEncounters.update(time,delta,!this.focused||Boolean(story.panel||story.dialogue));
    if(this.cinematicDirector.active){this.updateCinematicPresentation(time,delta);return;}
    if(this.storyCombatActive&&(story.travelRequest||story.passageRequest)){
      story.hydrate({travelRequest:null,passageRequest:null});this.notify('Leave the encounter area before travelling.');
    }
    this.handleShrineTravel();
    const uiBlocked = !this.focused || Boolean(useGameStore.getState().panel || useGameStore.getState().dialogue);
    if (uiBlocked && !this.wasBlocked) this.player.resetInput();
    this.wasBlocked = uiBlocked;
    if (uiBlocked) this.physics.world.pause();
    else this.physics.world.resume();

    if (!uiBlocked) {
      this.activePlayMs+=Math.min(delta,250);
      this.targeting.update();
      this.player.updatePlayer(time, delta);
      if(this.interiors.active)return;
      const store=useGameStore.getState();
      if(objectiveIsCurrent(store.quests,'escort','tovin-reed')) {
        const witness=this.npcs.find(n=>n.definition.id==='tovin-reed');
        if(witness&&!witness.escorting)witness.beginEscort(this.escortArrival());
      }
      for (const npc of this.npcs) if (npc.active) npc.updatePatrol(time,delta);
      for (const enemy of this.enemies) {
        if (enemy.active) enemy.updateEnemy(time,delta);
      }
      this.spearProjectiles.update(delta);
      const body=this.player.body as Phaser.Physics.Arcade.Body;
      let threatened=false;
      for(const enemy of this.enemies){
        if(enemy.active&&enemy.hp>0&&Phaser.Math.Distance.Between(enemy.x,enemy.y,this.player.x,this.player.y)<400){
          threatened=true;
          break;
        }
      }
      this.player.hp=this.player.recovery.update(delta,{
        hp:this.player.hp,maxHp:this.player.maxHp,inSettlement:Boolean(this.worldGenerator.getTownAt(this.player.x,this.player.y)),
        moving:body.velocity.lengthSq()>1,busy:this.player.skills.isCasting,
        threatened,
      });
      const standard=this.contentManager.getActor('watch:relief-yard');
      if(objectiveIsCurrent(store.quests,'train','relief-watch')&&standard
        && Math.hypot(this.player.x-standard.x,this.player.y-standard.y)<100&&!this.player.skills.isCasting) {
        this.reliefWatchMs+=Math.min(delta,250);
        if(this.reliefWatchMs>=12000){store.progressQuest('train','relief-watch');this.notify('The storehouse is safe. Return to Captain Isabel.');}
      }else this.reliefWatchMs=0;
    } else {
      this.player.discardActions();
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      for (const enemy of this.enemies) {
        if (enemy.active) (enemy.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      }
      for (const npc of this.npcs) if (npc.active) (npc.body as Phaser.Physics.Arcade.Body).setVelocity(0,0);
    }

    this.enforceLandCollision();
    this.chunkManager.update(this.player.x, this.player.y);
    if (this.contentManager.update(this.player.x, this.player.y,
      projectedGroundView(this.cameras.main,this.player.x,this.player.y))) {
      // A camera turn can activate dozens of actors over multiple frames.
      // Rebuilding the complete persistent world record on *each* admission
      // caused main-thread stalls and cascading store subscribers. Explicit
      // saves still call syncState() and always capture the newest state.
      if(time>=this.nextStreamingSnapshotAt){
        useGameStore.getState().setContentWorld(this.contentManager.snapshot());
        this.nextStreamingSnapshotAt=time+1000;
      }
    }
    if (!uiBlocked) this.dayNight.update(delta, this.player.x, this.player.y);
    this.weather.update(uiBlocked?0:delta,this.player.x,this.player.y,uiBlocked);
    this.treeSway.update(uiBlocked?0:delta,this.weather.windStrength);
    this.waterSurface.update(uiBlocked?0:delta);
    this.traffic.update(uiBlocked?0:delta);
    this.wildlife.update(delta,this.player,this.dayNight.getHour(),uiBlocked);
    this.flagshipArt.update(uiBlocked?0:delta);
    this.groundShadows.update(uiBlocked?0:delta,this.dayNight.getHour(),this.weather.cloudCover,this.weather.windStrength);
    this.drawQuestGuide(uiBlocked);
    for (const enemy of this.enemies) enemy.updatePresentation(this.player.x, this.player.y,uiBlocked);

    const regionId = this.worldGenerator.getRegionAt(this.player.x, this.player.y);
    this.m14Art.update(delta,regionId);
    if (!uiBlocked&&!this.storyCombatActive) this.eventDirector.update(delta, regionId, this.dayNight.getHour(), this.player.x, this.player.y);

    if (!uiBlocked) this.spawnAccumulator += Math.min(delta,250);
    if (!uiBlocked && this.spawnAccumulator >= this.nextAmbientIntervalMs) {
      this.spawnAccumulator = 0;
      const biome=this.worldGenerator.getBiomeAt(this.player.x,this.player.y);
      const hour=this.dayNight.getHour();
      const night=hour>=18||hour<6;
      const wilderness=['forest','wetland','highland','snowfield','volcanic','dryland'].includes(biome);
      // Higher wilderness activity after sunset, without per-frame terrain scans.
      this.nextAmbientIntervalMs=wilderness?(night?5900:8500):(night?7600:11000);
      if(!this.trySpawnRoadBandits())this.trySpawnAmbientEnemy(regionId);
    }

    this.hudAccumulator += delta;
    if (this.hudAccumulator > 180) {
      this.hudAccumulator = 0;
      this.dayNight.setFirefliesEnabled(['forest','meadow','wetland'].includes(this.worldGenerator.getBiomeAt(this.player.x,this.player.y)));
      const town = this.worldGenerator.getTownAt(this.player.x, this.player.y);
      if(town&&objectiveIsCurrent(useGameStore.getState().quests,'visit',town.id))useGameStore.getState().progressQuest('visit',town.id);
      useGameStore.getState().setWorldStatus(this.player.x, this.player.y, regionId, town?.id ?? null);
      useGameStore.getState().setVitals(this.player.hp, this.player.stamina);
      useGameStore.getState().setActiveSkillStatus(this.player.skills.snapshot());
      this.updateNavigation();
    }
  }

  getRegionAtPosition(x:number,y:number){return this.worldGenerator.getRegionAt(x,y);}

  getEquippedWeapon(): WeaponDefinition {
    const state=useGameStore.getState();
    return enhancedWeapon(state.weaponId,state.weaponUpgrades,state.awakenedWeapons);
  }

  performPlayerAttack(player: Player, direction: Phaser.Math.Vector2, weapon: WeaponDefinition,step:BasicAttackStep=BASIC_ATTACK_CHAIN[0]) {
    player.recovery.interrupt();
    const practice=this.contentManager.getActor('training:highmere-target');
    if(practice) {
      const offset=new Phaser.Math.Vector2(practice.x-player.x,practice.y-player.y);
      if(offset.length()<=weapon.reach+8&&direction.clone().normalize().dot(offset.normalize())>=step.coneDot
        && this.hasClearPath(player.x,player.y,practice.x,practice.y,practice)) {
        this.recordTraining('drill-sword');this.playEffect('hit',practice.x,practice.y);
      }
    }
    const facing = direction.clone().normalize();
    const progression = progressionStats(useGameStore.getState().attributes, useGameStore.getState().learnedSkills,useGameStore.getState().armorBonuses);
    let hits=0;
    for (const enemy of this.enemies) {
      if (!enemy.active||enemy.hp<=0||!enemy.canBeTargeted) continue;
      const toEnemy = new Phaser.Math.Vector2(enemy.x - player.x, enemy.y - player.y);
      const distance = toEnemy.length();
      if (distance > weapon.reach + (enemy.definition.boss ? 18 : 8)) continue;
      toEnemy.normalize();
      if (facing.dot(toEnemy) < step.coneDot) continue;
      if (!this.hasClearPath(player.x,player.y,enemy.x,enemy.y)) continue;
      const applied=enemy.takeDamage(Math.max(1,Math.round(weapon.damage * progression.damageMultiplier*playerDamageGrowth(useGameStore.getState().level)*step.damageMultiplier)), facing,
        {weaponId:weapon.id,impact:step===BASIC_ATTACK_CHAIN[2]?'heavy':'light'});
      if(applied>0)hits++;
    }
    return hits;
  }

  performSkillHit(player:Player,direction:Phaser.Math.Vector2,skill:ActiveSkillDefinition,multiplier:number,weaponId=this.getEquippedWeapon().id) {
    player.recovery.interrupt();
    this.recordTraining(skill.id);
    const progression = progressionStats(useGameStore.getState().attributes,useGameStore.getState().learnedSkills,useGameStore.getState().armorBonuses);
    const inventory=useGameStore.getState(),weapon=enhancedWeapon(weaponId,inventory.weaponUpgrades,inventory.awakenedWeapons);
    const damage = Math.max(1,Math.round(weapon.damage * progression.damageMultiplier * progression.skillDamageMultiplier*playerDamageGrowth(useGameStore.getState().level) * multiplier));
    for (const enemy of this.skillTargets(player,direction,skill)){
      const outward=new Phaser.Math.Vector2(enemy.x-player.x,enemy.y-player.y);
      if(outward.lengthSq()>0)outward.normalize();else outward.copy(direction);
      enemy.takeDamage(damage,outward,{forceStagger:skill.id==='crescent-flurry',weaponId:weapon.id,procHitWeight:Math.min(1,multiplier),
        impact:skill.id==='skyfall-slam'?'slam':skill.id==='iron-tempest'?'heavy':'light'});
    }
  }

  skillTargets(player:Player,direction:Phaser.Math.Vector2,skill:ActiveSkillDefinition):Enemy[]{
    const targets:Enemy[]=[];
    for (const enemy of this.enemies) {
      if (!enemy.active || enemy.hp <= 0 || !enemy.canBeTargeted) continue;
      const offset = new Phaser.Math.Vector2(enemy.x - player.x,enemy.y - player.y);
      if (offset.length() > skill.radius + (enemy.definition.boss ? 18 : 8)) continue;
      const outward = offset.lengthSq() > 0 ? offset.normalize() : direction.clone();
      // A -1 cone is a full circle: skip the facing check entirely so rear
      // targets are included even if normalization introduces rounding error.
      if (skill.coneDot > -1 && direction.dot(outward) < skill.coneDot) continue;
      if (!this.hasClearPath(player.x,player.y,enemy.x,enemy.y)) continue;
      targets.push(enemy);
    }
    return targets;
  }

  playAudio(key:string,volume=.3,rate=1) {
    if(!useGameStore.getState().weatherAudio||this.sound.locked||!this.cache.audio.exists(key))return;
    this.sound.play(key,{volume,rate});
  }

  fireOrcSpear(source:Enemy,target:Vec2,npc:Npc|null=null){
    const state=useGameStore.getState();
    if(this.passage?.active||this.cinematicDirector?.active||!this.focused||state.panel||state.dialogue||state.cinematic)return false;
    return this.spearProjectiles.fire(source,target,npc);
  }
  forgetOrcSpears(instanceId:string){this.spearProjectiles?.forgetSource(instanceId);}

  playEnemyAudio(key:string,volume:number,rate:number,pan:number){
    if(!useGameStore.getState().weatherAudio||this.sound.locked||!this.cache.audio.exists(key))return;
    this.sound.play(key,{volume,rate,pan});
  }

  playEnemySoundAt(key:string,x:number,y:number,volume:number,rate=1){
    const distance=Math.hypot(this.player.x-x,this.player.y-y),audibleRadius=1500;
    if(distance>=audibleRadius)return;
    const camera=this.cameras.main,halfWidth=camera.width/(camera.zoom*2);
    const attenuation=Math.pow(1-distance/audibleRadius,1.35);
    const pan=Phaser.Math.Clamp((x-camera.midPoint.x)/Math.max(1,halfWidth),-1,1);
    this.playEnemyAudio(key,volume*attenuation,rate,pan);
  }

  playEnemyAttackFoley(definition:EnemyDefinition,x:number,y:number,phase:'windup'|'impact'){
    if(phase==='windup'&&definition.combatStyle==='boatswain')this.playEnemySoundAt('sfx-sword-whoosh',x,y,.22,.75);
    if(phase==='windup'&&(definition.id==='road-bandit'||definition.id==='cutlass-pirate'||definition.id==='hedge-goblin'||definition.id==='bandit-captain'||definition.id==='salt-king'||definition.id==='redmesa-chieftain'))
      this.playAudio('sfx-sword-whoosh',.2,Phaser.Math.FloatBetween(.9,1.08));
    if(phase==='impact'&&Math.hypot(this.player.x-x,this.player.y-y)<360)
      this.playAudio(definition.combatStyle==='troll'||definition.combatStyle==='dragon'||definition.combatStyle==='boatswain'||definition.id==='rootfather'
        ?'sfx-impact-heavy-1':'sfx-impact-2',.24,Phaser.Math.FloatBetween(.94,1.06));
  }

  playSwordSwing(step:BasicAttackStep=BASIC_ATTACK_CHAIN[0]) {
    const pitch=step===BASIC_ATTACK_CHAIN[2] ? .76 : step===BASIC_ATTACK_CHAIN[1] ? 1.12 : 1;
    this.playAudio('sfx-sword-slash',.86,Phaser.Math.FloatBetween(.9,1.08)*pitch);
  }

  playSkillSound(skillId:ActiveSkillDefinition['id'], phase:'cast'|'impact'|'swing') {
    if (skillId === 'azure-cleave') {
      const cast = phase === 'cast';
      this.playAudio(cast ? 'sfx-sword-slash' : 'sfx-energy-impact', cast ? .88 : .82, cast ? .78 : 1);
    } else if (skillId === 'skyfall-slam') {
      const cast = phase === 'cast';
      if(cast)this.playAudio('sfx-sword-slash',.9,.72);
      else this.playAudio('sfx-heavy-slam',1,.82);
    } else if (skillId === 'crown-rally' && phase === 'cast') {
      this.playAudio('sfx-heal-bell', .28, .9);
    } else if (skillId === 'crescent-flurry') {
      if(phase==='swing'){
        this.playAudio('sfx-sword-slash',.72,Phaser.Math.FloatBetween(1.04,1.24));
      }else if(phase==='cast'){
        this.playAudio('sfx-sword-slash',.76,1.08);
      }else this.playAudio('sfx-energy-impact',.7,Phaser.Math.FloatBetween(1.02,1.18));
    }
  }

  playFootstep(x:number,y:number,sprinting:boolean) {
    const surface=this.worldGenerator.getFootstepSurface(x,y);
    const variation=Phaser.Math.Between(1,3);
    this.playAudio(`sfx-footstep-${surface}-${variation}`,sprinting ? .56 : .42);
  }

  confirmedPlayerImpact(impact:'light'|'heavy'|'slam'){
    this.playCombatImpact(impact==='light'?.42:.5,impact);
    if(impact!=='light')this.shakeCombatCamera(impact==='slam'?100:85,impact==='slam'?.002:.0014);
  }
  shakeCombatCamera(duration=85,intensity=.0014){
    if(this.time.now<this.nextCombatShakeAt||!getGraphicEffects().combatShake||this.combatReducedMotion.matches
      ||this.cameras.main.shakeEffect.isRunning)return;
    this.nextCombatShakeAt=this.time.now+300;
    // Never restart/stack an active shake or interfere with volcanic rumble.
    this.cameras.main.shake(duration,intensity,false);
  }
  tryImpactKnockback(enemy:Enemy,direction:Vec2,distance:number){
    const now=this.time.now;
    if(now>=this.knockbackBudgetUntil){this.knockbackBudgetUntil=now+120;this.knockbackBudget=3;}
    if(this.knockbackBudget<=0||enemy.definition.boss)return false;
    this.knockbackBudget--;
    const length=Math.hypot(direction.x,direction.y);if(!Number.isFinite(length)||length<.001)return false;
    const next={x:enemy.x+direction.x/length*distance,y:enemy.y+direction.y/length*distance};
    const radius=enemy.definition.bodyRadius??11;
    if((next.x-this.player.x)**2+(next.y-this.player.y)**2<(radius+12)**2)return false;
    if(!this.canEnemyOccupy(next.x,next.y,enemy)
      ||!(this.inInterior?this.interiors.combatPath(enemy,next,radius):this.canTraverseGround(enemy,next))
      ||!this.inInterior&&this.npcPathBlocker(enemy,next))return false;
    for(const other of this.getCombatEnemies())if(other!==enemy&&other.active&&other.hp>0
      &&(other.x-next.x)**2+(other.y-next.y)**2<(radius+(other.definition.bodyRadius??11))**2)return false;
    (enemy.body as Phaser.Physics.Arcade.Body).reset(next.x,next.y);
    return true;
  }
  private playCombatImpact(volume:number,impact:'light'|'heavy'|'slam'='light') {
    if(this.time.now<this.nextImpactSoundAt)return;
    this.nextImpactSoundAt=this.time.now+(impact==='light'?110:220);
    this.playAudio('sfx-sword-flesh-impact',Math.min(1,volume*2.1),impact==='light'?.96:.86);
    if(impact!=='light'){
      const key=impact==='slam'?'sfx-heavy-slam':`sfx-impact-heavy-${this.impactVariation++%2+1}`;
      this.playAudio(key,impact==='slam'?.65:.5,impact==='slam'?.82:.9);
    }
  }

  // LEIGHNERON_ELARION_SHRINE_APPROACH_V1
  // The elven shrine uses a taller, wider sprite than common wayfarer shrines.
  // The visible door is above the actor's ground anchor. Resolve a reachable
  // forecourt target once and reuse it for the prompt and actual interaction.
  private nearbyElarionShrine(x:number,y:number):
    {definition:InteractableContentDefinition;actor:ContentActor}|undefined {
    const shrine=TOWN_SHRINE_BY_ID.elarion;
    const entry=this.interactables.get(shrine.contentId);
    if(!entry || !entry.actor.active || entry.definition.townShrineId!=='elarion')return;
    const front={x:entry.actor.x,y:entry.actor.y+64};
    if(Phaser.Math.Distance.Between(x,y,front.x,front.y)>116)return;
    // Exclude the shrine's own foundation. Also accept the base sight line
    // already used by older saves/layouts, without walking through walls.
    if(!this.hasClearPath(x,y,front.x,front.y,entry.actor)
       && !this.hasClearPath(x,y,entry.actor.x,entry.actor.y,entry.actor))return;
    return entry;
  }

  tryInteract(x: number, y: number) {
    if (useGameStore.getState().panel || useGameStore.getState().dialogue) return;
    if(this.interiors.active){this.interiors.interact();return;}
    if(this.interactWithStory())return;
    const building=this.interiors.nearest(x,y);
    if(building){this.interiors.enter(building);return;}
    const elarionShrine=this.nearbyElarionShrine(x,y);
    if(elarionShrine){this.useInteractable(elarionShrine.definition,elarionShrine.actor);return;}
    let nearest: Npc | null = null;
    let nearestDistance = 72;
    for (const npc of this.npcs) {
      if(npc.adventureCompanion)continue;
      const distance = Phaser.Math.Distance.Between(x, y, npc.x, npc.y);
      if (distance < nearestDistance && this.hasClearPath(x, y, npc.x, npc.y)) {
        nearest = npc;
        nearestDistance = distance;
      }
    }
    if (nearest) {
      if(nearest.definition.id.startsWith('road-life:'))this.notify(nearest.definition.title+' · Keep your eyes on the road.');
      else useGameStore.getState().startDialogue(nearest.definition.id);
      return;
    }
    let target: { definition: InteractableContentDefinition; actor: ContentActor } | undefined;
    for (const entry of this.interactables.values()) {
      const point=entry.definition.portId?PORT_BY_ID[entry.definition.portId].landing:entry.actor;
      const distance = Phaser.Math.Distance.Between(x, y, point.x, point.y);
      if (distance < nearestDistance && this.hasClearPath(x, y, point.x, point.y, entry.actor)) {
        nearestDistance = distance; target = entry;
      }
    }
    if (target) { this.useInteractable(target.definition, target.actor); return; }
    if(this.talkToCompanion())return;
    this.notify('Nothing nearby needs your attention.');
  }

  /** Only the small authored boss roster is consulted, never world scenery.
   * No reservations for distant bosses or bosses awaiting their return timer. */
  private encounterCapacity(source: EncounterAdmission, densityCap = MAX_LIVE_HOSTILES) {
    if (source === 'boss' || this.enemies.size >= MAX_LIVE_HOSTILES)
      return hostileCapacity(this.enemies.size, source, 0, 0);
    let pendingBosses = 0, summonReserve = 0;
    const cx = Math.floor(this.player.x / CHUNK_SIZE), cy = Math.floor(this.player.y / CHUNK_SIZE);
    const cinematicView=this.cinematicDirector?.active?groundWorldView(this):undefined;
    for (const boss of authoredBosses) {
      if (boss.kind !== 'creature') continue;
      const actor = this.contentManager.getActor(boss.id) as Enemy | undefined;
      const state = this.contentManager.getState(boss.id);
      const position = actor ?? state ?? boss.world;
      const nearby=cinematicView?position.x>=cinematicView.left-768&&position.x<=cinematicView.right+768
        &&position.y>=cinematicView.top-768&&position.y<=cinematicView.bottom+768
        :Math.abs(Math.floor(position.x/CHUNK_SIZE)-cx)<=STREAM_RADIUS&&Math.abs(Math.floor(position.y/CHUNK_SIZE)-cy)<=STREAM_RADIUS;
      if (!nearby || (actor ? !actor.isAlive : state?.defeated)) continue;
      if (!actor) pendingBosses++;
      const definition = ENEMY_BY_ID[boss.enemyId];
      if (!this.contentManager.hasUnfinishedSummons(boss.id))
        summonReserve += definition?.summonComposition?.reduce((sum,m)=>sum+m.count,0)??0;
    }
    const queued = source === 'spawn' || source === 'summon'
      ? this.contentManager.getPendingCreatureCount(this.player.x, this.player.y) : 0;
    return hostileCapacity(this.enemies.size, source, pendingBosses, summonReserve, queued, densityCap);
  }

  private habitatAt(x: number, y: number): CreatureHabitat {
    return { region: this.worldGenerator.getRegionAt(x,y), biome: this.worldGenerator.getBiomeAt(x,y),
      terrain: this.worldGenerator.getTerrainAt(x,y) };
  }

  /** Dedicated boss admission: never pass through ambient pack expansion. */
  tryBossSummonWave(boss:Enemy) {
    const composition=boss.definition.summonComposition;
    if(!composition?.length||!boss.active||boss.hp<=0||!this.enemies.has(boss)
      ||!this.player.active||this.player.hp<=0||!this.isEnemyTerritory(this.player.x,this.player.y)
      ||Math.hypot(boss.x-this.player.x,boss.y-this.player.y)>boss.definition.aggroRange)return;
    const now=Date.now();
    if(!this.contentManager.bossWaveReady(boss.instanceId,now))return;
    const count=composition.reduce((sum,m)=>sum+m.count,0);
    const capacity=Math.min(this.encounterCapacity('summon'),MAX_PERSISTENT_SPAWNS-this.contentManager.getSpawnCount());
    if(count>capacity)return;
    let ready=true;
    for(const member of composition)if(!this.m14Art.ensure(member.enemyId))ready=false;
    if(!ready)return;
    const ship=boss.instanceId==='boss:salt-king';
    const toward=Math.atan2(this.player.y-boss.y,this.player.x-boss.x);
    const members:EncounterSpawnMember[]=[];
    for(const part of composition)for(let i=0;i<part.count;i++){
      const enemy=ENEMY_BY_ID[part.enemyId],radius=enemy.bodyRadius??11;
      let point:Vec2|undefined;
      const bearing=toward+(part.role==='ranged'?Math.PI:members.length*Math.PI*2/count);
      for(let attempt=0;attempt<24;attempt++){
        const angle=bearing+(attempt%8)*Math.PI/4,distance=110+Math.floor(attempt/8)*50;
        const p={x:boss.x+Math.cos(angle)*distance,y:boss.y+Math.sin(angle)*distance};
        if(members.length&&Math.hypot(p.x-members[0].world.x,p.y-members[0].world.y)>(ship?1400:900)*.4)continue;
        if(Math.hypot(p.x-this.player.x,p.y-this.player.y)<Math.max(70,radius+30)
          ||inDragonArena(p.x,p.y,240)||!this.canEnemyOccupy(p.x,p.y)
          ||!this.hasClearPath(boss.x,boss.y,p.x,p.y)
          ||(ship?!onFlagshipDeck(p.x,p.y)||!flagshipWalkable(p.x,p.y,radius)
            :onFlagshipBoarding(p.x,p.y)||!creatureFitsHabitat(enemy,this.habitatAt(p.x,p.y),true)))continue;
        if([0,1,2,3].some(side=>!this.canEnemyOccupy(p.x+Math.cos(side*Math.PI/2)*radius,p.y+Math.sin(side*Math.PI/2)*radius)))continue;
        if(members.some(m=>Math.hypot(p.x-m.world.x,p.y-m.world.y)<Math.max(40,radius+(ENEMY_BY_ID[m.enemyId].bodyRadius??11)+8)))continue;
        let blocked=false;
        for(const other of this.enemies)if(other.active&&other.hp>0
          &&Math.hypot(p.x-other.x,p.y-other.y)<Math.max(40,radius+(other.definition.bodyRadius??11)+8)){blocked=true;break;}
        if(!blocked){point=p;break;}
      }
      if(!point)return;
      members.push({enemyId:part.enemyId,world:point,role:part.role});
    }
    if(!this.contentManager.addEncounter(members,true,capacity,{bossOwner:boss.instanceId,leashRadius:ship?1400:900}))return;
    this.contentManager.update(this.player.x,this.player.y);
    useGameStore.getState().setContentWorld(this.contentManager.snapshot());
    for(const member of members)this.playEffect('teleport',member.world.x,member.world.y);
    this.notify(`${BOSSES.find(b=>`boss:${b.id}`===boss.instanceId)?.name??boss.definition.name} calls reinforcements!`);
  }

  spawnEnemy(enemyId: string, x: number, y: number, eventSpawn = false, summoner?: Enemy, encounterCap?: number) {
    if(this.storyCombatActive)return false;
    // Legacy callers cannot bypass the wave ledger or request partial minions.
    if(summoner){
      const sequence=this.contentManager.getNextSpawnSequence();
      this.tryBossSummonWave(summoner);
      return this.contentManager.getNextSpawnSequence()!==sequence;
    }
    // Region-aware gateway also covers legacy event callers and road ambushes.
    if(enemyId==='road-bandit'&&this.worldGenerator.getRegionAt(x,y)==='portquill')enemyId='cutlass-pirate';
    // A non-event spearman request still means a full 2+1 patrol, never a
    // lone ranged actor outside the ambient admission pipeline.
    if(enemyId==='rindass-orc-spearman'&&!eventSpawn)enemyId='rindass-orc-raider';
    if(enemyId==='goblin-stone-slinger')enemyId='hedge-goblin';
    const definition = ENEMY_BY_ID[enemyId];
    if (!definition || definition.boss) return false;
    if(!this.m14Art.ensure(enemyId)||enemyId==='hedge-goblin'&&!this.m14Art.ensure('goblin-stone-slinger'))return false;
    for (const enemy of this.enemies)
      if (enemy.active && enemy.hp > 0 && Math.hypot(enemy.x-this.player.x,enemy.y-this.player.y)<250) return false;
    const capacity = Math.min(this.encounterCapacity('spawn', encounterCap),
      MAX_PERSISTENT_SPAWNS - this.contentManager.getSpawnCount());
    const validPoint = (px: number, py: number,candidateDefinition:EnemyDefinition=definition) => !inDragonArena(px,py,240) && this.canEnemyOccupy(px,py)
      &&!onFlagshipBoarding(px,py)
      && creatureFitsHabitat(candidateDefinition, this.habitatAt(px,py))
      &&this.m14LocationAllowed(candidateDefinition.id,px,py)
      && Math.hypot(px-this.player.x,py-this.player.y)>=250;
    if (capacity < 1 || !validPoint(x,y)) return false;
    if(enemyId==='rindass-orc-raider'&&!eventSpawn){
      if(capacity<3)return false;
      const toward=Math.atan2(this.player.y-y,this.player.x-x),sideX=-Math.sin(toward),sideY=Math.cos(toward);
      const points=[
        {enemyId:'rindass-orc-raider',world:{x:x+Math.cos(toward)*38+sideX*30,y:y+Math.sin(toward)*38+sideY*30},role:'leader' as const},
        {enemyId:'rindass-orc-raider',world:{x:x+Math.cos(toward)*38-sideX*30,y:y+Math.sin(toward)*38-sideY*30},role:'melee' as const},
        {enemyId:'rindass-orc-spearman',world:{x:x-Math.cos(toward)*82,y:y-Math.sin(toward)*82},role:'ranged' as const},
      ];
      if(points.some(member=>!validPoint(member.world.x,member.world.y,ENEMY_BY_ID[member.enemyId])))return false;
      if(!this.contentManager.addEncounter(points,false,capacity,{leashRadius:900}))return false;
      this.contentManager.update(this.player.x,this.player.y);
      useGameStore.getState().setContentWorld(this.contentManager.snapshot());
      return true;
    }
    if(enemyId==='hedge-goblin'){
      if(capacity<3)return false;
      const rng=seededRandom('goblin-pack:'+this.contentManager.getNextSpawnSequence());
      const goal=3,points:Vec2[]=[{x,y}];
      for(let tries=0;tries<32&&points.length<goal;tries++){
        const angle=rng()*Math.PI*2,distance=48+rng()*70;
        const p={x:x+Math.cos(angle)*distance,y:y+Math.sin(angle)*distance};
        if(validPoint(p.x,p.y)&&points.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>=40))points.push(p);
      }
      const members=points.map((world,slot)=>({enemyId:slot===2?'goblin-stone-slinger':enemyId,world,
        role:slot===2?'ranged' as const:slot===0?'leader' as const:'melee' as const}));
      if(points.length!==goal||members.some(m=>!validPoint(m.world.x,m.world.y,ENEMY_BY_ID[m.enemyId]))
        ||!this.contentManager.addEncounter(members,eventSpawn,capacity,{leashRadius:700}))return false;
    }else if(enemyId==='blighted-thornling'||enemyId==='grove-spider'){
      if(capacity<2)return false;
      const rng=seededRandom(`grove-pack:${enemyId}:${this.contentManager.getNextSpawnSequence()}`);
      const hour=this.dayNight.getHour(),night=hour<6||hour>=18;
      const goal=Math.min(capacity,enemyId==='grove-spider'?(night?3:2)+Math.floor(rng()*2):2+Math.floor(rng()*3)),points:Vec2[]=[{x,y}];
      for(let tries=0;tries<40&&points.length<goal;tries++){
        const angle=rng()*Math.PI*2,radius=55+rng()*100;
        const p={x:x+Math.cos(angle)*radius,y:y+Math.sin(angle)*radius};
        if(validPoint(p.x,p.y)&&points.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>=46))points.push(p);
      }
      if(points.length!==goal||!this.contentManager.addEncounter(points.map((world,slot)=>({enemyId,world,
        role:slot===0?'leader' as const:'melee' as const})),eventSpawn,capacity,{leashRadius:700}))return false;
    }else if(isWolfFamily(enemyId)) {
      // A wolf encounter is always an entire 4–6-member hunting pack.
      if(capacity<4)return false;
      const seed=this.contentManager.getNextSpawnSequence();
      const rng=seededRandom(`wolf-pack:${seed}:${Math.floor(x)}:${Math.floor(y)}`);
      const goal=Math.min(capacity,4+Math.floor(rng()*3));
      const points:Vec2[]=[{x,y}];
      for(let tries=0;tries<72&&points.length<goal;tries++){
        const angle=rng()*Math.PI*2,dist=44+rng()*116;
        const candidate={x:x+Math.cos(angle)*dist,y:y+Math.sin(angle)*dist};
        if(!validPoint(candidate.x,candidate.y)
          ||points.some(p=>Math.hypot(p.x-candidate.x,p.y-candidate.y)<35))continue;
        points.push(candidate);
      }
      if(points.length<goal)return false; // Admit the planned pack, or none of it.
      if(!this.contentManager.addEncounter(points.map(world=>({enemyId,world})),eventSpawn,capacity,{wolfPack:true}))return false;
    }else if(enemyId==='cutlass-pirate'||enemyId==='pirate-boatswain'){
      const goal=3;if(capacity<goal)return false;
      const rng=seededRandom('pirate-crew:'+this.contentManager.getNextSpawnSequence()),points:Vec2[]=[{x,y}];
      for(let tries=0;tries<32&&points.length<goal;tries++){
        const angle=rng()*Math.PI*2,distance=48+rng()*70;
        const p={x:x+Math.cos(angle)*distance,y:y+Math.sin(angle)*distance};
        if(validPoint(p.x,p.y)&&points.every(other=>Math.hypot(other.x-p.x,other.y-p.y)>=40))points.push(p);
      }
      const members=points.map((world,slot)=>{
        const heavy=slot===2;
        return {enemyId:heavy?'pirate-boatswain':'cutlass-pirate',world,
          role:(heavy?'heavy':slot===0?'leader':'melee') as 'heavy'|'leader'|'melee'};
      });
      if(points.length!==goal||members.some(member=>!validPoint(member.world.x,member.world.y,ENEMY_BY_ID[member.enemyId]))
        ||!this.contentManager.addEncounter(members,eventSpawn,capacity,
          {leashRadius:900}))return false;
    }else this.contentManager.addSpawn(enemyId,{x,y},eventSpawn);
    this.contentManager.update(this.player.x,this.player.y);
    useGameStore.getState().setContentWorld(this.contentManager.snapshot());
    return true;
  }

  encounterDecision(enemy:Enemy,time:number,spotted:boolean,targetAllowed:boolean) {
    if (!enemy.encounterKey || !enemy.encounterBehavior) return 'idle' as const;
    const owner=this.contentManager.getSummonOwner(enemy.instanceId);
    if(owner){
      const boss=this.contentManager.getActor(owner) as Enemy|undefined;
      if(!boss?.active||!boss.isAlive||this.player.hp<=0
        ||Math.hypot(boss.x-this.player.x,boss.y-this.player.y)>boss.definition.aggroRange)return 'return' as const;
      spotted=true;
    }
    return this.encounters.decide(enemy.encounterKey,enemy.instanceId,enemy.encounterBehavior,
      enemy,this.player,time,spotted,targetAllowed);
  }
  encounterArrived(enemy:Enemy) { this.encounters.arrived(enemy.instanceId); }
  /** Live bounded actor set; steering filters locally without allocating arrays. */
  enemySteeringActors():ReadonlySet<Enemy> { return this.enemies; }
  enemyPatrolLeader(enemy:Enemy):Enemy|null {
    if(!enemy.encounterKey||!enemy.encounterBehavior||enemy.encounterBehavior.leashRadius>900)return null;
    let leader:Enemy|null=null;
    for(const member of this.enemies){
      if(!member.active||member.hp<=0||member.encounterKey!==enemy.encounterKey||!member.encounterBehavior)continue;
      if(!leader||member.encounterBehavior.slot<leader.encounterBehavior!.slot)leader=member;
    }
    return leader;
  }
  wolfPackLeader(id:string){return (this.contentManager.getWolfPackActors(id) as Enemy[])
    .find(enemy=>enemy.active&&enemy.hp>0&&enemy.wolfAlpha)??null;}

  /** Local live members in a deterministic formation order; dead/unloaded
   * wolves are excluded, so recovery saves and streamed actors remain safe. */
  wolfPackMembers(packId:string):Enemy[]{
    return (this.contentManager.getWolfPackActors(packId) as Enemy[])
      .filter(enemy=>enemy.active&&enemy.hp>0)
      .sort((a,b)=>Number(b.wolfAlpha)-Number(a.wolfAlpha)||a.instanceId.localeCompare(b.instanceId));
  }

  /** Only the surveyed inter-town roads, outside protected settlements, host ambushes. */
  private trySpawnRoadBandits():boolean{
    if(this.activePlayMs<this.nextRoadBanditsAt||this.enemies.size>=10
      ||!this.worldGenerator.isRoad(this.player.x,this.player.y,16)
      ||!this.isEnemyTerritory(this.player.x,this.player.y))return false;
    const rng=seededRandom(`road-bandits:${this.spawnAttempts++}:${Math.floor(this.player.x/400)}:${Math.floor(this.player.y/400)}`);
    if(rng()>.22)return false;
    const distance=340+rng()*165,targets:Vec2[]=[];
    // Circle/segment intersections produce actual road-centerline locations.
    // Random x/y offsets would mostly miss the long, narrow roads.
    for(const route of ROAD_ROUTES)for(let i=1;i<route.points.length;i++){
      const a=route.points[i-1],b=route.points[i],dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy;
      if(len2<1)continue;
      const t=((this.player.x-a.x)*dx+(this.player.y-a.y)*dy)/len2;
      const px=a.x+t*dx,py=a.y+t*dy,perp2=(px-this.player.x)**2+(py-this.player.y)**2;
      if(perp2>distance*distance)continue;
      const offset=Math.sqrt((distance*distance-perp2)/len2);
      for(const sign of [-1,1]){
        const u=t+sign*offset;
        if(u<0||u>1)continue;
        const x=a.x+u*dx,y=a.y+u*dy;
        if(this.canEnemyOccupy(x,y)&&!inDragonArena(x,y,240))targets.push({x,y});
      }
    }
    if(!targets.length)return false;
    for(let attempt=0;attempt<Math.min(targets.length,8);attempt++){
      const idx=Math.floor(rng()*targets.length),target=targets.splice(idx,1)[0];
      if(!this.spawnEnemy('road-bandit',target.x,target.y,true))continue;
      // Sometimes a second highwayman follows, but never a wall of bandits.
      if(this.worldGenerator.getRegionAt(target.x,target.y)!=='portquill'&&rng()<.46&&this.enemies.size<11){
        const angle=rng()*Math.PI*2,off={x:target.x+Math.cos(angle)*45,y:target.y+Math.sin(angle)*45};
        if(this.worldGenerator.isRoad(off.x,off.y)&&this.canEnemyOccupy(off.x,off.y))
          this.spawnEnemy('road-bandit',off.x,off.y,true);
      }
      this.nextRoadBanditsAt=this.activePlayMs+100_000+rng()*75_000;
      return true;
    }
    return false;
  }

  damagePlayer(amount: number) {
    if(this.cinematicDirector?.active)return;
    const state=useGameStore.getState();if(!this.focused||state.panel||state.dialogue||this.inInterior&&!this.storyCombatActive)return;
    this.storyEncounters?.interruptWork();
    this.player.takeDamage(amount);
  }

  playEffect(kind: 'fortification' | 'hit' | 'heal' | 'slash' | 'teleport', x: number, y: number, direction?: Phaser.Math.Vector2) {
    const texture = ({
      fortification:'effect_fortification', hit:'effect_hit', heal:'effect_heal',
      slash:'effect_slash', teleport:'effect_teleport',
    } as const)[kind];
    const animation = `effect-${kind}`;
    const effect = this.add.sprite(x, y, texture, 0).setOrigin(.5)
      .setScale(artScale(texture) * (kind === 'slash' || kind === 'teleport' ? 1.35 : 1))
      .setDepth(this.playerRenderDepth(y) + 1).setName(`combat-effect:${kind}`);
    if (direction) effect.setRotation(Math.atan2(direction.y, direction.x) - Math.PI / 4);
    if(kind==='hit')this.playCombatImpact(.42);
    else if(kind==='heal')this.playAudio('sfx-heal-bell',.2);
    effect.play(animation);
    effect.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => effect.destroy());
    return effect;
  }

  handleEnemyDefeated(enemy: Enemy) {
    if(enemy.isAlive)return; // A depleted first bar is not a loot/progression kill.
    if(enemy.instanceId.startsWith('dungeon-event:')){this.dungeons?.defeated(enemy);return;}
    if(this.storyEncounters?.defeated(enemy)){useGameStore.getState().discoverCreature(enemy.definition.id,undefined,true);return;}
    this.forgetOrcSpears(enemy.instanceId);
    const definition = enemy.definition;
    const rng = seededRandom(`${enemy.instanceId}:loot`);
    const gold = definition.goldMin + Math.floor(rng() * (definition.goldMax - definition.goldMin + 1));
    const bossId = enemy.instanceId.startsWith('boss:') ? enemy.instanceId.slice(5) : undefined;
    const boss=bossId?BOSS_BY_ID[bossId]:undefined;
    const summoned=Boolean(this.contentManager.getSummonOwner(enemy.instanceId))
      ||Boolean(enemy.encounterKey?.startsWith('encounter:boss-wave:'));
    if(definition.combatStyle==='dragon'&&boss?.respawns)enemy.createRetreatVisual();else enemy.createDeathVisual();
    this.contentManager.patchState(enemy.instanceId, { hp: 0, defeated: true,
      ...(boss?.respawns&&boss.respawnDelayMs?{respawnAt:Date.now()+boss.respawnDelayMs}:{}),
    });
    if(enemy.instanceId.startsWith('pirate:flagship:crew:')){
      const crew=FLAGSHIP_CONTENT.filter(d=>d.kind==='creature');
      if(crew.every(d=>this.contentManager.getState(d.id)?.defeated)){
        const respawnAt=Date.now()+20*60*1000;
        for(const member of crew)this.contentManager.patchState(member.id,{respawnAt});
        this.notify('The flagship crew is defeated. Replacements will not arrive while you remain aboard.');
      }
    }
    const state=useGameStore.getState();
    if(enemy.ambientDefeat&&!enemy.playerContributed){
      state.setContentWorld(this.contentManager.snapshot());return;
    }
    const factor=encounterRewardFactor(enemy.level,state.level,summoned);
    const rewardXp=Math.max(1,Math.round(definition.xp*factor)),rewardGold=Math.round(gold*factor);
    state.recordEnemyDefeat(definition.id,rewardXp,rewardGold,bossId,this.contentManager.snapshot(),enemy.instanceId,!summoned,this.worldGenerator.getRegionAt(enemy.x,enemy.y));
    const gained=this.add.text(enemy.x,enemy.y-48,`+${Math.round(rewardXp*progressionStats(state.attributes,state.learnedSkills,state.armorBonuses).rewardMultiplier)} XP`,{fontFamily:'Georgia,serif',fontSize:'15px',fontStyle:'bold',color:'#f8dc8c',stroke:'#23160b',strokeThickness:4}).setResolution(2).setDepth(enemy.y+900).setOrigin(.5);
    this.tweens.add({targets:gained,y:enemy.y-112,alpha:0,duration:1450,ease:'Sine.easeOut',onComplete:()=>gained.destroy()});

    if (enemy.instanceId.startsWith('boss:')) {
      useGameStore.getState().setBossEncounter(null);
      this.notify(definition.combatStyle==='dragon' ? `${definition.name} vanishes into the ash above the ridge. The sky is quiet, for now.` : `${definition.name} falls. The road is quiet, for now.`);
    }
    // Persist the retreat deadline and reward together; a streamed-away dragon
    // cannot return early, and quest completion remains separate from cooldown.
    if(boss?.respawns)saveGame();
  }

  /** Called from Player.takeDamage without changing any world actors mid-hit. */
  requestPlayerRespawn(){
    if(this.pendingRespawn||this.shuttingDown)return;
    // An interior has its own artificial coordinates; use its exterior door
    // so the nearest town is calculated from the actual death region.
    const outside=this.interiors?.safePosition??this.player;
    this.pendingRespawn={x:outside.x,y:outside.y};
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0,0);
    this.player.discardActions();
  }

  private respawnPlayer(death:Vec2){
    // This runs at the TOP of a new frame, never in an enemy windup timer,
    // an enemy set iteration, or the projectile loop that delivered the hit.
    const region=this.worldGenerator.getRegionAt(death.x,death.y);
    const town=nearestRespawnTown(death,region);
    this.cancelStoryEncounter();
    this.interiors.leaveOnDefeat();
    this.dungeons.close();
    this.spearProjectiles.clear();
    this.wildlife.reset();
    const store=useGameStore.getState();
    store.setBossEncounter(null);
    store.clearShrineTravelRequest();
    store.hydrate({passageRequest:null});

    // Stream the landing view, not the whole nine-chunk travel neighborhood
    // at once. Remaining offscreen scenery streams normally on later frames.
    const candidates=respawnArrivalCandidates(town);
    const anchor=candidates[0];
    this.cameras.main.centerOn(anchor.x,anchor.y);
    this.chunkManager.update(anchor.x,anchor.y,true);
    this.contentManager.update(anchor.x,anchor.y);
    const safe=(point:Vec2)=>this.worldGenerator.getRegionAt(point.x,point.y)===town.regionId
      &&this.worldGenerator.isWalkable(point.x,point.y)
      &&!this.isBlockedByBuilding(point.x,point.y)
      &&!this.npcs.some(npc=>npc.active&&Math.hypot(npc.x-point.x,npc.y-point.y)<48);
    const chosen=candidates.find(safe);
    if(!chosen)console.warn('[respawn] No safe town arrival:',town.id,'using Oakmere fallback');
    const landing=chosen??LEIGNERON.spawn;

    this.player.restoreAt(landing.x,landing.y);
    this.player.setVisible(true).setAlpha(1).setDepth(landing.y);
    this.player.lastDirection.set(0,1);
    this.lastSafe={...landing};
    this.cameras.main.centerOn(landing.x,landing.y).startFollow(this.player,true,1,1);
    this.chunkManager.update(landing.x,landing.y,true);
    this.contentManager.update(landing.x,landing.y);
    this.targeting.clear();
    this.refreshWorldLighting();
    this.physics.world.resume();
    this.syncState();
    this.updateNavigation();
    store.showToast(`Leigneron awakens in ${town.name} after falling in battle.`);
    saveGame();
  }
  refreshWorldLighting(){
    this.cameras.main.preRender();
    this.dayNight.invalidateView();this.dayNight.update(0,this.player.x,this.player.y);
  }

  notify(message: string) {
    useGameStore.getState().showToast(message);
  }
  landFromPassage(point:Vec2){
    this.chunkManager.update(point.x,point.y);this.contentManager.update(point.x,point.y);
    (this.player.body as Phaser.Physics.Arcade.Body).reset(point.x,point.y);this.player.setVisible(true);this.player.resetInput();this.lastSafe={...point};
    this.cameras.main.centerOn(point.x,point.y).startFollow(this.player, true, 1, 1);this.physics.world.resume();
    this.targeting.clear();this.refreshWorldLighting();this.syncState();this.updateNavigation();saveGame();
  }

  countEnemies() {
    return this.enemies.size;
  }

  isWalkable(x: number, y: number) { return this.inInterior?this.interiors.playerFeet(x,y):this.worldGenerator.isWalkable(x, y); }
  interiorDoorClear(x:number,y:number){return this.isWalkable(x,y)&&!this.isBlockedByBuilding(x,y);}
  isEnemyTerritory(x: number, y: number) { return this.worldGenerator.canCreatureOccupy(x,y)
    &&!(useGameStore.getState().storyFlags['oakmere-road-open']&&Math.hypot(x-TOWN_BY_ID.oakmere.world.x,y-TOWN_BY_ID.oakmere.world.y)<5000&&this.worldGenerator.isRoad(x,y,30))
    &&!WILDERNESS_SITES.some(s=>((s.style==='camp'&&!s.hostile)||s.id==='royal-waystone'||s.id==='greenward-ruin')&&Math.hypot(s.world.x-x,s.world.y-y)<300); }
  canEnemyOccupy(x: number, y: number,enemy?:Enemy) {
    if(enemy&&this.storyActor(enemy))return (this.dungeons?.owns(enemy)?this.dungeons.allows({x,y}):this.storyEncounters.owns(enemy)&&this.storyEncounters.allows({x,y}))
      &&(this.inInterior?this.interiors.combatFeet(x,y,enemy.definition.bodyRadius??12,undefined,true):this.worldGenerator.isWalkable(x,y)&&!this.isBlockedByBuilding(x,y));
    if(this.inInterior)return false;
    if(enemy&&isFlagshipCombatant(enemy.instanceId,enemy.encounterKey,enemy.encounterBehavior?.home)
      &&(!onFlagshipDeck(x,y)||!flagshipWalkable(x,y,enemy.definition.bodyRadius??(enemy.definition.boss?24:11))))return false;
    return this.isEnemyTerritory(x,y) && !this.isBlockedByBuilding(x,y);
  }
  enemyNavigationPoint(enemy:Enemy,target:Vec2):Vec2 {
    if(this.inInterior)return this.interiors.navigationPoint(enemy,target);
    if(!isFlagshipCombatant(enemy.instanceId,enemy.encounterKey,enemy.encounterBehavior?.home))return target;
    const cached=this.shipPaths.get(enemy);
    if(cached&&this.time.now<cached.until&&Math.hypot(cached.target.x-target.x,cached.target.y-target.y)<48
      &&Math.hypot(cached.point.x-enemy.x,cached.point.y-enemy.y)>24)return cached.point;
    const point=flagshipNavigation(enemy,target);
    this.shipPaths.set(enemy,{until:this.time.now+250,target:{...target},point});return point;
  }

  private isBlockedByBuilding(x: number, y: number) {
    if(fortificationBlocksPoint(x,y,20))return true;
    const feet={left:x-11,right:x+11,top:y-24,bottom:y+2};
    for(const body of this.physics.overlapRect(x-11.01,y-24.01,22.02,26.02,false,true)){
      if(body?.enable&&overlaps(feet,body))return true;
    }
    return false;
  }

  private isNpcObscured(x:number,y:number,regional=false) {
    const person={left:x-(regional?36:25),right:x+(regional?36:25),top:y-(regional?96:76),bottom:y+2};
    return authoredRoofs.query(person).some(roof=>roof.y>y&&overlaps(person,roof.bounds))
      ||(Math.abs(x-TOWN_BY_ID.oakmere.world.x)<1350
        &&Math.abs(y-TOWN_BY_ID.oakmere.world.y)<1350
        &&oakmereTreeCanopies.some(tree=>tree.y>y&&overlaps(person,tree.bounds)));
  }

  hasClearPath(ax: number, ay: number, bx: number, by: number, exclude?: Phaser.GameObjects.GameObject) {
    if(this.inInterior)return this.interiors.combatPath({x:ax,y:ay},{x:bx,y:by});
    if(flagshipFootprint(ax,ay)||flagshipFootprint(bx,by)){
      const steps=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/16));
      for(let i=0;i<=steps;i++)if(!this.worldGenerator.isWalkable(ax+(bx-ax)*i/steps,ay+(by-ay)*i/steps))return false;
    }
    if(fortificationBlocksPath({x:ax,y:ay},{x:bx,y:by}))return false;
    const line = new Phaser.Geom.Line(ax, ay, bx, by);
    // Use Arcade's static spatial tree, then the original exact intersection.
    const left=Math.min(ax,bx),top=Math.min(ay,by);
    const nearby=this.physics.overlapRect(left-.01,top-.01,Math.abs(bx-ax)+.02,Math.abs(by-ay)+.02,false,true);
    for(const body of nearby){
      const object=body.gameObject;
      if(object===exclude||(exclude&&object.getData(WORLD_SPRITE_OWNER)===exclude))continue;
      if(body?.enable&&this.lineIntersectsBody(line,body as Phaser.Physics.Arcade.StaticBody))return false;
    }
    return true;
  }

  private lineIntersectsBody(line:Phaser.Geom.Line,body:Phaser.Physics.Arcade.StaticBody) {
    this.pathObstacleBounds.setTo(body.x,body.y,body.width,body.height);
    return Phaser.Geom.Intersects.LineToRectangle(line,this.pathObstacleBounds);
  }

  syncState() {
    if (!this.player?.active) return;
    this.player.syncInventoryVitals();
    this.reconcileStoryAffinity();
    const position=authoritativeSavePosition(this.player,this.interiors,this.cinematicDirector?.active??false,this.passage);
    const town = this.worldGenerator.getTownAt(position.x, position.y);
    const store = useGameStore.getState();
    store.setWorldStatus(position.x, position.y, this.worldGenerator.getRegionAt(position.x, position.y), town?.id ?? null);
    store.setVitals(this.player.hp, this.player.stamina);
    store.setActiveSkillStatus(this.player.skills.snapshot());
    this.dayNight.syncState();
    if (this.contentManager) store.setContentWorld(this.contentManager.snapshot());
  }

  private reconcileStoryAffinity() {
    if(!this.contentManager)return;
    const store=useGameStore.getState();
    for(const npc of STORY_RESIDENTS){
      const rule=npc.storyReturn,id='npc:'+npc.id;
      if(!rule||store.storyFlags['relocated:'+id]||(store.quests[rule.questId]?.objectiveProgress[rule.objectiveId]??0)<1)continue;
      const saved=this.contentManager.getState(id),actor=this.contentManager.getActor(id),position=actor??saved;
      // Don't visibly teleport a rescued person. Return once their departure
      // is offscreen, preserving their logical identity, trust and quest IDs.
      if(!position||this.inInterior||Math.hypot(position.x-this.player.x,position.y-this.player.y)<1800)continue;
      const town=TOWN_BY_ID[npc.townId],p={x:town.world.x+rule.position.x,y:town.world.y+rule.position.y};
      this.contentManager.patchState(id,p);store.setStoryFlag('relocated:'+id);
    }
    const affinityState=useGameStore.getState();
    for(const [key,choiceId] of Object.entries(affinityState.storyChoices)) {
      if(useGameStore.getState().storyFlags['affinity:'+key])continue;
      const split=key.indexOf(':'),questId=key.slice(0,split),objectiveId=key.slice(split+1);
      const objective=QUEST_BY_ID[questId]?.objectives.find(o=>o.id===objectiveId);
      if(!objective || !objective.choices?.some(c=>c.id===choiceId&&c.correct!==false)
        ||(store.quests[questId]?.objectiveProgress[objectiveId]??0)<objective.amount)continue;
      const id='npc:'+objective.targetId,state=this.contentManager.getState(id);
      if(!state || !NPC_BY_ID[objective.targetId])continue;
      this.contentManager.patchState(id,{trust:Math.min(100,(state.trust??NPC_BY_ID[objective.targetId].relationshipToLeigneron.trust)+5)});
      store.setStoryFlag('affinity:'+key);
    }
  }

  private updateNavigation() {
    const store = useGameStore.getState();
    this.questTarget = resolveQuestTarget(store.quests, store.worldContent, this.player,
      id => this.contentManager.getActor(id),store.trackedQuestId,undefined,store.storyFlags);
    const markers: NavigationMarker[] = [];
    for(const home of PLAYER_HOMES)if(housingFor(store.housing,home.id).owned)markers.push({id:'player-home:'+home.id,kind:'building',service:'home',label:home.homeName,...home.door});
    markers.push(...this.dungeons.exteriorMarkers());
    for(const resident of INTERIOR_RESIDENTS){
      const p=resident.entry.door;
      if(Math.hypot(p.x-this.player.x,p.y-this.player.y)<1200)markers.push({id:'npc:'+resident.npcId,
        kind:'npc',label:`${NPC_BY_ID[resident.npcId].name} — ${resident.entry.name}`,x:p.x,y:p.y,
        ...(MAP_BLACKSMITHS.has(resident.npcId)?{service:'blacksmith' as const}:{})});
    }
    for (const id of this.contentManager.getActiveIds()) {
      const d = this.contentManager.getDefinition(id)!;
      const actor = this.contentManager.getActor(id)!;
      if(actor instanceof Enemy&&!this.targeting.eligible(actor))continue;
      if (Phaser.Math.Distance.Between(this.player.x,this.player.y,actor.x,actor.y) > 1200) continue;
      if (d.kind === 'prop') continue;
      const kind = d.kind === 'npc' ? 'npc' : d.kind === 'creature' ? d.bossId ? 'boss' : 'enemy'
        : d.kind === 'settlement-prop' ? 'building' : d.kind === 'settlement' ? 'town' : 'landmark';
      const label = d.kind === 'npc' ? NPC_BY_ID[d.npcId].name : d.kind === 'creature' ? ENEMY_BY_ID[d.enemyId].name
        : d.kind === 'settlement' ? TOWN_BY_ID[d.townId].name : 'name' in d ? d.name : 'label' in d && d.label ? d.label : 'Building';
      const inn=MAP_INNS.get(id);
      const service:NavigationMarker['service']=inn?'inn':d.kind==='npc'&&MAP_BLACKSMITHS.has(d.npcId)?'blacksmith'
        :'contractTownId' in d&&d.contractTownId?'contracts':'portId' in d&&d.portId?'harbor'
        :'townShrineId' in d&&d.townShrineId?'shrine':undefined;
      markers.push({ id, kind, label, x: inn?.door.x??actor.x, y: inn?.door.y??actor.y,...(service?{service}:{}) });
    }
    for(const enemy of this.enemies)if(this.storyActor(enemy)&&this.targeting.eligible(enemy))markers.push({
      id:enemy.instanceId,kind:'enemy',label:enemy.definition.name,x:enemy.x,y:enemy.y});
    let interaction: string | null = null, distance = 72;
    const building=this.interiors.nearest(this.player.x,this.player.y);
    if(building){const home=PLAYER_HOME_BY_ID[building.id];interaction=home?housingFor(store.housing,home.id).owned?`Enter ${home.homeName}`:`Home for sale · Speak with ${home.agentName}`:`Enter ${building.name}`;distance=0;}
    const elarionShrine=this.nearbyElarionShrine(this.player.x,this.player.y);
    if(elarionShrine){interaction=elarionShrine.definition.name;distance=0;}
    for (const npc of this.npcs) {
      npc.updatePresentation(this.player.x,this.player.y,this.questTarget?.contentId === `npc:${npc.definition.id}`,this.wasBlocked);
      // Road-life actors deliberately have no interaction handler. Don't run
      // the expensive talk line-of-sight probe or offer a nonfunctional prompt.
      if(npc.definition.id.startsWith('road-life:'))continue;
      const d = Phaser.Math.Distance.Between(this.player.x,this.player.y,npc.x,npc.y);
      if (d < distance && this.hasClearPath(this.player.x,this.player.y,npc.x,npc.y)) { distance = d; interaction = `Talk to ${npc.definition.name}`; }
    }
    if (!interaction) for (const { definition,actor } of this.interactables.values()) {
      const point=definition.portId?PORT_BY_ID[definition.portId].landing:actor;
      const d = Phaser.Math.Distance.Between(this.player.x,this.player.y,point.x,point.y);
      if (d < distance && this.hasClearPath(this.player.x,this.player.y,point.x,point.y,actor)) { distance = d; interaction = definition.name; }
    }
    const companion=this.companionActor;
    if(!interaction&&companion&&Math.hypot(companion.x-this.player.x,companion.y-this.player.y)<=180
      &&this.hasClearPath(this.player.x,this.player.y,companion.x,companion.y))interaction=`Talk to ${companion.definition.name}`;
    if(this.storyCombatActive)interaction=this.storyInteraction;
    store.setNavigation({ heading: Math.atan2(this.player.lastDirection.x,-this.player.lastDirection.y), target: this.questTarget,
      playerPosition:{x:this.player.x,y:this.player.y},markers,interaction });
  }

  private drawQuestGuide(blocked: boolean) {
    this.questGuide.clear().setVisible(!blocked);
    this.questMarker.clear().setVisible(!blocked);
    const target = this.questTarget;
    if (!target || blocked) return;
    const live = target.type==='escort'?target:this.contentManager.getActor(target.contentId) ?? target;
    const approach=live;
    const angle = questBearing(this.player,approach), dx = Math.sin(angle), dy = -Math.cos(angle);
    const approachDistance=Phaser.Math.Distance.Between(this.player.x,this.player.y,approach.x,approach.y);
    const arrived=Phaser.Math.Distance.Between(this.player.x,this.player.y,live.x,live.y)<=72
      &&this.hasClearPath(this.player.x,this.player.y,live.x,live.y,this.contentManager.getActor(target.contentId))
      &&this.worldGenerator.isWalkablePath(this.player,live);
    if (approachDistance>10&&!arrived) {
      // Keep vector surfaces local: distant objectives must not create a
      // viewport-sized raster/upload spanning the hero and the target.
      this.questGuide.setPosition(this.player.x,this.player.y);
      const x = dx * 48, y = dy * 48;
      this.questGuide.lineStyle(2,0x34210d,.85).fillStyle(0xffd976,.95);
      this.questGuide.beginPath(); this.questGuide.moveTo(x + dx * 8,y + dy * 8);
      this.questGuide.lineTo(x - dx * 5 - dy * 6,y - dy * 5 + dx * 6);
      this.questGuide.lineTo(x - dx * 5 + dy * 6,y - dy * 5 - dx * 6);
      this.questGuide.closePath(); this.questGuide.fillPath(); this.questGuide.strokePath();
    }
    const ground=groundMarkerPosition(live);
    this.questMarker.setPosition(live.x,live.y);
    this.questMarker.lineStyle(2,0xffd976,.8).strokeEllipse(ground.x-live.x,ground.y-live.y,28,10);
    this.questMarker.fillStyle(0xffdf91,.95).fillPoints([
      { x: 0, y: -116 }, { x: 5, y: -110 },
      { x: 0, y: -104 }, { x: -5, y: -110 },
    ],true);
  }

  private onBlur() { this.focused = false; this.panelActions.clear(); this.player?.resetInput();this.volcanicTremor?.pause();this.wildlife?.reset(); }
  private onFocus() { this.focused = true; this.player?.resetInput(); }

  private createContentActor(definition: ContentDefinition, state: ContentState): ContentActor {
    const { x, y } = definition.kind==='interactable'&&definition.portId
      ?PORT_BY_ID[definition.portId].quay:state;
    if (definition.kind === 'npc') {
      const npcDefinition = NPC_BY_ID[definition.npcId];
      // Repair older keeper positions behind the shrine roof. Keep trust and
      // dialogue progress; only move the actor into its redesigned forecourt.
      const obscuredKeeper = ['orin-bell','maren-voss'].includes(definition.npcId)
        && Math.hypot(x - definition.world.x,y - definition.world.y) > (npcDefinition.patrolRadius ?? 110) + 18;
      const phase=npcDefinition.formation?formationPosition(this.activePlayMs,npcDefinition.formation.rank):null;
      const town=TOWN_BY_ID[npcDefinition.townId];
      const returned=definition.npcId==='tovin-reed'&&(useGameStore.getState().quests['shadows-highmere']?.objectiveProgress.escort??0)>=1;
      const storyReturned=useGameStore.getState().storyFlags['relocated:'+definition.id];
      const position = storyReturned?{x,y}:returned?this.escortArrival()
        :!npcMayPatrol(npcDefinition)&&definition.npcId!=='tovin-reed'?definition.world
        :phase&&this.getWorldHour()>=6&&this.getWorldHour()<20?{x:town.world.x+phase.x,y:town.world.y+phase.y}
        : obscuredKeeper || this.isNpcObscured(x,y) || this.isBlockedByBuilding(x,y) ? definition.world : { x,y };
      // Validate every town against loaded GPU-derived scenery and neighbors.
      // Fixed residents use audited courts, rather than stale saved positions.
      let npcPosition=position;
      const admitted=this.regionalNpcSlots.get(definition.id);
      if(admitted){npcPosition=admitted;this.regionalNpcSlots.delete(definition.id);}
      else if(!this.npcCanStandAt(position.x,position.y)){
        const home=position;
        const offsets:Array<[number,number]>=[[0,0]];
        for(const radius of [32,64,96,128,176,224,280,352,448,576])
          for(const [dx,dy] of [[0,-1],[-1,0],[1,0],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]])
            offsets.push([dx*radius,dy*radius]);
        const clear=offsets.map(([dx,dy])=>({x:home.x+dx,y:home.y+dy}))
          .find(candidate=>this.npcCanStandAt(candidate.x,candidate.y)&&(npcDefinition.formation||npcStandingOffRoad(npcDefinition,candidate)));
        npcPosition=clear??npcWorldPosition(npcDefinition);
      }
      const npc = new Npc(this, npcDefinition, npcPosition.x, npcPosition.y, npcWorldPosition(npcDefinition,'home'));
      if(this.cinematicDirector?.active&&!npc.definition.formation)npc.storyRest();
      this.groundShadows.register(npc);
      this.npcBodies.add(npc);
      npc.on('pointerdown', () => {
        if(this.storyCombatActive)return;
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y) < (npc.adventureCompanion?180:72) && this.hasClearPath(this.player.x, this.player.y, npc.x, npc.y)) {
          useGameStore.getState().startDialogue(npc.definition.id);
        }
      });
      this.npcs.push(npc);
      return npc;
    }
    if (definition.kind === 'creature') {
      // Authored bosses must begin where both the terrain and the currently
      // streamed physical scenery permit a real fight. Preserve the logical
      // boss identity/HP/timer; only repair coordinates when obstructed.
      let spawn={x,y};
      if(definition.bossId&&definition.bossId!=='salt-king'&&definition.bossId!=='varkhul'
        &&!this.canEnemyOccupy(x,y)){
        const candidates=[64,96,128,176,224,288,352,448].flatMap(radius=>
          Array.from({length:16},(_,i)=>({x:definition.world.x+Math.cos(i*Math.PI/8)*radius,
            y:definition.world.y+Math.sin(i*Math.PI/8)*radius})));
        const clear=(p:Vec2)=>this.canEnemyOccupy(p.x,p.y)
          &&[0,Math.PI/2,Math.PI,Math.PI*1.5].every(angle=>
            this.canEnemyOccupy(p.x+Math.cos(angle)*55,p.y+Math.sin(angle)*55));
        const safe=candidates.find(clear)??candidates.find(p=>this.canEnemyOccupy(p.x,p.y));
        if(safe){spawn=safe;this.contentManager.patchState(definition.id,safe);}
      }
      const behavior=definition.encounterBehavior&&state.encounterPlacement?
        {...definition.encounterBehavior,home:state.encounterPlacement.home,station:state.encounterPlacement.station}:definition.encounterBehavior;
      const enemy = new Enemy(this,ENEMY_BY_ID[definition.enemyId],spawn.x,spawn.y,definition.id,definition.eventSpawn,
        definition.wolfPackId??null,definition.wolfAlpha??false,definition.encounterId??null,behavior);
      if (enemy.encounterKey) {
        this.encounters.register(enemy.encounterKey,enemy.instanceId);
        enemy.once('destroy',()=>this.encounters.forget(enemy.encounterKey!,enemy.instanceId));
      }
      this.groundShadows.register(enemy);
      enemy.hp=restoredEnemyHealth(state,enemy.definition.hp);
      if(state.bossPhase)enemy.restoreBossPhase(state.bossPhase);
      this.creatureBodies.add(enemy); this.enemies.add(enemy);this.combatEnemyListDirty=true;
      if (definition.bossId && Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 1200) {
        const boss = BOSSES.find(b => b.id === definition.bossId);
        if (boss) this.notify(`Boss territory: ${boss.name} — ${boss.lore}`);
      }
      return enemy;
    }
    if (definition.kind === 'settlement') {
      const town = TOWN_BY_ID[definition.townId];
      return this.add.text(x, y, town.name, {
        fontFamily: 'Georgia, serif', fontSize: '18px', color: '#f4dfae', stroke: '#24170d', strokeThickness: 4,
      }).setResolution(2).setOrigin(.5).setDepth(y + 180).setAlpha(town.id === 'oakmere' ? 1 : .82);
    }
    if (definition.kind === 'prop' || definition.kind === 'settlement-prop') {
      const texture = definition.texture ?? 'world_objects';
      const solid = definition.solid || isTreeArt(texture,definition.frame);
      const treeBase = isTreeArt(texture,definition.frame)
        ? treeFootprint(texture,definition.frame,definition.scale) : definition.footprint;
      const actor = this.add.sprite(x,y,texture,definition.frame);
      actor.setName(definition.id);
      if(definition.id.startsWith('story:signal-fire:'))actor.setVisible(Boolean(useGameStore.getState().storyFlags[
        'encounter:'+definition.id.slice('story:signal-fire:'.length)+':complete']));
      if (definition.tint !== undefined) actor.setTint(definition.tint);
      this.presentWorldSprite(actor, texture, definition.frame, definition.scale, solid,treeBase,
        definition.rotation,definition.anchor);
      if(texture==='pirate_flagship')this.flagshipArt.attach(actor);
      if (definition.label) {
        const caption = this.add.text(x, y + 14, definition.label, {
          fontFamily: 'Georgia, serif', fontSize: '10px', color: '#e7d7ad', stroke: '#211b12', strokeThickness: 3,
        }).setResolution(2).setOrigin(.5,0).setDepth(y + 80);
        actor.once('destroy', () => caption.destroy());
      }
      return actor;
    }
    if (!('description' in definition)) throw new Error(`Unknown content type: ${definition.id}`);
    const texture = definition.texture ?? 'world_objects';
    const solid = definition.solid ?? (definition.kind !== 'harvestable' || definition.texture === 'world_assets');
    const actor=this.add.sprite(x,y,texture,definition.frame).setName(definition.id).setInteractive({useHandCursor:true});
    const signal=definition.id==='story:beacon-kit'?'mountain-signal':definition.id==='story:frost-lantern'?'winter-signal':undefined;
    if(signal&&useGameStore.getState().storyFlags['encounter:'+signal+':complete'])actor.setVisible(false);
    if(definition.tint!==undefined)actor.setTint(definition.tint);
    const footprint = propFoundation(texture,definition.frame,definition.scale??.6);
    this.presentWorldSprite(actor, texture, definition.frame, definition.scale ?? .6, solid, footprint,
      definition.rotation??0,definition.anchor??'bottom');
    if (definition.townShrineId||definition.portId) {
      const caption = this.add.text(x,y + 15,definition.name,{
        fontFamily:'Georgia, serif',fontSize:'10px',color:'#e7d7ad',stroke:'#211b12',strokeThickness:3,
      }).setResolution(2).setOrigin(.5,0).setDepth(y + 80);
      actor.once('destroy',() => caption.destroy());
    }
    if (state.used) actor.setTint(definition.id==='clue:cibar-pump'&&useGameStore.getState().storyFlags['cibar-irrigation-repaired']?0xc9f2ed:definition.townShrineId ? 0xc9e7eb : 0x99907b);
    if(definition.id==='clue:varkhul-ward'&&useGameStore.getState().storyFlags['wards-rewoven'])actor.setTint(0xffefc5);
    actor.on('pointerdown', () => {
      if(definition.townShrineId==='elarion'){
        const elarionShrine=this.nearbyElarionShrine(this.player.x,this.player.y);
        if(elarionShrine){this.useInteractable(elarionShrine.definition,elarionShrine.actor);return;}
      }
      const point=definition.portId?PORT_BY_ID[definition.portId].landing:actor;
      if (!useGameStore.getState().panel && !useGameStore.getState().dialogue
        && Phaser.Math.Distance.Between(this.player.x, this.player.y, point.x, point.y) < 72
        && this.hasClearPath(this.player.x, this.player.y, point.x, point.y, actor)) this.useInteractable(definition, actor);
    });
    this.interactables.set(definition.id, { definition, actor });
    return actor;
  }

  private presentWorldSprite(actor: Phaser.GameObjects.Sprite, texture: WorldPropTexture,
    frame: number, scale: number, solid = false, foundation?:{ width:number; height:number }, rotation = 0,
    anchor:'center'|'bottom' = 'bottom') {
    const origin=worldPropOrigin(texture,frame,anchor);
    actor.setOrigin(origin.x,origin.y).setScale(artScale(texture) * scale).setDepth(actor.y).setRotation(rotation);
    this.worldSprites.register(actor,texture,frame,scale,solid,foundation,anchor==='center');
    this.dayNight.register(actor,texture,frame,scale);
    this.treeSway.register(actor,texture,frame);
  }

  private destroyContentActor(actor: ContentActor) {
    if (actor instanceof Enemy) {this.enemies.delete(actor);this.combatEnemyListDirty=true;this.forgetOrcSpears(actor.instanceId);}
    if (actor instanceof Npc) {
      const i = this.npcs.indexOf(actor); if (i >= 0) this.npcs.splice(i, 1);
    }
    this.interactables.delete(actor.name);
    actor.destroy();
  }

  private useInteractable(definition: InteractableContentDefinition, actor: ContentActor) {
    if(this.cinematicDirector?.active)return;
    if(this.storyCombatActive){this.storyEncounters.interact();return;}
    if(definition.contractTownId){useGameStore.getState().openContractBoard(definition.contractTownId);this.player.resetInput();return;}
    if(definition.portId){useGameStore.getState().hydrate({panel:'harbor',harborPortId:definition.portId});this.player.resetInput();return;}
    if(definition.id==='clue:varkhul-ward'){
      const returnAt=this.contentManager.getState('boss:'+DRAGON_BOSS_ID)?.respawnAt;
      if(returnAt&&returnAt>Date.now()&&!objectiveIsCurrent(useGameStore.getState().quests,'investigate','varkhul-ward')){
        this.notify('The stones still burn with Varkhul’s passage. Far above the ridge, his wings have fallen silent—for now.');return;
      }
    }
    if(definition.discoveryId&&!useGameStore.getState().storyFlags['discovery:'+definition.discoveryId])
      useGameStore.getState().setStoryFlag('discovery:'+definition.discoveryId);
    if(definition.questTargetId&&definition.questEventType) {
      const store=useGameStore.getState();
      const used=this.contentManager.getState(definition.id)?.used;
      if(used&&!definition.repeatable){this.notify(definition.repeatText);return;}
      if(!objectiveIsCurrent(store.quests,definition.questEventType,definition.questTargetId)) {
        this.notify(definition.repeatText);return;
      }
      this.contentManager.patchState(definition.id,{used:true});
      const repairing=definition.id==='clue:cibar-pump'&&(store.quests['water-stops']?.objectiveProgress.decision??0)>=1;
      const restoring=definition.id==='clue:varkhul-ward'&&objectiveIsCurrent(store.quests,'investigate','varkhul-ward')
        &&(store.quests['the-last-ward']?.objectiveProgress['last-confrontation']??0)>=1;
      store.progressQuest(definition.questEventType,definition.questTargetId);
      if(repairing){store.setStoryFlag('cibar-irrigation-repaired');if(actor instanceof Phaser.GameObjects.Sprite)actor.setTint(0xc9f2ed);}
      if(restoring&&actor instanceof Phaser.GameObjects.Sprite)actor.setTint(0xffefc5);
      store.setContentWorld(this.contentManager.snapshot());this.notify(restoring?'The witnessed chains join Cinderwatch. The compass settles; the ward has keepers again.':repairing?'The broken clasp fits the scored housing. Celia’s brother was attacked here; the witness account is complete.':definition.description);return;
    }
    if (definition.townShrineId) {
      // The travel UI is the action, not a side effect of marking scenery used.
      // Open it first so a save/capture problem cannot silently swallow E.
      useGameStore.getState().openShrineTravel(definition.townShrineId);
      if(useGameStore.getState().panel!=='travel'){
        this.notify('Shrine travel did not open. Close any current menu and try again.');
        return;
      }
      try {
        this.contentManager.patchState(definition.id,{used:true});
        if(actor.active)actor.setTint(0xc9e7eb);
        useGameStore.getState().setContentWorld(this.contentManager.snapshot());
        saveGame();
      }catch(error){
        console.error('Shrine attunement persistence failed:',definition.id,error);
        this.notify('Shrine travel opened, but its attunement could not be saved.');
      }
      return;
    }
    const state = this.contentManager.getState(definition.id)!;
    if (state.used && !definition.repeatable) { this.notify(definition.repeatText); return; }
    this.contentManager.patchState(definition.id, { used: true });
    actor.setTint(0x99907b);
    if (definition.restoreHp) {
      const previousHp = this.player.hp;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + definition.restoreHp);
      if (this.player.hp > previousHp) this.playEffect('heal', this.player.x, this.player.y);
    }
    const store = useGameStore.getState();
    store.hydrate({worldContent:this.contentManager.snapshot(),
      gold:store.gold+earnedRewards(0,definition.rewardGold??0,store.attributes,store.learnedSkills).gold});
    this.notify(definition.description);
  }

  private handleShrineTravel() {
    const store = useGameStore.getState();
    if (!store.travelRequest) return;
    const origin = store.travelOriginTownId ? TOWN_SHRINE_BY_ID[store.travelOriginTownId] : undefined;
    const destination = TOWN_SHRINE_BY_ID[store.travelRequest];
    const validOrigin = store.travelRequestSource === 'map'
      || store.travelRequestSource === 'shrine' && origin && store.unlockedTownShrines.includes(origin.townId)
        && Phaser.Math.Distance.Between(this.player.x,this.player.y,origin.world.x,origin.world.y) <= 120;
    store.clearShrineTravelRequest();
    if (!validOrigin || !destination || !localSettlementTravelEnabled() && !store.unlockedTownShrines.includes(destination.townId)) {
      this.notify('Attune this settlement’s shrine before teleporting there.');
      return;
    }
    const departure = { x:this.player.x,y:this.player.y };
    this.player.resetInput();
    this.wildlife.reset();
    this.chunkManager.update(destination.arrival.x,destination.arrival.y);
    this.contentManager.update(destination.arrival.x,destination.arrival.y);
    const landing = [destination.arrival,
      ...[0,48,-48,80,-80].flatMap(dx => [24,48,80].map(dy => ({ x:destination.arrival.x + dx,y:destination.arrival.y + dy })))
    ].find(point => this.worldGenerator.isWalkable(point.x,point.y) && !this.isBlockedByBuilding(point.x,point.y)
      && !this.npcs.some(npc => Phaser.Math.Distance.Between(point.x,point.y,npc.x,npc.y) < 36));
    if (!landing) {
      this.chunkManager.update(departure.x,departure.y);
      this.contentManager.update(departure.x,departure.y);
      this.notify('This shrine arrival is obstructed. Try again shortly.');
      return;
    }
    this.spearProjectiles.clear();
    this.playEffect('teleport',departure.x,departure.y);
    (this.player.body as Phaser.Physics.Arcade.Body).reset(landing.x,landing.y);
    this.player.lastDirection.set(0,1);
    this.lastSafe = { ...landing };
    this.cameras.main.centerOn(landing.x,landing.y);
    this.playEffect('teleport',landing.x,landing.y);
    this.targeting.clear();this.refreshWorldLighting();
    this.syncState();
    this.updateNavigation();
    saveGame();
    this.notify(`Arrived at ${TOWN_BY_ID[destination.townId].name}.`);
  }

  private trySpawnAmbientEnemy(regionId: RegionId) {
    if(regionId==='dead-sea'||!this.isEnemyTerritory(this.player.x,this.player.y)||this.player.hp<=0)return;
    const biome=this.worldGenerator.getBiomeAt(this.player.x,this.player.y);
    const hour=this.dayNight.getHour(),night=hour>=18||hour<6;
    const forest=biome==='forest',swamp=biome==='wetland';
    const wild=forest||swamp||biome==='highland'||biome==='snowfield'||biome==='volcanic'||biome==='dryland';
    if(this.encounterCapacity('spawn')<1)return;
    // Do not materialize fresh enemies in the middle of an ongoing melee.
    if([...this.enemies].some(e=>e.active&&e.hp>0&&Math.hypot(e.x-this.player.x,e.y-this.player.y)<250))return;
    const rng=seededRandom('ambient:'+(this.spawnAttempts++)+':'+Math.floor(this.player.x/256)+':'+Math.floor(this.player.y/256));
    const chance=wild?(night?.86:.62):(night?.66:.42);
    if(rng()>chance)return;

    // New encounters appear beyond immediate melee range, never inside
    // protected towns or blocked geometry; the current spawn API handles
    // complete wolf packs and their alpha/flanking data.
    for(let attempt=0;attempt<9;attempt++){
      const angle=rng()*Math.PI*2;
      const distance=430+rng()*390;
      const px=this.player.x+Math.cos(angle)*distance;
      const py=this.player.y+Math.sin(angle)*distance;
      if(!this.canEnemyOccupy(px,py))continue;
      // Selection and density follow the actual candidate, not the player's
      // side of a region/biome border. Each pack member is checked again.
      const habitat=this.habitatAt(px,py);
      const candidateWild=['forest','wetland','highland','snowfield','volcanic','dryland'].includes(habitat.biome);
      const candidateCap=candidateWild?(night?12:9):(night?10:7);
      const available=this.encounterCapacity('spawn',candidateCap);
      if(available<1)continue;
      const weights:string[]=[];
      for(const enemy of ENEMIES){
        if(isWolfFamily(enemy.id)&&available<4)continue;
        if(enemy.id==='rindass-orc-raider'&&available<3)continue;
        if(enemy.id==='cutlass-pirate'&&available<3)continue;
        if(enemy.id==='hedge-goblin'&&available<3)continue;
        if(['blighted-thornling','grove-spider'].includes(enemy.id)&&available<2)continue;
        if(!this.m14LocationAllowed(enemy.id,px,py))continue;
        const weight=creatureHabitatWeight(enemy,habitat,night);
        for(let i=0;i<weight;i++)weights.push(enemy.id);
      }
      if(!weights.length)continue;
      const id=weights[Math.floor(rng()*weights.length)];
      if(this.spawnEnemy(id,px,py,false,undefined,candidateCap))return;
    }
  }

  private m14LocationAllowed(id:string,x:number,y:number):boolean {
    if(id==='blighted-thornling')return this.wildlife.hasTreeNear({x,y})||WILDERNESS_SITES.some(s=>
      ['greenward-ruin','moon-pilgrim-grove'].includes(s.id)&&Math.hypot(x-s.world.x,y-s.world.y)<1300);
    if(id==='grove-spider')return this.worldGenerator.getBiomeAt(x,y)==='forest'&&!this.worldGenerator.isRoad(x,y,100);
    return true;
  }

  private enforceLandCollision() {
    if (this.canTraverseGround(this.lastSafe,this.player)) {
      this.lastSafe = { x: this.player.x, y: this.player.y };
    } else {
      // A streamed collider can cover the saved safe point while standing.
      // Search locally only in that exceptional case; never disable the prop.
      if(!this.worldGenerator.isWalkable(this.lastSafe.x,this.lastSafe.y)||this.worldSprites.blocksPoint(this.lastSafe)){
        const clear=(p:Vec2)=>this.worldGenerator.isWalkable(p.x,p.y)&&!this.isBlockedByBuilding(p.x,p.y);
        let recovered:Vec2|undefined;
        for(const radius of [16,32,48,80,128,192,256,384,512]){
          for(let i=0;i<16;i++){
            const angle=i*Math.PI/8,p={x:this.lastSafe.x+Math.cos(angle)*radius,y:this.lastSafe.y+Math.sin(angle)*radius};
            if(clear(p)){recovered=p;break;}
          }
          if(recovered)break;
        }
        if(recovered)this.lastSafe=recovered;
      }
      this.restoreOutsidePosition(this.lastSafe);
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0,0);
    }
  }

  private handlePanelHotkeys() {
    const store = useGameStore.getState();
    const actions = new Set(this.panelActions);
    this.panelActions.clear();
    if(store.cinematic){if(actions.has('pause'))store.requestCinematicSkip();return;}
    if (store.dialogue) {
      this.player.discardActions();
      if (actions.has('pause')) store.endDialogue();
      else if (actions.has('dialogue')) {
        const npc = NPCS.find(n => n.id === store.dialogue?.npcId);
        if (npc && store.dialogue.lineIndex < (store.dialogue.lines??npc.dialogue).length - 1) store.advanceDialogue();
        else if(!store.dialogue.choices?.length) store.endDialogue();
      }
      return;
    }
    if (actions.has('pause')) store.panel ? store.closePanel() : store.openPanel('pause');
    if (actions.has('map')) store.panel === 'map' ? store.closePanel() : store.openPanel('map');
    if (actions.has('inventory')) store.panel === 'inventory' ? store.closePanel() : store.openPanel('inventory');
    if (actions.has('character')) store.panel === 'character' ? store.closePanel() : store.openPanel('character');
    if (actions.has('journal')) store.panel === 'journal' ? store.closePanel() : store.openPanel('journal');
    if (actions.has('codex')) store.panel === 'codex' ? store.closePanel() : store.openPanel('codex');
  }

  private updateCameraZoom() {
    if(this.cinematicDirector?.active){this.cinematicDirector.refreshZoom();return;}
    const density=renderDensity(this),width=this.scale.width/density;
    const shortSide = Math.min(width, this.scale.height/density);
    this.cameras.main.setZoom((shortSide < 500 ? .82 : width < 1100 ? 1.1 : 1.25)*density);
  }

  private updateCinematicPresentation(time:number,delta:number){
    this.storyEncounters.pauseAllies();
    const paused=!this.focused,step=paused?0:delta;
    this.physics.world.pause();this.player.discardActions();this.enemySounds.pause(true);
    // Preparation/reveal must progress while gameplay time is paused; only
    // the shot's narration duration should freeze when the window loses focus.
    this.cinematicDirector.update(delta,paused);
    if(this.cinematicDirector.illustrated)return;
    const camera=this.cameras.main;camera.preRender();
    if(this.inInterior){this.interiors.update(time,delta,true);this.interiors.presentCinematic(camera.midPoint.x,camera.midPoint.y,paused,step);return;}
    for(const npc of this.npcs)if(npc.active){
      if((npc.definition.formation||npc.storyMoving)&&!paused&&this.cinematicDirector.playing){npc.updatePatrol(time,step);npc.advanceCinematic(step);}
      npc.updatePresentation(camera.midPoint.x,camera.midPoint.y,false,paused,true);npc.setDepth(npc.y);
    }
    for(const enemy of this.enemies)if(enemy.active)enemy.updatePresentation(camera.midPoint.x,camera.midPoint.y,true);
    if(this.cinematicDirector.playing)this.activePlayMs+=Math.min(step,250);
    this.weather.update(step,camera.midPoint.x,camera.midPoint.y,paused);
    this.treeSway.update(step,this.weather.windStrength);this.waterSurface.update(step);this.traffic.update(0);this.flagshipArt.update(step);
    this.dayNight.update(step,camera.midPoint.x,camera.midPoint.y);
    this.groundShadows.update(step,this.dayNight.getHour(),this.weather.cloudCover,this.weather.windStrength);
    this.m14Art.update(step,this.worldGenerator.getRegionAt(camera.midPoint.x,camera.midPoint.y));
  }

  shutdown() {
    if(this.shuttingDown)return;
    this.shuttingDown=true;
    // A partially created system (or an already destroyed sprite) must not
    // prevent other systems from releasing their listeners and resources.
    const release=(name:string,cleanup:()=>void)=>{
      try{cleanup();}catch(error){console.warn(`[shutdown] Could not release ${name}:`,error);}
    };
    this.game.events.off(Phaser.Core.Events.POST_RENDER,this.onFirstWorldRender,this);
    this.events.off(Phaser.Scenes.Events.SHUTDOWN,this.shutdown,this);
    this.events.off(Phaser.Scenes.Events.DESTROY,this.shutdown,this);
    setSaveSnapshotProvider();
    this.scale.off('resize', this.updateCameraZoom, this);
    this.game.events.off(Phaser.Core.Events.BLUR, this.onBlur, this);
    this.game.events.off(Phaser.Core.Events.FOCUS, this.onFocus, this);
    release('Alice companion',()=>this.aliceCompanion?.destroy());
    release('road life',()=>this.roadLife?.destroy());
    release('level-up feedback',()=>this.levelUpFeedback?.destroy());
    release('cinematics',()=>this.cinematicDirector?.destroy());
    release('story encounters',()=>this.storyEncounters?.destroy());
    release('interiors',()=>this.interiors?.destroy());
    release('dungeons',()=>this.dungeons?.destroy());
    release('spear projectiles',()=>this.spearProjectiles?.clear());
    release('wildlife',()=>this.wildlife?.destroy());
    this.encounters.clear();
    release('volcanic tremor',()=>this.volcanicTremor?.destroy());
    release('ship passage',()=>this.passage?.destroy());
    release('targeting',()=>this.targeting?.clear());
    release('boss display',()=>useGameStore.getState().setBossEncounter(null));
    mobileInput.reset();
    this.panelActions.clear();
    release('night lighting',()=>this.dayNight?.destroy());
    release('enemy sounds',()=>this.enemySounds?.destroy());
    release('traffic',()=>this.traffic?.destroy());
    release('ground shadows',()=>this.groundShadows?.destroy());
    release('weather',()=>this.weather?.destroy());
    release('content chunks',()=>this.contentManager?.destroy());
    release('regional enemy art',()=>this.m14Art?.destroy());
    release('quest guide',()=>{this.questGuide?.destroy();this.questMarker?.destroy();});
    release('terrain chunks',()=>this.chunkManager?.destroy());
    release('tree sway',()=>this.treeSway?.destroy());
    release('water surface',()=>this.waterSurface?.destroy());
    release('world sprites',()=>this.worldSprites?.destroy());
    release('flagship art',()=>this.flagshipArt?.destroy());
  }

  private wildlifeRouteClear(from:Vec2,to:Vec2){
    if(this.worldSprites.blocksPath(from,to,20,12)||fortificationBlocksPath(from,to,12))return false;
    const steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y)/16));
    for(let i=0;i<=steps;i++){
      const x=from.x+(to.x-from.x)*i/steps,y=from.y+(to.y-from.y)*i/steps;
      // Stay out of settlement courts, patrol lanes, docks and planted fields.
      // Sample both sides of the body, not just a centerline across a bank.
      for(const dx of [-10,0,10]){
        const terrain=this.worldGenerator.getTerrainAt(x+dx,y);
        if(!this.worldGenerator.isWalkable(x+dx,y)||!['grass','forest','dirt'].includes(terrain))return false;
      }
      if(this.worldGenerator.getTownAt(x,y)||this.worldGenerator.isRoad(x,y,18))return false;
      if(this.npcs.some(n=>n.active&&Math.hypot(n.x-x,n.y-y)<80))return false;
    }
    return true;
  }

  private tidewatchGullFlyby(player:{x:number;y:number}){
    const town=TOWN_BY_ID.tidewatch.world;
    if(Math.hypot(player.x-town.x,player.y-town.y)>4500)return null;
    const view=groundWorldView(this);
    if(view.width<=0||view.height<=0)return null;
    // Actual harbor water anchors the event geographically. A flying gull can
    // cross houses and shoreline; ground-only admission would exclude town views.
    const harbor=PORT_BY_ID.tidewatch;
    if(this.worldGenerator.getTerrainAt(harbor.boat.x,harbor.boat.y)!=='water'
      &&this.worldGenerator.getTerrainAt(town.x,town.y+1400)!=='water')return null;
    const y=view.y+view.height*.45+120;
    return {from:{x:view.x-140,y},to:{x:view.right+140,y}};
  }

  private birdGroundSite(point:Vec2){
    const {x,y}=point;
    if(onPortDeck(x,y)||this.worldSprites.blocksPath(point,{x:x+8,y},16,10)
      ||fortificationBlocksPath(point,{x:x+8,y},10))return false;
    for(const dx of [-8,0,8])for(const dy of [-8,0,8]){
      if(!this.worldGenerator.isWalkable(x+dx,y+dy)
        ||!['grass','forest','dirt','stone','sand'].includes(this.worldGenerator.getTerrainAt(x+dx,y+dy)))return false;
    }
    return !this.npcs.some(n=>n.active&&Math.hypot(n.x-x,n.y-y)<32);
  }

  private coastalBirdSite(point:Vec2):Vec2|null{
    const {x,y}=point,to={x:x+8,y};
    const region=this.worldGenerator.getRegionAt(x,y);
    if(region!=='portquill'||this.worldGenerator.getBiomeAt(x,y)!=='coast'&&!tidewatchGullHabitat(point,region)
      ||onPortDeck(x,y)
      ||this.worldSprites.blocksPath(point,to,24,14)||fortificationBlocksPath(point,to,14))return null;
    for(const dx of [-12,0,12])for(const dy of [-12,0,12]){
      if(!this.worldGenerator.isWalkable(x+dx,y+dy)
        ||!['sand','stone','grass','dirt'].includes(this.worldGenerator.getTerrainAt(x+dx,y+dy)))return null;
    }
    if(this.npcs.some(n=>n.active&&Math.hypot(n.x-x,n.y-y)<80)
      ||PORTS.some(p=>Math.hypot(p.landing.x-x,p.landing.y-y)<64||Math.hypot(p.boat.x-x,p.boat.y-y)<180))return null;
    // Actual water samples, not the broad coast biome alone. This also covers
    // the island shoreline, which distanceToWater does not currently measure.
    const radii=tidewatchGullHabitat(point,region)?[64,128,256,384,768,1536]:[64,128,256,384];
    for(const radius of radii)for(const [dx,dy] of [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]]){
      const length=Math.hypot(dx,dy),direction={x:dx/length,y:dy/length};
      if(this.worldGenerator.getTerrainAt(x+direction.x*radius,y+direction.y*radius)==='water')return direction;
    }
    return null;
  }
}

// LEIGHNERON_WOLF_PACKS_ROAD_BANDITS_V1

// LEIGHNERON_WOLF_FLANKING_AI_V1

  // LEIGHNERON_NIGHT_WILDERNESS_ENCOUNTERS_V1
