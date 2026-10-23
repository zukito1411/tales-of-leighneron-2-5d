import type Phaser from 'phaser';
import type {PaintContext} from './PaintCanvas';
import {CHUNK_SIZE} from '../../data/world';
import {ART_BY_KEY,type ArtTextureKey} from '../../data/art';
import {settlementAt,segmentDistance} from '../../data/settlements';
import {TOWN_BY_ID} from '../../data/towns';
import {GROUND_COVER_LIMIT} from '../../data/environmentPresentation';
import {seededRandom} from '../../utils/seededRandom';
import {spriteBounds,overlaps,type Rect} from '../../data/settlementGeometry';
import {WORLD_CONTENT} from '../../data/content';
import type {WorldGenerator} from './WorldGenerator';

export interface CoverArt {source:CanvasImageSource;sx:number;sy:number;width:number;height:number;ratio:number}
interface CoverPiece {texture:ArtTextureKey;frame:number;height:number}
const meadow:CoverPiece[]=[{texture:'flora',frame:0,height:17},{texture:'flora',frame:1,height:15},
  {texture:'flora',frame:2,height:15},{texture:'woodland_props',frame:1,height:22},{texture:'woodland_props',frame:2,height:20}];
const elvenGarden:CoverPiece[]=[{texture:'flora',frame:0,height:18},{texture:'flora',frame:1,height:17},
  {texture:'flora',frame:2,height:16},{texture:'flora',frame:3,height:15},{texture:'flora',frame:11,height:20},
  {texture:'woodland_props',frame:1,height:23},{texture:'woodland_props',frame:2,height:21},
  {texture:'woodland_props',frame:3,height:23},{texture:'woodland_props',frame:4,height:27}];
const woodland:CoverPiece[]=[{texture:'woodland_props',frame:2,height:23},{texture:'flora',frame:11,height:20},
  {texture:'woodland_props',frame:10,height:15},{texture:'flora',frame:0,height:16}];
const dry:CoverPiece[]=[{texture:'flora',frame:7,height:17},{texture:'desert_props',frame:3,height:22},
  {texture:'flora',frame:8,height:17},{texture:'desert_props',frame:5,height:12}];
const winter:CoverPiece[]=[{texture:'climate_props',frame:3,height:15},{texture:'climate_props',frame:3,height:10}];
const volcanic:CoverPiece[]=[{texture:'climate_props',frame:7,height:13},{texture:'climate_props',frame:8,height:10}];

/** Low greenery is ground art, not hundreds of additional physical bushes.
 * Cluster placement is world-cell deterministic and overdraws neighbor cells
 * into the chunk gutter so flowers cannot be cut at streamed texture seams. */
