import { useEffect, useRef,useState } from 'react';
import { createMernondnaGame } from '../game/MernondnaGame';
import {disposeGame,waitForGameDisposal} from '../game/systems/gameLifetime';
import { mobileInput } from '../game/input';
import { useGameStore } from '../store/gameStore';
import type Phaser from 'phaser';
import {TitleArtwork} from './TitleArtwork';
import {refreshOfflineGameFiles} from '../utils/appStartup';
import {saveGame} from '../utils/save';
import {SaveTransferControls} from './SaveTransferControls';

declare global { interface Window { __mernondnaGame?: Phaser.Game } }

const LOADING_QUOTES=[
  '“The roads are honest, lad. It is people who lie about where they lead.”',
  '“A candle is not protection, but it reminds travelers who waits for them.”',
  '“Keep the paths open; everybody here depends on them.”',
  '“The beacon is lit, but the pass still feels watched.”',
  '“Our file leaves the crossing clear. Caldus insists on spacing, even on quiet days.”',
  '“Some compasses point toward unfinished stories.”',
];

export function GameCanvas({onReady,onExit,onRetry,retryAvailable}:{onReady:()=>void;onExit:()=>void;onRetry:()=>void;retryAvailable:boolean}) {
  const ref = useRef<HTMLDivElement>(null);
  const [error,setError]=useState<string|null>(null);
  const [loading,setLoading]=useState({ready:false,progress:0,stage:'Loading artwork'});
  const [quoteIndex,setQuoteIndex]=useState(()=>Math.floor(Math.random()*LOADING_QUOTES.length));

  useEffect(() => {
    if (!ref.current) return;
    let game:Phaser.Game|undefined;
    let recovering=false,disposed=false,failureReported=false;
    const failed=(reason:unknown)=>{
      if(disposed||recovering||failureReported||game?.registry.get('worldReady'))return;
      failureReported=true;
      // Diagnostics belong in the developer console, not the player's screen.
      // Retry the same journey once; never loop forever or reset a saved game.
      console.warn('[startup] Opening the world needs recovery:',reason);
      if(retryAvailable){recovering=true;onRetry();return;}
      setError('Your journey could not be opened just now. Please try again. No saved progress was replaced during loading.');
    };
    const onError=(event:ErrorEvent)=>{
      // WebViews may supply a message without an Error object. Resource error
      // events have neither; the Phaser asset loader handles those separately.
      if(event.error||event.message)failed(event.error??new Error(event.message));
    };
    const onRejection=(event:PromiseRejectionEvent)=>failed(event.reason);
    const canvasHost=ref.current;
    const onContextLost=()=>failed(new Error('The graphics context was lost while preparing the game. Return to the menu and retry; your stored save has not been reset.'));
    // Capture because WebGL context events do not bubble, and Phaser adds its
    // canvas after construction. A lost context may never reach POST_RENDER.
    canvasHost.addEventListener('webglcontextlost',onContextLost,true);
    window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onRejection);
    // Some overlay focus transitions prevent Phaser from seeing a keydown.
    // Both inputs use the same boolean action queue, so a duplicate event is harmless.
    const onInteractKey = (event:KeyboardEvent) => {
      if(event.code!=='KeyE'||event.repeat||event.altKey||event.ctrlKey||event.metaKey)return;
      const target=event.target instanceof HTMLElement?event.target:null;
      if(target && (target.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(target.tagName)))return;
      const state=useGameStore.getState();
      if(state.panel||state.dialogue||state.cinematic||!state.navigation.interaction)return;
      mobileInput.press('interact');
    };
    window.addEventListener('keydown',onInteractKey);
    // Also serialize manual menu re-entry and React's development remounts.
    void waitForGameDisposal().then(()=>{
      if(disposed||recovering)return;
      game=createMernondnaGame(canvasHost);
      if(import.meta.env.DEV&&new URLSearchParams(window.location.search).has('e2e'))window.__mernondnaGame=game;
    }).catch(failed);
    let lastAdvance=Date.now(),lastProgress=-1,stalled=false,initialCheckpointSaved=false,loadingStage='',lastAsset='';
    const onVisible=()=>{if(!document.hidden)lastAdvance=Date.now();};
    document.addEventListener('visibilitychange',onVisible);
    const readinessPoll=window.setInterval(()=>{
      if(!game||recovering)return;
      const presentationError=game.registry.get('presentationError');
      if(typeof presentationError==='string'){setError(presentationError);return;}
      const assetError=game.registry.get('assetError');
      if(typeof assetError==='string'){failed(new Error(assetError));return;}
      const progress=game.registry.get('loadingProgress');
      const stage=game.registry.get('loadingStage');
      const completedAsset=game.registry.get('loadingLastAsset');
      const ready=game.registry.get('worldReady')===true;
      if(ready){
        setError(null);
        // Capture the fully initialized world once, after its first rendered
        // frame. The menu's early save does not yet contain live world state.
        if(!initialCheckpointSaved){
          initialCheckpointSaved=true;
          if(!saveGame())console.warn('[save] World-ready checkpoint could not be saved.');
          onReady();
        }
      }
      if(typeof progress==='number'&&progress>lastProgress+.001){lastProgress=progress;lastAdvance=Date.now();}
      if(typeof stage==='string'&&stage!==loadingStage){loadingStage=stage;lastAdvance=Date.now();}
      if(typeof completedAsset==='string'&&completedAsset!==lastAsset){lastAsset=completedAsset;lastAdvance=Date.now();}
      if(!ready&&!document.hidden&&!stalled&&
        Date.now()-lastAdvance>90000){
        stalled=true;
        const stage=game.registry.get('loadingStage');
        const stages=game.scene.scenes.map(scene=>`${scene.scene.key}:${scene.sys.settings.status}`).join(', ');
        const lastAsset=game.registry.get('loadingLastAsset');
        console.warn('[startup] cold load stalled', {stage,scenes:stages,progress,lastAsset,retryAvailable});
        const file=typeof lastAsset==='string'&&lastAsset.length<160?` Last asset: ${lastAsset}.`:'';
        failed(new Error(`Loading did not finish during ${typeof stage==='string'?stage:'game startup'} (scenes: ${stages}).${file}`));
        return;
      }
      setLoading(current=>{
        const nextProgress=typeof progress==='number'?progress:current.progress;
        const nextStage=typeof stage==='string'?stage:current.stage;
        return current.ready===ready&&current.progress===nextProgress&&current.stage===nextStage?current:
          {ready,progress:nextProgress,stage:nextStage};
      });
    },100);
    return () => {disposed=true;window.clearInterval(readinessPoll);window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onRejection);window.removeEventListener('keydown',onInteractKey);document.removeEventListener('visibilitychange',onVisible);
      canvasHost.removeEventListener('webglcontextlost',onContextLost,true);
      if (window.__mernondnaGame === game) delete window.__mernondnaGame; if(game)disposeGame(game); };
  }, []);

  useEffect(()=>{
    if(loading.ready||error)return;
    const timer=window.setInterval(()=>setQuoteIndex(current=>{
      const next=Math.floor(Math.random()*(LOADING_QUOTES.length-1));
      return next>=current?next+1:next;
    }),4200);
    return ()=>window.clearInterval(timer);
  },[loading.ready,error]);

  const progress=Math.round(Math.min(.92,Math.max(0,loading.progress*.92))*100);
  return <><div ref={ref} className="game-canvas" aria-label="Mernodna game world"/>
    {!loading.ready&&!error&&<div className="game-loading" role="status" aria-live="polite">
      <TitleArtwork/>
      <div className="game-loading-content">
        <p className="game-loading-quote" key={quoteIndex}>{LOADING_QUOTES[quoteIndex]}</p>
        <div className="game-loading-track" role="progressbar" aria-label="Loading game" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <span className="game-loading-fill" style={{width:`${progress}%`}}/>
          <span className="game-loading-percentage" aria-hidden="true">{progress}%</span>
        </div>
        <small className="game-loading-stage" aria-live="polite" style={{opacity:.75,fontSize:12,letterSpacing:'.02em'}}>Preparing your journey…</small>
      </div>
      <div className="game-loading-recovery">
        <button type="button" onClick={onExit}>Return to Main Menu</button>
      </div>
    </div>}
    {error&&<div className="startup-failure" role="alert"><h2>Your journey is waiting</h2><p>{error}</p><button onClick={()=>window.location.reload()}>Try again</button><button onClick={()=>{void refreshOfflineGameFiles();}}>Refresh game files (keeps save)</button><div className="game-recovery-controls"><SaveTransferControls exportOnly storedOnly/><button onClick={onExit}>Return to Main Menu</button></div></div>}</>;
}
