import type {Enemy} from '../entities/Enemy';
import type {WorldScene} from '../scenes/WorldScene';
import {BOSS_BY_ID} from '../../data/enemies';
import {useGameStore} from '../../store/gameStore';
import {presentationView,worldPointInView} from '../presentation25d/plane';

/** Shared eligibility for indicators, automatic casts and deliberate selection. */
export class TargetingSystem {
  selected:Enemy|null=null;
  private manual:Enemy|null=null;
  private engaged:Enemy|null=null;
  // Reuse selection candidates, avoiding per-frame allocation churn.
  private readonly nearestCandidates:Array<{enemy:Enemy;distance2:number}>=[];

  constructor(private readonly scene:WorldScene){}
  eligible(enemy:Enemy,range=680) {
    const player=this.scene.player;
    const dx=enemy.x-player.x,dy=enemy.y-player.y;
    return enemy.active&&enemy.visible&&enemy.isAlive&&enemy.canBeTargeted
      && dx*dx+dy*dy<=range*range
      && this.scene.canSeeEnemy(enemy)&&this.scene.hasClearPath(player.x,player.y,enemy.x,enemy.y);
  }
  nearest(range:number) {
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
  select(enemy:Enemy){if(this.eligible(enemy)){this.manual=enemy;this.selected=enemy;this.publishBoss(true);}}
  /** Nearest-enemy assistance is not a request to open a boss health bar.
   * A deliberate selection or an actual player hit confirms combat intent. */
  engage(enemy:Enemy){if(this.selected===enemy){this.engaged=enemy;this.publishBoss();}}
  update(){
    const manual=this.manual,manualEligible=manual!==null&&this.eligible(manual);
    if(!manualEligible)this.manual=null;
    if(this.engaged&&(this.engaged===manual?!manualEligible:!this.eligible(this.engaged)))this.engaged=null;
    // Both the manual and nearest paths validated this selection already.
    // Reuse that result within this call, never across movement/physics ticks.
    this.selected=this.manual??this.nearest(680);this.publishBoss(true);
  }
  clear(){this.manual=null;this.engaged=null;this.selected=null;this.publishBoss();}
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
