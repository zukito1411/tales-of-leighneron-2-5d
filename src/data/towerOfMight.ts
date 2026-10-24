import {TOWN_BY_ID} from './towns';
import type {DungeonDefinition,DungeonLedger,DungeonProgress} from './dungeons';
import type {QuestDefinition,QuestRuntimeState,EnemyDefinition} from '../game/types';

export const TOWER_ENTRY_ID='cave:tower-of-might';
export const MAGUS_TREASURE_FLOOR='might-10-5';
export const TOWER_QUEST_ID='tower-of-might';
export const TOWER_UNLOCKED='tower-of-might:unlocked';
export const TOWER_STORY_PREREQUISITE='the-last-ward';
export const towerCampaignComplete=(quests:Record<string,{status:QuestRuntimeState['status']}>)=>quests[TOWER_STORY_PREREQUISITE]?.status==='completed';
/** Calendar arithmetic, not seven 24-hour days: retain 06:00 through DST. */
export function nextTowerWeeklyReset(now=Date.now()){
 const monday=new Date(now);monday.setHours(6,0,0,0);
 monday.setDate(monday.getDate()-(monday.getDay()+6)%7);
 if(monday.getTime()<=now)monday.setDate(monday.getDate()+7);
 return monday.getTime();
}
/** Older saves retain their current checkpoint until the next Monday. */
export function gateTowerQuest(quests:Record<string,QuestRuntimeState>){
 const trial=quests[TOWER_QUEST_ID];
 return !towerCampaignComplete(quests)&&trial?.status==='active'
  ?{...quests,[TOWER_QUEST_ID]:{...trial,status:'locked' as const}}:quests;
}
// Fixed endgame targets, independent of player level, current loadout and
// World Ascension. Tuned against awakened +5 weapons (~100–600 sustained DPS
// after movement/stamina) and 600–900 HP armored builds, not level-120 mobs.
const BOSS_HEALTH=[14000,18000,21500,25500,29000,33000,37000,41000,47000,55000] as const;
export function towerCombatStats(chamber:number,floor:number,enemy:EnemyDefinition):Pick<EnemyDefinition,'hp'|'damage'|'defense'>{
 const step=Math.max(0,Math.min(9,chamber-1)),boss=floor===5;
 return boss?{hp:BOSS_HEALTH[step],damage:110+step*11,defense:.14+step*.009}:
  {hp:Math.round((900+step*110+(floor-1)*70)*Math.max(.75,Math.min(1.35,enemy.hp/80))),
   damage:Math.round((42+step*4)*Math.max(.8,Math.min(1.4,enemy.damage/12))),defense:.08+step*.008};
}
export const TOWER_ART='assets/world/tower-of-might-v2.png';
export const TOWER_DOOR_ART='assets/world/tower-doors-v1.png';
export const TOWER_NORTH_DOOR={x:900,y:330};
export const TOWER_PORTAL={x:900,y:900};
export const TOWER_DOOR={x:TOWN_BY_ID.oakmere.world.x,y:TOWN_BY_ID.oakmere.world.y-2400};
/** Reachable standing point south of the original cylinder and its full feet
 * clearance. Keep the tower/collider fixed so old outdoor saves stay valid. */
export const TOWER_APPROACH={x:TOWER_DOOR.x,y:TOWER_DOOR.y+48};
export const inTowerClearing=(x:number,y:number,padding=0)=>Math.abs(x-TOWER_DOOR.x)<300+padding
 &&y>TOWER_DOOR.y-300-padding&&y<TOWER_DOOR.y+160+padding;
export const onTowerApproach=(x:number,y:number)=>Math.abs(x-TOWER_DOOR.x)<65
 &&y>=TOWER_DOOR.y+100&&y<=TOWN_BY_ID.oakmere.world.y-1200;
