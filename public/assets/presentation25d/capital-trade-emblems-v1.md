# Capital trade emblems v1

Generated with the built-in image-generation tool, using the repository's
`capital_buildings.png` and `source-building-details-v1.png` as style references.
The PNG is the versioned source master and runtime atlas. Existing source
artwork was not overwritten. The returned image is 1254 × 1254 pixels, opaque,
with a regular 4 × 4 layout; runtime sampling uses normalized quarter cells.

Row-major cells: tankard, bread, scissors/thread, anvil/hammer; breastplate,
compass/sword, crossed polearms/shield, scales; mortar/herbs, open book,
horseshoe, produce basket; carpenter plane, mason hammer/stone, sun, crown.

Generation prompt:

Create one finished game texture atlas of sixteen different medieval trade
emblems in an exact regular four-column by four-row grid. Match the supplied
warm hand-painted miniature fantasy RPG references, dark outlines, rich navy,
aged gold, cream, amber wood and sage details. Flat front view, no perspective,
scene, hanging hardware, frames, labels or watermark. Every cell has an opaque
deep navy cloth background, a complete centered emblem, safe empty margins,
and a bold recognizable silhouette at tiny on-screen size. Use the exact
row-major subjects listed above, with painted interior shading and restrained
detail. Fill the square; no outer margin or grid lines; no neighboring-cell
objects or cropped subjects. Requested size 1024 square; returned source size
is retained without resampling.

The complete cells are mapped with explicit 0–1 UVs. The ordinary repeating
cloth/wood mapping must not be used for these pictorial signs.
