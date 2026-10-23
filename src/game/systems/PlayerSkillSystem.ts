import Phaser from 'phaser';
import { ACTIVE_SKILLS, ACTIVE_SKILL_BY_ID, initialActiveSkillStatus, type ActiveSkillDefinition, type ActiveSkillId, type ActiveSkillStatus } from '../../data/activeSkills';
import {BREAKTHROUGH_COMPLETE} from '../../data/breakthrough';
import { artScale } from '../../data/art';
import { progressionStats } from '../../data/progression';
import { useGameStore } from '../../store/gameStore';
import type { Player } from '../entities/Player';
import type {Enemy} from '../entities/Enemy';
import type { WorldScene } from '../scenes/WorldScene';
import type {Vec2} from '../types';
import {COMBAT_EFFECT_TEXTURE,DISTINCT_EFFECT_TEXTURE,effectPresentation} from './CombatArtEffects';
import {weaponEffect} from '../../data/economy';
import {applySkillWeaponPalette} from './WeaponSkillPalette';
import {heroFrameData} from './heroFrameData';
import {onPlane,onGround,onDirectionalSprite,viewDirection} from '../presentation25d/plane';
import {actorViewAim} from './actorViewDirection';
import type {ActorDirection} from '../../data/directionalEnemyArt';

interface Cast {
  skill:ActiveSkillDefinition; elapsed:number; nextHit:number;
  direction:Phaser.Math.Vector2; visual:Phaser.GameObjects.Sprite|null;mark?:Vec2;rushStopped?:boolean;
  start:Vec2; landing?:Vec2; shadow?:Phaser.GameObjects.Ellipse;rushEffectStarted?:boolean;
  rushDistance:number;rushTravelled:number;
  barrageTargets?:Enemy[];barrageSlash?:Phaser.GameObjects.Sprite;
  viewFacing?:ActorDirection;
  effectColor?:number;weaponId:string;
}
interface SlashWave {sprite:Phaser.GameObjects.Sprite;direction:Phaser.Math.Vector2;remaining:number;skill:ActiveSkillDefinition;multiplier:number;effectColor?:number;weaponId:string}

export class PlayerSkillSystem {
  private readonly cooldowns = initialActiveSkillStatus().cooldowns;
  private cast:Cast | null = null;
  private rallyRemaining = 0;
  private readonly waves=new Set<SlashWave>();
  private readonly flurryTargets=new Set<Enemy>();
  private readonly visualAim={x:0,y:0};
  private readonly effects=new Set<Phaser.GameObjects.Sprite>();
  private readonly attachedEffects=new Map<Phaser.GameObjects.Sprite,{actor:Phaser.GameObjects.Sprite;grip:boolean;offsetX:number;offsetY:number}>();
  private readonly syncAttachedEffects=()=>{
    for(const [effect,attachment] of this.attachedEffects){
      if(!effect.active){this.attachedEffects.delete(effect);continue;}
      if(!attachment.actor.active){this.attachedEffects.delete(effect);continue;}
      const point=this.effectAttachment(attachment.actor,attachment.grip);
      effect.setPosition(point.x+attachment.offsetX,point.y+attachment.offsetY)
        .setDepth(attachment.actor.depth+(attachment.grip ? .06 : -.1));
    }
  };
  private emberField:{point:Vec2;elapsed:number;nextPulse:number;skill:ActiveSkillDefinition;visual:Phaser.GameObjects.Sprite;effectColor?:number;weaponId:string}|null=null;
  private renewalRemaining=0;
  private renewalPulse=0;
  private renewalColor:number|undefined;

