import {useGameStore} from '../store/gameStore';
import {parseHousing} from '../data/housing';
import {armorBonusesFor} from '../data/armor';
import {progressionStats} from '../data/progression';
import {DEFAULT_SKILL_SLOTS} from '../data/activeSkills';
import {nextTowerWeeklyReset} from '../data/towerOfMight';
import {restoreJournal} from '../data/journal';
import {parseSave,getSaveValidationProblem,type SaveData} from './saveValidation';
import {SaveWorker} from './SaveWorker';

export {parseSave,migrateSave,type SaveData,type SavedState} from './saveValidation';
// Keep the existing save key and version-7 payload across both save paths.
export const SAVE_KEY = 'mernondna-25d-save-v1';

let syncSnapshot: (() => void) | undefined;
let saving = false;
let saveBlocked=false;
let recoveryNotice:string|null=null;
let saveFailureReason:string|null=null;
export function getSaveRecoveryNotice(){return recoveryNotice;}
export function getSaveFailureReason(){return saveFailureReason;}
export function allowExplicitNewGame(){invalidatePreparedSave();saveBlocked=false;recoveryNotice=null;saveFailureReason=null;}
export function setSaveSnapshotProvider(provider?: () => void) {
  invalidatePreparedSave();
  if(!provider){backgroundSave?.destroy();backgroundSave=undefined;}
  syncSnapshot = provider;
}

function record(value:unknown):value is Record<string,unknown>{
  return typeof value==='object'&&value!==null&&!Array.isArray(value);
}

const PRE_IMPORT_KEY=SAVE_KEY+':pre-import-backup';
const RECOVERY_KEYS=[SAVE_KEY,SAVE_KEY+':last-good',SAVE_KEY+':unreadable-backup',SAVE_KEY+':unreadable-backup-2',PRE_IMPORT_KEY] as const;

export function hasSavedGame(): boolean {
  try {
    return RECOVERY_KEYS.some(key=>{
      const raw=localStorage.getItem(key);
      return Boolean(raw&&parseSave(raw));
    });
  } catch { return false; }
}

export function hasStoredSave(): boolean {
  try { return RECOVERY_KEYS.some(key=>localStorage.getItem(key)!==null); }
  catch { return false; }
}

/** Capture the current session without modifying the disk save slot. */
function captureCurrentSaveSnapshot():SaveData {
    syncSnapshot?.();
    const s = useGameStore.getState();
    const data: SaveData = { version: 7, savedAt: new Date().toISOString(), state: {
      housing:s.housing,hp: s.hp, stamina: s.stamina, level: s.level, xp: s.xp, attributes: s.attributes, statPoints: s.statPoints,
      journal:restoreJournal(s.journal,s),contracts:s.contracts,armorInventory:s.armorInventory,equippedArmor:s.equippedArmor,dungeons:s.dungeons,nextTowerResetAt:s.nextTowerResetAt,
      skillPoints: s.skillPoints, learnedSkills: s.learnedSkills, gold: s.gold, weaponId: s.weaponId,
      inventory: s.inventory, weaponUpgrades:s.weaponUpgrades??{},bossMaterials:s.bossMaterials??{},bossHearts:s.bossHearts??{},awakenedWeapons:s.awakenedWeapons??[], worldX: s.worldX, worldY: s.worldY, regionId: s.regionId, townId: s.townId,
      consumables:s.consumables,learnedCombatArts:s.learnedCombatArts,skillSlots:s.skillSlots,
      day: s.day, minuteOfDay: s.minuteOfDay, quests: s.quests, defeatedBosses: s.defeatedBosses,
      worldContent: s.worldContent,
      unlockedTownShrines:s.unlockedTownShrines,
      storyFlags:s.storyFlags,storyChoices:s.storyChoices,trackedQuestId:s.trackedQuestId,
      cinematicQueue:[...(s.cinematic?[s.cinematic.id]:s.pendingCinematic?[s.pendingCinematic]:[]),...s.cinematicQueue],
    } };
  return data;
}
function serializeCurrentSaveSnapshot():string {
  return JSON.stringify(captureCurrentSaveSnapshot());
}

