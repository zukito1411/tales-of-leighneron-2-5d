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

A scene-owned spatial index tracks admitted structure hulls independently of
the drawing frustum. The camera probes nearby hulls along its desired orbit,
pulls forward on obstruction and eases back after clearance. Circular towers
use cylinder intersections; gate openings retain a passage through their hull.
Very close obstructions use a smooth, screen-space dithered cutaway around the
character and locked enemy. This also handles structures surrounding the
camera where fading only an object's centre would miss the obstruction.

The framing distance is bounded to preserve the full character pose. Cutaway
cores participate in picking, so a visually cleared wall does not intercept
the revealed target. Cinematics retain their authored camera behaviour.

The index removes destroyed actors and clears with the scene. Probes use
nearby grid cells rather than full-world traversal or triangle raycasts.

## Target lock

- Press **R** or tap **Lock** to acquire an eligible visible enemy; repeat to
  unlock. Direct enemy selection also locks it.
- Acquisition range is 720 world units; release range is 900. Death, invalid
  combat state or sustained lost sight also releases the lock. Brief cover has
  an 850 ms grace period, checked at 100 ms intervals.
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

Structure geometry remains shared and instanced. Cutaway uses the existing
architecture shader; target blur protection and sun changes use existing
post-processing passes. No new framebuffer, per-frame pixel readback or eager
world loading is introduced.

## Verification

Both required local TypeScript compiler checks pass. Gameplay, rendered
appearance, device performance and touch ergonomics have not been exercised
locally; compiler success does not establish those results. The Android
workflow independently checks compilation, package identity, signing identity
and the non-debuggable release manifest before publishing the APK.
