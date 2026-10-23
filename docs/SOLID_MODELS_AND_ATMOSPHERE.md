# Solid models and distance atmosphere

Complete object paintings are no longer attached to house, tower, furniture or
prop faces. The geometry builders share ModelMesh: closed parts, smooth cylinder
normals, small beveled upholstery/table surfaces and modeled joinery. Doors,
window frames, shelf contents, chair backs, rounded lids, hoops, wagon wheels,
ship fittings and other details have physical silhouettes from multiple angles.
Material finishes use regional linear pigments and bounded, derivative-filtered
wood, masonry, roof, metal, fabric and rough-stone detail in the existing shader.
They need no additional material texture atlas, per-object material or draw pass.
Only naturally thin foliage and the ship pennant retain cropped artwork. Interior
wall swatches remain material textures rather than whole-object paintings.

Meshes keep the existing instanced batch lifecycle, physical footprints, ground
anchors, saved rotations, interior layouts, displayed weapons, interaction IDs
and door/chest state logic. The ship retains its hull outline and surveyed XY
coordinates; its own plank floor closes the old layer-mask gaps. Bounds include
new small fittings. This changes the 2.5D presentation, not simulation or saves.

The cloud-shadow shader previously mixed sinusoidal yellow ground stripes with
cloud shade. Those stripes are removed; the layer now draws cloud shade only,
with polygon offset to reduce coplanar fighting. Sun shafts use the actual
projected sun, accept upper-view emitters only, illuminate pixels below it and
use a softer depth mask and less saturated light. No fallback ground beam is
invented when the sun is behind the camera.

Distance fog begins at 1,584 world units, still ending at the existing 2,400-unit
view limit. Outdoor focus blur starts sooner and falls off gradually; distance
haze is stronger. The nearby subject and locked enemy remain protected. Low
retains atmospheric depth without enabling the Normal-only filter passes.
Bloom preserves the local highlight tint instead of always adding yellow.

Streaming radius, terrain detail, residency limits, deferred loading, upload and
retirement scheduling, resolution budgets and the existing two bounded Normal
filter targets remain. Model complexity and material arithmetic have changed;
there is no claim that these changes are free or measured to be stutter-free.
Geometry is prepared for active batches, never rebuilt as an animation loop.

Validation: the 265-entry geometry catalog covers home styles, building profiles,
model families, wall/gate profiles and ship parts. It was checked for finite
vertex data and rendered in offscreen OpenGL ES from front/side/rear angles;
regional styles were also inspected. Representative prop dimensions/materials
were used for the prefab catalog, so it does not reproduce every world placement.
The model, focus, compositor and cloud-shadow shader pairs were compiled and
linked in that context. This validates shader syntax and the inspected geometry;
it does not establish Android driver behavior, a complete game scene, device
frame times or save/gameplay correctness. No gameplay/browser test was launched.
Both repository TypeScript compiler checks and automatic release builds are
required before delivery. The release retains the existing Android signing key.

Final material/detail edits were pushed without further local tests or previews,
as requested. The earlier inspection does not validate those final edits.
