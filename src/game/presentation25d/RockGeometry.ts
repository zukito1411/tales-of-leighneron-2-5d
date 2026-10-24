import {ModelMesh,atlasMaterial,type ModelMaterial,type V3} from './ModelMesh';
import type {FurnitureShape} from './FurnitureGeometry';

/** Authored regional rock groups: broken shoulders, broad irregular crowns,
 * stepped sandstone and faceted crystals. Shared buffers, no frame-time work. */
export function createRockGeometry(shape:FurnitureShape,emission=false){
  const m=new ModelMesh(shape,emission),{art,kit,rise:H,depth:D}=shape;
  const desert=kit.includes('desert'),snow=kit.includes('climate_props:3'),volcanic=/climate_props:(7|8)$/.test(kit);
  const tile=art==='crystals'?(kit.endsWith(':2')?13:14):desert?9:snow?11:volcanic?10:8;
  const sides=atlasMaterial('nature',tile,.65,.55),crown=atlasMaterial('nature',tile===8?12:tile,.65,.55);
  const stone=(x:number,z:number,w:number,d:number,h:number,seed:number,mat:ModelMaterial=sides)=>{
    const n=art==='crystals'?5:8;
    const rings:V3[][]=[];
    for(const [row,y,scale] of [[0,0,.84],[1,.13,1],[2,art==='crystals'?.78:.80,.93],[3,1,art==='crystals'?0:.64]]){
      rings.push(Array.from({length:n},(_,i):V3=>{
        const a=i/n*Math.PI*2,irregular=1+Math.sin(i*2.61+seed)*.12;
        const yy=row===3&&art!=='crystals'?h*(.94+Math.sin(i*1.73+seed)*.055):h*y;
        return [x+Math.cos(a)*w*.5*scale*irregular,yy,z+Math.sin(a)*d*.5*scale*irregular];
      }));
    }
    for(let row=1;row<rings.length;row++)for(let i=0;i<n;i++){const j=(i+1)%n;m.quad(rings[row-1][j],rings[row-1][i],rings[row][j],rings[row][i],mat);}
    for(let i=0;i<n;i++){const j=(i+1)%n;m.triangle([x,0,z],rings[0][i],rings[0][j],mat);m.triangle([x,h*.97,z],rings[3][j],rings[3][i],crown);}
  };
  if(art==='columns'){
    for(const [x,z,height] of [[-.31,-.20,.50],[0,-.65,1],[.29,-.48,.76],[-.13,-.43,.69],[.18,-.15,.40]]){
      const mat=atlasMaterial('nature',15,.7,.8);m.cylinder(x,D*z,0,H*height,.13,.12,mat,6);
      m.cylinder(x,D*z,H*height,H*height+.008,.12,.11,mat,6);
    }
  }else if(desert&&art==='rock'){
    const shelf=kit.endsWith(':5');
    for(const [i,[x,z,w,d,h]] of (shelf?[[-.25,-.17,.42,.35,.32],[.16,-.35,.56,.43,.57],[.0,-.68,.74,.40,.78]]:
      [[-.29,-.31,.40,.46,.55],[.12,-.44,.42,.46,.78],[-.10,-.69,.44,.40,1],[.30,-.16,.33,.34,.30]]).entries())stone(x,z*D,w,d*D,h*H,i+.7);
  }else if(art==='crystals'){
    for(const [i,[x,z,w,h]] of [[0,-.65,.34,1],[-.28,-.38,.28,.66],[.27,-.48,.30,.82],[-.08,-.18,.24,.46],[.30,-.12,.21,.37]].entries())stone(x,z*D,w,D*.38,H*h,i+.4);
  }else{
    const short=kit.includes('woodland_props:8');
    for(const [i,[x,z,w,d,h]] of [[0,-.63,.49,.63,1],[-.31,-.32,.35,.46,short?.45:.57],[.31,-.37,.33,.46,short?.36:.70],[-.03,-.10,.27,.31,.24]].entries())stone(x,z*D,w,d*D,H*h,i+.35);
  }
  // Keep the approved grass, moss, fern and pebble dressing at the feet.
  // These delicate natural details retain their original cropped artwork.
  if(!emission){
    m.cutout([-.5,.003,.015],[.5,.003,.015],[-.5,.003,-D*.38],[.5,.003,-D*.38],[0,.85,1,1]);
    if(kit.includes('woodland'))m.cutout([-.21,0,.008],[.21,0,.008],[-.21,H*.36,.008],[.21,H*.36,.008],[.31,.65,.69,1]);
  }
  return m.finish();
}
