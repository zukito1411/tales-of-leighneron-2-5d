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

`sourceVolumes.json` contains bounded 64x64 quantized depth surveys of the original
Tree of Life and four complete horse strides. `scripts/author-source-volumes.py`
reproduces them offline from the retained PNG masters and records source hashes.
The meshes are closed rounded image-shaped shells, not newly sculpted anatomical
assets. Their paint and exact front/side silhouettes remain the original artwork;
rear surfaces reuse that paint. No parts of different horse poses are stitched.
Runtime constructs indexed position/normal/UV buffers once per shared prefab.
There are no pixel reads, decoding, texture generation or geometry rebuilds in the
animation loop. These modest source-based volumes are a deliberate 2.5D treatment.

The merchant cart follows the source's open timber body, cream sacks, green roll,
barrel and iron fittings. Spoked wheels rotate rigidly in the existing shader from
travel distance, so stopping also stops the wheels. Horse and cart use route
heading instead of camera yaw. The old 2D presentation path is preserved.

Jagged edges receive contrast-adaptive FXAA in the existing composite pass, with
no extra render target, history buffer, world redraw or MSAA depth resolve. The
old unsharp-mask detail boost and stippled cutaway noise are removed. Standalone
guttered painted material atlases use trilinear mipmaps and bounded anisotropy;
continuous material derivatives avoid false high mip levels at mirror seams.
Animation atlases do not acquire mipmaps. Residency budgets include mip storage.

Validation distinguishes compiler checks, scoped screenshot review and actual
Android device performance. No claim of measured device FPS follows from source
inspection or an APK build.
