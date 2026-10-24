import {FLAGSHIP_HULL} from '../../data/pirateFlagship';
import {createSourceVolumeGeometry} from './SourceVolumeGeometry';
import {createTravelCartGeometry} from './TravelCartGeometry';
import {createBridgeGeometry} from './BridgeGeometry';
import {createCoastalBoatGeometry} from './CoastalBoatGeometry';
import {ModelMesh,atlasMaterial,paintedMaterial,brass,metal,glass,lampGlass,water,pigment,regionalFabric,regionalWood,masonry,type ModelMaterial,type V3} from './ModelMesh';
import type Phaser from 'phaser';
import type {HomeFurnitureArt} from '../../data/housing';
import {HERO_BODY_HEIGHT} from '../../data/heroBodyRegistration';
import materials from './furnitureMaterials.json';

export type PropArt='travel-horse'|'travel-cart'|'life-tree'|'crate'|'cargo'|'barrels'|'fence'|'sign'|'lampPost'|'brazier'|'well'|'fountain'|'stall'|'tent'|'wagon'|'rock'|'columns'|'crystals'|'waystone'|'lectern'|'sack'|'pump'|'banner'|'shrine'|'dummy'|'keepsake'|'ship'|'ship-stern'|'ship-mast'|'ship-pennant'|'bridge'|'ledger'|'satchel'|'sealed-gate'|'coastal-boat';
export type FurnitureArt=Exclude<HomeFurnitureArt,'rug'|'northWall'|'sideWall'>|'doorway'|'openChest'|'tower-door-closed'|'tower-door-open'|PropArt;
type Patch=readonly [number,number,number,number];
export interface FurnitureShape {
  art:FurnitureArt;kit:string;key:string;
  /** Visible artwork in frame UV coordinates, independent of atlas padding. */
  left:number;top:number;width:number;height:number;
  /** Model units are one visible furniture width. Origin is the front foot. */
  rise:number;depth:number;patch:Patch;
  footX?:number;footY?:number;heading?:number;modelScale?:number;lift?:number;quarterTurnUV?:boolean;
  paintOffset?:number;ornamentX?:number;
  fixedGround?:number;pose?:number;stonePatch?:Patch;roofPatch?:Patch;
  fire?:boolean;canopy?:boolean;
  sourceRegion?:readonly [number,number,number,number];
  bounds?:{left:number;right:number;bottom:number;top:number;back:number;front:number};
}
export interface FurniturePlacement {x:number;y:number;width:number;heading:number;lift:number}
export function furniturePlacement(owner:Pick<Phaser.GameObjects.Image,'x'|'y'|'rotation'|'displayWidth'>,shape:FurnitureShape,out:FurniturePlacement){
  const width=Math.abs(owner.displayWidth)*shape.width*(shape.modelScale??1),a=owner.rotation,c=Math.cos(a),s=Math.sin(a);
  const x=(shape.footX??0)*width,y=(shape.footY??0)*width;
  out.x=owner.x+x*c-y*s;out.y=owner.y+x*s+y*c;out.width=width;out.heading=a+(shape.heading??0);out.lift=(shape.lift??0)*width;return out;
}
const depths:Partial<Record<FurnitureArt,number>>={bed:1.1,wardrobe:.34,bookcase:.30,chest:.45,table:.5,bench:.32,chair:.5,
  counter:.32,hearth:.30,planter:.55,barrel:.86,pantry:.34,weaponRack:.22,lantern:.22,stairs:.85,arch:.18,
  workstation:.30,signature:.35,window:.16,doorway:.22,'tower-door-closed':.22,'tower-door-open':.22,openChest:.6};
// Human-scale elevations, independent of a room's authored furniture width.
// Counter paint sits at .883 of the mesh envelope; chair seats at .383 and
// mattresses at .424. Keep those surfaces in proportion to the standing body.
const bodyHeights:Partial<Record<FurnitureArt,number>>={
  bed:.72,table:.44,bench:.27,chair:.90,counter:.58/.883,workstation:.48,
  wardrobe:1.45,bookcase:1.42,pantry:1.18,hearth:1.20,barrel:.76,chest:.56,openChest:.56,
  planter:.70,weaponRack:1.20,lantern:.52,stairs:1.15,arch:1.70,doorway:1.70,window:1.05,
};

/** Frame dimensions are authored during the existing bounded room preparation.
 * There is no pixel scan, generated image or model cache in the render loop. */
export function furnitureShape(art:HomeFurnitureArt|'doorway'|'openChest'|'tower-door-closed'|'tower-door-open',kit:string,
  frame:Phaser.Textures.Frame,displayWidth:number,depth?:number):FurnitureShape|undefined {
  if(art==='rug'||art==='northWall'||art==='sideWall')return;
  const meta=frame.customData as {visibleWidth?:number;visibleHeight?:number;furnitureBottom?:number}|undefined;
  const w=meta?.visibleWidth??frame.cutWidth,h=meta?.visibleHeight??frame.cutHeight;
  const bottom=meta?.furnitureBottom??frame.cutHeight;
  const left=(frame.cutWidth-w)/2/frame.cutWidth,top=(bottom-h)/frame.cutHeight;
  const width=w/frame.cutWidth,height=h/frame.cutHeight;
  const bodyHeight=bodyHeights[art];
  const rise=bodyHeight===undefined?h/w:HERO_BODY_HEIGHT*bodyHeight/Math.max(.001,Math.abs(displayWidth)*width);
  const patchKey=kit+':'+(art==='openChest'?'chest':art);
  const raw=materials[patchKey as keyof typeof materials];
  const patch:Patch|undefined=raw?.length===4?[raw[0],raw[1],raw[2],raw[3]]:undefined;
  const d=Math.max(.06,depth??depths[art]??.3);
  return {art,kit,left,top,width,height,rise,depth:d,bounds:{left:-.62,right:.62,bottom:0,top:rise*1.3,back:-Math.max(d*1.1,d/2+.55),front:.16},patch:patch??[.25,.45,.32,.52],
    key:[art,kit,left,top,width,height,rise,d].join(':')};
}

/** Furniture is assembled from closed, detailed mesh parts. Only naturally
 * thin cloth and foliage use cutouts; complete object paintings are not faces. */
