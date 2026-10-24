import {ModelMesh,paintedMaterial,pigment,type ModelMaterial,type Patch,type V3} from './ModelMesh';
import type {HouseShape} from './HouseGeometry';

/** tower-of-might-v2.png: round masonry, four storeys, purple rune hangings,
 * gold stone collars, lancets and a crenellated crown. Only individual painted
 * ornaments are reused; the complete tower is never a flat front panel. */
export function createMagusTowerGeometry(shape:HouseShape,emission=false){
  const {width:W,height:H,depth:D}=shape,m=new ModelMesh(shape,emission,W);
  const x=shape.left+W*.505-.5,z=-D/2,b=.5-shape.top-H;
  const y=(v:number)=>b+v*H;
  const stone=paintedMaterial([.59,.66,.625,.69],W*.15,H*.045);
  const gold=paintedMaterial([.45,.172,.48,.18],W*.12,H*.025);
  const dark:ModelMaterial={color:pigment(0x191624)},violet:ModelMaterial={color:pigment(0x272039),emission:pigment(0x7563a0)};
  const r=W*.25,sides=32;
  m.cylinder(x,z,b,y(.055),W*.325,W*.30,stone,sides);
  m.cylinder(x,z,y(.055),y(.85),r,r,stone,sides);
  for(const v of [.055,.255,.455,.655,.835]){
    m.ring(x,z,y(v),y(v+.021),r*1.11,r*.96,gold,sides);
    m.ring(x,z,y(v+.021),y(v+.035),r*1.065,r*.96,stone,sides);
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
    m.cylinder(px,pz,b,y(.79),W*.019,W*.016,stone,8);
    for(const v of [.08,.27,.47,.67])m.cylinder(px,pz,y(v),y(v+.027),W*.032,W*.026,gold,8);
    const wx=x+nx*r*.99,wz=z+nz*r*.99;
    m.cylinder(wx,wz,y(.83),y(.95),W*.035,W*.035,stone,8);
    m.cylinder(wx,wz,y(.95),y(.984),W*.044,0,gold,8);
    for(const v of [.09,.29,.49,.69])if(i!==0||v!==.09)lancet(a+Math.PI/8,v,H*.115,W*.072);
    if(i!==0){
      const rx=nz,rz=-nx,rr=r*1.04,cy=y(.49),ww=W*.052,hh=H*.13;
      const point=(u:number,v:number):V3=>[x+nx*rr+rx*u*ww,cy+v*hh,z+nz*rr+rz*u*ww];
      if(!emission)m.cutout(point(-.5,0),point(.5,0),point(-.5,1),point(.5,1),[.475,.485,.525,.62]);
      for(const u of [-.58,.58])m.beam(point(u,0),point(u,1),W*.004,gold,4);
    }
  }
  // Open ring with regularly spaced merlons, not a generic flat crown.
  m.ring(x,z,y(.835),y(.90),r*1.06,r*.87,stone,sides);
  for(let i=0;i<24;i++){
    const a=i/24*Math.PI*2,xx=x+Math.sin(a)*r*.975,zz=z+Math.cos(a)*r*.975;
    m.cylinder(xx,zz,y(.89),y(.934),W*.020,W*.020,stone,6);
  }
  lancet(0,.012,H*.19,W*.22,true);
  // Stair top meets the portal at foot height; the interaction target remains
  // in front of all collision. No visual stair is used as a physics ramp.
  for(let i=0;i<4;i++)m.box(x-W*(.14+i*.014),x+W*(.14+i*.014),b-H*.006,y(.012*(4-i)/4),z+r+W*.005,z+r+W*(.035+i*.030),stone);
  for(const side of [-1,1]){
    const px=x+side*W*.165,pz=z+r*.87;
    m.cylinder(px,pz,b,y(.22),W*.025,W*.022,stone,8);
    m.cylinder(px,pz,y(.22),y(.25),W*.034,0,gold,8);
    if(!emission)m.cutout([px-W*.026,y(.055),pz+W*.025],[px+W*.026,y(.055),pz+W*.025],[px-W*.026,y(.19),pz+W*.025],[px+W*.026,y(.19),pz+W*.025],[.345,.756,.402,.851]);
  }
  return m.finish();
}
