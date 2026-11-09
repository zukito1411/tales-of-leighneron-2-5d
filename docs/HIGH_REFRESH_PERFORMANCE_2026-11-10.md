# High-refresh rendering and frame-pacing performance pass (2026-11-10)

## Goal
Maximize actual displayed FPS up to the device/browser's available
requestAnimationFrame cadence, without reducing artwork, resolution budgets,
shader passes, animations, combat effects, world visibility, or asset quality.

## Changes
1. **No artificial 60 FPS cap.** Phaser 3.90 now uses `fps.limit: 0`
   and browser rAF. `fps.target: 60` remains its reference used for delta
   smoothing/initialization, *not* a ceiling. Arcade physics is explicitly
   fixed at 60 Hz, independent of 90/120/144 Hz rendering, so movement,
   collision and hits do not accelerate when presentation frequency rises.
2. **Refresh-aware optional work.** Terrain baking, actor admission,
   background GPU uploads, navigation, and other opportunistic jobs share a
   smaller allowance when rAF intervals are short or the previous presentation
   already consumed CPU headroom. Hard-required world transitions and visible
   gameplay remain intact; each frame retains a bounded progress opportunity.
3. **Texture reuse instead of two-frame eviction churn.** Over the soft
   128 MiB Android cache target, textures retain a short re-entry window on
   camera turns. A separate 288 MiB mobile emergency threshold allows more
   aggressive eviction again, with at most two disposal operations per frame.
   These are **estimated three.js texture bytes**, not a hard Android graphics
   memory cap or the total CPU/GPU memory footprint. Speculative texture prefetch
   remains budget-guarded; no source texture is downscaled.
4. **Better diagnostics.** The overlay reports uncapped display-synced rAF
   presentation FPS and 1% lows, pre-render preparation, visibility/batching,
   cleanup, and world CPU submission separately. Texture-source destruction
   (normal when a terrain chunk unloads) is distinguished from **pressure
   evictions** (a potential cache thrash signal), with per-second deltas.
   GPU timings are not fabricated when the device lacks the WebGL extension.
5. **Headless visual test repair.** Freeze the world and invoke the original
   ThreePresentation.draw on rAF. A paused Phaser scene does not draw itself;
   previous CI waited for 240 frames that never advanced. Alternating ABBA
   comparisons still verify identical instance hashes and order, texture
   invalidation, dormant batch activation, and no unintentional visual changes.

## Safety and acceptance
- Same signed APK release workflow, itch.io automatic upload, GitHub Pages and
  existing saves. No changes to meshes, shader code, textures, UV precision,
  art assets, model detail, anti-aliasing defaults, shadows, weather, controls,
  or animation frame data.
- TypeScript, Vitest pacing/work budget tests and Playwright parity tests must
  pass before claiming integration success.
- Profile on a **real Android device** at its actual display mode: 60/90/120/144
  Hz device preference if available, idle town, camera circle, Captain Varr,
  large boss/projectile encounter, and 15-minute thermal stress. Compare
  rolling rendered FPS, 1% low, p95/p99, texture pressure evictions per second,
  and high-level scene CPU. This code pass is not evidence of 120 FPS on a
  device that cannot deliver it.

## Follow-on work requiring device evidence
- Android Perfetto FrameTimeline and WebView GPU tracing to separate UI,
  rAF scheduling, JS, compositor, GPU, and thermal throttling.
- Conditional renderer scene-collection shortlisting beyond the existing
  StaticSpatialIndex; preserve correct draw order, picking and visibility.
- Profile depth-of-field/bloom/fullscreen shader bandwidth and see whether
  exact equivalent shader fusions are viable **without changing pixels**.
- 120 Hz physics interpolation and simulation decoupling, without increasing
  damage/AI clock speed or affecting input latency.
- GPU texture compression only with explicit fidelity tests, not by silently
  lowering source resolution or changing default visual settings.
