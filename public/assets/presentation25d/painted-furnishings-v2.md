# Painted furnishings v2

Generated with the built-in imagegen tool on 2026-10-24. The adjacent PNG is
the retained source master and runtime atlas. v1 remains available for recovery.
References: `assets/interiors/trandum_rustic/kit.png` and
`assets/sprites/others.png`. The deleted historic cart artwork remains
recoverable in Git history.

The sixteen row-major material roles preserve the existing shader layout:
oak, carved oak, dark walnut, iron; cream linen, olive cloth, blue quilt,
teal embroidery; rust cloth, nautical cloth, fleece, dark red cloth;
brass, limestone, carved stone, amber glass. Existing tile-inset sampling and
bounded mipmapped texture residency apply. This replaces one atlas, adding no
extra runtime sampler or atlas decode. Region-specific original painted panels
and furniture IDs remain in use.

Traveling horses and horse-drawn roaming carts were removed from gameplay; this
painted atlas remains active for furniture, foliage accents and static props.

## Generation prompt

Use case: stylized-concept. Asset type: production diffuse texture atlas for existing 3D RPG prop meshes, 4 columns by 4 rows, sixteen equal square tiles, opaque square image, preferably 1024x1024. Reference images show the approved 2D artwork STYLE ONLY: warm hand-painted fantasy RPG wood, chunky dark painted creases, softly highlighted bevels, tiny grain, restrained colors. Generate MATERIAL SURFACES, no finished objects, no perspective, no labels, no text, no margins, no grid lines. Orthographic flat surface textures with even diffuse illumination, no cast shadows, no studio highlights. Precisely fill each equal tile. Tile edges must contain only their own material and avoid an outline frame so repetition works. Tile order row-major is mandatory: row1: (0) warm medium honey-brown oak boards with dark shallow plank creases and painted grain, not orange/gold; (1) carved warm oak leaf scrollwork, restrained muted gold accents; (2) very dark brown walnut boards; (3) charcoal forged iron with tiny aged brass rivets. row2: (4) cream woven sack linen with soft folds; (5) muted olive green cloth with small restrained ochre stitch ornament; (6) royal blue and muted gold quilted fabric; (7) teal elven fabric with delicate muted gold leaf embroidery. row3: (8) rust red coarse geometric cloth; (9) navy nautical cloth with small ochre anchor stitching; (10) ivory wool fleece; (11) dark red and black geometric textile. row4: (12) aged subdued brass with small rivets and dark scratched creases; (13) warm beige limestone; (14) carved grey stone; (15) amber lantern glass with charcoal diamond leading. Match the references' small-scale illustrated RPG rendering, shaded edges and tactile detail. Avoid photorealism, glossy plastic, clean low-poly gradients, flat color fills, oversized motifs or bright yellow timber. This atlas will wrap true 3D carts, tables, chairs, chests and related furniture; each surface must be attractive and readable when reduced to game size. Output only the sixteen-tile material atlas.
