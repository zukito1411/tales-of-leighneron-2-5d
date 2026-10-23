import type Phaser from 'phaser';
import type {Enemy} from '../entities/Enemy';
import type {WorldScene} from '../scenes/WorldScene';
import type {BossMove} from '../../data/bossCombatProfiles';
import type {AttackArea} from './attackWarning';
import {BOSS_SKILL_CONTENT,BOSS_SKILL_FRAMES,BOSS_SKILL_ACCENTS,BOSS_SKILL_TEXTURE,
 BOSS_MOTION_TEXTURE,BOSS_MOTION_START,BOSS_MOTION_GROUND_Y,BOSS_MOTION_SEA_SWEEP,type BossSkillFamily} from '../../data/bossSkillEffects';
import {ensureBossSkillArt} from './BossSkillArt';
import {onPlane,onGround} from '../presentation25d/plane';

interface Glow {
 sprite:Phaser.GameObjects.Sprite;active:boolean;age:number;duration:number;size:number;
 alpha:number;rotation:number;turn:number;rise:number;x:number;y:number;moveX:number;moveY:number;
 held:boolean;retiring:boolean;startScale:number;travelling:boolean;clipStart:number|null;stage:number;
}
const smooth=(p:number)=>{const t=Math.max(0,Math.min(1,p));return t*t*(3-2*t);};
/** Authored effect sprites, animated by the owning combat clock. At most 24
 * reusable sprites per boss, no emitters, damage timers, lights or tween chains. */
