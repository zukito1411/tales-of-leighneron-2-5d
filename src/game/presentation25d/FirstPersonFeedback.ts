import type {Player} from '../entities/Player';
import type {Enemy} from '../entities/Enemy';
import type {WorldScene} from '../scenes/WorldScene';
import type {Vec2} from '../types';
import {BASIC_ATTACK_CHAIN} from '../../data/basicAttackCombo';
import {activeAttackTelegraphs} from '../systems/AttackTelegraph';
import {attackAreaContains} from '../systems/attackWarning';
import {meleeReach} from '../systems/combatSpacing';
import {presentationView} from './plane';
import {FIRST_PERSON_DAMAGE_EVENT,firstPersonAimScore} from './FirstPersonAim';
import './first-person-feedback.css';

interface WarningSlot {node:HTMLDivElement;fill:HTMLSpanElement;x:number;y:number;progress:number;used:boolean}
const element=<K extends keyof HTMLElementTagNameMap>(tag:K,className:string)=>{const node=document.createElement(tag);node.className=className;return node;};
const text=(node:HTMLElement,value:string)=>{if(node.textContent!==value)node.textContent=value;};

/** Presentation only: a bounded HUD, ten perception samples per second and
 * the existing combat/interaction guards. Never selects targets or deals hits. */
