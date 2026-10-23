import {test,expect} from '@playwright/test';
import type Phaser from 'phaser';
import type {WorldScene} from '../../src/game/scenes/WorldScene';
import type {Enemy} from '../../src/game/entities/Enemy';

test.use({viewport:{width:1280,height:1000}});
test('complete bandit combat poses keep boots, body scale and collision registration',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?e2e');await page.getByRole('button',{name:'Start New Game',exact:true}).click();
 await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'),null,{timeout:60000});
 const audit=await page.evaluate(async()=>{
  const ep='/src/game/entities/Enemy.ts',dp='/src/data/enemies.ts',ap='/src/data/animationPacks.ts';
  const {Enemy:Actor}=await import(ep),{ENEMIES}=await import(dp),{enemyAnimation,animationDuration}=await import(ap);
  const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s.scene.pause();s.physics.world.pause();
  const variants=ENEMIES.filter((def:{spriteFrame:number})=>def.spriteFrame===1);
  const transitions=variants.flatMap((def:{id:string;moveSpeed:number})=>[-1,1].flatMap(direction=>['attack','hurt','death'].map(state=>{
   const e=new Actor(s,def,s.player.x+120,s.player.y,'complete-bandit:'+def.id+':'+state+':'+direction) as Enemy;
   const body=e.body as Phaser.Physics.Arcade.Body;body.setVelocity(direction*def.moveSpeed,0);e.playLocomotion('walk');body.setVelocity(0,0);
   const action=e as unknown as {facing:Phaser.Math.Vector2;playAction(state:string):void;preUpdate(time:number,delta:number):void};action.facing.set(direction,0);
   const before={x:body.center.x,y:body.center.y,w:body.width,h:body.height,scale:e.scaleX};action.playAction(state);
   const clip=enemyAnimation(1,state),frames=new Set<number>(),snapshots:Array<{x:number;y:number;w:number;h:number}>=[];
   for(let elapsed=0;elapsed<animationDuration(clip)+40;elapsed+=20){
    frames.add(Number(e.frame.name));action.preUpdate(s.time.now+elapsed,20);body.updateFromGameObject();
    snapshots.push({x:body.center.x,y:body.center.y,w:body.width,h:body.height});
   }
   const flipped=e.flipX,scale=e.scaleX,texture=e.texture.key;
   e.playLocomotion('idle');const restored={x:body.center.x,y:body.center.y,w:body.width,h:body.height,scale:e.scaleX};
   let deathTexture='';if(state==='death'){
    e.createDeathVisual();const corpse=s.children.getByName('enemy-death:'+e.instanceId) as Phaser.GameObjects.Sprite;
    deathTexture=corpse.texture.key;corpse.destroy();
   }
   e.destroy();return {id:def.id,state,direction,before,restored,snapshots,frames:[...frames],expectedFrames:clip.frames,flipped,scale,texture,deathTexture,frameRate:clip.frameRate};
  })));
  const texture=s.textures.get('enemy_bandit'),canvas=texture.getSourceImage() as HTMLCanvasElement,ctx=canvas.getContext('2d')!;
  // Authored boot centers, not a generic lower-body alpha count: both boots
  // must survive atlas registration in every attack pose.
  const boots=[[[184,480],[397,480]],[[694,475],[901,475]],[[1153,474],[1390,479]],[[173,908],[416,908]],[[654,906],[900,905]],[[1186,910],[1376,910]]];
  const attackBoots=boots.map((points,i)=>{
   const frame=texture.get(i),data=frame.customData as {sourceRegion:number[];sourceFit:number;visibleBounds:{left:number;top:number}};
   const rgba=ctx.getImageData(frame.cutX,frame.cutY,frame.cutWidth,frame.cutHeight).data;
   return points.map(([px,py])=>{
    const x=Math.round((data.visibleBounds.left+(px-data.sourceRegion[0])*data.sourceFit)*2),y=Math.round((data.visibleBounds.top+(py-data.sourceRegion[1])*data.sourceFit)*2);
    let occupied=0;for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++)if(rgba[((y+dy)*frame.cutWidth+x+dx)*4+3]>128)occupied++;
    return occupied;
   });
  });
  const clips=['attack','hurt','death'].map(state=>{
   const clip=s.anims.get('enemy:1:'+state),fits=clip.frames.map(f=>(s.textures.get(f.textureKey).get(f.textureFrame).customData as {sourceFit:number}).sourceFit);
   const heights=clip.frames.map(f=>(s.textures.get(f.textureKey).get(f.textureFrame).customData as {visibleBounds:{height:number}}).visibleBounds.height);
   return {state,fits,heights};
  });return {transitions,attackBoots,clips};
 });
 for(const action of audit.transitions){
  expect(action.texture).toBe('enemy_bandit');expect(action.frames).toEqual(action.expectedFrames);expect(action.flipped).toBe(action.direction<0);
  expect(action.scale).toBe(action.before.scale);expect(action.restored.scale).toBe(action.before.scale);
  for(const sample of [...action.snapshots,action.restored])for(const key of ['x','y','w','h'] as const)expect(sample[key],action.id+'/'+action.state+'/'+key).toBeCloseTo(action.before[key],7);
  if(action.state==='death')expect(action.deathTexture).toBe('enemy_bandit');
  expect(action.frameRate).toBe(action.state==='attack'?12:action.state==='hurt'?10:8);
 }
 for(const boots of audit.attackBoots)for(const pixels of boots)expect(pixels,'rendered boot pixels').toBeGreaterThan(25);
 for(const clip of audit.clips)expect(new Set(clip.fits).size).toBe(1);
 const death=audit.clips.find(c=>c.state==='death')!;expect(death.heights.at(-1)!).toBeLessThan(death.heights[0]*.6);
 await test.info().attach('bandit-combat-audit.json',{body:JSON.stringify(audit,null,2),contentType:'application/json'});
 await page.evaluate(()=>{
  const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s.children.list.forEach(o=>(o as Phaser.GameObjects.Sprite).setVisible?.(false));
  const cx=s.player.x,cy=s.player.y;s.cameras.main.stopFollow().setZoom(1).centerOn(cx,cy);
  s.add.rectangle(cx,cy,1500,1100,0x202b25).setDepth(2000000);
  ['attack','hurt','death'].forEach((state,row)=>s.anims.get('enemy:1:'+state).frames.forEach((frame,col)=>{
   const x=cx-500+col*200,y=cy-260+row*240;
   s.add.sprite(x,y,frame.textureKey,frame.textureFrame).setScale(.58).setOrigin(.5,142/144).setDepth(2000001).setName('bandit-combat-preview');
   s.add.text(x,y+8,state+' '+(col+1),{fontSize:'12px',color:'#ffffff'}).setOrigin(.5,0).setDepth(2000002);
  }));
  const canvas=document.querySelector<HTMLCanvasElement>('.three-world-canvas')!;
  for(const element of [...document.querySelectorAll('body *')])if(element instanceof HTMLElement&&element!==canvas&&!element.contains(canvas))element.style.visibility='hidden';
 });
 await page.waitForTimeout(100);await page.screenshot({path:'test-results/bandit-combat-rendered.png'});
 await page.evaluate(()=>{
  const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
  s.children.list.filter(o=>o.name==='bandit-combat-preview').forEach(o=>(o as Phaser.GameObjects.Sprite).setFlipX(true));
 });
 await page.waitForTimeout(100);await page.screenshot({path:'test-results/bandit-combat-left-rendered.png'});expect(errors).toEqual([]);
});