  constructor(private readonly scene:WorldScene,private readonly player:Player) {
    useGameStore.getState().setActiveSkillStatus(this.snapshot());
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE,this.syncAttachedEffects);
  }
  get isCasting() { return this.cast !== null; }
  get isInvulnerable(){return this.cast?.skill.id==='barrage';}
  get weaponActor(){return this.cast?.visual??null;}
  get hidesWeapon(){return Boolean(this.cast?.skill.hideWeapon);}
  get incomingDamageMultiplier() { return this.rallyRemaining > 0 ? .5 : 1; }

  tryCast(id:ActiveSkillId):boolean {
    const skill = ACTIVE_SKILL_BY_ID[id];
    if (!skill||this.cast||!this.player.active||this.player.hp<=0) return false;
    const state=useGameStore.getState();
    if(!state.skillSlots.includes(id)||skill.learnCost&&!state.learnedCombatArts.includes(id))return false;
    if(state.level<skill.minLevel){this.scene.notify(`${skill.name} unlocks at level ${skill.minLevel}.`);return false;}
    if(id==='barrage'&&!state.storyFlags[BREAKTHROUGH_COMPLETE])return false;
    if (this.cooldowns[id] > 0) {
      this.scene.notify(`${skill.name} is recovering (${Math.ceil(this.cooldowns[id] / 1000)}s).`);
      return false;
    }
    const barrageTargets=id==='barrage'?this.collectBarrageTargets(skill.targetingRange!):undefined;
    if(barrageTargets&&!barrageTargets.length){this.scene.notify('No reachable enemies in Barrage range.');return false;}
    if (!this.player.spendStamina(skill.staminaCost)) {
      this.scene.notify(`${skill.name} needs ${Math.ceil(this.player.staminaCost(skill.staminaCost))} stamina.`);
      return false;
    }
    const stats=progressionStats(state.attributes,state.learnedSkills,state.armorBonuses);
    this.cooldowns[id] = Math.round(skill.cooldownMs*stats.cooldownMultiplier);
    if (id !== 'crown-rally' || this.player.hp >= this.player.maxHp) {
      if(!skill.poseTimes)this.scene.playSkillSound(skill.animationId??id, 'cast');
      else this.scene.playAudio(id==='iron-tempest'?'sfx-dash':id==='renewing-light'?'sfx-heal-bell':'sfx-impact-heavy-1',.25);
    }
    const selected=this.scene.targeting.selected;
    const target=skill.targetingRange?
      (id==='iron-tempest'&&selected&&this.scene.targeting.eligible(selected,Infinity)
        ?selected:this.scene.targeting.nearest(skill.targetingRange)):null;
    const direction = target?new Phaser.Math.Vector2(target.x-this.player.x,target.y-this.player.y).normalize():this.player.lastDirection.clone().normalize();
    if(direction.lengthSq()===0)direction.copy(this.player.lastDirection);
    if(target){this.scene.targeting.selected=target;this.player.lastDirection.copy(direction);}
    // Choose complete front/back artwork on the dominant aiming axis; side
    // thrusts retain their approved sheet and mirror only for left-facing aim.
    const aim=viewDirection(this.scene,direction.x,direction.y,this.visualAim);
    const verticalRush=id==='iron-tempest'&&Math.abs(aim.y)>Math.abs(aim.x);
    const texture=verticalRush?(aim.y<0?'skill_iron_rush_up':'skill_iron_rush_down'):skill.texture;
    const effectColor=weaponEffect(state.weaponId,state.awakenedWeapons)?.effectColor;
    applySkillWeaponPalette(this.scene,texture,effectColor);
    // These effect canvases retain 20px below their centered ground anchor so
    // airborne poses are not cropped. Offset the presentation, not physics.
    const visual = this.scene.add.sprite(this.player.x,this.player.y-20,texture,0)
      .setOrigin(.5).setScale(artScale(texture)).setFlipX(!verticalRush&&aim.x < 0)
      .setDepth(this.scene.playerRenderDepth(this.player.y)+2).setName(`player-skill:${id}`);
    onPlane(visual,'upright',this.player);
    if(!skill.poseTimes)visual?.play(`player-skill:${skill.animationId??id}`);
    const start={x:this.player.x,y:this.player.y};
    const landing=id==='skyfall-slam'?this.scene.skillLanding(target??{x:start.x+direction.x*90,y:start.y+direction.y*90},skill.targetingRange??90):undefined;
    const shadow=id==='skyfall-slam'?this.scene.add.ellipse(start.x,start.y+2,34,12,0x101512,.3).setDepth(this.scene.playerRenderDepth(start.y)-1).setName('player-slam-shadow'):undefined;
    const proposed=target?{x:target.x,y:target.y}:{x:start.x+direction.x*140,y:start.y+direction.y*140};
    const mark=id==='ember-cleave'&&this.scene.safeSkillPosition(proposed)&&this.scene.hasClearPath(start.x,start.y,proposed.x,proposed.y)?proposed:start;
    const rushDistance=id==='iron-tempest'&&target
      ?Math.max(0,Math.hypot(target.x-start.x,target.y-start.y)-(target.definition.boss?52:38))
      :160;
    this.cast = { skill,elapsed:0,nextHit:0,direction,visual,start,landing,shadow,mark,rushDistance,rushTravelled:0,effectColor,weaponId:state.weaponId,barrageTargets };
    if(barrageTargets)this.cast.barrageSlash=this.scene.add.sprite(start.x,start.y,'effect_slash',0)
      .setVisible(false).setDisplaySize(100,100).setBlendMode(Phaser.BlendModes.ADD);
    this.updateFlurryTargets();
    this.player.setAlpha(visual?0:1);
    // Discard any pre-cast physics displacement from held walking/sprint input.
    (this.player.body as Phaser.Physics.Arcade.Body).reset(start.x,start.y);
    useGameStore.getState().setVitals(this.player.hp,this.player.stamina);
    useGameStore.getState().setActiveSkillStatus(this.snapshot());
    return true;
  }

  // Tick only during active play. Paused menus cannot advance cooldowns,
  // buffs or delayed damage, and cancelled casts have no pending callbacks.
  update(deltaMs:number) {
    // All gameplay timers share the same active-play clock. A slow frame must
    // not shorten cooldowns while leaving a trap or healing pulse behind.
    deltaMs=Math.max(0,Math.min(deltaMs,250));
    for (const skill of ACTIVE_SKILLS) this.cooldowns[skill.id] = Math.max(0,this.cooldowns[skill.id] - deltaMs);
    this.rallyRemaining = Math.max(0,this.rallyRemaining - deltaMs);
    this.updateWaves(deltaMs);
    this.updatePersistentArts(deltaMs);
    const cast = this.cast;
    if (!cast) return;
    this.updateFlurryTargets();
    cast.elapsed += deltaMs;
    if(cast.visual){
      cast.viewFacing=actorViewAim(this.scene,cast.direction.x,cast.direction.y,cast.viewFacing??'right');
      const thrust=cast.skill.id==='iron-tempest'||cast.skill.id==='barrage';
      const vertical=thrust&&(cast.viewFacing==='up'||cast.viewFacing==='down');
      const texture=vertical?(cast.viewFacing==='up'?'skill_iron_rush_up':'skill_iron_rush_down'):cast.skill.id==='barrage'?'skill_iron_rush':cast.skill.texture;
      if(cast.visual.texture.key!==texture){
        applySkillWeaponPalette(this.scene,texture,cast.effectColor);
        const frame=cast.visual.frame.name;
        cast.visual.setTexture(texture,frame).setScale(artScale(texture));
      }
      cast.visual.setFlipX(!vertical&&cast.viewFacing==='left');
    }
    if(cast.visual&&cast.skill.poseTimes&&cast.skill.id!=='barrage'){
      const poses=cast.skill.poseTimes;
      let frame=0;while(frame+1<poses.length&&cast.elapsed>=poses[frame+1])frame++;
      cast.visual.setFrame(frame);
    }
    let height=0;
    if(cast.skill.id==='iron-tempest'&&!cast.rushStopped){
      // Small swept steps stop at real world collision rather than jumping
      // over obstacles between the start and the final approach position.
      const distance=cast.rushDistance*Phaser.Math.Clamp((cast.elapsed-100)/350,0,1);
      // Never use unsigned distance to an absolute destination here: if input
      // or collision puts us beyond it, that distance grants MORE forward travel.
      let remaining=Math.min(Math.max(0,distance-cast.rushTravelled),Math.max(0,cast.rushDistance-cast.rushTravelled));
      while(remaining>.01){const step=Math.min(8,remaining),point={x:this.player.x+cast.direction.x*step,y:this.player.y+cast.direction.y*step};
        if(Math.hypot(point.x-cast.start.x,point.y-cast.start.y)>cast.rushDistance+.01
          ||!this.scene.safeSkillPosition(point)||!this.scene.canTraverseGround(this.player,point)){cast.rushStopped=true;break;}
        (this.player.body as Phaser.Physics.Arcade.Body).reset(point.x,point.y);
        cast.rushTravelled+=step;remaining-=step;
      }
    }
    if(cast.landing) {
      const fraction=Phaser.Math.Clamp((cast.elapsed-140)/430,0,1),eased=Phaser.Math.Easing.Sine.InOut(fraction);
      const point={x:Phaser.Math.Linear(cast.start.x,cast.landing.x,eased),y:Phaser.Math.Linear(cast.start.y,cast.landing.y,eased)};
      if(this.scene.safeSkillPosition(point)&&this.scene.canTraverseGround(this.player,point))
        (this.player.body as Phaser.Physics.Arcade.Body).reset(point.x,point.y);
      else {cast.start={x:this.player.x,y:this.player.y};cast.landing={...cast.start};}
      height=Math.sin(fraction*Math.PI)*64;
      cast.shadow?.setPosition(this.player.x,this.player.y+2).setScale(1-height/140).setAlpha(.3-height/400);
    }
    cast.visual?.setPosition(this.player.x,this.player.y-height-20).setDepth(this.scene.playerRenderDepth(this.player.y)+2);
    if(cast.skill.id==='iron-tempest'&&cast.visual&&cast.elapsed>=220&&!cast.rushEffectStarted){
      // The effect follows the chosen directional pose: front/back thrusts
      // use a vertical axis, while left/right mirror the side-facing gust.
      this.playPoseEffect(1,cast.visual,140,65,true);
      cast.rushEffectStarted=true;
    }
    while (cast.nextHit < cast.skill.hitTimes.length && cast.elapsed >= cast.skill.hitTimes[cast.nextHit]) {
      if(cast.skill.id==='barrage'){
        if(!this.barrageStrike(cast)){this.finishCast();return;}
      }else if(cast.skill.id==='renewing-light'){
        this.renewalRemaining=6000;this.renewalPulse=0;
        this.renewalColor=cast.effectColor;
        this.playPoseEffect(2,this.player,100,76);
      }else if(cast.skill.id==='ember-cleave'){
        this.emberField?.visual.destroy();
        const point=cast.mark!;
        // Local palm contact precedes the marked ground eruption. The target
        // field remains stationary rather than following the casting actor.
        const palmX=this.player.x+(cast.visual?.flipX?9:-9);
        this.playGroundEffect(0,palmX,this.player.y,44,30);
        this.playGroundEffect(0,point.x,point.y,100,76);
        const art=effectPresentation(DISTINCT_EFFECT_TEXTURE,0,cast.effectColor);
        const visual=this.scene.add.sprite(point.x,point.y,art.texture,0).setOrigin(.5,.94).setDisplaySize(172,112).setDepth(this.scene.playerRenderDepth(point.y)-.1).setName('ember-snare-field');
        if(cast.effectColor!==undefined)visual.setTint(cast.effectColor);
        visual.play({key:art.animation,repeat:-1});
        this.emberField={point,elapsed:0,nextPulse:0,skill:cast.skill,visual,effectColor:cast.effectColor,weaponId:cast.weaponId};
      }else if (cast.skill.kind === 'rally') {
        this.player.hp = Math.min(this.player.maxHp,this.player.hp + Math.round(this.player.maxHp * (cast.skill.healingFraction??.2)));
        if(cast.skill.id==='crown-rally')this.rallyRemaining = 5000;
        this.playArtEffect(2,this.player.x,this.player.y,110);
        useGameStore.getState().setVitals(this.player.hp,this.player.stamina);
      } else if(cast.skill.id==='azure-cleave') {
        // Reacquire at release, then freeze flight direction: never home or
        // apply melee damage before the traveling wave actually connects.
        const target=this.scene.targeting.nearest(cast.skill.targetingRange??620);
        if(target){cast.direction.set(target.x-this.player.x,target.y-this.player.y).normalize();this.scene.targeting.selected=target;}
        this.player.lastDirection.copy(cast.direction);
        cast.visual?.setFlipX(viewDirection(this.scene,cast.direction.x,cast.direction.y,this.visualAim).x<0);
        const row=0;
        const art=effectPresentation(COMBAT_EFFECT_TEXTURE,row,cast.effectColor);
        const sprite=this.scene.add.sprite(this.player.x+cast.direction.x*16,this.player.y+cast.direction.y*16,art.texture,row*4)
          .setDisplaySize(92,92).setBlendMode(Phaser.BlendModes.ADD)
          .setRotation(Math.atan2(cast.direction.y,cast.direction.x)).setDepth(this.scene.playerRenderDepth(this.player.y)+4).setName(`${cast.skill.id}-wave`);
        if(cast.effectColor!==undefined)sprite.setTint(cast.effectColor);
        sprite.play({key:art.animation,repeat:-1});
        const wave={sprite,direction:cast.direction.clone(),remaining:cast.skill.targetingRange??620,skill:cast.skill,multiplier:cast.skill.damageMultipliers[cast.nextHit],effectColor:cast.effectColor,weaponId:cast.weaponId};
        onDirectionalSprite(sprite,wave.direction);this.waves.add(wave);
        this.scene.recordTraining(cast.skill.id);
      } else {
        if(cast.skill.id==='skyfall-slam') {
          this.playArtEffect(1,this.player.x,this.player.y,220);
        }
        if (cast.skill.id === 'crescent-flurry') {
          this.scene.playSkillSound(cast.skill.id,'swing');
          // Restore the approved four simultaneous slashes at every pulse.
          // Rotate their surrounding positions, not the hero or a single cleave.
          for(let side=0;side<4;side++){
            const angle=cast.nextHit*Math.PI/4+side*Math.PI/2;
            this.playFlurrySlash(this.player.x+Math.cos(angle)*26,this.player.y+Math.sin(angle)*26,angle,cast.effectColor);
          }
        }
        if(cast.skill.id==='iron-tempest'){
          if(cast.visual)this.playPoseEffect(3,cast.visual,110,65,true,36);
        }
        this.scene.performSkillHit(this.player,cast.direction,cast.skill,cast.skill.damageMultipliers[cast.nextHit],cast.weaponId);
      }
      cast.nextHit++;
    }
    if (cast.elapsed >= cast.skill.durationMs) this.finishCast();
  }

  // One bounded snapshot per cast; no target scans or sprite allocation per frame.
  private collectBarrageTargets(range:number):Enemy[]{
    const targets:Enemy[]=[];
    for(const enemy of this.scene.getCombatEnemies()){
      if(!this.scene.targeting.eligible(enemy,range))continue;
      const distance=Phaser.Math.Distance.Squared(this.player.x,this.player.y,enemy.x,enemy.y);
      let index=0;
      while(index<targets.length&&Phaser.Math.Distance.Squared(this.player.x,this.player.y,targets[index].x,targets[index].y)<distance)index++;
      if(index<6){targets.splice(index,0,enemy);if(targets.length>6)targets.pop();}
    }
    return targets;
  }
  private barrageStrike(cast:Cast):boolean{
    const targets=cast.barrageTargets!;
    for(let offset=0;offset<targets.length;offset++){
      const enemy=targets[(cast.nextHit+offset)%targets.length];
      if(!enemy.active||enemy.hp<=0||!enemy.canBeTargeted
        ||Phaser.Math.Distance.Squared(cast.start.x,cast.start.y,enemy.x,enemy.y)>560*560
        ||!this.scene.hasClearPath(this.player.x,this.player.y,enemy.x,enemy.y))continue;
      const spacing=enemy.definition.boss?66:46;
      for(let side=0;side<4;side++){
        const angle=((cast.nextHit+side)%4)*Math.PI/2;
        const point={x:enemy.x+Math.cos(angle)*spacing,y:enemy.y+Math.sin(angle)*spacing};
        if(!this.scene.safeSkillPosition(point)||!this.scene.canTraverseGround(this.player,point))continue;
        (this.player.body as Phaser.Physics.Arcade.Body).reset(point.x,point.y);
        cast.direction.set(enemy.x-point.x,enemy.y-point.y).normalize();
        this.player.lastDirection.copy(cast.direction);
        const aim=viewDirection(this.scene,cast.direction.x,cast.direction.y,this.visualAim);
        const vertical=Math.abs(aim.y)>Math.abs(aim.x);
        const texture=vertical?(aim.y<0?'skill_iron_rush_up':'skill_iron_rush_down'):'skill_iron_rush';
        applySkillWeaponPalette(this.scene,texture,cast.effectColor);
        cast.visual?.setTexture(texture,2+cast.nextHit%3).setScale(artScale(texture)).setFlipX(!vertical&&aim.x<0)
          .setPosition(point.x,point.y-20).setDepth(this.scene.playerRenderDepth(point.y)+2);
        cast.barrageSlash?.setPosition(enemy.x,enemy.y-20).setDepth(this.scene.playerRenderDepth(enemy.y)+4)
          .setRotation(Math.atan2(cast.direction.y,cast.direction.x)).setVisible(true).play('effect-slash');
        this.scene.applySkillDamage(enemy,cast.skill,cast.skill.damageMultipliers[cast.nextHit],cast.direction,cast.weaponId);
        if(cast.nextHit%2===0)this.scene.playAudio('sfx-dash',.18);
        return true;
      }
    }
    return false;
  }

  private updateWaves(delta:number) {
    if(!this.waves.size)return;
    const enemies=this.scene.getCombatEnemies();
    for(const wave of this.waves) {
      let travel=Math.min(wave.remaining,620*delta/1000),terminated=false;
      while(travel>0&&!terminated){const step=Math.min(12,travel),from={x:wave.sprite.x,y:wave.sprite.y},to={x:from.x+wave.direction.x*step,y:from.y+wave.direction.y*step};
        if(!this.scene.hasClearPath(from.x,from.y,to.x,to.y)){terminated=true;break;}
        const dx=to.x-from.x,dy=to.y-from.y,len=dx*dx+dy*dy;
        let struck:Enemy|undefined,first=Infinity;
        for(const enemy of enemies){
          if(!enemy.active||!enemy.canBeTargeted||enemy.hp<=0)continue;
          const radius=(enemy.definition.boss?24:11)+14;
          if(enemy.x<Math.min(from.x,to.x)-radius||enemy.x>Math.max(from.x,to.x)+radius
            ||enemy.y<Math.min(from.y,to.y)-radius||enemy.y>Math.max(from.y,to.y)+radius)continue;
          const t=len?Phaser.Math.Clamp(((enemy.x-from.x)*dx+(enemy.y-from.y)*dy)/len,0,1):0;
          if(t<first&&Math.hypot(enemy.x-from.x-t*dx,enemy.y-from.y-t*dy)<=radius
            &&this.scene.hasClearPath(from.x,from.y,enemy.x,enemy.y)){struck=enemy;first=t;}
        }
        if(struck){this.scene.applySkillDamage(struck,wave.skill,wave.multiplier,wave.direction,wave.weaponId);this.playArtEffect(0,struck.x,struck.y,92,Math.atan2(wave.direction.y,wave.direction.x),false,wave.effectColor??null);terminated=true;break;}
        wave.sprite.setPosition(to.x,to.y).setDepth(this.scene.playerRenderDepth(to.y)+4);wave.remaining-=step;travel-=step;
      }
      if(terminated||wave.remaining<=0){wave.sprite.destroy();this.waves.delete(wave);}
    }
  }

  private playArtEffect(row:number,x:number,y:number,size:number,rotation=0,distinct=false,effectColor:number|null|undefined=this.cast?.effectColor){
    const color=effectColor??undefined,art=effectPresentation(distinct?DISTINCT_EFFECT_TEXTURE:COMBAT_EFFECT_TEXTURE,row,color);
    const sprite=this.scene.add.sprite(x,y-8,art.texture,row*4).setDisplaySize(size,size).setDepth(this.scene.playerRenderDepth(y)+4).setRotation(rotation).setBlendMode(Phaser.BlendModes.ADD);
    if(color!==undefined)sprite.setTint(color);
    this.effects.add(sprite);sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE,()=>{this.effects.delete(sprite);sprite.destroy();});sprite.play(art.animation);
  }
  private playFlurrySlash(x:number,y:number,angle:number,color?:number){
    const tinted=color!==undefined;
    const sprite=this.scene.add.sprite(x,y,tinted?'effect_slash-neutral':'effect_slash',0)
      .setOrigin(.5).setScale(artScale('effect_slash')*1.35).setRotation(angle-Math.PI/4)
      .setDepth(this.scene.playerRenderDepth(y)+1).setName('crescent-flurry-slash');
    if(color!==undefined)sprite.setTint(color);
    this.effects.add(sprite);
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE,()=>{this.effects.delete(sprite);sprite.destroy();});
    sprite.play(tinted?'effect-slash-weapon':'effect-slash');
  }
  private effectAttachment(actor:Phaser.GameObjects.Sprite,gripping:boolean):Vec2{
    const grip=gripping?heroFrameData(actor.frame).weaponGrip:undefined;
    if(!grip)return {x:actor.x,y:actor.y};
    const x=((actor.flipX?actor.width-grip.x:grip.x)-actor.width*actor.originX)*actor.scaleX;
    const y=(grip.y-actor.height*actor.originY)*actor.scaleY;
    const c=Math.cos(actor.rotation),s=Math.sin(actor.rotation);
    return {x:actor.x+x*c-y*s,y:actor.y+x*s+y*c};
  }
  private playGroundEffect(row:number,x:number,y:number,width:number,height:number,effectColor:number|null|undefined=this.cast?.effectColor){
    const color=effectColor??undefined,art=effectPresentation(DISTINCT_EFFECT_TEXTURE,row,color);
    const sprite=this.scene.add.sprite(x,y,art.texture,row*4)
      .setOrigin(.5,.94).setDisplaySize(width,height).setDepth(this.scene.playerRenderDepth(y)-.1);
    onGround(sprite,.1);
    if(color!==undefined)sprite.setTint(color);
    this.effects.add(sprite);
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE,()=>{
      this.effects.delete(sprite);this.attachedEffects.delete(sprite);sprite.destroy();
    });
    sprite.play(art.animation);
    return sprite;
  }
  private playPoseEffect(row:number,actor:Phaser.GameObjects.Sprite,width:number,height:number,gripping=false,tipDistance=0,effectColor:number|null|undefined=this.cast?.effectColor){
    const point=this.effectAttachment(actor,gripping);
    const up=actor.texture.key==='skill_iron_rush_up',down=actor.texture.key==='skill_iron_rush_down';
    const offsetX=gripping&&!up&&!down?tipDistance*(actor.flipX?-1:1):0;
    const offsetY=gripping?(up?-tipDistance:down?tipDistance:0):0;
    const sprite=this.playGroundEffect(row,point.x+offsetX,point.y+offsetY,width,height,effectColor??null);
    onPlane(sprite,'upright',this.player);
    if(gripping){
      // Both directional rows point right. Their tip is near the right edge,
      // not the canvas center; mirror the pivot together with the artwork.
      sprite.setFlipX(!up&&!down&&actor.flipX).setOrigin(!up&&!down&&actor.flipX ? .10 : .90,.62)
        .setRotation(up?-Math.PI/2:down?Math.PI/2:0);
    }
    this.attachedEffects.set(sprite,{actor,grip:gripping,offsetX,offsetY});
    this.syncAttachedEffects();
    return sprite;
  }
  private updatePersistentArts(delta:number){
    if(this.renewalRemaining>0){const active=Math.min(delta,this.renewalRemaining);this.renewalRemaining-=active;this.renewalPulse+=active;
      while(this.renewalPulse>=1000){this.renewalPulse-=1000;this.player.hp=Math.min(this.player.maxHp,this.player.hp+Math.max(1,Math.round(this.player.maxHp*.06)));this.playPoseEffect(2,this.player,90,68,false,0,this.renewalColor??null);useGameStore.getState().setVitals(this.player.hp,this.player.stamina);}
    }
    const field=this.emberField;if(!field)return;field.elapsed+=delta;
    const pulses=[600,1400,2200];
    while(field.nextPulse<pulses.length&&field.elapsed>=pulses[field.nextPulse]){
      for(const enemy of this.scene.getCombatEnemies())if(enemy.active&&enemy.canBeTargeted&&Math.hypot(enemy.x-field.point.x,enemy.y-field.point.y)<=field.skill.radius
        &&this.scene.hasClearPath(field.point.x,field.point.y,enemy.x,enemy.y)){
        const outward=new Phaser.Math.Vector2(enemy.x-field.point.x,enemy.y-field.point.y);if(outward.lengthSq()>0)outward.normalize();else outward.set(0,1);
        this.scene.applySkillDamage(enemy,field.skill,field.skill.damageMultipliers[0],outward,field.weaponId);
      }
      this.playGroundEffect(0,field.point.x,field.point.y,172,112,field.effectColor??null);field.nextPulse++;
    }
    if(field.elapsed>=2600){field.visual.destroy();this.emberField=null;}
  }
  interruptRenewal(){this.renewalRemaining=0;this.renewalPulse=0;this.renewalColor=undefined;}

  snapshot():ActiveSkillStatus {
    return { cooldowns:{ ...this.cooldowns },casting:this.cast?.skill.id ?? null,rallyRemaining:this.rallyRemaining };
  }
  private updateFlurryTargets(){
    const cast=this.cast;if(cast?.skill.id!=='crescent-flurry')return;
    const current=new Set(this.scene.skillTargets(this.player,cast.direction,cast.skill));
    for(const enemy of this.flurryTargets)if(!current.has(enemy))enemy.setFlurrySuppressed(false);
    this.flurryTargets.clear();
    for(const enemy of current){enemy.setFlurrySuppressed(true);this.flurryTargets.add(enemy);}
  }
  private finishCast() {
    for(const enemy of this.flurryTargets)enemy.setFlurrySuppressed(false);
    this.flurryTargets.clear();
    this.cast?.barrageSlash?.destroy();
    this.cast?.visual?.destroy();
    this.cast?.shadow?.destroy();
    this.cast = null;
    if (this.player.active) this.player.setAlpha(1);
    useGameStore.getState().setActiveSkillStatus(this.snapshot());
  }
  cancelCast() {this.finishCast();this.interruptRenewal();this.emberField?.visual.destroy();this.emberField=null;for(const wave of this.waves)wave.sprite.destroy();this.waves.clear();for(const effect of this.effects)effect.destroy();this.effects.clear();this.attachedEffects.clear();}
  clearRally() { this.rallyRemaining = 0;useGameStore.getState().setActiveSkillStatus(this.snapshot()); }
  destroy() { this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE,this.syncAttachedEffects);this.cancelCast();this.clearRally(); }
}
