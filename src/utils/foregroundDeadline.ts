/** A bounded operation gets its full allowance while the document is visible.
 * Android may suspend RAF, workers and GPU restoration while backgrounded. */
export class ForegroundDeadline {
  private timer:number|undefined;
  private remaining=0;
  private started=0;
  constructor(private readonly expired:()=>void){}
  start(milliseconds:number){
    this.clear();this.remaining=milliseconds;
    document.addEventListener('visibilitychange',this.onVisibility);
    this.onVisibility();
  }
  clear(){
    if(this.timer!==undefined)window.clearTimeout(this.timer);
    this.timer=undefined;this.remaining=0;
    document.removeEventListener('visibilitychange',this.onVisibility);
  }
  private readonly onVisibility=()=>{
    if(document.hidden){
      if(this.timer!==undefined){
        window.clearTimeout(this.timer);this.timer=undefined;
        this.remaining=Math.max(1,this.remaining-(performance.now()-this.started));
      }
    }else if(this.remaining>0&&this.timer===undefined){
      this.started=performance.now();
      this.timer=window.setTimeout(()=>{
        this.timer=undefined;
        // If suspension preceded delivery of visibilitychange, retain the
        // allowance instead of treating background time as an operation stall.
        if(document.hidden)return;
        this.clear();this.expired();
      },this.remaining);
    }
  };
}
