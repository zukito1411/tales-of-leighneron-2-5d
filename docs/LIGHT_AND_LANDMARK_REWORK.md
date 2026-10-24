# Light visibility and landmark rework

Based on main 9df82cd. The original painting remains the reference and texture
source. There is no imported third-party model or new texture dependency.

## Light attachment and visibility

Halos and GPU darkness pockets use the same world-space emitter positions.
Indoor lamps face the camera around their emitting point, regardless of the
furniture heading. Outdoor lamps use the modeled bulb/flame, and house facade
lights include the authored ground-floor lift. Elevated lights no longer use a
2D ground-rectangle visibility test in the 3D renderer.

A shared four-tap source-depth filter plus a per-fragment foreground-depth
check replaces the binary single-pixel rejection. The depth tolerance is in
world units. Lamp housings receive only their measured bulb radius as extra
self-occlusion clearance; walls and foreground objects still block the halo.
Distance fades retain the existing fog/view-distance limits. Both emitters and
halos retain the original night/quality switches.

Model emissions no longer shift along world Z. Window and lantern emission
faces sit just outside their own pane, following its normal on every side.
There is no full-world shadow pass, CPU depth readback, raycast per light,
extra frame loop or unbounded light/texture cache. The extra depth taps apply
only inside the existing light quads; real-device GPU cost remains unmeasured.

## Tree of Life

The flattened front/back depth-grid shell has been replaced in the active
furniture factory by a custom branching mesh. Curved fluted trunks, nine root
buttresses, front/rear branch forks, layered textured boughs, physical leaf
sprays, gold winding veins and turquoise hanging crystals share one prefab.
Bark and leaf swatches come from the retained Elarion tree painting. The lamp
centres are shared with the model, and only crystal geometry enters its
emission pass. Exactly two cached source buffers (normal/emission) are retained;
batch copies use existing retirement, and game teardown clears the source cache.
The reference depth-grid files remain available as authoring
history and are no longer imported by the active model factory.

The landmark moves from town-relative (540,-1050) to (1120,-1260), clear of the
Ward Chapel and inside the northeast defensive wall. Its stable content ID is
unchanged. Existing static-content restoration already uses authored positions,
so old saves retain progress while receiving the layout repair.

## Tower of Might / Magus tower

The 3D exterior changes from 380x570 to 520x1900 presentation units, with
fourteen repeated exterior gallery bands, rather than elongated four-storey
details. The fifty playable floors, checkpoints and quest gates are unchanged.
The circular collider matches the larger base and extends north; the southern
approach coordinate stays fixed. Portal sill and stairs stay near ground level
with a 152-unit doorway, larger than the 76-unit hero body. A saved player inside
the expanded foundation is moved to that existing approach when it loads.

## Verification boundaries

Required TypeScript application/test declarations and Node configuration checks
are run locally. Offline static authoring views inspect front/side/rear mesh
geometry and source texture mapping; these are not in-game screenshots or
shader/device validation. No game, development server or test suite is launched.
Physical Android/Windows angle sweeps and FPS remain to be checked in gameplay.
