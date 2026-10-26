import Phaser from 'phaser';
import {DepthSortedSprite,setDepthIfChanged} from '../systems/renderDepth';
import {EquippedSwordVisual} from '../systems/EquippedSwordVisual';
import {AwakenedHeroVisual} from '../systems/AwakenedHeroVisual';
import { mobileInput, type MobileAction } from '../input';
import { useGameStore } from '../../store/gameStore';
import type { WorldScene } from '../scenes/WorldScene';
import { artScale, ART_BY_KEY, actorArtLayout, actorScaleForHeight, HERO_VISIBLE_HEIGHT, type PlayerPresentationTexture } from '../../data/art';
import { directionFrame } from '../../data/animationPacks';
import { PLAYER_COMBO_ATTACK_ANIMATIONS } from '../../data/spriteBoards';
import {BASIC_ATTACK_CHAIN,BASIC_ATTACK_LINK_MS,BASIC_ATTACK_BUFFER_MS,basicAttackStamina,type BasicAttackStep} from '../../data/basicAttackCombo';
import type {WeaponDefinition} from '../types';
import { animationDuration } from '../../data/animationPacks';
import { progressionStats,dodgeProfile,ASCENDED_ATTRIBUTE_CAP } from '../../data/progression';
import { slottedActiveSkills } from '../../data/activeSkills';
import { PlayerSkillSystem } from '../systems/PlayerSkillSystem';
import { RecoverySystem } from '../systems/RecoverySystem';
import { approachVelocity, strideRate } from '../systems/locomotion';
import {localPlayCheatsEnabled} from '../../utils/localPlayCheats';
import {screenMovement,viewDirection,worldHeight,onPlane} from '../presentation25d/plane';
import {actorAimDirection,type ActorDirection} from '../../data/directionalEnemyArt';

