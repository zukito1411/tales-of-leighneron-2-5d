import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';

const output='game-captures';
await mkdir(output,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5174','--strictPort'],{stdio:'inherit',detached:true});
let browser,context,page;
const notes={gameCommit:process.env.GAME_COMMIT,viewport:{width:1280,height:720},device:'Android-style touch browser; not a physical Android device',staging:'Fresh save; camera positions staged through existing development scene access. Ship warning uses the game AttackTelegraph renderer. Terrain field prepared after cross-map camera staging.',captures:[],errors:[]};
try{
  for(let i=0;i<120;i++){
    try{if((await fetch('http://127.0.0.1:5174')).ok)break;}catch{}
    await new Promise(r=>setTimeout(r,500));
  }
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  context=await browser.newContext({viewport:notes.viewport,deviceScaleFactor:1.5,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36'});
  page=await context.newPage();page.setDefaultTimeout(120000);
  page.on('pageerror',e=>{notes.errors.push(e.message);console.log('PAGE ERROR',e.message);});
  let warnings=0;page.on('console',m=>{if(m.type()==='error'&&warnings++<25)console.log('BROWSER',m.text());});
  await page.addInitScript(()=>localStorage.setItem('leighneron:effects-quality','normal'));
  console.log('Opening actual game');
  await page.goto('http://127.0.0.1:5174/?e2e',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Start New Game',exact:true}).click();
  await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'),null,{timeout:360000});
  console.log('World ready');
  await page.evaluate(async()=>{
    const {useGameStore}=await import('/src/store/gameStore.ts');
    const s=window.__mernondnaGame.scene.getScene('world');
    s.cinematicDirector.destroy();
    useGameStore.getState().hydrate({pendingCinematic:null,cinematicQueue:[],cinematic:null,dialogue:null,panel:null,storyFlags:{'scene:highmere-arrival':true}});
    s.dayNight.minuteOfDay=10*60;s.dayNight.update(0,s.player.x,s.player.y);
    // Keep this isolated preview session from dying while scenery streams.
    s.events.on('update',()=>{if(s.player?.active)s.player.hp=s.player.maxHp;});
  });
  const hide=page.getByRole('button',{name:'Hide quest HUD',exact:true});if(await hide.isVisible())await hide.click();
  async function warp(kind){
    await page.evaluate(async kind=>{
      const s=window.__mernondnaGame.scene.getScene('world');
      const {TOWN_BY_ID}=await import('/src/data/towns.ts');
      let p;
      if(kind==='smithy'){const t=TOWN_BY_ID.highmere.world;p={x:t.x+1220,y:t.y+1180};}
      else if(kind==='bridge'){const {HIGHMERE_BRIDGE_POINTS}=await import('/src/data/rivers.ts');const b=HIGHMERE_BRIDGE_POINTS[2];p={x:b.x+180,y:b.y+85};}
      else if(kind==='ship'){const {shipPoint}=await import('/src/data/pirateFlagship.ts');p=shipPoint(410,840);}
      else{const t=TOWN_BY_ID.oakmere.world;p={x:t.x+160,y:t.y+110};}
      // A direct cross-map pose is outside the old height field. Prepare a
      // fresh field for this capture; normal walking/budgets are unchanged.
      const {ElevationField}=await import('/src/game/presentation25d/ElevationField.ts');
      const original=ElevationField.prototype.prepare;
      ElevationField.prototype.prepare=function(...args){this.columns=0;ElevationField.prototype.prepare=original;return original.apply(this,args);};
      s.player.restoreAt(p.x,p.y);s.lastSafe={...p};s.player.resetInput();
      s.cameras.main.setZoom(kind==='ship'?1:1.3).startFollow(s.player,true,1,1);
      s.streamCinematicView(p.x,p.y);
    },kind);
    await page.waitForTimeout(14000);
  }
  async function shot(name,action){
    try{
      console.log('Capturing',name);await action();
      await page.screenshot({path:output+'/'+name+'.png',timeout:90000});notes.captures.push(name);console.log('Saved',name);
    }catch(e){notes.errors.push(name+': '+e.message);console.log('CAPTURE ERROR',name,e.message);}
  }
  // Town and bridge already captured from this exact game commit.
  await shot('04-ship-and-warning-mobile',async()=>{
    await warp('ship');
    notes.ship=await page.evaluate(()=>{const s=window.__mernondnaGame.scene.getScene('world');return s.children.list.filter(o=>o.texture?.key==='pirate_flagship').map(o=>({name:o.name,x:o.x,y:o.y,width:o.width,displayWidth:o.displayWidth,alpha:o.alpha,visible:o.visible,plane:o.getData('presentation25d')?.plane,art:o.getData('presentation25d')?.furniture?.art}));});
    await page.evaluate(async()=>{
      const s=window.__mernondnaGame.scene.getScene('world');
      const {AttackTelegraph}=await import('/src/game/systems/AttackTelegraph.ts');
      s.scene.pause();s.physics.world.pause();
      const warning=new AttackTelegraph(s,'capture-attack-warning',false);
      warning.draw({kind:'cone',x:s.player.x-75,y:s.player.y-90,angle:1.10,radius:180,halfAngle:.65},.62,s.player.y);
    });
    await page.waitForTimeout(1500);
  });
  await shot('05-interior-mobile',async()=>{
    await page.evaluate(async()=>{
      const s=window.__mernondnaGame.scene.getScene('world');s.scene.resume();s.physics.world.resume();
      s.children.getByName('capture-attack-warning')?.destroy();
      const {INTERIOR_ENTRIES}=await import('/src/data/interiors.ts');
      const entry=INTERIOR_ENTRIES.find(e=>e.townId==='oakmere'&&/lodge|inn/i.test(e.name))??INTERIOR_ENTRIES.find(e=>e.townId==='oakmere'&&!e.hall);
      if(!entry)throw new Error('No Oakmere interior');
      s.player.restoreAt(entry.door.x,entry.door.y);s.lastSafe={...entry.door};
      for(const enemy of s.enemySteeringActors())if(Math.hypot(enemy.x-s.player.x,enemy.y-s.player.y)<600)enemy.destroy();
      s.interiors.enter(entry);
      const ready=await s.interiors.loadingPromise;
      if(!ready)throw new Error('Interior did not finish loading');
    });
    await page.waitForTimeout(14000);
    notes.interior=await page.evaluate(()=>{const s=window.__mernondnaGame.scene.getScene('world');return {ready:s.interiors.ready,entry:s.interiors.currentEntry?.id,player:{x:s.player.x,y:s.player.y}};});
  });
  if(!notes.captures.length)throw new Error('No game captures were produced');
}catch(e){notes.errors.push(e.stack??e.message);console.error(e);if(page)await page.screenshot({path:output+'/capture-blocker.png',timeout:15000}).catch(()=>{});process.exitCode=1;}
finally{
  await writeFile(output+'/provenance.json',JSON.stringify(notes,null,2));
  await page?.close().catch(()=>{});await context?.close().catch(()=>{});await browser?.close().catch(()=>{});
  if(server.exitCode===null){try{process.kill(-server.pid,'SIGTERM');}catch{}await Promise.race([new Promise(r=>server.once('close',r)),new Promise(r=>setTimeout(r,5000))]);}
  if(server.exitCode===null){try{process.kill(-server.pid,'SIGKILL');}catch{}}
  console.log('Capture browser/context closed; owned Vite server stopped');
}
