import Phaser from 'phaser';
import {seededRandom} from '../../utils/seededRandom';
import {useGameStore} from '../../store/gameStore';
import {type Rect} from '../../data/settlementGeometry';
import {authoredRoofs} from './authoredRoofs';
import type {WorldGenerator} from './WorldGenerator';
import {REGION_SCENERY} from '../../data/regionScenery';
import {nightStrength} from '../../data/environmentLights';
import {FogArt} from './FogArt';
import {overlayViewport,fitViewportOverlay} from './renderSizing';
import {getEffectsQuality,EFFECTS_QUALITY_EVENT} from './effectsQuality';
import {getGraphicEffects} from './graphicsEffects';
import {AshfallArt} from './AshfallArt';
import {REGION_MUSIC} from './regionMusic';
import type {RegionId} from '../types';
import {NatureAmbience,natureMix} from './NatureAmbience';
import {groundWorldView,projectedViewOrigin,unprojectGroundPoint} from '../presentation25d/plane';
import type {WeatherPresentation} from '../presentation25d/environment';
type Kind='clear'|'cloudy'|'rain'|'storm'|'snow'|'fog'|'wind'|'dust'|'ash';
const labels:Record<Kind,string>={clear:'Clear skies',cloudy:'Overcast',rain:'Light rain',storm:'Heavy rain',snow:'Snowfall',fog:'Valley mist',wind:'Windy',dust:'Dust and ash',ash:'Falling volcanic ash'};
export function weatherFor(region:string,biome:string,day:number,minute:number):Kind{
  const rng=seededRandom(`weather:${region}:${day}:${Math.floor(minute/480)}`),value=rng();
  if(region==='darkav')return 'ash';
  if(region==='rindass')return value<.3?'dust':value<.6?'wind':'clear';
  if(region==='frostlands'||biome==='snowfield')return value<.5?'snow':value<.7?'fog':'cloudy';
  if(biome==='wetland'&&minute<600)return 'fog';
  if(value<.25)return 'clear';if(value<.45)return 'cloudy';if(value<.7)return 'rain';if(value<.82)return 'storm';
  return minute<600?'fog':'wind';
}
/** One bounded screen canvas, one precipitation state, gradual transitions.
 * Weather is deterministically restored from the saved region/day/clock. */
