import Phaser from 'phaser';
import { CHUNK_SIZE } from '../../data/world';
import {projectedGroundView} from '../presentation25d/plane';
import { artScale } from '../../data/art';
import { WORLD_CONTENT } from '../../data/content';
import { WorldGenerator } from './WorldGenerator';
import { chunkNeighborhood,viewportChunks,streamViewKey,type StreamView } from './chunkNeighborhood';
import { TerrainBaker } from './TerrainBaker';
import {planWildernessTreeSteps,planWildernessDetailSteps,type SceneryTree,type SceneryDetail} from './sceneryPlan';
import {spriteBounds} from '../../data/settlementGeometry';
import type {TreeSwaySystem} from './TreeSwaySystem';
import type {DayNightSystem} from './DayNightSystem';
import {planLandmarkScenerySteps} from './LandmarkScenery';
import type {WorldSpriteSystem} from './WorldSpriteSystem';
import {StaticBoundsIndex} from './StaticBoundsIndex';
import {bossArenaBounds} from './bossArenas';
import {getEffectsQuality} from './effectsQuality';

interface ChunkRuntime {
  image: Phaser.GameObjects.Image;
  textureKey: string;
  shared?:boolean;
  scenery: Array<Phaser.GameObjects.Image|Phaser.GameObjects.Sprite>;
}
const authoredReservations=new StaticBoundsIndex(WORLD_CONTENT.map(d=>({definition:d,
  bounds:{left:d.world.x,right:d.world.x,top:d.world.y,bottom:d.world.y}})),CHUNK_SIZE);

export class ChunkManager {
  private readonly scene: Phaser.Scene;
  private readonly world: WorldGenerator;
  private readonly active = new Map<string, ChunkRuntime>();
  // Keep just two recently visited full-resolution ground textures. This
  // prevents expensive rebakes on backtracking without accumulating an
  // unbounded GPU texture cache on Android.
  private readonly recentTerrain=new Map<string,string>();
  private readonly recentTerrainLimit=2;
  // Wilderness placement is deterministic for each chunk. Retain only the
  // lightweight plan records (never extra actors, bodies or textures) so
  // backtracking does not repeat hundreds of habitat/road/terrain probes.
  private readonly sceneryPlans=new Map<string,{trees:SceneryTree[];details:SceneryDetail[]}>();
  private readonly sceneryPlanLimit=8;
  private retireTerrain(key:string,chunk:ChunkRuntime){
    if(chunk.shared)return;
    this.recentTerrain.delete(key);this.recentTerrain.set(key,chunk.textureKey);
    while(this.recentTerrain.size>this.recentTerrainLimit){
      const oldest=this.recentTerrain.entries().next().value as [string,string]|undefined;
      if(!oldest)break;
      this.recentTerrain.delete(oldest[0]);this.scene.textures.remove(oldest[1]);
    }
  }
  private lastCenter = '';
  private lastTravelViewKey='';
  private lastOpenSeaStatus:boolean|null=null;
  private readonly baker: TerrainBaker;
  // LEIGHNERON_STAGGER_CHUNKS_V1: don't bake three huge neighbor chunks in one frame.
  private readonly pendingChunks = new Map<string,{x:number;y:number}>();
  private lastChunkBakedAt=-Infinity;
  private preparing:{key:string;steps:Generator<void,void>}|null=null;
  private preparedFrame=-1;
  private bootstrapped=false;
  private visibleChunks=new Set<string>();
  // Shared terrain art provides a temporary ground plane while the expensive
  // authored chunk texture and its collision scenery finish across frames.
  private readonly fallbacks=new Map<string,Phaser.GameObjects.TileSprite>();
  private readonly retiring=new Map<string,number>();
  private readonly mobileTerrain=/(Android|iPhone|iPad|iPod)/i.test(navigator.userAgent);
  private readonly maxRetirePerFrame=1;

  constructor(scene: Phaser.Scene, world: WorldGenerator,
    private readonly treeSway:TreeSwaySystem,private readonly lighting:DayNightSystem,private readonly ground:WorldSpriteSystem) {
    this.scene = scene;
    this.world = world;
    this.baker = new TerrainBaker(scene);
  }

