import {BufferGeometry,CanvasTexture,DirectionalLight,Float32BufferAttribute,Group,HemisphereLight,LinearFilter,Mesh,MeshStandardMaterial,PerspectiveCamera,Scene,SRGBColorSpace,DoubleSide,Euler,Quaternion,Vector3,type WebGLRenderer} from 'three';
import {firstPersonPose,firstPersonMeleePose,type FirstPersonPose} from './FirstPersonPose';
import type {Player} from '../entities/Player';
import {SWORD_TEXTURE,type SwordFrameData,type SwordSource} from '../systems/EquippedSwordVisual';
import {useGameStore} from '../../store/gameStore';
import {WEAPON_BY_ID} from '../../data/weapons';
import {awakenedProfile} from '../../data/awakening';
import type Phaser from 'phaser';
import type {WorldScene} from '../scenes/WorldScene';

/** Approved weapon painting mapped onto a ridged blade and rounded grip.
 * A single native-resolution crop is decoded only on entering this view or
 * changing equipment. One loaded mesh plus one cancellable job, never a cache
 * of every weapon, per-frame pixel scans, or another gameplay clock. */
export class FirstPersonWeapon {
  private readonly scene=new Scene();
  private readonly camera=new PerspectiveCamera(68,1,.01,8);
  private readonly rig=new Group();
  private readonly pose:FirstPersonPose={x:0,y:0,z:0,rx:0,ry:0,rz:0};
  private readonly nextPose:FirstPersonPose={x:0,y:0,z:0,rx:0,ry:0,rz:0};
  private readonly bladePoint=new Vector3();private readonly bladeVelocity=new Vector3();
  private readonly poseEuler=new Euler();private readonly poseOrientation=new Quaternion();private readonly nextOrientation=new Quaternion();
  private mesh:Mesh<BufferGeometry,MeshStandardMaterial>|null=null;
  private loadedKey='';private loadingKey='';private failedKey='';
  private abort:AbortController|null=null;private epoch=0;private disposed=false;private active=false;
  private nativeAngle=0;private phase=0;private previousYaw=0;private previousPitch=0;
  private readonly reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  constructor(private readonly renderer:WebGLRenderer){
    this.scene.add(this.rig,new HemisphereLight(0xddeaff,0x58402a,2));
    const key=new DirectionalLight(0xfff0d7,2.2);key.position.set(-2,3,4);this.scene.add(key);
    const rim=new DirectionalLight(0xadcaff,1.1);rim.position.set(3,0,-2);this.scene.add(rim);
    this.rig.visible=false;
  }
  update(player:Player|undefined,active:boolean,paused:boolean,width:number,height:number,delta:number,yaw:number,pitch:number,night:number){
    this.active=active&&Boolean(player);
    if(!this.active||!player){this.cancelLoad();this.rig.visible=false;if(this.mesh)this.mesh.visible=false;return;}
    const state=useGameStore.getState(),weapon=WEAPON_BY_ID[state.weaponId];
    const atlas=player.scene.textures.exists(SWORD_TEXTURE)?player.scene.textures.get(SWORD_TEXTURE):undefined;
    const id=awakenedProfile(state.weaponId,state.awakenedWeapons)&&atlas?.has('awakened:'+state.weaponId)?'awakened:'+state.weaponId:state.weaponId;
    const source=atlas?.has(id)?(atlas.get(id).customData as SwordFrameData).firstPerson:undefined;
    if(!source||!weapon||!['sword','greatsword'].includes(weapon.kind)){
      this.cancelLoad();this.rig.visible=false;if(this.mesh)this.mesh.visible=false;return;
    }
    const key=id+':'+source.path;
    if(key!==this.loadedKey&&key!==this.loadingKey&&key!==this.failedKey)this.load(key,source);
    const mesh=this.mesh,ready=Boolean(mesh&&this.loadedKey===key);
    this.rig.visible=ready&&!player.skills.hidesWeapon;if(!mesh||!ready)return;
    const cast=player.skills.presentationCast;
    mesh.visible=this.rig.visible;
    this.camera.aspect=width/Math.max(1,height);this.camera.updateProjectionMatrix();
    const body=player.body as Phaser.Physics.Arcade.Body;
    const dt=paused?0:Math.max(0,Math.min(delta,80));
    const moving=Math.min(1,body.velocity.length()/200);
    if(!this.reduced.matches)this.phase+=dt*.009*moving;
    const bob=this.reduced.matches?0:Math.sin(this.phase)*moving*.009;
    const turn=paused?0:Math.max(-.08,Math.min(.08,yaw-this.previousYaw));
    const tilt=paused?0:Math.max(-.08,Math.min(.08,pitch-this.previousPitch));
    this.previousYaw=yaw;this.previousPitch=pitch;
    const attack=player.presentationAttack,time=(player.scene as WorldScene).combatTime??player.scene.time.now;
    this.samplePose(this.pose,player,time,0);this.samplePose(this.nextPose,player,time,2);
    const pose=this.pose;
    this.rig.position.set(pose.x-turn*.6,pose.y+bob-tilt*.4,pose.z);
    this.rig.rotation.set(pose.rx,pose.ry-turn*4,pose.rz);
    this.rig.scale.setScalar(.72);
    let bladeYaw=1.05;
    if(attack||cast?.skill.kind==='strike'&&cast.skill.id!=='iron-tempest'){
      // The long axis follows the authored grip arc. Roll the real blade
      // around that axis so its cutting edge leads the motion, rather than
      // sliding the broad painted face through the enemy like a paddle.
      const next=this.nextPose;
      this.poseOrientation.setFromEuler(this.poseEuler.set(pose.rx,pose.ry-turn*4,pose.rz));
      this.nextOrientation.setFromEuler(this.poseEuler.set(next.rx,next.ry-turn*4,next.rz));
      this.bladePoint.set(0,.52,0).applyQuaternion(this.poseOrientation);this.bladePoint.x+=pose.x;this.bladePoint.y+=pose.y;this.bladePoint.z+=pose.z;
      this.bladeVelocity.set(0,.52,0).applyQuaternion(this.nextOrientation);this.bladeVelocity.x+=next.x;this.bladeVelocity.y+=next.y;this.bladeVelocity.z+=next.z;
      this.bladeVelocity.sub(this.bladePoint).applyQuaternion(this.poseOrientation.invert());
      const velocity=this.bladeVelocity;
      if(velocity.x*velocity.x+velocity.z*velocity.z>1e-12){
        // Both edges can cut. Equivalent half-turns keep the wrist from
        // flipping 180 degrees when the stroke changes into its recovery.
        const difference=Math.atan2(-velocity.z,velocity.x)-bladeYaw;
        const roll=Math.atan2(Math.sin(difference*2),Math.cos(difference*2))*.5;
        const progress=attack?(time-attack.startedAt)/(attack.endsAt-attack.startedAt):0;
        const weight=attack?Math.max(0,Math.min(1,progress/Math.max(.01,attack.step.impactFraction*.45),(1-progress)/.25))
          :cast?Math.max(0,Math.min(1,cast.elapsed/80,(cast.skill.durationMs-cast.elapsed)/140)):0;
        bladeYaw+=roll*weight;
      }
    }
    mesh.rotation.set(0,bladeYaw,this.nativeAngle);
    const brightness=1-night*.48;mesh.material.color.setRGB(brightness,brightness,Math.min(1,brightness+.035));
  }
  private samplePose(out:FirstPersonPose,player:Player,time:number,offset:number){
    const cast=player.skills.presentationCast,attack=player.presentationAttack;
    if(cast)firstPersonPose(out,cast.skill.id,cast.elapsed+offset);
    else if(attack){
      const duration=Math.max(1,attack.endsAt-attack.startedAt);
      firstPersonMeleePose(out,player.presentationAttackStep,(time+offset-attack.startedAt)/duration,attack.step.impactFraction,(attack.activeUntil-attack.impactAt)/duration);
    }else firstPersonPose(out);
  }
  render(){if(!this.rig.visible||!this.active)return;this.renderer.clearDepth();this.renderer.render(this.scene,this.camera);}
  private cancelLoad(){if(this.abort){this.epoch++;this.abort.abort();this.abort=null;this.loadingKey='';}}
  private load(key:string,source:SwordSource){
    this.cancelLoad();const abort=new AbortController(),epoch=++this.epoch;
    this.abort=abort;this.loadingKey=key;if(this.mesh)this.mesh.visible=false;
    void this.prepare(source,abort.signal,epoch).then(mesh=>{
      if(!mesh)return;
      if(this.disposed||epoch!==this.epoch||abort.signal.aborted||!this.active){this.release(mesh);return;}
      if(this.mesh)this.release(this.mesh);
      this.mesh=mesh;this.loadedKey=key;this.loadingKey='';this.abort=null;this.nativeAngle=source.nativeAngle;
    }).catch(error=>{
      if(this.disposed||epoch!==this.epoch||abort.signal.aborted)return;
      this.loadingKey='';this.abort=null;this.failedKey=key;
      console.warn('[first-person] Equipped blade could not be prepared:',error);
    });
  }
  private async prepare(source:SwordSource,signal:AbortSignal,epoch:number){
    const response=await fetch(import.meta.env.BASE_URL+source.path,{signal});if(!response.ok)throw new Error('Weapon image request failed');
    const bitmap=await createImageBitmap(await response.blob());
    let mesh:Mesh<BufferGeometry,MeshStandardMaterial>|null=null,retained=false;
    const canvas=document.createElement('canvas');
    try{
      if(this.disposed||signal.aborted||epoch!==this.epoch)return null;
      const [x,y,w,h]=source.region;canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(bitmap,x,y,w,h,0,0,w,h);
      const geometry=bladeGeometry(ctx.getImageData(0,0,w,h).data,w,h,source);
      const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;texture.minFilter=texture.magFilter=LinearFilter;texture.generateMipmaps=false;
      mesh=new Mesh(geometry,new MeshStandardMaterial({map:texture,alphaTest:.12,side:DoubleSide,vertexColors:true,roughness:.46,metalness:.32,toneMapped:false}));
      mesh.name='first-person-equipped-sword';this.rig.add(mesh);
      const previous=this.renderer.getRenderTarget();let ready:Promise<unknown>;
      try{this.renderer.setRenderTarget(null);ready=this.renderer.compileAsync(this.scene,this.camera);}
      finally{this.renderer.setRenderTarget(previous);}
      await ready;
      if(this.disposed||signal.aborted||epoch!==this.epoch)return null;
      retained=true;return mesh;
    }finally{bitmap.close();if(!retained){if(mesh)this.release(mesh);else canvas.width=canvas.height=1;}}
  }
  private release(mesh:Mesh<BufferGeometry,MeshStandardMaterial>){
    mesh.removeFromParent();mesh.geometry.dispose();
    const texture=mesh.material.map;if(texture){texture.dispose();const image=texture.image as HTMLCanvasElement;image.width=image.height=1;}
    mesh.material.dispose();
  }
  destroy(){
    if(this.disposed)return;this.disposed=true;this.cancelLoad();
    if(this.mesh)this.release(this.mesh);this.mesh=null;
    this.scene.clear();
  }
}

