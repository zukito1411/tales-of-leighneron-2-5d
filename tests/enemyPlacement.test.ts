import {describe,it,expect} from 'vitest';
import {WORLD_CONTENT,initialContentState} from '../src/data/content';
import {ENEMY_BY_ID} from '../src/data/enemies';
import {ExteriorPlacement} from '../src/game/systems/ExteriorPlacement';
import {WorldGenerator} from '../src/game/systems/WorldGenerator';
import {repairCreaturePlacements} from '../src/game/systems/creaturePlacement';
import {ContentChunkManager} from '../src/game/systems/ContentChunkManager';
import type {CreatureContentDefinition,Vec2} from '../src/game/types';

describe('hostile structure clearance',()=>{
  const world=new WorldGenerator(),geometry=new ExteriorPlacement(WORLD_CONTENT);
  const fits=(d:CreatureContentDefinition,p:Vec2)=>{
    const enemy=ENEMY_BY_ID[d.enemyId],r=(enemy.bodyRadius??(enemy.boss?24:11))*(d.wolfAlpha?1.18:1);
    return !geometry.blocksEnemy(p,r,true)&&[-r,r].every(dx=>[-r*2,0].every(dy=>world.isWalkable(p.x+dx,p.y+dy)));
  };
  it('provides unobstructed positions for every authored creature, including all bosses',()=>{
    const repaired=repairCreaturePlacements(WORLD_CONTENT,{states:{},spawns:{},nextSpawnSequence:0},world,fits);
    for(const d of WORLD_CONTENT)if(d.kind==='creature'){
      const p=repaired.states[d.id]??d.world;
      expect(world.canCreatureOccupy(p.x,p.y)&&fits(d,p),d.id).toBe(true);
    }
  });
  it('keeps Varr in the forecourt and preserves a repaired save through manager construction',()=>{
    const varr=WORLD_CONTENT.find((d):d is CreatureContentDefinition=>d.id==='boss:captain-varr'&&d.kind==='creature')!;
    const tower=WORLD_CONTENT.find(d=>d.id==='prop:east-watchtower')!;
    expect(fits(varr,varr.world)).toBe(true);expect(varr.world.y-tower.world.y).toBeGreaterThanOrEqual(180);
    const saved={...tower.world,hp:47,hpMax:100,respawnAt:123456,bossPhase:{phase:2 as const}};
    const repaired=repairCreaturePlacements(WORLD_CONTENT,{states:{[varr.id]:saved},spawns:{},nextSpawnSequence:9},world,fits);
    const point=repaired.states[varr.id];expect(fits(varr,point)).toBe(true);
    expect(point.hp).toBe(47);expect(point.respawnAt).toBe(123456);expect(point.bossPhase).toEqual(saved.bossPhase);
    const manager=new ContentChunkManager(WORLD_CONTENT,repaired,{
      initialState:initialContentState,create:(_d,state)=>state,position:state=>state,capture:(_d,state)=>state,destroy:()=>{},
    });
    expect(manager.getState(varr.id)).toEqual(expect.objectContaining(point));manager.destroy();
  });
  it('uses body width for swept routes and does not let endpoints skip a wall',()=>{
    const prop=WORLD_CONTENT.find(d=>d.id==='prop:east-watchtower')!;
    const a={x:prop.world.x-1000,y:prop.world.y-20},b={x:prop.world.x+1000,y:prop.world.y-20};
    expect(geometry.blocksEnemyPath(a,b,24)).toBe(true);
  });
});
