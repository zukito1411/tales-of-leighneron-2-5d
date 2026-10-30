# Highmere crown city

Highmere uses the existing settlement, terrain, architecture, collision and
viewport streaming systems, with the approved building and character artwork.

The capital has a 6,100-unit, 64-section outer curtain and a separate raised
royal ward with a 32-section wall, audience gate, northern garden postern and
2,090-unit keep frontage. The keep retains roughly 1,890 units of gate-to-door
space. Noble and temple terraces flank the royal ward; the market is west of
the central civic plaza, with military and craft courts to the east. Commoner
housing occupies the southwest and paved rural households the southeast.

`src/data/highmereComposition.ts` surveys all 100 building slots and their
street fronts. The original 34 core and 24 ward slots retain their identities,
followed by the existing 42 household/service additions. Placement passes no
longer move these buildings to whichever distant space happens to fit. Uniform
scaling keeps each complete building's proportions; larger institutional
frontages distinguish the archive, market hall and temple from ordinary homes.
Shared foundations follow the resulting footprints and existing terrain grades.

Noble and rural districts retain stone paving; commoner streets and household
approaches use dirt. Stone roads receive a darker finish over the original
stone texture, leaving courtyard paving lighter. This is performed during the
existing bounded terrain bake, using its scratch mask and layer in both worker
and fallback paths. It introduces no extra per-frame road effect or runtime art.

The Crown Shrine retains its travel/content ID at local (1100, 3900), facing a
reserved garden and approach. Through roads pass along the garden's edge; seats,
lamps and a fountain furnish its sides. The entire garden is reserved against
unrelated buildings, trees and later loose-prop fitting. The market, shrine
gathering place and drill court are authored public spaces; the automatic
commons search does not add another set of courts and boards in Highmere.

Highmere has one contract board, preserving `detail:highmere:civic:2` beside the
central plaza at (190, 220). The previous conversion of every decorative notice
into a contract issuer is constrained to the primary board in Highmere.
District information uses directional signposts, and existing investigation
clues retain their separate quest hooks. Twenty-six surveyed lamps replace the
85 overlapping generic/ward/household lamp placements. Admitted furniture and
trees carry fixed placement metadata so later fitting cannot scatter them.

Eastgate remains the single eastern curtain exit, with the Crown River Quay
outside the walls on the west bank. The packet boat, landing, promenade, cargo
and passenger crew retain their shared survey and port ID. The east bridge and
southern King's Gate bridge retain 220 units of clear width and their existing
modeled railing/collision logic.

Indoor residents follow their buildings. Exterior household routines derive
from the same street fronts; named contacts, future schedule anchors and the
escorted witness's arrival use the revised survey. Quest and NPC IDs remain
stable. Static saved scenery adopts authored coordinates through the existing
content-ledger policy while preserving used/looted/attuned state; the existing
live escort, quest-return and safe NPC admission logic remains authoritative.

The six existing marching knights retain their 10,000-unit western market
circuit and 120-unit rank spacing (about 84.85 minimum geometric separation at
right-angle corners). Night stations now stand clear of the barracks footprint.
Their route remains the same shared street reservation used by placement.

## Verification limits

The bounded, authorized Node data review loads the actual content and terrain
modules. It checks all 100 admitted buildings, one contract board, all 26 planned
lights, building/street/defense clearance, shrine reservations, exterior NPC
position/home/schedule/escort anchors, prop overlap, nearby resident separation,
quest content references and the march centerline sampled every 16 units.
Shared fence sections intentionally meet their adjacent sections.

Both required TypeScript compiler checks are run after implementation. These
checks do not establish rendered aesthetics, runtime quest completion, Android
behavior or measured frame pacing. No browser, Playwright, game window,
development server, production build or Android build is used for this review.
