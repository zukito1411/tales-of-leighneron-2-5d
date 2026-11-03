import {useMemo,useState} from 'react';
import {merchantStock,itemName,POTIONS,type SupplyId} from '../data/economy';
import {ARMOR_BY_ID,ARMOR_SET_BY_ID,ARMOR_SLOT_NAMES,armorBonusLines} from '../data/armor';
import {WEAPON_BY_ID} from '../data/weapons';
import {useGameStore} from '../store/gameStore';
import {ItemIcon} from './ItemIcon';
import {goldLabel} from '../utils/localPlayCheats';
import {WEAPON_PROFILES} from '../data/weaponProfiles';
type Category='all'|'weapons'|'armor'|'potions';
const categoryOf=(id:string):Category=>ARMOR_BY_ID[id]?'armor':WEAPON_BY_ID[id]?'weapons':'potions';
export function MerchantStock({npcId}:{npcId:string}){
  const gold=useGameStore(s=>s.gold),level=useGameStore(s=>s.level),inventory=useGameStore(s=>s.inventory),armorInventory=useGameStore(s=>s.armorInventory),consumables=useGameStore(s=>s.consumables),buy=useGameStore(s=>s.buyItem);
  const localNpc=useGameStore(s=>s.dialogue?.localNpc);
  const [category,setCategory]=useState<Category>('all'),[search,setSearch]=useState(''),[selection,setSelection]=useState('');
  const stock=useMemo(()=>merchantStock(npcId,localNpc),[npcId,localNpc]);
  const offers=useMemo(()=>stock.filter(o=>(category==='all'||categoryOf(o.id)===category)&&itemName(o.id).toLocaleLowerCase().includes(search.toLocaleLowerCase())),[stock,category,search]);
  if(!stock.length)return null;
  const selected=offers.find(o=>o.id===selection)??offers[0];
  const armor=selected?ARMOR_BY_ID[selected.id]:undefined,weapon=selected?WEAPON_BY_ID[selected.id]:undefined,potion=selected&&!armor&&!weapon?POTIONS[selected.id as SupplyId]:undefined;
  const owned=(id:string)=>ARMOR_BY_ID[id]?armorInventory.includes(id):Boolean(WEAPON_BY_ID[id]&&inventory.includes(id));
  const full=(id:string)=>categoryOf(id)==='potions'&&(consumables[id as SupplyId]??0)>=99;
  const reason=selected?(owned(selected.id)?'Already owned':full(selected.id)?'Bag full':level<selected.minLevel?`Requires level ${selected.minLevel}`:gold<selected.price?'Not enough gold':null):null;
  return <section className="merchant-stock merchant-catalog" aria-label="Merchant catalog">
    <div className="merchant-heading"><h3>Goods for the road</h3><strong>{goldLabel(gold)} G</strong></div>
    <nav className="equipment-tabs" aria-label="Shop categories">{(['all','weapons','armor','potions'] as const).filter(c=>c==='all'||stock.some(o=>categoryOf(o.id)===c)).map(c=><button type="button" key={c} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c==='all'?'All goods':c[0].toUpperCase()+c.slice(1)}</button>)}</nav>
    <label className="equipment-search"><span className="sr-only">Search shop</span><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find supplies…"/></label>
    <div className="merchant-layout"><div className="merchant-items" aria-label="Available items">{offers.map(o=><button type="button" className="merchant-item" key={o.id} aria-pressed={selected?.id===o.id} onClick={()=>setSelection(o.id)}><ItemIcon id={o.id}/><span><strong>{itemName(o.id)}</strong><small>{ARMOR_BY_ID[o.id]?ARMOR_SLOT_NAMES[ARMOR_BY_ID[o.id].slot]:WEAPON_BY_ID[o.id]?'Weapon':`${consumables[o.id as SupplyId]??0} / 99 in bag`}</small><small>{owned(o.id)?'Owned':`${o.price} G · Lv ${o.minLevel}`}</small></span></button>)}{!offers.length&&<p>No matching goods.</p>}</div>
      {selected&&<article className="merchant-preview"><div className="bag-inspection-title"><ItemIcon id={selected.id}/><h4>{itemName(selected.id)}</h4></div>
        {armor&&<><p>{armorBonusLines(armor.bonuses).join(' · ')}</p><p><strong>{ARMOR_SET_BY_ID[armor.setId].name} · 3-piece bonus</strong><br/>{armorBonusLines(ARMOR_SET_BY_ID[armor.setId].bonus).join(' · ')}</p><details><summary>Armor profile</summary><p>{armor.appearance}</p><p>{armor.origin}</p><p>{armor.history}</p></details></>}
        {weapon&&<><p>{weapon.damage} attack · {(weapon.cooldownMs/1000).toFixed(2)}s recovery · {weapon.staminaCost} stamina</p><p>{weapon.description}</p>{WEAPON_PROFILES[weapon.id]?.proc&&<p>{WEAPON_PROFILES[weapon.id].proc!.name} · {Math.round(WEAPON_PROFILES[weapon.id].proc!.chance*100)}% chance on normal hits</p>}</>}
        {potion&&<><p>{potion.description}</p><p>Stored in your bag for later use.</p><p>{consumables[selected.id as SupplyId]??0} / 99 bottles carried</p></>}
        <button type="button" className="merchant-buy" disabled={Boolean(reason)} onClick={()=>buy(npcId,selected.id)}>{reason??`Buy ${potion?'one bottle':'item'} · ${selected.price} G`}</button>
      </article>}
    </div>
  </section>;
}
