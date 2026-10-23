import {expect,test,type Page} from '@playwright/test';
import type {WorldScene} from '../../src/game/scenes/WorldScene';
import type Phaser from 'phaser';

const shots='test-results/tower-of-might/smoke';
async function ready(page:Page){await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady')
 &&(window.__mernondnaGame.scene.getScene('world') as WorldScene).player?.active,null,{timeout:120000});}
async function progress(page:Page){return page.evaluate(async()=>{
 const path='/src/store/gameStore.ts';const {useGameStore}=await import(path) as typeof import('../../src/store/gameStore');
 const s=useGameStore.getState();return {gold:s.gold,inventory:s.inventory,weapon:s.weaponId,hearts:s.bossHearts,
  quests:s.quests,checkpoints:Object.entries(s.dungeons).filter(([id])=>id.endsWith('-5')),flag:s.storyFlags['tower-of-might:unlocked']};
});}

test('focused New Game, Continue, backup recovery and live Magus spell smoke',async({browser})=>{
 test.setTimeout(300000);
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const page=await context.newPage(),errors:string[]=[],missing:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',m=>{if(m.type()==='error'||m.type()==='warning'&&/\[tower\]|\[save\]|Could not load|Could not enter/.test(m.text()))console.log('GAME:',m.text());});
 page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).pathname.startsWith('/assets/'))missing.push(r.status()+' '+r.url());});
 try{
  await page.goto('/?e2e');await page.getByRole('button',{name:'Start New Game',exact:true}).click();await ready(page);
  await page.getByRole('button',{name:/Skip scene/}).click({timeout:30000});
  await page.waitForFunction(()=>!(window.__mernondnaGame!.scene.getScene('world') as WorldScene)['cinematicDirector'].active);
  await page.screenshot({path:shots+'/new-game.png'});
  // Seed endgame progress in an isolated browser save, never the user's profile.
  const saved=await page.evaluate(async()=>{
   const store='/src/store/gameStore.ts',save='/src/utils/save.ts',dungeon='/src/data/dungeons.ts',enemies='/src/data/enemies.ts',questsPath='/src/data/quests.ts';
   const {useGameStore}=await import(store) as typeof import('../../src/store/gameStore');
   const {saveGame,SAVE_KEY,parseSave,getSaveFailureReason}=await import(save) as typeof import('../../src/utils/save');
   const {QUESTS}=await import(questsPath) as typeof import('../../src/data/quests');
   const {newDungeonProgress}=await import(dungeon) as typeof import('../../src/data/dungeons');
   const {BOSSES}=await import(enemies) as typeof import('../../src/data/enemies');
   const s=useGameStore.getState(),ledger={...s.dungeons};
   const quests={...s.quests},flags:Record<string,boolean>={...s.storyFlags,'tower-of-might:unlocked':true};
   for(const q of QUESTS.filter(q=>q.kind==='main')){
    quests[q.id]={status:'completed',objectiveProgress:Object.fromEntries(q.objectives.map(o=>[o.id,o.amount]))};
    for(const o of q.objectives)if(o.cinematicId)flags['scene:'+o.cinematicId]=true;
   }
   for(let c=1;c<=9;c++)ledger[`might-${c}-5`]={...newDungeonProgress(),defeated:1,claimed:true};
   s.hydrate({gold:4321,pendingCinematic:null,cinematicQueue:[],weatherAudio:true,defeatedBosses:BOSSES.map(b=>b.id),dungeons:ledger,
    quests,storyFlags:flags});
   const scene=window.__mernondnaGame!.scene.getScene('world') as WorldScene;scene.syncState();
   const ok=saveGame(),raw=localStorage.getItem(SAVE_KEY)!;localStorage.setItem(SAVE_KEY+':last-good',raw);
   const normalized=parseSave(raw)!.state;
   return {ok,reason:getSaveFailureReason(),bytes:raw.length,expected:{gold:normalized.gold,inventory:normalized.inventory,
    weapon:normalized.weaponId,hearts:normalized.bossHearts??{},quests:normalized.quests,
    checkpoints:Object.entries(normalized.dungeons??{}).filter(([id])=>id.endsWith('-5')),flag:normalized.storyFlags['tower-of-might:unlocked']}};
  });
  expect(saved.ok,saved.reason??'save validation').toBe(true);expect(saved.bytes).toBeGreaterThan(100);
  const expected=saved.expected;
  if(!process.env.TOWER_SMOKE_ONLY){
  await page.reload();await page.getByRole('button',{name:'Continue',exact:true}).click();await ready(page);
  expect(await progress(page)).toEqual(expected);
  await page.screenshot({path:shots+'/continued-save.png'});
  // Corrupt only this test's primary; retain a verified last-good checkpoint.
  await page.evaluate(()=>localStorage.setItem('mernondna-25d-save-v1','{truncated-test-primary'));
  await page.reload();await page.getByRole('button',{name:'Continue',exact:true}).click();await ready(page);
  expect(await progress(page)).toEqual(expected);
  await page.screenshot({path:shots+'/recovered-save.png'});
  }
  await page.evaluate(async()=>{
   const path='/src/data/towerOfMight.ts';const {TOWER_ENTRY_ID,TOWER_DOOR}=await import(path) as typeof import('../../src/data/towerOfMight');
   const scene=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
   scene.prepareStoryArena();scene.restoreOutsidePosition({...TOWER_DOOR,y:TOWER_DOOR.y+15});
   scene['interiors'].enter({id:TOWER_ENTRY_ID,townId:'oakmere',name:'Tower of Might',kit:'tower_of_might',door:TOWER_DOOR,hall:false,profile:'cave'});
  });
  await page.waitForFunction(async()=>{const path='/src/store/gameStore.ts';const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
   return s['interiors'].ready&&(await import(path)).useGameStore.getState().activeDungeonId==='might-10-1';},null,{timeout:45000});
  await page.waitForTimeout(200);
  await page.evaluate(()=>{const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
   s.cameras.main.stopFollow().removeBounds().setZoom(.42);const p=s.dungeonPoint({x:900,y:900});s.cameras.main.centerOn(p.x,p.y);});
  await page.screenshot({path:shots+'/circular-floor.png'});
  await page.evaluate(()=>{const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s['dungeons'].begin('cave:might-10-5');});
  await page.waitForFunction(()=>{const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;return s['dungeons'].enemies.some(e=>e.definition.id==='grand-magus');},null,{timeout:45000});
  await page.evaluate(()=>{
   const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene,e=s['dungeons'].enemies[0];
   // Keep the review actor alive and out of staff range; AI, spell selection,
   // warnings, flight, damage checks and fading remain the real game systems.
   s.player.hp=100000;
   s.events.on('postupdate',()=>{if(!e.active)return;s.player.hp=100000;
    if(Math.hypot(s.player.x-e.x,s.player.y-e.y)<280)(s.player.body as Phaser.Physics.Arcade.Body).reset(e.x,e.y+420);});
   (s.player.body as Phaser.Physics.Arcade.Body).reset(e.x,e.y+420);
   const p=s.dungeonPoint({x:900,y:700});s.cameras.main.setZoom(.7).centerOn(p.x,p.y);
  });
  await page.mouse.click(20,450); // real gesture for browser audio policy
  for(const element of ['shadow','ice','fire','thunder'] as const){
   await page.waitForFunction(element=>{
    const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene,b=s['dungeons'].enemies[0]?.['bossCombat'];
    const move=b?.['combo'][b['step']];
    return b?.['phase']==='windup'&&move?.spell===element&&b['age']/move.windup>.82;
   },element,{timeout:35000,polling:'raf'});
   await page.evaluate(()=>window.__mernondnaGame!.scene.pause('world'));
   await page.screenshot({path:`${shots}/${element}-cast.png`});
   await page.evaluate(()=>window.__mernondnaGame!.scene.resume('world'));
   await page.waitForFunction(element=>{
    const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene,v=s['dungeons'].enemies[0]?.['bossCombat']?.['magusVisual'];
    return v?.['afterglows'].some(g=>g.sprite.name==='magus-spell:'+element&&g.duration>500&&g.age>=100&&g.age<300);
   },element,{timeout:10000,polling:'raf'});
   await page.evaluate(()=>window.__mernondnaGame!.scene.pause('world'));
   await page.screenshot({path:`${shots}/${element}-impact.png`});
   await page.evaluate(()=>window.__mernondnaGame!.scene.resume('world'));
   await page.waitForFunction(element=>{
    const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene,v=s['dungeons'].enemies[0]?.['bossCombat']?.['magusVisual'];
    return v?.['afterglows'].some(g=>g.sprite.name==='magus-spell:'+element&&g.duration>500&&g.age>=650&&g.sprite.alpha>0&&g.sprite.alpha<.55);
   },element,{timeout:10000,polling:'raf'});
   await page.evaluate(()=>window.__mernondnaGame!.scene.pause('world'));
   await page.screenshot({path:`${shots}/${element}-fade.png`});
   await page.evaluate(()=>window.__mernondnaGame!.scene.resume('world'));
  }
  await page.setViewportSize({width:844,height:390});
  await page.screenshot({path:shots+'/mobile-sized-fight.png'});
  await page.evaluate(()=>{const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
   const e=s['dungeons'].enemies[0];e.takeDamage(e.hp*10,s.player.lastDirection.clone().set(0,0));});
  await page.waitForFunction(()=>{
   const e=(window.__mernondnaGame!.scene.getScene('world') as WorldScene)['dungeons'].enemies[0];
   return e?.bossPhase===2&&!e.bossRegenerating;
  },null,{timeout:30000});
  await page.evaluate(()=>{const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
   const e=s['dungeons'].enemies[0];e.takeDamage(e.hp*10,s.player.lastDirection.clone().set(0,0));});
  await page.waitForTimeout(650);await page.screenshot({path:shots+'/bats.png'});
  await page.waitForFunction(()=>Boolean((window.__mernondnaGame!.scene.getScene('world') as WorldScene).children.getByName('tower-return-portal')));
  await page.screenshot({path:shots+'/treasure-and-portal.png'});
  await page.evaluate(()=>{const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s.returnFromTower();});
  await page.waitForFunction(()=>{const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
   return !s.inInterior&&!s.textures.exists('grand-magus-spells')&&!s.children.list.some(o=>o.name.startsWith('magus-spell:'));});
  expect(errors).toEqual([]);expect(missing).toEqual([]);
 }catch(error){
  console.log('SMOKE diagnostics:',await page.evaluate(()=>{
   const s=window.__mernondnaGame?.scene.getScene('world') as WorldScene|undefined;
   return s?{inside:s.inInterior,ready:s['interiors']?.ready,loading:s['interiors']?.['loading'],
    session:s['dungeons']?.['session']?.id,actors:s['dungeons']?.enemies.length,
    loader:s.load.isLoading(),resident:[...s['m14Art']['resident'].keys()],pending:[...s['m14Art']['pending']],
    failed:[...s['m14Art']['failed']],loadingArt:s['m14Art']['loading']?.id,focused:s['focused']}:null;
  }).catch(()=>null),'page errors:',errors,'missing:',missing);
  await page.screenshot({path:shots+'/failure.png'}).catch(()=>{});throw error;
 }finally{await context.close();}
});
