# Moving-versus-idle outdoor renderer investigation (2026-11-10)

## User-reported Android evidence
Snapdragon 8s Gen 4 / 16 GB RAM, WebView+Phaser simulation+Three.js WebGL2.
- Still outdoors: rolling 120 FPS, 1% low around 82–83 FPS.
- Moving: rolling 80–85 FPS, 1% low around 20–27 FPS.
- Village, daytime: frame p95 16.1 ms, presentation CPU avg 8.8 ms,
  cull/batch 3.6 ms, terrain stream 0.0/0.3 ms avg/peak,
  actor stream 0.4/2.1 ms avg/peak, 0 streaming frames above 8.3 ms.
- Rainy outdoors: frame p95 23.0 ms and peak 57.1 ms,
  presentation CPU avg 6.1 ms, terrain stream 0.1/1.0 ms,
  actor stream 0.1/0.5 ms; no streaming frames above 8.3 ms.
- The user reports equivalent slowdown in dry weather. Therefore do
  **not** attribute the issue to rain/particle count alone.
- Texture cache creates 4.9–7.0 sources/s and repeats 1–2 recent
  pressure-evicted sources/s. Some first-use asset work remains.
- The Android WebGL2 implementation does not expose GPU disjoint timer
  queries (the FPS overlay reports GPU timing unavailable).
- Native game FPS and Android overlay FPS are useful comparisons, but
  neither directly identifies the limiting stage in this WebView runtime.

## Interpretation
The first-stage terrain, actor, and view streaming measurements do not
explain the largest frame spikes. Total presentation CPU, browser/WebGL
submission or GPU/compositor scheduling deserve closer attribution.
One 8.8 ms presentation frame plus ~1.0 ms simulation already exceeds
the 8.33 ms budget for 120 Hz even without expensive GPU work. Conversely
a 6.1 ms submission with a 23 ms p95 frame implies stalls outside the
measured streaming path. A CPU-to-presented gap is not in itself proof
of GPU saturation; other main-thread jobs, browser scheduling, and
synchronization are possibilities.

## Current engineering changes
- Cache validated GPU shadow batch bindings on immutable house/furniture
  plans. A binding is reused only when the *identical Three texture* and
  same deck-defined state still hold, AND the same batch still resides in
  the batch map. Texture disposal, material rebinding and batch retirement
  trigger the original lookup/creation path. Geometry, alpha, sun direction
  and contact shadows stay full quality.
- Add diagnostic-only per-stage CPU averages and peaks: shadow assembly,
  world+FX WebGL submission, overlay/weather WebGL submission and optional
  background preparation. No new high-frequency timers when the overlay
  is off.
- Retain existing 300-frame rolling FPS/1% low/p95 and movement-time
  terrain/actor breakdown; do not claim GPU time when timer extension
  isn't supported.

## Next device check
Run *same location* idle, walking straight, rotating camera in place,
and moving while turning; both dry weather and rain, for at least 20s
each. Compare 1% low, p95/p99, per-stage peak, repeated texture upload
and shader batches. Crucial distinctions:
- World+FX WebGL submission spikes: investigate Three/WebGL driver,
  dynamic upload and fullscreen draw-call timing.
- Shadow assembly spikes: examine casters and batch churn.
- Visibility/batching spikes: examine cull/frustum, occluders and
  per-visible-object frame work.
- Low CPU stages but high frame p95: capture Android Perfetto FrameTimeline
  or WebView GPU/compositor tracing to distinguish GPU from scheduling.
No quality reduction, reduced draw distance, omitted actors, shader/
particle disablement, FPS cap, or physics change is authorized.
