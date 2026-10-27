import { createNoise2D } from 'simplex-noise';
import type { RegionId, TerrainKind, Vec2 } from '../types';
import { REGIONS } from '../../data/regions';
import { TOWN_BY_ID, TOWNS } from '../../data/towns';
import { onRoadRoute,roadSurfaceAt } from '../../data/roadRoutes';
import { onHighmereBridge, onHighmereRiver, onSettlementRiver,onWildernessBridge } from '../../data/rivers';
import {drainageDistance,harborBay,harborShoreDistance,LAVA_FLOW,pathDistance,RIDGES,onHeadwaterStream,WOODLAND_UPLANDS,CROWN_DOWNS} from '../../data/worldLandscape';
import { CHUNK_SIZE, WORLD_SEED, WORLD_WIDTH, WORLD_HEIGHT } from '../../data/world';
import { seededRandom } from '../../utils/seededRandom';
import { FARM_PLOTS } from '../../data/landmarks';
import {SETTLEMENT_LAYOUTS,settlementAt,settlementTerrain,onStreet,protectedSettlementAt} from '../../data/settlements';
import {settlementGroundPlan} from '../../data/settlementPlanning';
import { fortificationBlocksPoint } from '../../data/fortifications';
import {lakeAt,lakeShoreDistance} from '../../data/landscapeFeatures';
import {dragonLairTerrain,onDragonTrail} from '../../data/dragonLair';
import {ASHEN_DOCK_ROAD,onPortDeck} from '../../data/ports';
import {onFlagshipBoarding,flagshipWalkable} from '../../data/pirateFlagship';
import {inTowerClearing,onTowerApproach} from '../../data/towerOfMight';
import {RIVER_BED,SEA_BED} from '../../data/waterLevels';

const noise2D = createNoise2D(seededRandom(WORLD_SEED));
const mainlandRegions=REGIONS.filter(region=>!['darkav','frostlands','portquill'].includes(region.id));
// Rectangular foundations use the same bounds as their walls and road gates.
const foundations=SETTLEMENT_LAYOUTS.flatMap(layout=>{
  const town=TOWN_BY_ID[layout.townId];
  return settlementGroundPlan(town).rectangles.map(bounds=>({left:town.world.x+bounds.left,right:town.world.x+bounds.right,
    top:town.world.y+bounds.top,bottom:town.world.y+bounds.bottom}));
});

const TERRAIN_INDEX: Record<TerrainKind, number> = {
  grass: 0,
  forest: 4,
  dirt: 1,
  stone: 2,
  snow: 6,
  ash: 8,
  sand: 5,
  water: 7,
  farmland: 3,
  marsh:9,lava:10,ice:11,
};

function ellipseContains(chunkX: number, chunkY: number, cx: number, cy: number, rx: number, ry: number) {
  const dx = (chunkX - cx) / rx;
  const dy = (chunkY - cy) / ry;
  const edgeNoise = noise2D(chunkX * 0.08, chunkY * 0.08) * 0.12;
  return dx * dx + dy * dy < 1 + edgeNoise;
}

export class WorldGenerator {
  /** Stable height in the existing XY world. Painted roads follow these slopes;
   * settlements and shorelines retain their authored ground registration. */
  getElevationAt(x:number,y:number):number {
    if(inTowerClearing(x,y)||onTowerApproach(x,y))return 0;
    const terrain=this.getGroundTerrainAt(x,y);
    // Water is carved before town foundation flattening. Otherwise settlement
    // rivers are silently raised back to the same plane as their streets.
    if(terrain==='water')return this.getRegionAt(x,y)==='dead-sea'||harborBay(x,y)?SEA_BED:RIVER_BED;
    const bank=drainageDistance(x,y);
    // A narrow brook can lie between two 64-unit terrain vertices. Give its
    // immediate banks a shallow shoulder so it is not lost at that sampling
    // alignment. The existing grid/cache/budget are unchanged.
    if(bank>=0&&bank<48&&terrain!=='ice'&&terrain!=='lava')return RIVER_BED*.65*(1-bank/48)**2;
    let foundation=1;
    for(const f of foundations){
      const dx=Math.max(f.left-x,0,x-f.right),dy=Math.max(f.top-y,0,y-f.bottom);
      if(dx>384||dy>384)continue;
      const outside=Math.hypot(dx,dy);
      if(outside<=0)return 0;
      const t=Math.min(1,outside/384);foundation=Math.min(foundation,t*t*(3-2*t));
    }
    if(terrain==='lava'||terrain==='ice'||terrain==='farmland')return 0;
    const coast=Math.max(0,Math.min(1,(Math.min(bank,harborShoreDistance(x,y),lakeShoreDistance(x,y))-120)/700));
    const biome=this.getBiomeAt(x,y),amplitude=biome==='highland'?165:biome==='snowfield'?115:biome==='volcanic'?95:biome==='forest'?58:biome==='coast'?14:36;
    const hill=Math.max(0,noise2D(x*.0008,y*.0008)*.55+noise2D(x*.00032,y*.00032)*.30+noise2D(x*.0018,y*.0018)*.15+.35);
    return hill*amplitude*coast*coast*(3-2*coast)*foundation;
  }
  getFootstepSurface(x:number,y:number):'grass'|'stone'|'snow'|'wood'{
    if(onPortDeck(x,y)||onFlagshipBoarding(x,y)||onWildernessBridge(x,y)||onHighmereBridge(x,y))return 'wood';
    const terrain=this.getTerrainAt(x,y);
    if(terrain==='snow'||terrain==='ice')return 'snow';
    if(terrain==='stone'||terrain==='lava'||terrain==='ash'||terrain==='sand')return 'stone';
    return 'grass';
  }

