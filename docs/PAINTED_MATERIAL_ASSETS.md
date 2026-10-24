# Painted material assets v1

The two generated PNG atlases provide 32 purpose-made flat diffuse materials.
They were created with the built-in image generation tool using the original
building and furniture sheets as style/palette references. They are textures,
not screenshots, meshes or entire-object paintings. Generated source masters
remain under public/assets/presentation25d/ with versioned filenames.

Each image is 1254 x 1254, divided into 4 x 4 cells. The shader samples within
cell gutters and mirrors repeats; no whole-object image is stretched across a
model. Grain orientation follows long timber parts. Structural meshes keep
closed sides, current footprints, interactions, state IDs and save layouts.

Architecture cells (row-major): honey oak, dark oak, cream plaster, rough
limestone; slate shingles, golden thatch, teal fish-scale tiles, dark iron;
ivory masonry, basalt, snowy masonry, charred timber; pirate hull boards,
ship deck planks, rough foundation stone, sooty red forge brick.

Furniture cells (row-major): oak boards, carved gilded oak, walnut, dark iron;
ivory quilted linen, green leaf brocade, royal blue upholstery, teal elven
embroidery; terracotta geometric cloth, navy maritime cloth, winter fleece,
obsidian burgundy cloth; bronze, parchment, carved stone trim, amber leaded glass.

Warped source-object patches have been removed from ordinary beds, chair
cushions/backs, cabinets, house doors/windows, chest fronts and the ship cabin.
Those surfaces use the dedicated materials. Small intentional flat details,
original fire, foliage and thin rigging/cloth retain their original artwork.

The two image decodes use the existing bounded boot loader. Each shared GPU
source is prepared through the existing one-upload-per-frame queue before world
entry. Both atlases use the existing TextureCache lifecycle and residency limit;
together their uncompressed RGBA storage is about 12 MiB. They add sampler inputs
to the existing model batch shader, not a draw call per material or per object.
There are no per-frame image scans, decoding or canvas repaints for the material
system. This is an implementation constraint, not measured Android performance.

Generation prompts (built-in image generation, no CLI):

Architecture: Derive a full-bleed, exactly aligned 4 x 4 material atlas from the
original Tales of Leighneron building sheets. Use the listed sixteen materials
in row-major order. Each cell is an opaque flat orthographic painted surface,
not a building or object. Match the warm, crisp, chunky fantasy RPG brush/pixel
style, bevel highlights, dark crevices and restrained diffuse light. No text,
labels, gaps, border, faces, characters, eyes, skulls, photorealism, perspective
or directional cast shadows. No windows, doors or complete props in a cell.

Furniture: Create the matching full-bleed 4 x 4 furniture material atlas using
the original nine regional furnishing styles and the architecture atlas as
references. Use the listed sixteen materials in row-major order, including
specific regional fabric motifs. All cells are opaque, flat material close-ups
with fine painted detail readable on mobile furniture. No text, labels, gaps,
borders, faces, monsters, eyes, skulls or complete object silhouettes.

Compilation does not establish visual quality or frame pacing. Game captures
must be actual browser/Android rendering; these generated sheets are never
presented as game screenshots.

Source architectural details v1: `source-building-details-v1.png` is a separate
1024 x 1024, 4 x 4 atlas extracted deterministically from the original approved
building sheets, not generated art. Its companion JSON records source pixel
rectangles. Recreate it with `python3 scripts/prepare-building-details.py`
(Pillow required for this optional offline authoring step). It supplies original
window glass, tree glazing, heraldic banners, shop signs and masked foliage
without repeating complete object paintings or depending on sprite-frame UVs.
It uses the same bounded loader/upload lifecycle, adding one shared source and
about 4 MiB of RGBA storage. Alpha is retained for foliage cells.
