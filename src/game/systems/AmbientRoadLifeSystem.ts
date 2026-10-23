import {groundWorldView} from '../presentation25d/plane';
import Phaser from 'phaser';
import {TOWN_BY_ID} from '../../data/towns';
import {seededRandom} from '../../utils/seededRandom';
import {useGameStore} from '../../store/gameStore';
import type {NpcDefinition,Vec2} from '../types';
import type {Npc} from '../entities/Npc';
import type {Enemy} from '../entities/Enemy';
import type {WorldScene} from '../scenes/WorldScene';
import type {WorldGenerator} from './WorldGenerator';
import {NpcCombatResidency} from './NpcCombatResidency';
import {AmbientNpcArrowSystem} from './AmbientNpcArrowSystem';
import {roadLifeRoutes,rememberRoadJourney,type RoadLifeRoute} from './RoadLifeRoutes';
import {routePosition,routePointAtDistance} from './travelRoutes';

interface Walker {npc:Npc;hp:number;maxHp:number;rest:number;cooldown:number;target:Enemy|null;engageFrom:Vec2|null;hit:boolean;attacking:boolean;rank:number;aim:Phaser.Math.Vector2|null}
interface Party {id:string;walkers:Walker[];anchor:Vec2;patrol:boolean;route:RoadLifeRoute}
interface PendingParty {party:Party;positions:Vec2[];roster:readonly AdventurerRole[];forward:boolean;next:number}
type AdventurerRole='swordhand'|'huntress'|'archer';
const ADVENTURER_PARTY:readonly AdventurerRole[]=['swordhand','huntress'];
const GUARD_PATROL:readonly AdventurerRole[]=['swordhand','swordhand','swordhand'];
// A single visible adventuring pair and one guard patrol are permitted in the
// player's current region. The extra gap also prevents rapid replacements when
// the player briefly turns around on the same road.
const ADVENTURER_REVISIT_MS=45000;
const GUARD_REVISIT_MS=60000;
// Spawn just outside the viewport, but always within the distance where road
// parties remain loaded. This fixes groups being culled before reaching view.
const SPAWN_OUTER_MARGIN=350;
const SPAWN_INNER_MARGIN=75;
const NEAR_ROAD_MAX_DISTANCE=330;

/** Streamed journeys use physical feet while visible and continue along the
 * same road offscreen. Story encounters and bosses remain independent. */
