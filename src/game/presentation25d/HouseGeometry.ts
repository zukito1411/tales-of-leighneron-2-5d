import {BufferGeometry,Float32BufferAttribute} from 'three';
import type Phaser from 'phaser';
import {ART_BY_KEY,type ArtTextureKey} from '../../data/art';
import {worldSpriteProfile} from '../../data/worldSpriteGeometry';

type Point=readonly [number,number];
type Patch=readonly [number,number,number,number];
interface HouseProfile {id:string;roof:readonly Point[];wall:Patch;tiles:Patch}
export interface HouseShape {profile:HouseProfile;left:number;top:number;width:number;height:number;depth:number}
// Roof silhouettes and opaque material patches are relative to the inspected
// original illustration. Gates, towers, ruins and shrines remain billboards.
const house=(id:string,roof:readonly Point[],wall:Patch,tiles:Patch):HouseProfile=>({id,roof,wall,tiles});
const profiles:Partial<Record<ArtTextureKey,Readonly<Record<number,HouseProfile>>>>={
  world_objects:{
    0:house('old-cottage',[[.07,.57],[.22,.09],[.64,.08],[.89,.55]],[.53,.60,.60,.83],[.29,.15,.52,.30]),
    1:house('old-inn',[[.07,.42],[.18,.09],[.68,.09],[.87,.40]],[.32,.53,.42,.65],[.24,.15,.39,.25]),
  },
  world_buildings:{
    0:house('cottage',[[.06,.54],[.19,.12],[.64,.14],[.88,.52]],[.48,.70,.54,.87],[.28,.18,.44,.30]),
    1:house('inn',[[.08,.48],[.18,.21],[.36,.21],[.50,.02],[.67,.21],[.89,.48]],[.38,.58,.49,.67],[.17,.27,.29,.40]),
    2:house('smithy',[[.06,.53],[.29,.18],[.71,.20],[.92,.53]],[.43,.57,.51,.70],[.39,.24,.63,.42]),
  },
  capital_buildings:{
    0:house('hall',[[.07,.46],[.15,.10],[.72,.10],[.83,.46]],[.57,.58,.64,.79],[.33,.16,.52,.29]),
    1:house('manor',[[.08,.49],[.21,.09],[.73,.12],[.92,.49]],[.52,.59,.60,.72],[.25,.19,.36,.32]),
    4:house('chapel',[[.16,.55],[.48,.22],[.80,.56]],[.20,.64,.29,.81],[.27,.49,.37,.56]),
    5:house('capital-smithy',[[.07,.52],[.26,.17],[.68,.17],[.90,.51]],[.49,.55,.57,.65],[.28,.22,.53,.39]),
    6:house('stable',[[.08,.45],[.25,.09],[.77,.10],[.92,.45]],[.16,.54,.23,.75],[.28,.17,.44,.30]),
    7:house('storehouse',[[.08,.47],[.37,.12],[.70,.44],[.83,.47]],[.27,.53,.38,.64],[.23,.33,.33,.43]),
  },
  elven_villas:{
    0:house('elven-cottage',[[.06,.57],[.25,.41],[.48,.12],[.75,.43],[.91,.55]],[.55,.67,.64,.81],[.28,.37,.42,.46]),
    1:house('elven-manor',[[.08,.49],[.29,.32],[.51,.13],[.72,.35],[.92,.48]],[.24,.53,.33,.64],[.28,.33,.38,.43]),
    4:house('elven-chapel',[[.15,.60],[.35,.35],[.49,.11],[.66,.36],[.86,.59]],[.20,.63,.29,.79],[.23,.48,.33,.58]),
    5:house('elven-smithy',[[.05,.52],[.30,.17],[.51,.29],[.72,.28],[.91,.51]],[.28,.58,.36,.71],[.32,.30,.47,.44]),
    6:house('elven-stable',[[.05,.40],[.30,.17],[.47,.05],[.70,.24],[.94,.41]],[.44,.55,.50,.73],[.18,.28,.31,.38]),
    7:house('elven-guildhall',[[.07,.48],[.30,.23],[.50,.13],[.78,.42],[.94,.48]],[.42,.60,.49,.79],[.30,.33,.44,.43]),
    8:house('elven-estate',[[.07,.59],[.24,.36],[.38,.16],[.61,.16],[.77,.37],[.94,.59]],[.27,.58,.34,.71],[.29,.30,.39,.42]),
  },
};

