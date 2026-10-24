import {test,expect} from '@playwright/test';
import type {} from './propStyleFixture';

for(const width of [1280,844])test(`horse and painted 3D props at ${width}px`,async({browser})=>{
  test.setTimeout(90000);
  const context=await browser.newContext({viewport:{width,height:800}});
  const page=await context.newPage(),errors:string[]=[];
  page.on('pageerror',error=>{errors.push(error.message);console.log('Review page error:',error.message);});
  page.on('console',message=>{if(message.type()==='error'||/INVALID|feedback loop|too many errors/i.test(message.text()))errors.push(message.text());});
  try{
    await page.goto('/tests/browser/propStyleReview.html');
    await page.waitForFunction(()=>window.__propStyleReview?.ready,null,{timeout:15000});
    const report=()=>page.evaluate(async()=>{const path='/tests/browser/propStyleFixture.ts';const fixture=await import(path) as typeof import('./propStyleFixture');return fixture.horseReport();});
    for(const [name,dx,dy] of [
      ['front',0,1],['rear',0,-1],['left',-1,0],['right',1,0],
    ] as const){
      await page.evaluate(({dx,dy})=>Object.assign(window.__propStyleReview,{dx,dy,yaw:0}),{dx,dy});
      await expect.poll(async()=>Math.cos((await report())[0].rotation)).toBeCloseTo(Math.cos(Math.atan2(dx,-dy)));
      expect(Math.sin((await report())[0].rotation)).toBeCloseTo(Math.sin(Math.atan2(dx,-dy)));
      const rows=await report();
      expect(rows.map(row=>row.pose)).toEqual([0,1,2,3]);
      for(const row of rows){expect(row.texture).toBe('horse-model-paint');expect(row.flip).toBe(false);expect(row.hint.furniture?.art).toBe('travel-horse');expect(row.hint.anchor).toBeUndefined();expect(Math.hypot(row.x-row.cartX,row.y-row.cartY)).toBeCloseTo(130);}
      await page.waitForTimeout(120);
      const pixel=await page.evaluate(async()=>{
        const planePath='/src/game/presentation25d/plane.ts',pixelPath='/tests/browser/presentationProbe.ts';
        const {projectWorldPoint}=await import(planePath) as typeof import('../../src/game/presentation25d/plane');
        const {presentedPixel}=await import(pixelPath) as typeof import('./presentationProbe');
        const r=window.__propStyleReview,v=r.vehicles[1],scene=r.scene!,p={x:0,y:0};
        projectWorldPoint(scene,v.sprite.x,50,v.sprite.y,p);
        return presentedPixel(r.game,p.x*scene.cameras.main.zoom,p.y*scene.cameras.main.zoom);
      });
      expect(pixel.red).toBeGreaterThan(pixel.green);
      await page.screenshot({path:`test-results/props-${name}-${width}.png`});
    }
    // Orbit changes the view of real geometry, never its texture or heading.
    await page.evaluate(()=>Object.assign(window.__propStyleReview,{dx:0,dy:1,yaw:Math.PI/2}));
    await expect.poll(async()=>Math.cos((await report())[0].rotation)).toBeCloseTo(-1);
    await page.screenshot({path:`test-results/props-orbit-${width}.png`});
    await page.evaluate(()=>Object.assign(window.__propStyleReview,{yaw:Math.PI,moving:false}));
    await expect.poll(async()=>(await report()).map(row=>row.pose)).toEqual([0,0,0,0]);
    await page.evaluate(()=>Object.assign(window.__propStyleReview,{yaw:0,moving:true,animate:true}));
    const before=(await report())[0];
    await expect.poll(async()=>(await report())[0].pose).not.toBe(before.pose);
    expect((await report())[0].wheel).not.toBe(before.wheel);
    await page.evaluate(()=>{
      const r=window.__propStyleReview;r.animate=false;r.yaw=0;
      for(const vehicle of r.vehicles){vehicle.sprite.setVisible(false);vehicle.horse!.setVisible(false);}
      for(const object of r.scene!.children.list){
        const group=object.getData('reviewGroup');
        if(group)(object as import('phaser').GameObjects.Image).setVisible(group==='detail');
      }
      r.scene!.cameras.main.setZoom(r.game.scale.width<1000?1:1.35);
    });
    await page.waitForTimeout(150);
    await page.screenshot({path:`test-results/props-interior-detail-${width}.png`});
    expect(errors).toEqual([]);
  }finally{
    await context.close();
  }
});
