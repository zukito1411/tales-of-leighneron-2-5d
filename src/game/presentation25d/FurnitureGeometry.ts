import {BufferGeometry,Float32BufferAttribute,ShapeUtils,Vector2} from 'three';
import type Phaser from 'phaser';
import type {HomeFurnitureArt} from '../../data/housing';
import {HERO_BODY_HEIGHT} from '../../data/heroBodyRegistration';
import materials from './furnitureMaterials.json';

export type PropArt='crate'|'cargo'|'barrels'|'fence'|'sign'|'lampPost'|'brazier'|'well'|'fountain'|'stall'|'tent'|'wagon'|'rock'|'columns'|'crystals'|'waystone'|'lectern'|'sack'|'pump'|'banner'|'shrine'|'dummy'|'keepsake'|'ship'|'ship-stern'|'ship-mast'|'ship-pennant';
export type FurnitureArt=Exclude<HomeFurnitureArt,'rug'|'northWall'|'sideWall'>|'doorway'|'openChest'|'tower-door-closed'|'tower-door-open'|PropArt;
type Point=readonly [number,number,number];
type UV=readonly [number,number];
type Patch=readonly [number,number,number,number];
export interface FurnitureShape {
  art:FurnitureArt;kit:string;key:string;
  /** Visible artwork in frame UV coordinates, independent of atlas padding. */
  left:number;top:number;width:number;height:number;
  /** Model units are one visible furniture width. Origin is the front foot. */
  rise:number;depth:number;patch:Patch;
  footX?:number;footY?:number;heading?:number;modelScale?:number;lift?:number;quarterTurnUV?:boolean;
  paintOffset?:number;ornamentX?:number;
  fixedGround?:number;
  bounds?:{left:number;right:number;bottom:number;top:number;back:number;front:number};
}
export interface FurniturePlacement {x:number;y:number;width:number;heading:number;lift:number}
export function furniturePlacement(owner:Pick<Phaser.GameObjects.Image,'x'|'y'|'rotation'|'displayWidth'>,shape:FurnitureShape,out:FurniturePlacement){
  const width=Math.abs(owner.displayWidth)*shape.width*(shape.modelScale??1),a=owner.rotation,c=Math.cos(a),s=Math.sin(a);
  const x=(shape.footX??0)*width,y=(shape.footY??0)*width;
  out.x=owner.x+x*c-y*s;out.y=owner.y+x*s+y*c;out.width=width;out.heading=a+(shape.heading??0);out.lift=(shape.lift??0)*width;return out;
}
const depths:Partial<Record<FurnitureArt,number>>={bed:1.1,wardrobe:.34,bookcase:.30,chest:.45,table:.5,bench:.32,chair:.5,
  counter:.32,hearth:.30,planter:.35,barrel:.5,pantry:.34,weaponRack:.22,lantern:.22,stairs:.85,arch:.18,
  workstation:.30,signature:.35,window:.16,doorway:.22,'tower-door-closed':.22,'tower-door-open':.22,openChest:.6};
// Human-scale elevations, independent of a room's authored furniture width.
// Counter paint sits at .883 of the mesh envelope; chair seats at .383 and
// mattresses at .424. Keep those surfaces in proportion to the standing body.
const bodyHeights:Partial<Record<FurnitureArt,number>>={
  bed:.72,table:.44,bench:.27,chair:.72,counter:.58/.883,workstation:.48,
};

/** Frame dimensions are authored during the existing bounded room preparation.
 * There is no pixel scan, generated image or model cache in the render loop. */
