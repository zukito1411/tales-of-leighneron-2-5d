# FPS source audit — 2026-11-10

## Scope and evidence

Source review of the current working tree at HEAD `c472519`, including the
Phaser/Three frame lifecycle, streaming, instance batches, texture ownership,
shader preparation, shadows, water/post-processing, NPC navigation/interiors,
HUD/store updates and save preparation. This is a review of the main execution
paths, not proof that every file or gameplay combination is correct.

No game, browser, server, tests, builds or device profiling were run. No runtime
code was changed. The priorities below rank source-level opportunities; their
actual contribution to frame times remains unmeasured.

The constraint is unchanged graphics, detail, visibility distance and gameplay.
Maximum FPS also depends on the display, browser/WebView, hardware, thermal
state and other workloads. Removing unnecessary work cannot guarantee the same
frame rate on every device.

## Optimizations already present

- `systems/framePacing.ts` uses browser rAF with `limit: 0`. `target: 60` is
  Phaser's timing reference, not a rendering cap. Arcade physics remains at a
  fixed 60 Hz in `MernondnaGame.ts`.
- `systems/graphicsEffects.ts` defaults adaptive resolution to **false**.
  Saved user preferences can still enable it; compare performance with the
  actual effective setting recorded.
- Static render packets, spatial queries, shader billboard orientation,
  change-sensitive instance attributes and coalesced upload ranges exist.
- Texture accounting has a fast reuse path, bounded retirement, active-source
  leases and time-based texture retention. Chunk preparation includes GPU
  texture readiness before publication.
- Optional shader preparation uses the shared work allowance. Its temporary
  wrappers share geometry rather than cloning large instance buffers.
- Navigation has a reserved budget share. Geography/terrain workers and staged
  fallbacks exist; replacing these systems is unnecessary.
- Actor depth guards, HUD throttling, navigation equality checks and background
  save serialization/validation already remove several older sources of work.

## Recommended order

### 1. Prepare model topology before first visible submission

**Confirmed:** `ThreePresentation.ts:911` creates a new `SpriteBatch` on a batch
miss inside scene collection. `SpriteBatch.ts:417` immediately invokes its
geometry factory. House/furniture factories construct full model topology
synchronously. `GpuShadows.ts:207` can independently construct corresponding
shadow topology. Foreground copies and batch growth also copy topology:
`modelTopology.ts:5`, `SpriteBatch.ts:520`.

**Risk:** first arrival, newly visible architecture, a new fade variant or a
capacity expansion can add atomic CPU work and buffer allocation to the draw
path. Cached frames are already cheaper; rebuilding every model every frame
is not the issue.

**Approach:** stage exact geometry preparation through existing admission/work
budgets. Reuse immutable CPU topology using bounded, complete shape keys before
considering shared GPU attributes. Keep instance buffers independently owned;
shared GPU attributes require explicit lifetime/disposal handling. Include
material/UV, emission, surveyed geometry and all shape differences in reuse
decisions. Preserve covered-transition readiness and complete visible geometry.

**Measure:** new model build count/time, topology bytes, batch growth count/time
and first-view frame-time percentiles.

### 2. Close gaps in texture preparation and upload accounting

**Confirmed:** `TextureCache.prepare()` explicitly initializes at most one
pending texture per frame (`TextureCache.ts:197`). It runs before scene
collection (`ThreePresentation.ts:303`). Later collection calls `get()` at
line 906; `get()` returns new/dirty textures immediately, without requiring
`ready()`. The renderer can therefore upload textures during rendering outside
that explicit one-upload queue. Chunk readiness gates exist, but do not cover
every newly admitted actor or dynamic text source.

**Risk:** explicit upload counters describe queue-driven uploads, not all
renderer-driven uploads. The existing GPU query also starts after explicit
texture preparation (`ThreePresentation.ts:417`). It does not measure that
earlier upload work as part of the queried interval.

**Approach:** extend existing readiness/preparation to predictable actor,
equipment and label sources in the actual admission band. Distinguish planned
uploads from unavoidable current-frame dynamic updates. Do not enforce a cap
by omitting visible actors, showing placeholders or postponing quest state.
Keep source versions, context restoration, cancellation and leases coherent.

**Measure:** both explicit and render-triggered uploads, source categories,
bytes and CPU submission time. Do not label CPU upload timing as GPU completion.

### 3. Reuse coarse streaming candidates during camera rotation

**Confirmed:** `StreamVisibility.ts:20` includes quantized camera orientation
in its key. `ChunkManager.ts:100` and `ContentChunkManager.ts:163,173` include
that key in their residency/query invalidation keys. Camera turns can therefore
rebuild candidate sets and spatial queries even while coarse geographic bounds
stay unchanged. ChunkManager has a later set-equality shortcut, so it does not
necessarily reload chunks after every such invalidation.

