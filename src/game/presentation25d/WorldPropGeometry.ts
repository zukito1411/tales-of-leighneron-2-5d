import type Phaser from 'phaser';
import {HERO_BODY_HEIGHT} from '../../data/heroBodyRegistration';
import {ART_BY_KEY,type ArtTextureKey} from '../../data/art';
import type {Patch} from './ModelMesh';
import type {FurnitureShape} from './FurnitureGeometry';
import materials from './worldPropMaterials.json';
import {worldPropKind,worldPropGroundPlan} from '../../data/worldPropGroundPlan';
import {SHIP_DECK_HEIGHT} from './WalkSurface';

/** Shared prefabs keep real atlas registration, authored floor orientation
 * and the original collision survey. Called once when a streamed prop enters. */
export function worldPropShape(actor:Phaser.GameObjects.Image|Phaser.GameObjects.Sprite,texture:ArtTextureKey,index:number):FurnitureShape|undefined {
  const art=worldPropKind(texture,index);if(!art)return;
  const sheet=ART_BY_KEY[texture],frame=actor.frame;
  const meta=frame.customData as {visibleBounds?:{left:number;top:number;width:number;height:number};sourceRegion?:readonly number[]}|undefined;
  const b=meta?.visibleBounds;if(!b)return;
  const d=sheet.density,w=b.width*d,h=b.height*d;
  const width=w/frame.cutWidth,height=h/frame.cutHeight,left=b.left*d/frame.cutWidth,top=b.top*d/frame.cutHeight;
  if(art==='life-tree'){
    const source=meta?.sourceRegion??[0,0,1280,1280];
    return {art,kit:'elarion-tree-of-life',key:['life-tree',left,top,width,height,...source].join(':'),
      left,top,width,height,rise:h/w,depth:.62,patch:[.45,.60,.5,.65],
      footY:(b.top*d+.965*h-actor.originY*frame.cutHeight)/w,
      sourceRegion:[source[0]/1280,source[1]/1280,source[2]/1280,source[3]/1280],
      bounds:{left:-.6,right:.6,bottom:-.03,top:h/w,back:-.35,front:.35}};
  }
  const {l,r,vertical,modelScale,localX,localY,depth}=worldPropGroundPlan(texture,index,w,h)!;
  const modelW=w*modelScale;
  const footX=(b.left*d+localX*w-actor.originX*frame.cutWidth)/modelW;
  const footY=(b.top*d+localY*h-actor.originY*frame.cutHeight)/modelW;
  let rise=h/w;
  if(texture==='flower_fence')rise=HERO_BODY_HEIGHT*.95/Math.max(1,Math.abs(actor.displayWidth)*width*modelScale);
  if(art==='cargo'||art==='crate'||art==='barrels'||art==='wagon'||art==='ledger')rise*=.78;
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
  return {art,kit:'world:'+texture+':'+index,left,top,width,height,rise,depth,patch,stonePatch,roofPatch,footX,footY,modelScale,
    fire:!(texture==='native_quest_landmarks'&&index===1),canopy:!(texture==='native_quest_landmarks'&&index===0),
    paintOffset:vertical?0:.5-(l+r)/2,ornamentX:art==='lampPost'?(index===1?.5:.78)-(l+r)/2:undefined,
    bounds:{left:-.60+Math.min(0,.5-(l+r)/2),right:.60+Math.max(0,.5-(l+r)/2),bottom:0,top:rise*1.25,back:-Math.max(depth*1.1,depth/2+.5),front:Math.max(.16,.5-depth/2,art==='wagon'?rise*.22-depth*.2+.03:0)},
    heading:vertical?Math.PI/2:0,quarterTurnUV:vertical,
    key:['world',texture,index,left,top,width,height,rise,depth,modelScale].join(':')};
}

/** The ship's source is already a measured ground plan, not an elevation. */
export function shipShape(art:'ship'|'ship-stern'|'ship-mast'|'ship-pennant'):FurnitureShape {
  const shape:FurnitureShape={art,kit:'flagship',key:art,left:0,top:0,width:1,height:1,rise:1,depth:.2,patch:[.34,.47,.38,.53],fixedGround:SHIP_DECK_HEIGHT};
  if(art==='ship'){
    shape.depth=1.5;shape.bounds={left:-.39,right:.49,bottom:-.18,top:.08,back:-.60,front:.74};
  }else if(art==='ship-stern'){
    shape.rise=.46;shape.depth=.75;shape.footX=.5;shape.footY=(1438-978)/566;
    shape.patch=[.45,.63,.49,.69];
  }else if(art==='ship-mast'){
    shape.rise=650/480;shape.depth=.16;shape.footX=(412-170)/480;shape.footY=650/480;
    shape.patch=[.49,.60,.51,.66];
  }else{
    shape.rise=100/216;shape.footX=.5;shape.footY=(657-45)/216;shape.lift=(657-145)/216;
  }
  return shape;
}
