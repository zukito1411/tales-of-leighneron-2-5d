const STORAGE_KEY='leighneron:2.5d-frame-times';
export const FRAME_DIAGNOSTICS_EVENT='leighneron:2.5d-frame-times-changed';
export function getFrameDiagnosticsEnabled(){
  try{return window.localStorage.getItem(STORAGE_KEY)==='1';}
  catch{return false;}
}
export function setFrameDiagnosticsEnabled(enabled:boolean){
  try{window.localStorage.setItem(STORAGE_KEY,enabled?'1':'0');}
  catch{/* Private storage may be restricted. Current session still receives the event. */}
  window.dispatchEvent(new CustomEvent(FRAME_DIAGNOSTICS_EVENT,{detail:enabled}));
}
