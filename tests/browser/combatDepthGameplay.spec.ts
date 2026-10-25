import {expect,test} from '@playwright/test';
import type Phaser from 'phaser';
import type {WorldScene} from '../../src/game/scenes/WorldScene';
import type {ActiveSkillId} from '../../src/data/activeSkills';
import type {PresentationHint} from '../../src/game/presentation25d/plane';

test.use({launchOptions:{args:['--use-angle=default']},trace:'off'});
test('actual player arts retain sprite poses, world effects and cancellation cleanup',async({browser})=>{
  test.setTimeout(180000);
  const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(/INVALID|feedback loop|too many errors|Shader Error/i.test(m.text()))errors.push(m.text());});
  try{
    await page.goto('/?e2e');await page.getByRole('button',{name:'Start New Game',exact:true}).click();
    await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'),null,{timeout:120000});
    const skip=page.getByRole('button',{name:/Skip scene/});await expect(skip).toBeVisible({timeout:30000});await skip.click();
    await page.waitForFunction(()=>!(window.__mernondnaGame!.scene.getScene('world') as WorldScene)['cinematicDirector'].active);
    const target=await page.evaluate(()=>{
      const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
      const enemies=s.getCombatEnemies().filter(e=>e.active&&e.isAlive&&e.canBeTargeted&&e.visible);
      for(const enemy of enemies)for(const dx of [-70,70]){
        const p={x:enemy.x+dx,y:enemy.y};
        if(s.safeSkillPosition(p)&&s.hasClearPath(p.x,p.y,enemy.x,enemy.y)){
          s.restoreOutsidePosition(p);s.targeting.select(enemy);s.scene.pause();enemy.hp=1000000;
          return enemy.instanceId;
        }
      }
      throw new Error('No reachable combat review target in the loaded region');
    });
    const ids:ActiveSkillId[]=['azure-cleave','skyfall-slam','crown-rally','crescent-flurry','ember-cleave','iron-tempest','renewing-light','barrage'];
    const reports=[];
    for(const id of ids){
      const report=await page.evaluate(async({id,target})=>{
        const path='/src/store/gameStore.ts';
        const {useGameStore}=await import(/* @vite-ignore */ path) as typeof import('../../src/store/gameStore');
        const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene,skills=s.player.skills;
        skills.cancelCast();
        const enemy=s.getCombatEnemies().find(e=>e.instanceId===target)!;enemy.hp=1000000;
        const p=s.skillLanding({x:enemy.x-70,y:enemy.y},200);s.restoreOutsidePosition(p);
        s.targeting.select(enemy);s.player.lastDirection.set(1,0);s.player.stamina=10000;s.player.hp=s.player.maxHp;
        useGameStore.setState({level:60,skillSlots:[id,null,null,null],learnedCombatArts:['ember-cleave','iron-tempest','renewing-light'],storyFlags:{...useGameStore.getState().storyFlags,'breakthrough:accepted':true,'breakthrough:varkhul-defeated':true,'breakthrough:complete':true},panel:null,dialogue:null});
        const cast=skills.tryCast(id),poses:string[]=[],kinds=new Set<string>();
        const read=()=>{
          for(const object of s.children.list){
            const hint=object.getData('presentation25d') as PresentationHint|undefined;
            if(hint?.combat)kinds.add(hint.combat.kind);
          }
          const pose=s.children.getByName('player-skill:'+id) as Phaser.GameObjects.Sprite|null;
          if(pose&&!poses.includes(pose.texture.key))poses.push(pose.texture.key);
          return pose?.getData('presentation25d') as PresentationHint|undefined;
        };
        let poseHint=read();
        // Advance the actual active-play skill clock while AI/physics is paused.
        // This leaves every release and hit deterministic for visual inspection.
        const release=id==='azure-cleave'||id==='crown-rally'||id==='renewing-light'?300:id==='crescent-flurry'||id==='barrage'?200:id==='iron-tempest'?550:650;
        for(let time=0;time<release;time+=50){skills.update(50);poseHint=read()??poseHint;}
        let waveMotion:{dx:number;dy:number;forward:number;cross:number;time:number}|null=null;
        if(id==='azure-cleave'){
          const wave=s.children.getByName('azure-cleave-wave') as Phaser.GameObjects.Sprite;
          const d=(wave.getData('presentation25d') as PresentationHint).combat!.direction,x=wave.x,y=wave.y;
          skills.update(5);const dx=wave.x-x,dy=wave.y-y;
          waveMotion={dx,dy,forward:dx*d.x+dy*d.y,cross:dx*d.y-dy*d.x,time:(wave.getData('presentation25d') as PresentationHint).combat!.time!};
        }
        const rushAdvance=s.children.list.map(o=>o.getData('presentation25d') as PresentationHint|undefined)
          .filter(h=>h?.anchor===s.player&&h.combat?.kind==='impact').map(h=>h!.combat!.advance);
        return {id,cast,kinds:[...kinds],poses,poseIsSprite:poseHint?.plane==='upright'&&!poseHint.combat,hp:enemy.hp,waveMotion,rushAdvance};
      },{id,target});
      reports.push(report);expect(report.cast,JSON.stringify(report)).toBe(true);expect(report.poseIsSprite).toBe(true);
      const expected=id==='azure-cleave'?'wave':id==='skyfall-slam'?'burst':id==='crescent-flurry'||id==='barrage'?'slash':id==='ember-cleave'?'eruption':id==='iron-tempest'?'thrust':'aura';
      expect(report.kinds).toContain(expected);
      if(id==='azure-cleave'){expect(report.waveMotion!.forward).toBeGreaterThan(1);expect(report.waveMotion!.cross).toBeCloseTo(0,5);expect(report.waveMotion!.time).toBeCloseTo(.005,5);}
      if(id==='iron-tempest')expect(report.rushAdvance).toContain(36);
      await page.evaluate(id=>{
        const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
        // Inspect the painted middle phase as well as the release timing above.
        // Scene pause freezes both animation and hit-flash timers for this review.
        for(const object of s.children.list){
          if(object instanceof Object&&'anims' in object){
            const sprite=object as Phaser.GameObjects.Sprite,frames=sprite.anims.currentAnim?.frames;
            if(frames&&((sprite.getData('presentation25d') as PresentationHint|undefined)?.combat||sprite.name==='player-skill:'+id))sprite.anims.pause(frames[Math.min(2,frames.length-1)]);
          }
        }
        for(const enemy of s.getCombatEnemies())enemy.clearTint();
      },id);
      await page.waitForTimeout(120);await page.screenshot({path:`test-results/combat-gameplay-${id}.png`});
      if(id==='azure-cleave')expect(await page.evaluate(()=>{
        const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
        return (s.children.getByName('azure-cleave-wave')!.getData('presentation25d') as PresentationHint).combat!.time;
      })).toBe(report.waveMotion!.time);
      const cleanup=await page.evaluate(()=>{
        const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s.player.skills.cancelCast();
        // Hit flashes belong to the struck actor, independently of the cast.
        // Their animation clock is deliberately paused along with the scene.
        const owned=s.children.list.filter(o=>(o.getData('presentation25d') as PresentationHint|undefined)?.combat&&!o.name.startsWith('combat-effect:'));
        for(const object of [...s.children.list])if(object.name.startsWith('combat-effect:'))object.destroy();
        return {alpha:s.player.alpha,casting:s.player.skills.snapshot().casting,effects:owned.length};
      });
      expect(cleanup).toEqual({alpha:1,casting:null,effects:0});
    }
    console.log(JSON.stringify(reports));expect(errors).toEqual([]);
  }finally{await context.close();}
});
