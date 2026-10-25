# Workshop, fountains and interior clearances

Source baseline: e44ac32. The Highmere mobile screenshot exposed three separate
issues: a featureless black workshop rear panel, walls occupying furnishing
space, and narrow entrance/galleries. The original civic and Elven paintings
were inspected before rebuilding their related models.

## Workshop

The open forge now has a framed plaster/timber rear wall, a supported roof
without a centre-front post, a rear bench and tool rail, a low horned anvil on
a timber stump, a mounted trade plaque, and a connected stone firebox/flue.
Original roof materials, regional trim and painted fire are retained. A side
window is placed only on the closed wall. The two 3D light anchors come from
the same architecture module as the new flame and pane positions. Stable
building IDs, exterior footprint and existing interior/service access remain.

## Fountains

Civic fountains follow the original timber-and-stone trough: shallow inset
water, separate end stones, timber boards and coping, metal ties and a joined
post/spout. The water starts at the mouth and falls into the basin. Delicate
source flowers remain only on the grass-backed version.

The Elven centerpiece has a wider stepped basin, four crystal spouts, curved
streams and carved leaf ornaments. Its default depth follows its original
round design; owned furniture still uses the saved item's exact ground depth.
This prevents a visually wider basin from overrunning an owned home's grid.

Two material patterns animate small water surfaces and streams using the
renderer’s existing visual-time uniform. Stream coordinates use model height,
so motion falls down on both straight and curved geometry. Ripples originate
at the water landing point. There are no new render targets, particles,
texture downloads, CPU animation loops or asset decoding paths.

## Owned house walls

All 3D room walls now sit outside the exact walkable floor union. Home walls
are 12 units thick rather than 22. Their inner faces/coping remain outside the
editor's furnishing area. Existing furniture coordinates, paid items, weapon
mounts, floor grid and save format are unchanged. The same wall rectangles
still follow room staging, navigation, collision and cleanup.

## Castle circulation

The upper/lower wing corridors are continuous 320/360-unit galleries. The
420-unit entrance vestibule has a 280-unit clear opening and a 190-unit arch.
Arch dimensions drive the perimeter gap, jamb collision and exit interaction;
there is no old 86-unit collision choke inside the visibly larger portal.
Room coordinates, residents, throne/guard posts and the outside entry point
remain stable. New floors expand the existing connected union and use the
existing disjoint floor renderer to avoid overlapping-floor depth flicker.

## Verification

Required application/test declaration and Node configuration compiler checks
run locally. Static front/side authoring views inspect the actual generated
workshop and fountain meshes/material mapping. These are not game screenshots,
GPU shader validation or device FPS measurements. No unit/integration/browser
suite, game or development server is started. Real Android/Windows gameplay
and water motion still need device review.
