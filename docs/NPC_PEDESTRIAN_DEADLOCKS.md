# NPC pedestrian deadlock repair

Reported: residents pile up in Highmere and wait against one another.

Source causes:

- The old crowd test ignored feet less than eight units apart. Already stacked
  NPCs could keep approaching each other, while other overlaps prevented escape.
- The detour picker considered only points 40–92 units forward. A crowd could
  obstruct every such candidate even with safe space beside or behind a walker.
- Waiting never triggered a new street route around a transient person.
- The presentation update cancelled ordinary routes within 72 units of the
  player, even when the player had not opened dialogue.

The shared segment-spacing probe now detects close/identical feet. Ordinary
movement treats coincident feet as blocked; checked detours and yielding may
monotonically separate that overlap. An idle pedestrian checks for an existing
tight pile every 400 ms, so already stuck actors do not need a respawn. Normal approaches
still respect the 43-unit pedestrian corridor. The existing spatial crowd index
is retained; no extra world-sized crowd search runs each frame.

Walkers try bounded forward, side and retreat candidates with the existing
static foot, swept wall, terrain and pedestrian checks. They can ask a mobile
blocker to step sideways. Stable NPC identity gives travelling actors consistent
right-of-way; fixed workplaces, stationary sentries, formations, companions,
escorts and active story controllers are not displaced by that request. Yield
points reserve space against other yield candidates. Yield movement uses normal
walking and collision, has a 2.6-second deadline and a short hold to let traffic
pass, then resumes the original intent. Indoor walks and ambience respect this
temporary movement state without treating it as a story/cinematic command.

After 1.8 seconds without a local bypass, an ordinary outdoor walker can request
another route, at most once per 2.4 seconds. The existing budgeted queue receives
one blocker snapshot. Connectors and graph edges reject that temporary circle;
the static edge cache never stores crowd failures. Destination connectors also
check the actual inward direction, so an overlapping destination cannot be
accepted as though it were an escape. Camps and formation routes keep their
existing local movement paths. If there is no safe physical lane, actors wait
and retry rather than teleport, phase through a person or cross a wall.

Talking pauses the actor without deleting its route. Merely standing near a
walking NPC no longer stops or clears its journey. Quest IDs, destinations,
services, authored building placement, saves and art remain unchanged.

Required TypeScript compiler checks cover integration only. No unit tests,
browser/gameplay tests or real-device profiling were run. The reported Highmere
crowd and indoor doorway traffic still require on-device confirmation.
