import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const root=process.env.REVIEW_ROOT??process.cwd();
const label=process.env.REVIEW_LABEL??'baseline',output='test-results/windmill-review',report={label,commit:process.env.GAME_COMMIT,device:'Isolated Chromium, 1280x720 touch viewport, software WebGL; not a physical Android FPS measurement',errors:[],captures:[],metrics:{}};
await mkdir(output,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5174','--strictPort'],{cwd:root,stdio:'ignore',detached:true});
let browser,context,page;
try{
 for(let n=0;n<100;n++){try{if((await fetch('http://127.0.0.1:5174')).ok)break;}catch{}await new Promise(r=>setTimeout(r,300));}
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,hasTouch:true,isMobile:true});
 page=await context.newPage();page.setDefaultTimeout(120000);
 page.on('pageerror',e=>{report.errors.push(e.message);console.log('PAGE ERROR',e.message);});
 page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|INVALID|GLSL/i.test(m.text())){report.errors.push(m.text());console.log('GPU ERROR',m.text().slice(0,600));}});
 await page.addInitScript(()=>{localStorage.setItem('leighneron:effects-quality','normal');localStorage.setItem('leighneron:2.5d-frame-times','1');});
 console.log(label,'opening real game');await page.goto('http://127.0.0.1:5174/?e2e');
 await page.evaluate(async()=>{const {ThreePresentation}=await import('/src/game/presentation25d/ThreePresentation.ts');const original=ThreePresentation.prototype.draw;ThreePresentation.prototype.draw=function(...args){window.__windReview=this;return original.apply(this,args);};});
 await page.getByRole('button',{name:'Start New Game',exact:true}).click();
 await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'),null,{timeout:240000});
 // World readiness precedes the opening scene's first DOM commit. Await its
 // actual skip control instead of racing an optional visibility snapshot.
 const skip=page.getByRole('button',{name:/Skip scene/});await skip.waitFor({state:'visible',timeout:90000});
 await page.evaluate(async()=>{const {useGameStore}=await import('/src/store/gameStore.ts');useGameStore.getState().hydrate({pendingCinematic:null,cinematicQueue:[]});});
 await skip.click();
 await page.waitForFunction(()=>!window.__mernondnaGame.scene.getScene('world').cinematicDirector.active);
 await page.evaluate(async()=>{const {useGameStore}=await import('/src/store/gameStore.ts');useGameStore.setState({day:3,minuteOfDay:720});const s=window.__mernondnaGame.scene.getScene('world');s.dayNight.minuteOfDay=720;});
 console.log(label,'world ready');
 const stage=async(kind)=>{
  await page.evaluate(async kind=>{const s=window.__mernondnaGame.scene.getScene('world'),r=window.__windReview;const {WORLD_CONTENT}=await import('/src/data/content.ts');const {TOWN_BY_ID}=await import('/src/data/towns.ts');const t=TOWN_BY_ID.oakmere.world;
   const definition=kind==='mill'?WORLD_CONTENT.find(d=>d.id.includes(':windmill:')&&Math.hypot(d.world.x-t.x,d.world.y-t.y)<4000):WORLD_CONTENT.find(d=>d.id==='shrine:oakmere-road');
   if(!definition)throw new Error('Missing '+kind);window.__reviewObject=definition.id;
   s.restoreOutsidePosition({x:definition.world.x,y:definition.world.y+(kind==='mill'?620:400)});s.player.resetInput();
   const {getCameraSettings,setCameraSettings}=await import('/src/game/presentation25d/cameraSettings.ts');setCameraSettings({...getCameraSettings(),mode:'first-person'});r.orbit.yaw=r.orbit.targetYaw=0;r.orbit.pitch=r.orbit.targetPitch=kind==='mill'?-.12:0;
   s.presentationWeather.kind=s.presentationWeather.target='clear';s.presentationWeather.strength=0;
  },kind);
  await page.waitForFunction(()=>window.__windReview?.orbit.firstPerson);
  await page.evaluate(kind=>{const r=window.__windReview;r.orbit.pitch=r.orbit.targetPitch=kind==='mill'?-.12:0;},kind);
  await page.waitForTimeout(10000);
  await page.waitForFunction(()=>{const s=window.__mernondnaGame.scene.getScene('world');return s.children.getByName(window.__reviewObject)?.active;});
  console.log(label,kind,'staged');
 };
 await stage('statue');await page.screenshot({path:output+'/'+label+'-statue.png'});report.captures.push(label+'-statue.png');
 await stage('mill');await page.screenshot({path:output+'/'+label+'-mill.png'});report.captures.push(label+'-mill.png');
 report.metrics.clear=await page.evaluate(async()=>{const r=window.__windReview,frames=[],start=performance.now();let last=start;const initial={textures:r.textures.stats(),batches:r.batches.size,angle:r.atmosphere.windmillAngle?.value};await new Promise(resolve=>{const frame=now=>{frames.push(now-last);last=now;if(now-start<6000)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});const sorted=frames.toSorted((a,b)=>a-b);return {initial,final:{textures:r.textures.stats(),batches:r.batches.size,angle:r.atmosphere.windmillAngle?.value},frames:frames.length,p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],over50:frames.filter(v=>v>50).length};});
 console.log(label,'metrics',JSON.stringify(report.metrics.clear));
 if(label!=='baseline'){
  const m=report.metrics.clear;if(!Number.isFinite(m.final.angle))throw new Error('Rotor clock unavailable in real game');
  if(m.final.textures.coldCreates!==m.initial.textures.coldCreates)console.warn('Additional scenery loaded during measurement; counts must be interpreted with streaming.');
 }
 if(label!=='baseline'){
  for(const kind of ['wind','storm']){await page.evaluate(kind=>{const s=window.__mernondnaGame.scene.getScene('world');s.presentationWeather.kind=s.presentationWeather.target=kind;s.presentationWeather.strength=1;},kind);await page.waitForTimeout(5000);
   const metrics=await page.evaluate(async()=>{const r=window.__windReview,a=r.atmosphere.windmillAngle.value,start=performance.now();await new Promise(resolve=>setTimeout(resolve,3000));const b=r.atmosphere.windmillAngle.value;const speed=((b-a+Math.PI*2)%(Math.PI*2))/((performance.now()-start)/1000);return {speed,rate:r.windmillMotion.speed,angle:b,textures:r.textures.stats(),batches:r.batches.size};});report.metrics[kind]=metrics;console.log(label,kind,JSON.stringify(metrics));await page.screenshot({path:output+'/'+label+'-'+kind+'.png'});}
  if(report.metrics.storm.rate<=report.metrics.wind.rate)throw new Error('Storm did not accelerate the windmill');
  report.metrics.safety=await page.evaluate(()=>{const r=window.__windReview;return {rotorBatches:[...r.batches.values()].filter(b=>{const a=b.mesh.geometry.getAttribute('cutoutPivot');if(!a)return false;for(let i=0;i<a.count;i++)if(a.getW(i)<0)return true;return false;}).map(b=>({instances:b.mesh.count,vertices:b.mesh.geometry.getAttribute('position').count,version:b.mesh.geometry.getAttribute('position').version,attributes:Object.keys(b.mesh.geometry.attributes),opaque:!b.material.transparent})),programs:r.renderer.info.programs.length};});
  if(!report.metrics.safety.rotorBatches.length)throw new Error('No actual windmill rotor submitted by the renderer');
  if(report.metrics.safety.rotorBatches.some(b=>b.version!==0||!b.opaque))throw new Error('Rotors rebuilt their vertex buffer or lost opaque batching');
 }
 if(report.errors.length)throw new Error('Runtime errors: '+report.errors.join(';'));
}catch(error){report.errors.push(error.stack??String(error));console.error(error);process.exitCode=1;if(page)await page.screenshot({path:output+'/'+label+'-blocker.png',timeout:15000}).catch(()=>{});}
finally{
 await writeFile(output+'/'+label+'-report.json',JSON.stringify(report,null,2));await page?.close().catch(()=>{});await context?.close().catch(()=>{});await browser?.close().catch(()=>{});
 if(server.exitCode===null){try{process.kill(-server.pid,'SIGTERM');}catch{}await Promise.race([new Promise(r=>server.once('close',r)),new Promise(r=>setTimeout(r,2500))]);}
 if(server.exitCode===null){try{process.kill(-server.pid,'SIGKILL');}catch{}}
 console.log(label,'owned browser and server closed');
}
