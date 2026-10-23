import Phaser from 'phaser';
import {useGameStore} from '../../store/gameStore';
import type {Npc} from '../entities/Npc';
import type {WorldScene} from '../scenes/WorldScene';
import {onPlane} from '../presentation25d/plane';

/** One reusable text texture. Follow physics only during the visible remark. */
export class AliceSpeechBubble {
  private bubble:Phaser.GameObjects.Container|null=null;
  private text:Phaser.GameObjects.Text|null=null;
  private id:string|null=null;
  private until=0;
  constructor(private readonly scene:WorldScene,private readonly actor:()=>Npc|null){}
  show(id:string,line:string){
    if(!this.bubble){
      this.text=this.scene.add.text(0,-6,'',{
        fontFamily:'Georgia, serif',fontSize:'11px',color:'#f3e5c4',backgroundColor:'#292216',
        padding:{x:8,y:6},wordWrap:{width:176},lineSpacing:2,align:'center',
      }).setResolution(2).setOrigin(.5,1);
      const tail=this.scene.add.graphics().fillStyle(0x292216,1).fillTriangle(-5,-7,5,-7,0,0);
      this.bubble=this.scene.add.container(0,0,[this.text,tail]).setName('alice-travel-speech').setVisible(false);
    }
    // Text layout/upload happens once per line, never while following her.
    this.text!.setText(line);
    this.id=id;this.until=this.scene.time.now+9000;
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE,this.follow,this);
    this.scene.events.on(Phaser.Scenes.Events.POST_UPDATE,this.follow,this);
    this.follow();
  }
  private follow(){
    const npc=this.actor(),state=useGameStore.getState();
    if(!npc||!this.bubble||state.aliceRemark?.id!==this.id||this.scene.time.now>=this.until
      ||state.panel||state.dialogue||state.cinematic||state.pendingCinematic){this.hide();return;}
    // Use the actor's stable head registration, not an animated frame's bounds
    // or a HUD position sampled before Arcade moves her feet.
    const y=npc.speechAnchorY,depth=this.scene.playerRenderDepth(npc.y)+200;
    onPlane(this.bubble,'upright',npc);
    if(this.bubble.x!==npc.x||this.bubble.y!==y)this.bubble.setPosition(npc.x,y);
    if(this.bubble.depth!==depth)this.bubble.setDepth(depth);
    this.bubble.cameraFilter=npc.cameraFilter;
    this.bubble.setVisible(npc.visible&&npc.alpha>0);
  }
  hide(){
    if(this.id===null)return;
    const id=this.id;this.id=null;
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE,this.follow,this);
    this.bubble?.setVisible(false);
    const state=useGameStore.getState();if(state.aliceRemark?.id===id)state.dismissAliceRemark(id);
  }
  destroy(){this.hide();this.bubble?.destroy();this.bubble=null;this.text=null;}
}
