# Settlement streetscape, outdoor dining and livestock

## Layout and presentation

Outdoor cafe groups reuse `diningFurniture`'s table front-foot anchor, ground center and opposing chair headings. A composition is admitted atomically. Semantic outdoor models use their authored width rather than the cargo/bench source painting's padding or contact point. Shared fitting footprints drive final dressing admission, unloaded placement and streamed collision. Laundry has two post colliders; the overhead rope and garments remain passable below.

`addSettlementStreetscape` runs after existing services, market workers and scenery have their final locations. It proposes household storage and clotheslines, stable hay/carts, formal pots and seating, garden boundaries and measured street verges. Climate and establishment role select the composition. Rejected proposals are omitted instead of relocated into arbitrary spaces. Existing content IDs, buildings, quest contacts and save state are retained.

Placement reserves modeled/painted obstacles, tree crowns, NPC schedules, creature areas, building entrance approaches, interactable approaches, roads, farm beds, sacred courts and defenses. Per-town limits are 240 for Highmere, 90 for other capitals/strongholds and 54 for smaller settlements; at most 16 new props per 1536-unit chunk. These are ceilings, not guaranteed admitted counts. Rendering and physics still stream through the existing world systems; no independent decoration renderer or per-frame planning was introduced.

Highmere's royal approach gains 16 stone treads over the existing 800-unit grade. The same authored heights drive the closed meshes and the existing indexed entrance/walking-surface system. Open sides retain the upper cross-street access. The stairway has no enclosing cargo collider. Ordinary building entrances and indoor stair behavior are retained.

## Maps

The regional map combines a static authored service catalog with the live nearby snapshot. Shrines, inns, smiths, contract boards, docks and cave entrances no longer require active streamed actors. Duplicate service IDs collapse to one pin; Tower of Might visibility keeps its existing campaign gate. Interior-local coordinates are excluded from outdoor marker overlays. Pins have keyboard-focusable labels.

## Wildlife

Chicken, goat and cow source masters and exact prompts are documented in `public/assets/wildlife/livestock-art-v1.md`. They are complete painted billboard animals with side/front/rear walking and grazing poses. `LivestockSystem` is owned by the existing ambient wildlife system, with six cosmetic animals maximum, indexed farm/stable sites, and highland goat opportunities. No additional collision blockers, persistent simulation ledger or mandatory boot assets are added.

Animal art decodes serially on demand. Preparation uses authored crop rectangles and one uniform fit per species. One optional route/admission check per frame shares the existing actor work budget; route proposals are incremental. Actual routes check static geometry, full-body clearance, terrain, roads and nearby NPCs/enemies. Moving animals separate from one another and avoid the hero. Reset, travel, backgrounding, game disposal and scene destruction release animals and cancel obsolete loading.

The follow-up review adds chicken-only commoner/residential courtyards and ordinary house side yards. Cows and goats retain agricultural/stable sites and the existing highland goat opportunities. Eligible stable/barn interiors author one cow, goat and chicken in separate bays; three indoor animals replace outdoor livestock in the same six-sprite pool. Room floors, fixtures, NPCs and reserved cart aisles validate each admission and route. NPC standing placement reserves the authored animal bays. No animal is added to quest, NPC or save ledgers.

Stable interiors now also author a horse in a fourth bay, with horse-sized
clearance and admission priority. The six-sprite pool is retained; four is the
indoor ceiling. Existing horse sprites were recovered from Git history under
`public/assets/wildlife/horse/`, with source provenance in its README. The
horse's three directional sources are decoded sequentially into one uniformly
scaled atlas; only one decoded direction is retained at once. Outdoor spawn
lists and the retired roaming-caravan system are unchanged.

Atlas preparation now yields between complete poses and charges the shared frame-work allowance. Animals wait for the existing presentation texture-upload fence before becoming visible, with live placement rechecked after the wait. Reset/disposal cancels decoded-but-unfinished preparation and removes partial atlases. Round-robin safety/decision/admission turns avoid starving movement and replenishment on slower frames. Idle animals and indoor contact shadows use change-only depth updates, removing unnecessary display-list sort requests; animal frames and facing update only when changed. Moving routes stop when their safety certificate becomes stale. These are source-level improvements, not measured FPS results.

## Design references

- [Historic England street audits](https://historicengland.org.uk/advice/caring-for-heritage/streets-for-all/what-you-can-do/street-clutter-audit/): retain recognizable uses of space and unobstructed access, with coherent street furniture and planting.
- [English Heritage medieval architecture](https://www.english-heritage.org.uk/learn/story-of-england/medieval/architecture/): timber construction across homes, agricultural buildings, townhouses and guildhalls informed the household and working-yard details.

## Verification limits

Source artwork and source integration were inspected. No game, browser, Playwright, unit/integration suite, production build or native packaging was run. Compiler checks do not establish admitted decoration counts, rendered layout quality, walking behavior or FPS. Those require separately authorized gameplay/device review.

Completed compiler checks: `npm run test:types` and `npm exec --no -- tsc -p tsconfig.node.json --noEmit`, both successful. Scoped tracked-file whitespace checks also passed.
