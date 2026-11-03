import {HERO_BODY_HEIGHT} from './heroBodyRegistration';

/** Cart-scale stable loading portal. World dimensions describe the clear
 * opening; frame ratios are shared by the interior mesh and foot solver. */
export const STABLE_ENTRANCE={
  width:HERO_BODY_HEIGHT*3.6,height:HERO_BODY_HEIGHT*2.4,aisleWidth:HERO_BODY_HEIGHT*4.8,
  facadeWidth:.50,facadeHeight:.46,
  clearRatio:.76,outerHalf:.42,clearHeightRatio:.91,frameDepth:.42,
} as const;

/** Narrow timber rails use the same ground depth in rendering and collision. */
export const STABLE_RAIL_DEPTH=.065;
export const STABLE_HAY_DEPTH=.62;
