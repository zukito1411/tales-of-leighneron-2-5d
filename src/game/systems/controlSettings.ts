import {sanitizeTouchLayouts,type TouchLayouts} from './touchLayout';
// Device preferences are separate from progress saves. Numeric codes match
// Phaser's keyboard API; reserved browser/menu controls stay available.
export const CONTROL_SETTINGS_EVENT='leighneron-controls-changed';
export const DEFAULT_KEYS={up:87,down:83,left:65,right:68,sprint:16,dash:81,attack:70,jump:32,interact:69,
 skill1:49,skill2:50,skill3:51,skill4:52,healPotion:53,staminaPotion:54,targetLock:82} as const;
export type BindingAction=keyof typeof DEFAULT_KEYS;
export interface ControlSettings {keys:Record<BindingAction,number>;touchScale:number;touchLayouts?:TouchLayouts}
const STORAGE_KEY='leighneron:controls:v1';
const reserved=new Set([9,13,18,27,66,67,73,74,77,86,91,92,93]);
const allowed=(code:number)=>Number.isInteger(code)&&!reserved.has(code)
 &&(code>=48&&code<=90||code>=37&&code<=40||code>=96&&code<=111||[16,17,32,188,190,191,186,187,189,219,220,221,222].includes(code));
let cached:ControlSettings|undefined;
export function getControlSettings():ControlSettings {
 if(cached)return cached;
 const settings:ControlSettings={keys:{...DEFAULT_KEYS},touchScale:1};
 try{
  const value:unknown=JSON.parse(localStorage.getItem(STORAGE_KEY)??'null');
  if(value&&typeof value==='object'){
   const input=value as {keys?:Record<string,unknown>;touchScale?:unknown;touchLayouts?:unknown};
   const candidate={...settings.keys};
   for(const action of Object.keys(DEFAULT_KEYS) as BindingAction[]){const key=input.keys?.[action];if(typeof key==='number'&&allowed(key))candidate[action]=key;}
   if(new Set(Object.values(candidate)).size===Object.keys(candidate).length)settings.keys=candidate;
   settings.touchLayouts=sanitizeTouchLayouts(input.touchLayouts);
   if(typeof input.touchScale==='number'&&Number.isFinite(input.touchScale))settings.touchScale=Math.max(.8,Math.min(1.3,input.touchScale));
  }
 }catch{/* Retain usable defaults when device storage is restricted. */}
 cached=settings;return settings;
}
function save(settings:ControlSettings){cached=settings;let persisted=true;try{localStorage.setItem(STORAGE_KEY,JSON.stringify(settings));}catch{persisted=false;}
 window.dispatchEvent(new Event(CONTROL_SETTINGS_EVENT));return persisted;}
export function setTouchLayouts(layouts:TouchLayouts){return save({...getControlSettings(),touchLayouts:sanitizeTouchLayouts(layouts)});}
export function bindControl(action:BindingAction,code:number):string|null {
 if(!allowed(code))return 'That key is reserved for menus, camera controls, or the browser.';
 const current=getControlSettings(),duplicate=(Object.keys(current.keys) as BindingAction[]).find(a=>a!==action&&current.keys[a]===code);
 if(duplicate)return 'That key is already assigned to '+CONTROL_LABELS[duplicate]+'.';
 save({...current,keys:{...current.keys,[action]:code}});return null;
}
export function setTouchScale(scale:number){if(Number.isFinite(scale))save({...getControlSettings(),touchScale:Math.max(.8,Math.min(1.3,scale))});}
export function resetControlSettings(){save({keys:{...DEFAULT_KEYS},touchScale:1});}
export function keyLabel(code:number){return ({16:'Shift',17:'Ctrl',32:'Space',37:'←',38:'↑',39:'→',40:'↓',106:'Num *',107:'Num +',109:'Num −',110:'Num .',111:'Num /',186:';',187:'=',188:',',189:'−',190:'.',191:'/',219:'[',220:'\\',221:']',222:"'"} as Record<number,string>)[code]
 ??(code>=96&&code<=105?'Num '+(code-96):String.fromCharCode(code));}
export const CONTROL_LABELS:Record<BindingAction,string>={up:'Forward',down:'Backward',left:'Left',right:'Right',sprint:'Sprint',dash:'Dash',attack:'Attack',jump:'Jump',interact:'Interact',
 skill1:'Art slot 1',skill2:'Art slot 2',skill3:'Art slot 3',skill4:'Art slot 4',healPotion:'Health supply',staminaPotion:'Stamina supply',targetLock:'Lock target'};
