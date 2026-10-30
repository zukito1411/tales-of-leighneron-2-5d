import {addCapitalShopfront} from './CapitalDetailsGeometry';
import {ModelMesh,atlasMaterial,pigment,type ModelMaterial,type V3} from './ModelMesh';
import {AUTHORED_GATE} from '../../data/architecture';
import type {HouseShape} from './HouseGeometry';

const BUILDINGS=new Set(['old-cottage','cottage','old-inn','inn','hall','manor','smithy','capital-smithy','stable','storehouse','castle','chapel','road-shrine','old-shrine',
  'gatehouse','elven-cottage','elven-manor','elven-gate','elven-chapel','elven-smithy','elven-stable','elven-guildhall','elven-estate','elven-palace']);
type P2=readonly [number,number];

/** Closed service buildings share dimensions with their lights and signage.
 * floorLift raises the roof for player clearance, so fittings must follow the
 * usable wall height rather than the small original painting's height. */
function serviceHouseLayout(shape:HouseShape){
  const H=shape.height,base=Math.max(.96,shape.ground??.96);
  const ground=.5-shape.top-base*H,doorHeight=Math.max(shape.doorHeight??0,H*.30);
  const eave=Math.max(.5-shape.top-.51*H+(shape.floorLift??0),ground+doorHeight*1.22);
  const wallHeight=eave-ground,windowHeight=Math.min(wallHeight*.36,doorHeight*.65);
  return {ground,eave,doorHeight,windowHeight,windowBottom:ground+wallHeight*.28,
    signBottom:ground+wallHeight*.72,signHeight:wallHeight*.19};
}

/** Fixtures in the same frame basis as the enclosed service house. */
export function architectureLightFixtures(shape:HouseShape){
  if(!/smithy|stable/.test(shape.profile.id))return undefined;
  const {width:W}=shape,{windowBottom,windowHeight}=serviceHouseLayout(shape);
  return [.26,.74].map(x=>({
    x:shape.left+x*W-.5,y:windowBottom+windowHeight/2,z:.0252*W,fire:false,
  }));
}

/** Authored assemblies following buildings.png, capital_buildings.png and
 * elven-villa.png. Coordinates describe parts, not a silhouette extruded into
 * a slab. Roofs are closed shells above walls; windows/doors are individual
 * surfaces. A prefab still belongs to ONE existing instanced source batch. */
