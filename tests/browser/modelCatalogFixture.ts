import Phaser from 'phaser';
import {ThreePresentation} from '../../src/game/presentation25d/ThreePresentation';
import {PAINTED_MODEL_ATLASES} from '../../src/game/presentation25d/PaintedMaterials';
import {ART_SHEETS,ART_BY_KEY,worldPropOrigin,type ArtTextureKey} from '../../src/data/art';
import {INTERIOR_ART,type InteriorArtKey} from '../../src/data/interiorArt';
import {roomPlan} from '../../src/data/interiors';
import {interiorFloorSurfaces} from '../../src/game/systems/interiorFloorSurfaces';
import {InteriorSession} from '../../src/game/systems/InteriorSession';
import {BootScene} from '../../src/game/scenes/BootScene';
import {WorldSpriteSystem} from '../../src/game/systems/WorldSpriteSystem';
import {DayNightSystem} from '../../src/game/systems/DayNightSystem';
import {useGameStore} from '../../src/store/gameStore';
import {onGround,onOverlay,onFurniture,PRESENTATION_HINT,type PresentationHint} from '../../src/game/presentation25d/plane';

const query=new URLSearchParams(location.search),kind=query.get('kind')??'interior',kit=query.get('kit')??'trandum_rustic';
const key=(query.get('sheet')??'woodland_props') as ArtTextureKey,part=Number(query.get('part')??0),night=query.get('night')==='1';
const state={ready:false,error:'',yaw:0,game:undefined as unknown as Phaser.Game,scene:undefined as unknown as Phaser.Scene,
  focus:{x:0,y:0},actors:[] as Phaser.GameObjects.Image[],report:[] as Array<{name:string;art:string;vertices?:number}>,
  orbit:undefined as unknown as {yaw:number;targetYaw:number;pitch:number;targetPitch:number},
  destroy(){state.game.destroy(true);}};
declare global {interface Window {__modelCatalogReview:typeof state}}
window.__modelCatalogReview=state;
document.querySelector('#title')!.textContent=[kind,kind==='world'?key:kit,night?'night':'day',part].join(' / ');

