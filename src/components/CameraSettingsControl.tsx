import {useEffect,useState} from 'react';
import {getCameraSettings,setCameraSettings,CAMERA_SETTINGS_EVENT,type CameraMode} from '../game/presentation25d/cameraSettings';
export function CameraSettingsControl(){
  const [settings,setSettings]=useState(getCameraSettings);
  useEffect(()=>{const changed=()=>setSettings(getCameraSettings());window.addEventListener(CAMERA_SETTINGS_EVENT,changed);return ()=>window.removeEventListener(CAMERA_SETTINGS_EVENT,changed);},[]);
  return <div className="graphics-effects-control">
    <label className="graphics-quality"><span><strong>Camera view</strong><small>Press V during play to switch views. Touch: swipe to look and use the joystick to move.</small></span>
      <select aria-label="Camera view" value={settings.mode} onChange={event=>setCameraSettings({...settings,mode:event.target.value as CameraMode})}>
        <option value="third-person">Third person</option><option value="first-person">First person</option>
      </select>
    </label>
    {settings.mode==='first-person'&&<label className="graphics-quality"><span><strong>First-person field of view</strong><small>{settings.firstPersonFov}°</small></span>
      <input aria-label="First-person field of view" type="range" min="60" max="90" step="1" value={settings.firstPersonFov} onChange={event=>setCameraSettings({...settings,firstPersonFov:Number(event.target.value)})}/>
    </label>}
    <label className="graphics-quality"><span><strong>Camera sensitivity</strong><small>Mouse look; wheel zoom. Swipe upward to look at the sky; pinch to zoom.</small></span>
      <input aria-label="Camera sensitivity" type="range" min="0.3" max="2" step="0.1" value={settings.sensitivity}
        onChange={event=>{const next={...settings,sensitivity:Number(event.target.value)};setCameraSettings(next);setSettings(next);}}/>
    </label>
    <label><input type="checkbox" checked={settings.invertY} onChange={event=>{const next={...settings,invertY:event.target.checked};setCameraSettings(next);setSettings(next);}}/> Invert camera vertical movement</label>
  </div>;
}
