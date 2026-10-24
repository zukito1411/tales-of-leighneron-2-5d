# Architecture rebuilt from the original building sheets

The reference drawings are `public/assets/sprites/buildings.png`,
`capital_buildings.png`, and `elven-villa.png`. The authored assemblies live in
`ArchitectureGeometry.ts` and are selected by the existing house profile ID.
The previous construction extruded a complete roof/front silhouette through
one depth. That made roof paint cover gables, turned castles into slabs, and
lost the shape of roofs and projecting wings.

| Reference family | Assembly |
| --- | --- |
| Thatched cottage | Low stone foundation, timber/plaster body, rounded hip roof, projecting dormer, offset arched door, windows, chimney, planter and barrel |
| Inn and manor | Two floors, timber framing, a separate main roof and forward gable, upper/lower windows, sign or balcony, chimney |
| Human hall and storehouse | Long slate roof, dormer, arched entry, rear/side windows, blue banner or cargo barrels |
| Human castle | Connected wings, forward keep, crenellated rear crown, four cylindrical towers with slate caps, windows, banner, projecting buttresses and steps |
| Elven houses and guildhall | Curved teal roof shells with raised tips, gold verges and leaf finials, lancet glazing, pointed doors, planters |
| Elven manor and estate | Layered curved gables, large upper lancet, balcony and side/rear windows; estate also has wing turrets |
| Elven palace | Great hall and large stained-glass lancet, four curved-roof towers, open side arcades, banners and buttresses |
| Gatehouses | Open tunnel through the complete depth, separate flanking towers and connecting roof |
| Shrines and chapels | Tall arched glazing, buttresses, raised roof, steps and crest |
| Smithies and stables | Deep open bay with side/rear walls and structural posts; hearth/chimney and anvil or divided stall doors |

Roof shells have closed undersides and end faces. Side and rear windows use
wall-oriented frames, glazing, mullions and sills. Only individual window glass,
small signs and banners use source artwork, rather than a whole house on a front
face. Roof materials use clean thatch, slate and teal-shingle swatches; the inn retains
its original moss-colored slate. Unverified old samples containing pieces of
doors, plants and windows are not tiled. A separate shared detail atlas contains
the original small/large window glass, heraldry, mug/anvil signs and foliage.
Its UVs are local to each architectural part, independent of runtime sprite
packing, frame padding and trimming. Source pixel rectangles and a reproducible
Pillow preparation script are committed with the atlas.

Existing round watchtowers, Tower of Might, contract boards, surveyed town walls
and ruins continue through their established geometry path. Structural dimensions
remain inside the existing footprint/envelope. No content IDs, save layouts,
collision rules, quest logic, interior entry points or actor anchors change.

Assemblies are constructed once when an existing sprite batch is prepared.
All parts remain in that source batch: no mesh/material per window, per-frame
mesh construction, global asset cache or additional render pass. The one added 1024-square
detail texture uses about 4 MiB of RGBA GPU storage and the existing bounded
boot decode/upload queue; it is shared by every building. Existing streaming, resource retirement, cutaway, shader warmup, atmosphere
and Android lifecycle systems remain in place. More detailed geometry has a GPU
cost; compiler success and browser captures are not Android frame-time evidence.
