import {actorViewAim,actorViewTravel} from '../systems/actorViewDirection';
import Phaser from 'phaser';
import {onPlane} from '../presentation25d/plane';
import {DepthSortedSprite,setDepthIfChanged} from '../systems/renderDepth';
import type { NpcDefinition, Vec2 } from '../types';
import { ART_BY_KEY, actorScaleForHeight, artScale, type ArtTextureKey } from '../../data/art';
import { NPC_IDLE_ART,npcDirectionalIdleTexture,npcIdleSilhouetteHeight } from '../../data/npcIdleArt';
import { directionFrame } from '../../data/animationPacks';
import {actorAimDirection,type ActorDirection} from '../../data/directionalEnemyArt';
import { npcApparentHeight } from '../../data/progression';
import { patrolDestination } from '../systems/npcPatrol';
import { seededRandom } from '../../utils/seededRandom';
import type { WorldScene } from '../scenes/WorldScene';
import { TOWN_BY_ID } from '../../data/towns';
import { npcStreetRoute, formationPosition } from '../systems/npcRoutes';
import { useGameStore } from '../../store/gameStore';
import {QUEST_BY_ID} from '../../data/quests';
import {questRequirementsMet} from '../systems/questDependencies';
import { approachVelocity, strideRate } from '../systems/locomotion';
import { MARCH_SPEED } from '../../data/capitalResidents';
import {guardMarchTexture} from '../../data/guardMarchArt';
import {guardMarchScale} from '../systems/GuardMarchArt';
import {npcWalkTexture} from '../../data/npcWalkArt';
import {npcSchedulePosition} from '../../data/npcPositions';
import {npcMayPatrol,npcStandingOffRoad} from '../systems/npcPlacement';
import {citizenModel,citizenHeight,presentCitizen} from '../systems/RegionalCitizenArt';
import {npcCombatArt,npcCombatKey,NPC_COMBAT_DIRECTIONS} from '../../data/npcCombatArt';

const NPC_WALK_SPEED = 44;
type WalkDirection = ActorDirection;

export class Npc extends DepthSortedSprite {
  readonly definition: NpcDefinition;
  readonly nameLabel: Phaser.GameObjects.Text;
  readonly home: Vec2;
  private readonly regionalModel:number|undefined;
  private readonly titleLabel: Phaser.GameObjects.Text;
  private readonly sideQuestMarker: Phaser.GameObjects.Text | null;
  private readonly labelY: number;
  private readonly showOverheadLabels: boolean;
  private readonly rng: () => number;
  private target: Vec2 | null = null;
  private returningHome = false;
  private nextPatrolAt = 0;
  private facing = new Phaser.Math.Vector2(0, 1);
  // Road travelers retain their facing while waiting for a real obstruction.
  private walkDirection: WalkDirection = 'down';
  private readonly walkTexture:ArtTextureKey;
  private readonly walkArtTexture:ArtTextureKey;
  private readonly walkScale:number;
  private readonly idleArt:typeof NPC_IDLE_ART[number]|undefined;
  private readonly idleScale:number;
  private readonly presentationMultiplier:number;
  private readonly schedule:NpcDefinition['schedule'];
  private routeCheckMs=120;
  private route:Vec2[]=[];
  private routineKey='';
  private routineAnchor:Vec2;
  private stalledMs=0;
  private previousPosition:Vec2;
  private escortGoal:Vec2|null=null;
  private escortRouteRetryAt=0;
  private routineRetryAt=0;
  // A temporary side step never consumes the original scheduled waypoint.
  private npcDetour:Vec2|null=null;
  private lastAvoidAttempt=0;
  // Road walkers only move a few pixels between checks. Keep the existing
  // collision/obstacle logic but avoid full-world line-of-sight queries 60x/s.
  private roadCheckAt=0;
  private roadRejoinCheckAt=0;
  private roadBlocked=false;
  private roadBlocker:Vec2|null=null;
  private avoidSide=1;
  private storyGoal:Vec2|null=null;
  private storyRouteCheckAt=0;
  private companionControl=false;
  private companionGoal:{point:Vec2;speed:number}|null=null;
  private roadRoute:{points:Vec2[];next:number;direction:number;loop:boolean;wait:number;speed:number;rejoin:boolean;joining:Vec2|null}|null=null;
  private storyAlert:string|undefined;
  private nameHighlighted=false;
  private storyGuard=false;
  private storyAttack:string|null=null;
  private formationRejoining=false;
  private formationRejoinAt=0;

