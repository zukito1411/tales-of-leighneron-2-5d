import {test,expect} from '@playwright/test';
import type Phaser from 'phaser';
import type {WorldScene} from '../../src/game/scenes/WorldScene';
test.use({viewport:{width:1280,height:1100}});
test('Trandum guard art renders complete, consistently sized poses without frame bleed',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?e2e');await page.getByRole('button',{name:'Start New Game',exact:true}).click();
 await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'));
 const result=await page.evaluate(async()=>{
  const ap='/src/data/art.ts',ip='/src/data/npcIdleArt.ts',np='/src/game/entities/Npc.ts',dp='/src/data/npcs.ts',gp='/src/game/systems/GuardMarchArt.ts';
  const {ART_BY_KEY}=await import(ap),{NPC_IDLE_ART,npcIdleSources}=await import(ip),{Npc}=await import(np),{NPCS}=await import(dp),{guardMarchScale}=await import(gp);
  const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s.scene.pause();s.physics.world.pause();
  s.children.list.forEach(o=>(o as Phaser.GameObjects.Sprite).setVisible?.(false));const x=s.player.x,y=s.player.y;
  s.cameras.main.stopFollow().setZoom(1).centerOn(x,y);s.add.rectangle(x,y,1500,1300,0x78917b).setDepth(-2000);
  const texture='npc_guard_march',atlas=s.textures.get(texture),image=atlas.getSourceImage() as HTMLCanvasElement,ctx=image.getContext('2d')!;
  const idle=NPC_IDLE_ART.find((entry:{walk:string;regions:number[][]})=>entry.walk==='npc_guard')!,marchScale=guardMarchScale(s,texture,idle);
  const poses=Array.from({length:24},(_,frame)=>{
   const f=atlas.get(frame),meta=f.customData as {visibleBounds:{left:number;top:number;width:number;height:number};sourceRegion:number[]};
   const b=meta.visibleBounds,rgba=ctx.getImageData(f.cutX,f.cutY,f.cutWidth,f.cutHeight).data;let border=0,feet=0;
   for(let py=0;py<f.cutHeight;py++)for(let px=0;px<f.cutWidth;px++){const a=rgba[(py*f.cutWidth+px)*4+3];if(a>64&&(px<2||py<2||px>=f.cutWidth-2||py>=f.cutHeight-2))border++;if(a>64&&py>f.cutHeight-24)feet++;}
   s.add.sprite(x-450+frame%6*180,y-290+Math.floor(frame/6)*175,texture,frame).setScale(marchScale).setOrigin(.5,1-2/ART_BY_KEY[texture].frameHeight).setDepth(y+1000);
   return{frame,border,feet,b,gpu:Math.abs(f.v0-f.cutY/f.source.height)<1e-7};
  });
  const def=NPCS.find((d:{spriteTexture:string;formation?:unknown})=>d.spriteTexture==='npc_royal_guard'&&!d.formation);
  if(!def)throw new Error('Missing royal guard NPC for Trandum artwork coverage');
  const actor=new Npc(s,def,x-350,y+460,{x:x-350,y:y+460});
  const p=actor as unknown as {playDirection(x:number,y:number,moving:boolean):void},body=actor.body as Phaser.Physics.Arcade.Body,animations:string[]=[];
  for(const [dx,dy] of [[0,1],[-1,0],[1,0],[0,-1]]){body.setVelocity(dx*44,dy*44);p.playDirection(dx,dy,true);animations.push(actor.anims.currentAnim?.key??'');}
  body.setVelocity(0,0);p.playDirection(0,0,false);const idleTexture=actor.texture.key,idleAnimation=actor.anims.currentAnim?.key;
  const idleHeight=Math.max(...idle.regions.map(([, , ,height]:number[])=>height))*npcIdleSources(idle)[0].renderScale!;
  const marchHeight=Math.max(...poses.map(({b})=>b.height*2))*marchScale;
  actor.nameLabel.setVisible(false);(actor as unknown as {titleLabel:Phaser.GameObjects.Text}).titleLabel.setVisible(false);
  for(let i=0;i<6;i++)s.add.sprite(x-160+i*100,y+460,'npc_guard_idle',i).setScale(.5).setOrigin(.5,1-2/112).setDepth(y+1000);
  const canvas=document.querySelector<HTMLCanvasElement>('.three-world-canvas')!;for(const e of [...document.querySelectorAll('body *')])if(e instanceof HTMLElement&&e!==canvas&&!e.contains(canvas))e.style.visibility='hidden';
  return{poses,animations,idleTexture,idleAnimation,idleHeight,marchHeight};
 });
 for(const p of result.poses){expect(p.border,`frame ${p.frame} containment`).toBe(0);expect(p.feet,`frame ${p.frame} foot pixels`).toBeGreaterThan(20);expect(p.gpu).toBe(true);expect(p.b.width).toBeGreaterThan(0);expect(p.b.height).toBeGreaterThan(0);}
 expect(result.animations).toEqual(['npc_guard-down','npc_guard-left','npc_guard-right','npc_guard-up']);
 expect(result.idleTexture).toBe('npc_guard_idle');expect(result.idleAnimation).toBe('npc_guard-idle');
 expect(result.marchHeight).toBeCloseTo(result.idleHeight,6);
 await page.screenshot({path:'test-results/trandum-guard-all-poses.png'});expect(errors).toEqual([]);
});
