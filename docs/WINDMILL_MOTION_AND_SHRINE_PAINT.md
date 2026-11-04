# Windmill motion and shrine paint

## Visible changes

The goddess shrine retains its existing sculpture, but its surfaces now use
larger measured areas of the approved moon-stone sprite. Body, light edge,
shaded carving and gold remain separate painted materials. Larger areas retain
the original grain and chisel marks instead of repeating quiet 12-pixel swatches.
No source image, atlas layout or download pack changes.

Windmill sails turn slowly in calm weather and accelerate gradually with wind
and storms. Nominal settled rates are about 1.2 RPM in calm weather, 5.1 RPM in
strong wind and 6.8 RPM in a full storm. Acceleration takes a few seconds and
never resets the rotation angle. The raised hub keeps the complete swept circle
above standing NPC heads; the stationary tower and ground collision stay intact.

## Rendering cost and lifetime

- One bounded clock per presentation, updated once per engine frame outdoors.
- One shared shader uniform; only tagged sail vertices rotate. Normals rotate
  with them, including in the existing shadow and foreground material paths.
- The tag reuses the existing cutout-pivot attribute. Positive tags still mean
  painted fire; negative tags mean a rigid rotor.
- No additional render batches, texture loads, vertex buffers, animation timers,
  per-mill CPU transforms or world searches are needed for rotation.
- Cached foreground occlusion excludes rotating sails from its static triangle
  tests; the opaque tower still handles character visibility behind structures.
- Existing world streaming remains responsible for visible mill instances.
- Interior/background time does not advance the clock; wake-up deltas are capped.

## Focused validation

`tests/windmillMotion.test.ts` checks gradual acceleration, continuous phase,
bounded weather/deltas, full-circle head clearance and opaque geometry.

`scripts/review-windmills-shrine.mjs` starts an isolated browser and the actual
game, stages an existing Oakmere shrine and admitted mill, records screenshots,
runtime errors, frame times, texture activity and geometry buffer versions, then
checks stronger wind/storm motion. It always closes its own browser and server.
The baseline and updated builds use the same viewport/camera settings. This is
an explicitly requested review, not a new automatic gameplay-test requirement.

Software-rendered Chromium results establish browser behavior, not physical
Android FPS. Device performance still depends on the phone and full scene load.

### Requested in-game review, 4 November 2026

The isolated baseline/updated review passed in Actions run `41841553914`.
Actual game screenshots confirmed the stronger painted surface detail, a raised
axle and changed sail positions in clear, windy and stormy weather. Both compiler
checks and the three focused tests passed. No runtime or shader errors occurred.

The submitted rotor remained one opaque batch (2,796 vertices), position buffer
version 0. Resident textures stayed at 253 MiB and 36 textures; cold creations,
prepared uploads and upload time did not increase during the measured clear,
wind or storm samples. The integrated phase advanced continuously and the
smoothed clock rate rose from calm through 0.218 rad/s in wind to 0.354 rad/s in
storm. This run was still accelerating; these are not the settled nominal rates.

The software GPU was saturated: both builds had a roughly 650 ms median frame
interval. The samples also contained normal scenery streaming. Those frame
times cannot establish hardware performance or justify a no-stutter claim.
The bounded animation path and unchanged rotation buffers are the useful cost
checks here. Physical Android frame pacing remains unverified.
