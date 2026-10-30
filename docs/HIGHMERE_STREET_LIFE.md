# Highmere street life

This pass layers detail onto the capital survey from `8465d9c`. Existing lots,
roads, objects, NPC starting positions, doors, services and content IDs remain
authoritative. No existing establishment is relocated or resized.

## Presentation

- Fifteen existing establishments gain source-palette awnings, framed trade
  signs, shutters and flower boxes: inns, cloth exchanges, forges, guilds,
  provisions, archives, bakeries and gardeners.
- The four admitted original market stalls keep their exact content records;
  their prefabs gain distinct stock. Four additional stalls fit in clear market
  space. Stock includes cloth, produce, herbs, tools, bread and books.
- Ninety-three new props fit the remaining space: 34 planted pots, 20 flower
  borders, 15 barrel groups, 11 benches, three tea tables, four chairs, one cloth
  counter, one arms rack and four stocked stalls.
- Thirteen existing civilians use their complete directional walking sets and
  the existing local patrol/schedule system. Moving background household labels
  are hidden; trade labels remain. No new NPC population is created.

These are visual trade identities, not new inventories, quests or interiors.
The approved capital buildings, painted furnishings, building details and plant
art remain the material source. No replacement image atlas is introduced.

## Placement and streaming

`highmereStreetLife.ts` appends after the original placement and commons passes.
It checks source/ground bounds against fixed objects, streets, entrances,
exterior NPC anchors, the shrine court, royal ward and planted/water parcels.
Candidates that do not fit are omitted rather than moving existing content.
The pass has a hard admission cap and is idempotent.

Presentation variants participate in existing prefab/batch and static-state
cache keys. Added geometry uses the existing atlas-compatible ModelMesh path,
streamed prop lifecycle, collider retirement and quality settings. No new light,
particle loop, texture decoder or per-frame world search is introduced.

## Verification

- `npm run test:types`: passed.
- `npm exec --no -- tsc -p tsconfig.node.json --noEmit`: passed.
- Bounded source-data comparison: all 4,072 original WORLD_CONTENT definitions
  are exactly unchanged; 93 unique new definitions bring the total to 4,165.
- Data review confirms 13 opted-in civilian routines and eight stocked stalls.
- No gameplay, browser, unit-test or real-device performance session was run.
  Compiler/data checks do not establish rendered appearance or device FPS.

Android and Windows release configuration, application ID and signing identity
are unchanged.
