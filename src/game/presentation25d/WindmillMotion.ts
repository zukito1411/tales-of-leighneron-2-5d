/** Shared, bounded motion for all streamed mills. Geometry and materials stay
 * immutable; one angle uniform also drives projected shadows and faded copies. */
export const WINDMILL_HUB_FRACTION=.83;
export function windmillAngularSpeed(wind:number,storm:number){
 const strength=Math.max(0,Math.min(1,((Number.isFinite(wind)?wind:.18)-.18)/.82));
 const gust=Math.max(0,Math.min(1,Number.isFinite(storm)?storm:0));
 // About 1.2 rpm in calm weather, 5 rpm in wind, 6.8 rpm in a full storm.
 return .13+.40*Math.pow(strength,1.4)+.18*gust;
}
export class WindmillMotion {
 angle=0;speed=.13;
 update(deltaMs:number,wind:number,storm:number){
  const dt=Number.isFinite(deltaMs)?Math.max(0,Math.min(80,deltaMs))/1000:0;
  this.speed+=(windmillAngularSpeed(wind,storm)-this.speed)*(1-Math.exp(-dt/2.2));
  this.angle=(this.angle+this.speed*dt)%(Math.PI*2);
  return this.angle;
 }
}
