import {useState} from 'react';
import {getFrameDiagnosticsEnabled,setFrameDiagnosticsEnabled} from '../game/presentation25d/renderDiagnostics';
import {getGraphicEffects,setGraphicEffect,resetGraphicEffects,type GraphicEffectKey} from '../game/systems/graphicsEffects';

// LEIGHNERON_MOBILE_GRAPHICS_NPC_FIX_V1
const OPTIONS:ReadonlyArray<{key:GraphicEffectKey;title:string;description:string}>=[
 {key:'adaptiveResolution',title:'Adaptive render resolution',description:'Reduces render resolution during sustained slow frames while retaining artwork and effects.'},
 {key:'depthOfField',title:'Depth of field',description:'Optional two-pass cinematic blur on Normal. Low skips the blur to prioritize smooth movement and camera control.'},
 {key:'depthHaze',title:'Distance haze',description:'Subtle atmospheric separation between nearby and distant scenery.'},
 {key:'cinematicColor',title:'Scenery colour and contrast',description:'Warm highlights, cool shadows and gentle detail contrast. Menus stay unchanged.'},
 {key:'combatShake',title:'Combat camera shake',description:'Brief, limited shakes on confirmed heavy hits and dodges. Respects reduced-motion preferences.'},
 {key:'nightMist',title:'Nighttime mist / fog',description:'Animated nighttime mist. On by default.'},
 {key:'daytimeFog',title:'Daytime mist / fog',description:'Morning haze and foggy-weather effects.'},
 {key:'nightDarkness',title:'Night darkness mask (extra GPU)',description:'Dynamic nighttime darkness and moving lantern cutouts. On by default.'},
 {key:'lightBloom',title:'Lantern bloom / magical glow',description:'Animated lantern halos, lit windows and magical glow. Off by default to improve nighttime FPS.'},
 {key:'weatherParticles',title:'Weather particles',description:'Animated rain, snow, wind, dust and volcanic ash.'},
 {key:'cloudShadows',title:'Moving cloud shadows',description:'Soft shadows drifting over daytime landscapes.'},
 {key:'sunRays',title:'Sun rays',description:'Subtle light shafts during suitable daylight.'},
 {key:'dynamicShadows',title:'Moving actor shadows',description:'Player, NPC and enemy moving ground shadows.'},
 {key:'groundBlend',title:'Ground-color blending (extra CPU)',description:'Recolor painted soil at the bottom of scenery sprites. Off by default to prevent texture-processing spikes. Reopen the game after changing this.'},
 {key:'treeSway',title:'Animated tree leaves',description:'Light wind-driven motion in tree canopies.'},
 {key:'waterMotion',title:'Animated water',description:'Moving river foam and ocean details.'},
 {key:'fireflies',title:'Night fireflies',description:'Animated night insects and glow sprites. On by default.'}
];
export function GraphicsEffectsControl(){
 const [effects,setEffects]=useState(getGraphicEffects);
 const [expanded,setExpanded]=useState(false);
 const [frameDiagnostics,setFrameDiagnostics]=useState(getFrameDiagnosticsEnabled);
 return <div className="graphics-effects-control">
  <button className="graphics-effects-expand" type="button" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}>
   Advanced graphics — individual effects {expanded?'▴':'▾'}
  </button>
  {expanded&&<div className="graphics-effects-options">
   <p className="graphics-effects-note">Only Lantern bloom / magical glow and Ground-color blending are off by default. All other effects default to on. You can change each effect independently without removing character or scenery assets. Reopen the game after changing ground-color blending.</p>
   {OPTIONS.map(option=><label className="graphics-effect-toggle" key={option.key}>
    <input type="checkbox" checked={effects[option.key]} onChange={e=>{
     setGraphicEffect(option.key,e.target.checked);setEffects({...getGraphicEffects()});
    }}/>
    <span><strong>{option.title}</strong><small>{option.description}</small></span>
   </label>)}
   <label className="graphics-effect-toggle"><input type="checkbox" checked={frameDiagnostics} onChange={e=>{setFrameDiagnosticsEnabled(e.target.checked);setFrameDiagnostics(e.target.checked);}}/><span><strong>Show frame-time diagnostics</strong><small>Optional frame-time overlay to diagnose stutters.</small></span></label>
   <button type="button" className="graphics-effects-reset" onClick={()=>{
    resetGraphicEffects();setEffects({...getGraphicEffects()});
   }}>Restore recommended defaults</button>
  </div>}
 </div>;
}
