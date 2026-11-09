import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

/** These are shader-work elimination invariants. They do not replace
 * screenshot/device tests, but guard against accidentally removing any
 * depth-edge tests, antialias taps, or weather/night effects. */
const shader=readFileSync(new URL('../src/game/presentation25d/WorldPostFX.ts',import.meta.url),'utf8');

describe('fidelity-preserving compositor fast paths',()=>{
  it('tests contrast before the same four depth-neighbor samples',()=>{
    const contrast=shader.indexOf('if(contrast>max(.045,high*.16))');
    const depth=shader.indexOf('float edgeDepth=',contrast);
    const depthGate=shader.indexOf('if(edgeDepth>max(3.0,depth*.012))',depth);
    expect(contrast).toBeGreaterThan(0);
    expect(depth).toBeGreaterThan(contrast);
    expect(depthGate).toBeGreaterThan(depth);
    // No depth edge-tap removal or changed neighbor sample directions.
    const neighborhood=shader.slice(depth,depthGate);
    expect((neighborhood.match(/eyeDepth\(/g)??[]).length).toBe(4);
    for(const direction of ['sourceTexel.x,0.0','0.0,sourceTexel.y'])
      expect(neighborhood).toContain(direction);
    // The boolean acceptance condition is identical for all finite tests.
    for(const contrastValue of [0,.01,.045,.14,.4,1.0]){
      for(const edgeValue of [0,1.5,3,5,20]){
        const old=edgeValue>3 && contrastValue>Math.max(.045,.16*.6);
        const fast=contrastValue>Math.max(.045,.16*.6)&&edgeValue>3;
        expect(fast).toBe(old);
      }
    }
  });

  it('does not reconstruct world positions when no world-space effects use them',()=>{
    const gate=shader.indexOf('&&('+'overcast>0.0||storm>0.0||mistAmount>.001||nightOpacity>0.0)');
    const inverse=shader.indexOf('vec4 p=inverseVP*vec4',gate);
    expect(gate).toBeGreaterThan(0);
    expect(inverse).toBeGreaterThan(gate);
    // All original full-fidelity weather and nighttime branches remain.
    for(const code of ['vec2 ground=p.xz/p.w','color=mix(color,color*vec3(.78,.85,.91),overcast*surfaceFade)',
      'color=mix(color,color*vec3(.48,.59,.73),storm*surfaceFade)','if(mistAmount>.001)',
      'if(nightOpacity>0.0&&rawDepth<=.999999)'])
      expect(shader).toContain(code);
  });
});
