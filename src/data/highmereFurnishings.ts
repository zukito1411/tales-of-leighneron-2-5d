import {artFrameSize} from './art';
import type {WardDetail} from './settlementWards';

/** Junction lighting and complete public-space compositions, never an emitter
 * per house. The shared planner admits each model at its surveyed position. */
export function highmereFurnishings():WardDetail[]{
 const details:WardDetail[]=[];
 const add=(id:string,x:number,y:number,frame:number,height:number,solid=true)=>details.push({
  id:'capital:'+id,x,y,texture:'native_civic_bare',frame,scale:height/artFrameSize('native_civic_bare',frame).height,solid,
 });
 for(const side of [-1,1]){
  for(const y of [1500,2200,3550,4700,5550])add('avenue-light:'+side+':'+y,side*220,y,1,145,false);
  for(const x of [2000,4930])for(const y of x===2000?[-1750]:[-1750,-2650])add('terrace-light:'+side+':'+x+':'+y,side*x,y,1,145,false);
  for(const x of [900,1500,5200])add('crossing-light:'+side+':'+x,side*x,270,1,145,false);
 }
 add('shrine-light:west',600,4550,1,145,false);add('shrine-light:east',1600,4550,1,145,false);
 add('market-light:west',-4000,950,1,145,false);add('market-light:east',-1400,950,1,145,false);
 // The shrine faces a quiet open garden rather than the rear of a household.
 for(const x of [600,1600]){
  add('shrine-seat:'+x,x,4140,7,44);
  add('shrine-garden-seat:'+x,x,4800,7,44);
 }
 add('shrine-fountain',1450,4520,10,100);
 // An exercise strip and supply edges are distinct from the merchant market.
 add('drill-stores',3100,600,9,55);add('drill-banner',3000,350,12,115);
 return details;
}
