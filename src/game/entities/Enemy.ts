import {actorViewAim,actorViewTravel,actorViewFlip} from '../systems/actorViewDirection';
import {worldPointInView,presentationView} from '../presentation25d/plane';
import Phaser from 'phaser';
import {onPlane} from '../presentation25d/plane';
import {DepthSortedSprite,setDepthIfChanged} from '../systems/renderDepth';
import type { BossDefinition, EnemyDefinition, EncounterBehavior, BossPhaseSnapshot } from '../types';
import { BOSS_BY_ID, enemyAppearanceMultiplier,isWolfFamily } from '../../data/enemies';
import { enemyLevelAt,scaledEnemy,runtimeEnemyLevel } from '../../data/enemyTiers';
import {WORLD_ASCENSION} from '../../data/breakthrough';
import {awakenedProc} from '../../data/awakening';
import {luckDamage,progressionStats,playerDamageGrowth} from '../../data/progression';
import type { WorldScene } from '../scenes/WorldScene';
import { seededRandom } from '../../utils/seededRandom';
import { artScale, ART_BY_KEY, actorArtLayout, artFrameSize,type ArtTextureKey } from '../../data/art';
import { enemyAnimation, animationDuration, type EnemyAnimationState } from '../../data/animationPacks';
import { useGameStore } from '../../store/gameStore';
import { approachVelocity, strideRate } from '../systems/locomotion';
import {groundMarkerPosition} from '../systems/groundMarkers';
import {DragonCombat} from '../systems/DragonCombat';
import {enemyLocomotionKey,type ActorDirection} from '../../data/directionalEnemyArt';
import {pirateAttackPhase,piratePhaseDuration} from '../../data/pirateMotion';
import {isPirateEnemy} from '../../data/pirateArt';
import {ATTACK_WARNING_TEXTURE,enemyAttackWarningLayout,type EnemyAttackWarningStyle} from '../systems/attackWarning';
import {WeaponStatusSystem} from '../systems/WeaponStatusSystem';
import {WEAPON_PROFILES,WEAPON_STATUS_ATK_SCALE} from '../../data/weaponProfiles';
import {enhancedWeapon,enhancedProcChance} from '../../data/weaponUpgrades';
import {worldBossCombatProfile,type BossCombatProfile} from '../../data/bossCombatProfiles';
import {BossCombat} from '../systems/BossCombat';
import {BOSS_PHASE_TWO_TRANSITION_MS} from '../systems/BossPhaseState';
import {m14BossAttackPhase} from '../../data/m14Art';
import {AttackTelegraph} from '../systems/AttackTelegraph';
import type {Npc} from './Npc';

const ALLY_STEERING_OFFSETS=[0,.45,-.45,.9,-.9,1.35,-1.35] as const;

