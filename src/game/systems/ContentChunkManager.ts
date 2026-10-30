import type {FrameWorkBudget} from '../presentation25d/FrameWorkBudget';
import type { ContentDefinition, ContentState, ContentWorldState, CreatureContentDefinition, EncounterRole, Vec2 } from '../types';
import { chunkNeighborhood,nearbyPhysicsChunks, contentChunkKey,viewportChunks,type StreamView } from './chunkNeighborhood';
import {CHUNK_SIZE,STREAM_RADIUS,WORLD_WIDTH,WORLD_HEIGHT} from '../../data/world';
import {ENEMY_BY_ID,isWolfFamily} from '../../data/enemies';
import {MAX_LIVE_HOSTILES,MAX_PERSISTENT_SPAWNS} from './encounterAdmission';
import {NPC_BY_ID} from '../../data/npcs';
import {npcMayPatrol} from './npcPlacement';
import {StaticBoundsIndex} from './StaticBoundsIndex';
import {spriteBounds} from '../../data/settlementGeometry';

/** Old boss calls were event spawns without ownership. Adopt only matching
 * event families near a uniquely identifiable wounded/defeated boss. Ordinary
 * ambient records and authored creatures never participate in this migration. */
export function restoreLegacySummonWaves(definitions: ContentDefinition[], world: ContentWorldState): ContentWorldState {
  const result={...world,states:{...world.states}};
  const bosses=definitions.filter((d):d is CreatureContentDefinition=>d.kind==='creature'&&Boolean(d.bossId)
    &&Boolean(ENEMY_BY_ID[d.enemyId].summonComposition));
  const groups=new Map<string,CreatureContentDefinition[]>();
  for(const d of Object.values(world.spawns)){
    if(!d.eventSpawn)continue;
    const key=d.encounterId??d.wolfPackId??d.id;
    const members=groups.get(key)??[];members.push(d);groups.set(key,members);
  }
  const owned=new Set(Object.values(world.states).flatMap(s=>s.summonWave?.members??[]));
  for(const members of groups.values()){
    if(members.some(m=>owned.has(m.id))||members.every(m=>world.states[m.id]?.defeated===true))continue;
    const candidates=bosses.filter(b=>{
      const state=world.states[b.id],enemy=ENEMY_BY_ID[b.enemyId];
      if(!state||state.summonWave||state.hp===undefined||state.hp>=(state.hpMax??enemy.hp))return false;
      return members.every(m=>m.enemyId===enemy.summonEnemyId
        ||b.bossId==='salt-king'&&m.enemyId==='pirate-boatswain')
        &&members.some(m=>Math.hypot(m.world.x-state.x,m.world.y-state.y)<=300);
    });
    if(candidates.length!==1)continue;
    const boss=candidates[0],prior=result.states[boss.id].summonWave;
    result.states[boss.id]={...result.states[boss.id],summonWave:{
      encounterId:prior?.encounterId??`boss-wave:${boss.bossId}:legacy`,
      members:[...(prior?.members??[]),...members.map(m=>m.id)],nextAt:0}};
  }
  return result;
}

function creatureGroupKey(definition: CreatureContentDefinition) {
  if (definition.bossId) return undefined; // Authored bosses keep independent admission.
  // Wolf AI retains its established identity, including mixed old/new records.
  // Namespace keys so a future non-wolf encounter cannot join a wolf pack.
  if (definition.wolfPackId) return `wolf:${definition.wolfPackId}`;
  return definition.encounterId ? `encounter:${definition.encounterId}` : undefined;
}

export interface CreatureActivation {
  definition: CreatureContentDefinition;
  state: ContentState;
}

export interface EncounterSpawnMember { enemyId: string; world: Vec2; role?: EncounterRole }

export interface ContentHost<Actor> {
  frameWork?:()=>FrameWorkBudget;
  keepActive?(definition:ContentDefinition,actor:Actor):boolean;
  initialState(definition: ContentDefinition): ContentState;
  canActivate?(definition: ContentDefinition, state: ContentState): boolean;
  canRespawn?(definition:ContentDefinition):boolean;
  /** Publish semantic returns before their actors can fight again. */
  respawned?(definition:ContentDefinition,state:ContentState):void;
  /** Check the complete pending group against shared capacity before creating
   * any of its actors. Existing active members already consume their slots. */
  canActivateGroup?(members: readonly CreatureActivation[]): boolean;
  prepareCreatureGroup?(members: readonly CreatureActivation[]): boolean;
  create(definition: ContentDefinition, state: ContentState): Actor;
  position(actor: Actor): Vec2;
  capture(definition: ContentDefinition, actor: Actor): Partial<ContentState>;
  destroy(actor: Actor): void;
}