**Approach:** separate geographic candidate caching from exact current-frustum
filtering. Reuse coarse candidates while their coverage is valid; still test
them against the live view. Explicit transition views (`ChunkManager.ts:144`)
can similarly retain candidate/order preparation when the view is unchanged.
Preserve newly exposed chunks, tall silhouettes, elevated terrain, physics
neighborhoods, zoom and teleport behavior.

**Measure:** candidate-query rebuilds, residency set rebuilds, allocation volume
and frame times during a stationary full camera turn.

### 4. Budget deterministic sea-route generation

**Confirmed:** `WorldTrafficSystem.ts:54` generates missing nearby sea routes
synchronously when geographic bounds change. `travelRoutes.ts:42` can perform
16 attempts, each sampling a long route and hull-width terrain/fortification
clearance. This work does not use the shared frame allowance.

**Approach:** preserve the same seeded result but advance route preparation as
bounded jobs, with cancellation and a bounded nearby-result cache. Prepare in
the existing margin and retain already visible boats. Preserve hull clearance,
route density, docking and passage state.

**Measure:** route attempts/samples and preparation time per new cell, including
coastline movement and camera changes that expose new cells.

### 5. Give indoor label depth one owner

**Confirmed redundant work:** `InteriorSession.ts:985` calls NPC presentation
then sets interior label depth. `Npc.ts:673,677` first assigns ordinary label
depths; `Npc.ts:353` then assigns the interior offsets with unconditional
`setDepth()`. Installed Phaser's depth setter queues scene sorting even for an
equal value. Thus stationary indoor labels can keep requesting sorting and
alternate between intermediate depth values every frame.

**Approach:** calculate final interior-aware depth once, then apply only on
change, including quest markers. Reuse existing depth helpers. Preserve label
visibility and rendering order; no global Phaser monkey patch is needed.

**Measure:** depth writes and scene sorts while stationary inside a populated
inn. Moving actors may still legitimately require sorting.

### 6. Make batch retention independent of refresh rate

**Confirmed policy issue:** `pruneSpriteBatches()` expires idle batches after
180 presentation frames (`SpriteBatch.ts:549`). That is about 3 seconds at
60 FPS, 1.5 seconds at 120 FPS and 0.75 seconds at 240 FPS. Both world and
shadow batches use it. Texture retention is already time-based.

**Approach:** use elapsed-time grace for batch reuse while retaining count,
memory and per-frame disposal limits. Coordinate with topology reuse from
item 1. Do not retain unlimited unseen settlement geometry.

**Measure:** batch recreation and memory during repeated camera turns at
different display refresh rates.

## Further candidates that need profiling first

- **Night emissions:** `ThreePresentation.ts:988` excludes emission-owner
  objects from cached dispatch. Static window/lamp models still take the full
  collection path when visible. DayNight already skips ordinary hidden daytime
  emissions; preserve that optimization. Consider cached owner geometry and
  transforms with dynamic intensity if nighttime collection is significant.
- **Checkpoint preparation:** the 12-second checkpoint in `App.tsx:107` moves
  JSON/validation to a worker, but snapshot capture (`save.ts:108`), active
  actor capture and ledger object creation (`ContentChunkManager.ts:483`),
  worker message cloning and localStorage writes still involve the main thread.
  Measure these separately before adding dirty-state snapshot reuse. Preserve
  authoritative coordinates, coherent snapshots, immediate critical saves,
  validation, backups and stale-result rejection.
- **Whole-frame budgeting:** the shared allowance uses prior presentation CPU
  time (`FrameWorkBudget.ts:34`), not all simulation/physics/browser work.
  Measure core CPU stages before refining headroom estimation; retain reserved
  navigation and upload progress rather than starving essential work.
- **High-refresh motion:** physics is fixed at 60 Hz. Presentation-only actor
  interpolation may improve motion smoothness above 60 Hz; it is not inherently
  an FPS increase. Treat it as a separate correctness-sensitive change covering
  camera follow, attachments, collision authority, attacks and teleports.
- **GPU bandwidth:** profile fullscreen effects, transparency and shadows on
  actual target GPUs. The renderer already avoids some redundant framebuffer
  work. Only fuse/reuse passes after proving equivalent ordering and output;
  do not disable effects, reduce resolution or shorten view distance.

## Acceptance for a future implementation

Implement and review in small groups, starting with items 1–2 and the inexpensive
depth fix. Run the repository's two required compiler checks after code changes.
Other execution needs current-task permission under `AGENTS.md`.

When profiling is authorized, compare the same device, effective settings,
resolution, draw distance, content and camera route. Use warm steady-state and
cold first-view samples separately. Record presented FPS, p95/p99 frame time,
long frames, CPU stages, available GPU timings, allocations and cache churn.
Include busy settlements, interiors, coast/boat travel, elevated Elarion and
FPP/TPP transitions. A short desktop capture cannot establish Android thermal
stability or eliminate every stutter.
