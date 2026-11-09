/** Real-time residency windows: render frequency must not shorten the
 * camera-turn reuse period or force repeated full-resolution uploads. */
export const TEXTURE_IDLE_MS=5000;
export const TEXTURE_RESIDENCY_GRACE_MS=2000;
const PRESSURE_GRACE_MS=850;
const EMERGENCY_GRACE_MS=65;

/** Soft pressure retains recently used artwork; emergency pressure reclaims
 * resources more aggressively without ever changing texture resolution. */
export function textureGraceMs(residentBytes:number,softBytes:number,emergencyBytes:number){
  return residentBytes>emergencyBytes?EMERGENCY_GRACE_MS
    :residentBytes>softBytes?PRESSURE_GRACE_MS:TEXTURE_RESIDENCY_GRACE_MS;
}