export function houseShape(texture:ArtTextureKey,frame:Phaser.Textures.Frame,index:number):HouseShape|undefined {
  const profile=profiles[texture]?.[index];if(!profile)return;
  const metadata=frame.customData as {visibleBounds?:{left:number;top:number;width:number;height:number}}|undefined;
  const bounds=metadata?.visibleBounds;if(!bounds)return;
  const density=ART_BY_KEY[texture].density;
  const foundation=worldSpriteProfile(texture,index)!.solids.flat();
  const depth=Math.max(...foundation.map(p=>p[1]))-Math.min(...foundation.map(p=>p[1]));
  return {profile,left:bounds.left*density/frame.cutWidth,top:bounds.top*density/frame.cutHeight,
    width:bounds.width*density/frame.cutWidth,height:bounds.height*density/frame.cutHeight,
    depth:bounds.height*density*depth/frame.cutWidth};
}

/** One low-poly, closed roof/wall volume per source house style. The complete
 * front artwork retains its original silhouette, doors and source registration.
 * Side/back walls and pitched roof surfaces reuse opaque source material UVs.
 * No new canvases, image decodes or textures are needed. */
export function createHouseGeometry(shape:HouseShape){
  const positions:number[]=[],uvs:number[]=[];
  const {profile,left,top,width,height,depth}=shape;
  const point=(x:number,y:number,z:number):readonly [number,number,number]=>[left+x*width-.5,.5-top-y*height,z];
  const uv=(x:number,y:number):Point=>[left+x*width,1-top-y*height];
  const tri=(a:readonly number[],b:readonly number[],c:readonly number[],ta:Point,tb:Point,tc:Point)=>{
    positions.push(...a,...b,...c);uvs.push(...ta,...tb,...tc);
  };
  const quad=(a:readonly number[],b:readonly number[],c:readonly number[],d:readonly number[],patch:Patch)=>{
    const [l,t,r,bottom]=patch,ta=uv(l,bottom),tb=uv(r,bottom),tc=uv(l,t),td=uv(r,t);
    tri(a,b,c,ta,tb,tc);tri(b,d,c,tb,td,tc);
  };
  // Front artwork is not flattened onto a roof or split into substitute parts.
  tri([-.5,-.5,0],[.5,-.5,0],[-.5,.5,0],[0,0],[1,0],[0,1]);
  tri([.5,-.5,0],[.5,.5,0],[-.5,.5,0],[1,0],[1,1],[0,1]);
  const roof=profile.roof,first=roof[0],last=roof[roof.length-1],base=.96;
  quad(point(first[0],base,-depth),point(first[0],base,0),point(first[0],first[1],-depth),point(first[0],first[1],0),profile.wall);
  quad(point(last[0],base,0),point(last[0],base,-depth),point(last[0],last[1],0),point(last[0],last[1],-depth),profile.wall);
  const rearCenter=point((first[0]+last[0])/2,base,-depth);
  const rearUV=uv((profile.wall[0]+profile.wall[2])/2,profile.wall[3]);
  for(let i=1;i<roof.length;i++){
    const a=roof[i-1],b=roof[i];
    quad(point(a[0],a[1],0),point(b[0],b[1],0),point(a[0],a[1],-depth),point(b[0],b[1],-depth),profile.tiles);
    const at=(x:number):Point=>uv(profile.wall[0]+(profile.wall[2]-profile.wall[0])*(x-first[0])/(last[0]-first[0]),profile.wall[1]);
    tri(rearCenter,point(a[0],a[1],-depth),point(b[0],b[1],-depth),rearUV,at(a[0]),at(b[0]));
  }
  tri(rearCenter,point(first[0],first[1],-depth),point(first[0],base,-depth),rearUV,uv(profile.wall[0],profile.wall[1]),uv(profile.wall[0],profile.wall[3]));
  tri(rearCenter,point(last[0],base,-depth),point(last[0],last[1],-depth),rearUV,uv(profile.wall[2],profile.wall[3]),uv(profile.wall[2],profile.wall[1]));
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();
  return geometry;
}
