import Phaser from 'phaser';
import {onPlane} from '../presentation25d/plane';
import {WEAPONS,WEAPON_BY_ID} from '../../data/weapons';
import {itemIcon} from '../../data/economy';
import {alphaFrameBounds} from './spriteArt';
import {useGameStore} from '../../store/gameStore';
import {heroFrameData} from './heroFrameData';
import {AWAKENING_PROFILES,awakenedProfile,awakeningArtPath} from '../../data/awakening';

interface SwordFrameData {gripX:number;gripY:number;nativeAngle:number;bladeLength:number}

export const SWORD_SOURCE='equipped-sword-source',SWORD_TEXTURE='equipped-swords';
export const awakenedSwordSource=(slug:string)=>'awakened-sword-source:'+slug;
// Handle centres and blade tips inspected on the separate prepared artworks.
const AWAKENED_REGISTRATION:Record<string,readonly [number,number,number,number]>={
 varr:[130/256,260/320,125/256,11/320],warden:[128/256,259/320,145/256,10/320],
 stonejaw:[.5,260/320,.5,8/320],'iron-tusk':[136/256,254/320,135/256,9/320],
 rootfather:[.5,260/320,.5,9/320],'salt-king':[114/256,256/320,146/256,12/320],
 'frost-wyrm':[.5,264/320,.5,9/320],'ashen-seer':[.5,259/320,136/256,10/320],
 varkhul:[.5,265/320,142/256,11/320],
};
export function loadAwakenedSwords(scene:Phaser.Scene){
 for(const profile of AWAKENING_PROFILES)scene.load.image(awakenedSwordSource(profile.slug),awakeningArtPath(profile,'weapon-v1.png'));
}
// Cell-relative handle centers and blade tips, inspected on equipment-v1.png.
// Curved/asymmetric blades must not use the alpha box's center as their handle.
const SWORD_REGISTRATION:readonly (readonly [number,number,number,number])[]=[
  [.52,.78,.52,.05],[.50,.78,.50,.05],[.50,.78,.50,.05],[.50,.78,.50,.05],
  [.49,.82,.55,.03],[.50,.80,.57,.03],[.50,.82,.49,.03],[.50,.82,.57,.04],
  [.48,.82,.56,.04],[.40,.82,.76,.03],[.43,.82,.49,.03],[.50,.82,.52,.03],
  [.34,.81,.70,.02],
];
/** One small shared atlas for all swords; never duplicates the hero atlases. */
export function prepareEquippedSwords(scene:Phaser.Scene){
  const image=scene.textures.get(SWORD_SOURCE).getSourceImage() as HTMLImageElement;
  const read=document.createElement('canvas');read.width=image.width;read.height=image.height;
  const context=read.getContext('2d',{willReadFrequently:true})!;context.drawImage(image,0,0);
  const rgba=context.getImageData(0,0,image.width,image.height).data;
  const swords=WEAPONS.filter(w=>w.kind==='sword'||w.kind==='greatsword');
  const awakened=AWAKENING_PROFILES.filter(p=>scene.textures.exists(awakenedSwordSource(p.slug)));
  const texture=scene.textures.createCanvas(SWORD_TEXTURE,512,Math.ceil((swords.length+awakened.length)/4)*160)!;
  const draw=texture.getContext();draw.imageSmoothingEnabled=true;
  swords.forEach((weapon,index)=>{
    const icon=itemIcon(weapon.id),cell=[Math.floor(icon%4*image.width/4),Math.floor(Math.floor(icon/4)*image.height/4),Math.floor(image.width/4),Math.floor(image.height/4)] as const;
    const bounds=alphaFrameBounds(rgba,image.width,cell);if(!bounds)throw new Error('Empty equipped sword artwork: '+weapon.id);
    const [x,y,w,h]=bounds,fit=Math.min(120/w,152/h),ox=index%4*128,oy=Math.floor(index/4)*160,left=(128-w*fit)/2,top=(160-h*fit)/2;
    draw.drawImage(image,x,y,w,h,ox+left,oy+top,w*fit,h*fit);
    const [gx,gy,tx,ty]=SWORD_REGISTRATION[icon];
    const handleX=cell[0]+gx*cell[2],handleY=cell[1]+gy*cell[3];
    const dx=(tx-gx)*cell[2],dy=(ty-gy)*cell[3];
    texture.add(weapon.id,0,ox,oy,128,160)!.customData={
      gripX:(left+(handleX-x)*fit)/128,gripY:(top+(handleY-y)*fit)/160,
      nativeAngle:Math.atan2(dx,-dy),bladeLength:Math.hypot(dx,dy)*fit,
    };
  });
  awakened.forEach((profile,slot)=>{
    const key=awakenedSwordSource(profile.slug),image=scene.textures.get(key).getSourceImage() as HTMLImageElement;
    read.width=image.width;read.height=image.height;context.drawImage(image,0,0);
    const bounds=alphaFrameBounds(context.getImageData(0,0,image.width,image.height).data,image.width,[0,0,image.width,image.height]);
    if(!bounds)throw new Error('Empty awakened sword artwork: '+profile.slug);
    const [x,y,w,h]=bounds,fit=Math.min(120/w,152/h),index=swords.length+slot,ox=index%4*128,oy=Math.floor(index/4)*160,left=(128-w*fit)/2,top=(160-h*fit)/2;
    draw.drawImage(image,x,y,w,h,ox+left,oy+top,w*fit,h*fit);
    const [gx,gy,tx,ty]=AWAKENED_REGISTRATION[profile.slug],dx=(tx-gx)*image.width,dy=(ty-gy)*image.height;
    texture.add('awakened:'+profile.weaponId,0,ox,oy,128,160)!.customData={
      gripX:(left+(gx*image.width-x)*fit)/128,gripY:(top+(gy*image.height-y)*fit)/160,
      nativeAngle:Math.atan2(dx,-dy),bladeLength:Math.hypot(dx,dy)*fit,
    };scene.textures.remove(key);
  });
  texture.refresh();scene.textures.remove(SWORD_SOURCE);
}

