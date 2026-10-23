import Phaser from 'phaser';
import type {Npc} from '../entities/Npc';
import type {Enemy} from '../entities/Enemy';
import type {WorldScene} from '../scenes/WorldScene';
import type {Vec2} from '../types';
import {NPC_ARROW_TEXTURE} from '../../data/npcCombatArt';
import {NpcCombatResidency} from './NpcCombatResidency';
import {onDirectionalSprite} from '../presentation25d/plane';

interface Helper {
  origin:Vec2;cooldown:number;think:number;target:Enemy|null;goal:Vec2|null;
  attack:{enemy:Enemy;direction:Phaser.Math.Vector2;hit:boolean}|null;
}
interface Arrow {
  sprite:Phaser.GameObjects.Image;source:Npc|null;x:number;y:number;vx:number;vy:number;age:number;
}
/** Independent defenders, restricted to the active event's own enemies and
 * arena. Decision ticks, personal cooldowns and eight pooled arrows bound work. */
export class StoryAllySystem {
  private readonly helpers=new Map<Npc,Helper>();
  private readonly candidates=new Set<Npc>();
  private readonly arrows:Arrow[]=[];
  private readonly art:NpcCombatResidency;
  private paused=false;
  private recruitMs=0;
  // Reuse scratch collection objects; rebuild live membership every frame.
  private readonly actors:Enemy[]=[];
  private readonly live=new Set<Enemy>();
  private readonly claims=new Map<Enemy,number>();
  private readonly reserved=new Map<Npc,Vec2>();
  constructor(private readonly scene:WorldScene){
    this.art=new NpcCombatResidency(scene,spec=>
      [...this.candidates].some(n=>n.active&&n.combatProfile?.id===spec.id)
      ||scene.storyResidents().some(n=>n.active&&n.storyMoving&&n.combatProfile?.id===spec.id)
      ||scene.children.list.some(o=>o instanceof Phaser.GameObjects.Sprite&&o.texture.key===spec.texture),
      message=>{console.warn(message);scene.notify('A defender’s combat artwork could not load; retrying shortly.');});
  }
  recruit(residents:Iterable<Npc>){
    for(const npc of residents)if(npc.active&&npc.definition.combatant)this.candidates.add(npc);
    for(const npc of this.candidates){
      if(!npc.active){this.candidates.delete(npc);this.helpers.delete(npc);continue;}
      const spec=npc.combatProfile;
      if(!spec||!this.art.ensure(spec)||this.helpers.has(npc)||!npc.canStoryFight)continue;
      this.helpers.set(npc,{origin:{x:npc.x,y:npc.y},cooldown:600+this.helpers.size%5*90,
        think:0,attack:null,target:null,goal:null});
      npc.beginStoryGuard();
    }
  }
  private hit(enemy:Enemy,direction:Phaser.Math.Vector2){
    if(!enemy.active||!enemy.canBeTargeted||enemy.hp<=0)return;
    // No player-hit prerequisite or lifetime damage ceiling. Small attacks can
    // finish event enemies through their normal quest-owned defeat lifecycle.
    enemy.takeDamage(Math.max(1,Math.round(enemy.definition.hp*.025)),direction,{source:'story-ally'});
  }
  maintain(){this.art.update();}
  update(delta:number,enemies:Iterable<Enemy>,anchor:Vec2,radius:number,blocked:boolean){
    this.maintain();
    if(blocked&&this.paused)return;
    this.paused=blocked;
    if(blocked){
      for(const helper of this.helpers.values()){helper.attack=null;helper.goal=null;}
      for(const npc of this.helpers.keys())if(npc.active){npc.endStoryAttack();npc.endStoryMovement();}
      this.hideArrows();return;
    }
    const step=Math.min(Math.max(0,delta),80);
    this.recruitMs-=step;
    if(this.recruitMs<=0){
      this.recruitMs=500;
      this.recruit(this.scene.storyResidents().filter(npc=>Math.hypot(npc.x-anchor.x,npc.y-anchor.y)<=radius));
    }else this.recruit(this.candidates);
    if(!this.helpers.size)return;
    const {actors,live,claims,reserved}=this;
    actors.length=0;live.clear();claims.clear();reserved.clear();
    for(const enemy of enemies)if(enemy.active&&enemy.canBeTargeted&&enemy.hp>0
      &&Math.hypot(enemy.x-anchor.x,enemy.y-anchor.y)<=radius){actors.push(enemy);live.add(enemy);}
    let residents:Npc[]|undefined;
    this.advanceArrows(step,actors);
    for(const [npc,helper] of this.helpers){
      if(!helper.target||!live.has(helper.target)||!helper.target.active||helper.target.hp<=0){helper.target=null;helper.goal=null;}
      if(helper.target)claims.set(helper.target,(claims.get(helper.target)??0)+1);
      if(helper.goal)reserved.set(npc,helper.goal);
    }
    for(const [npc,helper] of this.helpers){
      if(!npc.active){this.helpers.delete(npc);continue;}
      if(npc.escorting){npc.endStoryGuard();this.helpers.delete(npc);continue;}
      helper.cooldown=Math.max(0,helper.cooldown-step);
      const attack=helper.attack;
      if(attack){
        if(!live.has(attack.enemy)||!attack.enemy.active||attack.enemy.hp<=0){
          helper.attack=null;helper.target=null;helper.goal=null;helper.think=0;
          npc.endStoryAttack();continue;
        }
        if(!attack.hit&&npc.storyStrikeReady){
          attack.hit=true;
          const enemy=attack.enemy,dx=enemy.x-npc.x,dy=enemy.y-npc.y,length=Math.hypot(dx,dy);
          if(live.has(enemy)&&enemy.active&&enemy.canBeTargeted&&enemy.hp>0
            &&length>0&&length<=npc.storyAttackReach+8
            &&(dx*attack.direction.x+dy*attack.direction.y)/length>=.55
            &&this.scene.hasClearPath(npc.x,npc.y,enemy.x,enemy.y)){
            if(npc.combatProfile?.mode==='bow')this.fireArrow(npc,enemy);
            else this.hit(enemy,attack.direction);
          }
        }
        if(npc.storyAttackFinished){helper.attack=null;npc.endStoryAttack();helper.think=0;}
        continue;
      }
      helper.think-=step;if(helper.think>0)continue;helper.think=200;
      const previous=helper.target;
      if(previous)claims.set(previous,Math.max(0,(claims.get(previous)??0)-1));
      reserved.delete(npc);helper.goal=null;
      let target:Enemy|undefined,best=Infinity;
      for(const enemy of actors){
        const distance=Math.hypot(enemy.x-npc.x,enemy.y-npc.y);
        if(!enemy.active||!enemy.canBeTargeted||enemy.hp<=0)continue;
        // Favor reachable nearby foes with fewer defenders, keeping a modest
        // preference for the current opponent so enemies moving past do not
        // make everyone abandon their fight or pile onto the player's target.
        const score=distance+(claims.get(enemy)??0)*128-(enemy===previous?72:0);
        // A worse score cannot win, so avoid its terrain/collider raycast.
        if(score<best&&this.scene.hasClearPath(npc.x,npc.y,enemy.x,enemy.y)){target=enemy;best=score;}
      }
      helper.target=target??null;
      if(!target){npc.endStoryMovement();continue;}
      claims.set(target,(claims.get(target)??0)+1);
      if(Math.hypot(target.x-npc.x,target.y-npc.y)<=npc.storyAttackReach){
        npc.holdStoryGuard(target);
        if(helper.cooldown===0&&npc.beginStoryAttack(target)){
          helper.attack={enemy:target,direction:new Phaser.Math.Vector2(target.x-npc.x,target.y-npc.y).normalize(),hit:false};
          helper.cooldown=2300;
        }
        continue;
      }
      // Only collect nearby residents when a defender actually needs a new
      // approach. Idle, attacking and cooldown frames need no resident scan.
      const approachResidents=residents??=this.scene.storyResidents();
      const angle=Math.atan2(npc.y-target.y,npc.x-target.x),stand=npc.storyAttackReach*.8;
      let goal:Vec2|undefined;
      const clearApproach=(p:Vec2)=>{
        if(Math.hypot(p.x-anchor.x,p.y-anchor.y)>Math.max(0,radius-24)
          ||Math.hypot(p.x-this.scene.player.x,p.y-this.scene.player.y)<48
          ||approachResidents.some(other=>other!==npc&&other.active&&Math.hypot(other.x-p.x,other.y-p.y)<48)
          ||actors.some(enemy=>enemy.active&&Math.hypot(enemy.x-p.x,enemy.y-p.y)<(enemy.definition.bodyRadius??11)+24))return false;
        for(const point of reserved.values())if(Math.hypot(point.x-p.x,point.y-p.y)<48)return false;
        return this.scene.canNpcVisit(npc,p)&&!this.scene.npcPathBlocker(npc,p,npc);
      };
      for(const offset of [0,.45,-.45,.9,-.9,1.4,-1.4,Math.PI]){
        const p={x:target.x+Math.cos(angle+offset)*stand,y:target.y+Math.sin(angle+offset)*stand};
        if(!clearApproach(p))continue;
        goal=p;break;
      }
      // A defender behind another must be able to step around the crowd,
      // rather than repeatedly requesting the same blocked attack position.
      if(!goal)for(const offset of [-1.2,1.2,-1.8,1.8]){
        const heading=angle+Math.PI+offset,p={x:npc.x+Math.cos(heading)*72,y:npc.y+Math.sin(heading)*72};
        if(clearApproach(p)){goal=p;break;}
      }
      if(goal){helper.goal=goal;reserved.set(npc,goal);npc.beginStoryMovement(goal);}
      else npc.endStoryMovement();
    }
  }
  private fireArrow(npc:Npc,target:Enemy){
    if(!this.scene.textures.exists(NPC_ARROW_TEXTURE))return;
    let flight=this.arrows.find(a=>!a.sprite.active);
    if(!flight){
      if(this.arrows.length>=8)return;
      const sprite=this.scene.add.image(0,0,NPC_ARROW_TEXTURE).setOrigin(.15,.5).setDisplaySize(36,9).setVisible(false).setActive(false);
      flight={sprite,source:null,x:0,y:0,vx:0,vy:0,age:0};this.arrows.push(flight);
      const anchor=flight;
      onDirectionalSprite(sprite,{get x(){return anchor.vx;},get y(){return anchor.vy;}},{get x(){return anchor.x;},get y(){return anchor.y;}});
    }
    const facing=npc.storyFacing;
    // Release from the bow hand, then aim once at the target's chest. Logical
    // ground coordinates remain separate from the projected flight height.
    flight.source=npc;flight.x=npc.x+(facing==='left'?-24:facing==='right'?24:0);
    flight.y=npc.y+(facing==='up'?-68:facing==='down'?-26:-40)+36;
    const direction=new Phaser.Math.Vector2(target.x-flight.x,target.y-flight.y).normalize();
    flight.vx=direction.x*420;flight.vy=direction.y*420;flight.age=0;
    flight.sprite.setPosition(flight.x,flight.y-36).setRotation(Math.atan2(direction.y,direction.x))
      .setDepth(this.scene.playerRenderDepth(flight.y)+2).setActive(true).setVisible(true);
  }
  private advanceArrows(delta:number,enemies:readonly Enemy[]){
    for(const arrow of this.arrows){
      if(!arrow.sprite.active)continue;
      if(!arrow.source?.active){this.hideArrow(arrow);continue;}
      const next={x:arrow.x+arrow.vx*delta/1000,y:arrow.y+arrow.vy*delta/1000};
      if(!this.scene.hasClearPath(arrow.x,arrow.y,next.x,next.y)){this.hideArrow(arrow);continue;}
      const dx=next.x-arrow.x,dy=next.y-arrow.y,len2=dx*dx+dy*dy;
      let struck:Enemy|undefined,fraction=Infinity;
      for(const enemy of enemies){
        if(!enemy.active||enemy.hp<=0||!enemy.canBeTargeted)continue;
        const t=len2?Phaser.Math.Clamp(((enemy.x-arrow.x)*dx+(enemy.y-arrow.y)*dy)/len2,0,1):0;
        if(t<fraction&&Math.hypot(enemy.x-arrow.x-dx*t,enemy.y-arrow.y-dy*t)<(enemy.definition.bodyRadius??11)+9){
          struck=enemy;fraction=t;
        }
      }
      if(struck){this.hit(struck,new Phaser.Math.Vector2(arrow.vx,arrow.vy).normalize());this.hideArrow(arrow);continue;}
      arrow.x=next.x;arrow.y=next.y;arrow.age+=delta;
      arrow.sprite.setPosition(arrow.x,arrow.y-36).setDepth(this.scene.playerRenderDepth(arrow.y)+2);
      if(arrow.age>=1000)this.hideArrow(arrow);
    }
  }
  private hideArrow(arrow:Arrow){arrow.sprite.setActive(false).setVisible(false);arrow.source=null;}
  private hideArrows(){for(const arrow of this.arrows)this.hideArrow(arrow);}
  clear(){
    this.hideArrows();
    for(const [npc,helper] of this.helpers)if(npc.active){
      npc.endStoryGuard();
      if(Math.hypot(npc.x-helper.origin.x,npc.y-helper.origin.y)>8&&this.scene.canNpcVisit(npc,helper.origin))
        npc.beginStoryMovement(helper.origin);
    }
    this.helpers.clear();this.candidates.clear();this.paused=false;this.recruitMs=0;
    this.actors.length=0;this.live.clear();this.claims.clear();this.reserved.clear();
    this.art.cancelPending();
  }
  destroy(){this.clear();for(const arrow of this.arrows)arrow.sprite.destroy();this.arrows.length=0;this.art.destroy();}
}