/** Logical records survive unloading; only the local render/physics actors are disposable. */
export class ContentChunkManager<Actor> {
  private readonly definitions = new Map<string, ContentDefinition>();
  private readonly states = new Map<string, ContentState>();
  private readonly spawns = new Map<string, CreatureContentDefinition>();
  private readonly buckets = new Map<string, Set<string>>();
  private readonly locations = new Map<string, string>();
  private readonly active = new Map<string, Actor>();
  private readonly retiring=new Map<string,number>();
  private readonly returns=new Set<string>();
  private nextReturnAt=Infinity;
  private readonly oversized=new Map<string,number>();
  private readonly creatureGroups = new Map<string, Set<string>>();
  private wanted = new Set<string>();
  private centerKey = '';
  private readonly sceneryIndex:StaticBoundsIndex<{id:string;bounds:StreamView}>;
  private sceneryKey='';
  private sceneryWanted=new Set<string>();
  private sceneryCandidates=new Set<string>();
  private nextAdmissionCheckAt=0;
  private admissionBootstrapped=false;
  private admissionDeferred=false;
  private admissionCursor:Generator<string,void>|null=null;
  private admissionPlayerCell='';
  private readonly admissionRetryAt=new Map<string,number>();
  get settled(){return !this.admissionDeferred;}
  private cleanupPending=false;
  private nextSpawnSequence: number;
  private readonly summonOwners = new Map<string,string>();

  constructor(definitions: ContentDefinition[], persisted: ContentWorldState, private readonly host: ContentHost<Actor>) {
    this.sceneryIndex=new StaticBoundsIndex(definitions.flatMap(d=>{
      if(!('frame' in d))return [];
      const scale=d.scale??.6,b=spriteBounds(d.texture??'world_objects',d.frame,scale,d.world.x,d.world.y,d.anchor==='center');
      const angle=d.rotation??0,c=Math.cos(angle),s=Math.sin(angle);
      const corners=[[b.left,b.top],[b.right,b.top],[b.left,b.bottom],[b.right,b.bottom]]
        .map(([x,y])=>({x:d.world.x+(x-d.world.x)*c-(y-d.world.y)*s,y:d.world.y+(x-d.world.x)*s+(y-d.world.y)*c}));
      return [{id:d.id,bounds:{left:Math.min(...corners.map(p=>p.x)),right:Math.max(...corners.map(p=>p.x)),
        top:Math.min(...corners.map(p=>p.y)),bottom:Math.max(...corners.map(p=>p.y))}}];
    }));
    this.nextSpawnSequence = persisted.nextSpawnSequence;
    const known=new Map([...definitions,...Object.values(persisted.spawns)].map(d=>[d.id,d]));
    for (const [id, state] of Object.entries(persisted.states)) {
      const d=known.get(id);if(!d) continue;
      // Static placements are authored, not world relocations. Layout repairs
      // apply to old saves while preserving opened caches and attuned shrines.
      // Fixed residents in every town use the repaired court coordinates;
      // walking guards and the escorted witness retain their live journeys.
      const npc=d.kind==='npc'?NPC_BY_ID[d.npcId]:undefined;
      const fixedNpc=npc&&!npcMayPatrol(npc);
      const escortedNpc=d.kind==='npc'&&d.npcId==='tovin-reed';
      // Creature coordinates were geometry-validated before this constructor.
      // Do not overwrite repaired boss positions with an obstructed authored anchor.
      this.states.set(id,{...state,...(fixedNpc&&!escortedNpc&&!npc?.storyReturn||(d.kind!=='npc'&&d.kind!=='creature')?d.world:{})});
      if(state.defeated&&state.respawnAt!==undefined){
        this.returns.add(id);this.nextReturnAt=Math.min(this.nextReturnAt,state.respawnAt);
      }
    }
    for (const definition of definitions) this.register(definition);
    for (const definition of Object.values(persisted.spawns)) {
      this.register(definition); this.spawns.set(definition.id, definition);
    }
    this.sceneryCandidates=new Set(this.oversized.keys());
    this.normalizeEncounterBehavior();
    for(const [id,state] of this.states)for(const member of state.summonWave?.members??[])this.summonOwners.set(member,id);
  }