// Only byte-identical prior snapshots that already passed validation in this
// session may skip re-parsing. New saves and externally changed old saves are
// still fully validated, backed up and read back.
let lastValidatedSaveRaw:string|null=null;
function commitValidatedSave(serialized:string):boolean {
    const prior=localStorage.getItem(SAVE_KEY);
    if(prior&&(prior===lastValidatedSaveRaw||parseSave(prior)))
      try{localStorage.setItem(SAVE_KEY+':last-good',prior);}catch{/* Keep saving available if the optional backup quota is full. */}
    localStorage.setItem(SAVE_KEY,serialized);
    // Verify that this exact validated snapshot can be read back before
    // telling the player that the save succeeded.
    if(localStorage.getItem(SAVE_KEY)!==serialized){
      throw new Error('Storage did not retain the saved snapshot');
    }
    lastValidatedSaveRaw=serialized;
    saveFailureReason=null;
    return true;
}

let saveEpoch=0;
let backgroundSave:SaveWorker|undefined;
let checkpointQueued=false;
function invalidatePreparedSave(){saveEpoch++;checkpointQueued=false;}

/** Ordinary checkpoints prepare JSON and run full validation off-thread.
 * Explicit saves, death/boss checkpoints and pagehide still flush immediately. */
export function saveProgressCheckpoint():void {
  if(saving||saveBlocked)return;
  if(!syncSnapshot||typeof Worker==='undefined'||document.hidden){saveGame();return;}
  backgroundSave??=new SaveWorker();
  const worker=backgroundSave;
  if(!worker.available){saveGame();return;}
  if(worker.busy){checkpointQueued=true;return;}
  const epoch=++saveEpoch;
  let data:SaveData;
  saving=true;
  try{data=captureCurrentSaveSnapshot();}
  catch(error){saveFailureReason='Could not capture checkpoint: '+String(error);return;}
  finally{saving=false;}
  worker.prepare(data,result=>{
    // Teardown, import, a new journey or an explicit newer save supersedes
    // this worker result. No stale callback may replace that checkpoint.
    if(backgroundSave!==worker||!syncSnapshot||saveBlocked)return;
    if(checkpointQueued){checkpointQueued=false;saveProgressCheckpoint();return;}
    if(epoch!==saveEpoch)return;
    if(!result){saveGame();return;} // Unsupported/failed worker retains recovery.
    if(result.raw===null){
      saveFailureReason=`Cannot save: ${result.problem}. Earlier save kept.`;
      console.warn('[save] Rejected checkpoint:',result.problem);return;
    }
    saving=true;
    try{commitValidatedSave(result.raw);}
    catch(error){saveFailureReason='Could not save checkpoint: '+String(error);console.warn('[save]',error);}
    finally{saving=false;}
  });
}

export function saveGame(): boolean {
  invalidatePreparedSave();
  if (saving) return false;
  if (saveBlocked) {
    saveFailureReason='Saving is blocked to protect an unreadable save. Start a new game only after securing the old save.';
    return false;
  }
  saving = true;
  try {
    const serialized=serializeCurrentSaveSnapshot();
    // A successful localStorage write is not proof that Continue can load it.
    // Reject invalid snapshots before replacing the latest recoverable save.
    if(!parseSave(serialized)){
      const problem=getSaveValidationProblem();
      saveFailureReason=problem
        ? `Cannot save: ${problem}. Earlier save kept.`
        : 'Save validation failed. Your previous save was preserved.';
      console.warn('[save] Rejected snapshot:',problem);
      return false;
    }
    return commitValidatedSave(serialized);
  } catch(error) {
    saveFailureReason=error instanceof Error ? 'Could not save: '+error.message : 'Could not save the game on this device.';
    console.warn('[save] Save failed:',error);
    return false;
  } finally { saving = false; }
}

