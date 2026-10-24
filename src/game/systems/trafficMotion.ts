/** Shared direction selector for coastal boat artwork. */
export function trafficDirection(dx:number,dy:number){return Math.abs(dx)>Math.abs(dy)*1.15?(dx<0?1:2):(dy<0?3:0);}
