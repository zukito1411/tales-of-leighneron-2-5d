# Harbor crossings and overnight rest

## Boat travel

Every harbor destination now uses the same short sequence: a 1.8 second slow
departure, a 550 ms fade to black, staged preparation of the destination view,
and a 650 ms reveal at a validated landing near the dock. Loading time depends
on the device; there is no longer an 18–60 second on-screen ocean journey.

Only the first 48 world units of the authored departure channel are sampled.
The old whole-ocean route graph is not constructed for passenger crossings,
and intermediate sea chunks are not streamed. Existing ambient boats remain.
If the channel does not permit those first steps, the boat stays moored while
the departure fade runs instead of moving across land.

The cover stays up until visible destination chunks are ready for three
successive updates. Landing checks walkable ground, building collision and
nearby NPCs, with a bounded search around the authored drop-off. A 20 second
active-play preparation timeout or a caught voyage error restores a safe dock
and clears the transition, hidden-player state and voyage request.

Saving during departure or hidden preparation uses the departure landing.
After landing validation it uses the actual arrival point, including any
collision adjustment. The landing flag is included in the arrival checkpoint.
Neither boat coordinates nor a temporary ocean camera position become the save.

## Home and inn beds

The existing nighttime window, reachable-bed requirement, owned-home rule,
60G inn price and 06:00 destination time remain. A fade replaces the instant
camera flash. Under full cover, eligibility and funds are checked again;
payment, clock advance and restored vitals are committed once and saved.
The screen then shows a 2.2 second moonset/sunrise before revealing the room.
An interrupted pre-commit rest takes no payment; a completed commit remains
saved even if the app closes during the animation.

## Lifecycle and rendering

Both flows share a scene-owned phase clock and a React/CSS overlay. Only phase
and pause changes update UI state, with no per-frame store animation or new
image decoding. Reduced-motion preferences shorten the fades and replace
moon/sun travel with fades. Focus/visibility changes pause the sequence;
shutdown clears it. The overlay is transient and excluded from saved data.
Keyboard panels, mobile controls and gesture handoff are blocked during travel
and rest. Existing character cutaways, manual camera zoom and streaming budgets
are unchanged.

Boat creation now retires partially created attachments on failure. Retirement
checks for already destroyed objects and cleans attachments independently, so
a repeated release cannot leave the rest of a vessel unhandled.

## Verification boundary

Both repository compiler checks passed. The existing passage browser scenario
was updated for the new departure/fade/readiness/save contract, but no browser
test, unit suite, development server or game was launched. This is source-level
crash hardening; it does not establish real-device visual quality, FPS, or the
absence of all possible Android crashes.
