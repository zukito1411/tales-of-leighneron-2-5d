import Phaser from 'phaser';
import type {Enemy} from '../entities/Enemy';
import type {WorldScene} from '../scenes/WorldScene';
import {DRAGON_LAIR,inDragonArena} from '../../data/dragonLair';
import {artScale,actorArtLayout} from '../../data/art';
import {enemyAppearanceMultiplier} from '../../data/enemies';
import {VARKHUL_STALK_SPEED} from '../../data/varkhulArt';
import {enemyAnimation} from '../../data/animationPacks';
import {DragonBreathEffect} from './DragonBreathEffect';
import {DRAGON_BREATH,DRAGON_BREATH_HOP,breathPresentation,insideBreathCone,dragonMouth,dragonBreathDirection,dragonBreathStagingPoint} from './dragonBreath';
import {ATTACK_WARNING_FRAMES,ATTACK_WARNING_TEXTURE} from './attackWarning';
import {AttackTelegraph} from './AttackTelegraph';
import {bossPattern,VARKHUL_WORLD_PROFILE,type BossCombatProfile,type BossMove} from '../../data/bossCombatProfiles';
import {attackAreaContains,type AttackArea} from './attackWarning';
import {BossPhaseState,BOSS_PHASE_TWO_TRANSITION_MS} from './BossPhaseState';
import type {BossPhaseSnapshot} from '../types';
import {TOWER_ROUND_FLOOR} from '../../data/towerRoom';
import {BossSkillVisual} from './BossSkillVisual';
import {onPlane} from '../presentation25d/plane';
import {actorViewFlip} from './actorViewDirection';

type Phase='rest'|'stomp-windup'|'breath-windup'|'breath'|'flight'|'landing'|'recover';
const smooth=(value:number)=>{const p=Phaser.Math.Clamp(value,0,1);return p*p*(3-2*p);};
/** Local, delta-driven boss phases. Pause/dialogue stops gameplay updates;
 * no delayed damaging callbacks survive an unload or a defeated encounter. */
