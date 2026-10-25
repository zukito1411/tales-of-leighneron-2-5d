# Covered arrivals and terrain recovery

## Source findings

- Terrain height preparation was gated by player controls. Boats, cutscenes,
  menus and arrival fades disable controls, so an old region's GPU height map
  could remain active while new terrain/actors were already drawn.
- Ground visibility projected only quad corners/center. A large ground quad
  intersecting the near plane can project to misleading offscreen bounds.
- Shrine travel moved the hero and saved immediately after merely queuing
  terrain. Boat readiness checked terrain actors but not the presentation
  camera, completed height field, or deferred content admission.
- Landing invoked unbudgeted content admission for a full 3x3 neighborhood.
- A cancelled or stalled worker could block the next job for 30 seconds,
  longer than the former boat arrival timeout.

## Changes

Terrain heights continue their existing measured incremental preparation while
controls are disabled. New targets replace obsolete pending height buffers.
Ground culling uses the shared frustum and conservative world-space bounds.

Boat arrivals, shrine travel, respawns and ordinary interior exits wait under
the shared screen cover for visible terrain, the nearby physics cells, deferred
content admission, and the destination's presentation camera/height buffer.
Boats and shrines recheck the actual chosen landing before revealing; shrine
saves retain the source position until that landing is validated. No new save
schema or persistent transition field is introduced. Scene shutdown clears the
gate. Room exits and respawns keep their existing authored destination logic.

Landing retains viewport-based actor admission instead of eager 3x3 creation.
Worker initialization has a 15s deadline, each bake 4s, and a cancelled in-flight
job 1s to retire. Failure falls back to the existing incremental painter with
identical authored terrain/scenery and existing per-frame budgets. These are
watchdogs, not added travel delays. Area waits are bounded at 30 foreground
seconds; failed crossings return under cover to a safe dock. Area recovery has
one bounded retry and always releases input/physics locks if preparation keeps
failing. Backgrounding pauses transitions; no delayed callback relocates a
closed scene.

## Verification

Run the two repository-authorized TypeScript compiler checks. No gameplay,
browser test, automated test suite, visual rendering or native crash reproduction
was performed. The screenshot and source establish concrete failure paths;
real-device confirmation of the reported intermittent Darkav freeze is pending.
