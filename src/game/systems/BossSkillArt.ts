import Phaser from 'phaser';
import {losslessImagePath} from '../../utils/losslessImagePath';
import {preparePresentationSource} from '../presentation25d/resourcePreparation';
import {BOSS_SKILL_ART,BOSS_SKILL_CELL,BOSS_SKILL_ROWS,BOSS_SKILL_TEXTURE,
 BOSS_MOTION_ART,BOSS_MOTION_TEXTURE,BOSS_MOTION_COLUMNS,BOSS_MOTION_ROWS} from '../../data/bossSkillEffects';

interface Residency {pending:boolean;disposed:boolean;retryAt:number;abort:AbortController|null;}
const residents=new WeakMap<Phaser.Scene,Residency>();
const sheets=[{key:BOSS_SKILL_TEXTURE,path:BOSS_SKILL_ART,columns:3,rows:BOSS_SKILL_ROWS},
 {key:BOSS_MOTION_TEXTURE,path:BOSS_MOTION_ART,columns:BOSS_MOTION_COLUMNS,rows:BOSS_MOTION_ROWS}] as const;
/** Two optional, bounded shared sheets, decoded sequentially. Never join boot or own
 * damage. Abort and lifetime checks prevent stale uploads into a later scene. */
export function ensureBossSkillArt(scene:Phaser.Scene):boolean{
 let state=residents.get(scene);
 if(!state){
  state={pending:false,disposed:false,retryAt:0,abort:null};residents.set(scene,state);
  const owned=state;
  const cleanup=()=>{
   owned.disposed=true;owned.abort?.abort();
   if(residents.get(scene)===owned)residents.delete(scene);
   scene.events.off(Phaser.Scenes.Events.SHUTDOWN,cleanup);
   scene.events.off(Phaser.Scenes.Events.DESTROY,cleanup);
   for(const sheet of sheets)if(scene.textures.exists(sheet.key))scene.textures.remove(sheet.key);
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN,cleanup);
  scene.events.once(Phaser.Scenes.Events.DESTROY,cleanup);
 }
 if(!state.disposed&&!state.pending&&scene.time.now>=state.retryAt&&sheets.some(sheet=>!scene.textures.exists(sheet.key)))void load(scene,state);
 return !state.disposed&&scene.textures.exists(BOSS_SKILL_TEXTURE);
}
async function load(scene:Phaser.Scene,state:Residency){
 state.pending=true;const abort=new AbortController();state.abort=abort;
 try{
  for(const sheet of sheets){
   if(state.disposed||abort.signal.aborted)return;
   if(scene.textures.exists(sheet.key))continue;
   const timer=window.setTimeout(()=>abort.abort(),15000);
   let url:string|null=null;let cancelDecode:(()=>void)|null=null;
   const image=new Image();
   try{
    const response=await fetch(import.meta.env.BASE_URL+losslessImagePath(sheet.path),{signal:abort.signal});
    if(!response.ok)throw new Error('Boss effect sheet could not load: '+sheet.path);
    const blob=await response.blob();if(state.disposed||abort.signal.aborted)return;
    url=URL.createObjectURL(blob);image.src=url;
    const cancelled=new Promise<never>((_,reject)=>{
     cancelDecode=()=>reject(new Error('Boss effect decoding cancelled'));
     abort.signal.addEventListener('abort',cancelDecode,{once:true});
     if(abort.signal.aborted)cancelDecode();
    });
    await Promise.race([image.decode(),cancelled]);
    if(state.disposed||abort.signal.aborted)return;
    if(image.width!==BOSS_SKILL_CELL*sheet.columns||image.height!==BOSS_SKILL_CELL*sheet.rows)throw new Error('Invalid boss effect sheet dimensions: '+sheet.path);
    if(!scene.textures.exists(sheet.key)){
     const texture=scene.textures.addSpriteSheet(sheet.key,image,
      {frameWidth:BOSS_SKILL_CELL,frameHeight:BOSS_SKILL_CELL});
     // Warm through the existing staged queue before the first attack impact.
     if(texture)for(const source of texture.source)preparePresentationSource(scene.game,source);
    }
   }finally{
    window.clearTimeout(timer);if(cancelDecode)abort.signal.removeEventListener('abort',cancelDecode);
    if(abort.signal.aborted)image.src='';if(url)URL.revokeObjectURL(url);
   }
  }
 }catch(error){
  if(!state.disposed){state.retryAt=scene.time.now+10000;console.warn('Boss skill artwork:',error);}
 }finally{
  state.pending=false;if(state.abort===abort)state.abort=null;
 }
}