  getBiomeAt(x:number,y:number){
    return this.biomeInRegion(x,y,this.getRegionAt(x,y));
  }
  private biomeInRegion(x:number,y:number,region:RegionId){
    const cx=x/CHUNK_SIZE,cy=y/CHUNK_SIZE;
    if(region==='dead-sea'||harborBay(x,y))return 'coast';
    const island=region==='portquill'?[27,70,13,11]:region==='frostlands'?[99,70,11,14]:region==='darkav'?[105,10,9,8]:[55,37,49,34];
    const coast=Math.abs(1-Math.hypot((cx-island[0])/island[2],(cy-island[1])/island[3]))*Math.min(island[2],island[3])*CHUNK_SIZE;
    if(coast<1100||harborShoreDistance(x,y)<750)return 'coast';
    if(region==='darkav')return 'volcanic';
    if(region==='frostlands')return 'snowfield';
    if(drainageDistance(x,y)<750&&region==='druganwoods'&&cy>58)return 'wetland';
    if(region==='nardorous')return pathDistance(x,y,RIDGES)<5500?'snowfield':'highland';
    if(region==='rindass')return drainageDistance(x,y)<500?'meadow':cy<49&&pathDistance(x,y,RIDGES)<3000?'highland':'dryland';
    const cibar=TOWN_BY_ID['cibar-plains'].world;
    if(Math.hypot((x-cibar.x)/1.3,y-cibar.y)<6500)return 'meadow';
    const uplandWidth=1400+noise2D(x*.00025,y*.00025)*650;
    if((region==='druganwoods'&&pathDistance(x,y,WOODLAND_UPLANDS,2500)<uplandWidth)||
      (region==='trandum'&&pathDistance(x,y,CROWN_DOWNS,2000)<uplandWidth*.65))return 'highland';
    const cover=noise2D(x*.00012,y*.00012);
    const crown=Math.hypot(cx-25,cy-23),wood=Math.min(Math.hypot(cx-56,cy-16),Math.hypot(cx-58,cy-62));
    const transition=Math.max(0,Math.min(1,.5+(crown-wood)/18));
    return cover>.48-.83*transition?'forest':'meadow';
  }
  getRegionAt(worldX: number, worldY: number): RegionId {
    const chunkX = worldX / CHUNK_SIZE;
    const chunkY = worldY / CHUNK_SIZE;

    if (ellipseContains(chunkX, chunkY, 105, 10, 9, 8)) return 'darkav';
    if (ellipseContains(chunkX, chunkY, 99, 70, 11, 14)) return 'frostlands';
    if (ellipseContains(chunkX, chunkY, 27, 70, 13, 11)) return 'portquill';

    if (!ellipseContains(chunkX, chunkY, 55, 37, 49, 34)) return 'dead-sea';

    const mainland = mainlandRegions;
    let best = mainland[0];
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const region of mainland) {
      const dx = chunkX - region.centerChunk.x;
      const dy = chunkY - region.centerChunk.y;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = region;
      }
    }
    return best.id;
  }

  getTerrainAt(worldX:number,worldY:number):TerrainKind {
    // Preserve navigation/content/minimap semantics; artwork samples the bed
    // independently so a walkable ship does not manufacture a dirt island.
    if(onFlagshipBoarding(worldX,worldY))return 'dirt';
    if(onHighmereBridge(worldX,worldY)||onWildernessBridge(worldX,worldY))return 'stone';
    return this.getGroundTerrainAt(worldX,worldY);
  }

  getGroundTerrainAt(worldX:number,worldY:number):TerrainKind {
    const regionId = this.getRegionAt(worldX, worldY);
    if (regionId === 'dead-sea') return 'water';
    // Authored foundation, shared with scenery reservations.
    if(inTowerClearing(worldX,worldY))return 'stone';
    if(onTowerApproach(worldX,worldY))return 'dirt';
    // Sample water beneath raised structures. The walkable decks remain
    // separate meshes and keep their original navigation predicates.
    if (onHighmereRiver(worldX,worldY)) return 'water';
    if(harborBay(worldX,worldY))return 'water';
    // A wide settlement reservation must not erase a real tributary or its
    // bridge in the agricultural approaches outside the built-up wards.
    if(onHeadwaterStream(worldX,worldY))return 'water';

    const layout = settlementAt(worldX,worldY);
    if (layout) {
      const town = TOWN_BY_ID[layout.townId];
      return settlementTerrain(layout,worldX - town.world.x,worldY - town.world.y);
    }

    if(onSettlementRiver(worldX,worldY))return 'water';
    if(regionId==='darkav'){const lair=dragonLairTerrain(worldX,worldY);if(lair)return lair;}
    if(regionId==='darkav'&&pathDistance(worldX,worldY,ASHEN_DOCK_ROAD,80)<48)return 'ash';

    const road=roadSurfaceAt(worldX,worldY);if(road)return road;
    if (FARM_PLOTS.some(plot => Math.abs(worldX - plot.x) < plot.width / 2 && Math.abs(worldY - plot.y) < plot.height / 2)) return 'farmland';
    const lake=lakeAt(worldX,worldY);if(lake)return lake.frozen?'ice':'water';

    const region = REGIONS.find((entry) => entry.id === regionId);
    if (!region) return 'grass';

    const biome=this.biomeInRegion(worldX,worldY,regionId),n=noise2D(worldX*.0002,worldY*.0002);
    if(biome==='coast')return regionId==='frostlands'?'snow':regionId==='darkav'?'stone':'sand';
    if(biome==='wetland')return n>.35?'grass':'marsh';
    if(biome==='snowfield')return n<-.45?'stone':'snow';
    if(biome==='highland')return regionId==='rindass'?(n>.2?'dirt':'stone'):n>-.05?'grass':'stone';
    if(biome==='volcanic')return pathDistance(worldX,worldY,LAVA_FLOW,220)<110?'lava':n>.1?'ash':'stone';
    if(biome==='dryland')return n<-.25?'dirt':'sand';
    return biome==='forest'?'forest':'grass';
  }

  getTerrainIndex(kind: TerrainKind) {
    return TERRAIN_INDEX[kind];
  }

  distanceToWater(x:number,y:number){
    return Math.min(drainageDistance(x,y),harborShoreDistance(x,y),lakeShoreDistance(x,y));
  }

  isWalkable(worldX: number, worldY: number) {
    if(onFlagshipBoarding(worldX,worldY))return flagshipWalkable(worldX,worldY);
    return Number.isFinite(worldX) && Number.isFinite(worldY) && worldX >= 0 && worldY >= 0
      && worldX < WORLD_WIDTH && worldY < WORLD_HEIGHT && (onPortDeck(worldX,worldY)||!['water','lava'].includes(this.getTerrainAt(worldX, worldY)))
      && !fortificationBlocksPoint(worldX,worldY);
  }

  /** Ground motion must not leap over a narrow channel between valid endpoints.
   * This is movement clearance, not line of sight: arrows may cross water. */
  isWalkablePath(from:Vec2,to:Vec2) {
    if(!Number.isFinite(from.x)||!Number.isFinite(from.y)||!Number.isFinite(to.x)||!Number.isFinite(to.y))return false;
    const dx=to.x-from.x,dy=to.y-from.y,distance=Math.hypot(dx,dy);
    if(!Number.isFinite(distance))return false;
    if(distance<.01)return this.isWalkable(to.x,to.y);
    const steps=Math.max(1,Math.ceil(distance/8));
    for(let i=0;i<=steps;i++)if(!this.isWalkable(from.x+dx*i/steps,from.y+dy*i/steps))return false;
    return true;
  }

  canCreatureOccupy(worldX: number, worldY: number) {
    return this.isWalkable(worldX,worldY) && !protectedSettlementAt(worldX,worldY);
  }

  isRoad(worldX: number, worldY: number, clearance = 0) {
    if(pathDistance(worldX,worldY,ASHEN_DOCK_ROAD,96+clearance)<48+clearance)return true;
    if(onDragonTrail(worldX,worldY,clearance))return true;
    const layout = settlementAt(worldX,worldY);
    if (layout) {
      const town = TOWN_BY_ID[layout.townId];
      if (layout.streets.some(s => onStreet(worldX - town.world.x,worldY - town.world.y,s,clearance))) return true;
    }
    return onRoadRoute(worldX,worldY,clearance);
  }

  getTownAt(worldX: number, worldY: number, radius?: number) {
    if (radius === undefined) {
      const layout = settlementAt(worldX,worldY);
      if (layout && this.getRegionAt(worldX,worldY) !== 'dead-sea') return TOWN_BY_ID[layout.townId];
    }
    let best: (typeof TOWNS)[number] | null = null;
    let bestDistance = radius ?? 420;
    for (const town of TOWNS) {
      const distance = Math.hypot(worldX - town.world.x, worldY - town.world.y);
      if (distance < bestDistance) {
        best = town;
        bestDistance = distance;
      }
    }
    return best;
  }
}
