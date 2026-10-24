import {ModelMesh,atlasMaterial,paintedMaterial,pigment,type ModelMaterial,type Patch,type V3} from './ModelMesh';
import type {HouseShape} from './HouseGeometry';

const BUILDINGS=new Set(['old-cottage','cottage','old-inn','inn','hall','manor','smithy','capital-smithy','stable','storehouse','castle','chapel','road-shrine','old-shrine',
  'gatehouse','elven-cottage','elven-manor','elven-gate','elven-chapel','elven-smithy','elven-stable','elven-guildhall','elven-estate','elven-palace']);
type P2=readonly [number,number];

/** Authored assemblies following buildings.png, capital_buildings.png and
 * elven-villa.png. Coordinates describe parts, not a silhouette extruded into
 * a slab. Roofs are closed shells above walls; windows/doors are individual
 * surfaces. A prefab still belongs to ONE existing instanced source batch. */
export function createAuthoredArchitecture(shape:HouseShape,emission=false){
  const id=shape.profile.id;if(!BUILDINGS.has(id))return;
  const {width:W,height:H,depth:D}=shape,elf=id.startsWith('elven-');
  const m=new ModelMesh(shape,emission,W),base=Math.max(.96,shape.ground??.96);
  const X=(x:number)=>shape.left+x*W-.5,Y=(y:number)=>.5-shape.top-y*H;
  const ground=Y(base),pt=(x:number,y:number,z:number):V3=>[X(x),Y(y),z];
  const crop=(p:Patch):Patch=>{const r=shape.paintRegion;return r?[r[0]+p[0]*r[2],r[1]+p[1]*r[3],r[0]+p[2]*r[2],r[1]+p[3]*r[3]]:p;};
  // The old material surveys contain door frames, windows and foliage.
  // Never repeat those over a wall. Only verified roof-only patches from the
  // original sheets are admitted; plaster/masonry use clean diffuse swatches.
  const plaster=/cottage|inn|manor|hall|storehouse|stable|smithy/.test(id)&&!elf;
  const wall=atlasMaterial('architecture',plaster?2:8,W*.20,W*.16);
  const roofPaint:Partial<Record<string,Patch>>={
    cottage:[.278,.171,.403,.261],inn:[.108,.277,.188,.382],
    hall:[.33,.16,.52,.29],manor:[.172,.245,.280,.369],castle:[.094,.254,.126,.309],
    'elven-cottage':[.229,.427,.314,.488],'elven-manor':[.125,.446,.191,.500],
    'elven-palace':[.607,.332,.643,.371],'elven-estate':[.329,.226,.378,.282],
    'elven-guildhall':[.154,.334,.222,.394],'elven-smithy':[.214,.277,.312,.347],
    'elven-stable':[.229,.190,.296,.254],'elven-gate':[.118,.217,.157,.257],
  };
  const roofing=roofPaint[id]?paintedMaterial(crop(roofPaint[id]!),W*.22,H*.18):atlasMaterial('architecture',elf?6:/cottage/.test(id)?5:4,W*.22,H*.18);
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
  const artPolygon=(path:readonly P2[],position:(x:number,y:number)=>V3,source:Patch)=>{
    if(emission)return;
    const [l,t,r,b]=crop(source),uv=(v:P2):readonly [number,number]=>[shape.left+(l+(v[0]+.5)*(r-l))*W,1-shape.top-(b-v[1]*(b-t))*H];
    for(let i=1;i<path.length-1;i++)m.triangle(position(...path[0]),position(...path[i]),position(...path[i+1]),source,undefined,undefined,[uv(path[0]),uv(path[i]),uv(path[i+1])]);
  };
  const windowArt:Partial<Record<string,Patch>>={
    cottage:[.3727,.7028,.419,.7907],'old-cottage':[.29,.57,.43,.77],inn:[.6941,.7319,.8481,.8374],'old-inn':[.49,.48,.62,.67],
    hall:[.4816,.6831,.5212,.786],manor:[.6129,.6783,.6962,.7962],storehouse:[.38,.20,.53,.42],castle:[.2697,.571,.2978,.6546],
    chapel:[.37,.43,.59,.76],'road-shrine':[.40,.45,.60,.70],
    'elven-cottage':[.1829,.5836,.2774,.7758],'elven-manor':[.4606,.3763,.5878,.567],'elven-chapel':[.36,.27,.61,.73],
    'elven-guildhall':[.1543,.5344,.2284,.7406],'elven-estate':[.5186,.2817,.5981,.4551],'elven-palace':[.4522,.2994,.5922,.5629],
  };
  /** Local wall basis gives side/rear windows the same arched reveal, sill,
   * glazing and mullions. No camera-facing windows pasted over corners. */
  const window=(cx:number,y:number,z:number,w:number,h:number,rx=1,rz=0,large=false)=>{
    const nx=-rz,nz=rx,p=(x:number,v:number,out=.006):V3=>[cx+x*w*rx+nx*out*W,y+v*h,z+x*w*rz+nz*out*W];
    const path=arch(),outline=path.map(([x,v])=>p(x,v));
    // Backing arch closes the opening, rather than leaving a transparent hole.
    if(rx===1&&rz===0)m.extrude(outline.map(a=>[a[0],a[1]] as const),z+.005*W,z-.006*W,pane);
    else for(let i=1;i<path.length-1;i++)m.triangle(p(...path[0]),p(...path[i]),p(...path[i+1]),pane);
    if(windowArt[id])artPolygon(path,(x,v)=>p(x,v,.007),windowArt[id]!);
    for(let i=0;i<path.length;i++){const a=path[i],b=path[(i+1)%path.length];beam(p(...a,.013),p(...b,.013),large?.010:.006,elf?gold:stone);}
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
  const banner=(cx:number,y:number,z:number,w:number,h:number,source:Patch)=>{
    const path:P2[]=[[-.5,1],[.5,1],[.5,.16],[0,0],[-.5,.16]],x=X(cx);
    const p=(u:number,v:number):V3=>[x+u*w*W,y+v*h,z+.002*W];
    m.extrude(path.map(([u,v])=>[x+u*w*W,y+v*h] as const),z,z-.004*W,atlasMaterial('furnishings',elf?7:6,W*.20,W*.30));
    artPolygon(path,p,source);beam([x-w*W*.65,y+h,z],[x+w*W*.65,y+h,z],.005,gold);
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
        m.quad(p(edge,t),p(edge,u),p(edge,t,thickness),p(edge,u,thickness),trim);
        beam(p(edge,t,.002*W),p(edge,u,.002*W),hip?.011:.007,trim);
        const lower=(v:number):V3=>axis==='x'?[edge===0?a:b,eave,back+(front-back)*v]:[a+(b-a)*v,eave,edge===0?back:front];
        m.quad(p(edge,t,thickness),p(edge,u,thickness),lower(t),lower(u),hip?roofing:wall);
      }
    }
    for(const t of [0,1]){m.quad(p(0,t),p(1,t),p(0,t,thickness),p(1,t,thickness),trim);beam(p(0,t),p(1,t),.009,trim);}
    beam(p(0,.5),p(1,.5),.010,trim);
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
  const gable=(l:number,r:number,back:number,front:number,eave:number,peak:number,curved=elf)=>{
    const a=X(l),b=X(r),cx=(a+b)/2,steps=curved?10:2;
    const ridge=(t:number)=>{const d=Math.abs(t*2-1);return eave+(peak-eave)*Math.pow(1-d,curved?1.65:1)+(curved?(peak-eave)*.14*d**10:0);};
    const path:P2[]=[[a,eave],[b,eave],...Array.from({length:steps+1},(_,i):P2=>{const t=1-i/steps;return [a+(b-a)*t,ridge(t)];})];
    m.extrude(path,front,back,wall);
    roof(l-.018,r+.018,back-.010*W,front+.025*W,eave+.008*W,peak+.008*W,'z',curved);
    beam([cx,eave,front+.006*W],[cx,peak,front+.006*W],.008,trim);
    beam([a,eave,front+.007*W],[b,eave,front+.007*W],.010,trim);
    if(curved)leaf(cx,eave+(peak-eave)*.12,front+.018*W,(peak-eave)*.55);
  };
  const sideWindows=(l:number,r:number,eave:number,front=0,back=-D,count=2)=>{
    const y=ground+(eave-ground)*.29,h=(eave-ground)*.39,w=Math.min(W*.105,D*.22);
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
      const plant:Patch=elf?/manor/.test(id)?[.40,.56,.70,.64]:[.04,.82,.24,.95]:/cottage/.test(id)?[.06,.72,.20,.86]:[.04,.82,.20,.95];
      m.cutout([X(cx-w*.48),y+.035*H,z+.031*W],[X(cx+w*.48),y+.035*H,z+.031*W],
        [X(cx-w*.48),y+.105*H,z+.031*W],[X(cx+w*.48),y+.105*H,z+.031*W],crop(plant));
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
    for(let i=0;i<4;i++){const a=i*Math.PI/2;window(x+Math.sin(a)*r,ground+(eave-ground)*.46,z+Math.cos(a)*r,r*.48,(eave-ground)*.20,Math.cos(a),-Math.sin(a));}
    if(crenels){
      m.ring(x,z,eave,eave+.027*H,r*1.12,r*.80,stone,16);
      for(let i=0;i<10;i++){const a=i/10*Math.PI*2,xx=x+Math.sin(a)*r,zz=z+Math.cos(a)*r;m.box(xx-r*.19,xx+r*.19,eave+.02*H,eave+.075*H,zz-r*.19,zz+r*.19,stone);}
    }else{
      const rings=elf?8:1;
      for(let row=0;row<rings;row++){
        const t=row/rings,u=(row+1)/rings,rad=(v:number)=>r*1.18*(1-v)**(elf?1.65:1)+(elf?r*.17*(1-v)**9:0);
        m.cylinder(x,z,eave+(peak-eave)*t,eave+(peak-eave)*u,rad(t),rad(u),roofing,16);
      }
      m.ring(x,z,eave-.012*W,eave+.008*W,r*1.19,r*1.06,trim,16);
      if(elf)leaf(x,peak,z,W*.032);else beam([x,peak,z],[x,peak+.055*H,z],.004,gold);
    }
  };
  const gate=(l:number,r:number,eave:number,peak:number,z=0,back=-D)=>{
    const mid=(l+r)/2,opening=arch(elf),w=(r-l)*.55*W,h=(eave-ground)*.85;
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
    gable(.35,.65,-D*.69,.025*W,keep,Y(palace?.14:.10));
    door(.50,.030*W,.15,H*.25);
    if(palace)window(X(.50),Y(.43),.037*W,W*.16,H*.27,1,0,true);
    else banner(.50,Y(.57),.040*W,.11,H*.25,[.40,.31,.52,.62]);
    for(const side of [-1,1]){
      const x=side<0?.20:.80;
      tower(x,-D*.26,W*.095,Y(.39),Y(.17));
      tower(side<0?.37:.63,-D*.77,W*.073,Y(.27),Y(.07));
      window(X(side<0?.29:.71),Y(.80),-D*.10,W*.075,H*.14);
      banner(x,Y(.73),-D*.26+W*.101,.065,H*.18,palace?[.12,.32,.26,.72]:[.57,.53,.65,.74]);
      if(palace)planter(side<0?.27:.73,ground+.05*H,.05*W,.14);
    }
    for(const x of [.35,.65])for(let i=0;i<3;i++)box(x-.02,x+.02,ground,ground+H*(.16+i*.07),.008*W-i*.018*W,.045*W-i*.010*W,stone);
    sideWindows(.13,.87,wing,-D*.12,-D*.92,3);
  }else if(id==='gatehouse'||id==='elven-gate'){
    const eave=Y(.49);gate(.15,.85,eave,Y(.29),0,-D*.78);
    for(const x of [.18,.82]){
      if(elf)tower(x,-D*.35,W*.10,Y(.35),Y(.08));
      else{body(x-.085,x+.085,-D*.86,.015*W,Y(.26),false);for(let i=0;i<3;i++)box(x-.095+i*.065,x-.055+i*.065,Y(.27),Y(.15),-D*.89,.03*W,stone);}
      banner(x,Y(.75),W*.12,.085,H*.27,elf?[.12,.32,.26,.72]:[.15,.34,.30,.70]);
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
    const stable=/stable/.test(id),eave=Y(.51);
    box(.12,.16,ground,eave,-D,0);box(.84,.88,ground,eave,-D,0);box(.16,.84,ground,eave,-D,-D+.025*W);
    box(.11,.89,ground,ground+.045*H,-D-.005*W,.015*W,stone);
    // The workshop front is a deep open bay with a rear wall, not a painted
    // window. Recessing it keeps the workbench and hearth inside the roof.
    box(.16,.84,ground+.045*H,eave-.02*H,-D+.025*W,-D+.028*W,shadow);
    roof(.07,.93,-D-.015*W,.065*W,eave,Y(elf?.21:.20),'x');
    for(const x of [.14,.49,.86])beam([X(x),ground,0],[X(x),eave,0],.016,trim);
    beam(pt(.16,.52,.020*W),pt(.31,.66,.020*W),.009,trim);beam(pt(.84,.52,.020*W),pt(.69,.66,.020*W),.009,trim);
    if(stable){
      for(const [l,r] of [[.17,.46],[.53,.82]]){
        box(l,r,ground,ground+.15*H,0,.025*W,timber);beam([X(l),ground,.03*W],[X(r),ground+.15*H,.03*W],.009,trim);
      }
      gable(.39,.61,-D*.75,.035*W,eave,Y(.29));window(X(.50),eave+.025*H,.04*W,W*.085,H*.10);
    }else{
      chimney(.80,-.01*W,Y(.13));
      box(.70,.91,ground,ground+.13*H,-.04*W,.07*W,stone);
      box(.72,.89,ground+.13*H,ground+.31*H,-.035*W,.015*W,shadow);
      for(const x of [.70,.89])box(x,x+.018,ground+.12*H,ground+.36*H,-.04*W,.04*W,stone);
      box(.70,.91,ground+.31*H,ground+.37*H,-.04*W,.055*W,stone);
      const fire:Patch=elf?[.57,.41,.69,.56]:id==='capital-smithy'?[.68,.62,.79,.77]:[.68,.60,.81,.78];
      m.fire(X(.805),ground+.14*H,.042*W,W*.12,H*.17,crop(fire));
      box(.35,.56,ground+.19*H,ground+.215*H,-.04*W,.045*W,iron);box(.41,.50,ground,ground+.19*H,-.04*W,.01*W,iron);
    }
    banner(.24,ground+.19*H,.06*W,.11,H*.20,elf?[.06,.38,.18,.72]:[.18,.54,.30,.72]);
    barrel(.11,.055*W);barrel(.93,-.08*W);sideWindows(.12,.88,eave);
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
      door(.52,.065*W,.16,H*.24);
      if(elf||id==='manor')balcony(.40,.70,middle+.015*H,.115*W);
      else banner(.22,middle-.06*H,.07*W,.13,H*.23,[.12,.45,.29,.69]);
      sideWindows(l,r,eave);for(const side of [-1,1])window(X(side<0?l:r)+side*.008*W,middle+.03*H,-D*.60,W*.10,H*.15,0,-side);
      if(/estate/.test(id))for(const x of [.18,.81])tower(x,-D*.67,W*.082,Y(.52),Y(.30));
    }else if(cottage){
      door(elf?.50:.58,.015*W,elf?.19:.17,H*.25);
      for(const x of [.29,.77])window(X(x),ground+.12*H,.015*W,W*.11,H*.17);
      // Projecting dormer on the thatch; elven cottage gets its tall central
      // lancet gable and leaf-carved verge from the reference instead.
      if(elf){gable(.29,.70,-D*.50,.035*W,eave,Y(.18));leaf(X(.50),eave+.015*H,.06*W,H*.16);}
      else{
        const y=eave+.095*H;box(.40,.59,y,y+.10*H,-D*.30,.015*W,wall);gable(.38,.61,-D*.32,.027*W,y+.10*H,y+.19*H,false);
        window(X(.495),y+.02*H,.035*W,W*.10,H*.10);
      }
      planter(.27,ground+.05*H,.075*W,.17);barrel(.88,.02*W);sideWindows(l,r,eave);
    }else{
      const mid=.50;door(mid,.014*W,guild?.19:.15,H*(guild?.30:.25));
      for(const x of [.28,.74])window(X(x),ground+.13*H,.014*W,W*.11,H*.17);
      if(elf||guild)gable(.29,.71,-D*.64,.03*W,eave,Y(elf?.20:.21));
      else{gable(.43,.58,-D*.43,.025*W,eave+.025*H,eave+.15*H,false);window(X(.505),eave+.04*H,.035*W,W*.06,H*.07);}
      if(id==='hall')banner(.24,ground+.17*H,.06*W,.14,H*.27,[.16,.34,.32,.72]);
      if(id==='storehouse'){barrel(.23,.055*W);barrel(.79,.07*W);}
      sideWindows(l,r,eave);planter(.73,ground+.06*H,.06*W,.16);
    }
    if(!elf||/manor/.test(id))chimney(twoStorey?.78:.75,-D*.70,Y(twoStorey?.14:.16),eave-.05*H);
    if(elf)for(const x of [l,r]){leaf(X(x),eave-.10*H,.025*W,H*.10);planter(x,ground+.045*H,.03*W,.10);}
  }
  return m.finish();
}
