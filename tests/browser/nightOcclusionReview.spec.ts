import {expect,test} from '@playwright/test';
import type {} from './nightOcclusionFixture';

test('night halos and darkness pockets are hidden by foreground walls',async({browser})=>{
  test.setTimeout(60000);
  const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'||/INVALID|feedback loop|too many errors/i.test(message.text()))errors.push(message.text());});
  try{
    await page.goto('/tests/browser/nightOcclusionReview.html');await page.waitForFunction(()=>window.__nightOcclusionReview?.ready);
    const sample=async(wall:boolean,light:boolean,offset=0)=>{
      await page.evaluate(({wall,light})=>Object.assign(window.__nightOcclusionReview,{wall,light}),{wall,light});
      await page.waitForTimeout(100);
      return page.evaluate(offset=>window.__nightOcclusionReview.pixel(offset),offset);
    };
    const blocked=await sample(true,true),unlitWall=await sample(true,false);
    const difference=Math.abs(blocked.red-unlitWall.red)+Math.abs(blocked.green-unlitWall.green)+Math.abs(blocked.blue-unlitWall.blue);
    expect(difference).toBeLessThan(8);
    await sample(true,true);await page.screenshot({path:'test-results/night-light-blocked.png'});
    const visible=await sample(false,true),unlit=await sample(false,false);
    expect(visible.red+visible.green+visible.blue).toBeGreaterThan(unlit.red+unlit.green+unlit.blue+40);
    const halo=await sample(false,true,30),noHalo=await sample(false,false,30);
    expect(halo.red+halo.green+halo.blue).toBeGreaterThan(noHalo.red+noHalo.green+noHalo.blue+8);
    await sample(false,true);await page.screenshot({path:'test-results/night-light-visible.png'});
    console.log({blocked,unlitWall,visible,unlit,halo,noHalo});
    expect(errors).toEqual([]);
  }finally{await context.close();}
});
