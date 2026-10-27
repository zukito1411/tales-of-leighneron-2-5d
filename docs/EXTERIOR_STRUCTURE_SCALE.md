# Exterior structure scale and collision

Buildings use one uniform scale for frontage, height and depth. The 76-unit
standing body is the reference: cottages have at least 395 units of frontage,
inns/manors 471, and castles/palaces 1,672. Door clearance also sets a uniform
minimum scale. Complete roofs, floors, windows and carvings retain their authored
proportions. Existing artwork, actor sizes and camera settings remain in use.

`architecture.ts` owns proportions and scale limits. Lots and freestanding
settlement structures choose their scale before placement; `HouseGeometry` keeps
that scale. `propPlacementBounds` reserves modeled ground occupation, including
explicit wall-segment dimensions; `spriteBounds` retains illustrated coverage.

`settlementPlanning.ts` shares orthogonal ground plans among walls, roads and
terrain foundations. Rectangular inhabited wards have attached northern keep
precincts, avoiding large empty strips beside castles. The outer commons and
fields retain clearance. Deepford's lower terrace shares its regional trade
street rather than trapping houses between parallel road reservations. Finer
local plot candidates find valid roadside spaces before broader reflow.

Castles reserve 980-unit forecourts. Their gate bodies leave more than eight
standing-body heights between the inner gate masonry and Highmere's castle door.
Door aprons and processional paving sit between side gardens. Palace floral fence
panels repeat complete source designs uniformly around the courtyard. Gate IDs,
castle/interior IDs and entrance derivation remain stable.

Curtains have explicit height and thickness shared by rendering and collision.
Capital walls are 320 units high and 64 thick. Other settlements use their size
classes. Corner towers and gate bodies reserve space before neighboring houses.
Flat-ended curtain collision matches the mesh rather than extending rounded
invisible end caps into passages. Royal curtain openings use the same architecture
aperture and source foot anchor as the gate model. Open gates retain full-depth
solid supports and clear centers; closed gates remain solid.

Fitting protects roads, crops, shrine approaches, neighboring structures and real
outdoor NPC positions. Shared indoor assignments avoid reserving obsolete
exterior positions for indoor residents. The existing target cutaway also reveals
the nearby conversation NPC without another world scan, shader pass or camera
lock. Story props change visibility and collision together; hidden props do not
publish enabled ground bodies. Retired scenery disables collision immediately,
and saved obsolete walls are discarded while current static positions follow
the repaired source definitions.

`settlementOccupancy.json` retains admitted building, planting and decoration IDs.
Avenue trees keep their IDs when terrace lengths change. Constrained roadside
objects expand their search only after exhausting nearby space; habitat fitting
also searches bounded garden grids before dropping optional scenery. These
operations reuse at most eight cached placement grids during data preparation,
not gameplay frames. Viewport streaming, instancing and staged collider
publication remain in use.

Verification before the final invisible-blocker adjustment: nine focused
architecture/layout checks passed across all settlements, and two browser checks
passed for production courtyard models, resident cutaways and playable New Game
startup. At the user's subsequent request, the final wall-end, gate-aperture and
hidden-prop collision adjustments receive only the two required TypeScript
compiler checks. No further Playwright or gameplay tests are run. These checks
do not establish real-device Android frame pacing or an absence of every bug.
