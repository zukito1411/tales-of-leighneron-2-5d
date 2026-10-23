import {ModelMesh,brass,metal,glass,lampGlass,flame,water,pigment,regionalFabric,regionalWood,masonry,type ModelMaterial,type V3} from './ModelMesh';
import type Phaser from 'phaser';
import type {HomeFurnitureArt} from '../../data/housing';
import {HERO_BODY_HEIGHT} from '../../data/heroBodyRegistration';
import materials from './furnitureMaterials.json';

export type PropArt='crate'|'cargo'|'barrels'|'fence'|'sign'|'lampPost'|'brazier'|'well'|'fountain'|'stall'|'tent'|'wagon'|'rock'|'columns'|'crystals'|'waystone'|'lectern'|'sack'|'pump'|'banner'|'shrine'|'dummy'|'keepsake'|'ship'|'ship-stern'|'ship-mast'|'ship-pennant';
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
  fixedGround?:number;
  bounds?:{left:number;right:number;bottom:number;top:number;back:number;front:number};
}
export interface FurniturePlacement {x:number;y:number;width:number;heading:number;lift:number}
export function furniturePlacement(owner:Pick<Phaser.GameObjects.Image,'x'|'y'|'rotation'|'displayWidth'>,shape:FurnitureShape,out:FurniturePlacement){
  const width=Math.abs(owner.displayWidth)*shape.width*(shape.modelScale??1),a=owner.rotation,c=Math.cos(a),s=Math.sin(a);
  const x=(shape.footX??0)*width,y=(shape.footY??0)*width;
  out.x=owner.x+x*c-y*s;out.y=owner.y+x*s+y*c;out.width=width;out.heading=a+(shape.heading??0);out.lift=(shape.lift??0)*width;return out;
}
const depths:Partial<Record<FurnitureArt,number>>={bed:1.1,wardrobe:.34,bookcase:.30,chest:.45,table:.5,bench:.32,chair:.5,
  counter:.32,hearth:.30,planter:.35,barrel:.5,pantry:.34,weaponRack:.22,lantern:.22,stairs:.85,arch:.18,
  workstation:.30,signature:.35,window:.16,doorway:.22,'tower-door-closed':.22,'tower-door-open':.22,openChest:.6};
