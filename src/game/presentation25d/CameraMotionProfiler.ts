/** Presentation diagnostics: distinguish camera yaw/pitch motion from player
 * movement. The legacy "Travel STILL" counter checks only body velocity and
 * cannot explain the spikes caused by rotating at a fixed world position.
 * This profiler does no work when the debug overlay is disabled. */
export interface CameraMotionStats {
  turningFrames:number;travelFrames:number;sampleFrames:number;
  yawDegreesPerSecond:number;pitchDegreesPerSecond:number;
  yawPeakDegreesPerSecond:number;
  mode:'STILL'|'TURNING'|'TRAVELING'|'TURNING + TRAVELING';
}
const RAD_TO_DEG=180/Math.PI;
export function wrappedAngularDelta(current:number,previous:number){
  return Math.atan2(Math.sin(current-previous),Math.cos(current-previous));
}
export class CameraMotionProfiler {
  private first=true;
  private lastYaw=0;private lastPitch=0;private lastX=0;private lastY=0;private lastAt=0;
  private periodStart=0;private samples=0;private turns=0;private travels=0;
  private yawSum=0;private pitchSum=0;private yawPeak=0;
  reset(){
    this.first=true;this.periodStart=0;this.samples=0;this.turns=0;this.travels=0;
    this.yawSum=this.pitchSum=this.yawPeak=0;
  }
  record(now:number,yaw:number,pitch:number,x:number,y:number):CameraMotionStats|null{
    if(![now,yaw,pitch,x,y].every(Number.isFinite))return null;
    if(this.first){
      this.first=false;this.lastAt=this.periodStart=now;this.lastYaw=yaw;this.lastPitch=pitch;
      this.lastX=x;this.lastY=y;return null;
    }
    const dt=Math.max(1,now-this.lastAt);
    const yawChange=Math.abs(wrappedAngularDelta(yaw,this.lastYaw));
    const pitchChange=Math.abs(wrappedAngularDelta(pitch,this.lastPitch));
    const travel=Math.hypot(x-this.lastX,y-this.lastY)>.05;
    const turning=yawChange>.0002||pitchChange>.0002;
    this.lastYaw=yaw;this.lastPitch=pitch;this.lastX=x;this.lastY=y;this.lastAt=now;
    this.samples++;if(turning)this.turns++;if(travel)this.travels++;
    this.yawSum+=yawChange;this.pitchSum+=pitchChange;
    if(yawChange>0)this.yawPeak=Math.max(this.yawPeak,yawChange*RAD_TO_DEG*1000/dt);
    const duration=now-this.periodStart;
    if(duration<1000)return null;
    const elapsed=Math.max(.001,duration/1000);
    const stats:CameraMotionStats={
      turningFrames:this.turns,travelFrames:this.travels,sampleFrames:this.samples,
      yawDegreesPerSecond:this.yawSum*RAD_TO_DEG/elapsed,
      pitchDegreesPerSecond:this.pitchSum*RAD_TO_DEG/elapsed,
      yawPeakDegreesPerSecond:this.yawPeak,
      mode:this.turns&&this.travels?'TURNING + TRAVELING':this.turns?'TURNING':this.travels?'TRAVELING':'STILL'
    };
    this.periodStart=now;this.samples=this.turns=this.travels=0;
    this.yawSum=this.pitchSum=this.yawPeak=0;
    return stats;
  }
}
