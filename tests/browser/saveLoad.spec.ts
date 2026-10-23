import {expect,test,type Page} from '@playwright/test';
import type {WorldScene} from '../../src/game/scenes/WorldScene';
import type {ContentState} from '../../src/game/types';

async function worldReady(page:Page){
  await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady')
    &&(window.__mernondnaGame.scene.getScene('world') as WorldScene)?.player?.active,null,{timeout:120000});
}
async function pause(page:Page){
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog',{name:'Game menu'})).toBeVisible();
}
async function restoredProgress(page:Page){
  return page.evaluate(async()=>{
    const path='/src/store/gameStore.ts';
    const {useGameStore}=await import(path);
    const state=useGameStore.getState();
    const scene=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
    const manager=(scene as unknown as {contentManager:{getState(id:string):ContentState}}).contentManager;
    return {gold:state.gold,weaponId:state.weaponId,inventory:state.inventory,consumables:state.consumables,
      hp:scene.player.hp,journal:state.journal,quests:state.quests,
      used:manager.getState('collect:cibar-fitting:0').used,
      signal:state.storyFlags['encounter:winter-signal:complete']};
  });
}

test('manual save, Continue and exported-backup import restore the same live-world progress',async({page})=>{
  test.setTimeout(300000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/?e2e');
  await page.getByRole('button',{name:'Start New Game',exact:true}).click();
  await worldReady(page);
  await page.getByRole('button',{name:/Skip scene/}).click({timeout:30000});
  await page.waitForFunction(async()=>{
    const path='/src/store/gameStore.ts';const {useGameStore}=await import(path);
    return !useGameStore.getState().cinematic&&!useGameStore.getState().pendingCinematic;
  });
  await pause(page);
  await page.evaluate(async()=>{
    const storePath='/src/store/gameStore.ts',questPath='/src/data/quests.ts';
    const {useGameStore}=await import(storePath),{QUEST_BY_ID}=await import(questPath);
    const scene=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
    scene.player.hp=73;scene.player.stamina=41;
    const state=useGameStore.getState(),objective=QUEST_BY_ID['first-road'].objectives[0];
    state.hydrate({gold:281,inventory:['roadwarden-sword','verdant-adderblade'],weaponId:'verdant-adderblade',
      consumables:{'healing-potion':3,'stamina-potion':2},
      quests:{...state.quests,'first-road':{...state.quests['first-road'],objectiveProgress:{[objective.id]:objective.amount}}},
      storyFlags:{...state.storyFlags,'encounter:winter-signal:complete':true}});
    state.discoverCreature('gray-wolf',undefined,true);state.discoverRecord('characters','joren-pike');
    (scene as unknown as {contentManager:{patchState(id:string,state:Partial<ContentState>):void}})
      .contentManager.patchState('collect:cibar-fitting:0',{used:true});
  });
  await page.getByRole('button',{name:'Save game',exact:true}).click();
  await expect(page.getByText('Game saved and verified locally.',{exact:true})).toBeVisible();
  await pause(page);
  const expected=await restoredProgress(page);
  const downloaded=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export Save Backup',exact:true}).click();
  const download=await downloaded,stream=await download.createReadStream();
  const chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(Buffer.from(chunk));
  const backup=Buffer.concat(chunks);
  expect(JSON.parse(backup.toString('utf8')).copies.length).toBeGreaterThan(0);

  await page.reload();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await worldReady(page);await pause(page);
  expect(await restoredProgress(page)).toEqual(expected);

  await page.evaluate(async()=>{
    const path='/src/store/gameStore.ts';(await import(path)).useGameStore.getState().hydrate({gold:987});
  });
  await page.getByRole('button',{name:'Save game',exact:true}).click();await pause(page);
  page.once('dialog',dialog=>dialog.accept());
  await page.getByLabel('Choose a saved game JSON backup').setInputFiles({name:'round-trip-backup.json',mimeType:'application/json',buffer:backup});
  await page.getByRole('button',{name:'Continue',exact:true}).click({timeout:30000});
  await worldReady(page);await pause(page);
  expect(await restoredProgress(page)).toEqual(expected);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('mernondna-25d-save-v1:pre-import-backup')!).state.gold)).toBe(987);
  expect(errors).toEqual([]);
});
