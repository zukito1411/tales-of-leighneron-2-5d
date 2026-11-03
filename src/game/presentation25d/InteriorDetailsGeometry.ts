import {ModelMesh,atlasMaterial,regionalWood,regionalFabric,metal,brass,pigment,type ModelMaterial} from './ModelMesh';
import type {FurnitureShape} from './FurnitureGeometry';

const linen=atlasMaterial('furnishings',4,.24,.24);
const blue=atlasMaterial('furnishings',6,.24,.24);
const red=atlasMaterial('furnishings',8,.24,.24);
const dark=atlasMaterial('furnishings',2,.24,.24);
const bottleGreen:ModelMaterial={color:pigment(0x315547)};
const crust:ModelMaterial={color:pigment(0xbc803c)};
const wine:ModelMaterial={color:pigment(0x683d45)};
const reflection:ModelMaterial={color:pigment(0xc1d7d7)};
const apple:ModelMaterial={color:pigment(0x983d30)};

function bottle(m:ModelMesh,x:number,z:number,y:number,h:number,r:number){
 m.cylinder(x,z,y,y+h*.63,r,r,bottleGreen,8);
 m.cylinder(x,z,y+h*.63,y+h*.78,r,r*.36,bottleGreen,8);
 m.cylinder(x,z,y+h*.78,y+h,r*.36,r*.36,bottleGreen,8);
 m.cylinder(x,z,y+h*.96,y+h*1.03,r*.39,r*.39,crust,8);
 m.box(x-r*.65,x+r*.65,y+h*.24,y+h*.48,z+r*.92,z+r*1.01,linen);
}
function loaf(m:ModelMesh,x:number,z:number,y:number,r:number){
 m.cylinder(x,z,y,y+r*.35,r*.74,r,crust,10);
 m.cylinder(x,z,y+r*.35,y+r*.8,r,r*.45,crust,10);
 for(const dx of [-r*.3,r*.3])m.beam([x+dx,y+r*.81,z-r*.22],[x+dx+r*.1,y+r*.81,z+r*.22],r*.045,linen,4);
}
function cake(m:ModelMesh,x:number,z:number,y:number,r:number){
 m.cylinder(x,z,y,y+.009,r*1.18,r*1.18,linen,12);
 m.cylinder(x,z,y+.009,y+r*.60,r,r,crust,12);
 m.cylinder(x,z,y+r*.28,y+r*.35,r*1.01,r*1.01,linen,12);
 m.cylinder(x,z,y+r*.60,y+r*.70,r*1.02,r*.96,linen,12);
 for(let i=0;i<5;i++){
  const a=i*Math.PI*2/5;m.cylinder(x+Math.cos(a)*r*.55,z+Math.sin(a)*r*.55,y+r*.70,y+r*.86,r*.11,r*.04,wine,6);
 }
}
function foldedCloth(m:ModelMesh,x:number,z:number,y:number,w:number,d:number,mat:ModelMaterial){
 m.softBox(x-w/2,x+w/2,y,y+.025,z-d/2,z+d/2,mat,.004);
 m.box(x-w*.42,x+w*.42,y+.011,y+.014,z+d/2+.001,z+d/2+.003,linen);
}

/** Full closed fittings share existing furniture batches and painted materials.
 * Stock is part of the cached mesh, with no separate actor, texture or update. */
