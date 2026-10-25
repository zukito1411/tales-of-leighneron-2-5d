import {test,expect} from '@playwright/test';
import type {} from './combatDepthFixture';

for(const width of [1280,844])test(`painted 3D combat surfaces and cleanup at ${width}px`,async({browser})=>{
  test.setTimeout(120000);
  const context=await browser.newContext({viewport:{width,height:850},hasTouch:width===844}),page=await context.newPage(),errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'||/INVALID|feedback loop|too many errors/i.test(m.text()))errors.push(m.text());});
  try{
    await page.goto('/tests/browser/combatDepthReview.html');
    await page.waitForFunction(()=>window.__combatDepthReview?.ready||window.__combatDepthReview?.error,null,{timeout:45000});
    expect(await page.evaluate(()=>window.__combatDepthReview.error)).toBe('');
    await page.waitForTimeout(250);
    const before=await page.evaluate(()=>window.__combatDepthReview.stats());
    expect(new Set(before.map(b=>b.key.split(':')[1])).size).toBe(7);
    expect(before.every(b=>b.depth>0&&b.vertices>50&&b.depthTest)).toBe(true);
    expect(before.reduce((n,b)=>n+b.instances,0)).toBe(12);
    for(const phase of [0,1,2,3,4,5]){
      await page.evaluate(phase=>window.__combatDepthReview.phase(phase),phase);await page.waitForTimeout(70);
      await page.screenshot({path:`test-results/combat-phase-${width}-${phase}.png`});
    }
    await page.evaluate(()=>window.__combatDepthReview.phase(2));
    for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
      await page.evaluate(yaw=>window.__combatDepthReview.yaw=yaw,yaw);await page.waitForTimeout(180);
      await page.screenshot({path:`test-results/combat-depth-${width}-${Math.round(yaw*180/Math.PI)}.png`});
    }
    const after=await page.evaluate(()=>window.__combatDepthReview.stats());
    for(const batch of before)expect(after.find(b=>b.key===batch.key)?.matrix).toEqual(batch.matrix);
    await page.evaluate(()=>window.__combatDepthReview.quality('low'));await page.waitForTimeout(180);
    const low=await page.evaluate(()=>window.__combatDepthReview.stats());
    for(const batch of low){const normal=before.find(b=>b.key.split(':')[1]===batch.key.split(':')[1]);expect(batch.vertices).toBeLessThan(normal!.vertices);}
    await page.evaluate(async()=>{const r=window.__combatDepthReview;r.clear();await new Promise<void>(resolve=>r.game.events.once('postrender',()=>resolve()));});
    expect(await page.evaluate(()=>window.__combatDepthReview.stats())).toEqual([]);
    expect(errors).toEqual([]);
  }finally{await context.close();}
});

