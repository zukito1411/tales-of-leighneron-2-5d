import Phaser from 'phaser';
import { CHUNK_SIZE, TILE_SIZE } from '../../data/world';
import { WorldGenerator } from './WorldGenerator';
import { sampleTerrainGridSteps, seamlessTerrainPixels, TERRAIN_MASK_SIZE, TERRAIN_PATTERN_SIZE } from './terrainArt';
import {drawGroundReliefSteps} from './GroundRelief';
import {naturalGroundPattern} from './NaturalGroundArt';
import {GroundCoverBaker} from './GroundCoverBaker';
import {PAVING_PATTERN_SIZE} from '../../data/environmentPresentation';
import {darkavGroundPatterns,darkavGroundFrame,DARKAV_GROUND_FRAMES} from './DarkavGroundArt';
import {insideDefense} from '../../data/settlementDefenses';

export class TerrainBaker {
  private readonly patterns: CanvasPattern[] = [];
  private readonly layer = document.createElement('canvas');
  private readonly mask = document.createElement('canvas');
  private readonly cover:GroundCoverBaker;

  constructor(scene: Phaser.Scene) {
    this.cover=new GroundCoverBaker(scene);
    this.layer.width = this.layer.height = CHUNK_SIZE;
    this.mask.width = this.mask.height = TERRAIN_MASK_SIZE;
    const source = scene.textures.get('terrain').getSourceImage() as CanvasImageSource;
    const size = TERRAIN_PATTERN_SIZE;
    const swatches:HTMLCanvasElement[]=[];
    for (let frame = 0; frame < 12; frame++) {
      const tile = document.createElement('canvas');
      tile.width = tile.height = size;
      const ctx = tile.getContext('2d')!;
      ctx.drawImage(source,(frame===8||frame===10?2:frame===9?1:frame===11?7:frame) * size,0,size,size,0,0,size,size);
      const pixels = ctx.getImageData(0,0,size,size);
      pixels.data.set(seamlessTerrainPixels(pixels.data,size));
      ctx.putImageData(pixels,0,0);
      if(frame===1||frame===2)swatches[frame]=tile;
      if(frame===8){ctx.globalCompositeOperation='multiply';ctx.fillStyle='#777c89';ctx.fillRect(0,0,size,size);ctx.globalCompositeOperation='source-over';}
      if(frame===9){ctx.globalCompositeOperation='multiply';ctx.fillStyle='#687360';ctx.fillRect(0,0,size,size);ctx.globalCompositeOperation='source-over';}
      if(frame===11){ctx.fillStyle='rgba(177,215,232,.76)';ctx.fillRect(0,0,size,size);ctx.strokeStyle='rgba(228,248,255,.45)';ctx.lineWidth=1.5;
        for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(i*71,0);ctx.lineTo(i*71+19,78);ctx.lineTo(i*71-8,147);ctx.lineTo(i*71+15,256);ctx.stroke();}}
      let pattern=naturalGroundPattern(tile,frame);
      if(frame===2){pattern=document.createElement('canvas');pattern.width=pattern.height=PAVING_PATTERN_SIZE;
        pattern.getContext('2d')!.drawImage(tile,0,0,PAVING_PATTERN_SIZE,PAVING_PATTERN_SIZE);}
      this.patterns.push(this.layer.getContext('2d')!.createPattern(pattern,'repeat')!);
    }
    const volcanic=darkavGroundPatterns(scene,swatches[1],swatches[2]);
    // Retire the old generic five-line lava swatch too. All molten ground uses
    // the supplied lava-pool illustration, including the dragon's rim.
    this.patterns[10]=this.layer.getContext('2d')!.createPattern(volcanic[3],'repeat')!;
    for(const tile of volcanic)
      this.patterns.push(this.layer.getContext('2d')!.createPattern(tile,'repeat')!);
  }

  draw(ctx: CanvasRenderingContext2D, world: WorldGenerator, chunkX: number, chunkY: number) {
    const steps=this.drawSteps(ctx,world,chunkX,chunkY);
    while(!steps.next().done){ /* Required visible coverage completes atomically. */ }
  }
  /** One owner at a time: the layer/mask canvases are shared scratch buffers. */
  *drawSteps(ctx:CanvasRenderingContext2D,world:WorldGenerator,chunkX:number,chunkY:number):Generator<void,void>{
    // Pattern size need not divide CHUNK_SIZE: align paving phase in world
    // coordinates so its larger stones never reset at a streaming seam.
    const transform=new DOMMatrix().translate(-chunkX*CHUNK_SIZE,-chunkY*CHUNK_SIZE);
    for(const pattern of this.patterns)pattern.setTransform(transform);
    const grid = yield* sampleTerrainGridSteps(chunkX, chunkY, (x, y) => world.getTerrainIndex(world.getTerrainAt(x, y)));
    // Regional art is masked per cell, not chosen from a chunk's center. This
    // also recolors paved settlement courts/roads and the dragon's safe deck.
    // Only Darkav's volcanic island needs this extra terrain classification
    // pass. Expanded island bounds include the irregular edge and mask gutter.
    // Every other chunk retains its identical original sampled terrain.
    const maybeDarkav=chunkX>=94&&chunkX<=116&&chunkY>=0&&chunkY<=20;
    const painted=maybeDarkav?grid.slice():grid;
    if(maybeDarkav)for(let row=0;row<TERRAIN_MASK_SIZE;row++){
    for(let col=0;col<TERRAIN_MASK_SIZE;col++){
      const x=chunkX*CHUNK_SIZE+(col-.5)*TILE_SIZE,y=chunkY*CHUNK_SIZE+(row-.5)*TILE_SIZE;
      const i=row*TERRAIN_MASK_SIZE+col;
      if(world.getRegionAt(x,y)==='darkav')
        painted[i]=darkavGroundFrame(grid[i],insideDefense('blackspire',x,y),world.isRoad(x,y));
    }
    if(row%2===1)yield;
    }
    const layerCtx = this.layer.getContext('2d')!, maskCtx = this.mask.getContext('2d')!;
    const pixels = maskCtx.createImageData(TERRAIN_MASK_SIZE, TERRAIN_MASK_SIZE);
    ctx.fillStyle = this.patterns[0]; ctx.fillRect(0, 0, CHUNK_SIZE, CHUNK_SIZE);
    // Roads and cultivated ground sit over the natural vegetation.
    for (const frame of [4, 5, 6, 7, 8, 9, 10, 11, 2, 1, 3,...DARKAV_GROUND_FRAMES]) {
      if (!painted.includes(frame)) continue;
      for (let i = 0; i < painted.length; i++) {
        pixels.data[i * 4] = pixels.data[i * 4 + 1] = pixels.data[i * 4 + 2] = 255;
        pixels.data[i * 4 + 3] = painted[i] === frame ? 255 : 0;
      }
      maskCtx.putImageData(pixels, 0, 0);
      layerCtx.globalCompositeOperation = 'copy';
      layerCtx.fillStyle = this.patterns[frame]; layerCtx.fillRect(0, 0, CHUNK_SIZE, CHUNK_SIZE);
      layerCtx.globalCompositeOperation = 'destination-in';
      layerCtx.imageSmoothingEnabled = true;
      // Bilinear mask interpolation feathers the edge by one logical cell.
      layerCtx.imageSmoothingQuality = 'low';
      layerCtx.drawImage(this.mask, -TILE_SIZE, -TILE_SIZE, TERRAIN_MASK_SIZE * TILE_SIZE, TERRAIN_MASK_SIZE * TILE_SIZE);
      layerCtx.globalCompositeOperation = 'source-over';
      ctx.drawImage(this.layer, 0, 0);
      yield;
    }
    yield* drawGroundReliefSteps(ctx,this.mask,world,chunkX,chunkY,grid);
    yield* this.cover.drawSteps(ctx,world,chunkX,chunkY);
    yield;
  }

  drawOcean(ctx:CanvasRenderingContext2D){this.patterns[7].setTransform(new DOMMatrix());ctx.fillStyle=this.patterns[7];ctx.fillRect(0,0,CHUNK_SIZE,CHUNK_SIZE);}
  destroy() {
    this.patterns.length = 0;
    this.cover.destroy();
    this.layer.width = this.layer.height = this.mask.width = this.mask.height = 1;
  }
}