export const TOWER_CHAMBERS=[
 {bossId:'captain-varr',enemyId:'bandit-captain',name:'Captain Varr',pool:['road-bandit','hedge-goblin','goblin-stone-slinger','gray-wolf']},
 {bossId:'moonlit-warden',enemyId:'moonlit-warden',name:'Moonlit Warden',pool:['gray-wolf','grove-spider','blighted-thornling','marsh-wraith']},
 {bossId:'stonejaw-troll',enemyId:'stonejaw-troll',name:'Stonejaw',pool:['hedge-goblin','goblin-stone-slinger','gray-wolf','cave-troll']},
 {bossId:'iron-tusk',enemyId:'redmesa-chieftain',name:'Krag the Iron-Tusk',pool:['rindass-orc-raider','rindass-orc-spearman','rindass-boar','cave-troll']},
 {bossId:'rootfather',enemyId:'rootfather',name:'Rootfather',pool:['blighted-thornling','grove-spider','marsh-wraith','cave-troll']},
 {bossId:'salt-king',enemyId:'salt-king',name:'Salt King',pool:['cutlass-pirate','pirate-boatswain','road-bandit','goblin-stone-slinger']},
 {bossId:'frost-wyrm',enemyId:'frost-wyrm',name:'Frost Wyrm',pool:['frost-wolf','cave-troll','marsh-wraith','hedge-goblin']},
 {bossId:'ashen-seer',enemyId:'ashen-seer',name:'Ashen Seer',pool:['marsh-wraith','blighted-thornling','rindass-orc-spearman','cave-troll']},
 {bossId:'varkhul',enemyId:'ash-dragon',name:'Varkhul',pool:['marsh-wraith','cave-troll','rindass-orc-raider','rindass-orc-spearman']},
 // bossId is the overworld prerequisite, not this tower-only boss's identity.
 {bossId:'varkhul',enemyId:'grand-magus',name:'Grand Magus of the Shadow Realm',pool:['marsh-wraith','blighted-thornling','grove-spider','goblin-stone-slinger']},
] as const;
export const TOWER_FLOORS:readonly DungeonDefinition[]=TOWER_CHAMBERS.flatMap((chamber,index)=>
 Array.from({length:5},(_,floor)=>{
  const boss=floor===4,id=`might-${index+1}-${floor+1}`,count=boss?1:[10,12,14,15][floor];
  return {id,name:`Tower of Might · ${index+1}-${floor+1}`,townId:'oakmere',regionId:'trandum' as const,door:TOWER_APPROACH,
   directions:'north of Oakmere, Trandum',description:'An endgame trial with fixed combat strength, independent of monster levels.',
   enemies:Array.from({length:count},()=>boss?chamber.enemyId:chamber.pool[floor]),enemyPool:[boss?chamber.enemyId:chamber.pool[floor]],
   captain:chamber.enemyId==='grand-magus'?chamber.name:`Echo of ${chamber.name}`,
   gold:boss?(chamber.enemyId==='grand-magus'?100000:7500*(index+1)):0,xp:boss?(chamber.enemyId==='grand-magus'?90000:6000*(index+1)):0,tint:0xffffff,
   tower:{chamber:index+1,floor:floor+1,bossId:chamber.bossId}};
 }));
/** Boss defeat, not opening its chest, establishes this week's checkpoint. */
export function towerCheckpoint(ledger:DungeonLedger){
 let completed=0;
 for(let chamber=1;chamber<=TOWER_CHAMBERS.length;chamber++){
  if(ledger[`might-${chamber}-5`]?.defeated!==1)break;
  completed=chamber;
 }
 return completed;
}
export const towerEntryFloor=(ledger:DungeonLedger)=>TOWER_FLOORS[towerCheckpoint(ledger)*5]??TOWER_FLOORS[TOWER_FLOORS.length-1];
/** Temporary single-floor practice; never serialized into the weekly ledger. */
export interface TowerPractice {floorId:string;week:number;progress:DungeonProgress;}
export const towerPracticeAvailable=(ledger:DungeonLedger,nextReset:number,now=Date.now())=>
 now<nextReset&&towerCheckpoint(ledger)===TOWER_CHAMBERS.length;
export const towerFloorProgress=(id:string,ledger:DungeonLedger,practice:TowerPractice|null)=>
 practice?.floorId===id?practice.progress:ledger[id];
export const towerKnown=(quests:Record<string,QuestRuntimeState>,flags:Record<string,boolean>)=>
 towerCampaignComplete(quests)&&Boolean(flags[TOWER_UNLOCKED]||(quests[TOWER_QUEST_ID]?.objectiveProgress['hear-bell']??0)>=1);
export const TOWER_QUEST:QuestDefinition={id:TOWER_QUEST_ID,name:'The Tower That Came at Dawn',kind:'side',giverNpcId:'orin-bell',
 prerequisiteQuestId:TOWER_STORY_PREREQUISITE,chapter:'Tower of Might',
 summary:'A strange tower has appeared north of Oakmere in Trandum. Etheldreda Bell fears that it remembers battles which should be over.',
 objectives:[
  {id:'hear-bell',type:'talk',targetId:'orin-bell',amount:1,text:'Speak with Etheldreda Bell at the shrine in Oakmere, Trandum.',
   dialogue:['Leigneron, come here a moment. There was nothing beyond the northern fields when I banked the shrine lamps last night. This morning there is a tower. A whole tower.','No wagons, no masons, not so much as a bent blade of grass. And when the bell rang, something inside answered it.','Would you go and look? North of Oakmere, beyond the fields. Please do not take the village children with you, however loudly they offer.']},
  {id:'enter-tower',type:'visit',targetId:TOWER_ENTRY_ID,amount:1,completedByFlag:TOWER_UNLOCKED,
   text:'Investigate the Tower of Might north of Oakmere, Trandum. Enter its southern doorway.'},
  {id:'report-bell',type:'talk',targetId:'orin-bell',amount:1,text:'Tell Etheldreda Bell at Oakmere shrine what you found.',
   dialogue:['It wore Varr’s face? Then thank the stars it stayed inside. Some memories ought to have the decency to remain memories.','The old shrine books speak of a place that weighs a warrior against the foes they have overcome. Not the dead returned, but an echo with all their cruelty and none of their weariness.','If you go back, go prepared. Bring what you win home to the living. We have enough monuments to the dead.']},
 ],rewardGold:500,rewardXp:750,
};