export class Player extends DepthSortedSprite {
  readonly moveSpeed = 165;
  readonly skills:PlayerSkillSystem;
  readonly recovery=new RecoverySystem();
  readonly unlimitedVitals=localPlayCheatsEnabled();
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  lastDirection = new Phaser.Math.Vector2(0, 1);
  private readonly movement=new Phaser.Math.Vector2();
  private readonly screenFacing=new Phaser.Math.Vector2();
  private viewFacing:ActorDirection='down';
  get presentationDirection(){
    const aim=this.pendingBasicAttack?.direction??this.lastDirection;
    const facing=viewDirection(this.scene,aim.x,aim.y,this.screenFacing);
    this.viewFacing=actorAimDirection(facing.x,facing.y,this.viewFacing);
    facing.x=this.viewFacing==='left'?-1:this.viewFacing==='right'?1:0;
    facing.y=this.viewFacing==='up'?-1:this.viewFacing==='down'?1:0;return facing;
  }
  private jumpY=0;private jumpVelocity=0;private jumping=false;
  private verticalReady=false;private verticalDelta=0;private verticalX=0;private verticalY=0;private verticalInterior=false;
  private jumpQueuedUntil=0;
  get presentationElevation(){return this.jumping?Math.max(0,this.jumpY-worldHeight(this.scene,this.x,this.y)):0;}
  private readonly keys: Record<'up' | 'down' | 'left' | 'right' | 'sprint' | MobileAction, Phaser.Input.Keyboard.Key>;
  private nextAttackAt = 0;
  private comboStep=0;
  private comboExpiresAt=0;
  private comboWeaponId='';
  private pendingBasicAttack:{weapon:WeaponDefinition;direction:Phaser.Math.Vector2;step:BasicAttackStep;startedAt:number;impactAt:number;activeUntil:number;endsAt:number;hitIds:Set<string>;emitted:boolean;lungeDistance:number;lungeTravelled:number}|null=null;
  private attackQueuedUntil=0;
  private nextDashAt = 0;
  private nextFootstepAt = 0;
  private dashUntil = 0;
  private invulnerableUntil = 0;
  private dashDirection = new Phaser.Math.Vector2(0, 1);
  private nextDashTrailAt = 0;
  private sprintExhausted = false;
  private readonly pressed = new Set<MobileAction>();
  private attackVisual:Phaser.GameObjects.Sprite | null = null;
  private shadowVisual:Phaser.GameObjects.Sprite|undefined;
  get presentationShadowVisual(){return this.shadowVisual??this;}
  private attackStep=0;
  private readonly swordVisual:EquippedSwordVisual;
  private readonly awakenedVisual:AwakenedHeroVisual;
  private weaponDrawnRemaining=0;
  // Arcade Physics applies its final displacement in POST_UPDATE, after the
  // scene's updatePlayer call. Attach visual layers only once that is done.
  private readonly syncSwordAfterPhysics=()=>{
    if(!this.active)return;
    (this.scene as WorldScene).resolvePlayerGroundMotion();
    this.updateVerticalAfterPhysics();
    this.refreshAttackView();
    this.setDepth((this.scene as WorldScene).playerRenderDepth(this.y));
    if(this.attackVisual?.active)setDepthIfChanged(this.attackVisual,this.depth).setPosition(this.x,this.y);
    this.updateSwordVisual();
  };
  private resetVerticalPosition(){
    this.jumpY=worldHeight(this.scene,this.x,this.y);this.jumpVelocity=0;this.jumping=false;
    this.verticalX=this.x;this.verticalY=this.y;this.verticalInterior=(this.scene as WorldScene).inInterior;this.verticalReady=true;
  }
  private updateVerticalAfterPhysics(){
    const scene=this.scene as WorldScene,ground=worldHeight(scene,this.x,this.y),dt=this.verticalDelta;
    this.verticalDelta=0;
    // Teleports and room changes select their destination floor immediately.
    // Ordinary walking is resolved only after Arcade/manual indoor movement.
    if(!this.verticalReady||scene.inInterior!==this.verticalInterior||Math.hypot(this.x-this.verticalX,this.y-this.verticalY)>256){this.resetVerticalPosition();return;}
    this.verticalX=this.x;this.verticalY=this.y;
    if(!this.jumping){
      if(this.jumpY-ground>32){this.jumping=true;this.jumpVelocity=0;}
      else {this.jumpY=ground;return;}
    }
    let remaining=dt;
    while(remaining>0){
      const step=Math.min(.02,remaining);remaining-=step;
      this.jumpY+=this.jumpVelocity*step-550*step*step;this.jumpVelocity-=1100*step;
      if(this.jumpY<=ground){
        this.jumpY=ground;
        if(this.jumpVelocity<=0){this.jumping=false;this.jumpVelocity=0;break;}
      }
    }
  }
  private updateSwordVisual(){
    const actor=this.awakenedVisual.update(this.skills.weaponActor??this.attackVisual??this);
    this.shadowVisual=actor;
    if(this.skills.hidesWeapon){this.swordVisual.hide();return;}
    const attacking=Boolean(this.attackVisual?.active)||this.skills.isCasting;
    const facing=this.presentationDirection;
    this.swordVisual.update(actor,
      !attacking&&this.weaponDrawnRemaining===0,
      facing.y<0&&Math.abs(facing.y)>=Math.abs(facing.x));
  }
  private vitalRevision=useGameStore.getState().vitalRevision;
  syncInventoryVitals(){
    const state=useGameStore.getState();if(state.vitalRevision===this.vitalRevision)return;
    this.hp=state.hp;this.stamina=state.stamina;this.vitalRevision=state.vitalRevision;
  }
  /** Use current equipment-derived limits, not a stale pre-menu maximum.
   * Consume pending potion/equipment vitals before restoring, so a later
   * revision sync cannot undo the completed rest. */
  restoreRestVitals(){
    this.syncInventoryVitals();
    const state=useGameStore.getState(),stats=progressionStats(state.attributes,state.learnedSkills,state.armorBonuses);
    this.maxHp=stats.maxHp;this.maxStamina=stats.maxStamina;
    this.hp=this.maxHp;this.stamina=this.maxStamina;
    state.setVitals(this.hp,this.stamina);
  }