  update(worldX: number, worldY: number,viewportOnly=false) {
    if(viewportOnly){
      const camera=this.scene.cameras.main;
      this.updateView(projectedGroundView(camera,worldX,worldY));return;
    }
    const centerX = Math.floor(worldX / CHUNK_SIZE);
    const centerY = Math.floor(worldY / CHUNK_SIZE);
    const camera=this.scene.cameras.main;
    const groundView=projectedGroundView(camera,worldX,worldY,128);
    // Screen and player are still within exactly the same streamed cells:
    // avoid constructing two sets of chunk keys on every animation frame.
    const viewKey=centerX+':'+centerY+':'
      +Math.floor(groundView.left/CHUNK_SIZE)+':'+Math.floor(groundView.right/CHUNK_SIZE)+':'
      +Math.floor(groundView.top/CHUNK_SIZE)+':'+Math.floor(groundView.bottom/CHUNK_SIZE)+':'
      +Math.floor((groundView.left-384)/CHUNK_SIZE)+':'+Math.floor((groundView.right+384)/CHUNK_SIZE)+':'
      +Math.floor((groundView.top-384)/CHUNK_SIZE)+':'+Math.floor((groundView.bottom+384)/CHUNK_SIZE);
    if(viewKey===this.lastTravelViewKey){this.retireExpired();this.loadPendingChunk();return;}
    this.lastTravelViewKey=viewKey;
    const visible=viewportChunks(groundView);
    this.visibleChunks=visible;
    const wanted=chunkNeighborhood(worldX,worldY);
    // A bounded 384px viewport margin prepares zoomed-out travel before a
    // chunk becomes safety-critical. Normal 3x3 walking residency is retained.
    for(const key of viewportChunks(groundView,384))wanted.add(key);
    const centerKey = `${centerX}:${centerY}:`+streamViewKey(wanted)+':'+streamViewKey(visible);
    if (centerKey === this.lastCenter) { this.retireExpired();this.loadPendingChunk(); return; }
    this.lastCenter = centerKey;

    // Do not tear down a whole village merely because its edge moved
    // out of view during a camera turn. Keep a short re-entry grace period;
    // destroy at most one expired chunk per frame to avoid a disposal spike.
    this.markRetiring(wanted);
    this.retireExpired();
    for (const key of [...this.pendingChunks.keys()]) if(!wanted.has(key))this.pendingChunks.delete(key);
    if(this.preparing&&!wanted.has(this.preparing.key))this.cancelPreparation();
    // Only the initial player's cell is permitted one blocking load, before
    // gameplay streaming starts. Camera turns, teleports and zooms never run
    // load() for the newly visible cells on the gameplay thread.
    if(!this.bootstrapped){
      this.bootstrapped=true;
      const key=`${centerX}:${centerY}`;
      if(wanted.has(key)&&!this.active.has(key))this.load(centerX,centerY);
    }
    for(const key of wanted)if(!this.active.has(key)&&!this.pendingChunks.has(key)){
      const [x,y]=key.split(':').map(Number);this.pendingChunks.set(key,{x,y});
    }
    this.prioritizePending(worldX,worldY);
    this.syncFallbacks(visible);
    this.loadPendingChunk();
    this.updateOpenSeaStatus();
  }

  /** Hidden cuts bake one texture per frame in visibility order; normal travel
   * keeps the existing staggered budget for offscreen margin chunks. */
  updateView(view:StreamView,staged=false):boolean {
    // Covers complete mature trees beyond the edge, not just their ground anchors.
    const wanted=viewportChunks(view,768),visible=viewportChunks(view);
    this.visibleChunks=visible;
    this.bootstrapped=true;
    this.lastCenter='view:'+streamViewKey(wanted);
    this.lastTravelViewKey=''; // Explicit transition views supersede walking cache.
    this.markRetiring(wanted);
    this.retireExpired();
    for(const key of this.pendingChunks.keys())if(!wanted.has(key))this.pendingChunks.delete(key);
    if(this.preparing&&!wanted.has(this.preparing.key))this.cancelPreparation();
    const ordered=[...wanted].sort((a,b)=>Number(visible.has(b))-Number(visible.has(a)));
    const previousPending=new Map(this.pendingChunks);
    this.pendingChunks.clear();
    for(const key of ordered)if(!this.active.has(key)){
      const [x,y]=key.split(':').map(Number);
      this.pendingChunks.set(key,previousPending.get(key)??{x,y});
    }
    this.syncFallbacks(visible);
    this.loadPendingChunk(staged);this.updateOpenSeaStatus();
    // Margin chunks are speculative canopy coverage. They continue loading
    // after the shot is drawable, but must not hold the transition cover up.
    return [...visible].every(key=>this.active.has(key));
  }

  hasView(view:StreamView):boolean {
    return [...viewportChunks(view)].every(key=>this.active.has(key));
  }

