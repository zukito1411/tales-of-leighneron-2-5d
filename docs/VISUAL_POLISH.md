# Model surfaces, lighting and bloom

This update preserves the existing source artwork, character proportions,
collision footprints, camera cutaways, manual zoom and saved content.

House side walls were covered by full-depth corner strips using roof material.
Four separate corner posts now leave the surveyed wall material exposed. Rear
and side windows gain complete jambs, and left-side window faces point outward.
Cabinets, counters and chests gain modest base/rear trim; well/stall/tent roofs
gain underside and edge closure. These parts remain in the existing instanced
mesh and atlas material. Model part counts increase; draw grouping is unchanged.

Circular tower walls and furniture cylinder sections use analytical radial
normals with the original segment counts. Flat caps, ledges and hard edges remain
flat. Cylinder bottom caps now face downward. This changes shading rather than
subdividing the world or adding textures.

The architecture vertex shader now shares a sun/moon direction, hemisphere fill
and weather-softened key light. Interiors use a steady warm fill. Additive
emission keeps its own brightness while retaining the existing cutaway.

Normal quality packs a soft-knee highlight mask into the unused alpha channel of
the two existing focus-filter targets. The same five taps per axis carry both
RGB focus filtering and scalar bloom. Sky depth is excluded; the depth filter
limits bleeding across unrelated surfaces. The compositor adds restrained warm
highlight energy and keeps locked actors protected. Indoor focus falls off later,
focus blur mixes less strongly and the grading vignette is reduced by half.

No additional world render, bloom pyramid, shadow map, CPU readback, asset load,
fullscreen pass or target is added to the default Normal path. With depth of
field disabled, enabling bloom still needs the two bounded filter passes. Bloom
adds shader arithmetic and runs filtering where focus previously could skip it;
it is not free. Low retains the existing painted lamp/window halos without
allocating those filter buffers. Individual effect preferences are respected.
Existing filter size limits (650,000 pixels, 960 per axis), adaptive backing
resolution, texture residency, staged upload/cleanup, streaming bounds and the
shared work budget are unchanged. Geometry is still prepared per active batch.

Validation: both repository TypeScript compiler checks passed. These checks do
not compile GPU shaders, visually validate models or measure device frame times.
No gameplay, browser automation or device performance run was performed. The
existing release workflow builds the browser and signed Android package; device
visual inspection and frame-time evidence remain necessary before claiming a
stutter-free result.
