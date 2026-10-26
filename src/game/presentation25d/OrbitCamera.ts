import {PerspectiveCamera,Raycaster,Vector2,Vector3} from 'three';
import type Phaser from 'phaser';
import {mobileInput} from '../input';
import {getCameraSettings,CAMERA_SETTINGS_EVENT} from './cameraSettings';
import {VIEW_DISTANCE} from './environment';

const RAD=Math.PI/180;
const MIN_ZOOM=.18,MAX_ZOOM=1.7,MIN_DISTANCE=90;
const CORNERS=[[-1,-1],[1,-1],[-1,1],[1,1]] as const;
interface ShakeOffset {_offsetX:number;_offsetY:number}
export class OrbitCamera {
  readonly camera=new PerspectiveCamera(38,1,2,4000);
  yaw=25*RAD;pitch=42*RAD;private targetYaw=this.yaw;private targetPitch=this.pitch;
  private zoom=1;private targetZoom=1;private enabled=false;private touchDistance=0;
  private readonly focus=new Vector3();private initialized=false;
  private readonly nextFocus=new Vector3();
  private readonly lookTarget=new Vector3();
  private combatLocked=false;
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
    this.hint.textContent='Mouse look · click to capture · hold Alt for cursor · R lock · Esc to release';
    canvas.addEventListener('pointerdown',this.down);canvas.addEventListener('pointermove',this.touchMove);canvas.addEventListener('pointerup',this.up);canvas.addEventListener('pointercancel',this.up);
    canvas.addEventListener('wheel',this.wheel,{passive:false});canvas.addEventListener('contextmenu',this.contextMenu);
    document.addEventListener('mousemove',this.mouseMove);document.addEventListener('mouseup',this.mouseUp);document.addEventListener('pointerlockchange',this.lockChanged);
    document.addEventListener('keydown',this.keyDown,true);document.addEventListener('keyup',this.keyUp,true);
    document.addEventListener('visibilitychange',this.visibilityChanged);
    window.addEventListener('blur',this.clearControls);window.addEventListener(CAMERA_SETTINGS_EVENT,this.onSettings);
  }
  get locked(){return document.pointerLockElement===this.canvas;}
  suspend(){this.enabled=false;this.clearControls();this.hint.hidden=true;}
  private readonly capture=()=>{
    if(this.destroyed||this.altKeys.size||!this.controlsAllowed()||!document.hasFocus()||document.hidden)return;
    try{const result=this.canvas.requestPointerLock?.();if(result)void result.then(()=>{
      if(this.destroyed||this.altKeys.size||!this.controlsAllowed()||!document.hasFocus()||document.hidden)this.release();
    }).catch(()=>{});}catch{/* Touch/unsupported WebViews retain drag orbit. */}
  };
  private readonly release=()=>{mobileInput.setAttackHeld(false);if(this.locked){this.releasing=true;document.exitPointerLock();}this.touches.clear();};
  private readonly clearControls=()=>{this.altKeys.clear();this.resumeCapture=false;this.release();};
  private readonly visibilityChanged=()=>{if(document.hidden)this.clearControls();};
  private readonly keyDown=(event:KeyboardEvent)=>{
    if(event.code!=='AltLeft'&&event.code!=='AltRight')return;
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
    if(this.altKeys.size){if(event.button===0)this.pick(event);return;}
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
    this.targetPitch=Math.max(-60*RAD,Math.min(75*RAD,this.targetPitch+dy*scale*(this.settings.invertY?-1:1)));
  }
  private readonly mouseMove=(event:MouseEvent)=>{if(this.enabled&&!this.altKeys.size&&this.locked&&this.controlsAllowed())this.rotate(event.movementX,event.movementY);};
  private readonly mouseUp=()=>{mobileInput.setAttackHeld(false);};
  private readonly touchMove=(event:PointerEvent)=>{
    const touch=this.touches.get(event.pointerId);if(!touch||!this.enabled)return;
    const dx=event.clientX-touch.x,dy=event.clientY-touch.y;touch.x=event.clientX;touch.y=event.clientY;
    touch.moved ||=Math.hypot(touch.x-touch.startX,touch.y-touch.startY)>6;
    if(this.touches.size===1&&touch.moved)this.rotate(dx,dy);
    else if(this.touches.size===2){const points=[...this.touches.values()],distance=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);
      if(this.touchDistance>0)this.targetZoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,this.targetZoom*this.touchDistance/Math.max(20,distance)));
      this.touchDistance=distance;for(const point of points)point.moved=true;
    }
  };
  private readonly up=(event:PointerEvent)=>{const touch=this.touches.get(event.pointerId);this.touches.delete(event.pointerId);this.touchDistance=0;
    if(touch&&!touch.moved&&event.type!=='pointercancel')this.pick(event);
    if(this.canvas.hasPointerCapture(event.pointerId))this.canvas.releasePointerCapture(event.pointerId);
  };
  private readonly wheel=(event:WheelEvent)=>{if(!this.enabled||this.altKeys.size)return;event.preventDefault();this.targetZoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,this.targetZoom*Math.exp(Math.max(-100,Math.min(100,event.deltaY))*.0015)));};
  update(native:Phaser.Cameras.Scene2D.Camera,target:{x:number;y:number},height:(x:number,y:number)=>number,delta:number,enabled:boolean,
    lockedTarget?:{x:number;y:number}){
    if(this.enabled&&!enabled){if(!this.altKeys.size)this.resumeCapture=false;this.release();}this.enabled=enabled;
    this.hint.hidden=!enabled||this.locked||!this.finePointer.matches||!this.canvas.requestPointerLock;
    this.combatLocked=enabled&&Boolean(lockedTarget);
    if(this.combatLocked&&lockedTarget){
      const desired=Math.atan2(target.x-lockedTarget.x,target.y-lockedTarget.y);
      this.targetYaw=this.yaw+Math.atan2(Math.sin(desired-this.yaw),Math.cos(desired-this.yaw));
      this.targetPitch=Math.max(20*RAD,Math.min(60*RAD,this.targetPitch));
    }
    const step=1-Math.exp(-Math.min(80,Math.max(0,delta))/(this.combatLocked?170:85));
    this.yaw+=(this.targetYaw-this.yaw)*step;this.pitch+=(this.targetPitch-this.pitch)*step;this.zoom+=(this.targetZoom-this.zoom)*step;
    // Keep angles bounded after many complete revolutions without a visible snap.
    if(Math.abs(this.yaw)>Math.PI*4){const turns=Math.trunc(this.yaw/(Math.PI*2))*Math.PI*2;this.yaw-=turns;this.targetYaw-=turns;}
    const ground=height(target.x,target.y),aimY=ground+32;
    let focusX=target.x,focusZ=target.y;
    if(this.combatLocked&&lockedTarget){const dx=lockedTarget.x-target.x,dz=lockedTarget.y-target.y,d=Math.max(1,Math.hypot(dx,dz)),bias=Math.min(.30,180/d);focusX+=dx*bias;focusZ+=dz*bias;}
    const follow=1-Math.exp(-Math.min(80,Math.max(0,delta))/55);
    if(!this.initialized||Math.hypot(this.focus.x-target.x,this.focus.z-target.y)>1200){this.focus.set(target.x,aimY,target.y);this.initialized=true;}
    else this.focus.lerp(this.nextFocus.set(target.x,aimY,target.y),follow);
    const base=native.height/(native.zoom*2*Math.tan(this.camera.fov*RAD/2));
    // A bounded frustum keeps terrain streaming finite on ultrawide displays.
    const distance=Math.max(MIN_DISTANCE,Math.min(1350,1900/Math.max(1,native.width/native.height),base*this.zoom));
    this.camera.aspect=native.width/native.height;
    const orbitPitch=Math.max(8*RAD,this.pitch);
    const horizontal=distance*Math.cos(orbitPitch),vertical=distance*Math.sin(orbitPitch);
    this.camera.position.set(this.focus.x+horizontal*Math.sin(this.yaw),this.focus.y+vertical,this.focus.z+horizontal*Math.cos(this.yaw));
    // Obstructions use the shared depth-tested character/target cutaway.
    // Keep the player's chosen orbit distance instead of zooming at wall edges.
    if(this.pitch>=8*RAD)this.camera.lookAt(this.combatLocked?this.lookTarget.set(focusX,aimY,focusZ):this.focus);
    else{
      this.lookTarget.copy(this.camera.position).add(this.nextFocus.set(-Math.sin(this.yaw)*Math.cos(this.pitch),-Math.sin(this.pitch),-Math.cos(this.yaw)*Math.cos(this.pitch)));
      this.camera.lookAt(this.lookTarget);
    }
    const shake=native.shakeEffect as Phaser.Cameras.Scene2D.Effects.Shake&ShakeOffset;
    if(shake.isRunning)this.camera.setViewOffset(native.width,native.height,shake._offsetX,shake._offsetY,native.width,native.height);
    else if(this.camera.view?.enabled)this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
    this.focusGround.x=target.x;this.focusGround.y=target.y;
    let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity,hasGround=false;
    for(const [x,y] of CORNERS){this.ndc.set(x,y);this.ray.setFromCamera(this.ndc,this.camera);
      const direction=this.ray.ray.direction;
      if(direction.y<-.001)hasGround=true;
      const t=direction.y<-.001?Math.max(0,Math.min(this.camera.far,-this.ray.ray.origin.y/direction.y)):this.camera.far;
      let px=this.ray.ray.origin.x+direction.x*t,pz=this.ray.ray.origin.z+direction.z*t;
      const dx=px-target.x,dz=pz-target.y,reach=Math.hypot(dx,dz);
      if(reach>VIEW_DISTANCE){px=target.x+dx/reach*VIEW_DISTANCE;pz=target.y+dz/reach*VIEW_DISTANCE;}
      left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,pz);bottom=Math.max(bottom,pz);
    }
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
  }
  destroy(){
    this.destroyed=true;this.enabled=false;
    this.clearControls();this.hint.removeEventListener('click',this.capture);this.hint.remove();
    this.canvas.removeEventListener('pointerdown',this.down);this.canvas.removeEventListener('pointermove',this.touchMove);this.canvas.removeEventListener('pointerup',this.up);this.canvas.removeEventListener('pointercancel',this.up);
    this.canvas.removeEventListener('wheel',this.wheel);this.canvas.removeEventListener('contextmenu',this.contextMenu);
    document.removeEventListener('mousemove',this.mouseMove);document.removeEventListener('mouseup',this.mouseUp);document.removeEventListener('pointerlockchange',this.lockChanged);
    document.removeEventListener('keydown',this.keyDown,true);document.removeEventListener('keyup',this.keyUp,true);
    document.removeEventListener('visibilitychange',this.visibilityChanged);
    window.removeEventListener('blur',this.clearControls);window.removeEventListener(CAMERA_SETTINGS_EVENT,this.onSettings);
  }
}
