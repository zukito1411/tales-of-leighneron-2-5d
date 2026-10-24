import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';

const output='game-captures';
await mkdir(output,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5174','--strictPort'],{stdio:'inherit',detached:true});
let browser,context,page;
const notes={gameCommit:process.env.GAME_COMMIT,viewport:{width:1280,height:720},device:'Android-style touch browser; not a physical Android device',staging:'Fresh save; camera positions staged through existing development scene access. Scenery camera staged for model review; cutaway disabled in this preview. Terrain prepared after cross-map staging.',captures:[],errors:[]};
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
  console.log('World ready; source detail atlas and authored architecture revision 3');
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
  await page.evaluate(()=>{
    const s=window.__mernondnaGame.scene.getScene('world');
    Object.defineProperty(s,'presentationFocus',{configurable:true,get:()=>window.captureFocus??s.player});
    Object.defineProperty(s,'presentationControlsEnabled',{configurable:true,get:()=>false});
  });
  async function capture(name,townId,frame,zoom){
    try{
      console.log('Preparing',name);
      const meta=await page.evaluate(async({townId,frame,zoom})=>{
        const s=window.__mernondnaGame.scene.getScene('world');
        const {TOWN_BY_ID}=await import('/src/data/towns.ts');
        const {SETTLEMENT_BY_ID}=await import('/src/data/settlements.ts');
        const {ElevationField}=await import('/src/game/presentation25d/ElevationField.ts');
        const {presentationView}=await import('/src/game/presentation25d/plane.ts');
        presentationView(s).camera.fov=frame===8||frame===9?68:38;
        const t=TOWN_BY_ID[townId];let p={x:t.world.x+160,y:t.world.y+110},focus={...p},lot;
        if(frame!==null){
          lot=SETTLEMENT_BY_ID[townId].buildings.find(b=>!b.omitted&&b.appearance?.frame===frame);
          if(!lot)throw new Error('No requested building');
          const x=t.world.x+lot.x,y=t.world.y+lot.y;
          p={x:x+110,y:y+150};focus={x,y:y-(frame===8||frame===9?240:65)};
        }
        const original=ElevationField.prototype.prepare;
        ElevationField.prototype.prepare=function(...args){this.columns=0;ElevationField.prototype.prepare=original;return original.apply(this,args);};
        s.player.restoreAt(p.x,p.y);s.lastSafe={...p};s.player.resetInput();window.captureFocus=focus;
        s.cameras.main.stopFollow().setZoom(zoom).centerOn(focus.x,focus.y);s.streamCinematicView(focus.x,focus.y);
        return {townId,frame,zoom,lot:lot?.label,player:p,focus};
      },{townId,frame,zoom});
      await page.waitForTimeout(16000);
      await page.screenshot({path:output+'/'+name+'.png',timeout:60000});
      notes.captures.push({name,...meta});console.log('Saved',name);
      await writeFile(output+'/provenance.json',JSON.stringify(notes,null,2));
    }catch(e){notes.errors.push(name+': '+e.message);console.log('CAPTURE ERROR',name,e.message);}
  }
  await capture('01-authored-oakmere','oakmere',null,1.3);
  await capture('02-human-castle','highmere',8,.65);
  await capture('03-elven-manor','elarion',1,1.1);
  await capture('04-elven-palace','elarion',9,.7);
  if(!notes.captures.length)throw new Error('No game captures were produced');
}catch(e){notes.errors.push(e.stack??e.message);console.error(e);process.exitCode=1;}
finally{
  await writeFile(output+'/provenance.json',JSON.stringify(notes,null,2));
  await page?.close().catch(()=>{});await context?.close().catch(()=>{});await browser?.close().catch(()=>{});
  if(server.exitCode===null){try{process.kill(-server.pid,'SIGTERM');}catch{}await Promise.race([new Promise(r=>server.once('close',r)),new Promise(r=>setTimeout(r,5000))]);}
  if(server.exitCode===null){try{process.kill(-server.pid,'SIGKILL');}catch{}}
  console.log('Capture browser/context closed; owned Vite server stopped');
}
