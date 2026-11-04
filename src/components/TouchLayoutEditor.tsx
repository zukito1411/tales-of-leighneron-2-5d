import {useEffect,useRef,useState,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import {MobileControls} from './MobileControls';
import {useControlSettings} from './useControlSettings';
import {useTouchOrientation} from './useTouchOrientation';
import {setTouchLayouts} from '../game/systems/controlSettings';
import {defaultTouchLayout,TOUCH_CONTROL_IDS,TOUCH_CONTROL_LABELS,touchSizeLimits,type TouchControlId,type TouchLayout,type TouchLayouts} from '../game/systems/touchLayout';
import {noteUiTransition} from '../utils/uiInputGuard';
import {mobileInput} from '../game/input';
import './touch-layout.css';

export function TouchLayoutEditor({close}:{close:(saved?:boolean)=>void}){
 const settings=useControlSettings(),orientation=useTouchOrientation();
 const [layouts,setLayouts]=useState<TouchLayouts>(()=>({...settings.touchLayouts}));
 const [selected,select]=useState<TouchControlId>('attack'),[expanded,setExpanded]=useState(true);
 const root=useRef<HTMLDivElement>(null),tools=useRef<HTMLElement>(null);
 const [viewport,setViewport]=useState({width:window.innerWidth-16,height:window.innerHeight-16});
 const layout=layouts[orientation]??defaultTouchLayout(viewport.width,viewport.height,settings.touchScale),p=layout[selected];
 useEffect(()=>{
  const previous=document.activeElement;noteUiTransition();mobileInput.reset();
  tools.current?.querySelector<HTMLElement>('button')?.focus();
  const measure=()=>{const rect=root.current?.querySelector('.mobile-controls')?.getBoundingClientRect();if(rect&&rect.width>0&&rect.height>0)setViewport(old=>old.width===rect.width&&old.height===rect.height?old:{width:rect.width,height:rect.height});};
  measure();const observer=typeof ResizeObserver==='function'?new ResizeObserver(measure):undefined;
  if(root.current)observer?.observe(root.current);window.addEventListener('resize',measure);
  return()=>{observer?.disconnect();window.removeEventListener('resize',measure);mobileInput.reset();noteUiTransition();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();};
 },[]);
 const update=(id:TouchControlId,patch:Partial<TouchLayout[TouchControlId]>)=>setLayouts(current=>{
  const active=current[orientation]??defaultTouchLayout(viewport.width,viewport.height,settings.touchScale);
  return {...current,[orientation]:{...active,[id]:{...active[id],...patch}}};
 });
 const overlapping=TOUCH_CONTROL_IDS.some((id,i)=>TOUCH_CONTROL_IDS.slice(i+1).some(other=>{
  const center=(control:TouchControlId)=>{
   const p=layout[control],[min,max]=touchSizeLimits(control),size=Math.min(viewport.width,viewport.height,Math.max(min,Math.min(max,p.size*settings.touchScale))),r=size/2;
   return {x:Math.max(r,Math.min(viewport.width-r,p.x*viewport.width)),y:Math.max(r,Math.min(viewport.height-r,p.y*viewport.height)),r};
  };
  const a=center(id),b=center(other);return Math.hypot(a.x-b.x,a.y-b.y)<a.r+b.r+4;
 }));
 const trapKeys=(event:KeyboardEvent<HTMLDivElement>)=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}
  if(event.key!=='Tab')return;
  const nodes=tools.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select');if(!nodes?.length)return;
  const first=nodes[0],last=nodes[nodes.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 };
 const [min,max]=touchSizeLimits(selected);
 return createPortal(<div ref={root} className="touch-layout-editor overlay-backdrop" role="dialog" aria-modal="true" aria-label="Customize touch controls"
   onKeyDownCapture={trapKeys} onPointerDown={event=>event.stopPropagation()} onPointerUp={event=>event.stopPropagation()} onKeyDown={event=>event.stopPropagation()}>
  <MobileControls editor={{layout,selected,select,move:(id,x,y)=>update(id,{x,y})}}/>
  <section ref={tools} className="touch-layout-tools" aria-label="Layout settings">
   <header><strong>Touch layout · {orientation}</strong><div>
    <button type="button" onClick={()=>close()}>Cancel</button>
    <button type="button" onClick={()=>close(setTouchLayouts({...layouts,[orientation]:layout}))}>Save</button>
   </div></header>
   <button type="button" className="touch-layout-collapse" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{expanded?'Hide settings to drag controls':'Show layout settings'}</button>
   {expanded&&<>
    <p>Drag a control, or select it below. Rotate your device to edit its other layout.</p>
    <label>Control<select value={selected} onChange={event=>select(event.target.value as TouchControlId)}>{TOUCH_CONTROL_IDS.map(id=><option key={id} value={id}>{TOUCH_CONTROL_LABELS[id]}</option>)}</select></label>
    <div className="touch-layout-sliders">
     <label>Size · {Math.round(p.size)}<input aria-label="Control size" type="range" min={min} max={max} step="2" value={p.size} onChange={event=>update(selected,{size:Number(event.target.value)})}/></label>
     <label>Opacity · {Math.round(p.opacity*100)}%<input aria-label="Control opacity" type="range" min="25" max="100" step="5" value={p.opacity*100} onChange={event=>update(selected,{opacity:Number(event.target.value)/100})}/></label>
     <label>Horizontal · {Math.round(p.x*100)}%<input aria-label="Horizontal position" type="range" min="0" max="100" step="1" value={p.x*100} onChange={event=>update(selected,{x:Number(event.target.value)/100})}/></label>
     <label>Vertical · {Math.round(p.y*100)}%<input aria-label="Vertical position" type="range" min="0" max="100" step="1" value={p.y*100} onChange={event=>update(selected,{y:Number(event.target.value)/100})}/></label>
    </div>
    <button type="button" onClick={()=>setLayouts(current=>({...current,[orientation]:defaultTouchLayout(viewport.width,viewport.height,settings.touchScale)}))}>Arrange this layout automatically</button>
    {overlapping&&<p role="status">Some controls overlap. Separate them if they are hard to tap.</p>}
   </>}
  </section>
 </div>,document.body);
}
