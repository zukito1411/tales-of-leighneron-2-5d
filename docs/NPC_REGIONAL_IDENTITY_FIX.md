# Regional NPC appearance audit

Source snapshot: `9f66ab797f3cf12d72e1445e5510010e19f24995`.

## Findings and change

`Npc.playDirection` selected generic side/back idles before checking the
actor's regional model. An orc could therefore show its Rindass portrait from
the front and its human source family's idle after camera rotation. The same
branch was shared by other regional residents, visitors and indoor sentries.

Regional presentation now runs first. Civilian portraits retain their approved
regional appearance at every camera angle; they do not gain invented directional
art. Existing matching regional officer walking and combat sheets remain in
use. Returning to a portrait restores the idle clock and immovable body state.

Regional preparation also previously replaced an incomplete crop with the
generic human family. It now retries the same regional source with bounded
8, 24 and 48 pixel margins. A pose cut at the actual PNG boundary retains its
regional identity and adds a `citizenArtWarnings` entry for an artwork repair.
This work happens during the existing staged preparation, never per frame.

## Assignment inventory

The source inventory resolves all 236 NPC IDs and all 36 regional models.
The 52 referenced portrait, walking, cast-board and combat source paths exist
in this commit. Explicit ancestry assignments have no conflicting regional
race mappings. These are source-level checks, not proof of rendered artwork.

| Settlement | NPCs | Regional models assigned |
| --- | ---: | ---: |
| Oakmere | 19 | 1 |
| Highmere | 48 | 3 |
| Willowcross | 12 | 1 |
| Elarion | 24 | 3 |
| Moonfall | 13 | 1 |
| Starhold | 18 | 17 |
| Red Mesa | 18 | 16 |
| Deepford | 19 | 17 |
| Tidewatch | 16 | 15 |
| Skallheim | 18 | 17 |
| Blackspire | 18 | 17 |
| Cibar Plains | 13 | 11 |

Regional counts include visitors, whose home culture is retained rather than
being replaced with the host settlement's ancestry. Rindass artwork is assigned
to 21 NPCs across the world, Druganwoods to 36, Frostlands to 15, Portquill to 17,
Nardorous to 16 and Darkav to 14.

## Verification boundary

Both repository TypeScript compiler checks passed. No game, browser test,
unit suite or development server was launched. The full source-image comparison
and real-device camera, movement, combat and indoor inspection remain pending.
Save IDs, resident assignments, quests and approved image assets are unchanged.
