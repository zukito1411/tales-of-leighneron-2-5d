import {ModelMesh,masonry,paintedMaterial,atlasMaterial,type Patch} from './ModelMesh';

export interface InteriorWallPanel {uv:Patch;kit:string;style?:'stable'}

/** A complete solid panel, with the original prepared wall artwork on both
 * elevations. Transparent frame gutters reveal masonry, never the black void.
 * World span/height/thickness belong to its instance, not sprite padding. */
export function createInteriorWallGeometry(panel:InteriorWallPanel){
  const m=new ModelMesh({left:0,top:0,width:1,height:1});
  if(panel.style==='stable'){
    const boards=atlasMaterial('architecture',1,.45,.9),posts=atlasMaterial('furnishings',2,.20,.85);
    m.box(-.5,.5,-.51,-.33,-.5,.5,masonry(panel.kit));
    m.box(-.5,.5,-.33,.49,-.48,.48,boards);
    for(const x of [-.47,.44])m.box(x,x+.03,-.33,.51,-.53,.53,posts);
    for(const y of [-.33,.42])m.box(-.5,.5,y,y+.045,-.53,.53,posts);
    return m.finish();
  }
  const [l,t,r,b]=panel.uv,w=r-l,h=b-t;
  const cap=paintedMaterial([l+w*.16,t+h*.025,r-w*.16,t+h*.15],.85,.28);
  // Put the underside below the floor and the art far enough in front of
  // its backing for mobile depth precision at large world coordinates.
  m.softBox(-.5,.5,-.51,.49,-.5,.5,masonry(panel.kit),.015);
  // The source wall's finished coping/header covers its top. Repeating a
  // masonry swatch over the cut edge made every corridor look like bare blocks.
  m.softBox(-.505,.505,.46,.515,-.53,.53,cap,.012);
  m.cutout([-.5,-.5,.52],[.5,-.5,.52],[-.5,.5,.52],[.5,.5,.52],panel.uv);
  m.cutout([.5,-.5,-.52],[-.5,-.5,-.52],[.5,.5,-.52],[-.5,.5,-.52],panel.uv);
  m.cutout([-.51,-.5,-.5],[-.51,-.5,.5],[-.51,.49,-.5],[-.51,.49,.5],[l,t,l+w*.14,b]);
  m.cutout([.51,-.5,.5],[.51,-.5,-.5],[.51,.49,.5],[.51,.49,-.5],[r-w*.14,t,r,b]);
  return m.finish();
}
