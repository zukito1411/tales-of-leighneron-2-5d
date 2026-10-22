import {
  AdditiveBlending,BufferAttribute,DoubleSide,DynamicDrawUsage,InstancedBufferAttribute,
  InstancedMesh,Matrix4,NormalBlending,PlaneGeometry,Scene,ShaderMaterial,Texture,Vector4,
} from 'three';

const vertexShader=`
attribute vec4 atlasRect;
attribute vec4 instanceTint;
varying vec2 atlasUV;
varying vec4 tint;
varying vec2 groundPosition;
void main(){
  atlasUV=atlasRect.xy+uv*atlasRect.zw;
  tint=instanceTint;
  groundPosition=(instanceMatrix*vec4(position,1.0)).xz;
  gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);
}`;
const fragmentShader=`
uniform sampler2D atlas;
varying vec2 atlasUV;
varying vec4 tint;
varying vec2 groundPosition;
uniform int clipCount;
uniform vec4 clipRects[16];
void main(){
  if(clipCount>0){
    bool inside=false;
    for(int i=0;i<16;i++){
      if(i>=clipCount)break;
      vec4 r=clipRects[i];
      if(groundPosition.x>=r.x&&groundPosition.y>=r.y&&groundPosition.x<=r.z&&groundPosition.y<=r.w)inside=true;
    }
    if(!inside)discard;
  }
  vec4 pixel=texture2D(atlas,atlasUV)*tint;
  if(pixel.a<0.025)discard;
  gl_FragColor=pixel;
  #include <colorspace_fragment>
}`;

/** One instanced draw per source atlas / blend / layer. No texture per pose. */
export class SpriteBatch {
  mesh:InstancedMesh;
  private capacity=32;
  private used=0;
  private readonly material:ShaderMaterial;
  private atlas:InstancedBufferAttribute;
  private tint:InstancedBufferAttribute;
  lastUsed=0;
  readonly objects:unknown[]=[];

  constructor(private readonly scene:Scene,texture:Texture,additive:boolean,overlay:boolean,order:number,clips:readonly Vector4[]=[]){
    this.material=new ShaderMaterial({uniforms:{atlas:{value:texture},clipCount:{value:clips.length},
      clipRects:{value:Array.from({length:16},(_,i)=>clips[i]??new Vector4())}},vertexShader,fragmentShader,
      transparent:true,depthTest:!overlay,depthWrite:!overlay&&!additive,side:DoubleSide,
      blending:additive?AdditiveBlending:NormalBlending});
    const geometry=new PlaneGeometry(1,1);
    this.atlas=new InstancedBufferAttribute(new Float32Array(this.capacity*4),4).setUsage(DynamicDrawUsage);
    this.tint=new InstancedBufferAttribute(new Float32Array(this.capacity*4),4).setUsage(DynamicDrawUsage);
    geometry.setAttribute('atlasRect',this.atlas);geometry.setAttribute('instanceTint',this.tint);
    this.mesh=new InstancedMesh(geometry,this.material,this.capacity);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);this.mesh.frustumCulled=false;this.mesh.renderOrder=order;
    this.mesh.userData.batch=this;scene.add(this.mesh);
  }
  begin(){this.used=0;this.objects.length=0;}
  add(matrix:Matrix4,uv:readonly number[],color:number,alpha:number,object:unknown,frame:number){
    if(this.used===this.capacity)this.grow();
    const slot=this.used++;
    this.mesh.setMatrixAt(slot,matrix);this.atlas.setXYZW(slot,uv[0],uv[1],uv[2],uv[3]);
    this.tint.setXYZW(slot,((color>>>16)&255)/255,((color>>>8)&255)/255,(color&255)/255,alpha);
    this.objects.push(object);this.lastUsed=frame;
    return slot;
  }
  finish(){
    this.mesh.count=this.used;this.mesh.visible=this.used>0;
    if(!this.used)return;
    for(const attribute of [this.mesh.instanceMatrix,this.atlas,this.tint]){
      attribute.clearUpdateRanges();attribute.addUpdateRange(0,this.used*attribute.itemSize);attribute.needsUpdate=true;
    }
    // Raycasting uses the current instance transforms after actors move.
    this.mesh.boundingSphere=null;
  }
  private grow(){
    const previous=this.mesh,capacity=this.capacity*2,geometry=previous.geometry.clone();
    const atlas=new Float32Array(capacity*4),tint=new Float32Array(capacity*4);
    atlas.set(this.atlas.array);tint.set(this.tint.array);
    this.atlas=new InstancedBufferAttribute(atlas,4).setUsage(DynamicDrawUsage);
    this.tint=new InstancedBufferAttribute(tint,4).setUsage(DynamicDrawUsage);
    geometry.setAttribute('atlasRect',this.atlas);geometry.setAttribute('instanceTint',this.tint);
    const next=new InstancedMesh(geometry,this.material,capacity);
    (next.instanceMatrix as BufferAttribute).setUsage(DynamicDrawUsage);
    next.instanceMatrix.array.set(previous.instanceMatrix.array);
    next.frustumCulled=false;next.renderOrder=previous.renderOrder;next.userData.batch=this;
    this.scene.remove(previous);previous.geometry.dispose();previous.dispose();this.scene.add(next);
    this.mesh=next;this.capacity=capacity;
  }
  destroy(){this.scene.remove(this.mesh);this.mesh.geometry.dispose();this.mesh.dispose();this.material.dispose();this.objects.length=0;}
}
