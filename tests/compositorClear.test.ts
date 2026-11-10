import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

// A full-screen opaque NoBlending final quad overwrites every default
// framebuffer pixel. Its original pre-clear was redundant. Direct rendering
// and loading scenes still require that clear and must never inherit pixels.
const base=new URL('../src/game/presentation25d/',import.meta.url);
const source=(name:string)=>readFileSync(new URL(name,base),'utf8');

describe('mobile compositor default framebuffer clear ownership',()=>{
  const renderer=source('ThreePresentation.ts');
  const compositor=source('WorldPostFX.ts');

  it('does not clear default color/depth before an opaque fullscreen composite',()=>{
    expect(renderer).toContain('this.renderer.setClearColor(camera.backgroundColor.color,1);');
    expect(renderer).not.toContain('this.renderer.setClearColor(camera.backgroundColor.color,1);this.renderer.clear();');
    expect(compositor).toContain('new PlaneGeometry(2,2)');
    expect(compositor).toContain('new OrthographicCamera(-1,1,1,-1,0,1)');
    expect(compositor).toContain('blending:NoBlending,toneMapped:false');
    expect(compositor).toContain('renderer.setRenderTarget(previous);renderer.render(this.scene,this.camera)');
  });

  it('keeps the original clear when the full-screen compositor is bypassed',()=>{
    const fallthrough=compositor.indexOf('this.releaseTargets();\n      // No fullscreen composite');
    const clear=compositor.indexOf('renderer.clear();',fallthrough);
    const sky=compositor.indexOf('frame.sky?.render(renderer)',fallthrough);
    const world=compositor.indexOf('renderer.render(frame.world,frame.camera)',fallthrough);
    expect(fallthrough).toBeGreaterThan(0);
    expect(clear).toBeGreaterThan(fallthrough);
    expect(clear).toBeLessThan(sky);
    expect(sky).toBeLessThan(world);
  });
});
