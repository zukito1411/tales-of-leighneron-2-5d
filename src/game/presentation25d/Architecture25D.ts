import Phaser from 'phaser';
import {
  AmbientLight, BoxGeometry, BufferGeometry, CanvasTexture, DirectionalLight,
  DoubleSide, Float32BufferAttribute, Group, LinearFilter, Mesh, MeshBasicMaterial,
  MeshLambertMaterial, PlaneGeometry, Scene, SRGBColorSpace,
  type Material, type Texture,
} from 'three';
import {worldSpriteProfile} from '../../data/worldSpriteGeometry';
import type {ArtTextureKey} from '../../data/art';

type Building = Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
type BuildingKey = 'world_buildings' | 'capital_buildings' | 'elven_villas';
interface MaterialSet {
  wall: MeshLambertMaterial;
  roof: MeshLambertMaterial;
  frontage: MeshBasicMaterial;
  timber: MeshLambertMaterial;
  stone: MeshLambertMaterial;
}
interface Volume {
  group: Group;
  signature: string;
  lastFrame: number;
}
const BUILDINGS = new Set<BuildingKey>(['world_buildings','capital_buildings','elven_villas']);
const MAX_LINGER_FRAMES = 90;

function isBuildingKey(key: string): key is BuildingKey {
  return BUILDINGS.has(key as BuildingKey);
}
function materialPalette(key: BuildingKey, frame: number) {
  if(key==='elven_villas')return {roof:'#456d65',walls:'#aaa391',timber:'#69513d',stone:'#777a73'};
  if(key==='capital_buildings')return {roof:frame===8?'#444954':'#59606a',walls:'#a8a09a',timber:'#53483e',stone:'#85817e'};
  if(frame===0||frame===4)return {roof:'#b48d4f',walls:'#b7ad8b',timber:'#695039',stone:'#89847b'};
  if(frame===2||frame===5)return {roof:'#444a50',walls:'#aaa093',timber:'#524032',stone:'#88847d'};
  return {roof:'#756044',walls:'#b1a28d',timber:'#654b33',stone:'#858077'};
}
function createCanvasTexture(
  frame: Phaser.Textures.Frame, start: number, portion: number, base: string, clear: boolean,
): CanvasTexture {
  const canvas=document.createElement('canvas');
  canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('2.5D architecture texture canvas unavailable');
  if(!clear){ctx.fillStyle=base;ctx.fillRect(0,0,256,256);}
  const y=frame.cutY+Math.floor(frame.cutHeight*start);
  const sourceHeight=Math.max(1,Math.floor(frame.cutHeight*portion));
  ctx.drawImage(frame.source.image as CanvasImageSource,frame.cutX,y,frame.cutWidth,
    Math.min(sourceHeight,frame.source.height-y),0,0,256,256);
  // Reuse each building's original painted details; the geometry supplies
  // perspective and silhouette instead of another generic flat illustration.
  const texture=new CanvasTexture(canvas);
  texture.colorSpace=SRGBColorSpace;texture.magFilter=texture.minFilter=LinearFilter;
  texture.generateMipmaps=false;return texture;
}
function makeRoofFace(points: readonly number[], roofMaterial: Material): Mesh {
  const geometry=new BufferGeometry();
  const vertices=new Float32Array([
    points[0],points[1],points[2],points[3],points[4],points[5],points[6],points[7],points[8],
    points[0],points[1],points[2],points[6],points[7],points[8],points[9],points[10],points[11],
  ]);
  geometry.setAttribute('position',new Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new Float32BufferAttribute([
    0,0, 1,0, 1,1, 0,0, 1,1, 0,1,
  ],2));
  geometry.computeVertexNormals();
  return new Mesh(geometry,roofMaterial);
}

/** True architectural volumes for authored sprite buildings.
 *
 * The original actor stays alive and owns collision, streaming, contents,
 * quests and save identity. Only its illustration is replaced in presentation.
 * Facade and roof textures are sampled from its approved source artwork.
 * Collision is NOT recomputed from these decorative meshes.
 */
export class Architecture25D {
  private readonly volumes=new Map<Building,Volume>();
  private readonly mats=new Map<string,MaterialSet>();
  private readonly managedTextures:Texture[]=[];
  private readonly shadow:CanvasTexture;
  private readonly shadowMaterial:MeshBasicMaterial;

