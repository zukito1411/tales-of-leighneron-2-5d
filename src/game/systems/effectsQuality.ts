export type EffectsQuality = 'low' | 'normal';
const KEY = 'leighneron:effects-quality';
export const EFFECTS_QUALITY_EVENT = 'leighneron-effects-quality';
let cached:EffectsQuality|undefined;

export function getEffectsQuality(): EffectsQuality {
  if(cached)return cached;
  try {
    const setting = localStorage.getItem(KEY);
    if (setting === 'low' || setting === 'normal') return cached=setting;
  } catch { /* Restricted storage: use device defaults. */ }
  // Touch input does not imply a weak GPU. Keep full detail by default;
  // explicitly chosen Low remains available and is never overwritten.
  return cached='normal';
}

export function setEffectsQuality(quality: EffectsQuality) {
  cached=quality;
  try { localStorage.setItem(KEY, quality); } catch { /* Settings remain session-local. */ }
  window.dispatchEvent(new Event(EFFECTS_QUALITY_EVENT));
}
