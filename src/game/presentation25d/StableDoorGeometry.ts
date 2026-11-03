import {ModelMesh,atlasMaterial,type ModelMaterial,type V3} from './ModelMesh';
import {STABLE_ENTRANCE} from '../../data/stableEntrance';

/** The same plank leaves, braces, hinge straps and ring pulls on both sides
 * of a stable transition. Interior leaves park outside the clear cart opening. */
export function addStableDoor(m:ModelMesh,left:number,right:number,bottom:number,height:number,front:number,depth:number,open:boolean){
 const width=right-left,half=width/2;
 const wood=atlasMaterial('architecture',1,width*.46,height*.85);
 const trim=atlasMaterial('furnishings',2,width*.30,height*.9);
 const iron=atlasMaterial('furnishings',3,width*.16,width*.16);
 const post=width*(STABLE_ENTRANCE.outerHalf-STABLE_ENTRANCE.clearRatio/2)/STABLE_ENTRANCE.clearRatio;
 for(const x of [left-post,right])m.box(x,x+post,bottom,bottom+height,-depth+front,front,trim);
 m.box(left-post,right+post,bottom+height,bottom+height/STABLE_ENTRANCE.clearHeightRatio,front-depth,front,trim);
 for(const side of [-1,1]){
  // Local u starts at the hinge. Opening folds each complete leaf back
  // along its jamb; no part of either leaf crosses the clear opening.
  const hinge=side<0?left:right,thickness=width*.014;
  const p=(u:number,v:number,out=0):V3=>open
   ?[hinge+side*(post*.55+out),bottom+height*v,front-u*half]
   :[hinge-side*u*half,bottom+height*v,front+out];
  const box=(l:number,r:number,b:number,t:number,back:number,face:number,mat:ModelMaterial)=>{
   const a=p(l,b,back),c=p(r,t,face);
   m.box(Math.min(a[0],c[0]),Math.max(a[0],c[0]),a[1],c[1],Math.min(a[2],c[2]),Math.max(a[2],c[2]),mat);
  };
  box(.008,.992,.015,.985,-thickness,0,wood);
  for(let i=1;i<5;i++)box(i/5-.003,i/5+.003,.02,.98,.0005*width,.0025*width,trim);
  for(const v of [.18,.74]){
   m.beam(p(.025,v,width*.009),p(.975,v,width*.009),width*.009,iron,4);
   for(const u of [.06,.92])box(u-.008,u+.008,v-.008,v+.008,width*.008,width*.02,iron);
  }
  m.beam(p(.06,.22,width*.013),p(.94,.70,width*.013),width*.008,trim,4);
  for(let i=0;i<10;i++){
   const a=i*Math.PI/5,b=(i+1)*Math.PI/5;
   m.beam(p(.86+Math.cos(a)*.04,.43+Math.sin(a)*width*.02/height,width*.03),
    p(.86+Math.cos(b)*.04,.43+Math.sin(b)*width*.02/height,width*.03),width*.003,iron,6);
  }
 }
}
