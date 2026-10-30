# Public settlement spaces and repeated-work reductions

## Settlement spaces

Each settlement requests a provision/herb market, gathering green, and either
a practice court or caravan/quay work court. A bounded deterministic fitter
uses existing open space within the actual enclosure, after all original world
content, loose objects and contract boards have their final placements. It
does not enlarge buildings or move/delete existing scenery, people or quests.
An unavailable composition is skipped instead of forcing a collision or
aborting startup. Actual admitted court counts have not been runtime-audited.

Markets use paired full-size awnings, edge stock and seating; gathering places
use a shared well and benches; practice courts use the existing finished dummy
artwork; work courts use carts and stores. These reuse existing prepared art
and instanced model families. No new image generation or NPC population is
introduced. Each admitted court has an interactive local description board.
Practice targets are scenery, not new quest objectives or a new combat mode.

The fitter reserves current NPC anchors, home/schedule/escort/return anchors,
quest scenery, whole building/tree silhouettes, crops, water and protected
shrine/processional areas. It reserves 64-unit public approaches, a 72-unit
central aisle, cross circulation and a separate notice-board approach, with
swept obstacle checks and sampled walkable ground. New furnishings do not
occupy those lanes. Streets and terrain parcels join the shared layout used by
terrain painting, public-access checks and NPC routing. New content IDs are
namespaced; existing IDs, progress, collected state and artwork are retained.

## Repeated work removed

- Quest arrows and target markers draw their original shapes once. Position
  and heading update through transforms. Direction changes no longer rebuild
  the arrow command buffer or resize/re-upload its raster canvas. Cinematics
  hide these prepared shapes without clearing them.
- Street containment avoids sliced point arrays and square roots. Terrain
  sampling and road queries use lazily prepared local street/parcel buckets,
  preserving original source-order overlap and terrain priorities. Appending
  public lanes/parcels invalidates the corresponding cached layout index.
- NPC street graphs spatially shortlist crossing segments, split each pair
  once and merge vertices through local coordinate buckets. Route searches
  use a minimum-cost heap instead of copying and sorting the open set at
  every junction. Stale heap entries and non-improving edges skip traversal
  probes; direction-specific clearance remains intact.
- An escort without a usable route retries at most once per 750 ms rather
  than rebuilding a failed route every frame. Immediate movement, collision,
  crowd avoidance and quest completion checks keep their existing cadence.

Graphics presets, render distance, source artwork, model complexity, shadows,
weather, atlas preparation and image resolution have not been reduced.

## Verification limits

Only source/integration review and the two required local TypeScript compiler
checks were performed. No tests, Playwright, game launch, development server or
build was run. Compiler success does not validate visible compositions, route
behavior or device frame pacing. The code removes identified sources of CPU
and texture churn; a claim that every stutter/frame drop is eliminated would
require runtime/device measurements that have not been taken.
