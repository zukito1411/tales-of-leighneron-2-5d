import {onPlane} from '../presentation25d/plane';
import Phaser from 'phaser';
import type {ArtTextureKey} from '../../data/art';
import {isTreeArt,treeLayerKey} from '../../data/treeArt';
import type {Vec2} from '../types';
import type {GroundShadowSystem} from './GroundShadowSystem';
import {RABBIT_TEXTURE,RABBIT_CELL,RABBIT_FOOT,RABBIT_HEIGHT} from './RabbitArt';
import {SQUIRREL_TEXTURE,SQUIRREL_CELL,SQUIRREL_FOOT,SQUIRREL_HEIGHT} from './SquirrelArt';
import {coverPorts,rabbitHabitat,squirrelHabitat,squirrelGroundRoute,woodlandBirdHabitat,tidewatchGullHabitat,WildlifeCoverIndex,type WildlifeCover} from './wildlifeCover';
import {WoodlandBirdSystem} from './WoodlandBirdSystem';
import {WILDLIFE_TUNING as TUNING} from './wildlifeTuning';
import {wildlifeFacing,wildlifeInView} from './wildlifePresentation';

type Scenery=Phaser.GameObjects.Image|Phaser.GameObjects.Sprite;
export interface WildlifeHost {
  habitat(point:Vec2):{region:string;biome:string;terrain:string};
  clearRoute(from:Vec2,to:Vec2):boolean;
  /** Bird-only ground admission: roads/courts are allowed, solids/water are not. */
  birdSite?(point:Vec2):boolean;
  /** Harbor-anchored aerial route near Tidewatch; may cross roofs/shoreline. */
  gullFlyby?(player:Vec2):{from:Vec2;to:Vec2}|null;
  /** A checked, dry coastal resting site; returns the nearby open-water bearing. */
  coastalSite?(point:Vec2):Vec2|null;
}
interface GroundAnimal {
  species:'rabbit'|'squirrel';
  phase:'pending'|'ground'|'social'|'climb';
  social?:{stopAge:number;wait:number;until?:number};
  groupId?:number;
  groupRank?:number;
  pendingLeader?:GroundAnimal;
  sprite:Phaser.GameObjects.Sprite;
  source?:WildlifeCover;
  destination?:WildlifeCover;
  from:Vec2;
  to:Vec2;
  age:number;
  distance:number;
  duration:number;
  path:Vec2[];
  returning:boolean;
  blockedMs:number;
  direction:number;
  flip:boolean;
  heading:Vec2;
}

/** Ambient visuals, not enemies: no bodies, timers, health or saved records.
 * Four ground slots plus two shared bird slots keep the six-actor limit. */
export class AmbientWildlifeSystem {
  private readonly covers=new WildlifeCoverIndex();
  private readonly treePoints=new WildlifeCoverIndex();
  /** Bounded spatial lookup of streamed scenery, not a global tree scan. */
  hasTreeNear(point:Vec2,radius=350):boolean{
    return this.treePoints.nearby(point,radius).length>0;
  }
  private readonly animals:GroundAnimal[]=[];
  private readonly birds:WoodlandBirdSystem;
  private inside=new Set<number>();
  private readonly pendingRabbits=new Set<number>();
  private sequence=0;
  private elapsed=0;
  private scanMs=0;
  private nextEventAt=0;
  private preferSquirrel=true;
  private groupSequence=0;
  private lastPlayer?:Vec2;
  private destroyed=false;
  private readonly facing={row:0,flip:false};
  private readonly onVisibility=()=>{if(document.hidden)this.reset();};
  constructor(private readonly scene:Phaser.Scene,private readonly host:WildlifeHost,
    private readonly shadows:GroundShadowSystem,private readonly random:()=>number=Math.random){
    this.birds=new WoodlandBirdSystem(scene,host,this.covers,shadows,random,
      id=>this.animals.some(a=>a.source?.id===id||a.destination?.id===id));
    document.addEventListener('visibilitychange',this.onVisibility);
    const species=this.artReady('rabbit')?'rabbit':this.artReady('squirrel')?'squirrel':null;
    if(!species)return;
    for(let i=0;i<4;i++){
      const sprite=scene.add.sprite(0,0,species==='rabbit'?RABBIT_TEXTURE:SQUIRREL_TEXTURE,0)
        .setVisible(false).setActive(false).setName(`wildlife:animal:${i}`);
      shadows.register(sprite,false,{projection:0,contactScale:.6,contactHeight:.45});
      const animal:GroundAnimal={species,phase:'ground',sprite,path:[],from:{x:0,y:0},to:{x:0,y:0},
        age:0,distance:0,duration:0,returning:false,blockedMs:0,direction:0,flip:false,heading:{x:1,y:0}};
      onPlane(sprite,'upright',{get x(){return sprite.x;},get y(){return animal.phase==='climb'&&animal.destination?animal.destination.y:sprite.y;}});
      this.applyArt(animal,species);this.animals.push(animal);
    }
  }

