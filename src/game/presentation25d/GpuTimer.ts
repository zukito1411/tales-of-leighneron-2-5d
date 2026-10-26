interface TimerExtension {TIME_ELAPSED_EXT:number;GPU_DISJOINT_EXT:number}
/** Read completed GPU queries in later frames. Never wait, spin or call finish(). */
export class GpuTimer {
  private readonly extension:TimerExtension|null;
  private readonly pending:WebGLQuery[]=[];
  private active:WebGLQuery|null=null;
  milliseconds:number|null=null;
  /** Lost-context query objects cannot be reused or ended after restoration. */
  abandon(){this.active=null;this.pending.length=0;this.milliseconds=null;}
  constructor(private readonly gl:WebGL2RenderingContext){this.extension=gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExtension|null;}
  begin(enabled:boolean){
    if(this.active||!enabled||!this.extension||this.pending.length>=4||this.gl.isContextLost())return;
    const query=this.gl.createQuery();if(!query)return;
    this.active=query;this.gl.beginQuery(this.extension.TIME_ELAPSED_EXT,query);
  }
  end(){if(!this.active||!this.extension)return;this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);this.pending.push(this.active);this.active=null;}
  poll(){
    const ext=this.extension;if(!ext||!this.pending.length||this.gl.isContextLost())return;
    if(this.gl.getParameter(ext.GPU_DISJOINT_EXT)){
      for(const query of this.pending)this.gl.deleteQuery(query);this.pending.length=0;this.milliseconds=null;return;
    }
    const query=this.pending[0];if(!this.gl.getQueryParameter(query,this.gl.QUERY_RESULT_AVAILABLE))return;
    this.milliseconds=Number(this.gl.getQueryParameter(query,this.gl.QUERY_RESULT))/1e6;
    this.gl.deleteQuery(query);this.pending.shift();
  }
  destroy(){this.end();for(const query of this.pending)this.gl.deleteQuery(query);this.pending.length=0;}
}
