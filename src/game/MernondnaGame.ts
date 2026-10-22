import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import {backingSize,RENDER_DENSITY_KEY} from './systems/renderSizing';
import {ThreePresentation} from './presentation25d/ThreePresentation';

function followDisplaySize(game:Phaser.Game,parent:HTMLElement){
  let pending=0,stopped=false;
  let densityQuery:MediaQueryList|undefined;
  const resize=()=>{
    pending=0;if(stopped||!parent.clientWidth||!parent.clientHeight)return;
    const size=backingSize(parent.clientWidth,parent.clientHeight,window.devicePixelRatio);
    const changed=game.registry.get(RENDER_DENSITY_KEY)!==size.density||game.scale.width!==size.width||game.scale.height!==size.height;
    // Set density before the resize event updates camera zoom and overlays.
    game.registry.set(RENDER_DENSITY_KEY,size.density);
    game.scale.setParentSize(parent.clientWidth,parent.clientHeight);
    if(changed)game.scale.setGameSize(size.width,size.height);
  };
  const schedule=()=>{if(!stopped&&!pending)pending=window.requestAnimationFrame(resize);};
  const watchDensity=()=>{
    densityQuery?.removeEventListener('change',onDensityChange);
    densityQuery=window.matchMedia(`(resolution: ${window.devicePixelRatio||1}dppx)`);
    densityQuery.addEventListener('change',onDensityChange);
  };
  const onDensityChange=()=>{watchDensity();schedule();};
  const observer=new ResizeObserver(schedule);observer.observe(parent);
  window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);
  watchDensity();resize();
  game.events.once(Phaser.Core.Events.DESTROY,()=>{
    stopped=true;observer.disconnect();if(pending)window.cancelAnimationFrame(pending);
    window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);
    densityQuery?.removeEventListener('change',onDensityChange);
  });
}

export function createMernondnaGame(parent: HTMLElement) {
  const size=backingSize(parent.clientWidth,parent.clientHeight,window.devicePixelRatio);
  return new Phaser.Game({
    // Canvas remains an asset/vector preparation backend. ThreePresentation
    // replaces its world render call; physics and gameplay run exactly once.
    type: Phaser.CANVAS,
    parent,
    backgroundColor: '#1b2418',
    pixelArt: false,
    antialias: true,
    loader: {
      maxParallelDownloads: 4,
      timeout: 30000,
    },
    scale: {
      // Phaser 3.90 has no renderer-resolution config. FIT maps the physical
      // buffer to CSS bounds and supplies the correct pointer displayScale.
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: size.width,
      height: size.height,
    },
    callbacks:{
      preBoot:game=>{game.registry.set(RENDER_DENSITY_KEY,size.density);},
      postBoot:game=>{
        followDisplaySize(game,parent);
        try{new ThreePresentation(game,parent);}
        catch(error){
          game.registry.set('assetError','The 2.5D graphics could not be initialized. This version requires WebGL 2.');
          console.error('[2.5d] Renderer initialization failed',error);
        }
      },
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scene: [BootScene, WorldScene],
    render: {
      // Snap render positions in backing pixels; keep smooth LINEAR art filtering.
      roundPixels: true,
      antialiasGL: true,
    },
  });
}