  /** Called once by the shared world-sprite presentation path, before sway
   * replaces the tree texture. Bounds come from visible art, not PNG padding. */
  register(actor:Scenery,texture:ArtTextureKey,frame:number,bottom:Vec2,width:number,height:number){
    // Read against the actual cottage/inn/smithy and capital roof artwork.
    // Normalized points use visible bounds, never atlas padding or chimneys.
    const roofPoint=texture==='world_buildings'&&[0,1,2].includes(frame)
      ?{x:frame===2?.4:.30,y:frame===1?.32:.30}
      :texture==='capital_buildings'&&[0,1,5,6,7].includes(frame)?{x:.32,y:.32}:undefined;
    const shrub=texture==='woodland_props'&&(frame===3||frame===4)
      ||texture==='flora'&&(frame===3||frame===4);
    const tree=isTreeArt(texture,frame),coastalArt=texture==='port_dock'
      ||texture==='world_assets'&&frame===2
      ||texture==='woodland_props'&&[0,8,9].includes(frame)
      ||texture==='flora'&&frame===9;
    // Include native/dried trees even where ambient woodland fauna is absent.
    // This index shares scenery lifetime but never adds wildlife spawn sites.
    if(tree&&!this.destroyed&&Math.abs(actor.rotation)<=.01){
      const id=++this.sequence;
      this.treePoints.add({id,...bottom,width,height,depth:actor.depth,kind:'tree',climbable:false,cooldownUntil:0});
      actor.once('destroy',()=>this.treePoints.remove(id));
    }
    if(this.destroyed||Math.abs(actor.rotation)>.01||texture==='climate_props'||!tree&&!shrub&&!coastalArt&&!roofPoint)return;
    const habitat=this.host.habitat(bottom);
    const shore=(habitat.region==='portquill'&&habitat.biome==='coast'||tidewatchGullHabitat(bottom,habitat.region))
      &&(coastalArt||tree||shrub||roofPoint);
    const inlandBird=woodlandBirdHabitat(habitat.region,habitat.biome,habitat.terrain);
    if(!shore&&(!tree&&!shrub&&!roofPoint||width<42||height<36
      ||!rabbitHabitat(habitat.region,habitat.biome,habitat.terrain)&&!inlandBird))return;
    const cover:WildlifeCover={id:++this.sequence,...bottom,width,height,depth:actor.depth,
      kind:roofPoint?'roof':shore?'shore':tree?'tree':'shrub',climbable:!shore&&tree&&height>=100&&height<=480
        &&this.scene.textures.exists(treeLayerKey(texture,'wood'))
        &&this.scene.textures.exists(treeLayerKey(texture,'leaves')),cooldownUntil:0,
      // Oak's exposed right fork, read against the visible source silhouette.
      // Other trees offer ground feeding until their branches are authored.
      ...(!shore&&texture==='world_assets'&&frame===0?{perch:{x:bottom.x+width*.20,y:bottom.y-height*.41}}:{}),
      ...(roofPoint?{perch:{x:bottom.x+(roofPoint.x-.5)*width,y:bottom.y-(1-roofPoint.y)*height}}:{}),
      // Pier source: side cap at (390,1040), dry shore to the upper right.
      // Never perch on ropes or mistake the whole pier image for a deck.
      ...(shore&&texture==='port_dock'?{
        perch:{x:bottom.x-width*.14,y:bottom.y-height*.295},
        shoreFeed:{x:bottom.x+width*.35,y:bottom.y-height*.93},
      }:{}),
    };
    this.covers.add(cover);
    actor.once('destroy',()=>{
      this.covers.remove(cover.id);this.inside.delete(cover.id);
      this.pendingRabbits.delete(cover.id);
      this.birds.unregister(cover.id);
      for(const animal of this.animals)
        if(animal.source?.id===cover.id||animal.destination?.id===cover.id)this.release(animal);
    });
  }

