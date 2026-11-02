# Overworld frame pacing and storm update

Reviewed 2026-11-02 against the current working tree.

## Findings and changes

- Optional NPC and regional enemy artwork still isolated whole sprite subjects
  synchronously during gameplay. A baseline CPU profile attributed about 176 ms
  of sampled main-thread time to `actorSpriteSubjects` during the initial
  nine-second observation. Isolation now uses one scene-owned worker with at
  most one running and one queued sheet. NPC arrows and Magus spell isolation
  use the same service. Atlas fitting and complete-pose artwork are preserved;
  regional atlas drawing advances one pose per frame. Cancellation terminates
  obsolete work, preserves another owner's queued request, and releases workers
  and listeners on shutdown. Scene restarts create fresh owners.
- Combat surface shaders were absent from warmup. Warmup also prepared the
  display color-space variant, whereas the world compositor renders into a
  linear target. Both variants now compile asynchronously with retained tiny
  resources. No additional artwork or audio enters critical boot loading.
- Unclipped sprite batches uploaded an unused array of 16 clipping rectangles
  on material changes. Those uploads are skipped while `clipCount` is zero;
  clipped batches retain their normal uploads.
- Existing terrain workers, shared background-work budgets, texture residency,
  static model packets, shadows and compositor features remain in use. No
  texture-resolution downgrade or world-wide preload was introduced.

## Local observations

Development Chrome, ANGLE default, 1280×800, roughly 120 Hz. CPU sampling used
a 2 ms interval. Each run observed nine seconds of initial idle, fourteen
seconds of travel, nine seconds with ten extra mobs, and nine seconds with
Captain Varr. Combat setup deliberately creates fixtures together and includes
their cold admission/upload cost. These are individual local observations,
not a statistical benchmark or Android/device guarantee.

| Workload | Simulation p95 before → after, ms | Raw frame peak before → after, ms |
| --- | --- | --- |
| Initial idle / optional preparation | 2.2 → 1.6 | 550.2 → 50.2 |
| Overworld travel | 1.4 → 1.1 | 41.7 → 75.1 |
| Ten mobs | 2.3 → 2.2 | 108.4 → 99.9 |
| Captain Varr | 1.5 → 1.2 | 33.4 → 33.4 |

The largest sampled **simulation** frame fell from 103.3 ms to 6.1 ms during
optional preparation. Typical raw frame intervals remained about 8.3 ms on
this machine. Travel's isolated peak did not improve, and combat still has
occasional upload/driver/frame stalls. This does not establish that every
stutter is fixed. Remaining profiling priorities are GPU texture-upload timing,
static collection/shadow submission, and captures on the affected device.

Profile runner: `tests/browser/overworldPerformanceProfile.spec.ts`.
Per-run CPU hotspots and frame distributions are written to ignored
`.asset-review/perf-<label>.json` files using `LEIGHNERON_PERF_LABEL`.

## Requested world and combat changes

- Roaming sea routes are sampled sparsely, with a maximum of three moving
  boats in the streamed view. Existing visible vessels keep priority when
  neighboring cells load. Docked service boats remain available.
- Flagship scale is 1.85 instead of 1.3: about 2.025 times the deck area.
  Scaling about the old deck center and widening the shared model/collision
  gangplank preserve sampled saved deck/plank locations. The stern cabin keeps
  a human-scale height so it does not obscure the larger arena.
- Slam and Rush use the existing target-selection range, with no additional
  360/240-pixel activation gates. Ground validity, vulnerability and obstruction
  checks remain. Stationary Slam targets reuse their landing plan.
- Establishments keep the shared trade sign, omitting duplicate built-in
  banners/signs. Content and save IDs are unchanged.
- Rain gain is 0.11 instead of 0.052; storm gain is 0.16 instead of 0.075.
  Existing audio mute and lifecycle controls remain.
- Existing heavy-rain weather becomes a thunderstorm: dark overcast sky,
  hidden stars, rain, thunder and branching blue world-space lightning. Only
  one hazard can be active. About half aim at the player's position when the
  warning starts; others choose a nearby exposed point. The point stays fixed
  for a 1.8-second warning. A direct hit applies 60% maximum HP before normal
  defenses/evasion/dodge handling. The radius is 64 world units. Covered strike
  locations are excluded; menus, interiors, cinematics and travel transitions
  cancel hazards. Reduced
  motion suppresses sky flashes; the bolt and danger warning remain readable.

## Validation boundary

Application/test and Vite/Capacitor compiler checks are required. Focused browser
checks cover combat cleanup, extended art reach, worker pixel parity and queued
cancellation/restart, storm warning/damage, ship area and old coordinates, and
the visible boat cap. Rendered frames cover the sign, bolt and expanded deck.
No production build, Android/device run, commit, push or publication is included.
