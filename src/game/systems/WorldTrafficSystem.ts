import {groundWorldView,onPlane,onGround,viewDirection,PRESENTATION_HINT,type PresentationHint} from '../presentation25d/plane';
import Phaser from 'phaser';
import {setDepthIfChanged} from './renderDepth';
import {viewportChunks,streamViewKey} from './chunkNeighborhood';
import {CHUNK_SIZE,WORLD_CHUNKS_WIDTH,WORLD_CHUNKS_HEIGHT} from '../../data/world';
import {cartRoutes,seaRoute,routePosition,type TrafficRoute} from './travelRoutes';
import {trafficDirection,trafficDistance,horseWalkFrame,wheelTurnFrame} from './trafficMotion';
import {BOAT_SCALE,boatHelm,boatPassenger,CART_ART_POSES} from './VehicleArt';
import {ART_BY_KEY,actorScaleForHeight,type ArtTextureKey} from '../../data/art';
import type {WorldGenerator} from './WorldGenerator';
import type {GroundShadowSystem} from './GroundShadowSystem';
import {PORTS} from '../../data/ports';
import {useGameStore} from '../../store/gameStore';
const HEADINGS=[[0,1],[-1,0],[1,0],[0,-1]] as const;

export interface Vehicle {
  route:TrafficRoute;sprite:Phaser.GameObjects.Sprite;
  ground:{x:number;y:number;depth:number;presentationElevation:number};
  horse?:Phaser.GameObjects.Sprite;wheels?:Phaser.GameObjects.Sprite[];
  helmsman?:Phaser.GameObjects.Sprite;rail?:Phaser.GameObjects.Sprite;wake?:Phaser.GameObjects.Sprite[];
  scale?:number;passenger?:Phaser.GameObjects.Sprite;
  deckShadows?:Phaser.GameObjects.Image[];
}
/** Real artwork layers follow traveled distance. All attached actors unload together. */
export class WorldTrafficSystem {
  private readonly roads:TrafficRoute[];
  private readonly roadBounds=new Map<string,{left:number;right:number;top:number;bottom:number}>();
  private readonly sea=new Map<string,TrafficRoute|null>();
  private readonly active=new Map<string,Vehicle>();
  private elapsed=0;
  private seaCenter='';private routes:TrafficRoute[];
  private lastSeaBounds='';
  private readonly viewHeading={x:0,y:0};
  private readonly reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  constructor(private readonly scene:Phaser.Scene,private readonly world:WorldGenerator,private readonly shadows:GroundShadowSystem){
    this.roads=cartRoutes(world);this.routes=this.roads;
    // Route bounds are immutable; reject distant merchants before the
    // expensive per-frame route-position interpolation.
    for(const route of this.roads){
      let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
      for(const pt of route.points){
        if(pt.x<left)left=pt.x;if(pt.x>right)right=pt.x;
        if(pt.y<top)top=pt.y;if(pt.y>bottom)bottom=pt.y;
      }
      this.roadBounds.set(route.id,{left,right,top,bottom});
    }
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
    // Merchant/boat positions still animate every frame at their original rate.
    const left=Math.max(0,Math.floor((view.x-500)/CHUNK_SIZE));
    const right=Math.min(WORLD_CHUNKS_WIDTH-1,Math.floor((view.right+500)/CHUNK_SIZE));
    const top=Math.max(0,Math.floor((view.y-500)/CHUNK_SIZE));
    const bottom=Math.min(WORLD_CHUNKS_HEIGHT-1,Math.floor((view.bottom+500)/CHUNK_SIZE));
    const bounds=left+':'+right+':'+top+':'+bottom;
    if(bounds!==this.lastSeaBounds){
      this.lastSeaBounds=bounds;
      const nearby=viewportChunks(view,500),center=streamViewKey(nearby);
      this.seaCenter=center;
      for(const [key] of this.sea)if(!nearby.has(key))this.sea.delete(key);
      for(const key of nearby)if(!this.sea.has(key)){const [x,y]=key.split(':').map(Number);this.sea.set(key,seaRoute(this.world,x,y));}
      this.routes=[...this.roads,...[...this.sea.values()].filter((r):r is TrafficRoute=>Boolean(r))];
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
      const bounds=this.roadBounds.get(route.id);
      if(bounds&&(bounds.right<view.x-320||bounds.left>view.right+320
        ||bounds.bottom<view.y-240||bounds.top>view.bottom+420))continue;
      const point=routePosition(route,this.elapsed);
      if(point.x<view.x-320||point.x>view.right+320||point.y<view.y-240||point.y>view.bottom+420)continue;
      wanted.add(route.id);
      let vehicle=this.active.get(route.id);
      if(!vehicle){vehicle=this.create(route,point.x,point.y);this.active.set(route.id,vehicle);}
      const direction=trafficDirection(point.dx,point.dy),distance=trafficDistance(route,this.elapsed);
      if(route.kind==='cart')this.presentCart(vehicle,point.x,point.y,direction,distance,point.moving);
      else this.presentBoat(vehicle,point.x,point.y,point.dx,point.dy,direction,point.moving);
    }
    for(const [id,vehicle] of this.active)if(!wanted.has(id)){this.release(vehicle);this.active.delete(id);}
  }
  private create(route:TrafficRoute,x:number,y:number):Vehicle{
    const sprite=this.scene.add.sprite(x,y,'traffic-'+route.kind,0).setName(route.id),vehicle:Vehicle={route,sprite,ground:{x,y,depth:y,presentationElevation:0}};
    if(route.kind==='cart'){
      sprite.setScale(.5);this.shadows.register(sprite);
      onPlane(sprite,'upright',sprite);
      vehicle.horse=this.scene.add.sprite(x,y,'horse-east',0).setScale(.5).setOrigin(.5,252/256).setName('horse:'+route.id);
      this.shadows.register(vehicle.horse);
      vehicle.wheels=[0,1].map(i=>this.scene.add.sprite(x,y,'cart-wheel-turns',0).setName('wheel:'+route.id+':'+i));
      vehicle.wheels.forEach(wheel=>this.shadows.register(wheel,false,{projection:.3,contactScale:.65,groundOffsetY:15}));
      for(const wheel of vehicle.wheels){
        onPlane(wheel,'upright',sprite);
        (wheel.getData(PRESENTATION_HINT) as PresentationHint).depthOffset=.6;
      }
      onPlane(vehicle.horse,'upright',sprite);
    }else{
      sprite.setScale(BOAT_SCALE).setOrigin(.5,364/384);
      this.shadows.register(sprite,false,{projection:.35,contactScale:.8});
      vehicle.helmsman=this.scene.add.sprite(x,y,'npc_adventurer_idle',0).setName('helmsman:'+route.id);
      vehicle.deckShadows=[this.scene.add.image(x,y,'vehicle-deck-shadow').setDisplaySize(30,12).setName('crew-shadow:'+route.id)];
      vehicle.rail=this.scene.add.sprite(x,y,'traffic-boat-rail',0).setScale(BOAT_SCALE).setOrigin(.5,364/384).setName('boat-rail:'+route.id);
      vehicle.wake=[0,1].map(i=>this.scene.add.sprite(x,y,'water-foam',0).setDepth(-970).setAlpha(.28-i*.08).setName('wake:'+route.id+':'+i));
      this.attachBoatLayer(vehicle,sprite,0);
      this.attachBoatLayer(vehicle,vehicle.helmsman,.8);this.attachBoatLayer(vehicle,vehicle.rail,1.6);
      for(const shadow of vehicle.deckShadows)this.attachBoatLayer(vehicle,shadow,.4);
      for(const wake of vehicle.wake)onGround(wake,.02);
    }
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
  private presentCart(vehicle:Vehicle,x:number,y:number,direction:number,distance:number,moving:boolean){
    const heading=HEADINGS[direction];
    viewDirection(this.scene,heading[0],heading[1],this.viewHeading);
    direction=trafficDirection(this.viewHeading.x,this.viewHeading.y);
    const pose=CART_ART_POSES[direction],horse=vehicle.horse!,side=direction===1||direction===2;
    // The route follows the center of the whole rigid train, so neither end
    // receives the entire lateral offset on a diagonal or narrow crossing.
    x-=pose.horse.x/2;y-=pose.horse.y/2;
    setDepthIfChanged(vehicle.sprite,y).setFrame(direction).setOrigin(pose.originX,pose.originY).setPosition(x,y);
    // Four perspective poses have authored harness offsets. Sampling a second
    // road point changes that joint on diagonals and disconnects the train.
    // Horse, wagon and wheels must share the same pose and registration.
    const horseTexture=side?'horse-east':direction===0?'horse-south':'horse-north';
    (horse.getData(PRESENTATION_HINT) as PresentationHint).depthOffset=direction===3?-.8:.8;
    setDepthIfChanged(horse,direction===3?y-.02:y+.02).setTexture(horseTexture,moving?horseWalkFrame(distance):0).setFlipX(direction===1)
      .setPosition(x+pose.horse.x,y+pose.horse.y);
    vehicle.wheels!.forEach((wheel,i)=>{
      const axle=pose.wheels[i];
      setDepthIfChanged(wheel,y+.01).setFrame(wheelTurnFrame(distance,direction)).setScale(side?.5:.14,.5)
        .setPosition(x+axle.x,y+axle.y);
    });
  }
  private presentBoat(vehicle:Vehicle,x:number,y:number,dx:number,dy:number,direction:number,moving:boolean){
    viewDirection(this.scene,dx,dy,this.viewHeading);
    direction=trafficDirection(this.viewHeading.x,this.viewHeading.y);
    const bob=this.reducedMotion.matches?0:Math.sin(this.elapsed*.0025+vehicle.route.phase)*1.6,helm=boatHelm(direction);
    const scale=vehicle.scale??BOAT_SCALE,ratio=scale/BOAT_SCALE;
    const spatial=this.scene.game.registry.get('presentation')==='three-2.5d',paintedY=y+(spatial?0:bob);
    vehicle.ground.x=x;vehicle.ground.y=y;vehicle.ground.depth=y;vehicle.ground.presentationElevation=spatial?bob:0;
    setDepthIfChanged(vehicle.sprite,y).setScale(scale).setFrame(direction).setPosition(x,paintedY);
    const crew=vehicle.helmsman!,texture:ArtTextureKey=direction===0?'npc_adventurer_idle':'npc_adventurer_directional_idle';
    // A helmsman stands aboard; use complete directional idle poses, not the
    // replaced six-column walking atlas (nor a frozen mid-stride contact).
    const frame=direction===0?Math.floor(this.elapsed/400)%6:direction===1?0:direction===2?4:8;
    setDepthIfChanged(crew,y+.02).setTexture(texture,frame).setScale(actorScaleForHeight(texture,frame,80))
      .setOrigin(.5,1-2/ART_BY_KEY[texture].frameHeight).setPosition(x+helm.x*ratio,paintedY+helm.y*ratio);
    const seat=boatPassenger(direction);
    if(vehicle.passenger){
      const side=direction===1||direction===2,texture=side?'leigneron_idle_sides':direction===3?'leigneron':'leigneron_idle',frame=direction===3?18:0;
      setDepthIfChanged(vehicle.passenger,y+.021).setTexture(texture,frame).setFlipX(direction===1)
        .setScale(actorScaleForHeight(texture,frame,80)).setOrigin(.5,1-2/ART_BY_KEY[texture].frameHeight)
        .setPosition(x+seat.x*ratio,paintedY+seat.y*ratio);
    }
    vehicle.deckShadows!.forEach((shadow,i)=>{
      const actor=i===0?crew:vehicle.passenger!;setDepthIfChanged(shadow,y+.01+i*.001).setPosition(actor.x,actor.y).setVisible(actor.visible);
    });
    setDepthIfChanged(vehicle.rail!,y+.03).setScale(scale).setFrame(direction).setPosition(x,paintedY);
    const length=Math.max(.001,Math.hypot(dx,dy)),vx=dx/length,vy=dy/length;
    vehicle.wake!.forEach((wake,i)=>{
      const trail=130+i*60;
      wake.setVisible(moving).setFrame((Math.floor(this.elapsed/180)+i)%4).setScale(.65+i*.12)
        .setRotation(Math.atan2(dy,dx)+Math.PI/2).setPosition(x-vx*trail,y-vy*trail-12);
    });
  }
  private attachBoatLayer(vehicle:Vehicle,object:Phaser.GameObjects.Sprite|Phaser.GameObjects.Image,depth:number){
    onPlane(object,'upright',vehicle.ground);
    (object.getData(PRESENTATION_HINT) as PresentationHint).depthOffset=depth;
  }
  private release(vehicle:Vehicle){
    vehicle.sprite.destroy();vehicle.horse?.destroy();vehicle.helmsman?.destroy();vehicle.rail?.destroy();
    vehicle.wheels?.forEach(wheel=>wheel.destroy());vehicle.wake?.forEach(wake=>wake.destroy());
    vehicle.passenger?.destroy();
    vehicle.deckShadows?.forEach(shadow=>shadow.destroy());
  }
  destroy(){for(const vehicle of this.active.values())this.release(vehicle);this.active.clear();this.sea.clear();}
}
