# Elarion grove and Oakmere entrance spacing

Based on main `9630b47` and the Android screenshot supplied on 27 October 2026.

## Tree of Life

The previous landmark at Elarion-local `(-956, -440)` was inside the fitted
Lore Archive volume. The landmark had been appended after house planning, so
its coordinate change did not reserve any space in the settlement layout.

The shared site is now `(-956, -260)`, 180 units toward the foreground lawn
in the screenshot. Its existing 3D model, scale, artwork, lights, small trunk
collider and content ID remain unchanged. The grove reservation includes both
sides of the round canopy, rather than a north-facing flat sprite rectangle.
The planner reserves this lawn before fitting buildings, plantings and details.
The Archive and Council House move to the existing northern street frontage.
The lawn reservation is not a new invisible collider.

`content.ts` re-exports the same ID and position names used by the existing
WorldScene save migration. ContentChunkManager also restores static scenery
to its current authored coordinates. Interior doors and assigned residents
derive from the same building IDs and final positions.

## Oakmere

A 56-unit building-to-building gap admitted front doors directly behind another
house. Oakmere now reserves an open forecourt extending 180 units south of
each building, with 24 units of lateral and neighboring-footprint clearance.
Placement checks both an earlier forecourt against the new building and the
new forecourt against earlier buildings. Trees and courtyard details respect
these forecourts too; open yards can meet and streets can cross them.

The Oakmere profile height increases from 2000 to 2400. Shared planning updates
the perimeter, gate approaches, outer-ward roads and foundations together.
This gives the previously cramped households space without shrinking them or
omitting them. The five original core buildings retain their positions and
scales. Building IDs, owned-home IDs, furnishings and progression are retained.

## Verification

- Inspected the supplied screenshot, placement/render bounds, model geometry,
  collision, streaming, static-save restoration and derived interior entrances.
- Inspected the generated source-data coordinates without starting the game:
  all 13 Oakmere and 24 Elarion buildings remain; every settlement retains its
  previous admitted building, planting and detail counts.
- Oakmere's smallest aligned front-to-back footprint gap increases from about
  66 to 211 world units; no other building enters any reserved forecourt.
- No Elarion building overlaps the full grove reservation, including its
  56-unit neighboring-building margin.
- Both required TypeScript compiler checks pass. No gameplay, browser or unit
  tests were run; Android visual verification remains pending.

The changes run in the existing one-time layout planning. They add no per-frame
world scan, mesh rebuilding, new artwork or texture upload work. Streaming,
graphics settings and rendering budgets are unchanged.
