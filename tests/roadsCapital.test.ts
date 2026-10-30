import { describe,it,expect } from 'vitest';
import { ROAD_ROUTES,segmentDistance } from '../src/data/roadRoutes';
import { ROAD_CONNECTIONS,TOWN_BY_ID } from '../src/data/towns';
import { SETTLEMENT_BY_ID } from '../src/data/settlements';
import { HIGHMERE_RIVER,onHighmereBridge,onHighmereRiver } from '../src/data/rivers';
import {HIGHMERE_PLAN} from '../src/data/highmerePlan';
import { WorldGenerator } from '../src/game/systems/WorldGenerator';

describe('authored mainland circulation and Highmere',() => {
  const world = new WorldGenerator(), city = TOWN_BY_ID.highmere.world;
  it('connects the existing physical town graph with walkable continuous corridors',() => {
    expect(ROAD_ROUTES).toHaveLength(ROAD_CONNECTIONS.length);
    for (const route of ROAD_ROUTES) {
      expect(route.points[0]).toEqual(TOWN_BY_ID[route.from].world);
      expect(route.points.at(-1)).toEqual(TOWN_BY_ID[route.to].world);
      for (let j = 1; j < route.points.length; j++) {
        const a = route.points[j - 1],b = route.points[j],length = Math.hypot(b.x - a.x,b.y - a.y);
        for (let step = 0; step <= Math.ceil(length / 160);step++) {
          const x = a.x + (b.x - a.x) * step / Math.ceil(length / 160), y = a.y + (b.y - a.y) * step / Math.ceil(length / 160);
          expect(world.isWalkable(x,y),`${route.id} at ${x},${y}`).toBe(true);
          expect(world.isRoad(x,y),`${route.id} missing road at ${x},${y}`).toBe(true);
        }
        expect(segmentDistance(a,a,b)).toBe(0);
      }
    }
  });
  it('gives the capital its own paved districts and three river crossings',() => {
    const layout = SETTLEMENT_BY_ID.highmere;
    expect(layout.authored).toBe(true);
    expect(layout.buildings.length).toBeGreaterThanOrEqual(18);
    expect(layout.parcels.some(p => p.id === 'crown-ward')).toBe(true);
    expect(world.getTerrainAt(city.x,city.y)).toBe('stone');
    const riverX = city.x + HIGHMERE_PLAN.riverX;
    expect(onHighmereRiver(riverX,city.y - 300)).toBe(true);
    expect(world.getTerrainAt(riverX,city.y - 300)).toBe('water');
    for (const bridgeY of HIGHMERE_RIVER.bridgeY.filter(y=>y<=650)) {
      const y = city.y + bridgeY;
      expect(onHighmereBridge(riverX,y)).toBe(true);
      expect(world.getTerrainAt(riverX,y)).toBe('stone');
      expect(world.isWalkable(riverX,y)).toBe(true);
    }
  });
});
