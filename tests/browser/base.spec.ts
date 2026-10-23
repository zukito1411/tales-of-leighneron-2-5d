import { expect, test, type Page } from '@playwright/test';
import type { WorldScene } from '../../src/game/scenes/WorldScene';
import type { Enemy } from '../../src/game/entities/Enemy';
import type { Npc } from '../../src/game/entities/Npc';
import type Phaser from 'phaser';

// The scene handle exists only in Vite development mode with ?e2e.
declare global { interface Window { __mernondnaGame?: Phaser.Game } }

async function ready(page: Page) {
  await page.goto('/?e2e');
  await page.getByRole('button',{name:'Start New Game',exact:true}).click();
  await page.waitForFunction(() => {
    const game = window.__mernondnaGame;
    return game && (game.scene.getScene('world') as WorldScene)?.player?.active;
  });
  await expect(page.locator('.game-canvas canvas.three-world-canvas')).toBeVisible();
  await expect(page.locator('.game-canvas canvas:not(.three-world-canvas)')).toBeHidden();
  await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'));
}
async function snapshot(page: Page) {
  return page.evaluate(() => {
    const scene = window.__mernondnaGame!.scene.getScene('world') as WorldScene;
    return { x: scene.player.x, y: scene.player.y, hp: scene.player.hp, stamina: scene.player.stamina,
      vx: (scene.player.body as Phaser.Physics.Arcade.Body).velocity.x };
  });
}
async function closeDialogue(page: Page) {
  while (await page.locator('.dialogue-panel').isVisible()) {
    await page.locator('.dialogue-panel button').click();
  }
}

