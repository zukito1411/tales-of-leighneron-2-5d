import {useGameStore} from '../store/gameStore';
import {EDMUND_ATWOOD_ID} from '../data/npcs';
import {BOSS_WEAPONS,isBlacksmith,itemName} from '../data/economy';
import {MAX_WEAPON_UPGRADE,enhancedWeapon,weaponUpgradeRank} from '../data/weaponUpgrades';
import {goldLabel} from '../utils/localPlayCheats';
import {AWAKENING_BY_WEAPON,AWAKENING_HEART_COST} from '../data/awakening';
import {saveGame} from '../utils/save';
import {AWAKENED_TECHNIQUES} from '../data/awakening';
import {PLAYER_HOMES} from '../data/playerHomes';
import {housingFor,HOME_PRICE} from '../data/housing';

const bossIds=[...new Set(Object.values(BOSS_WEAPONS).map(b=>b.id))];

/** The dialogue's final line is required; store actions repeat all eligibility checks. */
export function NpcServices({npcId}:{npcId:string}){
 const gold=useGameStore(s=>s.gold),attributes=useGameStore(s=>s.attributes),inventory=useGameStore(s=>s.inventory);
 const upgrades=useGameStore(s=>s.weaponUpgrades),materials=useGameStore(s=>s.bossMaterials);
 const reset=useGameStore(s=>s.resetAttributes),upgrade=useGameStore(s=>s.enhanceBossWeapon);
 const hearts=useGameStore(s=>s.bossHearts),awakened=useGameStore(s=>s.awakenedWeapons);
 const awaken=useGameStore(s=>s.awakenBossWeapon);
 const spent=Object.values(attributes).reduce((sum,n)=>sum+n,0);
 const localNpc=useGameStore(s=>s.dialogue?.localNpc);
 const smith=isBlacksmith(npcId,localNpc);
 const housing=useGameStore(s=>s.housing),property=PLAYER_HOMES.find(h=>h.agentId===npcId);
 if(npcId!==EDMUND_ATWOOD_ID&&!smith&&!property)return null;
 const ownedBossWeapons=bossIds.filter(id=>inventory.includes(id));
 return <section className="merchant-stock" aria-label="NPC services">
   {property&&<div><h3>{property.homeName}</h3>
    <p>{housingFor(housing,property.id).owned?`Still got your key? ${property.name} is waiting whenever you’re back in town.`:
      `Looking for a place of your own? ${property.name} is for sale. It’s 7,500 gold, and then it’s yours. Bring whatever furniture you like. Already have a house elsewhere? That’s no trouble.`}</p>
    {!housingFor(housing,property.id).owned&&<button type="button" onClick={()=>useGameStore.setState({dialogue:null,housingContext:'purchase:'+property.id,panel:'housing',housingEditing:false})}>Discuss the deed · {HOME_PRICE.toLocaleString()}G</button>}
   </div>}
   {npcId===EDMUND_ATWOOD_ID&&<>
     <h3>Retrain attributes</h3>
     <p>Return {spent} spent attribute points to redistribute freely. Keep your level, talents, skills and equipment.</p>
     <button type="button" disabled={spent===0||gold<1500} onClick={()=>{
       if(window.confirm('Pay 1,500 gold to Edmund and refund all spent attribute points? Your level and learned skills will stay the same.'))reset(npcId);
     }}>Reset attributes · 1,500 gold</button>
     {gold<1500&&<small>You need {goldLabel(1500-gold)} more gold.</small>}
   </>}
   {smith&&<details>
     <summary>Boss weapon forge · Enhance & awaken · {ownedBossWeapons.length} owned</summary>
     <p>A duplicate of the same boss weapon is needed for each enhancement. Each rank adds 8% base damage, 2% faster attack recovery and +1 percentage point status chance. Maximum +{MAX_WEAPON_UPGRADE}. No gold cost.</p>
     <p>Boss hearts have a 50% drop chance per victory. Three matching hearts awaken an owned boss weapon. No level-75 breakthrough or World Ascension is required.</p>
     {!ownedBossWeapons.length&&<p>Find a boss weapon first. Extra copies become forge materials instead of being automatically sold.</p>}
     {ownedBossWeapons.map(id=>{
       const rank=weaponUpgradeRank(id,upgrades),qty=materials[id]??0,weapon=enhancedWeapon(id,upgrades,awakened),profile=AWAKENING_BY_WEAPON[id],final=awakened.includes(id);
       return <article className="item-row awakening-forge-row" key={id}>
         <div><strong>{weapon.name} {rank>0?`+${rank}`:''}</strong>
           <small>{weapon.damage} damage · {qty} duplicate {qty===1?'material':'materials'} available · {rank}/{MAX_WEAPON_UPGRADE}</small>
         </div>
         <button type="button" disabled={rank>=MAX_WEAPON_UPGRADE||qty<1}
           onClick={()=>upgrade(npcId,id)}>{rank>=MAX_WEAPON_UPGRADE?'Max':qty<1?'Need duplicate':'Enhance +1'}</button>
         {profile&&<div className="awakening-recipe"><strong>{final?`${profile.name} · Final form`:`Awaken into ${profile.name}`}</strong>
           <p>{profile.heart}: {hearts[profile.bossId]??0} / {AWAKENING_HEART_COST}. +20% weapon damage, the {AWAKENED_TECHNIQUES[id]?.name} technique, +5 percentage points to status chance (35% cap), and the {profile.form} cosmetic. Armor stats and enhancement rank remain unchanged.</p>
           {!final&&<button type="button" disabled={(hearts[profile.bossId]??0)<AWAKENING_HEART_COST} onClick={()=>{
             if(!window.confirm(`Spend ${AWAKENING_HEART_COST} ${profile.heart} to permanently awaken this weapon? Its enhancement rank and your equipped armor stats are preserved.`))return;
             awaken(npcId,id);saveGame();
           }}>{`Awaken · ${AWAKENING_HEART_COST} hearts`}</button>}
         </div>}
       </article>;
     })}
   </details>}
 </section>;
}
