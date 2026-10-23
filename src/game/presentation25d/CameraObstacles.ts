import type Phaser from 'phaser';
import type {Vector3} from 'three';
import {PRESENTATION_HINT,type PresentationHint} from './plane';

type Actor=Phaser.GameObjects.Image|Phaser.GameObjects.Sprite;
interface Obstacle {actor:Actor;left:number;right:number;top:number;bottom:number;height:number;base:number;round?:{x:number;z:number;radius:number};keys:string[]}
const CELL=256;
/** Camera probes use admitted structure bounds, including buildings outside the
 * draw frustum. They never traverse the world or raycast instanced triangles. */
class CameraObstacles {
  private readonly entries=new Map<Actor,Obstacle[]>();
  private readonly cells=new Map<string,Set<Obstacle>>();
  private readonly seen=new Set<Obstacle>();
  heightAt:(x:number,y:number)=>number=()=>0;
  constructor(scene:Phaser.Scene){
    const clear=()=>{this.entries.clear();this.cells.clear();this.seen.clear();indices.delete(scene);};
    scene.events.once('shutdown',clear);scene.events.once('destroy',clear);
  }
  add(actor:Actor){
    if(this.entries.has(actor))return;
    const hint=actor.getData(PRESENTATION_HINT) as PresentationHint|undefined,shape=hint?.house;
    if(!shape&&!hint?.wall?.thickness||shape?.profile.board)return;
    const w=Math.abs(actor.displayWidth),h=Math.abs(actor.displayHeight);
    let l=-w*actor.originX,r=w*(1-actor.originX),front=0,back=0,heading=actor.rotation,height=h*actor.originY;
    if(shape?.segment){
      const s=shape.segment,span=Math.hypot(s.dx,s.dy);l=-span/2;r=span/2;
      front=s.thickness/2;back=-front;heading=Math.atan2(s.dy,s.dx);height=s.height;
    }else if(shape){
      const p=shape.profile,roof=p.roof,tiers=p.tiers;
      const first=tiers?Math.min(...tiers.map(t=>t.left),p.hip?.left??1):roof[0][0];
      const last=tiers?Math.max(...tiers.map(t=>t.right),p.hip?.right??0):roof[roof.length-1][0];
      l=(shape.left+first*shape.width-actor.originX)*w;r=(shape.left+last*shape.width-actor.originX)*w;
      back=-shape.depth*w;
      const peak=tiers?Math.min(...tiers.map(t=>t.top),p.hip?.peak??1):Math.min(...roof.map(p=>p[1]));
      height=(actor.originY-shape.top-peak*shape.height)*h;
    }else if(hint?.wall){
      const crop=actor.isCropped?(actor as Actor&{_crop:{cw:number}})._crop:undefined;
      if(crop){const span=crop.cw*Math.abs(actor.scaleX);l=-span/2;r=span/2;}
      back=-(hint.wall.thickness??.06)*(r-l);heading=hint.wall.axis==='x'?0:Math.PI/2;
    }
    const c=Math.cos(heading),s=Math.sin(heading),items:Obstacle[]=[];
    const boxes:Array<readonly [number,number,number,number]>=[[l,r,0,height]];
    if(shape?.profile.opening?.length){
      const opening=shape.profile.opening;
      const holeL=(shape.left+Math.min(...opening.map(p=>p[0]))*shape.width-actor.originX)*w;
      const holeR=(shape.left+Math.max(...opening.map(p=>p[0]))*shape.width-actor.originX)*w;
      const lintel=(actor.originY-shape.top-Math.min(...opening.map(p=>p[1]))*shape.height)*h;
      boxes.length=0;boxes.push([l,holeL,0,height],[holeR,r,0,height],[holeL,holeR,lintel,height]);
    }
    for(const [left,right,base,ceiling] of boxes){
      const xs=[left*c-front*s,right*c-front*s,left*c-back*s,right*c-back*s];
      const zs=[left*s+front*c,right*s+front*c,left*s+back*c,right*s+back*c];
      const round=shape?.profile.tiers?{x:actor.x+(left+right)/2*c-(back+front)/2*s,
        z:actor.y+(left+right)/2*s+(back+front)/2*c,radius:Math.max(right-left,front-back)/2}:undefined;
      const entry:Obstacle={actor,left:actor.x+Math.min(...xs),right:actor.x+Math.max(...xs),
        top:actor.y+Math.min(...zs),bottom:actor.y+Math.max(...zs),height:ceiling,base,round,keys:[]};
      for(let y=Math.floor(entry.top/CELL);y<=Math.floor(entry.bottom/CELL);y++)for(let x=Math.floor(entry.left/CELL);x<=Math.floor(entry.right/CELL);x++){
        const key=x+':'+y;let bucket=this.cells.get(key);if(!bucket){bucket=new Set();this.cells.set(key,bucket);}
        bucket.add(entry);entry.keys.push(key);
      }
      items.push(entry);
    }
    this.entries.set(actor,items);
    actor.once('destroy',()=>{this.entries.delete(actor);for(const entry of items)for(const key of entry.keys){const bucket=this.cells.get(key);bucket?.delete(entry);if(!bucket?.size)this.cells.delete(key);}});
  }

