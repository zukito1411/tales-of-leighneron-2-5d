import {expect,test} from '@playwright/test';
import type {} from './combatDepthFixture';

test('wave energy has a bright core and animated detail with blue and weapon palettes',async({browser})=>{
  test.setTimeout(60000);
  const context=await browser.newContext({viewport:{width:1280,height:850}}),page=await context.newPage(),errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'||/INVALID|feedback loop|Shader Error/i.test(m.text()))errors.push(m.text());});
  try{
    await page.goto('/tests/browser/combatDepthReview.html?direction');await page.waitForFunction(()=>window.__combatDepthReview?.ready);
    for(const [name,color] of [['blue',undefined],['orange',0xffa348]] as const){
      await page.evaluate(async(color)=>{
        const r=window.__combatDepthReview;r.aim(Math.PI/2,0,'wave',color);r.yaw=-Math.PI;r.pitch=Math.PI/6;r.time(.35);
        await new Promise<void>(resolve=>r.game.events.once('postrender',()=>resolve()));
      },color);
      const first=await page.evaluate(()=>window.__combatDepthReview.silhouette());expect(first.hot).toBeGreaterThan(10);
      await page.screenshot({path:`test-results/wave-energy-${name}.png`});
      await page.evaluate(()=>window.__combatDepthReview.time(.6));
      const flowing=await page.evaluate(()=>window.__combatDepthReview.silhouette());expect(flowing.hash).not.toBe(first.hash);
      await page.screenshot({path:`test-results/wave-energy-${name}-flow.png`});
    }
    expect(errors).toEqual([]);
  }finally{await context.close();}
});
