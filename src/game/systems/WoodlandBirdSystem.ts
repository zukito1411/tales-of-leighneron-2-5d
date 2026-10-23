import {groundWorldView,onPlane} from '../presentation25d/plane';
import Phaser from 'phaser';
import type {Vec2} from '../types';
import type {WildlifeHost} from './AmbientWildlifeSystem';
import type {GroundShadowSystem} from './GroundShadowSystem';
import {woodlandBirdHabitat,tidewatchGullHabitat,WildlifeCoverIndex,type WildlifeCover} from './wildlifeCover';
import {BIRD_TEXTURE,BIRD_CELL,BIRD_FOOT,BIRD_HEIGHT} from './WoodlandBirdArt';
import {GULL_TEXTURE,GULL_HEIGHT} from './CoastalGullArt';
import {WILDLIFE_TUNING as TUNING} from './wildlifeTuning';
import {wildlifeFacing,wildlifeInView} from './wildlifePresentation';

type BirdSpecies='robin'|'gull';
const ART={robin:{texture:BIRD_TEXTURE,height:BIRD_HEIGHT,registry:'woodlandBirdVisibleHeight'},
  gull:{texture:GULL_TEXTURE,height:GULL_HEIGHT,registry:'coastalGullVisibleHeight'}} as const;

interface Bird {
  sprite:Phaser.GameObjects.Sprite;
  species:BirdSpecies;
  seaward?:Vec2;
  cover?:WildlifeCover;
  ground:Vec2;
  direction:Vec2;
  altitude:number;
  perch:boolean;
  phase:'arrival'|'rest'|'flight';
  restPoint:Vec2;
  arrivalFrom:Vec2;
  arrivalDuration:number;
  age:number;
  restDuration:number;
  row:number;
  flip:boolean;
  groupId?:number;
  social?:{until:number;direction:Vec2};
  nextSocialAt?:number;
  departureDelay?:number;
  departureDirection?:Vec2;
}

/** Two shared robin/gull slots use the parent's loaded cover index and clock.
 * Birds arrive from beyond the visible margin, land, then depart when startled.
 * No physics, saved content, individual sounds, lights or spawn timers. */