// Human-scale elevations, independent of a room's authored furniture width.
// Counter paint sits at .883 of the mesh envelope; chair seats at .383 and
// mattresses at .424. Keep those surfaces in proportion to the standing body.
const bodyHeights:Partial<Record<FurnitureArt,number>>={
  bed:.72,table:.44,bench:.27,chair:.72,counter:.58/.883,workstation:.48,
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
  const {art,kit,rise:H,depth:D}=shape,m=new ModelMesh(shape,emission);
  const wood:ModelMaterial=regionalWood(kit),fabric=regionalFabric(kit),ivory:ModelMaterial={color:pigment(0xd7cfb5)};
  const dark:ModelMaterial={color:pigment(0x48392e),pattern:2},stone:ModelMaterial=masonry(kit);
  const trim=/noble|elven|orcan|obsidian/.test(kit)?brass:dark;
  const box=(l:number,r:number,b:number,t:number,back:number,front:number,mat:ModelMaterial=wood)=>m.box(l,r,b,t,back,front,mat);
  const tube=(x:number,z:number,b:number,t:number,r:number,s=r,mat:ModelMaterial=wood)=>m.cylinder(x,z,b,t,r,s,mat);
  const legs=(seat:number,back=-D+.07,front=-.07)=>{
    for(const x of [-.40,.40])for(const z of [front,back]){box(x-.03,x+.03,0,seat,z-.03,z+.03);box(x-.04,x+.04,0,seat*.10,z-.04,z+.04,trim);}
  };
  const candle=(x:number,z:number,y:number,h:number)=>{
    tube(x,z,y,y+h*.78,h*.14,h*.13,ivory);tube(x,z,y+h*.78,y+h,h*.12,0,flame);
  };
  const cup=(x:number,z:number,y:number,r:number)=>{m.ring(x,z,y,y+r*1.5,r,r*.7,ivory,12);};
  const roof=(eave:number,peak:number)=>{
    const lip=Math.min(.02,H*.035);
    m.extrude([[-.52,eave],[0,peak],[.52,eave],[.52,eave-lip],[0,peak-lip],[-.52,eave-lip]],.02,-D-.02,fabric);
    for(const x of [-.51,.51])m.beam([x,eave,-D-.03],[x,eave,.03],.015,trim);
    m.beam([0,peak,-D-.035],[0,peak,.035],.014,trim);
  };
  const barrel=(x:number,z:number,b:number,t:number,r:number)=>{
    m.cylinder(x,z,b,b+(t-b)*.2,r*.82,r,wood,20);m.cylinder(x,z,b+(t-b)*.2,t-(t-b)*.2,r,r,wood,20);m.cylinder(x,z,t-(t-b)*.2,t,r,r*.82,wood,20);
    for(const y of [.15,.78])m.ring(x,z,b+(t-b)*y,b+(t-b)*(y+.055),r*1.015,r*.94,metal,20);
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
    if(throne)box(-.34,.34,seat+H*.10,H*.86,-D+.014,-D+.056,fabric);
    else for(let i=0;i<3;i++)box(-.34+i*.26,-.28+i*.26,seat+H*.08,H*.88,-D+.02,-D+.055);
    if(throne)for(const x of [-.42,.42]){box(x-.035,x+.035,seat,seat+H*.24,-D*.20,-D*.12,trim);box(x-.045,x+.045,seat+H*.22,seat+H*.28,-D*.87,-D*.10,trim);}
  };
  const table=(bench=false,desk=false)=>{
    const backrest=bench&&kit.startsWith('world:'),seat=backrest?H*.48:H;
    legs(seat*.88);m.softBox(-.48,.48,seat*.86,seat,-D,0,wood);
    for(const x of [-.49,.46])box(x,x+.03,seat*.95,seat+.004,-D-.01,.01,trim);
    for(const z of [-D-.01,-.02])box(-.46,.46,seat*.95,seat+.004,z,z+.03,trim);
    box(-.40,.40,seat*.31,seat*.37,-D*.55,-D*.45);
    if(backrest){for(const x of [-.43,.43])box(x-.025,x+.025,seat,H,-D,-D+.05);for(const y of [.58,.78,.94])box(-.43,.43,H*y,H*(y+.055),-D,-D+.04);}
    if(!bench){
      if(desk){box(-.38,-.05,seat,seat+H*.10,-D*.7,-D*.35,fabric);box(-.34,-.01,seat+H*.10,seat+H*.17,-D*.68,-D*.35,ivory);}
      else{tube(-.18,-D*.5,seat,seat+H*.018,.10,.10,ivory);cup(.19,-D*.40,seat,H*.07);}
      candle(.28,-D*.75,seat,H*.24);
    }
  };
  const cabinet=(shelves=false,pantry=false)=>{
    box(-.43,.43,.035,H*.95,-D,-D+.045,dark);for(const x of [-.43,.43])box(x-.025,x+.025,.035,H*.95,-D,0);
    for(const y of [0,.07,.93])box(-.47,.47,H*y,H*(y+.055),-D-.015,.015,trim);
    if(shelves||pantry){
      for(let row=0;row<3;row++){
        const y=H*(.15+row*.25);box(-.42,.42,y,y+H*.035,-D,.015);
        for(let i=0;i<5;i++){
          const x=-.34+i*.15,h=H*(.13+(i%3)*.023);
          if(pantry){tube(x,-D*.36,y+H*.035,y+H*.035+h,.052,.045,i%2?ivory:fabric);}
          else{box(x-.045,x+.045,y+H*.035,y+H*.035+h,-D*.75,-.025,i%3===0?fabric:i%3===1?dark:trim);box(x-.047,x+.047,y+H*.06,y+H*.07,-.031,-.024,brass);}
        }
      }
    }else{
      for(const x of [-.39,.015]){box(x,x+.375,H*.11,H*.90,-.04,-.012,dark);box(x+.025,x+.35,H*.15,H*.85,-.012,.005,wood);box(x+.29,x+.31,H*.48,H*.54,.005,.022,brass);}
    }
  };
  if(art==='bed'){
    legs(H*.26);box(-.46,.46,H*.18,H*.27,-D+.04,0);m.softBox(-.43,.43,H*.27,H*.42,-D+.11,-.07,ivory,.018);m.softBox(-.435,.435,H*.35,H*.43,-D*.68,-.065,fabric,.012);
    m.softBox(-.30,.30,H*.42,H*.52,-D+.13,-D*.72,ivory,.018);
    for(const z of [-D,-.035])for(const x of [-.45,.45]){box(x-.035,x+.035,0,z===-D?H:H*.48,z-.03,z+.03);tube(x,z,z===-D?H*.96:H*.44,z===-D?H*1.03:H*.50,.045,.025,trim);}
    box(-.45,.45,H*.50,H*.91,-D-.02,-D+.035);box(-.37,.37,H*.57,H*.85,-D+.036,-D+.05,fabric);box(-.45,.45,H*.22,H*.40,-.06,0);
  }else if(art==='chair'||art==='signature'&&/noble|orcan|longhouse/.test(kit))chair(art==='signature');
  else if(art==='table'||art==='bench'||art==='workstation')table(art==='bench',art==='workstation');
  else if(art==='wardrobe'||art==='bookcase'||art==='pantry')cabinet(art==='bookcase',art==='pantry');
  else if(art==='counter'){
    box(-.46,.46,0,H*.80,-D,0);box(-.49,.49,H*.80,H*.88,-D-.02,.02);box(-.48,.48,0,H*.07,-D-.012,.012,trim);
    for(const z of [.006,-D-.006])for(let i=0;i<4;i++){const x=-.42+i*.22;box(x,x+.18,H*.15,H*.65,z-.006,z+.006,trim);box(x+.016,x+.164,H*.18,H*.62,z+.007,z+.010);}
    candle(.28,-D*.62,H*.883,H*.22);cup(-.22,-D*.40,H*.883,H*.07);
  }else if(art==='chest'||art==='openChest'){
    crate(-.46,.46,0,H*.56,-D,0);
    if(art==='openChest'){box(-.46,.46,H*.56,H*.98,-D-.025,-D+.035);box(-.40,.40,H*.58,H*.92,-D+.036,-D+.044,dark);box(-.40,.40,H*.54,H*.56,-D+.05,-.035,dark);}
    else{
      const profile: Array<readonly [number,number]>=[];
      for(let i=0;i<=8;i++){const a=i/8*Math.PI;profile.push([-D/2+Math.cos(a)*D/2,H*.56+Math.sin(a)*H*.25]);}
      // Rounded lid runs across the depth. Extrude in local Z then rotate the
      // complete lid mesh basis through swapped axes without flattening it.
      for(let i=1;i<profile.length;i++){const [za,ya]=profile[i-1],[zb,yb]=profile[i];m.quad([-.46,ya,za],[.46,ya,za],[-.46,yb,zb],[.46,yb,zb],wood);for(const x of [-.46,.46])m.triangle([x,H*.56,-D/2],[x,ya,za],[x,yb,zb],trim);}
      for(const x of [-.30,.30])for(let i=1;i<profile.length;i++){const [za,ya]=profile[i-1],[zb,yb]=profile[i];m.quad([x-.025,ya+.004,za],[x+.025,ya+.004,za],[x-.025,yb+.004,zb],[x+.025,yb+.004,zb],metal);}
      box(-.035,.035,H*.37,H*.62,0,.025,brass);
    }
  }else if(art==='barrel')barrel(0,-D/2,0,H*.96,Math.min(.46,D/2));
  else if(art==='barrels'){for(const [x,z,y,t] of [[-.24,-D*.3,0,H*.55],[.24,-D*.3,0,H*.55],[0,-D*.65,H*.45,H]])barrel(x,z,y,t,Math.min(.22,D*.28));}
  else if(art==='crate')crate(-.47,.47,0,H,-D,0);
  else if(art==='cargo'){crate(-.48,-.02,0,H*.57,-D*.58,0);crate(.0,.47,0,H*.57,-D*.83,-D*.25);crate(-.18,.30,H*.57,H,-D,-D*.33);}
  else if(art==='hearth'){
    box(-.48,.48,0,H*.10,-D,0,stone);for(const x of [-.39,.39])box(x-.08,x+.08,H*.1,H*.65,-D,0,stone);box(-.48,.48,H*.60,H*.72,-D-.02,.02,stone);box(-.25,.25,H*.70,H,-D,-D*.45,stone);box(-.28,.28,H*.10,H*.60,-D,-D+.03,dark);
    for(let i=0;i<3;i++){const x=(i-1)*.13;m.beam([x-.08,H*.15,-D*.7],[x+.08,H*.15,-.08],.035,dark,8);tube(x,-D*.40,H*.17,H*(.40+(i%2)*.12),.065,0,flame);}
    for(let i=0;i<5;i++){const x=-.25+i*.125;box(x-.009,x+.009,H*.12,H*.29,-.025,0,metal);}
  }else if(art==='arch'||art==='doorway'||art==='tower-door-open'||art==='tower-door-closed')arch(art!=='tower-door-closed');
  else if(art==='window'){
    box(-.42,.42,0,H*.25,-D,0,stone);box(-.43,.43,H*.25,H,-D,0);box(-.32,.32,H*.38,H*.86,.001,.005,glass);for(const x of [-.34,0,.34])box(x-.016,x+.016,H*.34,H*.90,.005,.028,trim);for(const y of [.35,.62,.89])box(-.36,.36,H*y,H*(y+.025),.005,.028,trim);
  }else if(art==='weaponRack'){
    for(const x of [-.43,.43]){box(x-.04,x+.04,0,H,-D*.65,-D*.35);box(x-.075,x+.075,0,H*.08,-D,0);}
    for(const y of [.16,.79])box(-.47,.47,H*y,H*(y+.065),-D*.65,-D*.35);for(let i=0;i<4;i++){const x=-.30+i*.2;m.beam([x,H*.81,-D*.36],[x,H*.76,-D*.15],.014,metal);}
  }else if(art==='stairs'){
    for(let i=0;i<5;i++)box(-.43,.43,0,H*(i+1)/5,-D*(i+1)/5,-D*i/5,stone);
    for(const x of [-.46,.46]){m.beam([x,H*.16,-.02],[x,H*.97,-D],.025,trim);for(let i=0;i<3;i++)m.beam([x,H*i/3,-D*i/3],[x,H*i/3+H*.20,-D*i/3],.016,trim);}
  }else if(art==='lantern'||art==='lampPost'||art==='brazier'||art==='pump'){
    const z=-D/2;
    if(art!=='lantern'){tube(0,z,0,H*.10,Math.min(.20,D*.48),Math.min(.17,D*.40),stone);tube(0,z,H*.10,H*.88,.045,.035,metal);}
    if(art==='brazier'){tube(0,z,H*.44,H*.55,.12,.23,metal);for(const x of [-.10,0,.10])tube(x,z,H*.51,H*(.75+(x===0?.20:0)),.065,0,flame);}
    else if(art==='pump'){tube(0,z,H*.10,H*.65,.10,.08,metal);m.beam([0,H*.55,z],[.26,H*.55,z],.045,metal,8);m.beam([0,H*.85,z],[-.26,H*.65,z],.018,metal);}
    else{
      const x=art==='lantern'?0:shape.ornamentX??.25,b=art==='lantern'?H*.12:H*.40,t=art==='lantern'?H*.80:H*.72,r=Math.min(.13,D*.40);
      if(art==='lampPost')m.beam([0,H*.86,z],[x,H*.86,z],.025,metal);
      box(x-r,x+r,b,t,z-r,z+r,lampGlass);for(const xx of [x-r,x+r])for(const zz of [z-r,z+r])box(xx-.009,xx+.009,b,t,zz-.009,zz+.009,metal);
      tube(x,z,b-H*.03,b+H*.03,r*1.3,r*1.3,metal);tube(x,z,t,t+H*.08,r*1.3,0,metal);m.beam([x,t+H*.06,z],[x,t+H*.15,z],.014,brass,8);
    }
  }else if(art==='well'||art==='fountain'||art==='signature'&&/elven|obsidian/.test(kit)){
    const r=Math.min(.46,D/2),inner=r*.74,z=-D/2;
    m.ring(0,z,0,H*.31,r,inner,stone);m.ring(0,z,H*.29,H*.35,r*1.05,inner,trim);tube(0,z,H*.20,H*.205,inner,inner,water);
    if(art==='well'){for(const x of [-r*.83,r*.83])box(x-.025,x+.025,0,H*.78,z-.025,z+.025);roof(H*.76,H);m.beam([-r,H*.58,z],[r,H*.58,z],.035,metal,8);tube(0,z,H*.12,H*.55,.008,.008,dark);}
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
    const n=Math.max(2,Math.min(5,Math.round(1/Math.max(.16,H))));for(let i=0;i<n;i++){const x=-.45+i*.9/(n-1);box(x-.03,x+.03,0,H,-D*.7,-D*.3);tube(x,-D/2,H*.96,H*1.04,.04,0,trim);}
    for(const y of [.28,.67])box(-.48,.48,H*y,H*(y+.09),-D*.7,-D*.3);
  }else if(art==='sign'||art==='banner'||art==='lectern'||art==='dummy'){
    box(-.05,.05,0,H*.95,-D*.6,-D*.4);box(-.23,.23,0,H*.06,-D,0);
    if(art==='lectern'){m.extrude([[-.47,H*.60],[.47,H*.60],[.47,H*.68],[-.47,H*.68]],.015,-D,wood);box(-.34,.34,H*.68,H*.72,-D*.85,-D*.12,ivory);}
    else if(art==='dummy'){box(-.27,.27,H*.38,H*.72,-D*.8,-D*.2,fabric);tube(0,-D/2,H*.72,H*.94,.13,.10,ivory);m.beam([-.42,H*.68,-D/2],[.42,H*.68,-D/2],.05,wood,8);}
    else{box(-.44,.44,H*.43,H*.85,-D*.65,-D*.35,art==='banner'?fabric:wood);box(-.48,.48,H*.84,H*.89,-D*.7,-D*.3,trim);if(art==='sign')for(let i=0;i<3;i++)box(-.30,.28-i*.05,H*(.55+i*.08),H*(.56+i*.08),-D*.35,-D*.35+.006,dark);}
  }else if(art==='planter'){
    const r=Math.min(.31,D/2);tube(0,-D/2,0,H*.38,r*.65,r,stone);m.ring(0,-D/2,H*.35,H*.42,r*1.04,r*.86,trim);tube(0,-D/2,H*.37,H*.39,r*.86,r*.86,dark);
    // Foliage remains a cropped cutout, as do overworld trees and flowers.
    m.cutout([-.50,H*.36,-D/2],[.50,H*.36,-D/2],[-.50,H,-D/2],[.50,H,-D/2],[0,0,1,.74]);
    m.cutout([0,H*.36,-D/2-.45],[0,H*.36,-D/2+.45],[0,H,-D/2-.45],[0,H,-D/2+.45],[0,0,1,.74]);
  }else if(art==='rock'||art==='columns'||art==='crystals'||art==='waystone'||art==='shrine'){
    const n=art==='columns'||art==='crystals'?5:art==='rock'?3:1;
    const rock:ModelMaterial={color:pigment(0x87867d),pattern:7},gem:ModelMaterial={color:pigment(0x719aaa),emission:pigment(0xadddec)};
    for(let i=0;i<n;i++){const x=n===1?0:(i%3-1)*.27,z=-D/2+(i%2-.5)*D*.36,r=n===1?Math.min(.34,D*.45):Math.min(.19,D*.28),t=H*(i===1||n===1?1:.5+i*.06);m.cylinder(x,z,0,t*.80,r,r*.70,art==='crystals'?gem:art==='rock'?rock:stone,art==='crystals'?5:7);m.cylinder(x,z,t*.80,t,r*.70,art==='rock'?r*.30:art==='columns'?r*.60:0,art==='crystals'?gem:art==='rock'?rock:stone,art==='crystals'?5:7);}
    if(art==='waystone'||art==='shrine'){
      const rune:ModelMaterial={color:pigment(0x89bdcc),emission:pigment(0xa7e7fa)},z=-D/2+Math.min(.34,D*.45)*.91;
      m.beam([0,H*.28,z],[0,H*.72,z],.009,rune,4);
      m.beam([-.075,H*.58,z],[0,H*.70,z],.009,rune,4);m.beam([0,H*.70,z],[.075,H*.58,z],.009,rune,4);
    }
  }else if(art==='sack'){
    tube(0,-D/2,0,H*.16,D*.30,D*.45,fabric);tube(0,-D/2,H*.16,H*.62,D*.45,D*.43,fabric);tube(0,-D/2,H*.62,H*.86,D*.43,D*.16,fabric);tube(0,-D/2,H*.86,H,D*.16,D*.20,fabric);m.ring(0,-D/2,H*.83,H*.87,D*.18,D*.14,trim,12);
  }else if(art==='keepsake'){box(-.4,.4,0,H,-D,0,fabric);for(const x of [-.43,.40])box(x,x+.03,H*.80,H+.003,-D-.01,.01,brass);for(const z of [-D-.01,-.02])box(-.4,.4,H*.80,H+.003,z,z+.03,brass);}
  else if(art==='ship'){
    // Surveyed deck coordinates are retained, with modeled planks and fittings.
    const hull:readonly (readonly [number,number])[]=[[414,172],[490,228],[546,354],[615,510],[677,705],[690,1030],[650,1300],[574,1438],[414,1514],[255,1440],[167,1296],[126,1090],[129,825],[171,553],[259,314],[351,199]];
    const p=(x:number,y:number,h:number):V3=>[(x-512)/1024,h,(y-768)/1024];
    m.floor(hull.map(([x,y])=>[(x-512)/1024,(y-768)/1024] as const),.002,wood,4);
    for(const [x,y] of [[210,900],[650,900],[240,700],[625,700],[300,480],[560,480]]){
      const c=p(x,y,.015),sign=x<414?-1:1;
      m.box(c[0]-.025,c[0]+.025,.002,.025,c[2]-.025,c[2]+.025,dark);
      m.beam([c[0]-sign*.015,.03,c[2]],[c[0]+sign*.05,.04,c[2]],.009,metal,8);
    }
    for(let i=0;i<hull.length;i++){const a=hull[i],b=hull[(i+1)%hull.length];m.quad(p(414+(a[0]-414)*.62,a[1],-.10),p(414+(b[0]-414)*.62,b[1],-.10),p(a[0],a[1],0),p(b[0],b[1],0),wood);if(!(a[0]>630&&b[0]>630&&Math.min(a[1],b[1])<850&&Math.max(a[1],b[1])>740)){m.beam(p(a[0],a[1],.035),p(b[0],b[1],.035),.008,trim);m.beam(p(a[0],a[1],0),p(a[0],a[1],.05),.008,wood);}}
    box((590-512)/1024,(1000-512)/1024,-.018,.002,(780-768)/1024,(834-768)/1024);
  }else if(art==='ship-stern'){
    box(-.43,.43,0,H*.80,-D,0);box(-.47,.47,H*.80,H*.88,-D-.02,.02,trim);
    for(const z of [.005,-D-.005])for(let i=0;i<3;i++){const x=-.30+i*.30;box(x-.085,x+.085,H*.27,H*.62,z-.005,z+.005,glass);for(const xx of [x-.09,x,x+.09])box(xx-.008,xx+.008,H*.25,H*.64,z-.012,z+.012,brass);}
    box(-.12,.12,0,H*.70,.008,.024,dark);for(const x of [-.46,.46])box(x-.02,x+.02,0,H,-D,.02,trim);
  }else if(art==='ship-mast'){
    tube(0,-D/2,0,H,.045,.025);for(const y of [.35,.72])m.beam([-.48,H*y,-D/2],[.48,H*y,-D/2],.014,wood,8);
    for(let row=0;row<2;row++)for(let i=0;i<4;i++){const l=-.45+i*.225,r=l+.225,y=H*(.32+row*.36),bow=(x:number)=>Math.cos(x/.45*Math.PI/2)*.10-D/2;m.quad([l,y,bow(l)],[r,y,bow(r)],[l,y+H*.30,bow(l)*.5-D/4],[r,y+H*.30,bow(r)*.5-D/4],ivory);}
    for(const x of [-.45,.45])m.beam([x,0,-D/2],[0,H*.94,-D/2],.004,dark,4);
  }else if(art==='ship-pennant')m.cutout([-.5,0,0],[.5,0,0],[-.5,H,0],[.5,H,0],[0,0,1,1]);
  else cabinet(false,true);
  return m.finish();
}
