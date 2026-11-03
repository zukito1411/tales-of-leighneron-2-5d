import {Box3,Matrix4,Ray,Vector3,type BufferGeometry,type Camera} from 'three';
import {HERO_BODY_HEIGHT} from '../../data/heroBodyRegistration';

interface ScreenBounds {left:number;right:number;top:number;bottom:number;depth:number}
interface Subject {x:number;y:number;presentationElevation?:number}
interface TriangleBlocks {triangles:Uint32Array;bounds:Float64Array}
const BLOCK_SIZE=32;
const EMPTY_BLOCKS:TriangleBlocks={triangles:new Uint32Array(),bounds:new Float64Array()};
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
  private readonly pending=new Map<BufferGeometry,{steps:Generator<void,TriangleBlocks,void>;dispose:()=>void}>();
  warm(geometry:BufferGeometry){
    const retained=geometry.userData.foregroundBlocks as TriangleBlocks|undefined;
    if(retained){this.blocks.set(geometry,retained);return;}
    if(this.blocks.has(geometry)||this.pending.has(geometry))return;
    const dispose=()=>{const job=this.pending.get(geometry);this.pending.delete(geometry);job?.steps.return(EMPTY_BLOCKS);this.blocks.delete(geometry);geometry.removeEventListener('dispose',dispose);};
    this.pending.set(geometry,{steps:this.prepareSteps(geometry),dispose});geometry.addEventListener('dispose',dispose);
  }
  preload(milliseconds:number){
    if(!this.enabled||milliseconds<=0)return;
    const deadline=performance.now()+milliseconds;
    for(let count=0;this.pending.size&&count<128&&performance.now()<deadline;count++){
      const [geometry,job]=this.pending.entries().next().value!;this.pending.delete(geometry);
      const next=job.steps.next();
      if(next.done){this.blocks.set(geometry,next.value);geometry.userData.foregroundBlocks=next.value;geometry.removeEventListener('dispose',job.dispose);}
      else this.pending.set(geometry,job);
    }
  }

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
    if(!this.enabled)return false;
    this.warm(geometry);
    if(!this.covers(bounds))return false;
    const blocks=this.blocks.get(geometry);
    // Never drain a preparation generator from the render traversal. A mode
    // switch can expose many detailed models in the same frame. Until their
    // exact blocks are ready, use the existing screen/depth overlap to keep
    // the character visible; preload() alone advances the bounded jobs.
    if(!blocks)return this.covers(bounds,true);
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

  private *prepareSteps(geometry:BufferGeometry):Generator<void,TriangleBlocks,void> {
    const positions=geometry.getAttribute('position'),surface=geometry.getAttribute('surfaceRect');
    const index=geometry.index,count=Math.floor((index?.count??positions.count)/3);
    const triangles=new Uint32Array(count);let used=0;
    for(let triangle=0;triangle<count;triangle++){
      if((triangle&31)===31)yield;
      const vertex=index?index.getX(triangle*3):triangle*3;
      // Painted cutout decorations (leaves, fire, crest fringes) are not solid
      // walls. The opaque modeled surfaces behind them decide visibility.
      if(surface){const w=surface.getW(vertex),z=surface.getZ(vertex);
        if(w===0&&z===0||w< -18.5&&w> -19.5)continue;}
      triangles[used++]=triangle*3;
    }
    const bounds=new Float64Array(Math.ceil(used/BLOCK_SIZE)*6);
    for(let block=0;block<bounds.length/6;block++){
      yield;
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
  clear(){this.enabled=false;for(const [geometry,job] of this.pending){geometry.removeEventListener('dispose',job.dispose);job.steps.return(EMPTY_BLOCKS);}this.pending.clear();this.blocks=new WeakMap();}
}
