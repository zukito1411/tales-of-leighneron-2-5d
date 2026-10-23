import {test,expect} from '@playwright/test';
import type Phaser from 'phaser';
import type {WorldScene} from '../../src/game/scenes/WorldScene';
import type {Npc} from '../../src/game/entities/Npc';
import type {Vec2} from '../../src/game/types';
test('guard schedule destinations and the escort kitchen have usable street routes',async({page})=>{
 test.setTimeout(150000);await page.goto('/?e2e');await page.getByRole('button',{name:'Start New Game',exact:true}).click();
 await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'),null,{timeout:45000});
 const failures=await page.evaluate(async()=>{
  const np='/src/data/npcs.ts',pp='/src/data/npcPositions.ts',mp='/src/game/systems/npcPlacement.ts',rp='/src/game/systems/npcRoutes.ts',tp='/src/data/towns.ts';
  const {NPCS}=await import(np),{NPC_POSITIONS,npcWorldPosition,npcEscortArrival}=await import(pp),{npcMayPatrol}=await import(mp),{npcStreetRoute}=await import(rp),{TOWN_BY_ID}=await import(tp);
  const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s.scene.pause();s.physics.world.pause();const failures:string[]=[];
  for(const npc of NPCS.filter(npcMayPatrol)){
   const town=TOWN_BY_ID[npc.townId],entry=NPC_POSITIONS[npc.id],world=(p:{x:number;y:number})=>({x:p.x+town.world.x,y:p.y+town.world.y});
   const destinations=npc.formation?[entry.home]:entry.schedule;
   for(const to of destinations){
    const from=entry.position,a=world(from),b=world(to);s.player.restoreAt(a.x+400,a.y+400);s.streamCinematicView((a.x+b.x)/2,(a.y+b.y)/2);
    const route=npcStreetRoute(npc.townId,from,to,(p:Vec2,q:Vec2)=>s.canNpcVisit(world(p),world(q)));
    if(!route.length)failures.push(npc.id+' cannot reach '+JSON.stringify(to));
   }
  }
  const npc=NPCS.find((n:{id:string})=>n.id==='tovin-reed'),town=TOWN_BY_ID.highmere,a=npcWorldPosition(npc),b=npcEscortArrival();
  s.streamCinematicView((a.x+b.x)/2,(a.y+b.y)/2);
  const local=(p:{x:number;y:number})=>({x:p.x-town.world.x,y:p.y-town.world.y}),world=(p:{x:number;y:number})=>({x:p.x+town.world.x,y:p.y+town.world.y});
  if(!npcStreetRoute('highmere',local(a),local(b),(p:Vec2,q:Vec2)=>s.canNpcVisit(world(p),world(q))).length)failures.push('escort kitchen unreachable');
  return failures;
 });
 expect(failures).toEqual([]);
});
test('western guard file can complete its circuit without stationary residents blocking it',async({page})=>{
 test.setTimeout(120000);await page.goto('/?e2e');await page.getByRole('button',{name:'Start New Game',exact:true}).click();
 await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'),null,{timeout:45000});
 const result=await page.evaluate(async()=>{
  const tp='/src/data/towns.ts',{TOWN_BY_ID}=await import(tp),town=TOWN_BY_ID.highmere;
  const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s.scene.pause();s.activePlayMs=0;
  s.player.restoreAt(town.world.x+100,town.world.y+1400);s.streamCinematicView(town.world.x-1600,town.world.y+325);
  const guards=(s as unknown as {npcs:Npc[]}).npcs.filter(n=>n.active&&n.definition.formation),distance=new Map(guards.map(g=>[g.definition.id,0]));
  s.physics.world.resume();
  for(let step=1;step<=3600;step++){
   const positions=guards.map(g=>({x:g.x,y:g.y}));s.activePlayMs=step*1000/30;
   for(const g of guards)g.updatePatrol(s.time.now+step*1000/30,1000/30);
   s.physics.world.step(1/30);s.physics.world.postUpdate();
   guards.forEach((g,i)=>distance.set(g.definition.id,distance.get(g.definition.id)!+Math.hypot(g.x-positions[i].x,g.y-positions[i].y)));
  }
  s.physics.world.pause();return {guards:guards.length,distance:Object.fromEntries(distance)};
 });
 expect(result.guards).toBe(6);for(const [id,distance] of Object.entries(result.distance))expect(distance,id+' completes the circuit').toBeGreaterThan(4100);
});
test('every resident streams into a clear court and the shrine residents stay separate',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?e2e');await page.getByRole('button',{name:'Start New Game',exact:true}).click();
 await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'),null,{timeout:45000});
 const audit=await page.evaluate(async()=>{
  const np='/src/data/npcs.ts',pp='/src/data/npcPositions.ts',sp='/src/store/gameStore.ts',placement='/src/game/systems/npcPlacement.ts';
  const {NPCS}=await import(np),{npcWorldPosition}=await import(pp),{useGameStore}=await import(sp);
  const {npcStandingOffRoad,npcMayPatrol}=await import(placement);
  const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
  useGameStore.getState().openPanel('pause');s.physics.world.pause();
  const r=s as unknown as {npcs:Npc[];isBlockedByBuilding(x:number,y:number):boolean;isNpcObscured(x:number,y:number):boolean};
  const missing:string[]=[],blocked:string[]=[],overlap:string[]=[],roads:string[]=[],positions:Record<string,{x:number;y:number}>={};
  for(const npc of NPCS){
   const p=npcWorldPosition(npc);s.player.restoreAt(p.x+480,p.y+480);s.streamCinematicView(p.x,p.y);
   const actor=r.npcs.find(n=>n.active&&n.definition.id===npc.id);
   if(!actor){missing.push(npc.id);continue;}
   positions[npc.id]={x:actor.x,y:actor.y};
   if(r.isBlockedByBuilding(actor.x,actor.y)||r.isNpcObscured(actor.x,actor.y))blocked.push(npc.id);
   if(!npcMayPatrol(npc)&&!npcStandingOffRoad(npc,actor))roads.push(npc.id);
   for(const other of r.npcs)if(other.active&&other!==actor&&Math.hypot(other.x-actor.x,other.y-actor.y)<60)overlap.push(npc.id+'/'+other.definition.id);
  }
  const tp='/src/data/towns.ts',{TOWN_BY_ID}=await import(tp),town=TOWN_BY_ID.highmere;
  s.player.restoreAt(town.world.x-410,town.world.y+400);s.streamCinematicView(town.world.x-280,town.world.y+320);
  s.cameras.main.stopFollow().setZoom(1.6).centerOn(town.world.x-280,town.world.y+240);
  (s as unknown as {chunkManager:{update(x:number,y:number,immediate:boolean):void}}).chunkManager.update(town.world.x-280,town.world.y+240,true);
  s.scene.pause();
  const canvas=document.querySelector<HTMLCanvasElement>('.three-world-canvas')!;
  for(const el of [...document.querySelectorAll('body *')])if(el instanceof HTMLElement&&el!==canvas&&!el.contains(canvas))el.style.visibility='hidden';
  return {count:Object.keys(positions).length,missing,blocked,overlap,roads,positions};
 });
 await test.info().attach('npc-placement-audit.json',{body:JSON.stringify(audit,null,2),contentType:'application/json'});
 expect(errors).toEqual([]);expect(audit.count).toBe(141);expect(audit.missing).toEqual([]);expect(audit.blocked).toEqual([]);expect(audit.overlap).toEqual([]);expect(audit.roads).toEqual([]);
 await page.waitForTimeout(1200);await page.screenshot({path:'test-results/highmere-shrine-clear.png'});
});