  update(x: number, y: number,view?:StreamView): boolean {
    // Rebuild residency only when its cell bounds change. Preserve the local
    // physics neighborhood even when the perspective footprint looks ahead.
    const playerCell=contentChunkKey(x,y);
    if(playerCell!==this.admissionPlayerCell){
      // A teleport must inspect its new physics neighborhood immediately.
      // Camera-only rotations retain the iterator and its fairness.
      this.admissionPlayerCell=playerCell;this.admissionCursor=null;
    }
    const center=view?playerCell+':view:'
      +Math.floor((view.left-768)/CHUNK_SIZE)+':'+Math.floor((view.right+768)/CHUNK_SIZE)+':'
      +Math.floor((view.top-768)/CHUNK_SIZE)+':'+Math.floor((view.bottom+768)/CHUNK_SIZE)+':'+(view.key??''):playerCell;
    let changed = center !== this.centerKey;
    if(changed){
      this.centerKey=center;this.wanted=view?nearbyPhysicsChunks(x,y):chunkNeighborhood(x,y);
      if(view)for(const key of viewportChunks(view,384))this.wanted.add(key);
    }
    // Roofs and canopies may be visible while their base belongs to another
    // chunk. Query immutable drawn bounds, not a larger world neighborhood.
    const sceneryKey=view?[view.left-768,view.right+768,view.top-768,view.bottom+768].map(v=>Math.floor(v/512)).join(':')+':'+(view.key??''):'';
    if(sceneryKey!==this.sceneryKey){
      this.sceneryKey=sceneryKey;
      this.sceneryWanted=view?new Set(this.sceneryIndex.query({left:view.left-768,right:view.right+768,top:view.top-768,bottom:view.bottom+768})
        .filter(item=>!view.containsChunk||view.containsChunk(Math.floor((item.bounds.left+item.bounds.right)/2/CHUNK_SIZE),Math.floor((item.bounds.top+item.bounds.bottom)/2/CHUNK_SIZE),384))
        .map(item=>item.id)):new Set();
      this.sceneryCandidates=new Set([...this.oversized.keys(),...this.sceneryWanted]);
      changed=true;
    }
    const now=Date.now();
    // Only scheduled returns are inspected, even while their chunks are far
    // away. The saved UTC deadline includes time spent offline/in menus.
    if(now>=this.nextReturnAt){
    this.nextReturnAt=Infinity;
    for(const id of this.returns){
      const state=this.states.get(id),definition=this.definitions.get(id);
      if(!state||!definition||state.respawnAt===undefined){this.returns.delete(id);continue;}
      if(state.respawnAt>now){this.nextReturnAt=Math.min(this.nextReturnAt,state.respawnAt);continue;}
      // A due return blocked by an active encounter must be reconsidered next
      // update, exactly as before; only future deadlines skip their scan.
      if(this.host.canRespawn&&!this.host.canRespawn(definition)){this.nextReturnAt=Math.min(this.nextReturnAt,state.respawnAt);continue;}
      const restored={...state,...this.host.initialState(definition),defeated:false,respawnAt:undefined,bossPhase:undefined,
        ...(definition.kind==='creature'&&definition.bossId&&!state.summonWave?.members.length?{summonWave:undefined}:{})};
      this.states.set(id,restored);this.index(id,contentChunkKey(restored.x,restored.y));
      this.returns.delete(id);changed=true;
      this.host.respawned?.(definition,{...restored});
    }
    }
    // Destroying an entire streamed settlement in one frame can create
    // comparable hitches to spawning it. Spread teardown over live frames.
    const work=this.host.frameWork?.(),retireStart=performance.now();
    const retireAllowance=work?.remaining('retire',.4)??.4;
    const budgetDestruction=Boolean(view)&&this.admissionBootstrapped;
    let destroyed=0,cleanupPending=false,retireCost=0;
    // Only near actors are inspected. Bucket migration lets moving creatures cross chunks.
    for (const [id, actor] of this.active) {
      const kind=this.definitions.get(id)!.kind;
      // Authored scenery does not migrate between chunks every physics frame.
      // Oversized landmarks still depend on distance inside the same chunk.
      if(!changed&&!this.cleanupPending&&kind!=='npc'&&kind!=='creature'&&!this.oversized.has(id))continue;
      const position = this.host.position(actor);
      const key = contentChunkKey(position.x, position.y);
      this.index(id, key);
      if (!this.wanted.has(key)&&!this.sceneryWanted.has(id)&&!this.nearOversized(id,position,x,y,view)
        &&!this.host.keepActive?.(this.definitions.get(id)!,actor)) {
        if(budgetDestruction){
          const until=this.retiring.get(id)??now+1200;this.retiring.set(id,until);
          if(now<until){cleanupPending=true;continue;}
        }
        if(budgetDestruction&&(destroyed>=4||destroyed>0&&performance.now()-retireStart>=retireAllowance)){cleanupPending=true;continue;}
        const disposeStart=performance.now();this.deactivate(id);retireCost+=performance.now()-disposeStart;destroyed++;changed=true;
      }else this.retiring.delete(id);
    }
    work?.chargeMs('retire',retireCost);
    this.cleanupPending=cleanupPending;
    // Keep all active actor migration running every frame, but retry the
    // expensive inactive-world admission search only every 150 ms when still.
    if(changed||now>=this.nextAdmissionCheckAt){
      this.nextAdmissionCheckAt=now+150;
    const checkedGroups = new Set<string>();
    const budgeted=Boolean(view)&&this.admissionBootstrapped;
    this.admissionBootstrapped=true;
    const admissionStart=performance.now(),admissionAllowance=work?.remaining('actors',2)??2;
    let admitted=0,attempted=0,deferred=false;
    // Failed geometry/admission checks spend the same allowance as successful
    // spawns. Preserve the iterator so rejected records at the front cannot
    // starve a quest contact or scenery later in the neighborhood.
    const exhausted=()=>budgeted&&(admitted>=4||attempted>=16
      ||attempted>0&&performance.now()-admissionStart>=admissionAllowance);
    this.admissionCursor??=this.admissionCandidates();
    while(true){
      if(exhausted()){deferred=true;break;}
      const next=this.admissionCursor.next();
      if(next.done){this.admissionCursor=null;break;}
      const id=next.value;
      if(this.active.has(id))continue;
      const definition=this.definitions.get(id),state=this.getState(id);
      if(!definition||!state||state.defeated)continue;
      if(!this.wanted.has(this.locations.get(id)!)&&!this.sceneryWanted.has(id)
        &&!this.nearOversized(id,state,x,y,view))continue;
      const groupKey=definition.kind==='creature'?creatureGroupKey(definition):undefined;
      const retryKey=groupKey??id;
      if(now<(this.admissionRetryAt.get(retryKey)??0))continue;
      if(groupKey&&this.host.canActivateGroup){
        if(checkedGroups.has(groupKey))continue;
        checkedGroups.add(groupKey);attempted++;
        const before=this.active.size;
        if(this.activateCreatureGroup(groupKey)){
          admitted+=this.active.size-before;changed=true;this.admissionRetryAt.delete(retryKey);
        }else this.admissionRetryAt.set(retryKey,now+250);
        continue;
      }
      attempted++;
      if(this.host.canActivate&&!this.host.canActivate(definition,state)){
        this.admissionRetryAt.set(retryKey,now+250);continue;
      }
      this.admissionRetryAt.delete(retryKey);
      this.active.set(id,this.host.create(definition,{...state}));admitted++;changed=true;
    }
    // A deferred activation should resume next tick, not wait for another
    // camera boundary change or the normal stationary 150 ms poll.
    this.admissionDeferred=deferred;
    if(deferred)this.nextAdmissionCheckAt=0;
    if(budgeted)work?.charge('actors',admissionStart);
    }
    return changed;
  }

