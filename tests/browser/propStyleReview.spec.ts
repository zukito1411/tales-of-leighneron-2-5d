import {test,expect} from '@playwright/test';
import type {} from './propStyleFixture';

for(const width of [1280,844])test(`painted interior furniture at ${width}px`,async({browser})=>{
  test.setTimeout(90000);
  const context=await browser.newContext({viewport:{width,height:800}});
  const page=await context.newPage(),errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'||/INVALID|feedback loop|too many errors/i.test(message.text()))errors.push(message.text());});
  try{
    await page.goto('/tests/browser/propStyleReview.html');
    await page.waitForFunction(()=>window.__propStyleReview?.ready,null,{timeout:15000});
    const count=await page.evaluate(()=>window.__propStyleReview.scene!.children.list.filter(child=>child.name.startsWith('review:')).length);
    expect(count).toBe(9);
    await page.screenshot({path:`test-results/furnishings-front-${width}.png`});
    await page.evaluate(()=>{
      const r=window.__propStyleReview;r.yaw=Math.PI/2;
      for(const object of r.scene!.children.list){
        const group=object.getData('reviewGroup');
        if(group)(object as import('phaser').GameObjects.Image).setVisible(group==='detail');
      }
      r.scene!.cameras.main.setZoom(r.game.scale.width<1000?1:1.35);
    });
    await page.waitForTimeout(150);
    await page.screenshot({path:`test-results/furnishings-side-${width}.png`});
    expect(errors).toEqual([]);
  }finally{await context.close();}
});
