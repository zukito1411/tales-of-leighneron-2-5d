import {expect,test,type Page} from '@playwright/test';
import type Phaser from 'phaser';
import type {WorldScene} from '../../src/game/scenes/WorldScene';
import {TOWN_BY_ID} from '../../src/data/towns';

declare global {interface Window {__mernondnaGame?:Phaser.Game}}
async function ready(page:Page){
 await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady')===true,{},{timeout:120000});
}
test('continue after a boss defeat, distant teleport, and inn sleep starts a playable world twice',async({page})=>{
 test.setTimeout(540000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?e2e');
 await page.getByRole('button',{name:'Start New Game',exact:true}).click();
 await ready(page);
 await page.getByRole('button',{name:/Skip scene/}).click({timeout:30000});
 // The opening cinematic may temporarily own the interior-safe position.
 await page.waitForFunction(async()=>{
  const {useGameStore}=await import('/src/'+'store/gameStore.ts') as typeof import('../../src/store/gameStore');
  const scene=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
  const state=useGameStore.getState();
  const interiors=(scene as unknown as {interiors:{safePosition:unknown}}).interiors;
  return !state.cinematic&&!state.pendingCinematic&&!interiors.safePosition;
 },null,{timeout:30000});

 const initial=await page.evaluate(async (townId:string)=>{
  const {useGameStore}=await import('/src/'+'store/gameStore.ts') as typeof import('../../src/store/gameStore');
  const {saveGame}=await import('/src/'+'utils/save.ts') as typeof import('../../src/utils/save');
  const scene=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
  const store=useGameStore.getState();
  store.markBossDefeated('captain-varr');
  store.hydrate({gold:5000,
   unlockedTownShrines:[...new Set([...store.unlockedTownShrines,townId])],
   travelRequest:townId,travelRequestSource:'map'});
  // Exercise the real gameplay teleport rather than mutating physics position.
  (scene as unknown as {handleShrineTravel:()=>void}).handleShrineTravel();
  const travel={position:{x:scene.player.x,y:scene.player.y},
   region:(scene as unknown as {worldGenerator:{getRegionAt:(x:number,y:number)=>string}})
    .worldGenerator.getRegionAt(scene.player.x,scene.player.y),
   notice:useGameStore.getState().toast,
   interiorPosition:(scene as unknown as {interiors:{safePosition:unknown}}).interiors.safePosition,
   requestedDestination:townId};
  const dayNight=(scene as unknown as {dayNight:{minuteOfDay:number;sleepUntilMorning:()=>boolean}}).dayNight;
  dayNight.minuteOfDay=19*60;
  if(!dayNight.sleepUntilMorning())throw new Error('Inn-time sleep failed in resume fixture');
  scene.syncState();
  if(!saveGame())throw new Error('Progressed save was rejected');
  const saved=JSON.parse(localStorage.getItem('mernondna-25d-save-v1')!);
  return {region:saved.state.regionId,day:saved.state.day,gold:saved.state.gold,
   bosses:saved.state.defeatedBosses,clock:saved.state.minuteOfDay,travel};
 },TOWN_BY_ID.redmesa.id);
 expect(initial.region,JSON.stringify(initial.travel)).toBe('rindass');
 expect(initial.gold).toBe(5000);
 expect(initial.bosses).toContain('captain-varr');
 expect(initial.clock).toBe(360);

 for(let attempt=0;attempt<2;attempt++){
  await page.reload();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await ready(page);
  const state=await page.evaluate(async()=>{
   const {useGameStore}=await import('/src/'+'store/gameStore.ts') as typeof import('../../src/store/gameStore');
   const scene=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
   const game=useGameStore.getState();
   return {region:game.regionId,day:game.day,gold:game.gold,
    bosses:game.defeatedBosses,alive:scene.player.hp>0,
    paused:scene.physics.world.isPaused,ready:scene.registry.get('worldReady')===true};
  });
  expect(state).toMatchObject({region:'rindass',day:initial.day,
   gold:5000,alive:true,paused:false,ready:true});
  expect(state.bosses).toContain('captain-varr');

  await page.keyboard.down('d');
  await expect.poll(()=>page.evaluate(()=>{
   const scene=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
   return (scene.player.body as Phaser.Physics.Arcade.Body).velocity.x;
  }),{timeout:5000}).toBeGreaterThan(0);
  await page.keyboard.up('d');
 }
 expect(errors).toEqual([]);
});
