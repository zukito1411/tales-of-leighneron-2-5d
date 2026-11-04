import {ModelMesh,atlasMaterial,pigment,type ModelMaterial,type V3} from './ModelMesh';
import type {FurnitureShape} from './FurnitureGeometry';

/** Complete stone sculpture, in the existing instanced model pipeline.
 * Closed sculpted surfaces, feather relief, drapery and a strung harp retain
 * their volume from behind and at eye level. Built once per attunement state. */
export function createGoddessShrineGeometry(shape:FurnitureShape,emission=false){
 const m=new ModelMesh(shape,emission),z=-shape.depth/2;
 const stone=atlasMaterial('architecture',8,.18,.22),ivory:ModelMaterial={color:pigment(0xd9d6be)};
 const fold:ModelMaterial={color:pigment(0xb3b4a4)},hair:ModelMaterial={color:pigment(0xb8b6a1)};
 const gold:ModelMaterial={color:pigment(0xbc9753)},cut:ModelMaterial={color:pigment(0x83897e)};
 const glow:ModelMaterial={color:pigment(0xffe9a2),emission:pigment(0xffd889)};
 const attuned=shape.pose===1;
 // Keep the emission model tiny: only the unlocked crown and inlaid seal.
 if(attuned){
  m.ring(0,z,1.625,1.645,.15,.128,glow,28);
  // The floating crown also has an underside for first-person views below it.
  const under=(a:number,r:number):V3=>[Math.sin(a)*r,1.625,z+Math.cos(a)*r];
  for(let i=0;i<28;i++){
   const a=i*Math.PI*2/28,b=(i+1)*Math.PI*2/28;
   m.quad(under(b,.15),under(a,.15),under(b,.128),under(a,.128),glow);
  }
  // Rest on the exposed middle ledge, outside the upper pedestal's volume.
  m.ring(0,z,.142,.147,.35,.335,glow,28);
 }
 if(emission)return m.finish();
 m.cylinder(0,z,0,.055,.49,.49,stone,24);
 m.cylinder(0,z,.055,.14,.40,.39,stone,24);
 m.cylinder(0,z,.14,.245,.305,.29,stone,24);
 m.ring(0,z,.13,.15,.405,.38,gold,24);
 // Carved votive panels encircle the pedestal, rather than a flat front decal.
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4,x=Math.sin(a)*.303,zz=z+Math.cos(a)*.303;
  m.beam([x,.175,zz],[x,.216,zz],.009,gold,6);
 }
 type Ring={x:number;y:number;z:number;rx:number;rz:number;fold?:number};
 const loft=(rings:readonly Ring[],mat:ModelMaterial,sides=20)=>{
  const point=(r:Ring,i:number):V3=>{
   const a=i/sides*Math.PI*2,k=1+(r.fold??0)*Math.cos(a*8);
   return [r.x+Math.sin(a)*r.rx*k,r.y,r.z+Math.cos(a)*r.rz*k];
  };
  for(let row=1;row<rings.length;row++)for(let i=0;i<sides;i++){
   const a=rings[row-1],b=rings[row];
   if(b.y>=a.y)m.quad(point(a,i),point(a,i+1),point(b,i),point(b,i+1),mat);
   else m.quad(point(a,i+1),point(a,i),point(b,i+1),point(b,i),mat);
  }
  for(const [r,top] of [[rings[0],rings[0].y>rings[rings.length-1].y],[rings[rings.length-1],rings[rings.length-1].y>=rings[0].y]] as const)for(let i=0;i<sides;i++){
   const center:V3=[r.x,r.y,r.z];
   if(top)m.triangle(center,point(r,i),point(r,i+1),mat);else m.triangle(center,point(r,i+1),point(r,i),mat);
  }
 };
 const oval=(cx:number,cy:number,cz:number,rx:number,ry:number,rz:number,mat:ModelMaterial)=>{
  const rings:Ring[]=[];
  for(let i=0;i<=10;i++){const a=-Math.PI/2+i*Math.PI/10,r=Math.max(.001,Math.cos(a));
   rings.push({x:cx,y:cy+Math.sin(a)*ry,z:cz,rx:rx*r,rz:rz*r});}
  loft(rings,mat,16);
 };
 // Continuous full-length robe and torso: a narrow waist, natural shoulders,
 // a swept hem and deep folds, without independently stretched body pieces.
 loft([
  {x:0,y:.245,z,rx:.205,rz:.15,fold:.11},
  {x:-.012,y:.31,z,rx:.20,rz:.145,fold:.10},
  {x:-.02,y:.56,z,rx:.155,rz:.115,fold:.09},
  {x:-.025,y:.79,z,rx:.12,rz:.09,fold:.065},
  {x:-.02,y:.94,z,rx:.115,rz:.085,fold:.03},
  {x:-.015,y:1.035,z,rx:.085,rz:.075,fold:.02},
  {x:-.01,y:1.16,z:z+.006,rx:.13,rz:.09},
  {x:0,y:1.24,z,rx:.145,rz:.075},
  {x:0,y:1.275,z,rx:.10,rz:.055},
  {x:0,y:1.31,z,rx:.041,rz:.038},
  {x:0,y:1.365,z,rx:.039,rz:.037},
 ],ivory,32);
 // Individual fold ridges end in the hem, following the same robe contour.
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4;
  loft([{x:-.018+Math.sin(a)*.112,y:.81,z:z+Math.cos(a)*.087,rx:.012,rz:.009},
   {x:-.012+Math.sin(a)*.166,y:.50,z:z+Math.cos(a)*.127,rx:.015,rz:.010},
   {x:Math.sin(a)*.208,y:.26,z:z+Math.cos(a)*.153,rx:.011,rz:.008}],i%2?ivory:fold,8);
 }
 oval(0,1.435,z,.073,.102,.065,ivory);
 // Hair frames the face and flows over the back of the shoulders.
 oval(0,1.468,z-.026,.081,.092,.068,hair);
 for(const side of [-1,1])for(let i=0;i<3;i++)loft([
  {x:side*(.047+i*.01),y:1.49,z:z+.006-i*.026,rx:.017,rz:.015},
  {x:side*(.075+i*.005),y:1.39,z:z-.013-i*.022,rx:.019,rz:.017},
  {x:side*(.06+i*.012),y:1.285,z:z-.035-i*.02,rx:.014,rz:.012},
 ],hair,10);
 // A quiet carved face, with brow, nose, eyelids and lips in actual relief.
 oval(0,1.43,z+.045,.055,.072,.032,ivory);
 m.extrude([[-.011,1.451],[.008,1.451],[.013,1.410],[-.013,1.410]],z+.089,z+.067,ivory);
 for(const side of [-1,1]){
  oval(side*.026,1.449,z+.073,.019,.008,.006,fold);
  oval(side*.026,1.445,z+.077,.015,.003,.003,cut);
 }
 oval(0,1.395,z+.075,.018,.004,.004,fold);
 // Sleeves and hands follow the harp-playing pose as solid tapered surfaces.
 for(const rings of [
  [{x:-.12,y:1.25,z,rx:.046,rz:.043},{x:-.18,y:1.12,z:z+.025,rx:.045,rz:.043},
   {x:-.13,y:1.00,z:z+.12,rx:.034,rz:.030},{x:.02,y:1.035,z:z+.18,rx:.024,rz:.022}],
  [{x:.12,y:1.25,z,rx:.046,rz:.043},{x:.18,y:1.14,z:z+.075,rx:.042,rz:.038},
   {x:.20,y:1.04,z:z+.14,rx:.033,rz:.028},{x:.27,y:1.055,z:z+.19,rx:.024,rz:.020}],
 ] as const)loft(rings,ivory,14);
 oval(.035,1.04,z+.185,.039,.025,.025,ivory);
 oval(.265,1.055,z+.192,.035,.024,.023,ivory);
 for(let i=0;i<4;i++){
  oval(.045+i*.010,1.022,z+.202,.006,.020-i*.002,.007,ivory);
  oval(.25+i*.010,1.036,z+.209,.006,.018-i*.002,.007,ivory);
 }
 // Swept angel wings: thick roots, overlapping tapered flight feathers and
 // smaller coverts on both faces. Their feet stay within the pedestal survey.
 for(const side of [-1,1]){
  const path:readonly (readonly [number,number])[]=[
   [.085,1.22],[.14,1.42],[.29,1.55],[.49,1.58],[.45,1.40],[.34,1.20],[.20,1.04],
  ];
  m.extrude(path.map(([x,y])=>[x*side,y] as const),z-.065,z-.13,ivory);
  for(let i=0;i<10;i++){
   const t=i/9,rootX=.115+.18*t,rootY=1.30+.19*t,tipX=.19+.31*t,tipY=1.04+.51*t;
   const dx=tipX-rootX,dy=tipY-rootY,len=Math.hypot(dx,dy),nx=-dy/len*.018,ny=dx/len*.018;
   const feather=[[(rootX-nx)*side,rootY-ny],[(rootX+nx)*side,rootY+ny],
    [(tipX+nx*.45)*side,tipY+ny*.45],[tipX*side,tipY-.018],[(tipX-nx*.45)*side,tipY-ny*.45]] as const;
   m.extrude(feather,z-.047-i*.0008,z-.145-i*.0008,i%3?ivory:fold);
  }
  for(let i=0;i<7;i++)oval(side*(.13+i*.027),1.29+i*.028,z-.041,.026,.040,.016,ivory);
 }
 // Curved harp neck and pillar, a carved soundbox and ten separate strings.
 const harpZ=z+.16;
 loft([{x:.12,y:.55,z:harpZ,rx:.045,rz:.045},{x:.07,y:.69,z:harpZ,rx:.041,rz:.036},
  {x:.025,y:.86,z:harpZ,rx:.030,rz:.027},{x:.005,y:1.12,z:harpZ,rx:.018,rz:.020}],gold,12);
 loft([{x:.12,y:.55,z:harpZ,rx:.025,rz:.025},{x:.34,y:.63,z:harpZ,rx:.023,rz:.023},
  {x:.36,y:1.21,z:harpZ,rx:.019,rz:.020},{x:.30,y:1.28,z:harpZ,rx:.023,rz:.022},
  {x:.15,y:1.22,z:harpZ,rx:.020,rz:.020},{x:.005,y:1.12,z:harpZ,rx:.022,rz:.022}],gold,12);
 for(let i=0;i<10;i++){
  const t=(i+1)/11,x=.025+.30*t;
  m.beam([x,.61+.30*(1-t),harpZ+.009],[x,1.14+.12*Math.sin(t*Math.PI),harpZ+.009],.002,ivory,4);
 }
 // Resting circlet remains stone until attunement adds the luminous halo.
 m.ring(0,z,1.501,1.518,.071,.061,gold,20);
 return m.finish();
}