  constructor(scene: WorldScene, definition: NpcDefinition, x: number, y: number, home: Vec2) {
    const sourceFamily=definition.spriteTexture??'npcs';
    const declaredIdleArt=NPC_IDLE_ART.find(entry=>entry.walk===sourceFamily||entry.key===sourceFamily);
    const family=sourceFamily==='npc_royal_guard'?'npc_guard':declaredIdleArt?.walk??sourceFamily;
    const idleArt=declaredIdleArt??NPC_IDLE_ART.find(entry=>entry.walk===family);
    const texture = guardMarchTexture(family)??npcWalkTexture(family)??(idleArt&&!ART_BY_KEY[family]?idleArt.key:family);
    const regionalModel=citizenModel(definition);
    const apparentHeight = regionalModel===undefined
      ?definition.settlementResident?(idleArt?.height??80):npcApparentHeight(family):citizenHeight(regionalModel);
    if((family==='npc_guard'||family==='npc_elven_guard')&&!idleArt)throw new Error(`Missing guard idle art for ${definition.id}`);
    // Definition frames belong to the original cast boards, not replacement
    // 4-column walk atlases. Presentation selects the actual pose immediately.
    super(scene, x, y, texture, npcWalkTexture(family)?0:definition.spriteFrame);
    this.definition = definition;
    this.regionalModel=regionalModel;
    this.walkTexture = family;
    this.walkArtTexture=texture;
    const sizeMultiplier=family==='npc_elven_guard'?1.12:1;
    this.presentationMultiplier=sizeMultiplier;
    this.walkScale=family==='npc_guard'||family==='npc_elven_guard'?guardMarchScale(scene,texture,idleArt!)*sizeMultiplier:
      npcWalkTexture(family)?artScale(texture):actorScaleForHeight(texture,definition.spriteFrame,apparentHeight);
    this.idleArt=idleArt;
    this.idleScale=idleArt?artScale(idleArt.key)*sizeMultiplier:artScale(texture);
    this.schedule=[...definition.schedule].sort((a,b)=>a.startHour-b.startHour);
    this.home = { ...home };
    this.routineAnchor={...home};this.previousPosition={x,y};
    this.rng = seededRandom(`npc-patrol:${definition.id}`);
    this.nextPatrolAt = scene.time.now + 1200 + this.rng() * 1800;
    this.labelY = -(apparentHeight * sizeMultiplier + 12);
    // An authored quest actor must never lose its overhead identity, even if a
    // future spawn accidentally requests hidden decorative labels.
    this.showOverheadLabels=definition.showOverheadLabels!==false||definition.questIds.length>0;
    scene.add.existing(this);
    const sheet = ART_BY_KEY[texture], modelScale = this.walkScale;
    this.setScale(modelScale).setOrigin(.5,1 - 2 / sheet.frameHeight);
    scene.physics.add.existing(this);
    const scaleX = this.scaleX, scaleY = this.scaleY, density = ART_BY_KEY[texture].density;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(36 / scaleX, 24 / scaleY)
      .setOffset(sheet.frameWidth * density / 2 - 18 / scaleX, this.originY * sheet.frameHeight * density - 24 / scaleY)
      .setCollideWorldBounds(true).setImmovable(true);
    body.pushable = false;
    body.updateFromGameObject();
    this.setDepth(y);
    this.setInteractive({ useHandCursor: true });
    this.setName(definition.name);
    this.nameLabel = scene.add.text(x, y + this.labelY, this.showOverheadLabels?definition.name:'', {
      fontFamily: 'Georgia, serif', fontSize: '11px', color: '#f6edd7', stroke: '#17130e', strokeThickness: 3,
      // A black rectangle behind every angled 3D nameplate obscures scenery.
      // Readability comes from the existing outlined lettering instead.
      padding: { x: 4, y: 2 },
    }).setResolution(2).setOrigin(.5,1).setDepth(y + 80).setName(`npc-name:${definition.id}`)
      .setVisible(this.showOverheadLabels);
    this.titleLabel = scene.add.text(x, y + this.labelY + 2, this.showOverheadLabels?definition.title:'', {
      fontFamily: 'system-ui, sans-serif', fontSize: '9px', color: '#d2c3a5', stroke: '#17130e', strokeThickness: 2,
    }).setResolution(2).setOrigin(.5,0).setDepth(y + 80).setName(`npc-title:${definition.id}`)
      .setVisible(this.showOverheadLabels);
    onPlane(this.nameLabel,'upright',this);onPlane(this.titleLabel,'upright',this);
    // Keep this cue separate from the sprite and its name label; like the
    // name, it follows a walking NPC without becoming a clickable obstacle.
    this.sideQuestMarker=definition.questIds.some(id=>QUEST_BY_ID[id]?.kind==='side')
      ?scene.add.text(x,y+this.labelY-18,'!',{
        fontFamily:'Georgia, serif',fontSize:'16px',fontStyle:'bold',color:'#65c5ff',
        stroke:'#102942',strokeThickness:4,
      }).setResolution(2).setOrigin(.5,1).setDepth(y+82)
        .setVisible(false).setName(`npc-side-quest:${definition.id}`)
      :null;
    if(this.sideQuestMarker)onPlane(this.sideQuestMarker,'upright',this);
    this.once('destroy', () => { this.nameLabel.destroy(); this.titleLabel.destroy(); this.sideQuestMarker?.destroy(); });
    if(regionalModel!==undefined)presentCitizen(this,regionalModel);
    else {
      // Start full idle poses immediately, including newly streamed visitors.
      this.playDirection(0,1,false);
      if(definition.settlementResident&&this.anims.currentAnim){
        let phase=0;for(const c of definition.id)phase=(phase*31+c.charCodeAt(0))>>>0;
        this.anims.setProgress((phase%997)/997);
      }
    }
  }

