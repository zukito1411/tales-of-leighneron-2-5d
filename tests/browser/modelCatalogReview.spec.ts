import {expect,test} from '@playwright/test';
import type {} from './modelCatalogFixture';

test('regional interior and exterior model catalog has rendered, registered assets',async({browser})=>{
  test.setTimeout(600000);
  const context=await browser.newContext({viewport:{width:1600,height:1000}}),page=await context.newPage();
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'||/INVALID|feedback loop|too many errors/i.test(message.text()))errors.push(message.text());});
  const records:Array<{case:string;models:unknown}>=[];
  const kits=['trandum_rustic','highmere_noble','narenthil_elven','nardorous_alpine','rindass_orcan','druganwoods_dwarven','portquill_maritime','frostlands_longhouse','darkav_obsidian'];
  const cases=[...kits.map(kit=>({name:kit,query:'kind=interior&kit='+kit})),
    ...['others','world_assets','woodland_props','desert_props','climate_props','native_civic_bare','native_story_bare','native_story_props','native_quest_landmarks','flower_fence','bridges'].map(sheet=>({name:sheet,query:'kind=world&sheet='+sheet})),
    ...['world_objects','world_buildings','capital_buildings','elven_villas'].flatMap(sheet=>Array.from({length:sheet==='world_objects'?1:sheet==='world_buildings'?2:3},(_,part)=>({name:sheet+'-'+part,query:`kind=world&sheet=${sheet}&part=${part}`}))),
    {name:'castle-hall',query:'kind=room&kit=highmere_noble&profile=castle'},
    {name:'castle-night',query:'kind=room&kit=highmere_noble&profile=castle&night=1'},
    {name:'inn-night',query:'kind=room&kit=trandum_rustic&profile=inn&night=1'}];
  try{
    for(const entry of cases){
      await page.goto('/tests/browser/modelCatalogReview.html?'+entry.query);
      await page.waitForFunction(()=>window.__modelCatalogReview?.ready||window.__modelCatalogReview?.error,null,{timeout:30000});
      expect(await page.evaluate(()=>window.__modelCatalogReview.error)).toBe('');
      const models=await page.evaluate(()=>window.__modelCatalogReview.report);expect(models.length,entry.name).toBeGreaterThan(0);
      await page.waitForTimeout(180);
      await page.screenshot({path:`test-results/catalog-${entry.name}.png`});
      if(/woodland|climate|castle-hall/.test(entry.name)){
        await page.evaluate(()=>window.__modelCatalogReview.yaw=Math.PI*.6);
        await page.waitForTimeout(180);await page.screenshot({path:`test-results/catalog-${entry.name}-orbit.png`});
      }
      records.push({case:entry.name,models});console.log('Rendered catalog:',entry.name,models.length);
      await page.evaluate(()=>window.__modelCatalogReview.destroy());
    }
    expect(errors).toEqual([]);
    await test.info().attach('model-catalog.json',{body:JSON.stringify(records,null,2),contentType:'application/json'});
  }finally{await context.close();}
});
