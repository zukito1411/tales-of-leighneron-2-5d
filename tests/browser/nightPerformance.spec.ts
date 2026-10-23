import {test,expect} from '@playwright/test';
import type Phaser from 'phaser';
import type {WorldScene} from '../../src/game/scenes/WorldScene';
import type {DayNightSystem} from '../../src/game/systems/DayNightSystem';
import type {FogArt} from '../../src/game/systems/FogArt';
import type {GroundShadowSystem} from '../../src/game/systems/GroundShadowSystem';

for(const mobile of [false,true])test.describe(mobile?'Touch nighttime':'Desktop nighttime',()=>{
 test.use({viewport:mobile?{width:844,height:390}:{width:1280,height:720},hasTouch:mobile,isMobile:mobile,deviceScaleFactor:mobile?2:1});
 test('lighting matches the original gradients without recurring canvas uploads',async({page})=>{
  test.setTimeout(120000);
  await page.addInitScript(()=>localStorage.setItem('leighneron:graphics-effects:v1',JSON.stringify({nightMist:true})));
  await page.goto('/?e2e');await page.getByRole('button',{name:'Start New Game',exact:true}).click();
  await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'));
  const result=await page.evaluate(async()=>{
   const tp='/src/data/towns.ts',rp='/src/game/systems/renderSizing.ts';
   const {TOWN_BY_ID}=await import(tp),{overlayViewport}=await import(rp);
   const projection='/src/game/presentation25d/plane.ts';
   const {presentationAttachment}=await import(projection);
   const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
   s.scene.pause();s.physics.world.pause();
   type Light={actor:Phaser.GameObjects.Sprite;x:number;y:number;radius:number;fire:boolean;phase:number;glow:Phaser.GameObjects.Image};
   const dn=(s as unknown as {dayNight:DayNightSystem}).dayNight as unknown as {
    minuteOfDay:number;elapsed:number;lightweight:boolean;maskDirty:boolean;maskWorldOrigin:{x:number;y:number};
    texture:Phaser.Textures.DynamicTexture;overlay:Phaser.GameObjects.Image;lights:Set<Light>;update(delta:number,x:number,y:number):void;
   };
   const cases=[];
   for(const town of ['highmere','elarion']){
    const {x,y}=TOWN_BY_ID[town].world;s.player.restoreAt(x,y);
    const camera=s.cameras.main;camera.stopFollow().centerOn(x,y);camera.preRender();s.streamCinematicView(x,y);
    for(const [minute,elapsed] of [[1140,12345],[1320,12345],[1320,12465]]){
     dn.minuteOfDay=minute;dn.elapsed=elapsed;dn.maskDirty=true;dn.update(0,x,y);
     const image=await new Promise<HTMLImageElement>(resolve=>dn.texture.snapshot(image=>resolve(image as HTMLImageElement)));
     const w=dn.texture.width,h=dn.texture.height,actual=document.createElement('canvas'),reference=document.createElement('canvas');
     actual.width=reference.width=w;actual.height=reference.height=h;
     const act=actual.getContext('2d')!,ctx=reference.getContext('2d')!;act.drawImage(image,0,0);
     const night=minute>=1200?1:.5,res=dn.lightweight?.65:1,z=overlayViewport(s).zoom*res,pad=Math.round(96*res),origin=dn.maskWorldOrigin;
     ctx.fillStyle=`rgba(2,6,17,${night*.84})`;ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='destination-out';
     let count=0;
     for(const node of dn.lights){
      const point=presentationAttachment(s,node.actor,node.actor.x+node.x,node.actor.y+node.y,{x:0,y:0});
      const px=(point.x-origin.x)*z+pad,py=(point.y-origin.y)*z+pad,r=node.radius*z;
      if(px+r<0||py+r<0||px-r>w||py-r>h)continue;
      if(dn.lightweight&&count>=18)break;count++;
      const flicker=node.fire?.92+Math.sin(dn.elapsed*.013+node.phase)*.06:1;
      const gradient=ctx.createRadialGradient(px,py,0,px,py,r);
      gradient.addColorStop(0,`rgba(0,0,0,${.88*flicker})`);gradient.addColorStop(.3,'rgba(0,0,0,.65)');gradient.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=gradient;ctx.fillRect(px-r,py-r,r*2,r*2);
     }
     const a=act.getImageData(0,0,w,h).data,b=ctx.getImageData(0,0,w,h).data;
     let total=0,max=0;for(let i=3;i<a.length;i+=4){const error=Math.abs(Math.round(a[i]*dn.overlay.alpha)-b[i]);total+=error;max=Math.max(max,error);}
     cases.push({town,minute,lights:count,meanAlphaError:total/(w*h),maxAlphaError:max});
    }
   }
   // Ordinary windows do not change when the clock advances. Camera movement
   // inside overscan translates the existing holes rather than repainting.
   const originals=[...dn.lights].map(node=>({node,fire:node.fire}));originals.forEach(({node})=>node.fire=false);
   dn.maskDirty=true;dn.update(0,s.player.x,s.player.y);
   let paints=0,uploads=0,sortRequests=0;
   const erase=dn.texture.erase,source=dn.texture.source[0];
   const upload=source.update,sort=s.children.queueDepthSort;
   dn.texture.erase=function(...args:Parameters<typeof erase>){paints++;return erase.apply(this,args);};
   source.update=function(){uploads++;return upload.call(this);};
   s.children.queueDepthSort=function(){sortRequests++;return sort.call(this);};
   for(let i=0;i<240;i++)dn.update(1000/60,s.player.x,s.player.y);
   const stationaryPaints=paints;const origin={...dn.maskWorldOrigin},camera=s.cameras.main;
   camera.scrollX+=16;camera.preRender();dn.update(16,s.player.x,s.player.y);
   const reusedOrigin=origin.x===dn.maskWorldOrigin.x;
   const withinBufferPaints=paints-stationaryPaints;
   camera.scrollX+=400;camera.preRender();dn.update(16,s.player.x,s.player.y);
   const edgePaints=paints-stationaryPaints-withinBufferPaints;
   const edgeOriginChanged=dn.maskWorldOrigin.x!==origin.x;
   dn.texture.erase=erase;source.update=upload;s.children.queueDepthSort=sort;
   originals.forEach(({node,fire})=>node.fire=fire);
   dn.maskDirty=true;dn.update(0,s.player.x,s.player.y);
   // Contact-only shadows remain valid throughout night even as the weather
   // changes; moving actor poses and scenery streaming still invalidate them.
   const shadows=(s as unknown as {groundShadows:GroundShadowSystem}).groundShadows;
   shadows.update(100,22,0);let shadowUploads=0;const restores:Array<()=>void>=[];
   for(const key of ['ground-shadows','ground-shadows-dynamic']){
    const t=s.textures.get(key) as Phaser.Textures.CanvasTexture,refresh=t.refresh;
    t.refresh=function(){shadowUploads++;return refresh.call(this);};restores.push(()=>t.refresh=refresh);
   }
   for(let i=0;i<240;i++)shadows.update(1000/60,22+i/240, i/240);restores.forEach(restore=>restore());
   const qp='/src/game/systems/effectsQuality.ts',gp='/src/game/systems/graphicsEffects.ts';
   const {setEffectsQuality,getEffectsQuality}=await import(qp),{setGraphicEffect}=await import(gp);
   const quality=getEffectsQuality();const sizes=[];
   for(const next of ['low','normal'] as const){
    setEffectsQuality(next);dn.update(0,s.player.x,s.player.y);
    const viewport=overlayViewport(s),res=next==='low'?.65:1,padding=Math.round(96*res);
    sizes.push({actual:[dn.texture.width,dn.texture.height],expected:[Math.round(viewport.width*res)+padding*2,Math.round(viewport.height*res)+padding*2]});
   }
   setEffectsQuality(quality);
   setGraphicEffect('nightDarkness',false);dn.update(0,s.player.x,s.player.y);const darknessDisabled=!dn.overlay.visible;
   setGraphicEffect('nightDarkness',true);dn.update(0,s.player.x,s.player.y);const darknessRestored=dn.overlay.visible;
   return{cases,stationaryPaints,withinBufferPaints,reusedOrigin,edgePaints,edgeOriginChanged,uploads,sortRequests,shadowUploads,sizes,darknessDisabled,darknessRestored};
  });
  console.log('Night render work',mobile,JSON.stringify(result));
  await test.info().attach('night-render-work.json',{body:JSON.stringify(result,null,2),contentType:'application/json'});
  for(const sample of result.cases){expect(sample.lights).toBeGreaterThan(0);expect(sample.meanAlphaError).toBeLessThan(1);expect(sample.maxAlphaError).toBeLessThanOrEqual(6);}
  expect(result.stationaryPaints).toBe(0);expect(result.withinBufferPaints).toBe(0);expect(result.reusedOrigin).toBe(true);
  expect(result.edgePaints).toBe(1);expect(result.edgeOriginChanged).toBe(true);expect(result.uploads).toBe(0);
  expect(result.sortRequests).toBe(0);expect(result.shadowUploads).toBe(0);
  expect(result.darknessDisabled).toBe(true);expect(result.darknessRestored).toBe(true);
  for(const size of result.sizes)expect(size.actual).toEqual(size.expected);
  await page.screenshot({path:`test-results/night-${mobile?'touch':'desktop'}.png`});
 });
});

