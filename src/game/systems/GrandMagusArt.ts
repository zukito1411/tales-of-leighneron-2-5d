import Phaser from 'phaser';
import {ART_BY_KEY} from '../../data/art';
import {GRAND_MAGUS_SPELL_TEXTURE,type M14ArtSpec} from '../../data/m14Art';
import {actorSpriteGridSubjects,type ActorSpriteSubject} from './spriteComponents';
import {spriteSubjectCanvas} from './spriteArt';
import {isolateAtlasFrames} from './AtlasFrameIsolation';
import type {Enemy} from '../entities/Enemy';
import registration from '../../data/grandMagusAtlas.json';

/** Full authored poses, registered once on demand. One shared body scale for
 * all directions and actions; bat dispersal has its own expanding silhouette. */
export function prepareGrandMagusArt(scene:Phaser.Scene,spec:M14ArtSpec,preparedSpells?:ActorSpriteSubject[]){
  const image=scene.textures.get(`m14-source:${spec.id}:atlas`).getSourceImage() as HTMLImageElement;
  if(image.width!==registration.width||image.height!==registration.height)throw new Error('Magus atlas registration does not match its artwork');
  const texture=scene.textures.addImage(spec.texture,image)!;
  for(const [id,entry] of Object.entries(registration.frames)){
    const [x,y,w,h]=entry.rect,[fw,fh,tx,ty,tw,th]=entry.trim;
    const frame=texture.add(Number(id),0,x,y,w,h)!;
    frame.setTrim(fw,fh,tx,ty,tw,th);
    frame.customData={fullSprite:true,isolatedSubject:true,visibleBounds:entry.visibleBounds,
      ...(entry.castOrigin?{castOrigin:entry.castOrigin}:{}),density:registration.density};
  }
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  // Body is already densely packed with sampling gutters. Do not repack its
  // trimmed aliases or perform full character pixel scans during gameplay.
  const scratch=document.createElement('canvas'),read=scratch.getContext('2d',{willReadFrequently:true})!;
  for(const kind of ['spells']){
    const source=scene.textures.get(`m14-source:${spec.id}:${kind}`).getSourceImage() as HTMLImageElement;
    let poses=preparedSpells;
    if(!poses){scratch.width=source.width;scratch.height=source.height;read.drawImage(source,0,0);
      poses=actorSpriteGridSubjects(read.getImageData(0,0,source.width,source.height).data,source.width,source.height,2,2,{keepDetachedDetails:true});}
    const spells=scene.textures.createCanvas(GRAND_MAGUS_SPELL_TEXTURE,256,256)!;
    poses.forEach((pose,i)=>{
      const [,,w,h]=pose.region,scale=104/Math.max(w,h),x=i%2*128,y=Math.floor(i/2)*128;
      spells.getContext().drawImage(spriteSubjectCanvas(pose),x+(128-w*scale)/2,y+(128-h*scale)/2,w*scale,h*scale);
      const anchors=[[.82,.5],[.96,.5],[.5,.92],[.5,.5]] as const,anchor=anchors[i];
      spells.add(i,0,x,y,128,128)!.customData={effectOrigin:{
        x:((128-w*scale)/2+w*scale*anchor[0])/128,y:((128-h*scale)/2+h*scale*anchor[1])/128}};
    });
    spells.refresh();spells.setFilter(Phaser.Textures.FilterMode.NEAREST);isolateAtlasFrames(spells);
  }
  scratch.width=0;scratch.height=0;
}

/** Owned by the active dungeon, including all timers and escaping bats. */
export function grandMagusFarewell(scene:Phaser.Scene,enemy:Enemy,finished:()=>void){
  const x=enemy.x,y=enemy.y,depth=enemy.depth,scale=enemy.scaleX,origin=enemy.originY;
  const visible=enemy.frame.customData as {visibleBounds?:{height:number}};
  const height=(visible.visibleBounds?.height??112)*ART_BY_KEY.enemy_grand_magus.density*scale;
  let active=true;const sprites:Phaser.GameObjects.Sprite[]=[],timers:Phaser.Time.TimerEvent[]=[];
  const destroy=()=>{if(!active)return;active=false;for(const timer of timers)timer.remove(false);
    for(const sprite of sprites){scene.tweens.killTweensOf(sprite);sprite.destroy();}};
  sprites.push(scene.add.sprite(x,y,'enemy_grand_magus',52).setOrigin(.5,origin).setScale(scale).setDepth(depth).play('enemy:19:death'));
  timers.push(scene.time.delayedCall(450,()=>{
    if(!active)return;
    for(let i=0;i<12;i++){
      const angle=-Math.PI*.9+i/11*Math.PI*.8,distance=260+i%4*45;
      const bat=scene.add.sprite(x+(i%3-1)*height*.08,y-height*.45-i%4*10,'enemy_grand_magus',58)
        .setDepth(depth+2).setScale(scale).play('grand-magus:bats');sprites.push(bat);
      scene.tweens.add({targets:bat,x:x+Math.cos(angle)*distance,y:y+Math.sin(angle)*distance-70,alpha:0,
        duration:1100+i%4*100,ease:'Sine.easeIn',onComplete:()=>bat.destroy()});
    }
  }));
  timers.push(scene.time.delayedCall(1900,()=>{if(!active)return;destroy();finished();}));
  return {get active(){return active;},destroy};
}
