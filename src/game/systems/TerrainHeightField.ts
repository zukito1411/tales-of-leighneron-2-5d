/** Simulation and GPU terrain use the same fixed lattice and triangle split.
 * This cache depends on world coordinates, never camera position or zoom. */
export const ELEVATION_CELL_SIZE=64;
const LIMIT=129*129*2;
export class TerrainHeightField {
  private readonly samples=new Map<number,number>();
  constructor(private readonly sample:(x:number,y:number)=>number=()=>0){}
  vertex(x:number,y:number){
    const key=x*1048576+y,old=this.samples.get(key);if(old!==undefined)return old;
    const height=Math.fround(this.sample(x*ELEVATION_CELL_SIZE,y*ELEVATION_CELL_SIZE));
    if(this.samples.size>=LIMIT)this.samples.delete(this.samples.keys().next().value!);
    this.samples.set(key,height);return height;
  }
  height(x:number,y:number){
    const gx=Math.floor(x/ELEVATION_CELL_SIZE),gy=Math.floor(y/ELEVATION_CELL_SIZE);
    const u=x/ELEVATION_CELL_SIZE-gx,v=y/ELEVATION_CELL_SIZE-gy;
    const a=this.vertex(gx,gy),b=this.vertex(gx+1,gy),c=this.vertex(gx,gy+1),d=this.vertex(gx+1,gy+1);
    return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
  }
  clear(){this.samples.clear();}
}
