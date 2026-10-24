# Painted models, raised decks and atmosphere

## Artwork and model identity

Structural meshes retain closed sides, backs, rounded lids, legs, joinery and
character-relative furniture heights. Their timber, masonry and roofing now
sample the original object's painted atlas instead of replacing it with flat
procedural pigments. Material tiles use model-unit scale and mirrored repeats;
whole building paintings are not pasted across their fronts. Alpha-trimmed
building frames remap source material/feature crops into the retained rectangle.

Carved doors, windows, regional upholstery, quilts, book rows, cabinet panels,
cloth emblems, papers and small fittings use selected parts of the original art
on the corresponding model surfaces. Small planar keepsakes retain their art.
Regional centerpieces distinguish the alpine monument, dwarven forge, maritime
net stand, winter sofa, elven fountain, obsidian brazier and noble/orcan seats.
Smithies have recessed workshops, chimney masonry, workbenches and source fires.
Towers retain their circular construction and gain original painted materials
and selected windows/banners. Foliage retains its existing presentation.

Fire is cropped original artwork on a camera-facing plane within the existing
instanced model batch, with gentle shader sway/flicker. A warm-color mask rejects
stone/log pixels in the crop. It casts no solid cone shadow. Broken quest beacons
remain unlit, and the shared quest well has no invented canopy. Lantern panes
use their own artwork, including the blue story lantern. No new image files,
per-object textures, model draw passes or dependencies are introduced.

## Separate terrain and walk surfaces

WorldGenerator.getGroundTerrainAt supplies the natural bed to terrain baking,
GPU water masks and elevation. getTerrainAt retains navigation/content terrain
semantics. The flagship no longer bakes its walkable footprint as a dirt island.
Workers and their bounded fallback use the same bed predicate.

WalkSurface supplies exact existing deck footprints at authored heights to
characters, camera/attachment projection, decals and ground contacts. A coarse
64-unit height grid must not bend a bridge or make a character sink through the
ship. The grid resolution, scheduling and streaming radius are unchanged.

Timber crossings use the original surveyed 90..393 / 196..261 source deck and
original plank/post textures on a level deck with solid supports and sagging
ropes. Spatial boot no longer removes rail masks from the source deck texture.
Other existing dock/bridge floor artwork stays level above the water.

The flagship shares its hull survey with art preparation. A continuous deck
supports the original painted hatches/planks and a level gangplank. Separate
stern and mast masks cannot leave holes through the floor. Rig extraction keeps
the supplied furled black/red sail rather than an invented white sail. Hull,
boarding, collision, crew/navigation and save XY coordinates are preserved.

Ground warnings blend after solid model batches, with depth testing and small
surface separation. This fixes both terrain-height burial and the later ship
model painting over an earlier warning. Deck contact/projected shadows also
blend after the deck. Grounded attack beams finish at the target surface height.

## Preserved systems and verification limits

Distance fog, depth of field with locked-target protection, projected sun shafts,
cloud shadows without the yellow terrain stripes, local-tint bloom, wall cutaways
and manual camera zoom remain. Shared instancing, staged source preparation,
texture residency limits, frame budgets, deferred room art and retirement remain.
There are no per-frame pixel scans, canvas readbacks or geometry rebuilds for the
new material/fire behavior. These constraints are not a device FPS measurement.

The original supplied screenshots and painted asset boards were inspected.
Both repository TypeScript compiler checks passed before publication. No unit tests, gameplay, development server, browser checks,
standalone mesh renders or local production/APK build were run for this update.
The previous geometry catalog predates this change and does not validate it.
Automatic CI builds/signs the release with the existing key and application ID.
Real-device visual appearance, collision playthrough and frame pacing still
require observation in the published build; compilation cannot establish them.
