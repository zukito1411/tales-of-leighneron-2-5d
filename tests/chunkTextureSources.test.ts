import {describe,expect,it} from 'vitest';
import {uniqueChunkSources} from '../src/game/systems/chunkTextureSources';

describe('movement-time terrain upload readiness',()=>{
  it('polls shared full-resolution atlases only once per chunk',()=>{
    const world={id:'world_assets'},leaves={id:'leaf_atlas'},ground={id:'ground'};
    const scenery=Array.from({length:180},(_,i)=>({frame:{source:i%5===0?leaves:world}}));
    const canopies=Array.from({length:55},()=>({frame:{source:leaves}}));
    const terrain=[{frame:{source:ground}}];
    const sources=uniqueChunkSources(scenery,canopies,terrain);
    expect(sources.size).toBe(3);
    expect([...sources]).toEqual([leaves,world,ground]);
  });
  it('keeps independent canvas sources distinct, even when they share an asset key',()=>{
    const a={key:'chunk:1:2'},b={key:'chunk:1:2'};
    const sources=uniqueChunkSources([{frame:{source:a}},{frame:{source:b}},{frame:{source:a}}]);
    expect(sources.size).toBe(2);
    expect(sources.has(a)).toBe(true);
    expect(sources.has(b)).toBe(true);
  });
  it('checks all sources again if a dynamic atlas changes while a chunk waits',()=>{
    const a={name:'painted-terrains'},b={name:'dynamic-lights'};
    const sources=uniqueChunkSources([{frame:{source:a}},{frame:{source:a}}],[{frame:{source:b}}]);
    let aReady=false,bReady=false;
    const check=()=>[...sources].every(source=>source===a?aReady:bReady);
    expect(check()).toBe(false);
    aReady=true;bReady=true;
    expect(check()).toBe(true);
    bReady=false;
    expect(check()).toBe(false);
  });
});
