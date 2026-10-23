// LEIGHNERON_MOBILE_GRAPHICS_NPC_FIX_V1
// Local visual preferences do not alter saves or world simulation.
// Graphics Low/Normal controls cadence and resolution of effects left enabled.
export const GRAPHICS_EFFECTS_EVENT='leighneron-graphics-effects';
export interface GraphicEffects {
 nightMist:boolean; daytimeFog:boolean; weatherParticles:boolean;
 cloudShadows:boolean; sunRays:boolean; treeSway:boolean; waterMotion:boolean;
 dynamicShadows:boolean; fireflies:boolean; lightBloom:boolean; nightDarkness:boolean;
 combatShake:boolean; groundBlend:boolean;
 depthOfField:boolean; depthHaze:boolean; cinematicColor:boolean;
 adaptiveResolution:boolean;
}
export type GraphicEffectKey=keyof GraphicEffects;
const STORAGE_KEY='leighneron:graphics-effects:v1';
// Restore night effects disabled by the previous performance-default migration.
// Apply this policy once; subsequent player choices remain respected.
const DEFAULTS_MIGRATION_KEY='leighneron:graphics-defaults:v2';
const AMBIENCE_MIGRATION_KEY='leighneron:ambience-restored:v1';
function recommended():GraphicEffects{
 return {nightMist:true,daytimeFog:true,weatherParticles:true,cloudShadows:true,
   sunRays:true,treeSway:true,waterMotion:true,dynamicShadows:true,
   fireflies:true,lightBloom:true,nightDarkness:true,
   // Combat rendering still independently respects reduced-motion preferences.
   combatShake:true,depthOfField:true,depthHaze:true,cinematicColor:true,adaptiveResolution:true,
   // Disable dynamic ground-skirt recoloring by default on every device.
   // The unmodified full-resolution scenery textures still render.
   groundBlend:false};
}
let cache:GraphicEffects|undefined;
export function getGraphicEffects():GraphicEffects {
 if(cache)return cache;
 const value=recommended();
 try{
  const json=localStorage.getItem(STORAGE_KEY);
  if(json){const stored=JSON.parse(json) as Record<string,unknown>;
   for(const key of Object.keys(value) as GraphicEffectKey[])
    if(typeof stored[key]==='boolean')value[key]=stored[key] as boolean;
  }
  // Update the old forced-off night settings and the two opt-in effects only.
  // Keep unrelated customized settings and all saved gameplay untouched.
  if(localStorage.getItem(DEFAULTS_MIGRATION_KEY)!=='1'){
   value.nightMist=true;
   value.lightBloom=false;
   value.groundBlend=false;
   value.fireflies=true;
   value.nightDarkness=true;
   localStorage.setItem(STORAGE_KEY,JSON.stringify(value));
   localStorage.setItem(DEFAULTS_MIGRATION_KEY,'1');
  }
  // Restore the requested ambience once after the old forced-off defaults.
  // Subsequent individual choices remain respected, including disabling it.
  if(localStorage.getItem(AMBIENCE_MIGRATION_KEY)!=='1'){
   value.sunRays=true;value.weatherParticles=true;value.lightBloom=true;
   value.fireflies=true;value.nightMist=true;value.daytimeFog=true;
   localStorage.setItem(STORAGE_KEY,JSON.stringify(value));
   localStorage.setItem(AMBIENCE_MIGRATION_KEY,'1');
  }
 }catch{/* Some Android WebViews restrict storage. */}
 cache=value;return value;
}
function save(value:GraphicEffects){
 cache=value;
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify(value));}catch{}
 window.dispatchEvent(new Event(GRAPHICS_EFFECTS_EVENT));
}
export function setGraphicEffect(key:GraphicEffectKey,value:boolean){
 save({...getGraphicEffects(),[key]:value});
}
export function resetGraphicEffects(){save(recommended());}
