import { useEffect, useRef, useState } from 'react';
import { SafeDialoguePanel } from './components/DialoguePanel';
import { CharacterPanel } from './components/CharacterPanel';
import { GameCanvas } from './components/GameCanvas';
import { HUD } from './components/HUD';
import { InventoryPanel } from './components/InventoryPanel';
import { MapPanel } from './components/MapPanel';
import { MobileControls } from './components/MobileControls';
import { PausePanel } from './components/PausePanel';
import { Toast } from './components/Toast';
import { ShrineTravelPanel } from './components/ShrineTravelPanel';
import { QuestJournal } from './components/QuestJournal';
import { LoreJournal } from './components/LoreJournal';
import { CinematicPanel } from './components/CinematicPanel';
import { HomeMenu } from './components/HomeMenu';
import {HarborPanel} from './components/HarborPanel';
import {ScreenTransition} from './components/ScreenTransition';
import { mobileInput } from './game/input';
import { useGameStore } from './store/gameStore';
import {installUiInputGuard,noteUiTransition} from './utils/uiInputGuard';
import {dismissStartupSplash} from './utils/startupSplash';
import {HousingPanel} from './components/HousingPanel';
import {TowerExitPanel} from './components/TowerExitPanel';
import {TowerPracticePanel} from './components/TowerPracticePanel';
import {TitleArtwork} from './components/TitleArtwork';
import { allowExplicitNewGame, getSaveRecoveryNotice, hasSavedGame, hasStoredSave, loadGame, saveGame, saveProgressCheckpoint, watchProgressSaves } from './utils/save';
import {RareLootPopup} from './components/RareLootPopup';
import {LevelUpNotice} from './components/LevelUpNotice';
import {ContractBoard} from './components/ContractBoard';
import {waitForGameDisposal} from './game/systems/gameLifetime';