export function furnitureShape(art:HomeFurnitureArt|'doorway'|'openChest'|'tower-door-closed'|'tower-door-open',kit:string,
  frame:Phaser.Textures.Frame,displayWidth:number,depth?:number):FurnitureShape|undefined {
  if(art==='rug'||art==='northWall'||art==='sideWall')return;
  const meta=frame.customData as {visibleWidth?:number;visibleHeight?:number;furnitureBottom?:number}|undefined;
  const w=meta?.visibleWidth??frame.cutWidth,h=meta?.visibleHeight??frame.cutHeight;
  const bottom=meta?.furnitureBottom??frame.cutHeight;
  const left=(frame.cutWidth-w)/2/frame.cutWidth,top=(bottom-h)/frame.cutHeight;
  const width=w/frame.cutWidth,height=h/frame.cutHeight;
  const bodyHeight=bodyHeights[art];
  const rise=bodyHeight===undefined?h/w:HERO_BODY_HEIGHT*bodyHeight/Math.max(.001,Math.abs(displayWidth)*width);
  const patchKey=kit+':'+(art==='openChest'?'chest':art);
  const raw=materials[patchKey as keyof typeof materials];
  const patch:Patch|undefined=raw?.length===4?[raw[0],raw[1],raw[2],raw[3]]:undefined;
  const d=Math.max(.06,depth??depths[art]??.3);
  return {art,kit,left,top,width,height,rise,depth:d,patch:patch??[.25,.45,.32,.52],
    key:[art,kit,left,top,width,height,rise,d].join(':')};
}

/** Part-specific meshes preserve the approved painted surfaces. Seats and
 * mattresses lie horizontally; backs/doors stand vertically, and legs leave
 * open space underneath. All parts share one instanced atlas draw per style. */