export class DragonCombat {
  private phase:Phase='rest';private age=0;private clock=0;private nextAttack=2500;private sequence=0;
  private readonly aim=new Phaser.Math.Vector2(1,0);
  private readonly warningArt:Phaser.GameObjects.Image;
  private readonly warningFill:AttackTelegraph;
  private readonly fire:DragonBreathEffect;
  private readonly flight:Phaser.GameObjects.Sprite;
  private readonly shadow:Phaser.GameObjects.Ellipse;
  private breathTick=0;
  private breathSoundPlayed=false;
  private flightStart={x:0,y:0};private landingPoint={...DRAGON_LAIR};
  private lastFlightX=0;private lastFlightY=0;
  private readonly flightAim=new Phaser.Math.Vector2(1,0);
  private flightPurpose:'slam'|'breath'='slam';
  private readonly effects:BossSkillVisual;
  private readonly home:{x:number;y:number};
  private readonly tower:boolean;
  private move:BossMove|null=null;
  private combo:readonly BossMove[]=[];private step=0;
  private readonly rage=new BossPhaseState();
  private roarPresented=false;
  private impactRadius=240;
  private aftershock:{area:AttackArea;age:number;windup:number;damage:number;fired:boolean}|null=null;
  private readonly aftershockWarning:AttackTelegraph;
  private breathRange:number=DRAGON_BREATH.range;
  private readonly breathOrigin=new Phaser.Math.Vector2();
  private readonly paintedMouth=new Phaser.Math.Vector2();
  private breathDirection=dragonBreathDirection(false);
  private breathFlipped=false;
  constructor(private readonly enemy:Enemy,private readonly scene:WorldScene,private currentProfile?:BossCombatProfile){
    const profile=currentProfile;
    this.tower=Boolean(profile&&enemy.instanceId.startsWith('dungeon-event:might-'));
    this.home=this.tower?scene.dungeonPoint(TOWER_ROUND_FLOOR):{...DRAGON_LAIR};
    this.nextAttack=this.tower?900:2500;
    this.effects=new BossSkillVisual(scene,'ember');
    this.warningFill=new AttackTelegraph(scene,'dragon-windup-fill:'+enemy.instanceId,false);
    this.aftershockWarning=new AttackTelegraph(scene,'dragon-aftershock:'+enemy.instanceId,false);
    this.warningArt=scene.add.image(enemy.x,enemy.y,ATTACK_WARNING_TEXTURE,ATTACK_WARNING_FRAMES.circle.name)
      .setOrigin(.5).setAlpha(0).setVisible(false).setName('dragon-warning:'+enemy.instanceId);
    this.fire=new DragonBreathEffect(scene,enemy.instanceId);
    this.flight=scene.add.sprite(enemy.x,enemy.y,'enemy_dragon_fly',0)
      .setOrigin(.5,actorArtLayout('enemy_dragon_fly').originY)
      .setScale(artScale('enemy_dragon_fly')*enemyAppearanceMultiplier(enemy.definition))
      .setVisible(false).setName('dragon-flight:'+enemy.instanceId);
    onPlane(this.flight,'upright',enemy);
    this.shadow=scene.add.ellipse(enemy.x,enemy.y,180,70,0x100909,.4).setVisible(false).setName('dragon-flight-shadow');
  }
  get profile(){return this.currentProfile??VARKHUL_WORLD_PROFILE;}
  // An airborne dragon finishes its existing landing before selecting the new
  // move set. Never replace a live flight controller or strand its collision.
  setProfile(profile:BossCombatProfile){this.currentProfile=profile;}
  get airborne(){return this.phase==='flight'||this.phase==='landing';}
  private get flightTravelMs(){return this.flightPurpose==='breath'?DRAGON_BREATH_HOP.travelMs:3200;}
  private get flightLandingMs(){return this.flightPurpose==='breath'?DRAGON_BREATH_HOP.landingMs:1100;}
  get engagedWithPlayer(){
    const p=this.scene.player;
    return p.active&&p.hp>0&&this.scene.combatAllowed&&(this.tower?this.scene.canEnemyTargetPlayer(this.enemy)
      :inDragonArena(p.x,p.y,80)&&Math.hypot(p.x-DRAGON_LAIR.x,p.y-DRAGON_LAIR.y)<1100);
  }
  get phaseNumber(){return this.rage.phase;}
  get regenerating(){return this.rage.transitioning;}
  get phaseSnapshot(){return this.rage.snapshot();}
  restorePhase(snapshot:BossPhaseSnapshot){this.rage.restore(snapshot);this.roarPresented=false;}
  resetPhase(){this.rage.reset();this.roarPresented=false;this.combo=[];this.step=0;}
  depleteFirstForm(){
    if(!this.rage.deplete(this.profile,this.enemy.hp))return false;
    this.leaveAir();this.enter('rest');this.effects.clear();this.clearAftershock();
    this.combo=[];this.step=0;this.sequence=0;this.move=null;this.roarPresented=false;
    return true;
  }
  get attackName(){return this.rage.transitioning?null:this.aftershock?'Sovereign aftershock':this.move&&this.phase!=='rest'&&this.phase!=='recover'?this.move.name:this.phase==='stomp-windup'?'Ember stomp':this.phase==='breath-windup'||this.phase==='breath'?'Ember breath':this.airborne?(this.flightPurpose==='breath'?'Ember reposition':'Skyfall landing'):null;}
  private get stompWindupMs(){return this.move?.dragonAction==='stomp'?this.move.windup:1000;}
  private get breathWindupMs(){return this.move?.dragonAction==='breath'?this.move.windup:DRAGON_BREATH.windupMs;}
  private get breathIgnitionAt(){return Math.max(0,this.breathWindupMs-220);}
  get windupFraction(){return this.rage.transitioning?null:this.aftershock?Math.min(1,this.aftershock.age/this.aftershock.windup):this.phase==='stomp-windup'?Math.min(1,this.age/this.stompWindupMs):this.phase==='breath-windup'?Math.min(1,this.age/this.breathWindupMs):this.phase==='flight'?this.age/(this.flightTravelMs+this.flightLandingMs):this.phase==='landing'?Math.min(1,(this.flightTravelMs+this.age)/(this.flightTravelMs+this.flightLandingMs)):null;}
  get visual():Phaser.GameObjects.Sprite{return this.airborne?this.flight:this.enemy;}
  pause(paused:boolean){if(!this.flight.active)return;if(paused)this.flight.anims.pause();else this.flight.anims.resume();}
  private enter(phase:Phase){
    if(this.phase==='flight'||this.phase==='landing')this.scene.stopDragonSound(this.enemy.instanceId,'flight');
    if(this.phase==='breath')this.scene.stopDragonSound(this.enemy.instanceId,'breath');
    this.phase=phase;this.age=0;this.warningArt.setVisible(false);this.warningFill.clear();this.fire.hide();if(phase==='breath')this.breathSoundPlayed=false;
  }
  private groundAnimation(state:'idle'|'walk'|'attack'){
    if(state==='attack'){this.enemy.useVisualTexture('enemy_dragon');this.enemy.play(enemyAnimation(this.enemy.definition.spriteFrame,state).key,true);}
    else this.enemy.playLocomotion(state);
    // A heavy one-second stalk. Match cadence to actual movement so patrols
    // and movement debuffs do not leave rapid feet beneath a slow body.
    const body=this.enemy.body as Phaser.Physics.Arcade.Body;
    this.enemy.anims.timeScale=state==='walk'?Phaser.Math.Clamp(body.velocity.length()/VARKHUL_STALK_SPEED,.1,1.35):1;
  }
  private leaveAir(){
    (this.enemy.body as Phaser.Physics.Arcade.Body).checkCollision.none=false;
    this.flight.setVisible(false);this.shadow.setVisible(false);this.enemy.setAlpha(1);
  }
  private inArena(x:number,y:number,padding=0){
    return this.tower?Math.hypot(x-this.home.x,y-this.home.y)<=TOWER_ROUND_FLOOR.radius-180+padding:inDragonArena(x,y,padding);
  }
  private clampTowerPoint(x:number,y:number){
    const dx=x-this.home.x,dy=y-this.home.y,length=Math.hypot(dx,dy);
    const scale=Math.min(1,(TOWER_ROUND_FLOOR.radius-300)/Math.max(1,length));
    return {x:this.home.x+dx*scale,y:this.home.y+dy*scale};
  }
  update(delta:number){
    const e=this.enemy,body=e.body as Phaser.Physics.Arcade.Body,player=this.scene.player;
    if(!e.isAlive||player.hp<=0||!player.active||!this.scene.combatAllowed){body.setVelocity(0,0);this.leaveAir();this.enter('rest');this.effects.clear();this.clearAftershock();this.combo=[];this.roarPresented=false;return;}
    const dt=Math.min(Math.max(0,delta),100)*(this.airborne?1:e.attackSpeedMultiplier);this.age+=dt;this.clock+=dt;
    this.effects.update(dt);
    const distance=Math.hypot(player.x-e.x,player.y-e.y);
    const engaged=this.engagedWithPlayer;
    if(!engaged&&this.phase!=='rest'){
      this.leaveAir();if(!e.isRooted)body.reset(this.home.x,this.home.y);this.enter('rest');this.effects.clear();this.clearAftershock();this.combo=[];this.nextAttack=this.clock+2500;
    }
    if(!engaged){
      if(this.combo.length||this.aftershock){this.combo=[];this.step=0;this.clearAftershock();this.effects.clear();}
      if(this.rage.transitioning){this.effects.endWindup();this.roarPresented=false;}
    }
    body.setVelocity(0,0);e.setDepth(this.scene.playerRenderDepth(e.y));
    if(e.isStaggered)return;
    if(this.rage.transitioning){
      if(engaged){
        if(!this.roarPresented){
          this.roarPresented=true;e.playBossRoar(Math.atan2(player.y-e.y,player.x-e.x));
          this.scene.playDragonSound(e.instanceId,'roar',e.x,e.y,Math.max(1,BOSS_PHASE_TWO_TRANSITION_MS*(1-(this.rage.progress??0))));
          if(this.rage.progress===0)this.scene.notify(this.profile.phaseTwo!.announcement);
          this.effects.begin(e,{kind:'circle',x:e.x,y:e.y,angle:0,radius:100});
        }
        this.effects.gather(this.rage.progress??0);
        const finished=this.rage.advance(dt);e.hp=this.rage.refillHp(e.definition.hp);
        if(finished){this.effects.endWindup();e.cancelBossWindup();this.roarPresented=false;this.nextAttack=this.clock+150;}
      }
      return;
    }
    this.updateAftershock(dt);
    if(this.phase==='rest'){
      const goal=engaged?{x:player.x,y:player.y}:{x:this.home.x+Math.cos(this.clock*.00018)*150,y:this.home.y+Math.sin(this.clock*.00018)*110};
      const waypoint=this.scene.enemyNavigationPoint(e,goal);
      const dx=waypoint.x-e.x,dy=waypoint.y-e.y,length=Math.hypot(dx,dy);
      if(length>(engaged?170:35)){
        const speed=e.movementSpeed*(2/3)*(engaged?1:.45);
        const vx=dx/length*speed,vy=dy/length*speed;
        const ahead={x:e.x+vx*.7,y:e.y+vy*.7};
        if(this.inArena(ahead.x,ahead.y)&&this.scene.canEnemyTravel(e,e,ahead)){
          // playLocomotion owns all four authored facings (including diagonal
          // hysteresis and the shared side-cycle mirror).
          body.setVelocity(vx,vy);this.groundAnimation('walk');
        }else {body.setVelocity(0,0);this.groundAnimation('idle');}
      }else this.groundAnimation('idle');
      if(engaged&&distance<650&&this.clock>=this.nextAttack&&this.scene.hasClearPath(e.x,e.y,player.x,player.y)){
        body.setVelocity(0,0);this.aim.set(player.x-e.x,player.y-e.y).normalize();
        if(this.aim.lengthSq()===0)this.aim.set(e.flipX?-1:1,0);
        e.useVisualTexture('enemy_dragon');
        e.faceAttack(this.aim.angle());
        e.playMonsterVocal('attack');
        e.playMonsterAttackFoley('windup');
        if(!this.combo.length){this.combo=bossPattern(this.profile,this.sequence,this.rage.phase===2?0:1);this.step=0;}
        this.move=this.combo[this.step];
        const action=this.move?.dragonAction;
        const choice=action==='flight'?2:action==='breath'?1:0;
        this.impactRadius=this.safeRadius(e.x,e.y,this.move.radius);
        if(choice===2)this.startFlight();
        else if(choice===0){this.enter('stomp-windup');this.scene.playDragonSound(e.instanceId,'roar',e.x,e.y,1000);e.anims.stop();e.setFrame(enemyAnimation(5,'attack').frames[1]);this.scene.notify('Varkhul raises his claws — leave the marked stomp circle!');}
        else this.startBreath();
      }
    }else if(this.phase==='stomp-windup'){
      e.faceAttack(this.aim.angle());
      this.drawCircle(e.x,e.y,this.impactRadius,this.age/this.stompWindupMs);
      if(this.age>=this.stompWindupMs){e.setFrame(enemyAnimation(5,'attack').frames[2]);this.slam(e.x,e.y,this.impactRadius,this.move?.damage??1);this.recover();}
    }else if(this.phase==='breath-windup'){
      // No upward roar in the breath windup. The open forward-facing release
      // pose is held before any visible ignition and throughout the flame.
      this.breathPose(this.age>=this.breathIgnitionAt?2:0);
      this.drawCone(false);
      if(this.age>=this.breathWindupMs){this.enter('breath');this.breathTick=DRAGON_BREATH.ignitionMs;this.breathPose(2);e.playMonsterVocal('growl');}
    }else if(this.phase==='breath'){
      this.drawCone(true);
      if(!this.breathSoundPlayed&&this.age>=DRAGON_BREATH.ignitionMs){
        this.breathSoundPlayed=true;
        this.scene.playDragonSound(e.instanceId,'breath',e.x,e.y,DRAGON_BREATH.burningMs+DRAGON_BREATH.fadeMs-DRAGON_BREATH.ignitionMs);
      }
      if(breathPresentation(this.age).damaging&&this.age>=this.breathTick){
        this.breathTick=this.age+350;
        // Match the marked triangle, including its far chord and rear edge.
        if(insideBreathCone(player.x-this.breathOrigin.x,player.y-this.breathOrigin.y,this.breathDirection.x,this.breathDirection.y,this.breathRange)
          &&this.scene.hasClearPath(this.breathOrigin.x,this.breathOrigin.y,player.x,player.y,e))
          this.scene.damagePlayer(Math.round(e.definition.damage*.38*(this.move?.damage??1)));
      }
      if(this.age>=DRAGON_BREATH.burningMs+DRAGON_BREATH.fadeMs)this.recover();
    }else if(this.phase==='flight'){
      const t=Math.min(1,this.age/this.flightTravelMs),breathHop=this.flightPurpose==='breath';
      const p=breathHop?smooth(t):t,arc=Math.sin(t*Math.PI),angle=t*Math.PI*2;
      let x=Phaser.Math.Linear(this.flightStart.x,this.landingPoint.x,p)+(breathHop?0:Math.cos(angle)*arc*(this.tower?90:220));
      let y=Phaser.Math.Linear(this.flightStart.y,this.landingPoint.y,p)+(breathHop?0:Math.sin(angle)*arc*(this.tower?70:160));
      if(this.tower&&!breathHop){
        const dx=x-this.home.x,dy=y-this.home.y;
        const scale=Math.min(1,(TOWER_ROUND_FLOOR.radius-300)/Math.max(1,Math.hypot(dx,dy)));
        // Ease inward during takeoff; never snap an edge-positioned dragon.
        const blend=smooth(p/.12);
        x=Phaser.Math.Linear(x,this.home.x+dx*scale,blend);
        y=Phaser.Math.Linear(y,this.home.y+dy*scale,blend);
      }
      body.reset(x,y);
      this.drawFlight(Math.min(1,t/.12)*60+arc*(breathHop?65:this.tower?30:110));
      this.drawCircle(this.landingPoint.x,this.landingPoint.y,this.impactRadius,this.age/(this.flightTravelMs+this.flightLandingMs));
      if(t>=1){
        body.reset(this.landingPoint.x,this.landingPoint.y);
        if(breathHop)this.breathPose(0);
        this.enter('landing');this.drawCircle(e.x,e.y,this.impactRadius,this.flightTravelMs/(this.flightTravelMs+this.flightLandingMs));
      }
    }else if(this.phase==='landing'){
      this.drawCircle(e.x,e.y,this.impactRadius,(this.flightTravelMs+this.age)/(this.flightTravelMs+this.flightLandingMs));
      this.drawFlight(60*(1-Math.min(1,this.age/this.flightLandingMs)));
      if(this.age>=this.flightLandingMs){
        this.leaveAir();
        if(this.flightPurpose==='breath'){
          // A single committed hop, not an endless player-tracking chase.
          // Recheck newly loaded blockers before restoring grounded combat.
          if(!this.safeBreathLanding(e.x,e.y)){
            const back=this.scene.canEnemyOccupy(this.flightStart.x,this.flightStart.y,e)?this.flightStart:this.home;
            body.reset(back.x,back.y);this.recover();
          }else this.commitBreath(this.breathFlipped);
        }else {this.slam(e.x,e.y,this.impactRadius,this.move?.damage??1.25);this.recover();}
      }
    }else if(this.phase==='recover'){
      this.groundAnimation('idle');if(this.age>=(this.move?.recovery??1100)&&!this.aftershock){
        this.enter('rest');this.step++;
        if(this.step<this.combo.length)this.nextAttack=this.clock+180;
        else {
          this.combo=[];this.step=0;this.sequence++;
          this.nextAttack=this.clock+this.profile.cooldown*(this.rage.phase===2?(this.profile.enrageCooldownMultiplier??1):1);
        }
      }
    }
  }
  private recover(){this.enter('recover');}
  private startBreath(){
    const e=this.enemy,p=this.scene.player;
    const preferred=Math.abs(p.x-e.x)<1?this.aim.x<0:p.x<e.x;
    // Do not commit a horizontal breath simply because the FEET are close.
    // First check the real release-mouth cone, including its height offset.
    for(const flipped of [preferred,!preferred]){
      const offset=this.releaseMouthOffset(flipped),origin={x:e.x+offset.x,y:e.y+offset.y};
      if(this.breathCanReach(origin,flipped)>0){this.commitBreath(flipped);return;}
    }
    // Bounded planning once per attack, not a world search or per-frame scan.
    if(e.isRooted){this.recover();return;}
    // Vertical alternatives accommodate the southern rim without changing the
    // mouth's authored axis or firing through the tower walls.
    for(const flipped of [preferred,!preferred]){
      const offset=this.releaseMouthOffset(flipped);
      for(const distance of [260,380,180])for(const vertical of [0,-80,-160]){
        const point=dragonBreathStagingPoint(p,offset,flipped,distance,vertical);
        if(!this.safeBreathLanding(point.x,point.y))continue;
        const origin={x:point.x+offset.x,y:point.y+offset.y};
        if(this.breathCanReach(origin,flipped)<=0)continue;
        this.breathFlipped=flipped;this.breathPose(0);
        this.impactRadius=(e.definition.bodyRadius??64)+16;
        this.launchFlight(point,'breath');
        this.scene.notify('Varkhul beats his wings and moves to your flank!');
        return;
      }
    }
    // No legal firing lane: use an already warned, authored dive rather than
    // an empty breath, an unsafe teleport or repeated homing hops.
    this.move={id:'ember-reposition-dive',name:'Ember descent',kind:'circle',radius:240,
      range:850,windup:4300,recovery:this.move?.recovery??1100,damage:this.move?.damage??1.15,dragonAction:'flight'};
    this.startFlight();
  }
  private releaseMouthOffset(flipped:boolean){
    const e=this.enemy,frame=this.scene.textures.get('enemy_dragon').get(enemyAnimation(5,'attack').frames[2]);
    const meta=frame.customData as {mouth?:{x:number;y:number};density?:number};
    if(meta.mouth){
      const density=meta.density??2;
      return {x:(flipped?-1:1)*(meta.mouth.x*density-.5*frame.realWidth)*e.scaleX,
        y:(meta.mouth.y*density-actorArtLayout('enemy_dragon').originY*frame.realHeight)*e.scaleY};
    }
    return dragonMouth(0,0,flipped,2*1.3*e.scaleX,2);
  }
  private breathCanReach(origin:{x:number;y:number},flipped:boolean){
    const p=this.scene.player,direction=dragonBreathDirection(flipped);
    if(!insideBreathCone(p.x-origin.x,p.y-origin.y,direction.x,direction.y)
      ||!this.scene.hasClearPath(origin.x,origin.y,p.x,p.y,this.enemy))return 0;
    const required=Math.abs(p.x-origin.x)/Math.cos(DRAGON_BREATH.halfAngle);
    const range=this.breathRangeAt(origin,flipped,Math.max(72,required));
    return insideBreathCone(p.x-origin.x,p.y-origin.y,direction.x,direction.y,range)?range:0;
  }
  private safeBreathLanding(x:number,y:number){
    const e=this.enemy,r=e.definition.bodyRadius??64;
    if(this.tower?Math.hypot(x-this.home.x,y-this.home.y)>TOWER_ROUND_FLOOR.radius-r-24:!inDragonArena(x,y,-r))return false;
    return this.scene.canEnemyOccupy(x,y,e)&&this.scene.canEnemyOccupy(x-r,y,e)
      &&this.scene.canEnemyOccupy(x+r,y,e)&&this.scene.canEnemyOccupy(x,y-r,e)&&this.scene.canEnemyOccupy(x,y+r,e);
  }
  private commitBreath(flipped:boolean){
    const e=this.enemy,offset=this.releaseMouthOffset(flipped);
    this.enter('breath-windup');
    this.breathFlipped=flipped;this.breathDirection=dragonBreathDirection(flipped);
    // Landing completes before a fresh FULL warning. From here the mouth,
    // direction and cone are fixed; dodging during the warning remains valid.
    this.breathOrigin.set(e.x+offset.x,e.y+offset.y);
    this.breathRange=this.breathRangeAt(this.breathOrigin,flipped);
    if(this.breathRange<=0){this.recover();return;}
    this.breathPose(0);
    this.scene.notify('Varkhul draws breath — move out of the fire cone!');
  }
  private breathPose(pose:number){
    this.enemy.useVisualTexture('enemy_dragon');
    this.enemy.anims.stop();this.enemy.anims.timeScale=1;
    this.enemy.setFrame(enemyAnimation(5,'attack').frames[pose]);
    this.enemy.faceAttack(dragonBreathDirection(this.breathFlipped).angle);
  }
  private breathRangeAt(origin:{x:number;y:number},flipped:boolean,minimum=72):number{
    if(!this.tower)return DRAGON_BREATH.range;
    // Fit the convex cone to the circular floor analytically BEFORE querying
    // static obstacles. Candidate planning never searches the whole world.
    const e=this.enemy,angle=dragonBreathDirection(flipped).angle,half=DRAGON_BREATH.halfAngle;
    const dx=origin.x-this.home.x,dy=origin.y-this.home.y,limit=TOWER_ROUND_FLOOR.radius-25;
    const squared=dx*dx+dy*dy;if(squared>=limit*limit)return 0;
    let maximum:number=DRAGON_BREATH.range;
    for(const offset of [-half,0,half]){
      const projection=dx*Math.cos(angle+offset)+dy*Math.sin(angle+offset);
      const exit=-projection+Math.sqrt(projection*projection+limit*limit-squared);
      maximum=Math.min(maximum,(exit-1)/(offset===0?Math.cos(half):1));
    }
    for(let range=maximum;range>=minimum;range-=18){
      const safe=[-half,0,half].every(offset=>{
        const distance=offset===0?range*Math.cos(half):range;
        const x=origin.x+Math.cos(angle+offset)*distance,y=origin.y+Math.sin(angle+offset)*distance;
        return Math.hypot(x-this.home.x,y-this.home.y)<=TOWER_ROUND_FLOOR.radius-25
          &&this.scene.hasClearPath(origin.x,origin.y,x,y,e);
      });
      if(safe)return range;
    }
    return 0;
  }
  private drawCircle(x:number,y:number,radius:number,progress:number){
    const fraction=Phaser.Math.Clamp(progress,0,1),pulse=fraction>.72?(1+Math.sin(this.age*.025))*.5:0;
    this.warningArt.setTexture(ATTACK_WARNING_TEXTURE,ATTACK_WARNING_FRAMES.circle.name).setOrigin(.5)
      .setPosition(x,y).setDisplaySize(radius*2,radius*2).setAlpha(.19+pulse*.06).setVisible(true)
      .setDepth(this.scene.playerRenderDepth(y)-2);
    this.warningFill.draw({kind:'circle',x,y,angle:0,radius},progress,this.scene.playerRenderDepth(y)-1,0xffa25c);
  }
  private drawCone(burning:boolean){
    const e=this.enemy,origin=this.breathOrigin,angle=this.breathDirection.angle,half=DRAGON_BREATH.halfAngle,r=this.breathRange;
    // Camera-facing art may mirror while the warned world cone stays fixed.
    // Register the visible release mouth independently from the damage origin.
    e.faceAttack(angle);
    const mouth=this.releaseMouthOffset(e.flipX);this.paintedMouth.set(e.x+mouth.x,e.y+mouth.y);
    const pulse=!burning&&this.age>this.breathWindupMs*.72?(1+Math.sin(this.age*.025))*.5:0;
    const warningWidth=r*Math.cos(half),warningHeight=2*r*Math.sin(half);
    this.warningArt.setTexture(ATTACK_WARNING_TEXTURE,ATTACK_WARNING_FRAMES.cone.name).setOrigin(0,.5)
      .setPosition(origin.x,origin.y).setDisplaySize(warningWidth,warningHeight).setRotation(angle)
      .setAlpha(burning?.13:.2+pulse*.05).setVisible(true).setDepth(this.scene.playerRenderDepth(e.y)-2);
    if(burning)this.warningFill.clear();
    else this.warningFill.draw({kind:'cone',x:origin.x,y:origin.y,angle,radius:r,halfAngle:half,flatEnd:true},this.age/this.breathWindupMs,this.scene.playerRenderDepth(e.y)-1,0xffa25c);
    const reach=r*Math.cos(half),depth=this.scene.playerRenderDepth(e.y)+180,ignition=this.breathIgnitionAt;
    if(burning)this.fire.show(origin,angle,reach,this.age,depth,false,e.y,e.x,this.paintedMouth);
    else if(this.age>ignition)this.fire.show(origin,angle,reach,this.age-ignition,depth,true,e.y,e.x,this.paintedMouth);
    else this.fire.hide();
  }
  private slam(x:number,y:number,radius:number,multiplier:number){
    const player=this.scene.player;
    if(Math.hypot(player.x-x,player.y-y)<=radius&&this.scene.hasClearPath(x,y,player.x,player.y))
      this.scene.damagePlayer(Math.round(this.enemy.definition.damage*multiplier));
    this.scene.shakeCombatCamera(170,.003);this.scene.playAudio('sfx-heavy-slam',.45);
    this.effects.impact({id:'dragon-impact'},{kind:'circle',x,y,radius,angle:0});
    const shock=this.move?.dragonAftershock;
    if(shock){
      const outer=this.safeRadius(x,y,shock.radius);
      this.aftershock={area:{kind:'ring',x,y,angle:0,radius:outer,innerRadius:Math.min(shock.innerRadius,outer*.7)},
        age:0,windup:shock.windup,damage:shock.damage,fired:false};
      this.aftershockWarning.draw(this.aftershock.area,0,this.scene.playerRenderDepth(y)-1,0xffa25c);
    }
  }
  private safeRadius(x:number,y:number,radius:number){
    return this.tower?Math.max(40,Math.min(radius,TOWER_ROUND_FLOOR.radius-Math.hypot(x-this.home.x,y-this.home.y)-24)):radius;
  }
  private updateAftershock(delta:number){
    const shock=this.aftershock;if(!shock)return;
    shock.age+=delta;const progress=Math.min(1,shock.age/shock.windup);
    this.aftershockWarning.draw(shock.area,progress,this.scene.playerRenderDepth(shock.area.y)-1,0xffa25c);
    if(shock.age>=shock.windup&&!shock.fired){
      shock.fired=true;this.effects.impact({id:'dragon-aftershock'},shock.area);
      const p=this.scene.player;
      if(attackAreaContains(shock.area,p.x,p.y)&&this.scene.hasClearPath(shock.area.x,shock.area.y,p.x,p.y,this.enemy))
        this.scene.damagePlayer(Math.round(this.enemy.definition.damage*shock.damage));
      this.scene.playAudio('sfx-heavy-slam',.35);
    }
    if(shock.fired)this.aftershockWarning.graphics.setAlpha(Math.max(0,1-(shock.age-shock.windup)/160));
    if(shock.age>=shock.windup+160)this.clearAftershock();
  }
  private clearAftershock(){if(!this.aftershock)return;this.aftershock=null;this.aftershockWarning.clear();this.aftershockWarning.graphics.setAlpha(1);}
  private startFlight(){
    if(this.enemy.isRooted){this.recover();return;}
    let dx=this.scene.player.x-this.home.x,dy=this.scene.player.y-this.home.y;
    const radius=Math.hypot(dx/900,dy/700);if(radius>.7){dx*=.7/radius;dy*=.7/radius;}
    let proposed={x:this.home.x+dx,y:this.home.y+dy};
    if(this.tower)proposed=this.clampTowerPoint(this.scene.player.x,this.scene.player.y);
    const point=this.scene.canEnemyOccupy(proposed.x,proposed.y,this.enemy)?proposed:{...this.home};
    this.impactRadius=this.safeRadius(point.x,point.y,this.move?.radius??240);
    this.launchFlight(point,'slam');
    this.scene.notify('Varkhul takes flight. Watch his landing circle!');
  }
  private launchFlight(point:{x:number;y:number},purpose:'slam'|'breath'){
    this.flightPurpose=purpose;this.flightStart={x:this.enemy.x,y:this.enemy.y};this.landingPoint={...point};
    this.lastFlightX=this.enemy.x;this.lastFlightY=this.enemy.y;
    this.flightAim.set(point.x-this.enemy.x,point.y-this.enemy.y);
    this.flight.setFlipX(this.enemy.flipX);
    this.enemy.anims.stop();this.enemy.anims.timeScale=1;
    this.enter('flight');this.enemy.setAlpha(1);
    this.scene.playDragonSound(this.enemy.instanceId,'flight',this.enemy.x,this.enemy.y,Math.min(2400,this.flightTravelMs));
    (this.enemy.body as Phaser.Physics.Arcade.Body).checkCollision.none=true;
    this.flight.setVisible(true).play('dragon-fly');this.shadow.setVisible(true);
    this.drawFlight(0);
  }
  private drawFlight(height:number){
    const dx=this.enemy.x-this.lastFlightX,dy=this.enemy.y-this.lastFlightY;
    if(Math.hypot(dx,dy)>1)this.flightAim.set(dx,dy);
    this.lastFlightX=this.enemy.x;this.lastFlightY=this.enemy.y;
    this.flight.setFlipX(actorViewFlip(this.scene,this.flightAim.x,this.flightAim.y,this.flight.flipX));
    // Turn toward the committed firing lane before the landing crossfade,
    // instead of revealing an oppositely facing ground pose at touchdown.
    if(this.flightPurpose==='breath'&&(this.phase==='landing'||this.age>=this.flightTravelMs*.8))
      this.flight.setFlipX(actorViewFlip(this.scene,this.breathFlipped?-1:1,0,this.flight.flipX));
    const alpha=this.phase==='landing'?smooth((this.flightLandingMs-this.age)/220):smooth(this.age/260);
    // Crossfade complete ground/flight poses rather than swapping them abruptly.
    this.enemy.setAlpha(1-alpha);
    this.flight.setPosition(this.enemy.x,this.enemy.y-height).setAlpha(alpha)
      .setDepth(this.scene.playerRenderDepth(this.enemy.y)+height+5);
    this.shadow.setPosition(this.enemy.x,this.enemy.y+2).setDepth(this.scene.playerRenderDepth(this.enemy.y)-1)
      .setScale(1+height/300,1-height/300).setAlpha(.4*alpha);
  }
  createRetreatVisual(){
    const e=this.enemy,visual=this.scene.add.sprite(e.x,e.y-40,'enemy_dragon_fly',0)
      .setOrigin(.5,actorArtLayout('enemy_dragon_fly').originY).setScale(this.flight.scaleX,this.flight.scaleY)
      .setDepth(e.y+600).setName('dragon-retreat').play('dragon-fly');
    onPlane(visual,'upright',{x:e.x,y:e.y});
    const soundId=`${e.instanceId}:retreat`;
    this.scene.playDragonSound(soundId,'flight',e.x,e.y,2800);
    visual.once(Phaser.GameObjects.Events.DESTROY,()=>this.scene.stopDragonSound(soundId,'flight'));
    this.scene.tweens.add({targets:visual,x:e.x+1100,y:e.y-1300,alpha:0,duration:2800,ease:'Sine.easeIn',onComplete:()=>visual.destroy()});
  }
  interruptForStagger(duration:number){
    if(this.airborne)return;
    // Cancel ground windups and live breath together with their warnings,
    // fire sprites and looped sound. Flight/landing remain untargetable.
    this.enter('rest');this.nextAttack=Math.max(this.nextAttack,this.clock+duration+150);
    this.effects.clear();this.clearAftershock();this.combo=[];this.step=0;
  }
  destroy(){this.scene.stopDragonSound(this.enemy.instanceId);this.effects.destroy();this.warningArt.destroy();this.warningFill.destroy();this.aftershockWarning.destroy();this.fire.destroy();this.flight.destroy();this.shadow.destroy();}
}
