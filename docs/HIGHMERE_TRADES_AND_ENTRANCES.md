# Highmere trades, residents and entrance steps

Based on main `4fcc6ea`. This pass preserves every existing WORLD_CONTENT
record and NPC definition, including the entire approved Highmere lot survey.

## Market and street life

The final admitted stalls now each have a dedicated, named seller. Sellers
stand in clear space at the open counter end, without any exemption from
walls, counters, roofs or other NPCs. The content pass registers their stable
identities only after it knows which stalls actually exist. Fixed workplace
spawn searches stay near their counter rather than relocating across town.

The source-data review admits eight sellers, eight additional neighborhood
workers/shoppers and twelve additional delivery stacks, barrels and seats.
Moving neighbors use existing complete directional civilian sets, schedules,
local avoidance and streaming. Their decorative overhead labels are hidden;
stationary seller identities remain visible. Original NPCs are unchanged.

## Readable establishment identity

Sixteen painted trade symbols share one versioned atlas. Existing shops,
workshops, guilds, barracks, stables, temples, archives and the royal keep
receive the relevant symbol. Building frontage and services remain unchanged.

Signs, facade banners and stocked counters map the complete image with explicit
UVs instead of repeating/cropping a material swatch. Frames, brackets and signs
remain fixed 3D assemblies. Prefab, shadow and static-state keys include the
establishment identity. The existing bounded image preparation/upload path
loads the new atlas; no separate light or animation loop is added per sign.

## Screenshot: feet inside entrance steps

The exterior model previously drew raised treads while outdoor foot placement
sampled only terrain height. `ArchitectureEntry.ts` now owns both the doorway
survey and the exact tread geometry. The mesh and the foot solver consume this
same definition for castles, cottages, inns, service houses and shrine steps.

Only streamed entrance surfaces enter the spatial index. A foot query touches
one cell and creates no arrays. Surface publication, visibility, retirement,
destruction and scene cleanup follow the existing scenery lifecycle. The
building's own anchor remains outside its treads to avoid lifting a house onto
its own step. Interior stair handling, camera behavior and original collision
footprints are preserved.

## Verification

- Required application/test-configuration TypeScript check passed.
- Required Vite/Capacitor TypeScript check passed.
- Bounded source-data comparison: all 4,165 original content records and all
  277 original NPC definitions unchanged; no duplicate content IDs.
- All eight admitted market stalls have one assigned seller; none unstaffed.
- Compiler/data checks do not establish rendered geometry, device FPS or saved
  game behavior. No game launch, browser test or unit suite was run.

Signing identity, application ID, combined APK/EXE release workflow and release
retention remain unchanged.