export class FirstPersonFeedback {
  private readonly root=element('div','fpp-feedback');
  private readonly shell:HTMLElement;
  private readonly reticle=element('div','fpp-reticle');
  private readonly interaction=element('div','fpp-interaction');
  private readonly danger=element('div','fpp-danger');
  private readonly flash=element('div','fpp-hit-flash');
  private readonly hit=element('div','fpp-direction fpp-direction-hit');
  private readonly warnings:WarningSlot[]=[];
  private scene:WorldScene|null=null;
  private nextSample=0;private active=false;
  private readonly interactHint=window.matchMedia('(pointer: coarse)').matches?'Interact':'E';
  private hitRemaining=0;private hitX=0;private hitY=0;private hitDirectional=false;
  private readonly onDamage=(source?:Readonly<Vec2>)=>{
    if(!this.active)return;
    this.hitRemaining=650;
    const p=this.scene?.player;
    this.hitDirectional=Boolean(source&&p&&Math.hypot(source.x-p.x,source.y-p.y)>8);
    if(source){this.hitX=source.x;this.hitY=source.y;}
  };
  private readonly onShutdown=()=>{this.detach();this.hide();};
  constructor(parent:HTMLElement){
    this.shell=parent.closest<HTMLElement>('.game-shell')??parent;
    this.root.setAttribute('aria-label','First-person combat awareness');this.root.hidden=true;
    this.reticle.setAttribute('aria-label','First-person aim');
    this.reticle.append(element('span','fpp-reticle-dot'));
    this.danger.textContent='MOVE · Incoming attack';
    this.hit.textContent='▲';
    this.root.append(this.flash,this.reticle,this.interaction,this.danger,this.hit);
    for(let i=0;i<3;i++){
      const node=element('div','fpp-direction fpp-direction-warning'),arrow=element('span','fpp-direction-arrow');arrow.textContent='▲';
      const caption=element('small','fpp-direction-caption');caption.textContent='Attack';
      const track=element('span','fpp-direction-track'),fill=element('span','fpp-direction-fill');track.append(fill);node.append(arrow,caption,track);node.hidden=true;
      this.root.append(node);this.warnings.push({node,fill,x:0,y:0,progress:0,used:false});
    }
    parent.append(this.root);
  }
  private detach(){
    this.scene?.events.off(FIRST_PERSON_DAMAGE_EVENT,this.onDamage);
    this.scene?.events.off('shutdown',this.onShutdown);this.scene=null;
  }
  private hide(){
    this.active=false;this.root.hidden=true;this.hitRemaining=0;this.nextSample=0;
    this.interaction.hidden=this.danger.hidden=this.hit.hidden=true;
    for(const w of this.warnings){w.used=false;w.node.hidden=true;}
  }
  suspend(){this.hide();}
  update(player:Player|undefined,firstPerson:boolean,enabled:boolean,delta:number){
    if(firstPerson&&player){if(this.shell.dataset.firstPerson!=='true')this.shell.dataset.firstPerson='true';}
    else if(this.shell.dataset.firstPerson)delete this.shell.dataset.firstPerson;
    if(!firstPerson||!player?.active){this.detach();this.hide();return;}
    const scene=player.scene as WorldScene;
    if(this.scene!==scene){this.detach();this.hide();this.scene=scene;scene.events.on(FIRST_PERSON_DAMAGE_EVENT,this.onDamage);scene.events.once('shutdown',this.onShutdown);}
    if(!enabled||player.hp<=0){this.hide();return;}
    this.active=true;if(this.root.hidden)this.root.hidden=false;
    if(scene.time.now>=this.nextSample){this.nextSample=scene.time.now+100;this.sample(scene,player);}
    const view=presentationView(scene);if(!view)return;
    for(const w of this.warnings)if(w.used)this.direction(w.node,player,view.yaw,w.x,w.y);
    this.hitRemaining=Math.max(0,this.hitRemaining-Math.max(0,Math.min(delta,80)));
    const opacity=Math.min(1,this.hitRemaining/350);
    this.flash.style.opacity=String(opacity*.45);this.hit.hidden=!this.hitDirectional||this.hitRemaining===0;
    if(!this.hit.hidden){this.direction(this.hit,player,view.yaw,this.hitX,this.hitY);this.hit.style.opacity=String(opacity);}
  }
  private sample(scene:WorldScene,p:Player){
    let target:Enemy|null=null,best=Infinity;
    const view=presentationView(scene);
    for(const e of scene.getCombatEnemies()){
      if(!e.active||!e.visible||!e.isAlive||(e.x-p.x)**2+(e.y-p.y)**2>680*680)continue;
      const visual=e.presentationLockVisual;if(view?.actorDrawn&&!view.actorDrawn(visual))continue;
      const height=Math.min(320,Math.abs(visual.displayHeight)*visual.originY),width=Math.min(180,Math.abs(visual.displayWidth)/2);
      const score=firstPersonAimScore(scene,e.x,e.y,height,width,e.presentationElevation+Math.max(0,e.y-visual.y));
      if(score>=best||!scene.canSeeEnemy(e)||!scene.hasClearPath(p.x,p.y,e.x,e.y))continue;
      best=score;target=e;
    }
    const interaction=scene.firstPersonInteraction();
    text(this.interaction,interaction?this.interactHint+' · '+interaction.label:'');this.interaction.hidden=!interaction;
    let ready=false;
    if(target){
      const weapon=scene.getEquippedWeapon(),step=p.presentationAttack?.step??BASIC_ATTACK_CHAIN[0];
      const dx=target.x-p.x,dy=target.y-p.y,distance=Math.hypot(dx,dy);
      const reach=meleeReach(scene,weapon.reach,weapon.kind)*step.reachMultiplier+(target.definition.boss?18:8);
      ready=target.canBeTargeted&&distance<=reach&&(distance===0||(p.lastDirection.x*dx+p.lastDirection.y*dy)/distance>=step.coneDot);
    }
    this.reticle.dataset.state=target?(ready?'ready':'target'):interaction?'interact':'idle';
    for(const w of this.warnings){w.used=false;w.node.hidden=true;}
    let threatened=false;
    for(const warning of activeAttackTelegraphs(scene)){
      const area=warning.area,g=warning.graphics;
      if(!warning.threatensPlayer||!area||!g.active||!g.visible||g.cameraFilter&scene.cameras.main.id||!attackAreaContains(area,p.x,p.y))continue;
      if(!scene.hasClearPath(area.x,area.y,p.x,p.y))continue;
      threatened=true;
      if(Math.hypot(area.x-p.x,area.y-p.y)>20)this.addWarning(area.x,area.y,warning.progress);
    }
    const projectile=scene.firstPersonProjectileThreat();
    if(projectile){threatened=true;this.addWarning(projectile.x,projectile.y,projectile.progress);}
    this.danger.hidden=!threatened;
    for(const w of this.warnings)if(w.used){w.node.hidden=false;w.fill.style.transform=`scaleX(${Math.max(.03,w.progress)})`;}
  }
  private addWarning(x:number,y:number,progress:number){
    let slot=this.warnings.find(w=>w.used&&Math.hypot(w.x-x,w.y-y)<35)??this.warnings.find(w=>!w.used);
    if(!slot){slot=this.warnings[0];for(const w of this.warnings)if(w.progress<slot.progress)slot=w;if(slot.progress>=progress)return;}
    slot.x=x;slot.y=y;slot.progress=Math.max(slot.used?slot.progress:0,progress);slot.used=true;
  }
  private direction(node:HTMLElement,p:Player,yaw:number,x:number,y:number){
    const dx=x-p.x,dy=y-p.y,c=Math.cos(yaw),s=Math.sin(yaw),angle=Math.atan2(dx*c-dy*s,-dx*s-dy*c);
    node.style.left=`${50+Math.sin(angle)*38}%`;node.style.top=`${50-Math.cos(angle)*37}%`;
    node.style.setProperty('--fpp-bearing',`${angle*180/Math.PI}deg`);
  }
  destroy(){this.detach();delete this.shell.dataset.firstPerson;this.root.remove();}
}
