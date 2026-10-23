import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import type Phaser from 'phaser';
import type { WorldScene } from '../../src/game/scenes/WorldScene';
import type { Enemy } from '../../src/game/entities/Enemy';
import type { ContentChunkManager } from '../../src/game/systems/ContentChunkManager';

test.use({ trace: 'off' }); // Screencast tracing distorts frame-time measurements.

async function ready(page: Page, origin = '') {
  await page.goto(`${origin}/?e2e`);
  await page.getByRole('button', { name: 'Start New Game', exact: true }).click();
  await page.waitForFunction(() => window.__mernondnaGame?.registry.get('worldReady'));
}

test('M01 runtime exclusions, boss reservations, hard cap and save ledger', async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  const result = await page.evaluate(async () => {
    const ep = '/src/data/enemies.ts', cp = '/src/data/content.ts', tp = '/src/data/towns.ts', sp = '/src/utils/save.ts';
    const { BOSS_BY_ID, ENEMY_BY_ID } = await import(ep), { WORLD_CONTENT } = await import(cp);
    const { TOWN_BY_ID } = await import(tp), { saveGame, parseSave, SAVE_KEY } = await import(sp);
    const scene = window.__mernondnaGame!.scene.getScene('world') as WorldScene;
    const runtime = scene as unknown as { enemies: Set<Enemy>; contentManager: ContentChunkManager<Enemy> };
    scene.scene.pause(); scene.physics.world.pause();
    // Isolate this encounter without changing production placements or saves.
    for (const definition of [...WORLD_CONTENT, ...Object.values(runtime.contentManager.snapshot().spawns)] as import('../../src/game/types').ContentDefinition[]) {
      if (definition.kind === 'creature' && definition.id !== 'boss:captain-varr')
        runtime.contentManager.patchState(definition.id, { hp: 0, defeated: true, respawnAt: undefined });
    }
    const bossPosition = runtime.contentManager.getState('boss:captain-varr')!;
    scene.player.restoreAt(bossPosition.x - 400, bossPosition.y);
    scene.streamCinematicView(bossPosition.x, bossPosition.y);
    const boss = runtime.contentManager.getActor('boss:captain-varr')!;
    const before = runtime.contentManager.getSpawnCount();
    const forbidden = [
      scene.spawnEnemy('road-bandit', TOWN_BY_ID.oakmere.world.x, TOWN_BY_ID.oakmere.world.y),
      scene.spawnEnemy('road-bandit', 0, 0),
      scene.spawnEnemy('marsh-wraith', boss.x, boss.y), // Non-native species at actual Trandum candidate.
    ];
    const rejectionSpent = runtime.contentManager.getSpawnCount() - before;
    let ambient = 0;
    // Overlapping test positions isolate admission from random placement. No
    // production encounter changes; physics/AI is paused for this fixture.
    for (let i = 0; i < 20; i++) {
      if (!scene.spawnEnemy('road-bandit', boss.x, boss.y)) break;
      ambient++;
    }
    const reservedCount = runtime.enemies.size;
    const summons = [0, 1, 2].map(() => scene.spawnEnemy('road-bandit', boss.x, boss.y, true, boss));
    const fullCount = runtime.enemies.size;
    const otherBoss = BOSS_BY_ID['moonlit-warden'];
    runtime.contentManager.patchState(`boss:${otherBoss.id}`, { x: boss.x, y: boss.y,
      hp: ENEMY_BY_ID[otherBoss.enemyId].hp, defeated: false, respawnAt: undefined });
    scene.streamCinematicView(boss.x, boss.y);
    const overflowBoss = Boolean(runtime.contentManager.getActor(`boss:${otherBoss.id}`));
    const victim = [...runtime.enemies].find(enemy => !enemy.definition.boss)!;
    runtime.contentManager.patchState(victim.instanceId, { hp: 0, defeated: true });
    scene.streamCinematicView(boss.x, boss.y);
    const deferredBoss = Boolean(runtime.contentManager.getActor(`boss:${otherBoss.id}`));
    const finalCount = runtime.enemies.size;
    const saved = saveGame();
    const parsed = parseSave(localStorage.getItem(SAVE_KEY)!);
    return { forbidden, rejectionSpent, ambient, reservedCount, summons, fullCount, overflowBoss, deferredBoss,
      finalCount, saved, version: parsed?.version, retainedDeath: parsed?.state.worldContent.states[victim.instanceId]?.defeated,
      allSafe: [...runtime.enemies].every(enemy => scene.canEnemyOccupy(enemy.x, enemy.y)) };
  });
  expect(result).toEqual({ forbidden: [false, false, false], rejectionSpent: 0, ambient: 13, reservedCount: 14,
    summons: [true, true, false], fullCount: 16, overflowBoss: false, deferredBoss: true, finalCount: 16,
    saved: true, version: 5, retainedDeath: true, allSafe: true });
  expect(errors).toEqual([]);
  await test.info().attach('ecology-runtime.json', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
});

