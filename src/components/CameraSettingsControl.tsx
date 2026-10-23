import {useState} from 'react';
import {getCameraSettings,setCameraSettings} from '../game/presentation25d/cameraSettings';
export function CameraSettingsControl(){
  const [settings,setSettings]=useState(getCameraSettings);
  return <div className="graphics-effects-control">
    <label className="graphics-quality"><span><strong>Camera sensitivity</strong><small>Mouse look; wheel zoom. Swipe upward to look at the sky; pinch to zoom.</small></span>
      <input aria-label="Camera sensitivity" type="range" min="0.3" max="2" step="0.1" value={settings.sensitivity}
        onChange={event=>{const next={...settings,sensitivity:Number(event.target.value)};setCameraSettings(next);setSettings(next);}}/>
    </label>
    <label><input type="checkbox" checked={settings.invertY} onChange={event=>{const next={...settings,invertY:event.target.checked};setCameraSettings(next);setSettings(next);}}/> Invert camera vertical movement</label>
  </div>;
}
