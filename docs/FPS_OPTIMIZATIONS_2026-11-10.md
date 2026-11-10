# Follow-up FPS optimizations — 2026-11-10

Implements the six confirmed opportunities in
[the source audit](FPS_SOURCE_AUDIT_2026-11-10.md), based on the working tree
after merge #28 (`c472519`). The audit remains a record of the starting code;
its original line numbers predate this implementation.

## Changes

1. **Reuse exact model topology.** A renderer-owned CPU template cache serves
   world and shadow batches. Keys include the complete shape, emission/inflation
   variant and effects-quality preset, including nested UV/material/survey data.
   Each batch retains independent attributes and GPU buffers. The cache holds
   at most 96 templates and 24 MiB of attribute/index data; oversized templates
   are not retained. Eviction and renderer shutdown release templates. Hidden
   streamed scenery prepares models before atomic art/collision publication;
   ordinary prop admission also uses available preparation allowance. Cold
   fallback drawing remains available rather than omitting visible content.
2. **Prepare admitted artwork and prioritize required uploads.** Resident NPC
   idle/walk/directional families and ordinary admitted prop sources enter the
   existing bounded speculative preparation path before scene collection.
   Required chunk readiness uploads precede speculative sources. Visible actors
   and dynamic effects never disappear to enforce an upload quota. Texture
   callbacks now separately count staged and render-triggered uploads, including
   estimated bytes. These are renderer-owned texture counters, not a GPU timer
   or a count of every render-target/water-mask allocation.
3. **Reuse geographic streaming candidates.** Viewport caches retain chunk
   coordinates and reuse equal membership sets while still filtering against
   the current frustum. Authored scenery queries reuse spatial-bucket results
   until geographic coverage changes. Equal membership no longer forces static
   actor migration/admission work. Unchanged covered transition views avoid
   rebuilding and sorting pending chunk maps. Physics neighborhoods, margins,
   elevated terrain, tall silhouettes and view distance remain intact.
4. **Prepare sea routes incrementally.** The existing seeded route algorithm
   yields between path/hull sample checks. Nearby jobs advance within the shared
   geography allowance, with an additional eight-step cap per update. Obsolete
   jobs are cancelled, existing active boats retain selection priority, and
   teardown closes all generators. The synchronous API remains available.
   Route geometry, random sequence, density and motion phase are unchanged;
   initial ambient sailing boats can appear after their route preparation.
   Docked boats and player passage do not wait on ambient route jobs.
5. **Apply final indoor label depth once.** NPC presentation receives the
   interior depth offset instead of writing ordinary depth and immediately
   overriding it. Initialization also uses change-sensitive depth writes.
   Names, titles and quest markers keep their previous final ordering.
6. **Retain idle batches for elapsed time.** Batch expiry now uses a three-second
   monotonic-time grace instead of 180 render frames. World/shadow idle-count
   caps, disposal limits and foreground-base retention remain in place.

The diagnostic details now also expose topology build/reuse counts, retained
CPU topology bytes, peak build time and staged versus render-triggered texture
upload rates. Existing instance-upload coalescing from merge #28 is preserved.

## Evidence and limits

The supplied screenshots predate merge #28. They show rolling presentation of
102.8 FPS when turning and 75.0 FPS when moving/turning, with p99 frame times of
22.5 ms and 51.1 ms respectively. GPU timing was unavailable. They establish a
reported earlier baseline, not the cause of the spikes or an after-change
comparison. No FPS improvement percentage can be inferred from this code pass.

Verification performed:

- `npm run test:types` — passed after correcting an optional wall-thickness
  type in the new preparation path.
- `npm exec --no -- tsc -p tsconfig.node.json --noEmit` — passed.
- Source integration review covered callers, geometry ownership, cache limits,
  changing shape/quality signatures, live-frustum filtering, preparation
  cancellation, NPC reuse and scene shutdown.

No tests, game launch, browser, Playwright, builds or real-device profiling were
run. Rendered parity, boat behavior and actual frame-time improvement remain
runtime verification tasks. Model construction and GL uploads are still atomic;
unprepared mandatory content can incur first-use work. This pass reduces and
stages avoidable work without promising to eliminate every frame spike.

Profiling-dependent proposals—save snapshot reuse, motion interpolation,
whole-frame headroom estimation and equivalent post-processing fusion—remain
separate. No source artwork, geometry detail, shader quality, resolution,
draw-distance setting, simulation frequency, save format or quest IDs changed.
