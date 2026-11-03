import {BufferGeometry} from 'three';

/** Copy the already built topology without copying/rebuilding batch-owned
 * instance attributes. Each geometry still owns independent GPU buffers. */
export function cloneModelTopology(source:BufferGeometry){
 const geometry=new BufferGeometry();
 for(const [name,attribute] of Object.entries(source.attributes)){
  if('isInstancedBufferAttribute' in attribute&&attribute.isInstancedBufferAttribute)continue;
  geometry.setAttribute(name,attribute.clone());
 }
 if(source.index)geometry.setIndex(source.index.clone());
 for(const group of source.groups)geometry.addGroup(group.start,group.count,group.materialIndex);
 geometry.setDrawRange(source.drawRange.start,source.drawRange.count);
 geometry.boundingBox=source.boundingBox?.clone()??null;geometry.boundingSphere=source.boundingSphere?.clone()??null;
 geometry.userData={...source.userData};return geometry;
}

/** Only certify complete, solid triangles. Painted alpha edges, leaves,
 * moving fire, and mixed flags retain their original transparent path. */
export function modelIsOpaque(geometry:BufferGeometry){
 const cached=geometry.userData.certifiedOpaque as boolean|undefined;if(cached!==undefined)return cached;
 const surface=geometry.getAttribute('surfaceRect'),cutout=geometry.getAttribute('cutoutPivot');
 let opaque=Boolean(surface&&surface.count>0);
 if(surface)for(let i=0;opaque&&i<surface.count;i++){
  const z=surface.getZ(i),w=surface.getW(i);
  opaque=!(cutout&&cutout.getW(i)>0)&&(w<0?(w<=-19.5||w>=-18.5):w>0&&z!==0);
 }
 // Shader flags are face-constant in authored ModelMesh output. Refuse any
 // interpolated classification before changing blend/depth render ordering.
 const index=geometry.index,count=index?.count??surface?.count??0;
 if(surface)for(let i=0;opaque&&i<count;i+=3){
  const a=index?index.getX(i):i;
  for(let corner=1;corner<3;corner++){
   const b=index?index.getX(i+corner):i+corner;
   if(surface.getZ(a)!==surface.getZ(b)||surface.getW(a)!==surface.getW(b)){opaque=false;break;}
  }
 }
 geometry.userData.certifiedOpaque=opaque;return opaque;
}
