import {TouchLayoutEditor} from './TouchLayoutEditor';
import {useEffect,useState} from 'react';
import {CONTROL_SETTINGS_EVENT,CONTROL_LABELS,getControlSettings,bindControl,keyLabel,resetControlSettings,setTouchScale,setTouchLayouts,type BindingAction} from '../game/systems/controlSettings';
export function ControlsSettingsControl(){
 const [settings,setSettings]=useState(getControlSettings),[capture,setCapture]=useState<BindingAction|null>(null),[message,setMessage]=useState(''),[editing,setEditing]=useState(false);
 useEffect(()=>{const changed=()=>setSettings(getControlSettings());window.addEventListener(CONTROL_SETTINGS_EVENT,changed);return()=>window.removeEventListener(CONTROL_SETTINGS_EVENT,changed);},[]);
 return <details className="controls-settings" onToggle={e=>{if(!e.currentTarget.open)setCapture(null);}}><summary>Keyboard & touch controls</summary>
  <p>Choose an action, then press a key. Escape cancels. Menu shortcuts and V for camera mode remain reserved.</p>
  <div className="control-bindings">{(Object.keys(CONTROL_LABELS) as BindingAction[]).map(action=><label key={action}>{CONTROL_LABELS[action]}
   <button type="button" aria-label={`Change ${CONTROL_LABELS[action]} binding`} onClick={()=>{setCapture(action);setMessage('');}}
    onBlur={()=>setCapture(null)} onKeyDown={event=>{
     if(capture!==action)return;event.preventDefault();event.stopPropagation();
     if(event.key==='Escape'){setCapture(null);return;}
     const error=bindControl(action,event.keyCode);setMessage(error??'Key binding saved.');if(!error)setCapture(null);
    }}>{capture===action?'Press a key…':keyLabel(settings.keys[action])}</button></label>)}</div>
  <button type="button" onClick={()=>{setCapture(null);setMessage('');setEditing(true);}}>Customize touch button positions, sizes & opacity</button>
  <button type="button" onClick={()=>{const saved=setTouchLayouts({});setMessage(saved?'Original touch layouts restored.':'Original touch layouts applied for this session; device storage is unavailable.');}}>Restore original touch layouts</button>
  {editing&&<TouchLayoutEditor close={saved=>{setEditing(false);if(saved!==undefined)setMessage(saved?'Touch layouts saved on this device.':'Touch layouts applied for this session; device storage is unavailable.');}}/>}
  <label>Touch control size · {Math.round(settings.touchScale*100)}%<input type="range" min="80" max="130" step="5" value={Math.round(settings.touchScale*100)} onChange={e=>setTouchScale(Number(e.target.value)/100)}/></label>
  <button type="button" onClick={()=>{resetControlSettings();setCapture(null);setMessage('Default controls restored.');}}>Restore default controls</button>
  {message&&<p role="status">{message}</p>}
 </details>;
}
