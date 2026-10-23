import Phaser from 'phaser';
import {onPlane,onGround,onFurniture,PRESENTATION_HINT,groundForeshortening,projectedGroundHalfExtents,type PresentationHint} from '../presentation25d/plane';
import {housingFor,HOME_FLOORS,HOME_ENTRANCE,FURNITURE_BY_ART,furnitureFootprint,homeWeaponMount,type HomeItem} from '../../data/housing';
import {isPlayerHome,PLAYER_HOME_BY_ID} from '../../data/playerHomes';
import housingArt from '../../data/housingArt.json';
import {SWORD_TEXTURE} from './EquippedSwordVisual';
import {losslessImagePath} from '../../utils/losslessImagePath';
import {INTERIOR_ENTRIES,INTERIOR_RESIDENTS_BY_ENTRY,roomPlan,roomFloorContains,type InteriorEntry,type RoomPlan,type RoomRect} from '../../data/interiors';
import {NPC_BY_ID} from '../../data/npcs';
import {useGameStore} from '../../store/gameStore';
import type {Vec2,NavigationMarker,QuestTarget} from '../types';
import type {WorldScene} from '../scenes/WorldScene';
import {Npc} from '../entities/Npc';
import type {Enemy} from '../entities/Enemy';
import {spriteSubjectCanvas} from './spriteArt';
import {actorSpriteGridSubjects} from './spriteComponents';
import {INTERIOR_ART,INTERIOR_FLOORS,interiorFloorIndex,type InteriorArtKey} from '../../data/interiorArt';
import {resolveQuestTarget,questBearing,activeObjective} from './questNavigation';
import {INN_REST_COST,innRestAvailable} from '../../data/innRest';
import {MAP_BLACKSMITHS} from '../../data/mapServices';
import {CAVE_ART_PATH,CAVE_ART_FRAMES,CAVE_FLOOR} from '../../data/caveArt';
import {TOWER_ENTRY_ID,towerKnown,towerCampaignComplete,towerEntryFloor,TOWER_CHAMBERS,TOWER_DOOR_ART,TOWER_NORTH_DOOR} from '../../data/towerOfMight';
import {registerCameraObstacle} from '../presentation25d/CameraObstacles';
import {TOWER_ROOM_ART,TOWER_ROOM_SIZE,TOWER_ROOM_ART_EXTENT,TOWER_SOUTH_DOOR} from '../../data/towerRoom';

const DEPTH=10_000_000;
const SOURCE='interior-source',ATLAS='interior-furniture';
const TOWER_CHEST_SOURCE='tower-chest-source';
const TOWER_DOOR_SOURCE='tower-door-source';
const FLOORS=['interior-floor','interior-floor-secondary'] as const;
const HOME_ATLASES=[0,1,2].map(i=>'home-furniture:'+i);

/** A bounded room overlay in the existing scene. Outdoor physics/streaming
 * freeze; only the local player's swept feet advance, so hidden world actors
 * cannot fight, move or collide with room furniture. Saves use safePosition. */
export class InteriorSession {
  private entry:InteriorEntry|null=null;
  private plan:RoomPlan|null=null;
  private origin:Vec2={x:0,y:0};
  private outside:Vec2|null=null;
  private loading=false;
  private disposed=false;
  private objects:Phaser.GameObjects.GameObject[]=[];
  private residents:Npc[]=[];
  private readonly innBeds:Vec2[]=[];
  private readonly innBedMarkers:NavigationMarker[]=[];
  private nearInnBed=false;
  private nearHomeBed=false;
  private nextBedHintAt=0;
  private hidden:Array<{object:Phaser.GameObjects.GameObject;visible:boolean;filter:number}>=[];
  private formerBounds:Phaser.Geom.Rectangle|null=null;
  private syncMs=0;
  private guide:Phaser.GameObjects.Graphics|null=null;
  private guideMarker:Phaser.GameObjects.Graphics|null=null;
  private guideTarget:QuestTarget|null=null;
  private navigationMs=150;
  private wallSolids:RoomRect[]=[];
  private floorMask:Phaser.Display.Masks.GeometryMask|null=null;
  private mapFloors:RoomRect[]=[];
  private mapCircle:{x:number;y:number;radius:number}|undefined;
  private backdrop:Phaser.GameObjects.Rectangle|null=null;
  private cinematicContext:{entry:InteriorEntry|null;outside:Vec2|null;position:Vec2;depth:number;dungeonId:string|null;
    filters:Array<{object:Phaser.GameObjects.GameObject;filter:number}>}|null=null;
  private settleLoad:((ready:boolean)=>void)|null=null;
  private loadingPromise:Promise<boolean>|null=null;
  private loadEpoch=0;
  private loadAbort:AbortController|null=null;
  private loadTimeout:number|undefined;
  private artworkFrame:number|undefined;
  private resumeArtwork:(()=>void)|null=null;
  private readonly combatPaths=new WeakMap<Enemy,{key:string;until:number;point:Vec2}>();
  private homeObjects:Phaser.GameObjects.GameObject[]=[];
  private homeItems:HomeItem[]|null=null;
  constructor(private readonly scene:WorldScene){}
  get active(){return this.loading||this.entry!==null;}
  get ready(){return this.entry!==null&&!this.loading;}
  playerRenderDepth(y:number){return this.ready?DEPTH+y-this.origin.y:y;}
  get safePosition(){return this.cinematicContext?(this.cinematicContext.outside??this.cinematicContext.position):this.outside;}
  get currentEntry(){return this.entry;}
  localPoint(point:Vec2){return {x:this.origin.x+point.x,y:this.origin.y+point.y};}
  get viewCenter(){return this.plan?{x:this.origin.x+this.plan.entrance.x,y:this.origin.y+this.plan.entrance.y}:this.scene.player;}
  getActor(npcId:string){return this.getResidents().find(n=>n.definition.id===npcId);}
  getResidents(){
    const companion=this.scene.interiorCompanionActor;
    return companion&&!this.residents.includes(companion)?[...this.residents,companion]:this.residents;
  }

