import {NPC_BY_ID} from './npcs';
import type {NpcDefinition} from '../game/types';
import {TOWN_BY_ID} from './towns';
import {WEAPON_BY_ID} from './weapons';
import {REGIONAL_SWORDS,WEAPON_PROFILES} from './weaponProfiles';
import {ARMORS,ARMOR_BY_ID} from './armor';
import {awakenedProfile,heartProfile} from './awakening';

export const POTIONS={
  'healing-potion':{name:'Healing Draught',price:28,minLevel:1,hp:50,stamina:0,hpRatio:0,staminaRatio:0,icon:13,description:'Restores 50 health. No use at full health.'},
  'stamina-potion':{name:'Wayfarer Tonic',price:22,minLevel:1,hp:0,stamina:60,hpRatio:0,staminaRatio:0,icon:14,description:'Restores 60 stamina. No use at full stamina.'},
  'concentrated-healing-potion':{name:'Concentrated Healing Draught',price:150,minLevel:20,hp:180,stamina:0,hpRatio:.35,staminaRatio:0,icon:13,description:'Restores 35% of maximum health, at least 180. No use at full health.'},
  'concentrated-stamina-potion':{name:'Concentrated Wayfarer Tonic',price:90,minLevel:16,hp:0,stamina:110,hpRatio:0,staminaRatio:.4,icon:14,description:'Restores 40% of maximum stamina, at least 110. No use at full stamina.'},
} as const;
export type PotionId='healing-potion'|'stamina-potion';
export type SupplyId=keyof typeof POTIONS;
export type PotionInventory=Record<PotionId,number>&Partial<Record<Exclude<SupplyId,PotionId>,number>>;
export function preferredPotion(base:PotionId,inventory:PotionInventory):SupplyId {
 const stronger=base==='healing-potion'?'concentrated-healing-potion':'concentrated-stamina-potion';
 return inventory[base]>0||!(inventory[stronger]??0)?base:stronger;
}
export function potionRecovery(id:SupplyId,maxHp:number,maxStamina:number){
 const p=POTIONS[id];return {hp:Math.max(p.hp,Math.round(maxHp*p.hpRatio)),stamina:Math.max(p.stamina,Math.round(maxStamina*p.staminaRatio))};
}

/** Only enemies that carry bags or provisions can drop a potion.
 * Wildlife, spirits, bosses and temporary summons cannot spawn supplies. */
const SUPPLY_CARRYING_ENEMIES=new Set([
  'road-bandit','cutlass-pirate','pirate-boatswain',
  'rindass-orc-raider','rindass-orc-spearman',
  'hedge-goblin','goblin-stone-slinger',
]);
export const canDropPotion=(enemyId:string)=>SUPPLY_CARRYING_ENEMIES.has(enemyId);

export const SWORD_OFFERS=[
  {id:'oak-shield-blade',price:110,minLevel:3,icon:1},
  {id:'steel-roadblade',price:290,minLevel:8,icon:2},
  {id:'dwarven-forged-sword',price:620,minLevel:16,icon:3},
  {id:'royal-tempered-sword',price:1050,minLevel:24,icon:2},
] as const;
export const BOSS_WEAPONS:Record<string,{id:string;icon:number;salvage:number;effectColor:number;effectName:string}>={
  'captain-varr':{id:'varr-rededge',icon:4,salvage:90,effectColor:0xff6262,effectName:'Crimson'},
  'moonlit-warden':{id:'moonlit-oathblade',icon:5,salvage:180,effectColor:0xbe9aff,effectName:'Moon violet'},
  'stonejaw-troll':{id:'stonejaw-edge',icon:6,salvage:200,effectColor:0xe6d4af,effectName:'Stone gold'},
  'iron-tusk':{id:'iron-tusk-fang',icon:7,salvage:220,effectColor:0xff9368,effectName:'Tusk amber'},
  rootfather:{id:'rootfather-thornblade',icon:8,salvage:240,effectColor:0x95ec77,effectName:'Root green'},
  'salt-king':{id:'salt-kings-cutlass',icon:9,salvage:260,effectColor:0xffd676,effectName:'Captain gold'},
  'frost-wyrm':{id:'wyrm-frostedge',icon:10,salvage:300,effectColor:0x83ddff,effectName:'Ice blue'},
  'ashen-seer':{id:'seer-obsidian-edge',icon:11,salvage:340,effectColor:0xc58aff,effectName:'Seer violet'},
  varkhul:{id:'varkhul-emberfang',icon:12,salvage:450,effectColor:0xff774a,effectName:'Ember red'},
};
const weaponEffects=new Map(Object.values(BOSS_WEAPONS).map(w=>[w.id,w]));
export function weaponEffect(id:string,awakened:readonly string[]=[]){const final=awakenedProfile(id,awakened),base=weaponEffects.get(id);return final&&base?{...base,effectColor:final.color,effectName:final.form}:base;}
export function itemIcon(id:string){
  if(WEAPON_PROFILES[id])return WEAPON_PROFILES[id].icon;
  if(id==='portquill-cutlass')return 9;
  if(Object.hasOwn(POTIONS,id))return POTIONS[id as SupplyId].icon;
  return SWORD_OFFERS.find(o=>o.id===id)?.icon??Object.values(BOSS_WEAPONS).find(o=>o.id===id)?.icon??0;
}
export function isBlacksmith(npcId:string,local?:NpcDefinition):boolean {
 const npc=NPC_BY_ID[npcId]??(local?.id===npcId?local:undefined);
 return Boolean(npc&&/blacksmith|weaponsmith|runesmith|armorer|forgewright|forgemaster|master smith|guild smith/i.test(npc.title));
}
export function merchantStock(npcId:string,local?:NpcDefinition):Array<{id:string;price:number;minLevel:number}>{
  const npc=NPC_BY_ID[npcId]??(local?.id===npcId?local:undefined);if(!npc)return [];
  // A story mentioning merchants or a forge doesn't make its speaker a shop.
  const job=npc.title;
  const smith=isBlacksmith(npcId,local);
  const trader=/merchant|trader|shopkeeper|innkeeper|apothecary|herbalist|quartermaster|bowyer|fletcher|caravan master|caravan broker|bar keeper|bartender|tack keeper|taproom server/i.test(job);
  if(!smith&&!trader)return [];
  const region=TOWN_BY_ID[npc.townId]?.regionId;
  const tier=npc.townId==='oakmere'?2:npc.townId==='highmere'?4:region==='trandum'?3:4;
  return [...(smith?SWORD_OFFERS.slice(0,tier).map(o=>({id:o.id,price:o.price,minLevel:o.minLevel})):[]),
    ...ARMORS.filter(a=>a.price!==undefined&&(smith||/merchant|trader|shopkeeper|quartermaster|caravan/i.test(job))
      &&(a.setId==='wayfarer'||smith&&npc.townId!=='oakmere')).map(a=>({id:a.id,price:a.price!,minLevel:a.minLevel})),
    ...REGIONAL_SWORDS.filter(o=>o.region===region).map(({id,price,minLevel})=>({id,price,minLevel})),
    ...Object.entries(POTIONS).map(([id,p])=>({id,price:p.price,minLevel:p.minLevel}))];
}
export function itemName(id:string){return heartProfile(id)?.heart??ARMOR_BY_ID[id]?.name??WEAPON_BY_ID[id]?.name??POTIONS[id as SupplyId]?.name??id;}
