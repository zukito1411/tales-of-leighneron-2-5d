import {BufferGeometry,Color,Float32BufferAttribute,ShapeUtils,Vector2} from 'three';

export type V3=readonly [number,number,number];
export type Patch=readonly [number,number,number,number];
export type ModelMaterial=Patch|{color:V3;emission?:V3;pattern?:2|3|4|5|6|7};
interface Region {left:number;top:number;width:number;height:number}
const colors=new Map<number,V3>();
export function pigment(hex:number):V3 {
  let value=colors.get(hex);if(!value){const c=new Color(hex);value=[c.r,c.g,c.b];colors.set(hex,value);}return value;
}
export const metal:ModelMaterial={color:pigment(0x47505a),pattern:4};
export const brass:ModelMaterial={color:pigment(0xb8944e),pattern:4};
export const glass:ModelMaterial={color:pigment(0x405b66),emission:pigment(0xffd895)};
export const lampGlass:ModelMaterial={color:pigment(0xe7bc78),emission:pigment(0xffd895)};
export const flame:ModelMaterial={color:pigment(0xffc868),emission:pigment(0xffda92)};
export const water:ModelMaterial={color:pigment(0x367c91)};
export function regionalFabric(kit:string):ModelMaterial {
  return {pattern:5,color:pigment(/noble/.test(kit)?0x284878:/elven/.test(kit)?0x386f60:/orcan/.test(kit)?0x824c38:/obsidian/.test(kit)?0x5a385e:/alpine|longhouse/.test(kit)?0x546a7b:/maritime/.test(kit)?0x426d81:0x667447)};
}

export function regionalWood(kit:string):ModelMaterial {
  return {pattern:2,color:pigment(/elven/.test(kit)?0x806a42:/obsidian/.test(kit)?0x55444a:/noble/.test(kit)?0x795537:/alpine|longhouse/.test(kit)?0x786955:/orcan/.test(kit)?0x755343:/maritime/.test(kit)?0x7a6045:0x886542)};
}
export function masonry(kit:string):ModelMaterial {
  return {pattern:3,color:pigment(/obsidian/.test(kit)?0x514d60:/elven/.test(kit)?0xb0ab91:/orcan/.test(kit)?0x8e7961:0x969181)};
}
export function roofMaterial(id:string):ModelMaterial {
  return {pattern:6,color:pigment(/old-cottage|^cottage$/.test(id)?0xa08248:/elven/.test(id)?0x4c7e79:/inn/.test(id)?0x59685b:/chapel|shrine/.test(id)?0x817866:/manor|castle/.test(id)?0x5b6271:0x56636d)};
}

/** One atlas-compatible mesh per existing batch. Every structural face belongs
 * to a closed part. Material swatches are textures, never complete object art.
 * All topology, triangulation and normals are prepared once, outside animation. */
