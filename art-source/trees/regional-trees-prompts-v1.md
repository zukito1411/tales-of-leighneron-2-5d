# Regional billboard trees: source and prompts

Generated with the built-in imagegen tool, followed by one spacing correction.
Style references: `public/assets/sprites/world_assets.png` and `fauna_1.png`.

- Runtime/source master: `public/assets/trees/regional-trees-v1.png` (1254 × 1254 RGBA).
- Recoverable first composition: `art-source/trees/regional-trees-source-v1.png`.
- Registration: `src/data/regionalTrees.ts`; six complete measured crops with
  transparent margins, fitted uniformly into the existing billboard pipeline.
- Inspected both whole atlases, PNG dimensions/alpha and the six source bounds.
  The first composition had neighboring crowns close to cell boundaries. The
  accepted revision separates them. Read-only alpha inspection used a threshold
  of 8 to exclude almost-transparent background residue, then added four pixels
  around each measured subject; no PNG pixels were edited by a script.
- GPU crop/animation and FPP/TPP gameplay inspection remain pending. No game or
  browser was launched for these assets.

## Generation prompt

Use case: illustration-story. Asset type: production pixel RPG billboard tree sprite atlas for Tales of Leighneron, matching the supplied existing world_assets.png and fauna_1.png style references. Create exactly SIX distinct complete tree sprites on a genuine transparent background, in a precise 3-column by 2-row grid, ideally 1536x1536 canvas (each cell 512x768). Top row left: tropical coconut palm with arching fronds and ringed trunk; top middle: tropical broadleaf/banyan with buttress roots and airy spreading crown; top right: majestic exceptionally tall elven silver-white bark tree with tiered emerald and pale teal foliage, long graceful trunk. Bottom row left: tall elven woodland cedar with layered dark emerald boughs and pale bark; bottom middle: dark ancient twisted oak with deep plum-green dense foliage, rugged charcoal bark, moss and roots, no face; bottom right: darkwood black fir with a tall narrow silhouette and deep blue-green foliage. Every tree is an individual finished game sprite, isolated in its own equal cell, upright, viewed from the same slightly elevated frontal three-quarter RPG perspective as the references. ALL six tree base/root contacts align to 94% down their own cell, centered horizontally at the trunk base, consistent small patches of grass/root dressing only. Keep clear 28px transparent outer gutters in every cell. Full crowns and roots entirely contained, no crop, no touch or overlap between cells. Rich hand-painted pixel clusters, crisp edges, detailed textured bark, layered foliage highlights and warm subtle upper-left daylight. Substantial visible trunks, natural realistic proportions, elven tree noticeably tall relative to crown width. Pixel-art game style, no photorealism, no vector silhouettes. No ground plane, scenery, buildings, characters, labels, text, border, drop shadow, watermark, background color or black background. Six separate sprites only, genuine alpha transparency.

## Accepted spacing correction prompt

Use case: precise-object-edit. This image is a production sprite atlas: retain all six finished tree designs, pixel-art rendering, their exact ordering and genuine alpha transparency. Change only spacing and containment: rearrange them into a strict 3-column by 2-row atlas with a broad CLEAR TRANSPARENT GAP separating every sprite. ALL of each tree must stay inside its own cell with at least 32px transparent margin on EACH side, including the bottom-left cedar and bottom-middle dark oak which currently extend into neighboring cells. Uniformly scale whole trees to fit, without stretching or cutting off a single leaf, root or branch. Center trunk contact within each cell, all roots 48px above the bottom of each row. Keep complete sprites and crisp detailed pixel clusters, no merging. Transparent alpha everywhere around the six objects, no panels, text, labels, grid lines, backdrop or shadows. This is solely a spacing correction; no new trees or redesigns.
