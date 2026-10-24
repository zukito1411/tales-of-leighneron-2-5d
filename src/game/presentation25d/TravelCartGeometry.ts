import {ModelMesh,paintedMaterial,atlasMaterial,type Patch} from './ModelMesh';
import type {FurnitureShape} from './FurnitureGeometry';

export function travelCartShape():FurnitureShape{
  return {art:'travel-cart',kit:'source-cart',key:'source-cart-v1',left:0,top:0,width:200/384,height:1,
    rise:.98,depth:1.20,patch:[.3,.5,.4,.6],bounds:{left:-.62,right:.62,bottom:0,top:1.02,back:-1.60,front:.65}};
}
export function travelHorseShape(pose:number):FurnitureShape{
  return {art:'travel-horse',kit:'source-horse',key:'source-horse:'+pose,pose,left:0,top:0,width:1,height:1,
    rise:.66,depth:1,patch:[.3,.5,.4,.6],bounds:{left:-.22,right:.22,bottom:-.02,top:.68,back:-.5,front:.5}};
}
/** Source cart: open timber wagon, cream sacks, green bedroll, one barrel,
 * iron axles and four genuinely round, distance-driven spoke wheels. */
export function createTravelCartGeometry(shape:FurnitureShape,emission=false){
  const m=new ModelMesh({left:0,top:0,width:1,height:1},emission),fit=320/622,left=(384-330*fit)/2,top=364-337*fit;
  const crop=([l,t,r,b]:Patch):Patch=>[(left+(l-252)*fit)/384,(top+(t-13)*fit)/384,(left+(r-252)*fit)/384,(top+(b-13)*fit)/384];
  const wood=paintedMaterial(crop([385,197,435,211]),.32,.25),rim=paintedMaterial(crop([341,216,410,226]),.28,.08);
  const cream=paintedMaterial(crop([370,93,391,109]),.32,.32),green=paintedMaterial(crop([330,75,350,105]),.25,.32);
  const iron=atlasMaterial('furnishings',3,.25,.25),rope=atlasMaterial('furnishings',13,.25,.25);
  m.softBox(-.45,.45,.27,.33,-.53,.52,wood,.015);
  for(const side of [-1,1]){
    for(let row=0;row<3;row++)m.softBox(side*.44-.025,side*.44+.025,.34+row*.10,.425+row*.10,-.55,.54,wood,.008);
    for(const z of [-.52,.0,.51])m.box(side*.44-.035,side*.44+.035,.28,.66,z-.025,z+.025,rim);
    m.beam([side*.46,.67,-.55],[side*.46,.67,.55],.025,rim,6);
    m.beam([side*.30,.32,-.49],[side*.24,.34,-1.58],.022,wood,6);
  }
  for(const z of [-.53,.51])for(let row=0;row<3;row++)m.box(-.44,.44,.34+row*.10,.425+row*.10,z-.022,z+.022,wood);
  for(const z of [-.31,.33]){
    m.beam([-.61,.22,z],[.61,.22,z],.026,iron,8);
    for(const x of [-.54,.54])m.wheel(x,.22,z,()=>{
      const r=.22;
      for(let i=0;i<20;i++){
        const a=i/20*Math.PI*2,b=(i+1)/20*Math.PI*2;
        m.beam([x,.22+Math.cos(a)*r,z+Math.sin(a)*r],[x,.22+Math.cos(b)*r,z+Math.sin(b)*r],.026,wood,6);
        m.beam([x,.22+Math.cos(a)*(r+.02),z+Math.sin(a)*(r+.02)],[x,.22+Math.cos(b)*(r+.02),z+Math.sin(b)*(r+.02)],.008,iron,4);
        if(i%2===0)m.beam([x,.22,z],[x,.22+Math.cos(a)*r,z+Math.sin(a)*r],.012,rim,6);
      }
      m.beam([x-.04,.22,z],[x+.04,.22,z],.045,iron,12);
    });
  }
  for(const [x,z,b] of [[.12,-.24,.34],[-.06,.18,.34],[.17,.13,.61]]){
    m.cylinder(x,z,b,b+.05,.11,.18,cream,16);
    m.cylinder(x,z,b+.05,b+.16,.18,.17,cream,16);
    m.cylinder(x,z,b+.16,b+.25,.17,.045,cream,16);
    m.cylinder(x,z,b+.25,b+.28,.045,.065,cream,12);
    m.ring(x,z,b+.24,b+.26,.05,.04,rope,12);
  }
  m.beam([-.29,.55,-.40],[-.29,.55,.39],.13,green,16);
  for(const z of [-.23,.23])m.ring(-.29,z,.52,.56,.14,.11,rope,12);
  m.cylinder(.24,.34,.34,.68,.14,.13,wood,16);
  for(const y of [.39,.60])m.ring(.24,.34,y,y+.025,.145,.13,iron,16);
  return m.finish();
}
