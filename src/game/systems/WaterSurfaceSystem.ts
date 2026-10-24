import Phaser from 'phaser';
import type {WorldGenerator} from './WorldGenerator';
import {overlayViewport,groundEffectViewport} from './renderSizing';
import {onGround,presentationView} from '../presentation25d/plane';
import {getGraphicEffects} from './graphicsEffects';
import {GeographyWorker} from './GeographyWorker';
import {WATER_CELL_SIZE,WATER_FIELD_SIZE,WATER_FIELD_PIXELS,WATER_FIELD_STEP,type GeographyRequest,type GeographyReply} from './GeographyProtocol';
import {WORLD_WIDTH,WORLD_HEIGHT} from '../../data/world';
import {frameWork} from '../presentation25d/FrameWorkBudget';

interface WaterCell {x:number;y:number;edges:Array<[number,number]>}
export interface WaterPresentation {mask:HTMLCanvasElement;version:number;x:number;y:number;width:number;height:number;elapsed:number;openSea:boolean;enabled:boolean}
const OVERSCAN=96;
const WATER_CACHE_LIMIT=16384;
const NEIGHBORS=[[32,0],[-32,0],[0,32],[0,-32]] as const;
/** GPU water uses a buffered, world-aligned worker mask. The exact terrain
 * predicate retains bridges, banks and ice; the canvas adapter stays supported. */
