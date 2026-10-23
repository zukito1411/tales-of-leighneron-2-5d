import {Vector3} from 'three';
import type {RegionId} from '../types';

export type WeatherKind='clear'|'cloudy'|'rain'|'storm'|'snow'|'fog'|'wind'|'dust'|'ash';
export interface WeatherPresentation {
  kind:WeatherKind;strength:number;elapsed:number;cloudCover:number;wind:number;
  mist:number;region:RegionId;fogTint:readonly [number,number,number];
}
/** Shared daylight direction: the visible sun and its ground shadows agree. */
export function sunDirection(minute:number,out:Vector3){
  const angle=(minute/60-6)*Math.PI/12;
  return out.set(Math.cos(angle),Math.sin(angle)*.94,Math.sin(angle)*.34).normalize();
}
export const VIEW_DISTANCE=2400;
export const FOG_START=VIEW_DISTANCE*.66;
