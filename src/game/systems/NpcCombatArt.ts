import Phaser from 'phaser';
import {ART_BY_KEY} from '../../data/art';
import {NPC_COMBAT_ART,NPC_COMBAT_DIRECTIONS,npcCombatKey,NPC_ARROW_TEXTURE,type CombatSource,type NpcCombatSpec} from '../../data/npcCombatArt';
import {NPC_IDLE_ART,npcIdleBodyHeight} from '../../data/npcIdleArt';
import type {SpriteAnimation} from '../../data/animationPacks';
import {actorSpriteSubjects,type ActorSpriteSubject} from './spriteComponents';
import {spriteSubjectCanvas} from './spriteArt';
import {fitAtlasPoses,atlasGroundY} from './atlasPoseFit';

export function npcCombatSourceKey(spec:NpcCombatSpec,index:number){return `npc-combat-source:${spec.id}:${index}`;}
/** Complete isolated poses, never stitched body parts. One body calibration per
 * source; boots remain registered independently of weapon reach. */
export function prepareNpcCombatSheet(scene:Phaser.Scene,spec:NpcCombatSpec):SpriteAnimation[]{
  const steps=prepareNpcCombatSheetSteps(scene,spec);
  let result=steps.next();while(!result.done)result=steps.next();
  return result.value;
}
/** Runtime residency advances one source/pose step per frame. Eager boot users
 * drain the same generator, retaining exactly the same fitting and frame data. */