  constructor(private readonly scene:Scene){
    this.scene.add(new AmbientLight(0xf3eee4,1.15));
    const sun=new DirectionalLight(0xffdfa3,2.0);
    sun.position.set(-650,950,500);this.scene.add(sun);
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=128;
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('2.5D shadow canvas unavailable');
    const gradient=ctx.createRadialGradient(64,64,5,64,64,62);
    gradient.addColorStop(0,'rgba(24,21,19,0.32)');
    gradient.addColorStop(.55,'rgba(24,21,19,0.16)');
    gradient.addColorStop(1,'rgba(24,21,19,0)');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
    this.shadow=new CanvasTexture(canvas);
    this.shadowMaterial=new MeshBasicMaterial({
      map:this.shadow,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,
    });
  }

  private materialFor(key:BuildingKey,frameIndex:number,frame:Phaser.Textures.Frame):MaterialSet {
    const id=key+':'+frameIndex;
    const prior=this.mats.get(id);if(prior)return prior;
    const colors=materialPalette(key,frameIndex);
    const roofMap=createCanvasTexture(frame,0,.46,colors.roof,false);
    const wallMap=createCanvasTexture(frame,.50,.43,colors.walls,false);
    const frontMap=createCanvasTexture(frame,.46,.53,colors.walls,true);
    this.managedTextures.push(roofMap,wallMap,frontMap);
    const mats:MaterialSet={
      wall:new MeshLambertMaterial({map:wallMap,color:0xd4c8b6,side:DoubleSide}),
      roof:new MeshLambertMaterial({map:roofMap,color:0xffffff,side:DoubleSide}),
      frontage:new MeshBasicMaterial({
        map:frontMap,transparent:true,alphaTest:.07,depthWrite:true,side:DoubleSide,
      }),
      timber:new MeshLambertMaterial({color:colors.timber}),
      stone:new MeshLambertMaterial({color:colors.stone}),
    };
    this.mats.set(id,mats);return mats;
  }

  /** Return true only for standalone architecture with a solid, authored foot
   * print. Portals, bridges, floor pieces, ruins and interactive buildings still
   * use the original artist-authored sprite, never guess a sealed collision. */
  present(actor:Building,frameNumber:number):boolean {
    const key=actor.texture.key;
    if(!isBuildingKey(key)||!actor.active||!actor.visible||actor.parentContainer||actor.input?.enabled)return false;
    const index=Number(actor.frame.name);
    const profile=Number.isInteger(index)?worldSpriteProfile(key as ArtTextureKey,index):undefined;
    if(!profile||profile.floor||profile.solids.length!==1||index===4||index===3&&key==='capital_buildings')return false;
    const frame=actor.frame;
    if(!frame?.source?.image)return false;
    const resolution=frame.source.resolution||1;
    const width=frame.cutWidth/resolution*Math.abs(actor.scaleX);
    const height=frame.cutHeight/resolution*Math.abs(actor.scaleY);
    if(width<12||height<12)return false;
    const signature=key+':'+index+':'+width.toFixed(2)+':'+height.toFixed(2)
      +':'+actor.originX.toFixed(3)+':'+actor.originY.toFixed(3);
    let runtime=this.volumes.get(actor);
    if(runtime?.signature!==signature){
      if(runtime)this.release(actor,runtime);
      runtime={group:this.makeBuilding(actor,key,index,frame,width,height),signature,lastFrame:frameNumber};
      this.volumes.set(actor,runtime);
      this.scene.add(runtime.group);
    }
    runtime.group.visible=true;
    runtime.group.position.set(actor.x,0,actor.y);
    runtime.group.rotation.y=actor.rotation;
    runtime.lastFrame=frameNumber;
    return true;
  }

