import {BufferGeometry,Float32BufferAttribute} from 'three';

export type CombatEffectKind='slash'|'wave'|'impact'|'burst'|'aura'|'eruption'|'thrust'|'ward';
export interface CombatEffectShape {
  kind:CombatEffectKind;
  /** Simulation heading, independent of camera yaw and sprite rotation. */
  direction:Readonly<{x:number;y:number}>;
  /** Height above the terrain, or additional height at an attached grip. */
  height:number;
  /** Distance ahead of an attached hand, along the simulation heading. */
  advance?:number;
  /** Active-play seconds; the owning skill freezes this while menus pause. */
  time?:number;
}

/** Also used to register an attached painted tip against the real hand grip. */
export function combatEffectPoint(kind:CombatEffectKind,u:number,v:number,out:{x:number;y:number;z:number}){
  const x=u-.5,y=v-.5,radial=Math.max(0,1-4*(x*x+y*y));
  out.x=x;out.y=y;out.z=0;
  switch(kind){
    case 'slash':out.y=.16*y+.16*(1-4*y*y);out.z=y*.94;break;
    case 'wave':return waveBladePoint(v,u,1,out);
    case 'burst':out.y=.04*radial+.008;out.z=y;break;
    case 'aura':out.y=.065*Math.sqrt(radial);out.z=y;break;
    case 'eruption':out.x=x*.9;out.y=v*.82-.4;out.z=.27*Math.sin(x*Math.PI)+.13*v*v;break;
    case 'thrust':out.y=.12*Math.cos(y*Math.PI)+x*.12;out.z=y*.64;break;
    case 'ward':out.x=.4*Math.sqrt(radial);out.y=y*.9;out.z=x*.9;break;
    case 'impact':out.x=.22*radial+.08*Math.sin(y*Math.PI);out.y=y*.82;out.z=x*.82;break;
  }
  return out;
}

/** The existing painted animation supplies color and fine energy detail.
 * Traveling blades own their silhouette; other families use curved surfaces.
 * One immutable mesh per family/quality batch; animation uses atlas UVs and
 * active-play clock attributes, with no per-frame mesh or particle allocation.
 * Normalized bounds stay within the renderer's unit-box visibility envelope. */
export function createCombatEffectGeometry(kind:CombatEffectKind,low:boolean){
  if(kind==='wave')return createWaveBlade(low);
  if(kind==='burst')return createImpactCrown(low);
  if(kind==='eruption')return createEmberCrown(low);
  const columns=low?10:18,rows=low?8:14;
  const positions:number[]=[],uvs:number[]=[],indices:number[]=[],point={x:0,y:0,z:0};
  for(let row=0;row<=rows;row++)for(let column=0;column<=columns;column++){
    const u=column/columns,v=row/rows;combatEffectPoint(kind,u,v,point);
    positions.push(point.x,point.y,point.z);uvs.push(u,v);
  }
  for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
    const a=row*(columns+1)+column,b=a+1,c=a+columns+1,d=c+1;
    if(kind==='ward'||kind==='impact')indices.push(a,c,b,b,c,d);
    else indices.push(a,b,c,b,d,c);
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2));geometry.setIndex(indices);
  geometry.setAttribute('combatOpacity',new Float32BufferAttribute(new Float32Array(positions.length/3).fill(1),1));
  geometry.computeVertexNormals();return geometry;
}

/** +X is flight. The nose leads and BOTH tapered tips trail behind it across
 * +/-Z. The upper/lower bevels meet along the real crescent boundary. */
export function waveBladePoint(t:number,band:number,side:1|-1,out:{x:number;y:number;z:number}){
  const angle=(t-.5)*3.8,taper=Math.pow(Math.max(0,Math.sin(t*Math.PI)),.7),radius=.5-.16*taper*band;
  out.x=Math.cos(angle)*radius-.12-.04*band*taper;
  out.z=Math.sin(angle)*radius;
  out.y=out.z*.18+side*.065*Math.sin(band*Math.PI)*taper;
  return out;
}

/** Model the traveling blade itself. The approved painting is unwrapped onto
 * its beveled crescent and backward wisps; it no longer supplies a side-on card
 * silhouette. Geometry is shared by every cast and weapon palette. */