  beginCinematic(){
    if(this.cinematicContext)return;
    this.cinematicContext={entry:this.entry,outside:this.outside?{...this.outside}:null,dungeonId:useGameStore.getState().activeDungeonId,
      position:{x:this.scene.player.x,y:this.scene.player.y},depth:this.scene.player.depth,
      filters:this.scene.children.list.filter(o=>o===this.scene.player||o.name==='equipped-sword'||o.name==='equipped-sword-hand')
        .map(object=>({object,filter:object.cameraFilter}))};
  }
  async showCinematicLocation(entry:InteriorEntry|null){
    if(this.disposed)return false;
    this.beginCinematic();
    if(this.loadingPromise)await this.loadingPromise;
    if(this.disposed)return false;
    if(this.entry?.id===entry?.id)return true;
    this.closeRoom();
    const context=this.cinematicContext!,original=entry?.id===context.entry?.id;
    for(const saved of context.filters)if(saved.object.scene)saved.object.cameraFilter=saved.filter;
    if(!entry){
      if(context.entry)for(const saved of context.filters)this.scene.cameras.main.ignore(saved.object);
      this.scene.player.setDepth(context.depth);return true;
    }
    this.outside=original?context.outside:{...entry.door};
    return this.loadEntry(entry,original?context.outside!:entry.door,!original);
  }
  async restoreCinematicLocation(){
    const context=this.cinematicContext;if(!context)return true;
    const ready=await this.showCinematicLocation(context.entry);
    if(this.disposed)return false;
    this.cinematicContext=null;
    for(const saved of context.filters)if(saved.object.scene)saved.object.cameraFilter=saved.filter;
    this.outside=context.outside;this.scene.player.setDepth(context.depth);
    if(ready&&context.entry?.profile==='cave'&&useGameStore.getState().activeDungeonId!==(context.dungeonId??context.entry.id.slice(5)))
      this.scene.beginDungeon(context.dungeonId?'cave:'+context.dungeonId:context.entry.id);
    if(!ready){
      this.closeRoom();this.outside=null;
      this.scene.restoreOutsidePosition(context.outside??context.position);
      this.scene.notify('The room could not reload. You have been returned safely outside.');
    }
    this.scene.player.resetInput();return ready;
  }
  recoverCinematicLocation(){
    const context=this.cinematicContext;if(!context)return;
    this.cancelLoad();
    this.closeRoom();this.loading=false;this.cinematicContext=null;this.outside=null;
    for(const saved of context.filters)if(saved.object.scene)saved.object.cameraFilter=saved.filter;
    this.scene.restoreOutsidePosition(context.outside??context.position);this.scene.player.resetInput();
    this.scene.notify('The room could not reload. You have been returned safely outside.');
  }
  constrainCamera(x:number,y:number,zoom:number){
    if(!this.plan)return {x,y,zoom};
    const camera=this.scene.cameras.main,b=camera.getBounds();
    const liveHalf=projectedGroundHalfExtents(camera);
    const half=groundForeshortening(this.scene)===1?{x:camera.width/2,y:camera.height/2}
      :{x:liveHalf.x*camera.zoom,y:liveHalf.y*camera.zoom};
    zoom=Math.max(zoom,half.x*2/b.width,half.y*2/b.height);
    const hw=half.x/zoom,hh=half.y/zoom;
    return {x:Phaser.Math.Clamp(x,b.left+hw,b.right-hw),y:Phaser.Math.Clamp(y,b.top+hh,b.bottom-hh),zoom};
  }
  presentCinematic(x:number,y:number,paused=false,delta=0){
    this.fitBackdrop();
    for(const npc of this.getResidents()){
      if(npc.storyMoving&&!paused){npc.updatePatrol(this.scene.time.now,delta);npc.advanceCinematic(delta);}
      npc.updatePresentation(x,y,false,paused,true);npc.setDepth(DEPTH+npc.y-this.origin.y);npc.setInteriorLabelDepth(DEPTH-this.origin.y);
    }
  }