  private *admissionCandidates():Generator<string,void>{
    const seen=new Set<string>();
    for(const key of this.wanted)for(const id of this.buckets.get(key)??[]){
      if(!seen.has(id)){seen.add(id);yield id;}
    }
    for(const id of this.sceneryCandidates)if(!seen.has(id))yield id;
  }

  addSpawn(enemyId: string, world: Vec2, eventSpawn: boolean,
    group?: Pick<CreatureContentDefinition, 'encounterId' | 'wolfPackId' | 'wolfAlpha'>) {
    // Old defeated encounter records need not fill the persistent 512-spawn cap.
    if(this.spawns.size >= 380)this.pruneDefeatedSpawns();
    const definition: CreatureContentDefinition = {
      id: `spawn:${this.nextSpawnSequence++}`, kind: 'creature', enemyId, world: { ...world }, eventSpawn,
      ...(group ?? {}),
    };
    this.spawns.set(definition.id, definition);
    this.register(definition);
    const key=creatureGroupKey(definition);
    if(key)this.normalizeEncounterBehavior(key);
    return definition.id;
  }

  /** The scene supplies its current shared-budget capacity and validates
   * habitat/geometry first. This commits a complete logical encounter without
   * creating actors or spending sequence IDs on a rejected batch. */
  addEncounter(members: readonly EncounterSpawnMember[], eventSpawn: boolean, availableSlots: number,
    options: { wolfPack?: boolean; leashRadius?: number; bossOwner?: string } = {}): string[] | null {
    if (!members.length || members.length > MAX_LIVE_HOSTILES || !Number.isFinite(availableSlots)
      || members.length > availableSlots || !Number.isSafeInteger(this.nextSpawnSequence) || this.nextSpawnSequence < 0
      || this.nextSpawnSequence + members.length > Number.MAX_SAFE_INTEGER) return null;
    const leashRadius = options.leashRadius ?? 900;
    if (!Number.isFinite(leashRadius) || leashRadius < 256 || leashRadius > 1600) return null;
    if (options.wolfPack && (members.length < 4 || members.length > 6
      || members.some(member => !isWolfFamily(member.enemyId)||member.enemyId!==members[0].enemyId))) return null;
    for (const [i,{ enemyId, world, role }] of members.entries()) {
      const enemy = Object.hasOwn(ENEMY_BY_ID, enemyId) ? ENEMY_BY_ID[enemyId] : undefined;
      if (!enemy || enemy.boss || !Number.isFinite(world.x) || !Number.isFinite(world.y)
        || world.x < 0 || world.y < 0 || world.x >= WORLD_WIDTH || world.y >= WORLD_HEIGHT
        || role !== undefined && !['leader','melee','flanker','ranged','heavy'].includes(role)
        || Math.hypot(world.x-members[0].world.x,world.y-members[0].world.y) > leashRadius * .4) return null;
      const radius=(enemy.bodyRadius??11)*(options.wolfPack&&i===0?1.18:1);
      for(let j=0;j<i;j++) {
        const other=members[j],otherDefinition=ENEMY_BY_ID[other.enemyId];
        const otherRadius=(otherDefinition.bodyRadius??11)*(options.wolfPack&&j===0?1.18:1);
        if(Math.hypot(world.x-other.world.x,world.y-other.world.y)<Math.max(35,radius+otherRadius+8))return null;
      }
    }
    if (this.getSpawnCount() + members.length > MAX_PERSISTENT_SPAWNS) return null;
    if(options.bossOwner){
      const owner=this.definitions.get(options.bossOwner),state=this.getState(options.bossOwner);
      if(owner?.kind!=='creature'||!owner.bossId||!state||state.defeated
        ||!eventSpawn||!state.summonWave||state.summonWave.members.length||Date.now()<state.summonWave.nextAt)return null;
      const composition=ENEMY_BY_ID[owner.enemyId].summonComposition;
      if(!composition||composition.reduce((sum,m)=>sum+m.count,0)!==members.length
        ||composition.some(part=>members.filter(m=>m.enemyId===part.enemyId&&m.role===part.role).length!==part.count))return null;
    }
    const encounterId = options.bossOwner ? `boss-wave:${options.bossOwner.slice(5)}:${this.nextSpawnSequence}`
      : `${options.wolfPack ? 'wolf-pack' : 'encounter'}:${this.nextSpawnSequence}`;
    // Resolve every initial state before touching indices. An initializer
    // failure must not leave half a pack registered or consume its identities.
    const orderedIds = members.map((_, i) => `spawn:${this.nextSpawnSequence + i}`);
    if (options.wolfPack) orderedIds.splice(1, orderedIds.length - 1, ...orderedIds.slice(1).sort((a,b)=>a.localeCompare(b)));
    const staged = members.map(({ enemyId, world, role }, i) => {
      const definition: CreatureContentDefinition = {
        id: `spawn:${this.nextSpawnSequence + i}`, kind: 'creature', enemyId, world: { ...world },
        eventSpawn, encounterId,
        encounterBehavior: { home: {...members[0].world}, station: {...world}, leashRadius,
          role: options.wolfPack ? i === 0 ? 'leader' : 'flanker' : role ?? (i === 0 ? 'leader' : 'melee'),
          slot: orderedIds.indexOf(`spawn:${this.nextSpawnSequence + i}`) },
        ...(options.wolfPack ? { wolfPackId: encounterId, wolfAlpha: i === 0 } : {}),
      };
      if (this.definitions.has(definition.id)) throw new Error(`Duplicate content ID: ${definition.id}`);
      return { definition, initial: this.host.initialState(definition) };
    });
    for (const { definition, initial } of staged) {
      this.register(definition, initial);
      this.spawns.set(definition.id, definition);
    }
    this.nextSpawnSequence += staged.length;
    if(options.bossOwner){
      const ids=staged.map(s=>s.definition.id);
      this.states.set(options.bossOwner,{...this.getState(options.bossOwner)!,summonWave:{encounterId,members:ids,nextAt:0}});
      for(const id of ids)this.summonOwners.set(id,options.bossOwner);
    }
    return staged.map(({ definition }) => definition.id);
  }

