import {useControlSettings} from './useControlSettings';
import {keyLabel,type BindingAction} from '../game/systems/controlSettings';
import {POTIONS,preferredPotion} from '../data/economy';
import { slottedActiveSkills } from '../data/activeSkills';
import {CombatArtIcon} from './CombatArtIcon';
import {ItemIcon} from './ItemIcon';
import { mobileInput } from '../game/input';
import { useGameStore } from '../store/gameStore';

/** Four combat slots followed by fixed health/stamina shortcuts. */
export function DesktopSkillBar() {
  const controls=useControlSettings(),binding=(slot:number)=>keyLabel(controls.keys[('skill'+slot) as BindingAction]);
  const status=useGameStore(s=>s.activeSkillStatus);
  const stamina=useGameStore(s=>s.stamina);
  const level=useGameStore(s=>s.level);
  const blocked=useGameStore(s=>Boolean(s.panel||s.dialogue||s.cinematic));
  const slots=useGameStore(s=>s.skillSlots);
  const potions=useGameStore(s=>s.consumables);
  const hp=useGameStore(s=>s.hp),maxHp=useGameStore(s=>s.maxHp),maxStamina=useGameStore(s=>s.maxStamina);
  const skills=slottedActiveSkills(slots);
  if(blocked)return null;
  return <nav className="desktop-skillbar" aria-label="Combat arts and cooldowns">
    {[1,2,3,4].map(slot=>{
      const skill=skills.find(s=>s.slot===slot);
      if(!skill)return <button type="button" key={`empty-${slot}`} className="desktop-skill-slot" disabled title="Choose a skill in Stats"><span className="desktop-skill-art"/><kbd>{binding(slot)}</kbd><span className="desktop-skill-name">Empty</span><span className="desktop-skill-state">Set in Stats</span></button>;
      const locked=level<skill.minLevel;
      const remaining=Math.max(0,status.cooldowns[skill.id]);
      const cooling=remaining>0;
      const insufficient=stamina<skill.staminaCost;
      const casting=status.casting===skill.id;
      const disabled=locked||cooling||insufficient||status.casting!==null;
      return <button type="button" key={skill.id}
        className={`desktop-skill-slot ${cooling?'on-cooldown':''}${locked?' is-locked':''} ${casting?'is-casting':''}`}
        title={`${skill.name} · key ${binding(skill.slot)} · ${skill.staminaCost} stamina${cooling?` · ${(remaining/1000).toFixed(1)}s remaining`:''}`}
        aria-label={`${skill.name} key ${binding(skill.slot)}, ${cooling?`cooldown ${(remaining/1000).toFixed(1)} seconds`:insufficient?'not enough stamina':casting?'casting':'ready'}`}
        disabled={disabled}
        onClick={()=>mobileInput.press(skill.action)}>
        <span className="desktop-skill-art">
          <CombatArtIcon id={skill.id}/>
          {locked&&<span className="desktop-skill-shade" style={{height:'100%'}}/>}
          {cooling&&!locked&&<span className="desktop-skill-shade"
            style={{height:`${Math.min(100,remaining/skill.cooldownMs*100)}%`}} />}
          {cooling&&<strong className="desktop-skill-remaining">{(remaining/1000).toFixed(1)}s</strong>}
          {casting&&<span className="desktop-skill-casting">Casting</span>}
          {locked&&<span className="desktop-skill-remaining">Lv {skill.minLevel}</span>}
        </span>
        <kbd>{binding(skill.slot)}</kbd>
        <span className="desktop-skill-name">{skill.name}</span>
        {!cooling&&!casting&&!locked&&<span className="desktop-skill-state">{insufficient?'Low stamina':'Ready'}</span>}
        {locked&&<span className="desktop-skill-state">Locked</span>}
      </button>;
    })}
    {(['healing-potion','stamina-potion'] as const).map((base,index)=>{
      const id=preferredPotion(base,potions),count=potions[id]??0,full=index===0?hp>=maxHp:stamina>=maxStamina;
      const label=index===0?'HP potion':'Stamina potion',key=keyLabel(controls.keys[index===0?'healPotion':'staminaPotion']);
      return <button type="button" key={id} className="desktop-skill-slot desktop-potion-slot"
        disabled={count===0||full||status.casting!==null}
        title={`${POTIONS[id].name} · key ${key} · ${count} bottles`}
        aria-label={`${label}, key ${key}, ${count} bottles${full?', already full':''}`}
        onClick={()=>mobileInput.press(index===0?'healPotion':'staminaPotion')}>
        <span className="desktop-skill-art"><ItemIcon id={id}/><strong className="desktop-potion-count">{count}</strong></span>
        <kbd>{key}</kbd><span className="desktop-skill-name">{label}</span>
        <span className="desktop-skill-state">{count===0?'Empty':full?'Full':'Ready'}</span>
      </button>;
    })}
  </nav>;
}
