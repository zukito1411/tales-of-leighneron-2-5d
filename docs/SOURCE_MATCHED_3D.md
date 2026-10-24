# Original-art style restoration

The retained 2D source masters are the reference, not generic furniture colors.
`FurnitureGeometry` uses the object's surveyed timber/stone crop across its solid
faces and maps individual cloth panels, crests, runners and seat upholstery onto
those components. Blue/gold Highmere and green/gold elven finishes remain distinct.
Open and closed chest bodies share the same height. Barrels use a wider body;
room furniture heights are bounded against the standing hero. Kit loading,
player housing IDs, placement footprints and saved rotations stay authoritative.

`sizeHouseForPlayer` now records missing ground-floor clearance rather than
stretching the complete facade. Roofs and upper joinery translate upward; their
slopes, windows and ornaments keep their authored dimensions. Only wall structure
and the actual doorway grow. Lot X/Z footprints, approaches and collision retain
their existing dimensions. Culling and sun-shadow prefab keys include the lift.

The inner royal precinct's original definitions lacked `wallSegment`. Both its
diagonal runs and horizontal returns now pass their actual ground segments into
the same 3D curtain renderer as the outer defenses. Gate openings are unchanged.

The Elarion fence keeps physical posts/rails, with original flower/leaf panels on
both sides and a grounded green skirt on horizontal sections. Ordinary trees keep
billboards. Their visible foot, rather than the padded frame edge, meets the soil.
Only the Tree of Life switches to a fixed rounded volume shaped by its source.

The Tree of Life continues to use its original painted 64x64 rounded depth
survey in `sourceVolumes.json`, reproduced offline by
`scripts/author-source-volumes.py`. Its source artwork, foliage grounding,
and deterministic shared mesh caching are unchanged.

Roaming horse-drawn merchant carts and all traveling horses have been retired.
The road-caravan generator, horse gait canvases, dedicated mesh/rig baking,
wheel-pose shader paths, and their public art bundles were removed. Static
world wagon props remain, as do sea-route and docked boat traffic. Historic
artwork and source revisions can be recovered from Git history.

Jagged edges receive contrast-adaptive FXAA in the existing composite pass, with
no extra render target, history buffer, world redraw or MSAA depth resolve. The
old unsharp-mask detail boost and stippled cutaway noise are removed. Standalone
guttered painted material atlases use trilinear mipmaps and bounded anisotropy;
continuous material derivatives avoid false high mip levels at mirror seams.
Animation atlases do not acquire mipmaps. Residency budgets include mip storage.

Validation distinguishes compiler checks, scoped screenshot review and actual
Android device performance. No claim of measured device FPS follows from source
inspection or an APK build.

Follow-up visual review corrected material crops that included hoop edges or
transparent backdrop. The offline source surveys now select opaque timber and
stone from each registered source subject, with no extra runtime image reads.
Canopy depth follows a closed, smoothed crown envelope instead of individual leaf
holes. Houses and walls retain the character sight-line opening.
Flower fence posts follow the original spacing,
with the same physical height across horizontal and vertical source views.

Final source checks keep the regular village well's timber, beige stone and
slate roof as separate surveyed materials, rather than treating its water as
masonry. The outdoor trough follows the supplied rectangular pump-and-trough
image. Elven chest lid emblems follow the actual curved lid between its straps.
