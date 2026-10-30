# Highmere crown city

Highmere's concept is implemented through the existing settlement, terrain,
instanced architecture, streaming and collision systems. It does not load a
painted city backdrop or replace the approved building artwork.

- The outer city uses a 64-section circular survey, 6,100 world units in radius.
  Sixteen spaced watchtowers accompany the modeled, 380-high, 88-thick curtains.
- A raised royal ward uses a separate 32-section ring, an audience gate and a
  northern garden postern. The uniformly sized keep has a 2,090-unit frontage,
  with roughly 1,890 units from its door to the audience gate. Gardens, water,
  seats, banners and a rear walk give the precinct uses beyond circulation.
- Noble and temple terraces, a civic plaza, guild market, weavers' common,
  commoner housing, rural households and southern allotments have distinct land
  use, streets and readable district notices. The original 34 central building
  indices and 24 ward building slots remain stable, followed by new household
  and service plots. Civic buildings occupy their actual districts rather
  than clustering in the old miniature core. Existing ward trees and
  dressing retain their IDs and artwork at redesigned locations.
- Real terrain grades raise the royal, noble and temple areas. Indexed flat
  building foundations and feathered margins keep sloping ground out of houses.
  Renderer and movement sample the existing shared elevation system.
- The crown river now skirts the eastern and southern walls. One eastern bank bridge
  and the southern main gate bridge provide 220 world units of clear pedestrian
  and wagon width. Their prepared masonry models cap railing height relative to
  the hero instead of making oversized posts when widening a deck. Meshes,
  rotated navigation, loaded colliders and unloaded placement use one survey.
- Oakmere's primary contract board is reserved beside its central meeting
  square; Highmere's is beside the civic crossing. Primary boards keep their
  existing IDs, issuing settlement and contract behavior. Other local notices
  remain usable. Houses, dressing and future NPC routine anchors reserve space
  before board fitting; central boards cannot drift into an outer ward.
- Gate sentries have updated authored home/work stations outside the archways.
  Existing indoor residents follow their buildings. Other story contacts and
  escort hooks retain their existing identities and runtime admission checks.
  Static saved scenery adopts the new authored locations through the existing
  content-ledger policy, preserving used/looted state. Continued player positions
  are checked against unloaded physical geometry before actors begin streaming;
  valid saved coordinates remain authoritative.

Circular curtain collision uses the shared static spatial index rather than
scanning every ring segment for each movement probe. Scene teardown owns bridge
colliders through the existing scenery lifecycle. Viewport streaming, staged
asset preparation and existing graphics settings remain in use; there are no
new runtime images or whole-world rendering passes.

The required local TypeScript checks and a focused Node-only layout/data
review are authorized. Browser, Playwright, gameplay, production builds and
Android checks are not part of this review. Existing regression expectations
reflect the single eastern crossing; the unit suite has not been executed.
Rendered appearance, runtime quest progression, Android behavior and frame
pacing remain unverified by these source and data checks.


The inhabited district revision replaces the overlapping legacy core road grid
with a circular civic plaza, connected market courts, graduated residential
lanes and the upper garden walks. Each admitted household has a reserved
entrance; new lots pass the existing full-footprint, road, water, NPC and wall
clearance checks. Existing lots reserve first. Uniform architecture dimensions
and approved art remain unchanged.

Only Eastgate and its broad bridge cross the eastern curtain. Its rotated
modeled gatehouse and exact curtain shoulders share the existing aperture
survey. The quay now stands on the Crown River's west bank outside Eastgate,
with a paved connection, packet boat, cargo, shelter, direction signs and
passenger boarding. Port IDs, island destinations and travel state stay stable.
The Crown Shrine keeps its content/travel ID in the lower ward beside the
household gardens.

Forty-one named peaceful residents add neighborhood work, midday meetings and
home routines, including market traders, upper garden keepers and quay crew.
They use existing approved character art and the same bounded admission,
viewport streaming and routing as other residents. No city-wide per-frame
simulation, eager asset load, alternate renderer or graphics reduction is added.


Noble and rural districts use stone paving, while commoner homes and the lower
worker quarter retain dirt/grass. Heraldic lamps, floral borders and paired
seats identify the upper courts; fodder stores, carts, wells and grain buildings
identify the rural yards. Cultivated plots retain farmland.

The six existing knights retain their IDs and now march a shared 10,000-unit
western market/barracks circuit. The public street reservation uses those exact
points. Route length is derived from the path; 120-unit rank spacing gives a
minimum geometric separation of about 84.85 at right-angle corners. Night watch
stations and saved-source schedule anchors use the same barracks survey. The
existing collision and formation-rejoining systems remain authoritative.


The authorized Node data review admitted all 100 Highmere buildings (the
original 58 slots plus 42 additions) and all 41 new residents. It found one
eastern road exit, two city bridges including the south gate bridge, no
building/street overlaps, no blocked new-resident or night-watch anchors, and
no new routine stops on public lanes. The complete march centerline sampled at
16-unit intervals was clear. The quay bank approach and boarding terrain were
valid. Highmere quest target references remained present and checked exterior
quest objects were clear of scenery. No authored prop was left unfitted.
These are data/geometry results, not a rendered or gameplay acceptance test.
