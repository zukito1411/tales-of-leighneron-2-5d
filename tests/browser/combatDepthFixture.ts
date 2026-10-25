import Phaser from 'phaser';
import {Matrix3,Matrix4,Vector3} from 'three';
import {waveBladePoint,type CombatEffectKind} from '../../src/game/presentation25d/CombatEffectGeometry';
import {ThreePresentation} from '../../src/game/presentation25d/ThreePresentation';
import {SpriteBatch} from '../../src/game/presentation25d/SpriteBatch';
import {onGround,onOverlay,onCombatEffect,projectWorldPoint,PRESENTATION_HINT} from '../../src/game/presentation25d/plane';
import {presentedPixel} from './presentationProbe';
import {BootScene} from '../../src/game/scenes/BootScene';
import {WorldScene} from '../../src/game/scenes/WorldScene';
import {ART_SHEETS,artScale,actorArtLayout} from '../../src/data/art';
import {PLAYER_EFFECT_ANIMATIONS} from '../../src/data/spriteBoards';
import {PlayerSkillSystem} from '../../src/game/systems/PlayerSkillSystem';
import type {Player} from '../../src/game/entities/Player';
import {COMBAT_EFFECT_TEXTURE,DISTINCT_EFFECT_TEXTURE,prepareCombatArtEffects,prepareSlashWeaponEffect} from '../../src/game/systems/CombatArtEffects';
import {setEffectsQuality} from '../../src/game/systems/effectsQuality';
import {setGraphicEffect} from '../../src/game/systems/graphicsEffects';

const sheets=ART_SHEETS.filter(s=>s.key.startsWith('effect_')&&s.key!=='effect_troll_impact'||s.key==='leigneron_idle'||new URLSearchParams(location.search).has('direction')&&s.key==='leigneron');
const review={ready:false,error:'',yaw:0,pitch:Math.PI/6,hidden:false,wall:true,blocker:undefined as Phaser.GameObjects.Rectangle|undefined,game:undefined as unknown as Phaser.Game,scene:undefined as unknown as Phaser.Scene,
  effects:[] as Phaser.GameObjects.Sprite[],presentation:undefined as unknown as ThreePresentation,
  rear:undefined as Phaser.GameObjects.Sprite|undefined,
  orbit:undefined as unknown as {yaw:number;targetYaw:number;pitch:number;targetPitch:number},
  stats(){
    const batches=(review.presentation as unknown as {batches:Map<string,SpriteBatch>}).batches,matrix=new Matrix4();
    return [...batches].filter(([key,b])=>key.startsWith('combat:')&&b.mesh.visible).map(([key,b])=>{
      b.mesh.getMatrixAt(0,matrix);const p=b.mesh.geometry.getAttribute('position');
      let depth=0,nearest=Infinity,center=0,lead=0,left=0,right=0,up=0,down=0;const uv=b.mesh.geometry.getAttribute('uv'),normals=b.mesh.geometry.getAttribute('normal');
      for(let i=0;i<p.count;i++){
        depth=Math.max(depth,Math.abs(p.getZ(i)));const d=(uv.getX(i)-.5)**2+(uv.getY(i)-.5)**2;
        if(d<nearest){nearest=d;center=i;}
        if(p.getX(i)>p.getX(lead))lead=i;if(p.getZ(i)<p.getZ(left))left=i;if(p.getZ(i)>p.getZ(right))right=i;
        if(normals.getY(i)>.4)up++;if(normals.getY(i)<-.4)down++;
      }
      const normal=new Vector3().fromBufferAttribute(b.mesh.geometry.getAttribute('normal'),center).applyNormalMatrix(new Matrix3().getNormalMatrix(matrix));
      const world=(i:number)=>new Vector3().fromBufferAttribute(p,i).applyMatrix4(matrix).toArray();
      return {key,instances:b.mesh.count,vertices:p.count,depth,matrix:matrix.toArray(),normal:normal.toArray(),lead:world(lead),left:world(left),right:world(right),up,down,depthTest:b.mesh.material instanceof Array?false:b.mesh.material.depthTest};
    });
  },
  quality: setEffectsQuality,
  time(seconds:number){for(const sprite of review.effects){const hint=sprite.getData(PRESENTATION_HINT) as import('../../src/game/presentation25d/plane').PresentationHint|undefined;if(hint?.combat)hint.combat.time=seconds;}},
  phase(phase:number){for(const sprite of review.effects){const frames=sprite.anims.currentAnim?.frames;if(frames)sprite.anims.pause(frames[phase%frames.length]);}},
  screen(point:number[]){const p={x:0,y:0};projectWorldPoint(review.scene,point[0],point[1],point[2],p);return {x:p.x*review.scene.cameras.main.zoom,y:p.y*review.scene.cameras.main.zoom};},
  pixel(){const scene=review.scene,p={x:0,y:0},local=waveBladePoint(.5,.25,1,{x:0,y:0,z:0});projectWorldPoint(scene,-local.z*150,40+local.y*150,local.x*150,p);return presentedPixel(review.game,p.x*scene.cameras.main.zoom,p.y*scene.cameras.main.zoom);},
  aim(angle:number,distance=0,kind:CombatEffectKind='wave',color?:number){
    const sprite=review.effects[0],d={x:Math.cos(angle),y:Math.sin(angle)};
    sprite.setTexture(kind==='ward'?'effect_fortification':COMBAT_EFFECT_TEXTURE+(color===undefined?'':'-neutral'),2).setTint(color??0xffffff).setDisplaySize(160,160).setPosition(d.x*distance,d.y*distance);
    review.rear?.setPosition(-d.x*145,-d.y*145);
    onCombatEffect(sprite,kind,d,48);return {x:sprite.x,y:sprite.y};
  },
  silhouette():Promise<{count:number;width:number;height:number;hash:number;hot:number}>{
    return new Promise((resolve,reject)=>{
      const timeout=window.setTimeout(()=>{review.game.events.off('postrender',read);reject(new Error('No combat review frame'));},10000);
      const read=()=>{
        window.clearTimeout(timeout);const canvas=document.querySelector<HTMLCanvasElement>('.three-world-canvas')!,gl=canvas.getContext('webgl2')!;
        const pixels=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let left=canvas.width,right=0,top=canvas.height,bottom=0,count=0,hash=2166136261,hot=0;
        for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
          const i=(y*canvas.width+x)*4;
          if(i%68===0)hash=Math.imul(hash^pixels[i]^pixels[i+1]<<8^pixels[i+2]<<16,16777619);
          if(pixels[i]>230&&pixels[i+1]>230&&pixels[i+2]>230)hot++;
          if(pixels[i+2]>100&&pixels[i+1]>80&&pixels[i+2]>pixels[i]*1.25){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;}
        }
        resolve({count,width:count?(right-left+1)*review.game.scale.width/canvas.width:0,height:count?(bottom-top+1)*review.game.scale.height/canvas.height:0,hash,hot});
      };
      review.game.events.once('postrender',read);
    });
  },
  clear(){for(const sprite of review.effects)sprite.destroy();review.effects.length=0;},
};
declare global {interface Window {__combatDepthReview:typeof review}}
window.__combatDepthReview=review;

