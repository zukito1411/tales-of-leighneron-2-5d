/** Preserve full-detail authored textures without tying their lifetime to
 * 60/90/120/144Hz frame counts. This file is pure so policy can be tested
 * without constructing a WebGL context or allocating image memory. */
export const TEXTURE_IDLE_MS=5000;
export const TEXTURE_RESIDENCY_GRACE_MS=2000;

/** The chunk streamer renews its active-source keepalive every ~150 ms.
 * A 600ms lease covers scheduling jitter, camera rotation, and a busy frame
 * without keeping already-unloaded scenery alive indefinitely. */
export const ACTIVE_SOURCE_LEASE_MS=600;
export const RECENT_PRESSURE_RECREATE_MS=5000;

/** High memory pressure may shorten stale residency, but never to two or
 * three render frames: a retained sprite batch may need the same full-detail
 * texture again after a short camera pan. No texture resolution changes. */
const PRESSURE_GRACE_MS=1400;
const EMERGENCY_GRACE_MS=1100;

export function textureGraceMs(residentBytes:number,softBytes:number,emergencyBytes:number){
  return residentBytes>emergencyBytes?EMERGENCY_GRACE_MS
    :residentBytes>softBytes?PRESSURE_GRACE_MS:TEXTURE_RESIDENCY_GRACE_MS;
}

/** An actively streamed, already resident source is never eligible for
 * speculative pressure retirement. Invalid/destroyed sources still release
 * immediately in TextureCache.prune. */
export function mayRetireTexture(nowMs:number,lastUsedAtMs:number,leaseUntilMs:number,graceMs:number){
  return nowMs>=leaseUntilMs&&nowMs-lastUsedAtMs>graceMs;
}
