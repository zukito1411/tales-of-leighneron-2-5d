import {test,expect} from '@playwright/test';
import type Phaser from 'phaser';
import type {WorldScene} from '../../src/game/scenes/WorldScene';
import type {WeatherSystem} from '../../src/game/systems/WeatherSystem';
test('spatial queries retain collision results and bosses retain defeat artwork',async({page})=>{
 test.setTimeout(120000);await page.goto('/?e2e');await page.getByRole('button',{name:'Start New Game',exact:true}).click();await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'));
 const audit=await page.evaluate(async()=>{
  const dp='/src/data/content.ts',gp='/src/data/settlementGeometry.ts';const {WORLD_CONTENT}=await import(dp),{spriteBounds,overlaps}=await import(gp);
  const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s.scene.pause();s.physics.world.pause();
  const r=s as unknown as {buildings:Phaser.Physics.Arcade.StaticGroup;treeBodies:Phaser.Physics.Arcade.StaticGroup;isNpcObscured(x:number,y:number):boolean;isBlockedByBuilding(x:number,y:number):boolean;lineIntersectsBody(line:Phaser.Geom.Line,body:Phaser.Physics.Arcade.StaticBody):boolean};
  const originalLine=(ax:number,ay:number,bx:number,by:number)=>{
   const line={x1:ax,y1:ay,x2:bx,y2:by} as Phaser.Geom.Line;
   return ![...r.buildings.getChildren(),...r.treeBodies.getChildren()].some(object=>{const b=(object as Phaser.GameObjects.Sprite).body as Phaser.Physics.Arcade.StaticBody;return b?.enable&&r.lineIntersectsBody(line,b);});
  };
  let lines=0,feet=0,roofs=0;const x=s.player.x,y=s.player.y;
  const originals=WORLD_CONTENT.filter((d:typeof WORLD_CONTENT[number])=>d.kind==='settlement-prop');
  // Keep roof comparison outside Oakmere's additional canopy predicate.
  const rp='/src/data/towns.ts',{TOWN_BY_ID}=await import(rp),capital=TOWN_BY_ID.highmere.world;
  for(let i=0;i<600;i++){
   const ax=x+(i%23-11)*38,ay=y+(i%19-9)*40,bx=ax+(i%9-4)*20,by=ay+(i%11-5)*24;
   if(s.hasClearPath(ax,ay,bx,by)!==originalLine(ax,ay,bx,by))lines++;
   const foot={left:ax-11,right:ax+11,top:ay-24,bottom:ay+2};
   const oldFoot=[...r.buildings.getChildren(),...r.treeBodies.getChildren()].some(o=>{const b=(o as Phaser.GameObjects.Sprite).body as Phaser.Physics.Arcade.StaticBody;return b?.enable&&overlaps(foot,b);});
   // Fortification point checks are tested separately; fixture stays in Oakmere.
   if(r.isBlockedByBuilding(ax,ay)!==oldFoot)feet++;
   const px=capital.x+(i%31-15)*120,py=capital.y+(i%29-14)*130,person={left:px-25,right:px+25,top:py-76,bottom:py+2};
   const oldRoof=originals.some((d:typeof originals[number])=>d.kind==='settlement-prop'&&d.world.y>py&&overlaps(person,spriteBounds(d.texture??'world_objects',d.frame,d.scale,d.world.x,d.world.y)));
   if(r.isNpcObscured(px,py)!==oldRoof)roofs++;
  }
  return{lines,feet,roofs};
 });
 expect(audit).toEqual({lines:0,feet:0,roofs:0});
 const defeat=await page.evaluate(async()=>{
  const ep='/src/data/enemies.ts';const {BOSS_BY_ID}=await import(ep),s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
  const boss=BOSS_BY_ID['captain-varr'];s.player.restoreAt(boss.world.x-280,boss.world.y+50);s.streamCinematicView(boss.world.x,boss.world.y);
  const runtime=s as unknown as {enemies:Set<import('../../src/game/entities/Enemy').Enemy>;contentManager:{getState(id:string):{respawnAt:number;defeated:boolean}}};
  const e=[...runtime.enemies].find(e=>e.instanceId==='boss:captain-varr')!;e.takeDamage(e.hp+1,{x:1,y:0} as Phaser.Math.Vector2);
  const corpse=s.children.getByName('enemy-death:boss:captain-varr') as Phaser.GameObjects.Sprite;
  s.cameras.main.stopFollow().setZoom(2).centerOn(corpse.x,corpse.y-50);
  // Inspect the actual defeat clone on the GPU without the lair's tree crown
  // covering its boots. Gameplay keeps its original scenery draw order.
  s.children.list.forEach(o=>{if(o!==corpse)(o as Phaser.GameObjects.Sprite).setVisible?.(false);});
  s.add.rectangle(corpse.x,corpse.y,1800,1400,0x182029).setDepth(2000000);
  corpse.setVisible(true).setDepth(2000001);corpse.anims.setProgress(.4);
  const canvas=document.querySelector<HTMLCanvasElement>('.three-world-canvas')!;for(const el of [...document.querySelectorAll('body *')])if(el instanceof HTMLElement&&el!==canvas&&!el.contains(canvas))el.style.visibility='hidden';
  return {visible:Boolean(corpse?.active),texture:corpse?.texture.key,state:runtime.contentManager.getState('boss:captain-varr')};
 });
 expect(defeat.visible).toBe(true);expect(defeat.texture).toBe('enemy_bandit');expect(defeat.state.defeated).toBe(true);expect(defeat.state.respawnAt).toBeGreaterThan(Date.now());
 await page.screenshot({path:'test-results/boss-defeat-preserved.png'});
});
test('day birds and wind transition to night crickets and owl with silent BGM',async({page})=>{
 test.setTimeout(120000);await page.goto('/?e2e');await page.getByRole('button',{name:'Start New Game',exact:true}).click();await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'));
 await page.evaluate(async()=>{
  const sp='/src/store/gameStore.ts',{useGameStore}=await import(sp),s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s.scene.pause();s.physics.world.pause();
  const weather=(s as unknown as {weather:WeatherSystem}).weather as unknown as {enableAudio():void;update(delta:number,x:number,y:number,paused?:boolean):void;nature:{nextBird:number}};
  useGameStore.getState().hydrate({minuteOfDay:720,weatherAudio:true});weather.enableAudio();
  for(let i=0;i<30;i++)weather.update(100,s.player.x,s.player.y);weather.nature.nextBird=0;weather.update(100,s.player.x,s.player.y);
 });
 const get=()=>page.evaluate(()=>{
  const s=window.__mernondnaGame!.scene.getScene('world') as unknown as {weather:{music:HTMLAudioElement;nature:{birds:HTMLAudioElement;crickets:HTMLAudioElement;owl:HTMLAudioElement};gain:GainNode}};
  const w=s.weather;return{music:w.music?.volume,musicPaused:w.music?.paused,bird:w.nature.birds.volume,birdPaused:w.nature.birds.paused,cricket:w.nature.crickets.volume,cricketPaused:w.nature.crickets.paused,owl:w.nature.owl.volume,owlPaused:w.nature.owl.paused,wind:w.gain?.gain.value};
 });
 await expect.poll(async()=>!(await get()).birdPaused).toBe(true);
 // AudioContext.resume and scheduled wind gain settle on the audio thread;
 // virtual scene updates do not advance that thread's real-time clock.
 await expect.poll(async()=>(await get()).wind).toBeGreaterThan(0);
 const day=await get();expect(day.music).toBeCloseTo(.24,4);expect(day.bird).toBeGreaterThan(0);expect(day.cricket).toBe(0);expect(day.wind).toBeGreaterThan(0);
 await page.evaluate(async()=>{
  const sp='/src/store/gameStore.ts',{useGameStore}=await import(sp),s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
  const w=(s as unknown as {weather:WeatherSystem}).weather as unknown as {update(delta:number,x:number,y:number,paused?:boolean):void;nature:{nextOwl:number}};
  useGameStore.getState().hydrate({minuteOfDay:1200});w.nature.nextOwl=0;for(let i=0;i<30;i++)w.update(100,s.player.x,s.player.y);
 });
 await expect.poll(async()=>!(await get()).cricketPaused).toBe(true);await expect.poll(async()=>!(await get()).owlPaused).toBe(true);
 // Recording gains are user tuning; validate the day/night ownership and
 // audible night voices rather than imposing a fixed preference for volume.
 const night=await get();expect(night.music).toBe(0);expect(night.musicPaused).toBe(true);expect(night.birdPaused).toBe(true);expect(night.cricket).toBeGreaterThan(0);expect(night.owl).toBeGreaterThan(0);
 await page.evaluate(()=>{const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;(s as unknown as {weather:WeatherSystem}).weather.update(0,s.player.x,s.player.y,true);});
 const paused=await get();expect(paused.cricketPaused).toBe(true);expect(paused.owlPaused).toBe(true);expect(paused.musicPaused).toBe(true);
});