interface SkillAuthor {
  playArtEffect(row:number,x:number,y:number,size:number,rotation?:number):void;
  playGroundEffect(row:number,x:number,y:number,width:number,height:number):Phaser.GameObjects.Sprite;
  playFlurrySlash(x:number,y:number,angle:number):void;
}
class ReviewScene extends Phaser.Scene {
  readonly inInterior=true;readonly presentationFocus={x:0,y:110};
  player!:Phaser.GameObjects.Sprite&{lastDirection:Phaser.Math.Vector2};
  preload(){
    for(const sheet of sheets)for(const path of new Set([sheet.path,...(sheet.sources?.map(s=>s.path)??[])]))this.load.image('source:'+path,'/'+path);
    this.load.image(COMBAT_EFFECT_TEXTURE,'/assets/effects/combat-arts-v1.png');
    this.load.image(DISTINCT_EFFECT_TEXTURE,'/assets/effects/distinct-combat-arts-v2.png');
  }
  create(){void this.prepare().catch(error=>{review.error=String(error);console.error(error);});}
  playerRenderDepth(y:number){return y;}
  playCombatImpact(){}playAudio(){}
  private async prepare(){
    setGraphicEffect('depthOfField',false);setGraphicEffect('lightBloom',false);setGraphicEffect('adaptiveResolution',false);
    const boot=Object.create(BootScene.prototype) as BootScene;
    Object.assign(boot,{sys:this.sys,game:this.game,textures:this.textures,registry:this.registry,startupCancelled:false});
    await boot.prepareRegisteredSheets(sheets);
    prepareCombatArtEffects(this);prepareCombatArtEffects(this,DISTINCT_EFFECT_TEXTURE,'distinct-art-effect');prepareSlashWeaponEffect(this);
    for(const animation of PLAYER_EFFECT_ANIMATIONS)this.anims.create({key:animation.key,frames:animation.frames.map(frame=>({key:animation.texture,frame})),frameRate:animation.frameRate,repeat:0});
    this.cameras.main.setBackgroundColor(0x34443a).setZoom(this.scale.width<1000?.65:1.05);
    onGround(this.add.rectangle(0,0,2200,2000,0x34443a));
    if(new URLSearchParams(location.search).has('direction')){
      this.cameras.main.setZoom(1.8);this.presentationFocus.y=0;
      review.effects.push(onCombatEffect(this.add.sprite(0,0,COMBAT_EFFECT_TEXTURE,2).setDisplaySize(160,160).setBlendMode(Phaser.BlendModes.ADD),'wave',{x:1,y:0},48));
      review.rear=this.add.sprite(-145,0,'leigneron',18).setScale(artScale('leigneron')).setOrigin(.5,actorArtLayout('leigneron').originY).setData('presentation25dPlayerVisual',true);
      review.scene=this;review.ready=true;return;
    }
    if(new URLSearchParams(location.search).has('occlusion')){
      this.cameras.main.setZoom(1.4);this.presentationFocus.y=0;
      const sprite=onCombatEffect(this.add.sprite(0,0,COMBAT_EFFECT_TEXTURE,2).setDisplaySize(150,150).setBlendMode(Phaser.BlendModes.ADD),'wave',{x:0,y:1},40);
      review.effects.push(sprite);
      review.blocker=this.add.rectangle(0,140,420,230,0x4d3f35).setOrigin(.5,1).setData(PRESENTATION_HINT,{plane:'upright',wall:{axis:'x',thickness:10}});
      review.scene=this;review.ready=true;return;
    }
    for(let i=-6;i<=6;i++){
      onGround(this.add.rectangle(i*100,0,1,1500,0x556a58,.4),.05);
      onGround(this.add.rectangle(0,i*100,1500,1,0x556a58,.4),.05);
    }
    const hero=(x:number,y:number)=>{
      const actor=this.add.sprite(x,y,'leigneron_idle',0).setScale(artScale('leigneron_idle')).setOrigin(.5,actorArtLayout('leigneron_idle').originY).setDepth(y);
      actor.setData('presentation25dPlayerVisual',true);return actor;
    };
    this.player=Object.assign(hero(-240,-160),{lastDirection:new Phaser.Math.Vector2(1,0)});
    const skills=new PlayerSkillSystem(this as unknown as WorldScene,this.player as unknown as Player),author=skills as unknown as SkillAuthor;
    const sample=(name:string,x:number,y:number,make:()=>void)=>{
      if(x!==this.player.x||y!==this.player.y)hero(x,y);
      const before=new Set(this.children.list);make();
      for(const child of this.children.list)if(!before.has(child)&&child instanceof Phaser.GameObjects.Sprite){
        if(child.anims.currentAnim)child.anims.pause(child.anims.currentAnim.frames[Math.min(2,child.anims.currentAnim.frames.length-1)]);
        review.effects.push(child);
      }
      onOverlay(this.add.text(x,y+45,name,{fontSize:'14px',color:'#f5e6be',backgroundColor:'#23372a'}).setOrigin(.5));
    };
    sample('Sword sweep',-240,-160,()=>WorldScene.prototype.playEffect.call(this as unknown as WorldScene,'slash',-222,-160,new Phaser.Math.Vector2(1,0)));
    sample('Azure wave',0,-160,()=>{
      const sprite=this.add.sprite(32,-160,COMBAT_EFFECT_TEXTURE,2).setDisplaySize(110,110).setBlendMode(Phaser.BlendModes.ADD);
      onCombatEffect(sprite,'wave',{x:1,y:0},40);
    });
    sample('Skyfall impact',240,-160,()=>author.playArtEffect(1,240,-160,180));
    sample('Crown Rally',-240,100,()=>author.playArtEffect(2,-240,100,140));
    sample('Four slash pulse',0,100,()=>{for(let side=0;side<4;side++){const a=side*Math.PI/2;author.playFlurrySlash(Math.cos(a)*26,100+Math.sin(a)*26,a);}});
    sample('Ember eruption',240,100,()=>{author.playGroundEffect(0,240,100,145,100);});
    sample('Iron Rush',-240,360,()=>{author.playGroundEffect(1,-220,360,145,75);});
    sample('Healing dome',0,360,()=>{author.playGroundEffect(2,0,360,135,95);});
    sample('Shield shell',240,360,()=>WorldScene.prototype.playEffect.call(this as unknown as WorldScene,'fortification',240,360));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{skills.destroy();review.ready=false;});
    review.scene=this;review.ready=true;
  }
  update(){
    if(!review.ready)return;
    review.orbit.yaw=review.orbit.targetYaw=review.yaw;review.orbit.pitch=review.orbit.targetPitch=review.pitch;
    for(const sprite of review.effects)if(sprite.active)sprite.setVisible(!review.hidden);
    review.blocker?.setVisible(review.wall);
  }
}
review.game=new Phaser.Game({type:Phaser.CANVAS,parent:'review',width:1280,height:850,scale:{mode:Phaser.Scale.RESIZE},audio:{noAudio:true},scene:[ReviewScene],callbacks:{postBoot(game){
  review.presentation=new ThreePresentation(game,document.getElementById('review')!);
  review.orbit=(review.presentation as unknown as {orbit:typeof review.orbit}).orbit;
}}});
