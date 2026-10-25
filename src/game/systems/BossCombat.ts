import Phaser from 'phaser';
import type {Enemy} from '../entities/Enemy';
import type {WorldScene} from '../scenes/WorldScene';
import {bossPattern,type BossCombatProfile,type BossMove} from '../../data/bossCombatProfiles';
import {AttackTelegraph} from './AttackTelegraph';
import {attackAreaContains,windupProgress,type AttackArea} from './attackWarning';
import {MagusSpellVisual,magusSpellColor} from './MagusSpellVisual';
import {BossSkillVisual} from './BossSkillVisual';
import {BOSS_SKILL_BY_ENEMY} from '../../data/bossSkillEffects';
import {TOWER_ROUND_FLOOR} from '../../data/towerRoom';
import {BossPhaseState} from './BossPhaseState';
import type {BossPhaseSnapshot} from '../types';

interface CommittedZone {
  area:AttackArea;at:number;duration:number;fired:boolean;hit:boolean;expired:boolean;warning:AttackTelegraph;
  travelMs:number;swept:AttackArea|null;travel:number;
}
/** Bounded active-play state machine: no damaging timers survive cancellation,
 * death, a menu, loss of sight/territory, staggering or chunk unloading. */
export class BossCombat {
  private readonly rage=new BossPhaseState();
  private roarPresented=false;
  private phase:'ready'|'windup'|'charge'|'projectile'|'recovery'='ready';
  private clock=0;private age=0;private nextReady=900;private sequence=0;
  private combo:readonly BossMove[]=[];private step=0;
  private area:AttackArea|null=null;
  private readonly warning:AttackTelegraph;
  private chargeStart={x:0,y:0};private chargeTravel=0;private hit=false;
  private spellVisual:Phaser.GameObjects.Sprite|null=null;
  private spellTimer:Phaser.Time.TimerEvent|null=null;
  private magusVisual:MagusSpellVisual|null=null;
  private released=false;
  private readonly skillVisual:BossSkillVisual|null;
  private readonly zoneWarnings:AttackTelegraph[]=[];
  private readonly zones:CommittedZone[]=[];
  constructor(private readonly enemy:Enemy,private readonly scene:WorldScene,private currentProfile:BossCombatProfile){
    this.warning=new AttackTelegraph(scene,'boss-attack-fill:'+enemy.instanceId);
    const family=BOSS_SKILL_BY_ENEMY[enemy.definition.id];
    this.skillVisual=family?new BossSkillVisual(scene,family):null;
  }
  get profile(){return this.currentProfile;}
  setProfile(profile:BossCombatProfile){if(profile!==this.currentProfile){this.cancel();this.currentProfile=profile;}}
  get phaseNumber(){return this.rage.phase;}
  get regenerating(){return this.rage.transitioning;}
  get phaseSnapshot(){return this.rage.snapshot();}
  restorePhase(snapshot:BossPhaseSnapshot){this.rage.restore(snapshot);this.roarPresented=false;}
  resetPhase(){this.cancel();this.rage.reset();this.roarPresented=false;}
  depleteFirstForm(){
    if(!this.rage.deplete(this.profile,this.enemy.hp))return false;
    // Depleting a life ends its committed attacks too: no old projectile,
    // charge or delayed zone may damage the player during the refill.
    this.cancel();this.sequence=0;return true;
  }
  get attackName(){return this.rage.transitioning||this.phase==='ready'?null:this.combo[this.step]?.name??null;}
  get isAttacking(){return this.rage.transitioning||this.phase!=='ready';}
  get windupFraction(){return this.rage.transitioning?null:this.phase==='windup'?(this.zones.length?
    Math.min(1,this.age/(this.zones.find(zone=>!zone.fired)?.at??this.zones[0].at)):this.warning.progress):null;}
  update(delta:number,engaged:boolean){
    const e=this.enemy,body=e.body as Phaser.Physics.Arcade.Body,player=this.scene.player;
    const dt=Math.max(0,Math.min(100,delta))*e.attackSpeedMultiplier;
    this.magusVisual?.update(delta);
    this.skillVisual?.update(dt);
    this.clock+=dt;
    if(!engaged||!e.isAlive||!player.active||!this.scene.combatAllowed){this.cancel();return;}
    if(e.isStaggered){body.setVelocity(0,0);return;}
    if(this.rage.transitioning){
      if(!this.roarPresented){
        this.roarPresented=true;e.playBossRoar(Math.atan2(player.y-e.y,player.x-e.x));
        e.playMonsterVocal('growl');if(this.rage.progress===0)this.scene.notify(this.profile.phaseTwo!.announcement);
        this.skillVisual?.begin(e,{kind:'circle',x:e.x,y:e.y,angle:0,radius:80});
      }
      body.setVelocity(0,0);this.skillVisual?.gather(this.rage.progress??0);
      const finished=this.rage.advance(dt);e.hp=this.rage.refillHp(e.definition.hp);
      if(finished){
        this.skillVisual?.endWindup();e.cancelBossWindup();this.nextReady=this.clock+150;
        this.roarPresented=false;
      }
      return;
    }
    this.age+=dt;
    const patternHealth=this.profile.phaseTwo?(this.rage.phase===2?0:1):e.hp/e.definition.hp;
    if(!this.combo.length){this.combo=bossPattern(this.profile,this.sequence,patternHealth);this.step=0;}
    // Alternate close defence with the actual spell rotation. Staying nearby
    // must not pin the Magus to the same staff strike for the whole encounter.
    if(this.phase==='ready'&&this.profile.closeMove){
      if(this.sequence%2===0&&Math.hypot(player.x-e.x,player.y-e.y)<=(this.profile.closeRange??0)){
        this.combo=[this.profile.closeMove];this.step=0;
      }else if(this.combo[0]===this.profile.closeMove){this.combo=bossPattern(this.profile,this.sequence,patternHealth);this.step=0;}
    }
    const move=this.combo[this.step];
    if(this.phase==='ready'){
      this.approach(move,dt);
      const distance=Math.hypot(player.x-e.x,player.y-e.y);
      if(this.clock>=this.nextReady&&distance<=move.range&&this.scene.hasClearPath(e.x,e.y,player.x,player.y))this.begin(move);
      return;
    }
    body.setVelocity(0,0);
    if(this.phase==='windup'){
      if(move.zones){this.updateZones(move);return;}
      const progress=windupProgress(this.age,move.windup);
      this.warning.draw(this.area!,progress,this.warningDepth,magusSpellColor(move,this.profile.color));
      if(move.spell&&progress>=.7&&!this.released){this.released=true;e.finishBossWindup(move.recovery);}
      this.magusVisual?.windup(e,move,progress);
      this.skillVisual?.gather(progress);
      if(this.age<move.windup)return;
      e.finishBossWindup(move.recovery);
      if(move.projectileMs){this.magusVisual?.release(e);this.phase='projectile';this.age=0;this.chargeTravel=0;return;}
      if(move.chargeMs){this.skillVisual?.beginCharge(e,this.area!);this.phase='charge';this.age=0;this.chargeTravel=0;return;}
      this.impact(move);this.phase='recovery';this.age=0;
    }else if(this.phase==='projectile'){
      const area=this.area!,range=area.range??0,p=windupProgress(this.age,move.projectileMs!);
      const travel=range*p,previous=this.chargeTravel;
      this.magusVisual?.travel(p,area);
      // The same capsule as the warning, swept only over the distance actually
      // travelled this frame. Players farther down the lane are not hit early.
      const swept:AttackArea={...area,x:area.x+Math.cos(area.angle)*previous,
        y:area.y+Math.sin(area.angle)*previous,range:travel-previous};
      if(!this.hit&&attackAreaContains(swept,player.x,player.y)
        &&this.scene.hasClearPath(swept.x,swept.y,player.x,player.y,e)){
        this.hurtPlayer(move);
        this.magusVisual?.impact(move,{...area,kind:'circle',x:player.x,y:player.y-32,radius:60});
        e.playMonsterAttackFoley('impact');this.phase='recovery';this.age=0;return;
      }
      this.chargeTravel=travel;
      this.warning.draw(area,1,this.warningDepth,magusSpellColor(move,this.profile.color));
      if(p>=1){
        this.magusVisual?.impact(move,{...area,kind:'circle',x:area.x+Math.cos(area.angle)*range,
          y:area.y+Math.sin(area.angle)*range-32,radius:60});
        e.playMonsterAttackFoley('impact');this.phase='recovery';this.age=0;
      }
    }else if(this.phase==='charge'){
      if(e.isRooted){this.phase='recovery';this.age=0;this.skillVisual?.endCharge();return;}
      const range=this.area!.range??0;
      const travel=range*windupProgress(this.age,move.chargeMs!);
      // Short swept steps constrain both collision and damage during a charge.
      // A blocked wall/ship edge stops the charge; no body.reset teleport through it.
      while(this.chargeTravel<travel){
        const next=Math.min(travel,this.chargeTravel+12),a=this.area!.angle;
        const x=this.chargeStart.x+Math.cos(a)*next,y=this.chargeStart.y+Math.sin(a)*next;
        if(!this.scene.canEnemyOccupy(x,y,e)||!this.scene.hasClearPath(e.x,e.y,x,y,e)){
          this.phase='recovery';this.age=0;break;
        }
        body.reset(x,y);this.chargeTravel=next;
        if(!this.hit&&Math.hypot(player.x-e.x,player.y-e.y)<=move.radius
          &&this.scene.hasClearPath(e.x,e.y,player.x,player.y))this.hurtPlayer(move);
      }
      this.warning.draw(this.area!,1,this.warningDepth,this.profile.color);
      this.skillVisual?.followCharge(e,this.area!);
      if(this.phase==='charge'&&this.age>=move.chargeMs!){this.phase='recovery';this.age=0;}
      if(this.phase==='recovery')this.skillVisual?.endCharge();
    }else{
      if(!move.zones&&this.age<150)this.warning.draw(this.area!,1,this.warningDepth,magusSpellColor(move,this.profile.color));
      else this.warning.clear();
      if(this.age<move.recovery)return;
      this.step++;
      if(this.step<this.combo.length){
        const followup=this.combo[this.step];
        if(Math.hypot(player.x-e.x,player.y-e.y)<=followup.range&&this.scene.hasClearPath(e.x,e.y,player.x,player.y)){
          this.begin(followup);return;
        }
      }
      this.sequence++;this.combo=[];this.phase='ready';this.age=0;
      const enraged=this.profile.phaseTwo?this.rage.phase===2:e.hp/e.definition.hp<=(this.profile.enrageAt??.5);
      this.nextReady=this.clock+this.profile.cooldown*(enraged?(this.profile.enrageCooldownMultiplier??1):1);this.warning.clear();
    }
  }
  private begin(move:BossMove){
    this.clearZones();
    this.clearSpell(false);this.released=false;
    const e=this.enemy,player=this.scene.player,body=e.body as Phaser.Physics.Arcade.Body;
    const angle=Math.atan2(player.y-e.y,player.x-e.x);
    this.area={kind:move.kind,x:move.target?player.x:e.x,y:move.target?player.y:e.y,angle,
      radius:move.radius,range:move.range,innerRadius:move.innerRadius,halfAngle:move.halfAngle};
    this.fitTowerArea(this.area);
    if(move.kind==='line'){
      // Validate the advertised lane before drawing it, then validate it again
      // while travelling in case an actor or collision has changed. Spell
      // lanes also stop at walls instead of sending artwork into the void.
      this.clipLane(this.area,move.range);
    }
    this.chargeStart={x:e.x,y:e.y};this.hit=false;this.phase='windup';this.age=0;
    if(move.zones){
      // Authoring and runtime both cap simultaneous areas. Geometry is prepared
      // once per commitment, not re-aimed or allocated during frame updates.
      for(const [i,spec] of move.zones.slice(0,6).entries()){
        const a=this.area,forward=spec.forward??0,side=spec.side??0;
        const area:AttackArea={...a,kind:spec.kind??a.kind,radius:spec.radius??a.radius,
          innerRadius:spec.innerRadius??a.innerRadius,angle:a.angle+(spec.angleOffset??0),
          x:a.x+Math.cos(angle)*forward-Math.sin(angle)*side,
          y:a.y+Math.sin(angle)*forward+Math.cos(angle)*side};
        this.fitTowerArea(area);
        if(!e.instanceId.startsWith('dungeon-event:might-')&&(area.kind==='circle'||area.kind==='line'))this.fitGroundOrigin(area);
        if(area.kind==='line')this.clipLane(area,move.range);
        this.zoneWarnings[i]??=new AttackTelegraph(this.scene,'boss-zone:'+e.instanceId+':'+i,false);
        this.zones.push({area,at:move.windup+Math.max(0,spec.delay),duration:Math.max(140,spec.lingerMs??0,spec.travelMs??0),
          fired:false,hit:false,expired:false,warning:this.zoneWarnings[i],travelMs:spec.travelMs??0,
          swept:spec.travelMs?{...area,kind:'line',range:0}:null,travel:0});
      }
      this.warning.clear();
    }
    body.setVelocity(0,0);
    e.playBossWindup(move.windup,move.recovery+(move.chargeMs??0),angle,move.presentation==='cast');
    e.playMonsterVocal('attack');e.playMonsterAttackFoley('windup');
    if(move.spell){
      this.magusVisual??=new MagusSpellVisual(this.scene);
      if(move.projectileMs){this.magusVisual.alignProjectileLane(e,this.area,player);this.clipLane(this.area,move.range);}
      this.magusVisual.begin(e,move,this.area);
    }
    else this.skillVisual?.begin(e,this.area);
    if(!move.zones)this.warning.draw(this.area,0,this.warningDepth,magusSpellColor(move,this.profile.color));
  }
  private fitTowerArea(area:AttackArea){
    if(!this.enemy.instanceId.startsWith('dungeon-event:might-')||(area.kind!=='circle'&&area.kind!=='ring'))return;
    const centre=this.scene.dungeonPoint(TOWER_ROUND_FLOOR),dx=area.x-centre.x,dy=area.y-centre.y;
    const distance=Math.hypot(dx,dy);
    if(area.kind==='ring'){
      // Keep a boss-centred hollow ring centred on that boss. Constrain its
      // entire footprint at commitment, including its advertised safe pocket.
      const scale=Math.min(1,Math.max(1,TOWER_ROUND_FLOOR.radius-distance-24)/area.radius);
      area.radius*=scale;if(area.innerRadius!==undefined)area.innerRadius*=scale;
    }else{
      const scale=Math.min(1,Math.max(0,TOWER_ROUND_FLOOR.radius-area.radius-24)/Math.max(1,distance));
      area.x=centre.x+dx*scale;area.y=centre.y+dy*scale;
    }
  }
  private clipLane(area:AttackArea,range:number){
    let length=0,previousX=area.x,previousY=area.y;
    if(!this.scene.canEnemyOccupy(previousX,previousY,this.enemy)){area.range=0;return;}
    for(let distance=12;distance<=range;distance+=12){
      const x=area.x+Math.cos(area.angle)*distance,y=area.y+Math.sin(area.angle)*distance;
      // Check each short segment once, rather than rescanning every earlier
      // segment from the origin (especially expensive on the ship's deck).
      if(!this.scene.canEnemyOccupy(x,y,this.enemy)||!this.scene.hasClearPath(previousX,previousY,x,y,this.enemy))break;
      length=distance;previousX=x;previousY=y;
    }
    area.range=length;
  }
  private fitGroundOrigin(area:AttackArea){
    const e=this.enemy,dx=area.x-e.x,dy=area.y-e.y;
    // Fixed, local commitment-time probes keep offset traps/batteries off water,
    // walls and scenery. Never search or navigate the world from the FX loop.
    for(let step=5;step>=0;step--){
      const fraction=step/5,x=e.x+dx*fraction,y=e.y+dy*fraction;
      if(this.scene.canEnemyOccupy(x,y,e)&&this.scene.hasClearPath(e.x,e.y,x,y,e)){
        area.x=x;area.y=y;return;
      }
    }
    area.x=e.x;area.y=e.y;
  }
  private updateZones(move:BossMove){
    const color=magusSpellColor(move,this.profile.color),player=this.scene.player;
    let finished=true;
    const progress=windupProgress(this.age,move.windup);
    this.skillVisual?.gather(progress);
    if(move.spell){
      if(progress>=.7&&!this.released){this.released=true;this.enemy.finishBossWindup(move.recovery);}
      this.magusVisual?.windup(this.enemy,move,progress);
    }
    for(const zone of this.zones){
      if(zone.expired)continue;
      const age=this.age-zone.at;
      if(age>=zone.duration&&!zone.travelMs){zone.expired=true;zone.warning.clear();continue;}
      if(age<zone.duration)finished=false;
      zone.warning.draw(zone.area,windupProgress(this.age,zone.at),this.warningDepth,color);
      // A solid filled warning remains under lingering roots/ice. Retire its
      // final 140 ms with the artwork instead of silently leaving damage behind.
      zone.warning.graphics.setAlpha(age<0?1:Math.max(0,Math.min(1,(zone.duration-age)/140)));
      if(age<0)continue;
      if(!zone.fired){
        zone.fired=true;
        this.enemy.finishBossWindup(move.recovery,zone.area.angle);
        if(zone.travelMs){this.enemy.playMonsterAttackFoley('impact');this.skillVisual?.projectile(zone.area,zone.travelMs,age);}
        else this.impact(move,zone.area,zone.duration);
      }
      let hitArea=zone.area;
      if(zone.swept){
        const travelled=(zone.area.range??0)*windupProgress(Math.min(age,zone.duration),zone.travelMs);
        hitArea=zone.swept;hitArea.x=zone.area.x+Math.cos(zone.area.angle)*zone.travel;
        hitArea.y=zone.area.y+Math.sin(zone.area.angle)*zone.travel;hitArea.range=travelled-zone.travel;zone.travel=travelled;
      }
      if(!zone.hit&&attackAreaContains(hitArea,player.x,player.y)
        &&this.scene.hasClearPath(this.enemy.x,this.enemy.y,zone.area.x,zone.area.y,this.enemy)
        &&this.scene.hasClearPath(hitArea.x,hitArea.y,player.x,player.y,this.enemy)){
        this.hit=false;this.hurtPlayer(move,zone.area.angle);zone.hit=true;
      }
      if(age>=zone.duration){
        zone.expired=true;zone.warning.clear();
        if(zone.travelMs){
          const area=zone.area,range=area.range??0;
          this.skillVisual?.impact(move,{kind:'circle',x:area.x+Math.cos(area.angle)*range,
            y:area.y+Math.sin(area.angle)*range,angle:area.angle,radius:area.radius*1.2});
        }
      }
    }
    if(finished){this.clearZones();this.phase='recovery';this.age=0;}
  }
  private clearZones(){for(const warning of this.zoneWarnings){warning.clear();warning.graphics.setAlpha(1);}this.zones.length=0;}
  private impact(move:BossMove,area=this.area!,duration=0){
    const e=this.enemy,player=this.scene.player;
    e.playMonsterAttackFoley('impact');
    if(!this.skillVisual)e.playBossImpact(area.radius);
    if(move.spell)this.magusVisual?.impact(move,area);
    else if(this.skillVisual)this.skillVisual.impact(move,area,duration);
    else if(e.definition.id==='grand-magus'){
      // Staff contact uses the Magus's own authored shadow art, without a
      // projectile or a cast-hand lookup on his melee animation frames.
      this.magusVisual??=new MagusSpellVisual(this.scene);
      this.magusVisual.impact({...move,spell:'shadow'},{...area,kind:'circle',
        x:area.x+Math.cos(area.angle)*area.radius*.45,y:area.y+Math.sin(area.angle)*area.radius*.45,radius:area.radius*.5});
    }
    else if(move.presentation==='cast'){
      // Reuse the finished rune artwork, not a new procedural spell renderer.
      // Visuals do not own damage: the warned area below remains authoritative.
      this.clearSpell();
      const rune=this.spellVisual=this.scene.add.sprite(area.x,area.y,'effect_teleport',0).setTint(this.profile.color)
        .setDisplaySize(area.radius*2,area.radius*2).setDepth(this.scene.playerRenderDepth(area.y)+1).play('effect-teleport');
      rune.once(Phaser.Animations.Events.ANIMATION_COMPLETE,()=>{if(this.spellVisual===rune)this.clearSpell();});
      this.spellTimer=this.scene.time.delayedCall(500,()=>{if(this.spellVisual===rune)this.clearSpell();});
    }
    if(!move.spell&&!this.skillVisual&&e.definition.id!=='grand-magus'){const ring=this.scene.add.circle(area.x,area.y,Math.max(10,area.innerRadius??12))
      .setStrokeStyle(3,this.profile.color,.8).setDepth(this.scene.playerRenderDepth(area.y)+1);
    this.scene.tweens.add({targets:ring,radius:area.radius,alpha:0,duration:250,onComplete:()=>ring.destroy()});}
    if(!move.zones&&attackAreaContains(area,player.x,player.y)
      &&this.scene.hasClearPath(e.x,e.y,area.x,area.y,e)
      &&this.scene.hasClearPath(area.x,area.y,player.x,player.y,e))this.hurtPlayer(move);
  }
  private hurtPlayer(move:BossMove,angle=this.area!.angle){
    if(this.hit)return;this.hit=true;
    const player=this.scene.player;
    this.scene.damagePlayer(Math.round(this.enemy.definition.damage*move.damage));
    this.scene.playEffect('hit',player.x,player.y,new Phaser.Math.Vector2(Math.cos(angle),Math.sin(angle)));
  }
  private approach(move:BossMove,delta:number){
    const e=this.enemy,body=e.body as Phaser.Physics.Arcade.Body,player=this.scene.player;
    const dx=player.x-e.x,dy=player.y-e.y,distance=Math.max(1,Math.hypot(dx,dy));
    const desired=Math.min(this.profile.preferredRange,move.range*.76);
    const radial=Phaser.Math.Clamp((distance-desired)/65,-.65,1);
    const strafe=distance<desired+100?this.profile.strafe*(this.sequence%2===0?1:-1):0;
    const vx=dx/distance*radial-dy/distance*strafe,vy=dy/distance*radial+dx/distance*strafe;
    const length=Math.hypot(vx,vy);
    if(length<.06){body.setVelocity(0,0);return;}
    const heading=Math.atan2(vy,vx),speed=e.movementSpeed*Math.min(1,length);
    for(const offset of [0,.5,-.5,1,-1]){
      const x=Math.cos(heading+offset),y=Math.sin(heading+offset);
      if(this.scene.canEnemyOccupy(e.x+x*28,e.y+y*28,e)&&this.scene.hasClearPath(e.x,e.y,e.x+x*28,e.y+y*28,e)){
        body.setVelocity(x*speed,y*speed);return;
      }
    }
    // Keep the existing navigation path around scenery when direct steering fails.
    const waypoint=this.scene.enemyNavigationPoint(e,player),angle=Math.atan2(waypoint.y-e.y,waypoint.x-e.x);
    const x=e.x+Math.cos(angle)*Math.min(24,e.movementSpeed*delta/1000),y=e.y+Math.sin(angle)*Math.min(24,e.movementSpeed*delta/1000);
    if(this.scene.canEnemyOccupy(x,y,e)&&this.scene.hasClearPath(e.x,e.y,x,y,e))body.setVelocity(Math.cos(angle)*speed,Math.sin(angle)*speed);
    else body.setVelocity(0,0);
  }
  cancel(delay=700){
    this.roarPresented=false;
    if(this.phase==='ready'&&!this.combo.length&&!this.area){this.nextReady=this.clock+delay;return;}
    this.clearZones();
    this.clearSpell(true,true);
    this.skillVisual?.clear();
    if(this.isAttacking){
      this.enemy.cancelBossWindup();
      // Repeated interrupts must not pin a tower boss to pattern zero forever.
      if(this.profile.resistFlurry)this.sequence++;
    }
    this.phase='ready';this.combo=[];this.area=null;this.age=0;this.warning.clear();
    this.nextReady=this.clock+delay;
  }
  private clearSpell(clearAfterglow=true,fade=false){
    if(clearAfterglow){if(fade)this.magusVisual?.fadeOut();else this.magusVisual?.clear();}
    this.spellTimer?.remove(false);this.spellTimer=null;this.spellVisual?.destroy();this.spellVisual=null;
  }
  private get warningDepth(){return this.scene.playerRenderDepth(Math.min(this.enemy.y,this.scene.player.y))-2;}
  destroy(){this.clearSpell();this.skillVisual?.destroy();this.warning.destroy();for(const warning of this.zoneWarnings)warning.destroy();this.zones.length=0;}
}
