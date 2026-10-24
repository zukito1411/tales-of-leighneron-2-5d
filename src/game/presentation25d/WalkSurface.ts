import {onHighmereBridge,onWildernessBridge} from '../../data/rivers';
import {onPortDeck} from '../../data/ports';
import {onFlagshipBoarding} from '../../data/pirateFlagship';

export const BRIDGE_DECK_HEIGHT=8;
export const SHIP_DECK_HEIGHT=0;
/** Exact authored XY footprints, independent of the coarse terrain height grid.
 * Keep collision/navigation in their original owners. This is presentation only. */
export function walkSurfaceHeight(x:number,y:number):number|undefined {
  if(onFlagshipBoarding(x,y))return SHIP_DECK_HEIGHT;
  if(onPortDeck(x,y)||onHighmereBridge(x,y)||onWildernessBridge(x,y))return BRIDGE_DECK_HEIGHT;
  return undefined;
}
