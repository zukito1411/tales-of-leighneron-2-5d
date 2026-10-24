import {BufferGeometry,BufferAttribute,Float32BufferAttribute} from 'three';
import data from './sourceVolumes.json';
import type {FurnitureShape} from './FurnitureGeometry';

/** Tree of Life volume fitted to its approved painted silhouette. Prepared
 * indexed buffers are created per shared prefab; no runtime pixel scans. */
export function createSourceVolumeGeometry(shape:FurnitureShape,_emission=false){
  const grid=data.lifeTree;
  const n=grid.size,count=n*n*2,r=shape.sourceRegion??[0,0,1,1];
  const positions=new Float32Array(count*3),normals=new Float32Array(count*3),uv=new Float32Array(count*2);
  const raw=(x:number,y:number)=>grid.depth[y*n+x]/4096;
  for(let side=0;side<2;side++)for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const index=side*n*n+y*n+x,sign=side?1:-1,u=x/(n-1),v=y/(n-1),d=raw(x,y)*sign;
    const i=index*3;
    positions[i]=(u-r[0])/r[2]-.5;
    positions[i+1]=(.965-v)/r[2];
    positions[i+2]=d;
    const gx=(raw(Math.min(n-1,x+1),y)-raw(Math.max(0,x-1),y))*(n-1)*.5;
    const gy=(raw(x,Math.min(n-1,y+1))-raw(x,Math.max(0,y-1)))*(n-1)*.5;
    const nx=-gx,ny=gy,nz=sign,len=Math.hypot(nx,ny,nz)||1;
    normals[i]=nx/len;normals[i+1]=ny/len;normals[i+2]=nz/len;
    uv[index*2]=shape.left+(u-r[0])/r[2]*shape.width;
    uv[index*2+1]=1-shape.top-(v-r[1])/r[3]*shape.height;
  }
  const indices:number[]=[];
  for(let y=0;y<n-1;y++)for(let x=0;x<n-1;x++){
    const a=y*n+x,b=a+1,c=a+n,d=c+1;
    if(!(grid.depth[a]||grid.depth[b]||grid.depth[c]||grid.depth[d]))continue;
    for(let side=0;side<2;side++){
      const o=side*n*n;
      if(side)indices.push(o+a,o+c,o+b,o+b,o+c,o+d);
      else indices.push(o+a,o+b,o+c,o+b,o+d,o+c);
    }
  }
  const geometry=new BufferGeometry();geometry.setIndex(indices);
  geometry.setAttribute('position',new BufferAttribute(positions,3));geometry.setAttribute('normal',new BufferAttribute(normals,3));
  geometry.setAttribute('uv',new BufferAttribute(uv,2));
  geometry.setAttribute('surfaceRect',new Float32BufferAttribute(new Float32Array(count*4),4));
  geometry.setAttribute('surfaceUV',new Float32BufferAttribute(new Float32Array(count*2),2));
  geometry.setAttribute('cutoutPivot',new Float32BufferAttribute(new Float32Array(count*4),4));
  return geometry;
}
