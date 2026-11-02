import {test,expect} from '@playwright/test';
import type {WorldScene} from '../../src/game/scenes/WorldScene';
import type {FirstPersonWeapon} from '../../src/game/presentation25d/FirstPersonWeapon';
interface SwingProbe {center:number[];edge:number[];axis:number[];yaw:number;models:string[];visible:boolean}
declare global {interface Window {__swingReview?:SwingProbe}}
test.use({launchOptions:{args:['--use-angle=default']},trace:'off'});
test('first-person cutting edge follows slash, return cut, cleave and skill motion',async({browser})=>{
  test.setTimeout(180000);
  const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto('/?e2e');
    await page.evaluate(async()=>{
      const path='/src/game/presentation25d/FirstPersonWeapon.ts',three='/node_modules/.vite/deps/three.js';
      const {FirstPersonWeapon}=await import(/* @vite-ignore */ path) as typeof import('../../src/game/presentation25d/FirstPersonWeapon');
      const {Vector3}=await import(/* @vite-ignore */ three) as typeof import('three');
      const render=FirstPersonWeapon.prototype.render;
      FirstPersonWeapon.prototype.render=function(this:FirstPersonWeapon){
        render.call(this);const mesh=this['mesh'],rig=this['rig'];if(!mesh)return;
        const angle=this['nativeAngle'];
        // Use the actual geometry's grip/tip registration and submitted mesh
        // transforms, not its Euler yaw or the pose helper's expected result.
        const axis=new Vector3(Math.sin(angle),Math.cos(angle),0).applyQuaternion(mesh.quaternion).applyQuaternion(rig.quaternion).normalize();
        const edge=new Vector3(Math.cos(angle),-Math.sin(angle),0).applyQuaternion(mesh.quaternion).applyQuaternion(rig.quaternion).normalize();
        const center=axis.clone().multiplyScalar(.52).add(rig.position);
        window.__swingReview={axis:axis.toArray(),edge:edge.toArray(),center:center.toArray(),yaw:mesh.rotation.y,
          visible:rig.visible&&mesh.visible,models:rig.children.map(child=>child.name)};
      };
    });
    await page.getByRole('button',{name:'Start New Game',exact:true}).click();
    await page.waitForFunction(()=>window.__mernondnaGame?.registry.get('worldReady'),null,{timeout:120000});
    await page.getByRole('button',{name:/Skip scene/}).click();
    await page.waitForFunction(()=>!(window.__mernondnaGame!.scene.getScene('world') as WorldScene)['cinematicDirector'].active);
    await page.keyboard.press('v');await page.waitForFunction(()=>window.__swingReview?.visible);
    await page.evaluate(()=>{const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s.scene.pause();s.player.resetInput();s.targeting.clear();});
    const alignments=[];
    for(let step=0;step<3;step++){
      const timing=await page.evaluate(async step=>{
        const input='/src/game/input.ts';const {mobileInput}=await import(/* @vite-ignore */ input) as typeof import('../../src/game/input');
        const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene,p=s.player;
        p.resetInput();p['comboStep']=step;p['comboWeaponId']=s.getEquippedWeapon().id;p['comboExpiresAt']=s.combatTime+10000;p['nextAttackAt']=0;
        p.stamina=10000;mobileInput.press('attack');p.updatePlayer(s.combatTime,16);
        const a=p.presentationAttack;if(!a)throw new Error('No actual basic attack');
        return {duration:a.endsAt-a.startedAt,impact:a.step.impactFraction,active:(a.activeUntil-a.impactAt)/(a.endsAt-a.startedAt)};
      },step);
      const age=(timing.impact+timing.active*.35)*timing.duration;
      for(const offset of [0,2]){
        await page.evaluate(({age,duration})=>{
          const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene,a=s.player.presentationAttack!;
          a.startedAt=s.combatTime-age;a.endsAt=a.startedAt+duration;
        },{age:age+offset,duration:timing.duration});
        await page.waitForTimeout(40);
        if(offset===0){
          await page.evaluate(()=>{window.__mernondnaGame!.registry.set('review-swing-first',window.__swingReview);});
          await page.screenshot({path:`test-results/fpp-cut-${step}.png`});
        }
      }
      const check=await page.evaluate(()=>{
        const a=window.__mernondnaGame!.registry.get('review-swing-first') as SwingProbe,b=window.__swingReview!;
        const velocity=b.center.map((v,i)=>v-a.center[i]),along=velocity.reduce((sum,v,i)=>sum+v*a.axis[i],0);
        const tangent=velocity.map((v,i)=>v-along*a.axis[i]),length=Math.hypot(...tangent);
        return {alignment:Math.abs(tangent.reduce((sum,v,i)=>sum+v*a.edge[i],0))/length,yaw:a.yaw,models:a.models};
      });
      expect(check.models).toEqual(['first-person-equipped-sword']);expect(check.alignment,`step ${step} edge leads`).toBeGreaterThan(.985);
      alignments.push({step,...check});
    }
    expect(Math.abs(alignments[0].yaw-alignments[2].yaw)).toBeGreaterThan(.35);
    await page.evaluate(()=>{const s=window.__mernondnaGame!.scene.getScene('world') as WorldScene;s.player.resetInput();});
    await page.waitForTimeout(50);
    const rest=await page.evaluate(()=>window.__swingReview!);expect(rest.yaw).toBeCloseTo(1.05,4);
    console.log(JSON.stringify({alignments}));expect(errors).toEqual([]);
  }finally{await context.close();}
});