export class WoodlandBirdSystem {
  private readonly birds:Bird[]=[];
  private nextEventAt=0;
  private groupSequence=0;
  private preferFlyby=true;
  constructor(private readonly scene:Phaser.Scene,private readonly host:WildlifeHost,
    private readonly covers:WildlifeCoverIndex,private readonly shadows:GroundShadowSystem,
    private readonly random:()=>number,private readonly groundOccupied:(id:number)=>boolean){
    const species=this.artReady('robin')?'robin':this.artReady('gull')?'gull':null;
    if(!species)return;
    const art=ART[species],height=Number(scene.registry.get(art.registry));
    for(let i=0;i<2;i++){
      const sprite=scene.add.sprite(0,0,art.texture,0).setOrigin(.5,BIRD_FOOT/BIRD_CELL)
        .setScale(art.height/height).setActive(false).setVisible(false).setName(`wildlife:bird:${i}`);
      shadows.register(sprite,false,{projection:0,contactScale:.4,contactHeight:.4});
      const bird:Bird={sprite,species,ground:{x:0,y:0},direction:{x:1,y:0},altitude:0,perch:false,
        phase:'rest',restPoint:{x:0,y:0},arrivalFrom:{x:0,y:0},arrivalDuration:0,
        age:0,restDuration:0,row:0,flip:false};
      onPlane(sprite,'upright',{get x(){return bird.ground.x;},get y(){return bird.ground.y;}});
      this.birds.push(bird);
    }
  }
  occupies(id:number){return this.birds.some(b=>b.cover?.id===id);}
  unregister(id:number){for(const bird of this.birds)if(bird.cover?.id===id)this.release(bird);}
  update(delta:number,player:Vec2,hour:number,scan:boolean,now:number,allowSpawn:boolean){
    let spawned=false;
    if(scan)spawned=this.checkEntry(player,hour,now,allowSpawn);
    for(const bird of this.birds){
      if(!bird.cover)continue;
      if(bird.departureDelay!==undefined){
        bird.departureDelay-=delta;
        if(bird.departureDelay<=0){
          const direction=bird.departureDirection;
          bird.departureDelay=undefined;bird.departureDirection=undefined;
          this.takeOff(bird,player,direction);
        }
      }
      if(bird.age<0){bird.age=Math.min(0,bird.age+delta);continue;}
      bird.sprite.setAlpha(1);
      bird.age+=delta;
      if(bird.phase==='arrival'&&!this.arrive(bird,player,scan))continue;
      if(bird.phase==='rest'){
        const distance=Math.hypot(bird.ground.x-player.x,bird.ground.y-player.y);
        if(distance>1450&&!this.birdInView(bird,100)){this.release(bird);continue;}
        if(scan&&bird.departureDelay===undefined
          &&(distance<(bird.species==='gull'?190:150)||bird.age>bird.restDuration||hour<6.5||hour>18.5))this.startleFlock(bird,player);
        else{
          this.updateSocial(bird,player,now);
          this.refreshFacing(bird);
          const peck=!bird.perch&&bird.age%2500>1750&&bird.age%2500<2150;
          bird.sprite.setFrame(bird.row*6+(peck?1:0)).setFlipX(bird.flip);continue;
        }
      }
      const seconds=delta/1000;
      const gull=bird.species==='gull',speed=gull?120+Math.min(300,bird.age*.035):100+Math.min(320,bird.age*.045);
      bird.ground.x+=bird.direction.x*speed*seconds;bird.ground.y+=bird.direction.y*speed*seconds;
      const targetHeight=Math.max(gull?120:90,bird.cover.height*.65);
      bird.altitude+=Math.min(targetHeight-bird.altitude,110*seconds);
      const launch=gull?440:280,gliding=gull&&bird.age>1400&&bird.age%4200>3000;
      const frame=bird.age<launch?2:gliding?4:[3,4,5,4][Math.floor((bird.age-launch)/(gull?140:85))%4];
      this.refreshFacing(bird);
      bird.sprite.setPosition(bird.ground.x,bird.ground.y-bird.altitude)
        .setDepth(Math.max(bird.cover.depth+.02,bird.ground.y+bird.altitude))
        .setFrame(bird.row*6+frame).setFlipX(bird.flip);
      // Do not fade out over open sky just because a flight timeout elapsed.
      if(bird.age>600&&!this.birdInView(bird,160))this.release(bird);
    }
    return spawned;
  }
  private birdInView(bird:Bird,margin:number){return wildlifeInView(this.scene,bird.ground,bird.altitude,margin);}
  private refreshFacing(bird:Bird){wildlifeFacing(this.scene,bird.direction,bird);}
  private checkEntry(player:Vec2,hour:number,now:number,allowSpawn:boolean){
    if(!this.birds.length||!allowSpawn||now<this.nextEventAt||hour<6.5||hour>18.5
      ||!this.birds.some(b=>!b.cover))return false;
    const flyby=this.artReady('gull')?this.host.gullFlyby?.(player):null;
    if(flyby&&(this.preferFlyby||this.birds.some(b=>b.cover&&b.phase==='rest'))){
      this.startSeaFlyby(flyby,player,now);return true;
    }
    const view=groundWorldView(this.scene);
    // Keep offscreen resting opportunities on larger PC viewports too,
    // without demanding cover beyond the loaded neighborhood.
    const radius=Math.min(1100,Math.max(600,Math.min(view.width,view.height)/2+200));
    const nearby=this.covers.nearby(player,radius);
    // Replenish the visible habitat first instead of filling both slots with
    // distant offscreen birds while the player stands still. This local sort
    // runs only on a refill opportunity, not on every movement/frame update.
    const score=(cover:WildlifeCover)=>{
      const point=cover.shoreFeed??cover.perch??{x:cover.x,y:cover.y+18};
      const ground=point===cover.perch?{x:point.x,y:cover.y}:point,altitude=ground.y-point.y;
      return (wildlifeInView(this.scene,ground,altitude,0)?0:3000)+Math.hypot(point.x-player.x,point.y-player.y);
    };
    nearby.sort((a,b)=>score(a)-score(b));
    let spawned=false;
    let probes=0;
    for(const cover of nearby){
      if(Math.hypot(cover.x-player.x,cover.y-player.y)>radius-50)continue;
      if(spawned||!allowSpawn||now<this.nextEventAt||(cover.birdRetryAt??0)>now
        ||hour<6.5||hour>18.5||cover.cooldownUntil>now
        ||this.groundOccupied(cover.id)||this.occupies(cover.id))continue;
      const habitat=this.host.habitat(cover);
      const gullHabitat=habitat.region==='portquill'&&habitat.biome==='coast'||tidewatchGullHabitat(cover,habitat.region);
      const species:BirdSpecies=gullHabitat?'gull':'robin';
      const suitable=species==='gull'?gullHabitat
        :woodlandBirdHabitat(habitat.region,habitat.biome,habitat.terrain);
      if(!suitable||!this.artReady(species))continue;
      const bird=this.birds.find(b=>!b.cover);if(!bird)continue;
      if(++probes>4)continue;
      cover.birdRetryAt=now+TUNING.retryMs;
      if(this.random()>=TUNING.birdChance)continue;
      const side=this.random()<.5?-1:1;
      const roof=cover.kind==='roof';
      let feed=cover.shoreFeed??{x:cover.x+side*(cover.width*.6+18),y:cover.y+18};
      // Nearby open streets/courts are valid feeding places as well as roots.
      // Only two extra footprint probes per admission; no world-wide searches.
      if(!roof&&species==='robin'&&this.host.birdSite){
        for(const candidate of [{x:cover.x,y:cover.y+90},{x:cover.x+side*(cover.width*.6+70),y:cover.y+40}]){
          if(this.host.birdSite(candidate)){feed=candidate;break;}
        }
      }
      // Tree perches need a checked nearby ground site. Authored rooftops
      // instead use inspected roof pixels; their foundations are not feeding sites.
      const seaward=species==='gull'?this.host.coastalSite?.(feed):undefined;
      if(!roof&&(species==='gull' ? !seaward : !this.groundSite(feed)))continue;
      const perch=roof||Boolean(cover.perch)&&this.random()<.5;
      const point=perch?cover.perch!:feed;
      if(!point||Math.hypot((roof?cover:feed).x-player.x,(roof?cover:feed).y-player.y)<220)continue;
      this.placeBird(bird,cover,species,point,perch,side<0,seaward??undefined);
      const companion=this.birds.find(b=>!b.cover);
      if(!roof&&companion&&probes<4&&this.random()<TUNING.birdGroupChance){
        ++probes;
        const spacing=species==='gull'?64:36;
        const companionPoint={x:feed.x+side*spacing,y:feed.y+16};
        const companionHabitat=this.host.habitat(companionPoint);
        const native=species==='gull'?(companionHabitat.region==='portquill'&&companionHabitat.biome==='coast'
          ||tidewatchGullHabitat(companionPoint,companionHabitat.region))
          :woodlandBirdHabitat(companionHabitat.region,companionHabitat.biome,companionHabitat.terrain);
        const companionSea=species==='gull'?this.host.coastalSite?.(companionPoint):undefined;
        const clear=species==='gull'?Boolean(companionSea)
          :this.groundSite(companionPoint);
        if(native&&clear&&Math.hypot(point.x-companionPoint.x,point.y-companionPoint.y)>=spacing
          &&Math.hypot(companionPoint.x-player.x,companionPoint.y-player.y)>=220){
          const id=++this.groupSequence;bird.groupId=id;bird.sprite.setData('wildlifeGroup',id);
          this.placeBird(companion,cover,species,companionPoint,false,side<0,companionSea??undefined);
          companion.groupId=id;companion.sprite.setData('wildlifeGroup',id);
          if(bird.phase==='arrival'&&companion.phase==='arrival'){
            // Same entry edge, with wing-safe separation, not two coincident
            // sprites tracing the exact same flight/landing path.
            const dx=point.x-bird.arrivalFrom.x,dy=point.y-bird.arrivalFrom.y,length=Math.max(1,Math.hypot(dx,dy));
            companion.arrivalFrom={x:bird.arrivalFrom.x-dy/length*spacing,y:bird.arrivalFrom.y+dx/length*spacing};
            companion.sprite.setPosition(companion.arrivalFrom.x,companion.arrivalFrom.y);
            companion.ground={x:companion.arrivalFrom.x,y:companion.arrivalFrom.y+companion.altitude};
            companion.arrivalDuration=bird.arrivalDuration;
            companion.row=bird.row;companion.flip=bird.flip;
          }
          companion.age=-TUNING.birdCompanionDelay;companion.sprite.setAlpha(0);
        }
      }
      cover.cooldownUntil=now+TUNING.coverRestMin+this.random()*TUNING.coverRestRange;
      this.preferFlyby=true;
      this.nextEventAt=now+(species==='gull'?1000:TUNING.birdGapMin)
        +this.random()*(species==='gull'?1000:TUNING.birdGapRange);spawned=true;
    }
    if(!spawned&&flyby){this.startSeaFlyby(flyby,player,now);return true;}
    if(!spawned)this.nextEventAt=now+1000;
    return spawned;
  }
  private placeBird(bird:Bird,cover:WildlifeCover,species:BirdSpecies,point:Vec2,perch:boolean,flip:boolean,seaward?:Vec2){
    this.finishSocial(bird);bird.nextSocialAt=undefined;
    const art=ART[species];bird.species=species;bird.seaward=seaward;
    bird.groupId=undefined;bird.departureDelay=undefined;bird.departureDirection=undefined;
    bird.sprite.setTexture(art.texture,0).setScale(art.height/Number(this.scene.registry.get(art.registry)))
      .setData('wildlifeSpecies',species).setData('wildlifeGroup',null);
    bird.cover=cover;bird.perch=perch;bird.age=0;bird.restPoint={...point};
    bird.ground={x:point.x,y:perch?cover.y:point.y};bird.altitude=bird.ground.y-point.y;
    bird.restDuration=TUNING.birdRestMin+this.random()*TUNING.birdRestRange;bird.row=0;bird.flip=flip;
    bird.direction={x:flip?-1:1,y:0};this.refreshFacing(bird);
    bird.sprite.setPosition(point.x,point.y).setDepth(perch?cover.depth+.02:point.y)
      .setFrame(bird.row*6).setFlipX(bird.flip).setAlpha(1).setActive(true).setVisible(true);
    this.shadows.setEnabled(bird.sprite,!perch);
    if(this.birdInView(bird,80))this.beginArrival(bird);
    else bird.phase='rest';
  }
  private groundSite(point:Vec2){
    return this.host.birdSite?.(point)??this.host.clearRoute(point,{x:point.x+8,y:point.y});
  }
  private startSeaFlyby(route:{from:Vec2;to:Vec2},player:Vec2,now:number){
    const reverse=this.random()<.5,from=reverse?route.to:route.from,to=reverse?route.from:route.to;
    const length=Math.max(1,Math.hypot(to.x-from.x,to.y-from.y));
    const direction={x:(to.x-from.x)/length,y:(to.y-from.y)/length};
    // Temporary flight owner, not scenery, enemy content or a saved entity.
    // The existing bird pool, offscreen release and parent reset own its life.
    const id=++this.groupSequence;
    const owner:WildlifeCover={id:-id,...from,width:1,height:0,depth:from.y,
      kind:'shore',climbable:false,cooldownUntil:0};
    let count=0;
    for(const bird of this.birds){
      // Keep the other shared slot available for a roof/shore bird.
      if(bird.cover||count>=1)continue;
      const point={x:from.x,y:from.y+count*72};
      this.placeBird(bird,owner,'gull',point,false,direction.x<0,direction);
      this.takeOff(bird,player,direction);
      bird.ground.x=point.x;bird.ground.y=point.y;
      bird.altitude=120;bird.age=440;
      bird.sprite.setPosition(point.x,point.y-120).setDepth(point.y+120)
        .setFrame(bird.row*6+4).setData('wildlifeGroup',id);
      bird.groupId=id;
      count++;
    }
    this.preferFlyby=false;
    this.nextEventAt=now+1000+this.random()*1000;
  }
  private beginArrival(bird:Bird){
    const view=groundWorldView(this.scene),p=bird.restPoint;
    const entries=[{x:view.x-180,y:p.y},{x:view.right+180,y:p.y},
      {x:p.x,y:view.y-180},{x:p.x,y:view.bottom+180}];
    entries.sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));
    bird.arrivalFrom=entries[0];bird.arrivalDuration=Math.max(1200,Math.hypot(p.x-entries[0].x,p.y-entries[0].y)/180*1000);
    bird.phase='arrival';bird.sprite.setPosition(entries[0].x,entries[0].y);
    bird.altitude=Math.max(90,bird.cover!.height*.65,bird.altitude);
    bird.ground={x:entries[0].x,y:entries[0].y+bird.altitude};
    const dx=p.x-entries[0].x,dy=p.y-entries[0].y;
    bird.direction={x:dx,y:dy};this.refreshFacing(bird);
    this.shadows.setEnabled(bird.sprite,false);
  }
  private arrive(bird:Bird,player:Vec2,scan:boolean):boolean{
    const cover=bird.cover!;
    const t=Phaser.Math.Clamp(bird.age/bird.arrivalDuration,0,1),p=bird.restPoint;
    const restAltitude=bird.perch?cover.y-p.y:0,height=Math.max(90,cover.height*.65,restAltitude);
    bird.altitude=Phaser.Math.Linear(height,restAltitude,t);
    const x=Phaser.Math.Linear(bird.arrivalFrom.x,p.x,t);
    const y=Phaser.Math.Linear(bird.arrivalFrom.y,p.y,t)-Math.sin(t*Math.PI)*20;
    const dx=x-bird.ground.x,dy=y+bird.altitude-bird.ground.y;
    if(Math.hypot(dx,dy)>.01){bird.direction.x=dx;bird.direction.y=dy;}
    bird.ground={x,y:y+bird.altitude};
    this.refreshFacing(bird);
    bird.sprite.setPosition(x,y).setDepth(Math.max(cover.depth+.02,bird.ground.y))
      .setFlipX(bird.flip).setFrame(bird.row*6+(t>.9?2:[3,4,5,4][Math.floor(bird.age/(bird.species==='gull'?140:85))%4]));
    if(scan&&bird.departureDelay===undefined
      &&Math.hypot(bird.ground.x-player.x,bird.ground.y-player.y)<(bird.species==='gull'?190:150)){
      this.startleFlock(bird,player);return true;
    }
    if(t>=1){
      bird.phase='rest';bird.age=0;bird.altitude=restAltitude;
      bird.ground={x:p.x,y:p.y+restAltitude};
      bird.sprite.setPosition(p.x,p.y).setDepth(bird.perch?cover.depth+.02:p.y).setFrame(bird.row*6);
      this.shadows.setEnabled(bird.sprite,!bird.perch);
    }
    return false;
  }
  private startleFlock(bird:Bird,player:Vec2){
    this.takeOff(bird,player);
    if(bird.groupId===undefined)return;
    for(const other of this.birds)if(other!==bird&&other.cover&&other.groupId===bird.groupId
      &&other.phase!=='flight'&&other.departureDelay===undefined){
      other.departureDelay=TUNING.flockStartleDelay;other.departureDirection={...bird.direction};
    }
  }
  /** Facing is a resting interaction, never an override of flight headings. */
  private updateSocial(bird:Bird,player:Vec2,now:number){
    const partner=bird.groupId===undefined?undefined:this.birds.find(other=>other!==bird&&other.cover
      &&other.groupId===bird.groupId&&other.phase==='rest'&&other.age>=0&&other.departureDelay===undefined);
    if(bird.social){
      if(!partner||bird.departureDelay!==undefined||now>=bird.social.until){
        this.finishSocial(bird);bird.nextSocialAt=now+TUNING.birdSocialGap;
      }else if(partner){
        bird.direction.x=partner.ground.x-bird.ground.x;bird.direction.y=partner.ground.y-bird.ground.y;
      }
      return;
    }
    // Ground-feeding pairs can meet across clear ground. A branch/ground pair
    // remains natural perching/feeding rather than facing through a trunk.
    if(!partner||partner.social||bird.perch||partner.perch||bird.departureDelay!==undefined
      ||now<(bird.nextSocialAt??0)||now<(partner.nextSocialAt??0)
      ||Math.hypot(bird.sprite.x-partner.sprite.x,bird.sprite.y-partner.sprite.y)>100
      ||Math.hypot(partner.ground.x-player.x,partner.ground.y-player.y)<(partner.species==='gull'?190:150))return;
    // Check only once per opportunity, not every rendered frame.
    bird.nextSocialAt=partner.nextSocialAt=now+TUNING.birdSocialGap;
    const open=bird.species==='gull'?Boolean(this.host.coastalSite?.({
      x:(bird.restPoint.x+partner.restPoint.x)/2,y:(bird.restPoint.y+partner.restPoint.y)/2,
    })):this.host.birdSite?this.host.birdSite({
      x:(bird.restPoint.x+partner.restPoint.x)/2,y:(bird.restPoint.y+partner.restPoint.y)/2,
    }):this.host.clearRoute(bird.restPoint,partner.restPoint);
    if(!open)return;
    for(const [member,other] of [[bird,partner],[partner,bird]]){
      member.social={until:now+TUNING.socialDuration,direction:{...member.direction}};
      const dx=other.sprite.x-member.sprite.x,dy=other.sprite.y-member.sprite.y;
      member.direction={x:dx,y:dy};this.refreshFacing(member);
      member.sprite.setFrame(member.row*6).setFlipX(member.flip).setData('wildlifeSocializing',true);
    }
  }
  private finishSocial(bird:Bird){
    if(bird.social){bird.direction=bird.social.direction;bird.social=undefined;this.refreshFacing(bird);}
    bird.sprite.setData('wildlifeSocializing',false);
  }
  private takeOff(bird:Bird,player:Vec2,sharedDirection?:Vec2){
    this.finishSocial(bird);
    bird.departureDelay=undefined;bird.departureDirection=undefined;
    const dx=bird.ground.x-player.x,dy=bird.ground.y-player.y,length=Math.hypot(dx,dy);
    bird.direction=length>1?{x:dx/length,y:dy/length}:{x:bird.direction.x,y:bird.direction.y};
    if(length<=1){const facingLength=Math.hypot(bird.direction.x,bird.direction.y);
      bird.direction.x=facingLength>.01?bird.direction.x/facingLength:1;
      bird.direction.y=facingLength>.01?bird.direction.y/facingLength:0;}
    // Prefer the open coast, but retain a positive away-from-player heading.
    if(bird.species==='gull'&&bird.seaward){
      const x=bird.direction.x*.75+bird.seaward.x*.25,y=bird.direction.y*.75+bird.seaward.y*.25,length=Math.hypot(x,y);
      bird.direction={x:x/length,y:y/length};
    }
    if(sharedDirection)bird.direction={...sharedDirection};
    this.refreshFacing(bird);bird.phase='flight';bird.age=0;
    this.shadows.setEnabled(bird.sprite,false);
  }
  private release(bird:Bird){this.finishSocial(bird);bird.nextSocialAt=undefined;
    bird.cover=undefined;bird.groupId=undefined;bird.departureDelay=undefined;bird.departureDirection=undefined;
    bird.sprite.setData('wildlifeGroup',null).setActive(false).setVisible(false);}
  private artReady(species:BirdSpecies){const art=ART[species],height=Number(this.scene.registry.get(art.registry));
    return this.scene.textures.exists(art.texture)&&Number.isFinite(height)&&height>0;}
  reset(now:number){for(const bird of this.birds)this.release(bird);this.preferFlyby=true;
    this.nextEventAt=now+1000;}
  destroy(){for(const bird of this.birds)bird.sprite.destroy();this.birds.length=0;}
}
