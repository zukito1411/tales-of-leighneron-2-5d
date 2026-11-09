import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import type {ThreePresentation} from '../../src/game/presentation25d/ThreePresentation';
import type {WorldScene} from '../../src/game/scenes/WorldScene';

declare global {interface Window {
  __submissionRenderer?:ThreePresentation;
  __submissionProbe?:{fast:boolean;measure:boolean;cpu:number;calls:number;frames:number;samples:number[]};
}}
test.use({launchOptions:{args:['--use-angle=default']},trace:'off'});
test('cached submission matches full collection and preserves texture invalidation',async({browser})=>{
  test.setTimeout(180000);
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
    await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'),null,{timeout:120000});
    await page.getByRole('button',{name:/Skip scene/}).click();
    await page.waitForFunction(()=>!(window.__mernondnaGame!.scene.getScene('world') as WorldScene)['cinematicDirector'].active);
    await page.waitForTimeout(2000);
    await page.evaluate(()=>{const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s.player.resetInput();s.scene.pause();});
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
      await page.waitForFunction(()=>window.__submissionProbe!.frames>=240);
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
    // Same frozen shot and actual instance buffers, alternating ABBA to avoid
    // treating startup/JIT drift as evidence of a rendering improvement.
    expect(new Set(samples.map(s=>s.hash)).size).toBe(1);
    expect(new Set(samples.map(s=>s.instances)).size).toBe(1);
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
    await writeFile('.asset-review/static-submission-review.json',JSON.stringify({samples,textures,slots,adaptive},null,2));
    expect(errors).toEqual([]);
  }finally{await context.close();}
});
