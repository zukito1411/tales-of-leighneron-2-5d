import type Phaser from 'phaser';

/** Read the displayed framebuffer at POST_RENDER, before the browser clears it.
 * Phaser's compatibility canvas is deliberately hidden in the 2.5D edition. */
export function presentedPixel(game:Phaser.Game,x:number,y:number):Promise<{red:number;green:number;blue:number;alpha:number}>{
  const canvas=document.querySelector<HTMLCanvasElement>('.three-world-canvas');
  if(!canvas)throw new Error('The visible 2.5D renderer is missing');
  return new Promise((resolve,reject)=>{
    const timeout=window.setTimeout(()=>{game.events.off('postrender',read);reject(new Error('No presented frame arrived'));},10000);
    const read=()=>{
      window.clearTimeout(timeout);
      const gl=canvas.getContext('webgl2');
      if(!gl){reject(new Error('The presented WebGL 2 context is unavailable'));return;}
      const pixel=new Uint8Array(4);
      gl.readPixels(Math.floor(x*canvas.width/game.scale.width),canvas.height-1-Math.floor(y*canvas.height/game.scale.height),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
      resolve({red:pixel[0],green:pixel[1],blue:pixel[2],alpha:pixel[3]});
    };
    game.events.once('postrender',read);
  });
}
