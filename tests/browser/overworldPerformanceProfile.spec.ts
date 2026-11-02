import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import type {WorldScene} from '../../src/game/scenes/WorldScene';

interface CpuProfile {nodes:Array<{id:number;callFrame:{functionName:string;url:string;lineNumber:number}}>;
  samples?:number[];timeDeltas?:number[]}
test.use({launchOptions:{args:['--use-angle=default']},trace:'off'});
test('profile real overworld travel, mob combat and boss combat',async({browser})=>{
  test.setTimeout(240000);
  const width=Number(process.env.LEIGHNERON_PERF_WIDTH??1280),height=Number(process.env.LEIGHNERON_PERF_HEIGHT??800);
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const cdp=await context.newCDPSession(page),reports=[];
  try{
    await page.addInitScript(()=>localStorage.setItem('leighneron:2.5d-frame-times','1'));
    await page.goto('/?e2e');await page.getByRole('button',{name:'Start New Game',exact:true}).click();
    await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'),null,{timeout:120000});
    await page.getByRole('button',{name:/Skip scene/}).click();
    await page.waitForFunction(()=>!(window.__mernondnaGame!.scene.getScene('world') as WorldScene)['cinematicDirector'].active);
    await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:2000});
    for(const phase of ['idle','travel','mobs','boss','storm'] as const){
      await cdp.send('Profiler.start');
      const metrics=await page.evaluate(async phase=>{
        const inputPath='/src/game/input.ts',storePath='/src/store/gameStore.ts';
        const {mobileInput}=await import(/* @vite-ignore */ inputPath) as typeof import('../../src/game/input');
        const {useGameStore}=await import(/* @vite-ignore */ storePath) as typeof import('../../src/store/gameStore');
        const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene,p=s.player;
        p.resetInput();const owned:ReturnType<WorldScene['createStoryEnemy']>[]=[];
        if(phase==='storm'){
          const weather=s.presentationWeather;weather['kind']=weather['target']='storm';weather['strength']=1;
          weather['thunderRemaining']=0;
        }
        if(phase==='mobs'||phase==='boss'){
          const target=s.getCombatEnemies().find(e=>e.active&&e.isAlive&&s.isEnemyTerritory(e.x,e.y)
            &&s.safeSkillPosition({x:e.x-72,y:e.y})&&s.hasClearPath(e.x-72,e.y,e.x,e.y));
          // The mob workload can kill or stream out the natural enemy used
          // to locate its clearing. Reuse that real, validated clearing for
          // the boss rather than depending on another survivor being loaded.
          const origin=target?{x:target.x-72,y:target.y}:s.registry.get('perf-combat-origin') as {x:number;y:number}|undefined;
          if(!origin||!s.safeSkillPosition(origin)||!s.isEnemyTerritory(origin.x,origin.y))throw new Error('No reachable wilderness combat clearing');
          s.registry.set('perf-combat-origin',origin);s.restoreOutsidePosition(origin);
          for(let i=0;i<(phase==='boss'?1:10);i++){
            const angle=i*Math.PI*2/10,point={x:p.x+Math.cos(angle)*100,y:p.y+Math.sin(angle)*100};
            if(!s.safeSkillPosition(point)||!s.hasClearPath(p.x,p.y,point.x,point.y))continue;
            const enemy=s.createStoryEnemy(phase==='boss'?'bandit-captain':'road-bandit',point,phase==='boss'?'boss:captain-varr':'perf-review:'+i);
            enemy.hp=10000;owned.push(enemy);
          }
          if(!owned.length)throw new Error('No safe combat fixture positions');
          s.targeting.select(owned[0]);
        }
        const frames:number[]=[],simulation:number[]=[],snapshots:unknown[]=[];
        const start=performance.now(),origin={x:p.x,y:p.y};let last=start,lastSnapshot=0,lastSkill=-5000;
        try{
          await new Promise<void>(resolve=>{
            const frame=(now:number)=>{
              const elapsed=now-start;frames.push(now-last);last=now;
              const sim=s.registry.get('simulationCpuMs') as number|undefined;if(sim!==undefined)simulation.push(sim);
              if(elapsed-lastSnapshot>1000){lastSnapshot=elapsed;snapshots.push(s.registry.get('presentationPerf'));}
              if(phase==='travel'){
                const leg=Math.floor(elapsed/3500)%4;
                mobileInput.setMove(leg===1?1:leg===3?-1:0,leg===0?-1:leg===2?1:0);mobileInput.setSprint(true);
              }else if(phase==='storm'){p.hp=p.maxHp;
              }else if(phase==='mobs'||phase==='boss'){
                p.hp=p.maxHp;p.stamina=p.maxStamina;mobileInput.setAttackHeld(true);
                if(elapsed-lastSkill>4800){lastSkill=elapsed;mobileInput.press('skill1');}
              }
              if(elapsed<(phase==='travel'?14000:9000))requestAnimationFrame(frame);else resolve();
            };requestAnimationFrame(frame);
          });
          const summarize=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b),n=sorted.length;
            return {n,p50:sorted[Math.floor(n*.5)],p95:sorted[Math.floor(n*.95)],p99:sorted[Math.min(n-1,Math.floor(n*.99))],max:sorted[n-1],over33:sorted.filter(v=>v>33.34).length,over50:sorted.filter(v=>v>50).length};};
          return {frames:summarize(frames),simulation:summarize(simulation),snapshots,spawned:owned.length,viewport:{width:s.scale.width,height:s.scale.height},
            displacement:Math.hypot(p.x-origin.x,p.y-origin.y),actors:s.getCombatEnemies().length,children:s.children.length,
            graphics:useGameStore.getState().minuteOfDay};
        }finally{p.resetInput();for(const enemy of owned)if(enemy.active)s.releaseStoryEnemy(enemy);}
      },phase);
      const {profile}=await cdp.send('Profiler.stop') as {profile:CpuProfile};
      const costs=new Map<number,number>();
      for(let i=0;i<(profile.samples?.length??0);i++){const id=profile.samples![i];costs.set(id,(costs.get(id)??0)+(profile.timeDeltas?.[i]??2000)/1000);}
      const top=profile.nodes.map(n=>({name:n.callFrame.functionName,url:n.callFrame.url,line:n.callFrame.lineNumber+1,ms:costs.get(n.id)??0}))
        .sort((a,b)=>b.ms-a.ms).slice(0,35);
      reports.push({phase,...metrics,top});
      await writeFile(`.asset-review/perf-${process.env.LEIGHNERON_PERF_LABEL??'review'}.json`,JSON.stringify(reports,null,2));
      console.log(JSON.stringify({phase,frames:metrics.frames,simulation:metrics.simulation,spawned:metrics.spawned,top:top.slice(0,8)}));
      await page.screenshot({path:`test-results/perf-${phase}.png`});
    }
    await writeFile(`.asset-review/perf-${process.env.LEIGHNERON_PERF_LABEL??'review'}.json`,JSON.stringify(reports,null,2));
    expect(errors).toEqual([]);
  }finally{await cdp.detach().catch(()=>{});await context.close();}
});
