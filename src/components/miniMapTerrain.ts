import {WorldGenerator} from '../game/systems/WorldGenerator';
import {WORLD_HEIGHT,WORLD_WIDTH} from '../data/world';
import {GeographyWorker} from '../game/systems/GeographyWorker';
import {MINI_TERRAIN_COLORS as COLORS,type GeographyReply} from '../game/systems/GeographyProtocol';

export const MINI_TERRAIN_EXTENT=1100*8/3;
type Tile={x:number;y:number;canvas:HTMLCanvasElement};
type Job={key:string;tile:Tile;ctx:CanvasRenderingContext2D;next:number};

/** Four exact tiles, one unfinished canvas, shared worker geography. Unsupported
 * workers use short idle slices instead of a separate 2ms animation-frame job. */
export class MiniMapTerrain {
  private readonly world=new WorldGenerator();
  private readonly tiles=new Map<string,Tile>();
  private wanted:Array<{key:string;x:number;y:number}>=[];
  private job:Job|null=null;
  private frame:number|null=null;
  private idle=false;private requested=false;
  private readonly geography=new GeographyWorker(reply=>this.receiveGeography(reply));
  private disposed=false;
  constructor(private readonly onReady:()=>void=()=>{}){}

  current(x:number,y:number):Tile|undefined {
    const ox=Math.floor(x/256)*256,oy=Math.floor(y/256)*256,key=`${ox}:${oy}`;
    const dx=x-ox<128?-256:256,dy=y-oy<128?-256:256;
    this.wanted=[{key,x:ox,y:oy},{key:`${ox+dx}:${oy}`,x:ox+dx,y:oy},
      {key:`${ox}:${oy+dy}`,x:ox,y:oy+dy},{key:`${ox+dx}:${oy+dy}`,x:ox+dx,y:oy+dy}];
    if(this.job&&!this.wanted.some(p=>p.key===this.job!.key))this.discardJob();
    // A React effect must never drain all 2,304 geography samples. Prioritize
    // the requested tile, retaining a complete overlapping tile while it loads.
    if(!this.tiles.has(key)&&this.job&&this.job.key!==key)this.discardJob();
    this.schedule();
    const exact=this.tiles.get(key);if(exact)return exact;
    let nearest:Tile|undefined,distance=Infinity;
    for(const tile of this.tiles.values()){
      if(tile.x>x-1100||tile.y>y-1100||tile.x+MINI_TERRAIN_EXTENT<x+1100||tile.y+MINI_TERRAIN_EXTENT<y+1100)continue;
      const d=Math.hypot(tile.x+MINI_TERRAIN_EXTENT/2-x,tile.y+MINI_TERRAIN_EXTENT/2-y);
      if(d<distance){distance=d;nearest=tile;}
    }
    return nearest;
  }
  private start(key:string,x:number,y:number):Job|null {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d');if(!ctx)return null;
    return {key,tile:{x:x-MINI_TERRAIN_EXTENT/2,y:y-MINI_TERRAIN_EXTENT/2,canvas},ctx,next:0};
  }
  private sample(job:Job){
    const row=Math.floor(job.next/48),col=job.next%48,extent=MINI_TERRAIN_EXTENT;
    const x=job.tile.x+(col+.5)*extent/48,y=job.tile.y+(row+.5)*extent/48;
    job.ctx.fillStyle=COLORS[x<0||y<0||x>=WORLD_WIDTH||y>=WORLD_HEIGHT?'water':this.world.getTerrainAt(x,y)];
    job.ctx.fillRect(col*256/48,row*256/48,Math.ceil(256/48),Math.ceil(256/48));job.next++;
  }
  private commit(){
    const job=this.job;if(!job)return;
    this.tiles.set(job.key,job.tile);this.job=null;
    while(this.tiles.size>4){
      const key=[...this.tiles.keys()].find(key=>!this.wanted.some(p=>p.key===key));
      if(key===undefined)break;
      const tile=this.tiles.get(key)!;this.tiles.delete(key);tile.canvas.width=tile.canvas.height=1;
    }
    if(job.key===this.wanted[0]?.key)this.onReady();
  }
  private schedule(){
    if(this.disposed||!this.wanted.some(p=>!this.tiles.has(p.key)))return;
    if(this.geography.available){
      if(!this.job){const next=this.wanted.find(p=>!this.tiles.has(p.key));if(!next)return;this.job=this.start(next.key,next.x,next.y);}
      if(!this.job||this.requested)return;
      this.requested=this.geography.request({kind:'minimap',x:this.job.tile.x,y:this.job.tile.y,extent:MINI_TERRAIN_EXTENT,pixels:256});return;
    }
    if(this.frame!==null)return;
    this.idle=typeof requestIdleCallback==='function';
    this.frame=this.idle?requestIdleCallback(deadline=>this.prepare(deadline),{timeout:250}):requestAnimationFrame(()=>this.prepare());
  }
  private readonly prepare=(idle?:IdleDeadline)=>{
    this.frame=null;if(this.disposed)return;
    if(idle&&!idle.didTimeout&&idle.timeRemaining()<.5){this.schedule();return;}
    if(!this.job){
      const next=this.wanted.find(p=>!this.tiles.has(p.key));if(!next)return;
      this.job=this.start(next.key,next.x,next.y);if(!this.job)return;
    }
    const end=performance.now()+.35;
    for(let count=0;count<24&&this.job.next<48*48;count++){
      this.sample(this.job);
      if(performance.now()>=end)break;
    }
    if(this.job.next===48*48)this.commit();
    this.schedule();
  };
  private receiveGeography(reply:GeographyReply|null){
    this.requested=false;
    if(reply&&'bitmap' in reply){
      try{if(!this.disposed&&this.job){this.job.ctx.drawImage(reply.bitmap,0,0);this.commit();}}
      finally{reply.bitmap.close();}
    }
    this.schedule();
  }
  private discardJob(){this.geography.cancel();this.requested=false;if(this.job)this.job.tile.canvas.width=this.job.tile.canvas.height=1;this.job=null;}
  pause(){if(this.frame!==null){if(this.idle)cancelIdleCallback(this.frame);else cancelAnimationFrame(this.frame);}this.frame=null;this.wanted=[];this.discardJob();}
  destroy(){
    this.disposed=true;this.pause();this.geography.destroy();
    for(const tile of this.tiles.values())tile.canvas.width=tile.canvas.height=1;
    this.tiles.clear();
  }
}
