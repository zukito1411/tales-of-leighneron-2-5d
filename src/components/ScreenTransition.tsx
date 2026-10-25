import type {CSSProperties} from 'react';
import {useGameStore} from '../store/gameStore';
import '../screen-transition.css';

const SKY_ATLAS=import.meta.env.BASE_URL+'assets/environment/sky-atlas-v1.png';

/** Display a complete atlas cell, preserving the illustrated halo and aspect. */
function SkyArt({cell,className}:{cell:'sun'|'moon'|'cloud'|'cloud-bank';className:string}){
  return <span className={`rest-art rest-art--${cell} ${className}`}>
    <img src={SKY_ATLAS} alt="" decoding="async" draggable={false}/>
  </span>;
}

export function ScreenTransition(){
  const state=useGameStore(s=>s.screenTransition);
  if(!state)return null;
  const cycle=state.kind==='sleep'&&['night','morning','fade-in'].includes(state.phase);
  const style={
    '--transition-duration':`${state.duration}ms`,'--night-duration':`${state.nightDuration}ms`,
    animationPlayState:state.paused?'paused':'running',
  } as CSSProperties;
  return <div key={state.id} className={`journey-screen journey-screen--${state.phase}`} style={style}
    role="status" aria-live="polite" aria-label={state.kind==='sleep'?'Resting until morning':[state.caption,state.label].filter(Boolean).join(' · ')}
    onPointerDown={e=>{e.preventDefault();e.stopPropagation();}} onClick={e=>e.stopPropagation()}>
    {state.kind==='sleep'?<>
      {/* Mount during fade-out so the existing atlas can decode before night. */}
      <div className={`rest-night${!cycle?' rest-night--waiting':state.phase!=='night'?' rest-night--complete':''}`} aria-hidden="true"
        style={{animationPlayState:state.paused?'paused':'running'}}>
        <div className="rest-night__dawn"/>
        <SkyArt cell="moon" className="rest-night__moon"/>
        <SkyArt cell="sun" className="rest-night__sun"/>
        <div className="rest-night__clouds">
          <SkyArt cell="cloud" className="rest-night__cloud-left"/>
          <SkyArt cell="cloud-bank" className="rest-night__cloud-right"/>
        </div>
        <div className="rest-night__shade"/>
        <div className="rest-night__caption"><span>Morning</span><strong>06:00</strong></div>
      </div>
      {!cycle&&<p className="journey-screen__caption journey-screen__rest-label">Resting until morning</p>}
    </>:<div className="journey-screen__caption">
      {state.caption&&<p className="journey-screen__route">{state.caption}</p>}
      <h2 className="journey-screen__destination">{state.label}</h2>
      <div className="journey-screen__rule" aria-hidden="true"/>
    </div>}
  </div>;
}