/** Back blade -> body -> front blade -> glove patch. Physics stays on Player. */
export class EquippedSwordVisual{
  private readonly blade:Phaser.GameObjects.Sprite;
  private readonly hand:Phaser.GameObjects.Sprite;
  constructor(scene:Phaser.Scene){
    this.blade=scene.add.sprite(0,0,SWORD_TEXTURE,'roadwarden-sword').setVisible(false).setName('equipped-sword');
    this.hand=scene.add.sprite(0,0,'leigneron',0).setVisible(false).setName('equipped-sword-hand');
  }
  update(actor:Phaser.GameObjects.Sprite,stowed=false,facingUp=false){
    onPlane(this.blade,'upright',actor);onPlane(this.hand,'upright',actor);
    const state=useGameStore.getState(),id=state.weaponId,definition=WEAPON_BY_ID[id];
    const frameId=awakenedProfile(id,state.awakenedWeapons)&&this.blade.scene.textures.get(SWORD_TEXTURE).has('awakened:'+id)?'awakened:'+id:id;
    const meta=heroFrameData(actor.frame),density=meta.heroDensity??4,bodyScale=meta.heroBodyScale??1;
    // Back mount follows the foot-registered torso, not changing cape bounds
    // or the swinging glove. That keeps it stable throughout walking/running.
    // Rear-facing art exposes the blade over the cape; front/side art hides it
    // behind the body. This never changes the player's collision footprint.
    const grip=stowed?{
      x:actor.width*actor.originX-9*density/bodyScale,
      y:actor.height*actor.originY-54*density/bodyScale,
      angle:150,behind:!facingUp,
    }:meta.weaponGrip;
    if(!actor.active||actor.alpha<=0||!grip||!definition||!['sword','greatsword'].includes(definition.kind)
      ||grip.x<0||grip.y<0||grip.x>actor.width||grip.y>actor.height){this.hide();return;}
    this.blade.cameraFilter=actor.cameraFilter;this.hand.cameraFilter=actor.cameraFilter;
    const frame=this.blade.scene.textures.get(SWORD_TEXTURE).get(frameId),data=frame.customData as SwordFrameData;
    const x=actor.flipX?actor.width-grip.x:grip.x;
    const localX=(x-actor.width*actor.originX)*actor.scaleX;
    const localY=(grip.y-actor.height*actor.originY)*actor.scaleY;
    const cos=Math.cos(actor.rotation),sin=Math.sin(actor.rotation);
    // Scale relative to the body's prepared density, not a fixed world size.
    // Skill FX bounds include halos and must never be used as body dimensions.
    // Registration makes every neutral body the same world height. It must
    // not independently enlarge/shrink the equipped blade or its back mount.
    const bladeLength=36*Math.abs(actor.scaleY)*density/bodyScale;
    const rotation=Phaser.Math.DegToRad(grip.angle)-data.nativeAngle;
    this.blade.setTexture(SWORD_TEXTURE,frameId).setFlipX(actor.flipX).setOrigin(actor.flipX?1-data.gripX:data.gripX,data.gripY)
      .setScale(bladeLength/data.bladeLength).setRotation(actor.rotation+(actor.flipX?-rotation:rotation))
      .setPosition(actor.x+localX*cos-localY*sin,actor.y+localX*sin+localY*cos)
      .setDepth(actor.depth+(grip.behind?-.02:.02)).setAlpha(actor.alpha).setVisible(actor.visible);
    // Reuse the full parent frame with a tiny crop, preserving the glove's
    // original pixels/registration instead of drawing substitute hands.
    const radius=5/Math.max(.001,Math.abs(actor.scaleX));
    const left=Math.max(0,grip.x-radius),top=Math.max(0,grip.y-radius);
    this.hand.setTexture(actor.texture.key,actor.frame.name).setOrigin(actor.originX,actor.originY).setScale(actor.scaleX,actor.scaleY).setFlipX(actor.flipX).setRotation(actor.rotation)
      .setPosition(actor.x,actor.y).setDepth(actor.depth+.04).setAlpha(actor.alpha).setVisible(actor.visible&&!grip.behind&&!stowed)
      .setCrop(left,top,Math.min(actor.width-left,radius*2),Math.min(actor.height-top,radius*2));
  }
  hide(){this.blade.setVisible(false);this.hand.setVisible(false);}
  destroy(){this.blade.destroy();this.hand.destroy();}
}
