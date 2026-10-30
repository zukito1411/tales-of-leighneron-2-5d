import type {Vec2} from '../game/types';

/** Primary boards stand beside the public crossing, with room to read them.
 * These reservations precede houses, dressing and optional commons. */
export const CIVIC_BOARD_SITES:Readonly<Record<string,Vec2>>={oakmere:{x:-110,y:235},highmere:{x:190,y:220}};
export function civicBoardReserve(townId:string){
  const p=CIVIC_BOARD_SITES[townId];if(!p)return;
  return {left:p.x-70,right:p.x+70,top:p.y-130,bottom:p.y+100};
}
