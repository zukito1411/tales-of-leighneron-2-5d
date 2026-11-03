import {useSyncExternalStore} from 'react';
import {CONTROL_SETTINGS_EVENT,getControlSettings} from '../game/systems/controlSettings';
const subscribe=(notify:()=>void)=>{
 window.addEventListener(CONTROL_SETTINGS_EVENT,notify);
 return()=>window.removeEventListener(CONTROL_SETTINGS_EVENT,notify);
};
/** Preferences change only on explicit settings edits, never simulation ticks. */
export const useControlSettings=()=>useSyncExternalStore(subscribe,getControlSettings,getControlSettings);
