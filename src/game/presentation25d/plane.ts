import type Phaser from 'phaser';
import {Raycaster,Vector2,Vector3,type PerspectiveCamera} from 'three';
import type {HouseShape} from './HouseGeometry';

export interface PresentationView {
  camera:PerspectiveCamera;native:Phaser.Cameras.Scene2D.Camera;yaw:number;pitch:number;
  bounds:{left:number;top:number;right:number;bottom:number};focusGround:{x:number;y:number};
  height:(x:number,y:number)=>number;
}
const gameViews=new WeakMap<Phaser.Game,PresentationView>();
const cameraViews=new WeakMap<Phaser.Cameras.Scene2D.Camera,PresentationView>();
const point3=new Vector3(),ray=new Raycaster(),ndc=new Vector2();
export function bindPresentationView(scene:Phaser.Scene,view:PresentationView){gameViews.set(scene.game,view);cameraViews.set(scene.cameras.main,view);}
export function clearPresentationView(game:Phaser.Game){const view=gameViews.get(game);if(view)cameraViews.delete(view.native);gameViews.delete(game);}
export function presentationView(scene:Phaser.Scene){return gameViews.get(scene.game);}
export function worldHeight(scene:Phaser.Scene,x:number,y:number){return gameViews.get(scene.game)?.height(x,y)??0;}
/** Shared perspective visibility for selection and ambient actors. Height is
 * above terrain, margin is in logical pre-zoom pixels. Reject the far side of
 * the camera as well as points outside the near/far clipping planes. */
export function worldPointInView(scene:Phaser.Scene,x:number,y:number,height=0,margin=0){
  const view=gameViews.get(scene.game);
  if(view){
    point3.set(x,view.height(x,y)+height,y).project(view.camera);
    return point3.z>=-1&&point3.z<=1
      &&Math.abs(point3.x)<=1+margin*2*view.native.zoom/view.native.width
      &&Math.abs(point3.y)<=1+margin*2*view.native.zoom/view.native.height;
  }
  const bounds=groundWorldView(scene);
  return x>=bounds.left-margin&&x<=bounds.right+margin&&y-height>=bounds.top-margin&&y-height<=bounds.bottom+margin;
}
export function viewDirection(scene:Phaser.Scene,x:number,y:number,out:{x:number;y:number}){
  if(groundForeshortening(scene)===1){out.x=x;out.y=y;return out;}
  const yaw=gameViews.get(scene.game)?.yaw??CAMERA_YAW,c=Math.cos(yaw),s=Math.sin(yaw);
  out.x=x*c-y*s;out.y=x*s+y*c;return out;
}
export function projectWorldPoint(scene:Phaser.Scene,x:number,height:number,y:number,out:{x:number;y:number}){
  const view=gameViews.get(scene.game);
  if(view){point3.set(x,height,y).project(view.camera);out.x=(point3.x+1)*view.native.width/(2*view.native.zoom);out.y=(1-point3.y)*view.native.height/(2*view.native.zoom);return out;}
  projectGroundPoint(scene,x,y,out);out.y-=height*CAMERA_COS;return out;
}

export type PresentationPlane = 'ground' | 'upright' | 'screen';
export interface PresentationHint {
  plane: PresentationPlane;
  /** World-aligned house volume; other scenery retains cylindrical billboards. */
  house?:HouseShape;
  /** Keep attachments, names and health bars on their owner's foot plane. */
  anchor?: {x:number;y:number;depth?:number;rotation?:number;presentationElevation?:number};
  /** Project world-attached light/FX into the ordered screen compositor. */
  overlay?: boolean;
  /** Small ground separation for layered floors and decals. */
  elevation?: number;
  /** Camera-depth separation for attached artwork sharing one body plane. */
  depthOffset?: number;
  /** A world-aligned vertical wall, rather than a camera-facing actor plane. */
  wall?: {axis:'x'|'y'};
  /** Projectile heading stays in simulation coordinates as the camera orbits. */
  worldDirection?:Readonly<{x:number;y:number}>;
  /** A grounded beam descends from an actor's painted mouth to its logical impact lane. */
  beam?: {x:number;y:number;anchorX:number;anchorY:number;dx:number;dy:number;length:number};
}
export const PRESENTATION_HINT = 'presentation25d';
export const PRESENTATION_SURFACE = 'presentation25dSurface';
export interface PresentationSurface {
  sourceTop:number;sourceHeight:number;
  point(x:number,y:number,out:{x:number;y:number;z:number}):void;
}
export function onPlane<T extends Phaser.GameObjects.GameObject>(object:T,plane:PresentationPlane,anchor?:PresentationHint['anchor']):T {
  const current=object.getData(PRESENTATION_HINT) as PresentationHint|undefined;
  if(current?.plane===plane&&current.anchor===anchor)return object;
  object.setData(PRESENTATION_HINT,{plane,anchor} satisfies PresentationHint);
  return object;
}

