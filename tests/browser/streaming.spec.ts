import { expect, test, type Page } from '@playwright/test';
import type { WorldScene } from '../../src/game/scenes/WorldScene';
import type { ContentChunkManager } from '../../src/game/systems/ContentChunkManager';
import type { Enemy } from '../../src/game/entities/Enemy';
import type Phaser from 'phaser';

type StreamScene = { contentManager: ContentChunkManager<Phaser.GameObjects.Sprite | Phaser.GameObjects.Text> };
async function ready(page: Page) {
  await page.goto('/?e2e');
  await page.waitForFunction(() => (window.__mernondnaGame?.scene.getScene('world') as WorldScene)?.player?.active);
}
async function activeIds(page: Page) {
  return page.evaluate(() => (window.__mernondnaGame!.scene.getScene('world') as unknown as StreamScene).contentManager.getActiveIds());
}
async function travelFixture(page: Page, x: number, y: number) {
  await page.evaluate(({ x, y }) => (window.__mernondnaGame!.scene.getScene('world') as WorldScene).player.restoreAt(x, y), { x, y });
  const firstArrival=await page.evaluate(async({x,y})=>{
    const path='/src/store/gameStore.ts';const s=(await import(path)).useGameStore.getState();
    return Math.abs(x-(31*1536+768))<2000&&Math.abs(y-(22*1536+768))<2000&&!s.storyFlags['scene:highmere-arrival'];
  },{x,y});
  if(firstArrival){await page.getByRole('button',{name:'Skip scene · Esc'}).click();await expect(page.getByRole('region',{name:'Story scene'})).toBeHidden();}
}
async function storeState(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('mernondna-25d-save-v1')!).state);
}

test('streamed actors, damaged creatures, NPC state and used loot survive travel and reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await ready(page);
  const initial = await activeIds(page);
  expect(initial.filter(id => id.startsWith('npc:'))).toHaveLength(9);
  expect(initial).toContain('town:oakmere'); expect(initial).not.toContain('town:highmere');
  // The authored village now includes orchard/grove trees and field boundaries;
  // these props don't raise the existing creature/AI budget.
  expect(initial.length).toBeLessThan(140);
  await page.evaluate(() => {
    const s = window.__mernondnaGame!.scene.getScene('world') as WorldScene;
    const m = (s as unknown as StreamScene).contentManager;
    (m.getActor('creature:oakmere-wolf-east') as Enemy).hp = 17;
    m.patchState('npc:aldren-vale', { trust: 61 });
    const boar = m.getActor('creature:oakmere-boar-north') as Enemy;
    boar.takeDamage(100, s.player.lastDirection);
    s.syncState();
  });
  const beforeGold = (await storeState(page)).gold;
  await travelFixture(page, 22 * 1536 + 768 + 560, 25 * 1536 + 768 + 145);
  await page.keyboard.press('e');
  await expect(page.getByRole('status')).toContainText('twelve coins');
  expect((await storeState(page)).gold).toBe(beforeGold + 12);
  await page.keyboard.press('e');
  await expect(page.getByRole('status')).toContainText('empty');
  expect((await storeState(page)).gold).toBe(beforeGold + 12);
  // Travel fixture places the player; normal scene/chunk logic performs all loading.
  await travelFixture(page, 31 * 1536 + 768, 22 * 1536 + 848);
  await expect.poll(() => activeIds(page)).toContain('town:highmere');
  expect(await activeIds(page)).not.toContain('npc:aldren-vale');
  expect(await activeIds(page)).not.toContain('town:oakmere');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save game', exact: true }).click();
  const saved = await storeState(page);
  expect(saved.worldContent.states['creature:oakmere-wolf-east'].hp).toBe(17);
  expect(saved.worldContent.states['creature:oakmere-boar-north'].defeated).toBe(true);
  expect(saved.worldContent.states['npc:aldren-vale'].trust).toBe(61);
  await page.reload();
  await page.waitForFunction(() => (window.__mernondnaGame?.scene.getScene('world') as WorldScene)?.player?.active);
  await expect.poll(() => activeIds(page)).toContain('town:highmere');
  await travelFixture(page, 22 * 1536 + 768, 25 * 1536 + 848);
  await expect.poll(() => activeIds(page)).toContain('npc:aldren-vale');
  expect(await activeIds(page)).not.toContain('creature:oakmere-boar-north');
  expect(await page.evaluate(() => {
    const m = (window.__mernondnaGame!.scene.getScene('world') as unknown as StreamScene).contentManager;
    return (m.getActor('creature:oakmere-wolf-east') as Enemy).hp;
  })).toBe(17);
  await travelFixture(page, 22 * 1536 + 768 + 560, 25 * 1536 + 768 + 145);
  await page.keyboard.press('e');
  await expect(page.getByRole('status')).toContainText('empty');
  expect((await storeState(page)).gold).toBe(beforeGold + 12);
  for (let i = 0; i < 3; i++) {
    await travelFixture(page, 31 * 1536 + 768, 22 * 1536 + 848);
    await expect.poll(() => activeIds(page)).toContain('town:highmere');
    await travelFixture(page, 22 * 1536 + 768, 25 * 1536 + 848);
    await expect.poll(() => activeIds(page)).toContain('npc:aldren-vale');
  }
  expect(await page.evaluate(() => (window.__mernondnaGame!.scene.getScene('world') as WorldScene).physics.world.colliders.getActive().length)).toBe(6);
  await page.screenshot({ path: 'test-results/streamed-oakmere.png' });
  expect(errors).toEqual([]);
});

test('dynamic encounter actors keep their IDs and wounded state when unloaded', async ({ page }) => {
  await ready(page);
  const id = await page.evaluate(() => {
    const s = window.__mernondnaGame!.scene.getScene('world') as WorldScene;
    const m = (s as unknown as StreamScene).contentManager;
    const before = new Set(m.getActiveIds());
    s.spawnEnemy('gray-wolf', s.player.x + 1500, s.player.y + 650, true);
    const id = m.getActiveIds().find(id => !before.has(id) && id.startsWith('spawn:'))!;
    (m.getActor(id) as Enemy).hp = 9;
    s.syncState(); return id;
  });
  expect(id).toMatch(/^spawn:/);
  await travelFixture(page, 31 * 1536 + 768, 22 * 1536 + 848);
  await expect.poll(() => activeIds(page)).not.toContain(id);
  await page.reload();
  await page.waitForFunction(() => (window.__mernondnaGame?.scene.getScene('world') as WorldScene)?.player?.active);
  await travelFixture(page, 22 * 1536 + 768, 25 * 1536 + 848);
  await expect.poll(() => activeIds(page)).toContain(id);
  expect(await page.evaluate(id => {
    const m = (window.__mernondnaGame!.scene.getScene('world') as unknown as StreamScene).contentManager;
    return (m.getActor(id) as Enemy).hp;
  }, id)).toBe(9);
});
