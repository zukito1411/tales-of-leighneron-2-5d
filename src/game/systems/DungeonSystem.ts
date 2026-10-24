import Phaser from 'phaser';
import {DUNGEONS,DUNGEON_BY_ID,DUNGEON_WAVE_SIZES,DUNGEON_LEADER_SCALE,dungeonWave,dungeonEnemyId,dungeonCleared,dungeonResetReady,type DungeonDefinition} from '../../data/dungeons';
import {CAVE_ART_PATH,CAVE_ART_FRAMES} from '../../data/caveArt';
import type {InteriorEntry} from '../../data/interiors';
import {useGameStore} from '../../store/gameStore';
import {saveGame} from '../../utils/save';
import type {WorldScene} from '../scenes/WorldScene';
import type {Enemy} from '../entities/Enemy';
import type {NavigationMarker,Vec2} from '../types';
import {TOWER_ART,TOWER_EXTERIOR,TOWER_ENTRY_ID,TOWER_DOOR,TOWER_APPROACH,TOWER_UNLOCKED,TOWER_CHAMBERS,TOWER_FLOORS,towerEntryFloor,towerCampaignComplete,towerKnown,TOWER_NORTH_DOOR,TOWER_PORTAL,towerPracticeAvailable,towerFloorProgress} from '../../data/towerOfMight';
import {artScale} from '../../data/art';
import {grandMagusFarewell} from './GrandMagusArt';
import {TOWER_SOUTH_ENTRY} from '../../data/towerRoom';
import {ensureBossSkillArt} from './BossSkillArt';
import {PRESENTATION_HINT,onFurniture,type PresentationHint} from '../presentation25d/plane';
import {towerOfMightShape} from '../presentation25d/HouseGeometry';

const EXTERIOR='cave-entrances-v1';
const TOWER_TEXTURE='tower-of-might-v2';
/** Four caves and one tower, one active room, at most seven live cave defenders
 * or five live tower defenders. Outdoor
 * work runs with the existing navigation snapshot, not a new update timer. */