  getSummonOwner(id:string){return this.summonOwners.get(id);}
  hasUnfinishedSummons(id:string){return Boolean(this.getState(id)?.summonWave?.members.length);}
  /** Only called by an engaged, live boss. UTC deadlines survive scene reloads. */
  bossWaveReady(id:string,now:number){
    const state=this.getState(id);
    if(!state||state.defeated)return false;
    if(!state.summonWave){
      this.states.set(id,{...state,summonWave:{encounterId:`boss-wave:${id.slice(5)}:initial`,members:[],nextAt:now+3500}});
      return false;
    }
    return state.summonWave.members.length===0&&now>=state.summonWave.nextAt;
  }

  getState(id: string): ContentState | undefined {
    const definition = this.definitions.get(id);
    const recorded=this.states.get(id);
    return definition ? { ...this.host.initialState(definition), ...recorded,
      // A legacy record's HP is real damage, not the untouched spawn default.
      ...(recorded?.hp!==undefined&&recorded.hpMax===undefined?{hpMax:undefined}:{}) } : undefined;
  }
  getDefinition(id: string) { return this.definitions.get(id); }
  getActiveIds() { return [...this.active.keys()]; }
  getActiveKeys() { return [...this.wanted]; }
  getActor(id: string) { return this.active.get(id); }
  /** A named story subject must be present even when ambient admission is
   * temporarily suppressing residents. Actor creation still uses the world's
   * normal placement and collision validation. */
  activateNpcForPresentation(id:string) {
    const active=this.active.get(id);
    if(active)return active;
    const definition=this.definitions.get(id);
    if(definition?.kind!=='npc')return undefined;
    const state=this.getState(id);
    if(!state||state.defeated||this.host.canActivate&&!this.host.canActivate(definition,state))return undefined;
    // Forced dialogue/cinematic activation uses the same geometric admission
    // rules; it must never bypass wall checks for a named quest character.
    const actor=this.host.create(definition,{...state});
    this.active.set(id,actor);
    return actor;
  }
  getWolfPackActors(packId: string) { return this.groupActors(`wolf:${packId}`); }
  getEncounterActors(encounterId: string) { return this.groupActors(`encounter:${encounterId}`); }
  private groupActors(key: string): Actor[] {
    const actors: Actor[] = [];
    for (const id of this.creatureGroups.get(key) ?? []) {
      const actor = this.active.get(id);
      if (actor !== undefined) actors.push(actor);
    }
    return actors;
  }
  /** Admission-time query, not a per-frame world scan. Only the local buckets
   * are visited. Bosses have their own reservations; dead records own no slot. */
  getPendingCreatureCount(x: number, y: number) {
    let count = 0;
    for (const key of chunkNeighborhood(x, y)) {
      for (const id of this.buckets.get(key) ?? []) {
        const definition = this.definitions.get(id)!;
        if (definition.kind !== 'creature' || definition.bossId || this.active.has(id)) continue;
        if (!this.getState(id)!.defeated) count++;
      }
    }
    return count;
  }
  /** Unlike spawn count, this saved sequence never rewinds after pruning. */
  getNextSpawnSequence() { return this.nextSpawnSequence; }
  getSpawnCount() { if(this.spawns.size >= 380)this.pruneDefeatedSpawns(); return this.spawns.size; }
  /** Clear only defeated ambient/event spawns; bosses and authored creatures are never removed. */
  private pruneDefeatedSpawns(){
    for(const id of [...this.spawns.keys()]){
      if(!this.states.get(id)?.defeated || this.active.has(id))continue;
      if(this.summonOwners.has(id))continue; // Legacy singles also retain casualties until the whole wave clears.
      const savedGroup=creatureGroupKey(this.spawns.get(id)!);
      // Keep casualty slots while any packmate survives. Otherwise reload
      // migrations cannot distinguish an old small group from a wounded pack.
      if(savedGroup&&[...(this.creatureGroups.get(savedGroup)??[])].some(member=>!this.states.get(member)?.defeated))continue;
      const bucketKey=this.locations.get(id);
      if(bucketKey){const bucket=this.buckets.get(bucketKey);bucket?.delete(id);if(bucket?.size===0)this.buckets.delete(bucketKey);}
      const groupKey = creatureGroupKey(this.spawns.get(id)!);
      if (groupKey) {
        const members = this.creatureGroups.get(groupKey);
        members?.delete(id);
        if (members?.size === 0){this.creatureGroups.delete(groupKey);this.admissionRetryAt.delete(groupKey);}
      }
      this.locations.delete(id);this.spawns.delete(id);this.states.delete(id);
      this.definitions.delete(id);this.returns.delete(id);this.admissionRetryAt.delete(id);
    }
  }


