import Phaser from 'phaser';
import {onPlane,PRESENTATION_HINT,type PresentationHint} from '../presentation25d/plane';
import {WATER_SURFACE} from '../../data/waterLevels';
import {shipShape} from '../presentation25d/WorldPropGeometry';
import {FLAGSHIP,FLAGSHIP_OBSTACLES,FLAGSHIP_HULL,shipPoint} from '../../data/pirateFlagship';
import {getGraphicEffects} from './graphicsEffects';

export const FLAGSHIP_ART_PATH='assets/vehicles/pirate_flagship/ship-boardable.png';
const HULL=FLAGSHIP_HULL;
const PENNANT=[[199,140],[257,106],[301,73],[336,75],[357,65],[379,56],[402,52],[394,103],
  [369,96],[330,105],[285,126],[241,131]];
const MAST=[[391,250],[433,250],[433,566],[455,580],[468,625],[450,657],[349,657],[345,599],[389,568]];
const SAIL=[[376,52],[430,48],[454,159],[445,353],[465,470],[438,550],[383,480],[360,303],[351,160]] as const;
const TOP_RIG=[[[393,7],[434,7],[434,260],[393,260]],[[415,22],[422,22],[635,441],[627,442]],[[414,22],[407,22],[179,441],[187,443]]];
function path(ctx:CanvasRenderingContext2D,points:readonly (readonly number[])[]){
  ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(const [x,y] of points.slice(1))ctx.lineTo(x,y);ctx.closePath();
}
/** Cut source artwork into compact occlusion layers once, never per frame.
 * Tight masks discard the generated outside atmospheric halo. */
export function preparePirateFlagshipArt(scene:Phaser.Scene){
  const spatial=scene.game.registry.get('presentation')==='three-2.5d';
  const source=scene.textures.get('flagship-source').getSourceImage() as HTMLImageElement;
  const image=document.createElement('canvas');image.width=1024;image.height=1536;
  const ctx=image.getContext('2d')!;
  ctx.save();path(ctx,HULL);ctx.clip();ctx.drawImage(source,0,0,1024,1536);ctx.restore();
  for(const polygon of [PENNANT,...(spatial?[SAIL]:[]),[[660,745],[1018,745],[1018,848],[660,848]],
    [[393,7],[434,7],[434,260],[393,260]],[[415,22],[422,22],[635,441],[627,442]],
    [[414,22],[407,22],[179,441],[187,443]]]){
    ctx.save();path(ctx,polygon);ctx.clip();ctx.drawImage(source,0,0,1024,1536);ctx.restore();
  }
  const layer=(key:string,left:number,top:number,width:number,height:number,polygon?:readonly (readonly number[])[])=>{
    const texture=scene.textures.createCanvas(key,width,height)!,draw=texture.getContext();
    if(polygon){draw.save();draw.translate(-left,-top);path(draw,polygon);draw.clip();draw.translate(left,top);}
    draw.drawImage(image,left,top,width,height,0,0,width,height);if(polygon)draw.restore();
    texture.add(0,0,0,0,width,height);texture.refresh();return texture;
  };
  layer('flagship-front',125,978,566,558);
  if(spatial){
    const rig=scene.textures.createCanvas('flagship-mast',480,650)!,draw=rig.getContext();
    for(const polygon of [MAST,SAIL,...TOP_RIG]){
      draw.save();draw.translate(-170,-7);path(draw,polygon);draw.clip();draw.drawImage(image,0,0);draw.restore();
    }
    rig.add(0,0,0,0,480,650);rig.refresh();
  }else layer('flagship-mast',344,250,130,410,MAST);
  layer('flagship-pennant',190,45,216,100,PENNANT);
  // Remove only the same actual pixels that the corresponding layers draw.
  ctx.globalCompositeOperation='destination-out';ctx.fillStyle='#fff';ctx.fillRect(125,978,566,558);
  for(const polygon of [MAST,PENNANT]){path(ctx,polygon);ctx.fill();}
  if(spatial)for(const polygon of [SAIL,...TOP_RIG]){path(ctx,polygon);ctx.fill();}
  ctx.globalCompositeOperation='source-over';
  if(spatial){
    // Raising the original mast must not leave its former overhead silhouette
    // as a hole through the playable deck. Reuse a clean plank patch beneath
    // precisely those masks, clipped to the same surveyed hull.
    const planks=document.createElement('canvas');planks.width=32;planks.height=70;
    planks.getContext('2d')!.drawImage(source,340,690,32,70,0,0,32,70);
    const pattern=ctx.createPattern(planks,'repeat')!;
    for(const polygon of [MAST,SAIL,...TOP_RIG]){
      ctx.save();path(ctx,HULL);ctx.clip();path(ctx,polygon);ctx.clip();ctx.fillStyle=pattern;ctx.fillRect(0,0,1024,1536);ctx.restore();
    }
    planks.width=planks.height=1;
  }
  const base=scene.textures.createCanvas('pirate_flagship',1024,1536)!;
  base.getContext().drawImage(image,0,0);base.add(0,0,0,0,1024,1536)!.customData={
    visibleBounds:{left:0,top:0,width:1024,height:1536},sourceRegion:[0,0,1024,1536],sourceFit:1};
  base.refresh();image.width=image.height=1;scene.textures.remove('flagship-source');
}

