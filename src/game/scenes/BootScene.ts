import {PAINTED_MODEL_ATLASES} from '../presentation25d/PaintedMaterials';
import {preparePresentationSource} from '../presentation25d/resourcePreparation';
import Phaser from 'phaser';
import {installBootImageLoading} from '../systems/BootImageLoading';
import {isGameDisposing} from '../systems/gameLifetime';
import {heroBodySource,heroGrip} from '../../data/modularHero';
import {heroFrameData} from '../systems/heroFrameData';
import {isolateAtlasFrames} from '../systems/AtlasFrameIsolation';
import {SWORD_SOURCE,prepareEquippedSwords,loadAwakenedSwords} from '../systems/EquippedSwordVisual';
import {COMBAT_EFFECT_TEXTURE,DISTINCT_EFFECT_TEXTURE,prepareCombatArtEffects,prepareSlashWeaponEffect} from '../systems/CombatArtEffects';
import {applySkillWeaponPalette,skillBodyGuard} from '../systems/WeaponSkillPalette';
import {heroReferenceHeight} from '../../data/heroBodyRegistration';
import {CITIZEN_SOURCES,citizenArtBatches} from '../systems/RegionalCitizenArt';
import { ART_SHEETS, PLAYER_ANIMATIONS, NPC_ANIMATIONS, artFrameSize, HERO_VISIBLE_HEIGHT } from '../../data/art';
import { ENEMY_ANIMATIONS, type SpriteAnimation } from '../../data/animationPacks';
import { PLAYER_COMBO_ATTACK_ANIMATIONS, PLAYER_EFFECT_ANIMATIONS } from '../../data/spriteBoards';
import { PLAYER_SKILL_ANIMATIONS,PLAYER_SKILL_ART } from '../../data/playerSkillArt';
import { alphaFrameBounds,createSpriteCropper,spriteSubjectCanvas } from '../systems/spriteArt';
import {actorSpriteSubjects,actorSpriteGridSubjects,type ActorSpriteSubject} from '../systems/spriteComponents';
import { prepareEnvironmentLightArt } from '../systems/EnvironmentLightArt';
import { prepareBridgeRail } from '../systems/BridgeArt';
import { prepareTreeArt } from '../systems/TreeArt';
import {renderDensity} from '../systems/renderSizing';
import {prepareScorchedArt} from '../systems/ScorchedArt';
import {VEHICLE_ART,MOTION_ART,prepareVehicleArt} from '../systems/VehicleArt';
import {DRAGON_BREATH_ART,prepareDragonBreathArt} from '../systems/DragonBreathArt';
import {DIRECTIONAL_ENEMY_ART,validDirectionalSourceSize} from '../../data/directionalEnemyArt';
import {prepareDirectionalEnemyArt} from '../systems/DirectionalEnemyArt';
import {prepareNpcDirectionalIdleArt} from '../systems/NpcDirectionalIdleArt';
import {GUARD_MARCH_ART} from '../../data/guardMarchArt';
import {prepareGuardMarchArt} from '../systems/GuardMarchArt';
import {NPC_COMBAT_ART} from '../../data/npcCombatArt';
import {prepareNpcCombatArt} from '../systems/NpcCombatArt';
import {NPC_WALK_ART,npcWalkPath} from '../../data/npcWalkArt';
import {npcWalkArtBatches} from '../systems/NpcWalkArt';
import {BANDIT_COMBAT_ART,banditCombatPath} from '../../data/banditCombatArt';
import {prepareBanditCombatArt} from '../systems/BanditCombatArt';
import {prepareSaltKingArt} from '../systems/SaltKingArt';
import {preparePirateArt} from '../systems/PirateArt';
import {BOATSWAIN_ART,BOATSWAIN_GAIT_ART} from '../../data/boatswainArt';
import {prepareBoatswainArt} from '../systems/BoatswainArt';
import {GOBLIN_ART} from '../../data/goblinArt';
import {prepareGoblinArt} from '../systems/GoblinArt';
import {M14_ART} from '../../data/m14Art';
import {prepareOrcRaiderCombatArt} from '../systems/OrcRaiderArt';
import {FLAGSHIP_ART_PATH,preparePirateFlagshipArt} from '../systems/PirateFlagshipArt';
import {PIRATE_PATH,PIRATE_SIDE_PATH,PIRATE_GAIT_PATH} from '../../data/pirateArt';
import {PIRATE_ATTACK_PHASES} from '../../data/pirateMotion';
import {SALT_KING_STATES,SALT_KING_SIDE_PATH,SALT_KING_GAIT_PATH,saltKingArtPath} from '../../data/saltKingArt';
import {REFINED_ENEMY_ART,REFINED_ENEMY_STATES,refinedEnemyPath,prepareRefinedEnemyArt} from '../systems/RefinedEnemyArt';
import {VARKHUL_ATLAS_PAGES,isVarkhulTexture} from '../../data/varkhulArt';
import {prepareVarkhulArt} from '../systems/VarkhulArt';
import {ATTACK_WARNING_TEXTURE,registerAttackWarningFrames} from '../systems/attackWarning';
import {RABBIT_PATH,RABBIT_SOURCE,prepareRabbitArt} from '../systems/RabbitArt';
import {SQUIRREL_PATH,SQUIRREL_SOURCE,prepareSquirrelArt} from '../systems/SquirrelArt';
import {BIRD_PATH,BIRD_SOURCE,prepareWoodlandBirdArt} from '../systems/WoodlandBirdArt';
import {GULL_PATH,GULL_SOURCE,prepareCoastalGullArt} from '../systems/CoastalGullArt';



