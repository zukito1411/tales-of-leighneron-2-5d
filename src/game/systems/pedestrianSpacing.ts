import type {Vec2} from '../types';

/** A transient crowd obstacle, never a static navigation-cache entry. */
export interface PedestrianObstacle extends Vec2 {radius:number}

/** Reject approaches through a person's space, but allow an already
 * overlapping actor to walk out. No normalization, allocation or physics write. */
export function pedestrianBlocksSegment(from:Vec2,to:Vec2,person:Vec2,radius=43){
  const dx=to.x-from.x,dy=to.y-from.y,length2=dx*dx+dy*dy;
  if(length2<.0001)return false;
  const vx=person.x-from.x,vy=person.y-from.y,start2=vx*vx+vy*vy,dot=vx*dx+vy*dy;
  const end2=(person.x-to.x)**2+(person.y-to.y)**2;
  // In particular, coincident feet can separate rather than being ignored
  // altogether or rejected on every possible escape path.
  if(start2<radius*radius&&dot<=0&&end2>start2+.01)return false;
  const t=Math.max(0,Math.min(1,dot/length2));
  return (vx-dx*t)**2+(vy-dy*t)**2<radius*radius&&(t>0||start2<radius*radius);
}