export class WeatherSystem {
  readonly presentation:WeatherPresentation={kind:'clear',strength:0,elapsed:0,cloudCover:0,wind:.18,mist:0,region:'trandum',fogTint:REGION_SCENERY.trandum.fogTint};
  get ashArtwork(){return this.ashArt;}
  get fogArtwork(){return this.fogArt.densityArtwork;}
  get particleSeeds(){return this.points;}
  private readonly texture:Phaser.Textures.CanvasTexture;
  private readonly overlay:Phaser.GameObjects.Image;
  private readonly tint:Phaser.GameObjects.Image;
  private kind:Kind='clear';private target:Kind='clear';private strength=0;private elapsed=0;private drawMs=100;
  private roofMs=500;private roofs:Rect[]=[];
  private readonly groundPoint={x:0,y:0};
  private lastAmbienceUpdateAt=-Infinity;
  private lastAmbienceMuted=false;
  private readonly fogArt=new FogArt();private ambientMist=0;
  private readonly ashArt=new AshfallArt();
  private readonly points:Array<{x:number;y:number;speed:number;phase:number}>;
  private audio:AudioContext|null=null;private gain:GainNode|null=null;private source:AudioBufferSourceNode|null=null;
  private audioBus:GainNode|null=null;private audioFilter:BiquadFilterNode|null=null;
  private music: HTMLAudioElement | null = null;private nextMusic:HTMLAudioElement|null=null;
  private readonly nature=new NatureAmbience();
  private musicLevel=0;private musicSource:string|null=null;private musicOverride:string|null=null;
  private readonly musicStarting=new Set<HTMLAudioElement>();
  private musicMuted=false;
  private currentRegion:RegionId='trandum';private musicFadeElapsed=0;private audioUnlocked=false;
  private weatherRegion:RegionId|null=null;private weatherBiome:string|null=null;private weatherDay=-1;private weatherPeriod=-1;private weatherBefore600:boolean|null=null;
  private weatherSample:{x:number;y:number;region:RegionId;biome:string}|null=null;
  private lightweight = getEffectsQuality() === 'low';
  private readonly onQualityChange = () => {
    this.lightweight = getEffectsQuality() === 'low';
    this.drawMs = 150; this.roofMs = 1000;
  };
  private destroyed=false;
  get windStrength(){return this.kind==='wind'||this.kind==='storm'||this.kind==='dust'||this.kind==='ash'?this.strength:.18+this.strength*.25;}
  get cloudCover(){return this.strength*({clear:0,cloudy:.8,rain:.65,storm:1,snow:.6,fog:.65,wind:.15,dust:.35,ash:.5}[this.kind]);}
  constructor(private readonly scene:Phaser.Scene,private readonly world:WorldGenerator){
    const viewport=overlayViewport(scene);
    const gpu=scene.game.registry.get('presentation')==='three-2.5d';
    this.texture=scene.textures.createCanvas('weather-overlay',gpu?1:Math.max(1,Math.round(viewport.width*(this.lightweight ? 0.65 : 1))),gpu?1:Math.max(1,Math.round(viewport.height*(this.lightweight ? 0.65 : 1))))!;
    this.overlay=scene.add.image(0,0,'weather-overlay').setOrigin(0).setScrollFactor(0).setDepth(999_990).setName('regional-weather');
    if(!scene.textures.exists('weather-tint')){
      const tint=scene.textures.createCanvas('weather-tint',1,1)!;
      const ctx=tint.getContext();ctx.fillStyle='#2a3a48';ctx.fillRect(0,0,1,1);tint.refresh();
    }
    this.tint=scene.add.image(0,0,'weather-tint').setOrigin(0).setScrollFactor(0).setDepth(999_989.999)
      .setVisible(false).setName('regional-weather-tint');
    const rng=seededRandom('weather-particles');this.points=Array.from({length:96},()=>({x:rng(),y:rng(),speed:.6+rng(),phase:rng()*6.28}));
    window.addEventListener(EFFECTS_QUALITY_EVENT,this.onQualityChange);
    window.addEventListener('mernondna-weather-audio',this.enableAudio);
    window.addEventListener('pointerdown',this.unlockAudio);
    window.addEventListener('keydown',this.unlockAudio);
    document.addEventListener('visibilitychange',this.visibility);
  }
  private visibility=()=>{
    if(document.hidden){void this.audio?.suspend().catch(()=>{});this.music?.pause();this.nextMusic?.pause();this.nature.pause();}
    else if(this.audioUnlocked){void this.audio?.resume().catch(()=>{});this.startMusic();}
  };
  private unlockAudio=()=>{if(!this.audioUnlocked||this.audio?.state==='suspended')this.enableAudio();};
  private enableAudio=()=>{
    try{if(!this.audio){this.audio=new AudioContext();const buffer=this.audio.createBuffer(1,this.audio.sampleRate*2,this.audio.sampleRate),channel=buffer.getChannelData(0);
      for(let i=0;i<channel.length;i++)channel[i]=(Math.random()-.5)*.5;
      this.source=this.audio.createBufferSource();this.source.buffer=buffer;this.source.loop=true;
      this.audioFilter=this.audio.createBiquadFilter();this.audioFilter.type='lowpass';this.audioFilter.frequency.value=700;
      this.audioBus=this.audio.createGain();this.audioBus.gain.value=0;
      this.gain=this.audio.createGain();this.gain.gain.value=0;
      this.source.connect(this.audioFilter).connect(this.gain).connect(this.audioBus).connect(this.audio.destination);this.source.start();
      }
      void this.audio.resume().catch(()=>{});
    }catch{/* Unsupported/muted audio never prevents play. */}
    this.audioUnlocked=true;
    this.nature.unlock();
    this.startMusic();
  };
  private startMusic(){
    if(this.destroyed||!this.audioUnlocked||document.hidden||this.musicMuted||this.musicLevel<=.001)return;
    const src=this.musicOverride??REGION_MUSIC[this.currentRegion];
    if(this.musicSource===src){if(this.music)this.playMusic(this.music);if(this.nextMusic)this.playMusic(this.nextMusic);return;}
    const resolved=new URL(src,document.baseURI).href;
    this.musicSource=src;
    if(this.music?.src===resolved&&!this.nextMusic){this.playMusic(this.music);return;}
    if(this.nextMusic?.src===resolved){this.playMusic(this.nextMusic);return;}
    if(this.nextMusic){
      if(this.music&&this.nextMusic.volume>this.music.volume){this.disposeMusic(this.music);this.music=this.nextMusic;}
      else this.disposeMusic(this.nextMusic);
      this.nextMusic=null;
    }
    if(!this.music){
      this.music=this.createMusic(src,this.musicLevel);
      this.playMusic(this.music);
      return;
    }
    this.nextMusic=this.createMusic(src,0);
    this.musicFadeElapsed=0;
    this.playMusic(this.nextMusic);
  }
  private createMusic(src:string,volume:number){
    const player=new Audio(src);player.loop=true;player.preload='auto';player.volume=volume;
    player.addEventListener('error',()=>console.error(`[audio] Regional music could not be loaded: ${src}`),{once:true});
    return player;
  }
  private playMusic(player:HTMLAudioElement){
    if(!player.paused||player.error||this.musicStarting.has(player))return;
    this.musicStarting.add(player);
    void player.play().then(()=>{
      if(this.destroyed||document.hidden||this.musicMuted||player!==this.music&&player!==this.nextMusic)player.pause();
    }).catch(error=>{if(!this.destroyed&&player.src)console.warn('[audio] Background music is waiting for a player gesture.',error);})
      .finally(()=>this.musicStarting.delete(player));
  }
  private disposeMusic(player:HTMLAudioElement){
    player.pause();player.removeAttribute('src');player.load();
  }
  private updateMusic(delta:number,minute:number,muted:boolean){
    this.musicMuted=muted;
    if(!this.audioUnlocked)return;
    if(muted||document.hidden){this.music?.pause();this.nextMusic?.pause();return;}
    const target=this.musicOverride ? .22 : natureMix(minute,this.currentRegion,'').music;
    this.musicLevel+=Math.max(-delta*.00014,Math.min(delta*.00014,target-this.musicLevel));
    if(this.musicLevel<=.001){if(this.music){this.music.volume=0;this.music.pause();}if(this.nextMusic){this.nextMusic.volume=0;this.nextMusic.pause();}return;}
    this.startMusic();
    if(!this.nextMusic){if(this.music)this.music.volume=this.musicLevel;return;}
    // Keep the previous recording audible until its replacement is playing.
    // Optional audio never gates room readiness or New Game/Continue.
    if(this.nextMusic.readyState<2||this.nextMusic.paused)return;
    this.musicFadeElapsed+=Math.max(0,delta);
    const progress=Math.min(1,this.musicFadeElapsed/1800);
    this.nextMusic.volume=this.musicLevel*progress;
    if(this.music)this.music.volume=this.musicLevel*(1-progress);
    if(progress===1){
      if(this.music)this.disposeMusic(this.music);
      this.music=this.nextMusic;this.nextMusic=null;this.music.volume=this.musicLevel;
    }
  }
  setMusicOverride(source:string|null){
    if(this.musicOverride===source)return;
    this.musicOverride=source;
    if(source){this.nature.pause();this.updateAmbience(this.currentRegion,'',0,true);}
  }
  updateInteriorAudio(delta:number,paused:boolean){
    if(this.destroyed)return;
    const state=useGameStore.getState();
    if(this.musicOverride)this.updateAmbience(this.currentRegion,'',0,true);
    this.updateMusic(Math.max(0,Math.min(100,delta)),state.minuteOfDay,paused||!state.weatherAudio);
  }
  update(delta:number,x:number,y:number,paused=false){
    const state=useGameStore.getState(),effects=getGraphicEffects();
    // Reuse world noise sampling until the camera/player has moved beyond the
    // local 80-world-unit radius. This does not change scenery rendering.
    const sample=this.weatherSample;
    const moved=!sample||Math.abs(x-sample.x)>80||Math.abs(y-sample.y)>80;
    const region=moved?this.world.getRegionAt(x,y):sample!.region;
    const biome=moved?this.world.getBiomeAt(x,y):sample!.biome;
    if(moved)this.weatherSample={x,y,region,biome};
    this.currentRegion=region;
    const period=Math.floor(state.minuteOfDay/480),before600=state.minuteOfDay<600;
    if(region!==this.weatherRegion||biome!==this.weatherBiome||state.day!==this.weatherDay
      ||period!==this.weatherPeriod||before600!==this.weatherBefore600){
      this.target=weatherFor(region,biome,state.day,state.minuteOfDay);
      this.weatherRegion=region;this.weatherBiome=biome;this.weatherDay=state.day;
      this.weatherPeriod=period;this.weatherBefore600=before600;
    }
    const step=Math.min(delta,100)/6000;
    if(this.target!==this.kind){this.strength=Math.max(0,this.strength-step);if(this.strength===0)this.kind=this.target;}
    else {const goal=this.kind==='clear'?0:this.kind==='snow'&&(state.day+Math.floor(state.minuteOfDay/480))%2?.55:1;
      this.strength+=Math.max(-step,Math.min(step,goal-this.strength));}
    this.elapsed+=delta;this.drawMs+=delta;this.roofMs+=delta;
    const night=nightStrength(state.minuteOfDay),dawn=state.minuteOfDay>=240&&state.minuteOfDay<540;
    const mistTarget=((night>.02&&!effects.nightMist)||(night<=.02&&!effects.daytimeFog))?0:region==='darkav'?.14:(dawn||night>.5)&&(biome==='forest'||biome==='wetland'||this.world.distanceToWater(x,y)<300)?(dawn ? .32 : .1):0;
    this.ambientMist+=Math.max(-step,Math.min(step,mistTarget-this.ambientMist));
    const weatherLabel=region==='darkav'?labels.ash:labels[this.kind];
    if(state.weatherLabel!==weatherLabel)state.hydrate({weatherLabel});
    this.updateAmbience(region,biome,night,paused||!state.weatherAudio||Boolean(this.musicOverride));
    const muted=paused||!state.weatherAudio;
    this.nature.update(delta,state.minuteOfDay,region,biome,muted||Boolean(this.musicOverride));
    this.updateMusic(Math.max(0,Math.min(100,delta)),state.minuteOfDay,muted);
    const presentation=this.presentation;
    presentation.kind=this.kind;presentation.strength=this.strength;presentation.elapsed=this.elapsed;
    presentation.cloudCover=this.cloudCover;presentation.wind=this.windStrength;presentation.region=region;
    presentation.fogTint=REGION_SCENERY[region].fogTint;
    presentation.mist=((night>.02&&!effects.nightMist)||(night<=.02&&!effects.daytimeFog))?0:Math.max(this.ambientMist,this.kind==='fog'?this.strength:0);
    if(this.scene.game.registry.get('presentation')==='three-2.5d'){
      this.overlay.setVisible(false);this.tint.setVisible(false);return;
    }
    const animatedPrecip=effects.weatherParticles&&['rain','storm','snow'].includes(this.kind);
    if(this.drawMs<(this.lightweight?(animatedPrecip?170:290):50))return;this.drawMs=0;
    const camera=this.scene.cameras.main,full=overlayViewport(this.scene);
    const ground=groundWorldView(this.scene),origin=projectedViewOrigin(this.scene,{x:0,y:0});
    const resolution=this.lightweight ? 0.65 : 1;
    const z=full.zoom*resolution,w=Math.max(1,Math.round(full.width*resolution)),h=Math.max(1,Math.round(full.height*resolution));
    if(this.texture.width!==w||this.texture.height!==h)this.texture.setSize(w,h);
    const fogAmount=((night>.02&&!effects.nightMist)||(night<=.02&&!effects.daytimeFog))?0:Math.max(this.ambientMist,this.kind==='fog'?this.strength:0);
    const ashAmount=effects.weatherParticles?(region==='darkav'?.65+.35*this.strength:this.kind==='ash'?this.strength:0):0;
    // Darkav ash must render over the night-darkness veil, but below local
    // lights/emissions so its red flakes glow without obscuring scenery.
    const depth=region==='darkav'?1_000_000.5:999_990;
    if(this.overlay.depth!==depth)this.overlay.setDepth(depth);
    if(this.tint.depth!==depth-.001)this.tint.setDepth(depth-.001);
    fitViewportOverlay(this.scene,this.overlay);
    fitViewportOverlay(this.scene,this.tint);
    const hasWeatherTint=this.strength>0&&['storm','rain','cloudy'].includes(this.kind);
    const hasWeatherParticles=effects.weatherParticles&&this.strength>0&&!['clear','cloudy','fog','ash'].includes(this.kind)&&region!=='darkav';
    const wet=this.kind==='rain'||this.kind==='storm';
    this.tint.setVisible(hasWeatherTint).setAlpha(this.strength*(this.kind==='storm'?.16:wet?.07:this.kind==='cloudy'?.1:0));
    const hasEffect=hasWeatherParticles||fogAmount>.001||ashAmount>.001;
    this.overlay.setVisible(hasEffect);
    if(!hasEffect)return;
    if(this.roofMs>(this.lightweight?850:350)){this.roofMs=0;
      this.roofs=authoredRoofs.query({left:ground.left-500,top:ground.top-500,right:ground.right+500,bottom:ground.bottom+500}).map(roof=>roof.bounds);}
    const ctx=this.texture.getContext();ctx.clearRect(0,0,w,h);
    // Uniform tint uses a one-pixel GPU image underneath the animated layer.
    // Overcast skies need no full-screen canvas uploads.
    this.fogArt.draw(ctx,w,h,origin.x,origin.y,this.elapsed,fogAmount,REGION_SCENERY[region].fogTint,night);
    this.ashArt.draw(ctx,w,h,origin.x,origin.y,this.elapsed,ashAmount,night);
    if(effects.weatherParticles&&region!=='darkav'&&this.kind!=='ash'&&this.kind!=='cloudy'&&this.kind!=='clear'&&this.kind!=='fog'){
      const count=this.lightweight?(this.kind==='storm'?42:wet?30:this.kind==='snow'?28:14)
        :this.kind==='storm'?96:wet?60:this.kind==='snow'?Math.floor(32+this.strength*40):20;
      for(let i=0;i<count;i++){const p=this.points[i],px=(p.x*w+this.elapsed*(wet?.08:.018)*p.speed)%w,
        py=(p.y*h+this.elapsed*(wet?.55:this.kind==='snow'?.04:.009)*p.speed)%h;
        const point=unprojectGroundPoint(this.scene,origin.x+px/z,origin.y+py/z,this.groundPoint),wx=point.x,wy=point.y;
        if((wet||this.kind==='snow')&&this.roofs.some(r=>wx>=r.left&&wx<=r.right&&wy>=r.top&&wy<=r.bottom))continue;
        ctx.globalAlpha=this.strength*(wet?.35:.5);ctx.strokeStyle=wet?'#b9d9ee':'#c5b287';ctx.fillStyle=this.kind==='snow'?'#e7f0f5':'#c5b287';
        if(wet){ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+3,py+10);ctx.stroke();}
        else{ctx.beginPath();ctx.ellipse(px+Math.sin(this.elapsed*.001+p.phase)*12,py,this.kind==='snow'?2:4,1.4,0,0,Math.PI*2);ctx.fill();}
      }ctx.globalAlpha=1;
    }
    this.texture.refresh();
  }
  private updateAmbience(region:string,biome:string,night:number,muted:boolean){
    if(!this.audio||!this.gain||!this.audioBus||!this.audioFilter)return;
    // WebAudio interpolates scheduled targets. Updating them at 90ms cadence
    // avoids per-frame AudioParam scheduling while immediate mute still works.
    if(muted===this.lastAmbienceMuted&&this.elapsed-this.lastAmbienceUpdateAt<90)return;
    this.lastAmbienceMuted=muted;this.lastAmbienceUpdateAt=this.elapsed;
    const now=this.audio.currentTime,coast=region==='dead-sea'||biome==='coast';
    this.audioBus.gain.setTargetAtTime(muted?0:1,now,.18);
    const weather=['rain','storm','wind','dust','ash'].includes(this.kind)
      ? this.strength*(this.kind==='storm'?.075:this.kind==='rain'?.052:.035):0;
    const bed=coast ? .013+Math.sin(this.elapsed*.0007)*.005 : biome==='forest' ? .005 :
      region==='nardorous'||region==='frostlands' ? .007 : region==='darkav' ? .005 : .004;
    this.gain.gain.setTargetAtTime(weather+bed,now,.8);
    this.audioFilter.frequency.setTargetAtTime(this.kind==='storm'?1500:this.kind==='rain'?1050:coast?420:260,now,1);
  }
  destroy(){if(this.destroyed)return;this.destroyed=true;
    window.removeEventListener(EFFECTS_QUALITY_EVENT,this.onQualityChange);
    window.removeEventListener('mernondna-weather-audio',this.enableAudio);window.removeEventListener('pointerdown',this.unlockAudio);window.removeEventListener('keydown',this.unlockAudio);
    document.removeEventListener('visibilitychange',this.visibility);this.source?.stop();
    if(this.music)this.disposeMusic(this.music);if(this.nextMusic)this.disposeMusic(this.nextMusic);void this.audio?.close().catch(()=>{});
    this.nature.destroy();
    this.fogArt.destroy();this.ashArt.destroy();this.overlay.destroy();this.tint.destroy();this.scene.textures.remove('weather-overlay');}
}

// LEIGHNERON_MOBILE_GRAPHICS_NPC_FIX_V1