export function createInteriorFitting(m:ModelMesh,shape:FurnitureShape,emission:boolean):boolean {
 const {art,interiorUse:use,rise:H,depth:D,kit}=shape;
 const shelf=art==='pantry'&&use&&['tavern','restaurant','kitchen','clothier','bakery','herbalist','bookseller','market'].includes(use);
 const mannequin=art==='wardrobe'&&use==='clothier';
 const tack=art==='wardrobe'&&use==='stable';
 const feed=art==='pantry'&&use==='stable';
 const arms=(art==='wardrobe'||art==='bookcase')&&(use==='armory'||use==='barracks');
 const sewing=art==='workstation'&&use==='clothier';
 const vitrine=art==='counter'&&use==='bakery';
 if(!shelf&&!mannequin&&!tack&&!feed&&!arms&&!sewing&&!vitrine)return false;
 if(emission)return true;
 const wood=regionalWood(kit),fabric=regionalFabric(kit);
 const box=(l:number,r:number,b:number,t:number,back:number,front:number,mat:ModelMaterial=wood)=>m.box(l,r,b,t,back,front,mat);
 if(shelf){
  box(-.45,.45,H*.04,H,-D,-D+.035,dark);
  for(const x of [-.46,.43])box(x,x+.03,0,H,-D,0);
  for(const y of [0,.94])box(-.48,.48,H*y,H*(y+.06),-D,.01);
  for(let row=0;row<3;row++){
   const y=H*(.10+row*.28);box(-.44,.44,y,y+H*.025,-D,.006);
   const bottom=y+H*.025;
   for(let i=0;i<4;i++){
    const x=-.32+i*.215,z=-D*.43;
    if(use==='clothier'){
     for(let layer=0;layer<3;layer++)foldedCloth(m,x,z,bottom+layer*.025,.18,D*.7,[fabric,blue,red][(i+layer)%3]);
    }else if(use==='bakery')loaf(m,x,z,bottom,.065);
    else if(use==='market'){
     box(x-.085,x+.085,bottom,bottom+H*.035,z-D*.35,z+D*.35,wood);
     for(const zz of [z-D*.35,z+D*.29])box(x-.085,x+.085,bottom,bottom+H*.09,zz,zz+.018,wood);
     for(const dx of [-.045,.045])m.cylinder(x+dx,z,bottom+H*.035,bottom+H*.10,.035,.028,i%2?apple:crust,8);
    }
    else if(use==='herbalist'){
     m.cylinder(x,z,bottom,bottom+H*.14,.052,.047,i%2?linen:bottleGreen,10);
     m.cylinder(x,z,bottom+H*.14,bottom+H*.16,.054,.054,wood,10);
     box(x-.025,x+.025,bottom+H*.035,bottom+H*.09,z+.048,z+.051,linen);
    }else if(use==='bookseller'){
     for(let j=0;j<2;j++){
      const xx=x-.04+j*.08,mat=[fabric,blue,red][(i+j)%3];
      box(xx-.03,xx+.03,bottom,bottom+H*(.14+(i%2)*.02),-D*.82,-D*.14,mat);
      box(xx-.025,xx+.025,bottom+H*.03,bottom+H*.04,-D*.14,-D*.13,brass);
     }
    }else if(use==='kitchen'&&row===0){
     m.cylinder(x,z,bottom,bottom+H*.12,.06,.07,linen,10);
     m.ring(x,z,bottom+H*.12,bottom+H*.14,.075,.045,wood,10);
    }else bottle(m,x,z,bottom,H*.20,.035);
   }
  }
 }else if(mannequin){
  // A dressmaker's complete headless torso on a turned stand, not an actor.
  const base=Math.min(.30,D*.48);
  m.cylinder(0,-D/2,0,H*.06,base,base*.9,wood,12);
  m.cylinder(0,-D/2,H*.06,H*.45,.022,.022,brass,10);
  const front=-D*.12,back=-D*.88;
  m.extrude([[-.29,H*.40],[-.18,H*.61],[-.23,H*.78],[-.32,H*.85],[-.13,H*.92],[-.10,H],
    [.10,H],[.13,H*.92],[.32,H*.85],[.23,H*.78],[.18,H*.61],[.29,H*.40]],front,back,fabric);
  box(-.19,.19,H*.59,H*.62,back-.002,front+.002,brass);
  m.beam([0,H*.65,front+.004],[0,H*.88,front+.004],.008,linen,4);
 }else if(tack){
  for(const x of [-.42,.42])box(x-.035,x+.035,0,H,-D*.7,-D*.4);
  for(const y of [.09,.90])box(-.46,.46,H*y,H*(y+.05),-D*.7,-D*.4);
  for(const x of [-.23,.23]){
   // Saddle trees face the grooming aisle; hanging leather straps stay
   // against the stand, entirely inside its existing ground footprint.
   box(x-.12,x+.12,H*.51,H*.56,-D*.82,-D*.12);
   m.extrude([[x-.11,H*.55],[x-.07,H*.67],[x,H*.63],[x+.07,H*.67],[x+.11,H*.55]],-D*.15,-D*.78,fabric);
   for(const dx of [-.085,.085]){
    box(x+dx-.009,x+dx+.009,H*.25,H*.56,-D*.13,-D*.10,dark);
    m.ring(x+dx,-D*.11,H*.23,H*.26,.022,.015,brass,8);
   }
   m.ring(x,-D*.55,H*.81,H*.84,.065,.05,dark,12);
  }
 }else if(feed){
  box(-.46,.46,0,H*.08,-D,0);box(-.44,.44,H*.08,H*.12,-D+.02,-.02);
  for(const x of [-.27,0,.27]){
   m.cylinder(x,-D*.5,H*.12,H*.38,.10,.12,fabric,10);
   m.cylinder(x,-D*.5,H*.38,H*.58,.12,.05,fabric,10);
   m.ring(x,-D*.5,H*.55,H*.58,.055,.045,linen,10);
  }
  for(const x of [-.43,.43])box(x-.02,x+.02,0,H*.94,-D,-D+.04);
  box(-.45,.45,H*.78,H*.82,-D,0);
  for(const x of [-.25,.22])m.cylinder(x,-D*.5,H*.82,H*.99,.085,.10,wood,10);
 }else if(arms){
  for(const x of [-.43,.43]){
   box(x-.025,x+.025,0,H,-D*.65,-D*.38);box(x-.055,x+.055,0,H*.05,-D,0);
  }
  for(const y of [.17,.76])box(-.46,.46,H*y,H*(y+.045),-D*.65,-D*.38);
  // Two spears, a sheathed sword and two shields have separate mounting slots.
  for(const x of [-.30,-.12]){
   m.beam([x,H*.08,-D*.25],[x,H*.84,-D*.25],.011,wood,6);
   m.extrude([[x-.025,H*.84],[x,H*.98],[x+.025,H*.84]],-D*.23,-D*.27,metal);
  }
  box(.015,.045,H*.12,H*.60,-D*.28,-D*.22,dark);
  box(-.025,.085,H*.59,H*.61,-D*.31,-D*.19,brass);
  box(.018,.042,H*.61,H*.75,-D*.27,-D*.23,wood);
  for(const x of [.20,.38]){
   const y=H*.46;
   m.extrude([[x-.072,y+H*.16],[x+.072,y+H*.16],[x+.070,y],[x,y-H*.13],[x-.070,y]],-D*.08,-D*.18,fabric);
   m.beam([x,y-H*.08,-D*.075],[x,y+H*.13,-D*.075],.009,brass,4);
   box(x-.026,x+.026,y-H*.025,y+H*.025,-D*.076,-D*.04,metal);
  }
  if(art==='bookcase'){
   m.beam([.17,H*.10,-D*.22],[.32,H*.23,-D*.22],.012,wood,6);
   box(.27,.38,H*.22,H*.26,-D*.27,-D*.17,metal);
  }
 }else if(sewing){
  const y=H*.96,z=-D*.53;
  for(const x of [-.41,.41])for(const zz of [-D+.035,-.035])box(x-.025,x+.025,0,y,zz-.025,zz+.025);
  box(-.48,.48,y,H,-D,0);box(-.40,.40,H*.22,H*.25,-D+.025,-.025);
  // Period-style hand-crank / treadle machine on a dedicated sewing bench.
  box(-.05,.31,H,H*1.045,z-.09,z+.09,metal);
  box(.19,.26,H*1.045,H*1.53,z-.05,z+.05,dark);
  m.softBox(-.12,.25,H*1.43,H*1.56,z-.05,z+.05,dark,.012);
  box(-.12,-.08,H*1.20,H*1.48,z-.028,z+.028,metal);
  m.beam([-.10,H*1.20,z],[ -.10,H*1.065,z],.004,brass,4);
  // Crank wheel lies in the vertical plane; no animation or extra mesh.
  for(let i=0;i<10;i++){
   const a=i*Math.PI/5,b=(i+1)*Math.PI/5;
   m.beam([.29,H*1.34+Math.sin(a)*H*.16,z+Math.cos(a)*H*.16],
     [.29,H*1.34+Math.sin(b)*H*.16,z+Math.cos(b)*H*.16],.007,metal,4);
  }
  box(-.24,.18,H*.12,H*.15,-D*.8,-D*.22,metal);
  m.beam([.25,H*.16,-D*.30],[.25,H*1.23,z],.004,dark,4);
  foldedCloth(m,-.30,-D*.48,H+.007,.23,D*.72,blue);
  m.cylinder(.14,z,H*1.56,H*1.68,.018,.018,linen,8);
 }else if(vitrine){
  box(-.46,.46,0,H*.73,-D,0);box(-.49,.49,H*.73,H*.80,-D,.004);
  for(const y of [.08,.62])box(-.47,.47,H*y,H*(y+.035),.001,.014,brass);
  const bottom=H*.80,top=H*1.25;
  box(-.44,.44,bottom,bottom+.012,-D+.025,-.025,linen);
  for(const x of [-.45,.45])for(const z of [-D+.02,-.02])box(x-.008,x+.008,bottom,top,z-.008,z+.008,brass);
  for(const z of [-D+.02,-.02])box(-.46,.46,top-.012,top,z-.008,z+.008,brass);
  for(const x of [-.45,.45])box(x-.008,x+.008,top-.012,top,-D+.015,-.015,brass);
  for(const x of [-.27,-.07])loaf(m,x,-D*.48,bottom+.013,.060);
  cake(m,.24,-D*.48,bottom+.013,.105);
  // Sparse edge reflections describe clear glazing while keeping all food
  // visible, without an opaque glass box or another transparency render pass.
  for(const x of [-.40,.32])m.beam([x,bottom+H*.08,-.019],[x+.035,top-H*.05,-.019],.003,reflection,4);
 }
 return true;
}

