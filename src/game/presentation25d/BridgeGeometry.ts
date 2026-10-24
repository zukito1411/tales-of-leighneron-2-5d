import type Phaser from 'phaser';
import {ART_BY_KEY} from '../../data/art';
import {ROAD_BRIDGE_FRAME} from '../../data/bridgeDeck';
import {ModelMesh,atlasMaterial,type V3} from './ModelMesh';
import type {FurnitureShape} from './FurnitureGeometry';
import {BRIDGE_DECK_HEIGHT} from './WalkSurface';

/** Keep the surveyed 90..393 / 196..261 deck; strip the old bank/water picture.
 * These source coordinates also drive bridgeDeck.ts navigation. */
export function bridgeShape(actor:Phaser.GameObjects.Image|Phaser.GameObjects.Sprite):FurnitureShape {
  const frame=actor.frame,sheet=ART_BY_KEY.bridges;
  const meta=frame.customData as {visibleBounds:{left:number;top:number;width:number;height:number};sourceRegion?:readonly [number,number,number,number]};
  const b=meta.visibleBounds,source=meta.sourceRegion??sheet.regions![ROAD_BRIDGE_FRAME],density=sheet.density;
  const width=b.width*density/frame.cutWidth,height=b.height*density/frame.cutHeight;
  const modelScale=420/source[2];
  return {art:'bridge',kit:'bridge',key:['bridge',...source,width,height].join(':'),left:b.left*density/frame.cutWidth,top:b.top*density/frame.cutHeight,
    width,height,rise:.25,depth:.20,modelScale,sourceRegion:source,fixedGround:BRIDGE_DECK_HEIGHT,patch:[.35,.50,.45,.65],
    bounds:{left:-.38,right:.39,bottom:-.16,top:.26,back:-.10,front:.11}};
}
export function createBridgeGeometry(shape:FurnitureShape,emission=false){
  const m=new ModelMesh(shape,emission);
  const timber=atlasMaterial('architecture',1,.12,.30);
  const planks=atlasMaterial('architecture',13,.40,.22);
  const rope=atlasMaterial('furnishings',0,.12,.025);
  const p=(x:number,y:number,h:number):V3=>[(x-241)/420,h,(y-229)/420];
  m.box((90-241)/420,(393-241)/420,-.022,0,(196-229)/420,(261-229)/420,planks);
  for(const y of [198,259]){
    m.beam(p(90,y,-.018),p(393,y,-.018),.013,timber,6);
    for(const x of [145,347]){
      m.cylinder((x-241)/420,(y-229)/420,-.16,.20,.018,.016,timber,10);
      m.ring((x-241)/420,(y-229)/420,.145,.16,.021,.015,rope,10);
    }
    for(let i=0;i<8;i++){
      const x=145+202*i/8,next=145+202*(i+1)/8;
      const h=(u:number)=>.16-Math.sin((u-145)/202*Math.PI)*.045;
      m.beam(p(x,y,h(x)),p(next,y,h(next)),.005,rope,6);
    }
  }
  return m.finish();
}
