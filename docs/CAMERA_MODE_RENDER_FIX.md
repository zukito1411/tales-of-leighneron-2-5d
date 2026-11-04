# Camera mode and dodge presentation repair

## Quest camera ownership and return

OrbitCamera now distinguishes the selected gameplay mode from an explicit
temporary camera owner. Cinematics hold the prior view while concealing,
use their authored shot camera only under cover, and restore the captured
gameplay yaw, pitch, zoom, smoothing targets and saved TPP pitch before the
return fade. Illustrated shots retain the preceding view. Travel/rest arrival
owners use the same bounded handoff, with no camera settings written by the
temporary override. A missing presentation player no longer rewrites the
gameplay-mode transition state; a finite last eye height covers held views.

Cinematic completion and skipping share the same return path. Native zoom is
restored exactly, rather than retaining a room's temporary shot-zoom clamp.
Two ready frames and the existing presentation readiness fence precede the
return reveal, so a restored perspective can submit a valid frame under cover.
Dialogue and scripted shots retain intentional input restrictions. Pending
quest scenes still use the existing queue; no quest flags or queued scenes
are discarded to unlock the camera.

Control-owner and enabled-state changes clear Alt keys, cursor-resume intent,
held attacks, touch captures and pinch distance. Epoch checks reject stale
asynchronous pointer-lock completions. Wheel, pointer and mouse events reconcile
missed Alt releases against their actual modifier state, and wheel/pinch handlers
also consult the current gameplay-control gate before changing zoom.

These are source-level repairs. No quest was replayed, no browser/Playwright or
game was launched, and no FPS or device-runtime claim follows from compilation.

Reported: a sky-only third-person view while first person renders, and a flash
at the start of a first-person dodge. The screenshot retains the HUD/minimap.

Source changes:

- ForegroundOcclusion no longer synchronously drains an entire model-preparation
  generator during modelBlocked(). This TPP-only path could bypass the shared
  work allowance for every newly covered building. Only the existing budgeted
  preload() advances those jobs. Until exact geometry is ready, the existing
  screen/depth overlap provides temporary foreground transparency; the character
  remains visible and no building geometry is removed. Disposal still cancels
  pending jobs and ready triangle blocks remain cached.
- OrbitCamera selects the current view's FOV before calculating orbit distance.
  Returning from FPP no longer derives one TPP frame from the preceding FPP FOV.
  Shake offsets must be finite before they can change the projection; an invalid
  shake offset clears an existing view offset instead of contaminating culling.
- The player-owned dodge ward is marked hideInFirstPerson, matching the existing
  dash afterimage. This avoids a bright self-effect intersecting the eye camera.
  TPP keeps both effects, and enemy effects, damage feedback, invulnerability,
  movement, dodge timing, audio and camera shake are unchanged.

These are source-level repairs, not a reproduced diagnosis of every possible
sky-only frame. No game launch, browser/gameplay test or phone profiling was
performed. Required compiler checks cover integration only. Verify repeated
FPP/TPP switching near Highmere buildings and dodging on Android; report a
remaining blank view with the game's graphics report if one is recorded.

## Follow-up source review

The FOV ordering, finite shake offsets, first-person dodge-ward/afterimage
visibility and bounded foreground preparation fixes remain in place.

Further repairs cover these incomplete paths:

- WorldPostFX previously projected the player's body point even in FPP, where
  camera and player share X/Z. A level gaze puts that point on the camera plane;
  perspective division can produce non-finite screen coordinates. FPP now uses
  a finite center focus, focus depth is positive, and TPP projections are checked
  before upload. Disabled depth blur exits before its focus calculation in both
  the filtering and composite shaders, including when bloom is still enabled.
- Existing blur buffers remain resident during an FPP round trip when depth of
  field is enabled. This retains at most the existing pair of bounded buffers;
  starting directly in FPP does not allocate unused blur targets. Filtering is
  still skipped when disabled, and quality changes/teardown keep their cleanup.
- Post-processing warmup now prepares the blur shader's linear render-target
  variant as well as the display variant. The one-pixel preparation target is
  disposed on teardown, and async preparation checks destruction before starting
  another compile. This matches the target used by the actual filtering pass.
- A collapsed/invalid viewport cannot resize the backing buffer or publish a
  non-finite camera/frustum. Invalid focus/height inputs preserve the preceding
  image until valid input returns; invalid frame delta cannot poison smoothed
  camera angles. Valid camera input follows the existing FOV, orbit and shake.

Both required TypeScript checks passed after these code changes. No browser,
Playwright, gameplay simulation or performance measurements ran. Repeated view
switches, level-gaze FPP dodges and actual Android frame stability remain pending
runtime confirmation; these source changes are not proof that every reported
blank frame has been reproduced or eliminated.
