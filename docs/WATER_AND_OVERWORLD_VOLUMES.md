# Water depth, overworld volumes and clear daylight

## Water and banks

The visual elevation source now places river/lake beds at -42 and sea/harbor
beds at -88 world units. The water surface is a separate level at -12, beneath
the land and above the bed. Bridge and pier deck elevations remain 8; the
flagship's surveyed boarding/deck plane remains 0. Navigation terrain kinds,
walkable shorelines, bridge routes and saved XY coordinates are unchanged.

Water carving precedes settlement foundation flattening, so town rivers are
not silently flattened back into their streets. A 48-unit bank shoulder keeps
narrow brooks represented on the existing 64-unit height grid. No height-field
resolution, texture size or preparation budget is increased.

The existing water draw now supplies the separate surface, shallow/deep color
separation and original animated foam. Its worker coastline mask still excludes
land, ice and bridge decks. Disabling water animation freezes the GPU surface's
clock rather than removing the water. No reflection render or raymarch is added.

## Buildings and props

Domestic houses gain side/rear foundation courses, corner framing, eave/ridge
finishes and framed windows where the source facade supplies a suitable crop.
Window emission follows those new elevations; unpainted material patches never
emit light. The original front remains in place. Foundations reach the authored
foot plane. Circular tower bodies, roofs and their existing emission geometry
retain their previous construction.

`WorldPropGeometry.ts` explicitly admits 84 regional artwork frames. Shared
prefabs cover benches, crates/cargo/chests, barrels, fences, signs, lamps,
braziers, wells, fountains, stalls, tents, carts, pumps, lecterns, monuments,
rocks, columns, crystals and small keepsakes. Trees, grasses, reeds, cacti,
bones, flowers, shrubs, trunks, fallen logs and stumps retain their billboards.
Delicate remaining scenery keeps its existing rendering rather than receiving
an indiscriminate box extrusion.

The existing art supplies all painted faces and material patches. The 84
checked-in patches have a minimum source alpha of 244/255; their UVs account for
the loader's alpha trimming. Full model bounds govern culling. Fixed geometry,
light anchors, window emission, ground shadows and picking share placement.

Deeper solid props extend clearance behind their existing front contact, using
the existing static spatial lookup, staged activation and retirement. Axis-aligned
props need one extra body; rotated contours use the existing bounded band
routine. Existing surveyed details and open arch/fence clearances remain.
IDs, quest interactions, rewards, inventory and save schema are unchanged.

The flagship retains its exact deck/gangplank XY registration and combat
navigation. Its hull, bulwarks, stern cabin and mast have volume; rigging and
pennant use fixed authored cutouts. Removed overhead mast pixels are filled
with an existing plank patch, so raising the mast does not expose holes in the
deck. Artwork splitting remains a one-time preparation step.

## Daylight and edge quality

Clear-weather ambient dawn mist now fades out by 07:30, instead of remaining
strong near forests and water until 09:00. Actual fog, rain, snow and volcanic
weather remain. Clear-day cloud shade and default distance haze are lighter.
The distance fade begins later within the same 2,400-unit streamed radius;
outdoor focus blur starts farther away and blends less strongly. Ground sun
streaks and slightly offscreen depth-masked shafts retain their existing passes.

Normal quality smooths high-contrast edges in the existing color compositor.
It reuses its four neighborhood samples and adds two filtered taps only on
detected edges. Sharpening is reduced on silhouettes. No additional full-screen
pass, framebuffer, MSAA attachment or render-resolution increase is introduced.

## Performance boundaries and verification

View/frustum streaming, preloads, terrain workers, source upload preparation,
height-grid size, render/pixel budgets, asynchronous GPU timing, cache limits,
deferred cleanup and save cadence remain in place. Models are shared per style
and use the existing architecture shader and character cutaway. Added geometry
and clearance still have a cost; device FPS has not been measured.

Both required local TypeScript compiler checks pass. Source artwork, integration
and cleanup paths were inspected. No game, gameplay simulation, browser tests
or development server was launched. Visual quality, navigation around newly
deep props, shader execution and frame pacing need real-device verification.
The Android workflow independently checks compilation, package identity, stable
signing certificate and the non-debuggable manifest before publishing the APK.