function bladeGeometry(pixels:Uint8ClampedArray,width:number,height:number,source:SwordSource){
  const positions:number[]=[],uv:number[]=[],colors:number[]=[],indices:number[]=[],length=source.bladeLength;
  const vertex=(x:number,y:number,z:number,u:number,v:number,shade:number)=>{
    positions.push((x-source.gripX)/length,(source.gripY-y)/length,z);uv.push(u,1-v);colors.push(shade,shade,shade);
  };
  const opaque=(x:number,y:number)=>x>=0&&y>=0&&x<width&&y<height&&pixels[(Math.floor(y)*width+Math.floor(x))*4+3]>100;
  // Decode-time only: derive the actual silhouette's cross sections, including
  // asymmetric/serrated blades, guard and pommel. No rectangular card faces.
  const low=new Float32Array(height),high=new Float32Array(height);
  for(let y=0;y<height;y++){low[y]=width;high[y]=0;for(let x=0;x<width;x++)if(opaque(x,y)){low[y]=Math.min(low[y],x);high[y]=x+1;}}
  const depth=(x:number,y:number)=>{
    const row=Math.min(height-1,Math.max(0,Math.floor(y))),half=Math.max(1,(high[row]-low[row])/2),center=(low[row]+high[row])/2;
    const profile=Math.max(0,1-Math.abs(x-center)/half),handle=y>source.gripY-length*.07;
    return .004+(handle?Math.sqrt(profile)*.045:profile*.034);
  };
  const step=3,nx=Math.ceil(width/step),ny=Math.ceil(height/step),stride=nx+1,count=stride*(ny+1);
  for(const sign of [1,-1])for(let row=0;row<=ny;row++)for(let col=0;col<=nx;col++){
    const x=Math.min(width,col*step),y=Math.min(height,row*step);vertex(x,y,sign*depth(x,y),x/width,y/height,1);
  }
  for(let row=0;row<ny;row++)for(let col=0;col<nx;col++){
    const x=col*step,y=row*step,cx=Math.min(width-1,x+step/2),cy=Math.min(height-1,y+step/2);
    if(!opaque(cx,cy))continue;
    const a=row*stride+col,b=a+1,c=a+stride,d=c+1;
    indices.push(a,c,b,b,c,d,count+a,count+b,count+c,count+b,count+d,count+c);
    for(const [dx,dy] of [[-step,0],[step,0],[0,-step],[0,step]]){
      if(opaque(cx+dx,cy+dy))continue;
      const x0=dx<0?x:dx>0?Math.min(width,x+step):x,y0=dy<0?y:dy>0?Math.min(height,y+step):y;
      const x1=dx?x0:Math.min(width,x+step),y1=dy?y0:Math.min(height,y+step),base=positions.length/3;
      for(const [px,py,sign] of [[x0,y0,-1],[x1,y1,-1],[x0,y0,1],[x1,y1,1]])vertex(px,py,sign*depth(px,py),cx/width,cy/height,.72);
      indices.push(base,base+1,base+2,base+1,base+3,base+2);
    }
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));geometry.setAttribute('color',new Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
