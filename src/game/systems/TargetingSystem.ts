import type {Enemy} from '../entities/Enemy';
import type {WorldScene} from '../scenes/WorldScene';
import {BOSS_BY_ID} from '../../data/enemies';
import {useGameStore} from '../../store/gameStore';
import {presentationView,worldPointInView} from '../presentation25d/plane';

/** Shared eligibility for indicators, automatic casts and deliberate selection. */
export class TargetingSystem {
  selected:Enemy|null=null;
  private manual:Enemy|null=null;
  private locked:Enemy|null=null;
  private sightCheckAt=0;private lastClearAt=0;
  get lockedTarget(){const e=this.locked;return e?.active&&e.visible&&e.isAlive&&e.canRemainLocked?e:null;}
  static readonly acquireRange=720;
  static readonly breakRange=900;
  private engaged:Enemy|null=null;
  private nextSelectionAt=0;
  private indicatorSequence=0;
  private readonly indicatorSight=new WeakMap<Enemy,{until:number;x:number;y:number;px:number;py:number;eligible:boolean}>();
  // Reuse selection candidates, avoiding per-frame allocation churn.
  private readonly nearestCandidates:Array<{enemy:Enemy;distance2:number}>=[];

  constructor(private readonly scene:WorldScene){scene.events.once('shutdown',()=>this.clear());}
  eligible(enemy:Enemy,range=680) {
    const player=this.scene.player;
    const dx=enemy.x-player.x,dy=enemy.y-player.y;
    return enemy.active&&enemy.visible&&enemy.isAlive&&enemy.canBeTargeted
      && dx*dx+dy*dy<=range*range
      && this.scene.canSeeEnemy(enemy)&&this.scene.hasClearPath(player.x,player.y,enemy.x,enemy.y);
  }
  private lockEligible(enemy:Enemy,range:number){
    const p=this.scene.player;
    return enemy.active&&enemy.visible&&enemy.isAlive&&enemy.canRemainLocked
      &&(enemy.x-p.x)**2+(enemy.y-p.y)**2<=range*range&&this.scene.canSeeEnemy(enemy)
      &&(enemy.isAirborne||this.scene.hasClearPath(p.x,p.y,enemy.x,enemy.y));
  }
  private lockHeight(enemy:Enemy){
    return Math.max(30,(enemy.definition.bodyRadius??12)*2)
      +Math.max(0,enemy.y-enemy.presentationLockVisual.y)+enemy.presentationElevation;
  }
  /** Indicators may reuse brief sight checks. Combat eligibility above stays
   * immediate, so a cached label never authorizes a hit through new cover. */
  indicatorEligible(enemy:Enemy){
    if(!enemy.active||!enemy.visible||!enemy.isAlive)return false;
    if(enemy===this.lockedTarget)return true;
    if(!enemy.canBeTargeted)return false;
    const p=this.scene.player,dx=enemy.x-p.x,dy=enemy.y-p.y;
    if(dx*dx+dy*dy>680*680)return false;
    let cached=this.indicatorSight.get(enemy);
    const now=this.scene.time.now;
    if(cached&&now<cached.until&&Math.abs(enemy.x-cached.x)<20&&Math.abs(enemy.y-cached.y)<20
      &&Math.abs(p.x-cached.px)<20&&Math.abs(p.y-cached.py)<20)return cached.eligible;
    const eligible=this.eligible(enemy);
    if(!cached){cached={until:0,x:0,y:0,px:0,py:0,eligible};this.indicatorSight.set(enemy,cached);}
    Object.assign(cached,{until:now+80+(this.indicatorSequence++%6)*8,x:enemy.x,y:enemy.y,px:p.x,py:p.y,eligible});
    return eligible;
  }
  /** Deliberate/visible selection wins over proximity; cover and range still apply. */
  skillTarget(range:number){
    const selected=this.lockedTarget??this.selected;
    return selected&&this.eligible(selected,range)?selected:this.nearest(range);
  }
  meleeTarget(range:number,direction:{x:number;y:number}){
    const selected=this.skillTarget(range);
    if(!selected)return null;
    const dx=selected.x-this.scene.player.x,dy=selected.y-this.scene.player.y;
    // A lock permits deliberate turns. Assistance never snaps a free swing backward.
    return this.lockedTarget||dx*direction.x+dy*direction.y>=Math.hypot(dx,dy)*.35?selected:null;
  }
  nearest(range:number,forLock=false) {
    // Locking never increases a weapon/art's range or bypasses cover.
    const locked=this.lockedTarget;
    if(locked)return (forLock?this.lockEligible(locked,range):this.eligible(locked,range))?locked:null;
    const player=this.scene.player,range2=range*range;
    const candidates=this.nearestCandidates;
    let count=0;
    for(const enemy of this.scene.getCombatEnemies()){
      if(!enemy.active||!enemy.visible||!enemy.isAlive||!(forLock?enemy.canRemainLocked:enemy.canBeTargeted))continue;
      const dx=enemy.x-player.x,dy=enemy.y-player.y,distance2=dx*dx+dy*dy;
      if(distance2>range2)continue;
      // Automatic assistance follows what the free camera can see. Manual
      // locks keep their original range/LOS rules when briefly offscreen.
      if(presentationView(this.scene)&&!worldPointInView(this.scene,enemy.x,enemy.y,forLock?this.lockHeight(enemy):Math.max(30,(enemy.definition.bodyRadius??12)*2),48))continue;
      if(count<candidates.length){candidates[count].enemy=enemy;candidates[count].distance2=distance2;}
      else candidates.push({enemy,distance2});
      count++;
    }
    candidates.length=count;
    // Range/visibility are cheap. Test expensive line-of-sight only for the
    // closest candidates until one qualifies; this preserves nearest-target
    // semantics without checking every distant enemy's obstruction each tick.
    candidates.sort((a,b)=>a.distance2-b.distance2);
    for(const {enemy} of candidates)
      if(forLock?this.lockEligible(enemy,range):this.scene.canSeeEnemy(enemy)&&this.scene.hasClearPath(player.x,player.y,enemy.x,enemy.y))return enemy;
    return null;
  }
  select(enemy:Enemy){
    if(!this.lockEligible(enemy,TargetingSystem.acquireRange))return;
    this.locked=this.manual=this.selected=enemy;this.lastClearAt=this.scene.time.now;this.sightCheckAt=0;
    this.nextSelectionAt=0;this.publishLock();this.publishBoss(true);
  }
  toggleLock(){
    if(this.locked){this.locked=null;this.manual=null;this.nextSelectionAt=0;this.publishLock();this.publishBoss();return;}
    const selected=this.selected;
    const enemy=selected&&this.lockEligible(selected,TargetingSystem.acquireRange)
      &&worldPointInView(this.scene,selected.x,selected.y,this.lockHeight(selected),48)?selected:this.nearest(TargetingSystem.acquireRange,true);
    if(enemy)this.select(enemy);else this.scene.notify('No visible enemy in lock range.');
  }
  private publishLock(){
    const enemy=this.lockedTarget,next=enemy?{id:enemy.instanceId,name:enemy.definition.name}:null;
    const previous=useGameStore.getState().targetLock;
    if(previous?.id!==next?.id||previous?.name!==next?.name)useGameStore.setState({targetLock:next});
  }
  /** Nearest-enemy assistance is not a request to open a boss health bar.
   * A deliberate selection or an actual player hit confirms combat intent. */
  engage(enemy:Enemy){if(this.selected===enemy){this.engaged=enemy;this.publishBoss();}}
  update(){
    const locked=this.locked,now=this.scene.time.now;
    if(locked){
      const p=this.scene.player;
      const airborne=locked.isAirborne&&locked.canRemainLocked;
      let valid=this.lockedTarget!==null&&p.hp>0&&this.scene.combatAllowed
        &&(airborne||Math.hypot(locked.x-p.x,locked.y-p.y)<=TargetingSystem.breakRange);
      if(valid&&airborne)this.lastClearAt=now;
      else if(valid&&now>=this.sightCheckAt){
        this.sightCheckAt=now+100;
        if(this.scene.canSeeEnemy(locked)&&this.scene.hasClearPath(p.x,p.y,locked.x,locked.y))this.lastClearAt=now;
        else if(now-this.lastClearAt>850)valid=false;
      }
      if(valid){this.selected=locked;this.publishBoss(true);return;}
      this.locked=null;this.manual=null;this.publishLock();
      this.nextSelectionAt=0;
    }
    // Automatic assistance is a perception decision, not a damage check.
    // Keep the selected actor between decisions; casts/hits still call eligible.
    if(now<this.nextSelectionAt){
      const e=this.selected,p=this.scene.player;
      if(!e||e.active&&e.visible&&e.isAlive&&e.canBeTargeted&&(e.x-p.x)**2+(e.y-p.y)**2<=680*680){this.publishBoss(true);return;}
    }
    this.nextSelectionAt=now+100;
    const manual=this.manual,manualEligible=manual!==null&&this.eligible(manual);
    if(!manualEligible)this.manual=null;
    if(this.engaged&&(this.engaged===manual?!manualEligible:!this.eligible(this.engaged)))this.engaged=null;
    this.selected=this.manual??this.nearest(680);this.publishBoss(true);
  }
  clear(){this.locked=null;this.manual=null;this.engaged=null;this.selected=null;this.nextSelectionAt=0;this.publishLock();this.publishBoss();}
  private publishBoss(selectionChecked=false){
    const enemy=this.selected;
    const boss=enemy&&(enemy.definition.boss||enemy.isBossEncounter)&&(enemy===this.manual||enemy===this.engaged)
      &&(selectionChecked||this.eligible(enemy))?enemy:null;
    const next=boss?{id:boss.instanceId,name:BOSS_BY_ID[boss.instanceId.replace(/^boss:/,'')]?.name??boss.definition.name,
      hp:Math.max(0,Math.round(boss.hp)),maxHp:boss.definition.hp,
      phase:boss.bossPhase,refilling:boss.bossRegenerating}:null;
    const store=useGameStore.getState(),previous=store.bossEncounter;
    if(previous?.id!==next?.id||previous?.hp!==next?.hp||previous?.maxHp!==next?.maxHp||previous?.name!==next?.name
      ||previous?.phase!==next?.phase||previous?.refilling!==next?.refilling)
      store.setBossEncounter(next);
  }
}
