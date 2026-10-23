import { useState } from 'react';
import { getEffectsQuality, setEffectsQuality, type EffectsQuality } from '../game/systems/effectsQuality';

export function GraphicsQualityControl() {
  const [quality, setQuality] = useState(getEffectsQuality);
  return <label className="graphics-quality">
    <span><strong>Visual quality</strong><small>Low uses smaller render buffers and less frequent lighting/weather updates. All artwork stays enabled.</small></span>
    <select value={quality} onChange={e => {
      const next = e.target.value as EffectsQuality;
      setQuality(next); setEffectsQuality(next);
    }} aria-label="Visual effects quality">
      <option value="low">Low / mobile</option>
      <option value="normal">Normal</option>
    </select>
  </label>;
}
