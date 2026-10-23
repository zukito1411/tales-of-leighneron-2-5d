import Phaser from 'phaser';
import {BREATH_ROOT,BREATH_LENGTH} from './DragonBreathArt';
import {breathPresentation} from './dragonBreath';
import {PRESENTATION_HINT,type PresentationHint} from '../presentation25d/plane';
export class DragonBreathEffect {
  private readonly flame:Phaser.GameObjects.Sprite;
  private readonly glow:Phaser.GameObjects.Sprite;
  private readonly beam={x:0,y:0,anchorX:0,anchorY:0,dx:1,dy:0,length:1};
  constructor(scene:Phaser.Scene,id:string){
    this.flame=scene.add.sprite(0,0,'dragon-breath',0).setOrigin(BREATH_ROOT/512,.5).setVisible(false).setName('dragon-fire:'+id);
    this.glow=scene.add.sprite(0,0,'dragon-breath',0).setOrigin(BREATH_ROOT/512,.5).setVisible(false)
      .setBlendMode(Phaser.BlendModes.ADD).setName('dragon-fire-glow:'+id);
    this.flame.setData(PRESENTATION_HINT,{plane:'ground',beam:this.beam} satisfies PresentationHint);
    this.glow.setData(PRESENTATION_HINT,{plane:'ground',beam:this.beam} satisfies PresentationHint);
  }
  show(mouth:{x:number;y:number},angle:number,reach:number,age:number,depth:number,charging=false,anchorY=mouth.y,anchorX=mouth.x){
    Object.assign(this.beam,{x:mouth.x,y:mouth.y,anchorX,anchorY,dx:Math.cos(angle),dy:Math.sin(angle),length:Math.max(1,reach)});
    const p=breathPresentation(age),scale=reach/BREATH_LENGTH;
    const growth=charging?.13+.07*p.growth:.12+.88*p.growth,alpha=charging?.3*p.alpha:p.alpha;
    this.flame.setVisible(alpha>.001).setFrame(p.frame).setPosition(mouth.x,mouth.y).setRotation(angle)
      .setScale(scale*growth,scale*(charging?.16:.72+.28*p.growth)).setAlpha(alpha).setDepth(depth);
    this.glow.setVisible(alpha>.001).setFrame(p.frame).setPosition(mouth.x,mouth.y).setRotation(angle)
      .setScale(this.flame.scaleX,this.flame.scaleY).setAlpha(alpha*.12).setDepth(depth+.01);
  }
  hide(){this.flame.setVisible(false);this.glow.setVisible(false);}
  destroy(){this.flame.destroy();this.glow.destroy();}
}
