import {memo,useLayoutEffect,useRef} from 'react';
import type {MapService} from '../data/mapServices';
import {mapServiceIcon} from './mapServiceDrawing';

/** The regional survey paints the exact cached badge used by the minimap. */
export const MapServiceBadge=memo(function MapServiceBadge({service}:{service:MapService}){
 const canvas=useRef<HTMLCanvasElement>(null);
 useLayoutEffect(()=>{
  const ctx=canvas.current?.getContext('2d');if(!ctx)return;
  ctx.clearRect(0,0,18,18);ctx.drawImage(mapServiceIcon(service),0,0);
 },[service]);
 return <canvas ref={canvas} width={18} height={18} className="regional-service-icon" aria-hidden="true"/>;
});
