import {useSyncExternalStore} from 'react';
import type {TouchOrientation} from '../game/systems/touchLayout';
const query='(orientation: portrait)';
let media:MediaQueryList|undefined;
const orientationMedia=()=>media??=window.matchMedia(query);
const subscribe=(notify:()=>void)=>{const media=orientationMedia();media.addEventListener('change',notify);return()=>media.removeEventListener('change',notify);};
const snapshot=():TouchOrientation=>orientationMedia().matches?'portrait':'landscape';
export const useTouchOrientation=()=>useSyncExternalStore(subscribe,snapshot,():TouchOrientation=>'landscape');
