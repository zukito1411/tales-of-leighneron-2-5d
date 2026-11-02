import {test,expect} from '@playwright/test';
import type Phaser from 'phaser';
import type {WorldScene} from '../../src/game/scenes/WorldScene';
import type {ThreePresentation} from '../../src/game/presentation25d/ThreePresentation';
import type {GpuWeather} from '../../src/game/presentation25d/GpuWeather';

declare global {interface Window {
  __renderReview?:{corners:number;differences:number;rain:number;rainKind:number;thunder:number};
}}
test.use({launchOptions:{args:['--use-angle=default']},trace:'off'});
test('stable locks, culling parity, storm audio and offshore boarding',async({browser})=>{
  test.setTimeout(180000);
  const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(/Shader Error|INVALID_OPERATION|INVALID_VALUE|could not be prepared/i.test(m.text()))errors.push(m.text());});
  try{
    await page.goto('/?e2e');
    await page.evaluate(async()=>{
      const renderPath='/src/game/presentation25d/ThreePresentation.ts',weatherPath='/src/game/presentation25d/GpuWeather.ts',audioPath='/src/game/systems/ThunderAudio.ts',threePath='/node_modules/.vite/deps/three.js';
      const {ThreePresentation}=await import(/* @vite-ignore */ renderPath) as typeof import('../../src/game/presentation25d/ThreePresentation');
      const {GpuWeather}=await import(/* @vite-ignore */ weatherPath) as typeof import('../../src/game/presentation25d/GpuWeather');
      const {ThunderAudio}=await import(/* @vite-ignore */ audioPath) as typeof import('../../src/game/systems/ThunderAudio');
      const {Vector3}=await import(/* @vite-ignore */ threePath) as typeof import('three');
      const result=window.__renderReview={corners:0,differences:0,rain:0,rainKind:-1,thunder:0};
      const original=ThreePresentation.prototype['inView'];
      ThreePresentation.prototype['inView']=function(this:ThreePresentation,ground,back=0,furniture,centered=false,lift=0,floor){
        const actual=original.call(this,ground,back,furniture,centered,lift,floor);
        if(ground||result.corners>=1200)return actual;
        const vertices=[[-.5,-.5],[.5,-.5],[-.5,.5],[.5,.5]],point=new Vector3(),n=furniture||back>0?8:4;
        let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity,near=Infinity,far=-Infinity;
        for(let i=0;i<n;i++){
          const [x,y]=vertices[i%4],b=furniture?.bounds;
          if(furniture)point.set(b?(x<0?b.left:b.right):x*1.1,b?(y<0?b.bottom:b.top):(y+.5)*furniture.rise*1.06,
            b?(i>=4?b.back:b.front):i>=4?-Math.max(furniture.depth*1.1,furniture.depth/2+.5):Math.max(.025,.5-furniture.depth/2));
          else point.set(x,y+(y>0?lift:0),i>=4&&back>0?-back:centered?back:0);
          point.applyMatrix4(this['model']);if(floor!==undefined)this['leanPoint'](point,floor);point.project(this['orbit'].camera);
          left=Math.min(left,point.x);right=Math.max(right,point.x);top=Math.min(top,point.y);bottom=Math.max(bottom,point.y);
          near=Math.min(near,point.z);far=Math.max(far,point.z);
        }
        const expected=far>=-1&&near<=1&&right>=-1.15&&left<=1.15&&bottom>=-1.15&&top<=1.15,b=this['projectedBounds'];
        if(actual!==expected||Math.abs(left-b.left)>1e-5||Math.abs(right-b.right)>1e-5||Math.abs(top-b.top)>1e-5||Math.abs(bottom-b.bottom)>1e-5)result.differences++;
        result.corners++;return actual;
      };
      const update=GpuWeather.prototype.update;
      GpuWeather.prototype.update=function(this:GpuWeather,...args){update.apply(this,args);result.rain=this['mesh'].visible?this['mesh'].count:0;result.rainKind=this['uniforms'].kind.value;};
      const play=ThunderAudio.prototype.play;
      ThunderAudio.prototype.play=function(...args){result.thunder++;play.apply(this,args);};
    });
    await page.getByRole('button',{name:'Start New Game',exact:true}).click();
    await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'),null,{timeout:120000});
    await page.getByRole('button',{name:/Skip scene/}).click();
    await page.waitForFunction(()=>!(window.__mernondnaGame!.scene.getScene('world') as WorldScene)['cinematicDirector'].active);
    await page.evaluate(()=>{
      const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s.scene.pause();
      const target=s.getCombatEnemies().find(e=>e.active&&e.isAlive&&s.safeSkillPosition({x:e.x-140,y:e.y+60}));
      if(!target)throw new Error('No loaded enemy for lock review');
      s.registry.set('review-lock-id',target.instanceId);s.restoreOutsidePosition({x:target.x-140,y:target.y+60});
    });
    await page.waitForTimeout(500);
    const lock=await page.evaluate(()=>{
      const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene,p=s.player;
      const a=s.getCombatEnemies().find(e=>e.instanceId===s.registry.get('review-lock-id'))!;
      const b=s.createStoryEnemy('road-bandit',{x:p.x+36,y:p.y},'review:lock-intruder');
      s.targeting.clear();s.targeting.select(a);
      if(s.targeting.lockedTarget!==a)throw new Error('Reviewed enemy was not rendered for initial acquisition');
      const body=a.body as Phaser.Physics.Arcade.Body,origin={x:a.x,y:a.y},hp=a.hp;
      s.targeting.select(b);const incidental=s.targeting.lockedTarget===a;
      body.reset(p.x+4000,p.y);s.time.now+=1000;s.targeting.update();
      const offscreen=s.targeting.lockedTarget===a&&s.targeting.selected===a;
      const noRedirect=s.targeting.skillTarget(120)===null;
      a.setVisible(false);s.targeting.update();const hidden=s.targeting.lockedTarget===a;
      a.setVisible(true);body.reset(origin.x,origin.y);a.hp=0;s.targeting.update();
      const death=s.targeting.lockedTarget===null;a.hp=hp;
      s.targeting.clear();s.releaseStoryEnemy(b);
      return {incidental,offscreen,noRedirect,hidden,death};
    });
    expect(lock).toEqual({incidental:true,offscreen:true,noRedirect:true,hidden:true,death:true});
    const shadow=await page.evaluate(()=>{
      const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene,shadows=s['groundShadows'];
      const bounds={left:s.player.x-350,right:s.player.x+350,top:s.player.y-350,bottom:s.player.y+350};
      const all=[...shadows.gpuCasters()],local=new Set(shadows.gpuCasters(bounds));let misses=0;
      for(const c of all){
        const a=c.actor,hint=a.getData('presentation25d'),house=hint?.house;
        const art=c.texture?s.textures.getFrame(c.texture,c.frame):a.frame;
        const reach=house?.segment?Math.hypot(house.segment.dx,house.segment.dy)+house.segment.thickness+house.segment.height*((c.projection??1)+1)
          :(art.cutWidth+art.cutHeight*(house?.riseScale??1)*((c.projection??1)+1))*Math.max(Math.abs(a.scaleX),Math.abs(a.scaleY));
        if(a.active&&a.visible&&a.x+reach>=bounds.left&&a.x-reach<=bounds.right&&a.y+reach>=bounds.top&&a.y-reach<=bounds.bottom&&!local.has(c))misses++;
      }
      return {all:all.length,local:local.size,misses};
    });
    expect(shadow.misses).toBe(0);expect(shadow.local).toBeLessThan(shadow.all);
    const migration=await page.evaluate(async()=>{
      const shipPath='/src/data/pirateFlagship.ts',movePath='/src/game/systems/flagshipRelocation.ts',savePath='/src/utils/saveValidation.ts',storePath='/src/store/gameStore.ts';
      const ship=await import(/* @vite-ignore */ shipPath) as typeof import('../../src/data/pirateFlagship');
      const {relocateFlagship}=await import(/* @vite-ignore */ movePath) as typeof import('../../src/game/systems/flagshipRelocation');
      const {parseSave}=await import(/* @vite-ignore */ savePath) as typeof import('../../src/utils/saveValidation');
      const {useGameStore}=await import(/* @vite-ignore */ storePath) as typeof import('../../src/store/gameStore');
      const old=ship.shipPoint(410,860);old.x-=ship.FLAGSHIP_OFFSHORE_SHIFT;
      const world:import('../../src/game/types').ContentWorldState={states:{'boss:salt-king':{...old,hp:10,defeated:false},
        'pirate:flagship:crew:0':{...old,hp:0,defeated:true,respawnAt:123456789}},spawns:{},nextSpawnSequence:0};
      const first=relocateFlagship(world,old),second=relocateFlagship(first.world,first.player);
      const raw=JSON.stringify({version:7,state:{...useGameStore.getState(),worldContent:world,worldX:old.x,worldY:old.y}});
      const parsed=parseSave(raw),again=parsed&&parseSave(JSON.stringify(parsed));
      const shore=ship.shipPoint(ship.FLAGSHIP_GANGPLANK.right+11,790),board=ship.shipPoint(600,790);
      const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;let blocked=0;
      for(let i=0;i<=80;i++){
        const q={x:board.x+(shore.x-board.x)*i/80,y:board.y};
        if(!s['worldGenerator'].isWalkable(q.x,q.y)||ship.onFlagshipBoarding(q.x,q.y)&&!ship.flagshipWalkable(q.x,q.y,10))blocked++;
      }
      return {shift:first.player.x-old.x,repeat:second.player.x-first.player.x,health:first.world.states['boss:salt-king'].hp,
        dead:first.world.states['pirate:flagship:crew:0'].defeated,deadline:first.world.states['pirate:flagship:crew:0'].respawnAt,
        parsed:!!parsed,parsedShift:parsed?parsed.state.worldX-old.x:0,parsedRepeat:again&&parsed?again.state.worldX-parsed.state.worldX:999,
        aboard:ship.onFlagshipDeck(first.player.x,first.player.y),blocked,shoreDry:s['worldGenerator'].getGroundTerrainAt(shore.x,shore.y)!=='water'};
    });
    expect(migration).toMatchObject({shift:-640,repeat:0,health:10,dead:true,deadline:123456789,parsed:true,parsedShift:-640,parsedRepeat:0,aboard:true,blocked:0,shoreDry:true});
    await page.keyboard.press('Shift');
    const audio=await page.evaluate(async()=>{
      const path='/src/game/systems/ThunderAudio.ts';const {ThunderAudio}=await import(/* @vite-ignore */ path) as typeof import('../../src/game/systems/ThunderAudio');
      const offline=new OfflineAudioContext(1,48000*8,48000),noise=offline.createBuffer(1,48000*2,48000),channel=noise.getChannelData(0);
      let seed=37;for(let i=0;i<channel.length;i++){seed=Math.imul(seed,1664525)+1013904223;channel[i]=((seed>>>0)/4294967296-.5)*.5;}
      const voice=new ThunderAudio();voice.play(offline as unknown as AudioContext,offline.destination,noise,false);
      const rendered=(await offline.startRendering()).getChannelData(0);let peak=0,tail=0;
      for(let i=0;i<rendered.length;i++){peak=Math.max(peak,Math.abs(rendered[i]));if(i>48000*2&&i<48000*5)tail+=rendered[i]**2;}
      voice.destroy();
      return {peak,tailRms:Math.sqrt(tail/(48000*3))};
    });
    expect(audio.peak).toBeGreaterThan(.1);expect(audio.peak).toBeLessThan(1);expect(audio.tailRms).toBeGreaterThan(.001);
    await page.evaluate(()=>{
      const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene,w=s.presentationWeather;
      w['kind']=w['target']='storm';w['strength']=1;w['thunderRemaining']=0;w['enableAudio']();
      w.update(100,s.player.x,s.player.y,false);
    });
    await page.waitForFunction(()=>window.__renderReview!.rain===1024&&window.__renderReview!.thunder>=2);
    const mix=await page.evaluate(()=>{
      const w=(window.__mernondnaGame!.scene.getScene('world') as WorldScene).presentationWeather,param=w['gain']!.gain,original=param.setTargetAtTime;
      const levels:number[]=[];
      param.setTargetAtTime=function(value,time,constant){levels.push(value);return original.call(this,value,time,constant);};
      try{
        const sample=()=>{w['lastAmbienceUpdateAt']=-Infinity;w['updateAmbience']('trandum','forest',0,false);};
        w['thunderDuckUntil']=-Infinity;sample();w.thunder(true);sample();
        w['elapsed']+=3500;sample();return {normal:levels[0],duringThunder:levels[1],restored:levels[2]};
      }finally{param.setTargetAtTime=original;}
    });
    expect(mix.duringThunder).toBeLessThan(mix.normal*.5);expect(mix.restored).toBeCloseTo(mix.normal,4);
    const rain=await page.evaluate(()=>window.__renderReview);expect(rain!.rainKind).toBe(0);
    expect(rain!.corners).toBeGreaterThan(300);expect(rain!.differences).toBe(0);
    await page.screenshot({path:'test-results/heavy-thunderstorm.png'});
    await page.evaluate(async()=>{
      const path='/src/game/systems/effectsQuality.ts';const {setEffectsQuality}=await import(/* @vite-ignore */ path) as typeof import('../../src/game/systems/effectsQuality');setEffectsQuality('low');
    });
    await page.waitForFunction(()=>window.__renderReview!.rain===384);
    await page.evaluate(async()=>{
      const path='/src/game/systems/effectsQuality.ts';const {setEffectsQuality}=await import(/* @vite-ignore */ path) as typeof import('../../src/game/systems/effectsQuality');setEffectsQuality('normal');
    });
    await page.waitForFunction(()=>window.__renderReview!.rain===1024);
    await page.evaluate(async()=>{
      const path='/src/data/pirateFlagship.ts';const {shipPoint,FLAGSHIP_GANGPLANK}=await import(/* @vite-ignore */ path) as typeof import('../../src/data/pirateFlagship');
      const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
      s.scene.resume();const p=shipPoint(FLAGSHIP_GANGPLANK.right-75,790);s.landFromPassage(p,true);s.coverWorldArrival(p);
    });
    await page.waitForFunction(()=>{const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;return !s['arrivalView']&&!s['screenTransition'].active;},null,{timeout:60000});
    await page.evaluate(()=>{const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s.scene.pause();s.player.resetInput();});
    await page.mouse.wheel(0,650);await page.waitForTimeout(350);
    await page.screenshot({path:'test-results/offshore-flagship-gangplank.png'});
    console.log(JSON.stringify({lock,shadow,migration,audio,rain,mix}));expect(errors).toEqual([]);
  }finally{await context.close();}
});
