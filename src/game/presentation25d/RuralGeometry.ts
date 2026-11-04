import {ModelMesh,atlasMaterial,regionalWood,metal,pigment,type ModelMaterial} from './ModelMesh';
import type {FurnitureShape} from './FurnitureGeometry';

/** Cached meshes reuse the painted structural materials and existing batches.
 * No particle systems, lights, per-frame CPU animation or new texture loads. */
export function createRuralFitting(m:ModelMesh,shape:FurnitureShape,emission:boolean){
 if(shape.art!=='windmill'&&shape.art!=='waterfall')return false;
 if(emission)return true;
 const H=shape.rise,D=shape.depth,wood=regionalWood(shape.kit),z=-D/2;
 if(shape.art==='windmill'){
  const stone=atlasMaterial('architecture',8,.22,.26),roof=atlasMaterial('architecture',4,.23,.23);
  const linen=atlasMaterial('furnishings',4,.18,.24),dark=atlasMaterial('architecture',1,.20,.30);
  m.cylinder(0,z,0,H*.68,.33,.24,stone,16);
  m.ring(0,z,H*.12,H*.14,.325,.30,stone,16);
  m.cylinder(0,z,H*.68,H*.76,.26,.26,wood,12);
  m.cylinder(0,z,H*.76,H*.94,.34,0,roof,12);
  // Door, lintel, hinges and gallery sit on the tower, below the sail sweep.
  m.box(-.085,.085,0,H*.24,z+.245,z+.29,dark);
  for(const x of [-.09,.09])m.box(x-.012,x+.012,0,H*.25,z+.28,z+.30,wood);
  m.box(-.10,.10,H*.24,H*.26,z+.28,z+.30,wood);
  m.box(.045,.063,H*.10,H*.12,z+.30,z+.31,metal);
  for(const x of [-.14,.14])m.box(x-.035,x+.035,H*.44,H*.51,z+.22,z+.25,dark);
  const hub=H*.71,front=z+.36;
  m.beam([0,hub,z+.16],[0,hub,front+.03],.043,metal,12);
  for(let blade=0;blade<4;blade++){
   const a=Math.PI/4+blade*Math.PI/2,c=Math.cos(a),s=Math.sin(a);
   const p=(u:number,v:number,depth=front):readonly [number,number,number]=>[u*c-v*s,hub+u*s+v*c,depth];
   m.beam(p(.04,0),p(.86,0),.018,wood,6);
   for(const u of [.26,.40,.54,.68,.82])m.beam(p(u,-.015),p(u,.17),.008,wood,4);
   m.beam(p(.24,.17),p(.84,.17),.009,wood,4);
   m.quad(p(.25,.025,front+.007),p(.83,.025,front+.007),p(.25,.15,front+.007),p(.83,.15,front+.007),linen);
   m.quad(p(.83,.025,front-.007),p(.25,.025,front-.007),p(.83,.15,front-.007),p(.25,.15,front-.007),linen);
  }
  m.beam([0,hub,front-.02],[0,hub,front+.06],.065,wood,12);
 }else{
  const rock=atlasMaterial('nature',8,.45,.5),moss=atlasMaterial('nature',12,.35,.4);
  const stream:ModelMaterial={color:pigment(0x7faeb8),pattern:9};
  const pool:ModelMaterial={color:pigment(0x386c70),pattern:8,waterOrigin:[0,-D*.18]};
  // Subdivide on the identical 64-unit terrain lattice. Each diagonal has
  // the same split as TerrainHeightField, so no water sheet cuts through rock.
  const heights=shape.cascadeHeights;if(!heights)return true;
  const rows=heights.length/5;
  const point=(row:number,col:number):readonly [number,number,number]=>[-.5+col/4,heights[row*5+col],-D+row/4];
  for(let row=0;row<rows-1;row++)for(let col=0;col<4;col++){
   const a=point(row,col),b=point(row,col+1),c=point(row+1,col),d=point(row+1,col+1);
   m.triangle(a,c,b,stream);m.triangle(b,c,d,stream);
   // Rock/moss banks only flank the stream; they never fill its water surface.
   if(col===0||col===3){
    const side=col===0?0:4,p=point(row,side),q=point(row+1,side),sign=col===0?-1:1;
    m.quad(p,q,[p[0]+sign*.10,p[1]+.035,p[2]],[q[0]+sign*.10,q[1]+.035,q[2]],row%3?moss:rock);
   }
  }
  // A shallow spring cup at the top and receiving pool at the foot share
  // the existing GPU water clock, with no emitter or independent update loop.
  for(const row of [0,rows-1]){
   const y=heights[row*5+2]+.006,z=-D+row/4;
   m.quad([-.42,y,z+.04],[.42,y,z+.04],[-.42,y,z-.04],[.42,y,z-.04],pool);
  }
 }
 return true;
}
