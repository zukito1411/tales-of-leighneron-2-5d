import {test,expect} from '@playwright/test';
import type Phaser from 'phaser';
import type {WorldScene} from '../../src/game/scenes/WorldScene';
test('brief harbor departure, covered transfer and safe Darkav arrival',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?e2e');await page.getByRole('button',{name:'Start New Game',exact:true}).click();await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'));
 await page.evaluate(async()=>{
  const storePath='/src/store/gameStore.ts',portsPath='/src/data/ports.ts';const {useGameStore}=await import(storePath),{PORT_BY_ID}=await import(portsPath);
  useGameStore.getState().setStoryFlag('scene:highmere-arrival');
  const scene=window.__mernondnaGame!.scene.getScene('world') as WorldScene,p=PORT_BY_ID.highmere.landing;
  scene.player.restoreAt(p.x,p.y+36);(scene as unknown as {lastSafe:{x:number;y:number}}).lastSafe={x:p.x,y:p.y+36};scene.streamCinematicView(p.x,p.y);scene.cameras.main.centerOn(p.x,p.y);
 });
 await expect.poll(()=>page.evaluate(()=>Boolean(window.__mernondnaGame!.scene.getScene('world').children.getByName('docked:highmere')))).toBe(true);
 await page.keyboard.press('e');await expect(page.getByRole('dialog',{name:'Harbor passage'})).toBeVisible();
 await page.screenshot({path:'test-results/highmere-docked-boat.png'});
 await page.getByRole('button',{name:'Sail to Ashen Landing · Darkav',exact:true}).click();
 await page.waitForFunction(()=>Boolean(window.__mernondnaGame!.scene.getScene('world').children.getByName('passage-vessel')));
 const before=await page.evaluate(async()=>{
  const s=window.__mernondnaGame!.scene.getScene('world'),boat=s.children.getByName('passage-vessel') as Phaser.GameObjects.Sprite;
  const savePath='/src/utils/save.ts',{saveGame,parseSave,SAVE_KEY}=await import(savePath);
  const portsPath='/src/data/ports.ts',{PORT_BY_ID}=await import(portsPath);
  saveGame();const saved=parseSave(localStorage.getItem(SAVE_KEY)!);
  return {x:boat.x,y:boat.y,passenger:Boolean(s.children.getByName('passenger:passage-vessel')),
   savedX:saved?.state.worldX,savedY:saved?.state.worldY,origin:PORT_BY_ID.highmere.landing};
 });
 expect(before.passenger).toBe(true);
 expect(before.savedX).toBeCloseTo(before.origin.x,0);expect(before.savedY).toBeCloseTo(before.origin.y,0);
 // A short visible departure precedes the fade. There is no accelerated or
 // skipped voyage clock: exercise the real bounded transfer and ready gate.
 await expect.poll(()=>page.evaluate(before=>{
  const boat=window.__mernondnaGame!.scene.getScene('world').children.getByName('passage-vessel') as Phaser.GameObjects.Sprite;
  return boat?Math.hypot(boat.x-before.x,boat.y-before.y):0;
 },before)).toBeGreaterThan(.5);
 await expect(page.locator('.journey-screen')).toBeVisible();
 await page.waitForFunction(()=>!(window.__mernondnaGame!.scene.getScene('world') as unknown as {passage:{active:boolean}}).passage.active,{},{timeout:30000});
 await expect(page.locator('.journey-screen')).toHaveCount(0);
 const arrival=await page.evaluate(async()=>{
  const portsPath='/src/data/ports.ts',savePath='/src/utils/save.ts';const {PORT_BY_ID}=await import(portsPath),{saveGame,parseSave,SAVE_KEY}=await import(savePath);
  const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;saveGame();const saved=parseSave(localStorage.getItem(SAVE_KEY)!);
  return {x:s.player.x,y:s.player.y,visible:s.player.visible,expected:PORT_BY_ID.blackspire.landing,savedX:saved?.state.worldX,savedY:saved?.state.worldY};
 });
 expect(arrival.visible).toBe(true);expect(Math.hypot(arrival.x-arrival.expected.x,arrival.y-arrival.expected.y)).toBeLessThanOrEqual(193);
 expect(arrival.savedX).toBeCloseTo(arrival.x,0);expect(arrival.savedY).toBeCloseTo(arrival.y,0);
 await page.screenshot({path:'test-results/darkav-landing.png'});expect(errors).toEqual([]);
});

test('local quest cutscene preserves position and HP; cached shadow updates stay bounded',async({page})=>{
 test.setTimeout(90000);await page.goto('/?e2e');await page.getByRole('button',{name:'Start New Game',exact:true}).click();await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'));
 const before=await page.evaluate(async()=>{
  const path='/src/store/gameStore.ts',{useGameStore}=await import(path),s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
  useGameStore.getState().hydrate({pendingCinematic:'cibar-water-restored',storyFlags:{'cibar-public-water':true}});return {x:s.player.x,y:s.player.y,hp:s.player.hp};
 });
 await expect(page.getByRole('region',{name:'Story scene'})).toBeVisible();await expect(page.getByRole('region',{name:'Story scene'})).toContainText('The Pump Turns');
 await page.screenshot({path:'test-results/cibar-cutscene.png'});await page.getByRole('button',{name:'Skip scene · Esc'}).click();await expect(page.getByRole('region',{name:'Story scene'})).toBeHidden();
 expect(await page.evaluate(()=>{const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;return {x:s.player.x,y:s.player.y,hp:s.player.hp};})).toEqual(before);
 const metrics=await page.evaluate(()=>{
  const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
  const shadows=(s as unknown as {groundShadows:{update(delta:number,hour:number,cloud:number):void}}).groundShadows;
  const texture=s.textures.get('ground-shadows') as Phaser.Textures.CanvasTexture,original=texture.refresh;let uploads=0;
  texture.refresh=function(){uploads++;return original.call(this);};const view=s.cameras.main.worldView,oldX=view.x;
  for(let i=0;i<120;i++){view.x+=.2;shadows.update(8,8,0);}texture.refresh=original;view.x=oldX;return {calls:120,uploads};
 });
 console.log('Shadow upload budget',metrics);expect(metrics.uploads).toBeLessThan(40);
 await page.screenshot({path:'test-results/oakmere-larger-houses.png'});
});
