import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';

const output='game-captures';
await mkdir(output,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5174','--strictPort'],{stdio:'inherit',detached:true});
let browser,context,page;
const notes={gameCommit:process.env.GAME_COMMIT,viewport:{width:1280,height:720},device:'Android-style touch browser; not a physical Android device',staging:'Fresh save; camera positions staged through existing development scene access. Scenery camera and aim height staged for model review; tower prerequisites set only in the isolated review save; the land avatar is hidden at the staged vessel and its land-collision fallback is temporarily suspended for boat shots; cutaway disabled in this preview. Terrain prepared after cross-map staging.',captures:[],errors:[]};
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
  console.log('World ready; player-sized houses, solid coastal boat, original Magus tower');
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
  async function capture(name,townId,frame,zoom,yaw=25){
    try{
      console.log('Preparing',name);
      const meta=await page.evaluate(async({townId,frame,zoom,yaw})=>{
        const s=window.__mernondnaGame.scene.getScene('world');
        const {TOWN_BY_ID}=await import('/src/data/towns.ts');
        const {SETTLEMENT_BY_ID}=await import('/src/data/settlements.ts');
        const {ElevationField}=await import('/src/game/presentation25d/ElevationField.ts');
        const {presentationView}=await import('/src/game/presentation25d/plane.ts');
        const {OrbitCamera}=await import('/src/game/presentation25d/OrbitCamera.ts');
        if(!window.captureOrbitUpdate){
          window.captureOrbitUpdate=OrbitCamera.prototype.update;
          OrbitCamera.prototype.update=function(...args){this.targetYaw=window.captureYaw;const originalHeight=args[2];args[2]=(x,y)=>originalHeight(x,y)+(window.captureAimHeight??0);return window.captureOrbitUpdate.apply(this,args);};
        }
        window.captureYaw=yaw*Math.PI/180;window.captureAimHeight=frame===1?85:25;
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
        return {townId,frame,zoom,yaw,lot:lot?.label,player:p,focus};
      },{townId,frame,zoom,yaw});
      await page.waitForTimeout(16000);
      await page.screenshot({path:output+'/'+name+'.png',timeout:60000});
      notes.captures.push({name,...meta});console.log('Saved',name);
      await writeFile(output+'/provenance.json',JSON.stringify(notes,null,2));
    }catch(e){notes.errors.push(name+': '+e.message);console.log('CAPTURE ERROR',name,e.message);}
  }
  await capture('01-larger-cottages','oakmere',0,1.15);
  await capture('02-larger-elven-manor','elarion',1,.85);
  await page.evaluate(async()=>{
    const s=window.__mernondnaGame.scene.getScene('world');
    const {PORT_BY_ID}=await import('/src/data/ports.ts');
    const {presentationView}=await import('/src/game/presentation25d/plane.ts');
    const {ElevationField}=await import('/src/game/presentation25d/ElevationField.ts');const prepare=ElevationField.prototype.prepare;ElevationField.prototype.prepare=function(...args){this.columns=0;ElevationField.prototype.prepare=prepare;return prepare.apply(this,args);};
    const port=PORT_BY_ID.tidewatch;
    let p;
    for(const [dx,dy] of [[0,8000],[6000,6000],[-6000,6000],[0,12000]]){
      const q={x:port.boat.x+dx,y:port.boat.y+dy};
      if([[0,0],[700,0],[-700,0],[0,700],[0,-700]].every(([x,y])=>s.worldGenerator.getTerrainAt(q.x+x,q.y+y)==='water')){p=q;break;}
    }
    if(!p)throw new Error('No clear water for boat capture');
    s.player.restoreAt(p.x,p.y);s.lastSafe={...p};s.player.setVisible(false);window.captureLandCollision=s.enforceLandCollision;s.enforceLandCollision=()=>{};s.syncState();s.updateNavigation();window.captureFocus=p;window.captureYaw=25*Math.PI/180;window.captureAimHeight=90;
    s.cameras.main.setZoom(1.1).centerOn(p.x,p.y);presentationView(s).camera.fov=38;s.streamCinematicView(p.x,p.y);
    window.captureVessel=s.traffic.createVessel('capture-coastal-vessel',p.x,p.y,1.25);
    s.traffic.showPassenger(window.captureVessel);
    window.captureVesselPose={...p,dx:1,dy:-.35};
    window.captureVesselUpdate=()=>{const p=window.captureVesselPose;if(p)s.traffic.positionVessel(window.captureVessel,p.x,p.y,p.dx,p.dy,false);};
    s.events.on('update',window.captureVesselUpdate);
  });
  await page.waitForTimeout(16000);
  await page.screenshot({path:output+'/03-solid-coastal-boat.png'});notes.captures.push({name:'03-solid-coastal-boat'});
  await page.evaluate(()=>{window.captureYaw=205*Math.PI/180;});
  await page.waitForTimeout(3000);
  await page.screenshot({path:output+'/04-solid-boat-rear.png'});notes.captures.push({name:'04-solid-boat-rear'});
  await page.evaluate(async()=>{
    const s=window.__mernondnaGame.scene.getScene('world');s.events.off('update',window.captureVesselUpdate);s.traffic.releaseVessel(window.captureVessel);window.captureVesselPose=null;s.enforceLandCollision=window.captureLandCollision;s.player.setVisible(true);
    const {useGameStore}=await import('/src/store/gameStore.ts');
    const {TOWER_DOOR,TOWER_APPROACH,TOWER_UNLOCKED,TOWER_STORY_PREREQUISITE}=await import('/src/data/towerOfMight.ts');
    const {presentationView}=await import('/src/game/presentation25d/plane.ts');
    const {ElevationField}=await import('/src/game/presentation25d/ElevationField.ts');const prepare=ElevationField.prototype.prepare;ElevationField.prototype.prepare=function(...args){this.columns=0;ElevationField.prototype.prepare=prepare;return prepare.apply(this,args);};
    const state=useGameStore.getState();state.hydrate({quests:{...state.quests,[TOWER_STORY_PREREQUISITE]:{...state.quests[TOWER_STORY_PREREQUISITE],status:'completed'}},storyFlags:{...state.storyFlags,[TOWER_UNLOCKED]:true},defeatedBosses:[...new Set([...state.defeatedBosses,'captain-varr'])]});
    const p={x:TOWER_APPROACH.x,y:TOWER_APPROACH.y+30};s.player.restoreAt(p.x,p.y);s.lastSafe=p;s.player.resetInput();
    window.captureFocus={x:TOWER_DOOR.x,y:TOWER_DOOR.y-100};window.captureYaw=25*Math.PI/180;window.captureAimHeight=235;
    presentationView(s).camera.fov=55;s.cameras.main.setZoom(.7).centerOn(window.captureFocus.x,window.captureFocus.y);s.streamCinematicView(p.x,p.y);s.dungeons.exteriorMarkers();
  });
  await page.waitForFunction(()=>window.__mernondnaGame.scene.getScene('world').children.getByName('Tower of Might'),null,{timeout:120000});
  await page.waitForTimeout(16000);
  const entrance=await page.evaluate(async()=>{
    const s=window.__mernondnaGame.scene.getScene('world');const {TOWER_APPROACH:TOWER_DOOR}=await import('/src/data/towerOfMight.ts');
    const actor=s.children.getByName('Tower of Might'),body=actor.body;
    const samples=[{x:TOWER_DOOR.x,y:TOWER_DOOR.y},{x:TOWER_DOOR.x,y:TOWER_DOOR.y+45},{x:TOWER_DOOR.x-32,y:TOWER_DOOR.y+30},{x:TOWER_DOOR.x+32,y:TOWER_DOOR.y+30}].map(p=>({...p,clear:s.interiorDoorClear(p.x,p.y),path:s.hasClearPath(p.x,p.y,TOWER_DOOR.x,TOWER_DOOR.y),entry:s.interiors.nearest(p.x,p.y)?.id}));
    return {samples,body:{x:body.x,y:body.y,bottom:body.bottom,radius:body.radius},player:{x:s.player.x,y:s.player.y},image:{x:actor.x,y:actor.y}};
  });
  notes.entrance=entrance;console.log('TOWER ENTRANCE',JSON.stringify(entrance));
  await page.screenshot({path:output+'/05-magus-tower.png'});notes.captures.push({name:'05-magus-tower'});
  if(entrance.samples.some(p=>!p.clear||!p.path||p.entry!=='cave:tower-of-might'))throw new Error('Tower approach not selectable');
  await page.evaluate(()=>{
    const s=window.__mernondnaGame.scene.getScene('world');
    s.prepareStoryArena();window.captureFocus=null;window.captureAimHeight=0;s.tryInteract(s.player.x,s.player.y);
  });
  await page.waitForFunction(()=>window.__mernondnaGame.scene.getScene('world').activeInteriorId==='cave:tower-of-might',null,{timeout:120000});
  notes.towerEntered=true;console.log('Tower entry reached the actual interior');
  await page.waitForTimeout(3500);await page.screenshot({path:output+'/06-tower-entered.png'});notes.captures.push({name:'06-tower-entered'});
  if(!notes.captures.length)throw new Error('No game captures were produced');
}catch(e){notes.errors.push(e.stack??e.message);console.error(e);process.exitCode=1;}
finally{
  await writeFile(output+'/provenance.json',JSON.stringify(notes,null,2));
  await page?.close().catch(()=>{});await context?.close().catch(()=>{});await browser?.close().catch(()=>{});
  if(server.exitCode===null){try{process.kill(-server.pid,'SIGTERM');}catch{}await Promise.race([new Promise(r=>server.once('close',r)),new Promise(r=>setTimeout(r,5000))]);}
  if(server.exitCode===null){try{process.kill(-server.pid,'SIGKILL');}catch{}}
  console.log('Capture browser/context closed; owned Vite server stopped');
}
