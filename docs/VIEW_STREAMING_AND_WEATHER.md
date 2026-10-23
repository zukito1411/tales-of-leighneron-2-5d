# View streaming and weather

Base: 459e732ca843ae4f68befabc5757651451117904.

## Visibility and residency

The renderer already rejected offscreen sprite geometry, but walking residency still kept
an unconditional 3x3 chunk neighborhood plus the rectangular camera footprint. A shared
Three.js frustum now filters terrain/content cells and rejects static image candidates
before expensive sprite projection. Only local camera/player neighborhoods are examined;
there is no full-world traversal. Conservative height bounds retain tall silhouettes.

Walking now keeps the actual view, a small preload band and up to 512 world units of
movement prediction (at most 1.1 seconds). A 384-unit local physics footprint remains
independent of the camera direction. Existing terrain worker painting, source-upload fences,
bounded actor admission and source caches prepare replacements before publication. The small
admitted preload band refreshes source residency periodically, preventing a prepared texture
from being evicted before its first visible draw. Recent
offscreen chunks/content have a short grace period; resource destruction remains incremental.
This combines preparation and retirement during travel without destroying/recreating every
object at each screen edge. Currently visible geometry still receives precise sprite culling.

Nearby enemies remain simulated within their detection/attack reach even when the camera
turns away. Small encounter groups admit nearby survivors atomically; distant members remain
local. Logical state, stable IDs and save snapshots keep their existing owners.

The full-screen sky pass is separate from world residency and is never filtered by the
chunk frustum. The existing sun, moon, stars and cloud artwork remain camera/clock driven.

## Weather and ambience

The particle shader increased world Y with age, causing precipitation to rise. Rain, snow,
ash and dust now descend; the ember subset rises. Existing wind, roof exclusion, world-depth
occlusion, weather transitions and audio remain in place.

Cloud shade previously selected the maximum of shade/rays, hiding the smaller ray component.
The shared ground layer now retains both contributions. A bounded radial depth-mask sunlight
effect is integrated in the existing world compositor (8 taps Normal, 4 Low), with no extra
world render, readback or framebuffer. It follows the sky sun and is disabled at night,
indoors, in heavy cloud cover or when the sun is outside the view. These are screen-space
shafts, not a full volumetric scattering simulation.

A one-time settings migration restores sun rays, weather particles, lantern/window bloom,
fireflies and mist that earlier performance defaults forced off. Subsequent player choices
remain respected. Gameplay state, art sources and signing keys are unchanged.

## Verification and limits

Run both required TypeScript checks, then verify browser and signed Android CI release.
No gameplay/browser tests or development server were run under the standing test restriction.
Compilation/builds cannot establish frame pacing, shader appearance or no-pop streaming on
Android hardware. Device acceptance must cover sustained walking/dashing, 360-degree orbit,
zoom, a repeated route, rain/snow/volcanic ash, daylight rays, night lamps/fireflies and interior
return. Compare raw p95/p99 and resident/queued terrain counts in Advanced graphics diagnostics.

References:
- https://threejs.org/docs/pages/Frustum.html
- https://threejs.org/docs/pages/GodraysNode.html