  /** Sample rows and compose layers over frames; publish terrain, scenery and
   * collision together. Required visible loads can finish the same exact job. */
  private loadPendingChunk(staged=false){
    if(!this.pendingChunks.size)return;
    const now=this.scene.time.now;
    if(this.preparedFrame===this.scene.game.loop.frame)return;
    if(!this.preparing){
      if(!staged&&now-this.lastChunkBakedAt<16)return;
      // Stream what the camera can currently see before speculative margins.
      const next=[...this.pendingChunks].find(([key])=>this.visibleChunks.has(key))
        ??this.pendingChunks.entries().next().value as [string,{x:number;y:number}]|undefined;
      if(!next)return;
      const [key,point]=next;
      if(this.active.has(key)){this.pendingChunks.delete(key);return;}
      this.preparing={key,steps:this.loadSteps(point.x,point.y)};
    }
    this.preparedFrame=this.scene.game.loop.frame;
    const job=this.preparing;
    // Consume cheap yielded rows within a short budget instead of taking a
    // whole frame per row. Preloads finish before walking reaches their edge;
    // the cap still prevents draining a full bake during normal movement.
    const deadline=performance.now()+(this.scene.game.loop.delta>24?1.5:3);
    for(let steps=0;steps<128;steps++){
      if(job.steps.next().done){
        this.pendingChunks.delete(job.key);this.preparing=null;this.lastChunkBakedAt=now;
        this.removeFallback(job.key);break;
      }
      if(performance.now()>=deadline)break;
    }
    this.updateOpenSeaStatus();
  }
  private prioritizePending(x:number,y:number){
    const distance=(point:{x:number;y:number})=>
      Math.max(0,Math.abs((point.x+.5)*CHUNK_SIZE-x)-CHUNK_SIZE/2)**2
      +Math.max(0,Math.abs((point.y+.5)*CHUNK_SIZE-y)-CHUNK_SIZE/2)**2;
    const ordered=[...this.pendingChunks].sort((a,b)=>
      Number(this.visibleChunks.has(b[0]))-Number(this.visibleChunks.has(a[0]))||distance(a[1])-distance(b[1]));
    this.pendingChunks.clear();for(const [key,point] of ordered)this.pendingChunks.set(key,point);
  }
  private markRetiring(wanted:ReadonlySet<string>){
    const now=this.scene.time.now;
    for(const key of this.active.keys()){
      if(wanted.has(key))this.retiring.delete(key);
      else if(!this.retiring.has(key))this.retiring.set(key,now+900);
    }
  }
  private retireExpired(){
    const now=this.scene.time.now;let count=0;
    for(const [key,expires] of this.retiring){
      if(expires>now)continue;
      this.retiring.delete(key);
      const chunk=this.active.get(key);if(!chunk)continue;
      chunk.image.destroy();
      for(const actor of chunk.scenery)actor.destroy();
      this.retireTerrain(key,chunk);
      this.active.delete(key);
      if(++count>=this.maxRetirePerFrame)break;
    }
  }
  private cancelPreparation(){
    const job=this.preparing;this.preparing=null;job?.steps.return();
  }
  private removeFallback(key:string){
    this.fallbacks.get(key)?.destroy();
    this.fallbacks.delete(key);
  }
  private syncFallbacks(visible:ReadonlySet<string>){
    for(const key of this.fallbacks.keys())
      if(!visible.has(key)||this.active.has(key))this.removeFallback(key);
    for(const key of visible){
      if(this.active.has(key)||this.fallbacks.has(key))continue;
      const [x,y]=key.split(':').map(Number);
      // One atlas is reused by every placeholder: no full-resolution canvas,
      // scenery actor, texture upload or per-chunk shader compilation here.
      const cx=(x+.5)*CHUNK_SIZE,cy=(y+.5)*CHUNK_SIZE;
      const frame=Math.max(0,Math.min(7,this.world.getTerrainIndex(this.world.getTerrainAt(cx,cy))));
      const tile=this.scene.add.tileSprite(x*CHUNK_SIZE,y*CHUNK_SIZE,CHUNK_SIZE,CHUNK_SIZE,'terrain',frame)
        .setOrigin(0).setDepth(-1000).setName('streaming-ground-fallback');
      this.fallbacks.set(key,tile);
    }
  }

