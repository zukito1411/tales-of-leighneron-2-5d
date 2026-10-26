import Phaser from 'phaser';
import {STORY_ENCOUNTER_BY_ID,storyEncounterDefeated,type StoryEncounter} from '../../data/adventure';
import {ENEMY_BY_ID} from '../../data/enemies';
import {QUESTS} from '../../data/quests';
import {useGameStore} from '../../store/gameStore';
import {nextObjective} from './storyProgress';
import {MAX_LIVE_HOSTILES} from './encounterAdmission';
import {pendingStoryWave} from './storyEncounterPlacement';
import {StoryAllySystem} from './StoryAllySystem';
import type {WorldScene} from '../scenes/WorldScene';
import type {Enemy} from '../entities/Enemy';
import type {Npc} from '../entities/Npc';
import type {Vec2} from '../types';
import {onWorldLabel} from '../presentation25d/plane';

/** Finite quest-owned Enemy actors. Combat, targeting, art and damage remain
 * the ordinary game systems. Only permission, waves and lifecycle live here. */
export class StoryEncounterSystem {
  private encounter:StoryEncounter|null=null;
  private anchor:Vec2={x:0,y:0};
  private roomId:string|null=null;
  private readonly actors=new Map<Enemy,number>();
  private readonly reactions=new Set<Npc>();
  private readonly allies:StoryAllySystem;
  private retryAt=0;
  private workMs=0;
  private working=false;
  private label:Phaser.GameObjects.Text|null=null;
  private warned=false;
  private placementFailures=0;
  private placementPaused=false;
  private retryPosition:Vec2={x:0,y:0};
  constructor(private readonly scene:WorldScene){this.allies=new StoryAllySystem(scene);}
  get active(){return this.encounter!==null;}
  get id(){return this.encounter?.id;}
  get prompt(){
    const e=this.encounter;if(!e)return null;
    if(this.placementPaused)return 'Retry attackers from open ground';
    if(!e.work||Math.hypot(this.scene.player.x-this.anchor.x,this.scene.player.y-this.anchor.y)>120)return null;
    const flags=useGameStore.getState().storyFlags;
    return !this.actors.size&&storyEncounterDefeated(e,flags)?e.work.label:null;
  }
  owns(enemy:Enemy){return this.actors.has(enemy);}
  allows(point:Vec2){return this.active&&this.roomId===this.scene.activeInteriorId
    &&Math.hypot(point.x-this.anchor.x,point.y-this.anchor.y)<=this.encounter!.radius;}
  private key(slot:number){return `encounter:${this.encounter!.id}:defeated:${slot}`;}
  private eligible(){
    const quests=useGameStore.getState().quests;
    let nearest:StoryEncounter|null=null,distance=Infinity;
    for(const quest of QUESTS){
      const objective=nextObjective(quest.id,quests);
      if(objective?.type==='encounter'){
        const e=STORY_ENCOUNTER_BY_ID[objective.targetId];
        const point=e&&this.scene.storyEncounterAnchor(e);
        if(e&&point&&e.questId===quest.id&&e.objectiveId===objective.id){
          const d=Math.hypot(point.x-this.scene.player.x,point.y-this.scene.player.y);
          if(d>e.radius+180)continue;
          if(this.encounter?.id===e.id)return e;
          if(d<distance){distance=d;nearest=e;}
        }
      }
    }
    return nearest;
  }
  update(time:number,delta:number,blocked:boolean){
    this.allies.maintain();
    const next=this.eligible(),point=next&&this.scene.storyEncounterAnchor(next);
    if(this.encounter&&(!next||next.id!==this.encounter.id||!point
      ||this.roomId!==this.scene.activeInteriorId||Math.hypot(this.scene.player.x-this.anchor.x,this.scene.player.y-this.anchor.y)>this.encounter.radius+180))this.clear();
    if(blocked){this.allies.update(0,this.actors.keys(),this.anchor,this.encounter?.radius??0,true);return;}
    if(!this.encounter){
      if(!next||!point||Math.hypot(this.scene.player.x-point.x,this.scene.player.y-point.y)>Math.min(320,next.radius*.6))return;
      this.encounter=next;this.anchor={...point};this.roomId=this.scene.activeInteriorId;
      this.scene.prepareStoryArena();
      this.retryAt=time+1600;this.warned=false;
      this.scene.targeting.clear();this.scene.player.resetInput();
      const state=useGameStore.getState();state.hydrate({trackedQuestId:next.questId});
      this.scene.notify(next.warning);this.scene.playAudio('sfx-heal-bell',.45,.65);
      this.label=onWorldLabel(this.scene.add.text(point.x,point.y-100,next.name,{fontFamily:'Georgia, serif',fontSize:'12px',
        color:'#ffe2a2',stroke:'#19120c',strokeThickness:3}).setResolution(2).setOrigin(.5),this.anchor);
      this.react();
      if(this.scene.playStoryIntro(next.id))return;
    }
    const e=this.encounter!,flags=useGameStore.getState().storyFlags;
    // Resolve the first unfinished wave from saved kills. Re-entering, dying
    // or restarting cannot recreate defeated slots or farm their rewards.
    let start=0,wave:readonly string[]|undefined;
    for(const candidates of e.waves){
      if(candidates.some((_,i)=>!flags[this.key(start+i)])){wave=candidates;break;}
      start+=candidates.length;
    }
    if(wave)this.interruptWork();
    if(this.placementPaused&&Math.hypot(this.scene.player.x-this.retryPosition.x,this.scene.player.y-this.retryPosition.y)>=96){
      this.placementPaused=false;this.placementFailures=0;this.retryAt=time;
    }
    if(wave&&!this.actors.size&&!this.placementPaused&&time>=this.retryAt){
      this.retryAt=time+1200;
      const capacity=Math.max(0,MAX_LIVE_HOSTILES-this.scene.countEnemies());
      const pending=pendingStoryWave(e.id,wave,start,flags,capacity);
      if(pending&&pending.every(s=>this.scene.ensureStoryEnemy(s.enemyId))){
        const positions:Vec2[]=[];
        for(const member of pending){
          let position:Vec2|undefined;
          for(const radius of this.roomId?[220,290,360,430]:[430,360,290,220])for(let i=0;!position&&i<20;i++){
            const angle=(i+member.slot*3)*Math.PI/10,p={x:this.anchor.x+Math.cos(angle)*radius,y:this.anchor.y+Math.sin(angle)*radius};
            if(this.allows(p)&&Math.hypot(p.x-this.scene.player.x,p.y-this.scene.player.y)>=160
              &&positions.every(q=>Math.hypot(q.x-p.x,q.y-p.y)>=80)&&this.scene.storySpawnClear(p,member.enemyId))position=p;
          }
          if(!position)break;positions.push(position);
        }
        if(positions.length<pending.length){
          const largest=pending.reduce((a,b)=>(ENEMY_BY_ID[a.enemyId].bodyRadius??11)>=(ENEMY_BY_ID[b.enemyId].bodyRadius??11)?a:b);
          const nearby=this.scene.storySpawnCandidates(this.anchor,e.radius,largest.enemyId),recovered:Vec2[]=[];
          for(const p of nearby){
            if(Math.hypot(p.x-this.scene.player.x,p.y-this.scene.player.y)<128
              ||recovered.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<80))continue;
            recovered.push(p);if(recovered.length===pending.length)break;
          }
          if(recovered.length>positions.length)positions.splice(0,positions.length,...recovered);
        }
        let spawned=false;
        if(positions.length===pending.length){
          try{
            positions.forEach((position,i)=>{const member=pending[i];
              const enemy=this.scene.createStoryEnemy(member.enemyId,position,`story-event:${e.id}:${member.slot}`);
              this.actors.set(enemy,member.slot);
            });
            this.react();this.warned=false;this.placementFailures=0;spawned=true;
          }catch(error){for(const actor of this.actors.keys())this.scene.releaseStoryEnemy(actor);this.actors.clear();
            console.error('Story wave creation failed:',e.id,error);}
        }
        if(!spawned){
          this.placementFailures++;
          if(this.placementFailures>=3){
            if(this.scene.recoverStoryEncounter(e))return;
            this.placementPaused=true;this.retryPosition={x:this.scene.player.x,y:this.scene.player.y};
            this.label?.setText('No clear approach · move to open ground and interact');
          }
          if(!this.warned||this.placementPaused){this.warned=true;
            this.scene.notify('The attackers have no clear approach. Move to open ground near the marker and interact to retry.');}
        }
      }
    }
    this.allies.update(delta,this.actors.keys(),this.anchor,e.radius,false);
    if(!wave&&!this.actors.size){
      if(!e.work){this.complete();return;}
      const player=this.scene.player;
      if(this.working&&Math.hypot(player.x-this.anchor.x,player.y-this.anchor.y)<=120
        &&(player.body as Phaser.Physics.Arcade.Body).velocity.length()<8&&!player.skills.isCasting){
        this.workMs+=Math.min(delta,100);
        this.label?.setText(`${e.work.label} · ${Math.floor(this.workMs/e.work.duration*100)}%`);
        if(this.workMs>=e.work.duration){this.scene.playEffect('fortification',this.anchor.x,this.anchor.y);this.complete();return;}
      }else{this.interruptWork();this.label?.setText(e.work.label+' · approach and interact');}
    }
  }
  interact(){
    if(!this.encounter)return false;
    if(this.placementPaused){this.placementPaused=false;this.placementFailures=0;this.retryAt=0;this.interruptWork();return true;}
    if(this.actors.size||!storyEncounterDefeated(this.encounter,useGameStore.getState().storyFlags)){
      this.interruptWork();this.scene.notify('Defeat all attackers before working.');return true;
    }
    if(this.encounter.work&&Math.hypot(this.scene.player.x-this.anchor.x,this.scene.player.y-this.anchor.y)<=120){
      this.working=true;this.scene.notify(this.encounter.work.label+' — stay beside it until finished.');
    }else this.scene.notify(this.actors.size?'Deal with the attackers before speaking or travelling.':'Return to the marked story site.');
    return true;
  }
  interruptWork(){this.working=false;this.workMs=0;}
  pauseAllies(){this.allies.update(0,this.actors.keys(),this.anchor,this.encounter?.radius??0,true);}
  defeated(enemy:Enemy){
    const slot=this.actors.get(enemy);if(slot===undefined)return false;
    const key=this.key(slot);this.actors.delete(enemy);
    if(!useGameStore.getState().storyFlags[key])useGameStore.getState().setStoryFlag(key);
    enemy.createDeathVisual();this.scene.releaseStoryEnemy(enemy);this.retryAt=this.scene.time.now+1700;
    return true;
  }
  private react(){
    const e=this.encounter!;
    for(const npc of this.scene.storyResidents()){
      if(!npc.active||Math.hypot(npc.x-this.anchor.x,npc.y-this.anchor.y)>e.radius)continue;
      this.reactions.add(npc);
      npc.setStoryAlert(npc.definition.combatant?'Behind me! Keep the lane clear!':e.interiorNpcId?'Keep away from the doors!':'Inside! Get away from the road!');
      if(npc.definition.id===e.npcId||npc.definition.id===e.interiorNpcId)continue;
      if(!npc.canStoryWalk)continue; // Idle-only regional art must never skate across the floor.
      if(!npc.definition.combatant&&!npc.usesRegionalPresentation){
        const dx=npc.x-this.anchor.x,dy=npc.y-this.anchor.y,length=Math.max(1,Math.hypot(dx,dy));
        const point={x:npc.x+dx/length*100,y:npc.y+dy/length*100};
        if(this.scene.canNpcVisit(npc,point))npc.beginStoryMovement(point);
      }
    }
    this.allies.recruit(this.reactions);
  }
  private complete(){
    const e=this.encounter!;this.clear();
    useGameStore.getState().setStoryFlag('encounter:'+e.id+':complete');
    this.scene.lightStorySignal(e.id);
    useGameStore.getState().progressQuest('encounter',e.id,1,e.questId);this.scene.notify(e.aftermath);this.scene.syncState();
  }
  clear(){
    for(const actor of this.actors.keys())this.scene.releaseStoryEnemy(actor);this.actors.clear();
    for(const npc of this.reactions)if(npc.active){npc.setStoryAlert();npc.endStoryMovement();}
    this.reactions.clear();this.allies.clear();this.label?.destroy();this.label=null;
    this.encounter=null;this.roomId=null;this.interruptWork();this.scene.targeting.clear();
    this.placementFailures=0;this.placementPaused=false;
  }
  destroy(){this.clear();this.allies.destroy();}
}
