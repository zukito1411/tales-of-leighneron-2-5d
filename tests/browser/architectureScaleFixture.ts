import Phaser from 'phaser';
import {ThreePresentation} from '../../src/game/presentation25d/ThreePresentation';
import {PAINTED_MODEL_ATLASES} from '../../src/game/presentation25d/PaintedMaterials';
import {ART_SHEETS,ART_BY_KEY,artScale,worldPropOrigin,type ArtTextureKey} from '../../src/data/art';
import {heroBodySource} from '../../src/data/modularHero';
import {BootScene} from '../../src/game/scenes/BootScene';
import {WorldSpriteSystem} from '../../src/game/systems/WorldSpriteSystem';
import {onGround,PRESENTATION_HINT,type PresentationHint} from '../../src/game/presentation25d/plane';
import {WORLD_CONTENT} from '../../src/data/content';
import {useGameStore} from '../../src/store/gameStore';

const keys=new Set<ArtTextureKey>(['world_buildings','capital_buildings','elven_villas','royal_walls','leigneron_idle','npc_guard_idle','npc_villager_idle']);
const sheets=ART_SHEETS.filter(sheet=>keys.has(sheet.key));
const state={ready:false,error:'',game:undefined as unknown as Phaser.Game,scene:undefined as unknown as ReviewScene,
  orbit:undefined as unknown as {yaw:number;targetYaw:number;pitch:number;targetPitch:number}};
declare global{interface Window{__architectureScaleReview:typeof state}}
window.__architectureScaleReview=state;
class ReviewScene extends Phaser.Scene{
  readonly presentationFocus={x:0,y:30};readonly presentationControlsEnabled=false;
  private sprites!:WorldSpriteSystem;private actor?:Phaser.GameObjects.Image;
  preload(){
    this.load.setBaseURL('/');
    for(const atlas of PAINTED_MODEL_ATLASES)this.load.image(atlas.key,atlas.path);
    for(const sheet of sheets)for(const path of new Set([sheet.path,...(sheet.sources?.map(source=>source.path)??[])]))
      this.load.image('source:'+path,heroBodySource(path));
  }
  create(){void this.prepare().catch(error=>{state.error=String(error);});}
  private async prepare(){
    useGameStore.setState({minuteOfDay:720});
    this.cameras.main.setBackgroundColor(0x34443a).setZoom(.82);
    onGround(this.add.rectangle(0,0,1800,1800,0x34443a));
    const boot=Object.create(BootScene.prototype) as BootScene;
    Object.assign(boot,{sys:this.sys,game:this.game,textures:this.textures,registry:this.registry,startupCancelled:false});
    await boot.prepareRegisteredSheets(sheets);
    this.sprites=new WorldSpriteSystem(this,this.physics.add.staticGroup());
    const player=this.add.image(0,140,'leigneron_idle',0).setScale(artScale('leigneron_idle')).setOrigin(.5,.975);
    player.setName('standing-player');
    for(const [texture,x] of [['npc_guard_idle',-100],['npc_villager_idle',100]] as const)
      this.add.image(x,140,texture,0).setScale(artScale(texture)).setOrigin(.5,1-2/ART_BY_KEY[texture].frameHeight);
    this.show('world_buildings',0);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>this.sprites.destroy());
    state.scene=this;state.ready=true;
  }
  show(texture:ArtTextureKey,frame:number,rotation=0){
    this.actor?.destroy();
    const example=WORLD_CONTENT.find(d=>d.kind==='settlement-prop'&&d.texture===texture&&d.frame===frame);
    const scale=(example&&'scale' in example?example.scale:undefined)??(texture==='royal_walls'?2:1.45);
    const origin=worldPropOrigin(texture,frame,'bottom');
    this.actor=this.add.image(0,0,texture,frame).setScale(artScale(texture)*scale).setOrigin(origin.x,origin.y).setName('review-building').setRotation(rotation);
    this.sprites.register(this.actor,texture,frame,scale,true);
    const house=(this.actor.getData(PRESENTATION_HINT) as PresentationHint).house!;
    return {width:this.actor.displayWidth*house.width,height:this.actor.displayHeight*house.height*(house.riseScale??1),
      rise:house.riseScale??1,floorLift:house.floorLift??0};
  }
  collision(texture:ArtTextureKey,frame:number,rotation=0){
    this.show(texture,frame,rotation);
    const width=(this.actor!.frame.customData as {visibleBounds:{width:number}}).visibleBounds.width;
    const worldWidth=width*ART_BY_KEY[texture].density*Math.abs(this.actor!.scaleX);
    const actor=this.actor!,hint=actor.getData(PRESENTATION_HINT) as PresentationHint,depth=hint.house!.depth*actor.displayWidth;
    const point=(x:number,y:number)=>({x:x*Math.cos(rotation)-y*Math.sin(rotation),y:x*Math.sin(rotation)+y*Math.cos(rotation)});
    return {frontLeft:this.sprites.blocksPoint(point(-worldWidth*.30,-10),4,4),
      rearLeft:this.sprites.blocksPoint(point(-worldWidth*.30,-depth*.7),4,4),
      passage:this.sprites.blocksPath(point(0,45),point(0,-depth-45),18,22),
      count:this.children.list.filter(o=>o.name==='ground:review-building').length};
  }
}
state.game=new Phaser.Game({type:Phaser.CANVAS,parent:'review',width:1280,height:720,audio:{noAudio:true},
  physics:{default:'arcade',arcade:{gravity:{x:0,y:0}}},scene:[ReviewScene],
  callbacks:{postBoot(game){const presentation=new ThreePresentation(game,document.querySelector('#review')!);
    state.orbit=(presentation as unknown as {orbit:typeof state.orbit}).orbit;}}});