export class DungeonSystem {
  private readonly sites=new Map<string,{entry:InteriorEntry;image:Phaser.GameObjects.Image}>();
  private readonly positions=new Map<string,Vec2>();
  private readonly retries=new Map<string,number>();
  private loading=false;
  private artRetryAt=0;
  private towerLoading=false;
  private towerRetryAt=0;
  private disposed=false;
  private session:DungeonDefinition|null=null;
  private selectingPractice=false;
  private progress(d:DungeonDefinition){const s=useGameStore.getState();return towerFloorProgress(d.id,s.dungeons,s.towerPractice);}
  private get practice(){return Boolean(this.session&&useGameStore.getState().towerPractice?.floorId===this.session.id);}
  private readonly actors=new Map<Enemy,number>();
  private chest:Phaser.GameObjects.Image|null=null;
  private caption:Phaser.GameObjects.Text|null=null;
  private chestPoint:Vec2|null=null;
  private northDoor:Phaser.GameObjects.Image|null=null;
  private portal:Phaser.GameObjects.Sprite|null=null;
  private portalLabel:Phaser.GameObjects.Text|null=null;
  private retryAt=0;
  private warned=false;
  private nextTowerInteractionAt=0;
  private towerArtWait=0;
  private farewell:ReturnType<typeof grandMagusFarewell>|null=null;
  private nextWeekCheckAt=0;
  private onTowerLoaded=()=>{this.towerLoading=false;this.scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR,this.onTowerError);};
  private onTowerError=(file:Phaser.Loader.File)=>{if(file.key!==TOWER_TEXTURE)return;
    this.towerLoading=false;this.towerRetryAt=this.scene.time.now+10000;
    this.scene.load.off('filecomplete-image-'+TOWER_TEXTURE,this.onTowerLoaded);
    this.scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR,this.onTowerError);
  };
  private onLoaded=()=>{this.loading=false;if(this.disposed)return;
    const texture=this.scene.textures.get(EXTERIOR);const [x,y,w,h]=CAVE_ART_FRAMES.entrance;
    texture.add('entrance',0,x,y,w,h);this.scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR,this.onError);};
  private onError=(file:Phaser.Loader.File)=>{if(file.key===EXTERIOR){this.loading=false;this.artRetryAt=this.scene.time.now+10000;
    this.scene.load.off('filecomplete-image-'+EXTERIOR,this.onLoaded);this.scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR,this.onError);}};
  constructor(private readonly scene:WorldScene){}
  get entries(){return [...this.sites.values()].map(s=>s.entry);}
  get active(){return this.session!==null;}
  get fighting(){return Boolean(this.session&&!dungeonCleared(this.session,this.progress(this.session)));}
  get enemies(){return [...this.actors.keys()];}
  owns(enemy:Enemy){return this.actors.has(enemy);}
  allows(point:Vec2){return this.active&&this.scene.inInterior&&this.scene.isWalkable(point.x,point.y);}
  private ensureArt(){
    if(this.scene.textures.exists(EXTERIOR)||this.loading||this.scene.load.isLoading()||this.scene.time.now<this.artRetryAt)return;
    this.loading=true;this.scene.load.once('filecomplete-image-'+EXTERIOR,this.onLoaded);
    this.scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR,this.onError);
    this.scene.load.image({key:EXTERIOR,url:CAVE_ART_PATH,xhrSettings:{responseType:'blob',timeout:15000}});this.scene.load.start();
  }
  private towerExterior():NavigationMarker|null{
    if(!towerCampaignComplete(useGameStore.getState().quests)){
      const old=this.sites.get('tower-of-might');if(old){old.image.destroy();this.sites.delete('tower-of-might');}return null;
    }
    const distance=Math.hypot(this.scene.player.x-TOWER_APPROACH.x,this.scene.player.y-TOWER_APPROACH.y);
    const site=this.sites.get('tower-of-might');
    if(distance>2200){if(site){site.image.destroy();this.sites.delete('tower-of-might');}}
    else if(!this.disposed){
      if(!this.scene.textures.exists(TOWER_TEXTURE)&&!this.towerLoading&&!this.scene.load.isLoading()&&this.scene.time.now>=this.towerRetryAt){
        this.towerLoading=true;
        this.scene.load.once('filecomplete-image-'+TOWER_TEXTURE,this.onTowerLoaded);
        this.scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR,this.onTowerError);
        this.scene.load.image({key:TOWER_TEXTURE,url:TOWER_ART,xhrSettings:{responseType:'blob',timeout:15000}});this.scene.load.start();
      }
      if(!site&&this.scene.textures.exists(TOWER_TEXTURE)){
        // Keep the southern foot/standing target fixed. The larger cylinder
        // extends north into its clearing; the portal is authored at ground.
        const spatial=this.scene.game.registry.get('presentation')==='three-2.5d';
        const image=this.scene.add.image(TOWER_DOOR.x,TOWER_DOOR.y+12,TOWER_TEXTURE).setOrigin(.5,1)
          .setDisplaySize(spatial?TOWER_EXTERIOR.width:380,spatial?TOWER_EXTERIOR.height:570).setDepth(TOWER_DOOR.y-50).setName('Tower of Might');
        image.setData(PRESENTATION_HINT,{plane:'upright',house:towerOfMightShape()} satisfies PresentationHint);
        this.scene.registerDungeonEntrance(image,true);
        image.setInteractive({useHandCursor:true}).on('pointerdown',()=>{
          const state=useGameStore.getState();if(state.panel||state.dialogue||state.cinematic)return;
          if(Math.hypot(this.scene.player.x-TOWER_APPROACH.x,this.scene.player.y-TOWER_APPROACH.y)<95)
            this.scene.tryInteract(this.scene.player.x,this.scene.player.y);
          else this.scene.notify('The Tower of Might stands north of Oakmere. Approach its southern doorway.');
        });
        this.sites.set('tower-of-might',{image,entry:{id:TOWER_ENTRY_ID,townId:'oakmere',name:'Tower of Might',
          kit:'tower_of_might',door:{...TOWER_APPROACH},hall:false,profile:'cave'}});
      }
    }
    return {id:TOWER_ENTRY_ID,kind:'landmark',service:'tower',label:'Tower of Might · north of Oakmere',...TOWER_APPROACH};
  }
  exteriorMarkers():NavigationMarker[]{
    if(this.scene.inInterior)return [];
    useGameStore.getState().refreshTowerWeek();
    const player=this.scene.player,markers:NavigationMarker[]=[];
    const now=Date.now();
    for(const d of DUNGEONS){
      if(dungeonResetReady(useGameStore.getState().dungeons[d.id],now))useGameStore.getState().refreshDungeon(d.id);
      const point=this.positions.get(d.id)??d.door,distance=Math.hypot(point.x-player.x,point.y-player.y);
      if(distance>1800){const site=this.sites.get(d.id);if(site){site.image.destroy();this.sites.delete(d.id);}continue;}
      this.ensureArt();
      let door=this.positions.get(d.id);
      if(!door&&distance<=1000&&this.scene.time.now>=(this.retries.get(d.id)??0)){
        this.retries.set(d.id,this.scene.time.now+5000);
        // One bounded placement pass, avoiding roads, water, settlement props
        // and scenery across the complete entrance footprint and approach.
        const offsets=[{x:0,y:0},...Array.from({length:48},(_,i)=>({x:Math.cos(i*Math.PI/6)*(120+Math.floor(i/12)*120),y:Math.sin(i*Math.PI/6)*(120+Math.floor(i/12)*120)}))];
        door=offsets.map(p=>({x:d.door.x+p.x,y:d.door.y+p.y})).find(p=>{
          if(!this.scene.dungeonEntranceSuitable(p,d.regionId))return false;
          return [[0,0],[-105,-50],[105,-50],[-90,-145],[0,-145],[90,-145],[0,55]].every(([dx,dy])=>{
            const q={x:p.x+dx,y:p.y+dy};return this.scene.interiorDoorClear(q.x,q.y)&&this.scene.canTraverseGround(q,q);
          });
        });
        if(door)this.positions.set(d.id,door);
      }
      if(!door)continue;
      if(!this.sites.has(d.id)&&this.scene.textures.exists(EXTERIOR)&&this.scene.textures.get(EXTERIOR).has('entrance')){
        const image=this.scene.add.image(door.x,door.y-24,EXTERIOR,'entrance').setOrigin(.5,1).setDisplaySize(230,214).setTint(d.tint).setDepth(door.y-24);
        this.scene.registerDungeonEntrance(image);
        image.setInteractive({useHandCursor:true}).on('pointerdown',()=>{
          const s=useGameStore.getState();if(s.panel||s.dialogue||s.cinematic)return;
          if(Math.hypot(this.scene.player.x-door!.x,this.scene.player.y-door!.y)<95)this.scene.tryInteract(this.scene.player.x,this.scene.player.y);
          else this.scene.notify(`Approach the entrance to ${d.name}.`);
        });
        this.sites.set(d.id,{image,entry:{id:'cave:'+d.id,townId:d.townId,name:d.name,kit:'cave_stone',door:{...door},hall:false,profile:'cave'}});
      }
      if(Math.hypot(door.x-player.x,door.y-player.y)<=900)useGameStore.getState().discoverDungeon(d.id);
      const p=useGameStore.getState().dungeons[d.id];
      if(p&&distance<=1200)markers.push({id:'cave:'+d.id,kind:'landmark',service:'cave',label:`${d.name}${p.claimed?' · Cleared':''} · Enemies Lv ${d.enemyLevel}`,...door});
    }
    const tower=this.towerExterior();if(tower)markers.push(tower);
    return markers;
  }
  begin(entryId:string){
    this.close(false);
    ensureBossSkillArt(this.scene);
    const renewed=useGameStore.getState().refreshTowerWeek();
    if(renewed&&entryId.startsWith('cave:might-'))entryId=TOWER_ENTRY_ID;
    if(entryId===TOWER_ENTRY_ID)useGameStore.getState().resetTowerRun();
    const state=useGameStore.getState();
    if(entryId===TOWER_ENTRY_ID){state.setStoryFlag(TOWER_UNLOCKED);}
    const id=entryId===TOWER_ENTRY_ID?towerEntryFloor(state.dungeons).id:entryId.replace(/^cave:/,'');
    const d=DUNGEON_BY_ID[id];if(!d)return;
    if(d.tower&&!towerKnown(state.quests,state.storyFlags))return;
    if(d.tower&&!state.defeatedBosses.includes(d.tower.bossId)){
      this.scene.notify(`Chamber ${d.tower.chamber} is sealed. Defeat ${TOWER_CHAMBERS[d.tower.chamber-1].name} in the world before challenging that echo.`);return;
    }
    useGameStore.getState().refreshDungeon(id);
    this.session=d;if(!this.practice)useGameStore.getState().discoverDungeon(id);useGameStore.setState({activeDungeonId:id});
    if(entryId===TOWER_ENTRY_ID&&towerPracticeAvailable(state.dungeons,state.nextTowerResetAt)){
      this.selectingPractice=true;useGameStore.getState().openTowerPractice();return;
    }
    if(d.tower){
      const label=this.scene.children.getByName('interior-room-title:might-arena');
      if(label instanceof Phaser.GameObjects.Text){const title=this.scene.dungeonPoint({x:900,y:415});
        label.setPosition(title.x,title.y).setText(d.name+(d.tower.floor===5?' · '+d.captain:'')+(this.practice?' · Practice':''));}
      const point=this.scene.dungeonPoint(TOWER_NORTH_DOOR);
      this.northDoor=this.scene.add.image(point.x,point.y,'interior-furniture','tower-door-closed')
        .setOrigin(.5,252/256).setDepth(this.scene.playerRenderDepth(point.y));
      const doorMetadata=this.northDoor.frame.customData as {visibleWidth:number};
      this.northDoor.setScale(110/doorMetadata.visibleWidth);
      onFurniture(this.northDoor,'tower-door-closed','tower_of_might');
      this.northDoor.setInteractive({useHandCursor:true}).on('pointerdown',()=>{
        const state=useGameStore.getState();
        if(state.panel||state.dialogue||state.cinematic)return;
        if(!dungeonCleared(d,this.progress(d))){this.scene.notify('The northern door is sealed. Defeat every enemy on this floor.');return;}
        if(this.near(point))this.ascendTower();
      });
    }
    this.retryAt=this.scene.time.now+1400;
    this.towerArtWait=0;
    for(const enemyId of new Set([...d.enemyPool,d.enemies[d.enemies.length-1]]))this.scene.ensureStoryEnemy(enemyId);
    if(dungeonCleared(d,this.progress(d)))this.showChest();
    else this.scene.notify(d.tower?`${this.practice?'Practice | ':''}${d.name} | ${d.tower.floor===5?d.captain+' awaits.':d.enemies.length+' tower defenders.'}${this.practice?' No rewards.':' Clear the floor to ascend.'}`
      :`${d.name} · five growing waves of level ${d.enemyLevel} defenders, then ${d.captain}. Clear the cave to reveal its chest.`);
  }
  update(time:number,blocked:boolean){
    const d=this.session;if(!d)return;
    if(d.tower&&time>=this.nextWeekCheckAt){
      this.nextWeekCheckAt=time+1000;
      if(Date.now()>=useGameStore.getState().nextTowerResetAt){
        // Exit destroys actors/effects and banks defeated bosses before the
        // weekly ledger is replaced. Never leave stale actors in a new week.
        this.scene.returnFromTower();
        this.scene.notify('Monday renewal: the tower has reset to 1-1. Your earned treasure and equipment are safe.');return;
      }
    }
    if(blocked)return;
    if(this.selectingPractice){
      const state=useGameStore.getState(),request=state.towerPracticeRequest;
      this.selectingPractice=false;
      if(request&&request.week===state.nextTowerResetAt&&towerPracticeAvailable(state.dungeons,state.nextTowerResetAt)){
        useGameStore.setState({towerPracticeRequest:null});
        this.scene.targeting.clear();this.scene.player.resetInput();
        const entry=this.scene.dungeonPoint(TOWER_SOUTH_ENTRY);
        (this.scene.player.body as Phaser.Physics.Arcade.Body).reset(entry.x,entry.y);
        this.begin('cave:'+request.floorId);this.scene.cameras.main.flash(250,0,0,0);
      }else if(!state.towerPractice)this.scene.returnFromTower();
      return;
    }
    const request=useGameStore.getState().towerExitRequest;
    if(request?.confirmed){
      useGameStore.setState({towerExitRequest:null});
      if(d.tower&&request.floorId===d.id&&this.portal&&this.near(this.scene.dungeonPoint(TOWER_PORTAL))
        &&dungeonCleared(d,this.progress(d))){this.scene.returnFromTower();return;}
    }
    const p=this.progress(d);
    if(dungeonCleared(d,p)){if(!this.chest&&!this.portal&&!this.farewell?.active)this.showChest();return;}
    if(this.actors.size||time<this.retryAt)return;
    this.retryAt=time+500;
    const slots=d.enemies.map((_,slot)=>slot).filter(slot=>!(p.defeated&(1<<slot)));
    const wave=d.tower?Math.floor(slots[0]/5):dungeonWave(slots[0]),pending=d.tower?slots.slice(0,5):slots.filter(slot=>dungeonWave(slot)===wave);
    const leader=d.tower?d.tower.floor===5:wave===DUNGEON_WAVE_SIZES.length-1;
    const enemyIds=pending.map(slot=>dungeonEnemyId(d,slot,p));
    const ready=enemyIds.map(id=>this.scene.ensureStoryEnemy(id)).every(Boolean);
    if(!ready){
      // A sealed trial must not strand the player if a required enemy pack
      // cannot load. This counts active preparation retries, not menu time.
      if(d.tower&&(this.towerArtWait+=500)>=30000){
        console.warn('[tower] Required defender artwork did not become ready:',enemyIds);
        this.scene.returnFromTower();
        this.scene.notify('The trial cannot take form just now. You have been returned to Oakmere; your boss checkpoints are safe.');
      }
      return;
    }
    this.towerArtWait=0;
    const placed:Vec2[]=[];
    // A bounded room grid gives the larger waves alternatives even when the
    // player stands beside their authored formation. Never spawn through walls.
    const grid=Array.from({length:49},(_,i)=>this.scene.dungeonPoint(d.tower?
      {x:300+i%7*200,y:300+Math.floor(i/7)*160}:{x:240+i%7*120,y:260+Math.floor(i/7)*100}));
    for(let i=0;i<pending.length;i++){
      const preferred=this.scene.dungeonPoint(d.tower?(leader?{x:900,y:650}:{x:400+i%3*400,y:500+Math.floor(i/3)*350})
        :leader?{x:600,y:350}:{x:330+i%4*180,y:wave===0?800-Math.floor(i/4)*150:400+Math.floor(i/4)*180});
      const candidates=[preferred,...grid];
      const position=candidates.find(q=>Math.hypot(q.x-this.scene.player.x,q.y-this.scene.player.y)>=150
        &&placed.every(other=>Math.hypot(q.x-other.x,q.y-other.y)>110)&&this.scene.storySpawnClear(q,enemyIds[i],this.scene.player,leader?DUNGEON_LEADER_SCALE:1));
      if(!position){if(!this.warned){this.warned=true;this.scene.notify('Move farther into the cavern to give the defenders a clear approach.');}return;}
      placed.push(position);
    }
    try{pending.forEach((slot,i)=>{const enemy=this.scene.createDungeonEnemy(d,slot,placed[i],enemyIds[i]);this.actors.set(enemy,slot);});
      this.warned=false;this.scene.notify(leader?`${d.captain} approaches!`:d.tower?`${d.name} · ${slots.length} defenders remain.`:`${d.name} · wave ${wave+1} of 5 (${pending.length} defenders)`);
    }catch(error){for(const enemy of this.actors.keys())this.scene.releaseStoryEnemy(enemy);this.actors.clear();this.retryAt=time+1500;console.error('Cave defenders:',error);}
  }
  defeated(enemy:Enemy){
    const slot=this.actors.get(enemy),d=this.session;if(slot===undefined||!d)return false;
    this.actors.delete(enemy);useGameStore.getState().recordDungeonDefeat(d.id,slot);
    if(enemy.definition.id==='grand-magus')this.farewell=grandMagusFarewell(this.scene,enemy,()=>{
      if(this.session===d){this.showChest();this.scene.notify(this.practice?'Practice complete. Choose another floor at the northern arch, or return to Oakmere.':'The Grand Magus is scattered to the shadows. His legendary treasure is yours.');}
    });else enemy.createDeathVisual();
    this.scene.releaseStoryEnemy(enemy);this.retryAt=this.scene.time.now+1600;
    if(dungeonCleared(d,this.progress(d))){if(!this.farewell?.active)this.showChest();this.scene.notify(this.practice?
      'Practice complete — no rewards. Choose another floor at the northern arch, or use the return portal.':this.farewell?.active?
      'The Grand Magus shatters into a flight of bats…':d.tower&&d.tower.floor<5?
      `${d.name} cleared! The northern arch opens. Interact there to ascend.`:`${d.name} cleared! A war chest has appeared in the inner chamber.`);}
    if(!this.practice){this.scene.syncState();saveGame();}return true;
  }
  private showChest(){
    const d=this.session;if(!d||this.chest||d.tower&&this.portal)return;
    if(d.tower){
      this.northDoor?.setFrame('tower-door-open');
      if(this.northDoor)onFurniture(this.northDoor,'tower-door-open','tower_of_might');
      const point=this.scene.dungeonPoint(TOWER_PORTAL);
      this.portal=this.scene.add.sprite(point.x,point.y,'effect_teleport',0).setScale(artScale('effect_teleport')*1.5)
        .setDepth(this.scene.playerRenderDepth(point.y)+1).setName('tower-return-portal');
      this.portal.play({key:'effect-teleport',repeat:-1,frameRate:8});
      this.portal.setInteractive({useHandCursor:true}).on('pointerdown',()=>{if(this.near(point))this.requestTowerReturn();});
      this.portalLabel=this.scene.add.text(point.x,point.y-85,'Return to Oakmere',{fontFamily:'Georgia, serif',fontSize:'12px',color:'#d9c4ff',stroke:'#171021',strokeThickness:3})
        .setOrigin(.5).setDepth(this.scene.playerRenderDepth(point.y)+2);
      if(this.practice)return;
      if(d.tower.floor<5)return;
    }
    const p=this.scene.dungeonPoint(d.tower?{x:1160,y:550}:{x:600,y:350});this.chestPoint=p;
    const claimed=useGameStore.getState().dungeons[d.id]?.claimed;
    this.chest=this.scene.add.image(p.x,p.y,'interior-furniture',claimed?'openChest':'chest').setOrigin(.5,1).setDisplaySize(72,70).setDepth(this.scene.playerRenderDepth(p.y));
    onFurniture(this.chest,claimed?'openChest':'chest','cave_stone');
    this.chest.setInteractive({useHandCursor:true}).on('pointerdown',()=>this.interact());
    this.caption=this.scene.add.text(p.x,p.y-82,claimed?'Claimed':'War chest',{fontFamily:'Georgia, serif',fontSize:'12px',color:'#ffe3a2',stroke:'#1b140e',strokeThickness:3})
      .setOrigin(.5).setDepth(this.scene.playerRenderDepth(p.y)+1);
  }
  get prompt(){
    if(!this.session)return null;
    const progress=this.progress(this.session);
    if(this.session.tower){
      if(this.practice){
        if(this.portal&&this.near(this.scene.dungeonPoint(TOWER_PORTAL)))return 'Finish practice — return to Oakmere';
        return dungeonCleared(this.session,progress)&&this.near(this.scene.dungeonPoint(TOWER_NORTH_DOOR))?'Choose another practice floor':null;
      }
      if(this.portal&&this.near(this.scene.dungeonPoint(TOWER_PORTAL)))return 'Return to Oakmere — confirm chamber reset';
      if(this.chestPoint&&this.near(this.chestPoint))return progress?.claimed?'War chest claimed':'Open the Tower of Might war chest';
      if(!dungeonCleared(this.session,progress)||!this.near(this.scene.dungeonPoint(TOWER_NORTH_DOOR)))return null;
      const next=TOWER_FLOORS[TOWER_FLOORS.findIndex(d=>d.id===this.session!.id)+1];
      return next?'Ascend to '+next.name.replace('Tower of Might · ',''):'Tower conquered — use the central portal';
    }
    if(!this.chestPoint||!this.near(this.chestPoint))return null;
    if(progress?.claimed){const minutes=Math.max(0,Math.ceil(((progress.respawnAt??0)-Date.now())/60000));
      return minutes?`War chest · resets in ${minutes}m`:'War chest · leave to reset the cave';}
    return 'Open cave war chest';
  }
  get markers():NavigationMarker[]{return [
    ...(this.chestPoint?[{id:'cave:chest',kind:'landmark' as const,label:'War chest',...this.chestPoint}]:[]),
    ...(this.session?.tower?[{id:'tower:north-door',kind:'landmark' as const,label:this.portal?'Open north door':'Sealed north door',...this.scene.dungeonPoint(TOWER_NORTH_DOOR)}]:[]),
    ...(this.portal?[{id:'tower:return-portal',kind:'landmark' as const,label:'Return to Oakmere',...this.scene.dungeonPoint(TOWER_PORTAL)}]:[]),
  ];}
  interact(){
    if(!this.session||!this.prompt)return false;
    if(this.session.tower)return this.interactTower();
    const s=useGameStore.getState(),id=this.session.id;if(s.dungeons[id]?.claimed){this.scene.notify(this.prompt!);return true;}
    if(s.panel||s.dialogue||s.cinematic||!this.scene.hasClearPath(this.scene.player.x,this.scene.player.y,this.chestPoint!.x,this.chestPoint!.y))return true;
    s.claimDungeonChest(id);if(!useGameStore.getState().dungeons[id]?.claimed)return true;
    this.chest?.setFrame('openChest');this.caption?.setText('Claimed · 20m reset');this.scene.playAudio('sfx-heal-bell',.4);
    if(this.chest)onFurniture(this.chest,'openChest','cave_stone');
    this.scene.syncState();saveGame();return true;
  }
  private interactTower(){
    const d=this.session!,s=useGameStore.getState();
    if(this.scene.time.now<this.nextTowerInteractionAt)return true;
    if(s.panel||s.dialogue||s.cinematic||s.hp<=0||s.activeSkillStatus.casting)return true;
    this.nextTowerInteractionAt=this.scene.time.now+400;
    if(this.portal&&this.near(this.scene.dungeonPoint(TOWER_PORTAL))){this.requestTowerReturn();return true;}
    if(this.chestPoint&&this.near(this.chestPoint)){
      s.claimDungeonChest(d.id);
      if(useGameStore.getState().dungeons[d.id]?.claimed){
        this.chest?.setFrame('openChest');this.caption?.setText('Claimed');this.scene.syncState();saveGame();
        if(this.chest)onFurniture(this.chest,'openChest','cave_stone');
      }
      return true;
    }
    this.ascendTower();return true;
  }
  private near(point:Vec2){return Math.hypot(this.scene.player.x-point.x,this.scene.player.y-point.y)<=95
    &&this.scene.hasClearPath(this.scene.player.x,this.scene.player.y,point.x,point.y);}
  private requestTowerReturn(){
    const d=this.session;if(!d?.tower||!this.portal||!this.near(this.scene.dungeonPoint(TOWER_PORTAL)))return;
    useGameStore.getState().requestTowerExit(d.id);this.scene.player.resetInput();
  }
  private ascendTower(){
    const d=this.session,s=useGameStore.getState();
    if(!d?.tower||s.panel||s.dialogue||s.cinematic||s.hp<=0||s.activeSkillStatus.casting
      ||!dungeonCleared(d,this.progress(d))||!this.near(this.scene.dungeonPoint(TOWER_NORTH_DOOR)))return;
    if(this.practice){this.selectingPractice=true;s.openTowerPractice();this.scene.player.resetInput();return;}
    const next=TOWER_FLOORS[TOWER_FLOORS.findIndex(f=>f.id===d.id)+1];
    if(!next){this.scene.notify('The tower is conquered. Use the central portal to return to Oakmere.');return;}
    if(!useGameStore.getState().defeatedBosses.includes(next.tower!.bossId)){
      this.scene.notify(`The next chamber remembers ${TOWER_CHAMBERS[next.tower!.chamber-1].name}. Defeat that foe in the world before ascending.`);return;
    }
    s.claimDungeonChest(d.id);
    this.scene.targeting.clear();this.scene.player.resetInput();
    const entry=this.scene.dungeonPoint(TOWER_SOUTH_ENTRY);this.scene.player.setPosition(entry.x,entry.y);
    (this.scene.player.body as Phaser.Physics.Arcade.Body).reset(entry.x,entry.y);
    this.begin('cave:'+next.id);this.scene.cameras.main.flash(350,0,0,0);this.scene.syncState();saveGame();
  }
  close(resetTower=true){
    this.selectingPractice=false;
    this.farewell?.destroy();this.farewell=null;
    const tower=Boolean(this.session?.tower);
    for(const enemy of this.actors.keys())this.scene.releaseStoryEnemy(enemy);this.actors.clear();
    this.chest?.destroy();this.caption?.destroy();this.chest=null;this.caption=null;this.chestPoint=null;this.session=null;
    this.northDoor?.destroy();this.portal?.destroy();this.portalLabel?.destroy();this.northDoor=null;this.portal=null;this.portalLabel=null;
    if(tower)this.scene.releaseTowerBossArt();
    if(tower&&resetTower)useGameStore.getState().resetTowerRun();
    if(resetTower)useGameStore.setState({towerPractice:null,towerPracticeRequest:null,
      ...(['tower-practice','tower-exit'].includes(useGameStore.getState().panel??'')?{panel:null}:{})});
    if(useGameStore.getState().activeDungeonId)useGameStore.setState({activeDungeonId:null});
  }
  destroy(){this.disposed=true;this.close();this.scene.load.off('filecomplete-image-'+EXTERIOR,this.onLoaded);this.scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR,this.onError);
    this.scene.load.off('filecomplete-image-'+TOWER_TEXTURE,this.onTowerLoaded);this.scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR,this.onTowerError);
    if(this.scene.textures.exists(TOWER_TEXTURE))this.scene.textures.remove(TOWER_TEXTURE);
    for(const site of this.sites.values())site.image.destroy();this.sites.clear();if(this.scene.textures.exists(EXTERIOR))this.scene.textures.remove(EXTERIOR);}
}
