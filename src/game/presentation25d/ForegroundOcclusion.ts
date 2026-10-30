import {Box3,Matrix4,Ray,Vector3,type BufferGeometry,type Camera} from 'three';
import {HERO_BODY_HEIGHT} from '../../data/heroBodyRegistration';

interface ScreenBounds {left:number;right:number;top:number;bottom:number;depth:number}
interface Subject {x:number;y:number;presentationElevation?:number}
interface TriangleBlocks {triangles:Uint32Array;bounds:Float64Array}
const BLOCK_SIZE=32;
export const FOREGROUND_OPACITY=.28;

/** Camera visibility only. Reuses submitted geometry; never queries physics,
 * scans pixels, loads assets or searches outside the existing render traversal. */
export class ForegroundOcclusion {
  private enabled=false;
  private readonly targets=[new Vector3(),new Vector3(),new Vector3()];
  private readonly screen=[new Vector3(),new Vector3(),new Vector3()];
  private readonly cameraPosition=new Vector3();
  private readonly inverse=new Matrix4();
  private readonly ray=new Ray();
  private readonly endpoint=new Vector3();
  private readonly a=new Vector3();private readonly b=new Vector3();private readonly c=new Vector3();
  private readonly hit=new Vector3();private readonly box=new Box3();
  private blocks=new WeakMap<BufferGeometry,TriangleBlocks>();

  begin(camera:Camera,subject:Subject|undefined,ground:number,leanCos:number,leanSin:number,yawCos:number,yawSin:number){
    this.enabled=false;if(!subject)return;
    const floor=ground+(subject.presentationElevation??0);
    this.cameraPosition.setFromMatrixPosition(camera.matrixWorld);
    let onScreen=0;
    for(let i=0;i<3;i++){
      const height=HERO_BODY_HEIGHT*(.25+i*.30),p=this.targets[i];
      p.set(subject.x-height*leanSin*yawSin,floor+height*leanCos,subject.y-height*leanSin*yawCos);
      const s=this.screen[i].copy(p).project(camera);
      if(s.z>=-1&&s.z<=1&&s.x>=-1&&s.x<=1&&s.y>=-1&&s.y<=1)onScreen++;
    }
    this.enabled=onScreen>=2;
  }

  /** A roof corner beside the player, or a low prop covering only their feet,
   * cannot trigger transparency. Model depth is checked by the exact rays. */
  private covers(bounds:ScreenBounds,checkDepth=false){
    if(!this.enabled)return false;
    let covered=0;
    for(const p of this.screen)if(p.x>bounds.left&&p.x<bounds.right&&p.y>bounds.top&&p.y<bounds.bottom
      &&(!checkDepth||bounds.depth<p.z-.00001))covered++;
    return covered>=2;
  }
  billboardBlocked(bounds:ScreenBounds){return this.covers(bounds,true);}

  modelBlocked(geometry:BufferGeometry,matrix:Matrix4,bounds:ScreenBounds){
    if(!this.covers(bounds))return false;
    let blocks=this.blocks.get(geometry);
    if(!blocks){blocks=this.prepare(geometry);this.blocks.set(geometry,blocks);}
    if(!blocks.triangles.length||Math.abs(matrix.determinant())<1e-12)return false;
    this.inverse.copy(matrix).invert();
    let blocked=0;
    for(const target of this.targets){
      this.endpoint.copy(target).applyMatrix4(this.inverse);
      this.ray.origin.copy(this.cameraPosition).applyMatrix4(this.inverse);
      const distance=this.ray.origin.distanceTo(this.endpoint);
      const worldDistance=this.cameraPosition.distanceTo(target);
      // Ignore surfaces at the subject's own depth, including the floor/deck
      // beneath their feet. The bias remains six world units at every scale.
      const limit=distance*(1-6/Math.max(6,worldDistance));
      if(limit<=0)continue;
      this.ray.direction.subVectors(this.endpoint,this.ray.origin).normalize();
      if(this.intersects(geometry,blocks,limit*limit))blocked++;
      if(blocked>=2)return true;
    }
    return false;
  }

  private prepare(geometry:BufferGeometry):TriangleBlocks {
    const positions=geometry.getAttribute('position'),surface=geometry.getAttribute('surfaceRect');
    const index=geometry.index,count=Math.floor((index?.count??positions.count)/3);
    const triangles=new Uint32Array(count);let used=0;
    for(let triangle=0;triangle<count;triangle++){
      const vertex=index?index.getX(triangle*3):triangle*3;
      // Painted cutout decorations (leaves, fire, crest fringes) are not solid
      // walls. The opaque modeled surfaces behind them decide visibility.
      if(surface){const w=surface.getW(vertex),z=surface.getZ(vertex);
        if(w===0&&z===0||w< -18.5&&w> -19.5)continue;}
      triangles[used++]=triangle*3;
    }
    const bounds=new Float64Array(Math.ceil(used/BLOCK_SIZE)*6);
    for(let block=0;block<bounds.length/6;block++){
      this.box.makeEmpty();
      for(let i=block*BLOCK_SIZE;i<Math.min(used,(block+1)*BLOCK_SIZE);i++)for(let corner=0;corner<3;corner++){
        const vertex=index?index.getX(triangles[i]+corner):triangles[i]+corner;
        this.a.fromBufferAttribute(positions,vertex);this.box.expandByPoint(this.a);
      }
      const offset=block*6;
      bounds[offset]=this.box.min.x;bounds[offset+1]=this.box.min.y;bounds[offset+2]=this.box.min.z;
      bounds[offset+3]=this.box.max.x;bounds[offset+4]=this.box.max.y;bounds[offset+5]=this.box.max.z;
    }
    return {triangles:triangles.subarray(0,used),bounds};
  }

  private intersects(geometry:BufferGeometry,blocks:TriangleBlocks,limitSquared:number){
    const positions=geometry.getAttribute('position'),index=geometry.index;
    for(let offset=0;offset<blocks.bounds.length;offset+=6){
      const bounds=blocks.bounds;
      this.box.min.set(bounds[offset],bounds[offset+1],bounds[offset+2]);
      this.box.max.set(bounds[offset+3],bounds[offset+4],bounds[offset+5]);
      if(!this.ray.intersectBox(this.box,this.hit))continue;
      if(!this.box.containsPoint(this.ray.origin)&&this.hit.distanceToSquared(this.ray.origin)>=limitSquared)continue;
      const start=offset/6*BLOCK_SIZE,end=Math.min(blocks.triangles.length,start+BLOCK_SIZE);
      for(let i=start;i<end;i++){
        const triangle=blocks.triangles[i];
        this.a.fromBufferAttribute(positions,index?index.getX(triangle):triangle);
        this.b.fromBufferAttribute(positions,index?index.getX(triangle+1):triangle+1);
        this.c.fromBufferAttribute(positions,index?index.getX(triangle+2):triangle+2);
        if(this.ray.intersectTriangle(this.a,this.b,this.c,false,this.hit)&&this.hit.distanceToSquared(this.ray.origin)<limitSquared)return true;
      }
    }
    return false;
  }
  clear(){this.enabled=false;this.blocks=new WeakMap();}
}
