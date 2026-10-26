# Combat performance, airborne locks and boss leaps

This pass follows the latest source at `c6df474`. It leaves Leigneron's 3D work
aside and changes the existing sprite/Three presentation and combat systems.
Findings below are from source inspection, not a measured Android frame trace.

## Repeated combat costs addressed

- Targeting performed automatic nearest-candidate selection each update and
  each visible enemy independently repeated illumination/line-of-sight checks
  for its indicators. Automatic perception now runs every 100 ms. Indicator
  sight results use weak, per-actor 80-120 ms caches, invalidated by meaningful
  movement. Hit/cast eligibility, range and cover checks remain immediate.
  Invalid/dead selections are reconsidered promptly; explicit lock input is
  immediate. Hidden indicators skip their remaining layout work.
- Every hostile repeated the same procedural player-territory query in a
  frame. The scene now reuses that one result for the exact player position,
  engine frame and road-unlock flag; a blink or quest change invalidates it.
- Ship sight lines sampled world walkability every sixteen units. Each sample
  repeated ship foot/polygon checks and allocated temporary points/arrays.
  Flagship foot tests now reuse fixed offsets with scalar coordinates. For
  paths whose full endpoint foot probes lie inside the authored convex inner
  deck, the entire segment stays on deck. An exact segment/expanded-mast test
  replaces the samples; the physics obstruction tree is still checked.
  Gangplank, shoreline and uncertain edge cases keep the sampled fallback.
  The existing nine-node ship navigation graph uses the same fast check.
- Damage-over-time and phase refills continuously changed floating HP values,
  rebuilding and uploading health-bar canvases for subpixel fill differences.
  Redraws now follow half-pixel fill changes, retaining a living target's final
  sliver. Actual HP, damage, regeneration and numeric boss HUD values are unchanged.
- Boss effect sheets were decoded optionally, but their first GPU upload could
  coincide with the first attack impact. Registration now queues the two shared
  sheets through the existing staged presentation upload system. Optional art
  remains outside the critical boot path. Uploads are atomic, not asynchronous.
- Stationary warnings no longer request redundant display-list depth sorts.
  Boss projectile sweeps reuse one area object instead of allocating each tick.

These changes reduce avoidable CPU work and first-use upload pressure. Water,
lighting, scenery, shadows, warnings and effects remain enabled. Fill rate,
GPU driver behavior, thermal throttling, decoding and other device-specific
costs can still affect Tidewatch combat; no FPS improvement has been measured.

## Locking behavior

Previously `lockedTarget` required `canBeTargeted`. Varkhul deliberately sets
that false during flight to prevent ground attacks, so the next targeting update
discarded the player's lock.

Lock tracking and hit eligibility are now separate. A living, engaged airborne
boss can remain locked through its flight, temporary ground obstruction and
flight excursion beyond the usual ground break range. Varkhul's arena engagement
still governs retention. Ground range/LOS rules resume after landing. Defeat,
disengagement, deliberate unlock and normal scene/travel clearing still apply.
Visible airborne targets can also be explicitly acquired within acquisition
range. Camera protection and indicators account for the active visual's height.
None of this permits hitting an invulnerable airborne dragon.

## Boss leap attacks

The Warden, Stonejaw, Iron-Tusk, Salt King and Frost Wyrm gain distinct leap
patterns in both world phases and their tower/ascended rotations. Rootfather
and spellcaster identities retain their existing mechanics. Varkhul retains
his authored flight controller and artwork.

Leaps use the shared boss combat clock and the existing complete attack poses:

- Commit and clip the landing position before displaying its warning; never
  home onto the player's later movement.
- Fill the same warning continuously through windup and flight; damage occurs
  once at the actual committed landing, with the usual range/cover checks.
- Advance in short collision-checked floor segments. Newly blocked travel
  aborts the landing strike rather than crossing a wall or ship edge.
- Interpolate takeoff/landing world heights with an arc, exposing elevation to
  the existing renderer, camera, attached labels and shadow system. Floor/save
  coordinates remain authoritative; no second physics actor is introduced.
- Airborne bosses do not collide with grounded creature bodies mid-flight;
  wall/terrain checks remain active and creature separation resumes at landing.
- Pause stops the owning combat clock. Roots, stagger, phase transition,
  disengagement, death and destruction cancel the arc and pending damage safely.

## Verification boundary

Only source review and the two repository-authorized TypeScript compiler checks
are permitted for this task. No unit/browser tests, game launch, gameplay
simulation, production/APK build or device profiling was authorized. Rendered
leap poses, landing/lock behavior and actual mobile frame times remain pending
authorized gameplay and real-device inspection.