  patchState(id: string, patch: Partial<ContentState>) {
    if (!this.definitions.has(id)) return;
    this.capture(id);
    const state = { ...this.getState(id)!, ...patch };
    this.states.set(id, state);
    // An absent actor is never evidence of death. Completion requires explicit
    // persistent defeat flags for every member, before corpse pruning occurs.
    const owner=this.summonOwners.get(id);
    if(patch.defeated===true&&owner){
      const boss=this.getState(owner),wave=boss?.summonWave;
      if(wave&&wave.members.every(member=>this.states.get(member)?.defeated===true)){
        const definition=this.definitions.get(owner) as CreatureContentDefinition;
        this.states.set(owner,{...boss!,summonWave:{...wave,members:[],
          nextAt:Date.now()+(ENEMY_BY_ID[definition.enemyId].summonCooldownMs??20000)}});
        for(const member of wave.members)this.summonOwners.delete(member);
      }
    }
    if(state.defeated&&state.respawnAt!==undefined){
      this.returns.add(id);this.nextReturnAt=Math.min(this.nextReturnAt,state.respawnAt);
    }else this.returns.delete(id);
    this.index(id, contentChunkKey(state.x, state.y));
    // A logical relocation disposes the old actor before it can overwrite the new position.
    if (state.defeated || patch.x !== undefined || patch.y !== undefined) this.deactivate(id, false);
  }

