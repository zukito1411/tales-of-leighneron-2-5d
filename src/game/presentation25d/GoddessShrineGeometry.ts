import {ModelMesh,paintedMaterial,pigment,type ModelMaterial,type V3} from './ModelMesh';
import type {FurnitureShape} from './FurnitureGeometry';

/** Complete stone sculpture, in the existing instanced model pipeline.
 * Closed sculpted surfaces, feather relief, drapery and a strung harp retain
 * their volume from behind and at eye level. Built once per attunement state. */
export function createGoddessShrineGeometry(shape:FurnitureShape,emission=false){
 const m=new ModelMesh(shape,emission),z=-shape.depth/2;
 // Tile actual painted stone, light edges, shaded carving and amber ornament
 // from this actor's source sprite on every modeled side. Preserve its grain
 // and warm contrast rather than inventing a blue-gray marble palette.
 const paint=shape.shrinePaint;
 const stone=paintedMaterial(paint?.body??shape.patch,.30,.30);
 const ivory=paintedMaterial(paint?.light??shape.patch,.28,.28);
 const fold=paintedMaterial(paint?.body??shape.patch,.28,.28),hair=stone;
 const gold=paintedMaterial(paint?.gold??shape.patch,.16,.20);
 const cut=paintedMaterial(paint?.shade??shape.patch,.20,.20);
 const glow:ModelMaterial={color:pigment(0xe8b45c),emission:pigment(0xe8b45c)};
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
 // The source's carved crescent belongs to the pedestal as an inset seal;
 // only the emblem is mapped, never a flat picture of the entire statue.
 // This surveyed crop is opaque stone, including the carving. Keep it a
 // normal textured surface so the whole sculpture retains opaque batching.
 if(paint){
  // A shallow closed mounting clears the curved plinth at the whole seal,
  // instead of burying its lower half inside the cylinder's larger radius.
  m.extrude([[-.061,.145],[.061,.145],[.065,.15],[.065,.24],[.061,.245],[-.061,.245],[-.065,.24],[-.065,.15]],z+.311,z+.287,stone);
  m.quad([-.055,.15,z+.312],[.055,.15,z+.312],[-.055,.24,z+.312],[.055,.24,z+.312],paintedMaterial(paint.moon,.11,.09));
 }
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
  // Smooth only the continuous sculpted surfaces. The old per-face normals
  // made cheeks, hair and sleeves read as sharp lumps in oblique lighting.
  const normal=(row:number,i:number):V3=>{
   const r=rings[row],a=point(r,i-.1),b=point(r,i+.1);
   const lower=point(rings[Math.max(0,row-1)],i),upper=point(rings[Math.min(rings.length-1,row+1)],i);
   const tx=b[0]-a[0],ty=b[1]-a[1],tz=b[2]-a[2],ux=upper[0]-lower[0],uy=upper[1]-lower[1],uz=upper[2]-lower[2];
   let nx=ty*uz-tz*uy,ny=tz*ux-tx*uz,nz=tx*uy-ty*ux;
   const p=point(r,i);if(nx*(p[0]-r.x)+nz*(p[2]-r.z)<0){nx=-nx;ny=-ny;nz=-nz;}
   const length=Math.hypot(nx,ny,nz)||1;return [nx/length,ny/length,nz/length];
  };
  for(let row=1;row<rings.length;row++)for(let i=0;i<sides;i++){
   const a=rings[row-1],b=rings[row],left=b.y>=a.y?i:i+1,right=b.y>=a.y?i+1:i;
   const aa=point(a,left),ab=point(a,right),ba=point(b,left),bb=point(b,right);
   const na=normal(row-1,left),nb=normal(row-1,right),nc=normal(row,left),nd=normal(row,right);
   m.triangle(aa,ab,ba,mat,undefined,[na,nb,nc]);m.triangle(ab,bb,ba,mat,undefined,[nb,nd,nc]);
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
 // A single continuous head profile replaces the overlapping head/face balls.
 // The draped veil surrounds the sides and rear, leaving an open face.
 loft([{x:0,y:1.335,z,rx:.031,rz:.035},{x:0,y:1.365,z:z+.006,rx:.047,rz:.049},
  {x:0,y:1.405,z:z+.005,rx:.069,rz:.061},{x:0,y:1.45,z,rx:.079,rz:.066},
  {x:0,y:1.495,z:z-.006,rx:.069,rz:.059},{x:0,y:1.53,z:z-.009,rx:.041,rz:.037},
  {x:0,y:1.541,z:z-.009,rx:.002,rz:.002}],ivory,24);
 const veil=[{y:1.29,rx:.112,rz:.084},{y:1.37,rx:.102,rz:.082},{y:1.47,rx:.091,rz:.078},
  {y:1.535,rx:.064,rz:.058},{y:1.553,rx:.002,rz:.002}];
 for(let row=1;row<veil.length;row++)for(let i=0;i<20;i++){
  const point=(r:typeof veil[number],t:number):V3=>{
   const a=.70+t*(Math.PI*2-1.40);return [Math.sin(a)*r.rx,r.y,z-.011+Math.cos(a)*r.rz];
  };
  const a=point(veil[row-1],i/20),b=point(veil[row-1],(i+1)/20),c=point(veil[row],i/20),d=point(veil[row],(i+1)/20);
  const inset=(p:V3):V3=>[p[0]*.96,p[1]-.002,z-.011+(p[2]-z+.011)*.96];
  const aa=inset(a),bb=inset(b),cc=inset(c),dd=inset(d);
  m.quad(a,b,c,d,hair);m.quad(bb,aa,dd,cc,hair);
  if(i===0)m.quad(aa,a,cc,c,hair);
  if(i===19)m.quad(b,bb,d,dd,hair);
  if(row===1)m.quad(b,a,bb,aa,hair);
  if(row===veil.length-1)m.quad(c,d,cc,dd,hair);
 }
 // Shallow closed eyelids and a small nose, carved in the same stone. No
 // dark eyeballs, painted lips or protruding facial pieces resembling skin.
 loft([{x:0,y:1.410,z:z+.061,rx:.010,rz:.007},{x:0,y:1.421,z:z+.064,rx:.012,rz:.011},
  {x:0,y:1.452,z:z+.058,rx:.005,rz:.004}],ivory,12);
 for(const side of [-1,1]){
  m.beam([side*.015,1.445,z+.064],[side*.042,1.447,z+.057],.0018,cut,6);
 }
 m.beam([-.012,1.390,z+.055],[.012,1.390,z+.055],.0013,cut,6);
 // Sleeves and hands follow the harp-playing pose as solid tapered surfaces.
 for(const rings of [
  [{x:-.12,y:1.25,z,rx:.046,rz:.043},{x:-.18,y:1.12,z:z+.025,rx:.045,rz:.043},
   {x:-.13,y:1.00,z:z+.12,rx:.034,rz:.030},{x:.02,y:1.035,z:z+.18,rx:.024,rz:.022}],
  [{x:.12,y:1.25,z,rx:.046,rz:.043},{x:.18,y:1.14,z:z+.075,rx:.042,rz:.038},
   {x:.20,y:1.04,z:z+.14,rx:.033,rz:.028},{x:.27,y:1.055,z:z+.19,rx:.024,rz:.020}],
 ] as const)loft(rings,ivory,14);
 oval(.035,1.04,z+.185,.039,.025,.025,ivory);
 oval(.265,1.055,z+.192,.035,.024,.023,ivory);
 for(let i=0;i<3;i++){
  m.beam([.025+i*.009,1.028,z+.208],[.030+i*.009,1.047,z+.208],.0015,fold,4);
  m.beam([.250+i*.009,1.044,z+.215],[.254+i*.009,1.059,z+.213],.0015,fold,4);
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
 m.ring(0,z,1.503,1.516,.077,.069,gold,20);
 return m.finish();
}
