export const TOUCH_CONTROL_LABELS={move:'Movement',attack:'Attack',sprint:'Dash / Sprint',jump:'Jump',targetLock:'Lock target',
 interact:'Interact',skill1:'Art slot 1',skill2:'Art slot 2',skill3:'Art slot 3',skill4:'Art slot 4',healPotion:'Health supply',staminaPotion:'Stamina supply'} as const;
export type TouchControlId=keyof typeof TOUCH_CONTROL_LABELS;
export type TouchOrientation='portrait'|'landscape';
export interface TouchPlacement {x:number;y:number;size:number;opacity:number}
export type TouchLayout=Record<TouchControlId,TouchPlacement>;
export type TouchLayouts=Partial<Record<TouchOrientation,TouchLayout>>;
export const TOUCH_CONTROL_IDS=Object.keys(TOUCH_CONTROL_LABELS) as TouchControlId[];
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export function touchSizeLimits(id:TouchControlId){return id==='move'?[80,224] as const:[44,144] as const;}
/** Coordinates describe centers inside the safe-area viewport, independent of
 * device pixels, camera mode, resolution scaling and game progress saves. */
export function defaultTouchLayout(width:number,height:number,scale=1):TouchLayout {
 const portrait=height>=width,W=Math.max(240,width),H=Math.max(180,height);
 const layout={} as TouchLayout;
 const ids:TouchControlId[]=['attack','sprint','staminaPotion','healPotion','skill2','skill1','interact','targetLock','skill4','skill3','jump'];
 const columns=portrait?2:4,spacing=Math.max(60,Math.ceil(57*scale+6)),edge=Math.max(38,66*scale/2+8);
 ids.forEach((id,i)=>{const col=i%columns,row=Math.floor(i/columns);
  layout[id]={x:clamp((W-edge-col*spacing)/W,0,1),y:clamp((H-edge-row*spacing)/H,0,1),size:id==='attack'?66:48,opacity:.85};});
 layout.move={x:clamp(Math.max(82,64*scale+18)/W,0,1),y:clamp((H-Math.max(94,64*scale+30))/H,0,1),size:128,opacity:.75};return layout;
}
export function sanitizeTouchLayout(input:unknown):TouchLayout|undefined {
 if(!input||typeof input!=='object'||Array.isArray(input))return;
 const source=input as Record<string,unknown>,result={} as TouchLayout;
 for(const id of TOUCH_CONTROL_IDS){
  const item=source[id];if(!item||typeof item!=='object'||Array.isArray(item))return;
  const p=item as Record<string,unknown>;
  if(!['x','y','size','opacity'].every(k=>typeof p[k]==='number'&&Number.isFinite(p[k])))return;
  const [min,max]=touchSizeLimits(id);
  result[id]={x:clamp(p.x as number,0,1),y:clamp(p.y as number,0,1),size:clamp(p.size as number,min,max),opacity:clamp(p.opacity as number,.25,1)};
 }
 return result;
}
export function sanitizeTouchLayouts(input:unknown):TouchLayouts {
 const layouts:TouchLayouts={};if(!input||typeof input!=='object'||Array.isArray(input))return layouts;
 const source=input as Record<string,unknown>;
 for(const orientation of ['portrait','landscape'] as const){const layout=sanitizeTouchLayout(source[orientation]);if(layout)layouts[orientation]=layout;}
 return layouts;
}
export function touchPlacementStyle(p:TouchPlacement,id:TouchControlId,scale:number):Record<string,string|number>{
 const [min,max]=touchSizeLimits(id),size=clamp(p.size*scale,min,max);
 const extent=`min(${size}px, calc(100dvh - max(8px, env(safe-area-inset-top)) - max(8px, env(safe-area-inset-bottom))), calc(100vw - max(8px, env(safe-area-inset-left)) - max(8px, env(safe-area-inset-right))))`;
 return {'--touch-size':extent,left:`clamp(calc(var(--touch-size) / 2), ${p.x*100}%, calc(100% - var(--touch-size) / 2))`,
  top:`clamp(calc(var(--touch-size) / 2), ${p.y*100}%, calc(100% - var(--touch-size) / 2))`,opacity:p.opacity};
}