export class Enemy extends DepthSortedSprite {
  readonly weaponStatus=new WeaponStatusSystem();
  private statusAttackRate=1;
  private attackWindup:{delay:number;elapsed:number;timeScale:number;impact:()=>void}|null=null;
  private get combatTime(){return (this.scene as WorldScene).combatTime??this.scene.time.now;}
  private attackTimingActive=false;
  private hitFlashUntil=0;
  definition: EnemyDefinition;
  private readonly authoredDefinition: EnemyDefinition;
  private readonly regionalLevel:number;
  private readonly fixedLevel:number|undefined;
  private ascended:boolean;
  hp: number;
  playerContributed=false;
  ambientDefeat=false;
  readonly eventSpawn: boolean;
  readonly wolfPackId: string | null;
  readonly wolfAlpha: boolean;
  readonly encounterKey: string | null;
  readonly encounterBehavior: EncounterBehavior | undefined;
  level:number;
  readonly instanceId: string;
  private nextAttackAt = 0;
  private lockedUntil = 0;
  private nextSpecialAt = 0;
  private nextWanderAt = 0;
  // Idle enemies need not redo the same terrain/collider probe every frame.
  // Moving or scripted combatants retain full-frequency checks.
  private occupancyX=NaN;
  private occupancyY=NaN;
  private occupancyValid=true;
  private nextOccupancyCheckAt=0;
  private wander = new Phaser.Math.Vector2();
  private readonly facing = new Phaser.Math.Vector2(0, 1);
  private readonly rng: () => number;
  private lastSafe: { x: number; y: number };
  private readonly healthBar: Phaser.GameObjects.Graphics;
  private readonly nameLabel: Phaser.GameObjects.Text;
  private visualUntil = 0;
  private pirateWalkProgress = 0;
  private approachSlot = -1;
  private slotCheckAt = 0;
  private pirateMoving = false;
  private pirateStoppedAt: number | null = null;
  private nextGrowlAt=0;
  private leapVisual: Phaser.GameObjects.Sprite | null = null;
  private leapShadow: Phaser.GameObjects.Ellipse | null = null;
  private leapTween: Phaser.Tweens.Tween | null = null;
  private attackTelegraph: Phaser.GameObjects.Image | null = null;
  private attackShade:AttackTelegraph|null=null;
  private attackTelegraphStyle:EnemyAttackWarningStyle='melee';
  private attackTelegraphRadius=0;
  private attackTelegraphAngle=0;
  private attackTelegraphStartedAt=0;
  private attackTelegraphWindup=0;
  private readonly boss: BossDefinition | undefined;
  private readonly bossHome: {x:number;y:number}|null;
  private attackEpoch=0;
  private hitStunUntil=0;
  private staggerImmuneUntil=0;
  private flurrySuppressed=false;
  private readonly rootSources=new Set<object>();
  private rootBodyState:{moves:boolean;immovable:boolean}|null=null;
  get isRooted(){return this.rootSources.size>0;}
  /** Independent of weapon procs: a snare must not replace frost or poison. */
  setRooted(source:object,rooted:boolean){
    const body=this.body as Phaser.Physics.Arcade.Body|null;
    if(rooted){
      if(!this.active||!this.isAlive||!this.canBeTargeted||this.bossRegenerating||!body)return;
      if(!this.isRooted){
        this.rootBodyState={moves:body.moves,immovable:body.immovable};
        this.interruptAttack();body.moves=false;body.setImmovable(true);body.setVelocity(0,0);
      }
      this.rootSources.add(source);
    }else{
      this.rootSources.delete(source);
      if(!this.isRooted&&this.rootBodyState){
        if(body){body.moves=this.rootBodyState.moves;body.setImmovable(this.rootBodyState.immovable);body.setVelocity(0,0);}
        this.rootBodyState=null;
      }
    }
  }
  private clearRoots(){for(const source of this.rootSources)this.setRooted(source,false);}
  private lastDamagedAt=0;
  private lastEngagedAt=0;
  private bossAlerted=false;
  private readonly targetIndicator:Phaser.GameObjects.Graphics;
  private readonly targetRing:Phaser.GameObjects.Graphics;
  private indicatorSize=-1;
  private indicatorSelected=false;
  private ringWidth=-1;
  private ringHeight=-1;
  private healthFillWidth=-1;
  private healthWidth=-1;
  private healthColor=-1;
  private healthStatusColor:number|null=null;
  private readonly dragonCombat:DragonCombat|undefined;
  private readonly bossCombat:BossCombat|undefined;
  get isBossEncounter():boolean{return Boolean(this.definition.boss||this.bossCombat||this.dragonCombat);}
  private get poiseProfile():BossCombatProfile|undefined{return this.bossCombat?.profile??this.dragonCombat?.profile;}
  get bossPhase():1|2{return this.bossCombat?.phaseNumber??this.dragonCombat?.phaseNumber??1;}
  get bossRegenerating(){return this.bossCombat?.regenerating??this.dragonCombat?.regenerating??false;}
  get bossPhaseSnapshot(){return this.bossCombat?.phaseSnapshot??this.dragonCombat?.phaseSnapshot;}
  restoreBossPhase(snapshot:BossPhaseSnapshot){this.bossCombat?.restorePhase(snapshot);this.dragonCombat?.restorePhase(snapshot);}
  /** An empty first bar is a living, protected transition, not a defeat. */
  get isAlive(){return this.hp>0||this.bossRegenerating;}
  private depleteFirstForm(){
    if(this.hp>0||this.bossPhase!==1||!this.poiseProfile?.phaseTwo)return;
    this.interruptAttack();
    const changed=this.bossCombat?.depleteFirstForm()??this.dragonCombat?.depleteFirstForm()??false;
    if(!changed)return;
    this.weaponStatus.clear();this.clearRoots();this.flurrySuppressed=false;this.hitStunUntil=0;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0,0);
  }
  private visualDirection:ActorDirection='right';
  // Each pack member claims a stable hunting lane until it is unloaded.
  private wolfFlankSlot: number | null = null;
  private wolfHuntBearing = 0;
  get canBeTargeted(){return !this.dragonCombat?.airborne;}
  /** A protected flight changes hit eligibility, not the player's chosen foe. */
  get canRemainLocked(){return !this.dragonCombat?.airborne||this.dragonCombat.engagedWithPlayer;}
  get isAirborne(){return Boolean(this.dragonCombat?.airborne||this.bossCombat?.airborne);}
  get presentationElevation(){return this.bossCombat?.elevation??0;}
  get presentationLockVisual():Phaser.GameObjects.Sprite{return this.dragonCombat?.visual??(this.leapVisual?.active?this.leapVisual:this);}
  get movementSpeed(){return this.isRooted?0:this.definition.moveSpeed*this.weaponStatus.movementMultiplier;}
  get attackSpeedMultiplier(){return this.weaponStatus.attackSpeedMultiplier;}
  /** Multiply a light status wash into the species tint, preserving its art. */
  get presentationTint(){
    const base=this.definition.spriteTint??0xffffff,overlay=this.weaponStatus.tint;
    const channel=(shift:number)=>Math.round((base>>shift&255)*(overlay>>shift&255)/255);
    return channel(16)<<16|channel(8)<<8|channel(0);
  }
  private applyStatusTint(){
    if(!this.active||this.combatTime<this.hitFlashUntil)return;
    const tint=this.presentationTint;
    const apply=(sprite:Phaser.GameObjects.Sprite|null|undefined)=>{
      if(!sprite?.active)return;
      // Tint setters mark sprite render state. Only change it when status
      // colors actually change, or when a white hit-flash must be cleared.
      if(tint===0xffffff){
        if(sprite.isTinted)sprite.clearTint();
      }else if(!sprite.isTinted||sprite.tintTopLeft!==tint||sprite.tintTopRight!==tint
        ||sprite.tintBottomLeft!==tint||sprite.tintBottomRight!==tint)sprite.setTint(tint);
    };
    apply(this);apply(this.leapVisual);
    const dragonVisual=this.dragonCombat?.visual;if(dragonVisual!==this)apply(dragonVisual);
  }
  private syncStatusAttackSpeed(time:number){
    const rate=this.attackSpeedMultiplier;
    if(time>=this.visualUntil&&!this.bossCombat?.isAttacking)this.attackTimingActive=false;
    if(rate===this.statusAttackRate)return;
    const remainingScale=this.statusAttackRate/rate;
    if(this.nextAttackAt>time)this.nextAttackAt=time+(this.nextAttackAt-time)*remainingScale;
    if(this.attackTimingActive){
      this.lockedUntil=time+Math.max(0,this.lockedUntil-time)*remainingScale;
      this.visualUntil=time+Math.max(0,this.visualUntil-time)*remainingScale;
      this.anims.timeScale/=remainingScale;
      if(this.leapVisual?.active)this.leapVisual.anims.timeScale/=remainingScale;
      if(this.leapTween)this.leapTween.timeScale=rate;
    }
    if(this.attackWindup){
      this.attackWindup.timeScale=rate;
      this.attackTelegraphStartedAt=time-this.attackWindup.elapsed/rate;
      this.attackTelegraphWindup=this.attackWindup.delay/rate;
    }
    this.statusAttackRate=rate;
  }
  get isStaggered(){return !this.bossRegenerating&&(this.flurrySuppressed||this.combatTime<this.hitStunUntil);}
  get facingLeft(){return this.visualDirection==='left';}
  get isRangedAttacker(){return this.definition.combatStyle==='spear-thrower'||this.definition.combatStyle==='stone-thrower';}
  private get directionalCombat(){return this.isRangedAttacker||this.definition.combatStyle==='boatswain'||['hedge-goblin','blighted-thornling','grove-spider','redmesa-chieftain','rootfather','frost-wyrm','ashen-seer','grand-magus'].includes(this.definition.id);}
  private get displayName(){return `${this.encounterStats?'':`Lv.${this.level} `}${this.boss?.name??this.definition.name}`;}
  playMonsterVocal(cue:'attack'|'growl'|'hurt'|'death'){
    // No borrowed mammal/ghost voice for a chitin creature. Its attack still
    // uses the existing restrained swish/impact effects.
    if(this.definition.id==='grove-spider')return;
    (this.scene as WorldScene).playEnemyVocal(this.definition,this.instanceId,cue,this.x,this.y);
  }
  playMonsterAttackFoley(phase:'windup'|'impact'){
    (this.scene as WorldScene).playEnemyAttackFoley(this.definition,this.x,this.y,phase);
  }

  constructor(scene: WorldScene, definition: EnemyDefinition, x: number, y: number, instanceId: string,
    eventSpawn = false, wolfPackId: string | null = null, wolfAlpha = false,
    encounterId: string | null = null, encounterBehavior?: EncounterBehavior,fixedLevel?:number,combatProfile?:BossCombatProfile,
    private readonly encounterStats?:Pick<EnemyDefinition,'hp'|'damage'|'defense'>) {
    const idle=scene.anims.get(enemyLocomotionKey(definition.spriteFrame,'idle','right'));
    const initial=idle.frames[0];
    super(scene, x, y, initial.textureKey, initial.textureFrame);
    this.boss = instanceId.startsWith('boss:') ? BOSS_BY_ID[instanceId.slice(5)] : undefined;
    this.bossHome=this.boss&&this.boss.id!=='salt-king'&&this.boss.id!=='varkhul'?{x,y}:null;
    this.wolfAlpha=isWolfFamily(definition.id) && wolfAlpha;
    // A pack's members share its danger tier even when roaming across borders
    // or being restored on opposite sides of a settlement's tier boundary.
    const levelHome=encounterBehavior?.home??{x,y};
    const zone=(scene as WorldScene).getRegionAtPosition(levelHome.x,levelHome.y);
    this.authoredDefinition=definition;
    // Authored fixed-level encounters must not receive the global bonus,
    // either on spawn or when the player levels up during the encounter.
    this.fixedLevel=fixedLevel;
    this.regionalLevel=fixedLevel??enemyLevelAt(definition,levelHome.x,levelHome.y,zone,this.wolfAlpha);
    const progression=useGameStore.getState();
    this.ascended=!encounterStats&&Boolean(progression.storyFlags[WORLD_ASCENSION]);
    this.level=encounterStats?1:runtimeEnemyLevel(this.regionalLevel,progression.level,this.ascended,this.fixedLevel);
    const base=encounterStats?{...definition,...encounterStats}:scaledEnemy(definition,this.level,this.ascended);
    this.wolfPackId=isWolfFamily(definition.id) ? wolfPackId : null;
    this.encounterKey=definition.boss ? null : this.wolfPackId ? `wolf:${this.wolfPackId}`
      : encounterId ? `encounter:${encounterId}` : null;
    this.encounterBehavior = this.encounterKey ? encounterBehavior : undefined;
    this.definition=this.wolfAlpha ? {...base,name:definition.id==='frost-wolf'?'Frost Alpha Wolf':'Alpha Wolf',
      hp:Math.round(base.hp*1.35),damage:Math.round(base.damage*1.12),
      xp:Math.round(base.xp*1.5),goldMax:Math.ceil(base.goldMax*1.25)} : base;
    this.hp=this.definition.hp;
    this.eventSpawn = eventSpawn;
    this.instanceId = instanceId;
    // Separate seed: animation variation must not consume combat/wander RNG.
    this.pirateWalkProgress=seededRandom(instanceId+':stride')();
    this.lastDamagedAt = scene.combatTime??scene.time.now;
    this.lastEngagedAt = scene.combatTime??scene.time.now;
    this.rng = seededRandom(instanceId);
    this.lastSafe = { x, y };
    scene.add.existing(this);
    const texture=initial.textureKey as ArtTextureKey,sheet=ART_BY_KEY[texture];
    this.setScale(artScale(texture) * enemyAppearanceMultiplier(definition) * (this.wolfAlpha?1.36:1)).setOrigin(.5, actorArtLayout(texture).originY);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    const radius = (definition.bodyRadius??(definition.boss ? 24 : 11)) * (this.wolfAlpha ? 1.18 : 1);
    const density = sheet.density;
    body.setCircle(radius / this.scaleX, sheet.frameWidth * density / 2 - radius / this.scaleX,
      this.originY * sheet.frameHeight * density - 2 * radius / this.scaleY);
    body.updateFromGameObject();
    body.setCollideWorldBounds(true);
    this.setDepth(scene.playerRenderDepth(y));
    this.anims.play(idle.key);
    if(definition.spriteTint!==undefined)this.setTint(definition.spriteTint);
    this.healthBar = onPlane(scene.add.graphics().setName(`enemy-health:${instanceId}`),'upright',this);
    this.nameLabel = scene.add.text(x, y - 40, this.displayName, {
      fontFamily: 'Georgia, serif', fontSize: definition.boss ? '12px' : '9px',
      color: definition.boss ? '#f3c69c' : '#edddcb', stroke: '#17120e', strokeThickness: 3,
    }).setResolution(2).setOrigin(.5,1).setName(`enemy-name:${instanceId}`);
    onPlane(this.nameLabel,'upright',this);
    this.targetIndicator=onPlane(scene.add.graphics().setName('enemy-target:'+instanceId),'upright',this);
    this.targetRing=scene.add.graphics().setVisible(false).setName('enemy-target-ring:'+instanceId);
    const profile=combatProfile??(this.boss?worldBossCombatProfile(this.boss.id,this.ascended):undefined);
    if(definition.combatStyle==='dragon')this.dragonCombat=new DragonCombat(this,scene,profile);
    else {
      if(profile)this.bossCombat=new BossCombat(this,scene,profile);
    }
    this.setInteractive({useHandCursor:true}).on('pointerdown',()=>{
      const state=useGameStore.getState();if(!state.panel&&!state.dialogue&&!state.cinematic)scene.targeting.select(this);
    });
    this.once('destroy', () => {
      this.clearRoots();
      this.interruptAttack();this.targetIndicator.destroy();this.targetRing.destroy();this.healthBar.destroy(); this.nameLabel.destroy(); this.clearWolfLeap(); this.attackTelegraph?.destroy();
      (this.scene as WorldScene).forgetEnemySound(this.instanceId);
      this.dragonCombat?.destroy();
      this.bossCombat?.destroy();
    });
  }

  updateEnemy(time: number,delta=16) {
    if(!this.active||!this.isAlive){this.clearRoots();return;}
    const damage=this.weaponStatus.update(delta,this.canBeTargeted&&!this.bossRegenerating);
    if(damage>0){
      this.hp=Math.max(0,this.hp-damage);this.lastDamagedAt=time;
      if(this.hp<=0)this.depleteFirstForm();
      if(!this.isAlive){this.clearRoots();this.weaponStatus.clear();this.interruptAttack();(this.scene as WorldScene).handleEnemyDefeated(this);return;}
    }
    this.syncStatusAttackSpeed(time);this.applyStatusTint();
    const windup=this.attackWindup;
    if(windup){
      windup.elapsed+=Math.max(0,Math.min(delta,250))*windup.timeScale;
      if(windup.elapsed>=windup.delay){this.attackWindup=null;windup.impact();}
    }
    if(!this.active||!this.isAlive)return;
    this.updateEnemyBehavior(time,delta);
    if(this.active&&this.isRooted)(this.body as Phaser.Physics.Arcade.Body).setVelocity(0,0);
  }

  private updateEnemyBehavior(time: number,delta:number) {
    const scene = this.scene as WorldScene;
    const player = scene.player;
    if (!player?.active) return;
    const progression=useGameStore.getState(),ascended=!this.encounterStats&&Boolean(progression.storyFlags[WORLD_ASCENSION]);
    const nextLevel=this.encounterStats?this.level:runtimeEnemyLevel(this.regionalLevel,progression.level,ascended,this.fixedLevel);
    if(this.hp>0&&(nextLevel!==this.level||ascended!==this.ascended)){
      if(ascended!==this.ascended&&this.boss){
        const profile=worldBossCombatProfile(this.boss.id,ascended);
        if(profile){this.bossCombat?.setProfile(profile);this.dragonCombat?.setProfile(profile);}
      }
      const fraction=this.hp/this.definition.hp;
      const base=scaledEnemy(this.authoredDefinition,nextLevel,ascended);
      this.definition=this.wolfAlpha?{...base,name:this.definition.name,hp:Math.round(base.hp*1.35),
        damage:Math.round(base.damage*1.12),xp:Math.round(base.xp*1.5),goldMax:Math.ceil(base.goldMax*1.25)}:base;
      this.hp=Math.max(1,Math.round(fraction*this.definition.hp));
      this.level=nextLevel;
      this.ascended=ascended;
      this.nameLabel.setText(this.displayName);
    }
    // Recover only after leaving combat, never during a chase or attack.
    // Paused scenes do not tick updateEnemy, so this is active-play time only.
    const playerDistance = Phaser.Math.Distance.Between(this.x,this.y,player.x,player.y);
    const territory=scene.canEnemyTargetPlayer(this);
    // Ascended bosses retain a committed fight across their longer tower move
    // ranges. Initial detection stays local; leaving the leash still disengages.
    const advancedPursuit=Boolean(this.boss&&this.ascended&&playerDistance<=900
      &&(this.bossAlerted||this.playerContributed&&time-this.lastDamagedAt<2000));
    const spotted=(scene.storyActor(this)||playerDistance<=this.definition.aggroRange||advancedPursuit)&&territory;
    this.bossAlerted=spotted;
    const encounterMode=this.encounterBehavior&&this.hp>0 ? scene.encounterDecision(this,time,spotted,territory) : null;
    // Dragon combat reaches beyond its initial detection radius. Its actual
    // arena engagement must also prevent passive healing/resolve resets.
    const pursuing = this.dragonCombat?this.dragonCombat.engagedWithPlayer:encounterMode ? encounterMode==='pursue' : spotted;
    if (pursuing) this.lastEngagedAt = time;
    if (this.hp>0 && !pursuing
      && playerDistance>this.definition.aggroRange*1.2
      && time-Math.max(this.lastDamagedAt,this.lastEngagedAt)>=12000
      && !this.attackTelegraph && !this.dragonCombat?.airborne) {
      if(this.hp<this.definition.hp){
        const healingRate=this.boss ? .008 : .02; // Bosses recover more slowly.
        this.hp=Math.min(this.definition.hp,
          this.hp+this.definition.hp*healingRate*Math.max(0,Math.min(delta,100))/1000);
      }
      // A full roar refill is not an encounter reset. Reset spent resolve only
      // after the existing twelve-second out-of-combat recovery condition.
      if(this.hp>=this.definition.hp&&this.bossPhase===2){this.bossCombat?.resetPhase();this.dragonCombat?.resetPhase();}
    }
    if(this.dragonCombat){this.dragonCombat.update(delta);return;}

    const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (!this.isAlive) {
      body.setVelocity(0, 0);
      this.updateVisual(time);
      return;
    }

    const sameFeet=Math.abs(this.x-this.occupancyX)<.1&&Math.abs(this.y-this.occupancyY)<.1;
    if(!sameFeet||time>=this.nextOccupancyCheckAt||Boolean(this.boss||this.encounterBehavior)){
      this.occupancyX=this.x;this.occupancyY=this.y;
      this.occupancyValid=scene.canEnemyOccupy(this.x,this.y,this);
      this.nextOccupancyCheckAt=time+200;
    }
    if (!this.occupancyValid) {
      this.bossCombat?.cancel();
      body.reset(this.lastSafe.x,this.lastSafe.y);
      body.setVelocity(0,0); this.nextWanderAt = 0;
      this.updateVisual(time);
      return;
    }

    const roadOpponent=scene.ambientOpponentFor(this);
    if(roadOpponent){
      this.lastEngagedAt=time;
      if(this.isStaggered)body.setVelocity(0,0);
      else if(time<this.lockedUntil){body.setVelocity(0,0);if(this.attackTelegraph||this.attackShade)this.updateAttackTelegraph(time);}
      else {
        this.facing.set(roadOpponent.x-this.x,roadOpponent.y-this.y).normalize();
        const gap=Math.hypot(roadOpponent.x-this.x,roadOpponent.y-this.y);
        if(gap<=Math.max(this.definition.attackRange,this.definition.attackRadius??0)){
          body.setVelocity(0,0);
          if(time>=this.nextAttackAt&&scene.hasClearPath(this.x,this.y,roadOpponent.x,roadOpponent.y))this.beginAttack(scene,roadOpponent,time);
        }else{
          const step=Math.min(22,gap),next={x:this.x+this.facing.x*step,y:this.y+this.facing.y*step};
          if(scene.canEnemyOccupy(next.x,next.y,this)&&scene.canTraverseGround(this,next))
            body.setVelocity(this.facing.x*this.definition.moveSpeed*.75*this.weaponStatus.movementMultiplier,
              this.facing.y*this.definition.moveSpeed*.75*this.weaponStatus.movementMultiplier);
          else body.setVelocity(0,0);
        }
      }
      this.setDepth(scene.playerRenderDepth(this.y));this.lastSafe={x:this.x,y:this.y};this.updateVisual(time);return;
    }

    if(this.bossCombat){
      const engaged=pursuing&&territory;
      this.bossCombat.update(delta,engaged);
      if(engaged||this.bossRegenerating){
        if(engaged&&!this.isStaggered&&!this.bossRegenerating)this.updateBossSkill(scene,time);
        if(this.bossRegenerating)body.setVelocity(0,0);
        this.lastSafe={x:this.x,y:this.y};
        this.setDepth(scene.playerRenderDepth(this.y));this.updateVisual(time);return;
      }
    }

    if (encounterMode && encounterMode !== 'pursue' && (this.attackTelegraph || this.attackShade || this.leapVisual)) {
      this.interruptAttack();
      if (!this.isStaggered) { this.lockedUntil=time;this.visualUntil=0; }
    }
    if (encounterMode==='return') {
      if (this.attackTelegraph || this.attackShade || this.leapVisual || time < this.lockedUntil) {
        this.interruptAttack();
        if (!this.isStaggered) { this.lockedUntil=time; this.visualUntil=0; }
      }
      if(this.isStaggered)body.setVelocity(0,0);
      else this.returnToEncounter(scene,body,delta);
      this.setDepth((this.scene as WorldScene).playerRenderDepth(this.y));this.lastSafe={x:this.x,y:this.y};this.updateVisual(time);return;
    }
    if(this.isStaggered){body.setVelocity(0,0);this.setDepth((this.scene as WorldScene).playerRenderDepth(this.y));this.updateVisual(time);return;}
    if (time < this.lockedUntil) {
      body.setVelocity(0, 0);
      if(this.attackTelegraph||this.attackShade)this.updateAttackTelegraph(time);
      this.setDepth((this.scene as WorldScene).playerRenderDepth(this.y));
      this.updateVisual(time);
      return;
    }

    if(pursuing&&territory) {
      if(time>=this.nextGrowlAt&&distance>Math.max(100,this.definition.attackRange)){
        scene.playEnemyVocal(this.definition,this.instanceId,'growl',this.x,this.y);
        this.nextGrowlAt=time+3600+this.rng()*2800;
      }
      this.facing.set(player.x - this.x, player.y - this.y).normalize();
      if(this.wolfPackId) {
        // Pack wolves spread around the player instead of all charging at one point.
        this.chaseAsPack(scene,player,time,delta,distance,body);
      } else {
        this.chaseWithAllies(scene,player,time,delta,body);
      }
      if(Math.abs(this.facing.x)>.2)this.setFlipX(this.facing.x<0);
      this.updateBossSkill(scene, time);
      if (distance <= Math.max(this.definition.attackRange, this.definition.attackRadius ?? 0) && time >= this.nextAttackAt
        && scene.hasClearPath(this.x, this.y, player.x, player.y)) {
        this.beginAttack(scene, player, time);
      }
    } else {
      // Field encounter groups stay together while roaming, like wolf siblings.
      // Authored ship posts/reinforcements keep their separate deck routines.
      const patrolLeader=this.encounterKey&&!this.wolfPackId?scene.enemyPatrolLeader(this):null;
      const alpha=this.wolfPackId&&!this.wolfAlpha?scene.wolfPackLeader(this.wolfPackId)
        :patrolLeader!==this?patrolLeader:null;
      const alphaDistance=alpha?Math.hypot(alpha.x-this.x,alpha.y-this.y):0;
      const homeDistance=this.bossHome?Math.hypot(this.x-this.bossHome.x,this.y-this.bossHome.y):0;
      if(this.bossHome&&homeDistance>180){
        // Keep idle bosses close to their clearings; pursuit remains unchanged.
        this.wander.set((this.bossHome.x-this.x)/homeDistance*this.definition.moveSpeed*.6,
          (this.bossHome.y-this.y)/homeDistance*this.definition.moveSpeed*.6);
        this.nextWanderAt=time+650;
      }else if(alpha&&alphaDistance>108&&alphaDistance<(this.wolfPackId?540:900)){
        this.wander.set((alpha.x-this.x)/alphaDistance*this.definition.moveSpeed*.68,
          (alpha.y-this.y)/alphaDistance*this.definition.moveSpeed*.68);
        this.nextWanderAt=time+850;
      }else if (time >= this.nextWanderAt) {
        this.nextWanderAt = time + 1600 + this.rng() * 2400;
        const angle = this.rng() * Math.PI * 2;
        // Rest between some roaming legs so idle art is an actual behavior,
        // not a walk cycle played while the creature stands still.
        const speed = this.rng() < .25 ? 0 : this.definition.moveSpeed * (0.25 + this.rng() * 0.3);
        this.wander.set(Math.cos(angle) * speed, Math.sin(angle) * speed);
      }
      const speed=this.wander.length(),ahead={x:this.x+this.wander.x/Math.max(1,speed)*24,y:this.y+this.wander.y/Math.max(1,speed)*24};
      // An already stationary wanderer should not raycast toward its feet.
      if(speed<.001&&body.velocity.lengthSq()<.01)body.setVelocity(0,0);
      else if(scene.canEnemyOccupy(ahead.x,ahead.y,this)&&scene.hasClearPath(this.x,this.y,ahead.x,ahead.y))
        body.setVelocity(approachVelocity(body.velocity.x,this.wander.x*this.weaponStatus.movementMultiplier,delta,120),approachVelocity(body.velocity.y,this.wander.y*this.weaponStatus.movementMultiplier,delta,120));
      else {body.setVelocity(0,0);this.nextWanderAt=time+1000;this.wander.set(0,0);}
    }
    if(!this.directionalCombat&&Math.abs(body.velocity.x)>Math.max(2,Math.abs(body.velocity.y)*.3)) this.setFlipX(body.velocity.x<0);
    this.setDepth((this.scene as WorldScene).playerRenderDepth(this.y));
    this.lastSafe = { x:this.x,y:this.y };
    this.updateVisual(time);
  }

  /** Reserve distinct attack approaches, then steer around nearby allied bodies.
   * Physical collisions remain the final safeguard; locked attackers never move. */
  private chaseWithAllies(scene:WorldScene,player:WorldScene['player'],time:number,
    delta:number,body:Phaser.Physics.Arcade.Body) {
    const actors=scene.enemySteeringActors();
    const radius=this.definition.bodyRadius??(this.definition.boss?24:11);
    // Melee attackers reserve different approaches; throwers use a separate
    // outer ring so they retain standoff/retreat rather than joining the pile.
    const ranged=this.isRangedAttacker;
    const ring=ranged?280:Math.max(30,this.definition.attackRange-8);
    if(time>=this.slotCheckAt){
      this.slotCheckAt=time+600;
      let best=-1,bestScore=Infinity;
      for(let slot=0;slot<8;slot++){
        const angle=slot*Math.PI/4,x=player.x+Math.cos(angle)*ring,y=player.y+Math.sin(angle)*ring;
        if(!scene.canEnemyOccupy(x,y,this)||!scene.hasClearPath(x,y,player.x,player.y))continue;
        let score=(x-this.x)**2+(y-this.y)**2;
        // Prefer an existing seat unless blocked or claimed by a nearby ally.
        if(slot===this.approachSlot)score-=1600;
        for(const other of actors){
          if(other===this||!other.active||other.hp<=0
            ||!other.canBeTargeted
            ||other.isRangedAttacker!==ranged
            ||Math.hypot(other.x-player.x,other.y-player.y)>ring+300)continue;
          if(other.approachSlot===slot)score+=1000000;
        }
        if(score<bestScore){bestScore=score;best=slot;}
      }
      this.approachSlot=best;
    }
    const angle=this.approachSlot*Math.PI/4;
    const target=this.approachSlot<0?player:
      {x:player.x+Math.cos(angle)*ring,y:player.y+Math.sin(angle)*ring};
    const waypoint=scene.enemyNavigationPoint(this,target);
    let dx=waypoint.x-this.x,dy=waypoint.y-this.y;
    const distance=Math.hypot(dx,dy);
    if(distance<1){
      // At a claimed station we must still be able to escape an overlap.
      dx=this.x-player.x;dy=this.y-player.y;
      const length=Math.max(1,Math.hypot(dx,dy));dx/=length;dy/=length;
      if(dx===0&&dy===0){dx=Math.cos(angle);dy=Math.sin(angle);}
    }else{dx/=distance;dy/=distance;}
    const tangentX=-dy,tangentY=dx;
    let lateral=0,crowded=false;
    for(const other of actors){
      if(other===this||!other.active||other.hp<=0
        ||!other.canBeTargeted)continue;
      const otherBody=other.body as Phaser.Physics.Arcade.Body;
      const rx=body.center.x-otherBody.center.x,ry=body.center.y-otherBody.center.y;
      const gap=radius+(other.definition.bodyRadius??(other.definition.boss?24:11))+18;
      const separation=Math.hypot(rx,ry);
      if(separation>=gap)continue;
      crowded=true;
      const side=rx*tangentX+ry*tangentY;
      const sign=Math.abs(side)>.5?Math.sign(side):this.instanceId<other.instanceId?1:-1;
      // Sideways avoidance doesn't cancel forward motion behind an attacker.
      lateral+=sign*(gap-separation)/gap*1.8;
    }
    const heading=Math.atan2(dy+tangentY*lateral,dx+tangentX*lateral);
    let steerX=0,steerY=0;
    if(distance<6&&!crowded){body.setVelocity(0,0);return;}
    for(const offset of ALLY_STEERING_OFFSETS){
      const sx=Math.cos(heading+offset),sy=Math.sin(heading+offset);
      const nextX=this.x+sx*24,nextY=this.y+sy*24;
      if(!scene.canEnemyOccupy(nextX,nextY,this)||!scene.hasClearPath(this.x,this.y,nextX,nextY))continue;
      let clear=true;
      for(const other of actors){
        if(other===this||!other.active||other.hp<=0
          ||!other.canBeTargeted)continue;
        const otherBody=other.body as Phaser.Physics.Arcade.Body;
        const current=Math.hypot(body.center.x-otherBody.center.x,body.center.y-otherBody.center.y);
        const next=Math.hypot(body.center.x+sx*24-otherBody.center.x,body.center.y+sy*24-otherBody.center.y);
        const gap=radius+(other.definition.bodyRadius??(other.definition.boss?24:11))+3;
        // Permit escape from an existing overlap, never deepen it.
        if(next<gap&&next<=current+1){clear=false;break;}
      }
      if(clear){steerX=sx;steerY=sy;break;}
    }
    const speed=Math.min(this.movementSpeed,Math.max(distance,crowded?12:0)*6);
    body.setVelocity(approachVelocity(body.velocity.x,steerX*speed,delta,90),
      approachVelocity(body.velocity.y,steerY*speed,delta,90));
  }

  private returnToEncounter(scene:WorldScene,body:Phaser.Physics.Arcade.Body,delta:number) {
    const station=this.encounterBehavior!.station,home=this.encounterBehavior!.home;
    const target=scene.canEnemyOccupy(station.x,station.y,this)?station:home;
    if (Math.hypot(target.x-this.x,target.y-this.y)<=40) {
      body.setVelocity(0,0);scene.encounterArrived(this);return;
    }
    const waypoint=scene.enemyNavigationPoint(this,target);
    const angle=Math.atan2(waypoint.y-this.y,waypoint.x-this.x);
    let vx=0,vy=0;
    // Bounded local steering, never teleport or cross a blocked foundation.
    for(const offset of [0,-.6,.6,-1.2,1.2]) {
      const dx=Math.cos(angle+offset),dy=Math.sin(angle+offset),x=this.x+dx*24,y=this.y+dy*24;
      if(scene.canEnemyOccupy(x,y,this)&&scene.hasClearPath(this.x,this.y,x,y)) {
        vx=dx*this.movementSpeed*.75;vy=dy*this.movementSpeed*.75;break;
      }
    }
    body.setVelocity(approachVelocity(body.velocity.x,vx,delta,90),approachVelocity(body.velocity.y,vy,delta,90));
  }

  /** Flank using persistent angular slots and short-range ally repulsion.
   * Wolves approach from different sides and lunge in overlapping, staggered
   * windows. Path checks still prevent movement through scenery/buildings. */
  private chaseAsPack(scene:WorldScene,player:WorldScene['player'],time:number,
    delta:number,distance:number,body:Phaser.Physics.Arcade.Body) {
    const members=scene.wolfPackMembers(this.wolfPackId!);
    if(this.wolfFlankSlot===null){
      // Alpha presses from the front; siblings occupy alternating flanks/rear.
      const ordinal=members.findIndex(member=>member.instanceId===this.instanceId);
      this.wolfFlankSlot=this.encounterBehavior?.slot ?? (this.wolfAlpha?0:Math.max(1,ordinal));
      const leader=members.find(member=>member.wolfAlpha)??this;
      this.wolfHuntBearing=Math.atan2(leader.y-player.y,leader.x-player.x);
    }
    const slot=this.wolfFlankSlot;
    const offsets=[0,-1.05,1.05,-2.1,2.1,Math.PI];
    const desiredBearing=this.wolfHuntBearing+offsets[slot%offsets.length];
    // Close in to strike only during each wolf's offset attack window;
    // withdrawing briefly creates space for packmates to circle and attack.
    const lunge=(time+slot*470)%2750<1460;
    const preferredRadius=lunge?(this.wolfAlpha?40:46):(this.wolfAlpha?64:74);
    let goalX=player.x+Math.cos(desiredBearing)*preferredRadius;
    let goalY=player.y+Math.sin(desiredBearing)*preferredRadius;
    let vx=goalX-this.x,vy=goalY-this.y;
    if(distance<185&&distance>1){
      const angle=Math.atan2(this.y-player.y,this.x-player.x);
      const diff=Math.atan2(Math.sin(desiredBearing-angle),Math.cos(desiredBearing-angle));
      // Travel around the outside of the player, not straight across center.
      const radial=Phaser.Math.Clamp((preferredRadius-distance)*1.15,-75,75);
      const tangent=Phaser.Math.Clamp(diff*distance*.82,-105,105);
      vx=Math.cos(angle)*radial-Math.sin(angle)*tangent;
      vy=Math.sin(angle)*radial+Math.cos(angle)*tangent;
    }
    // Lightweight pairwise separation. No physics collision solver or per-frame
    // tween allocations: even six wolves stay within the existing enemy cap.
    for(const other of scene.enemySteeringActors()){
      if(other===this||!other.active||other.hp<=0||!other.canBeTargeted)continue;
      let dx=this.x-other.x,dy=this.y-other.y;
      let dist=Math.hypot(dx,dy);
      const minGap=other.wolfPackId?(this.wolfAlpha||other.wolfAlpha)?75:62
        :(this.definition.bodyRadius??11)+(other.definition.bodyRadius??(other.definition.boss?24:11))+18;
      if(dist>=minGap)continue;
      if(dist<.1){const a=(slot+1)*2.4;dx=Math.cos(a);dy=Math.sin(a);dist=1;}
      const repel=(minGap-dist)/minGap*145;
      vx+=dx/dist*repel;
      vy+=dy/dist*repel;
    }
    const speed=Math.hypot(vx,vy);
    const velocity=speed<5?0:this.movementSpeed*(this.wolfAlpha?.97:1);
    const headingX=speed>0?vx/speed:0,headingY=speed>0?vy/speed:0;
    const canStep=(sx:number,sy:number)=>scene.canEnemyOccupy(this.x+sx*30,this.y+sy*30,this)
      &&scene.hasClearPath(this.x,this.y,this.x+sx*30,this.y+sy*30);
    let steerX=headingX,steerY=headingY;
    if(velocity>0&&!canStep(steerX,steerY)){
      // Attempt the two short tangents before giving up; never phase through walls.
      if(canStep(-headingY,headingX)){steerX=-headingY;steerY=headingX;}
      else if(canStep(headingY,-headingX)){steerX=headingY;steerY=-headingX;}
      else{steerX=0;steerY=0;}
    }
    const targetX=steerX*velocity,targetY=steerY*velocity;
    body.setVelocity(approachVelocity(body.velocity.x,targetX,delta,85),
      approachVelocity(body.velocity.y,targetY,delta,85));
  }

  private beginAttack(scene: WorldScene, player: WorldScene['player']|Npc, time: number) {
    const ambient=player!==scene.player;
    const windup = this.definition.attackWindupMs ?? 220;
    const recovery = this.definition.attackRecoveryMs ?? 320;
    const rate=this.attackSpeedMultiplier;
    const radius = this.definition.attackRadius ?? this.definition.attackRange;
    const ranged=this.isRangedAttacker;
    const attackAim={x:player.x,y:player.y};
    // Commit the target heading after steering, which may have faced a travel
    // lane or a retreat. Unit aim vectors must not use the walking dead zone.
    this.faceAttack(Math.atan2(player.y-this.y,player.x-this.x));
    const attackStyle = ranged?'melee':this.definition.combatStyle==='troll'?'slam':this.boss?.attackStyle ?? (isWolfFamily(this.definition.id) ? 'pounce' : 'melee');
    this.lockedUntil = time + (windup + recovery)/rate;
    this.nextAttackAt = this.lockedUntil + this.definition.attackCooldownMs/rate;
    this.attackTelegraph?.destroy();
    this.attackTelegraphStyle=attackStyle;
    this.attackTelegraphRadius=radius;
    this.attackTelegraphAngle=this.facing.angle();
    this.attackTelegraphStartedAt=time;
    this.attackTelegraphWindup=windup/rate;
    this.attackShade?.destroy();this.attackShade=new AttackTelegraph(scene,`attack-windup-fill:${this.instanceId}`,false);
    const layout=enemyAttackWarningLayout(attackStyle,radius,this.attackTelegraphAngle);
    this.attackTelegraph=null;
    if(!ranged)this.attackTelegraph=scene.add.image(this.x,this.y,ATTACK_WARNING_TEXTURE,layout.frame)
      .setOrigin(layout.originX,.5).setDisplaySize(layout.width,layout.height).setRotation(layout.rotation).setAlpha(.24)
      .setDepth(scene.playerRenderDepth(Math.min(this.y,player.y))-2)
      .setName(`attack-telegraph:${this.instanceId}`);
    const attackAnimation = enemyAnimation(this.definition.spriteFrame, 'attack',this.directionalCombat?this.visualDirection:undefined);
    const epoch=++this.attackEpoch;
    this.playMonsterVocal('attack');
    this.playMonsterAttackFoley('windup');
    this.nextGrowlAt=time+2800;
    this.playAction('attack');
    this.attackTimingActive=true;
    const windupClip=pirateAttackPhase(this.definition.spriteFrame,'windup');
    const recoveryClip=pirateAttackPhase(this.definition.spriteFrame,'recovery');
    if(windupClip){
      this.anims.play(windupClip.key);
      this.anims.timeScale=piratePhaseDuration(windupClip)/Math.max(1,windup)*rate;
    }else this.anims.timeScale=animationDuration(attackAnimation)/(windup+recovery)*rate;
    if(this.definition.combatStyle==='troll')this.anims.timeScale=(attackAnimation.frames.length-1)*1000/(attackAnimation.frameRate*windup)*rate;
    this.visualUntil=time+(windup+recovery)/rate;
    if (attackStyle === 'pounce' && this.definition.spriteFrame === 0) this.playWolfLeap(attackAnimation);
    if(this.leapTween)this.leapTween.timeScale=rate;
    this.attackWindup={delay:windup,elapsed:0,timeScale:rate,impact:() => {
      this.attackWindup=null;
      if(epoch!==this.attackEpoch)return;
      this.attackTelegraph?.destroy();
      this.attackTelegraph = null;
      this.attackShade?.destroy();this.attackShade=null;
      if (epoch!==this.attackEpoch || !this.active || !player.active
        ||(ambient?scene.ambientOpponentFor(this)!==player:!scene.canEnemyTargetPlayer(this))
        || useGameStore.getState().panel || useGameStore.getState().dialogue || useGameStore.getState().cinematic) return;
      if (!ambient&&this.encounterBehavior && scene.encounterDecision(this,scene.combatTime??scene.time.now,false,scene.canEnemyTargetPlayer(this))!=='pursue') {
        this.interruptAttack();return;
      }
      if(recoveryClip){
        this.anims.play(recoveryClip.key);
        this.anims.timeScale=piratePhaseDuration(recoveryClip)/Math.max(1,recovery)*this.attackSpeedMultiplier;
      }
      if(ranged){
        scene.fireOrcSpear(this,attackAim,ambient?player as Npc:null);
        scene.playAudio('sfx-sword-whoosh',.2,1.35);
        return;
      }
      if(this.definition.combatStyle==='troll'){
        const impact=scene.add.sprite(this.x,this.y,'effect_troll_impact',0).setOrigin(.5,actorArtLayout('effect_troll_impact').originY)
          .setScale(artScale('effect_troll_impact')*radius/40).setDepth(scene.playerRenderDepth(this.y)+1).play('effect-troll-impact');
        impact.once(Phaser.Animations.Events.ANIMATION_COMPLETE,()=>impact.destroy());scene.playAudio('sfx-heavy-slam',.3);
      }
      const strikeDistance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
      const toPlayer = new Phaser.Math.Vector2(player.x - this.x, player.y - this.y).normalize();
      const facingThreshold = attackStyle === 'slam' ? -1 : attackStyle === 'pounce' ? .35 : .6;
      if (strikeDistance > radius || this.facing.dot(toPlayer) < facingThreshold
        || !scene.hasClearPath(this.x, this.y, player.x, player.y)) return;
      this.playMonsterAttackFoley('impact');
      scene.playEffect('hit', player.x, player.y, toPlayer);
      if(ambient)scene.damageRoadNpc(player as Npc,this.definition.damage);
      else scene.damagePlayer(this.definition.damage);
    }};
  }

  private updateAttackTelegraph(time:number){
    const image=this.attackTelegraph;
    const progress=(this.attackWindup?Math.min(1,this.attackWindup.elapsed/Math.max(1,this.attackWindup.delay)):undefined)??Phaser.Math.Clamp((time-this.attackTelegraphStartedAt)/Math.max(1,this.attackTelegraphWindup),0,1);
    const depth=(this.scene as WorldScene).playerRenderDepth(Math.min(this.y,(this.scene as WorldScene).player.y))-2;
    this.attackShade?.draw({kind:this.isRangedAttacker?'line':this.attackTelegraphStyle==='slam'?'circle':'cone',x:this.x,y:this.y,
      angle:this.attackTelegraphAngle,radius:this.isRangedAttacker?12:this.attackTelegraphRadius,range:this.definition.attackRange,
      halfAngle:Math.acos(this.attackTelegraphStyle==='pounce'?.35:.6)},progress,depth);
    if(!image)return;
    const layout=enemyAttackWarningLayout(this.attackTelegraphStyle,this.attackTelegraphRadius,this.attackTelegraphAngle);
    image.setPosition(this.x,this.y+2).setDisplaySize(layout.width,layout.height).setRotation(layout.rotation)
      .setAlpha(.2+progress*.08+(progress>.78?Math.sin(time*.02)*.025:0))
      .setDepth((this.scene as WorldScene).playerRenderDepth(Math.min(this.y,(this.scene as WorldScene).player.y))-2);
  }

  private updateBossSkill(scene: WorldScene, time: number) {
    if (!this.definition.summonComposition?.length || time < this.nextSpecialAt) return;
    // Bounded retries only. The saved logical wave owns the initial delay,
    // survivor gate and post-final-defeat cooldown, not this disposable actor.
    this.nextSpecialAt=time+750;
    scene.tryBossSummonWave(this);
  }

  private magusSpell=false;
  /** Preserve the committed world heading; choose only the displayed facing. */
  faceAttack(angle:number){
    this.facing.set(Math.cos(angle),Math.sin(angle));
    this.visualDirection=actorViewAim(this.scene,this.facing.x,this.facing.y,this.visualDirection);
    if(!this.directionalCombat)this.setFlipX(actorViewFlip(this.scene,this.facing.x,this.facing.y,this.flipX));
  }
  /** Reviewed complete authored poses: challenge, chest-thump, raised arms or
   * open-mouth roar. Hold the pose; never play an un-warned strike as a roar. */
  playBossRoar(angle:number){
    this.faceAttack(angle);
    const species=this.definition.spriteFrame,row=['down','left','right','up'].indexOf(this.visualDirection);
    const attack=enemyAnimation(species,'attack',this.directionalCombat?this.visualDirection:undefined);
    this.useVisualTexture(attack.texture as ArtTextureKey);this.anims.stop();
    const frame=species===19?44+row*2
      :species===15||species===16?20+row*6+3
      :species===17||species===18?20+row*6
      :species===1?attack.frames[2]
      :species===4?attack.frames[3]
      :species===5||species===6?attack.frames[1]:attack.frames[0];
    this.setFrame(frame).setFlipX(this.directionalCombat?false:actorViewFlip(this.scene,this.facing.x,this.facing.y,this.flipX));
    this.attackTimingActive=false;this.visualUntil=this.combatTime+BOSS_PHASE_TWO_TRANSITION_MS;
  }
  playBossWindup(windup:number,recovery:number,angle:number,spell=false){
    this.faceAttack(angle);
    this.playAction('attack');
    if(this.definition.id==='grand-magus'){
      this.magusSpell=spell;const row=['down','left','right','up'].indexOf(this.visualDirection);
      this.anims.stop();this.setFlipX(false).setFrame(spell?44+row*2:20+row*6);
      this.attackTimingActive=true;this.visualUntil=this.combatTime+(windup+recovery)/this.attackSpeedMultiplier;return;
    }
    const animation=enemyAnimation(this.definition.spriteFrame,'attack',this.directionalCombat?this.visualDirection:undefined);
    const clip=pirateAttackPhase(this.definition.spriteFrame,'windup')??m14BossAttackPhase(this.definition.spriteFrame,this.visualDirection,'windup');
    if(clip){this.anims.play(clip.key);this.anims.timeScale=piratePhaseDuration(clip)/windup*this.attackSpeedMultiplier;}
    else this.anims.timeScale=animationDuration(animation)/(windup+recovery)*this.attackSpeedMultiplier;
    if(this.definition.combatStyle==='troll')this.anims.timeScale=(animation.frames.length-1)*1000/(animation.frameRate*windup)*this.attackSpeedMultiplier;
    this.attackTimingActive=true;this.visualUntil=this.combatTime+(windup+recovery)/this.attackSpeedMultiplier;
  }
  finishBossWindup(recovery:number,angle?:number){
    if(angle!==undefined){
      this.faceAttack(angle);
      this.playAction('attack');
      const animation=enemyAnimation(this.definition.spriteFrame,'attack',this.directionalCombat?this.visualDirection:undefined);
      this.anims.timeScale=animationDuration(animation)/Math.max(1,recovery)*this.attackSpeedMultiplier;
    }
    if(this.definition.id==='grand-magus'){
      const row=['down','left','right','up'].indexOf(this.visualDirection);
      this.anims.stop();this.setFrame(this.magusSpell?45+row*2:21+row*6);return;
    }
    const clip=pirateAttackPhase(this.definition.spriteFrame,'recovery')??m14BossAttackPhase(this.definition.spriteFrame,this.visualDirection,'recovery');
    if(clip){this.anims.play(clip.key);this.anims.timeScale=piratePhaseDuration(clip)/recovery*this.attackSpeedMultiplier;}
  }
  playBossImpact(radius:number){
    if(this.definition.combatStyle!=='troll')return;
    const scene=this.scene as WorldScene;
    const impact=scene.add.sprite(this.x,this.y,'effect_troll_impact',0).setOrigin(.5,actorArtLayout('effect_troll_impact').originY)
      .setScale(artScale('effect_troll_impact')*radius/40).setDepth(scene.playerRenderDepth(this.y)+1).play('effect-troll-impact');
    impact.once(Phaser.Animations.Events.ANIMATION_COMPLETE,()=>impact.destroy());scene.playAudio('sfx-heavy-slam',.3);
  }
  cancelBossWindup(){
    this.attackTimingActive=false;
    if(!this.isStaggered)this.visualUntil=0;
  }

  private updateVisual(time:number) {
    this.refreshActionView();
    if(this.bossCombat?.isAttacking)return;
    if (time < this.visualUntil) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const speed=body.velocity.length();
    let moving=speed>3;
    if(isPirateEnemy(this.definition.id)||this.definition.boss){
      if(speed>=8){this.pirateMoving=true;this.pirateStoppedAt=null;}
      else if(speed<2){
        this.pirateStoppedAt??=time;
        if(time-this.pirateStoppedAt>=90)this.pirateMoving=false;
      }else this.pirateStoppedAt=null;
      moving=this.pirateMoving;
    }
    this.playLocomotion(moving?'walk':'idle');
    this.anims.timeScale=moving?strideRate(speed,this.definition.moveSpeed):1;
  }

  private refreshActionView(){
    if(this.combatTime>=this.visualUntil&&!this.bossCombat?.isAttacking)return;
    if(!this.directionalCombat){
      const flipped=actorViewFlip(this.scene,this.facing.x,this.facing.y,this.flipX);
      this.setFlipX(flipped);this.leapVisual?.setFlipX(flipped);return;
    }
    const direction=actorViewAim(this.scene,this.facing.x,this.facing.y,this.visualDirection);
    if(direction===this.visualDirection)return;
    if(!this.anims.isPlaying){
      // Casts and roars deliberately hold a complete authored pose. Re-map
      // that pose on orbit without restarting the animation or combat clock.
      const frame=Number(this.frame.name),species=this.definition.spriteFrame;
      const row=['down','left','right','up'].indexOf(direction);
      if(species===19&&frame>=44&&frame<=51){
        this.setFrame(44+row*2+(frame-44)%2);this.visualDirection=direction;return;
      }
      const before=enemyAnimation(species,'attack',this.visualDirection),after=enemyAnimation(species,'attack',direction);
      const index=before.frames.indexOf(frame);
      if(index>=0&&after.frames[index]!==undefined){
        this.setFrame(after.frames[index]);this.visualDirection=direction;
      }
      return;
    }
    const animation=this.anims.currentAnim;
    if(!animation||!this.anims.isPlaying)return;
    const key=animation.key.replace(/:(down|left|right|up)(?=:|$)/,':'+direction);
    if(key===animation.key||!this.scene.anims.exists(key))return;
    const next=this.scene.anims.get(key),progress=this.anims.getProgress(),scale=this.anims.timeScale;
    this.visualDirection=direction;
    this.useVisualTexture(next.frames[0].textureKey as ArtTextureKey);
    this.anims.play(key);this.anims.setProgress(progress);this.anims.timeScale=scale;
  }

  playLocomotion(state:'idle'|'walk'){
    if(this.isRooted)state='idle';
    const body=this.body as Phaser.Physics.Arcade.Body;
    if(state==='walk'){this.visualDirection=actorViewTravel(this.scene,body.velocity.x,body.velocity.y,this.visualDirection);if(body.velocity.lengthSq()>9)this.facing.copy(body.velocity).normalize();}
    else this.visualDirection=actorViewAim(this.scene,this.facing.x,this.facing.y,this.visualDirection);
    const key=enemyLocomotionKey(this.definition.spriteFrame,state,this.visualDirection);
    const progress=this.anims.currentAnim?.key.includes(':walk:')?this.anims.getProgress():0;
    const crew=this.definition.id==='cutlass-pirate';
    if(crew&&this.anims.currentAnim?.key.includes(':walk:'))this.pirateWalkProgress=progress;
    const changed=this.anims.currentAnim?.key!==key;
    this.useVisualTexture(this.scene.anims.get(key).frames[0].textureKey as ArtTextureKey);
    const mirroredSide=this.definition.id==='salt-king'||this.definition.id==='cutlass-pirate'
      ||this.texture.key==='enemy_walk_dragon';
    this.setFlipX(!this.directionalCombat&&this.visualDirection==='left'&&(mirroredSide||this.texture.key===(this.definition.spriteTexture??'enemies'))).anims.play(key,true);
    if(changed&&state==='walk'&&progress>0)this.anims.setProgress(progress);
    else if(changed&&state==='walk'&&crew&&(this.visualDirection==='left'||this.visualDirection==='right'))
      this.anims.setProgress(this.pirateWalkProgress);
  }

  /** Different canvas padding must not move the collision feet or hit circle. */
  useVisualTexture(texture:ArtTextureKey){
    if(this.texture.key===texture)return;
    this.anims.stop();const sheet=ART_BY_KEY[texture];
    this.setTexture(texture,0).setOrigin(.5,actorArtLayout(texture).originY);
    const body=this.body as Phaser.Physics.Arcade.Body;
    const radius=this.definition.bodyRadius??(this.definition.boss?24:11);
    body.setCircle(radius/this.scaleX,sheet.frameWidth*sheet.density/2-radius/this.scaleX,
      this.originY*sheet.frameHeight*sheet.density-2*radius/this.scaleY);
    body.updateFromGameObject();
  }

  private playAction(state:EnemyAnimationState) {
    const directional=this.directionalCombat;
    const animation = enemyAnimation(this.definition.spriteFrame,state,directional?this.visualDirection:undefined);
    this.useVisualTexture(animation.texture as ArtTextureKey);
    this.setFlipX(directional?false:actorViewFlip(this.scene,this.facing.x,this.facing.y,this.flipX));
    this.visualUntil = this.combatTime + animationDuration(animation);
    this.anims.play(animation.key);
    this.anims.timeScale=1;
  }

  private playWolfLeap(animation: ReturnType<typeof enemyAnimation>) {
    if(this.isRooted)return;
    this.clearWolfLeap();
    const scene = this.scene as WorldScene;
    const arc = { height: 0 };
    this.leapShadow = scene.add.ellipse(this.x, this.y - 3, 34, 13, 0x090b0b, 0.34)
      .setDepth(scene.playerRenderDepth(this.y)-1).setName(`wolf-leap-shadow:${this.instanceId}`);
    this.leapVisual = scene.add.sprite(this.x, this.y, this.texture.key, this.frame.name)
      .setOrigin(this.originX, this.originY).setScale(this.scaleX, this.scaleY)
      .setFlipX(this.flipX).setDepth(scene.playerRenderDepth(this.y)+1).setName(`wolf-leap:${this.instanceId}`);
    onPlane(this.leapVisual,'upright',this);
    if(this.definition.spriteTint!==undefined)this.leapVisual.setTint(this.definition.spriteTint);
    this.setAlpha(0);
    this.leapVisual.play(animation.key);
    this.leapVisual.anims.timeScale=this.anims.timeScale;
    this.leapTween = scene.tweens.add({
      targets: arc, height: 26, duration: 190, ease: 'Sine.easeOut', yoyo: true,
      onUpdate: () => {
        if (!this.leapVisual?.active) return;
        this.leapVisual.setPosition(this.x, this.y - arc.height).setDepth(scene.playerRenderDepth(this.y)+arc.height);
        this.leapShadow?.setPosition(this.x, this.y - 3).setScale(1 + arc.height / 50, 1 - arc.height / 70);
      },
      onComplete: () => this.clearWolfLeap(),
    });
  }

  private clearWolfLeap() {
    this.leapTween?.stop();
    this.leapTween = null;
    this.leapVisual?.destroy();
    this.leapVisual = null;
    this.leapShadow?.destroy();
    this.leapShadow = null;
    if (this.active) this.setAlpha(1);
  }

  createDeathVisual() {
    const directional=this.directionalCombat;
    const animation = enemyAnimation(this.definition.spriteFrame,'death',directional?this.visualDirection:undefined);
    const effect = this.scene.add.sprite(this.x,this.y,animation.texture,animation.frames[0]).setScale(this.scaleX,this.scaleY)
      .setOrigin(.5,actorArtLayout(animation.texture as ArtTextureKey).originY).setFlipX(!directional&&(this.visualDirection==='left'||this.flipX)).setDepth(this.depth).setName(`enemy-death:${this.instanceId}`);
    if(this.definition.spriteTint!==undefined)effect.setTint(this.definition.spriteTint);
    effect.play(animation.key);
    if(directional){
      const scene=this.scene,worldFacing=this.facing.clone();let direction=this.visualDirection;
      const update=()=>{
        if(!effect.active||!effect.anims.isPlaying)return;
        const next=actorViewAim(scene,worldFacing.x,worldFacing.y,direction);if(next===direction)return;
        direction=next;const pose=enemyAnimation(this.definition.spriteFrame,'death',next),progress=effect.anims.getProgress();
        effect.play(pose.key);effect.anims.setProgress(progress);
      };
      scene.events.on(Phaser.Scenes.Events.POST_UPDATE,update);
      effect.once(Phaser.GameObjects.Events.DESTROY,()=>scene.events.off(Phaser.Scenes.Events.POST_UPDATE,update));
    }
    effect.once(Phaser.Animations.Events.ANIMATION_COMPLETE,() => effect.destroy());
    this.scene.time.delayedCall(animationDuration(animation) + 200,() => { if (effect.active) effect.destroy(); });
  }

  /** Flurry holds only reachable targets, releasing them when the cast ends,
   * is cancelled, or they leave its area. Damage pulses still play hurt poses. */
  setFlurrySuppressed(suppressed:boolean){
    if(this.bossRegenerating){this.flurrySuppressed=false;return;}
    if(suppressed&&this.poiseProfile?.resistFlurry)return;
    if(!this.active||this.hp<=0||this.flurrySuppressed===suppressed)return;
    if(suppressed&&!this.canBeTargeted)return;
    this.flurrySuppressed=suppressed;
    if(suppressed)this.stagger(true);
  }

  private interruptAttack(){
    this.attackEpoch++;
    this.attackWindup=null;this.attackTimingActive=false;
    this.attackTelegraph?.destroy();this.attackTelegraph=null;
    this.attackShade?.destroy();this.attackShade=null;
    this.bossCombat?.cancel();
    this.clearWolfLeap();
  }
  private stagger(forced:boolean){
    if(this.bossRegenerating)return false;
    const now=this.combatTime;
    if((!forced||this.poiseProfile?.resistFlurry)&&now<this.staggerImmuneUntil)return false;
    const directional=this.directionalCombat;
    const duration=animationDuration(enemyAnimation(this.definition.spriteFrame,'hurt',directional?this.visualDirection:undefined));
    this.hitStunUntil=now+duration;
    // A full hurt pose is followed by a real opportunity to retaliate.
    this.staggerImmuneUntil=this.hitStunUntil+(this.poiseProfile?.staggerRecoveryMs??(this.definition.combatStyle==='boatswain'?1800:this.isBossEncounter?1800:1000));
    this.lockedUntil=this.hitStunUntil;
    this.nextAttackAt=Math.max(this.nextAttackAt,this.hitStunUntil+150);
    this.interruptAttack();
    this.dragonCombat?.interruptForStagger(duration);
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0,0);
    this.playAction('hurt');
    return true;
  }

  takeDamage(amount: number, knockback: Phaser.Math.Vector2, options:{forceStagger?:boolean;nonLethal?:boolean;source?:'story-ally'|'ambient-ally'|'companion';weaponId?:string;procHitWeight?:number;impact?:'light'|'heavy'|'slam'}={}) {
    if (!Number.isFinite(amount)||amount<=0||!this.active || this.hp <= 0 || !this.canBeTargeted||this.bossRegenerating) return 0;
    const state=useGameStore.getState();
    const support=options.nonLethal||options.source==='story-ally'||options.source==='ambient-ally'||options.source==='companion';
    if(!support||options.source==='companion')this.playerContributed=true;
    if(!support)state.discoverCreature(this.definition.id,this.boss?.id);
    const armorPenetration=support?0:Math.min(.4,((state.attributes.strength??0)+(state.armorBonuses.allStats??0))*.01);
    const effectiveDefense=(this.definition.defense??0)*(1-armorPenetration);
    const damage=Math.max(1,Math.round((support?amount:luckDamage(amount,state.attributes,state.learnedSkills,state.armorBonuses)*this.weaponStatus.directDamageMultiplier)*(1-effectiveDefense)));
    const applied=options.nonLethal?Math.min(damage,Math.max(0,this.hp-1)):damage;
    if(applied<=0)return 0;
    const actualLoss=Math.min(applied,this.hp);
    this.hp=Math.max(0,this.hp-applied);
    if(this.hp<=0)this.depleteFirstForm();
    const scene=this.scene as WorldScene;
    if(!support)scene.player.absorbLifeFromHit(actualLoss);
    const impact=options.impact??'light';
    if(!support)scene.confirmedPlayerImpact(impact);
    if(!support)scene.targeting.engage(this);
    scene.playEnemyVocal(this.definition,this.instanceId,!this.isAlive?'death':'hurt',this.x,this.y);
    this.lastDamagedAt=this.combatTime;
    const fatal=!this.isAlive;
    if(fatal)this.ambientDefeat=options.source==='ambient-ally';
    // Small NPC support hits must not interrupt telegraphs or stun-lock a foe.
    const staggered=!support&&!fatal&&this.stagger(Boolean(options.forceStagger));
    if(fatal){this.clearRoots();this.interruptAttack();}
    const proc=options.weaponId?WEAPON_PROFILES[options.weaponId]?.proc:undefined;
    if(!fatal&&!this.bossRegenerating&&!support&&proc){
      // Damage over time is based on the attacker's effective weapon ATK,
      // not raw blade damage, enemy HP, or a multi-hit art's single tick.
      const weapon=enhancedWeapon(options.weaponId!,state.weaponUpgrades,state.awakenedWeapons);
      const stats=progressionStats(state.attributes,state.learnedSkills,state.armorBonuses);
      const attackPower=weapon.damage*stats.damageMultiplier*playerDamageGrowth(state.level)*WEAPON_STATUS_ATK_SCALE;
      const improvedProc={...awakenedProc(options.weaponId!,proc,state.awakenedWeapons),chance:enhancedProcChance(options.weaponId!,proc.chance,state.weaponUpgrades,state.attributes.luck,state.awakenedWeapons,state.armorBonuses.allStats??0)};
      if(this.weaponStatus.tryApply(improvedProc,attackPower,this.definition.id,this.isBossEncounter,Math.random,options.procHitWeight??1))
        this.syncStatusAttackSpeed(this.combatTime);
    }
    scene.playEffect('hit', this.x, this.y);
    const body = this.body as Phaser.Physics.Arcade.Body;
    // Flurry keeps its targets inside the sweep instead of knocking them out
    // of range while Leigneron is committed to the stationary animation.
    if ((staggered||fatal)&&!this.isRooted) {
      // A brief shove only on an accepted heavy stagger. Immunity, flurry
      // containment, bosses and airborne dragons retain their existing rules.
      if(staggered&&!fatal&&!support&&!this.definition.boss&&!options.forceStagger&&impact!=='light')
        scene.tryImpactKnockback(this,knockback,impact==='slam'?12:9);
      const force=fatal?70:options.forceStagger?0:this.boss?55:100;
      body.setVelocity(this.dragonCombat?0:knockback.x*force,
        this.dragonCombat?0:knockback.y*force);
    }
    this.hitFlashUntil=this.combatTime+70;this.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => this.applyStatusTint());
    if (fatal) (this.scene as WorldScene).handleEnemyDefeated(this);
    return applied;
  }
  createRetreatVisual(){this.dragonCombat?.createRetreatVisual();}

  updatePresentation(playerX: number, playerY: number, paused = false) {
    if(!this.active)return;
    this.dragonCombat?.pause(paused);
    if(paused)this.leapTween?.pause();else if(this.leapTween?.isPaused())this.leapTween.resume();
    if (paused) this.anims.pause(); else if (this.anims.isPaused) this.anims.resume();
    this.applyStatusTint();
    const distance = Phaser.Math.Distance.Between(playerX, playerY, this.x, this.y);
    const visible = this.isAlive && distance < 700 && (Boolean(this.definition.boss) || this.hp < this.definition.hp || distance < this.definition.aggroRange);
    const width = this.definition.boss ? 48 : this.definition.id === 'road-bandit' ? 35 : 30;
    const scene=this.scene as WorldScene;
    // Reject actors outside the camera before cached indicator sight checks.
    // A lock follows the airborne visual while hit eligibility stays separate.
    const trackedVisual=this.presentationLockVisual;
    const indicatorHeight=Math.max(30,(this.definition.bodyRadius??12)*2)+Math.max(0,this.y-trackedVisual.y)+this.presentationElevation;
    const eligible=!paused&&worldPointInView(scene,this.x,this.y,indicatorHeight,48)
      &&scene.targeting.indicatorEligible(this);
    if(!eligible){
      this.targetIndicator.setVisible(false);this.targetRing.setVisible(false);
      this.healthBar.setVisible(false);this.nameLabel.setVisible(false);return;
    }
    if(eligible){
      const story=useGameStore.getState();
      if(!story.cinematic&&(!Object.hasOwn(story.journal.creatures,this.definition.id)
        ||Boolean(this.boss&&!Object.hasOwn(story.journal.bosses,this.boss.id))))
        story.discoverCreature(this.definition.id,this.boss?.id);
    }
    const selected=eligible&&scene.targeting.selected===this;
    const model=this.dragonCombat?.visual??(this.leapVisual?.active?this.leapVisual:this);
    const bounds=(model.frame.customData as {visibleBounds?:{top:number;height:number}}).visibleBounds;
    const texture=this.texture.key as ArtTextureKey,sheet=ART_BY_KEY[texture];
    const visualHeight=artFrameSize(texture,Number(this.frame.name)).height*this.scaleY*sheet.density;
    const modelSheet=ART_BY_KEY[model.texture.key as keyof typeof ART_BY_KEY];
    const top=bounds?model.y+(bounds.top-model.originY*modelSheet.frameHeight)*model.scaleY*modelSheet.density-16
      :this.y-visualHeight-16;
    // Geometry lives in local coordinates. Animation/locomotion moves it without
    // re-tessellating. The floor ring follows feet independently of pose height.
    const depth=scene.playerRenderDepth(this.y);
    if(eligible){
      const size=selected?7:this.definition.boss?5:3,color=selected?0xffdf75:0xc18770;
      setDepthIfChanged(this.targetIndicator,depth+90).setPosition(this.x,top).setVisible(true);
      if(size!==this.indicatorSize||selected!==this.indicatorSelected){
        this.indicatorSize=size;this.indicatorSelected=selected;
        this.targetIndicator.clear().lineStyle(selected?2:1,0x26180e,.9).fillStyle(color,selected?1:.7);
        this.targetIndicator.fillTriangle(-size,-36,size,-36,0,-26);
      }
      if(selected){const ground=groundMarkerPosition(this);
        const w=Math.max(this.definition.boss?56:34,(this.definition.bodyRadius??0)*2.2),h=presentationView(scene)?w:Math.max(10,(this.definition.bodyRadius??0)*.45);
        setDepthIfChanged(this.targetRing,depth+90).setPosition(ground.x,ground.y);
        if(w!==this.ringWidth||h!==this.ringHeight){
          this.ringWidth=w;this.ringHeight=h;
          this.targetRing.clear().lineStyle(2,color,.9).strokeEllipse(0,0,w,h);
        }
      }
    }else this.targetIndicator.setVisible(false);
    this.targetRing.setVisible(selected);
    const showHealth=(visible||scene.targeting.lockedTarget===this)&&eligible;
    this.healthBar.setVisible(showHealth);
    if(showHealth)setDepthIfChanged(this.healthBar,depth+85).setPosition(this.x,top);
    // Phaser Text.setText can invalidate its backing canvas, even when the
    // displayed label is unchanged. Preserve the exact label and glyph style.
    const label=`${this.displayName}${this.weaponStatus.name?' · '+this.weaponStatus.name:''}`;
    if(this.nameLabel.text!==label)this.nameLabel.setText(label);
    setDepthIfChanged(this.nameLabel,depth+85).setPosition(this.x,top-4)
      .setVisible(showHealth);
    if (showHealth) {
      const fraction=Math.max(0,Math.min(1,this.hp/this.definition.hp)),color=this.definition.boss?0xd89557:0xbb6550;
      // DOT/refill HP changes every tick. The raster has finite pixels: redraw
      // only when a half-pixel of its fill actually changes, retaining a visible
      // sliver for a living target instead of uploading identical tiny canvases.
      const fillWidth=this.hp>0?Math.max(.5,Math.round(width*fraction*2)/2):0;
      const statusColor=this.weaponStatus.active?this.weaponStatus.color:null;
      if(fillWidth!==this.healthFillWidth||width!==this.healthWidth||color!==this.healthColor||statusColor!==this.healthStatusColor){
        this.healthFillWidth=fillWidth;this.healthWidth=width;this.healthColor=color;this.healthStatusColor=statusColor;
        this.healthBar.clear().fillStyle(0x16110c,.85).fillRoundedRect(-width/2-2,-1,width+4,6,2);
        this.healthBar.fillStyle(color,1).fillRect(-width/2,1,fillWidth,3);
        if(statusColor!==null)this.healthBar.fillStyle(statusColor,1).fillCircle(width/2+6,2,3);
      }
    }
  }
}

// LEIGHNERON_WOLF_PACKS_ROAD_BANDITS_V1

// LEIGHNERON_WOLF_FLANKING_AI_V1