export class WaterSurfaceSystem {
  private readonly texture:Phaser.Textures.CanvasTexture;
  private readonly overlay:Phaser.GameObjects.Image;
  private readonly ocean:Phaser.GameObjects.TileSprite;
  private readonly mask=document.createElement('canvas');
  readonly presentation:WaterPresentation={mask:this.mask,version:0,x:0,y:0,width:0,height:0,elapsed:0,openSea:false,enabled:false};
  private cells:WaterCell[]=[];private elapsed=0;private drawMs=100;
  private readonly waterCells=new Map<number,boolean>();
  private firstPaint=true;
  private base={x:Infinity,y:Infinity,zoom:0,zoomY:0};
  private destroyed=false;
  private readonly geography:GeographyWorker|undefined;
  private gpuHasWater=false;private gpuRequested=false;
  private gpuJob:{request:GeographyRequest;canvas?:HTMLCanvasElement;next:number;water:boolean}|undefined;
  private readonly reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  constructor(private readonly scene:Phaser.Scene,private readonly world:WorldGenerator){
    const viewport=overlayViewport(scene);
    const gpu=scene.game.registry.get('presentation')==='three-2.5d';
    if(gpu)this.geography=new GeographyWorker(reply=>this.receiveGeography(reply));
    this.texture=scene.textures.createCanvas('moving-water',gpu?1:viewport.width+OVERSCAN*2,gpu?1:viewport.height+OVERSCAN*2)!;
    this.overlay=scene.add.image(0,0,'moving-water').setOrigin(0).setDepth(-990).setName('river-and-sea-surface');
    this.ocean=onGround(scene.add.tileSprite(0,0,1,1,'water-foam',0).setOrigin(0).setDepth(-990).setAlpha(.18).setTileScale(.7,.45).setVisible(false).setName('ocean-foam-surface'),.01);
  }
  private isWater(x:number,y:number){
    const key=x/32*1048576+y/32,cached=this.waterCells.get(key);
    if(cached!==undefined)return cached;
    const water=this.world.getGroundTerrainAt(x+16,y+16)==='water';
    if(this.waterCells.size>=WATER_CACHE_LIMIT)this.waterCells.delete(this.waterCells.keys().next().value!);
    this.waterCells.set(key,water);return water;
  }
  update(delta:number){
    // A disabled animation must not remove the new lowered water surface.
    // Keep the same worker/mask pipeline and simply freeze its animation clock.
    if(this.geography){if(getGraphicEffects().waterMotion&&!this.reducedMotion.matches)this.elapsed+=Math.min(delta,100);this.updateGpuWater();return;}
    if(!getGraphicEffects().waterMotion){this.presentation.enabled=false;this.overlay.setVisible(false);this.ocean.setVisible(false);this.base.zoom=0;this.drawMs=100;this.cancelGpuJob();return;}
    if(!this.reducedMotion.matches)this.elapsed+=Math.min(delta,100);
    this.drawMs+=delta;
    const viewport=groundEffectViewport(this.scene),z=viewport.zoom,zy=viewport.zoomY,view=viewport.view;
    const w=viewport.width+OVERSCAN*2,h=viewport.height+OVERSCAN*2;
    const openSea=Boolean(this.scene.registry.get('openSeaView'));
    const gpu=this.scene.game.registry.get('presentation')==='three-2.5d',state=this.presentation;
    state.elapsed=this.elapsed;state.openSea=openSea;state.enabled=true;
    this.ocean.setVisible(openSea);
    if(openSea){
      this.overlay.setVisible(false);
      if(gpu){this.ocean.setVisible(false);return;}
      if(this.ocean.width!==w/z||this.ocean.height!==h/zy)this.ocean.setSize(w/z,h/zy);
      this.ocean.setPosition(view.x-OVERSCAN/z,view.y-OVERSCAN/zy);
      this.ocean.tilePositionX=this.ocean.x/.7-this.elapsed*.008;this.ocean.tilePositionY=this.ocean.y/.45-this.elapsed*.003;
      const frame=Math.floor(this.elapsed/220)%4;if(this.ocean.frame.name!==String(frame))this.ocean.setFrame(frame);return;
    }
    const changed=this.base.zoom!==z||this.base.zoomY!==zy||(gpu?this.mask.width!==w||this.mask.height!==h:this.texture.width!==w||this.texture.height!==h)
      ||Math.abs((view.x-this.base.x)*z-OVERSCAN)>OVERSCAN/2||Math.abs((view.y-this.base.y)*zy-OVERSCAN)>OVERSCAN/2;
    if(gpu&&!changed){state.enabled=this.cells.length>0;this.overlay.setVisible(false);return;}
    if(!changed&&this.drawMs<50)return;
    // Water and weather each have a 50 ms repaint interval. Shift only the
    // water's *first* follow-up by one frame, so their full-screen texture
    // uploads do not repeatedly coincide. Subsequent cadence stays 50 ms.
    this.drawMs=this.firstPaint?-18:0;this.firstPaint=false;
    if(!gpu&&(this.texture.width!==w||this.texture.height!==h)){this.texture.setSize(w,h);this.mask.width=w;this.mask.height=h;}
    if(this.mask.width!==w||this.mask.height!==h){this.mask.width=w;this.mask.height=h;}
    if(changed){
      this.base={x:view.x-OVERSCAN/z,y:view.y-OVERSCAN/zy,zoom:z,zoomY:zy};this.cells=[];
      this.overlay.setPosition(this.base.x,this.base.y).setDisplaySize(w/z,h/zy);
      const ox=Math.floor(this.base.x/32)*32,oy=Math.floor(this.base.y/32)*32;
      for(let y=oy-32;y<oy+h/zy+64;y+=32)for(let x=ox-32;x<ox+w/z+64;x+=32){
        if(!this.isWater(x,y))continue;
        const edges:Array<[number,number]>=[];
        for(const [dx,dy] of NEIGHBORS)if(!this.isWater(x+dx,y+dy))edges.push([dx,dy]);
        this.cells.push({x,y,edges});
      }
      const mask=this.mask.getContext('2d')!;mask.clearRect(0,0,w,h);mask.fillStyle='#fff';
      for(const cell of this.cells)mask.fillRect((cell.x-this.base.x)*z,(cell.y-this.base.y)*zy,32*z+.5,32*zy+.5);
      state.x=this.base.x;state.y=this.base.y;state.width=w/z;state.height=h/zy;state.version++;
    }
    if(gpu){state.enabled=this.cells.length>0;this.overlay.setVisible(false);return;}
    this.overlay.setVisible(this.cells.length>0);if(!this.cells.length)return;
    const ctx=this.texture.getContext();ctx.clearRect(0,0,w,h);
    // Resolve four atlas frames per repaint rather than querying the texture
    // registry for every individual foam and riverbank particle.
    const foamFrames=[0,1,2,3].map(i=>this.scene.textures.getFrame('water-foam',i)!);
    const frameIndex=Math.floor(this.elapsed/220);
    // Animate painted foam frames rather than drawing geometric wave strokes.
    const paint=(x:number,y:number,width:number,height:number,phase:number,rotation=0,alpha=.18)=>{
      const frame=foamFrames[(frameIndex+phase)%4];
      ctx.save();ctx.globalAlpha=alpha;ctx.translate((x-this.base.x)*z,(y-this.base.y)*zy);ctx.scale(z,zy);ctx.rotate(rotation);
      ctx.drawImage(frame.source.image as CanvasImageSource,frame.cutX,frame.cutY,frame.cutWidth,frame.cutHeight,-width/2,-height/2,width,height);ctx.restore();
    };
    const flowX=(this.elapsed*.006)%240,flowY=(this.elapsed*.003)%144;
    for(let y=Math.floor(this.base.y/144)*144-144;y<this.base.y+h/zy+144;y+=144)
      for(let x=Math.floor(this.base.x/240)*240-240;x<this.base.x+w/z+240;x+=240)
        paint(x+flowX,y+flowY,180,90,Math.abs(Math.round(x/240+y/144))%4);
    for(const cell of this.cells){
      const phase=Math.abs(Math.round(cell.x/32+cell.y/32))%4;
      for(const [dx,dy] of cell.edges){
        paint(cell.x+16+dx*.34,cell.y+16+dy*.34,38,24,phase,Math.atan2(dy,dx)+Math.PI/2,.24);
      }
    }
    ctx.globalCompositeOperation='destination-in';ctx.drawImage(this.mask,0,0);ctx.globalCompositeOperation='source-over';this.texture.refresh();
  }
  private updateGpuWater(){
    const state=this.presentation,openSea=Boolean(this.scene.registry.get('openSeaView'));
    state.elapsed=this.elapsed;state.openSea=openSea;state.enabled=openSea||this.gpuHasWater;
    this.overlay.setVisible(false);this.ocean.setVisible(false);
    if(openSea){this.cancelGpuJob();return;}
    const focus=presentationView(this.scene)?.focusGround??this.scene.cameras.main.midPoint;
    const covers=(request:{x:number;y:number;extent:number})=>Math.abs(focus.x-request.x-request.extent/2)<=WATER_FIELD_STEP
      &&Math.abs(focus.y-request.y-request.extent/2)<=WATER_FIELD_STEP;
    if(this.gpuJob&&!covers(this.gpuJob.request))this.cancelGpuJob();
    if(!this.gpuJob&&(state.width===0||!covers({x:state.x,y:state.y,extent:state.width}))){
      const x=Math.round(focus.x/WATER_FIELD_STEP)*WATER_FIELD_STEP-WATER_FIELD_SIZE/2;
      const y=Math.round(focus.y/WATER_FIELD_STEP)*WATER_FIELD_STEP-WATER_FIELD_SIZE/2;
      this.gpuJob={request:{kind:'water',x,y,extent:WATER_FIELD_SIZE,pixels:WATER_FIELD_PIXELS},next:0,water:false};
    }
    const job=this.gpuJob;if(!job)return;
    if(this.geography?.available){
      if(!this.gpuRequested)this.gpuRequested=this.geography.request(job.request);
      return;
    }
    // Unsupported workers retain exact 32-unit shoreline cells, but never
    // scan the entire moving viewport in one frame. Keep the old complete mask.
    const work=frameWork(this.scene.game),allowance=work.remaining('geography',.3);if(allowance<=0)return;
    const start=performance.now();
    job.canvas??=Object.assign(document.createElement('canvas'),{width:WATER_FIELD_PIXELS,height:WATER_FIELD_PIXELS});
    const ctx=job.canvas.getContext('2d')!;ctx.fillStyle='#fff';
    const count=WATER_FIELD_SIZE/WATER_CELL_SIZE,pixel=WATER_FIELD_PIXELS/count;
    do{
      const col=job.next%count,row=Math.floor(job.next/count);
      const x=job.request.x+(col+.5)*WATER_CELL_SIZE,y=job.request.y+(row+.5)*WATER_CELL_SIZE;
      if(x<0||y<0||x>=WORLD_WIDTH||y>=WORLD_HEIGHT||this.world.getGroundTerrainAt(x,y)==='water'){
        ctx.fillRect(col*pixel,row*pixel,pixel,pixel);job.water=true;
      }
      job.next++;
    }while(job.next<count**2&&performance.now()-start<allowance);
    if(job.next===count**2){this.publishGpuMask(job.canvas,job.request,job.water);this.cancelGpuJob();}
    work.charge('geography',start);
  }
  private receiveGeography(reply:GeographyReply|null){
    this.gpuRequested=false;
    if(!reply)return; // The next update resumes the bounded fallback.
    if('error' in reply)return;
    try{if(!this.destroyed&&this.gpuJob)this.publishGpuMask(reply.bitmap,this.gpuJob.request,reply.hasWater);}
    finally{reply.bitmap.close();this.cancelGpuJob();}
  }
  private publishGpuMask(image:CanvasImageSource,request:GeographyRequest,water:boolean){
    if(this.mask.width!==request.pixels)this.mask.width=this.mask.height=request.pixels;
    const ctx=this.mask.getContext('2d')!;ctx.clearRect(0,0,request.pixels,request.pixels);ctx.drawImage(image,0,0);
    Object.assign(this.presentation,{x:request.x,y:request.y,width:request.extent,height:request.extent,enabled:water});
    this.gpuHasWater=water;this.presentation.version++;
  }
  private cancelGpuJob(){
    if(!this.gpuJob)return;
    this.geography?.cancel();if(this.gpuJob.canvas)this.gpuJob.canvas.width=this.gpuJob.canvas.height=1;
    this.gpuJob=undefined;this.gpuRequested=false;
  }
  destroy(){if(this.destroyed)return;this.destroyed=true;this.cancelGpuJob();this.geography?.destroy();this.overlay.destroy();this.ocean.destroy();this.scene.textures.remove('moving-water');this.mask.width=this.mask.height=1;this.cells=[];this.waterCells.clear();}
}

// LEIGHNERON_MOBILE_GRAPHICS_NPC_FIX_V1
