# First-person feedback performance

The FPP awareness layer added recurring presentation work in e595e0d. This
change removes redundant work without changing graphics presets, world artwork,
streaming, skill range, targeting rules, damage, saves or signing configuration.

- Outdoor and indoor navigation and the FPP overlay share one display-only
  interaction label sampled for 100 ms. Room changes, large position changes,
  blocked interaction states and scene restarts invalidate the sample. Activation
  closures are never cached: pressing Interact resolves all guards immediately.
- Navigation skips the proximity-only interaction calculations that FPP discarded.
  NPC presentation updates still run. Indoor FPP also skips unused per-frame
  resident-prompt checks and the separate proximity-only bed sampler.
- Crosshair perception still examines the active combat list at 10 Hz, preserving
  aim selection. It reuses ranked candidates and checks line of sight in score
  order until one qualifies, rather than probing successive provisional winners.
  Horizontal misses are rejected before computing the two vertical projections.
- Nearby NPC aim scores are reused. Off-reticle interactables are rejected before
  querying collision. Actual interaction obstruction checks remain uncached.
- Warning bearings use small compositor transforms and cached CSS viewport
  dimensions from a ResizeObserver. There are no frame-loop layout reads.
  The observer and scene listeners are detached on disposal.
- DOM visibility/state updates only occur when changed. Inactive feedback returns
  without repeatedly hiding every child. The damage shadow is static artwork
  faded using an opacity layer and display-hidden between hits; it does not
  receive continuous idle opacity updates. The original shadow appearance stays.
- The GPU query ends before browser HUD processing. Optional frame diagnostics
  now report FPP feedback CPU average and peak separately. These figures measure
  JavaScript work, not the browser's later layout, paint or compositor duration.

Compiler checks are required. No gameplay, browser benchmarks or phone profiling
were run for this change. Actual FPS improvement remains unmeasured; this is a
source-level reduction of the work identified in the audit, not a guarantee that
all causes of lower FPS have been eliminated.