function createWaveBlade(low:boolean){
  const segments=low?20:32,bands=low?4:6,positions:number[]=[],uvs:number[]=[],opacity:number[]=[],styles:number[]=[],indices:number[]=[],point={x:0,y:0,z:0};
  for(const side of [1,-1] as const){
    const start=positions.length/3;
    for(let i=0;i<=segments;i++)for(let j=0;j<=bands;j++){
      const t=i/segments,band=j/bands,angle=(t-.5)*3.8,taper=Math.pow(Math.max(0,Math.sin(t*Math.PI)),.7);
      waveBladePoint(t,band,side,point);positions.push(point.x,point.y,point.z);
      // Sample the original curved bright edge, rather than mapping the whole
      // painted C (including its horizontal heading) across a forward plane.
      uvs.push(.4+(.48-.3*band*taper)*Math.cos(angle)-.08*band*taper,.5+(.47-.055*band*taper)*Math.sin(angle));
      opacity.push(Math.min(1,t*16,(1-t)*16));
      styles.push(t,band,0,0);
    }
    for(let i=0;i<segments;i++)for(let j=0;j<bands;j++){
      const a=start+i*(bands+1)+j,b=a+1,c=a+bands+1,d=c+1;
      if(side===1)indices.push(a,b,c,b,d,c);else indices.push(a,c,b,b,c,d);
    }
  }
  // Broad, softly feathered glow remains depth-tested, even with bloom off.
  const haloStart=positions.length/3,haloBands=4;
  for(let i=0;i<=segments;i++)for(let j=0;j<=haloBands;j++){
    const t=i/segments,b=j/haloBands,a=(t-.5)*3.8,taper=Math.pow(Math.max(0,Math.sin(t*Math.PI)),.7),r=.535-.29*taper*b;
    const z=Math.sin(a)*r;positions.push(Math.cos(a)*r-.12-.04*b*taper,z*.18-.012,z);
    uvs.push(.48,.5);opacity.push(Math.min(1,t*12,(1-t)*12));styles.push(t,b,1,0);
  }
  for(let i=0;i<segments;i++)for(let j=0;j<haloBands;j++){
    const a=haloStart+i*(haloBands+1)+j,b=a+1,c=a+haloBands+1,d=c+1;
    indices.push(a,b,c,b,d,c);
  }
  // Unequal, curved filaments replace the evenly spaced three-prong trail.
  const offsets=low?[-.31,-.07,.18,.34]:[-.36,-.24,-.11,.035,.16,.27,.37];
  for(const [n,offset] of offsets.entries()){
    const start=positions.length/3,steps=low?6:10;
    const seed=(n*.61803398875)%1,angle=Math.asin(offset*2),head=Math.cos(angle)*.41-.14,length=Math.min(head+.48,.37+seed*.3);
    for(let i=0;i<=steps;i++)for(let edge=0;edge<3;edge++){
      const t=i/steps,width=(1-t)*(.025+seed*.035),s=edge-1,z=offset+Math.sin(t*5+seed*4)*.028+s*width;
      positions.push(head-t*length,z*.18+Math.sin(t*4+seed*7)*.045,z);
      uvs.push(.7-t*.5,.5+offset*.65+s*.035);opacity.push(1);styles.push(t,edge/2,2,seed);
    }
    for(let i=0;i<steps;i++)for(let edge=0;edge<2;edge++){
      const a=start+i*3+edge,b=a+1,c=a+3,d=a+4;
      indices.push(a,c,b,b,c,d);
    }
  }
  // Faint successive arcs make a coherent wake behind the leading edge.
  for(let layer=1;layer<=2;layer++){
    const start=positions.length/3,echoBands=3,scale=1-layer*.08;
    for(let i=0;i<=segments;i++)for(let j=0;j<=echoBands;j++){
      const t=i/segments,b=j/echoBands;waveBladePoint(t,b,1,point);
      positions.push(point.x*scale-layer*.085,point.y-layer*.018,point.z*scale);
      uvs.push(.48,.5);opacity.push((layer===1?.3:.18)*Math.min(1,t*12,(1-t)*12));styles.push(t,b,4,layer);
    }
    for(let i=0;i<segments;i++)for(let j=0;j<echoBands;j++){
      const a=start+i*(echoBands+1)+j,b=a+1,c=a+echoBands+1,d=c+1;indices.push(a,b,c,b,d,c);
    }
  }
  // A bounded set of small 3D star flares shares the same mesh and lifetime.
  for(let n=0;n<(low?9:18);n++){
    const seed=(n*.61803398875+.13)%1,x=-.32+((n*.754877666)%1)*.58,z=-.46+((n*.56984029)%1)*.92;
    const y=z*.18+(((n*.41421356)%1)-.5)*.22,size=.009+seed*.012;
    for(let plane=0;plane<3;plane++){
      const start=positions.length/3;
      for(const [u,v] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
        positions.push(x+(plane===0?0:u*size),y+(plane===2?0:v*size),z+(plane===0?u*size:plane===2?v*size:0));
        uvs.push(.48,.5);opacity.push(.85);styles.push(u,v,3,seed);
      }
      indices.push(start,start+1,start+2,start+1,start+3,start+2);
    }
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2));geometry.setAttribute('combatOpacity',new Float32BufferAttribute(opacity,1));
  geometry.setAttribute('waveStyle',new Float32BufferAttribute(styles,4));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.userData.energyWave=true;return geometry;
}