export class ModelMesh {
  private readonly positions:number[]=[];private readonly normals:number[]=[];
  private readonly uvs:number[]=[];private readonly rects:number[]=[];private readonly repeats:number[]=[];
  constructor(private readonly region:Region,private readonly emission=false,private readonly unit=1){}
  triangle(a:V3,b:V3,c:V3,mat:ModelMaterial,uv?:readonly (readonly [number,number])[],smooth?:readonly V3[],artUV?:readonly (readonly [number,number])[]){
    if(this.emission&&(Array.isArray(mat)||!('emission' in mat)||!mat.emission))return;
    const r=this.region;
    let rect:readonly number[],center:readonly [number,number];
    if(artUV){rect=[0,0,0,0];center=[0,0];}
    else if('color' in mat){const rgb=this.emission?mat.emission!:mat.color;rect=[...rgb,this.emission?-1:-(mat.pattern??1)];center=[.5,.5];}
    else{const [l,t,right,bottom]=mat;rect=[r.left+l*r.width,1-r.top-bottom*r.height,(right-l)*r.width,(bottom-t)*r.height];center=[rect[0]+rect[2]/2,rect[1]+rect[3]/2];}
    const x=b[0]-a[0],y=b[1]-a[1],z=b[2]-a[2],u=c[0]-a[0],v=c[1]-a[1],w=c[2]-a[2];
    const nx=y*w-z*v,ny=z*u-x*w,nz=x*v-y*u,length=Math.hypot(nx,ny,nz)||1;
    if(!uv){
      const axis=Math.abs(nx)>Math.abs(ny)&&Math.abs(nx)>Math.abs(nz)?0:Math.abs(ny)>Math.abs(nz)?1:2;
      const px='color' in mat?1:Math.max(.005,(mat[2]-mat[0])*this.unit),py='color' in mat?1:Math.max(.005,(mat[3]-mat[1])*this.region.height/this.region.width*this.unit);
      uv=[a,b,c].map(p=>axis===0?[p[2]/px,p[1]/py]:axis===1?[p[0]/px,p[2]/py]:[p[0]/px,p[1]/py]);
    }
    for(const [i,p] of [a,b,c].entries()){
      this.positions.push(...p);this.normals.push(...(smooth?.[i]??[nx/length,ny/length,nz/length]));
      this.uvs.push(...(artUV?.[i]??center));this.rects.push(...rect);this.repeats.push(...uv[i]);
    }
  }
  quad(a:V3,b:V3,c:V3,d:V3,mat:ModelMaterial){
    const px='color' in mat?1:Math.max(.005,(mat[2]-mat[0])*this.unit);
    const py='color' in mat?1:Math.max(.005,(mat[3]-mat[1])*this.region.height/this.region.width*this.unit);
    const rx=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])/px,ry=Math.hypot(c[0]-a[0],c[1]-a[1],c[2]-a[2])/py;
    this.triangle(a,b,c,mat,[[0,0],[rx,0],[0,ry]]);this.triangle(b,d,c,mat,[[rx,0],[rx,ry],[0,ry]]);
  }
  cutout(a:V3,b:V3,c:V3,d:V3,source:Patch){
    if(this.emission)return;
    const r=this.region,[l,t,right,bottom]=source;
    const uv=(u:number,v:number):readonly [number,number]=>[r.left+u*r.width,1-r.top-v*r.height];
    const aa=uv(l,bottom),bb=uv(right,bottom),cc=uv(l,t),dd=uv(right,t);
    this.triangle(a,b,c,source,undefined,undefined,[aa,bb,cc]);this.triangle(b,d,c,source,undefined,undefined,[bb,dd,cc]);
  }
  box(l:number,r:number,b:number,t:number,back:number,front:number,mat:ModelMaterial){
    this.quad([l,b,front],[r,b,front],[l,t,front],[r,t,front],mat);
    this.quad([r,b,back],[l,b,back],[r,t,back],[l,t,back],mat);
    this.quad([l,b,back],[l,b,front],[l,t,back],[l,t,front],mat);
    this.quad([r,b,front],[r,b,back],[r,t,front],[r,t,back],mat);
    this.quad([l,t,front],[r,t,front],[l,t,back],[r,t,back],mat);
    this.quad([l,b,back],[r,b,back],[l,b,front],[r,b,front],mat);
  }
  softBox(l:number,r:number,b:number,t:number,back:number,front:number,mat:ModelMaterial,bevel=.008){
    const q=Math.min(bevel,(r-l)*.15,(t-b)*.25,(front-back)*.15);
    const ring=(y:number,inset:number):V3[]=>{
      const a=l+inset,c=r-inset,d=back+inset,f=front-inset,k=q*.7;
      return [[a+k,y,d],[c-k,y,d],[c,y,d+k],[c,y,f-k],[c-k,y,f],[a+k,y,f],[a,y,f-k],[a,y,d+k]];
    };
    const rings=[ring(b,q),ring(b+q,0),ring(t-q,0),ring(t,q)];
    for(let row=1;row<rings.length;row++)for(let i=0;i<8;i++){const j=(i+1)%8;this.quad(rings[row-1][j],rings[row-1][i],rings[row][j],rings[row][i],mat);}
    for(let i=0;i<8;i++){const j=(i+1)%8;this.triangle([(l+r)/2,b,(back+front)/2],rings[0][i],rings[0][j],mat);this.triangle([(l+r)/2,t,(back+front)/2],rings[3][j],rings[3][i],mat);}
  }
  beam(a:V3,b:V3,r:number,mat:ModelMaterial,sides=4){
    const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],len=Math.hypot(dx,dy,dz)||1;
    const axis:V3=[dx/len,dy/len,dz/len];
    const rx=Math.abs(axis[1])<.95?-axis[2]:1,ry=0,rz=Math.abs(axis[1])<.95?axis[0]:0,rl=Math.hypot(rx,rz)||1;
    const u:V3=[rx/rl,ry,rz/rl],v:V3=[axis[1]*u[2]-axis[2]*u[1],axis[2]*u[0]-axis[0]*u[2],axis[0]*u[1]-axis[1]*u[0]];
    const p=(origin:V3,i:number):V3=>{const angle=i/sides*Math.PI*2;return [origin[0]+r*(u[0]*Math.cos(angle)+v[0]*Math.sin(angle)),origin[1]+r*(u[1]*Math.cos(angle)+v[1]*Math.sin(angle)),origin[2]+r*(u[2]*Math.cos(angle)+v[2]*Math.sin(angle))];};
    for(let i=0;i<sides;i++){const aa=p(a,i),ab=p(a,i+1),ba=p(b,i),bb=p(b,i+1);this.quad(aa,ab,ba,bb,mat);this.triangle(a,ab,aa,mat);this.triangle(b,ba,bb,mat);}
  }
  cylinder(x:number,z:number,b:number,t:number,r:number,s:number,mat:ModelMaterial,sides=16,caps=true){
    const slope=(r-s)/Math.max(.0001,t-b),length=Math.hypot(1,slope);
    const p=(a:number,y:number,radius:number):V3=>[x+Math.sin(a)*radius,y,z+Math.cos(a)*radius];
    for(let i=0;i<sides;i++){
      const a=i/sides*Math.PI*2,c=(i+1)/sides*Math.PI*2,aa=p(a,b,r),ab=p(c,b,r),ba=p(a,t,s),bb=p(c,t,s);
      const na:V3=[Math.sin(a)/length,slope/length,Math.cos(a)/length],nb:V3=[Math.sin(c)/length,slope/length,Math.cos(c)/length];
      const px='color' in mat?1:Math.max(.005,(mat[2]-mat[0])*this.unit),py='color' in mat?1:Math.max(.005,(mat[3]-mat[1])*this.region.height/this.region.width*this.unit);
      const u=i/sides*Math.PI*2*(r+s)/2/px,v=(t-b)/py,du=Math.PI*2*(r+s)/2/sides/px;
      this.triangle(aa,ab,ba,mat,[[u,0],[u+du,0],[u,v]],[na,nb,na]);this.triangle(ab,bb,ba,mat,[[u+du,0],[u+du,v],[u,v]],[nb,nb,na]);
      if(caps){this.triangle([x,b,z],ab,aa,mat);this.triangle([x,t,z],ba,bb,mat);}
    }
  }
  ring(x:number,z:number,b:number,t:number,r:number,inner:number,mat:ModelMaterial,sides=20){
    const p=(angle:number,radius:number,y:number):V3=>[x+Math.sin(angle)*radius,y,z+Math.cos(angle)*radius];
    for(let i=0;i<sides;i++){
      const a=i/sides*Math.PI*2,c=(i+1)/sides*Math.PI*2;
      this.quad(p(a,r,b),p(c,r,b),p(a,r,t),p(c,r,t),mat);
      this.quad(p(c,inner,b),p(a,inner,b),p(c,inner,t),p(a,inner,t),mat);
      this.quad(p(a,r,t),p(c,r,t),p(a,inner,t),p(c,inner,t),mat);
    }
  }
  extrude(path:readonly (readonly [number,number])[],front:number,back:number,mat:ModelMaterial,edges?:readonly ModelMaterial[]){
    for(const [a,b,c] of ShapeUtils.triangulateShape(path.map(p=>new Vector2(...p)),[])){
      const p=(i:number,z:number):V3=>[path[i][0],path[i][1],z];
      let aa=a,bb=b;const pa=path[a],pb=path[b],pc=path[c];
      if((pb[0]-pa[0])*(pc[1]-pa[1])-(pb[1]-pa[1])*(pc[0]-pa[0])<0)[aa,bb]=[bb,aa];
      this.triangle(p(aa,front),p(bb,front),p(c,front),mat);this.triangle(p(bb,back),p(aa,back),p(c,back),mat);
    }
    // Polygon winding controls outward edge normals independently of caps.
    let area=0;for(let i=0;i<path.length;i++){const a=path[i],b=path[(i+1)%path.length];area+=a[0]*b[1]-b[0]*a[1];}
    for(let i=0;i<path.length;i++){
      const a=path[i],b=path[(i+1)%path.length],aa:V3=[a[0],a[1],front],ab:V3=[b[0],b[1],front],ba:V3=[a[0],a[1],back],bb:V3=[b[0],b[1],back];
      if(area>0)this.quad(ab,aa,bb,ba,edges?.[i]??mat);else this.quad(aa,ab,ba,bb,edges?.[i]??mat);
    }
  }
  floor(path:readonly (readonly [number,number])[],y:number,mat:ModelMaterial,repeat=1){
    for(const [a,b,c] of ShapeUtils.triangulateShape(path.map(p=>new Vector2(...p)),[])){
      const pa=path[a],pb=path[b],pc=path[c],up=(pb[0]-pa[0])*(pc[1]-pa[1])-(pb[1]-pa[1])*(pc[0]-pa[0]);
      const p=(i:number):V3=>[path[i][0],y,path[i][1]];
      const uv=(i:number):readonly [number,number]=>[path[i][0]*repeat,path[i][1]*repeat];
      if(up>0)this.triangle(p(b),p(a),p(c),mat,[uv(b),uv(a),uv(c)]);else this.triangle(p(a),p(b),p(c),mat,[uv(a),uv(b),uv(c)]);
    }
  }
  finish(){
    const geometry=new BufferGeometry();
    geometry.setAttribute('position',new Float32BufferAttribute(this.positions,3));geometry.setAttribute('normal',new Float32BufferAttribute(this.normals,3));
    geometry.setAttribute('uv',new Float32BufferAttribute(this.uvs,2));geometry.setAttribute('surfaceRect',new Float32BufferAttribute(this.rects,4));geometry.setAttribute('surfaceUV',new Float32BufferAttribute(this.repeats,2));return geometry;
  }
}
