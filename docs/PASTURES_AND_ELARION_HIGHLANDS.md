# Pastures, mills and Elarion's highlands

Settlement streetscape preparation now fits complete livestock courts into
unused lower-ward ground. Rural parcels and stable/grain-store neighbors are
considered first. A bounded secondary survey considers empty land inside the
existing defenses. Buildings, crop beds, quest/service approaches, scheduled
NPC anchors, public courts and existing streets reserve their space first.
Nothing relocates an existing building or a quest contact.

Each admitted pasture has a 720 × 560 grass or dirt court, five connected
timber fence sections, a 190-unit entrance, two hay stacks, loose straw and a
water tub. Its entrance must have a clear walkable connection to an existing
street. The complete court and access corridor are reserved against subsequent
decoration. Unsuitable sites are omitted rather than forced into crowded land.
Caps are three pastures in Highmere, one in villages and two in other eligible
settlements, still subject to the existing town/chunk decoration limits.
Darkav is excluded.

Outdoor cows and domestic goats use only admitted pastures. Their spawn and
movement checks include their body radius inside the pasture boundary as well
as the existing terrain/prop/NPC clearance checks. Wild highland goats retain
their wilderness behavior but cannot spawn or wander into settlements.
Chickens use smaller town/village yards or explicitly named urban slum parcels.
Existing stable livestock, including horses, retains its indoor integration.
The six-animal shared pool and bounded planning/atlas/upload work are unchanged.

Pasture terrain uses the original grass/dirt textures. A small indexed survey
is shared by terrain, footstep and minimap queries. Terrain-worker initialization
also receives the admitted survey, so worker and incremental painting agree.
No ground overlay renderer, additional texture decoding or per-frame terrain
scan was added.

Mills are modeled stone/timber towers with slate caps, doors, windows, crossed
sail frames and linen panels. The sails are static geometry. Mill placements
reserve the entire sail envelope; physical collision covers the tower alone.
There are at most two in Highmere and one in other eligible, non-snowbound
settlements, where a sufficiently flat, clear court fits. Existing model
materials, cached geometry and streaming batches are reused.

Elarion's entire occupied foundation survey, including its palace extension
and outer wards, sits on a level 640-unit plateau. Rock escarpments and rolling
foothills blend into the surrounding terrain; existing regional roads receive
broad ascending grades. City plots remain level. This uses the existing shared
64-unit simulation/GPU terrain lattice; no additional terrain mesh/cache or
cliff collision rectangles are introduced. Existing river beds retain their
water levels.

Two optional woodland spring cascades are surveyed along the southern
escarpment, away from the gate approaches. They are admitted only if their full
extent clears existing content and roads. Every water vertex samples the same
terrain lattice and triangle split; rock/moss banks flank the stream. Flow
highlights use the existing GPU material clock. These meshes do not raise the
sea-level water plane or start particle emitters, lights or update loops.
Their complete bounds participate in streaming and wilderness reservations.

Validation is source inspection and the required TypeScript compiler checks.
No game, browser, Playwright, data-import diagnostic or performance benchmark
was run. Admission counts, visual proportions, FPP/TPP traversal and actual
device frame times have not been verified in gameplay.
