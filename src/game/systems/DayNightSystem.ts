import Phaser from 'phaser';
import { useGameStore } from '../../store/gameStore';
import { seededRandom } from '../../utils/seededRandom';
import { ART_BY_KEY, type ArtTextureKey } from '../../data/art';
import { environmentLightPoints, nightStrength } from '../../data/environmentLights';
import {overlayViewport} from './renderSizing';
import {getEffectsQuality,EFFECTS_QUALITY_EVENT} from './effectsQuality';
import {getGraphicEffects} from './graphicsEffects';
import {ensureNightLightArt,nightLightFrame} from './NightLightArt';
import {INN_MORNING_MINUTE,innRestAvailable} from '../../data/innRest';
import {groundWorldView,projectGroundPoint,projectedViewOrigin,presentationAttachment,onOverlay,onPlane,PRESENTATION_HINT,type PresentationHint} from '../presentation25d/plane';
import {architectureLightFixtures} from '../presentation25d/ArchitectureGeometry';
import {LIFE_TREE_LIGHTS} from '../presentation25d/LifeTreeDesign';
import {VIEW_DISTANCE,FOG_START} from '../presentation25d/environment';
import {furniturePlacement} from '../presentation25d/FurnitureGeometry';

export interface LocalLight {
  actor:Phaser.GameObjects.Image|Phaser.GameObjects.Sprite; x:number; y:number; radius:number; fire:boolean; phase:number;
  fixture?:PresentationHint['fixture'];occlusionBias?:number;
  glow:Phaser.GameObjects.Image;
  cutout:Phaser.GameObjects.Image;
}
export class DayNightSystem {
  gpuLights(){return this.lights.values();}
  get presentationTime(){return this.elapsed;}
  private lightweight = getEffectsQuality() === 'low';
  private readonly onQualityChange = () => {
    const next = getEffectsQuality() === 'low';
    if (this.lightweight !== next) { this.lightweight = next; this.onResize(); }
  };
  private day:number;
  private minuteOfDay:number;
  private readonly overlay:Phaser.GameObjects.Image;
  private readonly texture:Phaser.Textures.DynamicTexture;
  private readonly lights=new Set<LocalLight>();
  private readonly emissions=new Set<Phaser.GameObjects.Sprite>();
  private readonly fireflies:Array<{glow:Phaser.GameObjects.Arc; light:Phaser.GameObjects.Arc;dx:number;dy:number;phase:number}>=[];
  private elapsed=0;
  private accumulator=0;
  private renderAccumulator=100;
  private maskDirty=true;
  private maskGeometry='';
  private readonly lightPoint={x:0,y:0};
  private readonly groundPoint={x:0,y:0};
  private readonly cutouts:Phaser.GameObjects.Image[]=[];
  // This low-cost mask is painted less often than the camera moves.
  // The buffered image uses screen-parallel projected world coordinates.
  // Ground distances foreshorten; a lamp's height above its owner does not.
  private maskWorldOrigin: {x:number;y:number} | null = null;
  private maskWorldScale=0;
  private readonly maskPaddingCss = 96;
  private firefliesEnabled=true;
  // Avoid even traversing lit-window, lantern, rune and firefly objects while
  // their effects are disabled. One visibility pass occurs on state changes.
  private bloomWasEnabled=false;
  private firefliesWereEnabled=false;
  setFirefliesEnabled(enabled:boolean){this.firefliesEnabled=enabled;}
  constructor(private readonly scene:Phaser.Scene) {
    const state=useGameStore.getState();this.day=state.day;this.minuteOfDay=state.minuteOfDay;
    const viewport=overlayViewport(scene);
    const gpu=scene.game.registry.get('presentation')==='three-2.5d';
    const resolution=this.lightweight ? .65 : 1;
    const padding=Math.round(this.maskPaddingCss*resolution);
    this.texture=scene.textures.addDynamicTexture('night-overlay',
      gpu?1:Math.max(1,Math.round(viewport.width*resolution))+padding*2,
      gpu?1:Math.max(1,Math.round(viewport.height*resolution))+padding*2)!;
    this.texture.setSize(gpu?1:Math.max(1,Math.round(viewport.width*resolution))+padding*2,
      gpu?1:Math.max(1,Math.round(viewport.height*resolution))+padding*2,false);
    this.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.overlay=scene.add.image(0,0,'night-overlay').setOrigin(0).setScrollFactor(0).setDepth(1_000_000).setName('night-darkness');
    if(!scene.textures.exists('warm-light')) {
      const t=scene.textures.createCanvas('warm-light',128,128)!,ctx=t.getContext();
      const gradient=ctx.createRadialGradient(64,64,0,64,64,64);
      gradient.addColorStop(0,'rgba(255,191,93,.8)');gradient.addColorStop(.35,'rgba(255,162,64,.25)');gradient.addColorStop(1,'rgba(255,150,55,0)');
      ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);t.refresh();
    }
    scene.scale.on('resize',this.onResize,this);
    window.addEventListener(EFFECTS_QUALITY_EVENT,this.onQualityChange);
    const random=seededRandom('mernondna:fireflies');
    for(let i=0;i<18;i++) this.fireflies.push({
      glow:onOverlay(scene.add.circle(0,0,7,0x9bf5a7,.2).setName('firefly-glow').setDepth(1_000_003).setBlendMode(Phaser.BlendModes.ADD).setVisible(false)),
      light:onOverlay(scene.add.circle(0,0,1.5,0xe8ffd0,.8).setName('firefly-light').setDepth(1_000_004).setBlendMode(Phaser.BlendModes.ADD).setVisible(false)),
      dx:(random()-.5)*800,dy:(random()-.5)*700,phase:random()*Math.PI*2,
    });
  }
  register(actor:Phaser.GameObjects.Sprite,key:ArtTextureKey,frame:number,scale:number) {
    const spatial=this.scene.game.registry.get('presentation')==='three-2.5d';
    const ownerHint=actor.getData(PRESENTATION_HINT) as PresentationHint|undefined,shape=ownerHint?.furniture;
    const fixtures=spatial&&ownerHint?.house?architectureLightFixtures(ownerHint.house):undefined;
    const tree=spatial&&shape?.art==='life-tree';
    const points=fixtures?fixtures.map(f=>({x:0,y:0,radius:f.fire?100:72,fire:f.fire,mask:0})):tree?LIFE_TREE_LIGHTS.map(()=>({x:0,y:0,radius:100,fire:false,mask:0})):environmentLightPoints(key,frame);
    const owned:LocalLight[]=[];
    for(const [index,p] of points.entries()) {
      const glow=this.scene.add.image(actor.x,actor.y,'warm-light').setDepth(1_000_001).setBlendMode(Phaser.BlendModes.ADD)
        .setDisplaySize(p.radius*2*Math.sqrt(scale),p.radius*2*Math.sqrt(scale))
        .setTint(key==='elarion_tree'?0x52dfff:0xffffff).setAlpha(0).setVisible(false).setName('environment-light:'+actor.name+':'+index);
      const node:LocalLight={actor,x:p.x*scale,y:p.y*scale+(1-actor.originY)*ART_BY_KEY[key].frameHeight*scale,
        radius:p.radius*Math.sqrt(scale),fire:p.fire,phase:index*.8+actor.x*.013+actor.y*.019,glow,
        cutout:this.scene.game.registry.get('presentation')==='three-2.5d'?this.scene.make.image({key:'warm-light',add:false})
          :this.scene.make.image({key:ensureNightLightArt(this.scene),frame:nightLightFrame(false,0,0),add:false})};
      onOverlay(glow,actor,true);
      if(fixtures){
        const p=fixtures[index];
        node.fixture={owner:actor,right:(p.x+.5-actor.originX)*Math.abs(actor.displayWidth),
          height:(p.y+actor.originY-.5)*Math.abs(actor.displayHeight)*(ownerHint?.house?.riseScale??1),depth:p.z*Math.abs(actor.displayWidth)};
        (glow.getData(PRESENTATION_HINT) as PresentationHint).fixture=node.fixture;
      }
      if(spatial&&shape){
        const p=furniturePlacement(actor,shape,{x:0,y:0,width:0,heading:0,lift:0}),w=p.width,H=shape.rise;
        const art=shape.art,bulb=art==='lantern'||art==='lampPost',brazier=art==='brazier';
        if(tree||bulb||brazier){
          const lamp=tree?LIFE_TREE_LIGHTS[index]:undefined;
          const right=lamp?.[0]??(art==='lampPost'?shape.ornamentX??.25:0);
          const height=lamp?lamp[1]*H:H*(brazier?.76:art==='lantern'?.46:.56);
          const depth=lamp?.[2]??-shape.depth/2;
          const a=shape.heading??0,c=Math.cos(a),sn=Math.sin(a);
          node.fixture={owner:actor,right:((shape.footX??0)+right*c-depth*sn)*w,
            height:p.lift+height*w,depth:((shape.footY??0)+right*sn+depth*c)*w};
          // Glass panes are opaque in the inexpensive depth prepass. Permit
          // only this bulb's own housing, not the depth of another building.
          node.occlusionBias=bulb?Math.min(.13,shape.depth*.40)*w+2:tree?.028*w+2:3;
          const hint=glow.getData(PRESENTATION_HINT) as PresentationHint;
          hint.fixture=node.fixture;hint.lightOcclusionBias=node.occlusionBias;
        }
      }
      this.lights.add(node);owned.push(node);
    }
    const ownedEmissions:Phaser.GameObjects.Sprite[]=[];
    const volumeTree=key==='elarion_tree'&&this.scene.game.registry.get('presentation')==='three-2.5d';
    if(this.scene.textures.exists(key+':emission')) {
      if(!tree&&this.scene.textures.exists(key+':rune-glow')){
        const runeGlow=this.scene.add.sprite(actor.x,actor.y,key+':rune-glow',frame).setOrigin(actor.originX,actor.originY)
          .setScale(actor.scaleX,actor.scaleY).setRotation(actor.rotation).setDepth(actor.depth+.004)
          .setBlendMode(Phaser.BlendModes.ADD).setData('emissionOwner',actor).setData('emissionType','tree-rune-glow')
          .setVisible(false).setName('tree-rune-glow:'+actor.name);
        if(this.scene.game.registry.get('presentation')==='three-2.5d')onPlane(runeGlow,'upright',actor);else onOverlay(runeGlow,actor);
        if(volumeTree)runeGlow.setData('volumeRune',true);this.emissions.add(runeGlow);ownedEmissions.push(runeGlow);
      }
      const emission=this.scene.add.sprite(actor.x,actor.y,key+':emission',frame).setOrigin(actor.originX,actor.originY)
        .setScale(actor.scaleX,actor.scaleY).setRotation(actor.rotation).setDepth(actor.depth+.006).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0)
        .setData('emissionOwner',actor).setVisible(false).setName('window-emission:'+actor.name);
      if(this.scene.textures.exists(key+':rune-glow')){
        emission.setData('emissionType','tree-runes').setName('tree-rune-emission:'+actor.name);
        if(volumeTree)emission.setData('volumeRune',true);
      }
      // Physical windows/lantern panes use their owner's actual mesh and the
      // world depth test. Screen overlays made them shine through other houses.
      if(this.scene.game.registry.get('presentation')==='three-2.5d')onPlane(emission,'upright',actor);else onOverlay(emission,actor);
      this.emissions.add(emission);ownedEmissions.push(emission);
    }
    actor.once('presentation-retired',()=>{for(const node of owned){node.glow.setVisible(false);node.cutout.setVisible(false);}for(const emission of ownedEmissions)emission.setVisible(false);});
    actor.once('destroy',()=>{
      for(const node of owned){this.lights.delete(node);node.glow.destroy();node.cutout.destroy();}
      for(const emission of ownedEmissions){this.emissions.delete(emission);emission.destroy();}
      this.renderAccumulator=100;
      this.maskDirty=true;
    });
    this.renderAccumulator=100;
    this.maskDirty=true;
  }
  isIlluminated(x:number,y:number) {
    if(nightStrength(this.minuteOfDay)<.7)return true;
    const ground=projectGroundPoint(this.scene,x,y,this.groundPoint);
    for(const light of this.lights){
      if(!light.actor.active||!light.actor.visible)continue;
      const point=presentationAttachment(this.scene,light.actor,light.actor.x+light.x,light.actor.y+light.y,this.lightPoint);
      if(Math.hypot(ground.x-point.x,ground.y-point.y)<light.radius*.8)return true;
    }
    return false;
  }
  update(deltaMs:number,playerX:number,playerY:number) {
    this.elapsed+=deltaMs;this.minuteOfDay+=deltaMs/1000*2.5;
    if(this.minuteOfDay>=1440){this.day+=Math.floor(this.minuteOfDay/1440);this.minuteOfDay%=1440;}
    this.accumulator+=deltaMs;
    if(this.accumulator>700){this.accumulator=0;this.syncState();}
    const night=nightStrength(this.minuteOfDay);
    const effects=getGraphicEffects();
    const camera=this.scene.cameras.main,view=groundWorldView(this.scene);
    if(effects.lightBloom){
    for(const node of this.lights) {
      const x=node.actor.x+node.x,y=node.actor.y+node.y,r=node.radius;
      // Elevated lamps cannot be culled against a ground-only rectangle: its
      // shape changes as the camera turns. The presentation frustum handles
      // screen visibility after projecting the actual emitter.
      const spatial=this.scene.game.registry.get('presentation')==='three-2.5d';
      const distance=Math.hypot(node.actor.x-playerX,node.actor.y-playerY);
      const inRange=spatial?distance<VIEW_DISTANCE+r:x+r>=view.left&&x-r<=view.right&&y+r>=view.top&&y-r<=view.bottom;
      const visible=node.actor.active&&node.actor.visible&&effects.lightBloom&&night>0&&inRange;
      node.glow.setVisible(visible);
      if(night===0)node.glow.setAlpha(0);
      if(!visible)continue;
      const flicker=node.fire ? .92+Math.sin(this.elapsed*.013+node.phase)*.055+Math.sin(this.elapsed*.021+node.phase)*.025 : 1;
      const intensity=node.actor.texture.key==='elven_villas'?.28:.15;
      const t=spatial?Math.max(0,Math.min(1,(distance-FOG_START)/(VIEW_DISTANCE-FOG_START))):0;
      node.glow.setPosition(x,y).setAlpha(night*intensity*flicker*(1-t*t*(3-2*t)));
    }
    for(const emission of this.emissions){
      const owner=emission.getData('emissionOwner') as Phaser.GameObjects.Sprite;
      // Lit windows belong to the structure's draw order. Painting their
      // pixels above every actor makes a foreground character merge into it.
      const type=emission.getData('emissionType');
      if(type==='tree-runes'||type==='tree-rune-glow'){
        const pulse=(Math.sin(this.elapsed*.002+owner.x*.013+owner.y*.019)+1)/2;
        const runeGlow=type==='tree-rune-glow';
        const depth=runeGlow?1_000_002:1_000_003;
        if(emission.depth!==depth)emission.setDepth(depth);
        const intensity=emission.getData('volumeRune')===true?(runeGlow?.24:.55):(runeGlow?.48+.42*pulse:.88+.12*pulse);
        emission.setPosition(owner.x,owner.y).setAlpha(intensity)
          .setVisible(effects.lightBloom&&owner.visible);
      }else {
        // Ordinary lamp/window emissions are invisible by daylight or when
        // bloom is off. Avoid position/depth/alpha writes for every hidden
        // window on every gameplay frame. Rune effects stay independent.
        if(night<=0||!effects.lightBloom||!owner.visible){
          if(emission.visible)emission.setVisible(false);
          continue;
        }
        emission.setPosition(owner.x,owner.y);
        if(emission.depth!==owner.depth+.005)emission.setDepth(owner.depth+.005);
        emission.setAlpha(night*.8).setVisible(true);
      }
    }
    }else if(this.bloomWasEnabled){
      // Last enabled frame: hide all glow sprites once, not every frame.
      for(const node of this.lights)if(node.glow.visible)node.glow.setVisible(false);
      for(const emission of this.emissions)if(emission.visible)emission.setVisible(false);
    }
    this.bloomWasEnabled=effects.lightBloom;
    const showFireflies=effects.fireflies&&this.firefliesEnabled&&night>.02;
    if(showFireflies){
      const cx=Math.floor(playerX/1024)*1024+512,cy=Math.floor(playerY/1024)*1024+512;
      // Only calculate the animation when fireflies are enabled and visible.
      for(let i=0;i<this.fireflies.length;i++) {
        const fly=this.fireflies[i];
        const drift=this.elapsed*.00035,pulse=(Math.sin(this.elapsed*.003+fly.phase)+1)/2;
        const x=cx+fly.dx+Math.sin(drift+fly.phase)*32,y=cy+fly.dy+Math.cos(drift*.8+fly.phase)*24;
        fly.glow.setPosition(x,y).setAlpha(night*(.03+pulse*.22)).setVisible(!this.lightweight);
        fly.light.setPosition(x,y).setAlpha(night*(.12+pulse*.72)).setVisible(!this.lightweight||i<6);
      }
    }else if(this.firefliesWereEnabled){
      for(const fly of this.fireflies){
        if(fly.glow.visible)fly.glow.setVisible(false);
        if(fly.light.visible)fly.light.setVisible(false);
      }
    }
    this.firefliesWereEnabled=showFireflies;
    if(this.scene.game.registry.get('presentation')==='three-2.5d'){
      this.overlay.setVisible(false);return;
    }
    // With the GPU-heavy darkness/cutout effect off, leave its large texture
    // untouched and skip viewport projection, scale, lighting geometry and
    // every associated mask batch (including at night).
    if(night===0||!effects.nightDarkness){
      if(this.overlay.visible)this.overlay.setVisible(false);
      this.maskWorldOrigin=null;
      return;
    }
    if(!this.overlay.visible)this.overlay.setVisible(true);
    // Darkness strength is an image uniform, not another full-screen upload.
    this.overlay.setAlpha(night*.84);
    const full=overlayViewport(this.scene),resolution=this.lightweight ? .65 : 1;
    const z=full.zoom*resolution,pad=Math.round(this.maskPaddingCss*resolution);
    const w=this.texture.width,h=this.texture.height;
    const liveOrigin=projectedViewOrigin(this.scene,{x:0,y:0});
    this.renderAccumulator+=Math.max(0,deltaMs);
    const movement=this.maskWorldOrigin
      ? Math.max(Math.abs(liveOrigin.x-this.maskWorldOrigin.x),Math.abs(liveOrigin.y-this.maskWorldOrigin.y))*z
      : Infinity;
    // Keep masks reasonably fresh; the buffered image tracks camera motion
    // in the interim, without an expensive canvas redraw on every frame.
    const interval=this.lightweight?220:70;
    const force=!this.maskWorldOrigin||this.maskDirty||z!==this.maskWorldScale||movement>pad*.7;
    // Project lights once at the repaint cadence. Intermediate frames reuse
    // the buffered mask instead of building large strings and scanning twice.
    if(force||this.renderAccumulator>=interval) {
      this.renderAccumulator=0;
      const cutouts=this.cutouts;cutouts.length=0;
      let geometry='',animated=false;
      for(const node of this.lights) {
        if(!node.actor.active||!node.actor.visible)continue;
        const point=presentationAttachment(this.scene,node.actor,node.actor.x+node.x,node.actor.y+node.y,this.lightPoint);
        const x=(point.x-liveOrigin.x)*z+pad;
        const y=(point.y-liveOrigin.y)*z+pad;
        const r=node.radius*z;
        if(x+r<0||y+r<0||x-r>w||y-r>h) continue;
        if(this.lightweight&&cutouts.length>=18)break;
        node.cutout.setPosition(x,y).setDisplaySize(r*2,r*2).setFrame(nightLightFrame(node.fire,this.elapsed,node.phase));
        cutouts.push(node.cutout);
        geometry+=`${point.x},${point.y},${r},${node.phase},${node.fire};`;animated ||=node.fire;
      }
      if(force||animated||geometry!==this.maskGeometry){
        this.maskWorldOrigin={...liveOrigin};this.maskWorldScale=z;this.maskDirty=false;this.maskGeometry=geometry;
        this.texture.clear().fill(0x020611,1);
        if(cutouts.length)this.texture.erase(cutouts);
      }
      cutouts.length=0;
    }
    const paintedOrigin=this.maskWorldOrigin!;
    this.overlay.setDisplaySize(w/z,h/z).setPosition(
      camera.width/2*(1-1/camera.zoom)+paintedOrigin.x-liveOrigin.x-pad/z,
      camera.height/2*(1-1/camera.zoom)+paintedOrigin.y-liveOrigin.y-pad/z);
  }
  /** Teleports/respawns must repaint against the destination camera, not reuse
   * a previous town's cached light pockets. Does not advance the clock. */
  invalidateView(){this.maskWorldOrigin=null;this.maskWorldScale=0;this.maskDirty=true;this.renderAccumulator=200;}
  getHour(){return this.minuteOfDay/60;}
  /** Interior lamps share the existing light registry and actor teardown.
   * Their source is the modeled flame/pane, not a guessed screen coordinate. */
  registerInterior(actor:Phaser.GameObjects.Image,art:string){
    if(!['lantern','hearth','table','counter','workstation'].includes(art))return;
    const shape=(actor.getData(PRESENTATION_HINT) as PresentationHint|undefined)?.furniture;if(!shape)return;
    const p=furniturePlacement(actor,shape,{x:0,y:0,width:0,heading:0,lift:0}),w=p.width,H=shape.rise;
    const candle=art==='table'||art==='counter'||art==='workstation';
    const fixture={owner:actor,right:(candle?.28:0)*w,height:p.lift+H*w*(candle?1.24:art==='hearth'?.375:.46),depth:candle?-shape.depth*w*.75:art==='hearth'?-.055*w:-shape.depth*w/2};
    const occlusionBias=art==='lantern'?Math.min(.13,shape.depth*.40)*w+2:3;
    const radius=art==='hearth'?190:candle?115:150;
    const glow=this.scene.add.image(actor.x,actor.y,'warm-light').setDisplaySize(radius*2,radius*2)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(1_000_001).setVisible(false).setName('interior-light:'+art);
    glow.setData(PRESENTATION_HINT,{plane:'upright',overlay:true,occlude:true,fixture,lightOcclusionBias:occlusionBias} satisfies PresentationHint);
    const node:LocalLight={actor,x:0,y:0,radius,fire:true,phase:actor.x*.013+actor.y*.019,fixture,occlusionBias,glow,
      cutout:this.scene.make.image({key:'warm-light',add:false})};
    this.lights.add(node);
    actor.once('destroy',()=>{this.lights.delete(node);glow.destroy();node.cutout.destroy();this.maskDirty=true;});
  }
  sleepUntilMorning(){
    if(!innRestAvailable(this.minuteOfDay))return false;
    if(this.minuteOfDay>=INN_MORNING_MINUTE)this.day++;
    this.minuteOfDay=INN_MORNING_MINUTE;this.accumulator=0;
    this.invalidateView();this.syncState();
    return true;
  }
  syncState(){useGameStore.getState().setClock(this.day,this.minuteOfDay);}
  destroy(){
    window.removeEventListener(EFFECTS_QUALITY_EVENT,this.onQualityChange);
    this.scene.scale.off('resize',this.onResize,this);this.overlay.destroy();
    for(const node of this.lights){node.glow.destroy();node.cutout.destroy();}this.lights.clear();
    this.cutouts.length=0;
    for(const emission of this.emissions) emission.destroy();this.emissions.clear();
    for(const fly of this.fireflies){fly.glow.destroy();fly.light.destroy();}
    this.scene.textures.remove('night-overlay');
  }
  private onResize(){
    if(this.scene.game.registry.get('presentation')==='three-2.5d'){this.invalidateView();return;}
    const viewport=overlayViewport(this.scene);
    const resolution=this.lightweight ? .65 : 1;
    const pad=Math.round(this.maskPaddingCss*resolution);
    this.texture.setSize(
      Math.max(1,Math.round(viewport.width*resolution))+pad*2,
      Math.max(1,Math.round(viewport.height*resolution))+pad*2,false);
    this.invalidateView();
  }
}

// LEIGHNERON_MOBILE_GRAPHICS_NPC_FIX_V1
