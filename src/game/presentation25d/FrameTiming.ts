/** Fixed storage; no per-frame samples array allocations or hidden averaging. */
export class FrameTiming {
  private readonly samples=new Float32Array(300);
  private readonly scratch=new Float32Array(300);
  private cursor=0;private count=0;
  add(rawDelta:number){
    if(!Number.isFinite(rawDelta)||rawDelta<=0||document.hidden)return;
    this.samples[this.cursor]=rawDelta;this.cursor=(this.cursor+1)%this.samples.length;
    this.count=Math.min(this.count+1,this.samples.length);
  }
  stats(){
    const n=this.count;if(!n)return {p50:0,p95:0,p99:0,maximum:0,over33:0,over50:0,samples:0};
    this.scratch.set(this.samples);const values=this.scratch.subarray(0,n);values.sort();
    let over33=0,over50=0;
    for(const v of values){if(v>33.333)over33++;if(v>50)over50++;}
    const at=(p:number)=>values[Math.min(n-1,Math.ceil(n*p)-1)];
    return {p50:at(.5),p95:at(.95),p99:at(.99),maximum:values[n-1],over33,over50,samples:n};
  }
}
