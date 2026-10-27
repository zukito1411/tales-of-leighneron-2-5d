# Exterior structure scale and collision

Ordinary buildings are sized against the existing standing body reference.
Their fitted lots provide the horizontal frontage; complete elevations, including
roofs, windows and upper floors, rise together around the existing foot anchor.
Door widths follow doorway height instead of consuming most of a small facade.
Approved artwork, material details, actor sizes and camera settings are retained.

Architecture profiles live in `src/data/architecture.ts`. The renderer and gate
collision use these same profiles. Open gates and ruins have two solid supports
through their full modeled depth; the center remains passable. Authored capital
and elven gate apertures share their dimensions with the mesh generator. Closed
royal gates are solid. Surveyed curtain segments retain their ground seams and
have a standing-body height floor.

`propPlacementBounds` describes the structure's actual ground occupation;
`spriteBounds` retains the illustrated bounds for streaming and screen coverage.
Settlement fitting protects streets, crops, neighboring structures, shrine
approaches and the real NPC positions from `npcPositions.json`. Constrained
households fit their original plots first; remaining buildings search nearby
clear space in the same ward. Interior IDs remain stable and entry locations
continue to derive from the final exterior placements.

`settlementOccupancy.json` records the buildings, trees and decorations visible
before this scale revision, after the old content preparation pass. Fitting keeps
that set and its object counts. Previously unfilled optional plots do not become
extra runtime objects as a side effect of reflow. Update this authored admission
plan when intentionally adding or retiring settlement content. The regression
checks verify the retained IDs after full world-content preparation, not only
before subsequent placement passes run.

Conflicting court decorations enter the existing loose-object placement pass
instead of disappearing. Their final coordinates are published back to the
layout and they are registered once. Placement grids are lazy and bounded to
eight cached radii; all fitting occurs during content preparation, not per frame.
Existing streaming, model instancing, static geometry caches and staged collider
activation/retirement remain in use. Service-building lights follow the same
vertical scale as their window surfaces.

Focused checks cover all town lots, actual outdoor NPC standing positions,
interior entrance clearances, retained content IDs, and gate/ruin openings.
The browser fixture uses production atlas preparation, Three presentation and
WorldSpriteSystem with player, guard and villager artwork. It checks rotated
gates, closed gates and full-depth pillar collision, and captures front/side views.
A fixture review does not establish full-world Android performance.
