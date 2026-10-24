import {CatmullRomCurve3,Vector3,type BufferGeometry} from 'three';
import {ModelMesh,paintedMaterial,pigment,type ModelMaterial,type Patch,type V3} from './ModelMesh';
import {LIFE_TREE_LIGHTS} from './LifeTreeDesign';
import type {FurnitureShape} from './FurnitureGeometry';

/** A rooted, branching tree, rather than two inflated copies of its painting.
 * Its source supplies bark, individual bough textures and the green/gold/teal
 * palette. All sides have their own geometry, including rear roots/branches.
 * One bounded prefab uses the existing atlas, batch, shadows and light pass. */
let cachedKey='';
const cached=new Map<boolean,BufferGeometry>();
export function releaseLifeTreeGeometry(){for(const geometry of cached.values())geometry.dispose();cached.clear();cachedKey='';}
export function createLifeTreeGeometry(shape:FurnitureShape,emission=false){
  const key=[shape.left,shape.top,shape.width,shape.height,shape.rise,...(shape.sourceRegion??[])].join(':');
  if(key!==cachedKey){releaseLifeTreeGeometry();cachedKey=key;}
  let geometry=cached.get(emission);
  if(!geometry){geometry=buildLifeTreeGeometry(shape,emission);cached.set(emission,geometry);}
  // Exactly one normal and one emission survey. Batch retirement can dispose
  // its copy without invalidating the tree's shared source or another pass.
  return geometry.clone();
}
function buildLifeTreeGeometry(shape:FurnitureShape,emission:boolean){
  const m=new ModelMesh(shape,emission),H=shape.rise,r=shape.sourceRegion??[0,0,1,1];
  const crop=(p:Patch):Patch=>[(p[0]-r[0])/r[2],(p[1]-r[1])/r[3],(p[2]-r[0])/r[2],(p[3]-r[1])/r[3]];
  const bark=paintedMaterial(crop([.477,.315,.493,.368]),.045,.15);
  const rootBark=paintedMaterial(crop([.477,.315,.493,.368]),.065,.16);
  const leafPatches:Patch[]=[[.119,.357,.165,.391],[.405,.151,.445,.185],[.57,.22,.61,.25],[.68,.235,.71,.265]];
  const foliage=leafPatches.map(p=>paintedMaterial(crop(p),.095,.085));
  const gold:ModelMaterial={color:pigment(0xbca15c)},goldLight:ModelMaterial={color:pigment(0xe5c983)};
  const jewel:ModelMaterial={color:pigment(0x48cfc6),emission:pigment(0x4cfff0)};
  const heart:ModelMaterial={color:pigment(0xc6fff2),emission:pigment(0xb4ffe9)};
  const v=(p:V3)=>new Vector3(p[0],p[1]*H,p[2]);
  const tube=(points:readonly V3[],radii:readonly number[],mat:ModelMaterial,sides=10)=>{
    const curve=new CatmullRomCurve3(points.map(v)),steps=(points.length-1)*4;
    const rings:V3[][]=[],normals:V3[][]=[];
    for(let j=0;j<=steps;j++){
      const t=j/steps,p=curve.getPoint(t),tangent=curve.getTangent(t).normalize();
      const u=new Vector3().crossVectors(tangent,Math.abs(tangent.y)<.92?new Vector3(0,1,0):new Vector3(0,0,1)).normalize();
      const w=new Vector3().crossVectors(u,tangent).normalize(),at=t*(radii.length-1),i=Math.min(radii.length-2,Math.floor(at));
      const radius=radii[i]+(radii[i+1]-radii[i])*(at-i),ring:V3[]=[],ns:V3[]=[];
      for(let k=0;k<sides;k++){
        const a=k/sides*Math.PI*2,flute=1+.09*Math.sin(a*5+t*9);
        const n=u.clone().multiplyScalar(Math.cos(a)).addScaledVector(w,Math.sin(a));
        ring.push([p.x+n.x*radius*flute,p.y+n.y*radius*flute,p.z+n.z*radius*flute]);ns.push([n.x,n.y,n.z]);
      }
      rings.push(ring);normals.push(ns);
    }
    for(let j=1;j<=steps;j++)for(let k=0;k<sides;k++){
      const q=(k+1)%sides,a=rings[j-1][k],b=rings[j-1][q],c=rings[j][k],d=rings[j][q];
      const u=k/sides*2,du=2/sides,y=(j-1)/steps*2,dy=2/steps;
      m.triangle(a,b,c,mat,[[y,u],[y,u+du],[y+dy,u]],[normals[j-1][k],normals[j-1][q],normals[j][k]]);
      m.triangle(b,d,c,mat,[[y,u+du],[y+dy,u+du],[y+dy,u]],[normals[j-1][q],normals[j][q],normals[j][k]]);
    }
    for(const end of [0,steps])for(let k=0;k<sides;k++){
      const p=curve.getPoint(end/steps),q=(k+1)%sides;
      m.triangle([p.x,p.y,p.z],rings[end][end===0?q:k],rings[end][end===0?k:q],mat);
    }
  };
  // A gently twisting main trunk and secondary stem follow the original fork.
  tube([[0,.015,0],[-.025,.19,.008],[.012,.37,-.014],[-.035,.55,-.018],[-.075,.73,-.035]], [.12,.084,.076,.055,.018],bark,16);
  tube([[.05,.015,.015],[.075,.20,.035],[.025,.38,.025],[.11,.54,.005],[.18,.68,-.025]], [.075,.058,.045,.030,.009],rootBark,12);
  // Curled buttress roots spread around the trunk, without vertical skirt cards.
  for(let i=0;i<9;i++){
    const a=i/9*Math.PI*2+.13,dx=Math.cos(a),dz=Math.sin(a),reach=.31+(i%3)*.037;
    tube([[dx*.045,.20,dz*.045],[dx*.10,.095,dz*.12],[dx*.21,.035,dz*.22],[dx*reach,.009,dz*reach]], [.048,.041,.023,.003],rootBark,10);
    if(i%2===0)tube([[dx*.18,.04,dz*.18],[dx*.27-dz*.035,.018,dz*.27+dx*.035],[dx*.38-dz*.06,.005,dz*.38+dx*.06]], [.020,.012,.001],bark,8);
  }
  const branches:readonly (readonly V3[])[]=[
    [[0,.31,0],[-.13,.43,.02],[-.28,.51,.01],[-.39,.62,.025]],
    [[-.04,.43,0],[-.19,.55,-.06],[-.25,.68,-.08],[-.31,.74,-.09]],
    [[-.06,.58,-.025],[-.14,.69,-.03],[-.12,.80,-.04]],
    [[.02,.36,.015],[.17,.45,.015],[.31,.55,.02],[.40,.64,.025]],
    [[.07,.46,0],[.18,.57,-.02],[.22,.73,-.04],[.30,.79,-.045]],
    [[0,.36,-.04],[-.025,.49,-.20],[-.13,.61,-.30],[-.22,.69,-.34]],
    [[.02,.45,-.035],[.14,.58,-.21],[.18,.72,-.30]],
    [[-.015,.46,.04],[-.15,.56,.20],[-.22,.69,.28]],
    [[.02,.48,.03],[.13,.61,.18],[.15,.76,.28]],
  ];
  for(const [i,path] of branches.entries()){
    tube(path,path.length===4?[.052,.039,.024,.005]:[.036,.023,.004],i%2?rootBark:bark,10);
    const p=path[path.length-2],tip=path[path.length-1];
    tube([p,[(p[0]+tip[0])/2+.04,(p[1]+tip[1])/2+.025,(p[2]+tip[2])/2+.04],[tip[0]+.055,tip[1]+.06,tip[2]+.06]],[.015,.009,.001],bark,8);
  }
  // Overlapping rounded boughs, individually textured with the painted leaves.
  // Broad smooth lobes preserve the lush silhouette; no needle-like depth grid.
  const crowns:readonly (readonly [number,number,number,number,number,number])[]=[
    [-.36,.65,.01,.17,.15,.18],[-.23,.76,-.07,.19,.16,.19],[-.08,.86,-.04,.20,.16,.20],
    [.13,.82,-.03,.19,.15,.19],[.31,.72,.01,.18,.15,.19],[.40,.59,.025,.12,.13,.15],[-.43,.56,.025,.10,.12,.14],
    [-.21,.65,-.28,.20,.16,.15],[.025,.78,-.29,.21,.16,.17],[.22,.67,-.27,.18,.15,.18],
    [-.22,.68,.24,.17,.14,.15],[.015,.76,.23,.18,.14,.18],[.22,.68,.24,.17,.15,.15],
  ];
  const mound=(cx:number,cy:number,cz:number,rx:number,ry:number,rz:number,seed:number)=>{
    const rows=6,sides=12,mat=foliage[seed%foliage.length];
    const point=(j:number,k:number):{p:V3;n:V3}=>{
      const phi=j/rows*Math.PI,a=k/sides*Math.PI*2,s=Math.sin(phi),c=Math.cos(phi);
      const ripple=1+.035*Math.sin(a*5+seed)*s+.025*Math.cos(phi*5+a*3);
      const nx=s*Math.cos(a)/rx,ny=c/(ry*H),nz=s*Math.sin(a)/rz,len=Math.hypot(nx,ny,nz);
      return {p:[cx+rx*s*Math.cos(a)*ripple,(cy+ry*c*ripple)*H,cz+rz*s*Math.sin(a)*ripple],n:[nx/len,ny/len,nz/len]};
    };
    for(let j=0;j<rows;j++)for(let k=0;k<sides;k++){
      const a=point(j,k),b=point(j,k+1),c=point(j+1,k),d=point(j+1,k+1);
      // Continuous cylindrical UVs avoid different patches on adjacent faces.
      const u=k/sides*3,y=j/rows*2,du=3/sides,dy=2/rows;
      if(j>0)m.triangle(a.p,c.p,b.p,mat,[[u,y],[u,y+dy],[u+du,y]],[a.n,c.n,b.n]);
      if(j<rows-1)m.triangle(b.p,c.p,d.p,mat,[[u+du,y],[u,y+dy],[u+du,y+dy]],[b.n,c.n,d.n]);
    }
  };
  const spray=(origin:Vector3,out:Vector3,seed:number)=>{
    const side=new Vector3().crossVectors(out,new Vector3(0,1,0)).normalize();
    const along=new Vector3().crossVectors(side,out).normalize();
    for(let leaf=0;leaf<7;leaf++){
      const a=(leaf/7+seed*.17)*Math.PI*2,reach=.027+(leaf%3)*.004;
      const axis=side.clone().multiplyScalar(Math.cos(a)).addScaledVector(along,Math.sin(a));
      const cross=new Vector3().crossVectors(axis,out).normalize();
      const base=origin.clone().addScaledVector(axis,.006),tip=origin.clone().addScaledVector(axis,reach).addScaledVector(out,.008);
      const mid=base.clone().lerp(tip,.52),ridge=mid.clone().addScaledVector(out,.003);
      const l=mid.clone().addScaledVector(cross,.008),r=mid.clone().addScaledVector(cross,-.008);
      const p=(v:Vector3):V3=>[v.x,v.y,v.z],mat=foliage[(seed+leaf)%foliage.length];
      m.triangle(p(base),p(l),p(ridge),mat);m.triangle(p(l),p(tip),p(ridge),mat);
      m.triangle(p(tip),p(r),p(ridge),mat);m.triangle(p(r),p(base),p(ridge),mat);
    }
  };
  for(const [i,c] of crowns.entries()){
    mound(...c,i);
    // Physical leaf sprays break the rounded bough rim from every direction.
    // They stay world-facing; no foliage billboard or frame-time geometry.
    for(let q=0;q<12;q++){
      const a=(q/12+i*.13)*Math.PI*2,up=.22+Math.sin(q*2.4)*.34;
      const out=new Vector3(Math.cos(a),up,Math.sin(a)).normalize();
      spray(new Vector3(c[0]+out.x*c[3]*.96,(c[1]+out.y*c[4])*H,c[2]+out.z*c[5]*.96),out,i+q);
    }
    // Smaller boughs overlap the crown edges rather than making one green ball.
    for(let q=0;q<3;q++){
      const a=(q/3+i*.37)*Math.PI*2;
      mound(c[0]+Math.cos(a)*c[3]*.68,c[1]+.012,c[2]+Math.sin(a)*c[5]*.68,c[3]*.52,c[4]*.60,c[5]*.53,i+q+1);
    }
  }
  // Woven golden veins stay attached to bark and wrap around the actual trunk.
  for(let strand=0;strand<3;strand++){
    const path:V3[]=Array.from({length:20},(_,i)=>{
      const t=i/19,a=t*3.8+strand*Math.PI*2/3,rr=.075-.02*t;
      return [Math.cos(a)*rr-.018*t,.08+t*.52,Math.sin(a)*rr] as V3;
    });
    tube(path,Array(path.length).fill(.0045),gold,6);
  }
  const diamond=(cx:number,cy:number,cz:number,w:number,h:number,d:number,mat:ModelMaterial)=>{
    const p:V3[]=[[cx,cy+h,cz],[cx+w,cy,cz],[cx,cy-h,cz],[cx-w,cy,cz]],front:V3=[cx,cy,cz+d],back:V3=[cx,cy,cz-d];
    for(let i=0;i<4;i++){m.triangle(front,p[(i+1)%4],p[i],mat);m.triangle(back,p[i],p[(i+1)%4],mat);}
  };
  for(const [i,[x,y,z]] of LIFE_TREE_LIGHTS.entries()){
    const h=(i<5?.038:.045)*H;
    if(i<5){m.beam([x,(y+.115)*H,z],[x,(y+.045)*H,z],.0025,gold,6);}
    diamond(x,y*H,z,.018,h,.012,goldLight);
    diamond(x,y*H,z,.012,h*.70,.025,jewel);
    diamond(x,y*H,z,.005,h*.40,.027,heart);
    if(i<5){m.beam([x,y*H-h,z],[x,y*H-h-.018*H,z],.0035,gold,6);}
  }
  return m.finish();
}
