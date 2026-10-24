import {bridgeShape} from '../presentation25d/BridgeGeometry';
import {BRIDGE_DECK_HEIGHT} from '../presentation25d/WalkSurface';
import {markStaticPresentation} from '../presentation25d/StaticSpatialIndex';
import Phaser from 'phaser';
import {onPlane,worldHeight,PRESENTATION_HINT,type PresentationHint} from '../presentation25d/plane';
import {houseShape,sizeHouseForPlayer,type WallSegment} from '../presentation25d/HouseGeometry';
import {worldPropShape,shipShape} from '../presentation25d/WorldPropGeometry';
import {furniturePlacement} from '../presentation25d/FurnitureGeometry';
import {ART_BY_KEY,type ArtTextureKey} from '../../data/art';
import {worldSpriteProfile,polygonGroundBands,TIMBER_BRIDGE,type GroundPoint} from '../../data/worldSpriteGeometry';
import {ROAD_BRIDGE_FRAME} from '../../data/bridgeDeck';
import {segmentTouchesRect} from '../../data/settlementGeometry';
import {isTreeArt} from '../../data/treeArt';
import type {Vec2} from '../types';
import type {GroundShadowSystem} from './GroundShadowSystem';
import type {AmbientWildlifeSystem} from './AmbientWildlifeSystem';
import {PropGroundBlend} from './PropGroundBlend';
import {getGraphicEffects} from './graphicsEffects';

type WorldActor=Phaser.GameObjects.Image|Phaser.GameObjects.Sprite;
interface VisibleArt {left:number;top:number;width:number;height:number}
interface PreparedArt {visibleBounds?:VisibleArt;sourceRegion?:readonly number[];sourceFit?:number}
export const WORLD_SPRITE_OWNER='worldSpriteOwner';

/** One source-derived ground geometry path for authored and streamed scenery.
 * Render bounds, physical contour and draw order are deliberately separate. */
