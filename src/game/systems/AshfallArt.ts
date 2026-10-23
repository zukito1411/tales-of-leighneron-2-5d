import {seededRandom} from '../../utils/seededRandom';

/** Small prepainted flake sprites, three depth bands and smooth edge fades.
 * Screen-sized buffers keep ash inexpensive at high device pixel ratios. */
export class AshfallArt {
  get dayArtwork(){return this.flakes;}
  get nightArtwork(){return this.nightFlakes;}
  get dayEmberArtwork(){return this.ember;}
  get nightEmberArtwork(){return this.nightEmber;}
  private readonly flakes:HTMLCanvasElement[]=[];
  private readonly nightFlakes:HTMLCanvasElement[]=[];
  private readonly ember=document.createElement('canvas');
  private readonly nightEmber=document.createElement('canvas');
  private readonly reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly points=Array.from({length:96},(_,i)=>{const r=seededRandom('darkav:ash:'+i);
    return {x:r(),y:r(),speed:.6+r(),phase:r()*Math.PI*2,variant:i%3};});
  constructor(){
    for(const [dayColor,nightColor] of [['#968582','#a3261e'],['#c0a7a0','#e04428'],['#71514a','#711b19']]){
      for(const [color,highlight,collection] of [
        [dayColor,'rgba(255,229,212,.3)',this.flakes],
        [nightColor,'rgba(255,118,65,.72)',this.nightFlakes],
      ] as const){
        const tile=document.createElement('canvas');tile.width=tile.height=16;
        const ctx=tile.getContext('2d')!;ctx.fillStyle=color;
        ctx.beginPath();ctx.moveTo(4,7);ctx.lineTo(8,4);ctx.lineTo(12,7);ctx.lineTo(11,11);ctx.lineTo(6,12);ctx.closePath();ctx.fill();
        ctx.fillStyle=highlight;ctx.fillRect(7,5,3,2);collection.push(tile);
      }
    }
    this.ember.width=this.ember.height=this.nightEmber.width=this.nightEmber.height=24;
    for(const [canvas,colors] of [[this.ember,['rgba(255,210,133,.9)','rgba(255,104,34,.6)','rgba(255,70,12,0)']],
      [this.nightEmber,['rgba(255,113,48,1)','rgba(238,35,20,.8)','rgba(150,10,8,0)']]] as const){
      const ctx=canvas.getContext('2d')!,glow=ctx.createRadialGradient(12,12,0,12,12,12);
      glow.addColorStop(0,colors[0]);glow.addColorStop(.12,colors[1]);glow.addColorStop(1,colors[2]);
      ctx.fillStyle=glow;ctx.fillRect(0,0,24,24);
    }
  }
  draw(ctx:CanvasRenderingContext2D,w:number,h:number,worldX:number,worldY:number,time:number,amount:number,night=0){
    if(amount<=.001)return;
    const t=this.reducedMotion.matches?0:time,count=Math.min(96,Math.max(48,Math.round(w*h/8500)));
    const afterDark=night>.5,flakes=afterDark?this.nightFlakes:this.flakes,ember=afterDark?this.nightEmber:this.ember;
    ctx.save();
    if(afterDark)ctx.globalCompositeOperation='lighter';
    const wrap=(value:number,size:number)=>(value%size+size)%size;
    for(let i=0;i<count;i++){
      const p=this.points[i],layer=i%3,depth=[.3,.6,1][layer],size=afterDark?[7,10,14][layer]:[4,6,9][layer];
      const x=wrap(p.x*(w+40)+t*.018*p.speed*depth+Math.sin(t*.0007+p.phase)*26-worldX*depth*.12,w+40)-20;
      const y=wrap(p.y*(h+40)+t*.034*p.speed*depth-worldY*depth*.12,h+40)-20;
      const fade=Math.max(0,Math.min(1,(x+20)/30,(w+20-x)/30,(y+20)/30,(h+20-y)/30));
      ctx.globalAlpha=amount*fade*(afterDark?[.58,.8,1][layer]:[.3,.5,.72][layer]);
      ctx.save();ctx.translate(x,y);ctx.rotate(p.phase+t*.0003*p.speed);
      ctx.drawImage(flakes[p.variant],-size/2,-size/2,size,size);ctx.restore();
      // Sparse ember motes ascend against the ash; no bright full-screen veil.
      if(i%12===0){ctx.globalAlpha=amount*fade*(afterDark?.95:.65);
        const ey=wrap(p.y*(h+40)-t*.025*p.speed,h+40)-20;
        const emberSize=afterDark?26:20;
        ctx.drawImage(ember,x-emberSize/2,ey-emberSize/2,emberSize,emberSize);}
    }
    ctx.restore();
  }
  destroy(){for(const flake of [...this.flakes,...this.nightFlakes])flake.width=flake.height=1;
    this.flakes.length=this.nightFlakes.length=0;this.ember.width=this.ember.height=this.nightEmber.width=this.nightEmber.height=1;}
}
