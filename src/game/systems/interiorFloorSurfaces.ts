import type {RoomFloor} from '../../data/interiors';

/** Navigation uses overlapping connected rectangles; rendering must not put
 * two different floor paintings on exactly the same depth. Prepare a disjoint
 * cover once per room load. Later authored floor materials retain priority. */
export function interiorFloorSurfaces(floors:readonly RoomFloor[]):RoomFloor[]{
  const surfaces:RoomFloor[]=[];
  for(let index=floors.length-1;index>=0;index--){
    let pieces=[{...floors[index]}];
    for(const cover of surfaces){
      const next:RoomFloor[]=[];
      for(const p of pieces){
        const l=Math.max(p.x,cover.x),r=Math.min(p.x+p.width,cover.x+cover.width);
        const t=Math.max(p.y,cover.y),b=Math.min(p.y+p.height,cover.y+cover.height);
        if(l>=r||t>=b){next.push(p);continue;}
        if(t>p.y)next.push({...p,height:t-p.y});
        if(b<p.y+p.height)next.push({...p,y:b,height:p.y+p.height-b});
        if(l>p.x)next.push({...p,y:t,width:l-p.x,height:b-t});
        if(r<p.x+p.width)next.push({...p,x:r,y:t,width:p.x+p.width-r,height:b-t});
      }
      pieces=next;if(!pieces.length)break;
    }
    surfaces.push(...pieces);
  }
  return surfaces;
}
