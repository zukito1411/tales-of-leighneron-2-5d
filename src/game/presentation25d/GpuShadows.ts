import {walkSurfaceHeight} from './WalkSurface';
import {frameWork} from './FrameWorkBudget';
import {Matrix4,Vector3,type Scene} from 'three';
import type Phaser from 'phaser';
import {ART_BY_KEY,type ArtTextureKey} from '../../data/art';
import type {GroundShadowSystem,ShadowCaster} from '../systems/GroundShadowSystem';
import {getGraphicEffects} from '../systems/graphicsEffects';
import {getEffectsQuality} from '../systems/effectsQuality';
import {SpriteBatch,pruneSpriteBatches,type DistanceAtmosphere} from './SpriteBatch';
import type {TextureCache} from './TextureCache';
import type {ElevationField} from './ElevationField';
import {sunDirection} from './environment';
import {PRESENTATION_HINT,type PresentationHint} from './plane';
import {createHouseGeometry,applyHouseRise,type HouseShape} from './HouseGeometry';
import {createFurnitureGeometry,furniturePlacement,type FurnitureShape} from './FurnitureGeometry';

/** Draw the existing caster registry directly from shared original atlases.
 * No shadow canvas repaint, silhouette readback, duplicate actors or loop. */
export class GpuShadows {
  private readonly batches=new Map<string,SpriteBatch>();
  private readonly matrix=new Matrix4();private readonly sun=new Vector3();
  private readonly uv=new Float64Array(4);private readonly color=[0x111916,0x111916,0x111916,0x111916];
  private readonly repeat=[1,0,0,0];private readonly rect={left:0,top:0,width:1,height:1};
  private readonly furniturePosition={x:0,y:0,width:0,heading:0,lift:0};
  private contactSource:Phaser.Textures.TextureSource|undefined;
  constructor(private readonly world:Scene,private readonly textures:TextureCache,private readonly elevation:ElevationField,private readonly atmosphere:DistanceAtmosphere){}
  update(scene:Phaser.Scene,source:GroundShadowSystem|undefined,minute:number,cloud:number,yaw:number,frame:number,interior:boolean,bounds:{left:number;right:number;top:number;bottom:number}){
    // On fast (60 Hz) frames in mobile Low mode, reuse the previous shadow
    // instances every other frame. Skip no updates at all when frame time is
    // already 25+ ms or when entering an interior: collisions and player
    // animation still update normally every tick.
    if(source&&!interior&&getEffectsQuality()==='low'&&frame%2===1&&scene.game.loop.rawDelta<25)return;
    for(const batch of this.batches.values())batch.begin();
    if(source&&!interior){
      if(!this.contactSource||!this.contactSource.image){
        const texture=scene.textures.exists('gpu-contact-shadow')?scene.textures.get('gpu-contact-shadow'):scene.textures.addCanvas('gpu-contact-shadow',source.contactArtwork);
        this.contactSource=texture?.source[0];
      }
      const sun=sunDirection(minute,this.sun),daylight=Math.max(0,sun.y),length=Math.max(.4,sun.y),reach=1.6;
      const px=Math.max(-reach,Math.min(reach,-sun.x/length))*.65,pz=Math.max(-reach,Math.min(reach,-sun.z/length))*.65;
      const viewRightX=Math.cos(yaw),viewRightZ=-Math.sin(yaw),dynamic=getGraphicEffects().dynamicShadows;
      for(const caster of source.gpuCasters()){
        const owner=caster.actor as ShadowCaster['actor']&{readonly presentationShadowVisual?:Phaser.GameObjects.Sprite;readonly presentationElevation?:number};
        const actor=owner.presentationShadowVisual??owner;
        const hint=actor.getData(PRESENTATION_HINT) as PresentationHint|undefined;
        const wall=hint?.wall,house=hint?.house,furniture=hint?.furniture;
        const rightX=house?Math.cos(actor.rotation):wall?(wall.axis==='x'?1:0):viewRightX;
        const rightZ=house?Math.sin(actor.rotation):wall?(wall.axis==='y'?1:0):viewRightZ;
        if(!owner.active||!owner.visible||!actor.active||!actor.visible||actor.alpha<.01||caster.enabled===false||actor.cameraFilter&scene.cameras.main.id||!dynamic&&!caster.texture)continue;
        const art=caster.texture?scene.textures.getFrame(caster.texture,caster.frame):actor.frame;
        if(!art?.source?.image)continue;
        const width=art.cutWidth,height=art.cutHeight,projection=caster.projection??1;
        const reachPx=(width+height*(house?.riseScale??1)*(projection+1))*Math.max(Math.abs(actor.scaleX),Math.abs(actor.scaleY));
        if(owner.x+reachPx<bounds.left||owner.x-reachPx>bounds.right||owner.y+reachPx<bounds.top||owner.y-reachPx>bounds.bottom)continue;
        const gx=(caster.groundPoint?.x??actor.originX)*width+(actor!==owner?(owner.x-actor.x)/actor.scaleX:0);
        const gy=(caster.groundPoint?.y??actor.originY)*height+(actor!==owner?(owner.y-actor.y)/actor.scaleY:0);
        const sx=actor.scaleX*(actor.flipX?-1:1),sy=actor.scaleY*(actor.flipY?-1:1),c=house?1:Math.cos(actor.rotation),s=house?0:Math.sin(actor.rotation);
        const a=sx*c,b=sx*s,d=sy*c,e=-sy*s;
        const footDx=actor===owner?a*(gx-actor.originX*width)+e*(gy-actor.originY*height):0;
        const footX=owner.x+footDx*rightX,footZ=owner.y+footDx*rightZ+(caster.groundOffsetY??0);
        const metadata=(art.customData??{}) as {visibleBounds?:{width:number};heroDensity?:number};
        const density=ART_BY_KEY[art.texture.key as ArtTextureKey]?.density??metadata.heroDensity??1;
        const visibleWidth=(metadata.visibleBounds?metadata.visibleBounds.width*density:width)*Math.abs(actor.scaleX);
        const airborne=owner.presentationElevation??0;
        const radius=Math.max(5,Math.min(220,visibleWidth*.34))*(caster.contactScale??1)*(1+airborne*.002);
        const opacity=actor.alpha*(caster.contactOpacity??1)*(1-Math.min(.55,airborne/140));
        if(this.contactSource){
          if(caster.contacts)for(const contact of caster.contacts)this.contact(actor,owner.x+contact.x,owner.y+contact.y,contact.width,contact.height,opacity,frame);
          else this.contact(actor,footX,footZ+radius*(caster.contactOffset??0),radius*2,radius*(caster.contactHeight??2/3),opacity,frame);
        }
        if(daylight<=.02||projection===0)continue;
        const lightX=px*projection,lightZ=pz*projection;
        const xx=(a*rightX-b*lightX)*width,xz=(a*rightZ-b*lightZ)*width;
        const yx=(-e*rightX+d*lightX)*height,yz=(-e*rightZ+d*lightZ)*height;
        const dx=width/2-gx,dy=height/2-gy,h=-(b*dx+d*dy)+airborne,horizontal=a*dx+e*dy;
        const cx=footX+horizontal*rightX+h*lightX,cz=footZ+horizontal*rightZ+h*lightZ;
        // A nonzero normal retains a valid instance transform for shared geometry.
        this.matrix.set(xx,yx,house?-rightZ*width*sx:0,cx,0,0,house?0:1,.065,
          xz,yz,house?rightX*width*sx:0,cz,0,0,0,1);
        if(house?.segment){
          const segment=house.segment,span=Math.max(1,Math.hypot(segment.dx,segment.dy));
          const ux=segment.dx/span,uz=segment.dy/span,h=segment.height,t=segment.thickness;
          this.matrix.set(segment.dx,h*lightX,-uz*t,owner.x-uz*t/2+h*lightX/2,
            0,0,.01,.065,
            segment.dy,h*lightZ,ux*t,owner.y+ux*t/2+h*lightZ/2,0,0,0,1);
        }
        if(house)applyHouseRise(this.matrix,house);
        if(furniture){
          const p=furniturePlacement(actor,furniture,this.furniturePosition),w=p.width,c=Math.cos(p.heading),s=Math.sin(p.heading);
          this.matrix.set(w*c,w*lightX,-w*s,p.x+p.lift*lightX,
            0,.0001*w,0,.065,w*s,w*lightZ,w*c,p.y+p.lift*lightZ,0,0,0,1);
        }
        this.uv[0]=(art.cutX+.25)/art.source.width;this.uv[1]=1-(art.cutY+height-.25)/art.source.height;
        this.uv[2]=(width-.5)/art.source.width;this.uv[3]=(height-.5)/art.source.height;
        this.repeat[0]=caster.projectionBottom??1;this.repeat[2]=0;
        this.add(art.source,actor,actor.alpha*(.16+daylight*.07)*(1-cloud*.35),frame,true,house,furniture);
      }
    }
    for(const batch of this.batches.values())batch.finish();
    const work=frameWork(scene.game),start=performance.now();
    pruneSpriteBatches(this.batches,frame,16,1,start+work.remaining('retire',.2));work.charge('retire',start);
  }
  private contact(actor:ShadowCaster['actor'],x:number,z:number,width:number,height:number,alpha:number,frame:number){
    if(width<=0||height<=0||!this.contactSource)return;
    this.matrix.set(width,0,0,x,0,0,1,.055,0,-height,0,z,0,0,0,1);
    this.uv[0]=this.uv[1]=0;this.uv[2]=this.uv[3]=1;this.repeat[0]=1;
    this.add(this.contactSource,actor,alpha,frame,false);
  }
  private add(source:Phaser.Textures.TextureSource,actor:ShadowCaster['actor'],alpha:number,frame:number,projected:boolean,house?:HouseShape,furniture?:FurnitureShape){
    const deck=furniture?.fixedGround??walkSurfaceHeight(actor.x,actor.y);
    if(deck!==undefined)this.matrix.elements[13]+=deck;
    const texture=this.textures.get(source,frame),key=Number(deck!==undefined)+':' +texture.uuid+':'+Number(projected)+':'+(furniture?.key??house?.profile.id??'')+':'+(house?.floorLift??0)+':'+(house?.doorHeight??0)+(house?.segment?':surveyed':'');
    let batch=this.batches.get(key);
    if(!batch){batch=new SpriteBatch(this.world,texture,false,false,deck!==undefined?1:-9.94,[],true,false,false,deck===undefined,false,this.elevation,false,this.atmosphere,true,false,furniture?()=>createFurnitureGeometry(furniture):house?()=>createHouseGeometry(house):undefined);this.batches.set(key,batch);}
    batch.add(this.matrix,this.uv,this.color,alpha,actor,this.rect,frame,this.repeat);
  }
  destroy(){for(const batch of this.batches.values())batch.destroy();this.batches.clear();this.contactSource=undefined;}
}
