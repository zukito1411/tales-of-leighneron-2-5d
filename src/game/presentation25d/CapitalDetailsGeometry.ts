import {ModelMesh,atlasMaterial,pigment,type ModelMaterial,type V3} from './ModelMesh';
import type {HouseShape} from './HouseGeometry';
import type {FurnitureShape} from './FurnitureGeometry';

/** Small source-palette assemblies joined to existing prefabs. No new image
 * atlas, material, actor, light or animation loop is created by these details. */
export function addCapitalShopfront(m:ModelMesh,shape:HouseShape,emission:boolean){
 const style=shape.shopfront;if(!style||emission)return;
 const {width:W,height:H}=shape,base=Math.max(.96,shape.ground??.96);
 const ground=.5-shape.top-base*H,X=(x:number)=>shape.left+x*W-.5;
 const wood=atlasMaterial('furnishings',0,W*.30,W*.22),dark=atlasMaterial('furnishings',2,W*.25,W*.35);
 const iron=atlasMaterial('furnishings',3,W*.16,W*.16),gold=atlasMaterial('furnishings',12,W*.12,W*.12);
 const cloth=atlasMaterial('furnishings',style==='clothier'?6:style==='guild'?6:style==='herbalist'?7:5,W*.24,W*.24);
 const cream=atlasMaterial('furnishings',4,W*.24,W*.24);
 // Canopies are raised over the side windows, leaving the central door clear.
 const l=.14,r=.40,top=ground+H*.34,front=.12*W,back=.019*W;
 const p=(x:number,y:number,z:number):V3=>[X(x),y,z];
 for(let i=0;i<6;i++){
  const a=l+(r-l)*i/6,b=l+(r-l)*(i+1)/6,mat=i%2?cream:cloth;
  m.quad(p(b,top,back),p(a,top,back),p(b,top-H*.038,front),p(a,top-H*.038,front),mat);
  m.extrude([[X(a),top-H*.038],[X(b),top-H*.038],[X(b),top-H*.063],[X((a+b)/2),top-H*.075],[X(a),top-H*.063]],front,front-.004*W,mat);
 }
 for(const x of [l,r]){
  m.beam(p(x,top-.10*H,back),p(x,top-.038*H,front),W*.0045,dark,4);
  m.beam(p(x,top+.005*H,back),p(x,top-.038*H,front),W*.004,dark,4);
 }
 m.beam(p(l,top-.038*H,front),p(r,top-.038*H,front),W*.005,wood,4);
 // Framed, two-sided hanging trade signs. Tankard, anvil and heraldry come
 // from the existing building-details atlas; textile shops show woven cloth.
 const sx=.78,sy=ground+H*.37,sw=W*.115,sh=H*.11,z=.108*W;
 m.beam(p(sx-.075,sy+sh*.75,.01*W),p(sx+.075,sy+sh*.75,.01*W),W*.006,dark,4);
 for(const x of [sx-.035,sx+.035]){
  m.beam(p(x,sy+sh*.75,.01*W),p(x,sy+sh*.75,z),W*.003,iron,6);
  m.beam(p(x,sy+sh*.75,z),p(x,sy+sh*.38,z),W*.0025,iron,6);
 }
 m.softBox(X(sx)-sw*.56,X(sx)+sw*.56,sy-sh*.53,sy+sh*.53,z-.01*W,z+.01*W,dark,W*.004);
 const tile=style==='cafe'||style==='bakery'?10:style==='armorer'?15:8;
 const sign:ModelMaterial=style==='clothier'?atlasMaterial('furnishings',6,sw,sh)
  :style==='herbalist'?atlasMaterial('furnishings',7,sw,sh):atlasMaterial('buildingDetails',tile,sw,sh);
 for(const face of [-1,1]){
  const depth=z+face*.0105*W,a=X(sx)-sw*.45,b=X(sx)+sw*.45;
  if(face===1)m.quad([a,sy-sh*.42,depth],[b,sy-sh*.42,depth],[a,sy+sh*.42,depth],[b,sy+sh*.42,depth],sign);
  else m.quad([b,sy-sh*.42,depth],[a,sy-sh*.42,depth],[b,sy+sh*.42,depth],[a,sy+sh*.42,depth],sign);
 }
 for(const x of [-1,1])m.beam([X(sx)+x*sw*.52,sy-sh*.50,z+.011*W],[X(sx)+x*sw*.52,sy+sh*.50,z+.011*W],W*.002,gold,4);
 // Louvered shutters and a shallow flower box finish the opposite shop bay.
 const sill=ground+H*.16;
 for(const x of [.67,.87])for(let i=0;i<4;i++)
  m.softBox(X(x)-W*.025,X(x)+W*.025,sill+i*H*.032,sill+(i+1)*H*.032-.003*H,.020*W,.037*W,wood,.002*W);
 m.softBox(X(.67),X(.87),sill-.025*H,sill,.030*W,.073*W,wood,.004*W);
 const leaves={...atlasMaterial('buildingDetails',12,W*.20,H*.09),cutout:true};
 m.quad(p(.67,sill,.074*W),p(.87,sill,.074*W),p(.67,sill+.085*H,.074*W),p(.87,sill+.085*H,.074*W),leaves);
}