  nearest(x:number,y:number){
    let nearest:InteriorEntry|undefined,distance=95;
    for(const entries of [INTERIOR_ENTRIES,this.scene.dungeonEntries])for(const entry of entries){
      const d=Math.hypot(entry.door.x-x,entry.door.y-y);
      if(d<distance&&this.scene.interiorDoorClear(entry.door.x,entry.door.y)
        &&this.scene.hasClearPath(x,y,entry.door.x,entry.door.y)){nearest=entry;distance=d;}
    }
    return nearest;
  }
  enter(entry:InteriorEntry){
    if(this.active||this.disposed)return;
    if(entry.id===TOWER_ENTRY_ID){
      useGameStore.getState().refreshTowerWeek();
      const state=useGameStore.getState();
      if(!towerCampaignComplete(state.quests)){
        this.scene.notify('Finish The Roads We Keep before investigating the Tower of Might.');return;
      }
      if(!towerKnown(state.quests,state.storyFlags)){
        this.scene.notify('Ask Etheldreda Bell at Oakmere shrine about the tower before entering.');return;
      }
      const floor=towerEntryFloor(state.dungeons),trial=floor.tower!;
      if(!state.defeatedBosses.includes(trial.bossId)){
        this.scene.notify(`Chamber ${trial.chamber} remains sealed. Defeat ${TOWER_CHAMBERS[trial.chamber-1].name} in the world before returning.`);return;
      }
    }
    for(const enemy of this.scene.enemySteeringActors())if(enemy.active&&enemy.hp>0
      &&Math.hypot(enemy.x-this.scene.player.x,enemy.y-this.scene.player.y)<500){
      this.scene.notify('Leave combat before entering a building.');return;
    }
    if(isPlayerHome(entry.id)&&!housingFor(useGameStore.getState().housing,entry.id).owned){
      const property=PLAYER_HOME_BY_ID[entry.id]!;
      this.scene.notify(`Home for sale · 7,500G. Speak with ${property.agentName} at ${property.agentLocation}.`);this.scene.player.resetInput();return;
    }
    this.outside={x:this.scene.player.x,y:this.scene.player.y};
    if(entry.profile==='cave')this.scene.prepareStoryArena();
    this.scene.player.resetInput();this.scene.targeting.clear();this.scene.physics.world.pause();
    this.scene.notify(`Entering ${entry.name}…`);void this.loadEntry(entry,this.outside,false);
  }
  private loadEntry(entry:InteriorEntry,anchor:Vec2,cinematic:boolean):Promise<boolean>{
    this.cancelLoad();
    const epoch=this.loadEpoch,abort=new AbortController();this.loadAbort=abort;
    this.loading=true;
    const promise=new Promise<boolean>(resolve=>{
    let settled=false;
    const alive=()=>!settled&&!this.disposed&&epoch===this.loadEpoch;
    const settle=(ready:boolean)=>{
      if(settled)return;settled=true;
      abort.abort();if(this.loadAbort===abort)this.loadAbort=null;
      window.clearTimeout(this.loadTimeout);this.loadTimeout=undefined;
      this.finishArtworkFrame();this.settleLoad=null;resolve(ready);
    };
    this.settleLoad=settle;
    const fail=(message:string)=>{
      if(!alive())return;
      this.closeRoom();this.loading=false;this.releaseArt();
      if(!this.cinematicContext){
        this.outside=null;this.scene.restoreOutsidePosition(anchor);this.scene.player.resetInput();
        this.scene.cameras.main.centerOn(anchor.x,anchor.y);this.scene.resumeAfterCinematic();
      }
      this.scene.notify(message);settle(false);
    };
    const prepare=async()=>{
      let steps:Generator<void,void>|undefined;
      try{
        // Let the entering message paint before any connected-component work.
        await this.nextArtworkFrame();if(!alive())return;
        if(!this.scene.textures.exists(SOURCE))throw new Error('Interior kit unavailable');
        if(entry.id===TOWER_ENTRY_ID)this.prepareTowerArt();
        else if(entry.profile==='cave')this.prepareCaveArt();
        else{
          steps=this.prepareArt();
          while(alive()&&!steps.next().done){await this.nextArtworkFrame();}
          if(!alive())return;
        }
        if(isPlayerHome(entry.id))for(const [id,frame] of Object.entries(housingArt.frames)){
          const texture=this.scene.textures.get(HOME_ATLASES[frame.atlas]);
          if(!texture.has(id))texture.add(id,0,frame.x,frame.y,frame.width,frame.height)!.customData={visibleWidth:frame.visibleWidth,visibleHeight:frame.visibleHeight,furnitureBottom:186};
        }
        if(!alive())return;
        this.open(entry,anchor,cinematic);settle(true);
      }catch(error){fail(`Could not enter: ${error instanceof Error?error.message:String(error)}`);}
      finally{steps?.return();}
    };
    // Room loading owns at most two decodes. Optional audio/enemy files in
    // the scene loader cannot hold the doorway up or collide with retry keys.
    const files:Array<{key:string;path:string}>=[{key:SOURCE,
      path:entry.id===TOWER_ENTRY_ID?TOWER_ROOM_ART:entry.profile==='cave'?CAVE_ART_PATH:`assets/interiors/${entry.kit}/kit.png`}];
    if(entry.id===TOWER_ENTRY_ID)files.push({key:TOWER_CHEST_SOURCE,path:CAVE_ART_PATH},{key:TOWER_DOOR_SOURCE,path:TOWER_DOOR_ART});
    if(isPlayerHome(entry.id))for(const [i,key] of HOME_ATLASES.entries())
      files.push({key,path:`assets/interiors/housing-furniture-${i}-v1.png`});
    const load=async()=>{
      let next=0;
      const worker=async()=>{
        while(alive()&&next<files.length){
          const file=files[next++];if(this.scene.textures.exists(file.key))continue;
          const image=await this.loadRoomImage(file.path,abort.signal);
          if(!alive())return;
          if(!this.scene.textures.addImage(file.key,image))throw new Error('Could not register room artwork');
        }
      };
      try{await Promise.all([worker(),worker()]);if(alive())await prepare();}
      catch(error){fail(`Interior art could not load: ${error instanceof Error?error.message:String(error)}`);}
    };
    // Covers fetch, decoding and preparation, including hidden-tab RAF waits.
    this.loadTimeout=window.setTimeout(()=>fail('The room took too long to load. Please try entering again.'),25000);
    void load();
    });
    this.loadingPromise=promise;
    void promise.then(()=>{if(this.loadingPromise===promise)this.loadingPromise=null;});
    return promise;
  }
  private *prepareArt():Generator<void,void>{
    const image=this.scene.textures.get(SOURCE).getSourceImage() as HTMLImageElement;
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image,0,0);
    const frameCount=Object.keys(INTERIOR_ART).length;
    const atlas=this.scene.textures.createCanvas(ATLAS,256*8,256*Math.ceil(frameCount/8))!;
    try{
    for(const [index,[art,[left,top,w,h]]] of Object.entries(INTERIOR_ART).entries()){
      const subject=actorSpriteGridSubjects(ctx.getImageData(left,top,w,h).data,w,h,1,1,{rejectEdgeFragments:true})[0];
      const pose=spriteSubjectCanvas(subject),fit=248/Math.max(pose.width,pose.height);
      const width=pose.width*fit,height=pose.height*fit;
      const x=(index%8)*256,y=Math.floor(index/8)*256;
      atlas.getContext().drawImage(pose,x+(256-width)/2,y+252-height,width,height);
      atlas.add(art,0,x,y,256,256)!.customData={visibleWidth:width,visibleHeight:height,furnitureBottom:252};
      pose.width=pose.height=1;
      yield;
    }
    atlas.refresh();
    // Inner floor only: excludes the illustrated source-square outline.
    for(const [index,[x,y,w,h]] of INTERIOR_FLOORS.entries()){
      const floor=this.scene.textures.createCanvas(FLOORS[index],176,176)!;
      floor.getContext().drawImage(image,x,y,w,h,0,0,176,176);floor.refresh();
    }
    this.scene.textures.remove(SOURCE);
    }finally{canvas.width=canvas.height=1;}
  }
  private prepareTowerArt(){
    // Keep the complete chamber painting as SOURCE until the room closes.
    // Only four live prop states are needed; no royal furniture or floor kit.
    const atlas=this.scene.textures.createCanvas(ATLAS,4*256,256)!;
    const source=this.scene.textures.get(TOWER_CHEST_SOURCE).getSourceImage() as HTMLImageElement;
    for(const [index,name] of (['chest','openChest'] as const).entries()){
      const [sx,sy,sw,sh]=CAVE_ART_FRAMES[name],fit=248/Math.max(sw,sh),width=sw*fit,height=sh*fit,x=index*256;
      atlas.getContext().drawImage(source,sx,sy,sw,sh,x+(256-width)/2,252-height,width,height);
      atlas.add(name,0,x,0,256,256)!.customData={visibleWidth:width,visibleHeight:height,furnitureBottom:252};
    }
    const doors=this.scene.textures.get(TOWER_DOOR_SOURCE).getSourceImage() as HTMLImageElement;
    const board=document.createElement('canvas');board.width=doors.width;board.height=doors.height;
    const ctx=board.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(doors,0,0);
    const poses=actorSpriteGridSubjects(ctx.getImageData(0,0,board.width,board.height).data,board.width,board.height,2,1,
      {keepDetachedDetails:true}).map(spriteSubjectCanvas);
    const fit=248/Math.max(...poses.map(p=>Math.max(p.width,p.height)));
    for(const [index,pose] of poses.entries()){
      const x=(index+2)*256,width=pose.width*fit,height=pose.height*fit;
      atlas.getContext().drawImage(pose,x+(256-width)/2,252-height,width,height);
      atlas.add(index?'tower-door-open':'tower-door-closed',0,x,0,256,256)!.customData={visibleWidth:width,visibleHeight:height,furnitureBottom:252};
    }
    board.width=board.height=1;atlas.refresh();
    this.scene.textures.remove(TOWER_CHEST_SOURCE);this.scene.textures.remove(TOWER_DOOR_SOURCE);
  }
  private prepareCaveArt(){
    const image=this.scene.textures.get(SOURCE).getSourceImage() as HTMLImageElement;
    const atlas=this.scene.textures.addImage(ATLAS,image)!;
    for(const [name,[x,y,width,height]] of Object.entries(CAVE_ART_FRAMES))
      atlas.add(name==='entrance'?'doorway':name,0,x,y,width,height)!.customData={visibleWidth:width,visibleHeight:height};
    for(const key of FLOORS){const floor=this.scene.textures.createCanvas(key,176,176)!;
      floor.getContext().drawImage(image,...CAVE_FLOOR,0,0,176,176);floor.refresh();}
    this.scene.textures.remove(SOURCE);
  }
  private own<T extends Phaser.GameObjects.GameObject>(object:T):T {this.objects.push(object);return object;}
  private artHeight(art:InteriorArtKey,width:number){
    const dimensions=this.scene.textures.getFrame(ATLAS,art).customData as {visibleWidth:number;visibleHeight:number};
    return width*dimensions.visibleHeight/dimensions.visibleWidth;
  }
  private drawArt(art:InteriorArtKey|'tower-door-closed',x:number,y:number,width:number,depth:number){
    const image=this.own(this.scene.add.image(this.origin.x+x,this.origin.y+y,ATLAS,art));
    if(art==='rug')onGround(image,.02);else onPlane(image,'upright');
    const dimensions=image.frame.customData as {visibleWidth:number;visibleHeight:number};
    image.setOrigin(.5,this.entry?.profile==='cave'&&this.entry.id!==TOWER_ENTRY_ID?1:252/256).setScale(width/dimensions.visibleWidth).setDepth(depth);
    if(art!=='rug'&&art!=='northWall'&&art!=='sideWall'){
      onFurniture(image,art,this.entry?.kit??'');
      if(this.entry?.profile!=='cave'&&art!=='doorway')this.addFurnitureContact(image);
    }
    return image;
  }
  private addFurnitureContact(image:Phaser.GameObjects.Image){
    const shape=(image.getData(PRESENTATION_HINT) as PresentationHint|undefined)?.furniture;
    if(!shape||shape.art==='arch'||shape.art==='window'||shape.art==='lantern')return;
    const width=Math.abs(image.displayWidth)*shape.width;
    const shadow=this.own(this.scene.addInteriorFurnitureContact(image,width,width*shape.depth));
    return shadow;
  }
  private renderWalls(){
    const plan=this.plan!,edges=new Map<string,{side:'north'|'west'|'east';axis:number;spans:Array<[number,number]>}>();
    const inside=(x:number,y:number)=>plan.floors.some(r=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height);
    // Exact rectangle-union edge intervals. No wall is laid across a corridor
    // opening, even at overlap joins or when rooms have different dimensions.
    for(const r of plan.floors)for(const side of ['north','west','east'] as const){
      const horizontal=side==='north',axis=horizontal?r.y:side==='west'?r.x:r.x+r.width;
      const from=horizontal?r.x:r.y,to=from+(horizontal?r.width:r.height);
      const breaks=[...new Set([from,to,...plan.floors.flatMap(f=>horizontal?[f.x,f.x+f.width]:[f.y,f.y+f.height])
        .filter(p=>p>from&&p<to)])].sort((a,b)=>a-b);
      const key=side+':'+axis,edge=edges.get(key)??{side,axis,spans:[] as Array<[number,number]>};
      for(let i=1;i<breaks.length;i++){
        const start=breaks[i-1],end=breaks[i],middle=(start+end)/2;
        const covered=horizontal?inside(middle,axis-.1):inside(axis+(side==='west'?-.1:.1),middle);
        if(!covered)edge.spans.push([start,end]);
      }
      edges.set(key,edge);
    }
    this.wallSolids=[];
    for(const {side,axis,spans} of edges.values()){
      spans.sort((a,b)=>a[0]-b[0]);const merged:Array<[number,number]>=[];
      for(const span of spans){const last=merged.at(-1);if(last&&span[0]<=last[1])last[1]=Math.max(last[1],span[1]);else merged.push([span[0],span[1]]);}
      for(const [start,end] of merged){
        const north=side==='north',length=end-start;
        const spatial=this.scene.game.registry.get('presentation')==='three-2.5d';
        const nominalWidth=140/this.artHeight('northWall',1);
        const count=Math.max(1,Math.ceil(length/(spatial?nominalWidth:north?180:120))),step=length/count;
        this.wallSolids.push(north?{x:start,y:axis,width:length,height:40}
          :{x:side==='west'?axis:axis-22,y:start,width:22,height:length});
        for(let i=0;i<count;i++){
          if(spatial){
            // Use the complete original plaster/timber panel on a vertical plane.
            // Side walls turn in world space, without stretching a narrow column.
            const x=north?start+(i+.5)*step:axis+(side==='west'?10:-10);
            const y=north?axis+38:start+(i+.5)*step;
            const image=this.drawArt('northWall',x,y,nominalWidth,DEPTH+y);
            const visiblePixels=(step+.5)/image.scaleX;
            image.setCrop((image.frame.realWidth-visiblePixels)/2,0,visiblePixels,image.frame.realHeight);
            image.setData('presentation25d',{plane:'upright',anchor:{x:image.x,y:image.y},wall:{axis:north?'x':'y',thickness:.06}});
            registerCameraObstacle(image);
            // Keep the source panel's uniform scale and complete vertical extent.
            image.setName('interior-wall:'+side);
          }
          else if(north)this.drawArt('northWall',start+(i+.5)*step,axis+38,step+1,DEPTH+axis+38);
          else if(!isPlayerHome(this.entry?.id)){
            // Homes retain the existing horizontal timber and exact collision
            // boundary, without repeated upright decorative side-wall strips.
            const x=axis+(side==='west'?10:-10),y=start+(i+1)*step;
            const ratio=this.artHeight('sideWall',1);
            this.drawArt('sideWall',x,y,step/ratio,DEPTH+y).setFlipX(side==='east');
          }
        }
      }
    }
  }
  private open(entry:InteriorEntry,anchor:Vec2,cinematic=false){
    const scene=this.scene,plan:RoomPlan=isPlayerHome(entry.id)&&housingFor(useGameStore.getState().housing,entry.id).owned?
      {floors:HOME_FLOORS.map(r=>({...r,material:0})),rooms:[{id:'living',label:'Living room',kind:'living',...HOME_FLOORS[0],material:0},
        {id:'bedroom',label:'Bedroom',kind:'bedroom',...HOME_FLOORS[1],material:0},
        {id:'kitchen',label:'Kitchen',kind:'kitchen',...HOME_FLOORS[2],material:0}],
        objects:[],entrance:HOME_ENTRANCE,residents:[]}:
      roomPlan(entry.hall,entry.name,entry.profile,entry.kit);this.entry=entry;this.plan=plan;this.loading=false;
    this.origin={x:anchor.x-plan.entrance.x,y:anchor.y-plan.entrance.y};
    this.mapFloors=plan.floors.map(r=>({x:this.origin.x+r.x,y:this.origin.y+r.y,width:r.width,height:r.height}));
    this.mapCircle=plan.roundFloor?{x:this.origin.x+plan.roundFloor.x,y:this.origin.y+plan.roundFloor.y,radius:plan.roundFloor.radius}:undefined;
    const camera=scene.cameras.main;
    for(const object of scene.children.list){
      if(object.name==='cinematic-transition-cover')continue;
      // The sword and hand are separate player-attached sprites, not outdoor scenery.
      if(object===scene.player||('name' in object&&
        (object.name==='equipped-sword'||object.name==='equipped-sword-hand'))){
        if(!cinematic)continue;
      }
      if('visible' in object&&'cameraFilter' in object){
        const render=object as Phaser.GameObjects.GameObject&{visible:boolean;cameraFilter:number};
        this.hidden.push({object,visible:render.visible,filter:render.cameraFilter});camera.ignore(object);
      }
    }
    this.formerBounds=camera.useBounds?Phaser.Geom.Rectangle.Clone(camera.getBounds()):null;camera.removeBounds();
    const left=Math.min(...plan.floors.map(r=>r.x))-80,top=Math.min(...plan.floors.map(r=>r.y))-80;
    const right=Math.max(...plan.floors.map(r=>r.x+r.width))+80,bottom=Math.max(...plan.floors.map(r=>r.y+r.height))+80;
    camera.setBounds(this.origin.x+left,this.origin.y+top,right-left,bottom-top);
    this.backdrop=this.own(scene.add.rectangle(0,0,1,1,0x000000)
      .setOrigin(0).setScrollFactor(0).setDepth(DEPTH-1000).setName('interior-backdrop'));this.fitBackdrop();
    if(plan.roundFloor)this.own(scene.add.image(this.origin.x+TOWER_ROOM_SIZE/2,this.origin.y+TOWER_ROOM_SIZE/2,SOURCE)
      .setDisplaySize(TOWER_ROOM_ART_EXTENT,TOWER_ROOM_ART_EXTENT).setDepth(DEPTH-900).setName('tower-round-chamber').setData('presentation25d',{plane:'ground'}));
    else for(const floor of plan.floors)this.own(scene.add.tileSprite(this.origin.x+floor.x,this.origin.y+floor.y,
      floor.width,floor.height,FLOORS[interiorFloorIndex(entry.kit,floor.kind)]).setOrigin(0).setDepth(DEPTH-900));
    for(const object of plan.objects){
      const image=this.drawArt(object.art,object.x,object.y,object.width,
        object.art==='rug'?DEPTH-800:DEPTH+object.y);
      if(entry.profile==='inn'&&object.art==='bed'){
        // Stand at the foot of the bed, outside its solid furniture footprint.
        const point={x:this.origin.x+object.x,y:this.origin.y+object.y+42};
        this.innBeds.push(point);
        this.innBedMarkers.push({id:'inn-bed:'+this.innBedMarkers.length,kind:'landmark',service:'inn',
          label:`Guest bed · ${INN_REST_COST}G until morning`,...point});
        image.setInteractive({useHandCursor:true}).on('pointerdown',()=>{
          if(this.loading||this.cinematicContext)return;
          if(this.bedReachable(point))this.scene.restAtInn();
          else this.scene.notify('Walk to the foot of the bed to sleep.');
        });
      }
    }
    if(plan.roundFloor)this.wallSolids=[];else this.renderWalls();
    if(isPlayerHome(entry.id)&&housingFor(useGameStore.getState().housing,entry.id).owned){
      useGameStore.setState({housingContext:entry.id,housingEditing:false});this.refreshHomeFurniture();
    }
    // The open arch is a doorway, never the wardrobe/counter source. Its
    // transparent opening and the vestibule footprint share the same centre.
    const south=entry.id===TOWER_ENTRY_ID?TOWER_SOUTH_DOOR:{x:plan.entrance.x,y:plan.entrance.y+55};
    this.drawArt(entry.id===TOWER_ENTRY_ID?'tower-door-closed':'doorway',south.x,south.y,entry.id===TOWER_ENTRY_ID?110:190,DEPTH+south.y);
    if(entry.id===TOWER_ENTRY_ID)this.wallSolids.push({x:TOWER_NORTH_DOOR.x-55,y:130,width:110,height:TOWER_NORTH_DOOR.y-170});
    if(entry.id===TOWER_ENTRY_ID)this.wallSolids.push({x:south.x-65,y:south.y-120,width:130,height:150});
    else for(const dx of [-95,43])this.wallSolids.push({x:plan.entrance.x+dx,y:plan.entrance.y-50,width:52,height:105});
    for(const r of plan.rooms){
      this.own(scene.add.text(this.origin.x+r.x+r.width/2,this.origin.y+r.y+100,r.label,
        {fontFamily:'Georgia, serif',fontSize:'11px',color:'#bba67d',stroke:'#19140f',strokeThickness:2})
        .setResolution(2).setOrigin(.5).setDepth(DEPTH+3000).setAlpha(.7).setName('interior-room-title:'+r.id));
    }
    if(entry.profile!=='cave'&&scene.textures.exists('warm-light')){
      const maskShape=this.own(scene.make.graphics({x:0,y:0}));maskShape.setVisible(false);
      for(const r of plan.floors)maskShape.fillStyle(0xffffff).fillRect(this.origin.x+r.x,this.origin.y+r.y,r.width,r.height);
      this.floorMask=maskShape.createGeometryMask();
      for(const [index,r] of plan.rooms.entries()){
        const x=r.x+r.width/2,y=r.y+160;
        this.drawArt('lantern',r.x+65,r.y+100,40,DEPTH+r.y+100);
        const glow=this.own(scene.add.image(this.origin.x+x,this.origin.y+y,'warm-light')
          .setDisplaySize(290,220).setAlpha(.14).setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(DEPTH+2500).setMask(this.floorMask));
        scene.tweens.add({targets:glow,alpha:.22,duration:1600+index*97,yoyo:true,repeat:-1});
      }
    }
    for(const resident of INTERIOR_RESIDENTS_BY_ENTRY[entry.id]??[]){
      const definition=NPC_BY_ID[resident.npcId];if(!definition)continue;
      const royal=['elarion-king','lady-adria-vale'].includes(definition.id)&&plan.throneResident;
      const preferred=resident.guardSide&&plan.guardPosts?plan.guardPosts[resident.guardSide]
        :royal||plan.residents[Math.min(resident.slot,plan.residents.length-1)];
      const p=this.residentPosition(preferred);
      const world={x:this.origin.x+p.x,y:this.origin.y+p.y};
      const npc=new Npc(scene,{...definition,stationary:true},world.x,world.y,world);
      npc.storyRest();npc.setDepth(DEPTH+p.y);npc.setInteriorLabelDepth(DEPTH-this.origin.y);
      this.residents.push(npc);this.objects.push(npc);
      this.own(scene.addInteriorContact(npc));
      npc.on('pointerdown',()=>{if(this.reachableResident(npc))this.talk(npc);});
    }
    this.guide=this.own(scene.add.graphics().setDepth(DEPTH+3000));
    this.guideMarker=this.own(scene.add.graphics().setDepth(DEPTH+3000));
    if(!cinematic)this.own(scene.addInteriorContact(scene.player));
    scene.player.resetInput();scene.player.setDepth(scene.playerRenderDepth(scene.player.y));
    camera.centerOn(scene.player.x,scene.player.y);
    const story=useGameStore.getState(),visitFlag='visited:interior:'+entry.id;
    if(!this.cinematicContext&&!story.storyFlags[visitFlag])story.setStoryFlag(visitFlag);
    const objective=activeObjective(story.quests,story.trackedQuestId)?.objective;
    if(!this.cinematicContext&&objective?.type==='visit'&&objective.targetId===entry.id)story.progressQuest('visit',entry.id);
    if(!this.cinematicContext)this.scene.notify(`${entry.name} — use the south doorway to leave.${entry.profile==='inn'?` Guest beds: ${INN_REST_COST}G until 06:00.`:''}`);
    if(entry.profile==='cave'&&!cinematic)this.scene.beginDungeon(entry.id);
  }
  private residentPosition(preferred:Vec2):Vec2 {
    const plan=this.plan!;
    const clear=(p:Vec2)=>{
      const person={x:p.x-36,y:p.y-84,width:72,height:84};
      if(!plan.floors.some(r=>person.x>=r.x+40&&person.x+person.width<=r.x+r.width-40
        &&person.y>=r.y+40&&p.y<=r.y+r.height-40))return false;
      const touches=(a:RoomRect,b:RoomRect)=>a.x<b.x+b.width&&a.x+a.width>b.x
        &&a.y<b.y+b.height&&a.y+a.height>b.y;
      const feet={x:p.x-14,y:p.y-24,width:28,height:24};
      if(this.wallSolids.some(r=>touches(feet,r))||plan.objects.some(o=>o.solid&&touches(feet,o.solid)))return false;
      // Conservative complete furniture bounds: a resident must not start
      // beneath a foreground counter, bed, shelf or planter. Rugs/stairs are
      // floor artwork. Prefer the authored workplace before looking nearby.
      if(plan.objects.some(o=>o.art!=='rug'&&o.y>p.y
        &&touches(person,{x:o.x-o.width/2,y:o.y-this.artHeight(o.art,o.width),width:o.width,height:this.artHeight(o.art,o.width)})))return false;
      return this.residents.every(n=>Math.abs(n.x-this.origin.x-p.x)>=80
        ||Math.abs(n.y-this.origin.y-p.y)>=112);
    };
    const offsets:Array<[number,number]>=[[0,0]];
    for(const radius of [48,80,112,160,224,288])
      for(const [dx,dy] of [[-1,0],[1,0],[0,1],[0,-1],[-1,1],[1,1],[-1,-1],[1,-1]])offsets.push([dx*radius,dy*radius]);
    const position=offsets.map(([dx,dy])=>({x:preferred.x+dx,y:preferred.y+dy})).find(clear);
    if(!position)throw new Error('No clear interior workplace for resident');
    return position;
  }
  combatFeet(x:number,y:number,radius=12,ignoreResident?:Npc,ignoreResidents=false){
    if(!this.plan)return false;
    const local={x:x-this.origin.x,y:y-this.origin.y};
    // Full 24x24 foot footprint, including corners at floor/corridor joins.
    for(const dx of [-radius,0,radius])for(const dy of [-radius*2,-radius,0])
      if(!roomFloorContains(this.plan,local.x+dx,local.y+dy))return false;
    const feet={x:local.x-radius,y:local.y-radius*2,width:radius*2,height:radius*2};
    const overlaps=(r:RoomRect)=>feet.x<r.x+r.width&&feet.x+feet.width>r.x
      &&feet.y<r.y+r.height&&feet.y+feet.height>r.y;
    return !this.wallSolids.some(overlaps)&&!this.plan.objects.some(o=>o.solid&&overlaps(o.solid))
      &&(ignoreResidents||!this.getResidents().some(n=>n!==ignoreResident&&overlaps({x:n.x-this.origin.x-14,y:n.y-this.origin.y-24,width:28,height:24})));
  }
  playerFeet(x:number,y:number){
    // Player movement/skills are blocked by room geometry, never by transient
    // actor feet. Alice, residents and enemies remain visible/interactive and
    // damageable, but cannot trap the hero in a doorway or narrow cave.
    return this.combatFeet(x,y,12,undefined,true);
  }
  private validFeet(x:number,y:number){
    return this.playerFeet(x,y);
  }
  combatPath(a:Vec2,b:Vec2,radius=12){
    const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/6));
    for(let i=0;i<=steps;i++)if(!this.combatFeet(a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps,radius,undefined,true))return false;
    return true;
  }
  /** Alice follows the same static room paths, without actor-sized barriers.
   * Follow goals still keep her spaced from the hero. */
  companionPath(a:Vec2,b:Vec2,_companion:Npc){
    return this.combatPath(a,b);
  }
  navigationPoint(enemy:Enemy,target:Vec2):Vec2{
    if(this.combatPath(enemy,target))return target;
    const key=Math.floor(target.x/48)+':'+Math.floor(target.y/48),cached=this.combatPaths.get(enemy);
    if(cached&&cached.key===key&&cached.until>this.scene.time.now&&Math.hypot(enemy.x-cached.point.x,enemy.y-cached.point.y)>10)return cached.point;
    // Bounded local grid through static room geometry; no outdoor route
    // finder is used indoors and transient actors cannot invalidate a route.
    const nodes:Array<{point:Vec2;parent:number}>=[{point:{x:enemy.x,y:enemy.y},parent:-1}],seen=new Set<string>();
    let found=-1;
    for(let head=0;head<nodes.length&&head<1800;head++){
      const p=nodes[head].point;
      if(Math.hypot(p.x-target.x,p.y-target.y)<=70&&this.combatPath(p,target)){found=head;break;}
      for(const [dx,dy] of [[48,0],[-48,0],[0,48],[0,-48]]){
        const next={x:p.x+dx,y:p.y+dy},cell=Math.round((next.x-enemy.x)/48)+':'+Math.round((next.y-enemy.y)/48);
        if(seen.has(cell))continue;seen.add(cell);
        if(this.combatPath(p,next))nodes.push({point:next,parent:head});
      }
    }
    let point:Vec2={x:enemy.x,y:enemy.y};
    if(found>0){while(nodes[found].parent>0)found=nodes[found].parent;point=nodes[found].point;}
    this.combatPaths.set(enemy,{key,until:this.scene.time.now+350,point});return point;
  }
  advanceEnemy(enemy:Enemy,delta:number){
    const body=enemy.body as Phaser.Physics.Arcade.Body,velocity=body.velocity.clone(),dt=Math.min(delta,80)/1000;
    const dx=velocity.x*dt,dy=velocity.y*dt,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/6)),radius=enemy.definition.bodyRadius??11;
    const valid=(x:number,y:number)=>this.combatFeet(x,y,radius,undefined,true)
      &&!this.scene.getCombatEnemies().some(e=>e!==enemy&&e.hp>0&&Math.hypot(e.x-x,e.y-y)<radius+(e.definition.bodyRadius??11)+2);
    let x=enemy.x,y=enemy.y;
    for(let i=0;i<steps;i++){if(valid(x+dx/steps,y))x+=dx/steps;if(valid(x,y+dy/steps))y+=dy/steps;}
    body.reset(x,y);body.setVelocity(velocity.x,velocity.y);enemy.setDepth(this.playerRenderDepth(y));
  }
  clearPath(a:Vec2,b:Vec2,_skipResident?:Npc){
    if(!this.validFeet(b.x,b.y))return false;
    const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/6));
    // Actors are pass-through, but intervening furniture and walls remain
    // solid. Include the endpoint even for a sub-six-unit path.
    for(let i=1;i<steps;i++)if(!this.validFeet(a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps))return false;
    return true;
  }
  private reachableResident(npc:Npc){return Math.hypot(npc.x-this.scene.player.x,npc.y-this.scene.player.y)<90
    &&this.clearPath(this.scene.player,npc,npc);}
  private bedReachable(point:Vec2){
    const player=this.scene.player;
    return Math.hypot(point.x-player.x,point.y-player.y)<90&&this.clearPath(player,point);
  }
  private homeBedReachable(item:HomeItem){
    if(item.stored||item.art!=='bed')return false;
    const r=furnitureFootprint(item),p=this.scene.player;
    const x=Math.max(r.x,Math.min(r.x+r.width,p.x-this.origin.x)),y=Math.max(r.y,Math.min(r.y+r.height,p.y-this.origin.y));
    // Stand beside a real, reachable bed edge; never sleep through a wall or
    // another piece of furniture. Rotation uses the bed's actual footprint.
    return [{x,y:r.y-18},{x,y:r.y+r.height+18},{x:r.x-18,y},{x:r.x+r.width+18,y}]
      .some(point=>this.bedReachable(this.localPoint(point)));
  }
  homeBedInReach(){
    return isPlayerHome(this.entry?.id)&&housingFor(useGameStore.getState().housing,this.entry?.id).owned
      &&Boolean(this.homeItems?.some(item=>this.homeBedReachable(item)));
  }
  update(time:number,delta:number,blocked:boolean){
    this.scene.physics.world.pause();
    this.fitBackdrop();
    if(this.loading){this.scene.player.discardActions();return;}
    if(!this.entry||!this.plan)return;
    if(isPlayerHome(this.entry.id)){
      if(this.homeItems!==housingFor(useGameStore.getState().housing,this.entry.id).items)this.refreshHomeFurniture();
    }
    const player=this.scene.player,body=player.body as Phaser.Physics.Arcade.Body;
    this.scene.updateInteriorStoryCombat(time,delta,blocked);
    if(!this.entry||!this.plan)return; // A combat hit may have caused a respawn.
    if(blocked){this.guide?.setVisible(false);this.guideMarker?.setVisible(false);this.navigationMs=150;player.discardActions();body.setVelocity(0,0);return;}
    this.guide?.setVisible(true);
    this.guideMarker?.setVisible(true);
    const startingEntry=this.entry;
    player.updatePlayer(time,Math.min(delta,80));
    if(this.entry!==startingEntry)return; // Interact may have exited the room.
    const dx=body.velocity.x*Math.min(delta,80)/1000,dy=body.velocity.y*Math.min(delta,80)/1000;
    const velocity=body.velocity.clone(),steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/6));
    let x=player.x,y=player.y;
    for(let i=0;i<steps;i++){
      if(this.validFeet(x+dx/steps,y))x+=dx/steps;
      if(this.validFeet(x,y+dy/steps))y+=dy/steps;
    }
    body.reset(x,y);body.setVelocity(velocity.x,velocity.y);player.setDepth(this.scene.playerRenderDepth(y));
    for(const npc of this.getResidents()){
      if(npc.storyMoving){npc.updatePatrol(time,delta);npc.advanceCinematic(delta);}
      npc.setDepth(DEPTH+npc.y-this.origin.y);
    }
    const near=this.residents.find(n=>this.reachableResident(n));
    // Only the nearby prompt is sampled. Actually paying for a bed always
    // rechecks reachability at input time, without a per-frame furniture scan.
    if(time>=this.nextBedHintAt){
      this.nextBedHintAt=time+150;
      this.nearInnBed=this.innBeds.some(point=>this.bedReachable(point));
      this.nearHomeBed=this.homeBedInReach();
    }
    const nearBed=!near&&!this.scene.storyCombatActive&&this.nearInnBed;
    const nearHomeBed=!near&&!this.scene.storyCombatActive&&this.nearHomeBed;
    const exit=this.entry.id===TOWER_ENTRY_ID?TOWER_SOUTH_DOOR:this.plan.entrance,
      nearExit=Math.hypot(x-this.origin.x-exit.x,y-this.origin.y-exit.y)<(this.entry.id===TOWER_ENTRY_ID?130:80);
    this.navigationMs+=Math.min(delta,80);
    if(this.navigationMs>=150){
    this.navigationMs=0;
    const store=useGameStore.getState();
    let target=resolveQuestTarget(store.quests,store.worldContent,player,id=>{
      const npc=id.startsWith('npc:')?this.getActor(id.slice(4)):undefined;return npc;
    },store.trackedQuestId,this.entry.id,store.storyFlags);
    if(target&&!(target.type==='encounter'&&target.interiorId===this.entry.id)&&!this.getResidents().some(n=>target!.contentId==='npc:'+n.definition.id))target={...target,worldLocation:{x:target.x,y:target.y},
      x:this.origin.x+exit.x,y:this.origin.y+exit.y,contentId:'interior:exit:'+this.entry.id,
      label:`Leave ${this.entry.name} — ${target.label}`};
    else if(target)target={...target,worldLocation:{...this.entry.door}};
    this.guideTarget=target;
    store.setNavigation({heading:Math.atan2(player.lastDirection.x,-player.lastDirection.y),target,
      playerPosition:{x,y},interiorName:this.entry.name,interiorFloors:this.mapFloors,interiorCircle:this.mapCircle,
      markers:[...this.getResidents().map(n=>({id:'npc:'+n.definition.id,kind:'npc' as const,label:n.definition.name,x:n.x,y:n.y,
        ...(MAP_BLACKSMITHS.has(n.definition.id)?{service:'blacksmith' as const}:{})})),
        ...this.innBedMarkers,...this.scene.dungeonMarkers,
        ...this.scene.getCombatEnemies().filter(e=>e.active&&e.hp>0).map(e=>({id:e.instanceId,kind:'enemy' as const,label:e.definition.name,x:e.x,y:e.y}))],
      interaction:this.entry.id===TOWER_ENTRY_ID&&nearExit?'Entry door sealed — clear the floor and use the central portal':this.scene.storyCombatActive?(nearExit?'Leave building':this.scene.storyInteraction):near?`Talk to ${near.definition.name}`:nearExit?'Leave building':this.scene.storyInteraction??
        (nearHomeBed?(innRestAvailable(this.scene.getWorldHour()*60)?'Sleep in your bed until 06:00':'Home bed — available from 18:00'):nearBed?(innRestAvailable(this.scene.getWorldHour()*60)?`Sleep until 06:00 — ${INN_REST_COST}G`:'Guest bed — available from 18:00'):
        this.scene.companionActor&&Math.hypot(this.scene.companionActor.x-x,this.scene.companionActor.y-y)<180?'Talk to Alice Fen':null)});
    }
    for(const npc of this.getResidents()){
      npc.updatePresentation(x,y,this.guideTarget?.contentId==='npc:'+npc.definition.id);
      npc.setInteriorLabelDepth(DEPTH-this.origin.y);
    }
    this.guide?.clear();this.guideMarker?.clear();
    if(this.guideTarget&&this.guide&&this.guideMarker){
      const target=this.guideTarget,angle=questBearing(player,target),dx=Math.sin(angle),dy=-Math.cos(angle),gx=dx*48,gy=dy*48;
      this.guide.setPosition(x,y);
      if(Math.hypot(target.x-x,target.y-y)>10)this.guide.fillStyle(0xffd976,.95).fillTriangle(gx+dx*9,gy+dy*9,gx-dx*5-dy*6,gy-dy*5+dx*6,gx-dx*5+dy*6,gy-dy*5-dx*6);
      this.guideMarker.setPosition(target.x,target.y).lineStyle(2,0xffd976,.8).strokeEllipse(0,2,28,10);
    }
    this.syncMs+=Math.min(delta,80);
    if(this.syncMs>=500){this.syncMs=0;this.scene.syncState();}
  }
  interact(){
    if(this.homeBedInReach()){
      this.scene.restAtHome();return;
    }
    if(this.scene.storyInteraction&&this.scene.interactWithStory())return;
    if(this.entry?.id===TOWER_ENTRY_ID){this.scene.notify('The entry door seals behind you. Clear the floor to open the north door and central return portal.');return;}
    if(this.scene.storyCombatActive){
      if(this.plan&&Math.hypot(this.scene.player.x-this.origin.x-this.plan.entrance.x,this.scene.player.y-this.origin.y-this.plan.entrance.y)<80){this.exit();return;}
      if(this.scene.interactWithStory())return;
    }
    const player=this.scene.player,near=this.residents.find(n=>this.reachableResident(n));
    if(near){this.talk(near);return;}
    if(!this.scene.storyCombatActive&&!this.cinematicContext&&this.innBeds.some(point=>this.bedReachable(point))){this.scene.restAtInn();return;}
    if(this.plan&&Math.hypot(player.x-this.origin.x-this.plan.entrance.x,player.y-this.origin.y-this.plan.entrance.y)<80)this.exit();
    else if(!this.scene.talkToCompanion())this.scene.notify('Speak to a resident or return to the south doorway.');
  }
  private talk(npc:Npc){if(!this.scene.storyCombatActive)useGameStore.getState().startDialogue(npc.definition.id);}
  exit(){
    if(!this.entry||this.cinematicContext)return;
    this.scene.cancelStoryEncounter();
    const returnPoint=this.outside!;this.closeRoom();
    this.scene.player.resetInput();this.scene.restoreOutsidePosition(returnPoint);
    this.scene.cameras.main.centerOn(returnPoint.x,returnPoint.y);this.outside=null;
    this.scene.refreshWorldLighting();
    this.scene.physics.world.resume();this.scene.syncState();
  }
  private closeRoom(){
    if(!this.entry&&!this.objects.length){this.releaseArt();return;}
    if(this.entry?.profile==='cave')this.scene.closeDungeon(!this.cinematicContext);
    this.entry=null;this.plan=null;this.backdrop=null;this.homeObjects=[];this.homeItems=null;
    this.guideMarker=null;this.guideTarget=null;this.navigationMs=150;
    useGameStore.setState({housingContext:null,housingEditing:false,...(useGameStore.getState().panel==='housing'?{panel:null}:{})});
    this.innBeds.length=0;
    this.innBedMarkers.length=0;
    this.nearInnBed=false;this.nearHomeBed=false;this.nextBedHintAt=0;
    this.mapFloors=[];this.mapCircle=undefined;
    for(const object of this.objects){this.scene.tweens.killTweensOf(object);object.destroy();}this.objects=[];this.residents=[];this.guide=null;
    this.floorMask?.destroy();this.floorMask=null;this.wallSolids=[];
    for(const saved of this.hidden){if(saved.object.scene)saved.object.cameraFilter=saved.filter;}this.hidden=[];
    if(this.formerBounds)this.scene.cameras.main.setBounds(this.formerBounds.x,this.formerBounds.y,this.formerBounds.width,this.formerBounds.height);
    else this.scene.cameras.main.removeBounds();
    this.formerBounds=null;this.releaseArt();
  }
  leaveOnDefeat(){
    if(!this.active)return;
    // Defeat can occur while a room is loading: the callback must not later
    // reactivate the abandoned interior after the player has respawned.
    this.cancelLoad();
    this.closeRoom();this.outside=null;this.loading=false;
  }
  private loadRoomImage(path:string,signal:AbortSignal){
    return new Promise<HTMLImageElement>((resolve,reject)=>{
      const image=new Image();image.decoding='async';let done=false;
      const finish=(error?:Error)=>{
        if(done)return;done=true;image.onload=image.onerror=null;signal.removeEventListener('abort',cancel);
        if(error){image.removeAttribute('src');reject(error);}else resolve(image);
      };
      const cancel=()=>finish(new Error('Room artwork loading cancelled'));
      signal.addEventListener('abort',cancel,{once:true});
      if(signal.aborted){cancel();return;}
      image.onload=()=>{
        if(typeof image.decode==='function')void image.decode().then(()=>finish(),()=>finish(new Error('Room artwork could not decode')));
        else finish();
      };
      image.onerror=()=>finish(new Error('Room artwork unavailable'));
      image.src=import.meta.env.BASE_URL+losslessImagePath(path);
    });
  }
  private nextArtworkFrame(){
    return new Promise<void>(resolve=>{
      this.resumeArtwork=resolve;
      this.artworkFrame=window.requestAnimationFrame(()=>{
        this.artworkFrame=undefined;this.resumeArtwork=null;resolve();
      });
    });
  }
  private finishArtworkFrame(){
    if(this.artworkFrame!==undefined)window.cancelAnimationFrame(this.artworkFrame);
    this.artworkFrame=undefined;const resume=this.resumeArtwork;this.resumeArtwork=null;resume?.();
  }
  private cancelLoad(){
    this.loadEpoch++;this.loadAbort?.abort();this.loadAbort=null;
    window.clearTimeout(this.loadTimeout);this.loadTimeout=undefined;
    this.finishArtworkFrame();this.settleLoad?.(false);this.settleLoad=null;
  }
  private fitBackdrop(){
    const camera=this.scene.cameras.main,z=camera.zoom;
    this.backdrop?.setPosition(camera.width/2*(1-1/z)-2,camera.height/2*(1-1/z)-2)
      .setDisplaySize(camera.width/z+4,camera.height/z+4);
  }
  private releaseArt(){for(const key of [SOURCE,TOWER_CHEST_SOURCE,TOWER_DOOR_SOURCE,ATLAS,...FLOORS,...HOME_ATLASES])if(this.scene.textures.exists(key))this.scene.textures.remove(key);}
  private refreshHomeFurniture(){
    if(!this.plan)return;
    const retired=new Set(this.homeObjects);for(const object of retired)object.destroy();
    this.objects=this.objects.filter(o=>!retired.has(o));this.homeObjects=[];
    this.homeItems=housingFor(useGameStore.getState().housing,this.entry?.id).items;this.plan.objects=[];
    for(const item of this.homeItems){
      if(item.stored)continue;
      const spec=FURNITURE_BY_ART[item.art]!,r=furnitureFootprint(item);
      const frame=housingArt.frames[(item.kit+':'+item.art) as keyof typeof housingArt.frames];
      const a=item.rotation*Math.PI/180,bottom=spec.h*16;
      const x=r.x+r.width/2-Math.sin(a)*bottom,y=r.y+r.height/2+Math.cos(a)*bottom;
      // A shallow shelf/rack can have its base inside the wall's 40px band.
      // Its upright art must render in front of that wall, not be cut by it.
      const depth=DEPTH+Math.max(r.y+r.height,...HOME_FLOORS.filter(f=>r.x<f.x+f.width&&r.x+r.width>f.x&&r.y>=f.y&&r.y<f.y+40).map(f=>f.y+39));
      const image=this.own(this.scene.add.image(this.origin.x+x,this.origin.y+y,HOME_ATLASES[frame.atlas],item.kit+':'+item.art)
        .setOrigin(.5,186/192).setScale(spec.width/frame.visibleWidth).setAngle(item.rotation)
        .setDepth(spec.walkable?DEPTH-750:depth));
      if(item.art==='rug')onGround(image,.025);
      else onFurniture(image,item.art,item.kit,spec.h*32/spec.width);
      this.homeObjects.push(image);
      const shadow=this.addFurnitureContact(image);if(shadow)this.homeObjects.push(shadow);
      if(item.art==='bed')image.setInteractive({useHandCursor:true}).on('pointerdown',()=>{
        const state=useGameStore.getState();
        if(this.loading||this.cinematicContext||state.panel||state.dialogue||state.cinematic||state.housingEditing)return;
        if(this.homeBedReachable(item))this.scene.restAtHome();
        else this.scene.notify('Walk beside the bed to sleep.');
      });
      this.plan.objects.push({art:item.art==='weaponRack'?'pantry':item.art,x:r.x+r.width/2,y:r.y+r.height,width:spec.width,...(!spec.walkable?{solid:r}:{})});
      if(item.weaponId&&this.scene.textures.get(SWORD_TEXTURE).has(item.weaponId)){
        const mount=homeWeaponMount(item);
        const sword=this.own(this.scene.add.image(this.origin.x+mount.x,this.origin.y+mount.y,SWORD_TEXTURE,item.weaponId)
          .setDisplaySize(25,58).setAngle(item.rotation).setDepth(depth+1));this.homeObjects.push(sword);
        const shape=(image.getData(PRESENTATION_HINT) as PresentationHint|undefined)?.furniture;
        if(shape)sword.setData(PRESENTATION_HINT,{plane:'upright',anchor:image,
          fixture:{owner:image,right:0,height:shape.rise*spec.width*.48,depth:-shape.depth*spec.width*.32+1}} satisfies PresentationHint);
      }
    }
    // Editing may cover the player's previous feet. Always return to the
    // protected foyer after committing, not into newly solid furniture.
    const p=this.localPoint(HOME_ENTRANCE);(this.scene.player.body as Phaser.Physics.Arcade.Body).reset(p.x,p.y);
    this.scene.player.resetInput();
  }
  destroy(){this.disposed=true;this.cancelLoad();this.cinematicContext=null;this.closeRoom();this.loading=false;this.outside=null;}
}
