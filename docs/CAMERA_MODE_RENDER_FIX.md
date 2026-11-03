# Camera mode and dodge presentation repair

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
