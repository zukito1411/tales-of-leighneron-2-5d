import {BufferGeometry,Float32BufferAttribute,ShapeUtils,Vector2} from 'three';
import type Phaser from 'phaser';
import type {HomeFurnitureArt} from '../../data/housing';
import materials from './furnitureMaterials.json';

export type FurnitureArt=Exclude<HomeFurnitureArt,'rug'|'northWall'|'sideWall'>|'doorway'|'openChest'|'tower-door-closed'|'tower-door-open';
type Point=readonly [number,number,number];
type UV=readonly [number,number];
type Patch=readonly [number,number,number,number];
export interface FurnitureShape {
  art:FurnitureArt;kit:string;key:string;
  /** Visible artwork in frame UV coordinates, independent of atlas padding. */
  left:number;top:number;width:number;height:number;
  /** Model units are one visible furniture width. Origin is the front foot. */
  rise:number;depth:number;patch:Patch;
}
const depths:Record<FurnitureArt,number>={bed:1.1,wardrobe:.34,bookcase:.30,chest:.45,table:.5,bench:.32,chair:.5,
  counter:.32,hearth:.30,planter:.35,barrel:.5,pantry:.34,weaponRack:.22,lantern:.22,stairs:.85,arch:.18,
  workstation:.30,signature:.35,window:.16,doorway:.22,'tower-door-closed':.22,'tower-door-open':.22,openChest:.6};
const heights:Partial<Record<FurnitureArt,number>>={bed:.80,table:.48,bench:.40,chair:1.10,counter:.66,workstation:.66};

/** Frame dimensions are authored during the existing bounded room preparation.
 * There is no pixel scan, generated image or model cache in the render loop. */
export function furnitureShape(art:HomeFurnitureArt|'doorway'|'openChest'|'tower-door-closed'|'tower-door-open',kit:string,
  frame:Phaser.Textures.Frame,depth?:number):FurnitureShape|undefined {
  if(art==='rug'||art==='northWall'||art==='sideWall')return;
  const meta=frame.customData as {visibleWidth?:number;visibleHeight?:number;furnitureBottom?:number}|undefined;
  const w=meta?.visibleWidth??frame.cutWidth,h=meta?.visibleHeight??frame.cutHeight;
  const bottom=meta?.furnitureBottom??frame.cutHeight;
  const left=(frame.cutWidth-w)/2/frame.cutWidth,top=(bottom-h)/frame.cutHeight;
  const width=w/frame.cutWidth,height=h/frame.cutHeight,rise=heights[art]??h/w;
  const patchKey=kit+':'+(art==='openChest'?'chest':art);
  const raw=materials[patchKey as keyof typeof materials];
  const patch:Patch|undefined=raw?.length===4?[raw[0],raw[1],raw[2],raw[3]]:undefined;
  const d=Math.max(.06,depth??depths[art]);
  return {art,kit,left,top,width,height,rise,depth:d,patch:patch??[.25,.45,.32,.52],
    key:[art,kit,left,top,width,height,rise,d].join(':')};
}

/** Part-specific meshes preserve the approved painted surfaces. Seats and
 * mattresses lie horizontally; backs/doors stand vertically, and legs leave
 * open space underneath. All parts share one instanced atlas draw per style. */
