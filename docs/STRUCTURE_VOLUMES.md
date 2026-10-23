# Structure volumes

Base: d677dcdcc014ab987ea3b8211783d00f8cb281bf.

The previous house extrusion reused the shallow painted ground-contact strip as
visual depth. Most other buildings and town walls remained billboards. This
produced thin houses and camera-facing fortifications during orbit.

`HouseGeometry` now defines visual depth independently, normally 70% of visible
house width. Houses retain the complete original front illustration with closed
side/back walls and roof surfaces. The original, capital and elven building sets
include shrines, chapels, gatehouses, castles, towers and ruined arches. Towers
use faceted structural tiers, gallery ledges, hipped roofs or a crenellated crown.
Open gates/arches retain a concave aperture through their back and reveal faces.
The separately streamed Tower of Might receives the same volume path with its
own stone tiers and crown; its southern doorway remains clear. Scorched arches
reuse the matching original ruin profile.

Town curtains carry a surveyed world-space segment from settlement data to the
presentation hint. Their 3D masonry faces, tops and merlons align with the same
boundary lines used for movement. Existing entrance gaps and stable content IDs
are retained. Interior panels also have side/back thickness; bridge rails retain
their existing presentation.

Material patches come from each structure's existing source frame. Separate
surface UVs repeat opaque stone/timber/tiles, avoiding stretched tiny stripes.
Inset sampling limits atlas bleeding. Front artwork and registration remain
intact. No source PNGs, generated texture canvases, runtime pixel scans or new
image downloads are introduced. Patch opacity was inspected in the source art.

Meshes still use the existing instanced batches, view culling, upload preparation
and incremental release. A retained startup batch prepares the shared structure
shader before travel. Shadow geometry and picking follow the same volumes. The
small number of additional vertices is shared by each visible source style;
there is no per-frame rebuilding or whole-world mesh construction.

Closed solid buildings receive a bounded additional collision footprint behind
the facade to match their new depth. Surveyed front stoops and props are retained;
gate/ruin apertures keep their existing collision owners. Bodies use the existing
staging, activation, retirement and destroy lifecycle. Saved records, quests,
actor IDs and signing identity are unchanged.

Both required TypeScript checks must pass before publishing. Browser/Android CI
verify packaging and the signed, non-debuggable APK. Gameplay, shader appearance,
door access and Android frame pacing have not been runtime-tested under the
standing test restriction. Device review should orbit houses, towers, shrines and
diagonal curtains; check gates/interior return and repeat the same walking route.
