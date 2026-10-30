import type Phaser from 'phaser';
import {ART_BY_KEY} from '../../data/art';
import {ROYAL_BRIDGE_RAILS,ROYAL_BRIDGE_RAIL_MARGIN,ROYAL_BRIDGE_END_MARGIN,ROAD_BRIDGE_FRAME} from '../../data/bridgeDeck';
import {ModelMesh,atlasMaterial,type V3} from './ModelMesh';
import type {FurnitureShape} from './FurnitureGeometry';
import {BRIDGE_DECK_HEIGHT} from './WalkSurface';
import {HERO_BODY_HEIGHT} from '../../data/heroBodyRegistration';

/** Keep the surveyed 90..393 / 196..261 deck; strip the old bank/water picture.
 * These source coordinates also drive bridgeDeck.ts navigation. */
export function bridgeShape(actor:Phaser.GameObjects.Image|Phaser.GameObjects.Sprite):FurnitureShape {
  const frame=actor.frame,sheet=ART_BY_KEY.bridges;
  const meta=frame.customData as {visibleBounds:{left:number;top:number;width:number;height:number};sourceRegion?:readonly [number,number,number,number]};
  const b=meta.visibleBounds,source=meta.sourceRegion??sheet.regions![ROAD_BRIDGE_FRAME],density=sheet.density;
  const width=b.width*density/frame.cutWidth,height=b.height*density/frame.cutHeight;
  const modelScale=420/source[2],royal=actor.name.startsWith('bridge:highmere:');
  const worldWidth=Math.max(1,Math.abs(actor.displayWidth)*width*modelScale);
  const rise=Math.min(.20,HERO_BODY_HEIGHT*1.05/worldWidth);
  return {art:'bridge',kit:royal?'royal-bridge':'bridge',key:['bridge',Number(royal),rise,...source,width,height].join(':'),left:b.left*density/frame.cutWidth,top:b.top*density/frame.cutHeight,
    width,height,rise,depth:.20,modelScale,sourceRegion:source,fixedGround:BRIDGE_DECK_HEIGHT,patch:[.35,.50,.45,.65],
    bounds:{left:-.38,right:.39,bottom:-.16,top:.26,back:-.10,front:.11}};
}
export function createBridgeGeometry(shape:FurnitureShape,emission=false){
  const m=new ModelMesh(shape,emission);
  const royal=shape.kit==='royal-bridge';
  const timber=atlasMaterial('architecture',royal?8:1,.12,.30);
  const planks=atlasMaterial('architecture',royal?8:13,.40,.22);
  const rope=atlasMaterial('furnishings',0,.12,.025);
  const p=(x:number,y:number,h:number):V3=>[(x-241)/420,h,(y-229)/420];
  m.box((90-241)/420,(393-241)/420,-.022,0,(196-229)/420,(261-229)/420,planks);
  if(royal){
    const rail=shape.rise*.78;
    for(const [back,front] of ROYAL_BRIDGE_RAILS){
      const lo=(back-229)/420,hi=(front-229)/420;
      m.box((90-241)/420,(393-241)/420,0,rail,lo,hi,timber);
      m.box((90-ROYAL_BRIDGE_END_MARGIN-241)/420,(393+ROYAL_BRIDGE_END_MARGIN-241)/420,rail,rail+shape.rise*.10,lo-ROYAL_BRIDGE_RAIL_MARGIN/420,hi+ROYAL_BRIDGE_RAIL_MARGIN/420,timber);
      for(let i=0;i<=8;i++){
        const x=(90+(393-90)*i/8-241)/420,w=.008;
        m.box(x-w,x+w,-.06,shape.rise,lo-.004,hi+.004,timber);
        m.box(x-w-.002,x+w+.002,shape.rise,shape.rise*1.06,lo-.006,hi+.006,timber);
      }
    }
    return m.finish();
  }
  for(const y of [198,259]){
    m.beam(p(90,y,-.018),p(393,y,-.018),.013,timber,6);
    for(const x of [145,347]){
      m.cylinder((x-241)/420,(y-229)/420,-.16,shape.rise,.018,.016,timber,10);
      m.ring((x-241)/420,(y-229)/420,shape.rise*.725,shape.rise*.8,.021,.015,rope,10);
    }
    for(let i=0;i<8;i++){
      const x=145+202*i/8,next=145+202*(i+1)/8;
      const h=(u:number)=>shape.rise*(.8-Math.sin((u-145)/202*Math.PI)*.225);
      m.beam(p(x,y,h(x)),p(next,y,h(next)),.005,rope,6);
    }
  }
  return m.finish();
}
