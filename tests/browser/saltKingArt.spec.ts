import {test,expect} from '@playwright/test';
import type Phaser from 'phaser';
import type {WorldScene} from '../../src/game/scenes/WorldScene';
test.use({viewport:{width:1280,height:1500}});
test('Salt King complete pirate poses render with stable feet, scale and isolated GPU frames',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?e2e');await page.getByRole('button',{name:'Start New Game',exact:true}).click();
 await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'),null,{timeout:45000});
 const audit=await page.evaluate(async()=>{
  const ep='/src/game/entities/Enemy.ts',dp='/src/data/enemies.ts',ap='/src/data/animationPacks.ts',artp='/src/data/art.ts';
  const {Enemy}=await import(ep),{ENEMY_BY_ID}=await import(dp),{enemyAnimation}=await import(ap),{ART_BY_KEY}=await import(artp);
  const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s.scene.pause();s.physics.world.pause();
  const invalid:string[]=[],sizes:Array<{state:string;heights:number[];fits:number[]}> = [];
  for(const key of ['enemy_walk_salt_king','enemy_salt_king']){
   const t=s.textures.get(key),c=t.getSourceImage() as HTMLCanvasElement,ctx=c.getContext('2d')!;
   for(const frame of Object.values(t.frames).filter(f=>f.name!=='__BASE')){
    const rgba=ctx.getImageData(frame.cutX,frame.cutY,frame.cutWidth,frame.cutHeight).data;
    if(Math.abs(frame.v0-frame.cutY/frame.source.height)>1e-7||Math.abs(frame.v1-(frame.cutY+frame.cutHeight)/frame.source.height)>1e-7)invalid.push(key+'/'+frame.name+'/UV');
    for(let y=0;y<frame.cutHeight;y++)for(let x=0;x<frame.cutWidth;x++)if((x<3||y<3||x>=frame.cutWidth-3||y>=frame.cutHeight-3)&&rgba[(y*frame.cutWidth+x)*4+3]>64)invalid.push(key+'/'+frame.name+'/edge');
    const b=(frame.customData as {visibleBounds:{height:number;top:number}}).visibleBounds;
    if(Math.abs(b.top+b.height-(ART_BY_KEY[key].frameHeight-2))>1e-7)invalid.push(key+'/'+frame.name+'/feet');
   }
  }
  for(const state of ['attack','hurt','death']){
   const clip=enemyAnimation(6,state),t=s.textures.get(clip.texture);
   sizes.push({state,heights:clip.frames.map((f:number)=>(t.get(f).customData as {visibleBounds:{height:number}}).visibleBounds.height),fits:clip.frames.map((f:number)=>(t.get(f).customData as {sourceFit:number}).sourceFit)});
  }
  const e=new Enemy(s,ENEMY_BY_ID['salt-king'],s.player.x,s.player.y,'audit:salt-king');
  const body=e.body as Phaser.Physics.Arcade.Body,registration:Array<{texture:string;x:number;y:number;w:number;h:number;scale:number}>=[];
  const record=()=>registration.push({texture:e.texture.key,x:body.center.x,y:body.center.y,w:body.width,h:body.height,scale:e.scaleX});
  for(const [dx,dy] of [[0,80],[-80,0],[80,0],[0,-80]]){body.setVelocity(dx,dy);e.playLocomotion('walk');record();e.playLocomotion('idle');record();}
  (e as unknown as {playAction(state:string):void}).playAction('attack');record();
  e.takeDamage(1,s.player.lastDirection);record();e.destroy();
  s.children.list.forEach(o=>(o as Phaser.GameObjects.Sprite).setVisible?.(false));
  const x=s.player.x,y=s.player.y;s.cameras.main.stopFollow().setZoom(1).centerOn(x,y);
  s.add.rectangle(x,y,1800,1800,0x637c69).setDepth(2000000);
  const rows=[...['down','left','right','up'].map(dir=>({name:dir,clip:s.anims.get('enemy:6:walk:'+dir)})),
   ...['attack','hurt','death'].map(state=>({name:state,clip:s.anims.get(enemyAnimation(6,state).key)}))];
  rows.forEach(({name,clip},row)=>{
   s.add.text(x-570,y-600+row*195,name,{fontSize:'14px',color:'#ffffff'}).setDepth(2000002);
   const frames=clip.frames.length===4?[s.anims.get('enemy:6:idle:'+name).frames[0],...clip.frames]:clip.frames;
   frames.forEach((f:Phaser.Animations.AnimationFrame,col:number)=>{
    const sheet=ART_BY_KEY[f.textureKey];s.add.sprite(x-420+col*170,y-540+row*195,f.textureKey,f.textureFrame)
     .setScale(.5*1.45).setOrigin(.5,1-2/sheet.frameHeight).setDepth(2000001);
   });
  });
  const canvas=document.querySelector<HTMLCanvasElement>('.three-world-canvas')!;for(const el of [...document.querySelectorAll('body *')])if(el instanceof HTMLElement&&el!==canvas&&!el.contains(canvas))el.style.visibility='hidden';
  return{invalid,sizes,registration};
 });
 await test.info().attach('salt-king-registration.json',{body:JSON.stringify(audit,null,2),contentType:'application/json'});
 expect(errors).toEqual([]);expect(audit.invalid).toEqual([]);
 for(const s of audit.sizes){expect(s.heights[0]).toBeCloseTo(76,6);expect(new Set(s.fits).size).toBe(1);}
 for(const r of audit.registration)for(const k of ['x','y','w','h','scale'] as const)expect(r[k],r.texture+'/'+k).toBeCloseTo(audit.registration[0][k],6);
 await page.waitForTimeout(400);await page.screenshot({path:'test-results/salt-king-all-poses.png'});
});
