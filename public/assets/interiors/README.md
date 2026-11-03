# Mernodna interior asset library

Generated 2026-10-13 with the built-in imagegen tool. **Now integrated through `InteriorSession` and `src/data/interiors.ts`.** Selected existing homes, inns, workshops and civic/royal buildings have physical exterior entrances; use the normal interaction control near their southern door approaches.

## Implemented behavior

- Nine regional kits load on demand, one room kit at a time. Measured furniture crops become a small active-room atlas; source textures and unused room textures are released on exit.
- Purpose-specific multi-room plans provide connected living, sleeping, kitchen,
  storage and work sections. Inns/villas have four sections; castle complexes
  have eight: audience hall, council chamber, library, private chamber, kitchen,
  entrance gallery, guardroom and dining room. Broad hallways connect them over
  solid black; all remain on one continuous interior floor, not menu stages.
- Furniture uses semantic art names and isolated source subjects from
  `src/data/interiorArt.ts`, not mismatched numeric slots. Doorways use actual
  transparent open-arch artwork, with passable centres and solid jambs. Visible
  furniture width controls proportional height; rectangular pieces are no longer
  forced into square display dimensions.
- North/side walls follow exposed edges of the floor union only. Corridor joins
  remain open. Regional timber/stone floors, room labels and floor-clipped lighting
  distinguish private, service and public spaces.
- Full player feet stay within the floor/corridor union. Movement and dash use bounded swept steps against walls and furniture. Players can pass through Alice, residents and enemies; actor feet must not seal narrow house/cave paths. Combat arts remain restricted to authorized indoor story/cave battles.
- Existing named local residents occupy appropriate indoor work positions and retain their dialogue, quests and affinity. Exterior actors are camera-filtered and outdoor physics/AI/streaming are paused, so there are no simultaneously visible indoor/outdoor duplicates.
  Story preparation now uses explicit one-building-per-NPC assignments instead
  of occupation-based room borrowing; their exterior chunk actors are suppressed
  while logical trust/story records remain. See `docs/STORY_INTERIOR_PLACEMENTS.md`.
- Quest guidance now targets an assigned resident's entrance outside, the actual
  NPC inside the correct room, or the exit when the next objective is elsewhere.
- Use interaction by the south doorway to leave. Entering during nearby combat is refused. Indoor travel requests are refused rather than silently corrupting the return point.
- Saves always record the safe exterior entry position, never room coordinates. Reloading resumes outside the building. No save version, NPC IDs, story progress or inventory schema changes are needed.
- Dedicated household sentries occupy castle galleries. Twelve new named guards
  reuse approved existing/regional models; Elarion's existing two hall guards move
  inside without changing their artwork. Marching formations and gate watches are
  not borrowed. Named story actors keep their IDs and assigned buildings.
- Inns now have a furnished taproom, serving counter, kitchen and two guest
  chambers. Guilds have meeting tables, records and a workroom; armories have
  issue/repair areas; warehouses have cargo aisles; stables now admit entry to
  tack/feed rooms and groomed stall bays. Regional source kits are retained.
- Local staff and patrons reuse the existing complete NPC poses. They respond
  through the normal interaction controls; one inn server has a short checked
  walking route. These occupants exist only while their room is open and do not
  create outdoor copies, quests or persistent world records. Named residents
  claim their workplaces first. Optional occupants require a clear, reachable
  position outside reserved public aisles and foreground furniture.
- Resident access preparation and actor creation are spread across the room's
  existing cancellable loading frames. Furniture and decorative occupants are
  released on exit, failed loads and shutdown.
- Westgate Inn is eligible: the entrance filter matches the word "gate", not the
  substring in an inn's name. Citadel Archive is an archive, not another castle.
- Multi-room layouts are implemented on one floor. Stair-based multi-storey travel
  and bespoke quest scenes remain future work.

Build/APK verification does not establish visual GPU registration or manual entry/exit quality. Those checks remain distinct from compiling and packaging.

Nine transparent source kits provide 24 illustrated slots apiece (216 source slots total). Existing exterior artwork provided the painted, outlined elevated-camera style; regional materials, textile motifs and signature furnishings distinguish these interiors. Existing NPC art will be reused during integration rather than creating unnamed replacement characters.