export function loadGame(): boolean {
  invalidatePreparedSave();
  try {
    // A past release may have called a perfectly valid scaled-HP snapshot
    // unreadable. Recheck *all* retained copies with today's parser and
    // restore the most recent valid timestamp rather than blindly rolling
    // back to the last-good slot.
    // A healthy primary is authoritative, even when a backup has a newer date
    // (for example after an intentional import). Do not parse every potentially
    // large historical world snapshot on the normal Continue path.
    const primaryRaw=localStorage.getItem(SAVE_KEY);
    const primary={key:SAVE_KEY,raw:primaryRaw,data:primaryRaw?parseSave(primaryRaw):null};
    const copies=primary.data?[primary]:[primary,...RECOVERY_KEYS.filter(key=>key!==SAVE_KEY).map(key=>{
      const raw=localStorage.getItem(key);
      return {key,raw,data:raw?parseSave(raw):null};
    })];
    const candidates: Array<{key:string;data:SaveData}>=[];
    for(const copy of copies)if(copy.data)candidates.push({key:copy.key,data:copy.data});
    candidates.sort((a,b)=>{
      const time=(value:SaveData)=>Number.isFinite(Date.parse(value.savedAt))?Date.parse(value.savedAt):0;
      return time(b.data)-time(a.data);
    });
    // An imported save may be older than the prior game. Prefer a valid
    // primary; use the newest dated backup only when primary fails parsing.
    const chosen=primary.data?{key:SAVE_KEY,data:primary.data}:candidates[0];
    saveBlocked=false;
    recoveryNotice=null;
    if(primary.raw&&!primary.data){
      // Never discard the rejected primary. Preserve it in a separate slot
      // before any subsequent autosave can replace it. Do not overwrite an
      // older unreadable snapshot either; it may become readable in a later
      // update.
      const backupKeys=[SAVE_KEY+':unreadable-backup',SAVE_KEY+':unreadable-backup-2'];
      try {
        if(!backupKeys.some(key=>localStorage.getItem(key)===primary.raw)){
          const free=backupKeys.find(key=>localStorage.getItem(key)===null);
          if(!free)throw new Error('No available recovery slot');
          localStorage.setItem(free,primary.raw);
          if(localStorage.getItem(free)!==primary.raw)
            throw new Error('Could not verify the rejected primary backup');
        }
      }catch(error){
        saveBlocked=true;
        console.warn('[save] Could not preserve rejected primary save:',error);
      }
    }
    if(!chosen){
      saveBlocked=true;
      recoveryNotice='No loadable save was found. Existing save data was left untouched; automatic saving is blocked to prevent overwriting it.';
      useGameStore.getState().showToast(recoveryNotice);
      return false;
    }
    if(chosen.key!==SAVE_KEY || saveBlocked){
      recoveryNotice=saveBlocked
        ? 'A recoverable save was found, but the unreadable primary could not be backed up. Saving is blocked until it is safely exported.'
        : 'Recovered the most recent loadable save copy. Your other save copies were preserved.';
      useGameStore.getState().showToast(recoveryNotice);
    }
    const data=chosen.data;
    // Explicit selection prevents a save replacing store actions or transient UI state.
    const s = data.state;
    const armorBonuses=armorBonusesFor(s.equippedArmor??{chest:null,boots:null,cape:null});
    const derived = progressionStats(s.attributes, s.learnedSkills,armorBonuses);
    useGameStore.getState().hydrate({ hp: s.hp, maxHp: derived.maxHp, stamina: s.stamina, maxStamina: derived.maxStamina,
      rareLootQueue:[],nextRareLootId:0,
      levelUpNotice:null,nextLevelUpId:0,
      housing:s.housing??parseHousing(undefined)!,housingContext:null,housingEditing:false,
      journal:s.journal!,contracts:s.contracts??{},contractBoardTownId:null,aliceRemark:null,dungeons:s.dungeons??{},activeDungeonId:null,towerExitRequest:null,towerPractice:null,towerPracticeRequest:null,nextTowerResetAt:s.nextTowerResetAt??nextTowerWeeklyReset(),
      armorInventory:s.armorInventory??[],equippedArmor:s.equippedArmor??{chest:null,boots:null,cape:null},armorBonuses,
      level: s.level, xp: s.xp, attributes: s.attributes, statPoints: s.statPoints, skillPoints: s.skillPoints,worldAscensionReadyAt:0,
      learnedSkills: s.learnedSkills, gold: s.gold,
      consumables:s.consumables??{'healing-potion':0,'stamina-potion':0},learnedCombatArts:s.learnedCombatArts??[],skillSlots:s.skillSlots??[...DEFAULT_SKILL_SLOTS],vitalRevision:0,
      weaponId: s.weaponId, inventory: s.inventory, weaponUpgrades:s.weaponUpgrades??{},bossMaterials:s.bossMaterials??{},bossHearts:s.bossHearts??{},awakenedWeapons:s.awakenedWeapons??[], worldX: s.worldX, worldY: s.worldY, regionId: s.regionId,
      townId: s.townId, day: s.day, minuteOfDay: s.minuteOfDay, quests: s.quests, defeatedBosses: s.defeatedBosses,
      worldContent: s.worldContent,unlockedTownShrines:s.unlockedTownShrines,
      storyFlags:s.storyFlags,storyChoices:s.storyChoices,trackedQuestId:s.trackedQuestId,
      pendingCinematic:s.cinematicQueue?.[0]??null,cinematicQueue:s.cinematicQueue?.slice(1)??[] });
    useGameStore.getState().refreshTowerWeek();
    return true;
  } catch(error) {
    // Storage access and hydration failures must not look like a dead Continue
    // button. Retain every stored copy and prevent writes from partial state.
    saveBlocked=true;
    recoveryNotice='The saved game could not be restored. Your stored copies were kept. Export your save before trying again.';
    console.error('[save] Restore failed:',error);
    return false;
  }
}

