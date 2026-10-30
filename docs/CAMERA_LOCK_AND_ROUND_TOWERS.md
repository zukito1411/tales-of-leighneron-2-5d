# Round structures, camera clearance and target lock

## Structures

Tiered tower profiles use closed, 32-segment circular walls, ledges, roof cones
and crowns. Their existing atlas frontage wraps around the circumference;
opaque masonry fills transparent gaps in the original flat artwork. Foundations
reach the authored ground contact. Window emission follows the same curved
geometry, and lamp attachments project onto the curved frontage.

Contract boards use fixed-facing thin volumes with a back, edge, cap and two
posts. The space below the notice panel remains open. No replacement artwork,
additional runtime images or new asset-loading path is introduced.

## Camera clearance

The orbit retains the player's chosen distance. Circular architecture cutouts
have been removed: they exposed the hollow inside of buildings and could erase
walls beside a player who was already visible.

Only scenery obstructing the actual player becomes translucent, at the same
28% opacity used for trees. Three body samples follow the player's world
position, jumping elevation and billboard lean. At least two samples must be
covered before fading. Modeled buildings, towers, gates, walls and furnishings
also require actual camera-to-body intersections with their solid triangles;
a bounding rectangle alone cannot fade them. Gate openings remain clear.
Painted cutout decorations do not count as solid architecture.

The complete blocking instance fades, with its window/rune emission. Its normal
appearance returns when the obstruction clears. No geometry is discarded and
nearby conversation or locked targets do not create separate holes. Floors and
collision retain their existing behaviour. Faded scenery blends after actors
without writing opaque depth over them; interactive props retain their own click
target, while faded non-interactive walls allow selecting an actor behind them.
Cinematics and passage views retain their authored presentation. Normal player
visibility remains supported while a dialogue or menu disables movement.

The existing viewport collector supplies candidates. Exact intersection work
runs only for models covering the body samples, using cached triangle-block
bounds and reusable vectors. Static model packets retain their original alpha
and transforms across opacity changes. Faded batches use the existing bounded
batch retention/disposal policy. There is no additional framebuffer, per-frame
pixel readback, asset decode or full-world raycast traversal.

## Target lock

- Press **R** or tap **Lock** to acquire an eligible visible enemy; repeat to
  unlock. Direct enemy selection also locks it.
- Explicit selection uses the existing rendered-world limit (2400 world
  units), rather than the old 720 acquisition / 900 release combat limits.
- Acquisition and retention reuse the last submitted enemy pose from the
  presentation renderer. A partially visible pose counts; the renderer's
  offscreen preload guard band does not. Missing/offscreen poses have a 300 ms
  grace period, checked at 100 ms intervals, to avoid edge/animation flicker.
- Ground-level weapon line of sight, night attack eligibility and temporary
  flight vulnerability do not cancel attention. Actual attacks retain all of
  those checks. Only player obstructions trigger scenery fading; target render
  submission is not a GPU pixel-occlusion query.
- Defeat, leaving the rendered-world distance, sustained absence from the
  camera, invalid player/combat state, deliberate unlock and scene/travel
  transitions release the lock. The selected outdoor actor remains resident
  within this limit without loading additional world chunks.
- The orbit follows combat facing and biases its aim toward the target.
  Movement, dodging and zoom retain their existing controls.
- The locked enemy's projected pose is protected from depth-of-field blur and
  reduced haze. Weapon ranges, cover checks and damage rules are unchanged.
- The translucent mobile button sits beside the combat controls, with a
  separate portrait placement. Desktop also has a clickable R-labelled button.

Lock state is transient UI/combat state and is not added to the save payload.

## Sun shafts and performance

Sun shafts accept a source slightly beyond the screen edge and sample their
occlusion along the visible ray, instead of suppressing every shaft whenever
the sun's centre is covered. Clouds, night, interiors and graphics settings
still govern the effect. Existing bounded quality-dependent taps are retained.

Structure geometry remains instanced, with retained normal/faded batches.
Target blur protection and sun changes use existing post-processing passes.
No new framebuffer, per-frame pixel readback or eager world loading is introduced.

## Verification

Both required local TypeScript compiler checks pass. Gameplay, rendered
appearance, device performance and touch ergonomics have not been exercised
locally; compiler success does not establish those results. The Android
workflow independently checks compilation, package identity, signing identity
and the non-debuggable release manifest before publishing the APK.
