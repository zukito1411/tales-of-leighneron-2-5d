# Interior proportions and camera distance

Interior dining tables, reception counters and workstations previously multiplied
height by their authored width. A wide reception desk could exceed the player's
76-unit standing body. The shared interior furniture adapter now converts
character-relative elevations into each mesh's width-normalized units at room
creation. Ordinary interiors and all player-home styles use the same adapter.

- Dining surface: 33.44 world units.
- Reception/counter surface: 44.08 world units (accounting for its .883 mesh ratio).
- Work surface: 36.48 world units.
- Bench seat: 20.52 world units.
- Chair back: 54.72 world units; seat approximately 20.96.
- Bed headboard: 54.72 world units; mattress approximately 23.20.

Tiny painted surface offsets remain unchanged. Furniture widths, floor depths,
placement, rotation, contact shadows, interaction footprints and save data retain
their existing definitions. Tall cabinets, architecture, regional centerpieces
and overworld props retain their existing geometry. This adds no per-frame work
or additional meshes, materials or textures.

The orbit camera no longer probes terrain or structures to shorten its distance.
The now-unused obstacle index and its registrations are removed. Pinch/wheel zoom,
orbit, combat-lock aiming and bounded view streaming remain. The renderer's shared
depth-tested cutaway, target reveal and picking through the revealed core remain
in place; neither the cutaway uniforms nor its shaders were changed.

Validation: application and tool/config TypeScript checks. Gameplay, rendered
visual proportions and device performance require in-game inspection; compiler
checks do not establish those results. Android publication uses the existing
signing identity and package through the automatic release workflow.
