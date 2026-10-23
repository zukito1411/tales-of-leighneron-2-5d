import { CHUNK_SIZE, STREAM_RADIUS, WORLD_CHUNKS_HEIGHT, WORLD_CHUNKS_WIDTH } from '../../data/world';

export const contentChunkKey = (x: number, y: number) => `${Math.floor(x / CHUNK_SIZE)}:${Math.floor(y / CHUNK_SIZE)}`;
export interface StreamView {left:number;right:number;top:number;bottom:number;key?:string;containsChunk?:(x:number,y:number,margin:number)=>boolean}
/** Camera coverage is not restricted to the player's fixed neighborhood. */
export function viewportChunks(view:StreamView,margin=0){
  const keys=new Set<string>();
  const left=Math.max(0,Math.floor((view.left-margin)/CHUNK_SIZE));
  const right=Math.min(WORLD_CHUNKS_WIDTH-1,Math.floor((view.right+margin)/CHUNK_SIZE));
  const top=Math.max(0,Math.floor((view.top-margin)/CHUNK_SIZE));
  const bottom=Math.min(WORLD_CHUNKS_HEIGHT-1,Math.floor((view.bottom+margin)/CHUNK_SIZE));
  for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)if(!view.containsChunk||view.containsChunk(x,y,margin))keys.add(`${x}:${y}`);
  return keys;
}
/** Collision safety stays local even when the free camera looks away. */
export function nearbyPhysicsChunks(x:number,y:number){return viewportChunks({left:x-384,right:x+384,top:y-384,bottom:y+384});}
export const streamViewKey=(keys:ReadonlySet<string>)=>[...keys].join('|');
export function chunkNeighborhood(x: number, y: number) {
  const keys = new Set<string>();
  const cx = Math.floor(x / CHUNK_SIZE), cy = Math.floor(y / CHUNK_SIZE);
  for (let dy = -STREAM_RADIUS; dy <= STREAM_RADIUS; dy++) {
    for (let dx = -STREAM_RADIUS; dx <= STREAM_RADIUS; dx++) {
      const px = cx + dx, py = cy + dy;
      if (px >= 0 && py >= 0 && px < WORLD_CHUNKS_WIDTH && py < WORLD_CHUNKS_HEIGHT) keys.add(`${px}:${py}`);
    }
  }
  return keys;
}