/** Surface-height anchors match FurnitureGeometry's actual table/counter tops. */
export function addInteriorSurfaceStock(m:ModelMesh,shape:FurnitureShape,emission:boolean){
 const {art,interiorUse:use,rise:H,depth:D,kit}=shape;if(!use||emission)return;
 const desk=art==='workstation',counter=art==='counter',table=art==='table';
 if(!desk&&!counter&&!table)return;
 const y=counter?H*.88:H;
 if(use==='bakery'||use==='restaurant'||use==='kitchen'){
  if(desk){
   const wood=regionalWood(kit);m.box(-.38,.02,y+.006,y+.018,-D*.8,-D*.2,wood);
   loaf(m,-.19,-D*.5,y+.018,.075);
   m.cylinder(.23,-D*.5,y,y+.08,.075,.10,linen,10);
   m.ring(.23,-D*.5,y+.08,y+.09,.10,.08,linen,10);
   m.beam([.20,y+.10,-D*.4],[.33,y+.17,-D*.7],.008,wood,6);
  }else if(use==='bakery')cake(m,-.22,-D*.48,y+.02,.07);
  else{
   for(const x of [-.24,.24]){
    m.cylinder(x,-D*.5,y+.012,y+.022,.10,.10,linen,10);
    loaf(m,x-.02,-D*.5,y+.023,.043);
    m.ring(x,-D*.20,y+.012,y+H*.16,.025,.018,linen,10);
    m.cylinder(x+.04,-D*.5,y+.023,y+.05,.020,.022,regionalFabric(kit),8);
   }
  }
 }else if(use==='clothier'&&counter){
  for(let i=0;i<3;i++)foldedCloth(m,-.27+i*.27,-D*.5,y+.01,.20,D*.65,[blue,red,linen][i]);
 }else if(use==='herbalist'){
  for(let i=0;i<3;i++)bottle(m,-.25+i*.24,-D*.54,y+.01,H*.18,.027);
  m.box(-.15,.15,y+.012,y+.017,-D*.3,-D*.12,linen);
 }else if(use==='market'&&counter){
  for(let i=0;i<3;i++){
   const x=-.28+i*.28;
   m.box(x-.10,x+.10,y+.01,y+.025,-D*.77,-D*.23,regionalWood(kit));
   for(const dx of [-.045,.045])m.cylinder(x+dx,-D*.5,y+.025,y+.09,.035,.025,i%2?apple:crust,8);
  }
 }else if(use==='bookseller'){
  for(const x of [-.23,.20]){
   m.box(x-.10,x+.10,y+.012,y+.023,-D*.75,-D*.2,blue);
   m.box(x-.095,x+.095,y+.023,y+.05,-D*.74,-D*.21,linen);
  }
 }else if((use==='workshop'||use==='armory'||use==='barracks')&&desk){
  const wood=regionalWood(kit);
  for(let i=0;i<3;i++){
   const x=-.26+i*.24;
   m.beam([x,y+.02,-D*.20],[x,y+.02,-D*.72],.012,wood,6);
   m.box(x-.055,x+.055,y+.01,y+.06,-D*.78,-D*.62,metal);
  }
 }
}
