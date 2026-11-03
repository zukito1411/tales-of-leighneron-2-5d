import {useControlSettings} from './useControlSettings';
import {keyLabel} from '../game/systems/controlSettings';
import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { GameIcon } from './GameIcon';
import { DesktopSkillBar } from './DesktopSkillBar';
import { REGION_BY_ID } from '../data/regions';
import { TOWN_BY_ID } from '../data/towns';
import { useGameStore } from '../store/gameStore';
import { mobileInput } from '../game/input';
import { activeObjective } from '../game/systems/questNavigation';
import { MiniMap } from './MiniMap';
import { QuestCompass } from './QuestCompass';
import { experienceWithinLevel,playerLevelCap } from '../data/progression';
import {questObjectiveText} from '../game/systems/questDestinations';
import {goldLabel} from '../utils/localPlayCheats';
import {isPlayerHome} from '../data/playerHomes';

function barPercent(value: number, max: number) {
  return `${Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))}%`;
}

export function HUD() {
  const controls=useControlSettings();
  // Choose once per gameplay mount. Browser chrome, a synthetic mouse event,
  // or an attached pointer must not repeatedly switch the status panel layout.
  const [compactHud] = useState(() => Capacitor.isNativePlatform()
    || window.matchMedia('(hover: none), (pointer: coarse)').matches);
  const [menuExpanded, setMenuExpanded] = useState(false);
  const [questVisible, setQuestVisible] = useState(true);
  const hp = useGameStore((s) => s.hp);
  const maxHp = useGameStore((s) => s.maxHp);
  const stamina = useGameStore((s) => s.stamina);
  const maxStamina = useGameStore((s) => s.maxStamina);
  const level = useGameStore((s) => s.level);
  const cap=useGameStore(s=>playerLevelCap(s.storyFlags));
  const xp = useGameStore((s) => s.xp);
  const gold = useGameStore((s) => s.gold);
  const regionId = useGameStore((s) => s.regionId);
  const townId = useGameStore((s) => s.townId);
  const day = useGameStore((s) => s.day);
  const minute = useGameStore((s) => s.minuteOfDay);
  const quests = useGameStore((s) => s.quests);
  const tracked=useGameStore(s=>s.trackedQuestId);
  const openPanel = useGameStore((s) => s.openPanel);
  const interaction = useGameStore(s => s.navigation.interaction);
  const blocked = useGameStore(s => Boolean(s.panel || s.dialogue || s.cinematic));
  const bossEncounter = useGameStore(s => s.bossEncounter);
  const cinematic=useGameStore(s=>s.cinematic);
  const housingEditing=useGameStore(s=>s.housingEditing);
  const atHome=useGameStore(s=>isPlayerHome(s.housingContext));

  const active = activeObjective(quests,tracked);

  const hour = Math.floor(minute / 60);
  const mins = Math.floor(minute % 60);
  const timeLabel = `${String(hour).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  const xpProgress=experienceWithinLevel(xp,cap);
  const regionName = regionId === 'dead-sea' ? 'Dead Sea' : REGION_BY_ID[regionId]?.name ?? regionId;
  const location = townId ? TOWN_BY_ID[townId]?.name ?? regionName : regionName;

  if(cinematic||housingEditing)return null;
  return (
    <div className="hud-layer" data-compact-hud={compactHud} aria-live="polite">
      <div className="hud-primary-stack">
        <section className="status-card">
          <div className="status-title"><strong>Leigneron</strong><span>Lv. {level}</span></div>
          <div className="meter"><div className="meter-fill hp" style={{ width: barPercent(hp, maxHp) }} /></div>
          <div className="meter"><div className="meter-fill stamina" style={{ width: barPercent(stamina, maxStamina) }} /></div>
          <div className="xp-meter" role="progressbar" aria-label={level>=cap?(cap===50?'Speak with Edmund for breakthrough':'Maximum level'):'Experience to next level'} aria-valuemin={0} aria-valuemax={xpProgress.required} aria-valuenow={xpProgress.current}>
            <div className="xp-meter-fill" style={{ width: barPercent(xpProgress.current, xpProgress.required) }} />
            <span>{level>=cap?(cap===50?'BREAKTHROUGH: EDMUND':'MAX LEVEL'):`${xpProgress.current} / ${xpProgress.required} XP`}</span>
          </div>
          <div className="status-meta"><span>{location}</span><span>Day {day} · {timeLabel}</span><span>{goldLabel(gold)}g</span></div>
        </section>

        <div className={`quest-hud-slot${questVisible?'':' is-hidden'}`}>
          {questVisible&&<section id="quest-hud-card" className="quest-card">
            <strong>{active?.quest.name ?? 'No active quest'}</strong>
            <span className="quest-objective">{active?questObjectiveText(active.objective):'Explore Mernodna freely.'}</span>
            <QuestCompass />
            <button className="journal-link" onClick={()=>openPanel('journal')}>Journal · J</button>
          </section>}
          <button type="button" className="hud-info-toggle quest-hud-toggle"
            aria-controls="quest-hud-card"
            aria-label={questVisible?'Hide quest HUD':'Show quest HUD'}
            aria-expanded={questVisible} title={questVisible?'Hide quest HUD':'Show quest HUD'}
            onClick={()=>setQuestVisible(visible=>!visible)}>
            <GameIcon name={questVisible?'chevron-left':'chevron-right'}/>
          </button>
        </div>
      </div>
      {bossEncounter && <section className="boss-encounter-card" aria-label={`${bossEncounter.name} boss health`}>
        <strong>{bossEncounter.name}</strong>
        <div className={`boss-health-meter${bossEncounter.refilling?' is-refilling':''}`} role="progressbar" aria-label={`${bossEncounter.name} health`}
          aria-valuemin={0} aria-valuemax={bossEncounter.maxHp} aria-valuenow={bossEncounter.hp}>
          <div style={{ width: barPercent(bossEncounter.hp, bossEncounter.maxHp) }} />
        </div>
        {bossEncounter.phase!==undefined&&<div className="boss-resolve-dots" role="img"
          aria-label={bossEncounter.phase===1?'Two red seals remain':'One red seal remains'}>
          <i className="is-lit" aria-hidden="true"/><i className={bossEncounter.phase===1?'is-lit':''} aria-hidden="true"/>
        </div>}
      </section>}
      <MiniMap />
      {!blocked && interaction && <button type="button" className="interaction-hint"
        aria-label={`Interact: ${interaction}`} title={`Interact: ${interaction}`}
        onClick={() => mobileInput.press('interact')}>
        <kbd>{keyLabel(controls.keys.interact)}</kbd><span>{interaction}</span><small>Click or press {keyLabel(controls.keys.interact)}</small>
      </button>}

      <div className={`hud-action-dock ${menuExpanded ? 'is-expanded' : 'is-collapsed'}`}>
        <nav id="hud-main-actions" className="hud-actions" aria-label="Game menus" aria-hidden={!menuExpanded}>
          <button type="button" tabIndex={menuExpanded ? 0 : -1} aria-label="World Map" onClick={() => openPanel('map')}><span className="hud-icon"><GameIcon name="map" /></span><span>Map</span><kbd>M</kbd></button>
          <button type="button" tabIndex={menuExpanded ? 0 : -1} aria-label="Quest Journal" onClick={() => openPanel('journal')}><span className="hud-icon"><GameIcon name="quest" /></span><span>Quest</span><kbd>J</kbd></button>
          <button type="button" tabIndex={menuExpanded ? 0 : -1} aria-label="Bestiary and lore" onClick={() => openPanel('codex')}><span className="hud-icon"><GameIcon name="quest" /></span><span>Lore</span><kbd>B</kbd></button>
          <button type="button" tabIndex={menuExpanded ? 0 : -1} aria-label="Gear" onClick={() => openPanel('inventory')}><span className="hud-icon"><GameIcon name="bag" /></span><span>Bag</span><kbd>I</kbd></button>
          <button type="button" tabIndex={menuExpanded ? 0 : -1} aria-label="Status" onClick={() => openPanel('character')}><span className="hud-icon"><GameIcon name="status" /></span><span>Status</span><kbd>C</kbd></button>
          <button type="button" tabIndex={menuExpanded ? 0 : -1} aria-label="Menu" onClick={() => openPanel('pause')}><span className="hud-icon"><GameIcon name="menu" /></span><span>Menu</span><kbd>Esc</kbd></button>
          {atHome&&<>
            <button type="button" tabIndex={menuExpanded?0:-1} aria-label="Furnish home" title="Furnish home" onClick={()=>useGameStore.setState({panel:'housing',housingEditing:true})}><span className="hud-icon"><GameIcon name="menu"/></span><span>Furnish</span></button>
          </>}
        </nav>
        <button type="button" className="hud-dock-toggle" aria-controls="hud-main-actions" aria-expanded={menuExpanded} aria-label={menuExpanded ? 'Hide menu buttons' : 'Show menu buttons'} onClick={() => setMenuExpanded(value => !value)}>
          <GameIcon name={menuExpanded ? 'chevron-right' : 'chevron-left'} />
        </button>
      </div>

      {!atHome&&<DesktopSkillBar />}
    </div>
  );
}