test('desktop movement, sprint, dash, menus, terrain chunks and NPC conversation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  await expect(page.locator('.status-card')).toContainText('Oakmere');
  const start = await snapshot(page);
  await page.keyboard.down('s');
  await expect.poll(async () => (await snapshot(page)).y).toBeGreaterThan(start.y + 15);
  await page.keyboard.up('s');
  await page.keyboard.down('d'); await page.keyboard.down('Shift');
  await expect.poll(async () => (await snapshot(page)).vx).toBeGreaterThan(220);
  await page.keyboard.down('q');
  await expect.poll(()=>page.evaluate(()=>{
    const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
    return {fast:(s.player.body as Phaser.Physics.Arcade.Body).velocity.x>400,
      trail:s.children.list.some(child=>child.name==='player-dash-afterimage'),
      effect:Boolean(s.children.getByName('combat-effect:fortification'))};
  }),{intervals:[20]}).toEqual({fast:true,trail:true,effect:true});
  await page.keyboard.up('q'); await page.keyboard.up('d'); await page.keyboard.up('Shift');
  await page.waitForTimeout(200);
  const lighting = await page.evaluate(async () => {
    const s = window.__mernondnaGame!.scene.getScene('world') as unknown as {
      player: { x: number; y: number; depth: number };
      textures:Phaser.Textures.TextureManager;
      dayNight: { minuteOfDay: number; overlay: { alpha:number; depth:number };
        update(delta: number, x: number, y: number): void };
      children: { list: Array<{ name: string; visible: boolean }> };
    };
    s.dayNight.minuteOfDay = 22 * 60;
    s.dayNight.update(100, s.player.x, s.player.y);
    const maskAlpha=await new Promise<number>(resolve=>(s.textures.get('night-overlay') as Phaser.Textures.DynamicTexture)
      .snapshotPixel(0,0,color=>resolve((color as Phaser.Display.Color).alpha/255)));
    return { playerGlow: s.children.list.some(child => child.name === 'night-player-light' && child.visible),
      fireflies: s.children.list.filter(child => child.name === 'firefly-light' && child.visible).length,
      darkness:maskAlpha*s.dayNight.overlay.alpha,
      overlayAboveWorld:s.dayNight.overlay.depth > s.player.depth };
  });
  expect(lighting.playerGlow).toBe(false); expect(lighting.fireflies).toBeGreaterThan(0);
  expect(lighting.darkness).toBeGreaterThan(0.6);
  expect(lighting.overlayAboveWorld).toBe(true);
  await page.keyboard.press('m');
  await expect(page.getByRole('dialog', { name: 'Mernodna world map' })).toBeVisible();
  await expect.poll(() => page.locator('.world-map-wrap img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  const clock = await page.locator('.status-meta').innerText();
  const paused = await snapshot(page);
  await page.waitForTimeout(850);
  expect((await snapshot(page)).x).toBe(paused.x);
  expect(await page.locator('.status-meta').innerText()).toBe(clock);
  await page.keyboard.press('m'); await page.keyboard.press('i');
  await expect(page.getByRole('dialog', { name: 'Inventory' })).toContainText('Roadwarden Sword');
  await page.keyboard.press('Escape');
  await page.keyboard.press('c');
  await expect(page.getByRole('dialog', { name: 'Character and skills' })).toContainText('Strength');
  await page.keyboard.press('c');
  await expect(page.getByRole('dialog', { name: 'Character and skills' })).not.toBeVisible();
  await page.evaluate(() => {
    const scene = window.__mernondnaGame!.scene.getScene('world') as WorldScene;
    scene.player.restoreAt(22 * 1536 + 1480, 25 * 1536 + 1000);
  });
  await page.keyboard.down('d');
  await expect.poll(async () => (await snapshot(page)).x).toBeGreaterThan(23 * 1536);
  await page.keyboard.up('d');
  await expect.poll(() => page.evaluate(() => {
    const s = window.__mernondnaGame!.scene.getScene('world') as unknown as { chunkManager: { getActiveKeys(): string[] } };
    return s.chunkManager.getActiveKeys();
  })).toContain('24:25'); // Physics can cross just after this frame's streaming update.
  const keys = await page.evaluate(() => {
    const s = window.__mernondnaGame!.scene.getScene('world') as unknown as { chunkManager: { getActiveKeys(): string[] } };
    return s.chunkManager.getActiveKeys();
  });
  expect(keys).toHaveLength(9); expect(keys).toContain('24:25'); expect(keys).not.toContain('21:25');
  await page.evaluate(() => {
    const s = window.__mernondnaGame!.scene.getScene('world') as WorldScene;
    const npc = (s as unknown as { npcs: Npc[] }).npcs.find(n => n.definition.id === 'aldren-vale')!;
    s.player.restoreAt(npc.x + 45, npc.y);
  });
  await page.keyboard.press('e');
  await expect(page.locator('.dialogue-panel')).toContainText('Aldren Vale');
  await page.keyboard.press('e');
  await expect(page.locator('.dialogue-panel')).toContainText('eastern watchtower');
  await page.keyboard.press('Escape');
  await expect(page.locator('.dialogue-panel')).not.toBeVisible();
  await expect(page.locator('.quest-card')).toContainText('Defeat Captain Varr');
  await expect(page.getByLabel('Quest destination: Captain Varr')).toHaveAttribute('data-objective','kill-varr');
  await page.screenshot({ path: 'test-results/desktop-base.png' });
  expect(errors).toEqual([]);
});

test('full-health Captain Varr defeat, immediate reload, first quest and fresh game', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await ready(page);
  await page.evaluate(() => {
    const s = window.__mernondnaGame!.scene.getScene('world') as WorldScene;
    const npc = (s as unknown as { npcs: Npc[] }).npcs.find(n => n.definition.id === 'aldren-vale')!;
    s.player.restoreAt(npc.x + 45, npc.y);
  });
  await page.keyboard.press('e');
  await expect(page.locator('.dialogue-panel')).toContainText('Aldren Vale');
  await closeDialogue(page);
  await expect(page.locator('.quest-card')).toContainText('Defeat Captain Varr');
  await page.evaluate(() => {
    const s = window.__mernondnaGame!.scene.getScene('world') as WorldScene;
    s.player.restoreAt(22 * 1536 + 768 + 1400, 25 * 1536 + 768 - 850 + 200);
  });
  await expect.poll(() => page.evaluate(() => {
    const s = window.__mernondnaGame!.scene.getScene('world') as unknown as { enemies: Set<Enemy> };
    return [...s.enemies].some(e => e.instanceId === 'boss:captain-varr');
  })).toBe(true);
  // Fixture positions only. Each blow goes through the real Space input, stamina,
  // cooldown, facing, hit geometry, damage, death, reward and save paths.
  const bossHp = await page.evaluate(() => {
    const s = window.__mernondnaGame!.scene.getScene('world') as unknown as { enemies: Set<Enemy> };
    return [...s.enemies].find(e => e.instanceId === 'boss:captain-varr')!.hp;
  });
  expect(bossHp).toBe(210);
  // Varr can step between the fixture placement and the input frame. A missed
  // swing still spends stamina/cooldown, so retry through real input rather
  // than assuming exactly twelve swings must land on a moving boss.
  for (let i = 0; i < 18; i++) {
    const remaining = await page.evaluate(() => {
      const s = window.__mernondnaGame!.scene.getScene('world') as unknown as { enemies:Set<Enemy> };
      return [...s.enemies].find(e => e.instanceId === 'boss:captain-varr')?.hp ?? 0;
    });
    if (remaining <= 0) break;
    await page.waitForFunction(() => {
      const s = window.__mernondnaGame!.scene.getScene('world') as WorldScene;
      return s.time.now >= (s.player as unknown as { nextAttackAt: number }).nextAttackAt && s.player.stamina >= 8;
    });
    await page.evaluate(() => {
      const s = window.__mernondnaGame!.scene.getScene('world') as WorldScene;
      const boss = [...(s as unknown as { enemies: Set<Enemy> }).enemies].find(e => e.instanceId === 'boss:captain-varr');
      if (boss) {
        for (let j = 0; j < 8; j++) {
          const angle = Math.PI / 2 + j * Math.PI / 4;
          const x = boss.x + Math.cos(angle) * 55, y = boss.y + Math.sin(angle) * 55;
          if (s.canEnemyOccupy(x, y) && s.hasClearPath(x, y, boss.x, boss.y)) {
            (s.player.body as Phaser.Physics.Arcade.Body).reset(x, y);
            s.player.lastDirection.set(-Math.cos(angle), -Math.sin(angle));
            return;
          }
        }
        throw new Error('Boss has no exposed attack direction');
      }
    });
    await page.keyboard.down('Space');
    await page.waitForTimeout(180);
    await page.keyboard.up('Space');
    // Retreat between blows rather than tanking the boss in place.
    await page.evaluate(() => {
      const s = window.__mernondnaGame!.scene.getScene('world') as WorldScene;
      const boss = [...(s as unknown as { enemies: Set<Enemy> }).enemies].find(e => e.instanceId === 'boss:captain-varr');
      if (boss) (s.player.body as Phaser.Physics.Arcade.Body).reset(boss.x, boss.y + 180);
    });
  }
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem('mernondna-25d-save-v1');
    return raw ? JSON.parse(raw).state.defeatedBosses : [];
  })).toContain('captain-varr');
  const saved = await page.evaluate(async () => {
    const path = '/src/utils/save.ts';
    const { parseSave } = await import(path);
    const raw = localStorage.getItem('mernondna-25d-save-v1')!;
    return { raw: JSON.parse(raw), parsed: parseSave(raw) };
  });
  expect(saved.parsed, JSON.stringify(saved.raw)).not.toBeNull();
  await page.reload();
  await page.waitForFunction(() => (window.__mernondnaGame?.scene.getScene('world') as WorldScene)?.player?.active);
  await expect(page.locator('.quest-card')).toContainText('Return to Aldren');
  await expect(page.getByLabel('Quest destination: Aldren Vale')).toHaveAttribute('data-objective','return-aldren');
  expect(await page.evaluate(() => {
    const s = window.__mernondnaGame!.scene.getScene('world') as unknown as { enemies: Set<Enemy> };
    return [...s.enemies].some(e => e.instanceId === 'boss:captain-varr');
  })).toBe(false);
  await page.evaluate(() => {
    const s = window.__mernondnaGame!.scene.getScene('world') as WorldScene;
    const npc = (s as unknown as { npcs: Npc[] }).npcs.find(n => n.definition.id === 'aldren-vale')!;
    s.player.restoreAt(npc.x + 45, npc.y);
  });
  await page.keyboard.press('e');
  await expect(page.locator('.dialogue-panel')).toContainText('Aldren Vale');
  await closeDialogue(page);
  await expect(page.locator('.quest-card')).toContainText('The Eightfold Blight');
  await expect(page.locator('.quest-guidance')).toHaveAttribute('data-objective','moonlit-warden');
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Save game', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Game saved locally');
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Start new game' }).click();
  await page.waitForFunction(() => (window.__mernondnaGame?.scene.getScene('world') as WorldScene)?.player?.active);
  await expect(page.locator('.quest-card')).toContainText('Speak with Aldren');
  expect(errors).toEqual([]);
});

