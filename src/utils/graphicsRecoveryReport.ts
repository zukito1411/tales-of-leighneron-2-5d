/** Fault-only, bounded local evidence. No gameplay save or remote telemetry. */
const KEY='leighneron-graphics-faults-v1';
const LIMIT=6,MAX_RECORD=20000,MAX_HISTORY=150000;
export const GRAPHICS_REPORT_EVENT='leighneron-graphics-report';
export type GraphicsFaultKind='context-lost'|'context-restored'|'shader-error'|'preparation-failed'|'runtime-error';
interface GraphicsFault {kind:GraphicsFaultKind;at:string;details:Record<string,unknown>}
let memory:GraphicsFault[]=[];
let lastRuntimeError=-Infinity;

function history():GraphicsFault[]{
  if(memory.length)return memory;
  try{
    const raw=localStorage.getItem(KEY);
    if(!raw||raw.length>MAX_HISTORY)return memory;
    const saved:unknown=JSON.parse(raw);
    if(!Array.isArray(saved))return memory;
    memory=saved.filter((item):item is GraphicsFault=>Boolean(item&&typeof item==='object'
      &&'kind' in item&&typeof item.kind==='string'&&'at' in item&&typeof item.at==='string'
      &&'details' in item&&item.details&&typeof item.details==='object')).slice(-LIMIT);
    return memory;
  }catch{return memory;}
}
export function graphicsError(reason:unknown){
  return reason instanceof Error?{message:reason.message.slice(0,2000),stack:reason.stack?.slice(0,6000)}:{message:String(reason).slice(0,2000)};
}
export function recordGraphicsFault(kind:GraphicsFaultKind,details:Record<string,unknown>){
  try{
    // A recurring runtime exception must not turn diagnostics into a new
    // per-frame storage/serialization workload or erase the context-loss trail.
    if(kind==='runtime-error'){
      const now=Date.now();if(now-lastRuntimeError<5000)return;lastRuntimeError=now;
    }
    const event:GraphicsFault={kind,at:new Date().toISOString(),details};
    if(JSON.stringify(event).length>MAX_RECORD)event.details={message:'Fault details exceeded the bounded report size'};
    memory=[...history(),event].slice(-LIMIT);
    try{localStorage.setItem(KEY,JSON.stringify(memory));}catch{/* Retain evidence in memory if storage is unavailable. */}
    window.dispatchEvent(new Event(GRAPHICS_REPORT_EVENT));
  }catch{/* Diagnostics must never cause or prevent graphics recovery. */}
}
export function hasGraphicsReport(){return history().length>0;}
export function graphicsReportExport(){
  const events=history();
  if(!events.length)throw new Error('No graphics failure has been recorded on this installation.');
  return {filename:'leigneron-graphics-report-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json',
    json:JSON.stringify({format:'leigneron-graphics-report-v1',userAgent:navigator.userAgent,events},null,2)};
}
