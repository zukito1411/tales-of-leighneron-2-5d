# 2.5D presentation

The existing Phaser scene remains the sole owner of physics, AI, story, combat,
streaming and version-7 saves. ThreePresentation replaces the Canvas world draw
callback and finishes before the normal POST_RENDER readiness event. It adds no
simulation or requestAnimationFrame loop. Original artwork and content IDs stay
in use.

## Camera and coordinates

OrbitCamera uses a perspective camera, continuous 360-degree yaw, look pitch
from -60 to 75 degrees, bounded distance, wheel zoom and smooth following. The
camera's orbit remains at least eight degrees above terrain while upward look
reveals the sky. Horizon views fade to a bounded 2,400-unit ground range; views
facing only sky keep a small nearby streaming footprint. PC mouse
look uses pointer lock, with a capture button and Escape release/pause. Menus,
dialogue and cinematics release capture. Sensitivity and vertical inversion are
saved separately from progression. Touch supports drag orbit and pinch zoom.
Terrain obstruction shortens the orbit; foreground scenery covering the subject
fades. Camera shake remains connected to the original camera effect.

Logical world XY maps to Three XZ. The live camera projection and inverse are
shared by lights, weather, picking and streaming. Streaming uses all four
perspective ground-view corners with bounded margins. Native Phaser artwork
fixtures retain their deterministic bootstrap projection.

Characters, trees and non-house props retain their original cylindrical
billboards. Farm wheat is upright, non-solid scenery rather than floor art.
Houses use fixed world-aligned volumes with original complete front artwork,
side/rear walls and roof surfaces following each style's surveyed silhouette.
Side and roof UVs reuse opaque patches of the supplied regional house artwork;
no replacement PNGs, procedural color blocks or extra image decodes are used.
Cottages, inns, manors, halls, smithies, stables, storehouses, chapels and the
elven estate use this path; gates, shrines, ruins, towers and castles retain
their established billboards. Geometry is instanced by style in SpriteBatch,
with the same source atlas cache, world elevation, original collision contours
and door interactions. House shadows use the same volume and world orientation;
window emissions and lamp projections stay registered to the fixed facade.
House volume bounds participate in culling and selection occlusion. Interior
walls use the original wall panel artwork on world-aligned vertical planes;
its uniform scale, cropped final panels and original collision boundaries are
retained. Floor artwork, water, shadows and warnings use ground geometry.
Bridge rail strips stay on world-aligned vertical planes at their surveyed
back/front baselines; their projected shadows use that same world axis.

Movement and dash vectors remain in world coordinates after camera-relative
input conversion. Directional locomotion, attacks and supported action clips
select their existing camera-relative artwork, retaining animation progress.
Hysteresis reduces direction changes near diagonals. Equipment retains its
original frame-specific grip registration and owner anchor.

Boat and cart frames use the route heading transformed by camera yaw. The hull,
crew, passenger, shadows and front rail share one boat anchor, with explicit
layer separation; bobbing changes elevation rather than moving map coordinates.
Wake headings still use world travel. Passage passengers select existing
front/side/rear artwork. These remain four authored vehicle views, not new 3D
vehicle models.

Desktop clicks now reach manual selection before the attack input; captured
mouse clicks raycast through the camera center. Only interactive world batches
and house occluder batches participate in picking. Automatic nearest-target assistance rejects targets
outside the perspective view; manual locks retain the original range and LOS
rules. Indicators use the same perspective visibility, and ground rings receive
their perspective squash from the camera rather than a second baked ellipse.

## Elevation and jumping

ElevationField provides bounded cached 64-unit samples and a shared GPU height
map. Terrain chunks use matching grid triangles; decals and upright sprite feet
sample the same field. WorldGenerator supplies deterministic hills and slopes,
with authored settlements, shorelines and interiors kept level. Existing
bridge/deck regions receive an elevation offset. Source ground artwork supplies
the visible texture throughout.
The GPU map keeps fixed 129-by-129 storage and a reusable float buffer; camera
movement changes only its sample contents and world-space origin. Sampling UVs
use that fixed texture stride, independently of the active coverage dimensions.
Coverage includes complete terrain chunks and a one-cell gutter, so vertices
outside the immediate camera footprint are not flattened to a moving map edge.
CPU foot/jump/camera queries use the same float samples, 64-unit lattice and
triangle diagonal as the rendered terrain. The cache holds at most 33,282
samples, allowing current coverage and a bounded speculative margin to coexist;
interiors and scenes without terrain use zero height on CPU and GPU.
During active play, exact height samples ahead of the viewport prepare within
a soft 0.4–0.8 ms frame budget (at most 64 yielded steps). Preloading changes
only the CPU cache, never a partially prepared GPU surface. Source changes,
disabled controls and shutdown discard obsolete work. Large unprepared turns
or teleports can still require synchronous height/terrain preparation.
Regional relief combines broad hills and smaller undulations, with stronger
highland relief and a smooth 384-unit shoulder around town foundations. Height
sampling remains deterministic and bounded; logical XY walkability is unchanged.

