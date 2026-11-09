/** Diagnostic-only measured wall-clock cost of world-streaming operations.
 * Samples are grouped by one-second windows so still vs moving bottlenecks
 * can be compared on the same device; collecting is disabled in normal play. */
export interface MovementStreamStats {
  moving:boolean;sampleFrames:number;movingFrames:number;
  terrainAvgMs:number;terrainPeakMs:number;
  contentAvgMs:number;contentPeakMs:number;
  viewAvgMs:number;viewPeakMs:number;
  streamingHitches:number;
}
export class MovementStreamProfiler{
  private windowStart=0;
  private samples=0;
  private movingSamples=0;
  private sums=[0,0,0];
  private peaks=[0,0,0];
  private hitches=0;
  reset(){
    this.windowStart=0;this.samples=0;this.movingSamples=0;
    this.sums.fill(0);this.peaks.fill(0);this.hitches=0;
  }
  record(nowMs:number,moving:boolean,terrainMs:number,viewMs:number,contentMs:number):MovementStreamStats|null{
    if(!Number.isFinite(nowMs))return null;
    if(this.windowStart===0)this.windowStart=nowMs;
    const costs=[terrainMs,viewMs,contentMs];
    this.samples++;if(moving)this.movingSamples++;
    for(let i=0;i<costs.length;i++){
      const v=Number.isFinite(costs[i])?Math.max(0,costs[i]):0;
      this.sums[i]+=v;this.peaks[i]=Math.max(this.peaks[i],v);
    }
    if(costs.reduce((a,b)=>a+(Number.isFinite(b)?Math.max(0,b):0),0)>8.333)this.hitches++;
    if(nowMs-this.windowStart<1000)return null;
    const n=Math.max(1,this.samples);
    const stats:MovementStreamStats={
      moving,movingFrames:this.movingSamples,sampleFrames:this.samples,
      terrainAvgMs:this.sums[0]/n,terrainPeakMs:this.peaks[0],
      viewAvgMs:this.sums[1]/n,viewPeakMs:this.peaks[1],
      contentAvgMs:this.sums[2]/n,contentPeakMs:this.peaks[2],
      streamingHitches:this.hitches
    };
    this.reset();this.windowStart=nowMs;
    return stats;
  }
}
