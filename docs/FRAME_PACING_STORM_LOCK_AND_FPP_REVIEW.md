# Rendering, thunderstorms, target locks and first-person cuts

Reviewed 2026-11-02. This follow-up preserves artwork, actor/content IDs,
equipment, quest progress, defeated enemies and existing signing/build setup.

## Result

- Scenery shadows use a removable spatial index and reuse its candidate list
  until cell coverage or caster membership changes. Moving actors still update
  every rendered frame. A focused actual-world query reduced candidates from
  276 to 116 with no missing potentially intersecting shadows.
- Frustum corners use a fused model/view/projection transform, including the
  existing billboard lean. 1,200 rendered-object comparisons matched the old
  calculation. Harbor-distance sampling no longer creates temporary arrays.
- Storm rain uses one instanced draw with 512 drops, or 256 on Low, compared
  with 96/42 previously. Drops are longer, faster and wind-driven. Ash embers
  remain distinct from the additional falling rain instances. Roof/world-depth
  occlusion and reduced-motion sky-flash preferences remain in use.
- Rain is louder and broader in frequency. Thunder has separate crack, rolling
  rumble and bass layers, with bounded voices on the existing weather audio
  context/mute bus. Background thunder occurs every 4.5-10 seconds during a
  strong storm, independently of damaging strikes. Interiors mute exterior
  ambience. Storms also darken world surfaces in the existing compositor.
- A deliberate lock retains the same living actor through camera turns,
  temporary concealment, airborne phases and distance changes. Crowd clicks
  cannot replace it. R releases it; death/destruction or scene transitions
  clear it. Combat still validates vulnerability, range and walls, and cannot
  silently redirect an obstructed locked-target skill to a different enemy.
- The flagship is 640 world units farther into the bay. Its gangplank reaches
  the shared shoreline survey, with visible boards and rails. The sign moves
  with the landing. Model bounds, navigation, footprint and walkable plank
  use the same dimensions.
- A one-time `flagshipLayoutVersion: 1` content-ledger marker relocates old
  onboard player/crew/boss/summon coordinates and encounter stations. Saved
  health, casualties, loot state and respawn deadlines are retained. The
  parser, scene initialization and content snapshot preserve the marker;
  repeated loads do not move the ship's occupants again.
- FPP normal attacks now wind up, cut through the authoritative hit time,
  follow through, and recover. Slash, return slash and overhead cleave have
  distinct paths. Blade roll follows the cutting-plane motion for melee and
  cutting skills; thrust retains its forward blade alignment. Sampling uses
  the actual attack/cast clock and reusable vectors/quaternions. Hands remain
  absent and original equipment paintings/3D blade geometry are retained.

## Performance observations and limits

Local development Chrome, ANGLE default, 1280 x 800, roughly 120 Hz. The
existing profiler observes 9 seconds idle, 14 seconds travel, 9 seconds with
ten extra mobs, and 9 seconds with a boss. Cold fixture admission is included.
These are individual observations, not a controlled statistical benchmark or
Android evidence.

| Workload | Raw p95 before / verified, ms | Largest frame before / verified, ms |
| --- | --- | --- |
| Initial idle | 8.4 / 8.5 | 33.4 / 41.8 |
| Travel | 8.4 / 8.5 | 75.1 / 83.4 |
| Ten mobs | 8.4 / 8.4 | 116.9 / 116.8 |
| Boss | 8.4 / 8.5 | 33.3 / 41.8 |

There is **no demonstrated overall FPS or worst-frame improvement** in this
comparison. The bounded changes remove repeated rendering work, but they do
not eliminate intermittent browser/driver/upload or garbage-collection stalls.
Intermediate trials also showed large GC outliers. A speculative per-draw
height cache was removed because it did not demonstrate a net benefit.
No artwork-resolution reduction or extra world-wide preload was introduced.

Profiles are ignored local artifacts:
`.asset-review/perf-nov2-before.json`, `perf-nov2-after.json`,
`perf-nov2-final.json`, and `perf-nov2-verified.json`. The verified file is the
final implementation, without the speculative height cache. The profiler now
retains its validated combat clearing if the natural enemy used to find it
dies, and writes each completed phase so a fixture failure does not lose the
earlier measurements.

## Validation

- Application/tests compiler: `npm run test:types`.
- Vite/Capacitor compiler: `npm exec --no -- tsc -p tsconfig.node.json --noEmit`.
- `tests/browser/firstPersonReview.spec.ts`: desktop and touch, all eight
  skills, equipment swaps, menu/Alt lifecycle, first/third-person switching.
- `tests/browser/firstPersonSwingReview.spec.ts`: actual submitted blade axes
  and measured blade-center motion agree for all three melee cuts; alignment
  was 1.0 at the sampled active points. Idle blade angle returns correctly.
- `tests/browser/renderStormLockReview.spec.ts`: lock identity, death/release
  eligibility, no skill redirection, shadow coverage, culling parity, save
  parse/reload migration, retained wounds/deaths/deadlines, continuous boarding,
  dry shoreline landing, stronger GPU rain and independent thunder trigger.
  Offline WebAudio output has an audible-level crack and sustained tail without
  clipping; this is signal validation, not a listening test on the user's speakers.
- `tests/browser/overworldPerformanceProfile.spec.ts`: idle/travel/mobs/boss.
- Rendered frames inspected for diagonal/overhead melee cuts, rain and
  the offshore boarding bridge. Owned browser contexts and the port-5174
  development server are closed after runs; the user's port-5173 server is
  left alone.

No production build, Android/device test, commit, push or release was run.

## Changed files

Rendering and FPP:
`src/game/presentation25d/FirstPersonPose.ts`,
`src/game/presentation25d/FirstPersonWeapon.ts`,
`src/game/presentation25d/FurnitureGeometry.ts`,
`src/game/presentation25d/GpuShadows.ts`,
`src/game/presentation25d/GpuSky.ts`,
`src/game/presentation25d/GpuWeather.ts`,
`src/game/presentation25d/ThreePresentation.ts`,
`src/game/presentation25d/WorldPostFX.ts`,
`src/game/presentation25d/WorldPropGeometry.ts`,
`src/game/presentation25d/environment.ts`.

World, audio, targeting and saves:
`src/data/content.ts`, `src/data/pirateFlagship.ts`,
`src/data/worldLandscape.ts`, `src/game/scenes/WorldScene.ts`,
`src/game/systems/ContentChunkManager.ts`,
`src/game/systems/GroundShadowSystem.ts`,
`src/game/systems/TargetingSystem.ts`,
`src/game/systems/WeatherSystem.ts`,
`src/game/systems/ThunderAudio.ts`,
`src/game/systems/flagshipRelocation.ts`,
`src/game/types.ts`, `src/utils/saveValidation.ts`.

Tests: `tests/browser/firstPersonSwingReview.spec.ts`,
`tests/browser/renderStormLockReview.spec.ts`,
`tests/browser/overworldPerformanceProfile.spec.ts`.

Report: `docs/FRAME_PACING_STORM_LOCK_AND_FPP_REVIEW.md`.
