import { useEffect, useRef } from 'react';
import { slottedActiveSkills } from '../data/activeSkills';
import {CombatArtIcon} from './CombatArtIcon';
import { mobileInput } from '../game/input';
import { useGameStore } from '../store/gameStore';
import {ItemIcon} from './ItemIcon';
import {POTIONS,type PotionId} from '../data/economy';
import {isPlayerHome} from '../data/playerHomes';

export function MobileControls() {
  const joystickRef = useRef<HTMLDivElement>(null);
  const pointerId = useRef<number | null>(null);
  const attackPointer=useRef<number|null>(null);
  const sprintPointer = useRef<{id:number;startedAt:number;timer:number}|null>(null);
  const panel = useGameStore(s => s.panel);
  const targetLock=useGameStore(s=>s.targetLock);
  const housingEditing=useGameStore(s=>s.housingEditing);
  const atHome=useGameStore(s=>isPlayerHome(s.housingContext));
  const dialogue = useGameStore(s => s.dialogue);
  const cinematic=useGameStore(s=>s.cinematic);
  const transition=useGameStore(s=>s.screenTransition);
  const passage=useGameStore(s=>s.passage);
  const activeSkillStatus = useGameStore(s => s.activeSkillStatus);
  const level=useGameStore(s=>s.level);
  const slots=useGameStore(s=>s.skillSlots);
  const interaction = useGameStore(s => s.navigation.interaction);
  const potions=useGameStore(s=>s.consumables);
  const hp=useGameStore(s=>s.hp),maxHp=useGameStore(s=>s.maxHp),stamina=useGameStore(s=>s.stamina),maxStamina=useGameStore(s=>s.maxStamina);
  const blocked = Boolean(panel || dialogue || cinematic || housingEditing || transition || passage);
  useEffect(() => {
    const reset = () => {
      pointerId.current = null;
      attackPointer.current=null;
      if(sprintPointer.current)window.clearTimeout(sprintPointer.current.timer);
      sprintPointer.current = null;
      joystickRef.current?.style.setProperty('--stick-x', '0px');
      joystickRef.current?.style.setProperty('--stick-y', '0px');
      mobileInput.reset();
    };
    reset();
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', reset);
    return () => { reset(); window.removeEventListener('blur', reset); document.removeEventListener('visibilitychange', reset); };
  }, [blocked]);

  const updateStick = (clientX: number, clientY: number) => {
    const node = joystickRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let x = (clientX - cx) / (rect.width * 0.36);
    let y = (clientY - cy) / (rect.height * 0.36);
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    node.style.setProperty('--stick-x', `${x * Math.min(40, rect.width * .27)}px`);
    node.style.setProperty('--stick-y', `${y * Math.min(40, rect.height * .27)}px`);
    mobileInput.setMove(x, y);
  };

  const release = () => {
    pointerId.current = null;
    joystickRef.current?.style.setProperty('--stick-x', '0px');
    joystickRef.current?.style.setProperty('--stick-y', '0px');
    mobileInput.releaseMove();
  };
  const releaseAttack=(id:number)=>{
    if(attackPointer.current!==id)return;
    attackPointer.current=null;mobileInput.setAttackHeld(false);
  };

  const releaseSprint = (pointerId: number, dashOnTap: boolean) => {
    const press = sprintPointer.current;
    if (!press || press.id !== pointerId) return;
    window.clearTimeout(press.timer);
    sprintPointer.current = null;
    mobileInput.setSprint(false);
    if (dashOnTap && performance.now() - press.startedAt < 180) mobileInput.press('dash');
  };

  const lockButton=(desktop=false)=><button type="button" className={desktop?'target-lock-desktop':`touch-button target-lock${targetLock?' is-locked':''}`}
    aria-label={targetLock?`Unlock ${targetLock.name}`:'Lock target'} aria-pressed={Boolean(targetLock)} title={targetLock?`Unlock ${targetLock.name} · R`:'Lock visible enemy · R'}
    onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();mobileInput.press('targetLock');}}}
    onPointerDown={event=>{event.stopPropagation();mobileInput.press('targetLock');}}>
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="16" cy="16" r="8"/><path d="M16 2v7m0 14v7M2 16h7m14 0h7"/><circle cx="16" cy="16" r="2"/></svg>
    <small>{targetLock?'Unlock':'Lock'}{desktop?' · R':''}</small>
  </button>;
  return <>
    {!blocked&&lockButton(true)}
    <div className="mobile-controls" data-at-home={atHome} aria-label="Touch controls" style={blocked ? { display: 'none' } : undefined}>
      <div
        ref={joystickRef}
        className="joystick"
        onPointerDown={(event) => {
          if (pointerId.current !== null) return;
          pointerId.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          updateStick(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (pointerId.current === event.pointerId && event.currentTarget.hasPointerCapture(event.pointerId)) updateStick(event.clientX, event.clientY);
        }}
        onPointerUp={(event) => { if (pointerId.current === event.pointerId) release(); }}
        onPointerCancel={(event) => { if (pointerId.current === event.pointerId) release(); }}
        onLostPointerCapture={(event) => { if (pointerId.current === event.pointerId) release(); }}
        aria-label="Movement joystick"
      >
        <div className="joystick-knob" />
      </div>

      <div className="touch-actions">
        {lockButton()}
        <button type="button" className="touch-button jump" aria-label="Jump" onPointerDown={()=>mobileInput.press('jump')}><span className="touch-glyph">↑</span><small>Jump</small></button>
        <div className="touch-potions" aria-label="Potion shortcuts">
          {(['healing-potion','stamina-potion'] as PotionId[]).map(id=>{
            const healing=id==='healing-potion',count=potions[id],full=healing?hp>=maxHp:stamina>=maxStamina;
            return <button key={id} type="button" className={`touch-button touch-potion ${healing?'healing':'stamina'}`} aria-label={`${POTIONS[id].name}, ${count} remaining`} title={`${POTIONS[id].name} · ${count} remaining`} disabled={count<=0||full||Boolean(activeSkillStatus.casting)} onPointerDown={()=>mobileInput.press(healing?'healPotion':'staminaPotion')}>
              <ItemIcon id={id}/><span className="touch-potion-count">{count}</span>
            </button>;
          })}
        </div>
        {slottedActiveSkills(slots).map(skill => {
          const locked=level<skill.minLevel;
          const remaining = activeSkillStatus.cooldowns[skill.id];
          const cooldown = remaining > 0;
          const progress = Math.max(0, Math.min(1, remaining / skill.cooldownMs));
          const cooldownLabel=locked?`unlocks at level ${skill.minLevel}`:cooldown?`cooldown ${Math.ceil(remaining / 1000)} seconds`:'ready';
          return (
            <button
              key={skill.id}
              type="button"
              aria-label={`${skill.name}, ${cooldownLabel}`}
              title={`${skill.name} · ${skill.staminaCost} stamina${cooldown ? ` · ${cooldownLabel}` : ' · ready'}`}
              className={`touch-button touch-skill skill-${skill.slot}${cooldown ? ' cooling' : ''}${locked?' locked':''}`}
              disabled={locked}
              onPointerDown={() => {if(!locked)mobileInput.press(skill.action);}}
            >
              {cooldown && <span className="touch-cooldown-ring" style={{
                background: `conic-gradient(rgba(12, 19, 23, .78) ${progress * 360}deg, transparent 0)`,
              }} />}
              <span className="touch-skill-glyph"><CombatArtIcon id={skill.id}/></span>
              <span className="touch-skill-slot">{skill.slot}</span>
            </button>
          );
        })}
        {interaction && <button type="button" aria-label={`Interact: ${interaction}`} title={interaction} className="touch-button interact" onPointerDown={() => mobileInput.press('interact')}>
          <span className="touch-glyph">E</span><small>Interact</small>
        </button>}
        <button type="button" aria-label="Attack" title="Hold to keep attacking" className="touch-button attack"
          onPointerDown={event=>{
            if(attackPointer.current!==null)return;
            attackPointer.current=event.pointerId;event.currentTarget.setPointerCapture(event.pointerId);
            mobileInput.press('attack');mobileInput.setAttackHeld(true);
          }} onPointerUp={event=>releaseAttack(event.pointerId)} onPointerCancel={event=>releaseAttack(event.pointerId)}
          onLostPointerCapture={event=>releaseAttack(event.pointerId)}>
          <span className="touch-glyph"><img src={`${import.meta.env.BASE_URL}icons/basic_attack.png`} alt="" /></span><small>Attack</small>
        </button>
        <button type="button" aria-label="Tap to dash, hold to sprint" title="Tap to dash · Hold to sprint" className="touch-button sprint"
          onPointerDown={(event) => {
            if (sprintPointer.current) return;
            const press = {id:event.pointerId,startedAt:performance.now(),timer:0};
            press.timer = window.setTimeout(() => {
              if(sprintPointer.current?.id===event.pointerId)mobileInput.setSprint(true);
            },180);
            sprintPointer.current = press;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerUp={(event) => releaseSprint(event.pointerId, true)}
          onPointerCancel={(event) => releaseSprint(event.pointerId, false)}
          onLostPointerCapture={(event) => releaseSprint(event.pointerId, false)}>
          <span className="touch-glyph"><img src={`${import.meta.env.BASE_URL}assets/ui/actions/dash.svg`} alt="" /></span><small>Dash / Sprint</small>
        </button>
      </div>
    </div>
  </>;
}