  readonly limit=(from:Vector3,to:Vector3)=>{
    const radius=14,dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z;
    const left=Math.floor((Math.min(from.x,to.x)-radius)/CELL),right=Math.floor((Math.max(from.x,to.x)+radius)/CELL);
    const top=Math.floor((Math.min(from.z,to.z)-radius)/CELL),bottom=Math.floor((Math.max(from.z,to.z)+radius)/CELL);
    let limit=1;this.seen.clear();
    for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)for(const e of this.cells.get(x+':'+y)??[]){
      if(this.seen.has(e))continue;this.seen.add(e);
      if(!e.actor.active||!e.actor.visible)continue;
      const ground=this.heightAt(e.actor.x,e.actor.y),loY=ground+e.base-radius,hiY=ground+e.height+radius;
      // An existing save/very tight doorway can start inside a conservative
      // hull. The subject cutaway handles that case without a camera snap.
      const inside=e.round?Math.hypot(from.x-e.round.x,from.z-e.round.z)<e.round.radius+radius
        :from.x>e.left-radius&&from.x<e.right+radius&&from.z>e.top-radius&&from.z<e.bottom+radius;
      if(inside&&from.y>loY&&from.y<hiY)continue;
      let enter=0,exit=limit;
      for(let axis=0;axis<3;axis++){
        const origin=axis===0?from.x:axis===1?from.y:from.z,d=axis===0?dx:axis===1?dy:dz;
        const lo=axis===0?e.left-radius:axis===1?loY:e.top-radius,hi=axis===0?e.right+radius:axis===1?hiY:e.bottom+radius;
        if(Math.abs(d)<.00001){if(origin<lo||origin>hi){exit=-1;break;}continue;}
        const a=(lo-origin)/d,b=(hi-origin)/d;enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));
        if(enter>exit)break;
      }
      if(e.round&&enter<=exit){
        const ox=from.x-e.round.x,oz=from.z-e.round.z,a=dx*dx+dz*dz,b=2*(ox*dx+oz*dz),c=ox*ox+oz*oz-(e.round.radius+radius)**2;
        if(a<.00001){if(c>0)exit=-1;}
        else{const discriminant=b*b-4*a*c;
          if(discriminant<0)exit=-1;
          else{const root=Math.sqrt(discriminant);enter=Math.max(enter,(-b-root)/(2*a));exit=Math.min(exit,(-b+root)/(2*a));}
        }
      }
      if(enter<=exit&&exit>=0&&enter>0)limit=Math.min(limit,Math.max(0,enter-.015));
    }
    this.seen.clear();return limit;
  };
}
const indices=new WeakMap<Phaser.Scene,CameraObstacles>();
export function cameraObstacles(scene:Phaser.Scene){let index=indices.get(scene);if(!index){index=new CameraObstacles(scene);indices.set(scene,index);}return index;}
export function registerCameraObstacle(actor:Actor){cameraObstacles(actor.scene).add(actor);}
