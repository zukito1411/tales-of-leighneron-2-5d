# Pasture, roaming livestock and shrine follow-up

The sparse population was intentional in the previous source: six livestock
slots, only two or three residents per pasture, no new admission before 05:00
or after 21:00, and wilderness opportunities restricted to highland goats.
Pasture courts were also rejected when their nearest street lay north of the
south-facing gate, and the generic land survey covered only southern wards.

## Changes

- Survey all wards at a coarser 320-unit spacing, keeping the existing parcel,
  building-yard and between-street candidates. Existing buildings, roads,
  service approaches, NPC schedules, sacred courts and defensive clearances
  retain their vetoes. Buildings and quest contacts are not relocated.
- A pasture gate can connect directly to a street or around either side of its
  enclosure. Every segment is checked and reserved before admission. The
  connector never cuts through the proposed fence. Large/small complete court
  fitting remains atomic, including fences, hay, straw and water.
- Permit up to five pastures/three mills in Highmere and two or three pastures/
  two mills elsewhere, subject to actual clear space and unchanged town-wide
  decoration caps. Cold settlements keep their mill exclusion; Darkav keeps
  its livestock-court exclusion. The new-decoration cap per chunk is 24 rather
  than 16 so a ten-prop farm composition can have a neighboring working yard.
- Try hay bales, loose straw and barrels beside admitted mills. Barn/stable/
  granary yards try both sides for stock, plus cart/water fittings. New stock
  uses existing painted material atlases and cached models. A small number of
  vacant pockets receive benches and climate-appropriate planting.
- Large pasture populations rise to six; medium courts allow four, the smallest
  two. All require real body clearance from fences, stock, actors and terrain.
  One shared pool is capped at twelve outdoor livestock or four indoor animals.
  These are upper bounds, not an assertion that every court has that many.
- Free-ranging cow/goat groups use suitable meadows; chickens use woodland and
  some meadows; goats use hills and dryland. Only nine stable local cells are
  considered, one per yielded preparation step. Site and movement checks keep
  them outside settlements, on dry suitable ground, away from roads, trees,
  buildings and combat actors. No world-wide animal simulation or save ledger.
- Night/dawn admission remains enabled. Animals rest instead of disappearing
  from newly entered areas, while retaining a checked escape from the player.
  Replenishment is serial, at most one animal per completed admission. Remote,
  offscreen animals return to the pool earlier. Existing cancellation on room
  changes, travel/backgrounding and destruction remains intact.
- Animal route checks use the existing NPC spatial grid; enemies are checked
  once against a swept segment, instead of both actor lists at each terrain
  sample. Streamed tree colliders are now included. Safety probes cover the
  distance an animal can travel before its existing certificate expires.
  Shared work allowances, serial image decoding, staged atlas preparation,
  upload readiness and a single bounded population remain in use.
- The shrine sculpture uses a unified cool limestone palette, a continuous
  smooth-shaded head/robe/sleeve surface, a closed draped veil and shallow
  closed eyelids. Overlapping head/face spheres, dark eyes, protruding fingers
  and yellow harp coloring were removed. Harp/wings, pedestal, interaction,
  attunement and all saved shrine IDs remain. The halo is pale blue-white.
  No new textures, lights, particle systems or per-frame model animation.

## Verification

Both required TypeScript compiler checks passed after implementation, along
with scoped whitespace checks. No unit/integration/browser tests, game launch,
placement diagnostic, gameplay simulation or device FPS measurement ran.
Actual admitted counts, animal visibility, rendered sculptural appearance and
frame pacing still require gameplay/device confirmation. Source-level bounded
work does not establish a measured absence of stutter.

The existing automatic paired Android/Windows release pipeline remains
unchanged, including signing identity, application ID and asset downloader.
