import type Phaser from 'phaser';

// Measured source rectangles for coastal vessel art.
export const VEHICLE_ART={
  boat:{path:'assets/vehicles/coastal-boat.png',regions:[[155,8,337,615],[646,42,595,542],[18,642,590,556],[817,617,334,617]]},
} as const;

export const MOTION_ART={
  'water-foam': 'assets/vehicles/water-foam.png',
} as const;
export const BOAT_SCALE=1.25;
export const BOAT_HULL_CLEARANCE=190;
const boatHelms=[[260,460],[1150,482],[125,1100],[955,1100]];
// Independent footpoints measured on each deck, ahead of the stern helmsman.
const boatPassengers=[[337,400],[1030,460],[253,1080],[1030,1005]];
function boatDeckPoint(frame:number,points:number[][]){
  const [x,y,w,h]=VEHICLE_ART.boat.regions[frame],fit=280/617;
  return {x:(points[frame][0]-x-w/2)*fit*BOAT_SCALE,y:(points[frame][1]-y-h)*fit*BOAT_SCALE};
}
export function boatHelm(frame:number){return boatDeckPoint(frame,boatHelms);}
export function boatPassenger(frame:number){return boatDeckPoint(frame,boatPassengers);}
function cellBounds(pixels:ImageData,x:number,y:number,w:number,h:number){
  let left=x+w,top=y+h,right=x,bottom=y;
  for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++)if(pixels.data[(py*pixels.width+px)*4+3]>64){
    left=Math.min(left,px);top=Math.min(top,py);right=Math.max(right,px);bottom=Math.max(bottom,py);
  }
  if(left>right)throw new Error('An animation cell has no visible artwork.');
  return {x:left,y:top,w:right-left+1,h:bottom-top+1};
}

function prepareMotionSheet(scene:Phaser.Scene,key:string,targetHeight:number){
  const source=scene.textures.get('motion-source:'+key).getSourceImage() as HTMLImageElement;
  const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
  const sourceCtx=canvas.getContext('2d')!;sourceCtx.drawImage(source,0,0);
  const pixels=sourceCtx.getImageData(0,0,canvas.width,canvas.height);
  const cellW=Math.floor(source.width/2),cellH=Math.floor(source.height/2);
  const bounds=Array.from({length:4},(_,i)=>cellBounds(pixels,(i%2)*cellW,Math.floor(i/2)*cellH,cellW,cellH));
  const cell=256,fit=Math.min(236/Math.max(...bounds.map(b=>b.w)),targetHeight/Math.max(...bounds.map(b=>b.h)));
  const texture=scene.textures.createCanvas(key,cell*2,cell*2)!,ctx=texture.getContext();
  const top=252-Math.max(...bounds.map(b=>b.h))*fit;
  bounds.forEach((b,i)=>{
    const x=i%2*cell,y=Math.floor(i/2)*cell;
    ctx.drawImage(source,b.x,b.y,b.w,b.h,x+(cell-b.w*fit)/2,y+top,b.w*fit,b.h*fit);
    texture.add(i,0,x,y,cell,cell);
  });
  texture.refresh();scene.textures.remove('motion-source:'+key);
}

export function prepareVehicleArt(scene:Phaser.Scene){
  for(const [kind,definition] of Object.entries(VEHICLE_ART)){
    const source=scene.textures.get('vehicle-source:'+kind).getSourceImage() as HTMLImageElement;
    const texture=scene.textures.createCanvas('traffic-'+kind,768,768)!;
    const ctx=texture.getContext(),sourceScale=source.width/1254;
    const fit=280/Math.max(...definition.regions.flatMap(r=>[r[2],r[3]]));
    definition.regions.forEach(([x,y,w,h],i)=>{
      const left=(i%2)*384+(384-w*fit)/2,top=Math.floor(i/2)*384+364-h*fit;
      ctx.drawImage(source,x*sourceScale,y*sourceScale,w*sourceScale,h*sourceScale,left,top,w*fit,h*fit);
      texture.add(i,0,(i%2)*384,Math.floor(i/2)*384,384,384);
    });
    texture.refresh();scene.textures.remove('vehicle-source:'+kind);
    const rail=scene.textures.createCanvas('traffic-boat-rail',768,768)!,railCtx=rail.getContext();
    // Preserve the lower hull pass separately; rider sprites render above it.
    definition.regions.forEach(([, , ,h],i)=>{
      const row=Math.floor(i/2)*384,column=i%2*384,band=h*fit*.22;
      railCtx.drawImage(texture.getSourceImage() as HTMLCanvasElement,column,row+364-band,384,band,column,row+364-band,384,band);
      rail.add(i,0,column,row,384,384);
    });rail.refresh();
  }
  prepareMotionSheet(scene,'water-foam',176);
}
