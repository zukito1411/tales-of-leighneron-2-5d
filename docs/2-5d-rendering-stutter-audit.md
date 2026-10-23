# Tales of Leighneron 2.5D — frame-pacing and rendering audit
Updated: 2026-10-23. Based on GitHub source review, not a hardware trace.

Implementation update: [frame pacing implementation](FRAME_PACING_IMPLEMENTATION.md)
records the shared budget, worker terrain, GPU preparation, static packets,
compatible compositor merge and raw/GPU timing now applied. The vendor practices
below explain their rationale; real-device acceptance remains pending.

## Diagnosis
The game is Phaser 3 Canvas simulation plus a Three.js WebGL projection pass.
The critical symptom is **a single unusually long frame** on a camera turn,
terrain reveal, nighttime transition, or equipment change, not necessarily
low average FPS. A fixed 60 FPS requires nearly all frames to complete within
16.7 ms; a steady 30 FPS gives 33.3 ms.

Confirmed pathways:

| Code | Stall mechanism | Status |
| --- | --- | --- |
| `ChunkManager.loadSteps`, `TerrainBaker.drawSteps` | 2D canvas painting + first-time WebGL texture upload when a chunk is published | Budgeted generator, mobile texture reduction; upload still occurs on main GPU context |
| `ChunkManager.retireTerrain` | Two cached chunks previously caused near-immediate terrain rebakes while camera reverses | Increased to four normally and six on mobile Low, bounded |
| `TextureCache.prune` | 90-frame/64 MiB eviction caused assets to be re-uploaded after orbiting | Device-aware soft budgets, longer residency, max 2 disposals/frame, metrics |
| `SpriteBatch` | Render state/material/instance allocations when a previously culled sprite batch reappears | Recent batch retention already extended |
| `ThreePresentation.collect` | Every visible sprite transformed and projected each frame, even if static | Static packets, spatial filtering and GPU billboards applied; device profiling pending |
| `WorldPostFX`, `GpuNightMask` | Depth FBO, optional multi-pass DOF, nighttime fullscreen mask | Effects are individually configurable; pass count and GPU time need measurement |
| `ElevationField` | Height-map texture changes after travel | Incremental player-centered update from preceding patch |
| `ContentChunkManager` | Actor/physics creation and destruction, plus whole-world snapshots | Incremental activation/deactivation and debounced snapshot |

## Practices used by engine vendors — and how to apply them

### 1. Frame-time diagnostics before further rewrites (highest priority)
Chrome's Performance panel and Android System Trace identify main-thread
long tasks, garbage collection, shader link stalls and missed frames.
The advanced graphics overlay exposes presentation CPU average/peak,
whole-frame peak, cache misses/evictions, and streaming progress.
The updated overlay uses asynchronous GPU queries where supported and raw frame intervals. Browser-to-GPU submissions can
block or miss deadlines even when CPU wall time appears small.
Use representative warm and cold launches, rotate in place and run across
terrain boundaries at both day and night.

References:
- https://developer.chrome.com/docs/devtools/performance
- https://developer.android.com/studio/profile/jank-detection
- https://developer.android.com/topic/performance/memory/guide/webview-memory

### 2. Stable resource residency (implemented)
Unity's asset-churn guidance applies directly: unloading artwork just before
it is needed again causes allocation, decoding and upload churn. Preserve a
bounded working set and retire only a couple of idle items per frame.
Watch the resident budget, GPU texture count, and Android memory usage;
never cache all 120 x 90 world chunks.

References:
- https://docs.unity.cn/Packages/com.unity.addressables%403.1/manual/memory-assets.html
- https://developer.android.com/games/engines/unity/unity-reduce-memory

### 3. Shader / pipeline prewarming (implemented; device validation pending)
Epic recommends PSO precaching. Three.js provides `WebGLRenderer.compileAsync`
(using `KHR_parallel_shader_compile` where supported) and `initTexture`.
Precompile the finite shader variants during a loading/transition cover,
or before a relevant source becomes visible; do not call synchronously
for every newly added sprite during gameplay. Existing SpriteBatch already
shares shader source and draws instances, so first measure shader-program
misses before adding redundant warmup work.

References:
- https://www.unrealengine.com/tech-blog/game-engines-and-shader-stuttering-unreal-engines-solution-to-the-problem
- https://threejs.org/docs/pages/WebGLRenderer
- https://developer.mozilla.org/en-US/docs/Web/API/KHR_parallel_shader_compile

### 4. Move terrain generation off the gameplay thread (worker implemented)
Port the deterministic terrain sampling and raster baking to a dedicated
Worker using OffscreenCanvas and transferable ImageBitmap textures, with
immutable seed/biome inputs. Keep all Phaser actors, physics and WebGL context
on their current owner threads. A worker should return a fully painted chunk
and a scenery placement plan with a generation ID. Publish on the main
thread only if still in residency and no newer job superseded it.
**Do not** simply move a generator containing Phaser Scene/DOM patterns into
a Worker; those dependencies need serialization and separate initialization.

Reference:
- https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
- https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/JavaScript

### 5. GPU bandwidth and overdraw reduction (after GPU profile)
Keep batches/atlases and limit the number of full-screen passes on small
mobile GPUs. Group related blur/composite passes where the output remains
pixel-identical; only selectively disable an optional pass if its cost is
proven and explain the quality tradeoff. KTX2/ASTC artwork conversion is a
separate asset-pipeline project, with fallback for unsupported devices.

Reference:
- https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices

## Acceptance / regression plan
Do not claim 100% stutter elimination without device proof.
Check p50/p95/p99/frame maximum and count of frames > 16.7/33.3/50 ms,
GPU memory and texture reuploads on mobile and browser:
1. Rotate 360 degrees in a dense settlement, repeat immediately and after 5 seconds.
2. Travel across five fresh chunks, then return over exactly the same route.
3. Repeat the route at night with lanterns, clouds and shadows enabled.
4. Switch between interior and outside, menu/scene camera and combat.
5. Test normal / Low; compare with depth-of-field and darkness individually off.
6. Verify colliders, foliage opacity, nighttime depth and cosmetic attachments.
7. Validate a clean launch and warm cache separately; do not hide spikes by
   simply averaging away unusual frames.

## Release signing
`ANDROID_DEBUG_KEYSTORE_BASE64` can supply a **persistent signing key** if no
dedicated release secret is present. The pipeline still invokes
`assembleRelease`, sets `debuggable false`, verifies the signature and prints
the signing certificate SHA-256 in release notes. The Android SDK debug
certificate is not appropriate for Play Store production and does not match
prior ephemeral-signed builds. Preserve the same secret for future updates.

Reference: https://developer.android.com/studio/publish/app-signing
