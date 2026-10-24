import {groundWorldView,onPlane,onGround,viewDirection,worldHeight,PRESENTATION_HINT,type PresentationHint} from '../presentation25d/plane';
import {coastalBoatShape,BOAT_DECK_RATIO} from '../presentation25d/CoastalBoatGeometry';
import Phaser from 'phaser';
import {setDepthIfChanged} from './renderDepth';
import {viewportChunks} from './chunkNeighborhood';
import {CHUNK_SIZE,WORLD_CHUNKS_WIDTH,WORLD_CHUNKS_HEIGHT} from '../../data/world';
import {seaRoute,routePosition,type TrafficRoute} from './travelRoutes';
import {trafficDirection} from './trafficMotion';
import {BOAT_SCALE,boatHelm,boatPassenger} from './VehicleArt';
import {ART_BY_KEY,actorScaleForHeight,type ArtTextureKey} from '../../data/art';
import type {WorldGenerator} from './WorldGenerator';
import type {GroundShadowSystem} from './GroundShadowSystem';
import {PORTS} from '../../data/ports';
import {useGameStore} from '../../store/gameStore';

export interface Vehicle {
  route:TrafficRoute;sprite:Phaser.GameObjects.Sprite;
  ground:{x:number;y:number;depth:number;presentationElevation:number};
  helmsman?:Phaser.GameObjects.Sprite;rail?:Phaser.GameObjects.Sprite;wake?:Phaser.GameObjects.Sprite[];
  scale?:number;passenger?:Phaser.GameObjects.Sprite;
  deckShadows?:Phaser.GameObjects.Image[];
}
/** Real artwork layers follow traveled distance. All attached actors unload together. */
export class WorldTrafficSystem {
  private readonly sea=new Map<string,TrafficRoute|null>();
  private readonly active=new Map<string,Vehicle>();
  private elapsed=0;
  private routes:TrafficRoute[]=[];
  private lastSeaBounds='';
  private readonly viewHeading={x:0,y:0};
  private readonly reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  constructor(private readonly scene:Phaser.Scene,private readonly world:WorldGenerator,private readonly shadows:GroundShadowSystem){
    if(!scene.textures.exists('vehicle-deck-shadow')){
      const texture=scene.textures.createCanvas('vehicle-deck-shadow',64,32)!,ctx=texture.getContext();
      ctx.translate(32,16);ctx.scale(1,.45);const gradient=ctx.createRadialGradient(0,0,0,0,0,30);
      gradient.addColorStop(0,'rgba(14,19,18,.6)');gradient.addColorStop(.4,'rgba(14,19,18,.3)');gradient.addColorStop(1,'rgba(14,19,18,0)');
      ctx.fillStyle=gradient;ctx.fillRect(-32,-32,64,64);texture.refresh();
    }
  }
  update(delta:number){
    this.elapsed+=Math.min(delta,100);
    const view=groundWorldView(this.scene);
    // Only recompute viewport cell sets after crossing an actual chunk edge.
    // Only sea traffic is streamed: horse-drawn roaming caravans are removed.
    const left=Math.max(0,Math.floor((view.x-500)/CHUNK_SIZE));
    const right=Math.min(WORLD_CHUNKS_WIDTH-1,Math.floor((view.right+500)/CHUNK_SIZE));
    const top=Math.max(0,Math.floor((view.y-500)/CHUNK_SIZE));
    const bottom=Math.min(WORLD_CHUNKS_HEIGHT-1,Math.floor((view.bottom+500)/CHUNK_SIZE));
    const bounds=left+':'+right+':'+top+':'+bottom;
    if(bounds!==this.lastSeaBounds){
      this.lastSeaBounds=bounds;
      const nearby=viewportChunks(view,500);
      for(const [key] of this.sea)if(!nearby.has(key))this.sea.delete(key);
      for(const key of nearby)if(!this.sea.has(key)){const [x,y]=key.split(':').map(Number);this.sea.set(key,seaRoute(this.world,x,y));}
      this.routes=[...this.sea.values()].filter((r):r is TrafficRoute=>Boolean(r));
    }
    const wanted=new Set<string>(),passageFrom=useGameStore.getState().passage?.from;
    for(const port of PORTS){
      if(passageFrom===port.id)continue;
      if(Math.abs(port.boat.x-view.centerX)>view.width/2+400||Math.abs(port.boat.y-view.centerY)>view.height/2+500)continue;
      const id='docked:'+port.id;wanted.add(id);let boat=this.active.get(id);
      if(!boat){boat=this.createVessel(id,port.boat.x,port.boat.y,port.river?.8:BOAT_SCALE);this.active.set(id,boat);}
      this.presentBoat(boat,port.boat.x,port.boat.y,0,-1,3,false);
    }
    for(const route of this.routes){
      const point=routePosition(route,this.elapsed);
      if(point.x<view.x-320||point.x>view.right+320||point.y<view.y-240||point.y>view.bottom+420)continue;
      wanted.add(route.id);
      let vehicle=this.active.get(route.id);
      if(!vehicle){vehicle=this.create(route,point.x,point.y);this.active.set(route.id,vehicle);}
      this.presentBoat(vehicle,point.x,point.y,point.dx,point.dy,trafficDirection(point.dx,point.dy),point.moving);
    }
    for(const [id,vehicle] of this.active)if(!wanted.has(id)){this.release(vehicle);this.active.delete(id);}
  }
  private create(route:TrafficRoute,x:number,y:number):Vehicle{
    const sprite=this.scene.add.sprite(x,y,'traffic-'+route.kind,0).setName(route.id),vehicle:Vehicle={route,sprite,ground:{x,y,depth:y,presentationElevation:0}};
      sprite.setScale(BOAT_SCALE).setOrigin(.5,364/384);
      this.shadows.register(sprite,false,{projection:.35,contactScale:.8});
      vehicle.helmsman=this.scene.add.sprite(x,y,'npc_adventurer_idle',0).setName('helmsman:'+route.id);
      vehicle.deckShadows=[this.scene.add.image(x,y,'vehicle-deck-shadow').setDisplaySize(30,12).setName('crew-shadow:'+route.id)];
      vehicle.rail=this.scene.add.sprite(x,y,'traffic-boat-rail',0).setScale(BOAT_SCALE).setOrigin(.5,364/384).setName('boat-rail:'+route.id);
      vehicle.wake=[0,1].map(i=>this.scene.add.sprite(x,y,'water-foam',0).setDepth(-970).setAlpha(.28-i*.08).setName('wake:'+route.id+':'+i));
      this.attachBoatLayer(vehicle,sprite,0);
      if(this.scene.game.registry.get('presentation')==='three-2.5d'){
        sprite.setData(PRESENTATION_HINT,{plane:'upright',furniture:coastalBoatShape()} satisfies PresentationHint);
        vehicle.rail.setVisible(false);
      }
      this.attachBoatLayer(vehicle,vehicle.helmsman,.8);this.attachBoatLayer(vehicle,vehicle.rail,1.6);
      for(const shadow of vehicle.deckShadows)this.attachBoatLayer(vehicle,shadow,.4);
      for(const wake of vehicle.wake)onGround(wake,.02);
    return vehicle;
  }
  createVessel(id:string,x:number,y:number,scale=BOAT_SCALE){
    const vehicle=this.create({id,kind:'boat',points:[{x,y},{x,y:y+1}],length:1,speed:1,phase:0},x,y);
    vehicle.scale=scale;return vehicle;
  }
  showPassenger(vehicle:Vehicle){
    vehicle.passenger=this.scene.add.sprite(0,0,'leigneron_idle',0).setName('passenger:'+vehicle.route.id);
    vehicle.deckShadows!.push(this.scene.add.image(0,0,'vehicle-deck-shadow').setDisplaySize(30,12).setName('passenger-shadow:'+vehicle.route.id));
    this.attachBoatLayer(vehicle,vehicle.passenger,1);
    this.attachBoatLayer(vehicle,vehicle.deckShadows![vehicle.deckShadows!.length-1],.4);
  }
  positionVessel(vehicle:Vehicle,x:number,y:number,dx:number,dy:number,moving=true){this.presentBoat(vehicle,x,y,dx,dy,trafficDirection(dx,dy),moving);}
  releaseVessel(vehicle:Vehicle){this.release(vehicle);}
  private presentBoat(vehicle:Vehicle,x:number,y:number,dx:number,dy:number,direction:number,moving:boolean){
    viewDirection(this.scene,dx,dy,this.viewHeading);
    direction=trafficDirection(this.viewHeading.x,this.viewHeading.y);
    const bob=this.reducedMotion.matches?0:Math.sin(this.elapsed*.0025+vehicle.route.phase)*1.6,helm=boatHelm(direction);
    const scale=vehicle.scale??BOAT_SCALE,ratio=scale/BOAT_SCALE;
    const spatial=this.scene.game.registry.get('presentation')==='three-2.5d',paintedY=y+(spatial?0:bob);
    const length=Math.max(.001,Math.hypot(dx,dy)),vx=dx/length,vy=dy/length;
    const heading=Math.atan2(dx,-dy),c=Math.cos(heading),s=Math.sin(heading),width=160*scale;
    vehicle.ground.x=x;vehicle.ground.y=y;vehicle.ground.depth=y;
    vehicle.ground.presentationElevation=spatial?width*BOAT_DECK_RATIO+bob:0;
    setDepthIfChanged(vehicle.sprite,y).setScale(scale).setFrame(spatial?0:direction).setPosition(x,paintedY);
    if(spatial){
      vehicle.sprite.setRotation(heading);
      (vehicle.sprite.getData(PRESENTATION_HINT) as PresentationHint).furniture!.lift=bob/width;
    }
    const crew=vehicle.helmsman!,texture:ArtTextureKey=direction===0?'npc_adventurer_idle':'npc_adventurer_directional_idle';
    // A helmsman stands aboard; use complete directional idle poses, not the
    // replaced six-column walking atlas (nor a frozen mid-stride contact).
    const frame=direction===0?Math.floor(this.elapsed/400)%6:direction===1?0:direction===2?4:8;
    setDepthIfChanged(crew,y+.02).setTexture(texture,frame).setScale(actorScaleForHeight(texture,frame,80))
      .setOrigin(.5,1-2/ART_BY_KEY[texture].frameHeight).setPosition(x+helm.x*ratio,paintedY+helm.y*ratio);
    if(spatial)crew.setPosition(x-width*.48*s,y+width*.48*c);
    const seat=boatPassenger(direction);
    if(vehicle.passenger){
      const side=direction===1||direction===2,texture=side?'leigneron_idle_sides':direction===3?'leigneron':'leigneron_idle',frame=direction===3?18:0;
      setDepthIfChanged(vehicle.passenger,y+.021).setTexture(texture,frame).setFlipX(direction===1)
        .setScale(actorScaleForHeight(texture,frame,80)).setOrigin(.5,1-2/ART_BY_KEY[texture].frameHeight)
        .setPosition(x+seat.x*ratio,paintedY+seat.y*ratio);
      if(spatial)vehicle.passenger.setPosition(x+width*.14*c+width*.22*s,y+width*.14*s-width*.22*c);
    }
    vehicle.deckShadows!.forEach((shadow,i)=>{
      const actor=i===0?crew:vehicle.passenger!;setDepthIfChanged(shadow,y+.01+i*.001).setPosition(actor.x,actor.y).setVisible(actor.visible);
      if(spatial)(shadow.getData(PRESENTATION_HINT) as PresentationHint).elevation=width*BOAT_DECK_RATIO+bob+.15;
    });
    setDepthIfChanged(vehicle.rail!,y+.03).setScale(scale).setFrame(direction).setPosition(x,paintedY);
    vehicle.wake!.forEach((wake,i)=>{
      const trail=130+i*60;
      wake.setVisible(moving).setFrame((Math.floor(this.elapsed/180)+i)%4).setScale(.65+i*.12)
        .setRotation(Math.atan2(dy,dx)+Math.PI/2).setPosition(x-vx*trail,y-vy*trail-12);
    });
  }
  private attachBoatLayer(vehicle:Vehicle,object:Phaser.GameObjects.Sprite|Phaser.GameObjects.Image,depth:number){
    const spatial=this.scene.game.registry.get('presentation')==='three-2.5d';
    const scene=this.scene;
    if(spatial&&depth===.4){
      object.setData(PRESENTATION_HINT,{plane:'ground',absoluteGround:true,elevation:0} satisfies PresentationHint);return;
    }
    // Crew feet occupy real deck positions. Sharing the boat's centre anchor
    // would rotate their offsets toward the camera while the hull stays fixed.
    const anchor=spatial?{get x(){return object.x;},get y(){return object.y;},get presentationElevation(){return vehicle.ground.presentationElevation-worldHeight(scene,object.x,object.y);}}:vehicle.ground;
    onPlane(object,'upright',anchor);
    (object.getData(PRESENTATION_HINT) as PresentationHint).depthOffset=depth;
  }
  private release(vehicle:Vehicle){
    vehicle.sprite.destroy();vehicle.helmsman?.destroy();vehicle.rail?.destroy();
    vehicle.wake?.forEach(wake=>wake.destroy());
    vehicle.passenger?.destroy();
    vehicle.deckShadows?.forEach(shadow=>shadow.destroy());
  }
  destroy(){for(const vehicle of this.active.values())this.release(vehicle);this.active.clear();this.sea.clear();}
}
