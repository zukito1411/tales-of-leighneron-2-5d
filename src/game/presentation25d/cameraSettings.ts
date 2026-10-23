export const CAMERA_SETTINGS_EVENT='leighneron-camera-settings';
const KEY='leighneron:camera:v1';
export interface CameraSettings {sensitivity:number;invertY:boolean}
let cached:CameraSettings|undefined;
export function getCameraSettings():CameraSettings {
  if(cached)return cached;let value:Partial<CameraSettings>={};
  try{value=JSON.parse(localStorage.getItem(KEY)??'{}')??{};}catch{}
  cached={sensitivity:typeof value.sensitivity==='number'&&Number.isFinite(value.sensitivity)?Math.max(.3,Math.min(2,value.sensitivity)):1,invertY:value.invertY===true};return cached;
}
export function setCameraSettings(settings:CameraSettings){
  cached={sensitivity:Math.max(.3,Math.min(2,settings.sensitivity)),invertY:settings.invertY};
  try{localStorage.setItem(KEY,JSON.stringify(cached));}catch{}
  window.dispatchEvent(new Event(CAMERA_SETTINGS_EVENT));
}
