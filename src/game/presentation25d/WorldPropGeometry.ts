import {TELEPORT_SHRINE} from '../../data/townShrines';
import {elarionCascade} from '../../data/elarionHighlands';
import {worldHeight} from './plane';
import {streetStair} from '../../data/settlementStairs';
import {outdoorFitting} from '../../data/outdoorFurniture';
import {capitalPropStyle} from '../../data/highmereStreetStyle';
import type Phaser from 'phaser';
import {HERO_BODY_HEIGHT} from '../../data/heroBodyRegistration';
import {ART_BY_KEY,artFrameSize,type ArtTextureKey} from '../../data/art';
import type {Patch} from './ModelMesh';
import type {FurnitureShape} from './FurnitureGeometry';
import materials from './worldPropMaterials.json';
import {worldPropKind,worldPropGroundPlan} from '../../data/worldPropGroundPlan';
import {SHIP_DECK_HEIGHT} from './WalkSurface';
import {FLAGSHIP,FLAGSHIP_GANGPLANK} from '../../data/pirateFlagship';

/** Shared prefabs keep real atlas registration, authored floor orientation
 * and the original collision survey. Called once when a streamed prop enters. */
export function worldPropShape(actor:Phaser.GameObjects.Image|Phaser.GameObjects.Sprite,texture:ArtTextureKey,index:number):FurnitureShape|undefined {
  const style=capitalPropStyle(actor.name),fitting=outdoorFitting(actor.name),stairs=streetStair(actor.name);
  const cascade=elarionCascade(actor.name);
  const art=cascade?'waterfall':stairs?'stairs':fitting?.art??(actor.name.startsWith('wildcamp:')&&actor.name.endsWith(':fire')?'campfire':style==='cafe-table'||style==='cloth-counter'?'table':style==='cafe-chair'?'chair':style==='flower-pot'?'planter':style==='arms-rack'?'weaponRack':worldPropKind(texture,index));if(!art)return;
  const sheet=ART_BY_KEY[texture],frame=actor.frame;
  const meta=frame.customData as {visibleBounds?:{left:number;top:number;width:number;height:number};sourceRegion?:readonly number[]}|undefined;
  const b=meta?.visibleBounds;if(!b)return;
  const d=sheet.density,w=b.width*d,h=b.height*d;
  const width=w/frame.cutWidth,height=h/frame.cutHeight,left=b.left*d/frame.cutWidth,top=b.top*d/frame.cutHeight;
  if(cascade){
    // Match every water vertex to the simulation's exact terrain triangles.
    // Both dimensions are lattice-aligned; this work occurs once per admission.
    const modelWidth=cascade.width,base=worldHeight(actor.scene,cascade.x,cascade.y),heights:number[]=[];
    for(let row=0;row<=cascade.run/64;row++)for(let col=0;col<=4;col++)
      heights.push((worldHeight(actor.scene,cascade.x-modelWidth/2+col*64,cascade.y-cascade.run+row*64)-base+3)/modelWidth);
    const rise=Math.max(...heights);
    return {art:'waterfall',kit:'world:elarion-cascade',key:cascade.id+':'+heights.join(','),left,top,width,height,
      rise,depth:cascade.run/modelWidth,patch:[.4,.55,.48,.63],cascadeHeights:heights,
      modelScale:modelWidth/(Math.abs(actor.displayWidth)*width),footX:0,footY:0,fixedGround:base,
      bounds:{left:-.65,right:.65,bottom:-.02,top:rise+.08,back:-cascade.run/modelWidth-.1,front:.08}};
  }
  if(stairs){
    const modelWidth=artFrameSize(texture,index).width*Math.abs(actor.scaleX)*d;
    return {art:'stairs',kit:'world:capital-stair',key:'capital-stair:'+modelWidth,left,top,width,height,
      rise:stairs.height/modelWidth,depth:stairs.run/modelWidth,patch:[.4,.55,.48,.63],
      modelScale:modelWidth/(Math.abs(actor.displayWidth)*width),footX:0,footY:0,fixedGround:0,
      stairHeights:stairs.heights,openSides:true,
      bounds:{left:-.45,right:.45,bottom:0,top:stairs.height/modelWidth,back:-stairs.run/modelWidth,front:0}};
  }
  if(art==='life-tree'){
    const source=meta?.sourceRegion??[0,0,1280,1280];
    return {art,kit:'elarion-tree-of-life',key:['life-tree',left,top,width,height,...source].join(':'),
      left,top,width,height,rise:h/w,depth:.62,patch:[.45,.60,.5,.65],
      footY:(b.top*d+.965*h-actor.originY*frame.cutHeight)/w,
      sourceRegion:[source[0]/1280,source[1]/1280,source[2]/1280,source[3]/1280],
      bounds:{left:-.6,right:.6,bottom:-.03,top:h/w,back:-.35,front:.35}};
  }
  const {l,r,vertical,modelScale,localX,localY,depth}=worldPropGroundPlan(texture,index,w,h,art)!;
  const modelW=w*modelScale;
  const fittingWidth=fitting?artFrameSize(texture,index).width*Math.abs(actor.scaleX)*d:0;
  const footX=(b.left*d+localX*w-actor.originX*frame.cutWidth)/modelW;
  const footY=(b.top*d+localY*h-actor.originY*frame.cutHeight)/modelW;
  let rise=h/w;
  if(art==='campfire')rise=HERO_BODY_HEIGHT*.7/Math.max(1,Math.abs(actor.displayWidth)*width*modelScale);
  if(texture==='flower_fence')rise=HERO_BODY_HEIGHT*.95/Math.max(1,Math.abs(actor.displayWidth)*width*modelScale);
  if(art==='cargo'||art==='crate'||art==='barrels'||art==='wagon'||art==='ledger')rise*=.78;
  else if(art==='bench')rise=HERO_BODY_HEIGHT*.72/Math.max(1,Math.abs(actor.displayWidth)*width*modelScale);
  else if(art==='keepsake')rise=.04;
  const raw=materials[(texture+':'+index) as keyof typeof materials];
  let patch:readonly [number,number,number,number]=raw?[raw[0],raw[1],raw[2],raw[3]]:[.4,.55,.48,.63];
  // The loader can alpha-trim the original crop. Convert surveyed patches into
  // that retained source rectangle; do not assume the old crop centre survived.
  const source=sheet.regions?.[index]??sheet.sources?.[index]?.cell,actual=meta?.sourceRegion;
  const remap=(p:Patch):Patch=>source&&actual?[(source[0]+p[0]*source[2]-actual[0])/actual[2],(source[1]+p[1]*source[3]-actual[1])/actual[3],
    (source[0]+p[2]*source[2]-actual[0])/actual[2],(source[1]+p[3]*source[3]-actual[1])/actual[3]]:p;
  patch=remap(patch);
  // Separate the source well's warm timber, beige masonry and slate roof.
  const civic=texture==='others'||texture==='native_civic_bare';
  const stonePatch=civic&&index===6?remap([.18,.79,.32,.86]):civic&&index===10?remap([.75,.64,.81,.72]):undefined;
  const roofPatch=civic&&index===6?remap([.25,.20,.42,.26]):undefined;
  const woodPatch=civic&&index===6?remap([.71,.45,.755,.59]):civic&&index===10?remap([.42,.64,.52,.71]):
    texture==='flower_fence'?remap(index===0?[.491,.27,.501,.62]:[.43,.25,.46,.45]):undefined;
  if(woodPatch)patch=woodPatch;
  if(fitting||style==='cloth-counter'||style==='flower-pot'||style==='arms-rack'){
    const worldWidth=Math.max(1,fitting?fittingWidth:Math.abs(actor.displayWidth)*width*modelScale);
    rise=(art==='goddess-shrine'?TELEPORT_SHRINE.rise*worldWidth:style==='windmill'?HERO_BODY_HEIGHT*5.2:style==='pasture-fence'?HERO_BODY_HEIGHT*.72:style==='pasture-straw'?HERO_BODY_HEIGHT*.045:style==='pasture-trough'?HERO_BODY_HEIGHT*.46:style==='laundry-line'?HERO_BODY_HEIGHT*1.65:style==='hay-bales'?HERO_BODY_HEIGHT*.80:style==='cafe-table'||style==='cloth-counter'?HERO_BODY_HEIGHT*.44:style==='cafe-chair'?HERO_BODY_HEIGHT*.86:style==='arms-rack'?HERO_BODY_HEIGHT*1.20:HERO_BODY_HEIGHT*.72)/worldWidth;
  }
  const shape:FurnitureShape={streetStyle:style,art,kit:'world:'+texture+':'+index,left,top,width,height,rise,depth,patch,stonePatch,roofPatch,footX,footY,modelScale,
    fire:!(texture==='native_quest_landmarks'&&index===1),canopy:!(texture==='native_quest_landmarks'&&index===0),
    paintOffset:vertical?0:.5-(l+r)/2,ornamentX:art==='lampPost'?(index===1?.5:.78)-(l+r)/2:undefined,
    bounds:{left:-.60+Math.min(0,.5-(l+r)/2),right:.60+Math.max(0,.5-(l+r)/2),bottom:0,top:rise*(style?.endsWith('-stall')?1.4:1.25),back:-Math.max(depth*1.1,depth/2+.5),front:Math.max(.16,.5-depth/2,art==='wagon'?rise*.22-depth*.2+.03:0)},
    heading:vertical?Math.PI/2:0,quarterTurnUV:vertical,
    key:['world',art,style??'',texture,index,left,top,width,height,rise,depth,modelScale].join(':')};
  if(fitting){
    shape.depth=fitting.depth;shape.modelScale=fittingWidth/(Math.abs(actor.displayWidth)*width);
    shape.footX=shape.footY=shape.heading=shape.paintOffset=0;
    shape.bounds={left:style==='windmill'?-.95:-.52,right:style==='windmill'?.95:.52,bottom:0,top:style==='windmill'?Math.max(rise*1.25,rise*.71+.94):rise*1.25,
      back:-fitting.depth-.03,front:style==='windmill'?.12:.03};
    if(art==='goddess-shrine'){shape.pose=0;shape.key='goddess-shrine-v1:0';}
    if(style==='hay-bales')shape.interiorUse='stable-hay';
    else if(style==='pasture-straw')shape.interiorUse='stable-bedding';
    else if(style==='pasture-trough')shape.interiorUse='stable';
  }
  return shape;
}