export function createFurnitureGeometry(shape:FurnitureShape,emission=false){
  if(shape.art==='travel-horse'||shape.art==='life-tree')return createSourceVolumeGeometry(shape,emission);
  if(shape.art==='travel-cart')return createTravelCartGeometry(shape,emission);
  if(shape.art==='coastal-boat')return createCoastalBoatGeometry(shape,emission);
  if(shape.art==='bridge')return createBridgeGeometry(shape,emission);
  const {art,kit,rise:H,depth:D}=shape,m=new ModelMesh(shape,emission);
  const sourceKit=kit!=='flagship';
  const wood=sourceKit?paintedMaterial(shape.patch,.38,.48):regionalWood(kit),ivory=atlasMaterial('furnishings',4,.70,.70);
  const clothPatches:Partial<Record<FurnitureArt,Patch>>={bed:[.25,.60,.40,.73],chair:[.24,.56,.40,.64],
    bench:[.26,.23,.44,.39],table:[.42,.48,.52,.63],counter:[.25,.42,.34,.60],workstation:[.29,.54,.40,.63],chest:[.26,.70,.36,.80],openChest:[.26,.70,.36,.80]};
  const cloth=clothPatches[art];
  const worldCloth:Partial<Record<FurnitureArt,Patch>>={stall:[.22,.12,.43,.23],tent:[.28,.21,.43,.33],banner:[.25,.25,.55,.50],sack:[.35,.40,.55,.60]};
  const sourceCloth=kit.startsWith('world:')?worldCloth[art]:cloth;
  const fabric=sourceCloth?paintedMaterial(sourceCloth,.42,.42):regionalFabric(kit);
  const cultural=/noble|elven/.test(kit);
  const face=(l:number,r:number,b:number,t:number,z:number,source:Patch)=>m.cutout([l,b,z],[r,b,z],[l,t,z],[r,t,z],source);
  const top=(l:number,r:number,back:number,front:number,y:number,source:Patch)=>m.cutout([l,y,front],[r,y,front],[l,y,back],[r,y,back],source);
  const decorated=/noble|elven|orcan|obsidian|dwarven/.test(kit);

  const dark=atlasMaterial('furnishings',2,.72,.85),stone=shape.stonePatch?paintedMaterial(shape.stonePatch,.32,.25):kit.startsWith('world:')&&['rock','columns','crystals','waystone','shrine','well','fountain'].includes(art)?paintedMaterial(shape.patch,.42,.36):masonry(kit);
  const trim:ModelMaterial={color:pigment(cultural?0xc79b4d:/orcan|obsidian|dwarven/.test(kit)?0x927044:0x65432b)};
  const box=(l:number,r:number,b:number,t:number,back:number,front:number,mat:ModelMaterial=wood)=>m.box(l,r,b,t,back,front,mat);
  const tube=(x:number,z:number,b:number,t:number,r:number,s=r,mat:ModelMaterial=wood)=>m.cylinder(x,z,b,t,r,s,mat);
  const legs=(seat:number,back=-D+.07,front=-.07)=>{
    for(const x of [-.40,.40])for(const z of [front,back]){box(x-.03,x+.03,0,seat,z-.03,z+.03);box(x-.04,x+.04,0,seat*.10,z-.04,z+.04,trim);}
  };
  const candle=(x:number,z:number,y:number,h:number)=>{
    tube(x,z,y,y+h*.78,h*.14,h*.13,ivory);
    m.fire(x,y+h*.78,z,h*.40,h*.45,art==='table'?[.54,.17,.61,.35]:[.57,.08,.65,.26]);
  };
  const cup=(x:number,z:number,y:number,r:number)=>{m.ring(x,z,y,y+r*1.5,r,r*.7,ivory,12);};
  const roof=(eave:number,peak:number)=>{
    const covering=shape.roofPatch?paintedMaterial(shape.roofPatch,.38,.30):fabric;
    const lip=Math.min(.02,H*.035);
    m.extrude([[-.52,eave],[0,peak],[.52,eave],[.52,eave-lip],[0,peak-lip],[-.52,eave-lip]],.02,-D-.02,covering);
    for(const x of [-.51,.51])m.beam([x,eave,-D-.03],[x,eave,.03],.015,trim);
    m.beam([0,peak,-D-.035],[0,peak,.035],.014,trim);
  };
  const barrel=(x:number,z:number,b:number,t:number,r:number)=>{
    m.cylinder(x,z,b,b+(t-b)*.2,r*.82,r,wood,20);m.cylinder(x,z,b+(t-b)*.2,t-(t-b)*.2,r,r,wood,20);m.cylinder(x,z,t-(t-b)*.2,t,r,r*.82,wood,20,false);
    m.cylinder(x,z,t-(t-b)*.2,t,r*.74,r*.74,wood,20,false);
    for(const y of [.15,.78]){
      const band=cultural?paintedMaterial([.18,.33,.29,.37],.36,.08):metal;
      m.ring(x,z,b+(t-b)*y,b+(t-b)*(y+.085),r*1.025,r*.94,band,20);
      if(cultural)for(const edge of [y,y+.073])m.ring(x,z,b+(t-b)*edge,b+(t-b)*(edge+.012),r*1.035,r*.95,brass,20);
    }
    if(cultural&&art==='barrel')face(-r*.42,r*.42,b+(t-b)*.29,b+(t-b)*.68,z+r+.004,[.30,.48,.65,.79]);
    m.ring(x,z,t-(t-b)*.035,t+.003,r*.84,r*.74,trim,20);
  };
  const crate=(l:number,r:number,b:number,t:number,back:number,front:number)=>{
    box(l,r,b,t,back,front);const q=(r-l)*.045;
    for(const x of [l,r-q])box(x-.003,x+q+.003,b,t+.004,back-.006,front+.006,trim);
    for(const y of [b,t-q])for(const z of [back-q*.2,front-q*.8])box(l,r,y,y+q+.003,z,z+q,trim);
    m.beam([l+q,b+q,front+.009],[r-q,t-q,front+.009],q*.45,trim);
    m.beam([r-q,b+q,back-.009],[l+q,t-q,back-.009],q*.45,trim);
  };
  const arch=(open:boolean)=>{
    const path:readonly (readonly [number,number])[]=[[-.48,0],[-.48,H*.68],[-.35,H*.90],[0,H],[.35,H*.90],[.48,H*.68],[.48,0],[.30,0],[.30,H*.62],[.22,H*.77],[0,H*.85],[-.22,H*.77],[-.30,H*.62],[-.30,0]];
    m.extrude(path,0,-D,stone);
    if(!open){box(-.29,.29,0,H*.64,-D+.01,-D+.055,dark);for(let i=0;i<6;i++)box(-.29+i*.58/6+.005,-.29+(i+1)*.58/6-.005,0,H*.63,-D+.055,-D+.075,wood);for(const y of [.18,.50])box(-.29,.29,H*y,H*(y+.04),-D+.075,-D+.085,metal);}
  };
  const chair=(throne=false)=>{
    const seat=throne?Math.min(H*.30,.28):H*.38;
    legs(seat*.87);box(-.43,.43,seat*.82,seat,-D+.02,0);m.softBox(-.37,.37,seat,seat+H*.045,-D+.05,-.025,fabric);

    for(const x of [-.42,.42]){box(x-.035,x+.035,seat,H,-D,-D+.07);tube(x,-D+.035,H*.96,H*1.04,.05,.025,trim);}
    box(-.43,.43,H*.88,H*.97,-D,-D+.07,trim);
    if(throne||decorated){box(-.34,.34,seat+H*.10,H*.86,-D+.014,-D+.056,fabric);}
    else for(let i=0;i<3;i++)box(-.34+i*.26,-.28+i*.26,seat+H*.08,H*.88,-D+.02,-D+.055);
    if(!kit.startsWith('world:')){
      face(-.31,.31,seat+H*.16,H*.86,-D+.058,[.24,.18,.76,.49]);
      top(-.34,.34,-D+.06,-.03,seat+H*.046,[.13,.51,.86,.72]);
    }
    if(throne)for(const x of [-.42,.42]){box(x-.035,x+.035,seat,seat+H*.24,-D*.20,-D*.12,trim);box(x-.045,x+.045,seat+H*.22,seat+H*.28,-D*.87,-D*.10,trim);}
  };
  const table=(bench=false,desk=false)=>{
    const backrest=bench&&kit.startsWith('world:'),seat=backrest?H*.48:H;
    legs(seat*.88);m.softBox(-.48,.48,seat*.86,seat,-D,0,wood);
    for(const x of [-.49,.46])box(x,x+.03,seat*.95,seat+.004,-D-.01,.01,trim);
    for(const z of [-D-.01,-.02])box(-.46,.46,seat*.95,seat+.004,z,z+.03,trim);
    box(-.40,.40,seat*.31,seat*.37,-D*.55,-D*.45);
    if(backrest){for(const x of [-.43,.43])box(x-.025,x+.025,seat,H,-D,-D+.05);for(const y of [.58,.78,.94])box(-.43,.43,H*y,H*(y+.055),-D,-D+.04);}
    if(!bench){box(-.14,.14,seat+.002,seat+.009,-D+.018,-.018,fabric);if(!kit.startsWith('world:'))top(-.14,.14,-D+.018,-.018,seat+.010,[.39,.46,.67,.88]);}
    if(!bench){
      if(desk){box(-.38,-.05,seat,seat+H*.10,-D*.7,-D*.35,fabric);box(-.34,-.01,seat+H*.10,seat+H*.17,-D*.68,-D*.35,ivory);}
      else{tube(-.18,-D*.5,seat,seat+H*.018,.10,.10,ivory);cup(.19,-D*.40,seat,H*.07);}
      candle(.28,-D*.75,seat,H*.24);
    }
  };
  const cabinet=(shelves=false,pantry=false)=>{
    box(-.43,.43,.035,H*.95,-D,-D+.045,dark);for(const x of [-.43,.43])box(x-.025,x+.025,.035,H*.95,-D,0);
    for(const y of [0,.07,.93])m.softBox(-.47,.47,H*y,H*(y+.055),-D-.015,.015,trim,.012);
    if(shelves||pantry){
      for(let row=0;row<3;row++){
        const y=H*(.15+row*.25);box(-.42,.42,y,y+H*.035,-D,.015);
        for(let i=0;i<5;i++){
          const x=-.34+i*.15,h=H*(.13+(i%3)*.023);
          if(pantry){tube(x,-D*.36,y+H*.035,y+H*.035+h,.052,.045,i%2?ivory:fabric);}
          else{box(x-.045,x+.045,y+H*.035,y+H*.035+h,-D*.75,-.025,i%3===0?fabric:i%3===1?dark:trim);box(x-.047,x+.047,y+H*.06,y+H*.07,-.031,-.024,brass);
            if(art==='bookcase')face(x-.044,x+.044,y+H*.04,y+H*.03+h,-.020,[.14+i*.13,.20+row*.20,.23+i*.13,.35+row*.20]);}
        }
      }
    }else{
      for(const x of [-.39,.015]){box(x,x+.375,H*.11,H*.90,-.04,-.012,dark);box(x+.025,x+.35,H*.15,H*.85,-.012,.005,wood);box(x+.29,x+.31,H*.48,H*.54,.005,.022,brass);}
    }
    if(art==='wardrobe'){
      face(-.355,-.04,H*.17,H*.85,.012,[.17,.24,.47,.84]);
      face(.04,.355,H*.17,H*.85,.012,[.53,.24,.84,.84]);
      face(-.34,.34,H*.91,H*.99,.018,[.18,.025,.82,.13]);
    }
  };
  if(art==='bed'){
    legs(H*.26);box(-.46,.46,H*.18,H*.27,-D+.04,0);m.softBox(-.43,.43,H*.27,H*.42,-D+.11,-.07,ivory,.018);m.softBox(-.435,.435,H*.35,H*.43,-D*.68,-.065,fabric,.012);
    top(-.40,.40,-D*.67,-.065,H*.434,[.12,.49,.88,.88]);
    m.softBox(-.30,.30,H*.42,H*.52,-D+.13,-D*.72,ivory,.018);
    top(-.27,.27,-D+.13,-D*.72,H*.523,[.19,.21,.81,.43]);
    for(const z of [-D,-.035])for(const x of [-.45,.45]){box(x-.035,x+.035,0,z===-D?H:H*.48,z-.03,z+.03);tube(x,z,z===-D?H*.96:H*.44,z===-D?H*1.03:H*.50,.045,.025,trim);}
    box(-.45,.45,H*.50,H*.91,-D-.02,-D+.035);box(-.37,.37,H*.57,H*.85,-D+.036,-D+.05,fabric);box(-.45,.45,H*.22,H*.40,-.06,0);
  }else if(art==='signature'&&/alpine/.test(kit)){
    box(-.46,.46,0,H*.10,-D,0,stone);box(-.36,.36,H*.10,H*.19,-D+.03,-.03,stone);
    box(-.27,.27,H*.19,H*.87,-D*.75,-D*.20,stone);box(-.35,.35,H*.85,H*.97,-D*.86,-D*.12,stone);
    face(-.23,.23,H*.27,H*.79,-D*.20+.002,[.27,.24,.73,.76]);
  }else if(art==='signature'&&/dwarven/.test(kit)){
    box(-.45,.45,0,H*.14,-D,0,stone);box(-.36,.36,H*.14,H*.68,-D*.91,-.04,stone);
    box(-.43,.43,H*.66,H*.76,-D,.01,metal);box(-.25,.25,H*.76,H,-D*.90,-D*.26,stone);
    box(-.20,.20,H*.18,H*.52,-.043,-.015,dark);m.fire(0,H*.24,-.010,.35,H*.28,[.36,.38,.66,.61]);
    for(const x of [-.28,.28])box(x-.022,x+.022,H*.14,H*.70,-.016,.008,brass);
    face(-.22,.22,H*.80,H*.98,-D*.26+.003,[.31,.06,.68,.27]);
  }else if(art==='signature'&&/maritime/.test(kit)){
    for(const x of [-.43,.43])box(x-.035,x+.035,0,H,-D*.75,-D*.45);
    for(const y of [.08,.93])box(-.47,.47,H*y,H*(y+.055),-D*.80,-D*.40,trim);
    face(-.38,.38,H*.16,H*.88,-D*.50,[.14,.18,.86,.84]);
    for(const x of [-.42,.42])box(x-.045,x+.045,0,H*.07,-D,0);
  }else if(art==='signature'&&/longhouse/.test(kit)){
    const seat=H*.35;legs(seat);m.softBox(-.43,.43,seat,seat+H*.13,-D+.08,-.035,ivory);
    box(-.46,.46,seat+H*.10,H*.94,-D,-D+.08);
    for(const x of [-.43,.43]){box(x-.035,x+.035,seat,H*.72,-D,-.04);m.beam([x,H*.72,-D],[x,H*.72,-.04],.035,trim,8);}
  }else if(art==='chair'||art==='signature'&&/noble|orcan/.test(kit))chair(art==='signature');
  else if(art==='table'||art==='bench'||art==='workstation')table(art==='bench',art==='workstation');
  else if(art==='wardrobe'||art==='bookcase'||art==='pantry')cabinet(art==='bookcase',art==='pantry');
  else if(art==='counter'){
    box(-.46,.46,0,H*.80,-D,0);box(-.49,.49,H*.80,H*.88,-D-.02,.02);box(-.48,.48,0,H*.07,-D-.012,.012,trim);
    face(-.42,.42,H*.15,H*.65,.018,[.10,.62,.90,.87]);
    for(const z of [.006,-D-.006])for(let i=0;i<4;i++){const x=-.42+i*.22;box(x,x+.18,H*.15,H*.65,z-.006,z+.006,trim);box(x+.016,x+.164,H*.18,H*.62,z+.007,z+.010);}
  }else if(art==='chest'||art==='openChest'){
    crate(-.46,.46,0,H*.56,-D,0);
    // Original painted panels are mounted within the physical lid/base rails.
    // Side/back surfaces use the same object's timber and cultural upholstery.
    if(!kit.startsWith('world:')){
      face(-.37,.37,H*.12,H*.51,.008,[.18,.66,.83,.88]);
      if(cultural)for(const z of [-D+.01,-.01])box(-.37,.37,H*.10,H*.52,z-.006,z+.006,fabric);
      if(cultural)face(-.37,.37,H*.12,H*.51,.016,[.18,.66,.83,.88]);
    }
    if(art==='openChest'){box(-.46,.46,H*.56,H*.98,-D-.025,-D+.035);box(-.40,.40,H*.58,H*.92,-D+.036,-D+.044,dark);box(-.40,.40,H*.54,H*.56,-D+.05,-.035,dark);}
    else{
      const profile: Array<readonly [number,number]>=[];
      for(let i=0;i<=8;i++){const a=i/8*Math.PI;profile.push([-D/2+Math.cos(a)*D/2,H*.56+Math.sin(a)*H*.25]);}
      // Rounded lid runs across the depth. Extrude in local Z then rotate the
      // complete lid mesh basis through swapped axes without flattening it.
      for(let i=1;i<profile.length;i++){const [za,ya]=profile[i-1],[zb,yb]=profile[i];m.quad([-.46,ya,za],[.46,ya,za],[-.46,yb,zb],[.46,yb,zb],/elven/.test(kit)?fabric:wood);for(const x of [-.46,.46])m.triangle([x,H*.56,-D/2],[x,ya,za],[x,yb,zb],trim);}
      if(/elven/.test(kit)&&!emission)for(let i=1;i<profile.length;i++){
        const [za,ya]=profile[i-1],[zb,yb]=profile[i];
        const va=.48-(i-1)/8*.40,vb=.48-i/8*.40;
        m.cutout([-.27,ya+.008,za],[.27,ya+.008,za],[-.27,yb+.008,zb],[.27,yb+.008,zb],[.28,vb,.72,va]);
      }
      for(const x of [-.30,.30])for(let i=1;i<profile.length;i++){const [za,ya]=profile[i-1],[zb,yb]=profile[i];m.quad([x-.025,ya+.004,za],[x+.025,ya+.004,za],[x-.025,yb+.004,zb],[x+.025,yb+.004,zb],cultural?brass:metal);}
      box(-.035,.035,H*.37,H*.62,0,.025,brass);
    }
  }else if(art==='barrel')barrel(0,-D/2,0,H*.96,Math.min(.44,D/2));
  else if(art==='barrels'){for(const [x,z,y,t] of [[-.24,-D*.3,0,H*.55],[.24,-D*.3,0,H*.55],[0,-D*.65,H*.45,H]])barrel(x,z,y,t,Math.min(.22,D*.28));}
  else if(art==='crate')crate(-.47,.47,0,H,-D,0);
  else if(art==='ledger'){
    crate(-.47,.47,0,H*.55,-D,0);
    m.softBox(-.29,.24,H*.55,H*.61,-D*.82,-D*.12,ivory,.008);
    top(-.29,.24,-D*.82,-D*.12,H*.612,[.22,.17,.67,.53]);
    m.cutout([.22,H*.57,-D*.72],[.39,H*.57,-D*.72],[.22,H,-D*.72],[.39,H,-D*.72],[.71,.015,.90,.40]);
  }else if(art==='satchel'){
    m.softBox(-.43,.43,0,H*.72,-D,0,atlasMaterial('furnishings',2,.55,.55),.035);
    m.softBox(-.42,.42,H*.48,H*.82,-D*.25,.018,wood,.02);
    face(-.39,.39,H*.43,H*.79,.020,[.16,.12,.70,.56]);
    face(-.10,.10,H*.15,H*.57,.023,[.39,.44,.56,.84]);
    for(let i=0;i<8;i++){const a=i/8*Math.PI,b=(i+1)/8*Math.PI;m.beam([Math.cos(a)*.37,H*(.69+Math.sin(a)*.29),-D*.65],[Math.cos(b)*.37,H*(.69+Math.sin(b)*.29),-D*.65],.025,dark,6);}
  }
  else if(art==='cargo'){crate(-.48,-.02,0,H*.57,-D*.58,0);crate(.0,.47,0,H*.57,-D*.83,-D*.25);crate(-.18,.30,H*.57,H,-D,-D*.33);}
  else if(art==='hearth'){
    box(-.48,.48,0,H*.10,-D,0,stone);for(const x of [-.39,.39])box(x-.08,x+.08,H*.1,H*.65,-D,0,stone);box(-.48,.48,H*.60,H*.72,-D-.02,.02,stone);box(-.25,.25,H*.70,H,-D,-D*.45,stone);box(-.28,.28,H*.10,H*.60,-D,-D+.03,dark);
    for(let i=0;i<3;i++){const x=(i-1)*.13;m.beam([x-.08,H*.15,-D*.7],[x+.08,H*.15,-.08],.035,dark,8);}
    const archPath:Array<readonly [number,number]>=[];
    for(let i=0;i<=10;i++){const a=i/10*Math.PI;archPath.push([Math.cos(a)*.39,H*(.32+Math.sin(a)*.36)]);}
    for(let i=10;i>=0;i--){const a=i/10*Math.PI;archPath.push([Math.cos(a)*.28,H*(.32+Math.sin(a)*.28)]);}
    m.extrude(archPath,.009,-.075,stone);
    m.fire(0,H*.16,-.055,.50,H*.43,[.33,.42,.69,.78]);
    for(let i=0;i<5;i++){const x=-.25+i*.125;box(x-.009,x+.009,H*.12,H*.29,-.025,0,metal);}
  }else if(art==='arch'||art==='doorway'||art==='tower-door-open'||art==='tower-door-closed'||art==='sealed-gate'){
    arch(art!=='tower-door-closed'&&art!=='sealed-gate');
    if(art==='sealed-gate')face(-.29,.29,H*.04,H*.77,-D+.09,[.23,.24,.80,.95]);
  }
  else if(art==='window'||art==='signature'&&/rustic/.test(kit)){
    box(-.42,.42,0,H*.25,-D,0,stone);box(-.43,.43,H*.25,H,-D,0);box(-.32,.32,H*.38,H*.86,.001,.005,glass);for(const x of [-.34,0,.34])box(x-.016,x+.016,H*.34,H*.90,.005,.028,trim);for(const y of [.35,.62,.89])box(-.36,.36,H*y,H*(y+.025),.005,.028,trim);
  }else if(art==='weaponRack'){
    for(const x of [-.43,.43]){box(x-.04,x+.04,0,H,-D*.65,-D*.35);box(x-.075,x+.075,0,H*.08,-D,0);}
    for(const y of [.16,.79])box(-.47,.47,H*y,H*(y+.065),-D*.65,-D*.35);for(let i=0;i<4;i++){const x=-.30+i*.2;m.beam([x,H*.81,-D*.36],[x,H*.76,-D*.15],.014,metal);}
  }else if(art==='stairs'){
    for(let i=0;i<5;i++)box(-.43,.43,0,H*(i+1)/5,-D*(i+1)/5,-D*i/5,stone);
    for(const x of [-.46,.46]){m.beam([x,H*.16,-.02],[x,H*.97,-D],.025,trim);for(let i=0;i<3;i++)m.beam([x,H*i/3,-D*i/3],[x,H*i/3+H*.20,-D*i/3],.016,trim);}
  }else if(art==='lantern'||art==='lampPost'||art==='brazier'||art==='pump'||art==='signature'&&/obsidian/.test(kit)){
    const z=-D/2;
    if(art!=='lantern'){
      tube(0,z,0,H*.10,Math.min(.20,D*.48),Math.min(.17,D*.40),stone);
      const bowl=art==='brazier'||art==='signature';
      const tripod=bowl&&/world:(others|native_civic_bare):13$/.test(kit);
      if(tripod)for(let i=0;i<3;i++){const a=i/3*Math.PI*2;m.beam([Math.sin(a)*.18,0,z+Math.cos(a)*.18],[Math.sin(a)*.08,H*.47,z+Math.cos(a)*.08],.025,wood,8);}
      else tube(0,z,H*.10,H*(bowl?.44:.88),bowl?.12:.045,bowl?.10:.035,bowl?stone:art==='pump'?metal:wood);
    }
    if(art==='brazier'||art==='signature'){
      tube(0,z,H*.44,H*.55,.12,.23,metal);
      m.ring(0,z,H*.54,H*.575,.24,.20,metal,20);
      for(let i=0;i<8;i++){const a=i/8*Math.PI*2;m.beam([Math.sin(a)*.12,H*.45,z+Math.cos(a)*.12],[Math.sin(a)*.24,H*.62,z+Math.cos(a)*.24],.012,metal,6);}
      if(shape.fire!==false)m.fire(0,H*.55,z,.52,H*.44,[.15,.01,.88,.44]);
      if(art==='signature'){face(-.20,.20,H*.17,H*.43,z+.10,[.29,.43,.70,.88]);}
    }
    else if(art==='pump'){tube(0,z,H*.10,H*.65,.10,.08,metal);m.beam([0,H*.55,z],[.26,H*.55,z],.045,metal,8);m.beam([0,H*.85,z],[-.26,H*.65,z],.018,metal);}
    else{
      const x=art==='lantern'?0:shape.ornamentX??.25,b=art==='lantern'?H*.12:H*.40,t=art==='lantern'?H*.80:H*.72,r=Math.min(.13,D*.40);
      if(art==='lampPost')m.beam([0,H*.86,z],[x,H*.86,z],.025,metal);
      box(x-r,x+r,b,t,z-r,z+r,lampGlass);
      const pane:Patch=kit.startsWith('world:native_story')?[.29,.47,.64,.77]:kit.startsWith('world:')?(kit.endsWith(':1')?[.34,.12,.64,.41]:kit.endsWith(':2')?[.63,.42,.89,.62]:[.72,.27,.93,.48]):[.40,.46,.68,.82];
      const q=r*.84;
      m.cutout([x-q,b,z+r+.001],[x+q,b,z+r+.001],[x-q,t,z+r+.001],[x+q,t,z+r+.001],pane);
      m.cutout([x+q,b,z-r-.001],[x-q,b,z-r-.001],[x+q,t,z-r-.001],[x-q,t,z-r-.001],pane);
      for(const xx of [x-r-.001,x+r+.001])m.cutout([xx,b,z-q],[xx,b,z+q],[xx,t,z-q],[xx,t,z+q],pane);for(const xx of [x-r,x+r])for(const zz of [z-r,z+r])box(xx-.009,xx+.009,b,t,zz-.009,zz+.009,metal);
      tube(x,z,b-H*.03,b+H*.03,r*1.3,r*1.3,metal);tube(x,z,t,t+H*.08,r*1.3,0,metal);m.beam([x,t+H*.06,z],[x,t+H*.15,z],.014,brass,8);
    }
  }else if(art==='fountain'&&kit.startsWith('world:')){
    const basin=H*.36;
    box(-.48,.48,0,H*.08,-D,0,stone);
    for(const z of [-D,0])box(-.44,.44,H*.08,basin,z-.025,z+.025,wood);
    for(const x of [-.46,.46])box(x-.035,x+.035,H*.06,basin+.02,-D-.02,.02,stone);
    box(-.41,.41,H*.30,H*.305,-D+.05,-.05,water);
    for(const x of [-.38,.38])for(const z of [-D-.03,.03])box(x-.014,x+.014,H*.08,basin,z-.008,z+.008,metal);
    box(-.32,-.21,0,H*.96,-D-.06,-D+.05,wood);
    m.beam([-.27,H*.85,-D],[ -.11,H*.85,-D+.18],.04,wood,8);
    m.cylinder(-.11,-D+.18,H*.31,H*.85,.009,.014,water,8);
  }else if(art==='well'||art==='fountain'||art==='signature'&&/elven/.test(kit)){
    const r=Math.min(art==='well'?.39:.46,D/2),inner=r*.74,z=-D/2;
    if(art==='well'&&shape.canopy===false){
      m.ring(0,z,0,H*.84,r,inner,stone);m.ring(0,z,H*.82,H*.96,r*1.04,inner,stone);tube(0,z,H*.73,H*.735,inner,inner,water);return m.finish();
    }
    m.ring(0,z,0,H*.31,r,inner,stone);m.ring(0,z,H*.29,H*.35,r*1.05,inner,art==='well'?stone:trim);tube(0,z,H*.20,H*.205,inner,inner,water);
    if(art==='well'){for(const x of [-r*.83,r*.83])box(x-.025,x+.025,0,H*.78,z-.025,z+.025);roof(H*.76,H);m.beam([-r,H*.58,z],[r,H*.58,z],.035,wood,8);tube(0,z,H*.26,H*.55,.008,.008,dark);
      m.cylinder(0,z,H*.26,H*.40,.065,.08,wood,12);
      m.beam([r,H*.58,z],[r+.12,H*.58,z],.018,wood,8);
      m.beam([r+.12,H*.58,z],[r+.12,H*.48,z],.015,metal,8);}
    else{tube(0,z,H*.20,H*.67,r*.18,r*.13,stone);m.ring(0,z,H*.64,H*.71,r*.53,r*.33,stone);tube(0,z,H*.69,H*.97,r*.10,0,water);}
  }else if(art==='stall'||art==='tent'){
    for(const x of [-.44,.44])for(const z of [-D+.04,-.04])box(x-.022,x+.022,0,H*.78,z-.022,z+.022);
    roof(H*.72,H);
    if(art==='stall'){box(-.44,.44,0,H*.33,-D*.65,-.04);for(let i=0;i<4;i++)tube(-.29+i*.19,-D*.42,H*.33,H*.39,.07,.06,i%2?fabric:ivory);}
    else{m.quad([-.46,0,0],[-.46,0,-D],[-.46,H*.72,0],[-.46,H*.72,-D],fabric);m.quad([.46,0,-D],[.46,0,0],[.46,H*.72,-D],[.46,H*.72,0],fabric);box(-.46,.46,0,H*.72,-D,-D+.015,fabric);m.triangle([-.46,0,.01],[-.20,0,.01],[0,H,.01],fabric);m.triangle([.20,0,.01],[.46,0,.01],[0,H,.01],fabric);}
  }else if(art==='wagon'){
    box(-.40,.40,H*.24,H*.32,-D*.85,-.04);for(const x of [-.40,.40])for(const y of [.37,.51,.65])box(x-.025,x+.025,H*y,H*(y+.09),-D*.85,-.04);box(-.41,.41,H*.32,H*.74,-D*.88,-D*.83);
    for(const z of [-D*.72,-D*.2]){m.beam([-.54,H*.22,z],[.54,H*.22,z],.025,metal,8);for(const x of [-.49,.49]){const r=H*.22;for(let i=0;i<16;i++){const a=i/16*Math.PI*2,b=(i+1)/16*Math.PI*2;m.beam([x,H*.22+Math.sin(a)*r,z+Math.cos(a)*r],[x,H*.22+Math.sin(b)*r,z+Math.cos(b)*r],.024,trim);if(i%4===0)m.beam([x,H*.22,z],[x,H*.22+Math.sin(a)*r,z+Math.cos(a)*r],.018,wood);}}}
    for(const x of [-.28,.28])m.beam([x,H*.25,-D*.35],[x,H*.22,.12],.018,wood);
  }else if(art==='fence'){
    const floral=kit.startsWith('world:flower_fence:'),post=floral?.013:.03;
    const n=floral?(shape.quarterTurnUV?2:3):Math.max(2,Math.min(5,Math.round(1/Math.max(.16,H))));for(let i=0;i<n;i++){const x=-.45+i*.9/(n-1);box(x-post,x+post,0,H,-D*.7,-D*.3);tube(x,-D/2,H*.96,H*1.04,floral?.020:.04,0,floral?{color:pigment(0xc79b4d)}:trim);}
    for(const y of [.28,.67])box(-.48,.48,H*y,H*(y+.09),-D*.7,-D*.3);
    if(kit.startsWith('world:flower_fence:')&&!emission){
      const hedge=(z:number,reverse=false)=>{
        if(shape.quarterTurnUV){
          const p=(u:number,v:number):V3=>[reverse?.48-u*.96:-.48+u*.96,H*(.10+v*.78),z];
          const uv=(u:number,v:number):readonly [number,number]=>[shape.left+(.12+v*.76)*shape.width,1-shape.top-(.08+u*.86)*shape.height];
          const pts=[p(0,0),p(1,0),p(0,1),p(1,1)],uvs=[uv(0,0),uv(1,0),uv(0,1),uv(1,1)];
          m.triangle(pts[0],pts[1],pts[2],[0,0,1,1],undefined,undefined,uvs.slice(0,3));
          m.triangle(pts[1],pts[3],pts[2],[0,0,1,1],undefined,undefined,[uvs[1],uvs[3],uvs[2]]);
        }else for(const [l,r,u,v] of [[-.40,-.04,.09,.45],[.04,.40,.54,.91]]){
          const a=reverse?-r:l,b=reverse?-l:r;
          face(a,b,H*.10,H*.86,z,[u,.14,v,.57]);
        }
      };
      hedge(-D*.22);hedge(-D*.78,true);
      if(!shape.quarterTurnUV)top(-.48,.48,-D/2-.025,-D/2+.025,.004,[.02,.84,.98,.99]);
    }
  }else if(art==='sign'||art==='banner'||art==='lectern'||art==='dummy'){
    box(-.05,.05,0,H*.95,-D*.6,-D*.4);box(-.23,.23,0,H*.06,-D,0);
    if(art==='lectern'){m.extrude([[-.47,H*.60],[.47,H*.60],[.47,H*.68],[-.47,H*.68]],.015,-D,wood);box(-.34,.34,H*.68,H*.72,-D*.85,-D*.12,ivory);}
    else if(art==='dummy'){box(-.27,.27,H*.38,H*.72,-D*.8,-D*.2,fabric);tube(0,-D/2,H*.72,H*.94,.13,.10,ivory);m.beam([-.42,H*.68,-D/2],[.42,H*.68,-D/2],.05,wood,8);}
    else if(art==='banner'){
      const flag=[[-.40,H*.88],[.40,H*.88],[.38,H*.44],[0,H*.27],[-.38,H*.44]] as const;
      m.extrude(flag,-D*.36,-D*.40,fabric);face(-.38,.38,H*.36,H*.87,-D*.35,[.10,.08,.87,.74]);
      m.beam([-.48,H*.89,-D*.39],[.48,H*.89,-D*.39],.02,brass,8);
    }else{
      for(let i=0;i<3;i++){
        const y=H*(.43+i*.16),dir=i%2?-1:1;
        const path=[[-.39,y],[-.39,y+H*.12],[.32,y+H*.12],[.46,y+H*.06],[.32,y]];
        m.extrude(path.map(([x,y])=>[x*dir,y] as const),-D*.35,-D*.65,wood);
      }
    }

  }else if(art==='planter'){
    const r=Math.min(.31,D/2);tube(0,-D/2,0,H*.38,r*.65,r,stone);m.ring(0,-D/2,H*.35,H*.42,r*1.04,r*.86,trim);tube(0,-D/2,H*.37,H*.39,r*.86,r*.86,dark);
    // Foliage remains a cropped cutout, as do overworld trees and flowers.
    m.cutout([-.50,H*.36,-D/2],[.50,H*.36,-D/2],[-.50,H,-D/2],[.50,H,-D/2],[0,0,1,.74]);
    m.cutout([0,H*.36,-D/2-.45],[0,H*.36,-D/2+.45],[0,H,-D/2-.45],[0,H,-D/2+.45],[0,0,1,.74]);
  }else if(art==='rock'||art==='columns'||art==='crystals'||art==='waystone'||art==='shrine'){
    const n=art==='columns'||art==='crystals'?5:art==='rock'?3:1;
    const rock:ModelMaterial=paintedMaterial(shape.patch,.42,.38),gem:ModelMaterial=rock;
    for(let i=0;i<n;i++){const x=n===1?0:(i%3-1)*.27,z=-D/2+(i%2-.5)*D*.36,r=n===1?Math.min(.34,D*.45):Math.min(.19,D*.28),t=H*(i===1||n===1?1:.5+i*.06);m.cylinder(x,z,0,t*.80,r,r*.70,art==='crystals'?gem:art==='rock'?rock:stone,art==='crystals'?5:7);m.cylinder(x,z,t*.80,t,r*.70,art==='rock'?r*.30:art==='columns'?r*.60:0,art==='crystals'?gem:art==='rock'?rock:stone,art==='crystals'?5:7);}
    if(art==='waystone'||art==='shrine'){
      const rune:ModelMaterial={color:pigment(0x89bdcc),emission:pigment(0xa7e7fa)},z=-D/2+Math.min(.34,D*.45)*.91;
      if(kit.startsWith('world:native_')||kit.startsWith('world:woodland_'))face(-.19,.19,H*.20,H*.82,z+.002,[.27,.25,.73,.88]);
      else m.beam([0,H*.28,z],[0,H*.72,z],.009,rune,4);
      if(!kit.startsWith('world:native_')&&!kit.startsWith('world:woodland_')){m.beam([-.075,H*.58,z],[0,H*.70,z],.009,rune,4);m.beam([0,H*.70,z],[.075,H*.58,z],.009,rune,4);}
    }
  }else if(art==='sack'){
    tube(0,-D/2,0,H*.16,D*.30,D*.45,fabric);tube(0,-D/2,H*.16,H*.62,D*.45,D*.43,fabric);tube(0,-D/2,H*.62,H*.86,D*.43,D*.16,fabric);tube(0,-D/2,H*.86,H,D*.16,D*.20,fabric);m.ring(0,-D/2,H*.83,H*.87,D*.18,D*.14,trim,12);
  }else if(art==='keepsake'){box(-.4,.4,0,H,-D,0,ivory);top(-.43,.43,-D,.0,H+.001,[.03,.03,.97,.97]);for(const x of [-.43,.40])box(x,x+.03,H*.80,H+.003,-D-.01,.01,brass);for(const z of [-D-.01,-.02])box(-.4,.4,H*.80,H+.003,z,z+.03,brass);}
  else if(art==='ship'){
    // Surveyed coordinates, dedicated plank materials and modeled fittings.
    const hull=FLAGSHIP_HULL;
    const p=(x:number,y:number,h:number):V3=>[(x-512)/1024,h,(y-768)/1024];
    const plan=hull.map(([x,y])=>[(x-512)/1024,(y-768)/1024] as const);
    // A continuous deck and real hatch grates replace the overhead picture.
    const deckWood=atlasMaterial('architecture',13,.58,.58);
    m.floor(plan,0,deckWood,1);
    m.floor(hull.map(([x,y])=>[(414+(x-414)*.62-512)/1024,(y-768)/1024] as const),-.18,wood,1);
    for(const [l,t,r,b] of [[365,478,460,547],[363,825,465,916]]){
      const a=p(l,t,0),c=p(r,b,0);m.box(a[0],c[0],0,.003,a[2],c[2],dark);
      for(let i=0;i<7;i++){const x=a[0]+(c[0]-a[0])*i/6;m.beam([x,.004,a[2]],[x,.004,c[2]],.002,brass,4);}
      for(const z of [a[2],c[2]])m.beam([a[0],.005,z],[c[0],.005,z],.004,wood,4);
    }
    for(const [x,y] of [[210,900],[650,900],[240,700],[625,700],[300,480],[560,480]]){
      const c=p(x,y,.015),sign=x<414?-1:1;
      m.box(c[0]-.025,c[0]+.025,.002,.025,c[2]-.025,c[2]+.025,dark);
      m.beam([c[0]-sign*.015,.03,c[2]],[c[0]+sign*.05,.04,c[2]],.009,metal,8);
    }
    for(let i=0;i<hull.length;i++){const a=hull[i],b=hull[(i+1)%hull.length];m.quad(p(414+(a[0]-414)*.62,a[1],-.18),p(414+(b[0]-414)*.62,b[1],-.18),p(a[0],a[1],0),p(b[0],b[1],0),atlasMaterial('architecture',12,.60,.60));if(!(a[0]>630&&b[0]>630&&Math.min(a[1],b[1])<850&&Math.max(a[1],b[1])>740)){m.beam(p(a[0],a[1],.035),p(b[0],b[1],.035),.008,trim);m.beam(p(a[0],a[1],0),p(a[0],a[1],.05),.008,wood);}}
    box((590-512)/1024,(1000-512)/1024,-.018,0,(780-768)/1024,(834-768)/1024);

    for(const y of [787,827]){
      for(const x of [700,850,985])m.beam(p(x,y,0),p(x,y,.048),.005,brass,8);
      m.beam(p(692,y,.043),p(993,y,.043),.003,dark,6);
    }
  }else if(art==='ship-stern'){
    const hullPaint=atlasMaterial('architecture',12,.60,.60);
    box(-.43,.43,0,H*.80,-D,0,hullPaint);box(-.47,.47,H*.80,H*.88,-D-.02,.02,brass);
    for(const z of [.005,-D-.005]){
      for(const y of [.18,.77])box(-.44,.44,H*y,H*(y+.018),z-.007,z+.007,brass);
      for(const x of [-.28,.28]){
        box(x-.084,x+.084,H*.28,H*.61,z-.009,z+.009,glass);
      }
    }
    for(const x of [-.44,.44])box(x-.02,x+.02,0,H*.88,-D,.02,brass);
    // Finished quarterdeck boards share the generated deck material.
    box(-.42,.42,H*.88,H*.89,-D+.02,-.02,atlasMaterial('architecture',13,.70,.70));
    for(const x of [-.42,.42])for(let i=0;i<5;i++)m.beam([x,H*.88,-D+i*D/4],[x,H*1.02,-D+i*D/4],.009,brass,8);
    for(const x of [-.42,.42])m.beam([x,H*1.02,-D],[x,H*1.02,0],.008,brass,8);
  }else if(art==='ship-mast'){
    tube(0,-D/2,0,H,.032,.017);
    for(const y of [.04,.44,.91])m.ring(0,-D/2,H*y,H*(y+.022),.037,.031,brass,16);
    // This ship has a furled black/red sail. Preserve the supplied rig/sail
    // silhouette rather than inventing a white sail from a different vessel.
    m.cutout([-.5,0,-D/2+.004],[.5,0,-D/2+.004],[-.5,H,-D/2+.004],[.5,H,-D/2+.004],[0,0,1,1]);
  }else if(art==='ship-pennant')m.cutout([-.5,0,0],[.5,0,0],[-.5,H,0],[.5,H,0],[0,0,1,1]);
  else cabinet(false,true);
  return m.finish();
}
