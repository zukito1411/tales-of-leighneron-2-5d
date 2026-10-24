import {BufferGeometry,Float32BufferAttribute} from 'three';
import model from './travelHorseModel.json';
import {pigment} from './ModelMesh';
import type {FurnitureShape} from './FurnitureGeometry';

/** Complete anatomical mesh with diffuse material UVs, fitted harness and blaze.
 * Perspective animal paintings never wrap around another model's head. */
export function createTravelHorseGeometry(shape:FurnitureShape){
  const pose=shape.pose??0,frame=model.frames[pose],next=model.frames[(pose+1)%model.frames.length],count=frame.positions.length/3;
  const uv=new Float32Array(count*2),rect=new Float32Array(count*4),pivot=new Float32Array(count*4);
  const tiles:Record<string,number>={Main:0,Main_Dark:0,Main_Light:1,Hair:2,Muzzle:3,Hooves:6,Harness:4,Blaze:7,Feathers:7};
  for(let i=0;i<count;i++){
    const name=model.materialNames[model.materials[i]],eye=name.startsWith('Eye_');
    if(eye)rect.set([...pigment(name==='Eye_White'?0xfff2d1:0x160e08),-1],i*4);
    else{const tile=tiles[name]??0;rect.set([tile%4/4,1-(Math.floor(tile/4)+1)/4,.25,-20],i*4);}
    // Reuse existing pivot storage for next-pose deltas. The shader blends
    // distance-driven motion without extra attributes or CPU mesh updates.
    pivot.set([next.positions[i*3]-frame.positions[i*3],next.positions[i*3+1]-frame.positions[i*3+1],next.positions[i*3+2]-frame.positions[i*3+2],-2],i*4);
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(frame.positions,3));geometry.setAttribute('normal',new Float32BufferAttribute(frame.normals,3));
  geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));geometry.setAttribute('surfaceRect',new Float32BufferAttribute(rect,4));
  geometry.setAttribute('surfaceUV',new Float32BufferAttribute(model.surfaceUV,2));geometry.setAttribute('cutoutPivot',new Float32BufferAttribute(pivot,4));
  return geometry;
}