// Generated sprite sheets contain almost-transparent stray pixels outside the
// actual character. Use a visibility threshold before calculating render scale.
// Without this, the 360px-high idle character is scaled against a ~682px cell.
function heroVisibleBounds(
  rgba: Uint8ClampedArray,
  imageWidth: number,
  cell: readonly [number, number, number, number]
): readonly [number, number, number, number] | undefined {
  const [x, y, width, height] = cell;
  let left = x + width;
  let top = y + height;
  let right = x - 1;
  let bottom = y - 1;
  for (let py = y; py < y + height; py++) {
    for (let px = x; px < x + width; px++) {
      if (rgba[(py * imageWidth + px) * 4 + 3] <= 16) continue;
      left = Math.min(left, px);
      top = Math.min(top, py);
      right = Math.max(right, px);
      bottom = Math.max(bottom, py);
    }
  }
  return right >= left && bottom >= top
    ? [left, top, right - left + 1, bottom - top + 1]
    : undefined;
}

export class BootScene extends Phaser.Scene {
  private readonly failures: string[] = [];
  private sourceRepairAttempted=false;
  private startupCancelled=false;
  private startupPhase:'loading'|'repairing'|'preparing'|'world'='loading';

  private startupActive(){
    // Phaser calls create() before switching CREATING -> RUNNING. Rejecting
    // CREATING silently aborts finishStartup before its first await, leaving
    // both New Game and Continue permanently at "Loading artwork".
    const status=this.sys.settings.status;
    return !this.startupCancelled&&!isGameDisposing(this.game)&&
      (status===Phaser.Scenes.CREATING||status===Phaser.Scenes.RUNNING);
  }

  /** A missing Phaser TextureManager key resolves to its 32x32 placeholder,
   * which otherwise looks like a broken art manifest. Validate source keys and
   * sprite sizes before preparing any generated atlases. */
  private repairSpriteSources():boolean {
    const required=new Map<string,{expected?:readonly [number,number];name:string}>();
    for(const sheet of ART_SHEETS.filter(s=>s.key!=='walls'&&!isVarkhulTexture(s.key))){
      if(sheet.sources?.length){
        for(const frame of sheet.sources){
          const expected=sheet.key==='leigneron'?undefined:frame.imageSize;
          if(!required.has(frame.path))required.set(frame.path,{expected,name:frame.name});
        }
      }else required.set(sheet.path,{name:sheet.key});
    }
    // Standalone enemy locomotion sprites bypass ART_SHEETS and previously
    // bypassed the repair pass. Missing textures become Phaser 32x32 placeholders,
    // causing the misleading "expected complete actors" segmentation error.
    const invalid:Array<{key:string;file:string;expected?:readonly [number,number];actual:string}>=[];
    for(const [path,info] of required){
      const key='source:'+path,file=heroBodySource(path);
      const image=this.textures.exists(key)
        ?this.textures.get(key).getSourceImage() as HTMLImageElement|undefined:undefined;
      const actual=image?image.width+'x'+image.height:'missing image';
      if(!image||(info.expected&&(image.width!==info.expected[0]||image.height!==info.expected[1])))
        invalid.push({key,file,expected:info.expected,actual});
    }
    for(const art of DIRECTIONAL_ENEMY_ART.filter(a=>a.species!==6&&a.species!==5)){
      const key='directional-source:'+art.id,file=art.sourcePath;
      const image=this.textures.exists(key)
        ?this.textures.get(key).getSourceImage() as HTMLImageElement|undefined:undefined;
      if(!image||!validDirectionalSourceSize(image.width,image.height,art.sourceColumns))
        invalid.push({key,file,actual:image?image.width+'x'+image.height:'missing image'});
    }
    for(const page of VARKHUL_ATLAS_PAGES){
      const key='varkhul-source:'+page.texture;
      const image=this.textures.exists(key)?this.textures.get(key).getSourceImage() as HTMLImageElement:undefined;
      if(!image||image.width!==page.width||image.height!==page.height)
        invalid.push({key,file:page.path,expected:[page.width,page.height],actual:image?image.width+'x'+image.height:'missing image'});
    }
    if(!invalid.length)return false;
    if(this.sourceRepairAttempted){
      const details=invalid.slice(0,8).map(({file,expected,actual})=>
        file+': expected '+(expected?.join('x')??'complete sprite source')+', got '+actual).join('\n');
      this.registry.set('assetError',
        'Required artwork is missing or outdated after a retry:\n'+details+'\n'
        +'Refresh game files (keeps save), then reopen the game. Your saved progress is safe.');
      return true;
    }
    this.sourceRepairAttempted=true;
    this.startupPhase='repairing';
    this.registry.set('loadingStage','Repairing missing character artwork');
    this.registry.set('loadingProgress',0);
    const token=Date.now().toString(36);
    const repairedFiles=new Set(invalid.map(({file})=>file));
    for(let i=this.failures.length-1;i>=0;i--){
      const url=this.failures[i].split('?')[0];
      if([...repairedFiles].some(file=>url.endsWith(file)))this.failures.splice(i,1);
    }
    for(const {key,file} of invalid){
      if(this.textures.exists(key))this.textures.remove(key);
      this.load.image(key,file+(file.includes('?')?'&':'?')+'sprite-repair='+token);
    }
    this.load.once('complete',()=>this.create());
    this.load.start();
    return true;
  }