test('afternoon weather tint keeps its color without full-screen uploads',async({page})=>{
 test.setTimeout(120000);await page.goto('/?e2e');await page.getByRole('button',{name:'Start New Game',exact:true}).click();
 await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'));
 const result=await page.evaluate(async()=>{
  const sp='/src/store/gameStore.ts';const {useGameStore}=await import(sp);
  const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s.scene.pause();s.physics.world.pause();
  const weather=(s as unknown as {weather:{update(delta:number,x:number,y:number):void;kind:string;target:string;strength:number;
   ambientMist:number;drawMs:number;texture:Phaser.Textures.CanvasTexture;overlay:Phaser.GameObjects.Image;tint:Phaser.GameObjects.Image}}).weather;
  useGameStore.getState().hydrate({minuteOfDay:1050});weather.update(0,s.player.x,s.player.y);
  s.children.list.forEach(o=>(o as Phaser.GameObjects.Image).setVisible?.(false));
  const camera=s.cameras.main,z=camera.zoom,w=s.scale.width,h=s.scale.height;
  s.add.rectangle(w/2*(1-1/z),h/2*(1-1/z),w/z,h/z,0xffffff).setOrigin(0).setScrollFactor(0).setDepth(999_980);
  weather.kind=weather.target='cloudy';weather.strength=.6;weather.ambientMist=0;weather.drawMs=1000;
  const refresh=weather.texture.refresh;let uploads=0;weather.texture.refresh=function(){uploads++;return refresh.call(this);};
  for(let i=0;i<240;i++)weather.update(1000/60,s.player.x,s.player.y);
  const tintVisible=weather.tint.visible,animatedLayerVisible=weather.overlay.visible,alpha=weather.tint.alpha;
  const probe='/tests/browser/presentationProbe.ts';const {presentedPixel}=await import(probe);
  const color=await presentedPixel(s.game,Math.floor(w/2),Math.floor(h/2));
  weather.kind=weather.target='clear';weather.strength=0;weather.drawMs=1000;weather.update(0,s.player.x,s.player.y);
  weather.texture.refresh=refresh;
  return{uploads,tintVisible,animatedLayerVisible,alpha,rgb:[color.red,color.green,color.blue],clear:!weather.tint.visible&&!weather.overlay.visible};
 });
 expect(result.uploads).toBe(0);expect(result.tintVisible).toBe(true);expect(result.animatedLayerVisible).toBe(false);
 // The original six-second weather ramp reaches full overcast during the
 // sampled updates; the GPU tint follows it without uploading any canvas.
 expect(result.alpha).toBeCloseTo(.1,5);expect(result.clear).toBe(true);
 for(const [i,channel] of [42,58,72].entries())expect(Math.abs(result.rgb[i]-Math.round(255*(1-result.alpha)+channel*result.alpha))).toBeLessThanOrEqual(1);
});

