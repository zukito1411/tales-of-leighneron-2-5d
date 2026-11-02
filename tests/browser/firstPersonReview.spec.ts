import {test,expect} from '@playwright/test';
import type {WorldScene} from '../../src/game/scenes/WorldScene';
import type {FirstPersonWeapon} from '../../src/game/presentation25d/FirstPersonWeapon';
interface WeaponProbe {visible:boolean;rigVisible:boolean;models:string[];key:string;vertices:number;thickness:number;angle:number;bladeYaw:number;frames:number;pose:number[]}
declare global {interface Window {__firstPersonWeaponProbe?:WeaponProbe}}
test.use({launchOptions:{args:['--use-angle=default']},trace:'off'});
for(const touch of [false,true])test(touch?'touch first-person controls and settings':'first-person sword, aiming, camera switching and menu lifecycle',async({browser})=>{
  test.setTimeout(180000);
  const context=await browser.newContext({viewport:touch?{width:844,height:390}:{width:1280,height:800},hasTouch:touch,isMobile:touch});
  const page=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',message=>{if(/Shader Error|INVALID_OPERATION|INVALID_VALUE|could not be prepared/i.test(message.text()))errors.push(message.text());});
  try{
    await page.goto('/?e2e');
    await page.evaluate(async()=>{
      const path='/src/game/presentation25d/FirstPersonWeapon.ts';
      const {FirstPersonWeapon}=await import(/* @vite-ignore */ path) as typeof import('../../src/game/presentation25d/FirstPersonWeapon');
      const render=FirstPersonWeapon.prototype.render;
      FirstPersonWeapon.prototype.render=function(this:FirstPersonWeapon){
        render.call(this);const mesh=this['mesh'],position=mesh?.geometry.getAttribute('position');
        let lo=Infinity,hi=-Infinity;
        if(position)for(let i=0;i<position.count;i++){lo=Math.min(lo,position.getZ(i));hi=Math.max(hi,position.getZ(i));}
        const rig=this['rig'];
        window.__firstPersonWeaponProbe={visible:!!mesh?.visible&&this['active']&&rig.visible,rigVisible:rig.visible,models:rig.children.map(child=>child.name),
          key:this['loadedKey'],vertices:position?.count??0,thickness:hi-lo,angle:rig.rotation.z,bladeYaw:mesh?.rotation.y??0,
          pose:[rig.position.x,rig.position.y,rig.position.z,rig.rotation.x,rig.rotation.y,rig.rotation.z],frames:(window.__firstPersonWeaponProbe?.frames??0)+1};
      };
    });
    await page.getByRole('button',{name:'Start New Game',exact:true}).click();
    await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'),null,{timeout:120000});
    await page.getByRole('button',{name:/Skip scene/}).click();
    await page.waitForFunction(()=>!(window.__mernondnaGame!.scene.getScene('world') as WorldScene)['cinematicDirector'].active);
    if(touch){
      await page.evaluate(async()=>{const path='/src/store/gameStore.ts';const {useGameStore}=await import(/* @vite-ignore */ path) as typeof import('../../src/store/gameStore');useGameStore.setState({panel:'pause'});});
      await page.getByLabel('Camera view',{exact:true}).selectOption('first-person');
      await page.getByRole('button',{name:'Resume',exact:true}).click();
    }else await page.keyboard.press('v');
    await page.waitForFunction(()=>window.__firstPersonWeaponProbe?.visible,{},{timeout:20000});
    const first=await page.evaluate(async()=>{
      const path='/src/game/presentation25d/plane.ts';const {presentationView}=await import(/* @vite-ignore */ path) as typeof import('../../src/game/presentation25d/plane');
      const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene,p=s.player,view=presentationView(s)!;
      return {firstPerson:view.firstPerson,offset:Math.hypot(view.camera.position.x-p.x,view.camera.position.z-p.y),eye:view.camera.position.y-s.groundHeightAt(p.x,p.y)-p.presentationElevation,
        fov:view.camera.fov,selfDrawn:view.actorDrawn?.(p),weapon:window.__firstPersonWeaponProbe!,from:{x:p.x,y:p.y}};
    });
    expect(first.firstPerson).toBe(true);expect(first.offset).toBeLessThan(.1);expect(first.eye).toBeCloseTo(60.8,1);
    expect(first.fov).toBe(75);expect(first.selfDrawn).toBe(false);expect(first.weapon.vertices).toBeGreaterThan(12);expect(first.weapon.thickness).toBeGreaterThan(.01);
    expect(first.weapon.thickness).toBeGreaterThan(.07);expect(first.weapon.bladeYaw).toBeGreaterThan(.9);expect(first.weapon.models).toEqual(['first-person-equipped-sword']);
    await page.screenshot({path:`test-results/first-person-${touch?'touch':'desktop'}-idle.png`});
    if(touch){
      const cdp=await context.newCDPSession(page);
      try{
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:580,y:170,id:1}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:650,y:190,id:1}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      }finally{await cdp.detach();}
    }
    await page.evaluate(async()=>{
      const path='/src/game/input.ts';const {mobileInput}=await import(/* @vite-ignore */ path) as typeof import('../../src/game/input');mobileInput.setMove(0,-1);
    });
    await page.waitForTimeout(350);
    const movement=await page.evaluate(async()=>{
      const path='/src/game/input.ts',projection='/src/game/presentation25d/plane.ts';const {mobileInput}=await import(/* @vite-ignore */ path) as typeof import('../../src/game/input');
      const {presentationView}=await import(/* @vite-ignore */ projection) as typeof import('../../src/game/presentation25d/plane');
      mobileInput.releaseMove();const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene,p=s.player,v=presentationView(s)!;
      return {x:p.x,y:p.y,aim:p.lastDirection.x*-Math.sin(v.yaw)+p.lastDirection.y*-Math.cos(v.yaw)};
    });
    expect(Math.hypot(movement.x-first.from.x,movement.y-first.from.y)).toBeGreaterThan(4);expect(movement.aim).toBeGreaterThan(.98);
    const resting=(await page.evaluate(()=>window.__firstPersonWeaponProbe!)).angle;
    await page.evaluate(async()=>{const path='/src/game/input.ts';const {mobileInput}=await import(/* @vite-ignore */ path) as typeof import('../../src/game/input');mobileInput.press('attack');});
    await page.waitForFunction(resting=>Math.abs(window.__firstPersonWeaponProbe!.angle-resting)>.2,resting);
    await page.screenshot({path:`test-results/first-person-${touch?'touch':'desktop'}-swing.png`});
    await page.waitForTimeout(400);
    // The equipped source must follow actual equipment, not a cosmetic default.
    await page.evaluate(async()=>{
      const path='/src/store/gameStore.ts';const {useGameStore}=await import(/* @vite-ignore */ path) as typeof import('../../src/store/gameStore');
      useGameStore.setState({weaponId:'varr-rededge',inventory:[...useGameStore.getState().inventory,'varr-rededge']});
    });
    await page.waitForFunction(()=>window.__firstPersonWeaponProbe?.visible&&window.__firstPersonWeaponProbe.key.startsWith('varr-rededge:'),null,{timeout:15000});
    await page.screenshot({path:`test-results/first-person-${touch?'touch':'desktop'}-equipped.png`});
    if(!touch){
      const skills=await page.evaluate(async()=>{
        const storePath='/src/store/gameStore.ts',planePath='/src/game/presentation25d/plane.ts';
        const {useGameStore}=await import(/* @vite-ignore */ storePath) as typeof import('../../src/store/gameStore');
        const {presentationView}=await import(/* @vite-ignore */ planePath) as typeof import('../../src/game/presentation25d/plane');
        const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene,p=s.player;
        s.scene.pause();p.resetInput();s.targeting.clear();p.stamina=10000;
        useGameStore.setState({level:60,skillSlots:['skyfall-slam','ember-cleave',null,null],learnedCombatArts:['ember-cleave'],
          storyFlags:{...useGameStore.getState().storyFlags,'breakthrough:accepted':true,'breakthrough:varkhul-defeated':true,'breakthrough:complete':true}});
        const cast=p.skills.tryCast('skyfall-slam');for(let i=0;i<6;i++)p.skills.update(50);
        return {cast,elevation:p.skills.presentationElevation,base:s.groundHeightAt(p.x,p.y)+p.presentationElevation,hidden:presentationView(s)!.actorDrawn?.(p.skills.weaponActor!)};
      });
      expect(skills.cast).toBe(true);expect(skills.elevation).toBeGreaterThan(30);expect(skills.hidden).toBe(false);
      await page.waitForTimeout(60);
      const height=await page.evaluate(async()=>{const path='/src/game/presentation25d/plane.ts';const {presentationView}=await import(/* @vite-ignore */ path) as typeof import('../../src/game/presentation25d/plane');return presentationView(window.__mernondnaGame!.scene.getScene('world'))!.camera.position.y;});
      expect(height-skills.base-skills.elevation).toBeCloseTo(60.8,1);
      const hidden=await page.evaluate(()=>{
        const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s.player.skills.cancelCast();s.targeting.clear();s.player.stamina=10000;
        return s.player.skills.tryCast('ember-cleave');
      });expect(hidden).toBe(true);
      await page.waitForFunction(()=>!window.__firstPersonWeaponProbe?.visible);
      expect((await page.evaluate(()=>window.__firstPersonWeaponProbe!)).rigVisible).toBe(false);
      await page.screenshot({path:'test-results/first-person-ember-cast.png'});
      await page.evaluate(()=>{const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s.player.skills.cancelCast();s.scene.resume();});
      await page.waitForFunction(()=>window.__firstPersonWeaponProbe?.visible);
      const base=await page.evaluate(async()=>{
        const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s.scene.pause();s.player.resetInput();
        const candidates=s.getCombatEnemies().flatMap(e=>[-128,-64,0,64,128].flatMap(dx=>[-128,-64,0,64,128].map(dy=>({x:e.x+dx,y:e.y+dy}))));
        const origin=candidates.find(p=>[-96,0,96,192].every(dx=>[-96,0,96].every(dy=>{
          const q={x:p.x+dx,y:p.y+dy};return s.safeSkillPosition(q)&&s.canTraverseGround(p,q)&&s.hasClearPath(p.x,p.y,q.x,q.y);
        })));
        if(!origin)throw new Error('No clear ground for first-person combat checks');
        const point={x:origin.x,y:origin.y};s.restoreOutsidePosition(point);
        const enemy=s.createStoryEnemy('road-bandit',{x:point.x+112,y:point.y},'first-person:target');enemy.hp=10000000;
        return point;
      });
      for(const id of ['azure-cleave','skyfall-slam','crown-rally','crescent-flurry','ember-cleave','iron-tempest','renewing-light','barrage'] as const){
        const started=await page.evaluate(async({id,base})=>{
          const path='/src/store/gameStore.ts';const {useGameStore}=await import(/* @vite-ignore */ path) as typeof import('../../src/store/gameStore');
          const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene,p=s.player;
          p.skills.cancelCast();s.restoreOutsidePosition(base);s.targeting.clear();
          s.targeting.selected=s.getCombatEnemies().find(e=>e.instanceId==='first-person:target')!;
          p.stamina=10000;p.skills['cooldowns'][id]=0;
          useGameStore.setState({skillSlots:[id,null,null,null],learnedCombatArts:['ember-cleave','iron-tempest','renewing-light']});
          const cast=p.skills.tryCast(id);return {cast,firstHit:p.skills.presentationCast?.skill.hitTimes[0]??0};
        },{id,base});
        expect(started.cast,id).toBe(true);
        await page.waitForTimeout(60);const before=await page.evaluate(()=>window.__firstPersonWeaponProbe!.pose);
        await page.evaluate(elapsed=>{
          const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
          for(let remaining=elapsed;remaining>0;){const dt=Math.min(50,remaining);s.player.skills.update(dt);remaining-=dt;}
        },started.firstHit+20);
        await page.waitForTimeout(60);const after=await page.evaluate(()=>window.__firstPersonWeaponProbe!);
        expect(after.rigVisible,id).toBe(id!=='ember-cleave');expect(after.models,id).toEqual(['first-person-equipped-sword']);
        expect(after.pose.reduce((sum,n,i)=>sum+Math.abs(n-before[i]),0),id+' moves the viewmodel').toBeGreaterThan(.1);
        if(['azure-cleave','skyfall-slam','iron-tempest'].includes(id))await page.screenshot({path:`test-results/first-person-${id}.png`});
        if(id==='skyfall-slam'||id==='iron-tempest'){
          const distance=await page.evaluate(()=>{const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene,e=s.getCombatEnemies().find(e=>e.instanceId==='first-person:target')!;return Math.hypot(s.player.x-e.x,s.player.y-e.y);});
          expect(distance,id+' keeps room around the target').toBeGreaterThan(75);
        }
      }
      const melee=await page.evaluate(async base=>{
        const input='/src/game/input.ts',plane='/src/game/presentation25d/plane.ts';
        const {mobileInput}=await import(/* @vite-ignore */ input) as typeof import('../../src/game/input');
        const {presentationView}=await import(/* @vite-ignore */ plane) as typeof import('../../src/game/presentation25d/plane');
        const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene,p=s.player;
        p.resetInput();s.restoreOutsidePosition(base);const view=presentationView(s)!,weapon=s.getEquippedWeapon();
        const enemy=s.getCombatEnemies().find(e=>e.instanceId==='first-person:target')!,dx=-Math.sin(view.yaw),dy=-Math.cos(view.yaw),gap=weapon.reach+34;
        const body=enemy.body as import('phaser').Physics.Arcade.Body;body.reset(p.x+dx*gap,p.y+dy*gap);
        s.targeting.clear();s.targeting.selected=enemy;p.stamina=10000;const before=enemy.hp;
        mobileInput.press('attack');p.updatePlayer(s.combatTime+1000,16);
        const pending=p['pendingBasicAttack'];if(!pending)throw new Error('First-person melee did not start');
        p.updatePlayer(pending.impactAt+1,16);
        const distance=Math.hypot(p.x-enemy.x,p.y-enemy.y),hit=enemy.hp<before;p.resetInput();
        for(const e of s.getCombatEnemies())e.clearTint();
        return {distance,hit,minimum:Math.min(88,(weapon.reach+24)*.92)};
      },base);
      expect(melee.hit).toBe(true);expect(melee.distance).toBeGreaterThanOrEqual(melee.minimum-.1);
      // Inspect a curved awakened silhouette as well as the straight starter
      // and normal boss blade; registration and the grip must survive the swap.
      await page.evaluate(async()=>{
        const path='/src/store/gameStore.ts';const {useGameStore}=await import(/* @vite-ignore */ path) as typeof import('../../src/store/gameStore');
        useGameStore.setState({weaponId:'varkhul-emberfang',awakenedWeapons:['varkhul-emberfang']});
      });
      await page.waitForFunction(()=>window.__firstPersonWeaponProbe?.visible&&window.__firstPersonWeaponProbe.key.startsWith('awakened:varkhul-emberfang:'),null,{timeout:15000});
      await page.screenshot({path:'test-results/first-person-awakened-and-melee-spacing.png'});
      await page.evaluate(()=>{const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s.player.skills.cancelCast();s.targeting.clear();s.scene.resume();});
      await page.waitForFunction(()=>window.__firstPersonWeaponProbe?.visible);
      // Capture is temporarily released by Alt, and must not resume if a menu
      // opened while the key was held.
      await page.getByRole('button',{name:/Mouse look/}).click();
      await page.waitForFunction(()=>document.pointerLockElement!==null);
      await page.keyboard.down('Alt');await page.waitForFunction(()=>document.pointerLockElement===null);
    }
    // Menus retain the chosen perspective, release capture and consume inputs.
    await page.evaluate(async()=>{const path='/src/store/gameStore.ts';const {useGameStore}=await import(/* @vite-ignore */ path) as typeof import('../../src/store/gameStore');useGameStore.setState({panel:'pause'});});
    if(!touch){await page.keyboard.up('Alt');expect(await page.evaluate(()=>document.pointerLockElement===null)).toBe(true);}
    await expect(page.getByRole('dialog',{name:'Game menu'})).toBeVisible();
    await page.getByLabel('First-person field of view',{exact:true}).fill('82');
    await page.getByRole('button',{name:'Resume',exact:true}).click();
    await page.waitForFunction(async()=>{
      const path='/src/game/presentation25d/plane.ts';const {presentationView}=await import(/* @vite-ignore */ path) as typeof import('../../src/game/presentation25d/plane');
      return presentationView(window.__mernondnaGame!.scene.getScene('world'))!.camera.fov===82;
    });
    await page.keyboard.press('v');
    await page.waitForFunction(()=>!window.__firstPersonWeaponProbe!.visible);
    const restored=await page.evaluate(async()=>{
      const path='/src/game/presentation25d/plane.ts';const {presentationView}=await import(/* @vite-ignore */ path) as typeof import('../../src/game/presentation25d/plane');
      const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene,v=presentationView(s)!;
      const form=s.children.getByName('awakened-hero');
      return {firstPerson:v.firstPerson,fov:v.camera.fov,selfDrawn:Boolean(v.actorDrawn?.(s.player)||form&&v.actorDrawn?.(form)),saved:JSON.parse(localStorage.getItem('leighneron:camera:v1')!)};
    });
    expect(restored).toMatchObject({firstPerson:false,fov:38,saved:{mode:'third-person',firstPersonFov:82}});expect(restored.selfDrawn).toBe(true);
    expect(errors).toEqual([]);
  }finally{await context.close();}
});