test('Azure crescent nose leads both wings in eight directions from behind the player',async({browser})=>{
  test.setTimeout(120000);
  const context=await browser.newContext({viewport:{width:1280,height:850}}),page=await context.newPage(),errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'||/INVALID|feedback loop|Shader Error/i.test(m.text()))errors.push(m.text());});
  try{
    await page.goto('/tests/browser/combatDepthReview.html?direction');await page.waitForFunction(()=>window.__combatDepthReview?.ready);
    const results=[];
    for(let heading=0;heading<8;heading++){
      const angle=heading*Math.PI/4,behindYaw=-Math.PI/2-angle;
      await page.evaluate(async({angle,behindYaw})=>{
        const r=window.__combatDepthReview;r.aim(angle);r.yaw=behindYaw;r.pitch=Math.PI/6;
        await new Promise<void>(resolve=>r.game.events.once('postrender',()=>resolve()));
      },{angle,behindYaw});
      const before=await page.evaluate(()=>window.__combatDepthReview.stats()[0]);
      const along=(p:number[])=>p[0]*Math.cos(angle)+p[2]*Math.sin(angle);
      expect(along(before.lead)-along(before.left)).toBeGreaterThan(64);
      expect(along(before.lead)-along(before.right)).toBeGreaterThan(64);
      expect(before.up).toBeGreaterThan(0);expect(before.down).toBeGreaterThan(0);
      const projected=await page.evaluate(()=>{const r=window.__combatDepthReview,b=r.stats()[0];return {lead:r.screen(b.lead),left:r.screen(b.left),right:r.screen(b.right)};});
      expect(projected.lead.y).toBeLessThan((projected.left.y+projected.right.y)/2-20);
      await page.evaluate(()=>window.__combatDepthReview.hidden=true);const baseline=await page.evaluate(()=>window.__combatDepthReview.silhouette());
      await page.evaluate(()=>window.__combatDepthReview.hidden=false);const visible=await page.evaluate(()=>window.__combatDepthReview.silhouette());
      expect(visible.count-baseline.count).toBeGreaterThan(500);
      await page.screenshot({path:`test-results/azure-heading-${heading}-behind-blue.png`});
      if(heading===0){
        await page.evaluate(()=>window.__combatDepthReview.time(.37));
        const flowing=await page.evaluate(()=>window.__combatDepthReview.silhouette());
        expect(flowing.hash).not.toBe(visible.hash);
        expect((await page.evaluate(()=>window.__combatDepthReview.stats()[0])).matrix).toEqual(before.matrix);
        await page.screenshot({path:'test-results/azure-energy-blue-flow.png'});
      }
      await page.evaluate(async({angle})=>{
        const r=window.__combatDepthReview;r.aim(angle,0,'wave',0xffa348);
        await new Promise<void>(resolve=>r.game.events.once('postrender',()=>resolve()));
      },{angle});
      const orange=await page.evaluate(()=>window.__combatDepthReview.silhouette());
      expect(orange.hot-baseline.hot).toBeGreaterThan(5);
      await page.screenshot({path:`test-results/azure-heading-${heading}-behind-orange.png`});
      await page.evaluate(async(yaw)=>{const r=window.__combatDepthReview;r.yaw=yaw;await new Promise<void>(resolve=>r.game.events.once('postrender',()=>resolve()));},behindYaw+Math.PI/2);
      await page.screenshot({path:`test-results/azure-heading-${heading}-side.png`});
      await page.evaluate(async(angle)=>{const r=window.__combatDepthReview;r.aim(angle,40);await new Promise<void>(resolve=>r.game.events.once('postrender',()=>resolve()));},angle);
      const after=await page.evaluate(()=>window.__combatDepthReview.stats()[0]);
      const dx=after.matrix[12]-before.matrix[12],dz=after.matrix[14]-before.matrix[14];
      expect(dx*Math.cos(angle)+dz*Math.sin(angle)).toBeCloseTo(40,3);
      expect(-dx*Math.sin(angle)+dz*Math.cos(angle)).toBeCloseTo(0,3);
      expect(after.normal).toEqual(before.normal);results.push({heading,visible,projected});
    }
    for(const kind of ['ward','impact'] as const)for(let heading=0;heading<8;heading++){
      const angle=heading*Math.PI/4;
      await page.evaluate(async({angle,kind})=>{
        const r=window.__combatDepthReview;r.aim(angle,0,kind);
        await new Promise<void>(resolve=>r.game.events.once('postrender',()=>resolve()));
      },{angle,kind});
      const batch=await page.evaluate(()=>window.__combatDepthReview.stats()[0]);
      expect(batch.normal[0]*Math.cos(angle)+batch.normal[2]*Math.sin(angle)).toBeGreaterThan(.9);
    }
    console.log(JSON.stringify(results));expect(errors).toEqual([]);
  }finally{await context.close();}
});

test('a solid wall occludes the actual rendered 3D energy surface',async({browser})=>{
  const context=await browser.newContext({viewport:{width:1280,height:850}}),page=await context.newPage();
  try{
    await page.goto('/tests/browser/combatDepthReview.html?occlusion');await page.waitForFunction(()=>window.__combatDepthReview?.ready);
    const sample=async(wall:boolean,hidden:boolean)=>{
      await page.evaluate(({wall,hidden})=>Object.assign(window.__combatDepthReview,{wall,hidden}),{wall,hidden});
      await page.waitForTimeout(100);return page.evaluate(()=>window.__combatDepthReview.pixel());
    };
    const blocked=await sample(true,false),wallOnly=await sample(true,true);
    expect(Math.abs(blocked.red-wallOnly.red)+Math.abs(blocked.green-wallOnly.green)+Math.abs(blocked.blue-wallOnly.blue)).toBeLessThan(5);
    const visible=await sample(false,false),floor=await sample(false,true);
    expect(visible.red+visible.green+visible.blue).toBeGreaterThan(floor.red+floor.green+floor.blue+25);
  }finally{await context.close();}
});
