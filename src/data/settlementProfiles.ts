export type SettlementProfileId =
  | 'oakmere' | 'highmere' | 'willowcross' | 'elarion' | 'moonfall' | 'starhold'
  | 'redmesa' | 'deepford' | 'tidewatch' | 'skallheim' | 'blackspire' | 'cibar-plains';

export interface SettlementDecoration {
  frame: number;
  x: number;
  y: number;
  scale: number;
  solid?: boolean;
}

export interface SettlementProfile {
  id: SettlementProfileId;
  architecture: string;
  defenses: string;
  bounds: { width: number; height: number };
  wallStyle: 'timber' | 'stone';
  citadel?:'castle'|'palace';
  wallFrame: number;
  wallTint: number;
  buildingTint: number;
  wallScale: number;
  wallSpacing: number;
  verticalWallFrame?: number;
  verticalWallSpacing?: number;
  gateTexture: 'walls' | 'bridges';
  gateFrame: number;
  gateWidth: number;
  gateScale: number;
  watchtowerFrame: number;
  buildingFrames: readonly number[];
  decorations: readonly SettlementDecoration[];
}

export const SETTLEMENT_PROFILES: Record<SettlementProfileId, SettlementProfile> = {
  'cibar-plains':{
    id:'cibar-plains',architecture:'Southern riverwood farmhouses and grain halls',defenses:'Joined rural stone curtain and guarded caravan passages',
    bounds:{width:2700,height:2600},wallStyle:'stone',wallFrame:18,wallTint:0xe8d9b7,buildingTint:0xf2e7c9,wallScale:1.1,wallSpacing:160,
    gateTexture:'walls',gateFrame:21,gateWidth:200,gateScale:1,watchtowerFrame:2,buildingFrames:[0,1,5,6,7],
    decorations:[{frame:6,x:-420,y:100,scale:.65},{frame:5,x:420,y:140,scale:.65},{frame:10,x:320,y:-230,scale:.6}],
  },
  oakmere: {
    id: 'oakmere', architecture: 'Trandum farmstead timber and limewash',
    defenses: 'Low orchard fencing with a broad crown-road gate',
    // Room for full-depth houses and their open front courts. This shared
    // survey also moves the enclosing fences/gates and outer-ward streets.
    bounds: { width: 2200, height: 2400 }, wallStyle: 'timber', wallFrame: 3, wallTint: 0xffffff,buildingTint:0xffffff,
    wallScale: 1.35, wallSpacing: 104, gateTexture: 'bridges', gateFrame: 8, gateWidth: 250, gateScale: 1,
    watchtowerFrame: 2, buildingFrames: [0, 1, 5, 6, 7],
    decorations: [{ frame: 4, x: 510, y: -110, scale: .52 }, { frame: 6, x: -470, y: -30, scale: .65 }],
  },
  highmere: {
    id: 'highmere',citadel:'castle', architecture: 'Trandum royal limestone and blue heraldry',
    defenses: 'High crenellated curtain wall, river gates, and crown towers',
    bounds: { width: 5600, height: 5200 }, wallStyle: 'stone', wallFrame: 18, wallTint: 0xffffff,buildingTint:0xfff6e5,
    wallScale: 1.45, wallSpacing: 224, gateTexture: 'walls', gateFrame: 21, gateWidth: 390, gateScale: .9,
    watchtowerFrame: 9, buildingFrames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    decorations: [
      { frame: 5, x: 390, y: -120, scale: .55 }, { frame: 6, x: -80, y: 165, scale: .6 },
      { frame: 11, x: 360, y: 185, scale: .55 }, { frame: 12, x: -1060, y: 140, scale: .5 },
    ],
  },
  willowcross: {
    id: 'willowcross', architecture: 'Trandum riverwood, slate, and bridge timber',
    defenses: 'Riverside palisade with guarded road and bridge approaches',
    bounds: { width: 2500, height: 2300 }, wallStyle: 'timber', wallFrame: 3, wallTint: 0xe7d5af,buildingTint:0xf0e5cf,
    wallScale: 1.35, wallSpacing: 104, gateTexture: 'walls', gateFrame: 20, gateWidth: 280, gateScale: .8,
    watchtowerFrame: 2, buildingFrames: [0, 1, 5, 6, 7],
    decorations: [{ frame: 4, x: 310, y: -130, scale: .5 }, { frame: 5, x: -390, y: 180, scale: .55 }],
  },
  elarion: {
    id: 'elarion',citadel:'palace', architecture: 'Narenthil pale stone grown through ancient greenwood',
    defenses: 'Mossed archways and low living-stone ramparts',
    bounds: { width: 3100, height: 2900 }, wallStyle: 'stone', wallFrame: 18, wallTint: 0xbad0a4,buildingTint:0xd9e8d0,
    wallScale: 1.35, wallSpacing: 218, gateTexture: 'walls', gateFrame: 22, gateWidth: 340, gateScale: .85,
    watchtowerFrame: 2, buildingFrames: [1, 0, 4, 5, 6, 7],
    decorations: [{ frame: 1, x: -420, y: -180, scale: .75 }, { frame: 10, x: 390, y: 170, scale: .62 }],
  },
  moonfall: {
    id: 'moonfall', architecture: 'Narenthil grove cottages among weathered standing stone',
    defenses: 'Broken old-stone boundary maintained as a quiet grove marker',
    bounds: { width: 2100, height: 2000 }, wallStyle: 'stone', wallFrame: 23, wallTint: 0xa6b59a,buildingTint:0xe1e8d7,
    wallScale: 1.1, wallSpacing: 205, gateTexture: 'walls', gateFrame: 22, gateWidth: 320, gateScale: .72,
    watchtowerFrame: 2, buildingFrames: [0, 4, 1, 5],
    decorations: [{ frame: 1, x: -310, y: -165, scale: .72 }, { frame: 10, x: 280, y: 150, scale: .58 }],
  },
  starhold: {
    id: 'starhold', architecture: 'Nardorous blue slate, iron, and snowbound granite',
    defenses: 'Layered mountain curtain walls and fortified pass gates',
    bounds: { width: 3200, height: 3000 }, wallStyle: 'stone', wallFrame: 18, wallTint: 0x9eafc2,buildingTint:0xc6d3e0,
    wallScale: 1.5, wallSpacing: 230, gateTexture: 'walls', gateFrame: 21, gateWidth: 390, gateScale: .9,
    watchtowerFrame: 9, buildingFrames: [2, 0, 1, 5, 6, 7, 9],
    decorations: [{ frame: 3, x: -380, y: -170, scale: .65 }, { frame: 12, x: 370, y: 170, scale: .6 }],
  },
  redmesa: {
    id: 'redmesa', architecture: 'Rindass red sandstone, hide, and clan timber',
    defenses: 'Broad sandstone ring with open caravan and clan gates',
    bounds: { width: 3000, height: 2800 }, wallStyle: 'stone', wallFrame: 18, wallTint: 0xc69a70,buildingTint:0xeac29a,
    wallScale: 1.4, wallSpacing: 224, gateTexture: 'walls', gateFrame: 20, gateWidth: 390, gateScale: .85,
    watchtowerFrame: 2, buildingFrames: [0, 7, 5, 1, 6],
    decorations: [{ frame: 3, x: -430, y: -150, scale: .68 }, { frame: 5, x: 370, y: 170, scale: .62 }],
  },
  deepford: {
    id: 'deepford',citadel:'castle', architecture: 'Druganwoods deep granite, ironwork, and carved halls',
    defenses: 'Thick cut-stone walls with defended river-road portals',
    bounds: { width: 3200, height: 2900 }, wallStyle: 'stone', wallFrame: 18, wallTint: 0xb1aaa0,buildingTint:0xd4cec5,
    wallScale: 1.5, wallSpacing: 230, gateTexture: 'walls', gateFrame: 21, gateWidth: 400, gateScale: .9,
    watchtowerFrame: 9, buildingFrames: [8, 5, 0, 1, 7, 9],
    decorations: [{ frame: 3, x: -410, y: -175, scale: .65 }, { frame: 6, x: 350, y: 170, scale: .62 }],
  },
  tidewatch: {
    id: 'tidewatch', architecture: 'Portquill weathered sea-stone and salt-dark timber',
    defenses: 'Harbor wall with protected quay gates and watch beacons',
    bounds: { width: 3000, height: 2500 }, wallStyle: 'stone', wallFrame: 18, wallTint: 0x9caeba,buildingTint:0xcad9df,
    wallScale: 1.4, wallSpacing: 224, gateTexture: 'walls', gateFrame: 20, gateWidth: 380, gateScale: .85,
    watchtowerFrame: 2, buildingFrames: [7, 0, 1, 5, 6],
    decorations: [{ frame: 5, x: -420, y: -180, scale: .65 }, { frame: 8, x: 380, y: 155, scale: .6 }],
  },
  skallheim: {
    id: 'skallheim', architecture: 'Frostlands tarred pine, carved beams, and blue ice',
    defenses: 'Snow berm and timber palisade with beaconed harbor gates',
    bounds: { width: 2800, height: 2400 }, wallStyle: 'timber', wallFrame: 3, wallTint: 0xc1cbd0,buildingTint:0xd7e0e2,
    wallScale: 1.45, wallSpacing: 108, gateTexture: 'bridges', gateFrame: 8, gateWidth: 330, gateScale: .9,
    watchtowerFrame: 9, buildingFrames: [0, 6, 7, 1, 2],
    decorations: [{ frame: 3, x: -390, y: -160, scale: .68 }, { frame: 13, x: 360, y: 170, scale: .65 }],
  },
  blackspire: {
    id: 'blackspire',citadel:'castle', architecture: 'Darkav black basalt, iron, and volcanic glass',
    defenses: 'Charcoal basalt curtain wall with heavily watched citadel gates',
    bounds: { width: 3200, height: 2900 }, wallStyle: 'stone', wallFrame: 18, wallTint: 0x55575c,buildingTint:0x55575c,
    wallScale: 1.5, wallSpacing: 230, gateTexture: 'walls', gateFrame: 21, gateWidth: 420, gateScale: .9,
    watchtowerFrame: 9, buildingFrames: [8, 2, 5, 0, 7, 9],
    decorations: [{ frame: 3, x: -400, y: -165, scale: .75 }, { frame: 13, x: 360, y: 170, scale: .7 }],
  },
};