interface SessionAuthor {
  prepareArt():Generator<void,void>;renderWalls():void;
  drawArt(art:InteriorArtKey,x:number,y:number,width:number,depth:number):Phaser.GameObjects.Image;
}
class ReviewScene extends Phaser.Scene {
  get inInterior(){return kind!=='world';}
  readonly presentationFocus=state.focus;
  readonly presentationControlsEnabled=false;
  private lighting!:DayNightSystem;private sprites?:WorldSpriteSystem;
  get presentationLighting(){return this.lighting;}
  addInteriorLight(actor:Phaser.GameObjects.Image,art:string){this.lighting.registerInterior(actor,art);}
  addInteriorFurnitureContact(actor:Phaser.GameObjects.Image,w:number,d:number){return this.add.rectangle(actor.x,actor.y,w,d,0,0);}
  preload(){
    this.load.setBaseURL('/');
    for(const atlas of PAINTED_MODEL_ATLASES)this.load.image(atlas.key,atlas.path);
    if(kind==='world'){
      const sheet=ART_BY_KEY[key];if(!sheet)throw new Error('Unknown gallery sheet '+key);
      for(const path of new Set([sheet.path,...(sheet.sources?.map(source=>source.path)??[])]))this.load.image('source:'+path,path);
    }else this.load.image('interior-source',`assets/interiors/${kit}/kit.png`);
  }
  create(){void this.prepare().catch(error=>{state.error=String(error);console.error(error);});}
  private async prepare(){
    useGameStore.setState({minuteOfDay:night?180:720,day:3});
    this.lighting=new DayNightSystem(this);this.lighting.setFirefliesEnabled(false);
    this.cameras.main.setBackgroundColor(0x34443a).setZoom(.85);
    onGround(this.add.rectangle(0,0,2400,2200,0x34443a));
    const labels:Phaser.GameObjects.Text[]=[];
    const label=(actor:Phaser.GameObjects.Image,name:string)=>{
      const text=onOverlay(this.add.text(actor.x,actor.y+18,name,{fontSize:'11px',color:'#f1e6c7',backgroundColor:'#26342f'}).setOrigin(.5,0));labels.push(text);
    };
    if(kind==='world'){
      const sheets=ART_SHEETS.filter(sheet=>sheet.key===key);
      // Keep the scene prototype's private state out of the inferred type:
      // intersecting a public object with private startupCancelled reduced the
      // whole result to never and blocked both browser and Android builds.
      const boot=Object.create(BootScene.prototype) as BootScene;
      Object.assign(boot,{sys:this.sys,game:this.game,textures:this.textures,registry:this.registry,startupCancelled:false});
      await boot.prepareRegisteredSheets(sheets);
      this.sprites=new WorldSpriteSystem(this,this.physics.add.staticGroup());
      const sheet=ART_BY_KEY[key],building=/buildings|villas|world_objects/.test(key);
      const frames=Array.from({length:sheet.columns},(_,i)=>i).slice(building?part*4:0,building?(part+1)*4:sheet.columns);
      let index=0;
      for(const frame of frames){
        const actor=this.add.image(0,0,key,frame),meta=actor.frame.customData as {visibleBounds:{width:number}};
        const scale=(building?220:110)/meta.visibleBounds.width,origin=worldPropOrigin(key,frame,'bottom');
        actor.setOrigin(origin.x,origin.y).setScale(scale/sheet.density).setName('catalog:'+key+':'+frame);
        this.sprites.register(actor,key,frame,scale,false);
        const hint=actor.getData(PRESENTATION_HINT) as PresentationHint;
        if(!hint.furniture&&!hint.house){actor.destroy();continue;}
        const columns=building?2:4,spacing=building?440:180;
        actor.setPosition((index%columns-(columns-1)/2)*spacing,Math.floor(index/columns)*(building?480:240)-(building?170:260));
        state.actors.push(actor);const name=sheet.names?.[frame]??String(frame);
        state.report.push({name,art:hint.furniture?.art??hint.house!.profile.id});label(actor,name);index++;
      }
    }else{
      const author=Object.assign(Object.create(InteriorSession.prototype) as SessionAuthor,{scene:this,objects:[],origin:{x:0,y:0},entry:{kit,profile:query.get('profile')??'castle'},wallSolids:[]});
      for(const _step of author.prepareArt()){ /* Production isolated atlas. */ }
      if(kind==='room'){
        const profile=query.get('profile')==='inn'?'inn':'castle',plan=roomPlan(true,profile==='inn'?'Marrow Inn':'Crown Hall',profile,kit);
        Object.assign(author,{plan});
        for(const floor of interiorFloorSurfaces(plan.floors))onGround(this.add.tileSprite(floor.x,floor.y,floor.width,floor.height,'interior-floor').setOrigin(0).setTilePosition(floor.x,floor.y));
        for(const object of plan.objects)author.drawArt(object.art,object.x,object.y,object.width,object.y);
        author.renderWalls();
        for(const room of plan.rooms)author.drawArt('lantern',room.x+65,room.y+100,40,room.y+100);
        state.focus.x=profile==='castle'?690:550;state.focus.y=profile==='castle'?1000:490;
        this.cameras.main.setZoom(1.25);
        state.report.push({name:profile+' rooms',art:'floor-union-walls'});
      }else{
        const arts=Object.keys(INTERIOR_ART).filter(art=>!['northWall','sideWall','rug'].includes(art)) as InteriorArtKey[];
        for(const [i,art] of arts.entries()){
          const actor=author.drawArt(art,(i%5-2)*150,(Math.floor(i/5)-1.5)*200,100,i);
          state.actors.push(actor);state.report.push({name:art,art});label(actor,art);
        }
      }
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{this.sprites?.destroy();this.lighting.destroy();});
    state.scene=this;state.ready=true;
  }
  update(){if(state.ready){state.orbit.yaw=state.orbit.targetYaw=state.yaw;this.lighting.update(0,state.focus.x,state.focus.y);}}
}
state.game=new Phaser.Game({type:Phaser.CANVAS,parent:'review',width:1600,height:1000,audio:{noAudio:true},physics:{default:'arcade',arcade:{gravity:{x:0,y:0}}},scene:[ReviewScene],
  callbacks:{postBoot(game){const presentation=new ThreePresentation(game,document.querySelector('#review')!);state.orbit=(presentation as unknown as {orbit:typeof state.orbit}).orbit;}}});
