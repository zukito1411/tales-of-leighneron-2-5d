import {expect,test,type Page} from '@playwright/test';
import type {WorldScene} from '../../src/game/scenes/WorldScene';
import type Phaser from 'phaser';
declare global {interface Window{__mernondnaGame?:Phaser.Game}}
// The full world requires the platform GPU; software-only atlas reviews use
// the default fixture, but software-rasterizing the entire game stalls startup.
test.use({launchOptions:{args:['--use-angle=default']},trace:'off'});
async function state(page:Page){return page.evaluate(async()=>{
 const path='/src/store/gameStore.ts';const {useGameStore}=await import(/* @vite-ignore */ path) as typeof import('../../src/store/gameStore');
 const s=useGameStore.getState();return {gold:s.gold,home:s.housing,context:s.housingContext,editing:s.housingEditing,materials:s.bossMaterials,minute:s.minuteOfDay,hp:s.hp,maxHp:s.maxHp};
});}
async function floorClick(page:Page,x:number,y:number){
 const board=page.locator('.housing-board-size canvas');
 const target=await board.evaluate((node,p)=>{const scroller=node.closest('.housing-board-scroll')!;
  scroller.scrollTop=Math.max(0,p.y/960*node.clientHeight-scroller.clientHeight/2);
  scroller.scrollLeft=Math.max(0,p.x/768*node.clientWidth-scroller.clientWidth/2);
  const b=node.getBoundingClientRect();return {x:b.left+p.x/768*b.width,y:b.top+p.y/960*b.height};
 },{x:x+8,y:y+8});
 if(await page.evaluate(()=>navigator.maxTouchPoints>0))await page.touchscreen.tap(target.x,target.y);else await page.mouse.click(target.x,target.y);
}
for(const device of ['desktop','mobile'] as const)test(`housing purchase, furnishing, rack, sleep and persistence — ${device}`,async({browser})=>{
 test.setTimeout(180000);
 const context=await browser.newContext(device==='mobile'?{viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:2,
  userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'}:{viewport:{width:1440,height:900}});
 const page=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.goto('/?e2e');await page.getByRole('button',{name:'Start New Game',exact:true}).click();
 await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'),null,{timeout:120000});
 const skip=page.getByRole('button',{name:/Skip scene/});await expect(skip).toBeVisible({timeout:30000});await skip.click();
 await page.waitForFunction(()=>!(window.__mernondnaGame!.scene.getScene('world') as WorldScene)['cinematicDirector'].active,null,{timeout:30000});
 const approach=await page.evaluate(async()=>{
  const path='/src/store/gameStore.ts',interiors='/src/data/interiors.ts';
  const {useGameStore}=await import(/* @vite-ignore */ path) as typeof import('../../src/store/gameStore');
  const {INTERIOR_ENTRIES}=await import(/* @vite-ignore */ interiors) as typeof import('../../src/data/interiors');
  const s=useGameStore.getState();s.hydrate({gold:10000,inventory:['roadwarden-sword','varr-rededge'],bossMaterials:{'varr-rededge':1},pendingCinematic:null,cinematicQueue:[]});
  const scene=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
  const home=INTERIOR_ENTRIES.find(e=>e.id==='town:oakmere:building:4')!;
  scene.restoreOutsidePosition({x:home.door.x,y:home.door.y+20});scene.tryInteract(scene.player.x,scene.player.y);
  return {gold:useGameStore.getState().gold,panel:useGameStore.getState().panel,context:useGameStore.getState().housingContext,
    nearest:scene['interiors'].nearest(scene.player.x,scene.player.y)?.id,doorClear:scene.interiorDoorClear(home.door.x,home.door.y),
    path:scene.hasClearPath(scene.player.x,scene.player.y,home.door.x,home.door.y),story:scene.storyInteraction,toast:useGameStore.getState().toast};
 });
 expect(approach.panel,JSON.stringify(approach)).not.toBe('housing');
 // Deeds are now purchased from the local NPC, not directly at the door.
 await page.evaluate(async()=>{
  const path='/src/store/gameStore.ts',homesPath='/src/data/playerHomes.ts';
  const {useGameStore}=await import(/* @vite-ignore */ path) as typeof import('../../src/store/gameStore');
  const {PLAYER_HOME_BY_ID}=await import(/* @vite-ignore */ homesPath) as typeof import('../../src/data/playerHomes');
  useGameStore.getState().startDialogue(PLAYER_HOME_BY_ID['town:oakmere:building:4']!.agentId);
 });
 const deed=page.getByRole('button',{name:'Discuss the deed · 7,500G',exact:true});
 for(let line=0;line<12&&!await deed.isVisible();line++)await page.getByRole('button',{name:'Continue',exact:true}).click();
 await deed.click();
 await expect(page.getByRole('dialog',{name:'Buy a home',exact:true})).toBeVisible();
 await page.screenshot({path:`test-results/housing/${device}-purchase.png`});
 await page.getByRole('button',{name:'Buy home · 7,500G',exact:true}).click();
 await page.getByRole('button',{name:'Confirm purchase · 7,500G',exact:true}).click();
 expect((await state(page)).gold).toBe(2500);expect((await state(page)).home.owned).toBe(true);
 await page.evaluate(()=>{const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s.tryInteract(s.player.x,s.player.y);});
 await page.getByRole('button',{name:'Show menu buttons',exact:true}).click();
 await expect(page.getByRole('button',{name:'Furnish home',exact:true})).toBeVisible({timeout:30000});
 await expect(page.getByRole('button',{name:'Sleep until morning',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Furnish home',exact:true}).click();
 await expect(page.getByRole('button',{name:'Finish editing',exact:true})).toBeEnabled({timeout:20000});
 await page.getByRole('button',{name:'Bed 200G',exact:true}).click();await floorClick(page,64,64);await page.getByRole('button',{name:'Place furniture',exact:true}).click();
 await page.getByRole('button',{name:'Dining table 150G',exact:true}).click();await floorClick(page,192,512);
 await page.getByRole('button',{name:'Rotate 90° · R',exact:true}).click();await page.getByRole('button',{name:'Place furniture',exact:true}).click();
 await page.getByRole('button',{name:'Weapon display rack 175G',exact:true}).click();await floorClick(page,480,96);
 await page.getByLabel('Weapon for rack').selectOption('varr-rededge');await page.getByRole('button',{name:'Place furniture',exact:true}).click();
 await page.screenshot({path:`test-results/housing/${device}-editor.png`});
 await floorClick(page,64,64);await page.screenshot({path:`test-results/housing/${device}-placement.png`});
 await page.getByRole('button',{name:'Select / clear preview',exact:true}).click();
 if(device==='mobile'){
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/housing/mobile-portrait-editor.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.setViewportSize({width:844,height:390});
 }
 await page.getByRole('button',{name:'Finish editing · 525G',exact:true}).click();
 await expect(page.getByRole('button',{name:'Furnish home',exact:true})).toBeVisible();
 const committed=await state(page);expect(committed.gold).toBe(1975);expect(committed.home.items).toHaveLength(3);
 expect(committed.home.items.find(i=>i.art==='table')?.rotation).toBe(90);expect(committed.materials['varr-rededge']).toBe(0);
 await page.screenshot({path:`test-results/housing/${device}-finished.png`});
 await page.evaluate(()=>{
  const scene=window.__mernondnaGame!.scene.getScene('world') as WorldScene,origin=scene['interiors']['origin'];
  (scene.player.body as Phaser.Physics.Arcade.Body).reset(origin.x+112,origin.y+212);
  scene.tryInteract(scene.player.x,scene.player.y);
 });
 await expect.poll(async()=>(await state(page)).minute).toBeLessThan(365);
 expect((await state(page)).hp).toBe((await state(page)).maxHp);
 await page.getByRole('button',{name:'Furnish home',exact:true}).click();
 await page.getByRole('button',{name:'Chair 50G',exact:true}).click();await floorClick(page,512,512);await page.getByRole('button',{name:'Place furniture',exact:true}).click();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Discard changes',exact:true}).click();
 expect((await state(page)).home.items).toHaveLength(3);expect((await state(page)).gold).toBe(1975);
 await page.evaluate(()=>{
  const scene=window.__mernondnaGame!.scene.getScene('world') as WorldScene,origin=scene['interiors']['origin'];
  (scene.player.body as Phaser.Physics.Arcade.Body).reset(origin.x+384,origin.y+896);
  scene.tryInteract(scene.player.x,scene.player.y);
 });
 await page.keyboard.press('m');await expect(page.getByRole('img',{name:'Woodland Home',exact:true})).toBeVisible();
 await page.screenshot({path:`test-results/housing/${device}-map.png`});
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('mernondna-25d-save-v1')!).state.housing);expect(saved.items).toHaveLength(3);
 expect(errors).toEqual([]);
 }finally{await context.close();}
});
