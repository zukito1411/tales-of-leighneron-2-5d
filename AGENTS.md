# Tales of Leigneron — mandatory agent rules

Read this entire file before inspecting or changing the project. These rules
apply repository-wide on every machine; use repository-relative paths, not
one developer's absolute paths. Read additional instructions in affected
subdirectories. Follow higher-priority instructions and current explicit user
directions; disclose conflicts rather than silently ignoring them.

## Inspect before implementing

- Read the working-tree status and current source; do not assume a previous
  chat, generated report or commit description matches today's code.
- Before editing, read ALL affected logic: callers, consumers, types, data,
  lifecycle/cleanup, persistence/migrations, UI and platform integration as
  applicable. Trace the actual execution path and shared dependencies.
- Preserve unrelated changes. Never reset or overwrite the user's work.
- Fix root causes at the owning layer. Reuse shared systems; avoid duplicate
  renderers, parallel state stores and special-case patches.
- Preserve stable content IDs, save compatibility, progression, equipment,
  quest state and approved artwork unless explicitly asked to change them.
- Keep changes scoped; avoid unrelated refactors or dependency upgrades.

## Required TypeScript checks

The user explicitly authorizes type checking after code changes. This is the
only standing exception to the permission-only testing policy below.

- After TypeScript, JavaScript, type/config, dependency or runtime integration
  changes, run the existing local compiler checks before handing off:
  - `npm run test:types` (application, tests and test configuration).
  - `npm exec --no -- tsc -p tsconfig.node.json --noEmit` (Vite/Capacitor configuration).
- These are compiler checks only: do not substitute a production build.
  Use installed dependencies; do not silently download another compiler.
- Fix errors introduced by the change, then repeat the affected check. Never
  hide errors using `any`, `@ts-ignore`, disabled strictness or removed checks.
- Report pre-existing errors separately. If checks cannot run, report the
  exact blocker and do not claim compilation passed.
- Documentation-only edits do not require compiler execution. For asset-only
  edits, inspect consuming registration/loading logic; run compiler checks
  if code/config/generated TypeScript changes too.
- TypeScript success does NOT establish Android correctness, valid sprite
  geometry, visual consistency, working saves or smooth gameplay.

## Other execution requires permission

- Do not run unit/integration/browser tests, launch the game, simulate gameplay,
  start a development server or execute lengthy validation unless explicitly
  requested for the current task.
- Do not run production/APK builds, sync native projects, commit, push, publish
  releases or modify external systems without current-task permission.
- When testing is requested, use the smallest relevant checks. Do not run broad
  suites or rewrite unrelated tests just to make results pass.
- After every Playwright run, including failures, timeouts and cancellation,
  close owned pages/contexts/browsers and stop its development server. Use
  try/finally and verify the run's child processes exited. If forced cleanup is
  necessary, target only PIDs/process trees started for that run; never kill
  the user's normal Chrome/Edge sessions or unrelated Node processes. Do not
  leave a test browser, headed window, server or trace recorder running.
- Once implementation and authorized checks are complete, summarize and stop.

## Android performance and lifecycle

- After an authorized published game update, verify the automatic Android
  workflow and deliver the direct signed, non-debuggable APK in GitHub Releases.
  An Actions artifact alone does not satisfy delivery. Preserve the existing
  `ANDROID_DEBUG_KEYSTORE_BASE64` signing identity; do not create a replacement
  key or change the application ID without an explicit request.

- Preserve bounded image decoding, staged boot-time atlas preparation, deferred
  optional audio and first-frame readiness. Do not move optional artwork/audio
  back onto the critical cold-start path.
- No unbounded texture/object caches or eager loading of the entire world.
  Stream for the actual viewport and zoom, with a bounded preload margin.
- Avoid per-frame pixel scans, canvas readbacks, asset decoding, large array
  allocation, full-world searches and unnecessary React/store updates.
- Reuse prepared assets, spatial indexes and deterministic cached plans.
  Preserve graphics quality; do not silently remove meaningful features as
  an optimization shortcut.
- Cancel or ignore obsolete asynchronous loads on outfit changes, shutdown and
  retries. Release listeners, timers, textures and objects safely. Stale
  callbacks must never revive destroyed scenes.
- Preserve safe startup/save recovery, deferred respawn, authoritative save
  coordinates and verified Android backups. Never overwrite a recoverable save
  with incomplete initialization or report an unverified export as successful.

## Artwork, loading and animation

- Match existing pixel-RPG style, body proportions, palette and detail. Inspect
  approved front, side and rear references before designing related artwork.
- Do not substitute cheap hard-coded SVGs, CSS shapes, procedural line limbs,
  recolored placeholders or assembled body parts for requested finished assets.
  Existing functional code-native UI and intentional effects may remain.
- Use complete poses, never old upper bodies stitched onto new legs. Preserve
  head/body scale, boot-contact baseline, grips, cape size and costume identity
  across idle, walking, running, attacks, hurt, death and skills.
- Inspect source dimensions, transparency, full-pose containment, frame
  rectangles, gutters, origins, foot/hand registration, timing and mirroring.
  Preserve dragon ground/flight proportions and mouth/attack anchors together.
- Use uniform clip/group scaling; do not stretch limbs or independently fit
  action silhouettes in ways that resize the body during an action.
- Keep runtime paths, manifests, texture keys and consumers synchronized. Never
  rely on missing-texture placeholders, stale atlas metadata or assets stored
  only outside the repository. Retain recoverable versioned source masters.
- Sprite validation requires rendered inspection across affected locomotion
  and combat states. Pixels and animation names alone do not validate GPU
  crop coordinates, proportions, equipment placement or collision-foot alignment.
  Without authorization to inspect gameplay, report that verification remains
  pending; do not launch the game or claim it passed.
- Bandit side-walk fixes affect left/right only. Retain its complete neutral
  side pose between steps; preserve approved up/down sequence, cadence and
  sizing unless explicitly asked to change them.

## Honest handoff

- Review changes and integration before finishing: stale references, duplicated
  logic, missing cleanup, save risks and platform differences.
- Report changes, checks actually executed and remaining limitations. Distinguish
  source inspection, compiler success, automated tests and real-device evidence.
- Never promise “flawless”, “no bugs”, “no lag” or “APK guaranteed” without
  evidence. Do not describe intended optimizations as measured improvements.

## Portability

Keep this file version-controlled with the project. Agents supporting
`AGENTS.md` should load it from the repository root on any PC. For tools that
do not discover it automatically, explicitly instruct them to read and follow
`AGENTS.md` before work. This is not an executable agent: it cannot force
unrelated AI products to obey or guarantee defect-free code.
