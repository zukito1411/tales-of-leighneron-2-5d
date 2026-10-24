import {ModelMesh,paintedMaterial,pigment,type ModelMaterial,type Patch,type V3} from './ModelMesh';
import type {HouseShape} from './HouseGeometry';

/** tower-of-might-v2.png: round masonry, stacked arcane galleries, purple rune hangings,
 * gold stone collars, lancets and a crenellated crown. Only individual painted
 * ornaments are reused; the complete tower is never a flat front panel. */
export function createMagusTowerGeometry(shape:HouseShape,emission=false){
  const {width:W,height:H,depth:D}=shape,m=new ModelMesh(shape,emission,W);
  const x=shape.left+W*.505-.5,z=-D/2,b=.5-shape.top-H;
  const y=(v:number)=>b+v*H;
  const stone=paintedMaterial([.55,.22,.576,.246],W*.15,H*.045);
  const gold=paintedMaterial([.444,.735,.46,.743],W*.12,H*.025);
  const dark:ModelMaterial={color:pigment(0x191624)},violet:ModelMaterial={color:pigment(0x272039),emission:pigment(0x7563a0)};
  const r=W*.25,sides=32;
  // A real southern notch keeps the portal and stairs out of the foundation
  // drum. Its rear/side shell stays closed around the recessed doorway.
  const openBand=(low:number,high:number,outer:number,inner:number,mat:ModelMaterial,gap=.49)=>{
    const p=(a:number,rr:number,h:number):V3=>[x+Math.sin(a)*rr,h,z+Math.cos(a)*rr];
    for(let i=0;i<sides;i++){
      const a=gap+(Math.PI*2-gap*2)*i/sides,c=gap+(Math.PI*2-gap*2)*(i+1)/sides;
      m.quad(p(a,outer,low),p(c,outer,low),p(a,outer,high),p(c,outer,high),mat);
      m.quad(p(c,inner,low),p(a,inner,low),p(c,inner,high),p(a,inner,high),mat);
      m.quad(p(a,outer,high),p(c,outer,high),p(a,inner,high),p(c,inner,high),mat);
      for(const t of i===0?[a]:i===sides-1?[c]:[])m.quad(p(t,inner,low),p(t,outer,low),p(t,inner,high),p(t,outer,high),mat);
    }
  };
  // Add repeated galleries instead of stretching four rooms and their art.
  // The southern aperture stays at the original feet/interaction coordinate.
  const floors=14,base=.10,step=.74/floors;
  const levels=Array.from({length:floors+1},(_,i)=>base+i*step);
  openBand(b,y(.014),W*.325,W*.27,stone,.43);
  openBand(y(.014),y(base),r,r*.82,stone);
  m.cylinder(x,z,y(base),y(.85),r,r,stone,sides);
  openBand(y(.014),y(.020),r*1.11,r*.96,gold);
  for(const [i,v] of levels.entries()){
    m.ring(x,z,y(v),y(v+.0045),r*(i%3===0?1.11:1.045),r*.96,gold,sides);
    m.ring(x,z,y(v+.0045),y(v+.008),r*1.04,r*.96,stone,sides);
  }
  const path:readonly (readonly [number,number])[]=[[-.5,0],[.5,0],[.5,.65],[.34,.84],[0,1],[-.34,.84],[-.5,.65]];
  const lancet=(a:number,base:number,h:number,w:number,portal=false)=>{
    const nx=Math.sin(a),nz=Math.cos(a),rx=nz,rz=-nx;
    const radius=r+(portal?W*.012:W*.004),cx=x+nx*radius,cz=z+nz*radius;
    const p=(u:number,v:number,out=0):V3=>[cx+u*w*rx+nx*out,y(base)+v*h,cz+u*w*rz+nz*out];
    const source:Patch=portal?[.435,.768,.565,.89]:[.370,.524,.435,.616];
    for(let i=1;i<path.length-1;i++)m.triangle(p(...path[0]),p(...path[i]),p(...path[i+1]),portal?dark:violet);
    if(!emission){
      const uv=(u:number,v:number):readonly [number,number]=>[shape.left+(source[0]+(u+.5)*(source[2]-source[0]))*W,1-shape.top-(source[3]-v*(source[3]-source[1]))*H];
      for(let i=1;i<path.length-1;i++)m.triangle(p(...path[0],W*.002),p(...path[i],W*.002),p(...path[i+1],W*.002),source,undefined,undefined,[uv(...path[0]),uv(...path[i]),uv(...path[i+1])]);
    }
    for(let i=0;i<path.length;i++)m.beam(p(...path[i],W*.012),p(...path[(i+1)%path.length],W*.012),W*(portal?.013:.007),portal?gold:stone,6);
    if(!portal)m.beam(p(0,.04,W*.008),p(0,.77,W*.008),W*.003,gold,4);
  };
  for(let i=0;i<8;i++){
    const a=i/8*Math.PI*2,nx=Math.sin(a),nz=Math.cos(a),px=x+nx*r*1.025,pz=z+nz*r*1.025;
    // Pilasters and buttresses follow the cylinder instead of forming a box.
    m.cylinder(px,pz,i===0?y(base):b,y(.85),W*.019,W*.016,stone,8);
    for(const v of levels)m.cylinder(px,pz,y(v),y(v+.007),W*.027,W*.024,gold,8);
    const wx=x+nx*r*.99,wz=z+nz*r*.99;
    m.cylinder(wx,wz,y(.83),y(.89),W*.035,W*.035,stone,8);
    m.cylinder(wx,wz,y(.89),y(.905),W*.044,0,gold,8);
    for(const v of levels.slice(0,-1))lancet(a+Math.PI/8,v+.014,H*.030,W*.065);
    for(const level of [.17,.33,.49,.65,.79]){
      const rx=nz,rz=-nx,rr=r*1.14,cy=y(level),ww=W*.060,hh=H*.050;
      const point=(u:number,v:number):V3=>[x+nx*rr+rx*u*ww,cy+v*hh,z+nz*rr+rz*u*ww];
      if(!emission)m.cutout(point(-.5,0),point(.5,0),point(-.5,1),point(.5,1),[.475,.485,.525,.62]);
      for(const u of [-.58,.58])m.beam(point(u,0),point(u,1),W*.004,gold,4);
    }
  }
  // Open ring with regularly spaced merlons, not a generic flat crown.
  m.ring(x,z,y(.835),y(.855),r*1.06,r*.87,stone,sides);
  for(let i=0;i<24;i++){
    const a=i/24*Math.PI*2,xx=x+Math.sin(a)*r*.975,zz=z+Math.cos(a)*r*.975;
    m.cylinder(xx,zz,y(.852),y(.870),W*.020,W*.020,stone,6);
  }
  lancet(0,.003,H*.080,W*.22,true);
  // Stair top meets the portal at foot height; the interaction target remains
  // in front of all collision. No visual stair is used as a physics ramp.
  for(let i=0;i<4;i++)m.box(x-W*(.14+i*.014),x+W*(.14+i*.014),b-H*.0015,y(.003*(4-i)/4),z+r+W*.005,z+r+W*(.035+i*.030),stone);
  for(const side of [-1,1]){
    const px=x+side*W*.165,pz=z+r*.87;
    m.cylinder(px,pz,b,y(.085),W*.025,W*.022,stone,8);
    m.cylinder(px,pz,y(.085),y(.094),W*.034,0,gold,8);
    if(!emission)m.cutout([px-W*.026,y(.020),pz+W*.025],[px+W*.026,y(.020),pz+W*.025],[px-W*.026,y(.077),pz+W*.025],[px+W*.026,y(.077),pz+W*.025],[.345,.756,.402,.851]);
  }
  return m.finish();
}