/** A stationary trap surrounds its ground anchor. Three painted sectors form
 * a continuous curved flame crown, readable from front, rear and either side. */
function createEmberCrown(low:boolean){
  const columns=low?8:12,rows=low?6:10,positions:number[]=[],uvs:number[]=[],opacity:number[]=[],indices:number[]=[];
  for(let sector=0;sector<3;sector++){
    const start=positions.length/3;
    for(let row=0;row<=rows;row++)for(let column=0;column<=columns;column++){
      const u=column/columns,v=row/rows,angle=(sector+u)/3*Math.PI*2;
      const radius=.24+.1*Math.sin(v*Math.PI)-v*.12;
      positions.push(Math.cos(angle)*radius,v*.82-.4,Math.sin(angle)*radius);
      uvs.push(u,v);opacity.push(Math.min(1,u*12,(1-u)*12));
    }
    for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
      const a=start+row*(columns+1)+column,b=a+1,c=a+columns+1,d=c+1;indices.push(a,b,c,b,d,c);
    }
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2));
  geometry.setAttribute('combatOpacity',new Float32BufferAttribute(opacity,1));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

/** Recover the circular floor ring from its painted ellipse. Its airborne
 * crown has a separate bowed surface, avoiding a folded rectangular backplate.
 * Both remain one instanced draw using the original animated atlas. */
function createImpactCrown(low:boolean){
  const sides=low?24:40,rings=low?5:8,positions:number[]=[],uvs:number[]=[],opacity:number[]=[],indices:number[]=[];
  for(let ring=0;ring<=rings;ring++)for(let side=0;side<=sides;side++){
    const r=ring/rings,a=side/sides*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
    positions.push(c*r*.5,.008+.025*(1-r*r),s*r*.5);
    // The source ring center is measured at 50% across / 66.5% down.
    uvs.push(.5+c*r*.49,.335+s*r*.2);opacity.push(Math.min(1,(1-r)*8));
  }
  for(let ring=0;ring<rings;ring++)for(let side=0;side<sides;side++){
    const a=ring*(sides+1)+side,b=a+1,c=a+sides+1,d=c+1;indices.push(a,c,b,b,c,d);
  }
  const start=positions.length/3,columns=low?12:20,rows=low?5:8;
  for(let row=0;row<=rows;row++)for(let column=0;column<=columns;column++){
    const u=column/columns,v=row/rows,angle=(u-.5)*Math.PI;
    positions.push(Math.sin(angle)*.48,v*.42,-Math.cos(angle)*.32);
    uvs.push(u,.49+v*.51);opacity.push(Math.min(1,u*10,(1-u)*10,v*8,(1-v)*10));
  }
  for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
    const a=start+row*(columns+1)+column,b=a+1,c=a+columns+1,d=c+1;indices.push(a,b,c,b,d,c);
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2));
  geometry.setAttribute('combatOpacity',new Float32BufferAttribute(opacity,1));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