  snapshot(): ContentWorldState {
    for (const id of this.active.keys()) this.capture(id);
    return { states: Object.fromEntries(this.states), spawns: Object.fromEntries(this.spawns), nextSpawnSequence: this.nextSpawnSequence };
  }
  /** Preserve ordinary creatures' ledger while a finite story battle owns
   * the local actor budget. Normal streaming restores them afterward. */
  suspendCreatures(){
    for(const id of [...this.active.keys()])if(this.definitions.get(id)?.kind==='creature')this.deactivate(id);
  }

  destroy() {
    this.admissionCursor=null;this.admissionPlayerCell='';this.admissionRetryAt.clear();
    for (const id of [...this.active.keys()]) this.deactivate(id);
    this.wanted.clear();this.sceneryWanted.clear();this.sceneryCandidates.clear();this.sceneryKey='';this.centerKey = '';
  }

  /** Upgrade old group records once without moving actors or changing damage.
   * Persist derived homes/roles so a later reload cannot move their leash. */
  private normalizeEncounterBehavior(key?:string) {
    const groups=key?[this.creatureGroups.get(key)!]:this.creatureGroups.values();
    for (const ids of groups) {
      const definitions = [...ids].map(id => this.definitions.get(id)! as CreatureContentDefinition)
        .sort((a,b)=>Number(Boolean(b.wolfAlpha))-Number(Boolean(a.wolfAlpha)) || a.id.localeCompare(b.id));
      const existing = definitions.find(d=>d.encounterBehavior)?.encounterBehavior;
      const alphaId=definitions.find(d=>d.wolfAlpha)?.id;
      const anchor = definitions.find(d=>!this.states.get(d.id)?.defeated) ?? definitions[0];
      const home = existing?.home ?? this.states.get(anchor.id) ?? anchor.world;
      const occupied=new Set(definitions.filter(d=>d.encounterBehavior).map(d=>d.encounterBehavior!.slot));
      for (const [slot, definition] of definitions.entries()) {
        if (definition.encounterBehavior) continue;
        const station = this.states.get(definition.id) ?? definition.world;
        const radius=existing?.leashRadius ?? 900;
        const alpha=definition.wolfAlpha&&definition.id===alphaId;
        let assigned=definition.wolfPackId&&!alpha?Math.max(1,slot):slot;
        while(occupied.has(assigned)&&assigned<16)assigned++;
        if(assigned>=16)continue; // Corrupt/oversized legacy groups remain unconfigured, not overwritten.
        occupied.add(assigned);
        const safeStation=Math.hypot(station.x-home.x,station.y-home.y)<=radius*.4?station:home;
        const normalized: CreatureContentDefinition = { ...definition,...(definition.wolfPackId?{wolfAlpha:Boolean(alpha)}:{}), encounterBehavior: {
          home: {x:home.x,y:home.y}, station:{x:safeStation.x,y:safeStation.y}, leashRadius:radius,
          role: definition.wolfPackId ? alpha ? 'leader' : 'flanker' : slot === 0 ? 'leader' : 'melee', slot:assigned,
        } };
        this.definitions.set(definition.id, normalized);
        if (this.spawns.has(definition.id)) this.spawns.set(definition.id, normalized);
      }
    }
  }

