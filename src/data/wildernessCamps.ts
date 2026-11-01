import layout from './wildernessCampLayout.json';
import {TOWNS} from './towns';
import {registerWildernessNpc} from './npcs';
import {registerWildernessCamp,type WildernessCampSite} from './wildernessCampSites';
import {CAMP_OCCUPANT_STATIONS as stations,wildernessCampProps} from './wildernessCampProps';
import type {ContentDefinition,NpcDefinition,RegionId} from '../game/types';
export const WILDERNESS_CAMP_SUMMARY={adventurer:0,knight:0,hostile:0,npcs:0,enemies:0,omitted:[...layout.omitted]};
const firstNames=['Bram','Nell','Hugh','Tessa','Orin','Mabel','Gareth','Iona','Perrin','Ada','Roland','Faye'];
const surnames=['Thornwick','Ashby','Merrin','Rowe','Briar','Fenwick','Dale','Hollis'];
const lines={
 adventurer:[['Road Adventurer','You can sit by the fire. We are leaving at first light.'],['Trail Scout','We found tracks past the next ridge. Bigger than a wolf’s.'],['Camp Quartermaster','Please leave the dry wood under the canvas. It took all afternoon to find.']],
 knight:[['Road Knight','The road is clear as far as the crossing. We check it again at dawn.'],['Watch Knight','Warm yourself if you need to. Keep the path beside the tents open.'],['Patrol Quartermaster','Three bedrolls, three bowls. I still somehow end up washing four.']],
} as const;
/** Replay the seeded authoring survey; no runtime candidate/slope searches.
 * All camps enter the same chunk ledger, placement guards and save lifecycle. */
export function addWildernessCamps(content:ContentDefinition[]){
 if(content.some(d=>d.id.startsWith('wildcamp:')))return;
 for(const site of layout.sites as WildernessCampSite[]){
  const {id,kind}=site,p=site,region={id:site.region};
  content.push(...wildernessCampProps(id,p));registerWildernessCamp(site);WILDERNESS_CAMP_SUMMARY[kind]++;
  if(kind==='hostile'){
   const enemies=campEnemies(region.id);
   for(let i=0;i<3;i++){
    const q={x:p.x+stations[i].x,y:p.y+stations[i].y};
    content.push({id:id+':enemy:'+i,kind:'creature',enemyId:enemies[i],eventSpawn:true,world:q,encounterId:id,
     encounterBehavior:{home:{...p},station:q,leashRadius:650,role:i===0?'leader':/spearman|slinger/.test(enemies[i])?'ranged':'melee',slot:i}});
    WILDERNESS_CAMP_SUMMARY.enemies++;
   }
  }else{
   const town=TOWNS.reduce((a,b)=>Math.hypot(a.world.x-p.x,a.world.y-p.y)<Math.hypot(b.world.x-p.x,b.world.y-p.y)?a:b);
   for(let i=0;i<3;i++){
    const q={x:p.x+stations[i].x,y:p.y+stations[i].y},local={x:q.x-town.world.x,y:q.y-town.world.y};
    const count=WILDERNESS_CAMP_SUMMARY.npcs,[title,line]=lines[kind][i];
    const npc:NpcDefinition={id:id+':npc:'+i,name:firstNames[count%12]+' '+surnames[Math.floor(count/12)%8],title,townId:town.id,
     ancestry:'human',visualRegion:'trandum',visitor:true,settlementResident:true,spriteTexture:kind==='knight'?'npc_royal_guard':i===2?'npc_attendant':'npc_adventurer',spriteFrame:0,
     campId:id,worldOffset:local,homeLocation:local,stationary:i<2,patrolRadius:i===2?26:0,showOverheadLabels:i<2,
     combatant:kind==='knight',...(kind==='knight'?{weaponId:'oak-shield-blade'}:{}),role:title,
     schedule:[{startHour:0,activity:i===2?'Checks camp supplies':'Keeps watch beside the fire',location:local}],
     relationshipToLeigneron:{kind:'acquaintance',trust:40,summary:'A traveler met beside a wilderness campfire.'},dialogue:[line],questIds:[]};
    registerWildernessNpc(npc);content.push({id:'npc:'+npc.id,kind:'npc',npcId:npc.id,world:q});WILDERNESS_CAMP_SUMMARY.npcs++;
   }
  }
 }
}
function campEnemies(region:RegionId):readonly string[]{
 if(region==='rindass')return ['rindass-orc-raider','rindass-orc-raider','rindass-orc-spearman'];
 if(region==='portquill')return ['cutlass-pirate','cutlass-pirate','cutlass-pirate'];
 if(region==='narenthil'||region==='druganwoods')return ['hedge-goblin','hedge-goblin','goblin-stone-slinger'];
 return ['road-bandit','road-bandit','road-bandit'];
}
