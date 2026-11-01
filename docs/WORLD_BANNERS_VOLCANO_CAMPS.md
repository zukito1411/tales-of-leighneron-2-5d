# World trade signs, Cinderpeak and wilderness camps

## Settlement trade signs

The existing painted trade atlas now marks 133 establishments across all 12 settlements. Business labels identify smiths, armories, guilds, barracks, inns, markets, craftsmen, civic halls, chapels and stores. Explicit Highmere assignments retain priority. Residential upper/lower houses and homes do not inherit a business badge from their district name. Original royal/elven crests remain on cloth banners; the hanging trade sign is separate.

No house, prop, doorway, inventory, service or quest location was moved.

## Cinderpeak

The Three presentation replaces the original flat painting with ridged basalt, an open crater, recessed molten throat and six slope-following lava channels using the existing nature atlas. The buried base skirt closes contact with uneven terrain. The same immutable base outline supplies streamed and unloaded collision queries.

The existing VolcanicTremor media clock owns each eruption, including pauses, buffering and region exits. Lava follows upward ballistic paths in one retained GPU instance batch; surface flow travels downhill. High/Normal/Low use 128/80/48 projectiles, spread across the complete quake timeline. There is no per-frame particle allocation or geometry rebuilding.

Only the distant landmark compresses depth into the existing far plane. Normal terrain view distance, streaming, atmosphere, sky, manual camera zoom and wall transparency remain unchanged. The shell culls back faces, so a camera entering its volume does not draw an inside wall over the player. Its finite shader programs are prepared behind the existing startup/context-restoration readiness fence and disposed during teardown.

## Camps

There are 30 seeded camp sites: 14 adventurer camps, eight knight camps and eight hostile camps. Each has two shelters, a ground fire pit, benches, supplies and three occupants. Existing complete directional character sets and painted flame cutouts are reused: 66 friendly NPCs and 24 enemies total.

Camp registration happens after all existing world authoring. Stable IDs enter the normal content ledger and save/streaming lifecycle; the usual live hostile cap still applies. Friendly camps exclude ambient hostile spawning/feet. Camper home fallback and routines stay local; they do not route through their reference town's distant streets. The fire halo uses the actual modeled pit anchor.

Locations are baked in `src/data/wildernessCampLayout.json`. `planWildernessCamps` in `src/data/wildernessCampPlanning.ts` is an offline authoring helper, not a runtime import. It rejects occupied lots, story/boss clearings, complete road corridors, water, unsafe slopes and obstructed occupant exits. This avoids repeating the candidate search during startup or terrain-worker initialization. Procedural scenery respects the reserved camp clearings.

| Region | Camps |
|---|---:|
| darkav | 4 |
| druganwoods | 4 |
| frostlands | 3 |
| nardorous | 3 |
| narenthil | 4 |
| portquill | 4 |
| rindass | 4 |
| trandum | 4 |

Nardorous and Frostlands deliberately have three camps each: unsuitable fourth sites were omitted rather than forcing a camp through scenery or moving approved layouts.

## Verification and limits

- Required application and tooling TypeScript checks passed.
- `git diff --check` passed.
- Bounded metadata comparison preserved all 4,193 original content records and all 293 original NPC definitions exactly; no duplicate content IDs.
- The authoring survey inspected terrain, footprint overlap and exits without launching the game or simulating gameplay.
- In-game appearance, WebGL shader execution and device FPS have not been verified. Compiler and packaging success do not establish these.
- The existing combined APK/Windows workflow, non-debuggable Android package `com.mernondna.rpg25d`, signing secret and release retention policy remain unchanged.