  private makeBuilding(actor:Building,key:BuildingKey,index:number,frame:Phaser.Textures.Frame,width:number,height:number){
    const mats=this.materialFor(key,index,frame);
    const group=new Group();
    const solid=worldSpriteProfile(key as ArtTextureKey,index)!.solids[0];
    const minX=Math.min(...solid.map(p=>p[0])),maxX=Math.max(...solid.map(p=>p[0]));
    const minZ=Math.min(...solid.map(p=>p[1])),maxZ=Math.max(...solid.map(p=>p[1]));
    const w=Math.max(width*.48,(maxX-minX)*width);
    // Use surveyed ground contours to retain the existing building footprint.
    // The roof may overhang farther into the non-colliding illustrated space.
    const d=Math.max(height*.3,(maxZ-minZ)*height*1.55);
    const cx=((minX+maxX)/2-actor.originX)*width;
    const front=(maxZ-actor.originY)*height;
    const centerZ=front-d/2;
    const wallHeight=height*(key==='capital_buildings'?.48:.38);
    const roofRise=height*(key==='capital_buildings'?.21:.27);
    const roofHeight=wallHeight+roofRise;
    const eaveWidth=w*1.085;
    const eaveDepth=d*1.11;
    const rear=centerZ-eaveDepth/2,face=centerZ+eaveDepth/2;

    const addBox=(sx:number,sy:number,sz:number,x:number,y:number,z:number,material:Material)=>{
      const part=new Mesh(new BoxGeometry(sx,sy,sz),material);
      part.position.set(x,y,z);group.add(part);return part;
    };

    // A genuine walled volume and raised masonry plinth.
    addBox(w,wallHeight,d,cx,wallHeight/2,centerZ,mats.wall);
    addBox(w*1.07,Math.max(5,height*.045),d*1.08,cx,0,centerZ,mats.stone);
    const beam=Math.max(3,w*.026);
    // Architectural timber framing visible from oblique angles.
    for(const x of [cx-w*.47,cx+w*.47]){
      for(const z of [centerZ-d*.48,centerZ+d*.48])
        addBox(beam,wallHeight,beam,x,wallHeight/2,z,mats.timber);
    }
    addBox(w,beam,d,cx,wallHeight-beam/2,centerZ,mats.timber);

    // Two pitched roof meshes occupy actual X/Y/Z coordinates.
    const ridgeX=cx,left=cx-eaveWidth/2,right=cx+eaveWidth/2;
    const roofLeft=makeRoofFace([
      left,wallHeight,face,
      ridgeX,roofHeight,face,
      ridgeX,roofHeight,rear,
      left,wallHeight,rear,
    ],mats.roof);
    const roofRight=makeRoofFace([
      ridgeX,roofHeight,face,
      right,wallHeight,face,
      right,wallHeight,rear,
      ridgeX,roofHeight,rear,
    ],mats.roof);
    group.add(roofLeft,roofRight);
    addBox(beam*1.6,beam*1.4,eaveDepth*1.02,cx,roofHeight,centerZ,mats.timber);
    addBox(beam,beam,eaveDepth,left,wallHeight,centerZ,mats.timber);
    addBox(beam,beam,eaveDepth,right,wallHeight,centerZ,mats.timber);

    // The original cottage/inn/smith façade supplies its windows, doors,
    // masonry and ornamentation on a vertical THREE plane, not a tilted 2D
    // sprite. The sides and roof genuinely extend behind this image.
    const frontArt=new Mesh(new PlaneGeometry(w*.99,wallHeight*1.1),mats.frontage);
    frontArt.position.set(cx,wallHeight*.54,centerZ+d/2+.6);
    group.add(frontArt);

    // A real chimney adds readable height without imitating a character asset.
    if(index!==3&&index!==2&&key!=='elven_villas'){
      const chimneyX=cx+w*.28;
      const chimneyZ=centerZ-d*.19;
      addBox(w*.09,roofRise*.9,w*.09,chimneyX,roofHeight-roofRise*.1,chimneyZ,mats.stone);
      addBox(w*.13,beam*.9,w*.13,chimneyX,roofHeight+roofRise*.34,chimneyZ,mats.timber);
    }

    const contact=new Mesh(new PlaneGeometry(w*1.27,d*1.38),this.shadowMaterial);
    contact.rotation.x=-Math.PI/2;
    contact.position.set(cx,.08,centerZ);
    group.add(contact);
    return group;
  }

  finish(frame:number){
    for(const [actor,runtime] of this.volumes){
      if(!actor.active||!actor.scene||frame-runtime.lastFrame>MAX_LINGER_FRAMES){
        this.release(actor,runtime);continue;
      }
      runtime.group.visible=runtime.lastFrame===frame;
    }
  }
  private release(actor:Building,runtime:Volume){
    this.scene.remove(runtime.group);
    runtime.group.traverse(object=>{
      if(object instanceof Mesh)object.geometry.dispose();
    });
    this.volumes.delete(actor);
  }
  destroy(){
    for(const [actor,runtime] of this.volumes)this.release(actor,runtime);
    for(const materials of this.mats.values())
      for(const material of Object.values(materials))material.dispose();
    this.mats.clear();
    for(const texture of this.managedTextures)texture.dispose();
    this.managedTextures.length=0;
    this.shadowMaterial.dispose();this.shadow.dispose();
  }
}
