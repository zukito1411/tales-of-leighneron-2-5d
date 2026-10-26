import type Phaser from 'phaser';
import {portDeckRects} from '../../data/ports';
import type {FurnitureShape} from './FurnitureGeometry';
import {ModelMesh,atlasMaterial,type V3} from './ModelMesh';
import {BRIDGE_DECK_HEIGHT} from './WalkSurface';

const MODEL_WIDTH=200;
/** Quay coordinates are authoritative; trimming the old painting cannot move
 * the planks away from their collision/boarding survey. Shared finite prefabs. */
export function dockShape(actor:Phaser.GameObjects.Image|Phaser.GameObjects.Sprite,river:boolean):FurnitureShape {
  return {art:'dock',kit:river?'river-quay':'coastal-pier',key:river?'dock:river':'dock:coast',left:0,top:0,
    width:MODEL_WIDTH/Math.max(1,Math.abs(actor.displayWidth)),height:1,rise:.4,depth:1.5,
    patch:[.3,.4,.4,.5],fixedGround:BRIDGE_DECK_HEIGHT,
    bounds:{left:-.56,right:.56,bottom:-.4,top:.45,back:-.2,front:river?.2:1.44}};
}
export function createDockGeometry(shape:FurnitureShape,emission=false){
  const m=new ModelMesh(shape,emission),river=shape.kit==='river-quay',scale=MODEL_WIDTH;
  const wood=atlasMaterial('architecture',1,.14,.38),planks=atlasMaterial('architecture',13,.35,.20);
  const rope=atlasMaterial('furnishings',0,.09,.025),iron=atlasMaterial('furnishings',3,.08,.08);
  const p=(x:number,h:number,z:number):V3=>[x/scale,h/scale,z/scale];
  const box=(l:number,r:number,b:number,t:number,back:number,front:number,mat=wood)=>m.box(l/scale,r/scale,b/scale,t/scale,back/scale,front/scale,mat);
  for(const r of portDeckRects(river)){
    // A closed slab retains visible ends/undersides. Its top is exactly the
    // gameplay deck height; neighboring slabs meet without coplanar overlap.
    box(r.left,r.right,-7,0,r.back,r.front,planks);
    for(const x of [r.left+5,r.right-5])box(x-3,x+3,-15,-7,r.back,r.front);
    for(let z=r.back+8;z<r.front;z+=42)box(r.left+1,r.right-1,-12,-7,z-3,z+3);
  }
  const posts:readonly (readonly [number,number])[]=river?[[-79,-31],[-79,31],[0,-31],[0,31],[79,-31],[79,31]]:
    [[-28,0],[28,0],[-28,80],[28,80],[-28,160],[28,160],[-28,240],[28,240],[-103,241],[103,241],[-103,280],[103,280]];
  for(const [x,z] of posts){
    m.cylinder(x/scale,z/scale,-.40,.16,.023,.021,wood,10);
    m.cylinder(x/scale,z/scale,.16,.175,.026,.026,planks,10);
    for(const h of [.07,.10])m.ring(x/scale,z/scale,h,h+.014,.026,.022,rope,10);
    // Diagonal bracing belongs below the walking deck, never across its path.
    m.beam(p(x,-54,z),p(x>0?x-17:x+17,-10,z+15),.014,wood,6);
    m.ring(x/scale,z/scale,.025,.04,.027,.023,iron,10);
  }
  const rail=(a:readonly [number,number],b:readonly [number,number])=>{
    const span=Math.hypot(b[0]-a[0],b[1]-a[1]),segments=Math.max(2,Math.ceil(span/18));
    for(let i=0;i<segments;i++){
      const point=(t:number):V3=>p(a[0]+(b[0]-a[0])*t,27-Math.sin(t*Math.PI)*5,a[1]+(b[1]-a[1])*t);
      m.beam(point(i/segments),point((i+1)/segments),.006,rope,6);
    }
  };
  if(river){for(const z of [-31,31]){rail([-79,z],[0,z]);rail([0,z],[79,z]);}}
  else {
    for(const x of [-28,28])for(let z=0;z<240;z+=80)rail([x,z],[x,z+80]);
    for(const x of [-103,103])rail([x,241],[x,280]);
    // Mooring cleats stay on the outer edge; the boat-facing apron stays open.
    for(const x of [-72,72]){box(x-4,x+4,0,5,267,275,iron);m.beam(p(x-9,7,271),p(x+9,7,271),.012,iron,6);}
  }
  return m.finish();
}
