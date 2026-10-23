import { saveGame,getSaveRecoveryNotice,getSaveFailureReason } from '../utils/save';
import { useGameStore } from '../store/gameStore';
import { GraphicsQualityControl } from './GraphicsQualityControl';
import { GraphicsEffectsControl } from './GraphicsEffectsControl';
import {SaveTransferControls} from './SaveTransferControls';
import {CameraSettingsControl} from './CameraSettingsControl';

export function PausePanel({onReturnHome,canReturnHome}:{onReturnHome:()=>void;canReturnHome:boolean}) {
  const panel = useGameStore((s) => s.panel);
  const close = useGameStore((s) => s.closePanel);
  const showToast = useGameStore((s) => s.showToast);
  const ambience=useGameStore(s=>s.weatherAudio);
  const recovery=getSaveRecoveryNotice();
  if (panel !== 'pause') return null;

  return (
    <div className="overlay-backdrop" role="dialog" aria-modal="true" aria-label="Game menu">
      <section className="panel pause-panel">
        <header><div><h2>Mernodna</h2><p>Base game v0.1 · PC + touch controls</p></div><button type="button" onClick={close}>Resume</button></header>
        <div className="menu-actions">
          <GraphicsQualityControl />
          <GraphicsEffectsControl />
          <CameraSettingsControl />
          <button type="button" onClick={()=>{useGameStore.getState().hydrate({weatherAudio:!ambience});window.dispatchEvent(new Event('mernondna-weather-audio'));}}>World sounds: {ambience?'on':'off'}</button>
          <button type="button" onClick={() => { const saved = saveGame(); showToast(saved ? 'Game saved and verified locally.' : getSaveFailureReason() ?? 'Saving is unavailable. Check browser storage.'); close(); }}>Save game</button>
          <SaveTransferControls/>
          <button type="button" disabled={!canReturnHome} onClick={onReturnHome}>Return to Home</button>
        </div>
        {recovery&&<p className="menu-note" role="status">{recovery}</p>}
        <p className="menu-note">WASD moves relative to the camera. Mouse look: click the capture button; Esc releases it. Left click attacks, right click dashes, Space jumps, Shift sprints, wheel zooms. Skills: 1–4. E interacts; M map; J journal; I inventory; C status. Touch: joystick and action buttons; drag the world to orbit and pinch to zoom.</p>
      </section>
    </div>
  );
}

// LEIGHNERON_MOBILE_GRAPHICS_NPC_FIX_V1