/** Bootstrap projection before the live orbit camera's first frame. Isolated
 * Phaser artwork fixtures also retain this deterministic fallback. */
export const CAMERA_ELEVATION = 30 * Math.PI / 180;
export const CAMERA_YAW = 25 * Math.PI / 180;
export const CAMERA_SIN = Math.sin(CAMERA_ELEVATION);
export const CAMERA_COS = Math.cos(CAMERA_ELEVATION);
export const CAMERA_YAW_SIN = Math.sin(CAMERA_YAW);
export const CAMERA_YAW_COS = Math.cos(CAMERA_YAW);

export function groundForeshortening(scene:Phaser.Scene){
  return scene.game.registry.get('presentation')==='three-2.5d'?Math.sin(gameViews.get(scene.game)?.pitch??CAMERA_ELEVATION):1;
}

export interface GroundView {
  x:number;y:number;width:number;height:number;
  readonly left:number;readonly right:number;readonly top:number;readonly bottom:number;
  readonly centerX:number;readonly centerY:number;
  contains(x:number,y:number):boolean;
}
const groundViews=new WeakMap<Phaser.Cameras.Scene2D.Camera,GroundView>();
export function createGroundView():GroundView {
  return {x:0,y:0,width:0,height:0,
    get left(){return this.x;},get right(){return this.x+this.width;},
    get top(){return this.y;},get bottom(){return this.y+this.height;},
    get centerX(){return this.x+this.width/2;},get centerY(){return this.y+this.height/2;},
    contains(x,y){return x>=this.left&&x<=this.right&&y>=this.top&&y<=this.bottom;}};
}
/** Shared visible ground footprint. Retain native projection in isolated Phaser art fixtures. */
export function groundWorldView(scene:Phaser.Scene):GroundView {
  const camera=scene.cameras.main,factor=groundForeshortening(scene);
  if(factor===1)return camera.worldView;
  let view=groundViews.get(camera);
  if(!view){
    view=createGroundView();
    groundViews.set(camera,view);
  }
  const live=cameraViews.get(camera);
  if(live){
    const b=live.bounds;view.x=b.left-128;view.y=b.top-128;
    view.width=b.right-b.left+256;view.height=b.bottom-b.top+256;return view;
  }
  const half=projectedGroundHalfExtents(camera),width=half.x*2,height=half.y*2;
  view.x=camera.midPoint.x-width/2;view.y=camera.midPoint.y-height/2;view.width=width;view.height=height;
  return view;
}

