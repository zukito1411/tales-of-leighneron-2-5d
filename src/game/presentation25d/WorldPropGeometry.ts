import type Phaser from 'phaser';
import {ART_BY_KEY,type ArtTextureKey} from '../../data/art';
import {worldSpriteProfile} from '../../data/worldSpriteGeometry';
import type {FurnitureShape,FurnitureArt} from './FurnitureGeometry';
import materials from './worldPropMaterials.json';
import {SHIP_DECK_HEIGHT} from './WalkSurface';

// Explicit semantic admission: foliage, cacti, bones, reeds, trunks, stumps,
// fallen logs, flowers and other delicate natural cutouts retain billboards.
const civic:Readonly<Record<number,FurnitureArt>>={0:'lampPost',1:'lampPost',2:'lampPost',3:'brazier',4:'sign',5:'stall',6:'well',7:'bench',8:'barrels',9:'cargo',10:'fountain',12:'banner',13:'brazier'};
const story:Readonly<Record<number,FurnitureArt>>={0:'lectern',1:'satchel',2:'ledger',3:'lantern',4:'wagon',5:'dummy',6:'pump',7:'keepsake',8:'keepsake',9:'keepsake',10:'chest',11:'waystone'};
const volumeDepth:Partial<Record<FurnitureArt,number>>={well:.88,fountain:.80,barrels:.76,cargo:.62,crate:.62,chest:.58,
  stall:.72,tent:.80,wagon:.68,bench:.38,rock:.58,columns:.56,crystals:.55,waystone:.38,shrine:.45,sack:.50,brazier:.44,satchel:.40,ledger:.62};
const kinds:Partial<Record<ArtTextureKey,Readonly<Record<number,FurnitureArt>>>>={
  others:civic,native_civic_bare:civic,native_story_bare:story,native_story_props:story,
  world_assets:{2:'rock',3:'fence',5:'sign',6:'brazier',7:'cargo'},
  desert_props:{4:'rock',5:'rock',6:'wagon',7:'sign',8:'cargo',9:'tent',11:'arch'},
  woodland_props:{8:'rock',9:'rock',11:'waystone'},
  climate_props:{2:'crystals',3:'rock',4:'fence',5:'brazier',6:'crystals',7:'columns',8:'rock',9:'brazier',10:'shrine'},
  flower_fence:{0:'fence',1:'fence',2:'fence',3:'fence'},
  native_quest_landmarks:{0:'well',1:'brazier',2:'tent',3:'waystone',4:'sealed-gate',5:'sack'},
};

/** Shared prefabs keep real atlas registration, authored floor orientation
 * and the original collision survey. Called once when a streamed prop enters. */
export function worldPropShape(actor:Phaser.GameObjects.Image|Phaser.GameObjects.Sprite,texture:ArtTextureKey,index:number):FurnitureShape|undefined {
  const art=texture==='elarion_tree'?'life-tree':kinds[texture]?.[index];if(!art)return;
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
  const profile=worldSpriteProfile(texture,index),polygons=profile?.solids??[];
  let l=.08,r=.92,t=.70,bottom=.97;
  if(polygons.length){l=Math.min(...polygons.flatMap(p=>p.map(v=>v[0])));r=Math.max(...polygons.flatMap(p=>p.map(v=>v[0])));
    t=Math.min(...polygons.flatMap(p=>p.map(v=>v[1])));bottom=Math.max(...polygons.flatMap(p=>p.map(v=>v[1])));}
  const vertical=texture==='flower_fence'&&index>0;
  const modelScale=vertical?(bottom-t)*h/w:1;
  const modelW=w*modelScale;
  const localX=vertical?l:(l+r)/2,localY=vertical?(t+bottom)/2:bottom;
  const footX=(b.left*d+localX*w-actor.originX*frame.cutWidth)/modelW;
  const footY=(b.top*d+localY*h-actor.originY*frame.cutHeight)/modelW;
  const depth=vertical?(r-l)*w/modelW:Math.max(volumeDepth[art]??.10,(bottom-t)*h/w);
  let rise=h/w;
  if(vertical)rise=Math.min(.4,w/modelW);
  else if(art==='cargo'||art==='crate'||art==='barrels'||art==='wagon'||art==='ledger')rise*=.78;
  else if(art==='keepsake')rise=.04;
  const raw=materials[(texture+':'+index) as keyof typeof materials];
  let patch:readonly [number,number,number,number]=raw?[raw[0],raw[1],raw[2],raw[3]]:[.4,.55,.48,.63];
  // The loader can alpha-trim the original crop. Convert surveyed patches into
  // that retained source rectangle; do not assume the old crop centre survived.
  const source=sheet.regions?.[index]??sheet.sources?.[index]?.cell,actual=meta?.sourceRegion;
  if(source&&actual)patch=[(source[0]+patch[0]*source[2]-actual[0])/actual[2],(source[1]+patch[1]*source[3]-actual[1])/actual[3],
    (source[0]+patch[2]*source[2]-actual[0])/actual[2],(source[1]+patch[3]*source[3]-actual[1])/actual[3]];
  return {art,kit:'world:'+texture+':'+index,left,top,width,height,rise,depth,patch,footX,footY,modelScale,
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