Space or the touch jump action starts a gravity-driven jump. Landing uses local
ground height, additional jumps are blocked while airborne, and a complete
existing neutral pose is reused. Attached weapons and attack visuals inherit
airborne height; shadows stay at the ground contact point. Respawn clears jump
state. Save coordinates and original obstacle/ground navigation remain XY.

This is a height-field world with the existing collision simulation. Stacked
walkable floors, arbitrary overhangs and jumping over authored solid barriers
are not implemented as a new volumetric physics system.

## Rendering and performance

SpriteBatch instances shared atlas frames with UV/tint/alpha attributes. Upright
planes use single-pass double-sided materials. Original alpha, trimmed frames,
crops and text backing resolution are respected. Opaque floors render before
ground decals, which do not claim depth and hide the terrain behind them.
Ground bounds include sampled elevation and a center point for hill crests.
Decal meshes use bounded size-based subdivisions and a small polygon depth bias
to reduce clipping/flicker against sloping floors and bridge artwork.

AttackTelegraph publishes the existing AttackArea dimensions and progress into
instanced GPU attributes. Circle, hollow ring, capsule and cone fills/boundaries
run in the shared sprite shader without repainting a warning canvas every
frame. Authored rune artwork remains on a separate ground layer. Native Phaser
fixtures retain the original Graphics implementation. Damage checks, windup
timing and cancellation remain owned by the combat systems.

Instance buffers track changed ranges independently: moving a sprite does not
re-upload its unchanged atlas rectangle, colors or tiling data. Picking records,
UV/color preparation and camera basis values are reused. Growing a batch creates
only its required geometry and buffers instead of cloning discarded attributes.
Picking slot/rectangle storage is reused across view-edge count changes; idle
slots release actor references, and batch disposal releases the pool and geometry.

Tiled floors and foam repeat their original atlas artwork in the shader instead
of repeatedly rasterizing large scrolling canvases. Vector graphics alone use
the bounded raster cache. TextureCache observes existing refresh boundaries;
animation frames do not recreate textures. Batches, rasters and source textures
retire when unused. Camera input, settings listeners, textures, geometry, render
targets and pointer lock are released on presentation shutdown.

Recently idle batches survive up to 90 frames, capped at 32 world batches and
16 shadow batches, to avoid repeated buffer/material creation near view edges.
Idle vector rasters have the same grace period, capped at 32 entries and 8 MiB.
Quest arrows and target markers use separate small local surfaces outdoors and
indoors; travel never rasterizes the empty distance between them. Interior
navigation/store publication runs at 150 ms while movement and poses stay on
the normal frame loop. Speculative terrain preparation advances at most 128
small generator steps within a soft 1.5–3 ms budget. Relief rows, ground-cover
candidates, landmark/wilderness placement candidates and individual scenery actors yield
separately. Staged scenery stays hidden until its complete chunk is published;
cancellation releases its actors, canopies and texture. Required visible terrain
still finishes atomically to retain its scenery and collisions, so rapid turns
or teleports into unprepared ground can still cause a stall.

Streaming uses the actual asymmetric perspective footprint instead of mirroring
its far edge behind the player. Nearby physics residency is retained separately.
Content residency sets are rebuilt only when their cell bounds change. Minimap
terrain never forces all 2,304 samples through a React effect: it keeps a complete
overlapping tile while its requested tile prepares in short animation-frame
slices. On first entry or a distant teleport, markers remain visible over the map
background until the first tile completes. These are source-level scheduling
changes; gameplay, visual and real-device frame-time verification remain pending.

Room entry owns at most two cancellable image decodes, independent of optional
audio in the scene loader. Furniture extraction yields between subjects and
releases temporary canvases. A 25-second request deadline restores the outside
position and controls on failure; cancellation, defeat and shutdown invalidate
pending work. Room-light masks accept Phaser's automatic default line style.
Equipped sword/hand layers use explicit camera-depth separation rather than
relying on tiny Phaser draw-order differences in the perspective depth buffer.

Source textures are acquired after visibility culling. Recently visible textures
may remain for 90 presentation frames, with at most 32 idle entries and a 64 MiB
estimated residency budget; required current-frame textures are retained even
when they exceed that budget. Destroyed sources release immediately on pruning.
The cache never decodes additional artwork or loads beyond streamed content.

GPU water uses the original foam atlas and a cached shoreline mask. Only changes
to shoreline coverage upload that mask; scrolling and blending run in a shader.
Buffered coverage has hysteresis, so small orbit changes avoid rebuilding the
mask. A bounded 16,384-cell terrain cache retains bank and bridge masking. NPC
camera pose refreshes avoid duplicating selection already done by movement.

