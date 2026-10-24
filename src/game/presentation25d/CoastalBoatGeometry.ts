import {ModelMesh,atlasMaterial,paintedMaterial,type Patch,type V3} from './ModelMesh';
import type {FurnitureShape} from './FurnitureGeometry';

export const BOAT_DECK_RATIO=.10;
/** One shared closed hull, measured within the existing 190-unit route
 * clearance. Its real heading, rig and crew are independent of camera yaw. */
export function coastalBoatShape():FurnitureShape {
  return {art:'coastal-boat',kit:'portquill_maritime',key:'coastal-boat-v1',left:0,top:0,width:160/384,height:1,
    rise:1.36,depth:1.5,patch:[.4,.75,.43,.8],fixedGround:0,
    bounds:{left:-.47,right:.47,bottom:-.13,top:1.40,back:-.84,front:.78}};
}
export function createCoastalBoatGeometry(shape:FurnitureShape,emission=false){
  const m=new ModelMesh(shape,emission),fit=280/617,left=(384-337*fit)/2,top=364-615*fit;
  const patch=([l,t,r,b]:Patch):Patch=>[(left+(l-155)*fit)/384,(top+(t-8)*fit)/384,(left+(r-155)*fit)/384,(top+(b-8)*fit)/384];
  const wood=paintedMaterial(patch([220,440,240,470]),.22,.28),dark=paintedMaterial(patch([205,370,215,394]),.18,.24),rim=paintedMaterial(patch([230,510,260,540]),.28,.14),iron=atlasMaterial('furnishings',3,.09,.09),rope=atlasMaterial('furnishings',13,.16,.16);
  const path=[[-.04,-.79],[-.24,-.58],[-.39,-.27],[-.42,.18],[-.32,.53],[-.15,.68],[.15,.68],[.32,.53],[.42,.18],[.39,-.27],[.24,-.58],[.04,-.79]] as const;
  const p=(i:number,v:number):V3=>{const [x,z]=path[(i+path.length)%path.length],f=.42+.58*v;return [x*f,-.12+v*.28,z*(.88+.12*v)];};
  for(let row=0;row<4;row++)for(let i=0;i<path.length;i++){
    const a=p(i,row/4),b=p(i+1,row/4),c=p(i,(row+1)/4),d=p(i+1,(row+1)/4);
    m.quad(a,b,c,d,row===0?dark:wood);
    // Raised overlapping strakes, inside planking and a continuous gunwale.
    m.beam(c,d,.006,row===3?rim:dark,4);
    if(row===3){
      m.quad([c[0]*.90,.10,c[2]*.96],[d[0]*.90,.10,d[2]*.96],c,d,wood);
      m.beam(c,d,.018,rim,6);
    }
  }
  m.floor(path.map(([x,z])=>[x*.95,z*.96] as const),.10,wood,4);
  m.floor(path.map(([x,z])=>[x*.42,z*.88] as const),-.12,dark);
  for(let i=-3;i<=3;i++){
    const x=i*.09;m.beam([x,.102,-.68+Math.abs(x)*.9],[x,.102,.59-Math.abs(x)*.4],.002,dark,4);
  }
  for(const z of [-.42,.33]){
    m.softBox(-.30,.30,.13,.17,z-.045,z+.045,wood,.009);
    for(const x of [-.27,.27])m.box(x-.015,x+.015,.10,.15,z-.022,z+.022,dark);
  }
  for(let i=1;i<path.length;i+=2){const a=p(i,1);m.beam([a[0]*.94,.10,a[2]*.97],[a[0],.21,a[2]],.012,rim,4);}
  m.beam([0,.10,-.05],[0,1.35,-.05],.025,wood,10);
  for(const y of [.15,.24,1.28])m.ring(0,-.05,y,y+.018,.030,.024,rope,12);
  const tip:V3=[0,1.28,-.05],clew:V3=[.045,.36,-.65],tack:V3=[0,.31,-.05];
  m.beam(tack,clew,.014,wood,8);
  // The cream triangular sail is sampled from the original boat's front
  // painting, with explicit source-to-prepared-frame registration.
  if(!emission){
    const uv=(x:number,y:number):readonly [number,number]=>[(left+(x-155)*fit)/384,1-(top+(y-8)*fit)/384];
    m.triangle(tip,tack,clew,[0,0,1,1],undefined,undefined,[uv(314,57),uv(318,372),uv(453,324)]);
    m.triangle(clew,tack,tip,[0,0,1,1],undefined,undefined,[uv(453,324),uv(318,372),uv(314,57)]);
  }
  for(const a of [[-.25,.18,.50],[.25,.18,.50],[0,.20,-.77]] as const)m.beam(tip,a,.0035,rope,4);
  m.beam(tip,clew,.004,rope,4);
  m.beam([0,.10,.62],[0,.28,.74],.019,wood,8);
  m.box(-.022,.022,-.14,.15,.65,.78,dark);
  m.beam([0,.25,.66],[.16,.25,.46],.011,wood,6);
  for(const [x,z] of [[-.20,.19],[-.23,-.10]]){
    m.cylinder(x,z,.10,.27,.068,.062,wood,12);
    for(const y of [.13,.23])m.ring(x,z,y,y+.012,.070,.064,iron,12);
  }
  return m.finish();
}
