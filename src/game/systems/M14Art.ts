import Phaser from 'phaser';
import {isolateAtlasFrames} from './AtlasFrameIsolation';
import {ART_BY_KEY} from '../../data/art';
import type {M14ArtSpec} from '../../data/m14Art';
import {actorSpriteSubjects,type ActorSpriteSubject} from './spriteComponents';
import {createSpriteCropper,spriteSubjectCanvas} from './spriteArt';
import {fitAtlasPoses} from './atlasPoseFit';
import {prepareGrandMagusArt} from './GrandMagusArt';

export function m14Sources(spec:M14ArtSpec){
  if(spec.species===19)return [{kind:'atlas',key:`m14-source:${spec.id}:atlas`,path:`assets/enemies/${spec.folder}/atlas-hd-v2.png`,columns:1,rows:1},
    {kind:'spells',key:`m14-source:${spec.id}:spells`,path:`assets/enemies/${spec.folder}/spells-v1.png`,columns:2,rows:2}];
  const files=[{kind:'walk',path:`assets/enemies/${spec.folder}/${spec.boss?'walk-v2':'walk'}.png`,columns:spec.boss?4:5,rows:3},
    {kind:'actions',path:`assets/enemies/${spec.folder}/${spec.species===14?'actions-transparent-v2':'actions'}.png`,columns:6,rows:3}];
  if(spec.species===12)files.push({kind:'passing',path:`assets/enemies/${spec.folder}/passing.png`,columns:1,rows:1},
    {kind:'gait',path:`assets/enemies/${spec.folder}/gait-poses.png`,columns:4,rows:2},
    {kind:'stone',path:`assets/enemies/${spec.folder}/stone.png`,columns:1,rows:1});
  return files.map(file=>({...file,key:`m14-source:${spec.id}:${file.kind}`}));
}

