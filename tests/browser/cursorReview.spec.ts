import {expect,test} from '@playwright/test';
import type {} from './cursorFixture';

test('holding Alt releases the cursor without pausing and respects open menus',async({browser})=>{
  const context=await browser.newContext(),page=await context.newPage();
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.goto('/tests/browser/cursorReview.html');
    await page.waitForFunction(()=>Boolean(window.__cursorReview));
    const locked=()=>page.evaluate(()=>document.pointerLockElement===document.querySelector('#world'));
    await page.locator('#world').click({position:{x:300,y:300}});
    await expect.poll(locked).toBe(true);
    await page.keyboard.down('AltLeft');await expect.poll(locked).toBe(false);
    expect(await page.evaluate(()=>window.__cursorReview.pauses)).toBe(0);
    expect(await page.evaluate(()=>window.__cursorReview.attackHeld)).toBe(false);
    const before=await page.evaluate(()=>(window.__cursorReview.orbit as unknown as {targetYaw:number}).targetYaw);
    await page.mouse.move(100,100);await page.mouse.move(200,160);
    expect(await page.evaluate(()=>(window.__cursorReview.orbit as unknown as {targetYaw:number}).targetYaw)).toBe(before);
    await page.keyboard.up('AltLeft');await expect.poll(locked).toBe(true);
    await page.keyboard.down('AltLeft');await expect.poll(locked).toBe(false);
    await page.getByRole('button',{name:'Open menu',exact:true}).click();
    await expect(page.locator('#menu')).toBeVisible();
    await page.keyboard.up('AltLeft');expect(await locked()).toBe(false);
    await page.getByRole('button',{name:'Close menu',exact:true}).click();
    expect(await locked()).toBe(false);
    await page.locator('#world').click({position:{x:300,y:300}});await expect.poll(locked).toBe(true);
    await page.keyboard.down('AltLeft');await expect.poll(locked).toBe(false);
    await page.getByRole('button',{name:'Open menu',exact:true}).click();
    await page.getByRole('button',{name:'Close menu',exact:true}).click();
    await page.keyboard.up('AltLeft');await expect.poll(locked).toBe(true);
    await page.keyboard.down('AltLeft');await expect.poll(locked).toBe(false);
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    await page.keyboard.up('AltLeft');expect(await locked()).toBe(false);
    expect(await page.evaluate(()=>window.__cursorReview.pauses)).toBe(0);
    await page.evaluate(()=>window.__cursorReview.destroy());
    await page.keyboard.press('AltLeft');expect(await locked()).toBe(false);
    expect(errors).toEqual([]);
  }finally{await context.close();}
});
