import {ModelMesh,atlasMaterial,regionalWood,metal,water,pigment,type ModelMaterial} from './ModelMesh';
import type {FurnitureShape} from './FurnitureGeometry';

const straw=atlasMaterial('architecture',5,.30,.35);
const twine:ModelMaterial={color:pigment(0xa98c58)};
const looseStraw:ModelMaterial={color:pigment(0xd8b363)};

/** Stable stock joins the existing cached furniture mesh. Nothing here adds
 * independent physics, lighting, actors, texture loading or animation. */
export function createStableFitting(m:ModelMesh,shape:FurnitureShape,emission:boolean){
 const {art,interiorUse:use,rise:H,depth:D,kit}=shape;
 const bedding=use==='stable-bedding',hay=use==='stable-hay',gear=use==='stable-gear';
 const tub=art==='barrel'&&use==='stable';
 if(!bedding&&!hay&&!gear&&!tub)return false;
 if(emission)return true;
 const wood=regionalWood(kit);
 if(bedding){
  // A shallow, irregular bed of straw stays walkable. Strands are fixed
  // model details with a hard per-mesh count, never CPU particles.
  m.softBox(-.43,.43,0,H*.40,-D*.92,-D*.08,straw,.012);
  for(let i=0;i<44;i++){
   const x=-.45+((i*17)%43)/43*.90,z=-D*.96+((i*13)%41)/41*D*.91;
   const dx=(i%3-1)*.012,dz=.018+(i%4)*.004;
   m.beam([x,H*.5,z],[x+dx,H*.7,z+dz],.0018,looseStraw,4);
  }
 }else if(hay){
  const bale=(l:number,r:number,b:number,t:number,back:number,front:number)=>{
   m.softBox(l,r,b,t,back,front,straw,.014);
   for(const x of [l+(r-l)*.24,l+(r-l)*.76]){
    m.beam([x,t+.003,back],[x,t+.003,front],.004,twine,4);
    for(const z of [back-.002,front+.002])m.beam([x,b,z],[x,t,z],.004,twine,4);
   }
   for(let i=0;i<9;i++){
    const x=l+.025+(r-l-.05)*i/8;
    m.beam([x,t+.005,back+.02],[x+.01,t+.006,front-.02],.0015,looseStraw,4);
   }
  };
  bale(-.47,-.015,0,H*.46,-D,0);bale(.015,.47,0,H*.46,-D,0);
  bale(-.31,.31,H*.46,H*.94,-D*.88,-D*.12);
 }else if(gear){
  // Grooming tools below a peg rail, with a coiled lead rope and folded
  // saddle cloth. The bench is practical equipment, without dining props.
  const seat=H*.55;
  for(const x of [-.42,.42])for(const z of [-D+.025,-.025])m.box(x-.025,x+.025,0,seat,z-.025,z+.025,wood);
  m.box(-.48,.48,seat,seat+H*.045,-D,0,wood);
  for(const x of [-.42,.42])m.box(x-.02,x+.02,seat,H,-D,-D+.04,wood);
  m.box(-.44,.44,H*.91,H*.97,-D,-D+.04,wood);
  for(const x of [-.25,0,.25])m.beam([x,H*.93,-D+.02],[x,H*.93,-D+.085],.012,metal,6);
  for(let loop=0;loop<4;loop++)for(let i=0;i<12;i++){
   const a=i*Math.PI/6,b=(i+1)*Math.PI/6,z=-D+.09+loop*.009;
   m.beam([-.25+Math.cos(a)*.075,H*.77+Math.sin(a)*H*.15,z],
    [-.25+Math.cos(b)*.075,H*.77+Math.sin(b)*H*.15,z],.0035,twine,6);
  }
  m.softBox(.12,.38,seat+H*.045,seat+H*.11,-D*.85,-D*.25,atlasMaterial('furnishings',4,.2,.2),.008);
  m.softBox(-.08,.06,seat+H*.045,seat+H*.08,-D*.65,-D*.25,wood,.006);
  for(let i=0;i<5;i++)m.box(-.07+i*.025,-.06+i*.025,seat+H*.08,seat+H*.12,-D*.57,-D*.33,twine);
 }else if(tub){
  const r=Math.min(.42,D*.48),z=-D/2;
  m.cylinder(0,z,0,H*.12,r*.78,r*.92,wood,16);
  m.ring(0,z,H*.12,H*.85,r,r*.84,wood,16);
  for(const y of [.20,.73])m.ring(0,z,H*y,H*(y+.065),r*1.015,r*.96,metal,16);
  m.cylinder(0,z,H*.69,H*.70,r*.835,r*.835,water,16);
  m.ring(0,z,H*.83,H*.91,r*1.025,r*.83,wood,16);
 }
 return true;
}
