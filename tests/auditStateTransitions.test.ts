import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {ContentChunkManager} from '../src/game/systems/ContentChunkManager';
import {CONTENT_BY_ID,initialContentState} from '../src/data/content';
import type {ContentState,ContentWorldState} from '../src/game/types';
import {useGameStore} from '../src/store/gameStore';
import {ElevationField} from '../src/game/presentation25d/ElevationField';

beforeEach(()=>{useGameStore.getState().resetGame();vi.spyOn(Math,'random').mockReturnValue(.99);});
afterEach(()=>vi.restoreAllMocks());

describe('boss return and reward transactions',()=>{
  it('pays a returned boss before any autosave, then rejects the same defeat again',()=>{
    const d=CONTENT_BY_ID['boss:captain-varr'];
    if(d.kind!=='creature')throw new Error('Missing boss fixture');
    const world:ContentWorldState={states:{[d.id]:{...initialContentState(d),hp:0,defeated:true,respawnAt:Date.now()-1}},spawns:{},nextSpawnSequence:0};
    useGameStore.setState({defeatedBosses:['captain-varr'],worldContent:world});
    const manager=new ContentChunkManager<ContentState>([d],world,{
      initialState:initialContentState,canActivate:()=>false,
      create:(_definition,state)=>state,position:actor=>actor,capture:(_definition,actor)=>actor,destroy:()=>{},
      respawned:(definition,state)=>useGameStore.getState().recordContentRespawn(definition.id,state),
    });
    manager.update(d.world.x,d.world.y);
    expect(useGameStore.getState().worldContent.states[d.id]).toMatchObject({defeated:false});
    manager.patchState(d.id,{hp:0,defeated:true,respawnAt:Date.now()+1200000});
    const defeated=manager.snapshot(),before=useGameStore.getState().gold;
    expect(useGameStore.getState().recordEnemyDefeat(d.enemyId,20,11,'captain-varr',defeated,d.id)).toBe(true);
    expect(useGameStore.getState().gold).toBe(before+11);
    expect(useGameStore.getState().recordEnemyDefeat(d.enemyId,20,11,'captain-varr',defeated,d.id)).toBe(false);
    expect(useGameStore.getState().gold).toBe(before+11);
    manager.destroy();
  });

  it('recognizes an alive second-form refill checkpoint without treating it as a final defeat',()=>{
    const d=CONTENT_BY_ID['boss:captain-varr'];
    if(d.kind!=='creature')throw new Error('Missing boss fixture');
    const alive={...initialContentState(d),hp:0,defeated:false,bossPhase:{phase:2 as const,refill:{elapsedMs:0,startRatio:0}}};
    const world:ContentWorldState={states:{[d.id]:alive},spawns:{},nextSpawnSequence:0};
    useGameStore.setState({defeatedBosses:['captain-varr'],worldContent:world});
    const defeated={...world,states:{[d.id]:{...alive,defeated:true,bossPhase:undefined}}};
    expect(useGameStore.getState().recordEnemyDefeat(d.enemyId,20,11,'captain-varr',defeated,d.id)).toBe(true);
    expect(useGameStore.getState().recordEnemyDefeat(d.enemyId,20,11,'captain-varr',defeated,d.id)).toBe(false);
  });
});

describe('incremental terrain startup',()=>{
  it('keeps initial samples unpublished until complete and abandons obsolete destination work',()=>{
    const field=new ElevationField();
    let sampled=0;
    field.setSource((x,y)=>{sampled++;return x*.01+y*.02;});
    const view={left:0,top:0,right:800,bottom:600};
    try{
      field.prepare(view,true,{x:0,y:0});
      expect(sampled).toBe(0);expect(field.readyAt({x:0,y:0})).toBe(false);
      field.preload(view,true,1);
      expect(sampled).toBeGreaterThan(0);expect(sampled).toBeLessThan(129*129);
      expect(field.initialized).toBe(false);
      const destination={x:20000,y:20000};
      field.prepare(view,true,destination);
      for(let i=0;i<1000&&!field.initialized;i++)field.preload(view,true,1);
      expect(field.readyAt(destination)).toBe(true);
      expect(field.readyAt({x:0,y:0})).toBe(false);
      expect(field.height(destination.x,destination.y)).toBeCloseTo(600);
    }finally{field.destroy();}
  });
});
