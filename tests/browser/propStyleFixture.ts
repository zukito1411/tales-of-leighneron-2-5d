import Phaser from 'phaser';
import {ThreePresentation} from '../../src/game/presentation25d/ThreePresentation';
import {PAINTED_MODEL_ATLASES} from '../../src/game/presentation25d/PaintedMaterials';
import {onFurniture,onGround,PRESENTATION_HINT,type PresentationHint} from '../../src/game/presentation25d/plane';
import {travelCartShape,travelHorseShape} from '../../src/game/presentation25d/TravelCartGeometry';
import {WorldTrafficSystem,type Vehicle} from '../../src/game/systems/WorldTrafficSystem';
import {VEHICLE_ART,MOTION_ART,prepareVehicleArt} from '../../src/game/systems/VehicleArt';
import {trafficDirection} from '../../src/game/systems/trafficMotion';
import {InteriorSession} from '../../src/game/systems/InteriorSession';

interface ReviewTraffic {
  create(route:Vehicle['route'],x:number,y:number):Vehicle;
  presentCart(vehicle:Vehicle,x:number,y:number,direction:number,distance:number,moving:boolean,dx:number,dy:number):void;
  release(vehicle:Vehicle):void;
}
interface ReviewHandle {
  game:Phaser.Game;ready:boolean;dx:number;dy:number;moving:boolean;animate:boolean;distance:number;
  yaw:number;vehicles:Vehicle[];scene?:Phaser.Scene;
  orbit?:{yaw:number;targetYaw:number;pitch:number;targetPitch:number};
}
declare global {interface Window {__propStyleReview:ReviewHandle}}
const review:ReviewHandle={game:undefined as unknown as Phaser.Game,ready:false,dx:0,dy:1,moving:true,animate:false,distance:0,yaw:0,vehicles:[]};
window.__propStyleReview=review;

class ReviewScene extends Phaser.Scene {
  readonly inInterior=true;
  readonly presentationFocus={x:0,y:20};
  private traffic!:ReviewTraffic;
  preload(){
    this.load.setBaseURL('/');
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR,(file:Phaser.Loader.File)=>console.error('Review asset failed: '+file.src));
    this.load.image('vehicle-source:boat',VEHICLE_ART.boat.path);
    for(const [key,path] of Object.entries(MOTION_ART))this.load.image('motion-source:'+key,path);
    for(const atlas of PAINTED_MODEL_ATLASES)this.load.image(atlas.key,atlas.path);
    this.load.image('interior-source','assets/interiors/trandum_rustic/kit.png');
  }
  create(){
    prepareVehicleArt(this);
    // Exercise the production room preparation, not a parallel cropper.
    const interior=Object.assign(Object.create(InteriorSession.prototype) as {prepareArt():Generator<void,void>},{scene:this});
    for(const _step of interior.prepareArt()){ /* Offline-sized review atlas. */ }
    this.cameras.main.setBackgroundColor(0x34443a).setZoom(this.scale.width<1000?.65:1).centerOn(0,20);
    onGround(this.add.rectangle(0,0,1800,1500,0x34443a));
    this.traffic=Object.assign(Object.create(WorldTrafficSystem.prototype) as ReviewTraffic,{
      scene:this,cartModel:travelCartShape(),horseModels:[0,1,2,3].map(travelHorseShape),viewHeading:{x:0,y:0},shadows:{register(){}}});
    for(let i=0;i<4;i++){
      const x=(i-1.5)*270,y=-160;
      review.vehicles.push(this.traffic.create({id:'review-cart:'+i,kind:'cart',points:[{x,y},{x,y:y+1000}],length:1000,speed:48,phase:0},x,y));
    }
    for(const [i,art] of (['chest','openChest','table','chair','bench','barrel'] as const).entries()){
      const source=art==='openChest'?'chest':art;
      const image=this.add.image((i-2.5)*145,230,'interior-furniture',source).setOrigin(.5,252/256).setScale(.54);
      onFurniture(image,art,'trandum_rustic');image.setName('review:'+art).setData('reviewGroup','core');
    }
    for(const [i,art] of (['counter','pantry','bookcase'] as const).entries()){
      const image=this.add.image((i-1)*220,80,'interior-furniture',art).setOrigin(.5,252/256).setScale(.9);
      onFurniture(image,art,'trandum_rustic');image.setName('review:'+art).setData('reviewGroup','detail').setVisible(false);
    }
    review.scene=this;review.ready=true;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{for(const vehicle of review.vehicles)this.traffic.release(vehicle);review.vehicles.length=0;});
  }
  update(_time:number,delta:number){
    if(!review.ready)return;
    if(review.animate)review.distance+=Math.min(delta,100)*.048;
    if(review.orbit){review.orbit.yaw=review.orbit.targetYaw=review.yaw;}
    for(const [i,vehicle] of review.vehicles.entries())this.traffic.presentCart(vehicle,(i-1.5)*270,-160,
      trafficDirection(review.dx,review.dy),review.distance+i*11,review.moving,review.dx,review.dy);
  }
}
review.game=new Phaser.Game({type:Phaser.CANVAS,parent:'review',width:1280,height:800,
  scale:{mode:Phaser.Scale.RESIZE},audio:{noAudio:true},scene:[ReviewScene],
  callbacks:{postBoot(game){
    const presentation=new ThreePresentation(game,document.getElementById('review')!);
    review.orbit=(presentation as unknown as {orbit:NonNullable<ReviewHandle['orbit']>}).orbit;
  }}});

export function horseReport(){return review.vehicles.map(vehicle=>({
  texture:vehicle.horse!.texture.key,frame:vehicle.horse!.frame.name,flip:vehicle.horse!.flipX,
  rotation:vehicle.horse!.rotation,hint:vehicle.horse!.getData(PRESENTATION_HINT) as PresentationHint,
  pose:(vehicle.horse!.getData(PRESENTATION_HINT) as PresentationHint).furniture?.pose,
  x:vehicle.horse!.x,y:vehicle.horse!.y,cartX:vehicle.sprite.x,cartY:vehicle.sprite.y,
  wheel:(vehicle.sprite.getData(PRESENTATION_HINT) as PresentationHint).wheelAngle,
}));}