  private register(definition: ContentDefinition, initial?: ContentState) {
    if (this.definitions.has(definition.id)) throw new Error(`Duplicate content ID: ${definition.id}`);
    this.definitions.set(definition.id, definition);
    const groupKey = definition.kind === 'creature' ? creatureGroupKey(definition) : undefined;
    if (groupKey) {
      let members = this.creatureGroups.get(groupKey);
      if (!members) this.creatureGroups.set(groupKey, members = new Set());
      members.add(definition.id);
    }
    if('streamRadiusChunks' in definition&&definition.streamRadiusChunks)
      this.oversized.set(definition.id,Math.min(3,definition.streamRadiusChunks));
    const state = initial ?? this.getState(definition.id)!;
    this.index(definition.id, contentChunkKey(state.x, state.y));
  }
  private activateCreatureGroup(groupKey: string) {
    const pending: CreatureActivation[] = [];
    const members=this.creatureGroups.get(groupKey);
    let anchor:ContentState|undefined;
    for(const id of members??[])if(this.wanted.has(this.locations.get(id)!)){anchor=this.getState(id);break;}
    if(!anchor)return false;
    // Cached membership avoids searching all saved spawns for every creature.
    for (const id of members ?? []) {
      if (this.active.has(id)) continue;
      const definition = this.definitions.get(id)! as CreatureContentDefinition;
      const state = this.getState(id)!;
      if (state.defeated) continue; // Restore survivors, never resurrect casualties.
      // A camera edge must not split an atomic encounter. Admit nearby
      // offscreen packmates together; distant survivors still wait locally.
      if (!this.wanted.has(this.locations.get(id)!)&&Math.hypot(state.x-anchor.x,state.y-anchor.y)>CHUNK_SIZE) return false;
      pending.push({ definition, state });
    }
    if (!pending.length || this.host.prepareCreatureGroup&&!this.host.prepareCreatureGroup(pending)) return false;
    if(this.host.canActivate&&pending.some(({definition,state})=>!this.host.canActivate!(definition,state)))return false;
    if(!this.host.canActivateGroup!(pending))return false;
    const created: string[] = [];
    try {
      for (const { definition, state } of pending) {
        this.active.set(definition.id, this.host.create(definition, { ...state }));
        created.push(definition.id);
      }
    } catch (error) {
      // Keep logical records unchanged if actor construction fails mid-group.
      for (const id of created) this.deactivate(id, false);
      throw error;
    }
    return true;
  }
  private index(id: string, key: string) {
    const previous = this.locations.get(id);
    if (previous === key) return;
    if (previous) {
      const bucket = this.buckets.get(previous)!;
      bucket.delete(id);
      if (!bucket.size) this.buckets.delete(previous);
    }
    if (!this.buckets.has(key)) this.buckets.set(key, new Set());
    this.buckets.get(key)!.add(id); this.locations.set(id, key);
  }
  private nearOversized(id:string,p:Vec2,x:number,y:number,view?:StreamView){
    const extra=this.oversized.get(id);if(extra===undefined)return false;
    if(view){const margin=extra*CHUNK_SIZE;return p.x>=view.left-margin&&p.x<=view.right+margin
      &&p.y>=view.top-margin&&p.y<=view.bottom+margin;}
    const radius=STREAM_RADIUS+extra;
    return Math.abs(Math.floor(p.x/CHUNK_SIZE)-Math.floor(x/CHUNK_SIZE))<=radius
      &&Math.abs(Math.floor(p.y/CHUNK_SIZE)-Math.floor(y/CHUNK_SIZE))<=radius;
  }
  private capture(id: string) {
    const actor = this.active.get(id), definition = this.definitions.get(id);
    if (!actor || !definition) return;
    const previous=this.getState(id)!,patch=this.host.capture(definition,actor);
    // Camera-driven admissions also publish snapshots. Unmoved scenery must
    // not allocate a second initial state and a replacement saved record.
    let changed=false;
    for(const key in patch)if(patch[key as keyof ContentState]!==previous[key as keyof ContentState]){changed=true;break;}
    if(!changed)return;
    const state={...previous,...patch};
    this.states.set(id,state);
    this.index(id, contentChunkKey(state.x, state.y));
  }
  private deactivate(id: string, capture = true) {
    this.retiring.delete(id);
    const actor = this.active.get(id);
    if (!actor) return;
    if (capture) this.capture(id);
    this.active.delete(id); this.host.destroy(actor);
  }
}

// LEIGHNERON_WOLF_PACKS_ROAD_BANDITS_V1

// LEIGHNERON_MOBILE_GRAPHICS_NPC_FIX_V1
