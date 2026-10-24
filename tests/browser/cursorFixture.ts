import {OrbitCamera} from '../../src/game/presentation25d/OrbitCamera';
import {mobileInput} from '../../src/game/input';
const canvas=document.querySelector<HTMLCanvasElement>('#world')!;
const menu=document.querySelector<HTMLElement>('#menu')!;
const button=document.querySelector<HTMLButtonElement>('#toggle-menu')!;
const state={menu:false,pauses:0,picks:0,frame:0,orbit:undefined as unknown as OrbitCamera,
  get attackHeld(){return mobileInput.attackHeld;},destroy(){cancelAnimationFrame(state.frame);state.orbit.destroy();}};
declare global {interface Window {__cursorReview:typeof state}}
window.__cursorReview=state;
state.orbit=new OrbitCamera(canvas,document.body,()=>state.picks++,()=>state.pauses++,()=>!state.menu);
button.onclick=()=>{state.menu=!state.menu;menu.hidden=!state.menu;button.textContent=state.menu?'Close menu':'Open menu';};
const native={width:1280,height:800,zoom:1,shakeEffect:{isRunning:false}} as unknown as Parameters<OrbitCamera['update']>[0];
function frame(){state.orbit.update(native,{x:0,y:0},()=>0,16,!state.menu);state.frame=requestAnimationFrame(frame);}
frame();
