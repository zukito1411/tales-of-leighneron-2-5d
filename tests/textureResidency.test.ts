import {describe,expect,it} from 'vitest';
import {ACTIVE_SOURCE_LEASE_MS,RECENT_PRESSURE_RECREATE_MS,mayRetireTexture,textureGraceMs,textureCacheBudgetMiB,TEXTURE_IDLE_MS,TEXTURE_RESIDENCY_GRACE_MS}
  from '../src/game/presentation25d/textureResidency';

describe('full-resolution texture residency on high-refresh mobile',()=>{
  const soft=128*1048576,emergency=288*1048576;
  it('keeps high-RAM rotating-camera working sets resident without losing graphics',()=>{
    expect(textureCacheBudgetMiB(16,true)).toEqual({softMiB:512,emergencyMiB:640});
    expect(textureCacheBudgetMiB(8,true)).toEqual({softMiB:512,emergencyMiB:640});
    expect(textureCacheBudgetMiB(4,true)).toEqual({softMiB:320,emergencyMiB:448});
    expect(textureCacheBudgetMiB(2,true)).toEqual({softMiB:128,emergencyMiB:288});
    expect(textureCacheBudgetMiB(undefined,true)).toEqual({softMiB:128,emergencyMiB:288});
    expect(textureCacheBudgetMiB(16,false)).toEqual({softMiB:256,emergencyMiB:448});
    expect(textureCacheBudgetMiB(Infinity,true)).toEqual({softMiB:128,emergencyMiB:288});
    // 434MiB is above the old 128MiB phone soft budget, but below
    // the maximum bounded 512MiB high-RAM working-set target.
    expect(434*1048576).toBeLessThan(textureCacheBudgetMiB(16,true).softMiB*1048576);
  });
  it('retains textures by elapsed milliseconds rather than render frame counts',()=>{
    expect(TEXTURE_IDLE_MS).toBe(5000);
    expect(textureGraceMs(100*1048576,soft,emergency)).toBe(TEXTURE_RESIDENCY_GRACE_MS);
    expect(textureGraceMs(239*1048576,soft,emergency)).toBe(1400);
    expect(textureGraceMs(350*1048576,soft,emergency)).toBe(1100);
  });
  it('protects camera turns even above the 288MiB emergency threshold',()=>{
    const grace=textureGraceMs(420*1048576,soft,emergency);
    expect(grace).toBeGreaterThan(1000);
    // No texture can be evicted merely because it was absent for 4-6 120Hz frames.
    expect(mayRetireTexture(1000+80,1000,0,grace)).toBe(false);
    expect(mayRetireTexture(1000+1150,1000,0,grace)).toBe(true);
  });
  it('honors the active-chunk lease even when not directly rendered for seconds',()=>{
    const grace=textureGraceMs(420*1048576,soft,emergency);
    const lastRendered=1000,now=2500,leaseUntil=now+ACTIVE_SOURCE_LEASE_MS;
    expect(mayRetireTexture(now,lastRendered,leaseUntil,grace)).toBe(false);
    // The next update of the active chunk renews the lease.
    expect(mayRetireTexture(now+200,lastRendered,now+200+ACTIVE_SOURCE_LEASE_MS,grace)).toBe(false);
    // Once chunk no longer requests residency, cold resources reclaim normally.
    expect(mayRetireTexture(leaseUntil+1,lastRendered,leaseUntil,grace)).toBe(true);
  });
  it('does not permanently pin old scenery or disable emergency reclamation',()=>{
    expect(ACTIVE_SOURCE_LEASE_MS).toBeGreaterThan(150);
    expect(ACTIVE_SOURCE_LEASE_MS).toBeLessThan(TEXTURE_IDLE_MS);
    expect(mayRetireTexture(30000,1000,1600,1100)).toBe(true);
    expect(RECENT_PRESSURE_RECREATE_MS).toBeGreaterThan(1100);
    expect(textureGraceMs(emergency,soft,emergency)).toBe(1400);
    expect(textureGraceMs(emergency+1,soft,emergency)).toBe(1100);
  });
});