export function watchProgressSaves() {
  // World streaming and multi-step quests can update the store many times in
  // one frame. Coalesce those requests instead of repeatedly serializing the
  // entire world; pagehide/visibility checkpoints still save immediately.
  let pending:ReturnType<typeof setTimeout>|null=null;
  const unsubscribe=useGameStore.subscribe((s, previous) => {
    if (saving) return;
    // A permanent boss death and its rewards must survive an immediate close,
    // including before the coalesced progress timer or periodic checkpoint.
    if(s.defeatedBosses!==previous.defeatedBosses){
      if(pending!==null){clearTimeout(pending);pending=null;}
      saveGame();
      return;
    }
    if (s.housing!==previous.housing||s.dungeons!==previous.dungeons||s.armorInventory!==previous.armorInventory||s.equippedArmor!==previous.equippedArmor||s.contracts!==previous.contracts || s.journal!==previous.journal || s.quests !== previous.quests || s.defeatedBosses !== previous.defeatedBosses
      || s.inventory !== previous.inventory || s.weaponId !== previous.weaponId
       || s.weaponUpgrades!==previous.weaponUpgrades || s.bossMaterials!==previous.bossMaterials || s.bossHearts!==previous.bossHearts || s.awakenedWeapons!==previous.awakenedWeapons
      || s.consumables!==previous.consumables || s.learnedCombatArts!==previous.learnedCombatArts || s.skillSlots!==previous.skillSlots
      || s.xp !== previous.xp || s.gold !== previous.gold || s.attributes !== previous.attributes
      || s.statPoints !== previous.statPoints || s.skillPoints !== previous.skillPoints
      || s.learnedSkills !== previous.learnedSkills || s.worldContent !== previous.worldContent
      || s.unlockedTownShrines !== previous.unlockedTownShrines || s.storyFlags!==previous.storyFlags
      || s.storyChoices!==previous.storyChoices || s.trackedQuestId!==previous.trackedQuestId) {
      if(pending!==null)clearTimeout(pending);
      pending=setTimeout(()=>{pending=null;saveProgressCheckpoint();},1000);
    }
  });
  return ()=>{if(pending!==null)clearTimeout(pending);unsubscribe();};
}

/** A portable JSON archive keeps *all* local recovery copies, including
 * rejected snapshots. Nothing is uploaded; the user chooses where to store it. */
export const SAVE_BACKUP_FORMAT='tales-of-leighneron-save-backup';
export interface SaveBackupExport { filename:string; json:string; copies:number; }
export interface SaveImportPreview { raw:string; savedAt:string; level:number; source:string; }
const MAX_IMPORT_BYTES=64*1024*1024;

export function createSaveBackupExport(includeLiveSession=true):SaveBackupExport {
  const copies:{slot:string;raw:string}[]=[];
  for(const key of RECOVERY_KEYS){
    const raw=localStorage.getItem(key);
    if(raw!==null)copies.push({slot:key===SAVE_KEY?'primary':key.slice(SAVE_KEY.length+1),raw});
  }
  // Even if a broken world record prevents an autosave, export the live
  // session as evidence for later recovery. Never overwrite disk to do so.
  if(includeLiveSession&&syncSnapshot){
    try{copies.push({slot:'current-session',raw:serializeCurrentSaveSnapshot()});}
    catch(error){console.warn('[save] Live snapshot unavailable for backup:',error);}
  }
  if(!copies.length)throw new Error('No saved game or active session is available to export.');
  const exportedAt=new Date().toISOString();
  return {
    filename:`Tales-of-Leigneron-Save-${exportedAt.replace(/[:.]/g,'-')}.json`,
    json:JSON.stringify({format:SAVE_BACKUP_FORMAT,version:1,exportedAt,copies}),
    copies:copies.length,
  };
}