  constructor(scene: WorldScene, x: number, y: number) {
    super(scene, x, y, 'leigneron', 0);
    scene.add.existing(this);
    const layout = actorArtLayout('leigneron');
    this.setScale(artScale('leigneron')).setOrigin(.5, layout.originY);
    scene.physics.add.existing(this);
    this.setDepth(y);
    this.awakenedVisual=new AwakenedHeroVisual(scene,()=>this.swordVisual?.hide());
    this.swordVisual=new EquippedSwordVisual(scene);
    // The physics plugin has already registered its POST_UPDATE listener.
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE,this.syncSwordAfterPhysics);
    this.once('destroy',() => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE,this.syncSwordAfterPhysics);
      this.clearAttackVisual();this.skills?.destroy();this.swordVisual.destroy();this.awakenedVisual.destroy();
    });

    const body = this.body as Phaser.Physics.Arcade.Body;
    const density = ART_BY_KEY.leigneron.density;
    body.setSize(18 * density, 22 * density);
    body.setOffset(layout.bodyX * density, layout.bodyY * density);
    body.setCollideWorldBounds(true);

    const state = useGameStore.getState();
    this.hp = this.unlimitedVitals?state.maxHp:state.hp;
    this.maxHp = state.maxHp;
    this.stamina = this.unlimitedVitals?state.maxStamina:state.stamina;
    this.maxStamina = state.maxStamina;
    this.skills = new PlayerSkillSystem(scene,this);

    if (!scene.input.keyboard) throw new Error('Keyboard input is unavailable.');
    this.keys = scene.input.keyboard.addKeys({
      up: 'W', down: 'S', left: 'A', right: 'D', sprint: 'SHIFT', dash: 'Q', attack: 'F', jump:'SPACE',interact: 'E',
      skill1:'ONE',skill2:'TWO',skill3:'THREE',skill4:'FOUR',
      healPotion:'FIVE',staminaPotion:'SIX',targetLock:'R',
    }) as typeof this.keys;
    for (const action of ['dash', 'attack', 'jump','interact','skill1','skill2','skill3','skill4','healPotion','staminaPotion','targetLock'] as const) {
      this.keys[action].setEmitOnRepeat(false).on('down', () => this.pressed.add(action));
    }
  }

  updatePlayer(time: number, delta: number) {
    const scene = this.scene as WorldScene;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const state = useGameStore.getState();
    const progression = progressionStats(state.attributes, state.learnedSkills,state.armorBonuses);
    this.syncInventoryVitals();
    this.maxHp = progression.maxHp;
    this.maxStamina = progression.maxStamina;
    if(this.unlimitedVitals){this.hp=this.maxHp;this.stamina=this.maxStamina;this.sprintExhausted=false;}
    for(const [action,id] of [['healPotion','healing-potion'],['staminaPotion','stamina-potion']] as const){
      const touch=mobileInput.consume(action),pressed=this.consumeAction(action)||touch;
      if(pressed){state.setVitals(this.hp,this.stamina);state.usePotion(id);this.syncInventoryVitals();}
    }
    const toggleKeyboard=this.consumeAction('targetLock'),toggleTouch=mobileInput.consume('targetLock');
    if((toggleKeyboard||toggleTouch)&&this.hp>0&&scene.combatAllowed)scene.targeting.toggleLock();
    const castingAtFrameStart=this.skills.isCasting;
    this.skills.update(delta);
    // Even the completion frame belongs to the cast. Held inputs resume on
    // the next frame, without adding a walk/sprint displacement to the rush.
    const movementLocked=castingAtFrameStart||this.skills.isCasting;
    const keyboardJump=this.consumeAction('jump'),touchJump=mobileInput.consume('jump');
    const jumpPressed=keyboardJump||touchJump;
    // Input events arriving during a cast, animation transition or a slow
    // frame must not vanish just because jumping was temporarily locked.
    if(jumpPressed)this.jumpQueuedUntil=time+250;
    const ground=worldHeight(scene,this.x,this.y);
    if(!this.verticalReady)this.resetVerticalPosition();
    this.verticalDelta=Math.max(0,Math.min(delta,80))/1000;
    if(this.jumpQueuedUntil>0&&this.jumpQueuedUntil>=time&&!this.jumping&&!movementLocked&&this.hp>0){
      this.jumping=true;this.jumpY=ground;this.jumpVelocity=380;this.jumpQueuedUntil=0;
    }

    let x = (this.keys.right.isDown ? 1 : 0) - (this.keys.left.isDown ? 1 : 0) + mobileInput.moveX;
    let y = (this.keys.down.isDown ? 1 : 0) - (this.keys.up.isDown ? 1 : 0) + mobileInput.moveY;
    const movement=this.movement;screenMovement(scene,x,y,movement);
    if (movementLocked) movement.set(0,0);
    if (movement.lengthSq() > 1) movement.normalize();
    x = movement.x;
    y = movement.y;

    if (movement.lengthSq() > 0.01) {
      this.lastDirection.copy(movement).normalize();
    }

    const mobileDash = mobileInput.consume('dash');
    const dashPressed = this.consumeAction('dash') || mobileDash;
    const dodge=dodgeProfile(state.attributes,state.armorBonuses);
    if (dashPressed && !movementLocked && time >= this.nextDashAt && this.spendStamina(dodge.staminaCost)) {
      this.resetBasicAttackCombo();
      this.nextAttackAt=time;
      this.clearAttackVisual();
      this.nextDashAt = time + dodge.cooldownMs;
      this.dashUntil = time + dodge.durationMs;
      this.invulnerableUntil = time + dodge.invulnerableMs;
      this.dashDirection.copy(this.lastDirection);
      this.nextDashTrailAt = time;
      scene.recordTraining('drill-dash');
      scene.shakeCombatCamera(75, 0.0015);
      scene.playEffect('fortification', this.x, this.y, this.dashDirection);
      scene.playAudio('sfx-dash',.32);
    }

    const dashing = !movementLocked&&time < this.dashUntil;
    const sprintHeld = this.keys.sprint.isDown || mobileInput.sprint;
    // Exhaustion survives tiny refills and brief input changes. Recover a
    // useful reserve with sprint released before a new hold can start running.
    const sprintRecoveryStamina = this.maxStamina * .2;
    if (this.stamina <= 0) this.sprintExhausted = true;
    if (this.sprintExhausted && !sprintHeld && this.stamina >= sprintRecoveryStamina) {
      this.sprintExhausted = false;
    }

    let sprinting = sprintHeld && !this.sprintExhausted && !movementLocked &&
      !dashing && movement.lengthSq() > .01 && this.stamina > 0;
    if (sprinting&&!this.unlimitedVitals) {
      this.stamina = Math.max(0, this.stamina - this.staminaCost(delta * 0.022));
      if (this.stamina === 0) {
        this.sprintExhausted = true;
        sprinting = false;
      }
    } else {
      this.stamina = Math.min(this.maxStamina, this.stamina + delta * 0.014);
    }

    const dashMultiplier = dashing ? dodge.speedMultiplier : 1;
    if (dashing) { x = this.dashDirection.x; y = this.dashDirection.y; }
    const walkSpeed = this.moveSpeed * progression.speedMultiplier;
    const slopeScale=this.jumping?1:scene.movementSurfaceScale(this.x,this.y,x,y);
    const speed = walkSpeed * (sprinting ? 1.42 : 1) * dashMultiplier * (this.pendingBasicAttack&&!dashing ? .8 : 1)*slopeScale;
    // The exhausted state uses walking speed immediately, including cadence;
    // don't carry the previous sprint velocity into the walking animation.
    if (this.sprintExhausted && !dashing && body.velocity.length() > walkSpeed) {
      body.velocity.setLength(walkSpeed);
    }
    const lockedMotion=movementLocked||dashing;
    body.setVelocity(lockedMotion?x*speed:approachVelocity(body.velocity.x,x*speed,delta,45),
      lockedMotion?y*speed:approachVelocity(body.velocity.y,y*speed,delta,45));
    if(!dashing&&movement.lengthSq()>.01&&body.velocity.length()>28&&time>=this.nextFootstepAt){
      this.nextFootstepAt=time+(sprinting?330:475);
      scene.playFootstep(this.x,this.y,sprinting);
    }
    const runningAnimation = dashing || (sprinting && !this.sprintExhausted);
    this.updateAnimation(body.velocity.x, body.velocity.y, runningAnimation, x, y);
    if (dashing && time >= this.nextDashTrailAt) this.createDashTrail(time);
    this.setDepth((this.scene as WorldScene).playerRenderDepth(this.y));
    if (this.attackVisual?.active) setDepthIfChanged(this.attackVisual,this.depth).setPosition(this.x,this.y);

    const lockedTarget=scene.targeting.lockedTarget;
    if(lockedTarget&&!movementLocked&&!dashing)this.lastDirection.set(lockedTarget.x-this.x,lockedTarget.y-this.y).normalize();
    const equippedArts=slottedActiveSkills(state.skillSlots);
    for (const action of ['skill1','skill2','skill3','skill4'] as const) {
      const touchPressed = mobileInput.consume(action);
      const pressed = this.consumeAction(action) || touchPressed;
      const skill=equippedArts.find(s=>s.action===action);if(!skill)continue;
      const canCancelBasic=this.pendingBasicAttack&&time>=this.pendingBasicAttack.activeUntil;
      if (pressed && scene.combatAllowed && !this.skills.isCasting && (time >= this.nextAttackAt||canCancelBasic) && time >= this.dashUntil) {
        if (this.skills.tryCast(skill.id)) {
          this.clearAttackVisual(false);
          this.resetBasicAttackCombo();
          this.nextAttackAt = time + skill.durationMs;
        }
      }
    }

    const mobileAttack = mobileInput.consume('attack');
    const attackTapped = this.consumeAction('attack') || mobileAttack;
    if(!scene.combatAllowed||this.hp<=0||state.weaponId!==this.comboWeaponId)this.resetBasicAttackCombo();
    if(attackTapped&&!this.skills.isCasting&&time>=this.dashUntil)this.attackQueuedUntil=time+BASIC_ATTACK_BUFFER_MS;
    const attackPressed=this.keys.attack.isDown||mobileInput.attackHeld||this.attackQueuedUntil>time;
    const pending=this.pendingBasicAttack;
    if(pending){
      if(time<=pending.activeUntil){
        const fraction=Phaser.Math.Clamp((time-pending.startedAt)/Math.max(1,pending.impactAt-pending.startedAt),0,1);
        const travel=Math.max(0,pending.lungeDistance*fraction-pending.lungeTravelled);
        if(travel>.01){
          const moved=scene.movePlayerCombatToward({x:this.x+pending.direction.x*travel,y:this.y+pending.direction.y*travel},travel);
          pending.lungeTravelled+=moved;
          if(moved+.01<travel)pending.lungeDistance=pending.lungeTravelled;
        }
      }
      if(time>=pending.impactAt&&(!pending.emitted||time<=pending.activeUntil)){
        const first=!pending.emitted;pending.emitted=true;
        this.strikeBasicAttack(pending.weapon,pending.direction,pending.step,pending.hitIds,first);
      }
      if(time>=pending.endsAt)this.pendingBasicAttack=null;
    }
    if (attackPressed && this.hp>0 && scene.combatAllowed && !this.skills.isCasting && !this.pendingBasicAttack && time >= this.nextAttackAt && time >= this.dashUntil) {
      const weapon = scene.getEquippedWeapon();
      if(time>this.comboExpiresAt||this.comboWeaponId!==weapon.id)this.comboStep=0;
      const stepIndex=this.comboStep,step=BASIC_ATTACK_CHAIN[stepIndex];
      const cooldown = weapon.cooldownMs * progression.cooldownMultiplier * step.recoveryMultiplier;
      if (this.spendStamina(basicAttackStamina(weapon.staminaCost,step))) {
        const direction=this.lastDirection.clone().normalize();
        const target=scene.targeting.meleeTarget(weapon.reach+32,direction);
        if(target)direction.set(target.x-this.x,target.y-this.y).normalize();
        if(direction.lengthSq()===0)direction.set(0,1);
        this.lastDirection.copy(direction);this.attackQueuedUntil=0;
        this.nextAttackAt = time + cooldown;
        this.comboStep=(stepIndex+1)%BASIC_ATTACK_CHAIN.length;
        this.comboExpiresAt=this.nextAttackAt+BASIC_ATTACK_LINK_MS;
        this.comboWeaponId=weapon.id;
        this.recovery.interrupt();
        const impactAt=time+cooldown*step.impactFraction;
        const lungeDistance=target?Math.min(step.lungeDistance,Math.max(0,Math.hypot(target.x-this.x,target.y-this.y)-(target.definition.bodyRadius??12)-16)):step.lungeDistance;
        this.pendingBasicAttack={weapon,direction,step,startedAt:time,impactAt,activeUntil:Math.min(time+cooldown-20,impactAt+step.activeMs),endsAt:time+cooldown,hitIds:new Set(),emitted:false,lungeDistance,lungeTravelled:0};
        if (weapon.kind === 'sword' || weapon.kind === 'greatsword') this.playSwordVisual(cooldown,stepIndex);
      }
    }

    const mobileInteract = mobileInput.consume('interact');
    const interactPressed = this.consumeAction('interact') || mobileInteract;
    if (interactPressed) {
      if (this.skills.isCasting) scene.notify('Finish your combat art before interacting.');
      else scene.tryInteract(this.x, this.y);
    }
    // Advance the combat-rest timer here; the post-physics listener renders
    // the sword against the final body position and the current pose frame.
    if(this.skills.isCasting||this.attackVisual?.active)this.weaponDrawnRemaining=5000;
    else this.weaponDrawnRemaining=Math.max(0,this.weaponDrawnRemaining-Math.max(0,Math.min(delta,250)));
  }

  spendStamina(amount:number):boolean {
    amount=this.staminaCost(amount);
    if(this.unlimitedVitals){this.stamina=this.maxStamina;return true;}
    if(this.stamina<amount)return false;
    this.stamina=Math.max(0,this.stamina-amount);return true;
  }
  staminaCost(amount:number){return Math.max(0,amount)*(1-Math.min(.45,useGameStore.getState().armorBonuses.staminaReduction??0));}
  absorbLifeFromHit(actualDamage:number){
    if(!this.active||this.hp<=0||actualDamage<=0)return;
    this.syncInventoryVitals();
    const fraction=useGameStore.getState().armorBonuses.lifesteal??0;
    if(fraction>0)this.hp=Math.min(this.maxHp,this.hp+actualDamage*Math.min(.25,fraction));
  }

  private resetBasicAttackCombo(){
    this.comboStep=0;this.comboExpiresAt=0;this.comboWeaponId='';this.pendingBasicAttack=null;this.attackQueuedUntil=0;
  }

  private strikeBasicAttack(weapon:WeaponDefinition,direction:Phaser.Math.Vector2,step:BasicAttackStep,hitIds?:Set<string>,emit=true){
    const scene=this.scene as WorldScene;
    if(emit)scene.playSwordSwing(step);
    scene.performPlayerAttack(this,direction,weapon,step,hitIds);
    if(emit&&(weapon.kind==='sword'||weapon.kind==='greatsword')){
      const slash=scene.playEffect('slash',this.x+direction.x*16,this.y+direction.y*16,direction);
      if(step===BASIC_ATTACK_CHAIN[1])slash.setFlipY(true);
      if(step===BASIC_ATTACK_CHAIN[2]){
        slash.setScale(slash.scaleX*1.2).setTint(0xffdeb1);
      }
    }
  }

  takeDamage(amount: number) {
    if(this.skills.isInvulnerable)return;
    const scene = this.scene as WorldScene;
    if(!Number.isFinite(amount)||amount<=0||this.hp<=0)return;
    const now=scene.time.now;
    if(now<this.invulnerableUntil)return;
    const state=useGameStore.getState(),stats=progressionStats(state.attributes,state.learnedSkills,state.armorBonuses);
    if(!this.unlimitedVitals&&Math.random()<stats.evasionChance){
      this.invulnerableUntil=now+180;
      scene.playEffect('fortification',this.x,this.y);
      return;
    }
    if(amount>0)this.weaponDrawnRemaining=5000;
    if(amount>0)this.skills.interruptRenewal();
    this.resetBasicAttackCombo();
    if(this.attackVisual)this.clearAttackVisual();
    this.recovery.interrupt();
    this.invulnerableUntil=now+320+(Math.min(ASCENDED_ATTRIBUTE_CAP,state.attributes.vitality)+(state.armorBonuses.allStats??0))*2;
    this.hp = this.unlimitedVitals?this.maxHp:Math.max(0, this.hp - Math.ceil(amount * this.skills.incomingDamageMultiplier * stats.incomingDamageMultiplier));
    this.setTintFill(0xffd0d0);
    scene.playEffect('hit', this.x, this.y);
    scene.time.delayedCall(100, () => { if (this.active) this.clearTint(); });
    if (this.hp <= 0) scene.requestPlayerRespawn();
  }

  restoreAt(x: number, y: number) {
    this.jumping=false;this.jumpVelocity=0;this.jumpY=0;this.jumpQueuedUntil=0;
    this.resetBasicAttackCombo();
    this.recovery.interrupt();
    this.skills.cancelCast(); this.skills.clearRally();
    this.clearAttackVisual();
    (this.body as Phaser.Physics.Arcade.Body).reset(x, y);
    this.resetVerticalPosition();this.verticalDelta=0;
    this.dashUntil = 0;
    this.invulnerableUntil = 0;
    this.sprintExhausted = false;
    this.hp = this.maxHp;
    this.stamina = this.maxStamina;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.weaponDrawnRemaining=0;
    this.clearTint();
    this.updateSwordVisual();
  }

  resetInput() {
    this.jumpQueuedUntil=0;
    this.resetBasicAttackCombo();
    // Menus must see current combat vitals, not the throttled HUD snapshot;
    // otherwise drinking from Bag can heal from an older health value.
    this.syncInventoryVitals();
    useGameStore.getState().setVitals(this.hp,this.stamina);
    this.skills.cancelCast();
    this.clearAttackVisual();
    mobileInput.reset();
    for (const key of Object.values(this.keys)) key.reset();
    this.dashUntil = 0;
    this.invulnerableUntil = 0;
    this.sprintExhausted = false;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.anims.stop();
    this.pressed.clear();
    this.updateSwordVisual();
  }

  discardActions() {
    this.attackQueuedUntil=0;
    this.pressed.clear();
    for (const action of ['attack', 'dash','jump', 'interact','skill1','skill2','skill3','skill4','healPotion','staminaPotion','targetLock'] as const) mobileInput.consume(action);
  }
  private consumeAction(action: MobileAction) {
    const value = this.pressed.has(action);
    this.pressed.delete(action);
    return value;
  }

  private clearAttackVisual(restoreBody=true) {
    const effect = this.attackVisual; this.attackVisual = null;
    if (effect?.active) effect.destroy();
    if (this.active&&restoreBody) this.setAlpha(1);
  }

  private setPresentationTexture(texture: PlayerPresentationTexture, scale: number) {
    this.anims.stop();
    // Select a cell immediately, not the entire prepared atlas (__BASE).
    // Every pose keeps its feet at the same world anchor and an 18x22 body.
    const layout = actorArtLayout(texture);
    this.setTexture(texture, 0).setScale(scale).setOrigin(.5, layout.originY);
    const sheet = ART_BY_KEY[texture];
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(18 / scale, 22 / scale)
      .setOffset(sheet.frameWidth * sheet.density / 2 - 9 / scale,
        layout.originY * sheet.frameHeight * sheet.density - 22 / scale);
  }

  private playSwordVisual(cooldown:number,stepIndex=0) {
    this.clearAttackVisual();
    const facing=this.presentationDirection;
    const direction = directionFrame(facing.x,facing.y) / 6;
    const animation = PLAYER_COMBO_ATTACK_ANIMATIONS[stepIndex][direction], layout = actorArtLayout('leigneron_attack');
    const effect = this.scene.add.sprite(this.x,this.y,'leigneron_attack',animation.frames[0]).setOrigin(.5,layout.originY)
      .setScale(artScale('leigneron_attack')).setDepth(this.depth).setName('player-sword-visual');
    this.attackVisual = effect;this.attackStep=stepIndex;onPlane(effect,'upright',this); this.setAlpha(0);
    effect.play(animation.key); effect.anims.timeScale = animationDuration(animation) / cooldown;
    effect.once(Phaser.Animations.Events.ANIMATION_COMPLETE,() => { if (this.attackVisual === effect) this.clearAttackVisual(); });
  }

  private refreshAttackView(){
    const effect=this.attackVisual;if(!effect?.active||!effect.anims.isPlaying)return;
    const facing=this.presentationDirection;
    const animation=PLAYER_COMBO_ATTACK_ANIMATIONS[this.attackStep][directionFrame(facing.x,facing.y)/6];
    if(effect.anims.currentAnim?.key===animation.key)return;
    const progress=effect.anims.getProgress(),scale=effect.anims.timeScale;
    effect.anims.play(animation.key);effect.anims.setProgress(progress);effect.anims.timeScale=scale;
  }

  private createDashTrail(time: number) {
    this.nextDashTrailAt = time + 55;
    const trail = this.scene.add.sprite(this.x, this.y, this.texture.key, this.frame.name)
      .setOrigin(this.originX, this.originY).setScale(this.scaleX, this.scaleY)
      .setFlipX(this.flipX).setTint(0x9debdc).setAlpha(0.38).setBlendMode(Phaser.BlendModes.ADD)
      .setDepth((this.scene as WorldScene).playerRenderDepth(this.y) - 1).setName('player-dash-afterimage');
    onPlane(trail,'upright',{get x(){return trail.x;},get y(){return trail.y;},presentationElevation:this.presentationElevation});
    this.scene.tweens.add({ targets: trail, alpha: 0, x: trail.x - this.dashDirection.x * 18,
      y: trail.y - this.dashDirection.y * 18, duration: 180, onComplete: () => trail.destroy() });
  }

  private playMovementAnimation(key: string, texture: PlayerPresentationTexture) {
    const previousKey = this.anims.currentAnim?.key;
    const isSideStride = (animationKey: string | undefined) =>
      animationKey === 'leigneron-right' || animationKey === 'leigneron-run-side';
    const preserveStride = this.anims.isPlaying && previousKey !== key &&
      isSideStride(previousKey) && isSideStride(key);
    const progress = preserveStride ? this.anims.getProgress() : 0;
    if (this.texture.key !== texture) {
      this.setPresentationTexture(texture, artScale(texture));
    }
    this.anims.play(key, true);
    if (preserveStride) this.anims.setProgress(progress);
  }

  // Stick to the current facing axis near diagonal inputs. Avoid
  // alternating front and side animation sheets each frame.
  private movementAxis: 'horizontal' | 'vertical' = 'vertical';

  private updateAnimation(x: number, y: number, running: boolean, directionX: number, directionY: number) {
    if (this.jumping||Math.hypot(x,y) < 3) {
      this.anims.timeScale=1;
      const facing=this.presentationDirection;
      const standingFrame=directionFrame(facing.x,facing.y);
      this.movementAxis = standingFrame === 6 || standingFrame === 12 ? 'horizontal' : 'vertical';
      if (standingFrame === 6 || standingFrame === 12) {
        if (this.texture.key !== 'leigneron_idle_sides') {
          this.setPresentationTexture('leigneron_idle_sides', artScale('leigneron_idle_sides'));
        }
        this.setFlipX(standingFrame === 6);
        this.anims.play('leigneron-idle-side', true);
        return;
      }
      this.setFlipX(false);
      if(standingFrame!==0){
        if(this.texture.key!=='leigneron')this.setPresentationTexture('leigneron',artScale('leigneron'));
        this.anims.stop();this.setFrame(standingFrame);return;
      }
      if (this.texture.key !== 'leigneron_idle') {
        this.setPresentationTexture('leigneron_idle', actorScaleForHeight('leigneron_idle', 0, HERO_VISIBLE_HEIGHT));
      }
      this.anims.play('leigneron-idle', true);
      return;
    }
    // Input (or the locked dash vector) determines facing. Residual velocity
    // during a turn only controls cadence, so pressing down cannot show a
    // sideways run while the previous horizontal motion slows down.
    const hasDirection = Math.hypot(directionX,directionY) > .1;
    const facing=viewDirection(this.scene,hasDirection?directionX:this.lastDirection.x,
      hasDirection?directionY:this.lastDirection.y,this.screenFacing);
    const facingX=facing.x,facingY=facing.y;
    const sideways = this.movementAxis === 'horizontal'
      ? Math.abs(facingX) >= Math.abs(facingY) * 0.78
      : Math.abs(facingX) > Math.abs(facingY) * 1.28;
    this.movementAxis = sideways ? 'horizontal' : 'vertical';
    // These strips depict the right side only. Mirror horizontal travel to
    // the left; retain real front/back art for north/south movement rather
    // than depicting upward/downward travel as a right-facing sprint.
    if (running && sideways) {
      this.setFlipX(facingX < 0);
      this.playMovementAnimation('leigneron-run-side', 'leigneron_running');
      this.anims.timeScale=strideRate(Math.hypot(x,y),this.moveSpeed * 1.42);
      return;
    }
    let key = 'leigneron-down';
    // Both sides share the same poses; mirroring preserves the stride phase
    // when turning instead of restarting a separate left/right animation.
    if (sideways) key = 'leigneron-right';
    else key = facingY < 0 ? 'leigneron-up' : 'leigneron-down';
    this.setFlipX(sideways && facingX < 0);
    this.playMovementAnimation(key, 'leigneron');
    this.anims.timeScale=strideRate(Math.hypot(x,y),this.moveSpeed);
  }
}
