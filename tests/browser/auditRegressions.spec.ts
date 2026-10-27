import {test,expect,type Page} from '@playwright/test';
import type Phaser from 'phaser';
import type {WorldScene} from '../../src/game/scenes/WorldScene';
import type {WorldSpriteSystem} from '../../src/game/systems/WorldSpriteSystem';

async function openJourney(page:Page){
  await page.goto('/?e2e');
  await page.getByRole('button',{name:'Start New Game',exact:true}).click();
  await page.waitForFunction(()=>{
    const game=window.__mernondnaGame;
    return game?.registry.get('worldReady');
  },null,{timeout:240000});
  await page.getByRole('button',{name:/Skip scene/}).click({timeout:30000});
  await page.waitForFunction(()=>(window.__mernondnaGame!.scene.getScene('world') as WorldScene).presentationControlsEnabled);
}

test('live world preserves paused combat, staged collision and worker saves',async({page},testInfo)=>{
  test.setTimeout(300000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    await openJourney(page);
    const frozen=await page.evaluate(async()=>{
      const path='/src/store/gameStore.ts';const {useGameStore}=await import(path);
      const scene=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
      const player=scene.player as unknown as {nextDashAt:number;nextAttackAt:number};
      // Deadlines are still live when the actual pause menu opens. No
      // synthetic scene pause: exercise the game's normal modal path.
      player.nextDashAt=scene.combatTime+800;player.nextAttackAt=scene.combatTime+600;
      useGameStore.getState().openPanel('pause');
      return {time:scene.combatTime,dash:player.nextDashAt,attack:player.nextAttackAt};
    });
    // Let ordinary engine time exceed both deadlines while the modal is open.
    await page.waitForTimeout(1100);
    expect(await page.evaluate(()=>{
      const scene=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
      const player=scene.player as unknown as {nextDashAt:number;nextAttackAt:number};
      return {time:scene.combatTime,dash:player.nextDashAt,attack:player.nextAttackAt};
    })).toEqual(frozen);
    await page.evaluate(async()=>{const path='/src/store/gameStore.ts';const {useGameStore}=await import(path);useGameStore.getState().closePanel();});
    await page.waitForFunction(before=>(window.__mernondnaGame!.scene.getScene('world') as WorldScene).combatTime>before+100,frozen.time);

    const state=await page.evaluate(async()=>{
      const path='/src/data/art.ts';const {artScale}=await import(path);
      const scene=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
      const sprites=(scene as unknown as {worldSprites:WorldSpriteSystem}).worldSprites;
      const actor=scene.add.image(scene.player.x+160,scene.player.y+160,'world_assets',0)
        .setScale(artScale('world_assets')).setOrigin(.5,1).setVisible(false).setName('audit-staged-tree');
      const bodies=()=>scene.children.list.filter(object=>object.name==='ground:'+actor.name)
        .map(object=>(object as Phaser.GameObjects.Rectangle).body as Phaser.Physics.Arcade.StaticBody);
      try{
        sprites.register(actor,'world_assets',0,1,true,undefined,false,true);
        sprites.prepare(actor);
        const hidden={visible:actor.visible,count:bodies().length,colliding:bodies().some(body=>body.enable)};
        actor.setVisible(true);sprites.activate(actor);
        const published={visible:actor.visible,colliding:bodies().every(body=>body.enable)};
        sprites.retire(actor);
        return {hidden,published,retired:bodies().some(body=>body.enable)};
      }finally{actor.destroy();}
    });
    expect(state.hidden.count).toBeGreaterThan(0);
    expect(state.hidden.visible).toBe(false);expect(state.hidden.colliding).toBe(false);
    expect(state.published).toEqual({visible:true,colliding:true});expect(state.retired).toBe(false);
    const frames=await page.evaluate(()=>new Promise<{frames:number;medianMs:number;p95Ms:number;maxMs:number}>(resolve=>{
      const game=window.__mernondnaGame!,values:number[]=[];
      const collect=()=>values.push(game.loop.rawDelta);
      game.events.on('poststep',collect);
      setTimeout(()=>{game.events.off('poststep',collect);values.sort((a,b)=>a-b);
        resolve({frames:values.length,medianMs:values[Math.floor(values.length*.5)],p95Ms:values[Math.floor(values.length*.95)],maxMs:values[values.length-1]});},8000);
    }));
    console.log('Software-rendered live-world frame sample:',JSON.stringify(frames));
    expect(frames.frames).toBeGreaterThan(0);
    await testInfo.attach('live-world',{body:await page.screenshot(),contentType:'image/png'});
    expect(errors).toEqual([]);
  }finally{await page.close();}
});

test('module worker prepares a recoverable save in a real browser',async({page})=>{
  test.setTimeout(90000);
  try{
    await page.goto('/?e2e');
    await page.getByRole('button',{name:'Start New Game',exact:true}).waitFor();
    const prepared=await page.evaluate(async()=>{
      const savePath='/src/utils/save.ts',workerPath='/src/utils/SaveWorker.ts';
      const {saveGame,SAVE_KEY}=await import(savePath),{SaveWorker}=await import(workerPath);
      if(!saveGame())throw new Error('Could not capture the live save');
      const worker=new SaveWorker();
      try{
        if(!worker.available)throw new Error('Module save worker unavailable');
        const data=JSON.parse(localStorage.getItem(SAVE_KEY)!);
        return await new Promise<{problem:string|null;version:number|null}>((resolve,reject)=>{
          const timer=setTimeout(()=>reject(new Error('Save worker did not complete')),35000);
          worker.prepare(data,(result:{raw:string|null;problem:string|null}|null)=>{
            clearTimeout(timer);
            resolve({problem:result?result.problem:'Worker failed',version:result?.raw?JSON.parse(result.raw).version:null});
          });
        });
      }finally{worker.destroy();}
    });
    expect(prepared).toEqual({problem:null,version:7});
  }finally{await page.close();}
});
