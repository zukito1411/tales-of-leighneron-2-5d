# Hostile placement and obstacle navigation

Captain Varr now starts in the watchtower forecourt, at least 180 world units
south of its anchor after structure sizing. The old fixed offset and older
saved positions could leave him under the tower. His content ID, health,
phase, drops, quest ownership and respawn timer are retained.

## Placement

ExteriorPlacement now exposes hostile body clearance and swept paths through
its immutable spatial index. These checks work before any scenery chunk is
loaded, include the real enemy diameter (including alpha wolves), and retain
actual gate/arch apertures. Spawn checks additionally reject concealed
positions beneath structure artwork; movement checks retain genuine passages.

The save repair pass validates authored creatures and persistent spawns against
that geometry and terrain. Admission repeats the check for respawns and later
arrivals, repairs only coordinates, and rereads the ledger before construction.
An unplaceable record waits with a retry cooldown; it is not killed, deleted or
credited as a quest defeat. ContentChunkManager no longer overwrites repaired
boss coordinates with the obstructed authored anchor during save loading.

Grounded actors also validate their last-safe position before recovery. A stale
last-safe point inside new scenery can no longer cause an endless reset loop.
Recovery attempts have a cooldown. Protected settlements, finite story arenas,
ship-deck constraints, interior navigation and Varkhul's arena are respected.

## Routes

Outdoor pursuit uses incremental local A* with swept body-sized edges and
terrain/surface validation. One rotating job advances per simulation frame,
with at most 20 node expansions and a 1 ms deadline checked between nodes.
Each search has a 480-node / 1800-unit travel limit. This is a bounded local
planner, not whole-world navigation or a guarantee that every destination is
reachable. Failed routes retry with a cooldown; no path permits wall phasing.

Paths are cached. Current edges recheck only a 48-unit segment, preventing a
long clear route from repeatedly sampling the entire landscape every frame.
Destroying an enemy cancels its pending search; scene shutdown clears jobs.
Melee/ranged pursuit, wolf flanking, return-to-station, road fights and grounded
boss approaches use the shared traversal checks. Existing interior and ship
navigation remain specialized. Grounded dragon movement now stops its velocity
when obstructed. Projectile sight and combat timing are unchanged.

## Verification

- Source-data audit: 141 authored creatures, including nine bosses. Nine initial
  conflicts were found (the Oakmere wolves/boar, old-shrine wraith, a Rootwater
  rescue actor and one southern-caravan reinforcement). Zero remained after the
  repair pass using authored solids, body size and terrain corner checks.
- Varr's authored forecourt point passes the same geometry checks.
- Seven focused unit checks cover detours, fairness, cancellation, failure
  cooldown, short cached-edge checks, all authored placements, swept wall
  collision and saved boss HP/phase/timer/coordinates surviving manager load.
- Application/test-source and Vite/Capacitor TypeScript compiler checks.
- No game, dev server or browser launched. Real-device visual/playthrough and
  frame-time verification remain pending; compilation is not gameplay proof.

Viewport streaming, texture residency/upload budgets, artwork, graphics presets,
manual camera controls, saves and enemy identities remain in place.
