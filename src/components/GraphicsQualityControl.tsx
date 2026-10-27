import { useState } from 'react';
import { getEffectsQuality, setEffectsQuality, type EffectsQuality } from '../game/systems/effectsQuality';

export function GraphicsQualityControl() {
  const [quality, setQuality] = useState(getEffectsQuality);
  return <label className="graphics-quality">
    <span><strong>Visual quality</strong><small>High gives the clearest world, smoother model edges and stronger texture filtering. Normal balances detail and GPU cost. Low uses smaller buffers and lighter effects. All keep the same artwork and buildings. Reopen the game after changing quality to apply all model and texture settings.</small></span>
    <select value={quality} onChange={e => {
      const next = e.target.value as EffectsQuality;
      setQuality(next); setEffectsQuality(next);
    }} aria-label="Visual effects quality">
      <option value="high">High</option>
      <option value="normal">Normal</option>
      <option value="low">Low</option>
    </select>
  </label>;
}