/** Source isolation and registration only; never joins body parts. */
export function prepareM14Art(scene:Phaser.Scene,spec:M14ArtSpec){
  const steps=prepareM14ArtSteps(scene,spec);while(!steps.next().done){/* Staged boot callers retain synchronous compatibility. */}
}
export function* prepareM14ArtSteps(scene:Phaser.Scene,spec:M14ArtSpec,prepared?:ReadonlyMap<string,ActorSpriteSubject[]>):Generator<void,void>{
  if(spec.species===19){prepareGrandMagusArt(scene,spec,prepared?.get('spells'));return;}
  const subjects:Record<string,ActorSpriteSubject[]>={};
  const sources=new Map<ActorSpriteSubject,{sourcePath:string;sourceImageSize:readonly [number,number]}>();
  const canvas=document.createElement('canvas'),read=canvas.getContext('2d',{willReadFrequently:true})!;
  for(const file of m14Sources(spec)){
    const source=scene.textures.get(file.key).getSourceImage() as HTMLImageElement;
    const isolated=prepared?.get(file.kind);
    if(isolated)subjects[file.kind]=isolated;
    else{
      canvas.width=source.width;canvas.height=source.height;read.drawImage(source,0,0);
      const image=read.getImageData(0,0,source.width,source.height);
      subjects[file.kind]=actorSpriteSubjects(image.data,source.width,source.height,file.columns,file.rows);
    }
    for(const subject of subjects[file.kind])sources.set(subject,{sourcePath:file.path,sourceImageSize:[source.width,source.height]});
  }
  const sheet=ART_BY_KEY[spec.texture],columns=sheet.atlasColumns!,fw=sheet.frameWidth*sheet.density,fh=sheet.frameHeight*sheet.density;
  const texture=scene.textures.createCanvas(spec.texture,columns*fw,Math.ceil(sheet.columns/columns)*fh)!;
  let complete=false;
  try{
  const ctx=texture.getContext(),draw=createSpriteCropper();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  const drawPose=(subject:ActorSpriteSubject,fit:number,frame:number,mirror:boolean,falling=false,locomotion=false)=>{
    const [,,w,h]=subject.region;let sum=0,weight=0;
    // Existing approved ambient registrations remain unchanged.
    // A swinging boot must not drag the whole walking body sideways. Head/
    // crown registration is stable across the complete locomotion cycle;
    // combat uses the planted lower silhouette, independent of raised weapons.
    // A floating robe has no planted feet: trailing fabric must not shift the
    // oracle's body between gliding and casting. Keep its hood registered.
    const feet=spec.boss&&!locomotion&&!spec.glide;
    const start=feet?Math.floor(h*.8):0,end=feet?h:Math.floor(h*(spec.boss ? .2 : .25));
    if(!falling&&spec.species!==14)for(let y=start;y<end;y++)for(let x=0;x<w;x++){
      const alpha=subject.pixels[(y*w+x)*4+3];if(alpha>128){sum+=x*alpha;weight+=alpha;}
    }
    const root=weight?sum/weight:w/2;
    const safeFit=fitAtlasPoses(fit,sheet.frameWidth,sheet.frameHeight,sheet.frameHeight-sheet.groundPadding!,
      [{region:subject.region,rootX:subject.region[0]+root,rootY:subject.region[1]+h}]);
    const left=sheet.frameWidth/2-root*safeFit,top=sheet.frameHeight-sheet.groundPadding!-h*safeFit;
    const x=frame%columns*fw,y=Math.floor(frame/columns)*fh;
    ctx.save();if(mirror){ctx.translate(x+fw,y);ctx.scale(-1,1);}
    draw(ctx,spriteSubjectCanvas(subject),[0,0,w,h],(mirror?0:x)+left*sheet.density,(mirror?0:y)+top*sheet.density,w*safeFit*sheet.density,h*safeFit*sheet.density);ctx.restore();
    texture.add(frame,0,x,y,fw,fh)!.customData={fullSprite:true,isolatedSubject:true,...sources.get(subject),foreignProbes:subject.foreignProbes,sourceRegion:subject.region,sourceFit:safeFit,sourceMirrored:mirror,
      visibleBounds:{left:mirror?sheet.frameWidth-left-w*safeFit:left,top,width:w*safeFit,height:h*safeFit}};
  };
  for(const [row,sourceRow] of [0,1,1,2].entries()){
    const mirror=row===1,walk=sourceRow*(spec.boss?4:5),actions=sourceRow*6;
    const walkFit=spec.height/subjects.walk[walk].region[3];
    for(let pose=0;pose<5;pose++){
      let subject=subjects.walk[walk+(spec.boss?Math.max(0,pose-1):pose)],fit=walkFit,flipped=mirror;
      if(spec.species===13&&row===0&&pose>=3){
        // Complete down-facing root poses mirror naturally: no carried weapon
        // changes hands, and the opposite supporting root has identical scale.
        subject=subjects.walk[pose-2];flipped=true;
      }
      if(spec.species===12){
        if(row===0&&pose===2){subject=subjects.gait[0];fit=spec.height/subject.region[3];}
        if(row===0&&pose===4){subject=subjects.passing[0];fit=spec.height/subject.region[3];}
        if((row===1||row===2)&&pose===4){subject=subjects.gait[2];fit=spec.height/subject.region[3];}
      }
      drawPose(subject,fit,row*5+pose,flipped,false,spec.boss);
      yield;
    }
    const actionFit=spec.height/subjects.actions[actions+2].region[3];
    for(let pose=0;pose<6;pose++){
      // The authored rear windup alone puts Krag's axe in the opposite hand.
      // Reflect the COMPLETE pose, not separate arm/weapon/body fragments.
      const flipped=spec.species===15&&row===3&&pose===0?!mirror:mirror;
      drawPose(subjects.actions[actions+pose],actionFit,20+row*6+pose,flipped,pose>=4);
      yield;
    }
  }
  texture.refresh();texture.setFilter(Phaser.Textures.FilterMode.NEAREST);isolateAtlasFrames(texture);
  if(spec.species===12&&!scene.textures.exists('enemy_goblin_stone')){
    const stone=subjects.stone[0],[,,w,h]=stone.region,fit=24/Math.max(w,h);
    const tiny=scene.textures.createCanvas('enemy_goblin_stone',64,64)!;
    draw(tiny.getContext(),spriteSubjectCanvas(stone),[0,0,w,h],32-w*fit/2,32-h*fit/2,w*fit,h*fit);
    tiny.add(0,0,0,0,64,64);tiny.refresh();
  }
  complete=true;
  }finally{
    canvas.width=canvas.height=1;
    if(!complete&&scene.textures.exists(spec.texture))scene.textures.remove(spec.texture);
  }
}
