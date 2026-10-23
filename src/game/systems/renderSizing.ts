import type Phaser from 'phaser';
import {createGroundView,groundWorldView,presentationView,type GroundView} from '../presentation25d/plane';

export const RENDER_DENSITY_KEY='renderDensity';
// Bound fill-rate and viewport resources on mobile instead of blindly using
// 3x/4x DPR. World coordinates, actor sizes and input remain independent of it.
const MAX_RENDER_DENSITY=2;
const MAX_RENDER_PIXELS=4_000_000;

export function backingSize(width:number,height:number,dpr:number){
  const cssWidth=Math.max(1,Math.round(width)),cssHeight=Math.max(1,Math.round(height));
  const requested=Number.isFinite(dpr)&&dpr>0?dpr:1;
  const density=Math.max(1,Math.min(requested,MAX_RENDER_DENSITY,
    Math.sqrt(MAX_RENDER_PIXELS/(cssWidth*cssHeight)),4096/Math.max(cssWidth,cssHeight)));
  return {density,width:Math.round(cssWidth*density),height:Math.round(cssHeight*density)};
}

export function renderDensity(scene:Phaser.Scene):number{
  return scene.registry.get(RENDER_DENSITY_KEY)??1;
}

/** Soft screen effects stay CSS-sized; sharper actors/terrain use the full
 * backing buffer. This avoids multiplying texture uploads by DPR squared. */
export function overlayViewport(scene:Phaser.Scene){
  const density=renderDensity(scene);
  return {width:Math.max(1,Math.round(scene.scale.width/density)),
    height:Math.max(1,Math.round(scene.scale.height/density)),zoom:scene.cameras.main.zoom/density};
}

const effectViews=new WeakMap<Phaser.Cameras.Scene2D.Camera,GroundView>();
const COVERAGE_STEP=1.125,COVERAGE_LOG=Math.log(COVERAGE_STEP);
function coverage(required:number,current:number){
  // Grow immediately to retain coverage; shrink only after two scale steps.
  // Hysteresis prevents tiny orbit/follow changes from rebuilding large masks.
  if(current>=required&&required>current/(COVERAGE_STEP*COVERAGE_STEP))return current;
  return Math.pow(COVERAGE_STEP,Math.ceil(Math.log(Math.max(1,required))/COVERAGE_LOG));
}
/** Ground effects keep their pixel budget and reuse a buffered world footprint. */
export function groundEffectViewport(scene:Phaser.Scene){
  const viewport=overlayViewport(scene);
  let view=groundWorldView(scene);
  if(presentationView(scene)){
    const camera=scene.cameras.main;
    let buffered=effectViews.get(camera);
    if(!buffered){buffered=createGroundView();effectViews.set(camera,buffered);}
    buffered.width=coverage(view.width,buffered.width);buffered.height=coverage(view.height,buffered.height);
    buffered.x=view.centerX-buffered.width/2;buffered.y=view.centerY-buffered.height/2;
    view=buffered;
  }
  return {...viewport,zoom:viewport.width/view.width,zoomY:viewport.height/view.height,view};
}

export function fitViewportOverlay(scene:Phaser.Scene,image:Phaser.GameObjects.Image){
  const camera=scene.cameras.main,z=camera.zoom,w=scene.scale.width,h=scene.scale.height;
  image.setDisplaySize(w/z,h/z).setPosition(w/2*(1-1/z),h/2*(1-1/z));
}
