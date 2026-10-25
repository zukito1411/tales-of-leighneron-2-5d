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
  get lockedTarget(){const e=this.locked;return e?.active&&e.visible&&e.isAlive&&e.canBeTargeted?e:null;}
  static readonly acquireRange=720;
  static readonly breakRange=900;
  private engaged:Enemy|null=null;
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
  nearest(range:number) {
    // Locking never increases a weapon/art's range or bypasses cover.
    if(this.lockedTarget)return this.eligible(this.lockedTarget,range)?this.lockedTarget:null;
    const player=this.scene.player,range2=range*range;
    const candidates=this.nearestCandidates;
    let count=0;
    for(const enemy of this.scene.getCombatEnemies()){
      if(!enemy.active||!enemy.visible||!enemy.isAlive||!enemy.canBeTargeted)continue;
      const dx=enemy.x-player.x,dy=enemy.y-player.y,distance2=dx*dx+dy*dy;
      if(distance2>range2)continue;
      // Automatic assistance follows what the free camera can see. Manual
      // locks keep their original range/LOS rules when briefly offscreen.
      if(presentationView(this.scene)&&!worldPointInView(this.scene,enemy.x,enemy.y,Math.max(30,(enemy.definition.bodyRadius??12)*2),48))continue;
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
      if(this.scene.canSeeEnemy(enemy)&&this.scene.hasClearPath(player.x,player.y,enemy.x,enemy.y))return enemy;
    return null;
  }
  select(enemy:Enemy){
    if(!this.eligible(enemy,TargetingSystem.acquireRange))return;
    this.locked=this.manual=this.selected=enemy;this.lastClearAt=this.scene.time.now;this.sightCheckAt=0;
    this.publishLock();this.publishBoss(true);
  }
  toggleLock(){
    if(this.locked){this.locked=null;this.manual=null;this.publishLock();this.publishBoss();return;}
    const selected=this.selected;
    const enemy=selected&&this.eligible(selected,TargetingSystem.acquireRange)
      &&worldPointInView(this.scene,selected.x,selected.y,40,48)?selected:this.nearest(TargetingSystem.acquireRange);
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
      let valid=this.lockedTarget!==null&&p.hp>0&&this.scene.combatAllowed
        &&Math.hypot(locked.x-p.x,locked.y-p.y)<=TargetingSystem.breakRange;
      if(valid&&now>=this.sightCheckAt){
        this.sightCheckAt=now+100;
        if(this.scene.canSeeEnemy(locked)&&this.scene.hasClearPath(p.x,p.y,locked.x,locked.y))this.lastClearAt=now;
        else if(now-this.lastClearAt>850)valid=false;
      }
      if(valid){this.selected=locked;this.publishBoss(true);return;}
      this.locked=null;this.manual=null;this.publishLock();
    }
    const manual=this.manual,manualEligible=manual!==null&&this.eligible(manual);
    if(!manualEligible)this.manual=null;
    if(this.engaged&&(this.engaged===manual?!manualEligible:!this.eligible(this.engaged)))this.engaged=null;
    this.selected=this.manual??this.nearest(680);this.publishBoss(true);
  }
  clear(){this.locked=null;this.manual=null;this.engaged=null;this.selected=null;this.publishLock();this.publishBoss();}
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
