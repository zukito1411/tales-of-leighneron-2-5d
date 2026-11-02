export const CAMERA_SETTINGS_EVENT='leighneron-camera-settings';
const KEY='leighneron:camera:v1';
export type CameraMode='third-person'|'first-person';
export interface CameraSettings {sensitivity:number;invertY:boolean;mode:CameraMode;firstPersonFov:number}
let cached:CameraSettings|undefined;
export function getCameraSettings():CameraSettings {
  if(cached)return cached;let value:Partial<CameraSettings>={};
  try{value=JSON.parse(localStorage.getItem(KEY)??'{}')??{};}catch{}
  cached={sensitivity:typeof value.sensitivity==='number'&&Number.isFinite(value.sensitivity)?Math.max(.3,Math.min(2,value.sensitivity)):1,invertY:value.invertY===true,
    mode:value.mode==='first-person'?'first-person':'third-person',firstPersonFov:typeof value.firstPersonFov==='number'&&Number.isFinite(value.firstPersonFov)?Math.max(60,Math.min(90,value.firstPersonFov)):75};return cached;
}
export function setCameraSettings(settings:Pick<CameraSettings,'sensitivity'|'invertY'>&Partial<Pick<CameraSettings,'mode'|'firstPersonFov'>>){
  const previous=getCameraSettings();
  cached={sensitivity:Number.isFinite(settings.sensitivity)?Math.max(.3,Math.min(2,settings.sensitivity)):previous.sensitivity,invertY:settings.invertY,
    mode:settings.mode??previous.mode,firstPersonFov:typeof settings.firstPersonFov==='number'&&Number.isFinite(settings.firstPersonFov)?Math.max(60,Math.min(90,settings.firstPersonFov)):previous.firstPersonFov};
  try{localStorage.setItem(KEY,JSON.stringify(cached));}catch{}
  window.dispatchEvent(new Event(CAMERA_SETTINGS_EVENT));
}
export function toggleCameraMode(){const value=getCameraSettings();setCameraSettings({...value,mode:value.mode==='first-person'?'third-person':'first-person'});}