export class PirateFlagshipArt {
  private readonly entries=new Map<Phaser.GameObjects.Sprite,{pennant:Phaser.GameObjects.Image;layers:Phaser.GameObjects.Image[]}>();
  private elapsed=0;
  constructor(private readonly scene:Phaser.Scene,private readonly bodies:Phaser.Physics.Arcade.StaticGroup){}
  attach(owner:Phaser.GameObjects.Sprite){
    const spatial=this.scene.game.registry.get('presentation')==='three-2.5d';
    const add=(key:string,x:number,y:number,depth:number)=>{
      const p=shipPoint(x,y);return this.scene.add.image(p.x,p.y,key,0).setOrigin(0).setScale(FLAGSHIP.scale)
        .setDepth(depth).setName(key+':'+owner.name);
    };
    const front=add('flagship-front',125,978,shipPoint(0,978).y);
    const mast=add('flagship-mast',spatial?170:344,spatial?7:250,shipPoint(0,657).y);
    const pennant=add('flagship-pennant',190,45,shipPoint(0,260).y);
    onPlane(front,'ground');
    const mastFoot=shipPoint(0,657);onPlane(mast,'upright',mastFoot);onPlane(pennant,'upright',mastFoot);
    if(spatial){
      front.setData(PRESENTATION_HINT,{plane:'upright',furniture:shipShape('ship-stern')} satisfies PresentationHint);
      mast.setData(PRESENTATION_HINT,{plane:'upright',furniture:shipShape('ship-mast')} satisfies PresentationHint);
      pennant.setData(PRESENTATION_HINT,{plane:'upright',furniture:shipShape('ship-pennant')} satisfies PresentationHint);
    }
    const foam=[shipPoint(155,945),shipPoint(655,945)].map((p,i)=>this.scene.add.image(p.x,p.y,'water-foam',i)
      .setScale(.9,2.5).setRotation(Math.PI/2).setAlpha(.12).setDepth(-965).setName('flagship-water:'+i));
    if(spatial)for(const image of foam)image.setData(PRESENTATION_HINT,{plane:'ground',elevation:WATER_SURFACE+.06,absoluteGround:true} satisfies PresentationHint);
    const colliders=FLAGSHIP_OBSTACLES.map(r=>{
      const p=shipPoint((r.left+r.right)/2,(r.top+r.bottom)/2);
      const body=this.scene.add.rectangle(p.x,p.y,(r.right-r.left)*FLAGSHIP.scale,(r.bottom-r.top)*FLAGSHIP.scale,0,0).setVisible(false);
      this.scene.physics.add.existing(body,true);this.bodies.add(body);return body;
    });
    this.entries.set(owner,{pennant,layers:[front,mast,pennant,...foam]});
    owner.once('destroy',()=>{this.entries.delete(owner);for(const layer of [front,mast,pennant,...foam])layer.destroy();
      for(const body of colliders)this.bodies.remove(body,true,true);});
  }
  update(delta:number){
    if(!this.entries.size)return;
    this.elapsed+=Math.min(delta,100);
    const sway=getGraphicEffects().treeSway;
    for(const [owner,{pennant,layers}] of this.entries){
      for(let i=0;i<layers.length;i++){
        layers[i].setVisible(owner.visible);
        if(i>=3&&delta>0)layers[i].setAlpha(.12+Math.sin(this.elapsed/2300+i-3)*.035);
      }
      if(delta>0&&sway)pennant.setRotation(Math.sin(this.elapsed/1700)*.006);
      else if(!sway)pennant.setRotation(0);
    }
  }
  destroy(){for(const {layers} of this.entries.values())for(const layer of layers)layer.destroy();this.entries.clear();}
}