export class GroundCoverBaker {
  private readonly art=new Map<string,CoverArt>();
  private readonly roofs:Rect[]=WORLD_CONTENT.filter(d=>d.kind==='settlement-prop'||'townShrineId' in d)
    .map(d=>'frame' in d?spriteBounds(d.texture??'world_objects',d.frame,d.scale??1,d.world.x,d.world.y):{left:0,right:0,top:0,bottom:0});
  constructor(private readonly source:Phaser.Scene|ReadonlyMap<string,CoverArt>){}
  private getArt(piece:CoverPiece){
    const key=piece.texture+':'+piece.frame,existing=this.art.get(key);if(existing)return existing;
    if(!('textures' in this.source)){const art=this.source.get(key);if(art)this.art.set(key,art);return art??null;}
    const sheet=ART_BY_KEY[piece.texture],texture=this.source.textures.get(piece.texture),frame=texture.get(piece.frame);
    const visible=(frame.customData as {visibleBounds?:{left:number;top:number;width:number;height:number}}|undefined)?.visibleBounds;
    if(!visible||visible.height<=0)return null;
    const entry={source:texture.getSourceImage() as CanvasImageSource,
      sx:frame.cutX+visible.left*sheet.density,sy:frame.cutY+visible.top*sheet.density,
      width:visible.width*sheet.density,height:visible.height*sheet.density,ratio:visible.width/visible.height};
    this.art.set(key,entry);return entry;
  }
  draw(ctx:PaintContext,world:WorldGenerator,chunkX:number,chunkY:number){
    const steps=this.drawSteps(ctx,world,chunkX,chunkY);while(!steps.next().done){/* Synchronous callers only. */}
  }
  *drawSteps(ctx:PaintContext,world:WorldGenerator,chunkX:number,chunkY:number):Generator<void,void>{
    const ox=chunkX*CHUNK_SIZE,oy=chunkY*CHUNK_SIZE,step=128;
    const roofs=this.roofs.filter(r=>r.right>=ox-5&&r.left<=ox+CHUNK_SIZE+5&&r.bottom>=oy-5&&r.top<=oy+CHUNK_SIZE+5);
    let marks=0;ctx.save();ctx.imageSmoothingEnabled=true;
    try{
    for(let row=Math.floor((oy-64)/step);row<=Math.ceil((oy+CHUNK_SIZE+64)/step);row++)
      for(let col=Math.floor((ox-64)/step);col<=Math.ceil((ox+CHUNK_SIZE+64)/step);col++){
        yield;
        const rng=seededRandom(`ground-cover:${col}:${row}`),x=(col+.28+rng()*.44)*step,y=(row+.28+rng()*.44)*step;
        const terrain=world.getTerrainAt(x,y),region=world.getRegionAt(x,y);
        if(['water','lava','ice','farmland'].includes(terrain))continue;
        const layout=settlementAt(x,y),town=layout&&TOWN_BY_ID[layout.townId];
        const local=town?{x:x-town.world.x,y:y-town.world.y}:null;
        // Same street distances, without creating hundreds of temporary arrays.
         let streetEdge=Infinity;
         if(layout&&local)for(const street of layout.streets){
           for(let i=1;i<street.points.length;i++){
             const d=segmentDistance(local.x,local.y,street.points[i-1],street.points[i])-street.width/2;
             if(d<streetEdge)streetEdge=d;
           }
         }
        const greenEdge=['grass','forest','marsh'].includes(terrain);
        const softEdge=(terrain==='stone'||terrain==='dirt')&&[[48,0],[-48,0],[0,48],[0,-48]].some(([dx,dy])=>
          ['grass','forest','marsh','snow','sand','ash'].includes(world.getTerrainAt(x+dx,y+dy)));
        const masonryEdge=terrain==='stone'&&streetEdge>-9&&softEdge;
        if(terrain==='stone'&&!masonryEdge)continue;
        if(layout&&terrain==='dirt'&&!softEdge)continue; // busy working courts stay worn/clear
        if(!greenEdge&&!['snow','sand','ash','dirt'].includes(terrain)&&!masonryEdge)continue;
        const elarionGarden=layout?.townId==='elarion';
        const density=elarionGarden?(streetEdge<110?.96:.86):layout?(streetEdge<110 ? .94 : .70):terrain==='forest' ? .84 : .58;
        if(rng()>density)continue;
        const palette=elarionGarden?elvenGarden:region==='darkav'?volcanic:region==='frostlands'||region==='nardorous'?winter:
          region==='rindass'||terrain==='sand'?dry:terrain==='forest'?woodland:meadow;
        const count=elarionGarden?5+Math.floor(rng()*3):greenEdge?3+Math.floor(rng()*2):1+Math.floor(rng()*2);
        for(let i=0;i<count;i++){
          const px=x+(rng()-.5)*70,py=y+(rng()-.5)*54,piece=palette[Math.floor(rng()*palette.length)];
          const height=(masonryEdge?piece.height*.4:piece.height)*(.82+rng()*.35),art=this.getArt(piece);if(!art)continue;
          const width=height*art.ratio,bounds={left:px-width/2,right:px+width/2,top:py-height,bottom:py};
          if(bounds.right<ox||bounds.left>ox+CHUNK_SIZE||bounds.bottom<oy||bounds.top>oy+CHUNK_SIZE)continue;
          if(roofs.some(r=>overlaps(bounds,r,5)))continue;
          // Only low edge moss can encroach by a few pixels on paving. The
          // clear walking lane and cultivated rows retain their base texture.
          if([[bounds.left,bounds.top],[bounds.right,bounds.top],[px,py]].some(([tx,ty])=>{
            const t=world.getTerrainAt(tx,ty);return ['water','lava','ice','farmland'].includes(t)||
              (masonryEdge?world.isRoad(tx,ty,-10):t==='stone'||world.isRoad(tx,ty,3));
          }))continue;
          if(marks>=GROUND_COVER_LIMIT)continue;
          ctx.globalAlpha=masonryEdge ? .65 : .94;
          ctx.drawImage(art.source,art.sx,art.sy,art.width,art.height,px-width/2-ox,py-height-oy,width,height);marks++;
        }
      }
    }finally{ctx.restore();}
  }
  sources(){
    for(const piece of [...meadow,...elvenGarden,...woodland,...dry,...winter,...volcanic])this.getArt(piece);
    return this.art;
  }
  destroy(){this.art.clear();}
}