  update(delta:number,player:Vec2,hour:number,paused:boolean){
    if(this.destroyed||paused||document.hidden||delta<=0)return;
    if(this.lastPlayer&&Math.hypot(player.x-this.lastPlayer.x,player.y-this.lastPlayer.y)>600)this.reset();
    this.lastPlayer={x:player.x,y:player.y};
    const step=Math.min(delta,100);this.elapsed+=step;this.scanMs+=step;
    const scan=this.scanMs>=125;
    if(scan){this.scanMs=0;this.checkEntry(player,hour);}
    // Bird replenishment has its own bounded cadence, so frequent rabbits
    // cannot starve the two reserved bird slots.
    this.birds.update(step,player,hour,scan,this.elapsed,true);
    for(const animal of this.animals){
      if(!animal.source)continue;
      this.refreshFacing(animal);
      if(animal.phase==='pending'){
        animal.age+=step;
        if(scan&&animal.age>=0){
          const leader=animal.pendingLeader;
          if(!leader?.source||leader.groupId!==animal.groupId||leader.source.id!==animal.source.id||leader.returning
            ||!this.start(animal,animal.source,player,'squirrel'))this.release(animal);
          else {animal.pendingLeader=undefined;this.planSquirrelMeeting(leader,animal,player);}
        }
        continue;
      }
      if(animal.phase==='climb'){this.updateClimb(animal,step);continue;}
      if(animal.phase==='social'){this.updateSocial(animal,step,player,scan);continue;}
      if(animal.groupRank===1&&animal.age>=400){
        const next=this.positionAt(animal,animal.age+step);
        if(this.animals.some(other=>other!==animal&&other.source&&other.phase==='ground'
          &&other.groupId===animal.groupId&&other.groupRank===0
          &&Math.hypot(next.x-other.sprite.x,next.y-other.sprite.y)<32))continue;
      }
      // Bounded scenery/patrol recovery: return along the already walked route
      // once. If that also closes, stop; release only offscreen or under cover.
      if(scan&&animal.age>=400){
        const next=this.positionAt(animal,Math.min(animal.duration,animal.age+125));
        if(!this.host.clearRoute(animal.sprite,next)){
          const returnPoint=!animal.returning?coverPorts(animal.source)
            .find(p=>this.host.clearRoute(animal.sprite,p)):undefined;
          if(returnPoint){
            animal.social=undefined;
            const source=animal.source;
            animal.from={x:animal.sprite.x,y:animal.sprite.y};
            animal.to=returnPoint;
            animal.path=[animal.from,animal.to];
            animal.destination=source;animal.returning=true;animal.age=400;animal.blockedMs=0;
            this.configureRoute(animal);
          }else{
            animal.blockedMs+=125;
            animal.sprite.setFrame(animal.direction*6).setFlipX(animal.flip);
            if(animal.blockedMs>1500&&!this.inView(animal.sprite))this.release(animal);
            continue;
          }
        }else animal.blockedMs=0;
      }
      if(animal.blockedMs>0)continue;
      animal.age+=step;
      if(animal.social)animal.age=Math.min(animal.age,animal.social.stopAge);
      const point=this.positionAt(animal,animal.age);
      if(Math.hypot(point.x-animal.sprite.x,point.y-animal.sprite.y)>.1)
        this.face(animal,animal.sprite,point);
      const hiding=(animal.species==='rabbit'||animal.returning)&&animal.age>animal.duration-450;
      const frame=animal.age<400?0:hiding?1:[2,3,4,5,1][Math.floor((animal.age-400)/90)%5];
      animal.sprite.setPosition(point.x,point.y).setDepth(point.y)
        .setFrame(animal.direction*6+frame).setFlipX(animal.flip)
        .setAlpha(animal.age<280?animal.age/280:hiding?Math.max(0,(animal.duration-animal.age)/450):1);
      if(animal.social&&animal.age>=animal.social.stopAge){
        animal.phase='social';animal.sprite.setFrame(animal.direction*6);continue;
      }
      const climbs=animal.species==='squirrel'&&!animal.returning;
      if(animal.age>=animal.duration-(climbs?450:0)){
        if(animal.species==='squirrel'&&!animal.returning){
          animal.phase='climb';animal.age=0;
          this.shadows.setEnabled(animal.sprite,false);
          this.updateClimb(animal,0);
        }else this.release(animal);
      }else if(!this.inView(point)&&Math.hypot(point.x-player.x,point.y-player.y)>900)this.release(animal);
    }
  }

