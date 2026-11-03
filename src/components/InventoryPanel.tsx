import {useMemo,useState} from 'react';
import {useGameStore} from '../store/gameStore';
import {POTIONS,weaponEffect,type SupplyId} from '../data/economy';
import {ItemIcon} from './ItemIcon';
import {goldLabel,localPlayCheatsEnabled} from '../utils/localPlayCheats';
import {WEAPON_PROFILES,weaponProcDescription} from '../data/weaponProfiles';
import {enhancedWeapon,weaponUpgradeRank,enhancedProcChance} from '../data/weaponUpgrades';
import {ARMOR_BY_ID,ARMOR_SET_BY_ID,ARMOR_SLOTS,ARMOR_SLOT_NAMES,armorBonusLines,armorBonusesFor,type ArmorSlot} from '../data/armor';
import {AWAKENING_BY_WEAPON,awakenedProfile} from '../data/awakening';
import {WEAPON_BY_ID} from '../data/weapons';

export function InventoryPanel(){
  const panel=useGameStore(s=>s.panel);
  return panel==='inventory'?<OpenInventory/>:null;
}
function OpenInventory(){
  const [tab,setTab]=useState<'equipment'|'potions'>('equipment');
  const close=useGameStore(s=>s.closePanel),weaponId=useGameStore(s=>s.weaponId),inventory=useGameStore(s=>s.inventory);
  const [selection,setSelection]=useState(weaponId);
  const localForms=localPlayCheatsEnabled();
  const equipLocalForm=useGameStore(s=>s.equipLocalWeaponForm);
  const [kind,setKind]=useState<'weapons'|ArmorSlot>('weapons');
  const armorInventory=useGameStore(s=>s.armorInventory),equippedArmor=useGameStore(s=>s.equippedArmor),armorBonuses=useGameStore(s=>s.armorBonuses),level=useGameStore(s=>s.level);
  const equipArmor=useGameStore(s=>s.equipArmor),unequipArmor=useGameStore(s=>s.unequipArmor);
  const armors=useMemo(()=>armorInventory.map(id=>ARMOR_BY_ID[id]).filter(a=>a.slot===kind),[armorInventory,kind]);
  const selectedArmor=armors.find(a=>a.id===selection)??armors[0];
  const preview=useMemo(()=>selectedArmor?armorBonusesFor({...equippedArmor,[selectedArmor.slot]:selectedArmor.id}):armorBonuses,[selectedArmor,equippedArmor,armorBonuses]);
  const gold=useGameStore(s=>s.gold),potions=useGameStore(s=>s.consumables),upgrades=useGameStore(s=>s.weaponUpgrades),materials=useGameStore(s=>s.bossMaterials),luck=useGameStore(s=>s.attributes.luck);
  const equip=useGameStore(s=>s.equipWeapon),drink=useGameStore(s=>s.usePotion);
  const hp=useGameStore(s=>s.hp),maxHp=useGameStore(s=>s.maxHp),stamina=useGameStore(s=>s.stamina),maxStamina=useGameStore(s=>s.maxStamina),casting=useGameStore(s=>s.activeSkillStatus.casting);
  const awakened=useGameStore(s=>s.awakenedWeapons);
  const current=useMemo(()=>enhancedWeapon(weaponId,upgrades,awakened),[weaponId,upgrades,awakened]);
  const weapons=useMemo(()=>inventory.map(id=>enhancedWeapon(id,upgrades,awakened))
    .sort((a,b)=>Number(b.id===weaponId)-Number(a.id===weaponId)||b.damage-a.damage),[inventory,upgrades,weaponId,awakened]);
  const selected=kind==='weapons'?(weapons.find(w=>w.id===selection)??weapons[0]):undefined;
  const selectedAwakening=selected?AWAKENING_BY_WEAPON[selected.id]:undefined;
  const rank=(id:string)=>weaponUpgradeRank(id,upgrades);
  const change=selected?selected.damage-current.damage:0;
  const profile=selected?WEAPON_PROFILES[selected.id]:undefined;
  return <div className="overlay-backdrop bag-backdrop" role="dialog" aria-modal="true" aria-label="Bag and equipment">
    <section className="panel inventory-panel rpg-bag">
      <header><div><small>Ready for the road</small><h2>Leigneron's bag</h2><p>{goldLabel(gold)} gold · {inventory.length} weapons · {armorInventory.length} armor pieces</p></div><button type="button" onClick={close}>Close</button></header>
      <nav className="equipment-tabs" aria-label="Bag categories"><button type="button" aria-pressed={tab==='equipment'} onClick={()=>setTab('equipment')}>Equipment</button><button type="button" aria-pressed={tab==='potions'} onClick={()=>setTab('potions')}>Potions · {Object.values(potions).reduce((a,b)=>a+b,0)}</button></nav>
      <div className={`bag-content${tab==='equipment'?' is-equipment':''}`}>
        {tab==='equipment'?<>
          <nav className="equipment-tabs armor-categories" aria-label="Equipment types">{(['weapons',...ARMOR_SLOTS] as const).map(k=><button type="button" key={k} aria-pressed={kind===k} onClick={()=>setKind(k)}>{k==='weapons'?'Weapons':ARMOR_SLOT_NAMES[k]}</button>)}</nav>
          <div className="bag-loadout">
            <section className="bag-weapons" aria-label="Owned equipment"><div className="bag-section-title"><h3>{kind==='weapons'?'Weapons':ARMOR_SLOT_NAMES[kind]}</h3><small>{kind==='weapons'?weapons.length:armors.length} in bag</small></div>
              <div className={`bag-weapon-list${kind==='weapons'?' is-weapons':''}`}>{kind==='weapons'&&weapons.map(w=><div key={w.id} className={`bag-weapon-row${selected?.id===w.id?' is-selected':''}${w.id===weaponId?' is-equipped':''}`}>
                <button type="button" className="bag-weapon-name" aria-pressed={selected?.id===w.id} title={w.name} onClick={()=>setSelection(w.id)}><ItemIcon id={w.id}/><span className="bag-weapon-label"><strong>{w.name}{rank(w.id)>0?` +${rank(w.id)}`:''}</strong>{AWAKENING_BY_WEAPON[w.id]&&<small>{awakened.includes(w.id)?`Normal: ${WEAPON_BY_ID[w.id].name}`:`Awakened: ${AWAKENING_BY_WEAPON[w.id].name}`}</small>}</span></button>
                <span className="bag-weapon-numbers"><strong>{w.damage} <small>ATK</small></strong><small>Tier {w.tier}</small></span>
                <button type="button" className="bag-row-equip" aria-label={`${w.id===weaponId?'Equipped':'Equip'} ${w.name}`} disabled={w.id===weaponId||Boolean(casting)} onClick={()=>{setSelection(w.id);equip(w.id);}}>{w.id===weaponId?'✓':'Equip'}</button>
              </div>)}{kind!=='weapons'&&armors.map(a=><button type="button" key={a.id} className={`bag-weapon-choice${equippedArmor[a.slot]===a.id?' is-equipped':''}`} aria-pressed={selectedArmor?.id===a.id} onClick={()=>setSelection(a.id)}><ItemIcon id={a.id}/><span><strong>{a.name}</strong><small>{ARMOR_SET_BY_ID[a.setId].name}</small>{equippedArmor[a.slot]===a.id&&<em>Equipped</em>}</span></button>)}{!(kind==='weapons'?weapons.length:armors.length)&&<p>No equipment here yet. Visit a merchant or seek regional bosses.</p>}</div>
            </section>
            <aside className="bag-slots" aria-label="Equipment slots"><h3>Equipment</h3>
              <div className="armor-slot-grid"><button type="button" className="bag-weapon-slot" onClick={()=>{setKind('weapons');setSelection(current.id);}} aria-pressed={kind==='weapons'} aria-label={`Weapon slot: ${current.name}`} title={current.name}><small>Weapon</small><ItemIcon id={current.id}/><strong>{current.name}{rank(current.id)>0?` +${rank(current.id)}`:''}</strong></button>
              {ARMOR_SLOTS.map(slot=>{const id=equippedArmor[slot];return <button type="button" className="bag-weapon-slot" key={slot} aria-pressed={kind===slot} aria-label={`${ARMOR_SLOT_NAMES[slot]} slot: ${id?ARMOR_BY_ID[id].name:'Empty'}`} title={id?ARMOR_BY_ID[id].name:'Empty'} onClick={()=>{setKind(slot);if(id)setSelection(id);}}><small>{ARMOR_SLOT_NAMES[slot]}</small>{id?<ItemIcon id={id}/>:<span className="armor-empty">+</span>}<strong>{id?ARMOR_BY_ID[id].name:'Empty'}</strong></button>;})}</div>
              <div className="bag-slot-actions">
              {selected&&<button className="bag-equip-action" type="button" disabled={selected.id===weaponId||Boolean(casting)} onClick={()=>equip(selected.id)}>{selected.id===weaponId?'Equipped':'Equip selected'}</button>}
              {selectedArmor&&kind!=='weapons'&&<button className="bag-equip-action" type="button" disabled={equippedArmor[selectedArmor.slot]===selectedArmor.id||Boolean(casting)||level<selectedArmor.minLevel} onClick={()=>equipArmor(selectedArmor.id)}>{equippedArmor[selectedArmor.slot]===selectedArmor.id?'Equipped':level<selectedArmor.minLevel?`Requires level ${selectedArmor.minLevel}`:'Equip selected'}</button>}
              {kind!=='weapons'&&equippedArmor[kind]&&<button type="button" className="bag-unequip-action" disabled={Boolean(casting)} onClick={()=>unequipArmor(kind)} aria-label={`Unequip ${ARMOR_BY_ID[equippedArmor[kind]!].name}`}>Remove</button>}
              </div>
            </aside>
          </div>
          {selected&&<section className="bag-inspection" key={selected.id} aria-label="Selected weapon details">
            <div className="bag-inspection-title"><ItemIcon id={selected.id}/><div><small>{selected.id===weaponId?'Currently equipped':'Selected weapon'}</small><h3>{selected.name}{rank(selected.id)>0?` +${rank(selected.id)}`:''}</h3></div>{selected.id!==weaponId&&<strong className={change>0?'stat-gain':change<0?'stat-loss':''}>{change>=0?'+':''}{change} ATK</strong>}</div>
            {selectedAwakening&&<p className="bag-detail-note">Normal: {WEAPON_BY_ID[selected.id].name} · Awakened: {selectedAwakening.name}. These are two forms of the same weapon, not separate bag items.</p>}
            {localForms&&selectedAwakening&&<div className="bag-local-forms" role="group" aria-label="Local weapon form testing"><small>Local testing — both forms unlocked</small><button type="button" disabled={Boolean(casting)||selected.id===weaponId&&!awakened.includes(selected.id)} onClick={()=>equipLocalForm(selected.id,false)}>Equip normal: {WEAPON_BY_ID[selected.id].name}</button><button type="button" disabled={Boolean(casting)||selected.id===weaponId&&awakened.includes(selected.id)} onClick={()=>equipLocalForm(selected.id,true)}>Equip awakened: {selectedAwakening.name}</button></div>}
            <dl className="bag-stats"><div><dt>Attack</dt><dd>{selected.damage}</dd></div><div><dt>Recovery</dt><dd>{(selected.cooldownMs/1000).toFixed(2)}s</dd></div><div><dt>Stamina</dt><dd>{selected.staminaCost}</dd></div><div><dt>Reach</dt><dd>{(selected.reach/32).toFixed(1)} paces</dd></div></dl>
            {weaponEffect(selected.id,awakened)&&<p>Skill effects: {weaponEffect(selected.id,awakened)!.effectName}</p>}
            {awakenedProfile(selected.id,awakened)&&<p className="bag-detail-note">Final form · {awakenedProfile(selected.id,awakened)!.form}. Equipping changes appearance only; equipped armor stats and set bonuses stay active.</p>}
            <p>{weaponProcDescription(selected.id,awakened,profile?.proc?enhancedProcChance(selected.id,profile.proc.chance,upgrades,luck,awakened,armorBonuses.allStats??0):undefined)}</p>
            {profile?.proc&&<p className="bag-detail-note">Status chance: {(enhancedProcChance(selected.id,profile.proc.chance,upgrades,luck,awakened,armorBonuses.allStats??0)*100).toFixed(1)}% before hit weighting.</p>}
            {(rank(selected.id)>0||(materials[selected.id]??0)>0)&&<p className="bag-detail-note">Forge level +{rank(selected.id)} · {materials[selected.id]??0} duplicate materials</p>}
            <details><summary>Weapon story & details</summary><p>{selected.description}</p><p>{profile?.origin}</p><p>{profile?.history}</p></details>
          </section>}
          {selectedArmor&&kind!=='weapons'&&<section className="bag-inspection"><div className="bag-inspection-title"><ItemIcon id={selectedArmor.id}/><div><small>{selectedArmor.setId==='shadow-magus'?'Legendary · ':''}{ARMOR_SLOT_NAMES[selectedArmor.slot]} · Level {selectedArmor.minLevel}</small><h3>{selectedArmor.name}</h3></div></div><p>{armorBonusLines(selectedArmor.bonuses).join(' · ')}</p><p><strong>{ARMOR_SET_BY_ID[selectedArmor.setId].name} set ({ARMOR_SLOTS.filter(s=>equippedArmor[s]&&ARMOR_BY_ID[equippedArmor[s]!].setId===selectedArmor.setId).length}/3)</strong><br/>Full set: {armorBonusLines(ARMOR_SET_BY_ID[selectedArmor.setId].bonus).join(' · ')}</p>{equippedArmor[selectedArmor.slot]!==selectedArmor.id&&<p className="bag-detail-note">Current armor: {armorBonusLines(armorBonuses).join(' · ')||'None'}.<br/>After equipping, including set changes: {armorBonusLines(preview).join(' · ')}. Current HP is retained, capped at your new maximum.</p>}<details><summary>Armor profile & provenance</summary><p>{selectedArmor.appearance}</p><p>{selectedArmor.origin}</p><p>{selectedArmor.history}</p><p>{selectedArmor.setId==='shadow-magus'?'Guaranteed only in the Grand Magus treasure on Tower of Might floor 10-5.':selectedArmor.bossId?'Found only among its regional boss’s spoils.':'Available from traveling suppliers and smiths.'}</p></details></section>}
          <button type="button" className="bag-lore-link" onClick={()=>useGameStore.getState().openPanel('codex')}>Open the world codex →</button>
        </>:<section className="potion-cards"><div className="vital-summary"><span>Health <b>{Math.ceil(hp)} / {maxHp}</b></span><span>Stamina <b>{Math.ceil(stamina)} / {maxStamina}</b></span></div>
          {Object.entries(POTIONS).map(([key,p])=>{const id=key as SupplyId,full=p.hp?hp>=maxHp:stamina>=maxStamina,count=potions[id]??0;return <article className="potion-card item-row" key={id}><ItemIcon id={id}/><div><strong>{p.name}</strong><small>{count} / 99 bottles</small><p>{p.description}</p></div><button type="button" disabled={count===0||full||Boolean(casting)} onClick={()=>drink(id)}>{count===0?'Empty':full?'Full':'Drink'}</button></article>;})}
          <p className="equipment-help">Full health or stamina never wastes a bottle. Health and stamina shortcuts use standard bottles first, then concentrated supplies. Choose a specific bottle here at any time.</p>
        </section>}
      </div>
    </section>
  </div>;
}