RenderBudget limits pixel count and dimensions, with optional adaptive backing
resolution after sustained slow frames. Logical coordinates, artwork and effect
switches remain independent of backing resolution. Small ground effects avoid
the terrain grid's subdivision cost. Phaser-only artwork fixtures retain their
original CPU effects; the game uses the GPU environment paths below.

## GPU sky, shadows, lighting and weather

GpuSky draws one full-screen background with illustrated 2D cloud, sun and moon
sprites. The versioned atlas loads asynchronously after world presentation
begins and never gates first-frame readiness. Daylight palettes, celestial
positions and GPU projected shadows use the existing clock. Reduced-motion
preferences stop cloud drift. Atlas source and generation notes are in
[SKY_ASSETS.md](SKY_ASSETS.md).

Night stars use deterministic cube-face directions within the same sky shader.
They stay anchored while orbiting, fade near the horizon and at dawn, and sit
behind the moon and clouds. Cloud cover suppresses their brightness; reduced
motion freezes the subtle twinkle. No additional sky texture, draw call or
per-star object is allocated.

GpuShadows consumes the existing GroundShadowSystem caster registry. Contact
footprints and source-alpha silhouettes are instanced on terrain-conforming
ground geometry with no full-screen shadow canvas or runtime silhouette scans.
Foot registration, multiple contacts, hidden casters and graphics choices remain
owned by the original systems. Player casting/awakened visuals supply their
actual frame while the authoritative player supplies grounded coordinates and
jump height. The original CPU path remains available for isolated art fixtures.

GpuCloudShadows projects the shared cloud artwork over the ground. GpuWeather
uses static particle seeds and GPU motion for rain, snow, wind, dust and volcanic
ash, reusing the existing ash sprites. Cached world depth provides per-pixel
occlusion; bounded nearby roof rectangles retain sheltered areas. Fog and
overcast tint use the existing compositor and prepared fog density texture.
Weather transitions, labels, audio and progression stay in WeatherSystem.

GpuNightMask draws local light pockets using GPU destination-out blending into
a bounded mask, followed by one darkness overlay. It retains the original radial
light profile and flicker, respects Low's light cap, and uses world depth to
exclude the sky. Night darkness, ground haze and weather fade together at the
streamed horizon. It does not upload a screen-sized canvas each update.

SRGB tint bytes are converted through a cached lookup before linear-light
blending with the shared artwork. All environment managers run inside the
existing scene draw, dispose their resources on shutdown, and hide outdoors-only
effects in interiors. CPU preparation remains for vector graphics, small source
art textures and changing shoreline masks; gameplay and physics remain on CPU.

WorldPostFX captures the world once into a bounded color/depth target. Perspective
eye depth drives focus around the subject's actual terrain height. Two reduced
resolution five-tap bilateral passes soften distant and near scenery. Depth
haze and restrained grading remain independently configurable. Screen UI,
weather, darkness and transitions composite afterward. Loading scenes bypass
world postprocessing. World depth remains available when precipitation or night
lighting needs it, even with photographic effects disabled. Other unused targets
are released when their effects are disabled.

## Ambient wildlife

Existing prepared rabbit, squirrel, robin and coastal gull atlases remain in use.
Loaded trees, shrubs, roofs and shoreline props supply habitat anchors; ground
routes still require safe terrain. Four ground slots and two bird slots bound
the population, with proximity scans at 125 ms and separate refill cooldowns.
Animals remain ambient visuals without physics bodies or saved progression.
They emerge during daylight in suitable habitats; squirrels can climb, birds
can feed, perch and take flight, and gull flybys remain tied to Tidewatch.

Ground and bird directional poses now follow camera yaw without rotating their
world routes. Resting and social poses refresh during orbiting too. Visibility
checks use actual ground elevation plus perch/flight altitude and reject points
behind the perspective camera. Native Phaser artwork fixtures retain their
original map-view fallback. Existing pause, travel, hidden-tab, scenery-unload
and scene-destruction cleanup still owns every pooled actor.

## Verification status

Only the repository-authorized TypeScript compiler checks are run for this
implementation. No game launch, browser simulation, gameplay tests, production
build or Android device inspection is implied. Compiler success cannot verify
GLSL execution, artwork alignment, visual quality, save traversal or FPS.

Rendered inspection remains necessary for orbiting around dense scenery,
night/weather alignment, all directional combat/equipment poses, jumping across
terrain transitions, interior cutaways, cinematic framing, repeated scene entry,
Android pointer/touch behavior and measured frame time/GPU memory.

These source changes and compiler checks cannot establish bug-free rendering.
GLSL execution, transparency at the horizon, all shadow poses, shelter masks,
sky-facing touch gestures and real-device frame time require authorized rendered
inspection before visual correctness or performance gains can be claimed.