export function createFurnitureGeometry(shape:FurnitureShape,emission=false){
  const positions:number[]=[],uvs:number[]=[],surfaces:number[]=[],repeats:number[]=[];
  const {art,kit,rise:H,depth:D}=shape;
  const uv=(u:number,v:number):UV=>shape.quarterTurnUV?[shape.left+(1-v)*shape.width,1-shape.top-u*shape.height]:[shape.left+u*shape.width,1-shape.top-v*shape.height];
  const tri=(a:Point,b:Point,c:Point,ta:UV,tb:UV,tc:UV,patch?:Patch,painted=false)=>{
    if(emission&&patch&&!painted)return;
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
  const front=(l:number,r:number,y:number,t:number,z:number,source:Patch)=>{
    const offset=source[0]===0&&source[2]===1?(shape.paintOffset??0):0;
    face([l+offset,y,z],[r+offset,y,z],[l+offset,t,z],[r+offset,t,z],source);
  };
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
  const cylinder=(rings:readonly (readonly [number,number])[],centre=-D/2,source?:Patch,cx=0)=>{
    const segments=24;
    for(let j=1;j<rings.length;j++)for(let i=0;i<segments;i++){
      const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2,[y,r]=rings[j-1],[t,s]=rings[j];
      const aa:Point=[cx+Math.sin(a)*r,y,centre+Math.cos(a)*r],bb:Point=[cx+Math.sin(b)*r,y,centre+Math.cos(b)*r];
      const cc:Point=[cx+Math.sin(a)*s,t,centre+Math.cos(a)*s],dd:Point=[cx+Math.sin(b)*s,t,centre+Math.cos(b)*s];
      if(source){
        const paint=(angle:number,height:number):UV=>uv((source[0]+source[2])/2+Math.sin(angle)*(source[2]-source[0])*.48,
          source[3]-(height-rings[0][0])/(rings[rings.length-1][0]-rings[0][0])*(source[3]-source[1]));
        tri(aa,bb,cc,paint(a,y),paint(b,y),paint(a,t),shape.patch,true);tri(bb,dd,cc,paint(b,y),paint(b,t),paint(a,t),shape.patch,true);
      }else face(aa,bb,cc,dd);
    }
    for(const index of [0,rings.length-1]){
      const [y,r]=rings[index],center:Point=[cx,y,centre];
      for(let i=0;i<segments;i++){
        const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;
        tri(center,[cx+Math.sin(a)*r,y,centre+Math.cos(a)*r],[cx+Math.sin(b)*r,y,centre+Math.cos(b)*r],
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
  const slopingRoof=(peak:number,eave:number,source:Patch)=>{
    face([-.52,eave,.02],[0,peak,.02],[-.52,eave,-D-.02],[0,peak,-D-.02],source);
    face([0,peak,.02],[.52,eave,.02],[0,peak,-D-.02],[.52,eave,-D-.02],source);
  };
  const pole=(x:number,z:number,t:number,r=.04)=>box(x-r,x+r,0,t,z-r,z+r);
  const crate=(l:number,r:number,y:number,t:number,back:number,z:number,source:Patch)=>{
    box(l,r,y,t,back,z);front(l,r,y,t,z+.003,source);top(l,r,z,back,t+.003,[.12,.07,.88,.34]);
    const trim=(r-l)*.045;
    for(const x of [l,r-trim])box(x,x+trim,y,t,back-.003,z+.005);
    box(l,r,y,y+trim,back,z+.006);box(l,r,t-trim,t,back,z+.006);
  };
  if(art==='ship'){
    const hull:UV[]=[[414,172],[490,228],[546,354],[615,510],[677,705],[690,1030],[650,1300],
      [574,1438],[414,1514],[255,1440],[167,1296],[126,1090],[129,825],[171,553],[259,314],[351,199]];
    const p=(v:UV,h:number):Point=>[(v[0]-512)/1024,h/1024,(v[1]-768)/1024];
    // Original overhead deck and gangplank retain every surveyed XY coordinate.
    face([-.5,.002,.75],[.5,.002,.75],[-.5,.002,-.75],[.5,.002,-.75],[0,0,1,1]);
    for(let i=0;i<hull.length;i++){
      const a=hull[i],b=hull[(i+1)%hull.length];
      const keel=(v:UV):Point=>[(v[0]-414)*.62/1024+(414-512)/1024,-.10,(v[1]-768)/1024];
      face(keel(a),keel(b),p(a,0),p(b,0));
      // Narrow solid bulwarks follow the hull without filling the boarding gap.
      if(!(a[0]>630&&b[0]>630&&Math.min(a[1],b[1])<850&&Math.max(a[1],b[1])>740)){
        const aa=p(a,0),bb=p(b,0),dx=bb[0]-aa[0],dz=bb[2]-aa[2],len=Math.hypot(dx,dz)||1,nx=-dz/len*.007,nz=dx/len*.007;
        face(aa,bb,[aa[0],.035,aa[2]],[bb[0],.035,bb[2]]);
        face([aa[0]+nx,0,aa[2]+nz],[bb[0]+nx,0,bb[2]+nz],[aa[0]+nx,.035,aa[2]+nz],[bb[0]+nx,.035,bb[2]+nz]);
        face([aa[0],.035,aa[2]],[bb[0],.035,bb[2]],[aa[0]+nx,.035,aa[2]+nz],[bb[0]+nx,.035,bb[2]+nz]);
      }
    }
    for(const [x,y] of [[210,900],[650,900],[240,700],[625,700],[300,480],[560,480],[385,265]]){
      const v=p([x,y],0);pole(v[0],v[2],.065,.009);
    }
    box((590-512)/1024,(1000-512)/1024,-.018,.002,(780-768)/1024,(834-768)/1024);
  }else if(art==='ship-stern'){
    box(-.43,.43,0,H*.80,-D,0);
    front(-.5,.5,0,H,.003,[0,.38,1,.94]);
    top(-.5,.5,0,-D,H+.003,[0,0,1,.44]);
    for(const x of [-.46,.46])box(x-.025,x+.025,0,H*1.05,-D,.02);
  }else if(art==='ship-mast'){
    cylinder([[0,.09],[H*.07,.09],[H*.08,.045],[H*.97,.035],[H,.025]],-D/2,[.45,0,.55,1]);
    front(-.5,.5,0,H,-D/2+.004,[0,0,1,1]);
  }else if(art==='ship-pennant'){
    front(-.5,.5,0,H,0,[0,0,1,1]);
  }else if(art==='crate'||art==='cargo'){
    if(art==='crate')crate(-.47,.47,0,H,-D,0,[.04,.20,.96,.98]);
    else{
      crate(-.48,-.02,0,H*.57,-D*.58,0,[0,.45,.48,.98]);
      crate(.0,.47,0,H*.57,-D*.83,-D*.25,[.48,.45,1,.98]);
      crate(-.18,.30,H*.57,H,-D,-D*.33,[.15,.03,.78,.53]);
    }
  }else if(art==='barrels'){
    const radius=Math.min(.22,D*.28);
    for(const [x,z,y,t] of [[-.24,-D*.3,0,H*.55],[.24,-D*.3,0,H*.55],[0,-D*.65,H*.45,H]])
      cylinder([[y,radius*.8],[y+(t-y)*.2,radius],[t-(t-y)*.2,radius],[t,radius*.8]],z,[.13,.2,.87,.97],x);
  }else if(art==='fence'){
    const count=Math.max(2,Math.min(5,Math.round(1/Math.max(.16,H))));
    for(let i=0;i<count;i++)pole(-.45+i*.9/(count-1),-D/2,H,.028);
    for(const t of [.28,.67])box(-.48,.48,H*t,H*(t+.09),-D*.8,-D*.2);
    front(-.5,.5,0,H,.002,[0,0,1,1]);
  }else if(art==='sign'||art==='banner'||art==='lectern'||art==='dummy'){
    pole(0,-D/2,H*.92,.055);box(-.22,.22,0,H*.08,-D,0);
    if(art==='lectern'){
      face([-.48,H*.53,0],[.48,H*.53,0],[-.48,H*.9,-D],[.48,H*.9,-D],[0,0,1,.68]);
    }else{
      if(art==='sign'||art==='banner')box(-.45,.45,H*.65,H*.73,-D*.65,-D*.35);
      front(-.5,.5,H*.13,H,-D*.30,[0,0,1,.88]);
    }
  }else if(art==='lampPost'||art==='brazier'||art==='pump'){
    cylinder([[0,Math.min(.22,D/2)],[H*.12,Math.min(.22,D/2)],[H*.13,.065],[H*.68,.065]],-D/2);
    if(art==='brazier')cylinder([[H*.43,.12],[H*.50,.23],[H*.56,.24]],-D/2,[.15,.35,.85,.78]);
    else if(art==='lampPost'){
      const x=shape.ornamentX??.25;
      box(Math.min(-.06,x-.05),Math.max(.06,x+.05),H*.83,H*.89,-D*.7,-D*.3);
      box(x-.09,x+.09,H*.38,H*.70,-D*.9,-D*.1);
    }
    front(-.5,.5,0,H,-D*.12,[0,0,1,1]);
  }else if(art==='well'||art==='fountain'){
    const r=Math.min(.46,D/2),segments=24,inner=r*.72,water=H*(art==='well'?.22:.18);
    // Annular masonry with an actual hollow centre rather than a capped drum.
    for(let i=0;i<segments;i++){
      const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;
      const p=(angle:number,radius:number,y:number):Point=>[Math.sin(angle)*radius,y,-D/2+Math.cos(angle)*radius];
      face(p(a,r,0),p(b,r,0),p(a,r,H*.34),p(b,r,H*.34));
      face(p(b,inner,water),p(a,inner,water),p(b,inner,H*.34),p(a,inner,H*.34));
      face(p(a,r,H*.34),p(b,r,H*.34),p(a,inner,H*.34),p(b,inner,H*.34));
    }
    top(-inner,inner,-D/2+inner,-D/2-inner,water,[.22,.40,.78,.65]);
    if(art==='well'){
      for(const x of [-r*.85,r*.85])pole(x,-D/2,H*.78,.035);
      slopingRoof(H,H*.76,[.04,.01,.96,.37]);
    }else front(-.5,.5,H*.25,H,-D*.70,[0,0,1,.75]);
    front(-.5,.5,0,H,-D*.1,[0,0,1,1]);
  }else if(art==='stall'||art==='tent'){
    for(const x of [-.44,.44])for(const z of [-D+.04,-.04])pole(x,z,H*.78,.025);
    slopingRoof(H,H*.72,[.04,.03,.96,.36]);
    if(art==='stall'){
      box(-.43,.43,0,H*.32,-D*.65,-.04);top(-.46,.46,-.03,-D*.7,H*.325,[.03,.46,.97,.75]);
      front(-.5,.5,0,H*.70,.003,[0,.32,1,1]);
    }else{
      face([-.46,0,0],[-.46,0,-D],[-.46,H*.72,0],[-.46,H*.72,-D],[0,.2,.28,.95]);
      face([.46,0,-D],[.46,0,0],[.46,H*.72,-D],[.46,H*.72,0],[.72,.2,1,.95]);
      front(-.5,-.23,0,H*.74,.003,[0,.18,.27,1]);front(.23,.5,0,H*.74,.003,[.73,.18,1,1]);
      front(-.5,.5,H*.65,H,.003,[0,0,1,.36]);
    }
  }else if(art==='wagon'){
    box(-.45,.45,H*.20,H*.30,-D*.80,-.05);
    for(const x of [-.44,.44])box(x-.03,x+.03,H*.25,H*.72,-D*.80,-.05);
    box(-.45,.45,H*.25,H*.72,-D*.82,-D*.75);
    // Fixed complete side paintings retain the wheel spokes and cargo detail.
    front(-.5,.5,0,H,.003,[0,0,1,1]);front(.5,-.5,0,H,-D,[0,0,1,1]);
    for(const x of [-.30,.30])box(x-.025,x+.025,H*.19,H*.24,-D*1.1,0);
  }else if(art==='rock'||art==='columns'||art==='crystals'||art==='waystone'||art==='shrine'){
    const count=art==='columns'||art==='crystals'?5:art==='rock'?3:1;
    for(let j=0;j<count;j++){
      const cx=count===1?0:(j%3-1)*.27,cz=-D/2+(j%2-.5)*D*.36;
      const r=count===1?.34:.20,t=H*(j===1||count===1?1:.48+j*.06),sides=art==='crystals'?5:7;
      for(let i=0;i<sides;i++){
        const a=i/sides*Math.PI*2,b=(i+1)/sides*Math.PI*2;
        const aa:Point=[cx+Math.sin(a)*r,0,cz+Math.cos(a)*Math.min(r,D*.4)],bb:Point=[cx+Math.sin(b)*r,0,cz+Math.cos(b)*Math.min(r,D*.4)];
        const cc:Point=[cx+Math.sin(a)*r*.74,t*.8,cz+Math.cos(a)*Math.min(r,D*.4)*.74],dd:Point=[cx+Math.sin(b)*r*.74,t*.8,cz+Math.cos(b)*Math.min(r,D*.4)*.74];
        face(aa,bb,cc,dd);tri(cc,dd,[cx,t,cz],uv(.3,.2),uv(.7,.2),uv(.5,0),shape.patch,true);
      }
    }
    front(-.5,.5,0,H,.004,[0,0,1,1]);
  }else if(art==='sack'){
    cylinder([[0,D*.30],[H*.15,D*.48],[H*.60,D*.44],[H*.82,D*.28],[H,D*.12]],-D/2,[.15,.1,.85,.98]);
  }else if(art==='keepsake'){
    box(-.45,.45,0,H,-D,0);top(-.5,.5,0,-D,H+.002,[0,0,1,1]);
  }else if(art==='bed'){
    legs(H*.25,-D+.09,-.09,.11);
    box(-.46,.46,H*.17,H*.25,-D+.07,-.04);
    box(-.43,.43,H*.25,H*.42,-D+.13,-.08);
    top(-.43,.43,-.075,-D+.13,H*.424,[.12,.16,.87,.85]);
    box(-.48,.48,H*.12,H*.90,-D,-D+.08);
    front(-.5,.5,H*.49,H,-D+.083,[0,0,1,.25]);
    box(-.48,.48,H*.12,H*.38,-.07,0);
    front(-.5,.5,H*.11,H*.43,.003,[0,.81,1,1]);
  }else if(art==='table'||art==='bench'||art==='workstation'){
    const backrest=art==='bench'&&kit.startsWith('world:'),seat=backrest?H*.48:H;
    legs(seat*.87);
    box(-.48,.48,seat*.85,seat,-D,0);
    const source:Patch=art==='bench'?[.04,.10,.96,.70]:art==='workstation'?[.02,.04,.98,.69]:[.12,.10,.88,.80];
    top(-.48,.48,0,-D,seat+.003,backrest?[.04,.40,.96,.73]:source);
    if(backrest){box(-.46,.46,H*.48,H*.95,-D,-D+.06);front(-.5,.5,H*.48,H,-D+.063,[0,0,1,.45]);}
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