/** Accept either a portable backup or an older standalone game-save JSON. */
export function inspectSaveImport(json:string):SaveImportPreview {
  if(new Blob([json]).size>MAX_IMPORT_BYTES)throw new Error('Backup is larger than the supported 64 MB import limit.');
  let parsed:unknown;
  try{parsed=JSON.parse(json);}catch{throw new Error('The selected file does not contain valid JSON.');}
  let entries:{slot:string;raw:string}[]=[];
  if(record(parsed)&&parsed.format===SAVE_BACKUP_FORMAT&&parsed.version===1&&Array.isArray(parsed.copies)){
    if(parsed.copies.length>16)throw new Error('Backup contains too many save copies.');
    for(const copy of parsed.copies){
      if(!record(copy)||typeof copy.slot!=='string'||typeof copy.raw!=='string')
        throw new Error('Backup contains a malformed save copy.');
      entries.push({slot:copy.slot,raw:copy.raw});
    }
  }else if(record(parsed)&&'state' in parsed&&'version' in parsed){
    entries=[{slot:'standalone',raw:json}];
  }else throw new Error('This is not a Tales of Leigneron save backup.');
  const valid:SaveImportPreview[]=[];
  for(const entry of entries){
    const save=parseSave(entry.raw);
    if(save)valid.push({raw:entry.raw,savedAt:save.savedAt,level:save.state.level,source:entry.slot});
  }
  if(!valid.length)throw new Error('No loadable saves were found in this backup. Original local saves are unchanged.');
  const date=(s:SaveImportPreview)=>Number.isFinite(Date.parse(s.savedAt))?Date.parse(s.savedAt):0;
  valid.sort((a,b)=>date(b)-date(a));
  return valid[0];
}

/** Preserve the primary before import and verify it can be recovered before
 * replacing the selected save. Local storage itself is not crash-transactional. */
export function importSaveBackup(preview:SaveImportPreview):void {
  invalidatePreparedSave();
  if(!parseSave(preview.raw))throw new Error('Imported save failed validation. Existing progress was not changed.');
  const previousBlocked=saveBlocked;
  const previous=localStorage.getItem(SAVE_KEY);
  if(previous!==null){
    try{
      // If the primary is already unreadable, never replace a potentially
      // valid pre-import recovery copy with that unreadable primary.
      const preserveAt=parseSave(previous)
        ? PRE_IMPORT_KEY
        : [SAVE_KEY+':unreadable-backup',SAVE_KEY+':unreadable-backup-2',PRE_IMPORT_KEY]
            .find(key=>localStorage.getItem(key)===previous
              ||localStorage.getItem(key)===null);
      if(!preserveAt)
        throw new Error('No free recovery slot for the unreadable primary.');
      localStorage.setItem(preserveAt,previous);
      if(localStorage.getItem(preserveAt)!==previous)
        throw new Error('Could not verify the pre-import backup.');
    }catch(error){
      throw new Error('Cannot protect your existing save before import. Export your backup before proceeding. '+(error instanceof Error?error.message:''));
    }
  }
  // Prevent pagehide/blur/visibility autosaves from overwriting the imported
  // file during navigation. A full reload reconstructs the game from it.
  saveBlocked=true;
  try{
    localStorage.setItem(SAVE_KEY,preview.raw);
    if(localStorage.getItem(SAVE_KEY)!==preview.raw)
      throw new Error('The imported save could not be read back.');
  }catch(error){
    saveBlocked=previousBlocked;
    throw new Error('Import failed. Your previous save backup was retained. '+(error instanceof Error?error.message:''));
  }
}

export function clearSave(): boolean {
  invalidatePreparedSave();
  try { localStorage.removeItem(SAVE_KEY);saveBlocked=false; return true; } catch { return false; }
}

// LEIGHNERON_WOLF_PACKS_ROAD_BANDITS_V1
