import Phaser from 'phaser';
import {ThreePresentation} from '../../src/game/presentation25d/ThreePresentation';
import {PAINTED_MODEL_ATLASES} from '../../src/game/presentation25d/PaintedMaterials';
import {onFurniture,onGround} from '../../src/game/presentation25d/plane';
import {InteriorSession} from '../../src/game/systems/InteriorSession';

/** Visual review for furnished interiors only. Traveling horses and roaming
 * merchant carts are deliberately absent from gameplay and this fixture. */
interface ReviewHandle {
  game:Phaser.Game;ready:boolean;scene?:Phaser.Scene;
  yaw:number;orbit?:{yaw:number;targetYaw:number;pitch:number;targetPitch:number};
}
declare global {interface Window {__propStyleReview:ReviewHandle}}
const review:ReviewHandle={game:undefined as unknown as Phaser.Game,ready:false,yaw:0};
window.__propStyleReview=review;

class ReviewScene extends Phaser.Scene {
  readonly inInterior=true;
  readonly presentationFocus={x:0,y:20};
  preload(){
    this.load.setBaseURL('/');
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR,(file:Phaser.Loader.File)=>console.error('Review asset failed: '+file.src));
    for(const atlas of PAINTED_MODEL_ATLASES)this.load.image(atlas.key,atlas.path);
    this.load.image('interior-source','assets/interiors/trandum_rustic/kit.png');
  }
  create(){
    // Review the same production furniture preparation, not synthetic art.
    const interior=Object.assign(Object.create(InteriorSession.prototype) as {prepareArt():Generator<void,void>},{scene:this});
    for(const _step of interior.prepareArt()){ /* Offline-sized review atlas. */ }
    this.cameras.main.setBackgroundColor(0x34443a).setZoom(this.scale.width<1000?.65:1).centerOn(0,20);
    onGround(this.add.rectangle(0,0,1800,1500,0x34443a));
    for(const [i,art] of (['chest','openChest','table','chair','bench','barrel'] as const).entries()){
      const source=art==='openChest'?'chest':art;
      const image=this.add.image((i-2.5)*145,160,'interior-furniture',source).setOrigin(.5,252/256).setScale(.54);
      onFurniture(image,art,'trandum_rustic');image.setName('review:'+art).setData('reviewGroup','core');
    }
    for(const [i,art] of (['counter','pantry','bookcase'] as const).entries()){
      const image=this.add.image((i-1)*220,80,'interior-furniture',art).setOrigin(.5,252/256).setScale(.9);
      onFurniture(image,art,'trandum_rustic');image.setName('review:'+art).setData('reviewGroup','detail').setVisible(false);
    }
    review.scene=this;review.ready=true;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{review.scene=undefined;review.ready=false;});
  }
  update(){
    if(review.orbit)review.orbit.yaw=review.orbit.targetYaw=review.yaw;
  }
}
review.game=new Phaser.Game({type:Phaser.CANVAS,parent:'review',width:1280,height:800,
  scale:{mode:Phaser.Scale.RESIZE},audio:{noAudio:true},scene:[ReviewScene],
  callbacks:{postBoot(game){
    const presentation=new ThreePresentation(game,document.getElementById('review')!);
    review.orbit=(presentation as unknown as {orbit:NonNullable<ReviewHandle['orbit']>}).orbit;
  }}});