export function addCapitalMarketStock(m:ModelMesh,shape:FurnitureShape,emission:boolean){
 const style=shape.streetStyle;if(!style||emission)return;
 const H=shape.rise,D=shape.depth,wood=atlasMaterial('furnishings',0,.30,.22),dark=atlasMaterial('furnishings',2,.30,.26);
 const iron=atlasMaterial('furnishings',3,.15,.15),paper=atlasMaterial('furnishings',4,.20,.20);
 const green=atlasMaterial('furnishings',5,.23,.23),blue=atlasMaterial('furnishings',6,.23,.23),red=atlasMaterial('furnishings',8,.23,.23);
 const box=(l:number,r:number,b:number,t:number,back:number,front:number,mat:ModelMaterial=wood)=>m.softBox(l,r,b,t,back,front,mat,.004);
 const roll=(x:number,z:number,y:number,mat:ModelMaterial)=>{
  m.beam([x,y,z-.11],[x,y,z+.11],.050,mat,12);
  m.ring(x,z+.115,y-.025,y+.025,.024,.012,paper,12);
 };
 const book=(x:number,z:number,y:number,mat:ModelMaterial)=>{
  box(x-.065,x+.065,y,y+.014,z-.09,z+.09,mat);box(x-.06,x+.06,y+.014,y+.045,z-.085,z+.085,paper);
  box(x-.065,x+.065,y+.045,y+.055,z-.09,z+.09,mat);
 };
 const sword=(x:number,z:number,y:number,factor=1)=>{
  const height=H*factor;
  m.beam([x,y,z],[x,y+height*.19,z],.018,dark,8);
  box(x-.07,x+.07,y+height*.17,y+height*.20,z-.018,z+.018,iron);
  m.extrude([[x-.021,y+height*.20],[x+.021,y+height*.20],[x+.018,y+height*.62],[x,y+height*.69],[x-.018,y+height*.62]],z+.009,z-.009,iron);
 };
 if(style==='arms-rack'){
  for(let i=0;i<3;i++)sword(-.26+i*.26,-D*.40,H*.16);return;
 }
 if(style==='cloth-counter'){
  for(let i=0;i<3;i++)roll(-.27+i*.27,-D*.48,H+.055,[green,blue,red][i]);return;
 }
 if(!style.endsWith('-stall'))return;
 const y=H*.33;
 // Rear shelf, counter trays and a scalloped, striped canvas hem add the
 // joinery, stock and fabric finish visible in the original market drawing.
 box(-.43,.43,y+.005,y+.022,-D*.72,-.035);
 for(const z of [-D*.62,-D*.12])box(-.40,.40,y+.02,y+.065,z-.009,z+.009,dark);
 for(const x of [-.40,-.13,.13,.40])box(x-.009,x+.009,y+.02,y+.065,-D*.62,-D*.12,dark);
 for(let i=0;i<8;i++){
  const a=-.52+i*1.04/8,b=a+1.04/8,mat=i%2?paper:style==='cloth-stall'||style==='book-stall'?blue:green;
  m.extrude([[a,H*.78],[b,H*.78],[b,H*.72],[(a+b)/2,H*.695],[a,H*.72]],.021,.011,mat);
 }
 if(style==='cloth-stall'){
  for(let i=0;i<3;i++)roll(-.27+i*.27,-D*.36,y+.08,[green,blue,red][i]);
  for(let i=0;i<3;i++)box(.17,.37,y+.04+i*.026,y+.064+i*.026,-D*.65,-D*.42,i%2?blue:paper);
 }else if(style==='tools-stall'){
  for(let i=0;i<3;i++)sword(-.27+i*.27,-D*.65,y+.05,.60);
 }else if(style==='book-stall'){
  for(let i=0;i<3;i++)book(-.27+i*.27,-D*.35,y+.04,[green,blue,red][i]);
 }else if(style==='bread-stall'){
  for(let row=0;row<2;row++)for(let i=0;i<4;i++){
   const x=-.30+i*.20,z=-D*(.25+row*.26),bread:ModelMaterial={color:pigment(0xc58d43)};
   m.cylinder(x,z,y+.035,y+.065,.058,.074,bread,12);m.cylinder(x,z,y+.065,y+.105,.074,.035,bread,12);
   for(const dx of [-.025,.025])m.beam([x+dx,y+.107,z-.02],[x+dx+.012,y+.107,z+.02],.003,paper,4);
  }
 }else if(style==='herb-stall'){
  for(let i=0;i<4;i++){
   const x=-.30+i*.20,z=-D*.4,clay:ModelMaterial={color:pigment(0x956548)};
   m.cylinder(x,z,y+.03,y+.12,.035,.05,clay,12);m.ring(x,z,y+.11,y+.13,.054,.042,dark,12);
   for(let leaf=0;leaf<5;leaf++){const a=leaf*Math.PI*2/5;
    m.beam([x,y+.13,z],[x+Math.sin(a)*.045,y+.21,z+Math.cos(a)*.045],.012,green,6);}
  }
 }else{
  for(let row=0;row<2;row++)for(let i=0;i<5;i++){
   const x=-.32+i*.16,z=-D*(.24+row*.29),fruit:ModelMaterial={color:pigment(i<2?0xb13d28:i<4?0x7c9b36:0xd5a447)};
   m.cylinder(x,z,y+.035,y+.070,.027,.041,fruit,12);m.cylinder(x,z,y+.070,y+.100,.041,.025,fruit,12);
   m.beam([x,y+.099,z],[x+.004,y+.12,z],.003,dark,4);
  }
 }
}

export function addCapitalCanopy(m:ModelMesh,H:number,D:number){
 const green=atlasMaterial('furnishings',5,.20,.28),cream=atlasMaterial('furnishings',4,.20,.28),wood=atlasMaterial('furnishings',0,.30,.20);
 for(let stripe=0;stripe<8;stripe++)for(let row=0;row<4;row++){
  const a=-.52+stripe*1.04/8,b=a+1.04/8,t=row/4,u=(row+1)/4;
  const z=(t:number)=>-D-.025+t*(D+.05),y=(t:number)=>H*(.95-t*.17-Math.sin(t*Math.PI)*.023);
  m.quad([b,y(t),z(t)],[a,y(t),z(t)],[b,y(u),z(u)],[a,y(u),z(u)],stripe%2?cream:green);
 }
 for(const z of [-D-.025,.025])m.beam([-.53,z<0?H*.95:H*.78,z],[.53,z<0?H*.95:H*.78,z],.013,wood,4);
}
