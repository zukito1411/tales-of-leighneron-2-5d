import {test,expect} from '@playwright/test';
import type {WorldScene} from '../../src/game/scenes/WorldScene';
import type {Npc} from '../../src/game/entities/Npc';

test.use({launchOptions:{args:['--use-angle=default']},trace:'off'});
test('capital chairs face tables and merchants attend usable solid counters',async({browser})=>{
 test.setTimeout(180000);
 const context=await browser.newContext({viewport:{width:1400,height:900}}),page=await context.newPage(),errors:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('/?e2e');await page.getByRole('button',{name:'Start New Game',exact:true}).click();
  await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'),null,{timeout:120000});
  await page.getByRole('button',{name:/Skip scene/}).click();
  await page.waitForFunction(()=>!(window.__mernondnaGame!.scene.getScene('world') as WorldScene)['cinematicDirector'].active);
  const survey=await page.evaluate(async()=>{
   const content='/src/data/content.ts',npcs='/src/data/npcs.ts',work='/src/data/marketWorkstations.ts',life='/src/data/highmereMarketLife.ts',store='/src/store/gameStore.ts';
   const {WORLD_CONTENT}=await import(/* @vite-ignore */ content) as typeof import('../../src/data/content');
   const {NPCS}=await import(/* @vite-ignore */ npcs) as typeof import('../../src/data/npcs');
   const {marketWorkstation}=await import(/* @vite-ignore */ work) as typeof import('../../src/data/marketWorkstations');
   const {HIGHMERE_MARKET_LIFE}=await import(/* @vite-ignore */ life) as typeof import('../../src/data/highmereMarketLife');
   const {useGameStore}=await import(/* @vite-ignore */ store) as typeof import('../../src/store/gameStore');
   useGameStore.setState({storyFlags:{...useGameStore.getState().storyFlags,'scene:highmere-arrival':true}});
   const chairs=WORLD_CONTENT.filter(d=>d.id.startsWith('detail:highmere:streetlife:cafe-chair:')).map(d=>{
    if(!('rotation' in d))throw new Error('Chair has no heading');
    const table=WORLD_CONTENT.find(t=>t.id===d.id.replace(':cafe-chair:',':cafe-table:').replace(/:[we]$/,''));
    if(!table)throw new Error('Chair has no table');
    const dx=table.world.x-d.world.x,dy=table.world.y-d.world.y;
    return {id:d.id,dot:(-Math.sin(d.rotation??0)*dx+Math.cos(d.rotation??0)*dy)/Math.hypot(dx,dy),world:d.world};
   });
   const sellers=NPCS.filter(n=>n.workplaceId).map(n=>{
    const stall=WORLD_CONTENT.find(d=>d.id===n.workplaceId);if(!stall||!(stall.kind==='prop'||stall.kind==='settlement-prop'))throw new Error('Missing counter');
    const station=marketWorkstation(stall)!;
    return {id:n.id,stall:stall.id,approach:station.approach,stations:station.stations};
   });
   return {chairs,sellers,unattended:HIGHMERE_MARKET_LIFE.unattended};
  });
  expect(survey.chairs.length).toBeGreaterThan(1);for(const c of survey.chairs)expect(c.dot,c.id).toBeGreaterThan(.99);
  expect(survey.sellers.length).toBeGreaterThan(5);expect(survey.unattended).toEqual([]);
  for(const [index,seller] of survey.sellers.entries()){
   await page.evaluate(p=>{const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s.restoreOutsidePosition({x:p.x+180,y:p.y+200});},seller.approach);
   try{await page.waitForFunction(id=>!!(window.__mernondnaGame!.scene.getScene('world') as WorldScene)['contentManager'].getActor('npc:'+id),seller.id,{timeout:20000});}
   catch(error){console.log(await page.evaluate(seller=>{
    const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene,actor=s['contentManager'].getActor(seller.stall);
    return {id:seller.id,stall:actor?{x:actor.x,y:actor.y,hint:actor.getData('presentation25d')}:null,points:seller.stations.map(p=>({p,
      blocked:s['isBlockedByBuilding'](p.x,p.y),roof:s['isNpcObscured'](p.x,p.y,true),
      source:s['exteriorPlacement'].blocksNpc(p,undefined,true,seller.stall),
      bodies:s.physics.overlapRect(p.x-11,p.y-24,22,26,false,true).filter(b=>b.enable).map(b=>({name:b.gameObject.name,x:b.x,y:b.y,w:b.width,h:b.height}))}))};
   },seller));throw error;}
   const actual=await page.evaluate(seller=>{
    const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene,n=s['contentManager'].getActor('npc:'+seller.id) as Npc;
    const blockers=s.physics.overlapRect(n.x-11,n.y-24,22,26,false,true).filter(b=>b.enable).map(b=>({name:b.gameObject.name,x:b.x,y:b.y,w:b.width,h:b.height}));
    const stall=s['contentManager'].getActor(seller.stall);
    return {x:n.x,y:n.y,authored:n.definition.worldOffset,home:n.home,blocked:s['isBlockedByBuilding'](n.x,n.y),approach:n.counterApproach,blockers,
      stations:seller.stations,stall:stall?{x:stall.x,y:stall.y,hint:stall.getData('presentation25d')}:null};
   },seller);
   expect(actual.blocked,seller.id+' stands clear of solid posts and counter '+JSON.stringify(actual)).toBe(false);
   expect(Math.min(...seller.stations.map(p=>Math.hypot(p.x-actual.x,p.y-actual.y))),seller.id+' remains at their stall').toBeLessThan(1);
   expect(actual.approach).toEqual(seller.approach);
   if(index===0||index===Math.floor(survey.sellers.length/2)){
    await page.waitForTimeout(300);await page.screenshot({path:`test-results/market-station-${index}.png`});
    const bodyCheck=await page.evaluate(({id,point,station})=>{
     const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
     const npc=s['contentManager'].getActor('npc:'+id) as Npc;
     const blocked=s['isBlockedByBuilding']((point.x+station.x)/2,(point.y+station.y)/2);
     return {blocked,drift:Math.hypot(npc.x-station.x,npc.y-station.y)};
    },{id:seller.id,point:seller.approach,station:{x:actual.x,y:actual.y}});
    expect(bodyCheck.blocked,'the actual counter still blocks movement').toBe(true);expect(bodyCheck.drift).toBeLessThan(.1);
    await page.evaluate(point=>{
     const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
     s.player.restoreAt(point.x,point.y+24);s.tryInteract(s.player.x,s.player.y);
    },seller.approach);
    const spoke=await page.evaluate(async()=>{const path='/src/store/gameStore.ts';const {useGameStore}=await import(/* @vite-ignore */ path) as typeof import('../../src/store/gameStore');const d=useGameStore.getState().dialogue;useGameStore.setState({dialogue:null,panel:null});return d?.npcId;});
    expect(spoke).toBe(seller.id);
   }
  }
  const first=survey.sellers[0];
  await page.evaluate(seller=>{
   const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
   s.restoreOutsidePosition({x:seller.approach.x+180,y:seller.approach.y+200});
   s['contentManager'].patchState('npc:'+seller.id,{x:seller.approach.x+300,y:seller.approach.y+150});
  },first);
  await page.waitForFunction(seller=>{
   const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene,n=s['contentManager'].getActor('npc:'+seller.id);
   return n&&seller.stations.some(p=>Math.hypot(n.x-p.x,n.y-p.y)<1);
  },first,{timeout:20000});
  const chair=survey.chairs[0];
  await page.evaluate(p=>{const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s.restoreOutsidePosition({x:p.x+160,y:p.y+200});},chair.world);
  await page.waitForTimeout(800);await page.screenshot({path:'test-results/cafe-chairs-facing-table.png'});
  console.log(JSON.stringify({chairs:survey.chairs.length,sellers:survey.sellers.length,unattended:survey.unattended.length}));
  expect(errors).toEqual([]);
 }finally{await context.close();}
});