export function createFurnitureGeometry(shape:FurnitureShape){
  const positions:number[]=[],uvs:number[]=[],surfaces:number[]=[],repeats:number[]=[];
  const {art,kit,rise:H,depth:D}=shape;
  const uv=(u:number,v:number):UV=>[shape.left+u*shape.width,1-shape.top-v*shape.height];
  const tri=(a:Point,b:Point,c:Point,ta:UV,tb:UV,tc:UV,patch?:Patch,painted=false)=>{
    positions.push(...a,...b,...c);uvs.push(...ta,...tb,...tc);
    const p=patch?[shape.left+patch[0]*shape.width,1-shape.top-patch[3]*shape.height,
      (patch[2]-patch[0])*shape.width*(painted?-1:1),(patch[3]-patch[1])*shape.height]:[0,0,0,0];
    surfaces.push(...p,...p,...p);
    repeats.push(...ta,...tb,...tc);
  };
  const face=(a:Point,b:Point,c:Point,d:Point,source?:Patch)=>{
    if(source){
      const [l,t,r,bottom]=source,aa=uv(l,bottom),bb=uv(r,bottom),cc=uv(l,t),dd=uv(r,t);
      tri(a,b,c,aa,bb,cc);tri(b,d,c,bb,dd,cc);
    }else{
      const p=shape.patch,rx=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])/Math.max(.01,p[2]-p[0]);
      const ry=Math.hypot(c[0]-a[0],c[1]-a[1],c[2]-a[2])/Math.max(.01,(p[3]-p[1])*shape.height/shape.width);
      tri(a,b,c,[0,0],[rx,0],[0,ry],p);tri(b,d,c,[rx,0],[rx,ry],[0,ry],p);
    }
  };
  const box=(l:number,r:number,y:number,t:number,back:number,front:number)=>{
    face([l,y,front],[r,y,front],[l,t,front],[r,t,front]);
    face([r,y,back],[l,y,back],[r,t,back],[l,t,back]);
    face([l,y,back],[l,y,front],[l,t,back],[l,t,front]);
    face([r,y,front],[r,y,back],[r,t,front],[r,t,back]);
    face([l,t,front],[r,t,front],[l,t,back],[r,t,back]);
    face([l,y,back],[r,y,back],[l,y,front],[r,y,front]);
  };
  const front=(l:number,r:number,y:number,t:number,z:number,source:Patch)=>face([l,y,z],[r,y,z],[l,t,z],[r,t,z],source);
  const top=(l:number,r:number,z:number,back:number,y:number,source:Patch)=>face([l,y,z],[r,y,z],[l,y,back],[r,y,back],source);
  const legs=(height:number,back=-D+.05,front=-.05,inset=.08)=>{
    for(const x of [-.5+inset,.5-inset])for(const z of [front,back])box(x-.035,x+.035,0,height,z-.035,z+.035);
  };
  const cabinet=()=>{
    box(-.43,.43,.04,H*.93,-D,-.01);
    // Fine hinges, books, carvings and detached trim retain their original face.
    front(-.5,.5,0,H,.003,[0,0,1,1]);
    box(-.47,.47,H*.88,H*.93,-D-.02,.015);
  };
  const cylinder=(rings:readonly (readonly [number,number])[],centre=-D/2,source?:Patch)=>{
    const segments=24;
    for(let j=1;j<rings.length;j++)for(let i=0;i<segments;i++){
      const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2,[y,r]=rings[j-1],[t,s]=rings[j];
      const aa:Point=[Math.sin(a)*r,y,centre+Math.cos(a)*r],bb:Point=[Math.sin(b)*r,y,centre+Math.cos(b)*r];
      const cc:Point=[Math.sin(a)*s,t,centre+Math.cos(a)*s],dd:Point=[Math.sin(b)*s,t,centre+Math.cos(b)*s];
      if(source){
        const paint=(angle:number,height:number):UV=>uv((source[0]+source[2])/2+Math.sin(angle)*(source[2]-source[0])*.48,
          source[3]-(height-rings[0][0])/(rings[rings.length-1][0]-rings[0][0])*(source[3]-source[1]));
        tri(aa,bb,cc,paint(a,y),paint(b,y),paint(a,t),shape.patch,true);tri(bb,dd,cc,paint(b,y),paint(b,t),paint(a,t),shape.patch,true);
      }else face(aa,bb,cc,dd);
    }
    for(const index of [0,rings.length-1]){
      const [y,r]=rings[index],center:Point=[0,y,centre];
      for(let i=0;i<segments;i++){
        const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;
        tri(center,[Math.sin(a)*r,y,centre+Math.cos(a)*r],[Math.sin(b)*r,y,centre+Math.cos(b)*r],
          uv(.5,.23),uv(.5+Math.sin(a)*.34,.23+Math.cos(a)*.15),uv(.5+Math.sin(b)*.34,.23+Math.cos(b)*.15),shape.patch,true);
      }
    }
  };
  const arch=()=>{
    const outline:UV[]=[[.03,.03],[.97,.03],[.97,1],[.79,1],[.79,.54],[.73,.37],[.61,.25],[.5,.21],
      [.39,.25],[.27,.37],[.21,.54],[.21,1],[.03,1]];
    const point=(p:UV,z:number):Point=>[p[0]-.5,(1-p[1])*H,z];
    for(let i=0;i<outline.length;i++){
      const a=outline[i],b=outline[(i+1)%outline.length];face(point(a,-D),point(b,-D),point(a,0),point(b,0));
    }
    for(const [a,b,c] of ShapeUtils.triangulateShape(outline.map(p=>new Vector2(...p)),[])){
      tri(point(outline[a],.002),point(outline[b],.002),point(outline[c],.002),uv(...outline[a]),uv(...outline[b]),uv(...outline[c]));
      tri(point(outline[c],-D),point(outline[b],-D),point(outline[a],-D),[0,0],[1,0],[0,1],shape.patch);
    }
  };
  if(art==='bed'){
    legs(H*.25,-D+.09,-.09,.11);
    box(-.46,.46,H*.17,H*.25,-D+.07,-.04);
    box(-.43,.43,H*.25,H*.42,-D+.13,-.08);
    top(-.43,.43,-.075,-D+.13,H*.424,[.12,.16,.87,.85]);
    box(-.48,.48,H*.12,H*.90,-D,-D+.08);
    front(-.5,.5,H*.49,H,-D+.083,[0,0,1,.25]);
    box(-.48,.48,H*.12,H*.38,-.07,0);
    front(-.5,.5,H*.11,H*.43,.003,[0,.81,1,1]);
  }else if(art==='table'||art==='bench'||art==='workstation'){
    legs(H*.87);
    box(-.48,.48,H*.85,H,-D,0);
    const source:Patch=art==='bench'?[.04,.10,.96,.70]:art==='workstation'?[.02,.04,.98,.69]:[.12,.10,.88,.80];
    top(-.48,.48,0,-D,H+.003,source);
    if(art==='workstation')front(-.48,.48,H*.25,H*.86,.003,[.04,.63,.96,.94]);
    box(-.40,.40,H*.31,H*.37,-D*.55,-D*.45);
  }else if(art==='counter'){
    box(-.46,.46,0,H*.80,-D,0);
    box(-.49,.49,H*.80,H*.88,-D-.02,.02);
    top(-.49,.49,.02,-D-.02,H*.883,[.03,.03,.97,.48]);
    front(-.49,.49,0,H*.80,.023,[.03,.36,.97,1]);
  }else if(art==='chair'||art==='signature'&&['highmere_noble','rindass_orcan','frostlands_longhouse'].includes(kit)){
    legs(H*.32,-D+.05,-.045,.12);
    box(-.43,.43,H*.30,H*.38,-D+.03,0);
    top(-.43,.43,0,-D+.06,H*.383,[.12,.47,.88,.81]);
    box(-.43,.43,H*.35,H*.92,-D,-D+.065);
    front(-.5,.5,H*.35,H,-D+.068,[0,0,1,.62]);
    if(art==='signature')for(const x of [-.45,.45])box(x-.045,x+.045,H*.35,H*.58,-D*.85,-D*.1);
  }else if(art==='barrel'){
    // A circular cross-section fits inside the existing foot rectangle.
    const r=Math.min(.48,D/2);
    cylinder([[0,r*.82],[H*.10,r*.94],[H*.45,r],[H*.85,r*.94],[H*.96,r*.82]],-D/2,[.15,.34,.85,.98]);
  }else if(art==='planter'){
    const r=Math.min(.31,D/2);
    cylinder([[0,r*.67],[H*.10,r*.85],[H*.34,r],[H*.39,r*1.04]],-D/2,[.15,.65,.85,.99]);
    // Foliage uses two fixed intersecting cutouts, never a camera billboard.
    front(-.5,.5,H*.28,H,-D/2,[0,0,1,.78]);
    face([0,H*.28,-D/2-.45],[0,H*.28,-D/2+.45],[0,H,-D/2-.45],[0,H,-D/2+.45],[0,0,1,.78]);
  }else if(art==='stairs'){
    for(let i=0;i<5;i++){
      const frontZ=-D*i/5,back=-D*(i+1)/5,t=H*(i+1)/5;
      box(-.43,.43,0,t,back,frontZ);
      top(-.43,.43,frontZ,back,t+.002,[.18,.22,.82,.35]);
      front(-.43,.43,t-H/5,t,frontZ+.002,[.18,.60,.82,.72]);
    }
    for(const x of [-.47,.47])box(x-.025,x+.025,0,H*.9,-D,-D+.07);
  }else if(art==='arch'||art==='doorway'||art==='tower-door-open')arch();
  else if(art==='weaponRack'){
    for(const x of [-.43,.43]){
      box(x-.045,x+.045,0,H,-D*.65,-D*.35);
      box(x-.07,x+.07,0,H*.08,-D,0);
    }
    box(-.48,.48,H*.73,H*.85,-D*.65,-D*.35);
    box(-.48,.48,H*.13,H*.20,-D*.65,-D*.35);
    front(-.5,.5,0,H,-D*.34,[0,0,1,1]);
  }else if(art==='lantern'){
    const radius=Math.min(.19,D*.48);
    cylinder([[H*.18,radius],[H*.60,radius],[H*.72,radius*.7]],-D/2,[.30,.38,.72,.97]);
    box(-.26,.26,H*.13,H*.20,-D,0);
    box(-.25,.25,H*.62,H*.69,-D,0);
    front(-.5,.5,0,H,-D/2,[0,0,1,1]);
  }else if(art==='hearth'){
    // Fireplace recess is open between jambs, with the authored fire behind it.
    box(-.48,.48,0,H*.10,-D,0);
    for(const x of [-.39,.39])box(x-.08,x+.08,H*.1,H*.65,-D,0);
    box(-.48,.48,H*.60,H*.70,-D,0);
    box(-.25,.25,H*.68,H,-D,-D*.35);
    front(-.5,.5,0,H,.003,[0,0,1,1]);
    front(-.30,.30,H*.10,H*.60,-D+.005,[.20,.40,.80,.94]);
  }else if(art==='chest'||art==='openChest'){
    box(-.46,.46,0,H*.56,-D,0);
    front(-.5,.5,0,H*.6,.003,[0,.43,1,1]);
    if(art==='openChest'){
      box(-.46,.46,H*.55,H,-D,-D+.065);
      front(-.5,.5,H*.55,H,-D+.068,[0,0,1,.48]);
      top(-.42,.42,-.03,-D+.08,H*.562,[.22,.42,.80,.69]);
    }else{
      box(-.46,.46,H*.56,H*.78,-D,0);
      top(-.46,.46,0,-D,H*.783,[.08,.06,.92,.49]);
      front(-.5,.5,H*.56,H*.80,.003,[0,.35,1,.58]);
    }
  }else if(art==='signature'&&kit==='narenthil_elven'){
    cylinder([[0,D*.46],[H*.12,D*.49],[H*.35,D*.43],[H*.45,D*.48]],-D/2,[.16,.48,.84,.98]);
    top(-D*.40,D*.40,-D*.1,-D*.9,H*.452,[.25,.40,.75,.63]);
    front(-.5,.5,H*.25,H,-D*.65,[0,0,1,.80]);
  }else if(art==='signature'&&kit==='darkav_obsidian'){
    cylinder([[0,D*.43],[H*.67,D*.37],[H*.74,D*.5]],-D/2,[.23,.41,.77,.99]);
    front(-.5,.5,H*.58,H,-D/2,[0,0,1,.51]);
    face([0,H*.58,-D/2-.35],[0,H*.58,-D/2+.35],[0,H,-D/2-.35],[0,H,-D/2+.35],[0,0,1,.51]);
  }else cabinet();
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2));
  geometry.setAttribute('surfaceRect',new Float32BufferAttribute(surfaces,4));
  geometry.setAttribute('surfaceUV',new Float32BufferAttribute(repeats,2));
  geometry.computeVertexNormals();return geometry;
}
