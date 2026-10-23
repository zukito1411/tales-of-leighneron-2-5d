import {test,expect} from '@playwright/test';
import type Phaser from 'phaser';
import type {WorldScene} from '../../src/game/scenes/WorldScene';
import type {Npc} from '../../src/game/entities/Npc';
import type {GroundShadowSystem} from '../../src/game/systems/GroundShadowSystem';

test.use({viewport:{width:1280,height:1600}});
test('all NPC families face downward with animated idles after proximity and story stops',async({page})=>{
 test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?e2e');await page.getByRole('button',{name:'Start New Game',exact:true}).click();
 await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'));
 const audit=await page.evaluate(async()=>{
  const np='/src/game/entities/Npc.ts',dp='/src/data/npcs.ts',ip='/src/data/npcIdleArt.ts';
  const {Npc:Actor}=await import(np),{NPCS}=await import(dp),{NPC_IDLE_ART}=await import(ip);
  const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s.scene.pause();s.physics.world.pause();
  s.children.list.forEach(o=>(o as Phaser.GameObjects.Sprite).setVisible?.(false));
  const cx=s.player.x,cy=s.player.y;s.cameras.main.stopFollow().setZoom(1).centerOn(cx,cy);
  s.add.rectangle(cx,cy,1500,1800,0x849778).setDepth(-945);
  const shadows=(s as unknown as {groundShadows:GroundShadowSystem}).groundShadows;
  for(const name of ['world-ground-shadows','actor-ground-shadows'])(s.children.getByName(name) as Phaser.GameObjects.Image).setVisible(true);
  const velocities=[{name:'down',x:0,y:44},{name:'left',x:-44,y:0},{name:'right',x:44,y:0},{name:'up',x:0,y:-44}];
  const results=NPC_IDLE_ART.flatMap((art:{walk:string},row:number)=>velocities.map((direction,col)=>{
   const def=NPCS.find((npc:{spriteTexture:string;formation?:unknown})=>npc.spriteTexture===art.walk&&!npc.formation);
   const x=cx-420+col*280,y=cy-620+row*145,npc=new Actor(s,def,x,y,{x,y}) as Npc;
   const body=npc.body as Phaser.Physics.Arcade.Body,present=npc as unknown as {playDirection(x:number,y:number,walking:boolean):void;preUpdate(time:number,delta:number):void};
   body.setVelocity(direction.x,direction.y);present.playDirection(direction.x,direction.y,true);
   const before={x:body.center.x,y:body.center.y,w:body.width,h:body.height};
   npc.updatePresentation(x+40,y,false);const proximity=npc.anims.currentAnim!.key;npc.storyRest();const story=npc.anims.currentAnim!.key;
   const frames:number[]=[];let stable=true;
   for(let i=0;i<24;i++){
    present.preUpdate(s.time.now+i*100,100);body.updateFromGameObject();frames.push(Number(npc.frame.name));
    stable&&=Math.abs(body.center.x-before.x)<1e-7&&Math.abs(body.center.y-before.y)<1e-7&&Math.abs(body.width-before.w)<1e-7&&Math.abs(body.height-before.h)<1e-7;
   }
   npc.nameLabel.setVisible(false);(npc as unknown as {titleLabel:Phaser.GameObjects.Text}).titleLabel.setVisible(false);
   shadows.register(npc);
   s.add.text(x,y+8,art.walk.replace('npc_','')+' / '+direction.name,{fontSize:'12px',color:'#111b17'}).setOrigin(.5,0).setDepth(y+80);
   const prepared=npc.anims.currentAnim!.frames.map(f=>s.textures.get(f.textureKey).get(f.textureFrame));
   const gpuSafe=prepared.every(f=>Math.abs(f.u0-f.cutX/f.source.width)<1e-7&&Math.abs(f.v0-f.cutY/f.source.height)<1e-7
    &&Math.abs(f.u1-(f.cutX+f.cutWidth)/f.source.width)<1e-7&&Math.abs(f.v1-(f.cutY+f.cutHeight)/f.source.height)<1e-7);
   return {family:art.walk,direction:direction.name,proximity,story,frames:new Set(frames).size,stable,gpuSafe,
    whole:prepared.every(f=>(f.customData as {fullSprite:boolean}).fullSprite)};
  }));
  shadows.update(100,12,0);
  const canvas=document.querySelector<HTMLCanvasElement>('.three-world-canvas')!;
  for(const e of [...document.querySelectorAll('body *')])if(e instanceof HTMLElement&&e!==canvas&&!e.contains(canvas))e.style.visibility='hidden';
  return results;
 });
 for(const result of audit){
  const idle=result.family+'-idle';
  expect(result.proximity).toBe(idle);expect(result.story).toBe(idle);expect(result.frames).toBe(6);expect(result.stable).toBe(true);expect(result.whole).toBe(true);expect(result.gpuSafe).toBe(true);
 }
 await page.screenshot({path:'test-results/npc-directional-idles-rendered.png'});expect(errors).toEqual([]);
});