  beginEscort(goal:Vec2) {this.escortRouteRetryAt=0;this.escortGoal={...goal};this.route=[];this.target=null;this.npcDetour=null;}
  get escorting(){return this.escortGoal!==null;}
  get usesRegionalPresentation(){return this.regionalModel!==undefined||Boolean(this.definition.settlementResident);}
  storyRest(){
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0,0);
    if(this.storyAttack)return;
    if(this.storyGuard)this.holdStoryGuard();else this.playDirection(this.facing.x,this.facing.y,false);
  }
  get combatProfile(){return npcCombatArt(this.definition,this.regionalModel);}
  get canStoryWalk(){
    const art=this.combatProfile;
    return this.regionalModel===undefined?this.scene.anims.exists(this.walkTexture+'-down'):
      Boolean(art?.walkRows&&NPC_COMBAT_DIRECTIONS.every(d=>this.scene.anims.exists(npcCombatKey(art,'walk',d))));
  }
  get canStoryFight(){
    const art=this.combatProfile;
    return Boolean(art&&!this.escorting&&this.canStoryWalk
      &&NPC_COMBAT_DIRECTIONS.every(d=>this.scene.anims.exists(npcCombatKey(art,'attack',d))));
  }
  get storyAttackReach(){return this.combatProfile?.reach??0;}
  get storyFacing(){return actorAimDirection(this.facing.x,this.facing.y,'down');}
  beginStoryGuard(){
    if(this.canStoryFight){this.storyGuard=true;this.storyGoal=null;this.stalledMs=0;this.holdStoryGuard();}
  }
  endStoryGuard(){
    this.storyGuard=false;this.storyAttack=null;this.storyGoal=null;
    this.formationRejoining=Boolean(this.definition.formation);this.formationRejoinAt=0;
    this.target=null;this.route=[];this.npcDetour=null;this.routineKey='';this.stalledMs=0;
    if(this.roadRoute){this.roadRoute.rejoin=true;this.roadRoute.joining=null;this.roadRejoinCheckAt=0;}
    this.storyRest();
  }
  holdStoryGuard(target?:Vec2){
    if(!this.storyGuard||this.storyAttack)return;
    this.storyGoal=null;
    const body=this.body as Phaser.Physics.Arcade.Body;body.setVelocity(0,0);body.setImmovable(true);body.pushable=false;
    if(target)this.facing.set(target.x-this.x,target.y-this.y).normalize();
    const art=this.combatProfile!;
    // Direction selection expects velocity-sized inputs, not a unit vector.
    this.walkDirection=actorViewTravel(this.scene,this.facing.x*60,this.facing.y*60,this.walkDirection);
    this.presentTexture(art.texture,artScale(art.texture)*this.presentationMultiplier);this.anims.stop();this.anims.timeScale=1;
    this.setFrame(NPC_COMBAT_DIRECTIONS.indexOf(this.walkDirection)*art.frames);
  }
  beginStoryAttack(target:Vec2){
    if(!this.storyGuard||this.storyAttack||!this.canStoryFight)return false;
    this.holdStoryGuard(target);
    this.storyAttack=npcCombatKey(this.combatProfile!,'attack',this.walkDirection);
    this.anims.play(this.storyAttack);return true;
  }
  get storyStrikeReady(){return Boolean(this.storyAttack&&this.anims.currentAnim?.key===this.storyAttack
    &&(this.anims.currentFrame?.index??0)>=(this.combatProfile?.impact??4));}
  get storyAttackFinished(){return Boolean(this.storyAttack&&(!this.anims.isPlaying||this.anims.currentAnim?.key!==this.storyAttack));}
  endStoryAttack(){this.storyAttack=null;this.storyRest();}
  beginStoryMovement(goal:Vec2){
    if(!this.canStoryWalk)return;
    if(this.storyGoal?.x!==goal.x||this.storyGoal.y!==goal.y)this.storyRouteCheckAt=0;
    this.storyGoal={...goal};
  }
  endStoryMovement(){this.storyGoal=null;this.storyRest();}
  get storyMoving(){return this.storyGoal!==null||this.storyGuard;}
  get adventureCompanion(){return this.companionControl;}
  get speechAnchorY(){return this.y+this.labelY;}
  setAdventureCompanion(enabled:boolean){
    if(enabled===this.companionControl)return;
    this.companionControl=enabled;this.companionGoal=null;
    if(enabled){this.nameLabel.setVisible(false);this.titleLabel.setVisible(false);this.sideQuestMarker?.setVisible(false);}
    this.target=null;this.route=[];this.npcDetour=null;this.routineKey='';this.stalledMs=0;
  }
  setCompanionGoal(point:Vec2|null,speed=165){this.companionGoal=point?{point:{...point},speed}:null;}
  setCompanionCamera(filter:number){
    this.cameraFilter=filter;this.nameLabel.cameraFilter=filter;this.titleLabel.cameraFilter=filter;
    if(this.sideQuestMarker)this.sideQuestMarker.cameraFilter=filter;
  }
  setCompanionAlpha(alpha:number){
    this.setAlpha(alpha);this.nameLabel.setAlpha(alpha);this.titleLabel.setAlpha(alpha);this.sideQuestMarker?.setAlpha(alpha);
  }
  /** Persistent corner destinations keep travel independent of AI think ticks. */
  followRoadRoute(points:readonly Vec2[],speed=39,options:{next?:number;direction?:number;loop?:boolean}={}){
    const loop=points.map(p=>({...p}));
    if(loop.length>2&&Math.hypot(loop[0].x-loop.at(-1)!.x,loop[0].y-loop.at(-1)!.y)<1)loop.pop();
    if(loop.length<2)return;
    this.roadRoute={points:loop,next:Math.max(0,Math.min(loop.length-1,options.next??1)),
      direction:options.direction===-1?-1:1,loop:options.loop??false,wait:0,speed,rejoin:false,joining:null};
    this.roadCheckAt=0;this.roadRejoinCheckAt=0;this.roadBlocked=false;this.roadBlocker=null;
  }
  get roadTravelDirection(){return this.roadRoute?.direction??1;}
  private updateRoadWalk(delta:number){
    const route=this.roadRoute!,scene=this.scene as WorldScene,body=this.body as Phaser.Physics.Arcade.Body;
    if(!this.canStoryWalk){this.storyRest();return;}
    if(route.wait>0){route.wait=Math.max(0,route.wait-delta);this.storyRest();return;}
    if(route.rejoin){
      // In a blocked corridor, finding the rejoin segment is expensive. Retry
      // at a bounded cadence rather than walking every road segment each frame.
      if(scene.time.now<this.roadRejoinCheckAt){this.storyRest();return;}
      this.roadRejoinCheckAt=scene.time.now+320;
      let best=Infinity;
      for(let i=0;i<route.points.length-(route.loop?0:1);i++){
        const a=route.points[i],b=route.points[(i+1)%route.points.length],dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy;
        const t=len2?Math.max(0,Math.min(1,((this.x-a.x)*dx+(this.y-a.y)*dy)/len2)):0;
        const point={x:a.x+dx*t,y:a.y+dy*t},distance=Math.hypot(point.x-this.x,point.y-this.y);
        if(distance>1200||distance>=best||!scene.canNpcVisit(this,point)||!scene.canTraverseGround(this,point))continue;
        best=distance;route.joining=point;route.next=route.direction>0?(i+1)%route.points.length:i;
      }
      if(Number.isFinite(best)){route.rejoin=false;this.roadCheckAt=0;}
      else {this.storyRest();return;}
    }
    const arrival=Math.max(2,route.speed*Math.min(100,Math.max(0,delta))/1000*1.15);
    let goal=route.joining??route.points[route.next];
    // Cross corners in the same update, without an idle frame between legs.
    for(let i=0;i<=route.points.length&&Math.hypot(goal.x-this.x,goal.y-this.y)<=arrival;i++){
      this.npcDetour=null;this.roadCheckAt=0;
      if(route.joining)route.joining=null;
      else {
        const next=route.next+route.direction;
        if(!route.loop&&(next<0||next>=route.points.length)){
          route.direction*=-1;route.next+=route.direction;route.wait=4000;this.storyRest();return;
        }
        route.next=(next+route.points.length)%route.points.length;
      }
      goal=route.points[route.next];
    }
    if(this.npcDetour&&Math.hypot(this.x-this.npcDetour.x,this.y-this.npcDetour.y)<8){this.npcDetour=null;this.roadCheckAt=0;}
    const destination=this.npcDetour??goal;
    let dx=destination.x-this.x,dy=destination.y-this.y,length=Math.hypot(dx,dy);
    if(length<.01){this.storyRest();return;}
    const ahead={x:this.x+dx/length*Math.min(32,length),y:this.y+dy/length*Math.min(32,length)};
    // The existing arcade bodies continue to handle nearby physical contact
    // each frame. Probe terrain, static buildings and pedestrians at most once
    // per 120 ms (roughly 5 pixels of walking), with immediate checks on a
    // new road leg or detour. Spread checks across actors by their spawn time.
    if(scene.time.now>=this.roadCheckAt){
      this.roadCheckAt=scene.time.now+120;
      this.roadBlocker=scene.npcPathBlocker(this,ahead,this);
      this.roadBlocked=!scene.canNpcVisit(this,ahead)||!scene.canTraverseGround(this,ahead)||Boolean(this.roadBlocker);
    }
    if(this.roadBlocked){
      if(scene.time.now-this.lastAvoidAttempt<=420){this.storyRest();return;}
      this.lastAvoidAttempt=scene.time.now;
      this.npcDetour=this.npcDetourWaypoint(scene,this.roadBlocker,goal);
      if(!this.npcDetour){this.storyRest();return;}
      dx=this.npcDetour.x-this.x;dy=this.npcDetour.y-this.y;length=Math.hypot(dx,dy);
      this.roadCheckAt=0;this.roadBlocked=false;
    }
    this.facing.set(dx/length,dy/length);this.stalledMs=0;
    body.setVelocity(this.facing.x*route.speed,this.facing.y*route.speed);
    this.playDirection(dx,dy,true);
  }
  setStoryAlert(text?:string){this.storyAlert=text;}
  setInteriorLabelDepth(offset:number){this.nameLabel.setDepth(offset+this.y+80);this.titleLabel.setDepth(offset+this.y+80);this.sideQuestMarker?.setDepth(offset+this.y+82);}
  advanceCinematic(delta:number) {
    const body=this.body as Phaser.Physics.Arcade.Body,step=Math.min(delta,80)/1000;
    const point={x:this.x+body.velocity.x*step,y:this.y+body.velocity.y*step};
    const world=this.scene as WorldScene;
    const canAdvance=this.companionControl&&world.inInterior
      ?world.companionPathClear(this,point,this)
      :world.canNpcVisit(this,point);
    if(canAdvance){
      this.setPosition(point.x,point.y);body.updateFromGameObject();
    }else body.setVelocity(0,0);
  }
  updatePatrol(time: number, delta: number) {
    const scene = this.scene as WorldScene;
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.setDepth(scene.playerRenderDepth(this.y));
    if(this.storyAttack){body.setVelocity(0,0);return;}
    if(this.storyGoal){
      const dx=this.storyGoal.x-this.x,dy=this.storyGoal.y-this.y,distance=Math.hypot(dx,dy);
      if(distance<8){this.endStoryMovement();return;}
      const ahead={x:this.x+dx/distance*Math.min(24,distance),y:this.y+dy/distance*Math.min(24,distance)};
      // Retain a full route check on a new goal and every 120 ms. Between those
      // checks validate the immediate segment and pedestrians every frame.
      const routeDue=time>=this.storyRouteCheckAt;
      if(routeDue)this.storyRouteCheckAt=time+120;
      if(!scene.canNpcVisit(this,routeDue?this.storyGoal:ahead)||scene.npcPathBlocker(this,ahead,this)){
        this.endStoryMovement();return;
      }
      this.facing.set(dx,dy).normalize();
      const speed=Math.min(60,distance*4);body.setVelocity(this.facing.x*speed,this.facing.y*speed);
      this.playDirection(dx,dy,true);return;
    }
    if(this.storyGuard){this.holdStoryGuard();return;}
    if(this.companionControl){
      const goal=this.companionGoal;
      if(!goal||!this.canStoryWalk){this.storyRest();return;}
      const dx=goal.point.x-this.x,dy=goal.point.y-this.y,length=Math.hypot(dx,dy);
      if(length<=3){this.storyRest();return;}
      const speed=Math.min(goal.speed,length/Math.max(.001,Math.min(delta,100)/1000));
      const ahead={x:this.x+dx/length*Math.min(22,length),y:this.y+dy/length*Math.min(22,length)};
      const clear=scene.inInterior
        ?scene.companionPathClear(this,ahead,this)
        :scene.canNpcVisit(this,ahead)&&scene.canTraverseGround(this,ahead);
      if(!clear){
        this.storyRest();return;
      }
      this.facing.set(dx/length,dy/length);this.stalledMs=0;
      body.setVelocity(this.facing.x*speed,this.facing.y*speed);this.playDirection(dx,dy,true);return;
    }
    if(this.roadRoute){this.updateRoadWalk(delta);return;}
    if(this.formationRejoining&&(scene.getWorldHour()<6||scene.getWorldHour()>=20))this.formationRejoining=false;
    if(!this.mayPatrol&&!this.escortGoal){
      this.npcDetour=null;
      body.setVelocity(0,0);this.target=null;this.route=[];this.previousPosition={x:this.x,y:this.y};
      this.playDirection(0,0,false);this.setDepth(this.y);return;
    }
    const town=TOWN_BY_ID[this.definition.townId];
    this.routeCheckMs+=Math.min(delta,100);
    const toLocal=(p:Vec2)=>({x:p.x-town.world.x,y:p.y-town.world.y});
    const toWorld=(p:Vec2)=>({x:p.x+town.world.x,y:p.y+town.world.y});
    if(this.definition.formation && scene.getWorldHour()>=6 && scene.getWorldHour()<20) {
      const goal=toWorld(formationPosition(scene.activePlayMs+180,this.definition.formation.rank));
      if(this.formationRejoining&&time>=this.formationRejoinAt){
        this.formationRejoinAt=time+2000;
        this.route=npcStreetRoute(this.definition.townId,toLocal(this),toLocal(goal),(a,b)=>scene.canNpcVisit(toWorld(a),toWorld(b))).map(toWorld);
        this.target=this.route.shift()??null;
      }
      // Common deterministic phase keeps the file together across streaming.
      // Never snap through a wall if a future layout edit invalidates its route.
      if(Math.hypot(this.x-goal.x,this.y-goal.y)<160 && scene.canNpcVisit(this,goal)) {
        this.formationRejoining=false;this.route=[];this.target=null;
        const dx=goal.x-this.x,dy=goal.y-this.y;
        if(Math.hypot(dx,dy)>.2)this.facing.set(dx,dy).normalize();
        const speed=Math.min(MARCH_SPEED*1.35,Math.hypot(dx,dy)*5);
        body.setVelocity(approachVelocity(body.velocity.x,this.facing.x*speed,delta,80),approachVelocity(body.velocity.y,this.facing.y*speed,delta,80));
        this.playDirection(this.facing.x,this.facing.y,body.velocity.length()>3);this.setDepth(this.y);return;
      }
    }
    if(this.escortGoal) {
      if(Math.hypot(this.x-scene.player.x,this.y-scene.player.y)>210){body.setVelocity(0,0);this.playDirection(this.facing.x,this.facing.y,false);return;}
      if(Math.hypot(this.x-this.escortGoal.x,this.y-this.escortGoal.y)<28){
        this.escortGoal=null;this.route=[];this.target=null;this.routineAnchor={x:this.x,y:this.y};
        useGameStore.getState().progressQuest('escort',this.definition.id);scene.notify(`${this.definition.name} reaches the kitchen safely.`);
      }else if(!this.target&&!this.route.length&&time>=this.escortRouteRetryAt){
        this.escortRouteRetryAt=time+750;
        this.route=npcStreetRoute(this.definition.townId,toLocal(this),toLocal(this.escortGoal),(a,b)=>scene.canNpcVisit(toWorld(a),toWorld(b))).map(toWorld);
      }
    } else if(!this.formationRejoining) {
      const hour=scene.getWorldHour();
      let routine=this.schedule.at(-1);
      for(let i=this.schedule.length-1;i>=0;i--)if(this.schedule[i].startHour<=hour){routine=this.schedule[i];break;}
      const story=useGameStore.getState();
      const returned=this.definition.id==='tovin-reed'&&(story.quests['shadows-highmere']?.objectiveProgress.escort??0)>=1;
      const council=story.storyFlags['relief-joint-council']&&['maela-quill','nella-harrow'].includes(this.definition.id);
      const period=(routine?.startHour??0)+':'+returned+':'+Boolean(council);
      if(period!==this.routineKey&&time>=this.routineRetryAt) {
        this.routineRetryAt=time+500;
        const arrival=returned?scene.escortArrival():null;
        const location=returned?(arrival?toLocal(arrival):null):council?{x:this.definition.id==='maela-quill'?160:-180,y:140}
          :npcSchedulePosition(this.definition,this.definition.schedule.findIndex(p=>p.startHour===routine?.startHour));
        const desired=location?toWorld(location):null;
        const safe=desired?(scene.inInterior?desired:scene.safeExteriorNpcDestination(desired,this)):null;
        if(safe){
          this.routineKey=period;this.routineAnchor=safe;
          this.target=null;this.npcDetour=null;this.returningHome=false;
          this.route=npcStreetRoute(this.definition.townId,toLocal(this),toLocal(this.routineAnchor),
            (a,b)=>scene.canNpcVisit(toWorld(a),toWorld(b))).map(toWorld);
        }
      }
    }
    if(!this.target&&this.route.length)this.target=this.route.shift()!;
    if(this.target) {
      const moved=Math.hypot(this.x-this.previousPosition.x,this.y-this.previousPosition.y);
      this.stalledMs=moved<.12?this.stalledMs+Math.min(delta,250):0;
      if(this.npcDetour && Math.hypot(this.x-this.npcDetour.x,this.y-this.npcDetour.y)<12) {
        this.npcDetour=null;this.stalledMs=0;
      }
      const activeGoal=this.npcDetour??this.target;
      const length=Math.hypot(activeGoal.x-this.x,activeGoal.y-this.y);
      const step=Math.min(1,36/Math.max(1,length));
      const ahead={x:this.x+(activeGoal.x-this.x)*step,y:this.y+(activeGoal.y-this.y)*step};
      const checkRoute=this.routeCheckMs>=120;
      if(checkRoute)this.routeCheckMs=0;
      if(checkRoute || this.stalledMs>1050) {
        const blocker=scene.npcPathBlocker(this,ahead,this);
        const obstructed=!scene.canNpcVisit(this,ahead)||Boolean(blocker)||this.stalledMs>1050;
        if(obstructed && (time-this.lastAvoidAttempt>420||this.lastAvoidAttempt===0)) {
          this.lastAvoidAttempt=time;
          this.npcDetour=this.npcDetourWaypoint(scene,blocker);
          this.stalledMs=0;
        }
        if(obstructed && !this.npcDetour) {
          // Wait if both bypass lanes are obstructed. Never delete the route:
          // when the pedestrian moves, this NPC resumes the same destination.
          body.setVelocity(0,0);
          this.playDirection(this.facing.x,this.facing.y,false);
          this.previousPosition={x:this.x,y:this.y};
          return;
        }
      }
    }
    this.previousPosition.x=this.x;this.previousPosition.y=this.y;
    if (!this.target && time >= this.nextPatrolAt) {
      if(this.escortGoal)return;
      if (this.returningHome) {
        if (Phaser.Math.Distance.Between(this.x, this.y, this.routineAnchor.x, this.routineAnchor.y) <= 14) {
          this.returningHome = false;
          this.nextPatrolAt = time + 1400 + this.rng() * 2400;
        } else if (scene.canNpcVisit({ x: this.x, y: this.y }, this.routineAnchor)) {
          this.target = this.routineAnchor;
        } else {
          this.returningHome = false;
          this.nextPatrolAt = time + 1400;
        }
      } else {
        const destination = patrolDestination(this.routineAnchor, { x: this.x, y: this.y }, this.definition.patrolRadius ?? 110, this.rng,
          (from, to) => scene.canNpcVisit(from, to)&&npcStandingOffRoad(this.definition,to));
        if (destination) this.target = destination;
        else this.nextPatrolAt = time + 1600;
      }
    }

    if (!this.target) {
      body.setVelocity(0, 0);
      this.playDirection(this.facing.x, this.facing.y, false);
      this.setDepth(this.y);
      return;
    }

    // Advance nearby route corners in this update, rather than holding the
    // previous velocity and facing for a frame at each waypoint.
    while (this.route.length && Math.hypot(this.target.x-this.x,this.target.y-this.y) <= 6) {
      this.target = this.route.shift()!;
    }
    const navigationGoal=this.npcDetour??this.target;
    const dx = navigationGoal.x - this.x, dy = navigationGoal.y - this.y;
    if (Math.hypot(dx, dy) <= 3) {
      body.setVelocity(0, 0);
      this.target = null;this.npcDetour=null;
      if (!this.returningHome && !this.route.length) this.returningHome = true;
      this.nextPatrolAt = this.route.length ? time : time + 1000 + this.rng() * 1800;
      this.playDirection(this.facing.x, this.facing.y, false);
      return;
    }
    this.facing.set(dx, dy).normalize();
    const speed=Math.min(NPC_WALK_SPEED,Math.hypot(dx,dy)*4);
    body.setVelocity(approachVelocity(body.velocity.x,this.facing.x*speed,delta,90),approachVelocity(body.velocity.y,this.facing.y*speed,delta,90));
    this.playDirection(this.facing.x, this.facing.y, true);
    this.setDepth(this.y);
  }

  /** Try a short sidestep to either side of the blockage. The real target
   * and remaining schedule never change, so movement rejoins the old path. */
  private npcDetourWaypoint(scene:WorldScene, blocker:Vec2|null,destination=this.target):Vec2|null {
    if(!destination)return null;
    const dx=destination.x-this.x,dy=destination.y-this.y;
    const length=Math.hypot(dx,dy);
    if(length<1)return null;
    const forwardX=dx/length,forwardY=dy/length;
    const obstacleDistance=blocker ? Math.hypot(blocker.x-this.x,blocker.y-this.y) : 38;
    const forward=Math.max(40,Math.min(92,obstacleDistance+36));
    const sides=[this.avoidSide,-this.avoidSide];
    for(const side of sides)for(const lateral of [54,78,104]) {
      const candidate={x:this.x+forwardX*forward-forwardY*side*lateral,
        y:this.y+forwardY*forward+forwardX*side*lateral};
      if(!scene.npcCanStandAt(candidate.x,candidate.y,this))continue;
      if(!scene.canNpcVisit(this,candidate)||!scene.canTraverseGround(this,candidate)||scene.npcPathBlocker(this,candidate,this))continue;
      this.avoidSide=side;
      return candidate;
    }
    // Reverse preference next time if the object or another pedestrian moves.
    this.avoidSide=-this.avoidSide;
    return null;
  }

  private get mayPatrol(){
    return this.regionalModel===undefined&&npcMayPatrol(this.definition)&&(!this.definition.townRoutine||this.canStoryWalk);
  }

  updatePresentation(playerX: number, playerY: number, questTarget: boolean, paused = false, cinematic=false) {
    const distance = Phaser.Math.Distance.Between(playerX,playerY,this.x,this.y);
    if(this.storyAttack){
      const direction=actorViewAim(this.scene,this.facing.x,this.facing.y,this.walkDirection);
      if(direction!==this.walkDirection&&this.anims.isPlaying){
        const progress=this.anims.getProgress(),scale=this.anims.timeScale;
        this.walkDirection=direction;this.storyAttack=npcCombatKey(this.combatProfile!,'attack',direction);
        this.anims.play(this.storyAttack);this.anims.setProgress(progress);this.anims.timeScale=scale;
      }
    }else{
      // Patrol/story movement already selects the pose. Refresh here only
      // when camera rotation changes it, including stationary cinematic actors.
      const direction=actorViewAim(this.scene,this.facing.x,this.facing.y,this.walkDirection);
      if(direction!==this.walkDirection){
        if(this.storyGuard)this.holdStoryGuard();
        else this.playDirection(this.facing.x,this.facing.y,(this.body as Phaser.Physics.Arcade.Body).velocity.lengthSq()>9);
      }
    }
    if (!cinematic && !this.companionControl && !this.roadRoute && !this.storyGuard && !this.storyGoal && distance > 1 && distance <= 72 && !this.escorting && !this.definition.formation) {
      this.target = null;
      this.returningHome = true;
      this.nextPatrolAt = Math.max(this.nextPatrolAt, this.scene.time.now + 1500);
      (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      this.playDirection(this.facing.x, this.facing.y, false);
    }
    if (paused) this.anims.pause(); else if (this.anims.isPaused) this.anims.resume();
    // Roaming road-life actors have no overhead labels. Skip all text updates,
    // depth adjustment and potential glyph texture uploads for those actors.
    if(this.showOverheadLabels){
      // Phaser Text color/text setters can regenerate their canvas and upload
      // glyph textures. Preserve identical presentation without doing so 60x/s.
      if(this.nameHighlighted!==questTarget){
        this.nameHighlighted=questTarget;
        this.nameLabel.setColor(questTarget?'#ffe193':'#f6edd7');
      }
      setDepthIfChanged(this.nameLabel,this.y+80).setPosition(this.x,this.y+this.labelY)
        .setVisible(!this.companionControl);
      const title=this.storyAlert??this.definition.title;
      if(this.titleLabel.text!==title)this.titleLabel.setText(title);
      setDepthIfChanged(this.titleLabel,this.y+80).setPosition(this.x,this.y+this.labelY+2)
        .setVisible(!this.companionControl&&(Boolean(this.storyAlert)||distance<260));
    }
    if(this.sideQuestMarker){
      const story=useGameStore.getState();
      const available=this.definition.questIds.some(id=>{
        const quest=QUEST_BY_ID[id],status=story.quests[id];
        if(quest?.kind!=='side'||!status||!questRequirementsMet(quest,story.quests,QUEST_BY_ID))return false;
        if(status.status==='locked')return quest.giverNpcId===this.definition.id;
        const next=quest.objectives.find(o=>(status.objectiveProgress[o.id]??0)<o.amount);
        return status.status==='active'&&next?.targetId===this.definition.id
          &&['talk','deliver','choice','puzzle'].includes(next.type);
      });
      setDepthIfChanged(this.sideQuestMarker,this.y+82).setPosition(this.x,this.y+this.labelY-17)
        .setVisible(!this.companionControl&&available&&!cinematic&&distance<650);
    }
  }

  private playDirection(_x: number, _y: number, walking: boolean) {
    const combat=this.combatProfile;
    if(this.regionalModel!==undefined){
      // Regional portraits have their own identity. Generic family side idles
      // belong to a different actor and must never override these residents.
      if(!walking)this.walkDirection=actorViewAim(this.scene,this.facing.x,this.facing.y,this.walkDirection);
      if(walking&&combat?.walkRows&&this.canStoryWalk){
        const body=this.body as Phaser.Physics.Arcade.Body;
        body.setImmovable(false);body.pushable=true;
        this.walkDirection=actorViewTravel(this.scene,body.velocity.x,body.velocity.y,this.walkDirection);
        this.presentTexture(combat.texture,artScale(combat.texture));
        const key=npcCombatKey(combat,'walk',this.walkDirection),previous=this.anims.currentAnim?.key;
        const preserve=this.anims.isPlaying&&previous!==key&&previous?.startsWith(`npc-combat:${combat.id}:walk:`);
        const progress=preserve?this.anims.getProgress():0;
        this.anims.play(key,true);if(preserve)this.anims.setProgress(progress);
        this.anims.timeScale=strideRate(body.velocity.length(),60);return;
      }
      presentCitizen(this,this.regionalModel);return;
    }
    if(!walking){
      this.walkDirection=actorViewAim(this.scene,this.facing.x,this.facing.y,this.walkDirection);
      const body=this.body as Phaser.Physics.Arcade.Body;body.setImmovable(true);body.pushable=false;
      if(combat&&this.canStoryFight&&(this.roadRoute||this.companionControl||this.storyGuard||!this.idleArt)){
        this.presentTexture(combat.texture,artScale(combat.texture)*this.presentationMultiplier);
        this.anims.stop();this.setFrame(NPC_COMBAT_DIRECTIONS.indexOf(this.walkDirection)*combat.frames);return;
      }
      if(this.idleArt&&this.walkDirection!=='down'){
        const texture=npcDirectionalIdleTexture(this.idleArt.walk),animation=`${this.walkTexture}-idle-${this.walkDirection}`;
        if(this.scene.anims.exists(animation)){
          const row=this.walkDirection==='left'?0:this.walkDirection==='right'?1:2;
          const metadata=this.scene.textures.getFrame(texture,row*4)?.customData as {visibleBounds?:{height:number}}|undefined;
          const bounds=metadata?.visibleBounds;
          const scale=bounds?npcIdleSilhouetteHeight(this.idleArt)/(bounds.height*ART_BY_KEY[texture].density):artScale(texture);
          this.presentTexture(texture,scale);this.anims.play(animation,true);this.anims.timeScale=1;return;
        }
      }
    }
    const body = this.body as Phaser.Physics.Arcade.Body;
    const speed = body.velocity.length();
    walking = walking && speed >= 3 && (Boolean(this.definition.formation) || this.stalledMs < 200);
    body.setImmovable(!walking);
    body.pushable=walking;
    if(walking)this.walkDirection=actorViewTravel(this.scene,body.velocity.x,body.velocity.y,this.walkDirection);
    else this.walkDirection=actorViewAim(this.scene,this.facing.x,this.facing.y,this.walkDirection);
    const direction: WalkDirection = this.walkDirection;
    const idle = this.idleArt;
    if (!walking && idle) {
      this.presentTexture(idle.key,this.idleScale);
      this.anims.play(`${this.walkTexture}-idle`,true);
      this.anims.timeScale=1;
      return;
    }
    this.presentTexture(this.walkArtTexture,this.walkScale);
    const animation = `${this.walkTexture}-${direction}`;
    if (walking && this.scene.anims.exists(animation)) {
      const previousKey = this.anims.currentAnim?.key;
      const preserveStride = this.anims.isPlaying && previousKey !== animation &&
        previousKey?.startsWith(`${this.walkTexture}-`) && !previousKey.includes('-idle');
      const progress = preserveStride ? this.anims.getProgress() : 0;
      this.anims.play(animation,true);
      if (preserveStride) this.anims.setProgress(progress);
      // A companion travels at player pace; the town stroll reference would
      // double her cadence throughout ordinary following and bow repositioning.
      this.anims.timeScale=this.companionControl?Math.min(1.25,strideRate(speed,165)):strideRate(speed,NPC_WALK_SPEED);
    }
    else {
      this.anims.stop();
      const frame = ART_BY_KEY[this.walkArtTexture].columns === 24
        ? directionFrame(direction==='left'?-1:direction==='right'?1:0,direction==='up'?-1:direction==='down'?1:0)
        :npcWalkTexture(this.walkTexture)?NPC_COMBAT_DIRECTIONS.indexOf(direction)*4+1:this.definition.spriteFrame;
      this.setFrame(frame).setFlipX(false);
    }
  }

  private presentTexture(texture:ArtTextureKey,scale:number) {
    if (this.texture.key === texture) return;
    this.anims.stop();
    const sheet = ART_BY_KEY[texture];
    // Visible ground, physics feet and sort depth all share world y, including
    // taller pike/idle canvases. The body occupies y-22..y, not y-2..y+20.
    const originY = 1 - (sheet.groundPadding??2) / sheet.frameHeight;
    this.setTexture(texture,0).setScale(scale).setOrigin(.5,originY).setFlipX(false);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(18 / scale,22 / scale).setOffset(sheet.frameWidth * sheet.density / 2 - 9 / scale,
      originY * sheet.frameHeight * sheet.density - 22 / scale);
    body.updateFromGameObject();
  }
}