export class WorldSpriteSystem {
  private readonly owned=new Map<WorldActor,Phaser.GameObjects.Rectangle[]>();
  private readonly staged=new Map<WorldActor,()=>void>();
  // Runtime pixel-based ground skirts are opt-in. Without them the original
  // full-quality sprite art, collision, foliage, and shadows render unchanged
  // with zero per-actor masking scans, CPU readbacks or texture uploads.
  private readonly blend:PropGroundBlend|null;
  constructor(private readonly scene:Phaser.Scene,private readonly bodies:Phaser.Physics.Arcade.StaticGroup,
    private readonly shadows?:GroundShadowSystem,private readonly wildlife?:AmbientWildlifeSystem){this.blend=getGraphicEffects().groundBlend?new PropGroundBlend(scene):null;}
  register(actor:WorldActor,texture:ArtTextureKey,frame:number,scale:number,solid:boolean,fallback?:{width:number;height:number},center=false,staged=false,wallSegment?:WallSegment){
    if(this.owned.has(actor))return;
    const sheet=ART_BY_KEY[texture],metadata=(actor.frame.customData??{}) as PreparedArt;
    const visible=metadata.visibleBounds??{left:0,top:0,width:sheet.frameWidth,height:sheet.frameHeight};
    const sourceRegion=metadata.sourceRegion??sheet.regions?.[frame],sourceAnchor=sheet.groundPoints?.[frame];
    if(center&&sourceRegion&&sourceAnchor){
      // Alpha-trimmed atlas frames can have a different center than the source
      // crop. Anchor the actual prepared drawing, not the untrimmed estimate.
      actor.setOrigin((visible.left+(sourceAnchor[0]-sourceRegion[0])/sourceRegion[2]*visible.width)/sheet.frameWidth,
        (visible.top+(sourceAnchor[1]-sourceRegion[1])/sourceRegion[3]*visible.height)/sheet.frameHeight);
    }
    if(isTreeArt(texture,frame)&&this.scene.game.registry.get('presentation')==='three-2.5d'){
      const foot=worldSpriteProfile(texture,frame)?.sortY??.98;
      const bottom=(visible.top+visible.height*foot)/sheet.frameHeight-2/Math.max(1,actor.displayHeight);
      actor.setOrigin(actor.originX,bottom);
    }
    const cos=Math.cos(actor.rotation),sin=Math.sin(actor.rotation);
    const point=(x:number,y:number)=>({
      x:actor.x+(visible.left+x*visible.width-sheet.frameWidth*actor.originX)*scale*cos
        -(visible.top+y*visible.height-sheet.frameHeight*actor.originY)*scale*sin,
      y:actor.y+(visible.left+x*visible.width-sheet.frameWidth*actor.originX)*scale*sin
        +(visible.top+y*visible.height-sheet.frameHeight*actor.originY)*scale*cos,
    });
    const sourcePoint=([x,y]:GroundPoint)=>{
      const source=metadata.sourceRegion??sheet.regions?.[frame];
      return source?point((x-source[0])/source[2],(y-source[1])/source[3]):point(x,y);
    };
    const profile=worldSpriteProfile(texture,frame),owned:Phaser.GameObjects.Rectangle[]=[];
    const layers:Phaser.GameObjects.Image[]=[];
    onPlane(actor,profile?.floor||texture==='port_dock'||texture==='pirate_flagship'?'ground':'upright');
    const house=houseShape(texture,actor.frame,frame,wallSegment);
    if(house&&!house.segment&&!house.profile.board)house.ground=(actor.originY-house.top)/house.height;
    if(house&&this.scene.game.registry.get('presentation')==='three-2.5d')sizeHouseForPlayer(house,Math.abs(actor.displayHeight));
    if(house?.segment){house.segment.height=visible.height*scale*.82;house.segment.thickness=Math.max(12,24*scale);}
    if(house)(actor.getData(PRESENTATION_HINT) as PresentationHint).house=house;
    if(!house&&this.scene.game.registry.get('presentation')==='three-2.5d'){
      const furniture=texture==='pirate_flagship'?shipShape('ship'):texture==='bridges'&&frame===ROAD_BRIDGE_FRAME?bridgeShape(actor):worldPropShape(actor,texture,frame);
      if(furniture)actor.setData(PRESENTATION_HINT,{plane:'upright',furniture} satisfies PresentationHint);
    }
    if(this.scene.game.registry.get('presentation')==='three-2.5d'&&(texture==='port_dock'||texture==='bridges'&&profile?.floor&&frame!==ROAD_BRIDGE_FRAME))actor.setData(PRESENTATION_HINT,{plane:'ground',elevation:BRIDGE_DECK_HEIGHT,absoluteGround:true} satisfies PresentationHint);
    const furniture=(actor.getData(PRESENTATION_HINT) as PresentationHint).furniture;
    if(!profile?.floor&&texture!=='port_dock'){
      const building=texture==='world_buildings'||texture==='capital_buildings'||texture==='elven_villas'
        ||texture==='world_objects'&&frame<4;
      const tree=isTreeArt(texture,frame),groundY=profile?.sortY??.96;
      const source=metadata.sourceRegion??sheet.regions?.[frame],surveyed=sheet.groundPoints?.[frame];
      const groundPoint={
        x:(visible.left+visible.width*(source&&surveyed?(surveyed[0]-source[0])/source[2]:.5))/sheet.frameWidth,
        y:(visible.top+visible.height*(source&&surveyed?(surveyed[1]-source[1])/source[3]:groundY))/sheet.frameHeight};
      let contacts=profile?.solids.map(polygon=>{
        const points=polygon.map(([x,y])=>point(x,y));
        const left=Math.min(...points.map(p=>p.x)),right=Math.max(...points.map(p=>p.x));
        const top=Math.min(...points.map(p=>p.y)),bottom=Math.max(...points.map(p=>p.y));
        return {x:(left+right)/2-actor.x,y:(top+bottom)/2-actor.y,
          width:Math.min(440,(right-left)*1.12),height:Math.min(100,Math.max(8,(bottom-top)*1.05))};
      });
      if(furniture){
        const p=furniturePlacement(actor,furniture,{x:0,y:0,width:0,heading:0,lift:0}),depth=p.width*furniture.depth;
        contacts=[{x:p.x-actor.x+Math.sin(p.heading)*depth/2,y:p.y-actor.y-Math.cos(p.heading)*depth/2,
          width:Math.min(440,p.width),height:Math.max(8,Math.min(220,depth))}];
      }
      this.shadows?.register(actor,true,{groundPoint,contactOpacity:.65,
        projection:profile&&!profile.solids.length&&texture!=='royal_walls'?0:1,
        projectionBottom:(visible.top+visible.height*(building ? .86 : tree ? .92 : .9))/sheet.frameHeight,
        ...(contacts?.length?{contacts}:{contactScale:.55,contactHeight:.3})});
    }
    const add=(left:number,top:number,right:number,bottom:number)=>{
      if(right-left<.5||bottom-top<.5)return;
      const body=this.scene.add.rectangle((left+right)/2,(top+bottom)/2,right-left,bottom-top,0xffffff,0)
        .setVisible(false).setName('ground:'+actor.name).setData(WORLD_SPRITE_OWNER,actor);
      this.scene.physics.add.existing(body,true);this.bodies.add(body);owned.push(body);
    };
    if(texture==='bridges'&&frame===ROAD_BRIDGE_FRAME){
      actor.setDepth(-900); // Deck/support artwork is ground, not foreground.
      if(this.scene.game.registry.get('presentation')!=='three-2.5d')for(const [part,y] of [['back',TIMBER_BRIDGE.backSortY],['front',TIMBER_BRIDGE.frontSortY]] as const){
        const layer=this.scene.add.image(actor.x,actor.y,`bridge-${part}-rail`).setOrigin(actor.originX,actor.originY)
          .setScale(actor.scaleX,actor.scaleY).setDepth(sourcePoint([241,y]).y).setName('bridge-'+part+':'+actor.name);
        if(staged)layer.setVisible(false);
        layers.push(layer);
        layer.setTint(actor.tintTopLeft,actor.tintTopRight,actor.tintBottomLeft,actor.tintBottomRight);
        const railGround=sourcePoint([241,y]);
        const anchor={x:actor.x,y:railGround.y,get presentationElevation(){
          return worldHeight(layer.scene,actor.x,actor.y)-worldHeight(layer.scene,this.x,this.y);
        }};
        layer.setData('presentation25d',{plane:'upright',anchor,wall:{axis:'x'}} satisfies PresentationHint);
        // The deck artwork includes water and bank soil: only the extracted
        // rail silhouettes cast a shadow, never the entire river illustration.
        this.shadows?.register(layer,true,{projection:.3,contactScale:0,
          groundPoint:{x:layer.originX,y:layer.originY+(railGround.y-layer.y)/(layer.height*layer.scaleY)},
          groundOffsetY:railGround.y-layer.y});
        actor.once('destroy',()=>layer.destroy());
      }
      // Bridge rail art is decorative; terrain bounds already constrain the crossing.
    }else{
      actor.setDepth(profile?.floor?-950:profile?point(.5,profile.sortY).y:actor.y);
      if(solid||profile?.forceSolid){
        if(profile?.solids.length){for(const polygon of profile.solids){
          const worldPolygon=polygon.map(([x,y]):GroundPoint=>{const p=point(x,y);return [p.x,p.y];});
          for(const rect of polygonGroundBands(worldPolygon))add(rect.left,rect.top,rect.right,rect.bottom);
        }}else if(solid&&!profile?.floor){
          const width=fallback?.width??visible.width*scale*.72,height=fallback?.height??Math.min(56,visible.height*scale*.25);
          const cos=Math.abs(Math.cos(actor.rotation)),sin=Math.abs(Math.sin(actor.rotation));
          const boundsWidth=width*cos+height*sin,boundsHeight=width*sin+height*cos;
          const bottom=center?actor.y+boundsHeight/2:point(.5,1).y;
          add(actor.x-boundsWidth/2,bottom-boundsHeight,actor.x+boundsWidth/2,bottom);
        }
      }
      if(house&&!house.segment&&!house.profile.board&&!house.profile.opening?.length&&(solid||profile?.forceSolid)){
        // A deeper rendered building also needs a ground footprint: otherwise
        // the player could walk through its newly visible side/back. Keep the
        // surveyed front stoops/props above, and add only the structural body.
        const tiers=house.profile.tiers,roof=house.profile.roof;
        const base=tiers?.reduce((a,b)=>b.bottom>a.bottom?b:a);
        const l=base?.left??roof[0][0],r=base?.right??roof[roof.length-1][0];
        const dx=(x:number)=>(visible.left+x*visible.width-sheet.frameWidth*actor.originX)*scale;
        const depth=house.depth*actor.frame.cutWidth*Math.abs(actor.scaleX);
        const outline:GroundPoint[]=tiers?Array.from({length:16},(_,i)=>{
          const a=i/16*Math.PI*2,radius=(r-l)*visible.width*scale/2;
          return [dx((l+r)/2)+Math.sin(a)*radius,-depth/2+Math.cos(a)*radius] as GroundPoint;
        }):[[dx(l),-depth],[dx(r),-depth],[dx(r),-4],[dx(l),-4]];
        const footprint=outline.map(([x,y])=>[actor.x+x*cos-y*sin,actor.y+x*sin+y*cos] as GroundPoint);
        for(const rect of polygonGroundBands(footprint))add(rect.left,rect.top,rect.right,rect.bottom);
      }
      if(furniture?.art==='life-tree'&&(solid||profile?.forceSolid)){
        // The original root survey remains. The rebuilt round trunk also
        // occupies the southern half of its base, beyond the old flat painting.
        const p=furniturePlacement(actor,furniture,{x:0,y:0,width:0,heading:0,lift:0}),c=Math.cos(p.heading),s=Math.sin(p.heading);
        const trunk:GroundPoint[]=Array.from({length:12},(_,i)=>{
          const a=i/12*Math.PI*2,x=.005+Math.cos(a)*.135,z=.005+Math.sin(a)*.12;
          return [p.x+(x*c-z*s)*p.width,p.y+(x*s+z*c)*p.width] as GroundPoint;
        });
        for(const rect of polygonGroundBands(trunk))add(rect.left,rect.top,rect.right,rect.bottom);
      }
      if(furniture&&(solid||profile?.forceSolid)&&!['arch','fence','keepsake','banner','life-tree'].includes(furniture.art)){
        // Deeper props need matching clearance, as buildings already do.
        // Add the body behind its existing front contact; keep old surveyed
        // stoops/details and open fence/arch passages intact. These bodies use
        // the same staged activation, spatial physics lookup and retirement.
        const p=furniturePlacement(actor,furniture,{x:0,y:0,width:0,heading:0,lift:0}),c=Math.cos(p.heading),s=Math.sin(p.heading);
        const footprint:GroundPoint[]=[[-.46,-furniture.depth],[.46,-furniture.depth],[.46,-.01],[-.46,-.01]]
          .map(([x,y])=>[p.x+(x*c-y*s)*p.width,p.y+(x*s+y*c)*p.width] as GroundPoint);
        if(Math.abs(c)<.0001||Math.abs(s)<.0001)add(Math.min(...footprint.map(p=>p[0])),Math.min(...footprint.map(p=>p[1])),Math.max(...footprint.map(p=>p[0])),Math.max(...footprint.map(p=>p[1])));
        else for(const rect of polygonGroundBands(footprint))add(rect.left,rect.top,rect.right,rect.bottom);
      }
    }
    if(actor instanceof Phaser.GameObjects.Image)markStaticPresentation(actor);
    actor.once('presentation-retired',()=>{for(const layer of layers)layer.setVisible(false);});
    this.owned.set(actor,owned);
    actor.once('destroy',()=>this.release(actor));
    const bottom=point(.5,1);
    const activate=()=>{
      for(const shape of owned)if(shape.body instanceof Phaser.Physics.Arcade.StaticBody)shape.body.enable=true;
      for(const layer of layers)layer.setVisible(actor.visible);
      this.wildlife?.register(actor,texture,frame,bottom,visible.width*scale,visible.height*scale);
      this.blend?.apply(actor,texture,frame,bottom);
    };
    if(staged){
      for(const shape of owned)if(shape.body instanceof Phaser.Physics.Arcade.StaticBody)shape.body.enable=false;
      this.staged.set(actor,activate);
    }else activate();
  }
  /** Chunk publication enables prepared collisions and habitat together. */
  activate(actor:WorldActor){
    const activate=this.staged.get(actor);if(!activate)return;
    this.staged.delete(actor);activate();
  }
  /** Make retired scenery non-authoritative immediately; expensive listener/
   * physics destruction can then be spread across subsequent frames. */
  retire(actor:WorldActor){
    for(const shape of this.owned.get(actor)??[])if(shape.body instanceof Phaser.Physics.Arcade.StaticBody)shape.body.enable=false;
  }
  private release(actor:WorldActor){
    this.staged.delete(actor);
    const shapes=this.owned.get(actor);if(!shapes)return;this.owned.delete(actor);
    for(const shape of shapes)this.bodies.remove(shape,true,true);
  }
  blocksPoint(point:Vec2,width=18,height=22){
    return this.scene.physics.overlapRect(point.x-width/2+.15,point.y-height+.15,width-.3,height-.3,false,true)
      .some(body=>body.enable&&body.gameObject?.getData(WORLD_SPRITE_OWNER));
  }
  blocksPath(from:Vec2,to:Vec2,width=18,height=22){
    if(Math.hypot(to.x-from.x,to.y-from.y)<.01)return this.blocksPoint(to,width,height);
    // Broad-phase lookup uses Phaser's existing static spatial index. Swept
    // feet stop a fast dash skipping a thin contour between physics frames.
    const left=Math.min(from.x,to.x)-width/2,top=Math.min(from.y,to.y)-height;
    const nearby=this.scene.physics.overlapRect(left,top,
      Math.max(from.x,to.x)+width/2-left,Math.max(from.y,to.y)-top,false,true) as Phaser.Physics.Arcade.StaticBody[];
    return nearby.some(body=>body.enable&&body.gameObject?.getData(WORLD_SPRITE_OWNER)&&
      segmentTouchesRect(from,to,{left:body.left-width/2+.15,right:body.right+width/2-.15,
        top:body.top+.15,bottom:body.bottom+height-.15}));
  }
  destroy(){for(const actor of this.owned.keys())this.release(actor);this.blend?.destroy();}
}
