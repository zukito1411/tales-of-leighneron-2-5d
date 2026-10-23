import { test, expect } from '@playwright/test';
import type { WorldScene } from '../../src/game/scenes/WorldScene';
import type { Enemy } from '../../src/game/entities/Enemy';
import type { EventDirector } from '../../src/game/systems/EventDirector';
import type { ContentChunkManager } from '../../src/game/systems/ContentChunkManager';
import type Phaser from 'phaser';

type Details = { contentManager: ContentChunkManager<Phaser.GameObjects.Sprite | Phaser.GameObjects.Text>; enemies:Set<Enemy>; eventDirector:EventDirector };
test('villages reject normal/event spawns and keep wanderers and pursuit outside', async ({ page }) => {
  await page.goto('/?e2e');
  await page.waitForFunction(() => (window.__mernondnaGame?.scene.getScene('world') as WorldScene)?.player?.active);
  const initial = await page.evaluate(() => {
    const s = window.__mernondnaGame!.scene.getScene('world') as WorldScene, d = s as unknown as Details;
    const home = { x:22 * 1536 + 768,y:25 * 1536 + 768 }, before = d.contentManager.getSpawnCount();
    const rejected = [[0,80],[-630,500],[350,220],[1080,450]].flatMap(([x,y]) => [false,true].map(event =>
      s.spawnEnemy('gray-wolf',home.x + x,home.y + y,event)));
    for (let i = 0; i < 40; i++) d.eventDirector.update(28000,'trandum',20,home.x,home.y + 80);
    return { rejected,before,after:d.contentManager.getSpawnCount(),allSafe:[...d.enemies].every(e => s.isEnemyTerritory(e.x,e.y)) };
  });
  expect(initial.rejected).toEqual(Array(8).fill(false)); expect(initial.after).toBe(initial.before); expect(initial.allSafe).toBe(true);
  await page.evaluate(() => {
    const s = window.__mernondnaGame!.scene.getScene('world') as WorldScene, d = s as unknown as Details;
    const wolf = d.contentManager.getActor('creature:oakmere-wolf-east') as Enemy, homeX = 22 * 1536 + 768, y = 25 * 1536 + 768 + 450;
    s.player.restoreAt(homeX + 1080,y); // Protected edge, close enough to provoke a broken chase.
    const body = wolf.body as Phaser.Physics.Arcade.Body;
    body.reset(homeX + 1108,y); wolf.updateEnemy(s.time.now);
    body.reset(homeX + 1000,y); wolf.updateEnemy(s.time.now); // Existing penetration is corrected.
    if (!s.isEnemyTerritory(wolf.x,wolf.y)) throw new Error('Monster remained inside village boundary');
    const original = wolf.updateEnemy.bind(wolf), stats = { corrected:0,unsafeAfter:0 };
    wolf.setData('territory-test',stats);
    wolf.updateEnemy = time => {
      if (!s.isEnemyTerritory(wolf.x,wolf.y)) stats.corrected++;
      original(time);
      if (!s.isEnemyTerritory(wolf.x,wolf.y)) stats.unsafeAfter++;
    };
    const movement = wolf as unknown as { wander:Phaser.Math.Vector2; nextWanderAt:number };
    movement.wander.set(-84,0); movement.nextWanderAt = s.time.now + 60000;
  });
  await expect.poll(() => page.evaluate(() => {
    const s = window.__mernondnaGame!.scene.getScene('world') as unknown as Details;
    return (s.contentManager.getActor('creature:oakmere-wolf-east') as Enemy).getData('territory-test').corrected;
  })).toBeGreaterThan(0);
  const boundary = await page.evaluate(() => {
    const s = window.__mernondnaGame!.scene.getScene('world') as WorldScene;
    const wolf = (s as unknown as Details).contentManager.getActor('creature:oakmere-wolf-east') as Enemy;
    return { safe:s.isEnemyTerritory(wolf.x,wolf.y),unsafe:wolf.getData('territory-test').unsafeAfter,hp:s.player.hp };
  });
  expect(boundary).toEqual({ safe:true,unsafe:0,hp:100 });
});

test('old in-village authored/event saves relocate without resetting wounds or dead creatures', async ({ page }) => {
  await page.goto('/?e2e');
  await page.waitForFunction(() => (window.__mernondnaGame?.scene.getScene('world') as WorldScene)?.player?.active);
  const oldSave = await page.evaluate(() => {
    const s = window.__mernondnaGame!.scene.getScene('world') as WorldScene; s.syncState();
    const raw = JSON.parse(localStorage.getItem('mernondna-25d-save-v1')!), inside = { x:22 * 1536 + 768,y:25 * 1536 + 848 };
    raw.state.worldContent.states['creature:oakmere-wolf-east'] = { ...inside,hp:17 };
    raw.state.worldContent.states['creature:oakmere-boar-north'] = { ...inside,hp:0,defeated:true };
    raw.state.worldContent.states['spawn:0'] = { ...inside,hp:9 };
    raw.state.worldContent.spawns['spawn:0'] = { id:'spawn:0',kind:'creature',enemyId:'gray-wolf',eventSpawn:true,world:inside };
    raw.state.worldContent.nextSpawnSequence = 1;
    return JSON.stringify(raw);
  });
  // Production pagehide autosaves intentionally flush the current world. Load
  // the old-save fixture before the next app boots, not before leaving this one.
  await page.addInitScript(saved => localStorage.setItem('mernondna-25d-save-v1',saved),oldSave);
  await page.reload();
  await page.waitForFunction(() => (window.__mernondnaGame?.scene.getScene('world') as WorldScene)?.player?.active);
  const repaired = await page.evaluate(() => {
    const s = window.__mernondnaGame!.scene.getScene('world') as WorldScene, d = s as unknown as Details;
    const wolf = d.contentManager.getActor('creature:oakmere-wolf-east') as Enemy, event = d.contentManager.getActor('spawn:0') as Enemy;
    s.syncState();
    return { wolfHp:wolf.hp,eventHp:event.hp,allSafe:[...d.enemies].every(e => s.isEnemyTerritory(e.x,e.y)),
      boarAlive:Boolean(d.contentManager.getActor('creature:oakmere-boar-north')),boarDead:d.contentManager.getState('creature:oakmere-boar-north')!.defeated,
      sequence:d.contentManager.snapshot().nextSpawnSequence,version:JSON.parse(localStorage.getItem('mernondna-25d-save-v1')!).version };
  });
  expect(repaired).toEqual({ wolfHp:17,eventHp:9,allSafe:true,boarAlive:false,boarDead:true,sequence:1,version:4 });
});
