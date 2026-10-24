/** Offline authoring: complete rig poses, anatomical material UVs and fitted
 * harness surfaces. No body-part assembly or projected animal face painting. */
import fs from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {AnimationMixer,Box3,Vector3} from 'three';
const input='public/assets/vehicles/horse-model-source.glb',source=fs.readFileSync(input);
const gltf=await new GLTFLoader().parseAsync(source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength),'');
const meshes=[];gltf.scene.traverse(node=>{if(node.isSkinnedMesh)meshes.push(node);});
const mixer=new AnimationMixer(gltf.scene),walk=gltf.animations.find(clip=>clip.name==='Walk');
if(!walk||meshes.length!==8)throw new Error('Unexpected source horse rig/material layout');
mixer.clipAction(walk).play();mixer.setTime(0);gltf.scene.updateMatrixWorld(true);
const bounds=new Box3().setFromObject(gltf.scene),length=bounds.max.z-bounds.min.z,middle=(bounds.max.z+bounds.min.z)/2,base=bounds.min.y;
const transform=p=>new Vector3(p.x/length,(p.y-base)/length,-(p.z-middle)/length),round=x=>Math.round(x*100000)/100000;
const poses=[],names=[];
for(let pose=0;pose<4;pose++){
  mixer.setTime(pose/4*walk.duration);gltf.scene.updateMatrixWorld(true);const positions=[];
  for(const mesh of meshes){mesh.skeleton.update();const g=mesh.geometry;
    for(let i=0;i<g.index.count;i++){
      const p=new Vector3().fromBufferAttribute(g.attributes.position,g.index.getX(i));mesh.applyBoneTransform(g.index.getX(i),p);p.applyMatrix4(mesh.matrixWorld);positions.push(transform(p));
      if(pose===0)names.push(mesh.material.name);
    }
  }poses.push(positions);
}
const count=poses[0].length,layers=[];
// Clip fitted surface strips on the intact rest mesh. Barycentric bindings
// follow that same rig at every stride; nothing floats off the animal.
const clip=(polygon,axis,bound,above)=>{
  const result=[];for(let i=0;i<polygon.length;i++){
    const a=polygon[i],b=polygon[(i+1)%polygon.length],da=axis(a.p)-bound,db=axis(b.p)-bound;
    if((da>=0)===above)result.push(a);
    if((da>=0)!==(db>=0)){const t=da/(da-db);result.push({p:a.p.clone().lerp(b.p,t),weights:a.weights.map((v,k)=>v+(b.weights[k]-v)*t)});}
  }return result;
};
const strip=(name,planes)=>{
  for(let i=0;i<count;i+=3){
    if(!names[i].startsWith('Main'))continue;
    let polygon=poses[0].slice(i,i+3).map((p,k)=>({p,weights:[0,1,2].map(j=>j===k?1:0)}));
    for(const [axis,bound,above] of planes){polygon=clip(polygon,axis,bound,above);if(polygon.length<3)break;}
    for(let j=1;j<polygon.length-1;j++)layers.push({base:i,name,vertices:[polygon[0],polygon[j],polygon[j+1]]});
  }
};
const x=p=>p.x,y=p=>p.y,z=p=>p.z;
for(const [low,high] of [[-.045,-.020],[.225,.250]])strip('Harness',[[z,low,true],[z,high,false],[y,.30,true],[y,.66,false]]);
strip('Harness',[[y,.425,true],[y,.440,false],[z,-.06,true],[z,.26,false]]);
strip('Harness',[[p=>p.y+p.z,.30,true],[p=>p.y+p.z,.335,false],[y,.35,true],[z,-.25,true],[z,-.04,false]]);
strip('Harness',[[y,.605,true],[y,.635,false],[z,-.52,true],[z,-.35,false]]);
strip('Harness',[[p=>p.y+p.z,.275,true],[p=>p.y+p.z,.291,false],[y,.64,true],[y,.81,false],[z,-.51,true],[z,-.29,false]]);
strip('Blaze',[[x,-.014,true],[x,.014,false],[y,.64,true],[y,.79,false],[z,-.53,true],[z,-.34,false]]);
strip('Feathers',[[y,.035,true],[y,.115,false],[z,-.33,true],[z,.36,false]]);
for(let pose=0;pose<4;pose++)for(const layer of layers){
  const triangle=poses[pose].slice(layer.base,layer.base+3),n=new Vector3().subVectors(triangle[1],triangle[0]).cross(new Vector3().subVectors(triangle[2],triangle[0])).normalize();
  for(const v of layer.vertices){const p=new Vector3();for(let k=0;k<3;k++)p.addScaledVector(triangle[k],v.weights[k]);poses[pose].push(p.addScaledVector(n,.0012));if(pose===0)names.push(layer.name);}
}
const materialNames=[...new Set(names)],surfaceUV=[];
for(let i=0;i<poses[0].length;i+=3){
  const [a,b,c]=poses[0].slice(i,i+3),n=new Vector3().subVectors(b,a).cross(new Vector3().subVectors(c,a));
  for(const p of [a,b,c]){
    const scale=names[i]==='Hair'?.48:.32;
    const uv=Math.abs(n.x)>Math.abs(n.y)&&Math.abs(n.x)>Math.abs(n.z)?[p.z/scale,p.y/scale]:Math.abs(n.y)>Math.abs(n.z)?[p.z/scale,p.x/scale]:[p.x/scale,p.y/scale];surfaceUV.push(...uv.map(round));
  }
}
const frames=poses.map(positions=>{
  const normals=positions.map(()=>new Vector3()),smooth=new Map();
  for(let i=0;i<positions.length;i+=3){
    const n=new Vector3().subVectors(positions[i+1],positions[i]).cross(new Vector3().subVectors(positions[i+2],positions[i])).normalize();
    for(let k=0;k<3;k++){const p=positions[i+k],key=p.toArray().map(v=>Math.round(v*10000)).join(':');let sum=smooth.get(key);if(!sum){sum=new Vector3();smooth.set(key,sum);}sum.add(n);normals[i+k]=sum;}
  }return {positions:positions.flatMap(p=>p.toArray().map(round)),normals:normals.flatMap(n=>n.clone().normalize().toArray().map(round))};
});
fs.writeFileSync('src/game/presentation25d/travelHorseModel.json',JSON.stringify({source:input,license:'CC0-1.0',rise:(bounds.max.y-base)/length,materials:names.map(name=>materialNames.indexOf(name)),materialNames,surfaceUV,frames})+'\n');
console.log(`Baked ${frames.length} complete rigged strides, ${frames[0].positions.length/9} triangles each, with fitted harness and continuous material binding.`);
