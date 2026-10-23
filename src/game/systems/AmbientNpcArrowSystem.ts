import Phaser from 'phaser';
import {NPC_ARROW_TEXTURE} from '../../data/npcCombatArt';
import type {Npc} from '../entities/Npc';
import type {Enemy} from '../entities/Enemy';
import type {WorldScene} from '../scenes/WorldScene';
import {onDirectionalSprite} from '../presentation25d/plane';

interface Arrow {sprite:Phaser.GameObjects.Image;source:Npc|null;target:Enemy|null;x:number;y:number;vx:number;vy:number;age:number}

/** Physical, pooled arrows for ambient bow users. Damage follows contact,
 * never the draw animation alone, and paused/unloaded parties cancel flights. */
export class AmbientNpcArrowSystem{
  private readonly arrows:Arrow[]=[];
  constructor(private readonly scene:WorldScene,
    private readonly hit:(source:Npc,target:Enemy,direction:Phaser.Math.Vector2)=>void){}
  fire(source:Npc,target:Enemy){
    if(!this.scene.textures.exists(NPC_ARROW_TEXTURE))return;
    let arrow=this.arrows.find(a=>!a.sprite.active);
    if(!arrow){
      if(this.arrows.length>=8)return;
      arrow={sprite:this.scene.add.image(0,0,NPC_ARROW_TEXTURE).setOrigin(.15,.5).setDisplaySize(36,9)
        .setName('ambient-adventurer-arrow').setActive(false).setVisible(false),
        source:null,target:null,x:0,y:0,vx:0,vy:0,age:0};
      this.arrows.push(arrow);
      const anchor=arrow;
      onDirectionalSprite(arrow.sprite,{get x(){return anchor.vx;},get y(){return anchor.vy;}},{get x(){return anchor.x;},get y(){return anchor.y;}});
    }
    const facing=source.storyFacing;
    arrow.source=source;arrow.target=target;arrow.age=0;
    arrow.x=source.x+(facing==='left'?-24:facing==='right'?24:0);
    arrow.y=source.y+(facing==='up'?-68:facing==='down'?-26:-40)+36;
    const direction=new Phaser.Math.Vector2(target.x-arrow.x,target.y-arrow.y).normalize();
    arrow.vx=direction.x*420;arrow.vy=direction.y*420;
    arrow.sprite.setPosition(arrow.x,arrow.y-36).setRotation(direction.angle())
      .setDepth(this.scene.playerRenderDepth(arrow.y)+2).setActive(true).setVisible(true);
  }
  update(delta:number,enemies:readonly Enemy[]){
    for(const arrow of this.arrows){
      if(!arrow.sprite.active)continue;
      const {source,target}=arrow;
      if(!source?.active||!target?.active||target.hp<=0||!enemies.includes(target)){this.hide(arrow);continue;}
      const next={x:arrow.x+arrow.vx*delta/1000,y:arrow.y+arrow.vy*delta/1000};
      if(!this.scene.hasClearPath(arrow.x,arrow.y,next.x,next.y)){this.hide(arrow);continue;}
      const dx=next.x-arrow.x,dy=next.y-arrow.y,length2=dx*dx+dy*dy;
      const t=length2?Phaser.Math.Clamp(((target.x-arrow.x)*dx+(target.y-arrow.y)*dy)/length2,0,1):0;
      if(Math.hypot(target.x-arrow.x-dx*t,target.y-arrow.y-dy*t)<(target.definition.bodyRadius??11)+9){
        this.hit(source,target,new Phaser.Math.Vector2(arrow.vx,arrow.vy).normalize());this.hide(arrow);continue;
      }
      arrow.x=next.x;arrow.y=next.y;arrow.age+=delta;
      arrow.sprite.setPosition(arrow.x,arrow.y-36).setDepth(this.scene.playerRenderDepth(arrow.y)+2);
      if(arrow.age>=1100)this.hide(arrow);
    }
  }
  private hide(arrow:Arrow){arrow.sprite.setActive(false).setVisible(false);arrow.source=null;arrow.target=null;}
  forget(source:Npc){for(const arrow of this.arrows)if(arrow.source===source)this.hide(arrow);}
  clear(){for(const arrow of this.arrows)this.hide(arrow);}
  destroy(){this.clear();for(const arrow of this.arrows)arrow.sprite.destroy();this.arrows.length=0;}
}
