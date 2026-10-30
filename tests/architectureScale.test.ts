import {describe,expect,it} from 'vitest';
import {Matrix4,Vector3} from 'three';
import {architectureMinimumWidth,architectureMinimumScale,architectureProfile,architecturePassageFootprints,authoredGateOpening} from '../src/data/architecture';
import {SETTLEMENT_LAYOUTS,buildingBounds,buildingRenderScale} from '../src/data/settlements';
import {artFrameSize} from '../src/data/art';
import {overlaps,rectTouchesStreet,spriteBounds,propPlacementBounds} from '../src/data/settlementGeometry';
import occupancy from '../src/data/settlementOccupancy.json';
import {HERO_BODY_HEIGHT} from '../src/data/heroBodyRegistration';
import {sizeHouseForPlayer,applyHouseRise,type HouseShape} from '../src/game/presentation25d/HouseGeometry';
import {WORLD_CONTENT} from '../src/data/content';
import {NPCS} from '../src/data/npcs';
import {NPC_POSITIONS} from '../src/data/npcPositions';
import {NPC_INTERIOR_BY_ID,INTERIOR_ENTRIES} from '../src/data/interiors';
import {TOWN_BY_ID} from '../src/data/towns';
import {citadelPlanning,settlementGroundPlan,settlementEnvelope} from '../src/data/settlementPlanning';
import {fortificationBlocksPoint} from '../src/data/fortifications';
import {insideDefense} from '../src/data/settlementDefenses';
import {worldSpriteProfile} from '../src/data/worldSpriteGeometry';
import {HIGHMERE_PLAN} from '../src/data/highmerePlan';

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
      expect.soft([...prior.plantings,...prior.details].filter(id=>registrations.get(`detail:${layout.townId}:${id}`)!==1),layout.townId+' retained details').toEqual([]);
      if(layout.townId==='highmere'){
        for(const id of prior.plantings)expect(layout.plantings.some(p=>p.id===id),id).toBe(true);
        for(const id of prior.details)expect(layout.details?.some(p=>p.id===id),id).toBe(true);
      }else{
        expect(layout.plantings.map(p=>p.id).sort(),layout.townId+' trees').toEqual([...prior.plantings].sort());
        expect(layout.details?.map(p=>p.id).sort(),layout.townId+' details').toEqual([...prior.details].sort());
      }
    }
  });
  it('provides a real gate-to-door forecourt and removes empty rectangular corners beside keeps',()=>{
    const gate=WORLD_CONTENT.find(d=>d.id==='fort:highmere:south-gate');
    if(!gate||!('frame' in gate))throw new Error('Royal gate missing');
    const door=INTERIOR_ENTRIES.find(e=>e.name==='Crown Hall')!.door;
    const gateDepth=artFrameSize('royal_walls',5).width*(gate.scale??1)*architectureProfile('royal_walls',5)!.depth;
    expect(gate.world.y-gateDepth-door.y).toBeGreaterThan(HERO_BODY_HEIGHT*8);
    for(const layout of SETTLEMENT_LAYOUTS){
      const town=TOWN_BY_ID[layout.townId],plan=settlementGroundPlan(town),bounds=settlementEnvelope(town);
      if(town.id==='highmere'){
        expect(plan.vertices).toHaveLength(HIGHMERE_PLAN.segments);
        for(const p of plan.vertices)expect(Math.hypot(p.x,p.y)).toBeCloseTo(HIGHMERE_PLAN.radius,5);
        continue;
      }
      for(const [i,p] of plan.vertices.entries()){
        const next=plan.vertices[(i+1)%plan.vertices.length];
        expect(p.x===next.x||p.y===next.y,layout.townId).toBe(true);
      }
      if(!citadelPlanning(town.id))continue;
      const [core,precinct]=plan.rectangles;
      const area=(core.right-core.left)*(core.bottom-core.top)+(precinct.right-precinct.left)*(core.top-precinct.top);
      expect(area,layout.townId).toBeLessThan((bounds.right-bounds.left)*(bounds.bottom-bounds.top)*.95);
    }
  });
  it('keeps admitted outdoor assets and NPC feet out of the final building volumes and walls',()=>{
    const collisions:string[]=[];
    for(const layout of SETTLEMENT_LAYOUTS){
      const town=TOWN_BY_ID[layout.townId];
      const buildings=layout.buildings.map((lot,index)=>({id:`town:${town.id}:building:${index}`,lot,bounds:buildingBounds(lot)})).filter(b=>!b.lot.omitted);
      const props=WORLD_CONTENT.filter(d=>'frame' in d&&d.kind!=='settlement-prop'&&Math.abs(d.world.x-town.world.x)<10000&&Math.abs(d.world.y-town.world.y)<6000);
      for(const definition of props){
        if(!('frame' in definition)||worldSpriteProfile(definition.texture??'world_objects',definition.frame)?.floor)continue;
        const bounds=propPlacementBounds(definition.texture??'world_objects',definition.frame,definition.scale??1,definition.world.x-town.world.x,definition.world.y-town.world.y,false,'wallSegment' in definition?definition.wallSegment:undefined);
        for(const building of buildings)if(definition.id!==building.id&&overlaps(bounds,building.bounds))collisions.push(definition.id+'/'+building.id);
      }
      for(const npc of NPCS.filter(n=>n.townId===town.id&&!NPC_INTERIOR_BY_ID[n.id])){
        const p=NPC_POSITIONS[npc.id]?.position??npc.worldOffset;
        if(fortificationBlocksPoint(town.world.x+p.x,town.world.y+p.y,12))collisions.push('wall/'+npc.id);
      }
    }
    expect(collisions).toEqual([]);
  });
  it('retains the constrained Tidewatch lamp in a clear position after larger houses are fitted',()=>{
    const lamp=WORLD_CONTENT.find(d=>d.id==='detail:tidewatch:street-lamp:2');
    expect(lamp).toBeDefined();
    if(!lamp||!('frame' in lamp))throw new Error('Tidewatch lamp was removed');
    const town=TOWN_BY_ID.tidewatch,layout=SETTLEMENT_LAYOUTS.find(l=>l.townId===town.id)!;
    const bounds=spriteBounds(lamp.texture??'world_objects',lamp.frame,lamp.scale??1,lamp.world.x-town.world.x,lamp.world.y-town.world.y);
    for(const lot of layout.buildings.filter(l=>!l.omitted))expect(overlaps(bounds,buildingBounds(lot),16),lot.label).toBe(false);
    for(const road of layout.streets)expect(rectTouchesStreet(bounds,road,12),road.id).toBe(false);
    expect(insideDefense(town.id,lamp.world.x,lamp.world.y,-64)).toBe(true);
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
  it('fits the complete building uniformly without stretching elevations or doorway details',()=>{
    for(const frame of [0,1,2]){
      const shape:HouseShape={profile:architectureProfile('world_buildings',frame)!,left:.02,top:.04,width:.95,height:.92,depth:.665,ground:1};
      sizeHouseForPlayer(shape,180);
      expect(shape.floorLift).toBe(0);
      expect(shape.riseScale).toBe(1);
      expect(shape.doorHeight).toBeUndefined();
      const size=artFrameSize('world_buildings',frame),scale=architectureMinimumScale('world_buildings',frame,size.width,size.height);
      expect(size.width*scale).toBeGreaterThanOrEqual(architectureMinimumWidth('world_buildings',frame)-.001);
      const doorFraction=frame===1?.24:.28;
      expect(size.height*scale*doorFraction).toBeGreaterThanOrEqual(HERO_BODY_HEIGHT*1.25-.001);
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