for (const mobile of [false, true]) test.describe(mobile ? 'M01 touch comparison' : 'M01 desktop comparison', () => {
  test.use({ viewport: mobile ? { width: 844, height: 390 } : { width: 1280, height: 720 },
    hasTouch: mobile, isMobile: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  test('day, afternoon and night baseline with repeated streaming and memory counters', async ({ page }) => {
    test.skip(!process.env.M01_BASELINE_URL, 'Set M01_BASELINE_URL to the unchanged base-revision Vite server.');
    test.setTimeout(420000);
    const revisions = [];
    for (const [revision, origin] of [['baseline', process.env.M01_BASELINE_URL!], ['current', '']]) {
      await ready(page, origin);
      const metrics = await page.evaluate(async () => {
        const tp = '/src/data/towns.ts'; const { TOWN_BY_ID } = await import(tp);
        const scene = window.__mernondnaGame!.scene.getScene('world') as WorldScene;
        const runtime = scene as unknown as { enemies: Set<Enemy>; contentManager: ContentChunkManager<Enemy>;
          dayNight: { minuteOfDay: number; update(delta: number, x: number, y: number): void } };
        const presented=document.querySelector<HTMLCanvasElement>('.three-world-canvas');
        const gl=presented?.getContext('webgl2')??(scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).gl;
        const counters = () => {
          const sources = new Set<Phaser.Textures.TextureSource>();
          for (const texture of Object.values(scene.textures.list)) for (const source of texture.source) sources.add(source);
          return { textures: sources.size, textureBytesEstimate: [...sources].reduce((n, s) => n + s.width * s.height * 4, 0),
            heapBytes: (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null,
            bodies: scene.physics.world.bodies.size + scene.physics.world.staticBodies.size,
            hostiles: runtime.enemies.size, records: runtime.contentManager.getSpawnCount() };
        };
        const cases = [];
        const frame = () => new Promise<number>(resolve => requestAnimationFrame(resolve));
        for (const [label, townId, minute] of [['day', 'oakmere', 720], ['afternoon', 'oakmere', 1020], ['night', 'highmere', 1320]] as const) {
          const town = TOWN_BY_ID[townId];
          // Same surveyed quiet woodland edge in both revisions, then a dense capital at night.
          const x = town.world.x + (label === 'day' ? 1900 : 0), y = town.world.y;
          scene.player.restoreAt(x, y); scene.cameras.main.centerOn(x, y);
          scene.streamCinematicView(x, y); runtime.dayNight.minuteOfDay = minute;
          runtime.dayNight.update(0, x, y);
          for (let i = 0; i < 24; i++) await frame();
          const before = counters();
          let draws = 0, uploads = 0, aiUpdates = 0;
          const drawArrays = gl.drawArrays, drawElements = gl.drawElements, image = gl.texImage2D, subImage = gl.texSubImage2D;
          const instanced='drawElementsInstanced' in gl?gl as WebGL2RenderingContext:null;
          const drawArraysInstanced=instanced?.drawArraysInstanced,drawElementsInstanced=instanced?.drawElementsInstanced;
          gl.drawArrays = function (...args: Parameters<typeof drawArrays>) { draws++; return drawArrays.apply(this, args); };
          gl.drawElements = function (...args: Parameters<typeof drawElements>) { draws++; return drawElements.apply(this, args); };
          gl.texImage2D = ((...args: unknown[]) => { uploads++; (image as (...args: unknown[]) => void).apply(gl, args); }) as typeof image;
          gl.texSubImage2D = ((...args: unknown[]) => { uploads++; (subImage as (...args: unknown[]) => void).apply(gl, args); }) as typeof subImage;
          if(instanced&&drawArraysInstanced&&drawElementsInstanced){
            instanced.drawArraysInstanced=function(...args:Parameters<typeof drawArraysInstanced>){draws++;return drawArraysInstanced.apply(this,args);};
            instanced.drawElementsInstanced=function(...args:Parameters<typeof drawElementsInstanced>){draws++;return drawElementsInstanced.apply(this,args);};
          }
          const updates = [...runtime.enemies].map(enemy => ({ enemy, update: enemy.updateEnemy }));
          for (const { enemy, update } of updates) enemy.updateEnemy = function (...args: Parameters<typeof update>) {
            aiUpdates++; return update.apply(this, args);
          };
          const intervals: number[] = [];
          try{
            let previous=await frame();
            for(let i=0;i<120;i++){const now=await frame();intervals.push(now-previous);previous=now;}
          }finally{
            gl.drawArrays=drawArrays;gl.drawElements=drawElements;gl.texImage2D=image;gl.texSubImage2D=subImage;
            if(instanced&&drawArraysInstanced&&drawElementsInstanced){instanced.drawArraysInstanced=drawArraysInstanced;instanced.drawElementsInstanced=drawElementsInstanced;}
            for(const {enemy,update} of updates)enemy.updateEnemy=update;
          }
          intervals.sort((a, b) => a - b);
          const percentile = (p: number) => intervals[Math.ceil(intervals.length * p) - 1];
          cases.push({ label, medianMs: percentile(.5), p95Ms: percentile(.95), p99Ms: percentile(.99),
            maxMs: intervals.at(-1), draws, uploads, aiUpdates, before, after: counters() });
        }
        scene.scene.pause(); scene.physics.world.pause();
        const home = TOWN_BY_ID.oakmere.world, distant = TOWN_BY_ID.highmere.world;
        const travel = [];
        for (let i = 0; i < 6; i++) {
          for (const point of [distant, home]) {
            scene.player.restoreAt(point.x, point.y); scene.streamCinematicView(point.x, point.y);
            // A real frame drains Arcade's destruction queue in postUpdate.
            // This paused, synchronous travel fixture must do that explicitly.
            scene.physics.world.postUpdate();
          }
          travel.push(counters());
        }
        return { cases, travel, renderer: gl.getParameter(gl.RENDERER), userAgent: navigator.userAgent };
      });
      revisions.push({ revision, metrics });
      const artifact = test.info().outputPath(`${revision}-${mobile ? 'touch' : 'desktop'}.json`);
      await mkdir(test.info().outputDir, { recursive: true });
      await writeFile(artifact, JSON.stringify(metrics, null, 2));
      await test.info().attach(`${revision}-${mobile ? 'touch' : 'desktop'}.json`, { path: artifact, contentType: 'application/json' });
      console.log(revision, mobile ? 'touch' : 'desktop', JSON.stringify(metrics.cases.map(c => ({ phase: c.label,
        median: c.medianMs, p95: c.p95Ms, p99: c.p99Ms, textures: c.after.textures, bodies: c.after.bodies }))));
      await page.screenshot({ path: test.info().outputPath(`${revision}-night.png`) });
      // Let the old game's destroy handler run before switching origins.
      await page.goto('about:blank');
    }
    const baseline = revisions[0].metrics, current = revisions[1].metrics;
    for (let i = 0; i < current.cases.length; i++) {
      expect(current.cases[i].after.hostiles).toBeLessThanOrEqual(16);
      expect(current.cases[i].after.textureBytesEstimate).toBe(baseline.cases[i].after.textureBytesEstimate);
      // Headless SwiftShader is a comparison tool, not an Android FPS claim.
      expect(current.cases[i].medianMs).toBeLessThanOrEqual(baseline.cases[i].medianMs * 1.25 + 2);
      expect(current.cases[i].p95Ms).toBeLessThanOrEqual(baseline.cases[i].p95Ms * 1.25 + 4);
    }
    const settled = current.travel.slice(1);
    expect(new Set(settled.map(c => c.textures)).size).toBe(1);
    expect(new Set(settled.map(c => c.bodies)).size).toBe(1);
    expect(new Set(settled.map(c => c.textureBytesEstimate)).size).toBe(1);
  });
});