export class BossSkillVisual {
 private readonly pool:Glow[]=[];
 private windup:Glow|null=null;
 private charge:Glow|null=null;
 private cursor=0;
 constructor(private readonly scene:WorldScene,private readonly family:BossSkillFamily){ensureBossSkillArt(scene);}
 private add(x:number,y:number,size:number,duration=650,rotation=0,accent=false,motionStart:number|null=BOSS_MOTION_START[this.family]):Glow|null{
  if(!ensureBossSkillArt(this.scene))return null;
  const clipStart=!accent&&motionStart!==null&&this.scene.textures.exists(BOSS_MOTION_TEXTURE)?motionStart:null;
  const texture=clipStart===null?BOSS_SKILL_TEXTURE:BOSS_MOTION_TEXTURE;
  const frame=clipStart??(accent?BOSS_SKILL_ACCENTS[this.family]:BOSS_SKILL_FRAMES[this.family]);
  let glow=this.pool.find(item=>!item.active);
  if(!glow&&this.pool.length<24){
   glow={sprite:this.scene.add.sprite(0,0,BOSS_SKILL_TEXTURE,BOSS_SKILL_FRAMES[this.family])
    .setName('boss-skill:'+this.family),active:false,age:0,duration:0,size:0,alpha:0,rotation:0,turn:0,rise:0,x:0,y:0,moveX:0,moveY:0,held:false,retiring:false,startScale:.7,travelling:false,clipStart:null,stage:0};
   this.pool.push(glow);
  }
  if(!glow){
   for(let i=0;i<this.pool.length;i++){
    const candidate=this.pool[this.cursor++%this.pool.length];
    if(candidate!==this.windup&&candidate!==this.charge){glow=candidate;break;}
   }
  }
  if(!glow)return null;
  Object.assign(glow,{active:true,age:0,duration:Math.max(1,duration),size,alpha:.88,rotation,turn:0,rise:0,x,y,moveX:0,moveY:0,held:false,retiring:false,startScale:.7,travelling:false,clipStart,stage:0});
  glow.sprite.setTexture(texture,frame)
   .setPosition(x,y).setOrigin(.5).setScale(size/BOSS_SKILL_CONTENT*.7)
   .setRotation(rotation).setAlpha(0).setVisible(true).setFlip(false,false)
   .setDepth(this.scene.playerRenderDepth(y)+1);
  const anchor=glow;
  onPlane(glow.sprite,'upright',{get x(){return anchor.sprite.x;},get y(){return anchor.y+anchor.moveY*Math.min(1,anchor.age/anchor.duration);}});
  if(accent&&['stone','roots','frost','ember'].includes(this.family))onGround(glow.sprite,.08);
  return glow;
 }
 begin(enemy:Enemy,area:AttackArea){
  this.endWindup();this.endCharge();
  // A faint gathering effect accompanies, never covers, the authoritative fill.
  const x=area.kind==='circle'||area.kind==='ring'?area.x:enemy.x;
  const y=area.kind==='circle'||area.kind==='ring'?area.y:enemy.y-25;
  this.windup=this.add(x,y,Math.min(80,area.radius*.6),1,0,true);
  if(this.windup){this.windup.held=true;this.windup.sprite.setAlpha(0);
    if(area.kind!=='circle'&&area.kind!=='ring')onPlane(this.windup.sprite,'upright',enemy);}
 }
 gather(progress:number){
  const glow=this.windup;if(!glow)return;
  glow.sprite.setAlpha(.16*smooth(progress)).setScale(glow.size/BOSS_SKILL_CONTENT*(.45+.35*progress));
 }
 endWindup(){if(this.windup){this.retire(this.windup);this.windup=null;}}
 impact(move:Pick<BossMove,'id'>,area:AttackArea,duration=0){
  this.endWindup();
  const slashing=this.family==='blade'||this.family==='waraxe'||this.family==='moon';
  if(area.kind==='ring'){
   const inner=area.innerRadius??0,r=(area.radius+inner)/2,size=(area.radius-inner)*.86;
   // Leave the advertised safe centre empty, including the visual footprint.
   for(let i=0;i<8;i++){
    const angle=i*Math.PI/4;
    const ground=this.family==='stone'||this.family==='roots'||this.family==='frost'||this.family==='ember';
    const glow=this.add(area.x+Math.cos(angle)*r,area.y+Math.sin(angle)*r,size,780,slashing?angle+Math.PI/2:0,ground);
    if(glow&&ground)glow.sprite.setFlipX(i%2===1);
   }
  }else if(area.kind==='cone'){
   const offset=area.radius*.42;
   const sweep=slashing||this.family==='broadside';
   const glow=this.add(area.x+Math.cos(area.angle)*offset,area.y+Math.sin(area.angle)*offset,
    area.radius*1.3,sweep?440:700,sweep?area.angle:0,false,
    this.family==='broadside'?BOSS_MOTION_SEA_SWEEP:BOSS_MOTION_START[this.family]);
   if(glow&&sweep){glow.turn=move.id.includes('right')||move.id.includes('return')||move.id.includes('reverse')?-.45:.45;glow.alpha=.95;}
  }else if(area.kind==='line'){
   const range=area.range??0,count=Math.max(1,Math.min(6,Math.ceil(range/(area.radius*2))));
   for(let i=0;i<count;i++){
    const distance=range*(i+.5)/count;
    this.add(area.x+Math.cos(area.angle)*distance,area.y+Math.sin(area.angle)*distance,
     area.radius*2,650,0);
   }
  }else{
   // The eruption settles into different authored ground art. Long root/ice
   // hazards retain that detailed ground formation, not a frozen explosion.
   const grounded=this.family==='roots'||this.family==='frost'||this.family==='stone'||this.family==='ember';
   const glow=this.add(area.x,area.y,area.radius*2,grounded?650:850,0,false,slashing?null:BOSS_MOTION_START[this.family]);
   // Upright eruptions originate at ground contact. Ground accents stay flat;
   // ranged moon seals retain their seal art rather than becoming saber cuts.
   const groundY=BOSS_MOTION_GROUND_Y[this.family];
   if(glow&&glow.clipStart!==null&&groundY!==undefined)glow.sprite.setOrigin(.5,groundY);
   if(grounded){
    const patch=this.add(area.x,area.y,area.radius*1.85,Math.max(950,duration),0,true);
    if(patch){patch.alpha=.5;patch.sprite.setDepth(this.scene.playerRenderDepth(area.y)-1);}
   }
   if(this.family==='ash'){
    const omen=this.add(area.x,area.y-18,area.radius*.9,1000,0,true);
    if(omen){omen.rise=-24;omen.alpha=.6;omen.turn=.18;}
   }
  }
 }
 beginCharge(enemy:Enemy,area:AttackArea){
  this.endWindup();this.endCharge();
  this.charge=this.add(enemy.x,enemy.y-15,area.radius*2.5,1,area.angle,true);
  if(this.charge)this.charge.held=true;
 }
 followCharge(enemy:Enemy,area:AttackArea){
  const glow=this.charge;if(!glow)return;
  onPlane(glow.sprite,'upright',enemy);
  glow.sprite.setPosition(enemy.x-Math.cos(area.angle)*20,enemy.y-Math.sin(area.angle)*20-15)
   .setRotation(area.angle).setScale(glow.size/BOSS_SKILL_CONTENT)
   .setAlpha(.8*smooth(glow.age/110)).setDepth(this.scene.playerRenderDepth(enemy.y)+1);
 }
 endCharge(){
  if(!this.charge)return;
  this.retire(this.charge,240);this.charge=null;
 }
 projectile(area:AttackArea,duration:number,age=0){
  const glow=this.add(area.x,area.y-24,area.radius*2.4,duration,area.angle,true);
  if(!glow)return;
  glow.travelling=true;glow.moveX=Math.cos(area.angle)*(area.range??0);glow.moveY=Math.sin(area.angle)*(area.range??0);
  glow.age=Math.max(0,Math.min(duration,age));
  onPlane(glow.sprite,'upright',{get x(){return glow.sprite.x;},get y(){return glow.sprite.y+24;}});
  const p=glow.age/duration;
  glow.sprite.setOrigin(.8,.5).setPosition(glow.x+glow.moveX*p,glow.y+glow.moveY*p);
 }
 private retire(glow:Glow,duration=160){
  if(!glow.active||glow.retiring)return;
  glow.startScale=glow.sprite.scaleX*BOSS_SKILL_CONTENT/Math.max(1,glow.size);
  glow.alpha=glow.sprite.alpha;glow.rotation=glow.sprite.rotation;glow.turn=0;glow.rise=0;
  glow.x=glow.sprite.x;glow.y=glow.sprite.y;glow.moveX=0;glow.moveY=0;glow.travelling=false;
  glow.age=0;glow.duration=duration;glow.held=false;glow.retiring=true;
 }
 update(delta:number){
  const dt=Math.max(0,Math.min(100,delta));
  for(const glow of this.pool){
   if(!glow.active)continue;
   glow.age+=dt;if(glow.held)continue;
   const p=Math.min(1,glow.age/glow.duration),reveal=smooth(glow.age/100);
   const scale=glow.retiring?Math.min(1,glow.startScale*(1+.08*smooth(p))):.7+.3*reveal;
   const fadeStart=glow.travelling?.88:glow.duration>1200?.8:glow.clipStart!==null?.48:.22;
   const alpha=glow.retiring?1-smooth(p):reveal*(1-smooth((p-fadeStart)/(1-fadeStart)));
   if(glow.clipStart!==null&&!glow.retiring){
    const stage=p<.12?0:p<.36?1:p<.62?2:3;
    if(stage!==glow.stage){glow.stage=stage;glow.sprite.setFrame(glow.clipStart+stage);}
   }
   glow.sprite.setScale(glow.size/BOSS_SKILL_CONTENT*scale)
    .setAlpha(glow.alpha*alpha)
    .setRotation(glow.rotation+glow.turn*smooth(p))
    .setPosition(glow.x+glow.moveX*p,glow.y+glow.moveY*p+glow.rise*smooth(p));
   if(glow.travelling)glow.sprite.setDepth(this.scene.playerRenderDepth(glow.y+24+glow.moveY*p)+1);
   if(p>=1){glow.active=false;glow.sprite.setVisible(false);}
  }
 }
 clear(){this.windup=null;this.charge=null;for(const glow of this.pool)this.retire(glow);}
 destroy(){this.clear();for(const glow of this.pool)glow.sprite.destroy();this.pool.length=0;}
}