export function* prepareNpcCombatSheetSteps(scene:Phaser.Scene,spec:NpcCombatSpec,prepared?:ReadonlyMap<number,ActorSpriteSubject[]>):Generator<void,SpriteAnimation[]>{
  const sheet=ART_BY_KEY[spec.texture],d=sheet.density,fw=sheet.frameWidth*d,fh=sheet.frameHeight*d,gutter=4;
  const ground=sheet.frameHeight-(sheet.groundPadding??20),columns=sheet.atlasColumns!;
  // Regional walk+attack frames pack into 6x6, keeping both texture dimensions
  // below 2048px rather than producing an Android-hostile 2624px strip.
  const rows=Math.ceil(sheet.columns/columns);
  const texture=scene.textures.createCanvas(spec.texture,(fw+2*gutter)*columns,(fh+2*gutter)*rows)!;
  let complete=false;
  try{
  const ctx=texture.getContext();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  const idle=NPC_IDLE_ART.find(entry=>entry.walk===spec.walk)!;
  const modelHeight=spec.modelHeight??npcIdleBodyHeight(idle);
  const inputs:Array<{file:CombatSource;subjects:ActorSpriteSubject[];roots:readonly (readonly [number,number])[];fit:number}>=[];
  yield;
  for(const [index,file] of spec.sources.entries()){
    const image=scene.textures.get(npcCombatSourceKey(spec,index)).getSourceImage() as HTMLImageElement;
    let subjects=prepared?.get(index);
    if(!subjects){
      const native=document.createElement('canvas');native.width=image.width;native.height=image.height;
      const read=native.getContext('2d')!;read.drawImage(image,0,0);
      subjects=actorSpriteSubjects(read.getImageData(0,0,image.width,image.height).data,image.width,image.height,file.columns,file.rows);
      native.width=native.height=1;
    }
    const roots=subjects.map((s,i)=>{
      if(file.roots)return file.roots[i];
      if(spec.id==='elven-guard')return [(i%4+.5)*image.width/4,[405,800,1200][Math.floor(i/4)]*image.height/1280] as const;
      const row=Math.floor(i/file.columns);
      const bottoms=subjects.slice(row*file.columns,(row+1)*file.columns).map(p=>p.region[1]+p.region[3]).sort((a,b)=>a-b);
      // Median row baseline avoids weapon tips dragging just one pose upwards.
      return [(i%file.columns+.5)*image.width/file.columns,(bottoms[1]+bottoms[2])/2] as const;
    });
    const reference=subjects[0].region;
    const bodyHeight=file.bodyHeight??(spec.id==='elven-guard'?275*image.height/1280:roots[0][1]-reference[1]);
    inputs.push({file,subjects,roots,fit:modelHeight/Math.max(1,bodyHeight)});
    yield;
  }
  const animations:SpriteAnimation[]=[];
  function* draw(state:'attack'|'walk',directionIndex:number):Generator<void,void>{
    const direction=NPC_COMBAT_DIRECTIONS[directionIndex],vertical=state==='attack'&&spec.vertical&&(direction==='down'||direction==='up');
    const input=inputs[vertical?1:state==='walk'?(spec.walkSource??0):0],row=vertical?(direction==='up'?1:0):(state==='walk'?spec.walkRows!:spec.attackRows)[directionIndex];
    const mirrored=Boolean(spec.mirrorLeft&&direction==='left');
    const start=(state==='walk'?4:0)*spec.frames+directionIndex*spec.frames;
    const order=vertical&&spec.id==='huntress'?[0,1,3,0]:state==='attack'?spec.attackOrder:undefined;
    const side=state==='attack'&&(direction==='left'||direction==='right');
    const sourceIndex=(pose:number)=>side&&spec.sideFrames?spec.sideFrames[pose]:row*input.file.columns+(order?.[pose]??pose);
    const requestedFit=input.fit/(input.file.rowBodyRatios?.[row]??1)/(state==='attack'?(spec.attackBodyRatio??1):1);
    const poses=Array.from({length:spec.frames},(_,pose)=>{
        const index=sourceIndex(pose);
        return {region:input.subjects[index].region,
          rootX:input.roots[index][0],rootY:input.roots[index][1]};
      });
    const fit=fitAtlasPoses(requestedFit,sheet.frameWidth,sheet.frameHeight,ground,poses);
    const drawGround=atlasGroundY(ground,sheet.frameHeight,poses,fit);
    for(let pose=0;pose<spec.frames;pose++){
      // The huntress's vertical sheet releases on its fourth source pose; recovery
      // returns to the complete ready pose, never another draw/false release.
      const index=sourceIndex(pose);
      const subject=input.subjects[index],[left,top,width,height]=subject.region,[rootX,rootY]=input.roots[index];
      const x=sheet.frameWidth/2+(left-rootX)*fit,y=drawGround+(top-rootY)*fit;
      // One fitted scale covers every pose in this direction and state.
      const frame=start+pose,cx=frame%columns*(fw+2*gutter)+gutter,cy=Math.floor(frame/columns)*(fh+2*gutter)+gutter;
      ctx.save();ctx.translate(cx+(mirrored?fw:0),cy);if(mirrored)ctx.scale(-1,1);
      ctx.drawImage(spriteSubjectCanvas(subject),x*d,y*d,width*fit*d,height*fit*d);ctx.restore();
      texture.add(frame,0,cx,cy,fw,fh)!.customData={fullSprite:true,isolatedSubject:true,sourcePath:input.file.path,
        sourceRegion:subject.region,sourceFit:fit,sourceRoot:{x:rootX,y:rootY},sourceMirrored:mirrored,
        visibleBounds:{left:mirrored?sheet.frameWidth-x-width*fit:x,top:y,width:width*fit,height:height*fit}};
      yield;
    }
    animations.push({key:npcCombatKey(spec,state,direction),texture:spec.texture,
      frames:Array.from({length:spec.frames},(_,i)=>start+i),frameRate:state==='walk'?7:spec.frames===6?9:6,repeat:state==='walk'?-1:0});
  };
  for(let i=0;i<NPC_COMBAT_DIRECTIONS.length;i++){yield* draw('attack',i);if(spec.walkRows)yield* draw('walk',i);}
  texture.refresh();texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  complete=true;
  return animations;
  }finally{
    // Cancelling an obsolete residency job never leaves a half-built atlas.
    if(!complete&&scene.textures.exists(spec.texture))scene.textures.remove(spec.texture);
  }
}
export function prepareNpcCombatArt(scene:Phaser.Scene):SpriteAnimation[]{
  return NPC_COMBAT_ART.filter(a=>a.eager).flatMap(spec=>{
    const clips=prepareNpcCombatSheet(scene,spec);
    spec.sources.forEach((_,i)=>scene.textures.remove(npcCombatSourceKey(spec,i)));return clips;
  });
}
/** The original generated arrow is cropped/downsampled once, not each flight. */
export function prepareNpcArrow(scene:Phaser.Scene,sourceKey:string,prepared?:ActorSpriteSubject){
  if(scene.textures.exists(NPC_ARROW_TEXTURE))return;
  if(!scene.textures.exists(sourceKey))throw new Error('Missing NPC arrow artwork');
  const image=scene.textures.get(sourceKey).getSourceImage() as HTMLImageElement;
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  let subject=prepared;
  if(!subject){const read=canvas.getContext('2d')!;read.drawImage(image,0,0);subject=actorSpriteSubjects(read.getImageData(0,0,image.width,image.height).data,image.width,image.height,1,1)[0];}
  const texture=scene.textures.createCanvas(NPC_ARROW_TEXTURE,96,24)!,ctx=texture.getContext();
  const [, ,w,h]=subject.region,fit=Math.min(88/w,18/h);
  ctx.drawImage(spriteSubjectCanvas(subject),4,12-h*fit/2,w*fit,h*fit);texture.refresh();
  canvas.width=canvas.height=1;
}
