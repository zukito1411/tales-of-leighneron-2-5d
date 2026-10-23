import Phaser from 'phaser';
import type { Vec2 } from '../types';
import type { Enemy } from '../entities/Enemy';
import type { Npc } from '../entities/Npc';
import type { WorldScene } from '../scenes/WorldScene';
import {artScale} from '../../data/art';
import {onDirectionalSprite} from '../presentation25d/plane';

const MAX_PROJECTILES=8;
const SPEED=330;
const MAX_DISTANCE=780;
const MAX_AGE_MS=2600;
const PLAYER_HIT_RADIUS=22;

interface SpearFlight {
  sprite:Phaser.GameObjects.Image;
  sourceId:string;source:Enemy|null;target:Npc|null;damage:number;
  x:number;y:number;vx:number;vy:number;distance:number;age:number;maxDistance:number;maxAge:number;stone:boolean;
}

/** Shared fixed pool for spears and stones; shots never home or allocate trails. */
export class SpearProjectileSystem {
  private readonly pool:SpearFlight[]=[];
  constructor(private readonly scene:WorldScene) {}

  fire(source:Enemy,target:Vec2,npc:Npc|null=null){
    let flight=this.pool.find(item=>!item.sprite.active);
    if(!flight){
      if(this.pool.length>=MAX_PROJECTILES)return false;
      const sprite=this.scene.add.image(source.x,source.y,'enemy_spear_projectile',0)
        .setOrigin(.12,.5).setScale(artScale('enemy_spear_projectile')).setDepth(this.scene.playerRenderDepth(source.y)+2)
        .setVisible(false).setActive(false).setName(`enemy-projectile:${this.pool.length}`);
      flight={sprite,sourceId:'',source:null,target:null,damage:0,x:0,y:0,vx:0,vy:0,distance:0,age:0,maxDistance:MAX_DISTANCE,maxAge:MAX_AGE_MS,stone:false};this.pool.push(flight);
      const anchor=flight;
      onDirectionalSprite(sprite,{get x(){return anchor.stone?Math.cos(sprite.rotation):anchor.vx;},get y(){return anchor.stone?Math.sin(sprite.rotation):anchor.vy;}},
        {get x(){return anchor.x;},get y(){return anchor.y+26;}});
    }
    const dx=target.x-source.x,dy=target.y-source.y,length=Math.hypot(dx,dy);
    if(length<1)return false;
    flight.stone=source.definition.combatStyle==='stone-thrower';
    const texture=flight.stone?'enemy_goblin_stone':'enemy_spear_projectile';
    if(!this.scene.textures.exists(texture))return false;
    flight.sprite.setTexture(texture,0).setOrigin(flight.stone?.5:.12,.5).setScale(artScale(texture));
    flight.sourceId=source.instanceId;flight.source=source;flight.target=npc;flight.damage=source.definition.damage;
    flight.x=source.x+dx/length*14;flight.y=source.y-26+dy/length*3;
    // Aim from the actual hand/release position, not the source's feet. The
    // old vertical release offset could send horizontal throws above the hit circle.
    const aimX=target.x-flight.x,aimY=target.y-flight.y,aimLength=Math.max(1,Math.hypot(aimX,aimY));
    const speed=flight.stone?260:SPEED;
    flight.vx=aimX/aimLength*speed;flight.vy=aimY/aimLength*speed;flight.distance=0;flight.age=0;
    flight.maxDistance=flight.stone?600:MAX_DISTANCE;flight.maxAge=flight.stone?2400:MAX_AGE_MS;
    flight.sprite.setPosition(flight.x,flight.y).setRotation(Math.atan2(aimY,aimX)).setDepth(this.scene.playerRenderDepth(flight.y)+2).setVisible(true).setActive(true);
    return true;
  }

  update(delta:number){
    const player=this.scene.player;
    if(!player?.active)return;
    for(const flight of this.pool){
      if(!flight.sprite.active)continue;
      const victim=flight.target??player;
      if(!victim.active){this.deactivate(flight);continue;}
      const step=Math.min(Math.max(delta,0),50)/1000;
      const nextX=flight.x+flight.vx*step,nextY=flight.y+flight.vy*step;
      const segmentX=nextX-flight.x,segmentY=nextY-flight.y,lengthSq=segmentX*segmentX+segmentY*segmentY;
      const t=lengthSq?Phaser.Math.Clamp(((victim.x-flight.x)*segmentX+(victim.y-flight.y)*segmentY)/lengthSq,0,1):0;
      const gap=Math.hypot(victim.x-(flight.x+segmentX*t),victim.y-(flight.y+segmentY*t));
      if(gap<=PLAYER_HIT_RADIUS&&this.scene.hasClearPath(flight.x,flight.y,victim.x,victim.y,victim)){
        if(flight.target)this.scene.damageRoadNpc(flight.target,flight.damage);else this.scene.damagePlayer(flight.damage);
        this.scene.playEffect('hit',victim.x,victim.y,new Phaser.Math.Vector2(flight.vx,flight.vy).normalize());
        this.deactivate(flight);continue;
      }
      let blocked=!this.scene.hasClearPath(flight.x,flight.y,nextX,nextY,flight.source??undefined);
      const terrainSamples=Math.max(1,Math.ceil(Math.sqrt(lengthSq)/8));
      for(let sample=1;!blocked&&sample<=terrainSamples;sample++)
        blocked=!this.scene.isWalkable(flight.x+segmentX*sample/terrainSamples,flight.y+segmentY*sample/terrainSamples);
      if(blocked) {this.deactivate(flight);continue;}
      flight.x=nextX;flight.y=nextY;flight.distance+=Math.sqrt(lengthSq);flight.age+=Math.max(delta,0);
      flight.sprite.setPosition(nextX,nextY).setDepth(this.scene.playerRenderDepth(nextY)+2);
      if(flight.stone)flight.sprite.rotation+=step*7;
      if(flight.distance>=flight.maxDistance||flight.age>=flight.maxAge)this.deactivate(flight);
    }
  }

  forgetSource(instanceId:string){for(const flight of this.pool)if(flight.sprite.active&&flight.sourceId===instanceId)this.deactivate(flight);}
  clear(){for(const flight of this.pool)flight.sprite.destroy();this.pool.length=0;}
  private deactivate(flight:SpearFlight){flight.sprite.setVisible(false).setActive(false);flight.source=null;flight.target=null;}
}