  private updateOpenSeaStatus(){
    if(this.pendingChunks.size!==0){
      if(this.lastOpenSeaStatus!==false){this.lastOpenSeaStatus=false;this.scene.registry.set('openSeaView',false);}
      return;
    }
    let openSea=true;
    for(const chunk of this.active.values())if(!chunk.shared){openSea=false;break;}
    if(this.lastOpenSeaStatus!==openSea){
      this.lastOpenSeaStatus=openSea;this.scene.registry.set('openSeaView',openSea);
    }
  }

  destroy() {
    this.cancelPreparation();
    for (const chunk of this.active.values()) {
      chunk.image.destroy();
      for (const image of chunk.scenery) image.destroy();
      if(!chunk.shared)this.scene.textures.remove(chunk.textureKey);
    }
    this.active.clear();
    for(const key of this.fallbacks.keys())this.removeFallback(key);
    this.visibleChunks.clear();this.bootstrapped=false;this.retiring.clear();
    this.pendingChunks.clear();
    for(const textureKey of this.recentTerrain.values())this.scene.textures.remove(textureKey);
    this.recentTerrain.clear();this.sceneryPlans.clear();
    this.lastCenter = '';
    this.lastTravelViewKey='';this.lastOpenSeaStatus=null;
    this.baker.destroy();
    this.scene.textures.remove('shared-ocean-chunk');
  }

  getActiveKeys() { return [...this.active.keys()]; }