export default function App() {
  const [playing, setPlaying] = useState(false);
  // Continue must not write a checkpoint until Phaser has a playable world.
  const [worldReady, setWorldReady] = useState(false);
  const [canContinue, setCanContinue] = useState(hasSavedGame);
  const [menuMessage, setMenuMessage] = useState<string | null>(null);
  const [startupRetryUsed,setStartupRetryUsed]=useState(false);
  const [startupRecovering,setStartupRecovering]=useState(false);
  const freshStartup=useRef(false);
  const resetGame = useGameStore(state => state.resetGame);

  useEffect(dismissStartupSplash,[]);

  // Recover a failed/stalled startup once, disposing its Phaser instance before
  // restoring the requested journey. Never autosave partial initialization.
  const retryColdStartup=()=>{
    if(startupRetryUsed||startupRecovering)return;
    console.warn('[startup] Retrying cold artwork load with the saved checkpoint');
    setStartupRetryUsed(true);
    setStartupRecovering(true);
    setWorldReady(false);
    setPlaying(false); // unmount and destroy stalled Phaser before remounting
    setCanContinue(false);
    setMenuMessage(null);
  };

  // Passive unmount cleanup disposes GameCanvas before this effect restores
  // state. Wait for actual engine teardown, not an arbitrary restart delay.
  useEffect(()=>{
    if(!startupRecovering)return;
    let cancelled=false;
    void waitForGameDisposal().then(()=>{
      if(cancelled)return;
      let recovered=false;
      try{
        if(freshStartup.current){
          // No gameplay has begun yet. Recreate the requested fresh character,
          // not an older disk save when the initial new-game write failed.
          const ambience=useGameStore.getState().weatherAudio;
          resetGame();useGameStore.getState().hydrate({weatherAudio:ambience});
          recovered=true;
        }else recovered=loadGame(); // reload the checkpoint, never write to it
      }catch(error){console.warn('[startup] Journey recovery could not finish:',error);}
      setStartupRecovering(false);
      setCanContinue(hasSavedGame());
      if(!recovered)console.warn('[startup] Checkpoint recovery:',getSaveRecoveryNotice());
      setMenuMessage(recovered?null:'Please try reopening your journey. Existing save files have been left unchanged; you can keep a backup from this menu.');
      if(recovered)setPlaying(true);
    }).catch(error=>{
      if(cancelled)return;
      console.warn('[startup] Previous journey cleanup could not finish:',error);
      setStartupRecovering(false);
      setCanContinue(hasSavedGame());
      setMenuMessage('Please close and reopen the game to continue your journey. Your saved progress has been kept.');
    });
    return ()=>{cancelled=true;};
  },[startupRecovering,resetGame]);

  useEffect(()=>{
    const dispose=installUiInputGuard(()=>{
      const s=useGameStore.getState();return Boolean(s.panel||s.dialogue||s.cinematic||s.screenTransition||s.passage);
    });
    const unsubscribe=useGameStore.subscribe((next,previous)=>{
      if(next.panel!==previous.panel||next.dialogue!==previous.dialogue||Boolean(next.cinematic)!==Boolean(previous.cinematic)
        ||Boolean(next.screenTransition)!==Boolean(previous.screenTransition)||Boolean(next.passage)!==Boolean(previous.passage)){
        noteUiTransition();mobileInput.reset();
      }
    });
    return ()=>{unsubscribe();dispose();};
  },[]);

  useEffect(() => {
    if (!playing || !worldReady) return;
    // Periodic autosave, plus progress-triggered saves and a checkpoint
    // whenever the player opens the pause menu.
    const interval = window.setInterval(saveProgressCheckpoint, 12000);
    const unsubscribe = watchProgressSaves();
    const unsubscribePause = useGameStore.subscribe((next,previous)=>{
      if(next.panel==='pause'&&previous.panel!=='pause')saveGame();
    });
    const onPageHide = () => { mobileInput.reset(); saveGame(); };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        mobileInput.reset();
        saveGame();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('freeze',onPageHide);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('blur', onPageHide);
    return () => {
      window.clearInterval(interval);
      unsubscribe();
      unsubscribePause();
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('blur', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('freeze',onPageHide);
    };
  }, [playing, worldReady]);

  const continueGame = () => {
    if (loadGame()) {
      freshStartup.current=false;
      setMenuMessage(null);
      setStartupRetryUsed(false);
      setWorldReady(false);
      setPlaying(true);
      return;
    }
    setCanContinue(hasSavedGame());
    setMenuMessage(getSaveRecoveryNotice() ?? 'No saved game is available to continue.');
  };

  const startNewGame = () => {
    const saved = hasStoredSave();
    if (saved && !window.confirm('Start a new game? Your current progress will be replaced.')) return;
    if (saved) loadGame();
    const ambience = useGameStore.getState().weatherAudio;
    allowExplicitNewGame();
    resetGame();
    freshStartup.current=true;
    useGameStore.getState().hydrate({ weatherAudio: ambience });
    if (!saveGame()) setMenuMessage('The new game started, but could not be saved on this device.');
    else setMenuMessage(null);
    setCanContinue(true);
    setStartupRetryUsed(false);
    setWorldReady(false);
    setPlaying(true);
  };

  const returnToHome=()=>{
    // Only a fully initialized world can replace the stored checkpoint. Keep
    // the live session available if saving fails instead of losing its progress.
    if(!worldReady)return;
    if(!saveGame()){
      useGameStore.getState().showToast('Please keep the game open. Save your progress or export a backup before returning home.');
      return;
    }
    mobileInput.reset();
    useGameStore.getState().closePanel();
    setWorldReady(false);
    setPlaying(false);
    setMenuMessage(null);
    setCanContinue(hasSavedGame());
  };

  return (
    <main className="game-shell" onClickCapture={event=>{
      // A graphics failure during a boat/arrival fade must not trap the player
      // behind the normal transition input lock, including backup/report export.
      if(event.target instanceof Element&&event.target.closest('.startup-failure,.game-loading-recovery'))return;
      const s=useGameStore.getState();
      if(s.screenTransition||s.passage){event.preventDefault();event.stopPropagation();}
    }} onKeyDownCapture={event=>{
      if(event.target instanceof Element&&event.target.closest('.startup-failure,.game-loading-recovery'))return;
      const s=useGameStore.getState();
      if((s.screenTransition||s.passage)&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();event.stopPropagation();}
    }} onPointerDown={event=>{
      if(event.target instanceof Element&&event.target.closest('.overlay-backdrop,.dialogue-wrap,.cinematic-presentation'))event.stopPropagation();
    }} onPointerUp={event=>{
      if(event.target instanceof Element&&event.target.closest('.overlay-backdrop,.dialogue-wrap,.cinematic-presentation'))event.stopPropagation();
    }} onKeyDown={event=>{
      if(event.key!=='Escape'&&event.target instanceof Element&&event.target.closest('.overlay-backdrop,.dialogue-wrap,.cinematic-presentation')
        &&event.target.closest('button,input,select,textarea'))event.stopPropagation();
    }} onClick={event=>{
      if(event.target instanceof Element&&event.target.closest('.overlay-backdrop,.dialogue-wrap,.cinematic-presentation'))event.stopPropagation();
    }}>
      {playing ? <>
        <GameCanvas onReady={() => setWorldReady(true)} onRetry={retryColdStartup} retryAvailable={!startupRetryUsed} onExit={() => {
          // Unmount Phaser without saving a partially initialized world.
          setWorldReady(false);
          setPlaying(false);
          setCanContinue(hasSavedGame());
        }} />
        <HUD />
        <MobileControls />
        <SafeDialoguePanel />
        <MapPanel />
        <InventoryPanel />
        <CharacterPanel />
        <PausePanel onReturnHome={returnToHome} canReturnHome={worldReady}/>
        <ShrineTravelPanel />
        <QuestJournal />
        <LoreJournal />
        <HarborPanel />
        <CinematicPanel />
        <Toast />
        <RareLootPopup />
        <LevelUpNotice />
        <ContractBoard />
        <HousingPanel />
        <TowerExitPanel />
        <TowerPracticePanel />
        <ScreenTransition />
      </> : startupRecovering?<div className="game-loading" role="status" aria-live="polite">
        <TitleArtwork/><div className="game-loading-content"><p>Preparing your journey…</p></div>
      </div>:<HomeMenu canContinue={canContinue} message={menuMessage} onContinue={continueGame} onNewGame={startNewGame} />}
    </main>
  );
}
