import {artFrameSize} from './art';
import {citadelPlanning} from './settlementPlanning';
import {TOWN_BY_ID} from './towns';
import type {Rect} from './settlementGeometry';

// Shared by the settlement planner, landmark registration and saved-position
// migration. Reserve the grove before fitting any surrounding architecture.
export const ELARION_LIFE_TREE_ID='landmark:elarion-tree-of-life';
export const ELARION_LIFE_TREE_SCALE=.8;
const town=TOWN_BY_ID.elarion,court=citadelPlanning(town.id)!;
export const ELARION_LIFE_TREE_LOCAL={x:court.x+400,y:-260};
export const ELARION_LIFE_TREE_POSITION={
  x:town.world.x+ELARION_LIFE_TREE_LOCAL.x,
  y:town.world.y+ELARION_LIFE_TREE_LOCAL.y,
};
// The round 3D crown and roots extend on both sides of the trunk. A flat
// sprite's north-only bounds cannot protect this model from nearby houses.
// These conservative bounds include the source-width canopy and leaf sprays;
// they are a planning reservation, never an invisible player collider.
const width=artFrameSize('elarion_tree',0).width*ELARION_LIFE_TREE_SCALE;
export const ELARION_LIFE_TREE_CLEARING:Rect={
  left:ELARION_LIFE_TREE_LOCAL.x-width*.66,
  right:ELARION_LIFE_TREE_LOCAL.x+width*.66,
  top:ELARION_LIFE_TREE_LOCAL.y-width*.55,
  bottom:ELARION_LIFE_TREE_LOCAL.y+width*.55,
};
