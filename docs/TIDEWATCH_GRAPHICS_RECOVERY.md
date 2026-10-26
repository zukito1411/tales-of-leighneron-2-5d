# Tidewatch Android graphics failure investigation

The reported “Restoring your view” screen has one trigger:
`ThreePresentation.onContextLost`, registered for `webglcontextlost`. This
identifies loss of the WebGL context. It does not establish whether Android
memory pressure, a GPU driver reset, or a WebView renderer termination caused
the particular device failure. No device was attached to ADB when existing
logs were sought; no app launch or crash reproduction was performed.

## Concrete source defects and fixes

- `ChunkManager` shared ocean artwork only for chunks in the `dead-sea`
  region. Fully submerged Tidewatch and Skallheim bay chunks are still in
  their island regions, so each allocated its own 1536-square terrain canvas
  and mipmapped GPU texture on Normal. Such a canvas has 9 MiB of RGBA pixel
  data and its mip chain approximately 12 MiB of GPU texels, before driver
  overhead. These are allocation calculations, not measured device usage.
  Fully submerged rectangles now reuse the existing shared ocean source.
  All four corners, including the terrain feather gutter, must lie in the
  same convex authored bay; shore chunks still use the detailed painter.
  Decks, collisions, heights and content remain separately owned.
- GPU/raster cache retirement was conditional on leftover streaming time.
  Busy frames could continually skip cleanup. Cache cleanup now always runs
  with its existing small release-count bounds. Destroying a Phaser source
  immediately retires its Three texture as well, before the canvas is pooled.
  Over-budget eviction shortens the idle grace while protecting current views.
- The deferred scenery-destruction queue could also stop indefinitely at zero
  work allowance. A full queue then blocked old chunk retirement. At least one
  already hidden/disabled actor now finishes teardown on each retirement pass.
- Context restoration requeued every cached texture, including old areas.
  Restored upload fences now enqueue only sources requested by the live view
  or preload band. Lost-context shader errors and timer queries do not convert
  an otherwise recoverable reset into an unrelated fatal shader/query error.
- Mobile default-framebuffer MSAA duplicated allocation alongside the world
  postprocessing targets. Mobile now uses the existing Normal FXAA compositor;
  painted texture resolution, models, shadows and weather are retained.
  Renderer teardown explicitly relinquishes its context after cleanup.
- The journey fade had z-index 10000; recovery screens had z-index 1000.
  A context loss during travel could leave recovery hidden behind black cover.
  The travel capture handlers also blocked its menu/export actions. Recovery
  now appears above the fade and those explicit controls bypass the travel lock.

These repairs apply to both island harbors and shared streaming/recovery
systems throughout the world. They are not evidence that every Android crash
has been eliminated.

## Additional release hardening

- Graphics restoration, room loading and terrain/geography worker watchdogs
  now share a foreground deadline. Hidden Android activity time does not
  exhaust the operation's allowance. Success, cancellation and shutdown remove
  the deadline's timer and visibility listener. Genuine foreground stalls
  remain bounded; recovery and save-protection controls are retained.
- Terrain replies are checked against their active request before clearing
  its watchdog. Duplicate readiness messages and obsolete errors/results do
  not cancel a newer request's timeout or revive a closed worker.
- Abandoned shared geography work gets a one-second foreground grace rather
  than holding shoreline/minimap consumers for the full 30-second deadline.
  Repeated cancellation cannot keep extending that grace. Worker failure
  notifies each remaining consumer independently so one callback cannot leave
  the others stuck waiting instead of using their incremental painter.
- A draw interrupted by context loss is left to context recovery rather than
  reported as a separate fatal rendering error. Synchronous shader-restore
  failures enter the existing bounded failure path, and repeated fatal-error
  reporting is suppressed after the first report.
- World overlays reject nonfinite and near/far-clipped projected corners.
  This prevents behind-camera labels or light effects from becoming mirrored
  screen-sized quads when ordinary world clipping is bypassed.
- Kill XP/gold, level-up, prop, dungeon, encounter and room labels use explicit
  ground anchors and a stable overlay order. Reward animation raises the label
  above its original foot point instead of changing its terrain sample. Kill
  labels show the existing progression-adjusted base kill reward; quest bonuses
  and item salvage continue to belong to their existing reward systems.
- Streamed settlement records retain their content IDs and positions with an
  invisible marker instead of an in-world town-name text canvas. Map/navigation
  names, quests, progression and saves are preserved.

## Evidence retained for a remaining failure

`graphicsRecoveryReport.ts` stores at most six small local records, separately
from game saves. It records context loss/restoration, shader logs, preparation
errors, and throttled uncaught runtime errors. Graphics snapshots include the
location/travel state, cache estimate, texture/geometry counts, quality and
backing-buffer size. It does not scan pixels, run a profiler each frame, upload
data, or change saved progress. Storage errors cannot prevent recovery.

“Export Graphics Report” is available on recovery screens and in main-menu
Options when evidence exists. Android reuses the existing verified staged-file
writer to Downloads/TalesOfLeigneron, without opening a picker on Android 10+.
The report cannot retrospectively recover an old APK's events or guarantee an
event when Android kills the process before JavaScript is notified. Native
crash/low-memory logs are still needed to prove that class of termination.

## Verification boundary

Required compiler checks only: `npm run test:types` and
`npm exec --no -- tsc -p tsconfig.node.json --noEmit`.
No automated tests, game/browser launch, gameplay simulation, production/APK
build, native sync, publishing or real-device validation is authorized here.
The installed APK is unchanged until a new authorized APK is built/delivered.
