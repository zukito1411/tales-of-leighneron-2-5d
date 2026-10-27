import {describe,expect,it} from 'vitest';
import {Matrix4,Vector3} from 'three';
import {architectureMinimumWidth,architectureProfile,architecturePassageFootprints,authoredGateOpening} from '../src/data/architecture';
import {SETTLEMENT_LAYOUTS,buildingBounds,buildingRenderScale} from '../src/data/settlements';
import {artFrameSize} from '../src/data/art';
import {overlaps,rectTouchesStreet,spriteBounds} from '../src/data/settlementGeometry';
import occupancy from '../src/data/settlementOccupancy.json';
import {HERO_BODY_HEIGHT} from '../src/data/heroBodyRegistration';
import {sizeHouseForPlayer,applyHouseRise,type HouseShape} from '../src/game/presentation25d/HouseGeometry';
import {WORLD_CONTENT} from '../src/data/content';
import {NPCS} from '../src/data/npcs';
import {NPC_POSITIONS} from '../src/data/npcPositions';
import {NPC_INTERIOR_BY_ID,INTERIOR_ENTRIES} from '../src/data/interiors';
import {TOWN_BY_ID} from '../src/data/towns';
import {worldSpriteProfile} from '../src/data/worldSpriteGeometry';

describe('architecture scale and clearance',()=>{
  it('fits complete house frontages without covering a street or neighboring admitted lot',()=>{
    const registrations=new Map<string,number>();
    for(const d of WORLD_CONTENT)registrations.set(d.id,(registrations.get(d.id)??0)+1);
    for(const layout of SETTLEMENT_LAYOUTS){
      const active=layout.buildings.filter(lot=>!lot.omitted);
      for(const [i,lot] of active.entries()){
        const texture=lot.appearance?.texture??'world_buildings',frame=lot.appearance?.frame??lot.frame;
        expect(artFrameSize(texture,frame).width*buildingRenderScale(lot),layout.townId+'/'+lot.label)
          .toBeGreaterThanOrEqual(architectureMinimumWidth(texture,frame)-.001);
        const bounds=buildingBounds(lot);
        for(const road of layout.streets)expect(rectTouchesStreet(bounds,road),layout.townId+'/'+lot.label+'/'+road.id).toBe(false);
        for(const other of active.slice(i+1))expect(overlaps(bounds,buildingBounds(other)),layout.townId+'/'+lot.label+'/'+other.label).toBe(false);
      }
      const prior=occupancy[layout.townId as keyof typeof occupancy];
      for(const index of prior.buildings)expect(layout.buildings[index]?.omitted,layout.townId+'/'+index).not.toBe(true);
      expect(active.length).toBe(prior.buildings.length);
      for(const index of prior.buildings)expect(registrations.get(`town:${layout.townId}:building:${index}`)).toBe(1);
      for(const id of [...prior.plantings,...prior.details])expect(registrations.get(`detail:${layout.townId}:${id}`),id).toBe(1);
      expect(layout.plantings.map(p=>p.id).sort(),layout.townId+' trees').toEqual([...prior.plantings].sort());
      expect(layout.details?.map(p=>p.id).sort(),layout.townId+' details').toEqual([...prior.details].sort());
    }
  });
  it('keeps actual outdoor resident feet and building entrances outside the fitted ground volumes',()=>{
    for(const layout of SETTLEMENT_LAYOUTS){
      const buildings=layout.buildings.filter(lot=>!lot.omitted).map(lot=>({lot,bounds:buildingBounds(lot)}));
      for(const npc of NPCS.filter(n=>n.townId===layout.townId&&!NPC_INTERIOR_BY_ID[n.id])){
        const point=NPC_POSITIONS[npc.id]?.position??npc.worldOffset;
        const feet={left:point.x-9,right:point.x+9,top:point.y-20,bottom:point.y};
        for(const building of buildings)expect(overlaps(feet,building.bounds),npc.id+'/'+building.lot.label).toBe(false);
      }
      const town=TOWN_BY_ID[layout.townId];
      for(const entry of INTERIOR_ENTRIES.filter(e=>e.townId===layout.townId)){
        const feet={left:entry.door.x-town.world.x-9,right:entry.door.x-town.world.x+9,
          top:entry.door.y-town.world.y-20,bottom:entry.door.y-town.world.y};
        for(const building of buildings)expect(overlaps(feet,building.bounds),entry.name+'/'+building.lot.label).toBe(false);
      }
    }
  });
  it('raises the complete elevation around its existing foot instead of adding a tall ground-floor extension',()=>{
    for(const frame of [0,1,2]){
      const shape:HouseShape={profile:architectureProfile('world_buildings',frame)!,left:.02,top:.04,width:.95,height:.92,depth:.665,ground:1};
      sizeHouseForPlayer(shape,180);
      expect(shape.floorLift).toBe(0);
      expect(shape.doorHeight!*180*shape.riseScale!).toBeCloseTo(HERO_BODY_HEIGHT*1.25);
      const foot=.5-shape.top-shape.ground!*shape.height;
      const matrix=new Matrix4();applyHouseRise(matrix,shape);
      expect(new Vector3(0,foot,0).applyMatrix4(matrix).y).toBeCloseTo(foot);
      expect(matrix.elements[0]).toBe(1);expect(matrix.elements[10]).toBe(1);
    }
  });
  it('reserves the back of a wide model even when its facade painting is shallow',()=>{
    const size=artFrameSize('capital_buildings',8),bounds=spriteBounds('capital_buildings',8,2,500,800);
    expect(bounds.top).toBeLessThanOrEqual(800-size.width*2*architectureProfile('capital_buildings',8)!.depth);
  });
  it('keeps full-depth gate masonry on both sides of the mesh aperture',()=>{
    const opening=authoredGateOpening();
    for(const texture of ['capital_buildings','elven_villas'] as const){
      const profile=architectureProfile(texture,3)!,pillars=architecturePassageFootprints(profile)!;
      expect(pillars).toHaveLength(2);
      expect(pillars[0].right).toBeGreaterThan(opening.left);
      expect(pillars[1].left).toBeLessThan(opening.right);
      expect(pillars.every(p=>p.back<-profile.depth*.8&&p.front>=0)).toBe(true);
      expect(pillars.every(p=>.5<p.left||.5>p.right)).toBe(true);
    }
  });
  it('retains a real passage through every surveyed open gate and ruin',()=>{
    for(const [texture,frames] of [['royal_walls',[5]],['walls',[20,21,22,24]],['world_buildings',[4]],['world_objects',[2]]] as const){
      for(const frame of frames){
        const profile=architectureProfile(texture,frame)!,parts=architecturePassageFootprints(profile)!;
        expect(parts[0].right).toBeLessThan(parts[1].left);
        expect(parts.every(p=>p.back===-profile.depth)).toBe(true);
      }
    }
    expect(worldSpriteProfile('royal_walls',4)?.forceSolid).toBe(true);
    expect(architecturePassageFootprints(architectureProfile('royal_walls',4)!)).toBeUndefined();
  });
});
