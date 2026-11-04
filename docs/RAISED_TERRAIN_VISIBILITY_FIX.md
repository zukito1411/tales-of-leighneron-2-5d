# Raised-terrain visibility repair

The missing-floor screenshot is consistent with two confirmed source defects
exposed by Elarion's 640-unit plateau:

1. `StreamVisibility.ground()` and its early chunk-image check enclosed terrain
   between -128 and 256 world-height units. The GPU displaces the same floor to
   its terrain elevation after the instance matrix. Near floor chunks could
   therefore be rejected as offscreen even while their raised geometry should
   fill the view. Buildings and actors use their own elevated transforms, so
   they could remain visible over the missing ground.
2. `OrbitCamera` calculated terrain streaming bounds by intersecting screen
   rays with height zero. The foreground footprint of an elevated city differs
   from the sea-level footprint below it. This could select the wrong chunks
   and static-object buckets in either camera mode.

The existing incremental height-buffer build now accumulates its minimum and
maximum while reading the vertices it already prepares. These bounds publish
only with the complete matching GPU buffer; partial or obsolete builds never
replace the active range. A source change resets the range with initialization.
There is no extra height-grid scan, canvas readback or per-frame world search.

`ThreePresentation` supplies that published range to both camera coverage and
visibility checks. Early chunk-image rejection and final ground submission now
use the displaced terrain envelope. Final ground checks include the instance's
own vertical offsets. Chunk/scenery broad phases also account for raised bases;
the visibility key changes when its height envelope changes. Interior views
use their existing flat-ground mode.

Camera coverage includes intersections with both terrain-height limits, the
focus height while preparing a new area, and near coverage when an eye-level
camera lies within the height envelope. Existing horizon handling, fog/view
distance, renderer quality and bounded streaming budgets remain in place.
This is shared elevation handling, not an Elarion-specific floor overlay or
disabled culling.

Validation is source inspection and both required TypeScript compiler checks.
No game, browser, Playwright, automated regression test or performance benchmark
was executed. The source-level causes are confirmed; the exact screenshot has
not been reproduced or rechecked in rendered gameplay. Elarion traversal,
FPP/TPP rotation/zoom, cliff transitions and other raised areas still require
visual verification.
