import {test,expect} from '@playwright/test';
import type Phaser from 'phaser';
import type {WorldScene} from '../../src/game/scenes/WorldScene';
import type {GroundShadowSystem} from '../../src/game/systems/GroundShadowSystem';
import type {WaterSurfaceSystem} from '../../src/game/systems/WaterSurfaceSystem';
import type {WorldGenerator} from '../../src/game/systems/WorldGenerator';

for(const viewport of [{width:1280,height:720},{width:844,height:390}])test.describe('Render work at '+viewport.width+'px',()=>{
 test.use({viewport,hasTouch:viewport.width===844,isMobile:viewport.width===844});
 test('cached scenery, idle uploads and shoreline masks survive camera motion',async({page})=>{
  test.setTimeout(90000);await page.goto('/?e2e');await page.getByRole('button',{name:'Start New Game',exact:true}).click();
  await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'));
  const metrics=await page.evaluate(async()=>{
   const path='/src/data/worldSpriteGeometry.ts',ap='/src/data/art.ts';
   const {worldSpriteProfile}=await import(path),{artScale,worldPropOrigin}=await import(ap);
   const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
   const systems=s as unknown as {groundShadows:GroundShadowSystem;waterSurface:WaterSurfaceSystem;worldGenerator:WorldGenerator;worldSprites:{owned:Map<Phaser.GameObjects.Sprite,unknown>;register(actor:Phaser.GameObjects.Sprite,texture:string,frame:number,scale:number,solid:boolean):void}};
   s.scene.pause();const shadows=systems.groundShadows;
   const origin=worldPropOrigin('bridges',2,'bottom');
   const bridge=s.add.sprite(s.player.x+160,s.player.y+120,'bridges',2).setScale(artScale('bridges')).setOrigin(origin.x,origin.y).setName('render-budget-bridge');
   systems.worldSprites.register(bridge,'bridges',2,1,false);
   const casters=(shadows as unknown as {casters:Map<Phaser.GameObjects.Sprite,unknown>}).casters;
   const unshadowed=[...systems.worldSprites.owned.keys()].filter(actor=>{
    const key=actor.texture.key.split(':')[0],profile=worldSpriteProfile(key,Number(actor.frame.name));
    return (!profile?.floor||key==='bridges')&&!casters.has(actor);
   }).map(actor=>actor.name);
   for(const rail of s.children.list.filter(actor=>actor.name.startsWith('bridge-back:')||actor.name.startsWith('bridge-front:')))
    if(!casters.has(rail as Phaser.GameObjects.Sprite))unshadowed.push(rail.name);
   shadows.update(100,12,0);
   let staticUploads=0,actorUploads=0,draws=0;const restore:Array<()=>void>=[];
   for(const key of ['ground-shadows','ground-shadows-dynamic']){
    const texture=s.textures.get(key) as Phaser.Textures.CanvasTexture,ctx=texture.getContext(),refresh=texture.refresh,draw=ctx.drawImage;
    texture.refresh=function(){if(key==='ground-shadows')staticUploads++;else actorUploads++;return refresh.call(this);};
    ctx.drawImage=((...args:unknown[])=>{draws++;(draw as (...args:unknown[])=>void).apply(ctx,args);}) as typeof ctx.drawImage;
    restore.push(()=>{texture.refresh=refresh;ctx.drawImage=draw;});
   }
   for(let i=0;i<120;i++){s.player.x+=.5;shadows.update(8,12,0);}
   const moving={calls:120,staticUploads,actorUploads,draws};
   // Finish the last pending moving pose at the mobile 70ms cadence before
   // measuring uploads for an unchanged, settled pose.
   shadows.update(100,12,0);staticUploads=actorUploads=draws=0;
   for(let i=0;i<120;i++)shadows.update(8,12,0);
   const stationary={staticUploads,actorUploads,draws};restore.forEach(fn=>fn());
   // Controlled half-water fixture isolates the actual mask renderer from
   // region choice. Scrolling within overscan must reuse its terrain survey.
   const water=systems.waterSurface,world=systems.worldGenerator,original=world.getTerrainAt;
   const projection='/src/game/presentation25d/plane.ts';const {groundWorldView,groundForeshortening}=await import(projection);
   const camera=s.cameras.main;camera.stopFollow();camera.preRender();
   const view=groundWorldView(s),oldX=camera.scrollX,split=view.centerX;let terrainQueries=0;
   world.getTerrainAt=(x:number)=>{terrainQueries++;return x<split?'water':'grass';};
   (water as unknown as {base:{zoom:number}}).base.zoom=0;s.registry.set('openSeaView',false);water.update(100);
   const buffer=(water as unknown as {base:{x:number;y:number;zoom:number};mask:HTMLCanvasElement});
   const sample=(x:number)=>buffer.mask.getContext('2d')!.getImageData(Math.floor((x-buffer.base.x)*buffer.base.zoom),Math.floor((view.centerY-buffer.base.y)*buffer.base.zoom*groundForeshortening(s)),1,1).data[3];
   const mask={water:sample(split-64),land:sample(split+64)};terrainQueries=0;
   const texture=s.textures.get('moving-water') as Phaser.Textures.CanvasTexture,refresh=texture.refresh;let waterUploads=0;
   texture.refresh=function(){waterUploads++;return refresh.call(this);};
   for(let i=0;i<120;i++){camera.scrollX+=.2;camera.preRender();water.update(8);}
   texture.refresh=refresh;world.getTerrainAt=original;camera.scrollX=oldX;camera.preRender();
   return {unshadowed,moving,stationary,water:{calls:120,terrainQueries,uploads:waterUploads,mask}};
  });
  await test.info().attach('render-work.json',{body:JSON.stringify(metrics,null,2),contentType:'application/json'});
  console.log('Render work',viewport.width,JSON.stringify(metrics));
  expect(metrics.unshadowed).toEqual([]);expect(metrics.moving.staticUploads).toBe(0);
  expect(metrics.moving.actorUploads).toBeGreaterThan(0);expect(metrics.moving.actorUploads).toBeLessThan(32);
  expect(metrics.moving.draws).toBeLessThan(600);
  expect(metrics.stationary).toEqual({staticUploads:0,actorUploads:0,draws:0});
  expect(metrics.water.terrainQueries).toBe(0);expect(metrics.water.uploads).toBeGreaterThan(0);expect(metrics.water.uploads).toBeLessThan(22);
  expect(metrics.water.mask).toEqual({water:255,land:0});
 });
});