/** The ship's source is already a measured ground plan, not an elevation. */
export function shipShape(art:'ship'|'ship-stern'|'ship-mast'|'ship-pennant'):FurnitureShape {
  const shape:FurnitureShape={art,kit:'flagship',key:art,left:0,top:0,width:1,height:1,rise:1,depth:.2,patch:[.34,.47,.38,.53],fixedGround:SHIP_DECK_HEIGHT};
  if(art==='ship'){
    shape.depth=1.5;shape.bounds={left:-.39,right:(FLAGSHIP_GANGPLANK.right-512)/1024+.02,bottom:-.18,top:.08,back:-.60,front:.74};
  }else if(art==='ship-stern'){
    // Deck expansion must not turn the stern cabin into a camera-height wall.
    // Keep its complete model at a readable human-scale height.
    shape.rise=HERO_BODY_HEIGHT*2.4/(566*FLAGSHIP.scale);shape.depth=.75;shape.footX=.5;shape.footY=(1438-978)/566;
    shape.patch=[.45,.63,.49,.69];
  }else if(art==='ship-mast'){
    shape.rise=650/480;shape.depth=.16;shape.footX=(412-170)/480;shape.footY=650/480;
    shape.patch=[.49,.60,.51,.66];
  }else{
    shape.rise=100/216;shape.footX=.5;shape.footY=(657-45)/216;shape.lift=(657-145)/216;
  }
  return shape;
}
