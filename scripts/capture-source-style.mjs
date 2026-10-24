import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';

const output='style-captures';
await mkdir(output,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5174','--strictPort'],{stdio:'inherit',detached:true});
let browser,context,page;
const notes={gameCommit:process.env.GAME_COMMIT,viewport:{width:720,height:1280},device:'Android-style touch browser; not a physical Android device',staging:'Fresh isolated save. Cameras, furniture gallery and merchant poses staged through development scene access. Actual game renderer and original assets. Not physical Android performance evidence.',captures:[],errors:[]};
try{
  for(let i=0;i<120;i++){
    try{if((await fetch('http://127.0.0.1:5174')).ok)break;}catch{}
    await new Promise(r=>setTimeout(r,500));
  }
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  context=await browser.newContext({viewport:notes.viewport,deviceScaleFactor:1.25,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36'});
  page=await context.newPage();page.setDefaultTimeout(120000);
  page.on('pageerror',e=>{notes.errors.push(e.message);console.log('PAGE ERROR',e.message);});
  let warnings=0;page.on('console',m=>{if(m.type()==='error'){if(/WebGLProgram|Shader Error|VALIDATE_STATUS/.test(m.text()))notes.errors.push(m.text());if(warnings++<25)console.log('BROWSER',m.text());}});
  await page.addInitScript(()=>localStorage.setItem('leighneron:effects-quality','normal'));
  console.log('Opening actual game');
  await page.goto('http://127.0.0.1:5174/?e2e',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Start New Game',exact:true}).click();
  await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'),null,{timeout:360000});
  console.log('World ready; unobstructed elven glazing and forward castle towers');
  await page.evaluate(async()=>{
    const {useGameStore}=await import('/src/store/gameStore.ts');window.captureStore=useGameStore;
    const s=window.__mernondnaGame.scene.getScene('world');
    s.cinematicDirector.destroy();if(s.interiors.cinematicContext)s.interiors.recoverCinematicLocation();
    useGameStore.getState().hydrate({pendingCinematic:null,cinematicQueue:[],cinematic:null,dialogue:null,panel:null,storyFlags:{'scene:highmere-arrival':true}});
    s.dayNight.minuteOfDay=10*60;s.dayNight.update(0,s.player.x,s.player.y);
    // Keep this isolated preview session from dying while scenery streams.
    s.events.on('update',()=>{if(s.player?.active)s.player.hp=s.player.maxHp;});
  });
  const hide=page.getByRole('button',{name:'Hide quest HUD',exact:true});if(await hide.isVisible())await hide.click();
  await page.evaluate(()=>{
    const s=window.__mernondnaGame.scene.getScene('world');
    Object.defineProperty(s,'presentationFocus',{configurable:true,get:()=>window.captureFocus??s.player});
    Object.defineProperty(s,'presentationControlsEnabled',{configurable:true,get:()=>true});
  });
async function enter(townId,profile){
    const id=await page.evaluate(async({townId,profile})=>{
      const s=window.__mernondnaGame.scene.getScene('world');
      const {INTERIOR_ENTRIES}=await import('/src/data/interiors.ts');
      const entry=INTERIOR_ENTRIES.find(e=>e.townId===townId&&e.profile===profile);
      if(!entry)throw new Error('No requested interior');
      s.player.restoreAt(entry.door.x,entry.door.y+25);s.lastSafe={x:s.player.x,y:s.player.y};
      s.prepareStoryArena();s.interiors.enter(entry);return entry.id;
    },{townId,profile});
    await page.waitForFunction(id=>{
      const s=window.__mernondnaGame.scene.getScene('world');return s.activeInteriorId===id&&s.interiors.ready;
    },id,{timeout:120000});
    await page.waitForTimeout(2500);
    const meta=await page.evaluate(()=>{
      const s=window.__mernondnaGame.scene.getScene('world'),plan=s.interiors.plan;
      const walls=s.children.list.filter(o=>o.name?.startsWith('interior-wall:'));
      const sides={};for(const w of walls)sides[w.name]=(sides[w.name]??0)+1;
      const a=s.interiors.localPoint(plan.entrance),b=s.interiors.localPoint({x:plan.entrance.x,y:plan.entrance.y-110});
      return {entry:s.activeInteriorId,wallPanels:walls.length,sides,exitApproachClear:s.interiors.combatPath(a,b)};
    });
    notes.interiors??=[];notes.interiors.push(meta);console.log('INTERIOR',JSON.stringify(meta));
    if(!meta.exitApproachClear)throw new Error('Exit approach blocked');
  }
  async function capture(name,local,yaw=25,zoom=1.05){
    const meta=await page.evaluate(async({local,yaw,zoom})=>{
      const s=window.__mernondnaGame.scene.getScene('world');
      const {OrbitCamera}=await import('/src/game/presentation25d/OrbitCamera.ts');
      const {presentationView}=await import('/src/game/presentation25d/plane.ts');
      if(!window.wallOrbitUpdate){
        window.wallOrbitUpdate=OrbitCamera.prototype.update;
        OrbitCamera.prototype.update=function(...args){
          this.targetYaw=window.wallYaw;const h=args[2];args[2]=(x,y)=>h(x,y)+(window.captureAim??50);
          return window.wallOrbitUpdate.apply(this,args);
        };
      }
      const p=s.interiors.localPoint(local);window.captureFocus=p;window.wallYaw=yaw*Math.PI/180;
      s.player.restoreAt(p.x,p.y);s.player.resetInput();
      s.cameras.main.stopFollow().setZoom(zoom).centerOn(p.x,p.y);presentationView(s).camera.fov=38;
      return {entry:s.activeInteriorId,local,yaw,zoom,playerClear:s.interiors.playerFeet(p.x,p.y)};
    },{local,yaw,zoom});
    if(!meta.playerClear)throw new Error('Capture stance is not walkable: '+name);
    await page.waitForTimeout(3500);
    await page.screenshot({path:output+'/'+name+'.png'});notes.captures.push({name,...meta});console.log('Saved',name);
  }
  async function leave(){
    await page.evaluate(()=>{
      const s=window.__mernondnaGame.scene.getScene('world'),p=s.interiors.localPoint(s.interiors.plan.entrance);
      s.player.restoreAt(p.x,p.y);s.player.resetInput();window.captureFocus=null;const state=window.captureStore.getState();console.log('EXIT STATE',JSON.stringify({panel:state.panel,dialogue:state.dialogue?.npcId,cinematicContext:Boolean(s.interiors.cinematicContext),local:s.interiors.plan.entrance}));s.tryInteract(p.x,p.y);
    });
    await page.waitForFunction(()=>!window.__mernondnaGame.scene.getScene('world').activeInteriorId,null,{timeout:15000});
    console.log('Actual south-exit interaction returned outside');
  }
  async function gallery(townId,profile,name,center){
    await enter(townId,profile);
    await page.evaluate(center=>{
      const s=window.__mernondnaGame.scene.getScene('world');window.gallery=[];
      for(const [i,art] of ['chest','barrel','bed','chair','table','wardrobe','bookcase','counter'].entries()){
        const x=center.x+(i%4-1.5)*120,y=center.y-Math.floor(i/4)*150;
        const im=s.interiors.drawArt(art,x,y,art==='table'||art==='counter'?110:art==='bed'?84:65,1000000+y);
        im.setName('capture-gallery:'+art);window.gallery.push(im);
      }
    },center);
    await capture(name,{x:center.x,y:center.y+160},25,.82);
    await page.evaluate(()=>{for(const o of window.gallery)o.destroy();window.gallery=[];});
    await leave();
  }
  await gallery('highmere','castle','01-highmere-source-furniture',{x:1160,y:1110});
  await gallery('elarion','villa','02-elven-source-furniture',{x:550,y:930});
  // Back to the unmodified overworld simulation after interior captures.
  async function outside(point,yaw=25,zoom=1.0,aim=45,fov=38){
    await page.evaluate(async({point,yaw,zoom,aim,fov})=>{
      const s=window.__mernondnaGame.scene.getScene('world');
      const {ElevationField}=await import('/src/game/presentation25d/ElevationField.ts');
      const previous=ElevationField.prototype.prepare;
      ElevationField.prototype.prepare=function(...args){this.columns=0;ElevationField.prototype.prepare=previous;return previous.apply(this,args);};
      window.captureFocus=point;window.wallYaw=yaw*Math.PI/180;window.captureAim=aim;
      s.player.restoreAt(point.x,point.y);s.lastSafe={...point};s.player.resetInput();
      s.cameras.main.stopFollow().setZoom(zoom).centerOn(point.x,point.y);s.streamCinematicView(point.x,point.y);
      const {presentationView}=await import('/src/game/presentation25d/plane.ts');presentationView(s).camera.fov=fov;
    },{point,yaw,zoom,aim,fov});
    await page.waitForTimeout(12000);
  }
  async function save(name){await page.screenshot({path:output+'/'+name+'.png'});notes.captures.push({name});console.log('Saved',name);}
  const positions=await page.evaluate(async()=>{
    const {WORLD_CONTENT}=await import('/src/data/content.ts');
    const tree=WORLD_CONTENT.find(d=>d.texture==='elarion_tree');
    const fence=WORLD_CONTENT.find(d=>d.id==='elarion:whitebough-fence:north:0');
    const cottage=WORLD_CONTENT.find(d=>d.kind==='settlement-prop'&&d.id.startsWith('town:oakmere:building:')&&d.frame===0);
    const wall=WORLD_CONTENT.find(d=>d.id.startsWith('fort:highmere:curtain:0:')&&d.id.endsWith(':4'));
    return {tree:tree.world,fence:fence.world,cottage:cottage.world,wall:wall.world};
  });
  const cart=await page.evaluate(()=>{
    const s=window.__mernondnaGame.scene.getScene('world'),route=s.traffic.roads[0];
    return {...route.points[Math.floor(route.points.length/2)]};
  });
  await outside(cart,25,.86,55,45);
  await page.evaluate(cart=>{
    const s=window.__mernondnaGame.scene.getScene('world');window.gallery=[];
    for(const [i,[texture,frame,dx,dy,scale]] of [
      ['flower_fence',0,0,-170,.85],
      ['others',6,-145,50,.8],['others',10,140,50,.8],
      ['others',8,-145,210,.75],['world_assets',7,140,210,.75]
    ].entries()){
      const actor=s.add.sprite(cart.x+dx,cart.y+dy,texture,frame).setName('capture-world-source:'+i);
      s.presentWorldSprite(actor,texture,frame,scale,false,undefined,0,'bottom');
      window.gallery.push(actor);
    }
    s.player.restoreAt(cart.x,cart.y+300);
  },cart);
  await page.waitForTimeout(3000);await save('11-world-source-gallery');
  await outside(cart,205,.86,55,45);
  await page.evaluate(cart=>window.__mernondnaGame.scene.getScene('world').player.restoreAt(cart.x,cart.y+300),cart);
  await page.waitForTimeout(3000);await save('12-world-source-gallery-reverse');
  await page.evaluate(()=>{for(const o of window.gallery)o.destroy();window.gallery=[];});

}catch(e){notes.errors.push(e.stack??e.message);console.error(e);process.exitCode=1;}
finally{
  if(page)await page.evaluate(()=>{const s=window.__mernondnaGame?.scene.getScene('world');if(s&&window.captureCart)s.traffic.release(window.captureCart);if(s&&window.cartUpdate)s.traffic.update=window.cartUpdate;for(const o of window.gallery??[])o.destroy();}).catch(()=>{});
  await writeFile(output+'/provenance.json',JSON.stringify(notes,null,2));
  await page?.close().catch(()=>{});await context?.close().catch(()=>{});await browser?.close().catch(()=>{});
  if(server.exitCode===null){try{process.kill(-server.pid,'SIGTERM');}catch{}await Promise.race([new Promise(r=>server.once('close',r)),new Promise(r=>setTimeout(r,5000))]);}
  if(server.exitCode===null){try{process.kill(-server.pid,'SIGKILL');}catch{}}
  console.log('Capture browser/context closed; owned Vite server stopped');
}
