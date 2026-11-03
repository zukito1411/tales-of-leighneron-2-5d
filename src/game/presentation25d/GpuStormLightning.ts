import {AdditiveBlending,BufferAttribute,BufferGeometry,DynamicDrawUsage,Mesh,MeshBasicMaterial,RingGeometry,DoubleSide,type Scene} from 'three';
import {seededRandom} from '../../utils/seededRandom';
import type {StormBolt} from '../systems/StormHazardSystem';
type Point=readonly [number,number,number];
/** Two retained tube meshes: a blue halo and a white-blue core. Branching
 * topology is rebuilt only when a new strike commits, never per rain drop. */
export class GpuStormLightning {
  private readonly coreGeometry=new BufferGeometry();private readonly glowGeometry=new BufferGeometry();
  private readonly corePosition=new BufferAttribute(new Float32Array(12000),3).setUsage(DynamicDrawUsage);
  private readonly glowPosition=new BufferAttribute(new Float32Array(12000),3).setUsage(DynamicDrawUsage);
  private readonly coreMaterial=new MeshBasicMaterial({color:0xc5eeff,transparent:true,blending:AdditiveBlending,depthWrite:false,toneMapped:false});
  private readonly glowMaterial=new MeshBasicMaterial({color:0x138bff,transparent:true,blending:AdditiveBlending,depthWrite:false,toneMapped:false});
  private readonly core=new Mesh(this.coreGeometry,this.coreMaterial);private readonly glow=new Mesh(this.glowGeometry,this.glowMaterial);
  private readonly ring=new Mesh(new RingGeometry(43,54,48),new MeshBasicMaterial({color:0x39adff,transparent:true,blending:AdditiveBlending,depthWrite:false,toneMapped:false,side:DoubleSide}));
  private lastId=-1;
  constructor(world:Scene){
    this.coreGeometry.setAttribute('position',this.corePosition);this.glowGeometry.setAttribute('position',this.glowPosition);
    for(const mesh of [this.glow,this.core]){mesh.frustumCulled=false;mesh.visible=false;mesh.renderOrder=2;world.add(mesh);}
    this.ring.visible=false;this.ring.rotation.x=-Math.PI/2;this.ring.renderOrder=2;world.add(this.ring);
  }
  warmupObjects(){return [this.glow,this.core,this.ring];}
  update(bolt:StormBolt|null|undefined,height:(x:number,y:number)=>number){
    this.core.visible=this.glow.visible=this.ring.visible=Boolean(bolt);if(!bolt)return;
    if(bolt.id!==this.lastId){this.lastId=bolt.id;this.build(bolt);}
    const ground=height(bolt.x,bolt.y);this.core.position.set(bolt.x,ground,bolt.y);this.glow.position.copy(this.core.position);
    this.ring.position.set(bolt.x,ground+.4,bolt.y);this.ring.scale.setScalar(.3+bolt.age/400);this.ring.material.opacity=Math.max(0,1-bolt.age/600)*.65;
    const fade=Math.max(0,1-bolt.age/600),flicker=bolt.age<85||bolt.age>125&&bolt.age<210?1:.48;
    this.coreMaterial.opacity=fade*flicker;this.glowMaterial.opacity=fade*flicker*.23;
  }
  private build(bolt:StormBolt){
    const rng=seededRandom('storm-bolt:'+bolt.id),path:Point[]=[];
    for(let i=0;i<=28;i++){const t=i/28;
      path.push([i===28?0:(1-t)*180+(rng()-.5)*85,bolt.height*(1-t),i===28?0:(rng()-.5)*85]);
    }
    const paths:Point[][]=[path];
    for(const start of [5,11,17,23]){
      const p=path[start],branch:Point[]=[p],dx=(rng()<.5?-1:1)*(100+rng()*130),dz=(rng()-.5)*180;
      for(let i=1;i<=6;i++){const t=i/6;branch.push([p[0]+dx*t+(rng()-.5)*35,p[1]-t*(start===23?150:250),p[2]+dz*t+(rng()-.5)*35]);}
      paths.push(branch);
    }
    const fill=(attribute:BufferAttribute,width:number)=>{
      let vertex=0;
      for(const points of paths)for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],length=Math.hypot(dx,dy,dz);
        const sideLength=Math.hypot(dx,dy),sx=-dy/sideLength,sy=dx/sideLength;
        const ux=-dz*sy/length,uy=dz*sx/length,uz=(dx*sy-dy*sx)/length;
        const radius=width*(points===path?1:.55);
        const put=(p:Point,angle:number)=>attribute.setXYZ(vertex++,p[0]+radius*(sx*Math.cos(angle)+ux*Math.sin(angle)),p[1]+radius*(sy*Math.cos(angle)+uy*Math.sin(angle)),p[2]+radius*uz*Math.sin(angle));
        for(let j=0;j<6;j++){const t=j*Math.PI/3,u=(j+1)*Math.PI/3;put(a,t);put(b,t);put(a,u);put(b,t);put(b,u);put(a,u);}
      }
      attribute.clearUpdateRanges();attribute.addUpdateRange(0,vertex*3);attribute.needsUpdate=true;return vertex;
    };
    this.coreGeometry.setDrawRange(0,fill(this.corePosition,2.4));this.glowGeometry.setDrawRange(0,fill(this.glowPosition,11));
  }
  destroy(){this.core.removeFromParent();this.glow.removeFromParent();this.ring.removeFromParent();this.ring.geometry.dispose();this.ring.material.dispose();this.coreGeometry.dispose();this.glowGeometry.dispose();this.coreMaterial.dispose();this.glowMaterial.dispose();}
}
