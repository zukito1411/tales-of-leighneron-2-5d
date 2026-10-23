export type PaintCanvas=HTMLCanvasElement|OffscreenCanvas;
export type PaintContext=CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D;
export function paintCanvas(width:number,height=width):PaintCanvas{
  if(typeof document==='undefined')return new OffscreenCanvas(width,height);
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;return canvas;
}
export function paintContext(canvas:PaintCanvas):PaintContext{
  const context=canvas.getContext('2d');if(!context)throw new Error('Terrain painting context unavailable');
  return context as PaintContext;
}
