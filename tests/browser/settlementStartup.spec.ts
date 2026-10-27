import {expect,test} from '@playwright/test';
import type {WorldScene} from '../../src/game/scenes/WorldScene';

test.use({trace:'off',launchOptions:{args:[]}});

test('settlement update opens the menu and reaches a rendered playable world',async({browser})=>{
  test.setTimeout(660000);
  const context=await browser.newContext();
  const page=await context.newPage(),errors:string[]=[],missing:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{
    if(response.status()>=400&&new URL(response.url()).pathname.startsWith('/assets/'))missing.push(response.status()+' '+response.url());
  });
  const ready=async()=>{
    await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady')===true
      &&(window.__mernondnaGame.scene.getScene('world') as WorldScene).player?.active,null,{timeout:600000});
    await expect(page.locator('canvas.three-world-canvas')).toBeVisible();
  };
  try{
    await page.goto('/?e2e');
    await page.getByRole('button',{name:'Start New Game',exact:true}).click();
    await ready();
    await page.getByRole('button',{name:/Skip scene/}).click({timeout:30000});
    await page.waitForFunction(async()=>{
      const path='/src/store/gameStore.ts';
      const {useGameStore}=await import(path) as typeof import('../../src/store/gameStore');
      return !useGameStore.getState().cinematic&&!useGameStore.getState().pendingCinematic;
    });
    await page.screenshot({path:'test-results/settlement-startup-playable.png'});
    expect(errors).toEqual([]);expect(missing).toEqual([]);
  }catch(error){
    console.log('Startup diagnostics',await page.evaluate(()=>{
      const game=window.__mernondnaGame;
      return game?{stage:game.registry.get('loadingStage'),progress:game.registry.get('loadingProgress'),
        lastAsset:game.registry.get('loadingLastAsset'),assetError:game.registry.get('assetError'),
        presentationError:game.registry.get('presentationError')}:null;
    }).catch(()=>null),{errors,missing});
    await page.screenshot({path:'test-results/settlement-startup-failure.png'}).catch(()=>{});
    throw error;
  }finally{
    await context.close();
  }
});
