import type Phaser from 'phaser';
import {onGround} from '../presentation25d/plane';
import {ATTACK_WARNING_FRAMES,ATTACK_WARNING_TEXTURE,windupProgress,type AttackArea} from './attackWarning';

export const TELEGRAPH_PRESENTATION='attackTelegraphPresentation';
export interface TelegraphPresentation {area:AttackArea|null;progress:number;color:number}

/** A full-size boundary remains fixed while the interior fills toward impact. */
export class AttackTelegraph {
  readonly graphics:Phaser.GameObjects.Graphics;
  private readonly rune:Phaser.GameObjects.Image|undefined;
  private geometry:AttackArea|null=null;
  private lastProgress=-1;
  private lastColor=0;
  private readonly gpu:boolean;
  private readonly presentation:TelegraphPresentation={area:null,progress:0,color:0};
  progress=0;
  constructor(scene:Phaser.Scene,name:string,preserveRune=true){
    this.gpu=scene.game.registry.get('presentation')==='three-2.5d';
    this.graphics=onGround(scene.add.graphics().setName(name).setVisible(false),.35);
    if(this.gpu)this.graphics.setData(TELEGRAPH_PRESENTATION,this.presentation);
    if(preserveRune&&scene.textures.exists(ATTACK_WARNING_TEXTURE))this.rune=onGround(scene.add.image(0,0,ATTACK_WARNING_TEXTURE,ATTACK_WARNING_FRAMES.circle.name)
      .setOrigin(.5).setVisible(false).setName(name+':rune'),.25);
  }
  draw(area:AttackArea,progress:number,depth:number,color=0xf3aa57){
    const g=this.graphics,p=windupProgress(progress,1),r=area.radius;
    this.progress=p;
    g.setVisible(true).setPosition(area.x,area.y).setRotation(area.angle).setDepth(depth);
    const tint=p>=.85?0xff6659:color;
    this.rune?.setPosition(area.x,area.y).setDisplaySize(r*2,r*2).setDepth(depth-.1).setAlpha(.12).setVisible(area.kind==='circle');
    this.presentation.area=area;this.presentation.progress=p;this.presentation.color=tint;
    if(this.gpu)return this;
    const old=this.geometry;
    // Filled lingering zones retain their command buffer. World position,
    // depth and fade can change independently without rebuilding the polygon.
    if(old&&this.lastProgress===p&&this.lastColor===color&&old.kind===area.kind&&old.radius===r
      &&old.range===area.range&&old.innerRadius===area.innerRadius&&old.halfAngle===area.halfAngle&&old.flatEnd===area.flatEnd)return this;
    this.geometry??={...area};
    this.geometry.kind=area.kind;this.geometry.radius=r;this.geometry.range=area.range;
    this.geometry.innerRadius=area.innerRadius;this.geometry.halfAngle=area.halfAngle;this.geometry.flatEnd=area.flatEnd;
    this.lastProgress=p;this.lastColor=color;g.clear();
    g.fillStyle(tint,.07);g.lineStyle(2,p>=.95?0xffead0:tint,.85);
    if(area.kind==='line'){
      const length=area.range??r;
      g.fillRoundedRect(-r,-r,length+2*r,2*r,r);
      g.strokeRoundedRect(-r,-r,length+2*r,2*r,r);
      if(p>0){g.fillStyle(tint,.22+p*.16);g.fillRoundedRect(-r,-r,length*p+2*r,2*r,r);}
    }else if(area.kind==='cone'){
      const half=area.halfAngle??Math.acos(.6);
      if(area.flatEnd){
        const x=r*Math.cos(half),y=r*Math.sin(half);
        g.fillTriangle(0,0,x,-y,x,y).strokeTriangle(0,0,x,-y,x,y);
        if(p>0)g.fillStyle(tint,.22+p*.16).fillTriangle(0,0,x*p,-y*p,x*p,y*p);
      }else{
        g.beginPath().moveTo(0,0).arc(0,0,r,-half,half,false).closePath().fillPath().strokePath();
        if(p>0){g.fillStyle(tint,.22+p*.16);g.beginPath().moveTo(0,0).arc(0,0,r*p,-half,half,false).closePath().fillPath();}
      }
    }else{
      const inner=area.kind==='ring'?area.innerRadius??0:0;
      // Annular sectors retain the safe hollow center instead of painting it red.
      const sector=(fraction:number)=>{
        g.beginPath();
        const count=Math.max(2,Math.ceil(fraction*48));
        for(let i=0;i<=count;i++){
          const angle=-Math.PI/2+fraction*Math.PI*2*i/count;
          if(i===0)g.moveTo(Math.cos(angle)*r,Math.sin(angle)*r);
          else g.lineTo(Math.cos(angle)*r,Math.sin(angle)*r);
        }
        for(let i=count;i>=0;i--){const angle=-Math.PI/2+fraction*Math.PI*2*i/count;g.lineTo(Math.cos(angle)*inner,Math.sin(angle)*inner);}
        g.closePath().fillPath();
      };
      sector(1);g.strokeCircle(0,0,r);if(inner>0)g.strokeCircle(0,0,inner);
      if(p>0){g.fillStyle(tint,.22+p*.16);sector(p);}
    }
    return this;
  }
  clear(){if(this.graphics.visible)this.graphics.clear().setVisible(false);this.rune?.setVisible(false);this.progress=0;this.lastProgress=-1;}
  destroy(){this.graphics.destroy();this.rune?.destroy();}
}