  constructor() {
    super('boot');
  }

  preload() {
    this.startupCancelled=false;
    const cancel=()=>{this.startupCancelled=true;};
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,cancel);
    this.events.once(Phaser.Scenes.Events.DESTROY,cancel);
    // XHR releases download slots before image decoding, so its concurrency
    // setting alone does not bound decoded images on a cold APK startup.
    // Image-element slots include decoding. Keep this specific to Boot:
    // gameplay loaders retain their XHR timeouts for interior/optional art.
    this.load.imageLoadType='HTMLImageElement';
    this.load.maxParallelDownloads=4;
    installBootImageLoading(this);
    this.registry.set('loadingLastAsset','Waiting for first asset');
    this.load.on('filecomplete',(key:string)=>this.registry.set('loadingLastAsset',key));
    for(const atlas of PAINTED_MODEL_ATLASES)this.load.image(atlas.key,atlas.path);
    this.load.image(SWORD_SOURCE,'assets/items/equipment-v1.png');
    loadAwakenedSwords(this);
    this.load.image(COMBAT_EFFECT_TEXTURE,'assets/effects/combat-arts-v1.png');
    this.load.image(DISTINCT_EFFECT_TEXTURE,'assets/effects/distinct-combat-arts-v2.png');
    for(const source of CITIZEN_SOURCES)this.load.image(source.key,source.path);
    this.failures.length = 0;
    this.registry.set('loadingProgress',0);
    this.registry.set('loadingStage','Loading artwork');
    this.load.on('progress',(progress:number)=>this.registry.set('loadingProgress',progress));
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      this.registry.set('loadingLastAsset',String(file.key)+' (load error)');
      if (file.type === 'audio') {
        console.warn(`[audio] Could not load ${file.url}`);
        return;
      }
      this.failures.push(String(file.url));
    });
    // Gameplay SFX are decoded after WorldScene is ready. Missing sounds are
    // already handled by combat's audio-cache guards; they cannot block boot.
    this.load.image(ATTACK_WARNING_TEXTURE,'assets/ui/actions/attack_warning.png');
    this.load.image(RABBIT_SOURCE,RABBIT_PATH);
    this.load.image(SQUIRREL_SOURCE,SQUIRREL_PATH);
    this.load.image(BIRD_SOURCE,BIRD_PATH);
    this.load.image(GULL_SOURCE,GULL_PATH);
    this.load.image('pirate-source',PIRATE_PATH);
    this.load.image('pirate-side-source',PIRATE_SIDE_PATH);
    this.load.image('pirate-gait-source',PIRATE_GAIT_PATH);
    for(const [kind,art] of Object.entries(BOATSWAIN_ART))this.load.image('boatswain-source:'+kind,art.path);
    for(const [kind,art] of Object.entries(BOATSWAIN_GAIT_ART))this.load.image('boatswain-gait-source:'+kind,art.path);
    for(const [kind,art] of Object.entries(GOBLIN_ART))this.load.image('goblin-source:'+kind,art.path);
    this.load.image('salt-king-source:side',SALT_KING_SIDE_PATH);
    this.load.image('salt-king-source:gait',SALT_KING_GAIT_PATH);
    this.load.image('flagship-source',FLAGSHIP_ART_PATH);
    for(const [kind,art] of Object.entries(VEHICLE_ART))this.load.image('vehicle-source:'+kind,art.path);
    for(const [key,path] of Object.entries(MOTION_ART))this.load.image('motion-source:'+key,path);
    this.load.image('dragon-breath-source',DRAGON_BREATH_ART);
    for(const art of GUARD_MARCH_ART)this.load.image('guard-march-source:'+art.walk,art.path);
    for(const art of NPC_WALK_ART)this.load.image('npc-walk-source:'+art.walk,npcWalkPath(art));
    for(const art of NPC_COMBAT_ART.filter(a=>a.eager))for(const [i,source] of art.sources.entries())
      this.load.image(`npc-combat-source:${art.id}:${i}`,source.path);
    for (const art of DIRECTIONAL_ENEMY_ART.filter(a => a.species !== 6&&a.species!==5)) {
      this.load.image('directional-source:' + art.id, art.sourcePath);
    }
    this.load.image('rindass-orc-raider:actions','assets/enemies/rindass_orc_raider/actions.png');
    for(const state of ['walk',...SALT_KING_STATES] as const)this.load.image('salt-king-source:'+state,saltKingArtPath(state));
    for(const art of BANDIT_COMBAT_ART)this.load.image('bandit-combat-source:'+art.state,banditCombatPath(art.state));
    for(const art of REFINED_ENEMY_ART)for(const state of REFINED_ENEMY_STATES)
      this.load.image(`refined-source:${art.id}:${state}`,refinedEnemyPath(art.id,state));
    for(const page of VARKHUL_ATLAS_PAGES)this.load.image('varkhul-source:'+page.texture,page.path);

    const files = new Set<string>();
    for (const sheet of ART_SHEETS.filter(s => s.key !== 'walls'&&!isVarkhulTexture(s.key))) {
      if (sheet.sources) {
        for (const source of sheet.sources) files.add(source.path);
      } else {
        files.add(sheet.path);
      }
    }
    for (const path of files) this.load.image(`source:${path}`, heroBodySource(path));
  }

  /** Shared production packer; focused art reviews may load only hero sheets. */
  private async yieldArtworkFrame(){
    // Flush canvas uploads and let Android WebView process input/GC between
    // atlas batches instead of monopolizing its UI thread for all assets.
    await new Promise<void>(resolve=>window.setTimeout(resolve,0));
  }

  async prepareRegisteredSheets(sheets:typeof ART_SHEETS=ART_SHEETS.filter(s=>!isVarkhulTexture(s.key))){
    const pixels = new Map<string, { data: Uint8ClampedArray; width: number }>();
    const remainingSources=new Map<string,number>();
    for(const sheet of sheets.filter(s=>s.key!=='walls'))
      for(const path of new Set([sheet.path,...(sheet.sources?.map(source=>source.path)??[])]))
        remainingSources.set(path,(remainingSources.get(path)??0)+1);
    const loaded = new Set<string>();
    const heroFits=new Map<string,number>();
    const sideWalkPath=sheets.find(sheet=>sheet.key==='leigneron')?.sources?.[6]?.path;
    const heroGrounds=new Map<string,number>();
    const drawEnemyPose=createSpriteCropper();

    let sheetsPrepared=0;
    const totalSheets=sheets.filter(s=>s.key!=='walls').length;
    for (const sheet of sheets.filter(s => s.key !== 'walls')) {
      if(!this.startupActive())return loaded;
      this.registry.set('loadingStage',`Preparing sprite sheets ${++sheetsPrepared}/${totalSheets}`);
      // Some multi-source sheets use a descriptive path that is not itself
      // queued as an image. The first registered frame source is the correct
      // reference for those sheets; never accept Phaser's missing placeholder.
      const primaryPath=sheet.sources?.[0]?.path??sheet.path;
      const source = this.textures.get(`source:${primaryPath}`).getSourceImage() as HTMLImageElement;
      loaded.add(primaryPath);
      const columns = sheet.atlasColumns ?? sheet.columns;
      const width = sheet.frameWidth * sheet.density;
      const height = sheet.frameHeight * sheet.density;
      const texture = this.textures.createCanvas(
        sheet.key,
        columns * width,
        Math.ceil(sheet.columns / columns) * height
      );
      if (!texture) throw new Error(`Cannot prepare ${sheet.key} art`);

      const ctx = texture.getContext();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      const scaleX = sheet.sourceSize ? source.width / sheet.sourceSize[0] : 1;
      const scaleY = sheet.sourceSize ? source.height / sheet.sourceSize[1] : 1;
      const isHeroWalk = sheet.key === 'leigneron';
      const isHeroArt = isHeroWalk || sheet.key === 'leigneron_idle' ||
        sheet.key === 'leigneron_idle_sides' || sheet.key === 'leigneron_running';
      let spearmanSubjects:ActorSpriteSubject[]|undefined;
      let attackSubjects:ActorSpriteSubject[]|undefined;
      let attackFits:number[]|undefined,attackGrounds:number[]|undefined;
      let skillFit:number|undefined,skillGround:number|undefined;
      const heroSkill=PLAYER_SKILL_ART.find(art=>art.texture===sheet.key);
      let spearmanFit:number|undefined;

      for (let frame = 0; frame < sheet.columns; frame++) {
        const packed = sheet.sources?.[frame];
        const frameSource = packed
          ? this.textures.get(`source:${packed.path}`).getSourceImage() as HTMLImageElement
          : source;

        const wrongDimensions = packed && (
          frameSource.width !== packed.imageSize[0] ||
          frameSource.height !== packed.imageSize[1]
        );
        if (wrongDimensions) {
          if (!isHeroWalk) {
            throw new Error(
              `Sprite dimensions disagree with manifest: ${packed.path}; ` +
              `expected ${packed.imageSize[0]}x${packed.imageSize[1]}, ` +
              `loaded ${frameSource.width}x${frameSource.height}`
            );
          }
          // Hero walk frames are six horizontal frames per image. Use the
          // actual image size when stale metadata describes an older export.
          if (frame % 6 === 0) {
            console.warn(
              `[hero art] ${packed.path}: manifest=${packed.imageSize.join('x')}, ` +
              `loaded=${frameSource.width}x${frameSource.height}; using loaded dimensions`
            );
          }
        }

        if ((packed || sheet.trimRegions) && !pixels.has(packed?.path ?? sheet.path)) {
          const canvas = document.createElement('canvas');
          canvas.width = frameSource.width;
          canvas.height = frameSource.height;
          const context = canvas.getContext('2d', { willReadFrequently: true })!;
          context.drawImage(frameSource, 0, 0);
          const pixelPath = packed?.path ?? sheet.path;
          pixels.set(pixelPath, {
            data: context.getImageData(0, 0, canvas.width, canvas.height).data,
            width: canvas.width
          });
          loaded.add(pixelPath);
        }

        const sourceWidth = source.width / sheet.columns;
        const inset = sheet.sourceInset ?? 0;
        const data = packed
          ? pixels.get(packed.path)
          : sheet.trimRegions ? pixels.get(sheet.path) : undefined;
        // Hero artwork: 6 horizontal frames, regardless of PNG dimensions.
        // Floor boundaries prevent fractional-pixel gaps for 2048px strips.
        const heroStart = Math.floor((frame % 6) * frameSource.width / 6);
        const heroEnd = Math.floor(((frame % 6) + 1) * frameSource.width / 6);
        const cell = isHeroWalk && packed && wrongDimensions
          ? [heroStart, 0, heroEnd - heroStart, frameSource.height] as const
          : sheet.key==='leigneron_attack'&&packed
          ? [Math.max(0,packed.cell[0]-12),Math.max(0,packed.cell[1]-12),
              Math.min(frameSource.width,packed.cell[0]+packed.cell[2]+12)-Math.max(0,packed.cell[0]-12),
              Math.min(frameSource.height,packed.cell[1]+packed.cell[3]+12)-Math.max(0,packed.cell[1]-12)] as const
          : packed?.cell ?? sheet.regions?.[frame];
        // The throw/death boards are spaced by whole subjects, not exact cells:
        // spear tips and fallen bodies cross the manifest's nominal seams.
        // Segment once per board and copy ONLY owned pixels, never neighboring art.
        const spearmanBoard=sheet.key==='enemy_orc_spearman_actions'||sheet.key==='enemy_orc_spearman_states';
        if(spearmanBoard&&data&&!spearmanSubjects){
          spearmanSubjects=actorSpriteSubjects(data.data,data.width,frameSource.height,6,4,`${sheet.key}: ${packed?.path??sheet.path}`);
          const neutral=this.textures.get('enemy_orc_spearman').get(0).customData as {visibleBounds:{height:number}};
          spearmanFit=neutral.visibleBounds.height/spearmanSubjects[0].region[3];
        }
        const subject=spearmanSubjects?.[frame];
        if(sheet.key==='leigneron_attack'&&data&&!attackSubjects){
          attackSubjects=actorSpriteSubjects(data.data,data.width,frameSource.height,6,4,`${sheet.key}: ${packed?.path??sheet.path}`);
          attackFits=Array.from({length:4},(_,direction)=>HERO_VISIBLE_HEIGHT/heroReferenceHeight(
            [0,5].map(i=>attackSubjects![direction*6+i].region[3])));
          attackGrounds=Array.from({length:4},(_,direction)=>Math.max(...attackSubjects!.slice(direction*6,direction*6+6).map(s=>s.region[1]+s.region[3])));
        }
        if(heroSkill&&packed&&data&&skillFit===undefined){
          // Measure only neutral body poses, never a spell's full FX extent.
          const references=[0,5].map(i=>heroVisibleBounds(data.data,data.width,skillBodyGuard(sheet.key,i)??sheet.sources![i].cell));
          if(references.some(r=>!r))throw new Error(`Missing neutral hero skill pose: ${sheet.key}`);
          const bodies=references.filter((r):r is readonly [number,number,number,number]=>Boolean(r));
          skillFit=HERO_VISIBLE_HEIGHT/heroReferenceHeight(bodies.map(r=>r[3]));
          skillGround=Math.max(...bodies.map(r=>r[1]+r[3]));
        }
        const region = subject?.region ?? attackSubjects?.[frame]?.region ?? (data && cell
          ? isHeroArt
            ? heroVisibleBounds(data.data, data.width, cell)
            : alphaFrameBounds(data.data, data.width, cell)
          : sheet.regions?.[frame]);

        if (packed && !region) throw new Error(`Empty sprite frame: ${packed.name}`);
        if (packed && region && !isHeroWalk && !packed.renderScale && sheet.contentSize &&
            (region[2] > sheet.contentSize[0] || region[3] > sheet.contentSize[1])) {
          throw new Error(`Sprite alpha bounds changed; update art metadata: ${packed.name}`);
        }

        const size = artFrameSize(sheet.key, frame);
        if(isHeroArt && data && !heroFits.has(packed?.path??sheet.path)) {
          const cells=packed?sheet.sources!.filter(s=>s.path===packed.path).map((s,i)=>isHeroWalk&&wrongDimensions
            ?[Math.floor(i%6*frameSource.width/6),0,Math.floor((i%6+1)*frameSource.width/6)-Math.floor(i%6*frameSource.width/6),frameSource.height] as const:s.cell):sheet.regions!;
          const bounds=cells.map(c=>heroVisibleBounds(data.data,data.width,c)).filter((r):r is readonly [number,number,number,number]=>Boolean(r));
          if(!packed?.groundAnchor)heroGrounds.set(packed?.path??sheet.path,Math.max(...bounds.map(r=>r[1]+r[3])));
          // Sprint source art shares walking anatomy/source units. Its bent
          // knees and forward lean must make it LOWER, not trigger enlargement.
          const runFit=sheet.key==='leigneron_running'
            ?(sideWalkPath?heroFits.get(sideWalkPath):undefined)??packed?.renderScale:undefined;
          heroFits.set(packed?.path??sheet.path,Math.min((sheet.frameWidth-4)/Math.max(...bounds.map(r=>r[2])),
            runFit??HERO_VISIBLE_HEIGHT/heroReferenceHeight(bounds.map(r=>r[3]))));
        }
        const fit = isHeroArt && region
          ? heroFits.get(packed?.path??sheet.path)!
          : attackFits?.[Math.floor(frame/6)] ?? skillFit ?? spearmanFit ?? packed?.renderScale ?? (sheet.contentSize
            ? Math.min(
                (sheet.frameWidth - 4) / sheet.contentSize[0],
                (sheet.frameHeight - 4) / sheet.contentSize[1]
              )
            : 1);
        // Alpha trimming must not stretch a silhouette back into its untrimmed box.
        const regionFit = isHeroArt
          ? fit
          : !packed && region && cell && !sheet.contentSize
            ? size.width / cell[2]
            : fit;
        const drawWidth = (region && (packed || sheet.trimRegions)
          ? region[2] * regionFit : size.width) * sheet.density;
        const drawHeight = (region && (packed || sheet.trimRegions)
          ? region[3] * regionFit : size.height) * sheet.density;
        let subjectRoot=subject?subject.region[2]/2:0;
        if(subject&&(sheet.key==='enemy_orc_spearman_actions'||frame%6<3)){
          const w=subject.region[2],h=subject.region[3];let weightedX=0,weight=0;
          for(let py=Math.floor(h*.84);py<h;py++)for(let px=0;px<w;px++){
            const alpha=subject.pixels[(py*w+px)*4+3];
            if(alpha>128){weightedX+=px*alpha;weight+=alpha;}
          }
          if(weight)subjectRoot=weightedX/weight;
        }
        const x = (frame % columns) * width;
        const y = Math.floor(frame / columns) * height;

        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, width, height);
        ctx.clip();
        // Register side strides by their body/ground anchor, rather than the
        // changing weapon/cape silhouette, so alpha trimming cannot move the head.
        const drawX = subject&&region
          ? x+width/2-subjectRoot*fit*sheet.density
          : packed?.groundAnchor && region
          ? x + width / 2 + (region[0] - packed.groundAnchor[0]) * fit * sheet.density
          // Preserve authored frame center across hero walk/run silhouettes.
          // Recentring each trimmed alpha silhouette makes the torso jitter.
          : isHeroArt && region && cell
          ? x + width / 2 + (region[0] - (cell[0] + cell[2] / 2)) * fit * sheet.density
          : isHeroArt
          ? x + (width - drawWidth) / 2
          : packed?.anchor && region
            ? x + width / 2 + (region[0] - packed.anchor[0]) * fit * sheet.density
            : x + (width - drawWidth) / 2;
        const drawY = subject&&region
          ? y+height-(sheet.groundPadding??2)*sheet.density-region[3]*fit*sheet.density
          : attackGrounds&&region
          ? y+height-(sheet.groundPadding??2)*sheet.density+(region[1]-attackGrounds[Math.floor(frame/6)])*fit*sheet.density
          : packed?.groundAnchor && region
          ? y + height - (sheet.groundPadding??2) * sheet.density + (region[1] - packed.groundAnchor[1]) * fit * sheet.density
          // Don't reset the hero's vertical foot position from each cropped
          // silhouette. Use the source frame's fixed ground baseline instead.
          : isHeroArt && region && cell
          ? y + height - (sheet.groundPadding??2) * sheet.density + (region[1] - (heroGrounds.get(packed?.path??sheet.path)??(cell[1] + cell[3]))) * fit * sheet.density
          : isHeroArt
          ? y + height - 2 * sheet.density - drawHeight
          : packed?.anchor && region
            ? y + height / 2 + (region[1] - (skillGround===undefined?packed.anchor[1]:skillGround-20/fit)) * fit * sheet.density
            : y + (region ? height - 2 * sheet.density - drawHeight : 0);

        // Tiny original pixel sprites must not be blurred by an interpolated
        // upscale before the renderer samples them a second time.
        const enemySheet=sheet.key==='enemies'||sheet.key.startsWith('enemy_');
        const scenery=Boolean(sheet.regions)&&sheet.key!=='terrain'&&!enemySheet
          &&!sheet.key.startsWith('npc')&&!sheet.key.startsWith('effect_')&&!sheet.key.startsWith('skill_')
          &&!sheet.key.startsWith('leigneron');
        ctx.imageSmoothingEnabled=!enemySheet||drawHeight<=(region?.[3]??frameSource.height);
        if(subject&&region)drawEnemyPose(ctx,spriteSubjectCanvas(subject),[0,0,region[2],region[3]],drawX,drawY,drawWidth,drawHeight);
        else if(attackSubjects&&region){
          // The expanded rear-attack crops contain boots from the row above.
          // Keep the original crop/registration, but copy only this whole pose.
          const owned=attackSubjects[frame],clean=document.createElement('canvas');
          clean.width=region[2];clean.height=region[3];
          clean.getContext('2d')!.drawImage(spriteSubjectCanvas(owned),owned.region[0]-region[0],owned.region[1]-region[1]);
          drawEnemyPose(ctx,clean,[0,0,region[2],region[3]],drawX,drawY,drawWidth,drawHeight);
        }
        else if(scenery&&region){
          // Irregular prop crops can include a cut sliver of an adjacent object.
          // Retain detached interior leaves/flame sparks; remove foreign pieces
          // cut by the crop edge without changing the prop's registration.
          const clean=document.createElement('canvas');
          clean.width=Math.round(region[2]*scaleX);clean.height=Math.round(region[3]*scaleY);
          const read=clean.getContext('2d',{willReadFrequently:true})!;
          read.drawImage(frameSource,region[0]*scaleX,region[1]*scaleY,clean.width,clean.height,0,0,clean.width,clean.height);
          const owned=actorSpriteGridSubjects(read.getImageData(0,0,clean.width,clean.height).data,
            clean.width,clean.height,1,1,{rejectEdgeFragments:true,keepDetachedDetails:true})[0];
          read.clearRect(0,0,clean.width,clean.height);
          read.drawImage(spriteSubjectCanvas(owned),owned.region[0],owned.region[1]);
          drawEnemyPose(ctx,clean,[0,0,clean.width,clean.height],drawX,drawY,drawWidth,drawHeight);
        }
        else drawEnemyPose(
          ctx,frameSource,[
          region ? region[0] * (packed ? 1 : scaleX) : frame * sourceWidth + inset,
          region ? region[1] * (packed ? 1 : scaleY) : inset,
          region ? region[2] * (packed ? 1 : scaleX) : sourceWidth - inset * 2,
          region ? region[3] * (packed ? 1 : scaleY) : source.height - inset * 2],
          drawX, drawY, drawWidth, drawHeight
        );
        ctx.restore();
        const preparedFrame=texture.add(frame,0,x,y,width,height);
        if(preparedFrame)preparedFrame.customData={visibleBounds:{left:(drawX-x)/sheet.density,top:(drawY-y)/sheet.density,width:drawWidth/sheet.density,height:drawHeight/sheet.density},
          ...(subject?{isolatedSubject:true,foreignProbes:subject.foreignProbes}:{}),
          sourceRegion:region?[...region]:undefined,sourceFit:regionFit,
          sourcePath:packed?.path??sheet.path,sourceImageSize:[frameSource.width,frameSource.height],fullSprite:true};
        const registered=heroGrip(packed?.path??sheet.path,frame,frameSource.width,frameSource.height);
        if(preparedFrame&&registered&&region)heroFrameData(preparedFrame).weaponGrip={
          x:drawX-x+(registered.x-region[0])*regionFit*sheet.density,
          y:drawY-y+(registered.y-region[1])*regionFit*sheet.density,
          angle:registered.angle,behind:registered.behind,
        };
        if(preparedFrame&&registered)heroFrameData(preparedFrame).heroDensity=sheet.density;
      }

      if (sheet.blackBackground) {
        const imageData = ctx.getImageData(0, 0, texture.width, texture.height);
        for (let i = 0; i < imageData.data.length; i += 4) {
          if (imageData.data[i] < 12 &&
              imageData.data[i + 1] < 12 &&
              imageData.data[i + 2] < 12) {
            imageData.data[i + 3] = 0;
          }
        }
        ctx.putImageData(imageData, 0, 0);
      }
      texture.refresh();
      texture.setFilter(sheet.key==='enemies'||sheet.key.startsWith('enemy_')?Phaser.Textures.FilterMode.NEAREST:Phaser.Textures.FilterMode.LINEAR);
      if(sheet.key!=='elarion_tree')prepareEnvironmentLightArt(this, sheet.key);
      // Avoid retaining decoded RGBA buffers from every character sheet and
      // remove source textures as soon as the last dependent atlas is ready.
      pixels.clear();
      for(const path of new Set([sheet.path,...(sheet.sources?.map(source=>source.path)??[])])){
        const remaining=(remainingSources.get(path)??0)-1;
        if(remaining>0)remainingSources.set(path,remaining);
        else{
          remainingSources.delete(path);
          if(this.textures.exists(`source:${path}`))this.textures.remove(`source:${path}`);
        }
      }
      if(sheetsPrepared%2===0)await this.yieldArtworkFrame();
    }
    return loaded;
  }

  create() {
    this.startupPhase='preparing';
    void this.finishStartup().then(()=>{
      // A lifecycle guard must not silently strand the loading screen. Repair
      // deliberately waits for another loader pass; successful preparation
      // must queue the world, while cancellation must do neither.
      if(this.startupActive()&&this.startupPhase==='preparing'&&!this.registry.get('assetError'))
        throw new Error('Artwork preparation ended without starting the world');
    }).catch(error=>{
      if(!this.startupActive())return;
      const stage=this.registry.get('loadingStage');
      const detail=error instanceof Error?error.message:String(error);
      console.error('[startup] Failed while',stage,error);
      this.registry.set('assetError',`Art preparation failed during ${String(stage??'startup')}: ${detail}. The stored save has not been changed.`);
    });
  }

  private async finishStartup() {
    if(!this.startupActive())return;
    // Check registered textures *before* reporting generic file failures;
    // a single missing sprite can be repaired without discarding the save.
    if(this.repairSpriteSources())return;
    if (this.failures.length) {
      const message = `Art could not load:\n${this.failures.join('\n')}\nCheck public/assets and the pack manifests, then reload.`;
      this.registry.set('assetError', message);
      const density=renderDensity(this);
      this.add.text(20*density,20*density,message,{
        fontSize: `${16*density}px`, color: '#ffe1bd',
        wordWrap: { width: Math.max(280*density,this.scale.width-40*density) }
      });
      return;
    }
    this.registry.set('loadingStage','Preparing essential artwork');
    await this.yieldArtworkFrame();
    if(!this.startupActive())return;
    registerAttackWarningFrames(this);
    prepareCombatArtEffects(this);
    prepareCombatArtEffects(this,DISTINCT_EFFECT_TEXTURE,'distinct-art-effect');
    await this.yieldArtworkFrame();
    if(!this.startupActive())return;
    for(const culture of citizenArtBatches(this)){
      this.registry.set('loadingStage',`Preparing citizens · ${culture}`);
      await this.yieldArtworkFrame();
      if(!this.startupActive())return;
    }
    await this.yieldArtworkFrame();
    if(!this.startupActive())return;
    prepareEquippedSwords(this);

    prepareVehicleArt(this);
    prepareDragonBreathArt(this);
    await this.yieldArtworkFrame();
    if(!this.startupActive())return;
    const loaded=await this.prepareRegisteredSheets();
    if(!this.startupActive())return;

    this.registry.set('loadingStage','Preparing wildlife and enemy animations');
    await this.yieldArtworkFrame();
    if(!this.startupActive())return;
    prepareRabbitArt(this);
    prepareSquirrelArt(this);
    prepareWoodlandBirdArt(this);
    prepareCoastalGullArt(this);
    prepareOrcRaiderCombatArt(this);
    await this.yieldArtworkFrame();
    if(!this.startupActive())return;
    prepareRefinedEnemyArt(this);
    await this.yieldArtworkFrame();
    if(!this.startupActive())return;
    const directionalEnemyAnimations=[...prepareDirectionalEnemyArt(this),...prepareVarkhulArt(this)];
    await this.yieldArtworkFrame();
    if(!this.startupActive())return;
    prepareBanditCombatArt(this);
    await this.yieldArtworkFrame();
    if(!this.startupActive())return;
    this.registry.set('loadingStage','Preparing boss and companion artwork');
    const saltKingAnimations=prepareSaltKingArt(this);
    const pirateAnimations=preparePirateArt(this);
    await this.yieldArtworkFrame();
    if(!this.startupActive())return;
    prepareBoatswainArt(this);
    prepareGoblinArt(this);
    preparePirateFlagshipArt(this);
    await this.yieldArtworkFrame();
    if(!this.startupActive())return;
    const directionalNpcIdles=prepareNpcDirectionalIdleArt(this);
    const npcWalkAnimations:SpriteAnimation[]=[];
    for(const clips of npcWalkArtBatches(this)){
      npcWalkAnimations.push(...clips);
      this.registry.set('loadingStage',`Preparing resident movement · ${npcWalkAnimations.length} clips`);
      await this.yieldArtworkFrame();
      if(!this.startupActive())return;
    }
    await this.yieldArtworkFrame();
    if(!this.startupActive())return;
    // Directional idles/portraits have already captured the original poses.
    // Retire replaced walking atlases instead of doubling resident GPU memory.
    for(const art of NPC_WALK_ART)this.textures.remove(art.walk);
    const guardMarchAnimations=prepareGuardMarchArt(this);
    const npcCombatAnimations=prepareNpcCombatArt(this);
    await this.yieldArtworkFrame();
    if(!this.startupActive())return;
    prepareScorchedArt(this);
    prepareBridgeRail(this);
    prepareTreeArt(this);
    for (const path of loaded) if(this.textures.exists(`source:${path}`))this.textures.remove(`source:${path}`);
    const animations: SpriteAnimation[] = [
      ...PLAYER_ANIMATIONS,
      ...NPC_ANIMATIONS.filter(a=>![...GUARD_MARCH_ART,...NPC_WALK_ART].some(g=>a.key.startsWith(g.walk+'-')&&!a.key.endsWith('-idle'))),
      ...npcWalkAnimations,
      ...guardMarchAnimations,
      ...npcCombatAnimations,
      ...directionalNpcIdles,
      ...ENEMY_ANIMATIONS.filter(a=>!M14_ART.some(spec=>spec.texture===a.texture)),
      ...directionalEnemyAnimations,
      ...saltKingAnimations,
      ...pirateAnimations,
      ...PIRATE_ATTACK_PHASES,
      ...PLAYER_COMBO_ATTACK_ANIMATIONS.flat(),
      ...PLAYER_EFFECT_ANIMATIONS,
      ...PLAYER_SKILL_ANIMATIONS
    ];
    for (const { key, texture, frames, frameRate, repeat, frameDurations } of animations) {
      this.anims.create({
        key,
        // A per-frame duration overrides Phaser's normal frame interval.
        frames: frames.map((frame,index) => ({ key: texture, frame,
          duration:frameDurations?.[index] ?? 0,
        })),
        frameRate,
        repeat
      });
    }
    prepareSlashWeaponEffect(this);
    await this.yieldArtworkFrame();
    if(!this.startupActive())return;
    // All derived layers are ready. Repack runtime atlases with clear sampling
    // gutters; terrain and tile textures are deliberately excluded.
    const atlasKeys=this.textures.getTextureKeys();
    let optimized=0;
    for(const key of atlasKeys){
      if(!this.startupActive())return;
      this.registry.set('loadingStage',`Optimizing atlases ${++optimized}/${atlasKeys.length}`);
      const texture=this.textures.get(key);
      if(key!=='terrain'&&texture instanceof Phaser.Textures.CanvasTexture){
        isolateAtlasFrames(texture);
        // Palette indices address atlas pixels; cache them after final packing.
        applySkillWeaponPalette(this,key,undefined,true);
      }
      if(optimized%3===0)await this.yieldArtworkFrame();
    }
    if(!this.startupActive())return;
    this.registry.set('loadingStage','Preparing scenery');
    for(const atlas of PAINTED_MODEL_ATLASES){
      const source=this.textures.getFrame(atlas.key)?.source;
      if(!source?.image)throw new Error('Missing painted model material: '+atlas.path);
      const started=performance.now();
      while(!preparePresentationSource(this.game,source)){
        await this.yieldArtworkFrame();if(!this.startupActive())return;
        if(performance.now()-started>15000)throw new Error('Model material upload did not finish');
      }
    }
    this.registry.set('loadingStage','Preparing world');
    this.startupPhase='world';
    this.scene.start('world');
  }
}
