# Outdoor movement and image quality

Base: 9dd26b3f34e28eb0f80227a199a1da8886f035a5.

## Source findings

Interiors return before outdoor streaming, water, weather, foliage and HUD geography work.
The GPU water path still rebuilt its complete terrain mask synchronously after viewport
movement. The React minimap ran its own geography sampler in 2 ms animation-frame slices,
outside the game streaming allowance. Residency changes also published the entire logical
world to the store; the progress-save subscriber then scheduled full save serialization.
These are source-confirmed sources of work, not measured device attribution.

## Changes

- Water and minimap geography share one worker, one active request and at most one queued
  request per consumer. Epochs reject obsolete replies; transferred bitmaps close after use
  or cancellation. The worker terminates when its final consumer is destroyed.
- The GPU water mask is 512 square over 8,192 world units, preserving the previous 32-unit
  terrain sampling. Its buffered coverage is independent of camera yaw and pitch. It moves
  only after substantial travel. The existing complete mask remains active during preparation.
  Painted water terrain remains visible while the first animation mask is prepared.
- Unsupported/failed workers retain bounded fallbacks: water sampling shares the game frame
  allowance; minimap sampling uses idle callbacks with a 0.35 ms slice, or rAF if unavailable.
- Actor residency no longer publishes full-world store snapshots or schedules progress saves.
  Gameplay mutations still publish their existing snapshots. Every save obtains a fresh scene
  snapshot through the existing provider. Periodic, explicit, pause and lifecycle saves remain.
- Normal quality is the default on touch devices as well as desktop. Explicit Low choices
  remain respected. Normal ground painting keeps its original full 1,536 pixel resolution;
  explicit mobile Low uses 1,024 pixels. Standalone ground textures use mipmaps and up to 4x
  anisotropic filtering; sprite atlases retain their existing filters to avoid frame bleeding.
- Texture residency has a bounded grace period to avoid eviction/reupload after a few hidden
  frames. The mobile idle residency target is 128 MiB; mip levels are included in accounting.
  This target is not a hard cap on currently visible resources.
- Adaptive backing resolution now uses asynchronous render timing rather than raw CPU frame
  stalls, and retains a higher image-quality floor. GPU queries exclude CPU collection,
  texture preparation and background elevation sampling. Unsupported GPU timers retain base
  resolution. Quality reads are cached instead of reading synchronous storage every frame.

## Verification

Run the two required TypeScript compiler checks and inspect the complete browser and Android
CI builds. No game launch, unit/browser tests or device benchmark is authorized under the
standing workflow. Compiler/build/signature success is not proof of stutter elimination or
visual parity. Hardware traces and a comparison of outdoor raw p95/p99 against interiors are
still needed to establish the actual improvement. Check travel near river banks, a repeated
route, camera orbit, interior return, save/continue, and the Low/Normal selector on device.

## References

- [Three.js texture filtering](https://threejs.org/docs/pages/Texture.html)
- [Web performance: workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)
- [WebGL performance practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)
