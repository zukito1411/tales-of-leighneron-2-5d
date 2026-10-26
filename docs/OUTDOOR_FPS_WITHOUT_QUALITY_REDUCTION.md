# Outdoor frame work without a graphics downgrade

Base source: 56cf3f386b8ba3abc737110caf42f7191b1a8788.

## Texture residency

Required boot, boss-art and chunk upload fences retain their existing mandatory
admission path. The periodic 150 ms refresh of the active chunk/preload band now
uses a distinct speculative warm request. That request respects the existing
128 MiB mobile / 256 MiB desktop cache budget and includes mipmap bytes. It leaves
15% admission headroom for the actual view. After genuine pressure, speculative
warming stays paused until residency falls below 75% of the same budget. Visible
sources are still admitted at full resolution. This prevents eviction followed
by immediate speculative recreation; it does not increase cache limits, load
the whole world, or block a required upload fence.

## Static model submission

World model Sprites now participate in the existing static spatial index as
well as Images. Their actual full-volume renderer cull remains authoritative;
flat source-art bounds cannot hide a long dock, ship or tall tower. Interactive
models retain their picking entries and interaction state each frame.

Unchanged modeled houses and props reuse their matrix, UV, tint and batch key.
Their existing mesh geometry, material and shader continue to render normally.
Changes to position, scale, rotation, origin, frame, elevation, model shape,
pose, tint, alpha, mask, texture residency or interior mode invalidate reuse.
Fire, fountains, sun lighting and cutaways remain driven by their current live
shared uniforms. Billboard actors and anchored emissions retain their original
presentation paths. Caches use weak ownership rather than a growing world list.

## Detailed shadows

A house/prop shadow's matrix is affine in the two current sunlight projection
components. Cache its fixed matrix and four height coefficients, then evaluate
that same projection each frame. This retains the original detailed shadow mesh,
contact stamps, opacity, sun movement, source alpha filtering and existing Low
cadence. No shadow geometry is simplified or removed. Animated/moving actors
continue on the original path; model/transform/options changes rebuild the plan.

## Flat water surface

The water vertex shader always places the surface at one constant height. Its
shore mask, foam, depth colour and motion are all fragment-shader calculations.
Replace its redundant 80x80 plane with one quad: 12,800 triangles become two.
World extent, interpolated ground coordinates, pixel filtering, textures,
shorelines, animation and fragment shading remain the same. Terrain-following
cloud shadows retain their subdivided mesh.

## Evidence and scope

Existing frame diagnostics now expose static-model/shadow plan reuse counters;
texture cache stats also expose speculative suppression and pressure state.
Counters are bounded scalars and are only displayed through the existing
optional diagnostics overlay.

Required compiler checks: npm run test:types and
npm exec --no -- tsc -p tsconfig.node.json --noEmit.
No automated test suite, browser/game launch, gameplay simulation, pixel
comparison or real-device FPS profiling was performed. Source changes remove
specific repeated work; an FPS increase or a fixed frame-rate target has not
been measured. No render-resolution, graphics-default, model/artwork/detail,
effect, combat cadence, save, signing or workflow change is included.