  private load(chunkX: number, chunkY: number) {
    const key=`${chunkX}:${chunkY}`;
    const current=this.preparing;
    // Shared TerrainBaker scratch buffers must never be interleaved.
    if(current?.key!==key)this.cancelPreparation();
    const steps=current?.key===key?current.steps:this.loadSteps(chunkX,chunkY);
    try{while(!steps.next().done){ /* Complete required view without holes. */ }}
    finally{this.preparing=null;this.pendingChunks.delete(key);}
  }
  private *loadSteps(chunkX:number,chunkY:number):Generator<void,void>{
    // Fully open sea shares a single texture. Voyages no longer allocate and
    // repaint nine identical 1536-square ocean canvases at every chunk change.
    const ocean=Array.from({length:25},(_,i)=>({x:(chunkX+i%5/4)*CHUNK_SIZE,y:(chunkY+Math.floor(i/5)/4)*CHUNK_SIZE}))
      .every(p=>this.world.getRegionAt(p.x,p.y)==='dead-sea');
    if(ocean){
      const key='shared-ocean-chunk';if(!this.scene.textures.exists(key)){
        const pixels=this.mobileTerrain?1024:CHUNK_SIZE;
        const texture=this.scene.textures.createCanvas(key,pixels,pixels)!;
        const ctx=texture.getContext();
        ctx.setTransform(pixels/CHUNK_SIZE,0,0,pixels/CHUNK_SIZE,0,0);
        this.baker.drawOcean(ctx);texture.refresh();
      }
      const image=this.scene.add.image(chunkX*CHUNK_SIZE,chunkY*CHUNK_SIZE,key)
        .setOrigin(0).setDisplaySize(CHUNK_SIZE,CHUNK_SIZE).setDepth(-1000);
      this.active.set(chunkX+':'+chunkY,{image,textureKey:key,shared:true,scenery:[]});return;
    }
    const textureKey = `chunk:${chunkX}:${chunkY}`;
    const cacheKey=`${chunkX}:${chunkY}`;
    const cached=this.recentTerrain.delete(cacheKey);
    // Mobile GPU upload pressure: one 1536x1536 RGBA chunk costs 9 MiB.
    // Normal mobile quality paints into 1024px (~4 MiB); low uses 768px
    // (~2.25 MiB), with identical logical world size and collision locations.
    const pixels=this.mobileTerrain?(getEffectsQuality()==='low'?768:1024):CHUNK_SIZE;
    const canvasTexture = cached
      ? this.scene.textures.get(textureKey) as Phaser.Textures.CanvasTexture
      : this.scene.textures.createCanvas(textureKey,pixels,pixels);
    if (!canvasTexture) return;
    let committed=false;
    const scenery: Array<Phaser.GameObjects.Image|Phaser.GameObjects.Sprite> = [];
    const canopies:Phaser.GameObjects.Image[]=[];
    try{
    if(!cached){
      const ctx = canvasTexture.getContext();
      const ratio=canvasTexture.width/CHUNK_SIZE;
      ctx.setTransform(ratio,0,0,ratio,0,0);
      yield* this.baker.drawSteps(ctx, this.world, chunkX, chunkY);
    }
    // The same exact authored reservations and deterministic seed yield the
    // same trees/details each visit. Cache *descriptors*, never GPU artwork.
    let plan=this.sceneryPlans.get(cacheKey);
    if(plan){this.sceneryPlans.delete(cacheKey);this.sceneryPlans.set(cacheKey,plan);}
    else{
      const cx=(chunkX+.5)*CHUNK_SIZE,cy=(chunkY+.5)*CHUNK_SIZE;
      const sites=authoredReservations.query({left:cx-CHUNK_SIZE,right:cx+CHUNK_SIZE,top:cy-CHUNK_SIZE,bottom:cy+CHUNK_SIZE})
        .map(item=>item.definition).filter(d=>Math.abs(d.world.x-cx)<CHUNK_SIZE&&Math.abs(d.world.y-cy)<CHUNK_SIZE);
      const reservations=sites.map(d=>{
        const arena=bossArenaBounds(d);
        return {...d.world,...('frame' in d?{bounds:spriteBounds(d.texture??'world_objects',d.frame,d.scale??1,d.world.x,d.world.y)}:{}),
          ...(arena?{bounds:arena}:{})};
      });
      const nearbyLandmarks=yield* planLandmarkScenerySteps(chunkX,chunkY,this.world,true);
      const landmarkDetails=nearbyLandmarks.filter(d=>Math.floor(d.x/CHUNK_SIZE)===chunkX&&Math.floor(d.y/CHUNK_SIZE)===chunkY);
      const landmarks=nearbyLandmarks.map(d=>({...d,bounds:spriteBounds(d.texture,d.frame,d.scale,d.x,d.y)}));
      yield;
      const trees=yield* planWildernessTreeSteps(chunkX,chunkY,this.world,[...reservations,...landmarks]);
      const treeReservations=trees.map(t=>({...t,bounds:spriteBounds(t.texture,t.frame,t.scale,t.x,t.y)}));
      const wildernessDetails=yield* planWildernessDetailSteps(chunkX,chunkY,this.world,[...reservations,...landmarks,...treeReservations]);
      const details=[...landmarkDetails,...wildernessDetails];
      plan={trees,details};this.sceneryPlans.set(cacheKey,plan);
      while(this.sceneryPlans.size>this.sceneryPlanLimit)this.sceneryPlans.delete(this.sceneryPlans.keys().next().value!);
    }
    // Upload separately from actor/collider creation, then expose both at once.
    if(!cached)canvasTexture.refresh();
    canvasTexture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    yield;
    // Full-detail sprites and collisions are still created from the exact
    // original plan; only the expensive placement *calculation* is reused.
    const trees=plan.trees;
    for (const tree of trees) {
      const { x:wx,y:wy,texture,frame,scale } = tree;
      const image=this.scene.add.image(wx,wy,texture,frame).setOrigin(.5,1)
        .setScale(artScale(texture)*scale).setDepth(wy).setName(tree.id).setVisible(false);
      scenery.push(image);this.ground.register(image,texture,frame,scale,true,undefined,false,true);
      const leaves=this.treeSway.register(image,texture,frame);if(leaves)canopies.push(leaves);
      yield;
    }
    for(const detail of plan.details){
      const sprite=this.scene.add.sprite(detail.x,detail.y,detail.texture,detail.frame).setOrigin(.5,1)
        .setScale(artScale(detail.texture)*detail.scale).setDepth(detail.y).setName(detail.id).setVisible(false);
      scenery.push(sprite);
      this.ground.register(sprite,detail.texture,detail.frame,detail.scale,detail.solid,detail.footprint,false,true);
      this.lighting.register(sprite,detail.texture,detail.frame,detail.scale);
      yield;
    }
    // Enabling static bodies, habitat listeners and optional ground blending
    // is not cheap. Stage publication work before exposing the whole chunk.
    for(const actor of scenery){this.ground.activate(actor);yield;}
    for(const actor of scenery)actor.setVisible(true);
    for(const leaves of canopies)leaves.setVisible(true);
    const image = this.scene.add.image(chunkX * CHUNK_SIZE, chunkY * CHUNK_SIZE, textureKey)
      .setOrigin(0,0).setDisplaySize(CHUNK_SIZE,CHUNK_SIZE).setDepth(-1000);
    this.active.set(`${chunkX}:${chunkY}`, { image, textureKey, scenery });
    committed=true;
    }finally{
      if(!committed){
        for(const image of scenery)image.destroy();
        this.scene.textures.remove(textureKey);
      }
    }
  }
}
