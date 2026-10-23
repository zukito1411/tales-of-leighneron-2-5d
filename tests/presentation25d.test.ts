import {describe,expect,it} from 'vitest';
import type Phaser from 'phaser';
import {CAMERA_SIN,CAMERA_COS,CAMERA_YAW_SIN,CAMERA_YAW_COS,groundWorldView,projectGroundPoint,unprojectGroundPoint,uprightPoint,presentationAttachment,PRESENTATION_SURFACE,type PresentationSurface} from '../src/game/presentation25d/plane';
import {groundEffectViewport} from '../src/game/systems/renderSizing';

function sceneAt(presentation='three-2.5d'){
  const registry={get:(key:string)=>key==='presentation'?presentation:key==='renderDensity'?2:undefined};
  return {game:{registry},registry,scale:{width:1280,height:720},cameras:{main:{
    width:1280,height:720,zoom:2,midPoint:{x:1000,y:2000},
    worldView:{x:680,y:1820,width:640,height:360},
  }}} as unknown as Phaser.Scene;
}

describe('shared 2.5D coordinates',()=>{
  it('covers the ground visible through an inclined orthographic camera',()=>{
    const scene=sceneAt(),view=groundWorldView(scene);
    expect(view.width).toBeCloseTo(640*CAMERA_YAW_COS+360/CAMERA_SIN*CAMERA_YAW_SIN);
    expect(view.height).toBeCloseTo(640*CAMERA_YAW_SIN+360/CAMERA_SIN*CAMERA_YAW_COS);
    expect(view.centerX).toBe(1000);expect(view.centerY).toBe(2000);
    expect(view.contains(1000,2000+179/CAMERA_SIN)).toBe(true);
    scene.cameras.main.midPoint.y+=100;
    expect(groundWorldView(scene)).toBe(view);expect(view.centerY).toBe(2100);
  });

  it('keeps effect pixel counts bounded while covering the full ground view',()=>{
    const viewport=groundEffectViewport(sceneAt());
    expect([viewport.width,viewport.height]).toEqual([640,360]);
    expect(viewport.view.width*viewport.zoom).toBeCloseTo(viewport.width);
    expect(viewport.view.height*viewport.zoomY).toBeCloseTo(viewport.height);
  });

  it('preserves an attachment height independently of ground foreshortening',()=>{
    const scene=sceneAt();
    const owner={x:1000,y:2000,getData:()=>undefined} as unknown as Phaser.GameObjects.Sprite;
    const ground=projectGroundPoint(scene,owner.x,owner.y,{x:0,y:0});
    const painted=presentationAttachment(scene,owner,1000,1920,{x:0,y:0});
    expect(painted.x).toBeCloseTo(ground.x);expect(painted.y-ground.y).toBeCloseTo(-80);
    const vertex=uprightPoint(1000,1920,owner.x,owner.y,{x:0,y:0,z:0});
    const projected=projectGroundPoint(scene,vertex.x,vertex.z,{x:0,y:0});
    expect(projected.x).toBeCloseTo(painted.x);expect(projected.y-vertex.y*CAMERA_COS).toBeCloseTo(painted.y);
    const fixture=sceneAt('phaser');
    expect(groundWorldView(fixture)).toBe(fixture.cameras.main.worldView);
    expect(presentationAttachment(fixture,owner,1000,1920,{x:0,y:0})).toEqual({x:1000,y:1920});
  });

  it('unprojects angled ground coordinates for weather and roof masking',()=>{
    const scene=sceneAt(),point=projectGroundPoint(scene,1140,1890,{x:0,y:0});
    const restored=unprojectGroundPoint(scene,point.x,point.y,{x:0,y:0});
    expect(restored.x).toBeCloseTo(1140);expect(restored.y).toBeCloseTo(1890);
  });

  it('projects facade lights through their actual three-dimensional surface',()=>{
    const surface:PresentationSurface={sourceTop:.46,sourceHeight:.53,
      point(x,_y,out){out.x=x+20;out.y=80;out.z=2030;}};
    const owner={getData:(key:string)=>key===PRESENTATION_SURFACE?surface:undefined,y:2000} as unknown as Phaser.GameObjects.Sprite;
    const point=presentationAttachment(sceneAt(),owner,1000,1900,{x:0,y:0});
    expect(point.x).toBeCloseTo(1020*CAMERA_YAW_COS-2030*CAMERA_YAW_SIN);
    expect(point.y).toBeCloseTo((1020*CAMERA_YAW_SIN+2030*CAMERA_YAW_COS)*CAMERA_SIN-80*CAMERA_COS);
  });
});
