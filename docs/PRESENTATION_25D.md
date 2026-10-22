# 2.5D presentation migration

## Ownership

`createMernondnaGame` keeps the existing BootScene and WorldScene, timers,
Arcade physics, input actions, Zustand state and streamed content. It selects
Phaser's Canvas compatibility backend and installs `ThreePresentation` after
boot. Only the scene-manager world render callback is replaced. Dynamic texture
and vector preparation still use Phaser's existing canvas utilities.

ThreePresentation does not start an independent simulation, RAF loop or save
provider. Rendering finishes before the original POST_RENDER readiness event.
Renderer disposal participates in GAME_DISPOSING and DESTROY and restores
wrapped methods before disposing GPU resources.

## Projection

World `(x,y)` is ground `(x,0,y)`, viewed at 52 degrees above the ground. Sprite
planes face the fixed camera and use the original feet/origin registration.
There is no camera rotation control: arbitrary yaw would expose missing views
in the four-direction source artwork. World positions, collision footprints,
movement speed and skill geometry remain in the original coordinate space.

`onPlane` marks ground/upright/screen objects. Attachments and labels can retain
an owner anchor, keeping weapons and names on the same projected foot plane.
Ground profiles, interiors, trees, the flagship and combat warnings provide
explicit classification at their existing owners. Existing floor masks are
translated into bounded rectangle-union shader clipping.

## GPU and raster resources

SpriteBatch shares one instanced mesh per atlas/blend/layer/mask combination.
Frame rectangles and tint/opacity are instance attributes. TextureCache observes
existing source refresh boundaries and DynamicTexture drawing; no pixels are
read back for frame updates. Geometry, textures and batches not used for more
than two presentation frames are released.

Vector warnings, shapes and tiled floor objects use RasterCache. It invokes the
pinned Phaser 3.90 native canvas draw routine on a detached local drawing facade,
then uploads that object's small raster. It never rasterizes the full world.
Unchanged command buffers reuse their surface; dimensions are limited to 2048
pixels per side. This boundary depends on Phaser 3.90's native object layout,
which is why the runtime is pinned instead of floating to another Phaser release.

## Input and presentation

Native mouse/touch world hit testing is disabled while ThreePresentation owns
the visible canvas; keyboard and React touch actions remain connected to the
original simulation. Raycasting finds a displayed instance and applies the
original object's local hit-area callback before emitting its pointer event.
Proximity, quest and menu guards stay in the existing handlers.

Existing UI overlays are rendered in screen coordinates. Interior backdrops
are drawn before the world; weather and cinematic covers follow it. A WebGL
context failure stops simulation and exposes a menu/reopen recovery message.

## Isolation

- Original upstream source and asset history are retained.
- Browser save key: `mernondna-25d-save-v1`; same version-7 payload.
- Offline cache prefix: `mernondna-25d-shell-`.
- Android package: `com.mernondna.rpg25d`.
- New CI builds browser artifacts. Android preview builds are manual.
- Original itch.io publishing automation is removed from this repository.

## Verification and remaining work

This is an initial rendering migration, not an assertion of complete visual
parity. No gameplay/browser tests, server launch or device performance checks
are authorized by this implementation task's standing repository rules.
Compiler results are reported separately in the delivery message and Actions.

Before promoting this edition, explicitly authorize and perform visual review of:

1. New game, continued save, recovery, imports and return to menu.
2. All four actor directions, cropped hand patches, awakened forms and weapon grips.
3. Picking NPCs, enemies, beds and housing interactions on mouse and touch.
4. Warning boundaries and hit positions, projectiles, boss skills and ground effects.
5. Interiors, furniture, wall occlusion, room masks, flagship and Tower floors.
6. Night lighting, weather, transparency, camera transitions and skipped cinematics.
7. Portrait/landscape resizing, context loss, scene disposal and repeated re-entry.
8. Actual Android GPU memory, texture churn and steady frame time.

Known design constraints: existing perspective-painted scenery remains sprite
art rather than volumetric geometry. Fixed yaw and the existing 2D collision
model are intentional. A fully modeled world, elevation traversal, new camera
angles or measured FPS improvements require additional work. Do not label the
migration as release-ready based on successful TypeScript or a web build.

## Ground coverage and artifact correction

The original Phaser camera's vertical world rectangle is too small for a tilted
ground plane. Walking, initial loading and cinematics now share the projected
45-degree ground footprint with chunk streaming. The normal 2D simulation and
world-coordinate saves do not change. The camera-fitted darkness overlay is
composited in screen space; large projected silhouette shadows are made
translucent so painted props do not cover the floor in black. Atlas offsets
move the sprite mesh only for genuinely trimmed frames.

This removes known sources of black gaps and black overlay slabs, but does not
constitute a real-device visual test. The scenery is still sprite art rather
than extruded architecture; a fully modeled 2.5D environment is separate work.

## Oakmere architecture pass (real 3D structures)

The presentation layer now creates retained Three.js building volumes for the
existing authored cottages, inns, smithies and most compatible capital/elven
buildings. Surveyed source-art footprints determine their ground positions.
Buildings receive separate vertical wall meshes, painted front façades sourced
from the approved artwork, pitched roof meshes textured with the same art,
three-dimensional beams, stone foundations and real chimney geometry. The 2D
building actor remains the owner of the original collision, save ID and
streaming lifecycle; only its visual draw is replaced. Hollow ruins, gateways,
interactive structures and incompatible props retain their original art until
specialized models exist. This is not a wholesale conversion of the eight realms.

The rendering path also uses Phaser Text's actual backing resolution for
nameplates and removes giant opaque NPC label backdrops. Volume geometry
resides only for visible/recently visible actors and is disposed on streaming
retirement or presentation shutdown.

### Actual visual verification still required

A successful compiler/APK build does not verify the material UV sampling,
roof placement, facade alignment, occlusion, input or device frame time.
Inspect Oakmere in the Android build before accepting this as a finished
Octopath-style conversion. Buildings retain the game's unique approved art:
this implementation is *inspired by* HD-2D and does not copy Octopath assets.