/** Project world ground into camera-oriented coordinates, before zoom/scroll. */
export function projectGroundPoint(scene:Phaser.Scene,x:number,y:number,out:{x:number;y:number}){
  if(gameViews.has(scene.game))return projectWorldPoint(scene,x,worldHeight(scene,x,y),y,out);
  if(groundForeshortening(scene)===1){out.x=x;out.y=y;return out;}
  out.x=x*CAMERA_YAW_COS-y*CAMERA_YAW_SIN;
  out.y=(x*CAMERA_YAW_SIN+y*CAMERA_YAW_COS)*CAMERA_SIN;return out;
}
export function unprojectGroundPoint(scene:Phaser.Scene,x:number,y:number,out:{x:number;y:number}){
  const view=gameViews.get(scene.game);
  if(view){
    ndc.set(x*view.native.zoom/view.native.width*2-1,1-y*view.native.zoom/view.native.height*2);ray.setFromCamera(ndc,view.camera);
    let t=Math.max(0,-ray.ray.origin.y/ray.ray.direction.y);
    for(let i=0;i<3;i++){const px=ray.ray.origin.x+ray.ray.direction.x*t,py=ray.ray.origin.z+ray.ray.direction.z*t;
      t=Math.max(0,Math.min(view.camera.far,(view.height(px,py)-ray.ray.origin.y)/ray.ray.direction.y));}
    out.x=ray.ray.origin.x+ray.ray.direction.x*t;out.y=ray.ray.origin.z+ray.ray.direction.z*t;return out;
  }
  if(groundForeshortening(scene)===1){out.x=x;out.y=y;return out;}
  const depth=y/CAMERA_SIN;
  out.x=x*CAMERA_YAW_COS+depth*CAMERA_YAW_SIN;
  out.y=-x*CAMERA_YAW_SIN+depth*CAMERA_YAW_COS;return out;
}
/** Keyboard/joystick axes are screen-relative. Invert projection, retaining
 * analog magnitude and world speed so neither diagonals nor north/south boost speed. */
export function screenMovement(scene:Phaser.Scene,x:number,y:number,out:{x:number;y:number}){
  const amount=Math.min(1,Math.hypot(x,y));
  if(amount<1e-6){out.x=out.y=0;return out;}
  const view=gameViews.get(scene.game);
  if(view){const c=Math.cos(view.yaw),s=Math.sin(view.yaw);out.x=x*c+y*s;out.y=-x*s+y*c;}
  else unprojectGroundPoint(scene,x,y,out);
  const scale=amount/Math.hypot(out.x,out.y);out.x*=scale;out.y*=scale;return out;
}
/** Actual top-left in projected coordinates, not the ground AABB's corner. */
export function projectedViewOrigin(scene:Phaser.Scene,out:{x:number;y:number}){
  if(gameViews.has(scene.game)){out.x=out.y=0;return out;}
  const camera=scene.cameras.main;
  projectGroundPoint(scene,camera.midPoint.x,camera.midPoint.y,out);
  out.x-=camera.width/(2*camera.zoom);out.y-=camera.height/(2*camera.zoom);return out;
}
/** Camera-facing sprite geometry retains its complete pose and pixel scale. */
export function uprightPoint(x:number,y:number,anchorX:number,anchorY:number,out:{x:number;y:number;z:number},scene?:Phaser.Scene){
  const view=scene?gameViews.get(scene.game):undefined;
  if(view){const dx=x-anchorX;out.x=anchorX+dx*Math.cos(view.yaw);out.y=view.height(anchorX,anchorY)+anchorY-y;out.z=anchorY-dx*Math.sin(view.yaw);return out;}
  const dx=x-anchorX,h=anchorY-y;
  out.x=anchorX+dx*CAMERA_YAW_COS-h*CAMERA_SIN*CAMERA_YAW_SIN;
  out.y=h*CAMERA_COS;
  out.z=anchorY-dx*CAMERA_YAW_SIN-h*CAMERA_SIN*CAMERA_YAW_COS;return out;
}

const attachmentPoint={x:0,y:0,z:0};
/** Authored lamps share their owner's billboard or fixed house facade. */
/** Exact 3D point of a lamp on its authored billboard or house facade.
 * Keeping its depth lets the night renderer reject behind-camera lights. */
export function presentationAttachmentWorld(scene:Phaser.Scene,owner:Phaser.GameObjects.Sprite,x:number,y:number,out:{x:number;y:number;z:number}){
  const house=(owner.getData(PRESENTATION_HINT) as PresentationHint|undefined)?.house;
  if(house){
    const dx=x-owner.x;
    out.x=owner.x+dx*Math.cos(owner.rotation);
    out.y=worldHeight(scene,owner.x,owner.y)+owner.y-y;
    out.z=owner.y+dx*Math.sin(owner.rotation);
  }else uprightPoint(x,y,owner.x,owner.y,out,scene);
  const elevation='presentationElevation' in owner&&typeof owner.presentationElevation==='number'?owner.presentationElevation:0;
  out.y+=elevation;
  return out;
}

