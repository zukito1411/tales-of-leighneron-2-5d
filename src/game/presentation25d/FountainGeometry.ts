import {ModelMesh,atlasMaterial,paintedMaterial,pigment,brass,metal,type ModelMaterial,type Patch,type V3} from './ModelMesh';
import type {FurnitureShape} from './FurnitureGeometry';

/** Basins, spouts and ornaments follow the civic/Elven reference art. These
 * share the existing prop batch; water uses its existing visual-time uniform. */
export function createFountainGeometry(shape:FurnitureShape,emission=false){
  const m=new ModelMesh(shape,emission),H=shape.rise,D=shape.depth;
  const stone=shape.stonePatch?paintedMaterial(shape.stonePatch,.22,.16):atlasMaterial('architecture',8,.22,.16);
  const wood=atlasMaterial('furnishings',0,.42,.20);
  const pool:ModelMaterial={color:pigment(0x277f9b),pattern:8,waterOrigin:shape.kit.startsWith('world:')?[-.30,-D+.26]:[0,-D/2]};
  const stream:ModelMaterial={color:pigment(0x79d9ed),pattern:9};
  const dark:ModelMaterial={color:pigment(0x183b43)};
  const box=(l:number,r:number,b:number,t:number,back:number,front:number,mat:ModelMaterial=stone,bevel=.008)=>m.softBox(l,r,b,t,back,front,mat,bevel);
  if(shape.kit.startsWith('world:')){
    const low=H*.09,water=H*.30,rim=H*.40;
    // A real inset water trough. Individual rounded end blocks and broad wood
    // boards replace tall plain boxes; the rim remains below the pump mouth.
    box(-.49,.49,0,H*.065,-D-.015,.015,stone,.012);
    box(-.39,.39,H*.06,low,-D+.025,-.025,dark);
    for(const z of [-D,0]){
      for(let row=0;row<3;row++)box(-.40,.40,low+row*(rim-low)/3+.002,low+(row+1)*(rim-low)/3-.002,z-.018,z+.018,wood,.004);
      box(-.43,.43,rim-.008,rim+.014,z-.027,z+.027,wood,.006);
    }
    for(const side of [-1,1])for(let row=0;row<3;row++){
      const l=side<0?-.49:.39,r=side<0?-.39:.49;
      box(l,r,H*.065+row*(rim-H*.065)/3+.002,H*.065+(row+1)*(rim-H*.065)/3-.002,-D-.014,.014,stone,.009);
    }
    for(const x of [-.38,.38])for(const z of [-D-.024,.024]){
      box(x-.018,x+.018,H*.065,rim+.02,z-.005,z+.005,metal,.003);
      for(const y of [H*.15,H*.33])m.beam([x,y,z-.006],[x,y,z+.006],.007,brass,8);
    }
    m.floor([[-.385,-D+.035],[.385,-D+.035],[.385,-.035],[-.385,-.035]],water,pool);
    // Joined timber post and a hollow-ended wooden spout, as in others.png.
    const px=-.30,pz=-D+.05,mouth=H*.76;
    box(px-.052,px+.052,0,H*.97,pz-.055,pz+.055,wood,.013);
    box(px-.050,px+.050,mouth-.045,mouth+.045,pz+.02,pz+.19,wood,.012);
    box(px-.031,px+.031,mouth-.030,mouth+.028,pz+.190,pz+.194,dark,.006);
    const end=pz+.21;
    m.beam([px,mouth,pz+.194],[px,mouth-.015,end],.011,stream,10);
    m.cylinder(px,end,water+.004,mouth-.015,.011,.011,stream,10);
    // Small wet collar at the landing point, not a blue cone or solid pillar.
    m.ring(px,end,water+.001,water+.002,.027,.017,stream,20);
    if(!emission&&shape.kit==='world:others:10'){
      // Retain delicate flowers/grass from the source at the two stone feet.
      const skirt=(l:number,r:number,source:Patch)=>m.cutout([l,.002,.055],[r,.002,.055],[l,.002,-D*.85],[r,.002,-D*.85],source);
      skirt(-.57,-.43,[0,.58,.16,.99]);skirt(.43,.57,[.84,.58,1,.99]);
    }
  }else{
    const r=Math.min(.43,D*.46),z=-D/2;
    const pale=atlasMaterial('architecture',8,.20,.14);
    const gilded:ModelMaterial={color:pigment(0xb49b59),pattern:7};
    const vein:ModelMaterial={color:pigment(0xe4d2a0)};
    m.cylinder(0,z,0,H*.06,r*1.08,r*1.08,pale,32);
    m.ring(0,z,H*.06,H*.13,r*1.04,r*.79,pale,32);
    m.ring(0,z,H*.13,H*.31,r,r*.82,pale,32);
    m.ring(0,z,H*.125,H*.15,r*1.015,r*.96,gilded,32);
    m.ring(0,z,H*.305,H*.35,r*1.055,r*.79,pale,32);
    m.ring(0,z,H*.335,H*.352,r*1.055,r*.98,gilded,32);
    m.cylinder(0,z,H*.282,H*.286,r*.79,r*.79,pool,32);
    const leaf=(x:number,y:number,zz:number,w:number,h:number)=>{
      const points:readonly (readonly [number,number])[]=[[x,y],[x-w*.50,y+h*.35],[x-w*.38,y+h*.72],[x,y+h],[x+w*.38,y+h*.72],[x+w*.50,y+h*.35]];
      m.extrude(points,zz+.008,zz-.008,gilded);
      for(const face of [-1,1]){
        const z=zz+face*.010;
        m.beam([x,y+h*.06,z],[x,y+h*.90,z],.003,vein,6);
        for(const at of [.27,.45,.63])for(const side of [-1,1])
          m.beam([x,y+h*at,z],[x+side*w*.28,y+h*(at+.14),z],.002,vein,6);
      }
    };
    // The tall leafy backrest belongs to the rim, not a central water needle.
    leaf(0,H*.34,z-r*.82,r*.70,H*.62);
    for(const a of [0,Math.PI])leaf(0,H*.10,z+Math.cos(a)*r*1.01,r*.45,H*.30);
    const crystal=(x:number,y:number,zz:number)=>{
      const w=.030,h=H*.075,tip:V3=[x,y+h,zz],base:V3=[x,y-h*.65,zz];
      const edge:V3[]=[[x-w,y,zz],[x,y,zz+w*.7],[x+w,y,zz],[x,y,zz-w*.7]];
      for(let i=0;i<4;i++){m.triangle(tip,edge[i],edge[(i+1)%4],{color:pigment(0x61d5df)});m.triangle(base,edge[(i+1)%4],edge[i],{color:pigment(0x61d5df)});}
    };
    for(let i=0;i<4;i++){
      const a=(i+.5)/4*Math.PI*2,x=Math.sin(a)*r*.96,zz=z+Math.cos(a)*r*.96;
      m.cylinder(x,zz,H*.17,H*.42,.037,.027,gilded,12);
      m.ring(x,zz,H*.40,H*.43,.038,.024,pale,12);
      crystal(x,H*.505,zz);
      // Four fine curved streams fall into the basin and share the small
      // water-material animation, with no particles or per-frame allocations.
      const point=(t:number):V3=>[x*(1-t),H*(.47*(1-t)+.286*t)+Math.sin(t*Math.PI)*H*.095,z+(zz-z)*(1-t)];
      for(let j=0;j<8;j++)m.beam(point(j/8),point((j+1)/8),.0045,stream,6);
    }
    if(!emission)for(const [side,source] of [[-1,[0,.58,.25,1]],[1,[.75,.58,1,1]]] as const){
      const x=side*r*.88,w=r*.62;
      m.cutout([x-w/2,0,z+r*.45],[x+w/2,0,z+r*.45],[x-w/2,H*.28,z+r*.45],[x+w/2,H*.28,z+r*.45],source);
    }
  }
  return m.finish();
}
