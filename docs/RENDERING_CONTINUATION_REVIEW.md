# Rendering and thunderstorm continuation

Reviewed 2026-11-02 against current source. This continues the earlier
[storm/lock/ship review](FRAME_PACING_STORM_LOCK_AND_FPP_REVIEW.md).

## Changes

- Prepared static scenery bypasses repeated general actor/attachment
  classification. Transform, tint, alpha, model configuration, plane, name,
  crop, input and attachment eligibility still invalidate or reject reuse.
- Unchanged static packets retain their existing instanced-buffer slots.
  Reordering, fading, dynamic writes, removal and batch destruction retain
  their normal update and cleanup behavior. Camera, fire, wind and lighting
  still use their existing shader uniforms; actors/effects remain dynamic.
- Shared texture lookups reuse memory accounting when image identity and
  dimensions match. Dirty versions, same-frame resize, mutable text, context
  restoration and source destruction remain immediate.
- Fixed adaptive resolution at ordinary desktop pixel density. Previously,
  sustained GPU overload could consume its adjustment while returning scale
  1. The existing enabled preference now considers measured GPU cost, with
  one adjustment and the existing maximum 15% linear reduction. CPU-only
  stalls, missing GPU timing and inactive menus do not trigger it. Disabling
  the option restores full scale. No artwork atlas is resized or replaced.
- Storm rain now uses 1,024 particles on Normal/High and 384 on Low, versus
  the previous 512/256. It remains one instanced draw with fixed seed storage,
  depth/roof occlusion and GPU gust/motion; ordinary rain and ash keep their
  existing counts and artwork.
- Background thunder has a more audible transient and stronger rolling tail.
  Heavy rain briefly ducks during thunder, then returns to its original mix.
  Recorded gain targets were 0.345 -> 0.1342 -> 0.345. Existing mute,
  background visibility, interior audio and bounded voice cleanup remain.
- Rechecked the existing persistent target lock and offshore ship migration.
  The ship is not shifted again on already migrated saves. Its visual and
  walkable gangplank still meet the shared shoreline survey.

## Evidence and limits

`staticSubmissionReview.spec.ts` alternates full/cached collection in an ABBA
sequence after warmup, 240 frames per block. Each mode submitted the same
70 instances with the same complete matrix, atlas, tint and repeat buffers.
Collection timings varied around 1.0-1.3 ms per frame in the latest run;
individual comparisons showed modest savings with substantial timing
variation. This is component evidence, not proof of an overall FPS gain.

The same test checks texture refresh/resize/text/context invalidation and
listener restoration, stable-slot upload versions, reorder, fade, release,
dynamic-to-static reuse and adaptive-resolution decisions. Simulated
sustained 32 ms GPU load at DPR 1 now reaches scale 0.85, remains stable and
returns to 1 when disabled. CPU-only and inactive cases remain at 1. These
are controlled input checks, not measurements on a slow physical GPU.

The real gameplay profile now accepts viewport dimensions and includes a
storm workload. Local development Chrome, ANGLE default, 1920 x 1080:

| Workload | Frame p95, ms | Largest observed frame, ms |
| --- | --- | --- |
| Initial idle | 8.4 | 66.7 |
| Travel | 8.5 | 41.7 |
| Ten additional mobs | 8.5 | 108.3 |
| Boss | 8.4 | 41.7 |
| Thunderstorm | 8.4 | 50.1 |

These are individual local runs. Isolated stalls remain, especially during
cold combat admission/uploads; complete stutter elimination is not established.
The renderer's GPU measurements in this run were below the adaptive threshold,
so the new overload branch did not lower resolution during these profiles.
No Android or physical-speaker listening check was performed.

Profiles and paired measurements remain ignored local artifacts:
`.asset-review/perf-nov2-continuation.json`,
`.asset-review/perf-nov2-continuation-1080p.json`, and
`.asset-review/static-submission-review.json`.

## Checks

- `npm run test:types` and
  `npm exec --no -- tsc -p tsconfig.node.json --noEmit` passed.
- Focused browser profiles, static submission/coherence checks and
  storm/lock/boarding review passed. Storm review confirms 1,024 particles,
  Low's 384-particle limit, rain duck/recovery, independent thunder, lock
  identity through crowd clicks/concealment, no skill redirection, retained
  saved injuries/deaths/deadlines and a continuous dry-shore landing.
- Owned browser contexts and the port-5174 server were closed after runs.
  No production build, commit, push, release or Android sync was performed.

## Files in this continuation

- `src/game/presentation25d/ThreePresentation.ts`
- `src/game/presentation25d/SpriteBatch.ts`
- `src/game/presentation25d/TextureCache.ts`
- `src/game/presentation25d/RenderBudget.ts`
- `src/game/presentation25d/GpuWeather.ts`
- `src/game/systems/ThunderAudio.ts`
- `src/game/systems/WeatherSystem.ts`
- `tests/browser/staticSubmissionReview.spec.ts`
- `tests/browser/renderStormLockReview.spec.ts`
- `tests/browser/overworldPerformanceProfile.spec.ts`
- `docs/RENDERING_CONTINUATION_REVIEW.md`
