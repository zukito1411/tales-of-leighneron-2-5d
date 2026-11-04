import {artFrameSize,type ArtTextureKey} from './art';
import {capitalPropStyle} from './highmereStreetStyle';

/** One small maximum for outdoor benches, shared by authored and added scenery.
 * The same civic frame also supplies cafe chairs; keep their authored scale. */
export const OUTDOOR_BENCH_WIDTH=108;
export function outdoorBenchScale(id:string,texture:ArtTextureKey,frame:number,scale:number){
 return (texture==='others'||texture==='native_civic_bare')&&frame===7&&capitalPropStyle(id)!=='cafe-chair'
  ?Math.min(scale,OUTDOOR_BENCH_WIDTH/artFrameSize(texture,frame).width):scale;
}
