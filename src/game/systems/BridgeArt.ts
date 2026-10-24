import Phaser from 'phaser';
import {ART_BY_KEY,artFrameSize} from '../../data/art';
import {TIMBER_BRIDGE,type GroundPolygon} from '../../data/worldSpriteGeometry';
import {ROAD_BRIDGE_FRAME} from '../../data/bridgeDeck';

/** Split the timber posts/ropes from the straight deck without masking planks. */
export function prepareBridgeRail(scene:Phaser.Scene){
  // Spatial bridges read the original deck/post swatches directly. Cutting
  // rope masks out of that atlas also cuts holes through their deck material.
  if(scene.game.registry.get('presentation')==='three-2.5d')return;
  const sheet=ART_BY_KEY.bridges,atlas=scene.textures.get('bridges') as Phaser.Textures.CanvasTexture;
  const w=sheet.frameWidth*sheet.density,h=sheet.frameHeight*sheet.density,frame=atlas.get(ROAD_BRIDGE_FRAME);
  const metadata=(frame.customData??{}) as {visibleBounds?:{left:number;top:number};sourceRegion?:readonly number[];sourceFit?:number};
  const region=metadata.sourceRegion??sheet.regions![ROAD_BRIDGE_FRAME],fit=metadata.sourceFit??artFrameSize('bridges',ROAD_BRIDGE_FRAME).width/sheet.regions![ROAD_BRIDGE_FRAME][2];
  const visible=metadata.visibleBounds??{left:(sheet.frameWidth-region[2]*fit)/2,top:sheet.frameHeight-2-region[3]*fit};
  const source=document.createElement('canvas');source.width=w;source.height=h;
  source.getContext('2d')!.drawImage(atlas.getSourceImage() as HTMLCanvasElement,frame.cutX,frame.cutY,w,h,0,0,w,h);
  const mask=document.createElement('canvas');mask.width=w;mask.height=h;
  const frontMask=document.createElement('canvas');frontMask.width=w;frontMask.height=h;
  for(const [part,polygons] of [['front',TIMBER_BRIDGE.frontArt],['back',TIMBER_BRIDGE.backArt]] as const){
    const m=mask.getContext('2d')!;m.clearRect(0,0,w,h);m.fillStyle='#fff';
    for(const polygon of polygons as readonly GroundPolygon[]){
      m.beginPath();polygon.forEach(([x,y],i)=>{
        const px=(visible.left+(x-region[0])*fit)*sheet.density,py=(visible.top+(y-region[1])*fit)*sheet.density;
        if(i===0)m.moveTo(px,py);else m.lineTo(px,py);
      });m.closePath();m.fill();
    }
    if(part==='front')frontMask.getContext('2d')!.drawImage(mask,0,0);
    else {m.globalCompositeOperation='destination-out';m.drawImage(frontMask,0,0);m.globalCompositeOperation='source-over';}
    const texture=scene.textures.createCanvas(`bridge-${part}-rail`,w,h)!,ctx=texture.getContext();
    ctx.drawImage(source,0,0);ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,0,0);ctx.globalCompositeOperation='source-over';
    texture.refresh();texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    const base=atlas.getContext();base.globalCompositeOperation='destination-out';base.drawImage(mask,frame.cutX,frame.cutY);base.globalCompositeOperation='source-over';
  }
  atlas.refresh();source.width=source.height=mask.width=mask.height=frontMask.width=frontMask.height=1;
}