/** Authored lamps share their owner's billboard or fixed house facade. */
export function presentationAttachment(scene:Phaser.Scene,owner:Phaser.GameObjects.Sprite,x:number,y:number,out:{x:number;y:number}){
  if(gameViews.has(scene.game)){
    presentationAttachmentWorld(scene,owner,x,y,attachmentPoint);
    return projectWorldPoint(scene,attachmentPoint.x,attachmentPoint.y,attachmentPoint.z,out);
  }
  const surface=groundForeshortening(scene)!==1?owner.getData(PRESENTATION_SURFACE) as PresentationSurface|undefined:undefined;
  if(surface){surface.point(x,y,attachmentPoint);projectGroundPoint(scene,attachmentPoint.x,attachmentPoint.z,out);out.y-=attachmentPoint.y*CAMERA_COS;}
  else{projectGroundPoint(scene,owner.x,owner.y,out);out.x+=x-owner.x;out.y+=y-owner.y;}
  return out;
}

export function onOverlay<T extends Phaser.GameObjects.GameObject>(object:T,anchor?:{x:number;y:number;depth?:number}):T {
  const owner=anchor as {getData?:(key:string)=>unknown}|undefined;
  const house=(owner?.getData?.(PRESENTATION_HINT) as PresentationHint|undefined)?.house;
  object.setData(PRESENTATION_HINT,{plane:'upright',anchor,overlay:true,...(house?{house}:{})} satisfies PresentationHint);
  return object;
}

export function onGround<T extends Phaser.GameObjects.GameObject>(object:T,elevation=0):T {
  object.setData(PRESENTATION_HINT,{plane:'ground',elevation} satisfies PresentationHint);
  return object;
}

export function onDirectionalSprite<T extends Phaser.GameObjects.GameObject>(object:T,direction:Readonly<{x:number;y:number}>,anchor?:PresentationHint['anchor']):T {
  object.setData(PRESENTATION_HINT,{plane:'upright',anchor,worldDirection:direction} satisfies PresentationHint);return object;
}

export function projectedGroundView(
  camera: Pick<Phaser.Cameras.Scene2D.Camera, 'width' | 'height' | 'zoom'>,
  x: number, y: number, margin = 0,
) {
  const live=cameraViews.get(camera as Phaser.Cameras.Scene2D.Camera);
  if(live){const b=live.bounds,dx=x-live.focusGround.x,dy=y-live.focusGround.y,pad=margin+128;
    return {left:b.left+dx-pad,right:b.right+dx+pad,top:b.top+dy-pad,bottom:b.bottom+dy+pad};}
  const half=projectedGroundHalfExtents(camera);
  return {left:x-half.x-margin,right:x+half.x+margin,top:y-half.y-margin,bottom:y+half.y+margin};
}
/** AABB of all four rotated ground-view corners; bounded streaming uses this. */
export function projectedGroundHalfExtents(camera:Pick<Phaser.Cameras.Scene2D.Camera,'width'|'height'|'zoom'>){
  const view=cameraViews.get(camera as Phaser.Cameras.Scene2D.Camera);
  if(view){const b=view.bounds,f=view.focusGround;return {x:Math.max(f.x-b.left,b.right-f.x)+128,y:Math.max(f.y-b.top,b.bottom-f.y)+128};}
  const right=camera.width/(2*camera.zoom),depth=camera.height/(2*camera.zoom*CAMERA_SIN);
  return {x:right*Math.abs(CAMERA_YAW_COS)+depth*Math.abs(CAMERA_YAW_SIN),
    y:right*Math.abs(CAMERA_YAW_SIN)+depth*Math.abs(CAMERA_YAW_COS)};
}
