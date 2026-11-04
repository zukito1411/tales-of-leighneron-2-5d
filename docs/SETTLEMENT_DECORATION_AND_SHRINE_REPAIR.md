# Settlement decorations, shrines and boat camera handoff

## Source changes

- Clothesline candidates now reserve their full span outside a house and try
  both side yards. The previous 100-unit offset could overlap the house with
  a 230-unit line, causing admission to reject it.
- Pastures try complete enclosures of several sizes. Additional candidates
  follow measured building yards and exact gaps between parallel roads. This
  avoids missing narrow usable plots between samples of the old regular grid.
  Fences, hay, bedding and water are admitted together. Roads, NPC stations,
  quest approaches, existing buildings, defenses and protected land still veto
  placement. Smaller enclosures have fewer animals and shorter roaming ranges.
- Windmill admission reserves the tower and lateral sail span in ground space,
  separately from its elevated silhouette used for streaming. Existing bounds,
  actor limits, collision checks and shared instanced rendering remain active.
- Outdoor bench widths are capped at 108 world units and their backrest height
  follows the character body reference. Smaller existing benches stay smaller;
  cafe chairs and indoor furniture keep their authored dimensions.
- Regional-map services use the exact cached canvas badge painter used by the
  minimap. Local actors, danger, quest direction and the player use matching
  marker shapes and colors. Authored services remain available beyond the
  local streamed actor snapshot.
- Actual chapel building models now have arched entrance doors, with glazing
  above the entrance. Teleport shrines instead use a shared full 3D sculpture:
  a robed goddess with feathered angel wings, a strung harp, a stepped pedestal
  and an attunement halo. Its geometry uses existing model material atlases;
  no additional raster artwork or cold-start asset decoding is required.
- All 12 teleport shrines retain their existing content IDs, positions, arrival
  coordinates and saved unlocks. Original sacred courts remain reserved so
  replacing the central model does not cause neighboring buildings to refit.
  Interaction aims and collision use the new statue. The halo follows both
  existing saved attunement and newly granted unlocks, including quest grants.
  Its additive emission shares the existing owner retirement and destruction
  cleanup and respects the player's bloom setting.
- Boat arrival now restores the selected player camera during the covered
  settling phase. FPP/TPP mode, pose and zoom therefore return before destination
  readiness checks and reveal. Previously readiness could be established for
  the temporary orbit view, followed by an unprepared FPP switch after reveal.
  This is a source-level repair of a camera handoff defect; the reported crash
  has not been reproduced or established as caused solely by that defect.

## Validation

The authorized Node-only content diagnostic admitted 10 pastures, 6 windmills
and 43 clotheslines across the settlement survey. Highmere admitted 2 pastures,
1 windmill and 8 clotheslines. It found no street, building or reserved NPC
station overlaps in the new fittings, no pasture crossing a road, and no
outdoor bench exceeding the small width limit. All 12 shrine definitions load.
Not every settlement has a qualifying pasture or mill plot; cold settlements
retain the intentional windmill exclusion. Existing structures are preserved.

The diagnostic reads the actual public animation manifests through the existing
manifest plugin. It starts no HTTP server, browser or game. Diagnostic exports
remain temporary, outside versioned game assets.

Required application/test TypeScript and Vite/Capacitor configuration compiler
checks are run separately. These checks do not establish rendered appearance,
real-device frame pacing or completed boat journeys. No Playwright, gameplay,
production build, APK build or release is part of this verification.
