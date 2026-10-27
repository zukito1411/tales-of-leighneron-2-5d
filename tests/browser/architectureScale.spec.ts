import {test,expect} from '@playwright/test';

test('production architecture fits a standing player and gates block their full-depth masonry',async({page},testInfo)=>{
  test.setTimeout(120000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.goto('/tests/browser/architectureScaleReview.html');
    await page.waitForFunction(()=>window.__architectureScaleReview?.ready||window.__architectureScaleReview?.error,null,{timeout:90000});
    expect(await page.evaluate(()=>window.__architectureScaleReview.error)).toBe('');
    for(const texture of ['capital_buildings','elven_villas','royal_walls'] as const){
      for(const rotation of [0,Math.PI/2])expect(await page.evaluate(({texture,rotation})=>window.__architectureScaleReview.scene.collision(texture,texture==='royal_walls'?5:3,rotation),{texture,rotation}))
        .toMatchObject({frontLeft:true,rearLeft:true,passage:false});
    }
    expect(await page.evaluate(()=>window.__architectureScaleReview.scene.collision('royal_walls',4))).toMatchObject({passage:true});
    for(const [texture,frame] of [['world_buildings',0],['world_buildings',1],['capital_buildings',5],['elven_villas',0],['royal_walls',5]] as const){
      const size=await page.evaluate(({texture,frame})=>window.__architectureScaleReview.scene.show(texture,frame),{texture,frame});
      expect(size.height).toBeGreaterThan(76*2);
      expect(size.floorLift).toBe(0);
      for(const yaw of [0,Math.PI*.38]){
        await page.evaluate(yaw=>{const orbit=window.__architectureScaleReview.orbit;orbit.yaw=orbit.targetYaw=yaw;},yaw);
        await page.waitForTimeout(350);
        const label=`${texture}-${frame}-${yaw===0?'front':'side'}`;
        const path=testInfo.outputPath(label+'.png');
        await page.screenshot({path});await testInfo.attach(label,{path,contentType:'image/png'});
      }
    }
    expect(errors).toEqual([]);
  }finally{
    await page.evaluate(()=>window.__architectureScaleReview?.game.destroy(true)).catch(()=>{});
    await page.close();
  }
});

test('expanded keep courtyards and nearby resident cutaways render with production models',async({page},testInfo)=>{
  test.setTimeout(150000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.goto('/tests/browser/architectureScaleReview.html');
    await page.waitForFunction(()=>window.__architectureScaleReview?.ready||window.__architectureScaleReview?.error,null,{timeout:120000});
    expect(await page.evaluate(()=>window.__architectureScaleReview.error)).toBe('');
    await page.evaluate(()=>window.__architectureScaleReview.scene.revealResident(true));
    await expect.poll(()=>page.evaluate(()=>window.__architectureScaleReview.cutaway.cutawayTarget.value.w)).toBeGreaterThan(0);
    await page.screenshot({path:testInfo.outputPath('resident-cutaway.png')});
    await page.evaluate(()=>window.__architectureScaleReview.scene.revealResident(false));
    await expect.poll(()=>page.evaluate(()=>window.__architectureScaleReview.cutaway.cutawayTarget.value.w)).toBe(0);
    for(const town of ['highmere','elarion','deepford','blackspire']){
      expect(await page.evaluate(town=>window.__architectureScaleReview.scene.showSettlement(town),town)).toMatchObject({forecourt:980});
      await page.waitForTimeout(350);
      await page.screenshot({path:testInfo.outputPath(town+'-courtyard.png')});
    }
    expect(errors).toEqual([]);
  }finally{
    await page.evaluate(()=>window.__architectureScaleReview?.game.destroy(true)).catch(()=>{});
    await page.close();
  }
});
