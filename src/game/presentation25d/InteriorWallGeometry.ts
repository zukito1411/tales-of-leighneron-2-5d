import {ModelMesh,masonry,paintedMaterial,type Patch} from './ModelMesh';

export interface InteriorWallPanel {uv:Patch;kit:string}

/** A complete solid panel, with the original prepared wall artwork on both
 * elevations. Transparent frame gutters reveal masonry, never the black void.
 * World span/height/thickness belong to its instance, not sprite padding. */
export function createInteriorWallGeometry(panel:InteriorWallPanel){
  const m=new ModelMesh({left:0,top:0,width:1,height:1});
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
