# World banners, Cinderpeak and camps — implementation checkpoint

Based on main 50105ee2d9f675cbd1675c8f17ef007d4ddaeaaf.

- Reuse the existing painted trade emblem atlas on 144 applicable establishments across all 12 settlements. Ordinary homes remain unmarked; original royal crests remain on cloth banners.
- Replace Cinderpeak's drawn billboard in the Three presentation with retained ridged basalt geometry, an open crater, molten throat and lava channels. One instanced lava ejecta batch follows the existing VolcanicTremor media clock, including pause/buffering lifecycle. Programs are prepared with the existing startup/context-restoration fence.
- Add 30 seeded camp sites across all eight regions: 14 adventurer camps, eight knight camps and eight hostile camps. Each has seven props and three occupants (66 friendly NPCs plus 24 enemies). Existing complete directional character artwork and painted flame cutouts are reused.
- Reserve camp clearings from procedural scenery. Friendly camps exclude ambient hostile feet/spawns. Camps stream and persist through the existing content manager, with stable IDs. NPC fallback searches remain near their own camps.

Checks completed before this checkpoint:

- npm run test:types — passed.
- npm exec --no -- tsc -p tsconfig.node.json --noEmit — passed.
- git diff --check — passed.
- Bounded content metadata comparison: all 4,193 pre-existing content records and all 293 pre-existing NPC definitions remained identical; no duplicate content IDs. This comparison did not launch the game or simulate gameplay.

Pending review before a published game release:

- Review crater inner-wall winding and mountain skirt contact against terrain.
- Review trade classification coverage and camp occupants' actual streamed appearance/access.
- In-game visual, WebGL shader and Android performance verification have not been performed. Type checking does not establish these.
- Camp generation intentionally omits unsuitable candidates; Nardorous and Frostlands have three camps each, the other regions four. Existing layouts were not moved to force an extra camp.
- No APK/EXE was built for this checkpoint branch. Keep the existing automatic combined release workflow, application ID and ANDROID_DEBUG_KEYSTORE_BASE64 identity intact when publishing the completed update.