export class AmbientRoadLifeSystem{
  private readonly parties=new Map<string,Party>();
  private opponents=new Map<Enemy,Npc>();
  private previousOpponents=new Map<Enemy,Npc>();
  private readonly art:NpcCombatResidency;
  private readonly arrows:AmbientNpcArrowSystem;
  private readonly rng=seededRandom('road-life-v1');
  private readonly routes=roadLifeRoutes();
  private readonly emptyEnemies:Enemy[]=[];
  private combatEnemies:Enemy[]=this.emptyEnemies;
  private scan=0;
  private think=0;
  private virtualTime=0;
  private activeRegion='';
  private readonly nextGroupAt=new Map<string,number>();
  private nextWalkerAt=0;
  private pendingParty:PendingParty|null=null;
  private spawnCandidates:Array<{route:RoadLifeRoute;point:ReturnType<typeof routePosition>}>=[];
  private scanCursor=0;
  private scanRemaining=0;
  private active=false;
  private readonly targetCandidates:Array<{enemy:Enemy;d2:number}>=[];
  /** True for positions just outside the viewport but safely inside the
   * release envelope; no actor should spawn far enough away to unload next tick. */
  private eligibleViewBand(point:Vec2,view:{x:number;y:number;right:number;bottom:number}){
    return point.x>=view.x-SPAWN_OUTER_MARGIN&&point.x<=view.right+SPAWN_OUTER_MARGIN
      &&point.y>=view.y-SPAWN_OUTER_MARGIN&&point.y<=view.bottom+SPAWN_OUTER_MARGIN
      &&!(point.x>view.x-SPAWN_INNER_MARGIN&&point.x<view.right+SPAWN_INNER_MARGIN
        &&point.y>view.y-SPAWN_INNER_MARGIN&&point.y<view.bottom+SPAWN_INNER_MARGIN);
  }
  /** If a virtual traveler is far away, introduce a *single* actor group from
   * an authored road just outside the player's view. Distant simulation stays
   * virtual, while roads visited by the player remain populated. */
  private nearbyRoadEntries(route:RoadLifeRoute,player:Vec2,view:{x:number;y:number;right:number;bottom:number}):Array<ReturnType<typeof routePosition>>{
    let nearest2=NEAR_ROAD_MAX_DISTANCE*NEAR_ROAD_MAX_DISTANCE,along=0,total=0;
    const points=route.points;
    for(let i=1;i<points.length;i++){
      const p=points[i-1],q=points[i],dx=q.x-p.x,dy=q.y-p.y,len2=dx*dx+dy*dy;
      if(len2<.01)continue;
      const t=Math.max(0,Math.min(1,((player.x-p.x)*dx+(player.y-p.y)*dy)/len2));
      const nearX=p.x+dx*t,nearY=p.y+dy*t;
      const gap2=(player.x-nearX)**2+(player.y-nearY)**2;
      const len=Math.sqrt(len2);
      if(gap2<nearest2){nearest2=gap2;along=total+len*t;}
      total+=len;
    }
    if(nearest2===NEAR_ROAD_MAX_DISTANCE*NEAR_ROAD_MAX_DISTANCE)return [];
    // Prepare multiple outside-camera road positions. A particular position
    // can be blocked by a tree, guard or monster; choosing only the first one
    // caused repeated failed attempts at the exact same point forever.
    const entries:Array<ReturnType<typeof routePosition>>=[];
    // On wide/low-zoom displays, a fixed 560-unit search radius can still be
    // entirely inside the camera. Probe farther along the same road when needed.
    const offsets=[170,260,380,520,700,900,1150,1500];
    for(const magnitude of offsets)for(const offset of [magnitude,-magnitude]){
      const distance=along+offset;
      if(distance<75||distance>route.length-75)continue;
      const pos=routePointAtDistance(route,distance);
      if(!this.eligibleViewBand(pos,view))continue;
      if(this.world.getRegionAt(pos.x,pos.y)!==this.activeRegion)continue;
      entries.push({...pos,distance,forward:offset<0,moving:true});
      if(entries.length>=6)break;
    }
    return entries;
  }
  constructor(private readonly scene:WorldScene,private readonly world:WorldGenerator){
    this.arrows=new AmbientNpcArrowSystem(scene,(_source,enemy,direction)=>{
      enemy.takeDamage(8+enemy.level*1.4,direction,{source:'ambient-ally'});
    });
    this.art=new NpcCombatResidency(scene,spec=>[...this.parties.values()].some(p=>p.walkers.some(w=>w.npc.active&&w.npc.combatProfile?.id===spec.id))
      ||scene.children.list.some(o=>o instanceof Phaser.GameObjects.Sprite&&o.texture.key===spec.texture),console.warn);
  }
  opponent(enemy:Enemy){
    const npc=this.active?this.opponents.get(enemy):undefined;
    if(!npc?.active)return null;
    return npc;
  }
  damage(npc:Npc,amount:number){
    for(const party of this.parties.values()){
      const walker=party.walkers.find(w=>w.npc===npc);if(!walker)continue;if(walker.rest>0)return;
      walker.hp=Math.max(0,walker.hp-Math.max(1,amount));
      if(walker.hp<=walker.maxHp*.22){
        walker.rest=18000;walker.target=null;walker.attacking=false;
        npc.endStoryAttack();npc.endStoryGuard();npc.setStoryAlert('Wounded · falling back');
        for(const [enemy,target] of this.opponents)if(target===npc)this.opponents.delete(enemy);
      }
      return;
    }
  }
  update(delta:number,blocked:boolean){
    this.art.update();
    // Indoor scenes have their own residents; don't retain or simulate hidden
    // road actors, arrows, combat and physics bodies behind a room.
    if(this.scene.inInterior&&(this.parties.size>0||this.pendingParty))this.clear();
    if(blocked){
      if(this.active)for(const party of this.parties.values())for(const walker of party.walkers){
        walker.target=null;walker.attacking=false;walker.npc.endStoryAttack();walker.npc.endStoryGuard();walker.npc.endStoryMovement();
      }
      this.active=false;this.opponents.clear();this.previousOpponents.clear();this.spawnCandidates.length=0;
      this.scanRemaining=0;this.combatEnemies=this.emptyEnemies;this.arrows.clear();return;
    }
    this.active=true;const step=Math.min(100,Math.max(0,delta));
    // O(1) offscreen simulation: all virtual journeys share one clock. A route
    // holds only a time offset, adjusted from its actual feet when unloaded.
    // No hundreds-of-routes update loop while exploring unrelated regions.
    this.virtualTime+=step;
    const player=this.scene.player;
    const region=this.world.getRegionAt(player.x,player.y);
    if(region!==this.activeRegion){
      this.activeRegion=region;this.scan=0;this.scanRemaining=0;this.spawnCandidates.length=0;
      // A traveler party prepared outside the player's old region is still
      // offscreen. Don't finish spawning it after crossing a region boundary.
      if(this.pendingParty)this.release(this.pendingParty.party.id,this.pendingParty.party);
    }
    this.scan-=step;this.think-=step;
    const view=groundWorldView(this.scene);
    for(const [id,party] of this.parties)if(party.walkers.every(w=>!w.npc.active||
      w.npc.x<view.x-650||w.npc.x>view.right+650||w.npc.y<view.y-550||w.npc.y>view.bottom+750))this.release(id,party);
    if(this.scan<=0){this.scan=2500;this.populate();}
    this.collectSpawnCandidates();
    this.processSpawnCandidates();
    // Introduce one actor per frame, not three animated bodies, labels and
    // shadow registrations on the same frame when a new guard party appears.
    this.spawnNextWalker();
    // No travelers means no enemies to scan, arrow targets to evaluate or
    // opponent tables to rebuild. Virtual journeys still progress above.
    if(this.parties.size===0){this.opponents.clear();this.previousOpponents.clear();this.combatEnemies=this.emptyEnemies;this.think=0;return;}
    const decide=this.think<=0;
    if(decide){
      this.think=150;
      // All fighters make decisions on this same tick. Avoid rebuilding the
      // entire enemy candidate array on every animation frame between ticks.
      this.combatEnemies=this.scene.getCombatEnemies().filter(e=>e.active&&e.hp>0&&e.canBeTargeted&&this.scene.canRoadNpcFight(e));
    }
    const enemies=this.combatEnemies;
    this.arrows.update(step,enemies);
    // Double-buffer opponent maps: preserve windups without cloning a map
    // and then clearing/repopulating it on every frame.
    const previousOpponents=this.opponents;
    this.opponents=this.previousOpponents;this.opponents.clear();
    this.previousOpponents=previousOpponents;
    for(const party of this.parties.values()){
      const leader=party.walkers[0]?.npc;
      if(leader&&!party.walkers.some(w=>w.target))party.anchor={x:leader.x,y:leader.y};
      for(const walker of party.walkers){
        const {npc}=walker;if(!npc.active)continue;
        const spec=npc.combatProfile;if(spec)this.art.ensure(spec);
        walker.cooldown=Math.max(0,walker.cooldown-step);
        if(walker.rest>0){walker.rest=Math.max(0,walker.rest-step);walker.hp=Math.min(walker.maxHp,walker.hp+step*.012);}
        const target=walker.target;
        if(target&&(!enemies.includes(target)||walker.rest>0||walker.engageFrom&&Math.hypot(target.x-walker.engageFrom.x,target.y-walker.engageFrom.y)>760)){
          walker.target=null;walker.attacking=false;npc.endStoryAttack();npc.endStoryGuard();npc.setStoryAlert();
        }
        if(!walker.target&&walker.rest===0&&decide&&npc.canStoryFight){
          // Sort by cheap squared distance BEFORE invoking the expensive
          // terrain and line-of-sight checks. Keep nearest reachable targeting.
          const range=party.patrol?400:320;
          const nearby=this.targetCandidates;
          let count=0;
          for(const enemy of enemies){
            const d2=(enemy.x-npc.x)**2+(enemy.y-npc.y)**2;
            if(d2>=range*range)continue;
            if(count<nearby.length){nearby[count].enemy=enemy;nearby[count].d2=d2;}
            else nearby.push({enemy,d2});
            count++;
          }
          nearby.length=count;nearby.sort((a,b)=>a.d2-b.d2);
          walker.target=nearby.find(({enemy})=>this.scene.canNpcVisit(npc,enemy)
            &&this.scene.hasClearPath(npc.x,npc.y,enemy.x,enemy.y))?.enemy??null;
          if(walker.target){walker.engageFrom={x:npc.x,y:npc.y};npc.beginStoryGuard();npc.setStoryAlert(party.patrol?'Defending the road':'Engaging a roaming threat');}
        }
        const foe=walker.target;
        if(foe){
          const previous=this.opponents.get(foe);
          // Keep a fighter's opponent through its windup instead of cancelling
          // impacts whenever another party member becomes a pixel nearer.
          if(!previous||previousOpponents.get(foe)===npc||previousOpponents.get(foe)!==previous
            &&Math.hypot(npc.x-foe.x,npc.y-foe.y)<Math.hypot(previous.x-foe.x,previous.y-foe.y))this.opponents.set(foe,npc);
          if(walker.attacking){
            if(!walker.hit&&npc.storyStrikeReady){
              walker.hit=true;
              const toward=new Phaser.Math.Vector2(foe.x-npc.x,foe.y-npc.y),distance=toward.length();
              if(distance<=npc.storyAttackReach+8&&walker.aim&&walker.aim.dot(toward.normalize())>=.45
                &&this.scene.hasClearPath(npc.x,npc.y,foe.x,foe.y)){
                if(spec?.mode==='bow')this.arrows.fire(npc,foe);
                else foe.takeDamage(8+foe.level*1.4+(party.patrol&&walker.rank===0?7:0),
                  new Phaser.Math.Vector2(foe.x-npc.x,foe.y-npc.y).normalize(),{source:'ambient-ally'});
              }
            }
            if(npc.storyAttackFinished){walker.attacking=false;npc.endStoryAttack();}
          }else if(decide){
            const distance=Math.hypot(foe.x-npc.x,foe.y-npc.y);
            if(distance<=npc.storyAttackReach){
              npc.endStoryMovement();npc.holdStoryGuard(foe);
              if(walker.cooldown===0&&npc.beginStoryAttack(foe)){
                walker.attacking=true;walker.hit=false;walker.cooldown=1900+this.rng()*500;
                walker.aim=new Phaser.Math.Vector2(foe.x-npc.x,foe.y-npc.y).normalize();
              }
            }else{
              const angle=Math.atan2(npc.y-foe.y,npc.x-foe.x)+walker.rank*.5;
              const goal={x:foe.x+Math.cos(angle)*npc.storyAttackReach*.8,y:foe.y+Math.sin(angle)*npc.storyAttackReach*.8};
              if(this.routeClear(npc,goal))npc.beginStoryMovement(goal);else npc.endStoryMovement();
            }
          }
        }else if(decide){
          if(walker.rest===0)npc.setStoryAlert();
        }
      }
    }
  }
  private routeClear(npc:Npc,goal:Vec2){
    return this.scene.canNpcVisit(npc,goal)&&this.scene.canTraverseGround(npc,goal)
      &&!this.scene.npcPathBlocker(npc,goal,npc)
      &&[-12,12].every(dx=>[0,-20].every(dy=>this.world.isWalkable(goal.x+dx,goal.y+dy)));
  }
  private populate(){
    if(this.parties.size>=2||this.pendingParty||this.scanRemaining>0)return;
    // Candidate discovery used to project EVERY virtual road traveler in one
    // frame every 2.5 seconds. Budget projections across frames instead.
    this.spawnCandidates.length=0;
    this.scanCursor=Math.floor(this.rng()*Math.max(1,this.routes.length));
    this.scanRemaining=this.routes.length;
  }
  private collectSpawnCandidates(){
    if(this.scanRemaining===0)return;
    if(this.pendingParty||this.parties.size>=2){this.scanRemaining=0;this.spawnCandidates.length=0;return;}
    const player=this.scene.player,view=groundWorldView(this.scene);
    const count=Math.min(24,this.scanRemaining);
    for(let i=0;i<count;i++){
      const route=this.routes[this.scanCursor];
      this.scanCursor=(this.scanCursor+1)%this.routes.length;
      this.scanRemaining--;
      if(this.parties.has(route.id))continue;
      const typeKey=this.activeRegion+':'+(route.patrol?'guard':'adventurer');
      if(this.scene.time.now<(this.nextGroupAt.get(typeKey)??0))continue;
      // Query this route's virtual location only when a nearby party is needed.
      const virtual=routePosition(route,route.clock+this.virtualTime);
      if(this.eligibleViewBand(virtual,view)
        &&this.world.getRegionAt(virtual.x,virtual.y)===this.activeRegion)
        this.spawnCandidates.push({route,point:virtual});
      // Sparse virtual journeys can be miles from the player's road. Use one
      // representative travel slot per authored road for a nearby encounter;
      // guards already each have their own dedicated patrol route.
      if(route.patrol||route.id.endsWith(':0'))for(const point of this.nearbyRoadEntries(route,player,view))
        this.spawnCandidates.push({route,point});
    }
    if(this.scanRemaining===0){
      // Preserve the previous randomized party selection without a large
      // projection pass, and keep position/placement logic unchanged.
      for(let i=this.spawnCandidates.length-1;i>0;i--){
        const j=Math.floor(this.rng()*(i+1));
        [this.spawnCandidates[i],this.spawnCandidates[j]]=[this.spawnCandidates[j],this.spawnCandidates[i]];
      }
    }
  }
  private processSpawnCandidates(){
    if(this.scanRemaining>0)return;
    if(this.pendingParty||this.parties.size>=2){this.spawnCandidates.length=0;return;}
    // At most two placement validations per frame. No frame should pay for
    // a dozen terrain/collider probes just to admit ambient decoration.
    let placementChecks=0;
    while(this.spawnCandidates.length>0&&placementChecks<2){
      const {route,point}=this.spawnCandidates.pop()!;
      // The player may have moved while discovery was spread over several
      // frames. Never spend resources spawning a now-invisible party.
      if(!this.eligibleViewBand(point,groundWorldView(this.scene)))continue;
      if(this.parties.has(route.id))continue;
      if([...this.parties.values()].some(p=>p.patrol===route.patrol||Math.hypot(p.anchor.x-point.x,p.anchor.y-point.y)<700))continue;
      const patrol=route.patrol;
      const typeKey=this.activeRegion+':'+(patrol?'guard':'adventurer');
      if(this.scene.time.now<(this.nextGroupAt.get(typeKey)??0))continue;
      if(this.world.getRegionAt(point.x,point.y)!==this.activeRegion)continue;
      const roster=patrol?GUARD_PATROL:ADVENTURER_PARTY,number=roster.length;
      // One captain with two guards, plus one adventurer and one huntress:
      // never more than five roaming combat actors near the player.
      if([...this.parties.values()].reduce((n,p)=>n+p.walkers.length,0)+number>5)continue;
      placementChecks++;
      const positions=Array.from({length:number},(_,rank)=>routePointAtDistance(route,
        point.distance+(point.forward?-1:1)*rank*78));
      const nearbyEnemies=this.scene.getCombatEnemies();
      if(positions.some((p,i)=>!this.scene.npcCanStandAt(p.x,p.y)
        ||i>0&&Math.hypot(p.x-positions[i-1].x,p.y-positions[i-1].y)<60
        ||nearbyEnemies.some(e=>e.active&&Math.hypot(e.x-p.x,e.y-p.y)<180)))continue;
      const party:Party={id:route.id,walkers:[],anchor:point,patrol,route};
      this.parties.set(route.id,party);
      this.pendingParty={party,positions,roster,forward:point.forward,next:0};
      this.nextGroupAt.set(typeKey,this.scene.time.now+(patrol?GUARD_REVISIT_MS:ADVENTURER_REVISIT_MS));
      this.spawnCandidates.length=0;
      return;
    }
  }
  private spawnNextWalker(){
    const pending=this.pendingParty;if(!pending||this.scene.time.now<this.nextWalkerAt)return;
    const {party,positions,roster,forward}=pending,rank=pending.next;
    if(!this.parties.has(party.id)||rank>=positions.length){this.pendingParty=null;return;}
    const {route,patrol}=party,p=positions[rank];
    const town=TOWN_BY_ID[route.townId],destination=TOWN_BY_ID[forward?route.destinationId:route.townId];
    const elven=town.regionId==='narenthil';
    const role=roster[rank],bow=!patrol&&role!=='swordhand';
    const definition:NpcDefinition={id:`road-life:${route.id}:${rank}`,
      name:patrol?(rank===0?'Patrol Commander':'Road Guard'):role==='huntress'?'Traveling Huntress':role==='archer'?'Traveling Archer':'Traveling Adventurer',
      title:patrol?`${town.name} outer watch`:`${positions.length>1?'Adventuring party':'Independent traveler'} to ${destination.name}`,
      townId:town.id,visualRegion:patrol?town.regionId:'trandum',
      role:patrol?'road guard':'adventurer',spriteFrame:0,
      spriteTexture:patrol?(elven?'npc_elven_guard_idle':rank===0?'npc_general':'npc_guard'):role==='huntress'?'npc_huntress':'npc_adventurer',
      worldOffset:{x:p.x-town.world.x,y:p.y-town.world.y},combatant:true,stationary:true,
      weaponId:bow?'narenthil-longbow':'roadwarden-sword',schedule:[],questIds:[],dialogue:[],relationshipToLeigneron:{kind:'acquaintance',trust:0,summary:'A fellow traveler on the road.'}};
    const npc=this.scene.createRoadNpc(definition,p),maxHp=(patrol?180:110)+useGameStore.getState().level*9;
    let nearest=Infinity,next=1;
    for(let i=1;i<route.points.length;i++){
      const a=route.points[i-1],b=route.points[i],dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy;
      const t=len2?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/len2)):0;
      const gap=Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);
      if(gap<nearest){nearest=gap;next=forward?i:i-1;}
    }
    npc.followRoadRoute(route.points,route.speed,{next,direction:forward?1:-1});
    party.walkers.push({npc,maxHp,hp:maxHp,rest:0,cooldown:rank*200,target:null,engageFrom:null,hit:false,attacking:false,rank,aim:null});
    this.nextWalkerAt=this.scene.time.now+160;
    if(++pending.next>=positions.length)this.pendingParty=null;
  }
  private release(id:string,party:Party){
    if(this.pendingParty?.party===party)this.pendingParty=null;
    const leader=party.walkers.find(w=>w.npc.active)?.npc;
    if(leader){
      rememberRoadJourney(party.route,leader,leader.roadTravelDirection);
      party.route.clock-=this.virtualTime;
    }
    for(const walker of party.walkers){this.arrows.forget(walker.npc);if(walker.npc.active)this.scene.releaseRoadNpc(walker.npc);}
    this.parties.delete(id);
    for(const [enemy,npc] of this.opponents)if(party.walkers.some(w=>w.npc===npc))this.opponents.delete(enemy);
  }
  clear(){this.arrows.clear();for(const [id,party] of this.parties)this.release(id,party);this.pendingParty=null;this.scanRemaining=0;this.spawnCandidates.length=0;this.opponents.clear();this.previousOpponents.clear();this.combatEnemies=this.emptyEnemies;this.targetCandidates.length=0;this.active=false;}
  destroy(){this.clear();this.arrows.destroy();this.art.destroy();}
}
