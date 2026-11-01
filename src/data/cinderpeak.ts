import {LAVA_FLOW} from './worldLandscape';
import {seededRandom} from '../utils/seededRandom';
import type {GroundPoint} from './worldSpriteGeometry';
export const CINDERPEAK={x:LAVA_FLOW[0].x,y:LAVA_FLOW[0].y-1700,radius:1650,height:2180,craterRadius:280,maximumView:28000} as const;
export interface VolcanoPulse {seconds:number;intensity:number;active:boolean}
const random=seededRandom('darkav:cinderpeak:3d:v1');
const variation=Array.from({length:96},()=>random());
export function cinderpeakVariation(i:number){return variation[(Math.round(i)%96+96)%96];}
export function cinderpeakRidge(i:number){const a=i/96*Math.PI*2;return 1+.055*Math.sin(a*7)+.025*Math.cos(a*13)+cinderpeakVariation(i)*.025;}
export function cinderpeakOutline():GroundPoint[]{return variation.map((_,i)=>{
 const a=i/96*Math.PI*2,r=CINDERPEAK.radius*cinderpeakRidge(i);return [CINDERPEAK.x+Math.cos(a)*r,CINDERPEAK.y+Math.sin(a)*r];
});}
export function onCinderpeak(x:number,y:number,pad=0){return Math.hypot(x-CINDERPEAK.x,y-CINDERPEAK.y)<CINDERPEAK.radius*1.11+pad;}
