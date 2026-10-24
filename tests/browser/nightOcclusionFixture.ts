import Phaser from 'phaser';
import {ThreePresentation} from '../../src/game/presentation25d/ThreePresentation';
import {DayNightSystem} from '../../src/game/systems/DayNightSystem';
import {useGameStore} from '../../src/store/gameStore';
import {setGraphicEffect} from '../../src/game/systems/graphicsEffects';
import {onGround,onPlane,PRESENTATION_HINT,projectWorldPoint} from '../../src/game/presentation25d/plane';
import {presentedPixel} from './presentationProbe';

const state={ready:false,wall:true,light:true,game:undefined as unknown as Phaser.Game,scene:undefined as unknown as Phaser.Scene,
  orbit:undefined as unknown as {yaw:number;targetYaw:number;pitch:number;targetPitch:number},
  async pixel(offset=0){const p={x:0,y:0};projectWorldPoint(state.scene,offset,80,0,p);return presentedPixel(state.game,p.x*state.scene.cameras.main.zoom,p.y*state.scene.cameras.main.zoom);}};
declare global {interface Window {__nightOcclusionReview:typeof state}}
window.__nightOcclusionReview=state;

class ReviewScene extends Phaser.Scene {
  readonly presentationFocus={x:-220,y:0};
  readonly presentationControlsEnabled=false;
  private lighting!:DayNightSystem;
  private lamp!:Phaser.GameObjects.Sprite;private wall!:Phaser.GameObjects.Image;
  get presentationLighting(){return this.lighting;}
  create(){
    useGameStore.setState({minuteOfDay:0,day:1});
    setGraphicEffect('lightBloom',true);setGraphicEffect('nightDarkness',true);
    setGraphicEffect('sunRays',false);setGraphicEffect('depthOfField',false);setGraphicEffect('depthHaze',false);setGraphicEffect('cinematicColor',false);
    this.cameras.main.setBackgroundColor(0x18201c).setZoom(1).centerOn(-220,0);
    onGround(this.add.image(0,0,'__WHITE').setDisplaySize(1800,1800).setTint(0x66735c));
    // Intentional test emitter/occluder: use the production world planes,
    // DayNightSystem registration, GPU night mask and overlay compositor.
    this.lighting=new DayNightSystem(this);this.lighting.setFirefliesEnabled(false);
    this.lamp=onPlane(this.add.sprite(0,0,'__WHITE').setOrigin(.5,1).setDisplaySize(12,110).setTint(0xffb94b),'upright');
    this.lighting.register(this.lamp,'others',0,1);
    const light=this.lighting.gpuLights().next().value!;light.x=0;light.y=-80;light.radius=90;light.glow.setDisplaySize(180,180);
    this.wall=this.add.image(0,130,'__WHITE').setOrigin(.5,1).setDisplaySize(260,260).setTint(0x8e6641);
    this.wall.setData(PRESENTATION_HINT,{plane:'upright',wall:{axis:'x',thickness:.04}});
    state.scene=this;state.ready=true;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>this.lighting.destroy());
  }
  update(){
    if(!state.ready)return;
    state.orbit.yaw=state.orbit.targetYaw=0;state.orbit.pitch=state.orbit.targetPitch=.60;
    this.wall.setVisible(state.wall);this.lamp.setVisible(state.light);
    this.lighting.update(0,-220,0);
  }
}
state.game=new Phaser.Game({type:Phaser.CANVAS,parent:'review',width:1280,height:800,audio:{noAudio:true},scene:[ReviewScene],
  callbacks:{postBoot(game){const presentation=new ThreePresentation(game,document.querySelector('#review')!);state.orbit=(presentation as unknown as {orbit:typeof state.orbit}).orbit;}}});
