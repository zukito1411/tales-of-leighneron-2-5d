# Frame pacing implementation

Based on `5e332c08e590326e87745eaea64d46c0c9a8c67b`, 2026-10-23.

## Implemented

- **Accurate timing:** raw Phaser frame intervals, a bounded 300-frame window,
  p50/p95/p99, maximum, and counts above 33.3/50 ms. Scene-update CPU and
  presentation CPU are separate. Optional WebGL2 timer queries report completed
  GPU work later without waiting or forcing GPU completion. Unsupported devices
  show GPU time as unavailable. Diagnostics are opt-in in Advanced graphics.
- **One background-work allowance:** actor admission, terrain fallback steps,
  elevation preparation, uploads and resource retirement share an allowance.
  Raw frame intervals determine the allowance. Upload preparation retains a
  reserved share. Atomic canvas, constructor and GL operations can overrun a
  slice; their cost is charged before additional optional work is admitted.
- **Worker terrain:** one module worker owns terrain sampling, painting and the
  same deterministic scenery-plan functions as the fallback. It receives small
  prepared artwork resources once and returns a transferable bitmap plus a plan.
  There is only one in-flight chunk; cancelled replies close their bitmaps.
  Actor creation, collisions, simulation and save state remain on Phaser's thread.
  Unsupported, failed or timed-out workers fall back to incremental preparation.
  Initial mandatory coverage remains synchronous behind the existing transition.
- **Smaller scratch buffers:** terrain intermediate painting matches output
  resolution while pattern phase, feathering and world coordinates remain fixed.
- **GPU preparation:** a bounded nearby prefetch set and one queued cold/dirty
  source preparation per frame. Terrain and new scenery retain their shared
  fallback/hidden staging until their sources have been submitted to the GPU.
  Uploads happen before frame drawing, with recent-request eviction protection.
  `initTexture` is atomic, not an asynchronous upload guarantee. Critical live
  actors and combat effects retain their normal immediate render path.
- **Shader preparation:** small retained templates asynchronously compile shared
  sprite programs during loading. Postprocessing programs are also prepared.
  No whole-world preloading or replacement artwork is introduced.
- **Static scenery:** a scene-owned spatial index filters static image candidates.
  Cached packets retain UVs, tints and transforms. Eligible non-interactive
  scenery billboards use a shared GPU camera-right uniform, avoiding instance
  transform uploads on camera turns. Interactions keep CPU-rendered transforms
  so raycasts match the visible geometry. Static edits invalidate cached packets.
- **Bounded retirement:** sprite batches, raster surfaces and source textures
  retire incrementally without sorting allocated map copies. Chunk scenery is
  made invisible and non-colliding immediately, then destroyed over later frames.
  Attached foliage, lights and bridge layers hide with their owner. Existing
  save/encounter ownership remains authoritative; complete groups stay atomic.
- **Compatible compositor merge:** at night, darkness shares the final colour
  pass only when no lower-order screen effect must precede it. Rain, light and
  other ordering dependencies retain the separate overlay. Output-space blending
  matches the original compositor; depth, artwork, weather and controls remain.
- **Release identity:** CI continues using the existing signing-secret selection,
  including `ANDROID_DEBUG_KEYSTORE_BASE64`, builds `assembleRelease`, verifies
  the non-debuggable package and pins its current public certificate fingerprint.
  It publishes the direct APK and checksum on every push to `main`.

## Resource lifetime

The worker terminates on shutdown; obsolete jobs cannot publish a chunk.
Unconsumed bitmaps close on cancellation or failure. Texture wrappers restore
their original Phaser methods, GPU queries are deleted, and scene indices clear
on shutdown. Warmup materials remain alive until teardown so their programs do
not get immediately discarded after compilation. None of these caches stores
the entire world.

The existing lossless artwork packaging remains in place. This change does not
blindly transcode approved runtime-packed atlases to lossy KTX2. GPU-compressed
artwork needs a separately verified atlas-generation path, alpha inspection and
device-format fallback; adding an unused loader would provide no improvement.

## Verification and limits

The required TypeScript checks and a production code/worker bundle are checked
locally. GitHub CI builds with the complete asset repository and publishes the
signed Android release. Inspect its run for the authoritative release outcome.
No unit/browser/gameplay tests, development server or device benchmark are run
under this task. Compilation and packaging do not prove visual parity, correct
WebView worker support or a particular frame-rate improvement.

For device acceptance, enable **Advanced graphics > Show frame-time diagnostics**:

1. Rotate 360 degrees in a dense town, immediately repeat, then repeat after five seconds.
2. Cross five new terrain cells and return along the same route.
3. Repeat at night and in rain; verify lanterns, foliage, warnings and cosmetics.
4. Enter/leave an interior, interact with objects, jump while idle/walking and attack.
5. Compare raw p95/p99, maximum, slow-frame counts, CPU and available GPU time.

Keep cold-start and warm-cache results separate. A lower average alone does not
establish smoother frame pacing. Device evidence is still required before
claiming stutter elimination.
