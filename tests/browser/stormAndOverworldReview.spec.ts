import {test,expect} from '@playwright/test';
import type Phaser from 'phaser';
import type {WorldScene} from '../../src/game/scenes/WorldScene';
test.use({launchOptions:{args:['--use-angle=default']},trace:'off'});
test('warned storm strike, extended arts, worker parity and enlarged ship',async({browser})=>{
  test.setTimeout(240000);
  const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto('/?e2e');await page.getByRole('button',{name:'Start New Game',exact:true}).click();
    await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'),null,{timeout:120000});
    await page.getByRole('button',{name:/Skip scene/}).click();
    await page.waitForFunction(()=>!(window.__mernondnaGame!.scene.getScene('world') as WorldScene)['cinematicDirector'].active);
    await page.evaluate(()=>{
      const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s.scene.pause();
      s.registry.set('storm-review-origin',{x:s.player.x,y:s.player.y});
      const shop=s.children.list.find(o=>o.getData('presentation25d')?.house?.tradeSign==='tavern') as Phaser.GameObjects.Sprite|undefined;
      if(shop)s.restoreOutsidePosition({x:shop.x,y:shop.y+140});
    });
    await page.screenshot({path:'test-results/single-establishment-sign.png'});
    const storm=await page.evaluate(()=>{
      const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene,p=s.player;s.scene.pause();p.resetInput();
      s.restoreOutsidePosition(s.registry.get('storm-review-origin') as {x:number;y:number});
      const weather=s.presentationWeather,w=weather.presentation,hazard=s['storm'];
      Object.assign(w,{kind:'storm',strength:1,cloudCover:1});weather['kind']='storm';weather['strength']=1;
      hazard['remaining']=0;hazard.update(100,w,false);
      const strike=hazard['strike'];if(!strike)throw new Error('Storm failed to choose a legal exposed location');
      (p.body as Phaser.Physics.Arcade.Body).reset(strike.area.x,strike.area.y);p.hp=p.maxHp;p['invulnerableUntil']=0;
      const hp=p.hp;for(let t=100;t<1700;t+=100)hazard.update(100,w,false);
      const warned=hazard['warning'].graphics.visible&&p.hp===hp;
      hazard.update(100,w,false);const bolt=hazard.presentation.bolt;
      p.clearTint();
      return {warned,damaged:p.hp<hp,loss:hp-p.hp,bolt:bolt&&{x:bolt.x,y:bolt.y,height:bolt.height},radius:strike.area.radius};
    });
    expect(storm.warned).toBe(true);expect(storm.damaged).toBe(true);expect(storm.bolt?.height).toBeGreaterThan(1000);
    await page.waitForTimeout(250);
    await page.screenshot({path:'test-results/storm-blue-lightning.png'});
    const review=await page.evaluate(async()=>{
      const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene,p=s.player;
      const shipPath='/src/data/pirateFlagship.ts',artPath='/src/data/npcCombatArt.ts',prepPath='/src/game/systems/SpriteSubjectPreparation.ts',subjectsPath='/src/game/systems/spriteComponents.ts',storePath='/src/store/gameStore.ts';
      const ship=await import(/* @vite-ignore */ shipPath) as typeof import('../../src/data/pirateFlagship');
      const {NPC_COMBAT_ART}=await import(/* @vite-ignore */ artPath) as typeof import('../../src/data/npcCombatArt');
      const {prepareSpriteSubjects}=await import(/* @vite-ignore */ prepPath) as typeof import('../../src/game/systems/SpriteSubjectPreparation');
      const {actorSpriteSubjects,actorSpriteGridSubjects}=await import(/* @vite-ignore */ subjectsPath) as typeof import('../../src/game/systems/spriteComponents');
      const {useGameStore}=await import(/* @vite-ignore */ storePath) as typeof import('../../src/store/gameStore');
      s['storm'].clear();s.presentationWeather['kind']='clear';s.presentationWeather['strength']=0;
      Object.assign(s.presentationWeather.presentation,{kind:'clear',strength:0,cloudCover:0});
      // The worker must return exactly the existing whole-pose isolation.
      const spec=NPC_COMBAT_ART.find(a=>!a.eager)!,file=spec.sources[0],image=new Image();image.src='/'+file.path;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image,0,0);
      const expected=actorSpriteSubjects(ctx.getImageData(0,0,image.width,image.height).data,image.width,image.height,file.columns,file.rows,file.path);
      const Emitter=s.events.constructor as typeof Phaser.Events.EventEmitter,events=new Emitter();
      const owner={events} as unknown as Phaser.Scene,abort=new AbortController(),queuedAbort=new AbortController();
      const cancelled=prepareSpriteSubjects(owner,image,file.columns,file.rows,file.path,abort.signal).then(()=>false,e=>(e as Error).name==='AbortError');
      const queued=prepareSpriteSubjects(owner,image,file.columns,file.rows,file.path,queuedAbort.signal);abort.abort();
      const actual=await queued;
      const hash=(pixels:Uint8ClampedArray)=>{let n=2166136261;for(const v of pixels)n=Math.imul(n^v,16777619);return n>>>0;};
      const parity=actual.length===expected.length&&actual.every((a,i)=>JSON.stringify(a.region)===JSON.stringify(expected[i].region)&&hash(a.pixels)===hash(expected[i].pixels)&&JSON.stringify(a.foreignProbes)===JSON.stringify(expected[i].foreignProbes));
      const gridExpected=actorSpriteGridSubjects(ctx.getImageData(0,0,image.width,image.height).data,image.width,image.height,file.columns,file.rows,{keepDetachedDetails:true});
      const gridActual=await prepareSpriteSubjects(owner,image,file.columns,file.rows,file.path,new AbortController().signal,true);
      const gridParity=gridActual.length===gridExpected.length&&gridActual.every((a,i)=>JSON.stringify(a.region)===JSON.stringify(gridExpected[i].region)&&hash(a.pixels)===hash(gridExpected[i].pixels));
      const cancellation=await cancelled;events.emit('shutdown');
      // Reusing a restarted Scene must create a fresh worker owner.
      const restarted=await prepareSpriteSubjects(owner,image,file.columns,file.rows,file.path,new AbortController().signal);
      const restart=hash(restarted[0].pixels)===hash(expected[0].pixels);events.emit('shutdown');
      canvas.width=canvas.height=1;image.src='';
      // Both relocation arts can reach a genuinely clear target beyond their
      // previous 360/240-pixel activation gates, using actual world collision.
      useGameStore.setState({level:60,learnedCombatArts:['iron-tempest','ember-cleave'],skillSlots:['skyfall-slam','iron-tempest',null,null],
        storyFlags:{...useGameStore.getState().storyFlags,'breakthrough:accepted':true,'breakthrough:varkhul-defeated':true,'breakthrough:complete':true}});
      const enemy=s.getCombatEnemies().find(e=>e.active&&e.isAlive&&e.canBeTargeted)!;
      let from:{x:number;y:number}|undefined;
      for(let i=0;i<32;i++){
        const a=i*Math.PI/16,q={x:enemy.x+Math.cos(a)*430,y:enemy.y+Math.sin(a)*430};
        if(s.safeSkillPosition(q)&&s.canTraverseGround(q,enemy)&&s.hasClearPath(q.x,q.y,enemy.x,enemy.y)){from=q;break;}
      }
      if(!from)throw new Error('No clear long-range art approach');
      const casts=[];
      for(const id of ['skyfall-slam','iron-tempest'] as const){
        p.skills.cancelCast();p.skills['cooldowns'][id]=0;s.restoreOutsidePosition(from);s.targeting.clear();s.targeting.selected=enemy;p.stamina=10000;enemy.hp=100000;
        const started=p.skills.tryCast(id),before=Math.hypot(p.x-enemy.x,p.y-enemy.y);
        for(let t=0;t<600;t+=50)p.skills.update(50);
        casts.push({id,started,before,after:Math.hypot(p.x-enemy.x,p.y-enemy.y),safe:s.safeSkillPosition(p)});
      }
      p.skills.cancelCast();p.resetInput();
      const area=(scale:number)=>Math.abs(ship.FLAGSHIP_DECK.reduce((sum,a,i)=>{const b=ship.FLAGSHIP_DECK[(i+1)%ship.FLAGSHIP_DECK.length];return sum+a.x*b.y-b.x*a.y;},0))/2*scale*scale;
      // Check saved old deck and plank coordinates against the expanded ship.
      const oldLeft={x:ship.FLAGSHIP.topLeft.x+410*(ship.FLAGSHIP.scale-1.3),y:ship.FLAGSHIP.topLeft.y+720*(ship.FLAGSHIP.scale-1.3)};
      const savedDeck=ship.FLAGSHIP_DECK.every(a=>ship.onFlagshipBoarding(oldLeft.x+a.x*1.3,oldLeft.y+a.y*1.3));
      const savedPlank=[600,800,990].every(x=>[781,807,833].every(y=>ship.onFlagshipBoarding(oldLeft.x+x*1.3,oldLeft.y+y*1.3)));
      return {parity,gridParity,cancellation,restart,casts,areaRatio:area(ship.FLAGSHIP.scale)/area(1.3),savedDeck,savedPlank};
    });
    console.log(JSON.stringify(review));expect(review.parity).toBe(true);expect(review.gridParity).toBe(true);expect(review.cancellation).toBe(true);expect(review.restart).toBe(true);
    for(const cast of review.casts){expect(cast.started,cast.id).toBe(true);expect(cast.after,cast.id).toBeLessThan(90);expect(cast.safe).toBe(true);}
    expect(review.areaRatio).toBeGreaterThan(2);expect(review.savedDeck).toBe(true);expect(review.savedPlank).toBe(true);
    await page.evaluate(async()=>{
      const path='/src/data/pirateFlagship.ts';const {shipPoint}=await import(/* @vite-ignore */ path) as typeof import('../../src/data/pirateFlagship');
      const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s.scene.resume();
      const point=shipPoint(410,860);s.landFromPassage(point,true);s.coverWorldArrival(point);
    });
    await page.waitForFunction(()=>{
      const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;return !s['arrivalView']&&!s['screenTransition'].active;
    },null,{timeout:90000});
    await page.evaluate(()=>{const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s.scene.pause();s.player.resetInput();});
    await page.mouse.move(650,400);await page.mouse.wheel(0,650);await page.waitForTimeout(500);
    await page.screenshot({path:'test-results/expanded-salt-king-deck.png'});
    const boats=await page.evaluate(()=>{
      const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s['traffic'].update(0);
      return [...s['traffic']['active'].keys()].filter(id=>id.startsWith('boat:')).length;
    });expect(boats).toBeLessThanOrEqual(3);expect(errors).toEqual([]);
  }finally{await context.close();}
});
