import {describe,it,expect} from 'vitest';
import {NPCS} from '../src/data/npcs';
import {QUESTS} from '../src/data/quests';
import {INTERIOR_ENTRIES} from '../src/data/interiors';
import {isPlayerHome} from '../src/data/playerHomes';
import {TOWNS} from '../src/data/towns';
import {SettlementLifeSystem} from '../src/game/systems/SettlementLifeSystem';
import {FrameWorkBudget} from '../src/game/presentation25d/FrameWorkBudget';
import {potionRecovery,preferredPotion} from '../src/data/economy';
import type {WorldScene} from '../src/game/scenes/WorldScene';

describe('settlement routines and shared work',()=>{
 const setup=()=>{
  let hour=0;
  const scene={inInterior:false,getWorldHour:()=>hour,routineNpcActor:()=>undefined,relocateUnloadedRoutineNpc:()=>{}};
  const life=new SettlementLifeSystem(scene as unknown as WorldScene);
  for(const town of TOWNS)for(const _step of life.prepareTown(town.id)){/* data preparation only */}
  return {life,setHour:(value:number)=>{hour=value;}};
 };
 it('keeps quest contacts available and never assigns a player home',()=>{
  const {life,setHour}=setup(),contacts=new Set(QUESTS.flatMap(q=>[q.giverNpcId,...q.objectives.map(o=>o.targetId)]));
  for(const hour of [0,9,19,23]){
   setHour(hour);
   for(const npc of NPCS){
    const room=life.roomFor(npc);
    if(contacts.has(npc.id)||npc.questIds.length||npc.formation)expect(room,npc.id).toBeUndefined();
    if(room){expect(room.townId).toBe(npc.townId);expect(isPlayerHome(room.id)).toBe(false);}
   }
  }
  life.clear();
 });
 it('keeps a citizen in at most one interior, with bounded nightly household occupancy',()=>{
  const {life}=setup(),seen=new Set<string>();
  for(const entry of INTERIOR_ENTRIES){
   const residents=life.residents(entry);
   for(const resident of residents){expect(seen.has(resident.npcId),resident.npcId).toBe(false);seen.add(resident.npcId);}
   if(entry.profile==='home'||entry.profile==='villa')expect(residents.length).toBeLessThanOrEqual(4);
   if(entry.profile==='inn')expect(residents.length).toBeLessThanOrEqual(8);
  }
  expect(seen.size).toBeGreaterThan(0);life.clear();
 });
 it('reserves route progress under slow-frame streaming pressure',()=>{
  const budget=new FrameWorkBudget();budget.begin(1,40);
  const actors=budget.remaining('actors');budget.chargeMs('actors',actors);
  expect(budget.remaining('navigation')).toBeGreaterThan(0);
  budget.chargeMs('navigation',budget.remaining('navigation'));
  expect(budget.remaining('upload')).toBeGreaterThan(0);
  budget.begin(2,16);expect(budget.stats().usedMs).toBe(0);
 });
 it('keeps old potion effects and uses stronger supplies only after standard bottles run out',()=>{
  expect(potionRecovery('healing-potion',1000,300)).toEqual({hp:50,stamina:0});
  expect(potionRecovery('concentrated-healing-potion',1000,300)).toEqual({hp:350,stamina:0});
  expect(potionRecovery('concentrated-stamina-potion',1000,400)).toEqual({hp:0,stamina:160});
  expect(preferredPotion('healing-potion',{'healing-potion':1,'stamina-potion':0,'concentrated-healing-potion':2})).toBe('healing-potion');
  expect(preferredPotion('healing-potion',{'healing-potion':0,'stamina-potion':0,'concentrated-healing-potion':2})).toBe('concentrated-healing-potion');
 });
});
