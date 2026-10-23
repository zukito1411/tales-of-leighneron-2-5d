import {createNoise2D} from 'simplex-noise';
import {seededRandom} from '../../utils/seededRandom';
import {getGraphicEffects} from './graphicsEffects';

/** A reusable soft density field: three parallax layers imitate depth in a
 * 2D scene. This is not a 3D volumetric/ray-marched renderer. */
export class FogArt {
  get densityArtwork(){return this.cloud;}
  private readonly cloud=document.createElement('canvas');
  private readonly tint=document.createElement('canvas');
  private color='';
  constructor(){
    this.cloud.width=this.tint.width=192;this.cloud.height=this.tint.height=128;
    const ctx=this.cloud.getContext('2d')!,p=ctx.createImageData(192,128),noise=createNoise2D(seededRandom('valley-fog-volume'));
    for(let y=0;y<128;y++)for(let x=0;x<192;x++){
      const edge=Math.max(0,1-Math.pow((x-96)/96,2))*Math.max(0,1-Math.pow((y-64)/64,2));
      const density=Math.max(0,.52+noise(x*.022,y*.022)*.28+noise(x*.055,y*.055)*.12);
      const i=(y*192+x)*4;p.data[i]=p.data[i+1]=p.data[i+2]=255;p.data[i+3]=Math.round(255*density*edge*edge);
    }ctx.putImageData(p,0,0);
  }
  draw(ctx:CanvasRenderingContext2D,width:number,height:number,worldX:number,worldY:number,time:number,amount:number,color:readonly [number,number,number],night:number){
    if(amount<=.001)return;
    const css=`rgb(${color.join(',')})`;
    if(css!==this.color){this.color=css;const tint=this.tint.getContext('2d')!;tint.clearRect(0,0,192,128);tint.drawImage(this.cloud,0,0);
      tint.globalCompositeOperation='source-in';tint.fillStyle=css;tint.fillRect(0,0,192,128);tint.globalCompositeOperation='source-over';}
    ctx.save();
    for(let layer=0;layer<3;layer++){
      const size=320+layer*200,stepX=size*.7,stepY=size*.46,parallax=.22+layer*.15;
      const ox=((worldX*parallax-time*(.006+layer*.003))%stepX+stepX)%stepX;
      const oy=((worldY*parallax+time*.0015)%stepY+stepY)%stepY;
      ctx.globalAlpha=amount*(.17-layer*.025);
      for(let row=-1;row<Math.ceil(height/stepY)+2;row++){
        const y=row*stepY-oy;
        if(y>=height||y+size*2/3<=0)continue;
        for(let col=-1;col<Math.ceil(width/stepX)+2;col++){
          const x=col*stepX-ox+(row%2)*stepX*.28;
          if(x>=width||x+size<=0)continue;
          ctx.drawImage(this.tint,x,y,size,size*2/3);
        }
      }
    }
    // Faint daylight shafts belong to mist, not a glowing player spotlight.
    if(getGraphicEffects().sunRays&&night<.2&&amount>.4){ctx.globalAlpha=amount*.035;ctx.fillStyle='#fff2d0';
      for(let i=0;i<3;i++){const x=width*(.18+i*.33)+Math.sin(time*.00007+i)*50;ctx.beginPath();ctx.moveTo(x,-20);ctx.lineTo(x+30,-20);ctx.lineTo(x+190,height);ctx.lineTo(x+110,height);ctx.closePath();ctx.fill();}}
    ctx.restore();
  }
  destroy(){this.cloud.width=this.cloud.height=this.tint.width=this.tint.height=1;}
}

// LEIGHNERON_MOBILE_GRAPHICS_NPC_FIX_V1