| Kit | Intended identity | Signature |
| --- | --- | --- |
| [Trandum rustic homes and inns](trandum_rustic/kit.png) | oakmere, willowcross, cibar-plains | provisions cabinet |
| [Highmere noble/castle](highmere_noble/kit.png) | highmere | blue-and-gold royal throne |
| [Narenthil majestic elven](narenthil_elven/kit.png) | elarion, moonfall | moonwell basin |
| [Nardorous alpine citadel](nardorous_alpine/kit.png) | starhold | mountain oath pedestal |
| [Rindass orcan clan halls](rindass_orcan/kit.png) | redmesa | orc chieftain seat |
| [Druganwoods dwarven river halls](druganwoods_dwarven/kit.png) | deepford | rune forge |
| [Portquill maritime taverns](portquill_maritime/kit.png) | tidewatch | fishing-net rack |
| [Frostlands warm longhouses](frostlands_longhouse/kit.png) | skallheim | longhouse high seat |
| [Darkav obsidian citadel](darkav_obsidian/kit.png) | blackspire | obsidian brazier |

## Common inventory

Row 0: primary floor, secondary floor, north wall, side wall, open doorway, window.

Row 1: bed, wardrobe, bookcase, chest, dining table, bench.

Row 2: chair, counter, hearth, rug, planter, barrel.

Row 3: pantry/display shelf, lantern, stairs, open partition arch, occupational workstation, regional signature.

Each sheet is 1536 x 1024 with an approximate six-column/four-row organization. **Do not blindly spritesheet-slice at 256 x 256:** generated illustrations can approach or cross nominal grid divisions. Measure complete visible subject regions before preparing bounded GPU frames; retain alpha gutters and do not clip furniture or neighbouring sprites. `catalog.json` records intended slot roles, not verified source crop rectangles or authoritative collision geometry.

## Integration constraints

- Build authored, walkable floor plans first; furniture and NPC work stations follow those plans. These are modular components, not baked room screenshots or arbitrary clutter.
- Render only the bounded room footprint over solid black. Black outside a floor plan must never be walkable: collision must constrain the player's full foot/body footprint and swept dash motion, not just hide the outside artwork.
- Use actual outdoor building door approaches to enter/exit. Keep the continuous open world and remember a safe outdoor return point; do not create menu-selected regional stages.
- Keep doors, corridors, stairs and counter service sides clear for PC and mobile. Determine footprints separately from tall wall/wardrobe/bookcase art; depth-sort at furniture feet.
- Floors need an interior texture crop excluding the source square's outline. Tiling/edge matching has not been verified; inspect repeating seams before reuse. Decorations and tableware must not be baked into the traversable floor.
- North wall and side-wall source pieces have different appearances. Never rotate a frontal wall sideways. Survey matching end caps/joins before constructing connected walls. These illustration boards are not a completed autotile set.
- Use noble materials selectively in Highmere royal/noble rooms; ordinary homes and poorer districts still use modest kits. Elarion's ivory/teal/gold palette supports majestic halls without copying Highmere's royal fleur motif. Dwarven/orcan/maritime/frost/volcanic interiors retain their own silhouettes and motifs.
- Keep global names, NPC identity, trust, dialogue and quest connections. Place existing named residents according to home/work roles; no simultaneous indoor/outdoor duplicates. Important new residents require full biographies when authored, not disposable filler.
- Scale furniture to the existing Leigneron/NPC body scale from visible dimensions: beds, counters and doors must not be child-sized or oversized just because their PNG cells differ. Source cell size is not a world-size specification.
- Source fire/window/lantern highlights are painted into these static illustrations. Runtime lighting and local NPC routines are owned by the existing room/presentation systems; the source boards do not supply alternate animation poses.
- Load only the active interior's prepared assets and release unused source textures. Do not preload all nine boards at boot. Each full source sheet is approximately 6 MiB decoded RGBA before extraction/driver overhead; this is arithmetic, not a performance measurement.
- Decide interior save/resume and safe return behavior before changing persistence. Do not save local room coordinates as outdoor world coordinates. Keep meaningful story/NPC/item state; geometry and Phaser objects are not save data.

## Review and provenance

All nine source sheets were viewed for palette, content, perspective and completeness. Source inspection and APK compilation are **not** rendered atlas, seam, collision, lighting or gameplay verification. The room controller implements those behaviors, but they still need manual in-game review; no automated gameplay/browser suite was requested for this integration.

For the multi-room/portrait repair, all nine source boards were inspected again.
No tests, type checks, builds, APK creation or game/browser launches were run.
Rendered furniture registration, every passage and NPC interaction still require
manual review; source inspection is not a claim of completed runtime testing.

Exact prompt set: `docs/art/interior-generation-prompts.json`. Region assignments and slot inventory: `catalog.json`. Original built-in outputs remain in Codex's generated-images directory; selected project files are saved here and do not depend on those originals.

