import {describe,it,expect} from 'vitest';
import {BufferAttribute} from 'three';
import {WindmillMotion,windmillAngularSpeed,WINDMILL_HUB_FRACTION} from '../src/game/presentation25d/WindmillMotion';
import {ModelMesh} from '../src/game/presentation25d/ModelMesh';
import {createRuralFitting} from '../src/game/presentation25d/RuralGeometry';
import {modelIsOpaque} from '../src/game/presentation25d/modelTopology';
import type {FurnitureShape} from '../src/game/presentation25d/FurnitureGeometry';

describe('windmill weather motion',()=>{
 it('accelerates gradually without jumping its phase when weather changes',()=>{
  const m=new WindmillMotion(),before=m.angle;
  m.update(0,1,1);expect(m.angle).toBe(before);expect(m.speed).toBeCloseTo(.13);
  m.update(16,1,1);expect(m.speed).toBeGreaterThan(.13);expect(m.speed).toBeLessThan(.14);
  for(let i=0;i<1500;i++)m.update(16,1,1);
  expect(m.speed).toBeCloseTo(windmillAngularSpeed(1,1),3);
  const phase=m.angle;m.update(Number.NaN,Number.NaN,Number.NaN);expect(m.angle).toBe(phase);
  for(let i=0;i<10000;i++)m.update(80,.18,0);
  expect(m.angle).toBeGreaterThanOrEqual(0);expect(m.angle).toBeLessThan(Math.PI*2);
  expect(m.speed).toBeCloseTo(.13);
 });
 it('bounds extreme weather and a wake-up delta',()=>{
  expect(windmillAngularSpeed(Infinity,Infinity)).toBe(.13);
  expect(windmillAngularSpeed(100,100)).toBeCloseTo(.71);
  expect(windmillAngularSpeed(-100,-100)).toBe(.13);
  const m=new WindmillMotion();m.update(600000,1,1);expect(m.angle).toBeLessThan(.02);
 });
 it('marks only the rotor for GPU motion and clears a full rotation above NPC heads',()=>{
  for(const width of [240,300]){
   const shape:FurnitureShape={art:'windmill',kit:'world',key:'review',left:0,top:0,width:1,height:1,rise:456/width,depth:1,patch:[.1,.1,.2,.2]};
   const mesh=new ModelMesh(shape);expect(createRuralFitting(mesh,shape,false)).toBe(true);
   const g=mesh.finish(),p=g.getAttribute('position'),motion=g.getAttribute('cutoutPivot');let moving=0,fixed=0,radius=0;
   for(let i=0;i<p.count;i++)if(motion.getW(i)<0){moving++;radius=Math.max(radius,Math.hypot(p.getX(i)-motion.getX(i),p.getY(i)-motion.getY(i)));}else fixed++;
   expect(moving).toBeGreaterThan(0);expect(fixed).toBeGreaterThan(0);expect(modelIsOpaque(g)).toBe(true);
   expect((shape.rise*WINDMILL_HUB_FRACTION-radius)*width).toBeGreaterThan(100);
   expect(radius).toBeLessThan(.94);expect(p instanceof BufferAttribute&&p.version===0).toBe(true);g.dispose();
  }
 });
});
