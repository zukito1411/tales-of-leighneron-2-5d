import Phaser from 'phaser';
import type {PresentationCameraControl} from '../presentation25d/OrbitCamera';
import {presentationViewReady} from '../presentation25d/resourcePreparation';
import { CINEMATICS, type StoryScene, type StoryShot } from '../../data/cinematics';
import { useGameStore } from '../../store/gameStore';
import type { WorldScene } from '../scenes/WorldScene';
import {renderDensity} from './renderSizing';
import {CINEMATIC_FADE_MS,STORY_PANEL_ART} from '../../data/storyPanelArt';
import {loadCinematicArtwork} from './CinematicArtwork';

type Phase='concealing'|'preparing'|'preloading'|'revealing'|'playing'|'return-preparing'|'return-loading'|'return-revealing';
const CINEMATIC_PREPARE_GRACE_MS=3000;

/** Camera beats share gameplay streaming/interiors. A cut cannot reveal its
 * destination until coverage and its named subject are available. */
export class CinematicDirector {
  private sceneData:StoryScene|null=null;
  private index=0;
  private elapsed=0;
  private waiting=0;
  private origin={zoom:1};
  private playerCamera=true;private returnReadyFrames=0;
  private readonly cameraControl:PresentationCameraControl={owner:this,view:'hold'};
  private phase:Phase='preparing';
  private sequence=0;
  private disposed=false;
  private readonly cover:Phaser.GameObjects.Rectangle;
  private coverTween:Phaser.Tweens.Tween|null=null;
  private illustratedShot=false;
  private artworkLoad:ReturnType<typeof loadCinematicArtwork>|null=null;
  private readonly readyArtwork=new Set<string>();
  private readonly failedArtwork=new Set<string>();
  constructor(private readonly scene:WorldScene){
    this.cover=scene.add.rectangle(0,0,1,1,0x000000).setOrigin(0).setScrollFactor(0)
      .setDepth(20_000_000).setName('cinematic-transition-cover').setAlpha(0).setVisible(false);
  }
  get active(){return this.sceneData!==null;}
  get usesPlayerCamera(){return this.playerCamera;}
  get presentationCameraControl(){
    this.cameraControl.view=this.phase==='concealing'||this.phase==='return-preparing'||this.illustratedShot&&!this.phase.startsWith('return-')
      ?'hold':this.playerCamera?'player':'scripted';
    return this.cameraControl;
  }
  get playing(){return this.active&&this.phase==='playing';}
  get illustrated(){return this.active&&this.illustratedShot&&!this.phase.startsWith('return-');}
  start(id:string){
    const state=useGameStore.getState(),data=CINEMATICS[id];
    if(this.disposed||this.active||!data?.shots.length||state.dialogue||state.panel||state.storyFlags['scene:'+id])return false;
    this.sceneData={...data,shots:data.shots.map(shot=>{
      const lines=[shot.line,...(shot.variants?.map(v=>v.line)??[])];
      const readingTime=1500+Math.max(...lines.map(line=>line.split(/\s+/).length))*220;
      return {...shot,duration:Math.max(shot.duration,Math.min(9000,readingTime))};
    })};
    this.index=0;this.elapsed=0;this.playerCamera=true;this.returnReadyFrames=0;
    this.origin={zoom:this.scene.cameras.main.zoom/renderDensity(this.scene)};
    this.scene.player.resetInput();this.scene.beginCinematicView();
    this.scene.physics.world.pause();this.scene.cameras.main.stopFollow();this.frame();return true;
  }
  update(delta:number,paused=false){
    if(!this.sceneData||this.disposed)return;
    if(useGameStore.getState().skipCinematicRequested){
      useGameStore.getState().hydrate({skipCinematicRequested:false});
      if(!this.phase.startsWith('return-')){this.finish();return;}
    }
    this.fitCover();
    if(this.phase==='concealing')return;
    if(this.phase==='preparing'){
      this.waiting+=Math.min(delta,250);
      if(this.waiting>=(this.illustratedShot?10000:CINEMATIC_PREPARE_GRACE_MS))this.continueUnpreparedShot();
      return;
    }
    if(this.phase==='return-preparing')return;
    if(this.phase==='return-loading'){
      this.position(this.scene.player,this.origin.zoom*renderDensity(this.scene),true);
      this.waiting+=Math.min(delta,250);
      // A failed optional creature atlas must not trap the player in a black
      // return screen. Terrain/scenery coverage remains mandatory.
      const checkSubjects=this.waiting<15000;
      const ready=this.scene.streamCinematicView(true,undefined,checkSubjects)&&presentationViewReady(this.scene,this.scene.player);
      this.returnReadyFrames=ready?this.returnReadyFrames+1:0;
      if(this.returnReadyFrames>=2){
        if(!checkSubjects)this.scene.notify('Some creature artwork could not load. You can continue your journey.');
        const sequence=this.sequence;this.phase='return-revealing';
        this.reveal(sequence,()=>this.complete());
      }else if(this.waiting>=30000){
        this.scene.recoverCinematicLocation();
        this.scene.notify('The world could not finish streaming. Your journey has been restored; please move or reopen the scene.');
        const sequence=this.sequence;this.phase='return-revealing';
        this.reveal(sequence,()=>this.complete());
      }
      return;
    }
    if(this.phase==='return-revealing'){this.scene.streamCinematicView();return;}
    const shot=this.sceneData.shots[this.index];
    if(this.phase==='preloading'){
      this.position(this.scene.cinematicTarget(shot),shot.zoom*renderDensity(this.scene));
      if(this.scene.streamCinematicView(true,shot.focusNpcId)){
        this.waiting=0;this.phase='revealing';
        this.reveal(this.sequence,()=>{this.phase='playing';this.elapsed=0;});
      }else{
        this.waiting+=Math.min(delta,250);
        if(this.waiting>=CINEMATIC_PREPARE_GRACE_MS)this.continueUnpreparedShot();
      }
      return;
    }
    if(this.phase==='revealing'){
      if(!this.illustratedShot)this.scene.streamCinematicView(false,shot.focusNpcId);
      return;
    }
    if(this.illustratedShot){
      // An illustration is not a camera destination. Keep the current world/interior
      // resident and untouched behind the opaque illustrated overlay.
      if(!paused)this.elapsed+=Math.min(delta,250);
      if(this.elapsed>=shot.duration)this.nextShot();
      return;
    }
    const camera=this.scene.cameras.main,target=this.scene.cinematicTarget(shot);
    const blend=1-Math.exp(-Math.min(delta,100)/240);
    this.position({x:Phaser.Math.Linear(camera.midPoint.x,target.x,blend),y:Phaser.Math.Linear(camera.midPoint.y,target.y,blend)},
      Phaser.Math.Linear(camera.zoom,shot.zoom*renderDensity(this.scene),blend));
    // AFTER moving/zooming, every frame, including pans inside one chunk.
    this.scene.streamCinematicView(false,shot.focusNpcId);
    if(!paused)this.elapsed+=Math.min(delta,250);
    if(this.elapsed>=shot.duration)this.nextShot();
  }
  private nextShot(){
    this.index++;this.elapsed=0;
    if(this.index>=this.sceneData!.shots.length)this.finish();else this.frame();
  }
  private frame(){
    this.artworkLoad?.cancel();this.artworkLoad=null;
    const data=this.sceneData!,shot=data.shots[this.index],sequence=++this.sequence;
    const state=useGameStore.getState();
    this.phase='concealing';this.waiting=0;
    // Keep the old picture AND narration until both curtains are opaque.
    // Replacing the React page first would unmount it before it could fade out.
    if(!state.cinematic)state.hydrate({cinematic:{id:data.id,title:data.title,line:'',ready:false,covered:true},
      skipCinematicRequested:false});
    this.conceal(sequence,()=>{
      this.activateShot(shot,sequence);
    });
  }
  private activateShot(shot:StoryShot,sequence:number){
    const data=this.sceneData!,state=useGameStore.getState();
    const line=shot.variants?.find(v=>state.storyFlags[v.flag])?.line??shot.line;
    this.illustratedShot=Boolean(shot.illustration);
    // Keep the old artwork as an opaque curtain while preparing a return to a
    // world shot. The existing reveal path removes it only when the world is ready.
    state.hydrate({cinematic:{id:data.id,title:data.title,line,ready:false,covered:true,focusNpcId:shot.focusNpcId,
      illustration:shot.illustration??state.cinematic?.illustration},skipCinematicRequested:false});
    this.phase='preparing';this.waiting=0;
    if(shot.illustration){
      void this.prepareIllustration(shot,sequence);
      return;
    }
    void this.prepare(shot,sequence);
  }
  private async prepareIllustration(shot:StoryShot,sequence:number){
    const path=STORY_PANEL_ART[shot.illustration!.page].path;
    let loaded=this.readyArtwork.has(path);
    if(!loaded&&!this.failedArtwork.has(path)){
      const request=loadCinematicArtwork(path);this.artworkLoad=request;
      loaded=await request.promise;
      if(this.artworkLoad===request)this.artworkLoad=null;
    }
    if(!this.current(sequence))return;
    if(!loaded){
      this.failedArtwork.add(path);
      // Optional art must never strand a quest or erase its narration.
      this.illustratedShot=false;this.waiting=0;
      const state=useGameStore.getState();
      if(state.cinematic)state.hydrate({cinematic:{...state.cinematic,illustration:undefined}});
      void this.prepare(shot,sequence);return;
    }
    this.readyArtwork.add(path);this.phase='revealing';
    this.reveal(sequence,()=>{this.phase='playing';this.elapsed=0;});
  }
  private async prepare(shot:StoryShot,sequence:number){
    this.playerCamera=false;
    try{
      const ready=await this.scene.prepareCinematicShot(shot);
      if(!this.current(sequence))return;
      if(!ready)throw new Error('Interior or cinematic subject unavailable');
      this.position(this.scene.cinematicTarget(shot),shot.zoom*renderDensity(this.scene));
      this.phase='preloading';
    }catch(error){
      if(!this.current(sequence))return;
      console.error('Cinematic destination could not load:',error);
      this.continueUnpreparedShot();
    }
  }
  private continueUnpreparedShot(){
    const shot=this.sceneData?.shots[this.index];
    if(!shot||this.phase==='revealing'||this.phase==='playing')return;
    this.artworkLoad?.cancel();this.artworkLoad=null;this.illustratedShot=false;this.playerCamera=false;
    const sequence=++this.sequence;
    this.position(this.scene.cinematicTarget(shot),shot.zoom*renderDensity(this.scene));
    this.scene.streamCinematicView(true,shot.focusNpcId,false);
    this.phase='revealing';
    this.reveal(sequence,()=>{this.phase='playing';this.elapsed=0;});
  }
  private position(point:{x:number;y:number},zoom:number,restore=false){
    const framed=this.scene.constrainCinematicCamera(point.x,point.y,zoom),camera=this.scene.cameras.main;
    camera.setZoom(restore?zoom:framed.zoom).centerOn(framed.x,framed.y);
    // worldView/midPoint otherwise describe the previous render, not this pan.
    camera.preRender();this.fitCover();
  }
  private fitCover(){
    const camera=this.scene.cameras.main,z=camera.zoom;
    this.cover.setPosition(camera.width/2*(1-1/z)-2,camera.height/2*(1-1/z)-2)
      .setDisplaySize(camera.width/z+4,camera.height/z+4);
  }
  private current(sequence:number){return !this.disposed&&this.active&&sequence===this.sequence;}
  private conceal(sequence:number,ready:()=>void){
    this.coverTween?.stop();this.cover.setVisible(true);this.fitCover();
    const state=useGameStore.getState();
    if(state.cinematic)state.hydrate({cinematic:{...state.cinematic,covered:true}});
    this.coverTween=this.scene.tweens.add({targets:this.cover,alpha:1,duration:CINEMATIC_FADE_MS,ease:'Sine.InOut',
      onComplete:()=>{if(this.current(sequence))ready();}});
  }
  private reveal(sequence:number,ready:()=>void){
    this.coverTween?.stop();this.cover.setVisible(true).setAlpha(1);this.fitCover();
    const state=useGameStore.getState(),cinematic=state.cinematic,returning=this.phase.startsWith('return-');
    // Publish the decoded image / prepared world UNDER the opaque HTML curtain,
    // then uncover both layers together. The reading clock starts after fading.
    if(cinematic&&cinematic.id===this.sceneData?.id)state.hydrate({cinematic:{...cinematic,
      ready:!returning,covered:false,
      illustration:!returning&&this.illustratedShot?this.sceneData?.shots[this.index]?.illustration:undefined}});
    this.coverTween=this.scene.tweens.add({targets:this.cover,alpha:0,duration:CINEMATIC_FADE_MS,ease:'Sine.InOut',
      onComplete:()=>{if(this.current(sequence)){
        this.cover.setVisible(false);
        ready();
      }}});
  }
  refreshZoom(){
    if(!this.sceneData)return;
    // A resize during concealment must not jump to an unprepared destination.
    this.fitCover();
    if(this.illustratedShot&&!this.phase.startsWith('return-'))return;
    if(this.phase==='concealing'||this.phase==='preparing'||this.phase==='return-preparing')return;
    const returning=this.phase.startsWith('return-');
    const shot=this.sceneData.shots[Math.min(this.index,this.sceneData.shots.length-1)];
    this.position(returning?this.scene.player:this.scene.cinematicTarget(shot),
      (returning?this.origin.zoom:shot.zoom)*renderDensity(this.scene),returning);
    if(this.phase==='playing'){
      const focus=shot.focusNpcId;
      if(!this.scene.streamCinematicView(true,focus)){
        this.phase='preloading';this.waiting=0;
        this.cover.setVisible(true).setAlpha(1);
        const cinematic=useGameStore.getState().cinematic;
        if(cinematic)useGameStore.getState().hydrate({cinematic:{...cinematic,ready:false,covered:true}});
      }
    }else if(this.phase==='revealing'||this.phase==='return-revealing')this.scene.streamCinematicView();
  }
  finish(){
    if(!this.sceneData||this.phase.startsWith('return-'))return;
    const sequence=++this.sequence;this.phase='return-preparing';
    this.artworkLoad?.cancel();this.artworkLoad=null;
    const cinematic=useGameStore.getState().cinematic;
    useGameStore.getState().hydrate({skipCinematicRequested:false,
      ...(cinematic?{cinematic:{...cinematic,ending:true}}:{})});
    this.conceal(sequence,()=>{
      const state=useGameStore.getState();
      if(state.cinematic)state.hydrate({cinematic:{...state.cinematic,ready:false}});
      void this.prepareReturn(sequence);
    });
  }
  private async prepareReturn(sequence:number){
    try{await this.scene.restoreCinematicLocation();}
    catch(error){
      if(!this.current(sequence))return;
      console.error('Cinematic room restoration failed:',error);
      this.scene.recoverCinematicLocation();
    }
    if(!this.current(sequence))return;
    this.playerCamera=true;this.returnReadyFrames=0;
    this.position(this.scene.player,this.origin.zoom*renderDensity(this.scene),true);
    this.waiting=0;this.phase='return-loading';
  }
  private complete(){
    if(!this.sceneData)return;
    const id=this.sceneData.id;this.sceneData=null;this.illustratedShot=false;this.readyArtwork.clear();this.failedArtwork.clear();
    this.scene.cameras.main.startFollow(this.scene.player,false,.12,.12);
    const state=useGameStore.getState(),queue=state.cinematicQueue.filter(next=>next!==id&&!state.storyFlags['scene:'+next]);
    state.hydrate({cinematic:null,pendingCinematic:queue[0]??null,cinematicQueue:queue.slice(1),skipCinematicRequested:false,
      storyFlags:{...state.storyFlags,['scene:'+id]:true}});
    this.scene.resumeAfterCinematic();
  }
  destroy(){
    this.disposed=true;this.sequence++;this.artworkLoad?.cancel();this.artworkLoad=null;
    this.readyArtwork.clear();this.failedArtwork.clear();this.coverTween?.stop();this.cover.destroy();this.sceneData=null;
    useGameStore.getState().hydrate({cinematic:null,pendingCinematic:null,skipCinematicRequested:false});
  }
}