export function createAuthoredArchitecture(shape:HouseShape,emission=false){
  const id=shape.profile.id;if(!BUILDINGS.has(id))return;
  const {width:W,height:H,depth:D}=shape,elf=id.startsWith('elven-');
  const m=new ModelMesh(shape,emission,W),base=Math.max(.96,shape.ground??.96);
  const lift=shape.floorLift??0;
  const X=(x:number)=>shape.left+x*W-.5,Y=(y:number)=>.5-shape.top-y*H+lift;
  const ground=Y(base)-lift,pt=(x:number,y:number,z:number):V3=>[X(x),Y(y),z];
  // The old material surveys contain door frames, windows and foliage.
  // Never repeat those over a wall. Clean cultural diffuse swatches and a
  // registered part-detail atlas are independent of packed sprite-frame UVs.
  const plaster=/cottage|inn|manor|hall|storehouse|stable|smithy/.test(id)&&!elf;
  const wall=atlasMaterial('architecture',plaster?2:8,W*.20,W*.16);
  const roofing=atlasMaterial(/inn/.test(id)?'buildingDetails':'architecture',/inn/.test(id)?11:elf?6:/cottage/.test(id)?5:4,W*.22,H*.18);
  const stone=atlasMaterial('architecture',8,W*.20,W*.16);
  const timber=atlasMaterial('furnishings',2,W*.24,W*.50);
  const gold=atlasMaterial('furnishings',12,W*.16,W*.24);
  const trim=elf?gold:timber,iron=atlasMaterial('furnishings',3,W*.10,W*.10);
  const shadow:ModelMaterial={color:pigment(0x241d17)},woodDoor=atlasMaterial('architecture',1,W*.23,W*.40);
  const pane:ModelMaterial={color:pigment(0xb26e19),emission:pigment(0xffbd55)};
  const box=(l:number,r:number,b:number,t:number,back:number,front:number,mat:ModelMaterial=wall)=>m.box(X(l),X(r),b,t,back,front,mat);
  const beam=(a:V3,b:V3,r=.007,mat:ModelMaterial=trim)=>m.beam(a,b,W*r,mat,4);
  const arch=(pointed=elf):P2[]=>pointed?[[-.5,0],[.5,0],[.5,.57],[.43,.76],[.25,.91],[0,1],[-.25,.91],[-.43,.76],[-.5,.57]]:
    [[-.5,0],[.5,0],...Array.from({length:9},(_,i):P2=>[Math.cos(i/8*Math.PI)*.5,.64+Math.sin(i/8*Math.PI)*.36])];
  const detailPolygon=(path:readonly P2[],position:(x:number,y:number)=>V3,tile:number,cutout=false)=>{
    if(emission)return;
    const mat={...atlasMaterial('buildingDetails',tile,1,1),cutout};
    const uv=(v:P2):readonly [number,number]=>[v[0]+.5,v[1]];
    for(let i=1;i<path.length-1;i++)m.triangle(position(...path[0]),position(...path[i]),position(...path[i+1]),mat,[uv(path[0]),uv(path[i]),uv(path[i+1])]);
  };
  const glassTile=elf?/palace/.test(id)?5:/chapel/.test(id)?7:/manor|estate/.test(id)?4:3:/chapel|shrine/.test(id)?6:/cottage/.test(id)?0:/inn/.test(id)?2:1;
  /** Local wall basis gives side/rear windows the same arched reveal, sill,
   * glazing and mullions. No camera-facing windows pasted over corners. */
  const window=(cx:number,y:number,z:number,w:number,h:number,rx=1,rz=0,large=false)=>{
    const nx=-rz,nz=rx,p=(x:number,v:number,out=.006):V3=>[cx+x*w*rx+nx*out*W,y+v*h,z+x*w*rz+nz*out*W];
    const square=!elf&&!/chapel|shrine|castle/.test(id)&&y>ground+.29*H;
    const path:P2[]=square?[[-.5,0],[.5,0],[.5,1],[-.5,1]]:arch(),outline=path.map(([x,v])=>p(x,v));
    // Backing arch closes the opening, rather than leaving a transparent hole.
    if(rx===1&&rz===0)m.extrude(outline.map(a=>[a[0],a[1]] as const),z+.005*W,z-.006*W,pane);
    else for(let i=1;i<path.length-1;i++)m.triangle(p(...path[0]),p(...path[i]),p(...path[i+1]),pane);
    detailPolygon(path,(x,v)=>p(x,v,.007),glassTile);
    if(emission)for(let i=1;i<path.length-1;i++)m.triangle(p(...path[0],.0072),p(...path[i],.0072),p(...path[i+1],.0072),pane);
    for(let i=0;i<path.length;i++){
      const a=path[i],b=path[(i+1)%path.length];beam(p(...a,.013),p(...b,.013),large?.010:.006,square?timber:stone);
      if(elf)beam(p(a[0]*.94,a[1],.020),p(b[0]*.94,b[1],.020),.0025,gold);
    }
    beam(p(0,.02,.015),p(0,.90,.015),.0035,trim);
    if(!elf||large)beam(p(-.47,.36,.015),p(.47,.36,.015),.0035,trim);
    if(large)for(const x of [-.24,.24])beam(p(x,.02,.015),p(x,.82,.015),.003,trim);
    beam(p(-.58,-.025,.018),p(.58,-.025,.018),.012,stone);
    if(elf){beam(p(-.53,.16,.018),p(-.64,.05,.018),.005,gold);beam(p(.53,.16,.018),p(.64,.05,.018),.005,gold);}
  };
  const leaf=(cx:number,y:number,z:number,size:number)=>{
    const points:P2[]=Array.from({length:17},(_,i):P2=>{const t=i/16;return [cx+Math.sin(t*Math.PI*2)*size*.18,y+(1-Math.cos(t*Math.PI*2))*size*.5];});
    m.extrude(points,z+.004*W,z-.004*W,gold);beam([cx,y,z+.007*W],[cx,y+size*.92,z+.007*W],.0025,timber);
  };
  const door=(cx:number,z:number,w=.16,h=.28*H,pointed=elf,bottom=ground)=>{
    h=Math.max(h,shape.doorHeight??0);
    if(!/castle|palace/.test(id))w=Math.min(w,h/W*.60);
    const x=X(cx),path=arch(pointed),p=(u:number,v:number,out=0):V3=>[x+u*w*W,bottom+v*h,z+out*W];
    m.extrude(path.map(([u,v])=>[x+u*w*W,bottom+v*h] as const),z+.005*W,z-.012*W,woodDoor);
    for(let i=0;i<path.length;i++)beam(p(...path[i],.018),p(...path[(i+1)%path.length],.018),.014,stone);
    for(const u of [-.3,-.1,.1,.3])beam(p(u,.02,.009),p(u,.66,.009),.0025,timber);
    for(const v of [.16,.48])beam(p(-.42,v,.012),p(.42,v,.012),.005,iron);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4,b=(i+1)*Math.PI/4;
      beam([x+w*W*.25+Math.cos(a)*W*.009,bottom+h*.41+Math.sin(a)*W*.009,z+.022*W],
        [x+w*W*.25+Math.cos(b)*W*.009,bottom+h*.41+Math.sin(b)*W*.009,z+.022*W],.0025,gold);
    }
    if(elf){leaf(x,bottom+h*.20,z+.015*W,h*.48);beam(p(0,.03,.020),p(0,.86,.020),.003,gold);}
    for(let i=0;i<3;i++)box(cx-w*.65-i*.022,cx+w*.65+i*.022,ground-.015*W,ground+.006*W*(3-i),z-.015*W,z+(.028+i*.028)*W,stone);
  };
  const banner=(cx:number,y:number,z:number,w:number,h:number,tile=elf?9:/inn/.test(id)?10:8)=>{
    const path:P2[]=[[-.5,1],[.5,1],[.5,.16],[0,0],[-.5,.16]],x=X(cx);
    const p=(u:number,v:number):V3=>[x+u*w*W,y+v*h,z+.002*W];
    m.extrude(path.map(([u,v])=>[x+u*w*W,y+v*h] as const),z,z-.004*W,atlasMaterial('furnishings',elf?7:/inn/.test(id)?13:6,W*.20,W*.30));
    detailPolygon(path,p,tile);beam([x-w*W*.65,y+h,z],[x+w*W*.65,y+h,z],.005,gold);
  };
  /** A separate roof shell: the outer paint covers only sloping roof faces.
   * Side gables, underside, fascia and ridge all have their own closed faces. */
  const roof=(l:number,r:number,back:number,front:number,eave:number,peak:number,axis:'x'|'z'='x',curved=elf,hip=false)=>{
    const a=X(l),b=X(r),steps=curved||hip?10:2,thickness=W*(hip?.020:.012);
    const section=(t:number)=>{
      const d=Math.abs(t*2-1),rise=peak-eave;
      return eave+rise*Math.pow(1-d,curved?1.65:hip?.78:1)+(curved?rise*.14*Math.pow(d,10):0);
    };
    const p=(edge:number,t:number,lower=0):V3=>{
      const inset=hip?Math.sin(Math.PI*t)*(b-a)*.17:0;
      return axis==='x'?[edge===0?a+inset:b-inset,section(t)-lower,back+(front-back)*t]:[a+(b-a)*t,section(t)-lower,edge===0?back:front];
    };
    for(let i=0;i<steps;i++){
      const t=i/steps,u=(i+1)/steps;
      m.quad(p(0,t),p(1,t),p(0,u),p(1,u),roofing);
      m.quad(p(1,t,thickness),p(0,t,thickness),p(1,u,thickness),p(0,u,thickness),timber);
      for(const edge of [0,1]){
        m.quad(p(edge,t),p(edge,u),p(edge,t,thickness),p(edge,u,thickness),hip?roofing:trim);
        beam(p(edge,t,.002*W),p(edge,u,.002*W),hip?.011:.007,hip?roofing:trim);
        const lower=(v:number):V3=>axis==='x'?[edge===0?a:b,eave,back+(front-back)*v]:[a+(b-a)*v,eave,edge===0?back:front];
        // Front-facing gables already have an authored wall below this shell.
        // Filling down to their eaves again hides glazing mounted on that wall.
        if(axis==='x')m.quad(p(edge,t,thickness),p(edge,u,thickness),lower(t),lower(u),hip?roofing:wall);
      }
    }
    for(const t of [0,1]){m.quad(p(0,t),p(1,t),p(0,t,thickness),p(1,t,thickness),hip?roofing:trim);beam(p(0,t),p(1,t),.009,hip?roofing:trim);}
    beam(p(0,.5),p(1,.5),.010,hip?roofing:trim);
    if(hip){
      // Overlapping thatch courses and a lightly scalloped fringe make a
      // rounded straw roof, rather than a smooth yellow tent with timber ribs.
      for(const t of [.12,.28,.72,.88]){
        const a=p(0,t),b=p(1,t),u=t<.5?t-.045:t+.045,c=p(0,u),d=p(1,u);
        m.quad([a[0],a[1]+.009*W,a[2]],[b[0],b[1]+.009*W,b[2]],[c[0],c[1]+.003*W,c[2]],[d[0],d[1]+.003*W,d[2]],roofing);
      }
      for(const t of [0,1])for(let i=0;i<12;i++){
        const a=p(0,t),b=p(1,t),x=(v:number):V3=>[a[0]+(b[0]-a[0])*v,a[1]-.012*W*Math.sin(v*12*Math.PI)**2,a[2]+(b[2]-a[2])*v];
        const l=x(i/12),r=x((i+1)/12),mid=x((i+.5)/12);
        m.triangle(l,r,[mid[0],mid[1]-.017*W,mid[2]],roofing);
      }
    }
    if(curved)for(const edge of [0,1]){
      const fin=p(edge,.5);leaf(fin[0],fin[1]-.003*W,fin[2],W*.040);
      for(const t of [0,1]){const end=p(edge,t);beam(end,[end[0],end[1]+.035*W,end[2]],.005,gold);}
    }
  };
  const body=(l:number,r:number,back:number,front:number,eave:number,halfTimber=true)=>{
    box(l,r,ground,eave,back,front);
    box(l-.009,r+.009,ground,ground+.065*H,back-.008*W,front+.008*W,stone);
    for(const x of [l,r])for(const z of [back,front]){
      beam([X(x),ground,z],[X(x),eave,z],.013,halfTimber?trim:stone);
      for(let i=0;i<3;i++)box(x-.022,x+.022,ground+i*.045*H,ground+(i+.82)*.045*H,z-.018*W,z+.018*W,stone);
    }
    for(const z of [back,front])beam([X(l),eave,z],[X(r),eave,z],.013,trim);
  };
  const gable=(l:number,r:number,back:number,front:number,eave:number,peak:number,curved=elf,rounded=false)=>{
    const a=X(l),b=X(r),cx=(a+b)/2,steps=curved?10:2;
    const ridge=(t:number)=>{const d=Math.abs(t*2-1);return eave+(peak-eave)*Math.pow(1-d,curved?1.65:1)+(curved?(peak-eave)*.14*d**10:0);};
    const path:P2[]=[[a,eave],[b,eave],...Array.from({length:steps+1},(_,i):P2=>{const t=1-i/steps;return [a+(b-a)*t,ridge(t)];})];
    m.extrude(path,front,back,wall);
    roof(l-.018,r+.018,back-.010*W,front+.025*W,eave+.008*W,peak+.008*W,'z',curved,rounded);
    beam([cx,eave,front+.006*W],[cx,peak,front+.006*W],.008,trim);
    beam([a,eave,front+.007*W],[b,eave,front+.007*W],.010,trim);
    // Glazed gables already carry the source tree/leaf ornament in the glass.
    // Keep solid carving out of the lancet; roof-tip finials remain above it.
    if(curved&&!/manor|estate|palace|chapel|shrine/.test(id))leaf(cx,eave+(peak-eave)*.12,front+.018*W,(peak-eave)*.55);
  };
  const sideWindows=(l:number,r:number,eave:number,front=0,back=-D,count=2)=>{
    const y=ground+(eave-ground)*.29,h=Math.min((eave-ground)*.39,H*.21),w=Math.min(W*.105,D*.22);
    for(let i=0;i<count;i++)for(const side of [-1,1])window(X(side<0?l:r)+side*.007*W,y,back+(front-back)*(i+.5)/count,w,h,0,-side);
    for(const cx of [l+(r-l)*.24,l+(r-l)*.76])window(X(cx),y,back-.008*W,W*.105,h,-1,0);
  };
  const chimney=(cx:number,z:number,top:number,bottom=ground)=>{
    box(cx-.038,cx+.038,bottom,top,z-.035*W,z+.035*W,stone);
    box(cx-.046,cx+.046,top-.015*W,top+.008*W,z-.044*W,z+.044*W,stone);
    box(cx-.025,cx+.025,top+.0081*W,top+.009*W,z-.025*W,z+.025*W,shadow);
  };
  const planter=(cx:number,y:number,z:number,w=.16)=>{
    box(cx-w/2,cx+w/2,y,y+.038*H,z-.028*W,z+.028*W,timber);
    for(const x of [cx-w*.4,cx+w*.4])box(x-.007,x+.007,y-.012*H,y+.040*H,z-.030*W,z+.030*W,iron);
    // Fine plants keep painted cutouts, as the rest of the game's foliage does.
    // Do not replace flowers with polygonal lumps on the window boxes.
    if(!emission){
      detailPolygon([[-.5,0],[.5,0],[.5,1],[-.5,1]],(u,v)=>[X(cx)+u*w*W,y+.035*H+v*.07*H,z+.031*W],14,true);
    }
  };
  const barrel=(cx:number,z:number,h=.11*H)=>{
    const x=X(cx),r=W*.044;m.cylinder(x,z,ground,ground+h*.13,r*.84,r,timber,12);
    m.cylinder(x,z,ground+h*.13,ground+h*.82,r,r,timber,12);m.cylinder(x,z,ground+h*.82,ground+h,r,r*.84,timber,12);
    for(const t of [.16,.77])m.ring(x,z,ground+h*t,ground+h*(t+.07),r*1.025,r*.94,iron,12);
  };
  const balcony=(l:number,r:number,y:number,front:number)=>{
    box(l,r,y-.022*W,y,-.035*W,front,timber);
    for(const z of [front,-.02*W])beam([X(l),y+.09*H,z],[X(r),y+.09*H,z],.006,trim);
    for(let i=0;i<=8;i++){const x=X(l+(r-l)*i/8);beam([x,y,front],[x,y+.09*H,front],.004,trim);}
    for(const x of [l,r])beam([X(x),y-.10*H,0],[X(x),y,front],.008,trim);
    planter((l+r)/2,y+.07*H,front+.008*W,(r-l)*.70);
  };
  const tower=(cx:number,z:number,r:number,eave:number,peak:number,crenels=false)=>{
    const x=X(cx);m.cylinder(x,z,ground,eave,r,r,stone,16);
    for(const y of [ground+.055*H,eave-.025*H])m.ring(x,z,y,y+.018*H,r*1.055,r*.94,stone,16);
    for(let i=0;i<4;i++){const a=i*Math.PI/2;window(x+Math.sin(a)*r,ground+(eave-ground)*.72,z+Math.cos(a)*r,r*.48,(eave-ground)*.16,Math.cos(a),-Math.sin(a));}
    if(crenels){
      m.ring(x,z,eave,eave+.027*H,r*1.12,r*.80,stone,16);
      for(let i=0;i<10;i++){const a=i/10*Math.PI*2,xx=x+Math.sin(a)*r,zz=z+Math.cos(a)*r;m.box(xx-r*.19,xx+r*.19,eave+.02*H,eave+.075*H,zz-r*.19,zz+r*.19,stone);}
    }else{
      const rings=elf?8:1;
      for(let row=0;row<rings;row++){
        const t=row/rings,u=(row+1)/rings,rad=(v:number)=>r*1.18*(1-v)**(elf?1.65:1)+(elf?r*.17*(1-v)**9:0);
        m.cylinder(x,z,eave+(peak-eave)*t,eave+(peak-eave)*u,rad(t),rad(u),roofing,16);
        for(let i=0;i<4;i++){
          const a=i*Math.PI/2;beam([x+Math.sin(a)*rad(t),eave+(peak-eave)*t,z+Math.cos(a)*rad(t)],
            [x+Math.sin(a)*rad(u),eave+(peak-eave)*u,z+Math.cos(a)*rad(u)],.0035,trim);
        }
      }
      m.ring(x,z,eave-.012*W,eave+.008*W,r*1.19,r*1.06,trim,16);
      if(elf)leaf(x,peak,z,W*.032);else beam([x,peak,z],[x,peak+.055*H,z],.004,gold);
    }
  };
  const gate=(l:number,r:number,eave:number,peak:number,z=0,back=-D)=>{
    const mid=(l+r)/2,opening=arch(elf),w=(r-l)*AUTHORED_GATE.openingRatio*W,h=(eave-ground)*.85;
    const notch=[...opening.slice(1),opening[0]];
    const loop:P2[]=[[X(l),ground],[X(l),eave],[X(r),eave],[X(r),ground],...notch.map(([x,y])=>[X(mid)+x*w,ground+y*h] as const)];
    m.extrude(loop,z,back,stone);
    for(let i=0;i<opening.length;i++){
      const a=opening[i],b=opening[(i+1)%opening.length];
      if(a[1]===0&&b[1]===0)continue;
      beam([X(mid)+a[0]*w,ground+a[1]*h,z+.012*W],[X(mid)+b[0]*w,ground+b[1]*h,z+.012*W],.017,elf?gold:stone);
    }
    roof(l-.015,r+.015,back-.015*W,z+.025*W,eave,peak,'x');
  };

  if(id==='castle'||id==='elven-palace'){
    const palace=elf,wing=Y(.63),keep=Y(palace?.39:.35);
    // Connected lower wings, a forward great hall and four actual round
    // towers replace the single saw-toothed castle silhouette slab.
    body(.13,.87,-D*.92,palace?-D*.64:-D*.12,wing,false);
    if(palace){gate(.20,.39,wing,Y(.49),-D*.12,-D*.66);gate(.61,.80,wing,Y(.49),-D*.12,-D*.66);}
    else roof(.12,.88,-D*.98,-D*.06,wing,Y(.49),'x');
    body(.36,.64,-D*.67,.012*W,keep,false);
    gable(.35,.65,-D*.69,.025*W,keep,Y(palace?.14:.18));
    if(!palace){
      // The source castle has a fortified rear keep rising behind its front
      // gable. Give it a stone crown rather than another oversized pitched roof.
      const crown=Y(.14);box(.42,.58,ground,crown,-D*.94,-D*.60,stone);
      box(.408,.592,crown-.018*H,crown+.014*H,-D*.96,-D*.58,stone);
      for(let i=0;i<4;i++)for(const z of [-D*.96,-D*.60])box(.413+i*.045,.438+i*.045,crown,crown+.060*H,z,z+.022*W,stone);
      for(const x of [.408,.57])for(let i=1;i<3;i++)box(x,x+.022,crown,crown+.060*H,-D*.92+D*.30*i/3,-D*.92+D*.30*i/3+.022*W,stone);
    }
    door(.50,.030*W,.15,H*.25);
    if(palace)window(X(.50),Y(.43),.037*W,W*.16,H*.27,1,0,true);
    else banner(.50,Y(.57),.040*W,.11,H*.25,8);
    for(const side of [-1,1]){
      const x=side<0?.20:.80;
      tower(x,-D*.15,W*.095,Y(.39),Y(.17));
      tower(side<0?.37:.63,-D*.77,W*.073,Y(.27),Y(.07));
      window(X(side<0?.29:.71),Y(.80),-D*.10,W*.075,H*.14);
      banner(x,Y(.73),-D*.15+W*.101,.065,H*.18,palace?9:8);
      if(palace)planter(side<0?.27:.73,ground+.05*H,.05*W,.14);
    }
    for(const x of [.35,.65])for(let i=0;i<3;i++)box(x-.02,x+.02,ground,ground+H*(.16+i*.07),.008*W-i*.018*W,.045*W-i*.010*W,stone);
    sideWindows(.13,.87,wing,-D*.12,-D*.92,3);
  }else if(id==='gatehouse'||id==='elven-gate'){
    const eave=Y(.49);gate(AUTHORED_GATE.left,AUTHORED_GATE.right,eave,Y(.29),0,-D*.78);
    for(const x of [.18,.82]){
      if(elf)tower(x,-D*.35,W*.10,Y(.35),Y(.08));
      else{body(x-.085,x+.085,-D*.86,.015*W,Y(.26),false);for(let i=0;i<3;i++)box(x-.095+i*.065,x-.055+i*.065,Y(.27),Y(.15),-D*.89,.03*W,stone);}
      banner(x,Y(.75),W*.12,.085,H*.27,elf?9:8);
    }
  }else if(/chapel|shrine/.test(id)){
    const eave=Y(elf?.61:.62);body(.24,.76,-D*.83,0,eave,false);gable(.22,.78,-D*.87,.025*W,eave,Y(elf?.15:.23));
    window(X(.50),ground+.13*H,.035*W,W*.24,H*.38,1,0,true);
    for(const x of [.25,.75]){box(x-.042,x+.042,ground,eave,-D*.84,.065*W,stone);box(x-.054,x+.054,ground,ground+.085*H,-.06*W,.10*W,stone);}
    for(let i=0;i<3;i++)box(.27-i*.035,.73+i*.035,ground-.01*W,ground+(.022-i*.006)*H,.035*W,.09*W+i*.035*W,stone);
    sideWindows(.24,.76,eave,0,-D*.83);
    const peak=Y(elf?.13:.17);if(elf)leaf(X(.5),peak,.025*W,W*.12);
    else{beam(pt(.5,.17,.025*W),[X(.5),peak+.09*H,.025*W],.008,gold);beam([X(.44),peak+.055*H,.025*W],[X(.56),peak+.055*H,.025*W],.008,gold);}
  }else if(/smithy|stable/.test(id)){
    const smithy=/smithy/.test(id);
    const {eave,doorHeight,windowBottom,windowHeight,signBottom:signY,signHeight}=serviceHouseLayout(shape);
    // Stables previously carried the source anvil-sign tile and an open bay.
    // Both service-house variants now have an uninterrupted, closed facade.
    body(.12,.88,-D,0,eave);
    roof(.07,.93,-D-.025*W,.045*W,eave,eave+H*(elf?.30:.31),'x');
    door(.50,.015*W,smithy?.23:.29,doorHeight);
    for(const x of [.26,.74])window(X(x),windowBottom,.018*W,W*.12,windowHeight);
    sideWindows(.12,.88,eave);
    // A lintel keeps the front legible as a complete wall.
    beam([X(.12),eave-.02*H,.016*W],[X(.88),eave-.02*H,.016*W],.008,trim);
    if(smithy)chimney(.78,-D*.68,eave+H*.39,eave-.05*H);
    if(elf)for(const x of [.12,.88])leaf(X(x),eave-.11*H,.025*W,H*.11);
    const signTop=signY+signHeight,signZ=.075*W,bracketY=eave-.018*H;
    beam([X(.16),bracketY,.012*W],[X(.36),bracketY,.012*W],.006,iron);
    for(const x of [.20,.32]){
      beam([X(x),bracketY,.012*W],[X(x),bracketY,signZ],.004,iron);
      beam([X(x),signTop,signZ],[X(x),bracketY,signZ],.0025,iron);
    }
    box(.17,.35,signY,signTop,signZ-.012*W,signZ+.012*W,timber);
    const anvil:P2[]=[[-.12,.79],[-.052,.73],[-.040,.48],[-.065,.39],[-.065,.32],[.060,.32],[.060,.40],[.037,.49],[.045,.75],[.078,.78],[.078,1],[-.065,1]];
    const emblem:ModelMaterial={color:pigment(elf?0xd8c88c:0xd6c394)};
    const signPath:P2[]=smithy
      ?anvil.map(([x,y])=>[X(.26)+x*W*.60,signY+(y-.23)*signHeight*1.15])
      :[...Array.from({length:17},(_,i):P2=>{const a=i/16*Math.PI;return [X(.26)+Math.cos(a)*W*.054,signY+signHeight*(.83-Math.sin(a)*.68)];}),
        ...Array.from({length:17},(_,i):P2=>{const a=(1-i/16)*Math.PI;return [X(.26)+Math.cos(a)*W*.033,signY+signHeight*(.83-Math.sin(a)*.45)];})];
    for(const side of [-1,1]){
      const z=signZ+side*.0125*W;m.extrude(signPath,z+.0004*W,z-.0004*W,emblem);
    }
  }else{
    const cottage=/cottage/.test(id),twoStorey=/inn|manor|estate/.test(id),guild=/guildhall/.test(id);
    const eave=Y(cottage?.58:twoStorey?.48:.48),l=cottage?.13:.12,r=cottage?.85:.88;
    body(l,r,-D,0,eave);
    roof(l-.045,r+.045,-D-.025*W,.045*W,eave,Y(cottage?.17:twoStorey?.19:.20),'x',elf,cottage&&!elf);
    if(twoStorey){
      const middle=ground+(eave-ground)*.50;box(l,r,middle-.014*H,middle+.013*H,-D-.007*W,.016*W,trim);
      for(const x of [.28,.48,.70])beam([X(x),ground,.011*W],[X(x),eave,.011*W],.009,trim);
      for(const z of [-D,.012*W])for(const x of [.18,.64])beam([X(x),middle,z],[X(x+.16),eave-.02*H,z],.006,trim);
      body(.40,.68,-D*.52,.045*W,eave+.045*H);
      gable(.37,.71,-D*.54,.06*W,eave+.045*H,Y(elf?.10:.07));
      window(X(.54),eave+.065*H,.070*W,W*(elf?.16:.12),H*(elf?.22:.14));
      for(const x of [.25,.77]){window(X(x),ground+.10*H,.018*W,W*.11,H*.17);window(X(x),middle+.04*H,.018*W,W*.11,H*.15);}
      door(.52,.065*W,.22,H*.24);
      if(elf||id==='manor')balcony(.40,.70,middle+.015*H,.115*W);
      else banner(.22,middle-.06*H,.07*W,.13,H*.23,10);
      sideWindows(l,r,eave);for(const side of [-1,1])window(X(side<0?l:r)+side*.008*W,middle+.03*H,-D*.60,W*.10,H*.15,0,-side);
      if(/estate/.test(id))for(const x of [.18,.81])tower(x,-D*.67,W*.082,Y(.52),Y(.30));
    }else if(cottage){
      door(elf?.50:.58,.015*W,elf?.24:.23,H*.34);
      for(const x of [.29,.77])window(X(x),ground+.12*H,.015*W,W*.11,H*.17);
      // Projecting dormer on the thatch; elven cottage gets its tall central
      // lancet gable and leaf-carved verge from the reference instead.
      if(elf){gable(.29,.70,-D*.50,.035*W,eave,Y(.18));leaf(X(.50),eave+.015*H,.06*W,H*.16);}
      else{
        const y=eave+.095*H;box(.40,.59,y,y+.10*H,-D*.30,.015*W,wall);gable(.38,.61,-D*.32,.027*W,y+.10*H,y+.19*H,false,true);
        window(X(.495),y+.02*H,.035*W,W*.10,H*.10);
      }
      planter(.27,ground+.05*H,.075*W,.17);barrel(.88,.02*W);sideWindows(l,r,eave);
    }else{
      const mid=.50;door(mid,.014*W,.22,H*(guild?.30:.25));
      for(const x of [.28,.74])window(X(x),ground+.13*H,.014*W,W*.11,H*.17);
      if(elf||guild)gable(.29,.71,-D*.64,.03*W,eave,Y(elf?.20:.21));
      else{gable(.43,.58,-D*.43,.025*W,eave+.025*H,eave+.15*H,false);window(X(.505),eave+.04*H,.035*W,W*.06,H*.07);}
      if(id==='hall')banner(.24,ground+.17*H,.06*W,.14,H*.27,8);
      if(id==='storehouse'){barrel(.23,.055*W);barrel(.79,.07*W);}
      sideWindows(l,r,eave);planter(.73,ground+.06*H,.06*W,.16);
    }
    if(!elf||/manor/.test(id))chimney(twoStorey?.78:.75,-D*.70,Y(twoStorey?.14:.16),eave-.05*H);
    if(elf)for(const x of [l,r]){leaf(X(x),eave-.10*H,.025*W,H*.10);planter(x,ground+.045*H,.03*W,.10);}
  }
  addCapitalShopfront(m,shape,emission);
  return m.finish();
}