  private inView(point:Vec2){
    return wildlifeInView(this.scene,point,0,80);
  }
  private checkEntry(player:Vec2,hour:number){
    const nearby=this.covers.nearby(player,260),inside=new Set<number>();
    for(const cover of nearby){
      const distance=Math.hypot(cover.x-player.x,cover.y-player.y);
      if(distance>220)continue;
      if(this.inside.has(cover.id))inside.add(cover.id);
      if(cover.kind==='shore'||cover.kind==='roof')continue;
      if(hour<6.5||hour>18.5||this.elapsed<this.nextEventAt||cover.cooldownUntil>this.elapsed
        ||(cover.groundRetryAt??0)>this.elapsed||!this.inView(cover))continue;
      const animal=this.animals.find(r=>!r.source);if(!animal)continue;
      if(this.animals.some(r=>r.source?.id===cover.id||r.destination?.id===cover.id))continue;
      if(this.birds.occupies(cover.id))continue;
      const habitat=this.host.habitat(cover);
      const canSquirrel=cover.climbable&&squirrelHabitat(habitat.region,habitat.biome,habitat.terrain)
        &&this.artReady('squirrel');
      // Rabbits get an independent 80% roll per eligible cover entry. A
      // cooldown/full pool no longer silently consumes an unrolled entry.
      if(!this.inside.has(cover.id)&&rabbitHabitat(habitat.region,habitat.biome,habitat.terrain)
        &&this.artReady('rabbit')&&this.random()<TUNING.rabbitChance)
        this.pendingRabbits.add(cover.id);
      const rabbit=this.pendingRabbits.has(cover.id);
      inside.add(cover.id);
      // Tree squirrels get bounded repeat opportunities while nearby, rather
      // than depending entirely on the player leaving/re-entering the grove.
      const squirrel=canSquirrel&&this.random()<TUNING.squirrelChance;
      cover.groundRetryAt=this.elapsed+TUNING.retryMs;
      if(!rabbit&&!squirrel)continue;
      const species=squirrel&&(!rabbit||this.preferSquirrel)?'squirrel':'rabbit';
      // One route search per scan. Alternate successful species when both
      // rolls pass so common squirrels don't replace every eligible rabbit.
      this.nextEventAt=this.elapsed+1000;
      if(this.start(animal,cover,player,species)){
        if(species==='squirrel')this.reserveSquirrelCompanion(animal);
        if(species==='rabbit')this.pendingRabbits.delete(cover.id);
        this.preferSquirrel=species!=='squirrel';
        cover.cooldownUntil=this.elapsed+TUNING.coverRestMin+this.random()*TUNING.coverRestRange;
        this.nextEventAt=this.elapsed+TUNING.groundGapMin+this.random()*TUNING.groundGapRange;
      }
      break;
    }
    // Preserve already rolled entries after an early successful attempt.
    for(const cover of nearby)if(this.inside.has(cover.id)&&Math.hypot(cover.x-player.x,cover.y-player.y)<=220)inside.add(cover.id);
    for(const id of this.pendingRabbits)if(!inside.has(id))this.pendingRabbits.delete(id);
    this.inside=inside;
  }
  private start(animal:GroundAnimal,source:WildlifeCover,player:Vec2,species:GroundAnimal['species']){
    const candidates=this.covers.nearby(source,500)
      .filter(c=>c.kind!=='shore'&&c.kind!=='roof'&&c.id!==source.id&&Math.hypot(c.x-source.x,c.y-source.y)>=200
        &&c.cooldownUntil<=this.elapsed&&!this.birds.occupies(c.id)
        &&!this.animals.some(r=>r.source?.id===c.id||r.destination?.id===c.id)
        &&(species==='rabbit'||c.climbable&&this.squirrelCover(c)));
    // Rotate, don't sort/shuffle the whole loaded forest; bound route work.
    const offset=Math.floor(this.random()*candidates.length);
    let probes=0;
    for(let i=0;i<Math.min(6,candidates.length);i++){
      const destination=candidates[(i+offset)%candidates.length];
      for(const from of coverPorts(source))for(const to of coverPorts(destination)){
        const distance=Math.hypot(to.x-from.x,to.y-from.y);
        if(distance<150||distance>550||Math.hypot(from.x-player.x,from.y-player.y)<70)continue;
        if(++probes>12)return false;
        const path=species==='squirrel'?squirrelGroundRoute(from,to,destination):[from,to];
        if(path.slice(1).some((p,index)=>!this.host.clearRoute(path[index],p)))continue;
        this.applyArt(animal,species);animal.phase='ground';animal.path=path;
        animal.source=source;animal.destination=destination;animal.from=from;animal.to=path[path.length-1];
        animal.age=0;animal.returning=false;animal.blockedMs=0;this.configureRoute(animal);
        destination.cooldownUntil=this.elapsed+TUNING.coverRestMin+this.random()*TUNING.coverRestRange;
        animal.sprite.setPosition(from.x,from.y).setDepth(from.y).setAlpha(0).setActive(true).setVisible(true);
        return true;
      }
    }
    return false;
  }
  private configureRoute(animal:GroundAnimal){
    animal.distance=animal.path.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-animal.path[i].x,p.y-animal.path[i].y),0);
    animal.duration=850+animal.distance/(animal.species==='squirrel'?160:125)*1000;
    this.face(animal,animal.from,animal.path[1]??animal.to);
  }
  private reserveSquirrelCompanion(leader:GroundAnimal){
    if(this.random()>=TUNING.squirrelGroupChance)return;
    const companion=this.animals.find(a=>!a.source);if(!companion)return;
    const id=++this.groupSequence;leader.groupId=id;leader.groupRank=0;
    leader.sprite.setData('wildlifeGroup',id);
    // Reserve a real pool slot, but defer its route search to a later scan.
    // Each member needs its own destination; failed admission stays solitary.
    companion.source=leader.source;companion.destination=undefined;
    companion.groupId=id;companion.groupRank=1;companion.pendingLeader=leader;
    companion.phase='pending';companion.age=-TUNING.squirrelCompanionDelay;
    companion.sprite.setActive(false).setVisible(false).setData('wildlifeGroup',id);
  }
  private positionAt(animal:GroundAnimal,age:number):Vec2{
    const t=Phaser.Math.Clamp((age-400)/Math.max(1,animal.duration-850),0,1);
    let remaining=t*animal.distance;
    for(let i=1;i<animal.path.length;i++){
      const from=animal.path[i-1],to=animal.path[i],length=Math.hypot(to.x-from.x,to.y-from.y);
      if(length>0&&remaining<=length){const fraction=remaining/length;
        return {x:Phaser.Math.Linear(from.x,to.x,fraction),y:Phaser.Math.Linear(from.y,to.y,fraction)};}
      remaining-=length;
    }
    return animal.to;
  }
  /** A single checked detour per pair; never snap either animal into place. */
  private planSquirrelMeeting(leader:GroundAnimal,companion:GroundAnimal,player:Vec2){
    if(leader.phase!=='ground'||leader.returning||leader.blockedMs>0||leader.age>=leader.duration-450)return;
    const tree=leader.source;if(!tree)return;
    const from={x:leader.sprite.x,y:leader.sprite.y};
    // Meet beside the source trunk, beneath the crown rather than halfway
    // across an open field. Both paths still skirt the physical root contour.
    const side=from.x<tree.x?-1:1;
    const point={x:tree.x+side*(tree.width*.38+18),y:tree.y+26};
    const partner={x:point.x+side*44,y:point.y+8};
    if(Math.hypot(point.x-player.x,point.y-player.y)<110
      ||Math.hypot(partner.x-player.x,partner.y-player.y)<110)return;
    const routes=[{animal:leader,path:[from,point,...leader.path.slice(1)]},
      {animal:companion,path:[{x:companion.sprite.x,y:companion.sprite.y},partner,...companion.path.slice(1)]}];
    // Only new segments need admission; unchanged tails were already checked.
    if(!this.host.clearRoute(point,partner)||routes.some(({path})=>
      !this.host.clearRoute(path[0],path[1])||!this.host.clearRoute(path[1],path[2])))return;
    for(const {animal,path} of routes){
      animal.path=path;animal.from=path[0];animal.age=400;this.configureRoute(animal);
      animal.social={stopAge:400+Math.hypot(path[1].x-path[0].x,path[1].y-path[0].y)/160*1000,wait:0};
    }
  }
  private updateSocial(animal:GroundAnimal,delta:number,player:Vec2,scan:boolean){
    const social=animal.social;
    const partner=this.animals.find(other=>other!==animal&&other.source&&other.groupId===animal.groupId
      &&other.social&&(other.phase==='ground'||other.phase==='social'));
    if(!social||!partner||Math.hypot(animal.sprite.x-player.x,animal.sprite.y-player.y)<100
      ||scan&&!this.host.clearRoute(animal.sprite,animal.sprite)){
      this.finishSocial(animal);return;
    }
    social.wait+=delta;
    if(partner.phase==='social'&&social.until===undefined){
      social.until=this.elapsed+TUNING.socialDuration;partner.social!.until=social.until;
    }
    if((social.until!==undefined&&this.elapsed>=social.until)
      ||(social.until===undefined&&social.wait>TUNING.socialWaitLimit)){
      this.finishSocial(animal);this.finishSocial(partner);return;
    }
    this.face(animal,animal.sprite,partner.phase==='social'?partner.sprite:partner.path[1]);
    animal.sprite.setFrame(animal.direction*6).setFlipX(animal.flip).setAlpha(1)
      .setData('wildlifeSocializing',partner.phase==='social');
  }
  private finishSocial(animal:GroundAnimal){
    animal.social=undefined;if(animal.phase==='social')animal.phase='ground';
    animal.sprite.setData('wildlifeSocializing',false);
  }
  private face(animal:GroundAnimal,from:Vec2,to:Vec2){
    const dx=to.x-from.x,dy=to.y-from.y;
    if(Math.hypot(dx,dy)>.01){animal.heading.x=dx;animal.heading.y=dy;}
    this.refreshFacing(animal);
  }
  private refreshFacing(animal:GroundAnimal){
    wildlifeFacing(this.scene,animal.heading,this.facing);
    animal.direction=this.facing.row;animal.flip=this.facing.flip;
  }
  private squirrelCover(cover:WildlifeCover){const habitat=this.host.habitat(cover);
    return squirrelHabitat(habitat.region,habitat.biome,habitat.terrain);}
  private artReady(species:GroundAnimal['species']){
    return this.scene.textures.exists(species==='rabbit'?RABBIT_TEXTURE:SQUIRREL_TEXTURE)
      &&Number(this.scene.registry.get(species+'VisibleHeight'))>0;
  }
  private applyArt(animal:GroundAnimal,species:GroundAnimal['species']){
    const rabbit=species==='rabbit';animal.species=species;
    animal.sprite.setTexture(rabbit?RABBIT_TEXTURE:SQUIRREL_TEXTURE,0)
      .setOrigin(.5,(rabbit?RABBIT_FOOT:SQUIRREL_FOOT)/(rabbit?RABBIT_CELL:SQUIRREL_CELL))
      .setScale((rabbit?RABBIT_HEIGHT:SQUIRREL_HEIGHT)/Number(this.scene.registry.get(species+'VisibleHeight')));
    this.shadows.setEnabled(animal.sprite,true);
  }
  private updateClimb(animal:GroundAnimal,delta:number){
    const tree=animal.destination;if(!tree){this.release(animal);return;}
    animal.age+=delta;
    const duration=Phaser.Math.Clamp((22+tree.height*.48)/90*1000,1400,2800);
    const t=Phaser.Math.Clamp(animal.age/duration,0,1),hiding=animal.age>duration-350;
    const x=Phaser.Math.Linear(animal.to.x,tree.x,t),y=Phaser.Math.Linear(animal.to.y,tree.y-tree.height*.48,t);
    // Wood sorts at tree.depth, leaves at tree.depth+.01. Keep the entire
    // animal on the trunk plane; its elevated screen y is not ground depth.
    animal.sprite.setPosition(x,y).setDepth(tree.depth+.005).setFlipX(false)
      .setFrame(hiding?23:animal.age<220?18:19+Math.floor((animal.age-220)/110)%4)
      .setAlpha(hiding?Math.max(0,(duration-animal.age)/350):1);
    if(animal.age>=duration)this.release(animal);
  }
  private release(animal:GroundAnimal){
    this.finishSocial(animal);
    animal.groupId=undefined;animal.groupRank=undefined;animal.pendingLeader=undefined;
    animal.sprite.setData('wildlifeGroup',null);
    animal.source=undefined;animal.destination=undefined;animal.sprite.setVisible(false).setActive(false);
  }
  /** Travel/hidden-tab cleanup preserves loaded anchors and their cooldowns. */
  reset(){for(const animal of this.animals)this.release(animal);this.inside.clear();this.lastPlayer=undefined;
    this.pendingRabbits.clear();
    this.birds.reset(this.elapsed);
    this.nextEventAt=Math.max(this.nextEventAt,this.elapsed+TUNING.groundGapMin);}
  destroy(){if(this.destroyed)return;this.destroyed=true;this.reset();
    document.removeEventListener('visibilitychange',this.onVisibility);
    this.birds.destroy();
    for(const animal of this.animals)animal.sprite.destroy();this.animals.length=0;this.covers.clear();this.treePoints.clear();}
}
