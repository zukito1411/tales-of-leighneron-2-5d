import {expect,test} from '@playwright/test';
import type Phaser from 'phaser';
import type {WorldScene} from '../../src/game/scenes/WorldScene';
import type {PresentationHint} from '../../src/game/presentation25d/plane';

test.use({launchOptions:{args:['--use-angle=default']},trace:'off'});
test('targeted ground arts, snare lifetime and buffered sweeping melee in the actual world',async({browser})=>{
  test.setTimeout(180000);
  const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto('/?e2e');await page.getByRole('button',{name:'Start New Game',exact:true}).click();
    await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'),null,{timeout:120000});
    await page.getByRole('button',{name:/Skip scene/}).click();
    await page.waitForFunction(()=>!(window.__mernondnaGame!.scene.getScene('world') as WorldScene)['cinematicDirector'].active);
    const setup=await page.evaluate(async()=>{
      const path='/src/store/gameStore.ts';
      const {useGameStore}=await import(/* @vite-ignore */ path) as typeof import('../../src/store/gameStore');
      const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
      s.scene.pause();s.player.resetInput();
      useGameStore.setState({level:60,skillSlots:['skyfall-slam','ember-cleave',null,null],learnedCombatArts:['ember-cleave'],
        storyFlags:{...useGameStore.getState().storyFlags,'breakthrough:accepted':true,'breakthrough:varkhul-defeated':true,'breakthrough:complete':true},panel:null,dialogue:null});
      const origin=s.getCombatEnemies().flatMap(e=>[e,{x:e.x-96,y:e.y},{x:e.x,y:e.y-96}]).find(p=>
        [-64,0,64,128,192].every(dx=>[-48,0,48].every(dy=>{
          const q={x:p.x+dx,y:p.y+dy};return s.safeSkillPosition(q)&&s.canTraverseGround(p,q)&&s.hasClearPath(p.x,p.y,q.x,q.y);
        })));
      if(!origin)throw new Error('No open ground for the focused combat check');
      const base={x:origin.x,y:origin.y};s.restoreOutsidePosition(base);
      const a=s.createStoryEnemy('road-bandit',{x:base.x+112,y:base.y},'combat-review:target');
      const b=s.createStoryEnemy('road-bandit',{x:base.x+48,y:base.y},'combat-review:nearer');
      const c=s.createStoryEnemy('road-bandit',{x:base.x+160,y:base.y+40},'combat-review:entrant');
      for(const e of [a,b,c]){e.hp=1000000;e.setVisible(true);}
      s.targeting.clear();s.targeting.selected=a;s.player.stamina=10000;
      if(!s.player.skills.tryCast('skyfall-slam'))throw new Error('Slam failed to cast');
      const body=a.body as Phaser.Physics.Arcade.Body;body.reset(base.x+144,base.y+24);
      for(let elapsed=0;elapsed<550;elapsed+=50)s.player.skills.update(50);
      const target={x:a.x,y:a.y};s.player.skills.update(50);
      const cast=s.player.skills['cast']!;
      const mark=cast.mark!;
      const slam={mark,target,landing:{x:s.player.x,y:s.player.y},targetDamaged:a.hp<1000000,
        safe:s.safeSkillPosition(s.player),selected:s.targeting.selected?.instanceId};
      s.player.skills.cancelCast();s.restoreOutsidePosition(base);s.targeting.clear();s.targeting.selected=a;
      s.player.stamina=10000;
      if(!s.player.skills.tryCast('ember-cleave'))throw new Error('Ember failed to cast');
      body.reset(base.x+128,base.y-16);
      (b.body as Phaser.Physics.Arcade.Body).reset(base.x+104,base.y+20);
      (c.body as Phaser.Physics.Arcade.Body).reset(base.x-64,base.y);
      for(let elapsed=0;elapsed<600;elapsed+=50)s.player.skills.update(50);
      const field=s.children.getByName('ember-snare-field') as Phaser.GameObjects.Sprite;
      const before={x:a.x,y:a.y};
      a.updateEnemy(s.time.now,16);s.physics.world.step(.05);s.physics.world.postUpdate();
      const blockedKnockback=!s.tryImpactKnockback(a,{x:1,y:0},12);
      const roots={a:a.isRooted,b:b.isRooted,c:c.isRooted,moves:body.moves,positionHeld:Math.hypot(a.x-before.x,a.y-before.y)<.01,
        blockedKnockback,field:{x:field.x,y:field.y},target:{x:a.x,y:a.y},
        visualKind:(s.children.getByName('ember-root:'+a.instanceId)?.getData('presentation25d') as PresentationHint|undefined)?.combat?.kind};
      // Freeze a representative authored effect frame for the rendered check.
      for(const object of s.children.list)if(object.name.startsWith('ember-')){
        const sprite=object as Phaser.GameObjects.Sprite,frames=sprite.anims.currentAnim?.frames;
        if(frames)sprite.anims.pause(frames[Math.min(2,frames.length-1)]);
      }
      for(const enemy of s.getCombatEnemies())enemy.clearTint();
      return {base,slam,roots};
    });
    expect(setup.slam.mark).toEqual(setup.slam.target);expect(setup.slam.safe).toBe(true);expect(setup.slam.targetDamaged).toBe(true);
    expect(setup.slam.selected).toBe('combat-review:target');
    expect(setup.roots).toMatchObject({a:true,b:true,c:false,moves:false,positionHeld:true,blockedKnockback:true});
    expect(setup.roots.field).toEqual(setup.roots.target);expect(setup.roots.visualKind).toBe('eruption');
    await page.screenshot({path:'test-results/combat-ember-root.png'});
    const report=await page.evaluate(async({base})=>{
      const inputPath='/src/game/input.ts',comboPath='/src/data/basicAttackCombo.ts';
      const {mobileInput}=await import(/* @vite-ignore */ inputPath) as typeof import('../../src/game/input');
      const {BASIC_ATTACK_CHAIN}=await import(/* @vite-ignore */ comboPath) as typeof import('../../src/data/basicAttackCombo');
      const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene,p=s.player,skills=p.skills;
      const [a,b,c]=['target','nearer','entrant'].map(id=>s.getCombatEnemies().find(e=>e.instanceId==='combat-review:'+id)!);
      const move=(e:typeof a,x:number,y:number)=>(e.body as Phaser.Physics.Arcade.Body).reset(x,y);
      move(c,a.x+30,a.y);skills.update(50);const entrant=c.isRooted;
      let pulses=0;const apply=s.applySkillDamage;
      s.applySkillDamage=function(enemy,...args){if(enemy===a)pulses++;return apply.call(this,enemy,...args);};
      for(let t=50;t<2550;t+=50)skills.update(50);
      const heldUntilEnd=a.isRooted;skills.update(50);
      s.applySkillDamage=apply;
      const released=!a.isRooted&&!b.isRooted&&!c.isRooted&&(a.body as Phaser.Physics.Arcade.Body).moves;
      const noRootVisuals=!s.children.list.some(o=>o.name.startsWith('ember-root:'));
      // Cancelling an owned field must release roots immediately, too.
      skills['cooldowns']['ember-cleave']=0;s.restoreOutsidePosition(base);s.targeting.selected=a;p.stamina=10000;
      skills.tryCast('ember-cleave');for(let t=0;t<600;t+=50)skills.update(50);
      const recaptured=a.isRooted;skills.cancelCast();const cancelled=!a.isRooted;
      // Explicit out-of-range locks fail before spending stamina/cooldown.
      s.targeting.clear();s.targeting.select(a);move(a,base.x+500,base.y);
      skills['cooldowns']['skyfall-slam']=0;const stamina=p.stamina;
      const rejected=!skills.tryCast('skyfall-slam')&&p.stamina===stamina&&skills.snapshot().cooldowns['skyfall-slam']===0;
      s.targeting.clear();p.resetInput();s.restoreOutsidePosition(base);p.stamina=10000;
      move(a,base.x+42,base.y);move(b,base.x+40,base.y+16);move(c,base.x-50,base.y);
      const source={},health=[a.hp,b.hp,c.hp];for(const e of [a,b,c])e.setRooted(source,true);
      p.lastDirection.set(1,0);s.targeting.selected=a;
      let now=s.time.now+1000;p['nextAttackAt']=0;
      mobileInput.press('attack');p.updatePlayer(now,8);
      const first=p['pendingBasicAttack']!;
      for(now+=8;now<first.activeUntil+16;now+=8)p.updatePlayer(now,8);
      const losses=[a.hp,b.hp,c.hp].map((hp,i)=>health[i]-hp),hitCount=first.hitIds.size;
      // Re-running contact during the active window cannot multiply damage.
      const after=a.hp;s.performPlayerAttack(p,first.direction,first.weapon,first.step,first.hitIds);
      const oneHit=a.hp===after;
      mobileInput.press('attack');p.updatePlayer(first.endsAt-40,8);
      p.updatePlayer(first.endsAt+1,8);const buffered=p['pendingBasicAttack']?.step===BASIC_ATTACK_CHAIN[1];
      const lunge=p.x>base.x&&p.x-base.x<=BASIC_ATTACK_CHAIN[0].lungeDistance+.01;
      // Dodge before the buffered return slash lands: no delayed damage survives.
      const beforeDodge=a.hp;mobileInput.press('dash');p.updatePlayer(first.endsAt+9,8);
      p.updatePlayer(first.endsAt+500,8);const dodgeCancelled=!p['pendingBasicAttack']&&a.hp===beforeDodge;
      for(const e of [a,b,c])e.setRooted(source,false);
      // A blocked first step grants no forward movement or tunnelling.
      const traverse=s.canTraverseGround;s.canTraverseGround=()=>false;
      const position={x:p.x,y:p.y};const travel=s.movePlayerCombatToward({x:p.x+100,y:p.y},100);s.canTraverseGround=traverse;
      const blocked=travel===0&&p.x===position.x&&p.y===position.y;
      const holds=[];const playSwing=s.playSwordSwing;
      for(const input of ['keyboard','touch'] as const){
        p.resetInput();s.restoreOutsidePosition(base);p['nextAttackAt']=0;p.lastDirection.set(1,0);s.targeting.selected=a;
        const names:string[]=[];s.playSwordSwing=function(step){names.push(step?.name??'Slash');playSwing.call(this,step);};
        p['keys'].attack.isDown=input==='keyboard';mobileInput.setAttackHeld(input==='touch');
        let stamp=now+5000,frames=0;
        while(names.length<3&&frames++<400){p.updatePlayer(stamp,8);stamp+=8;}
        if(names.length!==3)throw new Error('Held '+input+' input failed to reach the finisher');
        const heavy=p['pendingBasicAttack']!;p['keys'].attack.isDown=false;mobileInput.setAttackHeld(false);
        p.updatePlayer(heavy.endsAt+1,8);
        holds.push({input,names,stopped:p['pendingBasicAttack']===null});
        now=stamp;
      }
      s.playSwordSwing=playSwing;
      // A combat art can cancel basic recovery, retaining the hidden base sprite.
      p.resetInput();p['nextAttackAt']=0;mobileInput.press('attack');p.updatePlayer(now+5000,8);
      const recovery=p['pendingBasicAttack']!;
      const messages:string[]=[],notify=s.notify;s.notify=function(message){messages.push(message);};
      skills['cooldowns']['skyfall-slam']=0;p.stamina=0;
      mobileInput.press('skill1');p.updatePlayer(recovery.activeUntil+1,8);
      const failedSkillPreservedSwing=!skills.isCasting&&p['pendingBasicAttack']===recovery&&messages.some(m=>m.includes('stamina'));
      p.stamina=p.maxStamina;mobileInput.press('skill1');p.updatePlayer(recovery.activeUntil+9,8);
      const skillCancel=skills.isCasting&&!p['pendingBasicAttack']&&p.alpha===0;
      s.notify=notify;
      p.resetInput();skills.cancelCast();
      for(const e of [a,b,c])s.releaseStoryEnemy(e);
      return {entrant,pulses,heldUntilEnd,released,noRootVisuals,recaptured,cancelled,rejected,losses,hitCount,oneHit,buffered,lunge,dodgeCancelled,blocked,holds,skillCancel,failedSkillPreservedSwing};
    },setup);
    console.log(JSON.stringify(report));
    expect(report).toMatchObject({entrant:true,pulses:3,heldUntilEnd:true,released:true,noRootVisuals:true,recaptured:true,cancelled:true,rejected:true,
      hitCount:2,oneHit:true,buffered:true,lunge:true,dodgeCancelled:true,blocked:true,skillCancel:true,failedSkillPreservedSwing:true});
    expect(report.holds).toEqual([
      {input:'keyboard',names:['Slash','Return slash','Heavy cleave'],stopped:true},
      {input:'touch',names:['Slash','Return slash','Heavy cleave'],stopped:true},
    ]);
    expect(report.losses[0]).toBeGreaterThan(0);expect(report.losses[1]).toBeGreaterThan(0);expect(report.losses[2]).toBe(0);
    expect(errors).toEqual([]);
  }finally{await context.close();}
});
