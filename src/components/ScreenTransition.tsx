import type {CSSProperties} from 'react';
import {useGameStore} from '../store/gameStore';
import '../screen-transition.css';

export function ScreenTransition(){
  const state=useGameStore(s=>s.screenTransition);
  if(!state)return null;
  const cycle=state.kind==='sleep'&&['night','morning','fade-in'].includes(state.phase);
  const style={
    '--transition-duration':`${state.duration}ms`,'--night-duration':`${state.nightDuration}ms`,
    animationPlayState:state.paused?'paused':'running',
  } as CSSProperties;
  return <div key={state.id} className={`journey-screen journey-screen--${state.phase}`} style={style}
    role="status" aria-live="polite" aria-label={state.kind==='sleep'?'Resting until morning':state.label}
    onPointerDown={e=>{e.preventDefault();e.stopPropagation();}} onClick={e=>e.stopPropagation()}>
    {cycle?<div className={`rest-night${state.phase!=='night'?' rest-night--complete':''}`} aria-hidden="true"
      style={{animationPlayState:state.paused?'paused':'running'}}>
      <div className="rest-night__dawn"/><div className="rest-night__stars"/>
      <div className="rest-night__moon"/><div className="rest-night__sun"/>
      <div className="rest-night__horizon"/>
      <div className="rest-night__caption"><span>Morning</span><strong>06:00</strong></div>
    </div>:<p className="journey-screen__label">{state.label}</p>}
  </div>;
}