test('fog culling preserves every visible pixel and drifting layer',async({page})=>{
 test.setTimeout(120000);await page.goto('/?e2e');await page.getByRole('button',{name:'Start New Game',exact:true}).click();
 await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'));
 const metrics=await page.evaluate(()=>{
  const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s.scene.pause();
  const fog=(s as unknown as {weather:{fogArt:FogArt}}).weather.fogArt;
  const results=[];
  for(const [width,height,time,x,y] of [[1280,720,1200,5020,-930],[844,390,42000,-151,711],[400,720,195000,291,113]]){
   const a=document.createElement('canvas'),b=document.createElement('canvas');a.width=b.width=width;a.height=b.height=height;
   const ctx=a.getContext('2d')!,reference=b.getContext('2d')!;let culledDraws=0,originalDraws=0;
   const draw=ctx.drawImage;ctx.drawImage=((...args:unknown[])=>{culledDraws++;(draw as (...args:unknown[])=>void).apply(ctx,args);}) as typeof draw;
   fog.draw(ctx,width,height,x,y,time,.1,[157,170,191],1);
   const tint=(fog as unknown as {tint:HTMLCanvasElement}).tint;
   for(let layer=0;layer<3;layer++){
    const size=320+layer*200,stepX=size*.7,stepY=size*.46,parallax=.22+layer*.15;
    const ox=((x*parallax-time*(.006+layer*.003))%stepX+stepX)%stepX,oy=((y*parallax+time*.0015)%stepY+stepY)%stepY;
    reference.globalAlpha=.1*(.17-layer*.025);
    for(let row=-1;row<Math.ceil(height/stepY)+2;row++)for(let col=-1;col<Math.ceil(width/stepX)+2;col++){
     originalDraws++;reference.drawImage(tint,col*stepX-ox+(row%2)*stepX*.28,row*stepY-oy,size,size*2/3);
    }
   }
   const actual=ctx.getImageData(0,0,width,height).data,expected=reference.getImageData(0,0,width,height).data;let mismatches=0;
   for(let i=0;i<actual.length;i++)if(actual[i]!==expected[i])mismatches++;
   results.push({width,height,mismatches,culledDraws,originalDraws});
  }return results;
 });
 console.log('Fog work',JSON.stringify(metrics));
 for(const sample of metrics){expect(sample.mismatches).toBe(0);expect(sample.culledDraws).toBeLessThan(sample.originalDraws*.6);}
});
