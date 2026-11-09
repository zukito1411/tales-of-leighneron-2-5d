import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import type {ThreePresentation} from '../../src/game/presentation25d/ThreePresentation';
import type {WorldScene} from '../../src/game/scenes/WorldScene';

declare global {interface Window {
  __submissionRenderer?:ThreePresentation;
  __submissionProbe?:{fast:boolean;measure:boolean;cpu:number;calls:number;frames:number;samples:number[]};
}}
test.use({launchOptions:{args:['--use-angle=default']},trace:'off'});
test('cached submission matches full collection and preserves texture invalidation',async({browser})=>{
  // This is a deterministic instance-buffer equality check, not an FPS
  // benchmark. A few frozen frames in each ABBA block suffice to prove exact
  // ordering, while software GL on CI can take seconds per rendered frame.
  test.setTimeout(240000);
  const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto('/?e2e');
    await page.evaluate(async()=>{
      const path='/src/game/presentation25d/ThreePresentation.ts',batchPath='/src/game/presentation25d/SpriteBatch.ts';
      const {ThreePresentation}=await import(/* @vite-ignore */ path) as typeof import('../../src/game/presentation25d/ThreePresentation');
      const {SpriteBatch}=await import(/* @vite-ignore */ batchPath) as typeof import('../../src/game/presentation25d/SpriteBatch');
      const probe=window.__submissionProbe={fast:true,measure:false,cpu:0,calls:0,frames:0,samples:[] as number[]};
      const cached=ThreePresentation.prototype['collectCached'],collect=ThreePresentation.prototype['collect'],draw=ThreePresentation.prototype['draw'];
      const addStatic=SpriteBatch.prototype.addStatic;
      SpriteBatch.prototype.addStatic=function(matrix,uv,colors,alpha,object,rect,frame,repeat,token){
        return probe.fast?addStatic.call(this,matrix,uv,colors,alpha,object,rect,frame,repeat,token):this.add(matrix,uv,colors,alpha,object,rect,frame,repeat);
      };
      ThreePresentation.prototype['collectCached']=function(...args){return probe.fast?cached.apply(this,args):false;};
      ThreePresentation.prototype['collect']=function(...args){
        if(!probe.measure)return collect.apply(this,args);
        const start=performance.now();try{return collect.apply(this,args);}finally{probe.cpu+=performance.now()-start;probe.calls++;}
      };
      ThreePresentation.prototype['draw']=function(this:ThreePresentation,...args){
        window.__submissionRenderer=this;
        const start=probe.cpu;try{return draw.apply(this,args);}finally{if(probe.measure){probe.frames++;probe.samples.push(probe.cpu-start);}}
      };
    });
    await page.getByRole('button',{name:'Start New Game',exact:true}).click();
    // This test measures instanced world rendering, not the cinematic return
    // streaming sequence. New saves queue the long roadborn-opening intro;
    // prevent only that test-only pending scene before BootScene finishes.
    // Real players and cinematic regression tests still run the original intro.
    await page.evaluate(async()=>{
      const storePath='/src/store/gameStore.ts';
      const {useGameStore}=await import(/* @vite-ignore */ storePath) as typeof import('../../src/store/gameStore');
      useGameStore.getState().hydrate({pendingCinematic:null,cinematicQueue:[]});
    });
    await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'),null,{timeout:180000});
    const cinematicActive=await page.evaluate(()=>{
      const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
      return s['cinematicDirector'].active;
    });
    expect(cinematicActive,'renderer parity fixture must be outside story cinematics').toBe(false);
    await page.waitForTimeout(1000);
    await page.evaluate(()=>{
      const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
      const renderer=window.__submissionRenderer!;
      s.player.resetInput();
      s.scene.pause();
      // Phaser doesn't render paused scenes. Drive the *actual Three renderer*
      // with a fixed scene snapshot on rAF while preserving the frozen world,
      // otherwise the frame-count parity test waits forever in headless CI.
      const pump=()=>{
        if(!window.__submissionProbe)return;
        renderer['draw'](s,s.children.list,s.cameras.main);
        requestAnimationFrame(pump);
      };
      requestAnimationFrame(pump);
    });
    await page.waitForTimeout(500);
    for(const fast of [false,true,false,true]){
      await page.evaluate(fast=>{window.__submissionProbe!.fast=fast;},fast);
      await page.waitForTimeout(300);
    }
    const samples=[];
    for(const fast of [false,true,true,false]){
      await page.evaluate(fast=>{const p=window.__submissionProbe!;p.fast=fast;p.measure=false;},fast);
      await page.waitForTimeout(80);
      await page.evaluate(()=>{const p=window.__submissionProbe!;p.cpu=0;p.calls=0;p.frames=0;p.samples=[];p.measure=true;});
      await page.waitForFunction(()=>window.__submissionProbe!.frames>=16);
      samples.push(await page.evaluate(()=>{
        const p=window.__submissionProbe!;p.measure=false;
        const renderer=window.__submissionRenderer!;let hash=2166136261,instances=0;
        for(const batch of renderer['batches'].values()){
          if(!batch.mesh.visible)continue;
          instances+=batch.mesh.count;
          const attributes=[batch.mesh.instanceMatrix,...['atlasRect','instanceTint','instanceTintTR','instanceTintBL','instanceTintBR','tileRepeat'].map(key=>batch.mesh.geometry.getAttribute(key))];
          for(const attribute of attributes){
            const values=attribute.array;for(let i=0;i<batch.mesh.count*attribute.itemSize;i++)hash=Math.imul(hash^(Math.round(values[i]*10000)|0),16777619);
          }
        }
        const sorted=p.samples.slice().sort((a,b)=>a-b);
        return {fast:p.fast,cpuPerFrame:p.cpu/p.frames,calls:p.calls,frames:p.frames,median:sorted[Math.floor(sorted.length/2)],hash:hash>>>0,instances,dispatchHits:renderer['cachedDispatchHits']};
      }));
    }
    // The benchmark blocks above occur on different rAF ticks and can include
    // time-dependent presentation data even when WorldScene is paused.
    // Compare cached/full submission on the SAME game-loop tick instead:
    // immediate alternating ABBA draws prevent that drift from corrupting
    // exact instance-buffer parity checks. All normal actors stay untouched.
    const parity=await page.evaluate(()=>{
      const probe=window.__submissionProbe!,renderer=window.__submissionRenderer!;
      const world=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
      const snapshot=(fast:boolean)=>{
        probe.fast=fast;probe.measure=false;
        renderer['draw'](world,world.children.list,world.cameras.main);
        let hash=2166136261,instances=0;
        // Include GPU projected and contact shadows in the exact instance
        // parity assertion, not only the main world sprite batches.
        for(const batches of [renderer['batches'],renderer['gpuShadows']['batches']]){
          for(const batch of batches.values()){
            if(!batch.mesh.visible)continue;
            instances+=batch.mesh.count;
            const attributes=[batch.mesh.instanceMatrix,...['atlasRect','instanceTint','instanceTintTR','instanceTintBL','instanceTintBR','tileRepeat'].map(key=>batch.mesh.geometry.getAttribute(key))];
            for(const attribute of attributes){
              const values=attribute.array;
              for(let i=0;i<batch.mesh.count*attribute.itemSize;i++)
                hash=Math.imul(hash^(Math.round(values[i]*10000)|0),16777619);
            }
          }
        }
        return {fast,hash:hash>>>0,instances};
      };
      return [snapshot(false),snapshot(true),snapshot(true),snapshot(false)];
    });
    expect(new Set(parity.map(s=>s.hash)).size,JSON.stringify(parity)).toBe(1);
    expect(new Set(parity.map(s=>s.instances)).size,JSON.stringify(parity)).toBe(1);
    expect(samples[1].dispatchHits).toBeGreaterThan(samples[0].dispatchHits);
    const textures=await page.evaluate(async()=>{
      const path='/src/game/presentation25d/TextureCache.ts';const {TextureCache}=await import(/* @vite-ignore */ path) as typeof import('../../src/game/presentation25d/TextureCache');
      const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene,cache=new TextureCache();
      const canvas=s.textures.createCanvas('review-texture-invalidation',8,8)!,source=canvas.source[0],originalUpdate=source.update;
      const a=cache.get(source,1),bytes=cache['bytes'],again=cache.get(source,1),version=a.version;
      canvas.refresh();const dirty=cache.get(source,1)===a&&a.version>version;
      canvas.setSize(16,12);const resized=cache.get(source,1)===a&&cache['bytes']>bytes;
      const label=s.add.text(0,0,'A'),textSource=label.frame.source,originalTextUpdate=label.updateText;
      const text=cache.get(textSource,1,label),textVersion=text.version;label.setText('Longer label');cache.get(textSource,1,label);
      const changedText=text.version>textVersion;
      cache.invalidate();const invalidated=!cache.ready(source);cache.destroy();
      const restored=source.update===originalUpdate&&label.updateText===originalTextUpdate;
      s.textures.remove(canvas.key);label.destroy();
      return {same:a===again,dirty,resized,changedText,invalidated,restored};
    });
    expect(textures).toEqual({same:true,dirty:true,resized:true,changedText:true,invalidated:true,restored:true});
    const activeTextureLease=await page.evaluate(async()=>{
      const path='/src/game/presentation25d/TextureCache.ts';
      const {TextureCache}=await import(/* @vite-ignore */ path) as typeof import('../../src/game/presentation25d/TextureCache');
      const scene=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
      const cache=new TextureCache(),canvas=scene.textures.createCanvas('review-active-texture-lease',32,32)!;
      const source=canvas.source[0],time=1000,pressureBytes=420*1048576;
      try{
        cache.beginFrame(time);
        const original=cache.get(source,1);
        // Simulate the 395-420MiB emergency condition WITHOUT allocating a
        // 420MiB test texture; verify the real cache implementation and hooks.
        cache['bytes']=pressureBytes;cache['prefetchPaused']=true;
        cache.beginFrame(time+1300);
        cache.prefetch(source,2);
        const lease=cache['entries'].get(source)?.leaseUntilMs??0;
        cache.beginFrame(time+1600);
        cache.prune(3);
        const kept=cache['entries'].has(source)&&cache.get(source,3)===original;
        // Stop warming and let the authored source become genuinely cold.
        cache.beginFrame(time+2600);
        cache.prune(4);
        const evicted=!cache['entries'].has(source);
        const recreated=cache.get(source,5)!==original;
        const repeatUpload=cache.stats().pressureRecreates===1;
        return {lease:lease>time+1300,kept,evicted,recreated,repeatUpload};
      }finally{
        cache.destroy();scene.textures.remove(canvas.key);
      }
    });
    expect(activeTextureLease).toEqual({lease:true,kept:true,evicted:true,recreated:true,repeatUpload:true});
    const slots=await page.evaluate(async()=>{
      const path='/src/game/presentation25d/SpriteBatch.ts',three='/node_modules/.vite/deps/three.js';
      const {SpriteBatch}=await import(/* @vite-ignore */ path) as typeof import('../../src/game/presentation25d/SpriteBatch');
      const {DataTexture,Scene,Matrix4}=await import(/* @vite-ignore */ three) as typeof import('three');
      const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene,texture=new DataTexture(new Uint8Array([255,255,255,255]),1,1);
      const batch=new SpriteBatch(new Scene(),texture,false,false,0),a=s.make.image({key:'__WHITE',add:false}),b=s.make.image({key:'__WHITE',add:false});
      const ta={},tb={},ma=new Matrix4().makeTranslation(10,0,0),mb=new Matrix4().makeTranslation(20,0,0),uv=[0,0,1,1],colors=[0xffffff,0xffffff,0xffffff,0xffffff],rect={left:0,top:0,width:1,height:1};
      const add=(object:typeof a,alpha=1)=>batch.addStatic(object===a?ma:mb,uv,colors,alpha,object,rect,1,undefined,object===a?ta:tb);
      try{
        window.__submissionProbe!.fast=true;
        batch.begin();add(a);add(b);batch.finish();const version=batch.mesh.instanceMatrix.version;
        batch.begin();add(a);add(b);batch.finish();const unchanged=batch.mesh.instanceMatrix.version===version;
        batch.begin();add(b);add(a);batch.finish();const reordered=batch.mesh.instanceMatrix.array[12]===20&&batch.mesh.instanceMatrix.array[28]===10&&batch.objects[0].object===b;
        batch.begin();add(b,.4);add(a);batch.finish();const faded=Math.abs(batch.mesh.geometry.getAttribute('instanceTint').getW(0)-.4)<1e-6;
        batch.begin();add(a);batch.finish();const released=batch.objects.length===1&&batch['staticTokens'][1]===undefined&&batch['slots'][1].object===undefined;
        batch.begin();batch.add(mb,uv,colors,1,a,rect,2);batch.finish();
        batch.begin();add(a);batch.finish();const dynamicReset=batch.mesh.instanceMatrix.array[12]===10;
        // A renderer may leave an invisible retained batch idle for many frames.
        // The next submission must reset slots and GPU attribute ranges itself.
        batch.begin();batch.finish();
        const dormant=!batch.mesh.visible&&batch.mesh.count===0&&batch.objects.length===0;
        add(b);batch.finish();
        const reactivated=dormant&&batch.mesh.visible&&batch.mesh.count===1
          &&batch.mesh.instanceMatrix.array[12]===20&&batch.objects[0].object===b;
        batch.begin();batch.finish();
        add(a);add(b);batch.finish();
        const multipleAfterIdle=batch.mesh.count===2&&batch.objects[0].object===a&&batch.objects[1].object===b
          &&batch.mesh.instanceMatrix.array[12]===10&&batch.mesh.instanceMatrix.array[28]===20;
        return {unchanged,reordered,faded,released,dynamicReset,reactivated,multipleAfterIdle};
      }finally{batch.destroy();texture.dispose();a.destroy();b.destroy();}
    });
    expect(slots).toEqual({unchanged:true,reordered:true,faded:true,released:true,dynamicReset:true,reactivated:true,multipleAfterIdle:true});
    const adaptive=await page.evaluate(async()=>{
      const path='/src/game/presentation25d/RenderBudget.ts';const {RenderBudget}=await import(/* @vite-ignore */ path) as typeof import('../../src/game/presentation25d/RenderBudget');
      const gpu=new RenderBudget(),cpu=new RenderBudget(),paused=new RenderBudget();
      try{
        let overloaded=1,cpuOnly=1,inactive=1;
        for(let frame=0;frame<600;frame++){
          overloaded=gpu.scale(1280,800,1,16.7,true,true,32);
          cpuOnly=cpu.scale(1280,800,1,80,true,true,null);
          inactive=paused.scale(1280,800,1,16.7,true,false,32);
        }
        const held=gpu.scale(1280,800,1,16.7,true,true,2);
        const disabled=gpu.scale(1280,800,1,16.7,false,true,32);
        return {overloaded,cpuOnly,inactive,held,disabled};
      }finally{gpu.destroy();cpu.destroy();paused.destroy();}
    });
    expect(adaptive.overloaded).toBe(.85);expect(adaptive.held).toBe(.85);
    expect(adaptive.cpuOnly).toBe(1);expect(adaptive.inactive).toBe(1);expect(adaptive.disabled).toBe(1);
    await page.evaluate(()=>{window.__submissionProbe!.fast=true;});
    await page.screenshot({path:'test-results/cached-static-submission.png'});
    console.log(JSON.stringify({samples,textures,slots,adaptive}));
    await mkdir('.asset-review',{recursive:true});
    await writeFile('.asset-review/static-submission-review.json',JSON.stringify({samples,textures,slots,adaptive},null,2));
    expect(errors).toEqual([]);
  }finally{await context.close();}
});
