import Phaser from 'phaser';
import type {EnemyDefinition} from '../types';
import type {WorldScene} from '../scenes/WorldScene';
import {enemyAudioCue,enemyVoice,type EnemySoundCue} from '../../data/enemyAudio';
import {useGameStore} from '../../store/gameStore';
import {dragonEffectPlayback} from './dragonAudio';
import {viewDirection} from '../presentation25d/plane';
export type {EnemySoundCue} from '../../data/enemyAudio';
const volumes:Record<EnemySoundCue,number>={attack:.24,growl:.13,hurt:.23,death:.27};
type Playing={sound:Phaser.Sound.BaseSound;cue:string;x:number;y:number;volume:number;radius:number;
 owner?:{x:number;y:number;active:boolean};};
/** Owned, spatial clips stop with their actor. No delayed echoes survive a
 * pause, death, unload, or a new attack phase. */
export class EnemySoundSystem {
 private readonly voices=new Map<string,Playing>();
 private readonly effects=new Map<string,Playing>();
 private readonly lastHurt=new Map<string,number>();
 private paused=false;
 private nextSpatialAt=0;
 private readonly relative={x:0,y:0};
 constructor(private readonly scene:WorldScene){}
 play(enemy:EnemyDefinition,instanceId:string,cue:EnemySoundCue,x:number,y:number){
  const now=this.scene.time.now;
  if(cue==='hurt'&&now-(this.lastHurt.get(instanceId)??-Infinity)<180)return;
  const current=this.voices.get(instanceId);
  if(current&&(current.cue==='death'||cue==='growl'||current.cue===cue))return;
  const profile=enemyAudioCue(enemy,cue);
  if(cue==='hurt')this.lastHurt.set(instanceId,now);
  if(cue==='death')this.stopEffect(instanceId);
  this.start(this.voices,instanceId,cue,profile.key,x,y,volumes[cue]*profile.gain,
   profile.rate,profile.maxDuration,enemyVoice(enemy)==='dragon'?1500:1050);
 }
 playEffect(instanceId:string,cue:'roar'|'breath'|'flight',x:number,y:number,duration:number){
  const key=cue==='roar'?'sfx-enemy-dragon-deep-roar':cue==='breath'?'sfx-enemy-dragon-fire-breath':'sfx-enemy-dragon-fly';
  if(!this.scene.cache.audio.exists(key))return;
  const buffer=this.scene.cache.audio.get(key) as AudioBuffer;
  const playback=dragonEffectPlayback(cue,duration,buffer.duration);
  this.start(this.effects,instanceId,cue,key,x,y,cue==='roar'?.32:cue==='breath'?.42:.5,1,
   playback.duration,cue==='flight'?2200:1500,playback.loop,`${instanceId}:${cue}`);
 }
 private start(collection:Map<string,Playing>,instanceId:string,cue:string,key:string,x:number,y:number,volume:number,rate:number,duration:number,radius:number,loop=false,storageKey=instanceId){
  const scene=this.scene,player=scene.player;
  if(this.paused||!useGameStore.getState().weatherAudio||scene.sound.locked||!player?.active||!scene.cache.audio.exists(key))return;
  const distance=Math.hypot(player.x-x,player.y-y);if(distance>=radius)return;
  const old=collection.get(storageKey);if(old){collection.delete(storageKey);old.sound.destroy();}
  // Limit overlapping pack voices and audio nodes.
  if(this.voices.size+this.effects.size>=10&&cue==='growl')return;
  if(this.voices.size+this.effects.size>=14){
   const oldest=this.voices.size?this.voices:this.effects,first=oldest.entries().next().value;
   if(first){oldest.delete(first[0]);first[1].sound.destroy();}
  }
  const pan=this.pan(x,y,radius);
  const buffer=scene.cache.audio.get(key) as AudioBuffer;
  const length=Math.min(duration,buffer.duration??duration);
  const sound=scene.sound.add(key);
  const owner=scene.getCombatEnemies().find(enemy=>enemy.instanceId===instanceId&&enemy.active);
  const playing:Playing={sound,cue,x,y,volume,radius,owner};collection.set(storageKey,playing);
  const config={volume:Math.min(.55,volume*Math.pow(1-distance/radius,1.35)),rate,pan,loop};
  if(!loop)sound.addMarker({name:'cue',start:0,duration:length,config});
  sound.once('complete',()=>{if(collection.get(storageKey)===playing)collection.delete(storageKey);sound.destroy();});
  if(!(loop?sound.play(config):sound.play('cue'))){collection.delete(storageKey);sound.destroy();}
 }
 /** Project the source/listener offset onto the same camera-right direction
  * used by actor facing and movement. Orbit zoom never changes the audio range. */
 private pan(x:number,y:number,radius:number){
  const player=this.scene.player;
  viewDirection(this.scene,x-player.x,y-player.y,this.relative);
  return Phaser.Math.Clamp(this.relative.x/Math.max(128,radius*.45),-1,1);
 }
 update(time:number){
  if(!useGameStore.getState().weatherAudio){this.clear();return;}
  if(this.paused||!this.scene.player?.active||time<this.nextSpatialAt)return;
  this.nextSpatialAt=time+80;
  // Reuse the bounded playing-channel maps. No world scan, extra timer, audio
  // node creation or React/store update is needed when the camera rotates.
  for(const collection of [this.voices,this.effects])for(const playing of collection.values()){
   if(playing.owner?.active){playing.x=playing.owner.x;playing.y=playing.owner.y;}
   else playing.owner=undefined;
   const distance=Math.hypot(this.scene.player.x-playing.x,this.scene.player.y-playing.y);
   const volume=Math.min(.55,playing.volume*Math.pow(Math.max(0,1-distance/playing.radius),1.35));
   const sound=playing.sound;
   if(sound instanceof Phaser.Sound.WebAudioSound||sound instanceof Phaser.Sound.HTML5AudioSound){
    sound.setPan(this.pan(playing.x,playing.y,playing.radius));sound.setVolume(volume);
   }
  }
 }
 pause(paused:boolean){
  if(!useGameStore.getState().weatherAudio){this.clear();this.paused=paused;return;}
  if(this.paused===paused)return;this.paused=paused;this.nextSpatialAt=0;
  for(const {sound} of [...this.voices.values(),...this.effects.values()])if(paused)sound.pause();else sound.resume();
 }
 stopEffect(instanceId:string,cue?:'roar'|'breath'|'flight'){
  const keys=cue?[`${instanceId}:${cue}`]:(['roar','breath','flight'] as const).map(effect=>`${instanceId}:${effect}`);
  for(const key of keys){const playing=this.effects.get(key);if(playing){this.effects.delete(key);playing.sound.destroy();}}
 }
 forget(instanceId:string){
  const p=this.voices.get(instanceId);
  // Defeat immediately removes the gameplay actor; let its one-shot death
  // finish alongside the corpse/retreat visual, then release it on completion.
  if(p?.cue!=='death'){this.voices.delete(instanceId);p?.sound.destroy();}
  else{if(p.owner){p.x=p.owner.x;p.y=p.owner.y;}p.owner=undefined;}
  this.stopEffect(instanceId);this.lastHurt.delete(instanceId);
 }
 private clear(){for(const p of this.voices.values())p.sound.destroy();for(const p of this.effects.values())p.sound.destroy();this.voices.clear();this.effects.clear();}
 destroy(){this.clear();this.lastHurt.clear();}
}
