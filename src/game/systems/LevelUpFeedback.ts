import Phaser from 'phaser';
import {useGameStore} from '../../store/gameStore';
import type {WorldScene} from '../scenes/WorldScene';
import {onWorldLabel} from '../presentation25d/plane';

/** Transient active-play celebration. Loading a save never replays a level. */
export class LevelUpFeedback{
  private readonly glow:Phaser.GameObjects.Graphics;
  private readonly label:Phaser.GameObjects.Text;
  private seen=-1;
  private elapsed=2400;
  private readonly reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  constructor(private readonly scene:WorldScene){
    this.glow=scene.add.graphics().setName('player-level-up').setVisible(false);
    this.label=onWorldLabel(scene.add.text(0,0,'',{fontFamily:'Georgia, serif',fontSize:'16px',fontStyle:'bold',
      color:'#fff1b7',stroke:'#47301c',strokeThickness:4}).setOrigin(.5,1).setResolution(2).setVisible(false),scene.player);
  }
  update(delta:number,blocked:boolean){
    const notice=useGameStore.getState().levelUpNotice,player=this.scene.player;
    if(blocked||!player?.active){this.glow.setVisible(false);this.label.setVisible(false);return;}
    if(notice&&notice.id!==this.seen){
      this.seen=notice.id;this.elapsed=0;this.label.setText(`LEVEL ${notice.level}!`);
      this.scene.playAudio('sfx-heal-bell',.65,1.18);
    }
    this.elapsed+=Math.max(0,Math.min(delta,100));
    const p=this.elapsed/2400,visible=p<1;
    this.glow.clear().setVisible(visible);this.label.setVisible(visible);
    if(!visible)return;
    const alpha=Math.min(1,p*8)*Math.min(1,(1-p)*4),motion=this.reduced.matches?0:p;
    const x=player.x,y=player.y,depth=this.scene.playerRenderDepth(y);
    this.glow.setDepth(depth+4).lineStyle(2,0xffda79,.85*alpha);
    this.glow.strokeEllipse(x,y+1,42+motion*80,16+motion*24);
    this.glow.lineStyle(1,0xfff2b9,.55*alpha).strokeEllipse(x,y+1,35+motion*50,13+motion*17);
    if(!this.reduced.matches)for(let i=0;i<14;i++){
      const angle=i*Math.PI*2/14+motion*.7,radius=18+motion*(22+i%3*9);
      const px=x+Math.cos(angle)*radius,py=y-12-motion*(60+i%4*12)+Math.sin(angle)*9;
      this.glow.fillStyle(i%2?0xffd16b:0xfff6c5,alpha*.9).fillCircle(px,py,i%3===0?2:1.3);
      if(i%3===0)this.glow.lineStyle(1,0xffdf8d,alpha*.35).lineBetween(px,py+9,px,py);
    }
    this.label.setPosition(x,y-92-motion*20).setAlpha(alpha);
  }
  destroy(){this.glow.destroy();this.label.destroy();}
}