for (const viewport of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
test(`mobile ${viewport.width}px joystick, multitouch sprint, dash, attack, interact and menus`, async ({ browser }) => {
  const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await ready(page);
  const touchTargets = await page.evaluate(() => {
    const rect = (selector: string) => {
      const { left, top, right, bottom, width, height } = document.querySelector(selector)!.getBoundingClientRect();
      return { left, top, right, bottom, width, height };
    };
    return {
      viewport:{ width:innerWidth, height:innerHeight },
      joystick:rect('.joystick'),
      controls:rect('.touch-actions'),
      attack:rect('.touch-button.attack'),
      sprint:rect('.touch-button.sprint'),
      skills:['.skill-1','.skill-2','.skill-3','.skill-4'].map(rect),
      controlsStyle:(()=>{
        const style=getComputedStyle(document.querySelector('.touch-actions')!);
        return {backgroundColor:style.backgroundColor,backgroundImage:style.backgroundImage,borderWidth:style.borderWidth,boxShadow:style.boxShadow};
      })(),
    };
  });
  expect(await page.evaluate(() => (window.__mernondnaGame!.scene.getScene('world') as WorldScene).cameras.main.zoom)).toBeLessThan(1);
  expect(touchTargets.attack.width).toBeGreaterThanOrEqual(70);
  expect(touchTargets.attack.height).toBeGreaterThanOrEqual(70);
  expect(touchTargets.controlsStyle).toEqual({backgroundColor:'rgba(0, 0, 0, 0)',backgroundImage:'none',borderWidth:'0px',boxShadow:'none'});
  if (touchTargets.viewport.width > touchTargets.viewport.height) {
    expect(touchTargets.skills[0].left).toBeLessThan(touchTargets.skills[1].left);
    expect(touchTargets.skills[1].left).toBeLessThan(touchTargets.skills[2].left);
    expect(Math.abs(touchTargets.skills[0].top-touchTargets.skills[1].top)).toBeLessThan(1);
    expect(Math.abs(touchTargets.skills[1].top-touchTargets.skills[2].top)).toBeLessThan(1);
    expect(touchTargets.attack.left).toBeGreaterThan(touchTargets.skills[2].right);
    expect(touchTargets.joystick.left).toBeGreaterThanOrEqual(8);
    expect(touchTargets.joystick.bottom).toBeLessThanOrEqual(touchTargets.viewport.height - 8);
    expect(touchTargets.controls.right).toBeLessThanOrEqual(touchTargets.viewport.width - 8);
    expect(touchTargets.joystick.right).toBeLessThan(touchTargets.controls.left);
    expect(touchTargets.sprint.left).toBeGreaterThan(touchTargets.joystick.right + 24);
    expect(touchTargets.sprint.left).toBeGreaterThanOrEqual(touchTargets.controls.left);
    expect(touchTargets.sprint.right).toBeLessThanOrEqual(touchTargets.controls.right);
    expect(touchTargets.sprint.bottom).toBeLessThanOrEqual(touchTargets.viewport.height - 8);
    expect(touchTargets.controls.bottom).toBeLessThanOrEqual(touchTargets.viewport.height - 8);
  }
  // Exercise movement on open terrain rather than dashing into Mira's solid NPC body.
  await page.evaluate(() => (window.__mernondnaGame!.scene.getScene('world') as WorldScene).player.restoreAt(22 * 1536 + 718, 25 * 1536 + 768));
  const cdp = await context.newCDPSession(page);
  const box = (await page.getByLabel('Movement joystick').boundingBox())!;
  const x = box.x + box.width * .85, y = box.y + box.height / 2;
  const run = (await page.getByRole('button', { name: 'Tap to dash, hold to sprint' }).boundingBox())!;
  const start = await snapshot(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await expect.poll(async () => (await snapshot(page)).vx).toBeGreaterThan(120);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }, { x: run.x + run.width / 2, y: run.y + run.height / 2, id: 2 }] });
  await expect.poll(async () => (await snapshot(page)).vx).toBeGreaterThan(200);
  await page.waitForTimeout(220);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => (await snapshot(page)).vx).toBe(0);
  expect((await snapshot(page)).x).toBeGreaterThan(start.x);
  const beforeDash = (await snapshot(page)).x;
  await page.getByRole('button', { name: 'Tap to dash, hold to sprint' }).tap();
  await expect.poll(async () => (await snapshot(page)).x).toBeGreaterThan(beforeDash + 25);
  const beforeAttack = await page.evaluate(() => {
    const player = (window.__mernondnaGame!.scene.getScene('world') as WorldScene).player;
    return (player as unknown as { nextAttackAt: number }).nextAttackAt;
  });
  await page.getByRole('button', { name: 'Attack', exact: true }).tap();
  await expect.poll(() => page.evaluate(() => {
    const player = (window.__mernondnaGame!.scene.getScene('world') as WorldScene).player;
    return (player as unknown as { nextAttackAt: number }).nextAttackAt;
  })).toBeGreaterThan(beforeAttack);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await expect.poll(async () => (await snapshot(page)).vx).toBeGreaterThan(100);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect.poll(async () => (await snapshot(page)).vx).toBe(0);
  await page.getByRole('button', { name: 'World Map' }).tap();
  await expect(page.getByRole('dialog', { name: 'Mernodna world map' })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).tap();
  await page.getByRole('button', { name: 'Gear' }).tap();
  await expect(page.getByRole('dialog', { name: 'Inventory' })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).tap();
  await page.getByRole('button', { name: 'Status' }).tap();
  await expect(page.getByRole('dialog', { name: 'Character and skills' })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).tap();
  await page.evaluate(() => {
    const s = window.__mernondnaGame!.scene.getScene('world') as WorldScene;
    const npc = (s as unknown as { npcs: Npc[] }).npcs.find(n => n.definition.id === 'aldren-vale')!;
    s.player.restoreAt(npc.x + 45, npc.y);
  });
  await expect(page.locator('.interaction-hint')).toContainText('Talk to Aldren Vale');
  await page.getByRole('button', { name: 'Interact', exact: true }).tap();
  await expect(page.locator('.dialogue-panel')).toContainText('Aldren Vale');
  await closeDialogue(page);
  await page.screenshot({ path: `test-results/mobile-${viewport.width}-base.png` });
  expect(errors).toEqual([]);
  await context.close();
});
}
