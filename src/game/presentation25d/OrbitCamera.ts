import type {TerrainHeightRange} from '../systems/TerrainHeightField';
import {PerspectiveCamera,Raycaster,Vector2,Vector3} from 'three';
import type Phaser from 'phaser';
import {mobileInput} from '../input';
import {getCameraSettings,toggleCameraMode,CAMERA_SETTINGS_EVENT} from './cameraSettings';
import {VIEW_DISTANCE} from './environment';
import {CONTROL_SETTINGS_EVENT,getControlSettings,keyLabel} from '../systems/controlSettings';

const RAD=Math.PI/180;
const MIN_ZOOM=.18,MAX_ZOOM=1.7,MIN_DISTANCE=90;
const CORNERS=[[-1,-1],[1,-1],[-1,1],[1,1]] as const;
interface ShakeOffset {_offsetX:number;_offsetY:number}
export interface PresentationCameraControl {owner:object;view:'hold'|'scripted'|'player'}
interface GameplayPose {yaw:number;targetYaw:number;pitch:number;targetPitch:number;zoom:number;targetZoom:number;savedPitch:number;gameplayFirstPerson:boolean}
export class OrbitCamera {
  readonly camera=new PerspectiveCamera(38,1,2,4000);
  yaw=25*RAD;pitch=42*RAD;private targetYaw=this.yaw;private targetPitch=this.pitch;
  private zoom=1;private targetZoom=1;private enabled=false;private touchDistance=0;
  private readonly focus=new Vector3();private initialized=false;
  private readonly nextFocus=new Vector3();
  private readonly lookTarget=new Vector3();
  private combatLocked=false;
  firstPerson=false;private savedPitch=42*RAD;
  private gameplayFirstPerson=false;private cameraOwner:object|undefined;
  private gameplayPose:GameplayPose|null=null;private scriptedView=false;private playerRestored=false;
  private lastEyeHeight:number|undefined;private controlEpoch=0;
  private wasLocked=false;private releasing=false;
  private readonly altKeys=new Set<string>();
  private resumeCapture=false;private destroyed=false;
  private readonly finePointer=window.matchMedia('(pointer: fine)');
  private readonly ray=new Raycaster();private readonly ndc=new Vector2();
  private readonly touches=new Map<number,{x:number;y:number;startX:number;startY:number;moved:boolean}>();
  private settings=getCameraSettings();
  private readonly onSettings=()=>{this.settings=getCameraSettings();};
  private readonly hint:HTMLButtonElement;
  readonly bounds={left:0,top:0,right:0,bottom:0};
  readonly focusGround={x:0,y:0};
  constructor(private readonly canvas:HTMLCanvasElement,parent:HTMLElement,private readonly pick:(event:PointerEvent)=>void,private readonly pause:()=>void,
    private readonly controlsAllowed:()=>boolean=()=>this.enabled){
    this.hint=document.createElement('button');this.hint.type='button';this.hint.textContent='Mouse look · click to capture · R lock · Esc to release';
    Object.assign(this.hint.style,{position:'absolute',left:'50%',top:'12px',transform:'translateX(-50%)',zIndex:'8',padding:'7px 12px',background:'#18201ee6',color:'#f2e6c7',border:'1px solid #8b7954',borderRadius:'5px',fontSize:'12px',cursor:'pointer'});
    this.hint.hidden=true;parent.append(this.hint);this.hint.addEventListener('click',this.capture);
    this.updateControlHint();window.addEventListener(CONTROL_SETTINGS_EVENT,this.updateControlHint);
    canvas.addEventListener('pointerdown',this.down);canvas.addEventListener('pointermove',this.touchMove);canvas.addEventListener('pointerup',this.up);canvas.addEventListener('pointercancel',this.up);
    canvas.addEventListener('wheel',this.wheel,{passive:false});canvas.addEventListener('contextmenu',this.contextMenu);
    document.addEventListener('mousemove',this.mouseMove);document.addEventListener('mouseup',this.mouseUp);document.addEventListener('pointerlockchange',this.lockChanged);
    document.addEventListener('keydown',this.keyDown,true);document.addEventListener('keyup',this.keyUp,true);
    document.addEventListener('visibilitychange',this.visibilityChanged);
    window.addEventListener('blur',this.clearControls);window.addEventListener(CAMERA_SETTINGS_EVENT,this.onSettings);
  }
  private readonly updateControlHint=()=>{this.hint.textContent='Mouse look · click to capture · hold Alt for cursor · '+keyLabel(getControlSettings().keys.targetLock)+' lock · Esc to release';};
  get locked(){return document.pointerLockElement===this.canvas;}
  suspend(){this.enabled=false;this.clearControls();this.hint.hidden=true;}
  private readonly capture=()=>{
    if(this.destroyed||this.altKeys.size||!this.controlsAllowed()||!document.hasFocus()||document.hidden)return;
    const epoch=this.controlEpoch;
    try{const result=this.canvas.requestPointerLock?.();if(result)void result.then(()=>{
      if(epoch!==this.controlEpoch||this.destroyed||this.altKeys.size||!this.controlsAllowed()||!document.hasFocus()||document.hidden)this.release();
    }).catch(()=>{});}catch{/* Touch/unsupported WebViews retain drag orbit. */}
  };
  private readonly release=()=>{
    mobileInput.setAttackHeld(false);if(this.locked){this.releasing=true;document.exitPointerLock();}
    for(const id of this.touches.keys())if(this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id);
    this.touches.clear();this.touchDistance=0;
  };
  private readonly clearControls=()=>{this.controlEpoch++;this.altKeys.clear();this.resumeCapture=false;this.release();};
  private reconcileAlt(held:boolean){if(!held&&this.altKeys.size){this.altKeys.clear();this.resumeCapture=false;}}
  private readonly visibilityChanged=()=>{if(document.hidden)this.clearControls();};
  private readonly keyDown=(event:KeyboardEvent)=>{
    if(event.code==='KeyV'&&!event.repeat&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&this.controlsAllowed()){
      const element=event.target as HTMLElement|null;
      if(element?.isContentEditable||element?.closest('input,textarea,select'))return;
      event.preventDefault();mobileInput.setAttackHeld(false);toggleCameraMode();return;
    }
    if(event.code!=='AltLeft'&&event.code!=='AltRight')return;
    if(!this.controlsAllowed()){this.clearControls();return;}
    if(!this.enabled&&!this.locked&&!this.altKeys.size)return;
    event.preventDefault();
    if(this.altKeys.has(event.code))return;
    this.resumeCapture ||=this.locked;
    this.altKeys.add(event.code);this.release();
  };
  private readonly keyUp=(event:KeyboardEvent)=>{
    if(!this.altKeys.delete(event.code))return;
    event.preventDefault();if(this.altKeys.size)return;
    const resume=this.resumeCapture;this.resumeCapture=false;
    if(resume)this.capture();
  };
  private readonly lockChanged=()=>{const locked=this.locked;if(locked&&(this.altKeys.size||!this.controlsAllowed())){this.release();return;}if(!locked){mobileInput.setAttackHeld(false);if(this.wasLocked&&!this.releasing&&this.enabled)this.pause();this.releasing=false;}this.wasLocked=locked;};
  private readonly contextMenu=(event:MouseEvent)=>{if(this.enabled)event.preventDefault();};
  private readonly down=(event:PointerEvent)=>{
    this.reconcileAlt(event.altKey);
    if(event.altKey||this.altKeys.size){if(event.button===0)this.pick(event);return;}
    if(!this.enabled){if(event.button===0)this.pick(event);return;}
    if(event.pointerType==='touch'){
      this.canvas.setPointerCapture(event.pointerId);this.touches.set(event.pointerId,{x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,moved:false});this.touchDistance=0;return;
    }
    if(event.button===0){event.preventDefault();this.pick(event);mobileInput.press('attack');mobileInput.setAttackHeld(true);if(!this.locked)this.capture();}
    else if(event.button===2){event.preventDefault();mobileInput.press('dash');}
  };
  private rotate(dx:number,dy:number){
    if(this.combatLocked)return;
    const scale=.0025*this.settings.sensitivity;
    this.targetYaw-=Math.max(-140,Math.min(140,dx))*scale;
    this.targetPitch=Math.max((this.firstPerson?-85:-60)*RAD,Math.min((this.firstPerson?85:75)*RAD,this.targetPitch+dy*scale*(this.settings.invertY?-1:1)));
  }
  private readonly mouseMove=(event:MouseEvent)=>{this.reconcileAlt(event.altKey);if(this.enabled&&!event.altKey&&!this.altKeys.size&&this.locked&&this.controlsAllowed())this.rotate(event.movementX,event.movementY);};
  private readonly mouseUp=()=>{mobileInput.setAttackHeld(false);};
  private readonly touchMove=(event:PointerEvent)=>{
    const touch=this.touches.get(event.pointerId);if(!touch||!this.enabled||!this.controlsAllowed())return;
    const dx=event.clientX-touch.x,dy=event.clientY-touch.y;touch.x=event.clientX;touch.y=event.clientY;
    touch.moved ||=Math.hypot(touch.x-touch.startX,touch.y-touch.startY)>6;
    if(this.touches.size===1&&touch.moved)this.rotate(dx,dy);
    else if(this.touches.size===2){const points=[...this.touches.values()],distance=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);
      if(this.touchDistance>0&&!this.firstPerson)this.targetZoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,this.targetZoom*this.touchDistance/Math.max(20,distance)));
      this.touchDistance=distance;for(const point of points)point.moved=true;
    }
  };
  private readonly up=(event:PointerEvent)=>{const touch=this.touches.get(event.pointerId);this.touches.delete(event.pointerId);this.touchDistance=0;
    if(touch&&!touch.moved&&event.type!=='pointercancel')this.pick(event);
    if(this.canvas.hasPointerCapture(event.pointerId))this.canvas.releasePointerCapture(event.pointerId);
  };
  private readonly wheel=(event:WheelEvent)=>{
    if(!this.enabled||!this.controlsAllowed()){this.clearControls();return;}
    this.reconcileAlt(event.altKey);
    if(event.altKey||this.altKeys.size)return;
    event.preventDefault();if(this.firstPerson)return;
    this.targetZoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,this.targetZoom*Math.exp(Math.max(-100,Math.min(100,event.deltaY))*.0015)));
  };
  private applyGameplayMode(eyeAvailable:boolean){
    const selected=this.settings.mode==='first-person';if(selected===this.gameplayFirstPerson||selected&&!eyeAvailable)return;
    if(selected){this.savedPitch=this.targetPitch;this.pitch=this.targetPitch=0;}
    else this.pitch=this.targetPitch=this.savedPitch;
    this.gameplayFirstPerson=selected;this.initialized=false;
  }
  private restoreGameplayPose(){
    if(this.gameplayPose)Object.assign(this,this.gameplayPose);
    this.scriptedView=false;this.playerRestored=true;this.initialized=false;
  }
  private ownCamera(control:PresentationCameraControl|undefined,eyeAvailable:boolean){
    const owner=control?.owner;
    if(owner!==this.cameraOwner){this.clearControls();this.cameraOwner=owner;}
    if(!control){
      if(this.gameplayPose&&!this.playerRestored)this.restoreGameplayPose();
      this.gameplayPose=null;this.scriptedView=false;this.playerRestored=false;this.applyGameplayMode(eyeAvailable);return;
    }
    if(!this.gameplayPose){
      this.applyGameplayMode(eyeAvailable);
      const {yaw,targetYaw,pitch,targetPitch,zoom,targetZoom,savedPitch,gameplayFirstPerson}=this;
      this.gameplayPose={yaw,targetYaw,pitch,targetPitch,zoom,targetZoom,savedPitch,gameplayFirstPerson};
      this.playerRestored=false;
    }
    if(control.view==='scripted'&&!this.scriptedView){
      this.scriptedView=true;this.playerRestored=false;this.initialized=false;
      this.pitch=this.targetPitch=Math.max(20*RAD,Math.min(60*RAD,this.savedPitch));this.zoom=this.targetZoom=1;
    }else if(control.view==='player'){
      if(!this.playerRestored)this.restoreGameplayPose();this.applyGameplayMode(eyeAvailable);
    }
  }
  update(native:Phaser.Cameras.Scene2D.Camera,target:{x:number;y:number},height:(x:number,y:number)=>number,delta:number,enabled:boolean,
    lockedTarget?:{x:number;y:number},eyeHeight?:number,control?:PresentationCameraControl,terrainRange?:Readonly<TerrainHeightRange>){
    // Input ownership is released even when a collapsed viewport cannot draw.
    if(this.enabled!==enabled)this.clearControls();this.enabled=enabled;
    this.ownCamera(control,eyeHeight!==undefined||this.lastEyeHeight!==undefined);
    // A transient collapsed viewport must not overwrite the last valid
    // camera/projection or produce an invalid frustum during a mode switch.
    if(!Number.isFinite(native.width)||!Number.isFinite(native.height)||native.width<=0||native.height<=0
      ||!Number.isFinite(native.zoom)||native.zoom<=0||!Number.isFinite(target.x)||!Number.isFinite(target.y)
      ||eyeHeight!==undefined&&!Number.isFinite(eyeHeight))return false;
    const ground=height(target.x,target.y);if(!Number.isFinite(ground))return false;
    const frameDelta=Number.isFinite(delta)?Math.max(0,Math.min(80,delta)):0;
    if(eyeHeight!==undefined)this.lastEyeHeight=eyeHeight;
    const activeEye=eyeHeight??this.lastEyeHeight;
    const firstPerson=!this.scriptedView&&this.gameplayFirstPerson&&activeEye!==undefined;
    if(firstPerson!==this.firstPerson){this.firstPerson=firstPerson;this.initialized=false;}
    this.hint.hidden=!enabled||this.locked||!this.finePointer.matches||!this.canvas.requestPointerLock;
    this.combatLocked=enabled&&Boolean(lockedTarget)&&!firstPerson;
    if(this.combatLocked&&lockedTarget){
      const desired=Math.atan2(target.x-lockedTarget.x,target.y-lockedTarget.y);
      this.targetYaw=this.yaw+Math.atan2(Math.sin(desired-this.yaw),Math.cos(desired-this.yaw));
      this.targetPitch=Math.max(20*RAD,Math.min(60*RAD,this.targetPitch));
    }
    const step=1-Math.exp(-frameDelta/(this.combatLocked?170:85));
    this.yaw+=(this.targetYaw-this.yaw)*step;this.pitch+=(this.targetPitch-this.pitch)*step;this.zoom+=(this.targetZoom-this.zoom)*step;
    // Keep angles bounded after many complete revolutions without a visible snap.
    if(Math.abs(this.yaw)>Math.PI*4){const turns=Math.trunc(this.yaw/(Math.PI*2))*Math.PI*2;this.yaw-=turns;this.targetYaw-=turns;}
    const aimY=ground+32;
    let focusX=target.x,focusZ=target.y;
    if(this.combatLocked&&lockedTarget){const dx=lockedTarget.x-target.x,dz=lockedTarget.y-target.y,d=Math.max(1,Math.hypot(dx,dz)),bias=Math.min(.30,180/d);focusX+=dx*bias;focusZ+=dz*bias;}
    const follow=1-Math.exp(-frameDelta/55);
    if(!this.initialized||Math.hypot(this.focus.x-target.x,this.focus.z-target.y)>1200){this.focus.set(target.x,aimY,target.y);this.initialized=true;}
    else this.focus.lerp(this.nextFocus.set(target.x,aimY,target.y),follow);
    // Select the current mode's projection before deriving orbit distance.
    // Reusing the previous FPP FOV caused a one-frame zoom jump on return.
    this.camera.aspect=native.width/native.height;
    this.camera.fov=firstPerson?this.settings.firstPersonFov:38;this.camera.near=firstPerson ? .35 : 2;
    const base=native.height/(native.zoom*2*Math.tan(this.camera.fov*RAD/2));
    // A bounded frustum keeps terrain streaming finite on ultrawide displays.
    const distance=Math.max(MIN_DISTANCE,Math.min(1350,1900/Math.max(1,native.width/native.height),base*this.zoom));
    const orbitPitch=Math.max(8*RAD,this.pitch);
    const horizontal=distance*Math.cos(orbitPitch),vertical=distance*Math.sin(orbitPitch);
    this.camera.position.set(this.focus.x+horizontal*Math.sin(this.yaw),this.focus.y+vertical,this.focus.z+horizontal*Math.cos(this.yaw));
    // Only scenery obstructing the player fades in the presentation collector.
    // Keep the player's chosen orbit distance instead of zooming at wall edges.
    if(firstPerson){
      this.camera.position.set(target.x,ground+activeEye!,target.y);
      this.lookTarget.copy(this.camera.position).add(this.nextFocus.set(-Math.sin(this.yaw)*Math.cos(this.pitch),-Math.sin(this.pitch),-Math.cos(this.yaw)*Math.cos(this.pitch)));
      this.camera.lookAt(this.lookTarget);
    }else if(this.pitch>=8*RAD)this.camera.lookAt(this.combatLocked?this.lookTarget.set(focusX,aimY,focusZ):this.focus);
    else{
      this.lookTarget.copy(this.camera.position).add(this.nextFocus.set(-Math.sin(this.yaw)*Math.cos(this.pitch),-Math.sin(this.pitch),-Math.cos(this.yaw)*Math.cos(this.pitch)));
      this.camera.lookAt(this.lookTarget);
    }
    const shake=native.shakeEffect as Phaser.Cameras.Scene2D.Effects.Shake&ShakeOffset;
    if(shake.isRunning&&Number.isFinite(shake._offsetX)&&Number.isFinite(shake._offsetY))
      this.camera.setViewOffset(native.width,native.height,shake._offsetX,shake._offsetY,native.width,native.height);
    else if(this.camera.view?.enabled)this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
    this.focusGround.x=target.x;this.focusGround.y=target.y;
    // Streaming projects the same height slab as the terrain shader, rather
    // than intersecting every ray with sea level beneath a raised settlement.
    const validRange=terrainRange&&Number.isFinite(terrainRange.min)&&Number.isFinite(terrainRange.max)&&terrainRange.min<=terrainRange.max;
    const low=Math.min(ground,validRange?terrainRange.min:ground),high=Math.max(ground,validRange?terrainRange.max:ground);
    this.bounds.left=this.bounds.top=Infinity;this.bounds.right=this.bounds.bottom=-Infinity;
    let hasGround=false;
    for(const [x,y] of CORNERS){this.ndc.set(x,y);this.ray.setFromCamera(this.ndc,this.camera);
      const {origin,direction}=this.ray.ray;let hit=false;
      if(Math.abs(direction.y)>.001)for(let plane=0;plane<(low===high?1:2);plane++){
        const t=((plane===0?low:high)-origin.y)/direction.y;if(t<0)continue;
        hit=true;hasGround ||=t<=this.camera.far;this.includeGroundRay(Math.min(this.camera.far,t),target);
      }
      // Eye-level views can start inside the elevation slab. Keep their near
      // ground as well as the distant intersections, including on cliff slopes.
      if(origin.y>=low&&origin.y<=high){this.includeGroundRay(0,target);hasGround=true;}
      if(!hit)this.includeGroundRay(this.camera.far,target);
    }
    let {left,right,top,bottom}=this.bounds;
    // Include the center horizon ray: sky-facing corners alone can miss the
    // middle of a wide ground wedge. The fog boundary bounds its residency.
    if(!hasGround){left=target.x-384;right=target.x+384;top=target.y-384;bottom=target.y+384;}
    else if(this.pitch<25*RAD){
      const halfAngle=Math.atan(Math.tan(this.camera.fov*RAD/2)*this.camera.aspect)+.04;
      const include=(x:number,z:number)=>{left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,z);bottom=Math.max(bottom,z);};
      include(target.x-Math.sin(this.yaw)*VIEW_DISTANCE,target.y-Math.cos(this.yaw)*VIEW_DISTANCE);
      for(let i=0;i<4;i++){const a=i*Math.PI/2,dx=Math.sin(a),dz=Math.cos(a);
        if(-dx*Math.sin(this.yaw)-dz*Math.cos(this.yaw)>=Math.cos(halfAngle))include(target.x+dx*VIEW_DISTANCE,target.y+dz*VIEW_DISTANCE);
      }
    }
    this.bounds.left=left;this.bounds.right=right;this.bounds.top=top;this.bounds.bottom=bottom;
    return true;
  }
  private includeGroundRay(distance:number,target:{x:number;y:number}){
    const {origin,direction}=this.ray.ray;let x=origin.x+direction.x*distance,z=origin.z+direction.z*distance;
    const dx=x-target.x,dz=z-target.y,reach=Math.hypot(dx,dz);
    if(reach>VIEW_DISTANCE){x=target.x+dx/reach*VIEW_DISTANCE;z=target.y+dz/reach*VIEW_DISTANCE;}
    const b=this.bounds;b.left=Math.min(b.left,x);b.right=Math.max(b.right,x);b.top=Math.min(b.top,z);b.bottom=Math.max(b.bottom,z);
  }
  destroy(){
    this.destroyed=true;this.enabled=false;this.gameplayPose=null;this.cameraOwner=undefined;window.removeEventListener(CONTROL_SETTINGS_EVENT,this.updateControlHint);
    this.clearControls();this.hint.removeEventListener('click',this.capture);this.hint.remove();
    this.canvas.removeEventListener('pointerdown',this.down);this.canvas.removeEventListener('pointermove',this.touchMove);this.canvas.removeEventListener('pointerup',this.up);this.canvas.removeEventListener('pointercancel',this.up);
    this.canvas.removeEventListener('wheel',this.wheel);this.canvas.removeEventListener('contextmenu',this.contextMenu);
    document.removeEventListener('mousemove',this.mouseMove);document.removeEventListener('mouseup',this.mouseUp);document.removeEventListener('pointerlockchange',this.lockChanged);
    document.removeEventListener('keydown',this.keyDown,true);document.removeEventListener('keyup',this.keyUp,true);
    document.removeEventListener('visibilitychange',this.visibilityChanged);
    window.removeEventListener('blur',this.clearControls);window.removeEventListener(CAMERA_SETTINGS_EVENT,this.onSettings);
  }
}
