/** Fixed-size interval history for *completed presentation frames*, not
 * requestAnimationFrame's raw tick cadence (which may be 120 Hz on a phone
 * even when Phaser renders at a 60 FPS limit).
 * No arrays are allocated on the per-frame hot path. */
export class FrameTiming {
  private readonly samples=new Float32Array(300);
  private readonly scratch=new Float32Array(300);
  private cursor=0;
  private count=0;

  reset(){this.cursor=0;this.count=0;}

  add(presentedIntervalMs:number){
    if(!Number.isFinite(presentedIntervalMs)||presentedIntervalMs<=0
      ||typeof document!=='undefined'&&document.hidden)return;
    this.samples[this.cursor]=presentedIntervalMs;
    this.cursor=(this.cursor+1)%this.samples.length;
    this.count=Math.min(this.count+1,this.samples.length);
  }

  stats(){
    const n=this.count;
    if(!n)return {fps:0,onePercentLowFps:0,p50:0,p95:0,p99:0,maximum:0,over33:0,over50:0,samples:0};
    this.scratch.set(this.samples);
    const values=this.scratch.subarray(0,n);values.sort();
    let over33=0,over50=0,total=0;
    for(const v of values){total+=v;if(v>33.333)over33++;if(v>50)over50++;}
    const at=(p:number)=>values[Math.min(n-1,Math.ceil(n*p)-1)];
    const slowCount=Math.max(1,Math.ceil(n*.01));
    let slowDuration=0;
    for(let i=n-slowCount;i<n;i++)slowDuration+=values[i];
    return {
      fps:n*1000/total,
      onePercentLowFps:slowCount*1000/slowDuration,
      p50:at(.5),p95:at(.95),p99:at(.99),
      maximum:values[n-1],over33,over50,samples:n,
    };
  }
}
