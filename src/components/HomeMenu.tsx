import { useEffect,useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { GraphicsQualityControl } from './GraphicsQualityControl';
import {TitleArtwork} from './TitleArtwork';
import {REGION_MUSIC} from '../game/systems/regionMusic';
import {SaveTransferControls} from './SaveTransferControls';
import {GraphicsReportControls} from './GraphicsReportControls';

interface HomeMenuProps {
  canContinue: boolean;
  message: string | null;
  onContinue: () => void;
  onNewGame: () => void;
}

export function HomeMenu({ canContinue, message, onContinue, onNewGame }: HomeMenuProps) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const ambience = useGameStore(state => state.weatherAudio);

  useEffect(()=>{
    const music=new Audio(REGION_MUSIC.trandum);
    music.loop=true;music.preload='auto';music.volume=.2;
    let disposed=false,starting=false;
    const start=()=>{
      if(disposed||document.hidden||starting||!music.paused)return;
      starting=true;
      // Try autoplay when allowed; otherwise retry directly inside a user
      // gesture. Rejections never interrupt the menu or create console spam.
      void music.play().then(()=>{if(disposed||document.hidden)music.pause();})
        .catch(()=>{}).finally(()=>{starting=false;});
    };
    const onVisibility=()=>{if(document.hidden)music.pause();else start();};
    window.addEventListener('pointerdown',start,true);
    window.addEventListener('keydown',start,true);
    document.addEventListener('visibilitychange',onVisibility);
    start();
    return ()=>{
      disposed=true;
      window.removeEventListener('pointerdown',start,true);
      window.removeEventListener('keydown',start,true);
      document.removeEventListener('visibilitychange',onVisibility);
      // The menu owns this voice only. Gameplay's regional player takes over
      // after Continue/New Game, so two copies can never overlap.
      music.pause();music.removeAttribute('src');music.load();
    };
  },[]);

  const toggleAmbience = () => {
    useGameStore.getState().hydrate({ weatherAudio: !ambience });
    window.dispatchEvent(new Event('mernondna-weather-audio'));
  };

  return (
    <section className="home-menu" aria-label="Tales of Leighneron main menu">
      <TitleArtwork/>
      <div className="home-menu-actions">
        <p className="home-menu-message">2.5D edition</p>
        <button type="button" className="home-menu-button primary" disabled={!canContinue} onClick={onContinue}>Continue</button>
        <button type="button" className="home-menu-button" onClick={onNewGame}>Start New Game</button>
        <button type="button" className="home-menu-button" onClick={() => setOptionsOpen(true)}>Options</button>
        {message && <p className="home-menu-message" role="status">{message}</p>}
      </div>

      {optionsOpen && (
        <div className="home-options-backdrop" role="presentation" onPointerDown={event => {
          if (event.target === event.currentTarget) setOptionsOpen(false);
        }}>
          <section className="home-options" role="dialog" aria-modal="true" aria-labelledby="home-options-title">
            <header>
              <h2 id="home-options-title">Options</h2>
              <button type="button" aria-label="Close options" onClick={() => setOptionsOpen(false)}>×</button>
            </header>
            <button type="button" className="home-option-toggle" aria-pressed={ambience} onClick={toggleAmbience}>
              <span>World sounds</span><strong>{ambience ? 'On' : 'Off'}</strong>
            </button>
            <GraphicsQualityControl />
            <SaveTransferControls/>
            <GraphicsReportControls/>
            <p>This option controls weather ambience and gameplay sound effects. Regional background music is unaffected.</p>
          </section>
        </div>
      )}
    </section>
  );
}
