import {test,expect} from '@playwright/test';
import type Phaser from 'phaser';
import type {WorldScene} from '../../src/game/scenes/WorldScene';
import type {WorldTrafficSystem} from '../../src/game/systems/WorldTrafficSystem';
test.use({viewport:{width:1280,height:1000}});
test('quays connect to dry banks and both riders stay on each rendered boat deck',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?e2e');await page.getByRole('button',{name:'Start New Game',exact:true}).click();await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'));
 const quays=[];
 for(const id of ['highmere','tidewatch','skallheim','blackspire']){
  const data=await page.evaluate(async id=>{
   const pp='/src/data/ports.ts',sp='/src/store/gameStore.ts';const {PORT_BY_ID,onPortDeck}=await import(pp),{useGameStore}=await import(sp);
   const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;
   const runtime=s as unknown as {cinematicDirector:{destroy():void};lastSafe:{x:number;y:number}};runtime.cinematicDirector.destroy();
   useGameStore.getState().hydrate({pendingCinematic:null,cinematicQueue:[],cinematic:null,storyFlags:{'scene:highmere-arrival':true}});
   const p=PORT_BY_ID[id];s.player.restoreAt(p.landing.x,p.landing.y);runtime.lastSafe={...p.landing};s.streamCinematicView(p.quay.x,p.quay.y);
   s.cameras.main.stopFollow().setZoom(2).centerOn(p.quay.x+70,p.quay.y+100);
   const world=(s as unknown as {worldGenerator:{isWalkable(x:number,y:number):boolean;getTerrainAt(x:number,y:number):string;getFootstepSurface(x:number,y:number):string}}).worldGenerator;
   return{id,landing:world.isWalkable(p.landing.x,p.landing.y),boatTerrain:world.getTerrainAt(p.boat.x,p.boat.y),
    gangway:p.river?true:[0,40,100,180,260].every(d=>world.isWalkable(p.quay.x,p.quay.y+d)),
    platform:p.river?true:world.isWalkable(p.quay.x+90,p.quay.y+260),
    waterOutside:p.river?true:!onPortDeck(p.quay.x+135,p.quay.y+200),
    footstep:p.river?'wood':world.getFootstepSurface(p.quay.x,p.quay.y+150)};
  },id);
  quays.push(data);await expect.poll(()=>page.evaluate(id=>Boolean(window.__mernondnaGame!.scene.getScene('world').children.getByName('port:'+id)),id)).toBe(true);
  await page.waitForTimeout(400);await page.screenshot({path:'test-results/quay-'+id+'.png'});
 }
 for(const q of quays){expect(q.landing,q.id+' landing').toBe(true);expect(q.boatTerrain,q.id+' mooring').toBe('water');expect(q.gangway,q.id+' gangway').toBe(true);expect(q.platform).toBe(true);expect(q.waterOutside).toBe(true);expect(q.footstep).toBe('wood');}
 const boats=await page.evaluate(()=>{
  const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s.scene.pause();s.physics.world.pause();s.children.list.forEach(o=>(o as Phaser.GameObjects.Sprite).setVisible?.(false));
  const fleet=(s as unknown as {traffic:WorldTrafficSystem}).traffic,x=s.player.x,y=s.player.y;s.cameras.main.stopFollow().setZoom(1).centerOn(x,y);s.add.rectangle(x,y,1500,1200,0x718d86).setDepth(-2000);
  const results=[];
  for(let row=0;row<2;row++)for(let direction=0;direction<4;direction++){
   const px=x-460+direction*305,py=y-220+row*430,v=fleet.createVessel('audit:'+row+':'+direction,px,py,row?.8:1.25);fleet.showPassenger(v);
   const [dx,dy]=[[0,1],[-1,0],[1,0],[0,-1]][direction];fleet.positionVessel(v,px,py,dx,dy,false);
   const f=v.sprite.frame,img=f.source.image as HTMLCanvasElement,ctx=img.getContext('2d')!,ratio=v.sprite.scaleX;
   const feet=[v.helmsman!,v.passenger!].map(actor=>{
    const sx=Math.round(f.cutX+(actor.x-v.sprite.x)/ratio+v.sprite.displayOriginX),sy=Math.round(f.cutY+(actor.y-v.sprite.y)/ratio+v.sprite.displayOriginY);
    return{alpha:ctx.getImageData(sx,sy,1,1).data[3],height:actor.displayHeight,underRail:actor.depth<v.rail!.depth};
   });
   results.push({direction,scale:ratio,feet});s.add.text(px-50,py+18,'view '+direction+' scale '+ratio,{color:'#ffffff'}).setDepth(py+1000);
  }
  const canvas=document.querySelector<HTMLCanvasElement>('.three-world-canvas')!;for(const e of [...document.querySelectorAll('body *')])if(e instanceof HTMLElement&&e!==canvas&&!e.contains(canvas))e.style.visibility='hidden';
  return results;
 });
 for(const boat of boats)for(const rider of boat.feet){expect(rider.alpha,`view ${boat.direction}, scale ${boat.scale}: foot on hull`).toBeGreaterThan(64);expect(rider.underRail).toBe(true);expect(rider.height).toBeGreaterThan(60);}
 await page.screenshot({path:'test-results/boat-deck-all-directions.png'});expect(errors).toEqual([]);
});
